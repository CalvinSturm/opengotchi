use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use crate::error::{AppError, AppResult};
use crate::models::pet::{
    LegacyPetSaveEnvelope, PetAgeStage, PetLifeState, PetStateDto, PET_SAVE_VERSION,
};

const SAVE_FILE_NAME: &str = "pet.json";
const LEGACY_SAVE_FILE_NAME: &str = "pet-save.json";
const SAVE_COMPLETED_EVENT: &str = "pet://save-completed";
const SAVE_FAILED_EVENT: &str = "pet://save-failed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveCompletedEvent {
    operation_id: String,
    saved_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveFailedEvent {
    operation_id: String,
    message: String,
}

pub fn load_pet<R: Runtime>(app: &AppHandle<R>) -> AppResult<PetStateDto> {
    let save_path = pet_save_path(app)?;
    let legacy_save_path = legacy_pet_save_path(app)?;

    let primary_contents = if save_path.exists() {
        Some(fs::read_to_string(save_path)?)
    } else {
        None
    };
    let legacy_contents = if legacy_save_path.exists() {
        Some(fs::read_to_string(legacy_save_path)?)
    } else {
        None
    };

    resolve_loaded_pet(
        primary_contents.as_deref(),
        legacy_contents.as_deref(),
        &current_timestamp()?,
    )
}

pub fn save_pet<R: Runtime>(
    app: &AppHandle<R>,
    operation_id: &str,
    payload: PetStateDto,
) -> AppResult<()> {
    let result = save_pet_inner(app, payload);

    match &result {
        Ok(()) => {
            let _ = app.emit(
                SAVE_COMPLETED_EVENT,
                SaveCompletedEvent {
                    operation_id: operation_id.to_string(),
                    saved_at: current_timestamp().unwrap_or_else(|_| String::from("")),
                },
            );
        }
        Err(error) => {
            let _ = app.emit(
                SAVE_FAILED_EVENT,
                SaveFailedEvent {
                    operation_id: operation_id.to_string(),
                    message: error.to_string(),
                },
            );
        }
    }

    result
}

fn pet_save_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join(SAVE_FILE_NAME))
}

fn legacy_pet_save_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join(LEGACY_SAVE_FILE_NAME))
}

fn current_timestamp() -> AppResult<String> {
    Ok(OffsetDateTime::now_utc().format(&Rfc3339)?)
}

fn timestamp_from_millis(milliseconds: u64) -> AppResult<String> {
    let timestamp =
        OffsetDateTime::from_unix_timestamp_nanos(i128::from(milliseconds) * 1_000_000)?;
    Ok(timestamp.format(&Rfc3339)?)
}

fn convert_legacy_save(legacy_save: LegacyPetSaveEnvelope) -> AppResult<PetStateDto> {
    let last_updated_at = timestamp_from_millis(legacy_save.pet.last_updated_at_ms)?;

    Ok(PetStateDto {
        version: legacy_save.version,
        name: legacy_save.pet.name,
        satiety: legacy_save.pet.satiety,
        fun: legacy_save.pet.fun,
        cleanliness: legacy_save.pet.cleanliness,
        energy: legacy_save.pet.energy,
        health: 84,
        waste: 12,
        life_state: PetLifeState::Alive,
        is_sick: false,
        is_sleeping: legacy_save.pet.is_sleeping,
        started_at: last_updated_at.clone(),
        last_updated_at,
        age_stage: PetAgeStage::Baby,
        care_score: 0,
        care_mistakes: 0,
        adult_outcome: None,
        adult_milestone: None,
        adult_milestone_progress: 0,
        adult_milestone_completed_at: None,
    })
}

fn normalize_loaded_pet(mut pet: PetStateDto) -> PetStateDto {
    if pet.started_at.is_empty() {
        pet.started_at = pet.last_updated_at.clone();
    }

    pet
}

fn save_pet_inner<R: Runtime>(app: &AppHandle<R>, payload: PetStateDto) -> AppResult<()> {
    validate_pet_state(&payload)?;

    let save_path = pet_save_path(app)?;
    let contents = serde_json::to_string_pretty(&payload)?;

    write_atomic_file(&save_path, &contents)?;

    Ok(())
}

fn write_atomic_file(path: &Path, contents: &str) -> AppResult<()> {
    let temp_path = temporary_write_path(path)?;
    let mut temp_file = fs::File::create(&temp_path)?;

    temp_file.write_all(contents.as_bytes())?;
    temp_file.sync_all()?;
    drop(temp_file);

    if !path.exists() {
        fs::rename(&temp_path, path)?;
        return Ok(());
    }

    let backup_path = backup_write_path(path)?;
    fs::rename(path, &backup_path)?;

    match fs::rename(&temp_path, path) {
        Ok(()) => {
            fs::remove_file(&backup_path)?;
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&backup_path, path);
            let _ = fs::remove_file(&temp_path);
            Err(error.into())
        }
    }
}

fn temporary_write_path(path: &Path) -> AppResult<PathBuf> {
    unique_sibling_path(path, "tmp")
}

fn backup_write_path(path: &Path) -> AppResult<PathBuf> {
    unique_sibling_path(path, "bak")
}

fn unique_sibling_path(path: &Path, suffix: &str) -> AppResult<PathBuf> {
    let parent = path
        .parent()
        .ok_or(AppError::Validation("save path must have a parent directory"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(AppError::Validation("save path must have a valid file name"))?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_nanos();

    Ok(parent.join(format!(
        "{file_name}.{suffix}.{}.{}",
        std::process::id(),
        timestamp
    )))
}

fn resolve_loaded_pet(
    primary_contents: Option<&str>,
    legacy_contents: Option<&str>,
    now_timestamp: &str,
) -> AppResult<PetStateDto> {
    if let Some(contents) = primary_contents {
        let pet = normalize_loaded_pet(serde_json::from_str::<PetStateDto>(contents)?);
        validate_pet_state(&pet)?;
        return Ok(pet);
    }

    if let Some(contents) = legacy_contents {
        let legacy_save = serde_json::from_str::<LegacyPetSaveEnvelope>(contents)?;
        let pet = convert_legacy_save(legacy_save)?;
        validate_pet_state(&pet)?;
        return Ok(pet);
    }

    Ok(PetStateDto::starter(now_timestamp.to_string()))
}

fn validate_pet_state(pet: &PetStateDto) -> AppResult<()> {
    if pet.version != PET_SAVE_VERSION {
        return Err(AppError::UnsupportedVersion(pet.version));
    }

    if !pet.has_valid_core_fields() {
        return Err(AppError::Validation("pet state contains invalid fields"));
    }

    let _ = OffsetDateTime::parse(&pet.last_updated_at, &Rfc3339)?;
    let _ = OffsetDateTime::parse(&pet.started_at, &Rfc3339)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::pet::PetAdultOutcome;
    use serde_json::json;
    use std::env;

    fn create_test_dir(name: &str) -> PathBuf {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time should be available")
            .as_nanos();
        let path = env::temp_dir().join(format!(
            "opengotchi-{name}-{}-{}",
            std::process::id(),
            timestamp
        ));
        fs::create_dir_all(&path).expect("test directory should be created");
        path
    }

    #[test]
    fn resolves_default_pet_when_no_save_files_exist() {
        let now = "2026-04-01T17:00:00.000Z";
        let pet = resolve_loaded_pet(None, None, now).expect("default pet should resolve");

        assert_eq!(pet.version, PET_SAVE_VERSION);
        assert_eq!(pet.name, "Byte");
        assert_eq!(pet.started_at, now);
        assert_eq!(pet.last_updated_at, now);
        assert_eq!(pet.age_stage, PetAgeStage::Baby);
        assert_eq!(pet.life_state, PetLifeState::Egg);
        assert_eq!(pet.care_score, 0);
        assert_eq!(pet.care_mistakes, 0);
        assert_eq!(pet.adult_outcome, None);
        assert_eq!(pet.adult_milestone, None);
        assert_eq!(pet.adult_milestone_progress, 0);
        assert_eq!(pet.adult_milestone_completed_at, None);
    }

    #[test]
    fn migrates_legacy_envelope_save_into_current_pet_dto() {
        let legacy_save = json!({
            "version": 1,
            "pet": {
                "name": "Byte",
                "satiety": 75,
                "fun": 61,
                "cleanliness": 55,
                "energy": 49,
                "isSleeping": false,
                "lastUpdatedAtMs": 1711990800000u64
            }
        });

        let pet = resolve_loaded_pet(
            None,
            Some(&legacy_save.to_string()),
            "2026-04-01T17:00:00.000Z",
        )
        .expect("legacy save should migrate");

        assert_eq!(pet.version, 1);
        assert_eq!(pet.satiety, 75);
        assert_eq!(pet.health, 84);
        assert_eq!(pet.waste, 12);
        assert_eq!(pet.life_state, PetLifeState::Alive);
        assert!(!pet.is_sick);
        assert_eq!(pet.started_at, "2024-04-01T17:00:00Z");
        assert_eq!(pet.last_updated_at, "2024-04-01T17:00:00Z");
        assert_eq!(pet.age_stage, PetAgeStage::Baby);
        assert_eq!(pet.care_score, 0);
        assert_eq!(pet.care_mistakes, 0);
        assert_eq!(pet.adult_outcome, None);
        assert_eq!(pet.adult_milestone, None);
        assert_eq!(pet.adult_milestone_progress, 0);
        assert_eq!(pet.adult_milestone_completed_at, None);
    }

    #[test]
    fn defaults_new_fields_when_loading_previous_direct_pet_save() {
        let previous_save = json!({
            "version": 1,
            "name": "Byte",
            "satiety": 78,
            "fun": 72,
            "cleanliness": 80,
            "energy": 68,
            "isSleeping": false,
            "lastUpdatedAt": "2026-04-01T17:00:00.000Z"
        });

        let pet = resolve_loaded_pet(
            Some(&previous_save.to_string()),
            None,
            "2026-04-01T17:30:00.000Z",
        )
        .expect("previous direct save should still load");

        assert_eq!(pet.health, 84);
        assert_eq!(pet.waste, 12);
        assert_eq!(pet.life_state, PetLifeState::Alive);
        assert!(!pet.is_sick);
        assert_eq!(pet.started_at, "2026-04-01T17:00:00.000Z");
        assert_eq!(pet.age_stage, PetAgeStage::Baby);
        assert_eq!(pet.care_score, 0);
        assert_eq!(pet.care_mistakes, 0);
        assert_eq!(pet.adult_outcome, None);
        assert_eq!(pet.adult_milestone, None);
        assert_eq!(pet.adult_milestone_progress, 0);
        assert_eq!(pet.adult_milestone_completed_at, None);
    }

    #[test]
    fn preserves_started_at_and_age_stage_when_current_save_has_them() {
        let current_save = json!({
            "version": 1,
            "name": "Byte",
            "satiety": 78,
            "fun": 72,
            "cleanliness": 80,
            "energy": 68,
            "health": 84,
            "waste": 12,
            "lifeState": "dead",
            "isSick": false,
            "isSleeping": false,
            "startedAt": "2026-04-01T00:00:00.000Z",
            "lastUpdatedAt": "2026-04-02T08:00:00.000Z",
            "ageStage": "adult",
            "careScore": 22,
            "careMistakes": 5,
            "adultOutcome": "resilient",
            "adultMilestone": "recovery-run",
            "adultMilestoneProgress": 2,
            "adultMilestoneCompletedAt": "2026-04-02T08:30:00.000Z"
        });

        let pet = resolve_loaded_pet(
            Some(&current_save.to_string()),
            None,
            "2026-04-01T17:30:00.000Z",
        )
        .expect("current save should load unchanged");

        assert_eq!(pet.started_at, "2026-04-01T00:00:00.000Z");
        assert_eq!(pet.age_stage, PetAgeStage::Adult);
        assert_eq!(pet.life_state, PetLifeState::Dead);
        assert_eq!(pet.care_score, 22);
        assert_eq!(pet.care_mistakes, 5);
        assert_eq!(pet.adult_outcome, Some(PetAdultOutcome::Resilient));
        assert_eq!(
            pet.adult_milestone_completed_at,
            Some("2026-04-02T08:30:00.000Z".to_string())
        );
        assert_eq!(pet.adult_milestone_progress, 2);
    }

    #[test]
    fn atomic_write_replaces_existing_pet_save_contents() {
        let test_dir = create_test_dir("pet-atomic-write");
        let save_path = test_dir.join("pet.json");

        fs::write(&save_path, "{\"version\":1}").expect("seed save should exist");
        write_atomic_file(&save_path, "{\"version\":2}").expect("atomic write should succeed");

        let written_contents = fs::read_to_string(&save_path).expect("save should be readable");

        assert_eq!(written_contents, "{\"version\":2}");

        fs::remove_dir_all(&test_dir).expect("test directory should be removed");
    }
}

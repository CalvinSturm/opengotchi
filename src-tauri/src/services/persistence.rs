use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use crate::error::{AppError, AppResult};
use crate::models::pet::{LegacyPetSaveEnvelope, PetStateDto, PET_SAVE_VERSION};

const SAVE_FILE_NAME: &str = "pet.json";
const LEGACY_SAVE_FILE_NAME: &str = "pet-save.json";

pub fn load_pet<R: Runtime>(app: &AppHandle<R>) -> AppResult<PetStateDto> {
    let save_path = pet_save_path(app)?;

    if save_path.exists() {
        let contents = fs::read_to_string(save_path)?;
        let pet = serde_json::from_str::<PetStateDto>(&contents)?;
        validate_pet_state(&pet)?;
        return Ok(pet);
    }

    let legacy_save_path = legacy_pet_save_path(app)?;

    if legacy_save_path.exists() {
        let contents = fs::read_to_string(legacy_save_path)?;
        let legacy_save = serde_json::from_str::<LegacyPetSaveEnvelope>(&contents)?;
        let pet = convert_legacy_save(legacy_save)?;
        validate_pet_state(&pet)?;
        return Ok(pet);
    }

    Ok(PetStateDto::starter(current_timestamp()?))
}

pub fn save_pet<R: Runtime>(app: &AppHandle<R>, payload: PetStateDto) -> AppResult<()> {
    validate_pet_state(&payload)?;

    let save_path = pet_save_path(app)?;
    let contents = serde_json::to_string_pretty(&payload)?;

    fs::write(save_path, contents)?;

    Ok(())
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
    Ok(PetStateDto {
        version: legacy_save.version,
        name: legacy_save.pet.name,
        satiety: legacy_save.pet.satiety,
        fun: legacy_save.pet.fun,
        cleanliness: legacy_save.pet.cleanliness,
        energy: legacy_save.pet.energy,
        is_sleeping: legacy_save.pet.is_sleeping,
        last_updated_at: timestamp_from_millis(legacy_save.pet.last_updated_at_ms)?,
    })
}

fn validate_pet_state(pet: &PetStateDto) -> AppResult<()> {
    if pet.version != PET_SAVE_VERSION {
        return Err(AppError::UnsupportedVersion(pet.version));
    }

    if !pet.has_valid_core_fields() {
        return Err(AppError::Validation("pet state contains invalid fields"));
    }

    let _ = OffsetDateTime::parse(&pet.last_updated_at, &Rfc3339)?;

    Ok(())
}

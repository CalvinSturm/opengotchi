use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};
use crate::models::settings::{SettingsDto, SETTINGS_VERSION};

const SETTINGS_FILE_NAME: &str = "settings.json";

pub fn load_settings<R: Runtime>(app: &AppHandle<R>) -> AppResult<SettingsDto> {
    let settings_path = settings_path(app)?;

    if !settings_path.exists() {
        return Ok(SettingsDto::starter());
    }

    let contents = fs::read_to_string(settings_path)?;
    let settings = serde_json::from_str::<SettingsDto>(&contents)?;
    validate_settings(&settings)?;

    Ok(settings)
}

pub fn save_settings<R: Runtime>(app: &AppHandle<R>, payload: SettingsDto) -> AppResult<()> {
    validate_settings(&payload)?;

    let settings_path = settings_path(app)?;
    let contents = serde_json::to_string_pretty(&payload)?;

    write_atomic_file(&settings_path, &contents)?;

    Ok(())
}

fn settings_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join(SETTINGS_FILE_NAME))
}

fn validate_settings(settings: &SettingsDto) -> AppResult<()> {
    if settings.version != SETTINGS_VERSION {
        return Err(AppError::UnsupportedVersion(settings.version));
    }

    if !settings.is_valid() {
        return Err(AppError::Validation("settings payload contains invalid fields"));
    }

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
        .ok_or(AppError::Validation("settings path must have a parent directory"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(AppError::Validation("settings path must have a valid file name"))?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_nanos();

    Ok(parent.join(format!(
        "{file_name}.{suffix}.{}.{}",
        std::process::id(),
        timestamp
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn atomic_write_replaces_existing_settings_contents() {
        let test_dir = create_test_dir("settings-atomic-write");
        let settings_path = test_dir.join("settings.json");

        fs::write(&settings_path, "{\"version\":1}").expect("seed settings should exist");
        write_atomic_file(&settings_path, "{\"version\":2}").expect("atomic write should succeed");

        let written_contents =
            fs::read_to_string(&settings_path).expect("settings should be readable");

        assert_eq!(written_contents, "{\"version\":2}");

        fs::remove_dir_all(&test_dir).expect("test directory should be removed");
    }
}

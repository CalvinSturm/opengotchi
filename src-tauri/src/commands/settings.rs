use tauri::AppHandle;

use crate::models::settings::SettingsDto;
use crate::services::settings;

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<SettingsDto, String> {
    settings::load_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, payload: SettingsDto) -> Result<(), String> {
    settings::save_settings(&app, payload).map_err(|error| error.to_string())
}

use tauri::AppHandle;

use crate::models::pet::PetStateDto;
use crate::services::persistence;

#[tauri::command]
pub fn load_pet(app: AppHandle) -> Result<PetStateDto, String> {
    persistence::load_pet(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_pet(app: AppHandle, payload: PetStateDto) -> Result<(), String> {
    persistence::save_pet(&app, payload).map_err(|error| error.to_string())
}

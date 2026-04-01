use tauri::AppHandle;

use crate::models::notification::{PetNotificationDto, PetReminderSyncDto};
use crate::services::{notifications, window};

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    window::show_main_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    window::hide_main_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    window::set_always_on_top(&app, enabled).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn send_pet_notification(app: AppHandle, payload: PetNotificationDto) -> Result<(), String> {
    notifications::send_pet_notification(&app, payload).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_pet_reminder(app: AppHandle, payload: PetReminderSyncDto) -> Result<(), String> {
    notifications::sync_pet_reminder(&app, payload).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reveal_save_folder(app: AppHandle) -> Result<(), String> {
    window::reveal_save_folder(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), String> {
    window::quit_app(&app).map_err(|error| error.to_string())
}

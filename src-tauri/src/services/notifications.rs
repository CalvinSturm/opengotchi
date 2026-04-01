use tauri_plugin_notification::NotificationExt;

use crate::error::{AppError, AppResult};
use crate::models::notification::PetNotificationDto;

pub fn initialize<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    Ok(())
}

pub fn send_pet_notification<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    payload: PetNotificationDto,
) -> AppResult<()> {
    if !payload.is_valid() {
        return Err(AppError::Validation(
            "notification payload requires non-empty title and body",
        ));
    }

    app.notification()
        .builder()
        .title(payload.title)
        .body(payload.body)
        .show()?;

    Ok(())
}

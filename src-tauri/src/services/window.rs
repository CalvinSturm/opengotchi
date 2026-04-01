use std::path::Path;
use std::process::Command;

use tauri::Manager;

use crate::error::{AppError, AppResult};

pub fn configure<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title("OpenGotchi")?;
    }

    Ok(())
}

pub fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<()> {
    let window = main_window(app)?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}

pub fn hide_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<()> {
    let window = main_window(app)?;
    window.hide()?;
    Ok(())
}

pub fn set_always_on_top<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    enabled: bool,
) -> AppResult<()> {
    let window = main_window(app)?;
    window.set_always_on_top(enabled)?;
    Ok(())
}

pub fn reveal_save_folder<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<()> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    open_directory(&app_data_dir)?;
    Ok(())
}

pub fn quit_app<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<()> {
    app.exit(0);
    Ok(())
}

fn main_window<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> AppResult<tauri::WebviewWindow<R>> {
    app.get_webview_window("main")
        .ok_or(AppError::Validation("main window is not available"))
}

fn open_directory(path: &Path) -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(path).spawn()?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn()?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(path).spawn()?;
    }

    Ok(())
}

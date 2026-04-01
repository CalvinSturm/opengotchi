use tauri::Manager;

pub fn configure<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title("OpenGotchi")?;
    }

    Ok(())
}

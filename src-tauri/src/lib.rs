mod commands;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            services::window::configure(&handle)?;
            services::tray::initialize(&handle)?;
            services::notifications::initialize(&handle)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pet::load_pet,
            commands::pet::save_pet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

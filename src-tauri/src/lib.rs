mod commands;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();
            services::window::configure(&handle)?;
            services::tray::initialize(&handle)?;
            services::notifications::initialize(&handle)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::show_main_window,
            commands::app::hide_main_window,
            commands::app::set_always_on_top,
            commands::app::send_pet_notification,
            commands::app::reveal_save_folder,
            commands::app::quit_app,
            commands::pet::load_pet,
            commands::pet::save_pet,
            commands::settings::load_settings,
            commands::settings::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

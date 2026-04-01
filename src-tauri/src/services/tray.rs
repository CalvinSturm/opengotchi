use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;

const TRAY_ID: &str = "main";
const MENU_OPEN_ID: &str = "tray-open-main-window";
const MENU_FEED_ID: &str = "tray-feed-shortcut";
const MENU_PLAY_ID: &str = "tray-play-shortcut";

pub fn initialize<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, MENU_OPEN_ID, "Open", true, None::<&str>)?;
    let feed_item = MenuItem::with_id(app, MENU_FEED_ID, "Feed", true, None::<&str>)?;
    let play_item = MenuItem::with_id(app, MENU_PLAY_ID, "Play", true, None::<&str>)?;
    let quit_item = PredefinedMenuItem::quit(app, Some("Quit"))?;
    let menu = Menu::with_items(
        app,
        &[&open_item, &feed_item, &play_item, &quit_item],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("OpenGotchi")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                MENU_OPEN_ID => {
                    let _ = app.emit("tray://open-main-window", ());
                }
                MENU_FEED_ID => {
                    let _ = app.emit("tray://feed-shortcut", ());
                }
                MENU_PLAY_ID => {
                    let _ = app.emit("tray://play-shortcut", ());
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if should_open_main_window(&event) {
                let _ = tray.app_handle().emit("tray://open-main-window", ());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    let _ = builder.build(app)?;
    Ok(())
}

fn should_open_main_window(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn left_click_release_opens_main_window() {
        let event = TrayIconEvent::Click {
            id: "main".into(),
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            position: tauri::PhysicalPosition::new(0.0, 0.0),
            rect: tauri::Rect {
                position: tauri::PhysicalPosition::new(0, 0).into(),
                size: tauri::PhysicalSize::new(16, 16).into(),
            },
        };

        assert!(should_open_main_window(&event));
    }

    #[test]
    fn non_left_click_release_does_not_open_main_window() {
        let event = TrayIconEvent::Click {
            id: "main".into(),
            button: MouseButton::Right,
            button_state: MouseButtonState::Up,
            position: tauri::PhysicalPosition::new(0.0, 0.0),
            rect: tauri::Rect {
                position: tauri::PhysicalPosition::new(0, 0).into(),
                size: tauri::PhysicalSize::new(16, 16).into(),
            },
        };

        assert!(!should_open_main_window(&event));
    }
}

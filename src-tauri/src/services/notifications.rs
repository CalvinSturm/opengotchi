use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;
use time::{Duration as TimeDuration, OffsetDateTime};

use crate::error::{AppError, AppResult};
use crate::models::notification::{PetNotificationDto, PetReminderDto, PetReminderSyncDto};

const REMINDER_INTERVAL_SECONDS: i64 = 15 * 60;
const REMINDER_POLL_SECONDS: u64 = 60;

#[derive(Debug, Default)]
pub struct NotificationSchedulerState {
    runtime: Mutex<ReminderRuntimeState>,
}

#[derive(Debug, Default)]
struct ReminderRuntimeState {
    notifications_enabled: bool,
    reminder: Option<PetReminderDto>,
    last_delivered_key: Option<String>,
    last_delivered_at: Option<OffsetDateTime>,
}

pub fn initialize<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    app.manage(NotificationSchedulerState::default());

    let handle = app.clone();

    std::thread::spawn(move || {
        loop {
            let _ = deliver_due_reminder(&handle);
            std::thread::sleep(Duration::from_secs(REMINDER_POLL_SECONDS));
        }
    });

    Ok(())
}

pub fn send_pet_notification<R: Runtime>(
    app: &AppHandle<R>,
    payload: PetNotificationDto,
) -> AppResult<()> {
    if !payload.is_valid() {
        return Err(AppError::Validation(
            "notification payload requires non-empty title and body",
        ));
    }

    show_notification(app, &payload.title, &payload.body)
}

pub fn sync_pet_reminder<R: Runtime>(
    app: &AppHandle<R>,
    payload: PetReminderSyncDto,
) -> AppResult<()> {
    if !payload.is_valid() {
        return Err(AppError::Validation("reminder payload contains invalid fields"));
    }

    let scheduler_state = app.state::<NotificationSchedulerState>();
    let mut runtime = lock_runtime_state(&scheduler_state)?;

    runtime.notifications_enabled = payload.notifications_enabled;

    if !payload.notifications_enabled {
        runtime.reminder = None;
        runtime.last_delivered_key = None;
        runtime.last_delivered_at = None;
        return Ok(());
    }

    match payload.reminder {
        Some(reminder) => {
            let reminder_changed = runtime.reminder.as_ref() != Some(&reminder);

            runtime.reminder = Some(reminder);

            if reminder_changed {
                runtime.last_delivered_key = None;
                runtime.last_delivered_at = None;
            }
        }
        None => {
            runtime.reminder = None;
            runtime.last_delivered_key = None;
            runtime.last_delivered_at = None;
        }
    }

    maybe_deliver_due_reminder(app, &mut runtime, OffsetDateTime::now_utc())
}

fn deliver_due_reminder<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let scheduler_state = app.state::<NotificationSchedulerState>();
    let mut runtime = lock_runtime_state(&scheduler_state)?;

    maybe_deliver_due_reminder(app, &mut runtime, OffsetDateTime::now_utc())
}

fn maybe_deliver_due_reminder<R: Runtime>(
    app: &AppHandle<R>,
    runtime: &mut ReminderRuntimeState,
    now: OffsetDateTime,
) -> AppResult<()> {
    let reminder = match runtime.reminder.clone() {
        Some(reminder) if runtime.notifications_enabled => reminder,
        _ => return Ok(()),
    };

    if !should_deliver_reminder(runtime, &reminder, now) {
        return Ok(());
    }

    show_notification(app, &reminder.title, &reminder.body)?;
    runtime.last_delivered_key = Some(reminder.key);
    runtime.last_delivered_at = Some(now);

    Ok(())
}

fn should_deliver_reminder(
    runtime: &ReminderRuntimeState,
    reminder: &PetReminderDto,
    now: OffsetDateTime,
) -> bool {
    match (&runtime.last_delivered_key, runtime.last_delivered_at) {
        (Some(last_key), Some(last_delivered_at)) if last_key == &reminder.key => {
            now - last_delivered_at >= TimeDuration::seconds(REMINDER_INTERVAL_SECONDS)
        }
        _ => true,
    }
}

fn show_notification<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: &str,
) -> AppResult<()> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()?;

    Ok(())
}

fn lock_runtime_state<'a>(
    scheduler_state: &'a NotificationSchedulerState,
) -> AppResult<std::sync::MutexGuard<'a, ReminderRuntimeState>> {
    scheduler_state
        .runtime
        .lock()
        .map_err(|_| AppError::Validation("notification state is unavailable"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reminder(key: &str) -> PetReminderDto {
        PetReminderDto {
            key: key.to_string(),
            title: "Byte needs attention".to_string(),
            body: "Feed your pet soon.".to_string(),
        }
    }

    #[test]
    fn delivers_immediately_when_no_prior_delivery_exists() {
        let runtime = ReminderRuntimeState {
            notifications_enabled: true,
            reminder: Some(reminder("hungry")),
            last_delivered_key: None,
            last_delivered_at: None,
        };

        assert!(should_deliver_reminder(
            &runtime,
            runtime.reminder.as_ref().expect("reminder should exist"),
            OffsetDateTime::UNIX_EPOCH
        ));
    }

    #[test]
    fn suppresses_repeat_delivery_inside_cooldown() {
        let runtime = ReminderRuntimeState {
            notifications_enabled: true,
            reminder: Some(reminder("hungry")),
            last_delivered_key: Some("hungry".to_string()),
            last_delivered_at: Some(OffsetDateTime::UNIX_EPOCH),
        };

        assert!(!should_deliver_reminder(
            &runtime,
            runtime.reminder.as_ref().expect("reminder should exist"),
            OffsetDateTime::UNIX_EPOCH + TimeDuration::minutes(5)
        ));
    }

    #[test]
    fn allows_repeat_delivery_after_cooldown() {
        let runtime = ReminderRuntimeState {
            notifications_enabled: true,
            reminder: Some(reminder("hungry")),
            last_delivered_key: Some("hungry".to_string()),
            last_delivered_at: Some(OffsetDateTime::UNIX_EPOCH),
        };

        assert!(should_deliver_reminder(
            &runtime,
            runtime.reminder.as_ref().expect("reminder should exist"),
            OffsetDateTime::UNIX_EPOCH + TimeDuration::minutes(20)
        ));
    }

    #[test]
    fn delivers_immediately_when_alert_key_changes() {
        let runtime = ReminderRuntimeState {
            notifications_enabled: true,
            reminder: Some(reminder("dirty")),
            last_delivered_key: Some("hungry".to_string()),
            last_delivered_at: Some(OffsetDateTime::UNIX_EPOCH),
        };

        assert!(should_deliver_reminder(
            &runtime,
            runtime.reminder.as_ref().expect("reminder should exist"),
            OffsetDateTime::UNIX_EPOCH + TimeDuration::minutes(1)
        ));
    }
}

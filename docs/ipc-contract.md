# IPC Contract

## Scope

- This document defines the current IPC boundary.
- All commands and events listed here reflect implemented behavior in the current repo state.

## Tauri IPC Model

- Frontend -> Rust:
  - call `invoke("<command>", payload?)`
  - receive a Promise result or a rejected Promise
- Rust -> frontend:
  - emit Tauri events
  - events are one-way messages

## Rules

- All IPC payloads must be JSON-serializable.
- Frontend must not access the filesystem directly.
- Commands must be typed, minimal, and narrow.
- Commands must accept validated DTOs, not ad hoc maps.
- Rust must treat all frontend input as untrusted.

## DTOs

```ts
export type PetStateDTO = {
  version: 1;
  name: string;
  satiety: number;
  fun: number;
  cleanliness: number;
  energy: number;
  health: number;
  waste: number;
  lifeState: 'egg' | 'alive' | 'dead';
  isSick: boolean;
  isSleeping: boolean;
  startedAt: string;
  lastUpdatedAt: string;
  ageStage: 'baby' | 'child' | 'teen' | 'adult';
  careScore: number;
  careMistakes: number;
  adultOutcome: 'balanced' | 'playful' | 'messy' | 'resilient' | null;
  adultMilestone:
    | 'steady-routine'
    | 'showtime'
    | 'spring-clean'
    | 'recovery-run'
    | null;
  adultMilestoneProgress: number;
  adultMilestoneCompletedAt: string | null;
};

export type SettingsDTO = {
  version: 1;
  alwaysOnTop: boolean;
  notificationsEnabled: boolean;
};

export type PetNotificationDTO = {
  title: string;
  body: string;
};

export type PetReminderDTO = {
  key: string;
  title: string;
  body: string;
};

export type PetReminderSyncDTO = {
  notificationsEnabled: boolean;
  reminder: PetReminderDTO | null;
};

export type SaveCompletedEvent = {
  operationId: string;
  savedAt: string;
};

export type SaveFailedEvent = {
  operationId: string;
  message: string;
};
```

## Frontend -> Rust Commands

- `load_pet(): Promise<PetStateDTO>`
  - loads the current pet state from disk
  - if no save exists, Rust returns a default `PetStateDTO`
- `save_pet(operationId: string, payload: PetStateDTO): Promise<void>`
  - persists the current pet state
  - `operationId` is generated on the frontend and echoed back in async save-status events
- `load_settings(): Promise<SettingsDTO>`
  - loads persisted app settings
- `save_settings(payload: SettingsDTO): Promise<void>`
  - persists app settings
- `show_main_window(): Promise<void>`
  - shows and focuses the main window
- `hide_main_window(): Promise<void>`
  - hides the main window
- `set_always_on_top(enabled: boolean): Promise<void>`
  - updates the main window always-on-top state
- `send_pet_notification(payload: PetNotificationDTO): Promise<void>`
  - sends a desktop notification
- `sync_pet_reminder(payload: PetReminderSyncDTO): Promise<void>`
  - syncs the current highest-priority reminder candidate to the desktop layer
  - Rust owns cooldown, repeat timing, and immediate delivery when the reminder changes
- `reveal_save_folder(): Promise<void>`
  - opens the app save directory in the host OS
- `quit_app(): Promise<void>`
  - exits the desktop app

## Rust -> Frontend Events

- `tray://open-main-window`
  - payload: `null`
- `tray://feed-shortcut`
  - payload: `null`
- `tray://play-shortcut`
  - payload: `null`
- `pet://save-completed`
  - payload: `SaveCompletedEvent`
- `pet://save-failed`
  - payload: `SaveFailedEvent`

## Shape Examples

### PetStateDTO

```json
{
  "version": 1,
  "name": "Byte",
  "satiety": 78,
  "fun": 72,
  "cleanliness": 80,
  "energy": 68,
  "health": 84,
  "waste": 12,
  "lifeState": "alive",
  "isSick": false,
  "isSleeping": false,
  "startedAt": "2026-04-01T12:00:00.000Z",
  "lastUpdatedAt": "2026-04-01T17:00:00.000Z",
  "ageStage": "child",
  "careScore": 14,
  "careMistakes": 2,
  "adultOutcome": null,
  "adultMilestone": null,
  "adultMilestoneProgress": 0,
  "adultMilestoneCompletedAt": null
}
```

### SettingsDTO

```json
{
  "version": 1,
  "alwaysOnTop": false,
  "notificationsEnabled": true
}
```

### PetNotificationDTO

```json
{
  "title": "Byte is hungry",
  "body": "Feed your pet soon."
}
```

## Error Handling

- Command failures are represented as Tauri command errors.
- In the MVP, command errors should reject the `invoke()` Promise with a message string.
- The frontend should not rely on mixed success/error union payloads for commands.
- `pet://save-failed` is the event-side failure signal for async or background save status.
- `pet://save-completed` and `pet://save-failed` both include the originating `operationId`.
- Frontend pet state is optimistic: the current pet stays live in memory even if persistence fails.
- Save failure means the state is marked unsaved, not silently reverted.
- Do not return both a success payload and an embedded error object from the same command response.

## Versioning

- DTOs that persist to disk must include `version`.
- Version changes must be backward-compatible when practical.
- New fields should be additive and have safe defaults.
- Breaking schema changes require explicit Rust-side migration logic before values cross into frontend state.

## What Must Not Cross IPC

- large blobs
- raw file handles
- unvalidated input
- frontend-generated file paths
- direct OS-specific path assumptions
- non-JSON values such as functions, class instances, or streams

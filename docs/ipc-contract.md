# IPC Contract

## Scope

- This document defines the MVP IPC boundary.
- Today, the bootstrap already uses `invoke()` for pet persistence.
- Commands and events listed here that are not yet in code are planned interfaces, not implemented facts.

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
  isSleeping: boolean;
  lastUpdatedAt: string;
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

export type SaveCompletedEvent = {
  savedAt: string;
};

export type SaveFailedEvent = {
  message: string;
};
```

## Frontend -> Rust Commands

- `load_pet(): Promise<PetStateDTO>`
  - loads the current pet state from disk
  - if no save exists, Rust returns a default `PetStateDTO`
- `save_pet(payload: PetStateDTO): Promise<void>`
  - persists the current pet state
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
  "isSleeping": false,
  "lastUpdatedAt": "2026-04-01T17:00:00.000Z"
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

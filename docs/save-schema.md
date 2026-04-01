# Save Schema

## Scope

- This document defines the intended MVP on-disk format.
- If current code still uses a different temporary save layout, treat this file as the target save contract.

## File Locations

- Tauri app data directory owns persisted files.
- Pet state file:
  - `pet.json`
- Settings file:
  - `settings.json`

## Concrete Types

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
```

## PetStateDTO Rules

- `version` is required.
- `lastUpdatedAt` is required.
- `name` is required.
- `satiety`, `fun`, `cleanliness`, `energy`, `health`, and `waste` are required numeric fields.
- pet stat values must stay in the inclusive range `0..100`.
- `lifeState` is required.
- `lifeState: "egg"` is the default when no save exists yet.
- `isSick` is required.
- `isSleeping` is required.
- `startedAt` is required.
- `ageStage` is required.
- `careScore` and `careMistakes` are required.
- `adultOutcome` is required and may be `null`.
- `adultMilestone` is required and may be `null`.
- `adultMilestoneProgress` is required.
- `adultMilestoneCompletedAt` is required and may be `null`.

## SettingsDTO Rules

- `version` is required.
- `alwaysOnTop` is required.
- `notificationsEnabled` is required.

## Offline Catch-Up

- Offline catch-up is required.
- On load:
  - Rust reads `pet.json`
  - frontend receives `PetStateDTO`
  - TypeScript simulation computes elapsed time from `lastUpdatedAt`
  - TypeScript applies catch-up before the state becomes active UI state
- After catch-up, the updated `PetStateDTO` may be written back through Rust persistence.

## Versioning Strategy

- Start at `version: 1`.
- Keep version numbers in saved JSON, not in separate metadata files.
- Prefer additive changes over breaking changes.
- If a field changes meaning or type, bump the version and add an explicit migration.

## Migration Expectations

- Never break old saves.
- Add fields with safe defaults.
- Document schema changes.
- Prefer backward-compatible additions.
- Keep migrations explicit and testable.
- Rust owns save-file migration before data is returned to the frontend.

## Example `pet.json`

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

## Example `settings.json`

```json
{
  "version": 1,
  "alwaysOnTop": false,
  "notificationsEnabled": true
}
```

## Persistence Rules

- Rust owns disk I/O.
- Frontend never writes files directly.
- Writes should be atomic where practical.
- Frontend must not choose save paths.
- Save files must remain plain JSON.
- Rust should validate decoded save data before returning it across IPC.

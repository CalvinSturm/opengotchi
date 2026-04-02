# OpenGotchi

Desktop Tamagotchi-style pet game built with:

- React + TypeScript + Vite frontend
- Zustand state store
- Zod DTO validation
- Pure TypeScript simulation
- Tauri 2 desktop shell
- Rust persistence, tray, notification, and window services

## Current Scope

Implemented now:

- Device-only UI: amber Tamagotchi shell centered on a dark background with LCD overlay and three-button `A / B / C` controls
- Egg -> alive -> dead lifecycle
- Hatch flow with pre-run naming
- Feed, play, clean, heal, sleep, and restart actions
- Adult outcomes and one adult milestone per outcome
- Minute-based decay with offline catch-up and aligned wake scheduling
- Desktop-owned reminder cooldown and repeat scheduling
- LCD save status indicator (`SAVE` / `UNSVD` / `OK`)
- Serialized pet-store mutations to avoid refresh/action races
- Save-status event matching via per-save operation IDs
- Frontend listeners for tray and save-status events
- Dev-only runtime tuning panel behind backtick and build gating
- Rust pet/settings persistence with atomic writes
- Legacy read compatibility for the previous `pet-save.json` envelope format
- Integration tests for stores, reminder sync, device UI helpers, and desktop event wiring

## Stack

- Tauri 2
- React 18
- TypeScript
- Vite
- Zustand
- Zod
- Rust

## Architecture

- Frontend UI lives in `src/app` and `src/features/pet/components`
- Frontend state coordination lives in `src/features/pet/store`
- Gameplay simulation lives in `src/features/pet/simulation`
- Settings state lives in `src/features/settings`
- System integration (desktop events, reminder sync) lives in `src/features/system`
- Root `assets/` holds shell/background art consumed by the frontend
- Frontend Tauri wrappers live in `src/lib/tauri`
- Thin Rust commands live in `src-tauri/src/commands`
- Rust services live in `src-tauri/src/services`
- Rust DTO/save models live in `src-tauri/src/models`

Key rules:

- Simulation stays in TypeScript
- React components do not contain gameplay rules
- Rust command handlers stay thin
- Frontend never touches the filesystem directly

More detail:

- [docs/architecture.md](/C:/Users/Calvin/opengotchi/docs/architecture.md)
- [docs/ipc-contract.md](/C:/Users/Calvin/opengotchi/docs/ipc-contract.md)
- [docs/save-schema.md](/C:/Users/Calvin/opengotchi/docs/save-schema.md)

## Pet DTO

Current pet persistence shape:

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
```

- `lifeState` gates nursery, active run, and game-over flow
- `lastUpdatedAt` is an ISO timestamp
- `startedAt` anchors age progression
- no-save startup begins at `lifeState: 'egg'`
- stat values are clamped to `0..100`
- load path applies offline catch-up in TypeScript before the state becomes active

## Runtime Save Semantics

- Pet mutations are serialized through the Zustand store rather than running concurrently.
- The frontend updates in-memory pet state first, then persists through Rust.
- Save attempts carry an operation ID so async completion and failure events can be matched to the correct mutation.
- If a save fails, the current pet stays live in memory and is marked `unsaved`.
- A later refresh or mutation retries persistence automatically.

## Next Steps

Current implementation priorities:

1. Expand post-adult content beyond a single milestone per adult outcome.
2. Decide whether reminder cooldown state should persist across full app restarts.
3. Replace text LCD menu labels with icon-faithful pixel menu art.
4. Add higher-level rendering tests around the device shell and overlay alignment.

## Project Layout

```text
.
|-- assets/
|-- docs/
|-- src/
|   |-- app/
|   |-- features/
|   |   |-- pet/
|   |   |   |-- components/
|   |   |   |-- simulation/
|   |   |   `-- store/
|   |   |-- settings/
|   |   |   `-- store/
|   |   `-- system/
|   |       `-- components/
|   `-- lib/
|       `-- tauri/
`-- src-tauri/
    |-- capabilities/
    `-- src/
        |-- commands/
        |-- models/
        `-- services/
```

## Scripts

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Run the Tauri app in development:

```bash
npm run tauri -- dev
```

Windows launcher:

```bat
start-opengotchi.bat
```

Build the desktop app:

```bash
npm run tauri -- build
```

Check the Rust side only:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Persistence Notes

- Rust writes pet data to the Tauri app data directory
- Current target file name is `pet.json`
- Current settings file name is `settings.json`
- The Rust load path can still read the previous `pet-save.json` envelope format
- Frontend persistence goes only through `invoke()`
- Pet and settings writes use atomic replace semantics with temp/backup files

## Verification

Verified in the current repo state with:

- `npm test`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

# OpenGotchi

Minimal Tauri 2 desktop pet bootstrap with:

- React + TypeScript + Vite frontend
- Zustand state store
- Zod DTO validation
- Pure TypeScript pet simulation
- Rust backend limited to persistence and desktop integration boundaries

## Current Scope

Implemented now:

- Pet status UI
- Feed, play, clean, and sleep actions
- Frontend listeners for tray and save-status events
- Minimal settings/system UI
- Pure simulation functions in `src/features/pet/simulation`
- Tauri command roundtrip for:
  - `load_pet`
  - `save_pet`
- Pet persistence in Rust
- Settings persistence in Rust
- Window/system commands for:
  - show/hide main window
  - always-on-top toggle
  - reveal save folder
  - quit app
- Desktop notification command
- Tray event emission for:
  - `tray://open-main-window`
  - `tray://feed-shortcut`
  - `tray://play-shortcut`
- Save status event emission for:
  - `pet://save-completed`
  - `pet://save-failed`
- Versioned pet DTO with offline catch-up
- Legacy read compatibility for the previous `pet-save.json` envelope format

Scaffolded but still minimal:

- Tray service
- Notification service
- Window service
- Architecture and IPC docs

Not implemented yet:

- Tray-driven frontend polish beyond the current listeners

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
  isSleeping: boolean;
  lastUpdatedAt: string;
};
```

- `lastUpdatedAt` is an ISO timestamp
- stat values are clamped to `0..100`
- load path applies offline catch-up in TypeScript before the state becomes active

## Project Layout

```text
.
|-- docs/
|-- src/
|   |-- app/
|   |-- features/
|   |   `-- pet/
|   |       |-- components/
|   |       |-- simulation/
|   |       `-- store/
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
- The Rust load path can still read the previous `pet-save.json` envelope format
- Frontend persistence goes only through `invoke()`

## Verification

Verified in the current repo state with:

- `npm test`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

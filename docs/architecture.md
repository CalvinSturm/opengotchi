# Architecture

## System Overview

- Desktop shell: Tauri 2.
- Frontend: React + TypeScript + Vite inside the WebView.
- Frontend state: Zustand.
- Simulation: pure TypeScript under `src/features/pet/simulation`.
- Backend: Rust under `src-tauri/src`.

## Trust Boundary

- Frontend/WebView is untrusted.
- Rust backend is trusted.
- All frontend input crossing IPC must be treated as untrusted and validated.
- Disk access, tray integration, notifications, and window/system integration stay on the Rust side.

## Responsibilities

- React:
  - render UI
  - handle local view state
  - dispatch user intent
- TypeScript:
  - own pet simulation logic
  - derive next `PetState`
  - run offline catch-up after loading persisted state
- Rust:
  - own persistence
  - own tray integration
  - own notifications
  - own window/system integration
  - keep command handlers thin and delegate work to `src-tauri/src/services`

## Data Flow

1. User clicks a UI control.
2. Frontend store passes the action to pure TypeScript simulation code.
3. Simulation returns the next `PetState`.
4. Zustand updates the in-memory state.
5. If persistence or system integration is needed, the frontend calls a narrow Rust command with `invoke()`.
6. Rust performs the side effect and returns a JSON-serializable result or error.
7. Rust may emit one-way Tauri events back to the frontend for tray or save-status notifications.

## IPC Model

- Commands:
  - request/response
  - frontend calls Rust with `invoke()`
  - use for persistence and system actions
- Events:
  - one-way messages
  - Rust emits to the frontend
  - use for tray actions and async status signals

## Key Invariants

- `PetState` is the single source of truth for current pet gameplay state.
- Simulation remains pure TypeScript.
- React components do not contain core gameplay rules.
- Rust command handlers stay thin.
- Frontend does not touch the filesystem directly.
- All IPC payloads are JSON-serializable.

## Directory Ownership Map

- `src/app`
  - app shell and shared styling
- `src/features/pet/components`
  - pet UI only
- `src/features/pet/store`
  - Zustand state coordination
- `src/features/pet/simulation`
  - pure gameplay rules
- `src/features/pet/model.ts`
  - frontend pet DTO/model definitions
- `src/lib/tauri`
  - frontend IPC wrappers around `invoke()`
- `src-tauri/src/commands`
  - thin Tauri command handlers
- `src-tauri/src/services`
  - backend business logic for persistence, tray, notifications, and window/system integration
- `src-tauri/src/models`
  - backend DTO/save model definitions
- `src-tauri/capabilities`
  - Tauri capability files

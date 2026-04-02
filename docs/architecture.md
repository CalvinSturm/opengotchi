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
  - build reminder sync payloads for the desktop layer
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
4. Zustand queues pet mutations so refreshes and player actions do not race each other.
5. Zustand updates the in-memory state.
6. If persistence or system integration is needed, the frontend calls a narrow Rust command with `invoke()`.
7. Rust performs the side effect and returns a JSON-serializable result or error.
8. Rust may emit one-way Tauri events back to the frontend for tray or save-status notifications.

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
- Pet-store mutations are serialized through the frontend store.
- Save completion and failure events are correlated by operation ID.
- Save failures do not silently roll back the live pet; they leave the current state marked unsaved.
- Reminder scheduling policy stays on the Rust side, but reminder derivation stays on the TypeScript side.
- Dev tuning UI is a frontend-only tool and is gated behind build-time configuration.

## Directory Ownership Map

- `src/app`
  - app shell and shared styling
- `src/features/pet/components`
  - device UI: LCD screen, pixel sprites, three-button controls
- `src/features/pet/store`
  - Zustand state coordination for pet mutations and save tracking
- `src/features/pet/simulation`
  - pure gameplay rules (decay, actions, alerts, outcomes, milestones)
- `src/features/pet/model.ts`
  - frontend pet DTO/model definitions
- `src/features/settings`
  - settings state store (always-on-top, notifications)
- `src/features/system`
  - desktop event wiring, reminder sync, dev tools, system panel
- `src/lib/tauri`
  - frontend IPC wrappers around `invoke()`
- `assets`
  - shell/background artwork used by the frontend device UI
- `src-tauri/src/commands`
  - thin Tauri command handlers
- `src-tauri/src/services`
  - backend business logic for persistence, tray, notifications, and window/system integration
- `src-tauri/src/models`
  - backend DTO/save model definitions
- `src-tauri/capabilities`
  - Tauri capability files

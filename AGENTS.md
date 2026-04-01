# OpenGotchi Agent Notes

This repository is a narrow bootstrap for a desktop Tamagotchi-like app.

## Stack

- Tauri 2 for the desktop shell and IPC.
- React + TypeScript + Vite for the frontend.
- Zustand for frontend state.
- Zod for frontend save-shape validation.
- Rust only for persistence, window setup, tray setup, and notifications boundaries.

## Architecture Rules

- Keep gameplay simulation pure and in TypeScript under `src/features/pet/simulation`.
- Keep Rust command handlers thin. Put Rust business logic in `src-tauri/src/services`.
- Do not move gameplay simulation into Rust.
- Do not add direct filesystem access in the frontend.
- Keep save payloads versioned.
- Prefer explicit names, small modules, and small functions.
- Avoid broad abstractions and extra libraries.

## Bootstrap Layout

- `docs/architecture.md`: architecture boundaries and invariants.
- `src/app`: app shell and styling.
- `src/features/pet`: pet model, simulation, state store, and UI.
- `src/lib/tauri`: Tauri IPC wrappers.
- `src-tauri/src/commands`: thin command handlers.
- `src-tauri/src/services`: Rust-side persistence and desktop-only services.
- `src-tauri/src/models`: Rust-side save models.

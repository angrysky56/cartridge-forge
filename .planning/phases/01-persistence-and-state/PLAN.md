# Phase 1: Persistence & State Management

## Goal
Establish a robust foundation for saving and loading complex game states, and introduce a testing framework (Vitest) to ensure engine stability via TDD.

## Tasks

### 1. Infrastructure: Testing Setup
- [x] Install `vitest`.
- [x] Configure `vitest` in `package.json`.
- [x] Create basic smoke tests for the ECS World.

### 2. Engine: Persistence Markers
- [x] Update `Component` schema/types to include an optional `persistent: boolean` flag.
- [x] Update `World` to track which components need serialization.

### 3. Service: Save/Load System
- [x] Implement `SaveService` for serializing the current World state to JSON.
- [x] Implement `LoadService` for restoring a World from JSON.
- [x] Handle entity ID remapping if necessary.

### 4. Verification
- [x] Write TDD tests for saving/loading a complex entity (e.g., a player with inventory).
- [x] Manual verification via CLI.

## Success Criteria
- `npm test` runs and passes.
- A game state can be saved to LocalStorage and reloaded identically.
- Entities without `persistent` flags are correctly excluded from saves.

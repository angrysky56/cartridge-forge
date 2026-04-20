# Phase 1: Persistence & State Management

## Goal
Establish a robust foundation for saving and loading complex game states, and introduce a testing framework (Vitest) to ensure engine stability via TDD.

## Tasks

### 1. Infrastructure: Testing Setup
- [ ] Install `vitest`.
- [ ] Configure `vitest` in `package.json`.
- [ ] Create basic smoke tests for the ECS World.

### 2. Engine: Persistence Markers
- [ ] Update `Component` schema/types to include an optional `persistent: boolean` flag.
- [ ] Update `World` to track which components need serialization.

### 3. Service: Save/Load System
- [ ] Implement `SaveService` for serializing the current World state to JSON.
- [ ] Implement `LoadService` for restoring a World from JSON.
- [ ] Handle entity ID remapping if necessary.

### 4. Verification
- [ ] Write TDD tests for saving/loading a complex entity (e.g., a player with inventory).
- [ ] Manual verification via CLI.

## Success Criteria
- `npm test` runs and passes.
- A game state can be saved to LocalStorage and reloaded identically.
- Entities without `persistent` flags are correctly excluded from saves.

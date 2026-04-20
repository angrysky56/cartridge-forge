# Cartridge Forge

## What This Is

An AI-driven game engine and generator that enables the creation of complex, cross-genre games using a declarative DSL. It leverages specialized AI agents to "forge" cartridges (game definitions) from simple user prompts, aiming to match the depth and variety of the Commodore 64's greatest hits.

## Core Value

Empower anyone to generate and play deep, complex, and genre-defying retro games through AI-coordinated orchestration.

## Requirements

### Validated

- ✓ **Core ECS Architecture** — entities, components, and world management (`src/ecs/`)
- ✓ **DSL Logic Engine** — expression evaluation and effect execution (`src/dsl/`)
- ✓ **Procedural Map Generation** — Cellular Automata, BSP, and Drunkard's Walk (`src/runtime/mapgen.ts`)
- ✓ **Cartridge Validation** — Zod-based schema verification (`src/cartridge/schema.ts`)
- ✓ **2D Grid Renderer** — Canvas-based visual output (`src/renderer/canvas.ts`)

### Active

- [ ] **Agent-First Authoring Pipeline** — specialized agents forge cartridges from natural language prompts.
- [ ] **State Persistence System** — standardized save/load and entity persistence across sessions.
- [ ] **Real-Time Action (RTA) Support** — support for Archon/Elite style real-time interaction using keyboard controls.
- [ ] **Multi-Mode Rendering** — support for Pseudo-3D (Bard's Tale), Wireframe (Elite), and Narrative/Text (Zork) modes.
- [ ] **Advanced DSL Expansion** — deep systems for genetics (Mail Order Monsters), complex inventories (Wizardry), and chained events.

### Out of Scope

- **Non-Keyboard Controls for RTA** — focusing on keyboard-only for initial implementation.
- **High-Fidelity 3D** — strictly targeting C64-era visual aesthetics and complexity.
- **Modern Multiplayer Networking** — focusing on the single-player/local-play experience typical of the C64 era.

## Context

- **Environment**: Modern web stack (Vite + TypeScript) targeting a nostalgic retro-gaming experience.
- **Prior Art**: Inspired by C64 classics like *Elite*, *Zork*, *Mail Order Monsters*, *Wizardry*, *The Bard's Tale*, and *Archon*.
- **Codebase State**: Currently a robust "stub" with working ECS and turn-based grid logic, ready for expansion into more complex interaction models.

## Constraints

- **Tech Stack**: TypeScript / Vite / Canvas — must maintain lightweight, web-native performance.
- **Input**: Keyboard-only for the foreseeable future for both turn-based and RTA modes.
- **Persistence**: Must be local-first (LocalStorage or File System API) for consistency with the "Cartridge" metaphor.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Declarative DSL** | Allows AI agents to easily generate and validate game logic without writing raw code. | ✓ Good |
| **Keyboard-Only RTA** | Simplifies initial real-time implementation while remaining faithful to the C64 experience. | — Pending |
| **Agent-Authored Logic** | Moves the complexity of game design from the user to a specialized "forge" of AI agents. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after initialization*

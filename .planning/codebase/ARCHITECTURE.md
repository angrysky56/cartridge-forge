# System Architecture

**Analysis Date:** 2026-04-20

## Architectural Pattern

The project follows a **Data-Driven Entity Component System (ECS)** architecture with a **Declarative DSL** layer for game logic.

- **Data (ECS)**: Entities are simple IDs, components are pure data bags. No logic lives in the entities.
- **Logic (DSL)**: Game rules are defined in JSON "cartridges" using a Domain Specific Language. The runtime interprets these rules rather than hard-coding game mechanics.
- **Rendering**: Decoupled from logic, observing the ECS state to draw to the screen.

## Core Layers

### 1. ECS Core (`src/ecs/`)
- **World**: The central hub for managing entities, components, and blueprints.
- **Blueprints**: Templates for creating complex entities (e.g., "goblin", "player_knight").
- **Tags**: Temporal markers used for status effects (e.g., "stunned").

### 2. DSL Engine (`src/dsl/`)
- **Evaluator**: Parses and evaluates mathematical and logical expressions from the cartridge using `expr-eval`.
- **Executor**: Applies state mutations (Effects) to the ECS World based on system triggers.

### 3. Game Runtime (`src/runtime/`)
- **Game Loop**: Manages turn-based execution and state transitions.
- **Map Generation**: Implements algorithms like Cellular Automata and BSP to build the world grid.

### 4. Cartridge System (`src/cartridge/`)
- **Schema**: Zod-based validation of cartridge JSON files.
- **Loader**: Handles fetching and parsing cartridges into the ECS World.

### 5. Renderer (`src/renderer/`)
- **Canvas Renderer**: Translates the ECS `Position` and `Renderable` components into 2D canvas drawings.

## Data Flow

1. **Initialization**: `main.ts` calls `Loader` to fetch a cartridge.
2. **Schema Validation**: `Loader` uses `CartridgeSchema` (Zod) to verify integrity.
3. **World Setup**: `World` registers blueprints and spawns the initial map.
4. **Action Loop**:
   - User/AI emits an event (e.g., `ACTION_MOVE`).
   - `Executor` finds all `systems` listening for that event.
   - `Evaluator` checks `requires` conditions.
   - `Executor` applies `effects` (mutates world, spawns entities, logs messages).
5. **Render Loop**: `Renderer` queries `World` for all `Renderable` entities and draws them.

---

*Architecture analysis: 2026-04-20*
*Update when core patterns or system boundaries change*

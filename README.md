# Cartridge Forge

AI-driven turn-based game generator using ECS architecture and a declarative DSL.

## Architecture

```
User describes game
        ↓
   Forgemaster Agent coordinates specialized skills (Map, Mechanics, Lore)
        ↓
   AI generates Cartridge JSON (ECS data + expression rules)
        ↓
   Zod schema validation (catch errors before runtime)
        ↓
   Browser runtime loads cartridge → playable game
        ↓
   User feedback → AI patches cartridge → hot-reload
```

## Core Features

- **Virtual Console Runtime**: A robust TypeScript engine that executes games defined entirely by JSON "cartridges".
- **Declarative DSL**: A safe, math-driven logic language that allows AI to define complex game rules without writing code.
- **Agent Skill Pipeline**: A specialized multi-agent workflow for generating high-quality games:
  - **Map Architect**: Procedural world generation expert.
  - **Mechanics Designer**: Systems and balance specialist.
  - **Lore Weaver**: Narrative and aesthetic designer.
- **Advanced RPG Systems**: Built-in support for genetics (breeding/inheritance), inventory management, and equipment modifiers.
- **Multi-Mode Rendering**: Support for 2D Grid, Wireframe 3D, and Pseudo-3D (C64 style).

## Core Concepts

### The "Cartridge" (AI Output)
A JSON file conforming to a strict Zod schema. Contains:
- **Components**: Pure data bag type definitions.
- **Blueprints**: Entity templates (component bundles with values).
- **Systems**: Declarative rules using a constrained expression DSL.
- **World Gen**: Procedural map generation configuration.
- **Traits**: Genetic inheritance weighting for the breeding system.

### The Expression DSL
A constrained language for game logic that AI can generate reliably:
- Math expressions: `"max(1, attacker.CombatStats.strength - target.CombatStats.armor)"`
- Built-in functions: `distance()`, `roll()`, `has_tag()`, `has_component()`, `max()`, `min()`
- Safe evaluation via `expr-eval` (no eval(), no arbitrary code)

### Effect Types (exhaustive list)
| Type | Description |
|------|-------------|
| `MUTATE` | Change a component value (ADD/SUBTRACT/SET/MULTIPLY) |
| `DESTROY_ENTITY` | Remove an entity |
| `SPAWN_ENTITY` | Create entity from blueprint |
| `APPLY_TAG` | Add a temporary tag (e.g., "stunned") |
| `REMOVE_TAG` | Remove a tag |
| `LOG_MESSAGE` | Push to combat log (template strings) |
| `EMIT_EVENT` | Chain events (with loop protection) |
| `BREED_ENTITY` | Create a hybrid offspring from two parents |
| `EQUIP_ITEM` | Attach an item and apply its modifiers |
| `UNEQUIP_ITEM` | Remove an item and strip its modifiers |

## Getting Started

### Installation
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the dev server
npm run dev
```

### Validation
```bash
# Validate a cartridge file
npx tsx src/cartridge/cli-validate.ts my_game.json
```

### Forging
```bash
# Merge cartridge fragments
npx tsx src/cartridge/cli-forge.ts -o game.json part1.json part2.json
```

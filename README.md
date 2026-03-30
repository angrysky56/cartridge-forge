# Cartridge Forge

ROUGH DRAFT - INCOMPLETE - NOT READY FOR USE- UNTESTED!!!!

AI-driven turn-based game generator using ECS architecture and a declarative DSL.

## Architecture

```
User describes game
        ↓
   AI generates Cartridge JSON (ECS data + expression rules)
        ↓
   Zod schema validation (catch errors before runtime)
        ↓
   Browser runtime loads cartridge → playable game
        ↓
   User feedback → AI patches cartridge → hot-reload
```

## Core Concepts

### The "Virtual Console" (Runtime)
A browser-based TypeScript engine that handles rendering, turn management,
event processing, and map generation. It never changes — games are defined
entirely by cartridges.

### The "Cartridge" (AI Output)
A JSON file conforming to a strict Zod schema. Contains:
- **Components**: Pure data bag type definitions
- **Blueprints**: Entity templates (component bundles with values)
- **Systems**: Declarative rules using a constrained expression DSL
- **World Gen**: Procedural map generation configuration

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

## Project Structure
```
src/
  ecs/          # Entity-Component-System core (World, types)
  cartridge/    # Zod schema, loader, validation
  dsl/          # Expression evaluator + system executor
  runtime/      # Game loop, map generation
  renderer/     # Canvas-based glyph renderer
cartridges/     # Source cartridge JSON files
public/         # Vite static assets (served cartridges)
```

## Quick Start
```bash
npm install
npm run dev
# Browser opens → demo cartridge auto-loads
# Arrow keys / hjkl to move, bump to attack
```

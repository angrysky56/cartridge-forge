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

## Gameplay & Virtual Arcade Controls

The console features a retro-futuristic Cyber-Console Virtual Arcade with mouse, keyboard, and on-screen tactile inputs:

| Action | Controls | Description |
|---|---|---|
| **Movement** | `W`/`A`/`S`/`D` or Arrow Keys | Move pilot / hero in 4 cardinal directions |
| **Wait Turn** | `Spacebar`, `.`, or `5` | Rest for 1 turn (allows enemies / status effects to tick) |
| **Mouse Control** | Left Click on Canvas | Click adjacent tile to move/attack, click self to wait |
| **Phase Dash** | `[1]` Hotkey or Hotbar | Jump 2 tiles forward over enemies/hazards (6t CD) |
| **Shield Bash** | `[2]` Hotkey or Hotbar | Physical slam knocking enemy back 1 tile + 1-turn stun (4t CD) |
| **Fireball** | `[3]` Hotkey or Hotbar | 3x3 explosive AoE dealing 35+ damage (5t CD) |
| **Lightning Beam**| `[4]` Hotkey or Hotbar | 5-tile piercing laser through lined-up enemies (4t CD) |
| **Frost Nova** | `[5]` Hotkey or Hotbar | Radius 2 freezing blast immobilizing all surrounding foes (6t CD) |
| **Health Potion**| `[Q]` Hotkey or Hotbar | Instantly restores 35 HP |
| **Speed Potion** | `[E]` Hotkey or Hotbar | Grants +50% relative movement speed for 15 turns |
| **Backpack** | `[I]` Hotkey or Hotbar | Opens full inventory modal to manage 5 equipment slots & consumables |
| **CRT Filter** | `📺 CRT` Header Button | Toggles retro CRT scanlines and phosphor glow |
| **FOV Toggle** | `🔦 FOV` Header Button | Toggles tactical Line-of-Sight fog of war |

## RPG Progression & Tactical Systems

- **5 Additive Equipment Slots**: Weapon, Offhand, Armor, Helm, and Ring slots accumulate stats additively.
- **Set Bonuses**: Equip multiple pieces of `Ironclad`, `Shadow`, or `Archmage` sets to unlock powerful tiered set bonuses and visual auras.
- **Relative Movement Speed**: Action-energy clock system where fast enemies (goblins) act more frequently and heavy enemies (orcs) can be kited.
- **Tactical Weapon Variety**: Reach weapons (Iron Spear) strike 2 tiles away without retaliation; Ranged weapons (Composite Bow) shoot up to 6 tiles.
- **Dungeon Economy & Loot**: Slain enemies drop gold coins (`$`) and loot; manage gold in your HUD wallet.
- **Every 3rd Floor (B3, B6...)**: Handcrafted safe **Ante-Room** with **Grimm the Peddler (`$`)** shop and Sanctuary of Life, followed by grand pillared **Boss Arenas** (Minotaur Crypt Lord, Lich King) with overhead boss health bars.
- **Swarm Detection**: Goblin Horn Scouts (`H`) sound 3-turn countdown war horns that summon ambush swarms unless defeated swiftly.


### Testing
```bash
# Run unit test suite
npm test

# Run tests in watch mode
npm run test:watch
```

### Validation
```bash
# Validate a cartridge file
npm run validate my_game.json
```

### Forging
```bash
# Merge cartridge fragments
npx tsx src/cartridge/cli-forge.ts -o game.json part1.json part2.json
```

## Documentation & Roadmap

- **[DSL Reference](docs/DSL_REFERENCE.md)**: Cartridge schema, component types, and expression language.
- **[Forge Pipeline](docs/FORGE_PIPELINE.md)**: Multi-agent orchestration, specialized skills, and authoring workflow.
- **[Development Roadmap](ROADMAP.md)**: Milestones, completed phases, and upcoming features.

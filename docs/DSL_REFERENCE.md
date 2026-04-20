# Cartridge Forge — DSL & Schema Reference

This document defines the complete specification for Cartridge JSON files.
An AI generating a cartridge MUST conform to this schema exactly.

## Top-Level Structure

```json
{
  "meta": { ... },
  "components": { ... },
  "blueprints": { ... },
  "systems": { ... },
  "world_gen": { ... },
  "events": [ ... ],
  "traits": { ... }  // optional
}
```

---

## 1. `meta` — Cartridge Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Game title |
| `version` | string | no | Semantic version |
| `description` | string | no | Shown on game start |
| `palette` | object | no | Named color overrides (see Renderer) |
| `renderer_mode` | string | no | `GRID_2D` (default), `WIREFRAME_3D`, `CELL_PSEUDO_3D` |

---

## 2. `components` — Data Shape Definitions

Components are pure data bags. Each key is a component name, value is a map
of field names to type descriptors.

**Allowed types:** `"number"`, `"string"`, `"boolean"`, `"array<EntityID>"`

```json
"components": {
  "Position": { "x": "number", "y": "number" },
  "Health": { "current": "number", "max": "number" },
  "Renderable": { "glyph": "string", "color": "string", "layer": "number" },
  "Faction": { "id": "string" },
  "Inventory": { "equipped": "record<string, EntityID>" }
}
```

---

## 3. `blueprints` — Entity Templates

Each key is a blueprint name. Value is a map of component names to
initialized field values. All referenced components MUST exist in `components`.

```json
"blueprints": {
  "player_knight": {
    "Position": { "x": 0, "y": 0 },
    "Health": { "current": 80, "max": 80 },
    "CombatStats": { "strength": 12, "armor": 6, "evasion": 5 },
    "Renderable": { "glyph": "@", "color": "#ffcc00", "layer": 5 },
    "Faction": { "id": "player" }
  }
}
```

---

## 4. `systems` — Declarative Game Rules (DSL)

Systems listen for events, check conditions, and apply effects.

```json
"system_name": {
  "listens_for": "EVENT_NAME",
  "context": { "varName": "source" | "target" },
  "requires": [ "condition_expression", ... ],
  "priority": 10,
  "effects": [ ... ],
  "post_checks": [ { "if": "expr", "then": [ ...effects ] } ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `listens_for` | string | yes | Event name to trigger on |
| `context` | object | no | Bind event entities to variable names |
| `requires` | string[] | no | All must be true for effects to fire |
| `priority` | number | no | Lower runs first (default: 100) |
| `effects` | Effect[] | yes | Sequential state mutations |
| `post_checks` | Conditional[] | no | Evaluated after all effects |

### Built-in Events
| Event | Source | Target | When |
|-------|--------|--------|------|
| `ACTION_MOVE` | moving entity | — | After movement |
| `ACTION_ATTACK` | attacker | defender | Bump attack |
| `TURN_START` | entity | — | Before each entity acts |
| `TURN_END` | player | — | After all entities act |

---

## 5. Expression Language

Expressions reference entity data via dot-paths: `varName.ComponentName.field`

**Built-in Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `distance(a.Position, b.Position)` | → number | Manhattan distance |
| `roll("NdS+M")` | → number | Dice roll (e.g., `"2d6+4"`) |
| `max(a, b)` | → number | Maximum |
| `min(a, b)` | → number | Minimum |
| `abs(n)` | → number | Absolute value |
| `has_tag('var', 'tag')` | → boolean | Check entity tag |
| `has_component('var', 'Comp')` | → boolean | Check component |

---

## 6. Effect Types (Exhaustive)

### MUTATE — Change a component value
```json
{ "type": "MUTATE", "target": "target.Health.current", "operation": "SUBTRACT", "value": "max(1, attacker.CombatStats.strength - target.CombatStats.armor)" }
```
Operations: `ADD`, `SUBTRACT`, `SET`, `MULTIPLY`

### DESTROY_ENTITY — Remove an entity
```json
{ "type": "DESTROY_ENTITY", "target": "target" }
```

### SPAWN_ENTITY — Create from blueprint
```json
{ "type": "SPAWN_ENTITY", "blueprint": "corpse", "at": "target.Position" }
```

### APPLY_TAG — Add a tag to an entity
```json
{ "type": "APPLY_TAG", "target": "target", "tag": "stunned", "duration": 2 }
```

### REMOVE_TAG — Remove a tag
```json
{ "type": "REMOVE_TAG", "target": "target", "tag": "stunned" }
```

### LOG_MESSAGE — Print to combat log
```json
{ "type": "LOG_MESSAGE", "message": "{attacker.Description.name} strikes for {value} damage!" }
```

### EMIT_EVENT — Chain another event
```json
{ "type": "EMIT_EVENT", "event": "ON_KILL", "source": "attacker", "target": "target" }
```

### BREED_ENTITY — Create a hybrid offspring (RPG Genetics)
```json
{ "type": "BREED_ENTITY", "parentA": "p1", "parentB": "p2", "blueprint": "egg", "at": "p1.Position" }
```
Requires the `traits` section to be defined in the cartridge.

### EQUIP_ITEM — Equip an entity to another
```json
{ "type": "EQUIP_ITEM", "target": "player", "item": "sword", "slot": "weapon" }
```
Automatically updates stat modifiers if the item has a `Modifiers` component.

### UNEQUIP_ITEM — Remove an item from a slot
```json
{ "type": "UNEQUIP_ITEM", "target": "player", "slot": "weapon" }
```

---

## 7. `traits` — Genetic Inheritance

Defines how numerical stats are weighted during `BREED_ENTITY`.

```json
"traits": {
  "Strength": { "aggression": 1.2, "longevity": 0.8 },
  "Agility": { "aggression": 0.9, "longevity": 1.1 }
}
```

---

## 8. `world_gen` — Map Generation

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `width` | integer | yes | — |
| `height` | integer | yes | — |
| `algorithm` | enum | yes | — |
| `params` | object | no | Algorithm-specific settings |
| `spawn_table` | array | no | Enemy/item spawning |

### Algorithms
- `cellular_automata` — Organic cave systems
- `bsp_rooms` — Classic dungeon rooms with corridors
- `drunkard_walk` — Winding tunnel networks
- `prefab` — Pre-defined static maps

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
  "events": [ ... ]  // optional
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

### Palette Keys
`floor`, `wall`, `wall_glyph`, `floor_glyph`, `bg`, `player`, `enemy`, `item`, `ui_text`

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
  "Faction": { "id": "string" }
}
```

**Required components for the runtime:**
- `Position` (x, y, direction) — needed for map placement and movement. `direction` is `"N"`, `"S"`, `"E"`, `"W"` for pseudo-3D.
- `Renderable` (glyph, color, layer, mesh) — needed for rendering. `mesh` is for `WIREFRAME_3D`.
- `Faction` (id) — `"player"` faction marks the player entity

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

**Rules:**
- The first blueprint with `Faction.id === "player"` becomes the player
- Position is overridden at spawn time by map generation
- Layer controls render order (higher = drawn on top)

---

## 4. `systems` — Declarative Game Rules (DSL)

Systems listen for events, check conditions, and apply effects.

```json
"system_name": {
  "listens_for": "EVENT_NAME",
  "context": { "varName": "event.source" | "event.target" },
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

### Context Bindings
- `"event.source"` — the entity that initiated the event
- `"event.target"` — the entity being acted upon

### Built-in Events
| Event | Source | Target | When |
|-------|--------|--------|------|
| `ACTION_MOVE` | moving entity | — | After movement |
| `ACTION_ATTACK` | attacker | defender | Bump attack |
| `TURN_START` | entity | — | Before each entity acts |
| `TURN_END` | player | — | After all entities act |

### Expression Language

Expressions are strings evaluated by a safe math parser. They can reference
entity data via dot-paths: `varName.ComponentName.field`

**Operators:** `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `and`, `or`, `not`

**Built-in Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `distance(a.Position, b.Position)` | → number | Manhattan distance |
| `roll("NdS+M")` | → number | Dice roll (e.g., `"2d6+4"`) |
| `max(a, b)` | → number | Maximum |
| `min(a, b)` | → number | Minimum |
| `abs(n)` | → number | Absolute value |
| `floor(n)` | → number | Floor |
| `ceil(n)` | → number | Ceiling |
| `has_tag('var', 'tag')` | → boolean | Check entity tag |
| `has_component('var', 'Comp')` | → boolean | Check component |

---

## 5. Effect Types (Exhaustive)

These are the ONLY effect types the runtime accepts.

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
The `blueprint` must exist in the cartridge's `blueprints` section.

### APPLY_TAG — Add a tag to an entity
```json
{ "type": "APPLY_TAG", "target": "target", "tag": "stunned", "duration": 2 }
```
`duration` is optional (turns until auto-removed). Omit for permanent.

### REMOVE_TAG — Remove a tag
```json
{ "type": "REMOVE_TAG", "target": "target", "tag": "stunned" }
```

### LOG_MESSAGE — Print to combat log
```json
{ "type": "LOG_MESSAGE", "message": "{attacker.Description.name} strikes for {value} damage!" }
```
Template variables: `{contextVar.Component.field}` are interpolated at runtime.

### EMIT_EVENT — Chain another event
```json
{ "type": "EMIT_EVENT", "event": "ON_KILL", "source": "attacker", "target": "target" }
```
Loop protection: max 50 chained events per turn.

---

## 6. `world_gen` — Map Generation

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `width` | integer | yes | — |
| `height` | integer | yes | — |
| `algorithm` | enum | yes | — |
| `floor_glyph` | string | no | `"."` |
| `wall_glyph` | string | no | `"#"` |
| `wall_density` | float 0-1 | no | `0.4` |
| `room_min_size` | integer | no | (BSP only) |
| `room_max_size` | integer | no | (BSP only) |
| `spawn_table` | array | no | Enemy/item spawning |

### Algorithms
- `cellular_automata` — Organic cave systems
- `bsp_rooms` — Classic dungeon rooms with corridors
- `drunkard_walk` — Winding tunnel networks
- `prefab` — (future) Load from cartridge data

### Spawn Table Entry
```json
{ "blueprint": "goblin", "weight": 0.6, "max_per_level": 10 }
```
- `weight` (0-1): Probability of spawning each attempt
- `max_per_level`: Cap per generated map

---

## 7. Common Patterns

### Damage-Over-Time (Poison)
Apply a tag on attack, tick damage on TURN_END, auto-destroy on death.

### Healing Item Pickup
Listen for ACTION_MOVE, check `distance == 0` with item,
MUTATE health, DESTROY the item, LOG pickup message.

### Stunned Status
APPLY_TAG "stunned" with duration. The runtime's enemy AI
skips entities with the "stunned" tag automatically.

### Vampiric Drain
Listen for ACTION_ATTACK, require `has_component(attacker, 'Vampiric')`,
MUTATE attacker health with ADD operation using damage dealt.

# Cartridge Forge — Authoring Pipeline

The Forge Pipeline is a specialized multi-agent workflow designed to generate high-quality, valid, and playable game cartridges from high-level user prompts.

## 1. Orchestration Layer

The **Forgemaster** agent acts as the conductor. It decomposes a user request into three distinct domains and coordinates specialized skills to produce JSON fragments.

### Specialized Skills
- **Map Architect** (`.forge/skills/map-architect/`): Expert in procedural generation algorithms (`cellular_automata`, `bsp_rooms`, `drunkard_walk`). Defines world dimensions, density, and spawn tables.
- **Mechanics Designer** (`.forge/skills/mechanics-designer/`): Expert in the Cartridge Forge DSL. Defines components, blueprints (entities), and systems (logic rules).
- **Lore Weaver** (`.forge/skills/lore-weaver/`): Expert in aesthetics and narrative. Selects color palettes, renderer modes, and writes evocative descriptions and glyphs.

## 2. The Synthesis Loop

1.  **Deconstruction**: Forgemaster breaks the prompt into tasks.
2.  **Fragment Generation**:
    - **Lore Weaver** produces `lore.json` (Meta, Palette).
    - **Mechanics Designer** produces `mechanics.json` (Components, Blueprints, Systems).
    - **Map Architect** produces `world.json` (World Gen).
3.  **Synthesis**: The `Forge CLI` merges these fragments with the `base_rpg.json` template.
4.  **Validation**: `cli-validate` checks the final cartridge against the Zod schema.
5.  **Audit**: If validation fails, the Forgemaster identifies the faulty fragment and requests a regeneration.

## 3. Tooling

### Forge CLI (`src/cartridge/cli-forge.ts`)
A utility for deep-merging JSON fragments. It handles:
- **ID Coordination**: Merging record-based fields like `components` and `systems`.
- **List Appending**: Combining arrays like `events`.
- **Template Integration**: Allowing a "base game" template to be extended by new logic.

**Usage:**
```bash
npx tsx src/cartridge/cli-forge.ts -o final.json meta.json mechanics.json world.json
```

### Validation CLI (`src/cartridge/cli-validate.ts`)
The ultimate arbiter of quality. It ensures the cartridge is:
- **Structurally Sound**: Passes Zod schema validation.
- **Logically Consistent**: Blueprints reference existing components; systems reference existing blueprints.

**Usage:**
```bash
npx tsx src/cartridge/cli-validate.ts game.json
```

## 4. Design Guidelines for Agents

- **Modularity**: Components should be small and focused (e.g., `Health`, `CombatStats`, `Position`).
- **Safety**: Never use `eval()` or arbitrary JavaScript. Always stay within the DSL effect types.
- **Aesthetics**: Stick to the 16-color Commodore 64 palette for authentic retro feel.
- **Complexity**: For complex logic (e.g., "levelling up"), use a sequence of `MUTATE` effects and `post_checks`.

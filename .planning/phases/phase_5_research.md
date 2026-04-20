# Phase 5 Research: Cartridge Authoring Pipeline

## Objective
Implement the end-to-end "prompt-to-game" generation using the specialized agent skills and the `Forge CLI` tool.

## Current Infrastructure (from Phase 4)
- `.forge/skills/map-architect`
- `.forge/skills/mechanics-designer`
- `.forge/skills/lore-weaver`
- `.forge/agents/forgemaster.md`
- `src/cartridge/cli-forge.ts` (JSON fragment merging tool)
- `src/cartridge/cli-validate.ts` (Zod-based validator)

## Key Challenges
1.  **Iterative Refinement**: How does the Forgemaster handle feedback loops between agents? (e.g., Map Architect needs a component defined by Mechanics Designer).
2.  **Prompt Deconstruction**: Best practices for breaking a user prompt into domain-specific sub-prompts.
3.  **Fragment Consistency**: Ensuring unique IDs (blueprints, systems) match across fragments.
4.  **Error Recovery**: What happens if validation fails?

## Integration Strategy
- **Master Script**: Create a `src/forge/index.ts` (or similar) that acts as the programmatic entry point for the forge pipeline if needed, or simply rely on the Forgemaster agent instructions.
- **Workflow Steps**:
    1.  User Prompt -> Forgemaster.
    2.  Forgemaster -> Lore Weaver (Output: `meta.json`).
    3.  Forgemaster -> Mechanics Designer (Output: `mechanics.json`).
    4.  Forgemaster -> Map Architect (Output: `world.json`).
    5.  Forgemaster -> Forge CLI (Output: `cartridge.json`).
    6.  Forgemaster -> Validation CLI.

## Test Case: "Mail Order Monsters" Lite
- **Prompt**: "A tactical game where players breed mutant monsters and fight in a gladiatorial arena."
- **Expected**:
    - `meta`: Titles/Palette.
    - `mechanics`: BreedEntity, Mutate effects, Health/Armor components.
    - `world`: Arena map gen.

## Next Steps
- Create the implementation plan for Phase 5.

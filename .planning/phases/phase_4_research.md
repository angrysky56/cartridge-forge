# Phase 4 Research: Agent Skill Folders

## Objective
Establish a formal structure for specialized AI agents (the "Forge") to utilize modular "Skills" for generating game cartridges. This moves the project from a manual DSL engine to an automated game generation factory.

## Inspiration: Agentic Workflows
The structure should follow the "Agentic Skill" pattern used in modern AI orchestration:
- **Modular**: Skills are independent and focus on one domain (e.g., Map Gen vs. Combat Math).
- **Instruction-Dense**: Markdown-based instructions that a LLM can follow to produce specific parts of the `CartridgeSchema`.
- **Composable**: Multiple skills can be combined to form a complete game.

## Proposed Structure: `.forge/`
We should use a dedicated directory for these orchestration artifacts:
```
.forge/
├── skills/
│   ├── map-architect/
│   │   ├── SKILL.md        # Core instructions
│   │   ├── examples/       # Reference JSON snippets
│   │   └── templates/      # Base JSON structures
│   ├── mechanics-designer/
│   ├── lore-weaver/
│   └── visual-artist/      # Palette and Glyph design
├── agents/
│   ├── forgemaster.md      # The lead orchestrator instructions
│   └── validator.md        # Post-generation audit instructions
└── factory/
    ├── scripts/            # Helper scripts for the agents (e.g., JSON merging)
    └── logs/               # Audit trail of generations
```

## Skill Schema
Each `SKILL.md` should include:
1. **Persona**: The role the agent takes (e.g., "Expert Roguelike Map Designer").
2. **Input**: What context it needs (User prompt, existing components).
3. **Output**: The specific subset of `CartridgeSchema` it produces.
4. **Constraints**: C64-era limitations (color count, grid size).
5. **Techniques**: Algorithms to suggest (e.g., "Use CA for caves").

## Integration with the Pipeline
- **Phase 1**: Define the folder structure and first set of core skills.
- **Phase 2**: Create the `Forgemaster` prompt that knows how to reference these skills.
- **Phase 3**: Implement a "Forge CLI" or utility to help agents assemble the final JSON.

## Key Questions
- How do we handle dependencies between skills (e.g., `mechanics` needing specific `components`)?
- Should we use sub-agents (parallel) or a single agent switching context?
- How do we validate "Partial Cartridges" produced by skills?

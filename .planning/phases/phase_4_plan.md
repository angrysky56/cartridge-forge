# Phase 4 Plan: Agent Skill Folders

## Objective
Establish the ".forge" orchestration layer to enable AI agents to generate complex game cartridges using specialized skills.

## Tasks

### 1. Structure Initialization
- [ ] Create `.forge/skills/` directory.
- [ ] Create `.forge/agents/` directory.
- [ ] Create `.forge/templates/` directory for base JSON fragments.

### 2. Specialized Agent Skills
- [ ] **Skill: Map Architect** (`.forge/skills/map-architect/SKILL.md`)
  - Instructions for algorithmic selection (CA, BSP, Drunkard).
  - Guidelines for tile types and room connectivity.
- [ ] **Skill: Mechanics Designer** (`.forge/skills/mechanics-designer/SKILL.md`)
  - Instructions for creating components and systems.
  - Examples of combat, equipment, and genetics DSL logic.
- [ ] **Skill: Lore Weaver** (`.forge/skills/lore-weaver/SKILL.md`)
  - Narrative design and metadata generation (title, description).
  - Glyph and color palette selection.

### 3. Orchestration Layer
- [ ] **Agent: Forgemaster** (`.forge/agents/forgemaster.md`)
  - Instructions for coordinating the specialized skills.
  - Strategy for iterative generation (Lore → Mechanics → World).
- [ ] **Tool: Forge CLI** (`src/cartridge/cli-forge.ts`)
  - Utility to merge partial JSON fragments into a single valid cartridge.
  - Basic "scaffold" command to initialize a cartridge from a theme.

### 4. Integration & Testing
- [ ] Create a "Forge Prompt" template that uses these skills.
- [ ] Test the pipeline by "Forging" a simple "Wizardry-lite" cartridge using the skills.

## Verification
- [ ] Directory structure exists and contains all markdown skills.
- [ ] `cli-forge.ts` can successfully merge multiple JSON fragments.
- [ ] A forged cartridge passes `cli-validate.ts`.

# Phase 5 Implementation Plan: Cartridge Authoring Pipeline

## Goal
Establish the first end-to-end authoring loop where a high-level game idea is transformed into a playable cartridge using the agent skills.

## Tasks

### 1. Forgemaster Refinement
- Update `.forge/agents/forgemaster.md` with explicit error recovery and cross-agent dependency rules.
- Add "Synthesis" instructions for handling ID collisions.

### 2. Validation & Feedback Loop
- Implement a simple "Self-Audit" step in the Forgemaster persona.
- Ensure the agent knows how to interpret `cli-validate` error messages.

### 3. Template Library
- Create `.forge/templates/base_rpg.json` to give agents a starting point for common systems (Movement, Basic Combat).

### 4. Integration Test: The First Forge
- Use the Forgemaster persona to generate a complete "Mail Order Monsters" style cartridge.
- Use `cli-forge` to assemble it.
- Use `cli-validate` to confirm integrity.
- Load it into the web renderer to verify visual and logical correctness.

## Verification Criteria
- [ ] Forgemaster can successfully generate three valid JSON fragments based on a theme.
- [ ] `cli-forge` produces a single `cartridge.json` from these fragments.
- [ ] `cli-validate` returns "Valid cartridge".
- [ ] The generated game can be initialized in the `Game` runtime without errors.
- [ ] Visual artifacts (glyphs/palette) match the generated theme.

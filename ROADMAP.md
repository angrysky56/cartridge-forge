# Cartridge Forge: Development Roadmap

## Milestone 1: The Core Runtime (Completed)
*Foundation of the ECS and Cartridge System.*

- [x] **Phase 1: Basic Runtime & Rendering**
  - [x] ECS Engine (World, Entity, Component, System).
  - [x] WebGL Renderer with C64 color palette.
  - [x] Cartridge JSON Loader & Schema.
- [x] **Phase 2: Declarative DSL & Event System**
  - [x] Event-driven system execution.
  - [x] DSL for state mutations (MUTATE, SPAWN, etc.).
  - [x] Math expression evaluation for effects.
- [x] **Phase 3: DSL Evolution & RPG Mechanics**
  - [x] Genetics system for entity breeding (traits & mutation).
  - [x] Inventory & Equipment stat modifiers.
  - [x] Refactored `World.spawn` for dynamic configuration.

## Milestone 2: The Agent Forge (Orchestration)
*Turning AI into a game designer.*

- [x] **Phase 4: Agent Skill Folders**
  - [x] Initialized `.forge/` directory for Agent Skills.
  - [x] Authored specialized skills: `Map Architect`, `Mechanics Designer`, `Lore Weaver`.
  - [x] Implemented `Forgemaster` agent instructions.
  - [x] Developed `Forge CLI` for fragment merging and validation.
- [x] **Phase 5: Cartridge Authoring Pipeline**
  - [x] Implementation of end-to-end "prompt-to-game" generation.
  - [x] Iterative refinement logic (Agent-to-Agent feedback) in Forgemaster instructions.
- [ ] **Phase 6: Verification & Validation**
  - [ ] Automated playtesting agents.
  - [ ] Structural validation (Map connectivity, logic soundness).

## Milestone 3: Real-Time Action & Sensory (Future)
*Bringing the world to life.*

- [ ] **Phase 7: Real-Time Action (RTA)**
  - [ ] Discrete to Continuous time transition.
  - [ ] Collision detection & Physics components.
- [ ] **Phase 8: Sensory & Perception**
  - [ ] Entity FOV and Light sources.
  - [ ] Audio/SFX triggers in DSL.
- [ ] **Phase 9: High-Depth Generation**
  - [ ] Multi-level world generation.
  - [ ] Complex narrative branching.

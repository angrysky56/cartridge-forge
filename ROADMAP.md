# Cartridge Forge Roadmap

## Milestone 1: The Core Expansion (Infrastructure)
*Foundational systems to support complex game data and rendering.*

- [x] **Phase 1: Persistence & State Management**
  - Standardized save/load system.
  - Component-level persistence markers.
  - Undo/Redo capability for Forge operations.
- [x] **Phase 2: Multi-Mode Rendering** (Visual Foundation)
  - [x] Implement `IRenderer` and `RendererFactory`.
  - [x] `Wireframe3DRenderer` for Elite-style vector graphics.
  - [x] `CellPseudo3DRenderer` for Wizardry-style dungeon crawling.
  - [x] Dynamic switching via Cartridge Metadata.
- [ ] **Phase 3: DSL Evolution**
  - Genetic data support (Mail Order Monsters).
  - Complex inventory & stat math.
  - Trigger depth capping & loop prevention.

## Milestone 2: The Agent Forge (Orchestration)
*Turning AI into a game designer.*

- [ ] **Phase 4: Agent Skill Folders**
  - Structure for "Forge Skills" (e.g., `mechanics-designer`, `map-architect`).
  - Integration with the local agent pipeline.
- [ ] **Phase 5: Cartridge Authoring Pipeline**
  - From prompt to valid JSON cartridge.
  - Iterative refinement (Agent-to-Agent feedback).
- [ ] **Phase 6: Verification & Validation**
  - Automated playtesting agents.
  - Structural validation (Map connectivity, logic soundness).

## Milestone 3: Real-Time Action & Sensory
*Bringing the world to life.*

- [ ] **Phase 7: RTA Core**
  - Keyboard-driven physics and collision.
  - Action-priority tick system.
- [ ] **Phase 8: Audio Synthesis**
  - Procedural sound effects (C64 SID-inspired).
  - Music track sequencing in DSL.

## Milestone 4: The Great Forging (Final Benchmarks)
*Recreating the classics.*

- [ ] **Phase 9: Classic Benchmarks**
  - Template: *Elite* (3D Space Sim).
  - Template: *Zork* (Interactive Fiction).
  - Template: *Mail Order Monsters* (Mutation/Tactical).
  - Template: *Wizardry* (Dungeon Crawler).
  - Template: *Archon* (Tactical Action).
- [ ] **Phase 10: Polishing & User Experience**
  - Glassmorphism UI for the Forge interface.
  - Export to Standalone executable/web page.

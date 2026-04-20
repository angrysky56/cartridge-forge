# Phase 2: The Multi-Mode Renderer

## Goal
Implement a flexible rendering system that supports classic 2D grids, Elite-style wireframes, and Wizardry-style pseudo-3D, selectable via the cartridge configuration.

## Tasks

### 1. DSL & Schema Expansion
- [x] Update `CartridgeSchema` to include `renderer_mode: 'GRID_2D' | 'WIREFRAME_3D' | 'CELL_PSEUDO_3D'`.
- [x] Add `mesh` support to `Renderable` component (list of vertices/edges for 3D).
- [x] Add `direction` support to `Position` (needed for pseudo-3D orientation).

### 2. Infrastructure: Renderer Interface
- [x] Create `IRenderer` interface in `src/renderer/types.ts`.
- [x] Refactor `CanvasRenderer` into `Grid2DRenderer`.
- [x] Implement `RendererFactory` to instantiate the correct renderer based on cartridge config.

### 3. Implementation: Wireframe 3D (Elite Style)
- [x] Build `Wireframe3DRenderer`.
- [x] Implement 3D pipeline: Transformation → Projection → Clipping → Canvas Drawing.
- [x] Add "CRT Glow" post-processing effect.

### 4. Implementation: Cell-Based Pseudo-3D (Wizardry Style)
- [x] Build `CellPseudo3DRenderer`.
- [x] Implement depth-sorting for grid cells.
- [x] Draw walls, floors, and distant features based on player orientation.

### 5. Verification
- [x] Create a "Wireframe Benchmark" cartridge with a rotating 3D cube.
- [x] Create a "Dungeon Crawler" cartridge with step-based movement.
- [x] Verify seamless switching between modes.

## Success Criteria
- Cartridge can switch renderer mode via JSON.
- `Wireframe3D` mode displays projected 3D meshes on the 2D canvas.
- `CellPseudo3D` mode displays a first-person grid view.
- Frame rate remains stable (>30fps) for typical scenes.

# Retro Graphics & Engine Architecture

## 1. Elite-Style Wireframe (3D Projection)
To implement a "World Class" wireframe renderer:
- **Geometry**: Define objects as vertex sets and edge lists.
- **Pipeline**: 
    1. **Transform**: Apply rotation/translation (4x4 Matrix).
    2. **Clip**: Remove edges behind the camera.
    3. **Project**: Perspective projection: $x' = (f \cdot x)/z$, $y' = (f \cdot y)/z$.
- **Rendering**: Canvas `lineTo()` with "Glow" effects (shadow blur) to mimic CRT phosphors.

## 2. Bard's Tale Pseudo-3D (Cell-Based)
- **Grid Persistence**: Instead of raycasting, use a **Cell-Based View** for step-movement.
- **Depth Sorting**: Render from back-to-front (Painter's Algorithm).
- **Static Assets**: Use the Forge to generate "walls," "floors," and "doors" as vector polygons or sprites, then scale/skew them based on grid distance.

## 3. Hybrid RTA/Turn-Based Timing
- **Tick System**: Use a variable-length tick.
- **Action Queue**: Entities submit actions to a priority queue.
- **Real-Time Layer**: For RTA modes, systems process the queue at 60fps. For turn-based, systems wait for player input before advancing the world clock.

---

*Research synthesized: 2026-04-20*

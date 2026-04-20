# Technology Stack Research

**Analysis Date:** 2026-04-20

## Modern Browser-Based ECS Patterns (2025)

To support the complexity of C64-era games like *Elite* or *Wizardry* while maintaining web performance, the following patterns are recommended:

### 1. High-Performance ECS
- **TypedArrays (SoA)**: For core components like `Position` or `Physics`, use a "Structure of Arrays" layout with `Float32Array` or `Int32Array`. This avoids the "array of objects" performance trap in JavaScript and minimizes Garbage Collection (GC) pressure.
- **Entity IDs**: Stick to integer-based entity IDs for fast indexing.

### 2. Multi-Threaded Logic
- **Web Workers**: Move the ECS logic and simulation to a Web Worker. Use `SharedArrayBuffer` for zero-copy data sharing between the logic thread and the rendering thread.
- **OffscreenCanvas**: If using a worker, utilize `OffscreenCanvas` for background rendering to keep the main thread purely for user input and UI.

### 3. Rendering Technologies
- **Canvas 2D**: Sufficient for 2D grid games, *Zork*-style text, and cell-based pseudo-3D.
- **WebGPU**: The 2025 standard for 3D. Highly recommended for *Elite*-style wireframe graphics as it allows for low-level GPU control and high vertex counts without bottlenecking the CPU.

---

*Research synthesized: 2026-04-20*

# Implementation Pitfalls

## 1. AI-Generated Logic Loops
- **The Issue**: AI agents generating DSL triggers that fire recursively (e.g., A triggers B, B triggers A).
- **Mitigation**: Implement a "Trigger Depth" cap in the DSL executor.

## 2. Map Connectivity
- **The Issue**: Procedural algorithms (CA, Drunkard's Walk) often create isolated islands.
- **Mitigation**: Add a post-generation pass using Breadth-First Search (BFS) to identify islands and "dig" connecting tunnels or discard invalid maps.

## 3. GC Pressure in JavaScript
- **The Issue**: Frequent object creation (e.g., `{x, y}`) in the game loop.
- **Mitigation**: Use reusable object pools for math vectors and component updates.

## 4. State Bloat in Persistence
- **The Issue**: Saving every entity property can lead to massive save files.
- **Mitigation**: Implement a "Delta-Save" system or only serialize components marked `persistent: true`.

---

*Research synthesized: 2026-04-20*

# Areas of Concern

**Analysis Date:** 2026-04-20

## Technical Debt

**Missing Algorithm Implementations:**
- **Prefab Maps**: The `prefab` algorithm in `src/runtime/mapgen.ts` is currently a stub that falls back to cellular automata. This prevents loading pre-defined levels from cartridges.

**Lack of Connectivity Checks:**
- **Cellular Automata & Drunkard's Walk**: These algorithms do not currently guarantee that all floor tiles are reachable from one another. This could result in "islands" where the player or enemies are trapped.

## Fragile Areas

**Map Generation Constraints:**
- **BSP Rooms**: The `bsp_rooms` algorithm uses a hardcoded 30-attempt limit for placing rooms. In small maps or with large room size constraints, this might result in very few rooms being placed without warning.

**DSL Expression Safety:**
- **Safe Evaluation**: While `expr-eval` is used, the system relies on dot-path strings. Incorrect paths in a cartridge will cause runtime errors.

## Security & Performance

**Infinite Event Loops:**
- **Emit Event Chain**: There is a hard limit of 50 chained events mentioned in `DSL_REFERENCE.md`. If this limit is hit, the turn might end abruptly or behave unexpectedly.

**Asset Loading:**
- **HTTP Fetch**: Cartridges are fetched via relative URLs. If the server is not configured correctly, or if files are missing, the game will fail to start with a generic fetch error.

---

*Concerns analysis: 2026-04-20*
*Update when significant issues are resolved or new risks are identified*

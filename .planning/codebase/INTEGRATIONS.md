# External Integrations

**Analysis Date:** 2026-04-20

## External Services & APIs

**Cartridge Loading:**
- **Local HTTP Fetch**: The runtime fetches cartridge JSON files from the `/cartridges/` directory using the native `fetch` API.
- **Location**: `src/main.ts`

**Browser APIs:**
- **Canvas API**: Used for rendering the game world and UI.
- **Location**: `src/renderer/canvas.ts`

## Storage & Databases

- **None**: This is currently a client-side game engine with no external database or persistent storage integrations. Cartridges are static JSON files.

## Authentication & Authorization

- **None**: No user authentication is implemented.

---

*Integrations analysis: 2026-04-20*
*Update when external dependencies or service integrations are added*

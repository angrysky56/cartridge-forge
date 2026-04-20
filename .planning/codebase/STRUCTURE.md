# Directory Structure

**Analysis Date:** 2026-04-20

## Overview

```text
.
├── cartridges/         # Game definitions (JSON files)
├── docs/               # Technical documentation and DSL reference
├── public/             # Static assets (favicon, global styles)
├── src/                # Source code (TypeScript)
│   ├── cartridge/      # Cartridge loading and validation
│   ├── dsl/            # Expression evaluation and effect execution
│   ├── ecs/            # Core Entity Component System
│   ├── renderer/       # Canvas-based drawing logic
│   ├── runtime/        # Game loop and map generation
│   └── main.ts         # Application entry point
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite configuration
```

## Key Locations

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/ecs/` | Core data management | `world.ts`, `types.ts` |
| `src/dsl/` | Logic engine | `evaluator.ts`, `executor.ts` |
| `src/cartridge/` | Schema and loading | `schema.ts`, `loader.ts` |
| `src/runtime/` | High-level game logic | `game.ts`, `mapgen.ts` |
| `src/renderer/` | Visual output | `canvas.ts` |
| `cartridges/` | Game content | `abyssal_protocol.json` |

## Naming Conventions

- **Files**: Lowercase with hyphens (kebab-case), e.g., `cli-validate.ts`.
- **Directories**: Lowercase, e.g., `renderer`.
- **Classes**: PascalCase, e.g., `World`, `Evaluator`.
- **Types/Interfaces**: PascalCase, e.g., `Entity`, `ComponentData`.
- **Functions**: camelCase, e.g., `generateId`.
- **Constants**: UPPER_SNAKE_CASE for truly global constants, otherwise camelCase.

---

*Structure analysis: 2026-04-20*
*Update when directory organization or naming standards change*

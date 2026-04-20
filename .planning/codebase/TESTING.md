# Testing Patterns

**Analysis Date:** 2026-04-20

## Test Framework

**Current State:**
- **None**: No automated test framework is currently configured in `package.json`.
- There is a `validate` script (`tsx src/cartridge/cli-validate.ts`) used for manual/CLI validation of cartridge schemas.

## Verification Approach

**Manual Validation:**
```bash
npm run validate -- cartridges/your-game.json
```
This checks the cartridge JSON against the Zod schema defined in `src/cartridge/schema.ts`.

**Runtime Testing:**
- Manual verification via the browser (Vite dev server).

## Planned Testing Strategy

- **Unit Testing**: Recommend adding `Vitest` for testing ECS logic, DSL evaluation, and map generation.
- **Integration Testing**: Testing full turn sequences by loading a test cartridge and asserting on world state.

---

*Testing analysis: 2026-04-20*
*Update when a test framework is introduced*

# Coding Conventions

**Analysis Date:** 2026-04-20

## Code Style & Standards

**General Principles:**
- **Strict TypeScript**: Type safety is prioritized. All components and event data are typed.
- **Declarative Logic**: Game logic should be moved to the DSL (Cartridge JSON) whenever possible, rather than being hardcoded in TypeScript.
- **Functional Mutations**: State mutations are centralized in the ECS `World` and DSL `Executor` to ensure predictable data flow.

**Naming:**
- **Variables/Functions**: `camelCase`.
- **Classes/Types**: `PascalCase`.
- **Cartridge Keys**: `snake_case` (matching the DSL schema).

## Pattern & Structure

**ECS Pattern:**
- Components are defined as pure interfaces in `src/ecs/types.ts`.
- Logic is decoupled from data.

**DSL Execution:**
- Use the `Evaluator` for all mathematical expressions to ensure safe evaluation.
- Use the `Executor` for all state changes.

**Documentation:**
- Use JSDoc/TSDoc for public classes and complex functions.
- Maintain `DSL_REFERENCE.md` as the source of truth for the game engine's capabilities.

## Error Handling

- Use standard `Error` throws for invalid cartridge data or runtime violations.
- Validation errors for cartridges are handled via Zod's `safeParse` in the loader/CLI.

---

*Conventions analysis: 2026-04-20*
*Update when coding standards or architectural patterns evolve*

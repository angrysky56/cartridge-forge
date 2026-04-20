# Technology Stack

**Analysis Date:** 2026-04-20

## Core Stack

**Language:**
- TypeScript 5.8.3
- Target: ES2022 (from `tsconfig.json` inference)
- Module System: ES Modules (`"type": "module"` in `package.json`)

**Runtime:**
- Browser (main entry `src/main.ts` with Vite)
- Node.js (for CLI tools like `src/cartridge/cli-validate.ts` via `tsx`)

**Bundler / Build Tool:**
- Vite 6.3.5

## Key Dependencies

**Production:**
- `expr-eval` (forked as `expr-eval-fork@^3.0.3`): Used for DSL expression evaluation in `src/dsl/evaluator.ts`.
- `zod` (^3.24.4): Schema validation for cartridges in `src/cartridge/schema.ts`.

**Development:**
- `tsx` (^4.19.4): Running TypeScript CLI tools directly.
- `vite`: Dev server and build pipeline.

## Configuration

**TypeScript:**
- `tsconfig.json`: Root configuration for the TypeScript compiler.

**Vite:**
- `vite.config.ts`: Bundler and dev server configuration.

---

*Stack analysis: 2026-04-20*
*Update when core technologies or dependencies change*

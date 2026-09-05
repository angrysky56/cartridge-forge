/**
 * Forgemaster Live Cartridge Validator.
 * Validates arbitrary JSON against Zod schema and generates user-friendly error diagnostics.
 */

import { CartridgeSchema, type Cartridge } from '../cartridge/schema.js';

export interface ValidationDiagnostic {
  path: string;
  message: string;
  received?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  cartridge?: Cartridge;
  errors: ValidationDiagnostic[];
  summary: string;
}

export function validateCartridgeJson(rawInput: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch (err) {
    return {
      valid: false,
      errors: [{ path: 'JSON Syntax', message: (err as Error).message }],
      summary: `JSON Syntax Error: ${(err as Error).message}`,
    };
  }

  const result = CartridgeSchema.safeParse(parsed);
  if (result.success) {
    // Perform semantic sanity checks
    const c = result.data;
    const errors: ValidationDiagnostic[] = [];

    // Check that at least one player blueprint exists
    const hasPlayer = Object.values(c.blueprints).some(bp => {
      const faction = bp['Faction'] as { id?: string } | undefined;
      return faction?.id === 'player';
    });

    if (!hasPlayer) {
      errors.push({
        path: 'blueprints',
        message: 'No player blueprint found. At least one blueprint must have Faction: { id: "player" }',
      });
    }

    // Check that all spawn table blueprints exist
    if (c.world_gen?.spawn_table) {
      for (const entry of c.world_gen.spawn_table) {
        if (!c.blueprints[entry.blueprint]) {
          errors.push({
            path: `world_gen.spawn_table.${entry.blueprint}`,
            message: `Spawn table references undefined blueprint "${entry.blueprint}"`,
          });
        }
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        summary: `Validation failed with ${errors.length} semantic issue(s).`,
      };
    }

    return {
      valid: true,
      cartridge: c,
      errors: [],
      summary: `Cartridge "${c.meta.title}" is 100% valid and ready to play!`,
    };
  }

  // Format Zod errors
  const errors: ValidationDiagnostic[] = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    received: (issue as any).received,
  }));

  return {
    valid: false,
    errors,
    summary: `Validation failed with ${errors.length} schema error(s).`,
  };
}

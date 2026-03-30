/**
 * Cartridge Loader — validates and parses AI-generated cartridge JSON.
 * Returns structured errors the AI can use to fix its output.
 */

import { CartridgeSchema, type Cartridge } from './schema.js';

export interface LoadResult {
  success: boolean;
  cartridge?: Cartridge;
  errors?: string[];
}

/** Validate raw JSON string into a typed Cartridge */
export function loadCartridge(jsonString: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      errors: [`Invalid JSON: ${(err as Error).message}`],
    };
  }

  const result = CartridgeSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `[${path}] ${issue.message}`;
    });
    return { success: false, errors };
  }

  // Cross-validation: check that systems reference valid components/blueprints
  const crossErrors = crossValidate(result.data);
  if (crossErrors.length > 0) {
    return { success: false, errors: crossErrors };
  }

  return { success: true, cartridge: result.data };
}

/** Cross-validate references between systems, blueprints, and components */
function crossValidate(cartridge: Cartridge): string[] {
  const errors: string[] = [];
  const componentNames = new Set(Object.keys(cartridge.components));
  const blueprintNames = new Set(Object.keys(cartridge.blueprints));

  // Check blueprints reference valid components
  for (const [bpName, bp] of Object.entries(cartridge.blueprints)) {
    for (const compName of Object.keys(bp)) {
      if (!componentNames.has(compName)) {
        errors.push(
          `Blueprint "${bpName}" references unknown component "${compName}". ` +
          `Available: ${[...componentNames].join(', ')}`
        );
      }
    }
  }

  // Check spawn_table references valid blueprints
  if (cartridge.world_gen.spawn_table) {
    for (const entry of cartridge.world_gen.spawn_table) {
      if (!blueprintNames.has(entry.blueprint)) {
        errors.push(
          `Spawn table references unknown blueprint "${entry.blueprint}". ` +
          `Available: ${[...blueprintNames].join(', ')}`
        );
      }
    }
  }

  // Check system SPAWN_ENTITY effects reference valid blueprints
  for (const [sysName, sys] of Object.entries(cartridge.systems)) {
    for (const effect of sys.effects) {
      if (effect.type === 'SPAWN_ENTITY' && !blueprintNames.has(effect.blueprint)) {
        errors.push(
          `System "${sysName}" spawns unknown blueprint "${effect.blueprint}".`
        );
      }
    }
    if (sys.post_checks) {
      for (const check of sys.post_checks) {
        for (const effect of check.then) {
          if (effect.type === 'SPAWN_ENTITY' && !blueprintNames.has(effect.blueprint)) {
            errors.push(
              `System "${sysName}" post_check spawns unknown blueprint "${effect.blueprint}".`
            );
          }
        }
      }
    }
  }

  return errors;
}

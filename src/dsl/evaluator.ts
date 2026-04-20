/**
 * DSL Expression Evaluator — the bridge between declarative JSON and game logic.
 * Uses expr-eval for safe math parsing (no eval(), no arbitrary code execution).
 *
 * Expressions like "max(1, attacker.CombatStats.strength - target.CombatStats.armor)"
 * are evaluated against a context built from entity component data.
 */

import { Parser } from 'expr-eval';
import type { Entity } from '../ecs/types.js';
import { World } from '../ecs/world.js';

/** Shared parser instance with custom functions registered */
const parser = new Parser({
  operators: {
    logical: true,
    comparison: true,
    assignment: false,   // No side effects in expressions
    conditional: true,   // Ternary operator support
    'in': false,
  },
});

/**
 * Built-in DSL functions — the ONLY functions the AI can use in expressions.
 * Adding a function here is how you extend the DSL vocabulary.
 */

/** Manhattan distance between two positions */
function distance(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Simulate dice roll: e.g., "1d20" → random 1-20, "2d6+4" → 2-12 + 4 */
function roll(diceStr: string): number {
  const match = diceStr.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Invalid dice string: "${diceStr}"`);
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');
  let total = modifier;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Build a flat variable scope from entity context bindings.
 * Converts nested entity component data into dot-path variables
 * that expr-eval can resolve.
 *
 * e.g., context = { attacker: entityA, target: entityB }
 * becomes: { "attacker.Health.current": 100, "attacker.CombatStats.strength": 15, ... }
 *
 * Since expr-eval doesn't support dots in variable names natively,
 * we flatten to underscore-separated keys and rewrite expressions to match.
 */
export function buildScope(
  contextBindings: Record<string, Entity>,
  world: World,
  externalModifiers?: Record<string, Record<string, number>>, // EntityId -> { "Health.max": 10 }
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  for (const [varName, entity] of Object.entries(contextBindings)) {
    // Add entity-level fields
    scope[`${varName}__id`] = entity.id;

    // Get external modifiers for this entity
    const entityMods = externalModifiers?.[entity.id] || {};

    // Flatten all component data
    for (const [compName, compData] of entity.components) {
      for (const [field, value] of Object.entries(compData)) {
        const path = `${compName}.${field}`;
        const modifier = entityMods[path] || 0;
        
        if (typeof value === 'number') {
          scope[`${varName}__${compName}__${field}`] = value + modifier;
        } else {
          scope[`${varName}__${compName}__${field}`] = value;
        }
      }
    }
  }

  // Register built-in functions
  scope['distance'] = (x1: number, y1: number, x2: number, y2: number) =>
    distance(x1, y1, x2, y2);
  scope['roll'] = (d: string) => roll(d);
  scope['max'] = Math.max;
  scope['min'] = Math.min;
  scope['abs'] = Math.abs;
  scope['floor'] = Math.floor;
  scope['ceil'] = Math.ceil;
  scope['random'] = () => Math.random();

  // Tag-check functions (need entity references)
  scope['has_tag'] = (varName: string, tag: string): boolean => {
    const entity = contextBindings[varName];
    return entity ? entity.tags.has(tag) : false;
  };

  scope['has_component'] = (varName: string, compName: string): boolean => {
    const entity = contextBindings[varName];
    return entity ? entity.components.has(compName) : false;
  };

  return scope;
}

/**
 * Rewrite dot-notation in expressions to underscore notation for expr-eval.
 * "attacker.CombatStats.strength" → "attacker__CombatStats__strength"
 *
 * Also handles distance() calls by expanding position references:
 * "distance(attacker.Position, target.Position)" →
 * "distance(attacker__Position__x, attacker__Position__y, target__Position__x, target__Position__y)"
 */
function rewriteExpression(expr: string, contextKeys: string[]): string {
  let result = expr;

  // Expand position-based distance calls
  result = result.replace(
    /distance\((\w+)\.Position\s*,\s*(\w+)\.Position\)/g,
    (_, a, b) => `distance(${a}__Position__x, ${a}__Position__y, ${b}__Position__x, ${b}__Position__y)`,
  );

  // Replace dot-paths with underscore paths (longest match first to avoid partial replacements)
  const sortedKeys = contextKeys.sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const dotKey = key.replace(/__/g, '.');
    if (result.includes(dotKey)) {
      result = result.replaceAll(dotKey, key);
    }
  }

  return result;
}

/** Evaluate a numeric expression against an entity context */
export function evaluate(
  expression: string,
  scope: Record<string, unknown>,
): number {
  const rewritten = rewriteExpression(expression, Object.keys(scope));
  try {
    const result = parser.evaluate(rewritten, scope);
    return typeof result === 'number' ? result : Number(result);
  } catch (err) {
    console.error(`DSL eval error: "${expression}" → "${rewritten}"`, err);
    return 0; // Safe fallback for math expressions
  }
}

/** Evaluate a boolean condition expression */
export function evaluateCondition(
  expression: string,
  scope: Record<string, unknown>,
): boolean {
  const rewritten = rewriteExpression(expression, Object.keys(scope));
  try {
    return Boolean(parser.evaluate(rewritten, scope));
  } catch (err) {
    console.error(`DSL condition error: "${expression}" → "${rewritten}"`, err);
    return false; // Safe fallback — don't fire effects on error
  }
}

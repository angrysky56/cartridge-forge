/**
 * Cartridge Schema — Zod validation for AI-generated game definitions.
 * This is the contract between the AI and the runtime.
 * If the AI outputs invalid JSON, Zod catches it with clear error messages.
 */

import { z } from 'zod';

// ─── Component Schema ───────────────────────────────────────────────
// Components define the data shape. Values are type descriptors.
const ComponentFieldSchema = z.union([
  z.literal('number'),
  z.literal('string'),
  z.literal('boolean'),
  z.string().startsWith('array<'),  // e.g., "array<EntityID>"
]);

export const ComponentDefSchema = z.record(z.string(), ComponentFieldSchema);

// ─── Blueprint Schema ───────────────────────────────────────────────
// Blueprints are entity templates with initialized component values.
export const BlueprintSchema = z.record(
  z.string(),  // Component name
  z.record(z.string(), z.unknown()),  // Component field values
);

// ─── DSL Effect Types ───────────────────────────────────────────────
// These are the ONLY effect types the runtime understands.
// The AI cannot hallucinate new ones — validation catches unknowns.

const MutateEffectSchema = z.object({
  type: z.literal('MUTATE'),
  target: z.string(),          // e.g., "target.Health.current"
  operation: z.enum(['ADD', 'SUBTRACT', 'SET', 'MULTIPLY']),
  value: z.string(),           // Expression string, e.g., "max(1, attacker.CombatStats.strength - target.CombatStats.armor)"
});

const DestroyEntityEffectSchema = z.object({
  type: z.literal('DESTROY_ENTITY'),
  target: z.string(),          // Context variable name
});

const SpawnEntityEffectSchema = z.object({
  type: z.literal('SPAWN_ENTITY'),
  blueprint: z.string(),
  at: z.string(),              // Expression resolving to position, e.g., "target.Position"
});

const ApplyTagEffectSchema = z.object({
  type: z.literal('APPLY_TAG'),
  target: z.string(),
  tag: z.string(),
  duration: z.number().optional(),  // Turns until auto-removed, omit = permanent
});

const RemoveTagEffectSchema = z.object({
  type: z.literal('REMOVE_TAG'),
  target: z.string(),
  tag: z.string(),
});

const LogMessageEffectSchema = z.object({
  type: z.literal('LOG_MESSAGE'),
  message: z.string(),        // Template string, e.g., "The {attacker.name} strikes!"
});

const EmitEventEffectSchema = z.object({
  type: z.literal('EMIT_EVENT'),
  event: z.string(),           // Event name to chain
  source: z.string().optional(),
  target: z.string().optional(),
});

export const EffectSchema = z.discriminatedUnion('type', [
  MutateEffectSchema,
  DestroyEntityEffectSchema,
  SpawnEntityEffectSchema,
  ApplyTagEffectSchema,
  RemoveTagEffectSchema,
  LogMessageEffectSchema,
  EmitEventEffectSchema,
]);

// ─── Conditional Block (for post_checks) ────────────────────────────
export const ConditionalBlockSchema = z.object({
  if: z.string(),              // Boolean expression
  then: z.array(EffectSchema),
});

// ─── System Schema (DSL Rules) ──────────────────────────────────────
export const SystemSchema = z.object({
  /** Which event triggers this system */
  listens_for: z.string(),
  /** Bind event entities to named variables */
  context: z.record(z.string(), z.string()).optional(),
  /** All conditions must be true for effects to fire */
  requires: z.array(z.string()).optional(),
  /** Priority — lower runs first (default 100) */
  priority: z.number().optional(),
  /** Sequential state mutations */
  effects: z.array(EffectSchema),
  /** Post-effect conditional checks (e.g., death triggers) */
  post_checks: z.array(ConditionalBlockSchema).optional(),
});

// ─── World Generation Schema ────────────────────────────────────────
export const WorldGenSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  algorithm: z.enum(['cellular_automata', 'bsp_rooms', 'drunkard_walk', 'prefab']),
  floor_glyph: z.string().default('.'),
  wall_glyph: z.string().default('#'),
  wall_density: z.number().min(0).max(1).default(0.4),
  room_min_size: z.number().int().positive().optional(),
  room_max_size: z.number().int().positive().optional(),
  spawn_table: z.array(z.object({
    blueprint: z.string(),
    weight: z.number().positive(),
    max_per_level: z.number().int().positive().optional(),
  })).optional(),
});

// ─── Top-Level Cartridge Schema ─────────────────────────────────────
export const CartridgeSchema = z.object({
  meta: z.object({
    title: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
    palette: z.record(z.string(), z.string()).optional(),  // Named color overrides
  }),
  components: z.record(z.string(), ComponentDefSchema),
  blueprints: z.record(z.string(), BlueprintSchema),
  systems: z.record(z.string(), SystemSchema),
  world_gen: WorldGenSchema,
  /** Named events the runtime recognizes */
  events: z.array(z.string()).optional(),
});

/** Inferred TypeScript type from the schema */
export type Cartridge = z.infer<typeof CartridgeSchema>;
export type GameSystem = z.infer<typeof SystemSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type ConditionalBlock = z.infer<typeof ConditionalBlockSchema>;

/**
 * Core ECS type definitions.
 * Components are pure data bags — no logic, no methods.
 * Entities are just IDs with component bundles.
 * Systems are declarative JSON rules, NOT imperative TS classes.
 */

/** Unique identifier for an entity instance */
export type EntityId = string;

/** Component name as defined in cartridge schema */
export type ComponentName = string;

/** A component instance is a plain key-value record */
export type ComponentData = Record<string, unknown>;

/** An entity is an ID + a map of component names to their data */
export interface Entity {
  id: EntityId;
  components: Map<ComponentName, ComponentData>;
  /** Runtime tags applied by effects (e.g., "stunned", "poisoned") */
  tags: Set<string>;
  /** Whether this entity has been marked for destruction */
  destroyed: boolean;
}

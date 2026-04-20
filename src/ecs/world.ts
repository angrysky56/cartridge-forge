/**
 * ECS World — the entity manager.
 * Handles entity creation, destruction, component queries, and tag management.
 * No game logic lives here — that's all in the DSL systems.
 */

import type { EntityId, ComponentName, ComponentData, Entity } from './types.js';

export class World {
  /** Next entity ID sequence */
  private nextEntityId = 0;

  /** Generate a unique entity ID */
  private generateId(prefix = 'e'): EntityId {
    return `${prefix}_${this.nextEntityId++}`;
  }

  /** All living entities indexed by ID */
  private entities = new Map<EntityId, Entity>();

  /** Blueprint templates loaded from cartridge */
  private blueprints = new Map<string, Record<string, ComponentData>>();

  /** Component definitions and metadata */
  private componentDefs = new Map<ComponentName, ComponentDefinition>();

  /** Pending entity destructions (processed end of turn) */
  private destructionQueue: EntityId[] = [];

  /** Pending entity spawns (processed end of turn) */
  private spawnQueue: Array<{ blueprint: string; overrides?: Record<string, Partial<ComponentData>> }> = [];

  /** Register blueprints from a cartridge */
  registerBlueprints(blueprints: Record<string, Record<string, ComponentData>>): void {
    for (const [name, components] of Object.entries(blueprints)) {
      this.blueprints.set(name, components);
    }
  }

  /** Register component definitions from a cartridge */
  registerComponentDefinitions(defs: Record<ComponentName, ComponentDefinition>): void {
    for (const [name, def] of Object.entries(defs)) {
      this.componentDefs.set(name, def);
    }
  }

  /** Create an entity from a blueprint with optional component overrides */
  spawn(blueprintName: string, overrides?: Record<string, Partial<ComponentData>>): Entity {
    const template = this.blueprints.get(blueprintName);
    if (!template) {
      throw new Error(`Unknown blueprint: "${blueprintName}"`);
    }

    const entity: Entity = {
      id: this.generateId(blueprintName),
      components: new Map(),
      tags: new Set(),
      destroyed: false,
      persistent: false, // Will be determined by components
    };

    // Combined list of component names from template and overrides
    const allCompNames = new Set([
      ...Object.keys(template),
      ...Object.keys(overrides || {}),
    ]);

    for (const compName of allCompNames) {
      const templateData = template[compName];
      const overrideData = overrides?.[compName];

      let cloned: ComponentData;
      if (templateData) {
        cloned = structuredClone(templateData);
        if (overrideData) {
          Object.assign(cloned, overrideData);
        }
      } else {
        cloned = structuredClone(overrideData as ComponentData);
      }

      entity.components.set(compName, cloned);

      // If any component is persistent, the whole entity becomes persistent
      const def = this.componentDefs.get(compName);
      if (def?.persistent) {
        entity.persistent = true;
      }
    }

    this.entities.set(entity.id, entity);
    return entity;
  }

  /** Queue an entity for destruction (processed at flush) */
  queueDestroy(entityId: EntityId): void {
    this.destructionQueue.push(entityId);
  }

  /** Queue a spawn (processed at flush) */
  queueSpawn(blueprint: string, overrides?: Record<string, Partial<ComponentData>>): void {
    this.spawnQueue.push({ blueprint, overrides });
  }

  /** Process all queued spawns and destructions — call at end of turn */
  flush(): void {
    // Process spawns first
    for (const { blueprint, overrides } of this.spawnQueue) {
      this.spawn(blueprint, overrides);
    }
    this.spawnQueue = [];

    // Then destructions
    for (const id of this.destructionQueue) {
      const entity = this.entities.get(id);
      if (entity) {
        entity.destroyed = true;
        this.entities.delete(id);
      }
    }
    this.destructionQueue = [];
  }

  /** Get entity by ID */
  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /** Query all entities that have ALL specified components */
  query(...requiredComponents: ComponentName[]): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.destroyed) continue;
      const hasAll = requiredComponents.every(c => entity.components.has(c));
      if (hasAll) results.push(entity);
    }
    return results;
  }

  /** Query entities that have a specific tag */
  queryByTag(tag: string): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.destroyed && entity.tags.has(tag)) {
        results.push(entity);
      }
    }
    return results;
  }

  /** Get all entities (for rendering) */
  allEntities(): Entity[] {
    return Array.from(this.entities.values()).filter(e => !e.destroyed);
  }

  /** Get a component value using dot-path like "entity.Health.current" */
  resolveComponentPath(entity: Entity, path: string): unknown {
    // Path format: "ComponentName.field" or "ComponentName.field.nested"
    const parts = path.split('.');
    const compName = parts[0];
    const comp = entity.components.get(compName);
    if (!comp) return undefined;

    let value: unknown = comp;
    for (let i = 1; i < parts.length; i++) {
      if (value == null || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[parts[i]];
    }
    return value;
  }

  /** Set a component value using dot-path */
  setComponentPath(entity: Entity, path: string, value: unknown): void {
    const parts = path.split('.');
    const compName = parts[0];
    const comp = entity.components.get(compName);
    if (!comp) return;

    if (parts.length === 2) {
      comp[parts[1]] = value;
    } else {
      // Navigate to the parent of the target field
      let target: Record<string, unknown> = comp as Record<string, unknown>;
      for (let i = 1; i < parts.length - 1; i++) {
        target = target[parts[i]] as Record<string, unknown>;
        if (!target) return;
      }
      target[parts[parts.length - 1]] = value;
    }
  }

  /** Reset world state */
  clear(): void {
    this.entities.clear();
    this.destructionQueue = [];
    this.spawnQueue = [];
    this.nextEntityId = 0;
  }
}

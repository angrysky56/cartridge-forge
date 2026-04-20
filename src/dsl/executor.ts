/**
 * DSL System Executor — processes game events through declarative systems.
 * This is the bridge between the event pipeline and the ECS world.
 *
 * Flow: Event emitted → matching systems found → conditions checked →
 *       effects applied → post_checks evaluated → world flushed
 */

import type { Entity } from '../ecs/types.js';
import { World } from '../ecs/world.js';
import type { GameSystem, Effect, ConditionalBlock } from '../cartridge/schema.js';
import { buildScope, evaluate, evaluateCondition } from './evaluator.js';
import type { GeneticsService } from '../runtime/genetics.js';
import type { InventoryService } from '../runtime/inventory.js';

/** Runtime event carrying source/target entity references */
export interface GameEvent {
  name: string;
  source?: Entity;
  target?: Entity;
  /** Additional data attached by the emitting system */
  data?: Record<string, unknown>;
}

/** Combat log callback for UI integration */
export type LogCallback = (message: string) => void;

export class SystemExecutor {
  /** Named systems loaded from cartridge, sorted by priority */
  private systems: Array<{ name: string; def: GameSystem }> = [];
  private world: World;
  private logCallback: LogCallback;
  private genetics?: GeneticsService;
  private inventory?: InventoryService;
  /** Event queue for chained events (EMIT_EVENT effects) */
  private eventQueue: GameEvent[] = [];

  constructor(
    world: World,
    logCallback: LogCallback,
    genetics?: GeneticsService,
    inventory?: InventoryService,
  ) {
    this.world = world;
    this.logCallback = logCallback;
    this.genetics = genetics;
    this.inventory = inventory;
  }

  /** Load systems from a cartridge and sort by priority */
  loadSystems(systems: Record<string, GameSystem>): void {
    this.systems = Object.entries(systems)
      .map(([name, def]) => ({ name, def }))
      .sort((a, b) => (a.def.priority ?? 100) - (b.def.priority ?? 100));
  }

  /** Emit an event and process all matching systems */
  emit(event: GameEvent): void {
    this.eventQueue.push(event);
    this.processQueue();
  }

  /** Process events in the queue (handles chained events safely) */
  private processQueue(): void {
    // Guard against infinite event loops
    let maxIterations = 50;
    while (this.eventQueue.length > 0 && maxIterations-- > 0) {
      const event = this.eventQueue.shift()!;
      this.processEvent(event);
    }
    if (maxIterations <= 0) {
      console.warn('Event loop limit reached — possible infinite chain');
    }
  }

  /** Process a single event against all matching systems */
  private processEvent(event: GameEvent): void {
    for (const { name, def } of this.systems) {
      if (def.listens_for !== event.name) continue;

      // Build context bindings from event
      const contextBindings: Record<string, Entity> = {};
      if (def.context) {
        for (const [varName, binding] of Object.entries(def.context)) {
          if (binding === 'event.source' && event.source) {
            contextBindings[varName] = event.source;
          } else if (binding === 'event.target' && event.target) {
            contextBindings[varName] = event.target;
          }
        }
      }

      // Build evaluation scope from context, including equipment modifiers
      const allModifiers: Record<string, Record<string, number>> = {};
      if (this.inventory) {
        for (const entity of Object.values(contextBindings)) {
          allModifiers[entity.id] = this.inventory.getEquipmentModifiers(entity);
        }
      }

      const scope = buildScope(contextBindings, this.world, allModifiers);

      // Check requires conditions
      if (def.requires) {
        const allMet = def.requires.every(cond =>
          evaluateCondition(cond, scope),
        );
        if (!allMet) continue; // Skip this system
      }

      // Apply effects sequentially
      for (const effect of def.effects) {
        this.applyEffect(effect, contextBindings, scope);
      }

      // Rebuild scope after mutations for post_checks
      const postScope = buildScope(contextBindings, this.world);

      // Evaluate post_checks
      if (def.post_checks) {
        for (const check of def.post_checks) {
          this.evaluateConditional(check, contextBindings, postScope);
        }
      }
    }
  }

  /** Apply a single effect to the world */
  private applyEffect(
    effect: Effect,
    context: Record<string, Entity>,
    scope: Record<string, unknown>,
  ): void {
    switch (effect.type) {
      case 'MUTATE': {
        // Resolve which entity and path to mutate
        const { entity, path } = this.resolveTargetPath(effect.target, context);
        if (!entity) break;

        const currentVal = this.world.resolveComponentPath(entity, path);
        const exprResult = evaluate(effect.value, scope);

        let newVal: unknown;
        switch (effect.operation) {
          case 'ADD':
            newVal = (Number(currentVal) || 0) + exprResult;
            break;
          case 'SUBTRACT':
            newVal = (Number(currentVal) || 0) - exprResult;
            break;
          case 'MULTIPLY':
            newVal = (Number(currentVal) || 0) * exprResult;
            break;
          case 'SET':
            newVal = exprResult;
            break;
        }
        this.world.setComponentPath(entity, path, newVal);
        break;
      }

      case 'DESTROY_ENTITY': {
        const entity = context[effect.target];
        if (entity) this.world.queueDestroy(entity.id);
        break;
      }

      case 'SPAWN_ENTITY': {
        // Resolve position from expression like "target.Position"
        const { entity: posEntity, path: posPath } = this.resolveTargetPath(effect.at, context);
        const overrides: Record<string, Record<string, unknown>> = {};
        if (posEntity) {
          const posComp = posEntity.components.get(posPath || 'Position');
          if (posComp) {
            overrides['Position'] = { ...posComp };
          }
        }
        this.world.queueSpawn(effect.blueprint, overrides);
        break;
      }

      case 'APPLY_TAG': {
        const entity = context[effect.target];
        if (entity) entity.tags.add(effect.tag);
        break;
      }

      case 'REMOVE_TAG': {
        const entity = context[effect.target];
        if (entity) entity.tags.delete(effect.tag);
        break;
      }

      case 'LOG_MESSAGE': {
        // Interpolate template strings like "{attacker.id} strikes!"
        const msg = effect.message.replace(
          /\{([^}]+)\}/g,
          (_, path: string) => {
            const { entity, path: compPath } = this.resolveTargetPath(path, context);
            if (!entity) return path;
            const val = this.world.resolveComponentPath(entity, compPath);
            return String(val ?? path);
          },
        );
        this.logCallback(msg);
        break;
      }

      case 'EMIT_EVENT': {
        this.eventQueue.push({
          name: effect.event,
          source: effect.source ? context[effect.source] : undefined,
          target: effect.target ? context[effect.target] : undefined,
        });
        break;
      }

      case 'BREED_ENTITY': {
        if (!this.genetics) break;
        const parentA = context[effect.parentA];
        const parentB = context[effect.parentB];
        if (!parentA || !parentB) break;

        // Generate child overrides via genetics service
        const overrides = this.genetics.breed(parentA, parentB);

        // Resolve position for spawning
        const { entity: posEntity, path: posPath } = this.resolveTargetPath(effect.at, context);
        if (posEntity) {
          const posComp = posEntity.components.get(posPath || 'Position');
          if (posComp) {
            overrides['Position'] = { ...posComp };
          }
        }

        this.world.queueSpawn(effect.blueprint, overrides);
        break;
      }

      case 'EQUIP_ITEM': {
        if (!this.inventory) break;
        const target = context[effect.target];
        const item = context[effect.item];
        if (target && item) {
          this.inventory.equip(target, item, effect.slot);
        }
        break;
      }

      case 'UNEQUIP_ITEM': {
        if (!this.inventory) break;
        const target = context[effect.target];
        if (target) {
          this.inventory.unequip(target, effect.slot);
        }
        break;
      }
    }
  }

  /** Evaluate a conditional block (if/then) */
  private evaluateConditional(
    block: ConditionalBlock,
    context: Record<string, Entity>,
    scope: Record<string, unknown>,
  ): void {
    if (evaluateCondition(block.if, scope)) {
      for (const effect of block.then) {
        this.applyEffect(effect, context, scope);
      }
    }
  }

  /**
   * Resolve "target.Health.current" into { entity, path: "Health.current" }
   * The first segment is the context variable name, the rest is the component path.
   */
  private resolveTargetPath(
    fullPath: string,
    context: Record<string, Entity>,
  ): { entity: Entity | undefined; path: string } {
    const dotIdx = fullPath.indexOf('.');
    if (dotIdx === -1) {
      // Just a context variable name (e.g., "target" for DESTROY_ENTITY)
      return { entity: context[fullPath], path: '' };
    }
    const varName = fullPath.substring(0, dotIdx);
    const path = fullPath.substring(dotIdx + 1);
    return { entity: context[varName], path };
  }
}

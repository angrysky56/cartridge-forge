/**
 * Inventory Service — manages items, equipment, and modifiers.
 */

import type { World } from '../ecs/world.js';
import type { Entity, EntityId } from '../ecs/types.js';

export class InventoryService {
  constructor(private world: World) {}

  /** Equip an item into a slot, applying modifiers */
  equip(entity: Entity, item: Entity, slot: string): void {
    let eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) {
      eq = { slots: {} };
      entity.components.set('Equipment', eq);
    }

    // Unequip current item in slot if any
    if (eq.slots[slot]) {
      this.unequip(entity, slot);
    }

    const equippable = item.components.get('Equippable') as { slot: string; modifiers: Record<string, number> } | undefined;
    if (!equippable || equippable.slot !== slot) return;

    eq.slots[slot] = item.id;
    
    // Items in inventory are typically not also in equipment slots unless represented as refs
    // For this engine, we'll treat Equipment as references to entities that may or may not be in Inventory
  }

  /** Unequip an item from a slot */
  unequip(entity: Entity, slot: string): void {
    const eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq || !eq.slots[slot]) return;

    eq.slots[slot] = null;
  }

  /** Calculate total modifiers for an entity from all equipped items */
  getEquipmentModifiers(entity: Entity): Record<string, number> {
    const totalMods: Record<string, number> = {};
    const eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) return totalMods;

    for (const itemId of Object.values(eq.slots)) {
      if (!itemId) continue;
      const item = this.world.getEntity(itemId);
      if (!item) continue;

      const equippable = item.components.get('Equippable') as { modifiers: Record<string, number> } | undefined;
      if (!equippable?.modifiers) continue;

      for (const [path, mod] of Object.entries(equippable.modifiers)) {
        totalMods[path] = (totalMods[path] || 0) + mod;
      }
    }

    return totalMods;
  }
}

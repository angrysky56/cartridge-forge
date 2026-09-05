/**
 * Inventory Service — manages items, backpack, equipment, set bonuses, and currency.
 */

import type { World } from '../ecs/world.js';
import type { Entity, EntityId } from '../ecs/types.js';

export interface SetBonus {
  setName: string;
  setDisplayName: string;
  count: number;
  description: string;
  modifiers: Record<string, number>;
}

export const SET_DEFINITIONS: Record<string, { name: string; bonuses: Record<number, { description: string; modifiers: Record<string, number> }> }> = {
  ironclad: {
    name: 'Ironclad Bulwark',
    bonuses: {
      2: { description: '+6 Armor', modifiers: { 'CombatStats.armor': 6 } },
      3: { description: '+14 Armor, +20 Max HP', modifiers: { 'CombatStats.armor': 14, 'Health.max': 20 } },
    },
  },
  shadow: {
    name: 'Shadowstalker',
    bonuses: {
      2: { description: '+25% Speed, +4 Strength', modifiers: { 'Energy.speed': 25, 'CombatStats.strength': 4 } },
      3: { description: '+50% Speed, +10 Strength', modifiers: { 'Energy.speed': 50, 'CombatStats.strength': 10 } },
    },
  },
  archmage: {
    name: 'Archmage Regalia',
    bonuses: {
      2: { description: '+6 Spell Strength, +15 Max HP', modifiers: { 'CombatStats.strength': 6, 'Health.max': 15 } },
      3: { description: '+14 Spell Strength, Enhanced Power', modifiers: { 'CombatStats.strength': 14 } },
    },
  },
};

export class InventoryService {
  constructor(private world: World) {}

  /** Normalize slot aliases (e.g. main_hand -> weapon, off_hand -> offhand) */
  normalizeSlot(slot: string): string {
    if (slot === 'main_hand') return 'weapon';
    if (slot === 'off_hand') return 'offhand';
    return slot;
  }

  // --- Currency (Gold) ---

  getGold(entity: Entity): number {
    const goldComp = entity.components.get('Gold') as { amount?: number } | undefined;
    const inv = entity.components.get('Inventory') as { gold?: number } | undefined;
    return (inv?.gold ?? 0) + (goldComp?.amount ?? 0);
  }

  addGold(entity: Entity, amount: number): void {
    let inv = entity.components.get('Inventory') as { gold?: number; items: EntityId[]; maxSlots: number } | undefined;
    if (!inv) {
      inv = { gold: 0, items: [], maxSlots: 16 };
      entity.components.set('Inventory', inv as any);
    }
    const goldComp = entity.components.get('Gold') as { amount?: number } | undefined;
    if (goldComp?.amount) {
      inv.gold = (inv.gold || 0) + goldComp.amount;
      entity.components.delete('Gold');
    }
    inv.gold = (inv.gold || 0) + amount;
  }

  spendGold(entity: Entity, amount: number): boolean {
    const current = this.getGold(entity);
    if (current < amount) return false;
    let inv = entity.components.get('Inventory') as { gold?: number; items?: EntityId[] } | undefined;
    if (!inv) {
      inv = { gold: current, items: [] };
      entity.components.set('Inventory', inv);
    }
    entity.components.delete('Gold');
    inv!.gold = current - amount;
    return true;
  }

  // --- Backpack Storage ---

  getBackpack(entity: Entity): Entity[] {
    const inv = entity.components.get('Inventory') as { items?: EntityId[] } | undefined;
    if (!inv || !inv.items) return [];
    return inv.items.map(id => this.world.getEntity(id)).filter((e): e is Entity => Boolean(e));
  }

  addToBackpack(entity: Entity, item: Entity): boolean {
    let inv = entity.components.get('Inventory') as { items: EntityId[]; maxSlots: number; gold: number } | undefined;
    if (!inv) {
      inv = { items: [], maxSlots: 16, gold: 0 };
      entity.components.set('Inventory', inv as any);
    }

    if (inv.items.length >= (inv.maxSlots || 16)) {
      return false; // Backpack full
    }

    // Hide from floor map
    item.components.delete('Position');
    item.components.delete('Renderable');
    item.components.delete('Glyph');

    if (!inv.items.includes(item.id)) {
      inv.items.push(item.id);
    }
    return true;
  }

  removeFromBackpack(entity: Entity, itemId: EntityId): Entity | undefined {
    const inv = entity.components.get('Inventory') as { items?: EntityId[] } | undefined;
    if (!inv || !inv.items) return undefined;

    const idx = inv.items.indexOf(itemId);
    if (idx === -1) return undefined;

    inv.items.splice(idx, 1);
    return this.world.getEntity(itemId);
  }

  // --- Equipment Slots (weapon, offhand, armor, helm, ring) ---

  equip(entity: Entity, item: Entity, slotInput: string): boolean {
    const slot = this.normalizeSlot(slotInput);
    let eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) {
      eq = { slots: {} };
      entity.components.set('Equipment', eq);
    }

    const equippable = item.components.get('Equippable') as { slot: string; modifiers: Record<string, number> } | undefined;
    if (!equippable) return false;
    const itemSlot = this.normalizeSlot(equippable.slot);
    if (itemSlot !== slot) return false;

    // Unequip currently equipped item into backpack
    if (eq.slots[slot]) {
      this.unequip(entity, slot);
    }

    // Remove from backpack if equipping from backpack
    this.removeFromBackpack(entity, item.id);

    // Hide from map
    item.components.delete('Position');
    item.components.delete('Renderable');
    item.components.delete('Glyph');

    eq.slots[slot] = item.id;
    return true;
  }

  unequip(entity: Entity, slotInput: string): boolean {
    const slot = this.normalizeSlot(slotInput);
    const eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq || !eq.slots[slot]) return false;

    const itemId = eq.slots[slot];
    eq.slots[slot] = null;

    if (itemId) {
      const item = this.world.getEntity(itemId);
      if (item) {
        this.addToBackpack(entity, item);
      }
    }
    return true;
  }

  getEquipped(entity: Entity): Record<string, Entity | undefined> {
    const eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) return {};

    const result: Record<string, Entity | undefined> = {};
    for (const [slot, id] of Object.entries(eq.slots)) {
      const norm = this.normalizeSlot(slot);
      result[norm] = id ? this.world.getEntity(id) : undefined;
    }
    return result;
  }

  /** Calculate total additive modifiers from all 5 equipped slots + active set bonuses */
  getEquipmentModifiers(entity: Entity): Record<string, number> {
    const totalMods: Record<string, number> = {};
    const eq = entity.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) return totalMods;

    // 1. Direct item modifiers
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

    // 2. Additive Set bonuses
    const setBonuses = this.getActiveSetBonuses(entity);
    for (const sb of setBonuses) {
      for (const [path, mod] of Object.entries(sb.modifiers)) {
        totalMods[path] = (totalMods[path] || 0) + mod;
      }
    }

    return totalMods;
  }

  /** Evaluate active gear set bonuses for equipped items */
  getActiveSetBonuses(entity: Entity): SetBonus[] {
    const equipped = this.getEquipped(entity);
    const setCounts: Record<string, number> = {};

    for (const item of Object.values(equipped)) {
      if (!item) continue;
      const setComp = item.components.get('SetItem') as { setName: string } | undefined;
      if (setComp?.setName) {
        setCounts[setComp.setName] = (setCounts[setComp.setName] || 0) + 1;
      }
    }

    const active: SetBonus[] = [];
    for (const [setName, count] of Object.entries(setCounts)) {
      const setDef = SET_DEFINITIONS[setName];
      if (!setDef) continue;

      // Find highest tier bonus matched
      let bestTier = 0;
      for (const tierStr of Object.keys(setDef.bonuses)) {
        const tier = Number(tierStr);
        if (count >= tier && tier > bestTier) {
          bestTier = tier;
        }
      }

      if (bestTier > 0) {
        const b = setDef.bonuses[bestTier];
        active.push({
          setName,
          setDisplayName: setDef.name,
          count,
          description: `(${count}-piece) ${b.description}`,
          modifiers: b.modifiers,
        });
      }
    }

    return active;
  }

  /** Use a consumable item (Health Potion, Speed Potion, Scroll of Teleport) */
  useConsumable(entity: Entity, itemOrId: Entity | EntityId): { success: boolean; message: string; heal?: number; speedTurns?: number; teleport?: boolean } {
    const item = typeof itemOrId === 'string' ? this.world.getEntity(itemOrId) : itemOrId;
    if (!item) return { success: false, message: 'Item not found.' };
    const itemId = item.id;

    const desc = (item.components.get('Description') as any)?.name || 'Consumable';
    const consumable = item.components.get('Consumable') as { effect: string; value: number } | undefined;
    const healthPack = item.components.get('HealthPack') as { healAmount: number } | undefined;

    // 1. Health restore
    if (consumable?.effect === 'heal' || healthPack) {
      const healAmount = consumable?.value || healthPack?.healAmount || 35;
      const health = entity.components.get('Health') as { current: number; max: number } | undefined;
      if (!health) return { success: false, message: 'No health component.' };

      const oldHp = health.current;
      health.current = Math.min(health.max, health.current + healAmount);
      const actualHeal = health.current - oldHp;

      this.removeFromBackpack(entity, itemId);
      this.world.queueDestroy(itemId);
      this.world.flush();

      return {
        success: true,
        message: `Drank ${desc}, restoring +${actualHeal} HP!`,
        heal: actualHeal,
      };
    }

    // 2. Speed boost potion
    if (consumable?.effect === 'speed') {
      const duration = consumable.value || 15;
      this.removeFromBackpack(entity, itemId);
      this.world.queueDestroy(itemId);
      this.world.flush();

      return {
        success: true,
        message: `Drank ${desc}! Speed surged by +50% for ${duration} turns!`,
        speedTurns: duration,
      };
    }

    // 3. Teleport scroll
    if (consumable?.effect === 'teleport') {
      this.removeFromBackpack(entity, itemId);
      this.world.queueDestroy(itemId);
      this.world.flush();

      return {
        success: true,
        message: `Invoked ${desc}! Reality shifts around you!`,
        teleport: true,
      };
    }

    return { success: false, message: 'Item cannot be consumed.' };
  }
}

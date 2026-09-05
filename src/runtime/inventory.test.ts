import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { InventoryService } from './inventory.js';

describe('InventoryService', () => {
  let world: World;
  let inventory: InventoryService;

  beforeEach(() => {
    world = new World();
    world.registerBlueprints({
      'player': {},
      'sword': {}
    });
    inventory = new InventoryService(world);
  });

  it('should calculate equipment modifiers', () => {
    const sword = world.spawn('sword', { 
      Equippable: { slot: 'main_hand', modifiers: { 'CombatStats.strength': 5 } } 
    });
    const player = world.spawn('player', {
      CombatStats: { strength: 10 },
      Equipment: { slots: {} }
    });

    inventory.equip(player, sword, 'main_hand');
    
    const mods = inventory.getEquipmentModifiers(player);
    expect(mods['CombatStats.strength']).toBe(5);
  });

  it('should handle unequipped slots', () => {
    const player = world.spawn('player', { Equipment: { slots: {} } });
    const mods = inventory.getEquipmentModifiers(player);
    expect(mods).toEqual({});
  });

  it('manages backpack and 5-slot equipment', () => {
    const helm = world.spawn('sword', {
      Equippable: { slot: 'helm', modifiers: { 'CombatStats.armor': 3 } }
    });
    const plate = world.spawn('sword', {
      Equippable: { slot: 'armor', modifiers: { 'CombatStats.armor': 8 } }
    });
    const ring = world.spawn('sword', {
      Equippable: { slot: 'ring', modifiers: { 'CombatStats.strength': 4 } }
    });
    const player = world.spawn('player', { Equipment: { slots: {} } });

    inventory.addToBackpack(player, helm);
    expect(inventory.getBackpack(player)).toHaveLength(1);

    inventory.equip(player, helm, 'helm');
    inventory.equip(player, plate, 'armor');
    inventory.equip(player, ring, 'ring');

    const equipped = inventory.getEquipped(player);
    expect(equipped.helm?.id).toBe(helm.id);
    expect(equipped.armor?.id).toBe(plate.id);
    expect(equipped.ring?.id).toBe(ring.id);

    const mods = inventory.getEquipmentModifiers(player);
    expect(mods['CombatStats.armor']).toBe(11);
    expect(mods['CombatStats.strength']).toBe(4);
  });

  it('evaluates additive gear set bonuses', () => {
    const ironHelm = world.spawn('sword', {
      Equippable: { slot: 'helm', modifiers: { 'CombatStats.armor': 2 } },
      SetItem: { setName: 'ironclad', pieceName: 'Ironclad Helm' }
    });
    const ironPlate = world.spawn('sword', {
      Equippable: { slot: 'armor', modifiers: { 'CombatStats.armor': 6 } },
      SetItem: { setName: 'ironclad', pieceName: 'Ironclad Plate' }
    });
    const player = world.spawn('player', { Equipment: { slots: {} } });

    inventory.equip(player, ironHelm, 'helm');
    inventory.equip(player, ironPlate, 'armor');

    const bonuses = inventory.getActiveSetBonuses(player);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].setName).toBe('ironclad');
    expect(bonuses[0].count).toBe(2);

    // 2 direct item armor (2 + 6 = 8) + 2-piece set bonus (6) = 14 Armor total!
    const totalMods = inventory.getEquipmentModifiers(player);
    expect(totalMods['CombatStats.armor']).toBe(14);
  });

  it('handles gold currency and consumables', () => {
    const player = world.spawn('player', {
      Health: { current: 30, max: 100 },
      Inventory: { gold: 50, items: [], maxSlots: 16 }
    });

    inventory.addGold(player, 40);
    expect(inventory.getGold(player)).toBe(90);
    expect(inventory.spendGold(player, 70)).toBe(true);
    expect(inventory.getGold(player)).toBe(20);
    expect(inventory.spendGold(player, 50)).toBe(false);

    const potion = world.spawn('sword', {
      Consumable: { effect: 'heal', value: 40 },
      Description: { name: 'Health Draught' }
    });
    inventory.addToBackpack(player, potion);
    const result = inventory.useConsumable(player, potion.id);

    expect(result.success).toBe(true);
    expect((player.components.get('Health') as any).current).toBe(70);
  });
});

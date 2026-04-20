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
});

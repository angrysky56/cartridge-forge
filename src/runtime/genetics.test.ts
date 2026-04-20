import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { GeneticsService } from './genetics.js';

describe('GeneticsService', () => {
  let world: World;
  let genetics: GeneticsService;

  beforeEach(() => {
    world = new World();
    world.registerBlueprints({
      'pA': {},
      'pB': {}
    });
    genetics = new GeneticsService(world);
    genetics.setTraits({
      'Strength': {
        path: 'CombatStats.strength',
        mutation_rate: 0, // No mutation for deterministic tests
        mutation_range: 0
      }
    });
  });

  it('should average stats from parents', () => {
    const parentA = world.spawn('pA', { CombatStats: { strength: 10 } });
    const parentB = world.spawn('pB', { CombatStats: { strength: 20 } });

    const overrides = genetics.breed(parentA, parentB);
    expect(overrides['CombatStats'].strength).toBe(15);
  });

  it('should handle missing components in one parent', () => {
    const parentA = world.spawn('pA', { CombatStats: { strength: 10 } });
    const parentB = world.spawn('pB', {});

    const overrides = genetics.breed(parentA, parentB);
    // Should use the one parent's value if other is missing
    expect(overrides['CombatStats'].strength).toBe(10);
  });
});

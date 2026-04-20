import { describe, it, expect, beforeEach } from 'vitest';
import { World } from './world.js';

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('should register blueprints and spawn entities', () => {
    world.registerComponentDefinitions({
      Health: { name: 'Health', fields: { current: 'number' }, persistent: true },
      Position: { name: 'Position', fields: { x: 'number' }, persistent: true }
    });
    world.registerBlueprints({
      player: {
        Health: { current: 100, max: 100 },
        Position: { x: 0, y: 0 }
      }
    });

    const player = world.spawn('player');
    expect(player.id).toContain('player_');
    expect(player.components.get('Health')).toEqual({ current: 100, max: 100 });
    expect(player.persistent).toBe(true);
  });

  it('should handle non-persistent entities', () => {
    world.registerComponentDefinitions({
      VFX: { name: 'VFX', fields: { type: 'string' }, persistent: false }
    });
    world.registerBlueprints({
      spark: {
        VFX: { type: 'fire' }
      }
    });

    const spark = world.spawn('spark');
    expect(spark.persistent).toBe(false);
  });

  it('should apply overrides when spawning', () => {
    world.registerBlueprints({
      orc: {
        Health: { current: 20, max: 20 }
      }
    });

    const woundedOrc = world.spawn('orc', {
      Health: { current: 10 }
    });

    expect(woundedOrc.components.get('Health')).toEqual({ current: 10, max: 20 });
  });

  it('should query entities by components', () => {
    world.registerBlueprints({
      ghost: {
        Position: { x: 5, y: 5 }
      },
      warrior: {
        Position: { x: 1, y: 1 },
        Health: { current: 50, max: 50 }
      }
    });

    world.spawn('ghost');
    world.spawn('warrior');

    const posOnly = world.query('Position');
    expect(posOnly.length).toBe(2);

    const posAndHealth = world.query('Position', 'Health');
    expect(posAndHealth.length).toBe(1);
    expect(posAndHealth[0].id).toContain('warrior');
  });

  it('should resolve and set component paths', () => {
    world.registerBlueprints({
      hero: {
        Stats: { strength: 10, luck: { level: 1 } }
      }
    });

    const hero = world.spawn('hero');
    
    // Resolve
    expect(world.resolveComponentPath(hero, 'Stats.strength')).toBe(10);
    expect(world.resolveComponentPath(hero, 'Stats.luck.level')).toBe(1);

    // Set
    world.setComponentPath(hero, 'Stats.strength', 15);
    world.setComponentPath(hero, 'Stats.luck.level', 2);

    expect(world.resolveComponentPath(hero, 'Stats.strength')).toBe(15);
    expect(world.resolveComponentPath(hero, 'Stats.luck.level')).toBe(2);
  });

  it('should process destruction queue on flush', () => {
    world.registerBlueprints({ tile: {} });
    const t = world.spawn('tile');
    
    world.queueDestroy(t.id);
    expect(world.getEntity(t.id)).toBeDefined();
    
    world.flush();
    expect(world.getEntity(t.id)).toBeUndefined();
  });
});

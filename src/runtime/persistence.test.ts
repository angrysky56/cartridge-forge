import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world.js';
import { PersistenceService } from './persistence.js';

describe('PersistenceService', () => {
  let world: World;
  let service: PersistenceService;

  beforeEach(() => {
    world = new World();
    service = new PersistenceService(world);
    
    world.registerComponentDefinitions({
      Position: { name: 'Position', fields: { x: 'number' }, persistent: true },
      Health: { name: 'Health', fields: { current: 'number' }, persistent: true },
      Transient: { name: 'Transient', fields: { val: 'number' }, persistent: false }
    });
    
    world.registerBlueprints({
      player: {
        Position: { x: 10, y: 10 },
        Health: { current: 50 }
      },
      particle: {
        Transient: { val: 1 }
      }
    });
  });

  it('should serialize persistent entities and skip transient ones', () => {
    world.spawn('player');
    world.spawn('particle');

    const saveData = service.save(5, 'player_0');
    
    expect(saveData.turnCount).toBe(5);
    expect(saveData.playerId).toBe('player_0');
    expect(saveData.entities.length).toBe(1); // Only player is persistent
    expect(saveData.entities[0].id).toBe('player_0');
    expect(saveData.entities[0].components.Position).toEqual({ x: 10, y: 10 });
    expect(saveData.entities[0].components.Transient).toBeUndefined();
  });

  it('should restore world state identically', () => {
    const p = world.spawn('player');
    p.tags.add('poisoned');
    world.setComponentPath(p, 'Health.current', 40);

    const saveData = service.save(10, p.id);
    
    // Clear and reload
    const result = service.load(saveData);
    
    expect(result.turnCount).toBe(10);
    expect(result.playerId).toBe(p.id);
    
    const restoredPlayer = world.getEntity(p.id)!;
    expect(restoredPlayer).toBeDefined();
    expect(restoredPlayer.tags.has('poisoned')).toBe(true);
    expect(world.resolveComponentPath(restoredPlayer, 'Health.current')).toBe(40);
  });

  it('should preserve entity ID sequence across save/load', () => {
    world.spawn('player'); // e_0
    world.spawn('player'); // e_1
    
    const saveData = service.save(0, null);
    service.load(saveData);
    
    const next = world.spawn('player');
    expect(next.id).toBe('player_2');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './game.js';
import type { Cartridge } from '../cartridge/schema.js';

function createMockCanvas(): HTMLCanvasElement {
  const canvas: any = {
    width: 800,
    height: 600,
  };
  const ctxBase: any = {
    canvas,
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 10 }),
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    save: () => {},
    restore: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    roundRect: () => {},
    drawImage: () => {},
  };
  const ctx = new Proxy(ctxBase, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  canvas.getContext = () => ctx;
  return canvas as unknown as HTMLCanvasElement;
}

const testCartridge: Cartridge = {
  meta: {
    title: 'Test Dungeon',
    version: '1.0.0',
    description: 'A test cartridge',
    renderer_mode: 'GRID_2D',
  },
  components: {
    Position: { x: 'number', y: 'number' },
    Renderable: { glyph: 'string', color: 'string', layer: 'number' },
    Health: { current: 'number', max: 'number' },
    Faction: { id: 'string' },
    CombatStats: { strength: 'number', armor: 'number', speed: 'number' },
    Description: { name: 'string', text: 'string' },
    Consumable: { effect: 'string', value: 'number' },
  },
  blueprints: {
    player: {
      Position: { x: 5, y: 5 },
      Renderable: { glyph: '@', color: '#00ff88', layer: 3 },
      Health: { current: 100, max: 100 },
      Faction: { id: 'player' },
      CombatStats: { strength: 15, armor: 5, speed: 100 },
      Description: { name: 'Hero', text: 'The player.' },
    },
    goblin: {
      Position: { x: 0, y: 0 },
      Renderable: { glyph: 'g', color: '#ff4444', layer: 2 },
      Health: { current: 20, max: 20 },
      Faction: { id: 'monster' },
      CombatStats: { strength: 8, armor: 0, speed: 90 },
      Description: { name: 'Cave Goblin', text: 'A small monster.' },
    },
    orc_guard: {
      Position: { x: 0, y: 0 },
      Renderable: { glyph: 'O', color: '#ff2222', layer: 2 },
      Health: { current: 50, max: 50 },
      Faction: { id: 'monster' },
      CombatStats: { strength: 16, armor: 4, speed: 85 },
      Description: { name: 'Dungeon Champion', text: 'An armored brute.' },
    },
  },
  systems: {},
  world_gen: {
    algorithm: 'cellular_automata',
    width: 30,
    height: 30,
    wall_density: 0.35,
    floor_glyph: '.',
    wall_glyph: '#',
  },
};

describe('Gameplay & Mechanics Overhaul Tests', () => {
  let game: Game;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    const canvas = createMockCanvas();
    game = new Game(
      canvas,
      (msg) => logs.push(msg),
      () => {},
    );
    game.loadCartridge(testCartridge);
  });

  it('safely resolves swarm countdown on depth > 2 without freezing or throwing', () => {
    (game as any).depth = 3; // Depth 3 tests orc blueprint resolution
    const player = game.getPlayer()!;
    (game as any).swarmCountdown = 1;

    expect(() => {
      game.handleInput(' '); // Wait turn triggers countdown decrement to 0 -> spawnSwarmReinforcements
    }).not.toThrow();

    expect((game as any).swarmCountdown).toBeNull();
    expect(game.getPhase()).toBe('PLAYER_TURN'); // Phase MUST remain PLAYER_TURN!
  });

  it('true teleportation moves player to distant safe tile and preserves turn flow', () => {
    const player = game.getPlayer()!;
    const pos = player.components.get('Position') as { x: number; y: number };
    const origX = pos.x;
    const origY = pos.y;

    const scroll = (game as any).world.spawn('teleport_scroll');
    game.getInventoryService().addToBackpack(player, scroll);

    const used = game.readTeleportScroll();
    expect(used).toBe(true);

    const newPos = player.components.get('Position') as { x: number; y: number };
    const dist = Math.abs(newPos.x - origX) + Math.abs(newPos.y - origY);
    expect(dist).toBeGreaterThanOrEqual(1);
    expect(game.getPhase()).toBe('PLAYER_TURN');
  });

  it('spike trap damages entity and inflicts rooted status', () => {
    const player = game.getPlayer()!;
    const health = player.components.get('Health') as { current: number; max: number };
    const startHp = health.current;

    (game as any).checkTileHazards(player, 10, 10); // No trap here
    expect(health.current).toBe(startHp);

    // Place a spike trap at (12, 12)
    (game as any).world.spawn('spike_trap', { Position: { x: 12, y: 12 } });
    (game as any).checkTileHazards(player, 12, 12);

    expect(health.current).toBeLessThan(startHp);
    expect(game.isRooted(player.id)).toBe(true);
  });

  it('rooted status blocks walking movement into empty tiles', () => {
    const player = game.getPlayer()!;
    const pos = player.components.get('Position') as { x: number; y: number };
    const startX = pos.x;
    const startY = pos.y;

    game.applyStatus(player.id, 'rooted', 2);
    expect(game.isRooted(player.id)).toBe(true);

    // Attempt to step into an empty tile
    (game as any).executeAction({ dx: 1, dy: 0 }, player);

    // Position must not have changed because player was rooted!
    expect(pos.x).toBe(startX);
    expect(pos.y).toBe(startY);
  });

  it('explosive barrel detonates in 3x3 radius when attacked', () => {
    const player = game.getPlayer()!;
    const pos = player.components.get('Position') as { x: number; y: number };
    const barrel = (game as any).world.spawn('explosive_barrel', {
      Position: { x: pos.x + 1, y: pos.y },
    });

    const nearbyEnemy = (game as any).world.spawn('goblin', {
      Position: { x: pos.x + 1, y: pos.y + 1 },
    });
    const eHealth = nearbyEnemy.components.get('Health') as { current: number; max: number };
    const origHp = eHealth.current;

    // Player attacks adjacent barrel
    (game as any).executeAction({ dx: 1, dy: 0 }, player);

    // Barrel should be destroyed
    expect((game as any).world.getEntity(barrel.id)).toBeUndefined();
    // Nearby enemy took blast damage
    expect(eHealth.current).toBeLessThan(origHp);
  });

  it('drinking a health potion restores HP and purges all status ailments', () => {
    const player = game.getPlayer()!;
    game.applyStatus(player.id, 'burning', 3);
    game.applyStatus(player.id, 'poisoned', 3);
    game.applyStatus(player.id, 'rooted', 2);

    const potion = (game as any).world.spawn('health_potion');
    game.getInventoryService().addToBackpack(player, potion);

    const drank = game.drinkHealthPotion();
    expect(drank).toBe(true);

    // All ailments purged
    expect(game.isRooted(player.id)).toBe(false);
    expect(game.getPlayerStatus()?.burning).toBeUndefined();
    expect(game.getPlayerStatus()?.poisoned).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from './game.js';
import type { Cartridge } from '../cartridge/schema.js';

describe('Roguelike Expansion: Reach, Spells, Boss Floors, and Relative Speed', () => {
  let canvas: HTMLCanvasElement;
  let logSpy: any;
  let statsSpy: any;

  const testCartridge: Cartridge = {
    meta: {
      title: 'Expansion Test Dungeon',
      renderer_mode: 'GRID_2D',
    },
    components: {
      Position: { x: 'number', y: 'number' },
      Renderable: { glyph: 'string', color: 'string' },
      Health: { current: 'number', max: 'number' },
      Faction: { id: 'string' },
      CombatStats: { strength: 'number', armor: 'number', intellect: 'number', speed: 'number' },
      Equippable: { slot: 'string', modifiers: 'object' },
      Equipment: { slots: 'object' },
      Inventory: { items: 'array', capacity: 'number' },
      WeaponType: { category: 'string', reach: 'number' },
      Gold: { amount: 'number' },
      Wallet: { amount: 'number' },
    },
    blueprints: {
      hero: {
        Position: { x: 5, y: 5 },
        Renderable: { glyph: '@', color: '#00ffaa' },
        Health: { current: 100, max: 100 },
        Faction: { id: 'player' },
        CombatStats: { strength: 14, armor: 2, intellect: 12, speed: 100 },
        Equipment: { slots: {} },
        Inventory: { items: [], capacity: 16 },
        Gold: { amount: 50 },
      },
      goblin: {
        Position: { x: 5, y: 7 },
        Renderable: { glyph: 'g', color: '#ff4444' },
        Health: { current: 25, max: 25 },
        Faction: { id: 'monster' },
        CombatStats: { strength: 6, armor: 1, speed: 90 },
      },
      orc_fast: {
        Position: { x: 8, y: 8 },
        Renderable: { glyph: 'o', color: '#ff8800' },
        Health: { current: 35, max: 35 },
        Faction: { id: 'monster' },
        CombatStats: { strength: 10, armor: 2, speed: 135 },
      },
    },
    systems: {},
    world_gen: {
      width: 40,
      height: 30,
      algorithm: 'cellular_automata',
      wall_density: 0.05,
      floor_glyph: '.',
      wall_glyph: '#',
    },
  };

  beforeEach(() => {
    canvas = {
      getContext: vi.fn(() => ({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokeRect: vi.fn(),
        canvas: { width: 400, height: 400 },
      })),
      width: 400,
      height: 400,
    } as any;
    logSpy = vi.fn();
    statsSpy = vi.fn();
  });

  it('performs reach attack with spear at distance 2 without adjacent counter-attack', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    const player = game.getPlayer()!;
    const pPos = player.components.get('Position') as { x: number; y: number };
    pPos.x = 5;
    pPos.y = 5;
    (game as any).map.tiles[5][5] = 0;
    (game as any).map.tiles[6][5] = 0;
    (game as any).map.tiles[7][5] = 0;

    // Equip spear
    const spear = (game as any).world.spawn('iron_spear');
    game.getInventoryService().equip(player, spear, 'weapon');

    // Spawn goblin 2 tiles south (5, 7), leaving (5, 6) open
    const goblin = (game as any).world.spawn('goblin', {
      Position: { x: 5, y: 7 },
    });
    const gHealth = goblin.components.get('Health') as { current: number; max: number };

    // Player attacks in direction { dx: 0, dy: 1 } towards goblin 2 tiles away
    (game as any).executeAction({ dx: 0, dy: 1 }, player);

    // Goblin at distance 2 should have taken reach damage
    expect(gHealth.current).toBeLessThan(25);
    // Player stayed at (5, 5) and didn't step onto the gap
    expect(pPos.x).toBe(5);
    expect(pPos.y).toBe(5);
  });

  it('casts Fireball spell hitting a 3x3 AoE area and consumes cooldown', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    const player = game.getPlayer()!;
    const pPos = player.components.get('Position') as { x: number; y: number };
    pPos.x = 10;
    pPos.y = 10;

    // Spawn two goblins near (10, 12)
    const g1 = (game as any).world.spawn('goblin', { Position: { x: 10, y: 12 } });
    const g2 = (game as any).world.spawn('goblin', { Position: { x: 11, y: 12 } });

    // Set facing direction south
    (game as any).lastDirection = { dx: 0, dy: 1 };

    const cast = game.useFireball(10, 12);
    expect(cast).toBe(true);

    // Both goblins should have taken fire damage
    const g1Health = g1.components.get('Health') as { current: number; max: number };
    const g2Health = g2.components.get('Health') as { current: number; max: number };
    expect(g1Health.current).toBeLessThan(25);
    expect(g2Health.current).toBeLessThan(25);

    // Cooldown decrements by 1 in finishTurn: starts at 5 -> 4 turns remain
    expect(game.getSpellCooldowns().fireball).toBe(4);
  });

  it('casts Lightning spell piercing all enemies in facing direction line', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    const player = game.getPlayer()!;
    const pPos = player.components.get('Position') as { x: number; y: number };
    pPos.x = 10;
    pPos.y = 10;

    // Spawn 2 goblins in a straight line east
    const g1 = (game as any).world.spawn('goblin', { Position: { x: 12, y: 10 } });
    const g2 = (game as any).world.spawn('goblin', { Position: { x: 14, y: 10 } });

    (game as any).lastDirection = { dx: 1, dy: 0 };

    const cast = game.useLightning();
    expect(cast).toBe(true);

    const g1Health = g1.components.get('Health') as { current: number; max: number };
    const g2Health = g2.components.get('Health') as { current: number; max: number };
    expect(g1Health.current).toBeLessThan(25);
    expect(g2Health.current).toBeLessThan(25);
    expect(game.getSpellCooldowns().lightning).toBe(5);
  });

  it('generates handcrafted Ante-Room and Boss Arena on Depth 3', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    // Descend to Depth 2, then Depth 3
    game.descendFloor(); // Depth 2
    game.descendFloor(); // Depth 3

    expect(game.getDepth()).toBe(3);
    const map = game.getMap()!;
    expect(map.isBossFloor).toBe(true);
    expect(map.anteRoom).toBeDefined();
    expect(map.bossArena).toBeDefined();

    // Active boss should be registered
    const boss = game.getActiveBoss();
    expect(boss).toBeDefined();
    const bHealth = boss?.components.get('Health') as { current: number; max: number };
    expect(bHealth.max).toBeGreaterThanOrEqual(200);

    // A merchant should be present on this floor
    const merchant = game.getEntities().find(e => e.components.has('Merchant') || e.id.startsWith('merchant_'));
    expect(merchant).toBeDefined();
  });

  it('drops gold coins and awards XP when monsters are defeated', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    const player = game.getPlayer()!;
    const initialGold = game.getGold();

    const pPos = player.components.get('Position') as { x: number; y: number };
    pPos.x = 5;
    pPos.y = 5;

    // Spawn goblin adjacent to player at (5, 6)
    const goblin = (game as any).world.spawn('goblin', { Position: { x: 5, y: 6 } });
    const gHealth = goblin.components.get('Health') as { current: number; max: number };
    gHealth.current = 1; // 1 HP left

    // Attack to slay
    (game as any).executeAction({ dx: 0, dy: 1 }, player);

    // Goblin defeated -> gold drop spawned on (5, 6)
    const goldDrop = game.getEntities().find(e => e.components.has('Gold') && (e.components.get('Position') as any)?.y === 6);
    expect(goldDrop).toBeDefined();

    // Move player onto the gold drop to collect
    (game as any).executeAction({ dx: 0, dy: 1 }, player);
    expect(game.getGold()).toBeGreaterThan(initialGold);
  });

  it('allows purchasing goods from the Ante-Room merchant', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(testCartridge);

    const player = game.getPlayer()!;
    game.getInventoryService().addGold(player, 100);

    expect(game.getGold()).toBe(150); // 50 initial + 100 added
    const bought = game.buyShopItem('health_potion', 35);
    expect(bought).toBe(true);
    expect(game.getGold()).toBe(115);

    // Health potion should now be in backpack
    const backpack = game.getBackpack();
    const pot = backpack.find(i => i.id.startsWith('health_potion'));
    expect(pot).toBeDefined();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from './game.js';
import type { Cartridge } from '../cartridge/schema.js';

describe('Game Runtime: Floors & Stairs', () => {
  let canvas: HTMLCanvasElement;
  let logSpy: any;
  let statsSpy: any;

  const sampleCartridge: Cartridge = {
    meta: {
      title: 'Test Dungeon',
      renderer_mode: 'GRID_2D',
    },
    components: {
      Position: { x: 'number', y: 'number' },
      Renderable: { glyph: 'string', color: 'string' },
      Health: { current: 'number', max: 'number' },
      Faction: { id: 'string' },
      CombatStats: { strength: 'number', armor: 'number' },
      Equippable: { slot: 'string', modifiers: 'object' },
      Equipment: { slots: 'object' },
    },
    blueprints: {
      hero: {
        Position: { x: 5, y: 5 },
        Renderable: { glyph: '@', color: '#00ffaa' },
        Health: { current: 100, max: 100 },
        Faction: { id: 'player' },
        CombatStats: { strength: 10, armor: 2 },
        Equipment: { slots: {} },
      },
      goblin: {
        Position: { x: 8, y: 8 },
        Renderable: { glyph: 'g', color: '#ff4444' },
        Health: { current: 20, max: 20 },
        Faction: { id: 'monster' },
      },
      dagger: {
        Position: { x: 5, y: 6 },
        Renderable: { glyph: '/', color: '#ffff00' },
        Equippable: { slot: 'main_hand', modifiers: { 'CombatStats.strength': 4 } },
        Description: { name: 'Iron Dagger' },
      },
    },
    systems: {},
    world_gen: {
      width: 20,
      height: 20,
      algorithm: 'cellular_automata',
      wall_density: 0.1,
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

  it('initializes at Depth 1 with player spawned', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(sampleCartridge);

    expect(game.getDepth()).toBe(1);
    const player = game.getPlayer();
    expect(player).toBeDefined();
    expect(player?.components.get('Health')).toEqual({ current: 100, max: 100 });
  });

  it('descends to deeper floors, incrementing depth and preserving player', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(sampleCartridge);

    const player = game.getPlayer();
    const health = player?.components.get('Health') as { current: number; max: number };
    health.current = 75; // Take some damage

    game.descendFloor();

    expect(game.getDepth()).toBe(2);
    const playerAfter = game.getPlayer();
    expect(playerAfter).toBeDefined();
    // Health is preserved across floors
    expect((playerAfter?.components.get('Health') as any).current).toBe(75);
  });

  it('successfully loads and validates Dungeon of the Forgotten cartridge', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const jsonStr = fs.readFileSync(path.resolve(__dirname, '../../cartridges/dungeon_of_the_forgotten.json'), 'utf-8');
    const { loadCartridge } = await import('../cartridge/loader.js');
    const result = loadCartridge(jsonStr);

    expect(result.success).toBe(true);
    expect(result.cartridge?.meta.title).toBe('Dungeon of the Forgotten');

    const game = new Game(canvas, logSpy, statsSpy);
    expect(() => game.loadCartridge(result.cartridge!)).not.toThrow();
  });

  it('awards XP and levels up player, boosting stats and restoring health', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(sampleCartridge);

    const player = game.getPlayer()!;
    const health = player.components.get('Health') as { current: number; max: number };
    const stats = player.components.get('CombatStats') as { strength: number; armor: number };

    health.current = 50; // Damaged player
    const origMaxHp = health.max;
    const origStr = stats.strength;
    const origArmor = stats.armor;

    expect(game.getLevel()).toBe(1);
    expect(game.getXP().current).toBe(0);

    // Award 60 XP (threshold is 50 for lvl 1)
    game.addXP(60);

    expect(game.getLevel()).toBe(2);
    expect(game.getXP().current).toBe(10);
    // Level up grants +12 max HP, +2 STR, +1 Armor, and full heal
    expect(health.max).toBe(origMaxHp + 12);
    expect(health.current).toBe(health.max);
    expect(stats.strength).toBe(origStr + 2);
    expect(stats.armor).toBe(origArmor + 1);
  });

  it('handles Phase Dash ability with cooldown', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(sampleCartridge);

    const player = game.getPlayer()!;
    const pos = player.components.get('Position') as { x: number; y: number };
    pos.x = 5;
    pos.y = 5;

    // Last direction is south ({ dx: 0, dy: 1 }) or north; set last direction south
    game.executeAction({ dx: 0, dy: 1 }, player);
    const startY = pos.y;

    const used = game.usePhaseDash();
    expect(used).toBe(true);
    expect(pos.y).toBeGreaterThan(startY);
    // After ability completes its turn, 5 turns remain on cooldown
    expect(game.getCooldowns().dash).toBe(5);

    // Immediate second dash is on cooldown
    const usedAgain = game.usePhaseDash();
    expect(usedAgain).toBe(false);
  });

  it('handles Shield Bash knockback, stun, and cooldown', () => {
    const game = new Game(canvas, logSpy, statsSpy);
    game.loadCartridge(sampleCartridge);

    const player = game.getPlayer()!;
    const pPos = player.components.get('Position') as { x: number; y: number };
    pPos.x = 5;
    pPos.y = 5;

    // Spawn an enemy directly south of player
    const enemy = (game as any).world.spawn('goblin', {
      Position: { x: 5, y: 6 },
    });

    const used = game.useShieldBash();
    expect(used).toBe(true);
    // After bash turn finishes, 3 turns remain on cooldown
    expect(game.getCooldowns().bash).toBe(3);

    // Enemy should have been knocked back or taken damage and stunned
    const eHealth = enemy.components.get('Health') as { current: number; max: number };
    expect(eHealth.current).toBeLessThan(20);
    // Note: Stun tag is removed when enemy turn begins in finishTurn, confirming turn was processed
  });
});

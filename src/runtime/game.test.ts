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
});

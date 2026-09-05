import { describe, it, expect } from 'vitest';
import { validateCartridgeJson } from './validator.js';

describe('Forgemaster Validator', () => {
  it('catches syntax errors in malformed JSON', () => {
    const res = validateCartridgeJson('{ title: broken json }');
    expect(res.valid).toBe(false);
    expect(res.errors[0].path).toBe('JSON Syntax');
  });

  it('catches missing player blueprint', () => {
    const json = JSON.stringify({
      meta: { title: 'No Player Game', renderer_mode: 'GRID_2D' },
      components: { Position: { x: 'number' } },
      blueprints: {
        monster: {
          Position: { x: 0 },
          Faction: { id: 'monster' },
        },
      },
      systems: {},
      world_gen: { width: 10, height: 10, algorithm: 'cellular_automata' },
    });

    const res = validateCartridgeJson(json);
    expect(res.valid).toBe(false);
    expect(res.errors[0].message).toContain('No player blueprint');
  });

  it('passes on valid cartridge', () => {
    const json = JSON.stringify({
      meta: { title: 'Valid Game', renderer_mode: 'GRID_2D' },
      components: { Position: { x: 'number' } },
      blueprints: {
        hero: {
          Position: { x: 0 },
          Faction: { id: 'player' },
        },
      },
      systems: {},
      world_gen: { width: 10, height: 10, algorithm: 'cellular_automata' },
    });

    const res = validateCartridgeJson(json);
    expect(res.valid).toBe(true);
    expect(res.cartridge?.meta.title).toBe('Valid Game');
  });
});

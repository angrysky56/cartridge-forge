import { describe, it, expect } from 'vitest';
import { resolveEntitySymbol, ASCII_GLYPH_MAP } from './symbols.js';

describe('Symbols & Glyphs Resolution Service', () => {
  it('resolves player hero to wizard emoji', () => {
    const playerEntity = {
      Faction: { id: 'player' },
      Description: { name: 'Dungeon Delver' },
      Renderable: { glyph: '@', color: '#00ffcc' },
    };
    const resolved = resolveEntitySymbol(playerEntity);
    expect(resolved.symbol).toBe('🧙');
    expect(resolved.category).toBe('player');
  });

  it('resolves dungeon items by description name or slot', () => {
    // Weapon
    expect(resolveEntitySymbol({ Description: { name: 'Tempered Broadsword' } }).symbol).toBe('⚔️');
    expect(resolveEntitySymbol({ Description: { name: 'Iron Pike (Reach 2)' } }).symbol).toBe('🗡️');
    expect(resolveEntitySymbol({ Description: { name: 'Composite Bow' } }).symbol).toBe('🏹');
    expect(resolveEntitySymbol({ Description: { name: 'Archmage Staff' } }).symbol).toBe('🪄');

    // Armor & Gear
    expect(resolveEntitySymbol({ Description: { name: 'Ironclad Shield' } }).symbol).toBe('🛡️');
    expect(resolveEntitySymbol({ Description: { name: 'Forged Helm' } }).symbol).toBe('🪖');
    expect(resolveEntitySymbol({ Description: { name: 'Ironclad Plate' } }).symbol).toBe('🦺');
    expect(resolveEntitySymbol({ Description: { name: 'Shadow Ring' } }).symbol).toBe('💍');

    // Consumables & Loot
    expect(resolveEntitySymbol({ Description: { name: 'Health Elixir' } }).symbol).toBe('🧪');
    expect(resolveEntitySymbol({ Description: { name: 'Elixir of Swiftness' } }).symbol).toBe('⚡');
    expect(resolveEntitySymbol({ Description: { name: 'Scroll of Blink' } }).symbol).toBe('📜');
    expect(resolveEntitySymbol({ Description: { name: 'Gold Coins' } }).symbol).toBe('💰');
    expect(resolveEntitySymbol({ Description: { name: 'Treasure Chest' } }).symbol).toBe('📦');
  });

  it('resolves shrines and features', () => {
    expect(resolveEntitySymbol({ Description: { name: 'Sanctuary of Life' } }).symbol).toBe('💖');
    expect(resolveEntitySymbol({ Description: { name: 'Altar of Might' } }).symbol).toBe('⚔️');
    expect(resolveEntitySymbol({ Description: { name: 'Altar of Aegis' } }).symbol).toBe('🛡️');
    expect(resolveEntitySymbol({ Description: { name: 'Blood Altar' } }).symbol).toBe('🩸');
    expect(resolveEntitySymbol({ Description: { name: 'Dungeon Stairs' } }).symbol).toBe('🪜');
    expect(resolveEntitySymbol({ Description: { name: 'Cracked Secret Wall' } }).symbol).toBe('🧱');
  });

  it('resolves monsters and NPCs', () => {
    expect(resolveEntitySymbol({ Description: { name: 'Cave Goblin' } }).symbol).toBe('👺');
    expect(resolveEntitySymbol({ Description: { name: 'Goblin Hornblower' } }).symbol).toBe('📯');
    expect(resolveEntitySymbol({ Description: { name: 'Restless Skeleton' } }).symbol).toBe('💀');
    expect(resolveEntitySymbol({ Description: { name: 'Dungeon Champion' } }).symbol).toBe('👹');
    expect(resolveEntitySymbol({ Description: { name: 'Minotaur Crypt Lord' } }).symbol).toBe('🐂');
    expect(resolveEntitySymbol({ Description: { name: 'Lich King' } }).symbol).toBe('☠️');
    expect(resolveEntitySymbol({ Description: { name: 'Grimm the Peddler' } }).symbol).toBe('🧙‍♂️');
  });

  it('falls back to ASCII character map when no description name is provided', () => {
    expect(resolveEntitySymbol({ Renderable: { glyph: 'g' } }).symbol).toBe('👺');
    expect(resolveEntitySymbol({ Renderable: { glyph: 's' } }).symbol).toBe('💀');
    expect(resolveEntitySymbol({ Renderable: { glyph: 'O' } }).symbol).toBe('👹');
    expect(resolveEntitySymbol({ Renderable: { glyph: '/' } }).symbol).toBe('⚔️');
    expect(resolveEntitySymbol({ Renderable: { glyph: ']' } }).symbol).toBe('🛡️');
    expect(resolveEntitySymbol({ Renderable: { glyph: '^' } }).symbol).toBe('🪖');
    expect(resolveEntitySymbol({ Renderable: { glyph: '!' } }).symbol).toBe('🧪');
    expect(resolveEntitySymbol({ Renderable: { glyph: '$' } }).symbol).toBe('💰');
    expect(resolveEntitySymbol({ Renderable: { glyph: '>' } }).symbol).toBe('🪜');
  });
});

/**
 * Symbols & Glyphs Mapping Service
 * Converts keyboard ASCII characters and entity blueprints into
 * rich, thematic graphic symbols and emojis.
 */

import type { Entity } from '../ecs/types.js';

export interface EntitySymbolInfo {
  symbol: string;
  color: string;
  label: string;
  category: 'player' | 'monster' | 'item' | 'feature' | 'npc';
}

/** Fallback mapping from legacy ASCII characters to rich symbols */
export const ASCII_GLYPH_MAP: Record<string, { symbol: string; label: string; category: EntitySymbolInfo['category'] }> = {
  '@': { symbol: '🧙', label: 'Operator Hero', category: 'player' },
  'g': { symbol: '👺', label: 'Goblin Skirmisher', category: 'monster' },
  's': { symbol: '💀', label: 'Skeleton Warrior', category: 'monster' },
  'O': { symbol: '👹', label: 'Orc Champion', category: 'monster' },
  'h': { symbol: '📯', label: 'Goblin Horn Scout', category: 'monster' },
  'M': { symbol: '🐂', label: 'Minotaur Crypt Lord', category: 'monster' },
  'L': { symbol: '☠️', label: 'Lich King', category: 'monster' },
  '$': { symbol: '💰', label: 'Gold Coins', category: 'item' },
  '/': { symbol: '⚔️', label: 'Tempered Blade', category: 'item' },
  ']': { symbol: '🛡️', label: 'Bulwark Shield', category: 'item' },
  '^': { symbol: '🪖', label: 'Forged Helm', category: 'item' },
  '=': { symbol: '🦺', label: 'Plate Mail', category: 'item' },
  '!': { symbol: '🧪', label: 'Alchemical Potion', category: 'item' },
  '?': { symbol: '📜', label: 'Mystic Scroll', category: 'item' },
  '&': { symbol: '✨', label: 'Ancient Shrine', category: 'feature' },
  '>': { symbol: '🪜', label: 'Dungeon Stairs', category: 'feature' },
  '%': { symbol: '🦴', label: 'Skeletal Remains', category: 'feature' },
  '}': { symbol: '🏹', label: 'Composite Bow', category: 'item' },
  '#': { symbol: '🧱', label: 'Stone Wall', category: 'feature' },
  '.': { symbol: '▫️', label: 'Dungeon Floor', category: 'feature' },
};

/**
 * Resolves the visual symbol, color, and metadata for an entity or blueprint.
 */
export function resolveEntitySymbol(entity: Entity | Record<string, any>): EntitySymbolInfo {
  // 1. Extract components
  const components = 'components' in entity && entity.components instanceof Map
    ? entity.components
    : new Map(Object.entries(entity));

  const rend = components.get('Renderable') as { glyph?: string; color?: string } | undefined;
  const glyphComp = components.get('Glyph') as { char?: string; color?: string } | undefined;
  const faction = components.get('Faction') as { id?: string } | undefined;
  const desc = components.get('Description') as { name?: string; text?: string } | undefined;
  const equippable = components.get('Equippable') as { slot?: string } | undefined;
  const healthPack = components.get('HealthPack');
  const gold = components.get('Gold');

  const rawGlyph = rend?.glyph || glyphComp?.char || '';
  const color = rend?.color || glyphComp?.color || '#ffffff';
  const name = desc?.name?.toLowerCase() || '';

  // 2. Check if player
  if (faction?.id === 'player') {
    return {
      symbol: '🧙',
      color: '#00ffaa',
      label: desc?.name || 'Operator Hero',
      category: 'player',
    };
  }

  // 3. Resolve by specific name / title keywords
  if (name.includes('sanctuary of life')) {
    return { symbol: '💖', color: '#00ff88', label: 'Sanctuary of Life', category: 'feature' };
  }
  if (name.includes('altar of might')) {
    return { symbol: '⚔️', color: '#ff3344', label: 'Altar of Might', category: 'feature' };
  }
  if (name.includes('altar of aegis')) {
    return { symbol: '🛡️', color: '#00f0ff', label: 'Altar of Aegis', category: 'feature' };
  }
  if (name.includes('blood altar')) {
    return { symbol: '🩸', color: '#ff0055', label: 'Blood Altar', category: 'feature' };
  }
  if (name.includes('shrine') || name.includes('altar')) {
    return { symbol: '✨', color: '#ff00ea', label: desc?.name || 'Ancient Shrine', category: 'feature' };
  }
  if (name.includes('stair') || name.includes('descent')) {
    return { symbol: '🪜', color: '#ffd700', label: desc?.name || 'Dungeon Stairs', category: 'feature' };
  }
  if (name.includes('chest')) {
    return { symbol: '📦', color: '#ffd700', label: desc?.name || 'Treasure Chest', category: 'feature' };
  }
  if (name.includes('cracked')) {
    return { symbol: '🧱', color: '#aa9977', label: desc?.name || 'Cracked Secret Wall', category: 'feature' };
  }
  if (name.includes('grimm') || name.includes('peddler') || name.includes('merchant')) {
    return { symbol: '🧙‍♂️', color: '#00ff88', label: desc?.name || 'Grimm the Peddler', category: 'npc' };
  }
  if (name.includes('horn') || name.includes('scout')) {
    return { symbol: '📯', color: '#ff0033', label: desc?.name || 'Goblin Horn Scout', category: 'monster' };
  }
  if (name.includes('minotaur')) {
    return { symbol: '🐂', color: '#ff2200', label: desc?.name || 'Minotaur Crypt Lord', category: 'monster' };
  }
  if (name.includes('lich')) {
    return { symbol: '☠️', color: '#8800ff', label: desc?.name || 'Lich King', category: 'monster' };
  }
  if (name.includes('orc') || name.includes('champion')) {
    return { symbol: '👹', color: '#ff3355', label: desc?.name || 'Orc Champion', category: 'monster' };
  }
  if (name.includes('skeleton')) {
    return { symbol: '💀', color: '#e0e6f0', label: desc?.name || 'Skeleton Warrior', category: 'monster' };
  }
  if (name.includes('goblin')) {
    return { symbol: '👺', color: '#44ff66', label: desc?.name || 'Cave Goblin', category: 'monster' };
  }
  if (name.includes('corpse') || name.includes('remains')) {
    return { symbol: '🦴', color: '#632d42', label: desc?.name || 'Skeletal Remains', category: 'feature' };
  }
  if (name.includes('spear') || name.includes('pike')) {
    return { symbol: '🗡️', color: '#00e5ff', label: desc?.name || 'Iron Pike', category: 'item' };
  }
  if (name.includes('bow')) {
    return { symbol: '🏹', color: '#44ff88', label: desc?.name || 'Composite Bow', category: 'item' };
  }
  if (name.includes('staff') || name.includes('wand')) {
    return { symbol: '🪄', color: '#bf55ec', label: desc?.name || 'Archmage Staff', category: 'item' };
  }
  if (name.includes('sword') || name.includes('blade')) {
    return { symbol: '⚔️', color: '#ffcc00', label: desc?.name || 'Tempered Blade', category: 'item' };
  }
  if (name.includes('shield')) {
    return { symbol: '🛡️', color: '#00f0ff', label: desc?.name || 'Shield', category: 'item' };
  }
  if (name.includes('helm') || name.includes('visor')) {
    return { symbol: '🪖', color: '#00e5ff', label: desc?.name || 'Forged Helm', category: 'item' };
  }
  if (name.includes('hood')) {
    return { symbol: '👑', color: '#bf55ec', label: desc?.name || 'Archmage Hood', category: 'item' };
  }
  if (name.includes('cowl')) {
    return { symbol: '🥷', color: '#9933ff', label: desc?.name || 'Shadow Cowl', category: 'item' };
  }
  if (name.includes('plate') || name.includes('armor')) {
    return { symbol: '🦺', color: '#00e5ff', label: desc?.name || 'Plate Mail', category: 'item' };
  }
  if (name.includes('cloak')) {
    return { symbol: '🥋', color: '#9933ff', label: desc?.name || 'Shadow Cloak', category: 'item' };
  }
  if (name.includes('robes') || name.includes('robe')) {
    return { symbol: '🥻', color: '#bf55ec', label: desc?.name || 'Archmage Robes', category: 'item' };
  }
  if (name.includes('ring') || name.includes('band')) {
    return { symbol: '💍', color: '#9933ff', label: desc?.name || 'Ring', category: 'item' };
  }
  if (name.includes('speed') || name.includes('swiftness')) {
    return { symbol: '⚡', color: '#ffea00', label: desc?.name || 'Swiftness Potion', category: 'item' };
  }
  if (name.includes('teleport') || name.includes('scroll')) {
    return { symbol: '📜', color: '#00ffff', label: desc?.name || 'Teleport Scroll', category: 'item' };
  }
  if (name.includes('health') || name.includes('elixir') || healthPack) {
    return { symbol: '🧪', color: '#00f0ff', label: desc?.name || 'Health Elixir', category: 'item' };
  }
  if (name.includes('gold') || name.includes('coin') || gold) {
    return { symbol: '💰', color: '#ffd700', label: desc?.name || 'Gold Coins', category: 'item' };
  }

  // 4. Resolve by Equippable slot
  if (equippable) {
    switch (equippable.slot) {
      case 'weapon':
      case 'main_hand':
        return { symbol: '⚔️', color, label: desc?.name || 'Weapon', category: 'item' };
      case 'offhand':
      case 'off_hand':
        return { symbol: '🛡️', color, label: desc?.name || 'Shield', category: 'item' };
      case 'armor':
        return { symbol: '🦺', color, label: desc?.name || 'Armor', category: 'item' };
      case 'helm':
        return { symbol: '🪖', color, label: desc?.name || 'Helmet', category: 'item' };
      case 'ring':
        return { symbol: '💍', color, label: desc?.name || 'Ring', category: 'item' };
    }
  }

  // 5. If raw glyph is already an emoji / extended unicode (not basic ASCII single character)
  if (rawGlyph && (rawGlyph.length > 1 || rawGlyph.codePointAt(0)! > 255)) {
    const isMon = faction?.id === 'monster' || faction?.id === 'enemy';
    return {
      symbol: rawGlyph,
      color,
      label: desc?.name || (isMon ? 'Creature' : 'Item'),
      category: isMon ? 'monster' : 'item',
    };
  }

  // 6. Map legacy ASCII character
  if (rawGlyph && ASCII_GLYPH_MAP[rawGlyph]) {
    const mapped = ASCII_GLYPH_MAP[rawGlyph];
    return {
      symbol: mapped.symbol,
      color,
      label: desc?.name || mapped.label,
      category: mapped.category,
    };
  }

  // 7. Fallback based on faction
  if (faction?.id === 'monster' || faction?.id === 'enemy') {
    return { symbol: '👹', color, label: desc?.name || 'Hostile Creature', category: 'monster' };
  }

  return {
    symbol: rawGlyph || '📦',
    color,
    label: desc?.name || 'Dungeon Object',
    category: 'item',
  };
}

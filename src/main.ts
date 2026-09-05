/**
 * Cartridge Forge — Cyber-Console Virtual Arcade Main Controller.
 * Wires up UI panels, interactive D-Pad, tile inspector, field key,
 * audio synthesizer, and game runtime.
 */

import { Game } from './runtime/game.js';
import { loadCartridge } from './cartridge/loader.js';
import { sound } from './runtime/audio.js';
import type { Entity } from './ecs/types.js';
import type { Cartridge } from './cartridge/schema.js';

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const combatLog = document.getElementById('combat-log') as HTMLDivElement;
const cartridgeSelect = document.getElementById('cartridge-select') as HTMLSelectElement;
const cartridgeInput = document.getElementById('cartridge-input') as HTMLInputElement;
const btnSfx = document.getElementById('btn-sfx') as HTMLButtonElement;
const btnCrt = document.getElementById('btn-crt') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnClearLog = document.getElementById('btn-clear-log') as HTMLButtonElement;
const canvasWrapper = document.querySelector('.canvas-wrapper') as HTMLDivElement;

// HUD Elements
const gameTitleEl = document.getElementById('game-title') as HTMLElement;
const mapDimsEl = document.getElementById('map-dims') as HTMLElement;
const turnCounterEl = document.getElementById('turn-counter') as HTMLElement;
const tileCoordsEl = document.getElementById('tile-coords') as HTMLElement;

const playerGlyphEl = document.getElementById('player-glyph') as HTMLElement;
const playerNameEl = document.getElementById('player-name') as HTMLElement;
const playerFactionEl = document.getElementById('player-faction') as HTMLElement;
const playerStatusBadge = document.getElementById('player-status-badge') as HTMLElement;
const hpTextEl = document.getElementById('hp-text') as HTMLElement;
const hpBarEl = document.getElementById('hp-bar') as HTMLElement;
const armorTextEl = document.getElementById('armor-text') as HTMLElement;
const armorBarEl = document.getElementById('armor-bar') as HTMLElement;
const statStrEl = document.getElementById('stat-str') as HTMLElement;
const statPosEl = document.getElementById('stat-pos') as HTMLElement;

// Inspector & Legend Elements
const inspectorGlyph = document.getElementById('inspector-glyph') as HTMLElement;
const inspectorName = document.getElementById('inspector-name') as HTMLElement;
const inspectorType = document.getElementById('inspector-type') as HTMLElement;
const inspectorStats = document.getElementById('inspector-stats') as HTMLElement;
const fieldLegend = document.getElementById('field-legend') as HTMLElement;

// --- Combat Log Message Handler ---
function logMessage(msg: string): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  // Apply styling based on keywords
  if (msg.includes('SLAIN') || msg.includes('destroyed') || msg.includes('defeated')) {
    entry.className += ' slain';
  } else if (msg.includes('hits') || msg.includes('damage')) {
    entry.className += ' damage-dealt';
  } else if (msg.includes('===') || msg.includes('---')) {
    entry.className += ' system';
  } else if (msg.includes('item') || msg.includes('hybrid') || msg.includes('born')) {
    entry.className += ' item';
  }

  entry.textContent = msg;
  combatLog.appendChild(entry);
  combatLog.scrollTop = combatLog.scrollHeight;

  while (combatLog.children.length > 250) {
    combatLog.removeChild(combatLog.firstChild!);
  }
}

// --- Player Stats HUD Update ---
function updateStats(player: Entity | undefined): void {
  if (!player) {
    playerStatusBadge.textContent = 'OFFLINE';
    playerStatusBadge.style.color = 'var(--crimson-glow)';
    playerStatusBadge.style.borderColor = 'var(--crimson-glow)';
    hpTextEl.textContent = '0 / 0';
    hpBarEl.style.width = '0%';
    return;
  }

  const health = player.components.get('Health') as { current: number; max: number } | undefined;
  const combatStats = player.components.get('CombatStats') as Record<string, number> | undefined;
  const pos = player.components.get('Position') as { x: number; y: number } | undefined;
  const rend = player.components.get('Renderable') as { glyph: string; color: string } | undefined;
  const glyphComp = player.components.get('Glyph') as { char: string; color: string } | undefined;

  // Glyph & Name
  if (rend) {
    playerGlyphEl.textContent = rend.glyph;
    playerGlyphEl.style.color = rend.color || 'var(--green-glow)';
  } else if (glyphComp) {
    playerGlyphEl.textContent = glyphComp.char;
  }

  // Health Meter
  if (health && health.max > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((health.current / health.max) * 100)));
    hpTextEl.textContent = `${health.current} / ${health.max}`;
    hpBarEl.style.width = `${pct}%`;

    if (pct > 60) {
      playerStatusBadge.textContent = 'NOMINAL';
      playerStatusBadge.style.color = 'var(--green-glow)';
      playerStatusBadge.style.borderColor = 'var(--green-glow)';
    } else if (pct > 25) {
      playerStatusBadge.textContent = 'DAMAGED';
      playerStatusBadge.style.color = 'var(--amber-glow)';
      playerStatusBadge.style.borderColor = 'var(--amber-glow)';
    } else {
      playerStatusBadge.textContent = 'CRITICAL';
      playerStatusBadge.style.color = 'var(--crimson-glow)';
      playerStatusBadge.style.borderColor = 'var(--crimson-glow)';
    }
  }

  // Strength & Armor Stats
  if (combatStats) {
    statStrEl.textContent = String(combatStats.strength ?? combatStats.str ?? '--');
    const armorVal = combatStats.armor ?? combatStats.toughness ?? combatStats.defense ?? 0;
    armorTextEl.textContent = `${armorVal} PTS`;
    armorBarEl.style.width = `${Math.min(100, armorVal * 10)}%`;
  }

  // Coordinates
  if (pos) {
    statPosEl.textContent = `${pos.x}, ${pos.y}`;
  }

  // Turn count
  turnCounterEl.textContent = String(game.getTurnCount());
}

// --- Initialize Game Instance ---
const game = new Game(canvas, logMessage, updateStats);

// --- Build Field Key / Map Legend ---
function updateFieldLegend(cartridge: Cartridge): void {
  fieldLegend.innerHTML = '';

  const legendItems: Array<{ glyph: string; color: string; label: string }> = [
    { glyph: '@', color: '#00ffaa', label: 'Player Mech' },
  ];

  // Extract from blueprints
  for (const [name, bp] of Object.entries(cartridge.blueprints)) {
    const rend = bp['Renderable'] as { glyph?: string; color?: string } | undefined;
    const glyphComp = bp['Glyph'] as { char?: string; color?: string } | undefined;
    const faction = bp['Faction'] as { id?: string } | undefined;

    const g = rend?.glyph || glyphComp?.char;
    const c = rend?.color || glyphComp?.color || '#ffffff';

    if (g && g !== '@' && !legendItems.some(i => i.glyph === g)) {
      legendItems.push({
        glyph: g,
        color: c.startsWith('#') ? c : '#ff5577',
        label: name.replace(/_/g, ' '),
      });
    }
  }

  // Add terrain
  legendItems.push({ glyph: cartridge.world_gen?.wall_glyph || '#', color: '#4a5578', label: 'Solid Wall' });
  legendItems.push({ glyph: cartridge.world_gen?.floor_glyph || '.', color: '#252a3d', label: 'Open Floor' });

  for (const item of legendItems) {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `
      <span class="legend-icon" style="color: ${item.color}; background: rgba(255,255,255,0.06);">${item.glyph}</span>
      <span class="legend-text" title="${item.label}">${item.label}</span>
    `;
    fieldLegend.appendChild(el);
  }
}

// --- Inspect Entity at Tile ---
function inspectTile(gridX: number, gridY: number): void {
  const map = game.getMap();
  if (!map || gridX < 0 || gridX >= map.width || gridY < 0 || gridY >= map.height) {
    return;
  }

  const entity = game.getEntityAt(gridX, gridY);

  if (entity) {
    const rend = entity.components.get('Renderable') as { glyph: string; color: string } | undefined;
    const glyphComp = entity.components.get('Glyph') as { char: string; color: string } | undefined;
    const faction = entity.components.get('Faction') as { id: string } | undefined;
    const health = entity.components.get('Health') as { current: number; max: number } | undefined;
    const combat = entity.components.get('CombatStats') as Record<string, number> | undefined;

    const glyphChar = rend?.glyph || glyphComp?.char || '?';
    const glyphColor = rend?.color || glyphComp?.color || '#00f0ff';

    inspectorGlyph.textContent = glyphChar;
    inspectorGlyph.style.color = glyphColor;
    inspectorGlyph.style.borderColor = glyphColor;

    const isPlayer = faction?.id === 'player';
    inspectorName.textContent = isPlayer ? 'Operator (You)' : `Target [${entity.id}]`;
    inspectorType.textContent = faction?.id ? `Faction: ${faction.id.toUpperCase()}` : 'Entity';

    const details: string[] = [];
    if (health) details.push(`HP: ${health.current} / ${health.max}`);
    if (combat) {
      for (const [k, v] of Object.entries(combat)) {
        details.push(`${k}: ${v}`);
      }
    }
    if (entity.tags.size > 0) {
      details.push(`Status: ${[...entity.tags].join(', ')}`);
    }

    inspectorStats.textContent = details.length > 0 ? details.join(' | ') : 'No telemetry available.';
  } else {
    // Terrain inspection
    const isWall = map.tiles[gridY]?.[gridX] === 1;
    inspectorGlyph.textContent = isWall ? map.wallGlyph || '#' : map.floorGlyph || '.';
    inspectorGlyph.style.color = isWall ? '#4a5578' : '#252a3d';
    inspectorGlyph.style.borderColor = 'var(--border-subtle)';

    inspectorName.textContent = isWall ? 'Reinforced Wall' : 'Walkable Deck';
    inspectorType.textContent = 'Terrain';
    inspectorStats.textContent = `Coordinates: [${gridX}, ${gridY}] | Traversable: ${!isWall ? 'YES' : 'NO'}`;
  }
}

// --- Cartridge Loading Pipeline ---
async function loadCartridgeFromUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const result = loadCartridge(text);

    if (result.success) {
      const c = result.cartridge!;
      game.loadCartridge(c);
      gameTitleEl.textContent = c.meta.title;
      mapDimsEl.textContent = `${c.world_gen?.width || 0} × ${c.world_gen?.height || 0}`;
      playerNameEl.textContent = c.meta.title;
      updateFieldLegend(c);
      logMessage(`✓ Loaded cartridge: "${c.meta.title}"`);
    } else {
      logMessage(`✗ Failed to load cartridge:`);
      result.errors?.forEach(e => logMessage(`  • ${e}`));
    }
  } catch (err) {
    logMessage(`Error fetching cartridge: ${(err as Error).message}`);
  }
}

// --- Event Listeners ---

// 1. Cartridge Selector Dropdown
cartridgeSelect.addEventListener('change', () => {
  loadCartridgeFromUrl(cartridgeSelect.value);
});

// 2. Custom JSON File Upload
cartridgeInput.addEventListener('change', async () => {
  const file = cartridgeInput.files?.[0];
  if (!file) return;

  const text = await file.text();
  const result = loadCartridge(text);

  if (!result.success) {
    logMessage('=== CARTRIDGE VALIDATION FAILED ===');
    for (const err of result.errors ?? []) {
      logMessage(`  ERROR: ${err}`);
    }
    return;
  }

  const c = result.cartridge!;
  game.loadCartridge(c);
  gameTitleEl.textContent = c.meta.title;
  mapDimsEl.textContent = `${c.world_gen?.width || 0} × ${c.world_gen?.height || 0}`;
  updateFieldLegend(c);
  logMessage(`✓ Loaded custom cartridge: "${c.meta.title}"`);
});

// 3. Tactile Virtual D-Pad Buttons
document.querySelectorAll('.dpad-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = (btn as HTMLElement).dataset.key;
    if (key) {
      game.handleInput(key);
    }
  });
});

// 4. Keyboard Controls
document.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  game.handleInput(e.key);
});

// 5. Canvas Mouse Hover & Reticle
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;

  const renderer = game.getRenderer();
  if ('pixelToGrid' in renderer) {
    const grid = (renderer as any).pixelToGrid(pixelX, pixelY);
    if (grid) {
      tileCoordsEl.innerHTML = `CURSOR: <strong>${grid.x}, ${grid.y}</strong>`;
      game.setHoveredTile(grid.x, grid.y);
      inspectTile(grid.x, grid.y);
    }
  }
});

canvas.addEventListener('mouseleave', () => {
  tileCoordsEl.innerHTML = `CURSOR: <strong>--</strong>`;
  game.setHoveredTile(null, null);
});

// 6. Canvas Click to Move / Attack / Select
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;

  const renderer = game.getRenderer();
  if ('pixelToGrid' in renderer) {
    const grid = (renderer as any).pixelToGrid(pixelX, pixelY);
    if (grid) {
      game.handleTileClick(grid.x, grid.y);
      inspectTile(grid.x, grid.y);
    }
  }
});

// 7. CRT Toggle
btnCrt.addEventListener('click', () => {
  const active = canvasWrapper.classList.toggle('crt-active');
  btnCrt.textContent = active ? '📺 CRT ON' : '📺 CRT OFF';
  btnCrt.classList.toggle('active', active);
});

// 8. Sound SFX Toggle
btnSfx.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  btnSfx.textContent = isMuted ? '🔇 MUTED' : '🔊 SFX ON';
  btnSfx.classList.toggle('active', !isMuted);
  if (!isMuted) sound.playItem();
});

// 9. Restart Button
btnRestart.addEventListener('click', () => {
  game.restart();
  sound.playItem();
  logMessage('--- SESSION RESTARTED ---');
});

// 10. Clear Log Button
btnClearLog.addEventListener('click', () => {
  combatLog.innerHTML = '';
});

// --- Continuous Animation Loop for Floating Damage Numbers ---
function animationLoop(): void {
  game.render();
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// --- Initial Auto-Load ---
loadCartridgeFromUrl('/cartridges/abyssal_protocol.json');

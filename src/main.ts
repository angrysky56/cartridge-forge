/**
 * Cartridge Forge — Cyber-Console Virtual Arcade Main Controller.
 * Wires up UI panels, interactive D-Pad, tile inspector, field key,
 * audio synthesizer, and game runtime.
 */

import { Game } from './runtime/game.js';
import { loadCartridge } from './cartridge/loader.js';
import { sound } from './runtime/audio.js';
import { FORGEMASTER_SYSTEM_PROMPT } from './studio/prompt.js';
import { validateCartridgeJson } from './studio/validator.js';
import type { Entity } from './ecs/types.js';
import type { Cartridge } from './cartridge/schema.js';

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const combatLog = document.getElementById('combat-log') as HTMLDivElement;
const cartridgeSelect = document.getElementById('cartridge-select') as HTMLSelectElement;
const cartridgeInput = document.getElementById('cartridge-input') as HTMLInputElement;
const btnFov = document.getElementById('btn-fov') as HTMLButtonElement;
const btnSfx = document.getElementById('btn-sfx') as HTMLButtonElement;
const btnCrt = document.getElementById('btn-crt') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnStudio = document.getElementById('btn-studio') as HTMLButtonElement;
const btnClearLog = document.getElementById('btn-clear-log') as HTMLButtonElement;
const canvasWrapper = document.querySelector('.canvas-wrapper') as HTMLDivElement;

// HUD Elements
const gameTitleEl = document.getElementById('game-title') as HTMLElement;
const floorDepthEl = document.getElementById('floor-depth') as HTMLElement;
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

// Progression & Tactical DOM Elements
const xpTextEl = document.getElementById('xp-text') as HTMLElement | null;
const xpBarEl = document.getElementById('xp-bar') as HTMLElement | null;
const statLvlEl = document.getElementById('stat-lvl') as HTMLElement | null;
const statFloorEl = document.getElementById('stat-floor') as HTMLElement | null;

const btnAbilityDash = document.getElementById('btn-ability-dash') as HTMLButtonElement | null;
const btnAbilityBash = document.getElementById('btn-ability-bash') as HTMLButtonElement | null;
const dashCooldownText = document.getElementById('dash-cooldown-text') as HTMLElement | null;
const bashCooldownText = document.getElementById('bash-cooldown-text') as HTMLElement | null;

// Memorial Modal Elements
const memorialModal = document.getElementById('memorial-modal') as HTMLElement | null;
const btnCloseMemorial = document.getElementById('btn-close-memorial') as HTMLButtonElement | null;
const btnRestartMemorial = document.getElementById('btn-restart-memorial') as HTMLButtonElement | null;
const memDepthEl = document.getElementById('mem-depth') as HTMLElement | null;
const memLevelEl = document.getElementById('mem-level') as HTMLElement | null;
const memSlainEl = document.getElementById('mem-slain') as HTMLElement | null;
const memChestsEl = document.getElementById('mem-chests') as HTMLElement | null;
const memSecretsEl = document.getElementById('mem-secrets') as HTMLElement | null;
const memTurnsEl = document.getElementById('mem-turns') as HTMLElement | null;

// Equipment Slots
const slotMainHandEl = document.getElementById('slot-val-main_hand') as HTMLElement;
const slotOffHandEl = document.getElementById('slot-val-off_hand') as HTMLElement;

// Studio Modal Elements
const studioModal = document.getElementById('studio-modal') as HTMLElement;
const btnCloseStudio = document.getElementById('btn-close-studio') as HTMLButtonElement;
const btnCopyPrompt = document.getElementById('btn-copy-prompt') as HTMLButtonElement;
const btnSampleDungeon = document.getElementById('btn-sample-dungeon') as HTMLButtonElement;
const btnSampleMech = document.getElementById('btn-sample-mech') as HTMLButtonElement;
const btnSampleGladiator = document.getElementById('btn-sample-gladiator') as HTMLButtonElement;
const studioJsonInput = document.getElementById('studio-json-input') as HTMLTextAreaElement;
const studioValidationStatus = document.getElementById('studio-validation-status') as HTMLElement;
const btnValidateStudio = document.getElementById('btn-validate-studio') as HTMLButtonElement;
const btnFlashStudio = document.getElementById('btn-flash-studio') as HTMLButtonElement;

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

  // Depth Indicator
  if (floorDepthEl) {
    floorDepthEl.textContent = `B${game.getDepth()}`;
  }

  // Strength & Armor Stats with Equipment Modifiers
  const mods = game.getInventoryService().getEquipmentModifiers(player);
  if (combatStats) {
    const baseStr = combatStats.strength ?? combatStats.str ?? 10;
    const modStr = mods['CombatStats.strength'] || 0;
    statStrEl.textContent = modStr > 0 ? `${baseStr + modStr} (+${modStr})` : String(baseStr);

    const baseArmor = combatStats.armor ?? combatStats.toughness ?? combatStats.defense ?? 0;
    const modArmor = mods['CombatStats.armor'] || 0;
    const totalArmor = baseArmor + modArmor;
    armorTextEl.textContent = modArmor > 0 ? `${totalArmor} PTS (+${modArmor})` : `${totalArmor} PTS`;
    armorBarEl.style.width = `${Math.min(100, totalArmor * 10)}%`;
  }

  // Equipment Slots Rack
  const equipped = game.getEquippedItems();
  const mainHandItem = equipped['main_hand'];
  const offHandItem = equipped['off_hand'];

  if (slotMainHandEl) {
    if (mainHandItem) {
      const name = (mainHandItem.components.get('Description') as any)?.name || 'Weapon';
      const eq = mainHandItem.components.get('Equippable') as any;
      const mod = eq?.modifiers ? Object.entries(eq.modifiers).map(([k, v]) => `+${v} ${k.split('.').pop()}`).join(', ') : '';
      slotMainHandEl.textContent = `${name}${mod ? ` (${mod})` : ''}`;
      slotMainHandEl.style.color = 'var(--cyan-glow)';
    } else {
      slotMainHandEl.textContent = 'Bare / Unarmed';
      slotMainHandEl.style.color = 'var(--text-muted)';
    }
  }

  if (slotOffHandEl) {
    if (offHandItem) {
      const name = (offHandItem.components.get('Description') as any)?.name || 'Shield';
      const eq = offHandItem.components.get('Equippable') as any;
      const mod = eq?.modifiers ? Object.entries(eq.modifiers).map(([k, v]) => `+${v} ${k.split('.').pop()}`).join(', ') : '';
      slotOffHandEl.textContent = `${name}${mod ? ` (${mod})` : ''}`;
      slotOffHandEl.style.color = 'var(--cyan-glow)';
    } else {
      slotOffHandEl.textContent = 'None';
      slotOffHandEl.style.color = 'var(--text-muted)';
    }
  }

  // Progression: Level & XP
  const lvl = game.getLevel();
  const xp = game.getXP();
  if (xpTextEl && xpBarEl) {
    xpTextEl.textContent = `LVL ${lvl} (${xp.current} / ${xp.next} XP)`;
    const xpPct = Math.min(100, Math.round((xp.current / xp.next) * 100));
    xpBarEl.style.width = `${xpPct}%`;
  }
  if (statLvlEl) statLvlEl.textContent = String(lvl);
  if (statFloorEl) statFloorEl.textContent = `B${game.getDepth()}`;

  // Tactical Ability Cooldowns
  const cooldowns = game.getCooldowns();
  if (btnAbilityDash && dashCooldownText) {
    if (cooldowns.dash > 0) {
      dashCooldownText.textContent = `${cooldowns.dash} TURNS`;
      dashCooldownText.className = 'tactical-status cooldown';
      btnAbilityDash.disabled = true;
    } else {
      dashCooldownText.textContent = 'READY';
      dashCooldownText.className = 'tactical-status ready';
      btnAbilityDash.disabled = false;
    }
  }
  if (btnAbilityBash && bashCooldownText) {
    if (cooldowns.bash > 0) {
      bashCooldownText.textContent = `${cooldowns.bash} TURNS`;
      bashCooldownText.className = 'tactical-status cooldown';
      btnAbilityBash.disabled = true;
    } else {
      bashCooldownText.textContent = 'READY';
      bashCooldownText.className = 'tactical-status ready';
      btnAbilityBash.disabled = false;
    }
  }

  // Coordinates
  if (pos) {
    statPosEl.textContent = `${pos.x}, ${pos.y}`;
  }

  // Turn count
  turnCounterEl.textContent = String(game.getTurnCount());

  // Check Game Over and Show Memorial
  if (game.getPhase() === 'GAME_OVER') {
    showMemorialModal();
  }
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

// 7. Tactical FOV Toggle
btnFov.addEventListener('click', () => {
  const renderer = game.getRenderer();
  if ('toggleFov' in (renderer as any)) {
    const isEnabled = (renderer as any).toggleFov();
    btnFov.textContent = isEnabled ? '🔦 FOV ON' : '🔦 FOV OFF';
    btnFov.classList.toggle('active', isEnabled);
    sound.playMove();
  }
});

// 8. CRT Toggle
btnCrt.addEventListener('click', () => {
  const active = canvasWrapper.classList.toggle('crt-active');
  btnCrt.textContent = active ? '📺 CRT ON' : '📺 CRT OFF';
  btnCrt.classList.toggle('active', active);
});

// 9. Sound SFX Toggle
btnSfx.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  btnSfx.textContent = isMuted ? '🔇 MUTED' : '🔊 SFX ON';
  btnSfx.classList.toggle('active', !isMuted);
  if (!isMuted) sound.playItem();
});

// 10. Restart Button
btnRestart.addEventListener('click', () => {
  game.restart();
  sound.playItem();
  logMessage('--- SESSION RESTARTED ---');
});

// 11. Clear Log Button
btnClearLog.addEventListener('click', () => {
  combatLog.innerHTML = '';
});

// 12. Forgemaster AI Studio Modal Wiring
btnStudio.addEventListener('click', () => {
  studioModal.style.display = 'flex';
  if (!studioJsonInput.value) {
    // Load current cartridge as default in editor
    const c = game.getCartridge();
    if (c) studioJsonInput.value = JSON.stringify(c, null, 2);
  }
});

btnCloseStudio.addEventListener('click', () => {
  studioModal.style.display = 'none';
});

studioModal.addEventListener('click', (e) => {
  if (e.target === studioModal) {
    studioModal.style.display = 'none';
  }
});

btnCopyPrompt.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(FORGEMASTER_SYSTEM_PROMPT);
    const originalText = btnCopyPrompt.textContent;
    btnCopyPrompt.textContent = '✓ Copied Prompt!';
    sound.playItem();
    setTimeout(() => {
      btnCopyPrompt.textContent = originalText;
    }, 2000);
  } catch {
    // Fallback if clipboard API restricted
    studioJsonInput.value = FORGEMASTER_SYSTEM_PROMPT;
    logMessage('Prompt loaded directly into editor.');
  }
});

async function loadSampleIntoStudio(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    studioJsonInput.value = JSON.stringify(json, null, 2);
    validateStudioContent();
    sound.playMove();
  } catch (err) {
    studioValidationStatus.className = 'validation-status error';
    studioValidationStatus.textContent = `Error loading sample: ${(err as Error).message}`;
  }
}

btnSampleDungeon.addEventListener('click', () => {
  loadSampleIntoStudio('/cartridges/dungeon_of_the_forgotten.json');
});

btnSampleMech.addEventListener('click', () => {
  loadSampleIntoStudio('/cartridges/abyssal_protocol.json');
});

btnSampleGladiator.addEventListener('click', () => {
  loadSampleIntoStudio('/cartridges/gladiator_gen.json');
});

function validateStudioContent(): boolean {
  const content = studioJsonInput.value.trim();
  if (!content) {
    studioValidationStatus.className = 'validation-status ready';
    studioValidationStatus.textContent = 'Paste or write cartridge JSON above.';
    return false;
  }

  const result = validateCartridgeJson(content);
  if (result.valid) {
    studioValidationStatus.className = 'validation-status success';
    studioValidationStatus.textContent = `✓ ${result.summary} (Verified with Zod schema)`;
    return true;
  } else {
    studioValidationStatus.className = 'validation-status error';
    const errorDetails = result.errors.slice(0, 4).map(e => `[${e.path}]: ${e.message}`).join(' | ');
    studioValidationStatus.textContent = `✗ ${result.summary} — ${errorDetails}`;
    return false;
  }
}

btnValidateStudio.addEventListener('click', () => {
  const valid = validateStudioContent();
  if (valid) sound.playItem();
  else sound.playHit();
});

btnFlashStudio.addEventListener('click', () => {
  const valid = validateStudioContent();
  if (!valid) {
    sound.playHit();
    return;
  }

  const result = validateCartridgeJson(studioJsonInput.value.trim());
  if (result.valid && result.cartridge) {
    const c = result.cartridge;
    game.loadCartridge(c);
    gameTitleEl.textContent = c.meta.title;
    mapDimsEl.textContent = `${c.world_gen?.width || 0} × ${c.world_gen?.height || 0}`;
    playerNameEl.textContent = c.meta.title;
    updateFieldLegend(c);
    studioModal.style.display = 'none';
    sound.playItem();
    logMessage(`🚀 FLASHED & LOADED AI CARTRIDGE: "${c.meta.title}"`);
  }
});

// --- Tactical Abilities Button Wiring ---
if (btnAbilityDash) {
  btnAbilityDash.addEventListener('click', () => {
    game.usePhaseDash();
  });
}

if (btnAbilityBash) {
  btnAbilityBash.addEventListener('click', () => {
    game.useShieldBash();
  });
}

// --- Memorial Modal Wiring ---
function showMemorialModal(): void {
  if (!memorialModal) return;
  const summary = game.getStatsSummary();
  if (memDepthEl) memDepthEl.textContent = `B${summary.depth}`;
  if (memLevelEl) memLevelEl.textContent = `LVL ${summary.level}`;
  if (memSlainEl) memSlainEl.textContent = String(summary.monstersSlain);
  if (memChestsEl) memChestsEl.textContent = String(summary.chestsOpened);
  if (memSecretsEl) memSecretsEl.textContent = String(summary.secretsFound);
  if (memTurnsEl) memTurnsEl.textContent = String(summary.turnCount);
  memorialModal.style.display = 'flex';
}

if (btnCloseMemorial && memorialModal) {
  btnCloseMemorial.addEventListener('click', () => {
    memorialModal.style.display = 'none';
  });
}

if (btnRestartMemorial && memorialModal) {
  btnRestartMemorial.addEventListener('click', () => {
    memorialModal.style.display = 'none';
    game.restart();
    sound.playItem();
    logMessage('--- EMBARKING ON A FRESH DESCENT ---');
  });
}

if (memorialModal) {
  memorialModal.addEventListener('click', (e) => {
    if (e.target === memorialModal) {
      memorialModal.style.display = 'none';
    }
  });
}

// --- Continuous Animation Loop for Floating Damage Numbers ---
function animationLoop(): void {
  game.render();
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// --- Initial Auto-Load ---
loadCartridgeFromUrl('/cartridges/dungeon_of_the_forgotten.json');

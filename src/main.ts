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
import { resolveEntitySymbol } from './runtime/symbols.js';

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
const goldTextEl = document.getElementById('gold-text') as HTMLElement | null;
const speedTextEl = document.getElementById('speed-text') as HTMLElement | null;

const btnAbilityDash = document.getElementById('btn-ability-dash') as HTMLButtonElement | null;
const btnAbilityBash = document.getElementById('btn-ability-bash') as HTMLButtonElement | null;
const btnSpellFireball = document.getElementById('btn-spell-fireball') as HTMLButtonElement | null;
const btnSpellLightning = document.getElementById('btn-spell-lightning') as HTMLButtonElement | null;
const btnSpellFrost = document.getElementById('btn-spell-frost') as HTMLButtonElement | null;
const btnUseHeal = document.getElementById('btn-use-heal') as HTMLButtonElement | null;
const btnUseSpeed = document.getElementById('btn-use-speed') as HTMLButtonElement | null;
const btnOpenBackpack = document.getElementById('btn-open-backpack') as HTMLButtonElement | null;

const dashCooldownText = document.getElementById('dash-cooldown-text') as HTMLElement | null;
const bashCooldownText = document.getElementById('bash-cooldown-text') as HTMLElement | null;
const fireballCooldownText = document.getElementById('fireball-cooldown-text') as HTMLElement | null;
const lightningCooldownText = document.getElementById('lightning-cooldown-text') as HTMLElement | null;
const frostCooldownText = document.getElementById('frost-cooldown-text') as HTMLElement | null;
const healCountText = document.getElementById('heal-count-text') as HTMLElement | null;
const speedBuffText = document.getElementById('speed-buff-text') as HTMLElement | null;

// Arcade Hotbar Elements
const hotbarDash = document.getElementById('hotbar-dash') as HTMLButtonElement | null;
const hotbarBash = document.getElementById('hotbar-bash') as HTMLButtonElement | null;
const hotbarFireball = document.getElementById('hotbar-fireball') as HTMLButtonElement | null;
const hotbarLightning = document.getElementById('hotbar-lightning') as HTMLButtonElement | null;
const hotbarFrost = document.getElementById('hotbar-frost') as HTMLButtonElement | null;
const hotbarHeal = document.getElementById('hotbar-heal') as HTMLButtonElement | null;
const hotbarSpeed = document.getElementById('hotbar-speed') as HTMLButtonElement | null;
const hotbarInventory = document.getElementById('hotbar-inventory') as HTMLButtonElement | null;

// Boss Encounter Top Banner Elements
const bossHud = document.getElementById('boss-hud') as HTMLElement | null;
const bossNameEl = document.getElementById('boss-name') as HTMLElement | null;
const bossHpEl = document.getElementById('boss-hp') as HTMLElement | null;
const bossBarFill = document.getElementById('boss-bar-fill') as HTMLElement | null;

// 5 Normalized Equipment Slots + Set Bonuses
const slotWeaponEl = document.getElementById('slot-val-weapon') as HTMLElement | null;
const slotOffhandEl = document.getElementById('slot-val-offhand') as HTMLElement | null;
const slotArmorEl = document.getElementById('slot-val-armor') as HTMLElement | null;
const slotHelmEl = document.getElementById('slot-val-helm') as HTMLElement | null;
const slotRingEl = document.getElementById('slot-val-ring') as HTMLElement | null;
const activeSetBonusesEl = document.getElementById('active-set-bonuses') as HTMLElement | null;

// Backpack Inventory Modal Elements
const inventoryModal = document.getElementById('inventory-modal') as HTMLElement | null;
const btnCloseInventory = document.getElementById('btn-close-inventory') as HTMLButtonElement | null;
const btnDoneInventory = document.getElementById('btn-done-inventory') as HTMLButtonElement | null;
const backpackItemsList = document.getElementById('backpack-items-list') as HTMLElement | null;
const invCapacityText = document.getElementById('inv-capacity-text') as HTMLElement | null;
const invGoldBalance = document.getElementById('inv-gold-balance') as HTMLElement | null;

// Merchant Shop Modal Elements
const shopModal = document.getElementById('shop-modal') as HTMLElement | null;
const btnCloseShop = document.getElementById('btn-close-shop') as HTMLButtonElement | null;
const btnDoneShop = document.getElementById('btn-done-shop') as HTMLButtonElement | null;
const shopWaresList = document.getElementById('shop-wares-list') as HTMLElement | null;
const shopPlayerGold = document.getElementById('shop-player-gold') as HTMLElement | null;

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
  const playerSymbol = resolveEntitySymbol(player);
  playerGlyphEl.textContent = playerSymbol.symbol;
  playerGlyphEl.style.color = playerSymbol.color || 'var(--green-glow)';

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

  // Currency (Gold) & Relative Speed Gauges
  const gold = game.getGold();
  if (goldTextEl) {
    goldTextEl.textContent = `💰 ${gold} GOLD`;
  }
  const speed = game.getPlayerSpeed();
  const spells = game.getSpellCooldowns();
  if (speedTextEl) {
    const speedStatus = spells.speedBuff > 0 ? `SWIFT (${spells.speedBuff}T)` : 'NORMAL';
    speedTextEl.textContent = `⚡ ${speed}% (${speedStatus})`;
    speedTextEl.style.color = spells.speedBuff > 0 ? '#00ffff' : '#00ffaa';
  }

  // 5 Normalized Equipment Slots Rack
  const equipped = game.getEquippedItems();
  const slotsConfig: Array<{ el: HTMLElement | null; key: string; defaultText: string }> = [
    { el: slotWeaponEl, key: 'weapon', defaultText: 'Standard / Bare' },
    { el: slotOffhandEl, key: 'offhand', defaultText: 'None' },
    { el: slotArmorEl, key: 'armor', defaultText: 'None' },
    { el: slotHelmEl, key: 'helm', defaultText: 'None' },
    { el: slotRingEl, key: 'ring', defaultText: 'None' },
  ];

  for (const slot of slotsConfig) {
    if (!slot.el) continue;
    const item = equipped[slot.key];
    if (item) {
      const name = (item.components.get('Description') as any)?.name || 'Gear';
      const eq = item.components.get('Equippable') as any;
      const mod = eq?.modifiers ? Object.entries(eq.modifiers).map(([k, v]) => `+${v} ${k.split('.').pop()}`).join(', ') : '';
      slot.el.textContent = `${name}${mod ? ` (${mod})` : ''}`;
      slot.el.style.color = 'var(--cyan-glow)';
    } else {
      slot.el.textContent = slot.defaultText;
      slot.el.style.color = 'var(--text-dim)';
    }
  }

  // Active Set Bonuses Display
  if (activeSetBonusesEl) {
    const setBonuses = game.getActiveSetBonuses();
    if (setBonuses.length === 0) {
      activeSetBonusesEl.innerHTML = '';
    } else {
      activeSetBonusesEl.innerHTML = setBonuses.map(b => `
        <div class="set-bonus-badge">
          <span class="set-name">[SET] ${b.setDisplayName}</span>
          <span class="set-desc">${b.description}</span>
        </div>
      `).join('');
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

  // Tactical Abilities & Spells Cooldowns
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
  if (btnSpellFireball && fireballCooldownText) {
    if (spells.fireball > 0) {
      fireballCooldownText.textContent = `${spells.fireball} TURNS`;
      fireballCooldownText.className = 'tactical-status cooldown';
      btnSpellFireball.disabled = true;
    } else {
      fireballCooldownText.textContent = 'READY';
      fireballCooldownText.className = 'tactical-status ready';
      btnSpellFireball.disabled = false;
    }
  }
  if (btnSpellLightning && lightningCooldownText) {
    if (spells.lightning > 0) {
      lightningCooldownText.textContent = `${spells.lightning} TURNS`;
      lightningCooldownText.className = 'tactical-status cooldown';
      btnSpellLightning.disabled = true;
    } else {
      lightningCooldownText.textContent = 'READY';
      lightningCooldownText.className = 'tactical-status ready';
      btnSpellLightning.disabled = false;
    }
  }
  if (btnSpellFrost && frostCooldownText) {
    if (spells.frost > 0) {
      frostCooldownText.textContent = `${spells.frost} TURNS`;
      frostCooldownText.className = 'tactical-status cooldown';
      btnSpellFrost.disabled = true;
    } else {
      frostCooldownText.textContent = 'READY';
      frostCooldownText.className = 'tactical-status ready';
      btnSpellFrost.disabled = false;
    }
  }

  // Backpack Consumables Count
  const backpack = game.getBackpack();
  const healPots = backpack.filter(i => (i.components.get('Description') as any)?.name?.includes('Health') || i.id.startsWith('health_potion')).length;
  const speedPots = backpack.filter(i => (i.components.get('Description') as any)?.name?.includes('Swiftness') || i.id.startsWith('speed_potion')).length;
  if (healCountText) {
    healCountText.textContent = healPots > 0 ? `USE (${healPots})` : 'EMPTY';
    healCountText.className = healPots > 0 ? 'tactical-status ready' : 'tactical-status cooldown';
  }
  if (speedBuffText) {
    speedBuffText.textContent = spells.speedBuff > 0 ? `${spells.speedBuff}T BUFF` : (speedPots > 0 ? `USE (${speedPots})` : 'EMPTY');
    speedBuffText.className = (spells.speedBuff > 0 || speedPots > 0) ? 'tactical-status ready' : 'tactical-status cooldown';
  }

  // Boss Encounter Top Banner
  const boss = game.getActiveBoss();
  if (bossHud && bossNameEl && bossHpEl && bossBarFill) {
    if (boss && boss.components.has('Health')) {
      bossHud.classList.remove('hidden');
      const desc = (boss.components.get('Description') as any)?.name || 'DUNGEON BOSS';
      const bHealth = boss.components.get('Health') as { current: number; max: number };
      bossNameEl.textContent = desc.toUpperCase();
      bossHpEl.textContent = `${Math.max(0, bHealth.current)} / ${bHealth.max} HP`;
      const pct = Math.max(0, Math.min(100, Math.round((bHealth.current / bHealth.max) * 100)));
      bossBarFill.style.width = `${pct}%`;
    } else {
      bossHud.classList.add('hidden');
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

  const legendItems: Array<{ symbol: string; color: string; label: string }> = [
    { symbol: '🧙', color: '#00ffaa', label: 'Operator Hero' },
  ];

  // Extract from blueprints
  for (const [name, bp] of Object.entries(cartridge.blueprints)) {
    const info = resolveEntitySymbol(bp);
    if (info.category !== 'player' && !legendItems.some(i => i.symbol === info.symbol)) {
      legendItems.push({
        symbol: info.symbol,
        color: info.color.startsWith('#') ? info.color : '#ff5577',
        label: info.label || name.replace(/_/g, ' '),
      });
    }
  }

  // Add terrain
  legendItems.push({ symbol: '🧱', color: '#4a5578', label: 'Solid Wall' });
  legendItems.push({ symbol: '▫️', color: '#252a3d', label: 'Open Floor' });

  for (const item of legendItems) {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `
      <span class="legend-icon" style="color: ${item.color}; background: rgba(255,255,255,0.06); font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">${item.symbol}</span>
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
    const symbolInfo = resolveEntitySymbol(entity);
    const faction = entity.components.get('Faction') as { id: string } | undefined;
    const health = entity.components.get('Health') as { current: number; max: number } | undefined;
    const combat = entity.components.get('CombatStats') as Record<string, number> | undefined;

    inspectorGlyph.textContent = symbolInfo.symbol;
    inspectorGlyph.style.color = symbolInfo.color;
    inspectorGlyph.style.borderColor = symbolInfo.color;

    const isPlayer = faction?.id === 'player';
    inspectorName.textContent = isPlayer ? 'Operator Hero (You)' : symbolInfo.label;
    inspectorType.textContent = faction?.id ? `Faction: ${faction.id.toUpperCase()}` : symbolInfo.category.toUpperCase();

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
    inspectorGlyph.textContent = isWall ? '🧱' : '▫️';
    inspectorGlyph.style.color = isWall ? '#4a5578' : '#252a3d';
    inspectorGlyph.style.borderColor = 'var(--border-subtle)';

    inspectorName.textContent = isWall ? 'Stone Masonry Wall' : 'Dungeon Floor';
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
  // If typing in an input/textarea, ignore game controls
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    return;
  }

  // Toggle Inventory Modal with 'i' or 'I'
  if (e.key === 'i' || e.key === 'I') {
    e.preventDefault();
    if (inventoryModal && inventoryModal.style.display === 'flex') {
      closeInventoryModal();
    } else {
      openInventoryModal();
    }
    return;
  }

  // Close modals on Escape
  if (e.key === 'Escape') {
    if (inventoryModal && inventoryModal.style.display === 'flex') {
      closeInventoryModal();
      return;
    }
    if (shopModal && shopModal.style.display === 'flex') {
      closeShopModal();
      return;
    }
    if (studioModal && studioModal.style.display === 'flex') {
      studioModal.style.display = 'none';
      return;
    }
    if (memorialModal && memorialModal.style.display === 'flex') {
      memorialModal.style.display = 'none';
      return;
    }
  }

  // If any modal is open, don't pass navigation/attacks to game
  if (
    (inventoryModal && inventoryModal.style.display === 'flex') ||
    (shopModal && shopModal.style.display === 'flex') ||
    (studioModal && studioModal.style.display === 'flex') ||
    (memorialModal && memorialModal.style.display === 'flex')
  ) {
    return;
  }

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

// --- Tactical Abilities & Spells Button Wiring ---
if (btnAbilityDash) btnAbilityDash.addEventListener('click', () => game.usePhaseDash());
if (hotbarDash) hotbarDash.addEventListener('click', () => game.usePhaseDash());

if (btnAbilityBash) btnAbilityBash.addEventListener('click', () => game.useShieldBash());
if (hotbarBash) hotbarBash.addEventListener('click', () => game.useShieldBash());

if (btnSpellFireball) btnSpellFireball.addEventListener('click', () => game.useFireball());
if (hotbarFireball) hotbarFireball.addEventListener('click', () => game.useFireball());

if (btnSpellLightning) btnSpellLightning.addEventListener('click', () => game.useLightning());
if (hotbarLightning) hotbarLightning.addEventListener('click', () => game.useLightning());

if (btnSpellFrost) btnSpellFrost.addEventListener('click', () => game.useFrostNova());
if (hotbarFrost) hotbarFrost.addEventListener('click', () => game.useFrostNova());

if (btnUseHeal) btnUseHeal.addEventListener('click', () => game.drinkHealthPotion());
if (hotbarHeal) hotbarHeal.addEventListener('click', () => game.drinkHealthPotion());

if (btnUseSpeed) btnUseSpeed.addEventListener('click', () => game.drinkSpeedPotion());
if (hotbarSpeed) hotbarSpeed.addEventListener('click', () => game.drinkSpeedPotion());

if (btnOpenBackpack) btnOpenBackpack.addEventListener('click', () => openInventoryModal());
if (hotbarInventory) hotbarInventory.addEventListener('click', () => openInventoryModal());

// --- Backpack Inventory Modal Logic ---
function openInventoryModal(): void {
  if (!inventoryModal || !backpackItemsList) return;
  const player = game.getPlayer();
  if (!player) return;

  const backpack = game.getBackpack();
  if (invCapacityText) invCapacityText.textContent = `BACKPACK STORAGE (${backpack.length} / 16 ITEMS)`;
  if (invGoldBalance) invGoldBalance.textContent = `💰 ${game.getGold()} GOLD`;

  backpackItemsList.innerHTML = '';
  if (backpack.length === 0) {
    backpackItemsList.innerHTML = '<div class="empty-pack-msg">Your backpack is empty. Defeat monsters and open chests to collect equipment, scrolls, and potions!</div>';
  } else {
    for (const item of backpack) {
      const desc = (item.components.get('Description') as any)?.name || 'Item';
      const text = (item.components.get('Description') as any)?.text || '';
      const equippable = item.components.get('Equippable') as { slot: string; modifiers: Record<string, number> } | undefined;
      const setComp = item.components.get('SetItem') as { setName: string } | undefined;
      const consumable = item.components.get('Consumable') as { effect: string; value: number } | undefined;
      const isEquippable = !!equippable;

      let subText = text;
      if (equippable?.modifiers) {
        const modsStr = Object.entries(equippable.modifiers).map(([k, v]) => `+${v} ${k.split('.').pop()}`).join(', ');
        subText = `[${equippable.slot.toUpperCase()}] ${modsStr}${setComp ? ` (${setComp.setName} Set)` : ''}`;
      } else if (consumable) {
        subText = `Consumable: ${consumable.effect.toUpperCase()}`;
      }

      let icon = '📦';
      if (equippable?.slot === 'weapon') icon = '⚔';
      else if (equippable?.slot === 'offhand') icon = '🛡';
      else if (equippable?.slot === 'armor') icon = '🦺';
      else if (equippable?.slot === 'helm') icon = '🪖';
      else if (equippable?.slot === 'ring') icon = '💍';
      else if (consumable?.effect === 'heal') icon = '🧪';
      else if (consumable?.effect === 'speed') icon = '🏃';
      else if (consumable?.effect === 'teleport') icon = '📜';

      const card = document.createElement('div');
      card.className = 'backpack-item-card';
      card.innerHTML = `
        <div class="backpack-item-info">
          <span class="backpack-item-icon">${icon}</span>
          <div class="backpack-item-details">
            <span class="backpack-item-name">${desc}</span>
            <span class="backpack-item-sub">${subText}</span>
          </div>
        </div>
        <div class="backpack-item-actions">
          <button class="cyber-btn item-use-btn" style="font-size: 11px; padding: 4px 8px;">
            ${isEquippable ? 'EQUIP' : 'USE'}
          </button>
          <button class="cyber-btn item-drop-btn" style="font-size: 11px; padding: 4px 8px; border-color: rgba(255,51,85,0.4); color: #ff3355;">
            DROP
          </button>
        </div>
      `;

      card.querySelector('.item-use-btn')?.addEventListener('click', () => {
        game.useBackpackItem(item);
        openInventoryModal();
      });

      card.querySelector('.item-drop-btn')?.addEventListener('click', () => {
        game.dropBackpackItem(item);
        openInventoryModal();
      });

      backpackItemsList.appendChild(card);
    }
  }

  inventoryModal.style.display = 'flex';
  sound.playItem();
}

function closeInventoryModal(): void {
  if (inventoryModal) {
    inventoryModal.style.display = 'none';
  }
}

if (btnCloseInventory) btnCloseInventory.addEventListener('click', closeInventoryModal);
if (btnDoneInventory) btnDoneInventory.addEventListener('click', closeInventoryModal);
if (inventoryModal) {
  inventoryModal.addEventListener('click', (e) => {
    if (e.target === inventoryModal) closeInventoryModal();
  });
}

// --- Grimm the Peddler Shop Modal Logic ---
const SHOP_WARES = [
  { blueprint: 'health_potion', name: 'Health Potion', icon: '🧪', desc: 'Restores +35 HP instantly', price: 35 },
  { blueprint: 'speed_potion', name: 'Swiftness Potion', icon: '🏃', desc: 'Increases Relative Speed to 150% for 15 turns', price: 45 },
  { blueprint: 'teleport_scroll', name: 'Scroll of Teleport', icon: '📜', desc: 'Warps you to safety immediately', price: 50 },
  { blueprint: 'iron_spear', name: 'Iron Pike (Spear)', icon: '🔱', desc: 'Reach Weapon: Strikes 2 tiles away without retaliation (+8 STR)', price: 65 },
  { blueprint: 'composite_bow', name: 'Composite Bow', icon: '🏹', desc: 'Ranged Weapon: Fires at foes from afar (+10 STR)', price: 80 },
  { blueprint: 'ironclad_plate', name: 'Ironclad Plate', icon: '🦺', desc: 'Ironclad Set: +6 Armor, +10 HP (Set: +10 Armor, +35 HP)', price: 110 },
  { blueprint: 'shadow_cloak', name: 'Shadow Cloak', icon: '🧥', desc: 'Shadow Set: +20 Speed, +4 Armor (Set: +35 Speed, +10 INT)', price: 110 },
  { blueprint: 'archmage_robe', name: 'Archmage Robe', icon: '👘', desc: 'Archmage Set: +8 Intellect, +2 Armor (Set: +15 INT, +40 Spell DMG)', price: 110 },
];

function openShopModal(): void {
  if (!shopModal || !shopWaresList) return;
  const playerGold = game.getGold();
  if (shopPlayerGold) shopPlayerGold.textContent = `${playerGold} GOLD`;

  shopWaresList.innerHTML = '';
  for (const ware of SHOP_WARES) {
    const canAfford = playerGold >= ware.price;
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="shop-card-top">
        <span style="font-size: 22px;">${ware.icon}</span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <strong style="font-family: var(--font-display); font-size: 14px; color: #fff;">${ware.name}</strong>
          <span class="shop-card-desc">${ware.desc}</span>
        </div>
      </div>
      <div class="shop-card-bottom">
        <span class="shop-price">💰 ${ware.price} GOLD</span>
        <button class="cyber-btn shop-buy-btn ${canAfford ? 'primary-flash' : ''}" style="font-size: 11px; padding: 4px 10px;" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'PURCHASE' : 'NEED GOLD'}
        </button>
      </div>
    `;

    card.querySelector('.shop-buy-btn')?.addEventListener('click', () => {
      const bought = game.buyShopItem(ware.blueprint, ware.price);
      if (bought) {
        openShopModal();
      }
    });

    shopWaresList.appendChild(card);
  }

  shopModal.style.display = 'flex';
  sound.playItem();
}

function closeShopModal(): void {
  if (shopModal) {
    shopModal.style.display = 'none';
  }
}

if (btnCloseShop) btnCloseShop.addEventListener('click', closeShopModal);
if (btnDoneShop) btnDoneShop.addEventListener('click', closeShopModal);
if (shopModal) {
  shopModal.addEventListener('click', (e) => {
    if (e.target === shopModal) closeShopModal();
  });
}

// Connect Shop callback from Game runtime
game.setShopCallback(() => {
  openShopModal();
});

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

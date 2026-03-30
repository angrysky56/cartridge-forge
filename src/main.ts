/**
 * Main entry point — wires up the UI, file loader, and game runtime.
 */

import { Game } from './runtime/game.js';
import { loadCartridge } from './cartridge/loader.js';
import type { Entity } from './ecs/types.js';

// ─── DOM Elements ────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const combatLog = document.getElementById('combat-log') as HTMLDivElement;
const statsPanel = document.getElementById('stats-panel') as HTMLDivElement;
const cartridgeInput = document.getElementById('cartridge-input') as HTMLInputElement;

// ─── Combat Log ──────────────────────────────────────────────────────
function logMessage(msg: string): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  combatLog.appendChild(entry);
  combatLog.scrollTop = combatLog.scrollHeight;

  // Keep log from growing unbounded
  while (combatLog.children.length > 200) {
    combatLog.removeChild(combatLog.firstChild!);
  }
}

// ─── Stats Panel ─────────────────────────────────────────────────────
function updateStats(entity: Entity | undefined): void {
  if (!entity) {
    statsPanel.textContent = 'No player';
    return;
  }

  const lines: string[] = [];
  for (const [compName, compData] of entity.components) {
    if (compName === 'Renderable' || compName === 'Position') continue;
    const fields = Object.entries(compData as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`${compName}: ${fields}`);
  }
  if (entity.tags.size > 0) {
    lines.push(`Tags: ${[...entity.tags].join(', ')}`);
  }
  statsPanel.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
}

// ─── Game Instance ───────────────────────────────────────────────────
const game = new Game(canvas, logMessage, updateStats);

// ─── Cartridge File Loading ──────────────────────────────────────────
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

  logMessage(`Loaded cartridge: ${result.cartridge!.meta.title}`);
  game.loadCartridge(result.cartridge!);
});

// ─── Keyboard Input ──────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Prevent arrow keys from scrolling the page
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
  game.handleInput(e.key);
});

// ─── Auto-load demo cartridge ────────────────────────────────────────
async function loadDemoCartridge(): Promise<void> {
  try {
    const response = await fetch('/cartridges/abyssal_protocol.json');
    if (!response.ok) {
      logMessage('No demo cartridge found. Load a .json cartridge file to play.');
      return;
    }
    const text = await response.text();
    const result = loadCartridge(text);
    if (result.success) {
      logMessage('Auto-loaded demo cartridge.');
      game.loadCartridge(result.cartridge!);
    } else {
      logMessage('Demo cartridge has validation errors:');
      result.errors?.forEach(e => logMessage(`  ${e}`));
    }
  } catch {
    logMessage('Load a .json cartridge file to begin.');
  }
}

loadDemoCartridge();

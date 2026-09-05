/**
 * Game Runtime — the turn-based game loop that connects all subsystems.
 * Handles: cartridge loading → world init → map gen → input → turn processing → render
 */

import { World } from '../ecs/world.js';
import { SystemExecutor, type GameEvent } from '../dsl/executor.js';
import type { IRenderer } from '../renderer/types.js';
import { RendererFactory } from '../renderer/factory.js';
import { generateMap, type GameMap, TileType } from './mapgen.js';
import { PersistenceService, type SaveData } from './persistence.js';
import { GeneticsService } from './genetics.js';
import { InventoryService } from './inventory.js';
import { sound } from './audio.js';
import type { Cartridge } from '../cartridge/schema.js';
import type { Entity, EntityId } from '../ecs/types.js';

/** Game state phases */
export type GamePhase = 'LOADING' | 'PLAYER_TURN' | 'ENEMY_TURN' | 'GAME_OVER';

type InputAction = { dx?: number; dy?: number; rotate?: number };

/** Turn direction mappings */
const DIRECTIONS: Record<string, InputAction> = {
  // Arrow keys
  ArrowUp:    { dx: 0,  dy: -1 },
  ArrowDown:  { dx: 0,  dy: 1 },
  ArrowLeft:  { dx: -1, dy: 0 },
  ArrowRight: { dx: 1,  dy: 0 },
  // Standard WASD
  w: { dx: 0,  dy: -1 }, W: { dx: 0,  dy: -1 },
  s: { dx: 0,  dy: 1 },  S: { dx: 0,  dy: 1 },
  a: { dx: -1, dy: 0 },  A: { dx: -1, dy: 0 },
  d: { dx: 1,  dy: 0 },  D: { dx: 1,  dy: 0 },
  // Rotation keys for 3D modes
  q: { rotate: -1 },     Q: { rotate: -1 },
  e: { rotate: 1 },      E: { rotate: 1 },
  // Wait / rest turn
  ' ': { dx: 0, dy: 0 },
  '.': { dx: 0, dy: 0 },
  '5': { dx: 0, dy: 0 },
  // Numpad / vi keys for diagonal support
  y: { dx: -1, dy: -1 }, u: { dx: 1, dy: -1 },
  b: { dx: -1, dy: 1 },  n: { dx: 1, dy: 1 },
  h: { dx: -1, dy: 0 },  l: { dx: 1, dy: 0 },
  k: { dx: 0,  dy: -1 }, j: { dx: 0, dy: 1 },
};

export class Game {
  private world: World;
  private executor: SystemExecutor;
  private renderer: IRenderer;
  private persistence: PersistenceService;
  private genetics: GeneticsService;
  private inventory: InventoryService;
  private map!: GameMap;
  private cartridge!: Cartridge;
  private phase: GamePhase = 'LOADING';
  private playerId: EntityId | null = null;
  private turnCount = 0;
  private depth = 1;

  /** UI callback for combat log messages */
  private logCallback: (msg: string) => void;
  /** UI callback for stats panel updates */
  private statsCallback: (entity: Entity | undefined) => void;

  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    logCallback: (msg: string) => void,
    statsCallback: (entity: Entity | undefined) => void,
  ) {
    this.canvas = canvas;
    this.world = new World();
    this.persistence = new PersistenceService(this.world);
    this.genetics = new GeneticsService(this.world);
    this.inventory = new InventoryService(this.world);
    this.logCallback = logCallback;
    this.statsCallback = statsCallback;
    
    this.executor = new SystemExecutor(
      this.world, 
      logCallback, 
      this.genetics, 
      this.inventory
    );

    // Initial renderer (GRID_2D)
    this.renderer = RendererFactory.create('GRID_2D', {
      canvas,
      cellSize: 28,
      palette: {},
      fontFamily: "'JetBrains Mono', monospace",
    });
  }

  /** Load and initialize a validated cartridge */
  loadCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    this.world.clear();
    this.turnCount = 0;
    this.depth = 1;

    // Update renderer from cartridge config
    const activeCanvas = (typeof document !== 'undefined' ? document.getElementById('game-canvas') as HTMLCanvasElement : null) || this.canvas;
    this.renderer = RendererFactory.create(cartridge.meta.renderer_mode, {
      canvas: activeCanvas,
      cellSize: 28,
      palette: cartridge.meta.palette ?? {},
      fontFamily: "'JetBrains Mono', monospace",
    });

    if (this.renderer && 'resetExploration' in (this.renderer as any)) {
      (this.renderer as any).resetExploration();
    }

    // Register component definitions
    const compDefs: any = {};
    for (const [name, def] of Object.entries(cartridge.components)) {
      if ('fields' in def) {
        compDefs[name] = { name, ...def };
      } else {
        // Simple format -> convert to full
        compDefs[name] = { name, fields: def, persistent: true };
      }
    }
    this.world.registerComponentDefinitions(compDefs);

    // Register blueprints (including default stairs if not provided)
    const blueprints: Record<string, any> = {
      stairs: {
        Renderable: { glyph: '>', color: '#ffd700', layer: 1 },
        Glyph: { char: '>', color: '#ffd700' },
        Description: { name: 'Dungeon Stairs', text: 'Descend to deeper complex' },
      },
      ...cartridge.blueprints,
    };
    this.world.registerBlueprints(blueprints);

    // Configure genetics
    if (cartridge.traits) {
      this.genetics.setTraits(cartridge.traits);
    }

    // Load systems
    this.executor.loadSystems(cartridge.systems);

    // Generate map
    this.map = generateMap(cartridge);

    // Shuffle floor tiles for random placement
    const available = [...this.map.floorTiles];
    this.shuffleArray(available);

    // Find and spawn player blueprint (first blueprint with Faction.id === "player")
    let spawnIdx = 0;
    for (const [name, bp] of Object.entries(cartridge.blueprints)) {
      const faction = bp['Faction'] as { id: string } | undefined;
      if (faction?.id === 'player' && available[spawnIdx]) {
        const pos = available[spawnIdx++];
        const player = this.world.spawn(name, {
          Position: { x: pos.x, y: pos.y },
        });
        this.playerId = player.id;
        break;
      }
    }

    // Spawn stairs if available on this map
    if (this.map.stairsPosition) {
      this.world.spawn('stairs', {
        Position: { x: this.map.stairsPosition.x, y: this.map.stairsPosition.y },
      });
    }

    // Spawn enemies from spawn_table
    if (cartridge.world_gen.spawn_table) {
      for (const entry of cartridge.world_gen.spawn_table) {
        const count = entry.max_per_level ?? 5;
        for (let i = 0; i < count && spawnIdx < available.length; i++) {
          // Weighted random check
          if (Math.random() < entry.weight) {
            const pos = available[spawnIdx++];
            this.world.spawn(entry.blueprint, {
              Position: { x: pos.x, y: pos.y },
            });
          }
        }
      }
    }

    this.phase = 'PLAYER_TURN';
    this.logCallback(`=== ${cartridge.meta.title.toUpperCase()} ===`);
    this.logCallback(cartridge.meta.description ?? 'A new session begins.');
    this.logCallback('Move: [WASD] or [Arrows] | Wait: [Space] | Click to Move/Attack');
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Handle keyboard input */
  handleInput(key: string): void {
    if (this.phase !== 'PLAYER_TURN') return;

    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (!player) return;

    const is3D = this.cartridge?.meta.renderer_mode === 'CELL_PSEUDO_3D' || this.cartridge?.meta.renderer_mode === 'WIREFRAME_3D';
    const pos = player.components.get('Position') as { x: number; y: number; direction?: string };

    // Wait / rest turn
    if (key === ' ' || key === '.' || key === '5') {
      this.logCallback('You wait a turn...');
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    let action = DIRECTIONS[key];
    // In 3D mode, 'a' and 'd' rotate instead of lateral move
    if (is3D && (key === 'a' || key === 'A')) action = { rotate: -1 };
    if (is3D && (key === 'd' || key === 'D')) action = { rotate: 1 };

    if (!action) return;

    // Handle rotation in 3D modes
    if (action.rotate !== undefined) {
      const dirs = ['N', 'E', 'S', 'W'];
      const currentIdx = dirs.indexOf(pos.direction || 'N');
      const newIdx = (currentIdx + action.rotate + 4) % 4;
      pos.direction = dirs[newIdx];
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    // Handle perspective-aware movement in 3D mode
    let dx = action.dx || 0;
    let dy = action.dy || 0;

    if (is3D && pos.direction && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'w' || key === 's' || key === 'W' || key === 'S')) {
      const isForward = key === 'ArrowUp' || key === 'w' || key === 'W';
      const moveScale = isForward ? 1 : -1;
      const perspectiveMap: Record<string, { dx: number; dy: number }> = {
        'N': { dx: 0, dy: -1 },
        'S': { dx: 0, dy: 1 },
        'E': { dx: 1, dy: 0 },
        'W': { dx: -1, dy: 0 },
      };
      const pDir = perspectiveMap[pos.direction];
      dx = pDir.dx * moveScale;
      dy = pDir.dy * moveScale;
    }

    this.executeAction({ dx, dy }, player);
  }

  /** Execute a directional action (move, attack, wait) */
  executeAction(action: { dx: number; dy: number }, player: Entity): void {
    const pos = player.components.get('Position') as { x: number; y: number; direction?: string };
    const dx = action.dx;
    const dy = action.dy;

    if (dx === 0 && dy === 0) {
      this.logCallback('You wait a turn...');
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    const targetX = pos.x + dx;
    const targetY = pos.y + dy;

    // Check wall collision
    if (this.map.tiles[targetY]?.[targetX] === TileType.Wall) return;

    // Check for attackable hostile entity at target position
    const targetEntity = this.getEntityAt(targetX, targetY, player.id);
    const isAttackable = targetEntity && targetEntity.components.has('Health') && (
      (targetEntity.components.has('Faction') && (targetEntity.components.get('Faction') as any).id !== 'player') ||
      targetEntity.components.has('CombatStats')
    );

    if (isAttackable && targetEntity) {
      const targetHealthBefore = (targetEntity.components.get('Health') as { current: number } | undefined)?.current;

      // Bump attack — emit ACTION_ATTACK event
      this.executor.emit({
        name: 'ACTION_ATTACK',
        source: player,
        target: targetEntity,
      });
      this.world.flush();

      sound.playAttack();
      const targetHealthAfter = (targetEntity.components.get('Health') as { current: number } | undefined)?.current;
      const stillAlive = this.world.getEntity(targetEntity.id);

      if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
        if (!stillAlive) {
          (this.renderer as any).addFloatingText(targetX, targetY, 'SLAIN!', '#ff0055');
          sound.playDefeat();
        } else if (targetHealthBefore !== undefined && targetHealthAfter !== undefined && targetHealthBefore > targetHealthAfter) {
          const dmg = targetHealthBefore - targetHealthAfter;
          (this.renderer as any).addFloatingText(targetX, targetY, `-${dmg}`, '#ff3344');
          sound.playHit();
        }
      }
    } else {
      // Move onto tile
      pos.x = targetX;
      pos.y = targetY;
      this.executor.emit({
        name: 'ACTION_MOVE',
        source: player,
      });
      this.world.flush();
      sound.playMove();

      // Check for item pickups on this tile
      const itemsOnTile = this.world.allEntities().filter(e => {
        if (e.id === player.id) return false;
        const ePos = e.components.get('Position') as { x: number; y: number } | undefined;
        return ePos && ePos.x === targetX && ePos.y === targetY;
      });

      for (const item of itemsOnTile) {
        const desc = item.components.get('Description') as { name: string; text?: string } | undefined;
        const name = desc?.name || '';
        const text = desc?.text || '';

        // 1. Dungeon Stairs / Level Transition
        if (name.includes('Stairs') || name.includes('Hatch') || item.id.startsWith('stairs_') || item.components.has('Stairs')) {
          this.logCallback(`You step onto ${name || 'the stairs'} and descend deeper...`);
          sound.playItem();
          this.descendFloor();
          return;
        }

        // 2. Health pack / Repair Kit pickup
        else if (name === 'Repair Kit' || name.includes('Health') || text.includes('Restores') || item.components.has('HealthPack')) {
          const playerHealth = player.components.get('Health') as { current: number; max: number } | undefined;
          if (playerHealth) {
            const healAmount = 25;
            const oldHp = playerHealth.current;
            playerHealth.current = Math.min(playerHealth.max, playerHealth.current + healAmount);
            const actualHeal = playerHealth.current - oldHp;

            this.logCallback(`Picked up ${name || 'Health Pack'} (+${actualHeal} HP)!`);
            sound.playItem();
            if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
              (this.renderer as any).addFloatingText(targetX, targetY, `+${actualHeal} HP`, '#00ff88');
            }
            this.world.queueDestroy(item.id);
          }
        }

        // 3. Equippable weapon / armor / shield
        else if (item.components.has('Equippable')) {
          const equippable = item.components.get('Equippable') as { slot: string; modifiers: Record<string, number> };
          this.inventory.equip(player, item, equippable.slot);

          // Remove from map grid, but keep alive in world for modifier lookups
          item.components.delete('Position');
          item.components.delete('Renderable');
          item.components.delete('Glyph');

          const modDesc = Object.entries(equippable.modifiers || {})
            .map(([k, v]) => `+${v} ${k.split('.').pop()}`)
            .join(', ');
          this.logCallback(`Equipped ${name || 'Gear'} into ${equippable.slot}${modDesc ? ` (${modDesc})` : ''}!`);
          sound.playItem();
          if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
            (this.renderer as any).addFloatingText(targetX, targetY, `Equipped ${name}`, '#00f0ff');
          }
          this.statsCallback(player);
        }
      }
      this.world.flush();
    }

    this.finishTurn(player);
  }

  /** Handle mouse click on a map tile (click-to-move or click-to-attack) */
  handleTileClick(targetX: number, targetY: number): void {
    if (this.phase !== 'PLAYER_TURN') return;
    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (!player) return;

    const pos = player.components.get('Position') as { x: number; y: number } | undefined;
    if (!pos) return;

    const dx = targetX - pos.x;
    const dy = targetY - pos.y;

    // If clicked adjacent tile, move or attack
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0)) {
      this.executeAction({ dx, dy }, player);
    } else if (dx === 0 && dy === 0) {
      // Clicked on self = wait
      this.executeAction({ dx: 0, dy: 0 }, player);
    }
  }

  /** Complete turn cycle: enemy actions, status effects, and render */
  private finishTurn(player: Entity): void {
    // Check if player died
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = 'GAME_OVER';
      sound.playGameOver();
      this.logCallback('=== GAME OVER ===');
      this.render();
      return;
    }

    // Enemy turn
    const playerHealthBefore = (player.components.get('Health') as { current: number } | undefined)?.current;
    this.processEnemyTurns(player);
    this.world.flush();

    const playerHealthAfter = (player.components.get('Health') as { current: number } | undefined)?.current;
    if (playerHealthBefore !== undefined && playerHealthAfter !== undefined && playerHealthBefore > playerHealthAfter) {
      const dmg = playerHealthBefore - playerHealthAfter;
      const pPos = player.components.get('Position') as { x: number; y: number } | undefined;
      if (pPos && this.renderer && 'addFloatingText' in (this.renderer as any)) {
        (this.renderer as any).addFloatingText(pPos.x, pPos.y, `-${dmg}`, '#ff0033');
      }
      sound.playHit();
    }

    // Check player again after enemy actions
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = 'GAME_OVER';
      sound.playGameOver();
      this.logCallback('=== GAME OVER ===');
      this.render();
      return;
    }

    // Emit TURN_END for DOT/poison/etc systems
    this.turnCount++;
    this.executor.emit({ name: 'TURN_END', source: player });
    this.world.flush();

    this.phase = 'PLAYER_TURN';
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Simple enemy AI — move toward player and bump attack */
  private processEnemyTurns(player: Entity): void {
    const playerPos = player.components.get('Position') as { x: number; y: number };
    const enemies = this.world.allEntities().filter(e => {
      const faction = e.components.get('Faction') as { id: string } | undefined;
      return faction && faction.id !== 'player' && e.components.has('Position');
    });

    for (const enemy of enemies) {
      // Emit TURN_START for per-entity turn effects
      this.executor.emit({ name: 'TURN_START', source: enemy });

      // Skip if stunned
      if (enemy.tags.has('stunned')) continue;

      const ePos = enemy.components.get('Position') as { x: number; y: number };
      const dx = Math.sign(playerPos.x - ePos.x);
      const dy = Math.sign(playerPos.y - ePos.y);

      // Try to move toward player (prefer axis with larger distance)
      const adx = Math.abs(playerPos.x - ePos.x);
      const ady = Math.abs(playerPos.y - ePos.y);
      const moves = adx >= ady
        ? [{ dx, dy: 0 }, { dx: 0, dy }]
        : [{ dx: 0, dy }, { dx, dy: 0 }];

      for (const m of moves) {
        if (m.dx === 0 && m.dy === 0) continue;
        const nx = ePos.x + m.dx;
        const ny = ePos.y + m.dy;

        // Check walkable
        if (this.map.tiles[ny]?.[nx] !== TileType.Floor) continue;

        // Check if player is there → attack
        if (nx === playerPos.x && ny === playerPos.y) {
          this.executor.emit({
            name: 'ACTION_ATTACK',
            source: enemy,
            target: player,
          });
          break;
        }

        // Check if another entity is blocking
        if (this.getEntityAt(nx, ny)) continue;

        // Move
        ePos.x = nx;
        ePos.y = ny;
        break;
      }
    }
  }

  /** Find an entity at a grid position (optionally excluding one) */
  getEntityAt(x: number, y: number, excludeId?: EntityId): Entity | undefined {
    return this.world.allEntities().find(e => {
      if (excludeId && e.id === excludeId) return false;
      const pos = e.components.get('Position') as { x: number; y: number } | undefined;
      return pos && pos.x === x && pos.y === y;
    });
  }

  /** Render the current game state */
  render(): void {
    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (player) {
      const pos = player.components.get('Position') as { x: number; y: number };
      this.renderer.centerOn(pos.x, pos.y);
    }
    this.renderer.render(this.map, this.world.allEntities());
  }

  // --- Public Getters & Control Methods for UI ---

  getCartridge(): Cartridge | undefined { return this.cartridge; }
  getMap(): GameMap | undefined { return this.map; }
  getPlayer(): Entity | undefined { return this.playerId ? this.world.getEntity(this.playerId) : undefined; }
  getEntities(): Entity[] { return this.world.allEntities(); }
  getTurnCount(): number { return this.turnCount; }
  getPhase(): GamePhase { return this.phase; }
  getRenderer(): IRenderer { return this.renderer; }

  setHoveredTile(x: number | null, y: number | null): void {
    if (this.renderer && 'setHoveredTile' in (this.renderer as any)) {
      (this.renderer as any).setHoveredTile(x !== null && y !== null ? { x, y } : null);
    }
  }

  addFloatingText(x: number, y: number, text: string, color?: string): void {
    if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
      (this.renderer as any).addFloatingText(x, y, text, color);
    }
  }

  /** Descend to next dungeon depth */
  descendFloor(): void {
    this.depth++;
    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (!player) return;

    // Reset renderer exploration for the new floor
    if (this.renderer && 'resetExploration' in (this.renderer as any)) {
      (this.renderer as any).resetExploration();
    }

    // Keep player and player's equipped items, destroy everything else
    const eq = player.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    const equippedItemIds = new Set(Object.values(eq?.slots ?? {}).filter(Boolean));

    for (const ent of this.world.allEntities()) {
      if (ent.id !== player.id && !equippedItemIds.has(ent.id)) {
        this.world.queueDestroy(ent.id);
      }
    }
    this.world.flush();

    // Generate fresh map for new depth
    this.map = generateMap(this.cartridge);
    const available = [...this.map.floorTiles];
    this.shuffleArray(available);

    // Place player at first floor tile
    let spawnIdx = 0;
    if (available[spawnIdx]) {
      const pPos = available[spawnIdx++];
      player.components.set('Position', { x: pPos.x, y: pPos.y });
    }

    // Spawn stairs for this floor
    if (this.map.stairsPosition) {
      this.world.spawn('stairs', {
        Position: { x: this.map.stairsPosition.x, y: this.map.stairsPosition.y },
      });
    }

    // Spawn enemies from spawn_table (with depth scaling)
    if (this.cartridge.world_gen.spawn_table) {
      for (const entry of this.cartridge.world_gen.spawn_table) {
        const count = entry.max_per_level ?? 5;
        for (let i = 0; i < count && spawnIdx < available.length; i++) {
          if (Math.random() < entry.weight) {
            const pos = available[spawnIdx++];
            const enemy = this.world.spawn(entry.blueprint, {
              Position: { x: pos.x, y: pos.y },
            });
            const eHealth = enemy.components.get('Health') as { current: number; max: number } | undefined;
            if (eHealth && this.depth > 1) {
              const bonus = (this.depth - 1) * 5;
              eHealth.max += bonus;
              eHealth.current += bonus;
            }
          }
        }
      }
    }

    this.logCallback(`=== DESCENDED TO DEPTH ${this.depth} ===`);
    this.logCallback(`Air grows colder. Deeper threats lurk in the shadows.`);
    sound.playItem();
    this.render();
    this.statsCallback(player);
  }

  getDepth(): number { return this.depth; }
  getInventoryService(): InventoryService { return this.inventory; }

  equipItem(slot: string, item: Entity): void {
    const player = this.getPlayer();
    if (!player) return;
    this.inventory.equip(player, item, slot);
    this.statsCallback(player);
  }

  unequipItem(slot: string): void {
    const player = this.getPlayer();
    if (!player) return;
    this.inventory.unequip(player, slot);
    this.statsCallback(player);
  }

  getEquippedItems(): Record<string, Entity | undefined> {
    const player = this.getPlayer();
    if (!player) return {};
    const eq = player.components.get('Equipment') as { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) return {};
    const result: Record<string, Entity | undefined> = {};
    for (const [slot, id] of Object.entries(eq.slots)) {
      result[slot] = id ? this.world.getEntity(id) : undefined;
    }
    return result;
  }

  restart(): void {
    if (this.cartridge) {
      this.loadCartridge(this.cartridge);
    }
  }

  /** Export current game state as JSON */
  saveGame(): string {
    const data = this.persistence.save(this.turnCount, this.playerId, this.map.tiles);
    return JSON.stringify(data);
  }

  /** Restore game state from JSON */
  loadGame(json: string): void {
    const data = JSON.parse(json) as SaveData;
    const result = this.persistence.load(data);
    
    this.turnCount = result.turnCount;
    this.playerId = result.playerId;
    
    if (result.mapTiles) {
      this.map.tiles = result.mapTiles;
    }

    this.logCallback('--- GAME LOADED ---');
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Fisher-Yates shuffle */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

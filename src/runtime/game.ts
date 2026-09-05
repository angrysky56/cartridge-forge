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

  // Progression & Stats
  private level = 1;
  private xp = 0;
  private xpToNextLevel = 50;
  private monstersSlain = 0;
  private chestsOpened = 0;
  private secretsFound = 0;
  private dashCooldown = 0;
  private bashCooldown = 0;
  private lastDirection = { dx: 0, dy: -1 };

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
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 50;
    this.monstersSlain = 0;
    this.chestsOpened = 0;
    this.secretsFound = 0;
    this.dashCooldown = 0;
    this.bashCooldown = 0;
    this.lastDirection = { dx: 0, dy: -1 };

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

    // Register blueprints (including default stairs, chests, shrines, and boss)
    const blueprints: Record<string, any> = {
      stairs: {
        Renderable: { glyph: '>', color: '#ffd700', layer: 1 },
        Glyph: { char: '>', color: '#ffd700' },
        Description: { name: 'Dungeon Stairs', text: 'Descend to deeper complex' },
      },
      chest: {
        Renderable: { glyph: '=', color: '#ffd700', layer: 1 },
        Glyph: { char: '=', color: '#ffd700' },
        Description: { name: 'Treasure Chest', text: 'Contains guaranteed equipment or potions.' },
      },
      cracked_wall: {
        Renderable: { glyph: '?', color: '#aa9977', layer: 1 },
        Glyph: { char: '?', color: '#aa9977' },
        Description: { name: 'Cracked Secret Wall', text: 'Brittle masonry hiding a secret.' },
      },
      shrine: {
        Renderable: { glyph: '&', color: '#ff00ea', layer: 1 },
        Glyph: { char: '&', color: '#ff00ea' },
        Description: { name: 'Ancient Shrine', text: 'Step to receive ancient blessings.' },
      },
      minotaur_boss: {
        Renderable: { glyph: 'M', color: '#ff0055', layer: 2 },
        Glyph: { char: 'M', color: '#ff0055' },
        Health: { current: 180, max: 180 },
        CombatStats: { strength: 22, armor: 6 },
        Faction: { id: 'monster' },
        Description: { name: 'Minotaur Crypt Lord', text: 'The ancient guardian of the labyrinth.' },
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

    // Spawn stairs, chests, shrines, and enemies
    this.spawnDungeonFeatures(available, spawnIdx);

    this.phase = 'PLAYER_TURN';
    this.logCallback(`=== ${cartridge.meta.title.toUpperCase()} ===`);
    this.logCallback(cartridge.meta.description ?? 'A new session begins.');
    this.logCallback('Move: [WASD] | Wait: [Space] | Dash: [1] | Shield Bash: [2]');
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

    // Tactical Abilities
    if (key === '1') {
      this.usePhaseDash();
      return;
    }
    if (key === '2') {
      this.useShieldBash();
      return;
    }

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
    const { dx, dy } = action;
    const pos = player.components.get('Position') as { x: number; y: number; direction?: string };
    if (dx !== 0 || dy !== 0) {
      this.lastDirection = { dx, dy };
    }

    if (dx === 0 && dy === 0) {
      this.logCallback('You wait a turn...');
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    const targetX = pos.x + dx;
    const targetY = pos.y + dy;

    // Check for cracked secret wall collision
    const secretWall = this.getEntityAt(targetX, targetY);
    if (secretWall && (secretWall.id.startsWith('cracked_wall_') || (secretWall.components.get('Description') as any)?.name?.includes('Cracked'))) {
      this.map.tiles[targetY][targetX] = TileType.Floor;
      this.world.queueDestroy(secretWall.id);
      this.world.flush();
      this.secretsFound++;
      sound.playHit();
      this.logCallback('The cracked wall crumbles, revealing a hidden passage!');
      if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
        (this.renderer as any).addFloatingText(targetX, targetY, 'SECRET FOUND!', '#00ffcc');
      }
      this.finishTurn(player);
      return;
    }

    // Check wall collision
    if (this.map.tiles[targetY]?.[targetX] === TileType.Wall) return;

    // Check for attackable hostile entity at target position
    const targetEntity = this.getEntityAt(targetX, targetY, player.id);
    const isAttackable = targetEntity && targetEntity.components.has('Health') && (
      (targetEntity.components.has('Faction') && (targetEntity.components.get('Faction') as any).id !== 'player') ||
      targetEntity.components.has('CombatStats')
    );

    if (isAttackable && targetEntity) {
      targetEntity.tags.add('alerted');
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
          this.monstersSlain++;
          const targetDesc = (targetEntity.components.get('Description') as any)?.name || '';
          const xpGain = targetDesc.includes('Lord') || targetDesc.includes('Boss') || targetDesc.includes('Champion') || targetDesc.includes('Minotaur')
            ? 150
            : targetDesc.includes('Orc')
            ? 50
            : targetDesc.includes('Skeleton')
            ? 30
            : 15;
          this.addXP(xpGain);
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

      // Check for item pickups and interactive entities on this tile
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

        // 4. Treasure Chest
        else if (name.includes('Chest') || item.id.startsWith('chest_')) {
          this.chestsOpened++;
          this.world.queueDestroy(item.id);
          this.world.flush();
          sound.playItem();
          if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
            (this.renderer as any).addFloatingText(targetX, targetY, 'CHEST OPENED!', '#ffd700');
          }
          const lootList = ['broadsword', 'iron_shield', 'health_potion'];
          const chosen = lootList[Math.floor(Math.random() * lootList.length)];
          if (this.cartridge.blueprints[chosen]) {
            this.world.spawn(chosen, { Position: { x: targetX, y: targetY } });
          }
          this.logCallback('You unlocked the Treasure Chest! Gear emerged onto the floor!');
          continue;
        }

        // 5. Ancient Shrine
        else if (name.includes('Shrine') || item.id.startsWith('shrine_')) {
          const pStats = player.components.get('CombatStats') as Record<string, number> | undefined;
          const pHealth = player.components.get('Health') as { current: number; max: number } | undefined;
          if (pStats && pHealth) {
            pStats.strength = (pStats.strength || 10) + 3;
            pHealth.max += 15;
            pHealth.current = pHealth.max;
          }
          this.world.queueDestroy(item.id);
          this.world.flush();
          sound.playLevelUp();
          if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
            (this.renderer as any).addFloatingText(targetX, targetY, '+SHRINE BLESSING!', '#00ffaa');
          }
          this.logCallback('Ancient blessing received! (+3 Strength, +15 Max HP, Full Health)!');
          this.statsCallback(player);
          continue;
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
    // Decrement ability cooldowns
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.bashCooldown > 0) this.bashCooldown--;

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

  /** Sensory Enemy AI — only alert and pursue if within sensory range or damaged */
  private processEnemyTurns(player: Entity): void {
    const playerPos = player.components.get('Position') as { x: number; y: number };
    const enemies = this.world.allEntities().filter(e => {
      const faction = e.components.get('Faction') as { id: string } | undefined;
      return faction && faction.id !== 'player' && e.components.has('Position');
    });

    for (const enemy of enemies) {
      // Emit TURN_START for per-entity turn effects
      this.executor.emit({ name: 'TURN_START', source: enemy });

      // If stunned, consume stun effect and skip turn
      if (enemy.tags.has('stunned')) {
        enemy.tags.delete('stunned');
        const ePos = enemy.components.get('Position') as { x: number; y: number };
        if (this.renderer && 'addFloatingText' in (this.renderer as any)) {
          (this.renderer as any).addFloatingText(ePos.x, ePos.y, 'STUNNED', '#ffaa00');
        }
        continue;
      }

      const ePos = enemy.components.get('Position') as { x: number; y: number };
      const adx = Math.abs(playerPos.x - ePos.x);
      const ady = Math.abs(playerPos.y - ePos.y);
      const chebyshevDist = Math.max(adx, ady);

      // Sensory AI: Only alert if within 7 tiles or already alerted by combat/damage
      if (chebyshevDist > 7 && !enemy.tags.has('alerted')) {
        // Dormant/Idle: distant enemies do not swarm corridors across the entire map
        continue;
      }
      enemy.tags.add('alerted');

      const dx = Math.sign(playerPos.x - ePos.x);
      const dy = Math.sign(playerPos.y - ePos.y);

      // Try to move toward player (prefer axis with larger distance)
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

  /** Spawn stairs, chests, shrines, secrets, and monsters for current floor */
  private spawnDungeonFeatures(available: { x: number; y: number }[], spawnIdx: number): void {
    // 1. Spawn stairs for this floor
    if (this.map.stairsPosition) {
      this.world.spawn('stairs', {
        Position: { x: this.map.stairsPosition.x, y: this.map.stairsPosition.y },
      });
    }

    // 2. Spawn 2 guaranteed Treasure Chests on floor tiles
    for (let i = 0; i < 2 && spawnIdx < available.length; i++) {
      const pos = available[spawnIdx++];
      this.world.spawn('chest', { Position: { x: pos.x, y: pos.y } });
    }

    // 3. Spawn 1 Ancient Shrine
    if (spawnIdx < available.length) {
      const pos = available[spawnIdx++];
      this.world.spawn('shrine', { Position: { x: pos.x, y: pos.y } });
    }

    // 4. Spawn 1 Secret Wall (place cracked_wall on a wall adjacent to an accessible floor tile)
    let secretPlaced = false;
    for (const floorTile of available) {
      const neighbors = [
        { x: floorTile.x + 1, y: floorTile.y },
        { x: floorTile.x - 1, y: floorTile.y },
        { x: floorTile.x, y: floorTile.y + 1 },
        { x: floorTile.x, y: floorTile.y - 1 },
      ];
      for (const n of neighbors) {
        if (this.map.tiles[n.y]?.[n.x] === TileType.Wall && !this.getEntityAt(n.x, n.y)) {
          this.world.spawn('cracked_wall', { Position: { x: n.x, y: n.y } });
          secretPlaced = true;
          break;
        }
      }
      if (secretPlaced) break;
    }

    // 5. Boss Spawn on Depth 3 (Minotaur Crypt Lord)
    if (this.depth === 3 && spawnIdx < available.length) {
      const pos = available[spawnIdx++];
      this.world.spawn('minotaur_boss', { Position: { x: pos.x, y: pos.y } });
      this.logCallback('WARNING: The ground quakes... Minotaur Crypt Lord has awakened!');
    }

    // 6. Spawn enemies from spawn_table (with depth scaling)
    if (this.cartridge?.world_gen.spawn_table) {
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
  }

  /** Tactical Ability 1: Phase Dash 2 tiles forward, skipping over intervening hazards/enemies */
  usePhaseDash(): boolean {
    if (this.phase !== 'PLAYER_TURN') return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.dashCooldown > 0) {
      this.logCallback(`Phase Dash recharging (${this.dashCooldown} turn${this.dashCooldown > 1 ? 's' : ''} left)!`);
      sound.playHit();
      return false;
    }

    const pos = player.components.get('Position') as { x: number; y: number };
    const dx = this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0 ? this.lastDirection.dx : 0;
    const dy = this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0 ? this.lastDirection.dy : 1;

    // Check 2 tiles ahead, or fallback to 1 tile ahead
    let targetX = pos.x + dx * 2;
    let targetY = pos.y + dy * 2;

    if (this.map.tiles[targetY]?.[targetX] !== TileType.Floor || this.getEntityAt(targetX, targetY)) {
      targetX = pos.x + dx;
      targetY = pos.y + dy;
    }

    if (this.map.tiles[targetY]?.[targetX] !== TileType.Floor || this.getEntityAt(targetX, targetY)) {
      this.logCallback('Phase Dash blocked by obstacle or creature!');
      sound.playHit();
      return false;
    }

    pos.x = targetX;
    pos.y = targetY;
    this.dashCooldown = 6;
    sound.playAbility();
    this.addFloatingText(targetX, targetY, 'PHASE DASH!', '#00f0ff');
    this.logCallback('You warp through space, escaping danger!');
    this.finishTurn(player);
    return true;
  }

  /** Tactical Ability 2: Shield Bash knockback & stun */
  useShieldBash(): boolean {
    if (this.phase !== 'PLAYER_TURN') return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.bashCooldown > 0) {
      this.logCallback(`Shield Bash recharging (${this.bashCooldown} turn${this.bashCooldown > 1 ? 's' : ''} left)!`);
      sound.playHit();
      return false;
    }

    const pos = player.components.get('Position') as { x: number; y: number };
    const candidates = [
      { dx: this.lastDirection.dx, dy: this.lastDirection.dy },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    let targetEnemy: Entity | undefined;
    let bashDir = { dx: 0, dy: 1 };

    for (const c of candidates) {
      if (c.dx === 0 && c.dy === 0) continue;
      const ent = this.getEntityAt(pos.x + c.dx, pos.y + c.dy, player.id);
      if (ent && ent.components.has('Health') && (
        (ent.components.has('Faction') && (ent.components.get('Faction') as any).id !== 'player') ||
        ent.components.has('CombatStats')
      )) {
        targetEnemy = ent;
        bashDir = c;
        break;
      }
    }

    if (!targetEnemy) {
      this.logCallback('No adjacent enemy to Shield Bash!');
      sound.playHit();
      return false;
    }

    const ePos = targetEnemy.components.get('Position') as { x: number; y: number };
    const pStats = player.components.get('CombatStats') as Record<string, number> | undefined;
    const pStr = pStats?.strength || 10;
    const eHealth = targetEnemy.components.get('Health') as { current: number; max: number };

    // Knockback 1 tile if destination floor tile is walkable & empty
    const knockX = ePos.x + bashDir.dx;
    const knockY = ePos.y + bashDir.dy;
    if (this.map.tiles[knockY]?.[knockX] === TileType.Floor && !this.getEntityAt(knockX, knockY)) {
      ePos.x = knockX;
      ePos.y = knockY;
    }

    // Damage & Stun
    const bashDamage = Math.floor(pStr * 0.8) + 4;
    eHealth.current -= bashDamage;
    targetEnemy.tags.add('stunned');
    targetEnemy.tags.add('alerted');

    this.bashCooldown = 4;
    sound.playAbility();

    const desc = (targetEnemy.components.get('Description') as any)?.name || 'Enemy';
    if (eHealth.current <= 0) {
      this.world.queueDestroy(targetEnemy.id);
      this.world.flush();
      sound.playDefeat();
      this.addFloatingText(ePos.x, ePos.y, 'BASH CRUSHED!', '#ff0055');
      this.logCallback(`Shield Bash shattered ${desc}!`);
      this.monstersSlain++;
      this.addXP(40);
    } else {
      this.addFloatingText(ePos.x, ePos.y, `BASH -${bashDamage} (STUNNED)`, '#ffaa00');
      this.logCallback(`You slam your shield into ${desc} for ${bashDamage} dmg! It is stunned!`);
    }

    this.finishTurn(player);
    return true;
  }

  /** Add experience and handle level-up progression */
  addXP(amount: number): void {
    const player = this.getPlayer();
    if (!player) return;

    this.xp += amount;
    this.logCallback(`+${amount} XP (${this.xp}/${this.xpToNextLevel})`);

    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.6);

      const pHealth = player.components.get('Health') as { current: number; max: number } | undefined;
      const pStats = player.components.get('CombatStats') as Record<string, number> | undefined;

      if (pHealth) {
        pHealth.max += 12;
        pHealth.current = pHealth.max; // Full heal upon level up!
      }
      if (pStats) {
        pStats.strength = (pStats.strength || 10) + 2;
        pStats.armor = (pStats.armor || 0) + 1;
      }

      sound.playLevelUp();
      const pos = player.components.get('Position') as { x: number; y: number } | undefined;
      if (pos) {
        this.addFloatingText(pos.x, pos.y, `LEVEL UP! (LVL ${this.level})`, '#ffd700');
      }
      this.logCallback(`=== LEVEL UP! Reached Level ${this.level}! (+12 Max HP, +2 STR, +1 DEF, Health Fully Restored!) ===`);
    }

    this.statsCallback(player);
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

    // Spawn stairs, chests, shrines, secrets, and monsters
    this.spawnDungeonFeatures(available, spawnIdx);

    this.logCallback(`=== DESCENDED TO DEPTH ${this.depth} ===`);
    this.logCallback(`Air grows colder. Deeper threats lurk in the shadows.`);
    sound.playItem();
    this.render();
    this.statsCallback(player);
  }

  getDepth(): number { return this.depth; }
  getLevel(): number { return this.level; }
  getXP(): { current: number; next: number } { return { current: this.xp, next: this.xpToNextLevel }; }
  getCooldowns(): { dash: number; bash: number } { return { dash: this.dashCooldown, bash: this.bashCooldown }; }
  getStatsSummary(): { monstersSlain: number; chestsOpened: number; secretsFound: number; depth: number; level: number; turnCount: number } {
    return {
      monstersSlain: this.monstersSlain,
      chestsOpened: this.chestsOpened,
      secretsFound: this.secretsFound,
      depth: this.depth,
      level: this.level,
      turnCount: this.turnCount,
    };
  }
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

/**
 * Game Runtime — the turn-based game loop that connects all subsystems.
 * Handles: cartridge loading → world init → map gen → input → turn processing → render
 */

import { World } from '../ecs/world.js';
import { SystemExecutor, type GameEvent } from '../dsl/executor.js';
import { CanvasRenderer } from '../renderer/canvas.js';
import { generateMap, type GameMap, TileType } from './mapgen.js';
import type { Cartridge } from '../cartridge/schema.js';
import type { Entity, EntityId } from '../ecs/types.js';

/** Game state phases */
export type GamePhase = 'LOADING' | 'PLAYER_TURN' | 'ENEMY_TURN' | 'GAME_OVER';

/** Turn direction mappings */
const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  ArrowUp:    { dx: 0,  dy: -1 },
  ArrowDown:  { dx: 0,  dy: 1 },
  ArrowLeft:  { dx: -1, dy: 0 },
  ArrowRight: { dx: 1,  dy: 0 },
  // Numpad / vi keys for diagonal support
  y: { dx: -1, dy: -1 }, u: { dx: 1, dy: -1 },
  b: { dx: -1, dy: 1 },  n: { dx: 1, dy: 1 },
  h: { dx: -1, dy: 0 },  l: { dx: 1, dy: 0 },
  k: { dx: 0,  dy: -1 }, j: { dx: 0, dy: 1 },
};

export class Game {
  private world: World;
  private executor: SystemExecutor;
  private renderer: CanvasRenderer;
  private map!: GameMap;
  private cartridge!: Cartridge;
  private phase: GamePhase = 'LOADING';
  private playerId: EntityId | null = null;
  private turnCount = 0;

  /** UI callback for combat log messages */
  private logCallback: (msg: string) => void;
  /** UI callback for stats panel updates */
  private statsCallback: (entity: Entity | undefined) => void;

  constructor(
    canvas: HTMLCanvasElement,
    logCallback: (msg: string) => void,
    statsCallback: (entity: Entity | undefined) => void,
  ) {
    this.world = new World();
    this.logCallback = logCallback;
    this.statsCallback = statsCallback;
    this.executor = new SystemExecutor(this.world, logCallback);

    this.renderer = new CanvasRenderer({
      canvas,
      cellSize: 16,
      palette: {},
      fontFamily: "'Courier New', monospace",
    });
  }

  /** Load and initialize a validated cartridge */
  loadCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    this.world.clear();
    this.turnCount = 0;

    // Update renderer palette from cartridge
    this.renderer = new CanvasRenderer({
      canvas: document.getElementById('game-canvas') as HTMLCanvasElement,
      cellSize: 16,
      palette: cartridge.meta.palette ?? {},
      fontFamily: "'Courier New', monospace",
    });

    // Register blueprints
    this.world.registerBlueprints(cartridge.blueprints);

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
    this.logCallback(`--- ${cartridge.meta.title} ---`);
    this.logCallback(cartridge.meta.description ?? 'A new game begins.');
    this.logCallback('Use arrow keys or hjkl to move. Bump to attack.');
    this.render();
  }

  /** Handle keyboard input — main player action dispatcher */
  handleInput(key: string): void {
    if (this.phase !== 'PLAYER_TURN') return;

    const dir = DIRECTIONS[key];
    if (!dir) return; // Unrecognized key

    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (!player) {
      this.phase = 'GAME_OVER';
      this.logCallback('You have been destroyed.');
      return;
    }

    const pos = player.components.get('Position') as { x: number; y: number };
    const targetX = pos.x + dir.dx;
    const targetY = pos.y + dir.dy;

    // Check wall collision
    if (this.map.tiles[targetY]?.[targetX] === TileType.Wall) return;

    // Check for entity at target position (bump attack)
    const targetEntity = this.getEntityAt(targetX, targetY, player.id);

    if (targetEntity) {
      // Bump attack — emit ACTION_ATTACK event
      this.executor.emit({
        name: 'ACTION_ATTACK',
        source: player,
        target: targetEntity,
      });
    } else {
      // Move — emit ACTION_MOVE event
      pos.x = targetX;
      pos.y = targetY;
      this.executor.emit({
        name: 'ACTION_MOVE',
        source: player,
      });
    }

    // Flush spawns/destructions from player action
    this.world.flush();

    // Check if player died
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = 'GAME_OVER';
      this.logCallback('=== GAME OVER ===');
      this.render();
      return;
    }

    // Enemy turn
    this.processEnemyTurns(player);
    this.world.flush();

    // Check player again after enemy actions
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = 'GAME_OVER';
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

      let moved = false;
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
          moved = true;
          break;
        }

        // Check if another entity is blocking
        if (this.getEntityAt(nx, ny)) continue;

        // Move
        ePos.x = nx;
        ePos.y = ny;
        moved = true;
        break;
      }
    }
  }

  /** Find an entity at a grid position (optionally excluding one) */
  private getEntityAt(x: number, y: number, excludeId?: EntityId): Entity | undefined {
    return this.world.allEntities().find(e => {
      if (excludeId && e.id === excludeId) return false;
      const pos = e.components.get('Position') as { x: number; y: number } | undefined;
      return pos && pos.x === x && pos.y === y;
    });
  }

  /** Render the current game state */
  private render(): void {
    const player = this.playerId ? this.world.getEntity(this.playerId) : undefined;
    if (player) {
      const pos = player.components.get('Position') as { x: number; y: number };
      this.renderer.centerOn(pos.x, pos.y);
    }
    this.renderer.render(this.map, this.world.allEntities());
  }

  /** Fisher-Yates shuffle */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

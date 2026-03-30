/**
 * Map Generator — procedural level generation from cartridge world_gen config.
 * Currently implements cellular automata (classic roguelike caves).
 * Additional algorithms can be added as cartridge schema grows.
 */

import type { Cartridge } from '../cartridge/schema.js';

/** Tile types in the generated map */
export enum TileType {
  Floor = 0,
  Wall = 1,
}

/** A generated level map */
export interface GameMap {
  width: number;
  height: number;
  tiles: TileType[][];
  /** Walkable positions for entity spawning */
  floorTiles: Array<{ x: number; y: number }>;
  floorGlyph: string;
  wallGlyph: string;
}

/** Generate a map from cartridge world_gen configuration */
export function generateMap(cartridge: Cartridge): GameMap {
  const cfg = cartridge.world_gen;

  switch (cfg.algorithm) {
    case 'cellular_automata':
      return cellularAutomata(cfg);
    case 'bsp_rooms':
      return bspRooms(cfg);
    case 'drunkard_walk':
      return drunkardWalk(cfg);
    case 'prefab':
      // Prefab maps would load from cartridge data — stub for now
      return cellularAutomata(cfg);
    default:
      return cellularAutomata(cfg);
  }
}

/** Cellular automata cave generation */
function cellularAutomata(cfg: Cartridge['world_gen']): GameMap {
  const { width, height } = cfg;
  const density = cfg.wall_density;

  // Initialize with random fill
  let tiles: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Border walls are always solid
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        tiles[y][x] = TileType.Wall;
      } else {
        tiles[y][x] = Math.random() < density ? TileType.Wall : TileType.Floor;
      }
    }
  }

  // Run 5 smoothing iterations (standard for caves)
  for (let i = 0; i < 5; i++) {
    const newTiles: TileType[][] = [];
    for (let y = 0; y < height; y++) {
      newTiles[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          newTiles[y][x] = TileType.Wall;
          continue;
        }
        const neighbors = countWallNeighbors(tiles, x, y);
        // Classic B678/S345678 rule — walls breed walls
        newTiles[y][x] = neighbors >= 5 ? TileType.Wall : TileType.Floor;
      }
    }
    tiles = newTiles;
  }

  return buildMapResult(tiles, width, height, cfg);
}

/** BSP room generation — classic dungeon rooms connected by corridors */
function bspRooms(cfg: Cartridge['world_gen']): GameMap {
  const { width, height } = cfg;
  const minRoom = cfg.room_min_size ?? 4;
  const maxRoom = cfg.room_max_size ?? 10;

  // Start with all walls
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array(width).fill(TileType.Wall),
  );

  interface Room { x: number; y: number; w: number; h: number }
  const rooms: Room[] = [];

  // Attempt to place rooms
  for (let attempt = 0; attempt < 30; attempt++) {
    const w = minRoom + Math.floor(Math.random() * (maxRoom - minRoom));
    const h = minRoom + Math.floor(Math.random() * (maxRoom - minRoom));
    const x = 1 + Math.floor(Math.random() * (width - w - 2));
    const y = 1 + Math.floor(Math.random() * (height - h - 2));

    // Check overlap
    const overlaps = rooms.some(r =>
      x < r.x + r.w + 1 && x + w + 1 > r.x &&
      y < r.y + r.h + 1 && y + h + 1 > r.y,
    );
    if (overlaps) continue;

    // Carve the room
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        tiles[ry][rx] = TileType.Floor;
      }
    }
    rooms.push({ x, y, w, h });
  }

  // Connect rooms with L-shaped corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    const cx1 = Math.floor(prev.x + prev.w / 2);
    const cy1 = Math.floor(prev.y + prev.h / 2);
    const cx2 = Math.floor(curr.x + curr.w / 2);
    const cy2 = Math.floor(curr.y + curr.h / 2);

    // Horizontal then vertical
    for (let x = Math.min(cx1, cx2); x <= Math.max(cx1, cx2); x++) {
      tiles[cy1][x] = TileType.Floor;
    }
    for (let y = Math.min(cy1, cy2); y <= Math.max(cy1, cy2); y++) {
      tiles[y][cx2] = TileType.Floor;
    }
  }

  return buildMapResult(tiles, width, height, cfg);
}

/** Drunkard's walk — organic cave tunnels */
function drunkardWalk(cfg: Cartridge['world_gen']): GameMap {
  const { width, height } = cfg;
  const targetFloorRatio = 1 - cfg.wall_density;

  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array(width).fill(TileType.Wall),
  );

  let x = Math.floor(width / 2);
  let y = Math.floor(height / 2);
  let floorCount = 0;
  const totalTiles = width * height;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (floorCount / totalTiles < targetFloorRatio) {
    if (tiles[y][x] === TileType.Wall) {
      tiles[y][x] = TileType.Floor;
      floorCount++;
    }
    const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
    const nx = x + dx;
    const ny = y + dy;
    if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
      x = nx;
      y = ny;
    }
  }

  return buildMapResult(tiles, width, height, cfg);
}

/** Count wall neighbors in a 3x3 area around (x, y) */
function countWallNeighbors(tiles: TileType[][], x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= tiles.length || nx < 0 || nx >= tiles[0].length) {
        count++; // Out of bounds counts as wall
      } else if (tiles[ny][nx] === TileType.Wall) {
        count++;
      }
    }
  }
  return count;
}

/** Build the final GameMap result with floor tile index */
function buildMapResult(
  tiles: TileType[][],
  width: number,
  height: number,
  cfg: Cartridge['world_gen'],
): GameMap {
  const floorTiles: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === TileType.Floor) {
        floorTiles.push({ x, y });
      }
    }
  }

  return {
    width,
    height,
    tiles,
    floorTiles,
    floorGlyph: cfg.floor_glyph,
    wallGlyph: cfg.wall_glyph,
  };
}

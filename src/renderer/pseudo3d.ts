/**
 * Cell-Based Pseudo-3D Renderer — Wizardry/Bard's Tale style.
 * Renders the map as a first-person perspective grid.
 */

import type { Entity } from '../ecs/types.js';
import { type GameMap, TileType } from '../runtime/mapgen.js';
import type { IRenderer, RenderConfig } from './types.js';

export class CellPseudo3DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D;
  private palette: Record<string, string>;
  private camX = 0;
  private camY = 0;
  private camDir: 'N' | 'S' | 'E' | 'W' = 'N';
  private viewDistance = 5;

  constructor(config: RenderConfig) {
    const ctx = config.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d canvas context');
    this.ctx = ctx;
    this.palette = config.palette;
  }

  centerOn(x: number, y: number): void {
    this.camX = x;
    this.camY = y;
  }

  setDirection(dir: 'N' | 'S' | 'E' | 'W'): void {
    this.camDir = dir;
  }

  render(map: GameMap, entities: Entity[]): void {
    const { ctx } = this;
    const { width, height } = ctx.canvas;

    // Clear
    ctx.fillStyle = this.palette.bg || '#000';
    ctx.fillRect(0, 0, width, height);

    // Get player entity to determine direction if not set
    const player = entities.find(e => e.components.get('Faction')?.id === 'player');
    if (player) {
      const pos = player.components.get('Position') as { x: number; y: number; direction?: string };
      this.camX = pos.x;
      this.camY = pos.y;
      if (pos.direction) this.camDir = pos.direction as any;
    }

    // Directions vectors
    const dirMap = {
      'N': { dx: 0, dy: -1, rx: 1, ry: 0 },
      'S': { dx: 0, dy: 1,  rx: -1, ry: 0 },
      'E': { dx: 1, dy: 0,  rx: 0, ry: 1 },
      'W': { dx: -1, dy: 0, rx: 0, ry: -1 },
    };
    const { dx, dy, rx, ry } = dirMap[this.camDir];

    // Render from back to front (painter's algorithm)
    for (let d = this.viewDistance; d >= 0; d--) {
      // Calculate perspective scale
      const scale = 1 / (d + 1);
      const nextScale = 1 / (d + 2);

      // Current cell positions
      for (let side = -1; side <= 1; side++) {
        const mx = this.camX + (dx * d) + (rx * side);
        const my = this.camY + (dy * d) + (ry * side);

        if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) continue;

        const tile = map.tiles[my][mx];
        if (tile === TileType.Wall) {
          this.drawWall(d, side, scale, nextScale);
        } else {
          this.drawFloorCeiling(d, side, scale, nextScale);
        }
      }
    }
  }

  private drawWall(depth: number, side: number, scale: number, nextScale: number): void {
    const { ctx } = this;
    const { width, height } = ctx.canvas;
    const cx = width / 2;
    const cy = height / 2;

    const x1 = cx + (side - 0.5) * width * scale;
    const x2 = cx + (side + 0.5) * width * scale;
    const y1 = cy - (height / 2) * scale;
    const y2 = cy + (height / 2) * scale;

    ctx.fillStyle = this.palette.wall || '#3d3d5c';
    ctx.strokeStyle = this.palette.wall_glyph || '#555577';
    ctx.lineWidth = 2 * scale;

    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  private drawFloorCeiling(depth: number, side: number, scale: number, nextScale: number): void {
    // Basic floor/ceiling line drawing could go here
  }
}

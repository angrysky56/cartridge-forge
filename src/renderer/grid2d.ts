/**
 * Grid 2D Renderer — draws the game map and entities using glyph-based rendering.
 * Designed for the classic roguelike aesthetic: monospaced glyphs on a grid.
 */

import type { Entity } from '../ecs/types.js';
import { type GameMap, TileType } from '../runtime/mapgen.js';
import type { IRenderer, RenderConfig } from './types.js';

export class Grid2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private palette: Record<string, string>;
  private fontFamily: string;
  private cameraX = 0;
  private cameraY = 0;
  private viewCols: number;
  private viewRows: number;

  constructor(config: RenderConfig) {
    const ctx = config.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d canvas context');
    this.ctx = ctx;
    this.cellSize = config.cellSize;
    this.palette = config.palette;
    this.fontFamily = config.fontFamily;
    this.viewCols = Math.floor(config.canvas.width / this.cellSize);
    this.viewRows = Math.floor(config.canvas.height / this.cellSize);
  }

  centerOn(x: number, y: number): void {
    this.cameraX = x - Math.floor(this.viewCols / 2);
    this.cameraY = y - Math.floor(this.viewRows / 2);
  }

  render(map: GameMap, entities: Entity[]): void {
    const { ctx, cellSize } = this;

    // Clear
    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Set font once
    ctx.font = `${cellSize - 2}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw map tiles in view
    for (let row = 0; row < this.viewRows; row++) {
      for (let col = 0; col < this.viewCols; col++) {
        const mapX = col + this.cameraX;
        const mapY = row + this.cameraY;

        if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
          continue;
        }

        const tile = map.tiles[mapY][mapX];
        const px = col * cellSize;
        const py = row * cellSize;

        if (tile === TileType.Wall) {
          ctx.fillStyle = this.palette.wall;
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.fillStyle = this.palette.wall_glyph;
          ctx.fillText(map.wallGlyph, px + cellSize / 2, py + cellSize / 2);
        } else {
          ctx.fillStyle = this.palette.floor;
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.fillStyle = this.palette.floor_glyph;
          ctx.fillText(map.floorGlyph, px + cellSize / 2, py + cellSize / 2);
        }
      }
    }

    // Draw entities
    const sorted = [...entities]
      .filter(e => e.components.has('Renderable') && e.components.has('Position'))
      .sort((a, b) => {
        const la = (a.components.get('Renderable')?.layer as number) ?? 0;
        const lb = (b.components.get('Renderable')?.layer as number) ?? 0;
        return la - lb;
      });

    for (const entity of sorted) {
      const pos = entity.components.get('Position') as { x: number; y: number };
      const rend = entity.components.get('Renderable') as {
        glyph: string;
        color: string;
      };

      const screenCol = pos.x - this.cameraX;
      const screenRow = pos.y - this.cameraY;

      if (screenCol < 0 || screenCol >= this.viewCols ||
          screenRow < 0 || screenRow >= this.viewRows) {
        continue;
      }

      const px = screenCol * cellSize;
      const py = screenRow * cellSize;

      ctx.fillStyle = rend.color;
      ctx.fillText(rend.glyph, px + cellSize / 2, py + cellSize / 2);
    }
  }

  drawHighlight(x: number, y: number, color = 'rgba(255, 255, 0, 0.3)'): void {
    const screenCol = x - this.cameraX;
    const screenRow = y - this.cameraY;
    if (screenCol < 0 || screenCol >= this.viewCols ||
        screenRow < 0 || screenRow >= this.viewRows) return;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      screenCol * this.cellSize,
      screenRow * this.cellSize,
      this.cellSize,
      this.cellSize,
    );
  }

  pixelToGrid(px: number, py: number): { x: number; y: number } {
    return {
      x: Math.floor(px / this.cellSize) + this.cameraX,
      y: Math.floor(py / this.cellSize) + this.cameraY,
    };
  }
}

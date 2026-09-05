/**
 * Grid 2D Renderer — Enhanced Retro-Futuristic Visual Engine.
 * Features beveled tiles, glowing auras, overhead health bars,
 * ambient vignette, tile hover reticles, and floating combat text.
 */

import type { Entity } from '../ecs/types.js';
import { type GameMap, TileType } from '../runtime/mapgen.js';
import type { IRenderer, RenderConfig } from './types.js';

interface FloatingText {
  id: number;
  gridX: number;
  gridY: number;
  text: string;
  color: string;
  createdAt: number;
  duration: number;
}

export class Grid2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private palette: Record<string, string>;
  private fontFamily: string;
  private cameraX = 0;
  private cameraY = 0;
  private viewCols: number;
  private viewRows: number;
  private hoveredTile: { x: number; y: number } | null = null;
  private floatingTexts: FloatingText[] = [];
  private nextTextId = 0;

  constructor(config: RenderConfig) {
    const ctx = config.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d canvas context');
    this.ctx = ctx;
    // Use a comfortable 28px cell size if 16 was passed, for crisp high-def visibility
    this.cellSize = Math.max(config.cellSize, 28);
    this.palette = {
      bg: '#0a0a12',
      wall: '#1e2230',
      wall_glyph: '#4a5578',
      floor: '#0e1017',
      floor_glyph: '#252a3d',
      player: '#00ffaa',
      monster: '#ff4466',
      item: '#ffbb00',
      ...config.palette,
    };
    this.fontFamily = config.fontFamily || "'JetBrains Mono', monospace";
    this.viewCols = Math.floor(config.canvas.width / this.cellSize);
    this.viewRows = Math.floor(config.canvas.height / this.cellSize);
  }

  setHoveredTile(tile: { x: number; y: number } | null): void {
    this.hoveredTile = tile;
  }

  addFloatingText(gridX: number, gridY: number, text: string, color = '#ff4466'): void {
    this.floatingTexts.push({
      id: this.nextTextId++,
      gridX,
      gridY,
      text,
      color,
      createdAt: performance.now(),
      duration: 1100, // ms
    });
  }

  resize(width: number, height: number): void {
    this.ctx.canvas.width = width;
    this.ctx.canvas.height = height;
    this.viewCols = Math.floor(width / this.cellSize);
    this.viewRows = Math.floor(height / this.cellSize);
  }

  centerOn(x: number, y: number): void {
    this.cameraX = x - Math.floor(this.viewCols / 2);
    this.cameraY = y - Math.floor(this.viewRows / 2);
  }

  render(map: GameMap, entities: Entity[]): void {
    const { ctx, cellSize } = this;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const now = performance.now();

    // 1. Clear background
    ctx.fillStyle = this.palette.bg || '#0a0a12';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw Map Tiles
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
          // Beveled procedural wall panel
          ctx.fillStyle = this.palette.wall || '#1e2230';
          ctx.fillRect(px, py, cellSize, cellSize);

          // Top and left bevel highlights
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(px, py, cellSize, 2);
          ctx.fillRect(px, py, 2, cellSize);

          // Bottom and right shadow borders
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(px, py + cellSize - 2, cellSize, 2);
          ctx.fillRect(px + cellSize - 2, py, 2, cellSize);

          // Centered subtle wall rune/glyph
          ctx.font = `${Math.floor(cellSize * 0.48)}px ${this.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.palette.wall_glyph || '#4a5578';
          ctx.fillText(map.wallGlyph || '#', px + cellSize / 2, py + cellSize / 2);
        } else {
          // Floor tile with subtle grid pattern
          ctx.fillStyle = this.palette.floor || '#0e1017';
          ctx.fillRect(px, py, cellSize, cellSize);

          // Subtle floor perimeter grid line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

          // Subtle floor dot at center
          ctx.fillStyle = this.palette.floor_glyph || '#252a3d';
          ctx.fillRect(px + cellSize / 2 - 1, py + cellSize / 2 - 1, 2, 2);
        }
      }
    }

    // 3. Draw Hover Reticle
    if (this.hoveredTile) {
      const hCol = this.hoveredTile.x - this.cameraX;
      const hRow = this.hoveredTile.y - this.cameraY;
      if (hCol >= 0 && hCol < this.viewCols && hRow >= 0 && hRow < this.viewRows) {
        const hx = hCol * cellSize;
        const hy = hRow * cellSize;

        ctx.fillStyle = 'rgba(0, 255, 200, 0.12)';
        ctx.fillRect(hx, hy, cellSize, cellSize);

        ctx.strokeStyle = '#00ffc8';
        ctx.lineWidth = 2;
        // Draw corner brackets
        const bracketLen = 6;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(hx, hy + bracketLen);
        ctx.lineTo(hx, hy);
        ctx.lineTo(hx + bracketLen, hy);
        // Top-right
        ctx.moveTo(hx + cellSize - bracketLen, hy);
        ctx.lineTo(hx + cellSize, hy);
        ctx.lineTo(hx + cellSize, hy + bracketLen);
        // Bottom-right
        ctx.moveTo(hx + cellSize, hy + cellSize - bracketLen);
        ctx.lineTo(hx + cellSize, hy + cellSize);
        ctx.lineTo(hx + cellSize - bracketLen, hy + cellSize);
        // Bottom-left
        ctx.moveTo(hx + bracketLen, hy + cellSize);
        ctx.lineTo(hx, hy + cellSize);
        ctx.lineTo(hx, hy + cellSize - bracketLen);
        ctx.stroke();
      }
    }

    // 4. Draw Entities
    const sorted = [...entities]
      .filter(e => e.components.has('Renderable') && e.components.has('Position'))
      .sort((a, b) => {
        const la = (a.components.get('Renderable')?.layer as number) ?? 0;
        const lb = (b.components.get('Renderable')?.layer as number) ?? 0;
        return la - lb;
      });

    let playerScreenX = canvasWidth / 2;
    let playerScreenY = canvasHeight / 2;

    for (const entity of sorted) {
      const pos = entity.components.get('Position') as { x: number; y: number; direction?: string };
      const rend = entity.components.get('Renderable') as {
        glyph: string;
        color: string;
      };
      const faction = entity.components.get('Faction') as { id: string } | undefined;
      const health = entity.components.get('Health') as { current: number; max: number } | undefined;

      const screenCol = pos.x - this.cameraX;
      const screenRow = pos.y - this.cameraY;

      if (screenCol < 0 || screenCol >= this.viewCols ||
          screenRow < 0 || screenRow >= this.viewRows) {
        continue;
      }

      const px = screenCol * cellSize;
      const py = screenRow * cellSize;
      const isPlayer = faction?.id === 'player';

      if (isPlayer) {
        playerScreenX = px + cellSize / 2;
        playerScreenY = py + cellSize / 2;

        // Player glowing energy shield aura
        ctx.save();
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(0, 255, 170, 0.18)';
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (faction?.id === 'monster' || faction?.id === 'enemy') {
        // Subtle enemy menace pulse
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
        ctx.fillStyle = `rgba(255, 68, 102, ${0.08 + pulse * 0.08})`;
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw entity avatar glyph
      ctx.save();
      ctx.font = `bold ${Math.floor(cellSize * 0.65)}px ${this.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rend.color || (isPlayer ? '#00ffaa' : '#ffffff');
      ctx.shadowColor = rend.color || '#ffffff';
      ctx.shadowBlur = isPlayer ? 8 : 4;
      ctx.fillText(rend.glyph, px + cellSize / 2, py + cellSize / 2);
      ctx.restore();

      // Draw Overhead Health Bar if damaged
      if (health && health.max > 0 && health.current < health.max) {
        const barW = cellSize - 6;
        const barH = 3;
        const barX = px + 3;
        const barY = py + 2;
        const pct = Math.max(0, Math.min(1, health.current / health.max));

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill color based on HP percentage
        ctx.fillStyle = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffbb00' : '#ff3344';
        ctx.fillRect(barX, barY, Math.round(barW * pct), barH);
      }
    }

    // 5. Ambient Vignette Lighting (centered on player)
    const vignette = ctx.createRadialGradient(
      playerScreenX, playerScreenY, cellSize * 2,
      playerScreenX, playerScreenY, Math.max(canvasWidth, canvasHeight) * 0.7
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
    vignette.addColorStop(1, 'rgba(0, 4, 12, 0.75)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 6. Draw Floating Combat Text
    this.floatingTexts = this.floatingTexts.filter(ft => {
      const elapsed = now - ft.createdAt;
      if (elapsed >= ft.duration) return false;

      const alpha = 1 - elapsed / ft.duration;
      const floatOffsetY = (elapsed / ft.duration) * (cellSize * 1.2);

      const fCol = ft.gridX - this.cameraX;
      const fRow = ft.gridY - this.cameraY;
      const fx = fCol * cellSize + cellSize / 2;
      const fy = fRow * cellSize + cellSize / 4 - floatOffsetY;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.floor(cellSize * 0.45)}px ${this.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, fx, fy);
      ctx.restore();

      return true;
    });
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

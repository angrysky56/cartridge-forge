/**
 * Wireframe 3D Renderer — Elite-style vector graphics.
 */

import type { Entity } from '../ecs/types.js';
import type { GameMap } from '../runtime/mapgen.js';
import type { IRenderer, RenderConfig } from './types.js';
import { Math3D, type Vec3, type Edge } from './math3d.js';

interface Mesh {
  vertices: Vec3[];
  edges: Edge[];
}

export class Wireframe3DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D;
  private palette: Record<string, string>;
  private camX = 0;
  private camY = 0;
  private camZ = -10; // Back up a bit
  private rotation = 0;

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

  render(map: GameMap, entities: Entity[]): void {
    const { ctx } = this;
    const { width, height } = ctx.canvas;

    // Clear with CRT fade effect (optional, here just clear)
    ctx.fillStyle = this.palette.bg || '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Apply CRT Glow (shadow blur)
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.palette.ui_text || '#00ff88';

    this.rotation += 0.01; // Auto-rotate for flair (debug)

    // Render 3D Entities
    for (const entity of entities) {
      const renderable = entity.components.get('Renderable') as { mesh?: Mesh; color: string } | undefined;
      const pos = entity.components.get('Position') as { x: number; y: number; z?: number } | undefined;

      if (!renderable?.mesh || !pos) continue;

      const mesh = renderable.mesh;
      const entityZ = pos.z ?? 0;
      
      // Transform and Project edges
      ctx.strokeStyle = renderable.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (const [i1, i2] of mesh.edges) {
        const v1 = mesh.vertices[i1];
        const v2 = mesh.vertices[i2];

        // 1. Local rotation (just for fun/demo)
        let rv1 = Math3D.rotateY(v1, this.rotation);
        let rv2 = Math3D.rotateY(v2, this.rotation);
        rv1 = Math3D.rotateX(rv1, this.rotation * 0.5);
        rv2 = Math3D.rotateX(rv2, this.rotation * 0.5);

        // 2. World translation relative to camera
        // Note: Map coords are X, Y. We treat Y as depth or height?
        // Let's treat Map X as World X, Map Y as World Z.
        const w1 = {
          x: (pos.x + rv1.x) - this.camX,
          y: rv1.y, // height
          z: (entityZ + rv1.z) + (pos.y - this.camY) + 20 // Offset depth
        };
        const w2 = {
          x: (pos.x + rv2.x) - this.camX,
          y: rv2.y,
          z: (entityZ + rv2.z) + (pos.y - this.camY) + 20
        };

        // 3. Project
        const p1 = Math3D.project(w1, width, height);
        const p2 = Math3D.project(w2, width, height);

        if (p1 && p2) {
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
      }
      ctx.stroke();
    }

    // Reset shadow for UI
    ctx.shadowBlur = 0;
  }
}

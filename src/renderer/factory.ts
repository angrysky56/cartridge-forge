import { Grid2DRenderer } from './grid2d.js';
import { Wireframe3DRenderer } from './wireframe.js';
import { CellPseudo3DRenderer } from './pseudo3d.js';
import type { IRenderer, RenderConfig } from './types.js';

export type RendererMode = 'GRID_2D' | 'WIREFRAME_3D' | 'CELL_PSEUDO_3D';

export class RendererFactory {
  static create(mode: RendererMode, config: RenderConfig): IRenderer {
    switch (mode) {
      case 'GRID_2D':
        return new Grid2DRenderer(config);
      case 'WIREFRAME_3D':
        return new Wireframe3DRenderer(config);
      case 'CELL_PSEUDO_3D':
        return new CellPseudo3DRenderer(config);
      default:
        return new Grid2DRenderer(config);
    }
  }
}

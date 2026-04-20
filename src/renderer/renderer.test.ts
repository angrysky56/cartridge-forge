import { describe, it, expect, vi } from 'vitest';
import { RendererFactory } from './factory.js';
import { Grid2DRenderer } from './grid2d.js';
import { Wireframe3DRenderer } from './wireframe.js';
import { CellPseudo3DRenderer } from './pseudo3d.js';

describe('RendererFactory', () => {
  const mockCanvas = {
    getContext: vi.fn(() => ({})),
    width: 800,
    height: 600,
  } as any;

  const config = {
    canvas: mockCanvas,
    cellSize: 16,
    palette: {},
    fontFamily: 'monospace',
  };

  it('creates Grid2DRenderer', () => {
    const renderer = RendererFactory.create('GRID_2D', config);
    expect(renderer).toBeInstanceOf(Grid2DRenderer);
  });

  it('creates Wireframe3DRenderer', () => {
    const renderer = RendererFactory.create('WIREFRAME_3D', config);
    expect(renderer).toBeInstanceOf(Wireframe3DRenderer);
  });

  it('creates CellPseudo3DRenderer', () => {
    const renderer = RendererFactory.create('CELL_PSEUDO_3D', config);
    expect(renderer).toBeInstanceOf(CellPseudo3DRenderer);
  });
});

import type { Entity } from '../ecs/types.js';
import type { GameMap } from '../runtime/mapgen.js';

/** Core rendering configuration shared by all modes */
export interface RenderConfig {
  canvas: HTMLCanvasElement;
  cellSize: number;
  palette: Record<string, string>;
  fontFamily: string;
}

/** Interface for all rendering engines */
export interface IRenderer {
  /** Full render pass */
  render(map: GameMap, entities: Entity[]): void;
  
  /** Center the camera/view on a position */
  centerOn(x: number, y: number): void;
  
  /** Cleanup resources */
  destroy?(): void;
}

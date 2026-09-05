/**
 * Field of View (FOV) — line-of-sight raycasting calculation.
 * Computes which tiles are visible from an origin point within a given radius.
 */

export interface FOVResult {
  visible: Set<string>;
  isVisible: (x: number, y: number) => boolean;
}

/**
 * Computes visible coordinates from (originX, originY) within radius.
 * Raycasts 360 degrees, stopping when hitting an opaque tile (wall),
 * while ensuring the wall tile itself is visible.
 */
export function computeFOV(
  originX: number,
  originY: number,
  radius: number,
  isOpaque: (x: number, y: number) => boolean,
  width: number,
  height: number,
): FOVResult {
  const visible = new Set<string>();
  visible.add(`${originX},${originY}`);

  // Cast fine rays in a complete circle
  const stepCount = 360;
  for (let i = 0; i < stepCount; i++) {
    const angle = (i * 2 * Math.PI) / stepCount;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let d = 1; d <= radius; d++) {
      const x = Math.round(originX + cos * d);
      const y = Math.round(originY + sin * d);

      if (x < 0 || x >= width || y < 0 || y >= height) break;

      visible.add(`${x},${y}`);

      // If the tile is opaque (wall), it blocks further line of sight along this ray
      if (isOpaque(x, y)) {
        break;
      }
    }
  }

  return {
    visible,
    isVisible: (x: number, y: number) => visible.has(`${x},${y}`),
  };
}

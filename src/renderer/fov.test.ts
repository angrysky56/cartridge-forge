import { describe, it, expect } from 'vitest';
import { computeFOV } from './fov.js';

describe('computeFOV', () => {
  it('should always include the origin tile', () => {
    const fov = computeFOV(5, 5, 5, () => false, 20, 20);
    expect(fov.isVisible(5, 5)).toBe(true);
  });

  it('should see tiles within radius in an open room', () => {
    const fov = computeFOV(10, 10, 3, () => false, 20, 20);
    expect(fov.isVisible(10, 11)).toBe(true);
    expect(fov.isVisible(10, 13)).toBe(true);
    // Beyond radius 3
    expect(fov.isVisible(10, 15)).toBe(false);
  });

  it('should stop line of sight at a wall, but include the wall itself', () => {
    // Wall at (10, 12)
    const isOpaque = (x: number, y: number) => x === 10 && y === 12;
    const fov = computeFOV(10, 10, 5, isOpaque, 20, 20);

    expect(fov.isVisible(10, 11)).toBe(true); // Open space
    expect(fov.isVisible(10, 12)).toBe(true); // Wall tile itself is visible
    expect(fov.isVisible(10, 13)).toBe(false); // Behind the wall is hidden
  });

  it('should respect map boundaries', () => {
    const fov = computeFOV(0, 0, 5, () => false, 10, 10);
    expect(fov.isVisible(0, 0)).toBe(true);
    expect(fov.isVisible(-1, 0)).toBe(false);
    expect(fov.isVisible(0, -1)).toBe(false);
    expect(fov.isVisible(2, 2)).toBe(true);
  });
});

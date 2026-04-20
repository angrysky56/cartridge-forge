/**
 * Basic 3D Math for Wireframe Rendering.
 * Minimalist implementation to keep with the C64-Forge aesthetic.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Edge = [number, number]; // Indices into vertex array

export class Math3D {
  /** Project 3D point to 2D screen coordinates */
  static project(v: Vec3, width: number, height: number, fov = 400): { x: number; y: number } | null {
    // Basic pinhole projection
    // Z is depth. If Z <= 0, it's behind the camera.
    if (v.z <= 0) return null;
    
    const factor = fov / v.z;
    return {
      x: (v.x * factor) + width / 2,
      y: (v.y * factor) + height / 2,
    };
  }

  /** Rotate point around Y axis */
  static rotateY(v: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.z * sin,
      y: v.y,
      z: v.x * sin + v.z * cos,
    };
  }

  /** Rotate point around X axis */
  static rotateX(v: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x,
      y: v.y * cos - v.z * sin,
      z: v.y * sin + v.z * cos,
    };
  }

  /** Simple distance check for depth sorting if needed */
  static distSq(a: Vec3, b: Vec3): number {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  }
}

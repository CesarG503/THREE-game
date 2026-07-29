import * as THREE from "three";

export class LimbBender {
  /**
   * Deforms a mesh's geometry to bend it.
   * Assumes the mesh is built with a box geometry subdivided on the Y axis,
   * where the top of the limb is at local y = 6, and the bottom at local y = -6.
   * The deformation rotates vertices along the Y axis.
   * 
   * @param mesh The limb mesh (e.g. rightArm, rArmOuter)
   * @param type Bending style: 'none' | 'jelly' | 'joint'
   * @param angle Bending angle in radians
   */
  static bend(mesh: THREE.Mesh | null, type: "none" | "jelly" | "joint", angle: number) {
    if (!mesh || !mesh.geometry) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;

    // Initialize original positions if not already cached
    if (!geometry.userData.originalPositions) {
      geometry.userData.originalPositions = new Float32Array(posAttr.array);
      geometry.userData.isBended = false;
    }

    const original = geometry.userData.originalPositions as Float32Array;
    const current = posAttr.array as Float32Array;

    // If no bending is selected or the angle is negligible, restore to original shape once
    if (type === "none" || Math.abs(angle) < 0.001) {
      if (geometry.userData.isBended) {
        for (let i = 0; i < original.length; i++) {
          current[i] = original[i];
        }
        posAttr.needsUpdate = true;
        geometry.userData.isBended = false;
        geometry.computeVertexNormals();
      }
      return;
    }

    // Apply bending deformation
    const vertexCount = original.length / 3;
    const limbLength = 12.0; // Local height of BoxGeometry
    const topY = 6.0;        // Pivot at the top (shoulder/hip)

    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3;
      const x0 = original[idx];
      const y0 = original[idx + 1];
      const z0 = original[idx + 2];

      let x = x0;
      let y = y0;
      let z = z0;

      // Fraction along the limb from top to bottom (0 = shoulder/hip, 1 = hand/foot)
      const t = (topY - y0) / limbLength;

      if (type === "jelly") {
        // Smooth jelly-like curvature (quadratic/sine distribution of rotation along the limb)
        // Rotate local coordinate (y0 - 6, z0) around X-axis by phi = t * angle
        const phi = t * angle;
        const cos = Math.cos(phi);
        const sin = Math.sin(phi);

        const dy = y0 - topY;
        y = topY + dy * cos - z0 * sin;
        z = dy * sin + z0 * cos;
      } else if (type === "joint") {
        // Fold at the joint (elbow/knee is at local y0 = 0)
        // Vertices above y = 1: no bending (phi = 0)
        // Vertices below y = -1: full bending (phi = angle)
        // Vertices between -1 and 1: transition smoothly
        let phi = 0;
        if (y0 < -1) {
          phi = angle;
        } else if (y0 < 1) {
          // Normalize transition to [0, 1]
          const k = (1.0 - y0) / 2.0; 
          phi = angle * k;
        }

        if (phi > 0) {
          const cos = Math.cos(phi);
          const sin = Math.sin(phi);

          // Rotate around the joint pivot at y = 0
          y = y0 * cos - z0 * sin;
          z = y0 * sin + z0 * cos;
        }
      }

      current[idx] = x;
      current[idx + 1] = y;
      current[idx + 2] = z;
    }

    posAttr.needsUpdate = true;
    geometry.userData.isBended = true;
    
    // Recompute normals for proper lighting of the deformed geometry
    geometry.computeVertexNormals();
  }
}

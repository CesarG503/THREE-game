import * as THREE from "three";

export class RampUtils {
  static normalizeScale(scale: any) {
    return {
      x: Math.max(0.1, Number(scale?.x) || 1),
      y: Math.max(0.1, Number(scale?.y) || 1),
      z: Math.max(0.1, Number(scale?.z) || 1)
    };
  }

  static createGeometry(scale: any) {
    const dims = RampUtils.normalizeScale(scale);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(dims.z, 0);
    shape.lineTo(0, dims.y);
    shape.lineTo(0, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: dims.x,
      bevelEnabled: false
    });
    geometry.center();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  static createColliderDesc(scale: any, RAPIER: any) {
    const geometry = RampUtils.createGeometry(scale);
    const vertices = geometry.attributes.position.array;
    const dims = RampUtils.normalizeScale(scale);
    const collider = RAPIER.ColliderDesc.convexHull(vertices as any);
    geometry.dispose();

    return collider || RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2);
  }
}

import * as THREE from "three";
import { normalizeTextureSettings, remapBoxUVs } from "./TextureMapping";

export type CurveAxis = "x" | "y" | "z";
export interface CurvatureSettings {
  enabled: boolean;
  axis: CurveAxis;
  direction: CurveAxis;
  angle: number;
}
export const CURVE_AXES: CurveAxis[] = ["x", "y", "z"];
export const supportsCurvature = (type: string) => ["wall", "box", "cube", "sphere", "cylinder", "cone", "circle"].includes(type);

export function normalizeCurvature(value: any): CurvatureSettings {
  const axis: CurveAxis = CURVE_AXES.includes(value?.axis) ? value.axis : "x";
  const direction: CurveAxis = CURVE_AXES.includes(value?.direction) && value.direction !== axis
    ? value.direction : axis === "z" ? "x" : "z";
  return {
    enabled: value?.enabled === true,
    axis, direction,
    angle: Number.isFinite(Number(value?.angle)) ? THREE.MathUtils.clamp(Number(value.angle), -360, 360) : 0,
  };
}

export function curveDimensions(type: string, dims: any): Record<CurveAxis, number> {
  const size = { x: Math.max(0.1, Number(dims.x) || 1), y: Math.max(0.1, Number(dims.y) || 1), z: Math.max(0.1, Number(dims.z) || 1) };
  if (["sphere", "cylinder", "cone", "circle"].includes(type)) {
    size.x = size.z = Math.max(0.1, (Number(dims.radius) || size.x / 2) * 2);
    if (type === "sphere") size.y = size.x;
  }
  return size;
}

// Keep the inner radius positive: thick objects cannot fold through themselves.
export function maxCurveAngle(type: string, dims: any, settings = normalizeCurvature(dims.curvature)) {
  const size = curveDimensions(type, dims);
  return Math.min(360, THREE.MathUtils.radToDeg(size[settings.axis] / (size[settings.direction] / 2 + 0.001)));
}

export function resolveCurvature(type: string, dims: any): CurvatureSettings {
  const settings = normalizeCurvature(dims.curvature);
  const limit = maxCurveAngle(type, dims, settings);
  settings.angle = THREE.MathUtils.clamp(settings.angle, -limit, limit);
  return settings;
}

/** Arc length is preserved on the centerline. Both halves bend about their shared midpoint. */
export function bendPoint(point: THREE.Vector3, length: number, settings: CurvatureSettings) {
  if (!settings.enabled || Math.abs(settings.angle) < 0.00001) return point;
  const k = THREE.MathUtils.degToRad(settings.angle) / length;
  const t = point[settings.axis] * k;
  const transverse = point[settings.direction];
  point[settings.axis] = Math.sin(t) / k - transverse * Math.sin(t);
  point[settings.direction] = (2 * Math.sin(t / 2) ** 2) / k + transverse * Math.cos(t);
  return point;
}

export function createCurvedGeometry(type: string, dims: any, textureSettings?: any): THREE.BufferGeometry | null {
  if (!supportsCurvature(type)) return null;
  const settings = resolveCurvature(type, dims);
  if (!settings.enabled) return null;
  const size = curveDimensions(type, dims);
  // Even subdivision includes an exact section at the midpoint.
  const n = 96;
  let geometry: THREE.BufferGeometry;
  if (type === "sphere") geometry = new THREE.SphereGeometry(size.x / 2, n, n / 2);
  else if (["cylinder", "cone", "circle"].includes(type)) {
    geometry = new THREE.CylinderGeometry(type === "cone" ? 0 : size.x / 2, size.x / 2, size.y, n, n / 2);
  } else {
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z, settings.axis === "x" ? n : 1, settings.axis === "y" ? n : 1, settings.axis === "z" ? n : 1);
    const tex = normalizeTextureSettings(textureSettings);
    if (tex.fitMode === "auto") remapBoxUVs(geometry, size, tex);
  }
  // Preserve the undeformed UVs; reprojecting a curved surface would tear the texture.
  geometry.userData.curved = true;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const point = new THREE.Vector3();
  const k = THREE.MathUtils.degToRad(settings.angle) / size[settings.axis];
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const t = settings.enabled ? point[settings.axis] * k : 0;
    const depth = point[settings.direction];
    bendPoint(point, size[settings.axis], settings);
    positions.setXYZ(i, point.x, point.y, point.z);
    // Analytic inverse-transpose of the bend Jacobian retains smooth faces and hard edges.
    const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
    const a = normal[settings.axis];
    const b = normal[settings.direction];
    const longitudinal = a / Math.max(0.0001, 1 - k * depth);
    normal[settings.axis] = longitudinal * Math.cos(t) - b * Math.sin(t);
    normal[settings.direction] = longitudinal * Math.sin(t) + b * Math.cos(t);
    normal.normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function curvatureCollider(geometry: THREE.BufferGeometry, rapier: any) {
  const positions = geometry.getAttribute("position");
  const vertices = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    vertices.set([positions.getX(i), positions.getY(i), positions.getZ(i)], i * 3);
  }
  const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: positions.count }, (_, i) => i);
  return rapier.ColliderDesc.trimesh(vertices, indices);
}

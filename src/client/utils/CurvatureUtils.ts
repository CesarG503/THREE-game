import * as THREE from "three";
import { normalizeTextureSettings, remapBoxUVs } from "./TextureMapping";

export type CurveAxis = "x" | "y" | "z";
export interface CurveLayer {
  axis: CurveAxis;
  direction: CurveAxis;
  angle: number;
}
export interface CurvatureSettings extends CurveLayer {
  enabled: boolean;
  layers: CurveLayer[];
  activeLayer: number;
}
export const CURVE_AXES: CurveAxis[] = ["x", "y", "z"];
export const supportsCurvature = (type: string) => ["wall", "box", "cube", "sphere", "cylinder", "cone", "circle"].includes(type);

function normalizeLayer(value: any): CurveLayer {
  const axis: CurveAxis = CURVE_AXES.includes(value?.axis) ? value.axis : "x";
  const direction: CurveAxis = CURVE_AXES.includes(value?.direction) && value.direction !== axis
    ? value.direction : axis === "z" ? "x" : "z";
  return { axis, direction, angle: Number.isFinite(Number(value?.angle)) ? THREE.MathUtils.clamp(Number(value.angle), -360, 360) : 0 };
}

// Root axis/direction/angle mirror the selected layer for legacy consumers.
export function normalizeCurvature(value: any): CurvatureSettings {
  const layers = Array.isArray(value?.layers) && value.layers.length ? value.layers.map(normalizeLayer) : [normalizeLayer(value)];
  const activeLayer = THREE.MathUtils.clamp(Math.trunc(Number(value?.activeLayer) || 0), 0, layers.length - 1);
  return { enabled: value?.enabled === true, layers, activeLayer, ...layers[activeLayer] };
}

/** Editing one layer never replaces the other saved bends. */
export function patchCurvature(value: any, patch: Partial<CurvatureSettings>): CurvatureSettings {
  const current = normalizeCurvature(value);
  const next = normalizeCurvature({ ...current, ...patch });
  const layer = { ...next.layers[next.activeLayer] };
  for (const key of ["axis", "direction", "angle"] as const) {
    if (patch[key] !== undefined) (layer as any)[key] = patch[key];
  }
  next.layers[next.activeLayer] = normalizeLayer(layer);
  return normalizeCurvature(next);
}

export function curveDimensions(type: string, dims: any): Record<CurveAxis, number> {
  const size = { x: Math.max(0.1, Number(dims.x) || 1), y: Math.max(0.1, Number(dims.y) || 1), z: Math.max(0.1, Number(dims.z) || 1) };
  if (["sphere", "cylinder", "cone", "circle"].includes(type)) {
    size.x = size.z = Math.max(0.1, (Number(dims.radius) || size.x / 2) * 2);
    if (type === "sphere") size.y = size.x;
  }
  return size;
}

// Limit each bend using the original cross section. Compound bends can overlap.
export function maxCurveAngle(type: string, dims: any, settings: CurveLayer = normalizeCurvature(dims.curvature)) {
  const size = curveDimensions(type, dims);
  return Math.min(360, THREE.MathUtils.radToDeg(size[settings.axis] / (size[settings.direction] / 2 + 0.001)));
}

export function resolveCurvature(type: string, dims: any): CurvatureSettings {
  const settings = normalizeCurvature(dims.curvature);
  settings.layers = settings.layers.map(layer => {
    const limit = maxCurveAngle(type, dims, layer);
    return { ...layer, angle: THREE.MathUtils.clamp(layer.angle, -limit, limit) };
  });
  return normalizeCurvature(settings);
}

/** Arc length is preserved on the centerline. Both halves bend about their shared midpoint. */
export function bendPoint(point: THREE.Vector3, length: number, settings: CurveLayer & { enabled: boolean }) {
  if (!settings.enabled || Math.abs(settings.angle) < 0.00001) return point;
  const k = THREE.MathUtils.degToRad(settings.angle) / length;
  const t = point[settings.axis] * k;
  const transverse = point[settings.direction];
  point[settings.axis] = Math.sin(t) / k - transverse * Math.sin(t);
  point[settings.direction] = (2 * Math.sin(t / 2) ** 2) / k + transverse * Math.cos(t);
  return point;
}

export function bendStackPoint(point: THREE.Vector3, size: Record<CurveAxis, number>, settings: CurvatureSettings) {
  if (settings.enabled) for (const layer of settings.layers) bendPoint(point, size[layer.axis], { ...layer, enabled: true });
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
    const paths = new Set(settings.layers.filter(layer => Math.abs(layer.angle) > 0.00001).map(layer => layer.axis));
    if (!paths.size) paths.add(settings.axis);
    // Subdivide every edited path, with a bounded surface budget for compound bends.
    const segments = paths.size > 1 ? 48 : n;
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z, paths.has("x") ? segments : 1, paths.has("y") ? segments : 1, paths.has("z") ? segments : 1);
    const tex = normalizeTextureSettings(textureSettings);
    if (tex.fitMode === "auto") remapBoxUVs(geometry, size, tex);
  }
  // Preserve the undeformed UVs; reprojecting a curved surface would tear the texture.
  geometry.userData.curved = true;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);
    for (const layer of settings.layers) {
      if (Math.abs(layer.angle) < 0.00001) continue;
      const k = THREE.MathUtils.degToRad(layer.angle) / size[layer.axis];
      const t = point[layer.axis] * k;
      const depth = point[layer.direction];
      bendPoint(point, size[layer.axis], { ...layer, enabled: true });
      const a = normal[layer.axis];
      const b = normal[layer.direction];
      // Chain inverse-transpose Jacobians, preserving the sign of compound folds.
      const stretch = 1 - k * depth;
      const longitudinal = a / (Math.abs(stretch) < 0.0001 ? (stretch < 0 ? -0.0001 : 0.0001) : stretch);
      normal[layer.axis] = longitudinal * Math.cos(t) - b * Math.sin(t);
      normal[layer.direction] = longitudinal * Math.sin(t) + b * Math.cos(t);
      normal.normalize();
    }
    positions.setXYZ(i, point.x, point.y, point.z);
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

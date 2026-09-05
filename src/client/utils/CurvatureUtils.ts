import * as THREE from "three";
import { normalizeTextureSettings, remapBoxUVs } from "./TextureMapping";

export type CurveAxis = "x" | "y" | "z";
export interface CurveLayer {
  axis: CurveAxis;
  direction: CurveAxis;
  angle: number;
  /** Position along the path: 0 = first end, 0.5 = center, 1 = last end. */
  origin: number;
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
  return { axis, direction, origin: Number.isFinite(value?.origin) ? THREE.MathUtils.clamp(value.origin, 0, 1) : 0.5, angle: Number.isFinite(Number(value?.angle)) ? THREE.MathUtils.clamp(Number(value.angle), -360, 360) : 0 };
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
  for (const key of ["axis", "direction", "angle", "origin"] as const) {
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

// Baseline limit; resolving a stack also checks the deformed cross section.
export function maxCurveAngle(type: string, dims: any, settings: CurveLayer = normalizeCurvature(dims.curvature)) {
  const size = curveDimensions(type, dims);
  return Math.min(360, THREE.MathUtils.radToDeg(size[settings.axis] / (size[settings.direction] / 2 + 0.001)));
}

export function resolveCurvature(type: string, dims: any): CurvatureSettings {
  const settings = normalizeCurvature(dims.curvature);
  if (!settings.enabled || !supportsCurvature(type)) return settings;
  const size = curveDimensions(type, dims);
  const reference = createCurveSourceGeometry(type, size, settings);
  const resolved = createCurveDeformer(size, settings, reference.getAttribute("position")).settings;
  reference.dispose();
  return resolved;
}

/** Arc length is preserved on the centerline. The selected section remains fixed while both sides bend around it. */
export function bendPoint(point: THREE.Vector3, length: number, settings: CurveLayer & { enabled: boolean }) {
  if (!settings.enabled || Math.abs(settings.angle) < 0.00001) return point;
  const k = THREE.MathUtils.degToRad(settings.angle) / length;
  const anchor = ((settings.origin ?? 0.5) - 0.5) * length;
  const t = (point[settings.axis] - anchor) * k;
  const transverse = point[settings.direction];
  point[settings.axis] = anchor + Math.sin(t) / k - transverse * Math.sin(t);
  point[settings.direction] = (2 * Math.sin(t / 2) ** 2) / k + transverse * Math.cos(t);
  return point;
}

interface CurveFrame {
  anchor: THREE.Vector3;
  rotation: THREE.Quaternion;
  inverse: THREE.Quaternion;
  layer: CurveLayer;
  length: number;
}

function applyCurveFrame(point: THREE.Vector3, frame: CurveFrame, normal?: THREE.Vector3) {
  if (Math.abs(frame.layer.angle) < 0.00001) return point;
  point.sub(frame.anchor).applyQuaternion(frame.inverse);
  if (normal) {
    normal.applyQuaternion(frame.inverse);
    const { axis, direction, angle } = frame.layer;
    const k = THREE.MathUtils.degToRad(angle) / frame.length;
    const t = point[axis] * k;
    const stretch = Math.max(0.00001, 1 - k * point[direction]);
    const a = normal[axis] / stretch, b = normal[direction];
    normal[axis] = a * Math.cos(t) - b * Math.sin(t);
    normal[direction] = a * Math.sin(t) + b * Math.cos(t);
    normal.applyQuaternion(frame.rotation).normalize();
  }
  bendPoint(point, frame.length, { ...frame.layer, origin: 0.5, enabled: true });
  return point.applyQuaternion(frame.rotation).add(frame.anchor);
}

/** Each pivot is a material point carried by every preceding bend. Its axes
 * follow the local tangent, rather than the undeformed object's world axes. */
export function createCurveDeformer(size: Record<CurveAxis, number>, value: CurvatureSettings, source?: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const settings = normalizeCurvature(value);
  const frames: CurveFrame[] = [];
  const limits: { min: number; max: number }[] = [];
  const transform = (point: THREE.Vector3, fromLayer = 0, normal?: THREE.Vector3) => {
    for (let i = fromLayer; i < frames.length; i++) applyCurveFrame(point, frames[i], normal);
    return point;
  };
  // Use the incoming mesh's actual thickness, including previous bends, to
  // prevent an outer section crossing the bend radius and turning inside out.
  const samples = source ? Float64Array.from(source.array) : null;
  if (settings.enabled) for (const layer of settings.layers) {
    const materialAnchor = new THREE.Vector3();
    materialAnchor[layer.axis] = (layer.origin - 0.5) * size[layer.axis];
    const anchor = transform(materialAnchor.clone());
    const tangent = (axis: CurveAxis) => {
      const step = new THREE.Vector3(); step[axis] = size[axis] * 0.00001;
      return transform(materialAnchor.clone().add(step)).sub(transform(materialAnchor.clone().sub(step))).normalize();
    };
    const along = tangent(layer.axis);
    const across = tangent(layer.direction);
    across.addScaledVector(along, -across.dot(along)).normalize();
    const basis = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const a = CURVE_AXES.indexOf(layer.axis), b = CURVE_AXES.indexOf(layer.direction), c = 3 - a - b;
    basis[a].copy(along); basis[b].copy(across);
    basis[c].crossVectors(basis[(c + 1) % 3], basis[(c + 2) % 3]).normalize();
    const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(...basis as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    const frame = { anchor, rotation, inverse: rotation.clone().invert(), layer, length: size[layer.axis] };
    if (samples) {
      const point = new THREE.Vector3();
      let positiveDepth = size[layer.direction] / 2, negativeDepth = positiveDepth;
      for (let i = 0; i < samples.length; i += 3) {
        point.fromArray(samples, i).sub(anchor).applyQuaternion(frame.inverse);
        positiveDepth = Math.max(positiveDepth, point[layer.direction]);
        negativeDepth = Math.max(negativeDepth, -point[layer.direction]);
      }
      const limit = {
        min: -Math.min(360, THREE.MathUtils.radToDeg(frame.length / (negativeDepth + 0.001))),
        max: Math.min(360, THREE.MathUtils.radToDeg(frame.length / (positiveDepth + 0.001))),
      };
      limits.push(limit);
      layer.angle = THREE.MathUtils.clamp(layer.angle, limit.min, limit.max);
      for (let i = 0; i < samples.length; i += 3) applyCurveFrame(point.fromArray(samples, i), frame).toArray(samples, i);
    }
    frames.push(frame);
  }
  return { settings: normalizeCurvature(settings), transform, limits };
}

/** Limits shown in the inspector must match the same incoming surface used by the mesh. */
export function curveAngleRange(type: string, dims: any) {
  const settings = normalizeCurvature(dims.curvature);
  const size = curveDimensions(type, dims);
  const reference = createCurveSourceGeometry(type, size, settings);
  const { limits } = createCurveDeformer(size, settings, reference.getAttribute("position"));
  reference.dispose();
  return limits[settings.activeLayer] ?? { min: -360, max: 360 };
}

export function bendStackPoint(point: THREE.Vector3, size: Record<CurveAxis, number>, settings: CurvatureSettings, fromLayer = 0) {
  return createCurveDeformer(size, settings).transform(point, fromLayer);
}

function createCurveSourceGeometry(type: string, size: Record<CurveAxis, number>, settings: CurvatureSettings) {
  const n = 96;
  if (type === "sphere") return new THREE.SphereGeometry(size.x / 2, n, n / 2);
  if (["cylinder", "cone", "circle"].includes(type)) return new THREE.CylinderGeometry(type === "cone" ? 0 : size.x / 2, size.x / 2, size.y, n, n / 2);
  const paths = new Set(settings.layers.filter(layer => Math.abs(layer.angle) > 0.00001).map(layer => layer.axis));
  if (!paths.size) paths.add(settings.axis);
  const segments = paths.size > 1 ? 48 : n;
  return new THREE.BoxGeometry(size.x, size.y, size.z, paths.has("x") ? segments : 1, paths.has("y") ? segments : 1, paths.has("z") ? segments : 1);
}

export function createCurvedGeometry(type: string, dims: any, textureSettings?: any): THREE.BufferGeometry | null {
  if (!supportsCurvature(type)) return null;
  const settings = normalizeCurvature(dims.curvature);
  if (!settings.enabled) return null;
  const size = curveDimensions(type, dims);
  const geometry = createCurveSourceGeometry(type, size, settings);
  const tex = normalizeTextureSettings(textureSettings);
  if (["wall", "box", "cube"].includes(type) && tex.fitMode === "auto") remapBoxUVs(geometry, size, tex);
  // Preserve the undeformed UVs; reprojecting a curved surface would tear the texture.
  geometry.userData.curved = true;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  // Retain material coordinates for dragging a pivot directly over the surface.
  geometry.setAttribute("curveSourcePosition", positions.clone());
  const deformer = createCurveDeformer(size, settings, positions);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);
    deformer.transform(point, 0, normal);
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

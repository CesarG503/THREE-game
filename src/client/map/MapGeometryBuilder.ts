import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { remapBoxUVs, normalizeTextureSettings } from "../utils/TextureMapping";

/**
 * Helper to build custom prism geometries for slopes.
 */
export function createPrismGeometryForShape(shape: string, cs: number, height: number, group: any, groundTextureSettings: any) {
  const h2 = height / 2;
  const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : groundTextureSettings);
  const tile = texSettings.fitMode === "stretch" ? cs : texSettings.tileSize;

  let v1 = new THREE.Vector2(-cs / 2, -cs / 2);
  let v2 = new THREE.Vector2(-cs / 2, cs / 2);
  let v3 = new THREE.Vector2(cs / 2, -cs / 2);

  if (shape === "ne") {
    v1 = new THREE.Vector2(-cs / 2, -cs / 2);
    v2 = new THREE.Vector2(cs / 2, -cs / 2);
    v3 = new THREE.Vector2(cs / 2, cs / 2);
  } else if (shape === "se") {
    v1 = new THREE.Vector2(cs / 2, -cs / 2);
    v2 = new THREE.Vector2(cs / 2, cs / 2);
    v3 = new THREE.Vector2(-cs / 2, cs / 2);
  } else if (shape === "sw") {
    v1 = new THREE.Vector2(-cs / 2, -cs / 2);
    v2 = new THREE.Vector2(-cs / 2, cs / 2);
    v3 = new THREE.Vector2(cs / 2, cs / 2);
  }

  // CCW order check
  const cross = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x);
  if (cross > 0) {
    const tmp = v2;
    v2 = v3;
    v3 = tmp;
  }

  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const addTriangle = (
    p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3,
    u1: THREE.Vector2, u2: THREE.Vector2, u3: THREE.Vector2
  ) => {
    vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
    const cb = new THREE.Vector3().subVectors(p3, p2);
    const ab = new THREE.Vector3().subVectors(p1, p2);
    cb.cross(ab).normalize();
    normals.push(cb.x, cb.y, cb.z, cb.x, cb.y, cb.z, cb.x, cb.y, cb.z);
    uvs.push(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
  };

  const B1 = new THREE.Vector3(v1.x, -h2, v1.y);
  const B2 = new THREE.Vector3(v2.x, -h2, v2.y);
  const B3 = new THREE.Vector3(v3.x, -h2, v3.y);

  const T1 = new THREE.Vector3(v1.x, h2, v1.y);
  const T2 = new THREE.Vector3(v2.x, h2, v2.y);
  const T3 = new THREE.Vector3(v3.x, h2, v3.y);

  const getUV = (v: THREE.Vector2) => {
    return new THREE.Vector2((v.x + cs / 2) / tile, (v.y + cs / 2) / tile);
  };

  const uv1 = getUV(v1);
  const uv2 = getUV(v2);
  const uv3 = getUV(v3);

  // Top/Bottom
  addTriangle(T1, T2, T3, uv1, uv2, uv3);
  addTriangle(B1, B3, B2, uv1, uv3, uv2);

  // Sides
  const L1 = v1.distanceTo(v2);
  const L2 = v2.distanceTo(v3);
  const L3 = v3.distanceTo(v1);

  addTriangle(B1, B2, T2, new THREE.Vector2(0, 0), new THREE.Vector2(L1 / tile, 0), new THREE.Vector2(L1 / tile, height / tile));
  addTriangle(B1, T2, T1, new THREE.Vector2(0, 0), new THREE.Vector2(L1 / tile, height / tile), new THREE.Vector2(0, height / tile));

  addTriangle(B2, B3, T3, new THREE.Vector2(0, 0), new THREE.Vector2(L2 / tile, 0), new THREE.Vector2(L2 / tile, height / tile));
  addTriangle(B2, T3, T2, new THREE.Vector2(0, 0), new THREE.Vector2(L2 / tile, height / tile), new THREE.Vector2(0, height / tile));

  addTriangle(B3, B1, T1, new THREE.Vector2(0, 0), new THREE.Vector2(L3 / tile, 0), new THREE.Vector2(L3 / tile, height / tile));
  addTriangle(B3, T1, T3, new THREE.Vector2(0, 0), new THREE.Vector2(L3 / tile, height / tile), new THREE.Vector2(0, height / tile));

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return geometry;
}

export class MapGeometryBuilder {
  /**
   * Builds and merges ground geometries grouped by groupId.
   */
  public static buildMergedGround(
    grid: string[],
    cellSize: number,
    customGridGroups: { [key: string]: string },
    groundGroups: any[],
    defaultGroup: any,
    customGridShapes: { [key: string]: string },
    groundTextureSettings: any
  ): Map<string, THREE.BufferGeometry> {
    const geometriesByGroup = new Map<string, THREE.BufferGeometry[]>();

    grid.forEach((key) => {
      const [gx, gz] = key.split(",").map(Number);
      const x = gx * cellSize;
      const z = gz * cellSize;

      const groupId = customGridGroups[key] || "default";
      const group = groundGroups.find((g: any) => g.id === groupId) || defaultGroup;
      const shape = customGridShapes[key] || "full";

      let geo: THREE.BufferGeometry;
      if (shape === "full") {
        geo = new THREE.BoxGeometry(cellSize, 1, cellSize);
        const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : groundTextureSettings);
        remapBoxUVs(geo, { x: cellSize, y: 1, z: cellSize }, texSettings);
      } else {
        geo = createPrismGeometryForShape(shape, cellSize, 1, group, groundTextureSettings);
      }

      geo.translate(x, 0, z);

      if (!geometriesByGroup.has(groupId)) {
        geometriesByGroup.set(groupId, []);
      }
      geometriesByGroup.get(groupId)!.push(geo);
    });

    const mergedMap = new Map<string, THREE.BufferGeometry>();
    geometriesByGroup.forEach((geos, groupId) => {
      if (geos.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geos, true);
        if (merged) {
          mergedMap.set(groupId, merged);
        }
      }
    });

    return mergedMap;
  }

  /**
   * Builds and merges ceiling geometries grouped by (ceilingGroupId + "_" + posY).
   */
  public static buildMergedCeilings(
    customGridCeilingGroups: { [key: string]: string },
    cellSize: number,
    ceilingGroups: any[],
    defaultCeilingGroup: any,
    customGridCeilingShapes: { [key: string]: string },
    customGridWallGroups: { [key: string]: string },
    invisibleWallsGroups: any[]
  ): Map<string, { geometry: THREE.BufferGeometry; posY: number; ceilingGroupId: string }> {
    const geometriesByKey = new Map<string, THREE.BufferGeometry[]>();
    const keyMetadata = new Map<string, { posY: number; ceilingGroupId: string }>();

    Object.keys(customGridCeilingGroups).forEach((key) => {
      const [gx, gz] = key.split(",").map(Number);
      const x = gx * cellSize;
      const z = gz * cellSize;

      const ceilingGroupId = customGridCeilingGroups[key];
      if (!ceilingGroupId) return;

      const group = ceilingGroups.find((g: any) => g.id === ceilingGroupId) || defaultCeilingGroup;
      const shape = customGridCeilingShapes[key] || "full";

      const wallGroupId = customGridWallGroups[key] || "default";
      const wallGroup = invisibleWallsGroups.find((wg: any) => wg.id === wallGroupId);
      const wallHeight = (wallGroup && wallGroup.height !== undefined) ? wallGroup.height : 10;
      const posY = wallHeight - 1.0;

      let geo: THREE.BufferGeometry;
      if (shape === "full") {
        geo = new THREE.BoxGeometry(cellSize, 1, cellSize);
        const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : { tileSize: 5 });
        remapBoxUVs(geo, { x: cellSize, y: 1, z: cellSize }, texSettings);
      } else {
        geo = createPrismGeometryForShape(shape, cellSize, 1, group, { tileSize: 5 });
      }

      geo.translate(x, posY, z);

      const compositeKey = `${ceilingGroupId}_${posY.toFixed(3)}`;
      if (!geometriesByKey.has(compositeKey)) {
        geometriesByKey.set(compositeKey, []);
        keyMetadata.set(compositeKey, { posY, ceilingGroupId });
      }
      geometriesByKey.get(compositeKey)!.push(geo);
    });

    const mergedMap = new Map<string, { geometry: THREE.BufferGeometry; posY: number; ceilingGroupId: string }>();
    geometriesByKey.forEach((geos, compositeKey) => {
      if (geos.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geos, true);
        if (merged) {
          const meta = keyMetadata.get(compositeKey)!;
          mergedMap.set(compositeKey, {
            geometry: merged,
            posY: meta.posY,
            ceilingGroupId: meta.ceilingGroupId
          });
        }
      }
    });

    return mergedMap;
  }

  /**
   * Merges collinear walls sharing the same group settings into unified geometries.
   */
  public static buildMergedWalls(
    mergedWallDefs: any[],
    customGridWallGroups: { [key: string]: string },
    wallGroups: any[],
    isAdvanced: boolean
  ): Map<string, { geometry: THREE.BufferGeometry; isWireframeOnly: boolean; opacity: number; colorStr: string; texturePath: string | null; textureSettings: any }> {
    const geometriesByGroup = new Map<string, THREE.BufferGeometry[]>();
    const groupMetadata = new Map<string, any>();

    mergedWallDefs.forEach((def) => {
      let finalHeight = 100;
      let colorStr = "#FF5722";
      let opacity = 0.0;
      let transparent = true;
      let texturePath: string | null = null;
      let textureSettings: any = null;

      let group: any = null;
      if (isAdvanced && def.cellKey) {
        const wallGroupId = customGridWallGroups[def.cellKey];
        if (wallGroupId) {
          group = wallGroups.find((g: any) => g.id === wallGroupId);
        }
      }

      if (!group && isAdvanced) {
        group = wallGroups.find((g: any) => g.id === "default") || wallGroups[0];
      }

      if (group) {
        finalHeight = group.height !== undefined ? group.height : 10;
        colorStr = group.color3D || group.color || "#FF5722";
        opacity = group.opacity !== undefined ? group.opacity : 1.0;
        transparent = group.transparent !== undefined ? group.transparent : (opacity < 1.0);
        texturePath = group.texturePath || null;
        textureSettings = group.textureSettings || null;
      }

      const isWireframeOnly = (opacity === 0);
      // We group by the wallGroupId (or default/wireframe classification)
      const groupId = group ? group.id : (isWireframeOnly ? "wireframe_only" : "default_wall");

      const geo = new THREE.BoxGeometry(def.width, finalHeight, def.depth);
      const texSettings = normalizeTextureSettings(textureSettings || { tileSize: 5 });
      remapBoxUVs(geo, { x: def.width, y: finalHeight, z: def.depth }, texSettings);

      if (def.rotY) {
        geo.rotateY(def.rotY);
      }

      const posY = finalHeight / 2 - 0.5;
      geo.translate(def.pos.x, posY, def.pos.z);

      if (!geometriesByGroup.has(groupId)) {
        geometriesByGroup.set(groupId, []);
        groupMetadata.set(groupId, {
          isWireframeOnly,
          opacity,
          colorStr,
          texturePath,
          textureSettings
        });
      }
      geometriesByGroup.get(groupId)!.push(geo);
    });

    const mergedMap = new Map<string, any>();
    geometriesByGroup.forEach((geos, groupId) => {
      if (geos.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geos, true);
        if (merged) {
          const meta = groupMetadata.get(groupId)!;
          mergedMap.set(groupId, {
            geometry: merged,
            ...meta
          });
        }
      }
    });

    return mergedMap;
  }
}

import * as THREE from "three";

export type MapTextureFitMode = "auto" | "stretch";

export type MapTextureSettings = {
  fitMode?: MapTextureFitMode;
  tileSize?: number;
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
};

export const DEFAULT_TEXTURE_SETTINGS: Required<MapTextureSettings> = {
  fitMode: "auto",
  tileSize: 2,
  repeatX: 1,
  repeatY: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export function getDefaultTextureSettings(): Required<MapTextureSettings> {
  return { ...DEFAULT_TEXTURE_SETTINGS };
}

export function normalizeTextureSettings(settings?: MapTextureSettings | null): Required<MapTextureSettings> {
  const merged = { ...DEFAULT_TEXTURE_SETTINGS, ...(settings || {}) };
  merged.fitMode = merged.fitMode === "stretch" ? "stretch" : "auto";
  merged.tileSize = Math.max(0.1, Number(merged.tileSize) || DEFAULT_TEXTURE_SETTINGS.tileSize);
  merged.repeatX = Math.max(0.05, Number(merged.repeatX) || DEFAULT_TEXTURE_SETTINGS.repeatX);
  merged.repeatY = Math.max(0.05, Number(merged.repeatY) || DEFAULT_TEXTURE_SETTINGS.repeatY);
  merged.offsetX = Number(merged.offsetX) || 0;
  merged.offsetY = Number(merged.offsetY) || 0;
  merged.rotation = Number(merged.rotation) || 0;
  return merged;
}

function getMeshDimensions(mesh: any, fallbackDimensions: any) {
  const params = mesh.geometry?.parameters || {};
  return {
    x: params.width || params.radiusTop * 2 || fallbackDimensions?.x || 1,
    y: params.height || fallbackDimensions?.y || 1,
    z: params.depth || params.radiusBottom * 2 || params.radius * 2 || fallbackDimensions?.z || fallbackDimensions?.x || 1,
  };
}

function remapBoxUVs(geometry: THREE.BufferGeometry, dimensions: any, settings: Required<MapTextureSettings>) {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!uv || !position || !normal) return;

  const sx = Math.max(0.001, dimensions.x || 1);
  const sy = Math.max(0.001, dimensions.y || 1);
  const sz = Math.max(0.001, dimensions.z || 1);
  const tile = Math.max(0.1, settings.tileSize);

  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const px = position.getX(i);
    const py = position.getY(i);
    const pz = position.getZ(i);

    let u = 0;
    let v = 0;

    if (ny >= nx && ny >= nz) {
      u = (px + sx / 2) / tile;
      v = (pz + sz / 2) / tile;
    } else if (nx >= nz) {
      u = (pz + sz / 2) / tile;
      v = (py + sy / 2) / tile;
    } else {
      u = (px + sx / 2) / tile;
      v = (py + sy / 2) / tile;
    }

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

function configureTexture(texture: THREE.Texture, settings: Required<MapTextureSettings>) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(settings.repeatX, settings.repeatY);
  texture.offset.set(settings.offsetX, settings.offsetY);
  texture.rotation = THREE.MathUtils.degToRad(settings.rotation);
  texture.center.set(0.5, 0.5);
  texture.needsUpdate = true;
}

export function applyMapObjectTexture(object3D: any, texture: THREE.Texture, fallbackDimensions: any, settings?: MapTextureSettings | null) {
  const normalized = normalizeTextureSettings(settings);
  configureTexture(texture, normalized);

  const applyToMesh = (mesh: any) => {
    if (!mesh?.isMesh || !mesh.material) return;

    if (normalized.fitMode === "auto" && mesh.geometry?.type === "BoxGeometry") {
      remapBoxUVs(mesh.geometry, getMeshDimensions(mesh, fallbackDimensions), normalized);
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material: any) => {
      material.map = texture;
      material.needsUpdate = true;
    });
  };

  if (object3D?.traverse) {
    object3D.traverse(applyToMesh);
  } else {
    applyToMesh(object3D);
  }
}

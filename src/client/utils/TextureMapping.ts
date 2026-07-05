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
  globalRotation?: number;
  patternVariation?: boolean;
};

export const DEFAULT_TEXTURE_SETTINGS: Required<MapTextureSettings> = {
  fitMode: "auto",
  tileSize: 2,
  repeatX: 1,
  repeatY: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  globalRotation: 0,
  patternVariation: false,
};

const PATTERN_TARGET_GRID = 16;
const PATTERN_MAX_CANVAS_SIZE = 4096;
const PATTERN_MIN_TILE_PIXELS = 128;
const PATTERN_MAX_TILE_PIXELS = 512;
const patternTextureCache = new Map<string, THREE.Texture>();

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
  merged.globalRotation = Number(merged.globalRotation) || 0;
  merged.patternVariation = Boolean(merged.patternVariation);
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

export function remapBoxUVs(geometry: THREE.BufferGeometry, dimensions: any, settings: Required<MapTextureSettings>) {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!uv || !position || !normal) return;

  const sx = Math.max(0.001, dimensions.x || 1);
  const sy = Math.max(0.001, dimensions.y || 1);
  const sz = Math.max(0.001, dimensions.z || 1);
  const tile = Math.max(0.1, settings.tileSize);

  const angleRad = THREE.MathUtils.degToRad(settings.globalRotation || 0);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

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
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      u = (rx + sx / 2) / tile;
      v = (rz + sz / 2) / tile;
    } else if (nx >= nz) {
      const rz = pz * cos - py * sin;
      const ry = pz * sin + py * cos;
      u = (rz + sz / 2) / tile;
      v = (ry + sy / 2) / tile;
    } else {
      const rx = px * cos - py * sin;
      const ry = px * sin + py * cos;
      u = (rx + sx / 2) / tile;
      v = (ry + sy / 2) / tile;
    }

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

function hashNumber(value: number) {
  return Math.floor(value * 1000);
}

function hashInts(values: number[]) {
  let h = 2166136261;
  values.forEach((value) => {
    h ^= value;
    h = Math.imul(h, 16777619);
  });
  return Math.abs(h);
}

function getStableTextureVariant(mesh: any, root: any) {
  const meshPos = mesh.position || { x: 0, y: 0, z: 0 };
  const rootPos = root?.position || { x: 0, y: 0, z: 0 };
  return hashInts([rootPos.x, rootPos.y, rootPos.z, meshPos.x, meshPos.y, meshPos.z].map(hashNumber)) % 8;
}

function getWorldTileAnchor(mesh: any, root: any, dimensions: any, settings: Required<MapTextureSettings>) {
  const meshPos = mesh.position || { x: 0, z: 0 };
  const rootPos = root?.position || { x: 0, z: 0 };
  const tile = Math.max(0.1, settings.tileSize);
  const worldX = (rootPos.x || 0) + (meshPos.x || 0) - (dimensions.x || 1) / 2;
  const worldZ = (rootPos.z || 0) + (meshPos.z || 0) - (dimensions.z || dimensions.x || 1) / 2;
  return {
    x: Math.floor(worldX / tile),
    z: Math.floor(worldZ / tile),
  };
}

function drawTileVariant(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, size: number, variant: number) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);

  if (variant === 1) {
    ctx.rotate(Math.PI / 2);
  } else if (variant === 2) {
    ctx.rotate(Math.PI);
  } else if (variant === 3) {
    ctx.rotate(Math.PI * 1.5);
  } else if (variant === 4) {
    ctx.scale(-1, 1);
  } else if (variant === 5) {
    ctx.scale(1, -1);
  } else if (variant === 6) {
    ctx.scale(-1, -1);
  } else if (variant === 7) {
    ctx.rotate(Math.PI / 2);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function getImageMaxDimension(image: any) {
  const width = image?.naturalWidth || image?.videoWidth || image?.width || PATTERN_MIN_TILE_PIXELS;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || PATTERN_MIN_TILE_PIXELS;
  return Math.max(width, height);
}

function getPatternAtlasSize(image: CanvasImageSource) {
  const sourceMax = getImageMaxDimension(image);
  const tilePixels = Math.max(PATTERN_MIN_TILE_PIXELS, Math.min(PATTERN_MAX_TILE_PIXELS, sourceMax));
  const gridSize = Math.max(4, Math.min(PATTERN_TARGET_GRID, Math.floor(PATTERN_MAX_CANVAS_SIZE / tilePixels)));
  return {
    gridSize,
    tilePixels,
    canvasSize: gridSize * tilePixels,
  };
}

function createDeterministicPatternTexture(
  sourceTexture: THREE.Texture,
  settings: Required<MapTextureSettings>,
  mesh: any,
  root: any,
  dimensions: any
) {
  const image = sourceTexture.image as CanvasImageSource | undefined;
  if (!image) return null;

  const atlas = getPatternAtlasSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = atlas.canvasSize;
  canvas.height = atlas.canvasSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const anchor = getWorldTileAnchor(mesh, root, dimensions, settings);
  const cacheKey = [
    sourceTexture.uuid,
    settings.tileSize,
    atlas.gridSize,
    atlas.tilePixels,
    anchor.x % atlas.gridSize,
    anchor.z % atlas.gridSize,
  ].join(":");

  const cached = patternTextureCache.get(cacheKey);
  if (cached) return cached.clone();

  for (let ix = 0; ix < atlas.gridSize; ix += 1) {
    for (let iz = 0; iz < atlas.gridSize; iz += 1) {
      const variant = hashInts([anchor.x + ix, anchor.z + iz, 9127, 431]) % 8;
      drawTileVariant(ctx, image, ix * atlas.tilePixels, iz * atlas.tilePixels, atlas.tilePixels, variant);
    }
  }

  const patternTexture = new THREE.CanvasTexture(canvas);
  patternTexture.userData.patternGrid = atlas.gridSize;
  patternTexture.colorSpace = sourceTexture.colorSpace || THREE.SRGBColorSpace;
  patternTexture.generateMipmaps = true;
  patternTexture.minFilter = THREE.LinearMipmapLinearFilter;
  patternTexture.magFilter = sourceTexture.magFilter || THREE.LinearFilter;
  patternTextureCache.set(cacheKey, patternTexture);
  return patternTexture.clone();
}

function configureTexture(texture: THREE.Texture, settings: Required<MapTextureSettings>, variant = 0) {
  const patternGrid = Math.max(1, texture.userData?.patternGrid || 1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(settings.repeatX / patternGrid, settings.repeatY / patternGrid);
  texture.offset.set(settings.offsetX, settings.offsetY);
  texture.rotation = THREE.MathUtils.degToRad(settings.rotation);
  texture.center.set(0.5, 0.5);

  if (settings.patternVariation && patternGrid === 1) {
    if (variant === 1) {
      texture.rotation += Math.PI / 2;
    } else if (variant === 2) {
      texture.rotation += Math.PI;
    } else if (variant === 3) {
      texture.rotation += Math.PI * 1.5;
    } else if (variant === 4) {
      texture.repeat.x *= -1;
    } else if (variant === 5) {
      texture.repeat.y *= -1;
    } else if (variant === 6) {
      texture.repeat.x *= -1;
      texture.repeat.y *= -1;
    } else if (variant === 7) {
      texture.rotation += Math.PI / 2;
      texture.repeat.x *= -1;
    }
  }

  texture.needsUpdate = true;
}

export function applyMapObjectTexture(object3D: any, texture: THREE.Texture, fallbackDimensions: any, settings?: MapTextureSettings | null) {
  const normalized = normalizeTextureSettings(settings);

  const applyToMesh = (mesh: any) => {
    if (!mesh?.isMesh || !mesh.material) return;
    const dimensions = getMeshDimensions(mesh, fallbackDimensions);

    if (normalized.fitMode === "auto" && mesh.geometry?.type === "BoxGeometry") {
      remapBoxUVs(mesh.geometry, dimensions, normalized);
    }

    const patternTexture = normalized.patternVariation
      ? createDeterministicPatternTexture(texture, normalized, mesh, object3D, dimensions)
      : null;
    const meshTexture = patternTexture || texture.clone();
    configureTexture(meshTexture, normalized, getStableTextureVariant(mesh, object3D));

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material: any) => {
      material.map = meshTexture;
      material.needsUpdate = true;
    });
  };

  if (object3D?.traverse) {
    object3D.traverse(applyToMesh);
  } else {
    applyToMesh(object3D);
  }
}

export function applyWorldSpaceUVs(geometry: THREE.BufferGeometry, settings: Required<MapTextureSettings>) {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!uv || !position || !normal) return;

  const tile = Math.max(0.1, settings.tileSize);
  const globalRotRad = THREE.MathUtils.degToRad(settings.globalRotation || 0);
  const cos = Math.cos(globalRotRad);
  const sin = Math.sin(globalRotRad);

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
      // Top/Bottom faces: project on X-Z plane
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      u = rx / tile;
      v = rz / tile;
    } else if (nx >= nz) {
      // East/West faces: project on Z-Y plane
      const rz = pz * cos - py * sin;
      const ry = pz * sin + py * cos;
      u = rz / tile;
      v = ry / tile;
    } else {
      // North/South faces: project on X-Y plane
      const rx = px * cos - py * sin;
      const ry = px * sin + py * cos;
      u = rx / tile;
      v = ry / tile;
    }

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

import { createHash, randomUUID } from "node:crypto"
import { AssetKind, AssetVisibility, type Prisma } from "@prisma/client"
import { prisma } from "../db/prisma.js"
import { AuthError } from "./AuthService.js"
import { getObject, getStorageProvider, putObject } from "./ObjectStorageService.js"

export interface UploadedAssetFile {
  filename: string
  mimeType: string
  buffer: Buffer
}

export interface CreateAssetInput {
  kind?: unknown
  visibility?: unknown
  name?: unknown
  description?: unknown
  metadata?: unknown
  file: UploadedAssetFile
}

const assetSelect = {
  id: true,
  ownerId: true,
  kind: true,
  visibility: true,
  name: true,
  description: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationMs: true,
  storageProvider: true,
  bucket: true,
  objectKey: true,
  publicUrl: true,
  checksumSha256: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
} satisfies Prisma.AssetSelect

type AssetRecord = Prisma.AssetGetPayload<{ select: typeof assetSelect }>

export async function createAsset(input: CreateAssetInput, ownerId: string) {
  const kind = normalizeKind(input.kind)
  const visibility = normalizeVisibility(input.visibility, AssetVisibility.UNLISTED)
  const name = normalizeName(input.name, input.file.filename)
  const description = normalizeDescription(input.description)
  const metadata = normalizeMetadata(input.metadata)
  const mimeType = normalizeMimeType(input.file.mimeType, input.file.filename)
  const sizeBytes = input.file.buffer.byteLength
  const maxBytes = getMaxBytesForKind(kind)

  if (sizeBytes <= 0) throw new AuthError(400, "Archivo vacio")
  if (sizeBytes > maxBytes) {
    throw new AuthError(413, `Archivo demasiado grande para ${kind}. Maximo ${Math.round(maxBytes / 1024 / 1024)} MB`)
  }

  assertMimeAllowed(kind, mimeType)

  const dimensions = readImageSize(input.file.buffer, mimeType)
  if (kind === AssetKind.CHARACTER_SKIN) {
    if (dimensions.width !== 64 || dimensions.height !== 64) {
      throw new AuthError(400, "La skin de personaje debe ser PNG 64x64")
    }
  }

  const id = randomUUID()
  const extension = getExtension(input.file.filename, mimeType)
  const objectKey = buildObjectKey(ownerId, kind, id, extension)
  const checksumSha256 = createHash("sha256").update(input.file.buffer).digest("hex")

  const stored = await putObject({
    objectKey,
    body: input.file.buffer,
    contentType: mimeType,
    metadata: {
      assetId: id,
      ownerId,
      kind,
    },
  })

  const asset = await prisma.asset.create({
    data: {
      id,
      ownerId,
      kind,
      visibility,
      name,
      description,
      mimeType,
      sizeBytes,
      width: dimensions.width,
      height: dimensions.height,
      storageProvider: getStorageProvider(),
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      publicUrl: buildDirectPublicUrl(stored.objectKey),
      checksumSha256,
      ...(metadata !== undefined ? { metadata } : {}),
    },
    select: assetSelect,
  })

  return toAssetDto(asset)
}

export async function listAssets(scope: string | null, userId: string | null, kindInput?: string | null) {
  const kind = kindInput ? normalizeKind(kindInput) : null
  const where: Prisma.AssetWhereInput =
    scope === "mine"
      ? userId
        ? { ownerId: userId }
        : { id: "__no_authenticated_user__" }
      : scope === "all" && userId
        ? { OR: [{ visibility: AssetVisibility.PUBLIC }, { ownerId: userId }] }
        : { visibility: AssetVisibility.PUBLIC }

  const assets = await prisma.asset.findMany({
    where: {
      ...where,
      ...(kind ? { kind } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: assetSelect,
  })

  return assets.map(toAssetDto)
}

export async function getAsset(identifier: string, userId: string | null) {
  const asset = await prisma.asset.findUnique({
    where: { id: identifier },
    select: assetSelect,
  })

  if (!asset) throw new AuthError(404, "Recurso no encontrado")
  assertCanReadAsset(asset, userId)
  return toAssetDto(asset)
}

export async function getAssetObject(identifier: string, userId: string | null) {
  const asset = await prisma.asset.findUnique({
    where: { id: identifier },
    select: assetSelect,
  })

  if (!asset) throw new AuthError(404, "Recurso no encontrado")
  assertCanReadAsset(asset, userId)

  const object = await getObject(asset.bucket, asset.objectKey)
  return { asset, object }
}

export async function assertAssetUsable(assetId: string, ownerId: string, kind?: AssetKind) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      ownerId: true,
      kind: true,
      visibility: true,
    },
  })

  if (!asset) throw new AuthError(400, "Recurso no encontrado")
  if (asset.ownerId !== ownerId) throw new AuthError(403, "No puedes usar este recurso")
  if (kind && asset.kind !== kind) throw new AuthError(400, "Tipo de recurso invalido")
  return asset
}

function toAssetDto(asset: AssetRecord) {
  return {
    id: asset.id,
    ownerId: asset.ownerId,
    owner: asset.owner,
    kind: asset.kind,
    visibility: asset.visibility,
    name: asset.name,
    description: asset.description,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    storageProvider: asset.storageProvider,
    publicUrl: asset.publicUrl,
    fileUrl: asset.publicUrl || `/api/assets/${encodeURIComponent(asset.id)}/file`,
    metadata: asset.metadata,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

function assertCanReadAsset(asset: Pick<AssetRecord, "ownerId" | "visibility">, userId: string | null): void {
  if (asset.visibility !== AssetVisibility.PRIVATE) return
  if (asset.ownerId && asset.ownerId === userId) return
  throw new AuthError(403, "No tienes acceso a este recurso")
}

function normalizeKind(value: unknown): AssetKind {
  if (typeof value !== "string") throw new AuthError(400, "Tipo de recurso requerido")
  const normalized = value.trim().toUpperCase()
  if (!Object.values(AssetKind).includes(normalized as AssetKind)) {
    throw new AuthError(400, "Tipo de recurso invalido")
  }
  return normalized as AssetKind
}

function normalizeVisibility(value: unknown, fallback: AssetVisibility): AssetVisibility {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value !== "string") throw new AuthError(400, "Visibilidad invalida")
  const normalized = value.trim().toUpperCase()
  if (!Object.values(AssetVisibility).includes(normalized as AssetVisibility)) {
    throw new AuthError(400, "Visibilidad invalida")
  }
  return normalized as AssetVisibility
}

function normalizeName(value: unknown, fallback: string): string {
  const raw = typeof value === "string" && value.trim() ? value : fallback
  const clean = raw.trim().replace(/\s+/g, " ").slice(0, 100)
  if (!clean) throw new AuthError(400, "Nombre de recurso requerido")
  return clean
}

function normalizeDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") throw new AuthError(400, "Descripcion invalida")
  return value.trim().slice(0, 500) || null
}

function normalizeMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "object" || Array.isArray(value)) throw new AuthError(400, "Metadata invalida")
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function normalizeMimeType(mimeType: string, filename: string): string {
  const clean = mimeType.trim().toLowerCase()
  if (clean && clean !== "application/octet-stream") return clean

  const lower = filename.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".glb")) return "model/gltf-binary"
  if (lower.endsWith(".gltf")) return "model/gltf+json"
  if (lower.endsWith(".json")) return "application/json"
  return clean || "application/octet-stream"
}

function assertMimeAllowed(kind: AssetKind, mimeType: string): void {
  const allowed: Record<AssetKind, string[]> = {
    [AssetKind.MAP_IMAGE]: ["image/png", "image/jpeg", "image/webp"],
    [AssetKind.TEXTURE]: ["image/png", "image/jpeg", "image/webp"],
    [AssetKind.CHARACTER_SKIN]: ["image/png"],
    [AssetKind.SOUND]: ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/ogg", "application/ogg"],
    [AssetKind.MODEL]: ["model/gltf-binary", "model/gltf+json", "application/octet-stream"],
    [AssetKind.VFX]: ["application/json"],
    [AssetKind.OTHER]: [],
  }

  const accepted = allowed[kind]
  if (accepted.length > 0 && !accepted.includes(mimeType)) {
    throw new AuthError(400, `Formato no permitido para ${kind}: ${mimeType}`)
  }
}

function getMaxBytesForKind(kind: AssetKind): number {
  const configured = Number(process.env.ASSET_MAX_UPLOAD_BYTES || 50 * 1024 * 1024)
  const globalMax = Number.isFinite(configured) && configured > 0 ? configured : 50 * 1024 * 1024
  const perKind: Record<AssetKind, number> = {
    [AssetKind.MAP_IMAGE]: 10 * 1024 * 1024,
    [AssetKind.TEXTURE]: 10 * 1024 * 1024,
    [AssetKind.CHARACTER_SKIN]: 2 * 1024 * 1024,
    [AssetKind.SOUND]: 30 * 1024 * 1024,
    [AssetKind.MODEL]: 50 * 1024 * 1024,
    [AssetKind.VFX]: 5 * 1024 * 1024,
    [AssetKind.OTHER]: 50 * 1024 * 1024,
  }
  return Math.min(globalMax, perKind[kind])
}

function buildObjectKey(ownerId: string, kind: AssetKind, id: string, extension: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `users/${ownerId}/assets/${kind.toLowerCase()}/${year}/${month}/${id}${extension}`
}

function getExtension(filename: string, mimeType: string): string {
  const match = /\.[a-z0-9]+$/i.exec(filename)
  if (match) return match[0].toLowerCase()
  const byMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "model/gltf-binary": ".glb",
    "model/gltf+json": ".gltf",
    "application/json": ".json",
  }
  return byMime[mimeType] || ".bin"
}

function buildDirectPublicUrl(objectKey: string): string | null {
  const base = process.env.ASSET_PUBLIC_BASE_URL?.trim()
  if (!base) return null
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/")
  return `${base.replace(/\/+$/, "")}/${encodedKey}`
}

function readImageSize(buffer: Buffer, mimeType: string): { width: number | null; height: number | null } {
  if (mimeType === "image/png" && buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }

  if (mimeType === "image/jpeg") {
    return readJpegSize(buffer)
  }

  if (mimeType === "image/webp") {
    return readWebpSize(buffer)
  }

  return { width: null, height: null }
}

function readJpegSize(buffer: Buffer): { width: number | null; height: number | null } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return { width: null, height: null }

  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return { width: null, height: null }
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (marker !== undefined && marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }

  return { width: null, height: null }
}

function readWebpSize(buffer: Buffer): { width: number | null; height: number | null } {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return { width: null, height: null }
  }

  const format = buffer.toString("ascii", 12, 16)
  if (format === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    }
  }

  return { width: null, height: null }
}

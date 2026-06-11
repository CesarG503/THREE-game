import { AssetKind, type Prisma } from "@prisma/client"
import { prisma } from "../db/prisma.js"
import { assertAssetUsable } from "./AssetService.js"
import { AuthError } from "./AuthService.js"

export interface MapWriteInput {
  name?: unknown
  description?: unknown
  isPublished?: unknown
  data?: unknown
  notes?: unknown
  coverAssetId?: unknown
}

export async function listMaps(scope: string | null, userId: string | null) {
  const where =
    scope === "mine"
      ? userId
        ? { ownerId: userId }
        : { id: "__no_authenticated_user__" }
      : scope === "all" && userId
        ? { OR: [{ isPublished: true }, { ownerId: userId }] }
        : { isPublished: true }

  const maps = await prisma.gameMap.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: mapInclude,
    take: 80,
  })

  return maps.map((map) => toMapDto(map, false))
}

export async function getMap(identifier: string, userId: string | null) {
  const map = await prisma.gameMap.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier },
      ],
    },
    include: mapInclude,
  })

  if (!map) throw new AuthError(404, "Mapa no encontrado")
  assertCanReadMap(map.ownerId, map.isPublished, userId)

  return toMapDto(map, true)
}

export async function createMap(input: MapWriteInput, ownerId: string) {
  const name = normalizeName(input.name)
  const description = normalizeDescription(input.description)
  const isPublished = normalizeBoolean(input.isPublished, false)
  const data = normalizeMapData(input.data)
  const notes = normalizeNotes(input.notes) ?? "Version inicial"
  const coverAssetId = normalizeCoverAssetId(input.coverAssetId)
  const slug = await createUniqueSlug(name)

  if (coverAssetId) {
    await assertAssetUsable(coverAssetId, ownerId, AssetKind.MAP_IMAGE)
  }

  const created = await prisma.$transaction(async (tx) => {
    const map = await tx.gameMap.create({
      data: {
        slug,
        name,
        description,
        ownerId,
        coverAssetId,
        isPublished,
      },
    })

    const version = await tx.gameMapVersion.create({
      data: {
        mapId: map.id,
        version: 1,
        data,
        notes,
      },
    })

    return tx.gameMap.update({
      where: { id: map.id },
      data: { currentVersionId: version.id },
      include: mapInclude,
    })
  })

  return toMapDto(created, true)
}

export async function updateMap(identifier: string, input: MapWriteInput, ownerId: string) {
  const existing = await prisma.gameMap.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier },
      ],
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true },
      },
    },
  })

  if (!existing) throw new AuthError(404, "Mapa no encontrado")
  assertOwnsMap(existing.ownerId, ownerId)

  const name = input.name === undefined ? undefined : normalizeName(input.name)
  const description = input.description === undefined ? undefined : normalizeDescription(input.description)
  const isPublished = input.isPublished === undefined ? undefined : normalizeBoolean(input.isPublished, false)
  const coverAssetId = input.coverAssetId === undefined ? undefined : normalizeCoverAssetId(input.coverAssetId)
  const shouldCreateVersion = input.data !== undefined
  const data = shouldCreateVersion ? normalizeMapData(input.data) : null
  const notes = normalizeNotes(input.notes)

  if (coverAssetId) {
    await assertAssetUsable(coverAssetId, ownerId, AssetKind.MAP_IMAGE)
  }

  const updated = await prisma.$transaction(async (tx) => {
    let currentVersionId = existing.currentVersionId

    if (shouldCreateVersion && data) {
      const latestVersion = existing.versions[0]?.version ?? 0
      const version = await tx.gameMapVersion.create({
        data: {
          mapId: existing.id,
          version: latestVersion + 1,
          data,
          notes: notes ?? `Guardado ${new Date().toISOString()}`,
        },
      })
      currentVersionId = version.id
    }

    return tx.gameMap.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isPublished !== undefined ? { isPublished } : {}),
        ...(coverAssetId !== undefined ? { coverAssetId } : {}),
        ...(currentVersionId !== existing.currentVersionId ? { currentVersionId } : {}),
      },
      include: mapInclude,
    })
  })

  return toMapDto(updated, true)
}

export async function deleteMap(identifier: string, ownerId: string) {
  const map = await prisma.gameMap.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: identifier },
      ],
    },
    select: {
      id: true,
      ownerId: true,
    },
  })

  if (!map) throw new AuthError(404, "Mapa no encontrado")
  assertOwnsMap(map.ownerId, ownerId)

  await prisma.gameMap.delete({ where: { id: map.id } })
  return { ok: true }
}

const mapInclude = {
  owner: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  coverAsset: {
    select: {
      id: true,
      kind: true,
      mimeType: true,
      width: true,
      height: true,
      publicUrl: true,
    },
  },
  versions: {
    orderBy: { version: "desc" },
    take: 1,
    select: {
      id: true,
      version: true,
      data: true,
      notes: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      versions: true,
      matches: true,
    },
  },
} satisfies Prisma.GameMapInclude

type MapWithInclude = Prisma.GameMapGetPayload<{ include: typeof mapInclude }>

function toMapDto(map: MapWithInclude, includeData: boolean) {
  const currentVersion = map.versions[0] ?? null
  const data = currentVersion?.data ?? null

  return {
    id: map.id,
    slug: map.slug,
    name: map.name,
    description: map.description,
    isPublished: map.isPublished,
    ownerId: map.ownerId,
    owner: map.owner,
    coverAssetId: map.coverAssetId,
    coverAsset: map.coverAsset
      ? {
        ...map.coverAsset,
        fileUrl: map.coverAsset.publicUrl || `/api/assets/${encodeURIComponent(map.coverAsset.id)}/file`,
      }
      : null,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    currentVersionId: map.currentVersionId,
    version: currentVersion?.version ?? 0,
    objectCount: countObjects(data),
    matchCount: map._count.matches,
    versionCount: map._count.versions,
    currentVersion: currentVersion
      ? {
        id: currentVersion.id,
        version: currentVersion.version,
        notes: currentVersion.notes,
        createdAt: currentVersion.createdAt,
        ...(includeData ? { data } : {}),
      }
      : null,
  }
}

async function createUniqueSlug(name: string) {
  const base = slugify(name) || "mapa"

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`
    const slug = `${base}${suffix}`
    const exists = await prisma.gameMap.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!exists) return slug
  }

  return `${base}-${Date.now().toString(36)}`
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function normalizeName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(400, "Nombre de mapa requerido")
  }

  const name = value.trim()
  if (name.length < 3 || name.length > 80) {
    throw new AuthError(400, "El nombre debe tener entre 3 y 80 caracteres")
  }
  return name
}

function normalizeDescription(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new AuthError(400, "Descripcion invalida")
  return value.trim().slice(0, 500) || null
}

function normalizeNotes(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new AuthError(400, "Notas invalidas")
  return value.trim().slice(0, 240) || null
}

function normalizeCoverAssetId(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") throw new AuthError(400, "Imagen de mapa invalida")
  const id = value.trim()
  if (!id || id.length > 120) throw new AuthError(400, "Imagen de mapa invalida")
  return id
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== "boolean") throw new AuthError(400, "Valor booleano invalido")
  return value
}

function normalizeMapData(value: unknown): Prisma.InputJsonValue {
  const data = value ?? {
    gameVersion: "1.0",
    timestamp: Date.now(),
    objects: [],
    gameConfig: { sequences: [] },
    environmentConfig: {
      mapSizeX: 100,
      mapSizeZ: 100,
      invisibleWalls: false,
      fallDeath: true,
      fallDeathY: -20,
    },
    playerConfig: { roles: [], assignments: {} },
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new AuthError(400, "Datos de mapa invalidos")
  }

  try {
    const json = JSON.stringify(data)
    if (Buffer.byteLength(json, "utf8") > 1024 * 1024 * 2) {
      throw new AuthError(413, "Mapa demasiado grande")
    }
    return JSON.parse(json) as Prisma.InputJsonValue
  } catch (err) {
    if (err instanceof AuthError) throw err
    throw new AuthError(400, "El mapa debe ser JSON valido")
  }
}

function countObjects(data: unknown) {
  if (typeof data !== "object" || data === null || !("objects" in data)) return 0
  const objects = (data as { objects?: unknown }).objects
  return Array.isArray(objects) ? objects.length : 0
}

function assertCanReadMap(ownerId: string | null, isPublished: boolean, userId: string | null) {
  if (isPublished || ownerId === userId) return
  throw new AuthError(403, "No tienes acceso a este mapa")
}

function assertOwnsMap(ownerId: string | null, userId: string) {
  if (ownerId === userId) return
  throw new AuthError(403, "Solo el creador puede modificar este mapa")
}

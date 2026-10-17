import { type Prisma } from "@prisma/client"
import { prisma } from "../db/prisma.js"
import { AuthError } from "./AuthService.js"

export interface PrefabWriteInput {
  name?: unknown
  description?: unknown
  category?: unknown
  isPublished?: unknown
  data?: unknown
  notes?: unknown
}

const prefabInclude = {
  owner: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  versions: {
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      notes: true,
      createdAt: true,
      data: true,
    },
  },
} as const

type PrefabQueryResult = Prisma.PrefabGetPayload<{ include: typeof prefabInclude }>

export async function listPrefabs(
  scope: string | null,
  userId: string | null,
  category: string | null = null,
) {
  const where: any = {}

  if (category) {
    where.category = category
  }

  if (scope === "mine") {
    where.ownerId = userId ?? "__no_authenticated_user__"
  } else if (scope === "all" && userId) {
    where.OR = [{ isPublished: true }, { ownerId: userId }]
  } else {
    where.isPublished = true
  }

  const prefabs = await prisma.prefab.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: prefabInclude,
    take: 100,
  })

  return prefabs.map((p) => toPrefabDto(p, false))
}

export async function getPrefab(
  identifier: string,
  userId: string | null,
  versionNumber?: number | null,
) {
  const prefab = await prisma.prefab.findFirst({
    where: {
      OR: [{ id: identifier }, { slug: identifier }],
    },
    include: prefabInclude,
  })

  if (!prefab) throw new AuthError(404, "Prefab no encontrado")
  assertCanReadPrefab(prefab.ownerId, prefab.isPublished, userId)

  return toPrefabDto(prefab, true, versionNumber)
}

export async function createPrefab(input: PrefabWriteInput, ownerId: string) {
  const name = normalizeName(input.name)
  const description = normalizeDescription(input.description)
  const category = normalizeCategory(input.category)
  const isPublished = normalizeBoolean(input.isPublished, false)
  const data = normalizePrefabData(input.data)
  const notes = normalizeNotes(input.notes) ?? "Versión inicial del prefab"
  const slug = await createUniqueSlug(name)

  const created = await prisma.$transaction(async (tx) => {
    const prefab = await tx.prefab.create({
      data: {
        slug,
        name,
        description,
        category,
        ownerId,
        isPublished,
      },
    })

    const version = await tx.prefabVersion.create({
      data: {
        prefabId: prefab.id,
        version: 1,
        data,
        notes,
      },
    })

    return tx.prefab.update({
      where: { id: prefab.id },
      data: { currentVersionId: version.id },
      include: prefabInclude,
    })
  })

  return toPrefabDto(created, true)
}

export async function updatePrefab(
  identifier: string,
  input: PrefabWriteInput,
  ownerId: string,
) {
  const existing = await prisma.prefab.findFirst({
    where: {
      OR: [{ id: identifier }, { slug: identifier }],
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true },
      },
    },
  })

  if (!existing) throw new AuthError(404, "Prefab no encontrado")
  assertOwnsPrefab(existing.ownerId, ownerId)

  const name = input.name === undefined ? undefined : normalizeName(input.name)
  const description = input.description === undefined ? undefined : normalizeDescription(input.description)
  const category = input.category === undefined ? undefined : normalizeCategory(input.category)
  const isPublished = input.isPublished === undefined ? undefined : normalizeBoolean(input.isPublished, false)
  const shouldCreateVersion = input.data !== undefined
  const data = shouldCreateVersion ? normalizePrefabData(input.data) : null
  const notes = normalizeNotes(input.notes)

  const updated = await prisma.$transaction(async (tx) => {
    let currentVersionId = existing.currentVersionId

    if (shouldCreateVersion && data) {
      const latestVersion = existing.versions[0]?.version ?? 0
      const version = await tx.prefabVersion.create({
        data: {
          prefabId: existing.id,
          version: latestVersion + 1,
          data,
          notes: notes ?? `Actualización v${latestVersion + 1} (${new Date().toISOString()})`,
        },
      })
      currentVersionId = version.id
    }

    return tx.prefab.update({
      where: { id: existing.id },
      data: {
        name,
        description,
        category,
        isPublished,
        currentVersionId,
      },
      include: prefabInclude,
    })
  })

  return toPrefabDto(updated, true)
}

export async function deletePrefab(identifier: string, ownerId: string) {
  const existing = await prisma.prefab.findFirst({
    where: {
      OR: [{ id: identifier }, { slug: identifier }],
    },
    select: { id: true, ownerId: true },
  })

  if (!existing) throw new AuthError(404, "Prefab no encontrado")
  assertOwnsPrefab(existing.ownerId, ownerId)

  await prisma.prefab.delete({ where: { id: existing.id } })
  return { ok: true, id: existing.id }
}

function toPrefabDto(
  prefab: PrefabQueryResult,
  includeData: boolean,
  specificVersion?: number | null,
) {
  const versions = prefab.versions ?? []
  const targetVersion = specificVersion
    ? versions.find((v) => v.version === specificVersion) ?? versions[0]
    : versions.find((v) => v.id === prefab.currentVersionId) ?? versions[0]

  return {
    id: prefab.id,
    slug: prefab.slug,
    name: prefab.name,
    description: prefab.description,
    category: prefab.category,
    isPublished: prefab.isPublished,
    ownerId: prefab.ownerId,
    owner: prefab.owner,
    createdAt: prefab.createdAt.toISOString(),
    updatedAt: prefab.updatedAt.toISOString(),
    currentVersionId: prefab.currentVersionId,
    version: targetVersion?.version ?? 1,
    versionCount: versions.length,
    currentVersion: targetVersion
      ? {
          id: targetVersion.id,
          version: targetVersion.version,
          notes: targetVersion.notes,
          createdAt: targetVersion.createdAt.toISOString(),
          ...(includeData ? { data: targetVersion.data } : {}),
        }
      : null,
  }
}

function assertCanReadPrefab(
  ownerId: string | null,
  isPublished: boolean,
  userId: string | null,
) {
  if (isPublished) return
  if (userId && ownerId === userId) return
  throw new AuthError(403, "No tienes permiso para ver este prefab privado")
}

function assertOwnsPrefab(ownerId: string | null, userId: string) {
  if (!ownerId || ownerId !== userId) {
    throw new AuthError(403, "No tienes permiso para modificar este prefab")
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(400, "El nombre del prefab es obligatorio")
  }
  return value.trim().slice(0, 80)
}

function normalizeDescription(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new AuthError(400, "Descripción inválida")
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 500) : null
}

function normalizeCategory(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "general"
  return value.trim().toLowerCase().slice(0, 30)
}

function normalizeNotes(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new AuthError(400, "Notas de versión inválidas")
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 300) : null
}

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  throw new AuthError(400, "Valor booleano inválido")
}

function normalizePrefabData(value: unknown): any {
  if (!value || typeof value !== "object") {
    throw new AuthError(400, "Datos del prefab inválidos")
  }
  return value
}

async function createUniqueSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "prefab"

  let candidate = base
  let index = 1

  while (true) {
    const existing = await prisma.prefab.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    index += 1
    candidate = `${base}-${index}`
  }
}

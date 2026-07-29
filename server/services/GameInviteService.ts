import crypto from "node:crypto"
import { getRedis } from "../cache/redis.js"
import { logger } from "../utils/Logger.js"

export interface GameInvite {
  id: string
  senderId: string
  targetUserId: string
  roomId: string
  createdAt: number
}

// In-memory fallback for environment setups without Redis
const invitesMemory = new Map<string, GameInvite>()
const REDIS_INVITE_PREFIX = "game_invite:"
const INVITE_TTL_SECONDS = 30

/**
 * Creates a game invitation with a 30 seconds expiration time.
 * Uses Redis if available; otherwise falls back to memory.
 */
export async function createGameInvite(
  senderId: string,
  targetUserId: string,
  roomId: string
): Promise<GameInvite> {
  const id = crypto.randomUUID()
  const invite: GameInvite = {
    id,
    senderId,
    targetUserId,
    roomId,
    createdAt: Date.now(),
  }

  const redis = getRedis()
  if (redis && redis.isOpen) {
    const key = `${REDIS_INVITE_PREFIX}${id}`
    await redis.set(key, JSON.stringify(invite), { EX: INVITE_TTL_SECONDS })
  } else {
    // Memory fallback
    invitesMemory.set(id, invite)
    // Automatic cleanup after TTL
    setTimeout(() => {
      if (invitesMemory.has(id)) {
        invitesMemory.delete(id)
        logger.info("GameInviteService", `Game invite ${id} expired (in-memory cleanup)`)
      }
    }, INVITE_TTL_SECONDS * 1000)
  }

  logger.info("GameInviteService", `Created game invite ${id} from ${senderId} to ${targetUserId} for room ${roomId}`)
  return invite
}

/**
 * Retrieves an active game invitation by its ID.
 */
export async function getGameInvite(inviteId: string): Promise<GameInvite | null> {
  const redis = getRedis()
  if (redis && redis.isOpen) {
    const key = `${REDIS_INVITE_PREFIX}${inviteId}`
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as GameInvite
  } else {
    return invitesMemory.get(inviteId) || null
  }
}

/**
 * Deletes a game invitation after consumption or rejection.
 */
export async function deleteGameInvite(inviteId: string): Promise<void> {
  const redis = getRedis()
  if (redis && redis.isOpen) {
    const key = `${REDIS_INVITE_PREFIX}${inviteId}`
    await redis.del(key)
  } else {
    invitesMemory.delete(inviteId)
  }
  logger.info("GameInviteService", `Deleted game invite ${inviteId}`)
}

import { createClient } from "@redis/client"
import { logger } from "../utils/Logger.js"

export type RedisClient = ReturnType<typeof createClient>

let redis: RedisClient | null = null
let connectPromise: Promise<RedisClient | null> | null = null

export function getRedis(): RedisClient | null {
  return redis
}

export async function connectRedis(): Promise<RedisClient | null> {
  if (redis?.isOpen) return redis
  if (connectPromise) return connectPromise

  const url = process.env.REDIS_URL
  if (!url) {
    logger.warn("Redis", "REDIS_URL is not configured; Redis features are disabled")
    return null
  }

  redis = createClient({
    url,
    socket: {
      reconnectStrategy: false,
    },
  })
  redis.on("error", () => {
    // The connect() promise below reports the initial failure. Keep this
    // listener so node-redis does not emit an unhandled error.
  })

  connectPromise = redis.connect()
    .then(() => {
      logger.info("Redis", "Connected")
      return redis
    })
    .catch((err) => {
      logger.warn("Redis", "Unable to connect; Redis features are disabled")
      redis = null
      return null
    })
    .finally(() => {
      connectPromise = null
    })

  return connectPromise
}

export async function disconnectRedis(): Promise<void> {
  if (!redis?.isOpen) return
  await redis.quit()
  redis = null
}

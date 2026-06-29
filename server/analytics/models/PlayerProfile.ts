import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { getRedis } from "../../cache/redis.js";
import { logger } from "../../utils/Logger.js";

export interface IPlayerProfile {
  // Operational details (User)
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  createdAt: Date;

  // Analytical features (PlayerFeatures)
  lastActive: Date | null;
  totalPlayTime: number | null;
  matchesPlayed: number | null;
  preferredLanguage: string | null;
  explorerRatio: number | null;
  playerProfile: string | null;
  popularitySensitivity: number | null;
  returnIntent: number | null;
  scheduleProfile: any | null;
}

export class PlayerProfileRepository {
  private static readonly REDIS_PREFIX = "analytics:profile:";
  private static readonly TTL_SECONDS = 60;

  /**
   * Obtiene el perfil unificado del jugador (User + PlayerFeatures).
   * Intenta consultar en caché de Redis primero. Si no está, consulta bases de datos
   * y guarda en caché. Tolera fallas de conexión de Redis.
   */
  public static async getProfile(userId: string): Promise<IPlayerProfile | null> {
    const redisKey = `${this.REDIS_PREFIX}${userId}`;
    const redis = getRedis();

    // 1. Intentar consultar caché de Redis
    if (redis && redis.isOpen) {
      try {
        const cached = await redis.get(redisKey);
        if (cached) {
          logger.debug("PlayerProfileRepo", `Cache HIT for user profile: ${userId}`);
          const profile = JSON.parse(cached) as IPlayerProfile;
          
          // Rehidratar fechas
          profile.createdAt = new Date(profile.createdAt);
          if (profile.lastActive) {
            profile.lastActive = new Date(profile.lastActive);
          }
          return profile;
        }
      } catch (redisErr) {
        logger.warn("PlayerProfileRepo", `Redis read failed for user ${userId}. Falling back to DB.`, redisErr);
      }
    }

    logger.debug("PlayerProfileRepo", `Cache MISS for user profile: ${userId}. Fetching from DBs.`);

    // 2. Consultar base de datos operacional (User)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        createdAt: true,
      },
    });

    if (!user) {
      logger.warn("PlayerProfileRepo", `User not found in operational DB: ${userId}`);
      return null;
    }

    // 3. Consultar base de datos analítica (PlayerFeatures)
    const features = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId },
    });

    // 4. Consolidar el objeto unificado
    const profile: IPlayerProfile = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,

      lastActive: features?.lastActive ?? null,
      totalPlayTime: features?.totalPlayTime ?? null,
      matchesPlayed: features?.matchesPlayed ?? null,
      preferredLanguage: features?.preferredLanguage ?? null,
      explorerRatio: features?.explorerRatio ?? null,
      playerProfile: features?.playerProfile ?? null,
      popularitySensitivity: features?.popularitySensitivity ?? null,
      returnIntent: features?.returnIntent ?? null,
      scheduleProfile: features?.scheduleProfile ?? null,
    };

    // 5. Intentar escribir en el caché de Redis
    if (redis && redis.isOpen) {
      try {
        await redis.setEx(redisKey, this.TTL_SECONDS, JSON.stringify(profile));
        logger.debug("PlayerProfileRepo", `Cached user profile for ${userId} with TTL ${this.TTL_SECONDS}s.`);
      } catch (redisErr) {
        logger.warn("PlayerProfileRepo", `Failed to write profile to Redis cache for user ${userId}`, redisErr);
      }
    }

    return profile;
  }

  /**
   * Invalida de forma manual la entrada en caché de Redis para un usuario.
   */
  public static async clearCache(userId: string): Promise<void> {
    const redisKey = `${this.REDIS_PREFIX}${userId}`;
    const redis = getRedis();

    if (redis && redis.isOpen) {
      try {
        const deleted = await redis.del(redisKey);
        if (deleted > 0) {
          logger.info("PlayerProfileRepo", `Manually cleared Redis profile cache for user: ${userId}`);
        }
      } catch (redisErr) {
        logger.error("PlayerProfileRepo", `Failed to clear cache for user ${userId}`, redisErr);
      }
    }
  }
}

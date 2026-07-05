import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { getRedis } from "../../cache/redis.js";
import { logger } from "../../utils/Logger.js";

export interface IGameMapProfile {
  // Operational details (GameMap)
  id: string;
  slug: string;
  name: string;
  ownerId: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Analytical features (MapFeatures)
  totalJoins: number | null;
  totalLeaves: number | null;
  bounceCount: number | null;
  averageDuration: number | null; // in seconds
  bounceRate: number | null;

  // Aggregated analytics (new daily fields)
  medianPlaytime: number | null; // in seconds
  completionRate: number | null; // fraction
  retentionCurve: number[] | null; // array of fractions
  difficultyScore: number | null;
  difficultyLabel: string | null;
  paceScore: number | null;
  paceLabel: string | null;
  earlyAbandonRate: number | null;
  stickyFactor: number | null;
  viralityFactor: number | null;
}

export class MapProfileRepository {
  private static readonly REDIS_PREFIX = "analytics:map_profile:";
  private static readonly TTL_SECONDS = 3600; // 1 hour TTL for map profiles

  /**
   * Obtiene el perfil unificado del mapa (GameMap + MapFeatures).
   * Intenta consultar en caché de Redis primero. Si no está, consulta bases de datos
   * y guarda en caché. Tolera fallas de conexión de Redis.
   */
  public static async getMapProfile(mapId: string): Promise<IGameMapProfile | null> {
    const redisKey = `${this.REDIS_PREFIX}${mapId}`;
    const redis = getRedis();

    // 1. Intentar consultar caché de Redis
    if (redis && redis.isOpen) {
      try {
        const cached = await redis.get(redisKey);
        if (cached) {
          logger.debug("MapProfileRepo", `Cache HIT for map profile: ${mapId}`);
          const profile = JSON.parse(cached) as IGameMapProfile;

          // Rehidratar fechas
          profile.createdAt = new Date(profile.createdAt);
          profile.updatedAt = new Date(profile.updatedAt);
          return profile;
        }
      } catch (redisErr) {
        logger.warn("MapProfileRepo", `Redis read failed for map ${mapId}. Falling back to DB.`, redisErr);
      }
    }

    logger.debug("MapProfileRepo", `Cache MISS for map profile: ${mapId}. Fetching from DBs.`);

    // 2. Consultar base de datos operacional (GameMap)
    const map = await prisma.gameMap.findUnique({
      where: { id: mapId },
      select: {
        id: true,
        slug: true,
        name: true,
        ownerId: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!map) {
      logger.warn("MapProfileRepo", `Map not found in operational DB: ${mapId}`);
      return null;
    }

    // 3. Consultar base de datos analítica (MapFeatures)
    const features = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId },
    });

    // 4. Consolidar el objeto unificado
    let retentionArray: number[] | null = null;
    if (features?.retentionCurve) {
      try {
        if (typeof features.retentionCurve === "string") {
          retentionArray = JSON.parse(features.retentionCurve);
        } else if (Array.isArray(features.retentionCurve)) {
          retentionArray = features.retentionCurve as number[];
        }
      } catch (err) {
        logger.error("MapProfileRepo", `Failed to parse retentionCurve for map ${mapId}`, err);
      }
    }

    const profile: IGameMapProfile = {
      id: map.id,
      slug: map.slug,
      name: map.name,
      ownerId: map.ownerId,
      isPublished: map.isPublished,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,

      totalJoins: features?.totalJoins ?? null,
      totalLeaves: features?.totalLeaves ?? null,
      bounceCount: features?.bounceCount ?? null,
      averageDuration: features?.averageDuration ?? null,
      bounceRate: features?.bounceRate ?? null,

      medianPlaytime: features?.medianPlaytime ?? null,
      completionRate: features?.completionRate ?? null,
      retentionCurve: retentionArray,
      difficultyScore: features?.difficultyScore ?? null,
      difficultyLabel: features?.difficultyLabel ?? null,
      paceScore: features?.paceScore ?? null,
      paceLabel: features?.paceLabel ?? null,
      earlyAbandonRate: features?.earlyAbandonRate ?? null,
      stickyFactor: features?.stickyFactor ?? null,
      viralityFactor: features?.viralityFactor ?? null,
    };

    // 5. Intentar escribir en el caché de Redis
    if (redis && redis.isOpen) {
      try {
        await redis.setEx(redisKey, this.TTL_SECONDS, JSON.stringify(profile));
        logger.debug("MapProfileRepo", `Cached map profile for ${mapId} with TTL ${this.TTL_SECONDS}s.`);
      } catch (redisErr) {
        logger.warn("MapProfileRepo", `Failed to write map profile to Redis cache for map ${mapId}`, redisErr);
      }
    }

    return profile;
  }

  /**
   * Invalida de forma manual la entrada en caché de Redis para un mapa.
   */
  public static async clearCache(mapId: string): Promise<void> {
    const redisKey = `${this.REDIS_PREFIX}${mapId}`;
    const redis = getRedis();

    if (redis && redis.isOpen) {
      try {
        const deleted = await redis.del(redisKey);
        if (deleted > 0) {
          logger.info("MapProfileRepo", `Manually cleared Redis profile cache for map: ${mapId}`);
        }
      } catch (redisErr) {
        logger.error("MapProfileRepo", `Failed to clear cache for map ${mapId}`, redisErr);
      }
    }
  }
}

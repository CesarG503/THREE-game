import { prisma } from "../db/prisma.js";
import { analyticsPrisma } from "../db/analyticsPrisma.js";
import { mapInclude, toMapDto, type MapWithInclude } from "./MapService.js";
import { logger } from "../utils/Logger.js";

/**
 * Obtiene recomendaciones de mapas utilizando popularidad basal y decaimiento temporal (Cold-Start).
 * Fórmula: Score = S_m / (T_m + 2)^G + 5% Jitter
 */
export async function getPopularityRecommendations(options: { limit?: number; gravity?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 10));
  const gravity = options.gravity ?? 1.8;

  try {
    // 1. Obtener mapas publicados de la base de datos operacional
    const maps = await prisma.gameMap.findMany({
      where: { isPublished: true },
      include: mapInclude,
    });

    if (maps.length === 0) {
      return [];
    }

    // 2. Intentar consultar MapFeatures de la DB analítica
    let mapFeaturesMap = new Map<string, any>();
    let analyticsFailed = false;

    try {
      const mapIds = maps.map((m) => m.id);
      const features = await analyticsPrisma.mapFeatures.findMany({
        where: { mapId: { in: mapIds } },
      });
      for (const f of features) {
        mapFeaturesMap.set(f.mapId, f);
      }
    } catch (dbErr) {
      logger.warn(
        "RecommendationService",
        "Analytics DB query failed. Falling back to operational matches statistics.",
        dbErr
      );
      analyticsFailed = true;
    }

    // 3. Fallback si falló la analítica o no hay características
    if (analyticsFailed || mapFeaturesMap.size === 0) {
      return runFallbackRecommendation(maps, limit, gravity);
    }

    // 4. Calcular score con totalJoins de analítica y decaimiento temporal
    const scoredMaps = maps.map((map) => {
      const feature = mapFeaturesMap.get(map.id);
      const joins = feature?.totalJoins ?? 0;

      const ageInDays = Math.max(
        0,
        (Date.now() - new Date(map.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      const baseScore = joins / Math.pow(ageInDays + 2, gravity);
      const jitter = 0.95 + Math.random() * 0.1; // 5% jitter (+/- 5%)
      const score = baseScore * jitter;

      return { map, score };
    });

    scoredMaps.sort((a, b) => b.score - a.score);

    return scoredMaps.slice(0, limit).map((item) => toMapDto(item.map, false));
  } catch (err) {
    logger.error("RecommendationService", "Failed to calculate popularity recommendations", err);
    throw err;
  }
}

/**
 * Fallback utilizando la cantidad acumulada de partidas del mapa en DB operacional.
 */
function runFallbackRecommendation(maps: MapWithInclude[], limit: number, gravity: number) {
  const scoredMaps = maps.map((map) => {
    const matchesCount = map._count?.matches ?? 0;

    const ageInDays = Math.max(
      0,
      (Date.now() - new Date(map.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const baseScore = matchesCount / Math.pow(ageInDays + 2, gravity);
    const jitter = 0.95 + Math.random() * 0.1;
    const score = baseScore * jitter;

    return { map, score };
  });

  scoredMaps.sort((a, b) => b.score - a.score);

  return scoredMaps.slice(0, limit).map((item) => toMapDto(item.map, false));
}

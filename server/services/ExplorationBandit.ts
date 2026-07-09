import { prisma } from "../db/prisma.js";
import { analyticsPrisma } from "../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../analytics/models/PlayerProfile.js";
import { getPopularityRecommendations } from "./RecommendationService.js";
import { getCollaborativeRecommendations } from "./CollaborativeRecommender.js";
import { logger } from "../utils/Logger.js";

// Helper for standard normal sampling (Box-Muller)
function sampleNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Marsaglia and Tsang method for Gamma distribution sampling
export function sampleGamma(shape: number, scale: number = 1): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const x = sampleNormal();
    const v = 1 + c * x;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v3 * scale;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v3 + Math.log(v3))) {
      return d * v3 * scale;
    }
  }
}

// Beta distribution sampling
export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  if (x + y === 0) return 0;
  return x / (x + y);
}

interface CtrCacheEntry {
  stats: Map<string, { clicks: number; impressions: number }>;
  fetchedAt: number;
}

const CTR_CACHE = new Map<string, CtrCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Recupera el conteo de impresiones y clics agrupados por mapa para un cluster o de manera global.
 * Cacheado en memoria por 5 minutos para evitar sobrecargar PostgreSQL analítico.
 */
export async function getClusterCtrStats(clusterId: string | null): Promise<Map<string, { clicks: number; impressions: number }>> {
  const cacheKey = clusterId ?? "global";
  const cached = CTR_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.stats;
  }

  const statsMap = new Map<string, { clicks: number; impressions: number }>();
  try {
    let rawEvents: { mapId: string; type: string }[] = [];
    if (clusterId) {
      const sql = `
        SELECT 
          payload->>'mapId' as "mapId",
          "eventType" as "type"
        FROM analytics."RawEvent"
        WHERE "eventType" IN ('UiImpression', 'UiClick')
          AND payload->>'mapId' IS NOT NULL
          AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
          AND "userId" IN (
            SELECT "userId" FROM analytics."PlayerFeatures" WHERE "clusterId" = $1
          )
      `;
      const rows = await analyticsPrisma.$queryRawUnsafe<{ mapId: string; type: string }[]>(sql, clusterId);
      rawEvents = rows;
    } else {
      const sql = `
        SELECT 
          payload->>'mapId' as "mapId",
          "eventType" as "type"
        FROM analytics."RawEvent"
        WHERE "eventType" IN ('UiImpression', 'UiClick')
          AND payload->>'mapId' IS NOT NULL
          AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      `;
      const rows = await analyticsPrisma.$queryRawUnsafe<{ mapId: string; type: string }[]>(sql);
      rawEvents = rows;
    }

    for (const event of rawEvents) {
      if (!event.mapId) continue;
      if (!statsMap.has(event.mapId)) {
        statsMap.set(event.mapId, { clicks: 0, impressions: 0 });
      }
      const entry = statsMap.get(event.mapId)!;
      if (event.type === "UiClick") {
        entry.clicks++;
      } else if (event.type === "UiImpression") {
        entry.impressions++;
      }
    }

    CTR_CACHE.set(cacheKey, { stats: statsMap, fetchedAt: now });
  } catch (err) {
    logger.error("ExplorationBandit", `Failed to query CTR stats for cluster ${clusterId}`, err);
  }

  return statsMap;
}

export interface BanditRecommendation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  recommendationType: "EXPLORATION" | "EXPLOITATION" | "THOMPSON";
  epsilonUsed?: number;
  thompsonScore?: number;
}

/**
 * Limpia y purga el caché de CTR. Útil para tests de integración.
 */
export function clearCtrCache(): void {
  CTR_CACHE.clear();
}

/**
 * Obtiene recomendaciones balanceando exploración y explotación mediante bandidos multibrazo.
 */
export async function getBanditRecommendations(
  userId: string | null,
  options?: { limit?: number; mode?: "epsilon-greedy" | "thompson" }
): Promise<BanditRecommendation[]> {
  const limit = options?.limit ?? 10;
  const mode = options?.mode ?? "epsilon-greedy";

  // 1. Obtener mapas con fatiga activa del usuario para excluirlos
  let fatiguedMapIds = new Set<string>();
  if (userId) {
    try {
      const fatigued = await analyticsPrisma.fatiguedMap.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        select: { mapId: true },
      });
      fatiguedMapIds = new Set(fatigued.map((f) => f.mapId));
    } catch (err) {
      logger.error("ExplorationBandit", `Failed to fetch fatigued maps for user ${userId}`, err);
    }
  }

  if (mode === "epsilon-greedy") {
    // 2. Determinar Epsilon según el explorerRatio del jugador
    let explorerRatio = null;
    if (userId) {
      const profile = await PlayerProfileRepository.getProfile(userId);
      if (profile && profile.explorerRatio !== null) {
        explorerRatio = profile.explorerRatio;
      }
    }

    let epsilon = 0.15; // default fallback value
    if (explorerRatio !== null) {
      epsilon = 0.05 + 0.15 * explorerRatio;
      epsilon = Math.max(0.05, Math.min(0.20, epsilon)); // asegurar cotas [0.05, 0.20]
    }

    // 3. Decidir: ¿Exploración o Explotación?
    const isExploration = Math.random() < epsilon;

    if (isExploration) {
      logger.debug("ExplorationBandit", `Epsilon-Greedy [EXPLORATION] triggered for user ${userId} (epsilon: ${epsilon.toFixed(3)})`);
      // Obtener mapas populares (alto potencial)
      const popularMaps = await getPopularityRecommendations({ limit: 30 });
      const filtered = popularMaps
        .filter((m) => !fatiguedMapIds.has(m.id))
        .map((m) => ({
          id: m.id,
          slug: m.slug,
          name: m.name,
          description: m.description,
          recommendationType: "EXPLORATION" as const,
          epsilonUsed: epsilon,
        }));
      
      // Shuffle para explorar alternativas aleatorias de forma equitativa
      return filtered.sort(() => Math.random() - 0.5).slice(0, limit);
    } else {
      logger.debug("ExplorationBandit", `Epsilon-Greedy [EXPLOITATION] triggered for user ${userId} (epsilon: ${epsilon.toFixed(3)})`);
      // Explotar recomendaciones personalizadas (colaborativo)
      // Usamos limit de 100 candidatos para filtrar y recortar
      const recs = await getCollaborativeRecommendations(userId, { limit: 100 });
      const filtered = recs
        .filter((m) => !fatiguedMapIds.has(m.id))
        .slice(0, limit)
        .map((m) => ({
          id: m.id,
          slug: m.slug,
          name: m.name,
          description: m.description,
          recommendationType: "EXPLOITATION" as const,
          epsilonUsed: epsilon,
        }));
      return filtered;
    }
  } else {
    // Modo Thompson Sampling
    logger.debug("ExplorationBandit", `Thompson Sampling triggered for user ${userId}`);
    
    // Obtener cluster ID del usuario
    let clusterId: string | null = null;
    if (userId) {
      const profile = await PlayerProfileRepository.getProfile(userId);
      if (profile && profile.clusterId) {
        clusterId = profile.clusterId;
      }
    }

    // Obtener estadísticas de CTR del clúster (o globales)
    const ctrStats = await getClusterCtrStats(clusterId);

    // Obtener todos los mapas publicados
    const publishedMaps = await prisma.gameMap.findMany({
      where: {
        isPublished: true,
        id: { notIn: Array.from(fatiguedMapIds) },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    });

    const recommendations = publishedMaps.map((map) => {
      const stats = ctrStats.get(map.id);
      
      // Prior bayesiano: si no hay estadísticas, asumimos un CTR del 5%
      // Beta(1, 19) => media = 1 / (1 + 19) = 5%
      let alpha = 1;
      let beta = 19;

      if (stats && stats.impressions > 0) {
        alpha += stats.clicks;
        beta += (stats.impressions - stats.clicks);
      }

      // Muestrear de la distribución Beta
      const score = sampleBeta(alpha, beta);

      return {
        id: map.id,
        slug: map.slug,
        name: map.name,
        description: map.description,
        recommendationType: "THOMPSON" as const,
        thompsonScore: score,
      };
    });

    // Ordenar descendente por el score muestreado y limitar
    return recommendations.sort((a, b) => b.thompsonScore - a.thompsonScore).slice(0, limit);
  }
}

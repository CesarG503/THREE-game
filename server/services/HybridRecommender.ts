import { getPopularityRecommendations } from "./RecommendationService.js";
import { getContentRecommendations } from "./ContentRecommender.js";
import { getCollaborativeRecommendations } from "./CollaborativeRecommender.js";
import { getSocialRecommendations } from "./SocialRecommender.js";
import { PlayerProfileRepository } from "../analytics/models/PlayerProfile.js";
import { logger } from "../utils/Logger.js";

/**
 * Mide el tiempo de ejecución de una promesa para fines de monitoreo.
 */
async function measureTime<T>(name: string, promise: Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const res = await promise;
    logger.info("HybridRecommender", `Sub-recommender ${name} resolved in ${Date.now() - start}ms`);
    return res;
  } catch (err) {
    logger.error("HybridRecommender", `Sub-recommender ${name} failed after ${Date.now() - start}ms`, err);
    throw err;
  }
}

/**
 * Envuelve una promesa en un timeout de resolución. Si expira, retorna el fallback.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      logger.warn("HybridRecommender", `Sub-recommender timed out after ${timeoutMs}ms. Using empty fallback.`);
      resolve(fallback);
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

export interface HybridRecommendation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  score: number;
  friendsPlaying?: { userId: string; username: string }[];
  [key: string]: any;
}

interface CacheEntry {
  promise: Promise<HybridRecommendation[]>;
  expiresAt: number;
}

const hybridCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000; // 5 segundos de TTL para mitigar picos de concurrencia

export function clearHybridCache(): void {
  hybridCache.clear();
}

/**
 * Meta-recomendador híbrido ponderado dinámicamente según el perfil de madurez del usuario.
 * Fórmula: Score = w1 * S_popular + w2 * S_content + w3 * S_collab + w4 * S_social
 */
export function getHybridRecommendations(
  userId: string | null,
  options?: { limit?: number }
): Promise<HybridRecommendation[]> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 10));

  // Intentar resolver desde caché de promesas (Request Coalescing / Singleflight)
  const cacheKey = userId ? `user:${userId}:${limit}` : `anon:${limit}`;
  const now = Date.now();
  const cached = hybridCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    logger.debug("HybridRecommender", `Cache HIT (coalesced promise) para clave: ${cacheKey}`);
    return cached.promise;
  }

  // Generamos la promesa de cálculo y la cacheamos inmediatamente
  const promise = (async () => {
    // 1. Determinar pesos dinámicos según matchesPlayed
    let w_pop = 1.0;
    let w_cont = 0.0;
    let w_coll = 0.0;
    let w_soc = 0.0;

    if (userId) {
      try {
        const profile = await PlayerProfileRepository.getProfile(userId);
        const matches = profile?.matchesPlayed ?? 0;
        const atRisk = profile?.atRisk === true || (profile?.churnScore !== null && profile?.churnScore !== undefined && profile.churnScore >= 0.85);

        if (atRisk) {
          // Usuario en riesgo de Churn: Boostear drásticamente afinidad social para engancharlo
          w_pop = 0.0;
          w_cont = 0.1;
          w_coll = 0.1;
          w_soc = 0.8;
          logger.info(
            "HybridRecommender",
            `User ${userId} is at RISK of churn! Overriding weights: w_pop=${w_pop}, w_cont=${w_cont}, w_coll=${w_coll}, w_soc=${w_soc}`
          );
        } else if (matches < 3) {
          // Usuario Nuevo: Poca o nula afinidad colaborativa/social. Priorizar popularidad y contenido.
          w_pop = 0.5;
          w_cont = 0.4;
          w_coll = 0.0;
          w_soc = 0.1;
        } else if (matches < 15) {
          // Usuario Medio: Combinar balanceadamente los cuatro factores.
          w_pop = 0.2;
          w_cont = 0.3;
          w_coll = 0.3;
          w_soc = 0.2;
        } else {
          // Usuario Veterano: Priorizar filtrado colaborativo SVD y amigos activos.
          w_pop = 0.05;
          w_cont = 0.15;
          w_coll = 0.5;
          w_soc = 0.3;
        }

        logger.info(
          "HybridRecommender",
          `Resolved weights for user ${userId} (matches: ${matches}): w_pop=${w_pop}, w_cont=${w_cont}, w_coll=${w_coll}, w_soc=${w_soc}`
        );
      } catch (err) {
        logger.warn("HybridRecommender", `Failed to resolve weights for user ${userId}. Using defaults.`, err);
        // Fallback a pesos balanceados por defecto
        w_pop = 0.3;
        w_cont = 0.3;
        w_coll = 0.2;
        w_soc = 0.2;
      }
    } else {
      logger.info("HybridRecommender", "Anonymous user. Using pure popularity recommendations (w_pop=1.0).");
    }

    // 2. Ejecutar los sub-recomendadores en paralelo con timeouts estrictos de 150ms
    const TIMEOUT_MS = 150;
    const [popularity, content, collaborative, social] = await Promise.all([
      withTimeout(measureTime("Popularity", getPopularityRecommendations({ limit: 100 })), TIMEOUT_MS, []),
      withTimeout(measureTime("Content", getContentRecommendations(userId, { limit: 100 })), TIMEOUT_MS, []),
      withTimeout(measureTime("Collaborative", getCollaborativeRecommendations(userId, { limit: 100 })), TIMEOUT_MS, []),
      withTimeout(measureTime("Social", getSocialRecommendations(userId, { limit: 100 })), TIMEOUT_MS, []),
    ]);

    // 3. Consolidar mapa único de candidatos por ID
    const mapMap = new Map<string, any>();
    for (const item of popularity) {
      if (item && item.id) mapMap.set(item.id, item);
    }
    for (const item of content) {
      if (item && item.id) mapMap.set(item.id, item);
    }
    for (const item of collaborative) {
      if (item && item.id) mapMap.set(item.id, item);
    }
    for (const item of social) {
      if (item && item.id) mapMap.set(item.id, item);
    }

    // 4. Calcular el score ponderado lineal
    const scoredCandidates: HybridRecommendation[] = Array.from(mapMap.values()).map((map) => {
      const popIdx = popularity.findIndex((m) => m.id === map.id);
      const contentIdx = content.findIndex((m) => m.id === map.id);
      const collIdx = collaborative.findIndex((m) => m.id === map.id);
      const socIdx = social.findIndex((m) => m.id === map.id);

      // Score rank-based: 1.0 - (index / L)
      const s_pop = popIdx !== -1 ? 1.0 - popIdx / popularity.length : 0.0;
      const s_cont = contentIdx !== -1 ? 1.0 - contentIdx / content.length : 0.0;
      const s_coll = collIdx !== -1 ? 1.0 - collIdx / collaborative.length : 0.0;
      const s_soc = socIdx !== -1 ? 1.0 - socIdx / social.length : 0.0;

      const finalScore = w_pop * s_pop + w_cont * s_cont + w_coll * s_coll + w_soc * s_soc;

      // Recuperar metadatos de amigos activos si están presentes en la recomendación social original
      const socItem = social.find((m) => m.id === map.id);
      const friendsPlaying = socItem && "friendsPlaying" in socItem ? (socItem as any).friendsPlaying : [];

      return {
        ...map,
        score: finalScore,
        friendsPlaying,
      };
    });

    // 5. Ordenar de mayor a menor score y truncar al límite
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates.slice(0, limit);
  })();

  hybridCache.set(cacheKey, {
    promise,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return promise;
}

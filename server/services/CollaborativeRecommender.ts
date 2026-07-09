import { prisma } from "../db/prisma.js";
import { mapInclude, toMapDto } from "./MapService.js";
import { getPopularityRecommendations } from "./RecommendationService.js";
import { logger } from "../utils/Logger.js";

/**
 * Calcula la similitud Jaccard entre dos conjuntos de strings.
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0.0;

  return intersectionSize / unionSize;
}

/**
 * Recomendador colaborativo basado en Factorización Matricial (Funk SVD).
 * Calcula la afinidad latente como el producto punto entre el embedding del usuario y del mapa.
 * Cae al recomendador por popularidad si no hay suficientes datos (Cold Start) o ante errores.
 */
export async function getCollaborativeRecommendations(
  userId: string | null,
  options: { limit?: number; gravity?: number } = {}
) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 10));

  if (!userId) {
    logger.info("CollaborativeRecommender", "Anonymous user requested recommendations. Falling back to popularity-based.");
    return getPopularityRecommendations(options);
  }

  try {
    // 1. Obtener perfil del usuario y su embedding colaborativo
    const { PlayerProfileRepository } = await import("../analytics/models/PlayerProfile.js");
    const userProfile = await PlayerProfileRepository.getProfile(userId);

    if (!userProfile || !userProfile.collaborativeEmbedding || userProfile.collaborativeEmbedding.length === 0) {
      logger.info(
        "CollaborativeRecommender",
        `Target user ${userId} has no collaborative embedding (Cold Start). Falling back to popularity-based.`
      );
      return getPopularityRecommendations(options);
    }

    const p_u = userProfile.collaborativeEmbedding;

    // 2. Obtener todas las partidas del usuario para excluir mapas ya completados
    const completedMatchPlayers = await prisma.matchPlayer.findMany({
      where: {
        userId: userId,
        match: {
          OR: [
            { status: "FINISHED" },
            { endedAt: { not: null } },
          ],
        },
      },
      select: {
        match: {
          select: {
            mapId: true,
          },
        },
      },
    });

    const completedMapIds = new Set<string>();
    for (const mp of completedMatchPlayers) {
      if (mp.match.mapId) {
        completedMapIds.add(mp.match.mapId);
      }
    }

    // 3. Obtener todos los mapas publicados
    const publishedMaps = await prisma.gameMap.findMany({
      where: {
        isPublished: true,
      },
      include: mapInclude,
    });

    // Filtrar mapas ya completados
    const candidateMaps = publishedMaps.filter((map) => !completedMapIds.has(map.id));

    if (candidateMaps.length === 0) {
      logger.info(
        "CollaborativeRecommender",
        `No new candidate maps available for user ${userId}. Falling back to popularity-based.`
      );
      return getPopularityRecommendations(options);
    }

    // 4. Consultar los embeddings de los mapas candidatos en una sola consulta
    const { analyticsPrisma } = await import("../db/analyticsPrisma.js");
    const mapFeatures = await analyticsPrisma.mapFeatures.findMany({
      where: {
        mapId: { in: candidateMaps.map((m) => m.id) },
      },
      select: {
        mapId: true,
        collaborativeEmbedding: true,
      },
    });

    const mapEmbeddingMap = new Map<string, number[]>();
    for (const mf of mapFeatures) {
      if (Array.isArray(mf.collaborativeEmbedding)) {
        mapEmbeddingMap.set(mf.mapId, mf.collaborativeEmbedding as number[]);
      }
    }

    // 5. Calcular producto punto (score de afinidad latente) para cada mapa candidato
    const scoredMaps: { map: any; score: number }[] = [];
    for (const map of candidateMaps) {
      const q_m = mapEmbeddingMap.get(map.id);
      if (!q_m || q_m.length !== p_u.length) {
        continue; // Ignorar si el mapa no tiene embedding o la dimensión no coincide
      }

      let dot = 0.0;
      for (let f = 0; f < p_u.length; f++) {
        dot += (p_u[f] ?? 0.0) * (q_m[f] ?? 0.0);
      }

      scoredMaps.push({ map, score: dot });
    }

    if (scoredMaps.length === 0) {
      logger.info(
        "CollaborativeRecommender",
        `No candidates with valid embeddings for user ${userId}. Falling back to popularity-based.`
      );
      return getPopularityRecommendations(options);
    }

    // 6. Ordenar por puntuación descendente y retornar top K
    scoredMaps.sort((a, b) => b.score - a.score);

    return scoredMaps.slice(0, limit).map((item) => toMapDto(item.map, false));
  } catch (err) {
    logger.error("CollaborativeRecommender", "Error during SVD collaborative recommendation. Falling back to popularity.", err);
    return getPopularityRecommendations(options);
  }
}


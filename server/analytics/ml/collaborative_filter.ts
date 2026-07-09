import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { MapProfileRepository } from "../models/MapProfile.js";
import { logger } from "../../utils/Logger.js";

export interface SVDInteraction {
  userId: string;
  mapId: string;
  rating: number; // 1 to 5 based on completions
}

export interface SVDEmbeddings {
  userEmbeddings: Map<string, number[]>;
  mapEmbeddings: Map<string, number[]>;
  userBiases: Map<string, number>;
  mapBiases: Map<string, number>;
  globalMean: number;
}

export interface PipelineResult {
  numUsers: number;
  numMaps: number;
  rmse: number;
}

/**
 * Entrena el modelo Funk SVD utilizando Stochastic Gradient Descent (SGD).
 */
export function trainSVD(
  interactions: SVDInteraction[],
  options: {
    factors?: number;
    epochs?: number;
    lr?: number;
    reg?: number;
  } = {}
): SVDEmbeddings {
  const factors = options.factors ?? 8;
  const epochs = options.epochs ?? 100;
  const lr = options.lr ?? 0.005;
  const reg = options.reg ?? 0.02;

  // 1. Obtener listas únicas de usuarios y mapas
  const userList = Array.from(new Set(interactions.map((i) => i.userId)));
  const mapList = Array.from(new Set(interactions.map((i) => i.mapId)));

  // 2. Inicializar embeddings con valores positivos pequeños para romper simetría
  const userEmbeddings = new Map<string, number[]>();
  for (const u of userList) {
    const vec = Array.from({ length: factors }, () => Math.random() * 0.4 + 0.3);
    userEmbeddings.set(u, vec);
  }

  const mapEmbeddings = new Map<string, number[]>();
  for (const m of mapList) {
    const vec = Array.from({ length: factors }, () => Math.random() * 0.4 + 0.3);
    mapEmbeddings.set(m, vec);
  }

  // 3. Stochastic Gradient Descent (SGD)
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Mezclar interacciones
    const shuffled = [...interactions].sort(() => Math.random() - 0.5);

    for (const inter of shuffled) {
      const u = inter.userId;
      const m = inter.mapId;
      const rating = inter.rating;

      const p_u = userEmbeddings.get(u)!;
      const q_m = mapEmbeddings.get(m)!;

      // Calcular predicción como el producto punto directo
      let pred = 0;
      for (let f = 0; f < factors; f++) {
        pred += p_u[f]! * q_m[f]!;
      }
      const err = rating - pred;

      // Actualizar vectores latentes (embeddings)
      for (let f = 0; f < factors; f++) {
        const p_uf = p_u[f]!;
        const q_mf = q_m[f]!;

        p_u[f] = p_uf + lr * (err * q_mf - reg * p_uf);
        q_m[f] = q_mf + lr * (err * p_uf - reg * q_mf);
      }
    }
  }

  // Retornar mapas vacíos de biases por compatibilidad de tipos
  return {
    userEmbeddings,
    mapEmbeddings,
    userBiases: new Map(),
    mapBiases: new Map(),
    globalMean: 0,
  };
}

/**
 * Pipeline offline para extraer interacciones de partidas completadas,
 * ejecutar Funk SVD y persistir los embeddings en Postgres y Redis.
 */
export async function runCollaborativePipeline(options?: {
  factors?: number;
  epochs?: number;
  lr?: number;
  reg?: number;
}): Promise<PipelineResult> {
  logger.info("CollaborativePipeline", "Starting collaborative filtering matrix factorization...");

  // 1. Obtener mapas publicados
  const publishedMaps = await prisma.gameMap.findMany({
    where: { isPublished: true },
    select: { id: true },
  });
  const publishedMapIds = new Set(publishedMaps.map((m) => m.id));

  if (publishedMapIds.size === 0) {
    logger.warn("CollaborativePipeline", "No published maps found. Skipping SVD training.");
    return { numUsers: 0, numMaps: 0, rmse: 0 };
  }

  // 2. Obtener todas las partidas de la base operativa
  const completedMatchPlayers = await prisma.matchPlayer.findMany({
    where: {
      match: {
        OR: [
          { status: "FINISHED" },
          { endedAt: { not: null } },
        ],
      },
    },
    include: {
      match: true,
    },
  });

  // 3. Contabilizar completaciones por usuario y mapa
  const interactionCounts = new Map<string, number>(); // key: "userId:mapId"
  for (const mp of completedMatchPlayers) {
    if (!mp.userId || !mp.match.mapId) continue;
    if (!publishedMapIds.has(mp.match.mapId)) continue;

    // Calcular si la partida fue completada
    const joinedTime = new Date(mp.joinedAt).getTime();
    const endedTime = mp.match.endedAt ? new Date(mp.match.endedAt).getTime() : joinedTime;
    const leftTime = mp.leftAt ? new Date(mp.leftAt).getTime() : endedTime;
    const didComplete = mp.leftAt === null || leftTime >= endedTime - 2000;

    if (didComplete) {
      const key = `${mp.userId}:${mp.match.mapId}`;
      interactionCounts.set(key, (interactionCounts.get(key) ?? 0) + 1);
    }
  }

  // 4. Mapear counts a SVDInteraction (rating en escala 1-5)
  const interactions: SVDInteraction[] = [];
  for (const [key, count] of interactionCounts.entries()) {
    const [userId, mapId] = key.split(":");
    if (userId && mapId) {
      interactions.push({
        userId,
        mapId,
        rating: Math.min(5, count), // rating tope en 5
      });
    }
  }

  if (interactions.length === 0) {
    logger.warn("CollaborativePipeline", "No completed map interactions found. Skipping SVD training.");
    return { numUsers: 0, numMaps: 0, rmse: 0 };
  }

  // 5. Entrenar el modelo SVD
  const results = trainSVD(interactions, options);
  const { userEmbeddings, mapEmbeddings, userBiases, mapBiases, globalMean } = results;

  // 6. Calcular RMSE de entrenamiento
  let totalErrorSq = 0;
  const factors = options?.factors ?? 8;
  for (const inter of interactions) {
    const u = inter.userId;
    const m = inter.mapId;
    const rating = inter.rating;

    const p_u = userEmbeddings.get(u)!;
    const q_m = mapEmbeddings.get(m)!;

    let dot = 0;
    for (let f = 0; f < factors; f++) {
      dot += p_u[f]! * q_m[f]!;
    }
    const pred = dot;
    const err = rating - pred;
    totalErrorSq += err * err;
  }
  const rmse = Math.sqrt(totalErrorSq / interactions.length);

  logger.info(
    "CollaborativePipeline",
    `SVD training complete. Users: ${userEmbeddings.size}, Maps: ${mapEmbeddings.size}, Train RMSE: ${rmse.toFixed(4)}`
  );

  // 7. Persistir embeddings de usuario en DB y limpiar caché Redis
  logger.info("CollaborativePipeline", "Persisting user embeddings...");
  for (const [userId, embedding] of userEmbeddings.entries()) {
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: new Date(),
        collaborativeEmbedding: embedding,
      },
      update: {
        collaborativeEmbedding: embedding,
      },
    });
    await PlayerProfileRepository.clearCache(userId);
  }

  // 8. Persistir embeddings de mapa en DB y limpiar caché Redis
  logger.info("CollaborativePipeline", "Persisting map embeddings...");
  for (const [mapId, embedding] of mapEmbeddings.entries()) {
    await analyticsPrisma.mapFeatures.upsert({
      where: { mapId },
      create: {
        mapId,
        collaborativeEmbedding: embedding,
      },
      update: {
        collaborativeEmbedding: embedding,
      },
    });
    await MapProfileRepository.clearCache(mapId);
  }

  logger.info("CollaborativePipeline", "SVD pipeline completed successfully.");
  return {
    numUsers: userEmbeddings.size,
    numMaps: mapEmbeddings.size,
    rmse,
  };
}

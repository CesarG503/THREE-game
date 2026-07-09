import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";

export interface ArchetypeWeights {
  Constructor: number;
  Social: number;
  Competitivo: number;
}

/**
 * Calcula y actualiza el arquetipo de jugador (Social, Competitivo, Constructor) para un usuario.
 */
export async function computePlayerArchetype(userId: string): Promise<string | null> {
  logger.info("PlayerArchetypes", `Computing player archetypes for user: ${userId}`);

  try {
    // 1. Obtener la duración en el editor (Fase 30/35) en los últimos 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const editorSessions = await analyticsPrisma.rawEvent.findMany({
      where: {
        userId,
        eventType: "EditorSession",
        timestamp: { gte: thirtyDaysAgo },
      },
    });

    let editorTimeSeconds = 0;
    for (const session of editorSessions) {
      const payload = session.payload as any;
      if (payload?.action === "close" && typeof payload?.durationSeconds === "number") {
        editorTimeSeconds += payload.durationSeconds;
      }
    }

    // 2. Obtener la duración de juego en los últimos 30 días (SessionEnd)
    const gameplaySessions = await analyticsPrisma.rawEvent.findMany({
      where: {
        userId,
        eventType: "SessionEnd",
        timestamp: { gte: thirtyDaysAgo },
      },
    });

    let gameplayTimeSeconds = 0;
    for (const session of gameplaySessions) {
      const payload = session.payload as any;
      if (typeof payload?.durationSeconds === "number") {
        gameplayTimeSeconds += payload.durationSeconds;
      }
    }

    // Fallback: usar totalPlayTime de PlayerFeatures si no hay eventos SessionEnd
    const playerFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId },
      select: { totalPlayTime: true },
    });

    if (gameplayTimeSeconds === 0 && playerFeatures?.totalPlayTime) {
      gameplayTimeSeconds = playerFeatures.totalPlayTime;
    }

    const totalTime = gameplayTimeSeconds + editorTimeSeconds;
    const scoreConstructor = totalTime > 0 ? editorTimeSeconds / totalTime : 0.0;

    // 3. Obtener afinidad social acumulada (Fase 2)
    const affinities = await analyticsPrisma.socialAffinity.findMany({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId },
        ],
      },
    });

    const totalSocialAffinity = affinities.reduce((sum, record) => sum + record.affinity, 0);
    // Normalizar afinidad social sobre un umbral de 600 segundos (10 minutos de juego cooperativo)
    const scoreSocial = Math.min(1.0, totalSocialAffinity / 600);

    // 4. Obtener tiempo completando mapas difíciles (Fase 35)
    // Buscamos todas las participaciones en MatchPlayer de la base de datos operacional
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId },
      include: {
        match: true,
      },
    });

    const mapIds = Array.from(new Set(matchPlayers.map((mp) => mp.match.mapId).filter(Boolean))) as string[];
    
    // Obtener los mapas que son difíciles o brutales (difficultyScore >= 0.60)
    const difficultMaps = await analyticsPrisma.mapFeatures.findMany({
      where: {
        mapId: { in: mapIds },
        difficultyScore: { gte: 0.60 },
      },
      select: { mapId: true },
    });

    const difficultMapIds = new Set(difficultMaps.map((m) => m.mapId));

    let completedDifficultPlaytime = 0;
    for (const mp of matchPlayers) {
      const match = mp.match;
      if (!match.mapId || !difficultMapIds.has(match.mapId)) continue;

      // Un match se considera completado si terminó y el jugador no salió antes de tiempo (o salió justo al final)
      const isCompleted = match.status === "FINISHED" || match.endedAt !== null;
      if (!isCompleted) continue;

      const joinedTime = new Date(mp.joinedAt).getTime();
      const endedTime = match.endedAt ? new Date(match.endedAt).getTime() : joinedTime;
      const leftTime = mp.leftAt ? new Date(mp.leftAt).getTime() : endedTime;

      // Stayed until within 2 seconds of the end
      const didComplete = mp.leftAt === null || leftTime >= endedTime - 2000;
      if (didComplete) {
        completedDifficultPlaytime += Math.max(0, (endedTime - joinedTime) / 1000);
      }
    }

    // Normalizar sobre un umbral de 1200 segundos (20 minutos)
    const scoreCompetitivo = Math.min(1.0, completedDifficultPlaytime / 1200);

    // 5. Normalizar pesos a que sumen 1.0
    const sumRaw = scoreConstructor + scoreSocial + scoreCompetitivo;
    let weights: ArchetypeWeights = {
      Constructor: 0.0,
      Social: 0.0,
      Competitivo: 0.0,
    };

    if (sumRaw > 0) {
      weights = {
        Constructor: Math.round((scoreConstructor / sumRaw) * 1000) / 1000,
        Social: Math.round((scoreSocial / sumRaw) * 1000) / 1000,
        Competitivo: Math.round((scoreCompetitivo / sumRaw) * 1000) / 1000,
      };
    }

    // Identificar arquetipo principal
    let primaryArchetype: string | null = null;
    let maxWeight = 0.0;
    for (const [key, val] of Object.entries(weights)) {
      if (val > maxWeight) {
        maxWeight = val;
        primaryArchetype = key;
      }
    }

    logger.debug(
      "PlayerArchetypes",
      `User ${userId} - Raw: [Const: ${scoreConstructor.toFixed(3)}, Soc: ${scoreSocial.toFixed(3)}, Comp: ${scoreCompetitivo.toFixed(3)}], ` +
      `Normalized: [Const: ${weights.Constructor}, Soc: ${weights.Social}, Comp: ${weights.Competitivo}] -> Archetype: ${primaryArchetype}`
    );

    // 6. Actualizar base de datos analítica (PlayerFeatures)
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: new Date(),
        playerProfile: primaryArchetype,
        archetypeWeights: weights as any,
      },
      update: {
        playerProfile: primaryArchetype,
        archetypeWeights: weights as any,
        lastActive: new Date(),
      },
    });

    // 7. Invalidar el caché en Redis
    await PlayerProfileRepository.clearCache(userId);

    return primaryArchetype;
  } catch (err) {
    logger.error("PlayerArchetypes", `Failed to compute player archetypes for user ${userId}`, err);
    throw err;
  }
}

/**
 * Revalúa los arquetipos para todos los usuarios registrados.
 */
export async function revaluateAllPlayerArchetypes(): Promise<number> {
  logger.info("PlayerArchetypes", "Starting batch revaluation for all player archetypes...");

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let count = 0;
  for (const u of users) {
    try {
      await computePlayerArchetype(u.id);
      count++;
    } catch (err) {
      logger.error("PlayerArchetypes", `Failed to evaluate archetypes for user ${u.id}`, err);
    }
  }

  logger.info("PlayerArchetypes", `Batch player archetypes revaluation finished. Processed ${count} users.`);
  return count;
}

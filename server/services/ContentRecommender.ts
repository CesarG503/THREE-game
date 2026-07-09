import { prisma } from "../db/prisma.js";
import { analyticsPrisma } from "../db/analyticsPrisma.js";
import { mapInclude, toMapDto } from "./MapService.js";
import { logger } from "../utils/Logger.js";

/**
 * Representa un mapa como un vector de características.
 * Vector: [sandbox, shooter, puzzle, difficultyScore]
 */
export function getMapVector(map: { name: string; description: string | null }, difficultyScore: number): number[] {
  const text = `${map.name} ${map.description ?? ""}`.toLowerCase();
  
  let sandbox = text.includes("sandbox") || text.includes("creativo") || text.includes("builder") ? 1.0 : 0.0;
  let shooter = text.includes("shooter") || text.includes("fps") || text.includes("gun") || text.includes("combat") || text.includes("disparos") ? 1.0 : 0.0;
  let puzzle = text.includes("puzzle") || text.includes("acertijo") || text.includes("escape") || text.includes("lógica") ? 1.0 : 0.0;

  // Si no pertenece a ninguna categoría conocida, usar sandbox por defecto para evitar vector cero
  if (sandbox === 0 && shooter === 0 && puzzle === 0) {
    sandbox = 1.0;
  }

  return [sandbox, shooter, puzzle, difficultyScore];
}

/**
 * Calcula la similitud coseno entre dos vectores numéricos.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i] ?? 0;
    const valB = vecB[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    return 0.0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Obtiene el vector promedio de afinidad del usuario a partir de su historial de juego.
 */
export async function getUserPreferenceVector(userId: string | null): Promise<number[]> {
  const defaultVector = [0.33, 0.33, 0.33, 0.5];

  if (!userId) {
    return defaultVector;
  }

  try {
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId },
      include: {
        match: {
          include: {
            map: true,
          },
        },
      },
    });

    const playedMaps = matchPlayers
      .map((mp) => mp.match.map)
      .filter((map): map is NonNullable<typeof map> => map !== null);

    if (playedMaps.length === 0) {
      return defaultVector;
    }

    const mapIds = playedMaps.map((m) => m.id);
    const features = await analyticsPrisma.mapFeatures.findMany({
      where: { mapId: { in: mapIds } },
      select: { mapId: true, difficultyScore: true },
    });

    const difficultyMap = new Map<string, number>();
    for (const f of features) {
      if (f.difficultyScore !== null) {
        difficultyMap.set(f.mapId, f.difficultyScore);
      }
    }

    let sumSandbox = 0;
    let sumShooter = 0;
    let sumPuzzle = 0;
    let sumDifficulty = 0;

    for (const map of playedMaps) {
      const difficulty = difficultyMap.get(map.id) ?? 0.5;
      const vec = getMapVector(map, difficulty);
      sumSandbox += vec[0] ?? 0;
      sumShooter += vec[1] ?? 0;
      sumPuzzle += vec[2] ?? 0;
      sumDifficulty += vec[3] ?? 0;
    }

    const count = playedMaps.length;
    return [
      sumSandbox / count,
      sumShooter / count,
      sumPuzzle / count,
      sumDifficulty / count,
    ];
  } catch (err) {
    logger.warn("ContentRecommender", `Failed to build preference vector for user ${userId}. Using defaults.`, err);
    return defaultVector;
  }
}

/**
 * Devuelve mapas ordenados por similitud coseno con el perfil del usuario.
 * Penaliza a la mitad el score de similitud si el mapa ya se completó más de 3 veces.
 */
export async function getContentRecommendations(userId: string | null, options: { limit?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 10));

  try {
    // 1. Obtener mapas publicados candidatos
    const maps = await prisma.gameMap.findMany({
      where: { isPublished: true },
      include: mapInclude,
    });

    if (maps.length === 0) {
      return [];
    }

    // 2. Obtener características de dificultad analítica de los mapas candidatos
    const mapIds = maps.map((m) => m.id);
    const features = await analyticsPrisma.mapFeatures.findMany({
      where: { mapId: { in: mapIds } },
      select: { mapId: true, difficultyScore: true },
    });

    const difficultyMap = new Map<string, number>();
    for (const f of features) {
      if (f.difficultyScore !== null) {
        difficultyMap.set(f.mapId, f.difficultyScore);
      }
    }

    // 3. Obtener vector de preferencias del usuario
    const userVector = await getUserPreferenceVector(userId);

    // 4. Contar completados del usuario por mapa
    const userCompletionsMap = new Map<string, number>();
    if (userId) {
      try {
        const userMatches = await prisma.matchPlayer.findMany({
          where: { userId },
          include: {
            match: true,
          },
        });

        for (const mp of userMatches) {
          const match = mp.match;
          if (!match.mapId) continue;
          
          const isCompleted = match.status === "FINISHED" || match.endedAt !== null;
          if (isCompleted) {
            const joinedTime = new Date(mp.joinedAt).getTime();
            const endedTime = match.endedAt ? new Date(match.endedAt).getTime() : joinedTime;
            const leftTime = mp.leftAt ? new Date(mp.leftAt).getTime() : endedTime;

            const didComplete = mp.leftAt === null || leftTime >= endedTime - 2000;
            if (didComplete) {
              const current = userCompletionsMap.get(match.mapId) ?? 0;
              userCompletionsMap.set(match.mapId, current + 1);
            }
          }
        }
      } catch (err) {
        logger.warn("ContentRecommender", "Failed to retrieve user completions for penalty check", err);
      }
    }

    // 5. Computar afinidad de coseno y aplicar penalización
    const scoredMaps = maps.map((map) => {
      const difficulty = difficultyMap.get(map.id) ?? 0.5;
      const mapVector = getMapVector(map, difficulty);
      
      let score = cosineSimilarity(userVector, mapVector);

      const completions = userCompletionsMap.get(map.id) ?? 0;
      if (completions > 3) {
        score = score * 0.5;
      }

      return { map, score };
    });

    scoredMaps.sort((a, b) => b.score - a.score);

    return scoredMaps.slice(0, limit).map((item) => toMapDto(item.map, false));
  } catch (err) {
    logger.error("ContentRecommender", "Failed to compute content recommendations", err);
    throw err;
  }
}

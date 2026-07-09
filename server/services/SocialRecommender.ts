import { prisma } from "../db/prisma.js";
import { analyticsPrisma } from "../db/analyticsPrisma.js";
import { getRedis } from "../cache/redis.js";
import { roomManager } from "../managers/RoomManager.js";
import { logger } from "../utils/Logger.js";

const REDIS_VISIBILITY_PREFIX = "presence:status:";

export type PlayerVisibility = "ONLINE" | "INVISIBLE" | "DND";

/**
 * Establece el estado de visibilidad del usuario en Redis.
 */
export async function setUserVisibility(userId: string, status: PlayerVisibility): Promise<void> {
  const redis = getRedis();
  if (!redis || !redis.isOpen) {
    logger.warn("SocialRecommender", `Redis unavailable. Cannot set visibility status for ${userId}`);
    return;
  }
  const key = `${REDIS_VISIBILITY_PREFIX}${userId}`;
  await redis.set(key, status);
  logger.info("SocialRecommender", `Set visibility status for user ${userId} to ${status}`);
}

/**
 * Obtiene el estado de visibilidad del usuario de Redis. Por defecto es ONLINE.
 */
export async function getUserVisibility(userId: string): Promise<PlayerVisibility> {
  const redis = getRedis();
  if (!redis || !redis.isOpen) {
    return "ONLINE";
  }
  const key = `${REDIS_VISIBILITY_PREFIX}${userId}`;
  const status = await redis.get(key);
  if (status === "INVISIBLE" || status === "DND" || status === "ONLINE") {
    return status;
  }
  return "ONLINE";
}

export interface SocialRecommendation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  score: number;
  friendsPlaying: { userId: string; username: string }[];
}

/**
 * Obtiene recomendaciones de mapas basados en la presencia en tiempo real de amigos con afinidad.
 */
export async function getSocialRecommendations(
  userId: string | null,
  options?: { limit?: number }
): Promise<SocialRecommendation[]> {
  const limit = options?.limit ?? 10;

  if (!userId) {
    logger.info("SocialRecommender", "Anonymous user requested social recommendations. Returning empty.");
    return [];
  }

  // 1. Obtener afinidades sociales del usuario en base de datos analítica
  const affinities = await analyticsPrisma.socialAffinity.findMany({
    where: {
      OR: [
        { userId1: userId },
        { userId2: userId },
      ],
      affinity: { gt: 0 },
    },
  });

  if (affinities.length === 0) {
    logger.debug("SocialRecommender", `User ${userId} has no recorded social affinities.`);
    return [];
  }

  // Mapear amigoUserId -> afinidad
  const friendAffinities = new Map<string, number>();
  for (const aff of affinities) {
    const friendId = aff.userId1 === userId ? aff.userId2 : aff.userId1;
    friendAffinities.set(friendId, aff.affinity);
  }

  // 2. Obtener salas activas del RoomManager
  const activeRooms = roomManager.getActiveRoomsAndPlayers();
  if (activeRooms.length === 0) {
    logger.debug("SocialRecommender", "No active rooms found in the server.");
    return [];
  }

  // 3. Resolver la asociación roomId -> mapId de la base operativa
  const roomIds = activeRooms.map((r) => r.roomId);
  const matches = await prisma.match.findMany({
    where: {
      roomId: { in: roomIds },
      status: { in: ["RUNNING", "WAITING"] },
    },
    include: {
      map: true,
    },
  });

  // Mapear roomId -> map info
  const roomToMap = new Map<string, { id: string; slug: string; name: string; description: string | null }>();
  for (const m of matches) {
    if (m.roomId && m.map) {
      roomToMap.set(m.roomId, {
        id: m.map.id,
        slug: m.map.slug,
        name: m.map.name,
        description: m.map.description,
      });
    }
  }

  // 4. Calcular el score por mapa sumando afinidades de amigos presentes
  const candidateMaps = new Map<string, {
    map: { id: string; slug: string; name: string; description: string | null };
    score: number;
    friendsPlayingMap: Map<string, string>; // userId -> username (para evitar duplicados por reconexiones)
  }>();

  for (const room of activeRooms) {
    const mapInfo = roomToMap.get(room.roomId);
    if (!mapInfo) continue; // Si la sala no tiene un mapa registrado, la ignoramos

    for (const player of room.players) {
      if (!player.userId || player.userId === userId) continue; // Ignorar bots o al propio usuario objetivo

      const affinity = friendAffinities.get(player.userId);
      if (affinity === undefined) continue; // No hay afinidad registrada con este jugador

      // Validar privacidad: Si el amigo está invisible, no revelamos su presencia
      const visibility = await getUserVisibility(player.userId);
      if (visibility === "INVISIBLE") {
        continue;
      }

      // Encontrar o inicializar la entrada del mapa
      if (!candidateMaps.has(mapInfo.id)) {
        candidateMaps.set(mapInfo.id, {
          map: mapInfo,
          score: 0,
          friendsPlayingMap: new Map(),
        });
      }

      const candidate = candidateMaps.get(mapInfo.id)!;
      if (!candidate.friendsPlayingMap.has(player.userId)) {
        candidate.friendsPlayingMap.set(player.userId, player.name);
        candidate.score += affinity;
      }
    }
  }

  // 5. Convertir a listado final, ordenar y limitar
  const recommendations: SocialRecommendation[] = Array.from(candidateMaps.values())
    .map((c) => ({
      id: c.map.id,
      slug: c.map.slug,
      name: c.map.name,
      description: c.map.description,
      score: c.score,
      friendsPlaying: Array.from(c.friendsPlayingMap.entries()).map(([userId, username]) => ({
        userId,
        username,
      })),
    }))
    .filter((rec) => rec.score > 0) // Solo recomendar si hay score positivo
    .sort((a, b) => b.score - a.score);

  return recommendations.slice(0, limit);
}

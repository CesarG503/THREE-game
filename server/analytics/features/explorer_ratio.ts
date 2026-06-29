import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

const MIN_MATCHES_FOR_PROFILE = 5;
const EXPLORER_THRESHOLD = 1.0; // Shannon entropy >= 1.0 -> Explorer

export async function computeExplorerProfile(lookbackDays: number = 7) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  logger.info("ExplorerProfile", `Starting computation for the last ${lookbackDays} days.`);

  // 1. Extraer eventos MatchJoin para analizar los mapas a los que entraron
  const joinEvents = await analyticsPrisma.rawEvent.findMany({
    where: {
      eventType: "MatchJoin",
      timestamp: {
        gte: startTime,
        lte: endTime,
      },
    },
    select: {
      userId: true,
      timestamp: true,
      payload: true,
    },
  });

  if (joinEvents.length === 0) {
    logger.info("ExplorerProfile", "No MatchJoin events found in window.");
    return;
  }

  // Estructura: userId -> mapId -> count
  const userMaps = new Map<string, { totalMatches: number; mapCounts: Map<string, number>; lastActive: Date }>();

  // 2. Agrupar eventos por usuario y mapa
  for (const ev of joinEvents) {
    const payload = ev.payload as any;
    const uid = ev.userId;
    const mapId = payload?.mapId;

    if (!uid || !mapId) continue;

    if (!userMaps.has(uid)) {
      userMaps.set(uid, { totalMatches: 0, mapCounts: new Map(), lastActive: ev.timestamp });
    }

    const userData = userMaps.get(uid)!;
    userData.totalMatches++;
    userData.mapCounts.set(mapId, (userData.mapCounts.get(mapId) || 0) + 1);
    
    if (ev.timestamp > userData.lastActive) {
      userData.lastActive = ev.timestamp;
    }
  }

  let updatedUsers = 0;

  // 3. Calcular entropía y clasificar
  for (const [userId, data] of userMaps.entries()) {
    if (data.totalMatches < MIN_MATCHES_FOR_PROFILE) {
      // Ignorar perfilado por Cold-Start, pero asegurar que existan en PlayerFeatures.
      continue;
    }

    let entropy = 0;
    for (const count of data.mapCounts.values()) {
      const pm = count / data.totalMatches;
      if (pm > 0) {
        entropy -= pm * Math.log2(pm);
      }
    }

    const profile = entropy >= EXPLORER_THRESHOLD ? "Explorer" : "Repeater";

    // 4. Upsert a PlayerFeatures
    try {
      await analyticsPrisma.playerFeatures.upsert({
        where: { userId },
        create: {
          userId,
          lastActive: data.lastActive,
          matchesPlayed: data.totalMatches, // Se sobrescribe, pero servirá para tests/inicialización
          explorerRatio: entropy,
          playerProfile: profile,
        },
        update: {
          explorerRatio: entropy,
          playerProfile: profile,
          lastActive: data.lastActive, // Podríamos actualizar o dejar el manejador de UI 
        },
      });
      updatedUsers++;
    } catch (e) {
      logger.error("ExplorerProfile", `Failed to update features for user ${userId}`, e);
    }
  }

  logger.info("ExplorerProfile", `Successfully updated profiles for ${updatedUsers} users.`);
}

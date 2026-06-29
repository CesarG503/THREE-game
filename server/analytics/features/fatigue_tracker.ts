import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

// Lista de razones técnicas de desconexión a ignorar
const TECHNICAL_DISCONNECTS = ["disconnect", "lost", "timeout", "network", "error", "conn"];

function isTechnicalDisconnect(reason: string | undefined | null): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return TECHNICAL_DISCONNECTS.some((term) => normalized.includes(term));
}

export async function computePlayerFatigue(lookbackDays: number = 14) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  logger.info("FatigueTracker", `Starting computation with ${lookbackDays} days lookback.`);

  // 1. Obtener eventos de MatchLeave
  const leaveEvents = await analyticsPrisma.rawEvent.findMany({
    where: {
      eventType: "MatchLeave",
      timestamp: { gte: startTime, lte: endTime },
      userId: { not: null }
    },
    select: {
      userId: true,
      timestamp: true,
      payload: true
    },
    orderBy: { timestamp: "asc" } // Orden cronológico para análisis de secuencia
  });

  if (leaveEvents.length === 0) {
    logger.info("FatigueTracker", "No MatchLeave events found in lookback window.");
    return;
  }

  // Estructura: userId -> mapId -> list of { duration: number, timestamp: Date }
  const userMapPlayTimes = new Map<string, Map<string, { duration: number; timestamp: Date }[]>>();

  // 2. Agrupar e ignorar desconexiones de red
  for (const ev of leaveEvents) {
    const payload = ev.payload as any;
    const uid = ev.userId;
    const mapId = payload?.mapId;
    const duration = payload?.durationSeconds;
    const reason = payload?.reason;

    if (!uid || !mapId || typeof duration !== "number") continue;

    // Ignorar desconexiones técnicas
    if (isTechnicalDisconnect(reason)) {
      logger.debug("FatigueTracker", `Skipping event for user ${uid} on map ${mapId} due to technical reason: ${reason}`);
      continue;
    }

    if (!userMapPlayTimes.has(uid)) {
      userMapPlayTimes.set(uid, new Map());
    }

    const mapGroup = userMapPlayTimes.get(uid)!;
    if (!mapGroup.has(mapId)) {
      mapGroup.set(mapId, []);
    }

    mapGroup.get(mapId)!.push({ duration, timestamp: ev.timestamp });
  }

  const fatigueExpiresAt = new Date(endTime.getTime() + 48 * 60 * 60 * 1000); // 48 horas en el futuro
  let flaggedCount = 0;
  let clearedCount = 0;

  // 3. Procesar heurística de fatiga por cada usuario y mapa
  for (const [userId, maps] of userMapPlayTimes.entries()) {
    for (const [mapId, matches] of maps.entries()) {
      const totalMatches = matches.length;

      // Se requieren al menos 3 partidas para diagnosticar fatiga
      if (totalMatches < 3) {
        // No hay suficientes datos para fatiga, pero si existía una fatiga guardada, la dejamos expirar naturalmente
        continue;
      }

      // Calcular promedio histórico del usuario en este mapa
      const totalPlaytime = matches.reduce((sum, m) => sum + m.duration, 0);
      const avgPlaytime = totalPlaytime / totalMatches;

      if (avgPlaytime === 0) continue;

      // Obtener las últimas 3 partidas
      const lastThree = matches.slice(-3);
      
      // Heurística: las últimas 3 duraron < 20% del promedio histórico
      const isFatigued = lastThree.every((m) => m.duration < 0.2 * avgPlaytime);

      if (isFatigued) {
        try {
          await analyticsPrisma.fatiguedMap.upsert({
            where: {
              userId_mapId: { userId, mapId }
            },
            create: {
              userId,
              mapId,
              fatiguedAt: endTime,
              expiresAt: fatigueExpiresAt
            },
            update: {
              fatiguedAt: endTime,
              expiresAt: fatigueExpiresAt
            }
          });
          flaggedCount++;
          logger.info("FatigueTracker", `Flagged user ${userId} as fatigued on map ${mapId}. Avg: ${avgPlaytime.toFixed(1)}s, Last 3: ${lastThree.map(m => m.duration + "s").join(", ")}`);
        } catch (err) {
          logger.error("FatigueTracker", `Failed to upsert fatigue for user ${userId} on map ${mapId}`, err);
        }
      } else {
        // Si el usuario ya no está fatigado (por ejemplo, acaba de jugar una partida larga), removemos la fatiga
        try {
          const deleted = await analyticsPrisma.fatiguedMap.deleteMany({
            where: { userId, mapId }
          });
          if (deleted.count > 0) {
            clearedCount++;
            logger.info("FatigueTracker", `Cleared active fatigue for user ${userId} on map ${mapId} due to positive activity.`);
          }
        } catch (err) {
          logger.error("FatigueTracker", `Failed to delete fatigue state for user ${userId} on map ${mapId}`, err);
        }
      }
    }
  }

  // 4. Limpieza opcional de registros de fatiga expirados físicamente
  try {
    const deletedExpired = await analyticsPrisma.fatiguedMap.deleteMany({
      where: { expiresAt: { lte: endTime } }
    });
    if (deletedExpired.count > 0) {
      logger.info("FatigueTracker", `Purged ${deletedExpired.count} expired fatigue entries from database.`);
    }
  } catch (err) {
    logger.error("FatigueTracker", "Error purging expired fatigue records", err);
  }

  logger.info("FatigueTracker", `Process finished. Flagged: ${flaggedCount}, Cleared: ${clearedCount}`);
}

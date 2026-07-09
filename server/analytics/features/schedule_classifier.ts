import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";

/**
 * Clasifica los hábitos temporales de juego de un usuario en base a sus sesiones de los últimos 30 días.
 */
export async function classifyScheduleForUser(userId: string): Promise<string | null> {
  logger.info("ScheduleClassifier", `Classifying schedule profile for user: ${userId}`);

  try {
    // 1. Obtener eventos SessionStart de los últimos 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = await analyticsPrisma.rawEvent.findMany({
      where: {
        userId,
        eventType: "SessionStart",
        timestamp: { gte: thirtyDaysAgo },
      },
      orderBy: { timestamp: "asc" },
    });

    if (sessions.length === 0) {
      logger.warn("ScheduleClassifier", `No SessionStart events in last 30 days for user ${userId}. Skipping.`);
      
      // Limpiar tag de ejecuciones anteriores
      await analyticsPrisma.playerFeatures.upsert({
        where: { userId },
        create: { userId, lastActive: new Date(), temporalTag: null },
        update: { temporalTag: null },
      });
      await PlayerProfileRepository.clearCache(userId);
      return null;
    }

    const total = sessions.length;
    let weekendCount = 0;
    let nightCount = 0;
    let lunchCount = 0;

    // 2. Analizar marcas de tiempo convertidas a la hora local del usuario
    for (const session of sessions) {
      const payload = session.payload as any;
      const timezoneOffset = typeof payload?.timezoneOffset === "number" ? payload.timezoneOffset : 0;
      
      // Desplazar el timestamp UTC al huso local del usuario
      // (En JS, timezoneOffset es positivo para husos al oeste de UTC, ej. UTC-6 es 360)
      const localDate = new Date(session.timestamp.getTime() - timezoneOffset * 60 * 1000);
      
      const localHour = localDate.getUTCHours();
      const localDay = localDate.getUTCDay(); // 0 = Domingo, 6 = Sábado

      // Weekend Warrior: Sábado (6) o Domingo (0)
      if (localDay === 0 || localDay === 6) {
        weekendCount++;
      }

      // Night Owl: 10 PM (22) a 2 AM (2) local (inclusive)
      if (localHour === 22 || localHour === 23 || localHour === 0 || localHour === 1 || localHour === 2) {
        nightCount++;
      }

      // Daily Lunch Player: Días de semana (1 a 5) y horario de almuerzo (11 AM a 2 PM local: 11, 12, 13, 14)
      if (localDay >= 1 && localDay <= 5 && localHour >= 11 && localHour <= 14) {
        lunchCount++;
      }
    }

    const weekendRatio = weekendCount / total;
    const nightRatio = nightCount / total;
    const lunchRatio = lunchCount / total;

    logger.debug(
      "ScheduleClassifier",
      `User ${userId} statistics - Total: ${total}, Weekend: ${weekendCount} (${(weekendRatio * 100).toFixed(1)}%), Night: ${nightCount} (${(nightRatio * 100).toFixed(1)}%), Lunch: ${lunchCount} (${(lunchRatio * 100).toFixed(1)}%)`
    );

    // 3. Evaluar reglas de segmentación en cascada
    let temporalTag: string | null = null;
    if (weekendRatio >= 0.5) {
      temporalTag = "Weekend Warrior";
    } else if (nightRatio >= 0.45) {
      temporalTag = "Night Owl";
    } else if (lunchRatio >= 0.2) {
      temporalTag = "Daily Lunch Player";
    }

    logger.info("ScheduleClassifier", `User ${userId} classified as: ${temporalTag || "Standard"}`);

    // 4. Persistir a la base analítica
    const now = new Date();
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: now,
        temporalTag,
      },
      update: {
        lastActive: now,
        temporalTag,
      },
    });

    // 5. Invalidar caché en Redis para consistencia
    await PlayerProfileRepository.clearCache(userId);

    return temporalTag;
  } catch (err) {
    logger.error("ScheduleClassifier", `Failed to classify schedule for user ${userId}`, err);
    throw err;
  }
}

/**
 * Clasifica los hábitos temporales para todos los usuarios del sistema.
 */
export async function classifyAllUsersSchedule(): Promise<number> {
  logger.info("ScheduleClassifier", "Starting batch temporal classification for all users...");

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let count = 0;
  for (const u of users) {
    try {
      await classifyScheduleForUser(u.id);
      count++;
    } catch (err) {
      logger.error("ScheduleClassifier", `Failed to classify schedule for user ${u.id}`, err);
    }
  }

  logger.info("ScheduleClassifier", `Finished batch classification. Processed ${count} users.`);
  return count;
}

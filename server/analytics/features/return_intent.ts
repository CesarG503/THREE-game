import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

const ABANDON_REASONS = [
  "disconnect",
  "lost",
  "timeout",
  "network",
  "error",
  "conn",
  "rage",
  "abandoned",
  "early"
];

function isTechnicalOrAbandonReason(reason: string | undefined | null): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return ABANDON_REASONS.some((term) => normalized.includes(term));
}

/**
 * Computa la Intención de Retorno Implícita (IRI) del usuario basándose en su última sesión.
 * Fórmula: IRI = (Partidas completadas / Partidas iniciadas) * (1 / Latencia promedio en ms)
 */
export async function computeReturnIntentForUser(userId: string): Promise<number | null> {
  logger.info("ReturnIntent", `Starting IRI calculation for user: ${userId}`);

  try {
    // 1. Obtener el último evento SessionEnd del usuario
    const lastSessionEnd = await analyticsPrisma.rawEvent.findFirst({
      where: {
        userId,
        eventType: "SessionEnd",
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!lastSessionEnd) {
      logger.warn("ReturnIntent", `No SessionEnd event found for user ${userId}. Skipping.`);
      return null;
    }

    const payload = lastSessionEnd.payload as any;
    const durationSeconds = payload?.durationSeconds ?? 0;
    const averageLatencyMs = payload?.averageLatencyMs ?? 50; // Fallback a 50ms si no hay latencia registrada

    const endTime = lastSessionEnd.timestamp;
    const startTime = new Date(endTime.getTime() - durationSeconds * 1000);

    logger.debug(
      "ReturnIntent",
      `Session window for user ${userId}: ${startTime.toISOString()} to ${endTime.toISOString()} (Duration: ${durationSeconds}s, Avg Latency: ${averageLatencyMs}ms)`
    );

    // 2. Obtener eventos relacionados en la ventana de la sesión (con buffer de 10s para margen)
    const events = await analyticsPrisma.rawEvent.findMany({
      where: {
        eventType: {
          in: ["MatchJoin", "MatchLeave", "MatchEnd"],
        },
        timestamp: {
          gte: new Date(startTime.getTime() - 10000),
          lte: new Date(endTime.getTime() + 10000),
        },
      },
    });

    // Filtrar los eventos correspondientes en memoria
    const userJoins = events.filter((ev) => ev.eventType === "MatchJoin" && ev.userId === userId);
    const userLeaves = events.filter((ev) => ev.eventType === "MatchLeave" && ev.userId === userId);
    const roomEnds = events.filter((ev) => ev.eventType === "MatchEnd");

    const matchesStarted = userJoins.length;
    let matchesCompleted = 0;

    for (const join of userJoins) {
      const roomId = (join.payload as any)?.roomId;
      if (!roomId) continue;

      // Opción A: La partida terminó a nivel de sala
      const wasEnded = roomEnds.some((re) => (re.payload as any)?.roomId === roomId);
      if (wasEnded) {
        matchesCompleted++;
        continue;
      }

      // Opción B: El usuario salió por una razón no técnica y sin abandono temprano (ej. completada)
      const leaveEvent = userLeaves.find((ul) => (ul.payload as any)?.roomId === roomId);
      if (leaveEvent) {
        const reason = (leaveEvent.payload as any)?.reason;
        if (!isTechnicalOrAbandonReason(reason)) {
          matchesCompleted++;
        }
      }
    }

    // 3. Aplicar fórmula matemática
    const completionRatio = matchesStarted > 0 ? matchesCompleted / matchesStarted : 0.0;
    const latencyTerm = 1 / Math.max(1, averageLatencyMs);
    const returnIntent = completionRatio * latencyTerm;

    logger.info(
      "ReturnIntent",
      `Computed IRI for user ${userId}: ${returnIntent.toFixed(6)} (Started: ${matchesStarted}, Completed: ${matchesCompleted}, Latency: ${averageLatencyMs}ms)`
    );

    // 4. Guardar resultado en PlayerFeatures
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: endTime,
        returnIntent,
      },
      update: {
        lastActive: endTime,
        returnIntent,
      },
    });

    return returnIntent;
  } catch (err) {
    logger.error("ReturnIntent", `Failed to compute return intent for user ${userId}`, err);
    throw err;
  }
}

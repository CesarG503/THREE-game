import { getRedis } from "../../cache/redis.js";
import { logger } from "../../utils/Logger.js";

// Exposición pública de los límites configurados
export const BOT_LIMITS = {
  CLICKS_10S: 100,
  EVENTS_60S: 200,
  GUEST_SESSIONS_1H: 20
};

/**
 * Evalúa la reputación del cliente que envía un evento basado en su IP y SessionID.
 * Implementa heurísticas mediante ventanas deslizantes en Redis.
 *
 * @param event El evento completo de telemetría (envelope).
 * @param ip IP de origen del cliente (no anonimizada).
 * @returns Un objeto indicando si es sospechoso y la razón.
 */
export async function evaluateEventReputation(
  event: any,
  ip: string
): Promise<{ isSuspicious: boolean; reason?: string }> {
  const redis = getRedis();

  // Fail-open: Si Redis no está disponible, permitimos continuar sin marcar como sospechoso
  if (!redis || !redis.isOpen) {
    return { isSuspicious: false };
  }

  const now = Date.now();
  const eventId = event.id || Math.random().toString(36).substring(2);
  const eventType = event.eventType;
  const userId = event.userId;

  // Claves de Redis
  const FLAGGED_KEY = `reputation:flagged:${ip}`;
  const CLICKS_KEY = `reputation:clicks:${ip}`;
  const EVENTS_KEY = `reputation:velocity:${ip}`;
  const GUESTS_KEY = `reputation:guests:${ip}`;

  try {
    // 1. Verificar si el cliente ya está previamente penalizado/bloqueado en Redis
    const flaggedReason = await redis.get(FLAGGED_KEY);
    if (flaggedReason) {
      return { isSuspicious: true, reason: flaggedReason };
    }

    // 2. Registrar evento actual en la ventana global de velocidad por IP (últimos 60s)
    await redis.zAdd(EVENTS_KEY, { score: now, value: eventId });
    await redis.zRemRangeByScore(EVENTS_KEY, "-inf", String(now - 60 * 1000));
    await redis.expire(EVENTS_KEY, 75);

    const totalEvents = await redis.zCard(EVENTS_KEY);
    if (totalEvents > BOT_LIMITS.EVENTS_60S) {
      const reason = `Excedió límite de velocidad global de eventos: ${totalEvents} eventos/minuto (Máx: ${BOT_LIMITS.EVENTS_60S})`;
      // Flaggear la IP por 1 hora
      await redis.set(FLAGGED_KEY, reason, { EX: 3600 });
      logger.warn("BotFilter", `IP ${ip} marcada como sospechosa: ${reason}`);
      return { isSuspicious: true, reason };
    }

    // 3. Heurística de Clics (UiClick) en los últimos 10s
    if (eventType === "UiClick") {
      await redis.zAdd(CLICKS_KEY, { score: now, value: eventId });
      await redis.zRemRangeByScore(CLICKS_KEY, "-inf", String(now - 10 * 1000));
      await redis.expire(CLICKS_KEY, 15);

      const totalClicks = await redis.zCard(CLICKS_KEY);
      if (totalClicks > BOT_LIMITS.CLICKS_10S) {
        const reason = `Spam de UI clics detectado: ${totalClicks} clics en 10s (Máx: ${BOT_LIMITS.CLICKS_10S})`;
        await redis.set(FLAGGED_KEY, reason, { EX: 3600 });
        logger.warn("BotFilter", `IP ${ip} marcada como sospechosa: ${reason}`);
        return { isSuspicious: true, reason };
      }
    }

    // 4. Heurística de Sesiones Concurrentes de Invitado (SessionStart con userId nulo) en la última hora
    if (eventType === "SessionStart" && (!userId || userId === null)) {
      await redis.zAdd(GUESTS_KEY, { score: now, value: eventId });
      await redis.zRemRangeByScore(GUESTS_KEY, "-inf", String(now - 60 * 60 * 1000));
      await redis.expire(GUESTS_KEY, 3700);

      const guestSessions = await redis.zCard(GUESTS_KEY);
      if (guestSessions > BOT_LIMITS.GUEST_SESSIONS_1H) {
        const reason = `Concurrencia excesiva de sesiones de invitado: ${guestSessions} en 1h (Máx: ${BOT_LIMITS.GUEST_SESSIONS_1H})`;
        await redis.set(FLAGGED_KEY, reason, { EX: 3600 });
        logger.warn("BotFilter", `IP ${ip} marcada como sospechosa: ${reason}`);
        return { isSuspicious: true, reason };
      }
    }

    return { isSuspicious: false };
  } catch (err) {
    // Si ocurre un error de Redis, registramos y fallamos abierto (fail-open)
    logger.error("BotFilter", `Error al evaluar reputación de la IP ${ip}`, err);
    return { isSuspicious: false };
  }
}

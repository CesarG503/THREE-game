import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

export async function computePopularitySensitivity(lookbackDays: number = 7) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  logger.info("PopularitySensitivity", `Starting computation for the last ${lookbackDays} days.`);

  // 1. Obtener la popularidad global y asignarle percentiles
  const maps = await analyticsPrisma.mapFeatures.findMany({
    select: { mapId: true, totalJoins: true },
    orderBy: { totalJoins: 'asc' } // De menos popular a más popular
  });

  if (maps.length === 0) {
    logger.info("PopularitySensitivity", "No maps found. Aborting.");
    return;
  }

  // mapId -> Percentil (0.0 a 1.0)
  const mapPercentiles = new Map<string, number>();
  maps.forEach((m, index) => {
    // Si hay 1 solo mapa, evitamos división por cero y le damos 1.0
    const percentile = maps.length > 1 ? index / (maps.length - 1) : 1.0;
    mapPercentiles.set(m.mapId, percentile);
  });

  // 2. Obtener clics del usuario en tarjetas de mapas
  const clicks = await analyticsPrisma.rawEvent.findMany({
    where: {
      eventType: "uiClick",
      timestamp: { gte: startTime, lte: endTime }
    },
    select: { userId: true, payload: true }
  });

  // userId -> { sum_PW: number, sum_W: number }
  const userAggregates = new Map<string, { sumPW: number; sumW: number }>();

  let processedClicks = 0;

  for (const ev of clicks) {
    const payload = ev.payload as any;
    
    // Ignorar si no es una tarjeta de catálogo
    if (payload.elementType !== "MapCard") continue;

    const mapId = payload.mapId || payload.elementId;
    const uid = ev.userId;

    if (!uid || !mapId || !mapPercentiles.has(mapId)) continue;

    // Calcular el peso de mitigación del sesgo visual (Inverse Position Weighting)
    const position = typeof payload.catalogPosition === "number" ? payload.catalogPosition : 0;
    const W = 1.0 / (position + 1);

    const P = mapPercentiles.get(mapId)!;

    if (!userAggregates.has(uid)) {
      userAggregates.set(uid, { sumPW: 0, sumW: 0 });
    }

    const agg = userAggregates.get(uid)!;
    agg.sumPW += P * W;
    agg.sumW += W;
    processedClicks++;
  }

  if (userAggregates.size === 0) {
    logger.info("PopularitySensitivity", "No valid map clicks found to process.");
    return;
  }

  // 3. Calcular ISP e inyectar en BD
  let updatedUsers = 0;

  for (const [userId, agg] of userAggregates.entries()) {
    if (agg.sumW === 0) continue;

    // ISP (Indice de Sensibilidad a Popularidad)
    const ISP = agg.sumPW / agg.sumW;

    try {
      await analyticsPrisma.playerFeatures.upsert({
        where: { userId },
        create: {
          userId,
          lastActive: endTime,
          popularitySensitivity: ISP,
        },
        update: {
          popularitySensitivity: ISP,
        }
      });
      updatedUsers++;
    } catch (e) {
      logger.error("PopularitySensitivity", `Failed to update ISP for user ${userId}`, e);
    }
  }

  logger.info("PopularitySensitivity", `Processed ${processedClicks} clicks. Updated ISP for ${updatedUsers} users.`);
}

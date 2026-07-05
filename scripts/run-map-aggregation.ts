import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { getRedis, connectRedis } from "../server/cache/redis.js";
import { logger } from "../server/utils/Logger.js";
import { MapProfileRepository } from "../server/analytics/models/MapProfile.js";
import { computeMapDifficultyAndPace } from "../server/analytics/features/map_difficulty.js";
import { computeMapViralityAndSticky } from "../server/analytics/features/map_virality.js";
import "dotenv/config";

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Agrega periódicamente las métricas analíticas de los mapas y precarga el caché de Redis.
 * lookbackDays: Ventana de tiempo histórica para el cálculo (por defecto 30 días)
 */
export async function runMapAggregation(lookbackDays = 30): Promise<void> {
  logger.info("MapAggregation", `Starting map metrics aggregation. Lookback window: ${lookbackDays} days.`);

  try {
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // 1. Obtener todos los mapas de la base operacional
    const maps = await prisma.gameMap.findMany({
      select: { id: true, slug: true, name: true }
    });

    if (maps.length === 0) {
      logger.info("MapAggregation", "No maps found in operational DB. Exiting aggregation.");
      return;
    }

    // 2. Obtener eventos de interés (MatchStart, MatchEnd, MatchLeave) en la ventana
    const events = await analyticsPrisma.rawEvent.findMany({
      where: {
        eventType: {
          in: ["MatchStart", "MatchEnd", "MatchLeave"]
        },
        timestamp: {
          gte: lookbackDate
        }
      }
    });

    logger.info("MapAggregation", `Fetched ${events.length} telemetry events since ${lookbackDate.toISOString()}`);

    // Mapeo auxiliar para rastrear roomId -> mapId (por si MatchEnd no incluye mapId)
    const roomIdToMapId = new Map<string, string>();
    for (const ev of events) {
      const payload = ev.payload as any;
      if (payload?.mapId && payload?.roomId) {
        roomIdToMapId.set(payload.roomId, payload.mapId);
      }
    }

    // 3. Procesar métricas por cada mapa
    for (const map of maps) {
      const mapId = map.id;
      
      // Filtrar eventos pertenecientes al mapa
      const mapEvents = events.filter((ev) => {
        const payload = ev.payload as any;
        if (!payload) return false;
        if (payload.mapId === mapId) return true;
        if (payload.roomId && roomIdToMapId.get(payload.roomId) === mapId) return true;
        return false;
      });

      const starts = mapEvents.filter((ev) => ev.eventType === "MatchStart");
      const ends = mapEvents.filter((ev) => ev.eventType === "MatchEnd");
      const leaves = mapEvents.filter((ev) => ev.eventType === "MatchLeave");

      // A) Calcular Tasa de Completitud (Completion Rate)
      const uniqueStartRoomIds = new Set(starts.map((ev) => (ev.payload as any)?.roomId).filter(Boolean));
      const uniqueEndRoomIds = new Set(ends.map((ev) => (ev.payload as any)?.roomId).filter(Boolean));
      
      let completionRate: number | null = null;
      if (uniqueStartRoomIds.size > 0) {
        completionRate = uniqueEndRoomIds.size / uniqueStartRoomIds.size;
        completionRate = Math.min(1.0, completionRate); // Evitar ratios > 1.0 por errores de ingesta
      }

      // B) Calcular Mediana de Juego (Median Playtime)
      const durations = leaves
        .map((ev) => (ev.payload as any)?.durationSeconds)
        .filter((d): d is number => typeof d === "number" && d >= 0);
      
      const medianPlaytime = computeMedian(durations);

      // C) Calcular Curva de Retención (Retention Curve)
      const thresholds = [30, 60, 120, 240];
      let retentionCurve: number[] | null = null;
      if (durations.length > 0) {
        retentionCurve = thresholds.map((t) => {
          const count = durations.filter((d) => d >= t).length;
          return Number((count / durations.length).toFixed(4));
        });
      }

      logger.debug(
        "MapAggregation",
        `Map ${map.name} (${mapId}): Completion Rate: ${completionRate?.toFixed(4) ?? "N/A"}, ` +
        `Median Playtime: ${medianPlaytime?.toFixed(1) ?? "N/A"}s, ` +
        `Retention Curve: ${retentionCurve ? JSON.stringify(retentionCurve) : "N/A"}`
      );

      // D) Actualizar base de datos analítica (MapFeatures)
      await analyticsPrisma.mapFeatures.upsert({
        where: { mapId },
        create: {
          mapId,
          medianPlaytime,
          completionRate,
          retentionCurve: retentionCurve ? (retentionCurve as any) : null,
        },
        update: {
          medianPlaytime,
          completionRate,
          retentionCurve: retentionCurve ? (retentionCurve as any) : null,
        }
      });

      // E) Calcular dificultad y ritmo
      await computeMapDifficultyAndPace(mapId);

      // F) Calcular viralidad y sticky factor
      await computeMapViralityAndSticky(mapId, lookbackDays);

      // G) Invalidar/Actualizar caché en Redis inmediatamente
      await MapProfileRepository.clearCache(mapId);
      // Precargar en caché de forma activa
      await MapProfileRepository.getMapProfile(mapId);
    }

    logger.info("MapAggregation", "Successfully aggregated metrics and refreshed Redis cache for all maps!");
  } catch (err) {
    logger.error("MapAggregation", "Failed during map metrics aggregation", err);
    throw err;
  }
}

// Permitir ejecución directa del script
if (process.argv[1]?.endsWith("run-map-aggregation.ts")) {
  const main = async () => {
    await connectRedis();
    await runMapAggregation();
    process.exit(0);
  };
  void main();
}

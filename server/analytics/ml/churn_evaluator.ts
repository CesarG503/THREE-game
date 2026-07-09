import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";
import fs from "node:fs";
import path from "node:path";

interface ModelConfig {
  weights: {
    intercept: number;
    consecutiveLosses: number;
    abandonCount: number;
    sessionPlaytimeRatio: number;
    historicalChurnScore: number;
    logMatchesPlayed: number;
  };
  threshold: number;
}

let cachedModel: ModelConfig | null = null;

function loadModel(): ModelConfig {
  if (cachedModel) return cachedModel;
  try {
    const modelPath = path.join(process.cwd(), "server/analytics/ml/churn_model.json");
    const data = fs.readFileSync(modelPath, "utf8");
    cachedModel = JSON.parse(data) as ModelConfig;
    return cachedModel;
  } catch (err) {
    logger.error("ChurnEvaluator", "Failed to load churn model JSON, using hardcoded fallbacks", err);
    return {
      weights: {
        intercept: 0.5,
        consecutiveLosses: 1.2,
        abandonCount: 2.0,
        sessionPlaytimeRatio: -0.8,
        historicalChurnScore: 2.5,
        logMatchesPlayed: -0.5,
      },
      threshold: 0.85,
    };
  }
}

/**
 * Evalúa la probabilidad de churn en tiempo real de un usuario al término de una partida.
 */
export async function evaluateUserChurn(userId: string): Promise<{ churnProbability: number; atRisk: boolean }> {
  try {
    // 1. Obtener features del jugador desde el feature store (PlayerFeatures)
    const features = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId },
    });

    const matchesPlayed = features?.matchesPlayed ?? 0;
    const totalPlayTime = features?.totalPlayTime ?? 0;
    const historicalChurnScore = features?.churnScore ?? 0.0;

    // 2. Obtener la sesión actual: buscar el SessionStart más reciente
    const lastSessionStart = await analyticsPrisma.rawEvent.findFirst({
      where: { userId, eventType: "SessionStart" },
      orderBy: { timestamp: "desc" },
    });

    // Filtramos eventos de la sesión actual (últimas 4 horas por defecto si no hay SessionStart)
    const sessionCutoff = lastSessionStart 
      ? lastSessionStart.timestamp 
      : new Date(Date.now() - 4 * 60 * 60 * 1000);

    const sessionEvents = await analyticsPrisma.rawEvent.findMany({
      where: {
        userId,
        timestamp: { gte: sessionCutoff },
      },
      orderBy: { timestamp: "asc" }, // Orden cronológico para calcular rachas
    });

    // 3. Extracción de Features de la Sesión en Tiempo Real
    
    // Feature A: consecutiveLosses (derrotas consecutivas)
    let consecutiveLosses = 0;
    let currentLossStreak = 0;
    for (const ev of sessionEvents) {
      if (ev.eventType === "MatchEnd") {
        const payload = ev.payload as any;
        const won = payload.won === true || payload.result === "win" || payload.isWinner === true;
        if (!won) {
          currentLossStreak++;
          if (currentLossStreak > consecutiveLosses) {
            consecutiveLosses = currentLossStreak;
          }
        } else {
          currentLossStreak = 0;
        }
      }
    }

    // Feature B: abandonCount (partidas abandonadas en esta sesión)
    const abandonCount = sessionEvents.filter((ev) => {
      if (ev.eventType !== "MatchLeave") return false;
      const reason = (ev.payload as any)?.reason;
      return reason === "quit" || reason === "abandon" || reason === "network_disconnect";
    }).length;

    // Feature C: sessionPlaytimeRatio
    const currentSessionPlaytime = sessionEvents
      .filter((ev) => ev.eventType === "MatchLeave")
      .reduce((sum, ev) => sum + ((ev.payload as any)?.durationSeconds || 0), 0);

    const avgHistoricalPlaytime = matchesPlayed > 0 ? (totalPlayTime / matchesPlayed) : 300;
    const sessionPlaytimeRatio = avgHistoricalPlaytime > 0 
      ? Math.min(2.0, currentSessionPlaytime / avgHistoricalPlaytime) 
      : 1.0;

    // Feature D: logMatchesPlayed
    const logMatchesPlayed = Math.log(matchesPlayed + 1);

    // 4. Inferencia del Modelo de Regresión Logística
    const model = loadModel();
    const w = model.weights;

    const z = w.intercept +
      w.consecutiveLosses * consecutiveLosses +
      w.abandonCount * abandonCount +
      w.sessionPlaytimeRatio * sessionPlaytimeRatio +
      w.historicalChurnScore * historicalChurnScore +
      w.logMatchesPlayed * logMatchesPlayed;

    // Función Sigmoide
    const churnProbability = 1 / (1 + Math.exp(-z));
    const atRisk = churnProbability >= model.threshold;

    logger.info(
      "ChurnEvaluator",
      `User ${userId} evaluated: prob=${churnProbability.toFixed(4)}, atRisk=${atRisk} (streak=${consecutiveLosses}, abandons=${abandonCount}, ratio=${sessionPlaytimeRatio.toFixed(2)})`
    );

    // 5. Persistir los resultados en el Feature Store
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: new Date(),
        churnScore: churnProbability,
        atRisk,
      },
      update: {
        churnScore: churnProbability,
        atRisk,
        lastActive: new Date(),
      },
    });

    // 6. Limpiar caché del perfil
    await PlayerProfileRepository.clearCache(userId);

    return { churnProbability, atRisk };
  } catch (err) {
    logger.error("ChurnEvaluator", `Failed to evaluate churn for user ${userId}`, err);
    return { churnProbability: 0.0, atRisk: false };
  }
}

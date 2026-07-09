import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";
import fs from "node:fs";
import path from "node:path";

const CHURN_THRESHOLD = 0.6; // Umbral de decaimiento >= 60%

/**
 * Calcula y actualiza el riesgo de churn para un usuario específico.
 */
export async function computeChurnRiskForUser(userId: string): Promise<{ churnScore: number | null; atRisk: boolean }> {
  // 1. Verificar que el usuario exista y tenga >= 3 días registrado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    logger.warn("ChurnPredictor", `User ${userId} not found in operational database.`);
    return { churnScore: null, atRisk: false };
  }

  const daysRegistered = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysRegistered < 3) {
    logger.debug("ChurnPredictor", `Skipping user ${userId} (registered ${daysRegistered.toFixed(1)} days ago, less than 3 days).`);
    
    // Asegurar que no quede como at_risk de ejecuciones anteriores
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: { userId, lastActive: new Date(), churnScore: null, atRisk: false },
      update: { churnScore: null, atRisk: false },
    });
    await PlayerProfileRepository.clearCache(userId);

    return { churnScore: null, atRisk: false };
  }

  // 2. Consultar sesiones (SessionEnd) en los últimos 14 días
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sessions = await analyticsPrisma.rawEvent.findMany({
    where: {
      userId,
      eventType: "SessionEnd",
      timestamp: { gte: fourteenDaysAgo },
    },
    orderBy: { timestamp: "desc" },
  });

  // Requerimos al menos 4 sesiones en total en los últimos 14 días
  // (3 recientes contra al menos 1 histórica)
  if (sessions.length < 4) {
    logger.debug("ChurnPredictor", `User ${userId} has insufficient session history (${sessions.length} sessions). Skipping.`);
    
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: { userId, lastActive: new Date(), churnScore: null, atRisk: false },
      update: { churnScore: null, atRisk: false },
    });
    await PlayerProfileRepository.clearCache(userId);

    return { churnScore: null, atRisk: false };
  }

  // 3. Extraer duraciones
  const durations = sessions.map((s) => {
    const payload = s.payload as any;
    return typeof payload?.durationSeconds === "number" ? payload.durationSeconds : 0;
  });

  // Dividir en recientes (últimas 3) e históricas (anteriores)
  const recentSessions = durations.slice(0, 3);
  const historicalSessions = durations.slice(3);

  const avgRecent = recentSessions.reduce((a, b) => a + b, 0) / 3;
  const avgHistorical = historicalSessions.reduce((a, b) => a + b, 0) / historicalSessions.length;

  let churnScore = 0;
  if (avgHistorical > 0) {
    // Si la media reciente decayó, el score será positivo
    churnScore = Math.max(0, 1 - avgRecent / avgHistorical);
  }

  const atRisk = churnScore >= CHURN_THRESHOLD;

  logger.info(
    "ChurnPredictor",
    `User ${userId} Churn Score: ${churnScore.toFixed(4)} (Avg Recent: ${avgRecent.toFixed(1)}s, Avg Hist: ${avgHistorical.toFixed(1)}s, sessions: ${sessions.length}) -> atRisk: ${atRisk}`
  );

  // 4. Persistir resultado
  await analyticsPrisma.playerFeatures.upsert({
    where: { userId },
    create: {
      userId,
      lastActive: new Date(),
      churnScore,
      atRisk,
    },
    update: {
      churnScore,
      atRisk,
      lastActive: new Date(),
    },
  });

  // 5. Invalidad caché en Redis
  await PlayerProfileRepository.clearCache(userId);

  return { churnScore, atRisk };
}

/**
 * Calcula el riesgo de churn en lote para todos los usuarios registrados hace más de 3 días.
 */
export async function predictAllUsersChurnRisk(): Promise<number> {
  logger.info("ChurnPredictor", "Starting batch churn prediction for all eligible users...");

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const eligibleUsers = await prisma.user.findMany({
    where: {
      createdAt: { lte: threeDaysAgo },
    },
    select: { id: true },
  });

  let computedCount = 0;
  for (const u of eligibleUsers) {
    try {
      await computeChurnRiskForUser(u.id);
      computedCount++;
    } catch (err) {
      logger.error("ChurnPredictor", `Failed to compute churn risk for user ${u.id}`, err);
    }
  }

  logger.info("ChurnPredictor", `Finished batch prediction. Processed ${computedCount} users.`);
  return computedCount;
}

/**
 * Exporta los usuarios actualmente catalogados como atRisk a un archivo CSV.
 */
export async function exportAtRiskUsersToCsv(): Promise<string> {
  const atRiskFeatures = await analyticsPrisma.playerFeatures.findMany({
    where: { atRisk: true },
    select: { userId: true, churnScore: true, lastActive: true },
    orderBy: { churnScore: "desc" },
  });

  if (atRiskFeatures.length === 0) {
    logger.info("ChurnPredictor", "No users currently flagged as at_risk. Exporting empty CSV.");
  }

  const userIds = atRiskFeatures.map((f) => f.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Construir CSV
  const csvHeaders = "userId,username,email,churnScore,lastActive\n";
  const csvLines = atRiskFeatures
    .map((f) => {
      const u = userMap.get(f.userId);
      const scoreStr = f.churnScore !== null ? f.churnScore.toFixed(4) : "0";
      const dateStr = f.lastActive.toISOString();
      return `"${f.userId}","${u?.username || ""}","${u?.email || ""}",${scoreStr},"${dateStr}"`;
    })
    .join("\n");

  const csvContent = csvHeaders + csvLines;

  // Asegurar que el directorio de exports exista
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Archivo único general
  const mainPath = path.join(exportDir, "churn_at_risk_players.csv");
  fs.writeFileSync(mainPath, csvContent, "utf8");

  // Archivo fechado para historial diario
  const todayStr = new Date().toISOString().split("T")[0];
  const historyPath = path.join(exportDir, `churn_at_risk_players_${todayStr}.csv`);
  fs.writeFileSync(historyPath, csvContent, "utf8");

  logger.info("ChurnPredictor", `Successfully exported ${atRiskFeatures.length} at-risk users to ${mainPath}`);

  return mainPath;
}

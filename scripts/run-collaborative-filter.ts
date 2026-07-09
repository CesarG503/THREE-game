import { runCollaborativePipeline } from "../server/analytics/ml/collaborative_filter.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  logger.info("CollaborativeFilterCron", "=== INICIANDO PIPELINE DE FACTORIZACIÓN MATRICIAL OFFLINE (FASE 42) ===");

  try {
    const result = await runCollaborativePipeline();
    logger.info(
      "CollaborativeFilterCron",
      `Pipeline finalizado con éxito. Usuarios entrenados: ${result.numUsers}, Mapas entrenados: ${result.numMaps}, RMSE: ${result.rmse.toFixed(4)}`
    );
    process.exit(0);
  } catch (error) {
    logger.error("CollaborativeFilterCron", "Error ejecutando el pipeline de recomendación offline:", error);
    process.exit(1);
  } finally {
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }
}

void main();

import { predictAllUsersChurnRisk, exportAtRiskUsersToCsv } from "../server/analytics/features/churn_predictor.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    logger.info("ChurnPredictorCron", "Starting daily churn risk classification cron job.");
    
    // 1. Ejecutar predicción
    const processedCount = await predictAllUsersChurnRisk();
    logger.info("ChurnPredictorCron", `Churn prediction processed for ${processedCount} users.`);
    
    // 2. Exportar CSV
    const csvPath = await exportAtRiskUsersToCsv();
    logger.info("ChurnPredictorCron", `Successfully exported at-risk users list to: ${csvPath}`);
    
    logger.info("ChurnPredictorCron", "Daily job completed successfully.");
  } catch (error) {
    logger.error("ChurnPredictorCron", "Error during churn prediction job execution", error);
  } finally {
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

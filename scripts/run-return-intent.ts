import { computeReturnIntentForUser } from "../server/analytics/features/return_intent.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  const lookbackHours = 24;
  const startTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  logger.info("ReturnIntentCron", `Starting IRI batch recalculation for users active in the last ${lookbackHours} hours.`);

  try {
    // Buscar todos los usuarios con eventos de SessionEnd en las últimas 24 horas
    const recentSessionEnds = await analyticsPrisma.rawEvent.findMany({
      where: {
        eventType: "SessionEnd",
        timestamp: { gte: startTime },
        userId: { not: null },
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    });

    if (recentSessionEnds.length === 0) {
      logger.info("ReturnIntentCron", "No users with ended sessions in the lookback window.");
      return;
    }

    logger.info("ReturnIntentCron", `Found ${recentSessionEnds.length} users to update.`);

    for (const record of recentSessionEnds) {
      const userId = record.userId!;
      try {
        await computeReturnIntentForUser(userId);
      } catch (err) {
        logger.error("ReturnIntentCron", `Failed to compute IRI for user ${userId}`, err);
      }
    }

    logger.info("ReturnIntentCron", "Batch calculation completed successfully.");
  } catch (error) {
    logger.error("ReturnIntentCron", "Error running Return Intent batch calculation", error);
  } finally {
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

main();

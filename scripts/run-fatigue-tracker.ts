import { computePlayerFatigue } from "../server/analytics/features/fatigue_tracker.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    await computePlayerFatigue(14); // 14 días de lookback por defecto
    logger.info("FatigueTrackerCron", "Player fatigue calculation completed successfully.");
  } catch (error) {
    logger.error("FatigueTrackerCron", "Error running player fatigue calculation.", error);
  } finally {
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

main();

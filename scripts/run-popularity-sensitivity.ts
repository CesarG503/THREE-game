import { computePopularitySensitivity } from "../server/analytics/features/popularity_sensitivity.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    await computePopularitySensitivity(7); // default 7 days lookback
    logger.info("PopularitySensitivityCron", "Computation successful");
  } catch (error) {
    logger.error("PopularitySensitivityCron", "Error during computation", error);
  } finally {
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

main();

import { computeExplorerProfile } from "../server/analytics/features/explorer_ratio.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    await computeExplorerProfile(7); // Por defecto miramos una ventana de 7 días
    logger.info("ExplorerRatioCron", "Computation successful");
  } catch (error) {
    logger.error("ExplorerRatioCron", "Error during computation", error);
  } finally {
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

main();

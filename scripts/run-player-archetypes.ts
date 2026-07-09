import { revaluateAllPlayerArchetypes } from "../server/analytics/ml/player_archetypes.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    logger.info("PlayerArchetypesCron", "Starting periodic player archetypes revaluation job.");
    const count = await revaluateAllPlayerArchetypes();
    logger.info("PlayerArchetypesCron", `Successfully revaluated player archetypes for ${count} users.`);
  } catch (err) {
    logger.error("PlayerArchetypesCron", "Error running player archetypes revaluation job", err);
  } finally {
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

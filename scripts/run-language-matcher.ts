import { computeAllLanguagePreferences } from "../server/analytics/features/language_matcher.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    logger.info("LanguageMatcherCron", "Starting language preference offline calculation.");
    const count = await computeAllLanguagePreferences(30); // 30 días de lookback
    logger.info("LanguageMatcherCron", `Successfully calculated language preferences for ${count} users.`);
  } catch (error) {
    logger.error("LanguageMatcherCron", "Error during computation", error);
  } finally {
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

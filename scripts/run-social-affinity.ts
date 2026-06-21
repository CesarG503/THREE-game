import { computeSocialAffinity } from "../server/analytics/features/social_affinity.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours lookback

  try {
    await computeSocialAffinity(startTime, endTime);
    logger.info("SocialAffinityCron", "Computation successful");
  } catch (error) {
    logger.error("SocialAffinityCron", "Error during computation", error);
  } finally {
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

main();

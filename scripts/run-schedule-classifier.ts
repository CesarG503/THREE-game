import { classifyAllUsersSchedule } from "../server/analytics/features/schedule_classifier.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  try {
    logger.info("ScheduleClassifierCron", "Starting daily schedule classification cron job.");
    
    const processedCount = await classifyAllUsersSchedule();
    logger.info("ScheduleClassifierCron", `Schedule classification completed for ${processedCount} users.`);
  } catch (error) {
    logger.error("ScheduleClassifierCron", "Error during schedule classification job execution", error);
  } finally {
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

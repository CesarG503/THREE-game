import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis } from "../server/cache/redis.js";
import { logger } from "../server/utils/Logger.js";
import { computeScheduleProfileForUser } from "../server/analytics/features/schedule_profile.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import "dotenv/config";

/**
 * Periodically aggregates user play schedules and warms the Redis profile cache.
 */
export async function runScheduleAggregation(): Promise<void> {
  logger.info("ScheduleAggregation", "Starting player schedule aggregation...");

  try {
    // 1. Get all users in the analytical database
    const users = await analyticsPrisma.user.findMany({
      select: { id: true, username: true },
    });

    if (users.length === 0) {
      logger.info("ScheduleAggregation", "No users found in analytics DB. Exiting aggregation.");
      return;
    }

    logger.info("ScheduleAggregation", `Found ${users.length} users to analyze.`);

    let successCount = 0;
    let skipCount = 0;

    // 2. Compute schedule profile for each user
    for (const user of users) {
      try {
        const profile = await computeScheduleProfileForUser(user.id);
        if (profile) {
          successCount++;
          // Active pre-warming: pull it once to load it into Redis cache
          await PlayerProfileRepository.getProfile(user.id);
        } else {
          skipCount++;
        }
      } catch (userErr) {
        logger.error("ScheduleAggregation", `Failed to aggregate schedule profile for user ${user.username} (${user.id})`, userErr);
      }
    }

    logger.info(
      "ScheduleAggregation",
      `Aggregation run completed. Successfully processed: ${successCount}, Skipped (no sessions): ${skipCount}`
    );
  } catch (err) {
    logger.error("ScheduleAggregation", "Critically failed during schedule aggregation", err);
    throw err;
  }
}

// Allow direct script execution
if (process.argv[1]?.endsWith("run-schedule-aggregation.ts")) {
  const main = async () => {
    await connectRedis();
    await runScheduleAggregation();
    process.exit(0);
  };
  void main();
}

import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";

export interface IScheduleProfile {
  primaryHour: number | null;     // Peak hour (0-23 UTC)
  primaryDay: number | null;      // Peak day of week (0-6 UTC, 0=Sunday)
  hourlyHistogram: number[];      // 24 elements representing session counts per UTC hour
  weeklyHistogram: number[];      // 7 elements representing session counts per UTC day of week
  timezoneOffset: number | null;  // Timezone offset in minutes (if available)
  updatedAt: string;              // ISO Date string
}

/**
 * Computes and persists the schedule profile for a specific user based on SessionStart events.
 */
export async function computeScheduleProfileForUser(userId: string): Promise<IScheduleProfile | null> {
  logger.info("ScheduleProfile", `Computing schedule profile for user: ${userId}`);

  try {
    // 1. Fetch all SessionStart events for the user
    const sessions = await analyticsPrisma.rawEvent.findMany({
      where: {
        userId,
        eventType: "SessionStart",
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    if (sessions.length === 0) {
      logger.warn("ScheduleProfile", `No SessionStart events found for user ${userId}. Skipping.`);
      return null;
    }

    // 2. Initialize histograms
    const hourlyHistogram = Array(24).fill(0);
    const weeklyHistogram = Array(7).fill(0);
    let lastTimezoneOffset: number | null = null;

    // 3. Process events (implicitly in UTC)
    for (const session of sessions) {
      const date = new Date(session.timestamp);
      
      // Increment hour (0-23)
      const hour = date.getUTCHours();
      hourlyHistogram[hour]++;

      // Increment day of week (0-6, where 0 is Sunday, 1 is Monday...)
      const day = date.getUTCDay();
      weeklyHistogram[day]++;

      // Extract timezone offset if present in payload
      const payload = session.payload as any;
      if (payload && typeof payload.timezoneOffset === "number") {
        lastTimezoneOffset = payload.timezoneOffset;
      }
    }

    // 4. Find peak hour and peak day of week
    let maxHourVal = -1;
    let primaryHour: number | null = null;
    for (let h = 0; h < 24; h++) {
      if (hourlyHistogram[h] > maxHourVal) {
        maxHourVal = hourlyHistogram[h];
        primaryHour = h;
      }
    }

    let maxDayVal = -1;
    let primaryDay: number | null = null;
    for (let d = 0; d < 7; d++) {
      if (weeklyHistogram[d] > maxDayVal) {
        maxDayVal = weeklyHistogram[d];
        primaryDay = d;
      }
    }

    // Handle case where all counts are 0 (should not happen since sessions.length > 0)
    if (maxHourVal === 0) primaryHour = null;
    if (maxDayVal === 0) primaryDay = null;

    const scheduleProfile: IScheduleProfile = {
      primaryHour,
      primaryDay,
      hourlyHistogram,
      weeklyHistogram,
      timezoneOffset: lastTimezoneOffset,
      updatedAt: new Date().toISOString(),
    };

    // 5. Persist to PlayerFeatures
    const now = new Date();
    await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: now,
        scheduleProfile: scheduleProfile as any,
      },
      update: {
        lastActive: now,
        scheduleProfile: scheduleProfile as any,
      },
    });

    // 6. Invalidate player cache in Redis to guarantee consistency
    await PlayerProfileRepository.clearCache(userId);

    logger.info(
      "ScheduleProfile",
      `Schedule profile updated for user ${userId}. Peak Hour: ${primaryHour} UTC, Peak Day: ${primaryDay} UTC.`
    );

    return scheduleProfile;
  } catch (err) {
    logger.error("ScheduleProfile", `Failed to compute schedule profile for user ${userId}`, err);
    throw err;
  }
}

/**
 * Predicts the expected concurrency at a specific UTC hour and day of week.
 * Uses a joint probability distribution estimation from active user profiles.
 */
export async function getExpectedConcurrency(hour: number, dayOfWeek: number): Promise<number> {
  if (hour < 0 || hour > 23 || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Invalid hour or day of week parameters.");
  }

  try {
    const profiles = await analyticsPrisma.playerFeatures.findMany({
      select: {
        scheduleProfile: true,
      },
    });

    let expectedConcurrency = 0;

    for (const f of profiles) {
      const sp = f.scheduleProfile as any;
      if (!sp || !Array.isArray(sp.hourlyHistogram) || !Array.isArray(sp.weeklyHistogram)) {
        continue;
      }

      const totalSessions = sp.hourlyHistogram.reduce((sum: number, val: number) => sum + val, 0);
      if (totalSessions === 0) continue;

      const hourlyCount = sp.hourlyHistogram[hour] ?? 0;
      const weeklyCount = sp.weeklyHistogram[dayOfWeek] ?? 0;

      // Probability score: connection likelihood normalized by activity counts
      const pPlaying = (hourlyCount * weeklyCount) / totalSessions;
      expectedConcurrency += pPlaying;
    }

    // Round to 2 decimal places for clean display
    return Math.round(expectedConcurrency * 100) / 100;
  } catch (err) {
    logger.error("ScheduleProfile", `Failed to get expected concurrency for hour ${hour}, day ${dayOfWeek}`, err);
    throw err;
  }
}

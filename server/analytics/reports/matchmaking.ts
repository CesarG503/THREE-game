import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface MatchmakingReport {
  queueStats: {
    totalEntries: number;
    totalExits: number;
    abandonCount: number;
    abandonRate: number; // percentage of cancel_by_user over totalExits
    averageWaitTimeSeconds: number; // overall AWT
    matchedAverageWaitTimeSeconds: number; // AWT for match_found
  };
  matchStats: {
    totalMatchesFormed: number;
    averageLatencyDisparityMs: number;
    medianLatencyDisparityMs: number;
    maxLatencyDisparityMs: number;
    minLatencyDisparityMs: number;
  };
}

function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Calculates matchmaking telemetry metrics over a given date range.
 * Includes AWT (Average Wait Time), queue abandonment rate, and latency disparity.
 */
export async function getMatchmakingMetrics(options: { startDate?: Date; endDate?: Date } = {}): Promise<MatchmakingReport> {
  const { startDate, endDate } = options;

  const params: any[] = [];
  let paramIndex = 1;
  let dateFilters = "";

  if (startDate) {
    dateFilters += ` AND timestamp >= $${paramIndex++}`;
    params.push(startDate);
  }
  if (endDate) {
    dateFilters += ` AND timestamp <= $${paramIndex++}`;
    params.push(endDate);
  }

  // 1. Get QueueEnter count
  const enterSql = `
    SELECT COUNT(*) as count
    FROM analytics."RawEvent"
    WHERE "eventType" = 'QueueEnter'
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const enterRows = await analyticsPrisma.$queryRawUnsafe<{ count: string }[]>(enterSql, ...params);
  const totalEntries = parseInt(enterRows[0]?.count || "0", 10);

  // 2. Get QueueLeave events
  const leaveSql = `
    SELECT 
      payload->>'reason' as reason,
      (payload->>'durationSeconds')::double precision as "durationSeconds"
    FROM analytics."RawEvent"
    WHERE "eventType" = 'QueueLeave'
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const leaveRows = await analyticsPrisma.$queryRawUnsafe<{ reason: string; durationSeconds: number }[]>(leaveSql, ...params);

  // 3. Get MatchFormed events
  const matchSql = `
    SELECT 
      (payload->>'latencyDisparity')::double precision as "latencyDisparity"
    FROM analytics."RawEvent"
    WHERE "eventType" = 'MatchFormed'
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const matchRows = await analyticsPrisma.$queryRawUnsafe<{ latencyDisparity: number }[]>(matchSql, ...params);

  // Calculate queue statistics
  const totalExits = leaveRows.length;
  let abandonCount = 0;
  let totalWaitTime = 0;
  let matchedWaitTime = 0;
  let matchedCount = 0;

  for (const leave of leaveRows) {
    const duration = leave.durationSeconds || 0;
    totalWaitTime += duration;

    if (leave.reason === "cancel_by_user") {
      abandonCount++;
    } else if (leave.reason === "match_found") {
      matchedCount++;
      matchedWaitTime += duration;
    }
  }

  const abandonRate = totalExits > 0 ? Math.round((abandonCount / totalExits) * 10000) / 100 : 0;
  const averageWaitTimeSeconds = totalExits > 0 ? Math.round((totalWaitTime / totalExits) * 100) / 100 : 0;
  const matchedAverageWaitTimeSeconds = matchedCount > 0 ? Math.round((matchedWaitTime / matchedCount) * 100) / 100 : 0;

  // Calculate match statistics
  const totalMatchesFormed = matchRows.length;
  const latencyDisparities = matchRows.map(m => m.latencyDisparity || 0);

  const averageLatencyDisparityMs = totalMatchesFormed > 0
    ? Math.round((latencyDisparities.reduce((sum, val) => sum + val, 0) / totalMatchesFormed) * 100) / 100
    : 0;

  const medianLatencyDisparityMs = totalMatchesFormed > 0
    ? Math.round(getMedian(latencyDisparities) * 100) / 100
    : 0;

  const maxLatencyDisparityMs = totalMatchesFormed > 0 ? Math.max(...latencyDisparities) : 0;
  const minLatencyDisparityMs = totalMatchesFormed > 0 ? Math.min(...latencyDisparities) : 0;

  return {
    queueStats: {
      totalEntries,
      totalExits,
      abandonCount,
      abandonRate,
      averageWaitTimeSeconds,
      matchedAverageWaitTimeSeconds,
    },
    matchStats: {
      totalMatchesFormed,
      averageLatencyDisparityMs,
      medianLatencyDisparityMs,
      maxLatencyDisparityMs,
      minLatencyDisparityMs,
    }
  };
}

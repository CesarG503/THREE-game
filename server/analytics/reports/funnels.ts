import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface FunnelStep {
  step: number;
  name: string;
  count: number;
  conversionRate: number; // overall conversion rate relative to PageLoad
  dropRate: number;       // drop rate relative to the previous step
}

export interface ResourceLoadingMetrics {
  averageLoadTimeSeconds: number;
  medianLoadTimeSeconds: number;
  abandonCount: number;
  abandonRate: number; // percentage of joins that didn't reach start
}

export interface FunnelReport {
  overall: FunnelStep[];
  byDevice: Record<string, FunnelStep[]>;
  resourceLoading: ResourceLoadingMetrics;
}

function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function buildStepsArray(counts: {
  pageLoad: number;
  roomSearch: number;
  matchJoin: number;
  matchStart: number;
  matchEnd: number;
}): FunnelStep[] {
  const stepsData = [
    { name: "PageLoad", count: counts.pageLoad },
    { name: "RoomSearch", count: counts.roomSearch },
    { name: "MatchJoin", count: counts.matchJoin },
    { name: "MatchStart", count: counts.matchStart },
    { name: "MatchEnd", count: counts.matchEnd },
  ];

  return stepsData.map((data, index) => {
    const stepNum = index + 1;
    const overallBase = stepsData[0]!.count;
    const prevBase = index > 0 ? stepsData[index - 1]!.count : data.count;

    const conversionRate = overallBase > 0 ? Math.round((data.count / overallBase) * 10000) / 100 : 0;
    const dropRate = prevBase > 0 ? Math.round(((prevBase - data.count) / prevBase) * 10000) / 100 : 0;

    return {
      step: stepNum,
      name: data.name,
      count: data.count,
      conversionRate,
      dropRate,
    };
  });
}

/**
 * Calculates the multi-step conversion funnel:
 * PageLoad -> RoomSearch -> MatchJoin -> MatchStart -> MatchEnd.
 * Also computes WebGL loading metrics (MatchJoin -> MatchStart duration & abandonment).
 */
export async function getConversionFunnel(options: { startDate?: Date; endDate?: Date } = {}): Promise<FunnelReport> {
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

  const sql = `
    WITH filtered_events AS (
      SELECT
        COALESCE("userId", payload->>'guestId') AS user_id,
        "eventType",
        timestamp,
        COALESCE(payload->>'deviceType', 'desktop') AS device_type,
        payload->>'roomId' AS room_id,
        payload->>'action' AS action
      FROM analytics."RawEvent"
      WHERE 
        ("userId" IS NOT NULL OR payload->>'guestId' IS NOT NULL)
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
        ${dateFilters}
    ),
    step_1 AS (
      -- PageLoad
      SELECT user_id, MIN(timestamp) AS t1, MAX(device_type) AS device_type
      FROM filtered_events
      WHERE "eventType" = 'PageView'
      GROUP BY user_id
    ),
    step_2 AS (
      -- RoomSearch (UiClick with action = play_map, view_room, edit_map)
      SELECT s1.user_id, s1.device_type, MIN(fe.timestamp) AS t2
      FROM filtered_events fe
      JOIN step_1 s1 ON fe.user_id = s1.user_id
      WHERE fe."eventType" = 'UiClick'
        AND fe.action IN ('play_map', 'view_room', 'edit_map')
        AND fe.timestamp > s1.t1
      GROUP BY s1.user_id, s1.device_type
    ),
    step_3 AS (
      -- MatchJoin
      SELECT s2.user_id, s2.device_type, MIN(fe.timestamp) AS t3, fe.room_id
      FROM filtered_events fe
      JOIN step_2 s2 ON fe.user_id = s2.user_id
      WHERE fe."eventType" = 'MatchJoin'
        AND fe.timestamp > s2.t2
      GROUP BY s2.user_id, s2.device_type, fe.room_id
    ),
    step_4 AS (
      -- MatchStart
      SELECT s3.user_id, s3.device_type, MIN(fe.timestamp) AS t4, s3.room_id
      FROM filtered_events fe
      JOIN step_3 s3 ON fe.user_id = s3.user_id AND fe.room_id = s3.room_id
      WHERE fe."eventType" = 'MatchStart'
        AND fe.timestamp > s3.t3
      GROUP BY s3.user_id, s3.device_type, s3.room_id
    ),
    step_5 AS (
      -- MatchEnd
      SELECT s4.user_id, s4.device_type, MIN(fe.timestamp) AS t5
      FROM filtered_events fe
      JOIN step_4 s4 ON fe.user_id = s4.user_id AND fe.room_id = s4.room_id
      WHERE fe."eventType" = 'MatchEnd'
        AND fe.timestamp > s4.t4
      GROUP BY s4.user_id, s4.device_type
    )
    SELECT
      s1.user_id as "userId",
      s1.device_type as "deviceType",
      s1.t1 AS "pageLoadTime",
      s2.t2 AS "roomSearchTime",
      s3.t3 AS "matchJoinTime",
      s4.t4 AS "matchStartTime",
      s5.t5 AS "matchEndTime",
      s3.room_id as "roomId"
    FROM step_1 s1
    LEFT JOIN step_2 s2 ON s1.user_id = s2.user_id
    LEFT JOIN step_3 s3 ON s2.user_id = s3.user_id
    LEFT JOIN step_4 s4 ON s3.user_id = s4.user_id AND s3.room_id = s4.room_id
    LEFT JOIN step_5 s5 ON s4.user_id = s5.user_id;
  `;

  const rows = await analyticsPrisma.$queryRawUnsafe<any[]>(sql, ...params);

  // Aggregators for unique users
  const overallPageLoad = new Set<string>();
  const overallRoomSearch = new Set<string>();
  const overallMatchJoin = new Set<string>();
  const overallMatchStart = new Set<string>();
  const overallMatchEnd = new Set<string>();

  const devicePageLoad: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set() };
  const deviceRoomSearch: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set() };
  const deviceMatchJoin: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set() };
  const deviceMatchStart: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set() };
  const deviceMatchEnd: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set() };

  // WebGL Loading Time helpers
  const loadTimes: number[] = [];
  let abandonCount = 0;
  let totalJoins = 0;

  for (const row of rows) {
    const userId = row.userId;
    const rawDevice = String(row.deviceType).toLowerCase();
    const device = rawDevice === "mobile" ? "mobile" : "desktop";

    // Track steps (ensure we initialize devices properly)
    if (!devicePageLoad[device]) devicePageLoad[device] = new Set();
    if (!deviceRoomSearch[device]) deviceRoomSearch[device] = new Set();
    if (!deviceMatchJoin[device]) deviceMatchJoin[device] = new Set();
    if (!deviceMatchStart[device]) deviceMatchStart[device] = new Set();
    if (!deviceMatchEnd[device]) deviceMatchEnd[device] = new Set();

    overallPageLoad.add(userId);
    devicePageLoad[device]!.add(userId);

    if (row.roomSearchTime) {
      overallRoomSearch.add(userId);
      deviceRoomSearch[device]!.add(userId);
    }

    if (row.matchJoinTime) {
      overallMatchJoin.add(userId);
      deviceMatchJoin[device]!.add(userId);

      // WebGL Loading analysis
      totalJoins++;
      if (row.matchStartTime) {
        const joinTime = new Date(row.matchJoinTime).getTime();
        const startTime = new Date(row.matchStartTime).getTime();
        const durationSeconds = Math.max(0, (startTime - joinTime) / 1000);
        loadTimes.push(durationSeconds);
      } else {
        abandonCount++;
      }
    }

    if (row.matchStartTime) {
      overallMatchStart.add(userId);
      deviceMatchStart[device]!.add(userId);
    }

    if (row.matchEndTime) {
      overallMatchEnd.add(userId);
      deviceMatchEnd[device]!.add(userId);
    }
  }

  // Calculate WebGL Load Time stats
  const averageLoadTimeSeconds = loadTimes.length > 0 
    ? Math.round((loadTimes.reduce((sum, val) => sum + val, 0) / loadTimes.length) * 100) / 100 
    : 0;
  const medianLoadTimeSeconds = loadTimes.length > 0
    ? Math.round(getMedian(loadTimes) * 100) / 100
    : 0;
  const abandonRate = totalJoins > 0 
    ? Math.round((abandonCount / totalJoins) * 10000) / 100 
    : 0;

  // Build final structures
  const overall = buildStepsArray({
    pageLoad: overallPageLoad.size,
    roomSearch: overallRoomSearch.size,
    matchJoin: overallMatchJoin.size,
    matchStart: overallMatchStart.size,
    matchEnd: overallMatchEnd.size,
  });

  const byDevice: Record<string, FunnelStep[]> = {};
  for (const device of ["desktop", "mobile"]) {
    byDevice[device] = buildStepsArray({
      pageLoad: devicePageLoad[device]?.size ?? 0,
      roomSearch: deviceRoomSearch[device]?.size ?? 0,
      matchJoin: deviceMatchJoin[device]?.size ?? 0,
      matchStart: deviceMatchStart[device]?.size ?? 0,
      matchEnd: deviceMatchEnd[device]?.size ?? 0,
    });
  }

  return {
    overall,
    byDevice,
    resourceLoading: {
      averageLoadTimeSeconds,
      medianLoadTimeSeconds,
      abandonCount,
      abandonRate,
    },
  };
}

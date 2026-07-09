import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface CreatorFunnelStep {
  step: number;
  name: string;
  count: number;
  conversionRate: number; // overall conversion rate relative to EditorEnter
  dropRate: number;       // drop rate relative to the previous step
}

export interface CreatorWeeklyRetentionCohort {
  cohortWeek: string; // ISO date string of Monday of that week
  cohortSize: number;
  retention: Record<number, number>; // weekIndex -> count
  retentionRates: Record<number, number>; // weekIndex -> percentage
}

export interface PopularObjectItem {
  objectType: string;
  placedCount: number;
}

export interface CreatorsActivityReport {
  funnel: CreatorFunnelStep[];
  retention: CreatorWeeklyRetentionCohort[];
  popularObjects: PopularObjectItem[];
}

function buildFunnelSteps(counts: {
  editorEnter: number;
  firstBlock: number;
  testRun: number;
  save: number;
  publish: number;
}): CreatorFunnelStep[] {
  const stepsData = [
    { name: "EditorEnter", count: counts.editorEnter },
    { name: "FirstBlock", count: counts.firstBlock },
    { name: "TestRun", count: counts.testRun },
    { name: "Save", count: counts.save },
    { name: "Publish", count: counts.publish },
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
 * Calculates creator activity, funnel conversion steps, weekly cohort retention,
 * and top placed objects in the editor.
 */
export async function getCreatorsActivityReport(options: { startDate?: Date; endDate?: Date } = {}): Promise<CreatorsActivityReport> {
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

  // 1. Calculate Funnel
  const funnelSql = `
    WITH filtered_events AS (
      SELECT
        COALESCE("userId", payload->>'guestId') AS user_id,
        "eventType",
        timestamp,
        payload->>'action' AS action,
        payload->>'state' AS state
      FROM analytics."RawEvent"
      WHERE 
        ("userId" IS NOT NULL OR payload->>'guestId' IS NOT NULL)
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
        ${dateFilters}
    ),
    step_1 AS (
      -- EditorEnter
      SELECT user_id, MIN(timestamp) AS t1
      FROM filtered_events
      WHERE "eventType" = 'EditorSession' AND action = 'open'
      GROUP BY user_id
    ),
    step_2 AS (
      -- FirstBlock
      SELECT s1.user_id, MIN(fe.timestamp) AS t2
      FROM filtered_events fe
      JOIN step_1 s1 ON fe.user_id = s1.user_id
      WHERE fe."eventType" = 'EditorAction'
        AND fe.action = 'place'
        AND fe.timestamp > s1.t1
      GROUP BY s1.user_id
    ),
    step_3 AS (
      -- TestRun (MatchJoin)
      SELECT s2.user_id, MIN(fe.timestamp) AS t3
      FROM filtered_events fe
      JOIN step_2 s2 ON fe.user_id = s2.user_id
      WHERE fe."eventType" = 'MatchJoin'
        AND fe.timestamp > s2.t2
      GROUP BY s2.user_id
    ),
    step_4 AS (
      -- Save (MapStateTransition saved_local)
      SELECT s3.user_id, MIN(fe.timestamp) AS t4
      FROM filtered_events fe
      JOIN step_3 s3 ON fe.user_id = s3.user_id
      WHERE fe."eventType" = 'MapStateTransition'
        AND fe.state = 'saved_local'
        AND fe.timestamp > s3.t3
      GROUP BY s3.user_id
    ),
    step_5 AS (
      -- Publish (MapStateTransition published)
      SELECT s4.user_id, MIN(fe.timestamp) AS t5
      FROM filtered_events fe
      JOIN step_4 s4 ON fe.user_id = s4.user_id
      WHERE fe."eventType" = 'MapStateTransition'
        AND fe.state = 'published'
        AND fe.timestamp > s4.t4
      GROUP BY s4.user_id
    )
    SELECT
      s1.user_id as "userId",
      s1.t1 AS "editorEnterTime",
      s2.t2 AS "firstBlockTime",
      s3.t3 AS "testRunTime",
      s4.t4 AS "saveTime",
      s5.t5 AS "publishTime"
    FROM step_1 s1
    LEFT JOIN step_2 s2 ON s1.user_id = s2.user_id
    LEFT JOIN step_3 s3 ON s2.user_id = s3.user_id
    LEFT JOIN step_4 s4 ON s3.user_id = s4.user_id
    LEFT JOIN step_5 s5 ON s4.user_id = s5.user_id;
  `;

  const funnelRows = await analyticsPrisma.$queryRawUnsafe<any[]>(funnelSql, ...params);

  let editorEnter = 0;
  let firstBlock = 0;
  let testRun = 0;
  let save = 0;
  let publish = 0;

  for (const row of funnelRows) {
    editorEnter++;
    if (row.firstBlockTime) {
      firstBlock++;
      if (row.testRunTime) {
        testRun++;
        if (row.saveTime) {
          save++;
          if (row.publishTime) {
            publish++;
          }
        }
      }
    }
  }

  const funnel = buildFunnelSteps({
    editorEnter,
    firstBlock,
    testRun,
    save,
    publish,
  });

  // 2. Creator Weekly Retention Cohorts
  const retentionSql = `
    WITH creator_first_weeks AS (
      SELECT
        COALESCE("userId", payload->>'guestId') as distinct_id,
        MIN(DATE_TRUNC('week', timestamp)::date) as cohort_week
      FROM analytics."RawEvent"
      WHERE
        "eventType" = 'EditorSession'
        AND payload->>'action' = 'open'
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
        ${dateFilters}
      GROUP BY 1
    ),
    creator_active_weeks AS (
      SELECT DISTINCT
        COALESCE("userId", payload->>'guestId') as distinct_id,
        DATE_TRUNC('week', timestamp)::date as active_week
      FROM analytics."RawEvent"
      WHERE
        "eventType" = 'EditorSession'
        AND payload->>'action' = 'open'
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
        ${dateFilters}
    ),
    retention_deltas AS (
      SELECT
        f.cohort_week,
        f.distinct_id,
        ((a.active_week - f.cohort_week) / 7)::int as week_number
      FROM creator_first_weeks f
      JOIN creator_active_weeks a ON f.distinct_id = a.distinct_id
    )
    SELECT
      cohort_week::text as "cohortWeek",
      week_number as "weekNumber",
      COUNT(DISTINCT distinct_id)::int as "activeCreators"
    FROM retention_deltas
    GROUP BY cohort_week, week_number
    ORDER BY cohort_week DESC, week_number ASC;
  `;

  const retentionRows = await analyticsPrisma.$queryRawUnsafe<any[]>(retentionSql, ...params);

  const groups: Record<string, { cohortWeek: string; cohortSize: number; retention: Record<number, number> }> = {};
  for (const row of retentionRows) {
    const weekStr = row.cohortWeek;
    if (!groups[weekStr]) {
      groups[weekStr] = {
        cohortWeek: weekStr,
        cohortSize: 0,
        retention: {}
      };
    }
    const wkNum = row.weekNumber;
    const count = row.activeCreators;
    groups[weekStr].retention[wkNum] = count;
    if (wkNum === 0) {
      groups[weekStr].cohortSize = count;
    }
  }

  const retention: CreatorWeeklyRetentionCohort[] = Object.values(groups).map((g) => {
    const retentionRates: Record<number, number> = {};
    for (const [wk, count] of Object.entries(g.retention)) {
      const wkNum = Number(wk);
      retentionRates[wkNum] = g.cohortSize > 0 ? Math.round((count / g.cohortSize) * 10000) / 100 : 0;
    }
    return {
      cohortWeek: g.cohortWeek,
      cohortSize: g.cohortSize,
      retention: g.retention,
      retentionRates
    };
  }).sort((a, b) => b.cohortWeek.localeCompare(a.cohortWeek));

  // 3. Most Popular Placed Objects
  const popularObjectsSql = `
    SELECT
      payload->>'objectType' AS "objectType",
      SUM((payload->>'count')::int)::int AS "placedCount"
    FROM analytics."RawEvent"
    WHERE
      "eventType" = 'EditorAction'
      AND payload->>'action' = 'place'
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
    GROUP BY 1
    ORDER BY "placedCount" DESC;
  `;

  const popularObjects = await analyticsPrisma.$queryRawUnsafe<PopularObjectItem[]>(popularObjectsSql, ...params);

  return {
    funnel,
    retention,
    popularObjects
  };
}

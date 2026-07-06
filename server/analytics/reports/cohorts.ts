import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface CohortItem {
  cohortDate: string;
  userType: "registered" | "guest" | "all";
  cohortSize: number;
  retention: Record<number, number>;
  retentionRates: Record<number, number>;
}

/**
 * Calculates cohort retention for registered and/or guest users,
 * excluding traffic flagged as suspicious/bot.
 */
export async function getCohortRetention(filters: { userType?: "registered" | "guest" } = {}): Promise<CohortItem[]> {
  const userTypeFilter = filters.userType;

  // SQL query to calculate first visits (cohort_date) and activity dates per user,
  // excluding suspicious events and calculating retention delta in days.
  const sql = `
    WITH user_first_visits AS (
      SELECT 
        COALESCE("userId", payload->>'guestId') as distinct_id,
        CASE WHEN "userId" IS NOT NULL THEN 'registered' ELSE 'guest' END as user_type,
        MIN(CAST(timestamp AS DATE)) as cohort_date
      FROM analytics."RawEvent"
      WHERE 
        ("userId" IS NOT NULL OR payload->>'guestId' IS NOT NULL)
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      GROUP BY 1, 2
    ),
    user_activities AS (
      SELECT DISTINCT
        COALESCE("userId", payload->>'guestId') as distinct_id,
        CAST(timestamp AS DATE) as activity_date
      FROM analytics."RawEvent"
      WHERE 
        ("userId" IS NOT NULL OR payload->>'guestId' IS NOT NULL)
        AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
    ),
    retention_deltas AS (
      SELECT 
        f.cohort_date,
        f.user_type,
        f.distinct_id,
        (a.activity_date - f.cohort_date) as day_number
      FROM user_first_visits f
      JOIN user_activities a ON f.distinct_id = a.distinct_id
    )
    SELECT 
      cohort_date::text as "cohortDate",
      user_type as "userType",
      day_number as "dayNumber",
      COUNT(DISTINCT distinct_id)::int as "activeUsers"
    FROM retention_deltas
    ${userTypeFilter ? `WHERE user_type = '${userTypeFilter === 'registered' ? 'registered' : 'guest'}'` : ""}
    GROUP BY cohort_date, user_type, day_number
    ORDER BY cohort_date DESC, user_type, day_number ASC;
  `;

  const rows = await analyticsPrisma.$queryRawUnsafe<any[]>(sql);

  // Group by cohortDate + userType
  const groups: Record<string, { cohortDate: string; userType: "registered" | "guest"; cohortSize: number; retention: Record<number, number> }> = {};

  for (const row of rows) {
    const key = `${row.cohortDate}_${row.userType}`;
    if (!groups[key]) {
      groups[key] = {
        cohortDate: row.cohortDate,
        userType: row.userType as "registered" | "guest",
        cohortSize: 0,
        retention: {}
      };
    }
    const day = row.dayNumber;
    const count = row.activeUsers;
    groups[key].retention[day] = count;
    if (day === 0) {
      groups[key].cohortSize = count;
    }
  }

  // Calculate percentages and convert to array
  const items: CohortItem[] = Object.values(groups).map((g) => {
    const retentionRates: Record<number, number> = {};
    for (const [day, count] of Object.entries(g.retention)) {
      const dayNum = Number(day);
      retentionRates[dayNum] = g.cohortSize > 0 ? Math.round((count / g.cohortSize) * 10000) / 100 : 0;
    }
    return {
      cohortDate: g.cohortDate,
      userType: g.userType,
      cohortSize: g.cohortSize,
      retention: g.retention,
      retentionRates
    };
  });

  // If no userType filter is requested, compute the aggregated "all" cohort for each date
  if (!userTypeFilter) {
    const allCohorts: Record<string, { cohortDate: string; cohortSize: number; retention: Record<number, number> }> = {};

    for (const item of items) {
      const date = item.cohortDate;
      if (!allCohorts[date]) {
        allCohorts[date] = {
          cohortDate: date,
          cohortSize: 0,
          retention: {}
        };
      }
      allCohorts[date].cohortSize += item.cohortSize;
      for (const [day, count] of Object.entries(item.retention)) {
        const dayNum = Number(day);
        allCohorts[date].retention[dayNum] = (allCohorts[date].retention[dayNum] || 0) + count;
      }
    }

    const allItems: CohortItem[] = Object.values(allCohorts).map((g) => {
      const retentionRates: Record<number, number> = {};
      for (const [day, count] of Object.entries(g.retention)) {
        const dayNum = Number(day);
        retentionRates[dayNum] = g.cohortSize > 0 ? Math.round((count / g.cohortSize) * 10000) / 100 : 0;
      }
      return {
        cohortDate: g.cohortDate,
        userType: "all",
        cohortSize: g.cohortSize,
        retention: g.retention,
        retentionRates
      };
    });

    items.push(...allItems);
  }

  // Sort: descending by date, then alphabetically by userType
  return items.sort((a, b) => {
    if (a.cohortDate !== b.cohortDate) {
      return b.cohortDate.localeCompare(a.cohortDate);
    }
    return a.userType.localeCompare(b.userType);
  });
}

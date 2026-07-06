import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface AlgorithmCtr {
  algorithm: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface PositionCtr {
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface MapCtr {
  mapId: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CatalogPerformanceReport {
  ctrPerAlgorithm: AlgorithmCtr[];
  ctrPerPosition: PositionCtr[];
  ctrPerMap: MapCtr[];
}

/**
 * Calculates recommendation CTR (Click-Through Rate) metrics over a given date range.
 * CTR is grouped by algorithm model, catalog grid position (to detect bias), and mapId.
 */
export async function getCatalogPerformance(options: { startDate?: Date; endDate?: Date } = {}): Promise<CatalogPerformanceReport> {
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

  // 1. CTR per Algorithm
  const algoSql = `
    SELECT 
      payload->>'algorithm' as algorithm,
      COUNT(CASE WHEN "eventType" = 'UiImpression' THEN 1 END)::integer as impressions,
      COUNT(CASE WHEN "eventType" = 'UiClick' THEN 1 END)::integer as clicks
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('UiImpression', 'UiClick')
      AND payload->>'algorithm' IS NOT NULL
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
    GROUP BY payload->>'algorithm'
  `;
  const algoRows = await analyticsPrisma.$queryRawUnsafe<{ algorithm: string; impressions: number; clicks: number }[]>(algoSql, ...params);

  const ctrPerAlgorithm: AlgorithmCtr[] = algoRows.map(row => {
    const ctr = row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 10000) / 100 : 0;
    return {
      algorithm: row.algorithm,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr
    };
  });

  // 2. CTR per Position (catalogPosition)
  const posSql = `
    SELECT 
      (payload->>'catalogPosition')::integer as position,
      COUNT(CASE WHEN "eventType" = 'UiImpression' THEN 1 END)::integer as impressions,
      COUNT(CASE WHEN "eventType" = 'UiClick' THEN 1 END)::integer as clicks
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('UiImpression', 'UiClick')
      AND payload->>'catalogPosition' IS NOT NULL
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
    GROUP BY (payload->>'catalogPosition')::integer
    ORDER BY position ASC
  `;
  const posRows = await analyticsPrisma.$queryRawUnsafe<{ position: number; impressions: number; clicks: number }[]>(posSql, ...params);

  const ctrPerPosition: PositionCtr[] = posRows.map(row => {
    const ctr = row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 10000) / 100 : 0;
    return {
      position: row.position,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr
    };
  });

  // 3. CTR per Map (mapId)
  const mapSql = `
    SELECT 
      payload->>'mapId' as "mapId",
      COUNT(CASE WHEN "eventType" = 'UiImpression' THEN 1 END)::integer as impressions,
      COUNT(CASE WHEN "eventType" = 'UiClick' THEN 1 END)::integer as clicks
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('UiImpression', 'UiClick')
      AND payload->>'mapId' IS NOT NULL
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
    GROUP BY payload->>'mapId'
  `;
  const mapRows = await analyticsPrisma.$queryRawUnsafe<{ mapId: string; impressions: number; clicks: number }[]>(mapSql, ...params);

  const ctrPerMap: MapCtr[] = mapRows.map(row => {
    const ctr = row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 10000) / 100 : 0;
    return {
      mapId: row.mapId,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr
    };
  });

  return {
    ctrPerAlgorithm,
    ctrPerPosition,
    ctrPerMap
  };
}

import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import { MapProfileRepository } from "../models/MapProfile.js";

export interface IMapViralityStickyResult {
  stickyFactor: number;
  viralityFactor: number;
}

/**
 * Computes the Sticky Factor and Virality Factor for a map.
 * Sticky Factor (S_m) = Weighted DAU_m / MAU_m in the last lookbackDays (default 30).
 * Virality Factor (K_m) = Weighted (invitation rate * conversion rate) per match.
 */
export async function computeMapViralityAndSticky(
  mapId: string,
  lookbackDays = 30
): Promise<IMapViralityStickyResult | null> {
  logger.info("MapVirality", `Computing virality and sticky factor metrics for map: ${mapId}`);

  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    // --- 1. STICKY FACTOR CALCULATION ---
    // Fetch registered user MatchJoin events for the lookback period
    const joinEvents = await analyticsPrisma.rawEvent.findMany({
      where: {
        eventType: "MatchJoin",
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
        userId: { not: null },
      },
      select: {
        userId: true,
        timestamp: true,
        payload: true,
      },
    });

    // Filter events belonging to this map in memory to ensure format compatibility
    const mapJoins = joinEvents.filter((ev) => {
      const payload = ev.payload as any;
      return payload && payload.mapId === mapId;
    });

    const dayUniqueUsers = new Map<number, Set<string>>();
    const allUniqueUsers = new Set<string>();

    for (let i = 0; i < lookbackDays; i++) {
      dayUniqueUsers.set(i, new Set<string>());
    }

    for (const ev of mapJoins) {
      const uid = ev.userId!;
      allUniqueUsers.add(uid);

      const diffMs = endTime.getTime() - ev.timestamp.getTime();
      const daysAgo = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (daysAgo >= 0 && daysAgo < lookbackDays) {
        dayUniqueUsers.get(daysAgo)!.add(uid);
      }
    }

    let weightedDauSum = 0;
    let totalWeight = 0;

    for (let d = 0; d < lookbackDays; d++) {
      const userCount = dayUniqueUsers.get(d)!.size;
      let weight = 0.5;
      if (d <= 2) {
        weight = 3.0; // Last 3 days weighted higher
      } else if (d <= 6) {
        weight = 1.5; // Next 4 days
      }
      weightedDauSum += userCount * weight;
      totalWeight += weight;
    }

    const weightedDau = totalWeight > 0 ? weightedDauSum / totalWeight : 0;
    const mau = allUniqueUsers.size;
    const stickyFactor = mau > 0 ? Math.min(1.0, weightedDau / mau) : 0.0;

    // --- 2. VIRALITY FACTOR (K) CALCULATION ---
    // Fetch matches on this map from the operational DB within the lookback window
    const matches = await prisma.match.findMany({
      where: {
        mapId,
        startedAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      include: {
        players: true,
      },
    });

    let weightedViralitySum = 0;
    let totalMatchWeight = 0;

    for (const match of matches) {
      const diffMs = endTime.getTime() - match.startedAt.getTime();
      const daysAgo = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (daysAgo < 0 || daysAgo >= lookbackDays) continue;

      let weight = 0.5;
      if (daysAgo <= 2) {
        weight = 3.0;
      } else if (daysAgo <= 6) {
        weight = 1.5;
      }

      const P_j = match.players.length;
      if (P_j === 0) {
        totalMatchWeight += weight;
        continue;
      }

      let matchEarlyAbandons = 0;
      const isCompleted = match.status === "FINISHED" || match.endedAt !== null;

      for (const p of match.players) {
        const joinedTime = new Date(p.joinedAt).getTime();
        const leftTime = p.leftAt ? new Date(p.leftAt).getTime() : Date.now();
        const playtimeSeconds = Math.max(0, (leftTime - joinedTime) / 1000);

        const isEarlyLeave = playtimeSeconds < 60;
        const leftBeforeEnd = isCompleted && match.endedAt
          ? (leftTime < new Date(match.endedAt).getTime() - 2000)
          : !isCompleted;

        if (isEarlyLeave && leftBeforeEnd) {
          matchEarlyAbandons++;
        }
      }

      // Conversion rate of players that did not early abandon
      const conversionRate = P_j > 0 ? 1.0 - (matchEarlyAbandons / P_j) : 0.0;
      // Invitation rate proxy: total participants - 1 (the creator/host)
      const invitationCount = Math.max(0, P_j - 1);
      const K_j = invitationCount * conversionRate;

      weightedViralitySum += K_j * weight;
      totalMatchWeight += weight;
    }

    const viralityFactor = totalMatchWeight > 0 ? weightedViralitySum / totalMatchWeight : 0.0;

    const result: IMapViralityStickyResult = {
      stickyFactor: Math.round(stickyFactor * 10000) / 10000,
      viralityFactor: Math.round(viralityFactor * 10000) / 10000,
    };

    // --- 3. PERSISTENCE ---
    await analyticsPrisma.mapFeatures.upsert({
      where: { mapId },
      create: {
        mapId,
        stickyFactor: result.stickyFactor,
        viralityFactor: result.viralityFactor,
      },
      update: {
        stickyFactor: result.stickyFactor,
        viralityFactor: result.viralityFactor,
      },
    });

    // Invalidate Redis profile cache
    await MapProfileRepository.clearCache(mapId);

    logger.info(
      "MapVirality",
      `Successfully calculated virality/sticky for map ${mapId}. ` +
      `Sticky: ${result.stickyFactor}, Virality: ${result.viralityFactor}`
    );

    return result;
  } catch (err) {
    logger.error("MapVirality", `Failed to compute virality and sticky factor for map ${mapId}`, err);
    throw err;
  }
}

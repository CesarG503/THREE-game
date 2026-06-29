import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import { MapProfileRepository } from "../models/MapProfile.js";

export interface IMapDifficultyPaceResult {
  difficultyScore: number | null;
  difficultyLabel: string | null;
  paceScore: number | null; // deaths per minute
  paceLabel: string | null;
  earlyAbandonRate: number;
}

/**
 * Computes the empirical difficulty and game pace for a specific map based on operational telemetry of match player performances.
 */
export async function computeMapDifficultyAndPace(mapId: string): Promise<IMapDifficultyPaceResult | null> {
  logger.info("MapDifficulty", `Computing difficulty and pace metrics for map: ${mapId}`);

  try {
    // 1. Fetch matches and player statistics from the operational DB
    const matches = await prisma.match.findMany({
      where: { mapId },
      include: {
        players: true,
      },
    });

    if (matches.length === 0) {
      logger.warn("MapDifficulty", `No matches found for map ${mapId}. Skipping difficulty calculation.`);
      return null;
    }

    // 2. Compute Difficulty Score (1.0 - Completion Rate)
    const startedMatches = matches.length;
    const completedMatches = matches.filter(
      (m) => m.status === "FINISHED" || m.endedAt !== null
    ).length;

    const difficultyScore = startedMatches > 0 ? 1.0 - completedMatches / startedMatches : 0.0;

    let difficultyLabel = "Medium";
    if (difficultyScore < 0.25) {
      difficultyLabel = "Easy";
    } else if (difficultyScore < 0.60) {
      difficultyLabel = "Medium";
    } else if (difficultyScore < 0.85) {
      difficultyLabel = "Hard";
    } else {
      difficultyLabel = "Brutal";
    }

    // 3. Compute Early Abandonment Rate (players leaving in under 60 seconds without completion)
    let totalPlayersJoined = 0;
    let earlyAbandonCount = 0;

    let totalDeaths = 0;
    let totalInteractions = 0;
    let totalPlaytimeSeconds = 0;

    for (const match of matches) {
      const isCompleted = match.status === "FINISHED" || match.endedAt !== null;
      
      for (const player of match.players) {
        totalPlayersJoined++;

        // Calculate playtime
        const joinedTime = new Date(player.joinedAt).getTime();
        const leftTime = player.leftAt ? new Date(player.leftAt).getTime() : Date.now();
        const playtimeSeconds = Math.max(0, (leftTime - joinedTime) / 1000);
        totalPlaytimeSeconds += playtimeSeconds;

        // Early abandonment check: left under 60 seconds and did not complete match
        const isEarlyLeave = playtimeSeconds < 60;
        const leftBeforeEnd = isCompleted && match.endedAt 
          ? (leftTime < new Date(match.endedAt).getTime() - 2000) 
          : !isCompleted;

        if (isEarlyLeave && leftBeforeEnd) {
          earlyAbandonCount++;
        }

        // Aggregate statistics from player.stats
        if (player.stats) {
          const stats = player.stats as any;
          if (typeof stats.deaths === "number") {
            totalDeaths += stats.deaths;
          }
          if (typeof stats.interactions === "number") {
            totalInteractions += stats.interactions;
          } else if (typeof stats.actions === "number") {
            totalInteractions += stats.actions;
          }
        }
      }
    }

    const earlyAbandonRate = totalPlayersJoined > 0 ? earlyAbandonCount / totalPlayersJoined : 0.0;

    // 4. Compute Pace (Deaths per minute / Interactions per minute)
    const playtimeMinutes = totalPlaytimeSeconds / 60;
    const deathsPerMinute = playtimeMinutes > 0 ? totalDeaths / playtimeMinutes : 0.0;
    const interactionsPerMinute = playtimeMinutes > 0 ? totalInteractions / playtimeMinutes : 0.0;

    // We store deathsPerMinute as the primary paceScore
    const paceScore = deathsPerMinute;

    let paceLabel = "Chill";
    if (deathsPerMinute >= 4.0 || interactionsPerMinute >= 60.0) {
      paceLabel = "Bullet-Hell";
    } else if (deathsPerMinute >= 1.5 || interactionsPerMinute >= 30.0) {
      paceLabel = "Intense";
    } else if (deathsPerMinute >= 0.5 || interactionsPerMinute >= 10.0) {
      paceLabel = "Moderate";
    } else {
      paceLabel = "Chill";
    }

    const result: IMapDifficultyPaceResult = {
      difficultyScore: Math.round(difficultyScore * 10000) / 10000,
      difficultyLabel,
      paceScore: Math.round(paceScore * 100) / 100,
      paceLabel,
      earlyAbandonRate: Math.round(earlyAbandonRate * 10000) / 10000,
    };

    // 5. Persist to analytics database (MapFeatures)
    await analyticsPrisma.mapFeatures.upsert({
      where: { mapId },
      create: {
        mapId,
        difficultyScore: result.difficultyScore,
        difficultyLabel: result.difficultyLabel,
        paceScore: result.paceScore,
        paceLabel: result.paceLabel,
        earlyAbandonRate: result.earlyAbandonRate,
      },
      update: {
        difficultyScore: result.difficultyScore,
        difficultyLabel: result.difficultyLabel,
        paceScore: result.paceScore,
        paceLabel: result.paceLabel,
        earlyAbandonRate: result.earlyAbandonRate,
      },
    });

    // 6. Invalidate Map Profile Cache in Redis
    await MapProfileRepository.clearCache(mapId);

    logger.info(
      "MapDifficulty",
      `Successfully calculated difficulty/pace for map ${mapId}. ` +
      `Diff: ${result.difficultyLabel} (${result.difficultyScore}), ` +
      `Pace: ${result.paceLabel} (${result.paceScore}), ` +
      `Abandon Rate: ${result.earlyAbandonRate}`
    );

    return result;
  } catch (err) {
    logger.error("MapDifficulty", `Failed to compute difficulty and pace for map ${mapId}`, err);
    throw err;
  }
}

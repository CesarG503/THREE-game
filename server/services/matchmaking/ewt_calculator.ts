import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

export type SkillBracket = "LOW" | "MEDIUM" | "HIGH";

export const BASE_WAIT_SECONDS = 30;
export const TICK_INTERVAL_SECONDS = 2;

export function getSkillBracket(skillScore?: number): SkillBracket {
  const score = skillScore ?? 0.40;
  if (score <= 0.35) return "LOW";
  if (score <= 0.65) return "MEDIUM";
  return "HIGH";
}

export interface EWTResult {
  estimatedWaitMs: number;
  estimatedWaitRange: string;
  minSeconds: number;
  maxSeconds: number;
}

export class EWTCalculator {
  // Key: region:gameMode:bracket -> array of recent wait times (newest first)
  private history = new Map<string, number[]>();
  // Precomputed averages and standard deviations
  private averages = new Map<string, number>();
  private stdDevs = new Map<string, number>();

  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the calculator, starts the periodic background sync
   */
  public async start() {
    await this.syncFromDatabase();
    
    // Periodically sync every 2 minutes
    this.updateInterval = setInterval(() => {
      this.syncFromDatabase().catch((err) => {
        logger.error("EWTCalculator", "Failed to sync wait times from database", err);
      });
    }, 120_000);
    logger.info("EWTCalculator", "Started. Periodic sync active every 120s.");
  }

  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info("EWTCalculator", "Stopped.");
  }

  /**
   * Pulls the last 1000 QueueLeave (match_found) events from the database
   * to build the initial weighted moving average caches.
   */
  public async syncFromDatabase() {
    try {
      const events = await analyticsPrisma.rawEvent.findMany({
        where: {
          eventType: "QueueLeave",
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1000,
        select: {
          payload: true,
        },
      });

      const newHistory = new Map<string, number[]>();

      for (const event of events) {
        const payload = event.payload as any;
        if (!payload || payload.reason !== "match_found") continue;

        const region = payload.region ?? "us-east";
        const gameMode = payload.gameMode ?? "FFA";
        const skillScore = payload.skillScore !== undefined ? Number(payload.skillScore) : 0.40;
        const bracket = getSkillBracket(skillScore);
        const duration = payload.durationSeconds !== undefined ? Number(payload.durationSeconds) : BASE_WAIT_SECONDS;

        const key = `${region}:${gameMode}:${bracket}`;
        if (!newHistory.has(key)) {
          newHistory.set(key, []);
        }

        const list = newHistory.get(key)!;
        if (list.length < 50) {
          list.push(duration);
        }
      }

      this.history = newHistory;
      this.recalculateAll();
      logger.info("EWTCalculator", `Successfully synced wait times history. Tracked keys: ${this.history.size}`);
    } catch (err) {
      logger.error("EWTCalculator", "Error during DB sync", err);
    }
  }

  /**
   * Records a new matched wait time in-memory in real-time when a match forms.
   */
  public recordMatchedWaitTime(region: string, gameMode: string, skillScore: number, durationSeconds: number) {
    const bracket = getSkillBracket(skillScore);
    const key = `${region}:${gameMode}:${bracket}`;

    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    const list = this.history.get(key)!;
    list.unshift(durationSeconds); // Add to beginning (newest first)
    if (list.length > 50) {
      list.pop(); // Keep only latest 50
    }

    this.recalculateKey(key);
    logger.info("EWTCalculator", `Recorded real-time wait time for ${key}: ${durationSeconds}s. New average: ${this.averages.get(key)?.toFixed(1)}s`);
  }

  /**
   * Calculates Estimated Wait Time (EWT) for a given region, mode, skill score, and current queue state.
   */
  public calculateEWT(
    region: string,
    gameMode: string,
    skillScore?: number,
    currentQueueSize = 0,
    minPlayers = 2
  ): EWTResult {
    // 1. Dynamic check: if the queue is almost full, wait time is very short
    if (currentQueueSize >= minPlayers - 1) {
      return {
        estimatedWaitMs: TICK_INTERVAL_SECONDS * 1000,
        estimatedWaitRange: `${TICK_INTERVAL_SECONDS}-${TICK_INTERVAL_SECONDS * 3}s`,
        minSeconds: TICK_INTERVAL_SECONDS,
        maxSeconds: TICK_INTERVAL_SECONDS * 3,
      };
    }

    const bracket = getSkillBracket(skillScore);
    const key = `${region}:${gameMode}:${bracket}`;

    let avg = this.averages.get(key);
    let stdDev = this.stdDevs.get(key) ?? 5;

    // Fallback 1: average across all skill brackets in the same region & mode
    if (avg === undefined) {
      let sum = 0;
      let count = 0;
      for (const b of ["LOW", "MEDIUM", "HIGH"] as SkillBracket[]) {
        const k = `${region}:${gameMode}:${b}`;
        const val = this.averages.get(k);
        if (val !== undefined) {
          sum += val;
          count++;
        }
      }
      if (count > 0) {
        avg = sum / count;
      }
    }

    // Fallback 2: base default
    if (avg === undefined) {
      avg = BASE_WAIT_SECONDS;
    }

    // Calculate safety margin range
    const minSec = Math.max(3, Math.round(avg - stdDev - 2));
    const maxSec = Math.round(avg + stdDev + 5);

    return {
      estimatedWaitMs: Math.round(avg * 1000),
      estimatedWaitRange: `${minSec}-${maxSec}s`,
      minSeconds: minSec,
      maxSeconds: maxSec,
    };
  }

  private recalculateAll() {
    this.averages.clear();
    this.stdDevs.clear();
    for (const key of this.history.keys()) {
      this.recalculateKey(key);
    }
  }

  private recalculateKey(key: string) {
    const list = this.history.get(key);
    if (!list || list.length === 0) return;

    // Calculate WMA (Weighted Moving Average) where newest has higher weight
    // For a list of size L, index j has weight L - j
    const L = list.length;
    let weightSum = 0;
    let weightedValueSum = 0;

    for (let j = 0; j < L; j++) {
      const weight = L - j;
      weightSum += weight;
      weightedValueSum += list[j]! * weight;
    }

    const wma = weightedValueSum / weightSum;
    this.averages.set(key, wma);

    // Calculate standard deviation (using simple average for SD to capture volatility)
    const simpleAvg = list.reduce((s, v) => s + v, 0) / L;
    const variance = list.reduce((s, v) => s + Math.pow(v - simpleAvg, 2), 0) / L;
    const stdDev = Math.sqrt(variance);
    this.stdDevs.set(key, stdDev);
  }
}

export const ewtCalculator = new EWTCalculator();

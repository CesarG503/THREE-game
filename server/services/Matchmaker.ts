import { logger } from "../utils/Logger.js";
import { getRedis } from "../cache/redis.js";
import { groupByAffinity, type AffinityGroup, getLanguageCompatibility, scoreTicketPair } from "./matchmaking/skill_matcher.js";
import { getThresholdsForWaitTime } from "./matchmaking/bucket_expander.js";
import { eventBuffer } from "../analytics/eventBuffer.js";
import { ewtCalculator } from "./matchmaking/ewt_calculator.js";
import crypto from "node:crypto";

// ── Configuration ─────────────────────────────────────────────────────────────

const MIN_PLAYERS = 2;
const MAX_PLAYERS_PER_ROOM = 8;
const TICK_INTERVAL_MS = 2000;
const REGIONAL_WAIT_MS = 30_000;
const GLOBAL_FALLBACK_MS = 60_000;

export const REGIONS = ["us-east", "eu-west", "sa-east", "asia-east"] as const;
export type Region = (typeof REGIONS)[number];

/**
 * Adjacent regions per origin, ordered by latency proximity.
 */
const ADJACENT_REGIONS: Record<string, string[]> = {
  "us-east": ["eu-west", "sa-east"],
  "eu-west": ["us-east", "sa-east"],
  "sa-east": ["us-east", "eu-west"],
  "asia-east": ["sa-east", "eu-west"],
};

/**
 * Latency matrix (ms) between client region and map/room server region.
 * Reused from QualityFilter for consistency.
 */
const LATENCY_MATRIX: Record<string, Record<string, number>> = {
  "us-east": { "us-east": 20, "eu-west": 90, "sa-east": 120, "asia-east": 220 },
  "eu-west": { "us-east": 90, "eu-west": 15, "sa-east": 180, "asia-east": 250 },
  "sa-east": { "us-east": 120, "eu-west": 180, "sa-east": 30, "asia-east": 310 },
  "asia-east": { "us-east": 220, "eu-west": 250, "sa-east": 310, "asia-east": 25 },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchTicket {
  ticketId: string;
  userId: string | null;
  playerId: string | null;
  region: string;
  mapId: string | null;
  joinedAt: number;
  /** Player skill score (win rate 0.0–1.0). Optional for backward compat. */
  skillScore?: number;
  /** Player preferred language (es, en, fr, de). Optional for backward compat. */
  preferredLanguage?: string;
  /** Optional callback invoked when a match is found */
  onMatchFound?: (result: MatchResult) => void;
}

export interface MatchResult {
  roomId: string;
  region: string;
  players: { ticketId: string; userId: string | null; playerId: string | null }[];
  averageLatency: number;
  /** Skill disparity within the room (max - min skill). Lower is better. */
  skillDisparity: number;
  /** Fraction of pairwise language-compatible players. Higher is better. */
  languageHomogeneity: number;
}

export interface QueueStatus {
  region: string;
  size: number;
  oldestWaitMs: number;
}

// ── Matchmaker Service ────────────────────────────────────────────────────────

export class MatchmakingQueue {
  /** Regional queues: region → tickets (ordered by joinedAt) */
  private queues = new Map<string, MatchTicket[]>();
  /** Fast ticket lookup by ticketId */
  private ticketIndex = new Map<string, MatchTicket>();
  /** Formed matches history (recent) */
  private recentMatches: MatchResult[] = [];

  private matchedTickets = new Map<string, MatchResult>();
  private tickTimer: NodeJS.Timeout | null = null;
  private readonly redisPrefix = "mm:queue:";

  constructor() {
    // Pre-initialize queues for all known regions
    for (const region of REGIONS) {
      this.queues.set(region, []);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        logger.error("Matchmaker", "Error during tick", err);
      }
    }, TICK_INTERVAL_MS);
    logger.info("Matchmaker", `Started. Tick every ${TICK_INTERVAL_MS}ms, MIN=${MIN_PLAYERS}, MAX=${MAX_PLAYERS_PER_ROOM}`);
  }

  public stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    logger.info("Matchmaker", "Stopped.");
  }

  // ── Queue Operations ──────────────────────────────────────────────────────

  /**
   * Adds a player to the regional matchmaking queue.
   * Returns the generated ticketId.
   */
  public joinQueue(options: {
    userId?: string | null;
    playerId?: string | null;
    region?: string;
    mapId?: string | null;
    skillScore?: number;
    preferredLanguage?: string;
    onMatchFound?: (result: MatchResult) => void;
  }): { ticketId: string; region: string; queuePosition: number } {
    const region = this.normalizeRegion(options.region);
    const ticketId = `mm-${crypto.randomUUID()}`;

    const ticket: MatchTicket = {
      ticketId,
      userId: options.userId ?? null,
      playerId: options.playerId ?? null,
      region,
      mapId: options.mapId ?? null,
      joinedAt: Date.now(),
      skillScore: options.skillScore,
      preferredLanguage: options.preferredLanguage,
      onMatchFound: options.onMatchFound,
    };

    // Add to regional queue
    const queue = this.getOrCreateQueue(region);
    queue.push(ticket);
    this.ticketIndex.set(ticketId, ticket);

    // Try to sync to Redis
    this.syncTicketToRedis(ticket).catch(() => {});

    const queuePosition = queue.length;
    logger.info("Matchmaker", `Ticket ${ticketId} joined queue ${region}. Skill: ${ticket.skillScore ?? 'N/A'}, Lang: ${ticket.preferredLanguage ?? 'N/A'}, Position: ${queuePosition}`);

    // Telemetry: QueueEnter
    try {
      eventBuffer.push({
        id: crypto.randomUUID(),
        eventType: "QueueEnter",
        userId: ticket.userId,
        timestamp: new Date(ticket.joinedAt),
        payload: {
          queueId: ticket.ticketId,
          latency: LATENCY_MATRIX[ticket.region]?.[ticket.region] ?? 20,
          mode: "FFA",
          region: ticket.region,
          skillScore: ticket.skillScore,
          preferredLanguage: ticket.preferredLanguage,
          gameMode: "FFA",
        },
      });
    } catch (err) {
      logger.warn("Matchmaker", `Failed to record telemetry for ticket join ${ticketId}`, err);
    }

    return { ticketId, region, queuePosition };
  }

  /**
   * Removes a player from the matchmaking queue.
   * Returns true if the ticket was found and removed.
   */
  public leaveQueue(ticketId: string): boolean {
    const ticket = this.ticketIndex.get(ticketId);
    if (!ticket) return false;

    const queue = this.queues.get(ticket.region);
    if (queue) {
      const idx = queue.findIndex((t) => t.ticketId === ticketId);
      if (idx !== -1) queue.splice(idx, 1);
    }

    this.ticketIndex.delete(ticketId);
    this.removeTicketFromRedis(ticketId).catch(() => {});

    logger.info("Matchmaker", `Ticket ${ticketId} left queue ${ticket.region}.`);

    // Telemetry: QueueLeave (cancel_by_user)
    try {
      const durationSeconds = (Date.now() - ticket.joinedAt) / 1000;
      eventBuffer.push({
        id: crypto.randomUUID(),
        eventType: "QueueLeave",
        userId: ticket.userId,
        timestamp: new Date(),
        payload: {
          queueId: ticket.ticketId,
          reason: "cancel_by_user",
          durationSeconds: Math.round(durationSeconds * 100) / 100,
          region: ticket.region,
          skillScore: ticket.skillScore,
          preferredLanguage: ticket.preferredLanguage,
          gameMode: "FFA",
        },
      });
    } catch (err) {
      logger.warn("Matchmaker", `Failed to record telemetry for ticket leave ${ticketId}`, err);
    }

    return true;
  }

  // ── Tick Logic ────────────────────────────────────────────────────────────

  /**
   * Periodic evaluation of all queues. Called every TICK_INTERVAL_MS.
   * Uses dynamically expanding search buckets per player based on wait time.
   */
  public tick(): MatchResult[] {
    const now = Date.now();
    const results: MatchResult[] = [];

    // 1. Gather all active tickets across all queues, sorted by wait time descending (oldest first)
    const allTickets = Array.from(this.ticketIndex.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt
    );

    const matchedTicketIds = new Set<string>();

    for (const anchor of allTickets) {
      if (matchedTicketIds.has(anchor.ticketId)) continue;

      const anchorWaitTime = now - anchor.joinedAt;
      const anchorThresholds = getThresholdsForWaitTime(anchorWaitTime);

      // Determine which host regions are candidate hosts for the anchor.
      // We prioritize regions: anchor's home region first, then others by latency ascending.
      const candidateHostRegions = [...REGIONS].sort((r1, r2) => {
        if (r1 === anchor.region) return -1;
        if (r2 === anchor.region) return 1;
        const lat1 = LATENCY_MATRIX[anchor.region]?.[r1] ?? 999;
        const lat2 = LATENCY_MATRIX[anchor.region]?.[r2] ?? 999;
        return lat1 - lat2;
      });

      let roomFormed = false;

      for (const hostRegion of candidateHostRegions) {
        // Verify anchor latency to hostRegion is within their current threshold
        const anchorLatency = LATENCY_MATRIX[anchor.region]?.[hostRegion] ?? 999;
        if (anchorLatency > anchorThresholds.maxLatency || anchorLatency > 250) {
          continue; // anchor cannot play in this region yet
        }

        // Gather all other unmatched candidates that can also play on this host region
        const potentialPlayers: MatchTicket[] = [];

        for (const candidate of allTickets) {
          if (candidate.ticketId === anchor.ticketId) continue;
          if (matchedTicketIds.has(candidate.ticketId)) continue;

          const candWaitTime = now - candidate.joinedAt;
          const candThresholds = getThresholdsForWaitTime(candWaitTime);

          const candLatency = LATENCY_MATRIX[candidate.region]?.[hostRegion] ?? 999;
          // Latency must be within the maximum of anchor and candidate allowed thresholds, and under hard limit 250ms
          const maxAllowedLatency = Math.max(anchorThresholds.maxLatency, candThresholds.maxLatency);
          if (candLatency <= maxAllowedLatency && candLatency <= 250) {
            potentialPlayers.push(candidate);
          }
        }

        // We need at least MIN_PLAYERS - 1 candidates to form a room
        if (potentialPlayers.length < MIN_PLAYERS - 1) {
          continue;
        }

        // Filter potential players by skill disparity and language compatibility.
        // We use the most relaxed threshold between the anchor and the candidate (symmetric relaxation).
        const compatibleCandidates = potentialPlayers.filter((candidate) => {
          const candWaitTime = now - candidate.joinedAt;
          const candThresholds = getThresholdsForWaitTime(candWaitTime);

          // Skill disparity check
          const skillA = anchor.skillScore ?? 0.4;
          const skillB = candidate.skillScore ?? 0.4;
          const skillDiff = Math.abs(skillA - skillB);
          const maxSkillDisp = Math.max(
            anchorThresholds.maxSkillDisparity,
            candThresholds.maxSkillDisparity
          );
          if (skillDiff > maxSkillDisp) return false;

          // Language compatibility check
          const langCompat = (!anchor.preferredLanguage || !candidate.preferredLanguage)
            ? 1.0
            : getLanguageCompatibility(
                anchor.preferredLanguage,
                candidate.preferredLanguage
              );
          const minLangCompat = Math.min(
            anchorThresholds.minLanguageCompatibility,
            candThresholds.minLanguageCompatibility
          );
          if (langCompat < minLangCompat) return false;

          return true;
        });

        // Check if we still have enough players
        if (compatibleCandidates.length >= MIN_PLAYERS - 1) {
          // Sort candidates by affinity to the anchor (highest score first)
          compatibleCandidates.sort(
            (c1, c2) => scoreTicketPair(anchor, c2) - scoreTicketPair(anchor, c1)
          );

          // Take up to MAX_PLAYERS_PER_ROOM - 1 compatible candidates
          const selectedCandidates = compatibleCandidates.slice(
            0,
            MAX_PLAYERS_PER_ROOM - 1
          );
          const roomTickets = [anchor, ...selectedCandidates];

          // Form the room on hostRegion
          const matchResult = this.formRoom(roomTickets, hostRegion);
          results.push(matchResult);

          // Mark tickets as matched
          for (const t of roomTickets) {
            matchedTicketIds.add(t.ticketId);
          }

          roomFormed = true;
          break; // Stop evaluating host regions for this anchor, move to next anchor
        }
      }

      if (roomFormed) {
        // Move to next anchor
      }
    }

    // 2. Synchronize regional queues by removing matched tickets from them
    for (const [region, queue] of this.queues.entries()) {
      const remaining = queue.filter((t) => this.ticketIndex.has(t.ticketId));
      this.queues.set(region, remaining);
    }

    return results;
  }

  // ── Room Formation ────────────────────────────────────────────────────────

  private formRoom(tickets: MatchTicket[], hostRegion: string): MatchResult {
    const roomId = `mm-room-${crypto.randomUUID().slice(0, 8)}`;

    // Calculate average latency for the formed room
    const latencies = tickets.map((t) => {
      const regionLatencies = LATENCY_MATRIX[t.region] ?? LATENCY_MATRIX["us-east"]!;
      return regionLatencies[hostRegion] ?? 150;
    });
    const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    // Calculate skill disparity
    const skills = tickets.map((t) => t.skillScore ?? 0.4);
    const minSkill = Math.min(...skills);
    const maxSkill = Math.max(...skills);
    const skillDisparity = Math.round((maxSkill - minSkill) * 1000) / 1000;

    // Calculate language homogeneity
    let compatPairs = 0;
    let totalPairs = 0;
    for (let i = 0; i < tickets.length; i++) {
      for (let j = i + 1; j < tickets.length; j++) {
        totalPairs++;
        const l1 = tickets[i]!.preferredLanguage;
        const l2 = tickets[j]!.preferredLanguage;
        if (!l1 || !l2 || l1 === l2) compatPairs++;
        else {
          // Partial compatibility check (fallback languages)
          const fallbacks: Record<string, string[]> = { es: ["en"], fr: ["en"], de: ["en"], en: [] };
          const fb1 = fallbacks[l1] ?? [];
          const fb2 = fallbacks[l2] ?? [];
          if (fb1.includes(l2) || fb2.includes(l1) || l1 === "en" || l2 === "en") compatPairs++;
        }
      }
    }
    const languageHomogeneity = totalPairs > 0 ? Math.round((compatPairs / totalPairs) * 1000) / 1000 : 1.0;

    const result: MatchResult = {
      roomId,
      region: hostRegion,
      players: tickets.map((t) => ({
        ticketId: t.ticketId,
        userId: t.userId,
        playerId: t.playerId,
      })),
      averageLatency: Math.round(averageLatency),
      skillDisparity,
      languageHomogeneity,
    };

    // Remove from index and notify
    for (const ticket of tickets) {
      this.ticketIndex.delete(ticket.ticketId);
      this.removeTicketFromRedis(ticket.ticketId).catch(() => {});
      this.setMatchedTicket(ticket.ticketId, result);

      // Telemetry: QueueLeave (match_found)
      try {
        const durationSeconds = (Date.now() - ticket.joinedAt) / 1000;
        eventBuffer.push({
          id: crypto.randomUUID(),
          eventType: "QueueLeave",
          userId: ticket.userId,
          timestamp: new Date(),
          payload: {
            queueId: ticket.ticketId,
            reason: "match_found",
            durationSeconds: Math.round(durationSeconds * 100) / 100,
            region: ticket.region,
            skillScore: ticket.skillScore,
            preferredLanguage: ticket.preferredLanguage,
            gameMode: "FFA",
          },
        });

        // Record real-time wait time in the EWT calculator
        ewtCalculator.recordMatchedWaitTime(
          ticket.region,
          "FFA",
          ticket.skillScore ?? 0.40,
          durationSeconds
        );
      } catch (err) {
        logger.warn("Matchmaker", `Failed to record telemetry for ticket leave ${ticket.ticketId}`, err);
      }

      if (ticket.onMatchFound) {
        try {
          ticket.onMatchFound(result);
        } catch (err) {
          logger.error("Matchmaker", `Error notifying ticket ${ticket.ticketId}`, err);
        }
      }
    }

    // Telemetry: MatchFormed
    try {
      const pings = tickets.map((t) => LATENCY_MATRIX[t.region]?.[hostRegion] ?? 150);
      const maxPing = Math.max(...pings);
      const minPing = Math.min(...pings);
      const latencyDisparity = maxPing - minPing;

      eventBuffer.push({
        id: crypto.randomUUID(),
        eventType: "MatchFormed",
        userId: null,
        timestamp: new Date(),
        payload: {
          matchId: roomId,
          queueIds: tickets.map((t) => t.ticketId),
          latencyDisparity,
          playerPings: pings,
        },
      });
    } catch (err) {
      logger.warn("Matchmaker", `Failed to record telemetry for MatchFormed ${roomId}`, err);
    }

    this.recentMatches.push(result);
    // Keep only last 50 matches
    if (this.recentMatches.length > 50) {
      this.recentMatches.shift();
    }

    logger.info(
      "Matchmaker",
      `Room formed: ${roomId} in ${hostRegion} with ${tickets.length} players. ` +
      `Avg latency: ${result.averageLatency}ms, Skill disparity: ${skillDisparity}, Lang homogeneity: ${languageHomogeneity}`
    );

    return result;
  }

  // ── Merge Strategies ──────────────────────────────────────────────────────

  /**
   * Merge adjacent regions (latency ≤ 150ms between source and adjacent).
   * Drains tickets from the source and adjacent queues.
   */
  private mergeAdjacent(sourceRegion: string): MatchTicket[] {
    const sourceQueue = this.queues.get(sourceRegion);
    if (!sourceQueue) return [];

    const merged: MatchTicket[] = [...sourceQueue];
    sourceQueue.length = 0;

    const adjacentRegions = ADJACENT_REGIONS[sourceRegion] ?? [];
    for (const adj of adjacentRegions) {
      const latency = LATENCY_MATRIX[sourceRegion]?.[adj] ?? 999;
      if (latency > 150) continue;

      const adjQueue = this.queues.get(adj);
      if (!adjQueue || adjQueue.length === 0) continue;

      merged.push(...adjQueue);
      adjQueue.length = 0;
    }

    logger.info(
      "Matchmaker",
      `Adjacent merge for ${sourceRegion}: collected ${merged.length} tickets from adjacent regions.`
    );

    return merged;
  }

  /**
   * Merge all regions globally. Drains all queues.
   */
  private mergeGlobal(sourceRegion: string): MatchTicket[] {
    const merged: MatchTicket[] = [];

    // Start with source region
    const sourceQueue = this.queues.get(sourceRegion);
    if (sourceQueue) {
      merged.push(...sourceQueue);
      sourceQueue.length = 0;
    }

    // Then all other regions
    for (const region of REGIONS) {
      if (region === sourceRegion) continue;
      const queue = this.queues.get(region);
      if (!queue || queue.length === 0) continue;
      merged.push(...queue);
      queue.length = 0;
    }

    logger.info(
      "Matchmaker",
      `Global merge from ${sourceRegion}: collected ${merged.length} tickets total.`
    );

    return merged;
  }

  /**
   * Returns a ticket back to its original regional queue.
   */
  private returnTicketToQueue(ticket: MatchTicket): void {
    const queue = this.getOrCreateQueue(ticket.region);
    queue.push(ticket);
  }

  // ── Status & Diagnostics ──────────────────────────────────────────────────

  /**
   * Returns the current status of all matchmaking queues.
   */
  public getQueueStatus(): {
    queues: QueueStatus[];
    totalWaiting: number;
    recentMatchCount: number;
  } {
    const now = Date.now();
    const queues: QueueStatus[] = [];
    let totalWaiting = 0;

    for (const region of REGIONS) {
      const queue = this.queues.get(region) ?? [];
      const oldestWaitMs = queue.length > 0 && queue[0]
        ? now - queue[0].joinedAt
        : 0;

      queues.push({
        region,
        size: queue.length,
        oldestWaitMs,
      });
      totalWaiting += queue.length;
    }

    return {
      queues,
      totalWaiting,
      recentMatchCount: this.recentMatches.length,
    };
  }

  /**
   * Returns estimated wait time based on current queue state.
   */
  public getEstimatedWaitMs(region: string): number {
    const queue = this.queues.get(region);
    if (!queue) return REGIONAL_WAIT_MS;

    if (queue.length >= MIN_PLAYERS - 1) {
      // About to form a room on next tick
      return TICK_INTERVAL_MS;
    }

    // Rough estimate: if nobody else is waiting, max is regional wait + tick
    return REGIONAL_WAIT_MS;
  }

  // ── Redis Sync (optional) ─────────────────────────────────────────────────

  private async syncTicketToRedis(ticket: MatchTicket): Promise<void> {
    const redis = getRedis();
    if (!redis?.isOpen) return;

    try {
      const key = `${this.redisPrefix}${ticket.region}`;
      const value = JSON.stringify({
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        playerId: ticket.playerId,
        region: ticket.region,
        mapId: ticket.mapId,
        joinedAt: ticket.joinedAt,
        skillScore: ticket.skillScore,
        preferredLanguage: ticket.preferredLanguage,
      });
      await redis.zAdd(key, { score: ticket.joinedAt, value });
    } catch (err) {
      logger.warn("Matchmaker", "Failed to sync ticket to Redis", err);
    }
  }

  private async removeTicketFromRedis(ticketId: string): Promise<void> {
    const redis = getRedis();
    if (!redis?.isOpen) return;

    try {
      // We need to scan all region keys to find and remove
      for (const region of REGIONS) {
        const key = `${this.redisPrefix}${region}`;
        // Use ZRANGEBYSCORE and filter — simpler approach for low volume
        const members = await redis.zRange(key, 0, -1);
        for (const member of members) {
          try {
            const parsed = JSON.parse(member);
            if (parsed.ticketId === ticketId) {
              await redis.zRem(key, member);
              return;
            }
          } catch {
            // skip malformed entries
          }
        }
      }
    } catch (err) {
      logger.warn("Matchmaker", "Failed to remove ticket from Redis", err);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalizeRegion(region?: string): string {
    if (!region) return "us-east";
    const normalized = region.trim().toLowerCase();
    if (REGIONS.includes(normalized as Region)) return normalized;
    return "us-east";
  }

  private getOrCreateQueue(region: string): MatchTicket[] {
    let queue = this.queues.get(region);
    if (!queue) {
      queue = [];
      this.queues.set(region, queue);
    }
    return queue;
  }

  /**
   * Clears all queues and ticket index. Used for testing.
   */
  public clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.ticketIndex.clear();
    this.recentMatches.length = 0;
    this.matchedTickets.clear();
  }

  private setMatchedTicket(ticketId: string, result: MatchResult) {
    this.matchedTickets.set(ticketId, result);
    setTimeout(() => {
      this.matchedTickets.delete(ticketId);
    }, 300_000); // 5 minutes expiration
  }

  public getMatchedTicketResult(ticketId: string): MatchResult | null {
    const result = this.matchedTickets.get(ticketId);
    if (result) {
      this.matchedTickets.delete(ticketId);
      return result;
    }
    return null;
  }

  public getTicket(ticketId: string): MatchTicket | null {
    return this.ticketIndex.get(ticketId) ?? null;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const matchmaker = new MatchmakingQueue();

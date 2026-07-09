import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import type { MatchTicket } from "../Matchmaker.js";
import { productionFeatureStore } from "../../analytics/features/ProductionStore.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum acceptable skill disparity within a single room (20%) */
const MAX_SKILL_DISPARITY = 0.20;

/** Default skill score for players without history (slightly below average) */
const DEFAULT_SKILL_SCORE = 0.40;

/** Minimum matches needed to use actual win rate; below this → default score */
const MIN_MATCHES_FOR_SKILL = 5;

/**
 * Language compatibility matrix.
 * 1.0 = same language, 0.5 = partially compatible (fallback), 0.0 = incompatible.
 */
const LANGUAGE_FALLBACKS: Record<string, string[]> = {
  es: ["en"],
  en: [],
  fr: ["en"],
  de: ["en"],
};

// ── Skill Score Computation ───────────────────────────────────────────────────

/**
 * Computes a simple skill score for a user based on win rate.
 * Uses matchesWon / matchesPlayed from PlayerFeatures.
 * Returns DEFAULT_SKILL_SCORE for users with insufficient history.
 */
export async function computeSkillScore(userId: string): Promise<number> {
  try {
    const features = await productionFeatureStore.getPlayerFeatures(userId);

    if (!features || features.matchesPlayed < MIN_MATCHES_FOR_SKILL) {
      return DEFAULT_SKILL_SCORE;
    }

    const winRate = features.matchesWon / features.matchesPlayed;
    // Clamp to [0.0, 1.0]
    return Math.max(0.0, Math.min(1.0, winRate));
  } catch (err) {
    logger.warn("SkillMatcher", `Failed to compute skill for user ${userId}. Using default.`, err);
    return DEFAULT_SKILL_SCORE;
  }
}

/**
 * Fetches the preferred language for a user from PlayerFeatures.
 * Returns null if not available.
 */
export async function fetchPreferredLanguage(userId: string): Promise<string | null> {
  try {
    const features = await productionFeatureStore.getPlayerFeatures(userId);
    return features?.preferredLanguage ?? null;
  } catch (err) {
    logger.warn("SkillMatcher", `Failed to fetch language for user ${userId}.`, err);
    return null;
  }
}

// ── Language Compatibility ────────────────────────────────────────────────────

/**
 * Evaluates language compatibility between two players.
 * @returns 1.0 = same language, 0.5 = one is a fallback of the other, 0.0 = incompatible
 */
export function getLanguageCompatibility(
  lang1: string | null | undefined,
  lang2: string | null | undefined,
): number {
  // If either is unknown, treat as compatible (don't penalize missing data)
  if (!lang1 || !lang2) return 0.75;

  const l1 = lang1.trim().toLowerCase();
  const l2 = lang2.trim().toLowerCase();

  // Exact match
  if (l1 === l2) return 1.0;

  // Check if l2 is a fallback of l1 or vice versa
  const fallbacks1 = LANGUAGE_FALLBACKS[l1] ?? [];
  const fallbacks2 = LANGUAGE_FALLBACKS[l2] ?? [];

  if (fallbacks1.includes(l2) || fallbacks2.includes(l1)) {
    return 0.5;
  }

  // English is a global lingua franca fallback
  if (l1 === "en" || l2 === "en") {
    return 0.3;
  }

  return 0.0;
}

// ── Ticket Pair Scoring ──────────────────────────────────────────────────────

/**
 * Computes a composite affinity score between two tickets.
 * Higher score = better match.
 *
 * Score composition:
 * - Skill similarity: weight 0.6 (1.0 - |skill_a - skill_b|)
 * - Language compatibility: weight 0.4
 */
export function scoreTicketPair(a: MatchTicket, b: MatchTicket): number {
  const skillA = a.skillScore ?? DEFAULT_SKILL_SCORE;
  const skillB = b.skillScore ?? DEFAULT_SKILL_SCORE;
  const skillSimilarity = 1.0 - Math.abs(skillA - skillB);

  const langCompat = getLanguageCompatibility(a.preferredLanguage, b.preferredLanguage);

  return 0.6 * skillSimilarity + 0.4 * langCompat;
}

// ── Group Tickets by Affinity ────────────────────────────────────────────────

export interface AffinityGroup {
  tickets: MatchTicket[];
  avgSkill: number;
  skillDisparity: number;
  languageHomogeneity: number;
}

/**
 * Groups a set of tickets into optimized batches for room formation.
 *
 * Strategy:
 * 1. Sort all tickets by skill score.
 * 2. Group tickets with skill within MAX_SKILL_DISPARITY of each other.
 * 3. Within skill groups, prefer tickets with compatible languages.
 * 4. Return groups ordered by size (largest first).
 *
 * @param tickets Array of enriched match tickets
 * @param minGroupSize Minimum group size to form a room
 * @param maxGroupSize Maximum group size for a room
 */
export function groupByAffinity(
  tickets: MatchTicket[],
  minGroupSize: number,
  maxGroupSize: number,
): AffinityGroup[] {
  if (tickets.length < minGroupSize) return [];

  // Sort by skill score ascending
  const sorted = [...tickets].sort((a, b) => {
    const sa = a.skillScore ?? DEFAULT_SKILL_SCORE;
    const sb = b.skillScore ?? DEFAULT_SKILL_SCORE;
    return sa - sb;
  });

  const groups: AffinityGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i]!;
    if (used.has(anchor.ticketId)) continue;

    const anchorSkill = anchor.skillScore ?? DEFAULT_SKILL_SCORE;
    const candidates: MatchTicket[] = [anchor];
    used.add(anchor.ticketId);

    // Collect tickets within skill range
    for (let j = i + 1; j < sorted.length && candidates.length < maxGroupSize; j++) {
      const candidate = sorted[j]!;
      if (used.has(candidate.ticketId)) continue;

      const candidateSkill = candidate.skillScore ?? DEFAULT_SKILL_SCORE;
      if (Math.abs(candidateSkill - anchorSkill) <= MAX_SKILL_DISPARITY) {
        candidates.push(candidate);
        used.add(candidate.ticketId);
      }
    }

    // Sort candidates within group by language compatibility to anchor
    if (candidates.length > 1) {
      candidates.sort((a, b) => {
        const compA = getLanguageCompatibility(anchor.preferredLanguage, a.preferredLanguage);
        const compB = getLanguageCompatibility(anchor.preferredLanguage, b.preferredLanguage);
        return compB - compA; // Higher compatibility first
      });
    }

    if (candidates.length >= minGroupSize) {
      // Trim to max group size
      const batch = candidates.slice(0, maxGroupSize);
      const stats = computeGroupStats(batch);
      groups.push({
        tickets: batch,
        ...stats,
      });

      // Return extras to the unused pool
      for (let k = maxGroupSize; k < candidates.length; k++) {
        used.delete(candidates[k]!.ticketId);
      }
    } else {
      // Not enough for a group; release candidates back
      for (const c of candidates) {
        used.delete(c.ticketId);
      }
    }
  }

  // If no affinity-based groups formed, fall back to simple FIFO grouping
  if (groups.length === 0 && tickets.length >= minGroupSize) {
    const fallbackBatch = tickets.slice(0, maxGroupSize);
    const stats = computeGroupStats(fallbackBatch);
    groups.push({
      tickets: fallbackBatch,
      ...stats,
    });
  }

  return groups.sort((a, b) => b.tickets.length - a.tickets.length);
}

/**
 * Computes group statistics: average skill, skill disparity, language homogeneity.
 */
function computeGroupStats(tickets: MatchTicket[]): {
  avgSkill: number;
  skillDisparity: number;
  languageHomogeneity: number;
} {
  if (tickets.length === 0) {
    return { avgSkill: 0, skillDisparity: 0, languageHomogeneity: 0 };
  }

  const skills = tickets.map((t) => t.skillScore ?? DEFAULT_SKILL_SCORE);
  const avgSkill = skills.reduce((sum, s) => sum + s, 0) / skills.length;
  const minSkill = Math.min(...skills);
  const maxSkill = Math.max(...skills);
  const skillDisparity = maxSkill - minSkill;

  // Language homogeneity: fraction of pairwise compatible languages
  let compatiblePairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < tickets.length; i++) {
    for (let j = i + 1; j < tickets.length; j++) {
      totalPairs++;
      const compat = getLanguageCompatibility(
        tickets[i]!.preferredLanguage,
        tickets[j]!.preferredLanguage,
      );
      if (compat >= 0.5) compatiblePairs++;
    }
  }

  const languageHomogeneity = totalPairs > 0 ? compatiblePairs / totalPairs : 1.0;

  return {
    avgSkill: Math.round(avgSkill * 1000) / 1000,
    skillDisparity: Math.round(skillDisparity * 1000) / 1000,
    languageHomogeneity: Math.round(languageHomogeneity * 1000) / 1000,
  };
}

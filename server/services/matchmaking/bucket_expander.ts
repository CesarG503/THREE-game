/**
 * Phase 41 - Matchmaking Fallback Logic: Filter Relaxation
 *
 * Implements the formula: U(t) = U_0 * (1.0 + k * t),
 * and defines the sequential relaxation order:
 * 1. Skill disparity starts relaxing immediately.
 * 2. Language compatibility starts relaxing after 15s.
 * 3. Latency limits start relaxing after 30s.
 */

export interface MatchmakerThresholds {
  maxSkillDisparity: number;
  minLanguageCompatibility: number;
  maxLatency: number;
}

/**
 * Computes search parameter thresholds for a ticket based on its wait time in milliseconds.
 *
 * Formulas:
 * 1. Skill Disparity: U_skill(t) = U_skill,0 * (1.0 + k_skill * t), capped at 0.40.
 *    Initial = 0.10, k = 0.05.
 * 2. Language Compatibility: U_lang(t) = max(0.0, 1.0 - k_lang * (t - T_lang_start)),
 *    where T_lang_start = 15s, k = 0.05.
 * 3. Latency Limit: U_lat(t) = U_lat,0 * (1.0 + k_lat * (t - T_lat_start)), capped at 250ms.
 *    where T_lat_start = 30s, Initial = 50ms, k = 0.10.
 *
 * @param waitTimeMs Time spent waiting in the queue
 */
export function getThresholdsForWaitTime(waitTimeMs: number): MatchmakerThresholds {
  const t = Math.max(0, waitTimeMs / 1000); // Time in seconds

  // 1. Skill Disparity (starts relaxing immediately)
  const U_skill_0 = 0.10;
  const k_skill = 0.05;
  const SKILL_CAP = 0.40;
  const maxSkillDisparity = Math.min(SKILL_CAP, U_skill_0 * (1.0 + k_skill * t));

  // 2. Language Compatibility (starts relaxing after 10 seconds)
  const T_lang_start = 10;
  const k_lang = 0.05;
  let minLanguageCompatibility = 1.0;
  if (t > T_lang_start) {
    minLanguageCompatibility = Math.max(0.0, 1.0 - k_lang * (t - T_lang_start));
  }

  // 3. Latency (starts relaxing after 20 seconds)
  const T_latency_start = 20;
  const U_latency_0 = 50;
  const k_latency = 0.10;
  const MAX_LATENCY_CAP = 250;
  let maxLatency = U_latency_0;
  if (t > T_latency_start) {
    maxLatency = Math.min(
      MAX_LATENCY_CAP,
      U_latency_0 * (1.0 + k_latency * (t - T_latency_start))
    );
  }

  return {
    maxSkillDisparity: Math.round(maxSkillDisparity * 1000) / 1000,
    minLanguageCompatibility: Math.round(minLanguageCompatibility * 1000) / 1000,
    maxLatency: Math.round(maxLatency),
  };
}

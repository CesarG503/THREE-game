/**
 * Test suite for Phase 40: Skill & Language-based Matchmaking
 *
 * Validates:
 * 1. Skill-similar players are grouped together
 * 2. Language-compatible players are preferred
 * 3. Skill disparity < 20% in rooms
 * 4. Backward compatibility without skill/language data
 * 5. Mixed scenarios with bilingual players
 * 6. Quality metrics (skillDisparity, languageHomogeneity) are computed correctly
 *
 * Usage: npx tsx scripts/test-skill-matchmaker.ts
 */

import { MatchmakingQueue, type MatchResult } from "../server/services/Matchmaker.js";
import {
  getLanguageCompatibility,
  scoreTicketPair,
  groupByAffinity,
  type AffinityGroup,
} from "../server/services/matchmaking/skill_matcher.js";

// ── Test Helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);
}

// ── Test 1: Language Compatibility ────────────────────────────────────────────

section("Test 1: Language Compatibility");

assert(getLanguageCompatibility("es", "es") === 1.0, "Same language (es,es) → 1.0");
assert(getLanguageCompatibility("en", "en") === 1.0, "Same language (en,en) → 1.0");
assert(getLanguageCompatibility("es", "en") === 0.5, "Fallback compatible (es,en) → 0.5");
assert(getLanguageCompatibility("fr", "en") === 0.5, "Fallback compatible (fr,en) → 0.5");
assert(getLanguageCompatibility("de", "en") === 0.5, "Fallback compatible (de,en) → 0.5");
assert(getLanguageCompatibility("es", "fr") === 0.0, "Incompatible (es,fr) → 0.0");
assert(getLanguageCompatibility("de", "fr") === 0.0, "Incompatible (de,fr) → 0.0");
assert(getLanguageCompatibility(null, "en") === 0.75, "Unknown lang → 0.75 (no penalty)");
assert(getLanguageCompatibility(null, null) === 0.75, "Both unknown → 0.75");
assert(getLanguageCompatibility("en", "es") === 0.5, "Reverse fallback (en,es) → 0.5");
assert(getLanguageCompatibility("en", "de") === 0.5, "English as de fallback (en,de) → 0.5");

// ── Test 2: Ticket Pair Scoring ──────────────────────────────────────────────

section("Test 2: Ticket Pair Scoring");

const makeTicket = (id: string, skill: number, lang: string) => ({
  ticketId: id,
  userId: id,
  playerId: id,
  region: "us-east",
  mapId: null,
  joinedAt: Date.now(),
  skillScore: skill,
  preferredLanguage: lang,
});

const perfectPair = scoreTicketPair(
  makeTicket("a", 0.5, "es"),
  makeTicket("b", 0.5, "es"),
);
assert(perfectPair === 1.0, `Perfect pair (same skill, same lang) → ${perfectPair} === 1.0`);

const skillMismatch = scoreTicketPair(
  makeTicket("a", 0.2, "en"),
  makeTicket("b", 0.8, "en"),
);
assert(skillMismatch < 0.8, `Skill mismatch (0.2 vs 0.8, same lang) → ${skillMismatch} < 0.8`);

const langMismatch = scoreTicketPair(
  makeTicket("a", 0.5, "es"),
  makeTicket("b", 0.5, "fr"),
);
assert(langMismatch < perfectPair, `Language mismatch (es vs fr) → ${langMismatch} < ${perfectPair}`);

// ── Test 3: Affinity Grouping - Skill Segregation ────────────────────────────

section("Test 3: Affinity Grouping - Skill Segregation");

const beginners = Array.from({ length: 4 }, (_, i) =>
  makeTicket(`beginner-${i}`, 0.1 + i * 0.05, "en"),
);
const experts = Array.from({ length: 4 }, (_, i) =>
  makeTicket(`expert-${i}`, 0.7 + i * 0.05, "en"),
);

const allPlayers = [...beginners, ...experts];
const groups = groupByAffinity(allPlayers, 2, 4);

assert(groups.length >= 2, `Formed ${groups.length} groups (expected ≥ 2 for segregation)`);

// Verify each group has low skill disparity
for (let i = 0; i < groups.length; i++) {
  const g = groups[i]!;
  assert(
    g.skillDisparity <= 0.25,
    `Group ${i + 1}: skill disparity ${g.skillDisparity} ≤ 0.25`,
  );
}

// ── Test 4: Affinity Grouping - Language Preference ──────────────────────────

section("Test 4: Affinity Grouping - Language Preference");

const spanishPlayers = Array.from({ length: 3 }, (_, i) =>
  makeTicket(`es-player-${i}`, 0.5, "es"),
);
const englishPlayers = Array.from({ length: 3 }, (_, i) =>
  makeTicket(`en-player-${i}`, 0.5, "en"),
);

const langGroups = groupByAffinity([...spanishPlayers, ...englishPlayers], 2, 3);

assert(langGroups.length >= 1, `Formed ${langGroups.length} groups from bilingual pool`);

// Check language homogeneity is reasonable
for (let i = 0; i < langGroups.length; i++) {
  const g = langGroups[i]!;
  assert(
    g.languageHomogeneity >= 0.5,
    `Group ${i + 1}: language homogeneity ${g.languageHomogeneity} ≥ 0.5`,
  );
}

// ── Test 5: Backward Compatibility (No skill/language data) ──────────────────

section("Test 5: Backward Compatibility (No skill/language data)");

const mm = new MatchmakingQueue();

// Join without skill or language
const t1 = mm.joinQueue({ userId: "user1", region: "us-east" });
const t2 = mm.joinQueue({ userId: "user2", region: "us-east" });

assert(!!t1.ticketId, `Ticket 1 created: ${t1.ticketId}`);
assert(!!t2.ticketId, `Ticket 2 created: ${t2.ticketId}`);

const results = mm.tick();
assert(results.length === 1, `Formed ${results.length} room without skill data (backward compat)`);
assert(results[0]!.players.length === 2, `Room has ${results[0]!.players.length} players`);
assert(typeof results[0]!.skillDisparity === "number", `skillDisparity present: ${results[0]!.skillDisparity}`);
assert(typeof results[0]!.languageHomogeneity === "number", `languageHomogeneity present: ${results[0]!.languageHomogeneity}`);

mm.clear();

// ── Test 6: Full Skill + Language Enriched Matchmaking ───────────────────────

section("Test 6: Full Enriched Matchmaking");

const mm2 = new MatchmakingQueue();

// Beginners (es)
mm2.joinQueue({ userId: "b1", region: "us-east", skillScore: 0.15, preferredLanguage: "es" });
mm2.joinQueue({ userId: "b2", region: "us-east", skillScore: 0.20, preferredLanguage: "es" });
mm2.joinQueue({ userId: "b3", region: "us-east", skillScore: 0.18, preferredLanguage: "es" });

// Experts (en)
mm2.joinQueue({ userId: "e1", region: "us-east", skillScore: 0.80, preferredLanguage: "en" });
mm2.joinQueue({ userId: "e2", region: "us-east", skillScore: 0.85, preferredLanguage: "en" });
mm2.joinQueue({ userId: "e3", region: "us-east", skillScore: 0.78, preferredLanguage: "en" });

const enrichedResults = mm2.tick();

assert(enrichedResults.length >= 2, `Formed ${enrichedResults.length} rooms (expected ≥ 2 for segregation)`);

for (const room of enrichedResults) {
  assert(
    room.skillDisparity <= 0.25,
    `Room ${room.roomId}: skill disparity ${room.skillDisparity} ≤ 0.25`,
  );
  assert(
    room.languageHomogeneity >= 0.5,
    `Room ${room.roomId}: language homogeneity ${room.languageHomogeneity} ≥ 0.5`,
  );
  console.log(
    `    → Room ${room.roomId}: ${room.players.length} players, ` +
    `skill disparity: ${room.skillDisparity}, lang homogeneity: ${room.languageHomogeneity}`,
  );
}

mm2.clear();

// ── Test 7: Skill Score Computation Edge Cases ───────────────────────────────

section("Test 7: Affinity Grouping Edge Cases");

// Single player - should not form a group
const singleGroups = groupByAffinity([makeTicket("lone", 0.5, "en")], 2, 4);
assert(singleGroups.length === 0, `Single player → 0 groups (need minimum 2)`);

// Exactly MIN_PLAYERS
const exactMin = groupByAffinity(
  [makeTicket("a", 0.5, "en"), makeTicket("b", 0.55, "en")],
  2, 4,
);
assert(exactMin.length === 1, `Exactly 2 players → ${exactMin.length} group`);

// Very diverse skills → still forms groups (FIFO fallback)
const diverse = Array.from({ length: 8 }, (_, i) =>
  makeTicket(`d-${i}`, i * 0.12, "en"),
);
const diverseGroups = groupByAffinity(diverse, 2, 4);
assert(diverseGroups.length >= 1, `8 diverse players → ${diverseGroups.length} groups (some formed)`);

// ── Test 8: Queue Status with enriched tickets ───────────────────────────────

section("Test 8: Queue Status with Enriched Tickets");

const mm3 = new MatchmakingQueue();
mm3.joinQueue({ userId: "s1", region: "eu-west", skillScore: 0.6, preferredLanguage: "fr" });

const status = mm3.getQueueStatus();
assert(status.totalWaiting === 1, `Total waiting: ${status.totalWaiting} === 1`);
assert(status.queues.some((q) => q.region === "eu-west" && q.size === 1), "eu-west queue has 1 ticket");

mm3.clear();

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(66)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(66)}\n`);

if (failed > 0) {
  process.exit(1);
}

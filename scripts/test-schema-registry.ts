import { validateTelemetryEvent } from "../server/analytics/middleware.js";

console.log("=== STARTING SCHEMA REGISTRY TESTS ===");

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// Helper to generate a valid UUID
const validUuid = "12345678-1234-1234-1234-123456789012";
const validDate = new Date().toISOString();

// --- TEST 1: Happy Path (Valid Events) ---
console.log("\n--- TEST 1: Happy Path ---");

const validPageView = {
  id: validUuid,
  eventType: "PageView",
  userId: validUuid,
  timestamp: validDate,
  payload: {
    url: "https://example.com/play",
    referrer: "https://google.com",
    title: "Game Lobby",
  },
};
const resPageView = validateTelemetryEvent(validPageView);
assert(resPageView.valid, `Valid PageView event rejected: ${resPageView.errors?.join(", ")}`);
console.log("✓ Valid PageView accepted.");

const validSessionStart = {
  id: validUuid,
  eventType: "SessionStart",
  userId: null,
  timestamp: validDate,
  payload: {
    userAgent: "Mozilla/5.0",
    language: "en-US",
    screenResolution: "1920x1080",
  },
};
const resSessionStart = validateTelemetryEvent(validSessionStart);
assert(resSessionStart.valid, `Valid SessionStart event rejected: ${resSessionStart.errors?.join(", ")}`);
console.log("✓ Valid SessionStart accepted.");

const validMatchJoin = {
  id: validUuid,
  eventType: "MatchJoin",
  userId: validUuid,
  timestamp: validDate,
  payload: {
    roomId: validUuid,
    mapId: validUuid,
    mode: "deathmatch",
  },
};
const resMatchJoin = validateTelemetryEvent(validMatchJoin);
assert(resMatchJoin.valid, `Valid MatchJoin event rejected: ${resMatchJoin.errors?.join(", ")}`);
console.log("✓ Valid MatchJoin accepted.");

const validMatchLeave = {
  id: validUuid,
  eventType: "MatchLeave",
  userId: validUuid,
  timestamp: validDate,
  payload: {
    roomId: validUuid,
    mapId: validUuid,
    durationSeconds: 124.5,
    reason: "completed",
  },
};
const resMatchLeave = validateTelemetryEvent(validMatchLeave);
assert(resMatchLeave.valid, `Valid MatchLeave event rejected: ${resMatchLeave.errors?.join(", ")}`);
console.log("✓ Valid MatchLeave accepted.");

// --- TEST 2: Envelope Validation Failures ---
console.log("\n--- TEST 2: Envelope Validation Failures ---");

// Missing eventType
const missingEventType = {
  id: validUuid,
  timestamp: validDate,
  payload: { url: "http://test.com" },
};
const resMissingType = validateTelemetryEvent(missingEventType);
assert(!resMissingType.valid, "Envelope missing eventType was accepted");
assert(resMissingType.errors?.some(e => e.includes("eventType")) ?? false, "Error message did not mention eventType");
console.log("✓ Correctly rejected missing eventType.");

// Invalid ID format (not UUID)
const invalidIdFormat = {
  id: "not-a-uuid",
  eventType: "PageView",
  timestamp: validDate,
  payload: { url: "http://test.com" },
};
const resInvalidId = validateTelemetryEvent(invalidIdFormat);
assert(!resInvalidId.valid, "Envelope with invalid UUID format was accepted");
assert(resInvalidId.errors?.some(e => e.includes("id")) ?? false, "Error message did not mention id");
console.log("✓ Correctly rejected invalid UUID format in ID.");

// Unsupported eventType
const unsupportedType = {
  id: validUuid,
  eventType: "CustomEventXYZ",
  timestamp: validDate,
  payload: {},
};
const resUnsupported = validateTelemetryEvent(unsupportedType);
assert(!resUnsupported.valid, "Envelope with unsupported eventType was accepted");
assert(resUnsupported.errors?.some(e => e.includes("eventType")) ?? false, "Error message did not mention eventType");
console.log("✓ Correctly rejected unsupported eventType.");

// --- TEST 3: Payload Validation Failures ---
console.log("\n--- TEST 3: Payload Validation Failures ---");

// PageView missing required field 'url'
const badPageView = {
  id: validUuid,
  eventType: "PageView",
  timestamp: validDate,
  payload: {
    referrer: "http://google.com",
  },
};
const resBadPV = validateTelemetryEvent(badPageView);
assert(!resBadPV.valid, "PageView missing 'url' was accepted");
assert(resBadPV.errors?.some(e => e.includes("url")) ?? false, "Error message did not mention url");
console.log("✓ Correctly rejected PageView missing url.");

// MatchLeave with wrong durationSeconds type (string instead of number)
const badMatchLeaveType = {
  id: validUuid,
  eventType: "MatchLeave",
  timestamp: validDate,
  payload: {
    roomId: validUuid,
    mapId: validUuid,
    durationSeconds: "one-hundred",
  },
};
const resBadMLType = validateTelemetryEvent(badMatchLeaveType);
assert(!resBadMLType.valid, "MatchLeave with durationSeconds as string was accepted");
assert(resBadMLType.errors?.some(e => e.includes("durationSeconds")) ?? false, "Error message did not mention durationSeconds");
console.log("✓ Correctly rejected MatchLeave with durationSeconds as string.");

// MatchJoin with invalid UUID format in roomId
const badMatchJoinUuid = {
  id: validUuid,
  eventType: "MatchJoin",
  timestamp: validDate,
  payload: {
    roomId: "invalid-uuid",
    mapId: validUuid,
  },
};
const resBadMJUuid = validateTelemetryEvent(badMatchJoinUuid);
assert(!resBadMJUuid.valid, "MatchJoin with invalid UUID format in roomId was accepted");
assert(resBadMJUuid.errors?.some(e => e.includes("roomId")) ?? false, "Error message did not mention roomId");
console.log("✓ Correctly rejected MatchJoin with invalid UUID in roomId.");

// --- TEST 4: Performance Benchmark ---
console.log("\n--- TEST 4: Performance Benchmark ---");
const eventCount = 5000;
const eventsToValidate: any[] = [];
for (let i = 0; i < eventCount; i++) {
  eventsToValidate.push({
    id: validUuid,
    eventType: i % 2 === 0 ? "PageView" : "MatchLeave",
    userId: validUuid,
    timestamp: validDate,
    payload: i % 2 === 0
      ? { url: `https://example.com/play/${i}`, title: `Page ${i}` }
      : { roomId: validUuid, mapId: validUuid, durationSeconds: i * 0.1 },
  });
}

const startTime = process.hrtime.bigint();
let validCount = 0;
for (const event of eventsToValidate) {
  const res = validateTelemetryEvent(event);
  if (res.valid) validCount++;
}
const endTime = process.hrtime.bigint();

const totalNs = endTime - startTime;
const totalMs = Number(totalNs) / 1_000_000;
const avgMsPerEvent = totalMs / eventCount;

console.log(`Validated ${validCount}/${eventCount} events.`);
console.log(`Total duration: ${totalMs.toFixed(3)}ms`);
console.log(`Average duration per event: ${avgMsPerEvent.toFixed(5)}ms`);

assert(validCount === eventCount, `Benchmark processed invalid events? got ${validCount}/${eventCount}`);
assert(avgMsPerEvent < 1.0, `Event validation took too long: ${avgMsPerEvent}ms per event (limit 1.0ms)`);
console.log("✓ Performance validation passed! (average validation time < 1ms)");

console.log("\n=== ALL SCHEMA REGISTRY TESTS PASSED SUCCESSFULLY! ===");
process.exit(0);

import { connectRedis, getRedis, disconnectRedis } from "../server/cache/redis.js";
import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { EventBuffer } from "../server/analytics/eventBuffer.js";
import type { TelemetryEvent } from "../server/analytics/eventBuffer.js";
import { EventWorker } from "../server/analytics/eventWorker.js";
import "dotenv/config";

async function main() {
  console.log("=== STARTING EVENT BROKER TESTS ===");

  const testUserId = "test-broker-user-123";
  
  // 1. Initial connection & database cleanup
  console.log("\nConnecting to Redis and cleaning up test state...");
  const redis = await connectRedis();
  if (!redis) {
    throw new Error("Unable to connect to Redis for testing");
  }

  // Clear keys
  await redis.del("analytics:event_queue");
  await redis.del("analytics:event_dlq");

  // Clean old DB data
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { userId: testUserId },
        { eventType: "test_broker_happy" },
        { eventType: "test_broker_dlq_valid" },
        { eventType: "test_broker_dlq_invalid" },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: testUserId } });

  // Create test user for foreign keys
  await prisma.user.create({
    data: {
      id: testUserId,
      email: "broker.test@example.com",
      username: "broker_tester",
      passwordHash: "securehash",
      displayName: "Broker Tester",
    },
  });
  console.log("Test user created in public and replicated via trigger.");

  // Wait briefly for trigger replication
  let userReplicated = false;
  for (let i = 0; i < 5; i++) {
    const check = await analyticsPrisma.user.findUnique({ where: { id: testUserId } });
    if (check) {
      userReplicated = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!userReplicated) {
    throw new Error("Trigger failed to replicate user for testing");
  }

  try {
    // ==========================================
    // TEST 1: Happy Path (Buffer + Worker Batching)
    // ==========================================
    console.log("\n--- TEST 1: Happy Path ---");
    const buffer = new EventBuffer();
    const worker = new EventWorker();

    buffer.start(100); // Flush memory to Redis every 100ms
    worker.start(); // Polling every 1s

    console.log("Pushing 1000 events...");
    const startCount = await analyticsPrisma.rawEvent.count();

    for (let i = 0; i < 1000; i++) {
      buffer.push({
        id: `happy-event-${i}`,
        eventType: "test_broker_happy",
        userId: testUserId,
        timestamp: new Date(),
        payload: { sequence: i },
      });
    }

    console.log("Waiting for events to flush to Redis and insert into DB...");
    let addedCount = 0;
    for (let i = 0; i < 30; i++) {
      const endCount = await analyticsPrisma.rawEvent.count();
      addedCount = endCount - startCount;
      if (addedCount === 1000) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`Events written to DB: ${addedCount}`);

    if (addedCount !== 1000) {
      throw new Error(`Expected 1000 events to be written, got ${addedCount}`);
    }
    console.log("SUCCESS: Happy path verified!");

    buffer.stop();
    worker.stop();

    // ==========================================
    // TEST 2: Backpressure (Memory limit)
    // ==========================================
    console.log("\n--- TEST 2: Backpressure ---");
    const bpBuffer = new EventBuffer(); // Stopped buffer (doesn't flush to Redis)
    
    console.log("Attempting to push 6000 events into buffer...");
    let pushedCount = 0;
    let droppedCount = 0;

    for (let i = 0; i < 6000; i++) {
      const success = bpBuffer.push({
        id: `bp-event-${i}`,
        eventType: "test_broker_bp",
        userId: testUserId,
        timestamp: new Date(),
        payload: { sequence: i },
      });
      if (success) {
        pushedCount++;
      } else {
        droppedCount++;
      }
    }

    console.log(`Pushed to memory: ${pushedCount}`);
    console.log(`Dropped (Backpressure): ${droppedCount}`);

    if (pushedCount !== 5000) {
      throw new Error(`Expected exactly 5000 events in memory, got ${pushedCount}`);
    }
    if (droppedCount !== 1000) {
      throw new Error(`Expected exactly 1000 events dropped, got ${droppedCount}`);
    }
    console.log("SUCCESS: Backpressure verified!");

    // ==========================================
    // TEST 3: Crash Recovery (Redis Disconnection)
    // ==========================================
    console.log("\n--- TEST 3: Crash Recovery ---");
    const crBuffer = new EventBuffer();
    
    // Simulate events pushed when Redis is working
    crBuffer.push({
      id: "cr-event-1",
      eventType: "test_broker_cr",
      userId: testUserId,
      timestamp: new Date(),
      payload: { stage: "before_crash" },
    });

    console.log("Simulating Redis crash (closing Redis client)...");
    await redis.quit(); // Manually close connection

    // Try flushing - should log a warning and retain in memory
    await crBuffer.flush();
    console.log(`Events in memory after crash: ${crBuffer.getLength()}`);
    if (crBuffer.getLength() !== 1) {
      throw new Error("Event was lost during simulated Redis crash!");
    }

    // Push another event while connection is down
    crBuffer.push({
      id: "cr-event-2",
      eventType: "test_broker_cr",
      userId: testUserId,
      timestamp: new Date(),
      payload: { stage: "during_crash" },
    });
    console.log(`Events in memory with connection down: ${crBuffer.getLength()}`);

    console.log("Restoring Redis connection...");
    await redis.connect(); // Reconnect

    // Flush should succeed now
    await crBuffer.flush();
    console.log(`Events in memory after reconnect flush: ${crBuffer.getLength()}`);
    if (crBuffer.getLength() !== 0) {
      throw new Error("Events failed to flush after Redis connection was restored!");
    }

    // Process from queue using a temporary worker
    const crWorker = new EventWorker();
    const crStartCount = await analyticsPrisma.rawEvent.count();
    
    // Run batch insert manually from Redis
    const poppedRaw = await redis.lRange("analytics:event_queue", 0, -1);
    const poppedEvents: TelemetryEvent[] = poppedRaw.map(raw => JSON.parse(raw));
    await crWorker.processBatch(poppedEvents);
    await redis.del("analytics:event_queue");

    const crEndCount = await analyticsPrisma.rawEvent.count();
    const crAddedCount = crEndCount - crStartCount;
    console.log(`Events processed after reconnect: ${crAddedCount}`);
    if (crAddedCount !== 2) {
      throw new Error(`Expected 2 events to be inserted, got ${crAddedCount}`);
    }
    console.log("SUCCESS: Crash recovery verified!");

    // ==========================================
    // TEST 4: Dead Letter Queue (DLQ) Fallback
    // ==========================================
    console.log("\n--- TEST 4: Dead Letter Queue (DLQ) ---");
    const dlqWorker = new EventWorker();

    const testEvents: TelemetryEvent[] = [
      { id: "dlq-ok-1", eventType: "test_broker_dlq_valid", userId: testUserId, timestamp: new Date(), payload: {} },
      { id: "dlq-ok-2", eventType: "test_broker_dlq_valid", userId: testUserId, timestamp: new Date(), payload: {} },
      // Invalid event: foreign key userId does not exist in User table
      { id: "dlq-fail-3", eventType: "test_broker_dlq_invalid", userId: "non-existent-user", timestamp: new Date(), payload: {} },
      { id: "dlq-ok-4", eventType: "test_broker_dlq_valid", userId: testUserId, timestamp: new Date(), payload: {} },
    ];

    console.log("Running batch processing with 3 valid events and 1 corrupt event...");
    // This will trigger createMany which will fail, falling back to individual inserts
    await dlqWorker.processBatch(testEvents);

    // Verify valid events are in database
    const dbOkCount = await analyticsPrisma.rawEvent.count({
      where: { eventType: "test_broker_dlq_valid" },
    });
    console.log(`Valid events successfully written to DB: ${dbOkCount}`);
    if (dbOkCount !== 3) {
      throw new Error(`Expected 3 valid events in DB, got ${dbOkCount}`);
    }

    // Verify invalid event is in DLQ
    const dlqLength = await redis.lLen("analytics:event_dlq");
    console.log(`Events in Dead Letter Queue (DLQ): ${dlqLength}`);
    if (dlqLength !== 1) {
      throw new Error(`Expected exactly 1 event in DLQ, got ${dlqLength}`);
    }

    const dlqItemRaw = await redis.lPop("analytics:event_dlq");
    const dlqItem = JSON.parse(dlqItemRaw!);
    console.log(`DLQ item failed event ID: ${dlqItem.event.id}`);
    console.log(`DLQ failure error description: ${dlqItem.error}`);
    if (dlqItem.event.id !== "dlq-fail-3") {
      throw new Error(`Expected failed event ID 'dlq-fail-3', got '${dlqItem.event.id}'`);
    }
    console.log("SUCCESS: DLQ and fallback processing verified!");

    // Clean up
    console.log("\nCleaning up test state...");
    await redis.del("analytics:event_queue");
    await redis.del("analytics:event_dlq");
    await analyticsPrisma.rawEvent.deleteMany({
      where: {
        OR: [
          { userId: testUserId },
          { eventType: "test_broker_happy" },
          { eventType: "test_broker_dlq_valid" },
          { eventType: "test_broker_dlq_invalid" },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    console.log("Clean up finished!");

    console.log("\n=== ALL EVENT BROKER TESTS PASSED SUCCESSFULLY! ===");
  } catch (error) {
    console.error("\n!!! EVENT BROKER TESTS FAILED !!!", error);
    // Cleanup anyway
    const activeRedis = getRedis();
    if (activeRedis && activeRedis.isOpen) {
      await activeRedis.del("analytics:event_queue").catch(() => {});
      await activeRedis.del("analytics:event_dlq").catch(() => {});
    }
    await analyticsPrisma.rawEvent.deleteMany({
      where: {
        OR: [
          { userId: testUserId },
          { eventType: "test_broker_happy" },
          { eventType: "test_broker_dlq_valid" },
          { eventType: "test_broker_dlq_invalid" },
        ],
      },
    }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
    await disconnectRedis();
  }
}

void main();

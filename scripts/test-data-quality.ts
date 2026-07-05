import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { runDataQualityPipeline } from "../server/analytics/validation/quality_pipeline.js";
import "dotenv/config";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userId: string, eventIds: string[]) {
  // Delete from RawEvent using primary keys
  for (const eventId of eventIds) {
    await analyticsPrisma.rawEvent.deleteMany({
      where: { id: eventId }
    });
    await analyticsPrisma.dataQuarantine.deleteMany({
      where: { originalId: eventId }
    });
  }

  // Delete test map features and map
  await analyticsPrisma.mapFeatures.deleteMany({
    where: { mapId: "map-xyz" }
  });
  await analyticsPrisma.gameMap.deleteMany({
    where: { id: "map-xyz" }
  });
  await prisma.gameMap.deleteMany({
    where: { id: "map-xyz" }
  });

  // Delete test user from both databases
  await analyticsPrisma.user.deleteMany({
    where: { id: userId }
  });
  await prisma.user.deleteMany({
    where: { id: userId }
  });
}

async function main() {
  console.log("=== STARTING DATA QUALITY PIPELINE TESTS ===");

  const userId = "test-quality-user-999";
  const eventIds = [
    "eq-valid-1",
    "eq-invalid-future",
    "eq-invalid-payload",
    "eq-invalid-duration"
  ];

  try {
    // 1. Clean up leftovers
    console.log("Cleaning up previous test leftovers...");
    await cleanUp(userId, eventIds);

    // 2. Create seed map in operational DB
    console.log("Creating seed map in operational DB...");
    await prisma.gameMap.create({
      data: {
        id: "map-xyz",
        slug: "map-xyz-slug",
        name: "Test Map XYZ",
        isPublished: true,
      }
    });

    // Replicate map to analytics DB
    console.log("Creating seed map in analytics DB...");
    try {
      await analyticsPrisma.gameMap.create({
        data: {
          id: "map-xyz",
          slug: "map-xyz-slug",
          name: "Test Map XYZ",
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }

    // 3. Create seed user in operational DB
    console.log("Creating seed user in operational DB...");
    await prisma.user.create({
      data: {
        id: userId,
        email: "quality.test@example.com",
        username: "quality_test",
        passwordHash: "dummy-hash",
      }
    });

    // Replicate test user to analytics DB to avoid FK constraint violation
    console.log("Creating seed user in analytics DB...");
    try {
      await analyticsPrisma.user.create({
        data: {
          id: userId,
          email: "quality.test@example.com",
          username: "quality_test",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }

    const now = new Date();
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours in future

    // 3. Seed analytics events
    console.log("Seeding test events in RawEvent...");
    
    // A. Valid MatchJoin Event
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "eq-valid-1",
        eventType: "MatchJoin",
        userId: userId,
        timestamp: now,
        payload: { roomId: "room-abc", mapId: "map-xyz", mode: "deathmatch" }
      }
    });

    // B. Invalid Event: Future Timestamp (2 hours in the future)
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "eq-invalid-future",
        eventType: "MatchJoin",
        userId: userId,
        timestamp: futureTime,
        payload: { roomId: "room-abc", mapId: "map-xyz" }
      }
    });

    // C. Invalid Event: Missing roomId and mapId in payload
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "eq-invalid-payload",
        eventType: "MatchJoin",
        userId: userId,
        timestamp: now,
        payload: { mode: "ctf" } // missing roomId and mapId
      }
    });

    // D. Invalid Event: Negative duration seconds in MatchLeave
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "eq-invalid-duration",
        eventType: "MatchLeave",
        userId: userId,
        timestamp: now,
        payload: { roomId: "room-abc", mapId: "map-xyz", durationSeconds: -45 }
      }
    });

    console.log("Events seeded successfully.");

    // 4. Run data quality pipeline
    console.log("Running Data Quality Pipeline...");
    // Lookback 24 hours will scan everything from (now - 24 hours) to (now + 2 hours)
    const result = await runDataQualityPipeline(24);
    console.log(`Pipeline run results - Scanned: ${result.scanned}, Quarantined: ${result.quarantined}`);

    // 5. Verify database states
    console.log("Verifying data quarantine and event persistence...");

    // Check valid event remains in RawEvent
    const validRaw = await analyticsPrisma.rawEvent.findFirst({
      where: { id: "eq-valid-1" }
    });
    assert(validRaw !== null, "Valid event was incorrectly removed from RawEvent");
    const validQuarantine = await analyticsPrisma.dataQuarantine.findFirst({
      where: { originalId: "eq-valid-1" }
    });
    assert(validQuarantine === null, "Valid event was incorrectly quarantined");

    // Check future timestamp event is quarantined
    const futureRaw = await analyticsPrisma.rawEvent.findFirst({
      where: { id: "eq-invalid-future" }
    });
    assert(futureRaw === null, "Future event was not removed from RawEvent");
    const futureQuarantine = await analyticsPrisma.dataQuarantine.findFirst({
      where: { originalId: "eq-invalid-future" }
    });
    assert(futureQuarantine !== null, "Future event was not quarantined");
    assert(
      futureQuarantine.reason.includes("Future timestamp anomaly"),
      `Unexpected quarantine reason: ${futureQuarantine.reason}`
    );

    // Check missing payload attributes event is quarantined
    const payloadRaw = await analyticsPrisma.rawEvent.findFirst({
      where: { id: "eq-invalid-payload" }
    });
    assert(payloadRaw === null, "Malformed payload event was not removed from RawEvent");
    const payloadQuarantine = await analyticsPrisma.dataQuarantine.findFirst({
      where: { originalId: "eq-invalid-payload" }
    });
    assert(payloadQuarantine !== null, "Malformed payload event was not quarantined");
    assert(
      payloadQuarantine.reason.includes("MatchJoin event missing roomId"),
      `Unexpected quarantine reason: ${payloadQuarantine.reason}`
    );

    // Check negative duration event is quarantined
    const durationRaw = await analyticsPrisma.rawEvent.findFirst({
      where: { id: "eq-invalid-duration" }
    });
    assert(durationRaw === null, "Negative duration event was not removed from RawEvent");
    const durationQuarantine = await analyticsPrisma.dataQuarantine.findFirst({
      where: { originalId: "eq-invalid-duration" }
    });
    assert(durationQuarantine !== null, "Negative duration event was not quarantined");
    assert(
      durationQuarantine.reason.includes("invalid durationSeconds"),
      `Unexpected quarantine reason: ${durationQuarantine.reason}`
    );

    console.log("✓ All data quality rules and quarantine assertions passed!");

    // 6. Clean up test data
    console.log("Cleaning up test data...");
    await cleanUp(userId, eventIds);
    console.log("✓ Clean up successful.");

    console.log("=== ALL DATA QUALITY PIPELINE TESTS PASSED ===");
    process.exit(0);
  } catch (error) {
    console.error("Test failed with error:", error);
    try {
      await cleanUp(userId, eventIds);
    } catch (cleanupErr) {
      console.error("Failed to clean up after error:", cleanupErr);
    }
    process.exit(1);
  }
}

main();

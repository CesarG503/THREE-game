import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import "dotenv/config";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function main() {
  console.log("=== STARTING FEATURE STORE VERIFICATION ===");

  const testUserId = "test-feature-user-999";
  const testMapId = "test-feature-map-888";
  const testRoomId1 = "00000000-0000-0000-0000-000000000001";
  const testRoomId2 = "00000000-0000-0000-0000-000000000002";

  try {
    // 1. Clean up potential residue
    console.log("Cleaning up test residue...");
    await cleanUp(testUserId, testMapId);

    // 2. Setup User and GameMap in public schema (will replicate to analytics via triggers)
    console.log("Setting up test User and GameMap...");
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "feature.test@example.com",
        username: "feature_test_user",
        passwordHash: "dummyhash",
        displayName: "Feature Tester",
      },
    });

    await prisma.gameMap.create({
      data: {
        id: testMapId,
        slug: "feature-test-map",
        name: "Feature Test Map",
        isPublished: true,
        ownerId: testUserId,
      },
    });

    // Verify replication
    const replicatedUser = await analyticsPrisma.user.findUnique({ where: { id: testUserId } });
    const replicatedMap = await analyticsPrisma.gameMap.findUnique({ where: { id: testMapId } });
    assert(!!replicatedUser, "User replication to analytics schema failed.");
    assert(!!replicatedMap, "GameMap replication to analytics schema failed.");
    console.log("✓ User and GameMap successfully setup and replicated.");

    // 3. Simulate Telemetry ingestion flow to trigger SQL Aggregation
    console.log("\nSimulating event flow...");

    // Event A: SessionStart (Language = 'es')
    console.log("Ingesting event: SessionStart (Language: 'es')");
    const t1 = new Date();
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-a",
        eventType: "SessionStart",
        userId: testUserId,
        timestamp: t1,
        payload: { userAgent: "Mozilla/5.0", language: "es" },
      },
    });

    // Event B: PageView
    const t2 = new Date(t1.getTime() + 1000);
    console.log("Ingesting event: PageView");
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-b",
        eventType: "PageView",
        userId: testUserId,
        timestamp: t2,
        payload: { url: "/play" },
      },
    });

    // Event C: MatchJoin (Room 1)
    const t3 = new Date(t1.getTime() + 2000);
    console.log("Ingesting event: MatchJoin (Room 1)");
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-c",
        eventType: "MatchJoin",
        userId: testUserId,
        timestamp: t3,
        payload: { roomId: testRoomId1, mapId: testMapId },
      },
    });

    // Event D: MatchLeave (Room 1, duration = 120s)
    const t4 = new Date(t1.getTime() + 3000);
    console.log("Ingesting event: MatchLeave (Room 1, duration = 120s)");
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-d",
        eventType: "MatchLeave",
        userId: testUserId,
        timestamp: t4,
        payload: { roomId: testRoomId1, mapId: testMapId, durationSeconds: 120 },
      },
    });

    // Event E: MatchJoin (Room 2)
    const t5 = new Date(t1.getTime() + 4000);
    console.log("Ingesting event: MatchJoin (Room 2)");
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-e",
        eventType: "MatchJoin",
        userId: testUserId,
        timestamp: t5,
        payload: { roomId: testRoomId2, mapId: testMapId },
      },
    });

    // Event F: MatchLeave (Room 2, duration = 5s -> should count as bounce)
    const t6 = new Date(t1.getTime() + 5000);
    console.log("Ingesting event: MatchLeave (Room 2, duration = 5s)");
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "event-f",
        eventType: "MatchLeave",
        userId: testUserId,
        timestamp: t6,
        payload: { roomId: testRoomId2, mapId: testMapId, durationSeconds: 5 },
      },
    });

    // 4. Query aggregated features from Feature Store and assert correctness
    console.log("\nVerifying aggregated features in hot tables...");

    const playerFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId: testUserId },
    });
    const mapFeatures = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId: testMapId },
    });

    if (!playerFeatures || !mapFeatures) {
      throw new Error("playerFeatures or mapFeatures not found in DB.");
    }

    // Assert PlayerFeatures
    console.log("\nChecking PlayerFeatures values:");
    console.log(`- matchesPlayed: ${playerFeatures.matchesPlayed} (expected 2)`);
    console.log(`- totalPlayTime: ${playerFeatures.totalPlayTime}s (expected 125s)`);
    console.log(`- preferredLanguage: "${playerFeatures.preferredLanguage}" (expected "es")`);
    console.log(`- lastActive: ${playerFeatures.lastActive.toISOString()} (expected ${t6.toISOString()})`);

    assert(playerFeatures.matchesPlayed === 2, "matchesPlayed mismatch.");
    assert(playerFeatures.totalPlayTime === 125, "totalPlayTime mismatch.");
    assert(playerFeatures.preferredLanguage === "es", "preferredLanguage mismatch.");
    assert(playerFeatures.lastActive.getTime() === t6.getTime(), "lastActive timestamp mismatch.");
    console.log("✓ PlayerFeatures aggregates are 100% correct.");

    // Assert MapFeatures
    console.log("\nChecking MapFeatures values:");
    console.log(`- totalJoins: ${mapFeatures.totalJoins} (expected 2)`);
    console.log(`- totalLeaves: ${mapFeatures.totalLeaves} (expected 2)`);
    console.log(`- bounceCount: ${mapFeatures.bounceCount} (expected 1)`);
    console.log(`- averageDuration: ${mapFeatures.averageDuration}s (expected 62.5s)`);
    console.log(`- bounceRate: ${mapFeatures.bounceRate} (expected 0.5)`);

    assert(mapFeatures.totalJoins === 2, "totalJoins mismatch.");
    assert(mapFeatures.totalLeaves === 2, "totalLeaves mismatch.");
    assert(mapFeatures.bounceCount === 1, "bounceCount mismatch.");
    assert(mapFeatures.averageDuration === 62.5, "averageDuration mismatch.");
    assert(mapFeatures.bounceRate === 0.5, "bounceRate mismatch.");
    console.log("✓ MapFeatures aggregates are 100% correct.");

    // 5. Run massive concurrent read latency test (1000 reads)
    console.log("\nRunning concurrent read latency test (1000 requests)...");
    const readCount = 1000;
    const startTime = process.hrtime.bigint();

    const readPromises: Promise<any>[] = [];
    for (let i = 0; i < readCount; i++) {
      if (i % 2 === 0) {
        readPromises.push(
          analyticsPrisma.playerFeatures.findUnique({
            where: { userId: testUserId },
          })
        );
      } else {
        readPromises.push(
          analyticsPrisma.mapFeatures.findUnique({
            where: { mapId: testMapId },
          })
        );
      }
    }

    await Promise.all(readPromises);
    const endTime = process.hrtime.bigint();

    const totalMs = Number(endTime - startTime) / 1_000_000;
    const avgLatency = totalMs / readCount;

    console.log(`SUCCESS: Performed ${readCount} reads concurrently!`);
    console.log(`Total duration: ${totalMs.toFixed(3)}ms`);
    console.log(`Average read latency: ${avgLatency.toFixed(3)}ms`);

    assert(avgLatency < 5.0, `Read latency is too high: ${avgLatency}ms (limit 5.0ms)`);
    console.log("✓ Read performance validation passed! (Average latency < 5ms)");

    // 6. Clean up test subjects
    console.log("\nCleaning up test records...");
    await cleanUp(testUserId, testMapId);
    console.log("SUCCESS: Clean up finished!");

    console.log("\n=== FEATURE STORE VERIFICATION PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("\n!!! VERIFICATION FAILED !!!", error);
    await cleanUp(testUserId, testMapId).catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

async function cleanUp(userId: string, mapId: string) {
  // Clear events & features
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId } });
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId } });
  await analyticsPrisma.rawEvent.deleteMany({ where: { userId } });

  // Delete from public (which replicates to analytics)
  await prisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

void main();

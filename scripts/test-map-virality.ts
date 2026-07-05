import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { computeMapViralityAndSticky } from "../server/analytics/features/map_virality.js";
import { MapProfileRepository } from "../server/analytics/models/MapProfile.js";
import "dotenv/config";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userIds: string[], mapId: string, matchIds: string[]) {
  // Clear features, events
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId } });
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { payload: { path: ["mapId"], equals: mapId } }
      ]
    }
  });

  // Clear operational DB
  await prisma.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } });
  await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  await prisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("=== STARTING MAP VIRALITY & STICKY FACTOR TESTS ===");

  const mapId = "test-virality-map-123";
  const userIds = [
    "user-virality-test-1",
    "user-virality-test-2",
    "user-virality-test-3",
    "user-virality-test-4"
  ];
  const matchIds = ["match-virality-1", "match-virality-2"];

  try {
    await connectRedis();

    // 1. Setup clean state
    console.log("Cleaning up previous test leftovers...");
    await cleanUp(userIds, mapId, matchIds);

    // 2. Create seed data in operational database
    console.log("Seeding operational database...");
    
    // Create users
    for (let i = 0; i < userIds.length; i++) {
      await prisma.user.create({
        data: {
          id: userIds[i],
          email: `virality.user.${i}@example.com`,
          username: `virality_user_${i}`,
          passwordHash: "dummy",
          displayName: `Tester ${i}`
        }
      });
    }

    // Create map
    await prisma.gameMap.create({
      data: {
        id: mapId,
        slug: "virality-test-map",
        name: "Virality Test Map",
        isPublished: true
      }
    });

    const now = new Date();

    // --- A. PREPARE EVENTS FOR STICKY FACTOR ---
    // Day 0: User 1 joins
    const timeDay0 = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago (Day 0)
    // Day 1: User 1, User 2 join
    const timeDay1 = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 10 * 60 * 1000); // 24 hours ago (Day 1)
    // Day 4: User 1, User 3 join
    const timeDay4 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000); // 4 days ago (Day 4)
    // Day 10: User 2 joins
    const timeDay10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000); // 10 days ago (Day 10)

    console.log("Seeding raw events for Sticky Factor...");
    const rawEvents = [
      // Day 0
      { id: "ev-sf-1", eventType: "MatchJoin", userId: userIds[0], timestamp: timeDay0, payload: { mapId, roomId: "r-sf-1" } },
      // Day 1
      { id: "ev-sf-2", eventType: "MatchJoin", userId: userIds[0], timestamp: timeDay1, payload: { mapId, roomId: "r-sf-2" } },
      { id: "ev-sf-3", eventType: "MatchJoin", userId: userIds[1], timestamp: timeDay1, payload: { mapId, roomId: "r-sf-2" } },
      // Day 4
      { id: "ev-sf-4", eventType: "MatchJoin", userId: userIds[0], timestamp: timeDay4, payload: { mapId, roomId: "r-sf-3" } },
      { id: "ev-sf-5", eventType: "MatchJoin", userId: userIds[2], timestamp: timeDay4, payload: { mapId, roomId: "r-sf-3" } },
      // Day 10
      { id: "ev-sf-6", eventType: "MatchJoin", userId: userIds[1], timestamp: timeDay10, payload: { mapId, roomId: "r-sf-4" } },
    ];

    for (const ev of rawEvents) {
      await analyticsPrisma.rawEvent.create({
        data: ev
      });
    }

    // --- B. PREPARE MATCHES FOR VIRALITY FACTOR ---
    // Match 1 (Day 1, weight = 3.0, 3 players, no early abandons -> K_1 = 2)
    console.log("Seeding Match 1 in operational DB...");
    await prisma.match.create({
      data: {
        id: matchIds[0],
        roomId: "room-v-1",
        mapId,
        status: "FINISHED",
        startedAt: timeDay1,
        endedAt: new Date(timeDay1.getTime() + 120 * 1000)
      }
    });

    // 3 players in Match 1
    for (let i = 0; i < 3; i++) {
      await prisma.matchPlayer.create({
        data: {
          id: `mp-m1-${i}`,
          matchId: matchIds[0],
          userId: userIds[i],
          playerId: `player-m1-${i}`,
          playerName: `Player M1 ${i}`,
          joinedAt: timeDay1,
          leftAt: new Date(timeDay1.getTime() + 120 * 1000)
        }
      });
    }

    // Match 2 (Day 4, weight = 1.5, 2 players, 1 early abandon -> K_2 = 1 * 0.5 = 0.5)
    console.log("Seeding Match 2 in operational DB...");
    await prisma.match.create({
      data: {
        id: matchIds[1],
        roomId: "room-v-2",
        mapId,
        status: "FINISHED",
        startedAt: timeDay4,
        endedAt: new Date(timeDay4.getTime() + 120 * 1000)
      }
    });

    // Player 1 (Host, stays 120s)
    await prisma.matchPlayer.create({
      data: {
        id: "mp-m2-0",
        matchId: matchIds[1],
        userId: userIds[0],
        playerId: "player-m2-0",
        playerName: "Player M2 0",
        joinedAt: timeDay4,
        leftAt: new Date(timeDay4.getTime() + 120 * 1000)
      }
    });

    // Player 4 (Stays 10s -> early abandon)
    await prisma.matchPlayer.create({
      data: {
        id: "mp-m2-1",
        matchId: matchIds[1],
        userId: userIds[3],
        playerId: "player-m2-1",
        playerName: "Player M2 1",
        joinedAt: timeDay4,
        leftAt: new Date(timeDay4.getTime() + 10 * 1000)
      }
    });

    // 3. Run computation
    console.log("Computing virality and sticky factor...");
    const result = await computeMapViralityAndSticky(mapId);
    
    assert(result !== null, "Computation returned null");
    console.log(`Computed Result: Sticky: ${result.stickyFactor}, Virality: ${result.viralityFactor}`);

    // Verify mathematical bounds
    // Expected Sticky = Weighted DAU / MAU = (12.5 / 26.5) / 3 = 0.1572
    // Expected Virality = ((2.0 * 3.0) + (0.5 * 1.5)) / 4.5 = 6.75 / 4.5 = 1.5
    console.log("Verifying calculation correctness...");
    assert(Math.abs(result.stickyFactor - 0.1572) < 0.01, `Sticky factor mismatch, got ${result.stickyFactor}, expected ~0.1572`);
    assert(Math.abs(result.viralityFactor - 1.5) < 0.01, `Virality factor mismatch, got ${result.viralityFactor}, expected 1.5`);
    console.log("✓ Calculations are mathematically correct!");

    // 4. Verify DB storage
    console.log("Verifying DB record in analytics.MapFeatures...");
    const dbRecord = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId }
    });
    assert(!!dbRecord, "DB Record not found");
    assert(dbRecord.stickyFactor === result.stickyFactor, "DB stickyFactor mismatch");
    assert(dbRecord.viralityFactor === result.viralityFactor, "DB viralityFactor mismatch");
    console.log("✓ Successfully saved to DB!");

    // 5. Verify caching and retrieval via repository
    console.log("Verifying retrieval and cache invalidation via repository...");
    const profile1 = await MapProfileRepository.getMapProfile(mapId);
    assert(!!profile1, "Failed to retrieve map profile");
    assert(profile1.stickyFactor === result.stickyFactor, "Profile stickyFactor mismatch");
    assert(profile1.viralityFactor === result.viralityFactor, "Profile viralityFactor mismatch");

    // Perform latency test on cached read (using 100 iterations to get a true average)
    console.log("Testing cached read latency (100 concurrent reads)...");
    const readCount = 100;
    const startHr = process.hrtime.bigint();
    const readPromises = [];
    for (let i = 0; i < readCount; i++) {
      readPromises.push(MapProfileRepository.getMapProfile(mapId));
    }
    await Promise.all(readPromises);
    const endHr = process.hrtime.bigint();
    const totalMs = Number(endHr - startHr) / 1_000_000;
    const avgLatency = totalMs / readCount;
    console.log(`Average cached read duration: ${avgLatency.toFixed(3)}ms (total: ${totalMs.toFixed(2)}ms for ${readCount} reads)`);
    assert(avgLatency < 5.0, `Cached read latency too high: ${avgLatency}ms (limit 5.0ms)`);
    console.log("✓ Profile repo integration and latency verification passed!");

    // 6. Clean up
    console.log("Cleaning up test data...");
    await cleanUp(userIds, mapId, matchIds);
    console.log("✓ Clean up successful.");

    console.log("=== ALL MAP VIRALITY & STICKY FACTOR TESTS PASSED ===");
    process.exit(0);
  } catch (err) {
    console.error("!!! INTEGRATION TEST FAILED !!!", err);
    await cleanUp(userIds, mapId, matchIds).catch(() => {});
    process.exit(1);
  } finally {
    await disconnectRedis();
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

void main();

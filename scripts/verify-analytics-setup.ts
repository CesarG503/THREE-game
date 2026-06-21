import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import pg from "pg";
import "dotenv/config";

async function main() {
  console.log("=== STARTING ANALYTICS VERIFICATION ===");

  const testUserId = "test-analytics-user-123";
  const testMapId = "test-analytics-map-456";

  try {
    // 1. Clear any existing test residue
    await cleanUp(testUserId, testMapId);

    // 2. Test User Replication (Insert)
    console.log("\nTesting User INSERT replication via trigger...");
    const createdUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: "test.analytics@example.com",
        username: "test_analytics_user",
        passwordHash: "dummyhash",
        displayName: "Initial Display Name",
      },
    });
    console.log(`User created in public schema: ${createdUser.id}`);

    // Wait slightly for trigger execution (it is synchronous in PostgreSQL, but let's check)
    const replicatedUser = await analyticsPrisma.user.findUnique({
      where: { id: testUserId },
    });

    if (!replicatedUser) {
      throw new Error("FAIL: User replication failed (User not found in analytics schema)");
    }
    console.log(`SUCCESS: User replicated to analytics! Username: ${replicatedUser.username}`);

    // 3. Test User Replication (Update)
    console.log("\nTesting User UPDATE replication...");
    await prisma.user.update({
      where: { id: testUserId },
      data: { displayName: "Updated Display Name" },
    });

    const replicatedUserUpdated = await analyticsPrisma.user.findUnique({
      where: { id: testUserId },
    });

    if (replicatedUserUpdated?.displayName !== "Updated Display Name") {
      throw new Error(`FAIL: User update replication failed. Expected 'Updated Display Name', got '${replicatedUserUpdated?.displayName}'`);
    }
    console.log("SUCCESS: User update replicated to analytics!");

    // 4. Test GameMap Replication (Insert & Update)
    console.log("\nTesting GameMap INSERT replication...");
    const createdMap = await prisma.gameMap.create({
      data: {
        id: testMapId,
        slug: "test-analytics-map",
        name: "Test Analytics Map",
        isPublished: false,
        ownerId: testUserId,
      },
    });
    console.log(`Map created in public schema: ${createdMap.id}`);

    const replicatedMap = await analyticsPrisma.gameMap.findUnique({
      where: { id: testMapId },
    });

    if (!replicatedMap) {
      throw new Error("FAIL: Map replication failed");
    }
    console.log(`SUCCESS: Map replicated to analytics! Name: ${replicatedMap.name}`);

    // Update map status
    await prisma.gameMap.update({
      where: { id: testMapId },
      data: { isPublished: true },
    });

    const replicatedMapUpdated = await analyticsPrisma.gameMap.findUnique({
      where: { id: testMapId },
    });

    if (!replicatedMapUpdated?.isPublished) {
      throw new Error("FAIL: Map update replication failed");
    }
    console.log("SUCCESS: Map update replicated to analytics (isPublished: true)!");

    // 5. Test Partitioned Event Logging
    console.log("\nTesting RawEvent insertion and partitioned routing...");
    const eventId = "test-event-uuid-789";
    const now = new Date();
    
    // We insert through analyticsPrisma
    const event = await analyticsPrisma.rawEvent.create({
      data: {
        id: eventId,
        eventType: "test_event",
        userId: testUserId,
        timestamp: now,
        payload: { testKey: "testValue", timestamp: now.toISOString() },
      },
    });
    console.log(`Event inserted into RawEvent: ${event.id}`);

    // Verify it exists in parent table
    const parentCheck = await analyticsPrisma.rawEvent.findUnique({
      where: {
        id_timestamp: {
          id: eventId,
          timestamp: now,
        },
      },
    });
    if (!parentCheck) {
      throw new Error("FAIL: Event not found in parent table RawEvent");
    }
    console.log("SUCCESS: Event found in parent table!");

    // Now query PG catalog directly to check if the row is inside the expected partition table
    console.log("Querying database catalog to verify physical partition storage...");
    const pgClient = new pg.Client({ connectionString: process.env.ANALYTICS_DATABASE_URL });
    await pgClient.connect();

    const expectedPartitionName = `RawEvent_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
    const partitionResult = await pgClient.query(
      `SELECT count(*) FROM analytics."${expectedPartitionName}" WHERE id = $1`,
      [eventId]
    );
    const count = parseInt(partitionResult.rows[0].count, 10);
    await pgClient.end();

    if (count !== 1) {
      throw new Error(`FAIL: Event was not routed to the correct partition table 'analytics."${expectedPartitionName}"'`);
    }
    console.log(`SUCCESS: Row verified physically stored inside partition table 'analytics."${expectedPartitionName}"'!`);

    // 6. Benchmarking write latency
    console.log("\nRunning write latency test (1000 events)...");
    const numEvents = 1000;
    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < numEvents; i++) {
      promises.push(
        analyticsPrisma.rawEvent.create({
          data: {
            id: `bench-event-${i}`,
            eventType: "benchmark_pulse",
            userId: testUserId,
            timestamp: new Date(),
            payload: { index: i, note: "performance latency check" },
          },
        })
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const avgLatency = totalDuration / numEvents;

    console.log(`SUCCESS: Inserted ${numEvents} events concurrently!`);
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Average write latency per event: ${avgLatency.toFixed(2)}ms`);

    if (avgLatency > 50) {
      console.log("WARNING: Average latency exceeded the 50ms goal.");
    } else {
      console.log("SUCCESS: Latency is well below the 50ms threshold!");
    }

    // 7. Clean up
    console.log("\nCleaning up test records...");
    await cleanUp(testUserId, testMapId);
    console.log("SUCCESS: Clean up finished!");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
  } catch (error) {
    console.error("\n!!! VERIFICATION FAILED !!!", error);
    // Attempt clean up anyway
    await cleanUp(testUserId, testMapId).catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

async function cleanUp(userId: string, mapId: string) {
  // Clear events
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { userId },
        { eventType: "benchmark_pulse" },
      ]
    }
  });

  // Delete from public (replicates to analytics)
  await prisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

void main();

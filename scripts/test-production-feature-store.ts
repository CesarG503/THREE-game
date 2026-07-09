import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { productionFeatureStore } from "../server/analytics/features/ProductionStore.js";
import { logger } from "../server/utils/Logger.js";
import assert from "assert";
import crypto from "node:crypto";

async function performDatabaseCleanup() {
  logger.info("TEST", "Starting clean up of test feature users...");
  try {
    await analyticsPrisma.playerFeatures.deleteMany({
      where: {
        userId: { startsWith: "test-prod-" },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-prod-" },
      },
    });
    logger.info("TEST", "✓ Database cleanup completed.");
  } catch (err) {
    logger.error("TEST", "Cleanup failed", err);
  }
}

async function run() {
  logger.info("TEST", "=== STARTING PRODUCTION FEATURE STORE INTEGRATION TEST ===");

  const userId = "test-prod-user-abc";
  await performDatabaseCleanup();

  // Ensure Redis client starts connected
  await productionFeatureStore.connect();
  const redisClient = (productionFeatureStore as any).redis;
  if (redisClient) {
    await redisClient.del(`analytics:features:user:${userId}`);
  }

  try {
    // 1. Create base operational user
    logger.info("TEST", "Creating base operational test user...");
    await prisma.user.create({
      data: {
        id: userId,
        email: "prod.feature@test.local",
        username: "prod_tester",
        passwordHash: "dummyhash",
        displayName: "Prod Tester",
      },
    });

    // 2. Validate Dual Writes (PostgreSQL + Redis Cache)
    logger.info("TEST", "1. Validating dual writes serialization and retrieval...");

    const featuresInput = {
      lastActive: new Date(),
      totalPlayTime: 1540.5,
      matchesPlayed: 45,
      matchesWon: 27,
      preferredLanguage: "es",
      explorerRatio: 0.72,
      playerProfile: "EXPLORER",
      popularitySensitivity: 0.15,
      returnIntent: 0.88,
      scheduleProfile: { weekdayRatio: 0.8, preferredHour: 20 },
      clusterId: "cluster-3",
      churnScore: 0.05,
      atRisk: false,
      temporalTag: "ACTIVE_EVENING",
      archetypeWeights: { explorer: 0.8, combat: 0.2 },
      collaborativeEmbedding: [0.12, -0.45, 0.78, 0.99],
    };

    logger.info("TEST", "Writing features to productionFeatureStore...");
    const writeResult = await productionFeatureStore.setPlayerFeatures(userId, featuresInput);
    assert(writeResult, "Write result must be returned");

    // Fetch from store
    logger.info("TEST", "Reading features back from productionFeatureStore...");
    const readResult = await productionFeatureStore.getPlayerFeatures(userId);
    assert(readResult, "Features must be fetched successfully");

    // Verify all datatypes deserialized properly
    assert.strictEqual(readResult.userId, userId);
    assert.strictEqual(readResult.matchesPlayed, 45, "Integer parsing failed");
    assert.strictEqual(readResult.totalPlayTime, 1540.5, "Float parsing failed");
    assert.strictEqual(readResult.preferredLanguage, "es", "String retrieval failed");
    assert.strictEqual(readResult.atRisk, false, "Boolean retrieval failed");
    assert.strictEqual(readResult.lastActive.toISOString(), featuresInput.lastActive.toISOString(), "Date parsing failed");
    assert.strictEqual(readResult.clusterId, "cluster-3", "Cluster ID failed");
    assert.deepStrictEqual(readResult.scheduleProfile, featuresInput.scheduleProfile, "JSON parsing failed");
    assert.deepStrictEqual(readResult.collaborativeEmbedding, featuresInput.collaborativeEmbedding, "JSON Array parsing failed");

    logger.info("TEST", "✓ Dual writes and serialization verification passed!");

    // 3. Validate Read-Through Cache miss warming
    logger.info("TEST", "2. Validating cache-miss read-through warming...");
    if (redisClient) {
      // Clear Redis cache manually
      await redisClient.del(`analytics:features:user:${userId}`);
      logger.info("TEST", "Cleared cache in Redis to trigger cache-miss.");

      // Fetch features (this will hit DB and write-back to Redis in background)
      const missReadResult = await productionFeatureStore.getPlayerFeatures(userId);
      assert(missReadResult, "Read result must be present on cache-miss");

      // Give background write-back a brief moment
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Query Redis directly to check if it has been warmed up
      const cachedHash = await redisClient.hGetAll(`analytics:features:user:${userId}`);
      assert(Object.keys(cachedHash).length > 0, "Redis cache should have been populated");
      assert.strictEqual(cachedHash.matchesPlayed, "45", "Cached value must exist in Redis");
      logger.info("TEST", "✓ Cache read-through warming verified!");
    }

    // 4. Validate Redis Failover / Fallback Resiliency
    logger.info("TEST", "3. Testing connection loss database fallback...");
    // Disconnect Redis
    await productionFeatureStore.disconnect();

    // Verify we can still read features directly from PostgreSQL without crashes
    const fallbackRead = await productionFeatureStore.getPlayerFeatures(userId);
    assert.strictEqual(fallbackRead.userId, userId);
    assert.strictEqual(fallbackRead.matchesWon, 27);
    logger.info("TEST", "✓ Successfully retrieved features via PostgreSQL fallback!");

    // Verify we can write/upsert features with Redis disconnected
    const fallbackWrite = await productionFeatureStore.setPlayerFeatures(userId, {
      matchesWon: 28,
    });
    assert.strictEqual(fallbackWrite.matchesWon, 28);
    logger.info("TEST", "✓ Successfully performed database writes during fallback!");

    // Reconnect Redis for latency testing
    await productionFeatureStore.connect();

    // 5. Benchmark Latency under concurrent load
    logger.info("TEST", "4. Running massive concurrent load latency benchmark (1,000 reads)...");
    const readCount = 1000;
    const startNanos = process.hrtime.bigint();

    const loadPromises: Promise<any>[] = [];
    for (let i = 0; i < readCount; i++) {
      loadPromises.push(productionFeatureStore.getPlayerFeatures(userId));
    }

    await Promise.all(loadPromises);
    const endNanos = process.hrtime.bigint();

    const elapsedMs = Number(endNanos - startNanos) / 1_000_000;
    const avgLatency = elapsedMs / readCount;

    logger.info("TEST", `Concurrently processed ${readCount} reads!`);
    logger.info("TEST", `Total duration: ${elapsedMs.toFixed(2)}ms`);
    logger.info("TEST", `Average read latency: ${avgLatency.toFixed(3)}ms`);

    assert(avgLatency < 2.0, `Average read latency of ${avgLatency.toFixed(3)}ms exceeds the 2ms threshold`);
    logger.info("TEST", "✓ Performance latencies are within optimal bounds (< 2.0ms)!");

    logger.info("TEST", "=== ALL FEATURE STORE PRODUCTION TESTS PASSED CLEANLY ===");
  } finally {
    // Shutdown Feature Store connection client
    await productionFeatureStore.disconnect();
    await performDatabaseCleanup();
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  logger.error("TEST", "✕ TEST EXECUTION FAILURE:", err);
  process.exit(1);
});

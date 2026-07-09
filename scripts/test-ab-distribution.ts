import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { abSdk } from "../server/analytics/experiments/ab_sdk.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { logger } from "../server/utils/Logger.js";
import crypto from "node:crypto";

// Helper function to generate mock gaussian random variables (Box-Muller transform)
function randomGaussian(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); 
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(1, mean + num * stdDev); // Bound to at least 1s
}

async function performDatabaseCleanup() {
  logger.info("TEST", "Cleaning up database test records...");
  
  // Delete mock events
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      userId: { startsWith: "test-ab-user-" }
    }
  });

  // Delete mock users
  await analyticsPrisma.playerFeatures.deleteMany({
    where: {
      userId: { startsWith: "test-ab-user-" }
    }
  });
  await analyticsPrisma.user.deleteMany({
    where: {
      id: { startsWith: "test-ab-user-" }
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: { startsWith: "test-ab-user-" }
    }
  });

  // Delete mock experiment
  await analyticsPrisma.experiment.deleteMany({
    where: {
      name: "lobby_recommender"
    }
  });
}

async function runTest() {
  logger.info("TEST", "Starting A/B Testing Infrastructure and SDK validation test...");

  // Warm up connections
  logger.info("TEST", "Warming up database connections...");
  await prisma.user.findMany({ take: 1 });
  await analyticsPrisma.user.findMany({ take: 1 });

  // Clean up any stale records first
  await performDatabaseCleanup();

  try {
    // ==========================================
    // VALIDATION 1: Uniform Allocation Verification (100,000 IDs)
    // ==========================================
    logger.info("TEST", "1. Running uniform distribution validation for 100,000 IDs...");
    
    // Inject a mock experiment with 50% split directly in cached map
    abSdk.clearCache();
    abSdk.setMockExperiment({
      id: "mock-exp-id",
      name: "test_split_uniformity",
      description: "Checks SHA-256 bucket allocation uniformity",
      isActive: true,
      splitA: 50,
    });

    let countA = 0;
    let countB = 0;
    const totalUsers = 100000;

    for (let i = 1; i <= totalUsers; i++) {
      const dummyUserId = `user-uuid-${i}`;
      const variant = abSdk.getVariant(dummyUserId, "test_split_uniformity");
      if (variant === "A") {
        countA++;
      } else {
        countB++;
      }
    }

    logger.info("TEST", `Allocation Results: Variant A = ${countA} | Variant B = ${countB}`);
    
    const deviation = Math.abs(countA - 50000);
    logger.info("TEST", `Deviation from perfect split (50,000): ${deviation} users (${(deviation / totalUsers * 100).toFixed(4)}%)`);

    if (deviation > 100) {
      throw new Error(`FAIL: Variant A allocation (${countA}) deviated by more than 100 from 50,000 target.`);
    }
    logger.info("TEST", "✓ SUCCESS: Uniform allocation check passed within +/- 100 limit!");

    // ==========================================
    // VALIDATION 2: Event Decoration Check
    // ==========================================
    logger.info("TEST", "2. Testing eventBuffer auto-decoration with active experiment variants...");
    
    // Configure mock experiment active
    abSdk.clearCache();
    abSdk.setMockExperiment({
      id: "lobby-exp-id",
      name: "lobby_recommender",
      description: "Testing hybrid friend recommender",
      isActive: true,
      splitA: 50,
    });

    // Push telemetry event
    const eventId = crypto.randomUUID();
    const pushSuccess = eventBuffer.push({
      id: eventId,
      eventType: "QueueEnter",
      userId: "test-ab-user-decorator",
      timestamp: new Date(),
      payload: { mode: "FFA" }
    });

    if (!pushSuccess) {
      throw new Error("FAIL: Failed to push event to EventBuffer");
    }

    // Retreive from buffer directly to check decoration
    const bufferedEvents = (eventBuffer as any).buffer;
    const decoratedEvent = bufferedEvents.find((e: any) => e.id === eventId);
    
    if (!decoratedEvent) {
      throw new Error("FAIL: Event was not found in buffer");
    }

    const assignedVariant = abSdk.getVariant("test-ab-user-decorator", "lobby_recommender");
    if (decoratedEvent.payload.ab_variants?.lobby_recommender !== assignedVariant) {
      throw new Error(`FAIL: Expected event payload to contain ab_variants.lobby_recommender = '${assignedVariant}', but got: ${JSON.stringify(decoratedEvent.payload.ab_variants)}`);
    }

    logger.info("TEST", `✓ SUCCESS: Event was successfully decorated with variant '${assignedVariant}'!`);
    eventBuffer.clear(); // Clear memory buffer

    // ==========================================
    // VALIDATION 3: End-to-End Database Ingestion and Offline Statistical Analysis
    // ==========================================
    logger.info("TEST", "3. Setting up database configs and records for offline analysis simulation...");

    // Insert the experiment config in the database
    await analyticsPrisma.experiment.create({
      data: {
        id: "lobby-recommender-db-id",
        name: "lobby_recommender",
        description: "A/B test on friend matchmaking recommendations",
        isActive: true,
        splitA: 50,
      }
    });

    // Re-sync SDK from database to prove DB fetch works
    await abSdk.syncFromDatabase();

    // Create 200 mock players (100 in A, 100 in B) and generate events
    // Variant A (Control): 60% conversion (matches formed), mean wait = 20s (stddev = 4s)
    // Variant B (Treatment): 80% conversion (matches formed), mean wait = 12s (stddev = 3s)
    logger.info("TEST", "Simulating and writing event telemetry data for 200 users...");
    
    const mockUsersCount = 200;
    const now = Date.now();

    for (let i = 1; i <= mockUsersCount; i++) {
      const userId = `test-ab-user-${i}`;
      const email = `ab_${i}@example.com`;
      const username = `ab_player_${i}`;

      // Insert User to satisfy foreign key constraints
      await prisma.user.create({
        data: {
          id: userId,
          email,
          username,
          passwordHash: "dummyhash",
        }
      });
      // Allow database trigger to replicate user to analytics
      await new Promise((resolve) => setTimeout(resolve, 10));

      const variant = abSdk.getVariant(userId, "lobby_recommender");
      const isSuccess = variant === "A" ? (Math.random() < 0.60) : (Math.random() < 0.80);
      const waitTime = variant === "A" ? randomGaussian(20, 4) : randomGaussian(12, 3);
      
      const timestamp = new Date(now - 1000 * 60 * i); // Offset timestamp to spread them

      // Write QueueLeave event directly to database
      await analyticsPrisma.rawEvent.create({
        data: {
          id: crypto.randomUUID(),
          eventType: "QueueLeave",
          userId,
          timestamp,
          payload: {
            reason: isSuccess ? "match_found" : "cancel_by_user",
            durationSeconds: isSuccess ? waitTime : null,
            ab_variants: {
              lobby_recommender: variant,
            }
          }
        }
      });
    }

    logger.info("TEST", "Successfully generated and wrote simulated events database records.");

    // Dynamic import of the analyzer module to trigger script analysis programmatically
    logger.info("TEST", "4. Executing experiment analyzer offline analysis script...");
    
    const { analyze } = await import("./analyze-experiment.js");
    await analyze("lobby_recommender");
    
    logger.info("TEST", "✓ SUCCESS: Database configs and telemetry simulated cleanly.");
  } catch (err) {
    logger.error("TEST", "FAILURE: Integration tests failed!", err);
    process.exit(1);
  } finally {
    await performDatabaseCleanup();
    abSdk.shutdown();
  }
}

runTest();

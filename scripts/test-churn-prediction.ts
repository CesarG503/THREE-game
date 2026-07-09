import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { evaluateUserChurn } from "../server/analytics/ml/churn_evaluator.js";
import { getHybridRecommendations, clearHybridCache } from "../server/services/HybridRecommender.js";
import { getSocialRecommendations } from "../server/services/SocialRecommender.js";
import { getCollaborativeRecommendations } from "../server/services/CollaborativeRecommender.js";
import { getContentRecommendations } from "../server/services/ContentRecommender.js";
import { roomManager } from "../server/managers/RoomManager.js";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { logger } from "../server/utils/Logger.js";
import crypto from "node:crypto";
import type { ServerResponse } from "node:http";

async function runTest() {
  logger.info("TEST", "Starting churn prediction integration test...");

  const userId = "test-churn-user-1";
  const friendId = "test-friend-user-1";
  const mapId = "test-churn-map-1";
  const roomId = "test-churn-room-1";
  const token = "a".repeat(64);

  // Clean up any stale data from previous runs
  await cleanup(userId, friendId, mapId, roomId, token);

  // Warm up connections
  logger.info("TEST", "Warming up database connections...");
  await prisma.user.findMany({ take: 1 });
  await analyticsPrisma.user.findMany({ take: 1 });

  try {
    // 1. Setup DB states
    logger.info("TEST", "1. Setting up database test records...");
    await prisma.user.create({
      data: {
        id: userId,
        email: "churn@example.com",
        username: "churn_player",
        passwordHash: "dummyhash",
        displayName: "Churn Player",
      },
    });

    await prisma.user.create({
      data: {
        id: friendId,
        email: "friend@example.com",
        username: "friend_player",
        passwordHash: "dummyhash",
        displayName: "Friend Player",
      },
    });

    // Create a published map
    await prisma.gameMap.create({
      data: {
        id: mapId,
        slug: "retention-oasis",
        name: "Retention Oasis",
        isPublished: true,
      },
    });

    // Setup social affinity (high affinity between user and friend)
    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: userId,
        userId2: friendId,
        affinity: 0.9,
      },
    });

    // Create session token
    await prisma.userSession.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Setup analytical PlayerFeatures (Veteran player base)
    await analyticsPrisma.playerFeatures.create({
      data: {
        userId,
        lastActive: new Date(),
        totalPlayTime: 9000, // 150 min
        matchesPlayed: 30,
        matchesWon: 15,
        churnScore: 0.1, // low initial churn risk
        atRisk: false,
      },
    });

    // Warm up the hybrid recommender (cold start pools, SVD model, etc.)
    logger.info("TEST", "Warming up all recommenders (cold start connection pools)...");
    try {
      await getHybridRecommendations(userId, { limit: 5 });
      await getSocialRecommendations(userId, { limit: 5 });
      await getCollaborativeRecommendations(userId, { limit: 5 });
      await getContentRecommendations(userId, { limit: 5 });
    } catch (e) {}

    // 2. Evaluate base churn (no recent events -> should be low)
    logger.info("TEST", "2. Evaluating base churn score...");
    let evaluation = await evaluateUserChurn(userId);
    logger.info("TEST", `Base churn probability: ${evaluation.churnProbability.toFixed(4)}, atRisk=${evaluation.atRisk}`);
    if (evaluation.atRisk) {
      throw new Error("Base churn risk should be FALSE.");
    }

    // 3. Simulate high churn behavior
    // Ingest SessionStart, then multiple short/abrupt game play sessions (low duration, MatchLeave, won: false)
    logger.info("TEST", "3. Simulating bad session events (losses & early leaves)...");
    const timestampStart = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const eventsToProcess = [
      {
        id: crypto.randomUUID(),
        eventType: "SessionStart",
        userId,
        timestamp: timestampStart,
        payload: {},
      },
      // Loss 1 (duration: 5s, leave, end)
      {
        id: crypto.randomUUID(),
        eventType: "MatchJoin",
        userId,
        timestamp: new Date(timestampStart.getTime() + 1 * 60 * 1000),
        payload: { roomId: "room1", mapId },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchLeave",
        userId,
        timestamp: new Date(timestampStart.getTime() + 1 * 60 * 1000 + 5000),
        payload: { roomId: "room1", mapId, durationSeconds: 5, reason: "quit" },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchEnd",
        userId,
        timestamp: new Date(timestampStart.getTime() + 1 * 60 * 1000 + 5000),
        payload: { roomId: "room1", mapId, durationSeconds: 5, won: false },
      },
      // Loss 2 (duration: 10s, leave, end)
      {
        id: crypto.randomUUID(),
        eventType: "MatchJoin",
        userId,
        timestamp: new Date(timestampStart.getTime() + 5 * 60 * 1000),
        payload: { roomId: "room2", mapId },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchLeave",
        userId,
        timestamp: new Date(timestampStart.getTime() + 5 * 60 * 1000 + 10000),
        payload: { roomId: "room2", mapId, durationSeconds: 10, reason: "quit" },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchEnd",
        userId,
        timestamp: new Date(timestampStart.getTime() + 5 * 60 * 1000 + 10000),
        payload: { roomId: "room2", mapId, durationSeconds: 10, won: false },
      },
      // Loss 3 (duration: 8s, leave, end)
      {
        id: crypto.randomUUID(),
        eventType: "MatchJoin",
        userId,
        timestamp: new Date(timestampStart.getTime() + 10 * 60 * 1000),
        payload: { roomId: "room3", mapId },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchLeave",
        userId,
        timestamp: new Date(timestampStart.getTime() + 10 * 60 * 1000 + 8000),
        payload: { roomId: "room3", mapId, durationSeconds: 8, reason: "quit" },
      },
      {
        id: crypto.randomUUID(),
        eventType: "MatchEnd",
        userId,
        timestamp: new Date(timestampStart.getTime() + 10 * 60 * 1000 + 8000),
        payload: { roomId: "room3", mapId, durationSeconds: 8, won: false },
      },
    ];

    // Feed events directly to eventWorker to simulate background processing
    await eventWorker.processBatch(eventsToProcess);

    // Wait a moment for background asynchronous processing of churn evaluation to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Re-evaluate churn. The event processing should automatically trigger evaluateUserChurn,
    // but let's call it manually/assert DB state to be sure.
    logger.info("TEST", "4. Verifying DB churn update after events...");
    const updatedFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId },
    });

    logger.info("TEST", `Updated features: churnScore=${updatedFeatures?.churnScore}, atRisk=${updatedFeatures?.atRisk}`);
    if (!updatedFeatures?.atRisk || (updatedFeatures.churnScore || 0) < 0.85) {
      throw new Error(`Churn risk update failed. Score is: ${updatedFeatures?.churnScore}`);
    }

    // 5. Test social recommendations prioritisation
    logger.info("TEST", "5. Mocking friend active room session...");
    // Put friend-user-1 in roomManager playing map test-churn-map-1
    await prisma.match.create({
      data: {
        id: "active-match-1",
        roomId,
        mapId,
        status: "RUNNING",
      },
    });

    const mockWs = {
      readyState: 1, // OPEN
      userId: friendId,
      send: () => {},
      on: () => {},
    } as any;

    roomManager.addPlayer(roomId, "friend-conn-id-1", "Friend Active", { x: 0, y: 0, z: 0 }, mockWs);

    logger.info("TEST", "6. Fetching hybrid recommendations under churn risk...");
    clearHybridCache();
    const recs = await getHybridRecommendations(userId, { limit: 5 });
    logger.info("TEST", `Recommendations count: ${recs.length}`);
    const oasisRec = recs.find((r) => r.id === mapId);
    if (!oasisRec || oasisRec.score < 0.5) {
      throw new Error("Active friend map should be recommended with high priority / score due to weight override.");
    }
    logger.info("TEST", `Oasis map recommended with score: ${oasisRec.score.toFixed(4)}, friends: ${JSON.stringify(oasisRec.friendsPlaying)}`);

    // 6. Test HTTP endpoint returns metadata
    logger.info("TEST", "7. Fetching hybrid endpoint GET /api/recommendations/hybrid...");
    let responseData: any = null;
    const reqMock = {
      method: "GET",
      url: `/api/recommendations/hybrid`,
      headers: {
        host: "localhost",
        authorization: `Bearer ${token}`,
      },
    } as any;

    const resMock = {
      writeHead: (status: number, headers?: any) => {
        logger.info("TEST", `API Response status: ${status}`);
      },
      setHeader: (name: string, value: string) => {},
      end: (data: string | Buffer) => {
        responseData = JSON.parse(data.toString());
      },
    } as any;

    await handleHttpRequest(reqMock, resMock);

    logger.info("TEST", `Response: ${JSON.stringify(responseData)}`);
    if (!responseData?.retentionIncentiveActive) {
      throw new Error("API Response missing retentionIncentiveActive flag.");
    }
    if (!responseData?.incentiveMessage) {
      throw new Error("API Response missing incentiveMessage.");
    }

    logger.info("TEST", "SUCCESS: All assertions passed successfully!");
  } catch (err) {
    logger.error("TEST", "FAILURE: Churn prediction integration test failed!", err);
    process.exit(1);
  } finally {
    logger.info("TEST", "Cleaning up database and memory mock states...");
    roomManager.removePlayer(roomId, "friend-conn-id-1");
    await cleanup(userId, friendId, mapId, roomId, token);
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

async function cleanup(userId: string, friendId: string, mapId: string, roomId: string, token: string) {
  const safeDelete = async (name: string, fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (err: any) {
      logger.debug("CLEANUP", `Safe delete failed for ${name}: ${err?.message}`);
    }
  };

  await safeDelete("sessions", () => prisma.userSession.deleteMany({ where: { userId } }));
  await safeDelete("matchPlayers", () => prisma.matchPlayer.deleteMany({ where: { match: { roomId } } }));
  await safeDelete("matches", () => prisma.match.deleteMany({ where: { roomId } }));
  await safeDelete("active-match", () => prisma.match.deleteMany({ where: { id: "active-match-1" } }));
  await safeDelete("gameMaps", () => prisma.gameMap.deleteMany({ where: { id: mapId } }));
  await safeDelete("analyticsMaps", () => analyticsPrisma.gameMap.deleteMany({ where: { id: mapId } }));
  await safeDelete("rawEvents", () => analyticsPrisma.rawEvent.deleteMany({ where: { userId } }));
  await safeDelete("affinities", () => analyticsPrisma.socialAffinity.deleteMany({
    where: {
      OR: [
        { userId1: userId, userId2: friendId },
        { userId1: friendId, userId2: userId },
      ],
    },
  }));
  await safeDelete("features", () => analyticsPrisma.playerFeatures.deleteMany({ where: { userId } }));
  await safeDelete("operationalUsers", () => prisma.user.deleteMany({
    where: {
      OR: [
        { id: userId },
        { id: friendId },
        { email: "churn@example.com" },
        { email: "friend@example.com" },
        { username: "churn_player" },
        { username: "friend_player" },
      ],
    },
  }));
  await safeDelete("analyticsUsers", () => analyticsPrisma.user.deleteMany({
    where: {
      OR: [
        { id: userId },
        { id: friendId },
        { email: "churn@example.com" },
        { email: "friend@example.com" },
        { username: "churn_player" },
        { username: "friend_player" },
      ],
    },
  }));
}

runTest();

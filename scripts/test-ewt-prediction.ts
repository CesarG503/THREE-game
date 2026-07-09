import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { ewtCalculator } from "../server/services/matchmaking/ewt_calculator.js";
import { matchmaker } from "../server/services/Matchmaker.js";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { logger } from "../server/utils/Logger.js";
import crypto from "node:crypto";

async function performCleanup() {
  logger.info("TEST", "Performing database cleanup...");
  // Delete events referencing the test user or details
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { userId: "test-ewt-user" },
        { user: { email: "ewt@example.com" } },
        { user: { username: "ewt_player" } }
      ]
    }
  });

  // Delete features
  await analyticsPrisma.playerFeatures.deleteMany({
    where: {
      OR: [
        { userId: "test-ewt-user" },
        { user: { email: "ewt@example.com" } },
        { user: { username: "ewt_player" } }
      ]
    }
  });

  // Delete from analytics user table
  await analyticsPrisma.user.deleteMany({
    where: {
      OR: [
        { id: "test-ewt-user" },
        { email: "ewt@example.com" },
        { username: "ewt_player" }
      ]
    }
  });

  // Delete from operational user table
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: "test-ewt-user" },
        { email: "ewt@example.com" },
        { username: "ewt_player" }
      ]
    }
  });
}

async function runTest() {
  logger.info("TEST", "Starting EWT Prediction and Ticket Polling integration test...");

  // Warm up connections
  logger.info("TEST", "Warming up database connections...");
  await prisma.user.findMany({ take: 1 });
  await analyticsPrisma.user.findMany({ take: 1 });

  // Clean up any stale test events/users
  await performCleanup();

  try {
    // Setup user in the operational database (triggers will replicate to analytics)
    logger.info("TEST", "0. Creating test user record...");
    await prisma.user.create({
      data: {
        id: "test-ewt-user",
        email: "ewt@example.com",
        username: "ewt_player",
        passwordHash: "dummyhash",
      },
    });

    // Wait a brief moment to ensure trigger replication settles
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 1. Insert historical matchmaking events
    logger.info("TEST", "1. Inserting mock QueueLeave matchmaking telemetry...");
    const testEvents = [
      { durationSeconds: 30, timestamp: new Date(Date.now() - 1000 * 60 * 5) },
      { durationSeconds: 25, timestamp: new Date(Date.now() - 1000 * 60 * 4) },
      { durationSeconds: 20, timestamp: new Date(Date.now() - 1000 * 60 * 3) },
      { durationSeconds: 15, timestamp: new Date(Date.now() - 1000 * 60 * 2) },
      { durationSeconds: 10, timestamp: new Date(Date.now() - 1000 * 60 * 1) }, // most recent
    ];

    for (const evt of testEvents) {
      await analyticsPrisma.rawEvent.create({
        data: {
          id: crypto.randomUUID(),
          eventType: "QueueLeave",
          userId: "test-ewt-user",
          timestamp: evt.timestamp,
          payload: {
            reason: "match_found",
            region: "us-east",
            skillScore: 0.50, // MEDIUM bracket
            gameMode: "FFA",
            durationSeconds: evt.durationSeconds,
          },
        },
      });
    }

    // 2. Sync EWT Calculator from DB
    logger.info("TEST", "2. Syncing EWT Calculator...");
    await ewtCalculator.syncFromDatabase();

    // 3. Test mathematical regressor (WMA)
    logger.info("TEST", "3. Testing WMA calculation...");
    const initialEWT = ewtCalculator.calculateEWT("us-east", "FFA", 0.50);
    logger.info("TEST", `Initial EWT: ${JSON.stringify(initialEWT)}`);

    // Weighted Moving Average calculation details:
    // List: 10, 15, 20, 25, 30 (newest first)
    // Weights: 5, 4, 3, 2, 1
    // Total Weight = 15
    // Sum = (10*5) + (15*4) + (20*3) + (25*2) + (30*1) = 50 + 60 + 60 + 50 + 30 = 250
    // WMA = 250 / 15 = 16.67 seconds
    // Let's assert that the calculated wait time is close to 16.67s (estimatedWaitMs = 16667)
    if (Math.abs(initialEWT.estimatedWaitMs - 16667) > 500) {
      throw new Error(`Expected EWT to be around 16.67s (16667ms), but got ${initialEWT.estimatedWaitMs}ms`);
    }

    // 4. Test real-time recording updates WMA
    logger.info("TEST", "4. Recording new real-time match (8s) and checking updates...");
    ewtCalculator.recordMatchedWaitTime("us-east", "FFA", 0.50, 8);
    const updatedEWT = ewtCalculator.calculateEWT("us-east", "FFA", 0.50);
    logger.info("TEST", `Updated EWT: ${JSON.stringify(updatedEWT)}`);
    // List now: 8, 10, 15, 20, 25, 30
    // Weights: 6, 5, 4, 3, 2, 1 (Total = 21)
    // Sum = 8*6 + 10*5 + 15*4 + 20*3 + 25*2 + 30*1 = 48 + 50 + 60 + 60 + 50 + 30 = 298
    // WMA = 298 / 21 = 14.19 seconds
    if (Math.abs(updatedEWT.estimatedWaitMs - 14190) > 500) {
      throw new Error(`Expected updated EWT to be around 14.19s, but got ${updatedEWT.estimatedWaitMs}ms`);
    }

    // 5. Test queue proximity adjustment (queue length >= minPlayers - 1)
    logger.info("TEST", "5. Testing queue size adjustment...");
    const proximityEWT = ewtCalculator.calculateEWT("us-east", "FFA", 0.50, 1, 2);
    logger.info("TEST", `Proximity EWT (1 player waiting, minPlayers=2): ${JSON.stringify(proximityEWT)}`);
    if (proximityEWT.minSeconds !== 2 || proximityEWT.maxSeconds !== 6) {
      throw new Error(`Expected proximity EWT range to be 2-6s, but got ${proximityEWT.estimatedWaitRange}`);
    }

    // 6. Test GET /api/matchmaker/ewt API Route
    logger.info("TEST", "6. Testing HTTP GET /api/matchmaker/ewt...");
    let ewtResponse: any = null;
    const reqEwt = {
      method: "GET",
      url: "/api/matchmaker/ewt?region=us-east&skillScore=0.50",
      headers: { host: "localhost" },
    } as any;
    const resEwt = {
      writeHead: () => {},
      setHeader: () => {},
      end: (data: string | Buffer) => {
        ewtResponse = JSON.parse(data.toString());
      },
    } as any;

    await handleHttpRequest(reqEwt, resEwt);
    logger.info("TEST", `EWT API Response: ${JSON.stringify(ewtResponse)}`);
    if (!ewtResponse || !ewtResponse.estimatedWaitRange) {
      throw new Error("EWT API returned invalid or empty response");
    }

    // 7. Test Ticket Polling API Route
    logger.info("TEST", "7. Testing HTTP GET /api/matchmaker/ticket polling...");
    matchmaker.clear();

    // Join queue to create a ticket
    const ticket = matchmaker.joinQueue({
      userId: "test-ewt-user",
      region: "us-east",
      skillScore: 0.50,
    });

    let ticketResponse: any = null;
    const reqTicket = {
      method: "GET",
      url: `/api/matchmaker/ticket?ticketId=${ticket.ticketId}`,
      headers: { host: "localhost" },
    } as any;
    const resTicket = {
      writeHead: () => {},
      setHeader: () => {},
      end: (data: string | Buffer) => {
        ticketResponse = JSON.parse(data.toString());
      },
    } as any;

    // Check waiting status
    await handleHttpRequest(reqTicket, resTicket);
    logger.info("TEST", `Ticket Polling (waiting) Response: ${JSON.stringify(ticketResponse)}`);
    if (ticketResponse.status !== "waiting" || ticketResponse.queuePosition !== 1) {
      throw new Error(`Expected ticket status 'waiting' at position 1, got status '${ticketResponse.status}', pos: ${ticketResponse.queuePosition}`);
    }

    // Match the ticket manually by setting it in matchedTickets Map
    const mockMatchResult = {
      roomId: "test-ewt-room-id",
      region: "us-east",
      players: [{ ticketId: ticket.ticketId, userId: "test-ewt-user", playerId: "test-ewt-p" }],
      averageLatency: 20,
      skillDisparity: 0,
      languageHomogeneity: 1.0,
    };
    (matchmaker as any).ticketIndex.delete(ticket.ticketId);
    (matchmaker as any).setMatchedTicket(ticket.ticketId, mockMatchResult);

    // Check matched status
    await handleHttpRequest(reqTicket, resTicket);
    logger.info("TEST", `Ticket Polling (matched) Response: ${JSON.stringify(ticketResponse)}`);
    if (ticketResponse.status !== "matched" || ticketResponse.match.roomId !== "test-ewt-room-id") {
      throw new Error(`Expected ticket status 'matched' with roomId 'test-ewt-room-id', got status '${ticketResponse.status}', match: ${JSON.stringify(ticketResponse.match)}`);
    }

    logger.info("TEST", "SUCCESS: All wait-time prediction and ticket polling test assertions passed!");
  } catch (err) {
    logger.error("TEST", "FAILURE: Integration tests failed!", err);
    process.exit(1);
  } finally {
    await performCleanup();
    matchmaker.clear();
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
    process.exit(0);
  }
}

runTest();

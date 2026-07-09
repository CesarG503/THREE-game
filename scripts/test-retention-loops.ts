import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { abSdk } from "../server/analytics/experiments/ab_sdk.js";
import { notificationSystem } from "../server/services/NotificationSystem.js";
import { roomManager } from "../server/managers/RoomManager.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { logger } from "../server/utils/Logger.js";
import { handleJoinRoom } from "../server/handlers/Joinroom.js";
import { MessageRouter } from "../server/handlers/MessageRouter.js";
import { registerHandlers } from "../server/handlers/Handlers.js";
import type { ExtendedWebSocket } from "../server/types.js";
import assert from "assert";
import crypto from "node:crypto";
import { WebSocket } from "ws";

async function performDatabaseCleanup() {
  logger.info("TEST", "Starting retention test database cleanup...");
  try {
    // 1. Delete session records
    await prisma.userSession.deleteMany({
      where: {
        userId: { startsWith: "test-ret-" },
      },
    });

    // 2. Delete matches and players
    await prisma.matchPlayer.deleteMany({
      where: {
        userId: { startsWith: "test-ret-" },
      },
    });

    await prisma.match.deleteMany({
      where: {
        roomId: { startsWith: "room-ret-" },
      },
    });

    // 3. Delete maps
    await prisma.gameMap.deleteMany({
      where: {
        id: { startsWith: "test-map-ret-" },
      },
    });

    // 4. Delete affinity
    await analyticsPrisma.socialAffinity.deleteMany({
      where: {
        OR: [
          { userId1: { startsWith: "test-ret-" } },
          { userId2: { startsWith: "test-ret-" } },
        ],
      },
    });

    // 5. Delete experiments
    await analyticsPrisma.experiment.deleteMany({
      where: {
        name: "notification_copy_experiment",
      },
    });

    // 6. Delete users
    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-ret-" },
      },
    });

    logger.info("TEST", "✓ Database cleanup completed.");
  } catch (err) {
    logger.error("TEST", "Database cleanup failed", err);
  }
}

async function run() {
  logger.info("TEST", "=== STARTING RETENTION LOOPS TEST ===");

  const userAId = "test-ret-user-a";
  const userBId = "test-ret-user-b";
  const tokenA = crypto.randomBytes(32).toString("hex");
  const tokenB = crypto.randomBytes(32).toString("hex");

  await performDatabaseCleanup();

  // Clear memory stores before starting
  notificationSystem.clearRegistry();
  notificationSystem.clearHistory();

  try {
    // 1. Setup Experiment in DB
    logger.info("TEST", "Setting up notification experiment configurations...");
    await analyticsPrisma.experiment.create({
      data: {
        name: "notification_copy_experiment",
        isActive: true,
        splitA: 50,
      },
    });

    // Warm up the A/B SDK so it caches the experiment
    await abSdk.initialize();

    // 2. Create users
    logger.info("TEST", "Creating test users...");
    await prisma.user.create({
      data: {
        id: userAId,
        email: `${userAId}@test.local`,
        username: "user_a",
        passwordHash: "pass",
        displayName: "Jugador A",
      },
    });

    await prisma.user.create({
      data: {
        id: userBId,
        email: `${userBId}@test.local`,
        username: "user_b",
        passwordHash: "pass",
        displayName: "Jugador B",
      },
    });

    // 3. Create active sessions
    logger.info("TEST", "Generating user sessions...");
    const oneDay = 24 * 60 * 60 * 1000;
    await prisma.userSession.create({
      data: {
        id: "sess-ret-a",
        token: tokenA,
        userId: userAId,
        expiresAt: new Date(Date.now() + oneDay),
      },
    });

    await prisma.userSession.create({
      data: {
        id: "sess-ret-b",
        token: tokenB,
        userId: userBId,
        expiresAt: new Date(Date.now() + oneDay),
      },
    });

    // 4. Create high social affinity (A <-> B)
    logger.info("TEST", "Inserting high social affinity (affinity = 0.9)...");
    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: userAId,
        userId2: userBId,
        affinity: 0.9,
      },
    });

    // --- TEST PART 1: WebSocket Registry & Client Notifications ---
    logger.info("TEST", "1. Validating socket registration & notifications...");

    const receivedNotifications: any[] = [];
    const wsB = {
      readyState: WebSocket.OPEN,
      send: (msgStr: string) => {
        const msg = JSON.parse(msgStr);
        logger.info("TEST", `Client B received WS message: ${msgStr}`);
        receivedNotifications.push(msg);
      },
      playerId: "player-b-id",
      roomId: "lobby",
      userId: userBId,
    } as any as ExtendedWebSocket;

    // Connect and register User B (recipient)
    notificationSystem.registerSocket(userBId, wsB);
    assert.strictEqual(notificationSystem.isUserActive(userBId), true, "User B should be marked active");

    // Clear history to verify rate limits from clean state
    notificationSystem.clearHistory();

    // Now user A connects/joins the room. This should trigger the trigger to notify user B.
    const wsA = {
      readyState: WebSocket.OPEN,
      send: () => {},
      playerId: "player-a-id",
      roomId: "lobby",
      userId: null,
    } as any as ExtendedWebSocket;

    logger.info("TEST", "Simulating user A entering the lobby...");
    await handleJoinRoom(wsA, { type: "joinRoom", roomId: "room-ret-lobby", token: tokenA, playerName: "Jugador A" }, roomManager);

    // Give asynchronous trigger a brief moment to process
    await new Promise((resolve) => setTimeout(resolve, 300));

    // User B should have received the "friend_online" notification
    assert.strictEqual(receivedNotifications.length, 1, "User B should have received exactly one notification");
    const firstNotif = receivedNotifications[0];
    assert.strictEqual(firstNotif.type, "notification");
    assert.strictEqual(firstNotif.title, "¡Alerta de Amigo!");
    assert(firstNotif.body.includes("Jugador A"), "Body must contain A's name");
    assert.strictEqual(firstNotif.campaignName, "notification_copy_experiment");
    logger.info("TEST", `✓ User B received notification: "${firstNotif.body}" (Variant: ${firstNotif.variant})`);

    // --- TEST PART 2: Rate Limiting Bounds ---
    logger.info("TEST", "2. Checking rate limiting boundaries (max 2 per hour)...");

    // First notification was already sent. Let's send a second one.
    const secondSent = notificationSystem.sendNotification(userBId, "map_milestone", {
      mapName: "Super Arena",
      visits: 100,
    });
    assert.strictEqual(secondSent, true, "Second notification should be allowed");

    // Attempt a third one. It should hit rate-limiting and return false.
    const thirdSent = notificationSystem.sendNotification(userBId, "friend_online", {
      friendName: "Jugador C",
    });
    assert.strictEqual(thirdSent, false, "Third notification within an hour should be dropped (rate-limited)");
    logger.info("TEST", "✓ Rate limit of 2 notifications per hour correctly enforced!");

    // --- TEST PART 3: Conversion CTR Tracking ---
    logger.info("TEST", "3. Testing click conversion log injection...");

    const router = new MessageRouter();
    registerHandlers(router);

    // User B clicks the first notification they received
    const clickMessage = {
      type: "notificationClick",
      notificationId: firstNotif.id,
      campaignName: firstNotif.campaignName,
      variant: firstNotif.variant,
    };

    const ctx = {
      ws: wsB,
      roomId: "lobby",
      playerId: "player-b-id",
      room: roomManager,
    };

    logger.info("TEST", "Simulating notificationClick message dispatch...");
    await router.dispatch(ctx, clickMessage);

    // Let's verify events in the EventBuffer
    const events = (eventBuffer as any).buffer;
    const sentEvent = events.find((ev) => ev.eventType === "NotificationSent" && ev.userId === userBId);
    const clickEvent = events.find((ev) => ev.eventType === "NotificationClick" && ev.userId === userBId);

    assert(sentEvent, "NotificationSent telemetry event must be recorded");
    assert(clickEvent, "NotificationClick telemetry event must be recorded");
    assert.strictEqual(clickEvent.payload.notificationId, firstNotif.id);
    assert.strictEqual(clickEvent.payload.variant, firstNotif.variant);

    logger.info("TEST", "✓ Telemetry event logs recorded successfully in Buffer!");

    // --- CLEANUP WebSocket active connections ---
    logger.info("TEST", "Cleaning up WebSocket registry connections...");
    notificationSystem.unregisterSocket(userBId, wsB);
    assert.strictEqual(notificationSystem.isUserActive(userBId), false, "User B should no longer be active");

    logger.info("TEST", "=== ALL RETENTION LOOPS TESTS PASSED CLEANLY ===");
  } finally {
    abSdk.shutdown();
    await performDatabaseCleanup();
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  logger.error("TEST", "✕ TEST EXECUTION FAILURE:", err);
  process.exit(1);
});

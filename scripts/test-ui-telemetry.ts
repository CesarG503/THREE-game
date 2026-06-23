import { handleHttpRequest } from "../server/http/ApiServer.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import crypto from "node:crypto";
import "dotenv/config";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockRequest(method: string, pathname: string, body: any): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = pathname;
  
  const payloadStr = JSON.stringify(body);
  req.push(Buffer.from(payloadStr));
  req.push(null);
  return req;
}

function mockResponse(req: IncomingMessage): { res: ServerResponse; getPayload: () => Promise<{ status: number; body: string }> } {
  const res = new ServerResponse(req);
  let status = 200;
  let body = "";

  res.writeHead = (statusCode: number, headers?: any) => {
    status = statusCode;
    return res;
  };

  const finishPromise = new Promise<{ status: number; body: string }>((resolve) => {
    res.end = (chunk?: any, encoding?: any, cb?: any) => {
      if (chunk) {
        body += chunk.toString("utf8");
      }
      resolve({ status, body });
      return res;
    };
  });

  return { res, getPayload: () => finishPromise };
}

async function main() {
  console.log("=== STARTING UI TELEMETRY TESTS ===");

  const testUserId = "ui-test-user-888";
  
  try {
    await connectRedis();
    eventBuffer.start(100);
    eventWorker.start();

    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "ui.test@example.com",
        username: "ui_tester",
        passwordHash: "dummyhash",
      },
    });

    const eventsToTest = [
      {
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: testUserId,
        timestamp: new Date().toISOString(),
        payload: { elementId: "map-desert-1", elementType: "map_card", visibleTimeMs: 1500 }
      },
      {
        id: crypto.randomUUID(),
        eventType: "UiClick",
        userId: testUserId,
        timestamp: new Date().toISOString(),
        payload: { elementId: "map-desert-1", elementType: "map_card", action: "play_map" }
      },
      {
        id: crypto.randomUUID(),
        eventType: "UiScrollDepth",
        userId: testUserId,
        timestamp: new Date().toISOString(),
        payload: { page: "lobby_catalog", maxDepthPercent: 75 }
      }
    ];

    for (const event of eventsToTest) {
      console.log(`\n--- TEST: Valid ${event.eventType} ---`);
      const req = mockRequest("POST", "/api/analytics/event", event);
      const { res, getPayload } = mockResponse(req);
      await handleHttpRequest(req, res);
      const output = await getPayload();
      assert(output.status === 202, `Expected status 202, got ${output.status}`);
    }

    // Verify DB
    console.log("\nWaiting for worker to write to database...");
    let dbEventCount = 0;
    for (let attempts = 0; attempts < 30; attempts++) {
      await sleep(100);
      const count = await analyticsPrisma.rawEvent.count({
        where: { id: { in: eventsToTest.map(e => e.id) } },
      });
      dbEventCount = count;
      if (dbEventCount === 3) break;
    }

    assert(dbEventCount === 3, `Expected 3 events in DB, found ${dbEventCount}`);
    console.log("✓ Events successfully verified in PostgreSQL analytics.RawEvent table!");

    // Clean up
    console.log("\nCleaning up...");
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: { in: eventsToTest.map(e => e.id) } } });
    
    console.log("\n=== ALL UI TELEMETRY TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (err) {
    console.error("\n!!! INTEGRATION TESTS FAILED !!!", err);
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    process.exit(1);
  } finally {
    eventBuffer.stop();
    eventWorker.stop();
    await disconnectRedis();
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

void main();

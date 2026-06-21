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
  console.log("=== STARTING GAME INTERACTION TELEMETRY TESTS ===");

  const testUserId = "interaction-test-user-999";
  
  try {
    await connectRedis();
    eventBuffer.start(100);
    eventWorker.start(100);

    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "match.test@example.com",
        username: "match_tester",
        passwordHash: "dummyhash",
      },
    });

    // --- TEST A: Valid MatchStart ---
    console.log("\n--- TEST A: Valid MatchStart ---");
    const eventIdStart = crypto.randomUUID();
    const validStartEvent = {
      id: eventIdStart,
      eventType: "MatchStart",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        roomId: "test-room-xyz",
        mapId: "desert-ruins-1",
        gameMode: "deathmatch"
      },
    };

    const reqA = mockRequest("POST", "/api/analytics/event", validStartEvent);
    const { res: resA, getPayload: getPayloadA } = mockResponse(reqA);
    await handleHttpRequest(reqA, resA);
    const outputA = await getPayloadA();
    assert(outputA.status === 202, `Expected status 202, got ${outputA.status}`);
    
    // --- TEST B: Valid MatchEnd ---
    console.log("\n--- TEST B: Valid MatchEnd ---");
    const eventIdEnd = crypto.randomUUID();
    const validEndEvent = {
      id: eventIdEnd,
      eventType: "MatchEnd",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        roomId: "test-room-xyz",
        mapId: null, // Test nullable
        durationSeconds: 120,
        winningTeam: "red"
      },
    };

    const reqB = mockRequest("POST", "/api/analytics/event", validEndEvent);
    const { res: resB, getPayload: getPayloadB } = mockResponse(reqB);
    await handleHttpRequest(reqB, resB);
    const outputB = await getPayloadB();
    assert(outputB.status === 202, `Expected status 202, got ${outputB.status}`);

    // Verify DB
    console.log("\nWaiting for worker to write to database...");
    let dbEvent = null;
    for (let attempts = 0; attempts < 30; attempts++) {
      await sleep(100);
      dbEvent = await analyticsPrisma.rawEvent.findUnique({
        where: {
          id_timestamp: {
            id: eventIdEnd,
            timestamp: new Date(validEndEvent.timestamp),
          },
        },
      });
      if (dbEvent) break;
    }

    assert(!!dbEvent, "Event was not written to analytics database.");
    console.log("✓ Event successfully verified in PostgreSQL analytics.RawEvent table!");

    // Clean up
    console.log("\nCleaning up...");
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: eventIdStart } });
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: eventIdEnd } });
    
    console.log("\n=== ALL INTERACTION TELEMETRY TESTS PASSED SUCCESSFULLY ===");
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

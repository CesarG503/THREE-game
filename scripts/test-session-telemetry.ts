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
  console.log("=== STARTING SESSION TELEMETRY INTEGRATION TESTS ===");

  const testUserId = "session-test-user-999";
  
  try {
    await connectRedis();
    eventBuffer.start(100);
    eventWorker.start();

    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "session.test@example.com",
        username: "session_tester",
        passwordHash: "dummyhash",
      },
    });

    // --- TEST A: Valid SessionEnd ---
    console.log("\n--- TEST A: Valid SessionEnd ---");
    const eventIdEnd = crypto.randomUUID();
    const validEndEvent = {
      id: eventIdEnd,
      eventType: "SessionEnd",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        durationSeconds: 300,
        idleSeconds: 15,
        usefulSeconds: 285
      },
    };

    const reqA = mockRequest("POST", "/api/analytics/event", validEndEvent);
    const { res: resA, getPayload: getPayloadA } = mockResponse(reqA);
    await handleHttpRequest(reqA, resA);
    const outputA = await getPayloadA();
    assert(outputA.status === 202, `Expected status 202, got ${outputA.status}`);
    
    // --- TEST B: Valid SessionHeartbeat ---
    console.log("\n--- TEST B: Valid SessionHeartbeat ---");
    const eventIdHb = crypto.randomUUID();
    const validHbEvent = {
      id: eventIdHb,
      eventType: "SessionHeartbeat",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        state: "tab_inactive"
      },
    };

    const reqB = mockRequest("POST", "/api/analytics/event", validHbEvent);
    const { res: resB, getPayload: getPayloadB } = mockResponse(reqB);
    await handleHttpRequest(reqB, resB);
    const outputB = await getPayloadB();
    assert(outputB.status === 202, `Expected status 202, got ${outputB.status}`);

    // --- TEST C: Invalid SessionEnd (Negative values) ---
    console.log("\n--- TEST C: Invalid SessionEnd (Negative value rejection) ---");
    const invalidEndEvent = {
      id: crypto.randomUUID(),
      eventType: "SessionEnd",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        durationSeconds: -5, // minimum is 0 according to schema
        idleSeconds: 15,
        usefulSeconds: 285
      },
    };

    const reqC = mockRequest("POST", "/api/analytics/event", invalidEndEvent);
    const { res: resC, getPayload: getPayloadC } = mockResponse(reqC);
    await handleHttpRequest(reqC, resC);
    const outputC = await getPayloadC();
    assert(outputC.status === 400, `Expected status 400, got ${outputC.status}`);
    console.log("✓ Correctly rejected negative duration.");

    // Verify DB
    console.log("\nWaiting for worker to write to database...");
    let dbEvent = null;
    for (let attempts = 0; attempts < 30; attempts++) {
      await sleep(100);
      dbEvent = await analyticsPrisma.rawEvent.findUnique({
        where: {
          id_timestamp: {
            id: eventIdHb,
            timestamp: new Date(validHbEvent.timestamp),
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
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: eventIdEnd } });
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: eventIdHb } });
    
    console.log("\n=== ALL SESSION TELEMETRY TESTS PASSED SUCCESSFULLY ===");
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

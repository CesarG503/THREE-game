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
  // Use a socket mock with minimum details
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = pathname;
  
  // Feed body stream
  const payloadStr = JSON.stringify(body);
  req.push(Buffer.from(payloadStr));
  req.push(null); // End of stream
  return req;
}

function mockResponse(req: IncomingMessage): { res: ServerResponse; getPayload: () => Promise<{ status: number; body: string }> } {
  const socket = new Socket();
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

  return {
    res,
    getPayload: () => finishPromise,
  };
}

async function main() {
  console.log("=== STARTING NAVIGATION INGESTION INTEGRATION TESTS ===");

  const testUserId = "navigation-test-user-999";
  
  try {
    // 1. Setup connection to Redis & start worker/buffer
    await connectRedis();
    eventBuffer.start(100); // Flush every 100ms
    eventWorker.start(); // Poll every 100ms

    // Pre-create test user in public (replicates to analytics)
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "nav.test@example.com",
        username: "nav_tester",
        passwordHash: "dummyhash",
      },
    });
    console.log("✓ Setup user for integration verification.");

    // --- TEST A: Happy Path PageView (CUID User ID & Valid Payload) ---
    console.log("\n--- TEST A: Happy Path PageView ---");
    const eventId = crypto.randomUUID();
    const validEvent = {
      id: eventId,
      eventType: "PageView",
      userId: testUserId, // CUID
      timestamp: new Date().toISOString(),
      payload: {
        fromRoute: "/lobby",
        toRoute: "/play",
        guestId: null,
        deviceType: "desktop",
      },
    };

    const reqA = mockRequest("POST", "/api/analytics/event", validEvent);
    const { res: resA, getPayload: getPayloadA } = mockResponse(reqA);
    
    await handleHttpRequest(reqA, resA);
    const outputA = await getPayloadA();
    
    console.log(`Response Status: ${outputA.status}`);
    console.log(`Response Body: ${outputA.body}`);
    assert(outputA.status === 202, `Expected status 202, got ${outputA.status}`);
    assert(JSON.parse(outputA.body).ok === true, "Expected response { ok: true }");
    console.log("✓ Server accepted valid telemetry event.");

    // Wait for worker to ingest event to PG
    console.log("Waiting for event to flush and write to database...");
    let dbEvent = null;
    for (let attempts = 0; attempts < 30; attempts++) {
      await sleep(100);
      dbEvent = await analyticsPrisma.rawEvent.findUnique({
        where: {
          id_timestamp: {
            id: eventId,
            timestamp: new Date(validEvent.timestamp),
          },
        },
      });
      if (dbEvent) break;
    }

    assert(!!dbEvent, "Event was not written to analytics database.");
    console.log("✓ Event successfully verified in PostgreSQL analytics.RawEvent table!");
    assert(dbEvent!.eventType === "PageView", "Event type mismatch.");
    assert((dbEvent!.payload as any).toRoute === "/play", "Payload contents mismatch.");

    // --- TEST B: Validation Failure (Invalid Payload Schema) ---
    console.log("\n--- TEST B: Validation Failure ---");
    const invalidEvent = {
      id: crypto.randomUUID(),
      eventType: "PageView",
      userId: testUserId,
      timestamp: new Date().toISOString(),
      payload: {
        fromRoute: "/lobby",
        // missing toRoute & deviceType
      },
    };

    const reqB = mockRequest("POST", "/api/analytics/event", invalidEvent);
    const { res: resB, getPayload: getPayloadB } = mockResponse(reqB);

    await handleHttpRequest(reqB, resB);
    const outputB = await getPayloadB();

    console.log(`Response Status: ${outputB.status}`);
    console.log(`Response Body: ${outputB.body}`);
    assert(outputB.status === 400, `Expected status 400, got ${outputB.status}`);
    const details = JSON.parse(outputB.body);
    assert(details.error === "Validation failed", "Expected validation failed error");
    assert(Array.isArray(details.details), "Expected details list");
    console.log("✓ Correctly rejected invalid PageView event.");

    // --- TEST C: Backpressure limit rejection ---
    console.log("\n--- TEST C: Backpressure Rejection (429) ---");
    // Manually fill up the buffer to the limit (5,000)
    for (let i = 0; i < 5000; i++) {
      eventBuffer.push({
        id: crypto.randomUUID(),
        eventType: "SessionStart",
        userId: null,
        timestamp: new Date(),
        payload: { userAgent: "mock" }
      });
    }

    const testEventC = {
      id: crypto.randomUUID(),
      eventType: "PageView",
      userId: null,
      timestamp: new Date().toISOString(),
      payload: {
        toRoute: "/editor",
        deviceType: "mobile",
      },
    };

    const reqC = mockRequest("POST", "/api/analytics/event", testEventC);
    const { res: resC, getPayload: getPayloadC } = mockResponse(reqC);

    await handleHttpRequest(reqC, resC);
    const outputC = await getPayloadC();

    console.log(`Response Status: ${outputC.status}`);
    console.log(`Response Body: ${outputC.body}`);
    assert(outputC.status === 429, `Expected status 429, got ${outputC.status}`);
    console.log("✓ Correctly rejected with 429 when buffer is full.");

    // Clear buffer to prevent unwanted writes
    eventBuffer.clear();

    // 4. Clean up records
    console.log("\nCleaning up test user...");
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await analyticsPrisma.rawEvent.deleteMany({ where: { id: eventId } });
    console.log("✓ Clean up complete.");

    console.log("\n=== ALL NAVIGATION INGESTION TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (err) {
    console.error("\n!!! INTEGRATION TESTS FAILED !!!", err);
    // Cleanup if possible
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

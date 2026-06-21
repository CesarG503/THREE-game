import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import crypto from "node:crypto";
import { prisma } from "../server/db/prisma.js";

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
  res.writeHead = (statusCode: number, headers?: any) => { status = statusCode; return res; };
  const finishPromise = new Promise<{ status: number; body: string }>((resolve) => {
    res.end = (chunk?: any, encoding?: any, cb?: any) => {
      if (chunk) body += chunk.toString("utf8");
      resolve({ status, body });
      return res;
    };
  });
  return { res, getPayload: () => finishPromise };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await connectRedis();
  console.log("🚀 Iniciando prueba de integración API: Telemetría de Editor (Phase 10)");
  eventBuffer.start(100);

  const userId = "test-user-editor-api-" + Date.now();

  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      username: `editor_${Date.now()}`,
      passwordHash: "dummyhash",
    },
  });

  const events = [
    { id: crypto.randomUUID(), eventType: "EditorSession", userId, timestamp: new Date().toISOString(), payload: { action: "open" } },
    { id: crypto.randomUUID(), eventType: "EditorAction", userId, timestamp: new Date().toISOString(), payload: { action: "place", objectType: "wall", count: 45 } },
    { id: crypto.randomUUID(), eventType: "EditorAction", userId, timestamp: new Date().toISOString(), payload: { action: "delete", objectType: "wall", count: 12 } },
    { id: crypto.randomUUID(), eventType: "MapStateTransition", userId, timestamp: new Date().toISOString(), payload: { state: "saved_local", mapId: "room-abc-123" } },
    { id: crypto.randomUUID(), eventType: "EditorSession", userId, timestamp: new Date().toISOString(), payload: { action: "close", durationSeconds: 600 } }
  ];

  console.log("Enviando carga simulada a través de la API (pasando por el middleware de validación)...");
  
  for (const event of events) {
    const req = mockRequest("POST", "/api/analytics/event", event);
    const { res, getPayload } = mockResponse(req);
    await handleHttpRequest(req, res);
    const output = await getPayload();
    if (output.status !== 202) {
      console.error(`❌ Falla en la validación Ajv para ${event.eventType}. Status: ${output.status}. Output: ${output.body}`);
      process.exit(1);
    }
  }

  console.log("Validación API superada (status 202). Esperando a que el eventWorker lo persista en PG...");
  
  await eventBuffer.flush();
  await eventWorker.pollAndProcess();
  
  let savedCount = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    savedCount = await analyticsPrisma.rawEvent.count({ where: { userId } });
    if (savedCount === events.length) break;
  }

  if (savedCount === events.length) {
    console.log(`🎉 Éxito: El pipeline HTTP validó e ingirió los ${events.length} eventos del Editor correctamente.`);
  } else {
    console.error(`❌ Error: Se esperaban ${events.length} eventos en DB, pero hay ${savedCount}.`);
    process.exit(1);
  }

  eventBuffer.stop();
  eventWorker.stop();
  await prisma.user.deleteMany({ where: { id: userId } });
  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

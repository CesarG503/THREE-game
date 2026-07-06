import "dotenv/config";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import crypto from "node:crypto";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function mockRequest(method: string, pathname: string): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = pathname;
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

async function cleanUp() {
  console.log("Limpiando datos de prueba...");
  
  // Delete all matchmaking test events
  await analyticsPrisma.$executeRawUnsafe(
    `DELETE FROM analytics."RawEvent" 
     WHERE (payload->>'queueId') LIKE 'matchmaking-test-%'
        OR (payload->>'matchId') LIKE 'matchmaking-test-%'`
  );
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE TELEMETRÍA DE MATCHMAKING (FASE 28) ===");

  try {
    await cleanUp();

    console.log("Sembrando datos de prueba...");
    const baseTime = new Date("2026-07-02T12:00:00Z");

    const eventsToInsert: any[] = [];

    // 1. Enter queue events (5 valid players)
    const pings = [20, 55, 95, 120, 40];
    for (let i = 1; i <= 5; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "QueueEnter",
        userId: null,
        timestamp: baseTime,
        payload: {
          queueId: `matchmaking-test-q-${i}`,
          latency: pings[i - 1],
          mode: "FFA"
        }
      });
    }

    // 2. Leave queue events
    // - Player 1: matched (5s wait time)
    // - Player 2: matched (10s wait time)
    // - Player 3: matched (20s wait time)
    // - Player 4: cancelled (8s wait time)
    // - Player 5: cancelled (12s wait time)
    const exits = [
      { id: 1, reason: "match_found", dur: 5 },
      { id: 2, reason: "match_found", dur: 10 },
      { id: 3, reason: "match_found", dur: 20 },
      { id: 4, reason: "cancel_by_user", dur: 8 },
      { id: 5, reason: "cancel_by_user", dur: 12 }
    ];

    for (const exit of exits) {
      const exitTime = new Date(baseTime.getTime() + exit.dur * 1000);
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "QueueLeave",
        userId: null,
        timestamp: exitTime,
        payload: {
          queueId: `matchmaking-test-q-${exit.id}`,
          reason: exit.reason,
          durationSeconds: exit.dur
        }
      });
    }

    // 3. Match formed event
    // Match formed for players 1, 2, 3, and 4
    // RTTs: [20, 55, 95, 120] -> latencyDisparity = 120 - 20 = 100
    const formTime = new Date(baseTime.getTime() + 20 * 1000);
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MatchFormed",
      userId: null,
      timestamp: formTime,
      payload: {
        matchId: "matchmaking-test-m-1",
        queueIds: [
          "matchmaking-test-q-1",
          "matchmaking-test-q-2",
          "matchmaking-test-q-3",
          "matchmaking-test-q-4"
        ],
        latencyDisparity: 100,
        playerPings: [20, 55, 95, 120]
      }
    });

    // 4. Seeding bot/suspicious events to verify filtration
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "QueueEnter",
      userId: null,
      timestamp: baseTime,
      payload: {
        queueId: "matchmaking-test-q-bot-99",
        latency: 10,
        mode: "FFA",
        metadata: { isSuspicious: true }
      }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "QueueLeave",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 15 * 1000),
      payload: {
        queueId: "matchmaking-test-q-bot-99",
        reason: "cancel_by_user",
        durationSeconds: 15,
        metadata: { isSuspicious: true }
      }
    });

    console.log(`Inserting ${eventsToInsert.length} telemetry events...`);
    await analyticsPrisma.rawEvent.createMany({ data: eventsToInsert });

    console.log("Datos de prueba sembrados. Invocando API...");

    // Test GET /api/analytics/reports/matchmaking
    const req = mockRequest("GET", "/api/analytics/reports/matchmaking");
    const { res, getPayload } = mockResponse(req);
    await handleHttpRequest(req, res);
    const output = await getPayload();

    assert(output.status === 200, `Error en petición: ${output.status} - ${output.body}`);
    const body = JSON.parse(output.body);
    const matchmaking = body.matchmaking;

    console.log("\nValidando Resultados de Colas:");
    console.log(JSON.stringify(matchmaking.queueStats, null, 2));

    assert(matchmaking.queueStats.totalEntries === 5, `TotalEntries esperado 5, obtenido ${matchmaking.queueStats.totalEntries}`);
    assert(matchmaking.queueStats.totalExits === 5, `TotalExits esperado 5, obtenido ${matchmaking.queueStats.totalExits}`);
    assert(matchmaking.queueStats.abandonCount === 2, `AbandonCount esperado 2, obtenido ${matchmaking.queueStats.abandonCount}`);
    assert(matchmaking.queueStats.abandonRate === 40.0, `AbandonRate esperado 40%, obtenido ${matchmaking.queueStats.abandonRate}%`);
    assert(matchmaking.queueStats.averageWaitTimeSeconds === 11.0, `AverageWaitTimeSeconds esperado 11.0s, obtenido ${matchmaking.queueStats.averageWaitTimeSeconds}s`);
    assert(matchmaking.queueStats.matchedAverageWaitTimeSeconds === 11.67, `MatchedAverageWaitTimeSeconds esperado 11.67s, obtenido ${matchmaking.queueStats.matchedAverageWaitTimeSeconds}s`);
    
    console.log("✓ Estadísticas de colas de matchmaking validadas correctamente.");

    console.log("\nValidando Resultados de Partidas Formadas:");
    console.log(JSON.stringify(matchmaking.matchStats, null, 2));

    assert(matchmaking.matchStats.totalMatchesFormed === 1, `TotalMatchesFormed esperado 1, obtenido ${matchmaking.matchStats.totalMatchesFormed}`);
    assert(matchmaking.matchStats.averageLatencyDisparityMs === 100.0, `AverageLatencyDisparityMs esperado 100.0ms, obtenido ${matchmaking.matchStats.averageLatencyDisparityMs}ms`);
    assert(matchmaking.matchStats.medianLatencyDisparityMs === 100.0, `MedianLatencyDisparityMs esperado 100.0ms, obtenido ${matchmaking.matchStats.medianLatencyDisparityMs}ms`);
    assert(matchmaking.matchStats.maxLatencyDisparityMs === 100.0, `MaxLatencyDisparityMs esperado 100.0ms, obtenido ${matchmaking.matchStats.maxLatencyDisparityMs}ms`);
    assert(matchmaking.matchStats.minLatencyDisparityMs === 100.0, `MinLatencyDisparityMs esperado 100.0ms, obtenido ${matchmaking.matchStats.minLatencyDisparityMs}ms`);

    console.log("✓ Estadísticas de disparidad de latencia validadas correctamente.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE MATCHMAKING DE LA FASE 28 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de matchmaking fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

main();

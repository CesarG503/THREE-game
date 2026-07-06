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
  await analyticsPrisma.$executeRawUnsafe(
    `DELETE FROM analytics."RawEvent" 
     WHERE (payload->>'elementId') LIKE 'catalog-test-%'`
  );
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE MÉTRICAS DE RECOMENDACIONES (FASE 29) ===");

  try {
    await cleanUp();

    console.log("Sembrando datos de prueba de CTR...");
    const baseTime = new Date("2026-07-03T12:00:00Z");
    const eventsToInsert: any[] = [];

    // --- ALGORITMO: trending ---
    // 10 Impressions: 6 at position 1 (map-a), 4 at position 2 (map-b)
    for (let i = 1; i <= 6; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-imp-t-p1-${i}`,
          elementType: "recommendation",
          visibleTimeMs: 1500,
          mapId: "map-a",
          catalogPosition: 1,
          algorithm: "trending"
        }
      });
    }

    for (let i = 1; i <= 4; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-imp-t-p2-${i}`,
          elementType: "recommendation",
          visibleTimeMs: 2000,
          mapId: "map-b",
          catalogPosition: 2,
          algorithm: "trending"
        }
      });
    }

    // 2 Clicks for trending (both on map-a, position 1)
    for (let i = 1; i <= 2; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiClick",
        userId: null,
        timestamp: new Date(baseTime.getTime() + 1000 * i),
        payload: {
          elementId: `catalog-test-click-t-${i}`,
          elementType: "recommendation",
          action: "click",
          mapId: "map-a",
          catalogPosition: 1,
          algorithm: "trending"
        }
      });
    }

    // --- ALGORITMO: popular ---
    // 20 Impressions: 10 at position 1 (map-a), 10 at position 10 (map-b)
    for (let i = 1; i <= 10; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-imp-p-p1-${i}`,
          elementType: "recommendation",
          visibleTimeMs: 1200,
          mapId: "map-a",
          catalogPosition: 1,
          algorithm: "popular"
        }
      });
    }

    for (let i = 1; i <= 10; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-imp-p-p10-${i}`,
          elementType: "recommendation",
          visibleTimeMs: 1800,
          mapId: "map-b",
          catalogPosition: 10,
          algorithm: "popular"
        }
      });
    }

    // 1 Click for popular (on map-a, position 1)
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "UiClick",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 3000),
      payload: {
        elementId: "catalog-test-click-p-1",
        elementType: "recommendation",
        action: "click",
        mapId: "map-a",
        catalogPosition: 1,
        algorithm: "popular"
      }
    });

    // --- CONTROL DE RUIDO: Eventos sospechosos (Bots) ---
    // Deben ser totalmente ignorados por el servicio analítico.
    // Añadimos 5 impresiones y 5 clics de bot para "trending"
    for (let i = 1; i <= 5; i++) {
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiImpression",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-bot-imp-${i}`,
          elementType: "recommendation",
          visibleTimeMs: 100,
          mapId: "map-a",
          catalogPosition: 1,
          algorithm: "trending",
          metadata: { isSuspicious: true }
        }
      });

      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiClick",
        userId: null,
        timestamp: baseTime,
        payload: {
          elementId: `catalog-test-bot-click-${i}`,
          elementType: "recommendation",
          action: "click",
          mapId: "map-a",
          catalogPosition: 1,
          algorithm: "trending",
          metadata: { isSuspicious: true }
        }
      });
    }

    console.log(`Insertando ${eventsToInsert.length} eventos en RawEvent...`);
    await analyticsPrisma.rawEvent.createMany({ data: eventsToInsert });

    console.log("Datos de prueba sembrados. Invocando API...");

    // Test GET /api/analytics/reports/catalog
    const req = mockRequest("GET", "/api/analytics/reports/catalog");
    const { res, getPayload } = mockResponse(req);
    await handleHttpRequest(req, res);
    const output = await getPayload();

    assert(output.status === 200, `Error en petición: ${output.status} - ${output.body}`);
    const body = JSON.parse(output.body);
    const performance = body.catalogPerformance;

    console.log("\n--- VALIDANDO CTR POR ALGORITMO ---");
    console.log(JSON.stringify(performance.ctrPerAlgorithm, null, 2));

    const trendingAlgo = performance.ctrPerAlgorithm.find((a: any) => a.algorithm === "trending");
    const popularAlgo = performance.ctrPerAlgorithm.find((a: any) => a.algorithm === "popular");

    assert(!!trendingAlgo, "No se encontró el algoritmo 'trending'.");
    assert(trendingAlgo.impressions === 10, `Trending impressions esperadas 10, obtenidas ${trendingAlgo.impressions}`);
    assert(trendingAlgo.clicks === 2, `Trending clicks esperados 2, obtenidos ${trendingAlgo.clicks}`);
    assert(trendingAlgo.ctr === 20.0, `Trending CTR esperado 20.0%, obtenido ${trendingAlgo.ctr}%`);

    assert(!!popularAlgo, "No se encontró el algoritmo 'popular'.");
    assert(popularAlgo.impressions === 20, `Popular impressions esperadas 20, obtenidas ${popularAlgo.impressions}`);
    assert(popularAlgo.clicks === 1, `Popular clicks esperados 1, obtenidos ${popularAlgo.clicks}`);
    assert(popularAlgo.ctr === 5.0, `Popular CTR esperado 5.0%, obtenido ${popularAlgo.ctr}%`);

    console.log("✓ CTR por Algoritmo validado con éxito.");

    console.log("\n--- VALIDANDO CTR POR POSICIÓN (POSITION BIAS) ---");
    console.log(JSON.stringify(performance.ctrPerPosition, null, 2));

    const pos1 = performance.ctrPerPosition.find((p: any) => p.position === 1);
    const pos2 = performance.ctrPerPosition.find((p: any) => p.position === 2);
    const pos10 = performance.ctrPerPosition.find((p: any) => p.position === 10);

    assert(!!pos1, "No se encontró estadísticas para posición 1.");
    assert(pos1.impressions === 16, `Posición 1 impressions esperadas 16, obtenidas ${pos1.impressions}`);
    assert(pos1.clicks === 3, `Posición 1 clicks esperados 3, obtenidos ${pos1.clicks}`);
    assert(pos1.ctr === 18.75, `Posición 1 CTR esperado 18.75%, obtenido ${pos1.ctr}%`);

    assert(!!pos2, "No se encontró estadísticas para posición 2.");
    assert(pos2.impressions === 4, `Posición 2 impressions esperadas 4, obtenidas ${pos2.impressions}`);
    assert(pos2.clicks === 0, `Posición 2 clicks esperados 0, obtenidos ${pos2.clicks}`);
    assert(pos2.ctr === 0.0, `Posición 2 CTR esperado 0.0%, obtenido ${pos2.ctr}%`);

    assert(!!pos10, "No se encontró estadísticas para posición 10.");
    assert(pos10.impressions === 10, `Posición 10 impressions esperadas 10, obtenidas ${pos10.impressions}`);
    assert(pos10.clicks === 0, `Posición 10 clicks esperados 0, obtenidos ${pos10.clicks}`);
    assert(pos10.ctr === 0.0, `Posición 10 CTR esperado 0.0%, obtenido ${pos10.ctr}%`);

    console.log("✓ CTR por Posición (Position Bias) validado con éxito.");

    console.log("\n--- VALIDANDO CTR POR MAPA ---");
    console.log(JSON.stringify(performance.ctrPerMap, null, 2));

    const mapA = performance.ctrPerMap.find((m: any) => m.mapId === "map-a");
    const mapB = performance.ctrPerMap.find((m: any) => m.mapId === "map-b");

    assert(!!mapA, "No se encontraron estadísticas para 'map-a'.");
    assert(mapA.impressions === 16, `Map-a impressions esperadas 16, obtenidas ${mapA.impressions}`);
    assert(mapA.clicks === 3, `Map-a clicks esperados 3, obtenidos ${mapA.clicks}`);
    assert(mapA.ctr === 18.75, `Map-a CTR esperado 18.75%, obtenido ${mapA.ctr}%`);

    assert(!!mapB, "No se encontraron estadísticas para 'map-b'.");
    assert(mapB.impressions === 14, `Map-b impressions esperadas 14, obtenidas ${mapB.impressions}`);
    assert(mapB.clicks === 0, `Map-b clicks esperados 0, obtenidos ${mapB.clicks}`);
    assert(mapB.ctr === 0.0, `Map-b CTR esperado 0.0%, obtenido ${mapB.ctr}%`);

    console.log("✓ CTR por Mapa validado con éxito.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE DESEMPEÑO DEL CATÁLOGO (FASE 29) PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de catálogo fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

main();

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
  console.log("Limpiando datos de prueba de creadores...");
  await analyticsPrisma.$executeRawUnsafe(
    `DELETE FROM analytics."RawEvent" 
     WHERE "userId" LIKE 'creator-test-%'
        OR payload->>'guestId' LIKE 'creator-test-%'`
  );
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE MÉTRICAS DEL EDITOR DE MAPAS (FASE 30) ===");

  try {
    await cleanUp();

    console.log("Sembrando datos de prueba para embudo y retención...");
    const baseTime = new Date("2026-06-01T12:00:00Z"); // Lunes 1 de Junio de 2026
    const eventsToInsert: any[] = [];

    // --- COHORTE 1 (Lunes 1 de Junio): Creadores Ret-1 y Ret-2 ---
    // Semana 0: Ret-1 y Ret-2 entran al editor
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: baseTime,
      payload: { action: "open", guestId: "creator-test-ret-1" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 24 * 60 * 60 * 1000), // Martes
      payload: { action: "open", guestId: "creator-test-ret-2" }
    });

    // Semana 1 (Lunes 8 de Junio): Ret-1 reingresa al editor (Ret-2 no)
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 8 * 24 * 60 * 60 * 1000), // Martes de sem 1
      payload: { action: "open", guestId: "creator-test-ret-1" }
    });

    // Semana 2 (Lunes 15 de Junio): Ret-1 reingresa al editor (Ret-2 no)
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 15 * 24 * 60 * 60 * 1000), // Martes de sem 2
      payload: { action: "open", guestId: "creator-test-ret-1" }
    });

    // --- COHORTE 2 (Lunes 8 de Junio): Creador Ret-3 ---
    // Semana 1: Ret-3 entra al editor
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: new Date(baseTime.getTime() + 7 * 24 * 60 * 60 * 1000), // Lunes de sem 1
      payload: { action: "open", guestId: "creator-test-ret-3" }
    });


    // --- SIMULACIÓN DE EMBUDO (Funnel) ---
    // Usuario 1: completa todo el embudo
    const tFunnel1 = new Date("2026-06-20T12:00:00Z");
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: tFunnel1,
      payload: { action: "open", guestId: "creator-test-funnel-full" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorAction",
      userId: null,
      timestamp: new Date(tFunnel1.getTime() + 10 * 1000),
      payload: { action: "place", objectType: "wall", count: 10, guestId: "creator-test-funnel-full" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: null,
      timestamp: new Date(tFunnel1.getTime() + 20 * 1000),
      payload: { roomId: "test-room-1", mapId: null, guestId: "creator-test-funnel-full" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MapStateTransition",
      userId: null,
      timestamp: new Date(tFunnel1.getTime() + 30 * 1000),
      payload: { state: "saved_local", mapId: "map-1", guestId: "creator-test-funnel-full" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MapStateTransition",
      userId: null,
      timestamp: new Date(tFunnel1.getTime() + 40 * 1000),
      payload: { state: "published", mapId: "map-1", guestId: "creator-test-funnel-full" }
    });

    // Usuario 2: Completa sólo hasta TestRun (EditorEnter -> FirstBlock -> TestRun)
    const tFunnel2 = new Date("2026-06-20T13:00:00Z");
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: tFunnel2,
      payload: { action: "open", guestId: "creator-test-funnel-partial" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorAction",
      userId: null,
      timestamp: new Date(tFunnel2.getTime() + 10 * 1000),
      payload: { action: "place", objectType: "ramp", count: 2, guestId: "creator-test-funnel-partial" }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: null,
      timestamp: new Date(tFunnel2.getTime() + 20 * 1000),
      payload: { roomId: "test-room-2", mapId: null, guestId: "creator-test-funnel-partial" }
    });

    // Usuario 3: Completa sólo EditorEnter (entra y sale sin hacer nada)
    const tFunnel3 = new Date("2026-06-20T14:00:00Z");
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: tFunnel3,
      payload: { action: "open", guestId: "creator-test-funnel-drop" }
    });

    // Usuario 4: Bot sospechoso que completa todo el embudo (debe ser ignorado)
    const tBot = new Date("2026-06-20T15:00:00Z");
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorSession",
      userId: null,
      timestamp: tBot,
      payload: { action: "open", guestId: "creator-test-funnel-bot", metadata: { isSuspicious: true } }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorAction",
      userId: null,
      timestamp: new Date(tBot.getTime() + 10 * 1000),
      payload: { action: "place", objectType: "wall", count: 100, guestId: "creator-test-funnel-bot", metadata: { isSuspicious: true } }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: null,
      timestamp: new Date(tBot.getTime() + 20 * 1000),
      payload: { roomId: "test-room-bot", mapId: null, guestId: "creator-test-funnel-bot", metadata: { isSuspicious: true } }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MapStateTransition",
      userId: null,
      timestamp: new Date(tBot.getTime() + 30 * 1000),
      payload: { state: "saved_local", mapId: "map-bot", guestId: "creator-test-funnel-bot", metadata: { isSuspicious: true } }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "MapStateTransition",
      userId: null,
      timestamp: new Date(tBot.getTime() + 40 * 1000),
      payload: { state: "published", mapId: "map-bot", guestId: "creator-test-funnel-bot", metadata: { isSuspicious: true } }
    });

    // Colocar acciones adicionales de colocación de bloques para popularObjects
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "EditorAction",
      userId: null,
      timestamp: new Date(tFunnel1.getTime() + 50 * 1000),
      payload: { action: "place", objectType: "wall", count: 15, guestId: "creator-test-funnel-full" } // wall total: 10 + 15 = 25
    });

    console.log(`Insertando ${eventsToInsert.length} eventos de telemetría de creadores...`);
    await analyticsPrisma.rawEvent.createMany({ data: eventsToInsert });

    console.log("Datos de prueba sembrados. Invocando API con filtros de fecha...");

    // Test GET /api/analytics/reports/creators?startDate=2026-06-01T00:00:00Z&endDate=2026-06-20T23:59:59Z
    const req = mockRequest("GET", "/api/analytics/reports/creators?startDate=2026-06-01T00:00:00Z&endDate=2026-06-20T23:59:59Z");
    const { res, getPayload } = mockResponse(req);
    await handleHttpRequest(req, res);
    const output = await getPayload();

    assert(output.status === 200, `Error en petición: ${output.status} - ${output.body}`);
    const body = JSON.parse(output.body);
    const creatorsActivity = body.creatorsActivity;

    console.log("\n--- VALIDANDO EMBUDO (FUNNEL) DE CREACIÓN ---");
    console.log(JSON.stringify(creatorsActivity.funnel, null, 2));

    const step1 = creatorsActivity.funnel.find((s: any) => s.step === 1);
    const step2 = creatorsActivity.funnel.find((s: any) => s.step === 2);
    const step3 = creatorsActivity.funnel.find((s: any) => s.step === 3);
    const step4 = creatorsActivity.funnel.find((s: any) => s.step === 4);
    const step5 = creatorsActivity.funnel.find((s: any) => s.step === 5);

    // Contando usuarios que inician y avanzan:
    // Creadores activos en editor en el periodo (junio):
    // creator-test-ret-1, creator-test-ret-2, creator-test-ret-3
    // creator-test-funnel-full, creator-test-funnel-partial, creator-test-funnel-drop
    // Total EditorEnter = 6
    // De estos, quienes pusieron bloque (EditorAction: place):
    // creator-test-funnel-full y creator-test-funnel-partial. Total = 2.
    // Quienes hicieron TestRun (MatchJoin) tras bloque:
    // creator-test-funnel-full y creator-test-funnel-partial. Total = 2.
    // Quienes guardaron localmente (MapStateTransition: saved_local) tras TestRun:
    // creator-test-funnel-full. Total = 1.
    // Quienes publicaron (MapStateTransition: published) tras Guardar:
    // creator-test-funnel-full. Total = 1.

    assert(!!step1, "Falta el paso 1 (EditorEnter)");
    assert(step1.count === 6, `EditorEnter count esperado 6, obtenido ${step1.count}`);

    assert(!!step2, "Falta el paso 2 (FirstBlock)");
    assert(step2.count === 2, `FirstBlock count esperado 2, obtenido ${step2.count}`);
    assert(step2.conversionRate === 33.33, `FirstBlock conversionRate esperado 33.33%, obtenido ${step2.conversionRate}%`);
    assert(step2.dropRate === 66.67, `FirstBlock dropRate esperado 66.67%, obtenido ${step2.dropRate}%`);

    assert(!!step3, "Falta el paso 3 (TestRun)");
    assert(step3.count === 2, `TestRun count esperado 2, obtenido ${step3.count}`);
    assert(step3.conversionRate === 33.33, `TestRun conversionRate esperado 33.33%, obtenido ${step3.conversionRate}%`);
    assert(step3.dropRate === 0, `TestRun dropRate esperado 0%, obtenido ${step3.dropRate}%`);

    assert(!!step4, "Falta el paso 4 (Save)");
    assert(step4.count === 1, `Save count esperado 1, obtenido ${step4.count}`);
    assert(step4.conversionRate === 16.67, `Save conversionRate esperado 16.67%, obtenido ${step4.conversionRate}%`);
    assert(step4.dropRate === 50.0, `Save dropRate esperado 50.0%, obtenido ${step4.dropRate}%`);

    assert(!!step5, "Falta el paso 5 (Publish)");
    assert(step5.count === 1, `Publish count esperado 1, obtenido ${step5.count}`);
    assert(step5.conversionRate === 16.67, `Publish conversionRate esperado 16.67%, obtenido ${step5.conversionRate}%`);
    assert(step5.dropRate === 0.0, `Publish dropRate esperado 0.0%, obtenido ${step5.dropRate}%`);

    console.log("✓ Embudo de creación validado con éxito.");

    console.log("\n--- VALIDANDO RETENCIÓN SEMANAL ---");
    console.log(JSON.stringify(creatorsActivity.retention, null, 2));

    // Cohorte "2026-06-01":
    // Semana 0: ret-1, ret-2 (size = 2)
    // Semana 1: ret-1 (1 de 2 = 50%)
    // Semana 2: ret-1 (1 de 2 = 50%)
    const cohort1 = creatorsActivity.retention.find((c: any) => c.cohortWeek === "2026-06-01");
    assert(!!cohort1, "No se encontró la cohorte 2026-06-01");
    assert(cohort1.cohortSize === 2, `Cohorte 1 tamaño esperado 2, obtenido ${cohort1.cohortSize}`);
    assert(cohort1.retention[0] === 2, `Retención Sem 0 esperado 2, obtenido ${cohort1.retention[0]}`);
    assert(cohort1.retentionRates[0] === 100.0, `Retención % Sem 0 esperado 100%, obtenido ${cohort1.retentionRates[0]}%`);
    assert(cohort1.retention[1] === 1, `Retención Sem 1 esperado 1, obtenido ${cohort1.retention[1]}`);
    assert(cohort1.retentionRates[1] === 50.0, `Retención % Sem 1 esperado 50%, obtenido ${cohort1.retentionRates[1]}%`);
    assert(cohort1.retention[2] === 1, `Retención Sem 2 esperado 1, obtenido ${cohort1.retention[2]}`);
    assert(cohort1.retentionRates[2] === 50.0, `Retención % Sem 2 esperado 50%, obtenido ${cohort1.retentionRates[2]}%`);

    // Cohorte "2026-06-08":
    // Semana 0: ret-3 (size = 1)
    const cohort2 = creatorsActivity.retention.find((c: any) => c.cohortWeek === "2026-06-08");
    assert(!!cohort2, "No se encontró la cohorte 2026-06-08");
    assert(cohort2.cohortSize === 1, `Cohorte 2 tamaño esperado 1, obtenido ${cohort2.cohortSize}`);
    assert(cohort2.retention[0] === 1, `Cohorte 2 Sem 0 esperado 1, obtenido ${cohort2.retention[0]}`);

    console.log("✓ Retención semanal de cohortes validada con éxito.");

    console.log("\n--- VALIDANDO OBJETOS POPULARES ---");
    console.log(JSON.stringify(creatorsActivity.popularObjects, null, 2));

    // Colocados:
    // funnel-full colocó 10 y luego 15 "wall" = 25 total
    // funnel-partial colocó 2 "ramp" = 2 total
    // bot colocó 100 "wall" (debe ser ignorado por ser bot)
    const wallObj = creatorsActivity.popularObjects.find((o: any) => o.objectType === "wall");
    const rampObj = creatorsActivity.popularObjects.find((o: any) => o.objectType === "ramp");

    assert(!!wallObj, "No se encontraron estadísticas para objeto 'wall'.");
    assert(wallObj.placedCount === 25, `Objeto 'wall' colocado esperado 25, obtenido ${wallObj.placedCount}`);

    assert(!!rampObj, "No se encontraron estadísticas para objeto 'ramp'.");
    assert(rampObj.placedCount === 2, `Objeto 'ramp' colocado esperado 2, obtenido ${rampObj.placedCount}`);

    console.log("✓ Objetos populares del editor validados con éxito.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DEL EDITOR DE MAPAS (FASE 30) PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de actividad del editor fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

main();

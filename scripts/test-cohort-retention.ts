import "dotenv/config";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { prisma } from "../server/db/prisma.js";
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

// Track IDs for clean up
const userIdsToDelete: string[] = [];
const eventIdsToDelete: string[] = [];

async function cleanUp() {
  console.log("Limpiando datos de prueba...");
  
  // Delete events with test registered user IDs
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      userId: {
        startsWith: "cohort-test-reg-"
      }
    }
  });

  // Delete guest events with raw SQL
  await analyticsPrisma.$executeRawUnsafe(
    `DELETE FROM analytics."RawEvent" WHERE (payload->>'guestId') LIKE 'cohort-test-guest-%'`
  );

  // Delete test users
  await analyticsPrisma.user.deleteMany({
    where: {
      id: {
        startsWith: "cohort-test-reg-"
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        startsWith: "cohort-test-reg-"
      }
    }
  });
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE COHORTES Y RETENCIÓN (FASE 26) ===");

  try {
    await cleanUp();

    console.log("Sembrando datos de prueba...");
    const dateDay0 = new Date("2026-07-01T12:00:00Z");
    const dateDay1 = new Date("2026-07-02T12:00:00Z");

    const testUsers: any[] = [];
    const analyticsUsers: any[] = [];
    const eventsToInsert: any[] = [];

    // 1. Sembrar 50 usuarios registrados normales (Día 0)
    for (let i = 1; i <= 50; i++) {
      const uId = `cohort-test-reg-${i}`;
      userIdsToDelete.push(uId);

      testUsers.push({
        id: uId,
        email: `reg-${i}@cohort.local`,
        username: `reg_user_${i}`,
        passwordHash: "dummyhash"
      });

      analyticsUsers.push({
        id: uId,
        email: `reg-${i}@cohort.local`,
        username: `reg_user_${i}`,
        createdAt: dateDay0,
        updatedAt: dateDay0
      });

      const evId = crypto.randomUUID();
      eventIdsToDelete.push(evId);
      eventsToInsert.push({
        id: evId,
        eventType: "SessionStart",
        userId: uId,
        timestamp: dateDay0,
        payload: { userAgent: "Mozilla" }
      });

      // Retener 15 de ellos en el Día 1
      if (i <= 15) {
        const rEvId = crypto.randomUUID();
        eventIdsToDelete.push(rEvId);
        eventsToInsert.push({
          id: rEvId,
          eventType: "PageView",
          userId: uId,
          timestamp: dateDay1,
          payload: { toRoute: "/play", deviceType: "desktop" }
        });
      }
    }

    // 2. Sembrar 50 usuarios invitados normales (Día 0)
    for (let i = 1; i <= 50; i++) {
      const gId = `cohort-test-guest-${i}`;

      const evId = crypto.randomUUID();
      eventIdsToDelete.push(evId);
      eventsToInsert.push({
        id: evId,
        eventType: "PageView",
        userId: null,
        timestamp: dateDay0,
        payload: { guestId: gId, toRoute: "/lobby", deviceType: "desktop" }
      });

      // Retener 15 de ellos en el Día 1
      if (i <= 15) {
        const rEvId = crypto.randomUUID();
        eventIdsToDelete.push(rEvId);
        eventsToInsert.push({
          id: rEvId,
          eventType: "PageView",
          userId: null,
          timestamp: dateDay1,
          payload: { guestId: gId, toRoute: "/play", deviceType: "desktop" }
        });
      }
    }

    // 3. Sembrar 10 bots sospechosos adicionales para verificar exclusión
    // 5 bots registrados
    for (let i = 51; i <= 55; i++) {
      const uId = `cohort-test-reg-bot-${i}`;
      userIdsToDelete.push(uId);

      testUsers.push({
        id: uId,
        email: `reg-bot-${i}@cohort.local`,
        username: `reg_bot_user_${i}`,
        passwordHash: "dummyhash"
      });

      analyticsUsers.push({
        id: uId,
        email: `reg-bot-${i}@cohort.local`,
        username: `reg_bot_user_${i}`,
        createdAt: dateDay0,
        updatedAt: dateDay0
      });

      const evId = crypto.randomUUID();
      eventIdsToDelete.push(evId);
      eventsToInsert.push({
        id: evId,
        eventType: "SessionStart",
        userId: uId,
        timestamp: dateDay0,
        payload: {
          userAgent: "BotAgent",
          metadata: { isSuspicious: true, suspicionReason: "Test click spam bot" }
        }
      });

      // Retener bot en día 1
      const rEvId = crypto.randomUUID();
      eventIdsToDelete.push(rEvId);
      eventsToInsert.push({
        id: rEvId,
        eventType: "PageView",
        userId: uId,
        timestamp: dateDay1,
        payload: {
          toRoute: "/play",
          deviceType: "desktop",
          metadata: { isSuspicious: true }
        }
      });
    }

    // 5 bots invitados
    for (let i = 51; i <= 55; i++) {
      const gId = `cohort-test-guest-bot-${i}`;

      const evId = crypto.randomUUID();
      eventIdsToDelete.push(evId);
      eventsToInsert.push({
        id: evId,
        eventType: "PageView",
        userId: null,
        timestamp: dateDay0,
        payload: {
          guestId: gId,
          toRoute: "/lobby",
          deviceType: "desktop",
          metadata: { isSuspicious: true, suspicionReason: "Test velocity limit bot" }
        }
      });

      const rEvId = crypto.randomUUID();
      eventIdsToDelete.push(rEvId);
      eventsToInsert.push({
        id: rEvId,
        eventType: "PageView",
        userId: null,
        timestamp: dateDay1,
        payload: {
          guestId: gId,
          toRoute: "/play",
          deviceType: "desktop",
          metadata: { isSuspicious: true }
        }
      });
    }

    // Guardar en la base de datos
    console.log(`Inserting testUsers: ${testUsers.length}, unique IDs: ${new Set(testUsers.map(u => u.id)).size}`);
    console.log(`Inserting eventsToInsert: ${eventsToInsert.length}`);
    await prisma.user.createMany({ data: testUsers });
    await analyticsPrisma.rawEvent.createMany({ data: eventsToInsert });

    console.log("Datos de prueba sembrados correctamente. Ejecutando consultas de API...");

    // ==========================================
    // ESCENARIO A: COHORTES GLOBALES (all)
    // ==========================================
    console.log("\nProbando Endpoint: GET /api/analytics/reports/cohorts (Global)...");
    const reqAll = mockRequest("GET", "/api/analytics/reports/cohorts");
    const { res: resAll, getPayload: getPayloadAll } = mockResponse(reqAll);
    await handleHttpRequest(reqAll, resAll);
    const outputAll = await getPayloadAll();
    
    assert(outputAll.status === 200, `Error en petición: ${outputAll.status}`);
    const dataAll = JSON.parse(outputAll.body);
    
    // Buscar la cohorte del 2026-07-01 de tipo "all"
    const cohortAll = dataAll.cohorts.find(
      (c: any) => c.cohortDate === "2026-07-01" && c.userType === "all"
    );

    assert(!!cohortAll, "No se encontró la cohorte global 'all' para la fecha especificada.");
    assert(cohortAll.cohortSize === 100, `Se esperaba tamaño 100, se obtuvo ${cohortAll.cohortSize}`);
    assert(cohortAll.retention[1] === 30, `Se esperaban 30 usuarios retenidos en D1, se obtuvo ${cohortAll.retention[1]}`);
    assert(cohortAll.retentionRates[1] === 30, `Se esperaba 30% de retención D1, se obtuvo ${cohortAll.retentionRates[1]}%`);
    console.log("✓ Cohorte global validada: Tamaño = 100, Retención D1 = 30%.");

    // ==========================================
    // ESCENARIO B: COHORTES DE REGISTRADOS (registered)
    // ==========================================
    console.log("\nProbando Endpoint: GET /api/analytics/reports/cohorts?userType=registered...");
    const reqReg = mockRequest("GET", "/api/analytics/reports/cohorts?userType=registered");
    const { res: resReg, getPayload: getPayloadReg } = mockResponse(reqReg);
    await handleHttpRequest(reqReg, resReg);
    const outputReg = await getPayloadReg();
    
    assert(outputReg.status === 200, `Error en petición: ${outputReg.status}`);
    const dataReg = JSON.parse(outputReg.body);
    
    const cohortReg = dataReg.cohorts.find(
      (c: any) => c.cohortDate === "2026-07-01" && c.userType === "registered"
    );

    assert(!!cohortReg, "No se encontró la cohorte 'registered' para la fecha especificada.");
    assert(cohortReg.cohortSize === 50, `Se esperaba tamaño 50, se obtuvo ${cohortReg.cohortSize}`);
    assert(cohortReg.retention[1] === 15, `Se esperaban 15 usuarios registrados retenidos en D1, se obtuvo ${cohortReg.retention[1]}`);
    assert(cohortReg.retentionRates[1] === 30, `Se esperaba 30% de retención D1, se obtuvo ${cohortReg.retentionRates[1]}%`);
    console.log("✓ Cohorte de registrados validada: Tamaño = 50, Retención D1 = 30%.");

    // ==========================================
    // ESCENARIO C: COHORTES DE INVITADOS (guest)
    // ==========================================
    console.log("\nProbando Endpoint: GET /api/analytics/reports/cohorts?userType=guest...");
    const reqGuest = mockRequest("GET", "/api/analytics/reports/cohorts?userType=guest");
    const { res: resGuest, getPayload: getPayloadGuest } = mockResponse(reqGuest);
    await handleHttpRequest(reqGuest, resGuest);
    const outputGuest = await getPayloadGuest();
    
    assert(outputGuest.status === 200, `Error en petición: ${outputGuest.status}`);
    const dataGuest = JSON.parse(outputGuest.body);
    
    const cohortGuest = dataGuest.cohorts.find(
      (c: any) => c.cohortDate === "2026-07-01" && c.userType === "guest"
    );

    assert(!!cohortGuest, "No se encontró la cohorte 'guest' para la fecha especificada.");
    assert(cohortGuest.cohortSize === 50, `Se esperaba tamaño 50, se obtuvo ${cohortGuest.cohortSize}`);
    assert(cohortGuest.retention[1] === 15, `Se esperaban 15 invitados retenidos en D1, se obtuvo ${cohortGuest.retention[1]}`);
    assert(cohortGuest.retentionRates[1] === 30, `Se esperaba 30% de retención D1, se obtuvo ${cohortGuest.retentionRates[1]}%`);
    console.log("✓ Cohorte de invitados validada: Tamaño = 50, Retención D1 = 30%.");

    // ==========================================
    // ESCENARIO D: VERIFICACIÓN DE PARÁMETROS INVÁLIDOS
    // ==========================================
    console.log("\nProbando parámetros inválidos: userType=invalid...");
    const reqInvalid = mockRequest("GET", "/api/analytics/reports/cohorts?userType=invalid");
    const { res: resInvalid, getPayload: getPayloadInvalid } = mockResponse(reqInvalid);
    await handleHttpRequest(reqInvalid, resInvalid);
    const outputInvalid = await getPayloadInvalid();
    
    assert(outputInvalid.status === 400, `Se esperaba 400, se obtuvo ${outputInvalid.status}`);
    const dataInvalid = JSON.parse(outputInvalid.body);
    assert(dataInvalid.error.includes("userType"), `Mensaje incorrecto: ${dataInvalid.error}`);
    console.log("✓ Parámetros inválidos rechazados correctamente.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE COHORTES DE LA FASE 26 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas del filtro de cohortes fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

main();

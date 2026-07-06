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

async function cleanUp() {
  console.log("Limpiando datos de prueba...");
  
  // Delete events with test registered user IDs
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      userId: {
        startsWith: "funnel-test-reg-"
      }
    }
  });

  // Delete guest events with raw SQL
  await analyticsPrisma.$executeRawUnsafe(
    `DELETE FROM analytics."RawEvent" WHERE (payload->>'guestId') LIKE 'funnel-test-guest-%'`
  );

  // Delete map features and map
  await analyticsPrisma.mapFeatures.deleteMany({
    where: {
      mapId: "map-123"
    }
  });
  await analyticsPrisma.gameMap.deleteMany({
    where: {
      id: "map-123"
    }
  });
  await prisma.gameMap.deleteMany({
    where: {
      id: "map-123"
    }
  });

  // Delete test users
  await analyticsPrisma.user.deleteMany({
    where: {
      id: {
        startsWith: "funnel-test-reg-"
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        startsWith: "funnel-test-reg-"
      }
    }
  });
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE FUNNEL DE CONVERSIÓN (FASE 27) ===");

  try {
    await cleanUp();

    console.log("Sembrando datos de prueba...");
    const baseTime = new Date("2026-07-01T12:00:00Z");

    const testUsers: any[] = [];
    const eventsToInsert: any[] = [];

    // Create owner user and the test map first to avoid foreign key violations in triggers
    const ownerId = "funnel-test-reg-owner";
    await prisma.user.create({
      data: {
        id: ownerId,
        email: "owner@funnel.local",
        username: "funnel_owner",
        passwordHash: "dummyhash"
      }
    });

    await prisma.gameMap.create({
      data: {
        id: "map-123",
        slug: "funnel-map",
        name: "Funnel Map",
        isPublished: true,
        ownerId: ownerId
      }
    });

    // Let's seed 50 users/guests in PageLoad step (t1):
    // - 25 registered users
    // - 25 guest users
    // - Device distribution: 30 desktop, 20 mobile. Let's make:
    //   - Reg 1-25: 15 desktop, 10 mobile
    //   - Guest 1-25: 15 desktop, 10 mobile
    const userMap = new Map<string, { type: "reg" | "guest", device: "desktop" | "mobile" }>();

    for (let i = 1; i <= 25; i++) {
      const uId = `funnel-test-reg-${i}`;
      const device = i <= 15 ? "desktop" : "mobile";
      userMap.set(uId, { type: "reg", device });

      testUsers.push({
        id: uId,
        email: `reg-${i}@funnel.local`,
        username: `funnel_user_${i}`,
        passwordHash: "dummyhash"
      });

      // PageLoad Event (t1 = baseTime)
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "PageView",
        userId: uId,
        timestamp: baseTime,
        payload: { toRoute: "/lobby", deviceType: device }
      });
    }

    for (let i = 1; i <= 25; i++) {
      const gId = `funnel-test-guest-${i}`;
      const device = i <= 15 ? "desktop" : "mobile";
      userMap.set(gId, { type: "guest", device });

      // PageLoad Event (t1 = baseTime)
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "PageView",
        userId: null,
        timestamp: baseTime,
        payload: { guestId: gId, toRoute: "/lobby", deviceType: device }
      });
    }

    // Step 2: RoomSearch (40 users click play_map, t2 = baseTime + 10s)
    // 20 registered (Reg 1-20), 20 guests (Guest 1-20)
    const roomSearchUsers: string[] = [];
    for (let i = 1; i <= 20; i++) {
      roomSearchUsers.push(`funnel-test-reg-${i}`);
      roomSearchUsers.push(`funnel-test-guest-${i}`);
    }

    const t2 = new Date(baseTime.getTime() + 10 * 1000);
    for (const id of roomSearchUsers) {
      const user = userMap.get(id)!;
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "UiClick",
        userId: user.type === "reg" ? id : null,
        timestamp: t2,
        payload: {
          guestId: user.type === "guest" ? id : null,
          action: "play_map",
          elementId: "play_btn",
          deviceType: user.device
        }
      });
    }

    // Step 3: MatchJoin (30 users join room, t3 = baseTime + 20s)
    // 15 registered (Reg 1-15), 15 guests (Guest 1-15)
    const matchJoinUsers: string[] = [];
    for (let i = 1; i <= 15; i++) {
      matchJoinUsers.push(`funnel-test-reg-${i}`);
      matchJoinUsers.push(`funnel-test-guest-${i}`);
    }

    const t3 = new Date(baseTime.getTime() + 20 * 1000);
    const testRoomId = "room-funnel-123";

    for (const id of matchJoinUsers) {
      const user = userMap.get(id)!;
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "MatchJoin",
        userId: user.type === "reg" ? id : null,
        timestamp: t3,
        payload: {
          guestId: user.type === "guest" ? id : null,
          roomId: testRoomId,
          mapId: "map-123",
          deviceType: user.device
        }
      });
    }

    // Step 4: MatchStart (20 users load map, t4 = t3 + variable seconds)
    // - 10 registered (Reg 1-10)
    // - 10 guests (Guest 1-10)
    // Simulated load times:
    // - 10 users: 2s (t4 = baseTime + 22s) -> Reg 1-5, Guest 1-5
    // - 5 users: 4s (t4 = baseTime + 24s) -> Reg 6-8, Guest 6-7
    // - 5 users: 6s (t4 = baseTime + 26s) -> Reg 9-10, Guest 8-10
    // Total users starting: 20. Total joins: 30. Abandoned: 10 (Reg 11-15, Guest 11-15).
    // Average load time: (10*2 + 5*4 + 5*6)/20 = 3.5s. Median: 3.0s.
    const matchStartUsers: { id: string; loadTimeMs: number }[] = [];

    // 2s load time users (Reg 1-5, Guest 1-5)
    for (let i = 1; i <= 5; i++) {
      matchStartUsers.push({ id: `funnel-test-reg-${i}`, loadTimeMs: 2000 });
      matchStartUsers.push({ id: `funnel-test-guest-${i}`, loadTimeMs: 2000 });
    }
    // 4s load time users (Reg 6-8, Guest 6-7)
    for (let i = 6; i <= 8; i++) {
      matchStartUsers.push({ id: `funnel-test-reg-${i}`, loadTimeMs: 4000 });
    }
    for (let i = 6; i <= 7; i++) {
      matchStartUsers.push({ id: `funnel-test-guest-${i}`, loadTimeMs: 4000 });
    }
    // 6s load time users (Reg 9-10, Guest 8-10)
    for (let i = 9; i <= 10; i++) {
      matchStartUsers.push({ id: `funnel-test-reg-${i}`, loadTimeMs: 6000 });
    }
    for (let i = 8; i <= 10; i++) {
      matchStartUsers.push({ id: `funnel-test-guest-${i}`, loadTimeMs: 6000 });
    }

    for (const item of matchStartUsers) {
      const user = userMap.get(item.id)!;
      const t4 = new Date(t3.getTime() + item.loadTimeMs);
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "MatchStart",
        userId: user.type === "reg" ? item.id : null,
        timestamp: t4,
        payload: {
          guestId: user.type === "guest" ? item.id : null,
          roomId: testRoomId,
          mapId: "map-123",
          gameMode: "FFA",
          deviceType: user.device
        }
      });
    }

    // Step 5: MatchEnd (15 users complete match, t5 = baseTime + 120s)
    // - 8 registered (Reg 1-8)
    // - 7 guests (Guest 1-7)
    const matchEndUsers: string[] = [];
    for (let i = 1; i <= 8; i++) {
      matchEndUsers.push(`funnel-test-reg-${i}`);
    }
    for (let i = 1; i <= 7; i++) {
      matchEndUsers.push(`funnel-test-guest-${i}`);
    }

    const t5 = new Date(baseTime.getTime() + 120 * 1000);
    for (const id of matchEndUsers) {
      const user = userMap.get(id)!;
      eventsToInsert.push({
        id: crypto.randomUUID(),
        eventType: "MatchEnd",
        userId: user.type === "reg" ? id : null,
        timestamp: t5,
        payload: {
          guestId: user.type === "guest" ? id : null,
          roomId: testRoomId,
          mapId: "map-123",
          durationSeconds: 100,
          deviceType: user.device
        }
      });
    }

    // 4. Seeding suspicious events to test bot isolation
    const botId = "funnel-test-guest-bot-99";
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "PageView",
      userId: null,
      timestamp: baseTime,
      payload: {
        guestId: botId,
        toRoute: "/lobby",
        deviceType: "desktop",
        metadata: { isSuspicious: true }
      }
    });
    eventsToInsert.push({
      id: crypto.randomUUID(),
      eventType: "UiClick",
      userId: null,
      timestamp: t2,
      payload: {
        guestId: botId,
        action: "play_map",
        deviceType: "desktop",
        metadata: { isSuspicious: true }
      }
    });

    // Write to databases
    console.log(`Inserting testUsers: ${testUsers.length}`);
    console.log(`Inserting eventsToInsert: ${eventsToInsert.length}`);
    await prisma.user.createMany({ data: testUsers });
    await analyticsPrisma.rawEvent.createMany({ data: eventsToInsert });

    console.log("Datos de prueba sembrados. Invocando API...");

    // Test GET /api/analytics/reports/funnel
    const req = mockRequest("GET", "/api/analytics/reports/funnel");
    const { res, getPayload } = mockResponse(req);
    await handleHttpRequest(req, res);
    const output = await getPayload();

    assert(output.status === 200, `Error en petición: ${output.status} - ${output.body}`);
    const body = JSON.parse(output.body);
    const funnel = body.funnel;

    console.log("\nValidando Resultados del Embudo Global:");
    console.log(JSON.stringify(funnel.overall, null, 2));

    // Assert overall counts
    const s1 = funnel.overall.find((s: any) => s.step === 1);
    const s2 = funnel.overall.find((s: any) => s.step === 2);
    const s3 = funnel.overall.find((s: any) => s.step === 3);
    const s4 = funnel.overall.find((s: any) => s.step === 4);
    const s5 = funnel.overall.find((s: any) => s.step === 5);

    assert(s1.count === 50, `Paso 1: Se esperaban 50, se obtuvo ${s1.count}`);
    assert(s2.count === 40, `Paso 2: Se esperaban 40, se obtuvo ${s2.count}`);
    assert(s3.count === 30, `Paso 3: Se esperaban 30, se obtuvo ${s3.count}`);
    assert(s4.count === 20, `Paso 4: Se esperaban 20, se obtuvo ${s4.count}`);
    assert(s5.count === 15, `Paso 5: Se esperaban 15, se obtuvo ${s5.count}`);

    // Assert rates
    assert(s1.conversionRate === 100, `Paso 1 conversionRate: ${s1.conversionRate}`);
    assert(s2.conversionRate === 80, `Paso 2 conversionRate: ${s2.conversionRate}`); // 40/50 = 80%
    assert(s3.conversionRate === 60, `Paso 3 conversionRate: ${s3.conversionRate}`); // 30/50 = 60%
    assert(s4.conversionRate === 40, `Paso 4 conversionRate: ${s4.conversionRate}`); // 20/50 = 40%
    assert(s5.conversionRate === 30, `Paso 5 conversionRate: ${s5.conversionRate}`); // 15/50 = 30%

    assert(s2.dropRate === 20, `Paso 2 dropRate: ${s2.dropRate}`); // (50-40)/50 = 20%
    assert(s3.dropRate === 25, `Paso 3 dropRate: ${s3.dropRate}`); // (40-30)/40 = 25%
    assert(s4.dropRate === 33.33, `Paso 4 dropRate: ${s4.dropRate}`); // (30-20)/30 = 33.33%
    assert(s5.dropRate === 25, `Paso 5 dropRate: ${s5.dropRate}`); // (20-15)/20 = 25%

    console.log("✓ Conteos y tasas globales correctos (bots ignorados correctamente).");

    // Assert WebGL Loading times
    console.log("\nValidando Métricas de Carga de Recursos:");
    console.log(JSON.stringify(funnel.resourceLoading, null, 2));

    assert(funnel.resourceLoading.averageLoadTimeSeconds === 3.5, `Promedio esperado 3.5s, obtenido ${funnel.resourceLoading.averageLoadTimeSeconds}`);
    assert(funnel.resourceLoading.medianLoadTimeSeconds === 3.0, `Mediana esperada 3.0s, obtenida ${funnel.resourceLoading.medianLoadTimeSeconds}`);
    assert(funnel.resourceLoading.abandonCount === 10, `Abandonos esperados 10, obtenidos ${funnel.resourceLoading.abandonCount}`);
    assert(funnel.resourceLoading.abandonRate === 33.33, `Tasa de abandono esperada 33.33%, obtenida ${funnel.resourceLoading.abandonRate}%`);
    console.log("✓ Métricas de carga WebGL correctas (promedio 3.5s, mediana 3.0s, abandono 33.33%).");

    // Assert device type breakdown
    console.log("\nValidando Desglose por Dispositivo (Desktop):");
    console.log(JSON.stringify(funnel.byDevice.desktop, null, 2));
    console.log("\nValidando Desglose por Dispositivo (Mobile):");
    console.log(JSON.stringify(funnel.byDevice.mobile, null, 2));

    // Devices seeded:
    // Reg: 15 desktop, 10 mobile
    // Guest: 15 desktop, 10 mobile
    // Total PageLoad seeded: 30 desktop, 20 mobile.
    assert(funnel.byDevice.desktop[0].count === 30, `Desktop Step 1: ${funnel.byDevice.desktop[0].count}`);
    assert(funnel.byDevice.mobile[0].count === 20, `Mobile Step 1: ${funnel.byDevice.mobile[0].count}`);
    console.log("✓ Desglose por tipo de dispositivo validado correctamente.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE FUNNEL DE LA FASE 27 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas del funnel fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

main();

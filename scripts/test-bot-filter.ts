import "dotenv/config";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { connectRedis, disconnectRedis, getRedis } from "../server/cache/redis.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import crypto from "node:crypto";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockRequest(method: string, pathname: string, body: any, clientIp: string): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: clientIp, writable: true });
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = pathname;
  req.headers = { "x-forwarded-for": clientIp };
  
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

// Lista global de IDs creados durante las pruebas para limpieza
const createdIds: string[] = [];

async function cleanUp() {
  console.log("Limpiando registros de prueba y llaves de Redis...");
  
  // Limpiar eventos creados en PostgreSQL
  if (createdIds.length > 0) {
    await analyticsPrisma.rawEvent.deleteMany({
      where: {
        id: {
          in: createdIds
        }
      }
    });
    // Vaciar lista
    createdIds.length = 0;
  }

  // Limpiar llaves de Redis de reputación
  const redis = getRedis();
  if (redis && redis.isOpen) {
    const keys = await redis.keys("reputation:*");
    for (const key of keys) {
      await redis.del(key);
    }
  }
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE DETECCIÓN DE BOTS Y RUIDO (FASE 25) ===");

  try {
    await connectRedis();
    eventBuffer.start(100);
    eventWorker.start();

    await cleanUp();

    // ==========================================
    // PRUEBA A: SPAM DE CLICS DE UI (LIMIT: 100 en 10s)
    // ==========================================
    console.log("\nProbando spam de clics en la interfaz (límite: 100/10s)...");
    const clickIp = "192.168.12.99";

    // Enviaremos 105 clics. Los primeros 100 normales, los siguientes 5 sospechosos
    const clickIds: string[] = [];
    for (let i = 1; i <= 105; i++) {
      const eventId = crypto.randomUUID();
      clickIds.push(eventId);
      createdIds.push(eventId);

      const clickEvent = {
        id: eventId,
        eventType: "UiClick",
        timestamp: new Date().toISOString(),
        payload: {
          elementId: `btn-test-${i}`,
          elementType: "button",
          action: "click"
        }
      };

      const req = mockRequest("POST", "/api/analytics/event", clickEvent, clickIp);
      const { res, getPayload } = mockResponse(req);
      await handleHttpRequest(req, res);
      const output = await getPayload();
      assert(output.status === 202, `Error en petición: ${output.status}`);
    }

    // Esperar a que el worker grabe los eventos en la base de datos
    console.log("Esperando a que el worker guarde los clics en la base de datos...");
    await sleep(2000);

    // Validar en la base de datos
    const dbClicks = await analyticsPrisma.rawEvent.findMany({
      where: {
        id: {
          in: clickIds
        }
      }
    });

    assert(dbClicks.length === 105, `Se esperaban 105 registros en BD, se encontraron ${dbClicks.length}`);

    // Map para búsquedas indexadas de payloads por ID de evento
    const clicksMap = new Map(dbClicks.map((c) => [c.id, c.payload]));

    // Los primeros 100 no deberían ser sospechosos
    for (let i = 0; i < 100; i++) {
      const payload = clicksMap.get(clickIds[i]) as any;
      assert(payload && !payload.metadata?.isSuspicious, `El clic ${i+1} (${clickIds[i]}) no debería estar marcado como sospechoso`);
    }

    // A partir del 101 deberían estar marcados
    for (let i = 100; i < 105; i++) {
      const payload = clicksMap.get(clickIds[i]) as any;
      assert(payload && payload.metadata?.isSuspicious === true, `El clic ${i+1} (${clickIds[i]}) debería estar marcado como sospechoso`);
      assert(payload.metadata?.suspicionReason.includes("Spam de UI clics"), `Razón incorrecta: ${payload.metadata?.suspicionReason}`);
    }
    console.log("✓ Spam de UI clics correctamente identificado y marcado.");

    // ==========================================
    // PRUEBA B: VELOCIDAD GLOBAL DE EVENTOS (LIMIT: 200 en 60s)
    // ==========================================
    console.log("\nProbando velocidad global de eventos (límite: 200/min)...");
    const velocityIp = "192.168.12.100";

    // Enviamos 205 eventos PageView en ráfaga
    const velocityIds: string[] = [];
    for (let i = 1; i <= 205; i++) {
      const eventId = crypto.randomUUID();
      velocityIds.push(eventId);
      createdIds.push(eventId);

      const pvEvent = {
        id: eventId,
        eventType: "PageView",
        timestamp: new Date().toISOString(),
        payload: {
          fromRoute: "/lobby",
          toRoute: `/room-${i}`,
          deviceType: "desktop"
        }
      };

      const req = mockRequest("POST", "/api/analytics/event", pvEvent, velocityIp);
      const { res, getPayload } = mockResponse(req);
      await handleHttpRequest(req, res);
      const output = await getPayload();
      assert(output.status === 202, `Error en petición: ${output.status}`);
    }

    console.log("Esperando a que el worker guarde los eventos de velocidad...");
    await sleep(2500);

    const dbVelocity = await analyticsPrisma.rawEvent.findMany({
      where: {
        id: {
          in: velocityIds
        }
      }
    });

    assert(dbVelocity.length === 205, `Se esperaban 205 registros en BD, se encontraron ${dbVelocity.length}`);

    const velocityMap = new Map(dbVelocity.map((v) => [v.id, v.payload]));

    // Los primeros 200 normales
    for (let i = 0; i < 200; i++) {
      const payload = velocityMap.get(velocityIds[i]) as any;
      assert(payload && !payload.metadata?.isSuspicious, `El evento de velocidad ${i+1} (${velocityIds[i]}) no debería estar marcado`);
    }

    // A partir del 201 sospechosos
    for (let i = 200; i < 205; i++) {
      const payload = velocityMap.get(velocityIds[i]) as any;
      assert(payload && payload.metadata?.isSuspicious === true, `El evento de velocidad ${i+1} (${velocityIds[i]}) debería estar marcado`);
      assert(payload.metadata?.suspicionReason.includes("velocidad global"), `Razón incorrecta: ${payload.metadata?.suspicionReason}`);
    }
    console.log("✓ Velocidad global excesiva detectada y enmascarada.");

    // ==========================================
    // PRUEBA C: CONCURRENCIA DE SESIONES DE INVITADO (LIMIT: 20 en 1h)
    // ==========================================
    console.log("\nProbando concurrencia excesiva de sesiones de invitado (límite: 20/h)...");
    const guestIp = "192.168.12.101";

    const guestIds: string[] = [];
    for (let i = 1; i <= 25; i++) {
      const eventId = crypto.randomUUID();
      guestIds.push(eventId);
      createdIds.push(eventId);

      const startEvent = {
        id: eventId,
        eventType: "SessionStart",
        userId: null, // Invitado
        timestamp: new Date().toISOString(),
        payload: {
          userAgent: "GuestCrawler",
          language: "es",
          screenResolution: "1920x1080"
        }
      };

      const req = mockRequest("POST", "/api/analytics/event", startEvent, guestIp);
      const { res, getPayload } = mockResponse(req);
      await handleHttpRequest(req, res);
      const output = await getPayload();
      assert(output.status === 202, `Error en petición: ${output.status}`);
    }

    console.log("Esperando a que el worker guarde las sesiones de invitado...");
    await sleep(2000);

    const dbGuests = await analyticsPrisma.rawEvent.findMany({
      where: {
        id: {
          in: guestIds
        }
      }
    });

    assert(dbGuests.length === 25, `Se esperaban 25 registros en BD, se encontraron ${dbGuests.length}`);

    const guestsMap = new Map(dbGuests.map((g) => [g.id, g.payload]));

    // Las primeras 20 normales
    for (let i = 0; i < 20; i++) {
      const payload = guestsMap.get(guestIds[i]) as any;
      assert(payload && !payload.metadata?.isSuspicious, `La sesión ${i+1} (${guestIds[i]}) no debería estar marcada`);
    }

    // A partir del 21 sospechosas
    for (let i = 20; i < 25; i++) {
      const payload = guestsMap.get(guestIds[i]) as any;
      assert(payload && payload.metadata?.isSuspicious === true, `La sesión ${i+1} (${guestIds[i]}) debería estar marcada`);
      assert(payload.metadata?.suspicionReason.includes("Concurrencia excesiva de sesiones"), `Razón incorrecta: ${payload.metadata?.suspicionReason}`);
    }
    console.log("✓ Concurrencia de invitados anormal identificada correctamente.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE LA FASE 25 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas del filtro de bots fallaron:", error);
    await cleanUp();
    process.exit(1);
  } finally {
    eventBuffer.stop();
    eventWorker.stop();
    await disconnectRedis();
  }
}

main();

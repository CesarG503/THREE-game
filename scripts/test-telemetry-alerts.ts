import "dotenv/config";
import { createServer } from "node:http";
import { alertService } from "../server/analytics/monitoring/alerts.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp() {
  console.log("Limpiando registros de telemetría de prueba en la base de datos...");
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      id: {
        startsWith: "test-mon-"
      }
    }
  });
  await analyticsPrisma.gameMap.deleteMany({
    where: {
      id: "map-123"
    }
  });
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE ALERTAS AUTOMÁTICAS (FASE 23) ===");

  const WEBHOOK_PORT = 3101;
  const receivedWebhookMessages: string[] = [];

  // 1. Iniciar un servidor HTTP local para interceptar los despachos de webhooks
  const mockWebhookServer = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        if (payload.text) {
          receivedWebhookMessages.push(payload.text);
        }
      } catch (err) {
        console.error("MockWebhookServer: Error parsing webhook body", err);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => {
    mockWebhookServer.listen(WEBHOOK_PORT, () => {
      console.log(`Mock Webhook Server escuchando en puerto ${WEBHOOK_PORT}`);
      resolve();
    });
  });

  try {
    // Limpieza inicial
    await cleanUp();
    
    // Seed a dummy map to satisfy the foreign key trigger on MatchJoin
    console.log("Sembrando mapa de prueba para evitar fallos de triggers...");
    await analyticsPrisma.gameMap.upsert({
      where: { id: "map-123" },
      update: {},
      create: {
        id: "map-123",
        slug: "map-123-slug",
        name: "Map 123",
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    alertService.clear();
    alertService.setWebhookUrl(`http://localhost:${WEBHOOK_PORT}/webhook`);

    // ==========================================
    // PRUEBA 1: ALERTA DE SILENCIO (EVENT SILENCE)
    // ==========================================
    console.log("\nProbando Alerta de Silencio...");
    
    // Simular que el último evento de MatchJoin se recibió hace 16 minutos
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000;
    alertService["lastReceivedTimes"].set("MatchJoin", sixteenMinutesAgo);
    
    // Ejecutar verificación de alertas
    await alertService.checkAllAlerts();
    
    // Validar estado de la alerta
    const activeAlerts1 = alertService.getActiveAlerts();
    assert(activeAlerts1.get("silence_MatchJoin") === true, "La alerta de silencio para MatchJoin debería estar activa");
    assert(
      receivedWebhookMessages.length === 1 && receivedWebhookMessages[0].includes("Alerta de silencio para MatchJoin"),
      `Se debería haber despachado 1 webhook de alerta. Mensajes recibidos: ${JSON.stringify(receivedWebhookMessages)}`
    );
    console.log("✓ Alerta de silencio activada con éxito.");

    // Simular recepción de un evento nuevo (recuperación de silencio)
    console.log("Simulando recepción de evento MatchJoin para verificar recuperación...");
    alertService.recordReceived("MatchJoin");
    
    await alertService.checkAllAlerts();
    
    const activeAlerts2 = alertService.getActiveAlerts();
    assert(activeAlerts2.get("silence_MatchJoin") === false, "La alerta de silencio para MatchJoin debería haberse resuelto");
    assert(
      receivedWebhookMessages.length === 2 && receivedWebhookMessages[1].includes("RESOLVED"),
      `Se debería haber despachado el webhook de resolución. Mensajes recibidos: ${JSON.stringify(receivedWebhookMessages)}`
    );
    console.log("✓ Alerta de silencio resuelta con éxito.");

    // ==========================================
    // PRUEBA 2: CAÍDA ABRUPTA Y UMBRALES DINÁMICOS
    // ==========================================
    console.log("\nProbando Alerta de Umbrales Dinámicos (Caída de Ingesta)...");
    
    // Sembrar registros históricos en la BD para los últimos 7 días
    // Cada día en el mismo rango de 15 minutos sembramos 50 eventos
    console.log("Sembrando 350 registros históricos en RawEvent para los últimos 7 días...");
    const now = new Date();
    const dayOffset = 24 * 60 * 60 * 1000;
    
    for (let i = 1; i <= 7; i++) {
      const baseTime = now.getTime() - i * dayOffset;
      // Creamos 50 eventos
      for (let j = 0; j < 50; j++) {
        await analyticsPrisma.rawEvent.create({
          data: {
            id: `test-mon-hist-${i}-${j}`,
            eventType: "MatchJoin",
            timestamp: new Date(baseTime - j * 5000), // Espaciados cada 5s para estar dentro del rango de 15min
            payload: { roomId: "room-abc", mapId: "map-123" }
          }
        });
      }
    }
    console.log("✓ Historial de telemetría sembrado.");

    // Caso A: Tasa de eventos actual NORMAL (Registrar 40 eventos en memoria en el último minuto)
    console.log("Simulando tasa de eventos normal (40 recibidos en memoria)...");
    for (let k = 0; k < 40; k++) {
      alertService.recordReceived("MatchJoin");
    }
    
    await alertService.checkAllAlerts();
    
    const activeAlerts3 = alertService.getActiveAlerts();
    assert(activeAlerts3.get("drop_MatchJoin") !== true, "No debería activarse la alerta de caída si la tasa es normal");
    console.log("✓ Caso normal verificado sin falsas alertas.");

    // Caso B: Caída abrupta (Limpiar memoria y dejar sólo 4 eventos de los 50 esperados)
    console.log("Simulando caída abrupta (sólo 4 eventos recibidos en memoria)...");
    alertService["receivedTimestamps"].set("MatchJoin", Array(4).fill(Date.now()));
    
    await alertService.checkAllAlerts();
    
    const activeAlerts4 = alertService.getActiveAlerts();
    assert(activeAlerts4.get("drop_MatchJoin") === true, "La alerta de caída de volumen debería estar activa");
    assert(
      receivedWebhookMessages.length === 3 && receivedWebhookMessages[2].includes("Caída abrupta"),
      "Se debería haber recibido el webhook de caída abrupta"
    );
    console.log("✓ Alerta por caída abrupta detectada con umbral dinámico.");

    // Caso C: Recuperación (Registrar 35 eventos en memoria de nuevo)
    console.log("Simulando recuperación de la ingesta de eventos (35 recibidos)...");
    for (let k = 0; k < 35; k++) {
      alertService.recordReceived("MatchJoin");
    }
    
    await alertService.checkAllAlerts();
    
    const activeAlerts5 = alertService.getActiveAlerts();
    assert(activeAlerts5.get("drop_MatchJoin") === false, "La alerta de caída debería haberse resuelto");
    assert(
      receivedWebhookMessages.length === 4 && receivedWebhookMessages[3].includes("RESOLVED"),
      "Se debería haber recibido el webhook de resolución de caída"
    );
    console.log("✓ Alerta por caída abrupta resuelta tras normalización.");

    // Limpiar base de datos
    await cleanUp();
    mockWebhookServer.close();
    console.log("\n=== TODAS LAS PRUEBAS DE LA FASE 23 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de alertas fallaron:", error);
    await cleanUp();
    mockWebhookServer.close();
    process.exit(1);
  }
}

main();

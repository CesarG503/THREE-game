import "dotenv/config";
import { createServer, request } from "node:http";
import { randomUUID } from "node:crypto";
import { handleHttpRequest } from "../server/http/ApiServer.js";
import { metricsCollector } from "../server/analytics/monitoring/metricsCollector.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp() {
  console.log("Cleaning up test database records...");
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      id: {
        startsWith: "test-mon-"
      }
    }
  });
}

async function fetchHelper(url: string, options: any = {}) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const reqUrl = new URL(url);
    const reqOptions = {
      hostname: reqUrl.hostname,
      port: reqUrl.port,
      path: reqUrl.pathname + reqUrl.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = request(reqOptions, (res: any) => {
      let data = "";
      res.on("data", (chunk: any) => {
        data += chunk.toString("utf8");
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          text: data,
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE MONITOREO Y ALERTAS DE TELEMETRÍA ===");

  const PORT = 3099;
  const server = createServer(handleHttpRequest);

  try {
    // 0. Clean up any previous test leftovers
    await cleanUp();

    // Clear metrics collector state to start fresh
    metricsCollector.clear();
    eventBuffer.clear();

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => {
        console.log(`Servidor de prueba HTTP corriendo en puerto ${PORT}`);
        resolve();
      });
    });

    // 1. Validar endpoint de Prometheus inicial (/api/metrics)
    console.log("Validando /api/metrics inicial...");
    const resMetricsInit = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(resMetricsInit.status === 200, `Expected status 200, got ${resMetricsInit.status}`);
    assert(resMetricsInit.text.includes("telemetry_events_received_total"), "Debería incluir telemetry_events_received_total");
    assert(resMetricsInit.text.includes("telemetry_event_latency_ms{percentile=\"95\"} 0"), "La latencia inicial P95 debería ser 0");

    // 2. Validar envío de evento inválido (debe registrarse como recibido y fallado)
    console.log("Validando envío de evento inválido...");
    const invalidEvent = {
      id: randomUUID(),
      eventType: "PageView",
      payload: { toRoute: "/cat" } // Falta fromRoute y deviceType
    };
    const resInvalid = await fetchHelper(`http://localhost:${PORT}/api/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidEvent),
    });
    assert(resInvalid.status === 400, `Expected status 400, got ${resInvalid.status}`);

    const resMetricsAfterInvalid = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(
      resMetricsAfterInvalid.text.includes('telemetry_events_received_total{event_type="PageView"} 1'),
      "El contador de recibidos para PageView debe ser 1"
    );
    assert(
      resMetricsAfterInvalid.text.includes('telemetry_events_failed_total{event_type="PageView"} 1'),
      "El contador de fallidos para PageView debe ser 1"
    );

    // 3. Validar envío de evento válido (debe registrarse como recibido, sin fallar)
    console.log("Validando envío de evento válido...");
    const validEvent = {
      id: randomUUID(),
      eventType: "PageView",
      timestamp: new Date().toISOString(),
      payload: { fromRoute: "/home", toRoute: "/lobby", deviceType: "desktop" }
    };
    const resValid = await fetchHelper(`http://localhost:${PORT}/api/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validEvent),
    });
    assert(resValid.status === 202, `Expected status 202, got ${resValid.status}`);

    const resMetricsAfterValid = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(
      resMetricsAfterValid.text.includes('telemetry_events_received_total{event_type="PageView"} 2'),
      "El contador de recibidos para PageView debe ser 2"
    );
    assert(
      resMetricsAfterValid.text.includes('telemetry_events_failed_total{event_type="PageView"} 1'),
      "El contador de fallidos para PageView debe permanecer en 1"
    );
    assert(
      resMetricsAfterValid.text.includes('telemetry_queue_backpressure_events 1'),
      "La cola de backpressure debe indicar 1 evento"
    );

    // Limpiar buffer para que no intente vaciarse en Redis real en background
    eventBuffer.clear();

    // 4. Validar EventWorker - Ingestión de lote y cálculo de métricas
    console.log("Validando procesamiento de lote por el EventWorker...");
    const testEvents = [
      {
        id: "test-mon-batch-1",
        eventType: "PageView",
        userId: null,
        timestamp: new Date(),
        payload: { fromRoute: "/lobby", toRoute: "/game", deviceType: "desktop" }
      },
      {
        id: "test-mon-batch-2",
        eventType: "PageView",
        userId: null,
        timestamp: new Date(),
        payload: { fromRoute: "/game", toRoute: "/lobby", deviceType: "desktop" }
      }
    ];

    // Procesar lote directamente
    await eventWorker.processBatch(testEvents);

    // Verificar en la BD que fueron insertados
    const dbEvents = await analyticsPrisma.rawEvent.findMany({
      where: { id: { in: ["test-mon-batch-1", "test-mon-batch-2"] } }
    });
    assert(dbEvents.length === 2, `Deberían haberse insertado 2 eventos en BD, encontrados ${dbEvents.length}`);

    // Verificar contadores de persistencia y overhead
    const resMetricsAfterBatch = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(
      resMetricsAfterBatch.text.includes('telemetry_events_persisted_total{event_type="PageView"} 2'),
      "El contador de persistidos para PageView debe ser 2"
    );
    assert(
      resMetricsAfterBatch.text.includes('telemetry_processing_overhead_count 1'),
      "Debería haberse registrado 1 ejecución de lote en los overheads"
    );

    // 5. Validar lógica de alertas P95 y recuperación
    console.log("Validando lógica de alertas P95...");
    assert(metricsCollector.isAlertActive() === false, "La alerta inicial no debería estar activa");

    // Inyectar un lote lento (latencia de 3000ms)
    console.log("Inyectando evento lento (> 2 segundos)...");
    const lateEvent = {
      id: "test-mon-batch-late",
      eventType: "PageView",
      userId: null,
      timestamp: new Date(Date.now() - 3000), // 3000ms en el pasado
      payload: { fromRoute: "/lobby", toRoute: "/game", deviceType: "desktop" }
    };

    await eventWorker.processBatch([lateEvent]);
    assert(metricsCollector.isAlertActive() === true, "La alerta P95 debería haberse activado");

    const resMetricsAlert = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(
      resMetricsAlert.text.includes("telemetry_alert_active 1"),
      "La métrica de alerta activa en Prometheus debe ser 1"
    );
    assert(
      metricsCollector.getPercentile(95) >= 2900,
      `La latencia P95 calculada debería ser ~3000ms, obtenida: ${metricsCollector.getPercentile(95)}ms`
    );

    // Inyectar múltiples eventos rápidos para forzar la recuperación
    console.log("Inyectando ráfaga de eventos rápidos para forzar recuperación...");
    const fastEvents = [];
    for (let i = 0; i < 25; i++) {
      fastEvents.push({
        id: `test-mon-batch-fast-${i}`,
        eventType: "PageView",
        userId: null,
        timestamp: new Date(),
        payload: { fromRoute: "/lobby", toRoute: "/game", deviceType: "desktop" }
      });
    }

    await eventWorker.processBatch(fastEvents);
    assert(metricsCollector.isAlertActive() === false, "La alerta P95 debería haberse desactivado (recuperado)");

    const resMetricsRecovered = await fetchHelper(`http://localhost:${PORT}/api/metrics`);
    assert(
      resMetricsRecovered.text.includes("telemetry_alert_active 0"),
      "La métrica de alerta activa en Prometheus debe ser 0"
    );

    console.log("✓ Todas las aserciones de monitoreo de telemetría y alertas pasaron con éxito!");

    // 6. Limpieza
    await cleanUp();
    server.close();
    console.log("=== TODAS LAS PRUEBAS DE LA FASE 22 PASARON ===");
    process.exit(0);
  } catch (err) {
    console.error("FAIL: Las pruebas fallaron con error:", err);
    try {
      await cleanUp();
    } catch (cleanErr) {
      console.error("Error al limpiar:", cleanErr);
    }
    server.close();
    process.exit(1);
  }
}

main();

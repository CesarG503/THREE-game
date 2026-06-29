import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";
import { computeReturnIntentForUser } from "../server/analytics/features/return_intent.js";
import { EventWorker } from "../server/analytics/eventWorker.js";
import crypto from "crypto";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 15: INTENCIÓN DE RETORNO IMPLÍCITA (IRI) ===");

  const now = new Date();
  const userIdA = "test-ua-" + Date.now();
  const userIdB = "test-ub-" + Date.now();

  console.log("1. Configurando estados de base de datos...");

  // Limpieza de ejecuciones anteriores
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { startsWith: "test-u" } } });
  await analyticsPrisma.rawEvent.deleteMany({ where: { userId: { startsWith: "test-u" } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { startsWith: "test-u" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "test-u" } } });

  // Crear usuarios de prueba
  for (const u of [
    { id: userIdA, email: `${userIdA}@test.local`, username: `ua-${Date.now()}` },
    { id: userIdB, email: `${userIdB}@test.local`, username: `ub-${Date.now()}` },
  ]) {
    await prisma.user.create({ data: { ...u, passwordHash: "dummy" } });
    try {
      await analyticsPrisma.user.create({ data: { ...u, createdAt: now, updatedAt: now } });
    } catch (e: any) {
      if (e.code !== "P2002") throw e;
    }
  }

  // ── CONFIGURACIÓN DE EVENTOS ──────────────────────────────────────────────

  // USUARIO A: Buen comportamiento, baja latencia (40ms), completó 3 de 3 partidas.
  const timeAStart = new Date(now.getTime() - 650 * 1000);
  const timeAEnd = new Date(now.getTime() - 10 * 1000);

  const eventsUserA = [
    {
      id: crypto.randomUUID(),
      eventType: "SessionStart",
      userId: userIdA,
      timestamp: timeAStart,
      payload: {},
    },
    // Partida 1: Inicia y termina con MatchEnd de sala
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdA,
      timestamp: new Date(timeAStart.getTime() + 50 * 1000),
      payload: { roomId: "room-a1" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchEnd",
      userId: null,
      timestamp: new Date(timeAStart.getTime() + 150 * 1000),
      payload: { roomId: "room-a1" },
    },
    // Partida 2: Inicia y termina con MatchLeave exitosa (completed)
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdA,
      timestamp: new Date(timeAStart.getTime() + 200 * 1000),
      payload: { roomId: "room-a2" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchLeave",
      userId: userIdA,
      timestamp: new Date(timeAStart.getTime() + 300 * 1000),
      payload: { roomId: "room-a2", reason: "completed" },
    },
    // Partida 3: Inicia y termina con MatchLeave exitosa (finished)
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdA,
      timestamp: new Date(timeAStart.getTime() + 350 * 1000),
      payload: { roomId: "room-a3" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchLeave",
      userId: userIdA,
      timestamp: new Date(timeAStart.getTime() + 450 * 1000),
      payload: { roomId: "room-a3", reason: "finished" },
    },
    // Fin de sesión
    {
      id: crypto.randomUUID(),
      eventType: "SessionEnd",
      userId: userIdA,
      timestamp: timeAEnd,
      payload: {
        durationSeconds: 600,
        idleSeconds: 50,
        usefulSeconds: 550,
        averageLatencyMs: 40,
      },
    },
  ];

  // USUARIO B: Mal comportamiento, alta latencia (250ms), completó 1 de 3 partidas (2 abandonos).
  const timeBStart = new Date(now.getTime() - 1300 * 1000);
  const timeBEnd = new Date(now.getTime() - 10 * 1000);

  const eventsUserB = [
    {
      id: crypto.randomUUID(),
      eventType: "SessionStart",
      userId: userIdB,
      timestamp: timeBStart,
      payload: {},
    },
    // Partida 1: Inicia y termina con MatchEnd de sala (Completada)
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdB,
      timestamp: new Date(timeBStart.getTime() + 100 * 1000),
      payload: { roomId: "room-b1" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchEnd",
      userId: null,
      timestamp: new Date(timeBStart.getTime() + 300 * 1000),
      payload: { roomId: "room-b1" },
    },
    // Partida 2: Abandono voluntario prematuro (rage_quit)
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdB,
      timestamp: new Date(timeBStart.getTime() + 400 * 1000),
      payload: { roomId: "room-b2" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchLeave",
      userId: userIdB,
      timestamp: new Date(timeBStart.getTime() + 450 * 1000),
      payload: { roomId: "room-b2", reason: "rage_quit" },
    },
    // Partida 3: Abandono por desconexión técnica (network_disconnect)
    {
      id: crypto.randomUUID(),
      eventType: "MatchJoin",
      userId: userIdB,
      timestamp: new Date(timeBStart.getTime() + 600 * 1000),
      payload: { roomId: "room-b3" },
    },
    {
      id: crypto.randomUUID(),
      eventType: "MatchLeave",
      userId: userIdB,
      timestamp: new Date(timeBStart.getTime() + 650 * 1000),
      payload: { roomId: "room-b3", reason: "network_disconnect" },
    },
    // Fin de sesión
    {
      id: crypto.randomUUID(),
      eventType: "SessionEnd",
      userId: userIdB,
      timestamp: timeBEnd,
      payload: {
        durationSeconds: 1200,
        idleSeconds: 200,
        usefulSeconds: 1000,
        averageLatencyMs: 250,
      },
    },
  ];

  console.log("2. Insertando eventos de telemetría en base de datos...");
  await analyticsPrisma.rawEvent.createMany({ data: eventsUserA });
  await analyticsPrisma.rawEvent.createMany({ data: eventsUserB });

  console.log("3. Ejecutando motor de cálculo de IRI...");

  const iriA = await computeReturnIntentForUser(userIdA);
  const iriB = await computeReturnIntentForUser(userIdB);

  console.log(`\n=== RESULTADOS DEL CÁLCULO ===`);
  console.log(`Usuario A (Esperado: 1.0 * (1/40) = 0.025000): ${iriA}`);
  console.log(`Usuario B (Esperado: 0.3333 * (1/250) = 0.001333): ${iriB}`);

  if (!iriA || Math.abs(iriA - 0.025) > 1e-6) {
    throw new Error(`Cálculo de IRI erróneo para Usuario A: ${iriA}`);
  }

  if (!iriB || Math.abs(iriB - 0.001333) > 1e-4) {
    throw new Error(`Cálculo de IRI erróneo para Usuario B: ${iriB}`);
  }

  // Verificar que los datos se guardaron en PlayerFeatures
  const featuresA = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: userIdA } });
  const featuresB = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: userIdB } });

  console.log(`\nDB PlayerFeatures A: returnIntent = ${featuresA?.returnIntent}`);
  console.log(`DB PlayerFeatures B: returnIntent = ${featuresB?.returnIntent}`);

  if (featuresA?.returnIntent !== iriA || featuresB?.returnIntent !== iriB) {
    throw new Error("Los valores de returnIntent en base de datos no coinciden con los calculados.");
  }

  console.log("\n4. Verificando integración reactiva con EventWorker...");
  
  // Limpiar returnIntent de DB
  await analyticsPrisma.playerFeatures.update({
    where: { userId: userIdA },
    data: { returnIntent: null },
  });

  const worker = new EventWorker();

  // Mock de un evento SessionEnd para ser procesado por el lote del worker
  const testSessionEndEvent = {
    id: crypto.randomUUID(),
    eventType: "SessionEnd",
    userId: userIdA,
    timestamp: timeAEnd.toISOString() as any, // Simula serialización Redis
    payload: {
      durationSeconds: 600,
      idleSeconds: 50,
      usefulSeconds: 550,
      averageLatencyMs: 40,
    },
  };

  console.log("Invocando processBatch con evento SessionEnd...");
  await worker.processBatch([testSessionEndEvent]);

  // Esperar un momento a que el cálculo asíncrono se resuelva en segundo plano
  await new Promise((resolve) => setTimeout(resolve, 500));

  const updatedFeaturesA = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: userIdA } });
  console.log(`DB PlayerFeatures A (post-worker): returnIntent = ${updatedFeaturesA?.returnIntent}`);

  if (!updatedFeaturesA?.returnIntent || Math.abs(updatedFeaturesA.returnIntent - 0.025) > 1e-6) {
    throw new Error("La integración reactiva del EventWorker no disparó o no calculó correctamente el IRI.");
  }

  console.log("\n5. Limpiando datos de prueba...");
  await prisma.user.deleteMany({ where: { id: { in: [userIdA, userIdB] } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: [userIdA, userIdB] } } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DE IRI (FASE 15) PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

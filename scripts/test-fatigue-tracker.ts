import { computePlayerFatigue } from "../server/analytics/features/fatigue_tracker.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";

async function run() {
  const now = new Date();
  
  const userFatigued = "test-u-fatigue-" + Date.now();
  const userNetIssue = "test-u-netissue-" + Date.now();
  const userColdStart = "test-u-cold-" + Date.now();
  const mapId = "map-fav-test";

  console.log("Setting up DB states for test...");
  
  // Limpiar estados previos si los hay
  await analyticsPrisma.fatiguedMap.deleteMany({ where: { userId: { startsWith: "test-u-" } } });
  await analyticsPrisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "test-u-" } } });

  // Crear mapa
  await analyticsPrisma.gameMap.create({
    data: {
      id: mapId,
      name: "Favorite Test Map",
      slug: "fav-test-map",
      isPublished: true,
      createdAt: now,
      updatedAt: now
    }
  });

  // Crear usuarios en BD pública y analítica
  for (const u of [
    { id: userFatigued, email: `${userFatigued}@test.local`, username: `fatigue-${Date.now()}` },
    { id: userNetIssue, email: `${userNetIssue}@test.local`, username: `netissue-${Date.now()}` },
    { id: userColdStart, email: `${userColdStart}@test.local`, username: `cold-${Date.now()}` },
  ]) {
    await prisma.user.create({ data: { ...u, passwordHash: "dummy" } });
    try {
      await analyticsPrisma.user.create({ data: { ...u, createdAt: now, updatedAt: now } });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }
  }

  // Generar eventos simulados
  const mockEvents: any[] = [];

  // 1. Usuario Fatigado: 7 partidas largas (100s) + 3 partidas súper cortas (15s, razón normal)
  // Promedio total: ((7 * 100) + (3 * 15)) / 10 = 745 / 10 = 74.5s
  // 20% de 74.5s = 14.9s. Espera, 15s es ligeramente mayor a 14.9s, así que hagamos las partidas cortas de 10s.
  // Con 10s: ((7 * 100) + (3 * 10)) / 10 = 730 / 10 = 73s. 20% de 73s = 14.6s. 10s es < 14.6s. Cumple!
  for (let i = 0; i < 7; i++) {
    mockEvents.push({
      userId: userFatigued,
      eventType: "MatchLeave",
      timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
      payload: { mapId, durationSeconds: 100, reason: "MatchFinished" }
    });
  }
  for (let i = 7; i < 10; i++) {
    mockEvents.push({
      userId: userFatigued,
      eventType: "MatchLeave",
      timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
      payload: { mapId, durationSeconds: 10, reason: "Quit" }
    });
  }

  // 2. Usuario con fallas de red: 7 partidas largas (100s) + 3 partidas cortas (10s) pero por desconexión técnica
  for (let i = 0; i < 7; i++) {
    mockEvents.push({
      userId: userNetIssue,
      eventType: "MatchLeave",
      timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
      payload: { mapId, durationSeconds: 100, reason: "MatchFinished" }
    });
  }
  for (let i = 7; i < 10; i++) {
    mockEvents.push({
      userId: userNetIssue,
      eventType: "MatchLeave",
      timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
      payload: { mapId, durationSeconds: 10, reason: "network_disconnect" }
    });
  }

  // 3. Usuario Cold-Start: Solo 2 partidas de 10s en total (menor a 3)
  for (let i = 0; i < 2; i++) {
    mockEvents.push({
      userId: userColdStart,
      eventType: "MatchLeave",
      timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
      payload: { mapId, durationSeconds: 10, reason: "Quit" }
    });
  }

  // Monkey patch rawEvent.findMany para retornar los eventos mockeados
  const originalFindMany = analyticsPrisma.rawEvent.findMany;
  analyticsPrisma.rawEvent.findMany = (async () => mockEvents) as any;

  console.log("Mocking telemetry. Running player fatigue tracking computation...");
  await computePlayerFatigue(14);

  // Validaciones Fase 1
  const fatiguedEntry = await analyticsPrisma.fatiguedMap.findUnique({
    where: { userId_mapId: { userId: userFatigued, mapId } }
  });
  const netIssueEntry = await analyticsPrisma.fatiguedMap.findUnique({
    where: { userId_mapId: { userId: userNetIssue, mapId } }
  });
  const coldStartEntry = await analyticsPrisma.fatiguedMap.findUnique({
    where: { userId_mapId: { userId: userColdStart, mapId } }
  });

  console.log("\n--- Round 1 Results ---");
  console.log(`User Fatigued (A) Status: ${fatiguedEntry ? "FATIGUED (Correct)" : "NOT FATIGUED (Error)"}`);
  console.log(`User Net Issue (B) Status: ${netIssueEntry ? "FATIGUED (Error)" : "NOT FATIGUED (Correct)"}`);
  console.log(`User Cold Start (C) Status: ${coldStartEntry ? "FATIGUED (Error)" : "NOT FATIGUED (Correct)"}`);

  if (!fatiguedEntry) throw new Error("Validation failed: User A should be fatigued.");
  if (netIssueEntry) throw new Error("Validation failed: User B had network issues, should not be fatigued.");
  if (coldStartEntry) throw new Error("Validation failed: User C lacks minimum matches, should not be fatigued.");

  // Fase 2: Simular que el Usuario A vuelve a jugar y tiene una buena partida (100 segundos)
  // Ahora, las últimas 3 partidas para el Usuario A serán: [10s, 10s, 100s].
  // Esto ya no cumple la regla de las últimas 3 partidas < 20% del promedio histórico.
  // El promedio se recalcula: ((7*100) + (3*10) + 100) / 11 = 830 / 11 = 75.4s
  // Las últimas 3 duraciones: 10s, 10s, 100s. 100s es mayor a 15.08s (20%), por lo que la fatiga debe removerse.
  mockEvents.push({
    userId: userFatigued,
    eventType: "MatchLeave",
    timestamp: new Date(),
    payload: { mapId, durationSeconds: 100, reason: "MatchFinished" }
  });

  console.log("\nSimulating user playing a long session again. Running compute again...");
  await computePlayerFatigue(14);

  const fatiguedEntryRound2 = await analyticsPrisma.fatiguedMap.findUnique({
    where: { userId_mapId: { userId: userFatigued, mapId } }
  });

  console.log("--- Round 2 Results ---");
  console.log(`User Fatigued (A) Status in Round 2: ${fatiguedEntryRound2 ? "STILL FATIGUED (Error)" : "CLEARED (Correct)"}`);

  if (fatiguedEntryRound2) throw new Error("Validation failed: User A played a long match, fatigue should be cleared.");

  // Restaurar original
  analyticsPrisma.rawEvent.findMany = originalFindMany;

  console.log("\nTests passed successfully! Cleaning up test records...");
  
  await analyticsPrisma.fatiguedMap.deleteMany({ where: { userId: { startsWith: "test-u-" } } });
  await analyticsPrisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "test-u-" } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { startsWith: "test-u-" } } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
  console.log("Cleanup complete!");
}

run().catch((e) => {
  console.error("Test failed with error:", e);
  process.exit(1);
});

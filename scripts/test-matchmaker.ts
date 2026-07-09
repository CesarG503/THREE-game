/**
 * Fase 39 - Pruebas del Servidor de Matchmaking por Regiones y Latencia de Red
 *
 * Simula 10 jugadores virtuales con distintas regiones y verifica:
 * 1. Formación de salas regionales automáticas (≥ MIN_PLAYERS)
 * 2. Fallback de expansión regional tras timeout simulado
 * 3. leaveQueue y limpieza correcta de tickets
 * 4. Estadísticas de cola (getQueueStatus)
 */

import { MatchmakingQueue, type MatchResult, REGIONS } from "../server/services/Matchmaker.js";

async function main() {
  console.log("=== INICIANDO PRUEBAS FASE 39: SERVIDOR DE MATCHMAKING REGIONAL ===\n");

  const mm = new MatchmakingQueue();

  // ── Test 1: Formación de salas regionales ─────────────────────────────────
  console.log("1. Probando formación de salas regionales con MIN_PLAYERS...");

  const matchResults: MatchResult[] = [];

  // Add 3 players to us-east
  const t1 = mm.joinQueue({
    userId: "user-1",
    playerId: "p1",
    region: "us-east",
    onMatchFound: (r) => matchResults.push(r),
  });
  const t2 = mm.joinQueue({
    userId: "user-2",
    playerId: "p2",
    region: "us-east",
    onMatchFound: (r) => matchResults.push(r),
  });
  const t3 = mm.joinQueue({
    userId: "user-3",
    playerId: "p3",
    region: "us-east",
    onMatchFound: (r) => matchResults.push(r),
  });

  console.log(`  Tickets creados: ${t1.ticketId.slice(0, 12)}..., ${t2.ticketId.slice(0, 12)}..., ${t3.ticketId.slice(0, 12)}...`);
  console.log(`  Región asignada: ${t1.region}`);

  // Run tick — should form a room with all 3 us-east players
  const tickResults1 = mm.tick();
  console.log(`  Salas formadas tras tick: ${tickResults1.length}`);

  if (tickResults1.length !== 1) {
    throw new Error(`Expected 1 room to be formed, got ${tickResults1.length}`);
  }

  const room1 = tickResults1[0]!;
  console.log(`  Sala: ${room1.roomId}, Región: ${room1.region}, Jugadores: ${room1.players.length}, Latencia promedio: ${room1.averageLatency}ms`);

  if (room1.region !== "us-east") {
    throw new Error(`Expected room region to be us-east, got ${room1.region}`);
  }
  if (room1.players.length !== 3) {
    throw new Error(`Expected 3 players in room, got ${room1.players.length}`);
  }
  if (room1.averageLatency !== 20) {
    throw new Error(`Expected avg latency of 20ms for us-east→us-east, got ${room1.averageLatency}`);
  }

  // Verify callbacks were fired
  if (matchResults.length !== 3) {
    throw new Error(`Expected 3 onMatchFound callbacks, got ${matchResults.length}`);
  }

  console.log("✓ Formación de sala regional correcta.\n");

  // ── Test 2: Cola insuficiente (no forma sala) ─────────────────────────────
  console.log("2. Probando que cola con un solo jugador NO forme sala...");

  mm.clear();

  mm.joinQueue({ userId: "lone-user", playerId: "lone-p", region: "eu-west" });
  const tickResults2 = mm.tick();

  if (tickResults2.length !== 0) {
    throw new Error(`Expected 0 rooms to be formed with 1 player, got ${tickResults2.length}`);
  }

  const status2 = mm.getQueueStatus();
  const euQueue = status2.queues.find((q) => q.region === "eu-west");
  if (!euQueue || euQueue.size !== 1) {
    throw new Error(`Expected eu-west queue size to be 1, got ${euQueue?.size}`);
  }

  console.log(`  eu-west queue size: ${euQueue.size}, total waiting: ${status2.totalWaiting}`);
  console.log("✓ Cola insuficiente no forma sala.\n");

  // ── Test 3: leaveQueue ────────────────────────────────────────────────────
  console.log("3. Probando leaveQueue y limpieza de tickets...");

  mm.clear();

  const joinResult = mm.joinQueue({ userId: "quitter", playerId: "q1", region: "sa-east" });
  console.log(`  Ticket creado: ${joinResult.ticketId.slice(0, 12)}...`);

  const statusBefore = mm.getQueueStatus();
  const saQueueBefore = statusBefore.queues.find((q) => q.region === "sa-east");
  console.log(`  sa-east antes de leave: ${saQueueBefore?.size}`);

  const removed = mm.leaveQueue(joinResult.ticketId);
  if (!removed) {
    throw new Error("Expected leaveQueue to return true");
  }

  const statusAfter = mm.getQueueStatus();
  const saQueueAfter = statusAfter.queues.find((q) => q.region === "sa-east");
  if (saQueueAfter && saQueueAfter.size !== 0) {
    throw new Error(`Expected sa-east queue to be empty after leave, got ${saQueueAfter.size}`);
  }

  // Try leaving again (should return false)
  const removedAgain = mm.leaveQueue(joinResult.ticketId);
  if (removedAgain) {
    throw new Error("Expected second leaveQueue to return false");
  }

  console.log("✓ leaveQueue funciona correctamente.\n");

  // ── Test 4: Expansión regional por timeout (simulada) ─────────────────────
  console.log("4. Probando expansión regional adyacente tras timeout simulado...");
  console.log("   (us-east ↔ eu-west = 90ms, dentro del umbral de 150ms)");

  mm.clear();

  // Add 1 player to us-east with an old joinedAt (> 30s ago) to simulate timeout
  const oldJoinedAt = Date.now() - 35_000; // 35 seconds ago
  mm.joinQueue({
    userId: "us-user",
    playerId: "us-p",
    region: "us-east",
    onMatchFound: (r) => matchResults.push(r),
  });

  // Manually adjust joinedAt to simulate waiting
  const usQueue4 = (mm as any).queues.get("us-east") as any[];
  if (usQueue4 && usQueue4[0]) {
    usQueue4[0].joinedAt = oldJoinedAt;
  }

  // Add 1 player to eu-west (adjacent to us-east with 90ms latency)
  mm.joinQueue({
    userId: "eu-user",
    playerId: "eu-p",
    region: "eu-west",
    onMatchFound: (r) => matchResults.push(r),
  });

  matchResults.length = 0; // Reset callbacks

  const tickResults4 = mm.tick();
  console.log(`  Salas formadas tras tick con expansión adyacente: ${tickResults4.length}`);

  if (tickResults4.length !== 1) {
    throw new Error(`Expected 1 room from adjacent merge, got ${tickResults4.length}`);
  }

  const room4 = tickResults4[0]!;
  console.log(`  Sala: ${room4.roomId}, Región host: ${room4.region}, Jugadores: ${room4.players.length}, Latencia promedio: ${room4.averageLatency}ms`);

  if (room4.players.length !== 2) {
    throw new Error(`Expected 2 players in merged room, got ${room4.players.length}`);
  }

  console.log("✓ Expansión regional adyacente funciona correctamente.\n");

  // ── Test 4b: Fallback global (asia-east no tiene adyacentes < 150ms) ──────
  console.log("4b. Probando fallback global tras timeout > 60s (asia-east)...");

  mm.clear();

  const globalJoinedAt = Date.now() - 65_000; // 65 seconds ago
  mm.joinQueue({
    userId: "asia-user",
    playerId: "asia-p",
    region: "asia-east",
    onMatchFound: (r) => matchResults.push(r),
  });

  const asiaQueue = (mm as any).queues.get("asia-east") as any[];
  if (asiaQueue && asiaQueue[0]) {
    asiaQueue[0].joinedAt = globalJoinedAt;
  }

  mm.joinQueue({
    userId: "sa-user",
    playerId: "sa-p",
    region: "sa-east",
    onMatchFound: (r) => matchResults.push(r),
  });

  matchResults.length = 0;

  const tickResults4b = mm.tick();
  console.log(`  Salas formadas tras fallback global: ${tickResults4b.length}`);

  if (tickResults4b.length !== 1) {
    throw new Error(`Expected 1 room from global merge, got ${tickResults4b.length}`);
  }

  const room4b = tickResults4b[0]!;
  console.log(`  Sala: ${room4b.roomId}, Región host: ${room4b.region}, Jugadores: ${room4b.players.length}, Latencia promedio: ${room4b.averageLatency}ms`);

  if (room4b.players.length !== 2) {
    throw new Error(`Expected 2 players in global merged room, got ${room4b.players.length}`);
  }

  console.log("✓ Fallback global funciona correctamente.\n");

  // ── Test 5: 10 jugadores virtuales multi-región ───────────────────────────
  console.log("5. Probando 10 jugadores virtuales con distintas regiones...");

  mm.clear();

  const virtualPlayers = [
    { userId: "v1", region: "us-east" },
    { userId: "v2", region: "us-east" },
    { userId: "v3", region: "us-east" },
    { userId: "v4", region: "eu-west" },
    { userId: "v5", region: "eu-west" },
    { userId: "v6", region: "eu-west" },
    { userId: "v7", region: "sa-east" },
    { userId: "v8", region: "sa-east" },
    { userId: "v9", region: "asia-east" },
    { userId: "v10", region: "asia-east" },
  ];

  const allCallbacks: MatchResult[] = [];
  for (const vp of virtualPlayers) {
    mm.joinQueue({
      userId: vp.userId,
      playerId: `p-${vp.userId}`,
      region: vp.region,
      onMatchFound: (r) => allCallbacks.push(r),
    });
  }

  const statusBefore5 = mm.getQueueStatus();
  console.log(`  Total en cola antes de tick: ${statusBefore5.totalWaiting}`);

  const tickResults5 = mm.tick();
  console.log(`  Salas formadas: ${tickResults5.length}`);

  for (const room of tickResults5) {
    console.log(`    Sala ${room.roomId.slice(0, 16)}... → ${room.region}, ${room.players.length} jugadores, ${room.averageLatency}ms avg`);
  }

  // Should form 4 rooms (one per region, since each region has ≥ 2 players)
  if (tickResults5.length !== 4) {
    throw new Error(`Expected 4 regional rooms, got ${tickResults5.length}`);
  }

  const statusAfter5 = mm.getQueueStatus();
  console.log(`  Total en cola después de tick: ${statusAfter5.totalWaiting}`);

  if (statusAfter5.totalWaiting !== 0) {
    throw new Error(`Expected 0 waiting after all matched, got ${statusAfter5.totalWaiting}`);
  }

  // Verify all 10 callbacks were fired
  if (allCallbacks.length !== 10) {
    throw new Error(`Expected 10 onMatchFound callbacks, got ${allCallbacks.length}`);
  }

  console.log("✓ 10 jugadores virtuales emparejados correctamente.\n");

  // ── Test 6: Estadísticas de cola ──────────────────────────────────────────
  console.log("6. Probando estadísticas de cola (getQueueStatus)...");

  mm.clear();

  mm.joinQueue({ userId: "stat-u1", region: "us-east" });
  mm.joinQueue({ userId: "stat-u2", region: "eu-west" });
  mm.joinQueue({ userId: "stat-u3", region: "eu-west" });

  const status6 = mm.getQueueStatus();
  console.log(`  Colas: ${JSON.stringify(status6.queues.filter((q) => q.size > 0))}`);
  console.log(`  Total en espera: ${status6.totalWaiting}`);

  if (status6.totalWaiting !== 3) {
    throw new Error(`Expected 3 total waiting, got ${status6.totalWaiting}`);
  }

  const usQueue = status6.queues.find((q) => q.region === "us-east");
  const euQueue6 = status6.queues.find((q) => q.region === "eu-west");
  if (usQueue?.size !== 1 || euQueue6?.size !== 2) {
    throw new Error(`Queue sizes incorrect: us-east=${usQueue?.size}, eu-west=${euQueue6?.size}`);
  }

  console.log("✓ Estadísticas de cola correctas.\n");

  // ── Test 7: Región desconocida normalizada a us-east ──────────────────────
  console.log("7. Probando normalización de regiones desconocidas...");

  mm.clear();

  const unknownRegion = mm.joinQueue({ userId: "unknown-u", region: "mars-central" });
  if (unknownRegion.region !== "us-east") {
    throw new Error(`Expected unknown region to normalize to us-east, got ${unknownRegion.region}`);
  }

  const noRegion = mm.joinQueue({ userId: "no-region-u" });
  if (noRegion.region !== "us-east") {
    throw new Error(`Expected missing region to default to us-east, got ${noRegion.region}`);
  }

  console.log(`  'mars-central' → ${unknownRegion.region}`);
  console.log(`  undefined → ${noRegion.region}`);
  console.log("✓ Normalización de regiones correcta.\n");

  mm.clear();

  console.log("✓ ¡TODAS LAS PRUEBAS DEL SERVIDOR DE MATCHMAKING PASARON EXITOSAMENTE!");
}

main().catch((err) => {
  console.error("✗ PRUEBA FALLIDA:", err);
  process.exit(1);
});

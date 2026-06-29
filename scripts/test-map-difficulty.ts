import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, getRedis } from "../server/cache/redis.js";
import { computeMapDifficultyAndPace } from "../server/analytics/features/map_difficulty.js";
import { MapProfileRepository } from "../server/analytics/models/MapProfile.js";
import { runMapAggregation } from "./run-map-aggregation.js";
import "dotenv/config";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userId: string, mapId: string) {
  const redis = getRedis();
  if (redis && redis.isOpen) {
    await redis.del(`analytics:map_profile:${mapId}`);
  }

  // Delete operational matches and players
  const matches = await prisma.match.findMany({ where: { mapId } });
  const matchIds = matches.map((m) => m.id);
  await prisma.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } });
  await prisma.match.deleteMany({ where: { mapId } });

  // Delete analytical database tables
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { payload: { path: ["mapId"], equals: mapId } },
        { userId },
      ],
    },
  });

  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId } });
  await analyticsPrisma.gameMap.deleteMany({ where: { id: mapId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });

  await prisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function main() {
  console.log("=== STARTING MAP DIFFICULTY & PACE INTEGRATION TESTS ===");

  const testUserId = "test-diff-owner-101";
  const testMapId = "test-diff-map-202";

  try {
    await connectRedis();

    // 1. Limpieza inicial
    console.log("1. Cleaning up residue...");
    await cleanUp(testUserId, testMapId);

    // 2. Crear objetos en la BD operacional
    console.log("2. Creating test user and map...");
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "difficulty.test@example.com",
        username: "diff_tester",
        passwordHash: "dummyhash",
      },
    });

    await prisma.gameMap.create({
      data: {
        id: testMapId,
        slug: "difficulty-test-map",
        name: "Difficulty Test Map",
        isPublished: true,
        ownerId: testUserId,
      },
    });

    // 3. Simular partidas (Match) y estadísticas de jugadores (MatchPlayer)
    console.log("3. Seeding operational matches and players stats...");
    const baseTime = Date.now();

    // Match 1: Finalizado. Jugador completó la partida con alta intensidad (100 segundos)
    const m1 = await prisma.match.create({
      data: {
        id: "match-1",
        roomId: "room-1",
        mapId: testMapId,
        status: "FINISHED",
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 100 * 1000),
      },
    });

    await prisma.matchPlayer.create({
      data: {
        matchId: m1.id,
        playerId: "player-1",
        playerName: "Player One",
        userId: testUserId,
        joinedAt: new Date(baseTime),
        leftAt: new Date(baseTime + 100 * 1000),
        stats: { deaths: 8, interactions: 120 }, // 4.8 deaths/min, 72 actions/min
      },
    });

    // Match 2: Finalizado. Jugador completó la partida (120 segundos)
    const m2 = await prisma.match.create({
      data: {
        id: "match-2",
        roomId: "room-2",
        mapId: testMapId,
        status: "FINISHED",
        startedAt: new Date(baseTime + 200 * 1000),
        endedAt: new Date(baseTime + 320 * 1000),
      },
    });

    await prisma.matchPlayer.create({
      data: {
        matchId: m2.id,
        playerId: "player-2",
        playerName: "Player Two",
        joinedAt: new Date(baseTime + 200 * 1000),
        leftAt: new Date(baseTime + 320 * 1000),
        stats: { deaths: 12, interactions: 150 }, // 6.0 deaths/min, 75 actions/min
      },
    });

    // Match 3: No finalizado (Abandono prematuro a los 15s)
    const m3 = await prisma.match.create({
      data: {
        id: "match-3",
        roomId: "room-3",
        mapId: testMapId,
        status: "WAITING",
        startedAt: new Date(baseTime + 400 * 1000),
      },
    });

    await prisma.matchPlayer.create({
      data: {
        matchId: m3.id,
        playerId: "player-3",
        playerName: "Player Three",
        joinedAt: new Date(baseTime + 400 * 1000),
        leftAt: new Date(baseTime + 415 * 1000), // 15 seconds
        stats: { deaths: 10, interactions: 20 },
      },
    });

    // Match 4: No finalizado (Abandono prematuro a los 25s)
    const m4 = await prisma.match.create({
      data: {
        id: "match-4",
        roomId: "room-4",
        mapId: testMapId,
        status: "WAITING",
        startedAt: new Date(baseTime + 500 * 1000),
      },
    });

    await prisma.matchPlayer.create({
      data: {
        matchId: m4.id,
        playerId: "player-4",
        playerName: "Player Four",
        joinedAt: new Date(baseTime + 500 * 1000),
        leftAt: new Date(baseTime + 525 * 1000), // 25 seconds
        stats: { deaths: 5, interactions: 10 },
      },
    });

    console.log("✓ Operational test data seeded.");

    // 4. Correr cómputo analítico
    console.log("4. Running difficulty and pace computation...");
    const result = await computeMapDifficultyAndPace(testMapId);
    assert(!!result, "Result should not be null.");

    // 5. Verificar matemáticas del cómputo
    console.log("5. Checking mathematical accuracy...");
    // - Dificultad: 4 matches, 2 completados -> D_m = 1.0 - 2/4 = 0.5 (Medium)
    assert(result.difficultyScore === 0.5, `difficultyScore should be 0.5, got ${result.difficultyScore}`);
    assert(result.difficultyLabel === "Medium", `difficultyLabel should be Medium, got ${result.difficultyLabel}`);

    // - Abandono temprano: 4 jugadores, 2 abandonaron en < 60s (Player 3 y Player 4) -> 2/4 = 0.5 (50%)
    assert(result.earlyAbandonRate === 0.5, `earlyAbandonRate should be 0.5, got ${result.earlyAbandonRate}`);

    // - Ritmo:
    // Playtime total: 100s + 120s + 15s + 25s = 260s = 4.3333 min
    // Muertes totales: 8 + 12 + 10 + 5 = 35 muertes
    // Muertes/min: 35 / 4.3333 = 8.077 muertes/min (paceScore = 8.08)
    // Ritmo esperado: "Bullet-Hell"
    assert(result.paceScore > 8.0 && result.paceScore < 8.1, `paceScore should be ~8.08, got ${result.paceScore}`);
    assert(result.paceLabel === "Bullet-Hell", `paceLabel should be Bullet-Hell, got ${result.paceLabel}`);

    console.log("✓ Mathematical calculations match expected values.");

    // 6. Verificar persistencia analítica
    console.log("6. Verifying DB persistence in MapFeatures...");
    const features = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId: testMapId },
    });

    assert(!!features, "MapFeatures was not persisted.");
    assert(features.difficultyScore === 0.5, "DB difficultyScore incorrect.");
    assert(features.difficultyLabel === "Medium", "DB difficultyLabel incorrect.");
    assert(features.paceLabel === "Bullet-Hell", "DB paceLabel incorrect.");
    assert(features.earlyAbandonRate === 0.5, "DB earlyAbandonRate incorrect.");
    console.log("✓ Persistence in MapFeatures verified.");

    // 7. Verificar integración con caché de Redis (MapProfileRepository)
    console.log("7. Verifying Redis cache integration and latency...");
    
    // Limpiar caché primero
    await MapProfileRepository.clearCache(testMapId);

    // Initial fetch (Cache MISS)
    const tStartMiss = Date.now();
    const profileMiss = await MapProfileRepository.getMapProfile(testMapId);
    const durationMiss = Date.now() - tStartMiss;

    assert(!!profileMiss, "Map profile was null.");
    assert(profileMiss.difficultyLabel === "Medium", "Profile difficulty label mismatch.");
    assert(profileMiss.paceLabel === "Bullet-Hell", "Profile pace label mismatch.");
    assert(profileMiss.earlyAbandonRate === 0.5, "Profile earlyAbandonRate mismatch.");
    console.log(`- Cache MISS query took: ${durationMiss}ms`);

    // Second fetch (Cache HIT)
    const tStartHit = Date.now();
    const profileHit = await MapProfileRepository.getMapProfile(testMapId);
    const durationHit = Date.now() - tStartHit;

    assert(!!profileHit, "Map profile was null on cache hit.");
    assert(profileHit.difficultyLabel === "Medium", "Profile difficulty label mismatch on hit.");
    console.log(`- Cache HIT query took: ${durationHit}ms`);
    assert(durationHit < durationMiss, "Cache HIT should be faster than Cache MISS.");
    assert(durationHit < 10, "Cache HIT must take less than 10ms.");
    console.log("✓ Redis caching integration verified.");

    // 8. Verificar resiliencia de desconexión de Redis
    console.log("8. Testing resilience with Redis disconnected...");
    const redis = getRedis();
    if (redis) {
      await redis.disconnect();
    }

    const tStartOffline = Date.now();
    const offlineProfile = await MapProfileRepository.getMapProfile(testMapId);
    const durationOffline = Date.now() - tStartOffline;

    assert(!!offlineProfile, "Profile was null when Redis was offline.");
    assert(offlineProfile.difficultyLabel === "Medium", "Offline profile values incorrect.");
    console.log(`- Offline query (Resilience Fallback) completed in ${durationOffline}ms without throwing error.`);
    console.log("✓ Graceful degradation verified.");

    // Re-conectar Redis
    if (redis) {
      await redis.connect();
    }

    // 9. Verificar ejecución del runner offline
    console.log("9. Testing runMapAggregation batch runner...");
    // Alterar manualmente los valores
    await analyticsPrisma.mapFeatures.update({
      where: { mapId: testMapId },
      data: {
        difficultyLabel: "Easy",
        paceLabel: "Chill",
      },
    });

    await runMapAggregation(30);

    const updatedFeatures = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId: testMapId },
    });
    assert(updatedFeatures?.difficultyLabel === "Medium", "Aggregation runner did not recalculate difficulty.");
    assert(updatedFeatures?.paceLabel === "Bullet-Hell", "Aggregation runner did not recalculate pace.");
    console.log("✓ Batch runner recalculated and synced successfully.");

    // 10. Limpieza de datos
    console.log("10. Cleaning up test data...");
    await cleanUp(testUserId, testMapId);

    console.log("\n=== ALL MAP DIFFICULTY & PACE INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n!!! INTEGRATION TESTS FAILED !!!", err);
    await cleanUp(testUserId, testMapId);
    process.exit(1);
  }
}

void main();

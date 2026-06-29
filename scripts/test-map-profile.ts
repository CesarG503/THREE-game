import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, getRedis } from "../server/cache/redis.js";
import { runMapAggregation } from "./run-map-aggregation.js";
import { MapProfileRepository } from "../server/analytics/models/MapProfile.js";
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

  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { payload: { path: ["mapId"], equals: mapId } },
        { userId },
      ]
    }
  });

  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId } });
  await analyticsPrisma.gameMap.deleteMany({ where: { id: mapId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });

  await prisma.gameMap.deleteMany({ where: { id: mapId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function main() {
  console.log("=== STARTING MAP PROFILE INTEGRATION TESTS ===");

  const testUserId = "test-map-user-777";
  const testMapId = "test-map-id-555";
  const room1 = "room-1";
  const room2 = "room-2";
  const room3 = "room-3";

  try {
    await connectRedis();

    // 1. Limpieza inicial
    console.log("1. Cleaning up residue...");
    await cleanUp(testUserId, testMapId);

    // 2. Crear objetos en la BD operacional (se replican vía triggers de Postgres)
    console.log("2. Creating test user and map...");
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "map.test@example.com",
        username: "map_tester",
        passwordHash: "dummyhash",
      }
    });

    await prisma.gameMap.create({
      data: {
        id: testMapId,
        slug: "qa-test-map",
        name: "QA Test Map",
        isPublished: true,
        ownerId: testUserId,
      }
    });

    // 3. Simular eventos de telemetría de juego
    console.log("3. Ingesting simulated telemetry events...");
    const baseTime = Date.now();

    // Sala 1: Completada (Start -> End, duración = 150s)
    await analyticsPrisma.rawEvent.createMany({
      data: [
        { id: "ev-start-1", eventType: "MatchStart", timestamp: new Date(baseTime), payload: { roomId: room1, mapId: testMapId, gameMode: "FFA" } },
        { id: "ev-end-1", eventType: "MatchEnd", timestamp: new Date(baseTime + 1000), payload: { roomId: room1, mapId: testMapId, durationSeconds: 150 } },
        { id: "ev-leave-1", eventType: "MatchLeave", timestamp: new Date(baseTime + 2000), payload: { roomId: room1, mapId: testMapId, durationSeconds: 150 } }
      ]
    });

    // Sala 2: Completada (Start -> End, duración = 50s)
    await analyticsPrisma.rawEvent.createMany({
      data: [
        { id: "ev-start-2", eventType: "MatchStart", timestamp: new Date(baseTime + 3000), payload: { roomId: room2, mapId: testMapId, gameMode: "FFA" } },
        { id: "ev-end-2", eventType: "MatchEnd", timestamp: new Date(baseTime + 4000), payload: { roomId: room2, mapId: testMapId, durationSeconds: 50 } },
        { id: "ev-leave-2", eventType: "MatchLeave", timestamp: new Date(baseTime + 5000), payload: { roomId: room2, mapId: testMapId, durationSeconds: 50 } }
      ]
    });

    // Sala 3: Iniciada pero nunca finalizada (Incompleta / Rage Quit)
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "ev-start-3",
        eventType: "MatchStart",
        timestamp: new Date(baseTime + 6000),
        payload: { roomId: room3, mapId: testMapId, gameMode: "FFA" }
      }
    });

    // Sesión de rebote extra (duración = 5s, no completada en sala)
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "ev-leave-bounce",
        eventType: "MatchLeave",
        timestamp: new Date(baseTime + 7000),
        payload: { roomId: "room-bounce", mapId: testMapId, durationSeconds: 5 }
      }
    });

    console.log("✓ Ingestion simulation completed.");

    // 4. Correr la agregación offline
    console.log("4. Running map metrics aggregation offline...");
    await runMapAggregation(30);

    // 5. Verificar agregación de métricas de mapa
    console.log("5. Verifying metrics in DB...");
    const features = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId: testMapId }
    });

    assert(!!features, "MapFeatures was not created or updated by aggregation.");
    
    // Comprobar completionRate: 2 salas completadas de 3 iniciadas -> 0.6667
    console.log(`- Completion Rate: ${features.completionRate} (Expected: ~0.6667)`);
    assert(Math.abs((features.completionRate ?? 0) - (2 / 3)) < 0.01, "Completion Rate mathematically incorrect.");

    // Comprobar medianPlaytime: mediana de [150, 50, 5] -> 50
    console.log(`- Median Playtime: ${features.medianPlaytime}s (Expected: 50s)`);
    assert(features.medianPlaytime === 50, "Median Playtime mathematically incorrect.");

    // Comprobar retentionCurve: thresholds [30, 60, 120, 240] para duraciones [150, 50, 5]
    // >= 30s: 150 y 50 (2/3 = 0.6667)
    // >= 60s: 150 (1/3 = 0.3333)
    // >= 120s: 150 (1/3 = 0.3333)
    // >= 240s: ninguno (0/3 = 0.0)
    // Curva esperada: [0.6667, 0.3333, 0.3333, 0.0]
    const curve = features.retentionCurve as number[];
    console.log(`- Retention Curve: ${JSON.stringify(curve)} (Expected: [0.6667, 0.3333, 0.3333, 0])`);
    assert(Array.isArray(curve), "Retention curve is not an array.");
    assert(Math.abs(curve[0] - (2 / 3)) < 0.01, "Curve[0] (30s) incorrect.");
    assert(Math.abs(curve[1] - (1 / 3)) < 0.01, "Curve[1] (60s) incorrect.");
    assert(Math.abs(curve[2] - (1 / 3)) < 0.01, "Curve[2] (120s) incorrect.");
    assert(curve[3] === 0, "Curve[3] (240s) incorrect.");

    console.log("✓ Aggregation mathematical verification passed!");

    // 6. Validar caché de Redis (MapProfileRepository)
    console.log("6. Verifying Redis caching & RTT...");
    
    // Invalidar caché primero
    await MapProfileRepository.clearCache(testMapId);

    // Initial fetch (Cache MISS)
    const tStartMiss = Date.now();
    const profileMiss = await MapProfileRepository.getMapProfile(testMapId);
    const durationMiss = Date.now() - tStartMiss;
    
    assert(!!profileMiss, "Map profile was null.");
    assert(profileMiss.medianPlaytime === 50, "Profile values did not match database.");
    assert(profileMiss.createdAt instanceof Date, "Date was not rehydrated.");
    console.log(`- Cache MISS query took: ${durationMiss}ms`);

    // Second fetch (Cache HIT)
    const tStartHit = Date.now();
    const profileHit = await MapProfileRepository.getMapProfile(testMapId);
    const durationHit = Date.now() - tStartHit;

    assert(!!profileHit, "Map profile was null on cache hit.");
    assert(profileHit.medianPlaytime === 50, "Profile values did not match database on hit.");
    console.log(`- Cache HIT query took: ${durationHit}ms`);
    assert(durationHit < durationMiss, "Cache HIT should be faster than Cache MISS.");
    assert(durationHit < 10, "Cache HIT must take less than 10ms.");

    // Alter database manually and verify cache is still returned
    await analyticsPrisma.mapFeatures.update({
      where: { mapId: testMapId },
      data: { medianPlaytime: 999 }
    });

    const cachedProfile = await MapProfileRepository.getMapProfile(testMapId);
    assert(cachedProfile?.medianPlaytime === 50, "Repository did not return cached value after DB alteration.");
    console.log("✓ Confirmed: Cached value returned, isolated from database changes.");

    // Clear cache manually and verify cache MISS returns the new value
    await MapProfileRepository.clearCache(testMapId);
    const refreshedProfile = await MapProfileRepository.getMapProfile(testMapId);
    assert(refreshedProfile?.medianPlaytime === 999, "Failed to clear cache or get updated DB values.");
    console.log("✓ Confirmed: Manual cache clearance works successfully.");

    // 7. Validar resiliencia ante caídas de Redis
    console.log("7. Testing resilience with Redis disconnected...");
    const redis = getRedis();
    if (redis) {
      await redis.disconnect(); // Desconectar cliente de Redis
    }

    const tStartOffline = Date.now();
    const offlineProfile = await MapProfileRepository.getMapProfile(testMapId);
    const durationOffline = Date.now() - tStartOffline;

    assert(!!offlineProfile, "Profile was null when Redis was offline.");
    assert(offlineProfile.medianPlaytime === 999, "Profile values did not match database when Redis was offline.");
    console.log(`- Offline query (Resilience Fallback) completed in ${durationOffline}ms without throwing error.`);
    console.log("✓ Confirmed: Repository correctly degraded gracefully to database when Redis was offline.");

    // 8. Re-conectar Redis para limpiar los datos
    if (redis) {
      await redis.connect();
    }
    console.log("8. Cleaning up test data...");
    await cleanUp(testUserId, testMapId);

    console.log("\n=== ALL MAP PROFILE INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n!!! INTEGRATION TESTS FAILED !!!", err);
    process.exit(1);
  }
}

void main();

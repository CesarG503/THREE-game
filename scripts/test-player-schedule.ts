import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, getRedis } from "../server/cache/redis.js";
import { computeScheduleProfileForUser, getExpectedConcurrency } from "../server/analytics/features/schedule_profile.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import { runScheduleAggregation } from "./run-schedule-aggregation.js";
import "dotenv/config";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userId: string) {
  const redis = getRedis();
  if (redis && redis.isOpen) {
    await redis.del(`analytics:profile:${userId}`);
  }

  await analyticsPrisma.rawEvent.deleteMany({ where: { userId } });
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function main() {
  console.log("=== STARTING PLAYER SCHEDULE INTEGRATION TESTS ===");

  const testUserId = "test-schedule-user-999";

  try {
    await connectRedis();

    // 1. Limpieza inicial
    console.log("1. Cleaning up residue...");
    await cleanUp(testUserId);

    // 2. Crear objetos en la BD operacional (se replican vía triggers de Postgres)
    console.log("2. Creating test user...");
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "schedule.test@example.com",
        username: "sched_tester",
        passwordHash: "dummyhash",
      },
    });

    // 3. Simular eventos de telemetría de SessionStart
    console.log("3. Ingesting simulated SessionStart events...");

    // Definir timestamps fijos en UTC:
    // Martes (getUTCDay = 2) a las 18:00 (getUTCHours = 18)
    const tuesday18Utc1 = new Date(Date.UTC(2026, 5, 2, 18, 0, 0)); // 2 de Junio 2026 (Martes)
    const tuesday18Utc2 = new Date(Date.UTC(2026, 5, 9, 18, 0, 0)); // 9 de Junio 2026 (Martes)
    const tuesday18Utc3 = new Date(Date.UTC(2026, 5, 16, 18, 0, 0)); // 16 de Junio 2026 (Martes)
    
    // Jueves (getUTCDay = 4) a las 12:00 (getUTCHours = 12)
    const thursday12Utc1 = new Date(Date.UTC(2026, 5, 4, 12, 0, 0)); // 4 de Junio 2026 (Jueves)

    await analyticsPrisma.rawEvent.createMany({
      data: [
        { id: "ev-start-u1", eventType: "SessionStart", userId: testUserId, timestamp: tuesday18Utc1, payload: { userAgent: "Mozilla", timezoneOffset: -360 } },
        { id: "ev-start-u2", eventType: "SessionStart", userId: testUserId, timestamp: tuesday18Utc2, payload: { userAgent: "Mozilla" } },
        { id: "ev-start-u3", eventType: "SessionStart", userId: testUserId, timestamp: tuesday18Utc3, payload: { userAgent: "Mozilla" } },
        { id: "ev-start-u4", eventType: "SessionStart", userId: testUserId, timestamp: thursday12Utc1, payload: { userAgent: "Mozilla" } },
      ],
    });

    console.log("✓ Ingestion simulation completed.");

    // 4. Correr cómputo del perfil
    console.log("4. Computing user schedule profile...");
    const profile = await computeScheduleProfileForUser(testUserId);
    assert(!!profile, "Profile was null.");

    // 5. Verificar matemáticas e histogramas
    console.log("5. Verifying histogram calculations...");
    assert(profile.primaryHour === 18, `Peak Hour should be 18, got: ${profile.primaryHour}`);
    assert(profile.primaryDay === 2, `Peak Day should be 2 (Tuesday), got: ${profile.primaryDay}`);
    assert(profile.hourlyHistogram[18] === 3, "Hour 18 count should be 3.");
    assert(profile.hourlyHistogram[12] === 1, "Hour 12 count should be 1.");
    assert(profile.weeklyHistogram[2] === 3, "Day 2 (Tuesday) count should be 3.");
    assert(profile.weeklyHistogram[4] === 1, "Day 4 (Thursday) count should be 1.");
    
    // Validar timezone offset (debe ser el del primer evento/último evento que lo tenga, que es -360)
    assert(profile.timezoneOffset === -360, `Timezone offset should be -360, got: ${profile.timezoneOffset}`);
    console.log("✓ Histogram calculations and metadata match perfectly!");

    // 6. Verificar persistencia en base de datos analítica
    console.log("6. Verifying features persistence in analytics DB...");
    const features = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId: testUserId },
    });

    assert(!!features, "PlayerFeatures record not found.");
    const sp = features.scheduleProfile as any;
    assert(sp.primaryHour === 18, "Persisted primaryHour incorrect.");
    assert(sp.primaryDay === 2, "Persisted primaryDay incorrect.");
    console.log("✓ Verified persistence in DB.");

    // 7. Verificar el cálculo probabilístico de la concurrencia esperada
    console.log("7. Verifying expected concurrency predictions...");
    // Para nuestro usuario:
    // P(Hour=18, Day=2) = (3 * 3) / 4 = 2.25
    // P(Hour=12, Day=4) = (1 * 1) / 4 = 0.25
    // P(Hour=18, Day=4) = (3 * 1) / 4 = 0.75
    const cPeak = await getExpectedConcurrency(18, 2);
    const cLow = await getExpectedConcurrency(12, 4);
    const cMixed = await getExpectedConcurrency(18, 4);

    console.log(`- Expected Concurrency at Peak (Hour 18, Day 2): ${cPeak} (Expected: 2.25)`);
    assert(cPeak === 2.25, `Expected 2.25, got ${cPeak}`);

    console.log(`- Expected Concurrency at Low (Hour 12, Day 4): ${cLow} (Expected: 0.25)`);
    assert(cLow === 0.25, `Expected 0.25, got ${cLow}`);

    console.log(`- Expected Concurrency at Mixed (Hour 18, Day 4): ${cMixed} (Expected: 0.75)`);
    assert(cMixed === 0.75, `Expected 0.75, got ${cMixed}`);
    console.log("✓ Expected concurrency mathematical formulas verified successfully.");

    // 8. Verificar la integración con caché de Redis (PlayerProfileRepository)
    console.log("8. Verifying Redis caching & performance RTT...");
    
    // Invalidar caché primero
    await PlayerProfileRepository.clearCache(testUserId);

    // Initial fetch (Cache MISS)
    const tStartMiss = Date.now();
    const profileMiss = await PlayerProfileRepository.getProfile(testUserId);
    const durationMiss = Date.now() - tStartMiss;

    assert(!!profileMiss, "Player profile retrieved is null.");
    assert(profileMiss.scheduleProfile.primaryHour === 18, "Cache miss scheduleProfile primaryHour mismatch.");
    console.log(`- Cache MISS query took: ${durationMiss}ms`);

    // Second fetch (Cache HIT)
    const tStartHit = Date.now();
    const profileHit = await PlayerProfileRepository.getProfile(testUserId);
    const durationHit = Date.now() - tStartHit;

    assert(!!profileHit, "Player profile retrieved is null on cache hit.");
    assert(profileHit.scheduleProfile.primaryHour === 18, "Cache hit scheduleProfile primaryHour mismatch.");
    console.log(`- Cache HIT query took: ${durationHit}ms`);
    assert(durationHit < durationMiss, "Cache HIT should be faster than Cache MISS.");
    assert(durationHit < 15, "Cache HIT must take less than 15ms.");
    console.log("✓ Cache HIT performance verified.");

    // 9. Validar resiliencia ante caídas de Redis
    console.log("9. Testing resilience with Redis disconnected...");
    const redis = getRedis();
    if (redis) {
      await redis.disconnect();
    }

    const tStartOffline = Date.now();
    const offlineProfile = await PlayerProfileRepository.getProfile(testUserId);
    const durationOffline = Date.now() - tStartOffline;

    assert(!!offlineProfile, "Profile was null when Redis was offline.");
    assert(offlineProfile.scheduleProfile.primaryHour === 18, "Offline profile scheduleProfile primaryHour mismatch.");
    console.log(`- Offline query (Resilience Fallback) completed in ${durationOffline}ms without throwing error.`);
    console.log("✓ Graceful degradation confirmed.");

    // Re-conectar Redis
    if (redis) {
      await redis.connect();
    }

    // 10. Validar ejecución del script offline en batch
    console.log("10. Testing runScheduleAggregation batch runner...");
    // Insertamos otro evento de SessionStart
    const tuesday18Utc4 = new Date(Date.UTC(2026, 5, 23, 18, 0, 0));
    await analyticsPrisma.rawEvent.create({
      data: {
        id: "ev-start-u5",
        eventType: "SessionStart",
        userId: testUserId,
        timestamp: tuesday18Utc4,
        payload: { userAgent: "Mozilla" },
      },
    });

    // Ejecutar lote
    await runScheduleAggregation();

    // El histograma debería haberse recalculado (5 sesiones en total, 4 el martes a las 18:00)
    const updatedFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId: testUserId },
    });
    const updatedSp = updatedFeatures?.scheduleProfile as any;
    assert(updatedSp.hourlyHistogram[18] === 4, `Expected Hour 18 count to be 4, got: ${updatedSp.hourlyHistogram[18]}`);
    console.log("✓ Batch runner recalculated and updated successfully.");

    // 11. Limpieza de datos
    console.log("11. Cleaning up test data...");
    await cleanUp(testUserId);

    console.log("\n=== ALL PLAYER SCHEDULE INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("\n!!! INTEGRATION TESTS FAILED !!!", err);
    await cleanUp(testUserId);
    process.exit(1);
  }
}

void main();

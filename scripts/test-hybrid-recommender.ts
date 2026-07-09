import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import { getHybridRecommendations, withTimeout } from "../server/services/HybridRecommender.js";
import { getPopularityRecommendations } from "../server/services/RecommendationService.js";
import { getContentRecommendations } from "../server/services/ContentRecommender.js";
import { getCollaborativeRecommendations } from "../server/services/CollaborativeRecommender.js";
import { getSocialRecommendations } from "../server/services/SocialRecommender.js";
import assert from "assert";

async function performDatabaseCleanup() {
  console.log("Realizando purga y limpieza completa de datos de prueba hybrid...");
  try {
    // 1. Eliminar perfiles analíticos de prueba
    await analyticsPrisma.playerFeatures.deleteMany({
      where: {
        userId: { startsWith: "test-hybrid-" },
      },
    });

    // 2. Eliminar mapas de prueba
    await prisma.gameMap.deleteMany({
      where: {
        id: { startsWith: "test-hybrid-" },
      },
    });

    // 3. Eliminar usuarios de prueba
    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-hybrid-" },
      },
    });

    console.log("✓ Limpieza completada con éxito.");
  } catch (err) {
    console.error("Error durante la limpieza de base de datos:", err);
  }
}

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 45: RECOMENDADOR HÍBRIDO PONDERADO ===");

  const newUserId = "test-hybrid-new";
  const midUserId = "test-hybrid-mid";
  const vetUserId = "test-hybrid-vet";
  const clusterId = "test-hybrid-cluster-1";

  const mapId1 = "test-hybrid-map-1";
  const mapId2 = "test-hybrid-map-2";
  const mapId3 = "test-hybrid-map-3";

  // Limpieza inicial
  await performDatabaseCleanup();

  try {
    // 1. Crear usuarios con diferente madurez (partidas jugadas)
    console.log("\n1. Creando usuarios de prueba con diferentes perfiles de madurez...");
    const usersData = [
      { id: newUserId, username: "user_new", matchesPlayed: 1 },
      { id: midUserId, username: "user_mid", matchesPlayed: 8 },
      { id: vetUserId, username: "user_vet", matchesPlayed: 25 },
    ];

    for (const u of usersData) {
      await prisma.user.create({
        data: {
          id: u.id,
          email: `${u.id}@test.local`,
          username: u.username,
          passwordHash: "hash",
          clusterId,
        },
      });

      await analyticsPrisma.playerFeatures.create({
        data: {
          userId: u.id,
          lastActive: new Date(),
          matchesPlayed: u.matchesPlayed,
          clusterId,
        },
      });

      await PlayerProfileRepository.clearCache(u.id);
    }

    // 2. Crear mapas candidatos en DB
    console.log("Creando mapas de prueba...");
    const testMaps = [
      { id: mapId1, name: "Hybrid Map 1 Sandbox", description: "sandbox map" },
      { id: mapId2, name: "Hybrid Map 2 Shooter", description: "shooter map" },
      { id: mapId3, name: "Hybrid Map 3 Puzzle", description: "puzzle map" },
    ];

    for (const m of testMaps) {
      await prisma.gameMap.create({
        data: {
          id: m.id,
          slug: "slug-" + m.id,
          name: m.name,
          description: m.description,
          ownerId: newUserId,
          isPublished: true,
        },
      });

      // Crear caracteristicas vacias de mapa para evitar fallos analiticos
      await analyticsPrisma.mapFeatures.create({
        data: {
          mapId: m.id,
          difficultyScore: 0.5,
          totalJoins: 10,
        },
      });
    }

    // Calentamiento de conexiones y módulos para evitar ruidos de Cold Start
    console.log("Calentando base de datos y motores...");
    await prisma.gameMap.findMany({ take: 1 });
    await analyticsPrisma.playerFeatures.findMany({ take: 1 });
    // Calentamos los sub-recomendadores llamándolos directamente una vez sin timeouts para todos los usuarios
    await getPopularityRecommendations({ limit: 10 }).catch(() => {});
    for (const uid of [newUserId, midUserId, vetUserId]) {
      await PlayerProfileRepository.getProfile(uid).catch(() => {});
      await getContentRecommendations(uid, { limit: 10 }).catch(() => {});
      await getCollaborativeRecommendations(uid, { limit: 10 }).catch(() => {});
      await getSocialRecommendations(uid, { limit: 10 }).catch(() => {});
      await getHybridRecommendations(uid, { limit: 5 }).catch(() => {});
    }

    // --- TEST 1: Validación de Resolución de Recomendaciones ---
    console.log("\n2. Validando recomendaciones de usuario nuevo...");
    const newRecs = await getHybridRecommendations(newUserId, { limit: 5 });
    console.log(`Recomendaciones obtenidas para usuario nuevo: ${newRecs.length}`);
    assert.ok(newRecs.length > 0, "Debe retornar mapas candidatos");

    console.log("\n3. Validando recomendaciones de usuario veterano...");
    const vetRecs = await getHybridRecommendations(vetUserId, { limit: 5 });
    console.log(`Recomendaciones obtenidas para usuario veterano: ${vetRecs.length}`);
    assert.ok(vetRecs.length > 0, "Debe retornar mapas candidatos");

    console.log("\n4. Validando recomendaciones de usuario anónimo...");
    const anonRecs = await getHybridRecommendations(null, { limit: 5 });
    console.log(`Recomendaciones obtenidas para anónimo: ${anonRecs.length}`);
    assert.ok(anonRecs.length > 0, "Debe retornar mapas candidatos");

    // --- TEST 2: Tolerancia a fallos y timeouts ---
    console.log("\n5. Probando resiliencia del helper withTimeout...");
    const startTimeoutTest = Date.now();
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("success"), 400);
    });

    const timeoutRes = await withTimeout(slowPromise, 150, "fallback-value");
    const durationTimeout = Date.now() - startTimeoutTest;

    console.log(`Resultado de conTimeout: "${timeoutRes}" en ${durationTimeout}ms (esperado fallback en ~150ms)`);
    assert.strictEqual(timeoutRes, "fallback-value", "Debe retornar el fallback");
    assert.ok(durationTimeout >= 140 && durationTimeout < 250, "Debe finalizar en el rango del timeout");

    // --- TEST 3: Prueba de carga concurrente y latencia P95 ---
    console.log("\n6. Ejecutando prueba de carga concurrente (500 solicitudes concurrentes)...");
    const requestCount = 500;
    const latencies: number[] = [];

    const startTime = Date.now();

    // Lanzamos las peticiones distribuidas uniformemente (1 peticion cada 2ms) para simular 500 req/seg
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const promises = Array.from({ length: requestCount }).map(async (_, idx) => {
      await delay(idx * 2);
      const reqStart = Date.now();
      await getHybridRecommendations(midUserId, { limit: 10 });
      latencies.push(Date.now() - reqStart);
    });

    await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    // Calcular métricas
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p90 = latencies[Math.floor(latencies.length * 0.90)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log("\n=== RESULTADOS DE PRUEBA DE CARGA Y LATENCIA ===");
    console.log(`Total peticiones: ${requestCount}`);
    console.log(`Duración total:  ${totalDuration}ms`);
    console.log(`Media:           ${avg.toFixed(2)}ms`);
    console.log(`P50 (Mediana):   ${p50}ms`);
    console.log(`P90:             ${p90}ms`);
    console.log(`P95:             ${p95}ms (SLA Objetivo < 40ms)`);
    console.log(`P99:             ${p99}ms`);
    console.log("================================================");

    assert.ok(p95 < 40, `La latencia P95 (${p95}ms) debe ser menor a 40ms`);
    console.log("✓ SLA de latencia P95 validado exitosamente.");

  } finally {
    // Limpieza final
    await performDatabaseCleanup();
  }

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL RECOMENDADOR HÍBRIDO PASARON EXITOSAMENTE!");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Prueba fallida con error:", err);
    process.exit(1);
  });

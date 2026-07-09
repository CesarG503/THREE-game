import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import {
  sampleBeta,
  getBanditRecommendations,
  getClusterCtrStats,
  clearCtrCache,
} from "../server/services/ExplorationBandit.js";
import assert from "assert";

async function performDatabaseCleanup() {
  console.log("Realizando purga y limpieza completa de datos de prueba bandit...");
  try {
    // 1. Limpiar cache de CTR
    clearCtrCache();

    // 2. Eliminar eventos RawEvent de prueba
    // Nota: Como RawEvent tiene clave primaria compuesta [id, timestamp], se elimina por prefijo de userId si es posible,
    // o borrando directamente los eventos sospechosos de test.
    await analyticsPrisma.rawEvent.deleteMany({
      where: {
        userId: { startsWith: "test-bandit-" },
      },
    });

    // 3. Eliminar fatiga de prueba
    await analyticsPrisma.fatiguedMap.deleteMany({
      where: {
        userId: { startsWith: "test-bandit-" },
      },
    });

    // 4. Eliminar perfiles analíticos de prueba
    await analyticsPrisma.playerFeatures.deleteMany({
      where: {
        userId: { startsWith: "test-bandit-" },
      },
    });

    // 5. Eliminar mapas de prueba
    await prisma.gameMap.deleteMany({
      where: {
        id: { startsWith: "test-bandit-map-" },
      },
    });

    // 6. Eliminar usuarios de prueba
    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-bandit-" },
      },
    });

    console.log("✓ Limpieza completada con éxito.");
  } catch (err) {
    console.error("Error durante la limpieza de base de datos:", err);
  }
}

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 44: BANDIDO MULTIBRAZO (EXPLORACION/EXPLOTACION) ===");

  const repeaterUserId = "test-bandit-repeater";
  const explorerUserId = "test-bandit-explorer";
  const clusterId = "test-bandit-cluster-1";

  const mapId1 = "test-bandit-map-1";
  const mapId2 = "test-bandit-map-2";
  const mapId3 = "test-bandit-map-3";

  // Limpieza inicial
  await performDatabaseCleanup();

  try {
    // --- TEST 1: Convergencia matemática de la distribución Beta ---
    console.log("\n1. Validando convergencia matemática de sampleBeta...");
    const samples: number[] = [];
    const alpha = 10;
    const beta = 10;
    // Beta(10, 10) tiene media teórica de 10 / (10 + 10) = 0.5
    for (let i = 0; i < 1000; i++) {
      samples.push(sampleBeta(alpha, beta));
    }
    const sum = samples.reduce((acc, val) => acc + val, 0);
    const mean = sum / samples.length;
    console.log(`Media de 1000 muestras Beta(10,10): ${mean.toFixed(4)} (esperado ~0.50)`);
    assert.ok(Math.abs(mean - 0.50) < 0.05, "La media de las muestras debe estar cerca de 0.50");

    // --- TEST 2: Configuración de usuarios y Epsilon dinámico ---
    console.log("\n2. Creando usuarios con perfiles de exploración opuestos...");
    
    // Crear en DB operativa
    await prisma.user.create({
      data: {
        id: repeaterUserId,
        email: `${repeaterUserId}@test.local`,
        username: "user_repeater",
        passwordHash: "hash",
        clusterId: clusterId,
      },
    });
    await prisma.user.create({
      data: {
        id: explorerUserId,
        email: `${explorerUserId}@test.local`,
        username: "user_explorer",
        passwordHash: "hash",
        clusterId: clusterId,
      },
    });

    // Crear en base analítica (PlayerFeatures)
    // Repeater: explorerRatio = 0.0 => Epsilon debe ser 0.05
    await analyticsPrisma.playerFeatures.create({
      data: {
        userId: repeaterUserId,
        lastActive: new Date(),
        explorerRatio: 0.0,
        clusterId: clusterId,
      },
    });
    // Explorer: explorerRatio = 1.0 => Epsilon debe ser 0.20
    await analyticsPrisma.playerFeatures.create({
      data: {
        userId: explorerUserId,
        lastActive: new Date(),
        explorerRatio: 1.0,
        clusterId: clusterId,
      },
    });

    // Invalidad caches por seguridad
    await PlayerProfileRepository.clearCache(repeaterUserId);
    await PlayerProfileRepository.clearCache(explorerUserId);

    // Crear mapas de prueba en DB operativa
    console.log("Creando mapas de prueba...");
    const testMapIds = [mapId1, mapId2, mapId3];
    for (const mid of testMapIds) {
      await prisma.gameMap.create({
        data: {
          id: mid,
          slug: "slug-" + mid,
          name: "Bandit Map " + mid,
          description: "Test map for multi-armed bandit",
          ownerId: repeaterUserId,
          isPublished: true,
        },
      });
    }

    // Probar obtención de recomendaciones Epsilon-Greedy
    console.log("Validando límites de Epsilon...");
    // Para el repeater
    const recsRepeater = await getBanditRecommendations(repeaterUserId, { limit: 10, mode: "epsilon-greedy" });
    assert.ok(recsRepeater.length > 0);
    const epsRepeater = recsRepeater[0]?.epsilonUsed;
    console.log(`Epsilon para Repeater: ${epsRepeater}`);
    assert.strictEqual(epsRepeater, 0.05, "Epsilon para Repeater debe ser exactamente 0.05");

    // Para el explorer
    const recsExplorer = await getBanditRecommendations(explorerUserId, { limit: 10, mode: "epsilon-greedy" });
    assert.ok(recsExplorer.length > 0);
    const epsExplorer = recsExplorer[0]?.epsilonUsed;
    console.log(`Epsilon para Explorer: ${epsExplorer}`);
    assert.strictEqual(epsExplorer, 0.20, "Epsilon para Explorer debe ser exactamente 0.20");

    // --- TEST 3: Filtrado por Fatiga Activa (Fase 14) ---
    console.log("\n3. Probando exclusión por fatiga activa...");
    // Flaggear mapId2 como fatigado para el Explorer
    const fatigueExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await analyticsPrisma.fatiguedMap.create({
      data: {
        userId: explorerUserId,
        mapId: mapId2,
        expiresAt: fatigueExpiresAt,
      },
    });

    // En Thompson Sampling, mapId2 no debe figurar en las recomendaciones
    const thompsonRecs = await getBanditRecommendations(explorerUserId, { limit: 10, mode: "thompson" });
    const recommendedIds = thompsonRecs.map((r) => r.id);
    console.log("Recomendaciones de Thompson:", recommendedIds);
    assert.ok(!recommendedIds.includes(mapId2), "El mapa fatigado (map-2) debe ser filtrado");
    assert.ok(recommendedIds.includes(mapId1), "El mapa-1 debe estar presente");
    assert.ok(recommendedIds.includes(mapId3), "El mapa-3 debe estar presente");

    // --- TEST 4: Thompson Sampling con CTR simulado de Clúster ---
    console.log("\n4. Probando Thompson Sampling por afinidad de clúster...");
    // Simular que en el clusterId del usuario:
    // mapId1 tiene 90 clics y 100 impresiones (CTR = 90%)
    // mapId3 tiene 10 clics y 100 impresiones (CTR = 10%)
    // mapId2 (fatigado) tiene 50 clics y 100 impresiones (pero está filtrado)
    
    // Generar eventos
    console.log("Simulando eventos de CTR en la base analítica...");
    // mapId1 clics (90)
    for (let i = 0; i < 90; i++) {
      await analyticsPrisma.rawEvent.create({
        data: {
          eventType: "UiClick",
          userId: repeaterUserId,
          payload: { mapId: mapId1 },
        },
      });
    }
    // mapId1 impresiones (10) adicionales
    for (let i = 0; i < 10; i++) {
      await analyticsPrisma.rawEvent.create({
        data: {
          eventType: "UiImpression",
          userId: repeaterUserId,
          payload: { mapId: mapId1 },
        },
      });
    }

    // mapId3 clics (10)
    for (let i = 0; i < 10; i++) {
      await analyticsPrisma.rawEvent.create({
        data: {
          eventType: "UiClick",
          userId: repeaterUserId,
          payload: { mapId: mapId3 },
        },
      });
    }
    // mapId3 impresiones (90) adicionales
    for (let i = 0; i < 90; i++) {
      await analyticsPrisma.rawEvent.create({
        data: {
          eventType: "UiImpression",
          userId: repeaterUserId,
          payload: { mapId: mapId3 },
        },
      });
    }

    // Vaciar caché de CTR de tests
    clearCtrCache();

    // Obtener estadísticas de CTR calculadas para verificar
    const stats = await getClusterCtrStats(clusterId);
    console.log("Estadísticas de CTR recuperadas para el clúster:");
    console.log(`- Map 1: Clics: ${stats.get(mapId1)?.clicks}, Impresiones: ${stats.get(mapId1)?.impressions}`);
    console.log(`- Map 3: Clics: ${stats.get(mapId3)?.clicks}, Impresiones: ${stats.get(mapId3)?.impressions}`);

    assert.strictEqual(stats.get(mapId1)?.clicks, 90);
    assert.strictEqual(stats.get(mapId1)?.impressions, 10); // 10 impressions
    // En getClusterCtrStats: si type === UiClick => clics++, si type === UiImpression => impressions++
    // Entonces para Map 1: clicks = 90, impressions = 10. Total impressions teóricas = 100.
    // Esto es correcto y consistente con nuestra implementación de getClusterCtrStats!

    // Consultar Thompson recommendations
    // mapId1 tiene alpha = 1 + 90 = 91, beta = 1 + 10 = 11 => media Beta = 91/102 ~ 89.2%
    // mapId3 tiene alpha = 1 + 10 = 11, beta = 1 + 90 = 91 => media Beta = 11/102 ~ 10.7%
    // Por lo tanto, Thompson Sampling debe ordenar consistentemente mapId1 antes que mapId3 con una probabilidad altísima.
    
    // Corremos 50 ejecuciones y validamos si mapId1 lidera sobre mapId3 en todas o casi todas.
    let map1WinsCount = 0;
    for (let runIdx = 0; runIdx < 50; runIdx++) {
      const recs = await getBanditRecommendations(repeaterUserId, { limit: 10, mode: "thompson" });
      const activeIds = recs.map((r) => r.id).filter((id) => testMapIds.includes(id));
      if (activeIds.indexOf(mapId1) < activeIds.indexOf(mapId3)) {
        map1WinsCount++;
      }
    }
    console.log(`Muestreo Thompson: Map 1 superó a Map 3 en ${map1WinsCount} de 50 ejecuciones`);
    assert.ok(map1WinsCount > 45, "Map 1 debe tener un puntaje de Thompson consistentemente superior por su alto CTR");

  } finally {
    await performDatabaseCleanup();
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL BANDIDO MULTIBRAZO PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

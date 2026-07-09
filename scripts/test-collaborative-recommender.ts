import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { getCollaborativeRecommendations } from "../server/services/CollaborativeRecommender.js";
import { runCollaborativePipeline } from "../server/analytics/ml/collaborative_filter.js";
import assert from "assert";

async function performDatabaseCleanup() {
  console.log("Realizando purga y limpieza completa de datos de prueba...");
  try {
    // Eliminar relaciones de jugadores de partidas de prueba
    await prisma.matchPlayer.deleteMany({
      where: {
        OR: [
          { userId: { startsWith: "test-col-" } },
          { id: { startsWith: "mp-col-" } }
        ]
      }
    });

    // Eliminar partidas de prueba
    await prisma.match.deleteMany({
      where: {
        OR: [
          { id: { startsWith: "match-col-" } },
          { mapId: { startsWith: "test-map-col-" } }
        ]
      }
    });

    // Eliminar mapas de prueba
    await prisma.gameMap.deleteMany({
      where: {
        id: { startsWith: "test-map-col-" }
      }
    });

    // Eliminar usuarios de prueba
    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-col-" }
      }
    });

    // Eliminar perfiles analíticos de prueba
    await analyticsPrisma.playerFeatures.deleteMany({
      where: {
        userId: { startsWith: "test-col-" }
      }
    });

    await analyticsPrisma.mapFeatures.deleteMany({
      where: {
        mapId: { startsWith: "test-map-col-" }
      }
    });

    console.log("✓ Limpieza completada con éxito.");
  } catch (err) {
    console.error("Error durante la limpieza de base de datos:", err);
  }
}

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 42: RECOMENDADOR MATRIX FACTORIZATION SVD ===");

  const targetUserId = "test-col-target-" + Date.now();
  const userAId = "test-col-user-a-" + Date.now();
  const userBId = "test-col-user-b-" + Date.now();
  const userCId = "test-col-user-c-" + Date.now();
  const userDId = "test-col-user-d-" + Date.now();

  const mapId1 = "test-map-col-1-" + Date.now();
  const mapId2 = "test-map-col-2-" + Date.now();
  const mapId3 = "test-map-col-3-" + Date.now();
  const mapId4 = "test-map-col-4-" + Date.now();
  const mapId5 = "test-map-col-5-" + Date.now();

  const testUserIds = [targetUserId, userAId, userBId, userCId, userDId];
  const testMapIds = [mapId1, mapId2, mapId3, mapId4, mapId5];

  // Auxiliar para registrar un match completado
  let matchCounter = 0;
  async function completeMapForUser(uId: string, mId: string) {
    matchCounter++;
    const mIdStr = `match-col-${matchCounter}-${Date.now()}`;
    await prisma.match.create({
      data: {
        id: mIdStr,
        roomId: `room-col-${matchCounter}-${Date.now()}`,
        mapId: mId,
        status: "FINISHED",
        endedAt: new Date(),
      }
    });
    await prisma.matchPlayer.create({
      data: {
        id: `mp-col-${matchCounter}-${Date.now()}`,
        matchId: mIdStr,
        userId: uId,
        playerId: `p-${matchCounter}-${Date.now()}`,
        playerName: `Player-${uId}`,
        joinedAt: new Date(),
        leftAt: null, // se queda hasta el final => completado
      }
    });
  }

  // Purga inicial
  await performDatabaseCleanup();

  try {
    // 1. Crear usuarios en la DB operativa
    console.log("Creando usuarios...");
    for (const uid of testUserIds) {
      await prisma.user.create({
        data: {
          id: uid,
          email: `${uid}@test.local`,
          username: `user_${uid}`,
          passwordHash: "pass_hash",
          createdAt: new Date(),
        }
      });
    }

    // 2. Crear los 5 mapas
    console.log("Creando mapas...");
    for (const mid of testMapIds) {
      await prisma.gameMap.create({
        data: {
          id: mid,
          slug: "slug-" + mid,
          name: "Collaborative Map " + mid,
          description: "Test map for collaborative filtering",
          ownerId: targetUserId,
          isPublished: true,
        }
      });
    }

    // 3. Simular interacciones de partidas completadas con conteos variables
    console.log("Generando interacciones para entrenamiento...");
    // Target User completó map-1 (5 veces) y map-2 (1 vez)
    for (let i = 0; i < 5; i++) await completeMapForUser(targetUserId, mapId1);
    await completeMapForUser(targetUserId, mapId2);

    // User A completó map-1 (5 veces), map-2 (1 vez), map-3 (5 veces), map-4 (1 vez)
    for (let i = 0; i < 5; i++) await completeMapForUser(userAId, mapId1);
    await completeMapForUser(userAId, mapId2);
    for (let i = 0; i < 5; i++) await completeMapForUser(userAId, mapId3);
    await completeMapForUser(userAId, mapId4);

    // User B completó map-1 (5 veces), map-2 (1 vez), map-4 (5 veces)
    for (let i = 0; i < 5; i++) await completeMapForUser(userBId, mapId1);
    await completeMapForUser(userBId, mapId2);
    for (let i = 0; i < 5; i++) await completeMapForUser(userBId, mapId4);

    // User C completó map-1 (5 veces), map-2 (1 vez), map-3 (4 veces)
    for (let i = 0; i < 5; i++) await completeMapForUser(userCId, mapId1);
    await completeMapForUser(userCId, mapId2);
    for (let i = 0; i < 4; i++) await completeMapForUser(userCId, mapId3);

    // User D completó map-5 (1 vez)
    await completeMapForUser(userDId, mapId5);

    // --- PRUEBA 1: PIPELINE OFFLINE DE MATRIX FACTORIZATION ---
    console.log("\n1. Ejecutando pipeline SVD offline...");
    const pipelineResult = await runCollaborativePipeline({
      factors: 4,
      epochs: 150,
      lr: 0.05,
      reg: 0.01,
    });

    console.log("Resultado del pipeline:", pipelineResult);
    assert.ok(pipelineResult.numUsers >= 5, "Debe entrenar al menos a los 5 usuarios de prueba");
    assert.ok(pipelineResult.numMaps >= 5, "Debe entrenar al menos a los 5 mapas de prueba");
    assert.ok(pipelineResult.rmse < 0.8, "El RMSE de entrenamiento debe ser bajo");

    // Verificar persistencia en base de datos analítica
    const targetFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId: targetUserId },
    });
    assert.ok(targetFeatures);
    assert.ok(Array.isArray(targetFeatures.collaborativeEmbedding));
    assert.strictEqual(targetFeatures.collaborativeEmbedding.length, 4);

    const mapFeatures = await analyticsPrisma.mapFeatures.findUnique({
      where: { mapId: mapId3 },
    });
    assert.ok(mapFeatures);
    assert.ok(Array.isArray(mapFeatures.collaborativeEmbedding));
    assert.strictEqual(mapFeatures.collaborativeEmbedding.length, 4);

    // --- PRUEBA 2: RECOMENDACIÓN FILTRO COLABORATIVO ONLINE ---
    console.log("\n2. Obteniendo recomendaciones basadas en embeddings SVD...");
    // Usamos limit: 100 para asegurar que todos los mapas se retornan (evitando truncamiento por mapas antiguos no purgados)
    const recs = await getCollaborativeRecommendations(targetUserId, { limit: 100 });
    const relevantRecIds = recs.map((r) => r.id).filter((id) => testMapIds.includes(id));
    console.log("Recomendaciones devueltas (filtradas para este test):", relevantRecIds);

    // Map 3 y Map 4 deberían estar recomendados por tener alta correlación latente.
    // Map 5 no debería estar recomendado porque su latent factor no se alinea con el Target User (dot product ~ 0).
    assert.ok(relevantRecIds.includes(mapId3), "Map 3 debe recomendarse");
    assert.ok(relevantRecIds.includes(mapId4), "Map 4 debe recomendarse");
    assert.ok(!relevantRecIds.includes(mapId5) || relevantRecIds.indexOf(mapId5) > relevantRecIds.indexOf(mapId3), "Map 5 no debe anteceder a Map 3");

    // --- PRUEBA 3: FALLBACKS Y COLD START ---
    console.log("\n3. Validando fallbacks...");
    // Usuario invitado (null)
    const recsGuest = await getCollaborativeRecommendations(null, { limit: 10 });
    assert.ok(Array.isArray(recsGuest));
    console.log("Fallback invitado exitoso.");

    // Usuario nuevo sin embedding
    const randomUserId = "test-col-random-" + Date.now();
    const recsNewUser = await getCollaborativeRecommendations(randomUserId, { limit: 10 });
    assert.ok(Array.isArray(recsNewUser));
    console.log("Fallback usuario nuevo exitoso.");

  } finally {
    // --- 4. LIMPIEZA FINAL ---
    await performDatabaseCleanup();
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL RECOMENDADOR POR FACTORIZACIÓN MATRICIAL PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { getContentRecommendations, getUserPreferenceVector, getMapVector, cosineSimilarity } from "../server/services/ContentRecommender.js";
import assert from "assert";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 37: RECOMENDADOR POR CONTENIDO ===");

  const userId = "test-cont-user-" + Date.now();
  const mapId1 = "test-map-cont-1-" + Date.now();
  const mapId2 = "test-map-cont-2-" + Date.now();
  const mapId3 = "test-map-cont-3-" + Date.now();
  const mapId4 = "test-map-cont-4-" + Date.now();

  const testMapIds = [mapId1, mapId2, mapId3, mapId4];

  // Limpieza previa
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: { in: testMapIds } } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.matchPlayer.deleteMany({ where: { userId } });
  await prisma.match.deleteMany({ where: { mapId: { in: testMapIds } } });
  await prisma.gameMap.deleteMany({ where: { id: { in: testMapIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });

  // 1. Crear usuario probador
  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.local`,
      username: `user_${userId}`,
      passwordHash: "pass_hash",
      createdAt: new Date(),
    }
  });

  try {
    await analyticsPrisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.local`,
        username: `user_${userId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err;
  }

  // 2. Crear los 4 mapas con distintos atributos/tags
  // Map 1: Shooter puro, Hard
  await prisma.gameMap.create({
    data: {
      id: mapId1,
      slug: "slug-" + mapId1,
      name: "Tactical Shooter Combat",
      description: "A competitive shooter map with fps gun play",
      ownerId: userId,
      isPublished: true,
    }
  });
  await analyticsPrisma.mapFeatures.create({
    data: { mapId: mapId1, difficultyScore: 0.8, bounceCount: 0, totalLeaves: 0 }
  });

  // Map 2: Puzzle / Sandbox, Medium difficulty
  await prisma.gameMap.create({
    data: {
      id: mapId2,
      slug: "slug-" + mapId2,
      name: "Logical Escape Room",
      description: "A puzzle sandbox with escapement blocks and logic puzzles",
      ownerId: userId,
      isPublished: true,
    }
  });
  await analyticsPrisma.mapFeatures.create({
    data: { mapId: mapId2, difficultyScore: 0.4, bounceCount: 0, totalLeaves: 0 }
  });

  // Map 3: Sandbox puro, Easy
  await prisma.gameMap.create({
    data: {
      id: mapId3,
      slug: "slug-" + mapId3,
      name: "Creative Sandbox Builder",
      description: "An easy building sandbox map",
      ownerId: userId,
      isPublished: true,
    }
  });
  await analyticsPrisma.mapFeatures.create({
    data: { mapId: mapId3, difficultyScore: 0.2, bounceCount: 0, totalLeaves: 0 }
  });

  // Map 4: Shooter puro, Hard (se usará para la comparación con Map 1)
  await prisma.gameMap.create({
    data: {
      id: mapId4,
      slug: "slug-" + mapId4,
      name: "FPS Arena Battleground",
      description: "Another combat shooter game with weapons and guns",
      ownerId: userId,
      isPublished: true,
    }
  });
  await analyticsPrisma.mapFeatures.create({
    data: { mapId: mapId4, difficultyScore: 0.7, bounceCount: 0, totalLeaves: 0 }
  });

  // --- PRUEBA 1: VECTORIZACIÓN DE MAPAS ---
  console.log("\n1. Verificando vectorización de mapas...");
  const vecMap1 = getMapVector({ name: "Tactical Shooter Combat", description: "A competitive shooter map with fps gun play" }, 0.8);
  console.log("Vector Map 1 (Shooter):", vecMap1);
  // Esperado: [0, 1, 0, 0.8]
  assert.strictEqual(vecMap1[0], 0);
  assert.strictEqual(vecMap1[1], 1);
  assert.strictEqual(vecMap1[2], 0);
  assert.strictEqual(vecMap1[3], 0.8);

  const vecMap2 = getMapVector({ name: "Logical Escape Room", description: "A puzzle sandbox with escapement blocks and logic puzzles" }, 0.4);
  console.log("Vector Map 2 (Puzzle Sandbox):", vecMap2);
  // Esperado: [1, 0, 1, 0.4]
  assert.strictEqual(vecMap2[0], 1);
  assert.strictEqual(vecMap2[1], 0);
  assert.strictEqual(vecMap2[2], 1);
  assert.strictEqual(vecMap2[3], 0.4);


  // --- PRUEBA 2: RECOMENDACIÓN COLD-START (GUEST / SIN HISTORIAL) ---
  console.log("\n2. Simulando recomendación para usuario sin historial (Vector por defecto)...");
  const defaultVector = await getUserPreferenceVector(null);
  console.log("Vector por defecto:", defaultVector);
  assert.deepStrictEqual(defaultVector, [0.33, 0.33, 0.33, 0.5]);

  const recsDefault = await getContentRecommendations(null, { limit: 10 });
  console.log("Orden para usuario por defecto:");
  recsDefault.forEach((r, idx) => console.log(`[${idx+1}] ID: ${r.id}, Name: ${r.name}`));
  assert.strictEqual(recsDefault.length >= 4, true);


  // --- PRUEBA 3: HISTORIAL PERSONALIZADO (HISTORIAL DE SHOOTERS) ---
  console.log("\n3. Simulando historial de juego (Únicamente mapas Shooter)...");
  // Añadimos historial jugando Map 1 y Map 4
  const matchId1 = "match-test-cont-1";
  const matchId2 = "match-test-cont-2";

  await prisma.match.create({
    data: { id: matchId1, roomId: "room-cont-1", mapId: mapId1, status: "FINISHED" }
  });
  await prisma.matchPlayer.create({
    data: { id: "mp-cont-1", matchId: matchId1, userId, playerId: "p-1", playerName: "P1", joinedAt: new Date() }
  });

  await prisma.match.create({
    data: { id: matchId2, roomId: "room-cont-2", mapId: mapId4, status: "FINISHED" }
  });
  await prisma.matchPlayer.create({
    data: { id: "mp-cont-2", matchId: matchId2, userId, playerId: "p-2", playerName: "P2", joinedAt: new Date() }
  });

  const shooterUserVector = await getUserPreferenceVector(userId);
  console.log("Vector de preferencia del usuario Shooter:", shooterUserVector);
  // Esperado shooterUserVector cercano a [0, 1, 0, 0.75]
  assert.strictEqual(shooterUserVector[0], 0);
  assert.strictEqual(shooterUserVector[1], 1);
  assert.strictEqual(shooterUserVector[2], 0);
  assert.strictEqual(shooterUserVector[3], 0.75);

  const recsShooter = await getContentRecommendations(userId, { limit: 10 });
  const relevantShooterIds = recsShooter.map(r => r.id).filter(id => testMapIds.includes(id));
  console.log("Recomendaciones ordenadas relevantes para usuario Shooter:", relevantShooterIds);
  // Debería priorizar los mapas de tipo Shooter (Map 1 y Map 4) por encima de Sandbox/Puzzle (Map 2 y Map 3)
  assert.strictEqual(relevantShooterIds[0] === mapId1 || relevantShooterIds[0] === mapId4, true);
  assert.strictEqual(relevantShooterIds[1] === mapId1 || relevantShooterIds[1] === mapId4, true);


  // --- PRUEBA 4: PENALIZACIÓN DE REPETICIÓN (COMPLETAR MAP 1 MÁS DE 3 VECES) ---
  console.log("\n4. Simulando penalización de repetición (Completar Map 1 cuatro veces)...");
  // Añadimos 3 matches completados más en Map 1 (totalizando 4 completados)
  const now = new Date();
  for (let i = 3; i <= 5; i++) {
    const mId = `match-test-cont-${i}`;
    await prisma.match.create({
      data: { id: mId, roomId: `room-cont-${i}`, mapId: mapId1, status: "FINISHED", endedAt: now }
    });
    await prisma.matchPlayer.create({
      data: { id: `mp-cont-${i}`, matchId: mId, userId, playerId: `p-${i}`, playerName: `P${i}`, joinedAt: now, leftAt: now }
    });
  }

  // Ahora, Map 1 se ha completado 4 veces (> 3).
  // Debería aplicarse la penalización de la mitad del score de similitud para Map 1.
  // Por lo tanto, Map 4 (que tiene una similitud muy parecida pero cero completados)
  // debe quedar ordenado por encima del Map 1.
  const recsPenalized = await getContentRecommendations(userId, { limit: 10 });
  const relevantPenalizedIds = recsPenalized.map(r => r.id).filter(id => testMapIds.includes(id));
  console.log("Orden con penalización:", relevantPenalizedIds);
  assert.strictEqual(relevantPenalizedIds[0], mapId4, "Map 4 debe ser el primero tras la penalización de repetición de Map 1");
  assert.strictEqual(relevantPenalizedIds[1], mapId1, "Map 1 debe caer al segundo puesto por penalización");


  // --- 5. LIMPIEZA FINAL ---
  console.log("\n5. Limpiando datos de prueba...");
  await prisma.matchPlayer.deleteMany({ where: { userId } });
  await prisma.match.deleteMany({ where: { mapId: { in: testMapIds } } });
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: { in: testMapIds } } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.gameMap.deleteMany({ where: { id: { in: testMapIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL RECOMENDADOR POR CONTENIDO PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

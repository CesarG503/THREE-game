import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import { computePlayerArchetype } from "../server/analytics/ml/player_archetypes.js";
import assert from "assert";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 35: SEGMENTACIÓN DE ARQUETIPOS DE JUGADORES ===");

  await connectRedis();

  const userIdConstructor = "test-arch-const-" + Date.now();
  const userIdSocial = "test-arch-soc-" + Date.now();
  const userIdCompetitivo = "test-arch-comp-" + Date.now();
  const userIdFriend = "test-arch-friend-" + Date.now();

  const testUserIds = [userIdConstructor, userIdSocial, userIdCompetitivo, userIdFriend];
  const testMapId = "test-map-hard-" + Date.now();

  // Limpieza previa
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { in: testUserIds } } });
  await analyticsPrisma.socialAffinity.deleteMany({
    where: {
      OR: [
        { userId1: { in: testUserIds } },
        { userId2: { in: testUserIds } }
      ]
    }
  });
  await analyticsPrisma.rawEvent.deleteMany({ where: { userId: { in: testUserIds } } });
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: testMapId } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.matchPlayer.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.match.deleteMany({ where: { mapId: testMapId } });
  await prisma.gameMap.deleteMany({ where: { id: testMapId } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });

  // 1. Crear usuarios
  for (const id of testUserIds) {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@test.local`,
        username: `user_${id}`,
        passwordHash: "pass_hash",
        createdAt: new Date(),
      }
    });

    try {
      await analyticsPrisma.user.create({
        data: {
          id,
          email: `${id}@test.local`,
          username: `user_${id}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }
  }

  // Crear mapa y sus características difíciles
  await prisma.gameMap.create({
    data: {
      id: testMapId,
      slug: "slug-" + testMapId,
      name: "Hard Map",
      description: "A difficult map for testing",
      ownerId: userIdConstructor,
    }
  });

  await analyticsPrisma.mapFeatures.create({
    data: {
      mapId: testMapId,
      difficultyScore: 0.85, // Brutal / Hard
      difficultyLabel: "Hard",
    }
  });

  // --- CASO 1: CONSTRUCTOR ---
  // Seed: 800 segundos en EditorSession (close) y 200 segundos en gameplay (SessionEnd)
  // Constructor Ratio bruto: 800 / (800 + 200) = 0.8 (80%)
  console.log("\n1. Simulando datos para Usuario Constructor...");
  await analyticsPrisma.rawEvent.create({
    data: {
      id: "evt-const-edit",
      eventType: "EditorSession",
      userId: userIdConstructor,
      timestamp: new Date(),
      payload: { action: "close", durationSeconds: 800 }
    }
  });
  await analyticsPrisma.rawEvent.create({
    data: {
      id: "evt-const-play",
      eventType: "SessionEnd",
      userId: userIdConstructor,
      timestamp: new Date(),
      payload: { durationSeconds: 200, idleSeconds: 0, usefulSeconds: 200 }
    }
  });

  const profileConstType = await computePlayerArchetype(userIdConstructor);
  console.log(`-> Constructor primario clasificado como: ${profileConstType}`);
  assert.strictEqual(profileConstType, "Constructor");

  const constProf = await PlayerProfileRepository.getProfile(userIdConstructor);
  console.log("Pesos guardados:", constProf?.archetypeWeights);
  assert.strictEqual(constProf?.archetypeWeights?.Constructor > 0.5, true);


  // --- CASO 2: SOCIAL ---
  // Seed: SocialAffinity con userIdFriend de 450 segundos
  // Social score bruto: 450 / 600 = 0.75
  console.log("\n2. Simulando datos para Usuario Social...");
  // Aseguramos orden alfabético para la clave única si se requiere o usamos la tabla directamente
  const u1 = userIdSocial < userIdFriend ? userIdSocial : userIdFriend;
  const u2 = userIdSocial < userIdFriend ? userIdFriend : userIdSocial;

  await analyticsPrisma.socialAffinity.create({
    data: {
      userId1: u1,
      userId2: u2,
      affinity: 450,
      updatedAt: new Date()
    }
  });

  const profileSocType = await computePlayerArchetype(userIdSocial);
  console.log(`-> Social primario clasificado como: ${profileSocType}`);
  assert.strictEqual(profileSocType, "Social");

  const socProf = await PlayerProfileRepository.getProfile(userIdSocial);
  console.log("Pesos guardados:", socProf?.archetypeWeights);
  assert.strictEqual(socProf?.archetypeWeights?.Social > 0.5, true);


  // --- CASO 3: COMPETITIVO ---
  // Seed: Partida completada en testMapId (mapa difícil) de 1000 segundos de duración
  // Competitivo score bruto: 1000 / 1200 = 0.833
  console.log("\n3. Simulando datos para Usuario Competitivo...");
  const matchId = "test-match-comp";
  const startedAt = new Date(Date.now() - 20 * 60 * 1000); // Hace 20 min
  const endedAt = new Date(Date.now() - 3.3 * 60 * 1000); // Duración de 1000 segundos aprox. (16.6 min)

  await prisma.match.create({
    data: {
      id: matchId,
      roomId: "room-comp",
      mapId: testMapId,
      status: "FINISHED",
      startedAt,
      endedAt,
    }
  });

  await prisma.matchPlayer.create({
    data: {
      id: "mp-comp",
      matchId,
      userId: userIdCompetitivo,
      playerId: "p-comp",
      playerName: "Competitivo Player",
      joinedAt: startedAt,
      leftAt: endedAt, // Completado
    }
  });

  const profileCompType = await computePlayerArchetype(userIdCompetitivo);
  console.log(`-> Competitivo primario clasificado como: ${profileCompType}`);
  assert.strictEqual(profileCompType, "Competitivo");

  const compProf = await PlayerProfileRepository.getProfile(userIdCompetitivo);
  console.log("Pesos guardados:", compProf?.archetypeWeights);
  assert.strictEqual(compProf?.archetypeWeights?.Competitivo > 0.5, true);


  // 5. Limpieza
  console.log("\n4. Limpiando datos de prueba...");
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { in: testUserIds } } });
  await analyticsPrisma.socialAffinity.deleteMany({
    where: {
      OR: [
        { userId1: { in: testUserIds } },
        { userId2: { in: testUserIds } }
      ]
    }
  });
  await analyticsPrisma.rawEvent.deleteMany({ where: { userId: { in: testUserIds } } });
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: testMapId } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.matchPlayer.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.match.deleteMany({ where: { mapId: testMapId } });
  await prisma.gameMap.deleteMany({ where: { id: testMapId } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
  await disconnectRedis();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DE ARQUETIPOS DE JUGADOR PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

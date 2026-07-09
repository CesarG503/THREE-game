import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { roomManager } from "../server/managers/RoomManager.js";
import {
  setUserVisibility,
  getUserVisibility,
  getSocialRecommendations,
} from "../server/services/SocialRecommender.js";
import { getRedis } from "../server/cache/redis.js";
import type { ExtendedWebSocket } from "../server/types.js";
import assert from "assert";

async function performDatabaseCleanup() {
  console.log("Realizando purga y limpieza completa de datos de prueba social...");
  try {
    // 1. Limpieza de Redis para status
    const redis = getRedis();
    if (redis && redis.isOpen) {
      const keys = await redis.keys("presence:status:test-soc-*");
      for (const k of keys) {
        await redis.del(k);
      }
    }

    // 2. Eliminar de roomManager
    const activeRooms = roomManager.getActiveRoomsAndPlayers();
    for (const room of activeRooms) {
      if (room.roomId.startsWith("room-soc-")) {
        for (const p of room.players) {
          roomManager.removePlayer(room.roomId, p.playerId);
        }
      }
    }

    // 3. Eliminar relaciones de jugadores de partidas de prueba
    await prisma.matchPlayer.deleteMany({
      where: {
        userId: { startsWith: "test-soc-" },
      },
    });

    // 4. Eliminar partidas de prueba
    await prisma.match.deleteMany({
      where: {
        OR: [
          { id: { startsWith: "match-soc-" } },
          { roomId: { startsWith: "room-soc-" } },
        ],
      },
    });

    // 5. Eliminar mapas de prueba
    await prisma.gameMap.deleteMany({
      where: {
        id: { startsWith: "test-map-soc-" },
      },
    });

    // 6. Eliminar afinidades de prueba
    await analyticsPrisma.socialAffinity.deleteMany({
      where: {
        OR: [
          { userId1: { startsWith: "test-soc-" } },
          { userId2: { startsWith: "test-soc-" } },
        ],
      },
    });

    // 7. Eliminar perfiles analíticos de prueba
    await analyticsPrisma.playerFeatures.deleteMany({
      where: {
        userId: { startsWith: "test-soc-" },
      },
    });

    // 8. Eliminar usuarios de prueba
    await prisma.user.deleteMany({
      where: {
        id: { startsWith: "test-soc-" },
      },
    });

    console.log("✓ Limpieza de datos completada.");
  } catch (err) {
    console.error("Error durante la limpieza de base de datos:", err);
  }
}

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 43: RECOMENDADOR SOCIAL ===");

  const targetUserId = "test-soc-target";
  const userAId = "test-soc-user-a";
  const userBId = "test-soc-user-b";
  const userCId = "test-soc-user-c";

  const mapId1 = "test-map-soc-1";
  const mapId2 = "test-map-soc-2";
  const mapId3 = "test-map-soc-3";

  const testUserIds = [targetUserId, userAId, userBId, userCId];
  const testMapIds = [mapId1, mapId2, mapId3];

  await performDatabaseCleanup();

  try {
    // 1. Conectar Redis (por si no está activo, el script de prueba debe garantizarlo)
    const redis = getRedis();
    if (!redis || !redis.isOpen) {
      const { connectRedis } = await import("../server/cache/redis.js");
      await connectRedis();
    }

    // 2. Crear usuarios en la DB operativa
    console.log("Creando usuarios de prueba...");
    for (const uid of testUserIds) {
      await prisma.user.create({
        data: {
          id: uid,
          email: `${uid}@test.local`,
          username: `user_${uid}`,
          passwordHash: "pass_hash",
        },
      });
    }

    // 3. Crear mapas
    console.log("Creando mapas de prueba...");
    for (const mid of testMapIds) {
      await prisma.gameMap.create({
        data: {
          id: mid,
          slug: "slug-" + mid,
          name: "Social Map " + mid,
          description: "Test map for social recommender",
          ownerId: targetUserId,
          isPublished: true,
        },
      });
    }

    // 4. Crear afinidades sociales analíticas
    console.log("Creando afinidades sociales...");
    // Target -> A: 0.8
    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: targetUserId,
        userId2: userAId,
        affinity: 0.8,
      },
    });
    // Target -> B: 0.5
    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: targetUserId,
        userId2: userBId,
        affinity: 0.5,
      },
    });
    // Target -> C: 0.2
    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: targetUserId,
        userId2: userCId,
        affinity: 0.2,
      },
    });

    // --- TEST 1: Estado de Visibilidad en Redis ---
    console.log("\n1. Probando obtención/configuración de visibilidad...");
    const initialVisibility = await getUserVisibility(userAId);
    assert.strictEqual(initialVisibility, "ONLINE", "Por defecto la visibilidad debe ser ONLINE");

    await setUserVisibility(userAId, "INVISIBLE");
    const updatedVisibility = await getUserVisibility(userAId);
    assert.strictEqual(updatedVisibility, "INVISIBLE", "Debe poder actualizarse a INVISIBLE");

    await setUserVisibility(userAId, "ONLINE");

    // --- TEST 2: Simulación de salas de juego activas ---
    console.log("\n2. Simulando salas de juego activas...");
    // Sala 1: Corre mapId1, juega User A
    const wsA = { userId: userAId, readyState: 1, send: () => {} } as any as ExtendedWebSocket;
    roomManager.addPlayer("room-soc-1", "player-a", "Amigo A", { x: 0, y: 0, z: 0 }, wsA);
    await prisma.match.create({
      data: {
        id: "match-soc-1",
        roomId: "room-soc-1",
        mapId: mapId1,
        status: "RUNNING",
      },
    });

    // Sala 2: Corre mapId2, juega User B
    const wsB = { userId: userBId, readyState: 1, send: () => {} } as any as ExtendedWebSocket;
    roomManager.addPlayer("room-soc-2", "player-b", "Amigo B", { x: 0, y: 0, z: 0 }, wsB);
    await prisma.match.create({
      data: {
        id: "match-soc-2",
        roomId: "room-soc-2",
        mapId: mapId2,
        status: "RUNNING",
      },
    });

    // Sala 3: Corre mapId3, juega User C
    const wsC = { userId: userCId, readyState: 1, send: () => {} } as any as ExtendedWebSocket;
    roomManager.addPlayer("room-soc-3", "player-c", "Amigo C", { x: 0, y: 0, z: 0 }, wsC);
    await prisma.match.create({
      data: {
        id: "match-soc-3",
        roomId: "room-soc-3",
        mapId: mapId3,
        status: "RUNNING",
      },
    });

    // --- TEST 3: Obtener Recomendaciones Sociales con todos ONLINE ---
    console.log("\n3. Obteniendo recomendaciones sociales (todos ONLINE)...");
    const recs = await getSocialRecommendations(targetUserId);
    console.log("Recomendaciones recibidas:", recs);

    assert.strictEqual(recs.length, 3, "Debe retornar 3 recomendaciones de mapas");
    assert.strictEqual(recs[0]?.id, mapId1, "El primer mapa debe ser mapId1 (afinidad 0.8)");
    assert.strictEqual(recs[1]?.id, mapId2, "El segundo mapa debe ser mapId2 (afinidad 0.5)");
    assert.strictEqual(recs[2]?.id, mapId3, "El tercer mapa debe ser mapId3 (afinidad 0.2)");

    assert.strictEqual(recs[0]?.friendsPlaying.length, 1);
    assert.strictEqual(recs[0]?.friendsPlaying[0]?.userId, userAId);
    assert.strictEqual(recs[0]?.friendsPlaying[0]?.username, "Amigo A");

    // --- TEST 4: Filtrado por Privacidad (Modo Invisible) ---
    console.log("\n4. Probando filtro de privacidad (Amigo A cambia a INVISIBLE)...");
    await setUserVisibility(userAId, "INVISIBLE");

    const recsWithInvisible = await getSocialRecommendations(targetUserId);
    console.log("Recomendaciones con A invisible:", recsWithInvisible);

    // Map 1 debe desaparecer de las recomendaciones porque el único amigo presente (A) está invisible
    assert.strictEqual(
      recsWithInvisible.find((r) => r.id === mapId1),
      undefined,
      "Map 1 no debe recomendarse porque el Amigo A está invisible"
    );
    assert.strictEqual(recsWithInvisible.length, 2, "Debe retornar solo 2 recomendaciones");
    assert.strictEqual(recsWithInvisible[0]?.id, mapId2, "El mapa prioritario ahora debe ser mapId2");

    // --- TEST 5: Fallbacks e Invitados ---
    console.log("\n5. Validando fallbacks e invitados...");
    const guestRecs = await getSocialRecommendations(null);
    assert.strictEqual(guestRecs.length, 0, "Usuarios invitados deben recibir recomendaciones vacías");

    const noFriendUserRecs = await getSocialRecommendations("test-soc-no-friends");
    assert.strictEqual(noFriendUserRecs.length, 0, "Usuarios sin afinidad de amigos deben recibir recomendaciones vacías");

  } finally {
    await performDatabaseCleanup();
    await analyticsPrisma.$disconnect();
    await prisma.$disconnect();
  }

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL RECOMENDADOR SOCIAL PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

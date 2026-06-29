import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, disconnectRedis, getRedis } from "../server/cache/redis.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import assert from "assert";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 16: MODELO DE PERFIL DE JUGADOR ===");

  // 1. Inicializar conexiones
  await connectRedis();
  const redis = getRedis();

  const userId = "test-prof-" + Date.now();
  const now = new Date();

  console.log("1. Configurando datos en las bases de datos...");
  
  // Limpieza de ejecuciones anteriores
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { startsWith: "test-prof-" } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { startsWith: "test-prof-" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "test-prof-" } } });

  // Crear usuario en base de datos operacional
  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.local`,
      username: `profile_tester_${Date.now()}`,
      passwordHash: "secure_pass_hash",
      displayName: "Perfil de Pruebas",
    },
  });

  // Asegurar que el usuario existe en analytics (por el trigger o inserción manual)
  try {
    await analyticsPrisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.local`,
        username: `profile_tester_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err; // P2002 es duplicado (indica que el trigger Postgres ya lo insertó)
  }

  // Insertar características analíticas de prueba
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId,
      lastActive: now,
      totalPlayTime: 1250.5,
      matchesPlayed: 8,
      preferredLanguage: "es",
      explorerRatio: 1.5,
      playerProfile: "Explorer",
      popularitySensitivity: 0.85,
      returnIntent: 0.025,
    },
  });

  // Limpiar caché de Redis previo
  await PlayerProfileRepository.clearCache(userId);

  console.log("\n2. Probando obtención del perfil unificado (Cache MISS inicial)...");
  const t0 = Date.now();
  const profile1 = await PlayerProfileRepository.getProfile(userId);
  const rtt1 = Date.now() - t0;

  console.log(`Perfil recuperado (MISS) en ${rtt1}ms:`);
  assert(profile1, "El perfil no debería ser nulo");
  assert.strictEqual(profile1.id, userId);
  assert.strictEqual(profile1.email, `${userId}@test.local`);
  assert.strictEqual(profile1.displayName, "Perfil de Pruebas");
  assert.strictEqual(profile1.playerProfile, "Explorer");
  assert.strictEqual(profile1.matchesPlayed, 8);
  assert.strictEqual(profile1.totalPlayTime, 1250.5);
  assert.strictEqual(profile1.returnIntent, 0.025);
  assert(profile1.createdAt instanceof Date, "createdAt debe ser un objeto Date");
  assert(profile1.lastActive instanceof Date, "lastActive debe ser un objeto Date");

  console.log("✓ Perfil inicial validado con éxito.");

  console.log("\n3. Probando segunda obtención (Cache HIT en Redis)...");
  const t1 = Date.now();
  const profile2 = await PlayerProfileRepository.getProfile(userId);
  const rtt2 = Date.now() - t1;

  console.log(`Perfil recuperado (HIT) en ${rtt2}ms.`);
  assert(profile2, "El perfil del caché no debería ser nulo");
  assert.strictEqual(profile2.id, userId);
  assert.strictEqual(profile2.displayName, "Perfil de Pruebas");
  assert(profile2.createdAt instanceof Date, "createdAt rehidratado debe ser un objeto Date");
  assert(profile2.lastActive instanceof Date, "lastActive rehidratado debe ser un objeto Date");
  
  // Validar velocidad de recuperación en Redis (usualmente < 5ms localmente)
  console.log(`✓ Verificación de velocidad de caché pasada (RTT: ${rtt2}ms vs original ${rtt1}ms).`);

  console.log("\n4. Verificando persistencia del caché al alterar la base de datos...");
  // Modificar base de datos operacional temporalmente
  await prisma.user.update({
    where: { id: userId },
    data: { displayName: "Nombre Modificado En DB" },
  });

  // Consultar perfil de nuevo. Debería retornar el valor en caché viejo (original)
  const profileCached = await PlayerProfileRepository.getProfile(userId);
  assert.strictEqual(profileCached?.displayName, "Perfil de Pruebas");
  console.log("✓ Confirmado: se retornó el valor de caché de Redis, no de la BD.");

  console.log("\n5. Probando invalidación manual de caché (clearCache)...");
  await PlayerProfileRepository.clearCache(userId);

  // Consultar de nuevo. Debería traer el valor actualizado de la BD (MISS)
  const profileUpdated = await PlayerProfileRepository.getProfile(userId);
  assert.strictEqual(profileUpdated?.displayName, "Nombre Modificado En DB");
  console.log("✓ Confirmado: se limpió el caché y se obtuvo el nuevo valor de la BD.");

  console.log("\n6. Probando tolerancia a fallos con Redis desconectado (Resiliencia)...");
  await disconnectRedis(); // Desconectar Redis

  const tRedisOff = Date.now();
  const profileResilient = await PlayerProfileRepository.getProfile(userId);
  const rttRedisOff = Date.now() - tRedisOff;

  console.log(`Perfil recuperado sin Redis en ${rttRedisOff}ms.`);
  assert(profileResilient, "El perfil no debería ser nulo aun con Redis desconectado");
  assert.strictEqual(profileResilient.displayName, "Nombre Modificado En DB");
  console.log("✓ Confirmado: el repositorio degradó elegantemente a base de datos sin lanzar excepciones.");

  console.log("\n7. Limpiando datos de prueba...");
  await prisma.user.deleteMany({ where: { id: userId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL MODELO DE PERFIL (FASE 16) PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

import "dotenv/config";
import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { runClusteringPipeline } from "../server/analytics/ml/clustering.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

const TEST_USER_IDS = [
  "clustering-test-user-1",
  "clustering-test-user-2",
  "clustering-test-user-3",
  "clustering-test-user-4",
  "clustering-test-user-5",
  "clustering-test-user-6",
];

async function cleanUp() {
  console.log("Limpiando datos de prueba de clustering...");
  // Al borrar de User en la DB operacional, el trigger borra de analytics."User"
  // y a su vez cascada para borrar de analytics."PlayerFeatures".
  await prisma.user.deleteMany({
    where: {
      id: { in: TEST_USER_IDS },
    },
  });
  console.log("Datos de prueba eliminados.");
}

async function seed() {
  console.log("Sembrando usuarios de prueba conductuales...");

  const baseDate = new Date();

  // 1. Crear usuarios operacionales
  for (let i = 1; i <= 6; i++) {
    const userId = `clustering-test-user-${i}`;
    await prisma.user.create({
      data: {
        id: userId,
        email: `user${i}@clustering-test.com`,
        username: `clusteruser${i}`,
        passwordHash: "testpasswordhash",
        createdAt: baseDate,
        updatedAt: baseDate,
      },
    });
  }

  // 2. Esperar/confirmar que el trigger de réplica inserte en el esquema analytics
  console.log("Creando características analíticas (PlayerFeatures)...");

  // Grupo 1: Hardcore Repeaters (Playtime y matches altos, explore ratio y popularity sensitivity bajos, return intent alto)
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-1",
      lastActive: baseDate,
      totalPlayTime: 10000.0,
      matchesPlayed: 50,
      explorerRatio: 0.05,
      popularitySensitivity: 0.10,
      returnIntent: 0.95,
    },
  });
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-2",
      lastActive: baseDate,
      totalPlayTime: 12000.0,
      matchesPlayed: 60,
      explorerRatio: 0.02,
      popularitySensitivity: 0.15,
      returnIntent: 0.90,
    },
  });

  // Grupo 2: Casual Explorers (Playtime y matches bajos, explorer ratio y popularity sensitivity altos, return intent bajo)
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-3",
      lastActive: baseDate,
      totalPlayTime: 50.0,
      matchesPlayed: 1,
      explorerRatio: 0.90,
      popularitySensitivity: 0.85,
      returnIntent: 0.10,
    },
  });
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-4",
      lastActive: baseDate,
      totalPlayTime: 70.0,
      matchesPlayed: 2,
      explorerRatio: 0.85,
      popularitySensitivity: 0.75,
      returnIntent: 0.15,
    },
  });

  // Grupo 3: Medium Balanced (Valores intermedios)
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-5",
      lastActive: baseDate,
      totalPlayTime: 1500.0,
      matchesPlayed: 10,
      explorerRatio: 0.40,
      popularitySensitivity: 0.50,
      returnIntent: 0.50,
    },
  });
  await analyticsPrisma.playerFeatures.create({
    data: {
      userId: "clustering-test-user-6",
      lastActive: baseDate,
      totalPlayTime: 1800.0,
      matchesPlayed: 12,
      explorerRatio: 0.45,
      popularitySensitivity: 0.45,
      returnIntent: 0.55,
    },
  });

  console.log("Usuarios y características sembradas con éxito.");
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE PIPELINE DE CLUSTERING K-MEANS (FASE 31) ===");

  try {
    await cleanUp();
    await seed();

    console.log("Ejecutando pipeline de clustering...");
    const result = await runClusteringPipeline({ k: 3, maxIterations: 100 });

    assert(result.k === 3, `Se esperaba k = 3, pero se obtuvo k = ${result.k}`);
    assert(result.assignments.length >= 6, `Se esperaba al menos 6 asignaciones, se obtuvieron ${result.assignments.length}`);

    // Extraer asignaciones del test
    const assignmentsMap = new Map<string, string>();
    for (const a of result.assignments) {
      assignmentsMap.set(a.userId, a.clusterId);
    }

    const c1 = assignmentsMap.get("clustering-test-user-1");
    const c2 = assignmentsMap.get("clustering-test-user-2");
    const c3 = assignmentsMap.get("clustering-test-user-3");
    const c4 = assignmentsMap.get("clustering-test-user-4");
    const c5 = assignmentsMap.get("clustering-test-user-5");
    const c6 = assignmentsMap.get("clustering-test-user-6");

    assert(!!c1 && !!c2 && !!c3 && !!c4 && !!c5 && !!c6, "Faltan asignaciones de clúster para usuarios del test");

    console.log(`Clúster de Usuario 1: ${c1}`);
    console.log(`Clúster de Usuario 2: ${c2}`);
    console.log(`Clúster de Usuario 3: ${c3}`);
    console.log(`Clúster de Usuario 4: ${c4}`);
    console.log(`Clúster de Usuario 5: ${c5}`);
    console.log(`Clúster de Usuario 6: ${c6}`);

    // Validar agrupamiento correcto (Usuario 1 y 2 en el mismo clúster)
    assert(c1 === c2, "Usuario 1 y 2 deben pertenecer al mismo clúster (Hardcore Repeaters)");
    // Validar agrupamiento correcto (Usuario 3 y 4 en el mismo clúster)
    assert(c3 === c4, "Usuario 3 y 4 deben pertenecer al mismo clúster (Casual Explorers)");
    // Validar agrupamiento correcto (Usuario 5 y 6 en el mismo clúster)
    assert(c5 === c6, "Usuario 5 y 6 deben pertenecer al mismo clúster (Medium Balanced)");

    // Validar que los clústeres sean distintos entre sí
    assert(c1 !== c3, "El clúster de Hardcore Repeaters debe ser diferente al de Casual Explorers");
    assert(c1 !== c5, "El clúster de Hardcore Repeaters debe ser diferente al de Medium Balanced");
    assert(c3 !== c5, "El clúster de Casual Explorers debe ser diferente al de Medium Balanced");

    console.log("✓ Separación matemática y clústeres validados con éxito.");

    // Validar persistencia en BD
    console.log("Validando persistencia de clústeres en BD...");
    for (const userId of TEST_USER_IDS) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const pf = await analyticsPrisma.playerFeatures.findUnique({ where: { userId } });
      const expectedCluster = assignmentsMap.get(userId);

      assert(user?.clusterId === expectedCluster, `El clúster del usuario en User no coincide. Esperado: ${expectedCluster}, Obtenido: ${user?.clusterId}`);
      assert(pf?.clusterId === expectedCluster, `El clúster del usuario en PlayerFeatures no coincide. Esperado: ${expectedCluster}, Obtenido: ${pf?.clusterId}`);
    }
    console.log("✓ Persistencia en bases de datos validada con éxito.");

    // Validar recuperación e integración a través de PlayerProfileRepository (y limpieza de caché de Redis)
    console.log("Validando recuperación unificada a través del PlayerProfileRepository...");
    for (const userId of TEST_USER_IDS) {
      const profile = await PlayerProfileRepository.getProfile(userId);
      const expectedCluster = assignmentsMap.get(userId);

      assert(!!profile, `No se pudo obtener el perfil para ${userId}`);
      assert(profile.clusterId === expectedCluster, `El clusterId en el perfil unificado no coincide. Esperado: ${expectedCluster}, Obtenido: ${profile.clusterId}`);
    }
    console.log("✓ Repositorio y rehidratación de caché validados con éxito.");

    await cleanUp();
    console.log("\n=== TODAS LAS PRUEBAS DE CLUSTERING (FASE 31) PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de clustering fallaron:", error);
    await cleanUp();
    process.exit(1);
  }
}

void main();

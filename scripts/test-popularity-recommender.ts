import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { getPopularityRecommendations } from "../server/services/RecommendationService.js";
import assert from "assert";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 36: RECOMENDADOR BASAL (COLD-START) ===");

  const userId = "test-pop-user-" + Date.now();
  const mapIdA = "test-map-pop-a-" + Date.now();
  const mapIdB = "test-map-pop-b-" + Date.now();
  const mapIdC = "test-map-pop-c-" + Date.now();

  const testMapIds = [mapIdA, mapIdB, mapIdC];

  // Limpieza previa
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: { in: testMapIds } } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.gameMap.deleteMany({ where: { id: { in: testMapIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });

  // 1. Crear usuario creador
  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.local`,
      username: `user_${userId}`,
      passwordHash: "pass_hash",
      createdAt: new Date(),
    }
  });

  // 2. Crear los 3 mapas con diferentes fechas de creación (createdAt)
  const now = Date.now();
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Mapa A: Popular y edad media (10 días)
  await prisma.gameMap.create({
    data: {
      id: mapIdA,
      slug: "slug-" + mapIdA,
      name: "Map A (Popular & Medium Age)",
      description: "Medium age map",
      ownerId: userId,
      isPublished: true,
      createdAt: tenDaysAgo,
    }
  });

  // Mapa B: Menos popular y nuevo (1 día)
  await prisma.gameMap.create({
    data: {
      id: mapIdB,
      slug: "slug-" + mapIdB,
      name: "Map B (New & Less Popular)",
      description: "New map",
      ownerId: userId,
      isPublished: true,
      createdAt: oneDayAgo,
    }
  });

  // Mapa C: Moderadamente popular y muy viejo (30 días)
  await prisma.gameMap.create({
    data: {
      id: mapIdC,
      slug: "slug-" + mapIdC,
      name: "Map C (Old & Moderately Popular)",
      description: "Old map",
      ownerId: userId,
      isPublished: true,
      createdAt: thirtyDaysAgo,
    }
  });

  // 3. Crear características analíticas (MapFeatures)
  // Map A has 100 joins
  await analyticsPrisma.mapFeatures.create({
    data: {
      mapId: mapIdA,
      totalJoins: 100,
      bounceCount: 0,
      totalLeaves: 0,
    }
  });

  // Map B has 20 joins
  await analyticsPrisma.mapFeatures.create({
    data: {
      mapId: mapIdB,
      totalJoins: 20,
      bounceCount: 0,
      totalLeaves: 0,
    }
  });

  // Map C has 50 joins
  await analyticsPrisma.mapFeatures.create({
    data: {
      mapId: mapIdC,
      totalJoins: 50,
      bounceCount: 0,
      totalLeaves: 0,
    }
  });

  // --- PRUEBA 1: RECOMENDACIÓN ESTÁNDAR (Gravedad = 1.8) ---
  console.log("\n1. Obteniendo recomendaciones con gravedad estándar (G = 1.8)...");
  const recsDefault = await getPopularityRecommendations({ limit: 10, gravity: 1.8 });
  
  // Imprimir detalles para depurar
  console.log("Recomendaciones devueltas:");
  recsDefault.forEach((r, idx) => {
    console.log(`[${idx + 1}] ID: ${r.id}, Name: ${r.name}`);
  });

  // Mapa A debería ser el primero porque 100 / (10 + 2)^1.8 = 100 / 12^1.8 ≈ 1.15
  // Mapa B: 20 / (1 + 2)^1.8 = 20 / 3^1.8 ≈ 2.76.
  // Espera, 2.76 > 1.15! Por lo tanto, el Mapa B (que es nuevo) debería tener un score mayor que el Mapa A!
  // Mapa C: 50 / (30 + 2)^1.8 = 50 / 32^1.8 ≈ 0.10.
  // Por lo tanto, el orden de score esperado es: B > A > C
  const defaultIds = recsDefault.map(r => r.id);
  const relevantDefaultIds = defaultIds.filter(id => testMapIds.includes(id));
  console.log("Orden relevante con G=1.8:", relevantDefaultIds);
  
  assert.strictEqual(relevantDefaultIds[0], mapIdB, "Map B debe ser el primero con G = 1.8");
  assert.strictEqual(relevantDefaultIds[1], mapIdA, "Map A debe ser el segundo con G = 1.8");
  assert.strictEqual(relevantDefaultIds[2], mapIdC, "Map C debe ser el tercero con G = 1.8");

  // --- PRUEBA 2: RECOMENDACIÓN CON GRAVEDAD BAJA (Gravedad = 0.5) ---
  // Si la gravedad es baja (ej. 0.5), el decaimiento temporal influye menos.
  // Map A score: 100 / 12^0.5 = 100 / 3.46 = 28.9
  // Map B score: 20 / 3^0.5 = 20 / 1.73 = 11.5
  // Map C score: 50 / 32^0.5 = 50 / 5.65 = 8.84
  // Por lo tanto, con gravedad baja el orden de score debería ser: A > B > C
  console.log("\n2. Obteniendo recomendaciones con gravedad baja (G = 0.5)...");
  const recsLowGravity = await getPopularityRecommendations({ limit: 10, gravity: 0.5 });
  
  const lowGravityIds = recsLowGravity.map(r => r.id);
  const relevantLowIds = lowGravityIds.filter(id => testMapIds.includes(id));
  console.log("Orden relevante con G=0.5:", relevantLowIds);
  
  assert.strictEqual(relevantLowIds[0], mapIdA, "Map A debe ser el primero con G = 0.5");
  assert.strictEqual(relevantLowIds[1], mapIdB, "Map B debe ser el segundo con G = 0.5");
  assert.strictEqual(relevantLowIds[2], mapIdC, "Map C debe ser el tercero con G = 0.5");

  // --- PRUEBA 3: FALLBACK A DB OPERACIONAL ---
  console.log("\n3. Probando la robustez de fallback (sin MapFeatures en analítica)...");
  // Eliminamos de MapFeatures para simular que no existen métricas analíticas
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: { in: testMapIds } } });

  // Simulamos partidas de matches completados en el mapa C
  await prisma.match.create({
    data: {
      id: "match-pop-1",
      roomId: "room-pop-1",
      mapId: mapIdC,
      status: "FINISHED",
    }
  });
  await prisma.match.create({
    data: {
      id: "match-pop-2",
      roomId: "room-pop-2",
      mapId: mapIdC,
      status: "FINISHED",
    }
  });

  // Ejecutar el recomendador. Dado que no hay MapFeatures, usará _count.matches de la operacional
  // Map C tiene 2 matches. Map A y B tienen 0 matches.
  // Con G = 0.1, el decaimiento temporal es mínimo.
  // Map C score: 2 / (30 + 2)^0.1 ≈ 2 / 1.4 = 1.42
  // Map A y B score: 0
  // Por tanto, Map C debe quedar primero.
  const recsFallback = await getPopularityRecommendations({ limit: 10, gravity: 0.1 });
  const fallbackIds = recsFallback.map(r => r.id);
  const relevantFallbackIds = fallbackIds.filter(id => testMapIds.includes(id));
  console.log("Orden relevante en fallback:", relevantFallbackIds);
  assert.strictEqual(relevantFallbackIds[0], mapIdC, "Map C debe ser el primero en fallback debido a matches operacionales");

  // --- 4. LIMPIEZA FINAL ---
  console.log("\n4. Limpiando datos de prueba...");
  await prisma.match.deleteMany({ where: { id: { in: ["match-pop-1", "match-pop-2"] } } });
  await analyticsPrisma.mapFeatures.deleteMany({ where: { mapId: { in: testMapIds } } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.gameMap.deleteMany({ where: { id: { in: testMapIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL RECOMENDADOR BASAL COLD-START PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

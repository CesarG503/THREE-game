import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { applyQualityFilter, getMapLatency, getMapServerRegion } from "../server/services/filters/QualityFilter.js";
import { detectTextLanguage } from "../server/analytics/features/language_matcher.js";
import type { MapDto } from "../server/services/MapService.js";
import assert from "assert";

function findIdForRegion(region: string, prefix: string): string {
  let counter = 0;
  while (true) {
    const id = `${prefix}-${region}-${counter}`;
    if (getMapServerRegion(id) === region) {
      return id;
    }
    counter++;
  }
}

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 38: FILTRO DE CALIDAD Y DESAMBIGUACIÓN ===");

  const userId = "test-qf-user-" + Date.now();

  // 1. Encontrar IDs de mapa con regiones predecibles
  const mapIdUsEast = findIdForRegion("us-east", "map");
  const mapIdEuWest = findIdForRegion("eu-west", "map");
  const mapIdSaEast = findIdForRegion("sa-east", "map");
  const mapIdAsiaEast = findIdForRegion("asia-east", "map");

  console.log(`IDs Generados:
  - us-east: ${mapIdUsEast} (región calculada: ${getMapServerRegion(mapIdUsEast)})
  - eu-west: ${mapIdEuWest} (región calculada: ${getMapServerRegion(mapIdEuWest)})
  - sa-east: ${mapIdSaEast} (región calculada: ${getMapServerRegion(mapIdSaEast)})
  - asia-east: ${mapIdAsiaEast} (región calculada: ${getMapServerRegion(mapIdAsiaEast)})`);

  // Mock de MapDtos para pruebas offline
  // Idiomas:
  // - Map A (us-east): "El gran coliseo de combate" -> Español (es)
  // - Map B (eu-west): "The ultimate shooting practice sandbox" -> Inglés (en)
  // - Map C (sa-east): "Le château mystique de l'aventure" -> Francés (fr)
  // - Map D (asia-east): "Das deutsche Labyrinth der Rätsel" -> Alemán (de)
  
  const mapA: MapDto = {
    id: mapIdUsEast,
    name: "El gran coliseo de combate",
    description: "Un mapa de combate en español",
    slug: "map-a",
    ownerId: "owner",
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    difficultyScore: 5.0,
    tags: ["shooter"],
  };

  const mapB: MapDto = {
    id: mapIdEuWest,
    name: "The ultimate shooting practice sandbox",
    description: "An English practice shooter map",
    slug: "map-b",
    ownerId: "owner",
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    difficultyScore: 3.0,
    tags: ["sandbox", "shooter"],
  };

  const mapC: MapDto = {
    id: mapIdSaEast,
    name: "Le château mystique de l'aventure",
    description: "French description here",
    slug: "map-c",
    ownerId: "owner",
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    difficultyScore: 4.0,
    tags: ["puzzle"],
  };

  const mapD: MapDto = {
    id: mapIdAsiaEast,
    name: "Das deutsche Labyrinth der Rätsel",
    description: "German description here",
    slug: "map-d",
    ownerId: "owner",
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    difficultyScore: 6.0,
    tags: ["puzzle"],
  };

  const candidateMaps = [mapA, mapB, mapC, mapD];

  // Validar detección de idioma en los mocks
  assert.strictEqual(detectTextLanguage(mapA.name + " " + mapA.description), "es");
  assert.strictEqual(detectTextLanguage(mapB.name + " " + mapB.description), "en");
  assert.strictEqual(detectTextLanguage(mapC.name + " " + mapC.description), "fr");
  assert.strictEqual(detectTextLanguage(mapD.name + " " + mapD.description), "de");
  console.log("✓ Detección de idioma en mocks validada correctamente.");

  // --- PRUEBA 1: FILTRADO ESTRICTO (Offline, sin DB) ---
  console.log("\n1. Probando filtrado estricto (Usuario en us-east, prefiere Español)...");
  // Cliente en "us-east" prefiere "es" (los idiomas aceptables son "es", "en")
  // Latencias desde us-east:
  // - us-east (Map A): 20ms (Pasa ping <= 200, pasa idioma "es" - OK)
  // - eu-west (Map B): 90ms (Pasa ping <= 200, pasa idioma "en" - OK)
  // - sa-east (Map C): 120ms (Pasa ping <= 200, falla idioma "fr" - FILTRADO)
  // - asia-east (Map D): 220ms (Falla ping > 200, falla idioma "de" - FILTRADO)
  // Deberían pasar solo Map A y Map B
  const filteredStrict = await applyQualityFilter(candidateMaps, null, {
    clientRegion: "us-east",
    preferredLanguage: "es",
    minItemsCount: 2, // Requiere al menos 2
  });

  const strictIds = filteredStrict.map(m => m.id);
  console.log("Resultados estricto:", strictIds);
  assert.strictEqual(filteredStrict.length, 2, "Deben quedar exactamente 2 mapas");
  assert.ok(strictIds.includes(mapIdUsEast), "Debe incluir Map A");
  assert.ok(strictIds.includes(mapIdEuWest), "Debe incluir Map B");
  assert.strictEqual(strictIds[0], mapIdUsEast, "El primer mapa debe ser Map A (idioma ideal 'es' y menor latencia)");

  // --- PRUEBA 2: RELAJACIÓN PASO 1 (Ping hasta 300ms) ---
  console.log("\n2. Probando relajación paso 1 (Filtro estricto vacía demasiado, minItemsCount = 3)...");
  // Si pedimos minItemsCount = 3 para un usuario en "us-east" que prefiere "es" (soportados "es", "en")
  // El filtro estricto devolvió 2. Relajará a ping <= 300ms.
  // Con ping <= 300ms:
  // - Map A (us-east, 20ms, es): OK
  // - Map B (eu-west, 90ms, en): OK
  // - Map C (sa-east, 120ms, fr): Falla idioma -> FILTRADO
  // - Map D (asia-east, 220ms, de): Falla ping y/o idioma -> FILTRADO
  // Espera, la relajación paso 1 mantiene el filtro de idioma, pero relaja la latencia a 300ms.
  // Pero Map C y Map D fallan idioma, por lo que relajación Paso 1 aún devuelve 2.
  // Entonces aplicará Paso 2: Relajar latencia por completo, mantener idioma. Aún devuelve 2 (Map A y Map B).
  // Finalmente aplicará Paso 3: Devolver la lista completa original de 4 mapas.
  const filteredRelaxedMax = await applyQualityFilter(candidateMaps, null, {
    clientRegion: "us-east",
    preferredLanguage: "es",
    minItemsCount: 3, // Forzamos relajación hasta el final
  });

  console.log("Resultados relajados al máximo:", filteredRelaxedMax.map(m => m.id));
  assert.strictEqual(filteredRelaxedMax.length, 4, "Debe devolver la lista completa al relajarse completamente");

  // --- PRUEBA 3: RELAJACIÓN PASO 1 CON IDIOMA ADECUADO (minItemsCount = 3, agregamos Map E con ping de 220ms e idioma 'en') ---
  console.log("\n3. Probando relajación paso 1 intermedia...");
  const mapE: MapDto = {
    id: mapIdAsiaEast, // latencia 220ms desde us-east, idioma en
    name: "The Far East Shooting Practice",
    description: "An English map located far away",
    slug: "map-e",
    ownerId: "owner",
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    difficultyScore: 4.0,
    tags: ["shooter"],
  };

  // List: Map A (20ms, es), Map B (90ms, en), Map E (220ms, en). All matching languages.
  // Strict: Map A (OK), Map B (OK), Map E (filtered because ping = 220 > 200). Length = 2.
  // minItemsCount = 3. Strict fails (2 < 3).
  // Relax step 1: Ping <= 300, matching language. Map A (OK), Map B (OK), Map E (OK because 220 <= 300). Length = 3.
  // Should stop there and return all 3!
  const filteredStep1 = await applyQualityFilter([mapA, mapB, mapE], null, {
    clientRegion: "us-east",
    preferredLanguage: "es",
    minItemsCount: 3,
  });

  const step1Ids = filteredStep1.map(m => m.id);
  console.log("Resultados relajación paso 1:", step1Ids);
  assert.strictEqual(filteredStep1.length, 3, "Deben retornar los 3 mapas");
  assert.ok(step1Ids.includes(mapIdUsEast));
  assert.ok(step1Ids.includes(mapIdEuWest));
  assert.ok(step1Ids.includes(mapIdAsiaEast));

  // --- PRUEBA 4: INTEGRACIÓN CON LA BASE DE DATOS (PlayerFeatures) ---
  console.log("\n4. Probando integración con PlayerFeatures en DB...");
  // Limpiar e insertar PlayerFeatures para el usuario de prueba
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.local`,
      username: `user_${userId}`,
      passwordHash: "pass_hash",
    }
  });

  await analyticsPrisma.playerFeatures.create({
    data: {
      userId,
      preferredLanguage: "de", // Prefiere Alemán, por ende permite "de", "en"
      lastActive: new Date(),
    }
  });

  // Candidate maps list:
  // - Map A (es, us-east, 20ms) -> No es de o en (filtrado en idioma)
  // - Map B (en, eu-west, 90ms) -> Idioma "en" (OK), ping 90ms (OK)
  // - Map D (de, asia-east, 220ms) -> Idioma "de" (OK), ping 220ms (Filtrado en strict ping)
  // Strict filter should return only Map B (length = 1).
  // If minItemsCount = 1, it should remain strict and return just Map B.
  const dbFilteredStrict = await applyQualityFilter(candidateMaps, userId, {
    clientRegion: "us-east",
    minItemsCount: 1,
  });

  console.log("Resultados DB (prefiere Alemán, minItems = 1):", dbFilteredStrict.map(m => m.id));
  assert.strictEqual(dbFilteredStrict.length, 1, "Debe quedar solo 1 mapa en estricto");
  assert.strictEqual(dbFilteredStrict[0]?.id, mapIdEuWest, "El mapa devuelto debe ser Map B (Inglés)");

  // --- 5. LIMPIEZA FINAL ---
  console.log("\n5. Limpiando datos de prueba...");
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId } });
  await analyticsPrisma.user.deleteMany({ where: { id: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DEL FILTRO DE CALIDAD PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

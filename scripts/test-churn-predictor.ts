import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import {
  computeChurnRiskForUser,
  exportAtRiskUsersToCsv
} from "../server/analytics/features/churn_predictor.js";
import assert from "assert";
import fs from "node:fs";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 33: DETECCIÓN Y SEGMENTACIÓN DE CHURN ===");

  await connectRedis();

  const activeUserId = "test-churn-act-" + Date.now();
  const newUserId = "test-churn-new-" + Date.now();
  const now = new Date();

  // Limpieza previa
  await analyticsPrisma.playerFeatures.deleteMany({
    where: { userId: { in: [activeUserId, newUserId] } }
  });
  await analyticsPrisma.rawEvent.deleteMany({
    where: { userId: { in: [activeUserId, newUserId] } }
  });
  await analyticsPrisma.user.deleteMany({
    where: { id: { in: [activeUserId, newUserId] } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: [activeUserId, newUserId] } }
  });

  console.log("\n1. Probando Caso A: Jugador Regular en Decaimiento (Riesgo de Churn Alto)...");
  
  // Registrar hace 5 días (pasa filtro de registros >= 3 días)
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await prisma.user.create({
    data: {
      id: activeUserId,
      email: `${activeUserId}@test.local`,
      username: `churn_active_${Date.now()}`,
      passwordHash: "secure_pass_hash",
      displayName: "Jugador Decaído",
      createdAt: fiveDaysAgo,
    },
  });

  try {
    await analyticsPrisma.user.create({
      data: {
        id: activeUserId,
        email: `${activeUserId}@test.local`,
        username: `churn_active_${Date.now()}`,
        createdAt: fiveDaysAgo,
        updatedAt: fiveDaysAgo,
      },
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err;
  }

  // Sembrar historial:
  // Históricas (hace 4, 3, 2 días): 3 sesiones de 7200 segundos (2 horas)
  // Recientes (hace 1 día, 12 horas, 1 hora): 3 sesiones de 300 segundos (5 minutos)
  const oneDay = 24 * 60 * 60 * 1000;
  const sessionsData = [
    // Históricas
    { time: new Date(now.getTime() - 4 * oneDay), duration: 7200 },
    { time: new Date(now.getTime() - 3 * oneDay), duration: 7200 },
    { time: new Date(now.getTime() - 2 * oneDay), duration: 7200 },
    // Recientes
    { time: new Date(now.getTime() - 1 * oneDay), duration: 300 },
    { time: new Date(now.getTime() - 12 * 60 * 60 * 1000), duration: 300 },
    { time: new Date(now.getTime() - 1 * 60 * 60 * 1000), duration: 300 },
  ];

  await analyticsPrisma.rawEvent.createMany({
    data: sessionsData.map((s, idx) => ({
      id: `session-evt-${activeUserId}-${idx}`,
      eventType: "SessionEnd",
      userId: activeUserId,
      timestamp: s.time,
      payload: {
        durationSeconds: s.duration,
        idleSeconds: 0,
        usefulSeconds: s.duration,
      },
    })),
  });

  // Correr cálculo
  const resultA = await computeChurnRiskForUser(activeUserId);
  console.log(`-> Caso A Churn Score: ${resultA.churnScore?.toFixed(4)}, atRisk: ${resultA.atRisk}`);
  
  // Math check: avgRecent = 300, avgHist = 7200. Ratio = 300/7200 = 0.0416. Score = 1 - 0.0416 = 0.9583
  assert(resultA.churnScore !== null, "El score de churn no debería ser nulo");
  assert(resultA.churnScore > 0.9, "El score de churn debería ser cercano a 0.958");
  assert.strictEqual(resultA.atRisk, true, "El usuario debería estar catalogado como at_risk");

  // Validar caché de Redis e hidratación
  const profileA = await PlayerProfileRepository.getProfile(activeUserId);
  assert.strictEqual(profileA?.atRisk, true);
  assert(profileA?.churnScore && profileA.churnScore > 0.9);

  console.log("✓ Caso A completado y verificado.");


  console.log("\n2. Probando Caso B: Regla de Exclusión de Usuarios Nuevos (< 3 días)...");

  // Registrar ahora (0 días de antigüedad)
  await prisma.user.create({
    data: {
      id: newUserId,
      email: `${newUserId}@test.local`,
      username: `churn_new_${Date.now()}`,
      passwordHash: "secure_pass_hash",
      displayName: "Jugador Nuevo",
      createdAt: now,
    },
  });

  try {
    await analyticsPrisma.user.create({
      data: {
        id: newUserId,
        email: `${newUserId}@test.local`,
        username: `churn_new_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err;
  }

  // Sembrar 5 sesiones idénticas de 7200s (cumple mínimo de 4 sesiones, pero falla la antigüedad de registro)
  await analyticsPrisma.rawEvent.createMany({
    data: Array.from({ length: 5 }).map((_, idx) => ({
      id: `session-evt-${newUserId}-${idx}`,
      eventType: "SessionEnd",
      userId: newUserId,
      timestamp: new Date(now.getTime() - idx * 60 * 60 * 1000),
      payload: {
        durationSeconds: 7200,
        idleSeconds: 0,
        usefulSeconds: 7200,
      },
    })),
  });

  const resultB = await computeChurnRiskForUser(newUserId);
  console.log(`-> Caso B Churn Score: ${resultB.churnScore}, atRisk: ${resultB.atRisk}`);
  
  assert.strictEqual(resultB.churnScore, null, "El score de churn para usuarios nuevos debe ser nulo");
  assert.strictEqual(resultB.atRisk, false, "Los usuarios nuevos no deben ser marcados como at_risk");

  // Validar caché de Redis
  const profileB = await PlayerProfileRepository.getProfile(newUserId);
  assert.strictEqual(profileB?.atRisk, false);
  assert.strictEqual(profileB?.churnScore, null);

  console.log("✓ Caso B completado y verificado.");


  console.log("\n3. Probando Exportación del Reporte CSV de Usuarios en Riesgo...");
  
  const csvPath = await exportAtRiskUsersToCsv();
  console.log(`-> Reporte CSV generado en: ${csvPath}`);
  
  assert(fs.existsSync(csvPath), "El archivo CSV debe crearse físicamente");
  const content = fs.readFileSync(csvPath, "utf8");
  assert(content.includes(activeUserId), "El CSV debe contener el ID del usuario en riesgo");
  assert(!content.includes(newUserId), "El CSV NO debe contener al usuario nuevo excluido");

  console.log("✓ Exportación de CSV verificada correctamente.");


  console.log("\n4. Limpiando datos de prueba...");
  await analyticsPrisma.playerFeatures.deleteMany({
    where: { userId: { in: [activeUserId, newUserId] } }
  });
  await analyticsPrisma.rawEvent.deleteMany({
    where: { userId: { in: [activeUserId, newUserId] } }
  });
  await analyticsPrisma.user.deleteMany({
    where: { id: { in: [activeUserId, newUserId] } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: [activeUserId, newUserId] } }
  });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
  await disconnectRedis();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DE DETECCIÓN DE CHURN PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

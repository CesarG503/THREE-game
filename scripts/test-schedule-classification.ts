import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { connectRedis, disconnectRedis } from "../server/cache/redis.js";
import { PlayerProfileRepository } from "../server/analytics/models/PlayerProfile.js";
import { classifyScheduleForUser } from "../server/analytics/features/schedule_classifier.js";
import assert from "assert";

async function run() {
  console.log("=== INICIANDO PRUEBAS FASE 34: CLASIFICACIÓN TEMPORAL DE USUARIOS ===");

  await connectRedis();

  const nightOwlId = "test-sched-owl-" + Date.now();
  const weekendWarriorId = "test-sched-war-" + Date.now();
  const lunchPlayerId = "test-sched-lun-" + Date.now();

  const allTestUserIds = [nightOwlId, weekendWarriorId, lunchPlayerId];

  // Limpieza previa
  await analyticsPrisma.playerFeatures.deleteMany({
    where: { userId: { in: allTestUserIds } }
  });
  await analyticsPrisma.rawEvent.deleteMany({
    where: { userId: { in: allTestUserIds } }
  });
  await analyticsPrisma.user.deleteMany({
    where: { id: { in: allTestUserIds } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: allTestUserIds } }
  });

  const now = new Date();
  const tzOffset = 360; // UTC-6 (6 horas detrás de UTC)
  const tzOffsetMs = tzOffset * 60 * 1000;

  // Helper para generar una fecha UTC que corresponda a un día y hora local específicos
  // (Donde 0 = Domingo, 1 = Lunes, etc.)
  function createUtcDateForLocalTime(targetDayOfWeek: number, targetLocalHour: number): Date {
    // Buscar un día de la semana que coincida con targetDayOfWeek en las últimas 2 semanas
    const date = new Date(now);
    while (date.getUTCDay() !== targetDayOfWeek) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
    date.setUTCHours(targetLocalHour, 0, 0, 0);
    // Aplicar el desfase inverso para obtener la fecha UTC real
    return new Date(date.getTime() + tzOffsetMs);
  }

  // Crear los usuarios en ambas bases de datos
  for (const id of allTestUserIds) {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@test.local`,
        username: `user_${id}`,
        passwordHash: "secure_pass_hash",
        displayName: `Test User ${id}`,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    try {
      await analyticsPrisma.user.create({
        data: {
          id,
          email: `${id}@test.local`,
          username: `user_${id}`,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }
  }

  console.log("\n1. Probando Caso: Night Owl (9 de 10 sesiones entre las 10 PM y 2 AM local)...");
  // 9 sesiones a las 11 PM (23:00) y 1 sesión a las 12 PM (12:00)
  const owlSessions: Date[] = [];
  for (let i = 0; i < 9; i++) {
    owlSessions.push(createUtcDateForLocalTime(2, 23)); // Martes a las 23:00 local
  }
  owlSessions.push(createUtcDateForLocalTime(3, 12)); // Miércoles a las 12:00 local

  await analyticsPrisma.rawEvent.createMany({
    data: owlSessions.map((date, idx) => ({
      id: `session-evt-owl-${idx}`,
      eventType: "SessionStart",
      userId: nightOwlId,
      timestamp: date,
      payload: { timezoneOffset: tzOffset },
    })),
  });

  const tagOwl = await classifyScheduleForUser(nightOwlId);
  console.log(`-> Night Owl Clasificado como: ${tagOwl}`);
  assert.strictEqual(tagOwl, "Night Owl");

  // Validar caché de Redis e hidratación
  const profileOwl = await PlayerProfileRepository.getProfile(nightOwlId);
  assert.strictEqual(profileOwl?.temporalTag, "Night Owl");
  console.log("✓ Caso Night Owl completado con éxito.");


  console.log("\n2. Probando Caso: Weekend Warrior (6 de 10 sesiones los fines de semana)...");
  // 6 sesiones en Domingo (0) o Sábado (6), y 4 en Lunes (1) a las 5 PM (17:00)
  const warSessions: Date[] = [];
  for (let i = 0; i < 3; i++) {
    warSessions.push(createUtcDateForLocalTime(6, 15)); // Sábado 15:00 local
    warSessions.push(createUtcDateForLocalTime(0, 16)); // Domingo 16:00 local
  }
  for (let i = 0; i < 4; i++) {
    warSessions.push(createUtcDateForLocalTime(1, 17)); // Lunes 17:00 local
  }

  await analyticsPrisma.rawEvent.createMany({
    data: warSessions.map((date, idx) => ({
      id: `session-evt-war-${idx}`,
      eventType: "SessionStart",
      userId: weekendWarriorId,
      timestamp: date,
      payload: { timezoneOffset: tzOffset },
    })),
  });

  const tagWar = await classifyScheduleForUser(weekendWarriorId);
  console.log(`-> Weekend Warrior Clasificado como: ${tagWar}`);
  assert.strictEqual(tagWar, "Weekend Warrior");

  // Validar caché de Redis e hidratación
  const profileWar = await PlayerProfileRepository.getProfile(weekendWarriorId);
  assert.strictEqual(profileWar?.temporalTag, "Weekend Warrior");
  console.log("✓ Caso Weekend Warrior completado con éxito.");


  console.log("\n3. Probando Caso: Daily Lunch Player (3 de 10 sesiones los días hábiles a mediodía)...");
  // 3 sesiones en Lunes (1) a las 12 PM (12:00) y 7 en Martes (2) a las 6 PM (18:00)
  // Lunch ratio = 3 / 10 = 0.3 (>= 0.20)
  const lunchSessions: Date[] = [];
  for (let i = 0; i < 3; i++) {
    lunchSessions.push(createUtcDateForLocalTime(1, 12)); // Lunes 12:00 local (almuerzo)
  }
  for (let i = 0; i < 7; i++) {
    lunchSessions.push(createUtcDateForLocalTime(2, 18)); // Martes 18:00 local (fuera de almuerzo)
  }

  await analyticsPrisma.rawEvent.createMany({
    data: lunchSessions.map((date, idx) => ({
      id: `session-evt-lun-${idx}`,
      eventType: "SessionStart",
      userId: lunchPlayerId,
      timestamp: date,
      payload: { timezoneOffset: tzOffset },
    })),
  });

  const tagLunch = await classifyScheduleForUser(lunchPlayerId);
  console.log(`-> Daily Lunch Player Clasificado como: ${tagLunch}`);
  assert.strictEqual(tagLunch, "Daily Lunch Player");

  // Validar caché de Redis e hidratación
  const profileLunch = await PlayerProfileRepository.getProfile(lunchPlayerId);
  assert.strictEqual(profileLunch?.temporalTag, "Daily Lunch Player");
  console.log("✓ Caso Daily Lunch Player completado con éxito.");


  console.log("\n4. Limpiando datos de prueba...");
  await analyticsPrisma.playerFeatures.deleteMany({
    where: { userId: { in: allTestUserIds } }
  });
  await analyticsPrisma.rawEvent.deleteMany({
    where: { userId: { in: allTestUserIds } }
  });
  await analyticsPrisma.user.deleteMany({
    where: { id: { in: allTestUserIds } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: allTestUserIds } }
  });

  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
  await disconnectRedis();

  console.log("\n✓ ¡TODAS LAS PRUEBAS DE CLASIFICACIÓN TEMPORAL PASARON EXITOSAMENTE!");
}

run().catch((err) => {
  console.error("\n✕ ERROR EN LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});

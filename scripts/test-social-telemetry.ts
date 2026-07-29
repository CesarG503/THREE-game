import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { eventBuffer } from "../server/analytics/eventBuffer.js";
import { eventWorker } from "../server/analytics/eventWorker.js";
import { validateTelemetryEvent } from "../server/analytics/middleware.js";
import { getSocialEngagement } from "../server/analytics/reports/social_engagement.js";
import "dotenv/config";
import crypto from "node:crypto";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userIds: string[], eventIds: string[]) {
  // Clean raw events
  for (const eventId of eventIds) {
    await analyticsPrisma.rawEvent.deleteMany({
      where: { id: eventId }
    });
  }

  // Clean test users
  for (const userId of userIds) {
    await analyticsPrisma.user.deleteMany({
      where: { id: userId }
    });
    await prisma.user.deleteMany({
      where: { id: userId }
    });
  }
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE TELEMETRÍA SOCIAL ===");

  const timestamp = Date.now();
  const userIdA = crypto.randomUUID();
  const userIdB = crypto.randomUUID();
  
  const userIds = [userIdA, userIdB];
  const eventIds: string[] = [];

  try {
    // 1. Limpieza inicial
    console.log("1. Limpiando datos previos...");
    await cleanUp(userIds, []);

    // 2. Crear usuarios semilla en DB operacional
    console.log("2. Creando usuarios semilla en base de datos operacional...");
    await prisma.user.create({
      data: {
        id: userIdA,
        email: `a-${timestamp}@test.local`,
        username: `user_a_${timestamp}`,
        passwordHash: "hash-a",
      }
    });

    await prisma.user.create({
      data: {
        id: userIdB,
        email: `b-${timestamp}@test.local`,
        username: `user_b_${timestamp}`,
        passwordHash: "hash-b",
      }
    });

    // 3. Replicar usuarios en DB de analíticas (si no se han replicado por disparadores de BD)
    console.log("3. Replicando usuarios en base de datos de analíticas...");
    try {
      await analyticsPrisma.user.create({
        data: {
          id: userIdA,
          email: `a-${timestamp}@test.local`,
          username: `user_a_${timestamp}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }

    try {
      await analyticsPrisma.user.create({
        data: {
          id: userIdB,
          email: `b-${timestamp}@test.local`,
          username: `user_b_${timestamp}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }

    console.log("✓ Usuarios semilla creados correctamente.");

    // 4. Validar contratos usando el validador del middleware (Ajv)
    console.log("4. Validando contratos de esquemas JSON a través del middleware...");

    const requestSentEvent = {
      id: crypto.randomUUID(),
      eventType: "FriendRequestSent",
      userId: userIdA,
      timestamp: new Date().toISOString(),
      payload: { receiverId: userIdB }
    };
    eventIds.push(requestSentEvent.id);

    const check1 = validateTelemetryEvent(requestSentEvent);
    assert(check1.valid, `FriendRequestSent falló validación: ${check1.errors?.join(", ")}`);

    const requestAcceptedEvent = {
      id: crypto.randomUUID(),
      eventType: "FriendRequestAccepted",
      userId: userIdB,
      timestamp: new Date().toISOString(),
      payload: { requestId: crypto.randomUUID(), senderId: userIdA }
    };
    eventIds.push(requestAcceptedEvent.id);

    const check2 = validateTelemetryEvent(requestAcceptedEvent);
    assert(check2.valid, `FriendRequestAccepted falló validación: ${check2.errors?.join(", ")}`);

    const gameInviteSentEvent = {
      id: crypto.randomUUID(),
      eventType: "GameInviteSent",
      userId: userIdA,
      timestamp: new Date().toISOString(),
      payload: { receiverId: userIdB, roomId: "room-123" }
    };
    eventIds.push(gameInviteSentEvent.id);

    const check3 = validateTelemetryEvent(gameInviteSentEvent);
    assert(check3.valid, `GameInviteSent falló validación: ${check3.errors?.join(", ")}`);

    const gameInviteAcceptedEvent = {
      id: crypto.randomUUID(),
      eventType: "GameInviteAccepted",
      userId: userIdB,
      timestamp: new Date().toISOString(),
      payload: { inviteId: "invite-999", senderId: userIdA, roomId: "room-123" }
    };
    eventIds.push(gameInviteAcceptedEvent.id);

    const check4 = validateTelemetryEvent(gameInviteAcceptedEvent);
    assert(check4.valid, `GameInviteAccepted falló validación: ${check4.errors?.join(", ")}`);

    console.log("✓ Todos los contratos de esquemas de analíticas son 100% válidos.");

    // 5. Simular inserción mediante EventWorker
    console.log("5. Simulando inserción de eventos mediante el EventWorker...");
    const batch = [
      {
        id: requestSentEvent.id,
        eventType: requestSentEvent.eventType,
        userId: requestSentEvent.userId,
        timestamp: new Date(requestSentEvent.timestamp),
        payload: requestSentEvent.payload
      },
      {
        id: requestAcceptedEvent.id,
        eventType: requestAcceptedEvent.eventType,
        userId: requestAcceptedEvent.userId,
        timestamp: new Date(requestAcceptedEvent.timestamp),
        payload: requestAcceptedEvent.payload
      },
      {
        id: gameInviteSentEvent.id,
        eventType: gameInviteSentEvent.eventType,
        userId: gameInviteSentEvent.userId,
        timestamp: new Date(gameInviteSentEvent.timestamp),
        payload: gameInviteSentEvent.payload
      },
      {
        id: gameInviteAcceptedEvent.id,
        eventType: gameInviteAcceptedEvent.eventType,
        userId: gameInviteAcceptedEvent.userId,
        timestamp: new Date(gameInviteAcceptedEvent.timestamp),
        payload: gameInviteAcceptedEvent.payload
      }
    ];

    await eventWorker.processBatch(batch);
    console.log("✓ Eventos insertados en base de datos analítica.");

    // 6. Verificar y Ejecutar Reportes Social Engagement
    console.log("6. Verificando cálculo de reportes agregados y CTR...");
    const report = await getSocialEngagement({ startDate: new Date(Date.now() - 60000) });
    
    console.log("Resultados del Reporte Social Engagement:", JSON.stringify(report, null, 2));

    assert(report.friendRequests.sent >= 1, "friendRequests.sent debería ser >= 1");
    assert(report.friendRequests.accepted >= 1, "friendRequests.accepted debería ser >= 1");
    assert(report.friendRequests.acceptanceRate === 100, `acceptanceRate esperado 100, obtenido: ${report.friendRequests.acceptanceRate}`);

    assert(report.gameInvites.sent >= 1, "gameInvites.sent debería ser >= 1");
    assert(report.gameInvites.accepted >= 1, "gameInvites.accepted debería ser >= 1");
    assert(report.gameInvites.conversionRate === 100, `conversionRate esperado 100, obtenido: ${report.gameInvites.conversionRate}`);

    assert(report.activeUsersCount >= 2, `activeUsersCount esperado >= 2, obtenido: ${report.activeUsersCount}`);

    console.log("✓ Métricas y CTR de Invitaciones calculados exitosamente.");

    // 7. Prueba de Privacidad PII
    console.log("7. Verificando cumplimiento de directivas de privacidad (Sanitización PII)...");
    const privacyCheckEvent = {
      id: crypto.randomUUID(),
      eventType: "FriendRequestSent",
      userId: userIdA,
      timestamp: new Date().toISOString(),
      payload: {
        receiverId: userIdB,
        email: "forbidden-email@test.com", // Campo prohibido
        ip: "192.168.1.5" // Campo anonimizado
      }
    };
    
    const checkEnvelope = validateTelemetryEvent(privacyCheckEvent);
    assert(checkEnvelope.valid, "Envelope de prueba de privacidad debería ser válido.");

    // Simular paso por el buffer (anonymizeTelemetryEvent)
    const sanitized = eventBuffer.push({
      id: privacyCheckEvent.id,
      eventType: privacyCheckEvent.eventType,
      userId: privacyCheckEvent.userId,
      timestamp: new Date(privacyCheckEvent.timestamp),
      payload: privacyCheckEvent.payload
    });
    
    assert(sanitized === true, "Evento de privacidad debería ser aceptado por el buffer.");

    // Recuperar del buffer
    const bufferedEvent = (eventBuffer as any).buffer.find((ev: any) => ev.id === privacyCheckEvent.id);
    assert(bufferedEvent !== undefined, "El evento de privacidad debería estar en el buffer.");

    // El email (PII prohibida) debe haber sido totalmente eliminado del payload
    assert(bufferedEvent.payload.email === undefined, "El email prohibido no fue eliminado por el middleware de privacidad.");
    
    // La IP debe haber sido hasheada de forma segura
    assert(bufferedEvent.payload.ip !== "192.168.1.5", "La IP no fue anonimizada por el middleware de privacidad.");
    assert(bufferedEvent.payload.ip.length === 64, "La IP anonimizada debería ser un hash SHA-256 de 64 caracteres.");
    
    console.log("✓ Cumplimiento absoluto de PII: email eliminado, IP anonimizada con hash salteado.");

    // Limpiar evento de privacidad del buffer
    eventBuffer.clear();

    // 8. Teardown
    console.log("8. Limpiando datos de prueba...");
    await cleanUp(userIds, eventIds);
    console.log("✓ Limpieza completada.");

    console.log("=== TODAS LAS PRUEBAS DE TELEMETRÍA SOCIAL PASARON CON ÉXITO ===");
    process.exit(0);

  } catch (error) {
    console.error("❌ Fallo durante la ejecución de las pruebas:", error);
    try {
      await cleanUp(userIds, eventIds);
    } catch (cleanupErr) {
      console.error("Error durante la limpieza de emergencia:", cleanupErr);
    }
    process.exit(1);
  }
}

main();

import "dotenv/config";
import { createHash } from "node:crypto";
import { anonymizeTelemetryEvent } from "../server/analytics/middleware/privacy.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { execSync } from "node:child_process";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function cleanUp(userId: string) {
  console.log("Limpiando base de datos analítica de registros de prueba...");
  
  // 1. Eliminar perfil de características del jugador (PlayerFeatures)
  await analyticsPrisma.playerFeatures.deleteMany({
    where: { userId }
  });

  // 2. Eliminar fatigas de mapas registradas
  await analyticsPrisma.fatiguedMap.deleteMany({
    where: { userId }
  });

  // 3. Eliminar afinidades sociales (donde sea userId1 o userId2)
  await analyticsPrisma.socialAffinity.deleteMany({
    where: {
      OR: [
        { userId1: userId },
        { userId2: userId }
      ]
    }
  });

  // 4. Eliminar eventos analíticos
  await analyticsPrisma.rawEvent.deleteMany({
    where: {
      OR: [
        { userId },
        { id: { startsWith: "test-priv-" } }
      ]
    }
  });

  // 5. Eliminar el registro del usuario de la réplica analítica
  await analyticsPrisma.user.deleteMany({
    where: {
      id: {
        in: [userId, "other-user-abc"]
      }
    }
  });

  // 6. Eliminar el mapa de prueba
  await analyticsPrisma.gameMap.deleteMany({
    where: { id: "dummy-map-id" }
  });
}

async function main() {
  console.log("=== INICIANDO PRUEBAS DE PRIVACIDAD Y PRIVILEGIOS DE DATOS (FASE 24) ===");

  const testUserId = "test-priv-user-123";

  try {
    // 0. Limpieza inicial
    await cleanUp(testUserId);

    // ==========================================
    // PRUEBA 1: FILTRADO DE CAMPOS PROHIBIDOS (PII)
    // ==========================================
    console.log("\nProbando filtrado de campos prohibidos...");
    const dirtyEvent = {
      id: "test-priv-evt-1",
      eventType: "PageView",
      timestamp: new Date().toISOString(),
      payload: {
        fromRoute: "/home",
        toRoute: "/lobby",
        email: "user@example.com", // Prohibido
        password: "secret_password_123", // Prohibido
        token: "token_abc123" // Prohibido
      }
    };

    const sanitizedEvent = anonymizeTelemetryEvent(dirtyEvent);
    
    assert(sanitizedEvent.payload.fromRoute === "/home", "Debería conservar campos seguros");
    assert(sanitizedEvent.payload.email === undefined, "Debería haber eliminado el campo email");
    assert(sanitizedEvent.payload.password === undefined, "Debería haber eliminado el campo password");
    assert(sanitizedEvent.payload.token === undefined, "Debería haber eliminado el campo token");
    console.log("✓ Campos prohibidos (email, password, token) eliminados correctamente.");

    // ==========================================
    // PRUEBA 2: ANONIMIZACIÓN DE IP Y DEVICE ID
    // ==========================================
    console.log("\nProbando anonimización (SHA-256 + Sal) de IP y Device ID...");
    const rawIp = "192.168.1.50";
    const rawDeviceId = "device_xyz_987";
    const salt = process.env.PRIVACY_SALT || "default-viperio-secure-salt-2026";

    const expectedIpHash = createHash("sha256").update(rawIp + salt).digest("hex");
    const expectedDeviceHash = createHash("sha256").update(rawDeviceId + salt).digest("hex");

    const identifyEvent = {
      id: "test-priv-evt-2",
      eventType: "SessionStart",
      timestamp: new Date().toISOString(),
      payload: {
        userAgent: "Mozilla",
        ip: rawIp, // Debe anonimizarse
        deviceId: rawDeviceId // Debe anonimizarse
      }
    };

    const anonymizedEvent = anonymizeTelemetryEvent(identifyEvent);

    assert(anonymizedEvent.payload.userAgent === "Mozilla", "Debería conservar campos no sensibles");
    assert(anonymizedEvent.payload.ip === expectedIpHash, `El hash de IP no coincide. Esperado: ${expectedIpHash}, Obtenido: ${anonymizedEvent.payload.ip}`);
    assert(anonymizedEvent.payload.deviceId === expectedDeviceHash, `El hash de Device ID no coincide. Esperado: ${expectedDeviceHash}, Obtenido: ${anonymizedEvent.payload.deviceId}`);
    console.log("✓ IPs e identificadores de dispositivos anonimizados determinísticamente.");

    // ==========================================
    // PRUEBA 3: DERECHO AL OLVIDO (GDPR DELETE SCRIPT)
    // ==========================================
    console.log("\nProbando script de borrado reglamentario (GDPR/ARCO)...");

    // 1. Sembrar registros de prueba para el usuario en la BD
    console.log("Sembrando registros de prueba para el usuario...");
    
    // Seed dummy map
    await analyticsPrisma.gameMap.create({
      data: {
        id: "dummy-map-id",
        slug: "dummy-map-slug",
        name: "Dummy Map",
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Seed users
    await analyticsPrisma.user.create({
      data: {
        id: testUserId,
        username: "testprivacyuser",
        email: "testprivacyuser@example.com",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    await analyticsPrisma.user.create({
      data: {
        id: "other-user-abc",
        username: "otheruser",
        email: "otheruser@example.com",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    await analyticsPrisma.playerFeatures.create({
      data: {
        userId: testUserId,
        lastActive: new Date(),
        totalPlayTime: 3600,
        matchesPlayed: 10,
        explorerRatio: 0.5
      }
    });

    await analyticsPrisma.fatiguedMap.create({
      data: {
        userId: testUserId,
        mapId: "dummy-map-id",
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    await analyticsPrisma.socialAffinity.create({
      data: {
        userId1: testUserId,
        userId2: "other-user-abc",
        affinity: 0.85
      }
    });

    await analyticsPrisma.rawEvent.create({
      data: {
        id: "test-priv-evt-3",
        eventType: "MatchJoin",
        userId: testUserId,
        timestamp: new Date(),
        payload: { roomId: "room-abc", mapId: "dummy-map-id" }
      }
    });

    // 2. Ejecutar el script CLI npx tsx scripts/gdpr-delete-user.ts <testUserId>
    console.log(`Ejecutando script de borrado para el usuario ${testUserId}...`);
    execSync(`npx tsx scripts/gdpr-delete-user.ts ${testUserId}`, { stdio: "inherit" });

    // 3. Validar borrado y anonimización en la base de datos
    const dbUser = await analyticsPrisma.user.findUnique({
      where: { id: testUserId }
    });
    assert(dbUser === null, "El registro de réplica del usuario debería estar eliminado");

    const dbFeatures = await analyticsPrisma.playerFeatures.findUnique({
      where: { userId: testUserId }
    });
    assert(dbFeatures === null, "PlayerFeatures debería haberse eliminado");

    const dbFatigue = await analyticsPrisma.fatiguedMap.findFirst({
      where: { userId: testUserId }
    });
    assert(dbFatigue === null, "Registros de FatiguedMap deberían haberse eliminado");

    const dbAffinity = await analyticsPrisma.socialAffinity.findFirst({
      where: {
        OR: [
          { userId1: testUserId },
          { userId2: testUserId }
        ]
      }
    });
    assert(dbAffinity === null, "Registros de SocialAffinity del usuario deberían haberse eliminado");

    // Validar que los eventos de RawEvent sigan existiendo pero con userId = null (Anónimos)
    const dbEvents = await analyticsPrisma.rawEvent.findMany({
      where: { id: "test-priv-evt-3" }
    });
    assert(dbEvents.length === 1, "El evento crudo debería conservarse para no corromper métricas globales");
    assert(dbEvents[0].userId === null, "El userId del evento crudo debería haber sido nulificado (anonimizado)");
    
    console.log("✓ Verificación del script de borrado GDPR exitosa.");

    // Limpieza final
    await cleanUp(testUserId);
    console.log("\n=== TODAS LAS PRUEBAS DE PRIVACIDAD DE LA FASE 24 PASARON CON ÉXITO ===");
    process.exit(0);
  } catch (error) {
    console.error("\nFAIL: Las pruebas de privacidad fallaron:", error);
    await cleanUp(testUserId);
    process.exit(1);
  }
}

main();

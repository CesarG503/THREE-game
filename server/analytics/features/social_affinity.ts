import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

interface SessionInterval {
  userId: string;
  roomId: string;
  startMs: number;
  endMs: number;
}

export async function computeSocialAffinity(startTime: Date, endTime: Date) {
  logger.info("SocialAffinity", `Starting affinity computation between ${startTime.toISOString()} and ${endTime.toISOString()}`);

  // 1. Obtener todos los MatchLeave completados en este intervalo
  const leaveEvents = await analyticsPrisma.rawEvent.findMany({
    where: {
      eventType: "MatchLeave",
      timestamp: {
        gte: startTime,
        lte: endTime,
      },
      userId: { not: null },
    },
    select: {
      userId: true,
      timestamp: true,
      payload: true,
    },
  });

  if (leaveEvents.length === 0) {
    logger.info("SocialAffinity", "No MatchLeave events found in the given window.");
    // We still should decay existing affinities!
    await applyDecayToAllAffinities(endTime);
    return;
  }

  // 2. Mapear a intervalos de tiempo
  const intervals: SessionInterval[] = [];
  for (const ev of leaveEvents) {
    const payload = ev.payload as any;
    const uid = ev.userId || payload.userId;
    if (!payload.roomId || typeof payload.durationSeconds !== "number" || !uid) continue;

    const endMs = ev.timestamp.getTime();
    const startMs = endMs - payload.durationSeconds * 1000;
    
    intervals.push({
      userId: uid,
      roomId: payload.roomId,
      startMs,
      endMs,
    });
  }

  // 3. Agrupar por roomId
  const rooms = new Map<string, SessionInterval[]>();
  for (const interval of intervals) {
    if (!rooms.has(interval.roomId)) {
      rooms.set(interval.roomId, []);
    }
    rooms.get(interval.roomId)!.push(interval);
  }

  // 4. Calcular intersecciones (CoPlayTime en segundos) por pares
  const newCoplay = new Map<string, number>();

  for (const [roomId, roomIntervals] of rooms.entries()) {
    for (let i = 0; i < roomIntervals.length; i++) {
      for (let j = i + 1; j < roomIntervals.length; j++) {
        const a = roomIntervals[i];
        const b = roomIntervals[j];

        if (a.userId === b.userId) continue; // Same user, e.g. reconnects. Ignore.

        const overlapStart = Math.max(a.startMs, b.startMs);
        const overlapEnd = Math.min(a.endMs, b.endMs);
        const overlapMs = Math.max(0, overlapEnd - overlapStart);

        if (overlapMs > 0) {
          const u1 = a.userId < b.userId ? a.userId : b.userId;
          const u2 = a.userId < b.userId ? b.userId : a.userId;
          const pairKey = `${u1}::${u2}`;

          const currentOverlap = newCoplay.get(pairKey) || 0;
          newCoplay.set(pairKey, currentOverlap + overlapMs / 1000); // Guardamos en segundos
        }
      }
    }
  }

  // 5. Aplicar decaimiento a TODOS los registros existentes (opcional pero más matemático)
  // o aplicar decaimiento AL VUELO a los registros que actualizamos.
  // Para ser precisos, aplicaremos el decaimiento a TODA la tabla una vez al día en un proceso batch, 
  // pero como este cron se podría correr más seguido, mejor decaimos al vuelo y también globalmente.
  // En este diseño: Actualizamos (Upsert) los que tuvieron actividad.
  
  await applyDecayToAllAffinities(endTime);

  // 6. Hacer Upsert de las nuevas afinidades a los pares afectados
  let updatedPairs = 0;
  for (const [pairKey, addedSeconds] of newCoplay.entries()) {
    const [userId1, userId2] = pairKey.split("::");

    // Fetch existing
    const existing = await analyticsPrisma.socialAffinity.findUnique({
      where: { userId1_userId2: { userId1, userId2 } },
    });

    let finalAffinity = addedSeconds;
    if (existing) {
      // El decaimiento ya fue aplicado por la función 'applyDecayToAllAffinities'
      // Así que solo sumamos.
      finalAffinity = existing.affinity + addedSeconds;
    }

    await analyticsPrisma.socialAffinity.upsert({
      where: { userId1_userId2: { userId1, userId2 } },
      create: {
        userId1,
        userId2,
        affinity: finalAffinity,
        updatedAt: endTime,
      },
      update: {
        affinity: finalAffinity,
        updatedAt: endTime,
      },
    });
    
    updatedPairs++;
  }

  logger.info("SocialAffinity", `Successfully processed ${updatedPairs} interacting pairs.`);
}

/**
 * Función que recorre la tabla de SocialAffinity y decae sus valores según los días transcurridos
 * desde el updatedAt. La vida media es de 7 días.
 */
export async function applyDecayToAllAffinities(now: Date) {
  // Para evitar sobrecargar la memoria con findAll, iteramos o hacemos query SQL directa.
  // Usaremos findMany con una limitación (offset/cursor) si hubiesen millones, 
  // pero para ViperIO iteraremos usando un while.
  
  const BATCH_SIZE = 500;
  let skip = 0;
  
  while (true) {
    const batch = await analyticsPrisma.socialAffinity.findMany({
      skip,
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    // Ejecutar transacciones secuenciales
    for (const record of batch) {
      const daysSince = (now.getTime() - record.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSince > 0) { // Si hay tiempo transcurrido
        const newAffinity = record.affinity * Math.pow(0.5, daysSince / 7);
        
        await analyticsPrisma.socialAffinity.update({
          where: { id: record.id },
          data: {
            affinity: newAffinity,
            updatedAt: now, // Actualizamos el reloj al momento del decaimiento
          }
        });
      }
    }

    skip += BATCH_SIZE;
  }
}

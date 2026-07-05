import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateEvent(event: {
  id: string;
  eventType: string;
  userId: string | null;
  timestamp: Date;
  payload: any;
}): ValidationResult {
  // 1. Future timestamp check (with a 5-minute clock skew buffer)
  const futureThreshold = Date.now() + 5 * 60 * 1000;
  if (event.timestamp.getTime() > futureThreshold) {
    return {
      valid: false,
      reason: `Future timestamp anomaly: ${event.timestamp.toISOString()}`,
    };
  }

  // 2. Validate payload object integrity
  if (!event.payload || typeof event.payload !== "object") {
    return {
      valid: false,
      reason: "Payload is missing or not a valid JSON object",
    };
  }

  const payload = event.payload as Record<string, any>;

  // 3. Schema rules by EventType
  switch (event.eventType) {
    case "MatchJoin":
      if (!payload.roomId || typeof payload.roomId !== "string") {
        return { valid: false, reason: "MatchJoin event missing roomId" };
      }
      if (!payload.mapId || typeof payload.mapId !== "string") {
        return { valid: false, reason: "MatchJoin event missing mapId" };
      }
      break;

    case "MatchLeave":
      if (!payload.roomId || typeof payload.roomId !== "string") {
        return { valid: false, reason: "MatchLeave event missing roomId" };
      }
      if (!payload.mapId || typeof payload.mapId !== "string") {
        return { valid: false, reason: "MatchLeave event missing mapId" };
      }
      if (typeof payload.durationSeconds !== "number" || payload.durationSeconds < 0) {
        return {
          valid: false,
          reason: `MatchLeave event has invalid durationSeconds: ${payload.durationSeconds}`,
        };
      }
      break;

    case "MatchStart":
    case "MatchEnd":
      if (!payload.roomId || typeof payload.roomId !== "string") {
        return { valid: false, reason: `${event.eventType} event missing roomId` };
      }
      if (!payload.mapId || typeof payload.mapId !== "string") {
        return { valid: false, reason: `${event.eventType} event missing mapId` };
      }
      break;

    case "PageView":
      if (!payload.toRoute || typeof payload.toRoute !== "string") {
        return { valid: false, reason: "PageView event missing toRoute" };
      }
      if (!payload.deviceType || typeof payload.deviceType !== "string") {
        return { valid: false, reason: "PageView event missing deviceType" };
      }
      break;

    case "SessionEnd":
      if (typeof payload.durationSeconds !== "number" || payload.durationSeconds < 0) {
        return {
          valid: false,
          reason: `SessionEnd event has invalid durationSeconds: ${payload.durationSeconds}`,
        };
      }
      if (typeof payload.idleSeconds !== "number" || payload.idleSeconds < 0) {
        return {
          valid: false,
          reason: `SessionEnd event has invalid idleSeconds: ${payload.idleSeconds}`,
        };
      }
      if (typeof payload.usefulSeconds !== "number" || payload.usefulSeconds < 0) {
        return {
          valid: false,
          reason: `SessionEnd event has invalid usefulSeconds: ${payload.usefulSeconds}`,
        };
      }
      break;

    default:
      // Unknown event types are allowed as long as they have valid structure,
      // but let's make sure they aren't totally empty if we require it.
      break;
  }

  return { valid: true };
}

export async function runDataQualityPipeline(lookbackHours = 24): Promise<{ scanned: number; quarantined: number }> {
  const minTimestamp = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Find all raw events in the lookback window
  const events = await analyticsPrisma.rawEvent.findMany({
    where: {
      timestamp: {
        gte: minTimestamp,
      },
    },
  });

  let quarantinedCount = 0;

  for (const event of events) {
    const check = validateEvent(event);
    if (!check.valid) {
      const reason = check.reason || "Failed validation rules";
      logger.warn(
        "DataQualityPipeline",
        `Quarantining raw event ${event.id} (${event.eventType}). Reason: ${reason}`
      );

      // Perform quarantine operations inside a transaction to prevent data loss or duplicate records
      await analyticsPrisma.$transaction([
        analyticsPrisma.dataQuarantine.create({
          data: {
            originalId: event.id,
            eventType: event.eventType,
            userId: event.userId,
            timestamp: event.timestamp,
            payload: event.payload as any,
            reason: reason,
          },
        }),
        analyticsPrisma.rawEvent.delete({
          where: {
            id_timestamp: {
              id: event.id,
              timestamp: event.timestamp,
            },
          },
        }),
      ]);

      quarantinedCount++;
    }
  }

  if (quarantinedCount > 0) {
    logger.info(
      "DataQualityPipeline",
      `Execution complete. Scanned: ${events.length}, Quarantined: ${quarantinedCount}`
    );
  }

  return {
    scanned: events.length,
    quarantined: quarantinedCount,
  };
}

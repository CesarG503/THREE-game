import { getRedis } from "../cache/redis.js";
import { analyticsPrisma } from "../db/analyticsPrisma.js";
import { logger } from "../utils/Logger.js";
import type { TelemetryEvent } from "./eventBuffer.js";
import { computeReturnIntentForUser } from "./features/return_intent.js";
import { computeScheduleProfileForUser } from "./features/schedule_profile.js";
import { metricsCollector } from "./monitoring/metricsCollector.js";
import { performance } from "node:perf_hooks";

export class EventWorker {
  private isRunning = false;
  private timerId: NodeJS.Timeout | null = null;
  private readonly REDIS_KEY = "analytics:event_queue";
  private readonly DLQ_KEY = "analytics:event_dlq";
  private readonly BATCH_SIZE = 500;
  private readonly POLL_INTERVAL = 1000; // 1s

  // Lua script to atomically pop up to N elements from the list
  private readonly POP_BATCH_LUA = `
    local len = redis.call('LLEN', KEYS[1])
    if len == 0 then
        return {}
    end
    local count = math.min(len, tonumber(ARGV[1]))
    local batch = {}
    for i=1,count do
        local val = redis.call('LPOP', KEYS[1])
        if val then
            table.insert(batch, val)
        end
    end
    return batch
  `;

  constructor() {}

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("EventWorker", "Worker started.");
    this.scheduleNextPoll();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    logger.info("EventWorker", "Worker stopped.");
  }

  private scheduleNextPoll() {
    if (!this.isRunning) return;
    this.timerId = setTimeout(() => {
      void this.pollAndProcess();
    }, this.POLL_INTERVAL);
  }

  public async pollAndProcess(): Promise<void> {
    const redis = getRedis();
    if (!redis || !redis.isOpen) {
      this.scheduleNextPoll();
      return;
    }

    try {
      // Execute Lua script to pop a batch atomically
      const batchResult = (await redis.eval(this.POP_BATCH_LUA, {
        keys: [this.REDIS_KEY],
        arguments: [this.BATCH_SIZE.toString()],
      })) as string[];

      if (batchResult && batchResult.length > 0) {
        logger.debug("EventWorker", `Popped ${batchResult.length} events from Redis.`);
        const parsedEvents: TelemetryEvent[] = batchResult.map((raw) => JSON.parse(raw));
        await this.processBatch(parsedEvents);
      }
    } catch (err) {
      logger.error("EventWorker", "Error polling or processing events", err);
    }

    this.scheduleNextPoll();
  }

  public async processBatch(events: TelemetryEvent[]): Promise<void> {
    if (events.length === 0) return;

    const startDbWrite = performance.now();
    try {
      // Attempt batch write
      await analyticsPrisma.rawEvent.createMany({
        data: events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          userId: event.userId || null,
          timestamp: new Date(event.timestamp),
          payload: event.payload,
        })),
        // If there are duplicate keys, PostgreSQL createMany will fail, and we fall back to individual inserts
      });
      logger.debug("EventWorker", `Successfully batch-inserted ${events.length} events into DB.`);
      
      // Record metrics
      for (const event of events) {
        metricsCollector.recordPersisted(event.eventType);
      }
    } catch (err) {
      logger.warn(
        "EventWorker",
        `Batch insert failed for ${events.length} events. Falling back to individual insertion.`,
        err
      );
      await this.processEventsIndividually(events);
    } finally {
      const duration = performance.now() - startDbWrite;
      metricsCollector.recordProcessingOverhead(duration);

      // Record latencies
      const latencies: number[] = [];
      for (const event of events) {
        const time = new Date(event.timestamp).getTime();
        if (!isNaN(time)) {
          latencies.push(Date.now() - time);
        }
      }
      metricsCollector.recordLatencies(latencies);
    }

    // Post-ingestion: Trigger calculations for SessionStart and SessionEnd events
    const sessionStartUserIds = new Set<string>();
    const sessionEndUserIds = new Set<string>();
    for (const event of events) {
      if (event.eventType === "SessionStart" && event.userId) {
        sessionStartUserIds.add(event.userId);
      } else if (event.eventType === "SessionEnd" && event.userId) {
        sessionEndUserIds.add(event.userId);
      }
    }

    if (sessionStartUserIds.size > 0) {
      for (const userId of sessionStartUserIds) {
        computeScheduleProfileForUser(userId).catch((err) => {
          logger.error("EventWorker", `Failed to run background schedule profiling for user ${userId}`, err);
        });
      }
    }

    if (sessionEndUserIds.size > 0) {
      for (const userId of sessionEndUserIds) {
        computeReturnIntentForUser(userId).catch((err) => {
          logger.error("EventWorker", `Failed to run background IRI calculation for user ${userId}`, err);
        });
      }
    }
  }

  private async processEventsIndividually(events: TelemetryEvent[]): Promise<void> {
    const redis = getRedis();

    for (const event of events) {
      try {
        await analyticsPrisma.rawEvent.create({
          data: {
            id: event.id,
            eventType: event.eventType,
            userId: event.userId || null,
            timestamp: new Date(event.timestamp),
            payload: event.payload,
          },
        });
        metricsCollector.recordPersisted(event.eventType);
      } catch (singleErr) {
        logger.error(
          "EventWorker",
          `Permanently failed to insert event ${event.id} of type ${event.eventType}. Sending to DLQ.`,
          singleErr
        );
        metricsCollector.recordFailed(event.eventType);
        if (redis && redis.isOpen) {
          try {
            await redis.rPush(
              this.DLQ_KEY,
              JSON.stringify({
                event,
                error: singleErr instanceof Error ? singleErr.message : String(singleErr),
                failedAt: new Date().toISOString(),
              })
            );
          } catch (dlqErr) {
            logger.error("EventWorker", `Failed to write event ${event.id} to DLQ!`, dlqErr);
          }
        }
      }
    }
  }
}

export const eventWorker = new EventWorker();

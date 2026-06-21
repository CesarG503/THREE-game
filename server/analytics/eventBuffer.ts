import { getRedis } from "../cache/redis.js";
import { logger } from "../utils/Logger.js";

export interface TelemetryEvent {
  id: string;
  eventType: string;
  userId?: string | null;
  timestamp: Date;
  payload: any;
}

export class EventBuffer {
  private buffer: TelemetryEvent[] = [];
  private readonly maxBufferSize = 5000;
  private flushIntervalId: NodeJS.Timeout | null = null;
  private readonly REDIS_KEY = "analytics:event_queue";

  constructor() {}

  public start(intervalMs: number = 500) {
    if (this.flushIntervalId) return;
    this.flushIntervalId = setInterval(() => {
      void this.flush();
    }, intervalMs);
  }

  public stop() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  public push(event: TelemetryEvent): boolean {
    if (this.buffer.length >= this.maxBufferSize) {
      logger.error(
        "EventBuffer",
        `Backpressure limit reached (${this.maxBufferSize} events). Dropping event ${event.id} of type ${event.eventType}.`
      );
      return false;
    }
    this.buffer.push(event);
    return true;
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const redis = getRedis();
    if (!redis || !redis.isOpen) {
      logger.warn(
        "EventBuffer",
        `Redis client not connected. Retaining ${this.buffer.length} events in memory.`
      );
      return;
    }

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      const serializedEvents = eventsToFlush.map((event) =>
        JSON.stringify({
          ...event,
          // Ensure timestamp is serialized consistently
          timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
        })
      );
      await redis.rPush(this.REDIS_KEY, serializedEvents);
      logger.debug("EventBuffer", `Flushed ${eventsToFlush.length} events to Redis.`);
    } catch (err) {
      logger.error(
        "EventBuffer",
        `Failed to flush events to Redis. Re-queueing ${eventsToFlush.length} events.`,
        err
      );
      // Re-queue events up to buffer capacity
      const availableSpace = this.maxBufferSize - this.buffer.length;
      const eventsToRequeue = eventsToFlush.slice(0, availableSpace);
      this.buffer = [...eventsToRequeue, ...this.buffer];
    }
  }

  public getLength(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer = [];
  }
}

export const eventBuffer = new EventBuffer();

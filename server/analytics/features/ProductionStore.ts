import { createClient } from "@redis/client";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

export type RedisClient = ReturnType<typeof createClient>;

export class ProductionFeatureStore {
  private redis: RedisClient | null = null;
  private connectPromise: Promise<RedisClient | null> | null = null;
  private readonly REDIS_PREFIX = "analytics:features:user:";

  constructor() {}

  /**
   * Retrieves the current Redis connection client.
   */
  public getClient(): RedisClient | null {
    return this.redis;
  }

  /**
   * Establishes connection to the dedicated analytics Redis cache.
   */
  public async connect(): Promise<RedisClient | null> {
    if (this.redis?.isOpen) return this.redis;
    if (this.connectPromise) return this.connectPromise;

    // Dedicated cluster connection URL with fallback to standard Redis URL
    const url = process.env.ANALYTICS_REDIS_URL || process.env.REDIS_URL;
    if (!url) {
      logger.warn("ProductionFeatureStore", "Neither ANALYTICS_REDIS_URL nor REDIS_URL configured; cache is disabled.");
      return null;
    }

    this.redis = createClient({
      url,
      socket: {
        reconnectStrategy: false,
      },
    });

    this.redis.on("error", (err) => {
      // Keep this handler to prevent unhandled node exceptions on socket drops
      logger.error("ProductionFeatureStore", "Redis client connection error", err);
    });

    this.connectPromise = this.redis.connect()
      .then(() => {
        logger.info("ProductionFeatureStore", `Connected to high-speed analytics cache at ${url}`);
        return this.redis;
      })
      .catch((err) => {
        logger.warn("ProductionFeatureStore", "Unable to connect to analytics cache; falling back to DB direct queries.", err);
        this.redis = null;
        return null;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  /**
   * Closes active connection client.
   */
  public async disconnect(): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.quit();
    }
    this.redis = null;
    logger.info("ProductionFeatureStore", "Closed analytics cache connection.");
  }

  /**
   * Reads player features from Redis cache with a direct fallback to PostgreSQL.
   */
  public async getPlayerFeatures(userId: string): Promise<any | null> {
    const key = `${this.REDIS_PREFIX}${userId}`;

    // 1. Try reading from high-speed Redis Hash cache
    try {
      const client = await this.connect();
      if (client && client.isOpen) {
        const hash = await client.hGetAll(key);
        if (hash && Object.keys(hash).length > 0) {
          logger.debug("ProductionFeatureStore", `Cache HIT for user ${userId}`);
          return this.deserialize(hash);
        }
        logger.debug("ProductionFeatureStore", `Cache MISS for user ${userId}`);
      }
    } catch (err) {
      logger.warn("ProductionFeatureStore", `Failed to read from cache for user ${userId}; falling back to database.`, err);
    }

    // 2. Fallback to operational database
    try {
      const dbFeatures = await analyticsPrisma.playerFeatures.findUnique({
        where: { userId },
      });

      if (dbFeatures) {
        // Asynchronously populate Redis cache for future hits
        this.writeToRedisBackground(userId, dbFeatures);
      }
      return dbFeatures;
    } catch (dbErr) {
      logger.error("ProductionFeatureStore", `Failed database query for player features: ${userId}`, dbErr);
      throw dbErr;
    }
  }

  /**
   * Performs dual writes to PostgreSQL and the high-speed Redis cache.
   */
  public async setPlayerFeatures(userId: string, data: any): Promise<any> {
    // 1. Write/Upsert in persistent storage (PostgreSQL)
    const dbFeatures = await analyticsPrisma.playerFeatures.upsert({
      where: { userId },
      create: {
        userId,
        lastActive: new Date(),
        ...data,
      },
      update: {
        ...data,
      },
    });

    // 2. Sync values into Redis cache
    const key = `${this.REDIS_PREFIX}${userId}`;
    const hash = this.serialize(dbFeatures);
    try {
      const client = await this.connect();
      if (client && client.isOpen) {
        await client.hSet(key, hash);
        await client.expire(key, 3600); // 1 hour TTL
        logger.debug("ProductionFeatureStore", `Synced user features to Redis Hash for ${userId}`);
      }
    } catch (err) {
      logger.warn("ProductionFeatureStore", `Failed to write features to Redis cache for ${userId}. DB remains primary.`, err);
    }

    return dbFeatures;
  }

  /**
   * Force synchronizes the Redis cache with the current database state.
   */
  public async syncToRedis(userId: string): Promise<void> {
    try {
      const dbFeatures = await analyticsPrisma.playerFeatures.findUnique({
        where: { userId },
      });
      if (dbFeatures) {
        const key = `${this.REDIS_PREFIX}${userId}`;
        const hash = this.serialize(dbFeatures);
        const client = await this.connect();
        if (client && client.isOpen) {
          await client.hSet(key, hash);
          await client.expire(key, 3600);
          logger.debug("ProductionFeatureStore", `Forced sync to Redis cache for user ${userId}`);
        }
      }
    } catch (err) {
      logger.warn("ProductionFeatureStore", `Failed forced Redis cache sync for user ${userId}`, err);
    }
  }

  /**
   * Helper to write records to Redis cache in the background.
   */
  private writeToRedisBackground(userId: string, features: any): void {
    const key = `${this.REDIS_PREFIX}${userId}`;
    const hash = this.serialize(features);

    this.connect()
      .then(async (client) => {
        if (client && client.isOpen) {
          await client.hSet(key, hash);
          await client.expire(key, 3600);
        }
      })
      .catch((err) => {
        logger.warn("ProductionFeatureStore", `Failed background write-back cache for ${userId}`, err);
      });
  }

  /**
   * Serializes a JavaScript object into a flat string record for Redis HSET.
   */
  private serialize(features: any): Record<string, string> {
    const hash: Record<string, string> = {};
    for (const key of Object.keys(features)) {
      const val = features[key];
      if (val === null || val === undefined) {
        hash[key] = "null";
      } else if (val instanceof Date) {
        hash[key] = val.toISOString();
      } else if (typeof val === "object") {
        hash[key] = JSON.stringify(val);
      } else {
        hash[key] = String(val);
      }
    }
    return hash;
  }

  /**
   * Deserializes flat string records from HGETALL back into their typed fields.
   */
  private deserialize(hash: Record<string, string>): any {
    const features: any = {};
    for (const key of Object.keys(hash)) {
      const val = hash[key];
      if (val === "null") {
        features[key] = null;
        continue;
      }

      if (key === "userId" || key === "temporalTag" || key === "playerProfile" || key === "clusterId") {
        features[key] = val;
      } else if (key === "lastActive") {
        features[key] = new Date(val);
      } else if (key === "totalPlayTime" || key === "explorerRatio" || key === "popularitySensitivity" || key === "returnIntent" || key === "churnScore") {
        features[key] = parseFloat(val);
      } else if (key === "matchesPlayed" || key === "matchesWon") {
        features[key] = parseInt(val, 10);
      } else if (key === "atRisk") {
        features[key] = val === "true";
      } else if (key === "scheduleProfile" || key === "archetypeWeights" || key === "collaborativeEmbedding") {
        try {
          features[key] = JSON.parse(val);
        } catch {
          features[key] = val;
        }
      } else {
        features[key] = val;
      }
    }
    return features;
  }
}

export const productionFeatureStore = new ProductionFeatureStore();

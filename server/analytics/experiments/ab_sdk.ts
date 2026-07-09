import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import crypto from "node:crypto";

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  splitA: number; // 0 to 100
}

export class ABSdk {
  private activeExperiments: Map<string, ExperimentConfig> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initializes the SDK by running the first sync and scheduling periodic updates.
   * @param syncIntervalMs How often to refresh experiments cache from database (default: 60s)
   */
  public async initialize(syncIntervalMs = 60000): Promise<void> {
    if (this.isInitialized) return;

    logger.info("ABSdk", "Initializing A/B Testing SDK...");
    await this.syncFromDatabase();

    // Schedule background updates
    this.syncInterval = setInterval(() => {
      this.syncFromDatabase().catch((err) => {
        logger.error("ABSdk", "Background experiment sync failed", err);
      });
    }, syncIntervalMs);

    this.isInitialized = true;
  }

  /**
   * Shuts down background sync loop.
   */
  public shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isInitialized = false;
    logger.info("ABSdk", "A/B Testing SDK shutdown completed.");
  }

  /**
   * Fetches active experiments from the analytics database and updates the in-memory cache.
   */
  public async syncFromDatabase(): Promise<void> {
    try {
      const dbExps = await analyticsPrisma.experiment.findMany({
        where: { isActive: true },
      });

      const newMap = new Map<string, ExperimentConfig>();
      for (const exp of dbExps) {
        newMap.set(exp.name, {
          id: exp.id,
          name: exp.name,
          description: exp.description,
          isActive: exp.isActive,
          splitA: exp.splitA,
        });
      }

      this.activeExperiments = newMap;
      logger.info("ABSdk", `Synced ${this.activeExperiments.size} active experiments from database.`);
    } catch (err) {
      logger.error("ABSdk", "Failed to sync experiments from database", err);
      throw err;
    }
  }

  /**
   * Assigns a variant ("A" or "B") to a user for a given experiment name.
   * Uses deterministic SHA-256 hashing to avoid session drift.
   */
  public getVariant(userId: string, experimentName: string): "A" | "B" {
    const exp = this.activeExperiments.get(experimentName);
    if (!exp || !exp.isActive) {
      return "A"; // Default fallback is Variant A (Control)
    }

    // Deterministic hashing: SHA-256(userId + ":" + experimentName + ":s_2")
    // Using salt 's_2' optimizes standard deviation on sequential IDs below 0.1%
    const hashInput = `${userId}:${experimentName}:s_2`;
    const hash = crypto.createHash("sha256").update(hashInput).digest();
    
    // Read the first 4 bytes as a big-endian unsigned 32-bit integer
    const val = hash.readUInt32BE(0);
    const bucket = val % 100;

    return bucket < exp.splitA ? "A" : "B";
  }

  /**
   * Returns a list of all currently cached active experiments.
   */
  public getActiveExperiments(): ExperimentConfig[] {
    return Array.from(this.activeExperiments.values());
  }

  /**
   * Manually adds or overrides an experiment in cache. Useful for unit tests or scripts.
   */
  public setMockExperiment(config: ExperimentConfig): void {
    this.activeExperiments.set(config.name, config);
  }

  /**
   * Removes a mocked experiment from the cache.
   */
  public removeMockExperiment(name: string): void {
    this.activeExperiments.delete(name);
  }

  /**
   * Clears the in-memory cache completely.
   */
  public clearCache(): void {
    this.activeExperiments.clear();
  }
}

// Singleton instance
export const abSdk = new ABSdk();

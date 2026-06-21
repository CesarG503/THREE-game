import "dotenv/config"
import { PrismaClient as AnalyticsPrismaClient } from "../../src/generated/analytics-client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForAnalytics = globalThis as unknown as {
  analyticsPrisma?: AnalyticsPrismaClient;
};

const connectionString = process.env.ANALYTICS_DATABASE_URL;

if (!connectionString) {
  throw new Error("ANALYTICS_DATABASE_URL is required to initialize Analytics Prisma");
}

const adapter = new PrismaPg(connectionString);

export const analyticsPrisma =
  globalForAnalytics.analyticsPrisma ??
  new AnalyticsPrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForAnalytics.analyticsPrisma = analyticsPrisma;
}

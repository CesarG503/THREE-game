import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

async function main() {
  const connectionString = process.env.ANALYTICS_DATABASE_URL;
  if (!connectionString) {
    throw new Error("ANALYTICS_DATABASE_URL is not defined in environment variables");
  }

  console.log("Connecting to PostgreSQL to run analytics setup...");
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const sqlPath = path.join(process.cwd(), "prisma", "analytics_init.sql");
    console.log(`Reading initialization SQL from: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Applying schema, partitions, and triggers...");
    await client.query(sql);
    console.log("Analytics database infrastructure setup successfully!");
  } catch (error) {
    console.error("Failed to set up analytics database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();

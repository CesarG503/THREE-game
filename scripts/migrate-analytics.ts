import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

export async function runMigrations(migrationsDir: string, databaseUrl?: string) {
  const url = databaseUrl || process.env.ANALYTICS_DATABASE_URL;
  if (!url) {
    throw new Error("Analytics database URL is not defined");
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // 1. Ensure MigrationHistory table exists
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS analytics;
      CREATE TABLE IF NOT EXISTS analytics."MigrationHistory" (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read migration files
    if (!fs.existsSync(migrationsDir)) {
      console.log(`Migrations directory '${migrationsDir}' does not exist. Skipping...`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Alphabetic sort ensures correct ordering

    console.log(`Found ${files.length} migration files in ${migrationsDir}`);

    // 3. Apply migrations in sequence
    for (const file of files) {
      const checkRes = await client.query(
        'SELECT count(*) FROM analytics."MigrationHistory" WHERE name = $1',
        [file]
      );
      const isApplied = parseInt(checkRes.rows[0].count, 10) > 0;

      if (!isApplied) {
        console.log(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf8");

        // Execute in transaction
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO analytics."MigrationHistory" (name) VALUES ($1)',
            [file]
          );
          await client.query("COMMIT");
          console.log(`✓ Migration successfully applied: ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`✕ Migration failed and rolled back: ${file}`);
          throw err;
        }
      } else {
        console.log(`Migration already applied: ${file} (skipped)`);
      }
    }
    console.log("Analytics migrations sync complete!");
  } finally {
    await client.end();
  }
}

async function main() {
  // If run directly from command line
  const isDirectRun = process.argv[1] && (
    process.argv[1].endsWith("migrate-analytics.ts") || 
    process.argv[1].endsWith("migrate-analytics.js")
  );

  if (isDirectRun) {
    const defaultDir = path.join(process.cwd(), "prisma", "analytics_migrations");
    try {
      await runMigrations(defaultDir);
      process.exit(0);
    } catch (error) {
      console.error("Migration execution failed:", error);
      process.exit(1);
    }
  }
}

void main();

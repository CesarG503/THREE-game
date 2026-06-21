import { runMigrations } from "./migrate-analytics.js";
import { prisma } from "../server/db/prisma.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const testDir = path.join(process.cwd(), "prisma", "analytics_migrations_test");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== STARTING CONCURRENT MIGRATION TESTS ===");

  const testUserId = "migration-test-user-777";
  const testMapId = "migration-test-map-666";
  let active = true;
  let writeErrors = 0;
  let readErrors = 0;
  let successfulWrites = 0;
  let successfulReads = 0;

  try {
    // 1. Clean up potential old test state
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    await cleanUp(testUserId, testMapId);

    // Setup base User so PlayerFeatures has a foreign key target
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "migration@example.com",
        username: "migration_tester",
        passwordHash: "dummyhash",
      },
    });
    console.log("✓ Test User setup and replicated.");

    // Ensure PlayerFeatures row exists
    await analyticsPrisma.playerFeatures.create({
      data: {
        userId: testUserId,
        lastActive: new Date(),
        matchesPlayed: 0,
        totalPlayTime: 0,
      },
    });

    // Write migration files
    const expandFile = "0001_test_expand.sql";
    const contractFile = "0002_test_contract.sql";

    fs.writeFileSync(
      path.join(testDir, expandFile),
      `ALTER TABLE analytics."PlayerFeatures" ADD COLUMN IF NOT EXISTS "deviceType" TEXT DEFAULT 'desktop';`
    );
    fs.writeFileSync(
      path.join(testDir, contractFile),
      `ALTER TABLE analytics."PlayerFeatures" DROP COLUMN IF EXISTS "deviceType";`
    );

    // 2. Start concurrent read/write loops
    console.log("\nStarting concurrent read/write operations on PlayerFeatures...");
    
    const writeLoop = async () => {
      while (active) {
        try {
          await analyticsPrisma.playerFeatures.update({
            where: { userId: testUserId },
            data: {
              lastActive: new Date(),
              matchesPlayed: { increment: 1 },
            },
          });
          successfulWrites++;
        } catch (err) {
          console.error("Write error:", err);
          writeErrors++;
        }
        await sleep(5); // fast updates
      }
    };

    const readLoop = async () => {
      while (active) {
        try {
          await analyticsPrisma.playerFeatures.findUnique({
            where: { userId: testUserId },
          });
          successfulReads++;
        } catch (err) {
          console.error("Read error:", err);
          readErrors++;
        }
        await sleep(5); // fast reads
      }
    };

    // Launch loops asynchronously
    const writePromise = writeLoop();
    const readPromise = readLoop();

    // Give loops a head start
    await sleep(200);

    // 3. Apply 0001_test_expand.sql migration concurrently
    console.log(`\n[EXPAND PHASE] Applying ${expandFile} migration concurrently...`);
    // Run the migration runner only for file 1 by renaming/removing file 2 temporarily
    fs.renameSync(path.join(testDir, contractFile), path.join(testDir, contractFile + ".tmp"));
    
    await runMigrations(testDir);
    
    // Check if new column exists in DB
    const pgClient = new pg.Client({ connectionString: process.env.ANALYTICS_DATABASE_URL });
    await pgClient.connect();
    
    const colCheck = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'analytics' 
        AND table_name = 'PlayerFeatures' 
        AND column_name = 'deviceType';
    `);
    
    if (colCheck.rows.length !== 1) {
      throw new Error("FAIL: New column 'deviceType' was not created by migration.");
    }
    console.log("✓ Verified column 'deviceType' exists in PostgreSQL catalog.");

    // Restore contract file for next step
    fs.renameSync(path.join(testDir, contractFile + ".tmp"), path.join(testDir, contractFile));

    // 4. Apply 0002_test_contract.sql migration concurrently
    console.log(`\n[CONTRACT PHASE] Applying ${contractFile} migration concurrently...`);
    await runMigrations(testDir);

    const colCheck2 = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'analytics' 
        AND table_name = 'PlayerFeatures' 
        AND column_name = 'deviceType';
    `);
    await pgClient.end();

    if (colCheck2.rows.length !== 0) {
      throw new Error("FAIL: Column 'deviceType' was not dropped by contract migration.");
    }
    console.log("✓ Verified column 'deviceType' was dropped from PostgreSQL catalog.");

    // Stop loops
    active = false;
    await Promise.all([writePromise, readPromise]);

    console.log("\nConcurrency statistics:");
    console.log(`- Successful concurrent writes: ${successfulWrites}`);
    console.log(`- Successful concurrent reads: ${successfulReads}`);
    console.log(`- Write errors: ${writeErrors}`);
    console.log(`- Read errors: ${readErrors}`);

    if (writeErrors > 0 || readErrors > 0) {
      throw new Error(`FAIL: Migration caused ${writeErrors} write errors and ${readErrors} read errors.`);
    }
    console.log("✓ Zero-downtime execution validated successfully! 0% error rate reached.");

    // 5. Clean up
    console.log("\nCleaning up test residue...");
    await cleanUp(testUserId, testMapId);
    
    // Clean up temporary MigrationHistory entries for these tests
    const cleanupClient = new pg.Client({ connectionString: process.env.ANALYTICS_DATABASE_URL });
    await cleanupClient.connect();
    await cleanupClient.query(`
      DELETE FROM analytics."MigrationHistory" WHERE name IN ($1, $2);
    `, [expandFile, contractFile]);
    await cleanupClient.end();

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    console.log("✓ Clean up completed.");
    console.log("\n=== ALL MIGRATION TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("\n!!! MIGRATION TESTS FAILED !!!", error);
    active = false;
    await cleanUp(testUserId, testMapId).catch(() => {});
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}

async function cleanUp(userId: string, mapId: string) {
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId } });
  await analyticsPrisma.rawEvent.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

void main();

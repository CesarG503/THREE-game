import { computeExplorerProfile } from "../server/analytics/features/explorer_ratio.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";

async function run() {
  const now = new Date();
  
  const user1 = "test-u1-" + Date.now(); // Repeater
  const user2 = "test-u2-" + Date.now(); // Explorer

  console.log("Setting up DB states...");
  // Cleanup from previous tests if any
  await analyticsPrisma.user.deleteMany({ where: { id: { startsWith: "test-u" } } });
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { startsWith: "test-u" } } });
  await analyticsPrisma.$executeRaw`DELETE FROM analytics."RawEvent" WHERE payload->>'userId' LIKE 'test-u%'`;

  // 1. Insert users strictly in public, then in analytics to ensure both are covered
  for (const u of [
    { id: user1, email: `${user1}@test.local`, username: `u1-${Date.now()}` },
    { id: user2, email: `${user2}@test.local`, username: `u2-${Date.now()}` },
  ]) {
    await prisma.user.create({ data: { ...u, passwordHash: "dummy" } });
    try {
      await analyticsPrisma.user.create({ data: { ...u, createdAt: now, updatedAt: now } });
    } catch(e: any) {
      if (e.code !== 'P2002') throw e; // P2002 is UniqueConstraintViolation (means trigger worked)
    }
  }

  // 2. Inject RawEvents (Mocked in memory to avoid cross-schema FK issues)
  const events: any[] = [];

  // U1 (Repeater): 10 matches on Map A
  for (let i = 0; i < 10; i++) {
    events.push({
      userId: user1,
      eventType: "MatchJoin",
      timestamp: new Date(now.getTime() - i * 1000), // Slightly different times
      payload: { mapId: "map-A" }
    });
  }

  // U2 (Explorer): 10 matches on 10 DIFFERENT maps
  for (let i = 0; i < 10; i++) {
    events.push({
      userId: user2,
      eventType: "MatchJoin",
      timestamp: new Date(now.getTime() - i * 1000),
      payload: { mapId: `map-diff-${i}` }
    });
  }

  // Monkey-patch findMany to serve our in-memory events
  const originalFindMany = analyticsPrisma.rawEvent.findMany;
  analyticsPrisma.rawEvent.findMany = (async () => events) as any;

  console.log("Events injected. Running offline compute script (7 days lookback)...");
  await computeExplorerProfile(7);

  // 3. Check results
  const pf1 = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: user1 } });
  const pf2 = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: user2 } });

  console.log(`\nResults for Repeater (Expected E=0, Profile=Repeater):`);
  console.log(`ExplorerRatio: ${pf1?.explorerRatio}, Profile: ${pf1?.playerProfile}`);
  if (pf1?.playerProfile !== "Repeater" || pf1?.explorerRatio !== 0) {
    throw new Error("Validation failed for Repeater profile");
  }

  console.log(`\nResults for Explorer (Expected E>3, Profile=Explorer):`);
  console.log(`ExplorerRatio: ${pf2?.explorerRatio}, Profile: ${pf2?.playerProfile}`);
  if (pf2?.playerProfile !== "Explorer" || (pf2?.explorerRatio || 0) < 3.0) {
    throw new Error("Validation failed for Explorer profile");
  }

  // Cleanup
  console.log("\nTests passed! Cleaning up...");
  analyticsPrisma.rawEvent.findMany = originalFindMany;
  await prisma.user.deleteMany({ where: { id: { in: [user1, user2] } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: [user1, user2] } } });
  
  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

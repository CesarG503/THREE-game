import { computeSocialAffinity, applyDecayToAllAffinities } from "../server/analytics/features/social_affinity.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";

async function run() {
  const now = new Date();
  
  const user1 = "test-u1-" + Date.now();
  const user2 = "test-u2-" + Date.now();
  const user3 = "test-u3-" + Date.now(); // Isolated user

  // 0. Cleanup from previous failed runs
  await analyticsPrisma.user.deleteMany({
    where: { id: { startsWith: "test-u" } }
  });

  // 1. Force insert users using pure raw SQL into analytics schema
  for (const u of [
    { id: user1, email: `${user1}@test.local`, username: `u1-${Date.now()}` },
    { id: user2, email: `${user2}@test.local`, username: `u2-${Date.now()}` },
    { id: user3, email: `${user3}@test.local`, username: `u3-${Date.now()}` },
  ]) {
    await analyticsPrisma.$executeRaw`
      INSERT INTO analytics."User" (id, email, username, "createdAt", "updatedAt")
      VALUES (${u.id}, ${u.email}, ${u.username}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // 2. Inject RawEvents directly in analytics DB
  const roomId = "room-test-" + Date.now();
  const mapId = "map-test-" + Date.now();

  const events = [
    // U1 and U2 play together for 5 minutes (300 seconds)
    {
      eventType: "MatchLeave",
      userId: user1,
      timestamp: now,
      payload: { roomId, mapId, durationSeconds: 300 }
    },
    {
      eventType: "MatchLeave",
      userId: user2,
      timestamp: now,
      payload: { roomId, mapId, durationSeconds: 300 }
    },
    // U3 plays alone in another room
    {
      eventType: "MatchLeave",
      userId: user3,
      timestamp: now,
      payload: { roomId: "room-lonely", mapId, durationSeconds: 600 }
    }
  ];

  for (const ev of events) {
    await analyticsPrisma.rawEvent.create({ data: ev });
  }

  console.log("Events injected. Running offline compute script...");
  const lookbackStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // Add 1 second to end time to safely include the 'now' events
  await computeSocialAffinity(lookbackStart, new Date(now.getTime() + 1000));

  // 3. Check results
  const getAffinity = async (uA: string, uB: string) => {
    const minId = uA < uB ? uA : uB;
    const maxId = uA < uB ? uB : uA;
    const rec = await analyticsPrisma.socialAffinity.findUnique({
      where: { userId1_userId2: { userId1: minId, userId2: maxId } }
    });
    return rec?.affinity || 0;
  };

  const affinity12 = await getAffinity(user1, user2);
  console.log(`Affinity between U1 and U2: ${affinity12} (expected 300)`);
  if (affinity12 !== 300) throw new Error("Validation failed for U1 and U2");

  const affinity13 = await getAffinity(user1, user3);
  console.log(`Affinity between U1 and U3: ${affinity13} (expected 0)`);
  if (affinity13 !== 0) throw new Error("Validation failed for U1 and U3");

  // 4. Test exponential decay
  console.log("Simulating 7 days passed...");
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await applyDecayToAllAffinities(future);

  const decayedAffinity = await getAffinity(user1, user2);
  console.log(`Decayed Affinity (after 7 days): ${decayedAffinity} (expected ~150)`);
  
  if (decayedAffinity > 151 || decayedAffinity < 149) {
    throw new Error("Decay logic failed. Result was: " + decayedAffinity);
  }

  // Cleanup
  console.log("Tests passed! Cleaning up...");
  await prisma.user.deleteMany({ where: { id: { in: [user1, user2, user3] } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: [user1, user2, user3] } } });
  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { computePopularitySensitivity } from "../server/analytics/features/popularity_sensitivity.js";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { prisma } from "../server/db/prisma.js";

async function run() {
  const now = new Date();
  
  const userMainstream = "test-u-main-" + Date.now();
  const userNiche = "test-u-niche-" + Date.now();

  console.log("Setting up DB states...");
  await analyticsPrisma.playerFeatures.deleteMany({ where: { userId: { startsWith: "test-u-" } } });

  for (const u of [
    { id: userMainstream, email: `${userMainstream}@test.local`, username: `um-${Date.now()}` },
    { id: userNiche, email: `${userNiche}@test.local`, username: `un-${Date.now()}` },
  ]) {
    await prisma.user.create({ data: { ...u, passwordHash: "dummy" } });
    try {
      await analyticsPrisma.user.create({ data: { ...u, createdAt: now, updatedAt: now } });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }
  }

  // MOCK MAPS POPULARITY (Map C = 0.0, Map B = 0.5, Map A = 1.0 percentiles)
  const mockedMaps = [
    { mapId: "map-C", totalJoins: 10 },
    { mapId: "map-B", totalJoins: 500 },
    { mapId: "map-A", totalJoins: 10000 },
  ];

  // MOCK CLICKS
  const mockedClicks: any[] = [
    // El usuario mainstream ve el mapa A (viral) en la posición 0 y le hace clic.
    // También ve el mapa C (nicho) en la posición 9 y le hace clic.
    // Esperado: Sesgo a favor del primer clic. ISP alto.
    { userId: userMainstream, timestamp: now, payload: { elementType: "MapCard", elementId: "map-A", catalogPosition: 0 } },
    { userId: userMainstream, timestamp: now, payload: { elementType: "MapCard", elementId: "map-C", catalogPosition: 9 } },

    // El usuario de nicho explora a la inversa.
    // Ve el mapa A (viral) en la posición 9 y le hace clic.
    // Ve el mapa C (nicho) en la posición 0 y le hace clic.
    // Esperado: Ignoró lo mainstream, prefirió su nicho. ISP bajo.
    { userId: userNiche, timestamp: now, payload: { elementType: "MapCard", elementId: "map-A", catalogPosition: 9 } },
    { userId: userNiche, timestamp: now, payload: { elementType: "MapCard", elementId: "map-C", catalogPosition: 0 } },
  ];

  // Monkey-patch Prisma para simular el catálogo real
  const originalMapFind = analyticsPrisma.mapFeatures.findMany;
  const originalRawFind = analyticsPrisma.rawEvent.findMany;

  analyticsPrisma.mapFeatures.findMany = (async () => mockedMaps) as any;
  analyticsPrisma.rawEvent.findMany = (async () => mockedClicks) as any;

  console.log("Mocks injected. Running offline popularity sensitivity compute script...");
  await computePopularitySensitivity(7);

  // Restore mocks
  analyticsPrisma.mapFeatures.findMany = originalMapFind;
  analyticsPrisma.rawEvent.findMany = originalRawFind;

  // Check results
  const pfM = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: userMainstream } });
  const pfN = await analyticsPrisma.playerFeatures.findUnique({ where: { userId: userNiche } });

  console.log(`\nResults for Mainstream User:`);
  console.log(`ISP: ${pfM?.popularitySensitivity}`);
  
  console.log(`\nResults for Niche User:`);
  console.log(`ISP: ${pfN?.popularitySensitivity}`);

  if (!pfM || !pfN || pfM.popularitySensitivity! <= pfN.popularitySensitivity!) {
    throw new Error("Validation failed. Mainstream user should have a higher ISP than Niche user.");
  }

  // El matemático: 
  // ISP Mainstream: ((1.0 * 1/1) + (0.0 * 1/10)) / (1 + 0.1) = 1.0 / 1.1 = 0.909
  // ISP Niche: ((1.0 * 1/10) + (0.0 * 1/1)) / (1 + 0.1) = 0.1 / 1.1 = 0.0909
  if (Math.abs(pfM.popularitySensitivity! - 0.909) > 0.01) throw new Error("Mainstream math is wrong");
  if (Math.abs(pfN.popularitySensitivity! - 0.090) > 0.01) throw new Error("Niche math is wrong");

  // Cleanup
  console.log("\nTests passed! Math is perfect. Cleaning up...");
  await prisma.user.deleteMany({ where: { id: { in: [userMainstream, userNiche] } } });
  await analyticsPrisma.user.deleteMany({ where: { id: { in: [userMainstream, userNiche] } } });
  
  await analyticsPrisma.$disconnect();
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

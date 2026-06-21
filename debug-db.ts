import { analyticsPrisma } from "./server/db/analyticsPrisma.js";
import { prisma } from "./server/db/prisma.js";

async function run() {
  try {
    const pUsers = await prisma.user.findMany({ take: 3 });
    const aUsers = await analyticsPrisma.user.findMany({ take: 3 });
    console.log("Public users:", pUsers);
    console.log("Analytics users:", aUsers);
  } finally {
    await prisma.$disconnect();
    await analyticsPrisma.$disconnect();
  }
}
run();

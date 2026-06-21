import { getRedis, connectRedis, disconnectRedis } from "./server/cache/redis.js";
import { analyticsPrisma } from "./server/db/analyticsPrisma.js";

async function check() {
  await connectRedis();
  const redis = getRedis();
  const len = await redis!.lLen("analytics:event_queue");
  console.log(`Redis queue length: ${len}`);
  
  if (len > 0) {
    const items = await redis!.lRange("analytics:event_queue", 0, -1);
    console.log("Redis items:", items);
  }

  const dbCount = await analyticsPrisma.rawEvent.count();
  console.log(`DB total rawEvents: ${dbCount}`);

  const recent = await analyticsPrisma.rawEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log("Recent DB events:", recent);

  await disconnectRedis();
  await analyticsPrisma.$disconnect();
}
check();

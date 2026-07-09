import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

// High-precision Normal Cumulative Distribution Function (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228;
  const p = 1 - d * Math.exp(-x * x / 2) * (
    (((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530
  ) * t;
  return x >= 0 ? p : 1 - p;
}

// Stats helper for mean and sample variance
interface StatsSummary {
  mean: number;
  variance: number;
  stdDev: number;
  n: number;
}

function getStatsSummary(values: number[]): StatsSummary {
  const n = values.length;
  if (n === 0) return { mean: 0, variance: 0, stdDev: 0, n: 0 };
  
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / Math.max(1, n - 1);
  return {
    mean,
    variance,
    stdDev: Math.sqrt(variance),
    n,
  };
}

// Z-test for two independent proportions (conversion rate / CTR)
function runZTest(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number
) {
  if (trialsA === 0 || trialsB === 0) {
    return { z: 0, pValue: 1.0, significant: false };
  }

  const pA = successesA / trialsA;
  const pB = successesB / trialsB;
  const pPooled = (successesA + successesB) / (trialsA + trialsB);
  
  if (pPooled === 0 || pPooled === 1) {
    return { z: 0, pValue: 1.0, significant: false };
  }

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / trialsA + 1 / trialsB));
  const z = (pA - pB) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    z,
    pValue,
    significant: pValue < 0.05,
  };
}

// Welch's t-test for unequal variances and sample sizes (continuous wait time)
function runWelchTTest(statsA: StatsSummary, statsB: StatsSummary) {
  if (statsA.n < 2 || statsB.n < 2) {
    return { t: 0, df: 0, pValue: 1.0, significant: false };
  }

  const varA = statsA.variance;
  const varB = statsB.variance;
  const nA = statsA.n;
  const nB = statsB.n;

  // Welch t-statistic
  const se = Math.sqrt(varA / nA + varB / nB);
  if (se === 0) return { t: 0, df: 0, pValue: 1.0, significant: false };
  
  const t = (statsA.mean - statsB.mean) / se;

  // Welch-Satterthwaite equation for degrees of freedom
  const num = Math.pow(varA / nA + varB / nB, 2);
  const den = (Math.pow(varA / nA, 2) / (nA - 1)) + (Math.pow(varB / nB, 2) / (nB - 1));
  const df = num / den;

  // For high degrees of freedom, t-distribution converges to Z (normal distribution)
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));

  return {
    t,
    df,
    pValue,
    significant: pValue < 0.05,
  };
}

export async function analyze(experimentName: string) {
  logger.info("ANALYZE", `Starting statistical analysis for A/B experiment: '${experimentName}'...`);

  // Warm up connection
  await analyticsPrisma.rawEvent.findMany({ take: 1 });

  // Query events that contain the experiment name in their payload ab_variants list
  const events = await analyticsPrisma.rawEvent.findMany({
    orderBy: { timestamp: "asc" },
  });

  // Filter events in memory to bypass Prisma JSON query complexities
  const expEvents = events.filter((evt) => {
    const payloadObj = evt.payload as any;
    return payloadObj && payloadObj.ab_variants && payloadObj.ab_variants[experimentName] !== undefined;
  });

  if (expEvents.length === 0) {
    logger.warn("ANALYZE", `No events found with active variant for experiment '${experimentName}'`);
    return;
  }

  logger.info("ANALYZE", `Processing ${expEvents.length} events matching experiment...`);

  // Segment user IDs by variant to prevent session pollution (each user should be counted once)
  const userVariants = new Map<string, "A" | "B" >();
  for (const evt of expEvents) {
    if (evt.userId) {
      const variant = (evt.payload as any).ab_variants[experimentName];
      userVariants.set(evt.userId, variant);
    }
  }

  const usersA = Array.from(userVariants.entries()).filter(([_, v]) => v === "A").map(([id]) => id);
  const usersB = Array.from(userVariants.entries()).filter(([_, v]) => v === "B").map(([id]) => id);

  logger.info("ANALYZE", `Users allocation: Variant A (Control) = ${usersA.length}, Variant B (Treatment) = ${usersB.length}`);

  // Metric 1: Matchmaking queue conversion rate (Z-Test)
  // Conversion = QueueLeave events with reason: 'match_found' vs cancel_by_user
  const queueLeaveEvents = expEvents.filter((e) => e.eventType === "QueueLeave");
  
  let trialsA = 0, successesA = 0;
  let trialsB = 0, successesB = 0;

  for (const evt of queueLeaveEvents) {
    const payloadObj = evt.payload as any;
    const variant = payloadObj.ab_variants[experimentName];
    const isSuccess = payloadObj.reason === "match_found";

    if (variant === "A") {
      trialsA++;
      if (isSuccess) successesA++;
    } else if (variant === "B") {
      trialsB++;
      if (isSuccess) successesB++;
    }
  }

  const conversionRateA = trialsA > 0 ? (successesA / trialsA) * 100 : 0;
  const conversionRateB = trialsB > 0 ? (successesB / trialsB) * 100 : 0;

  const propResult = runZTest(successesA, trialsA, successesB, trialsB);

  // Metric 2: Matchmaking wait times (Welch's t-test)
  // Only evaluate successful matchmaking queues (where reason was 'match_found')
  const waitTimesA: number[] = [];
  const waitTimesB: number[] = [];

  for (const evt of queueLeaveEvents) {
    const payloadObj = evt.payload as any;
    const variant = payloadObj.ab_variants[experimentName];
    const isSuccess = payloadObj.reason === "match_found";
    const duration = payloadObj.durationSeconds || 0;

    if (isSuccess) {
      if (variant === "A") {
        waitTimesA.push(duration);
      } else if (variant === "B") {
        waitTimesB.push(duration);
      }
    }
  }

  const statsA = getStatsSummary(waitTimesA);
  const statsB = getStatsSummary(waitTimesB);

  const tTestResult = runWelchTTest(statsA, statsB);

  // Print results
  console.log("\n============================================================");
  console.log(` EXPERIMENT STATISTICAL REPORT: ${experimentName.toUpperCase()}`);
  console.log("============================================================");
  console.log(`Allocated Users: Variant A = ${usersA.length} | Variant B = ${usersB.length}`);
  console.log("------------------------------------------------------------");
  console.log("METRIC 1: Queue Match Conversion (Z-Test of Proportions)");
  console.log(`  Variant A (Control):   ${conversionRateA.toFixed(2)}% (${successesA}/${trialsA} conversion events)`);
  console.log(`  Variant B (Treatment): ${conversionRateB.toFixed(2)}% (${successesB}/${trialsB} conversion events)`);
  console.log(`  Z-Statistic:           ${propResult.z.toFixed(4)}`);
  console.log(`  p-Value:               ${propResult.pValue.toFixed(6)}`);
  console.log(`  Significant Difference: ${propResult.significant ? "YES (α = 0.05)" : "NO"}`);
  console.log("------------------------------------------------------------");
  console.log("METRIC 2: Match Queue Wait Time (Welch's t-test of Means)");
  console.log(`  Variant A (Control):   Mean = ${statsA.mean.toFixed(2)}s, StdDev = ${statsA.stdDev.toFixed(2)}s, n = ${statsA.n}`);
  console.log(`  Variant B (Treatment): Mean = ${statsB.mean.toFixed(2)}s, StdDev = ${statsB.stdDev.toFixed(2)}s, n = ${statsB.n}`);
  console.log(`  t-Statistic:           ${tTestResult.t.toFixed(4)}`);
  console.log(`  Degrees of Freedom:    ${tTestResult.df.toFixed(2)}`);
  console.log(`  p-Value:               ${tTestResult.pValue.toFixed(6)}`);
  console.log(`  Significant Difference: ${tTestResult.significant ? "YES (α = 0.05)" : "NO"}`);
  console.log("============================================================\n");
}

async function main() {
  const args = process.argv.slice(2);
  let experimentName = "lobby_recommender";

  for (const arg of args) {
    if (arg.startsWith("--experiment=")) {
      experimentName = arg.split("=")[1];
    }
  }

  try {
    await analyze(experimentName);
    process.exit(0);
  } catch (err) {
    logger.error("ANALYZE", "Failed to run experiment analyzer", err);
    process.exit(1);
  }
}

// Run if called directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("analyze-experiment.ts") || 
  process.argv[1].endsWith("analyze-experiment.js")
);

if (isDirectRun) {
  void main();
}

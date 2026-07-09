import { runClusteringPipeline } from "../server/analytics/ml/clustering.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  logger.info("RunClusteringScript", "=== INICIANDO PIPELINE DE CLUSTERING OFFLINE (FASE 31) ===");

  // Detectar argumento --k=N
  let k = 3;
  const kArg = process.argv.find((arg) => arg.startsWith("--k="));
  if (kArg) {
    const val = parseInt(kArg.split("=")[1], 10);
    if (!isNaN(val) && val > 0) {
      k = val;
    }
  }

  try {
    const result = await runClusteringPipeline({ k });
    logger.info(
      "RunClusteringScript",
      `Clustering finalizado con éxito para k=${result.k}. Inercia final (SSE): ${result.sse.toFixed(4)}`
    );
    logger.info("RunClusteringScript", "Distribución de Centroides:");
    result.centroids.forEach((centroid, i) => {
      logger.info(
        "RunClusteringScript",
        `  Clúster ${i} (Centroide): [PlayTime: ${centroid[0].toFixed(2)}, Matches: ${centroid[1].toFixed(2)}, ExploreRatio: ${centroid[2].toFixed(2)}, PopSensitivity: ${centroid[3].toFixed(2)}, ReturnIntent: ${centroid[4].toFixed(2)}]`
      );
    });
    logger.info("RunClusteringScript", `Total de asignaciones registradas: ${result.assignments.length}`);
    process.exit(0);
  } catch (error) {
    logger.error("RunClusteringScript", "Error ejecutando el pipeline de clustering offline:", error);
    process.exit(1);
  }
}

void main();

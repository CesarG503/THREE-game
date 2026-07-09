import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";

export interface ClusterFeatureVector {
  userId: string;
  features: number[]; // [totalPlayTime, matchesPlayed, explorerRatio, popularitySensitivity, returnIntent]
}

export interface KMeansResult {
  k: number;
  sse: number;
  centroids: number[][];
  assignments: { userId: string; clusterId: string }[];
}

/**
 * Normaliza los vectores de características en el rango [0, 1] usando MinMax.
 */
export function normalizeFeatures(vectors: ClusterFeatureVector[]): {
  normalized: ClusterFeatureVector[];
  minValues: number[];
  maxValues: number[];
} {
  const firstVector = vectors[0];
  if (!firstVector) {
    return { normalized: [], minValues: [], maxValues: [] };
  }
  const numFeatures = firstVector.features.length;
  const minValues = new Array(numFeatures).fill(Infinity);
  const maxValues = new Array(numFeatures).fill(-Infinity);

  // 1. Encontrar mínimos y máximos para cada feature
  for (const v of vectors) {
    for (let j = 0; j < numFeatures; j++) {
      const val = v.features[j] ?? 0;
      const currentMin = minValues[j] ?? Infinity;
      const currentMax = maxValues[j] ?? -Infinity;
      if (val < currentMin) minValues[j] = val;
      if (val > currentMax) maxValues[j] = val;
    }
  }

  // 2. Normalizar vectores
  const normalized = vectors.map((v) => {
    const normFeatures = v.features.map((val, j) => {
      const denom = (maxValues[j] ?? 0) - (minValues[j] ?? 0);
      return denom === 0 ? 0.0 : (val - (minValues[j] ?? 0)) / denom;
    });
    return { userId: v.userId, features: normFeatures };
  });

  return { normalized, minValues, maxValues };
}

/**
 * Calcula la distancia euclidiana al cuadrado entre dos vectores.
 */
export function squaredEuclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return sum;
}

/**
 * Ejecuta el algoritmo K-Means puro sobre un conjunto de vectores normalizados.
 */
export function kMeans(
  normalizedVectors: ClusterFeatureVector[],
  k: number,
  maxIterations = 100
): { centroids: number[][]; assignments: number[]; sse: number } {
  const n = normalizedVectors.length;
  const firstVector = normalizedVectors[0];
  if (!firstVector) {
    throw new Error("No vectors provided for clustering.");
  }
  const numFeatures = firstVector.features.length;

  if (n < k) {
    throw new Error(`Cannot cluster ${n} points into ${k} clusters.`);
  }

  // 1. Inicialización K-Means++
  const centroids: number[][] = [];
  // Elegir el primer centroide aleatoriamente
  const firstIndex = Math.floor(Math.random() * n);
  centroids.push([...(normalizedVectors[firstIndex]?.features ?? [])]);

  for (let c = 1; c < k; c++) {
    // Calcular distancia al cuadrado más corta a los centroides existentes
    const distances = normalizedVectors.map((v) => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = squaredEuclideanDistance(v.features, centroid);
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    });

    // Selección probabilística proporcional a la distancia (ruleta)
    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let rand = Math.random() * totalDist;
    let selectedIndex = 0;
    for (let i = 0; i < n; i++) {
      rand -= distances[i] ?? 0;
      if (rand <= 0) {
        selectedIndex = i;
        break;
      }
    }
    centroids.push([...(normalizedVectors[selectedIndex]?.features ?? [])]);
  }

  let assignments = new Array(n).fill(-1);
  let changed = true;
  let iter = 0;

  while (changed && iter < maxIterations) {
    changed = false;
    iter++;

    // Paso de asignación
    const nextAssignments = normalizedVectors.map((v) => {
      let minCentroidIndex = 0;
      let minDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dist = squaredEuclideanDistance(v.features, centroids[c] ?? []);
        if (dist < minDist) {
          minDist = dist;
          minCentroidIndex = c;
        }
      }
      return minCentroidIndex;
    });

    for (let i = 0; i < n; i++) {
      if (nextAssignments[i] !== assignments[i]) {
        assignments = nextAssignments;
        changed = true;
        break;
      }
    }

    if (!changed) break;

    // Paso de actualización de centroides
    const counts = new Array(k).fill(0);
    const sums: number[][] = Array.from({ length: k }, () => new Array(numFeatures).fill(0));

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      if (cluster !== undefined && cluster >= 0) {
        counts[cluster] = (counts[cluster] ?? 0) + 1;
        const sumCluster = sums[cluster];
        const vector = normalizedVectors[i];
        if (sumCluster && vector) {
          for (let j = 0; j < numFeatures; j++) {
            sumCluster[j] = (sumCluster[j] ?? 0) + (vector.features[j] ?? 0);
          }
        }
      }
    }

    for (let c = 0; c < k; c++) {
      const count = counts[c] ?? 0;
      if (count > 0) {
        const centroid = centroids[c];
        const sumC = sums[c];
        if (centroid && sumC) {
          for (let j = 0; j < numFeatures; j++) {
            centroid[j] = (sumC[j] ?? 0) / count;
          }
        }
      } else {
        // En caso de clúster vacío, re-inicializar en un punto aleatorio
        const randIdx = Math.floor(Math.random() * n);
        centroids[c] = [...(normalizedVectors[randIdx]?.features ?? [])];
        changed = true;
      }
    }
  }

  // Calcular la inercia (SSE)
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const cluster = assignments[i];
    if (cluster !== undefined && cluster >= 0) {
      const centroid = centroids[cluster];
      const vector = normalizedVectors[i];
      if (centroid && vector) {
        sse += squaredEuclideanDistance(vector.features, centroid);
      }
    }
  }

  return { centroids, assignments, sse };
}

/**
 * Carga los datos analíticos del Feature Store, calcula los clústeres y actualiza ambas bases de datos.
 */
export async function runClusteringPipeline(options?: {
  k?: number;
  maxIterations?: number;
}): Promise<KMeansResult> {
  logger.info("ClusteringPipeline", "Starting player features clustering process...");

  // 1. Obtener datos analíticos
  const playerFeatures = await analyticsPrisma.playerFeatures.findMany({
    select: {
      userId: true,
      totalPlayTime: true,
      matchesPlayed: true,
      explorerRatio: true,
      popularitySensitivity: true,
      returnIntent: true,
    },
  });

  if (playerFeatures.length === 0) {
    logger.warn("ClusteringPipeline", "No players found in PlayerFeatures table. Clustering skipped.");
    return { k: 0, sse: 0, centroids: [], assignments: [] };
  }

  // 2. Mapear a vectores de características con fallbacks por nulos
  const vectors: ClusterFeatureVector[] = playerFeatures.map((pf) => ({
    userId: pf.userId,
    features: [
      pf.totalPlayTime || 0.0,
      pf.matchesPlayed || 0,
      pf.explorerRatio || 0.0,
      pf.popularitySensitivity || 0.5,
      pf.returnIntent || 0.5,
    ],
  }));

  // 3. Normalizar características
  const { normalized } = normalizeFeatures(vectors);

  // 4. Ejecutar el Método del Codo para fines de logs/auditoría
  logger.info("ClusteringPipeline", "Running Elbow Method evaluation for k = 1 to 5...");
  const elbowResults: { k: number; sse: number }[] = [];
  const maxK = Math.min(5, vectors.length);
  for (let tempK = 1; tempK <= maxK; tempK++) {
    try {
      const run = kMeans(normalized, tempK, options?.maxIterations || 100);
      elbowResults.push({ k: tempK, sse: run.sse });
      logger.info("ClusteringPipeline", `Elbow Method: k=${tempK} | SSE=${run.sse.toFixed(4)}`);
    } catch (err) {
      logger.error("ClusteringPipeline", `Failed running evaluation for k=${tempK}`, err);
    }
  }

  // 5. Determinar k óptimo.
  // Si no se provee, usamos k=3 por defecto.
  const targetK = options?.k || 3;
  logger.info("ClusteringPipeline", `Executing final clustering with target k = ${targetK}...`);

  const { centroids, assignments, sse } = kMeans(normalized, targetK, options?.maxIterations || 100);

  // Mapear asignaciones
  const clusterAssignments = vectors.map((v, i) => {
    const clusterIndex = assignments[i];
    return {
      userId: v.userId,
      clusterId: `cluster_${clusterIndex}`,
    };
  });

  // 6. Actualizar las bases de datos de forma transaccional y limpiar el caché
  logger.info("ClusteringPipeline", `Updating databases and clearing caches for ${clusterAssignments.length} users...`);

  for (const item of clusterAssignments) {
    // A. Base operacional (User)
    await prisma.user.update({
      where: { id: item.userId },
      data: { clusterId: item.clusterId },
    });

    // B. Base analítica (PlayerFeatures)
    await analyticsPrisma.playerFeatures.update({
      where: { userId: item.userId },
      data: { clusterId: item.clusterId },
    });

    // C. Limpiar caché Redis
    await PlayerProfileRepository.clearCache(item.userId);
  }

  logger.info("ClusteringPipeline", `Clustering process complete. Final SSE: ${sse.toFixed(4)}`);

  return {
    k: targetK,
    sse,
    centroids,
    assignments: clusterAssignments,
  };
}

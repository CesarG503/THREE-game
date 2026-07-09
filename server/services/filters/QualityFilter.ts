import { detectTextLanguage } from "../../analytics/features/language_matcher.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";
import type { MapDto } from "../MapService.js";
import { productionFeatureStore } from "../../analytics/features/ProductionStore.js";

// Latency matrix between client region and map server region
const LATENCY_MATRIX: Record<string, Record<string, number>> = {
  "us-east": { "us-east": 20, "eu-west": 90, "sa-east": 120, "asia-east": 220 },
  "eu-west": { "us-east": 90, "eu-west": 15, "sa-east": 180, "asia-east": 250 },
  "sa-east": { "us-east": 120, "eu-west": 180, "sa-east": 30, "asia-east": 310 },
  "asia-east": { "us-east": 220, "eu-west": 250, "sa-east": 310, "asia-east": 25 },
};

/**
 * Hash map ID to assign a consistent server region.
 */
export function getMapServerRegion(mapId: string): string {
  const charCodeSum = mapId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const regions = ["us-east", "eu-west", "sa-east", "asia-east"];
  return regions[charCodeSum % regions.length] ?? "us-east";
}

/**
 * Returns latency between a client region and a map's server region.
 */
export function getMapLatency(clientRegion: string, mapId: string): number {
  const normalizedClient = clientRegion.trim().toLowerCase();
  const mapRegion = getMapServerRegion(mapId);
  const clientLatencies = LATENCY_MATRIX[normalizedClient] ?? LATENCY_MATRIX["us-east"]!;
  return clientLatencies[mapRegion] ?? 150; // default average ping if unknown
}

/**
 * Returns allowed languages based on preferred language.
 */
export function getAllowedLanguages(preferredLang: string | null | undefined): string[] {
  if (!preferredLang) return ["en"];
  const lang = preferredLang.toLowerCase().trim();
  switch (lang) {
    case "es":
      return ["es", "en"];
    case "fr":
      return ["fr", "en"];
    case "de":
      return ["de", "en"];
    default:
      return [lang, "en"];
  }
}

export interface FilterOptions {
  clientRegion?: string;
  preferredLanguage?: string;
  minItemsCount?: number;
}

/**
 * Post-procesa una lista de mapas candidatos aplicando filtros de idioma y latencia.
 * Si la lista resultante es demasiado pequeña, relaja los filtros.
 */
export async function applyQualityFilter(
  maps: MapDto[],
  userId: string | null,
  options: FilterOptions = {}
): Promise<MapDto[]> {
  if (maps.length === 0) return [];

  // 1. Obtener idioma de preferencia del usuario
  let preferredLanguage = options.preferredLanguage;
  if (!preferredLanguage && userId) {
    try {
      const features = await productionFeatureStore.getPlayerFeatures(userId);
      if (features?.preferredLanguage) {
        preferredLanguage = features.preferredLanguage;
      }
    } catch (err) {
      logger.warn("QualityFilter", `Failed to fetch player features for user ${userId}`, err);
    }
  }

  const clientRegion = options.clientRegion ?? "us-east"; // default fallback region
  const allowedLanguages = getAllowedLanguages(preferredLanguage ?? "en");
  const targetMinCount = options.minItemsCount ?? Math.max(1, Math.floor(maps.length / 2));

  logger.info(
    "QualityFilter",
    `Filtering ${maps.length} maps. User: ${userId}, Region: ${clientRegion}, Allowed Langs: ${allowedLanguages.join(", ")}`
  );

  // 2. Aplicar filtrado estricto (Ping <= 200ms e Idioma soportado)
  let filtered = maps.filter((map) => {
    // Verificar latencia
    const latency = getMapLatency(clientRegion, map.id);
    const passesLatency = latency <= 200;

    // Verificar idioma
    const mapText = `${map.name} ${map.description ?? ""}`;
    const mapLang = detectTextLanguage(mapText);
    const passesLanguage = allowedLanguages.includes(mapLang);

    return passesLatency && passesLanguage;
  });

  // 3. Mecanismo de Relajación si se filtra demasiado contenido
  if (filtered.length < targetMinCount) {
    logger.warn(
      "QualityFilter",
      `Strict filter resulted in only ${filtered.length} items (needed ${targetMinCount}). Relaxing filters.`
    );

    // Relajación Paso 1: Permitir pings de hasta 300ms, mantener idioma
    filtered = maps.filter((map) => {
      const latency = getMapLatency(clientRegion, map.id);
      const passesLatency = latency <= 300;

      const mapText = `${map.name} ${map.description ?? ""}`;
      const mapLang = detectTextLanguage(mapText);
      const passesLanguage = allowedLanguages.includes(mapLang);

      return passesLatency && passesLanguage;
    });

    // Relajación Paso 2: Si sigue siendo insuficiente, permitir cualquier latencia, pero priorizar idioma
    if (filtered.length < targetMinCount) {
      logger.warn("QualityFilter", `Relaxation Step 1 failed (${filtered.length} items). Relaxing latency entirely.`);
      filtered = maps.filter((map) => {
        const mapText = `${map.name} ${map.description ?? ""}`;
        const mapLang = detectTextLanguage(mapText);
        return allowedLanguages.includes(mapLang);
      });
    }

    // Relajación Paso 3: Si sigue siendo insuficiente, devolver la lista original de recomendaciones sin filtros
    if (filtered.length < targetMinCount) {
      logger.warn("QualityFilter", `Relaxation Step 2 failed (${filtered.length} items). Returning original unfiltered list.`);
      filtered = maps;
    }
  }

  // 4. Reordenar para priorizar menor latencia e idioma ideal del usuario
  return filtered.sort((a, b) => {
    const latA = getMapLatency(clientRegion, a.id);
    const latB = getMapLatency(clientRegion, b.id);
    
    // Si la diferencia de latencia es significativa (> 50ms), priorizar menor latencia
    if (Math.abs(latA - latB) > 50) {
      return latA - latB;
    }

    const langA = detectTextLanguage(`${a.name} ${a.description ?? ""}`);
    const langB = detectTextLanguage(`${b.name} ${b.description ?? ""}`);
    const pref = preferredLanguage ?? "en";

    if (langA === pref && langB !== pref) return -1;
    if (langB === pref && langA !== pref) return 1;

    return 0;
  });
}

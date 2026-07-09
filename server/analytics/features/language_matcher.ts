import { prisma } from "../../db/prisma.js";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { PlayerProfileRepository } from "../models/PlayerProfile.js";
import { logger } from "../../utils/Logger.js";

const SPANISH_WORDS = new Set(["el", "la", "de", "en", "que", "y", "los", "un", "con", "para", "por", "una", "del", "al", "es", "este", "esta", "como", "más", "pero", "sus", "o", "se", "lo"]);
const ENGLISH_WORDS = new Set(["the", "of", "and", "to", "a", "in", "for", "is", "on", "that", "by", "this", "with", "i", "you", "it", "not", "or", "be", "are", "from", "at", "as", "an"]);
const FRENCH_WORDS = new Set(["le", "la", "les", "de", "et", "un", "une", "en", "que", "pour", "dans", "par", "du", "sur", "avec", "ce", "cette", "est", "sont", "pour", "plus", "mais"]);
const GERMAN_WORDS = new Set(["der", "die", "das", "und", "ist", "in", "zu", "den", "von", "mit", "auf", "für", "ist", "sind", "nicht", "ein", "eine", "es", "dass", "mit", "dem", "im"]);

const SUPPORTED_LANGUAGES = ["es", "en", "fr", "de"];

/**
 * Normaliza un código de idioma de 2 o más letras a los soportados.
 * Aplica fallbacks regionales (ca, gl, eu -> es).
 */
export function normalizeLanguage(lang: string | null | undefined): string | null {
  if (!lang) return null;
  const cleaned = lang.trim().toLowerCase().split("-")[0];
  if (!cleaned) return null;

  if (["ca", "gl", "eu"].includes(cleaned)) {
    return "es";
  }

  if (SUPPORTED_LANGUAGES.includes(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Parsea y ordena lenguajes desde una cabecera Accept-Language.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];

  const parsed = header.split(",")
    .map((item) => {
      const parts = item.split(";");
      const code = parts[0]?.trim().toLowerCase();
      let q = 1.0;
      if (parts[1]) {
        const qParts = parts[1].split("=");
        if (qParts[0]?.trim() === "q" && qParts[1]) {
          const val = parseFloat(qParts[1].trim());
          if (!isNaN(val)) {
            q = val;
          }
        }
      }
      return { code, q };
    })
    .filter((x) => x.code)
    .sort((a, b) => b.q - a.q)
    .map((x) => normalizeLanguage(x.code))
    .filter((x): x is string => x !== null);

  return Array.from(new Set(parsed));
}

/**
 * Clasifica un texto en es, en, fr o de basándose en la coincidencia de stop-words frecuentes.
 */
export function detectTextLanguage(text: string | null | undefined): string {
  if (!text) return "en";
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  let esScore = 0;
  let enScore = 0;
  let frScore = 0;
  let deScore = 0;

  for (const word of words) {
    if (SPANISH_WORDS.has(word)) esScore++;
    if (ENGLISH_WORDS.has(word)) enScore++;
    if (FRENCH_WORDS.has(word)) frScore++;
    if (GERMAN_WORDS.has(word)) deScore++;
  }

  const maxScore = Math.max(esScore, enScore, frScore, deScore);
  if (maxScore === 0) return "en";
  if (maxScore === esScore) return "es";
  if (maxScore === enScore) return "en";
  if (maxScore === frScore) return "fr";
  return "de";
}

/**
 * Computa de forma heurística la preferencia de idioma del jugador
 * combinando las señales del navegador y los mapas que ha jugado en los últimos 30 días.
 */
export async function computeLanguagePreferenceForUser(userId: string): Promise<string> {
  const lookbackDays = 30;
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  logger.debug("LanguageMatcher", `Computing language preference for user: ${userId}`);

  // 1. Extraer señales de navegación/sesión
  const sessionEvents = await analyticsPrisma.rawEvent.findMany({
    where: {
      userId,
      eventType: "SessionStart",
      timestamp: { gte: startTime },
    },
    select: {
      payload: true,
    },
  });

  const languageScores = new Map<string, number>();

  for (const ev of sessionEvents) {
    const payload = ev.payload as any;
    
    // Señal 1: navigator.language
    const directLang = normalizeLanguage(payload?.language);
    if (directLang) {
      languageScores.set(directLang, (languageScores.get(directLang) || 0) + 2.0);
    }

    // Señal 2: Accept-Language HTTP header
    const parsedAccept = parseAcceptLanguage(payload?.acceptLanguage);
    if (parsedAccept.length > 0) {
      // Primer elemento con prioridad alta, segundo con menor
      const first = parsedAccept[0];
      if (first) {
        languageScores.set(first, (languageScores.get(first) || 0) + 1.5);
      }
      const second = parsedAccept[1];
      if (second) {
        languageScores.set(second, (languageScores.get(second) || 0) + 0.5);
      }
    }
  }

  // 2. Extraer señales de los mapas jugados (MatchJoin)
  const matchEvents = await analyticsPrisma.rawEvent.findMany({
    where: {
      userId,
      eventType: "MatchJoin",
      timestamp: { gte: startTime },
    },
    select: {
      payload: true,
    },
  });

  if (matchEvents.length > 0) {
    const mapCounts = new Map<string, number>();
    for (const ev of matchEvents) {
      const mapId = (ev.payload as any)?.mapId;
      if (mapId) {
        mapCounts.set(mapId, (mapCounts.get(mapId) || 0) + 1);
      }
    }

    const mapIds = Array.from(mapCounts.keys());
    const maps = await prisma.gameMap.findMany({
      where: { id: { in: mapIds } },
      select: { id: true, name: true, description: true },
    });

    for (const map of maps) {
      const textToAnalyze = `${map.name} ${map.description || ""}`;
      const mapLang = detectTextLanguage(textToAnalyze);
      const playCount = mapCounts.get(map.id) || 1;

      // Ponderación de mapas jugados: 1.0 por cada play
      languageScores.set(mapLang, (languageScores.get(mapLang) || 0) + (playCount * 1.0));
    }
  }

  // 3. Determinar idioma preferido ganador
  let bestLang = "en";
  let maxScore = -1;

  for (const [lang, score] of languageScores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestLang = lang;
    }
  }

  logger.info("LanguageMatcher", `Inferred language for user ${userId}: ${bestLang} (Score: ${maxScore})`);

  // 4. Actualizar PlayerFeatures
  await analyticsPrisma.playerFeatures.upsert({
    where: { userId },
    create: {
      userId,
      lastActive: new Date(),
      preferredLanguage: bestLang,
    },
    update: {
      preferredLanguage: bestLang,
      lastActive: new Date(),
    },
  });

  // 5. Invalidar caché en Redis para mantener consistencia
  await PlayerProfileRepository.clearCache(userId);

  return bestLang;
}

/**
 * Procesa la inferencia de lenguaje para todos los usuarios activos
 * en los últimos N días. Util para crons o scripts de mantenimiento.
 */
export async function computeAllLanguagePreferences(lookbackDays: number = 30): Promise<number> {
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Obtener todos los IDs de usuario que han tenido eventos de sesión en la ventana
  const recentUsers = await analyticsPrisma.rawEvent.findMany({
    where: {
      eventType: "SessionStart",
      timestamp: { gte: startTime },
      userId: { not: null },
    },
    select: {
      userId: true,
    },
    distinct: ["userId"],
  });

  let processedCount = 0;
  for (const row of recentUsers) {
    if (row.userId) {
      try {
        await computeLanguagePreferenceForUser(row.userId);
        processedCount++;
      } catch (err) {
        logger.error("LanguageMatcher", `Error computing language for user ${row.userId}`, err);
      }
    }
  }

  return processedCount;
}

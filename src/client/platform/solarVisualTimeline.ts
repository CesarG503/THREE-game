import * as THREE from "three";
import { DEFAULT_SOLAR_VISUAL_SETTINGS, normalizeSolarCycleSettings, type SolarCycleSettings, type SolarVisualSettings } from "./timelineDefaults";

export type CelestialBody = "sun" | "moon";
export interface SolarVisualPoint {
  id: string;
  time: number;
  size: number;
  glowIntensity: number;
  glowSize: number;
  color: string;
}
export type SolarVisualTimeline = Record<CelestialBody, SolarVisualPoint[]>;
type Source = SolarCycleSettings & SolarVisualSettings & { solarVisualTimeline?: SolarVisualTimeline };

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) ? THREE.MathUtils.clamp(n, min, max) : fallback;
}

export function solarPointTime(time: number) {
  return ((Math.round((Number.isFinite(time) ? time : 0) * 60) % 1440) + 1440) % 1440 / 60;
}

export function formatSolarPointTime(time: number) {
  const minute = Math.round(solarPointTime(time) * 60);
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function normalizeSolarVisualTimeline(source: Source = {}): SolarVisualTimeline {
  const settings = { ...DEFAULT_SOLAR_VISUAL_SETTINGS, ...source };
  const orbit = normalizeSolarCycleSettings(source);
  const start = orbit.solarPathSunriseTime;
  const end = orbit.solarPathSunsetTime;
  const dayLength = end - start;
  const sun = (id: string, time: number, size: number, tint: string): SolarVisualPoint => ({
    id, time, size, color: tint, glowIntensity: settings.solarVisualSunGlowIntensity, glowSize: settings.solarVisualSunGlowSize
  });
  // Preserve the old morning/evening blends and the long, constant midday interval.
  const defaults: SolarVisualTimeline = {
    sun: [
      sun("sun-dawn", start, settings.solarVisualSunriseSize, settings.solarVisualSunriseColor),
      sun("sun-day", start + dayLength * 0.32, settings.solarVisualNoonSize, settings.solarVisualNoonColor),
      sun("sun-noon", start + dayLength * 0.5, settings.solarVisualNoonSize, settings.solarVisualNoonColor),
      sun("sun-afternoon", start + dayLength * 0.72, settings.solarVisualNoonSize, settings.solarVisualNoonColor),
      sun("sun-dusk", end, settings.solarVisualSunsetSize, settings.solarVisualSunsetColor)
    ],
    moon: [end, end + (24 - dayLength) / 2, start].map((time, i) => ({
      id: `moon-${i}`, time, size: settings.solarVisualMoonSize, color: settings.solarVisualMoonColor,
      glowIntensity: settings.solarVisualMoonGlowIntensity, glowSize: settings.solarVisualMoonGlowSize
    }))
  };
  const normalize = (body: CelestialBody) => {
    const sourcePoints = source.solarVisualTimeline?.[body];
    const points = Array.isArray(sourcePoints) && sourcePoints.length ? sourcePoints : defaults[body];
    const byMinute = new Map<number, SolarVisualPoint>();
    const ids = new Set<string>();
    points.forEach((point, index) => {
      if (!point || typeof point !== "object") return;
      let id = typeof point.id === "string" && point.id ? point.id : `${body}-${index}`;
      while (ids.has(id)) id += "-copy";
      ids.add(id);
      const time = solarPointTime(numberInRange(point.time, 0, 0, 24));
      byMinute.set(Math.round(time * 60), {
        id, time,
        size: numberInRange(point.size, body === "sun" ? 0.72 : 0.85, 0.2, 3.5),
        glowIntensity: numberInRange(point.glowIntensity, body === "sun" ? 1 : 0.45, 0, 4),
        glowSize: numberInRange(point.glowSize, 1, 0.2, 4),
        color: color(point.color, body === "sun" ? "#ffffff" : "#dbeafe")
      });
    });
    if (!byMinute.size) return normalizeSolarVisualTimeline({ ...source, solarVisualTimeline: undefined })[body];
    return [...byMinute.values()].sort((a, b) => a.time - b.time);
  };
  return { sun: normalize("sun"), moon: normalize("moon") };
}

// Points are sorted/normalized at the boundary; sample continuously without quantizing playback.
export function sampleSolarVisualPoints(points: SolarVisualPoint[], time: number): SolarVisualPoint {
  const hour = ((time % 24) + 24) % 24;
  let nextIndex = points.findIndex(point => point.time > hour);
  if (nextIndex < 0) nextIndex = 0;
  const next = points[nextIndex];
  const previous = points[(nextIndex + points.length - 1) % points.length];
  const span = (next.time - previous.time + 24) % 24;
  const elapsed = (hour - previous.time + 24) % 24;
  const t = span ? THREE.MathUtils.smoothstep(elapsed / span, 0, 1) : 0;
  return {
    id: previous.id, time: hour,
    size: THREE.MathUtils.lerp(previous.size, next.size, t),
    glowIntensity: THREE.MathUtils.lerp(previous.glowIntensity, next.glowIntensity, t),
    glowSize: THREE.MathUtils.lerp(previous.glowSize, next.glowSize, t),
    color: `#${new THREE.Color(previous.color).lerp(new THREE.Color(next.color), t).getHexString()}`
  };
}

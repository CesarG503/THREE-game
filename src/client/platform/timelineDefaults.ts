import * as THREE from "three";
import { getSkyboxPresetDefaults } from "./skyboxPresets";

export interface TimelineKeyframe {
  id: string;
  time: number; // 0.0 a 24.0 (ej. 0 = 00:00, 6 = 06:00, 12 = 12:00, 18 = 18:00)
  label: string;
  icon: string;
  skyType?: string;
  lightMode?: string;
  shadowQuality?: string;
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  enableSunLight?: boolean;
  enableAmbientLight?: boolean;
  sunElevation: number;
  sunAzimuth: number;
  environmentIntensity: number;
  backgroundIntensity: number;
  backgroundBlurriness?: number;
  skyboxRotation?: number;
  enableSkyboxFog: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  enableStars: boolean;
  enableVisibleSun?: boolean;
  visibleSunSize?: number;
  visibleSunIntensity?: number;
  transitionMode?: "procedural" | "instant";
  skyTurbidity?: number;
  skyRayleigh?: number;
  skyMieCoefficient?: number;
  skyMieDirectionalG?: number;
}

const DEFAULT_STATE_SKY_TYPE = "shader";

export const DEFAULT_DAY_NIGHT_TIMELINE: TimelineKeyframe[] = [
  {
    id: "night",
    time: 0, // 00:00 Medianoche
    label: "Noche",
    icon: "🌙",
    sunColor: "#8899bb",
    sunIntensity: 0.15,
    ambientColor: "#111122",
    ambientIntensity: 0.2,
    sunElevation: -35,
    sunAzimuth: 360,
    environmentIntensity: 0.6,
    backgroundIntensity: 0.8,
    enableSkyboxFog: true,
    fogColor: "#020210",
    fogNear: 10,
    fogFar: 40,
    enableStars: true
  },
  {
    id: "sunrise",
    time: 6, // 06:00 Amanecer
    label: "Amanecer",
    icon: "🌅",
    sunColor: "#ff5722",
    sunIntensity: 0.65,
    ambientColor: "#33235f",
    ambientIntensity: 0.45,
    sunElevation: 5,
    sunAzimuth: 90,
    environmentIntensity: 0.85,
    backgroundIntensity: 1.0,
    enableSkyboxFog: true,
    fogColor: "#ffaa77",
    fogNear: 15,
    fogFar: 65,
    enableStars: false
  },
  {
    id: "noon",
    time: 12, // 12:00 Mediodía
    label: "Mediodía",
    icon: "☀️",
    sunColor: "#ffffff",
    sunIntensity: 0.95,
    ambientColor: "#ffffff",
    ambientIntensity: 0.65,
    sunElevation: 75,
    sunAzimuth: 180,
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    enableSkyboxFog: false,
    fogColor: "#87ceeb",
    fogNear: 20,
    fogFar: 80,
    enableStars: false
  },
  {
    id: "sunset",
    time: 18, // 18:00 Atardecer
    label: "Atardecer",
    icon: "🌇",
    sunColor: "#ff8f70",
    sunIntensity: 0.65,
    ambientColor: "#33235f",
    ambientIntensity: 0.45,
    sunElevation: 5,
    sunAzimuth: 270,
    environmentIntensity: 0.9,
    backgroundIntensity: 1.0,
    enableSkyboxFog: true,
    fogColor: "#ffae88",
    fogNear: 15,
    fogFar: 65,
    enableStars: false
  }
];

export function normalizeTimelineKeyframe(
  keyframe: Partial<TimelineKeyframe>,
  index = 0
): TimelineKeyframe {
  const skyType = keyframe.skyType || DEFAULT_STATE_SKY_TYPE;
  const defaults = getSkyboxPresetDefaults(skyType);
  return {
    id: keyframe.id || `kf_${index}`,
    time: Math.round((((keyframe.time ?? 12) % 24) + 24) % 24 * 10) / 10,
    label: keyframe.label || "Estado",
    icon: keyframe.icon || "",
    skyType,
    lightMode: keyframe.lightMode || "day",
    shadowQuality: keyframe.shadowQuality || "medium",
    sunColor: keyframe.sunColor || defaults.sunColor,
    sunIntensity: keyframe.sunIntensity ?? defaults.sunIntensity,
    ambientColor: keyframe.ambientColor || defaults.ambientColor,
    ambientIntensity: keyframe.ambientIntensity ?? defaults.ambientIntensity,
    enableSunLight: keyframe.enableSunLight ?? defaults.enableSunLight ?? true,
    enableAmbientLight: keyframe.enableAmbientLight ?? defaults.enableAmbientLight ?? true,
    sunElevation: keyframe.sunElevation ?? defaults.sunElevation,
    sunAzimuth: keyframe.sunAzimuth ?? defaults.sunAzimuth,
    environmentIntensity: keyframe.environmentIntensity ?? defaults.environmentIntensity,
    backgroundIntensity: keyframe.backgroundIntensity ?? defaults.backgroundIntensity,
    backgroundBlurriness: keyframe.backgroundBlurriness ?? defaults.backgroundBlurriness,
    skyboxRotation: keyframe.skyboxRotation ?? defaults.skyboxRotation,
    enableSkyboxFog: keyframe.enableSkyboxFog ?? defaults.enableSkyboxFog,
    fogColor: keyframe.fogColor || defaults.fogColor,
    fogNear: keyframe.fogNear ?? defaults.fogNear,
    fogFar: keyframe.fogFar ?? defaults.fogFar,
    enableStars: keyframe.enableStars ?? false,
    enableVisibleSun: keyframe.enableVisibleSun ?? skyType === "shader",
    visibleSunSize: keyframe.visibleSunSize ?? 28,
    visibleSunIntensity: keyframe.visibleSunIntensity ?? 1,
    transitionMode: keyframe.transitionMode === "instant" ? "instant" : "procedural",
    skyTurbidity: keyframe.skyTurbidity ?? defaults.skyTurbidity ?? 10,
    skyRayleigh: keyframe.skyRayleigh ?? defaults.skyRayleigh ?? 2,
    skyMieCoefficient: keyframe.skyMieCoefficient ?? defaults.skyMieCoefficient ?? 0.005,
    skyMieDirectionalG: keyframe.skyMieDirectionalG ?? defaults.skyMieDirectionalG ?? 0.8
  };
}

export function normalizeTimeline(timeline: TimelineKeyframe[] | undefined): TimelineKeyframe[] {
  const list = timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE;
  return list
    .map((keyframe, index) => normalizeTimelineKeyframe(keyframe, index))
    .sort((a, b) => a.time - b.time);
}

export function formatTimeOfDayHHMM(timeOfDay: number): string {
  const norm = ((timeOfDay % 24) + 24) % 24;
  const hours = Math.floor(norm);
  const minutes = Math.floor((norm - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function interpolateTimelineState(
  timeline: TimelineKeyframe[] | undefined,
  timeOfDay: number
) {
  const sorted = normalizeTimeline(timeline);

  const normTime = ((timeOfDay % 24) + 24) % 24;

  let k1 = sorted[sorted.length - 1];
  let k2 = sorted[0];

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].time <= normTime) {
      k1 = sorted[i];
      k2 = sorted[(i + 1) % sorted.length];
    }
  }

  let t1 = k1.time;
  let t2 = k2.time;
  let currentT = normTime;

  if (t2 <= t1) {
    t2 += 24;
    if (currentT < t1) currentT += 24;
  }

  const dt = t2 - t1;
  const factor = dt > 0.0001 ? Math.max(0, Math.min(1, (currentT - t1) / dt)) : 0;
  const transitionMode = k1.transitionMode || "procedural";
  const blendFactor = transitionMode === "instant" ? 0 : THREE.MathUtils.smoothstep(factor, 0, 1);

  const cSun1 = new THREE.Color(k1.sunColor);
  const cSun2 = new THREE.Color(k2.sunColor);
  const lerpSunCol = cSun1.lerp(cSun2, blendFactor);

  const cAmb1 = new THREE.Color(k1.ambientColor);
  const cAmb2 = new THREE.Color(k2.ambientColor);
  const lerpAmbCol = cAmb1.lerp(cAmb2, blendFactor);

  const cFog1 = new THREE.Color(k1.fogColor);
  const cFog2 = new THREE.Color(k2.fogColor);
  const lerpFogCol = cFog1.lerp(cFog2, blendFactor);

  const lerpSunInt = THREE.MathUtils.lerp(k1.sunIntensity, k2.sunIntensity, blendFactor);
  const lerpAmbInt = THREE.MathUtils.lerp(k1.ambientIntensity, k2.ambientIntensity, blendFactor);
  const lerpSunElev = THREE.MathUtils.lerp(k1.sunElevation, k2.sunElevation, blendFactor);
  const lerpSunAzim = THREE.MathUtils.lerp(k1.sunAzimuth, k2.sunAzimuth, blendFactor);
  const lerpEnvInt = THREE.MathUtils.lerp(k1.environmentIntensity, k2.environmentIntensity, blendFactor);
  const lerpBgInt = THREE.MathUtils.lerp(k1.backgroundIntensity, k2.backgroundIntensity, blendFactor);
  const lerpFogNear = THREE.MathUtils.lerp(k1.fogNear, k2.fogNear, blendFactor);
  const lerpFogFar = THREE.MathUtils.lerp(k1.fogFar, k2.fogFar, blendFactor);
  const lerpBackgroundBlur = THREE.MathUtils.lerp(k1.backgroundBlurriness ?? 0, k2.backgroundBlurriness ?? 0, blendFactor);
  const lerpSkyboxRotation = THREE.MathUtils.lerp(k1.skyboxRotation ?? 0, k2.skyboxRotation ?? 0, blendFactor);
  const lerpSkyTurbidity = THREE.MathUtils.lerp(k1.skyTurbidity ?? 10, k2.skyTurbidity ?? 10, blendFactor);
  const lerpSkyRayleigh = THREE.MathUtils.lerp(k1.skyRayleigh ?? 2, k2.skyRayleigh ?? 2, blendFactor);
  const lerpSkyMieCoefficient = THREE.MathUtils.lerp(k1.skyMieCoefficient ?? 0.005, k2.skyMieCoefficient ?? 0.005, blendFactor);
  const lerpSkyMieDirectionalG = THREE.MathUtils.lerp(k1.skyMieDirectionalG ?? 0.8, k2.skyMieDirectionalG ?? 0.8, blendFactor);
  const lerpVisibleSunSize = THREE.MathUtils.lerp(k1.visibleSunSize ?? 28, k2.visibleSunSize ?? 28, blendFactor);
  const lerpVisibleSunIntensity = THREE.MathUtils.lerp(k1.visibleSunIntensity ?? 1, k2.visibleSunIntensity ?? 1, blendFactor);

  const enableStars = lerpSunElev < 0 || (blendFactor < 0.5 ? k1.enableStars : k2.enableStars);
  const enableSkyboxFog = blendFactor < 0.5 ? k1.enableSkyboxFog : k2.enableSkyboxFog;
  const pickFromNearest = <K extends keyof TimelineKeyframe>(key: K): TimelineKeyframe[K] => {
    return blendFactor < 0.5 ? k1[key] : k2[key];
  };

  return {
    skyType: pickFromNearest("skyType"),
    lightMode: pickFromNearest("lightMode"),
    shadowQuality: pickFromNearest("shadowQuality"),
    sunColor: "#" + lerpSunCol.getHexString(),
    sunIntensity: lerpSunInt,
    ambientColor: "#" + lerpAmbCol.getHexString(),
    ambientIntensity: lerpAmbInt,
    enableSunLight: pickFromNearest("enableSunLight"),
    enableAmbientLight: pickFromNearest("enableAmbientLight"),
    sunElevation: lerpSunElev,
    sunAzimuth: lerpSunAzim,
    environmentIntensity: lerpEnvInt,
    backgroundIntensity: lerpBgInt,
    backgroundBlurriness: lerpBackgroundBlur,
    skyboxRotation: lerpSkyboxRotation,
    enableSkyboxFog,
    fogColor: "#" + lerpFogCol.getHexString(),
    fogNear: lerpFogNear,
    fogFar: lerpFogFar,
    enableStars,
    enableVisibleSun: pickFromNearest("enableVisibleSun"),
    visibleSunSize: lerpVisibleSunSize,
    visibleSunIntensity: lerpVisibleSunIntensity,
    transitionMode,
    skyTurbidity: lerpSkyTurbidity,
    skyRayleigh: lerpSkyRayleigh,
    skyMieCoefficient: lerpSkyMieCoefficient,
    skyMieDirectionalG: lerpSkyMieDirectionalG,
    k1,
    k2,
    factor,
    transitionFactor: blendFactor
  };
}

export function updateKeyframeInTimeline(
  timeline: TimelineKeyframe[] | undefined,
  timeOfDay: number,
  partialProps: Partial<TimelineKeyframe>
): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  const normTime = ((timeOfDay % 24) + 24) % 24;

  let closestIndex = 0;
  let minDiff = 999;

  list.forEach((k, idx) => {
    const diff = Math.min(
      Math.abs(k.time - normTime),
      Math.abs(k.time - (normTime - 24)),
      Math.abs(k.time - (normTime + 24))
    );
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = idx;
    }
  });

  list[closestIndex] = normalizeTimelineKeyframe({
    ...list[closestIndex],
    ...partialProps
  }, closestIndex);

  return list;
}

export const DEFAULT_DAY_NIGHT_PROFILES = [
  {
    id: "estandar",
    name: "Estándar",
    isDefault: true,
    timeline: normalizeTimeline(DEFAULT_DAY_NIGHT_TIMELINE)
  },
  {
    id: "personalizado",
    name: "Personalizado",
    isDefault: false,
    timeline: normalizeTimeline(DEFAULT_DAY_NIGHT_TIMELINE)
  }
];

export function getKeyframeDurationRange(timeline: TimelineKeyframe[] | undefined, keyframeId: string): string {
  const info = getKeyframeTimeAndDuration(timeline, keyframeId);
  return info.rangeStr;
}

export function getKeyframeTimeAndDuration(timeline: TimelineKeyframe[] | undefined, keyframeId: string) {
  const sorted = normalizeTimeline(timeline);
  const index = sorted.findIndex(k => k.id === keyframeId);
  if (index === -1) return { startTime: 0, endTime: 24, duration: 24, rangeStr: "00:00 - 24:00" };

  const currentKey = sorted[index];
  const nextKey = sorted[(index + 1) % sorted.length];

  let duration = nextKey.time - currentKey.time;
  if (duration <= 0) duration += 24;

  const startTimeStr = formatTimeOfDayHHMM(currentKey.time);
  const endTimeStr = formatTimeOfDayHHMM(nextKey.time);

  return {
    startTime: Math.round(currentKey.time * 10) / 10,
    endTime: Math.round(nextKey.time * 10) / 10,
    duration: Math.round(duration * 10) / 10,
    rangeStr: `${startTimeStr} - ${endTimeStr}`
  };
}

export function setKeyframeStartTime(timeline: TimelineKeyframe[] | undefined, keyframeId: string, newStartTime: number): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  const kf = list.find(k => k.id === keyframeId);
  if (kf) {
    kf.time = Math.round((((newStartTime % 24) + 24) % 24) * 10) / 10;
  }
  list.sort((a, b) => a.time - b.time);
  return list;
}

export function setKeyframeEndTime(timeline: TimelineKeyframe[] | undefined, keyframeId: string, newEndTime: number): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  const sorted = [...list].sort((a, b) => a.time - b.time);
  const index = sorted.findIndex(k => k.id === keyframeId);
  if (index !== -1) {
    const nextKey = sorted[(index + 1) % sorted.length];
    const targetKf = list.find(k => k.id === nextKey.id);
    if (targetKf) {
      targetKf.time = Math.round((((newEndTime % 24) + 24) % 24) * 10) / 10;
    }
  }
  list.sort((a, b) => a.time - b.time);
  return list;
}

export function setKeyframeDuration(timeline: TimelineKeyframe[] | undefined, keyframeId: string, newDuration: number): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  const sorted = [...list].sort((a, b) => a.time - b.time);
  const index = sorted.findIndex(k => k.id === keyframeId);
  if (index !== -1) {
    const currentKf = sorted[index];
    const nextKey = sorted[(index + 1) % sorted.length];
    const targetKf = list.find(k => k.id === nextKey.id);
    if (targetKf) {
      const calcEnd = (currentKf.time + Math.max(0.1, newDuration)) % 24;
      targetKf.time = Math.round(calcEnd * 10) / 10;
    }
  }
  list.sort((a, b) => a.time - b.time);
  return list;
}

export function updateKeyframeLabel(timeline: TimelineKeyframe[] | undefined, keyframeId: string, newLabel: string): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  const kf = list.find(k => k.id === keyframeId);
  if (kf && newLabel.trim()) {
    kf.label = newLabel.trim();
  }
  return list;
}

export function addPresetKeyframeToTimeline(
  timeline: TimelineKeyframe[] | undefined,
  presetType: "night" | "sunrise" | "noon" | "sunset" | "custom",
  customTime?: number,
  customLabel?: string,
  copyFromKeyframeId?: string
): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));

  let baseTemplate: Partial<TimelineKeyframe> = {};
  let defaultTime = 12;
  let defaultLabel = "Nuevo Estado";

  const defaultPresets: Record<string, Partial<TimelineKeyframe>> = {
    night: {
      time: 0,
      label: "Noche",
      sunColor: "#8899bb",
      sunIntensity: 0.15,
      ambientColor: "#111122",
      ambientIntensity: 0.2,
      sunElevation: -35,
      sunAzimuth: 360,
      environmentIntensity: 0.6,
      backgroundIntensity: 0.8,
      enableSkyboxFog: true,
      fogColor: "#020210",
      fogNear: 10,
      fogFar: 40,
      enableStars: true
    },
    sunrise: {
      time: 6,
      label: "Amanecer",
      sunColor: "#ff5722",
      sunIntensity: 0.65,
      ambientColor: "#33235f",
      ambientIntensity: 0.45,
      sunElevation: 5,
      sunAzimuth: 90,
      environmentIntensity: 0.85,
      backgroundIntensity: 1.0,
      enableSkyboxFog: true,
      fogColor: "#ffaa77",
      fogNear: 15,
      fogFar: 65,
      enableStars: false
    },
    noon: {
      time: 12,
      label: "Mediodía",
      sunColor: "#ffffff",
      sunIntensity: 0.95,
      ambientColor: "#ffffff",
      ambientIntensity: 0.65,
      sunElevation: 75,
      sunAzimuth: 180,
      environmentIntensity: 1.0,
      backgroundIntensity: 1.0,
      enableSkyboxFog: false,
      fogColor: "#87ceeb",
      fogNear: 20,
      fogFar: 80,
      enableStars: false
    },
    sunset: {
      time: 18,
      label: "Atardecer",
      sunColor: "#ff8f70",
      sunIntensity: 0.65,
      ambientColor: "#33235f",
      ambientIntensity: 0.45,
      sunElevation: 5,
      sunAzimuth: 270,
      environmentIntensity: 0.9,
      backgroundIntensity: 1.0,
      enableSkyboxFog: true,
      fogColor: "#ffae88",
      fogNear: 15,
      fogFar: 65,
      enableStars: false
    }
  };

  if (presetType in defaultPresets) {
    baseTemplate = { ...defaultPresets[presetType] };
    defaultTime = baseTemplate.time!;
    defaultLabel = baseTemplate.label!;
  } else if (copyFromKeyframeId) {
    const found = list.find(k => k.id === copyFromKeyframeId);
    if (found) {
      baseTemplate = { ...found };
    }
  }

  const finalTime = customTime !== undefined ? ((customTime % 24) + 24) % 24 : defaultTime;
  const finalLabel = customLabel || defaultLabel;

  if (!baseTemplate.sunColor) {
    const interpolated = interpolateTimelineState(list, finalTime);
    baseTemplate = {
      skyType: interpolated.skyType,
      lightMode: interpolated.lightMode,
      shadowQuality: interpolated.shadowQuality,
      sunColor: interpolated.sunColor,
      sunIntensity: interpolated.sunIntensity,
      ambientColor: interpolated.ambientColor,
      ambientIntensity: interpolated.ambientIntensity,
      enableSunLight: interpolated.enableSunLight,
      enableAmbientLight: interpolated.enableAmbientLight,
      sunElevation: interpolated.sunElevation,
      sunAzimuth: interpolated.sunAzimuth,
      environmentIntensity: interpolated.environmentIntensity,
      backgroundIntensity: interpolated.backgroundIntensity,
      backgroundBlurriness: interpolated.backgroundBlurriness,
      skyboxRotation: interpolated.skyboxRotation,
      enableSkyboxFog: interpolated.enableSkyboxFog,
      fogColor: interpolated.fogColor,
      fogNear: interpolated.fogNear,
      fogFar: interpolated.fogFar,
      enableStars: interpolated.enableStars,
      enableVisibleSun: interpolated.enableVisibleSun,
      visibleSunSize: interpolated.visibleSunSize,
      visibleSunIntensity: interpolated.visibleSunIntensity,
      transitionMode: interpolated.transitionMode,
      skyTurbidity: interpolated.skyTurbidity,
      skyRayleigh: interpolated.skyRayleigh,
      skyMieCoefficient: interpolated.skyMieCoefficient,
      skyMieDirectionalG: interpolated.skyMieDirectionalG
    };
  }

  const newId = "kf_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const newKf: TimelineKeyframe = normalizeTimelineKeyframe({
    ...baseTemplate,
    id: newId,
    time: Math.round(finalTime * 10) / 10,
    label: finalLabel,
    icon: baseTemplate.icon || ""
  }, list.length);

  list.push(newKf);
  list.sort((a, b) => a.time - b.time);
  return list;
}

export function addKeyframeToTimeline(
  timeline: TimelineKeyframe[] | undefined,
  targetTime?: number
): TimelineKeyframe[] {
  return addPresetKeyframeToTimeline(timeline, "custom", targetTime);
}

export function removeKeyframeFromTimeline(
  timeline: TimelineKeyframe[] | undefined,
  keyframeId: string
): TimelineKeyframe[] {
  const list = normalizeTimeline(timeline).map(k => ({ ...k }));
  if (list.length <= 2) return list; // Cannot remove if 2 or fewer keyframes
  return list.filter(k => k.id !== keyframeId);
}

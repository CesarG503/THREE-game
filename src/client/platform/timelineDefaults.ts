import * as THREE from "three";

export interface TimelineKeyframe {
  id: string;
  time: number; // 0.0 a 24.0 (ej. 0 = 00:00, 6 = 06:00, 12 = 12:00, 18 = 18:00)
  label: string;
  icon: string;
  skyType?: string;
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  sunElevation: number;
  sunAzimuth: number;
  environmentIntensity: number;
  backgroundIntensity: number;
  enableSkyboxFog: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  enableStars: boolean;
}

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
  const list = timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE;
  const sorted = [...list].sort((a, b) => a.time - b.time);

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

  const cSun1 = new THREE.Color(k1.sunColor);
  const cSun2 = new THREE.Color(k2.sunColor);
  const lerpSunCol = cSun1.lerp(cSun2, factor);

  const cAmb1 = new THREE.Color(k1.ambientColor);
  const cAmb2 = new THREE.Color(k2.ambientColor);
  const lerpAmbCol = cAmb1.lerp(cAmb2, factor);

  const cFog1 = new THREE.Color(k1.fogColor);
  const cFog2 = new THREE.Color(k2.fogColor);
  const lerpFogCol = cFog1.lerp(cFog2, factor);

  const lerpSunInt = THREE.MathUtils.lerp(k1.sunIntensity, k2.sunIntensity, factor);
  const lerpAmbInt = THREE.MathUtils.lerp(k1.ambientIntensity, k2.ambientIntensity, factor);
  const lerpSunElev = THREE.MathUtils.lerp(k1.sunElevation, k2.sunElevation, factor);
  const lerpSunAzim = THREE.MathUtils.lerp(k1.sunAzimuth, k2.sunAzimuth, factor);
  const lerpEnvInt = THREE.MathUtils.lerp(k1.environmentIntensity, k2.environmentIntensity, factor);
  const lerpBgInt = THREE.MathUtils.lerp(k1.backgroundIntensity, k2.backgroundIntensity, factor);
  const lerpFogNear = THREE.MathUtils.lerp(k1.fogNear, k2.fogNear, factor);
  const lerpFogFar = THREE.MathUtils.lerp(k1.fogFar, k2.fogFar, factor);

  const enableStars = lerpSunElev < 0 || (factor < 0.5 ? k1.enableStars : k2.enableStars);
  const enableSkyboxFog = factor < 0.5 ? k1.enableSkyboxFog : k2.enableSkyboxFog;

  return {
    sunColor: "#" + lerpSunCol.getHexString(),
    sunIntensity: lerpSunInt,
    ambientColor: "#" + lerpAmbCol.getHexString(),
    ambientIntensity: lerpAmbInt,
    sunElevation: lerpSunElev,
    sunAzimuth: lerpSunAzim,
    environmentIntensity: lerpEnvInt,
    backgroundIntensity: lerpBgInt,
    enableSkyboxFog,
    fogColor: "#" + lerpFogCol.getHexString(),
    fogNear: lerpFogNear,
    fogFar: lerpFogFar,
    enableStars,
    k1,
    k2,
    factor
  };
}

export function updateKeyframeInTimeline(
  timeline: TimelineKeyframe[] | undefined,
  timeOfDay: number,
  partialProps: Partial<TimelineKeyframe>
): TimelineKeyframe[] {
  const list = timeline && timeline.length > 0 ? timeline.map(k => ({ ...k })) : DEFAULT_DAY_NIGHT_TIMELINE.map(k => ({ ...k }));
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

  list[closestIndex] = {
    ...list[closestIndex],
    ...partialProps
  };

  return list;
}

export const DEFAULT_DAY_NIGHT_PROFILES = [
  {
    id: "estandar",
    name: "Estándar",
    isDefault: true,
    timeline: DEFAULT_DAY_NIGHT_TIMELINE.map(k => ({ ...k }))
  },
  {
    id: "personalizado",
    name: "Personalizado",
    isDefault: false,
    timeline: DEFAULT_DAY_NIGHT_TIMELINE.map(k => ({ ...k }))
  }
];

export function getKeyframeDurationRange(timeline: TimelineKeyframe[] | undefined, keyframeId: string): string {
  const info = getKeyframeTimeAndDuration(timeline, keyframeId);
  return info.rangeStr;
}

export function getKeyframeTimeAndDuration(timeline: TimelineKeyframe[] | undefined, keyframeId: string) {
  const list = timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE;
  const sorted = [...list].sort((a, b) => a.time - b.time);
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
  const list = (timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE).map(k => ({ ...k }));
  const kf = list.find(k => k.id === keyframeId);
  if (kf) {
    kf.time = Math.round((((newStartTime % 24) + 24) % 24) * 10) / 10;
  }
  list.sort((a, b) => a.time - b.time);
  return list;
}

export function setKeyframeEndTime(timeline: TimelineKeyframe[] | undefined, keyframeId: string, newEndTime: number): TimelineKeyframe[] {
  const list = (timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE).map(k => ({ ...k }));
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
  const list = (timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE).map(k => ({ ...k }));
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
  const list = (timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE).map(k => ({ ...k }));
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
  const list = (timeline && timeline.length > 0 ? timeline : DEFAULT_DAY_NIGHT_TIMELINE).map(k => ({ ...k }));

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
      sunColor: interpolated.sunColor,
      sunIntensity: interpolated.sunIntensity,
      ambientColor: interpolated.ambientColor,
      ambientIntensity: interpolated.ambientIntensity,
      sunElevation: interpolated.sunElevation,
      sunAzimuth: interpolated.sunAzimuth,
      environmentIntensity: interpolated.environmentIntensity,
      backgroundIntensity: interpolated.backgroundIntensity,
      enableSkyboxFog: interpolated.enableSkyboxFog,
      fogColor: interpolated.fogColor,
      fogNear: interpolated.fogNear,
      fogFar: interpolated.fogFar,
      enableStars: interpolated.enableStars
    };
  }

  const newId = "kf_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const newKf: TimelineKeyframe = {
    id: newId,
    time: Math.round(finalTime * 10) / 10,
    label: finalLabel,
    icon: "",
    sunColor: baseTemplate.sunColor || "#ffffff",
    sunIntensity: baseTemplate.sunIntensity ?? 0.8,
    ambientColor: baseTemplate.ambientColor || "#333333",
    ambientIntensity: baseTemplate.ambientIntensity ?? 0.5,
    sunElevation: baseTemplate.sunElevation ?? 45,
    sunAzimuth: baseTemplate.sunAzimuth ?? 180,
    environmentIntensity: baseTemplate.environmentIntensity ?? 1.0,
    backgroundIntensity: baseTemplate.backgroundIntensity ?? 1.0,
    enableSkyboxFog: !!baseTemplate.enableSkyboxFog,
    fogColor: baseTemplate.fogColor || "#87ceeb",
    fogNear: baseTemplate.fogNear ?? 10,
    fogFar: baseTemplate.fogFar ?? 50,
    enableStars: !!baseTemplate.enableStars
  };

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
  const list = timeline && timeline.length > 0 ? timeline.map(k => ({ ...k })) : DEFAULT_DAY_NIGHT_TIMELINE.map(k => ({ ...k }));
  if (list.length <= 2) return list; // Cannot remove if 2 or fewer keyframes
  return list.filter(k => k.id !== keyframeId);
}


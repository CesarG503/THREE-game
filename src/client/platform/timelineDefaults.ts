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


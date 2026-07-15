export interface SkyboxPresetDefaults {
  name: string;
  themeDescription: string;
  environmentIntensity: number;
  backgroundIntensity: number;
  backgroundBlurriness: number;
  skyboxRotation: number;
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  sunElevation: number;
  sunAzimuth: number;
  enableSkyboxFog: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  skyTurbidity?: number;
  skyRayleigh?: number;
  skyMieCoefficient?: number;
  skyMieDirectionalG?: number;
}

const SKYBOX_VALUE_PREFIX = "skybox:";

export const KNOWN_SKYBOX_PRESETS: { [key: string]: SkyboxPresetDefaults } = {
  // Preset para Skybox #14 (Verde Tóxico / Bosque Alienígena)
  "14": {
    name: "Skybox #14 (Bosque Tóxico / Neón Verde)",
    themeDescription: "Temática Verde Neón / Tóxica. Aplica reflejos ambientales verdosos sobre las superficies 3D.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#75ff60",
    sunIntensity: 0.9,
    ambientColor: "#205028",
    ambientIntensity: 0.7,
    sunElevation: 45,
    sunAzimuth: 180,
    enableSkyboxFog: true,
    fogColor: "#15351e",
    fogNear: 15,
    fogFar: 75
  },
  // Preset para Skybox #04 (Día Claro Cristalino)
  "04": {
    name: "Skybox #04 (Día Claro Cristalino)",
    themeDescription: "Temática Día Soleado Neutro. Reflejos azules naturales y luz solar pura.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ffffff",
    sunIntensity: 0.8,
    ambientColor: "#e6f4ff",
    ambientIntensity: 0.6,
    sunElevation: 55,
    sunAzimuth: 160,
    enableSkyboxFog: false,
    fogColor: "#87ceeb",
    fogNear: 20,
    fogFar: 80
  },
  // Preset para Skybox #01 (Atardecer Cálido / Dorado)
  "01": {
    name: "Skybox #01 (Atardecer Dorado / Fuego)",
    themeDescription: "Temática Atardecer Cálido. Tonos anaranjados y rojizos con sombras alargadas.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ffaa44",
    sunIntensity: 0.85,
    ambientColor: "#442255",
    ambientIntensity: 0.5,
    sunElevation: 12,
    sunAzimuth: 220,
    enableSkyboxFog: true,
    fogColor: "#ff6633",
    fogNear: 10,
    fogFar: 60
  },
  // Preset para Skybox #08 (Noche Cósmica / Espacio Oscuro)
  "08": {
    name: "Skybox #08 (Noche Cósmica / Estelar)",
    themeDescription: "Temática Noche Profunda. Reflejos oscuros azulados y luz tenue de luna.",
    environmentIntensity: 0.7,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#8899bb",
    sunIntensity: 0.2,
    ambientColor: "#111827",
    ambientIntensity: 0.3,
    sunElevation: 15,
    sunAzimuth: 300,
    enableSkyboxFog: true,
    fogColor: "#050b18",
    fogNear: 25,
    fogFar: 90
  }
};

export const DEFAULT_COLOR_SKIES: { [key: string]: SkyboxPresetDefaults } = {
  day: {
    name: "Cielo Día Estándar",
    themeDescription: "Cielo azul estándar con luz solar balanceada.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ffffff",
    sunIntensity: 0.8,
    ambientColor: "#ffffff",
    ambientIntensity: 0.6,
    sunElevation: 45,
    sunAzimuth: 180,
    enableSkyboxFog: true,
    fogColor: "#87ceeb",
    fogNear: 10,
    fogFar: 50
  },
  night: {
    name: "Cielo Noche Oscura",
    themeDescription: "Ambiente nocturno con luz de luna azulada.",
    environmentIntensity: 0.5,
    backgroundIntensity: 0.8,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#8899bb",
    sunIntensity: 0.1,
    ambientColor: "#111122",
    ambientIntensity: 0.1,
    sunElevation: -30,
    sunAzimuth: 180,
    enableSkyboxFog: true,
    fogColor: "#020210",
    fogNear: 10,
    fogFar: 40
  },
  sunset: {
    name: "Cielo Atardecer",
    themeDescription: "Ambiente cálido de ocaso solar.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ff8f70",
    sunIntensity: 0.6,
    ambientColor: "#33235f",
    ambientIntensity: 0.4,
    sunElevation: 8,
    sunAzimuth: 200,
    enableSkyboxFog: true,
    fogColor: "#ffae88",
    fogNear: 10,
    fogFar: 60
  },
  shader: {
    name: "Cielo Atmosférico Shader",
    themeDescription: "Simulación física Rayleigh/Mie con posición solar dinámica.",
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ffffff",
    sunIntensity: 0.9,
    ambientColor: "#ffffff",
    ambientIntensity: 0.6,
    sunElevation: 45,
    sunAzimuth: 180,
    enableSkyboxFog: false,
    fogColor: "#87ceeb",
    fogNear: 10,
    fogFar: 50,
    skyTurbidity: 10,
    skyRayleigh: 2,
    skyMieCoefficient: 0.005,
    skyMieDirectionalG: 0.8
  }
};

export function extractSkyboxIndex(skyType: string): string | null {
  if (typeof skyType !== "string" || !skyType.startsWith(SKYBOX_VALUE_PREFIX)) return null;
  const match = skyType.match(/Cubemap_Sky_(\d+)/i);
  return match ? match[1] : null;
}

export function getSkyboxPresetDefaults(skyType: string): SkyboxPresetDefaults {
  if (!skyType) return DEFAULT_COLOR_SKIES.day;

  if (DEFAULT_COLOR_SKIES[skyType]) {
    return DEFAULT_COLOR_SKIES[skyType];
  }

  const idx = extractSkyboxIndex(skyType);
  if (idx && KNOWN_SKYBOX_PRESETS[idx]) {
    return KNOWN_SKYBOX_PRESETS[idx];
  }

  const numericIdx = idx ? parseInt(idx, 10) : 0;
  return {
    name: idx ? `Skybox #${idx}` : "Skybox Cubemap",
    themeDescription: `Cubemap de 6 caras #${idx || "personalizado"}. Reflejos de entorno IBL activos.`,
    environmentIntensity: 1.0,
    backgroundIntensity: 1.0,
    backgroundBlurriness: 0.0,
    skyboxRotation: 0,
    sunColor: "#ffffff",
    sunIntensity: 0.8,
    ambientColor: "#ffffff",
    ambientIntensity: 0.6,
    sunElevation: 45,
    sunAzimuth: 180 + (numericIdx * 17) % 360,
    enableSkyboxFog: false,
    fogColor: "#87ceeb",
    fogNear: 15,
    fogFar: 75
  };
}

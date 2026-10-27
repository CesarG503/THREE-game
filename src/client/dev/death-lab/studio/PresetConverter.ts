/**
 * PresetConverter.ts — Declarative preset definitions for Death Experience Studio.
 *
 * Demonstrates that V01, V02, V04, V16 and custom mashups are pure data compositions
 * built from the exact same atomic modules available to creators.
 */

import type { DeathExperience } from "./DeathExperienceTypes";

/**
 * V01 Preset — Tactical Military Shooter AAA
 */
export function createV01TacticalPreset(): DeathExperience {
  return {
    id: "preset_v01_tactical",
    version: 1,
    name: "V01 — Tactical / Shooter AAA (Studio)",
    description: "Cinemática balística militar con colapso articular, caída de arma y retícula óptica.",
    author: "VIPER.IO Studio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 3800,
    scene: {
      fog: { color: 0x0c121e, density: 0.03 },
      ambientLight: { color: 0x94a3b8, intensity: 0.35 },
      directionalLight: { color: 0xf1f5f9, intensity: 1.2 },
      accentLight: { color: 0xef4444, intensity: 2.5, position: [0, 1.5, 0] },
      particles: "none",
      background: 0x060913,
    },
    conditions: [
      {
        property: "hitLocation",
        operator: "eq",
        value: "head",
        trackOverrides: [
          { trackId: "track_hud_sniper", params: { color: "#dc2626" } },
        ],
      },
    ],
    tracks: [
      {
        id: "track_audio_tactical",
        name: "Audio: Tactical Pulse",
        moduleId: "audio_tactical_pulse",
        enabled: true,
        startTime: 0,
        duration: 800,
        params: {},
        keyframes: [],
      },
      {
        id: "track_char_collapse",
        name: "Character: Kinematic Collapse",
        moduleId: "char_kinematic_collapse",
        enabled: true,
        startTime: 80,
        duration: 1350,
        params: { duration: 1350, ease: "outCubic" },
        keyframes: [],
      },
      {
        id: "track_fx_weapon",
        name: "Effect: Dropped Weapon Ballistics",
        moduleId: "fx_weapon_drop",
        enabled: true,
        startTime: 180,
        duration: 650,
        params: { skidDistance: 1.25, bounceHeight: 1.35, duration: 650 },
        keyframes: [],
      },
      {
        id: "track_cam_dolly",
        name: "Camera: Ground Dolly & Pan",
        moduleId: "cam_ground_dolly",
        enabled: true,
        startTime: 100,
        duration: 3400,
        params: { fov: 54, dollyDuration: 1400, panDuration: 1700, panDelay: 1700 },
        keyframes: [],
      },
      {
        id: "track_hud_ribbon",
        name: "HUD: Tactical Ribbon",
        moduleId: "hud_tactical_ribbon",
        enabled: true,
        startTime: 1200,
        duration: 2000,
        params: { accentColor: "#ef4444" },
        keyframes: [],
      },
      {
        id: "track_hud_sniper",
        name: "HUD: Optical Reticle",
        moduleId: "hud_sniper_reticle",
        enabled: true,
        startTime: 2100,
        duration: 1500,
        params: { color: "#ef4444" },
        keyframes: [],
      },
      {
        id: "track_hud_actions",
        name: "HUD: Action Prompts",
        moduleId: "hud_action_buttons",
        enabled: true,
        startTime: 1400,
        duration: 2000,
        params: { respawnText: "REAPARECER (05s)" },
        keyframes: [],
      },
    ],
  };
}

/**
 * V02 Preset — Battle Royale Chaos
 */
export function createV02BattleRoyalePreset(): DeathExperience {
  return {
    id: "preset_v02_battle_royale",
    version: 1,
    name: "V02 — Battle Royale Chaos (Studio)",
    description: "Voltereta cómica, dispersión radial de voxels 3D, onda expansiva y rango gigante estampado.",
    author: "VIPER.IO Studio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 3600,
    scene: {
      fog: { color: 0x180d2e, density: 0.015 },
      ambientLight: { color: 0xffffff, intensity: 0.8 },
      directionalLight: { color: 0xfef08a, intensity: 1.2 },
      accentLight: { color: 0xf43f5e, intensity: 3.0, position: [0, 2.0, 0] },
      particles: "confetti",
      background: 0x110726,
    },
    conditions: [],
    tracks: [
      {
        id: "track_audio_pop",
        name: "Audio: Pop Celebration",
        moduleId: "audio_pop_celebration",
        enabled: true,
        startTime: 0,
        duration: 1000,
        params: {},
        keyframes: [],
      },
      {
        id: "track_char_launch",
        name: "Character: Comedic Launch",
        moduleId: "char_comedic_launch",
        enabled: true,
        startTime: 80,
        duration: 900,
        params: { launchHeight: 2.8, knockbackDist: 3.8, rotations: 2.2, duration: 900 },
        keyframes: [],
      },
      {
        id: "track_fx_voxels",
        name: "Effect: Voxel Burst",
        moduleId: "fx_voxel_burst",
        enabled: true,
        startTime: 100,
        duration: 800,
        params: { voxelCount: 18, burstRadius: 3.2, duration: 800 },
        keyframes: [],
      },
      {
        id: "track_fx_shockwave",
        name: "Effect: Floor Shockwave",
        moduleId: "fx_shockwave",
        enabled: true,
        startTime: 120,
        duration: 1250,
        params: { color: 0xfacc15, maxScale: 14.0, duration: 1250 },
        keyframes: [],
      },
      {
        id: "track_cam_crane",
        name: "Camera: High Crane Overhead",
        moduleId: "cam_crane_overhead",
        enabled: true,
        startTime: 100,
        duration: 1650,
        params: { craneHeight: 7.2, craneDistance: 6.0, fov: 68 },
        keyframes: [],
      },
      {
        id: "track_hud_rank",
        name: "HUD: Stamped Placement #2",
        moduleId: "hud_stamped_rank",
        enabled: true,
        startTime: 220,
        duration: 2500,
        params: { rankText: "#2 / 100", subtitle: "¡CASI LO LOGRAS!" },
        keyframes: [],
      },
      {
        id: "track_hud_actions",
        name: "HUD: Action Buttons",
        moduleId: "hud_action_buttons",
        enabled: true,
        startTime: 600,
        duration: 2000,
        params: { respawnText: "JUGAR DE NUEVO" },
        keyframes: [],
      },
    ],
  };
}

/**
 * V04 Preset — Cyberpunk System Collapse
 */
export function createV04CyberpunkPreset(): DeathExperience {
  return {
    id: "preset_v04_cyberpunk",
    version: 1,
    name: "V04 — Cyberpunk System Collapse (Studio)",
    description: "Fallo neural, clones volumétricos wireframe, desincronización de lente y terminal monospace.",
    author: "VIPER.IO Studio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 3800,
    scene: {
      fog: { color: 0x040410, density: 0.035 },
      ambientLight: { color: 0x06b6d4, intensity: 0.4 },
      directionalLight: { color: 0xff0055, intensity: 0.9 },
      accentLight: { color: 0x00f0ff, intensity: 4.0, position: [-2, 2, 1] },
      particles: "matrix",
      background: 0x03030a,
    },
    conditions: [],
    tracks: [
      {
        id: "track_audio_glitch",
        name: "Audio: Cyber Synth Glitch",
        moduleId: "audio_cyber_glitch",
        enabled: true,
        startTime: 0,
        duration: 1200,
        params: {},
        keyframes: [],
      },
      {
        id: "track_fx_ghosts",
        name: "Effect: Wireframe Glitch Clones",
        moduleId: "fx_glitch_ghosts",
        enabled: true,
        startTime: 60,
        duration: 900,
        params: { maxOffset: 0.48, duration: 900 },
        keyframes: [],
      },
      {
        id: "track_cam_lens_glitch",
        name: "Camera: Lens FOV Desync",
        moduleId: "cam_glitch_desync",
        enabled: true,
        startTime: 70,
        duration: 1500,
        params: { duration: 1500 },
        keyframes: [],
      },
      {
        id: "track_char_collapse",
        name: "Character: Kinematic Collapse",
        moduleId: "char_kinematic_collapse",
        enabled: true,
        startTime: 80,
        duration: 1400,
        params: { duration: 1400, ease: "outQuad" },
        keyframes: [],
      },
      {
        id: "track_hud_terminal",
        name: "HUD: Monospace Kernel Terminal",
        moduleId: "hud_cyber_terminal",
        enabled: true,
        startTime: 180,
        duration: 2500,
        params: { terminalHeader: "// KERNEL PANIC: FATAL EXCEPTION (0xDEAD_C0DE)" },
        keyframes: [],
      },
    ],
  };
}

/**
 * V16 Preset — VIPER.IO Signature Experience
 */
export function createV16ViperSignaturePreset(): DeathExperience {
  return {
    id: "preset_v16_viper_signature",
    version: 1,
    name: "V16 — VIPER.IO Signature (Studio)",
    description: "Bullet-time orbital 360°, anillo de contención veneno, drenaje de armadura y visor curvo OS.",
    author: "VIPER.IO Studio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 4200,
    scene: {
      fog: { color: 0x050c10, density: 0.025 },
      ambientLight: { color: 0x10b981, intensity: 0.45 },
      directionalLight: { color: 0xecfdf5, intensity: 1.2 },
      accentLight: { color: 0x06b6d4, intensity: 3.5, position: [-2, 2.5, 1] },
      particles: "sparks",
      background: 0x02070a,
    },
    conditions: [],
    tracks: [
      {
        id: "track_char_freeze",
        name: "Character: Bullet Freeze Pose",
        moduleId: "char_bullet_freeze",
        enabled: true,
        startTime: 0,
        duration: 3200,
        params: { freezePose: 0.28 },
        keyframes: [],
      },
      {
        id: "track_cam_orbit",
        name: "Camera: 360° Bullet-Time Orbit",
        moduleId: "cam_orbit_360",
        enabled: true,
        startTime: 0,
        duration: 3200,
        params: { sweepAngle: 288, radius: 3.2, duration: 3200 },
        keyframes: [],
      },
      {
        id: "track_fx_shockwave",
        name: "Effect: Venom Containment Ring",
        moduleId: "fx_shockwave",
        enabled: true,
        startTime: 200,
        duration: 2600,
        params: { color: 0x10b981, maxScale: 8.5, duration: 2600 },
        keyframes: [],
      },
      {
        id: "track_fx_drain",
        name: "Effect: Suit Power Drain",
        moduleId: "fx_power_drain",
        enabled: true,
        startTime: 400,
        duration: 2000,
        params: { duration: 2000 },
        keyframes: [],
      },
      {
        id: "track_hud_visor",
        name: "HUD: Curved Helmet Visor OS",
        moduleId: "hud_visor_frame",
        enabled: true,
        startTime: 100,
        duration: 3000,
        params: { color: "#10b981" },
        keyframes: [],
      },
      {
        id: "track_hud_actions",
        name: "HUD: Action Buttons",
        moduleId: "hud_action_buttons",
        enabled: true,
        startTime: 600,
        duration: 2500,
        params: { respawnText: "REAPARECER (05s)" },
        keyframes: [],
      },
    ],
  };
}

/**
 * Mashup A (Requested in User Prompt):
 * "Caída militar + cámara orbital + hologramas cyberpunk + HUD competitivo"
 */
export function createMashupAPreset(): DeathExperience {
  return {
    id: "preset_mashup_a",
    version: 1,
    name: "Mashup A: Tactical-Cyber-Pop",
    description: "Caída táctica + Órbita 360° + Clones Holográficos Cyber + Rango Gigante #2/100.",
    author: "Creator Lab",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 3800,
    scene: {
      fog: { color: 0x080e1a, density: 0.028 },
      ambientLight: { color: 0x38bdf8, intensity: 0.5 },
      directionalLight: { color: 0xff0055, intensity: 1.1 },
      accentLight: { color: 0xfacc15, intensity: 3.5, position: [0, 2.5, 0] },
      particles: "confetti",
      background: 0x040810,
    },
    conditions: [],
    tracks: [
      {
        id: "track_char_collapse",
        name: "Character: Kinematic Collapse (V01)",
        moduleId: "char_kinematic_collapse",
        enabled: true,
        startTime: 80,
        duration: 1350,
        params: { duration: 1350, ease: "outCubic" },
        keyframes: [],
      },
      {
        id: "track_cam_orbit",
        name: "Camera: 360° Orbit (V16)",
        moduleId: "cam_orbit_360",
        enabled: true,
        startTime: 0,
        duration: 3400,
        params: { sweepAngle: 360, radius: 3.5, duration: 3400 },
        keyframes: [],
      },
      {
        id: "track_fx_ghosts",
        name: "Effect: Wireframe Clones (V04)",
        moduleId: "fx_glitch_ghosts",
        enabled: true,
        startTime: 120,
        duration: 1000,
        params: { maxOffset: 0.6, duration: 1000 },
        keyframes: [],
      },
      {
        id: "track_fx_shockwave",
        name: "Effect: Gold Shockwave (V02)",
        moduleId: "fx_shockwave",
        enabled: true,
        startTime: 150,
        duration: 1400,
        params: { color: 0xfacc15, maxScale: 12.0, duration: 1400 },
        keyframes: [],
      },
      {
        id: "track_hud_rank",
        name: "HUD: Stamped Placement (V02)",
        moduleId: "hud_stamped_rank",
        enabled: true,
        startTime: 300,
        duration: 2500,
        params: { rankText: "#2 / 100", subtitle: "¡DUELO CIBERNÉTICO!" },
        keyframes: [],
      },
      {
        id: "track_hud_ribbon",
        name: "HUD: Tactical Ribbon (V01)",
        moduleId: "hud_tactical_ribbon",
        enabled: true,
        startTime: 1200,
        duration: 2000,
        params: { accentColor: "#00f0ff" },
        keyframes: [],
      },
    ],
  };
}

/**
 * Mashup B (Requested in User Prompt):
 * "Personaje convertido en fragmentos + cámara lenta + partículas cómicas + texto estilo arcade"
 */
export function createMashupBPreset(): DeathExperience {
  return {
    id: "preset_mashup_b",
    version: 1,
    name: "Mashup B: Comedic Fragmentation Arcade",
    description: "Lanzamiento cósmico + dispersión de voxels + lente desincronizado + terminal cyberpunk.",
    author: "Creator Lab",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: 3600,
    scene: {
      fog: { color: 0x140a24, density: 0.02 },
      ambientLight: { color: 0xf43f5e, intensity: 0.6 },
      directionalLight: { color: 0x38bdf8, intensity: 1.2 },
      accentLight: { color: 0x10b981, intensity: 3.0, position: [0, 2, 0] },
      particles: "sparks",
      background: 0x090412,
    },
    conditions: [],
    tracks: [
      {
        id: "track_char_launch",
        name: "Character: Comedic Launch",
        moduleId: "char_comedic_launch",
        enabled: true,
        startTime: 80,
        duration: 900,
        params: { launchHeight: 3.5, knockbackDist: 4.2, rotations: 3.0, duration: 900 },
        keyframes: [],
      },
      {
        id: "track_fx_voxels",
        name: "Effect: Voxel Burst (V02)",
        moduleId: "fx_voxel_burst",
        enabled: true,
        startTime: 100,
        duration: 850,
        params: { voxelCount: 24, burstRadius: 4.0, duration: 850 },
        keyframes: [],
      },
      {
        id: "track_cam_glitch",
        name: "Camera: Lens FOV Glitch (V04)",
        moduleId: "cam_glitch_desync",
        enabled: true,
        startTime: 70,
        duration: 1600,
        params: { duration: 1600 },
        keyframes: [],
      },
      {
        id: "track_hud_terminal",
        name: "HUD: Cyber Terminal (V04)",
        moduleId: "hud_cyber_terminal",
        enabled: true,
        startTime: 200,
        duration: 2400,
        params: { terminalHeader: "// PHYSICS OVERFLOW DETECTED" },
        keyframes: [],
      },
    ],
  };
}

export const ALL_BUILTIN_PRESETS: DeathExperience[] = [
  createV01TacticalPreset(),
  createV02BattleRoyalePreset(),
  createV04CyberpunkPreset(),
  createV16ViperSignaturePreset(),
  createMashupAPreset(),
  createMashupBPreset(),
];

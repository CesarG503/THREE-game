import * as THREE from "three";

/**
 * Configuration for weapon offsets and procedural animations.
 * This allows fine-tuning each weapon's position/rotation in the player's hand
 * and defining additional movements without touching core character code.
 */
export const WEAPON_SETTINGS = {
  // ID must match the 'id' property in ConstructionMenu weaponsConfig
  gun_pistol: {
    handOffset: new THREE.Vector3(-0.17, -0.05, 0),
    // 225deg - 135deg (3x45deg) = 90deg = PI/2 -> apunta al lugar correcto
    handRotation: new THREE.Euler(0, Math.PI / 2, 0),
    extraAnims: {
      throwPower: 1.0,
      spinSpeed: 2.0
    }
  },
  gun_p90: {
    handOffset: new THREE.Vector3(0, 0, 0),
    // 180deg + 180deg = 360deg = 0 -> muzzle apunta hacia afuera (al frente)
    handRotation: new THREE.Euler(0, 0, 0),
    extraAnims: {}
  },
  gun_rifle: {
    handOffset: new THREE.Vector3(-0.5, 0, 0),
    handRotation: new THREE.Euler(0, 0, 0),
    extraAnims: {}
  },
  gun_shotgun: {
    handOffset: new THREE.Vector3(0.2, 0.05, 0),
    handRotation: new THREE.Euler(0, 0, 0),
    extraAnims: {}
  },
  gun_sniper: {
    handOffset: new THREE.Vector3(-0.5, 0.07, 0),
    handRotation: new THREE.Euler(0, 0, 0),
    extraAnims: {}
  }
};

export const WEAPONS_CONFIG = [
  {
    id: "gun_pistol",
    name: "Pistola",
    modelPath: "/assets/gun animated/GLB/Pistol.glb",
    damage: 15,
    cooldown: 0.2,
    isAuto: false,
    recoil: 4.0,
    modelScale: 0.0006,
    shotSpeed: 60.0
  },
  {
    id: "gun_p90",
    name: "P90",
    modelPath: "/assets/gun animated/GLB/P90.glb",
    damage: 8,
    cooldown: 0.1,
    isAuto: true,
    recoil: 2.0,
    modelScale: 0.001,
    shotSpeed: 80.0
  },
  {
    id: "gun_rifle",
    name: "Rifle de Asalto",
    modelPath: "/assets/gun animated/GLB/Rifle.glb",
    damage: 20,
    cooldown: 0.15,
    isAuto: true,
    recoil: 5.0,
    modelScale: 0.002,
    shotSpeed: 100.0
  },
  {
    id: "gun_shotgun",
    name: "Escopeta",
    modelPath: "/assets/gun animated/GLB/Shotgun.glb",
    damage: 70,
    cooldown: 1.0,
    isAuto: false,
    recoil: 10.0,
    modelScale: 0.002,
    shotSpeed: 40.0,
    bulletDrop: 2.0
  },
  {
    id: "gun_sniper",
    name: "Francotirador",
    modelPath: "/assets/gun animated/GLB/SniperRifle.glb",
    damage: 100,
    cooldown: 1.5,
    isAuto: false,
    recoil: 15.0,
    modelScale: 0.002,
    shotSpeed: 150.0,
    bulletDrop: 0.1,
    hasTracer: true
  }
];

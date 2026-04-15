import * as THREE from "three";

/**
 * Configuration for weapon offsets and procedural animations.
 * This allows fine-tuning each weapon's position/rotation in the player's hand
 * and defining additional movements without touching core character code.
 */
export const WEAPON_SETTINGS = {
    // ID must match the 'id' property in ConstructionMenu weaponsConfig
    "gun_pistol": {
        handOffset: new THREE.Vector3(0, 0, 0),
        // 225° - 135° (3×45°) = 90° = PI/2  → apunta al lugar correcto
        handRotation: new THREE.Euler(0, Math.PI / 2, 0),
        extraAnims: {
            throwPower: 1.0,
            spinSpeed: 2.0
        }
    },
    "gun_p90": {
        handOffset: new THREE.Vector3(0, 0, 0),
        // 180° + 180° = 360° = 0  → muzzle apunta hacia afuera (al frente)
        handRotation: new THREE.Euler(0, 0, 0),
        extraAnims: {}
    },
    "gun_rifle": {
        handOffset: new THREE.Vector3(-0.5, 0, 0),
        handRotation: new THREE.Euler(0, 0, 0),
        extraAnims: {}
    },
    "gun_shotgun": {
        handOffset: new THREE.Vector3(0.2, 0.05, 0),
        handRotation: new THREE.Euler(0, 0, 0),
        extraAnims: {}
    },
    "gun_sniper": {
        handOffset: new THREE.Vector3(-0.5, 0.07, 0),
        handRotation: new THREE.Euler(0, 0, 0),
        extraAnims: {}
    }
};

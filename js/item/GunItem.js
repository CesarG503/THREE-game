import * as THREE from "three";
import { Item } from "./Item.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { Projectile } from "../weapons/Projectile.js";

export class GunItem extends Item {
    constructor() {
        super("gun", "Pistola", "./assets/gun/gun_d.png"); // Using diff texture as icon for now, or maybe create a snapshot?
        // Actually, let's use a generic gun icon if available, or just the side view texture locally if it looks ok.
        // User provided assets/gun/*.png are textures.
        // We'll use gun_d.png for icon for now, it might be the diffuse map.

        this.type = "weapon";
        this.damage = 10;
        this.cooldown = 0.5; // Seconds
        this.lastShotTime = 0;

        this.model = null;
        this.isLoading = false;

        // Load Model immediately
        this.loadModel();
    }

    loadModel() {
        if (this.model || this.isLoading) return;
        this.isLoading = true;

        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();

        // Load Textures
        const path = "./assets/gun/";
        const mapD = textureLoader.load(path + "gun_d.png");
        const mapN = textureLoader.load(path + "gun_n.png");
        const mapS = textureLoader.load(path + "gun_m.png"); // Metallic/Specular? often _m is metallic/roughness
        const mapAO = textureLoader.load(path + "gun_ao.png");
        // const mapR = textureLoader.load(path + "gun_r.png"); // Roughness?

        // Fix encoding
        mapD.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshStandardMaterial({
            map: mapD,
            normalMap: mapN,
            roughnessMap: mapS, // Assuming m is roughness/metallic packed or simply roughness? 
            // _m often means Metallic. _r means Roughness.
            // Let's assume _m is Metallic and _r is Roughness.
            roughness: 0.5,
            metalness: 0.8,
            aoMap: mapAO
        });

        // Load Roughness if available
        const mapR = textureLoader.load(path + "gun_r.png");
        material.roughnessMap = mapR;
        material.metalnessMap = mapS; // Try this mapping

        loader.load(path + "gun.obj", (obj) => {
            this.model = obj;

            // Apply Material
            obj.traverse(child => {
                if (child.isMesh) {
                    child.material = material;
                    child.castShadow = true;
                }
            });

            // Scale & Position adjustments for "Hand" local space
            // Based on instructions: 
            // mesh["player_gun"].scale.set(100, 100, 100); -> user said adjust this.
            // Let's start with 10 or 100 as per instructions?
            // "Adjust the 100 to 1 or 0.1 if it's too big"
            // Let's try 20 first.
            // Scaled up for visibility as requested
            obj.scale.set(40, 40, 40);

            // Rotation corrections?
            // OBJ often needs rotation.
            // Adjust to point forward (-Z) when attached to hand.
            // Hand usually points -Z or +X depending on rig. 
            // We can tweak this in PolygonModelSkin `setHeldItem` or here.

            this.isLoading = false;
            console.log("Gun Model Loaded");
            if (this.onLoadCallback) this.onLoadCallback();
        }, undefined, (err) => {
            console.error("Error loading Gun OBJ:", err);
            this.isLoading = false;
        });
    }

    setOnLoad(callback) {
        this.onLoadCallback = callback;
        if (this.model) callback(); // If already loaded, trigger immediately
    }

    use(context) {
        const now = Date.now() / 1000;
        if (now - this.lastShotTime < this.cooldown) return false;

        // context: { scene, world, origin, direction, ... }
        this.lastShotTime = now;

        console.log("Bang!");

        // Spawn Projectile
        if (context.registerProjectile) {
            const speed = 50;
            const proj = new Projectile(
                context.scene,
                context.world,
                context.origin,
                context.direction,
                speed,
                this.damage
            );
            context.registerProjectile(proj);
        }

        // Play Sound?
        // TODO: SoundManager logic

        return true; // Consumed action, but item not consumed (ammo logic future?)
    }

    getEquipMesh() {
        return this.model ? this.model.clone() : null; // Clone to allow multiple instances/re-adding
    }
}

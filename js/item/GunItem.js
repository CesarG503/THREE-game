import * as THREE from "three";
import { Item } from "./Item.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
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
        this.equippedHand = "right"; // "right" or "left" default
        this.recoil = 5.0; // Retroceso de la cámara
        this.isAuto = false; // Disparo automático
        this.lastShotTime = 0;

        this.isReloading = false;

        // Animaciones Procedurales (Retroceso)
        this.gunImpulse = 0;
        this.gunRecoilRecovery = 0;

        // Animaciones Procedurales (Resorte Recarga)
        this.springReloadZ = 0;
        this.springReloadVelocityZ = 0;
        this.springReloadImpulseZ = 0;
        this.SPRING_STIFFNESS = 0.1;
        this.SPRING_DAMPING = 0.85;

        this.model = null;
        this.equipGroup = new THREE.Group();
        this.isLoading = false;

        this.mixer = null;
        this.actionShoot = null;
        this.actionReload = null;

        // Load Model immediately
        this.loadModel();
    }

    loadModel() {
        if (this.model || this.isLoading) return;
        this.isLoading = true;

        const loader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();

        // Load Textures
        const path = "./assets/heavy_pistol_animated/";
        const mapArmHandColor = textureLoader.load(path + "armhandcolor.jpg");
        const mapTalonColor = textureLoader.load(path + "taloncolor.jpg");
        const mapTalonNormal = textureLoader.load(path + "talonnormal.jpg");
        const mapTalonMetallic = textureLoader.load(path + "talonmetallic.jpg");

        // Fix encoding
        mapArmHandColor.colorSpace = THREE.SRGBColorSpace;
        mapTalonColor.colorSpace = THREE.SRGBColorSpace;

        const armMaterial = new THREE.MeshStandardMaterial({
            map: mapArmHandColor,
            roughness: 0.8
        });

        const gunMaterial = new THREE.MeshStandardMaterial({
            map: mapTalonColor,
            normalMap: mapTalonNormal,
            metalnessMap: mapTalonMetallic,
            roughness: 0.5,
            metalness: 0.8
        });

        loader.load(path + "arms_talon.fbx", (obj) => {
            this.model = obj;

            // Apply Material Based on Name
            obj.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    // Assign materials based on name
                    const name = child.name.toLowerCase();
                    if (name.includes("arm") || name.includes("hand")) {
                        child.material = armMaterial;
                        // Ocultar los brazos para que solo se vea el arma
                        child.visible = false;
                    } else {
                        child.material = gunMaterial;
                    }
                }
            });

            // Scale & Position adjustments for the gun itself
            // Escala 0.05 para ajustar al tamaño de la mano del jugador
            obj.scale.set(0.05, 0.05, 0.05);

            // Ajuste de posición y rotación inicial
            // 90 grados en el eje Y
            obj.rotation.set(0, Math.PI / 2, 0);

            // Adding to a wrapper group so PolygonModelSkin doesn't override these manual adjustments
            this.equipGroup.add(obj);

            // Setup Mixer & Animations
            this.mixer = new THREE.AnimationMixer(obj);

            if (obj.animations && obj.animations.length > 0) {
                const anim = obj.animations[0];

                // Shoot Clip (0-12)
                let actionShootClip = THREE.AnimationUtils.subclip(anim, "disparo", 0, 12);
                this.actionShoot = this.mixer.clipAction(actionShootClip);
                this.actionShoot.timeScale = 2.0;
                this.actionShoot.setLoop(THREE.LoopOnce);

                // Reload Clip (14-85)
                let actionReloadClip = THREE.AnimationUtils.subclip(anim, "recarga", 14, 85);
                this.actionReload = this.mixer.clipAction(actionReloadClip);
                this.actionReload.timeScale = 0.9;
                this.actionReload.setLoop(THREE.LoopOnce);
            }

            this.isLoading = false;
            console.log("Gun FBX Model Loaded");
            if (this.onLoadCallback) this.onLoadCallback();
        }, undefined, (err) => {
            console.error("Error loading Gun FBX:", err);
            this.isLoading = false;
        });
    }

    setOnLoad(callback) {
        this.onLoadCallback = callback;
        if (this.model) callback(); // If already loaded, trigger immediately
    }

    use(context) {
        if (this.isReloading) return false;

        const now = Date.now() / 1000;
        if (now - this.lastShotTime < this.cooldown) return false;

        // context: { scene, world, origin, direction, ... }
        this.lastShotTime = now;

        console.log("Bang!");

        // Shoot Animation
        if (this.actionShoot && (!this.actionReload || !this.actionReload.isRunning())) {
            this.actionShoot.enabled = true;
            this.actionShoot.time = 0;
            this.actionShoot.play();
        }

        // --- GOLPE DE RETROCESO (PROCEDURAL) ---
        this.gunImpulse = 0.05;

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

    reload() {
        if (this.isReloading) return;

        console.log("🔄 Recargando...");
        this.isReloading = true;

        if (this.actionReload) {
            if (this.actionShoot) this.actionShoot.stop();
            this.actionReload.enabled = true;
            this.actionReload.time = 0;
            this.actionReload.play();
        }

        // Fase 1: Baja el arma
        this.springReloadImpulseZ = 0.02;

        // Fase 2: Mete cargador nuevo (1.3 segundos después)
        setTimeout(() => {
            this.springReloadImpulseZ = 0.04;
        }, 1300);

        // Fase 3: Sube el arma de golpe y lista para disparar
        setTimeout(() => {
            this.springReloadImpulseZ = 0.08;
            console.log("✅ Lista!");
        }, 2200);

        // Termina la recarga
        setTimeout(() => {
            this.isReloading = false;
        }, 2500);
    }

    updateAnim(dt) {
        let pitchDiff = 0;

        if (this.mixer) {
            this.mixer.update(dt);
        }

        // === 1. ACTUALIZAR RETROCESO DE TIRO ===
        if (this.gunImpulse > 0) {
            // Reducimos el impulso gradualmente (0.005 en 60fps = 0.3/s)
            this.gunImpulse -= 0.3 * dt;
            if (this.gunImpulse < 0) this.gunImpulse = 0;

            const kick = this.gunImpulse * (this.recoil !== undefined ? this.recoil : 5.0);
            pitchDiff += kick; // Positivo para que la cámara mire hacia arriba
            this.gunRecoilRecovery += kick;
        }
        else if (this.gunRecoilRecovery > 0) {
            // Recuperación (0.1 en 60fps = 6.0/s)
            const recovery = Math.min(this.gunRecoilRecovery, 6.0 * dt);
            this.gunRecoilRecovery -= recovery;
            pitchDiff -= recovery; // Baja la cámara de regreso
        }

        // === 2. ACTUALIZAR RESORTE DE RECARGA ===
        // Sumamos la velocidad a la posición Z
        this.springReloadZ += this.springReloadVelocityZ;

        // El resorte empuja en sentido contrario para volver al origen
        let forceZ = -this.springReloadZ * this.SPRING_STIFFNESS;

        // La aceleración altera la velocidad
        this.springReloadVelocityZ += forceZ + this.springReloadImpulseZ;

        // Fricción para que no rebote para siempre
        this.springReloadVelocityZ *= this.SPRING_DAMPING;

        // Limpiamos el impacto puntual
        this.springReloadImpulseZ = 0;

        return pitchDiff;
    }

    getEquipMesh() {
        return this.equipGroup; // Devolvemos el grupo contenedor para evitar que PolygonModelSkin sobrescriba la escala/rotación del FBX
    }

    clone() {
        // Cloning logic for passing configured item from Menu to Inventory
        const cloned = new GunItem();
        cloned.damage = this.damage;
        cloned.cooldown = this.cooldown;
        cloned.equippedHand = this.equippedHand;
        cloned.recoil = this.recoil;
        cloned.isAuto = this.isAuto;
        return cloned;
    }
}

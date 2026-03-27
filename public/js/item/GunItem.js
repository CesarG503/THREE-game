import * as THREE from "three";
import { Item } from "./Item.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { Projectile } from "../weapons/Projectile.js";
import { BlasterSystem } from "../fx/BlasterSystem.js";

export class GunItem extends Item {
    constructor() {
        super("gun", "Pistola", "/assets/gun/gun_d.png"); // Using diff texture as icon for now, or maybe create a snapshot?
        // Actually, let's use a generic gun icon if available, or just the side view texture locally if it looks ok.
        // User provided assets/gun/*.png are textures.
        // We'll use gun_d.png for icon for now, it might be the diffuse map.

        this.type = "weapon";
        this.damage = 10;
        this.cooldown = 0.5; // Seconds
        this.equippedHand = "right"; // "right" or "left" default
        this.recoil = 5.0; // Retroceso de la cámara
        this.recoilMode = "hybrid"; // Modos: 'manual', 'recenter', 'hybrid'
        this.isAuto = false; // Disparo automático
        this.projectileType = "bullet"; // "bullet" or "ball"
        this.shotSpeed = 50.0; // Velocidad del proyectil
        this.bulletDrop = 1.0; // Caída de bala (gravedad)
        this.lastShotTime = 0;
        this.hasTracer = false;
        this.hasTrajectoryLine = false;
        this.rebote = false; // Por defecto las balas no rebotan
        this.hasImpactEffect = false; // Humo al chocar

        this.isReloading = false;

        // Animaciones Procedurales (Retroceso)
        this.gunImpulse = 0; // Visual gun recoil

        // Retroceso de cámara (shake fluido y compensación)
        this.cameraRecoilPitch = 0;
        this.cameraRecoilTarget = 0;
        this.cameraRecoilYaw = 0;
        this.cameraRecoilYawTarget = 0;

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
        const path = "/assets/heavy_pistol_animated/";
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
        this.gunImpulse = 0.05; // Visual recoil

        // Recoil de la cámara
        const recoilVal = this.recoil !== undefined ? this.recoil : 5.0;
        const kickPitch = recoilVal * 0.005; // Ajuste de fuerza
        const kickYaw = (Math.random() - 0.5) * kickPitch * 0.8; // Oscilación horizontal aleatoria

        this.cameraRecoilTarget += kickPitch;
        this.cameraRecoilYawTarget += kickYaw;

        // Spawn Projectile
        if (context.registerProjectile) {
            // 1. Calcular posición real del cañón del arma (Start pos)
            let startPos = new THREE.Vector3();

            // Si el modelo está cargado y en escena, usamos su posición real en el mundo para que coincida en 1ra y 3ra persona
            if (this.model) {
                // El cañón suele estar al frente del arma (+Z localmente si la escala está orientada así, o el frente del grupo de arma)
                // Obtenemos la posición del arma
                this.model.getWorldPosition(startPos);

                // Obtener hacia dónde apunta el arma realmente o la cámara
                let forward = new THREE.Vector3();
                if (context.camera) {
                    context.camera.getWorldDirection(forward);
                } else {
                    forward.copy(context.direction).normalize();
                }

                // Ajustar un poco hacia adelante desde el centro del modelo del arma para simular la punta del cañón
                startPos.add(forward.multiplyScalar(0.8)); // 0.8 unidades hacia adelante
            } else {
                // Fallback de offset fijo a la cámara
                const offset = new THREE.Vector3(0.3, -0.3, -1.0);
                if (this.equippedHand === "left") offset.x = -0.3;
                startPos.copy(offset);

                if (context.camera) {
                    startPos.applyQuaternion(context.camera.quaternion);
                    startPos.add(context.camera.position);
                } else {
                    startPos.add(context.origin);
                }
            }

            // 2. Raycast estrictamente al centro de la mira
            let targetPoint = new THREE.Vector3();
            let hitTarget = false;

            if (context.camera && context.scene) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), context.camera);

                // Ignoramos jugador si es necesario
                const intersects = raycaster.intersectObjects(context.scene.children, true);

                for (let hit of intersects) {
                    let isIgnored = false;
                    let obj = hit.object;
                    
                    // Traverse up the hierarchy to see if this mesh belongs to the player or the gun
                    while (obj) {
                        if (obj === this.model || obj === this.equipGroup || obj.userData.isPlayer || obj.isLine || obj.userData.ignoreRaycast) {
                            isIgnored = true;
                            break;
                        }
                        obj = obj.parent;
                    }
                    
                    if (isIgnored) continue;
                    
                    targetPoint.copy(hit.point);
                    hitTarget = true;
                    break;
                }

                if (!hitTarget) {
                    // Apuntar al infinito si no hay pared cerca
                    targetPoint.copy(context.camera.position).add(raycaster.ray.direction.multiplyScalar(100));
                }
            } else {
                targetPoint.copy(context.origin).add(context.direction.clone().multiplyScalar(100));
            }

            // 3. Dirección de corrección (De cañón a centro de mira)
            const trajectoryDir = targetPoint.clone().sub(startPos).normalize();

            // 4. Efecto de Estela (Solamente si es 'bullet')
            const projType = this.projectileType || "bullet";
            
            // Instanciar BlasterSystem si se requiere el efecto nativo o el nuevo recursivo
            if ((projType === "bullet" || this.hasTracer) && context.scene) {
                if (!this.blasterSystem) {
                    this.blasterSystem = new BlasterSystem(context.scene);
                }
            }

            let tempTracer = null;
            if (projType === "bullet" && context.scene) {
                const tracer = this.blasterSystem.CreateParticle();
                tracer.Start.copy(startPos);

                // Inicialmente avanza 10 unidades rápido para evitar glitch en cara del jugador
                tracer.End = trajectoryDir.clone().multiplyScalar(10.0).add(startPos);
                tracer.Velocity = trajectoryDir.clone().multiplyScalar(150.0); // Bala súper rápida visualmente

                tracer.Colours = [new THREE.Color(0xffff88), new THREE.Color(0xffaa00)]; // Amarillo brillante a naranja
                tracer.Length = 10.0;
                tracer.Life = 0.5; // Desaparece rápido
                tracer.TotalLife = 0.5;
                tracer.Width = 0.05;
                tempTracer = tracer;
            }

            const speed = this.shotSpeed !== undefined ? this.shotSpeed : 50;
            const drop = this.bulletDrop !== undefined ? this.bulletDrop : 1.0;
            const proj = new Projectile(
                context.scene,
                context.world,
                startPos, // Desde el cañón
                trajectoryDir, // Hacia el punto central
                speed,
                this.damage,
                drop, // bulletDrop base
                projType, // "bullet" o "ball"
                this.rebote,
                this.hasImpactEffect
            );
            proj.hasTracer = this.hasTracer;
            proj.hasTrajectoryLine = this.hasTrajectoryLine;
            proj.blasterSystem = this.blasterSystem;
            proj.initialTracer = tempTracer;
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

    updateAnim(dt, manualPitchDelta = 0) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (this.blasterSystem) {
            this.blasterSystem.Update(dt);
        }

        // === 1. ACTUALIZAR RETROCESO VISUAL DEL ARMA ===
        if (this.gunImpulse > 0) {
            this.gunImpulse -= 0.3 * dt;
            if (this.gunImpulse < 0) this.gunImpulse = 0;
        }

        // === 2. ACTUALIZAR RETROCESO FLUIDO DE LA CÁMARA ===

        // A. Ajustar el objetivo de retroceso según lo que el jugador mueva el mouse manualmente
        if (manualPitchDelta < 0) {
            // Solo nos importa si el jugador EMPUJA HACIA ABAJO (compensando el retroceso).
            // Reducimos el objetivo máximo pendiente
            if (this.cameraRecoilTarget > 0) {
                this.cameraRecoilTarget += manualPitchDelta;
                if (this.cameraRecoilTarget < 0) {
                    this.cameraRecoilTarget = 0;
                }
            }

            // Reducimos el pitch visual acumulado
            // CRÍTICO: Todo movimiento hacia abajo borra la deuda visual del retroceso,
            // sin importar si está por encima del target o no, para que el "resorte"
            // olvide que tenía que recuperar esa altura y no pegue un tirón al suelo al terminar.
            if (this.cameraRecoilPitch > 0) {
                this.cameraRecoilPitch += manualPitchDelta;
                if (this.cameraRecoilPitch < 0) {
                    this.cameraRecoilPitch = 0;
                }
            }
        }

        // B. Decadencia (Recovery) a la posición original si dejamos de disparar
        const now = Date.now() / 1000;
        const timeSinceShot = now - this.lastShotTime;

        let decay = 0;
        let shouldRecover = false;

        if (this.recoilMode === "manual") {
            // Manual: No hay recuperación automática. Sube y se queda.
            decay = 0;
            shouldRecover = false;
        } else if (this.recoilMode === "recenter") {
            // Auto-Centrado: Mismo comportamiento que el antiguo híbrido.
            if (timeSinceShot > 0.08) {
                decay = 1.8 * dt;
                shouldRecover = true;
            }
        } else {
            // Híbrido: Vuelve al centro rápido solo en tiro único o al soltar,
            // pero si dispara en ráfaga, simplemente sube (con muy poca recuperación o ninguna)
            if (timeSinceShot > 0.2) {
                // Tiro aislado finalizado / Dejamos de disparar totalmente
                decay = 8.0 * dt; // Centro muy rápido
                shouldRecover = true;
            } else if (timeSinceShot > 0.08) {
                // Ráfaga / Tap firing intermedio. Muy leve recuperación.
                decay = 0.2 * dt;
                shouldRecover = true;
            }
        }

        if (shouldRecover) {
            if (this.cameraRecoilTarget > 0) {
                this.cameraRecoilTarget -= decay;
                if (this.cameraRecoilTarget < 0) this.cameraRecoilTarget = 0;
            }

            if (this.cameraRecoilYawTarget > 0) {
                this.cameraRecoilYawTarget -= decay;
                if (this.cameraRecoilYawTarget < 0) this.cameraRecoilYawTarget = 0;
            } else if (this.cameraRecoilYawTarget < 0) {
                this.cameraRecoilYawTarget += decay;
                if (this.cameraRecoilYawTarget > 0) this.cameraRecoilYawTarget = 0;
            }
        }

        // C. Interpolación fluida (Spring/Shake) del objetivo a la cámara
        const oldPitch = this.cameraRecoilPitch;
        const oldYaw = this.cameraRecoilYaw;

        // Velocidad de interpolación (qué tan rígido o fluido es el shake)
        const springSpeed = 25.0;
        this.cameraRecoilPitch += (this.cameraRecoilTarget - this.cameraRecoilPitch) * Math.min(springSpeed * dt, 1.0);
        this.cameraRecoilYaw += (this.cameraRecoilYawTarget - this.cameraRecoilYaw) * Math.min(springSpeed * dt, 1.0);

        const pitchDiff = this.cameraRecoilPitch - oldPitch;
        const yawDiff = this.cameraRecoilYaw - oldYaw;

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

        return { pitchDiff, yawDiff };
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
        cloned.recoilMode = this.recoilMode;
        cloned.isAuto = this.isAuto;
        cloned.projectileType = this.projectileType || "bullet";
        cloned.shotSpeed = this.shotSpeed !== undefined ? this.shotSpeed : 50.0;
        cloned.bulletDrop = this.bulletDrop !== undefined ? this.bulletDrop : 1.0;
        cloned.hasTracer = this.hasTracer || false;
        cloned.hasTrajectoryLine = this.hasTrajectoryLine || false;
        cloned.rebote = this.rebote !== undefined ? this.rebote : false;
        cloned.hasImpactEffect = this.hasImpactEffect || false;
        return cloned;
    }
}

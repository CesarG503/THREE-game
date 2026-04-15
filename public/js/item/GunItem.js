import * as THREE from "three";
import { Item } from "./Item.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Projectile } from "../weapons/Projectile.js";
import { BlasterSystem } from "../fx/BlasterSystem.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export class GunItem extends Item {
    static cachedModels = {}; // Dictionary by modelPath
    static cachedAnimations = {};
    static isLoadingCache = {};
    static cacheCallbacks = {};

    constructor(config = {}) {
        const id = config.id || "gun";
        const name = config.name || "Pistola";
        const iconPath = config.icon || "/assets/gun/gun_d.png";

        super(id, name, iconPath);

        // Guardamos config original para clonado
        this.originalConfig = config;

        this.type = "weapon";
        this.modelPath = config.modelPath || null;

        // Stats Customizables
        this.damage = config.damage !== undefined ? config.damage : 10;
        this.cooldown = config.cooldown !== undefined ? config.cooldown : 0.5; // Seconds
        this.equippedHand = "right"; // "right" or "left" default
        this.recoil = config.recoil !== undefined ? config.recoil : 5.0; // Retroceso de la cámara
        this.recoilMode = config.recoilMode || "hybrid"; // Modos: 'manual', 'recenter', 'hybrid'
        this.isAuto = config.isAuto || false; // Disparo automático
        this.projectileType = config.projectileType || "bullet"; // "bullet" or "ball"
        this.shotSpeed = config.shotSpeed !== undefined ? config.shotSpeed : 50.0; // Velocidad del proyectil
        this.bulletDrop = config.bulletDrop !== undefined ? config.bulletDrop : 1.0; // Caída de bala (gravedad)

        this.lastShotTime = 0;
        this.hasTracer = config.hasTracer !== undefined ? config.hasTracer : false;
        this.hasTrajectoryLine = config.hasTrajectoryLine !== undefined ? config.hasTrajectoryLine : false;
        this.rebote = config.rebote !== undefined ? config.rebote : false; // Por defecto las balas no rebotan
        this.hasImpactEffect = config.hasImpactEffect !== undefined ? config.hasImpactEffect : false; // Humo al chocar

        this.modelScale = config.modelScale !== undefined ? config.modelScale : 1.0;
        this.modelOffset = config.modelOffset || new THREE.Vector3(0, 0, 0);
        this.modelRotation = config.modelRotation || new THREE.Vector3(0, Math.PI / 2, 0);

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
        if (!this.modelPath || this.model || this.isLoading) return;
        this.isLoading = true;

        if (GunItem.cachedModels[this.modelPath]) {
            this.setupFromCache();
            return;
        }

        if (GunItem.isLoadingCache[this.modelPath]) {
            if (!GunItem.cacheCallbacks[this.modelPath]) GunItem.cacheCallbacks[this.modelPath] = [];
            GunItem.cacheCallbacks[this.modelPath].push(() => this.setupFromCache());
            return;
        }

        GunItem.isLoadingCache[this.modelPath] = true;
        GunItem.cacheCallbacks[this.modelPath] = [];

        const loader = new GLTFLoader();

        loader.load(this.modelPath, (gltf) => {
            const obj = gltf.scene;

            // Apply Shadows and Colors
            obj.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    // Asegurar soporte PBR o colores si las texturas blancas vienen vacías de Blender
                    if (child.material) {
                        const matName = child.material.name || "";
                        let colorHex = null;

                        if (matName.includes("Metal")) colorHex = 0x555555;
                        if (matName.includes("DarkerMetal")) colorHex = 0x222222;
                        if (matName.includes("Wood")) colorHex = 0x5c3a21; // Madera oscura
                        if (matName.includes("Magazine")) colorHex = 0x111111;
                        if (matName.includes("Muzzle")) colorHex = 0x333333;
                        if (matName.includes("Grip")) colorHex = 0x1a1a1a;

                        // Si reconocemos el material, le inyectamos color para arreglar el "blanco" de blender
                        if (colorHex !== null) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: colorHex,
                                roughness: matName.includes("Wood") ? 0.8 : 0.4,
                                metalness: matName.includes("Wood") ? 0.1 : 0.8
                            });
                        } else {
                            // Fallback general 
                            child.material.color.setHex(0xaaaaaa); // Gris base en vez de blanco puro
                            child.material.roughness = 0.5;
                            child.material.metalness = 0.8;
                        }
                    }
                }
            });

            // Cache it
            GunItem.cachedModels[this.modelPath] = obj;
            GunItem.cachedAnimations[this.modelPath] = gltf.animations;

            GunItem.isLoadingCache[this.modelPath] = false;

            this.setupFromCache();

            GunItem.cacheCallbacks[this.modelPath].forEach(cb => cb());
            GunItem.cacheCallbacks[this.modelPath] = [];
        }, undefined, (err) => {
            console.error("Error loading Gun GLB:", err);
            this.isLoading = false;
            GunItem.isLoadingCache[this.modelPath] = false;
        });
    }

    setupFromCache() {
        // Clone the GLB properly preserving Skeleton
        this.model = SkeletonUtils.clone(GunItem.cachedModels[this.modelPath]);

        // Scale & Position adjustments based on config
        this.model.scale.set(this.modelScale, this.modelScale, this.modelScale);

        // Ajuste de posición y rotación inicial
        this.model.rotation.set(this.modelRotation.x, this.modelRotation.y, this.modelRotation.z);
        this.model.position.copy(this.modelOffset);

        // Adding to a wrapper group so PolygonModelSkin doesn't override these manual adjustments
        this.equipGroup.add(this.model);

        // Setup Mixer & Animations
        this.mixer = new THREE.AnimationMixer(this.model);
        const anims = GunItem.cachedAnimations[this.modelPath];

        if (anims && anims.length > 0) {
            // Find Shoot ("Fire" or "disparo")
            const shootClip = anims.find(a => a.name.toLowerCase().includes("fire") || a.name.toLowerCase().includes("disparo"));
            if (shootClip) {
                this.actionShoot = this.mixer.clipAction(shootClip);
                this.actionShoot.timeScale = this.isAuto ? 1.0 : 2.0; // Auto guns might need natural speed
                this.actionShoot.setLoop(THREE.LoopOnce);
            }

            // Find Reload ("Reload" or "recarga")
            const reloadClip = anims.find(a => a.name.toLowerCase().includes("reload") || a.name.toLowerCase().includes("recarga"));
            if (reloadClip) {
                this.actionReload = this.mixer.clipAction(reloadClip);
                this.actionReload.timeScale = 1.0;
                this.actionReload.setLoop(THREE.LoopOnce);
            }
        }

        this.isLoading = false;
        console.log(`Gun GLB Model Loaded (from cache): ${this.modelPath}`);
        if (this.onLoadCallback) this.onLoadCallback();
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
                        if (obj === this.model || obj === this.equipGroup || (obj.userData.isPlayer && obj.userData.isLocalPlayer) || obj.isLine || obj.userData.ignoreRaycast) {
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

            // Transmitir disparo a otros clientes
            if (context.networkManager) {
                context.networkManager.sendPlayerShoot(
                    startPos,
                    trajectoryDir,
                    projType,
                    speed,
                    this.damage,
                    drop,
                    this.rebote,
                    this.hasImpactEffect,
                    this.hasTracer,
                    this.hasTrajectoryLine
                );
            }
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
        const cloned = new GunItem(this.originalConfig);
        return cloned;
    }
}

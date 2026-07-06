import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Item } from "../Item";
import { Projectile } from "../../weapons/Projectile";
import { BlasterSystem } from "../../fx/BlasterSystem";
import { WEAPON_SETTINGS } from "./WeaponSettings";
import type { GunConfig, ItemContext } from "../../types";

const GUN_COLOR_PALETTE: Record<string, number> = {
  Metal: 0xc0c0c0,
  DarkerMetal: 0x4a4a4a,
  DarkMetal: 0x2f2f2f,
  Wood: 0xc68642,
  LightWood: 0xe0a96d,
  DarkWood: 0x8b5a2b,
  Magazine: 0x2e2e2e,
  Muzzle: 0x6e6e6e,
  Grip: 0x3b2f2f,
  Black: 0x1c1c1c,
  BulletYellow: 0xffd700,
  BulletOrange: 0xff8c00,
  Barrels: 0x9a9a9a,
  Trigger: 0xb0b0b0,
  Green: 0x32cd32
};

const GUN_MODEL_MATERIAL_OVERRIDES: Record<string, Record<string, number>> = {
  "/assets/gun animated/GLB/P90.glb": {
    "Material.001": 0xededed,
    "Material.003": 0x5a5a5a,
    "Material.004": 0x2f2f2f
  }
};

export class GunItem extends Item {
  static cachedModels: Record<string, THREE.Object3D> = {};
  static cachedAnimations: Record<string, THREE.AnimationClip[]> = {};
  static isLoadingCache: Record<string, boolean> = {};
  static cacheCallbacks: Record<string, Array<() => void>> = {};

  originalConfig: GunConfig;
  type: string;
  modelPath: string | null;
  damage: number;
  cooldown: number;
  equippedHand: "left" | "right";
  recoil: number;
  recoilMode: string;
  isAuto: boolean;
  projectileType: string;
  shotSpeed: number;
  bulletDrop: number;
  lastShotTime: number;
  hasTracer: boolean;
  hasTrajectoryLine: boolean;
  rebote: boolean;
  hasImpactEffect: boolean;
  customTracerVFX: string;
  tracerDestroyOnCollision: boolean;
  tracerStayForever: boolean;
  tracerCollisionVFX: string;
  customImpactVFX: string;
  maxScope: number;
  hasPlayerImpulseUp: boolean;
  playerImpulseUpForce: number;
  playerImpulseUpAirReduction: number;
  hasPlayerImpulseBack: boolean;
  playerImpulseBackForce: number;
  modelScale: number;
  modelOffset: THREE.Vector3;
  modelRotation: THREE.Vector3;
  handOffset: THREE.Vector3;
  handRotation: THREE.Euler;
  extraAnimsConfig: Record<string, number>;
  proceduralStates: { extraPos: THREE.Vector3; extraRot: THREE.Euler; actionQueue: any[] };
  isReloading: boolean;
  gunImpulse: number;
  cameraRecoilPitch: number;
  cameraRecoilTarget: number;
  cameraRecoilYaw: number;
  cameraRecoilYawTarget: number;
  springReloadZ: number;
  springReloadVelocityZ: number;
  springReloadImpulseZ: number;
  SPRING_STIFFNESS: number;
  SPRING_DAMPING: number;
  model: THREE.Object3D | null;
  equipGroup: THREE.Group;
  transformGroup: THREE.Group;
  isLoading: boolean;
  mixer: THREE.AnimationMixer | null;
  actionShoot: THREE.AnimationAction | null;
  actionReload: THREE.AnimationAction | null;
  onLoadCallback: (() => void) | null;
  blasterSystem: BlasterSystem | null;
  _baseId: any;

  constructor(config: GunConfig = {} as GunConfig) {
    const id = config.id || "gun";
    const name = config.name || "Pistola";
    const iconPath = config.icon || "/assets/gun/gun_d.png";

    super(id, name, iconPath);

    this.originalConfig = config;

    this.type = "weapon";
    this.modelPath = config.modelPath || null;

    this.damage = config.damage !== undefined ? config.damage : 10;
    this.cooldown = config.cooldown !== undefined ? config.cooldown : 0.5;
    this.equippedHand = config.equippedHand || "right";
    this.recoil = config.recoil !== undefined ? config.recoil : 5.0;
    this.recoilMode = config.recoilMode || "hybrid";
    this.isAuto = config.isAuto || false;
    this.projectileType = config.projectileType || "bullet";
    this.shotSpeed = config.shotSpeed !== undefined ? config.shotSpeed : 50.0;
    this.bulletDrop = config.bulletDrop !== undefined ? config.bulletDrop : 1.0;

    this.lastShotTime = 0;
    this.hasTracer = config.hasTracer !== undefined ? config.hasTracer : false;
    this.hasTrajectoryLine = config.hasTrajectoryLine !== undefined ? config.hasTrajectoryLine : false;
    this.rebote = config.rebote !== undefined ? config.rebote : false;
    this.hasImpactEffect = config.hasImpactEffect !== undefined ? config.hasImpactEffect : false;
    this.customTracerVFX = config.customTracerVFX || "Ninguno";
    this.tracerDestroyOnCollision = config.tracerDestroyOnCollision !== undefined ? config.tracerDestroyOnCollision : false;
    this.tracerStayForever = config.tracerStayForever !== undefined ? config.tracerStayForever : false;
    this.tracerCollisionVFX = config.tracerCollisionVFX || "Ninguno";
    this.customImpactVFX = config.customImpactVFX || "Ninguno";
    this.maxScope = config.maxScope !== undefined ? config.maxScope : 1;

    this.hasPlayerImpulseUp = config.hasPlayerImpulseUp !== undefined ? config.hasPlayerImpulseUp : false;
    this.playerImpulseUpForce = config.playerImpulseUpForce !== undefined ? config.playerImpulseUpForce : 15.0;
    this.playerImpulseUpAirReduction =
      config.playerImpulseUpAirReduction !== undefined ? config.playerImpulseUpAirReduction : 50.0;

    this.hasPlayerImpulseBack = config.hasPlayerImpulseBack !== undefined ? config.hasPlayerImpulseBack : false;
    this.playerImpulseBackForce = config.playerImpulseBackForce !== undefined ? config.playerImpulseBackForce : 5.0;

    this.modelScale = config.modelScale !== undefined ? config.modelScale : 1.0;
    this.modelOffset = config.modelOffset || new THREE.Vector3(0, 0, 0);
    this.modelRotation = config.modelRotation || new THREE.Vector3(0, Math.PI / 2, 0);

    const weaponSettings = WEAPON_SETTINGS[this.id];
    this.handOffset = weaponSettings?.handOffset || new THREE.Vector3(0, 0, 0);
    this.handRotation = weaponSettings?.handRotation || new THREE.Euler(0, 0, 0);
    this.extraAnimsConfig = weaponSettings?.extraAnims || {};

    this.proceduralStates = {
      extraPos: new THREE.Vector3(0, 0, 0),
      extraRot: new THREE.Euler(0, 0, 0),
      actionQueue: []
    };

    this.isReloading = false;

    this.gunImpulse = 0;

    this.cameraRecoilPitch = 0;
    this.cameraRecoilTarget = 0;
    this.cameraRecoilYaw = 0;
    this.cameraRecoilYawTarget = 0;

    this.springReloadZ = 0;
    this.springReloadVelocityZ = 0;
    this.springReloadImpulseZ = 0;
    this.SPRING_STIFFNESS = 0.1;
    this.SPRING_DAMPING = 0.85;

    this.model = null;
    this.equipGroup = new THREE.Group();
    this.transformGroup = new THREE.Group();
    this.equipGroup.add(this.transformGroup);

    this.isLoading = false;

    this.mixer = null;
    this.actionShoot = null;
    this.actionReload = null;
    this.onLoadCallback = null;
    this.blasterSystem = null;

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

    loader.load(
      this.modelPath,
      (gltf: any) => {
        const obj = gltf.scene;

        obj.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            if (child.material) {
              const matName = child.material.name || "";
              let colorHex = null;

              for (const key in GUN_COLOR_PALETTE) {
                if (matName.includes(key)) {
                  colorHex = GUN_COLOR_PALETTE[key];
                  break;
                }
              }

              const modelOverrides = GUN_MODEL_MATERIAL_OVERRIDES[this.modelPath];
              if (colorHex === null && modelOverrides && modelOverrides[matName] !== undefined) {
                colorHex = modelOverrides[matName];
              }

              if (colorHex !== null) {
                child.material = new THREE.MeshStandardMaterial({
                  color: colorHex,
                  roughness: matName.includes("Wood") || matName.includes("LightWood") || matName.includes("DarkWood") ? 0.8 : 0.4,
                  metalness: matName.includes("Wood") || matName.includes("LightWood") || matName.includes("DarkWood") ? 0.1 : 0.8
                });
              } else {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xf5edf4,
                  roughness: 0.6,
                  metalness: 0.4
                });
              }
            }
          }
        });

        GunItem.cachedModels[this.modelPath] = obj;
        GunItem.cachedAnimations[this.modelPath] = gltf.animations;

        GunItem.isLoadingCache[this.modelPath] = false;

        this.setupFromCache();

        GunItem.cacheCallbacks[this.modelPath].forEach((cb: any) => cb());
        GunItem.cacheCallbacks[this.modelPath] = [];
      },
      undefined,
      (err: any) => {
        console.error("Error loading Gun GLB:", err);
        this.isLoading = false;
        GunItem.isLoadingCache[this.modelPath] = false;
      }
    );
  }

  setupFromCache() {
    this.model = SkeletonUtils.clone(GunItem.cachedModels[this.modelPath]);

    this.model.scale.set(this.modelScale, this.modelScale, this.modelScale);

    this.model.rotation.set(this.modelRotation.x, this.modelRotation.y, this.modelRotation.z);
    this.model.position.copy(this.modelOffset);

    this.transformGroup.position.copy(this.handOffset);
    this.transformGroup.rotation.copy(this.handRotation);

    this.transformGroup.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    const anims = GunItem.cachedAnimations[this.modelPath];

    if (anims && anims.length > 0) {
      const shootClip = anims.find((a: any) => a.name.toLowerCase().includes("fire") || a.name.toLowerCase().includes("disparo"));
      if (shootClip) {
        this.actionShoot = this.mixer.clipAction(shootClip);
        this.actionShoot.timeScale = this.isAuto ? 1.0 : 2.0;
        this.actionShoot.setLoop(THREE.LoopOnce, 1);
      }

      const reloadClip = anims.find((a: any) => a.name.toLowerCase().includes("reload") || a.name.toLowerCase().includes("recarga"));
      if (reloadClip) {
        this.actionReload = this.mixer.clipAction(reloadClip);
        this.actionReload.timeScale = 1.0;
        this.actionReload.setLoop(THREE.LoopOnce, 1);
      }
    }

    this.isLoading = false;
    console.log(`Gun GLB Model Loaded (from cache): ${this.modelPath}`);
    if (this.onLoadCallback) this.onLoadCallback();
  }

  setOnLoad(callback: () => void) {
    this.onLoadCallback = callback;
    if (this.model) callback();
  }

  shouldIgnoreAimHit(object: any, context: any) {
    let obj = object;
    const character = context?.character;
    const localModelRoots = [
      character?.glbModel?.model,
      character?.polygonModel?.model,
      character?.polygonModelSkin?.model,
      (context as any)?.game?.fxBlasterSystem?.meshGroup,
      this.equipGroup,
      this.transformGroup,
      this.model
    ].filter(Boolean);

    while (obj) {
      if (
        localModelRoots.includes(obj) ||
        obj.userData?.ignoreRaycast ||
        (obj.userData?.isPlayer && obj.userData?.isLocalPlayer) ||
        (obj as any).isLine ||
        obj.type === "AxesHelper" ||
        obj.userData?.isGizmo ||
        obj.visible === false
      ) {
        return true;
      }

      obj = obj.parent;
    }

    return false;
  }

  use(context: ItemContext) {
    if (context && context.isRightClick) return false;
    if (this.isReloading) return false;

    const now = Date.now() / 1000;
    if (now - this.lastShotTime < this.cooldown) return false;

    this.lastShotTime = now;

    console.log("Bang!");

    if (this.actionShoot && (!this.actionReload || !this.actionReload.isRunning())) {
      this.actionShoot.enabled = true;
      this.actionShoot.time = 0;
      this.actionShoot.play();
    }

    if (context && (context as any).game && (context as any).game.scopeController) {
      (context as any).game.scopeController.onShoot();
    }

    this.gunImpulse = 0.05;

    const recoilVal = this.recoil !== undefined ? this.recoil : 5.0;
    const kickPitch = recoilVal * 0.005;
    const kickYaw = (Math.random() - 0.5) * kickPitch * 0.8;

    this.cameraRecoilTarget += kickPitch;
    this.cameraRecoilYawTarget += kickYaw;

    if (context.registerProjectile) {
      const startPos = new THREE.Vector3();

      if (this.model) {
        this.model.getWorldPosition(startPos);

        const forward = new THREE.Vector3();
        if (context.camera) {
          context.camera.getWorldDirection(forward);
        } else {
          forward.copy(context.direction).normalize();
        }

        startPos.add(forward.multiplyScalar(0.8));
      } else {
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

      const targetPoint = new THREE.Vector3();
      let hitTarget = false;

      if (context.camera && context.scene) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), context.camera);

        const intersects = raycaster.intersectObjects(context.scene.children, true);

        for (const hit of intersects) {
          if (this.shouldIgnoreAimHit(hit.object, context)) continue;

          targetPoint.copy(hit.point);
          hitTarget = true;
          break;
        }

        if (!hitTarget) {
          targetPoint.copy(context.camera.position).add(raycaster.ray.direction.multiplyScalar(100));
        }
      } else {
        targetPoint.copy(context.origin).add(context.direction.clone().multiplyScalar(100));
      }

      const trajectoryDir = targetPoint.clone().sub(startPos).normalize();

      const projType = this.projectileType || "bullet";
      const speed = this.shotSpeed !== undefined ? this.shotSpeed : 50;
      const drop = this.bulletDrop !== undefined ? this.bulletDrop : 1.0;
      const tracerSpeed = projType === "bullet" ? speed * 3.0 : speed;
      const tracerLength = THREE.MathUtils.clamp(Math.max(tracerSpeed, 0) * 0.05, 0.5, 10.0);

      const shotBlasterSystem = (context as any).game?.fxBlasterSystem || this.blasterSystem;

      if ((projType === "bullet" || this.hasTracer) && context.scene) {
        if (!shotBlasterSystem && !(context as any).game?.fxBlasterSystem) {
          this.blasterSystem = new BlasterSystem(context.scene);
        }
      }

      let tempTracer = null;
      if (projType === "bullet" && context.scene) {
        const activeBlasterSystem = (context as any).game?.fxBlasterSystem || this.blasterSystem;
        const tracer = activeBlasterSystem.CreateParticle();
        tracer.Start.copy(startPos);

        tracer.End = trajectoryDir.clone().multiplyScalar(tracerLength).add(startPos);
        tracer.Velocity = trajectoryDir.clone().multiplyScalar(tracerSpeed);

        tracer.Colours = [new THREE.Color(0xffff88), new THREE.Color(0xffaa00)];
        tracer.Length = tracerLength;
        tracer.Life = 0.5;
        tracer.TotalLife = 0.5;
        tracer.Width = 0.05;
        tempTracer = tracer;
      }

      const proj = new Projectile(
        context.scene,
        context.world,
        startPos,
        trajectoryDir,
        speed,
        this.damage,
        drop,
        projType,
        this.rebote,
        this.hasImpactEffect,
        this.customTracerVFX,
        this.customImpactVFX,
        this.tracerCollisionVFX
      );
      proj.hasTracer = this.hasTracer;
      proj.hasTrajectoryLine = this.hasTrajectoryLine;
      proj.tracerDestroyOnCollision = this.tracerDestroyOnCollision;
      proj.tracerStayForever = this.tracerStayForever;
      proj.tracerCollisionVFX = this.tracerCollisionVFX;
      proj.blasterSystem = (context as any).game?.fxBlasterSystem || this.blasterSystem;
      proj.particleSystem = context.particleSystem;
      proj.initialTracer = tempTracer;
      proj.ownerColliderHandle = (context as any).character?.collider?.handle ?? null;
      context.registerProjectile(proj);

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
          this.hasTrajectoryLine,
          this.customTracerVFX,
          this.customImpactVFX,
          this.tracerDestroyOnCollision,
          this.tracerStayForever,
          this.tracerCollisionVFX
        );
      }

      if (context.character) {
        const aimDir = new THREE.Vector3();
        if (context.camera) {
          context.camera.getWorldDirection(aimDir);
        } else {
          aimDir.copy(context.direction).normalize();
        }

        if (this.hasPlayerImpulseUp && aimDir.y < -0.4) {
          let forceMagnitud = this.playerImpulseUpForce;

          if (context.character.characterController && context.character.characterController.computedGrounded()) {
            context.character.airWeaponMultiplier = 1.0;
          } else {
            if (context.character.airWeaponMultiplier === undefined) {
              context.character.airWeaponMultiplier = 1.0;
            }
            const reduction = this.playerImpulseUpAirReduction / 100.0;
            context.character.airWeaponMultiplier *= 1.0 - reduction;
          }

          forceMagnitud *= context.character.airWeaponMultiplier;

          const forceVec = aimDir.clone().multiplyScalar(-forceMagnitud);
          context.character.applyImpulse(forceVec);
        } else if (this.hasPlayerImpulseBack && aimDir.y >= -0.4 && aimDir.y <= 0.6) {
          const forceVec = aimDir.clone().multiplyScalar(-this.playerImpulseBackForce);
          forceVec.y = 0;
          context.character.applyImpulse(forceVec);
        }
      }
    }

    return true;
  }

  startExtraAction(actionName: any) {
    console.log(`Iniciando acción extra: ${actionName}`);
    if (actionName === "throw") {
      this._startThrowAnimation();
    } else if (actionName === "spin") {
      this._startSpinAnimation();
    }
  }

  _startThrowAnimation() {
    const duration = 1.0;
    const startTime = Date.now();
    const startPos = new THREE.Vector3().copy(this.proceduralStates.extraPos);
    const startRot = new THREE.Euler().copy(this.proceduralStates.extraRot);
    void startPos;
    void startRot;

    const animate = () => {
      const t = (Date.now() - startTime) / 1000 / duration;
      if (t >= 1.0) {
        this.proceduralStates.extraPos.set(0, 0, 0);
        this.proceduralStates.extraRot.set(0, 0, 0);
        return;
      }

      const x = t;
      const y = 4 * t * (1 - t);

      this.proceduralStates.extraPos.z = -x * 2.0;
      this.proceduralStates.extraPos.y = y * 0.5;

      this.proceduralStates.extraRot.x = x * Math.PI * 4;

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  _startSpinAnimation() {
    const duration = 0.5;
    const startTime = Date.now();
    const animate = () => {
      const t = (Date.now() - startTime) / 1000 / duration;
      if (t >= 1.0) {
        this.proceduralStates.extraRot.y = 0;
        return;
      }
      this.proceduralStates.extraRot.y = t * Math.PI * 2;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
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

    this.springReloadImpulseZ = 0.02;

    setTimeout(() => {
      this.springReloadImpulseZ = 0.04;
    }, 1300);

    setTimeout(() => {
      this.springReloadImpulseZ = 0.08;
      console.log("✅ Lista!");
    }, 2200);

    setTimeout(() => {
      this.isReloading = false;
    }, 2500);
  }

  updateAnim(dt: any, manualPitchDelta = 0) {
    if (this.mixer) {
      this.mixer.update(dt);
    }

    if (this.blasterSystem) {
      this.blasterSystem.Update(dt);
    }

    const handOffsetAdjusted = this.handOffset.clone();
    this.transformGroup.scale.set(1, 1, 1);
    this.transformGroup.position.copy(handOffsetAdjusted).add(this.proceduralStates.extraPos);

    this.transformGroup.rotation.x = this.handRotation.x + this.proceduralStates.extraRot.x;
    this.transformGroup.rotation.y = this.handRotation.y + this.proceduralStates.extraRot.y;
    this.transformGroup.rotation.z = this.handRotation.z + this.proceduralStates.extraRot.z;

    if (this.gunImpulse > 0) {
      this.gunImpulse -= 0.3 * dt;
      if (this.gunImpulse < 0) this.gunImpulse = 0;
    }

    if (manualPitchDelta < 0) {
      if (this.cameraRecoilTarget > 0) {
        this.cameraRecoilTarget += manualPitchDelta;
        if (this.cameraRecoilTarget < 0) {
          this.cameraRecoilTarget = 0;
        }
      }

      if (this.cameraRecoilPitch > 0) {
        this.cameraRecoilPitch += manualPitchDelta;
        if (this.cameraRecoilPitch < 0) {
          this.cameraRecoilPitch = 0;
        }
      }
    }

    const now = Date.now() / 1000;
    const timeSinceShot = now - this.lastShotTime;

    let decay = 0;
    let shouldRecover = false;

    if (this.recoilMode === "manual") {
      decay = 0;
      shouldRecover = false;
    } else if (this.recoilMode === "recenter") {
      if (timeSinceShot > 0.08) {
        decay = 1.8 * dt;
        shouldRecover = true;
      }
    } else {
      if (timeSinceShot > 0.2) {
        decay = 8.0 * dt;
        shouldRecover = true;
      } else if (timeSinceShot > 0.08) {
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

    const oldPitch = this.cameraRecoilPitch;
    const oldYaw = this.cameraRecoilYaw;

    const springSpeed = 25.0;
    this.cameraRecoilPitch += (this.cameraRecoilTarget - this.cameraRecoilPitch) * Math.min(springSpeed * dt, 1.0);
    this.cameraRecoilYaw += (this.cameraRecoilYawTarget - this.cameraRecoilYaw) * Math.min(springSpeed * dt, 1.0);

    const pitchDiff = this.cameraRecoilPitch - oldPitch;
    const yawDiff = this.cameraRecoilYaw - oldYaw;

    this.springReloadZ += this.springReloadVelocityZ;

    const forceZ = -this.springReloadZ * this.SPRING_STIFFNESS;

    this.springReloadVelocityZ += forceZ + this.springReloadImpulseZ;

    this.springReloadVelocityZ *= this.SPRING_DAMPING;

    this.springReloadImpulseZ = 0;

    return { pitchDiff, yawDiff };
  }

  getEquipMesh() {
    return this.equipGroup;
  }

  clone() {
    const updatedConfig = Object.assign({}, this.originalConfig, {
      damage: this.damage,
      cooldown: this.cooldown,
      recoil: this.recoil,
      recoilMode: this.recoilMode,
      isAuto: this.isAuto,
      projectileType: this.projectileType,
      shotSpeed: this.shotSpeed,
      bulletDrop: this.bulletDrop,
      hasTracer: this.hasTracer,
      hasTrajectoryLine: this.hasTrajectoryLine,
      rebote: this.rebote,
      hasImpactEffect: this.hasImpactEffect,
      customTracerVFX: this.customTracerVFX,
      tracerDestroyOnCollision: this.tracerDestroyOnCollision,
      tracerStayForever: this.tracerStayForever,
      tracerCollisionVFX: this.tracerCollisionVFX,
      customImpactVFX: this.customImpactVFX,
      maxScope: this.maxScope,
      hasPlayerImpulseUp: this.hasPlayerImpulseUp,
      playerImpulseUpForce: this.playerImpulseUpForce,
      playerImpulseUpAirReduction: this.playerImpulseUpAirReduction,
      hasPlayerImpulseBack: this.hasPlayerImpulseBack,
      playerImpulseBackForce: this.playerImpulseBackForce,
      modelScale: this.modelScale,
      equippedHand: this.equippedHand
    });
    const cloned = new GunItem(updatedConfig);
    if (this._baseId) cloned._baseId = this._baseId;
    return cloned;
  }
}

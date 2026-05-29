import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLBModel } from "./models/GLBModel";
import { PolygonModel } from "./models/PolygonModel";
import { PolygonModelSkin } from "./models/PolygonModelSkin";
import { ParticleSystem } from "../effects/ParticleSystem";
import { InputManager } from "../input/InputManager";
import type { CharacterStats, JumpConfig, FlightConfig, PlayerCollisionMode, RemotePlayerState } from "../types";

type LadderObject = THREE.Object3D & { bounds?: THREE.Box3 };

export class CharacterController {
  scene: THREE.Scene;
  world: RAPIER.World;
  camera: THREE.Camera;
  cameraController: any;
  glbModel: GLBModel;
  polygonModel: PolygonModel;
  polygonModelSkin: PolygonModelSkin;
  currentType: string;
  rigidBody: RAPIER.RigidBody | null;
  characterController: RAPIER.KinematicCharacterController | null;
  speed: number;
  jumpForce: number;
  grounded: boolean;
  verticalVelocity: number;
  collider: RAPIER.Collider | null;
  ladders: LadderObject[];
  isClimbing: boolean;
  rotationSmoothness: number;
  currentRotation: number;
  headPitch: number;
  headYaw: number;
  canFly: boolean;
  isFlying: boolean;
  lastJumpTime: number;
  maxMultiJumps: number;
  jumpCount: number;
  wasJumpDown: boolean;
  momentum: THREE.Vector3;
  momentumDamping: number;
  airWeaponMultiplier: number;
  noClip: boolean;
  maxHealth: number;
  currentHealth: number;
  respawns: number;
  startPosition: THREE.Vector3;
  isDead: boolean;
  particleSystem: ParticleSystem;
  playerCollision: string;
  listeners: Record<string, Function[]>;
  equippedItem: any;
  consecutiveAirTime: number;
  jetpackCooldownTimer: number;

  constructor(scene: THREE.Scene, world: RAPIER.World, camera: THREE.Camera, cameraController: any) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.cameraController = cameraController;

    this.glbModel = new GLBModel(scene);
    this.polygonModel = new PolygonModel(scene);
    this.polygonModelSkin = new PolygonModelSkin(scene);
    this.currentType = "skin";

    this.rigidBody = null;
    this.characterController = null;

    // Settings
    this.speed = 10;
    this.jumpForce = 20;
    this.grounded = false;
    this.verticalVelocity = 0;
    this.collider = null;

    this.ladders = [];
    this.isClimbing = false;

    this.rotationSmoothness = 0.15;
    this.currentRotation = 0;
    this.headPitch = 0;
    this.headYaw = 0;

    // Flight / Editor Mode
    this.canFly = false;
    this.isFlying = false;
    this.lastJumpTime = 0;
    this.maxMultiJumps = 0;
    this.jumpCount = 0;
    this.wasJumpDown = false;

    // Momentum System
    this.momentum = new THREE.Vector3(0, 0, 0);
    this.momentumDamping = 2.0;

    // Weapon Modifiers
    this.airWeaponMultiplier = 1.0;

    // No-Clip / Build Mode Ghost
    this.noClip = false;

    // Stats & Health
    this.maxHealth = 100;
    this.currentHealth = 100;
    this.respawns = -1;
    this.startPosition = new THREE.Vector3(0, 5, 0);
    this.isDead = false;

    this.initPhysics();
    this.particleSystem = new ParticleSystem(scene);

    this.playerCollision = "push";
    this.applyCollisionProfile();

    this.setModelType(this.currentType);

    // Event System
    this.listeners = {};
    this.equippedItem = null;
    this.consecutiveAirTime = 0;
    this.jetpackCooldownTimer = 0;
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb: Function) => cb !== callback);
  }

  emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb: Function) => cb(data));
    }
  }

  setModelType(type: string) {
    console.log("Setting Model Type:", type);
    this.currentType = type;

    this.glbModel.setVisible(false);
    this.polygonModel.setVisible(false);
    this.polygonModelSkin.setVisible(false);

    if (type === "glb") {
      this.glbModel.setVisible(true);
    } else if (type === "polygon") {
      this.polygonModel.setVisible(true);
    } else if (type === "skin") {
      this.polygonModelSkin.setVisible(true);
    }
  }

  initPhysics() {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0);
    this.rigidBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0);
    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    this.characterController = this.world.createCharacterController(0.1);
    this.characterController.enableAutostep(0.6, 0.25, true);
    this.characterController.enableSnapToGround(0.5);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    this.characterController.setApplyImpulsesToDynamicBodies(true);

    this.characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((45 * Math.PI) / 180);
  }

  applyCollisionProfile() {
    if (!this.collider) return;

    const membership = 0x0002;
    const filter = 0xfffd;
    const isSensor = false;

    const groups = (membership << 16) | filter;
    this.collider.setCollisionGroups(groups);
    this.collider.setSensor(isSensor);
  }

  setNoClip(enabled: boolean) {
    this.noClip = enabled;
    console.log("No-Clip", enabled ? "Enabled" : "Disabled");
  }

  applyImpulse(force: THREE.Vector3) {
    this.momentum.add(force);
    if (force.y !== 0) {
      this.verticalVelocity = force.y;
      this.momentum.y = 0;
      this.grounded = false;
    }
  }

  update(dt: number, input: InputManager, remotePlayers: any[]) {
    if (!this.rigidBody) return;

    const isGrounded = this.characterController ? this.characterController.computedGrounded() : false;

    const hasJetpack = this.equippedItem && (this.equippedItem.id === "jetpack" || this.equippedItem.id.startsWith("jetpack_"));
    const hasFuel = hasJetpack && this.equippedItem.consumableUse > 0;
    const withinAirLimit = hasJetpack && this.consecutiveAirTime < this.equippedItem.airLimit;

    // Cooldown logic: if enabled, recharges when on ground and not in flight
    if (hasJetpack) {
      if (this.equippedItem.cooldownEnabled) {
        const isUsingNow = this.consecutiveAirTime > 0;
        if (!isUsingNow && isGrounded) {
          const cooldownLimit = this.equippedItem.cooldownTime !== undefined ? this.equippedItem.cooldownTime : 3.0;
          this.jetpackCooldownTimer = Math.min(cooldownLimit, this.jetpackCooldownTimer + dt);
        }
      } else {
        this.jetpackCooldownTimer = 0;
      }
    }

    const cooldownReady = !hasJetpack || !this.equippedItem.cooldownEnabled || this.consecutiveAirTime > 0 || this.jetpackCooldownTimer >= (this.equippedItem.cooldownTime !== undefined ? this.equippedItem.cooldownTime : 3.0);

    const pointerFollow = hasJetpack && (this.equippedItem.pointerFollowEnabled !== false);
    const shiftFlight = hasJetpack && !!this.equippedItem.shiftFlightEnabled;
    const isUsingJetpackShiftFlight = hasJetpack && shiftFlight && input.keys.crouch && hasFuel && withinAirLimit && cooldownReady;
    const isUsingJetpackCameraDir = hasJetpack && !isUsingJetpackShiftFlight && input.keys.jump && input.keys.crouch && hasFuel && withinAirLimit && cooldownReady && pointerFollow;
    const isUsingJetpackNormal = hasJetpack && input.keys.jump && !isGrounded && hasFuel && withinAirLimit && cooldownReady && (!input.keys.crouch || !pointerFollow);
    let isUsingJetpack = isUsingJetpackCameraDir || isUsingJetpackNormal || isUsingJetpackShiftFlight;

    if (isUsingJetpack) {
      this.jetpackCooldownTimer = 0;
    }

    if (hasJetpack && input.keys.crouch) {
      console.log("[Jetpack Debug] crouch is pressed! shiftFlightEnabled:", this.equippedItem.shiftFlightEnabled, "hasFuel:", hasFuel, "withinAirLimit:", withinAirLimit, "cooldownReady:", cooldownReady, "isUsingJetpackShiftFlight:", isUsingJetpackShiftFlight);
    }

    if (this.characterController) {
      if (isUsingJetpack || this.isFlying) {
        this.characterController.enableSnapToGround(0.0);
      } else {
        this.characterController.enableSnapToGround(0.5);
      }
    }

    if (this.noClip) {
      const speed = this.speed * 2;
      const moveDir = new THREE.Vector3();

      if (this.cameraController) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const right = this.cameraController.getRightDirection();

        if (input.keys.forward) moveDir.add(camDir);
        if (input.keys.backward) moveDir.sub(camDir);
        if (input.keys.right) moveDir.add(right);
        if (input.keys.left) moveDir.sub(right);

        if (input.keys.jump) moveDir.y += 1;
      }

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize().multiplyScalar(speed * dt);
      }

      const newPos = this.rigidBody.translation();
      newPos.x += moveDir.x;
      newPos.y += moveDir.y;
      newPos.z += moveDir.z;

      this.rigidBody.setNextKinematicTranslation(newPos);
      this.updateModelVisuals();
      return;
    }

    if (this.isFlying) {
      this.checkFlightToggle(input);
      this.wasJumpDown = input.keys.jump;

      if (this.isFlying) {
        const moveDir = new THREE.Vector3();
        if (input.keys.forward) moveDir.z += 1;
        if (input.keys.backward) moveDir.z -= 1;
        if (input.keys.left) moveDir.x -= 1;
        if (input.keys.right) moveDir.x += 1;

        this.handleFlightMovement(dt, input, moveDir);

        const hasInput = moveDir.lengthSq() > 0;
        this.glbModel.update(dt, hasInput);
        this.polygonModel.update(dt, hasInput);
        this.polygonModelSkin.update(dt, hasInput, input.keys.crouch, input.keys.attack, false, this.verticalVelocity);
        if (this.particleSystem) this.particleSystem.update(dt);

        return;
      }
    }

    if (this.canFly) {
      this.checkFlightToggle(input);
    }

    const moveDir = new THREE.Vector3();
    if (input.keys.forward) moveDir.z += 1;
    if (input.keys.backward) moveDir.z -= 1;
    if (input.keys.left) moveDir.x -= 1;
    if (input.keys.right) moveDir.x += 1;

    this.checkClimbing();

    const desiredTranslation = new THREE.Vector3();
    const hasInput = moveDir.lengthSq() > 0;

    if (hasInput && this.cameraController) {
      const forward = this.cameraController.getForwardDirection();
      const right = this.cameraController.getRightDirection();

      desiredTranslation.x = forward.x * moveDir.z + right.x * moveDir.x;
      desiredTranslation.z = forward.z * moveDir.z + right.z * moveDir.x;
      desiredTranslation.normalize().multiplyScalar(this.speed * dt);

      if (this.cameraController.isFirstPerson) {
        this.headPitch = this.cameraController.fpPitch;

        let targetBodyRot = this.cameraController.fpYaw + Math.PI;
        let angleDiff = targetBodyRot - this.currentRotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const deadzone = Math.PI / 8;
        if (Math.abs(angleDiff) > deadzone) {
          const correction = Math.sign(angleDiff) * (Math.abs(angleDiff) - deadzone);
          this.currentRotation += correction;
          angleDiff = targetBodyRot - this.currentRotation;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        }
        this.headYaw = angleDiff;
      } else {
        this.headPitch = 0;
        this.headYaw = 0;
        if (isUsingJetpack || this.isFlying) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.headPitch = Math.asin(camDir.y);
        }
        const targetRotation = Math.atan2(desiredTranslation.x, desiredTranslation.z) + Math.PI;
        let rotDiff = targetRotation - this.currentRotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        this.currentRotation += rotDiff * this.rotationSmoothness;
      }
    } else {
      if (this.cameraController && this.cameraController.isFirstPerson) {
        this.headPitch = this.cameraController.fpPitch;

        let targetBodyRot = this.cameraController.fpYaw + Math.PI;
        let angleDiff = targetBodyRot - this.currentRotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const deadzone = Math.PI / 8;
        if (Math.abs(angleDiff) > deadzone) {
          const correction = targetBodyRot - Math.sign(angleDiff) * deadzone;
          let diff = correction - this.currentRotation;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.currentRotation += diff * 15.0 * dt;

          angleDiff = targetBodyRot - this.currentRotation;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        }
        this.headYaw = angleDiff;
      } else {
        this.headPitch = 0;
        this.headYaw = 0;
        if (isUsingJetpack || this.isFlying) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.headPitch = Math.asin(camDir.y);
        }
      }
    }

    const isSuperman = isUsingJetpackCameraDir || isUsingJetpackShiftFlight;
    const noPitchTilt = !!isUsingJetpackCameraDir;
    const visualCrouch = input.keys.crouch && !isSuperman;

    this.glbModel.update(dt, hasInput);
    this.polygonModel.update(dt, hasInput);
    this.polygonModelSkin.update(dt, hasInput, visualCrouch, input.keys.attack, isGrounded, this.verticalVelocity, isSuperman, noPitchTilt);

    if (this.particleSystem) this.particleSystem.update(dt);

    if (hasJetpack) {
      const currentAirTimeLeft = Math.max(0, this.equippedItem.airLimit - this.consecutiveAirTime);
      this.emit("jumpChanged", {
        current: currentAirTimeLeft,
        max: this.equippedItem.airLimit,
        type: "jetpack"
      });
    }

    if (this.isClimbing) {
      this.verticalVelocity = 0;
      if (input.keys.forward) this.verticalVelocity = 3;
      if (input.keys.backward) this.verticalVelocity = -3;

      if (input.keys.forward || input.keys.backward) {
        desiredTranslation.x = 0;
        desiredTranslation.z = 0;
        if (input.keys.left || input.keys.right) {
          const right = this.cameraController.getRightDirection();
          desiredTranslation.x = right.x * moveDir.x;
          desiredTranslation.z = right.z * moveDir.x;
          desiredTranslation.normalize().multiplyScalar((this.speed / 2) * dt);
        }
      }
    }

    if (isGrounded) {
      this.airWeaponMultiplier = 1.0;
      this.consecutiveAirTime = 0;
      if (this.jumpCount > 0) {
        this.jumpCount = 0;
        this.emit("jumpChanged", { current: this.maxMultiJumps, max: this.maxMultiJumps, type: "reset" });
      }
    }

    const jumpJustPressed = input.keys.jump && !this.wasJumpDown;

    isUsingJetpack = false;

    if (this.isClimbing) {
      if (input.keys.jump) {
        this.isClimbing = false;
        this.verticalVelocity = 5;
      }
    } else if (isUsingJetpackCameraDir || isUsingJetpackShiftFlight) {
      isUsingJetpack = true;
      this.consecutiveAirTime += dt;

      const flyDir = new THREE.Vector3();
      this.camera.getWorldDirection(flyDir);
      if (isUsingJetpackCameraDir && this.cameraController) {
        flyDir.copy(this.cameraController.getForwardDirection());
      }
      flyDir.normalize();

      const velocity = flyDir.clone().multiplyScalar(this.equippedItem.thrust);

      let limitActive = false;
      if (this.equippedItem && this.equippedItem.limitHeightEnabled) {
        const curY = this.getPosition().y;
        const maxLimit = this.equippedItem.maxFlightHeight !== undefined ? this.equippedItem.maxFlightHeight : 20.0;
        if (curY >= maxLimit) {
          limitActive = true;
        }
      }

      if (limitActive && velocity.y > 0) {
        velocity.y = 0;
      }

      this.verticalVelocity = velocity.y;
      desiredTranslation.copy(velocity).multiplyScalar(dt);

      const targetRotation = Math.atan2(flyDir.x, flyDir.z) + Math.PI;
      let rotDiff = targetRotation - this.currentRotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.currentRotation += rotDiff * 0.3;

      this.equippedItem.consumeFuel(dt);

      if (this.particleSystem && this.polygonModelSkin && this.polygonModelSkin.backItemMesh) {
        const jetpackMesh = this.polygonModelSkin.backItemMesh;
        const leftNozzleWorld = new THREE.Vector3();
        const rightNozzleWorld = new THREE.Vector3();
        const leftOffset = new THREE.Vector3(-0.15, 0.1, 0.5);
        const rightOffset = new THREE.Vector3(0.15, 0.1, 0.5);

        jetpackMesh.updateMatrixWorld(true);
        jetpackMesh.localToWorld(leftNozzleWorld.copy(leftOffset));
        jetpackMesh.localToWorld(rightNozzleWorld.copy(rightOffset));

        const normal = new THREE.Vector3(0, -1, 0);
        this.particleSystem.spawnJetpackEffect(leftNozzleWorld, normal, this.equippedItem.particleVFX);
        this.particleSystem.spawnJetpackEffect(rightNozzleWorld, normal, this.equippedItem.particleVFX);
      }

      this.emit("jetpackUpdate", {
        fuel: this.equippedItem.consumableUse,
        maxFuel: this.equippedItem.maxConsumableUse,
        airTime: this.consecutiveAirTime,
        maxAirTime: this.equippedItem.airLimit
      });

      if (this.equippedItem.consumableUse <= 0) {
        console.log("Jetpack exhausted!");
        const game = (this.scene as any).userData?.game || (this as any).game;
        if (game && game.inventoryManager) {
          game.inventoryManager.removeCurrentItem();
        } else {
          this.setHeldItem(null);
        }
      }
    } else if (isGrounded && input.keys.jump) {
      this.verticalVelocity = this.jumpForce;
    } else if (!isGrounded && !this.isFlying) {
      if (hasJetpack && input.keys.jump && hasFuel && withinAirLimit) {
        isUsingJetpack = true;
        this.consecutiveAirTime += dt;

        let limitActive = false;
        if (this.equippedItem && this.equippedItem.limitHeightEnabled) {
          const curY = this.getPosition().y;
          const maxLimit = this.equippedItem.maxFlightHeight !== undefined ? this.equippedItem.maxFlightHeight : 20.0;
          if (curY >= maxLimit) {
            limitActive = true;
          }
        }

        if (limitActive) {
          this.verticalVelocity = Math.min(this.verticalVelocity, 0);
        } else {
          if (this.verticalVelocity < 0) {
            this.verticalVelocity = 0;
          }
          this.verticalVelocity += (this.equippedItem.thrust - 35) * dt;

          if (this.verticalVelocity > this.equippedItem.thrust) {
            this.verticalVelocity = this.equippedItem.thrust;
          }
        }

        this.equippedItem.consumeFuel(dt);

        if (this.particleSystem && this.polygonModelSkin && this.polygonModelSkin.backItemMesh) {
          const jetpackMesh = this.polygonModelSkin.backItemMesh;
          const leftNozzleWorld = new THREE.Vector3();
          const rightNozzleWorld = new THREE.Vector3();
          const leftOffset = new THREE.Vector3(-0.15, 0.1, 0.5);
          const rightOffset = new THREE.Vector3(0.15, 0.1, 0.5);

          jetpackMesh.updateMatrixWorld(true);
          jetpackMesh.localToWorld(leftNozzleWorld.copy(leftOffset));
          jetpackMesh.localToWorld(rightNozzleWorld.copy(rightOffset));

          const normal = new THREE.Vector3(0, -1, 0);
          this.particleSystem.spawnJetpackEffect(leftNozzleWorld, normal, this.equippedItem.particleVFX);
          this.particleSystem.spawnJetpackEffect(rightNozzleWorld, normal, this.equippedItem.particleVFX);
        }

        this.emit("jetpackUpdate", {
          fuel: this.equippedItem.consumableUse,
          maxFuel: this.equippedItem.maxConsumableUse,
          airTime: this.consecutiveAirTime,
          maxAirTime: this.equippedItem.airLimit
        });

        if (this.equippedItem.consumableUse <= 0) {
          console.log("Jetpack exhausted!");
          const game = (this.scene as any).userData?.game || (this as any).game;
          if (game && game.inventoryManager) {
            game.inventoryManager.removeCurrentItem();
          } else {
            this.setHeldItem(null);
          }
        }
      } else {
        if (jumpJustPressed && this.jumpCount < this.maxMultiJumps) {
          this.verticalVelocity = this.jumpForce;
          this.jumpCount++;
          console.log(`Multi-Jump: ${this.jumpCount}/${this.maxMultiJumps}`);

          this.emit("jumpChanged", {
            current: this.maxMultiJumps - this.jumpCount,
            max: this.maxMultiJumps,
            type: "air-jump"
          });

          if (this.particleSystem) {
            this.particleSystem.spawnJumpEffect(this.getPosition());
          }
        }

        if (this.verticalVelocity > -20) {
          this.verticalVelocity -= 50 * dt;
        }
      }
    }

    this.wasJumpDown = input.keys.jump;

    if (isGrounded && this.verticalVelocity <= 0) {
      this.verticalVelocity = -5;
    }

    desiredTranslation.y = this.verticalVelocity * dt;

    const dampingFactor = Math.exp(-this.momentumDamping * dt);
    this.momentum.multiplyScalar(dampingFactor);
    if (this.momentum.lengthSq() < 0.01) {
      this.momentum.set(0, 0, 0);
    }
    desiredTranslation.add(this.momentum.clone().multiplyScalar(dt));

    if (remotePlayers && this.playerCollision !== "none") {
      const myPos = this.getPosition();
      const radius = 0.5;

      remotePlayers.forEach((rp: any) => {
        const rpCollision = (rp.state && rp.state.playerCollision) || "push";
        if (rpCollision === "none") return;

        const dy = Math.abs(myPos.y + 0.9 - (rp.currentPosition.y + 0.9));
        if (dy > 1.8) return;

        const dx = myPos.x - rp.currentPosition.x;
        const dz = myPos.z - rp.currentPosition.z;
        const distSq = dx * dx + dz * dz;
        const maxDist = radius * 2.0;

        if (distSq > 0.0001 && distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          const overlap = maxDist - dist;

          const nx = dx / dist;
          const nz = dz / dist;

          if (this.playerCollision === "no-push" || rpCollision === "no-push") {
            const dot = desiredTranslation.x * nx + desiredTranslation.z * nz;
            if (dot < 0) {
              desiredTranslation.x -= dot * nx;
              desiredTranslation.z -= dot * nz;
            }
          } else if (this.playerCollision === "push" && rpCollision === "push") {
            const pushStrength = 30 * overlap;
            desiredTranslation.x += nx * pushStrength * dt;
            desiredTranslation.z += nz * pushStrength * dt;
          }
        }
      });
    }

    const groups = this.collider.collisionGroups();
    this.characterController.computeColliderMovement(
      this.collider,
      desiredTranslation,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      groups
    );

    const correctedMovement = this.characterController.computedMovement();
    const newPos = this.rigidBody.translation();
    newPos.x += correctedMovement.x;
    newPos.y += correctedMovement.y;
    newPos.z += correctedMovement.z;

    this.rigidBody.setNextKinematicTranslation(newPos);

    this.updateModelVisuals();
  }

  toggleFlight() {
    this.isFlying = !this.isFlying;
    this.verticalVelocity = 0;
    this.momentum.set(0, 0, 0);
    console.log("Flight Mode:", this.isFlying);
  }

  handleFlightMovement(dt: number, input: InputManager, moveDir: THREE.Vector3) {
    this.verticalVelocity = 0;
    const desiredTranslation = new THREE.Vector3();
    const speed = this.speed * 2;

    if (this.cameraController) {
      const forward = this.cameraController.getForwardDirection();
      const right = this.cameraController.getRightDirection();
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      if (input.keys.forward) desiredTranslation.add(camDir);
      if (input.keys.backward) desiredTranslation.sub(camDir);
      if (input.keys.right) desiredTranslation.add(right);
      if (input.keys.left) desiredTranslation.sub(right);

      if (input.keys.jump) desiredTranslation.y += 1;
    }

    if (desiredTranslation.lengthSq() > 0) {
      desiredTranslation.normalize().multiplyScalar(speed * dt);
    }

    this.characterController.computeColliderMovement(
      this.collider,
      desiredTranslation,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
    );
    const corrected = this.characterController.computedMovement();
    const newPos = this.rigidBody.translation();
    newPos.x += corrected.x;
    newPos.y += corrected.y;
    newPos.z += corrected.z;
    this.rigidBody.setNextKinematicTranslation(newPos);

    this.updateModelVisuals();
  }

  checkFlightToggle(input: InputManager) {
    if (input.keys.jump && !this.wasJumpDown) {
      const now = Date.now();
      if (now - this.lastJumpTime < 300) {
        this.toggleFlight();
      }
      this.lastJumpTime = now;
    }
  }

  checkClimbing() {
    if (!this.ladders || this.ladders.length === 0) return;

    const myPos = this.getPosition();
    const center = myPos.clone().add(new THREE.Vector3(0, 1, 0));

    let touchingLadder = false;

    for (const ladder of this.ladders) {
      if (!ladder.bounds) ladder.bounds = new THREE.Box3();
      if (!ladder.userData) ladder.userData = {};

      if (ladder.userData.needsBoundsUpdate || !ladder.userData.boundsInitialized) {
        if (typeof ladder.updateMatrixWorld === "function") {
          ladder.updateMatrixWorld(true);

          ladder.bounds.makeEmpty();

          if (typeof ladder.traverse === "function") {
            ladder.traverse((child: any) => {
              if (child.type === "AxesHelper" || (child.userData && child.userData.isGizmo)) return;

              if (child.geometry) {
                ladder.bounds.expandByObject(child);
              }
            });
          } else {
            ladder.bounds.setFromObject(ladder);
          }
        }

        ladder.userData.needsBoundsUpdate = false;
        ladder.userData.boundsInitialized = true;
      }

      if (ladder.bounds.distanceToPoint(center) < 0.7) {
        touchingLadder = true;
        break;
      }
    }

    if (touchingLadder && !this.isClimbing) {
      this.isClimbing = true;
      this.verticalVelocity = 0;
    } else if (!touchingLadder && this.isClimbing) {
      this.isClimbing = false;
    }
  }

  updateModelVisuals() {
    if (!this.rigidBody) return;

    const pos = this.rigidBody.translation();
    const position = new THREE.Vector3(pos.x, pos.y, pos.z);

    this.glbModel.setPosition(position);
    this.glbModel.setRotation(this.currentRotation);

    this.polygonModel.setPosition(position);
    this.polygonModel.setRotation(this.currentRotation);

    this.polygonModelSkin.setPosition(position);
    this.polygonModelSkin.setRotation(this.currentRotation);
    if (this.polygonModelSkin.setHeadRotation) {
      this.polygonModelSkin.setHeadRotation(this.headPitch, this.headYaw);
    }

    const isFP = this.cameraController ? this.cameraController.isFirstPerson : false;
    if (this.polygonModelSkin.setFirstPerson) {
      this.polygonModelSkin.setFirstPerson(isFP);
    }
  }

  getPosition() {
    if (this.rigidBody) {
      const t = this.rigidBody.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    }
    return new THREE.Vector3();
  }

  getRotation() {
    return this.currentRotation;
  }

  setStats(stats: Partial<CharacterStats & JumpConfig & FlightConfig & { playerCollision: PlayerCollisionMode }>) {
    if (stats.speed !== undefined) this.speed = stats.speed;
    if (stats.jumpForce !== undefined) this.jumpForce = stats.jumpForce;
    if (stats.maxHealth !== undefined) {
      this.maxHealth = stats.maxHealth;
      this.currentHealth = this.maxHealth;
    }
    if (stats.respawns !== undefined) this.respawns = stats.respawns;
    if (stats.canFly !== undefined) this.canFly = stats.canFly;
    if (stats.maxMultiJumps !== undefined) this.maxMultiJumps = stats.maxMultiJumps;

    if (stats.jumpAnimationType !== undefined) {
      this.polygonModelSkin.setJumpAnimationType(stats.jumpAnimationType);
    }
    if (stats.fallAnimationType !== undefined) {
      this.polygonModelSkin.setFallAnimationType(stats.fallAnimationType);
    }
    if (stats.playerCollision !== undefined) {
      this.playerCollision = stats.playerCollision;
      this.applyCollisionProfile();
    }

    console.log("Stats Updated:", stats);
  }

  setHeldItem(item: any) {
    this.equippedItem = item;
    this.emit("itemEquipped", item);

    if (this.polygonModelSkin) {
      this.polygonModelSkin.setHeldItem(item);
    }

    const hasJetpack = item && (item.id === "jetpack" || item.id.startsWith("jetpack_"));
    if (hasJetpack) {
      const cooldownLimit = item.cooldownTime !== undefined ? item.cooldownTime : 3.0;
      this.jetpackCooldownTimer = cooldownLimit; // Start fully charged!
    } else {
      this.emit("jumpChanged", { current: this.maxMultiJumps, max: this.maxMultiJumps, type: "reset" });
    }
  }

  takeDamage(amount: number) {
    if (this.isDead || this.noClip) return;

    this.currentHealth -= amount;
    console.log(`Player Health: ${this.currentHealth}/${this.maxHealth}`);

    this.emit("healthChanged", { current: this.currentHealth, max: this.maxHealth });

    if (this.currentHealth <= 0) {
      this.die();
    }
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    console.log("Player Died!");

    if (this.respawns === -1 || this.respawns > 0) {
      if (this.respawns > 0) this.respawns--;
      setTimeout(() => this.respawn(), 2000);
    } else {
      console.log("Game Over - No Respawns Left");
      alert("¡Has muerto definitivamente!");
    }
  }

  respawn() {
    if (!this.rigidBody) return;

    this.isDead = false;
    this.currentHealth = this.maxHealth;

    this.emit("healthChanged", { current: this.currentHealth, max: this.maxHealth });
    this.emit("jumpChanged", { current: this.maxMultiJumps, max: this.maxMultiJumps });

    const respawnPos = this.startPosition;

    this.rigidBody.setTranslation({ x: respawnPos.x, y: respawnPos.y, z: respawnPos.z }, true);
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

    console.log("Respawned at", respawnPos);
  }
}

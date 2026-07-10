import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLBModel } from "./models/glb/GLBModel";
import { PolygonModel } from "./models/polygon/PolygonModel";
import { PolygonModelSkin } from "./models/polygon/PolygonModelSkin";
import { ParticleSystem } from "../effects/ParticleSystem";
import { InputManager } from "../input/InputManager";
import type { CharacterStats, JumpConfig, FlightConfig, PlayerCollisionMode, RemotePlayerState } from "../types";
import {
  getGravityQuaternion,
  normalizeGravityOrientation,
  type GravityOrientation
} from "../utils/GravityOrientation";

type LadderObject = THREE.Object3D & { bounds?: THREE.Box3 };

const AIM_BODY_DEADZONE = Math.PI / 8;
const AIM_BODY_TURN_SPEED = 15.0;

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
  isSuperman: boolean;
  noPitchTilt: boolean;
  isUsingJetpack: boolean;
  gravityOrientation: GravityOrientation;
  targetGravityOrientation: GravityOrientation;
  gravityTransitionDuration: number;
  gravityTransitionElapsed: number;
  gravityTransitionActive: boolean;
  gravityTransitionStart: THREE.Quaternion;
  currentGravityQuaternion: THREE.Quaternion;
  targetGravityQuaternion: THREE.Quaternion;
  gravityAcceleration: number;
  gravityContactAnchorPoint: THREE.Vector3 | null;
  gravityContactAnchorNormal: THREE.Vector3 | null;
  gravityContactPreserveTime: number;
  capsuleHalfHeight: number;
  capsuleRadius: number;
  capsuleCenterOffset: number;


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
    this.runSpeed = 15;
    this.crouchSpeed = 5.0;
    this.independentSpeeds = false;
    this.staminaMax = 5.0;
    this.stamina = 5.0;
    this.isRunning = false;
    this.runningIgnoresShift = false;
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

    this.gravityOrientation = "down";
    this.targetGravityOrientation = "down";
    this.gravityTransitionDuration = 0;
    this.gravityTransitionElapsed = 0;
    this.gravityTransitionActive = false;
    this.gravityTransitionStart = new THREE.Quaternion();
    this.currentGravityQuaternion = new THREE.Quaternion();
    this.targetGravityQuaternion = new THREE.Quaternion();
    this.gravityAcceleration = 50;
    this.gravityContactAnchorPoint = null;
    this.gravityContactAnchorNormal = null;
    this.gravityContactPreserveTime = 0;
    this.capsuleHalfHeight = 0.5;
    this.capsuleRadius = 0.4;
    this.capsuleCenterOffset = 0.9;

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
    this.isSuperman = false;
    this.noPitchTilt = false;
    this.isUsingJetpack = false;
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

  normalizeAngle(angle: number) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  isHoldingAimWeapon() {
    return !!(this.equippedItem && this.equippedItem.type === "weapon");
  }

  getAimPitch() {
    const up = this.getGravityUpVector();
    if (!this.cameraController) return 0;
    if (this.cameraController.isFirstPerson) return this.cameraController.fpPitch || 0;

    if (typeof this.cameraController.phi === "number") {
      const maxPitch = this.cameraController.maxPitch || (Math.PI / 2 - 0.35);
      return THREE.MathUtils.clamp(-this.cameraController.phi, -maxPitch, maxPitch);
    }

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    return Math.asin(THREE.MathUtils.clamp(camDir.dot(up), -1, 1));
  }

  getAimYaw() {
    if (!this.cameraController) return this.currentRotation - Math.PI;
    return this.cameraController.isFirstPerson ? this.cameraController.fpYaw : this.cameraController.theta;
  }

  updateAimAlignment(dt: number, snapToDeadzone: boolean) {
    this.headPitch = this.getAimPitch();

    const targetBodyRot = this.getAimYaw() + Math.PI;
    let angleDiff = this.normalizeAngle(targetBodyRot - this.currentRotation);

    if (Math.abs(angleDiff) > AIM_BODY_DEADZONE) {
      if (snapToDeadzone) {
        const correction = Math.sign(angleDiff) * (Math.abs(angleDiff) - AIM_BODY_DEADZONE);
        this.currentRotation += correction;
      } else {
        const correctionTarget = targetBodyRot - Math.sign(angleDiff) * AIM_BODY_DEADZONE;
        const correctionDiff = this.normalizeAngle(correctionTarget - this.currentRotation);
        this.currentRotation += correctionDiff * AIM_BODY_TURN_SPEED * dt;
      }

      angleDiff = this.normalizeAngle(targetBodyRot - this.currentRotation);
    }

    this.headYaw = angleDiff;
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

    const colliderDesc = RAPIER.ColliderDesc.capsule(this.capsuleHalfHeight, this.capsuleRadius).setTranslation(0, this.capsuleCenterOffset, 0);
    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    this.characterController = this.world.createCharacterController(0.1);
    this.characterController.enableAutostep(0.6, 0.25, true);
    this.characterController.enableSnapToGround(0.5);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    this.characterController.setApplyImpulsesToDynamicBodies(true);

    this.characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((45 * Math.PI) / 180);
    this.characterController.setUp({ x: 0, y: 1, z: 0 });
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

  getGravityUpVector() {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.currentGravityQuaternion).normalize();
  }

  getGravityDirection() {
    return this.getGravityUpVector().multiplyScalar(-1);
  }

  getGravityOrientation() {
    return this.targetGravityOrientation || this.gravityOrientation;
  }

  getGravityQuaternion() {
    return this.currentGravityQuaternion.clone();
  }

  getGravityState() {
    return {
      orientation: this.getGravityOrientation(),
      up: this.getGravityUpVector(),
      quaternion: this.getGravityQuaternion()
    };
  }

  setGravityOrientation(orientation: any, options: { duration?: number; instant?: boolean; contactNormal?: THREE.Vector3; contactPoint?: THREE.Vector3 } = {}) {
    const nextOrientation = normalizeGravityOrientation(orientation);
    const nextQuaternion = getGravityQuaternion(nextOrientation);
    const duration = Math.max(0, Number(options.duration ?? 0.65));
    const isSameTarget = nextOrientation === this.targetGravityOrientation;

    if (isSameTarget && !this.gravityTransitionActive) {
      return;
    }

    this.targetGravityOrientation = nextOrientation;
    this.targetGravityQuaternion.copy(nextQuaternion);
    this.captureGravityContactAnchor(duration, options.contactNormal, options.contactPoint);

    if (options.instant || duration <= 0) {
      this.gravityOrientation = nextOrientation;
      this.currentGravityQuaternion.copy(nextQuaternion);
      this.gravityTransitionActive = false;
      this.gravityTransitionElapsed = 0;
      this.gravityTransitionDuration = 0;
      this.applyGravityUpToPhysics();
      this.correctRotationAgainstAnchor();
      this.updateModelVisuals();
      return;
    }

    this.gravityTransitionStart.copy(this.currentGravityQuaternion);
    this.gravityTransitionDuration = duration;
    this.gravityTransitionElapsed = 0;
    this.gravityTransitionActive = true;
    this.applyGravityUpToPhysics();
  }

  getCapsuleSupportOffsetAlong(normal: THREE.Vector3, rotation: THREE.Quaternion) {
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();
    const center = new THREE.Vector3(0, this.capsuleCenterOffset, 0).applyQuaternion(rotation);
    return center.dot(normal) - this.capsuleHalfHeight * Math.abs(axis.dot(normal)) - this.capsuleRadius;
  }

  captureGravityContactAnchor(duration: number, contactNormal?: THREE.Vector3, contactPoint?: THREE.Vector3) {
    const isGrounded = this.characterController ? this.characterController.computedGrounded() : this.grounded;
    if (!this.rigidBody || this.noClip || this.isFlying || (!contactNormal && !isGrounded)) {
      this.gravityContactAnchorPoint = null;
      this.gravityContactAnchorNormal = null;
      this.gravityContactPreserveTime = 0;
      return;
    }

    const position = this.getPosition();
    const normal = contactNormal ? contactNormal.clone().normalize() : this.getGravityUpVector();
    if (normal.lengthSq() < 0.0001) {
      this.gravityContactAnchorPoint = null;
      this.gravityContactAnchorNormal = null;
      this.gravityContactPreserveTime = 0;
      return;
    }
    const supportOffset = this.getCapsuleSupportOffsetAlong(normal, this.currentGravityQuaternion);

    this.gravityContactAnchorPoint = contactPoint ? contactPoint.clone() : position.clone().addScaledVector(normal, supportOffset);
    this.gravityContactAnchorNormal = normal;
    this.gravityContactPreserveTime = Math.max(0.12, duration + 0.12);
  }

  constrainPositionToGravityAnchor(position: THREE.Vector3) {
    if (!this.gravityContactAnchorPoint || !this.gravityContactAnchorNormal || this.gravityContactPreserveTime <= 0) {
      return position;
    }

    const normal = this.gravityContactAnchorNormal;
    const supportOffset = this.getCapsuleSupportOffsetAlong(normal, this.currentGravityQuaternion);
    const currentSupport = position.dot(normal) + supportOffset;
    const anchorSupport = this.gravityContactAnchorPoint.dot(normal);
    const correction = anchorSupport - currentSupport;

    if (correction > 0.0001) {
      position.addScaledVector(normal, correction);
    }

    return position;
  }

  correctRotationAgainstAnchor() {
    if (!this.rigidBody) return;
    const t = this.rigidBody.translation();
    const corrected = this.constrainPositionToGravityAnchor(new THREE.Vector3(t.x, t.y, t.z));
    if (Math.abs(corrected.x - t.x) > 0.0001 || Math.abs(corrected.y - t.y) > 0.0001 || Math.abs(corrected.z - t.z) > 0.0001) {
      this.rigidBody.setTranslation({ x: corrected.x, y: corrected.y, z: corrected.z }, true);
      this.rigidBody.setNextKinematicTranslation({ x: corrected.x, y: corrected.y, z: corrected.z });
    }
  }

  updateGravityTransition(dt: number) {
    if (this.gravityContactPreserveTime > 0) {
      this.gravityContactPreserveTime = Math.max(0, this.gravityContactPreserveTime - dt);
      if (this.gravityContactPreserveTime === 0) {
        this.gravityContactAnchorPoint = null;
        this.gravityContactAnchorNormal = null;
      }
    }

    if (this.gravityTransitionActive) {
      this.gravityTransitionElapsed += dt;
      const t = THREE.MathUtils.clamp(this.gravityTransitionElapsed / Math.max(this.gravityTransitionDuration, 0.0001), 0, 1);
      const eased = t * t * (3 - 2 * t);
      this.currentGravityQuaternion.copy(this.gravityTransitionStart).slerp(this.targetGravityQuaternion, eased);

      if (t >= 1) {
        this.currentGravityQuaternion.copy(this.targetGravityQuaternion);
        this.gravityOrientation = this.targetGravityOrientation;
        this.gravityTransitionActive = false;
      }
    }

    this.applyGravityUpToPhysics();

    if (this.rigidBody) {
      this.correctRotationAgainstAnchor();
      this.rigidBody.setNextKinematicRotation(this.currentGravityQuaternion);
    }

    if (this.cameraController) {
      if (typeof this.cameraController.setGravityQuaternion === "function") {
        this.cameraController.setGravityQuaternion(this.getGravityQuaternion());
      } else if (typeof this.cameraController.setGravityUpVector === "function") {
        this.cameraController.setGravityUpVector(this.getGravityUpVector());
      }
    }
  }

  applyGravityUpToPhysics() {
    if (!this.characterController) return;
    const up = this.getGravityUpVector();
    this.characterController.setUp({ x: up.x, y: up.y, z: up.z });
  }

  getGravityBasis() {
    const q = this.currentGravityQuaternion;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q).normalize();
    return { up, forward, right };
  }

  getYawFromWorldDirection(direction: THREE.Vector3) {
    const { up, forward, right } = this.getGravityBasis();
    const planar = direction.clone().projectOnPlane(up);
    if (planar.lengthSq() < 0.0001) return this.currentRotation;
    planar.normalize();
    return Math.atan2(planar.dot(right.clone().multiplyScalar(-1)), planar.dot(forward)) + Math.PI;
  }

  applyImpulse(force: THREE.Vector3) {
    const up = this.getGravityUpVector();
    const verticalImpulse = force.dot(up);
    const lateralImpulse = force.clone().sub(up.clone().multiplyScalar(verticalImpulse));

    this.momentum.add(lateralImpulse);
    if (Math.abs(verticalImpulse) > 0.0001) {
      this.verticalVelocity = verticalImpulse;
      this.grounded = false;
    }
  }

  update(dt: number, input: InputManager, remotePlayers: any[]) {
    if (!this.rigidBody) return;

    if (this.cameraController && this.cameraController.mode === 'free-fly') {
      this.verticalVelocity = 0;
      this.glbModel.update(dt, false);
      this.polygonModel.update(dt, false);
      this.polygonModelSkin.update(dt, false, false, false, true, 0, false, false);
      this.updateModelVisuals();
      return;
    }

    this.updateGravityTransition(dt);

    this.isSuperman = false;
    this.noPitchTilt = false;
    this.isUsingJetpack = false;

    const isGrounded = this.characterController ? this.characterController.computedGrounded() : false;
    this.grounded = isGrounded;
    const up = this.getGravityUpVector();
    const gravityDir = up.clone().multiplyScalar(-1);

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

        if (input.keys.jump) moveDir.add(up);
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
        this.polygonModelSkin.update(dt, hasInput, input.keys.crouch, input.keys.attack, false, this.verticalVelocity, false, false, false);
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

    // Handle Sprinting & Crouch input overrides
    if (input.doubleShiftTapped) {
      if (hasInput && this.stamina > 0 && !this.isRunning) {
        this.isRunning = true;
        this.runningIgnoresShift = true;
      } else {
        this.isRunning = false;
      }
      input.doubleShiftTapped = false;
    }

    if (!input.keys.crouch) {
      this.runningIgnoresShift = false;
    }

    if (this.isRunning && input.keys.crouch && !this.runningIgnoresShift) {
      this.isRunning = false;
    }

    if (!hasInput || this.stamina <= 0) {
      this.isRunning = false;
    }

    // Stamina consumption / regeneration
    if (this.isRunning) {
      this.stamina = Math.max(0, this.stamina - dt);
    } else {
      this.stamina = Math.min(this.staminaMax, this.stamina + dt * (this.staminaMax / 4));
    }

    this.emit("staminaChanged", { current: this.stamina, max: this.staminaMax });

    const isCrouchingActive = input.keys.crouch && !this.isRunning;

    let currentSpeed = this.speed;
    if (this.isRunning) {
      currentSpeed = this.runSpeed;
    } else if (isCrouchingActive) {
      currentSpeed = this.crouchSpeed !== undefined ? this.crouchSpeed : this.speed / 2;
    }

    const shouldAimAlign = this.cameraController && (this.cameraController.isFirstPerson || this.isHoldingAimWeapon());

    if (hasInput && this.cameraController) {
      const forward = this.cameraController.getForwardDirection();
      const right = this.cameraController.getRightDirection();

      desiredTranslation
        .addScaledVector(forward, moveDir.z)
        .addScaledVector(right, moveDir.x)
        .projectOnPlane(up);

      if (desiredTranslation.lengthSq() > 0.0001) {
        desiredTranslation.normalize().multiplyScalar(currentSpeed * dt);
      }

      if (shouldAimAlign) {
        this.updateAimAlignment(dt, true);
      } else {
        this.headPitch = 0;
        this.headYaw = 0;
        if (isUsingJetpack || this.isFlying) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.headPitch = Math.asin(THREE.MathUtils.clamp(camDir.dot(up), -1, 1));
        }
        const targetRotation = this.getYawFromWorldDirection(desiredTranslation);
        let rotDiff = targetRotation - this.currentRotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        this.currentRotation += rotDiff * this.rotationSmoothness;
      }
    } else {
      if (shouldAimAlign) {
        this.updateAimAlignment(dt, false);
      } else {
        this.headPitch = 0;
        this.headYaw = 0;
        if (isUsingJetpack || this.isFlying) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.headPitch = Math.asin(THREE.MathUtils.clamp(camDir.dot(up), -1, 1));
        }
      }
    }

    const isSuperman = isUsingJetpackCameraDir || isUsingJetpackShiftFlight;
    const noPitchTilt = !!isUsingJetpackCameraDir;
    const visualCrouch = isCrouchingActive && !isSuperman;

    this.glbModel.update(dt, hasInput);
    this.polygonModel.update(dt, hasInput);
    this.polygonModelSkin.update(dt, hasInput, visualCrouch, input.keys.attack, isGrounded, this.verticalVelocity, isSuperman, noPitchTilt, this.isRunning);

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
      const verticalComponent = velocity.dot(up);

      let limitActive = false;
      if (this.equippedItem && this.equippedItem.limitHeightEnabled) {
        const curY = this.getPosition().y;
        const maxLimit = this.equippedItem.maxFlightHeight !== undefined ? this.equippedItem.maxFlightHeight : 20.0;
        if (curY >= maxLimit) {
          limitActive = true;
        }
      }

      if (limitActive && verticalComponent > 0) {
        velocity.addScaledVector(up, -verticalComponent);
      }

      this.verticalVelocity = velocity.dot(up);
      desiredTranslation.copy(velocity).multiplyScalar(dt);

      const targetRotation = this.getYawFromWorldDirection(flyDir);
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

        const normal = gravityDir.clone();
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

          const normal = gravityDir.clone();
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
          this.polygonModelSkin?.triggerAirJump?.();

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

    desiredTranslation.addScaledVector(up, this.verticalVelocity * dt);

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

        const delta = myPos.clone().sub(rp.currentPosition);
        const verticalGap = Math.abs(delta.dot(up));
        if (verticalGap > 1.8) return;

        const planarDelta = delta.projectOnPlane(up);
        const distSq = planarDelta.lengthSq();
        const maxDist = radius * 2.0;

        if (distSq > 0.0001 && distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          const overlap = maxDist - dist;

          const pushDir = planarDelta.multiplyScalar(1 / dist);

          if (this.playerCollision === "no-push" || rpCollision === "no-push") {
            const dot = desiredTranslation.dot(pushDir);
            if (dot < 0) {
              desiredTranslation.addScaledVector(pushDir, -dot);
            }
          } else if (this.playerCollision === "push" && rpCollision === "push") {
            const pushStrength = 30 * overlap;
            desiredTranslation.addScaledVector(pushDir, pushStrength * dt);
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

    const anchoredPos = this.constrainPositionToGravityAnchor(new THREE.Vector3(newPos.x, newPos.y, newPos.z));
    this.rigidBody.setNextKinematicTranslation({
      x: anchoredPos.x,
      y: anchoredPos.y,
      z: anchoredPos.z
    });

    this.isSuperman = isSuperman;
    this.noPitchTilt = noPitchTilt;
    this.isUsingJetpack = isUsingJetpack;

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
    const up = this.getGravityUpVector();

    if (this.cameraController) {
      const forward = this.cameraController.getForwardDirection();
      const right = this.cameraController.getRightDirection();
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      if (input.keys.forward) desiredTranslation.add(camDir);
      if (input.keys.backward) desiredTranslation.sub(camDir);
      if (input.keys.right) desiredTranslation.add(right);
      if (input.keys.left) desiredTranslation.sub(right);

      if (input.keys.jump) desiredTranslation.add(up);
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

    this.applyModelTransform(this.glbModel, position, 0);
    this.applyModelTransform(this.polygonModel, position, Math.PI);
    this.applyModelTransform(this.polygonModelSkin, position, Math.PI);
    if (this.polygonModelSkin.setHeadRotation) {
      this.polygonModelSkin.setHeadRotation(this.headPitch, this.headYaw);
    }

    const isFP = this.cameraController ? this.cameraController.isFirstPerson : false;
    if (this.polygonModelSkin.setFirstPerson) {
      this.polygonModelSkin.setFirstPerson(isFP);
    }
  }

  applyModelTransform(modelController: any, position: THREE.Vector3, yawOffset: number) {
    if (!modelController?.model) return;
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentRotation + yawOffset);
    modelController.model.position.copy(position);
    modelController.model.quaternion.copy(this.currentGravityQuaternion).multiply(yaw);
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

  setStats(stats: Partial<CharacterStats & JumpConfig & FlightConfig & { playerCollision: PlayerCollisionMode; gravityOrientation: GravityOrientation; gravityTransitionDuration: number }>) {
    if (stats.independentSpeeds !== undefined) this.independentSpeeds = stats.independentSpeeds;
    if (stats.speed !== undefined) this.speed = stats.speed;
    if (stats.runSpeed !== undefined) {
      this.runSpeed = this.independentSpeeds ? stats.runSpeed : Math.max(stats.speed ?? this.speed, stats.runSpeed);
    }
    if (stats.crouchSpeed !== undefined) {
      this.crouchSpeed = this.independentSpeeds ? stats.crouchSpeed : Math.min(stats.speed ?? this.speed, stats.crouchSpeed);
    }
    if (stats.staminaMax !== undefined) {
      this.staminaMax = stats.staminaMax;
      this.stamina = stats.staminaMax;
    }
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
    if (stats.gravityTransitionDuration !== undefined) {
      this.gravityTransitionDuration = Math.max(0, Number(stats.gravityTransitionDuration) || 0);
    }
    if (stats.gravityOrientation !== undefined) {
      this.setGravityOrientation(stats.gravityOrientation, {
        duration: this.gravityTransitionDuration || 0.65
      });
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

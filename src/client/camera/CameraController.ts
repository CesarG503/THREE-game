import * as THREE from "three";
import type { CameraMode, CameraModeEventDetail, CameraPauseEventDetail } from "../types";

export class CameraController {
  camera: THREE.Camera;
  domElement: HTMLElement;
  mode: CameraMode;
  lastThirdPersonMode: CameraMode;
  currentCollisionDistance: number;
  _character: any;
  collidableCache: THREE.Object3D[];
  lastCacheTime: number;
  freeFlyPosition: THREE.Vector3;
  freeFlySpeed: number;
  isFirstPerson: boolean;
  thirdPersonDistance: number;
  thirdPersonHeight: number;
  alwaysRotateThirdPerson: boolean;
  minDistance: number;
  maxDistance: number;
  minCameraHeight: number;
  firstPersonHeight: number;
  firstPersonForwardOffset: number;
  theta: number;
  phi: number;
  minPhi: number;
  maxPhi: number;
  isRightMouseDown: boolean;
  rotationSpeed: number;
  smoothing: number;
  target: THREE.Vector3;
  currentPosition: THREE.Vector3;
  currentLookAt: THREE.Vector3;
  horizontalOffset: number;
  verticalOffset: number;
  enableDynamicOffset: boolean;
  fpYaw: number;
  fpPitch: number;
  maxPitch: number;
  manualPitchDelta: number;
  fpInvertAxisX: boolean;
  fpInvertAxisY: boolean;
  tpInvertAxisX: boolean;
  tpInvertAxisY: boolean;
  isPaused: boolean;
  isUIOpen: boolean;
  wasAlwaysRotate: boolean;
  lastCharacterPos: THREE.Vector3 | null;
  dynamicOffset: number;
  smoothedStrafe: number;
  gravityUp: THREE.Vector3;
  gravityQuaternion: THREE.Quaternion;
  yawConstraint: { centerYaw: number; maxHalfAngle: number } | null = null;
  private vehicleSurfaceRotation: THREE.Quaternion | null = null;
  private vehicleViewTilt = new THREE.Quaternion();
  private vehicleTiltAxis = new THREE.Vector3(0, 0, 1);
  private vehicleTiltSpeed = 0;
  private vehicleTiltSign = 1;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Camera modes
    this.mode = 'third-person-collision';
    this.lastThirdPersonMode = 'third-person-collision';
    this.isFirstPerson = false;
    this.currentCollisionDistance = 1.5;
    this._character = null;
    this.collidableCache = [];
    this.lastCacheTime = 0;
    this.freeFlyPosition = new THREE.Vector3();
    this.freeFlySpeed = 20.0;

    // Third person settings
    this.thirdPersonDistance = 1.5;
    this.thirdPersonHeight = 2;
    this.alwaysRotateThirdPerson = true;
    this.minDistance = 1.5;
    this.maxDistance = 20;
    this.minCameraHeight = 0.5;

    // First person settings
    this.firstPersonHeight = 1.5;
    this.firstPersonForwardOffset = 0.3;

    this.theta = 0;
    this.phi = Math.PI / 4;
    this.minPhi = -Math.PI / 3;
    this.maxPhi = Math.PI / 2.2;

    // Mouse control
    this.isRightMouseDown = false;
    this.rotationSpeed = 0.004;
    this.smoothing = 1.0;

    // Target position (character position)
    this.target = new THREE.Vector3();
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    this.horizontalOffset = 0.4;
    this.verticalOffset = 0;
    this.enableDynamicOffset = false;

    // First person look direction
    this.fpYaw = 0;
    this.fpPitch = 0;
    this.maxPitch = Math.PI / 2 - 0.35;

    // Track manual pitch changes to cancel recoil recovery
    this.manualPitchDelta = 0;

    // Axis settings
    this.fpInvertAxisX = false;
    this.fpInvertAxisY = false;
    this.tpInvertAxisX = false;
    this.tpInvertAxisY = false;

    this.isPaused = false;
    this.isUIOpen = false;
    this.gravityUp = new THREE.Vector3(0, 1, 0);
    this.gravityQuaternion = new THREE.Quaternion();

    this.setupEventListeners();
  }

  get character() {
    return this._character;
  }

  set character(value: any) {
    this._character = value;
    this.collidableCache = [];
    this.lastCacheTime = 0;
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.code === "Tab" && !this.isPaused && !this.isUIOpen) {
        e.preventDefault();
        this.toggleCameraMode();
      }
      if (e.code === "Escape") {
        e.preventDefault();
        this.togglePause();
      }
    });

    this.domElement.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button === 2 && !this.isPaused) {
        this.isRightMouseDown = true;
        if (!this.alwaysRotateThirdPerson && !this.isUIOpen) {
          this.safeRequestPointerLock();
        }
      }
    });

    this.domElement.addEventListener("mouseup", (e: MouseEvent) => {
      if (e.button === 2) {
        this.isRightMouseDown = false;
        if (!this.isFirstPerson && !this.alwaysRotateThirdPerson && !this.isUIOpen) {
          document.exitPointerLock();
        }
      }
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.isPaused) return;

      const isLocked = document.pointerLockElement === this.domElement;
      const canRotate = this.isFirstPerson || this.isRightMouseDown || (this.alwaysRotateThirdPerson && isLocked) || (this.mode === 'free-fly' && isLocked);

      if (canRotate) {
        if (this.isFirstPerson) {
          const oldPitch = this.fpPitch;
          this.fpYaw -= e.movementX * this.rotationSpeed * (this.fpInvertAxisX ? -1 : 1);
          this.fpPitch -= e.movementY * this.rotationSpeed * (this.fpInvertAxisY ? -1 : 1);
          this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch));
          this.manualPitchDelta += this.fpPitch - oldPitch;
          this.enforceYawConstraint();
        } else {
          const oldPhi = this.phi;
          this.theta -= e.movementX * this.rotationSpeed * (this.tpInvertAxisX ? -1 : 1);
          this.phi += e.movementY * this.rotationSpeed * (this.tpInvertAxisY ? -1 : 1);

          const minP = this.mode === 'free-fly' ? (-Math.PI / 2 + 0.01) : this.minPhi;
          const maxP = this.mode === 'free-fly' ? (Math.PI / 2 - 0.01) : this.maxPhi;
          this.phi = Math.max(minP, Math.min(maxP, this.phi));

          this.manualPitchDelta -= this.phi - oldPhi;
          this.enforceYawConstraint();
        }
      }
    });

    this.domElement.addEventListener("wheel", (e: WheelEvent) => {
      if (!this.isFirstPerson && !this.isPaused && e.shiftKey) {
        e.preventDefault();

        let delta = Math.abs(e.deltaY) > 0 ? e.deltaY : e.deltaX;

        if (e.deltaMode === 1) {
          delta *= 40;
        }

        const normalizedDelta = Math.sign(delta) * Math.max(Math.abs(delta), 32);
        this.thirdPersonDistance += normalizedDelta * 0.0125;
        this.thirdPersonDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.thirdPersonDistance));
      }
    }, { passive: false });

    this.domElement.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
    });

    this.domElement.addEventListener("click", () => {
      if (!this.isPaused && !this.isUIOpen) {
        this.lock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      const isLocked = document.pointerLockElement === this.domElement;
      void isLocked;
    });
  }

  safeRequestPointerLock() {
    if (!this.domElement || typeof this.domElement.requestPointerLock !== "function") return;
    try {
      const promise = this.domElement.requestPointerLock();
      if (promise && typeof promise.catch === "function") {
        promise.catch((err) => {
          if (err.name !== "NotAllowedError" && err.name !== "SecurityError") {
            console.warn("[CameraController] requestPointerLock promise rejected:", err);
          }
        });
      }
    } catch (err) {
      console.warn("[CameraController] requestPointerLock threw error:", err);
    }
  }

  lock() {
    if (this.isUIOpen) return;
    if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
      this.safeRequestPointerLock();
    }
  }

  unlock() {
    document.exitPointerLock();
  }

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      document.exitPointerLock();
    } else if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
      this.safeRequestPointerLock();
    }

    const detail: CameraPauseEventDetail = {
      isPaused: this.isPaused,
      isFirstPerson: this.isFirstPerson,
      fpInvertAxisX: this.fpInvertAxisX,
      fpInvertAxisY: this.fpInvertAxisY,
      tpInvertAxisX: this.tpInvertAxisX,
      tpInvertAxisY: this.tpInvertAxisY
    };

    const event = new CustomEvent("gamePauseChanged", {
      detail
    });
    document.dispatchEvent(event);
  }

  setFpInvertAxisX(value: boolean) {
    this.fpInvertAxisX = value;
  }

  setFpInvertAxisY(value: boolean) {
    this.fpInvertAxisY = value;
  }

  setTpInvertAxisX(value: boolean) {
    this.tpInvertAxisX = value;
  }

  setTpInvertAxisY(value: boolean) {
    this.tpInvertAxisY = value;
  }

  setAlwaysRotateThirdPerson(value: boolean) {
    this.alwaysRotateThirdPerson = value;
    if (!value && !this.isFirstPerson && document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  setHorizontalOffset(value: number) {
    this.horizontalOffset = value;
  }

  setUIOpen(isOpen: boolean) {
    if (this.isUIOpen === isOpen) return;
    this.isUIOpen = isOpen;

    if (isOpen) {
      this.wasAlwaysRotate = this.alwaysRotateThirdPerson;
      if (this.wasAlwaysRotate) {
        this.setAlwaysRotateThirdPerson(false);
      }
    } else {
      if (this.wasAlwaysRotate) {
        this.setAlwaysRotateThirdPerson(true);
        if (!this.isPaused) {
          this.safeRequestPointerLock();
        }
      }
    }
  }

  setSmoothing(value: number) {
    this.smoothing = value;
  }

  resume() {
    this.isPaused = false;
    if (this.isFirstPerson || this.alwaysRotateThirdPerson || this.mode === 'free-fly') {
      this.safeRequestPointerLock();
    }
  }

  setCameraMode(mode: CameraMode, requestLock: boolean = true) {
    this.mode = mode;
    this.isFirstPerson = (mode === 'first-person');
    if (mode !== 'first-person') {
      this.lastThirdPersonMode = mode;
    }

    if (mode === 'free-fly') {
      this.freeFlyPosition.copy(this.camera.position);
      if (requestLock && !this.isPaused && !this.isUIOpen) {
        this.safeRequestPointerLock();
      }
    } else if (this.isFirstPerson) {
      if (requestLock && !this.isPaused && !this.isUIOpen) {
        this.safeRequestPointerLock();
      }
      this.fpYaw = this.theta;
      this.fpPitch = -this.phi;
      this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch));
    } else {
      if (!this.alwaysRotateThirdPerson && requestLock) {
        document.exitPointerLock();
      }
      this.theta = this.fpYaw;
      this.phi = -this.fpPitch;
      this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    }

    const detail: CameraModeEventDetail = {
      isFirstPerson: this.isFirstPerson,
      cameraMode: this.mode
    };

    const event = new CustomEvent("cameraModeChanged", {
      detail
    });
    document.dispatchEvent(event);
  }

  toggleCameraMode() {
    if (this.isFirstPerson) {
      this.setCameraMode(this.lastThirdPersonMode);
    } else {
      this.setCameraMode('first-person');
    }
  }

  setYawConstraint(centerYaw: number | null, maxHalfAngle: number = (85 * Math.PI) / 180) {
    if (centerYaw === null || !Number.isFinite(centerYaw)) {
      this.yawConstraint = null;
    } else {
      this.yawConstraint = { centerYaw, maxHalfAngle };
      this.enforceYawConstraint();
    }
  }

  rotateYaw(deltaYaw: number) {
    if (!Number.isFinite(deltaYaw) || Math.abs(deltaYaw) < 0.00001) return;
    this.theta += deltaYaw;
    this.fpYaw += deltaYaw;
    if (this.yawConstraint) {
      this.yawConstraint.centerYaw += deltaYaw;
      this.enforceYawConstraint();
    }
  }

  enforceYawConstraint() {
    if (!this.yawConstraint) return;
    const { centerYaw, maxHalfAngle } = this.yawConstraint;
    const currentAim = this.isFirstPerson ? this.fpYaw : this.theta;
    const targetBodyRot = currentAim + Math.PI;
    let diff = Math.atan2(Math.sin(targetBodyRot - centerYaw), Math.cos(targetBodyRot - centerYaw));
    if (Math.abs(diff) > maxHalfAngle) {
      diff = Math.sign(diff) * maxHalfAngle;
      const clampedAim = centerYaw + diff - Math.PI;
      if (this.isFirstPerson) {
        this.fpYaw = clampedAim;
      } else {
        this.theta = clampedAim;
      }
    }
  }

  setGravityUpVector(up: THREE.Vector3) {
    if (!up || up.lengthSq() < 0.0001) return;
    this.gravityUp.copy(up).normalize();
    this.camera.up.copy(this.gravityUp);

    // Reconstruct gravityQuaternion from up for backwards compatibility
    let forward = new THREE.Vector3(0, 0, 1).projectOnPlane(this.gravityUp);
    if (forward.lengthSq() < 0.0001) {
      forward = new THREE.Vector3(1, 0, 0).projectOnPlane(this.gravityUp);
    }
    forward.normalize();
    const right = forward.clone().cross(this.gravityUp).normalize();
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right.clone().multiplyScalar(-1), this.gravityUp, forward);
    this.gravityQuaternion.setFromRotationMatrix(matrix);
  }

  setGravityQuaternion(q: THREE.Quaternion) {
    this.gravityQuaternion.copy(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    this.gravityUp.copy(up);
    this.camera.up.copy(up);
  }

  /** Visual follow only. Riding a ceiling must not change world gravity, mouse
   * settings, or the existing camera behavior on floors and side walls. */
  setVehicleSurfaceRotation(rotation: THREE.Quaternion | null, surfaceSupported = false) {
    this.vehicleSurfaceRotation = surfaceSupported && rotation ? rotation.clone() : null;
  }

  private updateVehicleView(dt: number) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const desired = new THREE.Quaternion();
    if (this.vehicleSurfaceRotation) {
      const riderUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.vehicleSurfaceRotation);
      const alignment = THREE.MathUtils.clamp(this.gravityUp.dot(riderUp), -1, 1);
      const weight = THREE.MathUtils.smoothstep(-alignment, 0.05, 0.65);
      if (weight > 0) {
        const axis = this.gravityUp.clone().cross(riderUp);
        // Retain the approach direction at exactly 180°, where the cross
        // product vanishes; this avoids an arbitrary flip at the ceiling.
        if (axis.lengthSq() > 0.0001) {
          axis.normalize();
          this.vehicleTiltSign = axis.dot(this.vehicleTiltAxis) < 0 ? -1 : 1;
          // Near inversion the up-vector cross product is ill-conditioned:
          // tiny normal changes must not spin the camera's whole reference.
          if (alignment > -0.98) this.vehicleTiltAxis.lerp(axis.multiplyScalar(this.vehicleTiltSign), 1 - Math.exp(-8 * step)).normalize();
        } else if (Math.abs(this.vehicleTiltAxis.dot(this.gravityUp)) > 0.99) {
          this.vehicleTiltAxis.set(0, 0, -1).applyQuaternion(this.vehicleSurfaceRotation).normalize();
        }
        desired.setFromAxisAngle(this.vehicleTiltAxis, this.vehicleTiltSign * Math.acos(alignment) * weight);
      }
    }
    // Ease angular speed as well as orientation. This bounds both a sudden
    // contact change and the return to the horizon after leaving a ceiling.
    const angle = this.vehicleViewTilt.angleTo(desired);
    const targetSpeed = Math.min(4, angle * 7);
    this.vehicleTiltSpeed += THREE.MathUtils.clamp(targetSpeed - this.vehicleTiltSpeed, -16 * step, 16 * step);
    this.vehicleViewTilt.rotateTowards(desired, Math.min(angle, this.vehicleTiltSpeed * step));
    if (this.vehicleViewTilt.angleTo(new THREE.Quaternion()) < 0.00001) this.vehicleViewTilt.identity();
    this.camera.up.copy(this.gravityUp).applyQuaternion(this.vehicleViewTilt);
  }

  getGravityBasis(yaw: number) {
    const viewFrame = this.gravityQuaternion.clone().premultiply(this.vehicleViewTilt);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(viewFrame).normalize();
    const baseForward = new THREE.Vector3(0, 0, 1).applyQuaternion(viewFrame).normalize();
    const baseRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(viewFrame).normalize();

    const forward = baseForward.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(baseRight, -Math.sin(yaw)).normalize();
    const right = baseRight.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(baseForward, Math.sin(yaw)).normalize();

    return { up, forward, right };
  }

  isCollisionExcluded(object: THREE.Object3D): boolean {
    if (this.character) {
      // Helper to traverse and check matching root model
      const isCharPart = (model: THREE.Object3D | null) => {
        if (!model) return false;
        let isPart = false;
        object.traverseAncestors((ancestor) => {
          if (ancestor === model) isPart = true;
        });
        return isPart || object === model;
      };

      if (
        isCharPart(this.character.glbModel?.model) ||
        isCharPart(this.character.polygonModel?.model) ||
        isCharPart(this.character.polygonModelSkin?.model)
      ) {
        return true;
      }
    }

    let parent: THREE.Object3D | null = object;
    while (parent) {
      if (parent.name && (
        parent.name.toLowerCase().includes("player") ||
        parent.name.toLowerCase().includes("character") ||
        parent.name.toLowerCase().includes("remote") ||
        parent.name.toLowerCase().includes("npc") ||
        parent.name.toLowerCase().includes("gizmo") ||
        parent.name.toLowerCase().includes("helper") ||
        parent.name.toLowerCase().includes("ghost") ||
        parent.name.toLowerCase().includes("aerial") ||
        parent.name.toLowerCase().includes("sky") ||
        parent.name.toLowerCase().includes("water") ||
        parent.name.toLowerCase().includes("cloud")
      )) {
        return true;
      }

      if (parent.userData) {
        if (parent.userData.isSensor || parent.userData.isTrigger || parent.userData.isPlayer || parent.userData.ignoreRaycast) {
          return true;
        }

        const type = parent.userData.mapObjectType;
        if (type && [
          "spawn_point",
          "interaction_button",
          "gravity_sphere",
          "impulse_jump",
          "impulse_lateral",
          "gravity_pad",
          "farming_zone",
          "target",
          "logic_camera",
          "camera_panel",
          "logic_node",
          "marker",
          "waypoint",
          "projectile"
        ].includes(type)) {
          return true;
        }
      }
      parent = parent.parent;
    }
    return false;
  }

  update(
    characterPosition: THREE.Vector3 | null,
    characterRotation: number,
    dt: number,
    gravityUpOrQuaternion?: THREE.Vector3 | THREE.Quaternion | null,
    scene?: THREE.Scene,
    input?: any
  ) {
    if (!characterPosition) return;
    void characterRotation;

    if (gravityUpOrQuaternion) {
      if (gravityUpOrQuaternion instanceof THREE.Quaternion) {
        this.setGravityQuaternion(gravityUpOrQuaternion);
      } else {
        this.setGravityUpVector(gravityUpOrQuaternion);
      }
    } else {
      this.camera.up.copy(this.gravityUp);
    }

    if (this.mode !== 'free-fly') this.updateVehicleView(dt);

    this.target.copy(characterPosition);
    this.enforceYawConstraint();

    if (this.mode === 'free-fly') {
      this.updateFreeFly(dt, input);
    } else if (this.isFirstPerson) {
      this.updateFirstPerson(characterPosition);
    } else {
      this.updateThirdPerson(characterPosition, dt, scene);
    }
  }

  updateFreeFly(dt: number, input?: any) {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.phi);
    const rotation = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);
    this.camera.quaternion.copy(rotation);

    if (input && input.keys) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();

      const speed = this.freeFlySpeed || 20.0;

      if (input.keys.forward) {
        this.freeFlyPosition.addScaledVector(forward, speed * dt);
      }
      if (input.keys.backward) {
        this.freeFlyPosition.addScaledVector(forward, -speed * dt);
      }
      if (input.keys.right) {
        this.freeFlyPosition.addScaledVector(right, speed * dt);
      }
      if (input.keys.left) {
        this.freeFlyPosition.addScaledVector(right, -speed * dt);
      }
      if (input.keys.jump) {
        this.freeFlyPosition.addScaledVector(up, speed * dt);
      }
      if (input.keys.crouch) {
        this.freeFlyPosition.addScaledVector(up, -speed * dt);
      }
    }

    this.camera.position.copy(this.freeFlyPosition);
    this.currentPosition.copy(this.freeFlyPosition);
  }

  updateFirstPerson(characterPosition: THREE.Vector3) {
    const { up, forward } = this.getGravityBasis(this.fpYaw);
    const headPosition = characterPosition.clone().addScaledVector(up, this.firstPersonHeight);

    this.camera.position.copy(headPosition);

    this.camera.position.addScaledVector(forward, this.firstPersonForwardOffset);

    const lookDirection = forward.clone().multiplyScalar(Math.cos(this.fpPitch)).addScaledVector(up, Math.sin(this.fpPitch));

    const lookAt = headPosition.clone().add(lookDirection);
    this.camera.lookAt(lookAt);
  }

  updateThirdPerson(characterPosition: THREE.Vector3, dt: number, scene?: THREE.Scene) {
    if (!this.lastCharacterPos) {
      this.lastCharacterPos = characterPosition.clone();
      this.dynamicOffset = 0;
      this.smoothedStrafe = 0;
    }

    const deltaPos = characterPosition.clone().sub(this.lastCharacterPos);
    this.lastCharacterPos.copy(characterPosition);

    const { up, forward, right } = this.getGravityBasis(this.theta);
    const rightVector = right;
    const rawStrafeVelocity = deltaPos.dot(rightVector) / (dt || 0.016);

    this.smoothedStrafe += (rawStrafeVelocity - this.smoothedStrafe) * 15.0 * dt;

    let offsetTarget = 0;
    if (this.enableDynamicOffset) {
      if (this.smoothedStrafe > 0.3) {
        offsetTarget = Math.min(0.5, (this.smoothedStrafe - 0.3) * 0.1);
      } else if (this.smoothedStrafe < -0.3) {
        offsetTarget = Math.max(-0.2, (this.smoothedStrafe + 0.3) * 0.1);
      }
    }

    this.dynamicOffset += (offsetTarget - this.dynamicOffset) * 6.0 * dt;

    const targetCameraPos = new THREE.Vector3();

    const zoomFactor = Math.max(0, Math.min(1, (this.thirdPersonDistance - 1.5) / (8.0 - 1.5)));

    const closeHeight = 1.6;
    const closeOffset = 0.7;
    const closeLookAtHeight = 1.6;

    const farHeight = this.thirdPersonHeight;
    const farOffset = this.horizontalOffset;
    const farLookAtHeight = 1.2;

    const currentHeight = closeHeight + (farHeight - closeHeight) * zoomFactor;
    const currentOffset = closeOffset + (farOffset - closeOffset) * zoomFactor + this.dynamicOffset * (1 - zoomFactor);
    const currentLookAtY = closeLookAtHeight + (farLookAtHeight - closeLookAtHeight) * zoomFactor;

    const horizontalDist = this.thirdPersonDistance * Math.cos(this.phi);
    const verticalDist = this.thirdPersonDistance * Math.sin(this.phi);
    const lateralOffset = right.clone().multiplyScalar(currentOffset);

    targetCameraPos
      .copy(characterPosition)
      .addScaledVector(forward, -horizontalDist)
      .addScaledVector(up, currentHeight + verticalDist)
      .add(lateralOffset);

    if (this.mode !== 'third-person-free') {
      if (up.y > 0.99) {
        targetCameraPos.y = Math.max(targetCameraPos.y, this.minCameraHeight);
      }
    }

    const targetLookAt = characterPosition.clone().addScaledVector(up, currentLookAtY).add(lateralOffset);

    // Calculate camera arm direction and ideal distance from targetLookAt
    const arm = new THREE.Vector3().subVectors(targetCameraPos, targetLookAt);
    const idealDist = arm.length();
    const armDir = arm.clone().normalize();

    let desiredDistance = idealDist;

    if (this.mode === 'third-person-collision' && scene) {
      const now = performance.now();
      if (!this.collidableCache || now - this.lastCacheTime > 500) {
        this.collidableCache = [];
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && !this.isCollisionExcluded(child)) {
            this.collidableCache.push(child);
          }
        });
        this.lastCacheTime = now;
      }

      if (this.collidableCache.length > 0) {
        // Raycast from targetLookAt in the direction of the arm, testing against pre-filtered flat cache (non-recursive)
        const raycaster = new THREE.Raycaster(targetLookAt, armDir, 0.05, idealDist);
        const intersects = raycaster.intersectObjects(this.collidableCache, false);

        if (intersects.length > 0) {
          const hit = intersects[0];
          desiredDistance = Math.max(0.1, hit.distance - 0.25);
        }
      }
    }

    // Dynamic smoothing based on dt
    const safeDt = Math.max(0.001, Math.min(0.1, dt || 0.016));
    if (this.currentCollisionDistance === undefined || isNaN(this.currentCollisionDistance)) {
      this.currentCollisionDistance = desiredDistance;
    }

    if (desiredDistance < this.currentCollisionDistance) {
      // Zooming in (collision): extremely fast response to prevent clipping and losing player from view
      this.currentCollisionDistance += (desiredDistance - this.currentCollisionDistance) * (1 - Math.exp(-50 * safeDt));
    } else {
      // Zooming out (recovery): smooth & controlled transition
      this.currentCollisionDistance += (desiredDistance - this.currentCollisionDistance) * (1 - Math.exp(-8 * safeDt));
    }

    // Set position based on interpolated collision distance
    this.currentPosition.copy(targetLookAt).addScaledVector(armDir, this.currentCollisionDistance);

    if (this.mode !== 'third-person-free') {
      if (up.y > 0.99) {
        this.currentPosition.y = Math.max(this.currentPosition.y, this.minCameraHeight);
      }
    }

    this.camera.position.copy(this.currentPosition);

    this.currentLookAt.lerp(targetLookAt, this.smoothing);
    this.camera.lookAt(this.currentLookAt);
  }

  getForwardDirection() {
    return this.getGravityBasis(this.isFirstPerson ? this.fpYaw : this.theta).forward;
  }

  consumeManualPitchDelta() {
    const delta = this.manualPitchDelta;
    this.manualPitchDelta = 0;
    return delta;
  }

  getRightDirection() {
    return this.getGravityBasis(this.isFirstPerson ? this.fpYaw : this.theta).right;
  }
}

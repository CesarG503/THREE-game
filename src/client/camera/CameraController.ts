import * as THREE from "three";
import type { CameraModeEventDetail, CameraPauseEventDetail } from "../types";

export class CameraController {
  camera: THREE.Camera;
  domElement: HTMLElement;
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

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Camera modes
    this.isFirstPerson = false;

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

    this.setupEventListeners();
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
          this.domElement.requestPointerLock();
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
      const canRotate = this.isFirstPerson || this.isRightMouseDown || (this.alwaysRotateThirdPerson && isLocked);

      if (canRotate) {
        if (this.isFirstPerson) {
          const oldPitch = this.fpPitch;
          this.fpYaw -= e.movementX * this.rotationSpeed * (this.fpInvertAxisX ? -1 : 1);
          this.fpPitch -= e.movementY * this.rotationSpeed * (this.fpInvertAxisY ? -1 : 1);
          this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch));
          this.manualPitchDelta += this.fpPitch - oldPitch;
        } else {
          const oldPhi = this.phi;
          this.theta -= e.movementX * this.rotationSpeed * (this.tpInvertAxisX ? -1 : 1);
          this.phi += e.movementY * this.rotationSpeed * (this.tpInvertAxisY ? -1 : 1);
          this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
          this.manualPitchDelta -= this.phi - oldPhi;
        }
      }
    });

    this.domElement.addEventListener("wheel", (e: WheelEvent) => {
      if (!this.isFirstPerson && !this.isPaused && e.shiftKey) {
        let delta = e.deltaY;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          delta = e.deltaX;
        }

        if (e.deltaMode === 1) {
          delta *= 40;
        }

        this.thirdPersonDistance += delta * 0.01;
        this.thirdPersonDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.thirdPersonDistance));
      }
    });

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

  lock() {
    if (this.isUIOpen) return;
    if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
      this.domElement.requestPointerLock();
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
      this.domElement.requestPointerLock();
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
          this.domElement.requestPointerLock();
        }
      }
    }
  }

  setSmoothing(value: number) {
    this.smoothing = value;
  }

  resume() {
    this.isPaused = false;
    if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
      this.domElement.requestPointerLock();
    }
  }

  toggleCameraMode() {
    this.isFirstPerson = !this.isFirstPerson;

    if (this.isFirstPerson) {
      this.domElement.requestPointerLock();
      this.fpYaw = this.theta;
      this.fpPitch = -this.phi;
      this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch));
    } else {
      if (!this.alwaysRotateThirdPerson) {
        document.exitPointerLock();
      }
      this.theta = this.fpYaw;
      this.phi = -this.fpPitch;
      this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    }

    const detail: CameraModeEventDetail = { isFirstPerson: this.isFirstPerson };

    const event = new CustomEvent("cameraModeChanged", {
      detail
    });
    document.dispatchEvent(event);
  }

  update(characterPosition: THREE.Vector3 | null, characterRotation: number, dt: number) {
    if (!characterPosition) return;
    void characterRotation;

    this.target.copy(characterPosition);

    if (this.isFirstPerson) {
      this.updateFirstPerson(characterPosition);
    } else {
      this.updateThirdPerson(characterPosition, dt);
    }
  }

  updateFirstPerson(characterPosition: THREE.Vector3) {
    const headPosition = characterPosition.clone();
    headPosition.y += this.firstPersonHeight;

    this.camera.position.copy(headPosition);

    const forwardOffset = new THREE.Vector3(Math.sin(this.fpYaw), 0, Math.cos(this.fpYaw)).multiplyScalar(
      this.firstPersonForwardOffset
    );
    this.camera.position.add(forwardOffset);

    const lookDirection = new THREE.Vector3();
    lookDirection.x = Math.sin(this.fpYaw) * Math.cos(this.fpPitch);
    lookDirection.y = Math.sin(this.fpPitch);
    lookDirection.z = Math.cos(this.fpYaw) * Math.cos(this.fpPitch);

    const lookAt = headPosition.clone().add(lookDirection);
    this.camera.lookAt(lookAt);
  }

  updateThirdPerson(characterPosition: THREE.Vector3, dt: number) {
    if (!this.lastCharacterPos) {
      this.lastCharacterPos = characterPosition.clone();
      this.dynamicOffset = 0;
      this.smoothedStrafe = 0;
    }

    const deltaPos = characterPosition.clone().sub(this.lastCharacterPos);
    this.lastCharacterPos.copy(characterPosition);

    const rightVector = new THREE.Vector3(-Math.cos(this.theta), 0, Math.sin(this.theta)).normalize();
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

    targetCameraPos.x = characterPosition.x - horizontalDist * Math.sin(this.theta);
    targetCameraPos.y = characterPosition.y + currentHeight + verticalDist;
    targetCameraPos.z = characterPosition.z - horizontalDist * Math.cos(this.theta);

    const offsetX = -Math.cos(this.theta) * currentOffset;
    const offsetZ = Math.sin(this.theta) * currentOffset;

    targetCameraPos.x += offsetX;
    targetCameraPos.z += offsetZ;

    targetCameraPos.y = Math.max(targetCameraPos.y, this.minCameraHeight);

    this.currentPosition.lerp(targetCameraPos, this.smoothing);
    this.currentPosition.y = Math.max(this.currentPosition.y, this.minCameraHeight);

    this.camera.position.copy(this.currentPosition);

    const targetLookAt = characterPosition.clone();
    targetLookAt.y += currentLookAtY;

    targetLookAt.x += offsetX;
    targetLookAt.z += offsetZ;

    this.currentLookAt.lerp(targetLookAt, this.smoothing);
    this.camera.lookAt(this.currentLookAt);
  }

  getForwardDirection() {
    if (this.isFirstPerson) {
      return new THREE.Vector3(Math.sin(this.fpYaw), 0, Math.cos(this.fpYaw)).normalize();
    }
    return new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta)).normalize();
  }

  consumeManualPitchDelta() {
    const delta = this.manualPitchDelta;
    this.manualPitchDelta = 0;
    return delta;
  }

  getRightDirection() {
    if (this.isFirstPerson) {
      return new THREE.Vector3(-Math.cos(this.fpYaw), 0, Math.sin(this.fpYaw)).normalize();
    }
    return new THREE.Vector3(-Math.cos(this.theta), 0, Math.sin(this.theta)).normalize();
  }
}

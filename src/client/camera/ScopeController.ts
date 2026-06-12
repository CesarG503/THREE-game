import type * as THREE from "three";
import { ScopeSettings } from "./scope/ScopeSettings";
import { ScopeUI } from "./scope/ScopeUI";
import { ScopeAnimation } from "./scope/ScopeAnimation";
import { ScopeEffects } from "./scope/ScopeEffects";
import { ScopeInput } from "./scope/ScopeInput";

export class ScopeController {
  camera: THREE.Camera;
  game: any;
  isAiming: boolean;
  currentWeapon: any;
  currentScopeIndex: number;
  allowedScopes: number[];
  ui: ScopeUI;
  animation: ScopeAnimation;
  effects: ScopeEffects;
  input: ScopeInput;
  forcedFirstPersonForScope: boolean;
  scopeEntryWasFirstPerson: boolean;

  constructor(camera: THREE.Camera, game: any) {
    this.camera = camera;
    this.game = game;
    this.isAiming = false;
    this.currentWeapon = null;
    this.currentScopeIndex = -1;
    this.allowedScopes = [];
    this.ui = new ScopeUI();
    this.animation = new ScopeAnimation(this.camera, this.ui);
    this.effects = new ScopeEffects(this.ui);
    this.input = new ScopeInput(this);
    this.forcedFirstPersonForScope = false;
    this.scopeEntryWasFirstPerson = false;
  }

  canHandleInput() {
    return this.isAiming && this.currentWeapon && this.currentWeapon.maxScope > 1;
  }

  zoomIn() {
    if (this.allowedScopes.length === 0) return;
    this.currentScopeIndex = Math.min(this.currentScopeIndex + 1, this.allowedScopes.length - 1);
    this.applyZoomChange();
  }

  zoomOut() {
    if (this.allowedScopes.length === 0) return;
    this.currentScopeIndex = Math.max(this.currentScopeIndex - 1, 0);
    this.applyZoomChange();
  }

  private getTargetFov(zoomValue: number) {
    return zoomValue === 1 ? ScopeSettings.defaultFov / 1.2 : ScopeSettings.defaultFov / zoomValue;
  }

  private applyZoomChange() {
    const selectedZoom = this.allowedScopes[this.currentScopeIndex] ?? 1;
    this.ui.setZoomText(selectedZoom);
    this.animation.animateZoomChange(this.getTargetFov(selectedZoom));
    this.ui.setOverlayVisible(selectedZoom > 1);
  }

  private beginScopedCameraMode() {
    const cameraController = this.game?.cameraController;
    if (!cameraController) return;

    this.scopeEntryWasFirstPerson = !!cameraController.isFirstPerson;
    this.ensureScopedCameraMode();
    this.forcedFirstPersonForScope = !this.scopeEntryWasFirstPerson;
  }

  private ensureScopedCameraMode() {
    const cameraController = this.game?.cameraController;
    if (!cameraController || cameraController.isFirstPerson) return;

    cameraController.toggleCameraMode();
  }

  private restorePreviousCameraMode() {
    if (!this.forcedFirstPersonForScope) return;

    const cameraController = this.game?.cameraController;
    if (cameraController?.isFirstPerson) {
      cameraController.toggleCameraMode();
    }

    this.forcedFirstPersonForScope = false;
    this.scopeEntryWasFirstPerson = false;
  }

  onShoot() {
    if (!this.isAiming) return;
    const selectedZoom = this.allowedScopes[this.currentScopeIndex] ?? 1;
    if (selectedZoom > 1) {
      this.animation.animateRecoil();
    }
  }

  update(dt: number, isAimingCommand: boolean, currentWeapon: any) {
    this.currentWeapon = currentWeapon;
    const maxScope = Number(currentWeapon?.maxScope ?? 1);
    const canAim = currentWeapon && currentWeapon.type === "weapon" && maxScope > 1;

    if (isAimingCommand && canAim) {
      if (!this.isAiming) {
        this.beginScopedCameraMode();
        this.isAiming = true;
        this.allowedScopes = ScopeSettings.availableScopes.filter((scope) => scope <= maxScope);
        if (this.allowedScopes.length === 0) this.allowedScopes = [1];
        if (this.currentScopeIndex === -1 || this.currentScopeIndex >= this.allowedScopes.length) {
          this.currentScopeIndex = this.allowedScopes.length - 1;
        }
        const zoomValue = this.allowedScopes[this.currentScopeIndex] ?? 1;
        this.ui.setZoomText(zoomValue);
        this.animation.animateEnter(this.getTargetFov(zoomValue), zoomValue);
        this.effects.startAmbientEffects();
      } else {
        this.ensureScopedCameraMode();
      }
    } else {
      if (this.isAiming) {
        this.isAiming = false;
        this.animation.animateExit();
        this.effects.stopAmbientEffects();
        this.restorePreviousCameraMode();
      }

      if (isAimingCommand && currentWeapon && currentWeapon.type === "weapon" && maxScope <= 1) {
        const camera = this.camera as THREE.PerspectiveCamera;
        camera.fov += (ScopeSettings.defaultFov / 1.2 - camera.fov) * 15.0 * dt;
        camera.updateProjectionMatrix();
      } else if (!isAimingCommand) {
        const camera = this.camera as THREE.PerspectiveCamera;
        if (Math.abs(camera.fov - ScopeSettings.defaultFov) > 0.1) {
          camera.fov += (ScopeSettings.defaultFov - camera.fov) * 15.0 * dt;
          camera.updateProjectionMatrix();
        }
      }
    }

    if (this.isAiming && this.ui.reticle) {
      const sway = this.effects.getProceduralSway(dt, this.isAiming);
      this.ui.reticle.style.transform = `translate(${sway.x * 50}px, ${sway.y * 50}px)`;
    }
  }

  destroy() {
    this.restorePreviousCameraMode();
    this.ui.destroy();
    this.animation.destroy();
    this.effects.destroy();
    this.input.destroy();
  }
}

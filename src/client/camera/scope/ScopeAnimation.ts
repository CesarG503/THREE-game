import type * as THREE from "three";
import { ScopeSettings } from "./ScopeSettings";
import type { ScopeUI } from "./ScopeUI";

type TweenState = {
  frame: number;
  startedAt: number;
  duration: number;
  from: number;
  to: number;
  apply: (value: number) => void;
};

export class ScopeAnimation {
  camera: THREE.PerspectiveCamera;
  ui: ScopeUI;
  fovTween: TweenState | null;
  overlayFrame: number | null;

  constructor(camera: THREE.Camera, ui: ScopeUI) {
    this.camera = camera as THREE.PerspectiveCamera;
    this.ui = ui;
    this.fovTween = null;
    this.overlayFrame = null;
  }

  private easeOut(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  private tween(from: number, to: number, duration: number, apply: (value: number) => void) {
    if (this.fovTween) cancelAnimationFrame(this.fovTween.frame);
    const state: TweenState = {
      frame: 0,
      startedAt: performance.now(),
      duration: Math.max(duration, 0.01) * 1000,
      from,
      to,
      apply
    };

    const tick = (now: number) => {
      const progress = Math.min((now - state.startedAt) / state.duration, 1);
      const eased = this.easeOut(progress);
      state.apply(state.from + (state.to - state.from) * eased);
      if (progress < 1) {
        state.frame = requestAnimationFrame(tick);
      }
    };

    state.frame = requestAnimationFrame(tick);
    this.fovTween = state;
  }

  animateEnter(targetFov: number, zoomValue = 2) {
    this.tween(this.camera.fov, targetFov, ScopeSettings.animationDuration, (fov) => {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    });
    this.ui.setOverlayVisible(zoomValue > 1);
  }

  animateExit() {
    this.tween(this.camera.fov, ScopeSettings.defaultFov, ScopeSettings.animationDuration, (fov) => {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    });
    this.ui.setOverlayVisible(false);
  }

  animateZoomChange(newFov: number) {
    this.tween(this.camera.fov, newFov, 0.15, (fov) => {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    });

    if (this.ui.reticle) {
      this.ui.reticle.style.transform = "scale(1.05)";
      window.setTimeout(() => {
        if (this.ui.reticle) this.ui.reticle.style.transform = "scale(1)";
      }, 160);
    }
  }

  animateRecoil() {
    const overlay = this.ui.overlay;
    if (!overlay) return;
    if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);

    const startedAt = performance.now();
    const intensity = ScopeSettings.recoilIntensity;
    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / 220, 1);
      const lift = (1 - t) * intensity;
      overlay.style.translate = `0 ${-lift}px`;
      overlay.style.scale = String(1 + (1 - t) * 0.02);
      if (t < 1) {
        this.overlayFrame = requestAnimationFrame(tick);
      } else {
        overlay.style.translate = "0 0";
        overlay.style.scale = "1";
        this.overlayFrame = null;
      }
    };
    this.overlayFrame = requestAnimationFrame(tick);
  }

  destroy() {
    if (this.fovTween) cancelAnimationFrame(this.fovTween.frame);
    if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
  }
}

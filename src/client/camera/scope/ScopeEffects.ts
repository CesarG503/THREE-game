import { ScopeSettings } from "./ScopeSettings";
import type { ScopeUI } from "./ScopeUI";

export class ScopeEffects {
  ui: ScopeUI;
  swayTime: number;
  private breathFrame: number | null;
  private active: boolean;

  constructor(ui: ScopeUI) {
    this.ui = ui;
    this.swayTime = 0;
    this.breathFrame = null;
    this.active = false;
  }

  startAmbientEffects() {
    this.stopAmbientEffects();
    this.active = true;
    const startedAt = performance.now();

    const tick = (now: number) => {
      if (!this.active) return;
      const t = (now - startedAt) / 1000;
      const scale = 1 + Math.sin(t * Math.PI * 0.5) * 0.02;
      if (this.ui.reticle) this.ui.reticle.style.scale = String(scale);
      if (this.ui.textElement) this.ui.textElement.style.opacity = String(0.85 + Math.sin(t * Math.PI) * 0.15);
      this.breathFrame = requestAnimationFrame(tick);
    };
    this.breathFrame = requestAnimationFrame(tick);
  }

  stopAmbientEffects() {
    this.active = false;
    if (this.breathFrame) cancelAnimationFrame(this.breathFrame);
    this.breathFrame = null;
    if (this.ui.reticle) {
      this.ui.reticle.style.scale = "1";
      this.ui.reticle.style.transform = "";
    }
    if (this.ui.textElement) this.ui.textElement.style.opacity = "1";
  }

  getProceduralSway(dt: number, isAiming: boolean) {
    if (!isAiming || !ScopeSettings.enableBreathing) return { x: 0, y: 0 };
    this.swayTime += dt;
    const intensity = ScopeSettings.swayIntensity * 0.0005;
    return {
      x: Math.sin(this.swayTime * 1.5) * intensity,
      y: Math.sin(this.swayTime * 3.0) * intensity * 0.5
    };
  }

  destroy() {
    this.stopAmbientEffects();
  }
}

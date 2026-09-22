import * as THREE from 'three';

interface SpeedStreak {
  angle: number;
  innerRatio: number;
  length: number;
  thickness: number;
  baseAlpha: number;
  isAccent: boolean;
  life: number;
  maxLife: number;
}

export class SpeedLinesEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private streaks: SpeedStreak[] = [];
  private currentIntensity = 0;
  private baseFov: number | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private resizeHandler: () => void;

  constructor(private game: any) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'vehicle-speed-lines-overlay';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 65;
      display: none;
      opacity: 0;
      mix-blend-mode: screen;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.handleResize();
  }

  private handleResize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
  }

  private initStreaks(count: number) {
    while (this.streaks.length < count) {
      this.streaks.push(this.createStreak(true));
    }
    if (this.streaks.length > count) {
      this.streaks.length = count;
    }
  }

  private createStreak(randomLife = false): SpeedStreak {
    const maxLife = 0.07 + Math.random() * 0.14;
    return {
      angle: Math.random() * Math.PI * 2,
      innerRatio: 0.88 + Math.random() * 0.42,
      length: 130 + Math.random() * 320,
      thickness: Math.random() < 0.22 ? 2.6 + Math.random() * 1.6 : 0.9 + Math.random() * 1.3,
      baseAlpha: 0.35 + Math.random() * 0.55,
      isAccent: Math.random() < 0.38,
      life: randomLife ? Math.random() * maxLife : 0,
      maxLife
    };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const cleaned = hex.replace('#', '');
    let r = 212, g = 236, b = 255;
    if (cleaned.length === 6) {
      r = parseInt(cleaned.substring(0, 2), 16) || 212;
      g = parseInt(cleaned.substring(2, 4), 16) || 236;
      b = parseInt(cleaned.substring(4, 6), 16) || 255;
    } else if (cleaned.length === 3) {
      r = parseInt(cleaned[0] + cleaned[0], 16) || 212;
      g = parseInt(cleaned[1] + cleaned[1], 16) || 236;
      b = parseInt(cleaned[2] + cleaned[2], 16) || 255;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  /**
   * Updates the speed lines effect every frame.
   * Ramps up smoothly when crossing threshold, smoothly closes when dropping below.
   */
  update(delta: number, speedKmh: number, settings: any) {
    const dt = Math.min(0.1, Math.max(0, delta));
    const enabled = settings ? settings.speedEffectEnabled !== false : false;
    const threshold = Number(settings?.speedEffectThreshold ?? 150);
    const maxSpeed = Number(settings?.speedEffectMax ?? 220);
    const streakCount = Math.max(20, Math.min(300, Math.round(Number(settings?.speedEffectLines ?? 140))));
    const fovBonus = Math.max(0, Math.min(30, Number(settings?.speedEffectFovBonus ?? 8)));
    const maxOpacity = Math.max(0.1, Math.min(1.0, Number(settings?.speedEffectOpacity ?? 85) / 100));
    const accentHex = typeof settings?.speedEffectColor === 'string' ? settings.speedEffectColor : '#d4ecff';

    // 1. Calculate Target Intensity
    let targetIntensity = 0;
    if (enabled && speedKmh >= threshold) {
      const range = Math.max(10, maxSpeed - threshold);
      targetIntensity = Math.min(1.0, (speedKmh - threshold) / range);
    }

    // 2. Smooth Opening & Smooth Closing (exponential approach)
    // Rise rate: ~4.0 (smooth ramp up over ~0.35s)
    // Decay rate: ~3.2 (smooth ramp down over ~0.45s)
    const lerpRate = targetIntensity > this.currentIntensity ? 4.0 : 3.2;
    this.currentIntensity += (targetIntensity - this.currentIntensity) * (1 - Math.exp(-lerpRate * dt));

    const camera = this.game.cameraController?.camera as THREE.PerspectiveCamera | undefined;

    // If practically zero, hide canvas and restore camera FOV
    if (this.currentIntensity < 0.005) {
      this.currentIntensity = 0;
      if (this.canvas.style.display !== 'none') {
        this.canvas.style.display = 'none';
        this.canvas.style.opacity = '0';
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      if (this.baseFov !== null && camera && camera.isPerspectiveCamera) {
        if (Math.abs(camera.fov - this.baseFov) > 0.05) {
          camera.fov += (this.baseFov - camera.fov) * (1 - Math.exp(-8.0 * dt));
          camera.updateProjectionMatrix();
        } else {
          camera.fov = this.baseFov;
          camera.updateProjectionMatrix();
          this.baseFov = null;
        }
      }
      return;
    }

    // 3. Dynamic Camera FOV Expansion (Speed rush sensation)
    if (camera && camera.isPerspectiveCamera) {
      if (this.baseFov === null) {
        this.baseFov = camera.fov;
      }
      const targetFov = this.baseFov + this.currentIntensity * fovBonus;
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6.0 * dt));
      camera.updateProjectionMatrix();
    }

    // 4. Render Speed Lines Overlay
    if (this.canvas.style.display !== 'block') {
      this.canvas.style.display = 'block';
    }
    const targetOpacity = (this.currentIntensity * maxOpacity).toFixed(3);
    this.canvas.style.opacity = targetOpacity;

    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.initStreaks(streakCount);

    // Dynamic center with high-speed micro-vibration
    let cx = w / 2;
    let cy = h / 2;
    if (this.currentIntensity > 0.5) {
      const shakeMag = (this.currentIntensity - 0.5) * 2.5 * this.dpr;
      cx += (Math.random() - 0.5) * shakeMag;
      cy += (Math.random() - 0.5) * shakeMag;
    }

    // Elliptical center aperture (matches widescreen aspect ratio)
    // Aperture slightly tightens at extreme speeds for tunnel-vision rush
    const apertureRx = (w * (0.28 - this.currentIntensity * 0.035));
    const apertureRy = (h * (0.25 - this.currentIntensity * 0.030));

    // Outer peripheral vignette / speed blur aura
    const maxRadius = Math.max(w, h) * 0.65;
    const vignetteGrad = ctx.createRadialGradient(cx, cy, apertureRx * 0.8, cx, cy, maxRadius);
    vignetteGrad.addColorStop(0, 'rgba(212, 236, 255, 0)');
    vignetteGrad.addColorStop(0.7, this.hexToRgba(accentHex, 0.04 * this.currentIntensity));
    vignetteGrad.addColorStop(1.0, this.hexToRgba(accentHex, 0.18 * this.currentIntensity));
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);

    // Update and draw streaks
    const speedMultiplier = 1.0 + this.currentIntensity * 1.8;
    for (let i = 0; i < this.streaks.length; i++) {
      const streak = this.streaks[i];
      streak.life += dt * speedMultiplier;
      if (streak.life >= streak.maxLife) {
        this.streaks[i] = this.createStreak(false);
        continue;
      }

      const progress = streak.life / streak.maxLife;
      // Streak streams radially outward during its brief life
      const currentRatio = streak.innerRatio + progress * 0.26;

      const cosA = Math.cos(streak.angle);
      const sinA = Math.sin(streak.angle);

      // Exact elliptical radius for angle
      const denom = Math.sqrt((apertureRy * cosA) * (apertureRy * cosA) + (apertureRx * sinA) * (apertureRx * sinA));
      const baseR = denom > 0 ? (apertureRx * apertureRy) / denom : apertureRx;

      const rStart = baseR * currentRatio;
      const streakLen = streak.length * (0.75 + this.currentIntensity * 0.5) * this.dpr;
      const rEnd = rStart + streakLen;

      const x0 = cx + cosA * rStart;
      const y0 = cy + sinA * rStart;
      const x1 = cx + cosA * rEnd;
      const y1 = cy + sinA * rEnd;

      // Smooth alpha envelope: fade in at tip, peak in middle, fade at end
      const alphaPeak = Math.sin(progress * Math.PI);
      const effectiveAlpha = Math.min(1.0, streak.baseAlpha * alphaPeak * (0.4 + this.currentIntensity * 0.6));

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineWidth = streak.thickness * this.dpr;
      ctx.lineCap = 'round';

      if (streak.isAccent) {
        ctx.strokeStyle = this.hexToRgba(accentHex, effectiveAlpha);
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${effectiveAlpha.toFixed(3)})`;
      }
      ctx.stroke();
    }
  }

  reset() {
    this.currentIntensity = 0;
    if (this.canvas) {
      this.canvas.style.display = 'none';
      this.canvas.style.opacity = '0';
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const camera = this.game.cameraController?.camera as THREE.PerspectiveCamera | undefined;
    if (this.baseFov !== null && camera && camera.isPerspectiveCamera) {
      camera.fov = this.baseFov;
      camera.updateProjectionMatrix();
      this.baseFov = null;
    }
  }

  dispose() {
    this.reset();
    window.removeEventListener('resize', this.resizeHandler);
    this.canvas.remove();
  }
}

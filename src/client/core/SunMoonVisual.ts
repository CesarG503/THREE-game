import * as THREE from "three";

export interface SunMoonVisualState {
  enabled: boolean;
  useShaderSky: boolean;
  sunIntensity: number;
  dayProgress: number;
  sunIsDay: boolean;
  sunSizeSunrise: number;
  sunSizeNoon: number;
  sunSizeSunset: number;
  moonSize: number;
  sunColorSunrise: string;
  sunColorNoon: string;
  sunColorSunset: string;
  moonColor: string;
}

export class SunMoonVisual {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private group: THREE.Group;
  private sunSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;
  private sunMaterial: THREE.SpriteMaterial;
  private moonMaterial: THREE.SpriteMaterial;
  private sunTexture: THREE.CanvasTexture;
  private moonTexture: THREE.CanvasTexture;
  private sunDirection: THREE.Vector3;
  private enabled: boolean;
  private useShaderSky: boolean;
  private sunIntensity: number;
  private dayProgress: number;
  private sunIsDay: boolean;
  private sunSizeSunrise: number;
  private sunSizeNoon: number;
  private sunSizeSunset: number;
  private moonSize: number;
  private sunColorSunrise: THREE.Color;
  private sunColorNoon: THREE.Color;
  private sunColorSunset: THREE.Color;
  private moonColor: THREE.Color;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.sunDirection = new THREE.Vector3(0, 1, 0);
    this.enabled = true;
    this.useShaderSky = false;
    this.sunIntensity = 1;
    this.dayProgress = 0.5;
    this.sunIsDay = true;
    this.sunSizeSunrise = 0.9;
    this.sunSizeNoon = 0.72;
    this.sunSizeSunset = 1.0;
    this.moonSize = 0.85;
    this.sunColorSunrise = new THREE.Color("#ffd08a");
    this.sunColorNoon = new THREE.Color("#ffffff");
    this.sunColorSunset = new THREE.Color("#ff9a5c");
    this.moonColor = new THREE.Color("#dbeafe");

    this.group = new THREE.Group();
    this.group.name = "sunMoonVisual";
    this.group.userData.ignorePlacementRaycast = true;

    this.sunTexture = this.createSunTexture();
    this.moonTexture = this.createMoonTexture();

    this.sunMaterial = new THREE.SpriteMaterial({
      map: this.sunTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      fog: false
    });

    this.moonMaterial = new THREE.SpriteMaterial({
      map: this.moonTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      fog: false
    });

    this.sunSprite = this.createSprite("proceduralSun", this.sunMaterial);
    this.moonSprite = this.createSprite("proceduralMoon", this.moonMaterial);
    this.group.add(this.sunSprite);
    this.group.add(this.moonSprite);
    this.scene.add(this.group);
  }

  setState(direction: THREE.Vector3, state: SunMoonVisualState) {
    this.sunDirection.copy(direction).normalize();
    this.enabled = state.enabled;
    this.useShaderSky = state.useShaderSky;
    this.sunIntensity = state.sunIntensity;
    this.dayProgress = THREE.MathUtils.clamp(state.dayProgress ?? 0.5, 0, 1);
    this.sunIsDay = state.sunIsDay !== false;
    this.sunSizeSunrise = this.clampScale(state.sunSizeSunrise, 0.2, 3.5, 0.9);
    this.sunSizeNoon = this.clampScale(state.sunSizeNoon, 0.2, 3.5, 0.72);
    this.sunSizeSunset = this.clampScale(state.sunSizeSunset, 0.2, 3.5, 1.0);
    this.moonSize = this.clampScale(state.moonSize, 0.2, 3.5, 0.85);
    this.sunColorSunrise.set(state.sunColorSunrise || "#ffd08a");
    this.sunColorNoon.set(state.sunColorNoon || "#ffffff");
    this.sunColorSunset.set(state.sunColorSunset || "#ff9a5c");
    this.moonColor.set(state.moonColor || "#dbeafe");
    this.updateCameraPosition();
  }

  updateCameraPosition() {
    const shouldRender = this.enabled && !this.useShaderSky;
    const sunY = this.sunDirection.y;
    const sunOpacity = shouldRender
      ? THREE.MathUtils.smoothstep(sunY, -0.05, 0.12) * THREE.MathUtils.clamp(0.45 + this.sunIntensity * 0.45, 0.45, 0.95)
      : 0;
    const moonOpacity = shouldRender
      ? (1 - THREE.MathUtils.smoothstep(sunY, -0.12, 0.08)) * 0.82
      : 0;

    this.sunMaterial.opacity = sunOpacity;
    this.moonMaterial.opacity = moonOpacity;
    this.sunMaterial.color.copy(this.getSunColor());
    this.moonMaterial.color.copy(this.moonColor);
    this.sunSprite.visible = sunOpacity > 0.01;
    this.moonSprite.visible = moonOpacity > 0.01;

    if (!this.sunSprite.visible && !this.moonSprite.visible) return;

    const cameraFar = Number.isFinite(this.camera.far) ? this.camera.far : 1000;
    const distance = Math.max(20, Math.min(cameraFar * 0.72, 620));
    const sunPos = this.camera.position.clone().addScaledVector(this.sunDirection, distance);
    const moonDirection = this.sunDirection.clone().multiplyScalar(-1).normalize();
    const moonPos = this.camera.position.clone().addScaledVector(moonDirection, distance);

    this.sunSprite.position.copy(sunPos);
    this.moonSprite.position.copy(moonPos);
    this.sunSprite.scale.setScalar(distance * 0.075 * this.getSunSize());
    this.moonSprite.scale.setScalar(distance * 0.045 * this.moonSize);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
    this.sunMaterial.dispose();
    this.moonMaterial.dispose();
    this.sunTexture.dispose();
    this.moonTexture.dispose();
  }

  private createSprite(name: string, material: THREE.SpriteMaterial) {
    const sprite = new THREE.Sprite(material);
    sprite.name = name;
    sprite.renderOrder = -900;
    sprite.userData.ignorePlacementRaycast = true;
    sprite.raycast = () => {};
    return sprite;
  }

  private clampScale(value: number, min: number, max: number, fallback: number) {
    const n = Number(value);
    return Number.isFinite(n) ? THREE.MathUtils.clamp(n, min, max) : fallback;
  }

  private getSunSize() {
    return this.blendDayValue(this.sunSizeSunrise, this.sunSizeNoon, this.sunSizeSunset);
  }

  private blendDayValue(sunriseValue: number, noonValue: number, sunsetValue: number) {
    const t = THREE.MathUtils.clamp(this.dayProgress, 0, 1);
    if (t < 0.32) {
      return THREE.MathUtils.lerp(sunriseValue, noonValue, THREE.MathUtils.smoothstep(t, 0, 0.32));
    }
    if (t > 0.72) {
      return THREE.MathUtils.lerp(noonValue, sunsetValue, THREE.MathUtils.smoothstep(t, 0.72, 1));
    }
    return noonValue;
  }

  private getSunColor() {
    const t = THREE.MathUtils.clamp(this.dayProgress, 0, 1);
    if (t < 0.32) {
      return this.sunColorSunrise.clone().lerp(this.sunColorNoon, THREE.MathUtils.smoothstep(t, 0, 0.32));
    }
    if (t > 0.72) {
      return this.sunColorNoon.clone().lerp(this.sunColorSunset, THREE.MathUtils.smoothstep(t, 0.72, 1));
    }
    return this.sunColorNoon.clone();
  }

  private createSunTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create sun texture");

    const glow = ctx.createRadialGradient(128, 128, 4, 128, 128, 122);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.18, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.36, "rgba(255,255,255,0.58)");
    glow.addColorStop(0.72, "rgba(255,255,255,0.18)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);

    const disk = ctx.createRadialGradient(118, 112, 8, 128, 128, 42);
    disk.addColorStop(0, "#ffffff");
    disk.addColorStop(0.45, "#ffffff");
    disk.addColorStop(1, "#f1f5f9");
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(128, 128, 38, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createMoonTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create moon texture");

    const glow = ctx.createRadialGradient(128, 128, 16, 128, 128, 118);
    glow.addColorStop(0, "rgba(226,240,255,0.98)");
    glow.addColorStop(0.32, "rgba(147,197,253,0.45)");
    glow.addColorStop(1, "rgba(147,197,253,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);

    const disk = ctx.createRadialGradient(112, 102, 8, 128, 128, 42);
    disk.addColorStop(0, "#f8fbff");
    disk.addColorStop(0.65, "#dbeafe");
    disk.addColorStop(1, "#93c5fd");
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(128, 128, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.arc(145, 118, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
}

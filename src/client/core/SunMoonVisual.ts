import * as THREE from "three";
import { SolarAtmosphere } from "./SolarAtmosphere";

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
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoefficient: number;
  skyMieDirectionalG: number;
}

export class SunMoonVisual {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private group: THREE.Group;
  readonly atmosphere: SolarAtmosphere;
  private moonSprite: THREE.Sprite;
  private moonMaterial: THREE.SpriteMaterial;
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

    this.atmosphere = new SolarAtmosphere();
    this.moonTexture = this.createMoonTexture();

    this.moonMaterial = new THREE.SpriteMaterial({
      map: this.moonTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      fog: false
    });

    this.moonSprite = this.createSprite("proceduralMoon", this.moonMaterial);
    this.group.add(this.atmosphere);
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
    const uniforms = this.atmosphere.material.uniforms;
    uniforms.turbidity.value = this.clampScale(state.skyTurbidity, 0, 20, 10);
    uniforms.rayleigh.value = this.clampScale(state.skyRayleigh, 0, 4, 2);
    uniforms.mieCoefficient.value = this.clampScale(state.skyMieCoefficient, 0, 0.1, 0.005);
    uniforms.mieDirectionalG.value = this.clampScale(state.skyMieDirectionalG, 0, 1, 0.8);
    this.updateCameraPosition();
  }

  updateCameraPosition() {
    const sunY = this.sunDirection.y;
    const moonOpacity = this.enabled
      ? (1 - THREE.MathUtils.smoothstep(sunY, -0.12, 0.08)) * 0.82
      : 0;

    this.atmosphere.visible = this.useShaderSky || this.enabled;
    this.atmosphere.position.copy(this.camera.position);
    const uniforms = this.atmosphere.material.uniforms;
    uniforms.fullSky.value = this.useShaderSky;
    uniforms.solarEnabled.value = this.enabled;
    uniforms.sunPosition.value.copy(this.sunDirection);
    uniforms.solarRadius.value = 0.075 * (38 / 256) * this.getSunSize();
    uniforms.solarColor.value.copy(this.getSunColor());
    uniforms.solarStrength.value = THREE.MathUtils.clamp(0.8 + this.sunIntensity * 0.4, 0.8, 1.6);
    this.moonMaterial.opacity = moonOpacity;
    this.moonMaterial.color.copy(this.moonColor);
    this.moonSprite.visible = moonOpacity > 0.01;

    if (!this.moonSprite.visible) return;

    const cameraFar = Number.isFinite(this.camera.far) ? this.camera.far : 1000;
    const distance = Math.max(20, Math.min(cameraFar * 0.72, 620));
    const moonDirection = this.sunDirection.clone().multiplyScalar(-1).normalize();
    const moonPos = this.camera.position.clone().addScaledVector(moonDirection, distance);

    this.moonSprite.position.copy(moonPos);
    this.moonSprite.scale.setScalar(distance * 0.045 * this.moonSize);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
    this.atmosphere.material.dispose();
    this.atmosphere.geometry.dispose();
    this.moonMaterial.dispose();
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

    // The crescent shadow must not erase the halo outside the lunar disk.
    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 36, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.arc(145, 118, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
}

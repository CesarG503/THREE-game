import * as THREE from "three";
import { SolarAtmosphere } from "./SolarAtmosphere";
import { CelestialGlow } from "./CelestialGlow";

export interface SunMoonVisualState {
  enabled: boolean;
  useShaderSky: boolean;
  sunIntensity: number;
  sunSize: number;
  moonSize: number;
  sunColor: string;
  moonColor: string;
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoefficient: number;
  skyMieDirectionalG: number;
  sunGlowIntensity: number;
  sunGlowSize: number;
  moonGlowIntensity: number;
  moonGlowSize: number;
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
  private sunSize: number;
  private moonSize: number;
  private sunColor: THREE.Color;
  private moonColor: THREE.Color;
  private sunGlow = new CelestialGlow("sunGlow");
  private moonGlow = new CelestialGlow("moonGlow", true);
  private sunGlowIntensity = 1;
  private sunGlowSize = 1;
  private moonGlowIntensity = 0.45;
  private moonGlowSize = 1;
  private glowColor = new THREE.Color();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.sunDirection = new THREE.Vector3(0, 1, 0);
    this.enabled = true;
    this.useShaderSky = false;
    this.sunIntensity = 1;
    this.sunSize = 0.72;
    this.moonSize = 0.85;
    this.sunColor = new THREE.Color("#ffffff");
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
    this.group.add(this.sunGlow, this.moonGlow);
    this.scene.add(this.group);
  }

  setState(direction: THREE.Vector3, state: SunMoonVisualState) {
    this.sunDirection.copy(direction).normalize();
    this.enabled = state.enabled;
    this.useShaderSky = state.useShaderSky;
    this.sunIntensity = state.sunIntensity;
    this.sunSize = this.clampScale(state.sunSize, 0.2, 3.5, 0.72);
    this.moonSize = this.clampScale(state.moonSize, 0.2, 3.5, 0.85);
    this.sunColor.set(state.sunColor || "#ffffff");
    this.moonColor.set(state.moonColor || "#dbeafe");
    const uniforms = this.atmosphere.material.uniforms;
    uniforms.turbidity.value = this.clampScale(state.skyTurbidity, 0, 20, 10);
    uniforms.rayleigh.value = this.clampScale(state.skyRayleigh, 0, 4, 2);
    uniforms.mieCoefficient.value = this.clampScale(state.skyMieCoefficient, 0, 0.1, 0.005);
    uniforms.mieDirectionalG.value = this.clampScale(state.skyMieDirectionalG, 0, 1, 0.8);
    this.sunGlowIntensity = this.clampScale(state.sunGlowIntensity, 0, 4, 1);
    this.sunGlowSize = this.clampScale(state.sunGlowSize, 0.2, 4, 1);
    this.moonGlowIntensity = this.clampScale(state.moonGlowIntensity, 0, 4, 0.45);
    this.moonGlowSize = this.clampScale(state.moonGlowSize, 0.2, 4, 1);
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
    uniforms.solarRadius.value = 0.075 * (38 / 256) * this.sunSize;
    uniforms.solarColor.value.copy(this.sunColor);
    uniforms.solarStrength.value = THREE.MathUtils.clamp(0.8 + this.sunIntensity * 0.4, 0.8, 1.6);
    const aerosol = Math.min(3, Math.sqrt(uniforms.mieCoefficient.value / 0.005) * (0.5 + uniforms.turbidity.value * 0.125));
    const concentration = 1.8 - uniforms.mieDirectionalG.value * 1.5;
    const glowSpread = this.sunGlowSize * concentration * (0.65 + aerosol * 0.35);
    uniforms.solarEdgeSoftness.value = 0.025 + Math.min(0.35, this.sunGlowIntensity * glowSpread * 0.12);
    this.moonMaterial.opacity = moonOpacity;
    this.moonMaterial.color.copy(this.moonColor);
    this.moonSprite.visible = moonOpacity > 0.01;

    const cameraFar = Number.isFinite(this.camera.far) ? this.camera.far : 1000;
    const distance = Math.max(20, Math.min(cameraFar * 0.72, 620));
    const moonDirection = this.sunDirection.clone().multiplyScalar(-1).normalize();
    const moonPos = this.camera.position.clone().addScaledVector(moonDirection, distance);

    this.moonSprite.position.copy(moonPos);
    this.moonSprite.scale.setScalar(distance * 0.045 * this.moonSize);

    // Match the atmospheric disk's wavelength-dependent extinction at the horizon.
    const elevation = Math.max(0, sunY);
    const zenithDegrees = THREE.MathUtils.radToDeg(Math.acos(elevation));
    const airMass = 1 / (elevation + 0.15 * Math.pow(93.885 - zenithDegrees, -1.253));
    const rayleigh = uniforms.rayleigh.value * 8400 * airMass;
    const mie = uniforms.turbidity.value * uniforms.mieCoefficient.value * 0.434 * 2e-18 * 1250 * airMass;
    // Normalize by red transmission, as in SolarAtmosphere, avoiding horizon underflow.
    this.glowColor.setRGB(1,
      Math.exp(-(1.3562911419845635e-5 - 5.804542996261093e-6) * rayleigh - (2.7798023919660528e14 - 1.8399918514433978e14) * mie),
      Math.exp(-(3.0265902468824876e-5 - 5.804542996261093e-6) * rayleigh - (4.0790479543861094e14 - 1.8399918514433978e14) * mie)
    ).multiply(uniforms.solarColor.value);
    const sunVisibility = this.enabled ? THREE.MathUtils.smoothstep(sunY, -0.04, 0.01) : 0;
    this.sunGlow.position.copy(this.camera.position).addScaledVector(this.sunDirection, distance);
    this.sunGlow.quaternion.copy(this.camera.quaternion);
    this.sunGlow.setGlow(distance * uniforms.solarRadius.value,
      sunVisibility * this.sunGlowIntensity * (0.55 + aerosol * 0.45) * uniforms.solarStrength.value,
      glowSpread, this.glowColor);
    this.moonGlow.position.copy(moonPos);
    this.moonGlow.quaternion.copy(this.camera.quaternion);
    this.moonGlow.setGlow(distance * 0.045 * (36 / 256) * this.moonSize,
      moonOpacity * this.moonGlowIntensity, this.moonGlowSize, this.moonColor);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
    this.atmosphere.material.dispose();
    this.atmosphere.geometry.dispose();
    this.moonMaterial.dispose();
    this.moonTexture.dispose();
    this.sunGlow.dispose();
    this.moonGlow.dispose();
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

  private createMoonTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create moon texture");

    const disk = ctx.createRadialGradient(112, 102, 8, 128, 128, 42);
    disk.addColorStop(0, "#f8fbff");
    disk.addColorStop(0.65, "#dbeafe");
    disk.addColorStop(1, "#93c5fd");
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(128, 128, 36, 0, Math.PI * 2);
    ctx.fill();

    // Keep the crescent shadow inside the disk; the adjustable halo is a separate layer.
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

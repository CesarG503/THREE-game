import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { SunMoonVisual } from "./SunMoonVisual";
import { getSkyboxPresetDefaults } from "../platform/skyboxPresets";
import { DEFAULT_SOLAR_VISUAL_SETTINGS, calculateSolarCyclePosition, interpolateTimelineState } from "../platform/timelineDefaults";

const SKYBOX_PREFIX = "skybox:";
const SKYBOX_FACE_LAYOUT = {
  px: { x: 2, y: 1 },
  nx: { x: 0, y: 1 },
  py: { x: 1, y: 0 },
  ny: { x: 1, y: 2 },
  pz: { x: 1, y: 1 },
  nz: { x: 3, y: 1 }
};

export class SceneManager {
  container: HTMLElement | null;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ambientLight: THREE.AmbientLight;
  dirLight: THREE.DirectionalLight;
  stars: THREE.Points | null;
  currentRenderDistance: number | undefined;
  skyMesh: Sky | null = null;
  sunMoonVisual: SunMoonVisual;
  sunVec: THREE.Vector3;
  lastShadowQuality: string | null = null;
  lastFrustumRenderDistance: number | null = null;
  private boundResize: () => void;
  private skyboxCache: Map<string, Promise<THREE.CubeTexture>>;
  private skyboxTextureByUrl: Map<string, THREE.CubeTexture>;
  private loadedSkyboxTextures: Set<THREE.CubeTexture>;
  private activeSkyboxTexture: THREE.CubeTexture | null;
  private skyboxTransitionMesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> | null;
  private skyboxTransitionMaterial: THREE.ShaderMaterial | null;
  private skyboxTransitionKey: string | null;
  private skyboxTransitionRequestId: number;
  private activeVisualSkyType: string | null;
  private skyboxRequestId: number;

  constructor(containerId: any) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    this.scene.environment = null;
    this.skyboxCache = new Map();
    this.skyboxTextureByUrl = new Map();
    this.loadedSkyboxTextures = new Set();
    this.activeSkyboxTexture = null;
    this.skyboxTransitionMesh = null;
    this.skyboxTransitionMaterial = null;
    this.skyboxTransitionKey = null;
    this.skyboxTransitionRequestId = 0;
    this.activeVisualSkyType = null;
    this.skyboxRequestId = 0;
    this.sunVec = new THREE.Vector3();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.sunMoonVisual = new SunMoonVisual(this.scene, this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
    }

    this.initLights();
    this.initFloor();

    this.boundResize = this.onWindowResize.bind(this);
    window.addEventListener("resize", this.boundResize);
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(10, 20, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.camera.top = 20;
    this.dirLight.shadow.camera.bottom = -20;
    this.dirLight.shadow.camera.left = -20;
    this.dirLight.shadow.camera.right = 20;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.scene.add(this.dirLight);
  }

  initFloor() {
    // Floor plane is now managed by Game (main_rapier.js) dynamically

    // Initialize stars (hidden by default)
    this.createStars();
  }

  createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.25,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false
    });

    const starVertices = [];
    for (let i = 0; i < 2500; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const radius = 300 + Math.random() * 300;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      let y = Math.abs(radius * Math.cos(phi)) + 30; // High elevated dome above player
      const z = radius * Math.sin(phi) * Math.sin(theta);
      starVertices.push(x, y, z);
    }

    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.stars.visible = false;
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  private isSkyboxType(value: any): value is string {
    return typeof value === "string" && value.startsWith(SKYBOX_PREFIX);
  }

  private createSkyboxTransitionMesh() {
    if (this.skyboxTransitionMesh && this.skyboxTransitionMaterial) return;

    this.skyboxTransitionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        mapA: { value: null },
        mapB: { value: null },
        blend: { value: 0 }
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube mapA;
        uniform samplerCube mapB;
        uniform float blend;
        varying vec3 vDirection;
        void main() {
          vec3 dir = normalize(vDirection);
          vec4 colorA = textureCube(mapA, dir);
          vec4 colorB = textureCube(mapB, dir);
          gl_FragColor = vec4(mix(colorA.rgb, colorB.rgb, clamp(blend, 0.0, 1.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    });

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    this.skyboxTransitionMesh = new THREE.Mesh(geometry, this.skyboxTransitionMaterial);
    this.skyboxTransitionMesh.name = "skyboxTransitionMesh";
    this.skyboxTransitionMesh.userData.ignorePlacementRaycast = true;
    this.skyboxTransitionMesh.raycast = () => {};
    this.skyboxTransitionMesh.visible = false;
    this.skyboxTransitionMesh.frustumCulled = false;
    this.skyboxTransitionMesh.renderOrder = -1000;
    this.scene.add(this.skyboxTransitionMesh);
  }

  private hideSkyboxTransition() {
    if (this.skyboxTransitionMesh) this.skyboxTransitionMesh.visible = false;
    this.skyboxTransitionKey = null;
  }

  private updateSkyboxTransition(fromType: any, toType: any, blend: number, rotationRad: number) {
    if (!this.isSkyboxType(fromType) || !this.isSkyboxType(toType) || fromType === toType) {
      this.hideSkyboxTransition();
      return false;
    }

    const clampedBlend = THREE.MathUtils.clamp(blend, 0, 1);
    const fromUrl = fromType.slice(SKYBOX_PREFIX.length);
    const toUrl = toType.slice(SKYBOX_PREFIX.length);
    const key = `${fromUrl}|${toUrl}`;
    this.createSkyboxTransitionMesh();

    if (!this.skyboxTransitionMesh || !this.skyboxTransitionMaterial) return false;

    this.skyboxTransitionMesh.position.copy(this.camera.position);
    this.skyboxTransitionMesh.rotation.set(0, rotationRad, 0);

    if (this.skyboxTransitionKey !== key) {
      this.skyboxTransitionKey = key;
      const fallbackTexture = this.skyboxTextureByUrl.get(fromUrl);
      if (fallbackTexture) {
        this.skyboxTransitionMaterial.uniforms.mapA.value = fallbackTexture;
        this.skyboxTransitionMaterial.uniforms.mapB.value = fallbackTexture;
        this.skyboxTransitionMaterial.uniforms.blend.value = 0;
        this.skyboxTransitionMesh.visible = true;
        this.scene.background = null;
        this.scene.environment = fallbackTexture;
        this.activeSkyboxTexture = fallbackTexture;
      } else {
        this.skyboxTransitionMesh.visible = false;
      }
      const requestId = ++this.skyboxTransitionRequestId;

      Promise.all([
        this.loadSkyboxFromAtlas(fromUrl),
        this.loadSkyboxFromAtlas(toUrl)
      ]).then(([textureA, textureB]) => {
        if (requestId !== this.skyboxTransitionRequestId || this.skyboxTransitionKey !== key) return;
        if (!this.skyboxTransitionMaterial || !this.skyboxTransitionMesh) return;
        this.skyboxTransitionMaterial.uniforms.mapA.value = textureA;
        this.skyboxTransitionMaterial.uniforms.mapB.value = textureB;
        this.skyboxTransitionMaterial.needsUpdate = true;
        this.skyboxTransitionMesh.visible = true;
      }).catch((error) => {
        console.warn("Failed to prepare skybox transition", error);
      });
    }

    const textureA = this.skyboxTransitionMaterial.uniforms.mapA.value as THREE.CubeTexture | null;
    const textureB = this.skyboxTransitionMaterial.uniforms.mapB.value as THREE.CubeTexture | null;
    if (!textureA || !textureB) {
      if (this.activeVisualSkyType !== fromType) this.setSky(fromType);
      return true;
    }

    this.scene.background = null;
    this.skyboxTransitionMaterial.uniforms.blend.value = clampedBlend;
    this.scene.environment = clampedBlend < 0.5 ? textureA : textureB;
    this.activeSkyboxTexture = clampedBlend < 0.5 ? textureA : textureB;
    this.activeVisualSkyType = `transition:${key}`;
    this.skyboxTransitionMesh.visible = true;
    return true;
  }

  setSky(type: any) {
    const skyType = type || "day";
    this.activeVisualSkyType = skyType;
    const requestId = ++this.skyboxRequestId;

    if (typeof skyType === "string" && skyType.startsWith(SKYBOX_PREFIX)) {
      const atlasUrl = skyType.slice(SKYBOX_PREFIX.length);
      this.loadSkyboxFromAtlas(atlasUrl)
        .then((texture) => {
          if (requestId !== this.skyboxRequestId) return;
          this.setActiveSkybox(texture);
        })
        .catch((error) => {
          console.warn("Failed to load skybox cubemap", atlasUrl, error);
          if (requestId === this.skyboxRequestId) this.applyColorSky("day");
        });
      return;
    }

    this.applyColorSky(skyType);
  }

  private applyDefaultLighting() {
    // ALWAYS use Day/Default lighting to preserve object colors
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.6;
      this.ambientLight.color.setHex(0xffffff);
    }
    if (this.dirLight) {
      this.dirLight.intensity = 0.8;
      this.dirLight.color.setHex(0xffffff);
      this.dirLight.position.set(10, 20, 10);
    }
  }

  private applyColorSky(type: any) {
    this.clearActiveSkybox();

    if (type === "night") {
      this.scene.background = new THREE.Color(0x020210);
      this.scene.fog = new THREE.FogExp2(0x020210, 0.015);
    } else if (type === "sunset") {
      const sunsetColor = 0xffae88;
      this.scene.background = new THREE.Color(sunsetColor);
      this.scene.fog = new THREE.Fog(sunsetColor, 10, 60);
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    }

    if (this.currentRenderDistance !== undefined) {
      this.setRenderDistance(this.currentRenderDistance);
    }
  }

  private setActiveSkybox(texture: THREE.CubeTexture) {
    this.activeSkyboxTexture = texture;
    this.scene.background = texture;
    this.scene.environment = texture;
    this.scene.fog = null;
  }

  private clearActiveSkybox() {
    this.scene.environment = null;
    if (this.activeSkyboxTexture) {
      this.activeSkyboxTexture = null;
    }
  }

  private loadSkyboxFromAtlas(atlasUrl: string): Promise<THREE.CubeTexture> {
    const cached = this.skyboxCache.get(atlasUrl);
    if (cached) return cached;

    const promise = new Promise<THREE.CubeTexture>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const faceSize = Math.min(image.width / 4, image.height / 3);
          const faces = [
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.px),
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.nx),
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.py),
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.ny),
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.pz),
            this.extractSkyboxFace(image, faceSize, SKYBOX_FACE_LAYOUT.nz)
          ];
          const texture = new THREE.CubeTexture(faces);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          this.skyboxTextureByUrl.set(atlasUrl, texture);
          this.loadedSkyboxTextures.add(texture);
          resolve(texture);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error(`Could not load ${atlasUrl}`));
      image.src = atlasUrl;
    });

    this.skyboxCache.set(atlasUrl, promise);
    return promise;
  }

  private extractSkyboxFace(image: HTMLImageElement, faceSize: number, face: { x: number; y: number }) {
    const canvas = document.createElement("canvas");
    canvas.width = faceSize;
    canvas.height = faceSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context for skybox");
    ctx.drawImage(
      image,
      face.x * faceSize,
      face.y * faceSize,
      faceSize,
      faceSize,
      0,
      0,
      faceSize,
      faceSize
    );
    return canvas;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setRenderDistance(distance: any) {
    this.currentRenderDistance = distance;
    if (this.camera) {
      this.camera.far = distance;
      this.camera.updateProjectionMatrix();
    }
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.far = distance;
    } else if (fog instanceof THREE.FogExp2) {
      fog.density = 1.5 / distance;
    }
  }

  updateLightingAndSky(config: any) {
    if (!config) return;

    // 1. Shadow Quality configuration (High Performance default)
    const shadowQuality = config.shadowQuality || "medium";
    const renderDistance = this.currentRenderDistance || 100;
    
    if (shadowQuality !== this.lastShadowQuality || renderDistance !== this.lastFrustumRenderDistance) {
      this.lastShadowQuality = shadowQuality;
      this.lastFrustumRenderDistance = renderDistance;
      
      if (shadowQuality === "off") {
        this.dirLight.castShadow = false;
        this.renderer.shadowMap.enabled = false;
      } else {
        this.renderer.shadowMap.enabled = true;
        this.dirLight.castShadow = true;
        
        let mapSize = 1024;
        let frustumSizeMultiplier = 0.8;
        
        if (shadowQuality === "low") {
          mapSize = 512;
          frustumSizeMultiplier = 0.5;
        } else if (shadowQuality === "medium") {
          mapSize = 1024;
          frustumSizeMultiplier = 0.8;
        } else if (shadowQuality === "high") {
          mapSize = 2048;
          frustumSizeMultiplier = 1.2;
        }
        
        const frustumSize = renderDistance * frustumSizeMultiplier;
        
        this.dirLight.shadow.mapSize.width = mapSize;
        this.dirLight.shadow.mapSize.height = mapSize;
        
        const cam = this.dirLight.shadow.camera;
        cam.left = -frustumSize;
        cam.right = frustumSize;
        cam.top = frustumSize;
        cam.bottom = -frustumSize;
        
        // Large offset and far plane to ensure tall walls, ceilings, and far objects always cast shadows
        const offsetDistance = Math.max(120, renderDistance * 1.5);
        cam.near = 0.1;
        cam.far = offsetDistance * 2.5;
        
        if (this.dirLight.shadow.map) {
          this.dirLight.shadow.map.dispose();
          this.dirLight.shadow.map = null;
        }
        cam.updateProjectionMatrix();
      }
    }

    // 2. Light Mode & Preset Setup
    const isDynamicCycle = config.timeOfDay !== undefined || !!config.enableDayNightCycle || !!config.isCycleSimulating;
    let interpolated: any = null;

    if (isDynamicCycle) {
      const timeOfDay = config.timeOfDay !== undefined ? config.timeOfDay : 12;
      interpolated = interpolateTimelineState(config.dayNightTimeline, timeOfDay);
    }

    const visualConfig = isDynamicCycle && interpolated ? { ...config, ...interpolated } : config;
    const lightMode = visualConfig.lightMode || config.lightMode || "day";
    const skyType = visualConfig.skyType || config.skyType || "day";
    const isSkyboxActive = typeof skyType === "string" && skyType.startsWith(SKYBOX_PREFIX);
    
    // Apply Scene Environment & Background Parameters (IBL, Brightness, Blur & Rotation)
    (this.scene as any).environmentIntensity = visualConfig.environmentIntensity !== undefined ? Number(visualConfig.environmentIntensity) : 1.0;
    (this.scene as any).backgroundIntensity = visualConfig.backgroundIntensity !== undefined ? Number(visualConfig.backgroundIntensity) : 1.0;
    (this.scene as any).backgroundBlurriness = visualConfig.backgroundBlurriness !== undefined ? Number(visualConfig.backgroundBlurriness) : 0.0;
    
    const skyRotRad = THREE.MathUtils.degToRad(visualConfig.skyboxRotation !== undefined ? Number(visualConfig.skyboxRotation) : 0);
    if ((this.scene as any).backgroundRotation) {
      (this.scene as any).backgroundRotation.y = skyRotRad;
    }
    if ((this.scene as any).environmentRotation) {
      (this.scene as any).environmentRotation.y = skyRotRad;
    }

    // Check if we need to enable Sky Shader
    const isShaderSky = skyType === "shader" || lightMode === "cycle";
    const isSkyboxTransitionManaged = isDynamicCycle && interpolated && interpolated.transitionMode !== "instant"
      ? this.updateSkyboxTransition(interpolated.skyTypeFrom, interpolated.skyTypeTo, interpolated.transitionFactor ?? interpolated.factor ?? 0, skyRotRad)
      : false;
    
    if (isSkyboxTransitionManaged) {
      if (this.skyMesh) {
        this.skyMesh.visible = false;
      }
    } else if (isShaderSky) {
      this.hideSkyboxTransition();
      this.activeVisualSkyType = skyType;
      this.clearActiveSkybox();
      if (!this.skyMesh) {
        this.skyMesh = new Sky();
        this.skyMesh.scale.setScalar(450000);
        this.skyMesh.name = "atmosphericSkyMesh";
        this.skyMesh.userData.ignorePlacementRaycast = true;
        this.skyMesh.raycast = () => {};
        (this.skyMesh.material as THREE.ShaderMaterial).fog = false;
        this.scene.add(this.skyMesh);
      }
      this.skyMesh.visible = true;
      this.scene.background = null;
      this.scene.environment = null;
      
      // Update Sky Shader uniforms
      const uniforms = this.skyMesh.material.uniforms;
      uniforms["turbidity"].value = visualConfig.skyTurbidity !== undefined ? Number(visualConfig.skyTurbidity) : 10;
      uniforms["rayleigh"].value = visualConfig.skyRayleigh !== undefined ? Number(visualConfig.skyRayleigh) : 2;
      uniforms["mieCoefficient"].value = visualConfig.skyMieCoefficient !== undefined ? Number(visualConfig.skyMieCoefficient) : 0.005;
      uniforms["mieDirectionalG"].value = visualConfig.skyMieDirectionalG !== undefined ? Number(visualConfig.skyMieDirectionalG) : 0.8;
    } else {
      this.hideSkyboxTransition();
      if (this.skyMesh) {
        this.skyMesh.visible = false;
      }
      if (this.activeVisualSkyType !== skyType) {
        this.hideSkyboxTransition();
        this.setSky(skyType);
      }
      // Apply background color/texture
      if (skyType === "night" || lightMode === "night") {
        this.scene.background = new THREE.Color(0x020210);
      } else if (skyType === "sunset" || lightMode === "sunset") {
        const sunsetColor = 0xffae88;
        this.scene.background = new THREE.Color(sunsetColor);
      } else if (isSkyboxActive) {
        // Skybox texture loading is handled asynchronously by setSky
      } else {
        this.scene.background = new THREE.Color(0x87ceeb);
      }
    }

    // Unified Fog Application for ALL Sky Types (day, night, sunset, shader, and cubemaps)
    if (isDynamicCycle && interpolated) {
      const isFogEnabled = visualConfig.enableSkyboxFog !== undefined ? !!visualConfig.enableSkyboxFog : !!interpolated.enableSkyboxFog;
      if (isFogEnabled) {
        const fogColor = visualConfig.fogColor || interpolated.fogColor || "#87ceeb";
        const fogNear = visualConfig.fogNear !== undefined ? Number(visualConfig.fogNear) : (interpolated.fogNear ?? 10);
        const fogFar = visualConfig.fogFar !== undefined ? Number(visualConfig.fogFar) : (interpolated.fogFar ?? 50);
        this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
      } else {
        this.scene.fog = null;
      }
    } else {
      const presetDefaults = getSkyboxPresetDefaults(skyType);
      const isFogEnabled = config.enableSkyboxFog !== undefined ? !!config.enableSkyboxFog : !!presetDefaults.enableSkyboxFog;
      
      if (isFogEnabled) {
        const fogColor = config.fogColor || presetDefaults.fogColor || "#87ceeb";
        const fogNear = config.fogNear !== undefined ? Number(config.fogNear) : (presetDefaults.fogNear ?? 10);
        const fogFar = config.fogFar !== undefined ? Number(config.fogFar) : (presetDefaults.fogFar ?? 50);
        this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
      } else {
        this.scene.fog = null;
      }
    }

    // 3. Dynamic Ciclo Día/Noche o presets de luces
    let sunIntensity = visualConfig.sunIntensity !== undefined ? Number(visualConfig.sunIntensity) : 0.8;
    let sunColor = visualConfig.sunColor || "#ffffff";
    let ambientIntensity = visualConfig.ambientIntensity !== undefined ? Number(visualConfig.ambientIntensity) : 0.6;
    let ambientColor = visualConfig.ambientColor || "#ffffff";
    let sunElevation = visualConfig.sunElevation !== undefined ? Number(visualConfig.sunElevation) : 45; // Degrees
    let sunAzimuth = visualConfig.sunAzimuth !== undefined ? Number(visualConfig.sunAzimuth) : 180;
    const solarPathActive = config.solarPathEnabled !== false;
    const solarTime = config.timeOfDay !== undefined ? Number(config.timeOfDay) : 12;
    const solarVisualPosition = calculateSolarCyclePosition(config, solarTime);

    if (isDynamicCycle && interpolated) {
      sunIntensity = visualConfig.sunIntensity;
      sunColor = visualConfig.sunColor;
      ambientIntensity = visualConfig.ambientIntensity;
      ambientColor = visualConfig.ambientColor;
      sunElevation = visualConfig.sunElevation;
      sunAzimuth = visualConfig.sunAzimuth;
      this.scene.environmentIntensity = visualConfig.environmentIntensity;
      this.scene.backgroundIntensity = visualConfig.backgroundIntensity;
    } else if (lightMode === "cycle") {
      const solarPosition = calculateSolarCyclePosition(config, solarTime);
      sunElevation = solarPosition.sunElevation;
      sunAzimuth = solarPosition.sunAzimuth;
      
      const isNight = sunElevation < -5;
      const isGoldenHour = sunElevation >= -5 && sunElevation <= 15;
      
      if (isNight) {
        sunIntensity = 0.05;
        sunColor = "#8899bb";
        ambientIntensity = 0.05;
        ambientColor = "#111122";
      } else if (isGoldenHour) {
        const factor = (sunElevation + 5) / 20;
        sunIntensity = 0.1 + factor * 0.5;
        const cSun = new THREE.Color("#ff5722").lerp(new THREE.Color("#ffffff"), factor);
        sunColor = "#" + cSun.getHexString();
        const cAmbient = new THREE.Color("#33235f").lerp(new THREE.Color("#8899bb"), factor);
        ambientIntensity = 0.1 + factor * 0.4;
        ambientColor = "#" + cAmbient.getHexString();
      } else {
        const factor = (sunElevation - 15) / 75;
        sunIntensity = 0.6 + factor * 0.4;
        sunColor = "#ffffff";
        ambientIntensity = 0.5 + factor * 0.2;
        ambientColor = "#ffffff";
      }
    } else if (lightMode === "night" && !isSkyboxActive) {
      sunIntensity = 0.05;
      sunColor = "#8899bb";
      ambientIntensity = 0.05;
      ambientColor = "#111122";
      sunElevation = -30;
    } else if (lightMode === "sunset" && !isSkyboxActive) {
      sunIntensity = 0.5;
      sunColor = "#ff8f70";
      ambientIntensity = 0.3;
      ambientColor = "#33235f";
      sunElevation = 8;
    } else {
      // Skybox mode, custom mode or standard mode: ALWAYS respect user/preset config
      sunIntensity = visualConfig.sunIntensity !== undefined ? Number(visualConfig.sunIntensity) : 0.8;
      sunColor = visualConfig.sunColor || "#ffffff";
      ambientIntensity = visualConfig.ambientIntensity !== undefined ? Number(visualConfig.ambientIntensity) : 0.6;
      ambientColor = visualConfig.ambientColor || "#ffffff";
      sunElevation = visualConfig.sunElevation !== undefined ? Number(visualConfig.sunElevation) : 45;
      sunAzimuth = visualConfig.sunAzimuth !== undefined ? Number(visualConfig.sunAzimuth) : 180;
    }

    if (solarPathActive && (isDynamicCycle || config.timeOfDay !== undefined || lightMode === "cycle")) {
      const solarPosition = calculateSolarCyclePosition(config, solarTime);
      sunElevation = solarPosition.sunElevation;
      sunAzimuth = solarPosition.sunAzimuth;
    }

    // Star Visibility Evaluation
    if (this.stars) {
      if (isDynamicCycle && interpolated) {
        this.stars.visible = !!visualConfig.enableStars;
      } else if (isSkyboxActive) {
        // Skybox mode: controlled by enableStarsSkybox flag
        this.stars.visible = !!config.enableStarsSkybox;
      } else if (lightMode === "cycle") {
        // Dynamic cycle mode: stars enabled at night unless enableStarsCycle is false
        const isNightTime = sunElevation < 0;
        this.stars.visible = isNightTime && (config.enableStarsCycle !== false);
      } else if (lightMode === "night" || skyType === "night") {
        // Night mode: stars enabled unless enableStarsNight is false
        this.stars.visible = config.enableStarsNight !== false;
      } else if (lightMode === "custom") {
        const isNightTime = sunElevation < 0;
        this.stars.visible = isNightTime && (config.enableStarsNight !== false);
      } else {
        // Day / Sunset default
        this.stars.visible = false;
      }
    }

    // Apply values to Lights
    if (this.ambientLight) {
      const isAmbientEnabled = visualConfig.enableAmbientLight !== false;
      this.ambientLight.visible = isAmbientEnabled;
      this.ambientLight.intensity = isAmbientEnabled ? ambientIntensity : 0;
      this.ambientLight.color.set(ambientColor);
    }
    if (this.dirLight) {
      const isSunEnabled = visualConfig.enableSunLight !== false;
      this.dirLight.visible = isSunEnabled;
      this.dirLight.intensity = isSunEnabled ? sunIntensity : 0;
      this.dirLight.color.set(sunColor);
    }

    // Update Sun Position Vector for Sky shader & light direction
    const phi = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);
    this.sunVec.setFromSphericalCoords(1, phi, theta);
    
    if (isShaderSky && this.skyMesh) {
      this.skyMesh.material.uniforms["sunPosition"].value.copy(this.sunVec);
    }

    this.sunMoonVisual.setState(this.sunVec, {
      enabled: config.enableSolarVisual !== false,
      useShaderSky: isShaderSky && !!this.skyMesh?.visible,
      sunIntensity,
      dayProgress: solarVisualPosition.dayProgress,
      sunIsDay: solarVisualPosition.isDay,
      sunSizeSunrise: config.solarVisualSunriseSize ?? DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualSunriseSize,
      sunSizeNoon: config.solarVisualNoonSize ?? DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualNoonSize,
      sunSizeSunset: config.solarVisualSunsetSize ?? DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualSunsetSize,
      moonSize: config.solarVisualMoonSize ?? DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualMoonSize,
      sunColorSunrise: config.solarVisualSunriseColor || DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualSunriseColor,
      sunColorNoon: config.solarVisualNoonColor || DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualNoonColor,
      sunColorSunset: config.solarVisualSunsetColor || DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualSunsetColor,
      moonColor: config.solarVisualMoonColor || DEFAULT_SOLAR_VISUAL_SETTINGS.solarVisualMoonColor
    });
  }

  updateShadowFollow(playerPos: any) {
    if (!playerPos) return;

    // Follow player with stars dome so stars stay distant overhead in all directions
    if (this.stars && this.stars.visible) {
      this.stars.position.set(playerPos.x, playerPos.y, playerPos.z);
    }

    if (!this.dirLight || !this.dirLight.castShadow) return;

    const renderDistance = this.currentRenderDistance || 100;
    const offsetDistance = Math.max(120, renderDistance * 1.5);
    
    let lightDirection = this.sunVec;
    if (this.sunVec.y < 0) {
      // Invert light direction at night to act as moonlight coming from above ground
      lightDirection = new THREE.Vector3().copy(this.sunVec).negate();
    }
    
    this.dirLight.position.copy(lightDirection).multiplyScalar(offsetDistance).add(playerPos);
    
    // Ensure dirLight target matches player position
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();
  }

  update() {
    if (this.skyboxTransitionMesh && this.skyboxTransitionMesh.visible) {
      this.skyboxTransitionMesh.position.copy(this.camera.position);
    }
    this.sunMoonVisual.updateCameraPosition();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this.boundResize);
    this.sunMoonVisual.dispose();

    this.scene.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material: any) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    this.loadedSkyboxTextures.forEach((texture) => texture.dispose());
    this.loadedSkyboxTextures.clear();
    this.skyboxCache.clear();
    if (this.skyboxTransitionMesh) {
      this.skyboxTransitionMesh.geometry.dispose();
      this.skyboxTransitionMesh.material.dispose();
      this.skyboxTransitionMesh = null;
      this.skyboxTransitionMaterial = null;
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

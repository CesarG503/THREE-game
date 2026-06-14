import * as THREE from "three";

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
  private boundResize: () => void;
  private skyboxCache: Map<string, Promise<THREE.CubeTexture>>;
  private loadedSkyboxTextures: Set<THREE.CubeTexture>;
  private activeSkyboxTexture: THREE.CubeTexture | null;
  private skyboxRequestId: number;

  constructor(containerId: any) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    this.scene.environment = null;
    this.skyboxCache = new Map();
    this.loadedSkyboxTextures = new Set();
    this.activeSkyboxTexture = null;
    this.skyboxRequestId = 0;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);

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
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    });

    const starVertices = [];
    for (let i = 0; i < 2000; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 100 + 50;
      const z = (Math.random() - 0.5) * 200;
      starVertices.push(x, y, z);
    }

    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  setSky(type: any) {
    const skyType = type || "day";
    const requestId = ++this.skyboxRequestId;

    this.applyDefaultLighting();

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
      if (this.stars) this.stars.visible = true;
    } else if (type === "sunset") {
      const sunsetColor = 0xffae88;
      this.scene.background = new THREE.Color(sunsetColor);
      this.scene.fog = new THREE.Fog(sunsetColor, 10, 60);
      if (this.stars) this.stars.visible = false;
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
      if (this.stars) this.stars.visible = false;
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
    if (this.stars) this.stars.visible = false;
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

  update() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this.boundResize);

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

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

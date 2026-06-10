import * as THREE from "three";

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

  constructor(containerId: any) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

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

    const grid = new THREE.GridHelper(100, 20, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

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

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

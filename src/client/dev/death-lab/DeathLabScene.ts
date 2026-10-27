import * as THREE from "three";

export interface ArticulatedLimb {
  group: THREE.Group;
  mesh: THREE.Mesh;
}

export interface ArticulatedPlayer {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  helmet: THREE.Mesh;
  visor: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  equippedWeapon: THREE.Group;
  materials: {
    skin: THREE.MeshStandardMaterial;
    suit: THREE.MeshStandardMaterial;
    armor: THREE.MeshStandardMaterial;
    visor: THREE.MeshBasicMaterial;
  };
  setPose: (progress: number) => void;
}

export class DeathLabScene {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  private clock: THREE.Clock;

  // 3D Scene Actors
  public playerGroup: THREE.Group;
  public playerActor!: ArticulatedPlayer;
  public killerActor!: THREE.Group;
  public sniperLaser!: THREE.Line;
  public teammateGroup: THREE.Group;
  public droppedWeapon: THREE.Group;
  public shockwaveMesh!: THREE.Mesh;
  public glitchGhostR!: THREE.Group;
  public glitchGhostC!: THREE.Group;

  // Particles
  public particleSystem: THREE.Points | null = null;
  public particleGeometry: THREE.BufferGeometry | null = null;
  public particleType: "embers" | "confetti" | "sparks" | "warp" | "matrix" | "none" = "none";
  private particleVelocities: Float32Array | null = null;
  public particlesEnabled: boolean = true;

  // Lighting
  public dirLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public accentLight: THREE.PointLight;

  // Camera Behaviors
  public cameraMode: "timeline" | "orbit" | "shake" | "zoom_face" | "spectator_3p" | "spectator_1p" = "timeline";
  public cameraBasePos: THREE.Vector3 = new THREE.Vector3(0, 1.8, 4.5);
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);
  public spectatorTargetPos: THREE.Vector3 = new THREE.Vector3(14, 1.2, -10);
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.92;
  private orbitAngle: number = 0;
  private orbitSpeed: number = 0.15;

  constructor(containerId: string) {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      document.body.appendChild(el);
    }
    this.container = el;
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: 1;
      pointer-events: none;
      background: #060913;
    `;

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.025);

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    this.camera.position.copy(this.cameraBasePos);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.cssText = "width:100%; height:100%; display:block;";
    this.container.appendChild(this.renderer.domElement);

    // Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    this.dirLight.position.set(8, 16, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.accentLight = new THREE.PointLight(0x10b981, 2.5, 20);
    this.accentLight.position.set(-3, 2.5, 2);
    this.scene.add(this.accentLight);

    // Build Environment
    this.buildArenaEnvironment();

    // Build 3D Articulated Operative
    this.playerActor = this.createArticulatedPlayer();
    this.playerGroup = this.playerActor.root;
    this.scene.add(this.playerGroup);

    // Build Ground Dropped Weapon
    this.droppedWeapon = this.createDroppedWeapon();
    this.scene.add(this.droppedWeapon);

    // Build Killer Actor on Sniper Vantage Point
    this.killerActor = this.createKillerActor();
    this.scene.add(this.killerActor);

    // Build Teammate
    this.teammateGroup = this.createLiveTeammate();
    this.scene.add(this.teammateGroup);

    // Build 3D Shockwave Mesh
    this.buildShockwaveMesh();

    // Build Chromatic 3D Glitch Clones
    this.buildGlitchGhosts();

    // Resize listener
    window.addEventListener("resize", this.onResize);

    // Start render loop
    this.startLoop();
  }

  private buildArenaEnvironment() {
    // Arena floor
    const floorGeo = new THREE.PlaneGeometry(100, 100, 50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x070c18,
      roughness: 0.85,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle tactical floor grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x10b981, 0x1e293b);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Tactical vantage pillars and obstacles
    const pillarGeo = new THREE.BoxGeometry(2, 7, 2);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.5,
    });

    const pillars = [
      [-10, 3.5, -14], [10, 3.5, -16], [-16, 3.5, 6], [16, 3.5, 6],
      [-7, 3.5, 12], [12, 3.5, 14], [0, 4, -22]
    ];
    pillars.forEach(([x, y, z]) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(x, y, z);
      p.castShadow = true;
      p.receiveShadow = true;
      this.scene.add(p);
    });

    // Elevated Sniper Tower Platform where killer perches
    const towerGeo = new THREE.BoxGeometry(4, 4.5, 4);
    const tower = new THREE.Mesh(towerGeo, pillarMat);
    tower.position.set(9, 2.25, -17);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
  }

  private createArticulatedPlayer(): ArticulatedPlayer {
    const root = new THREE.Group();
    root.position.set(0, 0, 0);

    const skin = new THREE.MeshStandardMaterial({ color: 0xe2a878, roughness: 0.7 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x0b111e, roughness: 0.55 });
    const armor = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.4 });
    const visor = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Pelvis (root of body kinetics)
    const pelvis = new THREE.Group();
    pelvis.position.y = 1.05;
    root.add(pelvis);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.75, 0.9, 0.42);
    const torso = new THREE.Mesh(torsoGeo, armor);
    torso.position.y = 0.45;
    torso.castShadow = true;
    pelvis.add(torso);

    // Head with tactical helmet and visor
    const head = new THREE.Group();
    head.position.y = 1.0;
    pelvis.add(head);

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), suit);
    helmet.castShadow = true;
    head.add(helmet);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), visor);
    visorMesh.position.set(0, 0.05, -0.24);
    head.add(visorMesh);

    // Arms
    const limbGeo = new THREE.BoxGeometry(0.24, 0.72, 0.24);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.52, 0.75, 0);
    const lArmMesh = new THREE.Mesh(limbGeo, suit);
    lArmMesh.position.y = -0.36;
    lArmMesh.castShadow = true;
    leftArm.add(lArmMesh);
    pelvis.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.52, 0.75, 0);
    const rArmMesh = new THREE.Mesh(limbGeo, suit);
    rArmMesh.position.y = -0.36;
    rArmMesh.castShadow = true;
    rightArm.add(rArmMesh);
    pelvis.add(rightArm);

    // Equipped weapon held in right hand
    const equippedWeapon = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.75), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    equippedWeapon.add(gunBody);
    equippedWeapon.position.set(0, -0.65, -0.25);
    equippedWeapon.rotation.set(-Math.PI / 4, 0, 0);
    rightArm.add(equippedWeapon);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.24, 0, 0);
    const lLegMesh = new THREE.Mesh(legGeo, suit);
    lLegMesh.position.y = -0.42;
    lLegMesh.castShadow = true;
    leftLeg.add(lLegMesh);
    pelvis.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.24, 0, 0);
    const rLegMesh = new THREE.Mesh(legGeo, suit);
    rLegMesh.position.y = -0.42;
    rLegMesh.castShadow = true;
    rightLeg.add(rLegMesh);
    pelvis.add(rightLeg);

    // Kinematic Pose Solver: seamlessly maps progress [0..1] to full physics collapse
    const setPose = (progress: number) => {
      const p = Math.max(0, Math.min(1, progress));

      if (p <= 0.05) {
        // Stance: Combat ready
        pelvis.position.set(0, 1.05, 0);
        pelvis.rotation.set(0, 0, 0);
        torso.rotation.set(0, 0, 0);
        head.rotation.set(0, 0, 0);
        leftArm.rotation.set(0.5, 0.3, 0.2);
        rightArm.rotation.set(-0.8, -0.2, 0.1);
        leftLeg.rotation.set(-0.1, 0, 0);
        rightLeg.rotation.set(0.15, 0, 0.1);
        equippedWeapon.visible = true;
      } else if (p < 0.35) {
        // Violent chest impact flinch
        const t = (p - 0.05) / 0.3;
        pelvis.position.set(0, 1.05 - t * 0.2, -t * 0.3);
        pelvis.rotation.set(-t * 0.5, t * 0.2, t * 0.1);
        head.rotation.set(-t * 0.7, t * 0.4, 0);
        leftArm.rotation.set(0.5 + t * 0.8, 0, t * 0.9);
        rightArm.rotation.set(-0.8 - t * 0.5, 0, -t * 1.0);
        leftLeg.rotation.set(-0.1 + t * 0.4, 0, -t * 0.2);
        rightLeg.rotation.set(0.15 + t * 0.3, 0, t * 0.3);
        equippedWeapon.visible = t < 0.5;
      } else {
        // Full ground collapse & sprawl
        const t = (p - 0.35) / 0.65;
        equippedWeapon.visible = false;
        pelvis.position.set(
          -t * 0.15,
          0.85 - t * 0.72,
          -0.3 - t * 0.35
        );
        pelvis.rotation.set(
          -0.5 - t * (Math.PI / 2 - 0.6),
          0.2 + t * 0.15,
          0.1 + t * 0.25
        );
        head.rotation.set(-0.7 + t * 0.5, 0.4 + t * 0.1, t * 0.2);
        leftArm.rotation.set(1.3 - t * 0.6, 0, 0.9 + t * 0.3);
        rightArm.rotation.set(-1.3 + t * 0.4, 0, -1.0 - t * 0.3);
        leftLeg.rotation.set(0.3 + t * (Math.PI / 2 - 0.5), 0, -0.2);
        rightLeg.rotation.set(0.45 + t * (Math.PI / 2 - 0.35), 0, 0.3);
      }
    };

    setPose(0); // Start standing

    return {
      root,
      pelvis,
      torso,
      head,
      helmet,
      visor: visorMesh,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      equippedWeapon,
      materials: { skin, suit, armor, visor },
      setPose,
    };
  }

  private createDroppedWeapon(): THREE.Group {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.8), gunMat);
    barrel.castShadow = true;
    group.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.18), gunMat);
    mag.position.set(0, -0.2, 0.05);
    group.add(mag);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), accentMat);
    sight.position.set(0, 0.11, -0.1);
    group.add(sight);

    group.position.set(0.3, 1.0, -0.2);
    group.visible = false;
    return group;
  }

  private createKillerActor(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(9, 4.5, -17);
    group.rotation.y = Math.PI + 0.5;

    const killerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // Standing sniper silhouette
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), killerMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), killerMat);
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.1), eyeMat);
    eye.position.set(0, 2.05, -0.24);
    group.add(eye);

    // Sniper rifle
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 1.4), killerMat);
    rifle.position.set(-0.25, 1.6, -0.6);
    rifle.rotation.x = -0.1;
    group.add(rifle);

    // Red laser sight pointing toward player location
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.6, -1.2),
      new THREE.Vector3(-9, -3.2, 17) // Points directly to player origin
    ]);
    this.sniperLaser = new THREE.Line(laserGeo, laserMat);
    group.add(this.sniperLaser);

    return group;
  }

  private createLiveTeammate(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b0, roughness: 0.6 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), bodyMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);

    group.position.copy(this.spectatorTargetPos);
    group.rotation.y = -Math.PI / 4;
    return group;
  }

  private buildShockwaveMesh() {
    const geo = new THREE.RingGeometry(0.8, 1.05, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.shockwaveMesh = new THREE.Mesh(geo, mat);
    this.shockwaveMesh.rotation.x = -Math.PI / 2;
    this.shockwaveMesh.position.set(0, 0.04, 0);
    this.scene.add(this.shockwaveMesh);
  }

  private buildGlitchGhosts() {
    // Red ghost
    this.glitchGhostR = new THREE.Group();
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0, wireframe: true });
    const rTorso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.42), redMat);
    rTorso.position.y = 1.4;
    this.glitchGhostR.add(rTorso);
    this.glitchGhostR.visible = false;
    this.scene.add(this.glitchGhostR);

    // Cyan ghost
    this.glitchGhostC = new THREE.Group();
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0, wireframe: true });
    const cTorso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.42), cyanMat);
    cTorso.position.y = 1.4;
    this.glitchGhostC.add(cTorso);
    this.glitchGhostC.visible = false;
    this.scene.add(this.glitchGhostC);
  }

  public setParticles(type: "embers" | "confetti" | "sparks" | "warp" | "matrix" | "none") {
    this.particleType = type;
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.Material).dispose();
      this.particleSystem = null;
    }

    if (type === "none" || !this.particlesEnabled) return;

    const count = type === "matrix" ? 800 : type === "confetti" ? 600 : 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.particleVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * 20;
      positions[idx + 1] = Math.random() * 8;
      positions[idx + 2] = (Math.random() - 0.5) * 20;

      if (type === "embers") {
        colors[idx] = 1.0;
        colors[idx + 1] = 0.2 + Math.random() * 0.4;
        colors[idx + 2] = 0.05;
        this.particleVelocities[idx + 1] = 0.4 + Math.random() * 0.6;
      } else if (type === "confetti") {
        const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;
        this.particleVelocities[idx + 1] = -0.6 - Math.random() * 0.8;
      } else if (type === "sparks") {
        colors[idx] = 0.1;
        colors[idx + 1] = 0.8 + Math.random() * 0.2;
        colors[idx + 2] = 1.0;
        this.particleVelocities[idx + 1] = (Math.random() - 0.5) * 1.5;
      } else if (type === "warp") {
        colors[idx] = 0.7;
        colors[idx + 1] = 0.2;
        colors[idx + 2] = 1.0;
        this.particleVelocities[idx + 2] = 3.0 + Math.random() * 3.0;
      } else if (type === "matrix") {
        colors[idx] = 0.1;
        colors[idx + 1] = 0.95;
        colors[idx + 2] = 0.3;
        this.particleVelocities[idx + 1] = -1.5 - Math.random() * 2.0;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: type === "confetti" ? 0.35 : 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: type === "confetti" ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  public toggleParticles(enabled?: boolean): boolean {
    this.particlesEnabled = enabled !== undefined ? enabled : !this.particlesEnabled;
    if (!this.particlesEnabled && this.particleSystem) {
      this.particleSystem.visible = false;
    } else if (this.particlesEnabled && this.particleSystem) {
      this.particleSystem.visible = true;
    }
    return this.particlesEnabled;
  }

  public setVariantVisuals(variantId: string) {
    // Reset poses and visibility
    this.playerActor.setPose(0);
    this.droppedWeapon.visible = false;
    this.shockwaveMesh.scale.set(1, 1, 1);
    (this.shockwaveMesh.material as THREE.Material).opacity = 0;
    this.glitchGhostR.visible = false;
    this.glitchGhostC.visible = false;
    this.cameraMode = "timeline";

    switch (variantId) {
      case "v01_tactical":
        this.scene.fog = new THREE.FogExp2(0x0c121e, 0.03);
        this.ambientLight.color.setHex(0x94a3b8);
        this.ambientLight.intensity = 0.35;
        this.dirLight.color.setHex(0xf1f5f9);
        this.dirLight.intensity = 1.2;
        this.accentLight.color.setHex(0xef4444);
        this.accentLight.position.set(0, 1.5, 0);
        this.setParticles("none");
        break;

      case "v02_battle_royale":
        this.scene.fog = new THREE.FogExp2(0x180d2e, 0.015);
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.8;
        this.dirLight.color.setHex(0xfef08a);
        this.accentLight.color.setHex(0xf43f5e);
        this.shockwaveMesh.material = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        this.setParticles("confetti");
        break;

      case "v04_cyberpunk":
        this.scene.fog = new THREE.FogExp2(0x040410, 0.035);
        this.ambientLight.color.setHex(0x06b6d4);
        this.ambientLight.intensity = 0.4;
        this.dirLight.color.setHex(0xff0055);
        this.accentLight.color.setHex(0x00f0ff);
        this.setParticles("matrix");
        break;

      case "v16_viper_signature":
      default:
        this.scene.fog = new THREE.FogExp2(0x050c10, 0.025);
        this.ambientLight.color.setHex(0x10b981);
        this.ambientLight.intensity = 0.45;
        this.dirLight.color.setHex(0xecfdf5);
        this.accentLight.color.setHex(0x06b6d4);
        this.accentLight.position.set(-2, 2.5, 1);
        this.shockwaveMesh.material = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        this.setParticles("sparks");
        break;
    }
  }

  public transitionToSpectator(perspective: "first_person" | "third_person" = "third_person") {
    this.cameraMode = perspective === "first_person" ? "spectator_1p" : "spectator_3p";
  }

  public resetToDeathCamera() {
    this.cameraMode = "timeline";
    this.camera.position.copy(this.cameraBasePos);
    this.camera.lookAt(this.cameraTarget);
  }

  private onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startLoop() {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Animate Particles
      if (this.particlesEnabled && this.particleSystem && this.particleGeometry && this.particleVelocities) {
        const positions = this.particleGeometry.attributes.position.array as Float32Array;
        const count = positions.length / 3;
        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          positions[idx + 1] += this.particleVelocities[idx + 1] * delta;
          if (positions[idx + 1] > 12) positions[idx + 1] = 0;
          if (positions[idx + 1] < 0) positions[idx + 1] = 10;
        }
        this.particleGeometry.attributes.position.needsUpdate = true;
      }

      // Idle sniper laser flicker
      if (this.sniperLaser && this.sniperLaser.material) {
        (this.sniperLaser.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(elapsed * 12) * 0.25;
      }

      // In "timeline" mode: Anime.js has 100% full directorial command over the camera.
      // Only run automated procedural lerps if user switched to spectator modes or passive idle.
      switch (this.cameraMode) {
        case "spectator_3p":
          const target3p = new THREE.Vector3(
            this.teammateGroup.position.x + 2.5,
            this.teammateGroup.position.y + 2.8,
            this.teammateGroup.position.z + 4.5
          );
          this.camera.position.lerp(target3p, delta * 3.5);
          this.camera.lookAt(this.teammateGroup.position.x, this.teammateGroup.position.y + 1.4, this.teammateGroup.position.z);
          break;

        case "spectator_1p":
          const target1p = new THREE.Vector3(
            this.teammateGroup.position.x,
            this.teammateGroup.position.y + 2.0,
            this.teammateGroup.position.z - 0.3
          );
          this.camera.position.lerp(target1p, delta * 4.0);
          this.camera.lookAt(
            this.teammateGroup.position.x,
            this.teammateGroup.position.y + 2.0,
            this.teammateGroup.position.z - 10
          );
          break;

        case "orbit":
          this.orbitAngle += this.orbitSpeed * delta;
          const radius = 4.8;
          this.camera.position.x = Math.sin(this.orbitAngle) * radius;
          this.camera.position.z = Math.cos(this.orbitAngle) * radius;
          this.camera.position.y = 1.8 + Math.sin(this.orbitAngle * 0.5) * 0.3;
          this.camera.lookAt(this.cameraTarget);
          break;

        case "timeline":
        default:
          // Directorial mode: camera position & lookAt managed exclusively by Anime.js timeline
          break;
      }

      this.renderer.render(this.scene, this.camera);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  public dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.container.remove();
  }
}

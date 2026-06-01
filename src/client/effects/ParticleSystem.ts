import * as THREE from "three";
import {
  BatchedParticleRenderer,
  ParticleSystem as QParticleSystem,
  IntervalValue,
  ConstantValue,
  ColorRange,
  PointEmitter,
  SphereEmitter,
  RenderMode,
  ColorOverLife,
  PiecewiseBezier,
  SizeOverLife,
  Vector3,
  Vector4,
  ConeEmitter,
  QuarksLoader,
  QuarksUtil,
  Bezier
} from "three.quarks";

export class ParticleSystem {
  scene: any;
  batchRenderer: any;
  jumpMaterial: THREE.MeshBasicMaterial;
  impactMaterial: THREE.MeshBasicMaterial;
  explosionMaterial: THREE.MeshBasicMaterial;
  loader: QuarksLoader;
  vfxCache: Record<string, any>;
  activeSystems: any[];

  constructor(scene: any) {
    this.scene = scene;

    // Quarks Batch Renderer
    this.batchRenderer = new BatchedParticleRenderer();
    this.scene.add(this.batchRenderer);

    // Caches para materiales
    this.jumpMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.impactMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.explosionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Custom VFX Cache and Loader
    this.loader = new QuarksLoader();
    this.vfxCache = {};

    // Preload custom VFX
    this.preloadVFX("/assets/VFX/Bubble Explosion VFX.json", "Bubble Explosion");
    this.preloadVFX("/assets/VFX/Cartoon Bang VFX.json", "Cartoon Bang");
    this.preloadVFX("/assets/VFX/Cartoon Blue Flamethrower VFX.json", "Cartoon Blue Flamethrower");
    this.preloadVFX("/assets/VFX/Dollar Bill Shower VFX.json", "Dollar Bill Shower");
    this.preloadVFX("/assets/VFX/Cartoon Lightning Ball VFX.json", "Cartoon Lightning Ball");
    this.preloadVFX("/assets/VFX/Cartoon Blood Splash VFX.json", "Cartoon Blood Splash");
    this.preloadVFX("/assets/VFX/Cartoon Fireball Explosion.json", "Cartoon Fireball Explosion");
    this.preloadVFX("/assets/VFX/Cartoon Purple Lightning Strike.json", "Cartoon Purple Lightning");
    this.preloadVFX("/assets/VFX/Explosión de Gas Azul Cartoon.json", "Explosión de Gas Azul");

    // Lista de sistemas activos para limpieza si es necesario
    this.activeSystems = [];

    // Static test spawn to verify rendering
    setTimeout(() => {
      console.log("[VFX] Spawning test static Cartoon Bang...");
      this.spawnLoadedEffect("Cartoon Bang", new THREE.Vector3(0, 5, 0), null, null, false);
    }, 5000);
  }

  preloadVFX(path: any, name: any) {
    fetch(path)
      .then((res) => res.json())
      .then((json) => {
        this.vfxCache[name] = json;
        console.log(`Preloaded VFX: ${name}`);
      })
      .catch((err) => console.error(`Failed to preload VFX ${name}:`, err));
  }

  spawnLoadedEffect(effectName: any, position: any, parent: any = null, rotation: any = null, autoCleanup = true, cleanupTime = 2000) {
    const rawJson = this.vfxCache[effectName];
    if (!rawJson) {
      console.error(`[VFX] Effect not found in cache: ${effectName}`);
      return null;
    }

    console.log(`[VFX] Spawning effect: ${effectName}`);

    const json = JSON.parse(JSON.stringify(rawJson));

    if (json.object) {
      delete json.object.backgroundRotation;
      delete json.object.environmentRotation;
    }

    const wrapper = new THREE.Group();
    if (position && !parent) wrapper.position.copy(position);
    if (rotation) wrapper.quaternion.copy(rotation);

    if (parent) {
      parent.add(wrapper);
      if (position) wrapper.position.copy(position);
    } else {
      this.scene.add(wrapper);
    }

    try {
      this.loader.parse(json, (effect: any) => {
        if (wrapper.userData.isDestroyed) return;
        console.log(`[VFX] Successfully parsed ${effectName}`);
        QuarksUtil.addToBatchRenderer(effect, this.batchRenderer);
        QuarksUtil.play(effect);
        wrapper.add(effect);
        wrapper.userData.effectRoot = effect;

        if (wrapper.userData.stopEmission) {
          this.stopLoadedEffectEmission(wrapper);
        }

        if (autoCleanup && !parent) {
          setTimeout(() => {
            this.destroyLoadedEffect(wrapper);
          }, cleanupTime);
        }
      });
    } catch (e) {
      console.error(`[VFX] Error parsing effect ${effectName}:`, e);
    }

    return wrapper;
  }

  stopLoadedEffectEmission(wrapper: any) {
    if (!wrapper) return;
    wrapper.userData.stopEmission = true;
    if (!wrapper.userData.effectRoot) return;

    QuarksUtil.runOnAllParticleEmitters(wrapper.userData.effectRoot, (ps: any) => {
      if (ps.system) {
        if (typeof ps.system.endEmit === "function") {
          ps.system.endEmit();
        } else {
          ps.system.emissionOverTime = new ConstantValue(0);
          if (ps.system.emissionBursts) {
            ps.system.emissionBursts = [];
          }
        }
      }
    });
  }

  destroyLoadedEffect(wrapper: any) {
    if (!wrapper) return;

    wrapper.userData.isDestroyed = true;

    if (wrapper.parent) wrapper.parent.remove(wrapper);
    wrapper.removeFromParent();

    if (wrapper.userData.effectRoot) {
      QuarksUtil.runOnAllParticleEmitters(wrapper.userData.effectRoot, (ps: any) => {
        if (ps.system) {
          try {
            this.batchRenderer.deleteSystem(ps.system);
          } catch (e) {
            console.warn("Could not delete particle system", e);
          }
        }
      });
      wrapper.userData.effectRoot.visible = false;
    }
  }

  _addSystem(system: any) {
    this.batchRenderer.addSystem(system);
    this.scene.add(system.emitter);
    this.activeSystems.push(system);

    setTimeout(() => {
      this.scene.remove(system.emitter);
      this.batchRenderer.deleteSystem(system);
      this.activeSystems = this.activeSystems.filter((s: any) => s !== system);
    }, (system.duration + (system.startLife.b || system.startLife.a)) * 1000 + 100);
  }

  spawnJumpEffect(position: any) {
    const system = new QParticleSystem({
      duration: 1,
      looping: false,
      startLife: new IntervalValue(0.4, 0.8),
      startSpeed: new IntervalValue(2, 5),
      startSize: new IntervalValue(0.1, 0.3),
      startColor: new ColorRange(new Vector4(1, 1, 1, 1), new Vector4(0.8, 0.8, 0.8, 0.5)),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [
        {
          time: 0,
          count: new ConstantValue(15),
          cycle: 1,
          interval: 0.01,
          probability: 1
        }
      ],
      shape: new PointEmitter(),
      material: this.jumpMaterial,
      renderMode: RenderMode.BillBoard
    });

    system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.66, 0.33, 0), 0]])));

    system.emitter.position.copy(position).add(new THREE.Vector3(0, -0.4, 0));

    this._addSystem(system);
  }

  spawnImpactEffect(position: any, normal: any = new THREE.Vector3(0, 1, 0)) {
    const system = new QParticleSystem({
      duration: 0.5,
      looping: false,
      startLife: new IntervalValue(0.2, 0.5),
      startSpeed: new IntervalValue(5, 15),
      startSize: new IntervalValue(0.05, 0.15),
      startColor: new ColorRange(new Vector4(1, 0.8, 0.2, 1), new Vector4(1, 0.2, 0, 1)),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [
        {
          time: 0,
          count: new ConstantValue(10),
          cycle: 1,
          interval: 0.01,
          probability: 1
        }
      ],
      shape: new ConeEmitter({
        radius: 0.1,
        angle: 0.5,
        thickness: 1,
        arc: Math.PI * 2
      }),
      material: this.impactMaterial,
      renderMode: RenderMode.StretchedBillBoard,
      speedFactor: 0.05
    });

    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    system.emitter.quaternion.copy(quaternion);

    system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.66, 0.33, 0), 0]])));

    system.emitter.position.copy(position);

    this._addSystem(system);
  }

  spawnExplosionEffect(position: any) {
    const system = new QParticleSystem({
      duration: 1.5,
      looping: false,
      startLife: new IntervalValue(0.5, 1.2),
      startSpeed: new IntervalValue(5, 20),
      startSize: new IntervalValue(0.5, 1.5),
      startColor: new ColorRange(new Vector4(1, 0.5, 0, 1), new Vector4(0.2, 0.2, 0.2, 0)),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [
        {
          time: 0,
          count: new ConstantValue(40),
          cycle: 1,
          interval: 0.01,
          probability: 1
        }
      ],
      shape: new SphereEmitter({
        radius: 0.5,
        thickness: 1
      }),
      material: this.explosionMaterial,
      renderMode: RenderMode.BillBoard
    });

    system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.66, 0.33, 0), 0]])));

    system.emitter.position.copy(position);

    this._addSystem(system);
  }

  spawnJetpackEffect(position: any, normal: any = new THREE.Vector3(0, -1, 0), vfxType: string = "Humo y Fuego") {
    if (vfxType === "Ninguno") return;

    const showSmoke = vfxType === "Humo y Fuego" || vfxType === "Sólo Humo";
    const showFire = vfxType === "Humo y Fuego" || vfxType === "Sólo Fuego";
    const showSparks = vfxType === "Chispas";

    if (showFire) {
      const system = new QParticleSystem({
        duration: 0.1,
        looping: false,
        startLife: new IntervalValue(0.1, 0.3),
        startSpeed: new IntervalValue(4, 8),
        startSize: new IntervalValue(0.15, 0.3),
        startColor: new ColorRange(new Vector4(1, 0.8, 0.1, 1), new Vector4(1, 0.1, 0, 0.2)),
        worldSpace: true,
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          {
            time: 0,
            count: new ConstantValue(4),
            cycle: 1,
            interval: 0.01,
            probability: 1
          }
        ],
        shape: new ConeEmitter({
          radius: 0.05,
          angle: 0.2,
          thickness: 1,
          arc: Math.PI * 2
        }),
        material: this.impactMaterial,
        renderMode: RenderMode.BillBoard
      });
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      system.emitter.quaternion.copy(quaternion);
      system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.5, 0.2, 0), 0]])));
      system.emitter.position.copy(position);
      this._addSystem(system);
    }

    if (showSmoke) {
      const system = new QParticleSystem({
        duration: 0.2,
        looping: false,
        startLife: new IntervalValue(0.3, 0.6),
        startSpeed: new IntervalValue(2, 5),
        startSize: new IntervalValue(0.15, 0.4),
        startColor: new ColorRange(new Vector4(0.6, 0.6, 0.6, 0.6), new Vector4(0.3, 0.3, 0.3, 0)),
        worldSpace: true,
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          {
            time: 0,
            count: new ConstantValue(3),
            cycle: 1,
            interval: 0.01,
            probability: 1
          }
        ],
        shape: new ConeEmitter({
          radius: 0.1,
          angle: 0.3,
          thickness: 1,
          arc: Math.PI * 2
        }),
        material: this.jumpMaterial,
        renderMode: RenderMode.BillBoard
      });
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      system.emitter.quaternion.copy(quaternion);
      system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(0.5, 1, 1.2, 1.5), 0]])));
      system.emitter.position.copy(position);
      this._addSystem(system);
    }

    if (showSparks) {
      const system = new QParticleSystem({
        duration: 0.1,
        looping: false,
        startLife: new IntervalValue(0.15, 0.45),
        startSpeed: new IntervalValue(6, 12),
        startSize: new IntervalValue(0.02, 0.08),
        startColor: new ColorRange(new Vector4(1, 0.9, 0.5, 1), new Vector4(1, 0.5, 0.1, 0)),
        worldSpace: true,
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          {
            time: 0,
            count: new ConstantValue(6),
            cycle: 1,
            interval: 0.01,
            probability: 1
          }
        ],
        shape: new ConeEmitter({
          radius: 0.02,
          angle: 0.4,
          thickness: 1,
          arc: Math.PI * 2
        }),
        material: this.impactMaterial,
        renderMode: RenderMode.StretchedBillBoard,
        speedFactor: 0.03
      });
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      system.emitter.quaternion.copy(quaternion);
      system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.6, 0.2, 0), 0]])));
      system.emitter.position.copy(position);
      this._addSystem(system);
    }
  }

  update(dt: any) {
    this.batchRenderer.update(dt);
  }

  dispose() {
    if (this.batchRenderer) {
      this.scene.remove(this.batchRenderer);
    }
  }
}

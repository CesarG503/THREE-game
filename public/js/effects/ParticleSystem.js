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
    QuarksUtil
} from "three.quarks";

export class ParticleSystem {
    constructor(scene) {
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
        
        // Lista de sistemas activos para limpieza si es necesario
        this.activeSystems = [];
        
        // Static test spawn to verify rendering
        setTimeout(() => {
            console.log("[VFX] Spawning test static Cartoon Bang...");
            this.spawnLoadedEffect("Cartoon Bang", new THREE.Vector3(0, 5, 0), null, null, false);
        }, 5000);
    }

    preloadVFX(path, name) {
        fetch(path)
            .then(res => res.json())
            .then(json => {
                this.vfxCache[name] = json;
                console.log(`Preloaded VFX: ${name}`);
            })
            .catch(err => console.error(`Failed to preload VFX ${name}:`, err));
    }

    spawnLoadedEffect(effectName, position, parent = null, rotation = null, autoCleanup = true, cleanupTime = 2000) {
        const rawJson = this.vfxCache[effectName];
        if (!rawJson) {
            console.error(`[VFX] Effect not found in cache: ${effectName}`);
            return null;
        }

        console.log(`[VFX] Spawning effect: ${effectName}`);
        
        // Deep copy the JSON to prevent loader mutation, which causes infinite loops/lag
        const json = JSON.parse(JSON.stringify(rawJson));

        // Create a wrapper object that we can return synchronously
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
            this.loader.parse(json, (effect) => {
                console.log(`[VFX] Successfully parsed ${effectName}`);
                QuarksUtil.addToBatchRenderer(effect, this.batchRenderer);
                QuarksUtil.play(effect); // Force play to ensure it emits!
                wrapper.add(effect);
                wrapper.userData.effectRoot = effect;

                if (autoCleanup && !parent) {
                    setTimeout(() => {
                        this.destroyLoadedEffect(wrapper);
                    }, cleanupTime);
                }
            });
        } catch(e) {
            console.error(`[VFX] Error parsing effect ${effectName}:`, e);
        }
        
        return wrapper;
    }

    destroyLoadedEffect(wrapper) {
        if (!wrapper) return;
        
        // Remove from scene or parent
        if (wrapper.parent) wrapper.parent.remove(wrapper);
        
        // Delete systems from batch renderer
        if (wrapper.userData.effectRoot) {
            wrapper.userData.effectRoot.traverse((child) => {
                if (child.type === "ParticleSystem" || child.isParticleSystem) {
                    this.batchRenderer.deleteSystem(child);
                }
            });
        }
    }

    _addSystem(system) {
        this.batchRenderer.addSystem(system);
        this.scene.add(system.emitter);
        this.activeSystems.push(system);
        
        // Auto limpieza (rudimentaria, basada en duración)
        setTimeout(() => {
            this.scene.remove(system.emitter);
            this.batchRenderer.deleteSystem(system);
            this.activeSystems = this.activeSystems.filter(s => s !== system);
        }, (system.duration + (system.startLife.b || system.startLife.a)) * 1000 + 100);
    }

    spawnJumpEffect(position) {
        const system = new QParticleSystem({
            duration: 1,
            looping: false,
            startLife: new IntervalValue(0.4, 0.8),
            startSpeed: new IntervalValue(2, 5),
            startSize: new IntervalValue(0.1, 0.3),
            startColor: new ColorRange(new Vector4(1, 1, 1, 1), new Vector4(0.8, 0.8, 0.8, 0.5)),
            worldSpace: true,
            emissionOverTime: new ConstantValue(0),
            emissionBursts: [{
                time: 0,
                count: new ConstantValue(15),
                cycle: 1,
                interval: 0.01,
                probability: 1
            }],
            shape: new PointEmitter(),
            material: this.jumpMaterial,
            renderMode: RenderMode.BillBoard
        });
        
        // Comportamiento a lo largo de la vida
        system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Vector3(1, 1, 1), 0], [new Vector3(0, 0, 0), 1]])));
        
        // Ajustar posición ligeramente hacia abajo para que salga de los pies
        system.emitter.position.copy(position).add(new THREE.Vector3(0, -0.4, 0));
        
        this._addSystem(system);
    }

    spawnImpactEffect(position, normal = new THREE.Vector3(0, 1, 0)) {
        const system = new QParticleSystem({
            duration: 0.5,
            looping: false,
            startLife: new IntervalValue(0.2, 0.5),
            startSpeed: new IntervalValue(5, 15),
            startSize: new IntervalValue(0.05, 0.15),
            startColor: new ColorRange(new Vector4(1, 0.8, 0.2, 1), new Vector4(1, 0.2, 0, 1)),
            worldSpace: true,
            emissionOverTime: new ConstantValue(0),
            emissionBursts: [{
                time: 0,
                count: new ConstantValue(10),
                cycle: 1,
                interval: 0.01,
                probability: 1
            }],
            // Emitir en cono hacia afuera de la normal
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

        // Orientar el emisor en la dirección de la normal
        // ConeEmitter emite por defecto en el eje Z positivo, así que rotamos el objeto para apuntar en la dirección normal
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        system.emitter.quaternion.copy(quaternion);
        
        system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Vector3(1, 1, 1), 0], [new Vector3(0, 0, 0), 1]])));
        
        system.emitter.position.copy(position);
        
        this._addSystem(system);
    }
    
    spawnExplosionEffect(position) {
        const system = new QParticleSystem({
            duration: 1.5,
            looping: false,
            startLife: new IntervalValue(0.5, 1.2),
            startSpeed: new IntervalValue(5, 20),
            startSize: new IntervalValue(0.5, 1.5),
            startColor: new ColorRange(new Vector4(1, 0.5, 0, 1), new Vector4(0.2, 0.2, 0.2, 0)),
            worldSpace: true,
            emissionOverTime: new ConstantValue(0),
            emissionBursts: [{
                time: 0,
                count: new ConstantValue(40),
                cycle: 1,
                interval: 0.01,
                probability: 1
            }],
            shape: new SphereEmitter({
                radius: 0.5,
                thickness: 1
            }),
            material: this.explosionMaterial,
            renderMode: RenderMode.BillBoard
        });
        
        system.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Vector3(1, 1, 1), 0], [new Vector3(0, 0, 0), 1]])));
        
        system.emitter.position.copy(position);
        
        this._addSystem(system);
    }

    update(dt) {
        // three.quarks necesita el deltaTime en segundos
        this.batchRenderer.update(dt);
    }
}

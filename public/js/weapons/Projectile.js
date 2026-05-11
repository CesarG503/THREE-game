import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Projectile {
    constructor(scene, world, origin, direction, speed, damage, bulletDrop = 1.0, type = "ball", rebote = false, hasImpactEffect = false, customTracerVFX = "Ninguno", customImpactVFX = "Ninguno", tracerCollisionVFX = "Ninguno") {
        this.scene = scene;
        this.world = world;
        this.damage = damage;
        this.isDead = false;
        this.lifetime = 5.0; // Segundos antes de auto eliminar
        this.type = type;
        this.rebote = rebote;
        this.hasImpactEffect = hasImpactEffect;
        this.customTracerVFX = customTracerVFX;
        this.customImpactVFX = customImpactVFX;
        this.tracerCollisionVFX = tracerCollisionVFX;
        this.tracerDestroyOnCollision = false;
        this.tracerStayForever = false;
        this.customTracerWrapper = null;

        this.direction = direction ? direction.clone() : new THREE.Vector3(0, 0, 1);
        this.speed = speed;

        this.hasTracer = false;
        this.hasTrajectoryLine = false;
        this.blasterSystem = null;
        this.lastPosition = origin.clone();
        this.trajectoryPoints = [origin.clone()];
        this.trajectoryLine = null;

        // 1. Visuals
        if (this.type === "ball") {
            const geo = new THREE.SphereGeometry(0.1, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            this.mesh = new THREE.Mesh(geo, mat);
            this.mesh.position.copy(origin);
            this.scene.add(this.mesh);
        }

        // 2. Physics (Dynamic RigidBody)
        // If bullet, we don't want gravity drop
        const gravityEffect = this.type === "bullet" ? 0.0 : bulletDrop;

        // Ensure starting position is valid
        let bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(origin.x, origin.y, origin.z)
            .setCcdEnabled(true) // Continuous Collision Detection for fast objects
            .setGravityScale(gravityEffect); // Adjustable gravity (bullet drop)

        this.rigidBody = this.world.createRigidBody(bodyDesc);

        // Initial Velocity (Faster for bullet)
        let actualSpeed = this.type === "bullet" ? speed * 3.0 : speed;
        const velocity = direction.clone().normalize().multiplyScalar(actualSpeed);
        this.rigidBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

        // Collider (Sensor vs Solid?)
        // Ball: solid ball. Bullet: solid ball but much smaller padding
        const radius = this.type === "bullet" ? 0.05 : 0.1;
        const bounciness = this.rebote ? 0.5 : 0.0;

        let colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(bounciness) // Bounciness depends on rebote setting
            .setDensity(5.0)   // Heavy enough to push small things?
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
        this.colliderHandle = this.collider.handle; // For collision detection

        // Note: For bullet, we want it to be sensor? No, let bullets push objects too for fun,
        // or just let them collide normally. We can make them sensors if we have a bullet-manager for hits, 
        // but Rapier handles hit registration through collision events.
    }

    update(dt) {
        if (this.isDead) return;

        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }

        // Sync visual mesh with physics body
        if (this.rigidBody) {
            const pos = this.rigidBody.translation();
            const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);

            // Lazy initialization of custom tracer because particleSystem is set after constructor
            if (this.particleSystem && this.customTracerVFX !== "Ninguno" && !this.customTracerAttached) {
                this.customTracerAttached = true;
                if (!this.mesh) {
                    // Create a dummy mesh just to hold the tracer if there is no visual ball
                    this.mesh = new THREE.Group();
                    this.scene.add(this.mesh);
                }
                // Rotar para apuntar en dirección de la velocidad
                const vel = this.rigidBody.linvel();
                const dirVec = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
                const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
                
                // Tracers are attached to this.mesh, so we pass a zero vector for local offset
                this.customTracerWrapper = this.particleSystem.spawnLoadedEffect(this.customTracerVFX, new THREE.Vector3(0, 0, 0), this.mesh, quat, false);
            }

            if (this.mesh) {
                this.mesh.position.copy(currentPos);
                
                // Si la bala cae (gravedad), actualizar la rotación del mesh/tracer para que siga la trayectoria
                if (this.customTracerAttached) {
                    const vel = this.rigidBody.linvel();
                    if (vel.x !== 0 || vel.y !== 0 || vel.z !== 0) {
                        const dirVec = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
                        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
                    }
                }
            }
            
            if (this.hasTrajectoryLine) {
                if (!this.trajectoryLine) {
                    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
                    const geometry = new THREE.BufferGeometry().setFromPoints(this.trajectoryPoints);
                    this.trajectoryLine = new THREE.Line(geometry, material);
                    this.trajectoryLine.userData.ignoreRaycast = true;
                    this.scene.add(this.trajectoryLine);
                }
                
                // Add new point and update geometry if moved
                if (currentPos.distanceToSquared(this.lastPosition) > 0.001) {
                    this.trajectoryPoints.push(currentPos.clone());
                    this.trajectoryLine.geometry.setFromPoints(this.trajectoryPoints);
                }
            }

            if (this.hasTracer && this.blasterSystem) {
                // Determine movement direction and distance
                const dist = currentPos.distanceTo(this.lastPosition);
                if (dist > 0.01) {
                    const dir = currentPos.clone().sub(this.lastPosition).normalize();
                    const tracer = this.blasterSystem.CreateParticle();
                    tracer.Start.copy(this.lastPosition);
                    tracer.End.copy(currentPos);
                    tracer.Velocity = new THREE.Vector3(0, 0, 0); // static segment
                    
                    tracer.Colours = [new THREE.Color(0x888888), new THREE.Color(0x222222)]; // humo
                    tracer.Length = dist;
                    tracer.Life = 0.5;
                    tracer.TotalLife = 0.5;
                    tracer.Width = 0.05;
                }
            }

            if (this.isRemoteBlaster && this.blasterSystem) {
                this.blasterSystem.Update(dt);
            }

            this.lastPosition.copy(currentPos);
        }
    }

    destroy(hitPos = null) {
        if (this.isDead) return;
        this.isDead = true;

        if (this.initialTracer && this.initialTracer.Alive) {
            this.initialTracer.Life = 0; // stop piercing walls
        }

        // Impact Effect
        if (hitPos && (this.hasImpactEffect || this.customImpactVFX !== "Ninguno")) {
            const vPos = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);
            if (this.particleSystem) {
                if (this.customImpactVFX !== "Ninguno") {
                    // Spawn the custom impact effect at the collision position
                    const impactWrapper = this.particleSystem.spawnLoadedEffect(this.customImpactVFX, vPos, null, null, false);
                    
                    // Accionar los efectos por un tiempo: detenemos la emisión después de 500ms
                    setTimeout(() => {
                        if (this.particleSystem) {
                            this.particleSystem.stopLoadedEffectEmission(impactWrapper);
                        }
                    }, 500);

                    // Destruimos el wrapper después de 3000ms para que las partículas se desvanezcan
                    setTimeout(() => {
                        if (this.particleSystem) {
                            this.particleSystem.destroyLoadedEffect(impactWrapper);
                        }
                    }, 3000);
                } else if (this.hasImpactEffect) {
                    // Generar impacto y un pequeño efecto de explosión para mayor espectacularidad
                    this.particleSystem.spawnImpactEffect(vPos, new THREE.Vector3(0, 1, 0));
                    // Opcional: si el tipo de bala es explosiva podríamos llamar a explosion
                    if (this.type === "explosive") {
                        this.particleSystem.spawnExplosionEffect(vPos);
                    }
                }
            } else if (this.blasterSystem) {
                for (let i = 0; i < 5; i++) {
                    const spark = this.blasterSystem.CreateParticle();
                    spark.Start.copy(vPos);
                    spark.End.copy(vPos).add(new THREE.Vector3(
                        (Math.random()-0.5)*0.2, 
                        (Math.random()-0.5)*0.2, 
                        (Math.random()-0.5)*0.2
                    ));
                    spark.Velocity = new THREE.Vector3(
                        (Math.random()-0.5)*5, 
                        Math.random()*5, 
                        (Math.random()-0.5)*5
                    );
                    spark.Colours = [new THREE.Color(0xffaa00), new THREE.Color(0x555555)]; // orange to smoke
                    spark.Length = 0.1;
                    spark.Life = 0.2 + Math.random()*0.2;
                    spark.TotalLife = spark.Life;
                }
            }
        }

        // Tracer Collision VFX (Independent of Tracer Wrapper existence)
        if (hitPos && this.particleSystem && this.tracerCollisionVFX && this.tracerCollisionVFX !== "Ninguno") {
            const tracerHitPos = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);
            const tracerImpactWrapper = this.particleSystem.spawnLoadedEffect(this.tracerCollisionVFX, tracerHitPos, null, null, false);
            
            setTimeout(() => {
                if (this.particleSystem) {
                    this.particleSystem.stopLoadedEffectEmission(tracerImpactWrapper);
                }
            }, 500);

            setTimeout(() => {
                if (this.particleSystem) {
                    this.particleSystem.destroyLoadedEffect(tracerImpactWrapper);
                }
            }, 3000);
        }

        // Cleanup Custom Tracer
        if (this.customTracerWrapper && this.particleSystem) {
            console.log(`[Projectile] Cleanup Estela - tracerStayForever: ${this.tracerStayForever}, tracerDestroyOnCollision: ${this.tracerDestroyOnCollision}`);

            if (this.tracerStayForever) {
                console.log("[Projectile] tracerStayForever activado. La estela se quedará indefinidamente.");
                // Desvincular de la bala para que se quede en su posición final
                if (this.customTracerWrapper.parent) {
                    const worldPos = new THREE.Vector3();
                    this.customTracerWrapper.getWorldPosition(worldPos);
                    const worldQuat = new THREE.Quaternion();
                    this.customTracerWrapper.getWorldQuaternion(worldQuat);
                    
                    this.customTracerWrapper.parent.remove(this.customTracerWrapper);
                    this.scene.add(this.customTracerWrapper);
                    
                    this.customTracerWrapper.position.copy(worldPos);
                    this.customTracerWrapper.quaternion.copy(worldQuat);
                }
                // NO detener la emisión ni destruir el wrapper. Se queda para siempre.
            } else if (this.tracerDestroyOnCollision && hitPos) {
                // Dinamizar "Eliminar al colisionar":
                // Desvincular de la bala para evitar la destrucción inmediata
                if (this.customTracerWrapper.parent) {
                    const worldPos = new THREE.Vector3();
                    this.customTracerWrapper.getWorldPosition(worldPos);
                    const worldQuat = new THREE.Quaternion();
                    this.customTracerWrapper.getWorldQuaternion(worldQuat);
                    
                    this.customTracerWrapper.parent.remove(this.customTracerWrapper);
                    this.scene.add(this.customTracerWrapper);
                    
                    this.customTracerWrapper.position.copy(worldPos);
                    this.customTracerWrapper.quaternion.copy(worldQuat);
                }

                // Detener emisión de nuevas partículas al instante
                this.particleSystem.stopLoadedEffectEmission(this.customTracerWrapper);

                const wrapperToDestroy = this.customTracerWrapper;
                const startTime = Date.now();
                const duration = 500; // 500ms
                const pSys = this.particleSystem;

                const fadeAnim = () => {
                    if (!pSys) return;
                    
                    const elapsed = Date.now() - startTime;
                    const t = Math.min(elapsed / duration, 1.0);
                    
                    if (t < 1.0) {
                        requestAnimationFrame(fadeAnim);
                    } else {
                        pSys.destroyLoadedEffect(wrapperToDestroy);
                    }
                };
                fadeAnim();
            } else {
                // Desvincular del proyectil para que la estela se quede en su posición y rotación final
                if (this.customTracerWrapper.parent) {
                    const worldPos = new THREE.Vector3();
                    this.customTracerWrapper.getWorldPosition(worldPos);
                    const worldQuat = new THREE.Quaternion();
                    this.customTracerWrapper.getWorldQuaternion(worldQuat);
                    
                    this.customTracerWrapper.parent.remove(this.customTracerWrapper);
                    this.scene.add(this.customTracerWrapper);
                    
                    this.customTracerWrapper.position.copy(worldPos);
                    this.customTracerWrapper.quaternion.copy(worldQuat);
                }
                
                // Detener la emisión de nuevas partículas
                this.particleSystem.stopLoadedEffectEmission(this.customTracerWrapper);
                
                // Destruir por completo después de 2 segundos (tiempo para que se desvanezcan las partículas existentes)
                const wrapperToDestroy = this.customTracerWrapper;
                setTimeout(() => {
                    if (this.particleSystem) {
                        this.particleSystem.destroyLoadedEffect(wrapperToDestroy);
                    }
                }, 2000);
            }

            this.customTracerWrapper = null;
        }

        // Cleanup ThreeJS
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }

        // Cleanup Rapier
        if (this.rigidBody) {
            this.world.removeRigidBody(this.rigidBody);
        }

        // Cleanup Line
        if (this.trajectoryLine) {
            const line = this.trajectoryLine;
            // Dejar la línea 0.5s para que se vea al chocar, luego remover
            setTimeout(() => {
                this.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
            }, 500); 
            this.trajectoryLine = null;
        }
    }
}

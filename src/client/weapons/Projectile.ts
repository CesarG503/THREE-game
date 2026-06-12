import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Projectile {
  scene: THREE.Scene;
  world: any;
  damage: number;
  isDead: boolean;
  lifetime: number;
  type: string;
  rebote: boolean;
  hasImpactEffect: boolean;
  customTracerVFX: string;
  customImpactVFX: string;
  tracerCollisionVFX: string;
  customTracerAttached: boolean;
  customTracerWrapper: any;
  direction: THREE.Vector3;
  speed: number;
  hasTracer: boolean;
  hasTrajectoryLine: boolean;
  blasterSystem: any;
  lastPosition: THREE.Vector3;
  trajectoryPoints: THREE.Vector3[];
  trajectoryLine: THREE.Line | null;
  mesh: THREE.Object3D | null;
  rigidBody: any;
  collider: any;
  colliderHandle: number;
  particleSystem: any;
  initialTracer: any;
  isRemoteBlaster: boolean;
  tracerDestroyOnCollision: boolean;
  tracerStayForever: boolean;
  ownerColliderHandle: number | null;

  constructor(
    scene: THREE.Scene,
    world: any,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    bulletDrop = 1.0,
    type = "ball",
    rebote = false,
    hasImpactEffect = false,
    customTracerVFX = "Ninguno",
    customImpactVFX = "Ninguno",
    tracerCollisionVFX = "Ninguno"
  ) {
    this.scene = scene;
    this.world = world;
    this.damage = damage;
    this.isDead = false;
    this.lifetime = 5.0;
    this.type = type;
    this.rebote = rebote;
    this.hasImpactEffect = hasImpactEffect;
    this.customTracerVFX = customTracerVFX;
    this.customImpactVFX = customImpactVFX;
    this.tracerCollisionVFX = tracerCollisionVFX;
    this.customTracerAttached = false;
    this.customTracerWrapper = null;

    this.direction = direction ? direction.clone() : new THREE.Vector3(0, 0, 1);
    this.speed = speed;

    this.hasTracer = false;
    this.hasTrajectoryLine = false;
    this.blasterSystem = null;
    this.particleSystem = null;
    this.initialTracer = null;
    this.isRemoteBlaster = false;
    this.tracerDestroyOnCollision = false;
    this.tracerStayForever = false;
    this.ownerColliderHandle = null;
    this.lastPosition = origin.clone();
    this.trajectoryPoints = [origin.clone()];
    this.trajectoryLine = null;

    if (this.type === "ball") {
      const geo = new THREE.SphereGeometry(0.1, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.userData.ignoreRaycast = true;
      this.mesh.position.copy(origin);
      this.scene.add(this.mesh);
    }

    const gravityEffect = this.type === "bullet" ? 0.0 : bulletDrop;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(origin.x, origin.y, origin.z)
      .setCcdEnabled(true)
      .setGravityScale(gravityEffect);

    this.rigidBody = this.world.createRigidBody(bodyDesc);

    const actualSpeed = this.type === "bullet" ? speed * 3.0 : speed;
    const velocity = direction.clone().normalize().multiplyScalar(actualSpeed);
    this.rigidBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

    const radius = this.type === "bullet" ? 0.05 : 0.1;
    const bounciness = this.rebote ? 0.5 : 0.0;

    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(bounciness)
      .setDensity(5.0)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
    this.colliderHandle = this.collider.handle;
  }

  update(dt: number) {
    if (this.isDead) return;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.destroy();
      return;
    }

    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);

      if (this.particleSystem && this.customTracerVFX !== "Ninguno" && !this.customTracerAttached) {
        this.customTracerAttached = true;
        if (!this.mesh) {
          this.mesh = new THREE.Group();
          this.mesh.userData.ignoreRaycast = true;
          this.scene.add(this.mesh);
        }
        const vel = this.rigidBody.linvel();
        const dirVec = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);

        this.customTracerWrapper = this.particleSystem.spawnLoadedEffect(
          this.customTracerVFX,
          new THREE.Vector3(0, 0, 0),
          this.mesh,
          quat,
          false
        );
      }

      if (this.mesh) {
        this.mesh.position.copy(currentPos);

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

        if (currentPos.distanceToSquared(this.lastPosition) > 0.001) {
          this.trajectoryPoints.push(currentPos.clone());
          this.trajectoryLine.geometry.setFromPoints(this.trajectoryPoints);
        }
      }

      if (this.hasTracer && this.blasterSystem) {
        const dist = currentPos.distanceTo(this.lastPosition);
        if (dist > 0.01) {
          const tracer = this.blasterSystem.CreateParticle();
          tracer.Start.copy(this.lastPosition);
          tracer.End.copy(currentPos);
          tracer.Velocity = new THREE.Vector3(0, 0, 0);

          tracer.Colours = [new THREE.Color(0x888888), new THREE.Color(0x222222)];
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

  destroy(hitPos: { x: number; y: number; z: number } | null = null) {
    if (this.isDead) return;
    this.isDead = true;

    if (this.initialTracer && this.initialTracer.Alive) {
      this.initialTracer.Life = 0;
    }

    if (hitPos && (this.hasImpactEffect || this.customImpactVFX !== "Ninguno")) {
      const vPos = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);
      if (this.particleSystem) {
        if (this.customImpactVFX !== "Ninguno") {
          const impactWrapper = this.particleSystem.spawnLoadedEffect(this.customImpactVFX, vPos, null, null, false);

          setTimeout(() => {
            if (this.particleSystem) {
              this.particleSystem.stopLoadedEffectEmission(impactWrapper);
            }
          }, 500);

          setTimeout(() => {
            if (this.particleSystem) {
              this.particleSystem.destroyLoadedEffect(impactWrapper);
            }
          }, 3000);
        } else if (this.hasImpactEffect) {
          this.particleSystem.spawnImpactEffect(vPos, new THREE.Vector3(0, 1, 0));
          if (this.type === "explosive") {
            this.particleSystem.spawnExplosionEffect(vPos);
          }
        }
      } else if (this.blasterSystem) {
        for (let i = 0; i < 5; i++) {
          const spark = this.blasterSystem.CreateParticle();
          spark.Start.copy(vPos);
          spark.End.copy(vPos).add(
            new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)
          );
          spark.Velocity = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5);
          spark.Colours = [new THREE.Color(0xffaa00), new THREE.Color(0x555555)];
          spark.Length = 0.1;
          spark.Life = 0.2 + Math.random() * 0.2;
          spark.TotalLife = spark.Life;
        }
      }
    }

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

    if (this.customTracerWrapper && this.particleSystem) {
      if (this.tracerStayForever) {
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
      } else if (this.tracerDestroyOnCollision && hitPos) {
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

        this.particleSystem.stopLoadedEffectEmission(this.customTracerWrapper);

        const wrapperToDestroy = this.customTracerWrapper;
        const startTime = Date.now();
        const duration = 500;
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

        this.particleSystem.stopLoadedEffectEmission(this.customTracerWrapper);

        const wrapperToDestroy = this.customTracerWrapper;
        setTimeout(() => {
          if (this.particleSystem) {
            this.particleSystem.destroyLoadedEffect(wrapperToDestroy);
          }
        }, 2000);
      }

      this.customTracerWrapper = null;
    }

    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh instanceof THREE.Mesh) {
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach((material) => material.dispose());
        } else if (this.mesh.material) {
          this.mesh.material.dispose();
        }
      }
    }

    if (this.rigidBody) {
      this.world.removeRigidBody(this.rigidBody);
    }

    if (this.trajectoryLine) {
      const line = this.trajectoryLine;
      setTimeout(() => {
        this.scene.remove(line);
        line.geometry.dispose();
        if (Array.isArray(line.material)) {
          line.material.forEach((material) => material.dispose());
        } else {
          line.material.dispose();
        }
      }, 500);
      this.trajectoryLine = null;
    }
  }
}

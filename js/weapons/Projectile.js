import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Projectile {
    constructor(scene, world, origin, direction, speed, damage, bulletDrop = 1.0, type = "ball", rebote = false) {
        this.scene = scene;
        this.world = world;
        this.damage = damage;
        this.isDead = false;
        this.lifetime = 5.0; // Segundos antes de auto eliminar
        this.type = type;
        this.rebote = rebote;

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

        let colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(0.5) // Bounciness
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

            if (this.mesh) {
                this.mesh.position.copy(currentPos);
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

            this.lastPosition.copy(currentPos);
        }
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;

        // Cleanup ThreeJS
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Cleanup Rapier
        if (this.rigidBody) {
            this.world.removeRigidBody(this.rigidBody);
        }

        // Cleanup Line
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.material.dispose();
            this.trajectoryLine = null;
        }
    }
}

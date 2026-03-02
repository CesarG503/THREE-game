import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Projectile {
    constructor(scene, world, origin, direction, speed, damage, bulletDrop = 1.0, type = "ball") {
        this.scene = scene;
        this.world = world;
        this.damage = damage;
        this.isDead = false;
        this.lifetime = 5.0; // Segundos antes de auto eliminar
        this.type = type;

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
            .setDensity(5.0);   // Heavy enough to push small things?

        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

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
        if (this.rigidBody && this.mesh) {
            const pos = this.rigidBody.translation();
            this.mesh.position.set(pos.x, pos.y, pos.z);
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
    }
}

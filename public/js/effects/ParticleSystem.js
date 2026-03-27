import * as THREE from "three";

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    spawnJumpEffect(position) {
        const particleCount = 10;
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());

            // Spawn slightly below the player
            mesh.position.copy(position).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                -0.5,
                (Math.random() - 0.5) * 0.5
            ));

            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                -Math.random() * 2 - 1, // Downward
                (Math.random() - 0.5) * 2
            );

            this.scene.add(mesh);
            this.particles.push({ mesh, velocity, life: 1.0 });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * 2; // Fade out speed

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                // Dispose?
                // p.mesh.geometry.dispose(); // Reusing geo would be better but for now simple
                // p.mesh.material.dispose();
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.mesh.rotation.x += dt;
                p.mesh.rotation.y += dt;
                p.mesh.scale.setScalar(p.life);
                p.mesh.material.opacity = p.life;
            }
        }
    }
}

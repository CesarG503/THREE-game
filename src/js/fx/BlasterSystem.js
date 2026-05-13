import * as THREE from "three";

export class BlasterSystem {
    constructor(scene) {
        this.scene = scene;
        this.liveParticles_ = [];
        this.particlePool = [];

        // Group to hold all tracer meshes
        this.meshGroup = new THREE.Group();
        this.scene.add(this.meshGroup);

        // Shared geometry and material for tracers
        this.geometry = new THREE.CylinderGeometry(1, 1, 1, 8);
        this.geometry.rotateX(Math.PI / 2); // Rotate so length is along Z axis

        this.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    CreateParticle() {
        const tracer = {
            Alive: true,
            Start: new THREE.Vector3(),
            End: new THREE.Vector3(),
            Velocity: new THREE.Vector3(),
            Colours: [new THREE.Color(0xffff00), new THREE.Color(0xffaaaa)], // Default gradient
            Length: 10.0,
            Life: 1.0,
            TotalLife: 1.0,
            Width: 0.05, // A bit thinner
            mesh: this._getMesh()
        };
        this.liveParticles_.push(tracer);
        return tracer;
    }

    _getMesh() {
        if (this.particlePool.length > 0) {
            const mesh = this.particlePool.pop();
            mesh.visible = true;
            return mesh;
        }

        const mesh = new THREE.Mesh(this.geometry, this.material.clone()); // Clone mat so colors can be individual
        this.meshGroup.add(mesh);
        return mesh;
    }

    Update(timeInSeconds) {
        for (const p of this.liveParticles_) {
            p.Life -= timeInSeconds;
            if (p.Life <= 0) {
                p.Alive = false;
                p.mesh.visible = false;
                this.particlePool.push(p.mesh);
                continue;
            }

            p.End.add(p.Velocity.clone().multiplyScalar(timeInSeconds));

            const segment = p.End.clone().sub(p.Start);
            if (segment.length() > p.Length) {
                const dir = p.Velocity.clone().normalize();
                p.Start = p.End.clone().sub(dir.multiplyScalar(p.Length));
            }

            // Update physical mesh
            this._updateMeshMatrix(p);
        }

        this.liveParticles_ = this.liveParticles_.filter(p => p.Alive);
    }

    _updateMeshMatrix(p) {
        const dir = p.End.clone().sub(p.Start);
        const dist = dir.length();
        if (dist === 0) return;

        // Position at the center of the segment
        const midPoint = p.Start.clone().add(dir.clone().multiplyScalar(0.5));
        p.mesh.position.copy(midPoint);

        // Scale to segment length, keeping width
        p.mesh.scale.set(p.Width, p.Width, dist);

        // Orient towards End
        p.mesh.lookAt(p.End);

        // Fade out
        const lifeRatio = Math.max(0, p.Life / p.TotalLife);
        p.mesh.material.opacity = lifeRatio * 0.8;

        // Color transition
        if (p.Colours && p.Colours.length >= 2) {
            // Lerp from start color to end color as it dies
            p.mesh.material.color.lerpColors(p.Colours[1], p.Colours[0], lifeRatio);
        }
    }
}

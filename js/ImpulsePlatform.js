import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class ImpulsePlatform {
    constructor(scene, world, position, direction, strength, type = "pad") {
        this.scene = scene
        this.world = world
        this.position = position
        this.direction = direction.normalize()
        this.strength = strength
        this.type = type

        this.width = 3
        this.height = 0.2
        this.depth = 3

        this.collider = null
        this.mesh = null
        this.initPhysics()
        this.initVisuals()
    }

    initPhysics() {
        // Sensor Collider (Triggers only)
        // Static rigid body
        let bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this.position.x,
            this.position.y - (this.height / 2), // Slightly flush or below?
            this.position.z
        )
        let rigidBody = this.world.createRigidBody(bodyDesc)

        // Collider: Cuboid
        let colliderDesc = RAPIER.ColliderDesc.cuboid(
            this.width / 2,
            this.height / 2, // Very thin vertical trigger
            this.depth / 2
        ).setSensor(true)

        this.collider = this.world.createCollider(colliderDesc, rigidBody)
    }

    initVisuals() {
        // Base Platform
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth)
        const material = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.8
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.position.copy(this.position)
        this.mesh.position.y -= this.height / 2 // Align with flush floor
        this.mesh.receiveShadow = true
        this.scene.add(this.mesh)
    }



    update(character) {
        if (!character || !character.rigidBody || !this.collider) return

        // Check intersection
        // Rapier sensor check requires us to know if character collider is intersecting this sensor.
        // We can do a manual bound check for simplicity (AABB).
        // Or rely on Rapier events?
        // Manual AABB is cheapest and robust for simple boxes.

        const charPos = character.getPosition()

        // Simple rectangular bounds check
        const halfW = this.width / 2
        const halfD = this.depth / 2

        // We treat it as an infinite height column for trigger? Or just close enough?
        // Usually pads are walked ON.

        const dx = Math.abs(charPos.x - this.position.x)
        const dz = Math.abs(charPos.z - this.position.z)
        const dy = charPos.y - this.position.y // Should be close to 0 or positive

        if (dx < halfW && dz < halfD && dy < 2.0 && dy > -0.5) {
            // Trigger Impulse!
            // Need cooldown?
            // If continuous, we apply force every frame (acceleration).
            // If instant boost, usually one-off until exit.

            // For fun, let's make it continuous force.
            // But if it's "Impulse", it implies instantaneous velocity change.
            // If Character is "Kinematic", we need to modify its velocity/momentum.

            // Apply Impulse
            const force = this.direction.clone().multiplyScalar(this.strength)
            character.applyImpulse(force)
        }
    }
}

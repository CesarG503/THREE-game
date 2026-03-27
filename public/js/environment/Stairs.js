import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class Stairs {
    constructor(scene, world, config) {
        this.scene = scene
        this.world = world
        this.steps = []
        this.config = Object.assign({
            startPosition: new THREE.Vector3(0, 0, 0),
            stepCount: 10,
            stepWidth: 2,
            stepHeight: 0.2, // Visual height of step
            stepDepth: 0.5,
            rise: 0.25, // Height increase per step
            direction: new THREE.Vector3(0, 0, 1) // Direction to build towards
        }, config)

        this.build()
    }

    build() {
        const c = this.config
        const dir = c.direction.normalize()

        // Calculate rotation from direction vector (assuming Y up)
        const angle = Math.atan2(dir.x, dir.z)
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)

        for (let i = 0; i < c.stepCount; i++) {
            // Calculate position relative to start
            const forwardOffset = (i * c.stepDepth) + (c.stepDepth / 2)
            const upOffset = (i * c.rise) + (c.stepHeight / 2) // Center of the block height

            const offset = new THREE.Vector3(0, 0, forwardOffset).applyQuaternion(rotation)
            const pos = c.startPosition.clone().add(offset)
            pos.y += upOffset

            this.createStep(pos, c.stepWidth, c.stepHeight, c.stepDepth, rotation)
        }
    }

    createStep(pos, w, h, d, quat) {
        // Visuals
        const geo = new THREE.BoxGeometry(w, h, d)
        const mat = new THREE.MeshStandardMaterial({ color: 0x88cc44 })
        const mesh = new THREE.Mesh(geo, mat)

        mesh.position.copy(pos)
        mesh.quaternion.copy(quat)
        mesh.castShadow = true
        mesh.receiveShadow = true

        this.scene.add(mesh)
        this.steps.push(mesh)

        // Physics
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(quat)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)

        this.world.createCollider(colliderDesc, body)
    }
}

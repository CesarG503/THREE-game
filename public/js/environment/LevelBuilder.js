import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { Stairs } from "./Stairs.js"
import { Ladder } from "./Ladder.js"

export class LevelBuilder {
    constructor(scene, world) {
        this.scene = scene
        this.world = world
        this.ladders = []
    }

    build() {
        // 1. Static Floors and Platforms (Ported from main_rapier.js)
        this.addStaticBox(0, -0.5, 0, 100, 1, 100, 0x333333) // Floor
        this.addStaticBox(5, 1, 0, 4, 2, 4, 0x4488ff) // Platform

        // 2. Original Ramps (Ported)
        this.buildOriginalRamps()

        // 3. NEW: Stairs
        // Leading up to a new platform
        const stairStart = new THREE.Vector3(-5, 0, 5)
        new Stairs(this.scene, this.world, {
            startPosition: stairStart,
            stepCount: 15,
            rise: 0.3,
            direction: new THREE.Vector3(0, 0, 1)
        })

        // Platform at top of stairs
        // 15 steps * 0.3 rise = 4.5 height. Start Y=0 -> Top Y=4.5
        // Forward: 15 steps * 0.5 depth = 7.5. Start Z=5 -> End Z=12.5. (+ offset)
        this.addStaticBox(-5, 4.5 - 0.5, 14, 4, 1, 4, 0x88cc44)

        // 4. NEW: Ladder
        // Place a tall wall and a ladder against it
        this.addStaticBox(10, 5, 10, 4, 10, 4, 0x888888) // Tall tower

        // Ladder on the side of the tower
        const ladder = new Ladder(this.scene, this.world, {
            position: new THREE.Vector3(7.8, 0, 10), // Offset from wall (x=8)
            height: 10,
            width: 1.2,
            rotationY: Math.PI / 2 // Rotate to align with wall
        })
        this.ladders.push(ladder)
    }

    addStaticBox(x, y, z, w, h, d, color, rotation = { x: 0, y: 0, z: 0 }) {
        // Visual
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: color })
        )
        mesh.position.set(x, y, z)
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)
        mesh.receiveShadow = true
        mesh.castShadow = true
        this.scene.add(mesh)

        // Physics
        let dt = new THREE.Vector3(x, y, z)
        let dr = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z))

        let bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(dt.x, dt.y, dt.z)
            .setRotation(dr)
        let body = this.world.createRigidBody(bodyDesc)

        let colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        this.world.createCollider(colliderDesc, body)

        return mesh
    }

    buildOriginalRamps() {
        // 1. Green (Low Angle ~15deg)
        const angle1 = Math.atan2(2, 8)
        const hyp1 = Math.sqrt(8 * 8 + 2 * 2)
        this.addStaticBox(-8, 1, -1, 2, 0.2, hyp1, 0x00ff00, { x: -angle1, y: 0, z: 0 })
        this.addStaticBox(-8, 1.5, -1 + 4 + 2, 4, 1, 4, 0x00ff00)

        // 2. Yellow (Medium Angle ~30deg)
        const angle2 = Math.atan2(3, 5)
        const hyp2 = Math.sqrt(5 * 5 + 3 * 3)
        this.addStaticBox(-12, 1.5, -2, 2, 0.2, hyp2, 0xffff00, { x: -angle2, y: 0, z: 0 })
        this.addStaticBox(-12, 2.5, -2 + 2.5 + 2, 4, 1, 4, 0xffff00)

        // 3. Red (Steep Angle ~53deg)
        const angle3 = Math.atan2(4, 3)
        const hyp3 = Math.sqrt(3 * 3 + 4 * 4)
        this.addStaticBox(-16, 2, -3, 2, 0.2, hyp3, 0xff0000, { x: -angle3, y: 0, z: 0 })
        this.addStaticBox(-16, 3.5, -3 + 1.5 + 2, 4, 1, 4, 0xff0000)
    }
}

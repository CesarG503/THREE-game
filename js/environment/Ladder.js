import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class Ladder {
    constructor(scene, world, config) {
        this.scene = scene
        this.world = world
        this.config = Object.assign({
            position: new THREE.Vector3(0, 0, 0),
            height: 5,
            width: 1,
            rotationY: 0
        }, config)

        this.bounds = new THREE.Box3()
        this.build()
    }

    build() {
        const c = this.config

        // 1. Visual Geometry (Rails and Rungs)
        const group = new THREE.Group()
        group.position.copy(c.position)
        group.rotation.y = c.rotationY
        this.scene.add(group)

        const mat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })

        // Rails
        const railGeo = new THREE.BoxGeometry(0.1, c.height, 0.1)
        const leftRail = new THREE.Mesh(railGeo, mat)
        leftRail.position.set(-c.width / 2, c.height / 2, 0)

        const rightRail = new THREE.Mesh(railGeo, mat)
        rightRail.position.set(c.width / 2, c.height / 2, 0)

        group.add(leftRail)
        group.add(rightRail)

        // Rungs
        const rungCount = Math.floor(c.height / 0.4)
        const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, c.width, 8)
        rungGeo.rotateZ(Math.PI / 2)

        for (let i = 0; i < rungCount; i++) {
            const rung = new THREE.Mesh(rungGeo, mat)
            rung.position.set(0, (i + 1) * 0.4, 0)
            group.add(rung)
        }

        // 2. Logical Bounds for Climbing Detection
        // Force update to ensure accurate bounding box
        group.updateMatrixWorld(true)
        this.bounds.setFromObject(group)

        // Expand bounds generous to easier grabbing
        this.bounds.expandByScalar(0.5)
    }
}

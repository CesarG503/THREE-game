import * as THREE from "three"
import { Collider, ColliderType } from "./Collider.js"

/**
 * Colisionador esférico - ideal para personajes y objetos simples
 */
export class SphereCollider extends Collider {
    constructor(options = {}) {
        super({ ...options, type: ColliderType.SPHERE })
        this.radius = options.radius || 0.5
    }

    /**
     * Crea el mesh de debug
     */
    createDebugMesh(scene) {
        const geometry = new THREE.SphereGeometry(this.radius, 16, 16)
        const material = new THREE.MeshBasicMaterial({
            color: this.isTrigger ? 0x00ff00 : 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
        })
        this.debugMesh = new THREE.Mesh(geometry, material)
        this.debugMesh.visible = this.showDebug
        scene.add(this.debugMesh)
    }

    /**
     * Actualiza la posición del mesh de debug
     */
    updateDebugMesh() {
        if (this.debugMesh) {
            this.debugMesh.position.copy(this.worldPosition)
        }
    }

    /**
     * Verifica colisión esfera-esfera
     */
    intersectsSphere(other) {
        const distance = this.worldPosition.distanceTo(other.worldPosition)
        const combinedRadius = this.radius + other.radius
        return distance < combinedRadius
    }

    /**
     * Calcula la respuesta de colisión (push-back)
     */
    getCollisionResponse(other) {
        const direction = new THREE.Vector3().subVectors(this.worldPosition, other.worldPosition).normalize()

        const distance = this.worldPosition.distanceTo(other.worldPosition)
        const overlap = this.radius + other.radius - distance

        return {
            direction: direction,
            overlap: Math.max(0, overlap),
            normal: direction.clone(),
        }
    }
}

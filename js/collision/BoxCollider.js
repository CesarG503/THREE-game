import * as THREE from "three"
import { Collider, ColliderType } from "./Collider.js"

/**
 * Colisionador de caja - ideal para paredes, plataformas y objetos rectangulares
 */
export class BoxCollider extends Collider {
    constructor(options = {}) {
        super({ ...options, type: ColliderType.BOX })
        this.size = options.size || new THREE.Vector3(1, 1, 1)
        this.rotation = options.rotation || new THREE.Euler(0, 0, 0)

        // AABB bounds (se actualizan con la posición)
        this.min = new THREE.Vector3()
        this.max = new THREE.Vector3()
    }

    /**
     * Actualiza los bounds AABB
     */
    updateBounds() {
        const halfSize = this.size.clone().multiplyScalar(0.5)
        this.min.copy(this.worldPosition).sub(halfSize)
        this.max.copy(this.worldPosition).add(halfSize)
    }

    /**
     * Crea el mesh de debug
     */
    createDebugMesh(scene) {
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z)
        const material = new THREE.MeshBasicMaterial({
            color: this.isTrigger ? 0x00ff00 : 0xff8800,
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
            this.debugMesh.rotation.copy(this.rotation)
        }
    }

    /**
     * Verifica colisión AABB vs AABB
     */
    intersectsBox(other) {
        this.updateBounds()
        other.updateBounds()

        return (
            this.min.x <= other.max.x &&
            this.max.x >= other.min.x &&
            this.min.y <= other.max.y &&
            this.max.y >= other.min.y &&
            this.min.z <= other.max.z &&
            this.max.z >= other.min.z
        )
    }

    /**
     * Verifica colisión AABB vs Esfera
     */
    intersectsSphere(sphereCollider) {
        this.updateBounds()

        // Encontrar el punto más cercano en el AABB a la esfera
        const closest = new THREE.Vector3()
        closest.x = Math.max(this.min.x, Math.min(sphereCollider.worldPosition.x, this.max.x))
        closest.y = Math.max(this.min.y, Math.min(sphereCollider.worldPosition.y, this.max.y))
        closest.z = Math.max(this.min.z, Math.min(sphereCollider.worldPosition.z, this.max.z))

        const distance = closest.distanceTo(sphereCollider.worldPosition)
        return distance < sphereCollider.radius
    }

    /**
     * Calcula la respuesta de colisión para una esfera
     */
    getCollisionResponseForSphere(sphereCollider) {
        this.updateBounds()

        const closest = new THREE.Vector3()
        closest.x = Math.max(this.min.x, Math.min(sphereCollider.worldPosition.x, this.max.x))
        closest.y = Math.max(this.min.y, Math.min(sphereCollider.worldPosition.y, this.max.y))
        closest.z = Math.max(this.min.z, Math.min(sphereCollider.worldPosition.z, this.max.z))

        const direction = new THREE.Vector3().subVectors(sphereCollider.worldPosition, closest).normalize()

        const distance = closest.distanceTo(sphereCollider.worldPosition)
        const overlap = sphereCollider.radius - distance

        return {
            direction: direction,
            overlap: Math.max(0, overlap),
            normal: direction.clone(),
        }
    }
}

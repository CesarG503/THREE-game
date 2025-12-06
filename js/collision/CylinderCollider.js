import * as THREE from "three"
import { Collider, ColliderType } from "./Collider.js"

/**
 * Colisionador de cilindro - ideal para personajes que necesitan base plana
 */
export class CylinderCollider extends Collider {
    constructor(options = {}) {
        super({ ...options, type: ColliderType.CYLINDER })
        this.radius = options.radius || 0.3
        this.height = options.height || 1.8

        // Puntos extremos del eje central (similar a cápsula pero para lógica interna)
        this.bottomPoint = new THREE.Vector3()
        this.topPoint = new THREE.Vector3()

        // AABB bounds
        this.min = new THREE.Vector3()
        this.max = new THREE.Vector3()
    }

    /**
     * Actualiza la posición y bounds
     */
    updateWorldPosition() {
        super.updateWorldPosition()

        const halfHeight = this.height / 2
        this.bottomPoint.copy(this.worldPosition).y -= halfHeight
        this.topPoint.copy(this.worldPosition).y += halfHeight

        // Update AABB
        this.min.set(
            this.worldPosition.x - this.radius,
            this.worldPosition.y - halfHeight,
            this.worldPosition.z - this.radius
        )
        this.max.set(
            this.worldPosition.x + this.radius,
            this.worldPosition.y + halfHeight,
            this.worldPosition.z + this.radius
        )
    }

    /**
     * Crea el mesh de debug
     */
    createDebugMesh(scene) {
        const geometry = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16)
        const material = new THREE.MeshBasicMaterial({
            color: this.isTrigger ? 0x00ff00 : 0x00ffff, // Cyan para cilindro
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
     * Verifica colisión Cilindro vs Esfera
     */
    intersectsSphere(sphereCollider) {
        // 1. Verificar AABB primero (rápido)
        const closestY = Math.max(this.min.y, Math.min(sphereCollider.worldPosition.y, this.max.y))

        // Distancia horizontal al eje del cilindro
        const dx = sphereCollider.worldPosition.x - this.worldPosition.x
        const dz = sphereCollider.worldPosition.z - this.worldPosition.z
        const distSqHorizontal = dx * dx + dz * dz

        // Si estamos fuera del radio horizontalmente
        if (distSqHorizontal > (this.radius + sphereCollider.radius) ** 2) {
            return false
        }

        // Verificar colisión vertical precisa
        // El punto más cercano en el eje del cilindro a la esfera
        const closestOnAxis = new THREE.Vector3(
            this.worldPosition.x,
            closestY,
            this.worldPosition.z
        )

        // Distancia desde ese punto a la esfera
        const distance = closestOnAxis.distanceTo(sphereCollider.worldPosition)

        // Si estamos en las tapas, es un círculo vs esfera
        // Si estamos en el cuerpo, es línea vs esfera
        // Simplificación: distancia al punto más cercano en el cilindro

        // Encontrar punto más cercano en la superficie del cilindro
        const closestOnSurface = closestOnAxis.clone()
        const toSphere = new THREE.Vector3(dx, 0, dz)
        if (toSphere.lengthSq() > 0) {
            toSphere.normalize().multiplyScalar(this.radius)
            closestOnSurface.add(toSphere)
        }

        return closestOnSurface.distanceTo(sphereCollider.worldPosition) < sphereCollider.radius
    }

    /**
     * Verifica colisión Cilindro vs Caja (AABB)
     */
    intersectsBox(boxCollider) {
        // Actualizar bounds de ambos
        this.updateWorldPosition()
        boxCollider.updateBounds()

        // 1. Test AABB vs AABB
        if (this.max.x < boxCollider.min.x || this.min.x > boxCollider.max.x ||
            this.max.y < boxCollider.min.y || this.min.y > boxCollider.max.y ||
            this.max.z < boxCollider.min.z || this.min.z > boxCollider.max.z) {
            return false
        }

        // 2. Test más preciso: Círculo vs AABB en plano XZ
        // Encontrar el punto más cercano en el rectángulo XZ de la caja al centro del cilindro
        const closestX = Math.max(boxCollider.min.x, Math.min(this.worldPosition.x, boxCollider.max.x))
        const closestZ = Math.max(boxCollider.min.z, Math.min(this.worldPosition.z, boxCollider.max.z))

        const dx = closestX - this.worldPosition.x
        const dz = closestZ - this.worldPosition.z

        return (dx * dx + dz * dz) < (this.radius * this.radius)
    }

    /**
     * Respuesta de colisión para Caja
     */
    getCollisionResponseForBox(boxCollider) {
        // Simplificación: tratar como esfera para la respuesta, pero usando el radio del cilindro
        // Esto funciona bien para mantenerlo fuera, aunque no es perfecto en las esquinas superiores/inferiores

        const closest = new THREE.Vector3()
        closest.x = Math.max(boxCollider.min.x, Math.min(this.worldPosition.x, boxCollider.max.x))
        closest.y = Math.max(boxCollider.min.y, Math.min(this.worldPosition.y, boxCollider.max.y))
        closest.z = Math.max(boxCollider.min.z, Math.min(this.worldPosition.z, boxCollider.max.z))

        // Determinar si el centro del cilindro está dentro de la caja
        const inside = (
            this.worldPosition.x > boxCollider.min.x && this.worldPosition.x < boxCollider.max.x &&
            this.worldPosition.y > boxCollider.min.y && this.worldPosition.y < boxCollider.max.y &&
            this.worldPosition.z > boxCollider.min.z && this.worldPosition.z < boxCollider.max.z
        )

        const direction = new THREE.Vector3().subVectors(this.worldPosition, closest)
        let distance = direction.length()

        // Si está dentro, necesitamos empujar hacia afuera por el camino más corto
        if (inside || distance < 0.001) {
            // Calcular distancias a cada cara
            const dx1 = this.worldPosition.x - boxCollider.min.x
            const dx2 = boxCollider.max.x - this.worldPosition.x
            const dy1 = this.worldPosition.y - boxCollider.min.y
            const dy2 = boxCollider.max.y - this.worldPosition.y
            const dz1 = this.worldPosition.z - boxCollider.min.z
            const dz2 = boxCollider.max.z - this.worldPosition.z

            const minD = Math.min(dx1, dx2, dy1, dy2, dz1, dz2)

            direction.set(0, 0, 0)
            if (minD === dx1) direction.x = 1
            else if (minD === dx2) direction.x = -1
            else if (minD === dy1) direction.y = 1
            else if (minD === dy2) direction.y = -1
            else if (minD === dz1) direction.z = 1
            else direction.z = -1

            // El overlap es radio + distancia al borde (porque estamos dentro)
            // Pero para cilindro vs caja, si estamos dentro, queremos salir completamente
            // + el radio
            return {
                direction: direction,
                overlap: minD + this.radius,
                normal: direction.clone()
            }
        }

        direction.normalize()

        // Calcular overlap considerando el radio del cilindro
        // Nota: esto asume colisión horizontal principalmente o vertical pura
        // Para cilindro, el radio aplica en XZ, y la altura en Y.

        // Chequear si la colisión es principalmente vertical (suelo/techo)
        const isVerticalCollision = (
            this.worldPosition.x >= boxCollider.min.x && this.worldPosition.x <= boxCollider.max.x &&
            this.worldPosition.z >= boxCollider.min.z && this.worldPosition.z <= boxCollider.max.z
        )

        let overlap = 0

        if (isVerticalCollision) {
            // Colisión con cara superior o inferior
            const halfHeight = this.height / 2
            const distY = Math.abs(this.worldPosition.y - closest.y)
            overlap = halfHeight - distY
        } else {
            // Colisión con borde o esquina
            // Usamos radio
            overlap = this.radius - distance
        }

        return {
            direction: direction,
            overlap: Math.max(0, overlap),
            normal: direction.clone(),
        }
    }
}

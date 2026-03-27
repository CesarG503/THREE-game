import * as THREE from "three"

/**
 * Tipos de colisionadores disponibles
 */
export const ColliderType = {
    SPHERE: "sphere",
    BOX: "box",
    CAPSULE: "capsule",
}

/**
 * Capas de colisión para filtrar interacciones
 */
export const CollisionLayer = {
    NONE: 0,
    PLAYER: 1 << 0, // 1
    REMOTE_PLAYER: 1 << 1, // 2
    NPC: 1 << 2, // 4
    ENVIRONMENT: 1 << 3, // 8
    GROUND: 1 << 4, // 16
    TRIGGER: 1 << 5, // 32
    ALL: 0xffffffff,
}

/**
 * Clase base para todos los colisionadores
 */
export class Collider {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID()
        this.type = options.type || ColliderType.SPHERE
        this.layer = options.layer || CollisionLayer.ENVIRONMENT
        this.collidesWithMask = options.collidesWithMask || CollisionLayer.ALL
        this.isTrigger = options.isTrigger || false
        this.isStatic = options.isStatic || false
        this.enabled = true

        // Referencia al objeto padre (modelo 3D)
        this.parent = options.parent || null

        // Offset relativo al padre
        this.offset = options.offset || new THREE.Vector3(0, 0, 0)

        // Posición mundial actual
        this.worldPosition = new THREE.Vector3()

        // Datos del usuario para callbacks
        this.userData = options.userData || {}

        // Callbacks de colisión
        this.onCollisionEnter = options.onCollisionEnter || null
        this.onCollisionStay = options.onCollisionStay || null
        this.onCollisionExit = options.onCollisionExit || null

        // Set para trackear colisiones activas
        this.activeCollisions = new Set()

        // Helper visual para debug
        this.debugMesh = null
        this.showDebug = false
    }

    /**
     * Actualiza la posición mundial del colisionador
     */
    updateWorldPosition() {
        if (this.parent) {
            this.worldPosition.copy(this.parent.position).add(this.offset)
        }
    }

    /**
     * Verifica si puede colisionar con otro collider basado en las capas
     */
    canCollideWith(other) {
        if (!this.enabled || !other.enabled) return false
        if (this === other) return false

        // Verificar máscaras de colisión bidireccionales
        const thisCanHitOther = (this.collidesWithMask & other.layer) !== 0
        const otherCanHitThis = (other.collidesWithMask & this.layer) !== 0

        return thisCanHitOther && otherCanHitThis
    }

    /**
     * Activa/desactiva visualización de debug
     */
    setDebugVisible(visible, scene) {
        this.showDebug = visible
        if (this.debugMesh) {
            this.debugMesh.visible = visible
        }
    }

    /**
     * Limpia recursos
     */
    dispose() {
        if (this.debugMesh) {
            if (this.debugMesh.geometry) this.debugMesh.geometry.dispose()
            if (this.debugMesh.material) this.debugMesh.material.dispose()
        }
        this.activeCollisions.clear()
    }
}

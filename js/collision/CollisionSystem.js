import * as THREE from "three"
import { ColliderType, CollisionLayer } from "./Collider.js"

/**
 * Sistema central de detección y resolución de colisiones
 */
export class CollisionSystem {
  constructor(scene) {
    this.scene = scene
    this.colliders = new Map() // Map<id, Collider>
    this.debugMode = false

    // Estadísticas para optimización
    this.stats = {
      totalChecks: 0,
      collisionsDetected: 0,
      lastUpdateTime: 0,
    }
  }

  /**
   * Registra un colisionador en el sistema
   */
  addCollider(collider) {
    if (this.colliders.has(collider.id)) {
      console.warn(`[CollisionSystem] Collider ${collider.id} already exists`)
      return
    }

    this.colliders.set(collider.id, collider)

    if (this.debugMode) {
      collider.createDebugMesh(this.scene)
      collider.setDebugVisible(true, this.scene)
    }

    return collider
  }

  /**
   * Elimina un colisionador del sistema
   */
  removeCollider(colliderId) {
    const collider = this.colliders.get(colliderId)
    if (collider) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh)
      }
      collider.dispose()
      this.colliders.delete(colliderId)
    }
  }

  /**
   * Obtiene un colisionador por ID
   */
  getCollider(colliderId) {
    return this.colliders.get(colliderId)
  }

  /**
   * Activa/desactiva modo debug para todos los colisionadores
   */
  setDebugMode(enabled) {
    this.debugMode = enabled

    this.colliders.forEach((collider) => {
      if (enabled && !collider.debugMesh) {
        collider.createDebugMesh(this.scene)
      }
      collider.setDebugVisible(enabled, this.scene)
    })
  }

  /**
   * Verifica colisión entre dos colisionadores
   */
  checkCollision(a, b) {
    if (!a.canCollideWith(b)) return false

    this.stats.totalChecks++

    // Actualizar posiciones
    a.updateWorldPosition()
    b.updateWorldPosition()

    // Detección según tipos
    if (a.type === ColliderType.SPHERE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.CAPSULE) {
      return a.intersectsCapsule(b)
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.CAPSULE) {
      return b.intersectsSphere(a)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.BOX) {
      return a.intersectsBox(b)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.BOX) {
      return b.intersectsSphere(a)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CAPSULE) {
      // Simplificación: tratar cápsula como esfera
      return a.intersectsSphere({
        worldPosition: b.worldPosition,
        radius: b.radius,
      })
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.BOX) {
      return b.intersectsSphere({
        worldPosition: a.worldPosition,
        radius: a.radius,
      })
    }

    return false
  }

  /**
   * Obtiene la respuesta de colisión entre dos colisionadores
   */
  getCollisionResponse(a, b) {
    a.updateWorldPosition()
    b.updateWorldPosition()

    if (a.type === ColliderType.SPHERE) {
      if (b.type === ColliderType.SPHERE) {
        return a.getCollisionResponse(b)
      }
      if (b.type === ColliderType.BOX) {
        const response = b.getCollisionResponseForSphere(a)
        return response
      }
    }

    if (a.type === ColliderType.CAPSULE) {
      return a.getCollisionResponse(b)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.SPHERE) {
      return a.getCollisionResponseForSphere(b)
    }

    // Fallback: usar dirección simple
    const direction = new THREE.Vector3().subVectors(a.worldPosition, b.worldPosition).normalize()

    return {
      direction: direction,
      overlap: 0.1,
      normal: direction.clone(),
    }
  }

  /**
   * Resuelve la colisión empujando los objetos
   */
  resolveCollision(a, b, response) {
    // No resolver si alguno es trigger o si ambos son estáticos
    if (a.isTrigger || b.isTrigger) return
    if (a.isStatic && b.isStatic) return

    const pushVector = response.direction.clone().multiplyScalar(response.overlap)

    if (a.isStatic) {
      // Solo mover B
      if (b.parent) {
        b.parent.position.sub(pushVector)
      }
    } else if (b.isStatic) {
      // Solo mover A
      if (a.parent) {
        a.parent.position.add(pushVector)
      }
    } else {
      // Mover ambos a la mitad
      const halfPush = pushVector.multiplyScalar(0.5)
      if (a.parent) {
        a.parent.position.add(halfPush)
      }
      if (b.parent) {
        b.parent.position.sub(halfPush)
      }
    }
  }

  /**
   * Actualiza el sistema de colisiones
   */
  update() {
    const startTime = performance.now()
    this.stats.totalChecks = 0
    this.stats.collisionsDetected = 0

    const collidersArray = Array.from(this.colliders.values())
    const currentCollisions = new Map() // Map<string, {a, b}>

    // Actualizar posiciones y debug meshes
    for (const collider of collidersArray) {
      collider.updateWorldPosition()
      if (this.debugMode) {
        collider.updateDebugMesh()
      }
    }

    // Verificar todas las combinaciones de colisiones
    for (let i = 0; i < collidersArray.length; i++) {
      for (let j = i + 1; j < collidersArray.length; j++) {
        const a = collidersArray[i]
        const b = collidersArray[j]

        if (this.checkCollision(a, b)) {
          this.stats.collisionsDetected++

          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
          currentCollisions.set(pairKey, { a, b })

          // Determinar si es una nueva colisión o continua
          const wasCollidingA = a.activeCollisions.has(b.id)
          const wasCollidingB = b.activeCollisions.has(a.id)

          // Resolver colisión física
          const response = this.getCollisionResponse(a, b)

          if (!wasCollidingA) {
            a.activeCollisions.add(b.id)
            b.activeCollisions.add(a.id)

            // Callback onCollisionEnter
            if (a.onCollisionEnter) a.onCollisionEnter(b, response)
            // Para B, la normal es invertida
            const responseForB = { ...response, normal: response.normal.clone().negate(), direction: response.direction.clone().negate() }
            if (b.onCollisionEnter) b.onCollisionEnter(a, responseForB)
          } else {
            // Callback onCollisionStay
            if (a.onCollisionStay) a.onCollisionStay(b, response)
            // Para B, la normal es invertida
            const responseForB = { ...response, normal: response.normal.clone().negate(), direction: response.direction.clone().negate() }
            if (b.onCollisionStay) b.onCollisionStay(a, responseForB)
          }

          this.resolveCollision(a, b, response)
        }
      }
    }

    // Detectar colisiones que terminaron
    for (const collider of collidersArray) {
      const toRemove = []

      for (const otherId of collider.activeCollisions) {
        const other = this.colliders.get(otherId)
        if (!other) {
          toRemove.push(otherId)
          continue
        }

        const pairKey = collider.id < otherId ? `${collider.id}:${otherId}` : `${otherId}:${collider.id}`

        if (!currentCollisions.has(pairKey)) {
          toRemove.push(otherId)

          // Callback onCollisionExit
          if (collider.onCollisionExit) collider.onCollisionExit(other)
        }
      }

      for (const id of toRemove) {
        collider.activeCollisions.delete(id)
      }
    }

    this.stats.lastUpdateTime = performance.now() - startTime
  }

  /**
   * Raycast contra todos los colisionadores
   */
  raycast(origin, direction, maxDistance = Number.POSITIVE_INFINITY, layerMask = CollisionLayer.ALL) {
    const results = []
    const ray = new THREE.Ray(origin, direction.normalize())

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue
      if ((collider.layer & layerMask) === 0) continue

      collider.updateWorldPosition()

      let intersection = null

      if (collider.type === ColliderType.SPHERE) {
        const sphere = new THREE.Sphere(collider.worldPosition, collider.radius)
        const target = new THREE.Vector3()
        intersection = ray.intersectSphere(sphere, target)
      } else if (collider.type === ColliderType.BOX) {
        collider.updateBounds()
        const box = new THREE.Box3(collider.min, collider.max)
        const target = new THREE.Vector3()
        intersection = ray.intersectBox(box, target)
      }

      if (intersection) {
        const distance = origin.distanceTo(intersection)
        if (distance <= maxDistance) {
          results.push({
            collider: collider,
            point: intersection,
            distance: distance,
          })
        }
      }
    }

    // Ordenar por distancia
    results.sort((a, b) => a.distance - b.distance)

    return results
  }

  /**
   * Obtiene todos los colisionadores en un radio
   */
  overlapSphere(center, radius, layerMask = CollisionLayer.ALL) {
    const results = []

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue
      if ((collider.layer & layerMask) === 0) continue

      collider.updateWorldPosition()

      const distance = center.distanceTo(collider.worldPosition)
      const effectiveRadius = radius + (collider.radius || 0)

      if (distance <= effectiveRadius) {
        results.push(collider)
      }
    }

    return results
  }

  /**
   * Limpia todos los colisionadores
   */
  dispose() {
    for (const collider of this.colliders.values()) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh)
      }
      collider.dispose()
    }
    this.colliders.clear()
  }
}

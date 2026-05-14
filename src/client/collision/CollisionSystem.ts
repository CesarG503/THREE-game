import * as THREE from "three";
import { ColliderType, CollisionLayer } from "./Collider";
import type { CollisionResponse, CollisionStats, ColliderId } from "../types";
import type { Collider } from "./Collider";

type CollisionPrimitive = Collider<any> & {
  createDebugMesh?: (scene: THREE.Scene) => void;
  updateDebugMesh?: () => void;
  intersectsSphere?: (other: any) => boolean;
  intersectsCapsule?: (other: any) => boolean;
  intersectsBox?: (other: any) => boolean;
  getCollisionResponse?: (other: any) => CollisionResponse;
  getCollisionResponseForSphere?: (other: any) => CollisionResponse;
  getCollisionResponseForBox?: (other: any) => CollisionResponse;
  updateBounds?: () => void;
  min?: THREE.Vector3;
  max?: THREE.Vector3;
  radius?: number;
  height?: number;
  size?: THREE.Vector3;
  rotation?: THREE.Euler;
};

/**
 * Sistema central de deteccion y resolucion de colisiones
 */
export class CollisionSystem {
  scene: THREE.Scene;
  colliders: Map<ColliderId, CollisionPrimitive>;
  debugMode: boolean;
  stats: CollisionStats;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.colliders = new Map();
    this.debugMode = false;

    // Estadisticas para optimizacion
    this.stats = {
      totalChecks: 0,
      collisionsDetected: 0,
      lastUpdateTime: 0
    };
  }

  /**
   * Registra un colisionador en el sistema
   */
  addCollider(collider: CollisionPrimitive) {
    if (this.colliders.has(collider.id)) {
      console.warn(`[CollisionSystem] Collider ${collider.id} already exists`);
      return;
    }

    this.colliders.set(collider.id, collider);

    if (this.debugMode) {
      collider.createDebugMesh(this.scene);
      collider.setDebugVisible(true, this.scene);
    }

    return collider;
  }

  /**
   * Elimina un colisionador del sistema
   */
  removeCollider(colliderId: ColliderId) {
    const collider = this.colliders.get(colliderId);
    if (collider) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh);
      }
      collider.dispose();
      this.colliders.delete(colliderId);
    }
  }

  /**
   * Obtiene un colisionador por ID
   */
  getCollider(colliderId: ColliderId) {
    return this.colliders.get(colliderId);
  }

  /**
   * Activa/desactiva modo debug para todos los colisionadores
   */
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;

    this.colliders.forEach((collider) => {
      if (enabled && !collider.debugMesh) {
        collider.createDebugMesh(this.scene);
      }
      collider.setDebugVisible(enabled, this.scene);
    });
  }

  /**
   * Verifica colision entre dos colisionadores
   */
  checkCollision(a: CollisionPrimitive, b: CollisionPrimitive) {
    if (!a.canCollideWith(b)) return false;

    this.stats.totalChecks++;

    a.updateWorldPosition();
    b.updateWorldPosition();

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b);
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.CAPSULE) {
      return a.intersectsCapsule(b);
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b);
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.CAPSULE) {
      return b.intersectsSphere(a);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.BOX) {
      return a.intersectsBox(b);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b);
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.BOX) {
      return b.intersectsSphere(a);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CAPSULE) {
      const feetPos = b.worldPosition.clone().add(new THREE.Vector3(0, -b.height / 2 + b.radius, 0));
      const hitFeet = a.intersectsSphere({
        worldPosition: feetPos,
        radius: b.radius
      });
      if (hitFeet) return true;

      return a.intersectsSphere({
        worldPosition: b.worldPosition,
        radius: b.radius
      });
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.BOX) {
      const feetPos = a.worldPosition.clone().add(new THREE.Vector3(0, -a.height / 2 + a.radius, 0));
      const hitFeet = b.intersectsSphere({
        worldPosition: feetPos,
        radius: a.radius
      });
      if (hitFeet) return true;

      return b.intersectsSphere({
        worldPosition: a.worldPosition,
        radius: a.radius
      });
    }

    if (a.type === ColliderType.CYLINDER && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b);
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.CYLINDER) {
      return b.intersectsSphere(a);
    }

    if (a.type === ColliderType.CYLINDER && b.type === ColliderType.BOX) {
      return a.intersectsBox(b);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CYLINDER) {
      return b.intersectsBox(a);
    }

    return false;
  }

  /**
   * Obtiene la respuesta de colision entre dos colisionadores
   */
  getCollisionResponse(a: CollisionPrimitive, b: CollisionPrimitive): CollisionResponse {
    a.updateWorldPosition();
    b.updateWorldPosition();

    if (a.type === ColliderType.SPHERE) {
      if (b.type === ColliderType.SPHERE) {
        return a.getCollisionResponse(b);
      }
      if (b.type === ColliderType.BOX) {
        return b.getCollisionResponseForSphere(a);
      }
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.BOX) {
      const feetPos = a.worldPosition.clone().add(new THREE.Vector3(0, -a.height / 2 + a.radius, 0));
      const hitFeet = b.intersectsSphere({ worldPosition: feetPos, radius: a.radius });

      if (hitFeet) {
        return b.getCollisionResponseForSphere({ worldPosition: feetPos, radius: a.radius });
      }
      return b.getCollisionResponseForSphere({ worldPosition: a.worldPosition, radius: a.radius });
    }

    if (a.type === ColliderType.CAPSULE) {
      return a.getCollisionResponse(b);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CAPSULE) {
      const feetPos = b.worldPosition.clone().add(new THREE.Vector3(0, -b.height / 2 + b.radius, 0));
      const hitFeet = a.intersectsSphere({ worldPosition: feetPos, radius: b.radius });

      if (hitFeet) {
        const response = a.getCollisionResponseForSphere({ worldPosition: feetPos, radius: b.radius });
        return {
          direction: response.direction.clone().negate(),
          overlap: response.overlap,
          normal: response.normal.clone().negate()
        };
      }

      const response = a.getCollisionResponseForSphere({ worldPosition: b.worldPosition, radius: b.radius });
      return {
        direction: response.direction.clone().negate(),
        overlap: response.overlap,
        normal: response.normal.clone().negate()
      };
    }

    if (a.type === ColliderType.CYLINDER && b.type === ColliderType.BOX) {
      return a.getCollisionResponseForBox(b);
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CYLINDER) {
      const response = b.getCollisionResponseForBox(a);
      return {
        direction: response.direction.clone().negate(),
        overlap: response.overlap,
        normal: response.normal.clone().negate()
      };
    }

    const direction = new THREE.Vector3().subVectors(a.worldPosition, b.worldPosition).normalize();

    return {
      direction: direction,
      overlap: 0.1,
      normal: direction.clone()
    };
  }

  /**
   * Resuelve la colision empujando los objetos
   */
  resolveCollision(a: CollisionPrimitive, b: CollisionPrimitive, response: CollisionResponse) {
    if (a.isTrigger || b.isTrigger) return;
    if (a.isStatic && b.isStatic) return;
    if (a.manualResolution || b.manualResolution) return;

    const pushVector = response.direction.clone().multiplyScalar(response.overlap);

    if (a.isStatic) {
      if (b.parent) {
        b.parent.position.sub(pushVector);
      }
    } else if (b.isStatic) {
      if (a.parent) {
        a.parent.position.add(pushVector);
      }
    } else {
      const halfPush = pushVector.multiplyScalar(0.5);
      if (a.parent) {
        a.parent.position.add(halfPush);
      }
      if (b.parent) {
        b.parent.position.sub(halfPush);
      }
    }
  }

  /**
   * Actualiza el sistema de colisiones
   */
  update() {
    const startTime = performance.now();
    this.stats.totalChecks = 0;
    this.stats.collisionsDetected = 0;

    const collidersArray = Array.from(this.colliders.values());
    const currentCollisions = new Map();

    for (const collider of collidersArray) {
      collider.updateWorldPosition();
      if (this.debugMode) {
        collider.updateDebugMesh();
      }
    }

    for (let i = 0; i < collidersArray.length; i++) {
      for (let j = i + 1; j < collidersArray.length; j++) {
        const a = collidersArray[i];
        const b = collidersArray[j];

        if (this.checkCollision(a, b)) {
          this.stats.collisionsDetected++;

          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          currentCollisions.set(pairKey, { a, b });

          const wasCollidingA = a.activeCollisions.has(b.id);
          const wasCollidingB = b.activeCollisions.has(a.id);

          const response = this.getCollisionResponse(a, b);

          if (!wasCollidingA) {
            a.activeCollisions.add(b.id);
            b.activeCollisions.add(a.id);

            if (a.onCollisionEnter) a.onCollisionEnter(b, response);
            const responseForB = {
              ...response,
              normal: response.normal.clone().negate(),
              direction: response.direction.clone().negate()
            };
            if (b.onCollisionEnter) b.onCollisionEnter(a, responseForB);
          } else {
            if (a.onCollisionStay) a.onCollisionStay(b, response);
            const responseForB = {
              ...response,
              normal: response.normal.clone().negate(),
              direction: response.direction.clone().negate()
            };
            if (b.onCollisionStay) b.onCollisionStay(a, responseForB);
          }

          this.resolveCollision(a, b, response);
        }
      }
    }

    for (const collider of collidersArray) {
      const toRemove: any[] = [];

      for (const otherId of collider.activeCollisions) {
        const other = this.colliders.get(otherId);
        if (!other) {
          toRemove.push(otherId);
          continue;
        }

        const pairKey = collider.id < otherId ? `${collider.id}:${otherId}` : `${otherId}:${collider.id}`;

        if (!currentCollisions.has(pairKey)) {
          toRemove.push(otherId);

          if (collider.onCollisionExit) collider.onCollisionExit(other, null);
        }
      }

      for (const id of toRemove) {
        collider.activeCollisions.delete(id);
      }
    }

    this.stats.lastUpdateTime = performance.now() - startTime;
  }

  /**
   * Raycast contra todos los colisionadores
   */
  raycast(origin: any, direction: any, maxDistance = Number.POSITIVE_INFINITY, layerMask = CollisionLayer.ALL) {
    const results = [];
    const ray = new THREE.Ray(origin, direction.normalize());

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue;
      if ((collider.layer & layerMask) === 0) continue;

      collider.updateWorldPosition();

      let intersection = null;

      if (collider.type === ColliderType.SPHERE) {
        const sphere = new THREE.Sphere(collider.worldPosition, collider.radius);
        const target = new THREE.Vector3();
        intersection = ray.intersectSphere(sphere, target);
      } else if (collider.type === ColliderType.BOX) {
        collider.updateBounds();
        const box = new THREE.Box3(collider.min, collider.max);
        const target = new THREE.Vector3();
        intersection = ray.intersectBox(box, target);
      }

      if (intersection) {
        const distance = origin.distanceTo(intersection);
        if (distance <= maxDistance) {
          let normal = new THREE.Vector3(0, 1, 0);

          if (collider.type === ColliderType.SPHERE) {
            normal.subVectors(intersection, collider.worldPosition).normalize();
          } else if (collider.type === ColliderType.BOX) {
            const invRotation = collider.rotation.clone();
            const quit = new THREE.Quaternion().setFromEuler(invRotation).invert();

            const localPoint = intersection.clone().sub(collider.worldPosition).applyQuaternion(quit);

            const halfSize = collider.size.clone().multiplyScalar(0.5);
            const bias = 0.001;

            if (Math.abs(localPoint.x - halfSize.x) < bias) normal.set(1, 0, 0);
            else if (Math.abs(localPoint.x + halfSize.x) < bias) normal.set(-1, 0, 0);
            else if (Math.abs(localPoint.y - halfSize.y) < bias) normal.set(0, 1, 0);
            else if (Math.abs(localPoint.y + halfSize.y) < bias) normal.set(0, -1, 0);
            else if (Math.abs(localPoint.z - halfSize.z) < bias) normal.set(0, 0, 1);
            else if (Math.abs(localPoint.z + halfSize.z) < bias) normal.set(0, 0, -1);
            else {
              normal.set(0, 1, 0);
            }

            normal.applyEuler(collider.rotation).normalize();
          }

          results.push({
            collider: collider,
            point: intersection,
            distance: distance,
            normal: normal
          });
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);

    return results;
  }

  /**
   * Obtiene todos los colisionadores en un radio
   */
  overlapSphere(center: any, radius: number, layerMask = CollisionLayer.ALL) {
    const results = [];

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue;
      if ((collider.layer & layerMask) === 0) continue;

      collider.updateWorldPosition();

      const distance = center.distanceTo(collider.worldPosition);
      const effectiveRadius = radius + (collider.radius || 0);

      if (distance <= effectiveRadius) {
        results.push(collider);
      }
    }

    return results;
  }

  /**
   * Limpia todos los colisionadores
   */
  dispose() {
    for (const collider of this.colliders.values()) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh);
      }
      collider.dispose();
    }
    this.colliders.clear();
  }
}

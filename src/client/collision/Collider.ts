import * as THREE from "three";
import type { ColliderId, ColliderOptions, CollisionCallback } from "../types";
import { ColliderType, CollisionLayer } from "../types";

export { ColliderType, CollisionLayer } from "../types";

/**
 * Clase base para todos los colisionadores
 */
export class Collider<TUser = any> {
  id: ColliderId;
  type: ColliderType;
  layer: number;
  collidesWithMask: number;
  isTrigger: boolean;
  isStatic: boolean;
  enabled: boolean;
  manualResolution: boolean;
  parent: THREE.Object3D | null;
  offset: THREE.Vector3;
  worldPosition: THREE.Vector3;
  userData: TUser;
  onCollisionEnter: CollisionCallback<TUser> | null;
  onCollisionStay: CollisionCallback<TUser> | null;
  onCollisionExit: CollisionCallback<TUser> | null;
  activeCollisions: Set<ColliderId>;
  debugMesh: THREE.Mesh | null;
  showDebug: boolean;

  constructor(options: ColliderOptions<TUser> = {}) {
    const generateUUID = () =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });

    this.id = options.id || generateUUID();
    this.type = options.type || ColliderType.SPHERE;
    this.layer = options.layer || CollisionLayer.ENVIRONMENT;
    this.collidesWithMask = options.collidesWithMask || CollisionLayer.ALL;
    this.isTrigger = options.isTrigger || false;
    this.isStatic = options.isStatic || false;
    this.manualResolution = options.manualResolution || false;
    this.enabled = true;

    // Referencia al objeto padre (modelo 3D)
    this.parent = options.parent || null;

    // Offset relativo al padre
    this.offset = options.offset || new THREE.Vector3(0, 0, 0);

    // Posicion mundial actual
    this.worldPosition = new THREE.Vector3();

    // Datos del usuario para callbacks
    this.userData = (options.userData ?? {}) as TUser;

    // Callbacks de colision
    this.onCollisionEnter = options.onCollisionEnter || null;
    this.onCollisionStay = options.onCollisionStay || null;
    this.onCollisionExit = options.onCollisionExit || null;

    // Set para trackear colisiones activas
    this.activeCollisions = new Set<ColliderId>();

    // Helper visual para debug
    this.debugMesh = null;
    this.showDebug = false;
  }

  /**
   * Actualiza la posicion mundial del colisionador
   */
  updateWorldPosition() {
    if (this.parent) {
      this.worldPosition.copy(this.parent.position).add(this.offset);
    }
  }

  /**
   * Verifica si puede colisionar con otro collider basado en las capas
   */
  canCollideWith(other: Collider) {
    if (!this.enabled || !other.enabled) return false;
    if (this === other) return false;

    // Verificar mascaras de colision bidireccionales
    const thisCanHitOther = (this.collidesWithMask & other.layer) !== 0;
    const otherCanHitThis = (other.collidesWithMask & this.layer) !== 0;

    return thisCanHitOther && otherCanHitThis;
  }

  /**
   * Activa/desactiva visualizacion de debug
   */
  setDebugVisible(visible: boolean, scene: any) {
    this.showDebug = visible;
    if (this.debugMesh) {
      this.debugMesh.visible = visible;
    }
  }

  /**
   * Limpia recursos
   */
  dispose() {
    if (this.debugMesh) {
      if (this.debugMesh.geometry) this.debugMesh.geometry.dispose();
      if (this.debugMesh.material) {
        if (Array.isArray(this.debugMesh.material)) {
          this.debugMesh.material.forEach((material) => material.dispose());
        } else {
          this.debugMesh.material.dispose();
        }
      }
    }
    this.activeCollisions.clear();
  }
}

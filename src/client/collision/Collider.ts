import * as THREE from "three";

/**
 * Tipos de colisionadores disponibles
 */
export const ColliderType = {
  SPHERE: "sphere",
  BOX: "box",
  CAPSULE: "capsule",
  CYLINDER: "cylinder"
};

/**
 * Capas de colision para filtrar interacciones
 */
export const CollisionLayer = {
  NONE: 0,
  PLAYER: 1 << 0,
  REMOTE_PLAYER: 1 << 1,
  NPC: 1 << 2,
  ENVIRONMENT: 1 << 3,
  GROUND: 1 << 4,
  TRIGGER: 1 << 5,
  ALL: 0xffffffff
};

/**
 * Clase base para todos los colisionadores
 */
export class Collider {
  id: any;
  type: string;
  layer: number;
  collidesWithMask: number;
  isTrigger: boolean;
  isStatic: boolean;
  enabled: boolean;
  manualResolution: boolean;
  parent: any;
  offset: THREE.Vector3;
  worldPosition: THREE.Vector3;
  userData: any;
  onCollisionEnter: any;
  onCollisionStay: any;
  onCollisionExit: any;
  activeCollisions: Set<any>;
  debugMesh: any;
  showDebug: boolean;

  constructor(options: any = {}) {
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
    this.userData = options.userData || {};

    // Callbacks de colision
    this.onCollisionEnter = options.onCollisionEnter || null;
    this.onCollisionStay = options.onCollisionStay || null;
    this.onCollisionExit = options.onCollisionExit || null;

    // Set para trackear colisiones activas
    this.activeCollisions = new Set();

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
  canCollideWith(other: any) {
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
      if (this.debugMesh.material) this.debugMesh.material.dispose();
    }
    this.activeCollisions.clear();
  }
}

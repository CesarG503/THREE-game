import * as THREE from "three";
import { Collider, ColliderType } from "./Collider";
import type { CollisionResponse, SphereColliderOptions } from "../types";

/**
 * Colisionador esferico - ideal para personajes y objetos simples
 */
export class SphereCollider extends Collider {
  radius: number;

  constructor(options: SphereColliderOptions = {}) {
    super({ ...options, type: ColliderType.SPHERE });
    this.radius = options.radius || 0.5;
  }

  /**
   * Crea el mesh de debug
   */
  createDebugMesh(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.isTrigger ? 0x00ff00 : 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.userData.ignoreRaycast = true;
    this.debugMesh.visible = this.showDebug;
    scene.add(this.debugMesh);
  }

  /**
   * Actualiza la posicion del mesh de debug
   */
  updateDebugMesh() {
    if (this.debugMesh) {
      this.debugMesh.position.copy(this.worldPosition);
    }
  }

  /**
   * Verifica colision esfera-esfera
   */
  intersectsSphere(other: { worldPosition: THREE.Vector3; radius: number }) {
    const distance = this.worldPosition.distanceTo(other.worldPosition);
    const combinedRadius = this.radius + other.radius;
    return distance < combinedRadius;
  }

  /**
   * Calcula la respuesta de colision (push-back)
   */
  getCollisionResponse(other: { worldPosition: THREE.Vector3; radius: number }): CollisionResponse {
    const direction = new THREE.Vector3()
      .subVectors(this.worldPosition, other.worldPosition)
      .normalize();

    const distance = this.worldPosition.distanceTo(other.worldPosition);
    const overlap = this.radius + other.radius - distance;

    return {
      direction: direction,
      overlap: Math.max(0, overlap),
      normal: direction.clone()
    };
  }
}

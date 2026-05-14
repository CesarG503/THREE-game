import * as THREE from "three";
import { Collider, ColliderType } from "./Collider";
import type { CapsuleColliderOptions, CollisionResponse } from "../types";

/**
 * Colisionador de capsula - ideal para personajes humanoides
 */
export class CapsuleCollider extends Collider {
  radius: number;
  height: number;
  pointA: THREE.Vector3;
  pointB: THREE.Vector3;

  constructor(options: CapsuleColliderOptions = {}) {
    super({ ...options, type: ColliderType.CAPSULE });
    this.radius = options.radius || 0.3;
    this.height = options.height || 1.8;

    // Puntos de la linea central de la capsula
    this.pointA = new THREE.Vector3();
    this.pointB = new THREE.Vector3();
  }

  /**
   * Actualiza los puntos de la capsula
   */
  updateCapsulePoints() {
    const halfHeight = (this.height - this.radius * 2) / 2;
    this.pointA.copy(this.worldPosition).y -= halfHeight;
    this.pointB.copy(this.worldPosition).y += halfHeight;
  }

  /**
   * Crea el mesh de debug
   */
  createDebugMesh(scene: any) {
    const geometry = new THREE.CapsuleGeometry(this.radius, this.height - this.radius * 2, 8, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.isTrigger ? 0x00ff00 : 0x0088ff,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.debugMesh = new THREE.Mesh(geometry, material);
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
   * Punto mas cercano en un segmento de linea
   */
  closestPointOnSegment(point: THREE.Vector3, segStart: THREE.Vector3, segEnd: THREE.Vector3) {
    const seg = new THREE.Vector3().subVectors(segEnd, segStart);
    const t = Math.max(
      0,
      Math.min(1, new THREE.Vector3().subVectors(point, segStart).dot(seg) / seg.lengthSq())
    );
    return new THREE.Vector3().copy(segStart).addScaledVector(seg, t);
  }

  /**
   * Verifica colision capsula-capsula
   */
  intersectsCapsule(other: CapsuleCollider) {
    this.updateCapsulePoints();
    other.updateCapsulePoints();

    const closestOnThis = this.closestPointsOnSegments(this.pointA, this.pointB, other.pointA, other.pointB);

    const distance = closestOnThis.closestA.distanceTo(closestOnThis.closestB);
    const combinedRadius = this.radius + other.radius;

    return distance < combinedRadius;
  }

  /**
   * Encuentra los puntos mas cercanos entre dos segmentos
   */
  closestPointsOnSegments(a1: THREE.Vector3, a2: THREE.Vector3, b1: THREE.Vector3, b2: THREE.Vector3) {
    const d1 = new THREE.Vector3().subVectors(a2, a1);
    const d2 = new THREE.Vector3().subVectors(b2, b1);
    const r = new THREE.Vector3().subVectors(a1, b1);

    const a = d1.dot(d1);
    const e = d2.dot(d2);
    const f = d2.dot(r);

    let s;
    let t;

    if (a <= 0.0001 && e <= 0.0001) {
      s = t = 0;
    } else if (a <= 0.0001) {
      s = 0;
      t = Math.max(0, Math.min(1, f / e));
    } else {
      const c = d1.dot(r);
      if (e <= 0.0001) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else {
        const b = d1.dot(d2);
        const denom = a * e - b * b;

        if (denom !== 0) {
          s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
        } else {
          s = 0;
        }

        t = (b * s + f) / e;

        if (t < 0) {
          t = 0;
          s = Math.max(0, Math.min(1, -c / a));
        } else if (t > 1) {
          t = 1;
          s = Math.max(0, Math.min(1, (b - c) / a));
        }
      }
    }

    const closestA = new THREE.Vector3().copy(a1).addScaledVector(d1, s);
    const closestB = new THREE.Vector3().copy(b1).addScaledVector(d2, t);

    return { closestA, closestB };
  }

  /**
   * Verifica colision capsula-esfera
   */
  intersectsSphere(sphereCollider: { worldPosition: THREE.Vector3; radius: number }) {
    this.updateCapsulePoints();

    const closest = this.closestPointOnSegment(sphereCollider.worldPosition, this.pointA, this.pointB);

    const distance = closest.distanceTo(sphereCollider.worldPosition);
    const combinedRadius = this.radius + sphereCollider.radius;

    return distance < combinedRadius;
  }

  /**
   * Calcula la respuesta de colision
   */
  getCollisionResponse(other: { type?: ColliderType; radius?: number; worldPosition: THREE.Vector3; updateCapsulePoints?: () => void; pointA?: THREE.Vector3; pointB?: THREE.Vector3 }): CollisionResponse {
    this.updateCapsulePoints();

    let closestOnThis;
    let closestOnOther;

    if (other.type === ColliderType.CAPSULE) {
      other.updateCapsulePoints();
      const points = this.closestPointsOnSegments(this.pointA, this.pointB, other.pointA, other.pointB);
      closestOnThis = points.closestA;
      closestOnOther = points.closestB;
    } else {
      closestOnThis = this.closestPointOnSegment(other.worldPosition, this.pointA, this.pointB);
      closestOnOther = other.worldPosition;
    }

    const direction = new THREE.Vector3().subVectors(closestOnThis, closestOnOther).normalize();

    const distance = closestOnThis.distanceTo(closestOnOther);
    const combinedRadius = this.radius + (other.radius || 0);
    const overlap = combinedRadius - distance;

    return {
      direction: direction,
      overlap: Math.max(0, overlap),
      normal: direction.clone()
    };
  }
}

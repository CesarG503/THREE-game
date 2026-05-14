import * as THREE from "three";
import { Collider, ColliderType } from "./Collider";

/**
 * Colisionador de caja - ideal para paredes, plataformas y objetos rectangulares
 */
export class BoxCollider extends Collider {
  size: THREE.Vector3;
  rotation: THREE.Euler;
  min: THREE.Vector3;
  max: THREE.Vector3;

  constructor(options: any = {}) {
    super({ ...options, type: ColliderType.BOX });
    this.size = options.size || new THREE.Vector3(1, 1, 1);
    this.rotation = options.rotation || new THREE.Euler(0, 0, 0);

    // AABB bounds (se actualizan con la posicion)
    this.min = new THREE.Vector3();
    this.max = new THREE.Vector3();
  }

  /**
   * Actualiza los bounds AABB
   */
  updateBounds() {
    const halfSize = this.size.clone().multiplyScalar(0.5);
    this.min.copy(this.worldPosition).sub(halfSize);
    this.max.copy(this.worldPosition).add(halfSize);
  }

  /**
   * Crea el mesh de debug
   */
  createDebugMesh(scene: any) {
    const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const material = new THREE.MeshBasicMaterial({
      color: this.isTrigger ? 0x00ff00 : 0xff8800,
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
      this.debugMesh.rotation.copy(this.rotation);
    }
  }

  /**
   * Verifica colision AABB vs AABB
   */
  intersectsBox(other: any) {
    this.updateBounds();
    other.updateBounds();

    return (
      this.min.x <= other.max.x &&
      this.max.x >= other.min.x &&
      this.min.y <= other.max.y &&
      this.max.y >= other.min.y &&
      this.min.z <= other.max.z &&
      this.max.z >= other.min.z
    );
  }

  /**
   * Verifica colision OBB vs Esfera
   */
  intersectsSphere(sphereCollider: any) {
    // Transformar esfera al espacio local de la caja
    const boxToWorld = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(this.rotation);
    boxToWorld.compose(this.worldPosition, quaternion, new THREE.Vector3(1, 1, 1));

    const worldToBox = boxToWorld.clone().invert();

    const spherePosLocal = sphereCollider.worldPosition.clone().applyMatrix4(worldToBox);

    const halfSize = this.size.clone().multiplyScalar(0.5);

    // Encontrar punto mas cercano en la caja local
    const closestLocal = new THREE.Vector3();
    closestLocal.x = Math.max(-halfSize.x, Math.min(spherePosLocal.x, halfSize.x));
    closestLocal.y = Math.max(-halfSize.y, Math.min(spherePosLocal.y, halfSize.y));
    closestLocal.z = Math.max(-halfSize.z, Math.min(spherePosLocal.z, halfSize.z));

    const distance = closestLocal.distanceTo(spherePosLocal);
    return distance < sphereCollider.radius + 0.001;
  }

  /**
   * Calcula la respuesta de colision para una esfera (soportando rotacion)
   */
  getCollisionResponseForSphere(sphereCollider: any) {
    // Transformar esfera al espacio local
    const boxToWorld = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(this.rotation);
    boxToWorld.compose(this.worldPosition, quaternion, new THREE.Vector3(1, 1, 1));

    const worldToBox = boxToWorld.clone().invert();

    const spherePosLocal = sphereCollider.worldPosition.clone().applyMatrix4(worldToBox);
    const halfSize = this.size.clone().multiplyScalar(0.5);

    const closestLocal = new THREE.Vector3();
    closestLocal.x = Math.max(-halfSize.x, Math.min(spherePosLocal.x, halfSize.x));
    closestLocal.y = Math.max(-halfSize.y, Math.min(spherePosLocal.y, halfSize.y));
    closestLocal.z = Math.max(-halfSize.z, Math.min(spherePosLocal.z, halfSize.z));

    const distance = closestLocal.distanceTo(spherePosLocal);
    const overlap = sphereCollider.radius - distance;

    // Calcular direccion en local
    let directionLocal = new THREE.Vector3().subVectors(spherePosLocal, closestLocal).normalize();

    if (distance < 0.0001) {
      directionLocal.set(0, 1, 0);
    }

    const directionWorld = directionLocal.applyQuaternion(quaternion).normalize();

    return {
      direction: directionWorld,
      overlap: Math.max(0, overlap),
      normal: directionWorld.clone()
    };
  }
}

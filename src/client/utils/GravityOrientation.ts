import * as THREE from "three";

export type GravityOrientation = "down" | "up" | "left" | "right" | "front" | "back";

export const GRAVITY_ORIENTATION_OPTIONS: Array<{ value: GravityOrientation; label: string }> = [
  { value: "down", label: "Abajo" },
  { value: "up", label: "Arriba / Techo" },
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
  { value: "front", label: "Frente" },
  { value: "back", label: "Atrás" }
];

const GRAVITY_DIRECTIONS: Record<GravityOrientation, THREE.Vector3> = {
  down: new THREE.Vector3(0, -1, 0),
  up: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  front: new THREE.Vector3(0, 0, -1),
  back: new THREE.Vector3(0, 0, 1)
};

export function normalizeGravityOrientation(value: any): GravityOrientation {
  return value === "up" || value === "left" || value === "right" || value === "front" || value === "back" ? value : "down";
}

export function getGravityDirection(value: any) {
  return GRAVITY_DIRECTIONS[normalizeGravityOrientation(value)].clone();
}

export function getGravityUpVector(value: any) {
  return getGravityDirection(value).multiplyScalar(-1);
}

export function getGravityQuaternionFromUp(up: THREE.Vector3) {
  const normalizedUp = up.clone().normalize();
  if (normalizedUp.lengthSq() < 0.0001) {
    normalizedUp.set(0, 1, 0);
  }

  // Calculate basis forward and right vectors identically to the controllers
  let forward = new THREE.Vector3(0, 0, 1).projectOnPlane(normalizedUp);
  if (forward.lengthSq() < 0.0001) {
    forward = new THREE.Vector3(1, 0, 0).projectOnPlane(normalizedUp);
  }
  forward.normalize();

  const right = forward.clone().cross(normalizedUp).normalize();

  // Create a rotation matrix mapping:
  // - Local Y (0, 1, 0) -> normalizedUp
  // - Local Z (0, 0, 1) -> forward
  // - Local X (1, 0, 0) -> -right
  const matrix = new THREE.Matrix4();
  matrix.makeBasis(
    right.clone().multiplyScalar(-1), // col 0 (X)
    normalizedUp,                     // col 1 (Y)
    forward                           // col 2 (Z)
  );

  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

export function getGravityQuaternion(value: any) {
  return getGravityQuaternionFromUp(getGravityUpVector(value));
}

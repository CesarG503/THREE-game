import * as THREE from "three";

export type GravityOrientation = "down" | "up" | "left" | "right";

export const GRAVITY_ORIENTATION_OPTIONS: Array<{ value: GravityOrientation; label: string }> = [
  { value: "down", label: "Abajo" },
  { value: "up", label: "Arriba / Techo" },
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" }
];

const GRAVITY_DIRECTIONS: Record<GravityOrientation, THREE.Vector3> = {
  down: new THREE.Vector3(0, -1, 0),
  up: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0)
};

export function normalizeGravityOrientation(value: any): GravityOrientation {
  return value === "up" || value === "left" || value === "right" ? value : "down";
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
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedUp);
}

export function getGravityQuaternion(value: any) {
  return getGravityQuaternionFromUp(getGravityUpVector(value));
}

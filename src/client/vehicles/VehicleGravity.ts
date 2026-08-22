import * as THREE from 'three';
import { getGravityQuaternion, getGravityUpVector, GRAVITY_ORIENTATION_OPTIONS, normalizeGravityOrientation, type GravityOrientation } from '../utils/GravityOrientation';

const Y = new THREE.Vector3(0, 1, 0);
interface GravityState {
  orientation: GravityOrientation;
  frame: THREE.Quaternion;
  start?: THREE.Quaternion;
  elapsed: number;
  duration: number;
  normal?: THREE.Vector3;
  point?: THREE.Vector3;
}
const states = new WeakMap<THREE.Object3D, GravityState>();

export function orientationFromRotation(rotation: THREE.Quaternion): GravityOrientation {
  const up = Y.clone().applyQuaternion(rotation);
  return GRAVITY_ORIENTATION_OPTIONS.reduce((best, entry) =>
    getGravityUpVector(entry.value).dot(up) > getGravityUpVector(best).dot(up) ? entry.value : best, 'down' as GravityOrientation);
}

export function vehicleGravity(bike: THREE.Object3D): GravityState {
  let state = states.get(bike);
  if (!state) {
    const orientation = orientationFromRotation(bike.quaternion);
    state = { orientation, frame: getGravityQuaternion(orientation), elapsed: 0, duration: 0 };
    states.set(bike, state);
  }
  return state;
}
export function vehicleUp(bike: THREE.Object3D) { return Y.clone().applyQuaternion(vehicleGravity(bike).frame); }
export function vehicleHeading(bike: THREE.Object3D) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.quaternion).applyQuaternion(vehicleGravity(bike).frame.clone().invert());
  return Math.atan2(-forward.x, -forward.z);
}
export function beginVehicleGravity(bike: THREE.Object3D, orientation: any, duration: number, normal?: THREE.Vector3, point?: THREE.Vector3) {
  const state = vehicleGravity(bike);
  const target = normalizeGravityOrientation(orientation);
  if (state.orientation === target) return false;
  state.orientation = target;
  state.start = state.frame.clone();
  state.elapsed = 0;
  state.duration = Number.isFinite(duration) ? Math.max(0, duration) : 0.8;
  state.normal = normal?.clone();
  state.point = point?.clone();
  bike.userData.logicProperties.gravityOrientation = target;
  return true;
}
export function advanceVehicleGravity(bike: THREE.Object3D, dt: number) {
  const state = vehicleGravity(bike);
  if (!state.start) return;
  const yaw = vehicleHeading(bike);
  state.elapsed += dt;
  const t = state.duration === 0 ? 1 : Math.min(1, state.elapsed / state.duration);
  state.frame.copy(state.start).slerp(getGravityQuaternion(state.orientation), t * t * (3 - 2 * t));
  bike.quaternion.copy(state.frame).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
  // Keep the entire rotating collision box outside the pad's contact plane.
  if (state.normal && state.point) {
    const dims = bike.userData.originalScale;
    const extent = ['x', 'y', 'z'].reduce((sum, axis, i) => {
      const basis = new THREE.Vector3().setComponent(i, 1).applyQuaternion(bike.quaternion);
      return sum + Math.abs(basis.dot(state.normal!)) * dims[axis] / 2;
    }, 0);
    const clearance = bike.position.clone().sub(state.point).dot(state.normal);
    if (clearance < extent + 0.03) bike.position.addScaledVector(state.normal, extent + 0.03 - clearance);
  }
  if (t === 1) { state.start = undefined; state.normal = state.point = undefined; }
}
export function receiveVehicleGravity(bike: THREE.Object3D, orientation: any, frame: THREE.Quaternion, remaining = 0) {
  const state = vehicleGravity(bike);
  state.orientation = normalizeGravityOrientation(orientation);
  state.frame.copy(frame);
  state.duration = remaining;
  state.elapsed = 0;
  state.start = undefined;
  bike.userData.logicProperties.gravityOrientation = state.orientation;
}

/** Riders use the vehicle's exact frame; independent avatar interpolation would cause flicker. */
export function syncVehicleGravity(character: any, bike: THREE.Object3D) {
  const state = vehicleGravity(bike);
  character.currentGravityQuaternion?.copy(state.frame);
  character.targetGravityQuaternion?.copy(getGravityQuaternion(state.orientation));
  character.gravityOrientation = character.targetGravityOrientation = state.orientation;
  character.gravityTransitionActive = state.frame.angleTo(getGravityQuaternion(state.orientation)) > 0.0001;
  character.gravityTransitionStart?.copy(state.frame);
  character.gravityTransitionElapsed = 0;
  character.gravityTransitionDuration = Math.max(0.1, state.duration - state.elapsed);
  character.gravityContactAnchorPoint = character.gravityContactAnchorNormal = null;
  character.gravityContactPreserveTime = 0;
  character.applyGravityUpToPhysics?.();
  character.rigidBody?.setRotation?.(state.frame, true);
  character.rigidBody?.setNextKinematicRotation?.(state.frame);
  character.cameraController?.setGravityQuaternion?.(state.frame);
}

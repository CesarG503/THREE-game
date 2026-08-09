import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/** Brief collision-aware slide and procedural fall/get-up, without changing avatar animation settings. */
export class VehicleFall {
  active = false;
  private elapsed = 0;
  private velocity = new THREE.Vector3();
  private lastPosition = new THREE.Vector3();
  private rest = new Map<THREE.Object3D, THREE.Quaternion>();

  start(character: any, velocity: THREE.Vector3) {
    this.reset(character);
    this.active = true;
    this.elapsed = 0;
    this.velocity.copy(velocity).multiplyScalar(0.6);
    this.velocity.y = 0;
    this.lastPosition.copy(character.getPosition());
    character.isRunning = false;
  }

  update(character: any, controller: RAPIER.KinematicCharacterController, dt: number): boolean {
    if (!this.active) return false;
    if (character.isDead || !character.rigidBody?.isValid() || !character.collider?.isValid() ||
        character.getGravityUpVector().y < 0.99 || character.getPosition().distanceTo(this.lastPosition) > 4) {
      this.reset(character);
      return false;
    }
    this.elapsed += dt;
    this.velocity.x *= Math.exp(-4 * dt);
    this.velocity.z *= Math.exp(-4 * dt);
    this.velocity.y = Math.max(-40, this.velocity.y - 22 * dt);
    const physics = character.characterController || controller;
    physics.computeColliderMovement(character.collider, this.velocity.clone().multiplyScalar(dt),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, character.collider.collisionGroups());
    const movement = physics.computedMovement();
    const next = character.getPosition().add(new THREE.Vector3(movement.x, movement.y, movement.z));
    character.rigidBody.setNextKinematicTranslation(next);
    this.lastPosition.copy(next);
    character.grounded = physics.computedGrounded();
    if (character.grounded) this.velocity.y = 0;
    character.verticalVelocity = this.velocity.y;
    if (this.elapsed >= 1.5 && character.grounded) {
      this.reset(character);
      return true; // Keep the final collision-corrected translation for this physics step.
    }
    this.restoreJoints();
    character.updateModelVisuals();
    this.applyPose(character);
    return true;
  }

  private rotate(node: THREE.Object3D | undefined, x: number, z = 0) {
    if (!node) return;
    if (!this.rest.has(node)) this.rest.set(node, node.quaternion.clone());
    node.quaternion.copy(this.rest.get(node)!).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z)));
  }

  private applyPose(character: any) {
    const down = THREE.MathUtils.smoothstep(this.elapsed, 0, 0.25) *
      (1 - THREE.MathUtils.smoothstep(this.elapsed, 0.85, 1.5));
    for (const model of [character.glbModel?.model, character.polygonModel?.model, character.polygonModelSkin?.model]) {
      if (!model) continue;
      // Pivot at the hips, lowering the torso to the floor as it rolls onto its side.
      const base = model.quaternion.clone();
      const hip = new THREE.Vector3(0, 0.7, 0);
      model.rotateZ(down * Math.PI * 0.48);
      model.position.add(hip.clone().applyQuaternion(base)).sub(hip.applyQuaternion(model.quaternion));
      model.position.y -= down * 0.38;
    }
    const skin = character.polygonModelSkin;
    this.rotate(skin?.upperBodyGroup, -0.2 * down);
    this.rotate(skin?.leftArmGroup, -0.9 * down, -0.5 * down);
    this.rotate(skin?.rightArmGroup, -0.6 * down, 0.7 * down);
    this.rotate(skin?.leftLegGroup, -0.65 * down, -0.15 * down);
    this.rotate(skin?.rightLegGroup, 0.35 * down, 0.2 * down);
    const polygon = character.polygonModel;
    this.rotate(polygon?.polyLeftArm, -0.9 * down, -0.5 * down);
    this.rotate(polygon?.polyRightArm, -0.6 * down, 0.7 * down);
    this.rotate(polygon?.polyLeftLeg, -0.65 * down);
    this.rotate(polygon?.polyRightLeg, 0.35 * down);
    character.glbModel?.model?.traverse((node: any) => {
      if (!node.isBone) return;
      const name = node.name.toLowerCase();
      if (name.endsWith('leftupleg')) this.rotate(node, -0.65 * down);
      else if (name.endsWith('rightupleg')) this.rotate(node, 0.35 * down);
      else if (name.endsWith('leftarm')) this.rotate(node, -0.9 * down, -0.5 * down);
      else if (name.endsWith('rightarm')) this.rotate(node, -0.6 * down, 0.7 * down);
    });
  }

  private restoreJoints() {
    for (const [node, rotation] of this.rest) node.quaternion.copy(rotation);
  }

  reset(character: any) {
    if (!this.active) return;
    this.restoreJoints();
    this.rest.clear();
    this.active = false;
    character.updateModelVisuals();
  }
}

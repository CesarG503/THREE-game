import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/** Brief collision-aware slide and procedural fall/get-up, without changing avatar animation settings. */
export class VehicleFall {
  active = false;
  private elapsed = 0;
  private up = new THREE.Vector3(0, 1, 0);
  private velocity = new THREE.Vector3();
  private lastPosition = new THREE.Vector3();
  private rest = new Map<THREE.Object3D, THREE.Quaternion>();
  private dust: THREE.Points | null = null;
  private dustPositions: Float32Array | null = null;
  private dustSeed = 1;

  start(character: any, velocity: THREE.Vector3, scene?: THREE.Scene) {
    this.reset(character);
    this.active = true;
    this.elapsed = 0;
    this.velocity.copy(velocity).multiplyScalar(0.6);
    this.up.copy(character.getGravityUpVector());
    this.velocity.projectOnPlane(this.up);
    this.lastPosition.copy(character.getPosition());
    character.isRunning = false;
    if (scene) this.createDust(scene, this.lastPosition);
  }

  update(character: any, controller: RAPIER.KinematicCharacterController, dt: number): boolean {
    if (!this.active) return false;
    if (character.isDead || !character.rigidBody?.isValid() || !character.collider?.isValid() ||
        character.getPosition().distanceTo(this.lastPosition) > 4) {
      this.reset(character);
      return false;
    }
    this.elapsed += dt;
    this.up.copy(character.getGravityUpVector());
    const vertical = this.velocity.dot(this.up);
    this.velocity.projectOnPlane(this.up).multiplyScalar(Math.exp(-4 * dt));
    this.velocity.addScaledVector(this.up, Math.max(-40, vertical - 22 * dt));
    const physics = character.characterController || controller;
    physics.setUp(this.up);
    physics.computeColliderMovement(character.collider, this.velocity.clone().multiplyScalar(dt),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, character.collider.collisionGroups());
    const movement = physics.computedMovement();
    const next = character.getPosition().add(new THREE.Vector3(movement.x, movement.y, movement.z));
    character.rigidBody.setNextKinematicTranslation(next);
    this.lastPosition.copy(next);
    character.grounded = physics.computedGrounded();
    if (character.grounded) this.velocity.projectOnPlane(this.up);
    character.verticalVelocity = this.velocity.dot(this.up);
    this.updateDust(next);
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
      model.position.addScaledVector(this.up, -down * 0.38);
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

  private random() {
    this.dustSeed = (this.dustSeed * 1664525 + 1013904223) >>> 0;
    return this.dustSeed / 0xffffffff;
  }

  private createDust(scene: THREE.Scene, position: THREE.Vector3) {
    const count = 28;
    this.dustSeed = 1;
    this.dustPositions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({
      color: 0xb9a27b,
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.name = 'MotorbikeDismountDust';
    this.dust.frustumCulled = false;
    scene.add(this.dust);
    this.updateDust(position);
  }

  private updateDust(position: THREE.Vector3) {
    if (!this.dust || !this.dustPositions) return;
    const count = this.dustPositions.length / 3;
    const spread = 0.25 + Math.min(1.4, this.elapsed * 1.1);
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const radius = (0.12 + this.random() * spread) * (1 - i / count * 0.35);
      const lift = this.random() * 0.22 * (1 - Math.min(1, this.elapsed / 1.5));
      const offset = new THREE.Vector3(Math.cos(angle) * radius, 0.08 + lift, Math.sin(angle) * radius)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.up)).add(position);
      offset.toArray(this.dustPositions, i * 3);
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.dust.geometry.setDrawRange(0, count);
  }

  private removeDust() {
    if (!this.dust) return;
    this.dust.parent?.remove(this.dust);
    this.dust.geometry.dispose();
    const material = this.dust.material;
    if (Array.isArray(material)) material.forEach(item => item.dispose());
    else material.dispose();
    this.dust = null;
    this.dustPositions = null;
  }

  reset(character: any) {
    if (!this.active) return;
    this.restoreJoints();
    this.rest.clear();
    this.removeDust();
    this.active = false;
    character.updateModelVisuals();
  }
}

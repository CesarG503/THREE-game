import * as THREE from 'three';
import { LimbBender } from '../character/models/bending/LimbBender';

/** Procedural riding pose layered on the existing avatars; snapshots restore every edited joint. */
export class RiderPose {
  private rest = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion; visible: boolean }>();
  private bent = new Set<THREE.Mesh>();
  private time = 0;

  private remember(node: THREE.Object3D | null | undefined) {
    if (node && !this.rest.has(node)) this.rest.set(node, { position: node.position.clone(), quaternion: node.quaternion.clone(), visible: node.visible });
  }
  private rotate(node: THREE.Object3D | null | undefined, x: number, y = 0, z = 0) {
    if (!node) return;
    this.remember(node);
    node.quaternion.copy(this.rest.get(node)!.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
  }
  private bend(group: THREE.Group | null | undefined, angle: number) {
    group?.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        LimbBender.bend(child, 'joint', angle);
        this.bent.add(child);
      }
    });
  }
  apply(avatar: any, dt: number, speed: number, steer: number, leanDegrees: number) {
    this.time += dt;
    const skin = avatar.polygonModelSkin;
    if (skin?.model) {
      this.rotate(skin.pivotGroup, 0);
      if (skin.pivotGroup) skin.pivotGroup.position.set(0, 0.9, 0);
      this.rotate(skin.upperBodyGroup, THREE.MathUtils.degToRad(leanDegrees));
      if (skin.upperBodyGroup) {
        const hip = new THREE.Vector3(0, 0.625, 0);
        skin.upperBodyGroup.position.copy(hip).sub(hip.clone().applyQuaternion(skin.upperBodyGroup.quaternion));
      }
      this.rotate(skin.leftArmGroup, -1.0, -0.08 - steer * 0.12, -0.08);
      this.rotate(skin.rightArmGroup, -1.0, 0.08 - steer * 0.12, 0.08);
      this.rotate(skin.leftLegGroup, -1.15, -0.12, -0.22);
      this.rotate(skin.rightLegGroup, -1.15, 0.12, 0.22);
      if (skin.leftLegGroup) skin.leftLegGroup.position.x = -0.31;
      if (skin.rightLegGroup) skin.rightLegGroup.position.x = 0.31;
      this.bend(skin.leftArmGroup, -0.5);
      this.bend(skin.rightArmGroup, -0.5);
      this.bend(skin.leftLegGroup, 1.35);
      this.bend(skin.rightLegGroup, 1.35);
      for (const item of [skin.heldItemMesh, skin.backItemMesh]) {
        this.remember(item);
        if (item) item.visible = false;
      }
      skin.model.position.y += Math.sin(this.time * 18) * Math.min(Math.abs(speed) / 22, 1) * 0.008;
    }
    const polygon = avatar.polygonModel;
    if (polygon) {
      this.rotate(polygon.polyLeftArm, -1.15, -steer * 0.1, -0.08);
      this.rotate(polygon.polyRightArm, -1.15, -steer * 0.1, 0.08);
      this.rotate(polygon.polyLeftLeg, -1.15, 0, -0.2);
      this.rotate(polygon.polyRightLeg, -1.15, 0, 0.2);
    }
    // The Soldier GLB uses named humanoid bones. Apply from cached rest transforms, never cumulatively.
    avatar.glbModel?.model?.traverse((node: any) => {
      if (!node.isBone) return;
      const name = node.name.toLowerCase();
      if (name.endsWith('leftupleg') || name.endsWith('rightupleg')) this.rotate(node, -1.1);
      else if (name.endsWith('leftleg') || name.endsWith('rightleg')) this.rotate(node, 1.25);
      else if (name.endsWith('leftforearm') || name.endsWith('rightforearm')) this.rotate(node, -0.55);
      else if (name.endsWith('leftarm')) this.rotate(node, -0.9, 0, -0.65);
      else if (name.endsWith('rightarm')) this.rotate(node, -0.9, 0, 0.65);
    });
  }
  reset() {
    for (const [node, rest] of this.rest) {
      node.position.copy(rest.position);
      node.quaternion.copy(rest.quaternion);
      node.visible = rest.visible;
    }
    for (const mesh of this.bent) LimbBender.bend(mesh, 'none', 0);
    this.rest.clear();
    this.bent.clear();
    this.time = 0;
  }
}

import * as THREE from 'three';
import { LimbBender } from '../character/models/bending/LimbBender';

/** Procedural riding pose layered on the existing avatars; snapshots restore every edited joint. */
export class RiderPose {
  private rest = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion; visible: boolean }>();
  private bent = new Set<THREE.Mesh>();
  private glbBindPose = new Map<THREE.Object3D, THREE.Quaternion>();
  private time = 0;
  private punchTime = 0;

  private remember(node: THREE.Object3D | null | undefined) {
    if (node && !this.rest.has(node)) {
      this.rest.set(node, {
        position: node.position.clone(),
        quaternion: new THREE.Quaternion(), // Canonical rest for polygon model limbs is identity
        visible: node.visible
      });
    }
  }

  private setRotation(node: THREE.Object3D | null | undefined, x: number, y = 0, z = 0) {
    if (!node) return;
    this.remember(node);
    node.quaternion.setFromEuler(new THREE.Euler(x, y, z));
  }

  private rotateBone(node: THREE.Object3D | null | undefined, x: number, y = 0, z = 0) {
    if (!node) return;
    if (!this.glbBindPose.has(node)) {
      this.glbBindPose.set(node, node.quaternion.clone());
    }
    node.quaternion.copy(this.glbBindPose.get(node)!).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
  }

  private bend(group: THREE.Group | null | undefined, angle: number) {
    group?.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        LimbBender.bend(child, 'joint', angle);
        this.bent.add(child);
      }
    });
  }

  apply(
    avatar: any,
    dt: number,
    speed: number,
    steer: number,
    leanDegrees: number,
    passenger = false,
    bikeYaw = avatar.currentRotation || 0,
    aimDiff = 0,
    isAttacking = false
  ) {
    if (passenger) {
      this.applyPassenger(avatar, dt, bikeYaw, aimDiff, isAttacking);
      return;
    }
    this.time += dt;
    this.punchTime = 0;
    const skin = avatar.polygonModelSkin;
    if (skin?.model) {
      this.setRotation(skin.pivotGroup, 0);
      if (skin.pivotGroup) skin.pivotGroup.position.set(0, 0.9, 0);
      this.setRotation(skin.upperBodyGroup, THREE.MathUtils.degToRad(leanDegrees));
      if (skin.upperBodyGroup) {
        const hip = new THREE.Vector3(0, 0.625, 0);
        skin.upperBodyGroup.position.copy(hip).sub(hip.clone().applyQuaternion(skin.upperBodyGroup.quaternion));
      }

      // Conductor: Manos firmemente en el manubrio de la moto
      this.setRotation(skin.leftArmGroup, -1.0, -0.08 - steer * 0.12, -0.08);
      this.setRotation(skin.rightArmGroup, -1.0, 0.08 - steer * 0.12, 0.08);
      this.setRotation(skin.leftLegGroup, -1.15, -0.12, -0.22);
      this.setRotation(skin.rightLegGroup, -1.15, 0.12, 0.22);
      if (skin.leftLegGroup) skin.leftLegGroup.position.x = -0.31;
      if (skin.rightLegGroup) skin.rightLegGroup.position.x = 0.31;
      this.bend(skin.leftArmGroup, -0.5);
      this.bend(skin.rightArmGroup, -0.5);
      this.bend(skin.leftLegGroup, 1.35);
      this.bend(skin.rightLegGroup, 1.35);

      // Al conducir, cualquier objeto en mano se oculta para que ambas manos estén en el manubrio
      if (skin.heldItemMesh) {
        this.remember(skin.heldItemMesh);
        skin.heldItemMesh.visible = false;
      }
      skin.model.position.y += Math.sin(this.time * 18) * Math.min(Math.abs(speed) / 22, 1) * 0.008;
    }

    const polygon = avatar.polygonModel;
    if (polygon) {
      this.setRotation(polygon.polyLeftArm, -1.15, -steer * 0.1, -0.08);
      this.setRotation(polygon.polyRightArm, -1.15, -steer * 0.1, 0.08);
      this.setRotation(polygon.polyLeftLeg, -1.15, 0, -0.2);
      this.setRotation(polygon.polyRightLeg, -1.15, 0, 0.2);
    }

    // The Soldier GLB uses named humanoid bones. Apply from cached rest transforms, never cumulatively.
    avatar.glbModel?.model?.traverse((node: any) => {
      if (!node.isBone) return;
      const name = node.name.toLowerCase();
      if (name.endsWith('leftupleg') || name.endsWith('rightupleg')) this.rotateBone(node, -1.1);
      else if (name.endsWith('leftleg') || name.endsWith('rightleg')) this.rotateBone(node, 1.25);
      else if (name.endsWith('leftforearm') || name.endsWith('rightforearm')) this.rotateBone(node, -0.55);
      else if (name.endsWith('leftarm')) this.rotateBone(node, -0.9, 0, -0.65);
      else if (name.endsWith('rightarm')) this.rotateBone(node, -0.9, 0, 0.65);
    });
  }

  private applyPassenger(avatar: any, dt: number, bikeYaw: number, aimDiff = 0, isAttacking = false) {
    void bikeYaw;

    if (isAttacking || this.punchTime > 0) {
      this.punchTime += dt * 20;
      if (this.punchTime >= Math.PI * 2) {
        if (isAttacking) {
          this.punchTime %= (Math.PI * 2);
        } else {
          this.punchTime = 0;
        }
      }
    }
    const isPunching = this.punchTime > 0 || isAttacking;
    const punchSwing = isPunching ? (1 - Math.cos(this.punchTime)) * 0.5 : 0;

    const skin = avatar.polygonModelSkin;
    if (skin?.model) {
      this.setRotation(skin.pivotGroup, 0);
      if (skin.pivotGroup) skin.pivotGroup.position.set(0, 0.9, 0);

      // Las piernas se mantienen fijas a horcajadas en el asiento trasero
      this.setRotation(skin.leftLegGroup, -1.15, -0.12, -0.22);
      this.setRotation(skin.rightLegGroup, -1.15, 0.12, 0.22);
      if (skin.leftLegGroup) {
        skin.leftLegGroup.position.x = -0.30;
      }
      if (skin.rightLegGroup) {
        skin.rightLegGroup.position.x = 0.30;
      }
      this.bend(skin.leftLegGroup, 1.4);
      this.bend(skin.rightLegGroup, 1.4);

      // El torso superior rota suavemente con el apuntado permitido
      this.setRotation(skin.upperBodyGroup, 0.08, aimDiff, 0);
      if (skin.upperBodyGroup) {
        const hip = new THREE.Vector3(0, 0.625, 0);
        skin.upperBodyGroup.position.copy(hip).sub(hip.clone().applyQuaternion(skin.upperBodyGroup.quaternion));
      }

      // Brazo izquierdo: SIEMPRE abajo en postura natural de descanso
      this.setRotation(skin.leftArmGroup, -0.75, 0.15, -0.15);
      this.bend(skin.leftArmGroup, -0.7);

      // Brazo derecho: por defecto abajo en postura de descanso; al hacer click (isPunching) lanza golpe hacia adelante con una sola mano
      if (isPunching) {
        const punchRotX = THREE.MathUtils.lerp(-0.75, -1.8, punchSwing);
        const punchBend = THREE.MathUtils.lerp(-0.7, -0.15, punchSwing);
        this.setRotation(skin.rightArmGroup, punchRotX, -0.1, 0.05);
        this.bend(skin.rightArmGroup, punchBend);
      } else {
        this.setRotation(skin.rightArmGroup, -0.75, -0.15, 0.15);
        this.bend(skin.rightArmGroup, -0.7);
      }

      if (skin.heldItemMesh) {
        skin.heldItemMesh.visible = Boolean(avatar.isHoldingWeapon || avatar.currentWeaponInstance || avatar.equippedItem);
      }
    }

    const polygon = avatar.polygonModel;
    if (polygon) {
      this.setRotation(polygon.polyLeftLeg, -1.15, 0, -0.2);
      this.setRotation(polygon.polyRightLeg, -1.15, 0, 0.2);
      this.setRotation(polygon.polyBody, 0.08, aimDiff, 0);
      this.setRotation(polygon.polyLeftArm, -0.75, 0.15, -0.15);
      if (isPunching) {
        this.setRotation(polygon.polyRightArm, THREE.MathUtils.lerp(-0.75, -1.8, punchSwing), -0.1, 0.05);
      } else {
        this.setRotation(polygon.polyRightArm, -0.75, -0.15, 0.15);
      }
    }

    avatar.glbModel?.model?.traverse((node: any) => {
      if (!node.isBone) return;
      const name = node.name.toLowerCase();
      if (name.endsWith('leftupleg')) this.rotateBone(node, -1.1, 0, -0.22);
      else if (name.endsWith('rightupleg')) this.rotateBone(node, -1.1, 0, 0.22);
      else if (name.endsWith('leftleg') || name.endsWith('rightleg')) this.rotateBone(node, 1.35);
      else if (name.endsWith('spine') || name.endsWith('spine1')) this.rotateBone(node, 0.04, aimDiff * 0.5, 0);
      else if (name.endsWith('leftarm')) this.rotateBone(node, -0.7, 0.15, -0.25);
      else if (name.endsWith('leftforearm')) this.rotateBone(node, -0.55);
      else if (name.endsWith('rightarm')) {
        const rightRot = isPunching ? THREE.MathUtils.lerp(-0.7, -1.75, punchSwing) : -0.7;
        this.rotateBone(node, rightRot, -0.15, 0.25);
      } else if (name.endsWith('rightforearm')) {
        const forearmRot = isPunching ? THREE.MathUtils.lerp(-0.55, -0.15, punchSwing) : -0.55;
        this.rotateBone(node, forearmRot);
      }
    });
  }

  reset(avatar?: any) {
    for (const [node, rest] of this.rest) {
      node.position.copy(rest.position);
      node.quaternion.copy(rest.quaternion);
      if (node === avatar?.polygonModelSkin?.heldItemMesh) {
        node.visible = Boolean(avatar?.equippedItem || avatar?.currentWeaponInstance);
      } else {
        node.visible = rest.visible;
      }
    }
    for (const [node, bindQuat] of this.glbBindPose) {
      node.quaternion.copy(bindQuat);
    }
    for (const mesh of this.bent) LimbBender.bend(mesh, 'none', 0);
    this.rest.clear();
    this.bent.clear();
    this.time = 0;
    this.punchTime = 0;

    if (avatar?.polygonModelSkin?.heldItemMesh) {
      avatar.polygonModelSkin.heldItemMesh.visible = Boolean(avatar?.equippedItem || avatar?.currentWeaponInstance);
    }
  }
}

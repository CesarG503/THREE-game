import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ItemLike } from "../types";

export class DroppedItem {
  scene: THREE.Scene;
  world: any;
  item: ItemLike;
  isCollected: boolean;
  mesh: THREE.Group;
  visualContainer: THREE.Group;
  rigidBody: any;
  collider: any;
  timeOffset: number;
  dropId: string;
  torque: { x: number; y: number; z: number } | null;
  networkManaged: boolean;
  lastRemoteStateAt: number;
  lastRemoteAuthorityId: string | null;

  constructor(scene: THREE.Scene, world: any, item: ItemLike, position: { x: number; y: number; z: number }) {
    this.scene = scene;
    this.world = world;
    this.item = item;
    this.isCollected = false;

    this.mesh = new THREE.Group();

    this.visualContainer = new THREE.Group();
    this.mesh.add(this.visualContainer);

    const itemMesh = item.getDisplayMesh();
    if (itemMesh) {
      const clone = itemMesh.clone();
      clone.castShadow = true;

      this.visualContainer.add(clone);
    } else {
      const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      const cube = new THREE.Mesh(geo, mat);
      this.visualContainer.add(cube);
    }

    this.scene.add(this.mesh);

    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(1.0)
      .setAngularDamping(1.0);

    this.rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(0.3)
      .setRestitution(0.5)
      .setFriction(1.0);

    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    this.timeOffset = Math.random() * 100;
    this.dropId = "";
    this.torque = null;
    this.networkManaged = false;
    this.lastRemoteStateAt = 0;
    this.lastRemoteAuthorityId = null;
  }

  getPhysicsState(timestamp = Date.now()) {
    const pos = this.rigidBody.translation();
    const rot = this.rigidBody.rotation();
    const linvel = this.rigidBody.linvel();
    const angvel = this.rigidBody.angvel();

    return {
      dropId: this.dropId,
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
      angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
      timestamp,
    };
  }

  applyNetworkState(state: any, authorityId: string | null = null) {
    if (!state || this.isCollected) return;

    if (state.position) {
      this.rigidBody.setTranslation(
        { x: state.position.x || 0, y: state.position.y || 0, z: state.position.z || 0 },
        true
      );
    }

    if (state.rotation) {
      this.rigidBody.setRotation(
        {
          x: state.rotation.x || 0,
          y: state.rotation.y || 0,
          z: state.rotation.z || 0,
          w: state.rotation.w !== undefined ? state.rotation.w : 1,
        },
        true
      );
    }

    if (state.linvel) {
      this.rigidBody.setLinvel(
        { x: state.linvel.x || 0, y: state.linvel.y || 0, z: state.linvel.z || 0 },
        true
      );
    }

    if (state.angvel) {
      this.rigidBody.setAngvel(
        { x: state.angvel.x || 0, y: state.angvel.y || 0, z: state.angvel.z || 0 },
        true
      );
    }

    const pos = this.rigidBody.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.lastRemoteStateAt = Date.now();
    this.lastRemoteAuthorityId = authorityId;
    this.networkManaged = true;
  }

  update(dt: number, time: number) {
    if (this.isCollected) return;

    const pos = this.rigidBody.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);

    this.visualContainer.rotation.y = time * 1.5;

    const bob = Math.sin(time * 3.0 + this.timeOffset) * 0.1;
    this.visualContainer.position.y = bob + 0.2;
  }

  dispose() {
    this.scene.remove(this.mesh);
    if (this.collider) this.world.removeCollider(this.collider, false);
    if (this.rigidBody) this.world.removeRigidBody(this.rigidBody);
    this.isCollected = true;
  }
}

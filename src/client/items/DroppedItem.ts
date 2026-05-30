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

import * as THREE from "three";
import { DroppedItem } from "./DroppedItem";
import type { ItemLike } from "../types";

export class ItemDropManager {
  scene: THREE.Scene;
  world: unknown;
  droppedItems: DroppedItem[];

  constructor(scene: THREE.Scene, world: unknown) {
    this.scene = scene;
    this.world = world;
    this.droppedItems = [];
  }

  dropItem(
    item: ItemLike,
    position: { x: number; y: number; z: number },
    launchDirection: { x: number; y: number; z: number },
    forceDropId: string | null = null,
    remoteData: { torque?: { x: number; y: number; z: number } } | null = null
  ) {
    if (!item) return;

    const spawnPos = new THREE.Vector3(
      position.x + launchDirection.x * 1.0,
      position.y + 1.0,
      position.z + launchDirection.z * 1.0
    );

    const dropped = new DroppedItem(this.scene, this.world, item, spawnPos);
    dropped.dropId = forceDropId || "drop_" + Math.random().toString(36).substring(2, 10);

    const force = 0.4;
    const impulse = {
      x: launchDirection.x * force,
      y: 0.8,
      z: launchDirection.z * force
    };

    const torque = remoteData && remoteData.torque ? remoteData.torque : {
      x: (Math.random() - 0.5) * 0.5,
      y: (Math.random() - 0.5) * 0.5,
      z: (Math.random() - 0.5) * 0.5
    };

    dropped.torque = torque;

    dropped.rigidBody.applyImpulse(impulse, true);
    dropped.rigidBody.applyTorqueImpulse(torque, true);

    this.droppedItems.push(dropped);
    console.log("Item arrojado:", item.name, dropped.dropId);

    return dropped;
  }

  tryPickupNearest(position: { x: number; y: number; z: number }) {
    const pickupRange = 3.0;
    let nearest: DroppedItem | null = null;
    let minDistSq = pickupRange * pickupRange;

    for (const dropped of this.droppedItems) {
      const itemPos = dropped.rigidBody.translation();
      const dx = itemPos.x - position.x;
      const dy = itemPos.y - position.y;
      const dz = itemPos.z - position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = dropped;
      }
    }

    if (nearest) {
      const item = nearest.item;
      nearest.dispose();

      const index = this.droppedItems.indexOf(nearest);
      if (index > -1) {
        this.droppedItems.splice(index, 1);
      }

      console.log("Item recogido:", item.name);
      return { item: item, dropId: nearest.dropId };
    }

    return null;
  }

  removeItemByDropId(dropId: string) {
    const index = this.droppedItems.findIndex((d: DroppedItem) => d.dropId === dropId);
    if (index !== -1) {
      const dropped = this.droppedItems[index];
      dropped.dispose();
      this.droppedItems.splice(index, 1);
      return true;
    }
    return false;
  }

  getNearestItem(position: { x: number; y: number; z: number }, range = 3.0) {
    let nearest: DroppedItem | null = null;
    let minDistSq = range * range;

    for (const dropped of this.droppedItems) {
      const itemPos = dropped.rigidBody.translation();
      const dx = itemPos.x - position.x;
      const dy = itemPos.y - position.y;
      const dz = itemPos.z - position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = dropped;
      }
    }
    return nearest;
  }

  checkAutoPickup(position: { x: number; y: number; z: number }, range = 1.0, itemIdFilter: string | null = null) {
    const collected: ItemLike[] = [];
    const rangeSq = range * range;

    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const dropped = this.droppedItems[i];

      if (itemIdFilter && dropped.item.id !== itemIdFilter) continue;

      const itemPos = dropped.rigidBody.translation();
      const dx = itemPos.x - position.x;
      const dy = itemPos.y - position.y;
      const dz = itemPos.z - position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < rangeSq) {
        collected.push(dropped.item);
        dropped.dispose();
        this.droppedItems.splice(i, 1);
      }
    }

    return collected;
  }

  update(dt: number, time: number) {
    this.droppedItems.forEach((item: DroppedItem) => item.update(dt, time));
  }
}

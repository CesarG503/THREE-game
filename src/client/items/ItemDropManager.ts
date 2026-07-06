import * as THREE from "three";
import { DroppedItem } from "./droppables/DroppedItem";
import { createItemFromNetworkData } from "./ItemNetworkSerializer";
import { ensureItemUid } from "./ItemInstance";
import type { ItemLike } from "../types";

export class ItemDropManager {
  scene: THREE.Scene;
  world: unknown;
  droppedItems: DroppedItem[];
  private dropIds: Set<string>;
  private groundItemUids: Set<string>;
  private lastPhysicsSyncTime: number;
  private lastSentPhysicsStates: Map<string, any>;

  constructor(scene: THREE.Scene, world: unknown) {
    this.scene = scene;
    this.world = world;
    this.droppedItems = [];
    this.dropIds = new Set();
    this.groundItemUids = new Set();
    this.lastPhysicsSyncTime = 0;
    this.lastSentPhysicsStates = new Map();
  }

  private generateDropId() {
    let dropId = "";
    do {
      dropId = "drop_" + Math.random().toString(36).substring(2, 10);
    } while (this.dropIds.has(dropId));
    return dropId;
  }

  private registerDrop(dropped: DroppedItem) {
    this.dropIds.add(dropped.dropId);
    this.groundItemUids.add(dropped.item.uid);
    this.droppedItems.push(dropped);
  }

  private unregisterDrop(dropped: DroppedItem) {
    this.dropIds.delete(dropped.dropId);
    this.groundItemUids.delete(dropped.item.uid);
    this.lastSentPhysicsStates.delete(dropped.dropId);

    const index = this.droppedItems.indexOf(dropped);
    if (index > -1) {
      this.droppedItems.splice(index, 1);
    }
  }

  private disposeDrop(dropped: DroppedItem) {
    dropped.dispose();
    this.unregisterDrop(dropped);
  }

  hasDrop(dropId: string) {
    return this.dropIds.has(dropId);
  }

  hasGroundItemUid(uid: string) {
    return this.groundItemUids.has(uid);
  }

  dropItem(
    item: ItemLike,
    position: { x: number; y: number; z: number },
    launchDirection: { x: number; y: number; z: number },
    forceDropId: string | null = null,
    remoteData: { torque?: { x: number; y: number; z: number } } | null = null
  ) {
    if (!item) return;
    ensureItemUid(item);

    const dropId = forceDropId || this.generateDropId();
    if (this.dropIds.has(dropId)) {
      console.warn("Drop duplicado ignorado:", dropId);
      return null;
    }

    if (this.groundItemUids.has(item.uid)) {
      console.warn("Item ya existe en el suelo, drop ignorado:", item.name, item.uid);
      return null;
    }

    const spawnPos = new THREE.Vector3(
      position.x + launchDirection.x * 1.0,
      position.y + 1.0,
      position.z + launchDirection.z * 1.0
    );

    const dropped = new DroppedItem(this.scene, this.world, item, spawnPos);
    dropped.dropId = dropId;
    dropped.networkManaged = Boolean(remoteData);

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

    this.registerDrop(dropped);
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
      this.disposeDrop(nearest);

      console.log("Item recogido:", item.name);
      return { item: item, dropId: nearest.dropId };
    }

    return null;
  }

  removeItemByDropId(dropId: string) {
    const index = this.droppedItems.findIndex((d: DroppedItem) => d.dropId === dropId);
    if (index !== -1) {
      const dropped = this.droppedItems[index];
      this.disposeDrop(dropped);
      return true;
    }
    return false;
  }

  getDropById(dropId: string) {
    return this.droppedItems.find((d: DroppedItem) => d.dropId === dropId) || null;
  }

  applyNetworkPhysicsState(update: any, authorityId: string | null = null) {
    const dropped = this.getDropById(update?.dropId);
    if (!dropped) return false;
    dropped.applyNetworkState(update, authorityId);
    this.lastSentPhysicsStates.set(dropped.dropId, dropped.getPhysicsState(update.timestamp || Date.now()));
    return true;
  }

  applyNetworkPhysicsStates(updates: any[], authorityId: string | null = null) {
    if (!Array.isArray(updates)) return;
    updates.forEach((update) => this.applyNetworkPhysicsState(update, authorityId));
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
    return this.checkAutoPickupDetailed(position, range, itemIdFilter).map((pickup) => pickup.item);
  }

  checkAutoPickupDetailed(position: { x: number; y: number; z: number }, range = 1.0, itemIdFilter: string | null = null) {
    const detailed: Array<{ item: ItemLike; dropId: string }> = [];
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
        detailed.push({ item: dropped.item, dropId: dropped.dropId });
        this.disposeDrop(dropped);
      }
    }

    return detailed;
  }

  syncGroundItems(records: any[]) {
    if (!Array.isArray(records)) return;

    records.forEach((record) => {
      if (!record || !record.dropId || !record.itemData || this.dropIds.has(record.dropId)) return;

      const item = createItemFromNetworkData(record.itemData);
      if (this.groundItemUids.has(item.uid)) return;

      const pos = record.position || { x: 0, y: 1, z: 0 };
      const direction = record.direction || { x: 0, y: 1, z: 0 };
      const dropped = this.dropItem(item, pos, direction, record.dropId, { torque: record.torque, networkManaged: true } as any);
      if (dropped && record.state) {
        dropped.applyNetworkState(record.state, record.ownerId || null);
      }
    });
  }

  collectPhysicsStateUpdates(localPlayerPosition: { x: number; y: number; z: number } | null, nowMs = Date.now()) {
    if (nowMs - this.lastPhysicsSyncTime < 100) return [];
    this.lastPhysicsSyncTime = nowMs;

    const updates: any[] = [];
    const localPos = localPlayerPosition
      ? new THREE.Vector3(localPlayerPosition.x, localPlayerPosition.y, localPlayerPosition.z)
      : null;

    for (const dropped of this.droppedItems) {
      if (dropped.isCollected) continue;

      const state = dropped.getPhysicsState(nowMs);
      const linSpeedSq =
        state.linvel.x * state.linvel.x +
        state.linvel.y * state.linvel.y +
        state.linvel.z * state.linvel.z;

      const itemPos = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
      const nearLocalPlayer = localPos ? itemPos.distanceToSquared(localPos) <= 9.0 : false;
      const recentlyCorrected = nowMs - dropped.lastRemoteStateAt < 250;

      if (dropped.networkManaged && !nearLocalPlayer) continue;
      if (dropped.networkManaged && recentlyCorrected && linSpeedSq < 0.04) continue;

      const previous = this.lastSentPhysicsStates.get(dropped.dropId);
      const movedSq = previous
        ? (state.position.x - previous.position.x) ** 2 +
          (state.position.y - previous.position.y) ** 2 +
          (state.position.z - previous.position.z) ** 2
        : Infinity;

      const velocityChangedSq = previous
        ? (state.linvel.x - previous.linvel.x) ** 2 +
          (state.linvel.y - previous.linvel.y) ** 2 +
          (state.linvel.z - previous.linvel.z) ** 2
        : Infinity;

      if (movedSq > 0.0004 || velocityChangedSq > 0.0025 || linSpeedSq > 0.01) {
        updates.push(state);
        this.lastSentPhysicsStates.set(dropped.dropId, state);
      }
    }

    return updates;
  }

  update(dt: number, time: number) {
    this.droppedItems.forEach((item: DroppedItem) => item.update(dt, time));
  }
}

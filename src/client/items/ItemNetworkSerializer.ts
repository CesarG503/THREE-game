import * as THREE from "three";
import { Item } from "./Item";
import { FuegoItem } from "./FuegoItem";
import { GunItem } from "./GunItem";
import { ImpulseItem } from "./ImpulseItem";
import { JetpackItem } from "./JetpackItem";
import { MapObjectItem } from "./MapObjectItem";
import { PelotaItem } from "./PelotaItem";
import { TurretItem } from "./TurretItem";
import { ensureItemUid } from "./ItemInstance";
import type { ItemLike } from "../types";

const RUNTIME_KEYS = new Set([
  "model",
  "equipGroup",
  "transformGroup",
  "mixer",
  "actionShoot",
  "actionReload",
  "blasterSystem",
  "originalConfig",
  "onLoadCallback",
  "mesh",
  "collider",
  "rigidBody",
]);

function toPlainValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "function") return undefined;
  if (typeof value !== "object") return value;

  if (value.isVector3) {
    return { x: value.x, y: value.y, z: value.z, __type: "Vector3" };
  }

  if (value.isEuler) {
    return { x: value.x, y: value.y, z: value.z, order: value.order, __type: "Euler" };
  }

  if (Array.isArray(value)) {
    return value.map(toPlainValue).filter((entry) => entry !== undefined);
  }

  const plain: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (RUNTIME_KEYS.has(key)) continue;
    const serialized = toPlainValue(entry);
    if (serialized !== undefined) plain[key] = serialized;
  }
  return plain;
}

function restoreValue(targetValue: any, sourceValue: any): any {
  if (sourceValue === null || sourceValue === undefined) return sourceValue;

  if (sourceValue.__type === "Vector3") {
    if (targetValue?.isVector3) {
      targetValue.set(sourceValue.x || 0, sourceValue.y || 0, sourceValue.z || 0);
      return targetValue;
    }
    return new THREE.Vector3(sourceValue.x || 0, sourceValue.y || 0, sourceValue.z || 0);
  }

  if (sourceValue.__type === "Euler") {
    if (targetValue?.isEuler) {
      targetValue.set(sourceValue.x || 0, sourceValue.y || 0, sourceValue.z || 0, sourceValue.order || targetValue.order);
      return targetValue;
    }
    return new THREE.Euler(sourceValue.x || 0, sourceValue.y || 0, sourceValue.z || 0, sourceValue.order || "XYZ");
  }

  if (typeof sourceValue !== "object" || Array.isArray(sourceValue)) return sourceValue;

  if (targetValue && typeof targetValue === "object") {
    restoreProperties(targetValue, sourceValue);
    return targetValue;
  }

  const plain: Record<string, any> = {};
  restoreProperties(plain, sourceValue);
  return plain;
}

function restoreProperties(target: any, source: any) {
  for (const [key, value] of Object.entries(source || {})) {
    if (RUNTIME_KEYS.has(key)) continue;
    target[key] = restoreValue(target[key], value);
  }
}

export function serializeItemForNetwork(item: ItemLike): Record<string, any> {
  ensureItemUid(item);
  const data = toPlainValue(item);
  data.itemClass = item.constructor?.name || "Item";
  data.uid = item.uid;
  return data;
}

export function createItemFromNetworkData(data: any): ItemLike {
  const itemData = data || {};
  let item: any;

  // 1. Check exact item class name matches first to avoid property collisions (e.g. modelPath)
  if (itemData.itemClass === "JetpackItem") {
    item = new JetpackItem(itemData);
  } else if (itemData.itemClass === "GunItem") {
    item = new GunItem(itemData);
  } else if (itemData.itemClass === "FuegoItem") {
    item = new FuegoItem(itemData.groupId || "Grupo 1", itemData.itemTexture || itemData.iconPath || "/assets/textures/fuego.png");
  } else if (itemData.itemClass === "PelotaItem") {
    item = new PelotaItem(
      itemData.id || "pelota",
      itemData.name || "Pelota",
      itemData.iconPath || "/assets/textures/pelota.png",
      itemData.damage,
      itemData.fireRate,
      itemData.bulletSpeed,
      itemData.bulletDrop
    );
  } else if (itemData.itemClass === "MapObjectItem") {
    item = new MapObjectItem(
      itemData.id,
      itemData.name,
      itemData.type,
      itemData.iconPath || "",
      itemData.color,
      itemData.scale,
      itemData.texturePath,
      itemData.textureAssetId || null,
      itemData.textureSettings || null
    );
  } else if (itemData.itemClass === "ImpulseItem") {
    item = new ImpulseItem(itemData.id, itemData.name, itemData.iconPath, itemData.type, itemData.strength);
  } else if (itemData.itemClass === "TurretItem") {
    item = new TurretItem(itemData.id || "turret", itemData.name || "Turret", itemData.iconPath || "");
  }
  // 2. Fallbacks for missing itemClass / general data
  else if (itemData.type === "consumable") {
    item = new JetpackItem(itemData);
  } else if (itemData.type === "weapon" || itemData.id === "gun" || (itemData.modelPath && !itemData.type)) {
    item = new GunItem(itemData);
  } else if (itemData.id === "fuego" || itemData.itemClass === "FuegoItem") {
    item = new FuegoItem(itemData.groupId || "Grupo 1", itemData.itemTexture || itemData.iconPath || "/assets/textures/fuego.png");
  } else if (itemData.id === "pelota" || itemData.itemClass === "PelotaItem") {
    item = new PelotaItem(
      itemData.id || "pelota",
      itemData.name || "Pelota",
      itemData.iconPath || "/assets/textures/pelota.png",
      itemData.damage,
      itemData.fireRate,
      itemData.bulletSpeed,
      itemData.bulletDrop
    );
  } else if (itemData.type === "impulse" || itemData.itemClass === "ImpulseItem") {
    item = new ImpulseItem(itemData.id, itemData.name, itemData.iconPath, itemData.type, itemData.strength);
  } else if (itemData.id === "turret" || itemData.itemClass === "TurretItem") {
    item = new TurretItem(itemData.id || "turret", itemData.name || "Turret", itemData.iconPath || "");
  } else {
    item = new Item(itemData.id || "item", itemData.name || "Item", itemData.iconPath || "");
  }

  restoreProperties(item, itemData);
  ensureItemUid(item);
  return item;
}

import type { ItemLike } from "../types";

export function createItemUid(prefix = "item"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureItemUid<T extends Partial<ItemLike>>(item: T | null | undefined): T {
  if (item && !item.uid) {
    item.uid = createItemUid();
  }
  return item as T;
}

export function getItemUid(item: Partial<ItemLike> | null | undefined): string | null {
  return item?.uid || null;
}

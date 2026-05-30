import type { ItemLike } from "../types";
import { ensureItemUid, getItemUid } from "./ItemInstance";

export class InventoryManager {
  uiSlots: NodeListOf<Element>;
  inputManager: unknown;
  capacity: number;
  slots: Array<ItemLike | null>;
  currentSlotIndex: number;
  onItemChange: ((item: ItemLike | null) => void) | null;

  constructor(containerId: string) {
    void containerId;
    this.uiSlots = document.querySelectorAll(".inventory-slot");
    this.inputManager = null;

    this.capacity = this.uiSlots.length;
    this.slots = new Array(this.capacity).fill(null);
    this.currentSlotIndex = 0;

    this.onItemChange = null;

    this.setupEventListeners();
    this.updateUI();
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      const key = parseInt(e.key, 10);
      if (!isNaN(key) && key >= 1 && key <= this.capacity) {
        this.selectSlot(key - 1);
      }
    });

    document.addEventListener("wheel", (e: WheelEvent) => {
      if (!e.shiftKey) {
        if (e.deltaY > 0) {
          this.selectSlot((this.currentSlotIndex + 1) % this.capacity);
        } else if (e.deltaY < 0) {
          this.selectSlot((this.currentSlotIndex - 1 + this.capacity) % this.capacity);
        }
      }
    });
  }

  enableDragAndDrop(onDropCallback: ((index: number) => void) | null) {
    this.uiSlots.forEach((slot: Element, index: number) => {
      slot.addEventListener("dragover", (e: DragEvent) => {
        e.preventDefault();
        (slot as HTMLElement).style.borderColor = "yellow";
      });
      slot.addEventListener("dragleave", () => {
        (slot as HTMLElement).style.borderColor = "";
      });
      slot.addEventListener("drop", (e: DragEvent) => {
        e.preventDefault();
        (slot as HTMLElement).style.borderColor = "";
        if (onDropCallback) onDropCallback(index);
      });
    });
  }

  setItem(index: number, item: ItemLike | null) {
    if (index >= 0 && index < this.slots.length) {
      ensureItemUid(item);
      const uid = getItemUid(item);
      if (uid) {
        for (let i = 0; i < this.slots.length; i++) {
          if (i !== index && this.slots[i]?.uid === uid) {
            this.slots[i] = null;
          }
        }
      }

      this.slots[index] = item;
      this.updateUI();

      if (index === this.currentSlotIndex && this.onItemChange) {
        this.onItemChange(item);
      }
    }
  }

  addItem(item: ItemLike) {
    ensureItemUid(item);

    if (this.slots.some((slot) => slot?.uid === item.uid)) {
      console.warn("Item duplicado ignorado en inventario:", item.name, item.uid);
      return false;
    }

    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] === null) {
        this.slots[i] = item;
        this.updateUI();

        if (i === this.currentSlotIndex && this.onItemChange) {
          this.onItemChange(item);
        }

        return true;
      }
    }

    console.log("Inventario lleno");
    return false;
  }

  removeItem(index: number) {
    if (index >= 0 && index < this.slots.length) {
      const item = this.slots[index];
      this.slots[index] = null;
      this.updateUI();
      return item;
    }
    return null;
  }

  getCurrentItem() {
    return this.slots[this.currentSlotIndex];
  }

  removeCurrentItem() {
    return this.removeItem(this.currentSlotIndex);
  }

  selectSlot(index: number) {
    if (index < 0) index = this.capacity - 1;
    if (index >= this.capacity) index = 0;

    const prevIndex = this.currentSlotIndex;
    this.currentSlotIndex = index;
    this.updateUI();

    if (this.onItemChange && prevIndex !== this.currentSlotIndex) {
      this.onItemChange(this.slots[this.currentSlotIndex]);
    }
    if (this.onItemChange) {
      this.onItemChange(this.slots[this.currentSlotIndex]);
    }
  }

  updateUI() {
    this.uiSlots.forEach((slotEl: Element, index: number) => {
      if (index === this.currentSlotIndex) {
        slotEl.classList.add("active");
      } else {
        slotEl.classList.remove("active");
      }

      const item = this.slots[index];
      const numberEl = slotEl.querySelector(".slot-number");
      slotEl.innerHTML = "";
      if (numberEl) slotEl.appendChild(numberEl);

      if (item) {
        const img = document.createElement("img");
        img.src = item.iconPath;
        img.alt = item.name;
        img.style.width = "70%";
        img.style.height = "70%";
        img.style.objectFit = "contain";
        img.style.zIndex = "2";
        img.style.position = "relative";
        img.draggable = false;
        slotEl.appendChild(img);

        if (numberEl) {
          (numberEl as HTMLElement).style.zIndex = "3";
        }
      }
    });

    this.updateFuelBars();
  }

  updateFuelBars() {
    this.uiSlots.forEach((slotEl: Element, index: number) => {
      const item = this.slots[index];
      const fuelOverlay = slotEl.querySelector(".fuel-overlay") as HTMLElement;

      if (item && item.type === "consumable" && item.maxConsumableUse !== undefined) {
        const pct = item.maxConsumableUse > 0 ? Math.max(0, Math.min(1.0, item.consumableUse / item.maxConsumableUse)) : 0;
        
        let overlay = fuelOverlay;
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.className = "fuel-overlay";
          overlay.style.cssText = "position: absolute; bottom: 0; left: 0; height: 100%; z-index: 1; opacity: 0.35; pointer-events: none; transition: width 0.05s linear;";
          (slotEl as HTMLElement).style.position = "relative";
          (slotEl as HTMLElement).style.overflow = "hidden";
          slotEl.insertBefore(overlay, slotEl.firstChild);
        }

        overlay.style.width = `${pct * 100}%`;

        if (pct <= 0) {
          const blink = Math.floor(Date.now() / 150) % 2 === 0;
          overlay.style.backgroundColor = blink ? "#ff3333" : "#d6b600";
          overlay.style.width = "100%";
        } else if (pct <= 0.2) {
          overlay.style.backgroundColor = "#ff3333";
        } else if (pct <= 0.5) {
          overlay.style.backgroundColor = "#d6b600";
        } else {
          overlay.style.backgroundColor = "#00aa00";
        }
      } else {
        if (fuelOverlay) {
          fuelOverlay.remove();
        }
      }
    });
  }
}

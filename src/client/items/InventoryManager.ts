import type { ItemLike } from "../types";

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
      this.slots[index] = item;
      this.updateUI();

      if (index === this.currentSlotIndex && this.onItemChange) {
        this.onItemChange(item);
      }
    }
  }

  addItem(item: ItemLike) {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] && this.slots[i].id === item.id && this.slots[i].count < this.slots[i].maxStack) {
        console.log("Item apilado (logica placeholder)");
        return true;
      }
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
        img.draggable = false;
        slotEl.appendChild(img);
      }
    });
  }
}

export class InventoryManager {
    constructor() {
        this.slots = new Array(6).fill(null);
        this.currentSlotIndex = 0;
        this.uiSlots = document.querySelectorAll(".inventory-slot");

        // Initial binding
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Escuchar cambios de slot via teclado (1-6)
        document.addEventListener("keydown", (e) => {
            const key = parseInt(e.key);
            if (key >= 1 && key <= 6) {
                this.selectSlot(key - 1);
            }
        });

        // Scroll mouse
        document.addEventListener("wheel", (e) => {
            if (!e.shiftKey) { // Shift suele ser para zoom
                if (e.deltaY > 0) {
                    this.selectSlot((this.currentSlotIndex + 1) % 6);
                } else if (e.deltaY < 0) {
                    this.selectSlot((this.currentSlotIndex - 1 + 6) % 6);
                }
            }
        });
    }

    addItem(item) {
        // 1. Intentar apilar en slots existentes
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i] && this.slots[i].id === item.id && this.slots[i].count < this.slots[i].maxStack) {
                // TODO: Handle stacking count logic if we implement count > 1
                // For now, assuming count is just handled abstractly
                console.log("Item apilado (logica placeholder)");
                return true;
            }
        }

        // 2. Buscar slot vacio
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i] === null) {
                this.slots[i] = item;
                this.updateUI();
                return true;
            }
        }

        console.log("Inventario lleno");
        return false;
    }

    removeItem(index) {
        if (index >= 0 && index < this.slots.length) {
            const item = this.slots[index];
            this.slots[index] = null;
            this.updateUI();
            return item;
        }
        return null;
    }

    /**
     * Obtiene el item actualmente seleccionado
     */
    getCurrentItem() {
        return this.slots[this.currentSlotIndex];
    }

    removeCurrentItem() {
        return this.removeItem(this.currentSlotIndex);
    }

    selectSlot(index) {
        if (index < 0) index = 5;
        if (index > 5) index = 0;
        this.currentSlotIndex = index;
        this.updateUI();
    }

    updateUI() {
        this.uiSlots.forEach((slotEl, index) => {
            // Active class
            if (index === this.currentSlotIndex) {
                slotEl.classList.add("active");
            } else {
                slotEl.classList.remove("active");
            }

            // Content
            const item = this.slots[index];
            // Limpiar contenido previo que no sea el numero
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
                slotEl.appendChild(img);
            }
        });
    }
}

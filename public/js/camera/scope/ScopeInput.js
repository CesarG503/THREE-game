export class ScopeInput {
    constructor(controller) {
        this.controller = controller;
        this.wheelHandler = this.onWheel.bind(this);
        this.setupInput();
    }

    setupInput() {
        document.addEventListener("wheel", this.wheelHandler, { passive: false });
    }

    onWheel(e) {
        // Delegar la validación al controller
        if (!this.controller.canHandleInput()) return;
        
        // REQUIERE mantener Shift presionado para ajustar mira
        if (!e.shiftKey) return; 
        
        // Browsers often map Shift + Wheel to horizontal scroll (deltaX)
        let delta = e.deltaY;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            delta = e.deltaX;
        }

        if (delta < 0) {
            this.controller.zoomIn();
        } else if (delta > 0) {
            this.controller.zoomOut();
        }
    }

    destroy() {
        document.removeEventListener("wheel", this.wheelHandler);
    }
}

import type { ScopeController } from "../ScopeController";

export class ScopeInput {
  controller: ScopeController;
  wheelHandler: (e: WheelEvent) => void;

  constructor(controller: ScopeController) {
    this.controller = controller;
    this.wheelHandler = this.onWheel.bind(this);
    this.setupInput();
  }

  setupInput() {
    document.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  onWheel(e: WheelEvent) {
    if (!this.controller.canHandleInput()) return;
    if (!e.shiftKey) return;

    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta < 0) this.controller.zoomIn();
    if (delta > 0) this.controller.zoomOut();
  }

  destroy() {
    document.removeEventListener("wheel", this.wheelHandler);
  }
}

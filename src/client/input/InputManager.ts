import type { InputManagerOptions, InputState } from "../types";

export class InputManager {
  keys: InputState;
  isPaused: boolean;
  enabled: boolean;
  options: Required<InputManagerOptions>;
  lastShiftTime: number = 0;
  doubleShiftTapped: boolean = false;

  constructor(options: InputManagerOptions = {}) {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      attack: false,
      aim: false,
      run: false
    };

    this.isPaused = false;
    this.options = {
      enabled: options.enabled ?? true,
      pauseEvents: options.pauseEvents ?? true
    };
    this.enabled = this.options.enabled;

    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    document.addEventListener("keyup", (e) => this.onKeyUp(e));

    document.addEventListener("gamePauseChanged", (e) => {
      if (!this.options.pauseEvents) return;
      const event = e as CustomEvent<{ isPaused: boolean }>;
      this.isPaused = event.detail.isPaused;
      if (this.isPaused) {
        this.reset();
      }
    });

    document.addEventListener("mousedown", (e) => {
      if (this.isPaused || !this.enabled) return;
      if (e.button === 0) this.keys.attack = true;
      if (e.button === 2) this.keys.aim = true;
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.keys.attack = false;
      if (e.button === 2) this.keys.aim = false;
    });
  }

  reset() {
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.jump = false;
    this.keys.crouch = false;
    this.keys.attack = false;
    this.keys.aim = false;
    if (this.keys.run !== undefined) this.keys.run = false;
    this.doubleShiftTapped = false;
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.isPaused || !this.enabled) return;

    switch (event.code) {
      case "KeyW":
        this.keys.forward = true;
        break;
      case "KeyS":
        this.keys.backward = true;
        break;
      case "KeyA":
        this.keys.left = true;
        break;
      case "KeyD":
        this.keys.right = true;
        break;
      case "Space":
        this.keys.jump = true;
        break;
      case "ShiftLeft":
        if (!this.keys.crouch) {
          const now = Date.now();
          if (now - this.lastShiftTime < 300) {
            this.doubleShiftTapped = true;
          }
          this.lastShiftTime = now;
        }
        this.keys.crouch = true;
        break;
    }
  }

  onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
        this.keys.forward = false;
        break;
      case "KeyS":
        this.keys.backward = false;
        break;
      case "KeyA":
        this.keys.left = false;
        break;
      case "KeyD":
        this.keys.right = false;
        break;
      case "Space":
        this.keys.jump = false;
        break;
      case "ShiftLeft":
        this.keys.crouch = false;
        break;
    }
  }
}

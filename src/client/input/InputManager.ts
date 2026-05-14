export class InputManager {
  keys: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    crouch: boolean;
    attack: boolean;
  };
  isPaused: boolean;
  enabled: boolean;

  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      attack: false
    };

    this.isPaused = false;
    this.enabled = true;

    document.addEventListener("keydown", (e: any) => this.onKeyDown(e));
    document.addEventListener("keyup", (e: any) => this.onKeyUp(e));

    document.addEventListener("gamePauseChanged", (e: any) => {
      this.isPaused = e.detail.isPaused;
      if (this.isPaused) {
        this.reset();
      }
    });

    document.addEventListener("mousedown", (e: any) => {
      if (this.isPaused || !this.enabled) return;
      if (e.button === 0 || e.button === 2) this.keys.attack = true;
    });

    document.addEventListener("mouseup", (e: any) => {
      if (e.button === 0 || e.button === 2) this.keys.attack = false;
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
  }

  onKeyDown(event: any) {
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
        this.keys.crouch = true;
        break;
    }
  }

  onKeyUp(event: any) {
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

import * as THREE from "three";

export interface LimbParts {
  headGroup: THREE.Group;
  body: THREE.Mesh;
  upperBodyGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  pivotGroup: THREE.Group;
  backItemMesh: THREE.Object3D | null;
  heldItemMesh: THREE.Object3D | null;
}

export interface AnimationState {
  dt: number;
  isMoving: boolean;
  isCrouching: boolean;
  isAttacking: boolean;
  isGrounded: boolean;
  verticalVelocity: number;
  isSuperman: boolean;
  noPitchTilt: boolean;
  attackWeight: number;
  airTime: number;
  targetHeadPitch: number;
  targetHeadYaw: number;
  isHoldingWeapon: boolean;
  currentWeaponHand: "left" | "right";
  heldItem: any;
  isFirstPerson: boolean;
  jumpAnimationType: string;
  fallAnimationType: string;
}

export interface AnimationInfo {
  name: string;
  description: string;
}

export interface IAnimationSystem {
  id: string;
  name: string;
  getAnimations(): AnimationInfo[];
  update(parts: LimbParts, state: AnimationState, model: any): void;
}

export class AnimationRegistry {
  private static systems = new Map<string, IAnimationSystem>();

  static register(system: IAnimationSystem) {
    this.systems.set(system.id, system);
    console.log(`Registered Animation System: [${system.id}] ${system.name}`);
  }

  static get(id: string): IAnimationSystem | undefined {
    return this.systems.get(id);
  }

  static list(): IAnimationSystem[] {
    return Array.from(this.systems.values());
  }
}

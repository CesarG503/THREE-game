import type { Object3D, Scene, Vector3 } from "three";
import type { InputState } from "./input.types";

export interface ICharacterModel {
    model: Object3D | null;
    isVisible: boolean;
    setVisible(visible: boolean): void;
    setPosition(pos: Vector3): void;
    setRotation(rot: number): void;
    getPosition(): Vector3;
    setHeldItem(item: any): void;
    update(dt: number, isMoving: boolean, isCrouching?: boolean, isAttacking?: boolean, isGrounded?: boolean, verticalVelocity?: number, isSuperman?: boolean, noPitchTilt?: boolean, isRunning?: boolean): void;

    // Métodos opcionales específicos
    switchAnimation?: (name: string) => void;
    setHeadRotation?: (pitch: number, yaw: number) => void;
    setFirstPerson?: (isFirstPerson: boolean) => void;
    setJumpAnimationType?: (type: string) => void;
    setFallAnimationType?: (type: string) => void;
    setSkinUrl?: (url: string) => void;
    setRoleVisual?: (visual: any) => void;
}

export interface CharacterStats {
    speed: number;
    runSpeed?: number;
    crouchSpeed?: number;
    independentSpeeds?: boolean;
    staminaMax?: number;
    runRequireFullStamina?: boolean;
    jumpForce: number;
    maxHealth: number;
    respawns: number;
    canFly: boolean;
    maxMultiJumps: number;
    flashOnDamage?: boolean;
    respawnDelay?: number;
    explodeOnDeath?: boolean;
    bodyPartsDuration?: number;
}

export interface JumpConfig {
    jumpForce: number;
    maxMultiJumps: number;
    jumpAnimationType?: string;
    fallAnimationType?: string;
}

export interface FlightConfig {
    canFly: boolean;
    isFlying: boolean;
    flightToggleWindowMs: number;
}

export type PlayerCollisionMode = "push" | "no-push" | "none";

export interface PlayerState {
    id: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    maxHealth: number;
    heldItemId?: string | null;
    isFlying?: boolean;
}

export interface RemotePlayerState extends PlayerState {
    name: string;
}

export interface NPCState {
    id: string;
    position: Vector3;
    targetPosition?: Vector3;
    state: "idle" | "walking" | "attacking" | "dead";
    health: number;
}

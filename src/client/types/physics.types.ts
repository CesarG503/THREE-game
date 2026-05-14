import type { Euler, Object3D, Vector3 } from "three";

export enum ColliderType {
	SPHERE = "sphere",
	BOX = "box",
	CAPSULE = "capsule",
	CYLINDER = "cylinder"
}

export enum CollisionLayer {
	NONE = 0,
	PLAYER = 1 << 0,
	REMOTE_PLAYER = 1 << 1,
	NPC = 1 << 2,
	ENVIRONMENT = 1 << 3,
	GROUND = 1 << 4,
	TRIGGER = 1 << 5,
	ALL = 0xffffffff
}

export type ColliderId = string;

export interface CollisionResponse {
	direction: Vector3;
	overlap: number;
	normal: Vector3;
}

export interface CollisionStats {
	totalChecks: number;
	collisionsDetected: number;
	lastUpdateTime: number;
}

export type CollisionCallback<TUser = any> = (other: unknown, response?: unknown) => void;

export interface ColliderOptions<TUser = any> {
	id?: ColliderId;
	type?: ColliderType;
	layer?: number;
	collidesWithMask?: number;
	isTrigger?: boolean;
	isStatic?: boolean;
	manualResolution?: boolean;
	parent?: Object3D | null;
	offset?: Vector3;
	userData?: TUser;
	onCollisionEnter?: CollisionCallback<TUser> | null;
	onCollisionStay?: CollisionCallback<TUser> | null;
	onCollisionExit?: CollisionCallback<TUser> | null;
}

export interface SphereColliderOptions<TUser = any> extends ColliderOptions<TUser> {
	radius?: number;
}

export interface BoxColliderOptions<TUser = any> extends ColliderOptions<TUser> {
	size?: Vector3;
	rotation?: Euler;
}

export interface CapsuleColliderOptions<TUser = any> extends ColliderOptions<TUser> {
	radius?: number;
	height?: number;
}

export interface CylinderColliderOptions<TUser = any> extends ColliderOptions<TUser> {
	radius?: number;
	height?: number;
}

export interface CollisionEvent<TUser = any> {
	colliderA: unknown;
	colliderB: unknown;
	userData?: TUser;
}

export interface RaycastHit {
	collider: unknown;
	point: Vector3;
	distance: number;
	normal: Vector3;
}

export interface OverlapResult {
	colliders: unknown[];
}

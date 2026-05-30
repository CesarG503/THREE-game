import type { Euler, Object3D, Vector3, Camera, Scene } from "three";

export type ItemType = string;

export interface ItemStack {
	item: ItemLike;
	count: number;
}

export interface InventorySlot {
	item: ItemLike | null;
}

export interface InventoryState {
	slots: Array<ItemLike | null>;
	currentSlotIndex: number;
	capacity: number;
}

export interface ItemContext {
	scene: Scene;
	world: unknown;
	game?: any;
	placementManager?: any;
	platforms?: any[];
	farmingZones?: any[];
	itemDropManager?: any;
	rotationIndex?: number;
	origin: Vector3;
	direction: Vector3;
	camera: Camera;
	networkManager?: any;
	particleSystem?: any;
	character?: any;
	registerProjectile?: (projectile: any) => void;
	isRightClick?: boolean;
}

export interface ItemLike {
	uid: string;
	id: string;
	name: string;
	iconPath: string;
	count: number;
	maxStack: number;
	type?: string;
	value?: number;
	groupId?: string;
	itemTexture?: string;
	consumableUse?: number;
	maxConsumableUse?: number;
	use: (context: ItemContext) => boolean;
	getDisplayMesh: () => Object3D | null;
}

export interface WeaponSettingsEntry {
	handOffset: Vector3;
	handRotation: Euler;
	extraAnims?: Record<string, number>;
}

export type WeaponSettingsMap = Record<string, WeaponSettingsEntry>;

export interface WeaponConfig {
	id: string;
	name: string;
	modelPath?: string;
	damage?: number;
	cooldown?: number;
	isAuto?: boolean;
	recoil?: number;
	modelScale?: number;
	shotSpeed?: number;
	bulletDrop?: number;
	hasTracer?: boolean;
	icon?: string;
	projectileType?: string;
	recoilMode?: string;
	equippedHand?: "left" | "right";
	rebote?: boolean;
	hasImpactEffect?: boolean;
	customTracerVFX?: string;
	tracerDestroyOnCollision?: boolean;
	tracerStayForever?: boolean;
	tracerCollisionVFX?: string;
	customImpactVFX?: string;
	hasTrajectoryLine?: boolean;
	maxScope?: number;
	hasPlayerImpulseUp?: boolean;
	playerImpulseUpForce?: number;
	playerImpulseUpAirReduction?: number;
	hasPlayerImpulseBack?: boolean;
	playerImpulseBackForce?: number;
	modelOffset?: Vector3;
	modelRotation?: Vector3;
}

export type GunConfig = WeaponConfig;

export interface ProjectileConfig {
	origin: Vector3;
	direction: Vector3;
	speed: number;
	damage: number;
	bulletDrop?: number;
	type?: string;
	rebote?: boolean;
	hasImpactEffect?: boolean;
	customTracerVFX?: string;
	customImpactVFX?: string;
}

export interface ProjectileState {
	lifetime: number;
	speed: number;
	type: string;
	isDead: boolean;
}

export interface ProjectileImpact {
	hitPos: Vector3;
	effectName?: string;
	hasImpactEffect?: boolean;
}

export interface DroppedItemState {
	dropId: string;
	position: Vector3;
	torque: { x: number; y: number; z: number };
	isCollected: boolean;
}

export interface MapObjectConfig {
	type: string;
	scale: { x: number; y: number; z: number };
	color?: number;
	texturePath?: string | null;
	logicProperties?: Record<string, unknown> | null;
}

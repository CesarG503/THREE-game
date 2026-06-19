import * as THREE from "three";

type Axis = "x" | "y" | "z";

const AXES: Axis[] = ["x", "y", "z"];
const MIN_DIMENSION = 0.1;
const SCALE_EPSILON = 0.001;

export type VectorLike = {
	x?: number;
	y?: number;
	z?: number;
};

export type MovementWaypoint = {
	type?: string;
	x?: number;
	y?: number;
	z?: number;
	rotY?: number;
	rotation?: VectorLike;
	rotationTurns?: VectorLike;
	scale?: VectorLike;
	delay?: number;
	teleport?: boolean;
	[key: string]: any;
};

function finiteNumber(value: any, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function dimensionNumber(value: any, fallback = 1) {
	return Math.max(MIN_DIMENSION, finiteNumber(value, fallback));
}

function cloneVector(source: VectorLike | null | undefined, fallback: Required<VectorLike>) {
	return {
		x: finiteNumber(source?.x, fallback.x),
		y: finiteNumber(source?.y, fallback.y),
		z: finiteNumber(source?.z, fallback.z),
	};
}

export function getObjectBaseScale(object: any) {
	const dims = object?.userData?.originalScale || { x: 1, y: 1, z: 1 };
	return {
		x: dimensionNumber(dims.x, 1),
		y: dimensionNumber(dims.y, 1),
		z: dimensionNumber(dims.z, 1),
	};
}

export function getObjectCurrentDimensions(object: any) {
	const base = getObjectBaseScale(object);
	const scale = object?.scale || { x: 1, y: 1, z: 1 };
	return {
		x: dimensionNumber(base.x * finiteNumber(scale.x, 1), base.x),
		y: dimensionNumber(base.y * finiteNumber(scale.y, 1), base.y),
		z: dimensionNumber(base.z * finiteNumber(scale.z, 1), base.z),
	};
}

export function getWaypointPosition(waypoint: MovementWaypoint, fallbackObject: any = null) {
	const fallbackPos = fallbackObject?.position || { x: 0, y: 0, z: 0 };
	return {
		x: finiteNumber(waypoint?.x, fallbackPos.x),
		y: finiteNumber(waypoint?.y, fallbackPos.y),
		z: finiteNumber(waypoint?.z, fallbackPos.z),
	};
}

export function getWaypointRotation(waypoint: MovementWaypoint, fallbackObject: any = null) {
	const fallbackRot = fallbackObject?.rotation || { x: 0, y: 0, z: 0 };
	const legacyRotY = waypoint?.rotY;
	return {
		x: finiteNumber(waypoint?.rotation?.x, fallbackRot.x),
		y: finiteNumber(waypoint?.rotation?.y, legacyRotY !== undefined ? legacyRotY : fallbackRot.y),
		z: finiteNumber(waypoint?.rotation?.z, fallbackRot.z),
	};
}

export function getWaypointRotationTurns(waypoint: MovementWaypoint) {
	return cloneVector(waypoint?.rotationTurns, { x: 0, y: 0, z: 0 });
}

export function getWaypointScale(waypoint: MovementWaypoint, fallbackObject: any = null) {
	const fallbackScale = getObjectCurrentDimensions(fallbackObject);
	return {
		x: dimensionNumber(waypoint?.scale?.x, fallbackScale.x),
		y: dimensionNumber(waypoint?.scale?.y, fallbackScale.y),
		z: dimensionNumber(waypoint?.scale?.z, fallbackScale.z),
	};
}

export function normalizeMovementWaypoint(waypoint: MovementWaypoint, object: any = null) {
	if (!waypoint || waypoint.type === "wait_signal") return waypoint;

	const pos = getWaypointPosition(waypoint, object);
	const rot = getWaypointRotation(waypoint, object);
	const turns = getWaypointRotationTurns(waypoint);
	const scale = getWaypointScale(waypoint, object);

	waypoint.type = waypoint.type || "move";
	waypoint.x = pos.x;
	waypoint.y = pos.y;
	waypoint.z = pos.z;
	waypoint.rotation = rot;
	waypoint.rotationTurns = turns;
	waypoint.scale = scale;
	waypoint.rotY = rot.y;
	if (waypoint.delay === undefined) waypoint.delay = 0;
	if (waypoint.teleport === undefined) waypoint.teleport = false;

	return waypoint;
}

export function createMovementWaypointFromTransform(object: any, position: any = null, rotation: any = null, scale: any = null) {
	const pos = position || object?.position || { x: 0, y: 0, z: 0 };
	const rot = rotation || object?.rotation || { x: 0, y: 0, z: 0 };
	const dims = scale || getObjectCurrentDimensions(object);

	return normalizeMovementWaypoint({
		type: "move",
		x: finiteNumber(pos.x, 0),
		y: finiteNumber(pos.y, 0),
		z: finiteNumber(pos.z, 0),
		rotation: {
			x: finiteNumber(rot.x, 0),
			y: finiteNumber(rot.y, 0),
			z: finiteNumber(rot.z, 0),
		},
		rotationTurns: { x: 0, y: 0, z: 0 },
		scale: {
			x: dimensionNumber(dims.x, 1),
			y: dimensionNumber(dims.y, 1),
			z: dimensionNumber(dims.z, 1),
		},
		delay: 0,
		teleport: false,
	}, object);
}

export function shortestAngleDelta(from: number, to: number) {
	let diff = to - from;
	while (diff > Math.PI) diff -= Math.PI * 2;
	while (diff < -Math.PI) diff += Math.PI * 2;
	return diff;
}

export function interpolateWaypointRotation(fromWp: MovementWaypoint, toWp: MovementWaypoint, alpha: number, fallbackObject: any = null) {
	const fromRot = getWaypointRotation(fromWp, fallbackObject);
	const toRot = getWaypointRotation(toWp, fallbackObject);
	const turns = getWaypointRotationTurns(toWp);
	const result: Required<VectorLike> = { x: 0, y: 0, z: 0 };

	AXES.forEach((axis) => {
		const baseDelta = shortestAngleDelta(fromRot[axis], toRot[axis]);
		const fullTurns = turns[axis] * Math.PI * 2;
		result[axis] = fromRot[axis] + (baseDelta + fullTurns) * alpha;
	});

	return result;
}

export function interpolateWaypointScale(fromWp: MovementWaypoint, toWp: MovementWaypoint, alpha: number, fallbackObject: any = null) {
	const fromScale = getWaypointScale(fromWp, fallbackObject);
	const toScale = getWaypointScale(toWp, fallbackObject);
	return {
		x: THREE.MathUtils.lerp(fromScale.x, toScale.x, alpha),
		y: THREE.MathUtils.lerp(fromScale.y, toScale.y, alpha),
		z: THREE.MathUtils.lerp(fromScale.z, toScale.z, alpha),
	};
}

function scaleKey(scale: Required<VectorLike>) {
	return `${scale.x.toFixed(3)}:${scale.y.toFixed(3)}:${scale.z.toFixed(3)}`;
}

export function applyAnimatedObjectScale(object: any, dimensions: Required<VectorLike>) {
	if (!object || !dimensions) return;

	const base = getObjectBaseScale(object);
	const nextScale = {
		x: dimensionNumber(dimensions.x, base.x),
		y: dimensionNumber(dimensions.y, base.y),
		z: dimensionNumber(dimensions.z, base.z),
	};
	const key = scaleKey(nextScale);

	object.scale.set(
		nextScale.x / base.x,
		nextScale.y / base.y,
		nextScale.z / base.z
	);
	object.userData.animatedScale = { ...nextScale };

	if (object.userData._animatedScaleColliderKey === key) return;
	object.userData._animatedScaleColliderKey = key;

	updateSimpleColliderScale(object, nextScale);
}

function updateSimpleColliderScale(object: any, dimensions: Required<VectorLike>) {
	const body = object?.userData?.rigidBody;
	if (!body || typeof body.numColliders !== "function") return;

	const objectType = object.userData.mapObjectType;
	if (objectType === "stairs" || objectType === "ramp" || objectType === "ladder") return;

	for (let i = 0; i < body.numColliders(); i++) {
		const collider = body.collider(i);
		if (!collider) continue;

		try {
			const shapeType = typeof collider.shapeType === "function" ? collider.shapeType() : null;
			if (shapeType === 1 && typeof collider.setHalfExtents === "function") {
				collider.setHalfExtents({
					x: dimensions.x / 2,
					y: dimensions.y / 2,
					z: dimensions.z / 2,
				});
			} else if (shapeType === 0 && typeof collider.setRadius === "function") {
				collider.setRadius(Math.max(dimensions.x, dimensions.y, dimensions.z) / 2);
			} else if (shapeType === 10) {
				if (typeof collider.setRadius === "function") collider.setRadius(Math.max(dimensions.x, dimensions.z) / 2);
				if (typeof collider.setHalfHeight === "function") collider.setHalfHeight(dimensions.y / 2);
			}
		} catch (error) {
			console.warn("No se pudo actualizar la escala del collider animado", error);
		}
	}
}

export function hasMeaningfulScaleChange(a: Required<VectorLike>, b: Required<VectorLike>) {
	return AXES.some((axis) => Math.abs(a[axis] - b[axis]) > SCALE_EPSILON);
}

export function describeRotationTurns(turns: VectorLike | null | undefined) {
	const normalized = cloneVector(turns, { x: 0, y: 0, z: 0 });
	const parts = AXES
		.filter((axis) => Math.abs(normalized[axis]) >= 0.001)
		.map((axis) => `${axis.toUpperCase()} ${normalized[axis] > 0 ? "+" : ""}${normalized[axis].toFixed(2)}`);

	return parts.length ? parts.join(" / ") : "sin vueltas extra";
}

export function radiansToDegrees(value: number) {
	return value * (180 / Math.PI);
}

export function degreesToRadians(value: number) {
	return value * (Math.PI / 180);
}

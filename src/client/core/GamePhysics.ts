import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { StairsUtils } from "../utils/StairsUtils";
import { RampUtils } from "../utils/RampUtils";
import type { Game } from "../Game";

export const getTubeSegments = (scale: any) => {
	if (scale && scale.segments && Array.isArray(scale.segments) && scale.segments.length > 0) {
		return scale.segments;
	}
	const length1 = (scale && scale.y) || 2.0;
	const length2 = (scale && scale.length2) !== undefined ? scale.length2 : 2.0;
	const bendAngleX = (scale && scale.bendAngleX) !== undefined ? scale.bendAngleX : 0;
	const bendAngleY = (scale && scale.bendAngleY) !== undefined ? scale.bendAngleY : 90;
	return [
		{ length: length1, bendAngleX: 0, bendAngleY: 0 },
		{ length: length2, bendAngleX: bendAngleX, bendAngleY: bendAngleY }
	];
};

export function regenerateObjectPhysics(this: Game, objectMesh: THREE.Object3D) {
	if (!objectMesh || !this.world) return;

	if (objectMesh.userData.rigidBody) {
		this.world.removeRigidBody(objectMesh.userData.rigidBody);
		objectMesh.userData.rigidBody = null;
	}

	const dims = objectMesh.userData.originalScale || { x: 1, y: 1, z: 1 };

	const bodyDesc = RAPIER.RigidBodyDesc.fixed()
		.setTranslation(objectMesh.position.x, objectMesh.position.y, objectMesh.position.z)
		.setRotation(objectMesh.quaternion);

	const rigidBody = this.world.createRigidBody(bodyDesc);
	objectMesh.userData.rigidBody = rigidBody;

	let colDesc: any;
	if (objectMesh.userData.mapObjectType === "ramp") {
		colDesc = RampUtils.createColliderDesc(dims, RAPIER);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "stairs") {
		const steps = StairsUtils.calculateSteps(dims);
		steps.forEach((step: any) => {
			const col = RAPIER.ColliderDesc.cuboid(step.size.x / 2, step.size.y / 2, step.size.z / 2)
				.setTranslation(step.position.x, step.position.y, step.position.z);
			this.world.createCollider(col, rigidBody);
		});
	} else if (objectMesh.userData.mapObjectType === "ladder") {
		colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, 0.2)
			.setSensor(true);
		this.world.createCollider(colDesc, rigidBody);

		const railHalfW = 0.05;
		const railHalfH = dims.y / 2;
		const railHalfD = 0.05;

		const leftRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD)
			.setTranslation(-dims.x / 2, 0, 0);
		this.world.createCollider(leftRailCol, rigidBody);

		const rightRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD)
			.setTranslation(dims.x / 2, 0, 0);
		this.world.createCollider(rightRailCol, rigidBody);
	} else if (["impulse_jump", "impulse_lateral", "farming_zone", "gravity_pad"].includes(objectMesh.userData.mapObjectType)) {
		colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2)
			.setSensor(true);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "sphere" || objectMesh.userData.shapeType === "sphere" || objectMesh.userData.logicProperties?.shapeType === "sphere") {
		let r = 1.0;
		if (dims.radius !== undefined) {
			r = dims.radius;
		} else if (objectMesh.userData.logicProperties && objectMesh.userData.logicProperties.radius) {
			r = objectMesh.userData.logicProperties.radius;
		} else if (objectMesh.userData.radius) {
			r = objectMesh.userData.radius;
		} else {
			r = dims.x / 2;
		}

		colDesc = RAPIER.ColliderDesc.ball(r);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "cylinder") {
		const r = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
		const h = dims.y || 1.0;
		colDesc = RAPIER.ColliderDesc.cylinder(h / 2, r);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "circle") {
		const r = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
		const h = dims.y || 0.05;
		colDesc = RAPIER.ColliderDesc.cylinder(h / 2, r);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "cone") {
		const r = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
		const h = dims.y || 1.0;
		colDesc = RAPIER.ColliderDesc.cone(h / 2, r);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "spiked_floor") {
		colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2);
		this.world.createCollider(colDesc, rigidBody);
	} else if (objectMesh.userData.mapObjectType === "tube") {
		const radius = dims.radius !== undefined ? dims.radius : 0.5;
		const segments = getTubeSegments(dims);

		objectMesh.updateMatrixWorld(true);
		objectMesh.traverse((child: any) => {
			if (child.isMesh && (child.userData.isTubeSegment || child.userData.isTubeElbow)) {
				const localMat = objectMesh.matrixWorld.clone().invert().multiply(child.matrixWorld);
				const pos = new THREE.Vector3();
				const quat = new THREE.Quaternion();
				const scaleVec = new THREE.Vector3();
				localMat.decompose(pos, quat, scaleVec);

				if (child.userData.isTubeSegment) {
					const idx = child.userData.segmentIndex;
					const segLength = segments[idx].length || 2.0;
					const col = RAPIER.ColliderDesc.cylinder(segLength / 2, radius)
						.setTranslation(pos.x, pos.y, pos.z)
						.setRotation(quat);
					this.world.createCollider(col, rigidBody);
				} else if (child.userData.isTubeElbow) {
					const col = RAPIER.ColliderDesc.ball(radius)
						.setTranslation(pos.x, pos.y, pos.z);
					this.world.createCollider(col, rigidBody);
				}
			}
		});
	} else {
		colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2);
		this.world.createCollider(colDesc, rigidBody);
	}

	if (objectMesh.userData.logicProperties && objectMesh.userData.logicProperties.isTraversable) {
		const n = rigidBody.numColliders();
		for (let i = 0; i < n; i++) {
			rigidBody.collider(i).setSensor(true);
		}
	}
}

export function updateObjectPhysics(this: Game, object: THREE.Object3D) {
	this.regenerateObjectPhysics(object);
}

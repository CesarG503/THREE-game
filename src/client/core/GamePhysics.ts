import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { StairsUtils } from "../utils/StairsUtils";
import type { Game } from "../Game";

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
		colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2);
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
	} else if (objectMesh.userData.shapeType === "sphere" || objectMesh.userData.logicProperties?.shapeType === "sphere") {
		let r = 1.0;
		if (objectMesh.userData.logicProperties && objectMesh.userData.logicProperties.radius) {
			r = objectMesh.userData.logicProperties.radius;
		} else if (objectMesh.userData.radius) {
			r = objectMesh.userData.radius;
		} else {
			r = dims.x / 2;
		}

		colDesc = RAPIER.ColliderDesc.ball(r);
		this.world.createCollider(colDesc, rigidBody);
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

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { StairsUtils } from "../utils/StairsUtils";
import { RampUtils } from "../utils/RampUtils";
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
	} else if (objectMesh.userData.mapObjectType === "tube") {
		const radius = dims.radius !== undefined ? dims.radius : 0.5;
		const length1 = dims.y || 2.0;
		const length2 = dims.length2 !== undefined ? dims.length2 : 2.0;
		const bendAngleX = dims.bendAngleX !== undefined ? dims.bendAngleX : 0;
		const bendAngleY = dims.bendAngleY !== undefined ? dims.bendAngleY : 90;

		const col1 = RAPIER.ColliderDesc.cylinder(length1 / 2, radius)
			.setTranslation(0, length1 / 2, 0);
		this.world.createCollider(col1, rigidBody);

		const colElbow = RAPIER.ColliderDesc.ball(radius)
			.setTranslation(0, length1, 0);
		this.world.createCollider(colElbow, rigidBody);

		const bendRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(
			bendAngleX * Math.PI / 180,
			bendAngleY * Math.PI / 180,
			0
		));
		const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(bendRot).normalize();
		const sec2Center = new THREE.Vector3(0, length1, 0).addScaledVector(dir, length2 / 2);

		const col2 = RAPIER.ColliderDesc.cylinder(length2 / 2, radius)
			.setTranslation(sec2Center.x, sec2Center.y, sec2Center.z)
			.setRotation(bendRot);
		this.world.createCollider(col2, rigidBody);
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

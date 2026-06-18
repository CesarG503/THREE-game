import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

type TransformMode = "translate" | "scale" | "rotate";
type Axis = "x" | "y" | "z";

const TRANSFORM_MODES: TransformMode[] = ["translate", "scale", "rotate"];
const GIZMO_LAYER = 31;
const MIN_DIMENSION = 0.1;

function cloneDimensions(source: any) {
	const dims = source?.userData?.originalScale || { x: 1, y: 1, z: 1 };
	return {
		x: Number(dims.x) || 1,
		y: Number(dims.y) || 1,
		z: Number(dims.z) || 1,
	};
}

function clampDimension(value: number) {
	if (!Number.isFinite(value)) return MIN_DIMENSION;
	return Math.max(MIN_DIMENSION, Math.abs(value));
}

export class TransformGizmo {
	game: any;
	inspector: any;
	controls: TransformControls;
	helper: THREE.Object3D;
	proxy: THREE.Object3D;
	target: THREE.Object3D | null;
	modeIndex: number;
	dragState: any;
	wasInputEnabled: boolean | null;
	tmpBox: THREE.Box3;
	tmpSphere: THREE.Sphere;
	tmpSize: THREE.Vector3;

	constructor(game: any, inspector: any) {
		this.game = game;
		this.inspector = inspector;
		this.target = null;
		this.modeIndex = 0;
		this.dragState = null;
		this.wasInputEnabled = null;
		this.tmpBox = new THREE.Box3();
		this.tmpSphere = new THREE.Sphere();
		this.tmpSize = new THREE.Vector3();

		this.proxy = new THREE.Object3D();
		this.proxy.name = "TransformGizmoProxy";
		this.proxy.visible = false;
		this.proxy.userData.ignoreRaycast = true;
		game.sceneManager.scene.add(this.proxy);

		this.controls = new TransformControls(game.sceneManager.camera, game.sceneManager.renderer.domElement);
		this.controls.setMode("translate");
		this.controls.setSpace("local");
		this.controls.setColors(0xff4d4d, 0x4dff6d, 0x4d8dff, 0xffd84d);

		this.helper = this.controls.getHelper();
		this.helper.visible = false;
		this.applyGizmoLayer(this.helper);

		game.sceneManager.camera.layers.enable(GIZMO_LAYER);
		this.controls.getRaycaster().layers.set(GIZMO_LAYER);
		game.sceneManager.scene.add(this.helper);

		this.controls.addEventListener("mouseDown", this.handleMouseDown);
		this.controls.addEventListener("mouseUp", this.handleMouseUp);
		this.controls.addEventListener("objectChange", this.handleObjectChange);
	}

	attach(object: THREE.Object3D) {
		this.target = object;
		this.modeIndex = 0;
		this.syncProxyFromTarget(true);
		this.controls.attach(this.proxy);
		this.setMode("translate");
		this.helper.visible = true;
	}

	detach() {
		this.target = null;
		this.dragState = null;
		this.controls.detach();
		this.helper.visible = false;
		this.proxy.visible = false;
		this.restoreInput();
	}

	cycleMode() {
		if (!this.target) return this.getMode();
		this.modeIndex = (this.modeIndex + 1) % TRANSFORM_MODES.length;
		const mode = TRANSFORM_MODES[this.modeIndex];
		this.setMode(mode);
		this.syncProxyFromTarget(true);
		return mode;
	}

	getMode() {
		return TRANSFORM_MODES[this.modeIndex];
	}

	update() {
		if (!this.target || this.dragState) return;
		this.syncProxyFromTarget(false);
		this.updateSize();
	}

	dispose() {
		this.detach();
		this.controls.removeEventListener("mouseDown", this.handleMouseDown);
		this.controls.removeEventListener("mouseUp", this.handleMouseUp);
		this.controls.removeEventListener("objectChange", this.handleObjectChange);
		this.controls.disconnect();
		this.game.sceneManager.scene.remove(this.helper);
		this.game.sceneManager.scene.remove(this.proxy);
		this.helper.traverse((child: any) => {
			child.geometry?.dispose?.();
			if (Array.isArray(child.material)) {
				child.material.forEach((material: any) => material.dispose?.());
			} else {
				child.material?.dispose?.();
			}
		});
	}

	private setMode(mode: TransformMode) {
		this.controls.setMode(mode);
		this.controls.setSpace("local");
		this.controls.showX = true;
		this.controls.showY = true;
		this.controls.showZ = true;
		this.updateSize();
	}

	private handleMouseDown = () => {
		if (!this.target) return;

		this.dragState = {
			mode: this.getMode(),
			dimensionsStart: cloneDimensions(this.target),
			proxyPositionStart: this.proxy.position.clone(),
			proxyQuaternionStart: this.proxy.quaternion.clone(),
			proxyScaleStart: this.proxy.scale.clone(),
			targetWorldPositionStart: this.target.getWorldPosition(new THREE.Vector3()),
			targetQuaternionStart: this.target.quaternion.clone(),
		};

		if (this.game.inputManager) {
			this.wasInputEnabled = this.game.inputManager.enabled;
			this.game.inputManager.enabled = false;
			this.game.inputManager.reset?.();
		}

		document.exitPointerLock?.();
		this.game.cameraController?.setUIOpen?.(true);
	};

	private handleMouseUp = () => {
		if (!this.target || !this.dragState) {
			this.restoreInput();
			return;
		}

		if (this.dragState.mode === "scale") {
			this.inspector.applyGizmoDimensions?.(this.getPreviewDimensions(), this.dragState.dimensionsStart);
		} else {
			this.inspector.syncTransformInputs?.();
			this.inspector.refreshPhysicsAndVisuals?.();
		}

		this.dragState = null;
		this.proxy.scale.set(1, 1, 1);
		this.syncProxyFromTarget(true);
		this.restoreInput();
		this.game.cameraController?.setUIOpen?.(true);
	};

	private handleObjectChange = () => {
		if (!this.target || !this.dragState) return;

		const mode = this.dragState.mode;
		if (mode === "translate") {
			const delta = this.proxy.position.clone().sub(this.dragState.proxyPositionStart);
			const nextWorld = this.dragState.targetWorldPositionStart.clone().add(delta);
			this.applyWorldPositionToTarget(nextWorld);
			this.inspector.syncTransformInputs?.();
		} else if (mode === "rotate") {
			const deltaQuat = this.proxy.quaternion.clone().multiply(this.dragState.proxyQuaternionStart.clone().invert());
			this.target.quaternion.copy(deltaQuat.multiply(this.dragState.targetQuaternionStart));
			this.inspector.syncTransformInputs?.();
		} else if (mode === "scale") {
			this.inspector.previewGizmoDimensions?.(this.getPreviewDimensions());
		}

		this.updateSize();
	};

	private previewDimensionsFromProxy() {
		const dimensions = this.dragState.dimensionsStart;
		const scaleStart = this.dragState.proxyScaleStart;
		const scaleNow = this.proxy.scale;

		const next: Record<Axis, number> = { x: dimensions.x, y: dimensions.y, z: dimensions.z };
		(["x", "y", "z"] as Axis[]).forEach((axis) => {
			const start = Math.abs(scaleStart[axis]) > 0.0001 ? scaleStart[axis] : 1;
			next[axis] = clampDimension(dimensions[axis] * (scaleNow[axis] / start));
		});

		return next;
	}

	private getPreviewDimensions() {
		if (!this.target || !this.dragState) return cloneDimensions(this.target);
		return this.previewDimensionsFromProxy();
	}

	private syncProxyFromTarget(force: boolean) {
		if (!this.target || (!force && this.dragState)) return;

		this.proxy.position.copy(this.getHandlePosition());
		this.proxy.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));
		this.proxy.scale.set(1, 1, 1);
		this.proxy.visible = true;
		this.proxy.updateMatrixWorld(true);
		this.updateSize();
	}

	private getHandlePosition() {
		if (!this.target) return new THREE.Vector3();

		this.target.updateWorldMatrix(true, true);
		this.tmpBox.setFromObject(this.target);
		this.tmpBox.getBoundingSphere(this.tmpSphere);
		this.tmpBox.getSize(this.tmpSize);

		const handlePosition = this.tmpSphere.center.clone();
		const largest = Math.max(this.tmpSize.x, this.tmpSize.y, this.tmpSize.z);
		const thinSurface = this.tmpSize.y <= Math.max(0.75, largest * 0.08);

		if (largest >= 12 || thinSurface) {
			const lift = THREE.MathUtils.clamp(largest * 0.015, 0.35, 3);
			handlePosition.y = this.tmpBox.max.y + lift;
		}

		return handlePosition;
	}

	private applyWorldPositionToTarget(worldPosition: THREE.Vector3) {
		if (!this.target) return;

		if (this.target.parent) {
			const localPosition = worldPosition.clone();
			this.target.parent.worldToLocal(localPosition);
			this.target.position.copy(localPosition);
		} else {
			this.target.position.copy(worldPosition);
		}
	}

	private updateSize() {
		const size = this.getMode() === "rotate" ? 1.35 : 1.15;
		this.controls.setSize(size);
	}

	private restoreInput() {
		if (this.wasInputEnabled !== null && this.game.inputManager) {
			this.game.inputManager.enabled = this.wasInputEnabled;
			this.wasInputEnabled = null;
		}
	}

	private applyGizmoLayer(root: THREE.Object3D) {
		root.traverse((child: any) => {
			child.layers.set(GIZMO_LAYER);
			child.userData.ignoreRaycast = true;
			child.frustumCulled = false;
			child.renderOrder = 1000;
		});
	}
}

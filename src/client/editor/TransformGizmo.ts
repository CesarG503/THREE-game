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
	target: THREE.Object3D | null;
	modeIndex: number;
	dragState: any;
	wasInputEnabled: boolean | null;
	tmpBox: THREE.Box3;
	tmpSphere: THREE.Sphere;

	constructor(game: any, inspector: any) {
		this.game = game;
		this.inspector = inspector;
		this.target = null;
		this.modeIndex = 0;
		this.dragState = null;
		this.wasInputEnabled = null;
		this.tmpBox = new THREE.Box3();
		this.tmpSphere = new THREE.Sphere();

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
		this.controls.attach(object);
		this.setMode("translate");
		this.helper.visible = true;
		this.updateSize();
	}

	detach() {
		this.target = null;
		this.dragState = null;
		this.controls.detach();
		this.helper.visible = false;
		this.restoreInput();
	}

	cycleMode() {
		if (!this.target) return this.getMode();
		this.modeIndex = (this.modeIndex + 1) % TRANSFORM_MODES.length;
		const mode = TRANSFORM_MODES[this.modeIndex];
		this.setMode(mode);
		return mode;
	}

	getMode() {
		return TRANSFORM_MODES[this.modeIndex];
	}

	update() {
		if (!this.target) return;
		this.updateSize();
	}

	dispose() {
		this.detach();
		this.controls.removeEventListener("mouseDown", this.handleMouseDown);
		this.controls.removeEventListener("mouseUp", this.handleMouseUp);
		this.controls.removeEventListener("objectChange", this.handleObjectChange);
		this.controls.disconnect();
		this.game.sceneManager.scene.remove(this.helper);
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
		this.controls.setSpace(mode === "rotate" ? "local" : "local");
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
			scaleStart: this.target.scale.clone(),
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
			const dimensions = this.getPreviewDimensions();
			this.target.scale.copy(this.dragState.scaleStart);
			this.inspector.applyGizmoDimensions?.(dimensions, this.dragState.dimensionsStart);
		} else {
			this.inspector.syncTransformInputs?.();
			this.inspector.refreshPhysicsAndVisuals?.();
		}

		this.dragState = null;
		this.updateSize();
		this.restoreInput();
		this.game.cameraController?.setUIOpen?.(true);
	};

	private handleObjectChange = () => {
		if (!this.target) return;

		if (this.getMode() === "scale" && this.dragState) {
			this.inspector.syncTransformInputs?.(this.getPreviewDimensions());
		} else {
			this.inspector.syncTransformInputs?.();
		}

		this.updateSize();
	};

	private getPreviewDimensions() {
		if (!this.target || !this.dragState) return cloneDimensions(this.target);

		const dimensions = this.dragState.dimensionsStart;
		const scaleStart = this.dragState.scaleStart;
		const scaleNow = this.target.scale;

		const next: Record<Axis, number> = { x: dimensions.x, y: dimensions.y, z: dimensions.z };
		(["x", "y", "z"] as Axis[]).forEach((axis) => {
			const start = Math.abs(scaleStart[axis]) > 0.0001 ? scaleStart[axis] : 1;
			next[axis] = clampDimension(dimensions[axis] * (scaleNow[axis] / start));
		});

		return next;
	}

	private updateSize() {
		if (!this.target) return;

		const center = new THREE.Vector3();
		this.tmpBox.setFromObject(this.target);
		this.tmpBox.getBoundingSphere(this.tmpSphere);
		center.copy(this.tmpSphere.center);

		const radius = Math.max(0.5, this.tmpSphere.radius || 0.5);
		const camera = this.game.sceneManager.camera;
		const distance = Math.max(1, camera.position.distanceTo(center));

		let viewFactor = distance * 0.35;
		if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
			const perspectiveCamera = camera as THREE.PerspectiveCamera;
			viewFactor = distance * Math.min(
				1.9 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov * 0.5)) / perspectiveCamera.zoom,
				7,
			);
		}

		const desiredWorldReach = radius + Math.max(0.35, radius * 0.18);
		const modeMultiplier = this.getMode() === "rotate" ? 4 : 8;
		const size = THREE.MathUtils.clamp((desiredWorldReach * modeMultiplier) / Math.max(0.001, viewFactor), 0.85, 8);
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

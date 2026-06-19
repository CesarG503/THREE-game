import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
	getWaypointPosition,
	getWaypointRotation,
	getWaypointScale,
	normalizeMovementWaypoint,
	type MovementWaypoint,
} from "../utils/MovementWaypointUtils";

type TransformMode = "translate" | "rotate" | "scale";

const MODES: TransformMode[] = ["translate", "rotate", "scale"];
const GIZMO_LAYER = 31;
const MIN_DIMENSION = 0.1;

export class WaypointTransformGizmo {
	game: any;
	controls: TransformControls;
	helper: THREE.Object3D;
	proxy: THREE.Object3D;
	targetObject: THREE.Object3D | null;
	waypoint: MovementWaypoint | null;
	modeIndex: number;
	wasInputEnabled: boolean | null;
	isDragging: boolean;
	onChange: (() => void) | null;
	onCommit: (() => void) | null;

	constructor(game: any, callbacks: { onChange?: () => void; onCommit?: () => void } = {}) {
		this.game = game;
		this.targetObject = null;
		this.waypoint = null;
		this.modeIndex = 0;
		this.wasInputEnabled = null;
		this.isDragging = false;
		this.onChange = callbacks.onChange || null;
		this.onCommit = callbacks.onCommit || null;

		this.proxy = new THREE.Object3D();
		this.proxy.name = "WaypointTransformGizmoProxy";
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

	attach(object: THREE.Object3D, waypoint: MovementWaypoint, mode: TransformMode = this.getMode()) {
		this.targetObject = object;
		this.waypoint = normalizeMovementWaypoint(waypoint, object);
		this.syncProxyFromWaypoint();
		this.controls.attach(this.proxy);
		this.setMode(mode);
		this.helper.visible = true;
	}

	detach() {
		this.targetObject = null;
		this.waypoint = null;
		this.isDragging = false;
		this.controls.detach();
		this.helper.visible = false;
		this.proxy.visible = false;
		this.restoreInput();
	}

	setMode(mode: TransformMode) {
		const nextIndex = MODES.indexOf(mode);
		this.modeIndex = nextIndex >= 0 ? nextIndex : 0;
		this.controls.setMode(MODES[this.modeIndex]);
		this.controls.setSpace("local");
		this.controls.showX = true;
		this.controls.showY = true;
		this.controls.showZ = true;
		this.controls.setSize(this.getMode() === "rotate" ? 1.35 : 1.15);
		return this.getMode();
	}

	cycleMode() {
		this.modeIndex = (this.modeIndex + 1) % MODES.length;
		return this.setMode(MODES[this.modeIndex]);
	}

	getMode() {
		return MODES[this.modeIndex];
	}

	isInteracting() {
		return this.isDragging || Boolean((this.controls as any).dragging);
	}

	update() {
		if (!this.waypoint || this.isDragging) return;
		this.syncProxyFromWaypoint();
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

	private syncProxyFromWaypoint() {
		if (!this.targetObject || !this.waypoint) return;

		const pos = getWaypointPosition(this.waypoint, this.targetObject);
		const rot = getWaypointRotation(this.waypoint, this.targetObject);
		const scale = getWaypointScale(this.waypoint, this.targetObject);

		this.proxy.position.set(pos.x, pos.y, pos.z);
		this.proxy.rotation.set(rot.x, rot.y, rot.z);
		this.proxy.scale.set(scale.x, scale.y, scale.z);
		this.proxy.visible = true;
		this.proxy.updateMatrixWorld(true);
	}

	private writeProxyToWaypoint() {
		if (!this.targetObject || !this.waypoint) return;

		this.waypoint.x = this.proxy.position.x;
		this.waypoint.y = this.proxy.position.y;
		this.waypoint.z = this.proxy.position.z;
		this.waypoint.rotation = {
			x: this.proxy.rotation.x,
			y: this.proxy.rotation.y,
			z: this.proxy.rotation.z,
		};
		this.waypoint.rotY = this.proxy.rotation.y;
		this.waypoint.scale = {
			x: Math.max(MIN_DIMENSION, Math.abs(this.proxy.scale.x)),
			y: Math.max(MIN_DIMENSION, Math.abs(this.proxy.scale.y)),
			z: Math.max(MIN_DIMENSION, Math.abs(this.proxy.scale.z)),
		};
		normalizeMovementWaypoint(this.waypoint, this.targetObject);
	}

	private handleMouseDown = () => {
		this.isDragging = true;
		if (this.game.inputManager) {
			this.wasInputEnabled = this.game.inputManager.enabled;
			this.game.inputManager.enabled = false;
			this.game.inputManager.reset?.();
		}
		document.exitPointerLock?.();
		this.game.cameraController?.setUIOpen?.(true);
	};

	private handleMouseUp = () => {
		if (this.waypoint) {
			this.writeProxyToWaypoint();
			this.syncProxyFromWaypoint();
			this.onCommit?.();
		}
		this.isDragging = false;
		this.restoreInput();
		this.game.cameraController?.setUIOpen?.(true);
	};

	private handleObjectChange = () => {
		if (!this.waypoint) return;
		this.writeProxyToWaypoint();
		this.onChange?.();
	};

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

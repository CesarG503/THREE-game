import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { bendStackPoint, curveDimensions, normalizeCurvature, supportsCurvature, type CurveAxis } from "../utils/CurvatureUtils";

type TransformMode = "translate" | "scale" | "rotate" | "curvature";
type Axis = "x" | "y" | "z";

const TRANSFORM_MODES: TransformMode[] = ["translate", "scale", "rotate", "curvature"];
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
	curvatureActive = false;
	section: THREE.LineLoop;
	curveArc: THREE.Line;
	modeBadge: HTMLDivElement | null = null;


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

		this.section = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x48ddff, depthTest: false, transparent: true, opacity: 0.9 }));
		this.section.name = "CurvatureMidpointSection";
		this.section.visible = false;
		this.applyGizmoLayer(this.section);
		game.sceneManager.scene.add(this.section);

		this.curveArc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffbd45, depthTest: false }));
		this.curveArc.visible = false;
		this.applyGizmoLayer(this.curveArc);
		game.sceneManager.scene.add(this.curveArc);
		if (typeof document !== "undefined" && document.createElement) {
			this.modeBadge = document.createElement("div");
			this.modeBadge.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:9px 16px;border:1px solid #63748a;border-radius:8px;background:#142131ed;color:white;font:600 13px sans-serif;z-index:1900;pointer-events:none;display:none";
			document.body.appendChild(this.modeBadge);
		}

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
		this.curvatureActive = false;
		this.section.visible = false;
		this.target = object;
		this.modeIndex = 0;
		this.syncProxyFromTarget(true);
		this.controls.attach(this.proxy);
		this.setMode("translate");
		this.helper.visible = true;
	}

	detach() {
		if (this.dragState && this.target) this.handleMouseUp();
		this.curvatureActive = false;
		this.section.visible = false;
		this.curveArc.visible = false;
		if (this.modeBadge) this.modeBadge.style.display = "none";
		this.target = null;
		this.dragState = null;
		this.controls.detach();
		this.helper.visible = false;
		this.proxy.visible = false;
		this.restoreInput();
	}

	cycleMode() {
		if (!this.target || this.dragState) return this.getMode();
		const count = this.canCurve() ? TRANSFORM_MODES.length : TRANSFORM_MODES.length - 1;
		this.modeIndex = (this.modeIndex + 1) % count;
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
		this.section.removeFromParent();
		this.section.geometry.dispose();
		this.curveArc.removeFromParent();
		this.curveArc.geometry.dispose();
		(this.curveArc.material as THREE.Material).dispose();
		this.modeBadge?.remove();
		(this.section.material as THREE.Material).dispose();
		this.helper.traverse((child: any) => {
			child.geometry?.dispose?.();
			if (Array.isArray(child.material)) {
				child.material.forEach((material: any) => material.dispose?.());
			} else {
				child.material?.dispose?.();
			}
		});
	}

	private canCurve() {
		return this.target && supportsCurvature(this.target.userData.mapObjectType) && this.target.userData.originalScale?.curvature?.enabled;
	}

	setMode(mode: TransformMode) {
		if (this.dragState || (mode === "curvature" && !this.canCurve())) return;
		this.curvatureActive = mode === "curvature";
		this.modeIndex = TRANSFORM_MODES.indexOf(mode);
		this.controls.setMode(mode === "curvature" ? "translate" : mode);
		this.controls.setSpace("local");
		this.controls.setColors(...(this.curvatureActive ? [0xffbd45, 0xffbd45, 0xffbd45, 0xffffff] : [0xff4d4d, 0x4dff6d, 0x4d8dff, 0xffd84d]) as [number, number, number, number]);
		this.syncProxyFromTarget(true);
		this.inspector.syncCurvatureInputs?.();
	}

	private updateModeVisuals() {
		const curve = normalizeCurvature(this.target?.userData.originalScale?.curvature);
		this.controls.showX = !this.curvatureActive || curve.direction === "x";
		this.controls.showY = !this.curvatureActive || curve.direction === "y";
		this.controls.showZ = !this.curvatureActive || curve.direction === "z";
		if (this.modeBadge) {
			const labels = { translate: "Mover", scale: "Escalar", rotate: "Rotar", curvature: "∿ Curvatura" };
			this.modeBadge.style.display = this.target ? "block" : "none";
			this.modeBadge.style.color = this.curvatureActive ? "#ffbd45" : "#e0ecff";
			this.modeBadge.style.borderColor = this.curvatureActive ? "#ffbd45" : "#63748a";
			this.modeBadge.textContent = labels[this.getMode()] + (this.curvatureActive ? ` · Curva ${curve.activeLayer + 1} · ${curve.axis.toUpperCase()} → ${curve.direction.toUpperCase()}` : "") + " · R: siguiente";
		}
	}

	private handleMouseDown = () => {
		if (!this.target) return;

		this.dragState = {
			mode: this.getMode(),
			curvatureStart: normalizeCurvature(this.target.userData.originalScale?.curvature),
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
		if (mode === "curvature") {
			const localDelta = this.proxy.position.clone().sub(this.dragState.proxyPositionStart)
				.applyQuaternion(this.dragState.proxyQuaternionStart.clone().invert());
			const start = this.dragState.curvatureStart;
			const dims = curveDimensions(this.target.userData.mapObjectType, this.target.userData.originalScale);
			this.inspector.updateCurvature?.({ activeLayer: start.activeLayer, angle: start.angle + localDelta[start.direction] / Math.max(0.5, dims[start.axis] / 2) * 360 }, false);

		} else if (mode === "translate") {
			const delta = this.proxy.position.clone().sub(this.dragState.proxyPositionStart);
			const nextWorld = this.dragState.targetWorldPositionStart.clone().add(delta);
			this.applyWorldPositionToTarget(nextWorld);
			this.inspector.syncTransformInputs?.();
		} else if (mode === "rotate") {
			if (this.target.parent && this.target.parent.name !== "TransformGizmoProxy" && this.target.parent.constructor.name !== "Scene") {
				const parentWorldQuat = this.target.parent.getWorldQuaternion(new THREE.Quaternion());
				const localQuat = parentWorldQuat.clone().invert().multiply(this.proxy.quaternion);
				this.target.quaternion.copy(localQuat);
			} else {
				const deltaQuat = this.proxy.quaternion.clone().multiply(this.dragState.proxyQuaternionStart.clone().invert());
				this.target.quaternion.copy(deltaQuat.multiply(this.dragState.targetQuaternionStart));
			}
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

		this.proxy.position.copy(this.curvatureActive ? this.target.getWorldPosition(new THREE.Vector3()) : this.getHandlePosition());
		this.updateSection();
		this.updateModeVisuals();
		this.proxy.quaternion.copy(this.target.getWorldQuaternion(new THREE.Quaternion()));
		this.proxy.scale.set(1, 1, 1);
		this.proxy.visible = true;
		this.proxy.updateMatrixWorld(true);
		this.updateSize();
	}

	private updateSection() {
		this.section.visible = this.curvatureActive && !!this.target;
		this.curveArc.visible = this.section.visible;
		if (!this.section.visible || !this.target) return;
		const dims = curveDimensions(this.target.userData.mapObjectType, this.target.userData.originalScale);
		const curve = normalizeCurvature(this.target.userData.originalScale.curvature);
		const axes = (["x", "y", "z"] as CurveAxis[]).filter(axis => axis !== curve.axis);
		const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
			const point = new THREE.Vector3();
			point[axes[0]] = u * dims[axes[0]] / 2;
			point[axes[1]] = v * dims[axes[1]] / 2;
			return this.target!.localToWorld(bendStackPoint(point, dims, curve));
		});
		this.section.geometry.setFromPoints(points);
		this.section.geometry.computeBoundingSphere();
		const radius = Math.max(0.35, Math.min(1.5, dims[curve.axis] * 0.15));
		const arc = Array.from({ length: 49 }, (_, i) => {
			const angle = -Math.PI * 0.8 + i / 48 * Math.PI * 1.6;
			const point = new THREE.Vector3();
			point[curve.axis] = Math.sin(angle) * radius;
			point[curve.direction] = (1 - Math.cos(angle)) * radius;
			return this.target!.localToWorld(point);
		});
		this.curveArc.geometry.setFromPoints(arc);
		this.curveArc.geometry.computeBoundingSphere();
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

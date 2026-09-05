import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { createCurveDeformer, curveDimensions, normalizeCurvature, supportsCurvature, type CurveAxis } from "../utils/CurvatureUtils";

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
	curvatureOriginEditing = false;
	section: THREE.LineLoop;
	curveArc: THREE.Line;
	originMarkers = new THREE.Group();
	originPath = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x48ddff, depthTest: false, transparent: true, opacity: 0.45 }));
	private originPointer: number | null = null;
	private originDragSurface: THREE.Mesh | null = null;


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
		this.section.name = "CurvatureOriginSection";
		this.section.visible = false;
		this.applyGizmoLayer(this.section);
		game.sceneManager.scene.add(this.section);

		this.curveArc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffbd45, depthTest: false }));
		this.curveArc.visible = false;
		this.applyGizmoLayer(this.curveArc);
		game.sceneManager.scene.add(this.curveArc);


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

		game.sceneManager.scene.add(this.originMarkers, this.originPath);
		this.originMarkers.visible = this.originPath.visible = false;
		this.applyGizmoLayer(this.originPath);
		const canvas = game.sceneManager.renderer.domElement;
		canvas.addEventListener("pointerdown", this.handleOriginPointerDown, true);
		canvas.addEventListener("pointermove", this.handleOriginPointerMove, true);
		canvas.addEventListener("pointerup", this.handleOriginPointerUp, true);
		canvas.addEventListener("pointercancel", this.handleOriginPointerUp, true);
		canvas.addEventListener("lostpointercapture", this.handleOriginPointerUp, true);
		this.controls.addEventListener("mouseDown", this.handleMouseDown);
		this.controls.addEventListener("mouseUp", this.handleMouseUp);
		this.controls.addEventListener("objectChange", this.handleObjectChange);
	}

	attach(object: THREE.Object3D) {
		this.curvatureActive = false;
		this.curvatureOriginEditing = false;
		this.section.visible = false;
		this.target = object;
		this.modeIndex = 0;
		this.syncProxyFromTarget(true);
		this.controls.attach(this.proxy);
		this.setMode("translate");
		this.helper.visible = true;
	}

	detach() {
		this.finishOriginDrag();
		if (this.dragState && this.target) this.handleMouseUp();
		this.curvatureActive = false;
		this.curvatureOriginEditing = false;
		this.section.visible = false;
		this.curveArc.visible = false;
		this.originMarkers.visible = this.originPath.visible = false;
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
		const canvas = this.game.sceneManager.renderer.domElement;
		canvas.removeEventListener("pointerdown", this.handleOriginPointerDown, true);
		canvas.removeEventListener("pointermove", this.handleOriginPointerMove, true);
		canvas.removeEventListener("pointerup", this.handleOriginPointerUp, true);
		canvas.removeEventListener("pointercancel", this.handleOriginPointerUp, true);
		canvas.removeEventListener("lostpointercapture", this.handleOriginPointerUp, true);
		this.originMarkers.removeFromParent();
		for (const child of this.originMarkers.children as THREE.Mesh[]) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
		this.originPath.removeFromParent();
		this.originPath.geometry.dispose();
		(this.originPath.material as THREE.Material).dispose();
		this.controls.disconnect();
		this.game.sceneManager.scene.remove(this.helper);
		this.game.sceneManager.scene.remove(this.proxy);
		this.section.removeFromParent();
		this.section.geometry.dispose();
		this.curveArc.removeFromParent();
		this.curveArc.geometry.dispose();
		(this.curveArc.material as THREE.Material).dispose();
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
		this.controls.setColors(...(this.curvatureActive ? (this.curvatureOriginEditing ? [0x48ddff, 0x48ddff, 0x48ddff, 0xffffff] : [0xffbd45, 0xffbd45, 0xffbd45, 0xffffff]) : [0xff4d4d, 0x4dff6d, 0x4d8dff, 0xffd84d]) as [number, number, number, number]);
		this.syncProxyFromTarget(true);
		this.inspector.syncCurvatureInputs?.();
	}

	setCurvatureOriginEditing(editing: boolean) {
		if (this.dragState || !this.canCurve()) return;
		this.curvatureOriginEditing = editing;
		this.setMode("curvature");
	}

	private updateModeVisuals() {
		const curve = normalizeCurvature(this.target?.userData.originalScale?.curvature);
		const axis = this.curvatureOriginEditing ? curve.axis : curve.direction;
		this.controls.showX = !this.curvatureActive || axis === "x";
		this.controls.showY = !this.curvatureActive || axis === "y";
		this.controls.showZ = !this.curvatureActive || axis === "z";

	}

	private pointerRay(event: PointerEvent) {
		const rect = this.game.sceneManager.renderer.domElement.getBoundingClientRect();
		const ray = new THREE.Raycaster();
		ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.game.sceneManager.camera);
		return ray;
	}

	private handleOriginPointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || !this.curvatureActive || !this.curvatureOriginEditing || !this.target || this.dragState) return;
		const mesh = this.target as THREE.Mesh;
		if (!mesh.geometry?.getAttribute("curveSourcePosition")) return;
		const ray = this.pointerRay(event);
		this.originMarkers.updateMatrixWorld(true);
		ray.layers.set(GIZMO_LAYER);
		const marker = ray.intersectObjects(this.originMarkers.children)[0];
		ray.layers.set(0);
		mesh.updateWorldMatrix(true, false);
		const hit = ray.intersectObject(mesh, false)[0];
		if (!marker && !hit && !this.controls.axis) return;
		event.preventDefault(); event.stopImmediatePropagation();
		if (marker) {
			this.inspector.updateCurvature?.({ activeLayer: marker.object.userData.curveLayer }, false);
			this.syncProxyFromTarget(true);
		}
		// Pick against the shape at drag start so rebuilding the bend cannot make
		// the pointer chase its own deformation or jump to another section.
		this.originDragSurface = new THREE.Mesh(mesh.geometry.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
		this.originDragSurface.matrixAutoUpdate = false;
		this.originDragSurface.matrix.copy(mesh.matrixWorld);
		this.originDragSurface.matrixWorld.copy(mesh.matrixWorld);
		this.handleMouseDown();
		this.originPointer = event.pointerId;
		this.controls.enabled = false;
		this.controls.dispatchEvent({ type: "dragging-changed", value: true });
		this.game.sceneManager.renderer.domElement.setPointerCapture(event.pointerId);
		if (!marker && hit) this.moveOriginToPointer(event);
	};

	private moveOriginToPointer(event: PointerEvent) {
		if (!this.originDragSurface || !this.target || !this.dragState) return;
		const ray = this.pointerRay(event);
		const hit = ray.intersectObject(this.originDragSurface, false)[0];
		const curve = this.dragState.curvatureStart;
		const dims = curveDimensions(this.target.userData.mapObjectType, this.target.userData.originalScale);
		let origin: number;
		if (hit?.face) {
			const geometry = this.originDragSurface.geometry;
			const positions = geometry.getAttribute("position"), source = geometry.getAttribute("curveSourcePosition");
			const indices = [hit.face.a, hit.face.b, hit.face.c];
			const vertices = indices.map(i => new THREE.Vector3().fromBufferAttribute(positions, i));
			const local = this.originDragSurface.worldToLocal(hit.point.clone());
			const weights = THREE.Triangle.getBarycoord(local, vertices[0], vertices[1], vertices[2], new THREE.Vector3());
			if (!weights) return;
			const material = new THREE.Vector3();
			indices.forEach((i, j) => material.addScaledVector(new THREE.Vector3().fromBufferAttribute(source, i), weights.getComponent(j)));
			origin = material[curve.axis] / dims[curve.axis] + 0.5;
		} else {
			// Outside the surface, follow the closest point of the visible path.
			const deformer = createCurveDeformer(dims, curve);
			let best = Infinity;
			origin = curve.origin;
			const rect = this.game.sceneManager.renderer.domElement.getBoundingClientRect();
			for (let i = 0; i <= 192; i++) {
				const p = new THREE.Vector3(); p[curve.axis] = (i / 192 - 0.5) * dims[curve.axis];
				this.target.localToWorld(deformer.transform(p)).project(this.game.sceneManager.camera);
				const distance = ((p.x + 1) * rect.width / 2 + rect.left - event.clientX) ** 2 + ((1 - p.y) * rect.height / 2 + rect.top - event.clientY) ** 2;
				// At closed/overlapping paths, prefer the current material section.
				const score = distance + Math.abs(i / 192 - this.target.userData.originalScale.curvature.origin) * 0.01;
				if (score < best) { best = score; origin = i / 192; }
			}
		}
		this.inspector.updateCurvature?.({ activeLayer: curve.activeLayer, origin: THREE.MathUtils.clamp(origin, 0, 1) }, false);
		this.syncProxyFromTarget(true);
	}

	private handleOriginPointerMove = (event: PointerEvent) => {
		if (event.pointerId !== this.originPointer) return;
		event.preventDefault(); event.stopImmediatePropagation();
		this.moveOriginToPointer(event);
	};

	private handleOriginPointerUp = (event: PointerEvent) => {
		if (event.pointerId !== this.originPointer) return;
		event.preventDefault(); event.stopImmediatePropagation();
		this.finishOriginDrag();
	};

	private finishOriginDrag() {
		if (this.originPointer === null) return;
		const pointer = this.originPointer;
		this.originPointer = null;
		const canvas = this.game.sceneManager.renderer.domElement;
		if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
		this.originDragSurface?.geometry.dispose();
		(this.originDragSurface?.material as THREE.Material)?.dispose();
		this.originDragSurface = null;
		this.controls.enabled = true;
		this.controls.dispatchEvent({ type: "dragging-changed", value: false });
		this.handleMouseUp();
	}

	private handleMouseDown = () => {
		if (!this.target) return;

		this.dragState = {
			mode: this.getMode(),
			moveCurveOrigin: this.curvatureOriginEditing,
			curveHandleScale: this.curvatureActive ? this.getCurveHandleFrame().scale : 1,
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
			if (this.dragState.moveCurveOrigin) {
				const origin = start.origin + localDelta[start.axis] / (dims[start.axis] * this.dragState.curveHandleScale);
				this.inspector.updateCurvature?.({ activeLayer: start.activeLayer, origin: THREE.MathUtils.clamp(origin, 0, 1) }, false);
			} else {
				this.inspector.updateCurvature?.({ activeLayer: start.activeLayer, angle: start.angle + localDelta[start.direction] / (Math.max(0.5, dims[start.axis] / 2) * this.dragState.curveHandleScale) * 360 }, false);
			}
			this.syncProxyFromTarget(true);

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

		const frame = this.curvatureActive ? this.getCurveHandleFrame() : null;
		this.proxy.position.copy(frame ? frame.position : this.getHandlePosition());
		this.updateSection();
		this.updateModeVisuals();
		this.proxy.quaternion.copy(frame ? frame.quaternion : this.target.getWorldQuaternion(new THREE.Quaternion()));
		this.proxy.scale.set(1, 1, 1);
		this.proxy.visible = true;
		this.proxy.updateMatrixWorld(true);
		this.updateSize();
	}

	// Geometry, markers and drag axes all use the same complete deformation.
	private getCurveHandleFrame() {
		const target = this.target!;
		const dims = curveDimensions(target.userData.mapObjectType, target.userData.originalScale);
		const curve = normalizeCurvature(target.userData.originalScale.curvature);
		const anchor = new THREE.Vector3();
		anchor[curve.axis] = (curve.origin - 0.5) * dims[curve.axis];
		const axis = this.curvatureOriginEditing ? curve.axis : curve.direction;
		const unit = new THREE.Vector3();
		unit[axis] = 1;
		const epsilon = 0.0001;
		const deformer = createCurveDeformer(dims, curve);
		const transform = (point: THREE.Vector3) => target.localToWorld(deformer.transform(point));
		const position = transform(anchor.clone());
		const tangent = transform(anchor.clone().addScaledVector(unit, epsilon))
			.sub(transform(anchor.clone().addScaledVector(unit, -epsilon))).multiplyScalar(1 / (2 * epsilon));
		const scale = Math.max(0.0001, tangent.length());
		if (tangent.lengthSq() < 1e-12) tangent.copy(unit).applyQuaternion(target.getWorldQuaternion(new THREE.Quaternion()));
		const quaternion = new THREE.Quaternion().setFromUnitVectors(unit, tangent.normalize());
		return { position, quaternion, scale };
	}

	private updateSection() {
		this.section.visible = this.curvatureActive && !!this.target;
		this.curveArc.visible = this.originMarkers.visible = this.section.visible;
		this.originPath.visible = this.section.visible && this.curvatureOriginEditing;
		if (!this.section.visible || !this.target) return;
		const dims = curveDimensions(this.target.userData.mapObjectType, this.target.userData.originalScale);
		const curve = normalizeCurvature(this.target.userData.originalScale.curvature);
		const deformer = createCurveDeformer(dims, curve);
		const transform = (point: THREE.Vector3) => this.target!.localToWorld(deformer.transform(point));
		const axes = (["x", "y", "z"] as CurveAxis[]).filter(axis => axis !== curve.axis);
		// Subdivide the section too: later bends can curve its edges.
		const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
		const points: THREE.Vector3[] = [];
		for (let edge = 0; edge < 4; edge++) for (let step = 0; step < 16; step++) {
			const [u, v] = corners[edge], [u2, v2] = corners[(edge + 1) % 4];
			const point = new THREE.Vector3();
			point[curve.axis] = (curve.origin - 0.5) * dims[curve.axis];
			point[axes[0]] = THREE.MathUtils.lerp(u, u2, step / 16) * dims[axes[0]] / 2;
			point[axes[1]] = THREE.MathUtils.lerp(v, v2, step / 16) * dims[axes[1]] / 2;
			points.push(transform(point));
		}
		while (this.originMarkers.children.length > curve.layers.length) {
			const marker = this.originMarkers.children.at(-1) as THREE.Mesh;
			marker.removeFromParent(); marker.geometry.dispose(); (marker.material as THREE.Material).dispose();
		}
		curve.layers.forEach((layer, index) => {
			let marker = this.originMarkers.children[index] as THREE.Mesh;
			if (!marker) {
				marker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ depthTest: false }));
				marker.userData.curveLayer = index;
				this.applyGizmoLayer(marker); this.originMarkers.add(marker);
			}
			const anchor = new THREE.Vector3(); anchor[layer.axis] = (layer.origin - 0.5) * dims[layer.axis];
			marker.position.copy(transform(anchor));
			const camera = this.game.sceneManager.camera;
			const radius = camera.isOrthographicCamera ? (camera.top - camera.bottom) / camera.zoom * 0.006 : marker.position.distanceTo(camera.getWorldPosition(new THREE.Vector3())) * 0.006;
			marker.scale.setScalar(Math.max(0.03, radius));
			(marker.material as THREE.MeshBasicMaterial).color.setHex(index === curve.activeLayer ? 0x48ddff : 0x7196aa);
		});
		const path = Array.from({ length: 97 }, (_, i) => {
			const point = new THREE.Vector3(); point[curve.axis] = (i / 96 - 0.5) * dims[curve.axis];
			return transform(point);
		});
		this.originPath.geometry.setFromPoints(path); this.originPath.geometry.computeBoundingSphere();
		this.section.geometry.setFromPoints(points);
		this.section.geometry.computeBoundingSphere();
		const radius = Math.max(0.35, Math.min(1.5, dims[curve.axis] * 0.15));
		const arc = Array.from({ length: 49 }, (_, i) => {
			const angle = -Math.PI * 0.8 + i / 48 * Math.PI * 1.6;
			const point = new THREE.Vector3();
			point[curve.axis] = (curve.origin - 0.5) * dims[curve.axis] + Math.sin(angle) * radius;
			point[curve.direction] = (1 - Math.cos(angle)) * radius;
			return transform(point);
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

/**
 * EditorGroupManager.ts
 * VIPER IO — Gestor de grupos lógicos y pivotes en la escena.
 *
 * Mantiene la separación entre la jerarquía lógica y la escena Three.js/Rapier:
 * - Los objetos Three.js se mantienen a nivel de escena con sus RigidBodies mundiales.
 * - Cada grupo lógico dispone de un objeto proxy de pivote central en la escena.
 * - Permite transformar el grupo (trasladar/rotar todos los miembros relativamente al pivote).
 * - Permite editar el pivote de forma independiente (sin mover los objetos).
 * - Dibuja líneas de acople visuales entre el pivote central y sus objetos hijos.
 */

import * as THREE from "three";
import { EditorHierarchyModel, type HierarchyNode } from "./EditorHierarchyModel";

export interface GroupPivotTransform {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
}

export class EditorGroupManager {
	private hierarchy: EditorHierarchyModel;
	private scene: THREE.Scene;
	private pivotProxies: Map<string, THREE.Object3D> = new Map();
	private couplingLinesGroup: THREE.Group;
	private isCouplingModeActive: boolean = false;
	private isPivotEditModeActive: boolean = false;

	constructor(hierarchy: EditorHierarchyModel, scene: THREE.Scene) {
		this.hierarchy = hierarchy;
		this.scene = scene;

		this.couplingLinesGroup = new THREE.Group();
		this.couplingLinesGroup.name = "EditorCouplingVisuals";
		this.couplingLinesGroup.renderOrder = 999;
		this.scene.add(this.couplingLinesGroup);
	}

	getHierarchy(): EditorHierarchyModel {
		return this.hierarchy;
	}

	/**
	 * Activa o desactiva el modo de visualización y edición de acoples.
	 */
	setCouplingMode(active: boolean) {
		this.isCouplingModeActive = active;
		this.couplingLinesGroup.visible = active;
		if (active) {
			this.updateCouplingVisuals();
		}
	}

	isCouplingMode(): boolean {
		return this.isCouplingModeActive;
	}

	/**
	 * Activa o desactiva el modo de reubicación de pivote independiente.
	 */
	setPivotEditMode(active: boolean) {
		this.isPivotEditModeActive = active;
	}

	isPivotEditMode(): boolean {
		return this.isPivotEditModeActive;
	}

	/**
	 * Obtiene o crea el proxy de pivote para un grupo en la escena.
	 */
	getOrCreatePivotProxy(groupId: string): THREE.Object3D {
		let proxy = this.pivotProxies.get(groupId);
		if (!proxy) {
			const groupNode = this.hierarchy.getNode(groupId);
			if (!groupNode || !groupNode.isGroup) {
				throw new Error(`El nodo ${groupId} no es un grupo válido`);
			}

			proxy = new THREE.Object3D();
			proxy.name = `GroupPivot_${groupId}`;
			proxy.userData.isEditorGroupPivot = true;
			proxy.userData.groupId = groupId;
			proxy.userData.isEditableMapObject = true; // Permite ser seleccionado por el editor/gizmo
			proxy.userData.mapObjectType = "group_pivot";
			proxy.userData.customName = groupNode.customName || groupNode.name;
			proxy.userData.uuid = groupId;

			if (groupNode.pivot) {
				proxy.position.set(groupNode.pivot.pos.x, groupNode.pivot.pos.y, groupNode.pivot.pos.z);
				if (groupNode.pivot.rot) {
					proxy.quaternion.set(
						groupNode.pivot.rot.x,
						groupNode.pivot.rot.y,
						groupNode.pivot.rot.z,
						groupNode.pivot.rot.w ?? 1
					);
				}
			}

			this.scene.add(proxy);
			this.pivotProxies.set(groupId, proxy);
		}
		return proxy;
	}

	/**
	 * Calcula el centro geométrico de todos los objetos directos o indirectos del grupo.
	 */
	calculateGroupCenter(groupId: string, objectResolver: (uuid: string) => THREE.Object3D | null): THREE.Vector3 {
		const descendants = this.hierarchy.getDescendants(groupId);
		const center = new THREE.Vector3();
		let count = 0;

		descendants.forEach((node) => {
			if (!node.isGroup) {
				const obj = objectResolver(node.id);
				if (obj) {
					center.add(obj.position);
					count++;
				}
			}
		});

		if (count > 0) {
			center.divideScalar(count);
		}
		return center;
	}

	/**
	 * Inicializa o recalcula el pivote central de un grupo a partir de sus objetos.
	 */
	recenterGroupPivot(groupId: string, objectResolver: (uuid: string) => THREE.Object3D | null): THREE.Vector3 {
		const center = this.calculateGroupCenter(groupId, objectResolver);
		const proxy = this.getOrCreatePivotProxy(groupId);
		proxy.position.copy(center);
		proxy.quaternion.identity();

		this.hierarchy.updatePivot(groupId, { x: center.x, y: center.y, z: center.z });
		return center;
	}

	/**
	 * Aplica una transformación de pivote al grupo.
	 * Si isPivotEditMode es false: mueve/rota todos los objetos miembros de forma rígida respecto al pivote anterior.
	 * Si isPivotEditMode es true: solo reubica el pivote sin alterar las transformaciones mundiales de los objetos.
	 */
	applyGroupTransform(
		groupId: string,
		newPivotPosition: THREE.Vector3,
		newPivotQuaternion: THREE.Quaternion,
		objectResolver: (uuid: string) => THREE.Object3D | null,
		onObjectTransformed?: (obj: THREE.Object3D) => void
	) {
		const proxy = this.getOrCreatePivotProxy(groupId);
		const prevPosition = proxy.position.clone();
		const prevQuaternion = proxy.quaternion.clone();

		// Actualizar proxy de pivote
		proxy.position.copy(newPivotPosition);
		proxy.quaternion.copy(newPivotQuaternion);
		this.hierarchy.updatePivot(groupId, {
			x: newPivotPosition.x,
			y: newPivotPosition.y,
			z: newPivotPosition.z,
		}, {
			x: newPivotQuaternion.x,
			y: newPivotQuaternion.y,
			z: newPivotQuaternion.z,
			w: newPivotQuaternion.w,
		});

		// Si estamos en modo de edición de pivote, NO se alteran las posiciones de los hijos
		if (this.isPivotEditModeActive) {
			if (this.isCouplingModeActive) {
				this.updateCouplingVisuals(objectResolver);
			}
			return;
		}

		// Matriz delta de transformación del pivote
		const prevPivotMatrix = new THREE.Matrix4().compose(
			prevPosition,
			prevQuaternion,
			new THREE.Vector3(1, 1, 1)
		);
		const nextPivotMatrix = new THREE.Matrix4().compose(
			newPivotPosition,
			newPivotQuaternion,
			new THREE.Vector3(1, 1, 1)
		);
		const deltaMatrix = new THREE.Matrix4()
			.copy(nextPivotMatrix)
			.multiply(prevPivotMatrix.clone().invert());

		// Aplicar delta a todos los descendientes que sean objetos (o subgrupos)
		const descendants = this.hierarchy.getDescendants(groupId);

		descendants.forEach((node) => {
			if (!node.isGroup) {
				const obj = objectResolver(node.id);
				if (obj) {
					// Transformar posición y rotación aplicando deltaMatrix
					obj.updateMatrixWorld(true);
					const worldMat = obj.matrixWorld.clone();
					const nextWorldMat = deltaMatrix.clone().multiply(worldMat);

					const nextPos = new THREE.Vector3();
					const nextQuat = new THREE.Quaternion();
					const nextScale = new THREE.Vector3();
					nextWorldMat.decompose(nextPos, nextQuat, nextScale);

					obj.position.copy(nextPos);
					obj.quaternion.copy(nextQuat);
					obj.updateMatrixWorld(true);

					if (onObjectTransformed) {
						onObjectTransformed(obj);
					}
				}
			} else {
				// Actualizar también el proxy del subgrupo si existe
				const subProxy = this.pivotProxies.get(node.id);
				if (subProxy) {
					const nextSubPos = subProxy.position.clone().applyMatrix4(deltaMatrix);
					const rotDelta = new THREE.Quaternion().setFromRotationMatrix(deltaMatrix);
					const nextSubQuat = rotDelta.multiply(subProxy.quaternion);

					subProxy.position.copy(nextSubPos);
					subProxy.quaternion.copy(nextSubQuat);
					this.hierarchy.updatePivot(node.id, {
						x: nextSubPos.x,
						y: nextSubPos.y,
						z: nextSubPos.z,
					});
				}
			}
		});

		if (this.isCouplingModeActive) {
			this.updateCouplingVisuals(objectResolver);
		}
	}

	/**
	 * Actualiza las líneas visuales de conexión de acople entre los pivotes y los objetos.
	 */
	updateCouplingVisuals(objectResolver?: (uuid: string) => THREE.Object3D | null) {
		if (!this.isCouplingModeActive) return;

		// Limpiar visuales anteriores
		while (this.couplingLinesGroup.children.length > 0) {
			const child = this.couplingLinesGroup.children.pop();
			if (child && (child as THREE.Line).geometry) {
				(child as THREE.Line).geometry.dispose();
				((child as THREE.Line).material as THREE.Material).dispose();
			}
		}

		if (!objectResolver) return;

		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffcc,
			transparent: true,
			opacity: 0.85,
			depthTest: false,
		});

		const groups = this.hierarchy.getAllNodes().filter((n) => n.isGroup);

		groups.forEach((groupNode) => {
			const proxy = this.pivotProxies.get(groupNode.id);
			if (!proxy) return;

			const children = this.hierarchy.getChildren(groupNode.id);
			children.forEach((childNode) => {
				let targetPosition: THREE.Vector3 | null = null;

				if (childNode.isGroup) {
					const childProxy = this.pivotProxies.get(childNode.id);
					if (childProxy) targetPosition = childProxy.position;
				} else {
					const obj = objectResolver(childNode.id);
					if (obj) targetPosition = obj.position;
				}

				if (targetPosition) {
					const points = [proxy.position.clone(), targetPosition.clone()];
					const geom = new THREE.BufferGeometry().setFromPoints(points);
					const line = new THREE.Line(geom, lineMaterial.clone());
					line.renderOrder = 1000;
					this.couplingLinesGroup.add(line);
				}
			});
		});
	}

	/**
	 * Elimina el proxy visual de un grupo.
	 */
	removeGroupProxy(groupId: string) {
		const proxy = this.pivotProxies.get(groupId);
		if (proxy) {
			this.scene.remove(proxy);
			this.pivotProxies.delete(groupId);
		}
		if (this.isCouplingModeActive) {
			this.updateCouplingVisuals();
		}
	}

	/**
	 * Limpieza general de proxies y visuales.
	 */
	dispose() {
		this.pivotProxies.forEach((proxy) => {
			this.scene.remove(proxy);
		});
		this.pivotProxies.clear();

		this.scene.remove(this.couplingLinesGroup);
		while (this.couplingLinesGroup.children.length > 0) {
			const child = this.couplingLinesGroup.children.pop();
			if (child && (child as THREE.Line).geometry) {
				(child as THREE.Line).geometry.dispose();
				((child as THREE.Line).material as THREE.Material).dispose();
			}
		}
	}
}

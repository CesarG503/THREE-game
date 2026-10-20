/**
 * EditorGroupManager.ts
 * VIPER IO — Gestor de grupos lógicos, pivotes y conectores visuales 3D.
 *
 * Mantiene la separación entre la jerarquía lógica y la escena Three.js/Rapier:
 * - Los objetos Three.js se mantienen a nivel de escena con sus RigidBodies mundiales.
 * - Cada grupo lógico dispone de un objeto proxy de pivote central en la escena.
 * - Permite transformar el grupo (trasladar/rotar todos los miembros relativamente al pivote con sesión delta estable).
 * - Permite editar el pivote de forma independiente (sin mover los objetos).
 * - Conectores 3D interactivos: marcadores visuales y acoplamiento bidireccional por arrastre.
 */

import * as THREE from "three";
import { EditorHierarchyModel, type HierarchyNode } from "./EditorHierarchyModel";
import { EditorCommandHistory, ReparentCommand, MoveObjectCommand } from "../history/EditorCommandHistory";

export interface GroupPivotTransform {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
}

interface TransformSession {
	groupId: string;
	startPivotMatrix: THREE.Matrix4;
	initialTransforms: Map<string, {
		matrix: THREE.Matrix4;
		position: THREE.Vector3;
		quaternion: THREE.Quaternion;
		scale: THREE.Vector3;
	}>;
}

interface ConnectorDragState {
	mode: "move" | "reparent";
	sourceNodeId: string;
	sourceMarker: THREE.Object3D;
	initialMarkerPos: THREE.Vector3;
	targetObject: THREE.Object3D | null;
	initialObjectPos: THREE.Vector3;
	startIntersection: THREE.Vector3;
	dragPlane: THREE.Plane;
	currentPointerPos: THREE.Vector3;
	hoveredTargetGroupId: string | null;
	isValidTarget: boolean;
}

export class EditorGroupManager {
	private hierarchy: EditorHierarchyModel;
	private scene: THREE.Scene;
	private history: EditorCommandHistory | null = null;
	private pivotProxies: Map<string, THREE.Object3D> = new Map();
	private couplingLinesGroup: THREE.Group;
	private couplingConnectorsGroup: THREE.Group;

	private isCouplingModeActive: boolean = false;
	private isPivotEditModeActive: boolean = false;

	// Sesión de transformación continua para eliminar fallos de acumulación de delta
	private activeTransformSession: TransformSession | null = null;

	// Referencias para interacción 3D en viewport
	private camera: THREE.Camera | null = null;
	private domElement: HTMLElement | null = null;
	private lastResolver: ((uuid: string) => THREE.Object3D | null) | null = null;

	// Estado de arrastre de conectores 3D
	private connectorDrag: ConnectorDragState | null = null;
	interaction: any = null;
	public selectionManager?: any;
	private pointerId: number | null = null;
	private rubberBandLine: THREE.Line | null = null;
	private pendingConnectorPress: {
		pointerId: number;
		startX: number;
		startY: number;
		hitConnector: any;
		sourceNodeId: string;
		isGroupNode: boolean;
		isReparent: boolean;
		targetObject: THREE.Object3D | null;
		dragPlane: THREE.Plane;
		startIntersection: THREE.Vector3;
		hitPoint: THREE.Vector3;
	} | null = null;
	private matConnectorSelected = new THREE.MeshBasicMaterial({
		color: 0x3b82f6,
		depthTest: false,
		depthWrite: false,
	});

	// Callback emitido ante cambios en la jerarquía
	public onHierarchyChanged?: () => void;

	// Geometrías y materiales compartidos para rendimiento zero-allocation en modo acoples
	private sharedBoxGeom = new THREE.BoxGeometry(0.35, 0.25, 0.35);
	private sharedSphereGeom = new THREE.SphereGeometry(0.55, 16, 16);

	private matPivotTargetNormal = new THREE.MeshStandardMaterial({
		color: 0x38bdf8,
		emissive: 0x0284c7,
		emissiveIntensity: 0.6,
		transparent: true,
		opacity: 0.85,
		depthTest: false,
	});
	private matPivotTargetValid = new THREE.MeshStandardMaterial({
		color: 0x22c55e,
		emissive: 0x15803d,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 0.95,
		depthTest: false,
	});
	private matPivotTargetInvalid = new THREE.MeshStandardMaterial({
		color: 0xef4444,
		emissive: 0xb91c1c,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 0.95,
		depthTest: false,
	});
	private matConnectorConnected = new THREE.MeshStandardMaterial({
		color: 0x10b981,
		emissive: 0x059669,
		emissiveIntensity: 0.8,
		depthTest: false,
	});
	private matConnectorDisconnected = new THREE.MeshStandardMaterial({
		color: 0x94a3b8,
		emissive: 0x475569,
		emissiveIntensity: 0.8,
		depthTest: false,
	});
	private matConnectorMove = new THREE.MeshStandardMaterial({
		color: 0x06b6d4,
		emissive: 0x0891b2,
		emissiveIntensity: 1.0,
		depthTest: false,
	});
	private matConnectorReparent = new THREE.MeshStandardMaterial({
		color: 0xf59e0b,
		emissive: 0xd97706,
		emissiveIntensity: 1.0,
		depthTest: false,
	});
	private matLine = new THREE.LineBasicMaterial({
		color: 0x00ffcc,
		transparent: true,
		opacity: 0.8,
		depthTest: false,
	});
	private matRubberBand = new THREE.LineBasicMaterial({
		color: 0xf59e0b,
		linewidth: 2,
		depthTest: false,
	});

	private connectorMeshes = new Map<string, THREE.Mesh>();
	private pivotTargetMeshes = new Map<string, THREE.Mesh>();
	private couplingLines = new Map<string, THREE.Line>();
	private lastHoveredTargetMesh: THREE.Mesh | null = null;

	constructor(hierarchy: EditorHierarchyModel, scene: THREE.Scene, history?: EditorCommandHistory) {
		this.hierarchy = hierarchy;
		this.scene = scene;
		if (history) this.history = history;

		this.couplingLinesGroup = new THREE.Group();
		this.couplingLinesGroup.name = "EditorCouplingVisuals";
		this.couplingLinesGroup.renderOrder = 999;
		this.scene.add(this.couplingLinesGroup);

		this.couplingConnectorsGroup = new THREE.Group();
		this.couplingConnectorsGroup.name = "EditorCouplingConnectors";
		this.couplingConnectorsGroup.renderOrder = 1000;
		this.scene.add(this.couplingConnectorsGroup);

		this.handlePointerDown = this.handlePointerDown.bind(this);
		this.handlePointerMove = this.handlePointerMove.bind(this);
		this.handlePointerUp = this.handlePointerUp.bind(this);
	}

	getHierarchy(): EditorHierarchyModel {
		return this.hierarchy;
	}

	setCommandHistory(history: EditorCommandHistory) {
		this.history = history;
	}

	/**
	 * Conecta la cámara y el elemento canvas para interactuar directamente con conectores 3D.
	 */
	attachCameraAndDom(camera: THREE.Camera, domElement: HTMLElement) {
		if (this.domElement) {
			this.domElement.removeEventListener("pointerdown", this.handlePointerDown);
			window.removeEventListener("pointermove", this.handlePointerMove);
			window.removeEventListener("pointerup", this.handlePointerUp);
			window.removeEventListener("pointercancel", this.cancelConnectorDrag);
			window.removeEventListener("blur", this.cancelConnectorDrag);
			this.domElement.removeEventListener("lostpointercapture", this.cancelConnectorDrag);
		}

		this.camera = camera;
		this.domElement = domElement;

		this.domElement.addEventListener("pointerdown", this.handlePointerDown);
		window.addEventListener("pointermove", this.handlePointerMove);
		window.addEventListener("pointerup", this.handlePointerUp);
		window.addEventListener("pointercancel", this.cancelConnectorDrag);
		window.addEventListener("blur", this.cancelConnectorDrag);
		this.domElement.addEventListener("lostpointercapture", this.cancelConnectorDrag);
	}

	/**
	 * Activa o desactiva el modo de visualización y edición de acoples.
	 */
	setCouplingMode(active: boolean, objectResolver?: (uuid: string) => THREE.Object3D | null) {
		if (!active) this.cancelConnectorDrag();
		this.isCouplingModeActive = active;
		this.couplingLinesGroup.visible = active;
		this.couplingConnectorsGroup.visible = active;

		if (objectResolver) {
			this.lastResolver = objectResolver;
		}

		if (active) {
			this.updateCouplingVisuals(this.lastResolver || undefined);
		} else {
			this.clearCouplingVisuals();
		}
	}

	isConnectorDragging(): boolean { return this.connectorDrag !== null; }

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
	 * Limpia y destruye todos los proxies de la escena y vacía la caché.
	 * Corrige el defecto de referencias colgantes al recargar mapas.
	 */
	clearProxies() {
		this.pivotProxies.forEach((proxy) => {
			this.scene.remove(proxy);
		});
		this.pivotProxies.clear();
		this.activeTransformSession = null;
		this.clearCouplingVisuals();
	}

	/**
	 * Obtiene o crea el proxy de pivote para un grupo en la escena.
	 */
	removeGroupProxy(groupId: string) {
		const proxy = this.pivotProxies.get(groupId);
		if (proxy) {
			this.scene.remove(proxy);
			proxy.traverse((child: any) => {
				child.geometry?.dispose?.();
				if (child.material) {
					if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
					else child.material.dispose?.();
				}
			});
			this.pivotProxies.delete(groupId);
		}
	}

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
			proxy.userData.isEditableMapObject = true;
			proxy.userData.mapObjectType = "group_pivot";
			proxy.userData.customName = groupNode.customName || groupNode.name;
			proxy.userData.uuid = groupId;

			// Visual sutil para hacer el pivote interactivo y visible en la escena
			const pivotVisual = new THREE.Mesh(
				new THREE.SphereGeometry(0.35, 16, 16),
				new THREE.MeshStandardMaterial({
					color: 0xf59e0b,
					emissive: 0xd97706,
					emissiveIntensity: 0.5,
					roughness: 0.3,
					metalness: 0.8,
					depthTest: true,
				})
			);
			pivotVisual.name = `PivotVisualMesh_${groupId}`;
			pivotVisual.userData.isPivotHelper = true;
			pivotVisual.userData.groupId = groupId;
			proxy.add(pivotVisual);

			// Anillo orbital del pivote
			const ring = new THREE.Mesh(
				new THREE.TorusGeometry(0.55, 0.04, 12, 32),
				new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
			);
			ring.rotation.x = Math.PI / 2;
			proxy.add(ring);

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
	calculateGroupCenter(groupId: string, objectResolver?: (uuid: string) => THREE.Object3D | null): THREE.Vector3 {
		const resolver = objectResolver || this.lastResolver || ((id: string) => this.selectionManager?.resolveObject(id) || null);
		const descendants = this.hierarchy.getDescendants(groupId);
		const center = new THREE.Vector3();
		let count = 0;

		descendants.forEach((node) => {
			if (!node.isGroup) {
				const obj = resolver(node.id);
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
	recenterGroupPivot(groupId: string, objectResolver?: (uuid: string) => THREE.Object3D | null): THREE.Vector3 {
		const resolver = objectResolver || this.lastResolver || ((id: string) => this.selectionManager?.resolveObject(id) || null);
		const center = this.calculateGroupCenter(groupId, resolver);
		const proxy = this.getOrCreatePivotProxy(groupId);
		proxy.position.copy(center);
		proxy.quaternion.identity();

		this.hierarchy.updatePivot(groupId, { x: center.x, y: center.y, z: center.z });
		return center;
	}

	/**
	 * Inicia una sesión de transformación grupal guardando la captura inicial del pivote y de cada descendiente.
	 * Corrige de forma definitiva la cancelación de deltas o desincronización durante el arrastre con gizmo.
	 */
	beginGroupTransform(groupId: string, objectResolver: (uuid: string) => THREE.Object3D | null) {
		const proxy = this.getOrCreatePivotProxy(groupId);
		proxy.updateMatrixWorld(true);

		const startPivotMatrix = proxy.matrixWorld.clone();
		const initialTransforms = new Map<string, {
			matrix: THREE.Matrix4;
			position: THREE.Vector3;
			quaternion: THREE.Quaternion;
			scale: THREE.Vector3;
		}>();

		const descendants = this.hierarchy.getDescendants(groupId);
		descendants.forEach((node) => {
			if (!node.isGroup) {
				const obj = objectResolver(node.id);
				if (obj) {
					obj.updateMatrixWorld(true);
					initialTransforms.set(node.id, {
						matrix: obj.matrixWorld.clone(),
						position: obj.position.clone(),
						quaternion: obj.quaternion.clone(),
						scale: obj.scale.clone(),
					});
				}
			} else {
				const subProxy = this.getOrCreatePivotProxy(node.id);
				if (subProxy) {
					subProxy.updateMatrixWorld(true);
					initialTransforms.set(node.id, {
						matrix: subProxy.matrixWorld.clone(),
						position: subProxy.position.clone(),
						quaternion: subProxy.quaternion.clone(),
						scale: subProxy.scale.clone(),
					});
				}
			}
		});

		this.activeTransformSession = {
			groupId,
			startPivotMatrix,
			initialTransforms,
		};
	}

	/**
	 * Actualiza la transformación grupal con respecto a la matriz de inicio capturada en beginGroupTransform.
	 */
	updateGroupTransform(
		groupId: string,
		newPivotPosition: THREE.Vector3,
		newPivotQuaternion: THREE.Quaternion,
		objectResolver: (uuid: string) => THREE.Object3D | null,
		onObjectTransformed?: (obj: THREE.Object3D) => void
	) {
		const proxy = this.getOrCreatePivotProxy(groupId);

		// Actualizar proxy de pivote
		proxy.position.copy(newPivotPosition);
		proxy.quaternion.copy(newPivotQuaternion);
		proxy.updateMatrixWorld(true);

		this.hierarchy.updatePivot(
			groupId,
			{ x: newPivotPosition.x, y: newPivotPosition.y, z: newPivotPosition.z },
			{ x: newPivotQuaternion.x, y: newPivotQuaternion.y, z: newPivotQuaternion.z, w: newPivotQuaternion.w }
		);

		// En modo edición de pivote, NO se alteran las posiciones de los hijos
		if (this.isPivotEditModeActive) {
			if (this.isCouplingModeActive) {
				this.updateCouplingVisuals(objectResolver);
			}
			return;
		}

		if (!this.activeTransformSession || this.activeTransformSession.groupId !== groupId) {
			this.beginGroupTransform(groupId, objectResolver);
		}

		const session = this.activeTransformSession!;
		const nextPivotMatrix = new THREE.Matrix4().compose(
			newPivotPosition,
			newPivotQuaternion,
			new THREE.Vector3(1, 1, 1)
		);

		// Delta exacto acumulado desde el inicio del arrastre
		const deltaMatrix = new THREE.Matrix4()
			.copy(nextPivotMatrix)
			.multiply(session.startPivotMatrix.clone().invert());

		const descendants = this.hierarchy.getDescendants(groupId);
		descendants.forEach((node) => {
			const initial = session.initialTransforms.get(node.id);
			if (!initial) return;

			if (!node.isGroup) {
				const obj = objectResolver(node.id);
				if (obj) {
					const nextWorldMat = deltaMatrix.clone().multiply(initial.matrix);
					const nextPos = new THREE.Vector3();
					const nextQuat = new THREE.Quaternion();
					const nextScale = new THREE.Vector3();
					nextWorldMat.decompose(nextPos, nextQuat, nextScale);

					obj.position.copy(nextPos);
					obj.quaternion.copy(nextQuat);
					obj.updateMatrixWorld(true);

					// Sincronizar cuerpo físico Rapier si existe
					if (obj.userData?.rigidBody) {
						if (typeof obj.userData.rigidBody.setTranslation === "function") {
							obj.userData.rigidBody.setTranslation({ x: nextPos.x, y: nextPos.y, z: nextPos.z }, true);
						}
						if (typeof obj.userData.rigidBody.setRotation === "function") {
							obj.userData.rigidBody.setRotation({ x: nextQuat.x, y: nextQuat.y, z: nextQuat.z, w: nextQuat.w }, true);
						}
					}

					if (onObjectTransformed) {
						onObjectTransformed(obj);
					}
				}
			} else {
				const subProxy = this.getOrCreatePivotProxy(node.id);
				if (subProxy) {
					const nextSubMat = deltaMatrix.clone().multiply(initial.matrix);
					const nextPos = new THREE.Vector3();
					const nextQuat = new THREE.Quaternion();
					const nextScale = new THREE.Vector3();
					nextSubMat.decompose(nextPos, nextQuat, nextScale);

					subProxy.position.copy(nextPos);
					subProxy.quaternion.copy(nextQuat);
					subProxy.updateMatrixWorld(true);

					this.hierarchy.updatePivot(node.id, {
						x: nextPos.x,
						y: nextPos.y,
						z: nextPos.z,
					}, {
						x: nextQuat.x,
						y: nextQuat.y,
						z: nextQuat.z,
						w: nextQuat.w,
					});
				}
			}
		});

		if (this.isCouplingModeActive) {
			this.updateCouplingVisuals(objectResolver);
		}
	}

	/**
	 * Finaliza la sesión de transformación grupal.
	 */
	endGroupTransform(groupId: string) {
		if (this.activeTransformSession && this.activeTransformSession.groupId === groupId) {
			this.activeTransformSession = null;
		}
	}

	/**
	 * Wrapper compatible para transformaciones únicas o invocaciones puntuales de prueba.
	 */
	applyGroupTransform(
		groupId: string,
		newPivotPosition: THREE.Vector3,
		newPivotQuaternion: THREE.Quaternion,
		objectResolver: (uuid: string) => THREE.Object3D | null,
		onObjectTransformed?: (obj: THREE.Object3D) => void
	) {
		this.beginGroupTransform(groupId, objectResolver);
		this.updateGroupTransform(groupId, newPivotPosition, newPivotQuaternion, objectResolver, onObjectTransformed);
		this.endGroupTransform(groupId);
	}

	/**
	 * Callback para inicio de arrastre de pivote.
	 */
	onGroupPivotDragStart(groupId: string, objectResolver?: (uuid: string) => THREE.Object3D | null) {
		if (objectResolver) {
			this.beginGroupTransform(groupId, objectResolver);
		}
	}

	// ── Conectores 3D Interactivos y Líneas de Acople ───────────────────────────

	private clearCouplingVisuals() {
		for (const line of this.couplingLines.values()) {
			this.couplingLinesGroup.remove(line);
			line.geometry.dispose();
		}
		this.couplingLines.clear();

		for (const mesh of this.pivotTargetMeshes.values()) {
			this.couplingConnectorsGroup.remove(mesh);
		}
		this.pivotTargetMeshes.clear();

		for (const mesh of this.connectorMeshes.values()) {
			this.couplingConnectorsGroup.remove(mesh);
		}
		this.connectorMeshes.clear();

		this.lastHoveredTargetMesh = null;
	}

	/**
	 * Actualiza de forma incremental las líneas y los marcadores interactivos en la escena 3D.
	 * Reutiliza geometrías, materiales y mallas sin destrucciones masivas por fotograma.
	 */
	updateCouplingVisuals(objectResolver?: (uuid: string) => THREE.Object3D | null) {
		if (!this.isCouplingModeActive) return;
		if (objectResolver) this.lastResolver = objectResolver;
		const resolver = this.lastResolver;
		if (!resolver) return;

		const allNodes = this.hierarchy.getAllNodes();
		const groups = allNodes.filter((n) => n.isGroup);

		const activeLineKeys = new Set<string>();
		const activePivotTargetKeys = new Set<string>();
		const activeConnectorKeys = new Set<string>();

		// 1. Líneas de conexión entre pivotes y miembros, y marcadores de pivote
		for (let g = 0; g < groups.length; g++) {
			const groupNode = groups[g];
			const proxy = this.pivotProxies.get(groupNode.id);
			if (!proxy) continue;

			// Marcador de pivote del grupo (destino de acople)
			activePivotTargetKeys.add(groupNode.id);
			let pivotTargetMesh = this.pivotTargetMeshes.get(groupNode.id);
			if (!pivotTargetMesh) {
				pivotTargetMesh = new THREE.Mesh(this.sharedSphereGeom, this.matPivotTargetNormal);
				pivotTargetMesh.userData.isCouplingPivotTarget = true;
				pivotTargetMesh.userData.groupId = groupNode.id;
				this.couplingConnectorsGroup.add(pivotTargetMesh);
				this.pivotTargetMeshes.set(groupNode.id, pivotTargetMesh);
			}
			pivotTargetMesh.position.copy(proxy.position);

			const children = this.hierarchy.getChildren(groupNode.id);
			for (let c = 0; c < children.length; c++) {
				const childNode = children[c];
				let targetPosition: THREE.Vector3 | null = null;

				if (childNode.isGroup) {
					const childProxy = this.pivotProxies.get(childNode.id);
					if (childProxy) targetPosition = childProxy.position;
				} else {
					const obj = resolver(childNode.id);
					if (obj) targetPosition = obj.position;
				}

				if (targetPosition) {
					const lineKey = `${groupNode.id}->${childNode.id}`;
					activeLineKeys.add(lineKey);
					let line = this.couplingLines.get(lineKey);
					if (!line) {
						const positions = new Float32Array([
							proxy.position.x, proxy.position.y, proxy.position.z,
							targetPosition.x, targetPosition.y, targetPosition.z,
						]);
						const geom = new THREE.BufferGeometry();
						geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
						line = new THREE.Line(geom, this.matLine);
						line.renderOrder = 1000;
						this.couplingLinesGroup.add(line);
						this.couplingLines.set(lineKey, line);
					} else {
						const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
						posAttr.setXYZ(0, proxy.position.x, proxy.position.y, proxy.position.z);
						posAttr.setXYZ(1, targetPosition.x, targetPosition.y, targetPosition.z);
						posAttr.needsUpdate = true;
					}
				}
			}
		}

		// 2. Marcadores 3D interactivos en cada objeto y subgrupo (Origen de acople)
		for (let n = 0; n < allNodes.length; n++) {
			const node = allNodes[n];
			let worldPos: THREE.Vector3 | null = null;
			let boxHeight = 1.0;

			if (node.isGroup) {
				const proxy = this.pivotProxies.get(node.id);
				if (proxy) worldPos = proxy.position;
			} else {
				const obj = resolver(node.id);
				if (obj) {
					worldPos = obj.position;
					if (obj.userData?.originalScale?.y) {
						boxHeight = obj.userData.originalScale.y;
					}
				}
			}

			if (worldPos) {
				activeConnectorKeys.add(node.id);
				const isConnected = !!node.parentId;
				const offsetY = Math.max(0.6, boxHeight / 2 + 0.35);

				let connectorMesh = this.connectorMeshes.get(node.id);
				const isSelected = this.selectionManager ? this.selectionManager.isSelected(node.id) : false;
				const targetMat = isSelected ? this.matConnectorSelected : (isConnected ? this.matConnectorConnected : this.matConnectorDisconnected);

				if (!connectorMesh) {
					connectorMesh = new THREE.Mesh(this.sharedBoxGeom, targetMat);
					connectorMesh.userData.isCouplingConnectorSource = true;
					connectorMesh.userData.nodeId = node.id;
					this.couplingConnectorsGroup.add(connectorMesh);
					this.connectorMeshes.set(node.id, connectorMesh);
				} else if (
					!this.connectorDrag ||
					this.connectorDrag.sourceNodeId !== node.id
				) {
					if (connectorMesh.material !== targetMat) {
						connectorMesh.material = targetMat;
					}
				}

				connectorMesh.position.set(worldPos.x, worldPos.y + offsetY, worldPos.z);
				connectorMesh.userData.isConnected = isConnected;
				connectorMesh.userData.parentId = node.parentId;
				connectorMesh.userData.isGroup = node.isGroup;
				connectorMesh.userData.helpText = isConnected
					? "Recuadro de Acople (Arrastra para mover en 3D | Shift+Arrastra para acoplar | Clic derecho para desacoplar)"
					: "Recuadro de Acople (Arrastra para mover en 3D | Shift+Arrastra para vincular a grupo)";
			}
		}

		// 3. Limpiar elementos eliminados
		for (const [key, line] of this.couplingLines.entries()) {
			if (!activeLineKeys.has(key)) {
				this.couplingLinesGroup.remove(line);
				line.geometry.dispose();
				this.couplingLines.delete(key);
			}
		}

		for (const [key, mesh] of this.pivotTargetMeshes.entries()) {
			if (!activePivotTargetKeys.has(key)) {
				this.couplingConnectorsGroup.remove(mesh);
				this.pivotTargetMeshes.delete(key);
			}
		}

		for (const [key, mesh] of this.connectorMeshes.entries()) {
			if (!activeConnectorKeys.has(key)) {
				this.couplingConnectorsGroup.remove(mesh);
				this.connectorMeshes.delete(key);
			}
		}
	}

	// ── Manejadores de eventos de puntero para arrastre 3D de conectores ─────────

	public isPointerOverConnector(event: MouseEvent | PointerEvent): boolean {
		if (!this.isCouplingModeActive || !this.camera || !this.domElement) return false;
		if (this.connectorDrag) return true;
		const rect = this.domElement.getBoundingClientRect();
		const mouse = new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, this.camera);
		const hits = raycaster.intersectObjects(this.couplingConnectorsGroup.children, true);
		return hits.some((h) => h.object.userData?.isCouplingConnectorSource || h.object.userData?.isCouplingPivotTarget);
	}

	private getRaycaster(event: PointerEvent): THREE.Raycaster | null {
		if (!this.camera || !this.domElement) return null;
		const rect = this.domElement.getBoundingClientRect();
		const mouse = new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, this.camera);
		return raycaster;
	}

	private handlePointerDown(event: PointerEvent) {
		if (!this.isCouplingModeActive || !this.camera || this.interaction?.blocksScene) return;

		const raycaster = this.getRaycaster(event);
		if (!raycaster) return;

		const intersects = raycaster.intersectObjects(this.couplingConnectorsGroup.children, true);
		const hitConnector = intersects.find((h) => h.object.userData?.isCouplingConnectorSource);

		if (hitConnector) {
			const sourceNodeId = hitConnector.object.userData.nodeId;
			const isConnected = hitConnector.object.userData.isConnected;
			const isGroupNode = !!hitConnector.object.userData.isGroup;

			// Clic derecho sobre conector de objeto acoplado: Desacople directo a la raíz con Undo/Redo
			if (event.button === 2 && isConnected) {
				event.preventDefault();
				event.stopPropagation();
				const oldNode = this.hierarchy.getNode(sourceNodeId);
				const oldParentId = oldNode?.parentId ?? null;
				const oldOrder = oldNode?.order ?? 0;
				if (this.history) {
					this.history.execute(
						new ReparentCommand(this.hierarchy, sourceNodeId, oldParentId, oldOrder, null, undefined, () => {
							this.updateCouplingVisuals(this.lastResolver || undefined);
							if (this.onHierarchyChanged) this.onHierarchyChanged();
						})
					);
				} else {
					this.hierarchy.reparent(sourceNodeId, null);
					this.updateCouplingVisuals(this.lastResolver || undefined);
					if (this.onHierarchyChanged) this.onHierarchyChanged();
				}
				return;
			}

			// Clic izquierdo:
			if (event.button === 0) {
				this.pointerId = event.pointerId;
				this.domElement?.setPointerCapture?.(event.pointerId);
				event.preventDefault();
				event.stopPropagation();

				const isReparent = event.shiftKey;
				const targetObject = !isGroupNode && this.lastResolver ? this.lastResolver(sourceNodeId) : null;

				const planeNormal = this.camera.getWorldDirection(new THREE.Vector3()).negate();
				const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
					planeNormal,
					hitConnector.point || hitConnector.object.position
				);

				const intersectPoint = new THREE.Vector3();
				raycaster.ray.intersectPlane(dragPlane, intersectPoint);

				this.pendingConnectorPress = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					hitConnector,
					sourceNodeId,
					isGroupNode,
					isReparent,
					targetObject,
					dragPlane,
					startIntersection: intersectPoint.clone(),
					hitPoint: (hitConnector.point ? hitConnector.point.clone() : hitConnector.object.position.clone()),
				};
			}
		}
	}

	private handlePointerMove(event: PointerEvent) {
		if (!this.camera || (this.pointerId != null && event.pointerId !== this.pointerId)) return;

		// Diferenciar tap corto vs arrastre si hay un clic pendiente en el conector
		if (this.pendingConnectorPress && !this.connectorDrag) {
			const dist = Math.hypot(
				event.clientX - this.pendingConnectorPress.startX,
				event.clientY - this.pendingConnectorPress.startY
			);
			if (dist > (this.interaction?.rightClickDragThreshold ?? 6)) {
				if (this.interaction && !this.interaction.begin("connector-drag", this.cancelConnectorDrag)) {
					this.pendingConnectorPress = null;
					return;
				}
				const p = this.pendingConnectorPress;
				this.connectorDrag = {
					mode: p.isReparent ? "reparent" : "move",
					sourceNodeId: p.sourceNodeId,
					sourceMarker: p.hitConnector.object,
					initialMarkerPos: p.hitConnector.object.position.clone(),
					targetObject: p.targetObject,
					initialObjectPos: p.targetObject ? p.targetObject.position.clone() : p.hitPoint.clone(),
					startIntersection: p.startIntersection.clone(),
					dragPlane: p.dragPlane,
					currentPointerPos: p.startIntersection.clone(),
					hoveredTargetGroupId: null,
					isValidTarget: false,
				};

				if (p.isReparent) {
					(p.hitConnector.object as THREE.Mesh).material = this.matConnectorReparent;
					const positions = new Float32Array([
						p.hitConnector.object.position.x, p.hitConnector.object.position.y, p.hitConnector.object.position.z,
						p.startIntersection.x, p.startIntersection.y, p.startIntersection.z,
					]);
					const geom = new THREE.BufferGeometry();
					geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
					this.rubberBandLine = new THREE.Line(geom, this.matRubberBand.clone());
					this.rubberBandLine.renderOrder = 2000;
					this.scene.add(this.rubberBandLine);
				} else {
					(p.hitConnector.object as THREE.Mesh).material = this.matConnectorMove;
				}
			} else {
				return;
			}
		}

		if (!this.connectorDrag) return;

		const raycaster = this.getRaycaster(event);
		if (!raycaster) return;

		const intersectPoint = new THREE.Vector3();
		raycaster.ray.intersectPlane(this.connectorDrag.dragPlane, intersectPoint);
		this.connectorDrag.currentPointerPos.copy(intersectPoint);

		if (this.connectorDrag.mode === "move") {
			const delta = intersectPoint.clone().sub(this.connectorDrag.startIntersection);

			if (this.connectorDrag.targetObject) {
				const nextPos = this.connectorDrag.initialObjectPos.clone().add(delta);
				this.connectorDrag.targetObject.position.copy(nextPos);
				this.connectorDrag.targetObject.updateMatrixWorld(true);

				if (this.connectorDrag.targetObject.userData?.rigidBody) {
					if (typeof this.connectorDrag.targetObject.userData.rigidBody.setTranslation === "function") {
						this.connectorDrag.targetObject.userData.rigidBody.setTranslation({
							x: nextPos.x,
							y: nextPos.y,
							z: nextPos.z,
						}, true);
					}
				}

				this.connectorDrag.sourceMarker.position.copy(
					this.connectorDrag.initialMarkerPos.clone().add(delta)
				);

				this.updateCouplingVisuals(this.lastResolver || undefined);
			}
			return;
		}

		// Modo Reparenting: actualizar rubberband y detección de objetivos válidos
		if (this.rubberBandLine) {
			const posAttr = this.rubberBandLine.geometry.attributes.position as THREE.BufferAttribute;
			posAttr.setXYZ(0, this.connectorDrag.sourceMarker.position.x, this.connectorDrag.sourceMarker.position.y, this.connectorDrag.sourceMarker.position.z);
			posAttr.setXYZ(1, intersectPoint.x, intersectPoint.y, intersectPoint.z);
			posAttr.needsUpdate = true;
		}

		const intersects = raycaster.intersectObjects(this.couplingConnectorsGroup.children, true);
		const hitTarget = intersects.find((h) => h.object.userData?.isCouplingPivotTarget);

		if (hitTarget) {
			const targetMesh = hitTarget.object as THREE.Mesh;
			const targetGroupId = targetMesh.userData.groupId;
			const validation = this.hierarchy.canReparent(this.connectorDrag.sourceNodeId, targetGroupId);

			if (this.lastHoveredTargetMesh && this.lastHoveredTargetMesh !== targetMesh) {
				this.lastHoveredTargetMesh.material = this.matPivotTargetNormal;
			}
			this.lastHoveredTargetMesh = targetMesh;

			if (validation.allowed) {
				targetMesh.material = this.matPivotTargetValid;
				if (this.rubberBandLine) {
					(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0x22c55e);
				}
				this.connectorDrag.hoveredTargetGroupId = targetGroupId;
				this.connectorDrag.isValidTarget = true;
			} else {
				targetMesh.material = this.matPivotTargetInvalid;
				if (this.rubberBandLine) {
					(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0xef4444);
				}
				this.connectorDrag.hoveredTargetGroupId = null;
				this.connectorDrag.isValidTarget = false;
			}
		} else {
			if (this.lastHoveredTargetMesh) {
				this.lastHoveredTargetMesh.material = this.matPivotTargetNormal;
				this.lastHoveredTargetMesh = null;
			}
			if (this.rubberBandLine) {
				(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0xf59e0b);
			}
			this.connectorDrag.hoveredTargetGroupId = null;
			this.connectorDrag.isValidTarget = false;
		}
	}

	private handlePointerUp(event: PointerEvent) {
		if (this.pointerId != null && event.pointerId !== this.pointerId) return;

		// Tap corto (<= 6px): Seleccionar el nodo correspondiente sin moverlo ni alterar acoples
		if (this.pendingConnectorPress && !this.connectorDrag) {
			const p = this.pendingConnectorPress;
			this.pendingConnectorPress = null;
			this.releaseConnectorPointer();

			if (this.selectionManager) {
				if (event.shiftKey) {
					this.selectionManager.toggle(p.sourceNodeId, "coupling-connector");
				} else {
					this.selectionManager.selectSingle(p.sourceNodeId, "coupling-connector");
				}
			}
			this.updateCouplingVisuals(this.lastResolver || undefined);
			return;
		}

		if (!this.connectorDrag) return;

		const drag = this.connectorDrag;

		if (this.lastHoveredTargetMesh) {
			this.lastHoveredTargetMesh.material = this.matPivotTargetNormal;
			this.lastHoveredTargetMesh = null;
		}

		if (this.rubberBandLine) {
			this.scene.remove(this.rubberBandLine);
			this.rubberBandLine.geometry.dispose();
			(this.rubberBandLine.material as THREE.Material).dispose();
			this.rubberBandLine = null;
		}

		this.connectorDrag = null;
		this.releaseConnectorPointer();

		if (drag.mode === "move") {
			if (drag.targetObject) {
				const finalPos = drag.targetObject.position.clone();
				const initPos = drag.initialObjectPos.clone();
				if (finalPos.distanceTo(initPos) > 0.001) {
					if (this.history) {
						this.history.execute(
							new MoveObjectCommand(
								drag.targetObject,
								{ x: initPos.x, y: initPos.y, z: initPos.z },
								{ x: finalPos.x, y: finalPos.y, z: finalPos.z },
								() => {
									this.updateCouplingVisuals(this.lastResolver || undefined);
									if (this.onHierarchyChanged) this.onHierarchyChanged();
								}
							)
						);
					}
				}
			}
			this.updateCouplingVisuals(this.lastResolver || undefined);
			return;
		}

		// Modo Reparenting
		const { sourceNodeId, hoveredTargetGroupId, isValidTarget } = drag;
		if (isValidTarget && hoveredTargetGroupId) {
			const oldNode = this.hierarchy.getNode(sourceNodeId);
			const oldParentId = oldNode?.parentId ?? null;
			const oldOrder = oldNode?.order ?? 0;
			if (this.history) {
				this.history.execute(
					new ReparentCommand(this.hierarchy, sourceNodeId, oldParentId, oldOrder, hoveredTargetGroupId, undefined, () => {
						if (hoveredTargetGroupId && this.lastResolver) {
							this.recenterGroupPivot(hoveredTargetGroupId, this.lastResolver);
						}
						this.updateCouplingVisuals(this.lastResolver || undefined);
						if (this.onHierarchyChanged) this.onHierarchyChanged();
					})
				);
			} else {
				this.hierarchy.reparent(sourceNodeId, hoveredTargetGroupId);
				if (this.lastResolver) {
					this.recenterGroupPivot(hoveredTargetGroupId, this.lastResolver);
				}
				this.updateCouplingVisuals(this.lastResolver || undefined);
				if (this.onHierarchyChanged) this.onHierarchyChanged();
			}
			return;
		}

		if (event.altKey) {
			const oldNode = this.hierarchy.getNode(sourceNodeId);
			const oldParentId = oldNode?.parentId ?? null;
			const oldOrder = oldNode?.order ?? 0;
			if (this.history) {
				this.history.execute(
					new ReparentCommand(this.hierarchy, sourceNodeId, oldParentId, oldOrder, null, undefined, () => {
						this.updateCouplingVisuals(this.lastResolver || undefined);
						if (this.onHierarchyChanged) this.onHierarchyChanged();
					})
				);
			} else {
				this.hierarchy.reparent(sourceNodeId, null);
				this.updateCouplingVisuals(this.lastResolver || undefined);
				if (this.onHierarchyChanged) this.onHierarchyChanged();
			}
			return;
		}

		this.updateCouplingVisuals(this.lastResolver || undefined);
	}

	private releaseConnectorPointer() {
		const id = this.pointerId;
		this.pointerId = null;
		if (id != null && this.domElement?.hasPointerCapture?.(id)) this.domElement.releasePointerCapture(id);
		this.interaction?.end("connector-drag");
	}

	cancelConnectorDrag = () => {
		this.pendingConnectorPress = null;
		if (!this.connectorDrag) return;
		const drag = this.connectorDrag;
		this.connectorDrag = null;

		if (this.lastHoveredTargetMesh) {
			this.lastHoveredTargetMesh.material = this.matPivotTargetNormal;
			this.lastHoveredTargetMesh = null;
		}

		if (drag.mode === "move" && drag.targetObject) {
			drag.targetObject.position.copy(drag.initialObjectPos);
			drag.targetObject.updateMatrixWorld(true);
			if (drag.targetObject.userData?.rigidBody && typeof drag.targetObject.userData.rigidBody.setTranslation === "function") {
				drag.targetObject.userData.rigidBody.setTranslation({
					x: drag.initialObjectPos.x,
					y: drag.initialObjectPos.y,
					z: drag.initialObjectPos.z,
				}, true);
			}
		}

		if (this.rubberBandLine) {
			this.rubberBandLine.removeFromParent();
			this.rubberBandLine.geometry.dispose();
			(this.rubberBandLine.material as THREE.Material).dispose();
			this.rubberBandLine = null;
		}
		this.releaseConnectorPointer();
		this.updateCouplingVisuals(this.lastResolver || undefined);
	};

	/**
	 * Limpieza general de proxies, eventos y visuales.
	 */
	dispose() {
		this.cancelConnectorDrag();
		this.clearCouplingVisuals();
		this.sharedBoxGeom.dispose();
		this.sharedSphereGeom.dispose();
		this.matPivotTargetNormal.dispose();
		this.matPivotTargetValid.dispose();
		this.matPivotTargetInvalid.dispose();
		this.matConnectorConnected.dispose();
		this.matConnectorSelected.dispose();
		this.matConnectorDisconnected.dispose();
		this.matConnectorMove.dispose();
		this.matConnectorReparent.dispose();
		this.matLine.dispose();
		this.matRubberBand.dispose();

		if (this.domElement) {
			this.domElement.removeEventListener("pointerdown", this.handlePointerDown);
			window.removeEventListener("pointermove", this.handlePointerMove);
			window.removeEventListener("pointerup", this.handlePointerUp);
			window.removeEventListener("pointercancel", this.cancelConnectorDrag);
			window.removeEventListener("blur", this.cancelConnectorDrag);
			this.domElement.removeEventListener("lostpointercapture", this.cancelConnectorDrag);
		}

		this.clearProxies();
		this.scene.remove(this.couplingLinesGroup);
		this.scene.remove(this.couplingConnectorsGroup);
	}
}

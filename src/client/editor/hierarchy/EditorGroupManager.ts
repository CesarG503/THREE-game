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
import { EditorCommandHistory, ReparentCommand } from "../history/EditorCommandHistory";

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
	sourceNodeId: string;
	sourceMarker: THREE.Object3D;
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
	private rubberBandLine: THREE.Line | null = null;

	// Callback emitido ante cambios en la jerarquía
	public onHierarchyChanged?: () => void;

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
		}

		this.camera = camera;
		this.domElement = domElement;

		this.domElement.addEventListener("pointerdown", this.handlePointerDown);
		window.addEventListener("pointermove", this.handlePointerMove);
		window.addEventListener("pointerup", this.handlePointerUp);
	}

	/**
	 * Activa o desactiva el modo de visualización y edición de acoples.
	 */
	setCouplingMode(active: boolean, objectResolver?: (uuid: string) => THREE.Object3D | null) {
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
				const subProxy = this.pivotProxies.get(node.id);
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
							obj.userData.rigidBody.setTranslation({ x: nextPos.x, y: nextPos.y, z: nextPos.z });
						}
						if (typeof obj.userData.rigidBody.setRotation === "function") {
							obj.userData.rigidBody.setRotation({ x: nextQuat.x, y: nextQuat.y, z: nextQuat.z, w: nextQuat.w });
						}
					}

					if (onObjectTransformed) {
						onObjectTransformed(obj);
					}
				}
			} else {
				const subProxy = this.pivotProxies.get(node.id);
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
		while (this.couplingLinesGroup.children.length > 0) {
			const child = this.couplingLinesGroup.children.pop();
			if (child && (child as THREE.Line).geometry) {
				(child as THREE.Line).geometry.dispose();
				((child as THREE.Line).material as THREE.Material).dispose();
			}
		}

		while (this.couplingConnectorsGroup.children.length > 0) {
			const child = this.couplingConnectorsGroup.children.pop();
			if (child && (child as THREE.Mesh).geometry) {
				(child as THREE.Mesh).geometry.dispose();
				((child as THREE.Mesh).material as THREE.Material).dispose();
			}
		}
	}

	/**
	 * Actualiza las líneas y los marcadores interactivos en la escena 3D.
	 */
	updateCouplingVisuals(objectResolver?: (uuid: string) => THREE.Object3D | null) {
		if (!this.isCouplingModeActive) return;
		if (objectResolver) this.lastResolver = objectResolver;
		const resolver = this.lastResolver;
		if (!resolver) return;

		this.clearCouplingVisuals();

		const allNodes = this.hierarchy.getAllNodes();
		const groups = allNodes.filter((n) => n.isGroup);

		// 1. Líneas de conexión entre pivotes y miembros
		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffcc,
			transparent: true,
			opacity: 0.8,
			depthTest: false,
		});

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
					const obj = resolver(childNode.id);
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

			// 2. Marcador 3D interactivo en el pivote del grupo (Destino válido / inválido de acople)
			const pivotTargetMesh = new THREE.Mesh(
				new THREE.SphereGeometry(0.55, 16, 16),
				new THREE.MeshStandardMaterial({
					color: 0x38bdf8,
					emissive: 0x0284c7,
					emissiveIntensity: 0.6,
					transparent: true,
					opacity: 0.85,
					depthTest: false,
				})
			);
			pivotTargetMesh.position.copy(proxy.position);
			pivotTargetMesh.userData.isCouplingPivotTarget = true;
			pivotTargetMesh.userData.groupId = groupNode.id;
			this.couplingConnectorsGroup.add(pivotTargetMesh);
		});

		// 3. Marcadores 3D interactivos en cada objeto y subgrupo (Origen de acople)
		allNodes.forEach((node) => {
			let worldPos: THREE.Vector3 | null = null;
			let boxHeight = 1.0;

			if (node.isGroup) {
				const proxy = this.pivotProxies.get(node.id);
				if (proxy) worldPos = proxy.position.clone();
			} else {
				const obj = resolver(node.id);
				if (obj) {
					worldPos = obj.position.clone();
					if (obj.userData?.originalScale?.y) {
						boxHeight = obj.userData.originalScale.y;
					}
				}
			}

			if (worldPos) {
				const isConnected = !!node.parentId;
				// Conector colocado ligeramente encima del objeto para máxima visibilidad y facilidad de clic
				const connectorPos = worldPos.clone().add(new THREE.Vector3(0, Math.max(0.6, boxHeight / 2 + 0.35), 0));

				const connectorColor = isConnected ? 0x10b981 : 0x94a3b8;
				const emissiveColor = isConnected ? 0x059669 : 0x475569;

				const connectorMesh = new THREE.Mesh(
					new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16),
					new THREE.MeshStandardMaterial({
						color: connectorColor,
						emissive: emissiveColor,
						emissiveIntensity: 0.8,
						depthTest: false,
					})
				);
				connectorMesh.position.copy(connectorPos);
				connectorMesh.userData.isCouplingConnectorSource = true;
				connectorMesh.userData.nodeId = node.id;
				connectorMesh.userData.isConnected = isConnected;
				connectorMesh.userData.parentId = node.parentId;
				this.couplingConnectorsGroup.add(connectorMesh);
			}
		});
	}

	// ── Manejadores de eventos de puntero para arrastre 3D de conectores ─────────

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
		if (!this.isCouplingModeActive || !this.camera) return;

		const raycaster = this.getRaycaster(event);
		if (!raycaster) return;

		const intersects = raycaster.intersectObjects(this.couplingConnectorsGroup.children, true);
		const hitConnector = intersects.find((h) => h.object.userData?.isCouplingConnectorSource);

		if (hitConnector) {
			const sourceNodeId = hitConnector.object.userData.nodeId;
			const isConnected = hitConnector.object.userData.isConnected;

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

			// Clic izquierdo: Iniciar arrastre de conexión
			if (event.button === 0) {
				event.preventDefault();
				event.stopPropagation();

				this.connectorDrag = {
					sourceNodeId,
					sourceMarker: hitConnector.object,
					currentPointerPos: hitConnector.point.clone(),
					hoveredTargetGroupId: null,
					isValidTarget: false,
				};

				// Resaltar conector de origen en amarillo brillante
				(hitConnector.object as THREE.Mesh).material = new THREE.MeshStandardMaterial({
					color: 0xf59e0b,
					emissive: 0xd97706,
					emissiveIntensity: 1.0,
					depthTest: false,
				});

				// Crear línea de arrastre elástica (rubberband)
				const geom = new THREE.BufferGeometry().setFromPoints([
					hitConnector.object.position.clone(),
					hitConnector.point.clone(),
				]);
				const mat = new THREE.LineBasicMaterial({
					color: 0xf59e0b,
					linewidth: 2,
					depthTest: false,
				});
				this.rubberBandLine = new THREE.Line(geom, mat);
				this.rubberBandLine.renderOrder = 2000;
				this.scene.add(this.rubberBandLine);
			}
		}
	}

	private handlePointerMove(event: PointerEvent) {
		if (!this.connectorDrag || !this.camera) return;

		const raycaster = this.getRaycaster(event);
		if (!raycaster) return;

		// Plano de proyección perpendicular a la cámara en la posición del conector
		const planeNormal = this.camera.getWorldDirection(new THREE.Vector3()).negate();
		const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
			planeNormal,
			this.connectorDrag.sourceMarker.position
		);

		const intersectPoint = new THREE.Vector3();
		raycaster.ray.intersectPlane(dragPlane, intersectPoint);
		this.connectorDrag.currentPointerPos.copy(intersectPoint);

		// Actualizar línea rubberband
		if (this.rubberBandLine) {
			this.rubberBandLine.geometry.setFromPoints([
				this.connectorDrag.sourceMarker.position.clone(),
				intersectPoint.clone(),
			]);
		}

		// Raycast para detectar si estamos sobre un pivote de grupo destino
		const intersects = raycaster.intersectObjects(this.couplingConnectorsGroup.children, true);
		const hitTarget = intersects.find((h) => h.object.userData?.isCouplingPivotTarget);

		// Limpiar estados de los pivotes
		this.couplingConnectorsGroup.children.forEach((c) => {
			if (c.userData?.isCouplingPivotTarget) {
				const mesh = c as THREE.Mesh;
				(mesh.material as THREE.MeshStandardMaterial).color.setHex(0x38bdf8);
				(mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x0284c7);
			}
		});

		if (hitTarget) {
			const targetGroupId = hitTarget.object.userData.groupId;
			const validation = this.hierarchy.canReparent(this.connectorDrag.sourceNodeId, targetGroupId);

			const targetMesh = hitTarget.object as THREE.Mesh;
			const targetMat = targetMesh.material as THREE.MeshStandardMaterial;

			if (validation.allowed) {
				// Destino válido: Iluminar en verde
				targetMat.color.setHex(0x22c55e);
				targetMat.emissive.setHex(0x15803d);
				if (this.rubberBandLine) {
					(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0x22c55e);
				}
				this.connectorDrag.hoveredTargetGroupId = targetGroupId;
				this.connectorDrag.isValidTarget = true;
			} else {
				// Destino inválido (ciclo o restricción): Iluminar en rojo
				targetMat.color.setHex(0xef4444);
				targetMat.emissive.setHex(0xb91c1c);
				if (this.rubberBandLine) {
					(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0xef4444);
				}
				this.connectorDrag.hoveredTargetGroupId = null;
				this.connectorDrag.isValidTarget = false;
			}
		} else {
			if (this.rubberBandLine) {
				(this.rubberBandLine.material as THREE.LineBasicMaterial).color.setHex(0xf59e0b);
			}
			this.connectorDrag.hoveredTargetGroupId = null;
			this.connectorDrag.isValidTarget = false;
		}
	}

	private handlePointerUp(event: PointerEvent) {
		if (!this.connectorDrag) return;

		const { sourceNodeId, hoveredTargetGroupId, isValidTarget } = this.connectorDrag;

		// Eliminar línea elástica
		if (this.rubberBandLine) {
			this.scene.remove(this.rubberBandLine);
			this.rubberBandLine.geometry.dispose();
			(this.rubberBandLine.material as THREE.Material).dispose();
			this.rubberBandLine = null;
		}

		this.connectorDrag = null;

		// 1. Soltado sobre destino válido: Ejecutar acoplamiento con Undo/Redo
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

		// 2. Si se mantiene pulsada la tecla Alt al soltar fuera: Desacoplar a la raíz con Undo/Redo
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

		// 3. Soltado en vacío sin destino: Cancelar sin cambios
		this.updateCouplingVisuals(this.lastResolver || undefined);
	}

	/**
	 * Limpieza general de proxies, eventos y visuales.
	 */
	dispose() {
		if (this.domElement) {
			this.domElement.removeEventListener("pointerdown", this.handlePointerDown);
			window.removeEventListener("pointermove", this.handlePointerMove);
			window.removeEventListener("pointerup", this.handlePointerUp);
		}

		this.clearProxies();
		this.scene.remove(this.couplingLinesGroup);
		this.scene.remove(this.couplingConnectorsGroup);
	}
}

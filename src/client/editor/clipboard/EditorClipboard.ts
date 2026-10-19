/**
 * EditorClipboard.ts
 * VIPER IO — Portapapeles interno del editor jerárquico.
 *
 * Soporta copia, corte, pegado y duplicación de objetos individuales,
 * grupos y subárboles completos con:
 * - Generación de nuevos UUIDs.
 * - Reconstrucción de parentId.
 * - Remapeo profundo de referencias internas de lógica y eventos.
 * - Preservación de referencias externas válidas.
 * - Mantenimiento de distribución espacial respecto al pivote de origen.
 * - Manejo atómico para evitar duplicaciones parciales.
 */

import * as THREE from "three";
import { EditorHierarchyModel, type SerializedHierarchyNode } from "../hierarchy/EditorHierarchyModel";

export interface SerializedMapObjectData {
	type: string;
	color: number;
	originalScale: any;
	pos: { x: number; y: number; z: number };
	rot: { x: number; y: number; z: number };
	texturePath?: string | null;
	textureAssetId?: string | null;
	textureSettings?: any;
	logicProperties?: any;
	uuid: string;
	invisible?: boolean;
	opacity?: number;
	authorId?: string;
	customName?: string;
	parentId?: string | null;
	order?: number;
}

export interface ClipboardPayload {
	referencePivot: { x: number; y: number; z: number };
	rootNodeIds: string[];
	hierarchyNodes: SerializedHierarchyNode[];
	objectsData: SerializedMapObjectData[];
	timestamp: number;
}

export class EditorClipboard {
	private payload: ClipboardPayload | null = null;

	hasContent(): boolean {
		return this.payload !== null;
	}

	getPayload(): ClipboardPayload | null {
		return this.payload;
	}

	clear() {
		this.payload = null;
	}

	/**
	 * Copia los nodos y objetos seleccionados y todos sus descendientes.
	 */
	copy(
		selectedIds: string[],
		hierarchy: EditorHierarchyModel,
		objectDataFetcher: (uuid: string) => SerializedMapObjectData | null,
		referencePivot?: { x: number; y: number; z: number }
	): boolean {
		if (!selectedIds || selectedIds.length === 0) return false;

		const allSubtreeNodeIds = new Set<string>();

		// Recopilar todos los nodos seleccionados y sus descendientes
		selectedIds.forEach((id) => {
			if (hierarchy.hasNode(id)) {
				allSubtreeNodeIds.add(id);
				const descendants = hierarchy.getDescendants(id);
				descendants.forEach((d) => allSubtreeNodeIds.add(d.id));
			}
		});

		if (allSubtreeNodeIds.size === 0) return false;

		const hierarchyNodes: SerializedHierarchyNode[] = [];
		const objectsData: SerializedMapObjectData[] = [];

		let calculatedPivot = referencePivot;
		if (!calculatedPivot && selectedIds.length === 1) {
			const singleRoot = hierarchy.getNode(selectedIds[0]);
			if (singleRoot?.pivot?.pos) {
				calculatedPivot = { ...singleRoot.pivot.pos };
			}
		}

		if (!calculatedPivot) {
			const positions: { x: number; y: number; z: number }[] = [];
			allSubtreeNodeIds.forEach((id) => {
				const node = hierarchy.getNode(id);
				if (node?.isGroup && node.pivot) {
					if (selectedIds.includes(id)) {
						positions.push(node.pivot.pos);
					}
				} else {
					const objData = objectDataFetcher(id);
					if (objData && objData.pos && objData.type !== "group_pivot") {
						positions.push(objData.pos);
					}
				}
			});
			if (positions.length > 0) {
				const sum = positions.reduce(
					(acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
					{ x: 0, y: 0, z: 0 }
				);
				calculatedPivot = {
					x: sum.x / positions.length,
					y: sum.y / positions.length,
					z: sum.z / positions.length,
				};
			} else {
				calculatedPivot = { x: 0, y: 0, z: 0 };
			}
		}

		allSubtreeNodeIds.forEach((id) => {
			const node = hierarchy.getNode(id);
			if (node) {
				hierarchyNodes.push(node.toJSON());
				// Los grupos son nodos lógicos puros. Solo los objetos físicos reales se serializan a objectsData.
				if (!node.isGroup) {
					const objData = objectDataFetcher(id);
					if (objData && objData.type !== "group_pivot") {
						const serializedObj = JSON.parse(JSON.stringify(objData));
						if (!serializedObj.parentId && node.parentId) {
							serializedObj.parentId = node.parentId;
						}
						if (serializedObj.order === undefined && node.order !== undefined) {
							serializedObj.order = node.order;
						}
						objectsData.push(serializedObj);
					}
				}
			}
		});

		this.payload = {
			referencePivot: calculatedPivot,
			rootNodeIds: selectedIds.filter((id) => {
				// Son raíces de la selección aquellos cuyo parentId no está dentro de la selección
				const node = hierarchy.getNode(id);
				return !node || !node.parentId || !allSubtreeNodeIds.has(node.parentId);
			}),
			hierarchyNodes,
			objectsData,
			timestamp: Date.now(),
		};

		return true;
	}

	/**
	 * Prepara los datos duplicados/pegados remapeando UUIDs, parentId y referencias lógicas internas.
	 */
	preparePaste(
		targetPosition?: { x: number; y: number; z: number },
		targetParentId?: string | null
	): {
		uuidMap: Map<string, string>;
		newHierarchyNodes: SerializedHierarchyNode[];
		newObjectsData: SerializedMapObjectData[];
		rootNodeIds: string[];
	} | null {
		if (!this.payload) return null;

		const uuidMap = new Map<string, string>();

		// 1. Asignar nuevo UUID a cada nodo copiado
		this.payload.hierarchyNodes.forEach((node) => {
			const newId = node.isGroup
				? `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
				: THREE.MathUtils.generateUUID();
			uuidMap.set(node.id, newId);
		});

		// Asegurar que también los objetos sin nodo tengan su UUID en el mapa
		this.payload.objectsData.forEach((obj) => {
			if (!uuidMap.has(obj.uuid)) {
				uuidMap.set(obj.uuid, THREE.MathUtils.generateUUID());
			}
		});

		// 2. Calcular delta de posición
		const offset = targetPosition
			? {
					x: targetPosition.x - this.payload.referencePivot.x,
					y: targetPosition.y - this.payload.referencePivot.y,
					z: targetPosition.z - this.payload.referencePivot.z,
			  }
			: { x: 2, y: 0, z: 2 }; // Desplazamiento por defecto para que no se superponga exactamente

		// 3. Reconstruir jerarquía con nuevos IDs y parentIds
		const newHierarchyNodes: SerializedHierarchyNode[] = this.payload.hierarchyNodes.map((oldNode) => {
			const newId = uuidMap.get(oldNode.id)!;
			let newParentId: string | null = null;

			if (oldNode.parentId && uuidMap.has(oldNode.parentId)) {
				// El padre era parte del subárbol copiado
				newParentId = uuidMap.get(oldNode.parentId)!;
			} else {
				// El nodo era una raíz de la selección:
				// Si targetParentId está definido (incluso null), se asigna a ese padre.
				// Si targetParentId es undefined, conserva su parentId original (modo hermano/duplicación).
				newParentId = targetParentId !== undefined ? targetParentId : (oldNode.parentId ?? null);
			}

			const nodeCopy: SerializedHierarchyNode = {
				...oldNode,
				id: newId,
				parentId: newParentId,
			};

			if (nodeCopy.pivot) {
				nodeCopy.pivot = {
					...nodeCopy.pivot,
					pos: {
						x: nodeCopy.pivot.pos.x + offset.x,
						y: nodeCopy.pivot.pos.y + offset.y,
						z: nodeCopy.pivot.pos.z + offset.z,
					},
				};
			}

			return nodeCopy;
		});

		// 4. Reconstruir objetos con posición trasladada y remapeo de referencias de lógica
		const newObjectsData: SerializedMapObjectData[] = this.payload.objectsData.map((oldObj) => {
			const newId = uuidMap.get(oldObj.uuid)!;
			let newParentId: string | null = null;

			if (oldObj.parentId && uuidMap.has(oldObj.parentId)) {
				newParentId = uuidMap.get(oldObj.parentId)!;
			} else {
				newParentId = targetParentId !== undefined ? targetParentId : (oldObj.parentId ?? null);
			}

			const objCopy: SerializedMapObjectData = {
				...JSON.parse(JSON.stringify(oldObj)),
				uuid: newId,
				parentId: newParentId,
				pos: {
					x: oldObj.pos.x + offset.x,
					y: oldObj.pos.y + offset.y,
					z: oldObj.pos.z + offset.z,
				},
			};

			// Remapeo profundo de lógica
			if (objCopy.logicProperties) {
				objCopy.logicProperties = remapLogicReferences(objCopy.logicProperties, uuidMap);
			}

			return objCopy;
		});

		const rootNodeIds = this.payload.rootNodeIds.map((oldId) => uuidMap.get(oldId)!).filter(Boolean);

		return {
			uuidMap,
			newHierarchyNodes,
			newObjectsData,
			rootNodeIds,
		};
	}
}

/**
 * Función recursiva para remapear referencias a UUIDs internos dentro de `logicProperties`.
 * Conserva cualquier referencia externa válida que no esté en `uuidMap`.
 */
export function remapLogicReferences(properties: any, uuidMap: Map<string, string>): any {
	if (!properties || typeof properties !== "object") return properties;

	if (Array.isArray(properties)) {
		return properties.map((item) => {
			if (typeof item === "string" && uuidMap.has(item)) {
				return uuidMap.get(item)!;
			}
			if (typeof item === "object") {
				return remapLogicReferences(item, uuidMap);
			}
			return item;
		});
	}

	const remapped: Record<string, any> = {};
	for (const key of Object.keys(properties)) {
		const val = properties[key];

		if (typeof val === "string") {
			if (uuidMap.has(val)) {
				remapped[key] = uuidMap.get(val)!;
			} else {
				remapped[key] = val; // Referencia externa conservada
			}
		} else if (Array.isArray(val)) {
			remapped[key] = val.map((item) => {
				if (typeof item === "string" && uuidMap.has(item)) {
					return uuidMap.get(item)!;
				}
				if (typeof item === "object") {
					return remapLogicReferences(item, uuidMap);
				}
				return item;
			});
		} else if (val !== null && typeof val === "object") {
			remapped[key] = remapLogicReferences(val, uuidMap);
		} else {
			remapped[key] = val;
		}
	}

	return remapped;
}

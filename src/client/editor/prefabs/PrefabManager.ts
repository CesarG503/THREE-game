/**
 * PrefabManager.ts
 * VIPER IO — Gestor del ciclo de vida de prefabs e instancias.
 *
 * Distingue explícitamente entre:
 * - Grupos: Jerarquías lógicas organizativas en el mapa actual.
 * - Definiciones de Prefab: Plantillas reutilizables, versionadas e inmutables.
 * - Instancias de Prefab: Ocurrencias en el mapa vinculadas a su definición/versión con overrides locales.
 */

import * as THREE from "three";
import { EditorHierarchyModel } from "../hierarchy/EditorHierarchyModel";
import type { SerializedHierarchyNode } from "../hierarchy/EditorHierarchyModel";
import { EditorClipboard, remapLogicReferences } from "../clipboard/EditorClipboard";
import type { SerializedMapObjectData } from "../clipboard/EditorClipboard";
import type { PrefabDataPayload, PlatformPrefabDto, PrefabInstanceRecord } from "./PrefabTypes";
import { PrefabService } from "./PrefabService";
import { PrefabSerializer } from "./PrefabSerializer";

export class PrefabManager {
	private hierarchy: EditorHierarchyModel;
	private instances: Map<string, PrefabInstanceRecord> = new Map();

	constructor(hierarchy: EditorHierarchyModel) {
		this.hierarchy = hierarchy;
	}

	/**
	 * Crea un paquete de datos de prefab a partir de un grupo o selección actual en el editor.
	 */
	createPrefabPayloadFromSelection(
		rootId: string,
		name: string,
		objectDataFetcher: (uuid: string) => SerializedMapObjectData | null,
		options: { description?: string; category?: string } = {}
	): PrefabDataPayload | null {
		const clipboard = new EditorClipboard();
		const copied = clipboard.copy([rootId], this.hierarchy, objectDataFetcher);
		if (!copied) return null;

		const payload = clipboard.getPayload();
		if (!payload) return null;

		const prefabData: PrefabDataPayload = {
			format: "viper-prefab",
			schemaVersion: "1.0",
			name,
			description: options.description || null,
			category: options.category || "general",
			pivot: payload.referencePivot,
			hierarchy: payload.hierarchyNodes,
			objects: payload.objectsData,
			dependencies: PrefabSerializer.extractDependencies(payload.objectsData),
		};

		return prefabData;
	}

	/**
	 * Instancia un prefab en la escena y en la jerarquía del editor.
	 */
	instantiatePrefab(
		prefabData: PrefabDataPayload,
		prefabId: string,
		prefabVersion: number,
		targetPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
		targetParentId: string | null = null,
		objectSpawner: (data: SerializedMapObjectData) => void,
		groupProxyCreator?: (groupId: string, pos?: { x: number; y: number; z: number }) => void
	): { instanceId: string; rootNodeId: string; createdUuids: string[] } {
		const instanceId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		const uuidMap = new Map<string, string>();

		// 1. Generar nuevos UUIDs para todos los nodos del prefab
		prefabData.hierarchy.forEach((node) => {
			const newId = node.isGroup
				? `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
				: THREE.MathUtils.generateUUID();
			uuidMap.set(node.id, newId);
		});

		prefabData.objects.forEach((obj) => {
			if (!uuidMap.has(obj.uuid)) {
				uuidMap.set(obj.uuid, THREE.MathUtils.generateUUID());
			}
		});

		// 2. Calcular delta respecto al pivote original del prefab
		const offset = {
			x: targetPosition.x - prefabData.pivot.x,
			y: targetPosition.y - prefabData.pivot.y,
			z: targetPosition.z - prefabData.pivot.z,
		};

		let rootNodeId: string = "";

		// 3. Crear nodos en la jerarquía
		prefabData.hierarchy.forEach((oldNode) => {
			const newId = uuidMap.get(oldNode.id)!;
			const isRoot = !oldNode.parentId || !uuidMap.has(oldNode.parentId);
			const newParentId = isRoot ? targetParentId : uuidMap.get(oldNode.parentId)!;

			if (isRoot && !rootNodeId) {
				rootNodeId = newId;
			}

			const newNodeData: SerializedHierarchyNode = {
				id: newId,
				name: oldNode.name,
				type: oldNode.type,
				parentId: newParentId,
				order: oldNode.order,
				isGroup: oldNode.isGroup,
				customName: oldNode.customName,
				metadata: {
					...oldNode.metadata,
					prefabInstanceId: instanceId,
					prefabId,
					prefabVersion,
					prefabName: prefabData.name,
					isPrefabRoot: isRoot,
				},
			};

			if (oldNode.pivot) {
				newNodeData.pivot = {
					pos: {
						x: oldNode.pivot.pos.x + offset.x,
						y: oldNode.pivot.pos.y + offset.y,
						z: oldNode.pivot.pos.z + offset.z,
					},
					rot: { ...oldNode.pivot.rot },
				};
			}

			this.hierarchy.addNode(newNodeData);

			if (oldNode.isGroup && groupProxyCreator) {
				groupProxyCreator(newId, newNodeData.pivot?.pos);
			}
		});

		// 4. Instanciar objetos físicos en la escena
		const createdUuids: string[] = [];
		prefabData.objects.forEach((oldObj) => {
			if (oldObj.type === "group_pivot") return;

			const newId = uuidMap.get(oldObj.uuid)!;
			const isRoot = !oldObj.parentId || !uuidMap.has(oldObj.parentId);
			const newParentId = isRoot ? targetParentId : uuidMap.get(oldObj.parentId)!;

			const newObjData: SerializedMapObjectData = {
				...JSON.parse(JSON.stringify(oldObj)),
				uuid: newId,
				parentId: newParentId,
				pos: {
					x: oldObj.pos.x + offset.x,
					y: oldObj.pos.y + offset.y,
					z: oldObj.pos.z + offset.z,
				},
			};

			// Remapeo de lógica
			if (newObjData.logicProperties) {
				newObjData.logicProperties = remapLogicReferences(newObjData.logicProperties, uuidMap);
			}

			createdUuids.push(newId);
			objectSpawner(newObjData);
		});

		const instanceRecord: PrefabInstanceRecord = {
			instanceId,
			prefabId,
			prefabVersion,
			rootNodeId,
			overrides: {},
		};
		this.instances.set(instanceId, instanceRecord);

		return { instanceId, rootNodeId, createdUuids };
	}

	/**
	 * Reconstruye el registro de instancias a partir de los metadatos de los nodos al cargar mapas.
	 */
	restoreInstancesFromHierarchy() {
		const allNodes = this.hierarchy.getAllNodes();
		const instanceGroups = new Map<string, any[]>();
		for (const node of allNodes) {
			const instId = node.metadata?.prefabInstanceId;
			if (typeof instId === "string" && instId) {
				if (!instanceGroups.has(instId)) instanceGroups.set(instId, []);
				instanceGroups.get(instId)!.push(node);
			}
		}

		for (const [instId, nodes] of instanceGroups.entries()) {
			const firstNode = nodes[0];
			const prefabId = (firstNode.metadata?.prefabId as string) || "unknown";
			const prefabVersion = Number(firstNode.metadata?.prefabVersion) || 1;
			const instNodeIds = new Set(nodes.map((n) => n.id));
			const rootNode = nodes.find((n) => !n.parentId || !instNodeIds.has(n.parentId)) || firstNode;

			const record: PrefabInstanceRecord = {
				instanceId: instId,
				prefabId,
				prefabVersion,
				rootNodeId: rootNode.id,
				overrides: (firstNode.metadata?.overrides as any) || {},
			};
			this.instances.set(instId, record);
		}

		return this.instances.size;
	}

	removeInstance(instanceId: string) {
		this.instances.delete(instanceId);
	}

	/**
	 * Registra una modificación local en un objeto de una instancia de prefab.
	 */
	recordOverride(instanceId: string, objectUuid: string, property: string, value: any) {
		const inst = this.instances.get(instanceId);
		if (!inst) return;

		if (!inst.overrides[objectUuid]) {
			inst.overrides[objectUuid] = {};
		}
		inst.overrides[objectUuid][property] = value;
	}

	getInstance(instanceId: string): PrefabInstanceRecord | undefined {
		return this.instances.get(instanceId);
	}

	getAllInstances(): PrefabInstanceRecord[] {
		return Array.from(this.instances.values());
	}

	getActiveInstances(): PrefabInstanceRecord[] {
		return this.getAllInstances();
	}
}

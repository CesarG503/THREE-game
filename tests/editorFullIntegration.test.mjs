import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel, HierarchyNode } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorClipboard } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");
const { PrefabSerializer } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabSerializer.ts");
const { PrefabManager } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabManager.ts");

test("End-to-End: Flujo integral del editor jerárquico, transformaciones, desacople, portapapeles y prefabs", async () => {
	// 1. Simulación de escena y objetos de mapa
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);

	const mapObjects = new Map();

	function createMockObject(uuid, name, type, x, y, z, logic = {}) {
		const obj3d = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		obj3d.position.set(x, y, z);
		obj3d.quaternion.identity();
		obj3d.updateMatrixWorld(true);

		const mockRigidBody = {
			pos: { x, y, z },
			rot: { x: 0, y: 0, z: 0, w: 1 },
			setTranslation(p) {
				this.pos = { ...p };
			},
			setRotation(r) {
				this.rot = { ...r };
			}
		};

		const item = {
			uuid,
			name,
			type,
			obj3d,
			rigidBody: mockRigidBody,
			logicProperties: { ...logic },
			getSerializableData() {
				return {
					uuid: this.uuid,
					name: this.name,
					type: this.type,
					color: 0xffffff,
					originalScale: { x: 1, y: 1, z: 1 },
					pos: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z },
					rot: { x: obj3d.rotation.x, y: obj3d.rotation.y, z: obj3d.rotation.z },
					logicProperties: this.logicProperties
				};
			}
		};

		mapObjects.set(uuid, item);
		hierarchy.addNode({
			id: uuid,
			name,
			type,
			parentId: null,
			order: hierarchy.getChildren(null).length,
			isGroup: false
		});
		return item;
	}

	const door = createMockObject("door-1", "Puerta Principal", "door", 0, 0, 0);
	const button = createMockObject("button-1", "Boton Accionador", "button", 2, 0, 0, {
		targetDoorUuid: "door-1",
		externalLightId: "ext-light-999"
	});
	const wall = createMockObject("wall-1", "Muro Lateral", "wall", 0, 0, 6);

	// 2. Agrupar en estructura jerárquica (Subgrupo Entrada dentro de Grupo Casa)
	const subGroup = hierarchy.groupObjects(["door-1", "button-1"], "Subgrupo Entrada");
	const rootGroup = hierarchy.groupObjects([subGroup.id, "wall-1"], "Grupo Casa");

	assert.equal(hierarchy.getNode(subGroup.id)?.parentId, rootGroup.id);
	assert.equal(hierarchy.getNode("door-1")?.parentId, subGroup.id);
	assert.equal(hierarchy.getNode("button-1")?.parentId, subGroup.id);
	assert.equal(hierarchy.getNode("wall-1")?.parentId, rootGroup.id);

	// 3. Crear proxy de pivote central y verificar posición inicial centrada
	const resolver = (id) => mapObjects.get(id)?.obj3d || null;
	const rootCenter = groupManager.recenterGroupPivot(rootGroup.id, resolver);
	const rootProxy = groupManager.getOrCreatePivotProxy(rootGroup.id);
	assert.ok(rootProxy, "El proxy del grupo raíz debe existir");

	// El centro de (0,0,0), (2,0,0), (0,0,6) es (2/3, 0, 2)
	assert.ok(Math.abs(rootCenter.x - 2 / 3) < 0.01);
	assert.ok(Math.abs(rootCenter.z - 2) < 0.01);

	// 4. Mover y rotar el conjunto mediante el pivote
	// Desplazar pivote +10 en X
	const newPivotPos = rootProxy.position.clone().add(new THREE.Vector3(10, 0, 0));
	const newPivotQuat = rootProxy.quaternion.clone();

	groupManager.applyGroupTransform(rootGroup.id, newPivotPos, newPivotQuat, resolver, (obj) => {
		// Sincronizar rigid body físico
		for (const item of mapObjects.values()) {
			if (item.obj3d === obj) {
				item.rigidBody.setTranslation({ x: obj.position.x, y: obj.position.y, z: obj.position.z });
				item.rigidBody.setRotation({ x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w });
				break;
			}
		}
	});

	// Verificar que todos los miembros se trasladaron +10 en X manteniendo posiciones relativas
	assert.equal(Math.round(door.obj3d.position.x), 10);
	assert.equal(Math.round(button.obj3d.position.x), 12);
	assert.equal(Math.round(wall.obj3d.position.x), 10);
	assert.equal(door.rigidBody.pos.x, door.obj3d.position.x);

	// 5. Desacople con preservación de posición global
	const doorWorldPosBefore = door.obj3d.position.clone();
	hierarchy.reparent("door-1", null); // Desacoplar al nivel raíz
	assert.equal(hierarchy.getNode("door-1")?.parentId, null);
	assert.deepEqual(door.obj3d.position, doorWorldPosBefore, "La posición mundial no debe sufrir saltos al desacoplar");

	// 6. Modo de edición de pivote independiente
	groupManager.setPivotEditMode(true);
	assert.equal(groupManager.isPivotEditMode(), true);
	const prevWallPos = wall.obj3d.position.clone();
	const shiftedPivotPos = rootProxy.position.clone().add(new THREE.Vector3(0, 0, 20)); // Mover sólo el pivote

	// Al aplicar transformación en modo pivote independiente, los objetos NO se mueven
	groupManager.applyGroupTransform(rootGroup.id, shiftedPivotPos, rootProxy.quaternion.clone(), resolver);
	assert.deepEqual(wall.obj3d.position, prevWallPos, "Los objetos no deben moverse al reubicar el pivote en modo edición");
	groupManager.setPivotEditMode(false);

	// 7. Copiar, pegar y duplicar con remapeo de referencias
	// Reasociar door al subgrupo
	hierarchy.reparent("door-1", subGroup.id);

	const clipboard = new EditorClipboard();
	const copied = clipboard.copy([subGroup.id], hierarchy, (id) => mapObjects.get(id)?.getSerializableData());
	assert.ok(copied, "La selección del subgrupo debe haberse copiado");

	const pastePrep = clipboard.preparePaste({ x: 50, y: 0, z: 50 }, null);
	assert.ok(pastePrep, "preparePaste debe generar nuevos nodos");

	const { uuidMap, newHierarchyNodes, newObjectsData } = pastePrep;
	assert.ok(newObjectsData.length >= 2, "Debe haber al menos 2 objetos duplicados");

	const dupButtonData = newObjectsData.find((d) => d.type === "button");
	const dupDoorData = newObjectsData.find((d) => d.type === "door");

	assert.ok(dupButtonData && dupDoorData);
	assert.notEqual(dupButtonData.uuid, "button-1");
	assert.notEqual(dupDoorData.uuid, "door-1");

	// Verificar remapeo de referencia interna: targetDoorUuid debe apuntar al nuevo dupDoorData.uuid
	assert.equal(dupButtonData.logicProperties.targetDoorUuid, dupDoorData.uuid);
	// Verificar preservación de referencia externa: externalLightId debe mantenerse intacto
	assert.equal(dupButtonData.logicProperties.externalLightId, "ext-light-999");

	// 8. Prefabs: Creación, serialización segura, exportación/importación y gestión de instancias
	const prefabManager = new PrefabManager(hierarchy);
	const prefabPayload = prefabManager.createPrefabPayloadFromSelection(
		subGroup.id,
		"Prefab Entrada Bunker",
		(id) => mapObjects.get(id)?.getSerializableData(),
		{ category: "structures", description: "Entrada con puerta y accionador" }
	);

	assert.ok(prefabPayload, "createPrefabPayloadFromSelection debe retornar un payload");
	assert.equal(prefabPayload.name, "Prefab Entrada Bunker");
	assert.equal(prefabPayload.category, "structures");

	const exportJsonStr = PrefabSerializer.exportToPackageJson(prefabPayload, "user-test");

	// Validación estricta del JSON exportado
	const validationResult = PrefabSerializer.validateAndParse(exportJsonStr);
	assert.equal(validationResult.valid, true, "El JSON del paquete exportado debe ser válido");
	assert.equal(validationResult.data?.name, "Prefab Entrada Bunker");

	// Instanciación del Prefab en la escena
	const instantiatedUuids = [];
	const instance = prefabManager.instantiatePrefab(
		prefabPayload,
		"prefab-bunker-001",
		1,
		{ x: 100, y: 0, z: 100 },
		null,
		(data) => {
			createMockObject(data.uuid, data.name || "Instancia", data.type, data.pos.x, data.pos.y, data.pos.z, data.logicProperties);
			instantiatedUuids.push(data.uuid);
		}
	);

	assert.ok(instance, "La instancia debe crearse");
	assert.ok(instantiatedUuids.length >= 2);

	// Overrides locales en la instancia
	const sampleInstanceUuid = instantiatedUuids[0];
	prefabManager.recordOverride(instance.instanceId, sampleInstanceUuid, "customColor", 0xff0000);
	const instRecord = prefabManager.getInstance(instance.instanceId);
	assert.equal(instRecord?.prefabId, "prefab-bunker-001");
	assert.equal(instRecord?.prefabVersion, 1);
	assert.equal(instRecord?.overrides[sampleInstanceUuid]?.customColor, 0xff0000);

	// 9. Retrocompatibilidad con mapas legados sin jerarquía
	const legacyMapData = {
		objects: [
			{ uuid: "legacy-1", type: "cube", pos: { x: 1, y: 1, z: 1 } },
			{ uuid: "legacy-2", type: "sphere", pos: { x: 2, y: 2, z: 2 } }
		]
	};

	const freshHierarchy = new EditorHierarchyModel();
	// Carga de mapa legado: deserializar con lista de IDs existentes cuando no hay hierarchy array
	freshHierarchy.deserialize(null, legacyMapData.objects.map((o) => o.uuid));

	assert.equal(freshHierarchy.getNode("legacy-1")?.parentId, null);
	assert.equal(freshHierarchy.getNode("legacy-2")?.parentId, null);
	assert.equal(freshHierarchy.getChildren(null).length, 2);
});

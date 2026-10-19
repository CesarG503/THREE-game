import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { PrefabManager } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabManager.ts");
const { PrefabService } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabService.ts");

test("Escenario B: Guardado de prefab sin alterar el grupo original, biblioteca, inserción múltiple y persistencia", async () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const prefabManager = new PrefabManager(hierarchy);

	const physicalObjects = new Map();

	function createPhysicalObject(data) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		mesh.position.set(data.pos.x, data.pos.y, data.pos.z);
		mesh.rotation.set(data.rot.x, data.rot.y, data.rot.z);
		mesh.userData = {
			uuid: data.uuid,
			mapObjectType: data.type,
			color: data.color || 0xffffff,
			isEditableMapObject: true,
			logicProperties: data.logicProperties || {},
			rigidBody: {
				pos: { ...data.pos },
				rot: { ...data.rot },
				setTranslation(p) { this.pos = { ...p }; },
				setRotation(r) { this.rot = { ...r }; }
			}
		};
		scene.add(mesh);
		physicalObjects.set(data.uuid, mesh);
		return mesh;
	}

	const gameMock = {
		sceneManager: { scene },
		editableMapObjects: [],
		_loadSingleMapObject(objData) {
			if (!objData || !objData.type || objData.type === "group_pivot") return;
			const mesh = createPhysicalObject(objData);
			this.editableMapObjects.push(mesh);
			return mesh;
		}
	};

	// 1. Crear un grupo original "Torre Defensiva" con 3 paredes
	const originalGroup = hierarchy.createGroup("Torre Defensiva", null);
	groupManager.getOrCreatePivotProxy(originalGroup.id);

	const wall1Data = { uuid: "w-orig-1", type: "wall", color: 0x111111, pos: { x: 10, y: 0, z: 10 }, rot: { x: 0, y: 0, z: 0 } };
	const wall2Data = { uuid: "w-orig-2", type: "wall", color: 0x222222, pos: { x: 12, y: 0, z: 10 }, rot: { x: 0, y: 0, z: 0 } };
	const wall3Data = { uuid: "w-orig-3", type: "wall", color: 0x333333, pos: { x: 11, y: 2, z: 10 }, rot: { x: 0, y: 0, z: 0 } };

	[wall1Data, wall2Data, wall3Data].forEach(w => {
		hierarchy.addNode({ id: w.uuid, name: w.type, type: w.type, parentId: originalGroup.id, order: 0, isGroup: false });
		gameMock._loadSingleMapObject(w);
	});

	assert.equal(physicalObjects.size, 3);

	// 2. Guardar el grupo como prefab
	const prefabPayload = prefabManager.createPrefabPayloadFromSelection(
		originalGroup.id,
		"Torre Defensiva Prefab",
		(uuid) => {
			const m = physicalObjects.get(uuid);
			if (!m) return null;
			return {
				uuid: m.userData.uuid,
				type: m.userData.mapObjectType,
				color: m.userData.color,
				originalScale: { x: 1, y: 1, z: 1 },
				pos: { ...m.position },
				rot: { ...m.rotation },
				logicProperties: m.userData.logicProperties
			};
		},
		{ category: "defensas" }
	);

	assert.ok(prefabPayload, "Payload de prefab generado correctamente");

	// REGLA CRÍTICA: El grupo original NUNCA debe convertirse en una instancia
	const originalNodeAfterSave = hierarchy.getNode(originalGroup.id);
	assert.ok(originalNodeAfterSave, "El grupo original debe seguir existiendo");
	assert.equal(originalNodeAfterSave.isGroup, true, "El grupo original debe seguir siendo un grupo normal");
	assert.equal(originalNodeAfterSave.metadata?.prefabInstanceId, undefined, "El grupo original NO debe tener prefabInstanceId");
	assert.equal(originalNodeAfterSave.metadata?.isPrefabRoot, undefined, "El grupo original NO debe tener isPrefabRoot");

	// Guardar en PrefabService
	const savedPrefab = await PrefabService.createPrefab("Torre Defensiva Prefab", prefabPayload, { category: "defensas" });
	assert.ok(savedPrefab.id, "Debe tener un id asignado");
	assert.equal(savedPrefab.version, 1, "Debe iniciar en version 1");
	assert.equal(savedPrefab.category, "defensas");

	// 3. Consultar la biblioteca y probar filtros
	const libraryPrefabs = await PrefabService.listPrefabs();
	const found = libraryPrefabs.find(p => p.id === savedPrefab.id);
	assert.ok(["server", "local", "pending_sync", "auth_error"].includes(found.storageStatus), `Debe tener estado de almacenamiento asignado, obtenido: ${found.storageStatus}`);

	// 4. Insertar 2 instancias independientes desde la biblioteca
	const spawnPos1 = { x: 50, y: 0, z: 50 };
	const spawnPos2 = { x: 100, y: 0, z: 100 };

	const inst1 = prefabManager.instantiatePrefab(
		found.data,
		found.id,
		found.version,
		spawnPos1,
		null,
		(data) => gameMock._loadSingleMapObject(data),
		(groupId, pos) => {
			const proxy = groupManager.getOrCreatePivotProxy(groupId);
			if (pos) proxy.position.set(pos.x, pos.y, pos.z);
		}
	);

	const inst2 = prefabManager.instantiatePrefab(
		found.data,
		found.id,
		found.version,
		spawnPos2,
		null,
		(data) => gameMock._loadSingleMapObject(data),
		(groupId, pos) => {
			const proxy = groupManager.getOrCreatePivotProxy(groupId);
			if (pos) proxy.position.set(pos.x, pos.y, pos.z);
		}
	);

	// Total piezas físicas: 3 (original) + 3 (inst1) + 3 (inst2) = 9
	assert.equal(physicalObjects.size, 9, "Deben existir 9 piezas físicas en total en el mapa");
	assert.notEqual(inst1.instanceId, inst2.instanceId, "Los instanceIds deben ser completamente diferentes");
	assert.notEqual(inst1.rootNodeId, inst2.rootNodeId, "Los rootNodeIds deben ser completamente diferentes");

	// Verificar metadatos de las instancias en la jerarquía
	const inst1RootNode = hierarchy.getNode(inst1.rootNodeId);
	const inst2RootNode = hierarchy.getNode(inst2.rootNodeId);
	assert.equal(inst1RootNode.metadata.prefabInstanceId, inst1.instanceId);
	assert.equal(inst1RootNode.metadata.isPrefabRoot, true);
	assert.equal(inst2RootNode.metadata.prefabInstanceId, inst2.instanceId);
	assert.equal(inst2RootNode.metadata.isPrefabRoot, true);

	// 5. Independencia de overrides: modificar objeto en instancia 1 no afecta a instancia 2 ni a la definición
	const inst1Objects = hierarchy.getChildren(inst1.rootNodeId);
	const inst2Objects = hierarchy.getChildren(inst2.rootNodeId);
	assert.equal(inst1Objects.length, 3);
	assert.equal(inst2Objects.length, 3);

	const obj1Mesh = physicalObjects.get(inst1Objects[0].id);
	const obj2Mesh = physicalObjects.get(inst2Objects[0].id);
	obj1Mesh.userData.color = 0xff0000; // Modificar color en instancia 1

	assert.equal(obj1Mesh.userData.color, 0xff0000);
	assert.notEqual(obj2Mesh.userData.color, 0xff0000, "Instancia 2 no debe heredar la mutación de Instancia 1");
	assert.notEqual(found.data.objects[0].color, 0xff0000, "La definición del prefab no debe ser alterada");

	// 6. Simulación de guardado y carga de mapa: persistencia de instancias
	// saveMap: parentId se toma de EditorHierarchyModel
	const serializedHierarchy = hierarchy.serialize();
	const serializedObjects = Array.from(physicalObjects.values()).map(mesh => {
		const node = hierarchy.getNode(mesh.userData.uuid);
		return {
			uuid: mesh.userData.uuid,
			type: mesh.userData.mapObjectType,
			color: mesh.userData.color,
			pos: { ...mesh.position },
			rot: { ...mesh.rotation },
			parentId: node ? node.parentId : null
		};
	});

	// Nuevo entorno simulando loadMap
	const newHierarchy = new EditorHierarchyModel();
	newHierarchy.deserialize(serializedHierarchy);
	const newPrefabManager = new PrefabManager(newHierarchy);

	const restoredCount = newPrefabManager.restoreInstancesFromHierarchy();
	assert.equal(restoredCount, 2, "restoreInstancesFromHierarchy debe restaurar exactamente las 2 instancias de prefab");

	const activeInstances = newPrefabManager.getActiveInstances();
	assert.equal(activeInstances.length, 2);
	assert.ok(activeInstances.some(i => i.instanceId === inst1.instanceId));
	assert.ok(activeInstances.some(i => i.instanceId === inst2.instanceId));
});

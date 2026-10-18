import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorClipboard } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");
const { EditorCommandHistory, DuplicateCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");

test("Escenario A: Duplicación completa de estructura de 10 piezas físicas, subgrupos, lógica y Undo/Redo", async () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const history = new EditorCommandHistory();
	groupManager.setCommandHistory(history);

	// Simulación del gestor de objetos del editor (Game)
	const physicalObjects = new Map();

	function createPhysicalObject(data) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		mesh.position.set(data.pos.x, data.pos.y, data.pos.z);
		mesh.rotation.set(data.rot.x, data.rot.y, data.rot.z);
		mesh.userData = {
			uuid: data.uuid,
			mapObjectType: data.type,
			isEditableMapObject: true,
			logicProperties: data.logicProperties ? JSON.parse(JSON.stringify(data.logicProperties)) : {},
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
		},
		deleteObjectByUuid(uuid) {
			const mesh = physicalObjects.get(uuid);
			if (mesh) {
				scene.remove(mesh);
				physicalObjects.delete(uuid);
				this.editableMapObjects = this.editableMapObjects.filter(m => m.userData.uuid !== uuid);
			}
		}
	};

	// 1. Construir la estructura original:
	// - Grupo Raíz ("Fortaleza Principal", en null)
	//   - Subgrupo 1 ("Torre Norte") con 4 piezas: 2 paredes, 1 luz, 1 botón
	//   - Subgrupo 2 ("Torre Sur") con 3 piezas: 2 paredes, 1 escalera
	//   - 3 piezas directas en la raíz del grupo: 1 escalera, 2 rampas
	// Total: 10 piezas físicas reales y 3 nodos de grupo (1 raíz + 2 subgrupos).

	const rootGroup = hierarchy.createGroup("Fortaleza Principal", null);
	groupManager.getOrCreatePivotProxy(rootGroup.id);

	const subGroupNorth = hierarchy.createGroup("Torre Norte", rootGroup.id);
	groupManager.getOrCreatePivotProxy(subGroupNorth.id);

	const subGroupSouth = hierarchy.createGroup("Torre Sur", rootGroup.id);
	groupManager.getOrCreatePivotProxy(subGroupSouth.id);

	const initialItemsData = [
		// Subgrupo Norte
		{ uuid: "wall-n1", type: "wall", pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupNorth.id },
		{ uuid: "wall-n2", type: "wall", pos: { x: 2, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupNorth.id },
		{ uuid: "light-n1", type: "light", pos: { x: 1, y: 3, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupNorth.id },
		{
			uuid: "button-n1",
			type: "interaction_button",
			pos: { x: 0, y: 1, z: 1 },
			rot: { x: 0, y: 0, z: 0 },
			parentId: subGroupNorth.id,
			logicProperties: {
				targetUuid: "light-n1", // Referencia interna que debe ser remapeada
				externalTrigger: "generator-external-99" // Referencia externa que debe conservarse
			}
		},

		// Subgrupo Sur
		{ uuid: "wall-s1", type: "wall", pos: { x: 0, y: 0, z: 5 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupSouth.id },
		{ uuid: "wall-s2", type: "wall", pos: { x: 2, y: 0, z: 5 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupSouth.id },
		{ uuid: "stairs-s1", type: "stairs", pos: { x: 1, y: 0, z: 6 }, rot: { x: 0, y: 0, z: 0 }, parentId: subGroupSouth.id },

		// Miembros directos de Fortaleza Principal
		{ uuid: "stairs-main1", type: "stairs", pos: { x: 1, y: 0, z: 2 }, rot: { x: 0, y: 0, z: 0 }, parentId: rootGroup.id },
		{ uuid: "ramp-main1", type: "ramp", pos: { x: -2, y: 0, z: 2 }, rot: { x: 0, y: 0, z: 0 }, parentId: rootGroup.id },
		{ uuid: "ramp-main2", type: "ramp", pos: { x: 4, y: 0, z: 2 }, rot: { x: 0, y: 0, z: 0 }, parentId: rootGroup.id }
	];

	for (const item of initialItemsData) {
		hierarchy.addNode({
			id: item.uuid,
			name: item.type,
			type: item.type,
			parentId: item.parentId,
			order: 0,
			isGroup: false
		});
		gameMock._loadSingleMapObject(item);
	}

	assert.equal(physicalObjects.size, 10, "Deben existir exactamente 10 piezas físicas iniciales");
	assert.equal(hierarchy.getAllNodes().filter(n => n.isGroup).length, 3, "Deben existir 3 grupos lógicos");

	// 2. Ejecutar Duplicación mediante EditorClipboard + DuplicateCommand
	const clipboard = new EditorClipboard();
	const copied = clipboard.copy(
		[rootGroup.id],
		hierarchy,
		(uuid) => {
			const mesh = physicalObjects.get(uuid);
			if (!mesh) return null;
			return {
				uuid: mesh.userData.uuid,
				type: mesh.userData.mapObjectType,
				color: 0xffffff,
				originalScale: { x: 1, y: 1, z: 1 },
				pos: { ...mesh.position },
				rot: { ...mesh.rotation },
				logicProperties: mesh.userData.logicProperties
			};
		}
	);
	assert.ok(copied, "La copia de la estructura debe ser exitosa");

	// Sibling parentId: el grupo original tiene parentId = null, por lo que el duplicado debe crearse en null
	const targetParent = rootGroup.parentId; // null
	const prepared = clipboard.preparePaste(undefined, targetParent);
	assert.ok(prepared, "preparePaste debe generar la estructura duplicada");

	const duplicateCmd = new DuplicateCommand(
		gameMock,
		hierarchy,
		groupManager,
		{
			hierarchyNodes: prepared.newHierarchyNodes,
			objectsData: prepared.newObjectsData,
			rootNodeIds: prepared.rootNodeIds
		}
	);

	duplicateCmd.execute();

	// 3. Verificaciones rigurosas de la duplicación:
	// A) Exactamente 20 piezas físicas reales
	assert.equal(
		physicalObjects.size,
		20,
		"Al duplicar una estructura de 10 piezas físicas, deben existir exactamente 20 piezas en el mapa"
	);

	// B) Los proxies de pivote no se tratan como objetos físicos construibles
	const physicalTypes = Array.from(physicalObjects.values()).map(m => m.userData.mapObjectType);
	assert.ok(!physicalTypes.includes("group_pivot"), "Ningún objeto físico real debe tener tipo 'group_pivot'");

	// C) El nuevo grupo es hermano del original (parentId null), NO hijo del original
	const newRootGroupId = prepared.rootNodeIds[0];
	assert.notEqual(newRootGroupId, rootGroup.id, "El nuevo grupo raíz debe tener un UUID distinto");
	const newRootNode = hierarchy.getNode(newRootGroupId);
	assert.ok(newRootNode, "El nuevo grupo raíz debe existir en la jerarquía");
	assert.equal(newRootNode.parentId, null, "El nuevo grupo debe crearse como hermano en la raíz, nunca anidado en el original");

	// D) Nuevos UUIDs únicos para cada objeto y grupo
	const allNodeIds = hierarchy.getAllNodes().map(n => n.id);
	const uniqueNodeIds = new Set(allNodeIds);
	assert.equal(allNodeIds.length, uniqueNodeIds.size, "Todos los IDs de nodos jerárquicos deben ser estrictamente únicos");

	// E) Remapeo de referencias lógicas internas y preservación de externas
	const duplicatedButtonId = prepared.uuidMap.get("button-n1");
	const duplicatedLightId = prepared.uuidMap.get("light-n1");
	assert.ok(duplicatedButtonId && duplicatedLightId);

	const duplicatedButtonMesh = physicalObjects.get(duplicatedButtonId);
	assert.ok(duplicatedButtonMesh, "La pieza botón duplicada debe existir en la escena");
	assert.equal(
		duplicatedButtonMesh.userData.logicProperties.targetUuid,
		duplicatedLightId,
		"La referencia interna debe remapearse al UUID de la luz duplicada"
	);
	assert.equal(
		duplicatedButtonMesh.userData.logicProperties.externalTrigger,
		"generator-external-99",
		"La referencia externa válida debe conservarse intacta"
	);

	// F) Estructura interna preservada en el duplicado (2 subgrupos dentro del nuevo grupo raíz)
	const newSubgroups = hierarchy.getChildren(newRootGroupId).filter(n => n.isGroup);
	assert.equal(newSubgroups.length, 2, "El grupo duplicado debe contener sus 2 subgrupos equivalentes");

	// G) Conservación espacial (distribución offseteada)
	const originalWall1 = physicalObjects.get("wall-n1");
	const duplicatedWall1Id = prepared.uuidMap.get("wall-n1");
	const duplicatedWall1 = physicalObjects.get(duplicatedWall1Id);
	assert.ok(duplicatedWall1);
	assert.equal(duplicatedWall1.position.x, originalWall1.position.x + 2, "Debe tener el offset X aplicado");
	assert.equal(duplicatedWall1.position.z, originalWall1.position.z + 2, "Debe tener el offset Z aplicado");

	// 4. Comprobar Undo y Redo
	duplicateCmd.undo();
	assert.equal(physicalObjects.size, 10, "Undo debe restaurar exactamente las 10 piezas físicas originales");
	assert.equal(hierarchy.getNode(newRootGroupId), undefined, "Undo debe eliminar el grupo duplicado de la jerarquía");

	duplicateCmd.execute(); // Redo
	assert.equal(physicalObjects.size, 20, "Redo debe restaurar nuevamente las 20 piezas físicas");
	assert.ok(hierarchy.getNode(newRootGroupId), "Redo debe restaurar el grupo duplicado");
});

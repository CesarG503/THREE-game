import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorClipboard } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");
const { EditorCommandHistory, MoveObjectCommand, ReparentCommand, DuplicateCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");
const { InteractionCoordinator } = await server.ssrLoadModule("/src/client/input/InteractionCoordinator.ts");
const { InputManager } = await server.ssrLoadModule("/src/client/input/InputManager.ts");
const { PrefabManager } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabManager.ts");
const { PrefabSerializer } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabSerializer.ts");

test("Problema 1: Movimiento de personaje con H activo, inputs de texto y blur", () => {
	globalThis.window = new EventTarget();
	globalThis.document = Object.assign(new EventTarget(), { activeElement: null });

	let pointerLockVal = null;
	const mockCanvas = Object.assign(new EventTarget(), {
		requestPointerLock() { pointerLockVal = mockCanvas; return Promise.resolve(); }
	});

	const gameMock = {
		gameMode: "editor",
		sceneManager: { renderer: { domElement: mockCanvas }, camera: new THREE.PerspectiveCamera() },
		cameraController: {
			isPaused: false,
			isUIOpen: false,
			setUIOpen(val) { this.isUIOpen = val; },
			togglePause() { this.isPaused = !this.isPaused; }
		},
		editorExplorer: {
			isVisible: false,
			toggleVisibility() { this.isVisible = !this.isVisible; },
			hide() { this.isVisible = false; }
		},
		constructionMenu: { isVisible: false, toggle() { this.isVisible = !this.isVisible; } },
		objectInspector: { isVisible: false, hide() { this.isVisible = false; } },
		isAnyEditorUIOpen() { return this.editorExplorer.isVisible || this.constructionMenu.isVisible || this.objectInspector.isVisible; },
		inputManager: null,
		fuelZoneSystem: { interaction: { release() {} } }
	};

	const coordinator = new InteractionCoordinator(gameMock);
	const inputManager = new InputManager();
	gameMock.inputManager = inputManager;

	inputManager.movementCheckCallback = () => coordinator.blocksMovement;
	inputManager.actionCheckCallback = () => coordinator.blocksGameplayActions;
	inputManager.uiCheckCallback = () => coordinator.blocksGameplayActions;

	// 1. Estado inicial: gameplay
	assert.equal(coordinator.state, "gameplay");
	assert.equal(coordinator.blocksMovement, false);
	assert.equal(coordinator.blocksGameplayActions, false);

	// 2. Abrir Explorer con tecla H
	const keyH = Object.assign(new Event("keydown", { cancelable: true }), { key: "h" });
	window.dispatchEvent(keyH);

	assert.equal(gameMock.editorExplorer.isVisible, true, "Explorer debe abrirse al presionar H");
	assert.equal(coordinator.state, "editor", "El estado debe ser 'editor'");
	assert.equal(coordinator.blocksMovement, false, "En modo editor con H abierto el movimiento NO debe bloquearse");
	assert.equal(coordinator.blocksGameplayActions, true, "Acciones de combate/colocación deben estar bloqueadas");
	assert.equal(gameMock.cameraController.isUIOpen, true, "La cámara debe estar informada de UI abierta");

	// 3. Probar que las teclas de movimiento se reciben correctamente con H activo
	inputManager.onKeyDown({ code: "KeyW" });
	assert.equal(inputManager.keys.forward, true, "W debe avanzar el personaje con H activo");

	inputManager.onKeyDown({ code: "KeyD" });
	assert.equal(inputManager.keys.right, true, "D debe desplazar a la derecha con H activo");

	inputManager.onKeyDown({ code: "Space" });
	assert.equal(inputManager.keys.jump, true, "Espacio debe saltar con H activo");

	// 4. Los clics del ratón NO deben activar ataque o apuntado
	mockCanvas.dispatchEvent(Object.assign(new Event("mousedown"), { button: 0 }));
	assert.equal(inputManager.keys.attack, false, "Clic izquierdo de edición no debe disparar ataque");

	// 5. Al enfocar un campo de texto (input, textarea), el movimiento debe bloquearse
	const mockInput = { tagName: "INPUT", blur() { document.activeElement = null; } };
	document.activeElement = mockInput;
	coordinator.sync();

	assert.equal(coordinator.state, "text");
	assert.equal(coordinator.blocksMovement, true, "Escribir en un input debe bloquear el movimiento del personaje");
	assert.equal(inputManager.keys.forward, false, "Las teclas de movimiento deben resetearse al enfocar un input");

	// Intentar presionar W mientras se escribe
	inputManager.onKeyDown({ code: "KeyW", target: mockInput });
	assert.equal(inputManager.keys.forward, false, "Presionar W mientras se escribe NO debe mover al personaje");

	// 6. Escape desenfoca el input sin cerrar paneles
	const escEvent = Object.assign(new Event("keydown", { cancelable: true }), { key: "escape" });
	window.dispatchEvent(escEvent);
	assert.equal(document.activeElement, null, "Escape debe desenfocar el input");
	assert.equal(gameMock.editorExplorer.isVisible, true, "Explorer debe permanecer abierto");

	// 7. Perder foco (blur) debe limpiar cualquier tecla o botón retenido
	inputManager.onKeyDown({ code: "KeyA" });
	assert.equal(inputManager.keys.left, true);
	window.dispatchEvent(new Event("blur"));
	assert.equal(inputManager.keys.left, false, "Blur debe limpiar teclas retenidas");

	coordinator.dispose();
	inputManager.dispose();
});

test("Problema 2: Modo Acoples: Traslación 3D individual arrastrando el recuadro superior conservando su grupo", () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const history = new EditorCommandHistory();
	groupManager.setCommandHistory(history);

	// Crear grupo y objeto hijo
	const group = hierarchy.createGroup("Base Almacén", null);
	groupManager.getOrCreatePivotProxy(group.id);

	const objectMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
	objectMesh.position.set(10, 0, 10);
	objectMesh.userData = {
		uuid: "obj-caja-1",
		isEditableMapObject: true,
		mapObjectType: "crate",
		rigidBody: {
			pos: { x: 10, y: 0, z: 10 },
			setTranslation(p) { this.pos = { ...p }; }
		}
	};
	scene.add(objectMesh);

	hierarchy.addNode({
		id: "obj-caja-1",
		name: "Caja Suministros",
		type: "crate",
		parentId: group.id,
		order: 0,
		isGroup: false
	});

	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
	camera.position.set(10, 15, 25);
	camera.lookAt(10, 0, 10);

	const eventListeners = new Map();
	const mockDom = {
		addEventListener(type, fn) {
			if (!eventListeners.has(type)) eventListeners.set(type, []);
			eventListeners.get(type).push(fn);
		},
		removeEventListener(type, fn) {
			const list = eventListeners.get(type) || [];
			const idx = list.indexOf(fn);
			if (idx !== -1) list.splice(idx, 1);
		},
		getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
		setPointerCapture() {},
		releasePointerCapture() {}
	};

	groupManager.attachCameraAndDom(camera, mockDom);
	groupManager.setCouplingMode(true, (uuid) => (uuid === "obj-caja-1" ? objectMesh : null));

	// 1. Simular arrastre espacial del objeto usando su recuadro superior
	const startPos = objectMesh.position.clone();
	assert.equal(startPos.x, 10);
	assert.equal(startPos.z, 10);

	// Mover objeto a nueva posición (simulando delta del arrastre 3D)
	const newPos = new THREE.Vector3(14, 0, 12);
	objectMesh.position.copy(newPos);
	objectMesh.userData.rigidBody.setTranslation({ x: newPos.x, y: newPos.y, z: newPos.z });

	// Comprobar que pertenece estrictamente al grupo original sin haber sufrido reparenting
	assert.equal(hierarchy.getNode("obj-caja-1")?.parentId, group.id, "El objeto debe conservar su pertenencia al grupo al moverse");

	// Registrar comando en historial
	const moveCmd = new MoveObjectCommand(
		objectMesh,
		{ x: startPos.x, y: startPos.y, z: startPos.z },
		{ x: newPos.x, y: newPos.y, z: newPos.z }
	);
	history.execute(moveCmd);

	assert.equal(objectMesh.position.x, 14);
	assert.equal(objectMesh.userData.rigidBody.pos.x, 14);

	// 2. Comprobar Undo del movimiento espacial
	history.undo();
	assert.equal(objectMesh.position.x, 10, "Undo debe restaurar la posición original del objeto");
	assert.equal(objectMesh.userData.rigidBody.pos.x, 10, "Undo debe sincronizar el collider de Rapier");
	assert.equal(hierarchy.getNode("obj-caja-1")?.parentId, group.id, "El grupo sigue intacto tras Undo");

	// 3. Comprobar Redo del movimiento espacial
	history.redo();
	assert.equal(objectMesh.position.x, 14, "Redo debe restablecer la posición movida");
	assert.equal(objectMesh.userData.rigidBody.pos.x, 14);

	groupManager.dispose();
});

test("Problema 2: Modo Acoples: Reparenting diferenciado mediante Shift + arrastre", () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const history = new EditorCommandHistory();
	groupManager.setCommandHistory(history);

	const groupA = hierarchy.createGroup("Grupo Origen", null);
	const groupB = hierarchy.createGroup("Grupo Destino", null);

	const piece = hierarchy.addNode({
		id: "pieza-1",
		name: "Pared Frontal",
		type: "wall",
		parentId: groupA.id,
		order: 0,
		isGroup: false
	});

	assert.equal(piece.parentId, groupA.id);

	// Ejecutar reparenting con Undo/Redo
	const reparentCmd = new ReparentCommand(hierarchy, piece.id, groupA.id, 0, groupB.id);
	history.execute(reparentCmd);

	assert.equal(hierarchy.getNode("pieza-1")?.parentId, groupB.id, "La pieza debe acoplarse a Grupo Destino");
	assert.equal(hierarchy.getChildren(groupB.id).length, 1);
	assert.equal(hierarchy.getChildren(groupA.id).length, 0);

	// Desacoplar mediante Undo
	history.undo();
	assert.equal(hierarchy.getNode("pieza-1")?.parentId, groupA.id, "Undo devuelve la pieza a Grupo Origen");

	groupManager.dispose();
});

test("Problemas 3 y 4: Copiar, pegar y duplicar subárbol completo con múltiples subgrupos y referencias", () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const clipboard = new EditorClipboard();
	const history = new EditorCommandHistory();

	const physicalObjects = new Map();
	const gameMock = {
		sceneManager: { scene },
		editableMapObjects: [],
		_loadSingleMapObject(objData) {
			const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
			mesh.position.set(objData.pos.x, objData.pos.y, objData.pos.z);
			mesh.userData = {
				uuid: objData.uuid,
				mapObjectType: objData.type,
				isEditableMapObject: true,
				parentId: objData.parentId,
				order: objData.order,
				logicProperties: objData.logicProperties ? JSON.parse(JSON.stringify(objData.logicProperties)) : {}
			};
			scene.add(mesh);
			this.editableMapObjects.push(mesh);
			physicalObjects.set(objData.uuid, mesh);
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

	// Crear estructura original:
	// - Grupo Raíz ("Edificio Principal")
	//   - Subgrupo 1 ("Piso 1") -> 2 paredes, 1 sensor
	//   - Subgrupo 2 ("Piso 2") -> 1 puerta (enlazada al sensor de Piso 1), 1 luz externa (enlazada a generador externo)
	const rootGroup = hierarchy.createGroup("Edificio Principal", null);
	const floor1 = hierarchy.createGroup("Piso 1", rootGroup.id);
	const floor2 = hierarchy.createGroup("Piso 2", rootGroup.id);

	const items = [
		{ uuid: "wall-1", type: "wall", pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: floor1.id },
		{ uuid: "wall-2", type: "wall", pos: { x: 2, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: floor1.id },
		{ uuid: "sensor-1", type: "interaction_button", pos: { x: 1, y: 1, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: floor1.id },
		{
			uuid: "door-1",
			type: "door",
			pos: { x: 0, y: 3, z: 0 },
			rot: { x: 0, y: 0, z: 0 },
			parentId: floor2.id,
			logicProperties: {
				activatorUuid: "sensor-1", // Referencia interna que DEBE remapearse
				generatorId: "power-plant-external" // Referencia externa que DEBE conservarse
			}
		}
	];

	items.forEach(it => {
		hierarchy.addNode({
			id: it.uuid,
			name: it.type,
			type: it.type,
			parentId: it.parentId,
			order: hierarchy.getChildren(it.parentId).length,
			isGroup: false
		});
		gameMock._loadSingleMapObject(it);
	});

	assert.equal(hierarchy.getChildren(rootGroup.id).length, 2, "La raíz debe tener 2 subgrupos");
	assert.equal(hierarchy.getDescendants(rootGroup.id).length, 6, "Total de descendientes debe ser 6 (2 subgrupos + 4 objetos)");

	// Copiar subárbol completo
	const copied = clipboard.copy([rootGroup.id], hierarchy, (id) => {
		const mesh = physicalObjects.get(id);
		if (!mesh) return null;
		return {
			uuid: mesh.userData.uuid,
			type: mesh.userData.mapObjectType,
			pos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
			rot: { x: 0, y: 0, z: 0 },
			parentId: mesh.userData.parentId,
			order: mesh.userData.order,
			logicProperties: mesh.userData.logicProperties
		};
	});

	assert.equal(copied, true, "El copiado del subárbol debe tener éxito");
	const payload = clipboard.getPayload();
	assert.equal(payload.hierarchyNodes.length, 7, "Debe haber 7 nodos en total (1 raíz + 2 subgrupos + 4 objetos)");
	assert.equal(payload.objectsData.length, 4, "Debe haber 4 objetos físicos reales en el portapapeles");

	// Pegar en una posición objetivo
	const targetPos = { x: 20, y: 0, z: 20 };
	const prepared = clipboard.preparePaste(targetPos, null);
	assert.ok(prepared);

	const dupCmd = new DuplicateCommand(gameMock, hierarchy, groupManager, {
		hierarchyNodes: prepared.newHierarchyNodes,
		objectsData: prepared.newObjectsData,
		rootNodeIds: prepared.rootNodeIds
	});

	history.execute(dupCmd);

	// Verificar la estructura duplicada
	const newRootId = prepared.rootNodeIds[0];
	assert.notEqual(newRootId, rootGroup.id, "El nuevo grupo debe tener un nuevo ID");
	const newDescendants = hierarchy.getDescendants(newRootId);
	assert.equal(newDescendants.length, 6, "El nuevo grupo debe tener exactamente 6 descendientes clonados");

	// Verificar que los subgrupos tienen sus hijos correspondientes
	const newSubgroups = hierarchy.getChildren(newRootId).filter(n => n.isGroup);
	assert.equal(newSubgroups.length, 2, "El nuevo grupo debe tener 2 subgrupos");

	const newFloor1 = newSubgroups.find(s => s.name === "Piso 1");
	const newFloor2 = newSubgroups.find(s => s.name === "Piso 2");
	assert.ok(newFloor1 && newFloor2);

	const floor1Children = hierarchy.getChildren(newFloor1.id);
	assert.equal(floor1Children.length, 3, "El nuevo Piso 1 debe tener sus 3 objetos");

	const floor2Children = hierarchy.getChildren(newFloor2.id);
	assert.equal(floor2Children.length, 1, "El nuevo Piso 2 debe tener su puerta");

	// Verificar remapeo de referencias de lógica
	const newDoorObj = gameMock.editableMapObjects.find(m => m.userData.parentId === newFloor2.id && m.userData.mapObjectType === "door");
	assert.ok(newDoorObj);

	const newSensorNode = floor1Children.find(n => n.type === "interaction_button");
	assert.ok(newSensorNode);

	assert.equal(newDoorObj.userData.logicProperties.activatorUuid, newSensorNode.id, "La referencia interna debe estar remapeada al nuevo sensor");
	assert.equal(newDoorObj.userData.logicProperties.generatorId, "power-plant-external", "La referencia externa debe conservarse");

	// Verificar Undo atómico completo
	history.undo();
	assert.equal(hierarchy.hasNode(newRootId), false, "Undo debe eliminar el grupo clonado");
	assert.equal(hierarchy.hasNode(newFloor1.id), false, "Undo debe eliminar los subgrupos clonados");
	assert.equal(physicalObjects.has(newDoorObj.userData.uuid), false, "Undo debe destruir los objetos físicos clonados");

	groupManager.dispose();
});

test("Problema 5: Prefab completo y política de colocación unificada", () => {
	const hierarchy = new EditorHierarchyModel();
	const prefabManager = new PrefabManager(hierarchy);

	// Crear grupo prefab
	const group = hierarchy.createGroup("Torreta Doble", null);
	const p1 = hierarchy.addNode({ id: "torre-base", name: "Base", type: "turret_base", parentId: group.id, order: 0, isGroup: false });
	const p2 = hierarchy.addNode({ id: "torre-canon", name: "Canon", type: "turret_cannon", parentId: group.id, order: 1, isGroup: false });

	const mockFetcher = (id) => {
		if (id === "torre-base") return { uuid: id, type: "turret_base", pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: group.id };
		if (id === "torre-canon") return { uuid: id, type: "turret_cannon", pos: { x: 0, y: 2, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: group.id };
		return null;
	};

	// 1. Exportar prefab con todos sus objetos
	const payload = prefabManager.createPrefabPayloadFromSelection(group.id, "Torreta Doble", mockFetcher, { category: "defensas" });
	assert.ok(payload);
	assert.equal(payload.objects.length, 2, "El prefab debe exportar los 2 objetos descendientes, no solo 1");
	assert.equal(payload.hierarchy.length, 3, "El prefab debe exportar el grupo y sus 2 hijos");

	// 2. Validación de seguridad con PrefabSerializer
	const validation = PrefabSerializer.validateAndParse(payload);
	assert.equal(validation.valid, true);

	// 3. Instanciar prefab con offset común (política unificada de colocación)
	const spawnPos = { x: 15, y: 0, z: 25 };
	const spawnedObjects = [];

	const result = prefabManager.instantiatePrefab(
		payload,
		"prefab-def-1",
		1,
		spawnPos,
		null,
		(objData) => spawnedObjects.push(objData)
	);

	assert.ok(result.instanceId);
	assert.ok(result.rootNodeId);
	assert.equal(spawnedObjects.length, 2, "Se deben instanciar las 2 piezas del prefab");

	// Comprobar que la disposición relativa se conserva perfectamente
	const baseSpawned = spawnedObjects.find(o => o.type === "turret_base");
	const canonSpawned = spawnedObjects.find(o => o.type === "turret_cannon");

	assert.equal(baseSpawned.pos.x, 15);
	assert.equal(baseSpawned.pos.y, 0);
	assert.equal(baseSpawned.pos.z, 25);

	assert.equal(canonSpawned.pos.x, 15);
	assert.equal(canonSpawned.pos.y, 2, "La altura relativa del cañón (+2) debe conservarse");
	assert.equal(canonSpawned.pos.z, 25);
});

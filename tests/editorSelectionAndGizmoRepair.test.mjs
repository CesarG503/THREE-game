import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

function setupMockDom() {
	let pointerLockedElement = null;
	const eventListeners = new Map();

	const domElement = {
		tagName: "CANVAS",
		style: {},
		addEventListener(type, listener) {
			if (!eventListeners.has(type)) eventListeners.set(type, []);
			eventListeners.get(type).push(listener);
		},
		removeEventListener(type, listener) {
			const list = eventListeners.get(type) || [];
			const idx = list.indexOf(listener);
			if (idx !== -1) list.splice(idx, 1);
		},
		dispatchEvent(event) {
			const list = eventListeners.get(event.type) || [];
			for (const l of list) l(event);
			return true;
		},
		setPointerCapture: () => {},
		releasePointerCapture: () => {},
		hasPointerCapture: () => false,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
	};

	const docListeners = new Map();
	const mockDocument = {
		get pointerLockElement() {
			return pointerLockedElement;
		},
		set pointerLockElement(val) {
			pointerLockedElement = val;
		},
		exitPointerLock: () => {
			pointerLockedElement = null;
		},
		createElement: (tag) => {
			const attrs = new Map();
			const el = {
				tagName: tag.toUpperCase(),
				style: {},
				dataset: {},
				children: [],
				childNodes: [],
				classList: {
					add: () => {},
					remove: () => {},
					toggle: () => {},
					contains: () => false,
				},
				setAttribute(name, val) { attrs.set(name, String(val)); },
				getAttribute(name) { return attrs.get(name) || null; },
				querySelector(sel) {
					const all = this.querySelectorAll(sel);
					return all.length > 0 ? all[0] : null;
				},
				querySelectorAll(sel) {
					const match = [];
					const check = (node) => {
						if (!node) return;
						if (sel.startsWith("[data-node-id")) {
							const m = sel.match(/\[data-node-id="([^"]+)"\]/);
							if (m && node.getAttribute?.("data-node-id") === m[1]) {
								match.push(node);
							} else if (sel === "[data-node-id]" && node.getAttribute?.("data-node-id")) {
								match.push(node);
							}
						}
						for (const c of node.children || []) {
							check(c);
						}
					};
					for (const c of this.children || []) {
						check(c);
					}
					return match;
				},
				appendChild(child) {
					this.children.push(child);
					this.childNodes.push(child);
					child.parentNode = this;
					return child;
				},
				removeChild(child) {
					const idx = this.children.indexOf(child);
					if (idx !== -1) this.children.splice(idx, 1);
					return child;
				},
				replaceChildren(...newChildren) {
					this.children = [...newChildren];
					this.childNodes = [...newChildren];
				},
				addEventListener: () => {},
				removeEventListener: () => {},
			};
			return el;
		},
		getElementById: () => null,
		querySelector: () => null,
		querySelectorAll: () => [],
		addEventListener: (type, listener) => {
			if (!docListeners.has(type)) docListeners.set(type, []);
			docListeners.get(type).push(listener);
		},
		removeEventListener: (type, listener) => {
			const list = docListeners.get(type) || [];
			const idx = list.indexOf(listener);
			if (idx !== -1) list.splice(idx, 1);
		},
		body: {
			appendChild: () => {},
			removeChild: () => {},
			style: {},
		},
	};

	const winListeners = new Map();
	const mockWindow = {
		addEventListener: (type, listener) => {
			if (!winListeners.has(type)) winListeners.set(type, []);
			winListeners.get(type).push(listener);
		},
		removeEventListener: (type, listener) => {
			const list = winListeners.get(type) || [];
			const idx = list.indexOf(listener);
			if (idx !== -1) list.splice(idx, 1);
		},
		innerWidth: 1920,
		innerHeight: 1080,
	};

	globalThis.window = mockWindow;
	globalThis.document = mockDocument;
	globalThis.HTMLElement = class HTMLElement {};
	return domElement;
}

const mockCanvas = setupMockDom();

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorSelectionManager } = await server.ssrLoadModule("/src/client/editor/selection/EditorSelectionManager.ts");
const { EditorCommandHistory, GroupNodesCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");
const { TransformGizmo } = await server.ssrLoadModule("/src/client/editor/TransformGizmo.ts");
const { InteractionCoordinator } = await server.ssrLoadModule("/src/client/input/InteractionCoordinator.ts");
const { EditorExplorer } = await server.ssrLoadModule("/src/client/editor/explorer/EditorExplorer.ts");
const { EditorClipboard } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");

test("FASE 2: EditorSelectionManager - Selección única, toggle y getEffectiveTransformNodes", () => {
	const hierarchy = new EditorHierarchyModel();
	const groupA = hierarchy.createGroup("Grupo A", null);
	const wall1 = hierarchy.addNode({ id: "wall-1", name: "Pared 1", parentId: groupA.id, order: 0, isGroup: false });
	const wall2 = hierarchy.addNode({ id: "wall-2", name: "Pared 2", parentId: groupA.id, order: 1, isGroup: false });
	const floor1 = hierarchy.addNode({ id: "floor-1", name: "Suelo 1", parentId: null, order: 1, isGroup: false });

	const objectsMap = new Map();
	const dummyResolve = (id) => {
		if (!objectsMap.has(id)) {
			const obj = new THREE.Object3D();
			obj.userData.uuid = id;
			objectsMap.set(id, obj);
		}
		return objectsMap.get(id);
	};

	let lastEvent = null;
	const selection = new EditorSelectionManager(hierarchy, dummyResolve);
	selection.addListener((selectedIds, activeId, source) => {
		lastEvent = { selectedIds, activeId, source };
	});

	// 1. Selección individual
	selection.selectSingle("wall-1", "test");
	assert.equal(selection.getCount(), 1);
	assert.equal(selection.getActiveId(), "wall-1");
	assert.ok(selection.isSelected("wall-1"));
	assert.equal(lastEvent?.activeId, "wall-1");
	assert.equal(lastEvent?.source, "test");

	// 2. Toggle (Shift o Ctrl)
	selection.toggle("floor-1", "test-toggle");
	assert.equal(selection.getCount(), 2);
	assert.equal(selection.getActiveId(), "floor-1");
	assert.ok(selection.isSelected("wall-1"));
	assert.ok(selection.isSelected("floor-1"));

	// 3. Selección simultánea de grupo y su hijo: getEffectiveTransformNodeIds debe omitir el hijo
	selection.selectSingle(groupA.id);
	selection.toggle("wall-1"); // Hijo de groupA
	selection.toggle("floor-1"); // Hermano independiente
	assert.equal(selection.getCount(), 3);

	const effectiveIds = selection.getEffectiveTransformNodeIds();
	assert.equal(effectiveIds.length, 2, "Debe omitir wall-1 porque su ancestro groupA ya está seleccionado");
	assert.ok(effectiveIds.includes(groupA.id));
	assert.ok(effectiveIds.includes("floor-1"));
	assert.ok(!effectiveIds.includes("wall-1"));

	// 4. Clear
	selection.clear();
	assert.equal(selection.getCount(), 0);
	assert.equal(selection.getActiveId(), null);
});

test("FASE 2: EditorSelectionManager - Selección por rango (Shift+Click en Explorer)", () => {
	const hierarchy = new EditorHierarchyModel();
	const g1 = hierarchy.createGroup("G1", null);
	const item1 = hierarchy.addNode({ id: "item-1", name: "Item 1", parentId: g1.id, order: 0, isGroup: false });
	const item2 = hierarchy.addNode({ id: "item-2", name: "Item 2", parentId: g1.id, order: 1, isGroup: false });
	const item3 = hierarchy.addNode({ id: "item-3", name: "Item 3", parentId: null, order: 1, isGroup: false });

	const selection = new EditorSelectionManager(hierarchy, () => null);
	const visibleOrder = [g1.id, "item-1", "item-2", "item-3"];

	// Inicia en item-1
	selection.selectSingle("item-1");
	assert.equal(selection.getActiveId(), "item-1");

	// Shift+Click en item-3
	selection.selectRange("item-3", visibleOrder);
	assert.equal(selection.getCount(), 3);
	assert.ok(selection.isSelected("item-1"));
	assert.ok(selection.isSelected("item-2"));
	assert.ok(selection.isSelected("item-3"));
	assert.ok(!selection.isSelected(g1.id));
});

test("FASE 3: TransformGizmo - Persistencia de sessionMode y modos permitidos por tipo de objeto", () => {
	const dummyGame = {
		sceneManager: {
			scene: new THREE.Scene(),
			camera: new THREE.PerspectiveCamera(),
			renderer: { domElement: mockCanvas },
		},
		inputManager: { enabled: true },
	};
	const dummyInspector = {
		applyGizmoTransform: () => {},
		syncTransformInputs: () => {},
	};

	const gizmo = new TransformGizmo(dummyGame, dummyInspector);

	// 1. Objeto normal admite translate, scale, rotate
	const normalMesh = new THREE.Mesh();
	normalMesh.userData.isEditableMapObject = true;
	normalMesh.userData.mapObjectType = "wall";

	const normalModes = gizmo.getSupportedModes(normalMesh);
	assert.deepEqual(normalModes, ["translate", "scale", "rotate"]);

	// 2. Grupo admite estrictamente translate y rotate (NO escala ni curvatura)
	const groupPivot = new THREE.Object3D();
	groupPivot.userData.isEditorGroupPivot = true;
	groupPivot.userData.isEditableMapObject = true;

	const groupModes = gizmo.getSupportedModes(groupPivot);
	assert.deepEqual(groupModes, ["translate", "rotate"], "Los grupos no deben admitir escala en TransformGizmo");

	// 3. Persistencia de sessionMode: cambiar de objeto preserva el modo si es soportado
	gizmo.attach(normalMesh);
	gizmo.setMode("rotate");
	assert.equal(gizmo.getMode(), "rotate");
	assert.equal(gizmo.sessionMode, "rotate");

	// Cambiar a groupPivot: soporta rotate, por lo que debe permanecer en rotate
	gizmo.attach(groupPivot);
	assert.equal(gizmo.getMode(), "rotate", "Debe mantener sessionMode en rotate al cambiar al grupo");

	// Ciclar modo en grupo: rotate -> translate -> rotate (nunca scale)
	const nextMode = gizmo.cycleMode();
	assert.equal(nextMode, "translate");
	const afterTranslate = gizmo.cycleMode();
	assert.equal(afterTranslate, "rotate");

	// 4. Durante el arrastre del gizmo, inputManager.enabled NO debe desactivarse (mantiene WASD y salto)
	gizmo.handleMouseDown();
	assert.equal(dummyGame.inputManager.enabled, true, "inputManager debe permanecer activado durante el arrastre del gizmo");
});

test("FASE 4: InteractionCoordinator - Escape limpia selección sin pausar; gizmo-drag no bloquea escena", () => {
	let cleared = false;
	const dummyGame = {
		isAnyEditorUIOpen: () => false,
		cameraController: { isPaused: false, isUIOpen: false, setPaused: () => {}, setUIOpen: () => {} },
		constructionMenu: { isVisible: false, close: () => {} },
		objectInspector: { isVisible: false, hide: () => {} },
		editorExplorer: { isVisible: false, hide: () => {} },
		editorGroupManager: { isCouplingMode: () => false, isPivotEditMode: () => false },
		editorSelection: {
			getCount: () => 2,
			clear: () => { cleared = true; },
		},
	};

	const coord = new InteractionCoordinator(dummyGame);
	coord.handleEscapeKey();
	assert.equal(cleared, true, "Escape debe limpiar primero la selección activa sin pausar el juego");

	// gizmo-drag y connector-drag no bloquean escena
	coord.begin("gizmo-drag");
	assert.equal(coord.blocksScene, false, "gizmo-drag no debe considerarse como bloqueo de escena");
	coord.end("gizmo-drag");
});

test("FASE 5: EditorGroupManager - Conectores: Tap corto (<=6px) selecciona sin mover; arrastre (>6px) traslada", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);

	const group = hierarchy.createGroup("Edificio", null);
	const wall = hierarchy.addNode({ id: "wall-10", name: "Pared 10", parentId: group.id, order: 0, isGroup: false });

	const wallMesh = new THREE.Mesh();
	wallMesh.position.set(5, 0, 5);
	wallMesh.userData.uuid = "wall-10";
	wallMesh.userData.isEditableMapObject = true;

	const selection = new EditorSelectionManager(hierarchy, (id) => (id === "wall-10" ? wallMesh : null));
	groupManager.selectionManager = selection;

	// Iniciar modo acoples
	const camera = new THREE.PerspectiveCamera();
	camera.position.set(0, 5, 20);
	camera.lookAt(0, 0, 0);

	groupManager.attachCameraAndDom(camera, mockCanvas);
	groupManager.setCouplingMode(true, (id) => (id === "wall-10" ? wallMesh : null));

	assert.equal(groupManager.isCouplingMode(), true);

	// Simular tap corto en conector (pointerdown -> pointerup con movimiento <= 6px)
	const connectorMesh = groupManager.connectorMeshes.get("wall-10");
	assert.ok(connectorMesh, "Debe existir un conectorMesh para wall-10");

	// Simular que el raycaster golpea el connectorMesh
	groupManager.getRaycaster = () => ({
		intersectObjects: (objs) => [{ object: connectorMesh, point: connectorMesh.position.clone() }],
		ray: { intersectPlane: (plane, target) => target.copy(connectorMesh.position) }
	});

	// PointerDown
	groupManager.handlePointerDown({
		button: 0,
		pointerId: 1,
		clientX: 100,
		clientY: 100,
		preventDefault: () => {},
		stopPropagation: () => {},
	});

	// PointerUp a 2px de distancia (Tap corto)
	groupManager.handlePointerUp({
		pointerId: 1,
		clientX: 102,
		clientY: 101,
		shiftKey: false,
	});

	assert.equal(selection.getActiveId(), "wall-10", "El tap corto debe seleccionar el objeto correspondiente al conector");
	assert.equal(groupManager.isCouplingMode(), true, "El tap corto no debe cerrar el modo de acoples");
	assert.equal(wallMesh.position.x, 5, "El objeto no debe haberse desplazado");
});

test("FASE 6: Transformación grupal y anidamiento: Subgrupos heredan transformación y proxies se inicializan", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);

	// Estructura: Casa -> Techo (subgrupo) -> Teja (objeto)
	const casa = hierarchy.createGroup("Casa", null);
	const techo = hierarchy.createGroup("Techo", casa.id);
	const teja = hierarchy.addNode({ id: "teja-1", name: "Teja 1", parentId: techo.id, order: 0, isGroup: false });

	const tejaMesh = new THREE.Mesh();
	tejaMesh.position.set(0, 10, 0);
	tejaMesh.userData.uuid = "teja-1";

	const resolver = (id) => {
		if (id === "teja-1") return tejaMesh;
		if (hierarchy.getNode(id)?.isGroup) return groupManager.getOrCreatePivotProxy(id);
		return null;
	};

	// Posicionar pivote de Casa centrado en sus objetos: (0, 10, 0)
	groupManager.recenterGroupPivot(casa.id, resolver);

	// Trasladar Casa en +5 en X manteniendo Y=10
	groupManager.beginGroupTransform(casa.id, resolver);
	groupManager.updateGroupTransform(
		casa.id,
		new THREE.Vector3(5, 10, 0),
		new THREE.Quaternion(),
		resolver
	);

	// La teja debe haberse desplazado en X a (5, 10, 0)
	assert.equal(Math.round(tejaMesh.position.x), 5);
	assert.equal(Math.round(tejaMesh.position.y), 10);

	// El proxy del subgrupo Techo debe haberse creado y actualizado automáticamente
	const techoProxy = groupManager.getOrCreatePivotProxy(techo.id);
	assert.ok(techoProxy, "El subgrupo Techo debe tener su proxy actualizado");
	assert.equal(Math.round(techoProxy.position.x), 5);
});

test("FASE 7: GroupNodesCommand - Agrupación atómica de multiselección con Undo y Redo", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);

	const o1 = hierarchy.addNode({ id: "obj-1", name: "Objeto 1", parentId: null, order: 0, isGroup: false });
	const o2 = hierarchy.addNode({ id: "obj-2", name: "Objeto 2", parentId: null, order: 1, isGroup: false });
	const o3 = hierarchy.addNode({ id: "obj-3", name: "Objeto 3", parentId: null, order: 2, isGroup: false });

	let callbackGroupId = null;
	const cmd = new GroupNodesCommand(
		hierarchy,
		groupManager,
		["obj-1", "obj-2", "obj-3"],
		"Nuevo Combo",
		null,
		(groupId) => { callbackGroupId = groupId; }
	);

	// 1. Ejecutar agrupación
	history.execute(cmd);

	assert.ok(callbackGroupId, "Debe haberse creado un groupId");
	const createdGroup = hierarchy.getNode(callbackGroupId);
	assert.ok(createdGroup?.isGroup);
	assert.equal(createdGroup.name, "Nuevo Combo");

	const children = hierarchy.getChildren(callbackGroupId);
	assert.equal(children.length, 3);
	assert.deepEqual(children.map(c => c.id).sort(), ["obj-1", "obj-2", "obj-3"].sort());

	// 2. Deshacer agrupación (Undo)
	history.undo();
	assert.ok(!hierarchy.hasNode(callbackGroupId), "El grupo debe haber sido eliminado en Undo");
	assert.equal(hierarchy.getNode("obj-1").parentId, null, "Los objetos deben haber regresado a la raíz");
	assert.equal(hierarchy.getNode("obj-2").parentId, null);
	assert.equal(hierarchy.getNode("obj-3").parentId, null);

	// 3. Rehacer agrupación (Redo)
	history.redo();
	assert.ok(hierarchy.hasNode(callbackGroupId), "El grupo debe haber sido restaurado en Redo");
	assert.equal(hierarchy.getChildren(callbackGroupId).length, 3);
});

test("FASE 8: EditorExplorer - Arrastrar múltiples objetos seleccionados con Shift+Click a un grupo con Undo/Redo", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);

	const groupDestino = hierarchy.createGroup("Grupo Destino", null);
	const wall1 = hierarchy.addNode({ id: "wall-a", name: "Pared A", parentId: null, order: 1, isGroup: false });
	const wall2 = hierarchy.addNode({ id: "wall-b", name: "Pared B", parentId: null, order: 2, isGroup: false });
	const wall3 = hierarchy.addNode({ id: "wall-c", name: "Pared C", parentId: null, order: 3, isGroup: false });

	const selection = new EditorSelectionManager(hierarchy, () => null);

	const dummyGame = {
		editorSelection: selection,
		interaction: { begin: () => true, end: () => {} },
		cameraController: { isUIOpen: false, setUIOpen: () => {} },
		objectInspector: { show: () => {}, hide: () => {}, detachAndClear: () => {} },
		broadcastObjectUpdate: () => {},
	};

	const explorer = new EditorExplorer(
		dummyGame,
		hierarchy,
		groupManager,
		{},
		history,
		{}
	);

	explorer.renderTree();

	// 1. Seleccionar wall-a, wall-b y wall-c con Shift+Click
	selection.selectSingle("wall-a");
	selection.selectRange("wall-c", explorer.getVisibleNodeIds());
	assert.equal(selection.getCount(), 3);
	assert.deepEqual(selection.getEffectiveTransformNodeIds().sort(), ["wall-a", "wall-b", "wall-c"].sort());

	// 2. Iniciar drag sobre la fila de wall-a
	const rowWallA = explorer.treeContainer.querySelector('[data-node-id="wall-a"]');
	assert.ok(rowWallA, "Fila de wall-a debe existir en el DOM");

	const mockDataTransfer = {
		data: {},
		setData(type, val) { this.data[type] = val; },
		getData(type) { return this.data[type]; },
		effectAllowed: "none",
		dropEffect: "none",
	};

	rowWallA.ondragstart({
		dataTransfer: mockDataTransfer,
	});

	// Verificar que draggedNodeIds contiene los 3 objetos seleccionados
	assert.equal(explorer.draggedNodeIds.length, 3);
	assert.deepEqual(explorer.draggedNodeIds.sort(), ["wall-a", "wall-b", "wall-c"].sort());

	// 3. Drop sobre la fila de groupDestino (dropPosition = "inside")
	const rowGroup = explorer.treeContainer.querySelector(`[data-node-id="${groupDestino.id}"]`);
	assert.ok(rowGroup, "Fila de grupo destino debe existir");
	rowGroup.getBoundingClientRect = () => ({ top: 100, height: 40 });

	rowGroup.ondrop({
		preventDefault: () => {},
		stopPropagation: () => {},
		clientY: 120, // relY = 20 (50% de altura => "inside")
		dataTransfer: mockDataTransfer,
	});

	// Comprobar que los 3 objetos ahora son hijos de groupDestino
	assert.equal(hierarchy.getNode("wall-a").parentId, groupDestino.id);
	assert.equal(hierarchy.getNode("wall-b").parentId, groupDestino.id);
	assert.equal(hierarchy.getNode("wall-c").parentId, groupDestino.id);
	const children = hierarchy.getChildren(groupDestino.id);
	assert.equal(children.length, 3);

	// Comprobar que los 3 objetos siguen seleccionados
	assert.equal(selection.getCount(), 3);
	assert.ok(selection.isSelected("wall-a"));
	assert.ok(selection.isSelected("wall-b"));
	assert.ok(selection.isSelected("wall-c"));

	// 4. Probar Undo atómico (los 3 vuelven a la raíz con una sola operación)
	history.undo();
	assert.equal(hierarchy.getNode("wall-a").parentId, null);
	assert.equal(hierarchy.getNode("wall-b").parentId, null);
	assert.equal(hierarchy.getNode("wall-c").parentId, null);
	assert.equal(hierarchy.getChildren(groupDestino.id).length, 0);

	// 5. Probar Redo atómico (los 3 regresan a groupDestino)
	history.redo();
	assert.equal(hierarchy.getNode("wall-a").parentId, groupDestino.id);
	assert.equal(hierarchy.getNode("wall-b").parentId, groupDestino.id);
	assert.equal(hierarchy.getNode("wall-c").parentId, groupDestino.id);
	assert.equal(hierarchy.getChildren(groupDestino.id).length, 3);
});

test("FASE 2: Agrupar selección múltiple (Shift+Click) de una sola vez", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);

	const n1 = hierarchy.addNode({ id: "box-1", name: "Caja 1", parentId: null, order: 0, isGroup: false });
	const n2 = hierarchy.addNode({ id: "box-2", name: "Caja 2", parentId: null, order: 1, isGroup: false });
	const n3 = hierarchy.addNode({ id: "box-3", name: "Caja 3", parentId: null, order: 2, isGroup: false });

	const selection = new EditorSelectionManager(hierarchy, () => null);
	groupManager.selectionManager = selection;

	const dummyGame = {
		editorSelection: selection,
		interaction: { begin: () => true, end: () => {} },
		cameraController: { isUIOpen: false, setUIOpen: () => {} },
		objectInspector: { show: () => {}, hide: () => {}, detachAndClear: () => {} },
		broadcastObjectUpdate: () => {},
		resolveObject3D: () => null,
	};

	const explorer = new EditorExplorer(
		dummyGame,
		hierarchy,
		groupManager,
		{},
		history,
		{}
	);

	explorer.renderTree();

	// 1. Simular Shift+Click seleccionando las 3 cajas
	selection.selectSingle("box-1");
	selection.selectRange("box-3", explorer.getVisibleNodeIds());
	assert.equal(selection.getCount(), 3);

	// 2. Presionar el botón Grupo / handleCreateGroup
	const origPrompt = globalThis.prompt;
	globalThis.prompt = () => "Grupo De Cajas";

	explorer.handleCreateGroup();

	globalThis.prompt = origPrompt;

	// Verificar que se creó un nuevo grupo con las 3 cajas dentro
	const createdGroupId = selection.getActiveId();
	assert.ok(createdGroupId, "El nuevo grupo debe quedar activo");
	const groupNode = hierarchy.getNode(createdGroupId);
	assert.ok(groupNode && groupNode.isGroup, "El nodo creado debe ser un grupo");
	assert.equal(groupNode.customName, "Grupo De Cajas");

	assert.equal(hierarchy.getNode("box-1").parentId, createdGroupId);
	assert.equal(hierarchy.getNode("box-2").parentId, createdGroupId);
	assert.equal(hierarchy.getNode("box-3").parentId, createdGroupId);
	assert.equal(hierarchy.getChildren(createdGroupId).length, 3);

	// 3. Undo y Redo atómicos
	history.undo();
	assert.equal(hierarchy.getNode("box-1").parentId, null);
	assert.equal(hierarchy.getNode("box-2").parentId, null);
	assert.equal(hierarchy.getNode("box-3").parentId, null);

	history.redo();
	assert.equal(hierarchy.getNode("box-1").parentId, createdGroupId);
	assert.equal(hierarchy.getNode("box-2").parentId, createdGroupId);
	assert.equal(hierarchy.getNode("box-3").parentId, createdGroupId);
});

test("FASE 2: Portapapeles con atajos universales y sin botones en menú H", () => {
	const hierarchy = new EditorHierarchyModel();
	const scene = new THREE.Scene();
	const history = new EditorCommandHistory();
	const groupManager = new EditorGroupManager(hierarchy, scene, history);
	const clipboard = new EditorClipboard();

	const n1 = hierarchy.addNode({ id: "mesh-1", name: "Malla 1", parentId: null, order: 0, isGroup: false });

	const mockObj = new THREE.Mesh();
	mockObj.userData = { uuid: "mesh-1", isEditableMapObject: true, mapObjectType: "wall" };

	const selection = new EditorSelectionManager(hierarchy, (id) => id === "mesh-1" ? mockObj : null);
	groupManager.selectionManager = selection;

	let singleLoaded = null;
	const dummyGame = {
		gameMode: "editor",
		editorSelection: selection,
		interaction: { begin: () => true, end: () => {} },
		cameraController: { isUIOpen: false, setUIOpen: () => {} },
		objectInspector: { show: () => {}, hide: () => {}, detachAndClear: () => {} },
		broadcastObjectUpdate: () => {},
		resolveObject3D: (id) => id === "mesh-1" ? mockObj : null,
		_loadSingleMapObject: (data) => { singleLoaded = data; },
		editableMapObjects: [mockObj],
		sceneManager: {
			scene: new THREE.Scene(),
			camera: new THREE.PerspectiveCamera(),
		}
	};

	const explorer = new EditorExplorer(
		dummyGame,
		hierarchy,
		groupManager,
		clipboard,
		history,
		{}
	);

	// 1. Verificar que los botones manuales "Copiar" y "Pegar" ya NO están en la barra de herramientas de H
	const buttons = Array.from(explorer.sceneContentContainer.querySelectorAll("button"));
	const buttonTexts = buttons.map(b => b.textContent?.trim());
	assert.ok(!buttonTexts.includes("Copiar"), "La barra de H no debe incluir botón Copiar");
	assert.ok(!buttonTexts.includes("Pegar"), "La barra de H no debe incluir botón Pegar");

	// 2. Probar copiar con selección activa
	selection.selectSingle("mesh-1");
	explorer.handleCopy();
	assert.ok(clipboard.hasContent(), "El portapapeles debe tener contenido tras handleCopy");

	// 3. Probar pegar
	explorer.handlePaste();
	assert.ok(singleLoaded, "handlePaste debe haber instanciado el objeto duplicado");
	assert.notEqual(singleLoaded.uuid, "mesh-1", "El objeto pegado debe tener un UUID nuevo");
});

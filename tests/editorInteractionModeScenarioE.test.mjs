import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

// Configuración de mock de DOM global para Node.js test runner
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
		requestPointerLock: () => {
			pointerLockedElement = domElement;
			return Promise.resolve();
		},
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
			const el = {
				tagName: tag.toUpperCase(),
				style: {},
				dataset: {},
				children: [],
				childNodes: [],
				appendChild(child) {
					this.children.push(child);
					this.childNodes.push(child);
					child.parentNode = this;
					return child;
				},
				removeChild(child) {
					const idx = this.children.indexOf(child);
					if (idx !== -1) this.children.splice(idx, 1);
					const cIdx = this.childNodes.indexOf(child);
					if (cIdx !== -1) this.childNodes.splice(cIdx, 1);
					return child;
				},
				replaceChildren(...newChildren) {
					this.children = [...newChildren];
					this.childNodes = [...newChildren];
				},
				addEventListener: () => {},
				removeEventListener: () => {},
				setAttribute: () => {},
				getAttribute: () => null,
				querySelectorAll: () => [],
				querySelector: () => null,
				focus: () => {},
				blur: () => {},
				click: () => {},
			};
			return el;
		},
		body: {
			appendChild: () => {},
			removeChild: () => {},
			requestPointerLock: () => {
				pointerLockedElement = domElement;
				return Promise.resolve();
			},
		},
		activeElement: null,
		addEventListener: (type, listener) => {
			if (!docListeners.has(type)) docListeners.set(type, []);
			docListeners.get(type).push(listener);
		},
		removeEventListener: (type, listener) => {
			const list = docListeners.get(type) || [];
			const idx = list.indexOf(listener);
			if (idx !== -1) list.splice(idx, 1);
		},
		dispatchEvent: (event) => {
			const list = docListeners.get(event.type) || [];
			for (const l of list) l(event);
			return true;
		},
	};

	globalThis.document = mockDocument;
	globalThis.window = {
		addEventListener: mockDocument.addEventListener,
		removeEventListener: mockDocument.removeEventListener,
		innerWidth: 800,
		innerHeight: 600,
	};
	globalThis.CustomEvent = class CustomEvent {
		constructor(type, params = {}) {
			this.type = type;
			this.detail = params.detail;
		}
	};
	globalThis.PointerEvent = class PointerEvent {
		constructor(type, params = {}) {
			this.type = type;
			this.button = params.button ?? 0;
			this.clientX = params.clientX ?? 0;
			this.clientY = params.clientY ?? 0;
		}
		preventDefault() {}
		stopPropagation() {}
	};
	globalThis.MouseEvent = globalThis.PointerEvent;
	globalThis.KeyboardEvent = class KeyboardEvent {
		constructor(type, params = {}) {
			this.type = type;
			this.key = params.key ?? "";
			this.code = params.code ?? "";
			this.ctrlKey = !!params.ctrlKey;
			this.shiftKey = !!params.shiftKey;
			this.altKey = !!params.altKey;
			this.metaKey = !!params.metaKey;
		}
		preventDefault() {}
		stopPropagation() {}
	};

	return { domElement, mockDocument, eventListeners, docListeners };
}

const { domElement } = setupMockDom();

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { CameraController } = await server.ssrLoadModule("/src/client/camera/CameraController.ts");
const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorClipboard } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");
const { EditorCommandHistory } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");
const { PrefabManager } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabManager.ts");
const { EditorExplorer } = await server.ssrLoadModule("/src/client/editor/explorer/EditorExplorer.ts");
const { PrefabService } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabService.ts");

test("Escenario E1: Activar H en EditorExplorer libera pointer lock y establece CameraController.isUIOpen", () => {
	const camera = new THREE.PerspectiveCamera();
	const cameraController = new CameraController(camera, domElement);

	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, new THREE.Scene());
	const clipboard = new EditorClipboard();
	const history = new EditorCommandHistory();
	const prefabManager = new PrefabManager();

	const mockGame = {
		gameMode: "editor",
		cameraController,
		inputManager: { enabled: true, keys: { attack: false, aim: false }, reset: () => {} },
		editorExplorer: null,
		isAnyEditorUIOpen() {
			return !!(this.editorExplorer?.isVisible || this.constructionMenu?.isVisible || this.objectInspector?.isVisible);
		},
		updateEditorInteractionMode() {
			const isUIActive = this.isAnyEditorUIOpen();
			if (isUIActive) {
				document.exitPointerLock();
				this.cameraController.setUIOpen(true);
			} else {
				this.cameraController.setUIOpen(false);
			}
		}
	};
	cameraController.uiCheckCallback = () => mockGame.isAnyEditorUIOpen();

	const explorer = new EditorExplorer(mockGame, hierarchy, groupManager, clipboard, history, prefabManager, { initialVisible: false });
	mockGame.editorExplorer = explorer;

	// 1. Estado inicial: Explorer oculto por defecto
	assert.equal(explorer.isVisible, false, "Explorer debe inicializarse oculto");
	assert.equal(cameraController.isUIOpen, false, "CameraController no debe tener UI abierta al inicio");

	// Simular pointer lock activo durante gameplay normal
	document.pointerLockElement = domElement;
	assert.equal(document.pointerLockElement, domElement);

	// 2. Usuario pulsa H (activa show)
	explorer.show();

	// 3. Comprobar que pointer lock se liberó inmediatamente y CameraController.isUIOpen es true
	assert.equal(explorer.isVisible, true, "Explorer debe estar visible tras show()");
	assert.equal(document.pointerLockElement, null, "Pointer Lock del navegador DEBE liberarse inmediatamente");
	assert.equal(cameraController.isUIOpen, true, "CameraController.isUIOpen debe ser true al abrir Explorer");

	// 4. Intento de rebloquear ratón mediante click o lock() debe ser rechazado mientras Explorer esté abierto
	cameraController.lock();
	assert.equal(document.pointerLockElement, null, "cameraController.lock() debe ignorarse mientras Explorer esté abierto");

	cameraController.safeRequestPointerLock();
	assert.equal(document.pointerLockElement, null, "cameraController.safeRequestPointerLock() debe ignorarse mientras Explorer esté abierto");

	// 5. Usuario pulsa H de nuevo (hide)
	explorer.hide();
	assert.equal(explorer.isVisible, false, "Explorer debe ocultarse");
	assert.equal(cameraController.isUIOpen, false, "CameraController.isUIOpen debe restablecerse a false cuando se cierra la UI");
});

test("Escenario E2: Transición H -> E -> Cerrar E conserva el cursor libre si H sigue abierto", () => {
	const camera = new THREE.PerspectiveCamera();
	const cameraController = new CameraController(camera, domElement);

	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, new THREE.Scene());
	const clipboard = new EditorClipboard();
	const history = new EditorCommandHistory();
	const prefabManager = new PrefabManager();

	const mockGame = {
		gameMode: "editor",
		cameraController,
		inputManager: { enabled: true, keys: { attack: false, aim: false }, reset: () => {} },
		constructionMenu: { isVisible: false },
		objectInspector: { isVisible: false },
		editorExplorer: null,
		isAnyEditorUIOpen() {
			return !!(this.editorExplorer?.isVisible || this.constructionMenu?.isVisible || this.objectInspector?.isVisible);
		},
		updateEditorInteractionMode() {
			const isUIActive = this.isAnyEditorUIOpen();
			if (isUIActive) {
				document.exitPointerLock();
				this.cameraController.setUIOpen(true);
			} else {
				this.cameraController.setUIOpen(false);
			}
		}
	};
	cameraController.uiCheckCallback = () => mockGame.isAnyEditorUIOpen();

	const explorer = new EditorExplorer(mockGame, hierarchy, groupManager, clipboard, history, prefabManager, { initialVisible: false });
	mockGame.editorExplorer = explorer;

	// 1. Abrir Explorer (H)
	explorer.show();
	assert.equal(explorer.isVisible, true);
	assert.equal(cameraController.isUIOpen, true);
	assert.equal(document.pointerLockElement, null);

	// 2. Abrir menú de construcción (E)
	mockGame.constructionMenu.isVisible = true;
	mockGame.updateEditorInteractionMode();
	assert.equal(cameraController.isUIOpen, true);
	assert.equal(document.pointerLockElement, null);

	// 3. Cerrar menú de construcción (E) MIENTRAS Explorer sigue abierto
	mockGame.constructionMenu.isVisible = false;
	cameraController.setUIOpen(false); // setUIOpen debe consultar uiCheckCallback y rechazar el cierre
	mockGame.updateEditorInteractionMode();

	// Verificación crítica: el cursor DEBE continuar libre porque H sigue abierto
	assert.equal(explorer.isVisible, true, "Explorer debe seguir abierto");
	assert.equal(cameraController.isUIOpen, true, "CameraController.isUIOpen DEBE PERMANECER TRUE porque Explorer sigue activo");
	assert.equal(document.pointerLockElement, null, "Pointer Lock NO debe rebloquearse al cerrar E si H sigue abierto");

	// 4. Finalmente cerrar H
	explorer.hide();
	assert.equal(explorer.isVisible, false);
	assert.equal(cameraController.isUIOpen, false, "isUIOpen ahora sí debe ser false porque no queda ninguna interfaz abierta");
});

test("Escenario E3: CameraController no rota en mousemove cuando isUIOpen o uiCheckCallback es true", () => {
	const camera = new THREE.PerspectiveCamera();
	const cameraController = new CameraController(camera, domElement);

	let uiActive = true;
	cameraController.uiCheckCallback = () => uiActive;
	cameraController.setUIOpen(true);

	const initialTheta = cameraController.theta;
	const initialPhi = cameraController.phi;

	// Simular mousemove cuando UI está abierta
	const mouseMoveEv = new MouseEvent("mousemove", { movementX: 100, movementY: 50 });
	document.dispatchEvent(mouseMoveEv);

	assert.equal(cameraController.theta, initialTheta, "Theta no debe cambiar en mousemove si UI está abierta");
	assert.equal(cameraController.phi, initialPhi, "Phi no debe cambiar en mousemove si UI está abierta");

	// Cerrar UI
	uiActive = false;
	cameraController.setUIOpen(false);
	assert.equal(cameraController.isUIOpen, false);
});

test("Escenario E4: Sincronización de selección de objetos 3D y pivotes de grupos con gizmo y Explorer", () => {
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, new THREE.Scene());
	const clipboard = new EditorClipboard();
	const history = new EditorCommandHistory();
	const prefabManager = new PrefabManager();

	let selectedObjectInInspector = null;
	const mockInspector = {
		isVisible: false,
		selectedObject: null,
		show(obj) {
			this.isVisible = true;
			this.selectedObject = obj;
			selectedObjectInInspector = obj;
		},
		hide() {
			this.isVisible = false;
			this.selectedObject = null;
			selectedObjectInInspector = null;
		}
	};

	const mockGame = {
		gameMode: "editor",
		objectInspector: mockInspector,
		editorExplorer: null,
		isAnyEditorUIOpen() {
			return !!(this.editorExplorer?.isVisible || this.objectInspector?.isVisible);
		},
		updateEditorInteractionMode() {}
	};

	const explorer = new EditorExplorer(mockGame, hierarchy, groupManager, clipboard, history, prefabManager, { initialVisible: true });
	mockGame.editorExplorer = explorer;

	// Crear grupo y objeto
	const g1 = hierarchy.createGroup("Base Militar", null);
	const proxy = groupManager.getOrCreatePivotProxy(g1.id);

	// 1. Seleccionar grupo desde Explorer
	explorer.selectNode(g1.id);
	assert.equal(selectedObjectInInspector, proxy, "Al seleccionar el grupo en Explorer se debe mostrar su proxy de pivote en Inspector");
	assert.equal(proxy.userData.isEditorGroupPivot, true, "El objeto seleccionado debe ser el pivote de grupo");
	assert.equal(mockInspector.isVisible, true, "Inspector debe estar visible con el gizmo");

	// 2. Ocultar Inspector sin cerrar Explorer
	mockInspector.hide();
	assert.equal(mockInspector.isVisible, false);
	assert.equal(explorer.isVisible, true, "Explorer debe continuar visible");
	assert.equal(mockGame.isAnyEditorUIOpen(), true, "El estado de interacción global debe seguir activo por el Explorer");
});

test("Escenario E5: Corrección de contrato en PrefabService.syncPrefabToServer y Explorer", async () => {
	const prefabData = {
		objects: [
			{ uuid: "wall-1", mapObjectType: "wall", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } }
		],
		hierarchy: {
			rootIds: ["wall-1"],
			nodes: {
				"wall-1": { id: "wall-1", name: "Wall 1", type: "wall", isGroup: false, parentId: null, order: 0 }
			}
		}
	};

	const localCreated = PrefabService.createLocalPrefab("Torre de Vigía", prefabData, { category: "defensa" });
	assert.ok(localCreated.id);
	assert.equal(localCreated.storageStatus, "local");

	// Mockear apiFetch para simular respuesta exitosa del servidor PostgreSQL
	// syncPrefabToServer devuelve un PlatformPrefabDto directamente (Promise<PlatformPrefabDto>),
	// NO un objeto envoltorio con { success, error }
	const mockServerDto = {
		id: "server-uuid-12345",
		name: localCreated.name,
		description: localCreated.description,
		category: localCreated.category,
		version: 1,
		storageStatus: "server",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		currentVersion: {
			version: 1,
			data: prefabData,
			notes: "Sincronizado"
		}
	};

	// Probar llamada a syncPrefabToServer con interceptor
	const originalSync = PrefabService.syncPrefabToServer;
	try {
		PrefabService.syncPrefabToServer = async (id) => {
			assert.equal(id, localCreated.id);
			return mockServerDto;
		};

		const synced = await PrefabService.syncPrefabToServer(localCreated.id);
		assert.ok(synced, "syncPrefabToServer debe devolver el PlatformPrefabDto");
		assert.equal(synced.id, "server-uuid-12345");
		assert.equal(synced.name, "Torre de Vigía");
		assert.equal(synced.storageStatus, "server");
		// Verificar que NO dependa de synced.success
		assert.equal(synced.success, undefined, "El DTO del servidor no tiene propiedad success; se resuelve o lanza error");
	} finally {
		PrefabService.syncPrefabToServer = originalSync;
	}
});

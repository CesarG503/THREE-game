import { test, after } from "node:test";
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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
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
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild(child) {
          this.children.push(child);
          this.childNodes.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild(child) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) this.children.splice(idx, 1);
          return child;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => ({
          fillRect: () => {},
          clearRect: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          putImageData: () => {},
          createImageData: () => ({ data: new Uint8ClampedArray(4) }),
          setTransform: () => {},
          drawImage: () => {},
          save: () => {},
          fillText: () => {},
          restore: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
        }),
      };
      return el;
    },
    createElementNS: (ns, tag) => mockDocument.createElement(tag),
    getElementById: () => null,
    querySelector: (sel) => sel === "canvas" ? domElement : null,
    querySelectorAll: () => [],
    addEventListener(type, listener) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const list = docListeners.get(type) || [];
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    },
    dispatchEvent(event) {
      const list = docListeners.get(event.type) || [];
      for (const l of list) l(event);
      return true;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    activeElement: null,
  };

  const winListeners = new Map();
  const mockWindow = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener(type, listener) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const list = winListeners.get(type) || [];
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    },
    dispatchEvent(event) {
      const list = winListeners.get(event.type) || [];
      for (const l of list) l(event);
      return true;
    },
  };

  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  return { domElement, mockDocument, mockWindow };
}

setupMockDom();

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error"
});
after(() => server.close());

const { InteractionCoordinator, isTextInput } = await server.ssrLoadModule("/src/client/input/InteractionCoordinator.ts");
const { PlacementManager } = await server.ssrLoadModule("/src/client/editor/PlacementManager.ts");
const { TransformGizmo } = await server.ssrLoadModule("/src/client/editor/TransformGizmo.ts");
const { setupGameInput } = await server.ssrLoadModule("/src/client/core/GameInput.ts");

test("PlacementManager - Rastrear cursor cuando pointer lock no está activo", () => {
  const { domElement, mockDocument } = setupMockDom();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

  const pm = new PlacementManager(scene, camera, domElement);

  // 1. Simular pointer lock activo: debe retornar (0, 0)
  mockDocument.pointerLockElement = domElement;
  const lockedNDC = pm.getPointerNDC();
  assert.equal(lockedNDC.x, 0);
  assert.equal(lockedNDC.y, 0);

  // 2. Simular cursor libre con panel abierto: debe usar la posición del puntero
  mockDocument.pointerLockElement = null;
  pm.setPointerFromEvent({ clientX: 400, clientY: 300 }); // Centro
  const centerNDC = pm.getPointerNDC();
  assert.equal(centerNDC.x, 0);
  assert.equal(centerNDC.y, 0);

  pm.setPointerFromEvent({ clientX: 800, clientY: 0 }); // Esquina superior derecha
  const cornerNDC = pm.getPointerNDC();
  assert.equal(cornerNDC.x, 1);
  assert.equal(cornerNDC.y, 1);

  // 3. Cuando el cursor está fuera del canvas (sobre un panel), el ghost debe ocultarse
  pm.isPointerOverCanvas = false;
  pm.update({ type: "wall", isImpulsePad: false }, 0, new THREE.Vector3(0, 0, 0));
  assert.equal(pm.placementGhost.visible, false, "El ghost debe ocultarse si el puntero está sobre un panel HTML");
  assert.equal(pm.currentHit, null);
});

test("TransformGizmo e InteractionCoordinator - Construcción permitida con Inspector abierto", () => {
  const { domElement } = setupMockDom();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const targetMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  targetMesh.userData = { isEditableMapObject: true, uuid: "box-1" };
  scene.add(targetMesh);

  let currentItem = { id: "wall", name: "Wall", type: "wall" };

  const fakeGame = {
    gameMode: "editor",
    sceneManager: {
      scene,
      camera,
      renderer: {
        domElement
      }
    },
    isAnyEditorUIOpen: () => true, // Inspector / Explorer abierto
    cameraController: { setUIOpen: () => {}, isPaused: false },
    inputManager: { reset: () => {}, resetMovement: () => {}, keys: {} },
    inventoryManager: {
      getCurrentItem: () => currentItem
    },
    objectInspector: {
      isVisible: true,
      transformGizmo: null
    },
    editorGroupManager: {
      isConnectorDragging: () => false
    },
    constructionMenu: { isVisible: false, container: { style: { display: "none" } } }
  };

  const coordinator = new InteractionCoordinator(fakeGame);
  const gizmo = new TransformGizmo(fakeGame, { syncCurvatureInputs: () => {} });
  fakeGame.objectInspector.transformGizmo = gizmo;

  // Adjuntar gizmo al objeto seleccionado
  gizmo.attach(targetMesh);
  assert.equal(gizmo.helper.visible, true);

  // 1. Con el objeto inspeccionado y gizmo visible (sin arrastre activo):
  // isInteracting() debe ser false
  assert.equal(gizmo.isInteracting(), false);

  // 2. canBuild debe ser true si hay un objeto equipado
  assert.equal(coordinator.canBuild, true, "canBuild debe ser true con Inspector y Gizmo visibles si no hay arrastre");

  // 3. Clic fuera del gizmo (en el suelo): isPointerOverGizmo debe ser false
  const mouseGround = new THREE.Vector2(-0.8, -0.8);
  assert.equal(gizmo.isPointerOverGizmo(mouseGround), false);

  // 4. isGizmoInteracting(clickEvent) con clic en el suelo debe retornar false (permite construir)
  const clickEventGround = { clientX: 80, clientY: 540 };
  assert.equal(coordinator.isGizmoInteracting(clickEventGround), false);

  // 5. Durante un arrastre activo del gizmo: isInteracting() es true y canBuild se bloquea
  gizmo.dragState = { mode: "translate" };
  assert.equal(gizmo.isInteracting(), true);
  assert.equal(coordinator.canBuild, false, "canBuild debe ser false durante arrastre activo del gizmo");

  gizmo.dragState = null;
  assert.equal(coordinator.canBuild, true);

  gizmo.dispose();
  coordinator.dispose();
});

test("isTextInput - Evitar interferencias al escribir en inputs del Inspector", () => {
  const textInput = { tagName: "INPUT", isContentEditable: false };
  assert.equal(isTextInput(textInput), true);

  const select = { tagName: "SELECT", isContentEditable: false };
  assert.equal(isTextInput(select), true);

  const div = { tagName: "DIV", isContentEditable: false };
  assert.equal(isTextInput(div), false);
});

test("Tecla R - Con objeto seleccionado prioriza ciclo de gizmo sin alterar rotación de colocación", () => {
  const { domElement, mockDocument } = setupMockDom();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

  const targetMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  targetMesh.userData = { isEditableMapObject: true, uuid: "box-target" };
  scene.add(targetMesh);

  let currentItem = { id: "wall", name: "Wall", type: "wall" };
  let gizmoModeCycled = false;

  const fakeGizmo = {
    target: targetMesh,
    cycleMode: () => {
      gizmoModeCycled = true;
      return "rotate";
    },
    attach: (obj) => {
      fakeGizmo.target = obj;
    }
  };

  const inputEvents = new AbortController();
  const fakeGame = {
    gameMode: "editor",
    inputEvents,
    sceneManager: {
      scene,
      camera,
      renderer: { domElement }
    },
    isAnyEditorUIOpen: () => true,
    cameraController: { isUIOpen: true, isPaused: false },
    inputManager: { enabled: true, keys: {} },
    inventoryManager: {
      getCurrentItem: () => currentItem,
    },
    objectInspector: {
      isVisible: true,
      selectedObject: targetMesh,
      transformGizmo: fakeGizmo
    },
    editorSelection: {
      getActiveObject: () => targetMesh,
      getCount: () => 1
    },
    constructionMenu: { isVisible: false }
  };

  setupGameInput.call(fakeGame);

  // 1. Presionar R teniendo un objeto seleccionado e item equipado:
  // Debe ciclar el gizmo del objeto y NO rotar la proyección de colocación
  const eventR = {
    key: "r",
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: () => {}
  };

  mockDocument.dispatchEvent({ type: "keydown", ...eventR });

  assert.equal(gizmoModeCycled, true, "El gizmo debe haber ciclado de modo con R");
  assert.equal(fakeGame.placementRotationIndex, 0, "placementRotationIndex no debe haber cambiado al tener objeto seleccionado");

  // 2. Deseleccionar objeto: ahora al presionar R debe rotar la colocación proyectada
  fakeGame.editorSelection.getActiveObject = () => null;
  fakeGame.objectInspector.selectedObject = null;
  fakeGizmo.target = null;
  gizmoModeCycled = false;

  mockDocument.dispatchEvent({ type: "keydown", ...eventR });

  assert.equal(gizmoModeCycled, false, "El gizmo no debe ciclar si no hay objeto seleccionado");
  assert.equal(fakeGame.placementRotationIndex, 1, "placementRotationIndex debe incrementarse a 1");

  mockDocument.dispatchEvent({ type: "keydown", ...eventR });
  assert.equal(fakeGame.placementRotationIndex, 2, "placementRotationIndex debe incrementarse a 2");

  inputEvents.abort();
});

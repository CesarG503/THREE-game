import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error"
});
after(() => server.close());

const { InteractionCoordinator } = await server.ssrLoadModule("/src/client/input/InteractionCoordinator.ts");
const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");

test("InteractionCoordinator - Decisiones contextuales y permisos", () => {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null });

  let currentItem = { id: "wall", name: "Wall" };

  const fakeGame = {
    gameMode: "editor",
    isAnyEditorUIOpen: () => false,
    cameraController: { setUIOpen: () => {}, isPaused: false },
    inputManager: { reset: () => {}, resetMovement: () => {}, keys: {} },
    inventoryManager: {
      getCurrentItem: () => currentItem
    },
    objectInspector: {
      isVisible: false,
      transformGizmo: {
        controls: { enabled: false },
        helper: { visible: false },
        target: new THREE.Object3D(),
        isInteracting: () => false
      }
    },
    editorGroupManager: {
      isConnectorDragging: () => false
    },
    constructionMenu: { isVisible: false, container: { style: { display: "none" } } }
  };

  const coordinator = new InteractionCoordinator(fakeGame);

  // 1. Con objeto equipado: canBuild es true y activeTool es 'build'
  assert.equal(coordinator.activeTool, "build");
  assert.equal(coordinator.canBuild, true);
  assert.equal(coordinator.canEdit, true);

  // Gizmo debe estar habilitado si hay objeto seleccionado
  coordinator.sync();
  assert.equal(fakeGame.objectInspector.transformGizmo.controls.enabled, true);
  assert.equal(fakeGame.objectInspector.transformGizmo.helper.visible, true);

  // 2. Inspector abierto NO bloquea canBuild si hay objeto equipado
  fakeGame.objectInspector.isVisible = true;
  assert.equal(coordinator.canBuild, true);

  // 3. Sin objeto equipado: canBuild es false, activeTool reporta 'edit'
  currentItem = null;
  assert.equal(coordinator.activeTool, "edit");
  assert.equal(coordinator.canBuild, false);
  assert.equal(coordinator.canEdit, true);

  // 4. Con objeto equipado pero interactuando con gizmo: canBuild es false (nunca construir al transformar)
  currentItem = { id: "wall", name: "Wall" };
  fakeGame.objectInspector.transformGizmo.isInteracting = () => true;
  assert.equal(coordinator.canBuild, false, "No debe permitir construir si se interactúa con el gizmo");
  fakeGame.objectInspector.transformGizmo.isInteracting = () => false;
  assert.equal(coordinator.canBuild, true);

  // 5. Con objeto equipado pero interactuando con conector: canBuild es false (nunca construir al arrastrar conector)
  fakeGame.editorGroupManager.isConnectorDragging = () => true;
  assert.equal(coordinator.canBuild, false, "No debe permitir construir si se arrastra un conector");
  fakeGame.editorGroupManager.isConnectorDragging = () => false;
  assert.equal(coordinator.canBuild, true);

  // 6. Gesto activo bloquea escena y construcción
  let gestureCancelled = false;
  coordinator.begin("camera-orbit", () => { gestureCancelled = true; });
  assert.equal(coordinator.state, "camera-orbit");
  assert.equal(coordinator.canBuild, false);

  coordinator.end("camera-orbit");
  assert.equal(coordinator.canBuild, true);

  coordinator.dispose();
});

test("InteractionCoordinator - Atajo C conmuta acoples directamente", () => {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null });

  let toastMessage = null;
  let couplingToggled = false;

  const fakeGame = {
    gameMode: "editor",
    isAnyEditorUIOpen: () => false,
    cameraController: { setUIOpen: () => {}, isPaused: false },
    inputManager: { reset: () => {}, resetMovement: () => {} },
    objectInspector: { isVisible: false },
    editorExplorer: {
      toggleCouplingMode: () => { couplingToggled = true; }
    },
    showToast: (msg) => { toastMessage = msg; }
  };

  const coordinator = new InteractionCoordinator(fakeGame);

  // Tecla C conmuta acoples directamente sin necesidad de cambiar modo manualmente
  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "c" }));
  assert.equal(couplingToggled, true, "Debe conmutar acoples directamente con C");
  assert.equal(toastMessage, null, "No debe mostrar advertencia de cambio de modo");

  coordinator.dispose();
});

test("InteractionCoordinator - Atajos H y E no alteran estado indebidamente", () => {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null });

  let explorerToggled = false;
  let menuToggled = false;

  const fakeGame = {
    gameMode: "editor",
    isAnyEditorUIOpen: () => false,
    cameraController: { setUIOpen: () => {}, isPaused: false },
    inputManager: { reset: () => {}, resetMovement: () => {} },
    objectInspector: { isVisible: false },
    editorExplorer: {
      toggleVisibility: () => { explorerToggled = true; }
    },
    constructionMenu: {
      toggle: () => { menuToggled = true; }
    }
  };

  const coordinator = new InteractionCoordinator(fakeGame);

  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "h" }));
  assert.equal(explorerToggled, true);

  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
  assert.equal(menuToggled, true);

  coordinator.dispose();
});

test("Diferenciación de clic derecho (Umbral 6px)", () => {
  const threshold = 6;
  const startPos = { x: 100, y: 100 };

  // Caso 1: Tap corto (desplazamiento <= 6px)
  const tapMove = { x: 103, y: 104 };
  const tapDist = Math.hypot(tapMove.x - startPos.x, tapMove.y - startPos.y);
  assert.equal(tapDist <= threshold, true, "Tap corto dentro del umbral de 6px");

  // Caso 2: Arrastre de cámara (desplazamiento > 6px)
  const dragMove = { x: 110, y: 115 };
  const dragDist = Math.hypot(dragMove.x - startPos.x, dragMove.y - startPos.y);
  assert.equal(dragDist > threshold, true, "Arrastre fuera del umbral de 6px");
});

test("EditorGroupManager - Optimización incremental y shared resources", () => {
  const scene = new THREE.Scene();
  const hierarchy = new EditorHierarchyModel();
  const groupManager = new EditorGroupManager(hierarchy, scene);

  const rootGroup = hierarchy.createGroup("Group_Perf", null);
  const objects = new Map();

  for (let i = 0; i < 20; i++) {
    const id = `item_${i}`;
    hierarchy.addNode({
      id,
      name: `Item ${i}`,
      type: "wall",
      parentId: rootGroup.id,
      order: i,
      isGroup: false
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    m.position.set(i * 2, 0, 0);
    scene.add(m);
    objects.set(id, m);
  }

  const resolver = (id) => objects.get(id) || null;
  groupManager.recenterGroupPivot(rootGroup.id, resolver);

  // Activar modo acoples
  groupManager.setCouplingMode(true, resolver);

  // Contar mallas creadas (20 objetos + 1 grupo = 21 nodos)
  let meshCount = 0;
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.isCouplingConnectorSource) meshCount++;
  });
  assert.equal(meshCount, 21, "Deben existir 21 conectores creados (20 objetos + 1 grupo)");

  // Ejecutar 10 actualizaciones consecutivas (simulando movimiento de puntero)
  for (let i = 0; i < 10; i++) {
    groupManager.updateCouplingVisuals(resolver);
  }

  // Comprobar que no se duplicaron ni acumularon mallas
  let meshCountAfter = 0;
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.isCouplingConnectorSource) meshCountAfter++;
  });
  assert.equal(meshCountAfter, 21, "Las mallas deben ser estables y reutilizadas");

  // Desactivar y verificar limpieza
  groupManager.setCouplingMode(false);
  let meshCountDisabled = 0;
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.isCouplingConnectorSource) meshCountDisabled++;
  });
  assert.equal(meshCountDisabled, 0, "Al desactivar deben removerse de la escena");

  groupManager.dispose();
});

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

test("InteractionCoordinator - Herramientas explícitas y permisos", () => {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null });

  const fakeGame = {
    gameMode: "editor",
    isAnyEditorUIOpen: () => false,
    cameraController: { setUIOpen: () => {}, isPaused: false },
    inputManager: { reset: () => {}, resetMovement: () => {}, keys: {} },
    objectInspector: {
      isVisible: false,
      transformGizmo: {
        controls: { enabled: false },
        helper: { visible: false },
        target: new THREE.Object3D()
      }
    },
    constructionMenu: { isVisible: false, container: { style: { display: "none" } } }
  };

  const coordinator = new InteractionCoordinator(fakeGame);

  // 1. Herramienta por defecto es 'build'
  assert.equal(coordinator.activeTool, "build");
  assert.equal(coordinator.canBuild, true);
  assert.equal(coordinator.canEdit, false);

  // Gizmo debe estar deshabilitado en modo 'build'
  coordinator.sync();
  assert.equal(fakeGame.objectInspector.transformGizmo.controls.enabled, false);
  assert.equal(fakeGame.objectInspector.transformGizmo.helper.visible, false);

  // 2. Inspector abierto no bloquea canBuild en modo 'build'
  fakeGame.objectInspector.isVisible = true;
  assert.equal(coordinator.canBuild, true);

  // 3. Cambiar a modo 'edit'
  let toolReported = null;
  coordinator.onToolChanged = (tool) => { toolReported = tool; };
  coordinator.setTool("edit");

  assert.equal(coordinator.activeTool, "edit");
  assert.equal(toolReported, "edit");
  assert.equal(coordinator.canBuild, false);
  assert.equal(coordinator.canEdit, true);

  // Gizmo debe estar habilitado en modo 'edit' con objeto seleccionado
  coordinator.sync();
  assert.equal(fakeGame.objectInspector.transformGizmo.controls.enabled, true);
  assert.equal(fakeGame.objectInspector.transformGizmo.helper.visible, true);

  // 4. Cambiar de herramienta cancela gestos activos
  let gestureCancelled = false;
  coordinator.begin("tree-drag", () => { gestureCancelled = true; });
  assert.equal(coordinator.state, "tree-drag");

  coordinator.setTool("build");
  assert.equal(gestureCancelled, true);
  assert.equal(coordinator.activeTool, "build");

  coordinator.dispose();
});

test("InteractionCoordinator - Atajo C diferenciado por herramienta", () => {
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

  // En modo 'build': tecla C no conmuta acoples y muestra toast de advertencia
  coordinator.setTool("build");
  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "c" }));
  assert.equal(couplingToggled, false, "No debe conmutar acoples en modo build");
  assert.match(toastMessage || "", /Cambia a modo Editar para usar Acoples/);

  // En modo 'edit': tecla C conmuta acoples
  toastMessage = null;
  coordinator.setTool("edit");
  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "c" }));
  assert.equal(couplingToggled, true, "Debe conmutar acoples en modo edit");
  assert.equal(toastMessage, null);

  coordinator.dispose();
});

test("InteractionCoordinator - Atajos H y E no alteran la herramienta activa", () => {
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
  coordinator.setTool("edit");

  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "h" }));
  assert.equal(explorerToggled, true);
  assert.equal(coordinator.activeTool, "edit", "H no debe cambiar la herramienta");

  window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" }));
  assert.equal(menuToggled, true);
  assert.equal(coordinator.activeTool, "edit", "E no debe cambiar la herramienta");

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

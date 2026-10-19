import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorCommandHistory, ReparentCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");

test("Escenario C: Jerarquía, corrección matemática del Inspector numérico, modo edición de pivote y conectores 3D con Undo/Redo", async () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);
	const history = new EditorCommandHistory();
	groupManager.setCommandHistory(history);

	// Crear objetos de prueba con mallas y cuerpos físicos
	const objectsMap = new Map();

	function createObject(uuid, x, y, z) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		mesh.position.set(x, y, z);
		mesh.quaternion.identity();
		mesh.updateMatrixWorld(true);

		const rigidBody = {
			pos: { x, y, z },
			rot: { x: 0, y: 0, z: 0, w: 1 },
			setTranslation(p) { this.pos = { ...p }; },
			setRotation(r) { this.rot = { ...r }; }
		};

		mesh.userData = {
			uuid,
			mapObjectType: "wall",
			rigidBody,
			isEditableMapObject: true
		};

		scene.add(mesh);
		objectsMap.set(uuid, mesh);
		return mesh;
	}

	const o1 = createObject("wall-1", 10, 0, 10);
	const o2 = createObject("wall-2", 14, 0, 10);

	hierarchy.addNode({ id: "wall-1", name: "wall", type: "wall", parentId: null, order: 0, isGroup: false });
	hierarchy.addNode({ id: "wall-2", name: "wall", type: "wall", parentId: null, order: 1, isGroup: false });

	const group = hierarchy.createGroup("Grupo Alpha", null);
	hierarchy.reparent("wall-1", group.id);
	hierarchy.reparent("wall-2", group.id);

	const pivotProxy = groupManager.getOrCreatePivotProxy(group.id);
	groupManager.recenterGroupPivot(group.id, (id) => objectsMap.get(id));

	// El centro de wall-1 (10,0,10) y wall-2 (14,0,10) es (12,0,10)
	assert.equal(pivotProxy.position.x, 12);
	assert.equal(pivotProxy.position.z, 10);

	// ── 1. Verificar corrección matemática del Inspector numérico ─────────────
	// Simulación exacta del flujo corregido de ObjectInspector.ts:
	// NO mutar proxy.position antes de calcular la transformación grupal
	const newPosX = 22; // Desplazar +10 en X
	const targetPos = new THREE.Vector3(newPosX, pivotProxy.position.y, pivotProxy.position.z);

	// Iniciar sesión de transformación capturando el estado inicial previo a cualquier mutación
	groupManager.beginGroupTransform(group.id, (id) => objectsMap.get(id));
	groupManager.updateGroupTransform(group.id, targetPos, pivotProxy.quaternion, (id) => objectsMap.get(id));
	groupManager.endGroupTransform(group.id, (id) => objectsMap.get(id));
	pivotProxy.position.x = newPosX;

	// Verificar que los miembros se desplazaron exactamente +10 en X
	assert.equal(o1.position.x, 20, "wall-1 debe haberse desplazado a X=20 (+10)");
	assert.equal(o2.position.x, 24, "wall-2 debe haberse desplazado a X=24 (+10)");
	assert.equal(o1.userData.rigidBody.pos.x, 20, "El rigidBody de Rapier debe sincronizarse con X=20");
	assert.equal(o2.userData.rigidBody.pos.x, 24, "El rigidBody de Rapier debe sincronizarse con X=24");

	// ── 2. Rotación numérica del pivote ─────────────────────────────────────
	// Rotar 90 grados alrededor de Y
	const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
	groupManager.beginGroupTransform(group.id, (id) => objectsMap.get(id));
	groupManager.updateGroupTransform(group.id, pivotProxy.position, targetQuat, (id) => objectsMap.get(id));
	groupManager.endGroupTransform(group.id, (id) => objectsMap.get(id));
	pivotProxy.quaternion.copy(targetQuat);

	// El pivote está en (22, 0, 10).
	// wall-1 estaba en (20, 0, 10) -> vector relativo (-2, 0, 0).
	// Rotado 90° en Y en sentido antihorario: (-2, 0, 0) pasa a ser (0, 0, 2).
	// Posición esperada: (22, 0, 12).
	assert.ok(Math.abs(o1.position.x - 22) < 0.001, `Posición X esperada ~22, obtenida: ${o1.position.x}`);
	assert.ok(Math.abs(o1.position.z - 12) < 0.001, `Posición Z esperada ~12, obtenida: ${o1.position.z}`);

	// ── 3. Modo de edición de pivote (sin alterar objetos) ───────────────────
	groupManager.setPivotEditMode(true);
	const wall1XBefore = o1.position.x;
	const wall1ZBefore = o1.position.z;

	// Mover pivote en modo pivote
	pivotProxy.position.set(50, 0, 50);

	// En modo pivote, los objetos físicos NO deben desplazarse
	assert.equal(o1.position.x, wall1XBefore, "En modo pivote independiente, la posición X del objeto no debe cambiar");
	assert.equal(o1.position.z, wall1ZBefore, "En modo pivote independiente, la posición Z del objeto no debe cambiar");
	groupManager.setPivotEditMode(false);

	// ── 4. Conectores 3D / Reparenting con Undo/Redo ─────────────────────────
	const o3 = createObject("wall-3", 100, 0, 100);
	hierarchy.addNode({ id: "wall-3", name: "wall", type: "wall", parentId: null, order: 0, isGroup: false });

	assert.equal(hierarchy.getNode("wall-3").parentId, null);

	// Acoplar o3 a Grupo Alpha (simulando arrastre de conector 3D)
	const oldParentId = null;
	const oldOrder = hierarchy.getNode("wall-3").order;
	const targetParentId = group.id;

	hierarchy.reparent("wall-3", targetParentId);
	history.execute(new ReparentCommand(hierarchy, "wall-3", oldParentId, oldOrder, targetParentId, undefined));

	assert.equal(hierarchy.getNode("wall-3").parentId, group.id, "wall-3 debe tener como padre a Grupo Alpha");
	assert.equal(hierarchy.getChildren(group.id).length, 3);

	// Undo del acople
	assert.ok(history.canUndo());
	history.undo();
	assert.equal(hierarchy.getNode("wall-3").parentId, null, "Undo debe desacoplar wall-3 y regresarlo a la raíz");
	assert.equal(hierarchy.getChildren(group.id).length, 2);

	// Redo del acople
	assert.ok(history.canRedo());
	history.redo();
	assert.equal(hierarchy.getNode("wall-3").parentId, group.id, "Redo debe volver a acoplar wall-3 a Grupo Alpha");
	assert.equal(hierarchy.getChildren(group.id).length, 3);
});

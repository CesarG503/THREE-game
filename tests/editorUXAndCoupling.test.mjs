import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { EditorCommandHistory, ReparentCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");

test("Validación UX 1: Crear tres grupos consecutivos y comprobar que ninguno se anida accidentalmente", () => {
	const hierarchy = new EditorHierarchyModel();

	// Creación consecutiva de 3 grupos en la raíz
	const g1 = hierarchy.createGroup("Grupo 1", null);
	const g2 = hierarchy.createGroup("Grupo 2", null);
	const g3 = hierarchy.createGroup("Grupo 3", null);

	assert.equal(g1.parentId, null, "Grupo 1 debe estar en la raíz");
	assert.equal(g2.parentId, null, "Grupo 2 debe estar en la raíz sin anidarse en Grupo 1");
	assert.equal(g3.parentId, null, "Grupo 3 debe estar en la raíz sin anidarse en Grupo 2");

	const rootChildren = hierarchy.getChildren(null);
	assert.equal(rootChildren.length, 3, "Los 3 grupos deben ser hermanos en el nivel raíz");
	assert.deepEqual(rootChildren.map(c => c.id), [g1.id, g2.id, g3.id]);

	// Crear subgrupo explícito dentro de Grupo 1
	const subG = hierarchy.createGroup("Subgrupo A", g1.id);
	assert.equal(subG.parentId, g1.id, "El subgrupo explícito debe tener como padre a Grupo 1");
	assert.equal(hierarchy.getChildren(g1.id).length, 1);
});

test("Validación UX 2: Registro automático de objetos nuevos y Drag-and-Drop con Undo/Redo", () => {
	const hierarchy = new EditorHierarchyModel();
	const history = new EditorCommandHistory();

	const groupA = hierarchy.createGroup("Grupo A", null);
	assert.equal(hierarchy.getChildren(null).length, 1);

	// Simulación del registro automático de una pared al colocarse en la escena
	const wallNode = hierarchy.addNode({
		id: "wall-new-uuid",
		name: "Pared Frontal",
		type: "wall",
		parentId: null,
		order: hierarchy.getChildren(null).length,
		isGroup: false,
		customName: "Pared Frontal"
	});

	assert.ok(hierarchy.hasNode("wall-new-uuid"));
	assert.equal(wallNode.parentId, null);
	assert.equal(hierarchy.getChildren(null).length, 2);

	// Arrastrar la pared dentro de Grupo A (Drag & Drop en Explorer)
	const canReparent = hierarchy.canReparent(wallNode.id, groupA.id);
	assert.equal(canReparent.allowed, true);

	const reparentCmd = new ReparentCommand(
		hierarchy,
		wallNode.id,
		wallNode.parentId,
		wallNode.order,
		groupA.id,
		undefined
	);

	history.execute(reparentCmd);
	assert.equal(hierarchy.getNode("wall-new-uuid")?.parentId, groupA.id, "La pared debe pertenecer a Grupo A");
	assert.equal(hierarchy.getChildren(groupA.id).length, 1);
	assert.equal(hierarchy.getChildren(null).length, 1);

	// Deshacer el arrastre (Undo)
	history.undo();
	assert.equal(hierarchy.getNode("wall-new-uuid")?.parentId, null, "Undo debe devolver la pared a la raíz");
	assert.equal(hierarchy.getChildren(null).length, 2);

	// Rehacer el arrastre (Redo)
	history.redo();
	assert.equal(hierarchy.getNode("wall-new-uuid")?.parentId, groupA.id, "Redo debe colocar la pared en Grupo A");
	assert.equal(hierarchy.getChildren(groupA.id).length, 1);
});

test("Validación UX 3: Transformación grupal con session math, sincronización de colliders y persistencia", () => {
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);

	const group = hierarchy.createGroup("Grupo Castillo", null);

	// Crear dos objetos en la escena con RigidBodies de Rapier simulados
	const wallObj = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
	wallObj.position.set(0, 0, 0);
	wallObj.quaternion.identity();
	wallObj.updateMatrixWorld(true);

	const towerObj = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6));
	towerObj.position.set(4, 0, 0);
	towerObj.quaternion.identity();
	towerObj.updateMatrixWorld(true);

	const mockBodies = {
		wall: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0, w: 1 } },
		tower: { pos: { x: 4, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0, w: 1 } }
	};

	wallObj.userData = {
		uuid: "wall-1",
		isEditableMapObject: true,
		mapObjectType: "wall",
		rigidBody: {
			setTranslation(p) { mockBodies.wall.pos = { ...p }; },
			setRotation(q) { mockBodies.wall.rot = { ...q }; }
		}
	};

	towerObj.userData = {
		uuid: "tower-1",
		isEditableMapObject: true,
		mapObjectType: "pillar",
		rigidBody: {
			setTranslation(p) { mockBodies.tower.pos = { ...p }; },
			setRotation(q) { mockBodies.tower.rot = { ...q }; }
		}
	};

	hierarchy.addNode({ id: "wall-1", name: "Wall", type: "wall", parentId: group.id, order: 0, isGroup: false });
	hierarchy.addNode({ id: "tower-1", name: "Tower", type: "pillar", parentId: group.id, order: 1, isGroup: false });

	const objects = new Map([["wall-1", wallObj], ["tower-1", towerObj]]);
	const resolver = (id) => objects.get(id) || null;

	// Recalcular pivote central (debe ser (2, 0, 0))
	const center = groupManager.recenterGroupPivot(group.id, resolver);
	assert.equal(center.x, 2);

	// 1. Iniciar sesión de transformación
	groupManager.beginGroupTransform(group.id, resolver);

	// 2. Mover el grupo +10 en X y +5 en Y
	const targetPos = new THREE.Vector3(12, 5, 0);
	const targetQuat = new THREE.Quaternion();

	groupManager.updateGroupTransform(group.id, targetPos, targetQuat, resolver, (obj) => {
		if (obj.userData?.rigidBody) {
			obj.userData.rigidBody.setTranslation(obj.position);
			obj.userData.rigidBody.setRotation(obj.quaternion);
		}
	});

	// Finalizar sesión de arrastre
	groupManager.endGroupTransform(group.id);

	// Comprobar que los objetos y sus cuerpos físicos se desplazaron en bloque
	assert.ok(Math.abs(wallObj.position.x - 10) < 0.001);
	assert.ok(Math.abs(wallObj.position.y - 5) < 0.001);
	assert.ok(Math.abs(towerObj.position.x - 14) < 0.001);
	assert.ok(Math.abs(towerObj.position.y - 5) < 0.001);

	assert.equal(mockBodies.wall.pos.x, wallObj.position.x);
	assert.equal(mockBodies.tower.pos.x, towerObj.position.x);

	// Comprobar que limpiar proxies destruye los proxies sin dejar referencias colgantes
	groupManager.clearProxies();
	assert.equal(scene.children.filter(c => c.name.startsWith("GroupPivot_")).length, 0);

	// Recrear proxies limpiamente
	const restoredProxy = groupManager.getOrCreatePivotProxy(group.id);
	assert.ok(restoredProxy);
	assert.ok(scene.children.includes(restoredProxy));
});

test("Validación UX 4: Detección y rechazo de ciclos jerárquicos", () => {
	const hierarchy = new EditorHierarchyModel();

	const rootG = hierarchy.createGroup("Raiz", null);
	const midG = hierarchy.createGroup("Medio", rootG.id);
	const leafG = hierarchy.createGroup("Hoja", midG.id);

	// Intentar hacer que Raiz sea hijo de Hoja (debe ser rechazado por ciclo)
	const cycleCheck = hierarchy.canReparent(rootG.id, leafG.id);
	assert.equal(cycleCheck.allowed, false);
	assert.match(cycleCheck.reason, /ciclo/i);

	// Intentar que un nodo sea su propio padre
	const selfCheck = hierarchy.canReparent(midG.id, midG.id);
	assert.equal(selfCheck.allowed, false);

	// Reparentar a un padre no grupo
	hierarchy.addNode({ id: "obj-leaf", name: "Objeto", type: "cube", parentId: null, order: 0, isGroup: false });
	const nonGroupCheck = hierarchy.canReparent(rootG.id, "obj-leaf");
	assert.equal(nonGroupCheck.allowed, false);
});

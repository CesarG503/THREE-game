import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");

test("EditorGroupManager - Traslación y rotación rígida grupal", () => {
  const scene = new THREE.Scene();
  const hierarchy = new EditorHierarchyModel();
  const groupManager = new EditorGroupManager(hierarchy, scene);

  // Crear dos objetos en la escena
  const objA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objA.position.set(10, 0, 0);
  const objB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objB.position.set(20, 0, 0);

  const objects = new Map([["objA", objA], ["objB", objB]]);
  const resolver = (id) => objects.get(id) || null;

  hierarchy.addNode({ id: "objA", name: "A", type: "box", parentId: null, order: 0, isGroup: false });
  hierarchy.addNode({ id: "objB", name: "B", type: "box", parentId: null, order: 1, isGroup: false });

  // Agruparlos
  const group = hierarchy.groupObjects(["objA", "objB"], "MiGrupo");
  const center = groupManager.recenterGroupPivot(group.id, resolver);

  // Centro debe ser (15, 0, 0)
  assert.equal(center.x, 15);
  assert.equal(center.y, 0);
  assert.equal(center.z, 0);

  // Mover el pivote del grupo 5 unidades en Y
  const newPivotPos = new THREE.Vector3(15, 5, 0);
  const newPivotQuat = new THREE.Quaternion();
  groupManager.applyGroupTransform(group.id, newPivotPos, newPivotQuat, resolver);

  // Ambos objetos deben haber subido 5 unidades en Y conservando su delta en X
  assert.ok(Math.abs(objA.position.x - 10) < 0.001);
  assert.ok(Math.abs(objA.position.y - 5) < 0.001);
  assert.ok(Math.abs(objB.position.x - 20) < 0.001);
  assert.ok(Math.abs(objB.position.y - 5) < 0.001);

  // Rotar el grupo 90 grados alrededor del eje Z (en su pivote 15, 5, 0)
  const rot90Z = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  groupManager.applyGroupTransform(group.id, newPivotPos, rot90Z, resolver);

  // objA estaba en (10, 5, 0), que es offset (-5, 0, 0) respecto al pivote (15, 5, 0).
  // Rotado 90 deg en Z: offset (-5, 0) -> (0, -5). Posición final: (15, 0, 0).
  assert.ok(Math.abs(objA.position.x - 15) < 0.01, `objA.x fue ${objA.position.x}`);
  assert.ok(Math.abs(objA.position.y - 0) < 0.01, `objA.y fue ${objA.position.y}`);

  // objB estaba en offset (+5, 0, 0). Rotado 90 deg -> (0, +5). Posición final: (15, 10, 0).
  assert.ok(Math.abs(objB.position.x - 15) < 0.01, `objB.x fue ${objB.position.x}`);
  assert.ok(Math.abs(objB.position.y - 10) < 0.01, `objB.y fue ${objB.position.y}`);
});

test("EditorGroupManager - Modo de edición de pivote (sin alterar objetos)", () => {
  const scene = new THREE.Scene();
  const hierarchy = new EditorHierarchyModel();
  const groupManager = new EditorGroupManager(hierarchy, scene);

  const obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  obj.position.set(5, 5, 5);
  const resolver = (id) => (id === "obj" ? obj : null);

  hierarchy.addNode({ id: "obj", name: "O", type: "box", parentId: null, order: 0, isGroup: false });
  const group = hierarchy.groupObjects(["obj"], "G");
  groupManager.recenterGroupPivot(group.id, resolver);

  // Activar modo edición de pivote
  groupManager.setPivotEditMode(true);

  // Mover el pivote a otra coordenada (100, 100, 100)
  groupManager.applyGroupTransform(group.id, new THREE.Vector3(100, 100, 100), new THREE.Quaternion(), resolver);

  // El objeto NO debe haberse movido
  assert.equal(obj.position.x, 5);
  assert.equal(obj.position.y, 5);
  assert.equal(obj.position.z, 5);

  // El proxy sí cambió
  const proxy = groupManager.getOrCreatePivotProxy(group.id);
  assert.equal(proxy.position.x, 100);
});

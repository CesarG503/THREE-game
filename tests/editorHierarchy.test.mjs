import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel, HierarchyNode } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");

test("EditorHierarchyModel - Crea nodos y grupos individuales", () => {
  const model = new EditorHierarchyModel();
  const obj1 = model.addNode({
    id: "obj-1",
    name: "Muro 1",
    type: "wall",
    parentId: null,
    order: 0,
    isGroup: false,
    customName: "Muro de Entrada"
  });

  assert.equal(obj1.id, "obj-1");
  assert.equal(obj1.customName, "Muro de Entrada");
  assert.equal(model.getChildren(null).length, 1);

  const group = model.createGroup("Casa", null, "grp-1");
  assert.equal(group.isGroup, true);
  assert.equal(group.name, "Casa");
  assert.equal(model.getChildren(null).length, 2);
});

test("EditorHierarchyModel - Reparenting y validación contra ciclos", () => {
  const model = new EditorHierarchyModel();
  const rootGroup = model.createGroup("Raiz", null, "grp-root");
  const subGroup = model.createGroup("Subgrupo", "grp-root", "grp-sub");
  const leafGroup = model.createGroup("Hoja", "grp-sub", "grp-leaf");
  const obj = model.addNode({ id: "obj-1", name: "Pared", type: "wall", parentId: "grp-leaf", order: 0, isGroup: false });

  // Comprobar que subGroup es hijo de rootGroup
  assert.equal(subGroup.parentId, "grp-root");
  assert.equal(leafGroup.parentId, "grp-sub");
  assert.equal(obj.parentId, "grp-leaf");

  // Intento de ciclo: hacer que grp-root sea hijo de grp-leaf (descendiente)
  const cycleAttempt = model.canReparent("grp-root", "grp-leaf");
  assert.equal(cycleAttempt.allowed, false);
  assert.match(cycleAttempt.reason, /ciclo detectado/);

  // Intento de ser su propio padre
  const selfParent = model.canReparent("grp-root", "grp-root");
  assert.equal(selfParent.allowed, false);

  // Intento de asignar a un objeto que no es grupo
  const nonGroupParent = model.canReparent("grp-root", "obj-1");
  assert.equal(nonGroupParent.allowed, false);
  assert.match(nonGroupParent.reason, /no es un grupo/);

  // Mover obj a rootGroup directamente
  const validMove = model.reparent("obj-1", "grp-root");
  assert.equal(validMove, true);
  assert.equal(model.getNode("obj-1").parentId, "grp-root");
});

test("EditorHierarchyModel - Agrupar y desagrupar objetos", () => {
  const model = new EditorHierarchyModel();
  model.addNode({ id: "a", name: "A", type: "box", parentId: null, order: 0, isGroup: false });
  model.addNode({ id: "b", name: "B", type: "box", parentId: null, order: 1, isGroup: false });
  model.addNode({ id: "c", name: "C", type: "box", parentId: null, order: 2, isGroup: false });

  const group = model.groupObjects(["a", "b"], "Grupo AB");
  assert.equal(group.isGroup, true);
  assert.equal(model.getNode("a").parentId, group.id);
  assert.equal(model.getNode("b").parentId, group.id);
  assert.equal(model.getNode("c").parentId, null);

  const children = model.getChildren(group.id);
  assert.equal(children.length, 2);
  assert.equal(children[0].id, "a");
  assert.equal(children[1].id, "b");

  // Desagrupar
  const moved = model.ungroup(group.id);
  assert.deepEqual(moved, ["a", "b"]);
  assert.equal(model.hasNode(group.id), false);
  assert.equal(model.getNode("a").parentId, null);
  assert.equal(model.getNode("b").parentId, null);
});

test("EditorHierarchyModel - Reordenamiento entre hermanos", () => {
  const model = new EditorHierarchyModel();
  model.addNode({ id: "1", name: "1", type: "box", parentId: null, order: 0, isGroup: false });
  model.addNode({ id: "2", name: "2", type: "box", parentId: null, order: 1, isGroup: false });
  model.addNode({ id: "3", name: "3", type: "box", parentId: null, order: 2, isGroup: false });

  // Mover "3" a la primera posición (orden 0)
  model.reorderChild("3", 0);
  const ordered = model.getChildren(null).map((n) => n.id);
  assert.deepEqual(ordered, ["3", "1", "2"]);
});

test("EditorHierarchyModel - Serialización y deserialización con retrocompatibilidad", () => {
  const model = new EditorHierarchyModel();
  const g = model.createGroup("G", null, "g-1");
  model.addNode({ id: "o-1", name: "O1", type: "wall", parentId: "g-1", order: 0, isGroup: false, customName: "Pared Custom" });

  const serialized = model.serialize();
  assert.equal(serialized.length, 2);

  const model2 = new EditorHierarchyModel();
  model2.deserialize(serialized);
  assert.equal(model2.hasNode("g-1"), true);
  assert.equal(model2.getNode("o-1").parentId, "g-1");
  assert.equal(model2.getNode("o-1").customName, "Pared Custom");

  // Deserialización de mapa antiguo con IDs huérfanos
  const legacyData = [
    { id: "orphan", name: "Huerfano", type: "wall", parentId: "inexistente", order: 0, isGroup: false }
  ];
  model2.deserialize(legacyData);
  assert.equal(model2.getNode("orphan").parentId, null);
});

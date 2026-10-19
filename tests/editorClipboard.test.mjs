import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorClipboard, remapLogicReferences } = await server.ssrLoadModule("/src/client/editor/clipboard/EditorClipboard.ts");

test("remapLogicReferences - Remapea IDs internos y conserva IDs externos", () => {
  const uuidMap = new Map([
    ["old-btn", "new-btn"],
    ["old-door", "new-door"]
  ]);

  const props = {
    triggerTarget: "old-door",
    unrelatedTarget: "external-light-123",
    actionList: ["old-btn", "old-door", "keep-external-id"],
    nested: {
      connectedUuid: "old-door",
      otherExternal: "external-999"
    }
  };

  const remapped = remapLogicReferences(props, uuidMap);

  assert.equal(remapped.triggerTarget, "new-door");
  assert.equal(remapped.unrelatedTarget, "external-light-123"); // Conservada
  assert.deepEqual(remapped.actionList, ["new-btn", "new-door", "keep-external-id"]);
  assert.equal(remapped.nested.connectedUuid, "new-door");
  assert.equal(remapped.nested.otherExternal, "external-999"); // Conservada
});

test("EditorClipboard - Copia subárbol, reconstruye parentId y traslada espacialmente", () => {
  const hierarchy = new EditorHierarchyModel();
  const group = hierarchy.createGroup("Mecanismo", null, "grp-orig");
  hierarchy.addNode({ id: "btn-orig", name: "Boton", type: "interaction_button", parentId: "grp-orig", order: 0, isGroup: false });
  hierarchy.addNode({ id: "door-orig", name: "Puerta", type: "wall", parentId: "grp-orig", order: 1, isGroup: false });

  const objectsMap = new Map([
    [
      "btn-orig",
      {
        uuid: "btn-orig",
        type: "interaction_button",
        color: 0xff0000,
        originalScale: { x: 1, y: 1, z: 1 },
        pos: { x: 10, y: 0, z: 10 },
        rot: { x: 0, y: 0, z: 0 },
        parentId: "grp-orig",
        logicProperties: { targetUuid: "door-orig", externalSensor: "external-sensor-uuid" }
      }
    ],
    [
      "door-orig",
      {
        uuid: "door-orig",
        type: "wall",
        color: 0x00ff00,
        originalScale: { x: 1, y: 3, z: 1 },
        pos: { x: 15, y: 0, z: 10 },
        rot: { x: 0, y: 0, z: 0 },
        parentId: "grp-orig"
      }
    ]
  ]);

  const clipboard = new EditorClipboard();
  const copied = clipboard.copy(["grp-orig"], hierarchy, (id) => objectsMap.get(id) || null, { x: 10, y: 0, z: 10 });
  assert.equal(copied, true);

  // Pegar en posición { x: 50, y: 0, z: 50 }
  const result = clipboard.preparePaste({ x: 50, y: 0, z: 50 }, null);
  assert.ok(result);

  const { uuidMap, newHierarchyNodes, newObjectsData } = result;

  assert.equal(uuidMap.size, 3); // grp, btn, door
  const newGrpId = uuidMap.get("grp-orig");
  const newBtnId = uuidMap.get("btn-orig");
  const newDoorId = uuidMap.get("door-orig");

  assert.notEqual(newGrpId, "grp-orig");
  assert.notEqual(newBtnId, "btn-orig");
  assert.notEqual(newDoorId, "door-orig");

  // Verificar parentIds reconstruidos
  const newBtnNode = newHierarchyNodes.find((n) => n.id === newBtnId);
  const newDoorNode = newHierarchyNodes.find((n) => n.id === newDoorId);
  assert.equal(newBtnNode.parentId, newGrpId);
  assert.equal(newDoorNode.parentId, newGrpId);

  // Verificar posiciones con delta (offset = { 50-10=40, 0, 40 })
  const newBtnObj = newObjectsData.find((o) => o.uuid === newBtnId);
  const newDoorObj = newObjectsData.find((o) => o.uuid === newDoorId);

  assert.equal(newBtnObj.pos.x, 10 + 40);
  assert.equal(newBtnObj.pos.z, 10 + 40);
  assert.equal(newDoorObj.pos.x, 15 + 40);
  assert.equal(newDoorObj.pos.z, 10 + 40);

  // Verificar remapeo de targetUuid en botón
  assert.equal(newBtnObj.logicProperties.targetUuid, newDoorId);
  // Verificar conservación de externalSensor
  assert.equal(newBtnObj.logicProperties.externalSensor, "external-sensor-uuid");
});

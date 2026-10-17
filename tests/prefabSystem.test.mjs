import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { PrefabSerializer } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabSerializer.ts");
const { PrefabManager } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabManager.ts");

test("PrefabSerializer - Valida esquemas, estructura y detecta inyecciones", () => {
  // JSON malformado
  const badJson = PrefabSerializer.validateAndParse("{ malformed json ");
  assert.equal(badJson.valid, false);
  assert.match(badJson.error, /malformado/);

  // Falta campo de formato
  const badFormat = PrefabSerializer.validateAndParse({ name: "Torre", objects: [], hierarchy: [] });
  assert.equal(badFormat.valid, false);
  assert.match(badFormat.error, /Formato no reconocido/);

  // Objeto con inyección de __proto__
  const evilPayload = JSON.parse('{"format":"viper-prefab","schemaVersion":"1.0","name":"Trampa","objects":[{"type":"wall","uuid":"1","pos":{"x":0,"y":0,"z":0},"__proto__":{"polluted":true}}],"hierarchy":[{"id":"1"}]}');
  const evilResult = PrefabSerializer.validateAndParse(evilPayload);
  assert.equal(evilResult.valid, false);
  assert.match(evilResult.error, /Inyección/);

  // Prefab válido
  const validPayload = {
    format: "viper-prefab",
    schemaVersion: "1.0",
    name: "Muralla Defensiva",
    category: "defensa",
    pivot: { x: 5, y: 0, z: 5 },
    objects: [
      {
        uuid: "wall-1",
        type: "wall",
        pos: { x: 5, y: 0, z: 5 },
        rot: { x: 0, y: 0, z: 0 },
        color: 0x888888,
        texturePath: "/assets/textures/stone.png"
      }
    ],
    hierarchy: [
      { id: "wall-1", name: "Muralla", type: "wall", parentId: null, order: 0, isGroup: false }
    ]
  };

  const validResult = PrefabSerializer.validateAndParse(validPayload);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.data.name, "Muralla Defensiva");
  assert.deepEqual(validResult.data.dependencies.textures, ["/assets/textures/stone.png"]);

  // Exportar a paquete JSON y re-validar
  const exported = PrefabSerializer.exportToPackageJson(validResult.data, "AutorPruebas");
  const revalidated = PrefabSerializer.validateAndParse(exported);
  assert.equal(revalidated.valid, true);
  assert.equal(revalidated.data.name, "Muralla Defensiva");
});

test("PrefabManager - Instancia prefab y gestiona overrides locales", () => {
  const hierarchy = new EditorHierarchyModel();
  const manager = new PrefabManager(hierarchy);

  const prefabData = {
    format: "viper-prefab",
    schemaVersion: "1.0",
    name: "Torreta Doble",
    category: "armas",
    pivot: { x: 0, y: 0, z: 0 },
    hierarchy: [
      { id: "grp-t", name: "Torre", type: "group", parentId: null, order: 0, isGroup: true },
      { id: "base-t", name: "Base", type: "box", parentId: "grp-t", order: 0, isGroup: false },
      { id: "canon-t", name: "Canon", type: "cylinder", parentId: "grp-t", order: 1, isGroup: false }
    ],
    objects: [
      { uuid: "base-t", type: "box", pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: "grp-t" },
      { uuid: "canon-t", type: "cylinder", pos: { x: 0, y: 2, z: 0 }, rot: { x: 0, y: 0, z: 0 }, parentId: "grp-t" }
    ]
  };

  const spawnedObjects = [];
  const spawner = (data) => spawnedObjects.push(data);

  // Instanciar en posición { x: 100, y: 10, z: 100 }
  const result = manager.instantiatePrefab(prefabData, "prefab-torre-1", 1, { x: 100, y: 10, z: 100 }, null, spawner);

  assert.ok(result.instanceId);
  assert.equal(result.createdUuids.length, 2);
  assert.equal(spawnedObjects.length, 2);

  // Verificar que las posiciones se trasladaron con el delta (offset 100, 10, 100)
  const baseObj = spawnedObjects.find((o) => o.type === "box");
  const canonObj = spawnedObjects.find((o) => o.type === "cylinder");

  assert.equal(baseObj.pos.x, 100);
  assert.equal(baseObj.pos.y, 10);
  assert.equal(baseObj.pos.z, 100);

  assert.equal(canonObj.pos.x, 100);
  assert.equal(canonObj.pos.y, 12); // 2 + 10 = 12
  assert.equal(canonObj.pos.z, 100);

  // Verificar overrides locales
  manager.recordOverride(result.instanceId, baseObj.uuid, "color", 0xff0000);
  const inst = manager.getInstance(result.instanceId);
  assert.equal(inst.overrides[baseObj.uuid].color, 0xff0000);
});

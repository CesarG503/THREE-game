import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://game_user:game_password@localhost:5433/threejs_game?schema=public";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());

const { EditorHierarchyModel } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorHierarchyModel.ts");
const { EditorGroupManager } = await server.ssrLoadModule("/src/client/editor/hierarchy/EditorGroupManager.ts");
const { DuplicateCommand } = await server.ssrLoadModule("/src/client/editor/history/EditorCommandHistory.ts");
const { normalizePrefabData } = await server.ssrLoadModule("/server/services/PrefabService.ts");
const { PrefabService } = await server.ssrLoadModule("/src/client/editor/prefabs/PrefabService.ts");

test("Escenario D: Recuperación de errores, rollback atómico en duplicación y validación server-side contra inyecciones y ciclos", async () => {
	// ── 1. Rollback atómico en DuplicateCommand cuando falla a mitad de camino ──
	const scene = new THREE.Scene();
	const hierarchy = new EditorHierarchyModel();
	const groupManager = new EditorGroupManager(hierarchy, scene);

	const createdPhysicalObjects = new Set();

	const failingGameMock = {
		sceneManager: { scene },
		_loadSingleMapObject(data) {
			if (data.uuid === "bad-object-2") {
				throw new Error("Simulated mesh generation failure during duplication!");
			}
			createdPhysicalObjects.add(data.uuid);
		},
		deleteObjectByUuid(uuid) {
			createdPhysicalObjects.delete(uuid);
		}
	};

	const testPayload = {
		hierarchyNodes: [
			{ id: "group-new-1", name: "Grupo Fallido", isGroup: true, parentId: null, order: 0 },
			{ id: "good-object-1", name: "wall", isGroup: false, parentId: "group-new-1", order: 0 },
			{ id: "bad-object-2", name: "wall", isGroup: false, parentId: "group-new-1", order: 1 }
		],
		objectsData: [
			{ uuid: "good-object-1", type: "wall", pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
			{ uuid: "bad-object-2", type: "wall", pos: { x: 2, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }
		],
		rootNodeIds: ["group-new-1"]
	};

	const command = new DuplicateCommand(failingGameMock, hierarchy, groupManager, testPayload);

	assert.throws(
		() => command.execute(),
		/Simulated mesh generation failure/,
		"La ejecución debe arrojar el error simulado"
	);

	// Verificación de rollback atómico:
	// Ningún objeto físico debe quedar huérfano en la escena
	assert.equal(
		createdPhysicalObjects.size,
		0,
		"Rollback atómico: good-object-1 debe haber sido eliminado al fallar la duplicación"
	);

	// Ningún nodo debe quedar en la jerarquía
	assert.equal(hierarchy.hasNode("group-new-1"), false, "El nodo de grupo debe haberse revertido");
	assert.equal(hierarchy.hasNode("good-object-1"), false, "El nodo hijo debe haberse revertido");
	assert.equal(hierarchy.hasNode("bad-object-2"), false);

	// ── 2. Validación Server-Side en normalizePrefabData ──────────────────────
	// A) Rechazo de Prototype Pollution
	const maliciousJson = JSON.stringify({
		format: "viper-prefab",
		schemaVersion: "1.0",
		name: "Exploit",
		pivot: { x: 0, y: 0, z: 0 },
		hierarchy: [
			{ id: "node1", name: "normal", isGroup: false, parentId: null, order: 0, constructor: { prototype: { poll: 1 } } }
		],
		objects: []
	});
	const maliciousPayload = JSON.parse(maliciousJson);

	assert.throws(
		() => normalizePrefabData(maliciousPayload),
		/Inyección de propiedades inseguras/,
		"El servidor debe rechazar intentos de prototype pollution en los datos del prefab"
	);

	// B) Detección y rechazo de ciclos en la jerarquía del prefab
	const cyclicHierarchy = [
		{ id: "group-A", name: "Grupo A", isGroup: true, parentId: "group-B", order: 0 },
		{ id: "group-B", name: "Grupo B", isGroup: true, parentId: "group-A", order: 0 }
	];

	const cyclicPayload = {
		format: "viper-prefab",
		schemaVersion: "1.0",
		name: "Cyclic Prefab",
		pivot: { x: 0, y: 0, z: 0 },
		hierarchy: cyclicHierarchy,
		objects: []
	};

	assert.throws(
		() => normalizePrefabData(cyclicPayload),
		/Ciclo jerárquico detectado/,
		"El servidor debe rechazar grafos jerárquicos cíclicos"
	);

	// C) Rechazo de formato no soportado
	assert.throws(
		() => normalizePrefabData({ format: "unknown-format", name: "Invalid" }),
		/Formato de prefab no reconocido/,
		"Debe rechazar formatos no viper-prefab"
	);

	// ── 3. Manejo cliente de errores y estado de autenticación ───────────────
	// Cuando el servidor no está autenticado, createPrefab almacena localmente con badge 'auth_error'
	// Pero cuando los datos son estructuralmente inválidos, createPrefab los rechaza inmediatamente
	await assert.rejects(
		async () => {
			await PrefabService.createPrefab("Bad Format", { format: "invalid" });
		},
		/Formato de datos no reconocido/,
		"createPrefab debe rechazar datos inválidos sin almacenarlos"
	);
});

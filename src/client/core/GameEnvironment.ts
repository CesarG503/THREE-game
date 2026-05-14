import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { LevelBuilder } from "../environment/LevelBuilder";
import { LevelLoader } from "../environment/LevelLoader";

export function buildEnvironment(this: any) {
	this.levelBuilder = new LevelBuilder(this.sceneManager.scene, this.world);
	this.levelBuilder.build();

	if (this.character) {
		this.character.ladders = this.levelBuilder.ladders;
	}
}

export async function loadLevelFromFile(this: any, url: string, position: any, scale: any) {
	this.levelLoader = new LevelLoader(this.sceneManager.scene, this.world);
	try {
		await this.levelLoader.load(url, position, scale);
		console.log("Map loaded successfully");

		if (this.character) {
			if (this.levelLoader.ladders.length > 0) {
				this.character.ladders = this.character.ladders.concat(this.levelLoader.ladders);
			}
		}
	} catch (e) {
		console.error("Failed to load map, falling back to procedural", e);
		this.buildEnvironment();
	}
}

export function updateEnvironmentConfig(this: any, config: any) {
	this.environmentConfig = Object.assign(this.environmentConfig, config);
	const shapeType = this.environmentConfig.shapeType || "rect";
	const sx = this.environmentConfig.mapSizeX || 100;
	const sz = this.environmentConfig.mapSizeZ || 100;

	if (this.groundGroup) {
		while (this.groundGroup.children.length > 0) {
			const child = this.groundGroup.children[0];
			this.groundGroup.remove(child);
			if (child.geometry) child.geometry.dispose();
		}
	}

	if (this.groundColliders && this.groundBody) {
		this.groundColliders.forEach((c: any) => this.world.removeCollider(c, true));
		this.groundColliders = [];
	}

	const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });

	if (shapeType === "rect") {
		const geo = new THREE.BoxGeometry(sx, 1, sz);
		const mesh = new THREE.Mesh(geo, groundMat);
		mesh.receiveShadow = true;
		this.groundGroup.add(mesh);

		const colDesc = RAPIER.ColliderDesc.cuboid(sx / 2, 0.5, sz / 2);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "circle") {
		const radius = sx / 2;
		const geo = new THREE.CylinderGeometry(radius, radius, 1, 64);
		const mesh = new THREE.Mesh(geo, groundMat);
		mesh.receiveShadow = true;
		this.groundGroup.add(mesh);

		const colDesc = RAPIER.ColliderDesc.cylinder(0.5, radius);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "custom") {
		const cellSize = this.environmentConfig.customCellSize || 10;
		const grid = this.environmentConfig.customGrid || [];

		grid.forEach((key: any) => {
			const [gx, gz] = key.split(",").map(Number);
			const x = gx * cellSize;
			const z = gz * cellSize;

			const geo = new THREE.BoxGeometry(cellSize, 1, cellSize);
			const mesh = new THREE.Mesh(geo, groundMat);
			mesh.position.set(x, 0, z);
			mesh.receiveShadow = true;
			this.groundGroup.add(mesh);

			const colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2)
				.setTranslation(x, 0, z);
			this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
		});
	}

	const oldGrids = this.sceneManager.scene.children.filter((c: any) => c.name === "mapGrid" || c instanceof THREE.GridHelper);
	oldGrids.forEach((child: any) => {
		this.sceneManager.scene.remove(child);
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});

	const cellSize = this.environmentConfig.customCellSize || 10;
	const gridStep = cellSize / 5;
	const hX = sx / 2;
	const hZ = sz / 2;
	const gridVertices: number[] = [];

	for (let x = -hX; x <= hX; x += gridStep) {
		gridVertices.push(x, 0, -hZ, x, 0, hZ);
	}
	for (let z = -hZ; z <= hZ; z += gridStep) {
		gridVertices.push(-hX, 0, z, hX, 0, z);
	}

	const gridGeo = new THREE.BufferGeometry();
	gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridVertices, 3));
	const gridMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.4 });
	const grid = new THREE.LineSegments(gridGeo, gridMat);
	grid.name = "mapGrid";
	grid.position.y = 0.01;

	const chk = document.getElementById("chk-show-grid") as HTMLInputElement | null;
	if (chk) {
		grid.visible = chk.checked;
	}

	this.sceneManager.scene.add(grid);

	this.invisibleWallMeshes.forEach((mesh: any) => this.sceneManager.scene.remove(mesh));
	this.invisibleWallMeshes = [];
	this.invisibleWallBodies.forEach((body: any) => {
		try { this.world.removeRigidBody(body); } catch (e) { }
	});
	this.invisibleWallBodies = [];

	if (this.environmentConfig.invisibleWalls) {
		const wallThickness = 2;
		const wallHeight = 100;
		const hX = sx / 2;
		const hZ = sz / 2;
		let wallDefs: any[] = [];

		if (shapeType === "rect") {
			wallDefs = [
				{ width: sx, depth: wallThickness, pos: { x: 0, y: wallHeight / 2 - 0.5, z: -hZ - wallThickness / 2 } },
				{ width: sx, depth: wallThickness, pos: { x: 0, y: wallHeight / 2 - 0.5, z: hZ + wallThickness / 2 } },
				{ width: wallThickness, depth: sz, pos: { x: -hX - wallThickness / 2, y: wallHeight / 2 - 0.5, z: 0 } },
				{ width: wallThickness, depth: sz, pos: { x: hX + wallThickness / 2, y: wallHeight / 2 - 0.5, z: 0 } }
			];
		} else if (shapeType === "circle") {
			const segments = 16;
			const radius = sx / 2;
			for (let i = 0; i < segments; i++) {
				const angle = (i / segments) * Math.PI * 2;
				const nextAngle = ((i + 1) / segments) * Math.PI * 2;
				const midAngle = (angle + nextAngle) / 2;

				const x = Math.cos(midAngle) * (radius + wallThickness / 2);
				const z = Math.sin(midAngle) * (radius + wallThickness / 2);

				const width = (Math.PI * 2 * radius) / segments;

				wallDefs.push({
					width: width,
					depth: wallThickness,
					pos: { x: x, y: wallHeight / 2 - 0.5, z: z },
					rotY: -midAngle
				});
			}
		} else if (shapeType === "custom") {
			const cellSize = this.environmentConfig.customCellSize || 10;
			const gridSet = new Set(this.environmentConfig.customGrid || []);

			gridSet.forEach((key: any) => {
				const [gx, gz] = key.split(",").map(Number);
				const x = gx * cellSize;
				const z = gz * cellSize;

				const neighbors = [
					{ dx: 0, dz: -1, pos: { x: x, y: wallHeight / 2 - 0.5, z: z - cellSize / 2 - wallThickness / 2 }, w: cellSize, d: wallThickness },
					{ dx: 0, dz: 1, pos: { x: x, y: wallHeight / 2 - 0.5, z: z + cellSize / 2 + wallThickness / 2 }, w: cellSize, d: wallThickness },
					{ dx: -1, dz: 0, pos: { x: x - cellSize / 2 - wallThickness / 2, y: wallHeight / 2 - 0.5, z: z }, w: wallThickness, d: cellSize },
					{ dx: 1, dz: 0, pos: { x: x + cellSize / 2 + wallThickness / 2, y: wallHeight / 2 - 0.5, z: z }, w: wallThickness, d: cellSize }
				];

				neighbors.forEach((n) => {
					const nKey = `${gx + n.dx},${gz + n.dz}`;
					if (!gridSet.has(nKey)) {
						wallDefs.push({ width: n.w, depth: n.d, pos: n.pos });
					}
				});
			});
		}

		wallDefs.forEach((def) => {
			const geo = new THREE.BoxGeometry(def.width, wallHeight, def.depth);
			const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0 });
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(def.pos.x, def.pos.y, def.pos.z);
			if (def.rotY) mesh.rotation.y = def.rotY;
			this.sceneManager.scene.add(mesh);
			this.invisibleWallMeshes.push(mesh);

			const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(def.pos.x, def.pos.y, def.pos.z);
			if (def.rotY) bodyDesc.setRotation({ x: 0, y: Math.sin(def.rotY / 2), z: 0, w: Math.cos(def.rotY / 2) });
			const body = this.world.createRigidBody(bodyDesc);
			const colliderDesc = RAPIER.ColliderDesc.cuboid(def.width / 2, wallHeight / 2, def.depth / 2);
			this.world.createCollider(colliderDesc, body);
			this.invisibleWallBodies.push(body);
		});
	}
}

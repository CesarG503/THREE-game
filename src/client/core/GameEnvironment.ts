import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { LevelBuilder } from "../environment/LevelBuilder";
import { LevelLoader } from "../environment/LevelLoader";
import { applyMapObjectTexture, normalizeTextureSettings } from "../utils/TextureMapping";

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
	if (this.sceneManager && this.sceneManager.setSky) {
		this.sceneManager.setSky(this.environmentConfig.skyType || "day");
	}
	const shapeType = this.environmentConfig.shapeType || "rect";
	const sx = this.environmentConfig.mapSizeX || 100;
	const sz = this.environmentConfig.mapSizeZ || 100;

	if (this.groundGroup) {
		while (this.groundGroup.children.length > 0) {
			const child = this.groundGroup.children[0];
			this.groundGroup.remove(child);
			if (child.geometry) child.geometry.dispose();
			if (child.material) child.material.dispose();
		}
	}

	if (this.groundColliders && this.groundBody) {
		this.groundColliders.forEach((c: any) => this.world.removeCollider(c, true));
		this.groundColliders = [];
	}

	const groundTextureSettings = normalizeTextureSettings(this.environmentConfig.groundTextureSettings || { tileSize: 5 });
	const groundTexturePath = this.environmentConfig.groundTexturePath || null;
	const groundTextureLoader = groundTexturePath ? new THREE.TextureLoader() : null;
	const applyGroundTexture = (mesh: any, dimensions: any) => {
		if (!groundTextureLoader || !groundTexturePath) return;
		groundTextureLoader.load(groundTexturePath, (texture: any) => {
			applyMapObjectTexture(mesh, texture, dimensions, groundTextureSettings);
		});
	};
	const createGroundMaterial = () => new THREE.MeshStandardMaterial({
		color: groundTexturePath ? 0xffffff : 0x1a1a1a,
		roughness: 0.8
	});

	const groundGroups = this.environmentConfig.groundGroups || [];
	const defaultGroup = groundGroups.find((g: any) => g.id === "default");

	const createGroundMaterialForGroup = (group: any) => {
		const texPath = group ? group.texturePath : groundTexturePath;
		const colorHex = (group && group.color) ? parseInt(group.color.replace("#", "0x")) : (groundTexturePath ? 0xffffff : 0x1a1a1a);
		return new THREE.MeshStandardMaterial({
			color: texPath ? 0xffffff : colorHex,
			roughness: 0.8
		});
	};

	const applyGroundTextureForGroup = (mesh: any, dimensions: any, group: any) => {
		const texPath = group ? group.texturePath : groundTexturePath;
		const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : groundTextureSettings);
		if (!texPath) return;
		const groupTextureLoader = new THREE.TextureLoader();
		groupTextureLoader.load(texPath, (texture: any) => {
			applyMapObjectTexture(mesh, texture, dimensions, texSettings);
		});
	};

	if (shapeType === "rect") {
		const geo = new THREE.BoxGeometry(sx, 1, sz);
		const mesh = new THREE.Mesh(geo, createGroundMaterial());
		mesh.receiveShadow = true;
		this.groundGroup.add(mesh);
		applyGroundTexture(mesh, { x: sx, y: 1, z: sz });

		const colDesc = RAPIER.ColliderDesc.cuboid(sx / 2, 0.5, sz / 2);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "circle") {
		const radius = sx / 2;
		const geo = new THREE.CylinderGeometry(radius, radius, 1, 64);
		const mesh = new THREE.Mesh(geo, createGroundMaterial());
		mesh.receiveShadow = true;
		this.groundGroup.add(mesh);
		applyGroundTexture(mesh, { x: sx, y: 1, z: sx });

		const colDesc = RAPIER.ColliderDesc.cylinder(0.5, radius);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "custom") {
		const cellSize = this.environmentConfig.customCellSize || 10;
		const grid = this.environmentConfig.customGrid || [];
		const customGridGroups = this.environmentConfig.customGridGroups || {};

		grid.forEach((key: any) => {
			const [gx, gz] = key.split(",").map(Number);
			const x = gx * cellSize;
			const z = gz * cellSize;

			const groupId = customGridGroups[key] || "default";
			const group = groundGroups.find((g: any) => g.id === groupId) || defaultGroup;

			const geo = new THREE.BoxGeometry(cellSize, 1, cellSize);
			const mesh = new THREE.Mesh(geo, createGroundMaterialForGroup(group));
			mesh.position.set(x, 0, z);
			mesh.receiveShadow = true;
			this.groundGroup.add(mesh);
			applyGroundTextureForGroup(mesh, { x: cellSize, y: 1, z: cellSize }, group);

			const colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2)
				.setTranslation(x, 0, z);
			this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
		});
	}

	const oldGrids = this.sceneManager.scene.children.filter((c: any) => c.name === "mapGrid");
	oldGrids.forEach((child: any) => {
		this.sceneManager.scene.remove(child);
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});

	const cellSize = this.environmentConfig.customCellSize || 10;
	const gridStep = 2;
	const gridInset = 0.04;
	const hX = sx / 2;
	const hZ = sz / 2;
	const gridVertices: number[] = [];
	const gridSegments = new Set<string>();

	const addGridSegment = (x1: number, z1: number, x2: number, z2: number) => {
		if (Math.abs(x1 - x2) < 0.001 && Math.abs(z1 - z2) < 0.001) return;
		const a = `${x1.toFixed(3)},${z1.toFixed(3)}`;
		const b = `${x2.toFixed(3)},${z2.toFixed(3)}`;
		const key = a < b ? `${a}|${b}` : `${b}|${a}`;
		if (gridSegments.has(key)) return;
		gridSegments.add(key);
		gridVertices.push(x1, 0, z1, x2, 0, z2);
	};

	const firstGridLine = (min: number) => Math.ceil((min + gridInset) / gridStep) * gridStep;

	if (shapeType === "circle") {
		const radius = Math.max(0, sx / 2 - gridInset);
		for (let x = firstGridLine(-radius); x < radius - gridInset; x += gridStep) {
			const half = Math.sqrt(Math.max(0, radius * radius - x * x));
			addGridSegment(x, -half, x, half);
		}
		for (let z = firstGridLine(-radius); z < radius - gridInset; z += gridStep) {
			const half = Math.sqrt(Math.max(0, radius * radius - z * z));
			addGridSegment(-half, z, half, z);
		}
	} else if (shapeType === "custom") {
		const grid = this.environmentConfig.customGrid || [];
		const gridSet = new Set(grid);

		grid.forEach((key: any) => {
			const [gx, gz] = key.split(",").map(Number);
			const centerX = gx * cellSize;
			const centerZ = gz * cellSize;
			const minX = centerX - cellSize / 2;
			const minZ = centerZ - cellSize / 2;
			const maxX = centerX + cellSize / 2;
			const maxZ = centerZ + cellSize / 2;

			for (let x = firstGridLine(minX); x < maxX - gridInset; x += gridStep) {
				addGridSegment(x, minZ + gridInset, x, maxZ - gridInset);
			}
			for (let z = firstGridLine(minZ); z < maxZ - gridInset; z += gridStep) {
				addGridSegment(minX + gridInset, z, maxX - gridInset, z);
			}

			if (gridSet.has(`${gx + 1},${gz}`)) addGridSegment(maxX, minZ + gridInset, maxX, maxZ - gridInset);
			if (gridSet.has(`${gx},${gz + 1}`)) addGridSegment(minX + gridInset, maxZ, maxX - gridInset, maxZ);
		});
	} else {
		const minX = -hX + gridInset;
		const maxX = hX - gridInset;
		const minZ = -hZ + gridInset;
		const maxZ = hZ - gridInset;
		for (let x = firstGridLine(-hX); x < hX - gridInset; x += gridStep) {
			addGridSegment(x, minZ, x, maxZ);
		}
		for (let z = firstGridLine(-hZ); z < hZ - gridInset; z += gridStep) {
			addGridSegment(minX, z, maxX, z);
		}
	}

	const gridGeo = new THREE.BufferGeometry();
	gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridVertices, 3));
	const gridMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.4 });
	const grid = new THREE.LineSegments(gridGeo, gridMat);
	grid.name = "mapGrid";
	grid.position.y = 0.003;

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

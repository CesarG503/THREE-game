import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { LevelBuilder } from "../environment/LevelBuilder";
import { LevelLoader } from "../environment/LevelLoader";
import { applyMapObjectTexture, normalizeTextureSettings, applyWorldSpaceUVs } from "../utils/TextureMapping";
import { MapAssetManager } from "../map/MapAssetManager";
import { MapMaterialCache } from "../map/MapMaterialCache";
import { MapGeometryBuilder, createPrismGeometryForShape } from "../map/MapGeometryBuilder";
import { MapPhysicsBuilder } from "../map/MapPhysicsBuilder";

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
	this.environmentConfig = Object.assign(this.environmentConfig || {}, config);
	this.environmentConfig.invisibleWallsAdvanced = !!this.environmentConfig.invisibleWalls;
	this.environmentConfig.ceilingsAdvanced = !!this.environmentConfig.ceilingsEnabled;

	// Ensure default groups are always populated if missing or empty
	if (!this.environmentConfig.groundGroups || this.environmentConfig.groundGroups.length === 0) {
		this.environmentConfig.groundGroups = [
			{
				id: "default",
				name: "Suelo 1",
				color: "#FF9800",
				color3D: "#FF9800",
				texturePath: null,
				textureAssetId: null,
				textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false }
			}
		];
	}

	if (!this.environmentConfig.invisibleWallsGroups || this.environmentConfig.invisibleWallsGroups.length === 0) {
		this.environmentConfig.invisibleWallsGroups = [
			{
				id: "default",
				name: "Pared 1",
				color: "#FF5722",
				color3D: "#FF5722",
				texturePath: null,
				textureAssetId: null,
				textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false },
				height: 10,
				opacity: 1.0,
				transparent: false
			}
		];
	}

	if (!this.environmentConfig.ceilingGroups || this.environmentConfig.ceilingGroups.length === 0) {
		this.environmentConfig.ceilingGroups = [
			{
				id: "default",
				name: "Techo 1",
				color: "#E040FB",
				color3D: "#E040FB",
				texturePath: null,
				textureAssetId: null,
				textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false }
			}
		];
	}

	if (this.sceneManager && this.sceneManager.setSky) {
		this.sceneManager.setSky(this.environmentConfig.skyType || "day");
	}
	const shapeType = this.environmentConfig.shapeType || "rect";
	const sx = this.environmentConfig.mapSizeX || 100;
	const sz = this.environmentConfig.mapSizeZ || 100;

	// Clear asset and material caches on update
	MapAssetManager.clearCache();
	MapMaterialCache.clearCache();

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

	const groundTextureSettings = normalizeTextureSettings(this.environmentConfig.groundTextureSettings || { tileSize: 5 });
	const groundTexturePath = this.environmentConfig.groundTexturePath || null;
	const applyGroundTexture = (mesh: any, dimensions: any) => {
		if (!groundTexturePath) return;
		MapAssetManager.loadTexture(groundTexturePath).then((texture) => {
			applyMapObjectTexture(mesh, texture, dimensions, groundTextureSettings);
		}).catch(err => console.error("Failed to load ground texture:", groundTexturePath, err));
	};
	const createGroundMaterial = () => {
		const matKey = `ground_rect_${groundTexturePath || ""}`;
		return MapMaterialCache.getMaterial(matKey, () => new THREE.MeshStandardMaterial({
			color: groundTexturePath ? 0xffffff : 0x1a1a1a,
			roughness: 0.8
		}));
	};

	const groundGroups = this.environmentConfig.groundGroups || [];
	const defaultGroup = groundGroups.find((g: any) => g.id === "default");

	const ceilingGroups = this.environmentConfig.ceilingGroups || [];
	const defaultCeilingGroup = ceilingGroups.find((g: any) => g.id === "default") || { id: "default", name: "Techo 1", color: "#E040FB" };

	if (shapeType === "rect") {
		const geo = new THREE.BoxGeometry(sx, 1, sz);
		const mesh = new THREE.Mesh(geo, createGroundMaterial());
		mesh.receiveShadow = true;
		mesh.userData = {
			isEditableMapObject: true,
			mapObjectType: "environment_ground",
			groupId: "default",
			customName: "Suelo Base"
		};
		this.groundGroup.add(mesh);
		applyGroundTexture(mesh, { x: sx, y: 1, z: sz });

		const colDesc = RAPIER.ColliderDesc.cuboid(sx / 2, 0.5, sz / 2);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "circle") {
		const radius = sx / 2;
		const geo = new THREE.CylinderGeometry(radius, radius, 1, 64);
		const mesh = new THREE.Mesh(geo, createGroundMaterial());
		mesh.receiveShadow = true;
		mesh.userData = {
			isEditableMapObject: true,
			mapObjectType: "environment_ground",
			groupId: "default",
			customName: "Suelo Base Círculo"
		};
		this.groundGroup.add(mesh);
		applyGroundTexture(mesh, { x: sx, y: 1, z: sx });

		const colDesc = RAPIER.ColliderDesc.cylinder(0.5, radius);
		this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
	} else if (shapeType === "custom") {
		const cellSize = this.environmentConfig.customCellSize || 10;
		const grid = this.environmentConfig.customGrid || [];
		const customGridGroups = this.environmentConfig.customGridGroups || {};
		const customGridShapes = this.environmentConfig.customGridShapes || {};

		// 1. Build Merged Ground Meshes
		const mergedGroundGeos = MapGeometryBuilder.buildMergedGround(
			grid,
			cellSize,
			customGridGroups,
			groundGroups,
			defaultGroup,
			customGridShapes,
			groundTextureSettings
		);

		mergedGroundGeos.forEach((geo, groupId) => {
			const group = groundGroups.find((g: any) => g.id === groupId) || defaultGroup;
			const texPath = group ? group.texturePath : groundTexturePath;
			const colorHex = (group && (group.color3D || group.color)) ? parseInt((group.color3D || group.color).replace("#", "0x")) : (groundTexturePath ? 0xffffff : 0x1a1a1a);
			const matKey = `ground_${groupId}_${texPath || ""}_${colorHex}`;
			const material = MapMaterialCache.getMaterial(matKey, () => new THREE.MeshStandardMaterial({
				color: texPath ? 0xffffff : colorHex,
				roughness: 0.8
			}));

			const mesh = new THREE.Mesh(geo, material);
			mesh.receiveShadow = true;
			mesh.userData = {
				isEditableMapObject: true,
				mapObjectType: "environment_ground",
				groupId: groupId,
				customName: group ? `Suelo: ${group.name}` : `Suelo: Suelo 1`
			};
			this.groundGroup.add(mesh);

			if (texPath) {
				const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : groundTextureSettings);
				applyWorldSpaceUVs(mesh.geometry, texSettings);
				MapAssetManager.loadTexture(texPath).then((texture) => {
					applyMapObjectTexture(mesh, texture, { x: cellSize, y: 1, z: cellSize }, texSettings);
				}).catch(err => console.error("Failed to load ground texture:", texPath, err));
			}
		});

		// 2. Build Ground Colliders
		// A. Slopes/Prisms
		const prismKeys = grid.filter(key => (customGridShapes[key] || "full") !== "full");
		prismKeys.forEach(key => {
			const shape = customGridShapes[key];
			const [gx, gz] = key.split(",").map(Number);
			const x = gx * cellSize;
			const z = gz * cellSize;
			const groupId = customGridGroups[key] || "default";
			const group = groundGroups.find((g: any) => g.id === groupId) || defaultGroup;
			const geo = createPrismGeometryForShape(shape, cellSize, 1, group, groundTextureSettings);
			let colDesc;
			try {
				const vertices = geo.attributes.position.array;
				colDesc = RAPIER.ColliderDesc.convexHull(vertices as any);
			} catch (e) {
				console.warn("convexHull failed for prism slope, falling back to cuboid", e);
			}
			if (!colDesc) {
				colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2);
			}
			colDesc.setTranslation(x, 0, z);
			this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
			geo.dispose();
		});

		// B. Greedy Merged Cuboids
		const fullCellKeys = grid.filter(key => (customGridShapes[key] || "full") === "full");
		const mergedRects = MapPhysicsBuilder.greedyMerge2D(fullCellKeys);
		mergedRects.forEach(rect => {
			const width = rect.w * cellSize;
			const depth = rect.h * cellSize;
			const centerX = (rect.gx + (rect.w - 1) / 2) * cellSize;
			const centerZ = (rect.gz + (rect.h - 1) / 2) * cellSize;

			const colDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.5, depth / 2);
			colDesc.setTranslation(centerX, 0, centerZ);
			this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
		});

		if (this.environmentConfig.ceilingsEnabled) {
			// 3. Build Merged Ceiling Meshes
			const customGridCeilingGroups = this.environmentConfig.customGridCeilingGroups || {};
			const customGridCeilingShapes = this.environmentConfig.customGridCeilingShapes || {};
			const customGridWallGroups = this.environmentConfig.customGridWallGroups || {};
			const invisibleWallsGroups = this.environmentConfig.invisibleWallsGroups || [];

			const mergedCeilingGeos = MapGeometryBuilder.buildMergedCeilings(
				customGridCeilingGroups,
				cellSize,
				ceilingGroups,
				defaultCeilingGroup,
				customGridCeilingShapes,
				customGridWallGroups,
				invisibleWallsGroups
			);

			mergedCeilingGeos.forEach((geoData) => {
				const group = ceilingGroups.find((g: any) => g.id === geoData.ceilingGroupId) || defaultCeilingGroup;
				const texPath = group ? group.texturePath : null;
				const colorHex = (group && (group.color3D || group.color)) ? parseInt((group.color3D || group.color).replace("#", "0x")) : 0xe040fb;
				const matKey = `ceiling_${geoData.ceilingGroupId}_${texPath || ""}_${colorHex}`;
				const material = MapMaterialCache.getMaterial(matKey, () => new THREE.MeshStandardMaterial({
					color: texPath ? 0xffffff : colorHex,
					roughness: 0.8,
					side: THREE.DoubleSide
				}));

				const mesh = new THREE.Mesh(geoData.geometry, material);
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				mesh.userData = {
					isEditableMapObject: true,
					mapObjectType: "environment_ceiling",
					groupId: geoData.ceilingGroupId,
					customName: group ? `Techo: ${group.name}` : `Techo: Techo 1`
				};
				this.groundGroup.add(mesh);

				if (texPath) {
					const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : { tileSize: 5 });
					applyWorldSpaceUVs(mesh.geometry, texSettings);
					MapAssetManager.loadTexture(texPath).then((texture) => {
						applyMapObjectTexture(mesh, texture, { x: cellSize, y: 1, z: cellSize }, texSettings);
					}).catch(err => console.error("Failed to load ceiling texture:", texPath, err));
				}
			});

			// 4. Build Ceiling Colliders
			// A. Slopes/Prisms
			const ceilingPrismKeys = Object.keys(customGridCeilingGroups).filter(key => (customGridCeilingShapes[key] || "full") !== "full");
			ceilingPrismKeys.forEach(key => {
				const ceilingGroupId = customGridCeilingGroups[key];
				if (!ceilingGroupId) return;
				const group = ceilingGroups.find((g: any) => g.id === ceilingGroupId) || defaultCeilingGroup;
				const shape = customGridCeilingShapes[key];
				const wallGroupId = customGridWallGroups[key] || "default";
				const wallGroup = invisibleWallsGroups.find((wg: any) => wg.id === wallGroupId);
				const wallHeight = (wallGroup && wallGroup.height !== undefined) ? wallGroup.height : 10;
				const posY = wallHeight - 1.0;
				const [gx, gz] = key.split(",").map(Number);
				const x = gx * cellSize;
				const z = gz * cellSize;

				const geo = createPrismGeometryForShape(shape, cellSize, 1, group, { tileSize: 5 });
				let colDesc;
				try {
					const vertices = geo.attributes.position.array;
					colDesc = RAPIER.ColliderDesc.convexHull(vertices as any);
				} catch (e) {
					console.warn("convexHull failed for ceiling prism, falling back to cuboid", e);
				}
				if (!colDesc) {
					colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2);
				}
				colDesc.setTranslation(x, posY, z);
				this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
				geo.dispose();
			});

			// B. Greedy Merged Cuboids (grouped by height)
			const ceilingFullKeysByPosY = new Map<number, string[]>();
			Object.keys(customGridCeilingGroups).forEach(key => {
				if ((customGridCeilingShapes[key] || "full") !== "full") return;
				const ceilingGroupId = customGridCeilingGroups[key];
				if (!ceilingGroupId) return;

				const wallGroupId = customGridWallGroups[key] || "default";
				const wallGroup = invisibleWallsGroups.find((wg: any) => wg.id === wallGroupId);
				const wallHeight = (wallGroup && wallGroup.height !== undefined) ? wallGroup.height : 10;
				const posY = wallHeight - 1.0;

				if (!ceilingFullKeysByPosY.has(posY)) {
					ceilingFullKeysByPosY.set(posY, []);
				}
				ceilingFullKeysByPosY.get(posY)!.push(key);
			});

			ceilingFullKeysByPosY.forEach((keys, posY) => {
				const mergedRects = MapPhysicsBuilder.greedyMerge2D(keys);
				mergedRects.forEach(rect => {
					const width = rect.w * cellSize;
					const depth = rect.h * cellSize;
					const centerX = (rect.gx + (rect.w - 1) / 2) * cellSize;
					const centerZ = (rect.gz + (rect.h - 1) / 2) * cellSize;

					const colDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.5, depth / 2);
					colDesc.setTranslation(centerX, posY, centerZ);
					this.groundColliders.push(this.world.createCollider(colDesc, this.groundBody));
				});
			});
		}
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
				{ width: sx, depth: wallThickness, pos: { x: 0, y: 0, z: -hZ - wallThickness / 2 } },
				{ width: sx, depth: wallThickness, pos: { x: 0, y: 0, z: hZ + wallThickness / 2 } },
				{ width: wallThickness, depth: sz, pos: { x: -hX - wallThickness / 2, y: 0, z: 0 } },
				{ width: wallThickness, depth: sz, pos: { x: hX + wallThickness / 2, y: 0, z: 0 } }
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
					pos: { x: x, y: 0, z: z },
					rotY: -midAngle
				});
			}
		} else if (shapeType === "custom") {
			const cellSize = this.environmentConfig.customCellSize || 10;
			const grid = this.environmentConfig.customGrid || [];
			const gridSet = new Set(grid);
			const customGridShapes = this.environmentConfig.customGridShapes || {};

			const hasNorthFace = (sh: string) => sh === "full" || sh === "nw" || sh === "ne";
			const hasSouthFace = (sh: string) => sh === "full" || sh === "se" || sh === "sw";
			const hasWestFace = (sh: string) => sh === "full" || sh === "nw" || sh === "sw";
			const hasEastFace = (sh: string) => sh === "full" || sh === "ne" || sh === "se";

			gridSet.forEach((key: any) => {
				const [gx, gz] = key.split(",").map(Number);
				const x = gx * cellSize;
				const z = gz * cellSize;
				const shape = customGridShapes[key] || "full";

				// 1. North face
				if (hasNorthFace(shape)) {
					const nKey = `${gx},${gz - 1}`;
					const nShape = customGridShapes[nKey] || "full";
					const nExists = gridSet.has(nKey);
					if (!nExists || !hasSouthFace(nShape)) {
						wallDefs.push({
							width: cellSize,
							depth: wallThickness,
							pos: { x: x, y: 0, z: z - cellSize / 2 - wallThickness / 2 },
							cellKey: key
						});
					}
				}

				// 2. South face
				if (hasSouthFace(shape)) {
					const nKey = `${gx},${gz + 1}`;
					const nShape = customGridShapes[nKey] || "full";
					const nExists = gridSet.has(nKey);
					if (!nExists || !hasNorthFace(nShape)) {
						wallDefs.push({
							width: cellSize,
							depth: wallThickness,
							pos: { x: x, y: 0, z: z + cellSize / 2 + wallThickness / 2 },
							cellKey: key
						});
					}
				}

				// 3. West face
				if (hasWestFace(shape)) {
					const nKey = `${gx - 1},${gz}`;
					const nShape = customGridShapes[nKey] || "full";
					const nExists = gridSet.has(nKey);
					if (!nExists || !hasEastFace(nShape)) {
						wallDefs.push({
							width: wallThickness,
							depth: cellSize,
							pos: { x: x - cellSize / 2 - wallThickness / 2, y: 0, z: z },
							cellKey: key
						});
					}
				}

				// 4. East face
				if (hasEastFace(shape)) {
					const nKey = `${gx + 1},${gz}`;
					const nShape = customGridShapes[nKey] || "full";
					const nExists = gridSet.has(nKey);
					if (!nExists || !hasWestFace(nShape)) {
						wallDefs.push({
							width: wallThickness,
							depth: cellSize,
							pos: { x: x + cellSize / 2 + wallThickness / 2, y: 0, z: z },
							cellKey: key
						});
					}
				}

				// 5. Diagonal face (Hypotenuse)
				if (shape !== "full") {
					const len = cellSize * Math.sqrt(2);
					const offset = wallThickness / 2;
					const invSqrt2 = 1 / Math.sqrt(2);
					let rotY = 0;
					let ox = 0;
					let oz = 0;

					if (shape === "nw") {
						rotY = Math.PI / 4;
						ox = invSqrt2 * offset;
						oz = invSqrt2 * offset;
					} else if (shape === "ne") {
						rotY = -Math.PI / 4;
						ox = -invSqrt2 * offset;
						oz = invSqrt2 * offset;
					} else if (shape === "se") {
						rotY = Math.PI / 4;
						ox = -invSqrt2 * offset;
						oz = -invSqrt2 * offset;
					} else if (shape === "sw") {
						rotY = -Math.PI / 4;
						ox = invSqrt2 * offset;
						oz = -invSqrt2 * offset;
					}

					wallDefs.push({
						width: len,
						depth: wallThickness,
						pos: { x: x + ox, y: 0, z: z + oz },
						rotY: rotY,
						cellKey: key
					});
				}
			});
		}

		const isAdvanced = !!this.environmentConfig.invisibleWallsAdvanced;
		const wallGroups = this.environmentConfig.invisibleWallsGroups || [];
		const customGridWallGroups = this.environmentConfig.customGridWallGroups || {};
		const cellSize = this.environmentConfig.customCellSize || 10;

		// Merge wall definitions collinear segments (1D wall merging)
		const mergedWallDefs = MapPhysicsBuilder.mergeWallSegments(
			wallDefs,
			cellSize,
			wallThickness,
			customGridWallGroups
		);

		// Build merged geometries for rendering
		const mergedWallGeos = MapGeometryBuilder.buildMergedWalls(
			mergedWallDefs,
			customGridWallGroups,
			wallGroups,
			isAdvanced
		);

		mergedWallGeos.forEach((meta, groupId) => {
			let mat: THREE.Material;
			const matKey = `wall_${groupId}_${meta.texturePath || ""}_${meta.colorStr}_${meta.opacity}`;

			if (meta.isWireframeOnly) {
				mat = MapMaterialCache.getMaterial(matKey, () => new THREE.MeshBasicMaterial({
					color: 0xff0000,
					wireframe: true,
					transparent: true,
					opacity: 0
				}));
			} else {
				mat = MapMaterialCache.getMaterial(matKey, () => new THREE.MeshStandardMaterial({
					color: new THREE.Color(meta.colorStr),
					transparent: meta.opacity < 1.0,
					opacity: meta.opacity,
					roughness: 0.8,
					metalness: 0.2
				}));
			}

			const mesh = new THREE.Mesh(meta.geometry, mat);
			mesh.userData = {
				isEditableMapObject: true,
				mapObjectType: "environment_wall",
				groupId: groupId,
				customName: `Pared: ${meta.isWireframeOnly ? "Solo Colisión" : (groupId === "default" ? "Pared 1" : groupId)}`
			};
			this.sceneManager.scene.add(mesh);
			this.invisibleWallMeshes.push(mesh);

			if (meta.opacity > 0 && meta.texturePath) {
				const settings = normalizeTextureSettings(meta.textureSettings || { tileSize: 5 });
				applyWorldSpaceUVs(mesh.geometry, settings);
				MapAssetManager.loadTexture(meta.texturePath).then((texture) => {
					applyMapObjectTexture(mesh, texture, null, settings);
				}).catch(err => console.error("Failed to load wall texture:", meta.texturePath, err));
			}
		});

		// Build physics colliders for each merged wall segment
		mergedWallDefs.forEach((def) => {
			let finalHeight = 100;
			let group: any = null;
			if (isAdvanced && def.cellKey) {
				const wallGroupId = customGridWallGroups[def.cellKey];
				if (wallGroupId) {
					group = wallGroups.find((g: any) => g.id === wallGroupId);
				}
			}
			if (!group && isAdvanced) {
				group = wallGroups.find((g: any) => g.id === "default") || wallGroups[0];
			}
			if (group) {
				finalHeight = group.height !== undefined ? group.height : 10;
			}

			const posY = finalHeight / 2 - 0.5;
			const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(def.pos.x, posY, def.pos.z);
			const quat = new THREE.Quaternion();
			if (def.rotY) {
				quat.setFromEuler(new THREE.Euler(0, def.rotY, 0));
				bodyDesc.setRotation(quat);
			}
			const body = this.world.createRigidBody(bodyDesc);
			const colliderDesc = RAPIER.ColliderDesc.cuboid(def.width / 2, finalHeight / 2, def.depth / 2);
			this.world.createCollider(colliderDesc, body);
			this.invisibleWallBodies.push(body);
		});
	}
}

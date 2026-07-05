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
		const colorHex = (group && (group.color3D || group.color)) ? parseInt((group.color3D || group.color).replace("#", "0x")) : (groundTexturePath ? 0xffffff : 0x1a1a1a);
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

	const createPrismGeometryForShape = (shape: string, cs: number, height: number, group: any) => {
		const h2 = height / 2;
		const texSettings = normalizeTextureSettings(group ? (group.textureSettings || { tileSize: 5 }) : groundTextureSettings);
		const tile = texSettings.fitMode === "stretch" ? cs : texSettings.tileSize;

		let v1 = new THREE.Vector2(-cs/2, -cs/2);
		let v2 = new THREE.Vector2(-cs/2, cs/2);
		let v3 = new THREE.Vector2(cs/2, -cs/2);

		if (shape === "ne") {
			v1 = new THREE.Vector2(-cs/2, -cs/2);
			v2 = new THREE.Vector2(cs/2, -cs/2);
			v3 = new THREE.Vector2(cs/2, cs/2);
		} else if (shape === "se") {
			v1 = new THREE.Vector2(cs/2, -cs/2);
			v2 = new THREE.Vector2(cs/2, cs/2);
			v3 = new THREE.Vector2(-cs/2, cs/2);
		} else if (shape === "sw") {
			v1 = new THREE.Vector2(-cs/2, -cs/2);
			v2 = new THREE.Vector2(-cs/2, cs/2);
			v3 = new THREE.Vector2(cs/2, cs/2);
		}

		// Ensure counter-clockwise winding order for 2D vertices (looking down in X/Z)
		const cross = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x);
		if (cross > 0) {
			const tmp = v2;
			v2 = v3;
			v3 = tmp;
		}

		const geometry = new THREE.BufferGeometry();
		const vertices: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];

		const addTriangle = (
			p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3,
			u1: THREE.Vector2, u2: THREE.Vector2, u3: THREE.Vector2
		) => {
			vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
			const cb = new THREE.Vector3().subVectors(p3, p2);
			const ab = new THREE.Vector3().subVectors(p1, p2);
			cb.cross(ab).normalize();
			normals.push(cb.x, cb.y, cb.z, cb.x, cb.y, cb.z, cb.x, cb.y, cb.z);
			uvs.push(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
		};

		const B1 = new THREE.Vector3(v1.x, -h2, v1.y);
		const B2 = new THREE.Vector3(v2.x, -h2, v2.y);
		const B3 = new THREE.Vector3(v3.x, -h2, v3.y);

		const T1 = new THREE.Vector3(v1.x, h2, v1.y);
		const T2 = new THREE.Vector3(v2.x, h2, v2.y);
		const T3 = new THREE.Vector3(v3.x, h2, v3.y);

		const getUV = (v: THREE.Vector2) => {
			return new THREE.Vector2((v.x + cs/2) / tile, (v.y + cs/2) / tile);
		};

		const uv1 = getUV(v1);
		const uv2 = getUV(v2);
		const uv3 = getUV(v3);

		// Top
		addTriangle(T1, T2, T3, uv1, uv2, uv3);
		// Bottom
		addTriangle(B1, B3, B2, uv1, uv3, uv2);

		const L1 = v1.distanceTo(v2);
		const L2 = v2.distanceTo(v3);
		const L3 = v3.distanceTo(v1);

		// Sides
		addTriangle(B1, B2, T2, new THREE.Vector2(0, 0), new THREE.Vector2(L1 / tile, 0), new THREE.Vector2(L1 / tile, height / tile));
		addTriangle(B1, T2, T1, new THREE.Vector2(0, 0), new THREE.Vector2(L1 / tile, height / tile), new THREE.Vector2(0, height / tile));

		addTriangle(B2, B3, T3, new THREE.Vector2(0, 0), new THREE.Vector2(L2 / tile, 0), new THREE.Vector2(L2 / tile, height / tile));
		addTriangle(B2, T3, T2, new THREE.Vector2(0, 0), new THREE.Vector2(L2 / tile, height / tile), new THREE.Vector2(0, height / tile));

		addTriangle(B3, B1, T1, new THREE.Vector2(0, 0), new THREE.Vector2(L3 / tile, 0), new THREE.Vector2(L3 / tile, height / tile));
		addTriangle(B3, T1, T3, new THREE.Vector2(0, 0), new THREE.Vector2(L3 / tile, height / tile), new THREE.Vector2(0, height / tile));

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

		return geometry;
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
		const customGridShapes = this.environmentConfig.customGridShapes || {};

		grid.forEach((key: any) => {
			const [gx, gz] = key.split(",").map(Number);
			const x = gx * cellSize;
			const z = gz * cellSize;

			const groupId = customGridGroups[key] || "default";
			const group = groundGroups.find((g: any) => g.id === groupId) || defaultGroup;
			const shape = customGridShapes[key] || "full";

			let geo;
			if (shape === "full") {
				geo = new THREE.BoxGeometry(cellSize, 1, cellSize);
			} else {
				geo = createPrismGeometryForShape(shape, cellSize, 1, group);
			}

			const mesh = new THREE.Mesh(geo, createGroundMaterialForGroup(group));
			mesh.position.set(x, 0, z);
			mesh.receiveShadow = true;
			this.groundGroup.add(mesh);
			applyGroundTextureForGroup(mesh, { x: cellSize, y: 1, z: cellSize }, group);

			let colDesc;
			if (shape === "full") {
				colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2);
			} else {
				try {
					const vertices = geo.attributes.position.array;
					colDesc = RAPIER.ColliderDesc.convexHull(vertices as any);
				} catch (e) {
					console.warn("convexHull failed for prism, falling back to cuboid", e);
				}
				if (!colDesc) {
					colDesc = RAPIER.ColliderDesc.cuboid(cellSize / 2, 0.5, cellSize / 2);
				}
			}
			colDesc.setTranslation(x, 0, z);
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

		wallDefs.forEach((def) => {
			let finalHeight = 100;
			let colorStr = "#FF5722";
			let opacity = 0.0;
			let transparent = true;
			let texturePath: string | null = null;
			let textureSettings: any = null;

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
				colorStr = group.color3D || group.color || "#FF5722";
				opacity = group.opacity !== undefined ? group.opacity : 1.0;
				transparent = group.transparent !== undefined ? group.transparent : (opacity < 1.0);
				texturePath = group.texturePath || null;
				textureSettings = group.textureSettings || null;
			}

			let mat: THREE.Material;
			if (opacity === 0) {
				mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0 });
			} else {
				mat = new THREE.MeshStandardMaterial({ 
					color: new THREE.Color(colorStr), 
					transparent: transparent, 
					opacity: opacity,
					roughness: 0.8,
					metalness: 0.2
				});
			}

			const geo = new THREE.BoxGeometry(def.width, finalHeight, def.depth);
			const mesh = new THREE.Mesh(geo, mat);
			const posY = finalHeight / 2 - 0.5;
			mesh.position.set(def.pos.x, posY, def.pos.z);
			
			const quat = new THREE.Quaternion();
			if (def.rotY) {
				quat.setFromEuler(new THREE.Euler(0, def.rotY, 0));
				mesh.quaternion.copy(quat);
			}

			if (opacity > 0 && texturePath) {
				const loader = new THREE.TextureLoader();
				loader.load(texturePath, (texture: any) => {
					texture.wrapS = THREE.RepeatWrapping;
					texture.wrapT = THREE.RepeatWrapping;
					
					const settings = normalizeTextureSettings(textureSettings || { tileSize: 5 });
					const dimensions = new THREE.Vector3(def.width, finalHeight, def.depth);
					applyMapObjectTexture(mesh, texture, dimensions, settings);
					
					if (mesh.material) {
						(mesh.material as any).needsUpdate = true;
					}
				});
			}

			this.sceneManager.scene.add(mesh);
			this.invisibleWallMeshes.push(mesh);

			const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(def.pos.x, posY, def.pos.z);
			if (def.rotY) {
				bodyDesc.setRotation(quat);
			}
			const body = this.world.createRigidBody(bodyDesc);
			const colliderDesc = RAPIER.ColliderDesc.cuboid(def.width / 2, finalHeight / 2, def.depth / 2);
			this.world.createCollider(colliderDesc, body);
			this.invisibleWallBodies.push(body);
		});
	}
}

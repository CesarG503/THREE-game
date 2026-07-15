import * as THREE from "three";

export class RoomSystem {
	game: any;
	rooms: THREE.Object3D[];
	indoorObjects: THREE.Object3D[];
	outdoorObjects: THREE.Object3D[];
	currentRoomState: "indoors" | "outdoors";

	activeRoomAmbientLight: THREE.AmbientLight | null;
	inactiveRoomAmbientLight: THREE.AmbientLight | null;

	targetAmbientIntensity: number;
	targetAmbientColor: THREE.Color;
	transitionSpeed: number;
	initialized: boolean;

	constructor(game: any) {
		this.game = game;
		this.rooms = [];
		this.indoorObjects = [];
		this.outdoorObjects = [];
		this.currentRoomState = "outdoors";

		this.activeRoomAmbientLight = null;
		this.inactiveRoomAmbientLight = null;

		this.targetAmbientIntensity = 0.6;
		this.targetAmbientColor = new THREE.Color("#ffffff");
		this.transitionSpeed = 4.0; // Lerp multiplier for eye adaptation
		this.initialized = false;
	}

	init() {
		// Only run logic layers in play mode, not in the editor
		if (this.game.gameMode === "editor") {
			console.log("[RoomSystem] Disabled in Editor Mode");
			return;
		}

		const shouldBeActive = !!this.game.environmentConfig?.enableRoomDarkness;
		if (!shouldBeActive) {
			if (this.initialized) {
				this.cleanup();
			}
			console.log("[RoomSystem] Room Darkness System is disabled in environment config");
			return;
		}

		console.log("[RoomSystem] Initializing Portal & Room System (Phase 1)");

		// Clear previous state
		this.rooms = [];
		this.indoorObjects = [];
		this.outdoorObjects = [];
		this.currentRoomState = "outdoors";

		// Force scene global matrix updates so OBB/position checks have valid matrixWorld values
		if (this.game.sceneManager && this.game.sceneManager.scene) {
			this.game.sceneManager.scene.updateMatrixWorld(true);
		}

		// 1. Gather all manual logic_room volumes (if any)
		this.game.sceneManager.scene.children.forEach((obj: any) => {
			if (obj.userData && obj.userData.logicProperties && obj.userData.logicProperties.logicKind === "logic_room") {
				obj.updateMatrixWorld(true);
				this.rooms.push(obj);

				// Hide the transparent box helper in game play mode
				obj.traverse((child: any) => {
					if (child.isMesh) {
						child.visible = false;
					}
				});
			}
		});

		// 2. Setup Three.js layers on Camera & Sun Shadow Camera
		const camera = this.game.sceneManager.camera;
		if (camera) {
			camera.layers.enable(1); // Layer 1: Active Room Meshes
			camera.layers.enable(2); // Layer 2: Inactive Room Meshes
		}

		const dirLight = this.game.sceneManager.dirLight;
		if (dirLight && dirLight.shadow && dirLight.shadow.camera) {
			dirLight.shadow.camera.layers.enable(1);
			dirLight.shadow.camera.layers.enable(2);
		}

		// Remove old active/inactive room lights if they exist
		if (this.activeRoomAmbientLight) {
			this.game.sceneManager.scene.remove(this.activeRoomAmbientLight);
			this.activeRoomAmbientLight.dispose();
			this.activeRoomAmbientLight = null;
		}
		if (this.inactiveRoomAmbientLight) {
			this.game.sceneManager.scene.remove(this.inactiveRoomAmbientLight);
			this.inactiveRoomAmbientLight.dispose();
			this.inactiveRoomAmbientLight = null;
		}

		// 3. Create room ambient lights on Layer 1 (Active) and Layer 2 (Inactive)
		this.activeRoomAmbientLight = new THREE.AmbientLight(0xffffff, 0.6);
		this.activeRoomAmbientLight.layers.set(1);
		this.game.sceneManager.scene.add(this.activeRoomAmbientLight);

		// Inactive rooms are completely dark (very low ambient intensity)
		this.inactiveRoomAmbientLight = new THREE.AmbientLight(0x111122, 0.05);
		this.inactiveRoomAmbientLight.layers.set(2);
		this.game.sceneManager.scene.add(this.inactiveRoomAmbientLight);

		// 4. Partition meshes & local lights using OBB or automatic ceiling detection
		const worldPos = new THREE.Vector3();
		const sceneChildren = this.game.sceneManager.scene.children;

		sceneChildren.forEach((obj: THREE.Object3D) => {
			// Skip lights that are part of sceneManager, player, sky box, stars, cameras, and rooms themselves
			if (
				obj === this.game.sceneManager.ambientLight ||
				obj === this.game.sceneManager.dirLight ||
				obj === this.game.sceneManager.stars ||
				obj === this.game.sceneManager.skyMesh ||
				obj === this.activeRoomAmbientLight ||
				obj === this.inactiveRoomAmbientLight ||
				(obj.userData && obj.userData.logicProperties && obj.userData.logicProperties.logicKind === "logic_room") ||
				(this.game.character && (obj === this.game.character.glbModel?.model || obj === this.game.character.polygonModel?.model || obj === this.game.character.polygonModelSkin?.model))
			) {
				return;
			}

			// We assign editable objects (blocks, items, structures) to rooms/ceilings
			if (obj.userData && obj.userData.isEditableMapObject) {
				obj.getWorldPosition(worldPos);

				// Check manual rooms volume overlap first
				let isIndoors = false;
				for (const room of this.rooms) {
					if (this.isPointInRoom(worldPos, room)) {
						isIndoors = true;
						break;
					}
				}

				// Check automatic ceiling detection second
				if (!isIndoors) {
					isIndoors = this.isObjectUnderCeiling(obj, sceneChildren);
				}

				if (isIndoors) {
					this.indoorObjects.push(obj);
					// Clone materials for indoor objects so we don't accidentally share state with exterior objects
					obj.traverse((child: any) => {
						if (child.isMesh && child.material) {
							if (Array.isArray(child.material)) {
								child.material = child.material.map(m => m.clone());
							} else {
								child.material = child.material.clone();
							}
						}
					});

					// Put on Inactive Room Layer (Layer 2) initially
					this.setLayersRecursively(obj, 2);
				} else {
					this.outdoorObjects.push(obj);
					// Put on Exterior Layer (Layer 0)
					this.setLayersRecursively(obj, 0);
				}
			}
		});

		// 5. Initialize active lighting values
		const envConfig = this.game.environmentConfig || {};
		this.targetAmbientIntensity = envConfig.ambientIntensity ?? 0.6;
		this.targetAmbientColor.set(envConfig.ambientColor ?? "#ffffff");

		if (this.activeRoomAmbientLight) {
			this.activeRoomAmbientLight.intensity = this.targetAmbientIntensity;
			this.activeRoomAmbientLight.color.copy(this.targetAmbientColor);
		}

		this.initialized = true;
		console.log(`[RoomSystem] Room partitioning complete. Indoor objects: ${this.indoorObjects.length}, Outdoor objects: ${this.outdoorObjects.length}`);
	}

	cleanup() {
		if (!this.initialized) return;
		console.log("[RoomSystem] Cleaning up and restoring default Layer 0 configuration");

		// 1. Reset all partitioned meshes and lights to Layer 0
		this.indoorObjects.forEach(obj => this.setLayersRecursively(obj, 0));
		this.outdoorObjects.forEach(obj => this.setLayersRecursively(obj, 0));

		// 2. Put player character meshes on Layer 0
		const char = this.game.character;
		if (char) {
			if (char.glbModel?.model) this.setLayersRecursively(char.glbModel.model, 0);
			if (char.polygonModel?.model) this.setLayersRecursively(char.polygonModel.model, 0);
			if (char.polygonModelSkin?.model) this.setLayersRecursively(char.polygonModelSkin.model, 0);
			if (char.equippedItem?.group) this.setLayersRecursively(char.equippedItem.group, 0);
		}

		// 3. Remove custom ambient lights from the scene
		if (this.activeRoomAmbientLight) {
			this.game.sceneManager.scene.remove(this.activeRoomAmbientLight);
			this.activeRoomAmbientLight.dispose();
			this.activeRoomAmbientLight = null;
		}
		if (this.inactiveRoomAmbientLight) {
			this.game.sceneManager.scene.remove(this.inactiveRoomAmbientLight);
			this.inactiveRoomAmbientLight.dispose();
			this.inactiveRoomAmbientLight = null;
		}

		// 4. Reset camera layers to default (Layer 0 only)
		const camera = this.game.sceneManager.camera;
		if (camera) {
			camera.layers.set(0);
		}
		const dirLight = this.game.sceneManager.dirLight;
		if (dirLight && dirLight.shadow && dirLight.shadow.camera) {
			dirLight.shadow.camera.layers.set(0);
		}

		// 5. Restore global lighting settings
		if (typeof this.game.updateEnvironmentLighting === "function") {
			this.game.updateEnvironmentLighting();
		}

		this.initialized = false;
		this.currentRoomState = "outdoors";
	}

	isPointInRoom(point: THREE.Vector3, roomGroup: THREE.Object3D): boolean {
		// Transform world point into local space of the room volume
		roomGroup.updateMatrixWorld(true);
		const localPoint = point.clone().applyMatrix4(roomGroup.matrixWorld.clone().invert());
		
		// In local space, BoxGeometry is 1x1x1 and centered at 0,0,0
		// Check if point is within bounds [-0.5, 0.5]
		return Math.abs(localPoint.x) <= 0.5 &&
		       Math.abs(localPoint.y) <= 0.5 &&
		       Math.abs(localPoint.z) <= 0.5;
	}

	isObjectUnderCeiling(objA: THREE.Object3D, allObjects: THREE.Object3D[]): boolean {
		const posA = new THREE.Vector3();
		objA.getWorldPosition(posA);

		for (const objB of allObjects) {
			if (objB === objA) continue;

			// Skip non-geometric objects
			if (
				objB.userData && 
				(objB.userData.logicProperties?.logicKind === "logic_camera" ||
				 objB.userData.logicProperties?.logicKind === "logic_light" ||
				 objB.userData.logicProperties?.logicKind === "logic_room" ||
				 objB.userData.mapObjectType === "spawn_point" ||
				 objB.userData.mapObjectType === "movement_controller" ||
				 objB.userData.mapObjectType === "damage_controller" ||
				 objB.userData.mapObjectType === "interaction_button" ||
				 objB.userData.mapObjectType === "interactive_collision" ||
				 objB.userData.mapObjectType === "target")
			) {
				continue;
			}

			const posB = new THREE.Vector3();
			objB.getWorldPosition(posB);

			// Check if objB is above objA
			if (posB.y > posA.y + 0.5) {
				const dx = posA.x - posB.x;
				const dz = posA.z - posB.z;
				const horizontalDist = Math.sqrt(dx * dx + dz * dz);

				const scaleX = objB.scale?.x ?? 1;
				const scaleZ = objB.scale?.z ?? 1;
				// check horizontal collision distance with threshold
				const limit = Math.max(scaleX, scaleZ) / 2 + 1.0;
				if (horizontalDist < limit) {
					return true;
				}
			}
		}
		return false;
	}

	isPlayerUnderCeiling(allObjects: THREE.Object3D[]): boolean {
		const char = this.game.character;
		if (!char) return false;

		const feetPos = char.getPosition();
		const checkPos = feetPos.clone().add(new THREE.Vector3(0, 1.0, 0)); // player center

		for (const objB of allObjects) {
			if (
				objB.userData && 
				(objB.userData.logicProperties?.logicKind === "logic_camera" ||
				 objB.userData.logicProperties?.logicKind === "logic_light" ||
				 objB.userData.logicProperties?.logicKind === "logic_room" ||
				 objB.userData.mapObjectType === "spawn_point" ||
				 objB.userData.mapObjectType === "movement_controller" ||
				 objB.userData.mapObjectType === "damage_controller" ||
				 objB.userData.mapObjectType === "interaction_button" ||
				 objB.userData.mapObjectType === "interactive_collision" ||
				 objB.userData.mapObjectType === "target")
			) {
				continue;
			}

			const posB = new THREE.Vector3();
			objB.getWorldPosition(posB);

			if (posB.y > checkPos.y) {
				const dx = checkPos.x - posB.x;
				const dz = checkPos.z - posB.z;

				const scaleX = objB.scale?.x ?? 1;
				const scaleZ = objB.scale?.z ?? 1;
				
				if (Math.abs(dx) < scaleX / 2 + 0.8 && Math.abs(dz) < scaleZ / 2 + 0.8) {
					return true;
				}
			}
		}
		return false;
	}

	setLayersRecursively(object: THREE.Object3D, layerId: number) {
		object.layers.set(layerId);
		object.traverse((child: any) => {
			child.layers.set(layerId);
		});
	}

	enableAllLayersOnLights(object: THREE.Object3D) {
		object.traverse((child: any) => {
			if (child instanceof THREE.Light) {
				child.layers.enable(0);
				child.layers.enable(1);
				child.layers.enable(2);
			}
		});
	}

	updateCharacterLayers() {
		const char = this.game.character;
		if (!char) return;

		const targetLayer = (this.currentRoomState === "indoors") ? 1 : 0;

		if (char.glbModel?.model) this.setLayersRecursively(char.glbModel.model, targetLayer);
		if (char.polygonModel?.model) this.setLayersRecursively(char.polygonModel.model, targetLayer);
		if (char.polygonModelSkin?.model) this.setLayersRecursively(char.polygonModelSkin.model, targetLayer);

		if (char.equippedItem && char.equippedItem.group) {
			this.setLayersRecursively(char.equippedItem.group, targetLayer);
			this.enableAllLayersOnLights(char.equippedItem.group);
		}
	}

	update(dt: number) {
		if (this.game.gameMode === "editor") return;

		// 1. Monitor enableRoomDarkness flag changes
		const shouldBeActive = !!this.game.environmentConfig?.enableRoomDarkness;
		if (shouldBeActive !== this.initialized) {
			if (shouldBeActive) {
				this.init();
			} else {
				this.cleanup();
			}
		}

		if (!this.initialized) return;

		// 2. Determine if the player is indoors (inside a manual room volume OR under a ceiling block)
		const char = this.game.character;
		if (!char) return;

		let playerIndoors = false;

		// Check manual rooms first
		const feetPos = char.getPosition();
		const checkPos = feetPos.clone().add(new THREE.Vector3(0, 1.0, 0));
		for (const room of this.rooms) {
			if (this.isPointInRoom(checkPos, room)) {
				playerIndoors = true;
				break;
			}
		}

		// Check automatic ceiling detection second
		if (!playerIndoors) {
			playerIndoors = this.isPlayerUnderCeiling(this.game.sceneManager.scene.children);
		}

		const currentTargetState = playerIndoors ? "indoors" : "outdoors";

		// 3. Manage Room Transition
		if (currentTargetState !== this.currentRoomState) {
			const prevState = this.currentRoomState;
			this.currentRoomState = currentTargetState;

			console.log(`[RoomSystem] Player room transition: ${prevState} -> ${currentTargetState}`);

			if (this.currentRoomState === "indoors") {
				// Player entered a covered area -> move indoor objects to Active Layer 1
				this.indoorObjects.forEach(obj => this.setLayersRecursively(obj, 1));
				
				// Set ambient light targets to dark room settings
				this.targetAmbientIntensity = 0.05;
				this.targetAmbientColor.set("#050510");
			} else {
				// Player walked outside -> move indoor objects to Inactive Layer 2 (so they look dark from outside)
				this.indoorObjects.forEach(obj => this.setLayersRecursively(obj, 2));

				// Restore ambient light targets to Exterior default settings
				const envConfig = this.game.environmentConfig || {};
				this.targetAmbientIntensity = envConfig.ambientIntensity ?? 0.6;
				this.targetAmbientColor.set(envConfig.ambientColor ?? "#ffffff");
			}

			// Apply layers to character models
			this.updateCharacterLayers();
		}

		// 4. Smooth lighting interpolation (eye adaptation)
		if (this.activeRoomAmbientLight) {
			this.activeRoomAmbientLight.intensity = THREE.MathUtils.lerp(
				this.activeRoomAmbientLight.intensity,
				this.targetAmbientIntensity,
				dt * this.transitionSpeed
			);
			this.activeRoomAmbientLight.color.lerp(this.targetAmbientColor, dt * this.transitionSpeed);
		}
	}
}

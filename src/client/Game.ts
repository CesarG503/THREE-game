import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { SceneManager } from "./core/SceneManager";
import { InputManager } from "./input/InputManager";
import { CameraController } from "./camera/CameraController";
import { ScopeController } from "./camera/ScopeController";
import { CharacterController } from "./character/CharacterController";
import { NetworkManager } from "./network/NetworkManager";
import { ChatManager } from "./network/ChatManager";
import { NPCRapier } from "./entities/NPCRapier";
import { ImpulsePlatform } from "./entities/ImpulsePlatform";
import { PlacementManager } from "./editor/PlacementManager";
import { InventoryManager } from "./items/InventoryManager";
import { ItemDropManager } from "./items/ItemDropManager";
import { Item } from "./items/Item";
import { ImpulseItem } from "./items/objects/ImpulseItem";
import { FarmingZoneItem } from "./items/objects/FarmingZoneItem";
import { FarmingZone } from "./entities/FarmingZone";
import { FuegoItem } from "./items/droppables/FuegoItem";
import { TurretItem } from "./items/weapons/TurretItem";
import { TurretPad } from "./entities/TurretPad";
import { PelotaItem } from "./items/weapons/PelotaItem";
import { MapObjectItem } from "./items/objects/MapObjectItem";
import { mapObjectFactory } from "./items/objects/MapObjectFactory";
import { PlayerConfigManager } from "./managers/PlayerConfigManager";
import { FloatingTextManager } from "./ui/FloatingTextManager";
import { Projectile } from "./weapons/Projectile";
import { BlasterSystem } from "./fx/BlasterSystem";
import { Router } from "./routing/Router";
import { GunItem } from "./items/weapons/GunItem";
import { JetpackItem } from "./items/consumables/JetpackItem";
import { setupGameInput } from "./core/GameInput";
import { animate, setupDebugRender, setupOrientationGizmo, updateDebugRender, renderOrientationGizmo } from "./core/GameLoop";
import { setupMultiplayerUI, updateConnectionStatus, handleRemoteShoot } from "./core/GameNetwork";
import { buildEnvironment, loadLevelFromFile, updateEnvironmentConfig } from "./core/GameEnvironment";
import { setupEditorUI, saveMap, loadMap, useCurrentItem, _loadSingleMapObject, deleteObjectByUuid, broadcastObjectUpdate, setObjectBodyType, updateButtonInteraction, emitSignal, triggerButton, updateCollisionLogic, updateMovementLogic, triggerGravitySphere } from "./core/GameEditor";
import { regenerateObjectPhysics, updateObjectPhysics } from "./core/GamePhysics";
import { GameHUD } from "./ui/GameHUD";
import { ObjectInspector } from "./ui/ObjectInspector";
import { createItemFromNetworkData, serializeItemForNetwork } from "./items/ItemNetworkSerializer";
import { getMapData, loadPlatformMapForRoom, type PlatformMap } from "./platform/mapRuntime";
import { DEFAULT_SKYBOX_TYPE } from "./platform/mapDefaults";

export class Game {
	sceneManager: any;
	inputManager: any;
	clock: any;
	world: any;
	eventQueue: any;
	router: any;
	gameMode: any;
	roomId: any;
	character: any;
	playerConfigManager: any;
	hud: any;
	floatingTextManager: any;
	cameraController: any;
	scopeController: any;
	networkManager: any;
	chatManager: any;
	placementManager: any;
	platforms: any;
	farmingZones: any;
	projectiles: any;
	fxBlasterSystem: any;
	constructionMenu: any;
	objectInspector: any;
	inventoryManager: any;
	itemDropManager: any;
	pendingItemPickups: Map<string, any>;
	fuegoCount: number;
	farmingZoneCounts: { [groupId: string]: number };
	environmentConfig: any;
	invisibleWallMeshes: any;
	invisibleWallBodies: any;
	groundGroup: any;
	groundBody: any;
	groundColliders: any;
	debugEnabled: boolean;
	debugMesh: any;
	gizmoScene: any;
	gizmoAxes: any;
	gizmoCamera: any;
	placementRotationIndex: number;
	isFKeyDown: boolean;
	fKeyHeldTime: number;
	farmingZone: any;
	isMovingFarmingZone: boolean;
	moveGhost: any;
	npc: any;
	_netAttackLatch: boolean;
	_isApplyingRemoteEdit: boolean;
	GunItemClass: any;
	PelotaItemClass: any;
	activePlatformMap: PlatformMap | null;
	_routeMapLoadStarted: boolean;
	isDisposed: boolean;
	animationFrameId: number | null;

	animate: any;
	setupDebugRender: any;
	updateDebugRender: any;
	setupOrientationGizmo: any;
	renderOrientationGizmo: any;
	setupGameInput: any;
	setupMultiplayerUI: any;
	updateConnectionStatus: any;
	handleRemoteShoot: any;
	buildEnvironment: any;
	loadLevelFromFile: any;
	updateEnvironmentConfig: any;
	setupEditorUI: any;
	saveMap: any;
	loadMap: any;
	useCurrentItem: any;
	_loadSingleMapObject: any;
	deleteObjectByUuid: any;
	broadcastObjectUpdate: any;
	setObjectBodyType: any;
	updateButtonInteraction: any;
	emitSignal: any;
	triggerButton: any;
	triggerGravitySphere: any;
	updateCollisionLogic: any;
	updateMovementLogic: any;
	regenerateObjectPhysics: any;
	updateObjectPhysics: any;

	constructor(router?: Router) {
		this.router = router || new Router();
		this.isDisposed = false;
		this.animationFrameId = null;
		this.bindModuleMethods();

		RAPIER.init().then(() => {
			if (this.isDisposed) return;
			console.log("Rapier Physics Initialized");
			this.initGame();
		});
	}

	bindModuleMethods() {
		this.animate = animate.bind(this);
		this.setupDebugRender = setupDebugRender.bind(this);
		this.updateDebugRender = updateDebugRender.bind(this);
		this.setupOrientationGizmo = setupOrientationGizmo.bind(this);
		this.renderOrientationGizmo = renderOrientationGizmo.bind(this);
		this.setupGameInput = setupGameInput.bind(this);
		this.setupMultiplayerUI = setupMultiplayerUI.bind(this);
		this.updateConnectionStatus = updateConnectionStatus.bind(this);
		this.handleRemoteShoot = handleRemoteShoot.bind(this);
		this.buildEnvironment = buildEnvironment.bind(this);
		this.loadLevelFromFile = loadLevelFromFile.bind(this);
		this.updateEnvironmentConfig = updateEnvironmentConfig.bind(this);
		this.setupEditorUI = setupEditorUI.bind(this);
		this.saveMap = saveMap.bind(this);
		this.loadMap = loadMap.bind(this);
		this.useCurrentItem = useCurrentItem.bind(this);
		this._loadSingleMapObject = _loadSingleMapObject.bind(this);
		this.deleteObjectByUuid = deleteObjectByUuid.bind(this);
		this.broadcastObjectUpdate = broadcastObjectUpdate.bind(this);
		this.setObjectBodyType = setObjectBodyType.bind(this);
		this.updateButtonInteraction = updateButtonInteraction.bind(this);
		this.emitSignal = emitSignal.bind(this);
		this.triggerButton = triggerButton.bind(this);
		this.triggerGravitySphere = triggerGravitySphere.bind(this);
		this.updateCollisionLogic = updateCollisionLogic.bind(this);
		this.updateMovementLogic = updateMovementLogic.bind(this);
		this.regenerateObjectPhysics = regenerateObjectPhysics.bind(this);
		this.updateObjectPhysics = updateObjectPhysics.bind(this);
	}

	initGame() {
		if (this.isDisposed) return;
		this.sceneManager = new SceneManager("game-container");
		this.inputManager = new InputManager();
		this.clock = new THREE.Clock();

		const gravity = { x: 0.0, y: -20.0, z: 0.0 };
		this.world = new RAPIER.World(gravity);
		this.eventQueue = new RAPIER.EventQueue(true);

		this.gameMode = this.router.getMode();
		this.roomId = this.router.getRoomId();
		console.log(`[Game] Empezando en modo ${this.gameMode} - Sala: ${this.roomId}`);

		this.character = new CharacterController(
			this.sceneManager.scene,
			this.world,
			this.sceneManager.camera,
			null
		);
		if (this.gameMode === "editor") {
			this.character.canFly = true;
			console.log("Editor Mode Enabled: Flight Active");
		}

		this.playerConfigManager = new PlayerConfigManager(this);
		this.hud = new GameHUD();

		this.floatingTextManager = new FloatingTextManager(this.sceneManager);

		this.cameraController = new CameraController(
			this.sceneManager.camera,
			this.sceneManager.renderer.domElement
		);
		this.cameraController.character = this.character;
		this.scopeController = new ScopeController(this.sceneManager.camera, this);
		this.sceneManager.renderer.autoClear = false;
		this.setupOrientationGizmo();

		this.character.cameraController = this.cameraController;

		this.networkManager = new NetworkManager(this.sceneManager.scene, this.world, this.roomId, (id: any) => {
			console.log("Player joined", id);
			this.updateConnectionStatus(true, id);
		});
		this.networkManager.particleSystem = this.character.particleSystem;

		if (this.gameMode === "editor") {
			this.networkManager.collaborativeMode = true;
		}

		this.chatManager = new ChatManager(this.networkManager);

		this.placementManager = new PlacementManager(this.sceneManager.scene, this.sceneManager.camera);

		if (this.gameMode !== "editor") {
			// NPC removido temporalmente para manejarlo en lógica de partida
		}

		this.platforms = [];
		this.farmingZones = [];
		this.projectiles = [];
		this.fxBlasterSystem = new BlasterSystem(this.sceneManager.scene);
		this.pendingItemPickups = new Map();
		this._netAttackLatch = false;
		this.isFKeyDown = false;
		this.fKeyHeldTime = 0;
		this.isMovingFarmingZone = false;
		this.moveGhost = null;
		this.npc = null;
		this.activePlatformMap = null;
		this._routeMapLoadStarted = false;

		this.networkManager.onChatMessage = (playerId: any, playerName: any, msg: any) => {
			this.chatManager.addChatMessage(playerId, playerName, msg);
		};

		this._isApplyingRemoteEdit = false;

		this.networkManager.onEditorPlace = (data: any) => {
			if (this.gameMode !== "editor") return;
			this._isApplyingRemoteEdit = true;
			this._loadSingleMapObject(data);
			if (this.constructionMenu) this.constructionMenu.refreshLogicList();
			this._isApplyingRemoteEdit = false;
		};

		this.networkManager.onEditorRemove = (uuid: any) => {
			if (this.gameMode !== "editor") return;
			this._isApplyingRemoteEdit = true;
			this.deleteObjectByUuid(uuid);
			if (this.constructionMenu) this.constructionMenu.refreshLogicList();
			this._isApplyingRemoteEdit = false;
		};

		this.networkManager.onRequestMapSync = (targetId: any) => {
			if (this.gameMode !== "editor") return;
			console.log(`[Collab] Servidor pidió mi mapa para sincronizar al jugador ${targetId}. Generando...`);
			const mapJson = this.saveMap();
			this.networkManager.sendMapSyncData(targetId, JSON.stringify(mapJson));
		};

		this.networkManager.onMapSyncData = (mapData: any) => {
			if (this.gameMode !== "editor") return;
			console.log("[Collab] Recibiendo estado de mapa completo (Late Joiner/Broadcast Sync)...");
			try {
				const mapJson = typeof mapData === "string" ? JSON.parse(mapData) : mapData;
				this._isApplyingRemoteEdit = true;
				this.loadMap(mapJson);
				this._isApplyingRemoteEdit = false;
				console.log("[Collab] Mapa sincronizado exitosamente.");
			} catch (e) {
				console.error("[Collab] Error parseando mapa recibido:", e);
			}
		};

		this.networkManager.onGameConfigUpdate = (configData: any) => {
			console.log("[Collab] Actualización de configuración global recibida", configData);
			if (this.constructionMenu && this.constructionMenu.logicSystem) {
				this.constructionMenu.logicSystem.gameConfig = configData;

				if (this.constructionMenu.gameConfigPanel) {
					this.constructionMenu.gameConfigPanel.render();
					if (this.constructionMenu.gameConfigPanel.contentServerSettings.style.display !== "none") {
						this.constructionMenu.gameConfigPanel.renderServerSettings();
					}
				}
			}
		};

		this.networkManager.onPlayerConfigUpdate = (configData: any) => {
			console.log("[Collab] Actualización de configuración de jugador recibida", configData);
			this.playerConfigManager.loadData(configData);

			if (this.constructionMenu && this.constructionMenu.playerConfigPanel) {
				if (this.constructionMenu.playerConfigPanel.container) {
					this.constructionMenu.playerConfigPanel.render();
				}
			}

			this.playerConfigManager.applyConfiguration();
		};

		this.networkManager.onSimulationControl = (action: any, state: any) => {
			console.log(`[Collab] Control de Simulación Global recibido: ${action}`, state);
			if (this.constructionMenu && this.constructionMenu.logicSystem) {
				this.constructionMenu.logicSystem.handleSimulationControlMessage(action, state);
			}
		};

		this.networkManager.onPlayerShoot = (playerId: any, startPos: any, direction: any, type: any, speed: any, damage: any, drop: any, rebote: any, hasImpactEffect: any, hasTracer: any, hasTrajectoryLine: any, customTracerVFX = "Ninguno", customImpactVFX = "Ninguno", tracerDestroyOnCollision = false, tracerStayForever = false, tracerCollisionVFX = "Ninguno") => {
			console.log(`[Collab] Player ${playerId} disparó un ${type}!`);
			this.handleRemoteShoot(startPos, direction, type, speed, damage, drop, rebote, hasImpactEffect, hasTracer, hasTrajectoryLine, customTracerVFX, customImpactVFX, tracerDestroyOnCollision, tracerStayForever, tracerCollisionVFX, playerId);
		};

		this.networkManager.onGroundItemsSync = (items: any[]) => {
			if (!this.itemDropManager) return;
			console.log(`[Items] Sincronizando ${items.length} items del suelo.`);
			this.itemDropManager.syncGroundItems(items);
		};

		this.networkManager.onPlayerAction = (playerId: any, actionType: any, data: any) => {
			if (actionType === "dropItem") {
				const newItem = createItemFromNetworkData(data.itemData);

				const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
				const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
				const dropped = this.itemDropManager.dropItem(newItem, pos, dir, data.dropId, { torque: data.torque });
				if (dropped && data.state) {
					dropped.applyNetworkState(data.state, playerId);
				}
			} else if (actionType === "pickupItem") {
				const pickedBy = data.pickedBy || playerId;
				if (pickedBy === this.networkManager.playerId) {
					const pending = this.pendingItemPickups.get(data.dropId);
					this.pendingItemPickups.delete(data.dropId);
					const picked = pending?.item || createItemFromNetworkData(data.itemData);

					if (picked.id === "fuego") {
						const valueAdded = picked.value || 1;
						const gId = picked.groupId || "Grupo 1";

						this.fuegoCount += valueAdded;
						if (!this.farmingZoneCounts) this.farmingZoneCounts = {};
						if (this.farmingZoneCounts[gId] === undefined) this.farmingZoneCounts[gId] = 0;
						this.farmingZoneCounts[gId] += valueAdded;

						const counterEl = document.getElementById("fuego-count");
						if (counterEl) counterEl.textContent = this.fuegoCount.toString();

						if (this.hud && this.hud.updateFarmingCounters) {
							this.hud.updateFarmingCounters(this);
						}
					} else {
						const added = this.inventoryManager.addItem(picked);
						if (!added) {
							const charPos = this.character.getPosition();
							const camDir = new THREE.Vector3();
							this.sceneManager.camera.getWorldDirection(camDir);
							const droppedBack = this.itemDropManager.dropItem(picked, charPos, camDir);

							if (droppedBack && this.networkManager && this.networkManager.isConnected) {
								this.networkManager.sendPlayerAction("dropItem", {
									dropId: droppedBack.dropId,
									itemData: serializeItemForNetwork(picked),
									position: { x: charPos.x, y: charPos.y, z: charPos.z },
									direction: { x: camDir.x, y: camDir.y, z: camDir.z },
									torque: droppedBack.torque
								});
							}
						}
					}
				} else {
					this.itemDropManager.removeItemByDropId(data.dropId);
					this.pendingItemPickups.delete(data.dropId);
				}
			} else if (actionType === "pickupDenied") {
				this.pendingItemPickups.delete(data.dropId);
			} else if (actionType === "groundItemState") {
				if (this.itemDropManager && Array.isArray(data?.updates)) {
					this.itemDropManager.applyNetworkPhysicsStates(data.updates, playerId);
				}
			} else if (actionType === "spawn-effect") {
				if (this.character && this.character.particleSystem && data) {
					const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
					if (data.effectType === "jump") {
						this.character.particleSystem.spawnJumpEffect(pos);
					} else if (data.effectType === "impact") {
						const normal = data.normal ? new THREE.Vector3(data.normal.x, data.normal.y, data.normal.z) : new THREE.Vector3(0, 1, 0);
						this.character.particleSystem.spawnImpactEffect(pos, normal);
					} else if (data.effectType === "explosion") {
						this.character.particleSystem.spawnExplosionEffect(pos);
					}
				}
			} else if (actionType === "air-jump") {
				if (this.character && this.character.particleSystem && data) {
					const pos = new THREE.Vector3(data.x, data.y, data.z);
					this.character.particleSystem.spawnJumpEffect(pos);
				}
			}
		};

		document.addEventListener("chatFocus", () => {
			this.inputManager.enabled = false;
		});

		document.addEventListener("chatBlur", () => {
			this.inputManager.enabled = true;
		});

		this.setupSettingsPanel();
		this.setupMultiplayerUI();
		this.prepareInventoryContainer();

		const profile = this.playerConfigManager.getCurrentProfile();
		if (profile) {
			if (profile.stats) this.character.setStats(profile.stats);
			if (profile.hudSettings) this.hud.createHUD(profile.hudSettings);
		}

		this.character.on("healthChanged", (data: any) => {
			this.hud.updateHealth(data.current, data.max);
		});
		this.character.on("jumpChanged", (data: any) => {
			this.hud.updateJump(data.current, data.max);
			if (data.type === "air-jump" && this.networkManager) {
				const pos = this.character.getPosition();
				this.networkManager.sendPlayerAction("spawn-effect", {
					effectType: "jump",
					pos: { x: pos.x, y: pos.y, z: pos.z }
				});
			}
		});

		this.inventoryManager = new InventoryManager("inventory-container");
		this.itemDropManager = new ItemDropManager(this.sceneManager.scene, this.world);

		this.fuegoCount = 0;
		this.farmingZoneCounts = {};
		if (this.gameMode !== "editor") {
			// Farming Zone removida temporalmente
		}

		this.environmentConfig = {
			mapSizeX: 100,
			mapSizeZ: 100,
			invisibleWalls: false,
			fallDeath: true,
			fallDeathY: -20,
			skyType: DEFAULT_SKYBOX_TYPE,
			groundTexturePath: null,
			groundTextureAssetId: null,
			groundTextureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false }
		};
		this.invisibleWallMeshes = [];
		this.invisibleWallBodies = [];

		this.groundGroup = new THREE.Group();
		this.groundGroup.position.y = -0.5;
		this.sceneManager.scene.add(this.groundGroup);

		const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
		this.groundBody = this.world.createRigidBody(groundBodyDesc);
		this.groundColliders = [];

		this.updateEnvironmentConfig(this.environmentConfig);

		if (this.gameMode === "editor") {
			const wall = mapObjectFactory.create("wall", "Pared", "wall", "/assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 3, z: 0.5 });
			const pillar = mapObjectFactory.create("pillar", "Pilar", "pillar", "/assets/textures/salto.png", 0xFFFFFF, { x: 1, y: 4, z: 1 });
			const floor = mapObjectFactory.create("floor", "Suelo", "wall", "/assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 0.5, z: 5 });
			const ramp = mapObjectFactory.create("stairs", "Gradas", "stairs", "/assets/textures/impulso.png", 0xFFFFFF, { x: 4, y: 2, z: 4 });
			const tall = mapObjectFactory.create("tall", "Torre", "pillar", "/assets/textures/salto.png", 0xFFFFFF, { x: 2, y: 10, z: 2 });

			this.inventoryManager.addItem(wall);
			this.inventoryManager.addItem(pillar);
			this.inventoryManager.addItem(floor);
			this.inventoryManager.addItem(ramp);
			this.inventoryManager.addItem(tall);
			this.ensureEditorInventoryVisible();

			this.setupEditorUI();

			// @ts-ignore legacy UI module from public/js
			import("./ui/ConstructionMenu").then((module: any) => {
				if (this.isDisposed) return;
				this.constructionMenu = new module.ConstructionMenu(this.inventoryManager, this);
				this.ensureEditorInventoryVisible();
				void this.loadInitialPlatformMap();
			});

			this.objectInspector = new ObjectInspector(this);
		}

		if (this.inventoryManager && this.character) {
			this.inventoryManager.onItemChange = (item: any) => {
				console.log("Item Changed:", item ? item.name : "None");
				this.character.setHeldItem(item);
			};
		}

		if (this.gameMode === "editor" && this.inventoryManager) {
			this.inventoryManager.enableDragAndDrop((slotIndex: number) => {
				if (this.constructionMenu && this.constructionMenu.draggedItem) {
					const source = this.constructionMenu.draggedItem;

					let newItem: any;

					if (source instanceof GunItem || source.type === "weapon") {
						if (source.clone) {
							newItem = source.clone();
						} else {
							newItem = new GunItem();
							newItem.damage = source.damage;
							newItem.cooldown = source.cooldown;
							newItem.equippedHand = source.equippedHand;
							newItem.recoil = source.recoil !== undefined ? source.recoil : 5.0;
							newItem.recoilMode = source.recoilMode !== undefined ? source.recoilMode : "hybrid";
							newItem.isAuto = source.isAuto !== undefined ? source.isAuto : false;
						}
					} else if (source instanceof ImpulseItem) {
						newItem = new ImpulseItem(source.id, source.name, source.iconPath, source.type, source.strength);
					} else if (source instanceof FarmingZoneItem) {
						newItem = new FarmingZoneItem();
					} else if (source instanceof JetpackItem || source.type === "consumable") {
						if (source.clone) {
							newItem = source.clone();
						} else {
							newItem = new JetpackItem(source);
						}
					} else {
						newItem = mapObjectFactory.create(
							source.id,
							source.name,
							source.type,
							"",
							source.color,
							source.scale,
							source.texturePath,
							source.textureAssetId,
							source.textureSettings
						);
						if (source.logicProperties) {
							newItem.logicProperties = { ...source.logicProperties };
						}
						if (source.opacity !== undefined) {
							newItem.opacity = source.opacity;
						}
					}

					this.inventoryManager.setItem(slotIndex, newItem);
					console.log("Equipped", newItem.name, "to slot", slotIndex + 1);
				}
			});
		}

		this.setupGameInput();

		if (this.gameMode !== "editor") {
			void this.loadInitialPlatformMap();
		}

		this.debugEnabled = false;
		this.setupDebugRender();

		this.GunItemClass = GunItem;
		this.PelotaItemClass = PelotaItem;

		this.animate = this.animate.bind(this);
		this.animationFrameId = requestAnimationFrame(this.animate);

		document.addEventListener("mousedown", (e) => {
			if (e.target !== this.sceneManager.renderer.domElement) return;

			if (this.gameMode === "editor") {
				if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.isEditingMap) {
					const logicSys = this.constructionMenu.logicSystem;
					if (logicSys.isWaypointGizmoInteracting && logicSys.isWaypointGizmoInteracting()) return;
					if (e.button === 2) {
						if (logicSys.handleMapRightClick) logicSys.handleMapRightClick(e);
						return;
					}
					if (logicSys.toolbar.activeTool === "waypoint" && e.button === 0) {
						const pos = this.placementManager.getCurrentTarget();
						if (pos && logicSys.editingObject) {
							const wp = logicSys.addWaypointFromPlacement(pos, this.placementManager.placementGhost.rotation);
							console.log("Waypoint Added via Map Tool", wp);
						}
						return;
					}
				}

				if (e.button === 2 && this.constructionMenu && this.constructionMenu.isPickingTarget) {
					const mouse = new THREE.Vector2();
					if (document.pointerLockElement) {
						mouse.x = 0; mouse.y = 0;
					} else {
						mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
						mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
					}
					const raycaster = new THREE.Raycaster();
					raycaster.setFromCamera(mouse, this.sceneManager.camera);
					const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true);

					const hit = intersects.find((h: any) => h.object.userData && h.object.userData.isEditableMapObject);

					if (hit) {
						if (this.constructionMenu.pickingCallback) {
							this.constructionMenu.pickingCallback(hit.object);
							this.constructionMenu.isPickingTarget = false;
							this.constructionMenu.pickingCallback = null;
							this.constructionMenu.pickingController = null;
						} else if (this.constructionMenu.pickingController) {
							const controller = this.constructionMenu.pickingController;
							const target = hit.object;

							if (target === controller) {
								alert("No puedes vincular el controlador a sí mismo.");
								return;
							}

							controller.userData.logicProperties.targetUuid = target.userData.uuid;
							alert(`Objetivo vinculado: ${target.userData.mapObjectType || "Objeto"}`);
							this.constructionMenu.renderLogicProperties(controller);
							this.constructionMenu.isPickingTarget = false;
							this.setObjectBodyType(target, "kinematic");
						}
					}
					return;
				}

				const selectEditableObjectFromPointer = () => {
					const mouse = new THREE.Vector2();
					if (document.pointerLockElement) {
						mouse.x = 0;
						mouse.y = 0;
					} else {
						mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
						mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
					}

					const raycaster = new THREE.Raycaster();
					raycaster.setFromCamera(mouse, this.sceneManager.camera);

					const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true);

					const hit = intersects.find((h: any) => {
						let obj = h.object;
						while (obj) {
							if (obj.userData && obj.userData.isEditableMapObject) return true;
							obj = obj.parent;
						}
						return false;
					});

					if (!hit) return null;

					let target = hit.object;
					while (target && (!target.userData || !target.userData.isEditableMapObject)) {
						target = target.parent;
					}
					return target || null;
				};

					if (this.objectInspector && e.button === 2) {
						const target = selectEditableObjectFromPointer();
						if (target) {
							if (this.objectInspector.isVisible && this.objectInspector.selectedObject && this.objectInspector.selectedObject !== target) {
								if (!this.objectInspector.allowDynamicSwitch) {
									return;
								}
							}
							this.objectInspector.show(target);
						}
					}
				}
			}, false);

		document.addEventListener("contextmenu", (e) => e.preventDefault(), false);

	}

	prepareInventoryContainer() {
		let inventoryContainer = document.getElementById("inventory-container");
		if (!inventoryContainer) {
			inventoryContainer = document.createElement("div");
			inventoryContainer.id = "inventory-container";
			document.body.appendChild(inventoryContainer);
		}

		if (inventoryContainer.querySelectorAll(".inventory-slot").length !== 9) {
			inventoryContainer.replaceChildren();
			for (let index = 0; index < 9; index += 1) {
				const slot = document.createElement("div");
				slot.className = `inventory-slot${index === 0 ? " active" : ""}`;
				const number = document.createElement("span");
				number.className = "slot-number";
				number.textContent = String(index + 1);
				slot.appendChild(number);
				inventoryContainer.appendChild(slot);
			}
		}

		inventoryContainer.style.visibility = "visible";
		inventoryContainer.style.opacity = "1";
		inventoryContainer.style.pointerEvents = "auto";
	}

	showInventoryContainer(inventoryContainer = document.getElementById("inventory-container")) {
		if (!inventoryContainer) return;

		inventoryContainer.style.visibility = "visible";
		inventoryContainer.style.opacity = "1";
		inventoryContainer.style.pointerEvents = "auto";

		const computedDisplay = getComputedStyle(inventoryContainer).display;
		if (computedDisplay === "none" || inventoryContainer.style.display === "none") {
			inventoryContainer.style.display = "flex";
		}
	}

	ensureEditorInventoryVisible() {
		if (this.gameMode !== "editor") return;

		const profile = this.playerConfigManager?.getCurrentProfile?.();
		if (profile?.hudSettings) {
			profile.hudSettings.showInventory = true;
			this.hud.createHUD(profile.hudSettings);
		}

		this.showInventoryContainer();
		this.inventoryManager?.updateUI?.();
	}

	dispose() {
		if (this.isDisposed) return;
		this.isDisposed = true;

		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		if (this.networkManager) {
			this.networkManager.disconnect();
			this.networkManager.remotePlayers?.forEach((player: any) => player.dispose?.());
			this.networkManager.remotePlayers?.clear?.();
		}

		if (this.scopeController?.destroy) {
			this.scopeController.destroy();
		}

		this.projectiles?.forEach((projectile: any) => projectile.destroy?.());
		this.itemDropManager?.droppedItems?.forEach((item: any) => item.dispose?.());
		this.fxBlasterSystem?.Destroy?.();
		this.character?.dispose?.();
		this.hud?.destroy?.();
		this.objectInspector?.destroy?.();
		this.constructionMenu?.logicSystem?.dispose?.();

		if (document.pointerLockElement) {
			document.exitPointerLock?.();
		}

		[
			"chat-container",
			"construction-menu",
			"object-inspector",
			"logic-toolbar",
			"logic-sequence-editor",
			"game-hud-layer",
			"aerial-grid-status",
			"placement-logic-toolbar",
			"game-timer-display",
		].forEach((id) => document.getElementById(id)?.remove());

		document.querySelectorAll("[id^='fz-counter-']").forEach((element) => element.remove());
		const inventoryContainer = document.getElementById("inventory-container");
		if (inventoryContainer) {
			inventoryContainer.style.display = "none";
		}

		if (this.sceneManager?.dispose) {
			this.sceneManager.dispose();
		} else {
			document.getElementById("game-container")?.replaceChildren();
		}

		this.world = null;
		this.eventQueue = null;
		console.log(`[Game] Experiencia cerrada: ${this.gameMode} / ${this.roomId}`);
	}

	async loadInitialPlatformMap() {
		if (this.isDisposed) return;
		if (!this.roomId || this._routeMapLoadStarted) return;
		this._routeMapLoadStarted = true;

		const map = await loadPlatformMapForRoom(this.roomId);
		if (this.isDisposed) return;
		const data = getMapData(map);
		if (!map || !data) return;

		this.activePlatformMap = map;
		this.loadMap(data);
		if (this.constructionMenu?.refreshLogicList) {
			this.constructionMenu.refreshLogicList();
		}

		window.dispatchEvent(new CustomEvent("platformMapLoaded", { detail: map }));
		console.log(`[Maps] Loaded saved map: ${map.name} (${map.slug})`);
	}

	setupSettingsPanel() {
		const settingsPanel = document.getElementById("settings-panel") as HTMLElement | null;
		const overlay = document.getElementById("overlay") as HTMLElement | null;
		const resumeBtn = document.getElementById("resume-btn") as HTMLElement | null;

		if (!settingsPanel || !overlay || !resumeBtn) return;

		const tabs = document.querySelectorAll(".tab-btn");
		const contents = document.querySelectorAll(".settings-content");

		tabs.forEach((tab) => {
			tab.addEventListener("click", () => {
				tabs.forEach((t) => t.classList.remove("active"));
				contents.forEach((c) => c.classList.remove("active"));

				tab.classList.add("active");
				const target = document.getElementById((tab as HTMLElement).dataset.tab || "");
				if (target) target.classList.add("active");
			});
		});

		const fpInvertX = document.getElementById("fp-invert-x") as HTMLInputElement | null;
		const fpInvertY = document.getElementById("fp-invert-y") as HTMLInputElement | null;
		const tpInvertX = document.getElementById("tp-invert-x") as HTMLInputElement | null;
		const tpInvertY = document.getElementById("tp-invert-y") as HTMLInputElement | null;
		const tpDynamicOffset = document.getElementById("tp-dynamic-offset") as HTMLInputElement | null;
		const tpTrackingCheckbox = document.getElementById("tp-tracking") as HTMLInputElement | null;
		const cameraModeText = document.getElementById("camera-mode-text") as HTMLElement | null;

		document.addEventListener("gamePauseChanged", (e: any) => {
			if (e.detail.isPaused) {
				settingsPanel.style.display = "block";
				overlay.style.display = "block";

				if (fpInvertX) fpInvertX.checked = e.detail.fpInvertAxisX;
				if (fpInvertY) fpInvertY.checked = e.detail.fpInvertAxisY;
				if (tpInvertX) tpInvertX.checked = e.detail.tpInvertAxisX;
				if (tpInvertY) tpInvertY.checked = e.detail.tpInvertAxisY;

				if (tpDynamicOffset) tpDynamicOffset.checked = this.cameraController.enableDynamicOffset;
				if (tpTrackingCheckbox) tpTrackingCheckbox.checked = this.cameraController.alwaysRotateThirdPerson;

				const camHorizontalOffset = document.getElementById("cam-horizontal-offset") as HTMLInputElement | null;
				const camHorizontalOffsetVal = document.getElementById("cam-horizontal-offset-val") as HTMLElement | null;
				if (camHorizontalOffset) {
					camHorizontalOffset.value = this.cameraController.horizontalOffset;
					if (camHorizontalOffsetVal) camHorizontalOffsetVal.textContent = this.cameraController.horizontalOffset.toFixed(2);
				}

				if (cameraModeText) cameraModeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person";
			} else {
				settingsPanel.style.display = "none";
				overlay.style.display = "none";
			}
		});

		resumeBtn.addEventListener("click", () => {
			this.cameraController.togglePause();
		});

		overlay.addEventListener("click", () => {
			this.cameraController.togglePause();
		});

		if (fpInvertX) fpInvertX.addEventListener("change", (e: any) => this.cameraController.setFpInvertAxisX(e.target.checked));
		if (fpInvertY) fpInvertY.addEventListener("change", (e: any) => this.cameraController.setFpInvertAxisY(e.target.checked));
		if (tpInvertX) tpInvertX.addEventListener("change", (e: any) => this.cameraController.setTpInvertAxisX(e.target.checked));
		if (tpInvertY) tpInvertY.addEventListener("change", (e: any) => this.cameraController.setTpInvertAxisY(e.target.checked));

		if (tpDynamicOffset) {
			tpDynamicOffset.addEventListener("change", (e: any) => {
				this.cameraController.enableDynamicOffset = e.target.checked;
			});
		}

		if (tpTrackingCheckbox) {
			tpTrackingCheckbox.addEventListener("change", (e: any) => {
				this.cameraController.setAlwaysRotateThirdPerson(e.target.checked);
			});
		}

		const renderDistance = document.getElementById("graphics-render-distance") as HTMLInputElement | null;
		const renderDistanceVal = document.getElementById("graphics-render-distance-val") as HTMLElement | null;
		if (renderDistance && renderDistanceVal) {
			if (this.sceneManager.scene.fog && this.sceneManager.scene.fog.isFog) {
				renderDistance.value = this.sceneManager.scene.fog.far;
				renderDistanceVal.textContent = String(this.sceneManager.scene.fog.far);
			} else {
				renderDistance.value = this.sceneManager.camera.far;
				renderDistanceVal.textContent = String(this.sceneManager.camera.far);
			}

			renderDistance.addEventListener("input", (e: any) => {
				const val = parseInt(e.target.value);
				this.sceneManager.setRenderDistance(val);
				renderDistanceVal.textContent = String(val);
			});
		}

		const camSmoothing = document.getElementById("cam-smoothing") as HTMLInputElement | null;
		const camSmoothingVal = document.getElementById("cam-smoothing-val") as HTMLElement | null;
		if (camSmoothing && camSmoothingVal) {
			camSmoothing.addEventListener("input", (e: any) => {
				const val = parseFloat(e.target.value);
				this.cameraController.setSmoothing(val);
				camSmoothingVal.textContent = val.toFixed(2);
			});
			camSmoothing.value = this.cameraController.smoothing;
			camSmoothingVal.textContent = this.cameraController.smoothing.toFixed(2);
		}

		const camHorizontalOffset = document.getElementById("cam-horizontal-offset") as HTMLInputElement | null;
		const camHorizontalOffsetVal = document.getElementById("cam-horizontal-offset-val") as HTMLElement | null;
		if (camHorizontalOffset && camHorizontalOffsetVal) {
			camHorizontalOffset.addEventListener("input", (e: any) => {
				const val = parseFloat(e.target.value);
				this.cameraController.setHorizontalOffset(val);
				camHorizontalOffsetVal.textContent = val.toFixed(1);
			});
		}

		const debugCheckbox = document.getElementById("debug-collisions") as HTMLInputElement | null;
		if (debugCheckbox) {
			debugCheckbox.addEventListener("change", (e: any) => {
				this.debugEnabled = e.target.checked;
				if (this.debugMesh) this.debugMesh.visible = e.target.checked;
			});
		}

		const chDynamic = document.getElementById("ch-dynamic") as HTMLInputElement | null;
		const chType = document.getElementById("ch-type") as HTMLSelectElement | null;
		const chSize = document.getElementById("ch-size") as HTMLInputElement | null;
		const chSizeVal = document.getElementById("ch-size-val") as HTMLElement | null;
		const crosshair = document.getElementById("crosshair") as HTMLElement | null;

		if (chDynamic && crosshair) {
			chDynamic.addEventListener("change", (e: any) => {
				if (e.target.checked) {
					crosshair.classList.add("crosshair-dynamic");
				} else {
					crosshair.classList.remove("crosshair-dynamic");
				}
			});
		}

		if (chType && crosshair) {
			chType.addEventListener("change", (e: any) => {
				const type = e.target.value;
				crosshair.style.backgroundImage = "";
				crosshair.classList.remove("crosshair-dot", "crosshair-plus");

				if (type === "image") {
					crosshair.style.backgroundImage = "url('/assets/ui/pointer.png')";
				} else if (type === "dot") {
					crosshair.classList.add("crosshair-dot");
				} else if (type === "plus") {
					crosshair.classList.add("crosshair-plus");
				}
			});
		}

		if (chSize && chSizeVal && crosshair) {
			chSize.addEventListener("input", (e: any) => {
				const size = e.target.value;
				crosshair.style.width = size + "px";
				crosshair.style.height = size + "px";
				chSizeVal.textContent = size + "px";
			});
		}

		const charModelType = document.getElementById("char-model-type") as HTMLSelectElement | null;
		console.log("Setup Settings Panel: charModelType element:", charModelType);

		if (charModelType) {
			if (this.character) {
				charModelType.value = this.character.currentType;
				console.log("Initial Character Type:", this.character.currentType);
			} else {
				console.warn("Character instance not found in setupSettingsPanel");
			}

			charModelType.addEventListener("change", (e: any) => {
				const type = e.target.value;
				console.log("Character Model Switch Requested:", type);
				if (this.character) {
					this.character.setModelType(type);
					console.log("Character Model switched to:", type);
				} else {
					console.error("Character instance missing during switch request");
				}
			});
		}
	}
}

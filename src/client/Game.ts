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
import { ImpulseItem } from "./items/ImpulseItem";
import { FarmingZoneItem } from "./items/FarmingZoneItem";
import { FarmingZone } from "./entities/FarmingZone";
import { FuegoItem } from "./items/FuegoItem";
import { TurretItem } from "./items/TurretItem";
import { TurretPad } from "./entities/TurretPad";
import { PelotaItem } from "./items/PelotaItem";
import { MapObjectItem } from "./items/MapObjectItem";
import { PlayerConfigManager } from "./managers/PlayerConfigManager";
import { FloatingTextManager } from "./ui/FloatingTextManager";
import { Projectile } from "./weapons/Projectile";
import { BlasterSystem } from "./fx/BlasterSystem";
import { Router } from "./routing/Router";
import { GunItem } from "./items/GunItem";
import { setupGameInput } from "./core/GameInput";
import { animate, setupDebugRender, setupOrientationGizmo, updateDebugRender, renderOrientationGizmo } from "./core/GameLoop";
import { setupMultiplayerUI, updateConnectionStatus, handleRemoteShoot } from "./core/GameNetwork";
import { buildEnvironment, loadLevelFromFile, updateEnvironmentConfig } from "./core/GameEnvironment";
import { setupEditorUI, saveMap, loadMap, useCurrentItem, _loadSingleMapObject, deleteObjectByUuid, broadcastObjectUpdate, setObjectBodyType, updateButtonInteraction, emitSignal, triggerButton, updateCollisionLogic, updateMovementLogic } from "./core/GameEditor";
import { regenerateObjectPhysics, updateObjectPhysics } from "./core/GamePhysics";
import { GameHUD } from "./ui/GameHUD";
import { ObjectInspector } from "./ui/ObjectInspector";

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
	updateCollisionLogic: any;
	updateMovementLogic: any;
	regenerateObjectPhysics: any;
	updateObjectPhysics: any;

	constructor(router?: Router) {
		this.router = router || new Router();
		this.bindModuleMethods();

		RAPIER.init().then(() => {
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
		this.updateCollisionLogic = updateCollisionLogic.bind(this);
		this.updateMovementLogic = updateMovementLogic.bind(this);
		this.regenerateObjectPhysics = regenerateObjectPhysics.bind(this);
		this.updateObjectPhysics = updateObjectPhysics.bind(this);
	}

	initGame() {
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
		this.scopeController = new ScopeController(this.sceneManager.camera, this);
		this.sceneManager.renderer.autoClear = false;
		this.setupOrientationGizmo();

		this.character.cameraController = this.cameraController;

		this.networkManager = new NetworkManager(this.sceneManager.scene, this.world, this.roomId, (id: any) => {
			console.log("Player joined", id);
			this.updateConnectionStatus(true, id);
		});

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
		this._netAttackLatch = false;
		this.isFKeyDown = false;
		this.fKeyHeldTime = 0;
		this.isMovingFarmingZone = false;
		this.moveGhost = null;
		this.npc = null;

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
			this.handleRemoteShoot(startPos, direction, type, speed, damage, drop, rebote, hasImpactEffect, hasTracer, hasTrajectoryLine, customTracerVFX, customImpactVFX, tracerDestroyOnCollision, tracerStayForever, tracerCollisionVFX);
		};

		this.networkManager.onPlayerAction = (playerId: any, actionType: any, data: any) => {
			if (actionType === "dropItem") {
				let newItem: any;
				if (data.itemData.itemClass === "GunItem" || data.itemData.type === "weapon" || data.itemData.id === "gun" || data.itemData.modelPath) {
					newItem = new GunItem(data.itemData);
				} else if (data.itemData.itemClass === "FuegoItem" || data.itemData.id === "fuego") {
					newItem = new FuegoItem();
				} else if (data.itemData.itemClass === "PelotaItem" || data.itemData.id === "pelota") {
					newItem = new PelotaItem();
				} else if (data.itemData.itemClass === "MapObjectItem") {
					newItem = new MapObjectItem(data.itemData.id, data.itemData.name, data.itemData.type, data.itemData.iconPath, data.itemData.color, data.itemData.scale, data.itemData.texturePath);
				} else if (data.itemData.itemClass === "ImpulseItem" || data.itemData.type === "impulse") {
					newItem = new ImpulseItem(data.itemData.id, data.itemData.name, data.itemData.iconPath, data.itemData.type, data.itemData.strength);
				} else if (data.itemData.itemClass === "TurretItem" || data.itemData.id === "turret") {
					newItem = new TurretItem(data.itemData.id || "turret", data.itemData.name || "Turret", data.itemData.iconPath || "");
				} else {
					newItem = new Item(data.itemData.id, data.itemData.name, data.itemData.iconPath);
				}

				const restoreProperties = (target: any, source: any) => {
					for (const key in source) {
						if (target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
							if (target[key].isVector3) {
								target[key].set(source[key].x || 0, source[key].y || 0, source[key].z || 0);
							} else if (target[key].isEuler) {
								const rx = source[key].x !== undefined ? source[key].x : (source[key]._x || 0);
								const ry = source[key].y !== undefined ? source[key].y : (source[key]._y || 0);
								const rz = source[key].z !== undefined ? source[key].z : (source[key]._z || 0);
								target[key].set(rx, ry, rz);
							} else {
								restoreProperties(target[key], source[key]);
							}
						} else {
							target[key] = source[key];
						}
					}
				};

				restoreProperties(newItem, data.itemData);

				const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
				const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
				this.itemDropManager.dropItem(newItem, pos, dir, data.dropId, { torque: data.torque });
			} else if (actionType === "pickupItem") {
				this.itemDropManager.removeItemByDropId(data.dropId);
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
			fallDeathY: -20
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
			const wall = new MapObjectItem("wall", "Pared", "wall", "/assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 3, z: 0.5 });
			const pillar = new MapObjectItem("pillar", "Pilar", "pillar", "/assets/textures/salto.png", 0xFFFFFF, { x: 1, y: 4, z: 1 });
			const floor = new MapObjectItem("floor", "Suelo", "wall", "/assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 0.5, z: 5 });
			const ramp = new MapObjectItem("stairs", "Gradas", "stairs", "/assets/textures/impulso.png", 0xFFFFFF, { x: 4, y: 2, z: 4 });
			const tall = new MapObjectItem("tall", "Torre", "pillar", "/assets/textures/salto.png", 0xFFFFFF, { x: 2, y: 10, z: 2 });

			this.inventoryManager.addItem(wall);
			this.inventoryManager.addItem(pillar);
			this.inventoryManager.addItem(floor);
			this.inventoryManager.addItem(ramp);
			this.inventoryManager.addItem(tall);

			this.setupEditorUI();

			// @ts-ignore legacy UI module from public/js
			import("./ui/ConstructionMenu").then((module: any) => {
				this.constructionMenu = new module.ConstructionMenu(this.inventoryManager, this);
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
					} else {
						newItem = new MapObjectItem(
							source.id,
							source.name,
							source.type,
							"",
							source.color,
							source.scale,
							source.texturePath
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

		this.debugEnabled = false;
		this.setupDebugRender();

		this.GunItemClass = GunItem;
		this.PelotaItemClass = PelotaItem;

		this.animate = this.animate.bind(this);
		requestAnimationFrame(this.animate);

		document.addEventListener("mousedown", (e) => {
			if (e.target !== this.sceneManager.renderer.domElement) return;

			if (this.gameMode === "editor") {
				if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.isEditingMap) {
					const logicSys = this.constructionMenu.logicSystem;
					if (logicSys.toolbar.activeTool === "waypoint" && e.button === 0) {
						const pos = this.placementManager.getCurrentTarget();
						if (pos && logicSys.editingObject) {
							const wp = {
								x: pos.x,
								y: pos.y,
								z: pos.z,
								delay: 0,
								rotY: this.placementManager.placementGhost.rotation.y
							};
							logicSys.editingObject.userData.logicProperties.waypoints.push(wp);
							logicSys.updateVisualization();
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

				if (this.objectInspector && e.button === 2) {
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

					if (hit) {
						let target = hit.object;
						while (target && (!target.userData || !target.userData.isEditableMapObject)) {
							target = target.parent;
						}

						if (target) {
							this.objectInspector.show(target);
						}
					}
				}
			}
		}, false);

		document.addEventListener("contextmenu", (e) => e.preventDefault(), false);

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

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { animate } from "animejs";
import { MapObjectItem } from "../items/MapObjectItem";
import {
	applyAnimatedObjectScale,
	getWaypointPosition,
	getWaypointRotation,
	getWaypointScale,
	interpolateWaypointRotation,
	interpolateWaypointScale,
	normalizeMovementWaypoint,
} from "../utils/MovementWaypointUtils";

export function setupEditorUI(this: any) {
	const aerialStatus = document.createElement("div");
	aerialStatus.id = "aerial-grid-status";
	aerialStatus.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            color: #00FF00;
            font-family: sans-serif;
            font-size: 18px;
            font-weight: bold;
            display: none;
            text-shadow: 1px 1px 2px black;
            pointer-events: none;
        `;
	aerialStatus.textContent = "G: Suelo No Fijado";
	document.body.appendChild(aerialStatus);
}

export function saveMap(this: any) {
	const objects: any[] = [];
	this.sceneManager.scene.children.forEach((obj: any) => {
		if (obj.userData.isEditableMapObject) {
			objects.push({
				type: obj.userData.mapObjectType,
				color: obj.userData.color,
				originalScale: obj.userData.originalScale,
				pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
				rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
				texturePath: obj.userData.texturePath,
				textureAssetId: obj.userData.textureAssetId,
				textureSettings: obj.userData.textureSettings,
				logicProperties: obj.userData.logicProperties,
				uuid: obj.userData.uuid,
				invisible: obj.userData.invisible,
				opacity: obj.userData.opacity,
				authorId: obj.userData.authorId,
				customName: obj.userData.customName || ""
			});
		}
	});

	return {
		gameVersion: "1.0",
		timestamp: Date.now(),
		objects: objects,
		gameConfig: (this.constructionMenu && this.constructionMenu.logicSystem)
			? this.constructionMenu.logicSystem.gameConfig
			: null,
		environmentConfig: this.environmentConfig,
		playerConfig: this.playerConfigManager ? this.playerConfigManager.saveData() : null
	};
}

export function loadMap(this: any, jsonData: any) {
	if (!jsonData || !jsonData.objects) {
		console.error("Invalid map format");
		return;
	}

	if (jsonData.hasOwnProperty("playerConfig") && this.playerConfigManager) {
		this.playerConfigManager.loadData(jsonData.playerConfig || { roles: [], assignments: {} });
		if (this.constructionMenu && this.constructionMenu.playerConfigPanel) {
			if (this.constructionMenu.playerConfigPanel.container) {
				this.constructionMenu.playerConfigPanel.render();
			}
		}
	}

	if (jsonData.hasOwnProperty("gameConfig") && this.constructionMenu && this.constructionMenu.logicSystem) {
		this.constructionMenu.logicSystem.gameConfig = jsonData.gameConfig || { sequences: [] };
		console.log("Global Game Config Loaded", this.constructionMenu.logicSystem.gameConfig);

		if (this.constructionMenu.gameConfigPanel) {
			this.constructionMenu.gameConfigPanel.render();
		}
	}

	if (jsonData.hasOwnProperty("environmentConfig")) {
		this.updateEnvironmentConfig(jsonData.environmentConfig);
	}

	for (let i = this.sceneManager.scene.children.length - 1; i >= 0; i--) {
		const obj = this.sceneManager.scene.children[i];
		if (obj.userData.isEditableMapObject) {
			if (obj.userData.rigidBody) {
				try { this.world.removeRigidBody(obj.userData.rigidBody); } catch (e) { }
			}
			this.sceneManager.scene.remove(obj);
		}
	}

	const loader = new MapObjectItem("loader", "Loading...", "wall", "", 0, { x: 1, y: 1, z: 1 });
	void loader;

	jsonData.objects.forEach((data: any) => {
		const tempItem = new MapObjectItem(
			"loaded_" + Math.random(),
			data.customName || data.type || "Loaded Obj",
			data.type,
			"",
			data.color,
			data.originalScale,
			data.texturePath || null,
			data.textureAssetId || null,
			data.textureSettings || null
		);

		if (data.logicProperties) {
			tempItem.logicProperties = data.logicProperties;
		}

		if (data.opacity !== undefined) {
			tempItem.opacity = data.opacity;
		}

		tempItem.spawnObjectFromData(this.sceneManager.scene, this.world, data.pos, data.rot);

		const lastObj = this.sceneManager.scene.children[this.sceneManager.scene.children.length - 1];

		if (lastObj) {
			if (data.authorId) {
				lastObj.userData.authorId = data.authorId;
			}
			if (data.customName) {
				lastObj.userData.customName = data.customName;
			}
		}

		if (data.opacity !== undefined && lastObj) {
			lastObj.userData.opacity = data.opacity;
			const op = data.opacity;
			const applyOp = (mesh: any) => {
				if (mesh.material) {
					mesh.material.transparent = op < 1.0;
					mesh.material.opacity = op;
					mesh.material.needsUpdate = true;
				}
			};
			if (lastObj.isGroup) lastObj.children.forEach(applyOp);
			else applyOp(lastObj);
		}

		if (data.uuid && lastObj) {
			lastObj.userData.uuid = data.uuid;

			if (data.invisible) {
				lastObj.userData.invisible = true;
				lastObj.visible = false;
			}
		}

		if (lastObj && lastObj.userData.isLadder && this.character) {
			this.character.ladders.push(lastObj);

			if (lastObj.bounds) {
				lastObj.updateMatrixWorld(true);
				if (lastObj.bounds.isEmpty()) {
					lastObj.bounds.setFromObject(lastObj);
					lastObj.userData.boundsInitialized = true;
				}
			}
		}
	});
	console.log("Map Loaded:", jsonData.objects.length, "objects");
}

export function useCurrentItem(this: any, isRightClickOrItem: any = false) {
	const profile = this.playerConfigManager?.getCurrentProfile?.();
	if (profile?.disableInteraction) return;

	const item = this.inventoryManager.getCurrentItem();
	if (!item) return;

	const isRightClick = typeof isRightClickOrItem === "boolean" ? isRightClickOrItem : false;

	let origin = new THREE.Vector3();
	let direction = new THREE.Vector3();

	if (this.character) {
		origin = this.character.getPosition();
		origin.y += 1.5;

		this.sceneManager.camera.getWorldDirection(direction);
	}

	if (item.type === "movement_controller" && this.placementManager) {
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera);
		const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true);

		const hit = intersects.find((h: any) => h.object.userData && h.object.userData.isEditableMapObject);

		if (hit) {
			const targetObj = hit.object;

			if (!targetObj.userData.logicProperties) targetObj.userData.logicProperties = {};

			const hasMovement = targetObj.userData.logicProperties.waypoints ||
				(Array.isArray(targetObj.userData.logicProperties.sequences) && targetObj.userData.logicProperties.sequences.length > 0);

			if (!hasMovement) {
				const moverDefaults = item.logicProperties || {};
				const defaultSeq = (Array.isArray(moverDefaults.sequences) && moverDefaults.sequences[0]) || moverDefaults;
				targetObj.userData.logicProperties.sequences = [{
					name: "Secuencia Principal",
					waypoints: [],
					speed: defaultSeq.speed || 2.0,
					loop: defaultSeq.loop !== false,
					active: defaultSeq.active !== false,
					triggerType: "none"
				}];

				alert("Controlador de movimiento aplicado a: " + (targetObj.userData.name || "Objeto"));
				if (this.placementManager && this.placementManager.ghostLabelSprite) {
					this.placementManager.updateLabelSprite(this.placementManager.ghostLabelSprite, "Aplicado!", "#00FF00");
				}
			} else {
				alert("Este objeto ya tiene controlador de movimiento.");
				if (this.placementManager && this.placementManager.ghostLabelSprite) {
					this.placementManager.updateLabelSprite(this.placementManager.ghostLabelSprite, "Aplicado!", "#00FF00");
				}
			}

			return;
		}
	}

	const context = {
		scene: this.sceneManager.scene,
		world: this.world,
		game: this,
		placementManager: this.placementManager,
		platforms: this.platforms,
		farmingZones: this.farmingZones,
		itemDropManager: this.itemDropManager,
		rotationIndex: this.placementRotationIndex,
		origin: origin,
		direction: direction,
		camera: this.sceneManager.camera,
		networkManager: this.networkManager,
		particleSystem: this.character ? this.character.particleSystem : null,
		character: this.character,
		registerProjectile: (proj: any) => {
			this.projectiles.push(proj);
		},
		isRightClick: isRightClick
	};

	const consumed = item.use(context);

	if (consumed && this.constructionMenu) {
		this.constructionMenu.refreshLogicList();
	}

	if (consumed && this.character) {
		if (item.type === "ladder") {
			const newObject = this.sceneManager.scene.children[this.sceneManager.scene.children.length - 1];
			if (newObject && newObject.userData.isLadder && typeof newObject.updateMatrixWorld === "function") {
				this.character.ladders.push(newObject);
				console.log("Registered new ladder. Total:", this.character.ladders.length);

				if (newObject.bounds) {
					newObject.updateMatrixWorld(true);
					if (newObject.bounds.isEmpty()) {
						newObject.bounds.setFromObject(newObject);
						newObject.bounds.expandByScalar(0.5);
					}
				}
			}
		}
	}

	if (consumed && this.gameMode === "editor" && !this._isApplyingRemoteEdit
		&& this.networkManager && this.networkManager.collaborativeMode) {

		const children = this.sceneManager.scene.children;
		for (let i = children.length - 1; i >= 0; i--) {
			const obj = children[i];
			if (obj.userData && obj.userData.isEditableMapObject) {
				const data = {
					type: obj.userData.mapObjectType,
					color: obj.userData.color,
					originalScale: obj.userData.originalScale,
					pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
					rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
					texturePath: obj.userData.texturePath,
					textureAssetId: obj.userData.textureAssetId,
					textureSettings: obj.userData.textureSettings,
					logicProperties: obj.userData.logicProperties,
					uuid: obj.userData.uuid,
					invisible: obj.userData.invisible,
					opacity: obj.userData.opacity,
					authorId: this.networkManager.playerId || "local"
				};
				obj.userData.authorId = data.authorId;
				this.networkManager.sendEditorPlace(data);
				break;
			}
		}
	}
}

export function _loadSingleMapObject(this: any, data: any) {
	if (!data || !data.type) return;

	if (data.uuid) {
		this.deleteObjectByUuid(data.uuid);
	}

	const tempItem = new MapObjectItem(
		"collab_" + Math.random(),
		"Collab Obj",
		data.type,
		"",
		data.color,
		data.originalScale,
		data.texturePath || null,
		data.textureAssetId || null,
		data.textureSettings || null
	);
	if (data.logicProperties) tempItem.logicProperties = data.logicProperties;
	if (data.opacity !== undefined) tempItem.opacity = data.opacity;

	tempItem.spawnObjectFromData(this.sceneManager.scene, this.world, data.pos, data.rot);

	const lastObj = this.sceneManager.scene.children[this.sceneManager.scene.children.length - 1];

	if (lastObj && data.authorId) {
		lastObj.userData.authorId = data.authorId;
	}

	if (data.opacity !== undefined && lastObj) {
		lastObj.userData.opacity = data.opacity;
		const op = data.opacity;
		const applyOp = (mesh: any) => {
			if (mesh.material) {
				mesh.material.transparent = op < 1.0;
				mesh.material.opacity = op;
				mesh.material.needsUpdate = true;
			}
		};
		if (lastObj.isGroup) lastObj.children.forEach(applyOp);
		else applyOp(lastObj);
	}
	if (data.uuid && lastObj) {
		lastObj.userData.uuid = data.uuid;
		if (data.invisible) {
			lastObj.userData.invisible = true;
			lastObj.visible = false;
		}
	}
}

export function deleteObjectByUuid(this: any, uuid: string) {
	if (!uuid) return;
	const obj = this.sceneManager.scene.children.find((c: any) => c.userData && c.userData.uuid === uuid);
	if (!obj) return;
	if (obj.userData.rigidBody) {
		try { this.world.removeRigidBody(obj.userData.rigidBody); } catch (e) { }
	}
	this.sceneManager.scene.remove(obj);
	if (this.objectInspector && this.objectInspector.selectedObject === obj) {
		this.objectInspector.hide();
	}
	console.log(`[Collab] Removed object ${uuid}`);
}

export function broadcastObjectUpdate(this: any, obj: any) {
	if (!obj || !obj.userData || !obj.userData.isEditableMapObject) return;
	if (this.gameMode !== "editor" || !this.networkManager) return;

	const data = {
		type: obj.userData.mapObjectType,
		color: obj.userData.color,
		originalScale: obj.userData.originalScale,
		pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
		rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
		texturePath: obj.userData.texturePath,
		textureAssetId: obj.userData.textureAssetId,
		textureSettings: obj.userData.textureSettings,
		logicProperties: obj.userData.logicProperties,
		uuid: obj.userData.uuid,
		invisible: obj.userData.invisible,
		opacity: obj.userData.opacity,
		authorId: obj.userData.authorId || this.networkManager.playerId || "local"
	};

	this.networkManager.sendEditorPlace(data);
}

export function setObjectBodyType(this: any, object: any, type: any) {
	if (!object || !object.userData.rigidBody) return;

	const currentType = object.userData.rigidBody.bodyType();
	if (type === "kinematic" && currentType === RAPIER.RigidBodyType.KinematicPositionBased) return;
	if (type === "fixed" && currentType === RAPIER.RigidBodyType.Fixed) return;

	if (type === "kinematic") {
		object.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
		console.log("Output converted to Kinematic:", object.userData.mapObjectType);
	} else {
		object.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.Fixed);
		console.log("Output converted to Fixed:", object.userData.mapObjectType);
	}
}

export function updateButtonInteraction(this: any, dt: number) {
	const promptEl = document.getElementById("button-interaction-prompt") as HTMLElement | null;
	const progressCircle = document.getElementById("btn-progress-circle") as HTMLElement | null;

	if (!promptEl || !progressCircle) return;

	promptEl.style.display = "none";

	const charPos = this.character ? this.character.getPosition() : null;
	if (!charPos) return;

	let nearest = null;
	let minDistSq = 9.0;

	this.sceneManager.scene.children.forEach((obj: any) => {
		if (obj.userData.mapObjectType === "interaction_button" || obj.userData.mapObjectType === "gravity_sphere" || obj.userData.mapObjectType === "camera_panel") {
			const props = obj.userData.logicProperties;
			if (props && props.oneShot && props.triggered) return;

			const dSq = obj.position.distanceToSquared(charPos);
			if (dSq < minDistSq) {
				minDistSq = dSq;
				nearest = obj;
			}
		}
	});

	if (nearest) {
		promptEl.style.display = "flex";

		const btnPos = nearest.position.clone();
		btnPos.y += 0.5;
		btnPos.project(this.sceneManager.camera);

		const x = (btnPos.x * 0.5 + 0.5) * window.innerWidth;
		const y = (-(btnPos.y * 0.5) + 0.5) * window.innerHeight;

		if (btnPos.z < 1) {
			promptEl.style.left = `${x}px`;
			promptEl.style.top = `${y}px`;
		} else {
			promptEl.style.display = "none";
		}

		const props = nearest.userData.logicProperties;
		const holdTime = props.holdTime || 0;

		if (typeof props._currentHoldTime === "undefined") props._currentHoldTime = 0;

		const circumference = 163;

		if (progressCircle.style.display === "none") progressCircle.style.display = "";
		const bgCircle = document.getElementById("btn-bg-circle");
		if (bgCircle) {
			(bgCircle as HTMLElement).style.fill = "";
			(bgCircle as HTMLElement).style.stroke = "";
		}

		if (props.pulsationMode) {
			promptEl.classList.add("interaction-pulsation-mode");
		} else {
			promptEl.classList.remove("interaction-pulsation-mode");
		}

		if (this.isFKeyDown) {
			promptEl.classList.add("active");
		} else {
			promptEl.classList.remove("active");
		}

		if (props.pulsationMode) {
			// Visual handled by CSS
		} else {
			if (holdTime > 0) {
				if (this.isFKeyDown) {
					props._currentHoldTime += dt;

					const ratio = Math.min(props._currentHoldTime / holdTime, 1.0);
					const offset = circumference - (ratio * circumference);
					(progressCircle as unknown as SVGElement).style.strokeDashoffset = String(offset);

					if (props._currentHoldTime >= holdTime) {
						if (nearest.userData.mapObjectType === "gravity_sphere") {
							this.triggerGravitySphere(nearest);
						} else if (nearest.userData.mapObjectType === "camera_panel") {
							this.logicCameraSystem?.showCameraPanel?.(nearest);
						} else {
							this.triggerButton(nearest);
						}
						props._currentHoldTime = 0;
						(progressCircle as unknown as SVGElement).style.strokeDashoffset = String(circumference);
						this.isFKeyDown = false;
					}
				} else {
					props._currentHoldTime = 0;
					(progressCircle as unknown as SVGElement).style.strokeDashoffset = String(circumference);
				}
			} else {
				(progressCircle as unknown as SVGElement).style.strokeDashoffset = String(circumference);
			}
		}
	}
}

export function emitSignal(this: any, signalId: string) {
	console.log("Emitting Signal:", signalId);

	if (this.sceneManager && this.sceneManager.scene) {
		this.sceneManager.scene.traverse((obj: any) => {
			if (obj.userData.logicProperties && obj.userData.logicProperties.sequences) {
				obj.userData.logicProperties.sequences.forEach((seq: any) => {
					const signalMatches = (targetId: any, targetIds: any) => {
						if (targetIds && Array.isArray(targetIds)) {
							return targetIds.some((s) => {
								if (typeof s === "object") {
									return s.id === signalId || s.name === signalId;
								}
								return s === signalId;
							});
						}
						return targetId === signalId;
					};

					if (seq.triggerType === "signal") {
						const match = signalMatches(seq.triggerSignal, seq.triggerSignals);

						if (match) {
							seq.active = true;
							seq.currentState = { wpIndex: 0, moveAlpha: 0, waiting: false, waitTimer: 0, segmentStart: obj.position.clone() };
							console.log(`Sequence '${seq.name}' activated on`, obj.userData.name);

							this.setObjectBodyType(obj, "kinematic");
						}
					}

					if (seq.active && seq.currentState) {
						const currentIdx = seq.currentState.wpIndex;
						if (seq.waypoints && seq.waypoints.length > currentIdx) {
							const step = seq.waypoints[currentIdx];
							if (step.type === "wait_signal") {
								const match = signalMatches(step.signalId, step.signalIds);
								if (match) {
									seq.currentState.signalReceived = true;
									console.log(`Signal received for step ${currentIdx} in sequence '${seq.name}'`);
								}
							}
						}
					}
				});
			}

			if (obj.userData.logicProperties && obj.userData.logicProperties.targetUuid === signalId) {
				if (obj.userData.logicProperties.sequences && obj.userData.logicProperties.sequences.length > 0) {
					const seq = obj.userData.logicProperties.sequences[0];
					seq.active = !seq.active;
				} else if (obj.userData.logicProperties.active !== undefined) {
					obj.userData.logicProperties.active = !obj.userData.logicProperties.active;
				}
			}

			if (obj.userData.logicProperties && obj.userData.logicProperties.triggerButtonUuid === signalId) {
				if (obj.userData.logicProperties.sequences && obj.userData.logicProperties.sequences.length > 0) {
					const seq = obj.userData.logicProperties.sequences[0];
					seq.active = !seq.active;
				} else if (obj.userData.logicProperties.active !== undefined) {
					obj.userData.logicProperties.active = !obj.userData.logicProperties.active;
				}
			}
		});
	}
}

export function triggerButton(this: any, buttonObj: any) {
	console.log("Button Triggered!", buttonObj.userData.uuid);

	if (buttonObj.children) {
		const btnMesh = buttonObj.children.find((c: any) => c.userData.isButtonMesh);
		if (btnMesh) {
			const originalY = 0.05;
			btnMesh.position.y = 0.02;
			setTimeout(() => {
				btnMesh.position.y = originalY;
			}, 200);
		}
	}

	const props = buttonObj.userData.logicProperties;
	if (props.oneShot) props.triggered = true;

	this.emitSignal(buttonObj.userData.uuid);
}

export function updateCollisionLogic(this: any, dt: number) {
	void dt;
	if (!this.character) return;
	const charPos = this.character.getPosition();
	const charBox = new THREE.Box3().setFromCenterAndSize(
		charPos.clone().add(new THREE.Vector3(0, 1, 0)),
		new THREE.Vector3(0.8, 1.8, 0.8)
	);

	this.sceneManager.scene.children.forEach((obj: any) => {
		if (obj.userData.mapObjectType === "interactive_collision") {
			const props = obj.userData.logicProperties;

			if (props.borderColor || props.borderVisible !== undefined) {
				const wire = obj.children.find((c: any) => c.isLineSegments);
				if (wire) {
					if (props.borderColor && wire.material) wire.material.color.set(props.borderColor);
					if (props.borderVisible !== undefined) wire.visible = props.borderVisible;
				}
			}

			if (obj.userData.rigidBody) {
				const isSensor = (props.isTraversable === true);
				const n = obj.userData.rigidBody.numColliders();
				for (let i = 0; i < n; i++) {
					const col = obj.userData.rigidBody.collider(i);
					if (col.isSensor() !== isSensor) {
						col.setSensor(isSensor);
						console.log(`[Physics] Updated collider ${i} for ${obj.userData.uuid} to sensor: ${isSensor}`);
					}
				}
			}

			const objBox = new THREE.Box3().setFromObject(obj);
			const intersects = charBox.intersectsBox(objBox);

			if (props._isInside === undefined) props._isInside = false;

			if (intersects && !props._isInside) {
				props._isInside = true;
				if (props.triggerOnEnter || props.triggerOnTouch) {
					console.log("Interactive Collision Triggered:", obj.userData.uuid);
					this.emitSignal(obj.userData.uuid);
				}
			} else if (!intersects && props._isInside) {
				props._isInside = false;
			}
		}
	});
}

export function updateMovementLogic(this: any, dt: number) {
	if (!this.sceneManager || !this.sceneManager.scene) return;

	const applyTransform = (obj: any, position: any, rotation: any, scale: any) => {
		if (!obj.userData.rigidBody) return;

		obj.userData.rigidBody.setNextKinematicTranslation(position);
		obj.position.set(position.x, position.y, position.z);

		const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, obj.rotation.order || "XYZ");
		const q = new THREE.Quaternion().setFromEuler(euler);
		obj.quaternion.copy(q);
		obj.userData.rigidBody.setNextKinematicRotation(q);

		applyAnimatedObjectScale(obj, scale);
	};

	const applyWaypoint = (obj: any, waypoint: any) => {
		normalizeMovementWaypoint(waypoint, obj);
		const pos = getWaypointPosition(waypoint, obj);
		const rot = getWaypointRotation(waypoint, obj);
		const scale = getWaypointScale(waypoint, obj);
		applyTransform(obj, pos, rot, scale);
	};

	this.sceneManager.scene.children.forEach((obj: any) => {
		if (!obj.userData.logicProperties) return;

		if (obj.userData.logicProperties.waypoints && !obj.userData.logicProperties.sequences) {
			obj.userData.logicProperties.sequences = [{
				name: "Secuencia Principal",
				waypoints: obj.userData.logicProperties.waypoints,
				loop: obj.userData.logicProperties.loop,
				active: obj.userData.logicProperties.active,
				speed: obj.userData.logicProperties.speed,
				triggerType: "none"
			}];
			delete obj.userData.logicProperties.waypoints;
			delete obj.userData.logicProperties.loop;
			delete obj.userData.logicProperties.active;
			delete obj.userData.logicProperties.speed;
		}

		const sequences = obj.userData.logicProperties.sequences;

		if (sequences && sequences.length > 0) {
			if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.editingObject === obj) {
				if (!obj.userData.logicProperties.isPreviewing) return;
			}

			sequences.forEach((seq: any) => {
				if (!seq.active) return;
				if (!seq.waypoints || seq.waypoints.length === 0) return;
				seq.waypoints.forEach((wp: any) => normalizeMovementWaypoint(wp, obj));

				if (!seq.currentState) {
					seq.currentState = { wpIndex: 0, moveAlpha: 0, waiting: false, waitTimer: 0, segmentStart: obj.position.clone() };
				}
				const state = seq.currentState;

				this.setObjectBodyType(obj, "kinematic");
				if (!obj.userData.rigidBody) return;

				const waypoints = seq.waypoints;
				const idx = state.wpIndex;
				const nextIdx = (idx + 1) % waypoints.length;

				if (!seq.loop && nextIdx === 0 && idx === waypoints.length - 1) {
					return;
				}

				if (idx >= waypoints.length || !waypoints[idx]) {
					state.wpIndex = 0;
					return;
				}

				const p1 = waypoints[idx];
				const p2 = waypoints[nextIdx];

				if (p1.delay > 0 && !state.waitingCompleted) {
					if (!state.waiting) {
						state.waiting = true;
						state.waitTimer = 0;
					}
					state.waitTimer += dt;
					if (state.waitTimer < p1.delay) {
						applyWaypoint(obj, p1);
						return;
					} else {
						state.waiting = false;
						state.waitingCompleted = true;
					}
				}

				if (p1.type === "wait_signal" && !state.signalReceived) {
					if (p1.x !== undefined) {
						applyWaypoint(obj, p1);
					}
					return;
				}

				const speed = seq.speed || 2.0;

				const startPos = new THREE.Vector3();
				if (p1.x !== undefined) {
					startPos.set(p1.x, p1.y, p1.z);
				} else {
					if (state.segmentStart) {
						startPos.copy(state.segmentStart);
					} else {
						startPos.copy(obj.position);
					}
				}

				const endPos = new THREE.Vector3();
				if (p2.x !== undefined) {
					endPos.set(p2.x, p2.y, p2.z);
				} else {
					endPos.copy(startPos);
				}

				if (p2.teleport) {
					state.wpIndex = nextIdx;
					state.moveAlpha = 0;
					state.waitingCompleted = false;
					state.signalReceived = false;
					state.segmentStart = null;
					if (p2.x !== undefined) {
						applyWaypoint(obj, p2);
					}
					state.segmentStart = obj.position.clone();
					return;
				}

				const dist = startPos.distanceTo(endPos);

				if (dist < 0.05) {
					state.wpIndex = nextIdx;
					state.moveAlpha = 0;
					state.waitingCompleted = false;
					state.signalReceived = false;
					if (p2.x !== undefined) applyWaypoint(obj, p2);
					if (p2.x !== undefined) state.segmentStart = new THREE.Vector3(p2.x, p2.y, p2.z);
					else state.segmentStart = startPos.clone();
					return;
				}

				const duration = dist / speed;
				state.moveAlpha += dt / duration;

				if (state.moveAlpha >= 1.0) {
					state.moveAlpha = 0;
					state.wpIndex = nextIdx;
					state.waitingCompleted = false;
					state.signalReceived = false;

					if (p2.x !== undefined) state.segmentStart = new THREE.Vector3(p2.x, p2.y, p2.z);
					else state.segmentStart = endPos.clone();

					if (p2.x !== undefined) {
						applyWaypoint(obj, p2);
					}
				} else {
					const a = state.moveAlpha;
					const x = THREE.MathUtils.lerp(startPos.x, endPos.x, a);
					const y = THREE.MathUtils.lerp(startPos.y, endPos.y, a);
					const z = THREE.MathUtils.lerp(startPos.z, endPos.z, a);
					const rotation = interpolateWaypointRotation(p1, p2, a, obj);
					const scale = interpolateWaypointScale(p1, p2, a, obj);
					applyTransform(obj, { x, y, z }, rotation, scale);
				}
			});
		}
	});
}

function createKeycapTexture(char: string, isHovered = false): THREE.Texture {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext("2d")!;

	ctx.clearRect(0, 0, 128, 128);

	// Keycap shape
	ctx.fillStyle = isHovered ? "#4a148c" : "#1e1e1e";
	ctx.beginPath();
	if (typeof ctx.roundRect === "function") {
		ctx.roundRect(8, 8, 112, 112, 16);
	} else {
		ctx.rect(8, 8, 112, 112);
	}
	ctx.fill();

	// Border
	ctx.strokeStyle = isHovered ? "#e040fb" : "#555555";
	ctx.lineWidth = 6;
	ctx.stroke();

	// Inner bevel
	ctx.fillStyle = isHovered ? "#6a1b9a" : "#2d2d2d";
	ctx.beginPath();
	if (typeof ctx.roundRect === "function") {
		ctx.roundRect(16, 16, 96, 96, 12);
	} else {
		ctx.rect(16, 16, 96, 96);
	}
	ctx.fill();

	// Text
	ctx.fillStyle = isHovered ? "#ffffff" : "#cccccc";
	ctx.font = char === "SPACE" ? "bold 24px sans-serif" : "bold 56px sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
	ctx.shadowBlur = 4;
	ctx.shadowOffsetY = 3;
	ctx.fillText(char, 64, 64);

	const texture = new THREE.CanvasTexture(canvas);
	return texture;
}

function createGravityHelper3D() {
	const helperGroup = new THREE.Group();
	helperGroup.name = "gravityHelper3D";

	const innerRadius = 1.0;
	const outerRadius = 1.4;

	const sectors = [
		{ name: "w", color: 0xff3333, thetaStart: Math.PI / 4, thetaLength: Math.PI / 2, dir: new THREE.Vector3(0, 0, -1.2), key: "W" },
		{ name: "a", color: 0x33ff33, thetaStart: 3 * Math.PI / 4, thetaLength: Math.PI / 2, dir: new THREE.Vector3(-1.2, 0, 0), key: "A" },
		{ name: "s", color: 0x3333ff, thetaStart: 5 * Math.PI / 4, thetaLength: Math.PI / 2, dir: new THREE.Vector3(0, 0, 1.2), key: "S" },
		{ name: "d", color: 0xffff33, thetaStart: -Math.PI / 4, thetaLength: Math.PI / 2, dir: new THREE.Vector3(1.2, 0, 0), key: "D" }
	];

	const materials: Record<string, THREE.MeshBasicMaterial> = {};
	const keycaps: Record<string, THREE.Mesh> = {};

	sectors.forEach(s => {
		// Sector Mesh
		const geom = new THREE.RingGeometry(innerRadius, outerRadius, 32, 1, s.thetaStart, s.thetaLength);
		const mat = new THREE.MeshBasicMaterial({
			color: s.color,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide
		});
		materials[s.name] = mat;

		const mesh = new THREE.Mesh(geom, mat);
		mesh.rotation.x = -Math.PI / 2;
		helperGroup.add(mesh);

		// Keycap
		const tex = createKeycapTexture(s.key, false);
		const keycapGeo = new THREE.PlaneGeometry(0.35, 0.35);
		const keycapMat = new THREE.MeshBasicMaterial({
			map: tex,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide
		});
		const keycap = new THREE.Mesh(keycapGeo, keycapMat);
		keycap.position.copy(s.dir);
		keycap.position.y = 0.01;
		keycap.rotation.x = -Math.PI / 2;
		helperGroup.add(keycap);
		keycaps[s.name] = keycap;
	});

	// Space Keycap (floating 1.0 unit above ring/hip height)
	const spaceTex = createKeycapTexture("SPACE", false);
	const spaceGeo = new THREE.PlaneGeometry(0.6, 0.3);
	const spaceMat = new THREE.MeshBasicMaterial({
		map: spaceTex,
		transparent: true,
		opacity: 0.9,
		side: THREE.DoubleSide
	});
	const spaceKeycap = new THREE.Mesh(spaceGeo, spaceMat);
	spaceKeycap.position.set(0, 1.0, 0);
	helperGroup.add(spaceKeycap);
	keycaps["space"] = spaceKeycap;

	return {
		group: helperGroup,
		materials,
		keycaps
	};
}

function disposeGravityHelper(helper: any, scene: THREE.Scene) {
	if (!helper) return;
	scene.remove(helper.group);
	helper.group.traverse((child: any) => {
		if (child.geometry) child.geometry.dispose();
		if (child.material) {
			if (Array.isArray(child.material)) {
				child.material.forEach((m: any) => {
					if (m.map) m.map.dispose();
					m.dispose();
				});
			} else {
				if (child.material.map) child.material.map.dispose();
				child.material.dispose();
			}
		}
	});
}

function getClosestGravityOrientation(dir: THREE.Vector3): string {
	const orientations = ["down", "up", "left", "right", "front", "back"];
	const targetDirs: Record<string, THREE.Vector3> = {
		down: new THREE.Vector3(0, -1, 0),
		up: new THREE.Vector3(0, 1, 0),
		left: new THREE.Vector3(-1, 0, 0),
		right: new THREE.Vector3(1, 0, 0),
		front: new THREE.Vector3(0, 0, -1),
		back: new THREE.Vector3(0, 0, 1)
	};

	let maxDot = -Infinity;
	let closest = "down";

	const normDir = dir.clone().normalize();
	for (const orient of orientations) {
		const dot = normDir.dot(targetDirs[orient]);
		if (dot > maxDot) {
			maxDot = dot;
			closest = orient;
		}
	}
	return closest;
}

export function triggerGravitySphere(this: any, sphereObj: any) {
	if (document.getElementById("gravity-qte-overlay")) return;

	const props = sphereObj.userData.logicProperties;
	if (props.oneShot && props.triggered) return;

	animate(sphereObj.scale, {
		x: [1.3, 1.0],
		y: [1.3, 1.0],
		z: [1.3, 1.0],
		duration: 350,
		easing: 'easeOutBack'
	});

	if (this.inputManager) {
		this.inputManager.enabled = false;
		this.inputManager.reset();
	}

	this.gravityQteActive = true;
	this.gravityInitialPos = this.character.getPosition().clone();
	this.gravitySelectorMode = props.selectorMode || "dynamic";
	this.gravityHelperGroup = createGravityHelper3D();
	this.sceneManager.scene.add(this.gravityHelperGroup.group);

	const overlay = document.createElement("div");
	overlay.id = "gravity-qte-overlay";
	overlay.style.cssText = `
		position: fixed; top: 0; left: 0; width: 100%; height: 100%;
		background: transparent; backdrop-filter: none;
		pointer-events: none; z-index: 99999;
	`;
	document.body.appendChild(overlay);

	const closeOverlay = (onCompleteCallback: () => void = () => { }) => {
		document.removeEventListener("keydown", keydownHandler);
		document.removeEventListener("mousedown", mousedownHandler);
		overlay.remove();

		if (this.gravityHelperGroup) {
			disposeGravityHelper(this.gravityHelperGroup, this.sceneManager.scene);
			this.gravityHelperGroup = null;
		}

		this.gravityQteActive = false;

		if (this.inputManager) {
			this.inputManager.enabled = true;
			this.inputManager.reset();
		}
		onCompleteCallback();
	};

	const handleKeySelection = (key: string) => {
		let keyName = "";
		if (key === "w") keyName = "w";
		else if (key === "a") keyName = "a";
		else if (key === "s") keyName = "s";
		else if (key === "d") keyName = "d";
		else if (key === " ") keyName = "space";

		if (keyName && this.gravityHelperGroup) {
			// Change 3D keycap to active style
			const keycap = this.gravityHelperGroup.keycaps[keyName];
			if (keycap) {
				if (keycap.material.map) {
					keycap.material.map.dispose();
				}
				const label = keyName === "space" ? "SPACE" : keyName.toUpperCase();
				keycap.material.map = createKeycapTexture(label, true);
				keycap.material.needsUpdate = true;

				// Scale active keycap for visual feedback
				animate(keycap.scale, {
					x: 1.4,
					y: 1.4,
					z: 1.4,
					duration: 250,
					easing: 'easeOutBack'
				});
			}
		}

		let orientation: string | null = null;
		const currentMode = this.gravitySelectorMode || "dynamic";

		if (currentMode === "static") {
			if (key === "w") orientation = "front";
			else if (key === "s") orientation = "back";
			else if (key === "a") orientation = "left";
			else if (key === "d") orientation = "right";
			else if (key === " ") orientation = "up";
		} else {
			if (this.cameraController) {
				const basis = this.cameraController.getGravityBasis(this.cameraController.isFirstPerson ? this.cameraController.fpYaw : this.cameraController.theta);
				const targetVector = new THREE.Vector3();

				if (key === "w") {
					targetVector.copy(basis.forward);
				} else if (key === "s") {
					targetVector.copy(basis.forward).multiplyScalar(-1);
				} else if (key === "a") {
					targetVector.copy(basis.right).multiplyScalar(-1);
				} else if (key === "d") {
					targetVector.copy(basis.right);
				} else if (key === " ") {
					targetVector.copy(basis.up);
				}

				orientation = getClosestGravityOrientation(targetVector);
			} else {
				if (key === "w") orientation = "front";
				else if (key === "s") orientation = "back";
				else if (key === "a") orientation = "left";
				else if (key === "d") orientation = "right";
				else if (key === " ") orientation = "up";
			}
		}

		if (orientation && this.character) {
			const currentOrient = this.character.getGravityOrientation();
			if (currentOrient === orientation) {
				orientation = "down";
			}

			const finalOrientation = orientation;
			setTimeout(() => {
				closeOverlay(() => {
					this.character.setGravityOrientation(finalOrientation, { duration: 0.65 });
					if (props.oneShot) {
						props.triggered = true;
					}
					this.emitSignal(sphereObj.userData.uuid);
				});
			}, 250);
		}
	};

	const keydownHandler = (e: KeyboardEvent) => {
		const k = e.key.toLowerCase();
		if (k === "escape") {
			e.preventDefault();
			closeOverlay();
			return;
		}

		if (["w", "a", "s", "d", " "].includes(k)) {
			e.preventDefault();
			handleKeySelection(k);
		}
	};

	const mousedownHandler = (e: MouseEvent) => {
		if (e.button === 0) { // Left click
			closeOverlay();
		}
	};

	document.addEventListener("keydown", keydownHandler);
	document.addEventListener("mousedown", mousedownHandler);
}

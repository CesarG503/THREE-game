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
				authorId: obj.userData.authorId
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
			"Loaded Obj",
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
		if (obj.userData.mapObjectType === "interaction_button" || obj.userData.mapObjectType === "gravity_sphere") {
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

	const overlay = document.createElement("div");
	overlay.id = "gravity-qte-overlay";
	overlay.style.cssText = `
		position: fixed; top: 0; left: 0; width: 100%; height: 100%;
		display: flex; flex-direction: column; justify-content: center; align-items: center;
		background: rgba(5, 5, 10, 0.45); backdrop-filter: blur(16px);
		z-index: 99999; font-family: 'Outfit', 'Inter', sans-serif; color: white;
		opacity: 0; pointer-events: all;
	`;

	const fontLink = document.createElement("link");
	fontLink.rel = "stylesheet";
	fontLink.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap";
	document.head.appendChild(fontLink);

	const styleBlock = document.createElement("style");
	styleBlock.innerHTML = `
		.qte-key {
			position: relative;
			width: 68px; height: 68px;
			background: linear-gradient(135deg, #2c2c2c 0%, #151515 100%);
			border-radius: 14px;
			border: 1px solid #111;
			box-shadow: 
				0 6px 12px rgba(0, 0, 0, 0.6), 
				0 5px 0 #0c0c0c, 
				inset 0 1px 0 rgba(255, 255, 255, 0.15);
			cursor: pointer;
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 6px;
			box-sizing: border-box;
			transition: transform 0.08s ease, box-shadow 0.08s ease;
		}
		.qte-key-face {
			width: 100%; height: 100%;
			background: linear-gradient(180deg, #373737 0%, #212121 100%);
			border-radius: 9px;
			border-bottom: 2px solid #161616;
			box-shadow: 
				inset 0 3px 6px rgba(0, 0, 0, 0.4), 
				inset 0 -2px 3px rgba(255, 255, 255, 0.05),
				0 1px 2px rgba(0, 0, 0, 0.2);
			display: flex;
			justify-content: center;
			align-items: center;
			color: #f0f0f0;
			font-family: 'Outfit', sans-serif;
			font-size: 26px;
			font-weight: 700;
			text-shadow: 0 -1px 1px rgba(0, 0, 0, 0.6);
			user-select: none;
			box-sizing: border-box;
		}
		.qte-key:hover {
			background: linear-gradient(135deg, #333333 0%, #1a1a1a 100%);
		}
		.qte-key:hover .qte-key-face {
			background: linear-gradient(180deg, #404040 0%, #262626 100%);
			color: #ffffff;
		}
		.qte-key:active, .qte-key.active-press {
			transform: translateY(5px);
			box-shadow: 
				0 1px 2px rgba(0, 0, 0, 0.6), 
				0 1px 0 #0c0c0c, 
				inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
		}
		.qte-key.active-press .qte-key-face {
			background: linear-gradient(180deg, #6a1b9a 0%, #4a148c 100%) !important;
			color: #ffffff !important;
			box-shadow: 0 0 15px rgba(224, 64, 251, 0.8), inset 0 2px 4px rgba(0,0,0,0.5) !important;
			border-bottom-color: #310b5a !important;
		}
	`;
	document.head.appendChild(styleBlock);

	overlay.innerHTML = `
		<div id="gravity-qte-container" style="border-radius: 28px; padding: 40px; display: flex; flex-direction: column; align-items: center; transform: scale(0.85); width: fit-content; gap: 14px;">
			<!-- W Key -->
			<div style="display: flex; justify-content: center; width: 100%;">
				<div id="qte-key-w" class="qte-key" data-key="w">
					<div class="qte-key-face">W</div>
				</div>
			</div>
			<!-- A S D Keys -->
			<div style="display: flex; gap: 14px;">
				<div id="qte-key-a" class="qte-key" data-key="a">
					<div class="qte-key-face">A</div>
				</div>
				<div id="qte-key-s" class="qte-key" data-key="s">
					<div class="qte-key-face">S</div>
				</div>
				<div id="qte-key-d" class="qte-key" data-key="d">
					<div class="qte-key-face">D</div>
				</div>
			</div>
			<!-- Spacebar -->
			<div style="display: flex; justify-content: center; width: 100%; margin-top: 4px;">
				<div id="qte-key-space" class="qte-key" data-key=" " style="width: 232px; height: 56px; padding: 5px;">
					<div class="qte-key-face" style="font-size: 15px; color: rgba(240, 240, 240, 0.35);">───</div>
				</div>
			</div>
		</div>
	`;
	document.body.appendChild(overlay);

	animate(overlay, {
		opacity: [0, 1],
		duration: 350,
		easing: 'easeOutQuad'
	});

	animate('#gravity-qte-container', {
		scale: [0.85, 1],
		duration: 400,
		easing: 'elasticOut(1, 0.75)'
	});

	animate('.qte-key', {
		scale: [0.5, 1],
		opacity: [0, 1],
		delay: (el, i) => 120 + i * 40,
		duration: 350,
		easing: 'easeOutBack'
	});

	const closeOverlay = (selectedKeyId: string | null = null, onCompleteCallback: () => void = () => { }) => {
		document.removeEventListener("keydown", keydownHandler);

		const cleanup = () => {
			overlay.remove();
			styleBlock.remove();
			fontLink.remove();
			if (this.inputManager) {
				this.inputManager.enabled = true;
				this.inputManager.reset();
			}
			onCompleteCallback();
		};

		if (selectedKeyId) {
			setTimeout(() => {
				animate(overlay, {
					opacity: 0,
					duration: 250,
					easing: 'easeInQuad',
					complete: cleanup
				});
				animate('#gravity-qte-container', {
					scale: 0.9,
					duration: 250,
					easing: 'easeInQuad'
				});
			}, 250);
		} else {
			animate(overlay, {
				opacity: 0,
				duration: 200,
				easing: 'easeInQuad',
				complete: cleanup
			});
		}
	};

	const keysElements = overlay.querySelectorAll('.qte-key');
	keysElements.forEach((el: any) => {
		el.addEventListener('click', () => {
			const keyChar = el.getAttribute('data-key');
			handleKeySelection(keyChar, el.id);
		});
	});

	const handleKeySelection = (key: string, elementId: string) => {
		const keyEl = document.getElementById(elementId);
		if (keyEl) {
			keyEl.classList.add("active-press");
			animate(keyEl, {
				scale: [1, 0.9, 1.15, 1],
				duration: 250,
				easing: 'easeInOutQuad'
			});
		}

		let orientation = null;
		if (key === "w") orientation = "front";
		else if (key === "s") orientation = "back";
		else if (key === "a") orientation = "left";
		else if (key === "d") orientation = "right";
		else if (key === " ") orientation = "up";

		if (orientation && this.character) {
			closeOverlay(elementId, () => {
				this.character.setGravityOrientation(orientation, { duration: 0.65 });
				if (props.oneShot) {
					props.triggered = true;
				}
				this.emitSignal(sphereObj.userData.uuid);
			});
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
			let id = "";
			if (k === "w") id = "qte-key-w";
			else if (k === "a") id = "qte-key-a";
			else if (k === "s") id = "qte-key-s";
			else if (k === "d") id = "qte-key-d";
			else if (k === " ") id = "qte-key-space";

			handleKeySelection(k, id);
		} else {
			animate('#gravity-qte-container', {
				translateX: [0, -10, 10, -10, 10, 0],
				duration: 350,
				easing: 'easeInOutQuad'
			});
		}
	};

	document.addEventListener("keydown", keydownHandler);
}

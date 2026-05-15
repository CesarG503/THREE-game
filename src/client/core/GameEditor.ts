import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "../items/MapObjectItem";

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
			data.originalScale
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

			if (!targetObj.userData.logicProperties.waypoints) {
				targetObj.userData.logicProperties.waypoints = [];
				targetObj.userData.logicProperties.speed = 2.0;
				targetObj.userData.logicProperties.loop = true;
				targetObj.userData.logicProperties.active = true;

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
		data.originalScale
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
		if (obj.userData.mapObjectType === "interaction_button") {
			const props = obj.userData.logicProperties;
			if (props.oneShot && props.triggered) return;

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
						this.triggerButton(nearest);
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

	this.sceneManager.scene.children.forEach((obj: any) => {
		if (!obj.userData.logicProperties) return;

		const sequences = obj.userData.logicProperties.sequences;

		if (sequences && sequences.length > 0) {
			if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.editingObject === obj) {
				if (!obj.userData.logicProperties.isPreviewing) return;
			}

			sequences.forEach((seq: any) => {
				if (!seq.active) return;
				if (!seq.waypoints || seq.waypoints.length === 0) return;

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
						obj.userData.rigidBody.setNextKinematicTranslation({ x: p1.x, y: p1.y, z: p1.z });
						obj.position.set(p1.x, p1.y, p1.z);
						return;
					} else {
						state.waiting = false;
						state.waitingCompleted = true;
					}
				}

				if (p1.type === "wait_signal" && !state.signalReceived) {
					if (p1.x !== undefined) {
						obj.userData.rigidBody.setNextKinematicTranslation({ x: p1.x, y: p1.y, z: p1.z });
						obj.position.set(p1.x, p1.y, p1.z);
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
						obj.userData.rigidBody.setNextKinematicTranslation({ x: p2.x, y: p2.y, z: p2.z });
						obj.position.set(p2.x, p2.y, p2.z);
					}
					if (p2.rotY !== undefined) {
						const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p2.rotY);
						obj.quaternion.copy(q);
						obj.userData.rigidBody.setNextKinematicRotation(q);
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
						obj.userData.rigidBody.setNextKinematicTranslation({ x: p2.x, y: p2.y, z: p2.z });
						obj.position.set(p2.x, p2.y, p2.z);
					}

					if (p2.rotY !== undefined) {
						const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p2.rotY);
						obj.quaternion.copy(q);
						obj.userData.rigidBody.setNextKinematicRotation(q);
					}
				} else {
					const a = state.moveAlpha;
					const x = THREE.MathUtils.lerp(startPos.x, endPos.x, a);
					const y = THREE.MathUtils.lerp(startPos.y, endPos.y, a);
					const z = THREE.MathUtils.lerp(startPos.z, endPos.z, a);

					obj.userData.rigidBody.setNextKinematicTranslation({ x, y, z });
					obj.position.set(x, y, z);

					const r1 = (p1.rotY !== undefined) ? p1.rotY : (obj.userData.originalRotY || 0);
					const r2 = (p2.rotY !== undefined) ? p2.rotY : r1;

					let diff = r2 - r1;
					while (diff > Math.PI) diff -= Math.PI * 2;
					while (diff < -Math.PI) diff += Math.PI * 2;

					const currentRot = r1 + diff * a;
					const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentRot);
					obj.quaternion.copy(q);
					obj.userData.rigidBody.setNextKinematicRotation(q);
				}
			});
		} else if (obj.userData.logicProperties.waypoints) {
			obj.userData.logicProperties.sequences = [{
				name: "Secuencia Principal",
				waypoints: obj.userData.logicProperties.waypoints,
				loop: obj.userData.logicProperties.loop,
				active: obj.userData.logicProperties.active,
				speed: obj.userData.logicProperties.speed
			}];
		}
	});
}

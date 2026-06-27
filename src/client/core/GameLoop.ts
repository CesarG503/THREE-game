import * as THREE from "three";
import { FuegoItem } from "../items/FuegoItem";
import { normalizeGravityOrientation } from "../utils/GravityOrientation";

export function setupDebugRender(this: any) {
	this.debugMesh = new THREE.LineSegments(
		new THREE.BufferGeometry(),
		new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true })
	);
	this.debugMesh.frustumCulled = false;
	this.debugMesh.userData.ignoreRaycast = true;
	this.debugMesh.visible = false;
	this.sceneManager.scene.add(this.debugMesh);
}

export function updateDebugRender(this: any) {
	if (!this.debugEnabled) return;

	const buffers = this.world.debugRender();
	const vertices = buffers.vertices;
	const colors = buffers.colors;

	this.debugMesh.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
	this.debugMesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
}

export function setupOrientationGizmo(this: any) {
	this.gizmoScene = new THREE.Scene();
	this.gizmoAxes = new THREE.AxesHelper(1);
	this.gizmoScene.add(this.gizmoAxes);

	const size = 2;
	this.gizmoCamera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 100);
	this.gizmoCamera.position.set(0, 0, 10);
	this.gizmoCamera.lookAt(0, 0, 0);
}

export function renderOrientationGizmo(this: any) {
	if (!this.gizmoScene || !this.gizmoCamera || !this.sceneManager) return;

	const renderer = this.sceneManager.renderer;
	const width = window.innerWidth;
	const height = window.innerHeight;

	const size = 150;
	const padding = 10;

	this.gizmoCamera.position.set(0, 0, 10);
	this.gizmoCamera.position.applyQuaternion(this.sceneManager.camera.quaternion);
	this.gizmoCamera.quaternion.copy(this.sceneManager.camera.quaternion);

	renderer.setScissorTest(true);
	renderer.setScissor(padding, padding, size, size);
	renderer.setViewport(padding, padding, size, size);

	renderer.clearDepth();
	renderer.render(this.gizmoScene, this.gizmoCamera);

	renderer.setScissorTest(false);
	renderer.setViewport(0, 0, width, height);
}

function getEditableMapObjects(scene: THREE.Scene, types: string[]) {
	const objects: any[] = [];
	scene.children.forEach((obj: any) => {
		if (obj.userData?.isEditableMapObject && types.includes(obj.userData.mapObjectType)) {
			objects.push(obj);
		}
	});
	return objects;
}

function updateMapImpulsePads(game: any) {
	if (!game.character || !game.sceneManager?.scene) return;

	const charPos = game.character.getPosition();
	const now = game.clock ? game.clock.getElapsedTime() : performance.now() / 1000;
	const pads = getEditableMapObjects(game.sceneManager.scene, ["impulse_jump", "impulse_lateral"]);

	pads.forEach((pad: any) => {
		if (!pad.userData.logicProperties) pad.userData.logicProperties = {};
		const props = pad.userData.logicProperties;
		if (!pad.userData.runtimeState) pad.userData.runtimeState = {};
		const state = pad.userData.runtimeState;
		const dims = pad.userData.originalScale || { x: 3, y: 0.2, z: 3 };
		const localPos = pad.worldToLocal(charPos.clone());

		const inZone =
			Math.abs(localPos.x) < dims.x / 2 &&
			Math.abs(localPos.z) < dims.z / 2 &&
			localPos.y >= -dims.y / 2 - 0.15 &&
			localPos.y < dims.y / 2 + 0.75;

		if (!inZone) {
			state.wasInZone = false;
			return;
		}

		const cooldown = Math.max(0, Number(props.cooldown ?? 0.25));
		const canTrigger = !state.wasInZone && (!state.lastImpulseTime || now - state.lastImpulseTime >= cooldown);
		if (!canTrigger) return;

		const strength = Number(props.strength ?? (pad.userData.mapObjectType === "impulse_jump" ? 25 : 40));
		let direction: THREE.Vector3;

		if (pad.userData.mapObjectType === "impulse_jump") {
			direction = new THREE.Vector3(0, 1, 0);
		} else {
			direction = new THREE.Vector3(0, 0, -1).applyQuaternion(pad.quaternion);
			direction.y = 0;
			if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
			direction.normalize();
		}

		game.character.applyImpulse(direction.multiplyScalar(strength));
		state.wasInZone = true;
		state.lastImpulseTime = now;
	});
}

function updateMapGravityPads(game: any) {
	if (!game.character || !game.sceneManager?.scene) return;

	const charPos = game.character.getPosition();
	const now = game.clock ? game.clock.getElapsedTime() : performance.now() / 1000;
	const pads = getEditableMapObjects(game.sceneManager.scene, ["gravity_pad"]);

	pads.forEach((pad: any) => {
		if (!pad.userData.logicProperties) pad.userData.logicProperties = {};
		if (!pad.userData.runtimeState) pad.userData.runtimeState = {};

		const props = pad.userData.logicProperties;
		const state = pad.userData.runtimeState;
		const dims = pad.userData.originalScale || { x: 3, y: 0.2, z: 3 };
		const localPos = pad.worldToLocal(charPos.clone());

		const inZone =
			Math.abs(localPos.x) < dims.x / 2 &&
			Math.abs(localPos.z) < dims.z / 2 &&
			localPos.y >= -dims.y / 2 - 0.15 &&
			localPos.y < dims.y / 2 + 0.85;

		if (!inZone) {
			state.wasInZone = false;
			return;
		}

		const cooldown = Math.max(0, Number(props.cooldown ?? 0.35));
		const canTrigger = !state.wasInZone && (!state.lastGravityTime || now - state.lastGravityTime >= cooldown);
		if (!canTrigger) return;

		const orientation = normalizeGravityOrientation(props.gravityOrientation);
		const duration = Math.max(0, Number(props.transitionDuration ?? 0.8));
		const padUp = new THREE.Vector3(0, 1, 0).applyQuaternion(pad.quaternion).normalize();
		const surfaceSide = localPos.y >= 0 ? 1 : -1;
		const contactNormal = padUp.clone().multiplyScalar(surfaceSide);
		const contactPoint = pad.position.clone().addScaledVector(contactNormal, dims.y / 2);

		if (typeof game.character.setGravityOrientation === "function") {
			game.character.setGravityOrientation(orientation, { duration, contactNormal, contactPoint });
		}

		state.wasInZone = true;
		state.lastGravityTime = now;
	});
}

function updateMapFarmingZones(game: any, dt: number) {
	if (!game.itemDropManager || !game.sceneManager?.scene) return;

	const zones = getEditableMapObjects(game.sceneManager.scene, ["farming_zone"]);
	zones.forEach((zone: any) => {
		if (!zone.userData.logicProperties) zone.userData.logicProperties = {};
		const props = zone.userData.logicProperties;
		if (!zone.userData.runtimeState) zone.userData.runtimeState = {};
		const state = zone.userData.runtimeState;
		const dims = zone.userData.originalScale || { x: 3, y: 0.2, z: 3 };
		const interval = Math.max(0.1, Number(props.spawnInterval ?? 1.0));
		const itemsPerSpawn = Math.max(0, Math.floor(Number(props.itemsPerSpawn ?? 1)));
		const itemValue = Math.floor(Number(props.itemValue ?? 1));
		const itemTexture = props.itemTexture ?? "/assets/textures/fuego.png";
		const groupId = props.groupId ?? "Grupo 1";

		state.accumulatedTime = (state.accumulatedTime || 0) + dt;
		if (state.accumulatedTime < interval) return;

		state.accumulatedTime %= interval;

		for (let i = 0; i < itemsPerSpawn; i++) {
			const item = new FuegoItem(groupId, itemTexture);
			item.value = itemValue;

			const localOffset = new THREE.Vector3(
				(Math.random() - 0.5) * dims.x * 0.8,
				dims.y / 2,
				(Math.random() - 0.5) * dims.z * 0.8
			);
			localOffset.applyQuaternion(zone.quaternion);

			const spawnPos = zone.position.clone().add(localOffset);
			game.itemDropManager.dropItem(item, spawnPos, new THREE.Vector3(0, 1, 0));
		}
	});

	if (game.hud && game.hud.updateFarmingCounters) {
		game.hud.updateFarmingCounters(game);
	}
}

export function animate(this: any) {
	if (this.isDisposed) return;
	this.animationFrameId = requestAnimationFrame(this.animate);

	const dt = this.clock.getDelta();

	if (this.scopeController && this.character) {
		this.scopeController.update(
			dt,
			this.inputManager ? this.inputManager.keys.aim : false,
			this.inventoryManager ? this.inventoryManager.getCurrentItem() : null
		);
	}

	// Step Physics
	this.world.step(this.eventQueue);

	// Handle Projectile Collisions
	this.eventQueue.drainCollisionEvents((handle1: any, handle2: any, started: any) => {
		if (started && this.projectiles) {
			for (let i = 0; i < this.projectiles.length; i++) {
				const proj = this.projectiles[i];
				if (!proj.isDead && !proj.rebote) {
					if (proj.colliderHandle === handle1 || proj.colliderHandle === handle2) {
						const hitPos = proj.rigidBody.translation();
						const otherHandle = proj.colliderHandle === handle1 ? handle2 : handle1;
						if (proj.ownerColliderHandle !== null && proj.ownerColliderHandle === otherHandle) {
							continue;
						}

						let hitPlayer = false;

						// 1. Check if hit local player
						if (this.character && this.character.collider && this.character.collider.handle === otherHandle) {
							hitPlayer = true;
							const playerPos = this.character.getPosition();
							const hitY = hitPos.y - playerPos.y;

							let damageMult = 1.0;
							let color = "#FF2222";
							if (hitY < 0.7) {
								damageMult = 0.2;
								color = "#FFCC00";
							} else if (hitY < 1.4) {
								damageMult = 0.8;
								color = "#FF8800";
							}

							const finalDamage = Math.round(proj.damage * damageMult);
							this.character.takeDamage(finalDamage);

							const hitPosVec = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);

							if (this.floatingTextManager) {
								this.floatingTextManager.spawnText(`-${finalDamage}`, hitPosVec, color, 1.5);
							}
						}

						// 2. Check if hit remote player
						if (!hitPlayer && this.networkManager && this.networkManager.remotePlayers) {
							this.networkManager.remotePlayers.forEach((rp: any) => {
								if (rp.collider && rp.collider.handle === otherHandle) {
									hitPlayer = true;
									const playerPos = rp.currentPosition;
									const hitY = hitPos.y - playerPos.y;

									let damageMult = 1.0;
									let color = "#FF2222";
									if (hitY < 0.7) {
										damageMult = 0.2;
										color = "#FFCC00";
									} else if (hitY < 1.4) {
										damageMult = 0.8;
										color = "#FF8800";
									}

									const finalDamage = Math.round(proj.damage * damageMult);

									const hitPosVec = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);

									if (this.floatingTextManager) {
										this.floatingTextManager.spawnText(`-${finalDamage}`, hitPosVec, color, 1.5);
									}
								}
							});
						}

						proj.destroy(hitPos);
					}
				}
			}
		}
	});

	// Character Update
	const remotePlayers = this.networkManager ? this.networkManager.remotePlayers : null;

	if (this.gravityQteActive && this.gravityInitialPos) {
		// 1. Freeze character position and velocities
		if (this.character.rigidBody) {
			this.character.rigidBody.setTranslation(this.gravityInitialPos, true);
			this.character.rigidBody.setNextKinematicTranslation(this.gravityInitialPos);
			this.character.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
			this.character.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
		}
		this.character.verticalVelocity = 0;

		// 2. Rotate character to face camera looking direction
		if (this.cameraController) {
			const targetBodyRot = this.character.getAimYaw() + Math.PI;
			this.character.currentRotation = targetBodyRot;
		}
	}

	this.character.update(dt, this.inputManager, remotePlayers);

	// Update 3D Gravity Helper Group
	if (this.gravityQteActive && this.gravityHelperGroup && this.character) {
		const feetPos = this.character.getPosition();
		const upVector = this.character.getGravityUpVector ? this.character.getGravityUpVector() : new THREE.Vector3(0, 1, 0);

		// Place at hip height (1.0 unit above feet)
		this.gravityHelperGroup.group.position.copy(feetPos).addScaledVector(upVector, 1.0);

		const currentMode = this.gravitySelectorMode || "dynamic";
		const gravityQuat = this.character.getGravityQuaternion ? this.character.getGravityQuaternion() : new THREE.Quaternion();
		const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.character.currentRotation);

		if (currentMode === "dynamic") {
			// Both ring and keycaps rotate with character
			this.gravityHelperGroup.group.quaternion.copy(gravityQuat).multiply(yawQuat);
			const keys = ["w", "a", "s", "d"];
			keys.forEach(k => {
				const keycap = this.gravityHelperGroup.keycaps[k];
				if (keycap) {
					keycap.position.set(
						k === "w" ? 0 : (k === "a" ? -1.2 : (k === "s" ? 0 : 1.2)),
						0.01,
						k === "w" ? -1.2 : (k === "a" ? 0 : (k === "s" ? 1.2 : 0))
					);
					keycap.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
				}
			});
		} else if (currentMode === "ring_static") {
			// Ring is static, keycaps rotate with character
			this.gravityHelperGroup.group.quaternion.copy(gravityQuat);

			const sectors = [
				{ name: "w", dir: new THREE.Vector3(0, 0, -1.2) },
				{ name: "a", dir: new THREE.Vector3(-1.2, 0, 0) },
				{ name: "s", dir: new THREE.Vector3(0, 0, 1.2) },
				{ name: "d", dir: new THREE.Vector3(1.2, 0, 0) }
			];

			sectors.forEach(s => {
				const keycap = this.gravityHelperGroup.keycaps[s.name];
				if (keycap) {
					keycap.position.copy(s.dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.character.currentRotation);
					keycap.position.y = 0.01; // Offset slightly to prevent Z-fighting flickering
					const localRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, this.character.currentRotation, "YXZ"));
					keycap.quaternion.copy(localRot);
				}
			});
		} else if (currentMode === "static") {
			// Both ring and keycaps are static
			this.gravityHelperGroup.group.quaternion.copy(gravityQuat);

			const sectors = [
				{ name: "w", dir: new THREE.Vector3(0, 0, -1.2) },
				{ name: "a", dir: new THREE.Vector3(-1.2, 0, 0) },
				{ name: "s", dir: new THREE.Vector3(0, 0, 1.2) },
				{ name: "d", dir: new THREE.Vector3(1.2, 0, 0) }
			];
			sectors.forEach(s => {
				const keycap = this.gravityHelperGroup.keycaps[s.name];
				if (keycap) {
					keycap.position.copy(s.dir);
					keycap.position.y = 0.01; // Offset slightly to prevent Z-fighting flickering
					keycap.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
				}
			});
		}

		// Billboard the Space keycap to face the camera
		if (this.gravityHelperGroup.keycaps["space"] && this.sceneManager?.camera) {
			const cameraQuat = this.sceneManager.camera.quaternion;
			this.gravityHelperGroup.keycaps["space"].quaternion.copy(this.gravityHelperGroup.group.quaternion).invert().multiply(cameraQuat);
		}
	}

	if (this.inventoryManager) {
		this.inventoryManager.updateFuelBars();
	}

	// Camera Update
	this.cameraController.update(
		this.character.getPosition(),
		this.character.getRotation(),
		dt,
		this.character.getGravityQuaternion ? this.character.getGravityQuaternion() : (this.character.getGravityUpVector ? this.character.getGravityUpVector() : null)
	);

	// Fall Death Logic
	if (this.environmentConfig && this.environmentConfig.fallDeath && this.character.getPosition().y < this.environmentConfig.fallDeathY) {
		if (!this.character.isDead) {
			console.log("Player fell off the map! Instant respawn.");
			this.character.currentHealth = 0;
			this.character.emit("healthChanged", { current: 0, max: this.character.maxHealth });
			this.character.respawn();
		}
	}

	// Network Update
	if (this.networkManager) {
		this.networkManager.update(dt);

		if (this.character) {
			if (!this._netAttackLatch && this.inputManager && this.inputManager.keys.attack) {
				this._netAttackLatch = true;
			}

			const isMoving = this.inputManager ? (this.inputManager.keys.forward || this.inputManager.keys.backward || this.inputManager.keys.left || this.inputManager.keys.right) : false;
			const isCrouching = this.inputManager ? this.inputManager.keys.crouch : false;
			const isAttacking = this.inputManager ? this.inputManager.keys.attack : false;
			const isGrounded = this.character.characterController ? this.character.characterController.computedGrounded() : true;

			const sendAttacking = isAttacking || this._netAttackLatch;

			const currentItem = this.inventoryManager ? this.inventoryManager.getCurrentItem() : null;
			const equippedWeapon = (currentItem && (currentItem.type === "weapon" || currentItem.id === "jetpack" || currentItem.id.startsWith("jetpack"))) ? currentItem.id : null;
			const equippedHand = (currentItem && currentItem.equippedHand) ? currentItem.equippedHand : "right";

			const playerState = {
				modelType: this.character.currentType || "skin",
				skinUrl: this.character.polygonModelSkin ? this.character.polygonModelSkin.skinUrl : null,
				skinAssetId: this.character.activeSkinAssetId || null,
				roleId: this.character.activeRoleId || null,
				roleVisual: this.character.roleVisual || null,
				isMoving: isMoving,
				isCrouching: isCrouching,
				isAttacking: sendAttacking,
				isGrounded: isGrounded,
				verticalVelocity: this.character.verticalVelocity || 0,
				action: this.character.currentAction ? this.character.currentAction.getClip().name : "Idle",
				equippedWeapon: equippedWeapon,
				equippedHand: equippedHand,
				jumpAnimationType: this.character.polygonModelSkin ? this.character.polygonModelSkin.jumpAnimationType : "none",
				playerCollision: this.character.playerCollision || "push",
				headPitch: this.character.headPitch || 0,
				headYaw: this.character.headYaw || 0,
				isSuperman: this.character.isSuperman !== undefined ? this.character.isSuperman : (this.character.polygonModelSkin ? this.character.polygonModelSkin.isSuperman : false),
				noPitchTilt: this.character.noPitchTilt !== undefined ? this.character.noPitchTilt : false,
				isUsingJetpack: this.character.isUsingJetpack !== undefined ? this.character.isUsingJetpack : false,
				gravityOrientation: this.character.getGravityOrientation ? this.character.getGravityOrientation() : "down",
				gravityTransitionDuration: this.character.gravityTransitionDuration ?? 0.65
			};

			this.networkManager.localRoleId = playerState.roleId;

			const updateSent = this.networkManager.sendPlayerUpdate(
				this.character.getPosition(),
				this.character.getRotation(),
				playerState
			);

			if (updateSent === true) {
				this._netAttackLatch = false;
			}
		}

	}

	if (this.npc) this.npc.update(dt);

	if (this.platforms) {
		this.platforms.forEach((p: any) => p.update(this.character));
	}

	if (this.farmingZones) {
		this.farmingZones.forEach((zone: any) => zone.update(dt));
	}

	updateMapImpulsePads(this);
	updateMapGravityPads(this);
	updateMapFarmingZones(this, dt);

	if (this.projectiles) {
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const proj = this.projectiles[i];
			proj.update(dt);

			if (proj.isDead) {
				this.projectiles.splice(i, 1);
				continue;
			}

			let hitTarget = false;

			this.sceneManager.scene.children.forEach((obj: any) => {
				if (hitTarget) return;
				if (obj.userData.mapObjectType === "target") {
					const rbPos = proj.rigidBody.translation();
					const worldPos = new THREE.Vector3(rbPos.x, rbPos.y, rbPos.z);
					const localPos = obj.worldToLocal(worldPos.clone());

					const props = obj.userData.logicProperties || {};
					const radius = props.radius !== undefined ? props.radius : (obj.userData.radius || 1.0);
					const thickness = obj.scale.y || 0.2;

					if (Math.abs(localPos.y) < thickness && Math.sqrt(localPos.x * localPos.x + localPos.z * localPos.z) <= radius) {
						if (!proj.hasHitTarget) {
							proj.hasHitTarget = true;
							hitTarget = true;

							const dist = Math.sqrt(localPos.x * localPos.x + localPos.z * localPos.z);
							const rings = props.rings || 3;
							const ringWidth = radius / rings;

							let ringIdxHit = Math.floor(dist / ringWidth);
							if (ringIdxHit >= rings) ringIdxHit = rings - 1;

							const mappedIdx = rings - 1 - ringIdxHit;

							const mults = props.ringMultipliers || [0.25, 0.5, 1.0];
							const mult = mults[mappedIdx] !== undefined ? mults[mappedIdx] : 1;

							const useProj = props.useProjectileDamage !== undefined ? props.useProjectileDamage : false;
							const baseDmg = useProj ? proj.damage : (props.baseDamage !== undefined ? props.baseDamage : 10);
							const finalDamage = Math.round(baseDmg * mult);

							let color = "#FFFFFF";
							if (mappedIdx === rings - 1) color = "#FF2222";
							else if (mult >= 0.5) color = "#FFCC00";

							if (this.floatingTextManager) {
								this.floatingTextManager.spawnText(`-${finalDamage}`, worldPos, color, 1.5);
							}

							proj.destroy(worldPos);
						}
					}
				}
			});

			if (proj.isDead) {
				this.projectiles.splice(i, 1);
			}
		}
	}

	if (this.floatingTextManager) {
		this.floatingTextManager.update(dt);
	}

	if (this.fxBlasterSystem) {
		this.fxBlasterSystem.Update(dt);
	}

	this.updateMovementLogic(dt);
	this.updateCollisionLogic(dt);
	this.updateButtonInteraction(dt);

	if (this.inputManager && this.inputManager.keys.attack && this.inventoryManager) {
		const currentItem = this.inventoryManager.getCurrentItem();
		if (currentItem instanceof this.PelotaItemClass) {
			this.useCurrentItem(false);
		} else if (currentItem instanceof this.GunItemClass && currentItem.isAuto) {
			this.useCurrentItem(false);
		}
	}

	if (this.inventoryManager && this.character && this.cameraController) {
		const currentItem = this.inventoryManager.getCurrentItem();
		if (currentItem instanceof this.GunItemClass) {
			const manualPitchDelta = this.cameraController.consumeManualPitchDelta();
			const diffs = currentItem.updateAnim(dt, manualPitchDelta);

			if (diffs && diffs.pitchDiff !== undefined) {
				if (diffs.pitchDiff !== 0) {
					if (this.cameraController.isFirstPerson) {
						this.cameraController.fpPitch += diffs.pitchDiff;
						this.cameraController.fpPitch = Math.max(-this.cameraController.maxPitch, Math.min(this.cameraController.maxPitch, this.cameraController.fpPitch));
					} else {
						this.cameraController.phi -= diffs.pitchDiff;
						this.cameraController.phi = Math.max(this.cameraController.minPhi, Math.min(this.cameraController.maxPhi, this.cameraController.phi));
					}
				}
				if (diffs.yawDiff !== 0) {
					if (this.cameraController.isFirstPerson) {
						this.cameraController.fpYaw += diffs.yawDiff;
					} else {
						this.cameraController.theta += diffs.yawDiff;
					}
				}
			} else {
				const pitchDiff = typeof diffs === "number" ? diffs : 0;
				if (pitchDiff !== 0) {
					if (this.cameraController.isFirstPerson) {
						this.cameraController.fpPitch += pitchDiff;
						this.cameraController.fpPitch = Math.max(-this.cameraController.maxPitch, Math.min(this.cameraController.maxPitch, this.cameraController.fpPitch));
					} else {
						this.cameraController.phi -= pitchDiff;
						this.cameraController.phi = Math.max(this.cameraController.minPhi, Math.min(this.cameraController.maxPhi, this.cameraController.phi));
					}
				}
			}
		}
	}

	if (this.itemDropManager) {
		this.itemDropManager.update(dt, this.clock.getElapsedTime());

		if (this.character) {
			const charPos = this.character.getPosition();
			if (this.networkManager && this.networkManager.isConnected) {
				const itemPhysicsUpdates = this.itemDropManager.collectPhysicsStateUpdates(charPos, Date.now());
				if (itemPhysicsUpdates.length > 0) {
					this.networkManager.sendPlayerAction("groundItemState", { updates: itemPhysicsUpdates });
				}
			}

			const collectedFuego = this.itemDropManager.checkAutoPickupDetailed(charPos, 1.5, "fuego");

			if (collectedFuego.length > 0) {
				collectedFuego.forEach((pickup: any) => {
					const item = pickup.item;

					if (this.networkManager && this.networkManager.isConnected) {
						this.pendingItemPickups.set(pickup.dropId, { item });
						this.networkManager.sendPlayerAction("pickupItem", { dropId: pickup.dropId });
						return;
					}

					const valueAdded = item.value || 1;
					const gId = item.groupId || "Grupo 1";

					this.fuegoCount += valueAdded;

					if (!this.farmingZoneCounts) this.farmingZoneCounts = {};
					if (this.farmingZoneCounts[gId] === undefined) {
						this.farmingZoneCounts[gId] = 0;
					}
					this.farmingZoneCounts[gId] += valueAdded;
				});

				const counterEl = document.getElementById("fuego-count");
				if (counterEl) counterEl.textContent = this.fuegoCount.toString();

				if (this.hud && this.hud.updateFarmingCounters) {
					this.hud.updateFarmingCounters(this);
				}

				console.log("Recogido fuego! Total:", this.fuegoCount);
			}

			const nearest = this.itemDropManager.getNearestItem(charPos, 3.0);
			const promptEl = document.getElementById("interaction-prompt");
			const promptTextEl = document.getElementById("prompt-text") as HTMLElement | null;

			if (nearest && promptEl && promptTextEl) {
				promptTextEl.textContent = `Recoger ${nearest.item.name}`;
				promptEl.style.display = "flex";

				const itemPos = nearest.rigidBody.translation();
				const vec = new THREE.Vector3(itemPos.x, itemPos.y + 0.5, itemPos.z);
				vec.project(this.sceneManager.camera);

				const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
				const y = (-(vec.y * 0.5) + 0.5) * window.innerHeight;

				if (vec.z < 1) {
					promptEl.style.left = `${x}px`;
					promptEl.style.top = `${y}px`;
				} else {
					promptEl.style.display = "none";
				}
			} else if (promptEl) {
				promptEl.style.display = "none";
			}
		}
	}

	if (this.farmingZone) {
		this.farmingZone.update(dt);

		if (this.character && !this.isMovingFarmingZone) {
			const charPos = this.character.getPosition();
			const zonePos = this.farmingZone.position;

			const dx = charPos.x - zonePos.x;
			const dz = charPos.z - zonePos.z;
			const distSq = dx * dx + dz * dz;

			const promptContainer = document.getElementById("move-prompt-container");
			const progressBar = document.getElementById("move-progress-bar");

			if (distSq < 16.0) {
				if (promptContainer) promptContainer.style.display = "flex";

				if (this.isFKeyDown) {
					this.fKeyHeldTime += dt;
					const progress = Math.min(this.fKeyHeldTime / 5.0, 1.0);
					if (progressBar) progressBar.style.width = `${progress * 100}%`;

					if (this.fKeyHeldTime >= 5.0) {
						this.isMovingFarmingZone = true;
						this.fKeyHeldTime = 0;
						if (promptContainer) promptContainer.style.display = "none";
						console.log("Farming Zone Move Mode Activated");
					}
				} else {
					this.fKeyHeldTime = 0;
					if (progressBar) progressBar.style.width = "0%";
				}
			} else {
				if (promptContainer) promptContainer.style.display = "none";
				this.fKeyHeldTime = 0;
			}
		} else if (this.isMovingFarmingZone) {
			const raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera);
			const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true);
			const hit = intersects.find((h: any) => h.distance < 20 && h.object.type === "Mesh" && h.object !== this.moveGhost);

			if (hit) {
				this.moveGhost.visible = true;
				this.moveGhost.position.copy(hit.point);
				this.moveGhost.position.y += 0.1;
			} else {
				this.moveGhost.visible = false;
			}
		}
	}

	if (this.gameMode === "editor" && this.constructionMenu) {
		if (this.constructionMenu.logicSystem) {
			this.constructionMenu.logicSystem.update(dt);
		}

		if (this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.isEditingMap) {
			const logicSystem = this.constructionMenu.logicSystem;
			if (logicSystem.toolbar.activeTool === "waypoint") {
				if (this.placementManager && this.character) {
					this.placementManager.updateLogicGhost(
						logicSystem.editingObject,
						this.character.getPosition(),
						this.placementRotationIndex || 0
					);
				}
			} else if (!logicSystem.toolbar.activeTool && this.placementManager && this.inventoryManager) {
				const currentItem = this.inventoryManager.getCurrentItem();
				const charPos = this.character ? this.character.getPosition() : null;
				this.placementManager.update(currentItem, this.placementRotationIndex || 0, charPos);
			} else {
				if (this.placementManager) this.placementManager.placementGhost.visible = false;
			}
		} else if (!this.constructionMenu.isVisible && this.placementManager && this.inventoryManager) {
			const currentItem = this.inventoryManager.getCurrentItem();
			const charPos = this.character ? this.character.getPosition() : null;
			this.placementManager.update(currentItem, this.placementRotationIndex || 0, charPos);
		}
	} else if (this.placementManager && this.inventoryManager) {
		const currentItem = this.inventoryManager.getCurrentItem();
		const charPos = this.character ? this.character.getPosition() : null;
		this.placementManager.update(currentItem, this.placementRotationIndex || 0, charPos);
	}

	this.updateDebugRender();
	this.objectInspector?.updateGizmo?.();
	this.sceneManager.renderer.clear();
	this.sceneManager.update();
	this.renderOrientationGizmo();
}

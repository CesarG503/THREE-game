import { isTextInput } from "../input/InteractionCoordinator";
import * as THREE from "three";
import { GunItem } from "../items/GunItem";
import { serializeItemForNetwork } from "../items/ItemNetworkSerializer";
import type { Game } from "../Game";

export function setupGameInput(this: Game) {
	this.placementRotationIndex = 0;
    window.addEventListener('blur', () => this.fuelZoneSystem?.interaction.release(), { signal: this.inputEvents.signal });

	document.addEventListener("keydown", (e: KeyboardEvent) => {
		const activeElement = document.activeElement as HTMLElement | null;
		if (isTextInput(activeElement)) {
			if (e.key === "Escape") {
				activeElement.blur();
				if (this.objectInspector && this.objectInspector.isVisible) {
					this.objectInspector.hide();
				}
			} else {
				return;
			}
		}

		const profile = this.playerConfigManager?.getCurrentProfile?.();
		if (profile?.disableInteraction) {
			if (e.key.toLowerCase() !== "escape") {
				return;
			}
		}

		const key = e.key.toLowerCase();
		if (this.interaction?.blocksScene) return;

		if (key === "r" && !e.shiftKey && this.vehicleSystem?.mounted && this.inputManager?.enabled && !this.cameraController?.isUIOpen && !this.cameraController?.isPaused) {
			e.preventDefault();
			if (!e.repeat) this.vehicleSystem.switchSeat();
			return;
		}

		if ((key === "e" || key === "escape") && this.gameMode === "editor" && this.constructionMenu) {
			if (key === "escape") {
				if (this.constructionMenu.isVisible) {
					this.constructionMenu.toggle();
				}
			} else {
				this.constructionMenu.toggle();
			}

			if (key === "e" || (key === "escape" && this.constructionMenu.isVisible)) return;
		}

		if (key === "escape" && this.objectInspector && this.objectInspector.isVisible) {
			this.objectInspector.hide();
		}

		if (key === "r" && this.objectInspector?.isVisible && this.objectInspector?.selectedObject) {
			e.preventDefault();
			if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
			const mode = this.objectInspector.cycleTransformMode();
			console.log("Transform Gizmo Mode:", mode);
			return;
		}

		if (key === "r" && this.constructionMenu?.logicSystem?.isEditingMap && this.constructionMenu.logicSystem.hasSelectedWaypoint?.()) {
			e.preventDefault();
			const mode = this.constructionMenu.logicSystem.cycleWaypointGizmoMode();
			console.log("Waypoint Gizmo Mode:", mode);
			return;
		}

		if (this.interaction?.blocksGameplay || (this.inputManager && !this.inputManager.enabled)) return;

		if (key === "r") {
			this.placementRotationIndex = (this.placementRotationIndex + 1) % 4;
			console.log("Placement Rotation:", this.placementRotationIndex);
		}

		if (key === "q") {
			const item = this.inventoryManager.removeCurrentItem();
			if (item) {
				const charPos = this.character.getPosition();

				const camDir = new THREE.Vector3();
				this.sceneManager.camera.getWorldDirection(camDir);

				const dropped = this.itemDropManager.dropItem(item, charPos, camDir);
				if (!dropped) {
					this.inventoryManager.addItem(item);
					return;
				}

				if (this.networkManager && this.networkManager.isConnected) {
					this.networkManager.sendPlayerAction("dropItem", {
						dropId: dropped.dropId,
						itemData: serializeItemForNetwork(item),
						position: { x: charPos.x, y: charPos.y, z: charPos.z },
						direction: { x: camDir.x, y: camDir.y, z: camDir.z },
						torque: dropped.torque
					});
				}
			}
		}

		if (key === "f") {
			if (e.repeat) return;
            if (this.fuelZoneSystem?.interaction.press()) { e.preventDefault(); return; }
			const vehicleHoldTime = this.vehicleSystem?.nearestMountHoldTime?.();
			if (this.vehicleSystem?.mounted || vehicleHoldTime === 0) {
				if (this.vehicleSystem?.interact()) return;
			} else if (vehicleHoldTime && vehicleHoldTime > 0) {
				this.isFKeyDown = true;
				return;
			}
			const charPos = this.character.getPosition();

			let openedCameraPanel = false;
			this.sceneManager.scene.children.forEach((obj: THREE.Object3D) => {
				if (!openedCameraPanel && obj.userData.mapObjectType === "camera_panel") {
					const dSq = obj.position.distanceToSquared(charPos);
					if (dSq < 9.0) {
						this.logicCameraSystem?.showCameraPanel?.(obj);
						openedCameraPanel = true;
					}
				}
			});

			if (openedCameraPanel) return;

			let triggeredButton = false;
			this.sceneManager.scene.children.forEach((obj: THREE.Object3D) => {
				if (!triggeredButton && (obj.userData.mapObjectType === "interaction_button" || obj.userData.mapObjectType === "gravity_sphere")) {
					const dSq = obj.position.distanceToSquared(charPos);
					if (dSq < 9.0) {
						const props = obj.userData.logicProperties;
						if (props && (props.pulsationMode || props.holdTime === 0)) {
							if (!props.oneShot || !props.triggered) {
								if (obj.userData.mapObjectType === "gravity_sphere") {
									this.triggerGravitySphere(obj);
								} else {
									this.triggerButton(obj);
								}
								triggeredButton = true;
							}
						}
					}
				}
			});

			if (triggeredButton) return;

			const pickupResult = this.itemDropManager.tryPickupNearest(charPos);
			if (pickupResult) {
				const picked = pickupResult.item;

				if (this.networkManager && this.networkManager.isConnected) {
					this.pendingItemPickups.set(pickupResult.dropId, { item: picked });
					this.networkManager.sendPlayerAction("pickupItem", { dropId: pickupResult.dropId });
					return;
				}

				if (picked.id === "fuego") {
					const valueAdded = picked.value || 1;
					const gId = picked.groupId || "Grupo 1";

					this.fuegoCount += valueAdded;

					if (!this.farmingZoneCounts) this.farmingZoneCounts = {};
					if (this.farmingZoneCounts[gId] === undefined) {
						this.farmingZoneCounts[gId] = 0;
					}
					this.farmingZoneCounts[gId] += valueAdded;

					const counterEl = document.getElementById("fuego-count");
					if (counterEl) counterEl.textContent = this.fuegoCount.toString();

					if (this.hud && this.hud.updateFarmingCounters) {
						this.hud.updateFarmingCounters(this);
					}

					console.log(`Manual pickup item del grupo ${gId}! Total:`, this.farmingZoneCounts[gId]);
				} else {
					const added = this.inventoryManager.addItem(picked);
					if (!added) {
						console.log("Inventario lleno, soltando de nuevo...");
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
			}
		}

		if (key === "f") {
			this.isFKeyDown = true;
		}

		if (key === "g" && this.placementManager && this.placementManager.aerialGridActive) {
			const isFixed = this.placementManager.toggleAerialGridFixed();
			const statusEl = document.getElementById("aerial-grid-status");
			if (statusEl) {
				statusEl.textContent = isFixed ? "G: Suelo Fijado" : "G: Suelo No Fijado";
				statusEl.style.color = isFixed ? "#FF0000" : "#00FF00";
			}
		}

		if (key === "r") {
			const currentItem = this.inventoryManager ? this.inventoryManager.getCurrentItem() : null;
			if (currentItem && currentItem instanceof GunItem) {
				currentItem.reload();
			}
		}
	}, { signal: this.inputEvents.signal });

	document.addEventListener("keyup", (e: KeyboardEvent) => {
		if (e.key.toLowerCase() === "f") {
			this.fuelZoneSystem?.interaction.release();
			this.isFKeyDown = false;
			this.fKeyHeldTime = 0;
			const progressBar = document.getElementById("move-progress-bar");
			if (progressBar) progressBar.style.width = "0%";
		}
	}, { signal: this.inputEvents.signal });

	document.addEventListener("mousedown", (e: MouseEvent) => {
		const profile = this.playerConfigManager?.getCurrentProfile?.();
		if (profile?.disableInteraction) return;

		if (this.interaction?.blocksGameplay || (this.inputManager && !this.inputManager.enabled)) return;
		if (e.target !== this.sceneManager.renderer.domElement) return;

		// Si alguna interfaz de edición o panel de inspector/explorer está activa, no usar items
		if (this.isAnyEditorUIOpen()) return;

		// Outside H/Inspector, left click keeps placement; right click inspects existing objects.
		if (this.gameMode === "editor" && this.objectInspector && e.button === 2) {
			const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
			const mouse = document.pointerLockElement ? new THREE.Vector2() :
				new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
			const ray = new THREE.Raycaster();
			ray.setFromCamera(mouse, this.sceneManager.camera);
			if (ray.intersectObjects(this.sceneManager.scene.children, true).some(hit => {
				for (let object = hit.object; object; object = object.parent) {
					if (object.userData?.isEditableMapObject) return true;
				}
				return false;
			})) return;
		}

		const logicSystem = this.constructionMenu?.logicSystem;
		if (logicSystem?.isEditingMap) {
			if (e.button === 2) return;
			if (logicSystem.toolbar?.activeTool === "waypoint") return;
		}

		this.interaction?.markHandled(e);
		if (e.button === 0) {
			if (this.isMovingFarmingZone && this.moveGhost.visible) {
				this.farmingZone.setPosition(this.moveGhost.position);
				this.isMovingFarmingZone = false;
				this.moveGhost.visible = false;
				console.log("Farming Zone Moved");
			} else {
				this.useCurrentItem(false);
			}
		} else if (e.button === 2) {
			this.useCurrentItem(true);
		}
	}, { signal: this.inputEvents.signal });
}

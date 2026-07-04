import * as THREE from "three";

type LogicCameraMode = "fixed" | "free_rotation";

type LogicCameraObject = THREE.Object3D & {
	userData: {
		uuid?: string;
		customName?: string;
		mapObjectType?: string;
		logicProperties?: any;
		[key: string]: any;
	};
};

export class LogicCameraSystem {
	game: any;
	activeCameraObject: LogicCameraObject | null;
	previousCameraMode: any;
	previousInputEnabled: boolean | null;
	isViewingLogicCamera: boolean;
	panelElement: HTMLDivElement | null;
	previewElement: HTMLDivElement | null;
	previewRenderer: THREE.WebGLRenderer | null;
	previewCamera: THREE.PerspectiveCamera | null;
	previewAnimationId: number | null;
	yaw: number;
	pitch: number;
	rotationSpeed: number;
	pointerMoveHandler: (event: MouseEvent) => void;
	keyDownHandler: (event: KeyboardEvent) => void;

	constructor(game: any) {
		this.game = game;
		this.activeCameraObject = null;
		this.previousCameraMode = null;
		this.previousInputEnabled = null;
		this.isViewingLogicCamera = false;
		this.panelElement = null;
		this.previewElement = null;
		this.previewRenderer = null;
		this.previewCamera = null;
		this.previewAnimationId = null;
		this.yaw = 0;
		this.pitch = 0;
		this.rotationSpeed = 0.0035;
		this.pointerMoveHandler = (event) => this.handlePointerMove(event);
		this.keyDownHandler = (event) => this.handleKeyDown(event);
		this.sidebarPreviews = [];
		this.sidebarAnimationId = null;
		this.constructionMenuWasVisible = false;
		this.canvasClickHandler = null;
		this.previewSharedRenderer = null;
		this.originalHideHUD = false;
		this.originalDisableInteraction = false;
	}

	getLogicCameras() {
		const cameras: LogicCameraObject[] = [];
		this.game?.sceneManager?.scene?.children?.forEach((obj: LogicCameraObject) => {
			if (obj.userData?.mapObjectType === "logic_camera") cameras.push(obj);
		});
		return cameras;
	}

	getCameraName(cameraObject: LogicCameraObject, index = 0) {
		return cameraObject.userData.logicProperties?.name
			|| cameraObject.userData.customName
			|| `Camara ${index + 1}`;
	}

	getCamerasForPanel(panelObject: LogicCameraObject) {
		const props = panelObject.userData.logicProperties || {};
		const selectedIds = Array.isArray(props.cameraIds) ? props.cameraIds.filter(Boolean) : [];
		const cameras = this.getLogicCameras();
		if (selectedIds.length === 0) return cameras;

		const selected = cameras.filter((cameraObject) => selectedIds.includes(cameraObject.userData.uuid));
		return selected.length > 0 ? selected : cameras;
	}

	showCameraPanel(panelObject: LogicCameraObject) {
		const cameras = this.getCamerasForPanel(panelObject);
		this.closeCameraPanel();

		if (cameras.length === 0) {
			const panel = document.createElement("div");
			panel.id = "logic-camera-panel-wrapper";
			panel.style.cssText = `
				position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
				width:320px; background:rgba(10,12,16,0.96); color:white;
				border:1px solid #3a4b5f; border-radius:8px; padding:20px;
				text-align:center; font-family:sans-serif; z-index:2600;
			`;
			const text = document.createElement("p");
			text.textContent = "No hay cámaras configuradas en el mapa.";
			panel.appendChild(text);

			const close = document.createElement("button");
			close.textContent = "Cerrar";
			close.style.cssText = "background:#ef4444; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer;";
			close.onclick = () => this.closeCameraPanel();
			panel.appendChild(close);

			document.body.appendChild(panel);
			this.panelElement = panel;
			return;
		}

		// Hide Object Inspector
		this.game?.objectInspector?.hide?.();

		// Hide User Inventory
		const inventory = document.getElementById("inventory-container");
		if (inventory) {
			inventory.style.display = "none";
		}

		// Disable current placement draft & ghost
		if (this.game?.constructionMenu) {
			this.game.constructionMenu.currentDraftItem = null;
		}
		if (this.game?.placementManager) {
			this.game.placementManager.placementGhost.visible = false;
			if (this.game.placementManager.aerialVisual) {
				this.game.placementManager.aerialVisual.visible = false;
			}
		}

		// Save construction menu state and hide it
		if (this.game?.constructionMenu?.isVisible) {
			this.constructionMenuWasVisible = true;
			this.game.constructionMenu.toggle();
		} else {
			this.constructionMenuWasVisible = false;
		}

		// Main wrapper for fullscreen UI overlay
		const wrapper = document.createElement("div");
		wrapper.id = "logic-camera-panel-wrapper";
		wrapper.style.cssText = `
			position:absolute; left:0; top:0; width:100%; height:100%;
			pointer-events:none; z-index:2500; font-family:sans-serif;
		`;

		// 1. Sidebar on the left (only if more than 1 camera)
		if (cameras.length > 1) {
			const sidebar = document.createElement("div");
			sidebar.style.cssText = `
				position:absolute; left:0; top:0; bottom:0; width:260px;
				background:rgba(13, 17, 23, 0.85); backdrop-filter:blur(12px);
				border-right:1px solid rgba(255, 255, 255, 0.1);
				display:flex; flex-direction:column; gap:12px; padding:20px 15px;
				box-sizing:border-box; overflow-y:auto; pointer-events:auto;
				box-shadow:5px 0 25px rgba(0, 0, 0, 0.5);
			`;

			const title = document.createElement("div");
			title.textContent = "CÁMARAS";
			title.style.cssText = `
				color: #8892b0; font-size: 11px; font-weight: bold; letter-spacing: 1.5px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px; margin-bottom: 5px;
			`;
			sidebar.appendChild(title);

			cameras.forEach((cameraObject, index) => {
				const itemContainer = document.createElement("div");
				itemContainer.style.cssText = `
					background:rgba(30, 41, 59, 0.4); border:2px solid #2f3c4d;
					border-radius:6px; padding:6px; cursor:pointer;
					display:flex; flex-direction:column; gap:4px;
					transition:all 0.2s ease;
				`;

				itemContainer.onmouseover = () => {
					if (this.activeCameraObject?.userData.uuid !== cameraObject.userData.uuid) {
						itemContainer.style.borderColor = "#475569";
						itemContainer.style.background = "rgba(30, 41, 59, 0.6)";
					}
				};
				itemContainer.onmouseout = () => {
					if (this.activeCameraObject?.userData.uuid !== cameraObject.userData.uuid) {
						itemContainer.style.borderColor = "#2f3c4d";
						itemContainer.style.background = "rgba(30, 41, 59, 0.4)";
					}
				};

				const nameLabel = document.createElement("div");
				nameLabel.textContent = this.getCameraName(cameraObject, index);
				nameLabel.style.cssText = `
					color:#e2e8f0; font-size:11px; font-weight:600;
					white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
				`;
				itemContainer.appendChild(nameLabel);

				// Canvas element for 2D draw copy
				const previewWidth = 224;
				const previewHeight = 126;
				const canvas = document.createElement("canvas");
				canvas.width = previewWidth;
				canvas.height = previewHeight;
				canvas.style.borderRadius = "3px";
				canvas.style.width = "100%";
				canvas.style.height = "auto";
				itemContainer.appendChild(canvas);
				const ctx = canvas.getContext("2d");

				const previewCamera = new THREE.PerspectiveCamera(
					Number(cameraObject.userData.logicProperties?.fov ?? 60),
					previewWidth / previewHeight,
					0.1,
					Number(cameraObject.userData.logicProperties?.far ?? 80)
				);

				itemContainer.onclick = () => {
					this.selectCamera(cameraObject);
				};

				sidebar.appendChild(itemContainer);

				this.sidebarPreviews.push({
					cameraObject,
					canvas,
					ctx,
					previewCamera,
					container: itemContainer
				});
			});

			wrapper.appendChild(sidebar);
		}

		// 2. Bottom bar containing the exit button
		const bottomBar = document.createElement("div");
		bottomBar.style.cssText = `
			position:absolute; bottom:0; right:0;
			left: ${cameras.length > 1 ? "260px" : "0px"};
			height: 70px; background:rgba(13, 17, 23, 0.8); backdrop-filter:blur(10px);
			border-top:1px solid rgba(255, 255, 255, 0.1);
			display:flex; align-items:center; justify-content:center;
			pointer-events:auto; box-shadow:0 -5px 25px rgba(0, 0, 0, 0.5);
		`;

		const salirBtn = document.createElement("button");
		salirBtn.textContent = "SALIR";
		salirBtn.style.cssText = `
			background:linear-gradient(135deg, #ef4444, #b91c1c);
			color:white; border:none; border-radius:4px;
			padding:10px 45px; font-size:13px; font-weight:bold;
			letter-spacing:1.5px; cursor:pointer;
			transition:all 0.2s ease-in-out;
			box-shadow:0 4px 12px rgba(239, 68, 68, 0.3);
		`;
		salirBtn.onmouseover = () => {
			salirBtn.style.transform = "translateY(-1px)";
			salirBtn.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.45)";
		};
		salirBtn.onmouseout = () => {
			salirBtn.style.transform = "translateY(0)";
			salirBtn.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
		};
		salirBtn.onclick = () => this.closeCameraPanel();
		bottomBar.appendChild(salirBtn);

		wrapper.appendChild(bottomBar);

		document.body.appendChild(wrapper);
		this.panelElement = wrapper;

		// 3. Activate first camera
		this.selectCamera(cameras[0]);

		// Click on main canvas to request pointer lock again
		this.canvasClickHandler = () => {
			if (!this.isViewingLogicCamera || !this.activeCameraObject) return;
			const props = this.activeCameraObject.userData.logicProperties || {};
			if (props.mode === "free_rotation") {
				this.game?.sceneManager?.renderer?.domElement?.requestPointerLock?.();
			}
		};
		this.game?.sceneManager?.renderer?.domElement?.addEventListener("click", this.canvasClickHandler);

		// Render loop for previews
		if (this.sidebarPreviews.length > 0) {
			this.renderSidebarPreviews();
		}
	}

	renderSidebarPreviews() {
		if (!this.panelElement || this.sidebarPreviews.length === 0) return;

		const scene = this.game?.sceneManager?.scene;
		if (!scene) return;

		if (!this.previewSharedRenderer) {
			this.previewSharedRenderer = new THREE.WebGLRenderer({ antialias: true });
			this.previewSharedRenderer.setPixelRatio(1);
		}
		this.previewSharedRenderer.setSize(224, 126);

		this.sidebarPreviews.forEach((item) => {
			const { cameraObject, ctx, previewCamera } = item;
			previewCamera.position.copy(cameraObject.getWorldPosition(new THREE.Vector3()));
			previewCamera.quaternion.copy(cameraObject.getWorldQuaternion(new THREE.Quaternion()));
			previewCamera.fov = Number(cameraObject.userData.logicProperties?.fov ?? 60);
			previewCamera.far = Number(cameraObject.userData.logicProperties?.far ?? 80);
			previewCamera.updateProjectionMatrix();

			this.previewSharedRenderer.render(scene, previewCamera);
			ctx?.drawImage(this.previewSharedRenderer.domElement, 0, 0);
		});

		this.sidebarAnimationId = requestAnimationFrame(() => this.renderSidebarPreviews());
	}

	selectCamera(cameraObject: LogicCameraObject) {
		if (this.activeCameraObject) {
			this.activeCameraObject.visible = true;
		}

		this.activateCamera(cameraObject);

		this.sidebarPreviews.forEach((item) => {
			const isActive = item.cameraObject.userData.uuid === cameraObject.userData.uuid;
			item.container.style.borderColor = isActive ? "#38bdf8" : "#2f3c4d";
			item.container.style.background = isActive ? "rgba(56, 189, 248, 0.15)" : "rgba(30, 41, 59, 0.4)";
			item.container.style.boxShadow = isActive ? "0 0 12px rgba(56, 189, 248, 0.3)" : "none";
		});
	}

	closeCameraPanel() {
		// Stop preview render loop
		if (this.sidebarAnimationId !== null) {
			cancelAnimationFrame(this.sidebarAnimationId);
			this.sidebarAnimationId = null;
		}

		this.sidebarPreviews = [];

		// Clean up click handler
		if (this.canvasClickHandler) {
			this.game?.sceneManager?.renderer?.domElement?.removeEventListener("click", this.canvasClickHandler);
			this.canvasClickHandler = null;
		}

		// Deactivate current camera view
		this.deactivateCamera();

		// Remove UI elements
		this.panelElement?.remove();
		this.panelElement = null;

		// Restore construction menu
		if (this.constructionMenuWasVisible && this.game?.constructionMenu) {
			this.game.constructionMenu.toggle();
		}
		this.constructionMenuWasVisible = false;

		// Restore editor inventory if in editor mode
		if (this.game?.gameMode === "editor" && this.game?.ensureEditorInventoryVisible) {
			this.game.ensureEditorInventoryVisible();
		}
	}

	activateCamera(cameraObject: LogicCameraObject) {
		if (!cameraObject) return;

		if (!this.isViewingLogicCamera) {
			this.previousCameraMode = this.game?.cameraController?.mode || null;

			// Save and override HUD / Interaction block options
			const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
			if (profile) {
				this.originalHideHUD = !!profile.hideHUD;
				this.originalDisableInteraction = !!profile.disableInteraction;

				profile.hideHUD = true;
				profile.disableInteraction = true;

				this.game.playerConfigManager.applyConfiguration();
			}
		}

		this.activeCameraObject = cameraObject;
		this.isViewingLogicCamera = true;
		this.game?.cameraController?.setUIOpen?.(true);

		if (this.previousInputEnabled === null && this.game?.inputManager) {
			this.previousInputEnabled = this.game.inputManager.enabled;
		}
		if (this.game?.inputManager) {
			this.game.inputManager.reset?.();
			this.game.inputManager.enabled = false;
		}

		// Hide the logic camera object representation from its own view so it doesn't render blocking meshes
		cameraObject.visible = false;

		const euler = cameraObject.rotation;
		this.yaw = euler.y;
		this.pitch = euler.x;
		this.applyCameraTransform();

		const props = cameraObject.userData.logicProperties || {};
		if ((props.mode as LogicCameraMode) === "free_rotation") {
			this.game?.sceneManager?.renderer?.domElement?.requestPointerLock?.();
		} else {
			document.exitPointerLock?.();
		}

		document.addEventListener("mousemove", this.pointerMoveHandler);
		document.addEventListener("keydown", this.keyDownHandler);
	}

	deactivateCamera() {
		if (!this.isViewingLogicCamera) return;

		document.removeEventListener("mousemove", this.pointerMoveHandler);
		document.removeEventListener("keydown", this.keyDownHandler);
		document.exitPointerLock?.();

		if (this.activeCameraObject) {
			this.activeCameraObject.visible = true;
		}

		this.isViewingLogicCamera = false;
		this.activeCameraObject = null;

		// Restore HUD / Interaction block options
		const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
		if (profile) {
			profile.hideHUD = this.originalHideHUD;
			profile.disableInteraction = this.originalDisableInteraction;

			this.game.playerConfigManager.applyConfiguration();
		}

		if (this.game?.inputManager && this.previousInputEnabled !== null) {
			this.game.inputManager.enabled = this.previousInputEnabled;
			this.previousInputEnabled = null;
		}
		this.game?.cameraController?.setUIOpen?.(false);
		if (this.previousCameraMode && this.game?.cameraController?.setCameraMode) {
			this.game.cameraController.setCameraMode(this.previousCameraMode, false);
		}
	}

	update() {
		if (!this.isViewingLogicCamera || !this.activeCameraObject) return;
		this.applyCameraTransform();
	}

	applyCameraTransform() {
		const sceneCamera = this.game?.sceneManager?.camera;
		const source = this.activeCameraObject;
		if (!sceneCamera || !source) return;

		const props = source.userData.logicProperties || {};
		const offset = Number(props.eyeHeightOffset ?? 0);
		const position = source.getWorldPosition(new THREE.Vector3());
		if (offset) position.y += offset;
		sceneCamera.position.copy(position);

		if (props.mode === "free_rotation") {
			const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
			sceneCamera.quaternion.copy(quat);
		} else {
			sceneCamera.quaternion.copy(source.getWorldQuaternion(new THREE.Quaternion()));
		}
	}

	handlePointerMove(event: MouseEvent) {
		if (!this.isViewingLogicCamera || !this.activeCameraObject) return;
		const props = this.activeCameraObject.userData.logicProperties || {};
		if (props.mode !== "free_rotation") return;

		const isLocked = document.pointerLockElement === this.game?.sceneManager?.renderer?.domElement;
		if (!isLocked) return;

		this.yaw -= event.movementX * this.rotationSpeed;
		this.pitch -= event.movementY * this.rotationSpeed;
		const limit = Math.PI / 2 - 0.05;
		this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
	}

	handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			const isLocked = document.pointerLockElement === this.game?.sceneManager?.renderer?.domElement;
			if (!isLocked) {
				event.preventDefault();
				this.closeCameraPanel();
			}
		}
	}

	showCameraPreview(cameraObject: LogicCameraObject) {
		const scene = this.game?.sceneManager?.scene;
		if (!scene || !cameraObject) return;
		this.closeCameraPreview();

		const wrapper = document.createElement("div");
		wrapper.id = "logic-camera-preview";
		wrapper.style.cssText = `
			position:absolute; right:20px; bottom:20px; width:260px; height:170px;
			background:#111; border:1px solid #4c5664; border-radius:6px; z-index:2300;
			overflow:hidden; box-shadow:0 10px 36px rgba(0,0,0,0.5);
		`;

		const title = document.createElement("div");
		title.textContent = "Camera Preview";
		title.style.cssText = "height:22px; display:flex; align-items:center; justify-content:center; color:#c9d2dc; font-size:11px; background:#2a3038;";
		wrapper.appendChild(title);

		const canvas = document.createElement("canvas");
		canvas.width = 260;
		canvas.height = 148;
		wrapper.appendChild(canvas);
		const ctx = canvas.getContext("2d");

		const previewCamera = new THREE.PerspectiveCamera(
			Number(cameraObject.userData.logicProperties?.fov ?? 60),
			260 / 148,
			0.1,
			Number(cameraObject.userData.logicProperties?.far ?? 80)
		);

		const renderPreview = () => {
			if (!this.previewElement) return;
			if (!this.previewSharedRenderer) {
				this.previewSharedRenderer = new THREE.WebGLRenderer({ antialias: true });
				this.previewSharedRenderer.setPixelRatio(1);
			}
			this.previewSharedRenderer.setSize(260, 148);

			previewCamera.position.copy(cameraObject.getWorldPosition(new THREE.Vector3()));
			previewCamera.quaternion.copy(cameraObject.getWorldQuaternion(new THREE.Quaternion()));
			previewCamera.fov = Number(cameraObject.userData.logicProperties?.fov ?? 60);
			previewCamera.far = Number(cameraObject.userData.logicProperties?.far ?? 80);
			previewCamera.updateProjectionMatrix();

			this.previewSharedRenderer.render(scene, previewCamera);
			ctx?.drawImage(this.previewSharedRenderer.domElement, 0, 0);

			this.previewAnimationId = requestAnimationFrame(renderPreview);
		};

		document.body.appendChild(wrapper);
		this.previewElement = wrapper;
		this.previewCamera = previewCamera;
		renderPreview();
	}

	closeCameraPreview() {
		if (this.previewAnimationId !== null) {
			cancelAnimationFrame(this.previewAnimationId);
			this.previewAnimationId = null;
		}
		this.previewCamera = null;
		this.previewElement?.remove();
		this.previewElement = null;
	}
}

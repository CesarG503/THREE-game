import * as THREE from "three";
import { LogicToolbar } from "../ui/LogicToolbar";
import { LogicSequenceEditor } from "../ui/LogicSequenceEditor";
import { InteractiveCollisionLogic } from "../ui/logic_items/InteractiveCollisionLogic";
import { TargetLogic } from "../ui/logic_items/TargetLogic";
import { DianaLogic } from "../ui/logic_items/DianaLogic";
import { DamageLogic } from "../ui/logic_items/DamageLogic";
import { PlayerConfigManager } from "./PlayerConfigManager";
import { getActiveFarmingGroups } from "../ui/GameHUD";
import { WaypointTransformGizmo } from "../editor/WaypointTransformGizmo";
import { GRAVITY_ORIENTATION_OPTIONS, normalizeGravityOrientation } from "../utils/GravityOrientation";
import {
	applyAnimatedObjectScale,
	createMovementWaypointFromTransform,
	degreesToRadians,
	describeRotationTurns,
	getObjectCurrentDimensions,
	getWaypointPosition,
	getWaypointRotation,
	getWaypointRotationTurns,
	getWaypointScale,
	normalizeMovementWaypoint,
	radiansToDegrees,
	type MovementWaypoint,
} from "../utils/MovementWaypointUtils";

export class LogicSystem {
	game: any;
	isEditingMap: boolean;
	editingObject: any;
	editingSequenceIndex: number | undefined;
	toolbar: any;
	sequenceEditor: any;
	hud: any;
	playerConfigManager: any;
	pathVisualizer: any;
	gameConfig: any;
	configRuntime: any;
	configPanel: any;
	interactiveCollisionLogic: any;
	targetLogic: any;
	dianaLogic: any;
	damageLogic: any;
	waypointGizmo: any;
	selectedWaypoint: any;
	waypointPanel: HTMLElement | null;
	waypointNavIndex: number;

	constructor(game: any) {
		this.game = game;
		this.isEditingMap = false;
		this.editingObject = null;
		this.editingSequenceIndex = undefined;
		this.toolbar = new LogicToolbar(game);
		this.sequenceEditor = new LogicSequenceEditor(game, this);
		this.interactiveCollisionLogic = new InteractiveCollisionLogic(game, this);
		this.targetLogic = new TargetLogic(game, this);
		this.dianaLogic = new DianaLogic();
		this.damageLogic = new DamageLogic();
		this.selectedWaypoint = null;
		this.waypointPanel = null;
		this.waypointNavIndex = -1;
		this.waypointGizmo = new WaypointTransformGizmo(game, {
			onChange: () => this.updateVisualization(),
			onCommit: () => {
				this.updateVisualization();
				this.refreshOpenEditors();
				this.broadcastObjectLogicUpdate(this.selectedWaypoint?.object);
			}
		});
		// this.hud = new GameHUD() // Use shared HUD from Game
		this.hud = this.game.hud;
		// Use shared PlayerConfigManager from Game if available
		this.playerConfigManager = game.playerConfigManager || new PlayerConfigManager(game);

		// Toolbar Callbacks
		this.toolbar.onClose = () => this.endMapEdit();
		this.toolbar.onAction = (action: any) => {
			if (action === "add_current_wp") this.addCurrentObjectWaypoint();
			if (action === "prev_wp") this.moveEditingObjectToWaypoint(-1);
			if (action === "next_wp") this.moveEditingObjectToWaypoint(1);
		};
		this.toolbar.onToolChange = (tool: any) => {
			console.log("Herramienta Lógica:", tool);

			if (tool === "play_pause") {
				this.toggleAnimation();
				// Don't keep it 'active' as a selected tool
			} else if (tool === "aerial_grid") {
				this.toggleAerialGrid();
			}
		};

		// Visualizer for paths
		this.pathVisualizer = new THREE.Group();
		if (this.game.sceneManager && this.game.sceneManager.scene) {
			this.game.sceneManager.scene.add(this.pathVisualizer);
		}

		// Game Config Runtime State
		this.gameConfig = { sequences: [] }; // Config Data
		this.configRuntime = {
			isPlaying: false,
			isPaused: false,
			currentIndex: 0,
			timer: 0,
			hasStarted: false,
			totalTime: 0
		};
	}

	ensureMovementSequences(props: any, object: any = null) {
		if (!props) return [];

		if (props.waypoints && !props.sequences) {
			props.sequences = [{
				name: "Secuencia Principal",
				waypoints: props.waypoints,
				loop: props.loop !== false,
				active: props.active !== false,
				speed: props.speed || 2.0,
				triggerType: "none"
			}];
			delete props.waypoints;
			delete props.loop;
			delete props.active;
			delete props.speed;
		}

		if (!props.sequences) props.sequences = [];
		if (props.sequences.length === 0) {
			props.sequences.push({
				name: "Secuencia Principal",
				waypoints: [],
				loop: true,
				active: true,
				speed: 2.0,
				triggerType: "none"
			});
		}

		props.sequences.forEach((seq: any, idx: number) => {
			if (!seq.name) seq.name = idx === 0 ? "Secuencia Principal" : `Secuencia ${idx + 1}`;
			if (!Array.isArray(seq.waypoints)) seq.waypoints = [];
			if (seq.loop === undefined) seq.loop = true;
			if (seq.active === undefined) seq.active = idx === 0;
			if (seq.speed === undefined) seq.speed = 2.0;
			seq.waypoints.forEach((wp: MovementWaypoint) => normalizeMovementWaypoint(wp, object));
		});

		props.sequences[0].name = "Secuencia Principal";
		return props.sequences;
	}

	hasMovementLogic(object: any) {
		const props = object?.userData?.logicProperties;
		return Boolean(props && (props.waypoints || (Array.isArray(props.sequences) && props.sequences.length > 0)));
	}

	createEmptyMovementLogic(object: any) {
		if (!object.userData.logicProperties) object.userData.logicProperties = {};
		const props = object.userData.logicProperties;
		if (!this.hasMovementLogic(object)) {
			props.sequences = [{
				name: "Secuencia Principal",
				waypoints: [],
				loop: true,
				active: true,
				speed: 2.0,
				triggerType: "none"
			}];
		}
		return this.ensureMovementSequences(props, object);
	}

	getMovementSequence(object: any, sequenceIndex = 0) {
		if (!object?.userData?.logicProperties) return null;
		const sequences = this.ensureMovementSequences(object.userData.logicProperties, object);
		return sequences[sequenceIndex] || sequences[0] || null;
	}

	createWaypointFromObject(object: any) {
		return createMovementWaypointFromTransform(object);
	}

	addCurrentObjectWaypoint() {
		if (!this.editingObject) return null;
		const sequenceIndex = this.editingSequenceIndex ?? 0;
		const seq = this.getMovementSequence(this.editingObject, sequenceIndex);
		if (!seq) return null;

		const wp = this.createWaypointFromObject(this.editingObject);
		seq.waypoints.push(wp);
		const wpIndex = seq.waypoints.length - 1;
		this.selectWaypoint(this.editingObject, sequenceIndex, wpIndex, "translate");
		this.showWaypointPropertiesPanel(this.editingObject, sequenceIndex, wpIndex);
		this.updateVisualization();
		this.refreshOpenEditors();
		this.broadcastObjectLogicUpdate(this.editingObject);
		return wp;
	}

	createWaypointFromPlacement(object: any, position: any, rotation: any = null) {
		return createMovementWaypointFromTransform(
			object,
			position,
			rotation || object?.rotation,
			getObjectCurrentDimensions(object)
		);
	}

	addWaypointFromPlacement(position: any, rotation: any = null) {
		if (!this.editingObject || !position) return null;

		const sequenceIndex = this.editingSequenceIndex ?? 0;
		const seq = this.getMovementSequence(this.editingObject, sequenceIndex);
		if (!seq) return null;

		const wp = this.createWaypointFromPlacement(this.editingObject, position, rotation);
		seq.waypoints.push(wp);
		const wpIndex = seq.waypoints.length - 1;
		this.selectWaypoint(this.editingObject, sequenceIndex, wpIndex, "translate");
		this.updateVisualization();
		this.refreshOpenEditors();
		this.broadcastObjectLogicUpdate(this.editingObject);
		return wp;
	}

	updateWaypointFromObject(object: any, sequenceIndex: number, waypointIndex: number) {
		const seq = this.getMovementSequence(object, sequenceIndex);
		if (!seq || !seq.waypoints[waypointIndex]) return;
		Object.assign(seq.waypoints[waypointIndex], this.createWaypointFromObject(object));
		this.selectWaypoint(object, sequenceIndex, waypointIndex, this.waypointGizmo.getMode());
		this.updateVisualization();
		this.refreshOpenEditors();
		this.broadcastObjectLogicUpdate(object);
	}

	selectWaypoint(object: any, sequenceIndex: number, waypointIndex: number, mode = this.waypointGizmo.getMode()) {
		const seq = this.getMovementSequence(object, sequenceIndex);
		if (!seq || !seq.waypoints[waypointIndex] || seq.waypoints[waypointIndex].type === "wait_signal") return;

		const waypoint = normalizeMovementWaypoint(seq.waypoints[waypointIndex], object);
		this.selectedWaypoint = { object, sequenceIndex, waypointIndex };
		this.waypointNavIndex = waypointIndex;
		this.waypointGizmo.attach(object, waypoint, mode);
		this.updateVisualization();
	}

	handleMapRightClick(event: MouseEvent) {
		if (!this.editingObject) return true;

		const mouse = this.getPointerNdc(event);
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, this.game.sceneManager.camera);

		const waypointHit = raycaster.intersectObjects(this.pathVisualizer.children, true).find((hit: any) => {
			let obj = hit.object;
			while (obj) {
				if (obj.userData?.isMovementWaypointHandle) return true;
				obj = obj.parent;
			}
			return false;
		});

		if (waypointHit) {
			let handle = waypointHit.object;
			while (handle && !handle.userData?.isMovementWaypointHandle) handle = handle.parent;
			if (handle) {
				this.selectWaypoint(this.editingObject, handle.userData.sequenceIndex, handle.userData.waypointIndex, this.waypointGizmo.getMode());
				this.showWaypointPropertiesPanel(this.editingObject, handle.userData.sequenceIndex, handle.userData.waypointIndex);
			}
			return true;
		}

		const objectHit = raycaster.intersectObjects(this.game.sceneManager.scene.children, true).find((hit: any) => {
			let obj = hit.object;
			while (obj) {
				if (obj.userData?.isEditableMapObject) return true;
				obj = obj.parent;
			}
			return false;
		});

		if (objectHit) {
			let target = objectHit.object;
			while (target && !target.userData?.isEditableMapObject) target = target.parent;
			if (target === this.editingObject && this.game.objectInspector) {
				this.game.objectInspector.show(target);
			}
		}

		return true;
	}

	private getPointerNdc(event: MouseEvent) {
		if (document.pointerLockElement) return new THREE.Vector2(0, 0);
		return new THREE.Vector2(
			(event.clientX / window.innerWidth) * 2 - 1,
			-(event.clientY / window.innerHeight) * 2 + 1
		);
	}

	private getValidWaypointIndices(seq: any) {
		if (!seq?.waypoints) return [];
		return seq.waypoints
			.map((wp: MovementWaypoint, idx: number) => ({ wp, idx }))
			.filter(({ wp }) => wp && wp.type !== "wait_signal" && wp.x !== undefined && wp.y !== undefined && wp.z !== undefined)
			.map(({ idx }) => idx);
	}

	moveEditingObjectToWaypoint(direction: number) {
		if (!this.editingObject) return;
		const sequenceIndex = this.editingSequenceIndex ?? 0;
		const seq = this.getMovementSequence(this.editingObject, sequenceIndex);
		const validIndices = this.getValidWaypointIndices(seq);
		if (validIndices.length === 0) return;

		let currentListIndex = validIndices.indexOf(this.selectedWaypoint?.object === this.editingObject ? this.selectedWaypoint.waypointIndex : this.waypointNavIndex);
		if (currentListIndex < 0) currentListIndex = direction >= 0 ? -1 : 0;

		const nextListIndex = (currentListIndex + direction + validIndices.length) % validIndices.length;
		const waypointIndex = validIndices[nextListIndex];
		const waypoint = normalizeMovementWaypoint(seq.waypoints[waypointIndex], this.editingObject);

		this.applyWaypointToObject(this.editingObject, waypoint);
		this.syncSequenceRuntimeToWaypoint(this.editingObject, sequenceIndex, waypointIndex);
		this.selectWaypoint(this.editingObject, sequenceIndex, waypointIndex, this.waypointGizmo.getMode());
		this.showWaypointPropertiesPanel(this.editingObject, sequenceIndex, waypointIndex);
		this.broadcastObjectLogicUpdate(this.editingObject);
	}

	private applyWaypointToObject(object: any, waypoint: MovementWaypoint) {
		const pos = getWaypointPosition(waypoint, object);
		const rot = getWaypointRotation(waypoint, object);
		const scale = getWaypointScale(waypoint, object);

		object.position.set(pos.x, pos.y, pos.z);
		object.rotation.set(rot.x, rot.y, rot.z);
		applyAnimatedObjectScale(object, scale);

		if (this.game?.setObjectBodyType) this.game.setObjectBodyType(object, "kinematic");
		const body = object.userData?.rigidBody;
		if (body) {
			const q = new THREE.Quaternion().setFromEuler(object.rotation);
			body.setTranslation?.(pos, true);
			body.setRotation?.(q, true);
			body.setNextKinematicTranslation?.(pos);
			body.setNextKinematicRotation?.(q);
		}
	}

	private syncSequenceRuntimeToWaypoint(object: any, sequenceIndex: number, waypointIndex: number) {
		const seq = this.getMovementSequence(object, sequenceIndex);
		if (!seq || !seq.waypoints?.[waypointIndex]) return;

		const waypoint = normalizeMovementWaypoint(seq.waypoints[waypointIndex], object);
		const pos = getWaypointPosition(waypoint, object);
		seq.currentState = {
			wpIndex: waypointIndex,
			moveAlpha: 0,
			waiting: false,
			waitTimer: 0,
			waitingCompleted: false,
			signalReceived: false,
			segmentStart: new THREE.Vector3(pos.x, pos.y, pos.z)
		};
	}

	closeWaypointPropertiesPanel() {
		this.waypointPanel?.remove();
		this.waypointPanel = null;
	}

	showWaypointPropertiesPanel(object: any, sequenceIndex: number, waypointIndex: number) {
		const seq = this.getMovementSequence(object, sequenceIndex);
		if (!seq || !seq.waypoints[waypointIndex]) return;
		const wp = normalizeMovementWaypoint(seq.waypoints[waypointIndex], object);
		this.closeWaypointPropertiesPanel();

		const panel = document.createElement("div");
		panel.id = "waypoint-properties-panel";
		panel.style.cssText = `
			position:absolute; right:20px; top:20px; width:320px; max-height:calc(100vh - 40px);
			overflow:auto; background:rgba(0,0,0,0.92); color:white; z-index:2200;
			border:2px solid #2277aa; border-radius:8px; padding:12px; box-sizing:border-box;
			font-family:sans-serif; box-shadow:0 0 18px rgba(0,0,0,0.7);
		`;

		const header = document.createElement("div");
		header.style.cssText = "display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #335; padding-bottom:8px; margin-bottom:10px;";
		header.innerHTML = `<strong>Punto #${waypointIndex + 1}</strong>`;
		const close = document.createElement("button");
		close.textContent = "X";
		close.style.cssText = "background:#333; color:white; border:1px solid #666; border-radius:4px; cursor:pointer;";
		close.onclick = () => this.closeWaypointPropertiesPanel();
		header.appendChild(close);
		panel.appendChild(header);

		const refresh = () => {
			normalizeMovementWaypoint(wp, object);
			this.selectWaypoint(object, sequenceIndex, waypointIndex, this.waypointGizmo.getMode());
			this.updateVisualization();
			this.broadcastObjectLogicUpdate(object);
		};

		const makeNumber = (label: string, value: number, onChange: (value: number) => void, step = 0.1) => {
			const row = document.createElement("label");
			row.style.cssText = "display:grid; grid-template-columns:90px 1fr; gap:8px; align-items:center; margin-bottom:6px; font-size:12px; color:#ccc;";
			const span = document.createElement("span");
			span.textContent = label;
			const input = document.createElement("input");
			input.type = "number";
			input.value = Number(value || 0).toFixed(label.startsWith("Rot") ? 1 : 2);
			input.step = String(step);
			input.style.cssText = "background:#111; color:white; border:1px solid #444; border-radius:4px; padding:4px;";
			input.onkeydown = (e) => e.stopPropagation();
			input.onchange = (e: any) => {
				onChange(parseFloat(e.target.value));
				refresh();
			};
			row.appendChild(span);
			row.appendChild(input);
			panel.appendChild(row);
		};

		const pos = getWaypointPosition(wp, object);
		const rot = getWaypointRotation(wp, object);
		const scale = getWaypointScale(wp, object);
		const turns = getWaypointRotationTurns(wp);

		makeNumber("Pos X", pos.x, (v) => wp.x = v);
		makeNumber("Pos Y", pos.y, (v) => wp.y = v);
		makeNumber("Pos Z", pos.z, (v) => wp.z = v);
		makeNumber("Rot X", radiansToDegrees(rot.x), (v) => wp.rotation!.x = degreesToRadians(v), 5);
		makeNumber("Rot Y", radiansToDegrees(rot.y), (v) => { wp.rotation!.y = degreesToRadians(v); wp.rotY = wp.rotation!.y; }, 5);
		makeNumber("Rot Z", radiansToDegrees(rot.z), (v) => wp.rotation!.z = degreesToRadians(v), 5);
		makeNumber("Tam X", scale.x, (v) => wp.scale!.x = v);
		makeNumber("Tam Y", scale.y, (v) => wp.scale!.y = v);
		makeNumber("Tam Z", scale.z, (v) => wp.scale!.z = v);
		makeNumber("Vueltas X", turns.x, (v) => wp.rotationTurns!.x = v, 0.25);
		makeNumber("Vueltas Y", turns.y, (v) => wp.rotationTurns!.y = v, 0.25);
		makeNumber("Vueltas Z", turns.z, (v) => wp.rotationTurns!.z = v, 0.25);
		makeNumber("Espera", wp.delay || 0, (v) => wp.delay = v, 0.1);

		const teleportLabel = document.createElement("label");
		teleportLabel.style.cssText = "display:flex; align-items:center; gap:8px; margin:8px 0; font-size:12px; color:#ccc;";
		const teleport = document.createElement("input");
		teleport.type = "checkbox";
		teleport.checked = Boolean(wp.teleport);
		teleport.onchange = () => {
			wp.teleport = teleport.checked;
			refresh();
		};
		teleportLabel.appendChild(teleport);
		teleportLabel.appendChild(document.createTextNode("Teleport"));
		panel.appendChild(teleportLabel);

		const buttonRow = document.createElement("div");
		buttonRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;";
		const applyBtn = document.createElement("button");
		applyBtn.textContent = "Mover objeto aqui";
		applyBtn.style.cssText = "background:#064f9e; color:white; border:none; border-radius:4px; padding:7px; cursor:pointer;";
		applyBtn.onclick = () => {
			this.applyWaypointToObject(object, wp);
			this.syncSequenceRuntimeToWaypoint(object, sequenceIndex, waypointIndex);
			this.updateVisualization();
			this.broadcastObjectLogicUpdate(object);
		};
		const captureBtn = document.createElement("button");
		captureBtn.textContent = "Capturar objeto";
		captureBtn.style.cssText = "background:#333; color:white; border:1px solid #555; border-radius:4px; padding:7px; cursor:pointer;";
		captureBtn.onclick = () => {
			this.updateWaypointFromObject(object, sequenceIndex, waypointIndex);
			this.showWaypointPropertiesPanel(object, sequenceIndex, waypointIndex);
		};
		buttonRow.appendChild(applyBtn);
		buttonRow.appendChild(captureBtn);
		panel.appendChild(buttonRow);

		document.body.appendChild(panel);
		this.waypointPanel = panel;
	}

	setWaypointGizmoMode(mode: "translate" | "rotate" | "scale") {
		return this.waypointGizmo.setMode(mode);
	}

	cycleWaypointGizmoMode() {
		return this.waypointGizmo.cycleMode();
	}

	hasSelectedWaypoint() {
		return Boolean(this.selectedWaypoint && this.waypointGizmo?.waypoint);
	}

	isWaypointGizmoInteracting() {
		return Boolean(this.waypointGizmo?.isInteracting?.());
	}

	refreshOpenEditors() {
		if (this.sequenceEditor && this.sequenceEditor.currentObject) {
			this.sequenceEditor.render();
		}
	}

	broadcastObjectLogicUpdate(object: any) {
		if (object && this.game?.broadcastObjectUpdate) {
			this.game.broadcastObjectUpdate(object);
		}
	}

	dispose() {
		this.closeWaypointPropertiesPanel();
		this.waypointGizmo?.dispose?.();
		this.clearVisualization();
		this.toolbar?.hide?.();
		if (this.sequenceEditor?.container) this.sequenceEditor.container.remove();
	}

	// --- SIMULATION CONTROLS ---

	playConfig(isFromNetwork = false) {
		if (this.gameConfig.sequences.length === 0) return;
		if (!this.configRuntime.hasStarted) {
			// First Start
			this.configRuntime.hasStarted = true;
			this.configRuntime.currentIndex = 0;
			this.configRuntime.timer = 0;
			this.configRuntime.totalTime = 0;
			console.log("Simulation Started");
		}
		this.configRuntime.isPlaying = true;
		this.configRuntime.isPaused = false;
		if (this.configPanel) this.configPanel.updatePlayState(true, false);

		if (!isFromNetwork && this.game.networkManager) {
			this.game.networkManager.sendSimulationControl("play", {
				hasStarted: this.configRuntime.hasStarted,
				currentIndex: this.configRuntime.currentIndex,
				timer: this.configRuntime.timer,
				totalTime: this.configRuntime.totalTime
			});
		}
	}

	pauseConfig(isFromNetwork = false) {
		if (this.configRuntime.isPlaying || isFromNetwork) {
			this.configRuntime.isPlaying = false; // Stop update loop logic
			this.configRuntime.isPaused = true; // Mark as paused (not stopped)
			console.log("Simulation Paused");
			if (this.configPanel) this.configPanel.updatePlayState(true, true); // Playing but Paused

			if (!isFromNetwork && this.game.networkManager) {
				this.game.networkManager.sendSimulationControl("pause", {
					currentIndex: this.configRuntime.currentIndex,
					timer: this.configRuntime.timer,
					totalTime: this.configRuntime.totalTime
				});
			}
		}
	}

	stopConfig(isFromNetwork = false) {
		this.configRuntime.isPlaying = false;
		this.configRuntime.hasStarted = false;
		this.configRuntime.currentIndex = 0;
		this.configRuntime.timer = 0;
		this.configRuntime.totalTime = 0;
		this.hud.hideTimer();
		if (this.configPanel) {
			this.configPanel.highlightBlock(-1); // Clear
			this.configPanel.updateTotalTime(0);
			this.configPanel.updatePlayState(false, false);
		}
		console.log("Simulation Stopped");

		if (!isFromNetwork && this.game.networkManager) {
			this.game.networkManager.sendSimulationControl("stop", null);
		}
	}

	stepConfig(dir: number, isFromNetwork = false) {
		if (this.gameConfig.sequences.length === 0) return;

		// If HUD was showing, hide it when stepping away from the block?
		// Or keep it? Let's hide to reset state visual
		this.hud.hideTimer();

		let newIdx = this.configRuntime.currentIndex + dir;
		if (newIdx < 0) newIdx = 0;
		if (newIdx > this.gameConfig.sequences.length) newIdx = this.gameConfig.sequences.length;

		this.configRuntime.currentIndex = newIdx;
		this.configRuntime.timer = 0; // Reset timer for new block

		if (this.configPanel) this.configPanel.highlightBlock(this.configRuntime.currentIndex);

		if (!isFromNetwork && this.game.networkManager) {
			this.game.networkManager.sendSimulationControl("step", { dir: dir, currentIndex: this.configRuntime.currentIndex });
		}
	}

	handleSimulationControlMessage(action: any, state: any) {
		if (state) {
			if (state.hasStarted !== undefined) this.configRuntime.hasStarted = state.hasStarted;
			if (state.currentIndex !== undefined) this.configRuntime.currentIndex = state.currentIndex;
			if (state.timer !== undefined) this.configRuntime.timer = state.timer;
			if (state.totalTime !== undefined) {
				this.configRuntime.totalTime = state.totalTime;
				if (this.configPanel) this.configPanel.updateTotalTime(this.configRuntime.totalTime);
			}
		}

		switch (action) {
			case "play":
				this.playConfig(true);
				break;
			case "pause":
				this.pauseConfig(true);
				break;
			case "stop":
				this.stopConfig(true);
				break;
			case "step":
				this.stepConfig(0, true); // Force update UI position
				if (this.configPanel) this.configPanel.highlightBlock(this.configRuntime.currentIndex);
				break;
		}
	}

	updateGameLogic(dt: number) {
		// Start logic auto-check removed in favor of explicit Play

		// Highlight UI even if paused/stopped if index exists (Visualization)
		if (this.configPanel) {
			this.configPanel.highlightBlock(this.configRuntime.currentIndex);
		}

		if (!this.configRuntime.isPlaying) return;

		// Update Total Time
		this.configRuntime.totalTime += dt;
		if (this.configPanel) {
			this.configPanel.updateTotalTime(this.configRuntime.totalTime);
		}

		const seq = this.gameConfig.sequences;
		if (this.configRuntime.currentIndex >= seq.length) {
			this.configRuntime.isPlaying = false; // Done
			this.configRuntime.hasStarted = false; // Reset start flag so Play restarts
			console.log("Game Sequence Finished");
			this.stopConfig(); // Auto-stop to reset UI
			return;
		}

		const block = seq[this.configRuntime.currentIndex];

		// --- EXECUTE BLOCK ---
		if (block.type === "start_signal" || block.type === "emit_signal") {
			const signalName = block.signalName || "signal";
			console.log("Broadcasting Signal:", signalName);
			this.broadcastSignal(signalName);
			this.configRuntime.currentIndex++;
			this.configRuntime.timer = 0;
		} else if (block.type === "time_wait") {
			const prevTime = this.configRuntime.timer;
			this.configRuntime.timer += dt;
			const currTime = this.configRuntime.timer;

			// --- 1. Start Signal ---
			if (prevTime === 0 && block.signalStart) {
				console.log("Broadcasting Start Signal:", block.signalStart);
				this.broadcastSignal(block.signalStart);
			}

			// --- 2. Interval Signals ---
			if (block.intervalSignals) {
				block.intervalSignals.forEach((sig: any) => {
					if (prevTime < sig.time && currTime >= sig.time) {
						console.log("Broadcasting Interval Signal:", sig.signal);
						this.broadcastSignal(sig.signal);
					}
				});
			}

			const remaining = Math.max(0, block.duration - currTime);

			if (block.showTimer) {
				this.hud.updateTimer(remaining, block.timerStyle, block.timerPosition);
			} else {
				this.hud.hideTimer();
			}

			// --- 3. End Signal & Finish ---
			if (currTime >= block.duration) {
				console.log("Time Wait Finished");

				if (block.signalEnd) {
					console.log("Broadcasting End Signal:", block.signalEnd);
					this.broadcastSignal(block.signalEnd);
				}

				this.configRuntime.currentIndex++;
				this.configRuntime.timer = 0;
				this.hud.hideTimer(); // Clean up when done
			}
		} else if (block.type === "end_game") {
			console.log("Game Over Triggered by Logic");
			this.configRuntime.isPlaying = false;
			this.hud.hideTimer();
			alert("¡Fin de la Partida!");
			this.stopConfig();
		} else if (block.type === "loop_game") {
			console.log("Looping Game Sequence");
			this.configRuntime.currentIndex = 0;
			this.configRuntime.timer = 0;
			this.hud.hideTimer();
		}
	}

	/**
	 * Scans the scene for objects that have logic properties.
	 */
	scanScene(scene: any) {
		const logicObjects = [];
		if (!scene) return logicObjects;

		scene.children.forEach((child: any) => {
			if (child.userData && child.userData.isEditableMapObject) {
				const isSpawn = child.userData.mapObjectType === "spawn_point";
				const isButton = child.userData.mapObjectType === "interaction_button";
				const isCollision = child.userData.mapObjectType === "interactive_collision";
				const isTarget = child.userData.mapObjectType === "target";
				const isLogicCamera = child.userData.mapObjectType === "logic_camera";
				const isCameraPanel = child.userData.mapObjectType === "camera_panel";
				const isInteractiveZone = ["impulse_jump", "impulse_lateral", "gravity_pad", "farming_zone", "gravity_sphere"].includes(child.userData.mapObjectType);
				const hasWaypoints = this.hasMovementLogic(child);
				const isDamageController = child.userData.mapObjectType === "damage_controller";
				const hasDamage = child.userData.logicProperties?.enableDamage === true;

				if (isSpawn || isButton || isCollision || isTarget || isLogicCamera || isCameraPanel || isInteractiveZone || hasWaypoints || isDamageController || hasDamage) {
					logicObjects.push(child);
				}
			}
			});
		return logicObjects;
	}

	/**
	 * Renders the properties panel for a selected object.
	 */
	renderPanel(container: HTMLElement, object: any, refreshCallback: any) {
		container.innerHTML = "";

		// Header
		const header = document.createElement("div");
		header.textContent = `Editando: ${this.getHumanReadableName(object.userData.mapObjectType)}`;
		header.style.cssText = `
			font-weight: bold;
			border-bottom: 1px solid #555;
			padding-bottom: 5px;
			margin-bottom: 10px;
		`;
		container.appendChild(header);

		// Ensure logic props exist
		if (!object.userData.logicProperties) object.userData.logicProperties = {};
		const props = object.userData.logicProperties;

		// --- SPECIFIC LOGIC HANDLERS ---

		// 1. Spawn Point Logic
		if (object.userData.mapObjectType === "spawn_point") {
			this.renderSpawnUI(container, object, props);
		}

		// 2. Movement Logic (Can be on any object)
		if (this.hasMovementLogic(object)) {
			this.renderMovementUI(container, object, props, refreshCallback);
		}

		// 3. Interaction Button Logic
		if (object.userData.mapObjectType === "interaction_button") {
			this.renderButtonUI(container, object, props);
		}

		// 3b. Gravity Sphere Logic
		if (object.userData.mapObjectType === "gravity_sphere") {
			this.renderButtonUI(container, object, props);
			if (props.selectorMode === undefined) props.selectorMode = "dynamic";
			const SELECTOR_MODE_OPTIONS = [
				{ value: "dynamic", label: "Dinámico (Círculo y Teclas móviles)" },
				{ value: "ring_static", label: "Círculo fijo, Teclas móviles" },
				{ value: "static", label: "Círculo y Teclas fijos" }
			];
			this.createSelectInput(container, object, "selectorMode", props.selectorMode, SELECTOR_MODE_OPTIONS, "Modo Selección 3D");
		}

		// 4. Interactive Collision Logic
		if (object.userData.mapObjectType === "interactive_collision") {
			this.interactiveCollisionLogic.render(container, props, (key: string, value: any) => {
				props[key] = value;
				if (refreshCallback) refreshCallback();
			});
		}

		// 5. Target Logic
		if (object.userData.mapObjectType === "target") {
			// Ensure default props for target are set
			if (props.name === undefined) props.name = "Diana Interactiva";
			if (props.rings === undefined) props.rings = 3;
			if (props.baseDamage === undefined) props.baseDamage = 10;
			if (props.radius === undefined) props.radius = 1.0;
			if (props.useProjectileDamage === undefined) props.useProjectileDamage = false;

			this.dianaLogic.render(container, props, (key: string, value: any) => {
				props[key] = value;

				// Recalculate multipliers if 'rings' changes
				if (key === 'rings') {
					const val = parseInt(value);
					const newMults = [];
					if (val === 1) {
						newMults.push(1.0);
					} else {
						for (let i = 0; i < val; i++) {
							const t = i / (val - 1);
							const v = 0.1 + t * 0.9;
							newMults.push(Number(v.toFixed(2)));
						}
					}
					props.ringMultipliers = newMults;
				}

				if (typeof object.updateTargetVisuals === 'function') {
					object.updateTargetVisuals();
				}

				if (refreshCallback) refreshCallback();
			});
			}

			if (object.userData.mapObjectType === "logic_camera") {
				this.renderLogicCameraUI(container, object, props);
			}

			if (object.userData.mapObjectType === "camera_panel") {
				this.renderCameraPanelUI(container, object, props);
			}

			if (object.userData.mapObjectType === "impulse_jump" || object.userData.mapObjectType === "impulse_lateral") {
				this.renderImpulsePadUI(container, object, props);
			}

		if (object.userData.mapObjectType === "gravity_pad") {
			this.renderGravityPadUI(container, object, props);
		}

		if (object.userData.mapObjectType === "farming_zone") {
			this.renderFarmingZoneUI(container, object, props);
		}

		// Render damage logic options for any object
		if (this.damageLogic) {
			this.damageLogic.render(container, props, (key: string, value: any) => {
				props[key] = value;
				this.broadcastObjectLogicUpdate(object);
				if (refreshCallback) refreshCallback();
				if (key === "enableDamage" || key === "enableKnockback") {
					this.renderPanel(container, object, refreshCallback);
				}
			});
		}
	}

	renderButtonUI(container: HTMLElement, object: any, props: any) {
		this.createInput(container, object, "holdTime", props.holdTime || 0, "number", "Tiempo Retener (s)");
		this.createInput(container, object, "oneShot", props.oneShot || false, "boolean", "Un Solo Uso");
		this.createInput(container, object, "pulsationMode", props.pulsationMode || false, "boolean", "Modo Pulsación");

		const info = document.createElement("div");
		info.textContent = `UUID: ${object.userData.uuid.substring(0, 8)}...`;
		info.style.cssText = "font-size:10px; color:#aaa; margin-top:10px;";
			container.appendChild(info);
		}

		renderLogicCameraUI(container: HTMLElement, object: any, props: any) {
			if (props.logicKind === undefined) props.logicKind = "logic_camera";
			if (props.name === undefined) props.name = "Camara";
			if (props.mode === undefined) props.mode = "fixed";
			if (props.fov === undefined) props.fov = 60;
			if (props.far === undefined) props.far = 6;

			const refreshVisual = () => {
				if (typeof object.updateLogicCameraVisuals === "function") object.updateLogicCameraVisuals();
				this.game?.logicCameraSystem?.showCameraPreview?.(object);
				this.broadcastObjectLogicUpdate(object);
			};

			this.createInput(container, object, "name", props.name, "text", "Nombre");
			this.createSelectInput(container, object, "mode", props.mode, [
				{ value: "fixed", label: "Fija" },
				{ value: "free_rotation", label: "Libre solo rotacion" }
			], "Modo de Vista");
			this.createInput(container, object, "fov", props.fov, "number", "FOV");
			this.createInput(container, object, "far", props.far, "number", "Distancia del Foco");

			const previewBtn = document.createElement("button");
			previewBtn.textContent = "Ver Preview";
			previewBtn.style.cssText = "width:100%; background:#064f9e; color:white; border:none; border-radius:4px; padding:7px; cursor:pointer; margin-top:8px;";
			previewBtn.onclick = () => this.game?.logicCameraSystem?.showCameraPreview?.(object);
			container.appendChild(previewBtn);

			Array.from(container.querySelectorAll("input, select")).slice(-4).forEach((control: any) => {
				const previous = control.onchange;
				control.onchange = (event: any) => {
					if (previous) previous(event);
					refreshVisual();
				};
			});
		}

		renderCameraPanelUI(container: HTMLElement, object: any, props: any) {
			if (props.logicKind === undefined) props.logicKind = "camera_panel";
			if (props.name === undefined) props.name = "Panel de Camaras";
			if (!Array.isArray(props.cameraIds)) props.cameraIds = [];
			if (props.holdTime === undefined) props.holdTime = 0;

			this.createInput(container, object, "name", props.name, "text", "Nombre");
			this.renderCameraListSelector(container, object, props);

			const info = document.createElement("div");
			info.textContent = "Al estar cerca, presiona F para abrir este panel y cambiar de camara.";
			info.style.cssText = "font-size:11px; color:#aaa; margin-top:8px; line-height:1.35;";
			container.appendChild(info);
		}

		renderCameraListSelector(container: HTMLElement, object: any, props: any) {
			const row = document.createElement("div");
			row.style.cssText = "display:flex; flex-direction:column; gap:6px; margin-top:8px;";
			const label = document.createElement("label");
			label.textContent = "Camaras disponibles";
			label.style.cssText = "color:#aaa; font-size:14px;";
			row.appendChild(label);

			const list = document.createElement("div");
			list.style.cssText = "display:flex; flex-direction:column; gap:6px; background:#111; border:1px solid #444; border-radius:4px; padding:8px;";
			const cameras = this.game?.logicCameraSystem?.getLogicCameras?.() || [];

			if (cameras.length === 0) {
				const empty = document.createElement("div");
				empty.textContent = "No hay camaras en el mapa.";
				empty.style.cssText = "font-size:11px; color:#888;";
				list.appendChild(empty);
			} else {
				cameras.forEach((cameraObject: any, index: number) => {
					const option = document.createElement("label");
					option.style.cssText = "display:flex; align-items:center; gap:8px; color:#ddd; font-size:12px;";
					const checkbox = document.createElement("input");
					checkbox.type = "checkbox";
					checkbox.checked = props.cameraIds.includes(cameraObject.userData.uuid);
					checkbox.onchange = () => {
						const ids = new Set(props.cameraIds);
						if (checkbox.checked) ids.add(cameraObject.userData.uuid);
						else ids.delete(cameraObject.userData.uuid);
						props.cameraIds = Array.from(ids);
						this.broadcastObjectLogicUpdate(object);
					};
					const name = cameraObject.userData.logicProperties?.name || cameraObject.userData.customName || `Camara ${index + 1}`;
					option.appendChild(checkbox);
					option.appendChild(document.createTextNode(name));
					list.appendChild(option);
				});
			}

			row.appendChild(list);
			container.appendChild(row);
		}

	renderImpulsePadUI(container: HTMLElement, object: any, props: any) {
		if (props.name === undefined) {
			props.name = object.userData.mapObjectType === "impulse_jump" ? "Pad de Salto" : "Pad de Empuje";
		}
		if (props.strength === undefined) {
			props.strength = object.userData.mapObjectType === "impulse_jump" ? 25 : 40;
		}
		if (props.cooldown === undefined) props.cooldown = 0.25;
		props.padKind = object.userData.mapObjectType === "impulse_jump" ? "jump" : "lateral";

		this.createInput(container, object, "name", props.name, "text", "Nombre");
		this.createInput(container, object, "strength", props.strength, "number", "Fuerza");
		this.createInput(container, object, "cooldown", props.cooldown, "number", "Cooldown (s)");

		const hint = document.createElement("div");
		hint.textContent = props.padKind === "lateral"
			? "La rotación Y del objeto controla la dirección del empuje."
			: "Impulsa al jugador hacia arriba al entrar en el pad.";
		hint.style.cssText = "font-size:11px; color:#aaa; margin-top:8px; line-height:1.35;";
		container.appendChild(hint);
	}

	renderGravityPadUI(container: HTMLElement, object: any, props: any) {
		if (props.name === undefined) props.name = "Pad de Gravedad";
		if (props.gravityOrientation === undefined) props.gravityOrientation = "up";
		if (props.transitionDuration === undefined) props.transitionDuration = 0.8;
		if (props.cooldown === undefined) props.cooldown = 0.35;
		props.gravityOrientation = normalizeGravityOrientation(props.gravityOrientation);

		this.createInput(container, object, "name", props.name, "text", "Nombre");
		this.createSelectInput(container, object, "gravityOrientation", props.gravityOrientation, GRAVITY_ORIENTATION_OPTIONS, "Orientación");
		this.createInput(container, object, "transitionDuration", props.transitionDuration, "number", "Duración Giro (s)");
		this.createInput(container, object, "cooldown", props.cooldown, "number", "Cooldown (s)");

		const hint = document.createElement("div");
		hint.textContent = "Al entrar, cambia la atracción del jugador. Arriba hace que el techo sea el nuevo suelo.";
		hint.style.cssText = "font-size:11px; color:#aaa; margin-top:8px; line-height:1.35;";
		container.appendChild(hint);
	}

	renderFarmingZoneUI(container: HTMLElement, object: any, props: any) {
		if (props.name === undefined) props.name = "Zona de Farmeo";
		if (props.spawnInterval === undefined) props.spawnInterval = 1.0;
		if (props.itemsPerSpawn === undefined) props.itemsPerSpawn = 1;
		if (props.itemValue === undefined) props.itemValue = 1;
		if (props.groupId === undefined) props.groupId = "Grupo 1";
		if (props.itemTexture === undefined) props.itemTexture = "/assets/textures/fuego.png";

		this.createInput(container, object, "name", props.name, "text", "Nombre");
		this.createInput(container, object, "spawnInterval", props.spawnInterval, "number", "Intervalo Spawn (s)");
		this.createInput(container, object, "itemsPerSpawn", props.itemsPerSpawn, "number", "Items por Spawn");
		this.createInput(container, object, "itemValue", props.itemValue, "number", "Valor de Fuego");

		this.createGroupSelector(container, object, props);
		this.createTextureSelector(container, object, props);
	}

	createGroupSelector(container: HTMLElement, object: any, props: any) {
		const row = document.createElement("div");
		row.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-top: 8px; margin-bottom: 5px;";

		const existingGroups = new Set<string>();
		if (this.game) {
			const activeGroups = getActiveFarmingGroups(this.game);
			activeGroups.forEach(g => {
				if (g.groupId && g.groupId.trim()) {
					existingGroups.add(g.groupId);
				}
			});
		}
		if (props.groupId && props.groupId.trim()) {
			existingGroups.add(props.groupId);
		}

		const groupsArray = Array.from(existingGroups);
		const selectContainer = document.createElement("div");
		selectContainer.style.cssText = "display: flex; flex-direction: column; gap: 5px; width: 100%;";

		if (groupsArray.length === 0) {
			const label = document.createElement("label");
			label.textContent = "Grupo de Conexión";
			label.style.color = "#aaa";
			label.style.fontSize = "14px";
			row.appendChild(label);

			const input = document.createElement("input");
			input.type = "text";
			input.value = props.groupId || "Grupo 1";
			input.placeholder = "Escribe el nombre del grupo";
			input.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 100%; box-sizing: border-box;";
			input.addEventListener("input", (e: any) => {
				props.groupId = e.target.value;
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			});
			selectContainer.appendChild(input);

			const info = document.createElement("div");
			info.textContent = "No hay otros grupos creados. Escribe un nombre para este grupo.";
			info.style.cssText = "font-size: 10px; color: #888; margin-top: 2px; line-height: 1.2;";
			selectContainer.appendChild(info);
		} else {
			const labelRow = document.createElement("div");
			labelRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;";

			const titleSpan = document.createElement("span");
			titleSpan.textContent = "Grupo de Conexión";
			titleSpan.style.color = "#aaa";
			titleSpan.style.fontSize = "14px";
			labelRow.appendChild(titleSpan);

			const modeTabs = document.createElement("div");
			modeTabs.style.cssText = "display: flex; gap: 2px; background: #222; border-radius: 4px; padding: 2px;";

			const tabSelect = document.createElement("button");
			tabSelect.textContent = "Elegir";
			tabSelect.style.cssText = "background: #333; border: none; color: white; padding: 2px 8px; font-size: 10px; border-radius: 3px; cursor: pointer; font-weight: bold;";

			const tabCreate = document.createElement("button");
			tabCreate.textContent = "Crear";
			tabCreate.style.cssText = "background: transparent; border: none; color: #aaa; padding: 2px 8px; font-size: 10px; border-radius: 3px; cursor: pointer;";

			modeTabs.appendChild(tabSelect);
			modeTabs.appendChild(tabCreate);
			labelRow.appendChild(modeTabs);
			row.appendChild(labelRow);

			const select = document.createElement("select");
			select.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 100%; cursor: pointer; box-sizing: border-box;";

			groupsArray.forEach(g => {
				const opt = document.createElement("option");
				opt.value = g;
				opt.textContent = g;
				if (g === props.groupId) opt.selected = true;
				select.appendChild(opt);
			});

			const inputContainer = document.createElement("div");
			inputContainer.style.cssText = "display: none; flex-direction: column; gap: 4px; width: 100%;";

			const input = document.createElement("input");
			input.type = "text";
			input.placeholder = "Nombre del nuevo grupo";
			input.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 100%; box-sizing: border-box;";

			inputContainer.appendChild(input);

			const isExisting = groupsArray.includes(props.groupId);
			if (isExisting) {
				tabSelect.style.background = "#333";
				tabSelect.style.color = "white";
				tabCreate.style.background = "transparent";
				tabCreate.style.color = "#aaa";
				select.style.display = "block";
				inputContainer.style.display = "none";
			} else {
				tabSelect.style.background = "transparent";
				tabSelect.style.color = "#aaa";
				tabCreate.style.background = "#333";
				tabCreate.style.color = "white";
				select.style.display = "none";
				inputContainer.style.display = "flex";
				input.value = props.groupId;
			}

			// Events
			tabSelect.onclick = (e) => {
				e.preventDefault();
				tabSelect.style.background = "#333";
				tabSelect.style.color = "white";
				tabCreate.style.background = "transparent";
				tabCreate.style.color = "#aaa";
				select.style.display = "block";
				inputContainer.style.display = "none";
				props.groupId = select.value;
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			};

			tabCreate.onclick = (e) => {
				e.preventDefault();
				tabSelect.style.background = "transparent";
				tabSelect.style.color = "#aaa";
				tabCreate.style.background = "#333";
				tabCreate.style.color = "white";
				select.style.display = "none";
				inputContainer.style.display = "flex";
				props.groupId = input.value.trim() || "Grupo 1";
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			};

			select.onchange = (e: any) => {
				props.groupId = e.target.value;
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			};

			input.oninput = (e: any) => {
				props.groupId = e.target.value.trim() || "Grupo 1";
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			};

			selectContainer.appendChild(select);
			selectContainer.appendChild(inputContainer);
		}

		row.appendChild(selectContainer);
		container.appendChild(row);
	}

	createTextureSelector(container: HTMLElement, object: any, props: any) {
		const row = document.createElement("div");
		row.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-top: 8px; margin-bottom: 5px;";

		const label = document.createElement("label");
		label.textContent = "Textura del Item";
		label.style.color = "#aaa";
		label.style.fontSize = "14px";
		row.appendChild(label);

		const select = document.createElement("select");
		select.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 100%; cursor: pointer;";

		const options = [
			{ name: "Fuego", val: "/assets/textures/fuego.png" },
			{ name: "Pelota", val: "/assets/textures/pelota.png" },
			{ name: "Custom PNG / URL...", val: "__CUSTOM__" }
		];

		let isCustomTexture = true;
		options.forEach(opt => {
			const o = document.createElement("option");
			o.value = opt.val;
			o.textContent = opt.name;
			if (props.itemTexture === opt.val) {
				o.selected = true;
				isCustomTexture = false;
			}
			select.appendChild(o);
		});

		if (isCustomTexture && props.itemTexture) {
			select.value = "__CUSTOM__";
		}

		row.appendChild(select);

		const customInputRow = document.createElement("div");
		customInputRow.style.cssText = isCustomTexture ? "display: flex; gap: 5px; margin-top: 5px;" : "display: none; gap: 5px; margin-top: 5px;";

		const customInput = document.createElement("input");
		customInput.type = "text";
		customInput.placeholder = "Ruta o URL (PNG)";
		customInput.value = isCustomTexture ? (props.itemTexture || "") : "";
		customInput.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; flex: 1;";

		customInputRow.appendChild(customInput);
		row.appendChild(customInputRow);

		select.onchange = (e: any) => {
			const val = e.target.value;
			if (val === "__CUSTOM__") {
				customInputRow.style.display = "flex";
				props.itemTexture = customInput.value.trim() || "/assets/textures/fuego.png";
			} else {
				customInputRow.style.display = "none";
				props.itemTexture = val;
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			}
		};

		customInput.onchange = () => {
			const val = customInput.value.trim();
			if (val) {
				props.itemTexture = val;
				if (this.game && this.game.hud) {
					this.game.hud.updateFarmingCounters(this.game);
				}
			}
		};

		container.appendChild(row);
	}

	renderSpawnUI(container: HTMLElement, object: any, props: any) {
		if (props.isDefault) {
			const tag = document.createElement("div");
			tag.textContent = "Punto de Aparición Default";
			tag.style.cssText = "color: #ffcc00; font-size: 11px; padding: 5px; background: #332200; border: 1px solid #aa8800; border-radius: 4px; text-align: center; margin-bottom: 8px; font-weight: bold;";
			container.appendChild(tag);
		}
		this.createInput(container, object, "team", props.team || 1, "number", "Equipo");
		this.createInput(container, object, "capacity", props.capacity || 1, "number", "Capacidad");
		this.createInput(container, object, "order", props.order || 1, "number", "Orden");
	}

	renderMovementUI(container: HTMLElement, object: any, props: any, refreshCallback: any) {
		const sequences = this.ensureMovementSequences(props, object);

		// Primary Sequence (Quick Edit)
		const mainSeq = sequences[0];

		const mvHeader = document.createElement("div");
		mvHeader.innerHTML = `<span style="color:#00FFFF"> Animación (Rápida)</span>`;
		mvHeader.style.cssText = `
			margin-top: 15px; margin-bottom: 10px; 
			font-weight: bold; border-top: 1px solid #444; padding-top: 10px;
		`;
		container.appendChild(mvHeader);

		// --- Edit on Map Button (Quick) ---
		const editMapBtn = document.createElement("button");
		editMapBtn.textContent = "Editar en Mapa 3D";
		editMapBtn.style.cssText = `
			width: 100%; background: #0066cc; color: white; border: none; 
			padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 10px; font-weight: bold;
		`;
		editMapBtn.onclick = () => this.startMapEdit(object, 0);
		container.appendChild(editMapBtn);

		// --- Quick Properties (Seq 0) ---
		this.createInput(container, mainSeq, "speed", mainSeq.speed || 2.0, "number", "Velocidad");
		this.createInput(container, mainSeq, "loop", mainSeq.loop !== false, "boolean", "Bucle Infinito");
		this.createInput(container, mainSeq, "active", mainSeq.active !== false, "boolean", "Activo al Inicio");

		// --- Quick Waypoints List ---
		const wpHeader = document.createElement("div");
		wpHeader.textContent = `Puntos (Secuencia Principal): ${mainSeq.waypoints.length}`;
		wpHeader.style.cssText = "margin-top: 5px; font-size: 11px; color: #aaa;";
		container.appendChild(wpHeader);

		// Capture Button
		const captureBtn = document.createElement("button");
		captureBtn.textContent = "+ Capturar Posición Actual";
		captureBtn.style.cssText = `
			width: 100%; background: #222; color: #aaa; border: 1px dashed #555; 
			padding: 4px; cursor: pointer; border-radius: 4px; margin-top: 5px; font-size:10px;
		`;
		captureBtn.onclick = () => {
			const wp = this.createWaypointFromObject(object);
			mainSeq.waypoints.push(wp);
			this.selectWaypoint(object, 0, mainSeq.waypoints.length - 1, "translate");
			this.renderPanel(container, object, refreshCallback);
			this.updateVisualization();
			this.broadcastObjectLogicUpdate(object);
		};
		container.appendChild(captureBtn);

		const wpList = document.createElement("div");
		wpList.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-top:8px; margin-bottom:12px;";
		mainSeq.waypoints.forEach((wp: MovementWaypoint, wpIdx: number) => {
			if (wp.type === "wait_signal") return;
			normalizeMovementWaypoint(wp, object);
			const pos = getWaypointPosition(wp, object);
			const rot = getWaypointRotation(wp, object);
			const scale = getWaypointScale(wp, object);
			const turns = describeRotationTurns(wp.rotationTurns);
			const row = document.createElement("div");
			row.style.cssText = "background:#1c1c1c; border:1px solid #333; border-radius:4px; padding:6px; font-size:10px; color:#ddd;";
			row.innerHTML = `
				<div style="display:flex; justify-content:space-between; gap:6px; align-items:center;">
					<strong>Punto #${wpIdx + 1}</strong>
					<span style="color:#aaa;">rot Y ${radiansToDegrees(rot.y).toFixed(0)}°</span>
				</div>
				<div style="font-family:monospace; color:#aaa; margin-top:3px;">pos ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</div>
				<div style="font-family:monospace; color:#aaa;">tam ${scale.x.toFixed(1)}, ${scale.y.toFixed(1)}, ${scale.z.toFixed(1)}</div>
				<div style="color:#88ccff;">vueltas: ${turns}</div>
			`;

			const tools = document.createElement("div");
			tools.style.cssText = "display:flex; gap:4px; margin-top:5px;";

			const editBtn = document.createElement("button");
			editBtn.textContent = "Gizmo";
			editBtn.style.cssText = "flex:1; background:#064f9e; color:white; border:none; border-radius:3px; padding:3px; cursor:pointer; font-size:10px;";
			editBtn.onclick = () => this.selectWaypoint(object, 0, wpIdx, "translate");
			tools.appendChild(editBtn);

			const captureCurrentBtn = document.createElement("button");
			captureCurrentBtn.textContent = "Actualizar";
			captureCurrentBtn.style.cssText = "flex:1; background:#333; color:white; border:1px solid #555; border-radius:3px; padding:3px; cursor:pointer; font-size:10px;";
			captureCurrentBtn.onclick = () => this.updateWaypointFromObject(object, 0, wpIdx);
			tools.appendChild(captureCurrentBtn);

			const delBtn = document.createElement("button");
			delBtn.textContent = "X";
			delBtn.style.cssText = "width:26px; background:#622; color:white; border:none; border-radius:3px; padding:3px; cursor:pointer; font-size:10px;";
			delBtn.onclick = () => {
				mainSeq.waypoints.splice(wpIdx, 1);
				this.waypointGizmo.detach();
				this.selectedWaypoint = null;
				this.renderPanel(container, object, refreshCallback);
				this.updateVisualization();
				this.broadcastObjectLogicUpdate(object);
			};
			tools.appendChild(delBtn);

			row.appendChild(tools);
			wpList.appendChild(row);
		});
		container.appendChild(wpList);

		// --- ADVANCED SEQUENCES SECION ---
		const advHeader = document.createElement("div");
		advHeader.textContent = "Gestión Avanzada de Secuencias";
		advHeader.style.cssText = "font-size:11px; font-weight:bold; color:#888; margin-bottom:5px;";
		container.appendChild(advHeader);

		// List all sequences
		const seqList = document.createElement("div");
		seqList.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;";

		props.sequences.forEach((seq: any, idx: number) => {
			const seqRow = document.createElement("div");
			seqRow.style.cssText = `
				background: #222; padding: 4px; border-radius: 4px; border: 1px solid #444;
			`;
			const topRow = document.createElement("div");
			topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

			const nameSpan = document.createElement("span");
			const dispName = seq.name;
			nameSpan.textContent = (idx === 0 ? "★ " : "") + dispName;
			nameSpan.style.cssText = "font-size:11px; color:#ddd;";

			topRow.appendChild(nameSpan);

			const toolsDiv = document.createElement("div");

			// Edit Visual
			const editBtn = document.createElement("button");
			editBtn.textContent = "Editor Visual";
			editBtn.style.cssText = "background: #0066cc; color: white; border: none; padding: 2px 5px; font-size: 9px; cursor: pointer; border-radius: 3px; margin-right:5px;";
			editBtn.onclick = () => this.openSequenceEditor(object, idx);
			toolsDiv.appendChild(editBtn);

			// Delete
			if (idx > 0) {
				const delBtn = document.createElement("button");
				delBtn.textContent = "🗑";
				delBtn.style.cssText = "background:none; border:none; color:#f44; cursor:pointer;";
				delBtn.onclick = () => {
					if (confirm("¿Eliminar?")) {
						props.sequences.splice(idx, 1);
						this.waypointGizmo.detach();
						this.selectedWaypoint = null;
						this.renderPanel(container, object, refreshCallback);
						this.updateVisualization();
						this.broadcastObjectLogicUpdate(object);
					}
				};
				toolsDiv.appendChild(delBtn);
			}

			topRow.appendChild(toolsDiv);
			seqRow.appendChild(topRow);
			seqList.appendChild(seqRow);
		});
		container.appendChild(seqList);

		// Add
		const addSeqBtn = document.createElement("button");
		addSeqBtn.textContent = "+ Nueva Secuencia";
		addSeqBtn.style.cssText = "width: 100%; background: #333; color: white; border: 1px solid #555; padding: 4px; border-radius: 4px; font-size:10px;";
		addSeqBtn.onclick = () => {
			const name = prompt("Nombre:", "Nueva Secuencia");
			if (name) {
				props.sequences.push({
					name: name, waypoints: [], loop: true, active: false, speed: 2.0, triggerType: "none"
				});
				this.renderPanel(container, object, refreshCallback);
				this.updateVisualization();
				this.broadcastObjectLogicUpdate(object);
			}
		};
		container.appendChild(addSeqBtn);
	}

	openSequenceEditor(object: any, sequenceIndex: number) {
		this.sequenceEditor.open(object, sequenceIndex);
	}

	// --- MAP EDIT MODE ---

	startMapEdit(object: any, sequenceIndex = 0) {
		this.isEditingMap = true;
		this.editingObject = object;
		this.editingSequenceIndex = sequenceIndex; // Store index
		if (object?.userData?.logicProperties) {
			this.ensureMovementSequences(object.userData.logicProperties, object);
		}

		// Hide Main Menu
		if (this.game.constructionMenu) {
			this.game.constructionMenu.container.style.display = "none";
			if (this.game.inputManager) {
				this.game.inputManager.enabled = true;
				this.game.isMouseDown = false; // Reset
				if (this.game.cameraController) this.game.cameraController.lock();
			}
		}

		// Show Toolbar
		this.toolbar.show();
		// AUTO-SELECT WAYPOINT TOOL
		this.toolbar.setActiveTool("waypoint");

		// Sync Aerial Grid State
		if (this.game.placementManager) {
			this.toolbar.setAerialGridState(this.game.placementManager.aerialGridActive);
		}

		// Visualizers
		this.updateVisualization();

		if (this.editingObject.userData.logicProperties.isPreviewing === undefined) {
			this.editingObject.userData.logicProperties.isPreviewing = false;
		}
		this.toolbar.setPlayButtonState(this.editingObject.userData.logicProperties.isPreviewing);

		console.log("Started Map Logic Edit Mode");
	}

	toggleAnimation() {
		if (!this.editingObject) return;

		const props = this.editingObject.userData.logicProperties;
		props.isPreviewing = !props.isPreviewing;

		this.toolbar.setPlayButtonState(props.isPreviewing);
	}

	toggleAerialGrid() {
		if (this.game.placementManager) {
			const isActive = !this.game.placementManager.aerialGridActive;
			this.game.placementManager.setAerialGrid(isActive);

			this.toolbar.setAerialGridState(isActive);

			const mainChk = document.getElementById("chk-aerial-grid") as HTMLInputElement | null;
			if (mainChk) mainChk.checked = isActive;

			const statusEl = document.getElementById("aerial-grid-status");
			if (statusEl) {
				statusEl.style.display = isActive ? "block" : "none";
				statusEl.textContent = "G: Suelo No Fijado";
				statusEl.style.color = "#00FF00";
			}
		}
	}

	endMapEdit() {
		this.isEditingMap = false;
		this.editingObject = null;
		this.selectedWaypoint = null;
		this.closeWaypointPropertiesPanel();
		this.waypointGizmo.detach();
		this.toolbar.hide();

		// Show Main Menu
		if (this.game.constructionMenu) {
			this.game.constructionMenu.container.style.display = "flex";
			document.exitPointerLock();
			if (this.game.inputManager) this.game.inputManager.enabled = false;
		}

		this.clearVisualization();
	}

	update(dt: number) {
		// Run Game Config Logic:
		if ((!this.isEditingMap && this.game.gameMode !== "editor") || this.configRuntime.isPlaying) {
			this.updateGameLogic(dt);
		}

		// Dynamically update accumulated damage display if panel is showing
		if (this.editingObject && this.damageLogic && this.editingObject.userData.logicProperties) {
			this.damageLogic.updateAccumulatedDamageDisplay(this.editingObject.userData.logicProperties);
		}

		if (!this.isEditingMap || !this.editingObject) return;

		if (this.toolbar.activeTool === "waypoint") {
			// Placeholder for waypoint logic
		}
	}

	clearVisualization() {
		this.pathVisualizer.traverse((child: any) => {
			if (child === this.pathVisualizer) return;
			child.geometry?.dispose?.();
			if (child.material?.map) child.material.map.dispose?.();
			if (Array.isArray(child.material)) {
				child.material.forEach((material: any) => {
					material.map?.dispose?.();
					material.dispose?.();
				});
			} else {
				child.material?.dispose?.();
			}
		});
		this.pathVisualizer.clear();
	}

	createTextSprite(text: string, color = "#ffffff") {
		const canvas = document.createElement("canvas");
		canvas.width = 512;
		canvas.height = 160;
		const ctx = canvas.getContext("2d")!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "rgba(0,0,0,0.72)";
		ctx.strokeStyle = color;
		ctx.lineWidth = 4;
		if (typeof (ctx as any).roundRect === "function") {
			ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 14);
		} else {
			ctx.rect(8, 8, canvas.width - 16, canvas.height - 16);
		}
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = color;
		ctx.font = "bold 34px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const lines = text.split("\n");
		lines.forEach((line, idx) => {
			ctx.fillText(line, canvas.width / 2, 54 + idx * 42);
		});
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(2.8, 0.88, 1);
		sprite.renderOrder = 999;
		return sprite;
	}

	getWaypointLabel(wp: MovementWaypoint, index: number) {
		const rot = getWaypointRotation(wp);
		const scale = getWaypointScale(wp);
		const turns = describeRotationTurns(getWaypointRotationTurns(wp));
		return `P${index + 1} rotY ${radiansToDegrees(rot.y).toFixed(0)}°\n${turns} | tam ${scale.x.toFixed(1)},${scale.y.toFixed(1)},${scale.z.toFixed(1)}`;
	}

	updateVisualization() {
		this.clearVisualization();

		const obj = this.editingObject || (this.sequenceEditor && this.sequenceEditor.currentObject);
		if (!obj) return;

		const props = obj.userData.logicProperties;
		if (!props) return;
		const sequences = this.ensureMovementSequences(props, obj);

		const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

		sequences.forEach((seq: any, idx: number) => {
			if (!seq.waypoints || seq.waypoints.length === 0) return;

			const color = colors[idx % colors.length];
			const isSeqEditorActive = (this.sequenceEditor && this.sequenceEditor.currentObject === obj && this.sequenceEditor.currentSeqIndex === idx);
			const isMapEditActive = (this.isEditingMap && this.editingObject === obj && (this.editingSequenceIndex === idx || this.editingSequenceIndex === undefined));
			const isEditing = isSeqEditorActive || isMapEditActive;
			const finalColor = isEditing ? 0xFFFFFF : color;
			const selected = this.selectedWaypoint;

			// Draw Lines
			const points = [];
			points.push(obj.position.clone());

			seq.waypoints.forEach((wp: any) => {
				if (wp.type === "wait_signal") return;
				normalizeMovementWaypoint(wp, obj);
				if (wp.x !== undefined && wp.y !== undefined && wp.z !== undefined) {
					points.push(new THREE.Vector3(wp.x, wp.y, wp.z));
				}
			});

			if (seq.loop && points.length > 0) {
				points.push(obj.position.clone());
			}

			if (points.length > 1) {
				const geometry = new THREE.BufferGeometry().setFromPoints(points);
				const material = new THREE.LineBasicMaterial({ color: finalColor, linewidth: isEditing ? 3 : 1 });
				const line = new THREE.Line(geometry, material);
				this.pathVisualizer.add(line);
			}

			// Waypoints
			seq.waypoints.forEach((wp: MovementWaypoint, wpIdx: number) => {
				if (wp.type === "wait_signal") return;
				normalizeMovementWaypoint(wp, obj);
				if (wp.x === undefined || wp.y === undefined || wp.z === undefined) return;

				const posData = getWaypointPosition(wp, obj);
				const rot = getWaypointRotation(wp, obj);
				const scale = getWaypointScale(wp, obj);
				const pos = new THREE.Vector3(posData.x, posData.y, posData.z);
				const isSelected = selected?.object === obj && selected.sequenceIndex === idx && selected.waypointIndex === wpIdx;
				const dotGeo = new THREE.SphereGeometry(isSelected ? 0.3 : 0.2, 12, 12);
				const dotMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0xffd84d : 0xFF0000 });

				const arrowLen = Math.max(1.0, Math.min(Math.max(scale.x, scale.y, scale.z) * 0.65, 4.0));
				const arrowDir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(rot.x, rot.y, rot.z));
				const arrow = new THREE.ArrowHelper(arrowDir.normalize(), pos, arrowLen, isSelected ? 0xffd84d : 0x00FF00);
				arrow.userData.isMovementWaypointPreview = true;
				this.pathVisualizer.add(arrow);

				const dot = new THREE.Mesh(dotGeo, dotMat);
				dot.position.copy(pos);
				dot.userData.isMovementWaypointHandle = true;
				dot.userData.sequenceIndex = idx;
				dot.userData.waypointIndex = wpIdx;
				this.pathVisualizer.add(dot);

				if (isEditing) {
					const ghostGeo = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
					const ghostMat = new THREE.MeshBasicMaterial({
						color: isSelected ? 0xffd84d : 0x0000FF,
						wireframe: true,
						transparent: true,
						opacity: isSelected ? 0.55 : 0.3
					});
					const ghost = new THREE.Mesh(ghostGeo, ghostMat);
					ghost.position.copy(pos);
					ghost.rotation.set(rot.x, rot.y, rot.z);
					ghost.userData.isMovementWaypointHandle = true;
					ghost.userData.sequenceIndex = idx;
					ghost.userData.waypointIndex = wpIdx;
					this.pathVisualizer.add(ghost);

					const label = this.createTextSprite(this.getWaypointLabel(wp, wpIdx), isSelected ? "#ffd84d" : "#88ccff");
					label.position.copy(pos);
					label.position.y += Math.max(scale.y / 2 + 0.55, 0.9);
					label.userData.isMovementWaypointPreview = true;
					this.pathVisualizer.add(label);
				}
			});
		});
	}

	// --- UTILS ---

	createInput(container: HTMLElement, object: any, key: string, val: any, type: string, labelText: string) {
		const row = document.createElement("div");
		row.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px;";

		const label = document.createElement("label");
		label.textContent = labelText || key;
		label.style.color = "#aaa";
		label.style.fontSize = "14px";

		const input = document.createElement("input");
		input.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 60%;";

		if (type === "number") {
			input.type = "number";
			input.value = val;
			input.step = "0.1";
			input.onchange = (e: any) => {
				if (object?.userData?.logicProperties) object.userData.logicProperties[key] = parseFloat(e.target.value);
				else object[key] = parseFloat(e.target.value);
			};
		} else if (type === "boolean") {
			input.type = "checkbox";
			input.checked = val;
			input.style.width = "auto";
			input.onchange = (e: any) => {
				if (object?.userData?.logicProperties) object.userData.logicProperties[key] = e.target.checked;
				else object[key] = e.target.checked;
			};
		} else {
			input.type = "text";
			input.value = val;
			input.onchange = (e: any) => {
				if (object?.userData?.logicProperties) object.userData.logicProperties[key] = e.target.value;
				else object[key] = e.target.value;
			};
		}

		row.appendChild(label);
		row.appendChild(input);
		container.appendChild(row);
	}

	createSelectInput(container: HTMLElement, object: any, key: string, val: any, options: Array<{ value: string; label: string }>, labelText: string) {
		const row = document.createElement("div");
		row.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px;";

		const label = document.createElement("label");
		label.textContent = labelText || key;
		label.style.color = "#aaa";
		label.style.fontSize = "14px";

		const select = document.createElement("select");
		select.style.cssText = "background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 60%;";
		options.forEach((option) => {
			const opt = document.createElement("option");
			opt.value = option.value;
			opt.textContent = option.label;
			if (val === option.value) opt.selected = true;
			select.appendChild(opt);
		});
		select.onchange = (e: any) => {
			if (object?.userData?.logicProperties) object.userData.logicProperties[key] = e.target.value;
			else object[key] = e.target.value;
		};

		row.appendChild(label);
		row.appendChild(select);
		container.appendChild(row);
	}

	broadcastSignal(signalName: string) {
		if (!this.game) return;

		if (this.game.emitSignal) {
			this.game.emitSignal(signalName);
		}
	}

	activateObjectSequence(obj: any, seq: any) {
		// Simple activation wrapper
		seq.active = true;
		void obj;
	}

	getHumanReadableName(type: string) {
		switch (type) {
			case "spawn_point": return "Punto de Spawn";
			case "movement_object": return "Objetos con Movimiento";
			case "interaction_button": return "Botones Interactivos";
			case "target": return "Diana Interactiva";
			case "movement_controller": return "Animador";
			case "damage_controller": return "Controlador de Daño";
			case "interactive_collision": return "Colisión Interactiva";
			case "logic_camera": return "Camara";
			case "camera_panel": return "Panel de Camaras";
			case "interactive_zones": return "Pads y Zonas";
			case "impulse_jump": return "Pad de Salto";
			case "impulse_lateral": return "Pad de Empuje";
			case "gravity_pad": return "Pad de Gravedad";
			case "farming_zone": return "Zona de Farmeo";
			default: return type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Objeto";
		}
	}
}

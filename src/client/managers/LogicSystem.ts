import * as THREE from "three";
import { LogicToolbar } from "../ui/LogicToolbar";
import { LogicSequenceEditor } from "../ui/LogicSequenceEditor";
import { InteractiveCollisionLogic } from "../ui/logic_items/InteractiveCollisionLogic";
import { TargetLogic } from "../ui/logic_items/TargetLogic";
import { PlayerConfigManager } from "./PlayerConfigManager";

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

	constructor(game: any) {
		this.game = game;
		this.isEditingMap = false;
		this.editingObject = null;
		this.editingSequenceIndex = undefined;
		this.toolbar = new LogicToolbar(game);
		this.sequenceEditor = new LogicSequenceEditor(game, this);
		// this.hud = new GameHUD() // Use shared HUD from Game
		this.hud = this.game.hud;
		// Use shared PlayerConfigManager from Game if available
		this.playerConfigManager = game.playerConfigManager || new PlayerConfigManager(game);

		// Toolbar Callbacks
		this.toolbar.onClose = () => this.endMapEdit();
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
				const hasWaypoints = child.userData.logicProperties && child.userData.logicProperties.waypoints;

				if (isSpawn || isButton || isCollision || isTarget || hasWaypoints) {
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
		if (props.waypoints) {
			this.renderMovementUI(container, object, props, refreshCallback);
		}

		// 3. Interaction Button Logic
		if (object.userData.mapObjectType === "interaction_button") {
			this.renderButtonUI(container, object, props);
		}

		// 4. Interactive Collision Logic
		if (object.userData.mapObjectType === "interactive_collision") {
			InteractiveCollisionLogic.setupUI(container, object, props, this);
		}

		// 5. Target Logic
		if (object.userData.mapObjectType === "target") {
			TargetLogic.setupUI(container, object, props, this);
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
		// --- MIGRATION & INIT ---
		if (props.waypoints && !props.sequences) {
			props.sequences = [{
				name: "Secuencia Principal",
				waypoints: props.waypoints,
				loop: props.loop !== false,
				active: props.active !== false,
				speed: props.speed || 2.0,
				triggerType: "none"
			}];
			delete props.waypoints; delete props.loop; delete props.active; delete props.speed;
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
		props.sequences[0].name = "Secuencia Principal";

		// Primary Sequence (Quick Edit)
		const mainSeq = props.sequences[0];

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
			const wp = {
				x: object.position.x,
				y: object.position.y,
				z: object.position.z,
				rotY: object.rotation.y,
				delay: 0,
				teleport: false
			};
			mainSeq.waypoints.push(wp);
			this.renderPanel(container, object, refreshCallback);
			this.updateVisualization();
		};
		container.appendChild(captureBtn);

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
						this.renderPanel(container, object, refreshCallback);
						this.updateVisualization();
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
		this.toolbar.hide();

		// Show Main Menu
		if (this.game.constructionMenu) {
			this.game.constructionMenu.container.style.display = "flex";
			document.exitPointerLock();
			if (this.game.inputManager) this.game.inputManager.enabled = false;
		}

		this.pathVisualizer.clear();
	}

	update(dt: number) {
		// Run Game Config Logic:
		if ((!this.isEditingMap && this.game.gameMode !== "editor") || this.configRuntime.isPlaying) {
			this.updateGameLogic(dt);
		}

		if (!this.isEditingMap || !this.editingObject) return;

		if (this.toolbar.activeTool === "waypoint") {
			// Placeholder for waypoint logic
		}
	}

	updateVisualization() {
		this.pathVisualizer.clear();

		const obj = this.editingObject || (this.sequenceEditor && this.sequenceEditor.currentObject);
		if (!obj) return;

		const props = obj.userData.logicProperties;
		if (!props || !props.sequences) return;

		const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];

		props.sequences.forEach((seq: any, idx: number) => {
			if (!seq.waypoints || seq.waypoints.length === 0) return;

			const color = colors[idx % colors.length];
			const isSeqEditorActive = (this.sequenceEditor && this.sequenceEditor.currentObject === obj && this.sequenceEditor.currentSeqIndex === idx);
			const isMapEditActive = (this.isEditingMap && this.editingObject === obj && (this.editingSequenceIndex === idx || this.editingSequenceIndex === undefined));
			const isEditing = isSeqEditorActive || isMapEditActive;
			const finalColor = isEditing ? 0xFFFFFF : color;

			// Draw Lines
			const points = [];
			points.push(obj.position.clone());

			seq.waypoints.forEach((wp: any) => {
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
			seq.waypoints.forEach((wp: any) => {
				if (wp.x === undefined || wp.y === undefined || wp.z === undefined) return;

				const pos = new THREE.Vector3(wp.x, wp.y, wp.z);
				const dotGeo = new THREE.SphereGeometry(0.2, 8, 8);
				const dotMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
				// ARROWS (DIRECTION) - RESTORED
				const arrowLen = 1.0;
				const arrowDir = new THREE.Vector3(0, 0, 1);
				if (wp.rotY !== undefined) {
					arrowDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), wp.rotY);
				}
				const arrow = new THREE.ArrowHelper(arrowDir, pos, arrowLen, 0x00FF00);
				this.pathVisualizer.add(arrow);

				const dot = new THREE.Mesh(dotGeo, dotMat);
				dot.position.copy(pos);
				this.pathVisualizer.add(dot);

				if (isEditing) {
					const ghostSize = new THREE.Vector3(1, 1, 1);
					if (obj.userData.originalScale) {
						ghostSize.copy(obj.userData.originalScale);
					} else {
						const b = new THREE.Box3().setFromObject(obj);
						b.getSize(ghostSize);
					}

					const ghostGeo = new THREE.BoxGeometry(ghostSize.x, ghostSize.y, ghostSize.z);
					const ghostMat = new THREE.MeshBasicMaterial({ color: 0x0000FF, wireframe: true, transparent: true, opacity: 0.3 });
					const ghost = new THREE.Mesh(ghostGeo, ghostMat);
					ghost.position.copy(pos);
					if (wp.rotY !== undefined) ghost.rotation.y = wp.rotY;
					this.pathVisualizer.add(ghost);
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
				object.userData.logicProperties[key] = parseFloat(e.target.value);
			};
		} else if (type === "boolean") {
			input.type = "checkbox";
			input.checked = val;
			input.style.width = "auto";
			input.onchange = (e: any) => {
				object.userData.logicProperties[key] = e.target.checked;
			};
		} else {
			input.type = "text";
			input.value = val;
			input.onchange = (e: any) => {
				object.userData.logicProperties[key] = e.target.value;
			};
		}

		row.appendChild(label);
		row.appendChild(input);
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
			default: return type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Objeto";
		}
	}
}

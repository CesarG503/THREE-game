import type {
	ExperienceModeProfile,
	DeathScreenConfig,
	DeathScreenElement,
	DeathScreenElementType,
	DeathScreenAnchor,
	DeathCause,
	DeathActionButtonType,
	DeathState,
	DeathScreenBackgroundConfig,
	DeathScreenBackgroundType,
	DeathScreenBgAnimationType,
	DeathScreenAnimationPreset,
} from "../types/experienceMode.types";
import {
	createDefaultDeathScreenElements,
	normalizeDeathScreenElements,
	normalizeDeathScreenBackground,
	evaluateDynamicTokens,
	sanitizeImageUrl,
} from "../types/experienceMode.types";
import { parseToRgba } from "./DeathScreen";
import { DeathAnimationService } from "../managers/DeathAnimationService";

export interface DeathScreenEditorOptions {
	mode: ExperienceModeProfile;
	onSync: () => void;
	onPreviewFullscreen?: (previewState: "respawn" | "last_life" | "game_over" | "spectator") => void;
}

export class DeathScreenEditor {
	private mode: ExperienceModeProfile;
	private onSync: () => void;
	private onPreviewFullscreen?: (previewState: "respawn" | "last_life" | "game_over" | "spectator") => void;

	private container: HTMLElement | null = null;
	private canvasWrapper: HTMLElement | null = null;
	private canvasEl: HTMLElement | null = null;
	private canvasBgLayer: HTMLElement | null = null;
	private propertiesPanelEl: HTMLElement | null = null;
	private layersListEl: HTMLElement | null = null;

	private selectedElementId: string | null = null;
	private previewState: "respawn" | "last_life" | "game_over" | "spectator" = "respawn";
	private previewCause: DeathCause = "damage";
	private previewDevice: "desktop" | "tablet" | "mobile" = "desktop";

	// Undo / Redo history stacks
	private undoStack: string[] = [];
	private redoStack: string[] = [];
	private maxHistory = 30;

	// Dragging & Resizing state
	private isDragging = false;
	private isResizing = false;
	private resizeHandle: string | null = null;
	private animationService = new DeathAnimationService();
	private dragStartX = 0;
	private dragStartY = 0;
	private elementStartPos = { x: 0, y: 0, width: 0, height: 0 };

	constructor(options: DeathScreenEditorOptions) {
		this.mode = options.mode;
		this.onSync = options.onSync;
		this.onPreviewFullscreen = options.onPreviewFullscreen;

		this.ensureConfig();
	}

	public setMode(mode: ExperienceModeProfile) {
		this.mode = mode;
		this.selectedElementId = null;
		this.undoStack = [];
		this.redoStack = [];
		this.ensureConfig();
		if (this.container) {
			this.render(this.container);
		}
	}

	private get screen(): DeathScreenConfig {
		return this.mode.deathScreen;
	}

	private ensureConfig() {
		if (!this.screen) {
			this.mode.deathScreen = {
				version: 2,
				enabled: true,
				title: "HAS MUERTO",
				message: "Volviendo al punto de inicio...",
				backgroundColor: "rgba(13, 15, 23, 0.92)",
				accentColor: "#ff3b47",
				background: normalizeDeathScreenBackground(undefined, "rgba(13, 15, 23, 0.92)"),
				screenBlur: 12,
				buttons: [{ id: "btn_respawn", label: "Reaparecer", action: "respawn", isPrimary: true }],
				elements: createDefaultDeathScreenElements("classic", "#ff3b47", "rgba(13, 15, 23, 0.92)"),
			};
		} else if (!Array.isArray(this.screen.elements) || (this.screen.version !== 2 && this.screen.elements.length === 0)) {
			this.screen.elements = createDefaultDeathScreenElements(
				this.mode.id === "mode_racing" ? "racing" : (this.mode.id === "mode_elimination" ? "tactical" : "classic"),
				this.screen.accentColor,
				this.screen.backgroundColor,
				this.screen.title,
				this.screen.message
			);
		}
		if (this.screen && !this.screen.background) {
			this.screen.background = normalizeDeathScreenBackground(
				undefined,
				this.screen.backgroundColor,
				this.screen.backgroundImage
			);
		}
	}

	private recordHistory() {
		const snapshot = JSON.stringify(this.screen);
		if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
			return;
		}
		this.undoStack.push(snapshot);
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	}

	public undo() {
		if (this.undoStack.length === 0) return;
		const current = JSON.stringify(this.screen);
		this.redoStack.push(current);
		const previous = this.undoStack.pop()!;
		this.mode.deathScreen = JSON.parse(previous);
		this.onSync();
		this.updateAll();
	}

	public redo() {
		if (this.redoStack.length === 0) return;
		const current = JSON.stringify(this.screen);
		this.undoStack.push(current);
		const next = this.redoStack.pop()!;
		this.mode.deathScreen = JSON.parse(next);
		this.onSync();
		this.updateAll();
	}

	public render(container: HTMLElement) {
		this.container = container;
		container.innerHTML = "";

		const root = document.createElement("div");
		root.className = "death-screen-editor-root";
		root.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 10px;
			background: #14161d;
			border: 1px solid #282c38;
			border-radius: 8px;
			padding: 12px;
			color: #eee;
			font-family: inherit;
			font-size: 13px;
			box-sizing: border-box;
		`;

		// 1. Top Toolbar (Templates, Undo/Redo, States, Device, Fullscreen Preview)
		root.appendChild(this.createToolbar());

		// 2. Main Work Area: Layers Left | Canvas Center | Properties Right
		const workArea = document.createElement("div");
		workArea.className = "death-screen-editor-work-area";
		workArea.style.cssText = `
			gap: 12px;
			align-items: stretch;
		`;

		// Left Panel: Elements Library and Layer List
		const leftPanel = this.createLayersPanel();
		leftPanel.classList.add("death-screen-editor-layers");
		workArea.appendChild(leftPanel);

		// Center Panel: Interactive Canvas Viewport
		const centerPanel = this.createCanvasPanel();
		centerPanel.classList.add("death-screen-editor-canvas-panel");
		workArea.appendChild(centerPanel);

		// Right Panel: Inspector Properties
		const rightPanel = this.createPropertiesPanel();
		rightPanel.classList.add("death-screen-editor-properties");
		workArea.appendChild(rightPanel);

		root.appendChild(workArea);
		container.appendChild(root);
		this.ensureResponsiveStyles();

		// Global key listeners for canvas editing (nudge, delete, undo)
		root.tabIndex = 0;
		root.onkeydown = (e) => this.handleRootKeyDown(e);

		this.updateCanvas();
	}

	private ensureResponsiveStyles() {
		const styleId = "viper-death-screen-editor-responsive-styles";
		if (document.getElementById(styleId)) return;
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			.death-screen-editor-root { width: 100%; max-width: 100%; min-width: 0; container-type: inline-size; }
			.death-screen-editor-work-area { display: grid; grid-template-columns: minmax(170px, 240px) minmax(0, 1fr) minmax(220px, 310px); gap: 12px; min-height: 520px; align-items: stretch; min-width: 0; }
			.death-screen-editor-work-area > * { min-width: 0; }
			.death-screen-editor-canvas-panel { min-width: 0; }
			.death-screen-editor-canvas-panel #viper-death-editor-canvas { width: 100%; max-width: 100% !important; }
			@container (max-width: 1050px) {
				.death-screen-editor-work-area { grid-template-columns: minmax(170px, 0.75fr) minmax(0, 1.25fr); }
				.death-screen-editor-properties { grid-column: 1 / -1; max-height: 360px; }
			}
			@container (max-width: 650px) {
				.death-screen-editor-root { padding: 8px !important; }
				.death-screen-editor-work-area { grid-template-columns: minmax(0, 1fr); min-height: 0; gap: 8px; }
				.death-screen-editor-canvas-panel { grid-row: 1; padding: 8px !important; }
				.death-screen-editor-layers { grid-row: 2; max-height: 280px; }
				.death-screen-editor-properties { grid-row: 3; grid-column: 1; max-height: 420px; }
			}
		`;
		document.head.appendChild(style);
	}

	private createToolbar(): HTMLElement {
		const toolbar = document.createElement("div");
		toolbar.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			padding: 8px 12px;
			background: #1b1e28;
			border: 1px solid #2b3040;
			border-radius: 6px;
		`;

		const leftGroup = document.createElement("div");
		leftGroup.style.cssText = "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;";

		// Template selector
		const tplLabel = document.createElement("strong");
		tplLabel.textContent = "Plantilla:";
		tplLabel.style.color = "#aaa";

		const tplSelect = document.createElement("select");
		tplSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;";
		[
			{ v: "classic", t: "Clásica (Card Central)" },
			{ v: "tactical", t: "Táctica (Alerta & Asesino)" },
			{ v: "racing", t: "Carreras (Fuera de Pista)" },
			{ v: "minimal", t: "Minimalista (Tipografía limpia)" },
			{ v: "arcade", t: "Arcade (Neón y dinamismo)" },
			{ v: "cinematic", t: "Cinemática (Elegante y panorámica)" },
			{ v: "speed", t: "Velocidad (Impacto lateral)" },
		].forEach((tpl) => {
			const opt = document.createElement("option");
			opt.value = tpl.v;
			opt.textContent = tpl.t;
			tplSelect.appendChild(opt);
		});
		tplSelect.onchange = () => {
			if (confirm("¿Aplicar plantilla? Se reemplazarán los elementos actuales.")) {
				this.recordHistory();
				this.screen.elements = createDefaultDeathScreenElements(
					tplSelect.value as any,
					this.screen.accentColor,
					this.screen.backgroundColor,
					this.screen.title,
					this.screen.message
				);
				this.onSync();
				this.updateAll();
			}
		};

		// Reset template button
		const resetBtn = document.createElement("button");
		resetBtn.type = "button";
		resetBtn.textContent = "↺ Restaurar";
		resetBtn.title = "Restaurar elementos por defecto del modo";
		resetBtn.style.cssText = "background: #333; color: #ddd; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;";
		resetBtn.onclick = () => {
			if (confirm("¿Restaurar plantilla inicial del modo?")) {
				this.recordHistory();
				const defTpl = this.mode.id === "mode_racing" ? "racing" : (this.mode.id === "mode_elimination" ? "tactical" : "classic");
				this.screen.elements = createDefaultDeathScreenElements(defTpl, this.screen.accentColor, this.screen.backgroundColor);
				this.onSync();
				this.updateAll();
			}
		};

		// Undo / Redo buttons
		const undoBtn = document.createElement("button");
		undoBtn.type = "button";
		undoBtn.textContent = "↶ Deshacer";
		undoBtn.title = "Deshacer cambio (Ctrl+Z)";
		undoBtn.style.cssText = "background: #222; color: #ccc; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;";
		undoBtn.onclick = () => this.undo();

		const redoBtn = document.createElement("button");
		redoBtn.type = "button";
		redoBtn.textContent = "↷ Rehacer";
		redoBtn.title = "Rehacer cambio (Ctrl+Y)";
		redoBtn.style.cssText = "background: #222; color: #ccc; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;";
		redoBtn.onclick = () => this.redo();

		leftGroup.append(tplLabel, tplSelect, resetBtn, undoBtn, redoBtn);

		// Right Group: State Simulation, Device, Fullscreen
		const rightGroup = document.createElement("div");
		rightGroup.style.cssText = "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;";

		// State simulator
		const stateLabel = document.createElement("strong");
		stateLabel.textContent = "Simular Estado:";
		stateLabel.style.color = "#aaa";

		const stateSelect = document.createElement("select");
		stateSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;";
		[
			{ v: "respawn", t: "Reaparición normal" },
			{ v: "last_life", t: "Última vida (1 vida)" },
			{ v: "game_over", t: "Fin de partida (0 vidas)" },
			{ v: "spectator", t: "Transición observador" },
		].forEach((st) => {
			const opt = document.createElement("option");
			opt.value = st.v;
			opt.textContent = st.t;
			if (this.previewState === st.v) opt.selected = true;
			stateSelect.appendChild(opt);
		});
		stateSelect.onchange = () => {
			this.previewState = stateSelect.value as any;
			this.updateCanvas();
		};

		// Cause simulator
		const causeSelect = document.createElement("select");
		causeSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;";
		[
			{ v: "damage", t: "Causa: Daño (Con Asesino)" },
			{ v: "fall", t: "Causa: Caída al vacío" },
			{ v: "logic", t: "Causa: Trampa / Lógica" },
			{ v: "vehicle", t: "Causa: Vehículo" },
		].forEach((cs) => {
			const opt = document.createElement("option");
			opt.value = cs.v;
			opt.textContent = cs.t;
			if (this.previewCause === cs.v) opt.selected = true;
			causeSelect.appendChild(opt);
		});
		causeSelect.onchange = () => {
			this.previewCause = causeSelect.value as DeathCause;
			this.updateCanvas();
		};

		// Device view toggle
		const deviceSelect = document.createElement("select");
		deviceSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;";
		[
			{ v: "desktop", t: "🖥 Desktop (16:9)" },
			{ v: "tablet", t: "📱 Tablet (4:3)" },
			{ v: "mobile", t: "📱 Móvil (9:16)" },
		].forEach((dev) => {
			const opt = document.createElement("option");
			opt.value = dev.v;
			opt.textContent = dev.t;
			if (this.previewDevice === dev.v) opt.selected = true;
			deviceSelect.appendChild(opt);
		});
		deviceSelect.onchange = () => {
			this.previewDevice = deviceSelect.value as any;
			this.applyDeviceRatio();
		};

		// Fullscreen button
		const previewBtn = document.createElement("button");
		previewBtn.type = "button";
		previewBtn.textContent = "▶ Pantalla Completa";
		previewBtn.style.cssText = "background: #e63946; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;";
		previewBtn.onclick = () => {
			if (this.onPreviewFullscreen) {
				this.onPreviewFullscreen(this.previewState);
			}
		};

		rightGroup.append(stateLabel, stateSelect, causeSelect, deviceSelect, previewBtn);
		toolbar.append(leftGroup, rightGroup);
		return toolbar;
	}

	private createLayersPanel(): HTMLElement {
		const panel = document.createElement("div");
		panel.style.cssText = `
			background: #1a1c24;
			border: 1px solid #2c303d;
			border-radius: 6px;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;

		const header = document.createElement("div");
		header.style.cssText = "padding: 10px; background: #222530; border-bottom: 1px solid #2c303d; display: flex; justify-content: space-between; align-items: center;";
		const title = document.createElement("strong");
		title.textContent = "Capas y Componentes";
		title.style.color = "#00d2ff";

		// Add Component dropdown button
		const addBtn = document.createElement("button");
		addBtn.type = "button";
		addBtn.textContent = "+ Añadir";
		addBtn.style.cssText = "background: #2a9d8f; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;";
		addBtn.onclick = () => this.showAddComponentMenu(addBtn);

		header.append(title, addBtn);
		panel.appendChild(header);

		this.layersListEl = document.createElement("div");
		this.layersListEl.style.cssText = "flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;";
		panel.appendChild(this.layersListEl);

		this.updateLayersList();
		return panel;
	}

	private showAddComponentMenu(targetBtn: HTMLElement) {
		const menu = document.createElement("div");
		menu.style.cssText = `
			position: fixed;
			z-index: 10005;
			background: #1e222e;
			border: 1px solid #3b4154;
			border-radius: 6px;
			box-shadow: 0 8px 24px rgba(0,0,0,0.6);
			padding: 4px;
			display: flex;
			flex-direction: column;
			min-width: 180px;
		`;

		const rect = targetBtn.getBoundingClientRect();
		menu.style.left = `${rect.left}px`;
		menu.style.top = `${rect.bottom + 4}px`;

		const types: Array<{ type: DeathScreenElementType; label: string; icon: string }> = [
			{ type: "title", label: "Título Principal", icon: "🏷" },
			{ type: "subtitle", label: "Subtítulo / Mensaje", icon: "📝" },
			{ type: "panel", label: "Tarjeta / Contenedor", icon: "🔲" },
			{ type: "divider", label: "Línea Separadora", icon: "➖" },
			{ type: "image", label: "Imagen / Avatar", icon: "🖼" },
			{ type: "respawn_countdown", label: "Contador Reaparición", icon: "⏱" },
			{ type: "remaining_lives", label: "Vidas Restantes", icon: "❤️" },
			{ type: "killer_info", label: "Información de Asesino", icon: "⚔️" },
			{ type: "stats", label: "Estadísticas / Causa", icon: "📊" },
			{ type: "action_button", label: "Botón de Acción", icon: "🔘" },
		];

		types.forEach((item) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.innerHTML = `<span style="margin-right:6px;">${item.icon}</span> ${item.label}`;
			btn.style.cssText = "background: none; border: none; color: #eee; text-align: left; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-size: 12px;";
			btn.onmouseenter = () => (btn.style.background = "#2f364a");
			btn.onmouseleave = () => (btn.style.background = "none");
			btn.onclick = () => {
				this.addElement(item.type, item.label);
				menu.remove();
			};
			menu.appendChild(btn);
		});

		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				window.removeEventListener("mousedown", closeHandler);
			}
		};
		setTimeout(() => window.addEventListener("mousedown", closeHandler), 10);
		document.body.appendChild(menu);
	}

	public addElement(type: DeathScreenElementType, name?: string): DeathScreenElement {
		this.recordHistory();
		const idx = (this.screen.elements?.length || 0) + 1;
		const id = `elem_${Date.now()}_${idx}`;
		const elemName = name || `Elemento ${idx}`;

		const baseElem: DeathScreenElement = {
			id,
			name: elemName,
			type,
			visible: true,
			x: 50,
			y: 50,
			width: type === "panel" ? 60 : (type === "title" ? 50 : 35),
			height: type === "panel" ? 50 : (type === "divider" ? 1 : 8),
			anchor: "center",
			zIndex: idx,
			style: {
				color: "#ffffff",
				fontSize: type === "title" ? 28 : (type === "subtitle" ? 14 : 13),
				fontWeight: type === "title" ? "bold" : "normal",
				textAlign: "center",
			},
		};

		if (type === "title") {
			baseElem.content = "HAS MUERTO";
			baseElem.style!.textTransform = "uppercase";
		} else if (type === "subtitle") {
			baseElem.content = "Has sido eliminado de la partida.";
		} else if (type === "panel") {
			baseElem.style!.backgroundColor = "rgba(13, 15, 23, 0.92)";
			baseElem.style!.borderRadius = 12;
			baseElem.style!.borderColor = "rgba(255, 255, 255, 0.15)";
			baseElem.style!.borderWidth = 1;
			baseElem.style!.borderStyle = "solid";
			baseElem.style!.backdropBlur = 12;
		} else if (type === "divider") {
			baseElem.style!.backgroundColor = "rgba(255, 255, 255, 0.3)";
		} else if (type === "respawn_countdown") {
			baseElem.content = "Reapareciendo en {countdown} s…";
			baseElem.fallbackContent = "Reaparición disponible";
			baseElem.style!.color = this.screen.accentColor || "#ff3b47";
			baseElem.style!.fontWeight = "bold";
		} else if (type === "remaining_lives") {
			baseElem.content = "Vidas restantes: {remaining_lives}";
			baseElem.fallbackContent = "Vidas: Infinitas";
		} else if (type === "killer_info") {
			baseElem.content = "Eliminado por: {killer_name}  ·  Arma: {killer_weapon}";
			baseElem.fallbackContent = "Eliminado por el entorno";
			baseElem.conditions = { requireData: ["killer"] };
		} else if (type === "stats") {
			baseElem.content = "Causa: {cause}";
		} else if (type === "action_button") {
			baseElem.content = "Reaparecer";
			baseElem.action = "respawn";
			baseElem.isPrimary = true;
			baseElem.style!.backgroundColor = this.screen.accentColor || "#ff3b47";
			baseElem.style!.borderRadius = 8;
			baseElem.style!.fontWeight = "bold";
		}

		this.screen.elements = this.screen.elements || [];
		this.screen.elements.push(baseElem);
		this.selectedElementId = id;
		this.onSync();
		this.updateAll();
		return baseElem;
	}

	public duplicateElement(elemId: string) {
		const source = this.screen.elements?.find((e) => e.id === elemId);
		if (!source) return;
		this.recordHistory();
		const clone: DeathScreenElement = JSON.parse(JSON.stringify(source));
		clone.id = `elem_${Date.now()}`;
		clone.name = `${source.name} (Copia)`;
		clone.x = Math.min(95, clone.x + 3);
		clone.y = Math.min(95, clone.y + 3);
		clone.zIndex = (this.screen.elements?.length || 0) + 1;
		this.screen.elements!.push(clone);
		this.selectedElementId = clone.id;
		this.onSync();
		this.updateAll();
	}

	public removeElement(elemId: string) {
		if (!this.screen.elements) return;
		this.recordHistory();
		this.screen.elements = this.screen.elements.filter((e) => e.id !== elemId);
		if (this.selectedElementId === elemId) {
			this.selectedElementId = null;
		}
		this.onSync();
		this.updateAll();
	}

	public moveLayer(elemId: string, direction: -1 | 1) {
		const elems = this.screen.elements;
		if (!elems) return;
		const idx = elems.findIndex((e) => e.id === elemId);
		if (idx === -1) return;
		const targetIdx = idx + direction;
		if (targetIdx < 0 || targetIdx >= elems.length) return;

		this.recordHistory();
		const temp = elems[idx];
		elems[idx] = elems[targetIdx];
		elems[targetIdx] = temp;

		// Reassign zIndex monotonically
		elems.forEach((e, i) => (e.zIndex = i + 1));
		this.onSync();
		this.updateAll();
	}

	private updateLayersList() {
		if (!this.layersListEl) return;
		this.layersListEl.innerHTML = "";

		const elems = this.screen.elements || [];
		if (elems.length === 0) {
			const empty = document.createElement("div");
			empty.textContent = "No hay elementos aún. Haz clic en '+ Añadir' arriba.";
			empty.style.cssText = "color: #777; font-size: 11px; padding: 10px; text-align: center;";
			this.layersListEl.appendChild(empty);
			return;
		}

		// Show in reverse order (highest z-index on top)
		[...elems].reverse().forEach((elem) => {
			const row = document.createElement("div");
			const isSelected = elem.id === this.selectedElementId;
			row.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 6px;
				padding: 6px 8px;
				border-radius: 4px;
				background: ${isSelected ? "#2b3b5c" : "#20242e"};
				border: 1px solid ${isSelected ? "#00d2ff" : "#2f3545"};
				cursor: pointer;
				transition: background 0.15s ease;
			`;

			const info = document.createElement("div");
			info.style.cssText = "display: flex; align-items: center; gap: 6px; overflow: hidden;";
			const nameSpan = document.createElement("span");
			nameSpan.textContent = elem.name || elem.type;
			nameSpan.style.cssText = "font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;";

			const typeBadge = document.createElement("span");
			typeBadge.textContent = elem.type;
			typeBadge.style.cssText = "font-size: 9px; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.1); color: #aaa;";
			info.append(nameSpan, typeBadge);

			// Controls: visibility eye, move up/down, duplicate, delete
			const actions = document.createElement("div");
			actions.style.cssText = "display: flex; align-items: center; gap: 4px;";

			// Visibility toggle
			const eyeBtn = document.createElement("button");
			eyeBtn.type = "button";
			eyeBtn.textContent = elem.visible !== false ? "👁" : "🚫";
			eyeBtn.title = elem.visible !== false ? "Ocultar" : "Mostrar";
			eyeBtn.style.cssText = "background: none; border: none; cursor: pointer; font-size: 11px; padding: 2px;";
			eyeBtn.onclick = (e) => {
				e.stopPropagation();
				this.recordHistory();
				elem.visible = elem.visible === false;
				this.onSync();
				this.updateAll();
			};

			// Move layer up
			const upBtn = document.createElement("button");
			upBtn.type = "button";
			upBtn.textContent = "▲";
			upBtn.title = "Subir capa";
			upBtn.style.cssText = "background: none; border: none; color: #888; cursor: pointer; font-size: 9px; padding: 2px;";
			upBtn.onclick = (e) => {
				e.stopPropagation();
				this.moveLayer(elem.id, 1);
			};

			// Move layer down
			const downBtn = document.createElement("button");
			downBtn.type = "button";
			downBtn.textContent = "▼";
			downBtn.title = "Bajar capa";
			downBtn.style.cssText = "background: none; border: none; color: #888; cursor: pointer; font-size: 9px; padding: 2px;";
			downBtn.onclick = (e) => {
				e.stopPropagation();
				this.moveLayer(elem.id, -1);
			};

			// Duplicate
			const dupBtn = document.createElement("button");
			dupBtn.type = "button";
			dupBtn.textContent = "⧉";
			dupBtn.title = "Duplicar elemento";
			dupBtn.style.cssText = "background: none; border: none; color: #00d2ff; cursor: pointer; font-size: 11px; padding: 2px;";
			dupBtn.onclick = (e) => {
				e.stopPropagation();
				this.duplicateElement(elem.id);
			};

			// Delete
			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.textContent = "✕";
			delBtn.title = "Eliminar elemento";
			delBtn.style.cssText = "background: none; border: none; color: #e63946; cursor: pointer; font-size: 11px; padding: 2px;";
			delBtn.onclick = (e) => {
				e.stopPropagation();
				this.removeElement(elem.id);
			};

			actions.append(eyeBtn, upBtn, downBtn, dupBtn, delBtn);

			row.append(info, actions);
			row.onclick = () => {
				this.selectedElementId = elem.id;
				this.updateAll();
			};

			this.layersListEl!.appendChild(row);
		});
	}

	private createCanvasPanel(): HTMLElement {
		this.canvasWrapper = document.createElement("div");
		this.canvasWrapper.style.cssText = `
			background: #0f1015;
			border: 1px solid #252834;
			border-radius: 6px;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 16px;
			overflow: hidden;
			position: relative;
		`;

		this.canvasEl = document.createElement("div");
		this.canvasEl.id = "viper-death-editor-canvas";
		this.canvasEl.style.cssText = `
			position: relative;
			width: 100%;
			max-width: 680px;
			aspect-ratio: 16 / 9;
			border-radius: 8px;
			box-shadow: 0 16px 48px rgba(0,0,0,0.85);
			overflow: hidden;
			user-select: none;
			transition: aspect-ratio 0.2s ease, max-width 0.2s ease;
		`;

		this.applyDeviceRatio();
		this.canvasWrapper.appendChild(this.canvasEl);

		// Canvas click to deselect when clicking background
		this.canvasEl.onmousedown = (e) => {
			if (e.target === this.canvasEl) {
				this.selectedElementId = null;
				this.updateAll();
			}
		};

		return this.canvasWrapper;
	}

	private applyDeviceRatio() {
		if (!this.canvasEl) return;
		if (this.previewDevice === "desktop") {
			this.canvasEl.style.aspectRatio = "16 / 9";
			this.canvasEl.style.maxWidth = "680px";
		} else if (this.previewDevice === "tablet") {
			this.canvasEl.style.aspectRatio = "4 / 3";
			this.canvasEl.style.maxWidth = "540px";
		} else {
			this.canvasEl.style.aspectRatio = "9 / 16";
			this.canvasEl.style.maxWidth = "320px";
		}
	}

	private updateCanvas() {
		if (!this.canvasEl) return;
		this.canvasEl.innerHTML = "";

		// Dedicated Background Layer inside Canvas Preview
		this.canvasBgLayer = document.createElement("div");
		this.canvasBgLayer.className = "viper-death-canvas-bg-layer";
		this.canvasBgLayer.style.cssText = `
			position: absolute;
			inset: -5%;
			width: 110%;
			height: 110%;
			overflow: hidden;
			pointer-events: none;
			z-index: 0;
		`;
		this.canvasEl.appendChild(this.canvasBgLayer);

		const bg = normalizeDeathScreenBackground(this.screen.background, this.screen.backgroundColor, this.screen.backgroundImage);
		const rawBg = bg.color || this.screen.backgroundColor || "rgba(13, 15, 23, 0.94)";
		const overlayCenterBg = parseToRgba(rawBg, 0.88);
		const bgType = bg.type || (bg.imageUrl ? "image" : "gradient");

		if (bgType === "color") {
			this.canvasBgLayer.style.backgroundColor = bg.color || rawBg;
		} else if (bgType === "gradient") {
			if (bg.gradient) {
				this.canvasBgLayer.style.background = bg.gradient;
			} else {
				this.canvasBgLayer.style.background = `radial-gradient(ellipse at center, ${overlayCenterBg}, rgba(5, 7, 12, 0.97) 80%)`;
			}
		} else if (bgType === "image" || bgType === "animated") {
			this.canvasBgLayer.style.backgroundColor = bg.color || "#05070c";
			this.canvasBgLayer.style.background = bg.gradient || `radial-gradient(ellipse at center, ${overlayCenterBg}, rgba(5, 7, 12, 0.97) 80%)`;

			const imgUrl = bg.imageUrl;
			if (imgUrl) {
				const imgEl = document.createElement("div");
				imgEl.className = "viper-death-canvas-bg-image";
				imgEl.style.cssText = `
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					background-image: url("${imgUrl}");
					background-size: ${bg.imageFit || "cover"};
					background-position: ${bg.imagePosition || "center"};
					background-repeat: no-repeat;
					pointer-events: none;
				`;
				this.canvasBgLayer.appendChild(imgEl);
			}

			const overlayOpacity = bg.overlayOpacity ?? 0.7;
			if (overlayOpacity > 0) {
				const overlayEl = document.createElement("div");
				overlayEl.className = "viper-death-canvas-bg-overlay";
				overlayEl.style.cssText = `
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					background-color: ${bg.overlayColor || "rgba(0, 0, 0, 0.7)"};
					opacity: ${overlayOpacity};
					pointer-events: none;
				`;
				this.canvasBgLayer.appendChild(overlayEl);
			}

			if (bg.animation?.type === "scanlines") {
				const scanlinesEl = document.createElement("div");
				scanlinesEl.className = "viper-death-canvas-bg-scanlines";
				scanlinesEl.style.cssText = `
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px);
					pointer-events: none;
					opacity: 0.8;
				`;
				this.canvasBgLayer.appendChild(scanlinesEl);
			}
		}

		this.canvasEl.style.background = "transparent";

		// Build simulated death state
		const isRespawn = this.previewState === "respawn" || this.previewState === "last_life";
		const mockState: DeathState = {
			cause: this.previewCause,
			willRespawn: isRespawn,
			respawnDelay: isRespawn ? Math.max(1, this.mode.respawnDelay ?? 3) : 0,
			remainingRespawns: this.previewState === "last_life" ? 1 : (this.previewState === "game_over" ? 0 : (this.mode.respawns ?? 3)),
			activeMode: this.mode,
			context: {
				cause: this.previewCause,
				killerName: this.previewCause === "damage" ? "Fantasma_99" : undefined,
				killerWeapon: this.previewCause === "damage" ? "Rifle de Plasma" : undefined,
				details: this.previewCause === "fall" ? "Has caído al vacío." : (this.previewCause === "logic" ? "Activaste una trampa mortal." : "Combate directo"),
			},
		};

		const elems = this.screen.elements || [];
		elems.forEach((elem) => {
			if (elem.visible === false) return;

			// Condition evaluation against simulated state
			const cond = elem.conditions;
			if (cond) {
				if (cond.causes && cond.causes.length > 0 && !cond.causes.includes(this.previewCause)) {
					return;
				}
				if (cond.states && cond.states.length > 0 && !cond.states.includes(this.previewState)) {
					return;
				}
				if (cond.requireData && cond.requireData.length > 0) {
					if (cond.requireData.includes("killer") && !mockState.context?.killerName) {
						return;
					}
					if (cond.requireData.includes("countdown") && (!isRespawn || mockState.respawnDelay <= 0)) {
						return;
					}
				}
			}

			const isSelected = elem.id === this.selectedElementId;
			const override = elem.causeOverrides?.[this.previewCause];
			const contentTemplate = override?.content || elem.content || "";
			const elemColor = override?.color || elem.style?.color;
			const resolvedText = evaluateDynamicTokens(contentTemplate, mockState, elem.fallbackContent || "");

			const node = document.createElement("div");
			node.className = `viper-canvas-element ${isSelected ? "selected" : ""}`;
			node.dataset.elemId = elem.id;
			node.dataset.elementId = elem.id;

			node.style.position = "absolute";
			node.style.left = `${elem.x}%`;
			node.style.top = `${elem.y}%`;
			node.style.width = `${elem.width}%`;
			node.style.minHeight = `${elem.height}%`;
			node.style.boxSizing = "border-box";
			node.style.zIndex = String(elem.zIndex ?? 1);
			node.style.cursor = "move";

			// Anchor transform
			let transformStr = "translate(-50%, -50%)";
			switch (elem.anchor) {
				case "top-left": transformStr = "translate(0, 0)"; break;
				case "top-center": transformStr = "translate(-50%, 0)"; break;
				case "top-right": transformStr = "translate(-100%, 0)"; break;
				case "center-left": transformStr = "translate(0, -50%)"; break;
				case "center": transformStr = "translate(-50%, -50%)"; break;
				case "center-right": transformStr = "translate(-100%, -50%)"; break;
				case "bottom-left": transformStr = "translate(0, -100%)"; break;
				case "bottom-center": transformStr = "translate(-50%, -100%)"; break;
				case "bottom-right": transformStr = "translate(-100%, -100%)"; break;
			}
			node.style.transform = transformStr;

			// Styling
			const s = elem.style || {};
			if (s.fontSize) node.style.fontSize = `${Math.max(9, Math.round(s.fontSize * 0.85))}px`;
			if (s.fontWeight) node.style.fontWeight = s.fontWeight;
			if (s.fontFamily) node.style.fontFamily = s.fontFamily;
			if (elemColor) node.style.color = elemColor;
			if (s.textAlign) node.style.textAlign = s.textAlign;
			if (s.textTransform) node.style.textTransform = s.textTransform;
			if (s.letterSpacing) node.style.letterSpacing = s.letterSpacing;
			if (s.backgroundColor) node.style.backgroundColor = s.backgroundColor;
			if (s.borderColor) node.style.borderColor = s.borderColor;
			if (s.borderWidth) node.style.borderWidth = `${s.borderWidth}px`;
			if (s.borderStyle) node.style.borderStyle = s.borderStyle;
			if (s.borderRadius) node.style.borderRadius = `${s.borderRadius}px`;
			if (s.opacity !== undefined) node.style.opacity = String(s.opacity);
			if (s.backdropBlur) node.style.backdropFilter = `blur(${s.backdropBlur}px)`;
			if (s.padding) node.style.padding = `${s.padding}px`;
			if (s.boxShadow) node.style.boxShadow = s.boxShadow;
			if (s.textShadow) node.style.textShadow = s.textShadow;

			// Selection outline
			if (isSelected) {
				node.style.outline = "2px solid #00d2ff";
				node.style.outlineOffset = "2px";
			}

			// Content
			if (elem.type === "image") {
				const src = sanitizeImageUrl(elem.imageUrl);
				if (src) {
					const img = document.createElement("img");
					img.src = src;
					img.style.maxWidth = "100%";
					img.style.maxHeight = "100%";
					img.style.pointerEvents = "none";
					img.onerror = () => {
						img.style.display = "none";
						node.textContent = elem.fallbackContent || elem.content || "[🖼 Imagen no disponible]";
						node.style.color = "#888";
					};
					node.appendChild(img);
				} else {
					node.textContent = "[🖼 Imagen]";
					node.style.color = "#888";
				}
			} else {
				node.textContent = resolvedText;
			}

			// Drag event setup
			node.onmousedown = (e) => {
				e.stopPropagation();
				this.selectedElementId = elem.id;
				this.updateAll();
				this.startDragging(e, elem);
			};

			// Resize handles if selected
			if (isSelected) {
				this.attachResizeHandles(node, elem);
			}

			this.canvasEl.appendChild(node);
		});
	}

	private previewAnimationOnCanvas() {
		if (!this.canvasEl) return;
		this.updateCanvas();
		if (this.canvasBgLayer) {
			this.animationService.animateBackground(
				this.canvasBgLayer,
				this.screen.background,
				{ reducedMotion: this.screen.accessibility?.reduceMotion }
			);
		}
		this.animationService.animateScreenEntrance(
			this.canvasEl,
			this.screen.elements || [],
			this.screen.animations,
			{ reducedMotion: this.screen.accessibility?.reduceMotion }
		);
	}

	private startDragging(e: MouseEvent, elem: DeathScreenElement) {
		this.isDragging = true;
		this.dragStartX = e.clientX;
		this.dragStartY = e.clientY;
		this.elementStartPos = { x: elem.x, y: elem.y, width: elem.width, height: elem.height };
		const canvasRect = this.canvasEl?.getBoundingClientRect();
		const node = this.getCanvasElementNode(elem.id);

		this.recordHistory();

		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!this.isDragging || !this.canvasEl) return;
			if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

			const deltaX = ((moveEvent.clientX - this.dragStartX) / canvasRect.width) * 100;
			const deltaY = ((moveEvent.clientY - this.dragStartY) / canvasRect.height) * 100;

			elem.x = Math.max(0, Math.min(100, Math.round((this.elementStartPos.x + deltaX) * 10) / 10));
			elem.y = Math.max(0, Math.min(100, Math.round((this.elementStartPos.y + deltaY) * 10) / 10));

			this.updateElementGeometry(node, elem);
		};

		const onMouseUp = () => {
			this.isDragging = false;
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			this.updatePropertiesPanel();
			this.onSync();
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	}

	private attachResizeHandles(parentEl: HTMLElement, elem: DeathScreenElement) {
		const handles = ["nw", "ne", "se", "sw"];
		handles.forEach((h) => {
			const handle = document.createElement("div");
			handle.className = `resize-handle handle-${h}`;
			handle.style.cssText = `
				position: absolute;
				width: 8px;
				height: 8px;
				background: #00d2ff;
				border: 1px solid #ffffff;
				border-radius: 50%;
				z-index: 100;
			`;

			if (h === "nw") { handle.style.left = "-4px"; handle.style.top = "-4px"; handle.style.cursor = "nwse-resize"; }
			if (h === "ne") { handle.style.right = "-4px"; handle.style.top = "-4px"; handle.style.cursor = "nesw-resize"; }
			if (h === "se") { handle.style.right = "-4px"; handle.style.bottom = "-4px"; handle.style.cursor = "nwse-resize"; }
			if (h === "sw") { handle.style.left = "-4px"; handle.style.bottom = "-4px"; handle.style.cursor = "nesw-resize"; }

			handle.onmousedown = (e) => {
				e.stopPropagation();
				this.startResizing(e, elem, h);
			};

			parentEl.appendChild(handle);
		});
	}

	private getCanvasElementNode(elemId: string): HTMLElement | null {
		if (!this.canvasEl) return null;
		return Array.from(this.canvasEl.children).find((child) => (child as HTMLElement).dataset.elemId === elemId) as HTMLElement || null;
	}

	private updateElementGeometry(node: HTMLElement | null, elem: DeathScreenElement) {
		if (!node) return;
		node.style.left = `${elem.x}%`;
		node.style.top = `${elem.y}%`;
		node.style.width = `${elem.width}%`;
		node.style.minHeight = `${elem.height}%`;
	}

	private startResizing(e: MouseEvent, elem: DeathScreenElement, handle: string) {
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartX = e.clientX;
		this.dragStartY = e.clientY;
		this.elementStartPos = { x: elem.x, y: elem.y, width: elem.width, height: elem.height };
		const canvasRect = this.canvasEl?.getBoundingClientRect();
		const node = this.getCanvasElementNode(elem.id);

		this.recordHistory();

		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!this.isResizing || !this.canvasEl) return;
			if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

			const deltaX = ((moveEvent.clientX - this.dragStartX) / canvasRect.width) * 100;
			const deltaY = ((moveEvent.clientY - this.dragStartY) / canvasRect.height) * 100;

			let newWidth = this.elementStartPos.width;
			let newHeight = this.elementStartPos.height;

			if (handle === "se") {
				newWidth = Math.max(2, this.elementStartPos.width + deltaX * 2);
				newHeight = Math.max(2, this.elementStartPos.height + deltaY * 2);
			} else if (handle === "sw") {
				newWidth = Math.max(2, this.elementStartPos.width - deltaX * 2);
				newHeight = Math.max(2, this.elementStartPos.height + deltaY * 2);
			} else if (handle === "ne") {
				newWidth = Math.max(2, this.elementStartPos.width + deltaX * 2);
				newHeight = Math.max(2, this.elementStartPos.height - deltaY * 2);
			} else if (handle === "nw") {
				newWidth = Math.max(2, this.elementStartPos.width - deltaX * 2);
				newHeight = Math.max(2, this.elementStartPos.height - deltaY * 2);
			}

			elem.width = Math.min(100, Math.round(newWidth * 10) / 10);
			elem.height = Math.min(100, Math.round(newHeight * 10) / 10);

			this.updateElementGeometry(node, elem);
		};

		const onMouseUp = () => {
			this.isResizing = false;
			this.resizeHandle = null;
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			this.updatePropertiesPanel();
			this.onSync();
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	}

	private createPropertiesPanel(): HTMLElement {
		this.propertiesPanelEl = document.createElement("div");
		this.propertiesPanelEl.style.cssText = `
			background: #1a1c24;
			border: 1px solid #2c303d;
			border-radius: 6px;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;

		this.updatePropertiesPanel();
		return this.propertiesPanelEl;
	}

	private updatePropertiesPanel() {
		if (!this.propertiesPanelEl) return;
		this.propertiesPanelEl.innerHTML = "";

		const selected = this.screen.elements?.find((e) => e.id === this.selectedElementId);

		if (!selected) {
			this.renderGlobalScreenProperties();
			return;
		}

		this.renderElementProperties(selected);
	}

	private renderGlobalScreenProperties() {
		const header = document.createElement("div");
		header.style.cssText = "padding: 10px; background: #222530; border-bottom: 1px solid #2c303d; display: flex; justify-content: space-between;";
		header.innerHTML = "<strong style='color:#00d2ff;'>Ajustes Globales de Pantalla</strong>";
		this.propertiesPanelEl!.appendChild(header);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px;";

		// Accent color
		scroll.appendChild(this.createColorPicker("Color de Acento", this.screen.accentColor || "#ff3b47", (c) => {
			this.recordHistory();
			this.screen.accentColor = c;
			this.onSync();
			this.updateCanvas();
		}));

		// Screen blur
		scroll.appendChild(this.createNumberSlider("Desenfoque de Fondo (px)", this.screen.screenBlur ?? 12, 0, 30, (v) => {
			this.recordHistory();
			this.screen.screenBlur = v;
			if (this.screen.transitions) this.screen.transitions.blur = v;
			this.onSync();
			this.updateCanvas();
		}));

		// --- SECCIÓN: FONDO DE PANTALLA ---
		const bgBox = document.createElement("div");
		bgBox.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #20242f; border-radius: 6px; border: 1px solid #32384a;";
		bgBox.innerHTML = "<strong style='font-size:12px; color:#00d2ff;'>Fondo de Pantalla</strong>";

		const bg = (this.screen.background ||= normalizeDeathScreenBackground(
			undefined,
			this.screen.backgroundColor,
			this.screen.backgroundImage
		));

		// Background Type selector
		const bgTypeRow = document.createElement("div");
		bgTypeRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
		const bgTypeLabel = document.createElement("label");
		bgTypeLabel.textContent = "Tipo de Fondo";
		bgTypeLabel.style.cssText = "font-size: 11px; color: #aaa;";
		const bgTypeSelect = document.createElement("select");
		bgTypeSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 5px; border-radius: 4px; font-size: 12px;";
		[
			["gradient", "Degradado Atmosférico (Gradiente)"],
			["image", "Imagen Propia (Foto / Textura)"],
			["color", "Color Sólido Plano"],
			["animated", "Fondo Animado Dinámico"],
		].forEach(([v, t]) => {
			const opt = document.createElement("option");
			opt.value = v;
			opt.textContent = t;
			if ((bg.type || "gradient") === v) opt.selected = true;
			bgTypeSelect.appendChild(opt);
		});
		bgTypeSelect.onchange = () => {
			this.recordHistory();
			bg.type = bgTypeSelect.value as DeathScreenBackgroundType;
			if (bg.type === "animated") {
				bg.animation ||= {};
				bg.animation.enabled = true;
			}
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		};
		bgTypeRow.append(bgTypeLabel, bgTypeSelect);
		bgBox.appendChild(bgTypeRow);

		// Solid/Base Color
		bgBox.appendChild(this.createColorPicker("Color Base / Fondo", bg.color || this.screen.backgroundColor || "rgba(13, 15, 23, 0.94)", (c) => {
			this.recordHistory();
			bg.color = c;
			this.screen.backgroundColor = c;
			this.onSync();
			this.updateCanvas();
		}));

		// Gradient options (if gradient or animated)
		if (bg.type === "gradient" || bg.type === "animated") {
			const gradRow = document.createElement("div");
			gradRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
			const gradLabel = document.createElement("label");
			gradLabel.textContent = "Estilo de Degradado";
			gradLabel.style.cssText = "font-size: 11px; color: #aaa;";
			const gradSelect = document.createElement("select");
			gradSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
			[
				["radial", "Radial Suave Centrado"],
				["linear_dark", "Lineal Vertical Oscuro (Cine negro)"],
				["vignette", "Viñeta Intensa de Acento"],
				["custom", "Personalizado (CSS libre)"],
			].forEach(([v, t]) => {
				const opt = document.createElement("option");
				opt.value = v;
				opt.textContent = t;
				if (bg.gradient?.includes("linear-gradient(180deg") && v === "linear_dark") opt.selected = true;
				else if (bg.gradient?.includes("rgba(0,0,0,0.98)") && v === "vignette") opt.selected = true;
				else if (!bg.gradient && v === "radial") opt.selected = true;
				else if (bg.gradient && v === "custom") opt.selected = true;
				gradSelect.appendChild(opt);
			});
			gradSelect.onchange = () => {
				this.recordHistory();
				const v = gradSelect.value;
				if (v === "radial") {
					bg.gradient = undefined;
				} else if (v === "linear_dark") {
					bg.gradient = "linear-gradient(180deg, rgba(13, 15, 23, 0.85) 0%, rgba(5, 7, 12, 0.98) 100%)";
				} else if (v === "vignette") {
					bg.gradient = "radial-gradient(circle at center, rgba(20, 25, 38, 0.7) 0%, rgba(5, 7, 12, 0.98) 75%)";
				}
				this.onSync();
				this.updateCanvas();
				this.updatePropertiesPanel();
			};
			gradRow.append(gradLabel, gradSelect);
			bgBox.appendChild(gradRow);

			if (gradSelect.value === "custom" || (bg.gradient && !bg.gradient.startsWith("radial-gradient(ellipse"))) {
				bgBox.appendChild(this.createTextInput("CSS Degradado", bg.gradient || "", "linear-gradient(...)", (g) => {
					this.recordHistory();
					bg.gradient = g.trim() || undefined;
					this.onSync();
					this.updateCanvas();
				}));
			}
		}

		// Image options (if image or animated or url exists)
		if (bg.type === "image" || bg.type === "animated" || bg.imageUrl) {
			const imgInputWrap = this.createTextInput("URL de la Imagen de Fondo", bg.imageUrl || this.screen.backgroundImage || "", "assets/... o https://...", (url) => {
				this.recordHistory();
				const sanitized = sanitizeImageUrl(url);
				bg.imageUrl = sanitized;
				this.screen.backgroundImage = sanitized;
				this.onSync();
				this.updateCanvas();
			});

			// Asset presets chip bar
			const assetChips = document.createElement("div");
			assetChips.style.cssText = "display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;";
			const chipsTitle = document.createElement("span");
			chipsTitle.textContent = "Activos rápidos:";
			chipsTitle.style.cssText = "font-size: 10px; color: #888; align-self: center;";
			assetChips.appendChild(chipsTitle);

			[
				["assets/8e08d.jpg", "8e08d.jpg"],
				["assets/8e08d875-3fd2-42a0-8868-d7a1a655014a.jpg", "Fondo Viper"],
			].forEach(([assetUrl, label]) => {
				const chipBtn = document.createElement("button");
				chipBtn.type = "button";
				chipBtn.textContent = label;
				chipBtn.style.cssText = "background: #282f42; color: #00d2ff; border: 1px solid #3d4766; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer;";
				chipBtn.onclick = () => {
					this.recordHistory();
					bg.imageUrl = assetUrl;
					this.screen.backgroundImage = assetUrl;
					this.onSync();
					this.updateCanvas();
					this.updatePropertiesPanel();
				};
				assetChips.appendChild(chipBtn);
			});
			imgInputWrap.appendChild(assetChips);
			bgBox.appendChild(imgInputWrap);

			// Fit & Position Grid
			const fitPosGrid = document.createElement("div");
			fitPosGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px;";

			const fitRow = document.createElement("div");
			fitRow.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
			const fitLabel = document.createElement("label"); fitLabel.textContent = "Ajuste (Fit)"; fitLabel.style.cssText = "font-size: 10px; color: #aaa;";
			const fitSelect = document.createElement("select");
			fitSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; font-size: 11px;";
			[["cover", "Cover (Cubrir)"], ["contain", "Contain (Contener)"], ["fill", "Fill (Estirar)"]].forEach(([v, t]) => {
				const opt = document.createElement("option"); opt.value = v; opt.textContent = t;
				if ((bg.imageFit || "cover") === v) opt.selected = true;
				fitSelect.appendChild(opt);
			});
			fitSelect.onchange = () => {
				this.recordHistory();
				bg.imageFit = fitSelect.value as any;
				this.onSync();
				this.updateCanvas();
			};
			fitRow.append(fitLabel, fitSelect);

			const posRow = document.createElement("div");
			posRow.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
			const posLabel = document.createElement("label"); posLabel.textContent = "Posición"; posLabel.style.cssText = "font-size: 10px; color: #aaa;";
			const posSelect = document.createElement("select");
			posSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; font-size: 11px;";
			[["center", "Centro"], ["top center", "Superior"], ["bottom center", "Inferior"]].forEach(([v, t]) => {
				const opt = document.createElement("option"); opt.value = v; opt.textContent = t;
				if ((bg.imagePosition || "center") === v) opt.selected = true;
				posSelect.appendChild(opt);
			});
			posSelect.onchange = () => {
				this.recordHistory();
				bg.imagePosition = posSelect.value;
				this.onSync();
				this.updateCanvas();
			};
			posRow.append(posLabel, posSelect);

			fitPosGrid.append(fitRow, posRow);
			bgBox.appendChild(fitPosGrid);

			// Overlay / Readability Layer
			bgBox.appendChild(this.createColorPicker("Capa de Legibilidad (Overlay)", bg.overlayColor || "rgba(0, 0, 0, 0.7)", (c) => {
				this.recordHistory();
				bg.overlayColor = c;
				this.onSync();
				this.updateCanvas();
			}));

			bgBox.appendChild(this.createNumberSlider("Opacidad de la Capa (%)", Math.round((bg.overlayOpacity ?? 0.7) * 100), 0, 100, (v) => {
				this.recordHistory();
				bg.overlayOpacity = v / 100;
				this.onSync();
				this.updateCanvas();
			}, 5));
		}

		// Background Animation Controls
		const bgAnimBox = document.createElement("div");
		bgAnimBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; padding: 8px; background: #161822; border-radius: 4px; border: 1px solid #282d3d;";
		bgAnimBox.innerHTML = "<strong style='font-size:11px; color:#ffd166;'>Animación de Fondo (Independiente)</strong>";

		bg.animation ||= {};
		bgAnimBox.appendChild(this.createCheckbox("Activar animación de fondo", Boolean(bg.animation.enabled || bg.type === "animated"), (checked) => {
			this.recordHistory();
			bg.animation ||= {};
			bg.animation.enabled = checked;
			if (checked && (!bg.animation.type || bg.animation.type === "none")) {
				bg.animation.type = "ken_burns";
			}
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		}));

		if (bg.animation?.enabled || bg.type === "animated") {
			const bAnimRow = document.createElement("div");
			bAnimRow.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
			const bAnimLabel = document.createElement("label"); bAnimLabel.textContent = "Efecto de Fondo"; bAnimLabel.style.cssText = "font-size: 10px; color: #aaa;";
			const bAnimSelect = document.createElement("select");
			bAnimSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; font-size: 11px;";
			[
				["ken_burns", "Ken Burns (Zoom cinematográfico)"],
				["pulse_glow", "Pulso de Brillo y Contraste"],
				["pan", "Barrido Panorámico Horizontal"],
				["scanlines", "Scanlines y Retícula Táctica"],
				["none", "Estático (Sin animación)"],
			].forEach(([v, t]) => {
				const opt = document.createElement("option"); opt.value = v; opt.textContent = t;
				if ((bg.animation?.type || "ken_burns") === v) opt.selected = true;
				bAnimSelect.appendChild(opt);
			});
			bAnimSelect.onchange = () => {
				this.recordHistory();
				bg.animation ||= {};
				bg.animation.type = bAnimSelect.value as DeathScreenBgAnimationType;
				this.onSync();
				this.updateCanvas();
			};
			bAnimRow.append(bAnimLabel, bAnimSelect);
			bgAnimBox.appendChild(bAnimRow);

			bgAnimBox.appendChild(this.createNumberSlider("Duración Ciclo (s)", Math.round((bg.animation.duration ?? 8000) / 1000), 1, 20, (v) => {
				this.recordHistory();
				bg.animation ||= {};
				bg.animation.duration = v * 1000;
				this.onSync();
			}, 1));
		}

		bgBox.appendChild(bgAnimBox);
		scroll.appendChild(bgBox);

		// Transition duration
		const trans = this.screen.transitions || {};
		scroll.appendChild(this.createNumberSlider("Duración Transición Pantalla (s)", trans.duration ?? 0.25, 0, 2, (v) => {
			this.recordHistory();
			this.screen.transitions ||= {};
			this.screen.transitions.duration = v;
			this.onSync();
		}, 0.05));

		// Slow motion and accessibility
		const effectsBox = document.createElement("div");
		effectsBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; padding: 8px; background: #20242f; border-radius: 4px;";
		effectsBox.appendChild(this.createCheckbox("Fundido de entrada (Fade In)", trans.fadeIn !== false, (checked) => {
			this.recordHistory();
			this.screen.transitions ||= {};
			this.screen.transitions.fadeIn = checked;
			this.onSync();
		}));
		effectsBox.appendChild(this.createCheckbox("Cámara lenta breve (Slow Motion)", Boolean(trans.slowMotion), (checked) => {
			this.recordHistory();
			this.screen.transitions ||= {};
			this.screen.transitions.slowMotion = checked;
			this.onSync();
		}));
		effectsBox.appendChild(this.createCheckbox("Respetar movimiento reducido", Boolean(this.screen.accessibility?.reduceMotion), (checked) => {
			this.recordHistory();
			this.screen.accessibility ||= {};
			this.screen.accessibility.reduceMotion = checked;
			this.onSync();
		}));
		scroll.appendChild(effectsBox);

		// Animation Configuration Box (Anime.js v4)
		const animBox = document.createElement("div");
		animBox.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #20242f; border-radius: 6px; border: 1px solid #32384a;";
		animBox.innerHTML = "<strong style='font-size:12px; color:#00d2ff;'>Animaciones de Elementos (Anime.js)</strong>";

		const animConfig = (this.screen.animations ||= { enabled: true, preset: "subtle", stagger: 40, duration: 400, easing: "easeOutCubic", exitAnimation: "fade" });

		animBox.appendChild(this.createCheckbox("Habilitar animaciones dinámicas", animConfig.enabled !== false, (checked) => {
			this.recordHistory();
			this.screen.animations ||= {};
			this.screen.animations.enabled = checked;
			this.onSync();
		}));

		// Expanded Preset Selector
		const presetRow = document.createElement("div");
		presetRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
		const pLabel = document.createElement("label");
		pLabel.textContent = "Preset de Animación de Elementos";
		pLabel.style.cssText = "font-size: 11px; color: #aaa;";
		const pSelect = document.createElement("select");
		pSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 5px; border-radius: 4px; font-size: 12px;";
		[
			["subtle", "Sutil (Deslizamiento suave y fluido)"],
			["dramatic", "Dramático (Escala, impacto y anticipación)"],
			["arcade", "Arcade (Rebote elástico y energía)"],
			["cinematic", "Cinemático (Desenfoque progresivo y elegancia)"],
			["tactical", "Táctico (HUD militar y entrada rápida)"],
			["speed", "Velocidad (Deslizamiento lateral veloz)"],
			["minimalist", "Minimalista (Fundido limpio)"],
			["none", "Sin animación (Instantáneo)"],
		].forEach(([v, t]) => {
			const opt = document.createElement("option");
			opt.value = v;
			opt.textContent = t;
			if ((animConfig.preset || "subtle") === v) opt.selected = true;
			pSelect.appendChild(opt);
		});
		pSelect.onchange = () => {
			this.recordHistory();
			this.screen.animations ||= {};
			this.screen.animations.preset = pSelect.value as any;
			this.onSync();
		};
		presetRow.append(pLabel, pSelect);
		animBox.appendChild(presetRow);

		// Stagger slider
		animBox.appendChild(this.createNumberSlider("Escalonamiento / Stagger (ms)", animConfig.stagger ?? 40, 0, 200, (v) => {
			this.recordHistory();
			this.screen.animations ||= {};
			this.screen.animations.stagger = v;
			this.onSync();
		}, 10));

		// Duration slider
		animBox.appendChild(this.createNumberSlider("Duración (ms)", animConfig.duration ?? 400, 100, 1500, (v) => {
			this.recordHistory();
			this.screen.animations ||= {};
			this.screen.animations.duration = v;
			this.onSync();
		}, 50));

		// Exit animation selector
		const exitRow = document.createElement("div");
		exitRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
		const eLabel = document.createElement("label");
		eLabel.textContent = "Animación de Salida / Reaparición";
		eLabel.style.cssText = "font-size: 11px; color: #aaa;";
		const eSelect = document.createElement("select");
		eSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
		[
			["fade", "Fundido de salida (Fade out)"],
			["scale_down", "Encogimiento suave (Scale down)"],
			["slide_down", "Deslizamiento hacia abajo"],
			["none", "Cierre instantáneo"],
		].forEach(([v, t]) => {
			const opt = document.createElement("option");
			opt.value = v;
			opt.textContent = t;
			if ((animConfig.exitAnimation || "fade") === v) opt.selected = true;
			eSelect.appendChild(opt);
		});
		eSelect.onchange = () => {
			this.recordHistory();
			this.screen.animations ||= {};
			this.screen.animations.exitAnimation = eSelect.value as any;
			this.onSync();
		};
		exitRow.append(eLabel, eSelect);
		animBox.appendChild(exitRow);

		// Test Animations Button
		const testAnimBtn = document.createElement("button");
		testAnimBtn.type = "button";
		testAnimBtn.textContent = "▶ Probar Animaciones en Lienzo (Fondo + Elementos)";
		testAnimBtn.style.cssText = "margin-top: 4px; background: #00d2ff; color: #000; border: none; padding: 7px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;";
		testAnimBtn.onclick = () => this.previewAnimationOnCanvas();
		animBox.appendChild(testAnimBtn);

		scroll.appendChild(animBox);

		this.propertiesPanelEl!.appendChild(scroll);
	}

	private renderElementProperties(elem: DeathScreenElement) {
		const header = document.createElement("div");
		header.style.cssText = "padding: 8px 10px; background: #222530; border-bottom: 1px solid #2c303d; display: flex; justify-content: space-between; align-items: center;";

		const titleGroup = document.createElement("div");
		titleGroup.style.cssText = "display: flex; align-items: center; gap: 6px;";
		const title = document.createElement("strong");
		title.textContent = elem.name;
		title.style.color = "#00d2ff";
		const badge = document.createElement("span");
		badge.textContent = elem.type;
		badge.style.cssText = "font-size: 10px; padding: 1px 4px; background: rgba(0, 210, 255, 0.15); border-radius: 3px; color: #00d2ff;";
		titleGroup.append(title, badge);

		const deselectBtn = document.createElement("button");
		deselectBtn.type = "button";
		deselectBtn.textContent = "✕";
		deselectBtn.title = "Deseleccionar elemento";
		deselectBtn.style.cssText = "background: none; border: none; color: #888; cursor: pointer; font-size: 12px;";
		deselectBtn.onclick = () => {
			this.selectedElementId = null;
			this.updateAll();
		};

		header.append(titleGroup, deselectBtn);
		this.propertiesPanelEl!.appendChild(header);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px;";

		// Name input
		scroll.appendChild(this.createTextInput("Nombre del Elemento", elem.name, "", (v) => {
			this.recordHistory();
			elem.name = v.trim() || elem.type;
			this.onSync();
			this.updateLayersList();
		}));

		// Content Template (with dynamic token chips)
		if (elem.type !== "panel" && elem.type !== "divider") {
			const contentBox = document.createElement("div");
			contentBox.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
			const cLabel = document.createElement("label");
			cLabel.textContent = "Contenido / Plantilla";
			cLabel.style.fontWeight = "bold";

			const cInput = document.createElement("input");
			cInput.type = "text";
			cInput.value = elem.content || "";
			cInput.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 6px; border-radius: 4px;";
			cInput.onchange = () => {
				this.recordHistory();
				elem.content = cInput.value;
				this.onSync();
				this.updateCanvas();
			};

			// Dynamic Token Chips
			const chips = document.createElement("div");
			chips.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;";
			[
				"{killer_name}",
				"{killer_weapon}",
				"{cause}",
				"{remaining_lives}",
				"{countdown}",
				"{details}",
			].forEach((token) => {
				const chip = document.createElement("button");
				chip.type = "button";
				chip.textContent = token;
				chip.style.cssText = "background: #252a38; border: 1px solid #3d465c; color: #00d2ff; font-size: 10px; border-radius: 3px; padding: 1px 5px; cursor: pointer;";
				chip.onclick = () => {
					cInput.value += ` ${token}`;
					elem.content = cInput.value;
					this.recordHistory();
					this.onSync();
					this.updateCanvas();
				};
				chips.appendChild(chip);
			});

			contentBox.append(cLabel, cInput, chips);
			scroll.appendChild(contentBox);

			// Fallback content
			scroll.appendChild(this.createTextInput("Texto Alternativo (Fallback)", elem.fallbackContent || "", "Si faltan datos...", (fb) => {
				this.recordHistory();
				elem.fallbackContent = fb;
				this.onSync();
				this.updateCanvas();
			}));
		}

		// Action Button Specifics
		if (elem.type === "action_button") {
			const actionBox = document.createElement("div");
			actionBox.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
			const aLabel = document.createElement("label");
			aLabel.textContent = "Acción de Juego";
			aLabel.style.fontWeight = "bold";

			const aSelect = document.createElement("select");
			aSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 6px; border-radius: 4px;";
			[
				{ v: "respawn", t: "Reaparecer (Reanudar Partida)" },
				{ v: "spectate", t: "Observar (Modo Espectador)" },
				{ v: "restart", t: "Reiniciar Partida" },
				{ v: "lobby", t: "Volver al Menú Principal / Lobby" },
			].forEach((act) => {
				const opt = document.createElement("option");
				opt.value = act.v;
				opt.textContent = act.t;
				if (elem.action === act.v) opt.selected = true;
				aSelect.appendChild(opt);
			});
			aSelect.onchange = () => {
				this.recordHistory();
				elem.action = aSelect.value as DeathActionButtonType;
				this.onSync();
				this.updateCanvas();
			};

			const pCheck = this.createCheckbox("Botón Primario (Enter / Espacio)", Boolean(elem.isPrimary), (chk) => {
				this.recordHistory();
				elem.isPrimary = chk;
				this.onSync();
			});

			actionBox.append(aLabel, aSelect, pCheck);
			scroll.appendChild(actionBox);
		}

		// Image Specifics
		if (elem.type === "image") {
			scroll.appendChild(this.createTextInput("URL de la Imagen", elem.imageUrl || "", "https://... o assets/...", (url) => {
				this.recordHistory();
				elem.imageUrl = sanitizeImageUrl(url);
				this.onSync();
				this.updateCanvas();
			}));
		}

		// Coordinates and Dimensions Grid
		const geoBox = document.createElement("div");
		geoBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; background: #20242f; padding: 8px; border-radius: 4px;";
		geoBox.innerHTML = "<strong style='font-size:12px; color:#aaa;'>Posición y Tamaño (%)</strong>";

		const row1 = document.createElement("div");
		row1.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px;";
		row1.appendChild(this.createNumberInput("X (%)", elem.x, 0, 100, (v) => { elem.x = v; this.onSync(); this.updateCanvas(); }));
		row1.appendChild(this.createNumberInput("Y (%)", elem.y, 0, 100, (v) => { elem.y = v; this.onSync(); this.updateCanvas(); }));

		const row2 = document.createElement("div");
		row2.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px;";
		row2.appendChild(this.createNumberInput("Ancho (%)", elem.width, 2, 100, (v) => { elem.width = v; this.onSync(); this.updateCanvas(); }));
		row2.appendChild(this.createNumberInput("Alto (%)", elem.height, 1, 100, (v) => { elem.height = v; this.onSync(); this.updateCanvas(); }));

		// Anchor selector
		const anchorSelect = document.createElement("select");
		anchorSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; font-size: 11px; margin-top: 4px;";
		[
			{ v: "top-left", t: "Anclaje: Superior Izquierda" },
			{ v: "top-center", t: "Anclaje: Superior Centro" },
			{ v: "top-right", t: "Anclaje: Superior Derecha" },
			{ v: "center-left", t: "Anclaje: Centro Izquierda" },
			{ v: "center", t: "Anclaje: Centro Exacto" },
			{ v: "center-right", t: "Anclaje: Centro Derecha" },
			{ v: "bottom-left", t: "Anclaje: Inferior Izquierda" },
			{ v: "bottom-center", t: "Anclaje: Inferior Centro" },
			{ v: "bottom-right", t: "Anclaje: Inferior Derecha" },
		].forEach((anc) => {
			const opt = document.createElement("option");
			opt.value = anc.v;
			opt.textContent = anc.t;
			if ((elem.anchor || "center") === anc.v) opt.selected = true;
			anchorSelect.appendChild(opt);
		});
		anchorSelect.onchange = () => {
			this.recordHistory();
			elem.anchor = anchorSelect.value as DeathScreenAnchor;
			this.onSync();
			this.updateCanvas();
		};

		geoBox.append(row1, row2, anchorSelect);
		scroll.appendChild(geoBox);

		// Typography
		elem.style ||= {};
		if (elem.type !== "panel" && elem.type !== "divider" && elem.type !== "image") {
			const typoBox = document.createElement("div");
			typoBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; background: #20242f; padding: 8px; border-radius: 4px;";
			typoBox.innerHTML = "<strong style='font-size:12px; color:#aaa;'>Tipografía</strong>";

			typoBox.appendChild(this.createNumberSlider("Tamaño de Fuente (px)", elem.style.fontSize ?? 14, 9, 64, (v) => {
				this.recordHistory();
				elem.style!.fontSize = v;
				this.onSync();
				this.updateCanvas();
			}));

			typoBox.appendChild(this.createColorPicker("Color de Texto", elem.style.color || "#ffffff", (c) => {
				this.recordHistory();
				elem.style!.color = c;
				this.onSync();
				this.updateCanvas();
			}));

			// Align & Weight row
			const alignRow = document.createElement("div");
			alignRow.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px;";
			const alignSelect = document.createElement("select");
			alignSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
			[["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]].forEach(([v, t]) => {
				const opt = document.createElement("option"); opt.value = v; opt.textContent = t;
				if ((elem.style?.textAlign || "center") === v) opt.selected = true;
				alignSelect.appendChild(opt);
			});
			alignSelect.onchange = () => {
				this.recordHistory();
				elem.style!.textAlign = alignSelect.value as any;
				this.onSync();
				this.updateCanvas();
			};

			const weightSelect = document.createElement("select");
			weightSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
			[["normal", "Normal"], ["600", "Semibold"], ["bold", "Negrita"], ["800", "Extra Bold"]].forEach(([v, t]) => {
				const opt = document.createElement("option"); opt.value = v; opt.textContent = t;
				if ((elem.style?.fontWeight || "normal") === v) opt.selected = true;
				weightSelect.appendChild(opt);
			});
			weightSelect.onchange = () => {
				this.recordHistory();
				elem.style!.fontWeight = weightSelect.value as any;
				this.onSync();
				this.updateCanvas();
			};

			alignRow.append(alignSelect, weightSelect);
			typoBox.appendChild(alignRow);
			scroll.appendChild(typoBox);
		}

		// Box Appearance (Background, Border, Radius, Blur)
		const boxStyle = document.createElement("div");
		boxStyle.style.cssText = "display: flex; flex-direction: column; gap: 6px; background: #20242f; padding: 8px; border-radius: 4px;";
		boxStyle.innerHTML = "<strong style='font-size:12px; color:#aaa;'>Estilo y Contenedor</strong>";

		boxStyle.appendChild(this.createColorPicker("Color de Fondo", elem.style.backgroundColor || "transparent", (c) => {
			this.recordHistory();
			elem.style!.backgroundColor = c;
			this.onSync();
			this.updateCanvas();
		}));

		boxStyle.appendChild(this.createNumberSlider("Radio de Borde (px)", elem.style.borderRadius ?? 0, 0, 40, (v) => {
			this.recordHistory();
			elem.style!.borderRadius = v;
			this.onSync();
			this.updateCanvas();
		}));

		boxStyle.appendChild(this.createColorPicker("Color de Borde", elem.style.borderColor || "transparent", (c) => {
			this.recordHistory();
			elem.style!.borderColor = c;
			if (!elem.style!.borderWidth) elem.style!.borderWidth = 1;
			elem.style!.borderStyle = "solid";
			this.onSync();
			this.updateCanvas();
		}));

		scroll.appendChild(boxStyle);

		// Visibility Conditions
		const condBox = document.createElement("div");
		condBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; background: #20242f; padding: 8px; border-radius: 4px;";
		condBox.innerHTML = "<strong style='font-size:12px; color:#aaa;'>Condiciones de Visibilidad</strong>";

		elem.conditions ||= {};
		const causes = elem.conditions.causes || [];
		const states = elem.conditions.states || [];

		condBox.appendChild(document.createTextNode("Estados en que se muestra:"));
		[
			{ v: "respawn", t: "Reaparición disponible" },
			{ v: "last_life", t: "Última vida" },
			{ v: "game_over", t: "Fin de partida" },
			{ v: "spectator", t: "Observador" },
		].forEach((st) => {
			const isChecked = states.length === 0 || states.includes(st.v as any);
			condBox.appendChild(this.createCheckbox(st.t, isChecked, (chk) => {
				this.recordHistory();
				const sSet = new Set(elem.conditions!.states || ["respawn", "last_life", "game_over", "spectator"]);
				if (chk) sSet.add(st.v as any);
				else sSet.delete(st.v as any);
				elem.conditions!.states = Array.from(sSet) as any;
				this.onSync();
				this.updateCanvas();
			}));
		});

		condBox.appendChild(this.createCheckbox("Ocultar si faltan datos dinámicos", Boolean(elem.conditions.hideWhenMissingData), (chk) => {
			this.recordHistory();
			elem.conditions!.hideWhenMissingData = chk;
			this.onSync();
			this.updateCanvas();
		}));

		scroll.appendChild(condBox);

		// Per-element animation override box
		const elemAnimBox = document.createElement("div");
		elemAnimBox.style.cssText = "display: flex; flex-direction: column; gap: 6px; background: #20242f; padding: 8px; border-radius: 4px; border: 1px solid #32384a;";
		elemAnimBox.innerHTML = "<strong style='font-size:12px; color:#00d2ff;'>Animación del Elemento (Override)</strong>";

		elem.animation ||= {};
		const typeRow = document.createElement("div");
		typeRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
		const tLabel = document.createElement("label");
		tLabel.textContent = "Efecto de Entrada";
		tLabel.style.cssText = "font-size: 11px; color: #aaa;";
		const tSelect = document.createElement("select");
		tSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
		[
			["", "(Heredar del preset global)"],
			["fade", "Fundido simple (Fade in)"],
			["slide_up", "Deslizar desde abajo (Slide up)"],
			["slide_down", "Deslizar desde arriba (Slide down)"],
			["slide_left", "Deslizar desde la derecha"],
			["slide_right", "Deslizar desde la izquierda"],
			["scale_up", "Aparición con escala (Scale up)"],
			["blur_in", "Enfoque progresivo (Blur in)"],
			["none", "Sin animación (Instantáneo)"],
		].forEach(([v, t]) => {
			const opt = document.createElement("option");
			opt.value = v;
			opt.textContent = t;
			if ((elem.animation?.type || "") === v) opt.selected = true;
			tSelect.appendChild(opt);
		});
		tSelect.onchange = () => {
			this.recordHistory();
			elem.animation ||= {};
			elem.animation.type = (tSelect.value || undefined) as any;
			this.onSync();
		};
		typeRow.append(tLabel, tSelect);
		elemAnimBox.appendChild(typeRow);

		// Custom duration
		elemAnimBox.appendChild(this.createNumberInput("Duración Personalizada (ms, 0 = auto)", elem.animation.duration ?? 0, 0, 2000, (v) => {
			this.recordHistory();
			elem.animation ||= {};
			elem.animation.duration = v > 0 ? v : undefined;
			this.onSync();
		}));

		// Custom delay
		elemAnimBox.appendChild(this.createNumberInput("Retardo Personalizado (ms)", elem.animation.delay ?? 0, 0, 2000, (v) => {
			this.recordHistory();
			elem.animation ||= {};
			elem.animation.delay = v > 0 ? v : undefined;
			this.onSync();
		}));

		// Custom easing selector
		const easeRow = document.createElement("div");
		easeRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
		const easeLabel = document.createElement("label");
		easeLabel.textContent = "Curva de Aceleración / Easing";
		easeLabel.style.cssText = "font-size: 11px; color: #aaa;";
		const easeSelect = document.createElement("select");
		easeSelect.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;";
		[
			["", "(Heredar del preset global)"],
			["easeOutCubic", "Suave (easeOutCubic)"],
			["easeOutQuad", "Rápido (easeOutQuad)"],
			["easeOutBack", "Rebote con anticipación (easeOutBack)"],
			["easeOutElastic", "Elástico de impacto (easeOutElastic)"],
			["easeInOutQuad", "Entrada y salida simétrica (easeInOutQuad)"],
			["linear", "Lineal constante (linear)"],
		].forEach(([v, t]) => {
			const opt = document.createElement("option");
			opt.value = v;
			opt.textContent = t;
			if ((elem.animation?.easing || "") === v) opt.selected = true;
			easeSelect.appendChild(opt);
		});
		easeSelect.onchange = () => {
			this.recordHistory();
			elem.animation ||= {};
			elem.animation.easing = (easeSelect.value || undefined) as any;
			this.onSync();
		};
		easeRow.append(easeLabel, easeSelect);
		elemAnimBox.appendChild(easeRow);

		scroll.appendChild(elemAnimBox);

		this.propertiesPanelEl!.appendChild(scroll);
	}

	private handleRootKeyDown(e: KeyboardEvent) {
		// Undo / Redo shortcuts
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
			e.preventDefault();
			if (e.shiftKey) this.redo();
			else this.undo();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
			e.preventDefault();
			this.redo();
			return;
		}

		if (!this.selectedElementId) return;
		const elem = this.screen.elements?.find((e) => e.id === this.selectedElementId);
		if (!elem) return;

		// Ignore if typing in text inputs
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as any).isContentEditable) {
			return;
		}

		// Delete
		if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			this.removeElement(elem.id);
			return;
		}

		// Deselect
		if (e.key === "Escape") {
			e.preventDefault();
			this.selectedElementId = null;
			this.updateAll();
			return;
		}

		// Nudge arrow keys
		const step = e.shiftKey ? 2.5 : 0.5;
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			elem.x = Math.max(0, elem.x - step);
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			elem.x = Math.min(100, elem.x + step);
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			elem.y = Math.max(0, elem.y - step);
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			elem.y = Math.min(100, elem.y + step);
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		}
	}

	private updateAll() {
		this.updateLayersList();
		this.updateCanvas();
		this.updatePropertiesPanel();
	}

	// UI Component Helpers
	private createTextInput(labelStr: string, value: string, placeholder: string, onChange: (v: string) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const l = document.createElement("label");
		l.textContent = labelStr;
		l.style.fontWeight = "bold";
		const input = document.createElement("input");
		input.type = "text";
		input.value = value;
		input.placeholder = placeholder;
		input.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 5px 8px; border-radius: 4px;";
		input.onchange = () => onChange(input.value);
		wrap.append(l, input);
		return wrap;
	}

	private createColorPicker(labelStr: string, value: string, onChange: (c: string) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const l = document.createElement("label");
		l.textContent = labelStr;
		l.style.fontWeight = "bold";

		const row = document.createElement("div");
		row.style.cssText = "display: flex; gap: 6px; align-items: center;";

		const colorInput = document.createElement("input");
		colorInput.type = "color";
		colorInput.value = value.startsWith("#") ? value.slice(0, 7) : "#ffffff";
		colorInput.style.cssText = "width: 32px; height: 28px; background: none; border: 1px solid #555; border-radius: 4px; cursor: pointer;";

		const textInput = document.createElement("input");
		textInput.type = "text";
		textInput.value = value;
		textInput.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px 6px; border-radius: 4px; flex: 1;";

		colorInput.onchange = () => {
			textInput.value = colorInput.value;
			onChange(colorInput.value);
		};
		textInput.onchange = () => {
			onChange(textInput.value);
		};

		row.append(colorInput, textInput);
		wrap.append(l, row);
		return wrap;
	}

	private createNumberSlider(labelStr: string, value: number, min: number, max: number, onChange: (v: number) => void, step = 1): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const l = document.createElement("label");
		l.textContent = `${labelStr}: ${value}`;
		l.style.fontWeight = "bold";

		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = String(min);
		slider.max = String(max);
		slider.step = String(step);
		slider.value = String(value);
		slider.style.cssText = "width: 100%; cursor: pointer;";

		slider.oninput = () => {
			const val = parseFloat(slider.value);
			l.textContent = `${labelStr}: ${val}`;
			onChange(val);
		};

		wrap.append(l, slider);
		return wrap;
	}

	private createNumberInput(labelStr: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
		const l = document.createElement("label");
		l.textContent = labelStr;
		l.style.fontSize = "11px";
		l.style.color = "#aaa";
		const input = document.createElement("input");
		input.type = "number";
		input.min = String(min);
		input.max = String(max);
		input.value = String(value);
		input.style.cssText = "background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; width: 100%; box-sizing: border-box;";
		input.onchange = () => {
			const val = parseFloat(input.value);
			if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)));
		};
		wrap.append(l, input);
		return wrap;
	}

	private createCheckbox(labelStr: string, checked: boolean, onChange: (c: boolean) => void): HTMLElement {
		const label = document.createElement("label");
		label.style.cssText = "display: flex; gap: 6px; align-items: center; color: #ddd; font-size: 12px; cursor: pointer;";
		const chk = document.createElement("input");
		chk.type = "checkbox";
		chk.checked = checked;
		chk.onchange = () => onChange(chk.checked);
		label.append(chk, document.createTextNode(labelStr));
		return label;
	}
}

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
	DeathScreenShapeType,
	DeathScreenAnimationType,
	DeathScreenEasing,
	DeathScreenKeyframe,
	DeathScreenCustomComponent,
} from "../types/experienceMode.types";
import {
	createDefaultDeathScreenElements,
	normalizeDeathScreenElements,
	normalizeDeathScreenBackground,
	evaluateDynamicTokens,
	sanitizeImageUrl,
	DEFAULT_DEATH_SCREEN_VIGNETTE,
} from "../types/experienceMode.types";
import { DeathAnimationService, resolveEasing } from "../managers/DeathAnimationService";
import { StudioTokens } from "./studio/StudioTokens";
import { renderStudioIcon } from "./studio/StudioIcons";
import { StudioBackgroundManager } from "./studio/StudioBackgroundManager";
import { StudioGraphEditor, type BezierCurveTuple } from "./studio/StudioGraphEditor";

export interface DeathScreenEditorOptions {
	mode: ExperienceModeProfile;
	onSync: () => void;
	onPreviewFullscreen?: (previewState: "respawn" | "last_life" | "game_over" | "spectator") => void;
}

export type StudioWorkspaceMode = "design" | "animate" | "test";
export type StudioLeftTab = "layers" | "elements" | "backgrounds" | "assets";

export class DeathScreenEditor {
	public mode: ExperienceModeProfile;
	private onSync: () => void;
	private onPreviewFullscreen?: (previewState: "respawn" | "last_life" | "game_over" | "spectator") => void;

	// Containers
	public container: HTMLElement | null = null;
	private embeddedContainer: HTMLElement | null = null;
	public studioOverlayEl: HTMLElement | null = null;
	private canvasWrapper: HTMLElement | null = null;
	private canvasViewport: HTMLElement | null = null;
	public canvasEl: HTMLElement | null = null;
	private canvasBgLayer: HTMLElement | null = null;
	private guidesOverlayEl: HTMLElement | null = null;
	private gridOverlayEl: HTMLElement | null = null;
	private safeAreaEl: HTMLElement | null = null;
	private propertiesPanelEl: HTMLElement | null = null;
	private layersListEl: HTMLElement | null = null;
	private timelineDockEl: HTMLElement | null = null;
	private statusBarEl: HTMLElement | null = null;

	// Studio Workspace States
	public isStudioExpanded = false;
	public activeWorkspaceMode: StudioWorkspaceMode = "design";
	public activeLeftTab: StudioLeftTab = "layers";
	private layerSearchQuery = "";
	private elementSearchQuery = "";
	private hasUnsavedChanges = false;

	// Multi-selection & Layers
	public selectedElementIds: Set<string> = new Set();
	private previewState: "respawn" | "last_life" | "game_over" | "spectator" = "respawn";
	private previewCause: DeathCause = "damage";
	private previewDevice: "desktop" | "ultrawide" | "tablet" | "mobile" | "mobile_land" = "desktop";

	// Snapping, Grid, Zoom & Pan
	private smartSnappingEnabled = true;
	private showGrid = false;
	private showSafeArea = true;
	private zoomLevel = 1.0;
	public activeCanvasTool: "select" | "hand" = "select";
	public canvasPanX = 0;
	public canvasPanY = 0;
	private isPanning = false;
	private panStartX = 0;
	private panStartY = 0;
	public canvasBackdropMode: "dark" | "checker" | "cyberpunk" | "hangar" = "dark";

	// Resizable & Collapsible Panels
	public leftPanelWidth = 280;
	public rightPanelWidth = 340;
	public timelineHeight = 220;
	public isLeftPanelCollapsed = false;
	public isRightPanelCollapsed = false;
	public isTimelineCollapsed = false;

	// Marquee Selection & Context Menu
	private isMarqueeSelecting = false;
	private marqueeStartX = 0;
	private marqueeStartY = 0;
	private marqueeEl: HTMLElement | null = null;
	private contextMenuEl: HTMLElement | null = null;
	private clipboardElement: DeathScreenElement | null = null;

	// Undo / Redo history stacks
	private undoStack: string[] = [];
	private redoStack: string[] = [];
	private maxHistory = 40;

	// Dragging, Resizing & Rotating state
	private isDragging = false;
	private isResizing = false;
	private isRotating = false;
	private resizeHandle: string | null = null;
	private animationService = new DeathAnimationService();
	private dragStartX = 0;
	private dragStartY = 0;
	private elementStartPos = { x: 0, y: 0, width: 0, height: 0 };
	private multiDragStartPositions: Map<string, { x: number; y: number }> = new Map();
	private rotationCenter = { x: 0, y: 0 };
	private elementStartRotation = 0;

	// Timeline & Keyframe State
	public isPlayingSequence = false;
	public timelineCurrentTime = 0; // ms
	public timelineTotalDuration = 3000; // ms
	private timelineTimerId: number | null = null;
	public playbackSpeed: 0.5 | 1 | 2 = 1;
	public isLooping = false;
	public autoKeyEnabled = true;
	public timelineViewMode: "dopesheet" | "graph" = "dopesheet";
	public graphEditor: StudioGraphEditor | null = null;
	public activeCurve: BezierCurveTuple = [0.34, 1.56, 0.64, 1];
	public expandedTracks: Set<string> = new Set();
	public selectedKeyframeInfo: { elemId: string; keyframeIdx: number } | null = null;

	// Custom Components Library
	public customComponents: DeathScreenCustomComponent[] = [];

	// Background Manager Premium
	public backgroundManager: StudioBackgroundManager;

	constructor(options: DeathScreenEditorOptions) {
		this.mode = options.mode;
		this.onSync = options.onSync;
		this.onPreviewFullscreen = options.onPreviewFullscreen;

		this.backgroundManager = new StudioBackgroundManager((bg) => {
			this.recordHistory();
			this.mode.deathScreen.background = bg;
			this.hasUnsavedChanges = true;
			this.onSync();
			this.updateCanvas();
			this.updatePropertiesPanel();
		});

		this.graphEditor = new StudioGraphEditor({
			curve: this.activeCurve,
			onChange: (newCurve) => {
				this.activeCurve = newCurve;
				if (this.selectedKeyframeInfo) {
					const elem = this.screen.elements?.find((e) => e.id === this.selectedKeyframeInfo?.elemId);
					if (elem && elem.keyframes && elem.keyframes[this.selectedKeyframeInfo.keyframeIdx]) {
						elem.keyframes[this.selectedKeyframeInfo.keyframeIdx].bezierCurve = [...newCurve];
						elem.keyframes[this.selectedKeyframeInfo.keyframeIdx].easing = "cubicBezier";
						this.hasUnsavedChanges = true;
						this.onSync();
					}
				}
			},
		});

		this.ensureConfig();
		this.loadCustomComponents();
	}

	public setMode(mode: ExperienceModeProfile) {
		this.mode = mode;
		this.selectedElementIds.clear();
		this.undoStack = [];
		this.redoStack = [];
		this.hasUnsavedChanges = false;
		this.stopTimelineSequence();
		this.ensureConfig();
		if (this.container) {
			this.render(this.container);
		}
	}

	public getScreenConfig(): DeathScreenConfig {
		return this.mode.deathScreen;
	}

	private get screen(): DeathScreenConfig {
		return this.mode.deathScreen;
	}

	public get selectedElementId(): string | null {
		if (this.selectedElementIds.size === 0) return null;
		return Array.from(this.selectedElementIds)[0];
	}

	public set selectedElementId(id: string | null) {
		this.selectedElementIds.clear();
		if (id) this.selectedElementIds.add(id);
	}

	public getWorkspaceMode(): StudioWorkspaceMode {
		return this.activeWorkspaceMode;
	}

	public isExpanded(): boolean {
		return this.isStudioExpanded;
	}

	public setLeftTab(tab: StudioLeftTab) {
		this.activeLeftTab = tab;
		this.updateLayersList();
	}

	public setWorkspaceMode(mode: StudioWorkspaceMode) {
		this.activeWorkspaceMode = mode;
		if (mode === "animate") {
			this.isTimelineCollapsed = false;
			if (this.timelineHeight < 240) this.timelineHeight = 280;
		}
		if (this.container) {
			this.render(this.container);
		}
	}

	public selectElement(id: string | null, multi = false) {
		if (!id) {
			this.selectedElementIds.clear();
		} else {
			if (!multi) {
				this.selectedElementIds.clear();
				this.selectedElementIds.add(id);
			} else {
				if (this.selectedElementIds.has(id)) {
					this.selectedElementIds.delete(id);
				} else {
					this.selectedElementIds.add(id);
				}
			}
		}
		this.updateLayersList();
		this.updateCanvas();
		this.updatePropertiesPanel();
		this.updateTimelineDock();
		this.updateStatusBar();
	}

	public getSelectedElements(): DeathScreenElement[] {
		if (!this.screen.elements) return [];
		return this.screen.elements.filter((e) => this.selectedElementIds.has(e.id));
	}

	private ensureConfig() {
		if (!this.mode.deathScreen) {
			this.mode.deathScreen = {
				enabled: true,
				title: "HAS MUERTO",
				subtitle: "Volviendo al punto de inicio...",
				accentColor: "#00d2ff",
				backgroundColor: "#090b0e",
				buttons: [{ id: "btn_respawn", action: "respawn", label: "Reaparecer", isPrimary: true }],
				elements: createDefaultDeathScreenElements(),
			};
		}
		if (!this.mode.deathScreen.elements || this.mode.deathScreen.elements.length === 0) {
			this.mode.deathScreen.elements = createDefaultDeathScreenElements();
		}
		this.mode.deathScreen.elements = normalizeDeathScreenElements(this.mode.deathScreen.elements);
		if (!this.mode.deathScreen.background) {
			this.mode.deathScreen.background = normalizeDeathScreenBackground(
				undefined,
				this.mode.deathScreen.backgroundColor
			);
		}
	}

	// --- CUSTOM COMPONENTS SYSTEM ---
	public loadCustomComponents(): DeathScreenCustomComponent[] {
		try {
			if (typeof localStorage !== "undefined") {
				const saved = localStorage.getItem("viper_death_custom_components");
				if (saved) {
					this.customComponents = JSON.parse(saved);
				}
			}
		} catch (e) {
			console.warn("Could not load custom components:", e);
		}
		if (!Array.isArray(this.customComponents) || this.customComponents.length === 0) {
			this.customComponents = this.getDefaultCustomComponents();
		}
		return this.customComponents;
	}

	public getCustomComponents(): DeathScreenCustomComponent[] {
		return this.customComponents;
	}

	private saveCustomComponentsToStorage() {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("viper_death_custom_components", JSON.stringify(this.customComponents));
			}
		} catch (e) {
			console.warn("Could not save custom components to storage:", e);
		}
	}

	private getDefaultCustomComponents(): DeathScreenCustomComponent[] {
		return [
			{
				id: "comp_killer_card",
				name: "Ficha Asesino VIPER",
				category: "Gameplay",
				icon: "crosshair",
				description: "Tarjeta con avatar, nombre de asesino, clan y arma",
				elements: [
					{
						id: "comp_k_card",
						name: "Contenedor Asesino",
						type: "container",
						x: 50,
						y: 60,
						width: 44,
						height: 14,
						style: {
							backgroundColor: "rgba(10, 14, 22, 0.85)",
							borderColor: "#00d2ff88",
							borderWidth: 1,
							borderRadius: 6,
							backdropBlur: 8,
							boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
						},
					},
					{
						id: "comp_k_name",
						name: "Nombre Asesino",
						type: "title",
						x: 50,
						y: 57,
						width: 40,
						height: 6,
						text: "ELIMINADO POR: {killer_name}",
						style: {
							color: "#ffffff",
							fontSize: 16,
							fontWeight: "bold",
							textAlign: "center",
						},
					},
					{
						id: "comp_k_meta",
						name: "Meta Asesino",
						type: "badge",
						x: 50,
						y: 63,
						width: 36,
						height: 4,
						text: "CLAN: [{killer_clan}]  |  ARMA: {killer_weapon}",
						style: {
							color: "#00d2ff",
							backgroundColor: "rgba(0, 210, 255, 0.12)",
							borderColor: "#00d2ff55",
							borderWidth: 1,
							borderRadius: 4,
							fontSize: 11,
							textAlign: "center",
						},
					},
				],
			},
			{
				id: "comp_headshot_badge",
				name: "Insignia Headshot Pro",
				category: "Insignias",
				icon: "crosshair",
				description: "Insignia circular dorada con aviso de impacto crítico",
				elements: [
					{
						id: "comp_hs_badge",
						name: "Insignia Crítico",
						type: "badge",
						x: 50,
						y: 35,
						width: 24,
						height: 5,
						text: "IMPACTO CRÍTICO EN CABEZA",
						style: {
							backgroundColor: "rgba(255, 184, 48, 0.15)",
							borderColor: "#ffb830",
							borderWidth: 1,
							borderRadius: 9999,
							color: "#ffb830",
							fontSize: 11,
							fontWeight: "bold",
							textAlign: "center",
							boxShadow: "0 0 12px rgba(255, 184, 48, 0.3)",
						},
					},
				],
			},
			{
				id: "comp_squad_banner",
				name: "Banner Reaparición Squad",
				category: "HUD",
				icon: "shield",
				description: "Aviso de cuenta regresiva con barra de refuerzos",
				elements: [
					{
						id: "comp_sq_bg",
						name: "Fondo Banner Squad",
						type: "panel",
						x: 50,
						y: 78,
						width: 38,
						height: 10,
						style: {
							backgroundColor: "rgba(16, 20, 28, 0.9)",
							borderColor: "#00d2ff44",
							borderWidth: 1,
							borderRadius: 4,
						},
					},
					{
						id: "comp_sq_bar",
						name: "Barra Squad",
						type: "progress_bar",
						x: 50,
						y: 81,
						width: 32,
						height: 3,
						style: {
							color: "#00d2ff",
							backgroundColor: "rgba(0, 210, 255, 0.15)",
							borderColor: "#00d2ff88",
							borderRadius: 3,
						},
					},
				],
			},
		];
	}

	public createCustomComponentFromSelection(name?: string) {
		const sel = this.getSelectedElements();
		if (sel.length === 0) {
			alert("Selecciona al menos un elemento para crear un componente reutilizable.");
			return;
		}

		const compName = name || prompt("Nombre del componente:", "Nuevo Componente");
		if (!compName) return;

		const minX = Math.min(...sel.map((e) => e.x));
		const minY = Math.min(...sel.map((e) => e.y));

		const clonedElements: DeathScreenElement[] = JSON.parse(JSON.stringify(sel)).map((e: DeathScreenElement) => {
			return {
				...e,
				id: `comp_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
				x: e.x - minX + 50,
				y: e.y - minY + 50,
			};
		});

		const newComp: DeathScreenCustomComponent = {
			id: `comp_${Date.now()}`,
			name: compName,
			category: "Personalizados",
			icon: "component",
			description: `Componente compuesto por ${sel.length} elemento(s)`,
			elements: clonedElements,
		};

		this.customComponents.push(newComp);
		this.saveCustomComponentsToStorage();
		this.activeLeftTab = "assets";
		this.updateLayersList();
	}

	public instantiateCustomComponent(compId: string, targetX = 50, targetY = 50) {
		const comp = this.customComponents.find((c) => c.id === compId);
		if (!comp || !comp.elements || comp.elements.length === 0) return;

		this.recordHistory();
		if (!this.screen.elements) this.screen.elements = [];

		const originX = comp.elements[0].x || 50;
		const originY = comp.elements[0].y || 50;
		const deltaX = targetX - originX;
		const deltaY = targetY - originY;

		const newIds: string[] = [];
		const baseZ = this.screen.elements.length + 1;

		comp.elements.forEach((srcElem, idx) => {
			const clone: DeathScreenElement = JSON.parse(JSON.stringify(srcElem));
			clone.id = `elem_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`;
			clone.name = `${srcElem.name || "Elemento"}`;
			clone.x = Math.max(5, Math.min(95, (clone.x || 50) + deltaX));
			clone.y = Math.max(5, Math.min(95, (clone.y || 50) + deltaY));
			clone.zIndex = baseZ + idx;
			this.screen.elements!.push(clone);
			newIds.push(clone.id);
		});

		this.selectedElementIds.clear();
		newIds.forEach((id) => this.selectedElementIds.add(id));
		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateAll();
	}

	// --- HISTORY MANAGEMENT ---
	public recordHistory() {
		const snapshot = JSON.stringify(this.screen);
		this.undoStack.push(snapshot);
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	}

	public undo() {
		if (this.undoStack.length === 0) return;
		const currentSnapshot = JSON.stringify(this.screen);
		this.redoStack.push(currentSnapshot);
		const previousSnapshot = this.undoStack.pop();
		if (previousSnapshot) {
			try {
				const restored = JSON.parse(previousSnapshot);
				this.mode.deathScreen = restored;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateAll();
			} catch (e) {
				console.error("Failed to restore undo state", e);
			}
		}
	}

	public redo() {
		if (this.redoStack.length === 0) return;
		const currentSnapshot = JSON.stringify(this.screen);
		this.undoStack.push(currentSnapshot);
		const nextSnapshot = this.redoStack.pop();
		if (nextSnapshot) {
			try {
				const restored = JSON.parse(nextSnapshot);
				this.mode.deathScreen = restored;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateAll();
			} catch (e) {
				console.error("Failed to restore redo state", e);
			}
		}
	}

	// --- EXPAND / COLLAPSE STUDIO WORKSPACE ---
	public expandStudio() {
		this.isStudioExpanded = true;
		if (typeof document === "undefined") return;
		if (!this.studioOverlayEl) {
			this.studioOverlayEl = document.createElement("div");
			this.studioOverlayEl.id = "viper-studio-fullscreen-overlay";
			this.studioOverlayEl.style.cssText = `
				position: fixed;
				inset: 0;
				width: 100vw;
				height: 100vh;
				z-index: 999999;
				background: ${StudioTokens.colors.surfaceBase};
				display: flex;
				flex-direction: column;
				overflow: hidden;
				font-family: ${StudioTokens.typography.fontFamily};
				color: ${StudioTokens.colors.textPrimary};
			`;
			document.body.appendChild(this.studioOverlayEl);
		}
		this.studioOverlayEl.style.display = "flex";
		this.render(this.studioOverlayEl);
	}

	public collapseStudio() {
		this.isStudioExpanded = false;
		if (typeof document === "undefined") return;
		if (this.studioOverlayEl) {
			this.studioOverlayEl.style.display = "none";
		}
		if (this.embeddedContainer) {
			this.render(this.embeddedContainer);
		}
	}

	public setLayoutPreset(preset: "design" | "timeline" | "canvas") {
		if (preset === "design") {
			this.isLeftPanelCollapsed = false;
			this.isRightPanelCollapsed = false;
			this.isTimelineCollapsed = false;
			this.leftPanelWidth = 280;
			this.rightPanelWidth = 340;
			this.timelineHeight = 180;
			this.activeWorkspaceMode = "design";
		} else if (preset === "timeline") {
			this.isLeftPanelCollapsed = false;
			this.isRightPanelCollapsed = false;
			this.isTimelineCollapsed = false;
			this.leftPanelWidth = 240;
			this.rightPanelWidth = 320;
			this.timelineHeight = 320;
			this.activeWorkspaceMode = "animate";
		} else if (preset === "canvas") {
			this.isLeftPanelCollapsed = true;
			this.isRightPanelCollapsed = true;
			this.isTimelineCollapsed = true;
		}
		if (this.container) {
			this.render(this.container);
		}
	}

	public setTimelineViewMode(mode: "dopesheet" | "graph") {
		this.timelineViewMode = mode;
		if (mode === "graph" && this.timelineHeight < 280) {
			this.timelineHeight = 280;
			if (this.timelineDockEl) this.timelineDockEl.style.height = `${this.timelineHeight}px`;
		}
		this.updateTimelineDock();
	}

	public startResizeLeftPanel(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = this.leftPanelWidth;

		const onMove = (ev: MouseEvent) => {
			const delta = ev.clientX - startX;
			this.leftPanelWidth = Math.max(180, Math.min(480, startW + delta));
			if (this.container) {
				const leftEl = this.container.querySelector(".death-screen-editor-left-sidebar") as HTMLElement;
				if (leftEl) leftEl.style.width = `${this.leftPanelWidth}px`;
				this.recalculateCanvasFit();
			}
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			this.recalculateCanvasFit();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	public startResizeRightPanel(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = this.rightPanelWidth;

		const onMove = (ev: MouseEvent) => {
			const delta = startX - ev.clientX;
			this.rightPanelWidth = Math.max(240, Math.min(520, startW + delta));
			if (this.container) {
				const rightEl = this.container.querySelector(".death-screen-editor-inspector") as HTMLElement;
				if (rightEl) rightEl.style.width = `${this.rightPanelWidth}px`;
				this.recalculateCanvasFit();
			}
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			this.recalculateCanvasFit();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	public startResizeTimeline(e: MouseEvent) {
		e.preventDefault();
		const startY = e.clientY;
		const startH = this.timelineHeight;

		const onMove = (ev: MouseEvent) => {
			const delta = startY - ev.clientY;
			this.timelineHeight = Math.max(120, Math.min(550, startH + delta));
			if (this.container) {
				const timeEl = this.container.querySelector(".death-screen-editor-timeline-dock") as HTMLElement;
				if (timeEl) timeEl.style.height = `${this.timelineHeight}px`;
				this.recalculateCanvasFit();
			}
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			this.recalculateCanvasFit();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	// --- RENDER MAIN INTERFACE ---
	public render(container: HTMLElement) {
		this.container = container;
		if (!this.isStudioExpanded) {
			this.embeddedContainer = container;
		}
		this.container.innerHTML = "";

		const shell = document.createElement("div");
		shell.className = "viper-death-studio-shell";
		shell.style.cssText = `
			display: flex;
			flex-direction: column;
			width: 100%;
			height: 100%;
			background: ${StudioTokens.colors.surfaceBase};
			overflow: hidden;
			position: relative;
			font-family: ${StudioTokens.typography.fontFamily};
		`;

		// Global styles
		const styleEl = document.createElement("style");
		styleEl.textContent = `
			.viper-death-studio-shell * { box-sizing: border-box; }
			.viper-studio-splitter-v {
				width: 4px;
				cursor: col-resize;
				background: ${StudioTokens.colors.borderSubtle};
				transition: background 0.15s ease;
				z-index: 20;
				position: relative;
			}
			.viper-studio-splitter-v:hover, .viper-studio-splitter-v:active {
				background: ${StudioTokens.colors.accent};
			}
			.viper-studio-splitter-h {
				height: 4px;
				cursor: row-resize;
				background: ${StudioTokens.colors.borderSubtle};
				transition: background 0.15s ease;
				z-index: 20;
				position: relative;
			}
			.viper-studio-splitter-h:hover, .viper-studio-splitter-h:active {
				background: ${StudioTokens.colors.accent};
			}
			.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
			.custom-scrollbar::-webkit-scrollbar-track { background: ${StudioTokens.colors.surface1}; }
			.custom-scrollbar::-webkit-scrollbar-thumb { background: ${StudioTokens.colors.borderNormal}; border-radius: 3px; }
			.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${StudioTokens.colors.borderStrong}; }
			@keyframes studioFadeIn { from { opacity: 0; } to { opacity: 1; } }
		`;
		shell.appendChild(styleEl);

		// 1. Top Bar
		shell.appendChild(this.createTopBar());

		// 2. Middle Row (Left Panel, Center Canvas, Right Inspector)
		const workArea = document.createElement("div");
		workArea.className = "death-screen-editor-work-area";
		workArea.style.cssText = "flex: 1; display: flex; flex-direction: row; overflow: hidden; position: relative;";

		// Left Panel
		const leftCol = this.createLeftPanel();
		workArea.appendChild(leftCol);

		// Left Splitter
		if (!this.isLeftPanelCollapsed) {
			const leftSplitter = document.createElement("div");
			leftSplitter.className = "viper-studio-splitter-v";
			leftSplitter.onmousedown = (e) => this.startResizeLeftPanel(e);
			workArea.appendChild(leftSplitter);
		}

		// Center Canvas Column
		const centerCol = document.createElement("div");
		centerCol.className = "death-screen-editor-center-column";
		centerCol.style.cssText = "flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #07090c; position: relative;";
		centerCol.appendChild(this.createCanvasColumn());
		workArea.appendChild(centerCol);

		// Right Splitter
		if (!this.isRightPanelCollapsed) {
			const rightSplitter = document.createElement("div");
			rightSplitter.className = "viper-studio-splitter-v";
			rightSplitter.onmousedown = (e) => this.startResizeRightPanel(e);
			workArea.appendChild(rightSplitter);
		}

		// Right Inspector Panel
		const rightCol = this.createPropertiesPanel();
		workArea.appendChild(rightCol);

		shell.appendChild(workArea);

		// 3. Timeline Horizontal Splitter
		if (!this.isTimelineCollapsed) {
			const timeSplitter = document.createElement("div");
			timeSplitter.className = "viper-studio-splitter-h";
			timeSplitter.onmousedown = (e) => this.startResizeTimeline(e);
			shell.appendChild(timeSplitter);
		}

		// 4. Timeline Dock
		shell.appendChild(this.createTimelineDock());

		// 5. Status Bar
		shell.appendChild(this.createStatusBar());

		this.container.appendChild(shell);

		// Initialize resize observer for auto-fit
		requestAnimationFrame(() => {
			this.recalculateCanvasFit();
			window.addEventListener("resize", () => this.recalculateCanvasFit(), { passive: true });
		});

		this.updateAll();
	}

	// --- 1. TOP BAR PREMIUM ---
	private createTopBar(): HTMLElement {
		const bar = document.createElement("div");
		bar.className = "studio-top-bar";
		bar.style.cssText = `
			height: 44px;
			background: ${StudioTokens.colors.surface1};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 12px;
			user-select: none;
			gap: 8px;
			z-index: 30;
		`;

		// LEFT SECTION: Mode switch & Breadcrumbs
		const leftSec = document.createElement("div");
		leftSec.style.cssText = "display: flex; align-items: center; gap: 8px;";

		const modeToggleBtn = document.createElement("button");
		modeToggleBtn.type = "button";
		modeToggleBtn.title = this.isStudioExpanded ? "Volver al modo integrado" : "Expandir Studio a pantalla completa";
		modeToggleBtn.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			color: ${StudioTokens.colors.textSecondary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 4px 8px;
			border-radius: ${StudioTokens.radii.sm};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 500;
			transition: ${StudioTokens.transitions.fast};
		`;
		modeToggleBtn.innerHTML = `${renderStudioIcon(this.isStudioExpanded ? "minimize" : "maximize", 13)} <span>${this.isStudioExpanded ? "Integrado" : "Expandir"}</span>`;
		modeToggleBtn.onclick = () => {
			if (this.isStudioExpanded) this.collapseStudio();
			else this.expandStudio();
		};
		leftSec.appendChild(modeToggleBtn);

		const titleBadge = document.createElement("div");
		titleBadge.style.cssText = "display: flex; align-items: center; gap: 6px;";
		titleBadge.innerHTML = `
			<span style="font-size:${StudioTokens.typography.sizeSm}; font-weight:700; color:${StudioTokens.colors.accent}; letter-spacing:0.5px;">VIPER STUDIO</span>
			<span style="font-size:9px; font-weight:700; background:${StudioTokens.colors.accentMuted}; color:${StudioTokens.colors.accent}; padding:1px 5px; border-radius:3px; border:1px solid ${StudioTokens.colors.accentBorder};">PREMIUM</span>
		`;
		leftSec.appendChild(titleBadge);

		const modePill = document.createElement("span");
		modePill.style.cssText = `
			font-size: ${StudioTokens.typography.sizeXs};
			color: ${StudioTokens.colors.textSecondary};
			background: ${StudioTokens.colors.surface2};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.pill};
			max-width: 150px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		`;
		modePill.textContent = this.mode.name || "Modo Sin Nombre";
		leftSec.appendChild(modePill);

		const saveStatePill = document.createElement("div");
		saveStatePill.className = "studio-save-indicator";
		saveStatePill.style.cssText = `
			display: flex;
			align-items: center;
			gap: 5px;
			font-size: ${StudioTokens.typography.sizeXs};
			color: ${this.hasUnsavedChanges ? StudioTokens.colors.warning : StudioTokens.colors.success};
			padding: 2px 6px;
		`;
		saveStatePill.innerHTML = this.hasUnsavedChanges
			? `<span style="width:6px; height:6px; border-radius:50%; background:${StudioTokens.colors.warning};"></span> Modificado`
			: `${renderStudioIcon("check", 12, StudioTokens.colors.success)} Guardado`;
		leftSec.appendChild(saveStatePill);

		const saveBtn = document.createElement("button");
		saveBtn.type = "button";
		saveBtn.title = "Guardar cambios en el modo";
		saveBtn.style.cssText = `
			background: ${StudioTokens.colors.accent};
			color: #090b0e;
			border: none;
			padding: 4px 10px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 5px;
			transition: ${StudioTokens.transitions.fast};
		`;
		saveBtn.innerHTML = `${renderStudioIcon("save", 13, "#090b0e")} <span>Guardar</span>`;
		saveBtn.onclick = () => {
			this.hasUnsavedChanges = false;
			this.onSync();
			this.updateSaveIndicator();
		};
		leftSec.appendChild(saveBtn);

		bar.appendChild(leftSec);

		// CENTER SECTION: Direct Tools & Layout Presets
		const centerSec = document.createElement("div");
		centerSec.style.cssText = "display: flex; align-items: center; gap: 8px;";

		// Layout presets
		const layoutGroup = document.createElement("div");
		layoutGroup.style.cssText = `display: flex; background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; border-radius: ${StudioTokens.radii.sm}; padding: 2px;`;

		const layouts = [
			{ id: "design", label: "Diseño", icon: "layout" },
			{ id: "timeline", label: "Timeline", icon: "timeline" },
			{ id: "canvas", label: "Canvas Full", icon: "maximize" },
		];

		layouts.forEach((lay) => {
			const b = document.createElement("button");
			b.type = "button";
			b.title = `Distribución ${lay.label}`;
			b.style.cssText = `
				background: transparent;
				border: none;
				color: ${StudioTokens.colors.textSecondary};
				padding: 3px 8px;
				font-size: ${StudioTokens.typography.sizeSm};
				border-radius: ${StudioTokens.radii.xs};
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 5px;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.innerHTML = `${renderStudioIcon(lay.icon as any, 13)} <span>${lay.label}</span>`;
			b.onmouseenter = () => (b.style.color = StudioTokens.colors.textPrimary);
			b.onmouseleave = () => (b.style.color = StudioTokens.colors.textSecondary);
			b.onclick = () => this.setLayoutPreset(lay.id as any);
			layoutGroup.appendChild(b);
		});
		centerSec.appendChild(layoutGroup);

		// Canvas Tools (Select, Pan)
		const toolGroup = document.createElement("div");
		toolGroup.style.cssText = `display: flex; background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; border-radius: ${StudioTokens.radii.sm}; padding: 2px;`;

		const selectToolBtn = document.createElement("button");
		selectToolBtn.type = "button";
		selectToolBtn.title = "Herramienta Selección (V)";
		selectToolBtn.style.cssText = `
			background: ${this.activeCanvasTool === "select" ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.activeCanvasTool === "select" ? StudioTokens.colors.accent : "transparent"};
			color: ${this.activeCanvasTool === "select" ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.xs};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: ${StudioTokens.typography.sizeSm};
		`;
		selectToolBtn.innerHTML = `${renderStudioIcon("cursor", 13)} <span>Seleccionar</span>`;
		selectToolBtn.onclick = () => {
			this.activeCanvasTool = "select";
			this.updateCanvasToolUI();
		};

		const handToolBtn = document.createElement("button");
		handToolBtn.type = "button";
		handToolBtn.title = "Herramienta Mano / Desplazar (H / Espacio)";
		handToolBtn.style.cssText = `
			background: ${this.activeCanvasTool === "hand" ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.activeCanvasTool === "hand" ? StudioTokens.colors.accent : "transparent"};
			color: ${this.activeCanvasTool === "hand" ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.xs};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: ${StudioTokens.typography.sizeSm};
		`;
		handToolBtn.innerHTML = `${renderStudioIcon("hand", 13)} <span>Mover</span>`;
		handToolBtn.onclick = () => {
			this.activeCanvasTool = "hand";
			this.updateCanvasToolUI();
		};

		toolGroup.append(selectToolBtn, handToolBtn);
		centerSec.appendChild(toolGroup);

		bar.appendChild(centerSec);

		// RIGHT SECTION: Fast Add + Undo/Redo
		const rightSec = document.createElement("div");
		rightSec.style.cssText = "display: flex; align-items: center; gap: 6px;";

		const makeQuickAddBtn = (iconName: any, label: string, type: DeathScreenElementType, shapeType?: DeathScreenShapeType) => {
			const b = document.createElement("button");
			b.type = "button";
			b.title = `Añadir ${label}`;
			b.style.cssText = `
				background: ${StudioTokens.colors.surface2};
				border: 1px solid ${StudioTokens.colors.borderSubtle};
				color: ${StudioTokens.colors.textSecondary};
				padding: 3px 7px;
				border-radius: ${StudioTokens.radii.sm};
				font-size: ${StudioTokens.typography.sizeSm};
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 4px;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.innerHTML = `${renderStudioIcon(iconName, 13)} <span>${label}</span>`;
			b.onmouseenter = () => {
				b.style.color = StudioTokens.colors.textPrimary;
				b.style.borderColor = StudioTokens.colors.borderNormal;
			};
			b.onmouseleave = () => {
				b.style.color = StudioTokens.colors.textSecondary;
				b.style.borderColor = StudioTokens.colors.borderSubtle;
			};
			b.onclick = () => {
				this.addElement(type, `Nuevo ${label}`, shapeType);
			};
			return b;
		};

		rightSec.appendChild(makeQuickAddBtn("type", "Texto", "title"));
		rightSec.appendChild(makeQuickAddBtn("square", "Forma", "shape", "rectangle"));
		rightSec.appendChild(makeQuickAddBtn("crosshair", "Killfeed", "killfeed"));
		rightSec.appendChild(makeQuickAddBtn("loader", "Respawn", "progress_bar"));

		// Undo / Redo
		const undoBtn = document.createElement("button");
		undoBtn.type = "button";
		undoBtn.title = "Deshacer (Ctrl+Z)";
		undoBtn.style.cssText = `background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; color: ${StudioTokens.colors.textSecondary}; padding: 4px 7px; border-radius: ${StudioTokens.radii.sm}; cursor: pointer;`;
		undoBtn.innerHTML = renderStudioIcon("undo", 13);
		undoBtn.onclick = () => this.undo();

		const redoBtn = document.createElement("button");
		redoBtn.type = "button";
		redoBtn.title = "Rehacer (Ctrl+Y)";
		redoBtn.style.cssText = `background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; color: ${StudioTokens.colors.textSecondary}; padding: 4px 7px; border-radius: ${StudioTokens.radii.sm}; cursor: pointer;`;
		redoBtn.innerHTML = renderStudioIcon("redo", 13);
		redoBtn.onclick = () => this.redo();

		rightSec.append(undoBtn, redoBtn);

		bar.appendChild(rightSec);
		return bar;
	}

	private updateCanvasToolUI() {
		if (this.canvasWrapper) {
			this.canvasWrapper.style.cursor = this.activeCanvasTool === "hand" ? "grab" : "default";
		}
		if (this.container) {
			const selectBtn = this.container.querySelector('button[title*="Selección"]') as HTMLElement;
			const handBtn = this.container.querySelector('button[title*="Mano"]') as HTMLElement;
			if (selectBtn && handBtn) {
				const isSel = this.activeCanvasTool === "select";
				selectBtn.style.borderColor = isSel ? StudioTokens.colors.accent : "transparent";
				selectBtn.style.background = isSel ? StudioTokens.colors.surfaceActive : "transparent";
				selectBtn.style.color = isSel ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;

				handBtn.style.borderColor = !isSel ? StudioTokens.colors.accent : "transparent";
				handBtn.style.background = !isSel ? StudioTokens.colors.surfaceActive : "transparent";
				handBtn.style.color = !isSel ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
			}
		}
		this.updateStatusBar();
	}

	// --- 2. LEFT PANEL PREMIUM ---
	private createLeftPanel(): HTMLElement {
		const panel = document.createElement("div");
		panel.className = "death-screen-editor-left-sidebar";
		panel.style.cssText = `
			width: ${this.leftPanelWidth}px;
			background: ${StudioTokens.colors.surface1};
			border-right: 1px solid ${StudioTokens.colors.borderSubtle};
			display: ${this.isLeftPanelCollapsed ? "none" : "flex"};
			flex-direction: column;
			overflow: hidden;
			z-index: 10;
		`;

		// Tabs (Capas, Elementos, Fondos, Prefabs)
		const tabsBar = document.createElement("div");
		tabsBar.style.cssText = `
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			background: ${StudioTokens.colors.surface2};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			padding: 2px;
			gap: 2px;
		`;

		const tabs = [
			{ id: "layers", label: "Capas", icon: "layers" },
			{ id: "elements", label: "Elementos", icon: "box" },
			{ id: "backgrounds", label: "Fondos", icon: "palette" },
			{ id: "assets", label: "Prefabs", icon: "component" },
		];

		tabs.forEach((t) => {
			const b = document.createElement("button");
			b.type = "button";
			b.title = t.label;
			const isA = this.activeLeftTab === t.id;
			b.style.cssText = `
				padding: 6px 2px;
				font-size: ${StudioTokens.typography.sizeXs};
				font-weight: 500;
				background: ${isA ? StudioTokens.colors.surface3 : "transparent"};
				color: ${isA ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
				border: 1px solid ${isA ? StudioTokens.colors.borderNormal : "transparent"};
				border-radius: ${StudioTokens.radii.xs};
				cursor: pointer;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 3px;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.innerHTML = `${renderStudioIcon(t.icon as any, 14, isA ? StudioTokens.colors.accent : "currentColor")} <span>${t.label}</span>`;
			b.onclick = () => {
				this.activeLeftTab = t.id as any;
				this.updateLayersList();
			};
			tabsBar.appendChild(b);
		});
		panel.appendChild(tabsBar);

		// Dynamic Container
		this.layersListEl = document.createElement("div");
		this.layersListEl.className = "custom-scrollbar";
		this.layersListEl.style.cssText = "flex: 1; overflow-y: auto; display: flex; flex-direction: column;";
		panel.appendChild(this.layersListEl);

		return panel;
	}

	private updateLayersList() {
		if (!this.layersListEl) return;
		this.layersListEl.innerHTML = "";

		if (this.activeLeftTab === "layers") {
			this.renderLayersTree();
		} else if (this.activeLeftTab === "elements") {
			this.renderElementsCatalog();
		} else if (this.activeLeftTab === "backgrounds") {
			this.renderBackgroundsManagerTab();
		} else if (this.activeLeftTab === "assets") {
			this.renderCustomComponentsTab();
		}
	}

	private renderLayersTree() {
		const searchWrap = document.createElement("div");
		searchWrap.style.cssText = `padding: 8px 10px; background: ${StudioTokens.colors.surface1}; border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};`;

		const searchInput = document.createElement("input");
		searchInput.type = "text";
		searchInput.placeholder = "Buscar capa...";
		searchInput.value = this.layerSearchQuery;
		searchInput.style.cssText = `
			width: 100%;
			background: ${StudioTokens.colors.surface2};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			padding: 4px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			outline: none;
		`;
		searchInput.oninput = () => {
			this.layerSearchQuery = searchInput.value.toLowerCase();
			this.renderLayersTree();
		};
		searchWrap.appendChild(searchInput);
		this.layersListEl!.appendChild(searchWrap);

		const list = document.createElement("div");
		list.style.cssText = "flex: 1; overflow-y: auto; padding: 4px 6px; display: flex; flex-direction: column; gap: 2px;";

		const elems = this.screen.elements || [];
		const sorted = [...elems].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

		sorted.forEach((elem) => {
			if (this.layerSearchQuery && !elem.name.toLowerCase().includes(this.layerSearchQuery)) return;

			const isSelected = this.selectedElementIds.has(elem.id);
			const row = document.createElement("div");
			row.style.cssText = `
				padding: 5px 8px;
				display: flex;
				align-items: center;
				justify-content: space-between;
				background: ${isSelected ? StudioTokens.colors.surfaceActive : "transparent"};
				border: 1px solid ${isSelected ? StudioTokens.colors.accentBorder : "transparent"};
				border-radius: ${StudioTokens.radii.sm};
				cursor: pointer;
				transition: ${StudioTokens.transitions.fast};
			`;
			row.onmouseenter = () => {
				if (!isSelected) row.style.background = StudioTokens.colors.surface3;
			};
			row.onmouseleave = () => {
				if (!isSelected) row.style.background = "transparent";
			};
			row.onclick = (e) => {
				this.selectElement(elem.id, e.shiftKey || e.ctrlKey);
			};

			const left = document.createElement("div");
			left.style.cssText = "display: flex; align-items: center; gap: 6px; overflow: hidden;";

			const typeIcon = document.createElement("span");
			typeIcon.innerHTML = renderStudioIcon(
				elem.type === "title" ? "type" : (elem.type === "shape" ? "square" : (elem.type === "crosshair" || elem.type === "killfeed" ? "crosshair" : "box")),
				13,
				isSelected ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary
			);
			left.appendChild(typeIcon);

			const nameSpan = document.createElement("span");
			nameSpan.textContent = elem.name;
			nameSpan.style.cssText = `
				font-size: ${StudioTokens.typography.sizeSm};
				color: ${isSelected ? StudioTokens.colors.textPrimary : StudioTokens.colors.textSecondary};
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			`;
			left.appendChild(nameSpan);

			const right = document.createElement("div");
			right.style.cssText = "display: flex; align-items: center; gap: 4px;";

			// Visibility toggle
			const eyeBtn = document.createElement("button");
			eyeBtn.type = "button";
			eyeBtn.style.cssText = "background:none; border:none; cursor:pointer; padding:2px; color:#6b7280;";
			eyeBtn.innerHTML = renderStudioIcon(elem.visible === false ? "eye-off" : "eye", 12);
			eyeBtn.onclick = (e) => {
				e.stopPropagation();
				this.recordHistory();
				elem.visible = elem.visible === false ? true : false;
				this.onSync();
				this.updateCanvas();
				this.renderLayersTree();
			};

			// Lock toggle
			const lockBtn = document.createElement("button");
			lockBtn.type = "button";
			lockBtn.style.cssText = "background:none; border:none; cursor:pointer; padding:2px; color:#6b7280;";
			lockBtn.innerHTML = renderStudioIcon(elem.locked ? "lock" : "unlock", 12);
			lockBtn.onclick = (e) => {
				e.stopPropagation();
				this.recordHistory();
				elem.locked = !elem.locked;
				this.onSync();
				this.updateCanvas();
				this.renderLayersTree();
			};

			// Delete
			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.style.cssText = "background:none; border:none; cursor:pointer; padding:2px; color:#6b7280;";
			delBtn.innerHTML = renderStudioIcon("trash", 12);
			delBtn.onclick = (e) => {
				e.stopPropagation();
				this.removeElement(elem.id);
			};

			right.append(eyeBtn, lockBtn, delBtn);
			row.append(left, right);
			list.appendChild(row);
		});

		this.layersListEl!.appendChild(list);
	}

	private renderElementsCatalog() {
		const searchWrap = document.createElement("div");
		searchWrap.style.cssText = `padding: 8px 10px; background: ${StudioTokens.colors.surface1}; border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};`;

		const searchInput = document.createElement("input");
		searchInput.type = "text";
		searchInput.placeholder = "Buscar elemento...";
		searchInput.value = this.elementSearchQuery;
		searchInput.style.cssText = `
			width: 100%;
			background: ${StudioTokens.colors.surface2};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			padding: 4px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			outline: none;
		`;
		searchInput.oninput = () => {
			this.elementSearchQuery = searchInput.value.toLowerCase();
			this.renderElementsCatalog();
		};
		searchWrap.appendChild(searchInput);
		this.layersListEl!.appendChild(searchWrap);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 14px;";

		const categories = [
			{
				title: "TIPOGRAFÍA Y TEXTOS",
				items: [
					{ n: "Título Principal", t: "title", icon: "type" },
					{ n: "Subtítulo / Mensaje", t: "subtitle", icon: "type" },
					{ n: "Texto Libre / Lore", t: "text", icon: "type" },
					{ n: "Insignia / Badge Táctica", t: "badge", icon: "badge" },
					{ n: "Registro de Bajas (Killfeed)", t: "killfeed", icon: "crosshair" },
				],
			},
			{
				title: "FORMAS Y MARCOS",
				items: [
					{ n: "Tarjeta Contenedor (Glass)", t: "card", icon: "square" },
					{ n: "Marco Táctico Agrupador", t: "container", icon: "layout" },
					{ n: "Rectángulo Sólido", t: "shape", s: "rectangle", icon: "square" },
					{ n: "Círculo / Diana", t: "shape", s: "circle", icon: "circle" },
					{ n: "Píldora / Tag", t: "shape", s: "pill", icon: "badge" },
					{ n: "Triángulo Táctico", t: "shape", s: "triangle", icon: "triangle" },
					{ n: "Hexágono Militar", t: "shape", s: "hexagon", icon: "shield" },
					{ n: "Estrella de Rango", t: "shape", s: "star", icon: "star" },
					{ n: "Flecha Direccional", t: "shape", s: "arrow", icon: "arrow-right" },
					{ n: "Esquina Decorativa", t: "shape", s: "corner", icon: "crop" },
					{ n: "Línea Separadora", t: "divider", icon: "sliders" },
				],
			},
			{
				title: "GAMEPLAY Y TELEMETRÍA",
				items: [
					{ n: "Ficha del Asesino", t: "killer_info", icon: "crosshair" },
					{ n: "Estadísticas y Causa", t: "stats", icon: "sliders" },
					{ n: "Vidas Restantes", t: "lives", icon: "shield" },
					{ n: "Cuenta Regresiva", t: "countdown", icon: "timeline" },
					{ n: "Botón de Acción", t: "action_button", icon: "check" },
					{ n: "Barra de Progreso", t: "progress_bar", icon: "loader" },
					{ n: "Efecto / Superposición", t: "effect_overlay", icon: "sparkles" },
				],
			},
		];

		categories.forEach((cat) => {
			const filtered = cat.items.filter((i) => !this.elementSearchQuery || i.n.toLowerCase().includes(this.elementSearchQuery));
			if (filtered.length === 0) return;

			const section = document.createElement("div");
			section.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

			const header = document.createElement("span");
			header.textContent = cat.title;
			header.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; font-weight: 700; color: ${StudioTokens.colors.accent}; letter-spacing: 0.5px;`;
			section.appendChild(header);

			const grid = document.createElement("div");
			grid.style.cssText = "display: grid; grid-template-columns: repeat(2, 1fr); grid-gap: 6px;";

			filtered.forEach((item) => {
				const card = document.createElement("div");
				card.draggable = true;
				card.style.cssText = `
					background: ${StudioTokens.colors.surface2};
					border: 1px solid ${StudioTokens.colors.borderSubtle};
					border-radius: ${StudioTokens.radii.sm};
					padding: 8px 6px;
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					gap: 4px;
					cursor: grab;
					transition: ${StudioTokens.transitions.fast};
				`;
				card.ondragstart = (e) => {
					e.dataTransfer?.setData("text/plain", JSON.stringify({ type: item.t, shapeType: item.s, name: item.n }));
				};
				card.onmouseenter = () => {
					card.style.borderColor = StudioTokens.colors.accent;
					card.style.background = StudioTokens.colors.surface3;
				};
				card.onmouseleave = () => {
					card.style.borderColor = StudioTokens.colors.borderSubtle;
					card.style.background = StudioTokens.colors.surface2;
				};
				card.onclick = () => {
					this.addElement(item.t as any, item.n, item.s as any);
				};

				const iconEl = document.createElement("span");
				iconEl.innerHTML = renderStudioIcon(item.icon as any, 16, StudioTokens.colors.textSecondary);

				const nameEl = document.createElement("span");
				nameEl.textContent = item.n;
				nameEl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textPrimary}; line-height: 1.2;`;

				card.append(iconEl, nameEl);
				grid.appendChild(card);
			});

			section.appendChild(grid);
			scroll.appendChild(section);
		});

		this.layersListEl!.appendChild(scroll);
	}

	private renderBackgroundsManagerTab() {
		if (!this.layersListEl) return;
		this.backgroundManager.renderSidebarPanel(
			this.layersListEl,
			this.screen.background || {},
			(newBg) => {
				this.recordHistory();
				this.screen.background = newBg;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateCanvas();
			}
		);
	}

	private renderCustomComponentsTab() {
		const wrap = document.createElement("div");
		wrap.style.cssText = "flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;";

		const createBtn = document.createElement("button");
		createBtn.type = "button";
		createBtn.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			border: 1px dashed ${StudioTokens.colors.accent};
			color: ${StudioTokens.colors.accent};
			padding: 8px 10px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			transition: ${StudioTokens.transitions.fast};
		`;
		createBtn.innerHTML = `${renderStudioIcon("plus", 14, StudioTokens.colors.accent)} <span>Crear desde Selección</span>`;
		createBtn.onclick = () => this.createCustomComponentFromSelection();
		wrap.appendChild(createBtn);

		const list = document.createElement("div");
		list.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

		this.customComponents.forEach((comp) => {
			const card = document.createElement("div");
			card.draggable = true;
			card.style.cssText = `
				background: ${StudioTokens.colors.surface2};
				border: 1px solid ${StudioTokens.colors.borderSubtle};
				border-radius: ${StudioTokens.radii.md};
				padding: 10px;
				display: flex;
				flex-direction: column;
				gap: 4px;
				cursor: grab;
				transition: ${StudioTokens.transitions.fast};
			`;
			card.ondragstart = (e) => {
				e.dataTransfer?.setData("text/plain", JSON.stringify({ customComponentId: comp.id }));
			};
			card.onmouseenter = () => (card.style.borderColor = StudioTokens.colors.accent);
			card.onmouseleave = () => (card.style.borderColor = StudioTokens.colors.borderSubtle);
			card.onclick = () => this.instantiateCustomComponent(comp.id, 50, 50);

			const top = document.createElement("div");
			top.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
			top.innerHTML = `
				<div style="display:flex; align-items:center; gap:6px;">
					${renderStudioIcon((comp.icon || "component") as any, 14, StudioTokens.colors.accent)}
					<strong style="font-size:${StudioTokens.typography.sizeSm}; color:${StudioTokens.colors.textPrimary};">${comp.name}</strong>
				</div>
				<span style="font-size:10px; color:${StudioTokens.colors.textMuted};">${comp.elements.length} elems</span>
			`;

			const desc = document.createElement("span");
			desc.textContent = comp.description || "Componente reutilizable";
			desc.style.cssText = `font-size: 11px; color: ${StudioTokens.colors.textSecondary};`;

			card.append(top, desc);
			list.appendChild(card);
		});

		wrap.appendChild(list);
		this.layersListEl!.appendChild(wrap);
	}

	// --- 3. CENTER CANVAS COLUMN PREMIUM ---
	private createCanvasColumn(): HTMLElement {
		const col = document.createElement("div");
		col.style.cssText = "flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;";

		// Secondary Toolbar (Aspect ratio, Zoom, Snapping, Grid, Safe Area, Modes)
		const subBar = document.createElement("div");
		subBar.className = "studio-sub-bar";
		subBar.style.cssText = `
			height: 36px;
			background: ${StudioTokens.colors.surface1};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 12px;
			user-select: none;
			font-size: ${StudioTokens.typography.sizeSm};
			color: ${StudioTokens.colors.textSecondary};
			z-index: 25;
		`;

		// Left Controls: Aspect ratio, Backdrop selector, Zoom
		const leftC = document.createElement("div");
		leftC.style.cssText = "display: flex; align-items: center; gap: 8px;";

		const aspectSelect = document.createElement("select");
		aspectSelect.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 2px 6px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
		`;
		[
			{ v: "desktop", t: "16:9 1080p" },
			{ v: "ultrawide", t: "21:9 Ultrawide" },
			{ v: "tablet", t: "4:3 Tablet" },
			{ v: "mobile", t: "9:16 Vertical" },
		].forEach((opt) => {
			const o = document.createElement("option");
			o.value = opt.v;
			o.textContent = opt.t;
			if (this.previewDevice === opt.v) o.selected = true;
			aspectSelect.appendChild(o);
		});
		aspectSelect.onchange = () => {
			this.previewDevice = aspectSelect.value as any;
			this.recalculateCanvasFit();
		};
		leftC.appendChild(aspectSelect);

		// Reference Backdrop selector
		const bgSelect = document.createElement("select");
		bgSelect.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 2px 6px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
		`;
		[
			{ v: "dark", t: "Fondo Oscuro" },
			{ v: "checker", t: "Transparencia" },
			{ v: "cyberpunk", t: "Escenario Ciberpunk" },
			{ v: "hangar", t: "Hangar Espacial" },
		].forEach((bg) => {
			const opt = document.createElement("option");
			opt.value = bg.v;
			opt.textContent = bg.t;
			if (this.canvasBackdropMode === bg.v) opt.selected = true;
			bgSelect.appendChild(opt);
		});
		bgSelect.onchange = () => {
			this.canvasBackdropMode = bgSelect.value as any;
			this.updateCanvas();
		};
		leftC.appendChild(bgSelect);

		// Zoom controls
		const zoomGroup = document.createElement("div");
		zoomGroup.style.cssText = `display: flex; align-items: center; background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; border-radius: ${StudioTokens.radii.sm};`;
		const zoomOut = document.createElement("button");
		zoomOut.type = "button";
		zoomOut.style.cssText = "background:none; border:none; color:#888; padding:2px 6px; cursor:pointer;";
		zoomOut.innerHTML = renderStudioIcon("zoom-out", 12);
		zoomOut.onclick = () => {
			this.zoomLevel = Math.max(0.25, this.zoomLevel - 0.1);
			this.recalculateCanvasFit();
		};
		const zoomFit = document.createElement("button");
		zoomFit.type = "button";
		zoomFit.style.cssText = "background:none; border:none; color:#ccc; padding:2px 6px; font-size:10px; cursor:pointer;";
		zoomFit.textContent = "Fit";
		zoomFit.onclick = () => {
			this.zoomLevel = 1.0;
			this.canvasPanX = 0;
			this.canvasPanY = 0;
			this.recalculateCanvasFit();
		};
		const zoomIn = document.createElement("button");
		zoomIn.type = "button";
		zoomIn.style.cssText = "background:none; border:none; color:#888; padding:2px 6px; cursor:pointer;";
		zoomIn.innerHTML = renderStudioIcon("zoom-in", 12);
		zoomIn.onclick = () => {
			this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.1);
			this.recalculateCanvasFit();
		};
		zoomGroup.append(zoomOut, zoomFit, zoomIn);
		leftC.appendChild(zoomGroup);

		subBar.appendChild(leftC);

		// Center Controls: Workspace Modes
		const modeGroup = document.createElement("div");
		modeGroup.style.cssText = `display: flex; background: ${StudioTokens.colors.surface2}; border: 1px solid ${StudioTokens.colors.borderSubtle}; border-radius: ${StudioTokens.radii.sm}; padding: 2px;`;

		const modes = [
			{ id: "design", label: "Diseñar", icon: "layout" },
			{ id: "animate", label: "Animar", icon: "sparkles" },
			{ id: "test", label: "Probar", icon: "play" },
		];

		modes.forEach((m) => {
			const b = document.createElement("button");
			b.type = "button";
			const isA = this.activeWorkspaceMode === m.id;
			b.style.cssText = `
				background: ${isA ? StudioTokens.colors.accent : "transparent"};
				color: ${isA ? "#090b0e" : StudioTokens.colors.textSecondary};
				border: none;
				padding: 3px 10px;
				font-size: ${StudioTokens.typography.sizeSm};
				font-weight: 600;
				border-radius: ${StudioTokens.radii.xs};
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 5px;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.innerHTML = `${renderStudioIcon(m.icon as any, 12, isA ? "#090b0e" : "currentColor")} <span>${m.label}</span>`;
			b.onclick = () => this.setWorkspaceMode(m.id as any);
			modeGroup.appendChild(b);
		});
		subBar.appendChild(modeGroup);

		// Right Controls: Safe Area, Grid, Snapping
		const rightC = document.createElement("div");
		rightC.style.cssText = "display: flex; align-items: center; gap: 8px;";

		const snapBtn = document.createElement("button");
		snapBtn.type = "button";
		snapBtn.title = "Ajuste Inteligente (Snapping)";
		snapBtn.style.cssText = `
			background: ${this.smartSnappingEnabled ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.smartSnappingEnabled ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
			color: ${this.smartSnappingEnabled ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 6px;
			border-radius: ${StudioTokens.radii.xs};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
		`;
		snapBtn.innerHTML = `${renderStudioIcon("magnet", 12)} <span>Ajuste</span>`;
		snapBtn.onclick = () => {
			this.smartSnappingEnabled = !this.smartSnappingEnabled;
			this.render(this.container!);
		};

		const gridBtn = document.createElement("button");
		gridBtn.type = "button";
		gridBtn.title = "Cuadrícula Guía";
		gridBtn.style.cssText = `
			background: ${this.showGrid ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.showGrid ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
			color: ${this.showGrid ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 6px;
			border-radius: ${StudioTokens.radii.xs};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
		`;
		gridBtn.innerHTML = `${renderStudioIcon("grid", 12)} <span>Cuadrícula</span>`;
		gridBtn.onclick = () => {
			this.showGrid = !this.showGrid;
			if (this.gridOverlayEl) this.gridOverlayEl.style.display = this.showGrid ? "block" : "none";
			gridBtn.style.borderColor = this.showGrid ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle;
			gridBtn.style.color = this.showGrid ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
		};

		const safeBtn = document.createElement("button");
		safeBtn.type = "button";
		safeBtn.title = "Área Segura 90%";
		safeBtn.style.cssText = `
			background: ${this.showSafeArea ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.showSafeArea ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
			color: ${this.showSafeArea ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 6px;
			border-radius: ${StudioTokens.radii.xs};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
		`;
		safeBtn.innerHTML = `${renderStudioIcon("shield", 12)} <span>Safe Area</span>`;
		safeBtn.onclick = () => {
			this.showSafeArea = !this.showSafeArea;
			if (this.safeAreaEl) this.safeAreaEl.style.display = this.showSafeArea ? "block" : "none";
			safeBtn.style.borderColor = this.showSafeArea ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle;
			safeBtn.style.color = this.showSafeArea ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
		};

		rightC.append(snapBtn, gridBtn, safeBtn);
		subBar.appendChild(rightC);

		col.appendChild(subBar);

		// Canvas Viewport & Wrapper
		this.canvasViewport = document.createElement("div");
		this.canvasViewport.className = "studio-canvas-viewport";
		this.canvasViewport.style.cssText = "flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #07090c;";

		this.canvasWrapper = document.createElement("div");
		this.canvasWrapper.className = "studio-canvas-wrapper";
		this.canvasWrapper.style.cssText = "position: relative; transition: transform 0.05s ease-out;";

		// Pan & Zoom events
		this.canvasViewport.onmousedown = (e) => {
			if (e.button === 1 || this.activeCanvasTool === "hand" || e.spaceKey) {
				this.isPanning = true;
				this.panStartX = e.clientX - this.canvasPanX;
				this.panStartY = e.clientY - this.canvasPanY;
				if (this.canvasViewport) this.canvasViewport.style.cursor = "grabbing";
				e.preventDefault();
				return;
			}
			if (e.target === this.canvasViewport || e.target === this.canvasWrapper) {
				this.selectElement(null);
				this.startMarqueeSelection(e);
			}
		};

		window.addEventListener("mousemove", (e) => {
			if (this.isPanning && this.canvasWrapper) {
				this.canvasPanX = e.clientX - this.panStartX;
				this.canvasPanY = e.clientY - this.panStartY;
				this.recalculateCanvasFit();
			}
		});

		window.addEventListener("mouseup", () => {
			if (this.isPanning) {
				this.isPanning = false;
				if (this.canvasViewport) {
					this.canvasViewport.style.cursor = this.activeCanvasTool === "hand" ? "grab" : "default";
				}
			}
		});

		// Wheel Zoom
		this.canvasViewport.onwheel = (e) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				const delta = e.deltaY < 0 ? 0.05 : -0.05;
				this.zoomLevel = Math.max(0.25, Math.min(3.0, this.zoomLevel + delta));
				this.recalculateCanvasFit();
			}
		};

		// The Core Scaled Canvas
		this.canvasEl = document.createElement("div");
		this.canvasEl.id = "viper-studio-canvas";
		this.canvasEl.style.cssText = `
			position: relative;
			background: #090b0e;
			border: 1px solid #1a2230;
			box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
			overflow: hidden;
			user-select: none;
		`;

		// Drag & Drop onto Canvas
		this.canvasEl.ondragover = (e) => e.preventDefault();
		this.canvasEl.ondrop = (e) => this.handleCanvasDrop(e);

		this.canvasWrapper.appendChild(this.canvasEl);
		this.canvasViewport.appendChild(this.canvasWrapper);
		col.appendChild(this.canvasViewport);

		return col;
	}

	private handleCanvasDrop(e: DragEvent) {
		e.preventDefault();
		if (!this.canvasEl) return;
		const raw = e.dataTransfer?.getData("text/plain");
		if (!raw) return;

		const rect = this.canvasEl.getBoundingClientRect();
		const dropX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
		const dropY = Math.round(((e.clientY - rect.top) / rect.height) * 100);

		try {
			const data = JSON.parse(raw);
			if (data.customComponentId) {
				this.instantiateCustomComponent(data.customComponentId, dropX, dropY);
				return;
			}
			if (data.type) {
				const elem = this.addElement(data.type, data.name, data.shapeType);
				elem.x = dropX;
				elem.y = dropY;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateAll();
			}
		} catch (err) {
			console.warn("Could not parse drag drop data", err);
		}
	}

	public recalculateCanvasFit() {
		if (!this.canvasViewport || !this.canvasEl || !this.canvasWrapper) return;

		const viewW = this.canvasViewport.clientWidth;
		const viewH = this.canvasViewport.clientHeight;
		if (viewW <= 0 || viewH <= 0) return;

		let targetAspect = 16 / 9;
		if (this.previewDevice === "ultrawide") targetAspect = 21 / 9;
		else if (this.previewDevice === "tablet") targetAspect = 4 / 3;
		else if (this.previewDevice === "mobile") targetAspect = 9 / 16;

		// Maximum utilization of viewport (>88%)
		const padding = 32;
		const availW = Math.max(100, viewW - padding * 2);
		const availH = Math.max(100, viewH - padding * 2);

		let canvasW = availW;
		let canvasH = canvasW / targetAspect;

		if (canvasH > availH) {
			canvasH = availH;
			canvasW = canvasH * targetAspect;
		}

		canvasW = Math.round(canvasW);
		canvasH = Math.round(canvasH);

		this.canvasEl.style.width = `${canvasW}px`;
		this.canvasEl.style.height = `${canvasH}px`;

		this.canvasWrapper.style.transform = `translate(${this.canvasPanX}px, ${this.canvasPanY}px) scale(${this.zoomLevel})`;
		this.updateStatusBar();
	}

	// --- 4. UPDATE CANVAS CONTENTS & GIZMOS ---
	public updateCanvas() {
		if (!this.canvasEl) return;
		this.canvasEl.innerHTML = "";

		// 1. Reference Backdrop
		this.canvasBgLayer = document.createElement("div");
		this.canvasBgLayer.className = "studio-canvas-backdrop";
		this.canvasBgLayer.style.cssText = "position: absolute; inset: 0; pointer-events: none; z-index: 0;";

		if (this.canvasBackdropMode === "checker") {
			this.canvasBgLayer.style.background = "repeating-conic-gradient(#141824 0% 25%, #0a0d14 0% 50%) 50% / 16px 16px";
		} else if (this.canvasBackdropMode === "cyberpunk") {
			this.canvasBgLayer.style.background = "linear-gradient(135deg, #091322 0%, #032030 45%, #2a0822 100%)";
		} else if (this.canvasBackdropMode === "hangar") {
			this.canvasBgLayer.style.background = "linear-gradient(180deg, #050b14 0%, #091a30 70%, #152233 100%)";
		} else {
			// Dark Studio / Screen Background
			const bg = this.screen.background;
			if (bg && bg.type === "image" && bg.imageUrl) {
				this.canvasBgLayer.style.backgroundImage = `url("${bg.imageUrl}")`;
				this.canvasBgLayer.style.backgroundSize = bg.imageFit || "cover";
				this.canvasBgLayer.style.backgroundPosition = bg.imagePosition || "center";
			} else if (bg && bg.type === "gradient" && bg.gradient) {
				this.canvasBgLayer.style.background = bg.gradient;
			} else {
				this.canvasBgLayer.style.background = this.screen.backgroundColor || "#090b0e";
			}
		}
		this.canvasEl.appendChild(this.canvasBgLayer);

		// Background overlay tint for text readability
		const overlayEl = document.createElement("div");
		overlayEl.style.cssText = `
			position: absolute;
			inset: 0;
			background: ${this.screen.background?.overlayColor || "rgba(0,0,0,0.4)"};
			opacity: ${this.screen.background?.overlayOpacity ?? 0.4};
			pointer-events: none;
			z-index: 1;
		`;
		this.canvasEl.appendChild(overlayEl);

		// 2. Safe Area Box
		this.safeAreaEl = document.createElement("div");
		this.safeAreaEl.style.cssText = `
			position: absolute;
			top: 5%;
			left: 5%;
			width: 90%;
			height: 90%;
			border: 1px dashed rgba(0, 210, 255, 0.25);
			pointer-events: none;
			z-index: 2;
			display: ${this.showSafeArea ? "block" : "none"};
		`;
		this.canvasEl.appendChild(this.safeAreaEl);

		// 3. Grid Overlay
		this.gridOverlayEl = document.createElement("div");
		this.gridOverlayEl.style.cssText = `
			position: absolute;
			inset: 0;
			background-size: 20px 20px;
			background-image: linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
			pointer-events: none;
			z-index: 3;
			display: ${this.showGrid ? "block" : "none"};
		`;
		this.canvasEl.appendChild(this.gridOverlayEl);

		// 4. Render Death Screen Elements
		const elements = this.screen.elements || [];
		const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

		sorted.forEach((elem) => {
			if (elem.visible === false) return;

			const node = document.createElement("div");
			node.dataset.elementId = elem.id;
			const isSelected = this.selectedElementIds.has(elem.id);
			const s = elem.style || {};

			node.style.cssText = `
				position: absolute;
				left: ${elem.x}%;
				top: ${elem.y}%;
				width: ${elem.width}%;
				height: ${elem.height}%;
				transform: translate(-50%, -50%) rotate(${s.rotation || 0}deg) scale(${s.scaleX || 1}, ${s.scaleY || 1});
				transform-origin: ${s.transformOrigin || "center center"};
				mix-blend-mode: ${s.blendMode || "normal"};
				opacity: ${s.opacity ?? 1};
				z-index: ${elem.zIndex || 10};
				box-sizing: border-box;
				cursor: ${this.activeCanvasTool === "hand" ? "grab" : (elem.locked ? "default" : "move")};
			`;

			if (s.backgroundColor) node.style.backgroundColor = s.backgroundColor;
			if (s.borderColor) node.style.borderColor = s.borderColor;
			if (s.borderWidth) node.style.borderWidth = `${s.borderWidth}px`;
			if (s.borderStyle) node.style.borderStyle = s.borderStyle;
			if (s.borderRadius) node.style.borderRadius = `${s.borderRadius}px`;
			if (s.boxShadow) node.style.boxShadow = s.boxShadow;
			if (s.backdropBlur) node.style.backdropFilter = `blur(${s.backdropBlur}px)`;
			if (s.color) node.style.color = s.color;
			if (s.fontSize) node.style.fontSize = `${s.fontSize}px`;
			if (s.fontWeight) node.style.fontWeight = String(s.fontWeight);
			if (s.fontFamily) node.style.fontFamily = s.fontFamily;
			if (s.textAlign) node.style.textAlign = s.textAlign;
			if (s.letterSpacing) node.style.letterSpacing = `${s.letterSpacing}px`;

			// Content evaluation
			let rawContent = elem.text || elem.content || "";
			if (!rawContent && elem.type === "title") rawContent = this.screen.title || "HAS MUERTO";
			if (!rawContent && elem.type === "subtitle") rawContent = this.screen.subtitle || "Volviendo al punto de inicio...";
			node.textContent = evaluateDynamicTokens(rawContent, {
				killerName: "Fantasma_99",
				killerWeapon: "Cañón Riel MK-II",
				killerClan: "APEX",
				cause: "Daño letal",
				countdown: "0.0",
				headshot: "SÍ",
				remainingRespawns: 0,
			});

			// Direct Element Interaction Events
			node.onmousedown = (e) => {
				if (this.activeCanvasTool === "hand") return;
				e.stopPropagation();
				if (!elem.locked) {
					this.startElementDrag(e, elem);
				}
			};

			node.oncontextmenu = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.showContextMenu(e.clientX, e.clientY, elem);
			};

			this.canvasEl!.appendChild(node);

			// Render Selection Gizmo if selected
			if (isSelected && this.activeWorkspaceMode !== "test") {
				this.renderElementGizmo(elem);
			}
		});
	}

	private renderElementGizmo(elem: DeathScreenElement) {
		if (!this.canvasEl) return;
		const s = elem.style || {};

		const gizmo = document.createElement("div");
		gizmo.className = "studio-element-gizmo";
		gizmo.style.cssText = `
			position: absolute;
			left: ${elem.x}%;
			top: ${elem.y}%;
			width: ${elem.width}%;
			height: ${elem.height}%;
			transform: translate(-50%, -50%) rotate(${s.rotation || 0}deg);
			transform-origin: ${s.transformOrigin || "center center"};
			border: 1px solid ${StudioTokens.colors.accent};
			box-shadow: 0 0 6px rgba(0, 210, 255, 0.4);
			pointer-events: none;
			z-index: 1000;
		`;

		// 8 Bounding Box Handles
		const handles = [
			{ h: "nw", x: 0, y: 0, cur: "nwse-resize" },
			{ h: "n", x: 50, y: 0, cur: "ns-resize" },
			{ h: "ne", x: 100, y: 0, cur: "nesw-resize" },
			{ h: "e", x: 100, y: 50, cur: "ew-resize" },
			{ h: "se", x: 100, y: 100, cur: "nwse-resize" },
			{ h: "s", x: 50, y: 100, cur: "ns-resize" },
			{ h: "sw", x: 0, y: 100, cur: "nesw-resize" },
			{ h: "w", x: 0, y: 50, cur: "ew-resize" },
		];

		handles.forEach((hd) => {
			const dot = document.createElement("div");
			dot.style.cssText = `
				position: absolute;
				left: ${hd.x}%;
				top: ${hd.y}%;
				width: 7px;
				height: 7px;
				background: #ffffff;
				border: 1px solid ${StudioTokens.colors.accent};
				border-radius: 1px;
				transform: translate(-50%, -50%);
				pointer-events: auto;
				cursor: ${hd.cur};
			`;
			dot.onmousedown = (e) => {
				e.stopPropagation();
				this.startElementResize(e, elem, hd.h);
			};
			gizmo.appendChild(dot);
		});

		// Rotation Handle & Stem
		const stem = document.createElement("div");
		stem.style.cssText = `
			position: absolute;
			left: 50%;
			top: -18px;
			width: 1px;
			height: 18px;
			background: ${StudioTokens.colors.accent};
			pointer-events: none;
		`;
		const rotHandle = document.createElement("div");
		rotHandle.style.cssText = `
			position: absolute;
			left: 50%;
			top: -22px;
			width: 9px;
			height: 9px;
			background: ${StudioTokens.colors.accent};
			border: 1px solid #ffffff;
			border-radius: 50%;
			transform: translate(-50%, -50%);
			pointer-events: auto;
			cursor: grab;
		`;
		rotHandle.onmousedown = (e) => {
			e.stopPropagation();
			this.startElementRotate(e, elem);
		};
		gizmo.append(stem, rotHandle);

		this.canvasEl.appendChild(gizmo);
	}

	// --- 5. DRAG, RESIZE, ROTATE HANDLERS ---
	private startElementDrag(e: MouseEvent, elem: DeathScreenElement) {
		if (e.button !== 0) return;
		if (!this.selectedElementIds.has(elem.id)) {
			this.selectElement(elem.id, e.shiftKey || e.ctrlKey);
		}

		this.recordHistory();
		this.isDragging = true;
		this.dragStartX = e.clientX;
		this.dragStartY = e.clientY;

		this.multiDragStartPositions.clear();
		this.getSelectedElements().forEach((sel) => {
			this.multiDragStartPositions.set(sel.id, { x: sel.x, y: sel.y });
		});

		const onMove = (ev: MouseEvent) => {
			if (!this.isDragging || !this.canvasEl) return;
			const rect = this.canvasEl.getBoundingClientRect();
			const deltaXPct = ((ev.clientX - this.dragStartX) / rect.width) * 100;
			const deltaYPct = ((ev.clientY - this.dragStartY) / rect.height) * 100;

			this.getSelectedElements().forEach((sel) => {
				const start = this.multiDragStartPositions.get(sel.id);
				if (start) {
					sel.x = Math.max(0, Math.min(100, Math.round((start.x + deltaXPct) * 10) / 10));
					sel.y = Math.max(0, Math.min(100, Math.round((start.y + deltaYPct) * 10) / 10));
				}
			});

			this.updateCanvas();
			this.updatePropertiesPanel();
		};

		const onUp = () => {
			this.isDragging = false;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);

			if (this.autoKeyEnabled) {
				this.getSelectedElements().forEach((sel) => {
					this.addKeyframe(sel.id, "x", sel.x);
					this.addKeyframe(sel.id, "y", sel.y);
				});
			}

			this.hasUnsavedChanges = true;
			this.onSync();
			this.updateAll();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	private startElementResize(e: MouseEvent, elem: DeathScreenElement, handle: string) {
		this.recordHistory();
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartX = e.clientX;
		this.dragStartY = e.clientY;
		this.elementStartPos = { x: elem.x, y: elem.y, width: elem.width, height: elem.height };

		const onMove = (ev: MouseEvent) => {
			if (!this.isResizing || !this.canvasEl) return;
			const rect = this.canvasEl.getBoundingClientRect();
			const deltaXPct = ((ev.clientX - this.dragStartX) / rect.width) * 100;
			const deltaYPct = ((ev.clientY - this.dragStartY) / rect.height) * 100;

			if (handle.includes("e")) elem.width = Math.max(4, this.elementStartPos.width + deltaXPct);
			if (handle.includes("w")) {
				elem.width = Math.max(4, this.elementStartPos.width - deltaXPct);
				elem.x = this.elementStartPos.x + deltaXPct / 2;
			}
			if (handle.includes("s")) elem.height = Math.max(2, this.elementStartPos.height + deltaYPct);
			if (handle.includes("n")) {
				elem.height = Math.max(2, this.elementStartPos.height - deltaYPct);
				elem.y = this.elementStartPos.y + deltaYPct / 2;
			}

			this.updateCanvas();
			this.updatePropertiesPanel();
		};

		const onUp = () => {
			this.isResizing = false;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			this.hasUnsavedChanges = true;
			this.onSync();
			this.updateAll();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	private startElementRotate(e: MouseEvent, elem: DeathScreenElement) {
		this.recordHistory();
		this.isRotating = true;
		if (!this.canvasEl) return;

		const rect = this.canvasEl.getBoundingClientRect();
		const elemCenterX = rect.left + (elem.x / 100) * rect.width;
		const elemCenterY = rect.top + (elem.y / 100) * rect.height;

		const onMove = (ev: MouseEvent) => {
			if (!this.isRotating) return;
			const rad = Math.atan2(ev.clientY - elemCenterY, ev.clientX - elemCenterX);
			let deg = Math.round((rad * 180) / Math.PI) + 90;
			if (deg < 0) deg += 360;
			if (deg >= 360) deg -= 360;

			if (!elem.style) elem.style = {};
			elem.style.rotation = deg;
			this.updateCanvas();
			this.updatePropertiesPanel();
		};

		const onUp = () => {
			this.isRotating = false;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			if (this.autoKeyEnabled) {
				this.addKeyframe(elem.id, "rotation", elem.style?.rotation ?? 0);
			}
			this.hasUnsavedChanges = true;
			this.onSync();
			this.updateAll();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	// --- 6. MARQUEE SELECTION & CONTEXT MENU ---
	private startMarqueeSelection(e: MouseEvent) {
		this.isMarqueeSelecting = true;
		this.marqueeStartX = e.clientX;
		this.marqueeStartY = e.clientY;

		this.marqueeEl = document.createElement("div");
		this.marqueeEl.style.cssText = `
			position: fixed;
			left: ${this.marqueeStartX}px;
			top: ${this.marqueeStartY}px;
			width: 0;
			height: 0;
			border: 1px dashed ${StudioTokens.colors.accent};
			background: ${StudioTokens.colors.accentMuted};
			pointer-events: none;
			z-index: 10000;
		`;
		document.body.appendChild(this.marqueeEl);

		const onMove = (ev: MouseEvent) => {
			if (!this.isMarqueeSelecting || !this.marqueeEl) return;
			const curX = ev.clientX;
			const curY = ev.clientY;
			const l = Math.min(this.marqueeStartX, curX);
			const t = Math.min(this.marqueeStartY, curY);
			const w = Math.abs(curX - this.marqueeStartX);
			const h = Math.abs(curY - this.marqueeStartY);

			this.marqueeEl.style.left = `${l}px`;
			this.marqueeEl.style.top = `${t}px`;
			this.marqueeEl.style.width = `${w}px`;
			this.marqueeEl.style.height = `${h}px`;

			if (this.canvasEl) {
				const rect = this.canvasEl.getBoundingClientRect();
				const elems = this.screen.elements || [];
				this.selectedElementIds.clear();

				elems.forEach((el) => {
					const elX = rect.left + (el.x / 100) * rect.width;
					const elY = rect.top + (el.y / 100) * rect.height;
					if (elX >= l && elX <= l + w && elY >= t && elY <= t + h) {
						this.selectedElementIds.add(el.id);
					}
				});
				this.updateCanvas();
			}
		};

		const onUp = () => {
			this.isMarqueeSelecting = false;
			if (this.marqueeEl) {
				this.marqueeEl.remove();
				this.marqueeEl = null;
			}
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			this.updateLayersList();
			this.updatePropertiesPanel();
			this.updateStatusBar();
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	private showContextMenu(x: number, y: number, elem: DeathScreenElement) {
		if (this.contextMenuEl) this.contextMenuEl.remove();

		this.contextMenuEl = document.createElement("div");
		this.contextMenuEl.className = "studio-context-menu";
		this.contextMenuEl.style.cssText = `
			position: fixed;
			left: ${x}px;
			top: ${y}px;
			width: 200px;
			background: ${StudioTokens.colors.surface1};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			border-radius: ${StudioTokens.radii.md};
			box-shadow: ${StudioTokens.shadows.dropdown};
			padding: 4px;
			z-index: 100000;
			display: flex;
			flex-direction: column;
			gap: 2px;
		`;

		const items = [
			{ l: "Duplicar", icon: "copy", action: () => this.duplicateElement(elem.id) },
			{ l: "Copiar Elemento", icon: "copy", action: () => (this.clipboardElement = JSON.parse(JSON.stringify(elem))) },
			{ l: elem.locked ? "Desbloquear" : "Bloquear", icon: elem.locked ? "unlock" : "lock", action: () => { elem.locked = !elem.locked; this.updateAll(); } },
			{ l: elem.visible === false ? "Mostrar" : "Ocultar", icon: elem.visible === false ? "eye" : "eye-off", action: () => { elem.visible = !elem.visible; this.updateAll(); } },
			{ l: "Traer al Frente", icon: "arrow-up", action: () => { elem.zIndex = (this.screen.elements?.length || 10) + 1; this.updateAll(); } },
			{ l: "Enviar al Fondo", icon: "arrow-down", action: () => { elem.zIndex = 1; this.updateAll(); } },
			{ l: "Guardar Prefab", icon: "component", action: () => this.createCustomComponentFromSelection(elem.name) },
			{ l: "Eliminar", icon: "trash", danger: true, action: () => this.removeElement(elem.id) },
		];

		items.forEach((it) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.style.cssText = `
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 10px;
				background: transparent;
				border: none;
				border-radius: ${StudioTokens.radii.sm};
				color: ${it.danger ? StudioTokens.colors.danger : StudioTokens.colors.textPrimary};
				font-size: ${StudioTokens.typography.sizeSm};
				cursor: pointer;
				text-align: left;
			`;
			btn.innerHTML = `${renderStudioIcon(it.icon as any, 13, it.danger ? StudioTokens.colors.danger : "currentColor")} <span>${it.l}</span>`;
			btn.onmouseenter = () => (btn.style.background = StudioTokens.colors.surface3);
			btn.onmouseleave = () => (btn.style.background = "transparent");
			btn.onclick = () => {
				it.action();
				this.contextMenuEl?.remove();
			};
			this.contextMenuEl!.appendChild(btn);
		});

		const onDocClick = (ev: MouseEvent) => {
			if (this.contextMenuEl && !this.contextMenuEl.contains(ev.target as Node)) {
				this.contextMenuEl.remove();
				this.contextMenuEl = null;
				document.removeEventListener("mousedown", onDocClick);
			}
		};
		document.addEventListener("mousedown", onDocClick);
		document.body.appendChild(this.contextMenuEl);
	}

	// --- 7. RIGHT INSPECTOR PANEL PREMIUM ---
	private createPropertiesPanel(): HTMLElement {
		this.propertiesPanelEl = document.createElement("div");
		this.propertiesPanelEl.className = "death-screen-editor-inspector custom-scrollbar";
		this.propertiesPanelEl.style.cssText = `
			width: ${this.rightPanelWidth}px;
			background: ${StudioTokens.colors.surface1};
			border-left: 1px solid ${StudioTokens.colors.borderSubtle};
			display: ${this.isRightPanelCollapsed ? "none" : "flex"};
			flex-direction: column;
			overflow-y: auto;
			z-index: 10;
		`;
		this.updatePropertiesPanel();
		return this.propertiesPanelEl;
	}

	private updatePropertiesPanel() {
		if (!this.propertiesPanelEl) return;
		this.propertiesPanelEl.innerHTML = "";

		const selectedCount = this.selectedElementIds.size;
		if (selectedCount === 0) {
			this.renderGlobalInspector();
		} else if (selectedCount > 1) {
			this.renderMultiSelectInspector();
		} else {
			const elem = this.screen.elements?.find((e) => e.id === this.selectedElementId);
			if (elem) this.renderElementInspector(elem);
			else this.renderGlobalInspector();
		}
	}

	private renderGlobalInspector() {
		const header = document.createElement("div");
		header.style.cssText = `padding: 10px 12px; background: ${StudioTokens.colors.surface2}; border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};`;
		header.innerHTML = `<strong style="color:${StudioTokens.colors.accent}; font-size:${StudioTokens.typography.sizeMd};">Ajustes Globales</strong>`;
		this.propertiesPanelEl!.appendChild(header);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;";

		scroll.appendChild(this.createTextInput("Título Global", this.screen.title || "HAS MUERTO", "", (v) => {
			this.recordHistory();
			this.screen.title = v;
			this.onSync();
			this.updateCanvas();
		}));

		scroll.appendChild(this.createColorPickerInput("Color de Acento", this.screen.accentColor || "#00d2ff", (c) => {
			this.recordHistory();
			this.screen.accentColor = c;
			this.onSync();
			this.updateCanvas();
		}));

		// Background Launcher inside inspector
		const bgSec = this.createSectionBox("Gestor de Fondos");
		const launchBgBtn = document.createElement("button");
		launchBgBtn.type = "button";
		launchBgBtn.style.cssText = `
			width: 100%;
			background: ${StudioTokens.colors.surface3};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 7px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		`;
		launchBgBtn.innerHTML = `${renderStudioIcon("palette", 14, StudioTokens.colors.accent)} <span>Explorar y Cambiar Fondo</span>`;
		launchBgBtn.onclick = () => {
			this.backgroundManager.openGalleryModal(this.screen.background || {}, (newBg) => {
				this.recordHistory();
				this.screen.background = newBg;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateCanvas();
			});
		};
		bgSec.appendChild(launchBgBtn);
		scroll.appendChild(bgSec);

		this.propertiesPanelEl!.appendChild(scroll);
	}

	private renderMultiSelectInspector() {
		const header = document.createElement("div");
		header.style.cssText = `padding: 10px 12px; background: ${StudioTokens.colors.surface2}; border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};`;
		header.innerHTML = `<strong style="color:${StudioTokens.colors.accent}; font-size:${StudioTokens.typography.sizeMd};">Selección Múltiple (${this.selectedElementIds.size})</strong>`;
		this.propertiesPanelEl!.appendChild(header);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;";

		const saveCompBtn = document.createElement("button");
		saveCompBtn.type = "button";
		saveCompBtn.style.cssText = `
			background: ${StudioTokens.colors.accent};
			color: #090b0e;
			border: none;
			padding: 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		`;
		saveCompBtn.innerHTML = `${renderStudioIcon("component", 14, "#090b0e")} <span>Crear Prefab de Selección</span>`;
		saveCompBtn.onclick = () => this.createCustomComponentFromSelection();
		scroll.appendChild(saveCompBtn);

		this.propertiesPanelEl!.appendChild(scroll);
	}

	private renderElementInspector(elem: DeathScreenElement) {
		const header = document.createElement("div");
		header.style.cssText = `padding: 10px 12px; background: ${StudioTokens.colors.surface2}; border-bottom: 1px solid ${StudioTokens.colors.borderSubtle}; display: flex; align-items: center; justify-content: space-between;`;
		header.innerHTML = `
			<div style="display:flex; align-items:center; gap:6px;">
				<strong style="color:${StudioTokens.colors.textPrimary}; font-size:${StudioTokens.typography.sizeMd};">${elem.name}</strong>
				<span style="font-size:9px; color:${StudioTokens.colors.accent}; background:${StudioTokens.colors.accentMuted}; padding:1px 4px; border-radius:2px;">${elem.type}</span>
			</div>
		`;
		this.propertiesPanelEl!.appendChild(header);

		const scroll = document.createElement("div");
		scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;";

		// 1. Text & Name
		scroll.appendChild(this.createTextInput("Nombre Capa", elem.name, "", (v) => {
			this.recordHistory();
			elem.name = v;
			this.onSync();
			this.updateLayersList();
		}));

		if (elem.type === "title" || elem.type === "subtitle" || elem.type === "text" || elem.type === "badge" || elem.type === "action_button") {
			scroll.appendChild(this.createTextInput("Contenido", elem.text || elem.content || "", "", (v) => {
				this.recordHistory();
				elem.text = v;
				elem.content = v;
				this.onSync();
				this.updateCanvas();
			}));
		}

		// 2. Transform (X, Y, W, H, Rotation, Anchor Grid)
		const trBox = this.createSectionBox("Transformación");
		const trGrid = document.createElement("div");
		trGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; grid-gap: 8px;";
		trGrid.appendChild(this.createNumericInput("X (%)", elem.x, 0, 100, (v) => { elem.x = v; this.updateCanvas(); }));
		trGrid.appendChild(this.createNumericInput("Y (%)", elem.y, 0, 100, (v) => { elem.y = v; this.updateCanvas(); }));
		trGrid.appendChild(this.createNumericInput("Ancho (%)", elem.width, 1, 100, (v) => { elem.width = v; this.updateCanvas(); }));
		trGrid.appendChild(this.createNumericInput("Alto (%)", elem.height, 1, 100, (v) => { elem.height = v; this.updateCanvas(); }));
		trBox.appendChild(trGrid);

		// Rotation Dial & Slider
		trBox.appendChild(this.createSliderInput("Rotación", elem.style?.rotation || 0, 0, 360, "°", (v) => {
			if (!elem.style) elem.style = {};
			elem.style.rotation = v;
			this.updateCanvas();
		}));

		// Visual 3x3 Anchor Grid
		trBox.appendChild(this.createAnchorPointGrid(elem.style?.transformOrigin || "center center", (orig) => {
			this.recordHistory();
			if (!elem.style) elem.style = {};
			elem.style.transformOrigin = orig;
			this.onSync();
			this.updateCanvas();
		}));
		scroll.appendChild(trBox);

		// 3. Typography (if applicable)
		if (elem.type === "title" || elem.type === "subtitle" || elem.type === "text" || elem.type === "badge") {
			const typoBox = this.createSectionBox("Tipografía");
			typoBox.appendChild(this.createSliderInput("Tamaño", elem.style?.fontSize || 24, 8, 96, "px", (v) => {
				if (!elem.style) elem.style = {};
				elem.style.fontSize = v;
				this.updateCanvas();
			}));
			typoBox.appendChild(this.createColorPickerInput("Color Texto", elem.style?.color || "#ffffff", (c) => {
				if (!elem.style) elem.style = {};
				elem.style.color = c;
				this.updateCanvas();
			}));
			scroll.appendChild(typoBox);
		}

		// 4. Appearance, Borders & Blend Mode
		const appBox = this.createSectionBox("Apariencia y Bordes");
		appBox.appendChild(this.createColorPickerInput("Color Fondo", elem.style?.backgroundColor || "transparent", (c) => {
			if (!elem.style) elem.style = {};
			elem.style.backgroundColor = c;
			this.updateCanvas();
		}));
		appBox.appendChild(this.createColorPickerInput("Color Borde", elem.style?.borderColor || "transparent", (c) => {
			if (!elem.style) elem.style = {};
			elem.style.borderColor = c;
			if (!elem.style.borderWidth) elem.style.borderWidth = 1;
			this.updateCanvas();
		}));
		appBox.appendChild(this.createSliderInput("Radio Borde", elem.style?.borderRadius || 0, 0, 40, "px", (v) => {
			if (!elem.style) elem.style = {};
			elem.style.borderRadius = v;
			this.updateCanvas();
		}));

		// Blend Mode
		const bmWrap = document.createElement("div");
		bmWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const bmLbl = document.createElement("span");
		bmLbl.textContent = "Modo de Fusión (Blend Mode)";
		bmLbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;
		const bmSelect = document.createElement("select");
		bmSelect.style.cssText = `
			background: ${StudioTokens.colors.surface1};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 4px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
		`;
		[
			{ v: "normal", t: "Normal" },
			{ v: "screen", t: "Screen (Trama)" },
			{ v: "multiply", t: "Multiply (Multiplicar)" },
			{ v: "overlay", t: "Overlay (Superponer)" },
			{ v: "difference", t: "Difference (Inversión)" },
		].forEach((bm) => {
			const o = document.createElement("option");
			o.value = bm.v;
			o.textContent = bm.t;
			if (elem.style?.blendMode === bm.v) o.selected = true;
			bmSelect.appendChild(o);
		});
		bmSelect.onchange = () => {
			if (!elem.style) elem.style = {};
			elem.style.blendMode = bmSelect.value;
			this.updateCanvas();
		};
		bmWrap.append(bmLbl, bmSelect);
		appBox.appendChild(bmWrap);

		scroll.appendChild(appBox);

		// 5. Animation & Keyframe
		const animBox = this.createSectionBox("Animación Anime.js");
		animBox.appendChild(this.createNumericInput("Duración (ms)", elem.animation?.duration || 400, 50, 4000, (v) => {
			if (!elem.animation) elem.animation = {};
			elem.animation.duration = v;
			this.updateTimelineDock();
		}));
		const addKfBtn = document.createElement("button");
		addKfBtn.type = "button";
		addKfBtn.style.cssText = `
			background: ${StudioTokens.colors.surface3};
			color: ${StudioTokens.colors.accent};
			border: 1px solid ${StudioTokens.colors.accentBorder};
			padding: 5px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 5px;
		`;
		addKfBtn.innerHTML = `${renderStudioIcon("keyframe", 13, StudioTokens.colors.accent)} <span>Añadir Keyframe (${this.timelineCurrentTime}ms)</span>`;
		addKfBtn.onclick = () => {
			this.addKeyframe(elem.id, "opacity", elem.style?.opacity ?? 1);
		};
		animBox.appendChild(addKfBtn);

		const openGraphBtn = document.createElement("button");
		openGraphBtn.type = "button";
		openGraphBtn.style.cssText = `
			background: ${StudioTokens.colors.surface3};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 6px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		`;
		openGraphBtn.innerHTML = `${renderStudioIcon("bezier", 13, StudioTokens.colors.accent)} <span>Editar Curva Bézier en Graph Editor</span>`;
		openGraphBtn.onclick = () => {
			this.setTimelineViewMode("graph");
		};
		animBox.appendChild(openGraphBtn);
		scroll.appendChild(animBox);

		// 6. Conditions & Gameplay
		const condBox = this.createSectionBox("Condiciones de Activación");
		const condNote = document.createElement("span");
		condNote.textContent = "Mostrar solo en causas de muerte específicas:";
		condNote.style.cssText = `font-size: 11px; color: ${StudioTokens.colors.textMuted};`;
		condBox.appendChild(condNote);

		const causesWrap = document.createElement("div");
		causesWrap.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px;";
		const causes: DeathCause[] = ["damage", "fall", "logic", "vehicle"];
		const elemCauses = new Set(elem.conditions?.causes || []);
		causes.forEach((cause) => {
			const badge = document.createElement("button");
			badge.type = "button";
			const isActive = elemCauses.size === 0 || elemCauses.has(cause);
			badge.style.cssText = `
				background: ${isActive ? StudioTokens.colors.surface3 : "transparent"};
				border: 1px solid ${isActive ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
				color: ${isActive ? StudioTokens.colors.accent : StudioTokens.colors.textMuted};
				padding: 3px 8px;
				border-radius: 9999px;
				font-size: 10px;
				cursor: pointer;
			`;
			badge.textContent = cause.toUpperCase();
			badge.onclick = () => {
				if (!elem.conditions) elem.conditions = {};
				if (!elem.conditions.causes) elem.conditions.causes = [];
				const idx = elem.conditions.causes.indexOf(cause);
				if (idx >= 0) elem.conditions.causes.splice(idx, 1);
				else elem.conditions.causes.push(cause);
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updatePropertiesPanel();
			};
			causesWrap.appendChild(badge);
		});
		condBox.appendChild(causesWrap);
		scroll.appendChild(condBox);

		// 7. Action Button Specific Settings
		if (elem.type === "action_button") {
			const actBox = this.createSectionBox("Interacción de Botón");
			const actWrap = document.createElement("div");
			actWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
			const actLbl = document.createElement("span");
			actLbl.textContent = "Acción al pulsar";
			actLbl.style.cssText = `font-size: 11px; color: ${StudioTokens.colors.textSecondary};`;
			const actSelect = document.createElement("select");
			actSelect.style.cssText = `
				background: ${StudioTokens.colors.surface1};
				color: ${StudioTokens.colors.textPrimary};
				border: 1px solid ${StudioTokens.colors.borderNormal};
				padding: 4px;
				border-radius: ${StudioTokens.radii.sm};
				font-size: 11px;
			`;
			[
				{ v: "respawn", l: "Reaparecer (Respawn)" },
				{ v: "spectate", l: "Modo Observador (Spectate)" },
				{ v: "restart", l: "Reiniciar Partida" },
				{ v: "lobby", l: "Salir al Lobby" },
			].forEach((act) => {
				const opt = document.createElement("option");
				opt.value = act.v;
				opt.textContent = act.l;
				if ((elem.action || "respawn") === act.v) opt.selected = true;
				actSelect.appendChild(opt);
			});
			actSelect.onchange = () => {
				elem.action = actSelect.value as any;
				this.hasUnsavedChanges = true;
				this.onSync();
				this.updateCanvas();
			};
			actWrap.append(actLbl, actSelect);
			actBox.appendChild(actWrap);
			scroll.appendChild(actBox);
		}

		this.propertiesPanelEl!.appendChild(scroll);
	}

	private createSectionBox(title: string): HTMLElement {
		const box = document.createElement("div");
		box.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			border-radius: ${StudioTokens.radii.md};
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		`;
		const h = document.createElement("span");
		h.textContent = title;
		h.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; font-weight: 700; color: ${StudioTokens.colors.accent}; letter-spacing: 0.5px;`;
		box.appendChild(h);
		return box;
	}

	private createTextInput(label: string, value: string, placeholder: string, onChange: (v: string) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const lbl = document.createElement("span");
		lbl.textContent = label;
		lbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;
		const input = document.createElement("input");
		input.type = "text";
		input.value = value;
		input.placeholder = placeholder;
		input.style.cssText = `
			background: ${StudioTokens.colors.surface1};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 5px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			outline: none;
		`;
		input.onchange = () => onChange(input.value);
		wrap.append(lbl, input);
		return wrap;
	}

	private createNumericInput(label: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const lbl = document.createElement("span");
		lbl.textContent = label;
		lbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;
		const input = document.createElement("input");
		input.type = "number";
		input.value = String(value);
		input.min = String(min);
		input.max = String(max);
		input.style.cssText = `
			background: ${StudioTokens.colors.surface1};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 4px 6px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			outline: none;
		`;
		input.onchange = () => onChange(parseFloat(input.value) || 0);
		wrap.append(lbl, input);
		return wrap;
	}

	private createSliderInput(label: string, value: number, min: number, max: number, unit: string, onChange: (v: number) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const top = document.createElement("div");
		top.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
		const lbl = document.createElement("span");
		lbl.textContent = label;
		lbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;
		const valSpan = document.createElement("span");
		valSpan.textContent = `${value}${unit}`;
		valSpan.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textMuted}; font-family: ${StudioTokens.typography.fontMono};`;
		top.append(lbl, valSpan);

		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = String(min);
		slider.max = String(max);
		slider.value = String(value);
		slider.style.cssText = "width: 100%;";
		slider.oninput = () => {
			const v = parseFloat(slider.value);
			valSpan.textContent = `${v}${unit}`;
			onChange(v);
		};
		wrap.append(top, slider);
		return wrap;
	}

	private createColorPickerInput(label: string, value: string, onChange: (c: string) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const lbl = document.createElement("span");
		lbl.textContent = label;
		lbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;

		const row = document.createElement("div");
		row.style.cssText = "display: flex; align-items: center; gap: 6px;";

		const picker = document.createElement("input");
		picker.type = "color";
		picker.value = value.startsWith("#") && value.length === 7 ? value : "#00d2ff";
		picker.style.cssText = "width: 28px; height: 26px; border: none; padding: 0; background: transparent; cursor: pointer; border-radius: 4px;";

		const textInput = document.createElement("input");
		textInput.type = "text";
		textInput.value = value;
		textInput.style.cssText = `
			flex: 1;
			background: ${StudioTokens.colors.surface1};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			padding: 4px 6px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			font-family: ${StudioTokens.typography.fontMono};
		`;

		picker.oninput = () => {
			textInput.value = picker.value;
			onChange(picker.value);
		};
		textInput.onchange = () => {
			onChange(textInput.value);
		};

		row.append(picker, textInput);
		wrap.append(lbl, row);
		return wrap;
	}

	private createAnchorPointGrid(currentOrigin = "center center", onChange: (origin: string) => void): HTMLElement {
		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const lbl = document.createElement("span");
		lbl.textContent = "Punto de Anclaje / Pivote";
		lbl.style.cssText = `font-size: ${StudioTokens.typography.sizeXs}; color: ${StudioTokens.colors.textSecondary};`;

		const grid = document.createElement("div");
		grid.style.cssText = "display: grid; grid-template-columns: repeat(3, 26px); grid-gap: 3px;";

		const points = [
			{ id: "top left", icon: "arrow-up", rot: "-45deg" },
			{ id: "top center", icon: "arrow-up", rot: "0deg" },
			{ id: "top right", icon: "arrow-up", rot: "45deg" },
			{ id: "center left", icon: "arrow-left", rot: "0deg" },
			{ id: "center center", icon: "crosshair", rot: "0deg" },
			{ id: "center right", icon: "arrow-right", rot: "0deg" },
			{ id: "bottom left", icon: "arrow-down", rot: "45deg" },
			{ id: "bottom center", icon: "arrow-down", rot: "0deg" },
			{ id: "bottom right", icon: "arrow-down", rot: "-45deg" },
		];

		points.forEach((pt) => {
			const b = document.createElement("button");
			b.type = "button";
			const isA = currentOrigin === pt.id;
			b.style.cssText = `
				width: 26px;
				height: 26px;
				background: ${isA ? StudioTokens.colors.accent : StudioTokens.colors.surface1};
				color: ${isA ? "#090b0e" : StudioTokens.colors.textSecondary};
				border: 1px solid ${isA ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
				border-radius: ${StudioTokens.radii.xs};
				cursor: pointer;
				padding: 0;
				display: flex;
				align-items: center;
				justify-content: center;
			`;
			b.innerHTML = renderStudioIcon(pt.icon as any, 12, isA ? "#090b0e" : "currentColor", `transform: rotate(${pt.rot});`);
			b.onclick = () => onChange(pt.id);
			grid.appendChild(b);
		});

		wrap.append(lbl, grid);
		return wrap;
	}

	// --- 8. BOTTOM TIMELINE DOCK PREMIUM ---
	private createTimelineDock(): HTMLElement {
		this.timelineDockEl = document.createElement("div");
		this.timelineDockEl.className = "death-screen-editor-timeline-dock";
		this.timelineDockEl.style.cssText = `
			height: ${this.timelineHeight}px;
			background: ${StudioTokens.colors.surface1};
			border-top: 1px solid ${StudioTokens.colors.borderSubtle};
			display: ${this.isTimelineCollapsed ? "none" : "flex"};
			flex-direction: column;
			overflow: hidden;
			z-index: 10;
		`;
		this.updateTimelineDock();
		return this.timelineDockEl;
	}

	private updateTimelineDock() {
		if (!this.timelineDockEl) return;
		this.timelineDockEl.innerHTML = "";

		// Timeline Transport Header
		const header = document.createElement("div");
		header.style.cssText = `
			height: 38px;
			background: ${StudioTokens.colors.surface2};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 12px;
		`;

		// Left: Transport Controls (Play, Stop, Rewind, Time, Auto-Key)
		const left = document.createElement("div");
		left.style.cssText = "display: flex; align-items: center; gap: 8px;";

		const playBtn = document.createElement("button");
		playBtn.type = "button";
		playBtn.style.cssText = `
			background: ${StudioTokens.colors.accent};
			color: #090b0e;
			border: none;
			padding: 4px 10px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 5px;
		`;
		playBtn.innerHTML = `${renderStudioIcon(this.isPlayingSequence ? "pause" : "play", 13, "#090b0e")} <span>${this.isPlayingSequence ? "Pausa" : "Play"}</span>`;
		playBtn.onclick = () => {
			if (this.isPlayingSequence) this.stopTimelineSequence();
			else this.playTimelineSequence();
		};

		const stopBtn = document.createElement("button");
		stopBtn.type = "button";
		stopBtn.style.cssText = `background: ${StudioTokens.colors.surface3}; border: 1px solid ${StudioTokens.colors.borderNormal}; color: ${StudioTokens.colors.textSecondary}; padding: 4px 8px; border-radius: ${StudioTokens.radii.sm}; cursor: pointer; display: flex; align-items: center;`;
		stopBtn.innerHTML = renderStudioIcon("stop", 13);
		stopBtn.onclick = () => this.stopTimelineSequence();

		const rewindBtn = document.createElement("button");
		rewindBtn.type = "button";
		rewindBtn.title = "Rebobinar al inicio (0.00s)";
		rewindBtn.style.cssText = stopBtn.style.cssText;
		rewindBtn.innerHTML = renderStudioIcon("skip-back", 13);
		rewindBtn.onclick = () => {
			this.timelineCurrentTime = 0;
			this.applyTimelineFrame(0);
			this.updateTimelineDock();
		};

		const timeDisplay = document.createElement("span");
		timeDisplay.className = "timeline-time-display";
		timeDisplay.style.cssText = `font-size: ${StudioTokens.typography.sizeSm}; font-family: ${StudioTokens.typography.fontMono}; color: ${StudioTokens.colors.accent};`;
		timeDisplay.textContent = `${(this.timelineCurrentTime / 1000).toFixed(2)}s / ${(this.timelineTotalDuration / 1000).toFixed(2)}s`;

		const autoKeyBtn = document.createElement("button");
		autoKeyBtn.type = "button";
		autoKeyBtn.style.cssText = `
			background: ${this.autoKeyEnabled ? StudioTokens.colors.accentMuted : "transparent"};
			border: 1px solid ${this.autoKeyEnabled ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
			color: ${this.autoKeyEnabled ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 5px;
		`;
		autoKeyBtn.innerHTML = `${renderStudioIcon("keyframe", 12, this.autoKeyEnabled ? StudioTokens.colors.accent : "currentColor")} <span>Auto-Key ${this.autoKeyEnabled ? "ON" : "OFF"}</span>`;
		autoKeyBtn.onclick = () => {
			this.autoKeyEnabled = !this.autoKeyEnabled;
			this.updateTimelineDock();
		};

		left.append(playBtn, stopBtn, rewindBtn, timeDisplay, autoKeyBtn);
		header.appendChild(left);

		// Center: Dope Sheet vs Graph Editor View Mode Toggle
		const center = document.createElement("div");
		center.style.cssText = "display: flex; align-items: center; gap: 4px; background: " + StudioTokens.colors.surface1 + "; padding: 2px; border-radius: " + StudioTokens.radii.sm + "; border: 1px solid " + StudioTokens.colors.borderSubtle + ";";

		const dopesheetBtn = document.createElement("button");
		dopesheetBtn.type = "button";
		const isDope = this.timelineViewMode === "dopesheet";
		dopesheetBtn.style.cssText = `
			background: ${isDope ? StudioTokens.colors.surface3 : "transparent"};
			color: ${isDope ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			border: 1px solid ${isDope ? StudioTokens.colors.accentBorder : "transparent"};
			padding: 3px 10px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			font-weight: ${isDope ? "600" : "500"};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 5px;
		`;
		dopesheetBtn.innerHTML = `${renderStudioIcon("timeline", 12, isDope ? StudioTokens.colors.accent : "currentColor")} <span>Dope Sheet</span>`;
		dopesheetBtn.onclick = () => this.setTimelineViewMode("dopesheet");

		const graphBtn = document.createElement("button");
		graphBtn.type = "button";
		const isGraph = this.timelineViewMode === "graph";
		graphBtn.style.cssText = `
			background: ${isGraph ? StudioTokens.colors.surface3 : "transparent"};
			color: ${isGraph ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			border: 1px solid ${isGraph ? StudioTokens.colors.accentBorder : "transparent"};
			padding: 3px 10px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			font-weight: ${isGraph ? "600" : "500"};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 5px;
		`;
		graphBtn.innerHTML = `${renderStudioIcon("bezier", 12, isGraph ? StudioTokens.colors.accent : "currentColor")} <span>Graph Editor</span>`;
		graphBtn.onclick = () => this.setTimelineViewMode("graph");

		center.append(dopesheetBtn, graphBtn);
		header.appendChild(center);

		// Right: Keyframe Operations (Add, Delete, Loop)
		const right = document.createElement("div");
		right.style.cssText = "display: flex; align-items: center; gap: 8px;";

		const addKfBtn = document.createElement("button");
		addKfBtn.type = "button";
		addKfBtn.title = "Añadir keyframe al playhead actual";
		addKfBtn.style.cssText = `
			background: ${StudioTokens.colors.surface3};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			color: ${StudioTokens.colors.textPrimary};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
		`;
		addKfBtn.innerHTML = `${renderStudioIcon("plus", 12, StudioTokens.colors.accent)} <span>+ Keyframe</span>`;
		addKfBtn.onclick = () => {
			const sel = this.getSelectedElements()[0] || this.screen.elements?.[0];
			if (sel) {
				this.addKeyframe(sel.id, "opacity", sel.style?.opacity ?? 1);
			}
		};

		const delKfBtn = document.createElement("button");
		delKfBtn.type = "button";
		delKfBtn.title = "Eliminar keyframe seleccionado";
		delKfBtn.style.cssText = `
			background: ${StudioTokens.colors.surface3};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			color: ${this.selectedKeyframeInfo ? StudioTokens.colors.error : StudioTokens.colors.textMuted};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			cursor: ${this.selectedKeyframeInfo ? "pointer" : "default"};
			display: flex;
			align-items: center;
			gap: 4px;
		`;
		delKfBtn.innerHTML = `${renderStudioIcon("trash", 12)} <span>Borrar</span>`;
		delKfBtn.onclick = () => this.deleteSelectedKeyframe();

		const loopBtn = document.createElement("button");
		loopBtn.type = "button";
		loopBtn.style.cssText = `
			background: ${this.isLooping ? StudioTokens.colors.surfaceActive : "transparent"};
			border: 1px solid ${this.isLooping ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
			color: ${this.isLooping ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
			padding: 3px 8px;
			border-radius: ${StudioTokens.radii.sm};
			font-size: 11px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
		`;
		loopBtn.innerHTML = `${renderStudioIcon("repeat", 12)} <span>Loop</span>`;
		loopBtn.onclick = () => {
			this.isLooping = !this.isLooping;
			loopBtn.style.borderColor = this.isLooping ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle;
			loopBtn.style.color = this.isLooping ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
		};

		right.append(addKfBtn, delKfBtn, loopBtn);
		header.appendChild(right);
		this.timelineDockEl.appendChild(header);

		// BODY: Render Graph Editor OR Dope Sheet
		if (this.timelineViewMode === "graph") {
			this.renderGraphEditorView();
		} else {
			this.renderDopeSheetView();
		}
	}

	private renderGraphEditorView() {
		if (!this.timelineDockEl) return;

		const graphWrap = document.createElement("div");
		graphWrap.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 10px 14px;
			display: flex;
			flex-direction: column;
			gap: 8px;
			background: ${StudioTokens.colors.surfaceBase};
		`;

		// Subheader: Element & Keyframe context indicator
		const subhead = document.createElement("div");
		subhead.style.cssText = "display: flex; align-items: center; justify-content: space-between;";

		const selElem = this.getSelectedElements()[0] || this.screen.elements?.[0];
		const elemLabel = selElem ? selElem.name : "Elemento Global";

		subhead.innerHTML = `
			<div style="display:flex; align-items:center; gap:8px;">
				<span style="font-size:11px; color:${StudioTokens.colors.textMuted};">CURVA ACTIVA:</span>
				<strong style="font-size:12px; color:${StudioTokens.colors.accent};">${elemLabel}</strong>
				${this.selectedKeyframeInfo ? `<span style="font-size:10px; background:${StudioTokens.colors.accentMuted}; color:${StudioTokens.colors.accent}; padding:1px 6px; border-radius:3px;">Keyframe a ${selElem?.keyframes?.[this.selectedKeyframeInfo.keyframeIdx]?.time ?? 0}ms</span>` : ""}
			</div>
			<span style="font-size:11px; color:${StudioTokens.colors.textSecondary}; font-family:${StudioTokens.typography.fontMono};">cubicBezier(${this.activeCurve.join(", ")})</span>
		`;
		graphWrap.appendChild(subhead);

		// If a keyframe is selected with its own bezierCurve, sync it to graph editor
		if (this.selectedKeyframeInfo && selElem && selElem.keyframes?.[this.selectedKeyframeInfo.keyframeIdx]?.bezierCurve) {
			this.activeCurve = [...selElem.keyframes[this.selectedKeyframeInfo.keyframeIdx].bezierCurve!];
		}

		if (this.graphEditor) {
			this.graphEditor.setCurve(this.activeCurve, false);
			graphWrap.appendChild(this.graphEditor.render());
		}

		this.timelineDockEl.appendChild(graphWrap);
	}

	private renderDopeSheetView() {
		if (!this.timelineDockEl) return;

		// 1. Time Ruler Bar with scrubbing playhead
		const ruler = document.createElement("div");
		ruler.className = "timeline-time-ruler";
		ruler.style.cssText = `
			height: 24px;
			background: ${StudioTokens.colors.surface1};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			position: relative;
			user-select: none;
		`;

		const rulerHeaderSpacer = document.createElement("div");
		rulerHeaderSpacer.style.cssText = `
			width: 200px;
			height: 100%;
			border-right: 1px solid ${StudioTokens.colors.borderSubtle};
			background: ${StudioTokens.colors.surface2};
			display: flex;
			align-items: center;
			padding-left: 10px;
			font-size: 10px;
			font-weight: 600;
			color: ${StudioTokens.colors.textMuted};
		`;
		rulerHeaderSpacer.textContent = "PISTAS / CAPAS";
		ruler.appendChild(rulerHeaderSpacer);

		const rulerTrack = document.createElement("div");
		rulerTrack.style.cssText = "flex: 1; height: 100%; position: relative; cursor: crosshair;";

		// Time Marks (0.0s, 0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s)
		const intervals = [0, 500, 1000, 1500, 2000, 2500, 3000];
		intervals.forEach((t) => {
			const pct = (t / this.timelineTotalDuration) * 100;
			const tick = document.createElement("div");
			tick.style.cssText = `
				position: absolute;
				left: ${pct}%;
				top: 0;
				bottom: 0;
				border-left: 1px solid ${StudioTokens.colors.borderNormal};
				padding-left: 3px;
				font-size: 9px;
				font-family: ${StudioTokens.typography.fontMono};
				color: ${StudioTokens.colors.textMuted};
				pointer-events: none;
			`;
			tick.textContent = `${(t / 1000).toFixed(1)}s`;
			rulerTrack.appendChild(tick);
		});

		// Red Scrubbing Playhead Line
		const playhead = document.createElement("div");
		playhead.className = "timeline-playhead-line";
		const playheadPct = (this.timelineCurrentTime / this.timelineTotalDuration) * 100;
		playhead.style.cssText = `
			position: absolute;
			left: ${playheadPct}%;
			top: 0;
			bottom: -500px;
			width: 2px;
			background: #ff3366;
			z-index: 50;
			pointer-events: none;
		`;
		const playheadHead = document.createElement("div");
		playheadHead.style.cssText = `
			position: absolute;
			top: 0;
			left: -4px;
			width: 10px;
			height: 10px;
			background: #ff3366;
			clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%);
		`;
		playhead.appendChild(playheadHead);
		rulerTrack.appendChild(playhead);

		// Ruler Scrub Handler
		let isScrubbing = false;
		const updateScrub = (ev: MouseEvent) => {
			const rect = rulerTrack.getBoundingClientRect();
			const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
			this.timelineCurrentTime = Math.round((pct * this.timelineTotalDuration) / 25) * 25; // 25ms snap
			this.applyTimelineFrame(this.timelineCurrentTime);
			playhead.style.left = `${(this.timelineCurrentTime / this.timelineTotalDuration) * 100}%`;
			const disp = this.timelineDockEl?.querySelector(".timeline-time-display");
			if (disp) disp.textContent = `${(this.timelineCurrentTime / 1000).toFixed(2)}s / ${(this.timelineTotalDuration / 1000).toFixed(2)}s`;
		};

		rulerTrack.addEventListener("mousedown", (e) => {
			isScrubbing = true;
			updateScrub(e);
			const onMove = (ev: MouseEvent) => { if (isScrubbing) updateScrub(ev); };
			const onUp = () => {
				isScrubbing = false;
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
			};
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		});

		ruler.appendChild(rulerTrack);
		this.timelineDockEl.appendChild(ruler);

		// 2. Multitrack List & Ruler Area
		const trackContainer = document.createElement("div");
		trackContainer.className = "custom-scrollbar";
		trackContainer.style.cssText = "flex: 1; overflow-y: auto; overflow-x: hidden; position: relative;";

		const elems = this.screen.elements || [];
		elems.forEach((elem) => {
			const isExpanded = this.expandedTracks.has(elem.id);
			const row = document.createElement("div");
			row.style.cssText = `
				border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
				background: ${this.selectedElementIds.has(elem.id) ? StudioTokens.colors.surface3 : "transparent"};
				display: flex;
				flex-direction: column;
			`;

			// Main Track
			const mainTrack = document.createElement("div");
			mainTrack.style.cssText = "height: 28px; display: flex; align-items: center; position: relative;";

			// Left Label Area
			const tLabel = document.createElement("div");
			tLabel.style.cssText = `
				width: 200px;
				height: 100%;
				padding: 0 8px;
				display: flex;
				align-items: center;
				justify-content: space-between;
				border-right: 1px solid ${StudioTokens.colors.borderSubtle};
				cursor: pointer;
				background: ${StudioTokens.colors.surface2};
			`;
			tLabel.innerHTML = `
				<div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
					${renderStudioIcon(isExpanded ? "chevron-down" : "chevron-right", 12, StudioTokens.colors.textSecondary)}
					<span style="font-size:${StudioTokens.typography.sizeSm}; font-weight:500; color:${StudioTokens.colors.textPrimary}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${elem.name}</span>
				</div>
				<div style="background:rgba(0,210,255,0.12); border:1px solid rgba(0,210,255,0.3); color:${StudioTokens.colors.accent}; padding:1px 5px; border-radius:3px; font-size:10px; font-family:${StudioTokens.typography.fontMono};">${elem.animation?.duration || 400}ms</div>
			`;
			tLabel.onclick = () => {
				if (this.expandedTracks.has(elem.id)) this.expandedTracks.delete(elem.id);
				else this.expandedTracks.add(elem.id);
				this.updateTimelineDock();
			};

			// Right Track Canvas Bar with Keyframe Diamonds
			const tBar = document.createElement("div");
			tBar.style.cssText = "flex: 1; height: 100%; position: relative; background: rgba(0,0,0,0.2);";

			// Render Keyframe Diamonds ◆
			const kfs = elem.keyframes || [];
			kfs.forEach((kf, idx) => {
				const pct = (kf.time / this.timelineTotalDuration) * 100;
				const isSelectedKf = this.selectedKeyframeInfo?.elemId === elem.id && this.selectedKeyframeInfo?.keyframeIdx === idx;

				const diamond = document.createElement("div");
				diamond.title = `Keyframe ${kf.time}ms - Easing: ${kf.easing || "cubicBezier"}`;
				diamond.style.cssText = `
					position: absolute;
					left: ${pct}%;
					top: 50%;
					transform: translate(-50%, -50%) rotate(45deg);
					width: 10px;
					height: 10px;
					background: ${isSelectedKf ? StudioTokens.colors.accent : "#8a99ad"};
					border: 1.5px solid ${isSelectedKf ? "#ffffff" : StudioTokens.colors.surfaceBase};
					cursor: pointer;
					box-shadow: ${isSelectedKf ? "0 0 6px " + StudioTokens.colors.accentGlow : "none"};
					z-index: 10;
					transition: transform 0.1s;
				`;

				diamond.onclick = (e) => {
					e.stopPropagation();
					this.selectedKeyframeInfo = { elemId: elem.id, keyframeIdx: idx };
					if (kf.bezierCurve) {
						this.activeCurve = [...kf.bezierCurve];
						if (this.graphEditor) this.graphEditor.setCurve(this.activeCurve, false);
					}
					this.updateTimelineDock();
				};

				diamond.ondblclick = (e) => {
					e.stopPropagation();
					this.selectedKeyframeInfo = { elemId: elem.id, keyframeIdx: idx };
					this.setTimelineViewMode("graph");
				};

				tBar.appendChild(diamond);
			});

			mainTrack.append(tLabel, tBar);
			row.appendChild(mainTrack);

			// Sub-tracks (Opacity, Pos X, Pos Y, Scale, Rotation)
			if (isExpanded) {
				const props = [
					{ k: "opacity", l: "Opacidad", icon: "eye" },
					{ k: "x", l: "Posición X", icon: "arrow-left" },
					{ k: "y", l: "Posición Y", icon: "arrow-up" },
					{ k: "scale", l: "Escala", icon: "maximize" },
					{ k: "rotation", l: "Rotación", icon: "rotate" },
				];

				props.forEach((p) => {
					const sub = document.createElement("div");
					sub.style.cssText = `
						height: 22px;
						display: flex;
						align-items: center;
						background: ${StudioTokens.colors.surface1};
						border-top: 1px solid rgba(255,255,255,0.02);
					`;

					const subLbl = document.createElement("div");
					subLbl.style.cssText = `
						width: 200px;
						height: 100%;
						padding-left: 28px;
						display: flex;
						align-items: center;
						gap: 6px;
						border-right: 1px solid ${StudioTokens.colors.borderSubtle};
					`;
					subLbl.innerHTML = `
						${renderStudioIcon(p.icon as any, 10, StudioTokens.colors.textMuted)}
						<span style="font-size:10px; color:${StudioTokens.colors.textSecondary};">${p.l}</span>
					`;

					const subBar = document.createElement("div");
					subBar.style.cssText = "flex: 1; height: 100%; position: relative;";

					// Check if any keyframe defines this property
					kfs.forEach((kf, idx) => {
						if ((kf as any)[p.k] !== undefined) {
							const pct = (kf.time / this.timelineTotalDuration) * 100;
							const isSelectedKf = this.selectedKeyframeInfo?.elemId === elem.id && this.selectedKeyframeInfo?.keyframeIdx === idx;

							const subDiamond = document.createElement("div");
							subDiamond.style.cssText = `
								position: absolute;
								left: ${pct}%;
								top: 50%;
								transform: translate(-50%, -50%) rotate(45deg);
								width: 8px;
								height: 8px;
								background: ${isSelectedKf ? StudioTokens.colors.accent : "#718096"};
								border: 1px solid ${StudioTokens.colors.surfaceBase};
								cursor: pointer;
							`;
							subDiamond.onclick = (e) => {
								e.stopPropagation();
								this.selectedKeyframeInfo = { elemId: elem.id, keyframeIdx: idx };
								this.updateTimelineDock();
							};
							subBar.appendChild(subDiamond);
						}
					});

					sub.append(subLbl, subBar);
					row.appendChild(sub);
				});
			}

			trackContainer.appendChild(row);
		});

		this.timelineDockEl.appendChild(trackContainer);
	}

	public addKeyframe(elemId: string, property: string, value: any) {
		const elem = this.screen.elements?.find((e) => e.id === elemId);
		if (!elem) return;
		if (!elem.keyframes) elem.keyframes = [];

		const time = this.timelineCurrentTime;
		const existing = elem.keyframes.find((k) => k.time === time);
		const curve = this.graphEditor ? this.graphEditor.getCurve() : this.activeCurve;

		if (existing) {
			(existing as any)[property] = value;
			if (!existing.bezierCurve) existing.bezierCurve = [...curve];
		} else {
			const kf: DeathScreenKeyframe = {
				time,
				easing: "cubicBezier",
				bezierCurve: [...curve],
			};
			(kf as any)[property] = value;
			elem.keyframes.push(kf);
			elem.keyframes.sort((a, b) => a.time - b.time);
		}
		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateTimelineDock();
	}

	public deleteSelectedKeyframe() {
		if (!this.selectedKeyframeInfo) return;
		const elem = this.screen.elements?.find((e) => e.id === this.selectedKeyframeInfo?.elemId);
		if (elem && elem.keyframes) {
			elem.keyframes.splice(this.selectedKeyframeInfo.keyframeIdx, 1);
			this.selectedKeyframeInfo = null;
			this.hasUnsavedChanges = true;
			this.onSync();
			this.updateTimelineDock();
		}
	}

	public applyTimelineFrame(time: number) {
		const elems = this.screen.elements || [];
		elems.forEach((elem) => {
			const dom = this.canvasEl?.querySelector(`[data-element-id="${elem.id}"]`) as HTMLElement;
			if (!dom) return;

			if (!elem.keyframes || elem.keyframes.length === 0) return;

			const kfs = [...elem.keyframes].sort((a, b) => a.time - b.time);
			let targetOpacity = elem.style?.opacity ?? 1;
			let targetX = elem.x;
			let targetY = elem.y;
			let targetScale = elem.style?.scaleX ?? 1;
			let targetRot = elem.style?.rotation ?? 0;

			if (time <= kfs[0].time) {
				const k0 = kfs[0];
				if (k0.opacity !== undefined) targetOpacity = k0.opacity;
				if (k0.x !== undefined) targetX = k0.x;
				if (k0.y !== undefined) targetY = k0.y;
				if (k0.scale !== undefined) targetScale = k0.scale;
				if (k0.rotation !== undefined) targetRot = k0.rotation;
			} else if (time >= kfs[kfs.length - 1].time) {
				const kLast = kfs[kfs.length - 1];
				if (kLast.opacity !== undefined) targetOpacity = kLast.opacity;
				if (kLast.x !== undefined) targetX = kLast.x;
				if (kLast.y !== undefined) targetY = kLast.y;
				if (kLast.scale !== undefined) targetScale = kLast.scale;
				if (kLast.rotation !== undefined) targetRot = kLast.rotation;
			} else {
				let kA = kfs[0];
				let kB = kfs[kfs.length - 1];
				for (let i = 0; i < kfs.length - 1; i++) {
					if (time >= kfs[i].time && time <= kfs[i + 1].time) {
						kA = kfs[i];
						kB = kfs[i + 1];
						break;
					}
				}
				const segDuration = Math.max(1, kB.time - kA.time);
				const u = (time - kA.time) / segDuration;

				// Calculate progress using Bézier curve
				let p = u;
				if (this.graphEditor) {
					if (kB.bezierCurve) {
						const tempGraph = new StudioGraphEditor({ curve: kB.bezierCurve });
						p = tempGraph.evaluate(u);
					} else {
						p = this.graphEditor.evaluate(u);
					}
				}

				const aOp = kA.opacity ?? elem.style?.opacity ?? 1;
				const bOp = kB.opacity ?? elem.style?.opacity ?? 1;
				targetOpacity = aOp + (bOp - aOp) * p;

				const aX = kA.x ?? elem.x;
				const bX = kB.x ?? elem.x;
				targetX = aX + (bX - aX) * p;

				const aY = kA.y ?? elem.y;
				const bY = kB.y ?? elem.y;
				targetY = aY + (bY - aY) * p;

				const aSc = kA.scale ?? elem.style?.scaleX ?? 1;
				const bSc = kB.scale ?? elem.style?.scaleX ?? 1;
				targetScale = aSc + (bSc - aSc) * p;

				const aRot = kA.rotation ?? elem.style?.rotation ?? 0;
				const bRot = kB.rotation ?? elem.style?.rotation ?? 0;
				targetRot = aRot + (bRot - aRot) * p;
			}

			dom.style.opacity = String(targetOpacity);
			dom.style.left = `${targetX}%`;
			dom.style.top = `${targetY}%`;
			dom.style.transform = `translate(-50%, -50%) rotate(${targetRot}deg) scale(${targetScale})`;
		});
	}

	public playTimelineSequence() {
		this.isPlayingSequence = true;
		this.timelineCurrentTime = 0;
		this.updateTimelineDock();

		const step = 33; // ~30 fps update
		if (this.timelineTimerId) clearInterval(this.timelineTimerId);

		this.timelineTimerId = window.setInterval(() => {
			this.timelineCurrentTime += step * this.playbackSpeed;
			if (this.timelineCurrentTime >= this.timelineTotalDuration) {
				if (this.isLooping) {
					this.timelineCurrentTime = 0;
				} else {
					this.stopTimelineSequence();
					return;
				}
			}
			this.applyTimelineFrame(this.timelineCurrentTime);
			const disp = this.timelineDockEl?.querySelector(".timeline-time-display");
			if (disp) {
				disp.textContent = `${(this.timelineCurrentTime / 1000).toFixed(2)}s / ${(this.timelineTotalDuration / 1000).toFixed(2)}s`;
			}
			const playhead = this.timelineDockEl?.querySelector(".timeline-playhead-line") as HTMLElement;
			if (playhead) {
				playhead.style.left = `${(this.timelineCurrentTime / this.timelineTotalDuration) * 100}%`;
			}
		}, step);
	}

	public stopTimelineSequence() {
		this.isPlayingSequence = false;
		if (this.timelineTimerId) {
			clearInterval(this.timelineTimerId);
			this.timelineTimerId = null;
		}
		this.timelineCurrentTime = 0;
		this.applyTimelineFrame(0);
		this.updateCanvas();
		this.updateTimelineDock();
	}
	// --- 9. BOTTOM STATUS BAR PREMIUM ---
	private createStatusBar(): HTMLElement {
		this.statusBarEl = document.createElement("div");
		this.statusBarEl.className = "studio-status-bar";
		this.statusBarEl.style.cssText = `
			height: 24px;
			background: ${StudioTokens.colors.surface1};
			border-top: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 12px;
			font-size: ${StudioTokens.typography.sizeXs};
			color: ${StudioTokens.colors.textMuted};
			user-select: none;
			z-index: 30;
		`;
		this.updateStatusBar();
		return this.statusBarEl;
	}

	private updateStatusBar() {
		if (!this.statusBarEl) return;
		const selCount = this.selectedElementIds.size;
		const selName = selCount === 1 ? this.getSelectedElements()[0]?.name : `${selCount} elementos`;

		this.statusBarEl.innerHTML = `
			<div style="display:flex; align-items:center; gap:12px;">
				<span>MODO: <strong style="color:${StudioTokens.colors.accent};">${this.activeWorkspaceMode.toUpperCase()}</strong></span>
				<span>HERRAMIENTA: <strong style="color:#fff;">${this.activeCanvasTool === "select" ? "SELECCIÓN (V)" : "MANO / PAN (H)"}</strong></span>
				<span>SELECCIONADO: <strong style="color:#fff;">${selCount > 0 ? selName : "Ninguno"}</strong></span>
			</div>
			<div style="display:flex; align-items:center; gap:12px;">
				<span>ZOOM: ${Math.round(this.zoomLevel * 100)}%</span>
				<span>DISPOSITIVO: ${this.previewDevice.toUpperCase()}</span>
				<span>CAPAS: ${this.screen.elements?.length || 0}</span>
			</div>
		`;
	}

	public updateSaveIndicator() {
		const ind = this.container?.querySelector(".studio-save-indicator");
		if (ind) {
			ind.innerHTML = this.hasUnsavedChanges
				? `<span style="width:6px; height:6px; border-radius:50%; background:${StudioTokens.colors.warning};"></span> Modificado`
				: `${renderStudioIcon("check", 12, StudioTokens.colors.success)} Guardado`;
			(ind as HTMLElement).style.color = this.hasUnsavedChanges ? StudioTokens.colors.warning : StudioTokens.colors.success;
		}
	}

	// --- ELEMENT OPERATIONS ---
	public addElement(type: DeathScreenElementType, name?: string, shapeType?: DeathScreenShapeType): DeathScreenElement {
		this.recordHistory();
		if (!this.screen.elements) this.screen.elements = [];

		const baseElem: DeathScreenElement = {
			id: `elem_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
			name: name || `Nuevo ${type}`,
			type,
			x: 50,
			y: 50,
			width: type === "title" ? 60 : (type === "card" || type === "container" ? 50 : 30),
			height: type === "title" ? 12 : (type === "card" || type === "container" ? 25 : 8),
			zIndex: this.screen.elements.length + 1,
			style: {
				fontSize: type === "title" ? 32 : 14,
				fontWeight: type === "title" ? "bold" : "normal",
				color: "#ffffff",
				textAlign: "center",
				shapeType,
				backgroundColor: type === "container" || type === "card" ? "rgba(20,25,35,0.85)" : "transparent",
				borderRadius: type === "badge" || shapeType === "pill" ? 9999 : 4,
			},
			content: type === "title" ? "HAS CAÍDO" : (type === "subtitle" ? "Reiniciando..." : (type === "action_button" ? "Aceptar" : "")),
			animation: {
				type: "fade_in",
				duration: 400,
				delay: 100,
			},
		};

		this.screen.elements.push(baseElem);
		this.selectedElementIds.clear();
		this.selectedElementIds.add(baseElem.id);
		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateAll();
		return baseElem;
	}

	public duplicateElement(elemId: string) {
		const src = this.screen.elements?.find((e) => e.id === elemId);
		if (!src) return;
		this.recordHistory();
		const clone: DeathScreenElement = JSON.parse(JSON.stringify(src));
		clone.id = `elem_${Date.now()}`;
		clone.name = `${src.name} (Copia)`;
		clone.x = Math.min(95, clone.x + 3);
		clone.y = Math.min(95, clone.y + 3);
		clone.zIndex = (this.screen.elements?.length || 0) + 1;
		this.screen.elements?.push(clone);
		this.selectedElementIds.clear();
		this.selectedElementIds.add(clone.id);
		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateAll();
	}

	public moveLayer(elemId: string, direction: number) {
		if (!this.screen.elements) return;
		const idx = this.screen.elements.findIndex((e) => e.id === elemId);
		if (idx === -1) return;
		const targetIdx = idx + direction;
		if (targetIdx < 0 || targetIdx >= this.screen.elements.length) return;

		this.recordHistory();
		const [moved] = this.screen.elements.splice(idx, 1);
		this.screen.elements.splice(targetIdx, 0, moved);

		// Update z-indexes accordingly
		this.screen.elements.forEach((el, i) => {
			el.zIndex = i + 1;
		});

		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateAll();
	}

	public removeElement(elemId: string) {
		if (!this.screen.elements) return;
		this.recordHistory();
		this.screen.elements = this.screen.elements.filter((e) => e.id !== elemId);
		this.selectedElementIds.delete(elemId);
		this.hasUnsavedChanges = true;
		this.onSync();
		this.updateAll();
	}

	public updateAll() {
		this.updateLayersList();
		this.updateCanvas();
		this.updatePropertiesPanel();
		this.updateTimelineDock();
		this.updateSaveIndicator();
		this.updateStatusBar();
	}
}

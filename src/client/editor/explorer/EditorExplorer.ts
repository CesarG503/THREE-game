import * as THREE from "three";
import { isTextInput } from "../../input/InteractionCoordinator";
/**
 * EditorExplorer.ts
 * VIPER IO — Panel de Explorer jerárquico del editor.
 *
 * Visualiza, selecciona y organiza grupos, subgrupos y objetos individuales:
 * - Creación diferenciada de grupos en la raíz y subgrupos explícitos.
 * - Drag-and-drop en el árbol: reparenting dentro de grupos, reordenamiento entre hermanos y desacople a la raíz.
 * - Indicadores visuales en tiempo real del destino (válido / inválido / reordenar).
 * - Sincronización bidireccional con escena 3D y ObjectInspector.
 * - Soporte para Undo/Redo atómico con ReparentCommand.
 */

import { EditorHierarchyModel, type HierarchyNode } from "../hierarchy/EditorHierarchyModel";
import { EditorGroupManager } from "../hierarchy/EditorGroupManager";
import { EditorClipboard } from "../clipboard/EditorClipboard";
import { EditorCommandHistory, ReparentCommand, DuplicateCommand, GroupNodesCommand, CompositeCommand } from "../history/EditorCommandHistory";
import { PrefabManager } from "../prefabs/PrefabManager";
import { PrefabSerializer } from "../prefabs/PrefabSerializer";
import { PrefabService } from "../prefabs/PrefabService";
import type { PlatformPrefabDto } from "../prefabs/PrefabTypes";
import { EDITOR_DESKTOP_TOOL_ACTIONS } from "./EditorActionCatalog";

export interface EditorExplorerOptions {
	shortcutKey?: string; // Por defecto 'h'
	initialVisible?: boolean; // Por defecto false
}

export class EditorExplorer {
	private game: any;
	private events = new AbortController();
	private hierarchy: EditorHierarchyModel;
	private groupManager: EditorGroupManager;
	private clipboard: EditorClipboard;
	private history: EditorCommandHistory;
	private prefabManager: PrefabManager;

	public container!: HTMLElement;
	private currentTab: "scene" | "library" | "properties" = "scene";
	private activityBar!: HTMLElement;
	private mainPanel!: HTMLElement;
	private headerTitleIcon!: HTMLElement;
	private headerTitleText!: HTMLElement;
	private btnTabScene!: HTMLElement;
	private btnTabLibrary!: HTMLElement;
	private btnTabProperties!: HTMLElement;
	private sceneContentContainer!: HTMLElement;
	private libraryContainer!: HTMLElement;
	private propertiesContentContainer!: HTMLElement;
	private propertiesEmptyPlaceholder!: HTMLElement;

	private treeContainer!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private btnToggleCoupling!: HTMLButtonElement;
	private btnTogglePivotEdit!: HTMLButtonElement;

	private librarySearchInput!: HTMLInputElement;
	private libraryCategorySelect!: HTMLSelectElement;
	private libraryListContainer!: HTMLElement;
	private cachedPrefabsList: PlatformPrefabDto[] = [];
	private isLoadingLibrary: boolean = false;

	public isVisible: boolean = false;
	private isCollapsed: boolean = false;
	private collapsedGroups: Set<string> = new Set();
	private _selectedNodeId: string | null = null;
	get selectedNodeId(): string | null {
		return this.game?.editorSelection?.getActiveId() ?? this._selectedNodeId;
	}
	set selectedNodeId(v: string | null) {
		this._selectedNodeId = v;
	}

	isNodeSelected(nodeId: string): boolean {
		if (this.game?.editorSelection) {
			return this.game.editorSelection.isSelected(nodeId);
		}
		return this.selectedNodeId === nodeId;
	}

	getVisibleNodeIds(): string[] {
		const visible: string[] = [];
		const traverse = (parentId: string | null) => {
			const children = this.hierarchy.getChildren(parentId);
			for (const child of children) {
				if (this.searchQuery) {
					const matchSelf = (child.customName || child.name).toLowerCase().includes(this.searchQuery);
					const matchDescendant = this.hierarchy.getDescendants(child.id).some((d) =>
						(d.customName || d.name).toLowerCase().includes(this.searchQuery)
					);
					if (!matchSelf && !matchDescendant) continue;
				}
				visible.push(child.id);
				if (child.isGroup && !this.collapsedGroups.has(child.id)) {
					traverse(child.id);
				}
			}
		};
		traverse(null);
		return visible;
	}

	updateSelectionVisuals() {
		const rows = this.treeContainer.querySelectorAll<HTMLElement>("[data-node-id]");
		const selection = this.game?.editorSelection;
		const activeId = selection ? selection.getActiveId() : this.selectedNodeId;

		rows.forEach((row) => {
			const nodeId = row.getAttribute("data-node-id");
			if (!nodeId) return;
			const isSelected = selection ? selection.isSelected(nodeId) : (this.selectedNodeId === nodeId);
			const isActive = (activeId === nodeId);
			const node = this.hierarchy.getNode(nodeId);
			const isPrefabRoot = !!node?.metadata?.isPrefabRoot;
			const isPrefabMember = !!node?.metadata?.prefabInstanceId;

			row.classList.toggle("selected", isSelected);
			row.classList.toggle("active-selection", isActive);

			if (isActive) {
				row.style.background = "rgba(255, 255, 255, 0.22)";
				row.style.color = "#ffffff";
				row.style.fontWeight = "bold";
				row.style.borderColor = "#888";
				row.style.borderLeft = isPrefabRoot ? "3px solid #ffc107" : isPrefabMember ? "2px solid #ca8a04" : "3px solid #fff";
			} else if (isSelected) {
				row.style.background = "rgba(255, 255, 255, 0.12)";
				row.style.color = "#eeeeee";
				row.style.fontWeight = "bold";
				row.style.borderColor = "#555";
				row.style.borderLeft = isPrefabRoot ? "3px solid #ffc107" : isPrefabMember ? "2px solid #ca8a04" : "3px solid #60a5fa";
			} else {
				row.style.background = "transparent";
				row.style.color = "#cccccc";
				row.style.fontWeight = "normal";
				row.style.borderColor = "transparent";
				row.style.borderLeft = isPrefabRoot ? "3px solid #ffc107" : isPrefabMember ? "2px solid #ca8a04" : "transparent";
			}
		});

		if (this.currentTab === "properties") {
			this.updatePropertiesView(false);
		}
	}
	private searchQuery: string = "";
	private shortcutKey: string = "h";

	// Ancho configurable, límites y resizer
	public readonly minWidth: number = 260;
	public readonly maxWidth: number = 600;
	public currentWidth: number = 340;
	private isResizing: boolean = false;
	private resizerElement!: HTMLElement;
	private hideTimeoutId: any = null;

	// Estado de arrastre en el árbol (soporta arrastre múltiple)
	private draggedNodeIds: string[] = [];
	get draggedNodeId(): string | null {
		return this.draggedNodeIds.length > 0 ? this.draggedNodeIds[0] : null;
	}
	set draggedNodeId(id: string | null) {
		this.draggedNodeIds = id ? [id] : [];
	}
	private isSyncingSelection: boolean = false;

	constructor(
		game: any,
		hierarchy: EditorHierarchyModel,
		groupManager: EditorGroupManager,
		clipboard: EditorClipboard,
		history: EditorCommandHistory,
		prefabManager: PrefabManager,
		options: EditorExplorerOptions = {}
	) {
		this.game = game;
		this.hierarchy = hierarchy;
		this.groupManager = groupManager;
		this.clipboard = clipboard;
		this.history = history;
		this.prefabManager = prefabManager;
		if (options.shortcutKey) this.shortcutKey = options.shortcutKey.toLowerCase();

		// Restaurar ancho previo si existe en localStorage
		if (typeof localStorage !== "undefined") {
			try {
				const savedWidth = localStorage.getItem("viper_editor_explorer_width");
				if (savedWidth) {
					const parsed = parseInt(savedWidth, 10);
					if (!isNaN(parsed) && parsed >= this.minWidth && parsed <= this.maxWidth) {
						this.currentWidth = parsed;
					}
				}
			} catch {}
		}

		this.buildUI();
		this.setupKeyboardShortcuts();
		this.renderTree();
		if (options.initialVisible) {
			this.show();
		} else {
			this.hide(true);
		}
	}

	private buildUI() {
		// Contenedor lateral acoplado (dock) del Explorer con animación desde el costado
		this.container = document.createElement("div");
		this.container.id = "editor-hierarchy-explorer";
		this.container.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			width: ${this.currentWidth}px;
			min-width: ${this.minWidth}px;
			max-width: min(${this.maxWidth}px, 60vw);
			height: 100vh;
			height: 100dvh;
			box-sizing: border-box;
			overflow: hidden;
			background: rgba(15, 15, 15, 0.78);
			backdrop-filter: blur(14px);
			-webkit-backdrop-filter: blur(14px);
			border-right: 2px solid rgba(255, 255, 255, 0.2);
			border-top: 2px solid rgba(255, 255, 255, 0.15);
			border-bottom: 2px solid rgba(255, 255, 255, 0.15);
			border-left: none;
			border-top-right-radius: 12px;
			border-bottom-right-radius: 12px;
			box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
			color: white;
			font-family: sans-serif;
			font-size: 13px;
			display: none;
			flex-direction: row;
			z-index: 2500;
			user-select: none;
			transform: translateX(-100%);
			opacity: 0;
			pointer-events: none;
			transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
		`;

		// ── Barra de Actividad vertical (Menú de Iconos a un costado como VSCode) ──
		this.activityBar = document.createElement("div");
		this.activityBar.id = "editor-explorer-activity-bar";
		this.activityBar.style.cssText = `
			width: 48px;
			flex-shrink: 0;
			height: 100%;
			background: rgba(0, 0, 0, 0.42);
			border-right: 1px solid rgba(255, 255, 255, 0.12);
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: 12px 0;
			gap: 8px;
			box-sizing: border-box;
			z-index: 5;
		`;

		const createIconButton = (svgHtml: string, title: string, onClick: () => void) => {
			const btn = document.createElement("div");
			btn.title = title;
			btn.innerHTML = svgHtml;
			btn.style.cssText = `
				width: 38px;
				height: 38px;
				border-radius: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				color: #888;
				background: transparent;
				border: 1px solid transparent;
				border-left: 2px solid transparent;
				box-sizing: border-box;
				transition: all 0.15s ease;
				user-select: none;
			`;
			btn.onmouseenter = () => {
				if (btn.dataset.active !== "true") {
					btn.style.color = "#ddd";
					btn.style.background = "rgba(255, 255, 255, 0.08)";
				}
			};
			btn.onmouseleave = () => {
				if (btn.dataset.active !== "true") {
					btn.style.color = "#888";
					btn.style.background = "transparent";
				}
			};
			btn.onclick = onClick;
			return btn;
		};

		// 1. Icono Escena (Explorador / Jerarquía estilo VSCode)
		const iconSceneSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M8 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"/></svg>`;
		this.btnTabScene = createIconButton(iconSceneSvg, "Escena (Jerarquía y objetos)", () => this.switchTab("scene"));

		// 2. Icono Biblioteca (Prefabs / Extensiones)
		const iconLibSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
		this.btnTabLibrary = createIconButton(iconLibSvg, "Biblioteca (Prefabs)", () => this.switchTab("library"));

		// 3. Icono Propiedades (Inspector)
		const iconPropSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;
		this.btnTabProperties = createIconButton(iconPropSvg, "Propiedades (Inspector del objeto)", () => this.switchTab("properties"));

		this.activityBar.appendChild(this.btnTabScene);
		this.activityBar.appendChild(this.btnTabLibrary);
		this.activityBar.appendChild(this.btnTabProperties);
		this.container.appendChild(this.activityBar);

		// ── Panel Principal a la derecha de la barra de actividad ───────────────
		this.mainPanel = document.createElement("div");
		this.mainPanel.id = "editor-explorer-main";
		this.mainPanel.style.cssText = `
			flex: 1 1 auto;
			min-width: 0;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			background: transparent;
		`;
		this.container.appendChild(this.mainPanel);

		// ── Encabezado ──────────────────────────────────────────────────────────
		const header = document.createElement("div");
		header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			border-bottom: 1px solid rgba(255, 255, 255, 0.12);
			flex-shrink: 0;
		`;

		const titleBox = document.createElement("div");
		titleBox.style.cssText = `display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; color: white;`;

		this.headerTitleIcon = document.createElement("span");
		this.headerTitleIcon.textContent = "🗂️";

		this.headerTitleText = document.createElement("span");
		this.headerTitleText.textContent = "Jerarquía / Escena";

		const headerBadge = document.createElement("span");
		headerBadge.textContent = `[${this.shortcutKey.toUpperCase()}]`;
		headerBadge.style.cssText = `font-size: 10px; background: #222; color: #aaa; padding: 2px 5px; border-radius: 4px; border: 1px solid #444; font-weight: normal;`;

		titleBox.appendChild(this.headerTitleIcon);
		titleBox.appendChild(this.headerTitleText);
		titleBox.appendChild(headerBadge);

		const headerControls = document.createElement("div");
		headerControls.style.cssText = `display: flex; align-items: center; gap: 12px;`;

		const btnCollapse = document.createElement("span");
		btnCollapse.textContent = "▲";
		btnCollapse.title = "Minimizar / Maximizar";
		btnCollapse.style.cssText = `color: #aaa; cursor: pointer; font-size: 16px; transition: color 0.15s ease; user-select: none;`;
		btnCollapse.onmouseenter = () => (btnCollapse.style.color = "#fff");
		btnCollapse.onmouseleave = () => (btnCollapse.style.color = "#aaa");
		btnCollapse.onclick = () => this.toggleCollapse();

		const btnClose = document.createElement("span");
		btnClose.textContent = "✕";
		btnClose.title = `Ocultar (Atajo: tecla '${this.shortcutKey.toUpperCase()}')`;
		btnClose.style.cssText = `color: #aaa; cursor: pointer; font-size: 20px; transition: color 0.15s ease; user-select: none;`;
		btnClose.onmouseenter = () => (btnClose.style.color = "#fff");
		btnClose.onmouseleave = () => (btnClose.style.color = "#aaa");
		btnClose.onclick = () => this.hide();

		headerControls.appendChild(btnCollapse);
		headerControls.appendChild(btnClose);
		header.appendChild(titleBox);
		header.appendChild(headerControls);
		this.mainPanel.appendChild(header);

		// ── Tirador de Resize lateral (Borde derecho) ───────────────────────────
		this.resizerElement = document.createElement("div");
		this.resizerElement.id = "editor-explorer-resizer";
		this.resizerElement.title = `Arrastra para ajustar el ancho (${this.minWidth}px - ${this.maxWidth}px)`;
		this.resizerElement.style.cssText = `
			position: absolute;
			top: 0;
			right: 0;
			width: 6px;
			height: 100%;
			cursor: col-resize;
			z-index: 2510;
			background: transparent;
			transition: background 0.15s ease;
		`;
		this.container.appendChild(this.resizerElement);
		this.setupResizer();

		// ── Contenedor de la pestaña Escena ──────────────────────────────────────
		this.sceneContentContainer = document.createElement("div");
		this.sceneContentContainer.style.cssText = `
			display: flex;
			flex-direction: column;
			flex: 1 1 auto;
			min-height: 0;
			overflow: hidden;
		`;

		// ── Barra de herramientas ───────────────────────────────────────────────
		const toolbar = document.createElement("div");
		toolbar.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			padding: 8px 12px;
			background: rgba(255, 255, 255, 0.04);
			border-bottom: 1px solid #444;
			flex-shrink: 0;
		`;

		const createBtn = (label: string, title: string, onClick: () => void, accentColor?: string) => {
			const btn = document.createElement("button");
			btn.textContent = label;
			btn.title = title;
			btn.style.cssText = `
				background: ${accentColor ? accentColor : "#444"};
				color: white;
				border: 1px solid #555;
				border-radius: 4px;
				padding: 5px 8px;
				font-size: 11px;
				font-weight: 500;
				cursor: pointer;
				font-family: sans-serif;
				transition: all 0.15s ease;
			`;
			btn.onmouseenter = () => (btn.style.filter = "brightness(1.2)");
			btn.onmouseleave = () => (btn.style.filter = "none");
			btn.onclick = onClick;
			return btn;
		};

		// Botón Grupo (Agrupa elementos seleccionados o crea grupo en raíz)
		const btnNewGroup = createBtn("Grupo", "Agrupa los elementos seleccionados en un nuevo grupo (Ctrl+G), o crea un grupo vacío si no hay selección", () => {
			this.handleCreateGroup();
		});
		btnNewGroup.dataset.editorAction = "create-group";

		// Botón Crear Subgrupo Explícito (Acción diferenciada)
		const btnNewSubgroup = createBtn("+ Subgrupo", "Crea un subgrupo explícito dentro del grupo seleccionado", () => {
			this.handleCreateSubgroup();
		});
		btnNewSubgroup.dataset.editorAction = "create-subgroup";

		// Botón Agrupar Selección (Agrupa el elemento seleccionado dentro de un nuevo grupo)
		const btnGroupSelection = createBtn("Agrupar", "Agrupa los elementos seleccionados dentro de un nuevo grupo (Ctrl+G)", () => {
			this.handleGroupSelection();
		});
		btnGroupSelection.dataset.editorAction = "group";

		// Botón Desagrupar
		const btnUngroup = createBtn("Desagrupar", "Desagrupa el grupo seleccionado devolviendo sus hijos al nivel superior (Ctrl+Shift+G)", () => {
			this.handleUngroup();
		});
		btnUngroup.dataset.editorAction = "ungroup";

		// Botón Desacoplar
		const btnDecouple = createBtn("Desacoplar", "Desacopla el elemento seleccionado de su grupo actual (sube a la raíz)", () => {
			this.handleDecouple();
		});
		btnDecouple.dataset.editorAction = "decouple";

		// Botón Modo Acoples (Visualizar líneas y recuadros conectores 3D)
		this.btnToggleCoupling = createBtn(
			"Acoples: OFF",
			"Modo Acoples 3D: Muestra los recuadros superiores de acople.\n• Arrastrar recuadro: Mover objeto en 3D (conserva su grupo)\n• Shift + Arrastrar: Vincular / Acoplar a otro grupo\n• Clic derecho: Desacoplar a la raíz\n(Atajo: tecla 'C')",
			() => {
				this.toggleCouplingMode();
			}
		);
		this.btnToggleCoupling.dataset.editorAction = "coupling";

		// Botón Modo Editar Pivote (Reubicar pivote sin mover objetos)
		this.btnTogglePivotEdit = createBtn("Pivote: OFF", "Modo para reubicar el pivote de un grupo sin mover sus objetos", () => {
			this.togglePivotEditMode();
		});
		this.btnTogglePivotEdit.dataset.editorAction = "pivot";

		// Botón Duplicar (Portapapeles gestionado por atajos universales Ctrl+C / Ctrl+V)
		const btnDuplicate = createBtn("Duplicar", "Duplica el elemento o grupo actual con nuevos UUIDs (Ctrl+D)", () => this.handleDuplicate());
		btnDuplicate.dataset.editorAction = "duplicate";

		// Botones Prefab
		const btnSavePrefab = createBtn("⭐ Prefab", "Guarda el grupo seleccionado como un prefab persistente", () => this.handleSavePrefab());
		const btnExport = createBtn("📤 Exp", "Exporta el grupo seleccionado como JSON descargable", () => this.handleExportJson());
		const btnImport = createBtn("📥 Imp", "Importa un archivo JSON de prefab", () => this.handleImportJson());
		btnSavePrefab.dataset.editorAction = "save-prefab";
		btnExport.dataset.editorAction = "export";
		btnImport.dataset.editorAction = "import";
		const desktopActionIds = new Set(EDITOR_DESKTOP_TOOL_ACTIONS.map(({ id }) => id));
		const desktopButtons = [btnNewGroup, btnNewSubgroup, btnGroupSelection, btnUngroup, btnDecouple, this.btnToggleCoupling, this.btnTogglePivotEdit, btnDuplicate, btnSavePrefab, btnExport, btnImport];
		const renderedDesktopActionIds = new Set(desktopButtons.map((button) => button.dataset.editorAction));
		if (renderedDesktopActionIds.size !== desktopActionIds.size || [...desktopActionIds].some((id) => !renderedDesktopActionIds.has(id))) {
			throw new Error("Las herramientas del editor de escritorio no coinciden con el catálogo de acciones");
		}

		toolbar.appendChild(btnNewGroup);
		toolbar.appendChild(btnNewSubgroup);
		toolbar.appendChild(btnGroupSelection);
		toolbar.appendChild(btnUngroup);
		toolbar.appendChild(btnDecouple);
		toolbar.appendChild(this.btnToggleCoupling);
		toolbar.appendChild(this.btnTogglePivotEdit);
		toolbar.appendChild(btnDuplicate);
		toolbar.appendChild(btnSavePrefab);
		toolbar.appendChild(btnExport);
		toolbar.appendChild(btnImport);
		this.sceneContentContainer.appendChild(toolbar);

		// ── Buscador ───────────────────────────────────────────────────────────
		const searchRow = document.createElement("div");
		searchRow.style.cssText = `padding: 8px 12px; background: rgba(0, 0, 0, 0.25); border-bottom: 1px solid #444; flex-shrink: 0;`;
		this.searchInput = document.createElement("input");
		this.searchInput.type = "text";
		this.searchInput.placeholder = "🔍 Buscar objeto o grupo...";
		this.searchInput.style.cssText = `
			width: 100%;
			box-sizing: border-box;
			background: #222;
			border: 1px solid #444;
			border-radius: 4px;
			color: white;
			padding: 6px 10px;
			font-size: 11px;
			font-family: sans-serif;
			outline: none;
		`;
		this.searchInput.oninput = (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderTree();
		};
		searchRow.appendChild(this.searchInput);
		this.sceneContentContainer.appendChild(searchRow);

		// ── Contenedor del árbol ────────────────────────────────────────────────
		this.treeContainer = document.createElement("div");
		this.treeContainer.style.cssText = `
			padding: 8px 12px;
			overflow-y: auto;
			overflow-x: hidden;
			flex: 1 1 auto;
			min-height: 80px;
			overscroll-behavior: contain;
			display: flex;
			flex-direction: column;
			gap: 2px;
			box-sizing: border-box;
		`;
		this.sceneContentContainer.appendChild(this.treeContainer);
		this.mainPanel.appendChild(this.sceneContentContainer);

		// ── Contenedor de la pestaña Biblioteca ──────────────────────────────────
		this.libraryContainer = document.createElement("div");
		this.libraryContainer.style.cssText = `
			display: none;
			flex-direction: column;
			flex: 1 1 auto;
			min-height: 0;
			overflow: hidden;
		`;

		const libSearchRow = document.createElement("div");
		libSearchRow.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 6px;
			padding: 8px 12px;
			background: rgba(0, 0, 0, 0.25);
			border-bottom: 1px solid #444;
			flex-shrink: 0;
		`;

		const searchInputAndRefresh = document.createElement("div");
		searchInputAndRefresh.style.cssText = `display: flex; gap: 6px; align-items: center;`;

		this.librarySearchInput = document.createElement("input");
		this.librarySearchInput.type = "text";
		this.librarySearchInput.placeholder = "🔍 Buscar prefab o etiqueta...";
		this.librarySearchInput.style.cssText = `
			flex: 1;
			box-sizing: border-box;
			background: #222;
			border: 1px solid #444;
			border-radius: 4px;
			color: white;
			padding: 6px 10px;
			font-size: 11px;
			font-family: sans-serif;
			outline: none;
		`;
		this.librarySearchInput.oninput = () => this.renderLibrary();

		const btnRefreshLib = document.createElement("button");
		btnRefreshLib.textContent = "🔄";
		btnRefreshLib.title = "Recargar biblioteca";
		btnRefreshLib.style.cssText = `
			background: #444;
			color: white;
			border: 1px solid #555;
			border-radius: 4px;
			padding: 5px 8px;
			font-size: 11px;
			cursor: pointer;
			transition: all 0.15s ease;
		`;
		btnRefreshLib.onmouseenter = () => (btnRefreshLib.style.filter = "brightness(1.2)");
		btnRefreshLib.onmouseleave = () => (btnRefreshLib.style.filter = "none");
		btnRefreshLib.onclick = () => this.loadLibraryPrefabs();

		searchInputAndRefresh.appendChild(this.librarySearchInput);
		searchInputAndRefresh.appendChild(btnRefreshLib);

		const filterRow = document.createElement("div");
		filterRow.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 6px;`;

		const filterLabel = document.createElement("span");
		filterLabel.textContent = "Categoría:";
		filterLabel.style.cssText = `font-size: 11px; color: #aaa; font-family: sans-serif;`;

		this.libraryCategorySelect = document.createElement("select");
		this.libraryCategorySelect.style.cssText = `
			flex: 1;
			background: #222;
			border: 1px solid #444;
			border-radius: 4px;
			color: white;
			padding: 4px 6px;
			font-size: 11px;
			font-family: sans-serif;
			outline: none;
			cursor: pointer;
		`;
		this.libraryCategorySelect.innerHTML = `
			<option value="all">Todas las categorías</option>
			<option value="general">General</option>
			<option value="defensas">Defensas</option>
			<option value="edificios">Edificios</option>
			<option value="vehiculos">Vehículos</option>
			<option value="decoracion">Decoración</option>
		`;
		this.libraryCategorySelect.onchange = () => this.renderLibrary();

		filterRow.appendChild(filterLabel);
		filterRow.appendChild(this.libraryCategorySelect);

		libSearchRow.appendChild(searchInputAndRefresh);
		libSearchRow.appendChild(filterRow);
		this.libraryContainer.appendChild(libSearchRow);

		this.libraryListContainer = document.createElement("div");
		this.libraryListContainer.style.cssText = `
			padding: 8px 12px;
			overflow-y: auto;
			overflow-x: hidden;
			flex: 1 1 auto;
			min-height: 80px;
			overscroll-behavior: contain;
			display: flex;
			flex-direction: column;
			gap: 8px;
			box-sizing: border-box;
		`;
		this.libraryContainer.appendChild(this.libraryListContainer);
		this.mainPanel.appendChild(this.libraryContainer);

		// ── Contenedor de la pestaña Propiedades (Inspector) ────────────────────
		this.propertiesContentContainer = document.createElement("div");
		this.propertiesContentContainer.style.cssText = `
			display: none;
			flex-direction: column;
			flex: 1 1 auto;
			min-height: 0;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: #444 #222;
			box-sizing: border-box;
		`;

		this.propertiesEmptyPlaceholder = document.createElement("div");
		this.propertiesEmptyPlaceholder.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			min-height: 250px;
			color: #888;
			text-align: center;
			padding: 40px 20px;
			gap: 12px;
			box-sizing: border-box;
			user-select: none;
		`;
		this.propertiesEmptyPlaceholder.innerHTML = `
			<div style="font-size: 36px; opacity: 0.5;">🎛️</div>
			<div style="font-size: 14px; font-weight: bold; color: #ddd;">Propiedades del Objeto</div>
			<div style="font-size: 12px; color: #999; max-width: 220px; line-height: 1.5;">Selecciona un objeto o grupo en la escena o en la lista de jerarquía para ver y modificar sus propiedades.</div>
		`;
		this.propertiesContentContainer.appendChild(this.propertiesEmptyPlaceholder);
		this.mainPanel.appendChild(this.propertiesContentContainer);
		if (this.game?.objectInspector?.container) {
			this.ensureInspectorDocked();
		}

		const style = document.createElement("style");
		style.textContent = `
			#editor-hierarchy-explorer.open {
				transform: translateX(0) !important;
				opacity: 1 !important;
				pointer-events: auto !important;
			}
			#editor-hierarchy-explorer.resizing {
				transition: none !important;
				user-select: none !important;
			}
			#editor-explorer-resizer:hover,
			#editor-explorer-resizer.active {
				background: #777 !important;
				box-shadow: 0 0 10px rgba(255, 255, 255, 0.4) !important;
			}
			#editor-explorer-activity-bar div:hover {
				background: rgba(255, 255, 255, 0.08);
				color: #ddd;
			}
			#editor-hierarchy-explorer *::-webkit-scrollbar {
				width: 6px;
				height: 6px;
			}
			#editor-hierarchy-explorer *::-webkit-scrollbar-track {
				background: #222;
			}
			#editor-hierarchy-explorer *::-webkit-scrollbar-thumb {
				background: #444;
				border-radius: 4px;
			}
			#editor-hierarchy-explorer *::-webkit-scrollbar-thumb:hover {
				background: #666;
			}
			#editor-hierarchy-explorer [draggable="true"] {
				width: 100%;
				box-sizing: border-box;
				min-width: 0;
			}
			#editor-hierarchy-explorer input:focus,
			#editor-hierarchy-explorer select:focus {
				border-color: #777 !important;
				background: #282828 !important;
			}
		`;
		this.container.appendChild(style);
		document.body.appendChild(this.container);
	}

	private setupResizer() {
		if (!this.resizerElement || typeof window === "undefined") return;

		this.resizerElement.addEventListener("pointerdown", (e: PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.isResizing = true;
			this.resizerElement.classList?.add?.("active");
			this.container.classList?.add?.("resizing");
			if (document.body) {
				document.body.style.cursor = "col-resize";
				document.body.style.userSelect = "none";
			}

			const onPointerMove = (moveEvent: PointerEvent) => {
				if (!this.isResizing) return;
				const maxW = Math.min(this.maxWidth, window.innerWidth * 0.6);
				const newWidth = Math.round(Math.max(this.minWidth, Math.min(maxW, moveEvent.clientX)));
				this.setWidth(newWidth);
			};

			const onPointerUp = () => {
				this.isResizing = false;
				this.resizerElement.classList?.remove?.("active");
				this.container.classList?.remove?.("resizing");
				if (document.body) {
					document.body.style.cursor = "";
					document.body.style.userSelect = "";
				}
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
				if (typeof localStorage !== "undefined") {
					try {
						localStorage.setItem("viper_editor_explorer_width", String(this.currentWidth));
					} catch {}
				}
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		}, { signal: this.events.signal });
	}

	public setWidth(width: number) {
		const maxW = typeof window !== "undefined" ? Math.min(this.maxWidth, window.innerWidth * 0.6) : this.maxWidth;
		const clamped = Math.round(Math.max(this.minWidth, Math.min(maxW, width)));
		this.currentWidth = clamped;
		this.container.style.width = `${clamped}px`;
	}

	private setupKeyboardShortcuts() {
		window.addEventListener("keydown", (e: KeyboardEvent) => {
			// Ignorar si el foco está en un campo de texto
			if (e.defaultPrevented || e.repeat || this.game.gameMode !== "editor" || isTextInput(document.activeElement)) return;

			// Alternar visibilidad con atajo configurable (por defecto 'H')
			if (e.key.toLowerCase() === this.shortcutKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				this.toggleVisibility();
				return;
			}

			if (this.game.interaction?.blocksScene) return;

			// Alternar modo de acoples con tecla 'C' cuando el editor esté activo
			if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				if (this.game.gameMode === "editor") {
					e.preventDefault();
					this.toggleCouplingMode();
					return;
				}
			}

			// Deshacer / Rehacer
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
				if (e.shiftKey) {
					if (this.history.canRedo()) {
						e.preventDefault();
						this.history.redo();
						this.renderTree();
					}
				} else {
					if (this.history.canUndo()) {
						e.preventDefault();
						this.history.undo();
						this.renderTree();
					}
				}
			}

			// Copiar con Ctrl+C
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				this.handleCopy();
				return;
			}

			// Pegar con Ctrl+V
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				this.handlePaste();
				return;
			}

			// Duplicar con Ctrl+D
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				this.handleDuplicate();
				return;
			}

			// Agrupar con Ctrl+G
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && !e.shiftKey) {
				e.preventDefault();
				this.handleGroupSelection();
				return;
			}

			// Desagrupar con Ctrl+Shift+G
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && e.shiftKey) {
				e.preventDefault();
				this.handleUngroup();
				return;
			}
		}, { signal: this.events.signal });
	}

	show() {
		if (this.hideTimeoutId) {
			clearTimeout(this.hideTimeoutId);
			this.hideTimeoutId = null;
		}
		this.isVisible = true;
		this.container.style.display = "flex";
		this.container.style.flexDirection = "row";
		this.ensureInspectorDocked();
		this.switchTab(this.currentTab);

		if (typeof requestAnimationFrame !== "undefined") {
			requestAnimationFrame(() => {
				this.container.classList?.add?.("open");
				this.container.style.transform = "translateX(0)";
				this.container.style.opacity = "1";
				this.container.style.pointerEvents = "auto";
			});
		} else {
			this.container.classList?.add?.("open");
			this.container.style.transform = "translateX(0)";
			this.container.style.opacity = "1";
			this.container.style.pointerEvents = "auto";
		}

		this.renderTree();
		if (this.game?.updateEditorInteractionMode) {
			this.game.updateEditorInteractionMode();
		} else {
			if (typeof document !== "undefined" && document.pointerLockElement) {
				document.exitPointerLock();
			}
			if (this.game?.cameraController) {
				this.game.cameraController.setUIOpen(true);
			}
		}
	}

	hide(immediate: boolean = false) {
		this.cancelDrag();
		this.isVisible = false;

		if (this.hideTimeoutId) {
			clearTimeout(this.hideTimeoutId);
			this.hideTimeoutId = null;
		}

		this.container.classList?.remove?.("open");
		this.container.style.transform = "translateX(-100%)";
		this.container.style.opacity = "0";
		this.container.style.pointerEvents = "none";

		if (immediate || typeof setTimeout === "undefined") {
			this.container.style.display = "none";
		} else {
			this.hideTimeoutId = setTimeout(() => {
				if (!this.isVisible) {
					this.container.style.display = "none";
				}
				this.hideTimeoutId = null;
			}, 300);
		}

		if (this.game?.updateEditorInteractionMode) {
			this.game.updateEditorInteractionMode();
		} else if (this.game?.cameraController) {
			this.game.cameraController.setUIOpen(false);
		}
	}

	toggleVisibility() {
		if (this.isVisible) this.hide();
		else this.show();
	}

	public switchTab(tab: "scene" | "library" | "properties") {
		this.currentTab = tab;

		const updateBtnState = (btn: HTMLElement, isActive: boolean) => {
			if (!btn) return;
			btn.dataset.active = isActive ? "true" : "false";
			if (isActive) {
				btn.style.color = "#ffffff";
				btn.style.background = "rgba(255, 255, 255, 0.16)";
				btn.style.border = "1px solid rgba(255, 255, 255, 0.28)";
				btn.style.borderLeft = "2px solid #ffffff";
			} else {
				btn.style.color = "#888";
				btn.style.background = "transparent";
				btn.style.border = "1px solid transparent";
				btn.style.borderLeft = "2px solid transparent";
			}
		};

		updateBtnState(this.btnTabScene, tab === "scene");
		updateBtnState(this.btnTabLibrary, tab === "library");
		updateBtnState(this.btnTabProperties, tab === "properties");

		if (tab === "scene") {
			if (this.sceneContentContainer) this.sceneContentContainer.style.display = "flex";
			if (this.libraryContainer) this.libraryContainer.style.display = "none";
			if (this.propertiesContentContainer) this.propertiesContentContainer.style.display = "none";
			if (this.headerTitleIcon) this.headerTitleIcon.textContent = "🗂️";
			if (this.headerTitleText) this.headerTitleText.textContent = "Jerarquía / Escena";
			this.renderTree();
		} else if (tab === "library") {
			if (this.sceneContentContainer) this.sceneContentContainer.style.display = "none";
			if (this.libraryContainer) this.libraryContainer.style.display = "flex";
			if (this.propertiesContentContainer) this.propertiesContentContainer.style.display = "none";
			if (this.headerTitleIcon) this.headerTitleIcon.textContent = "📦";
			if (this.headerTitleText) this.headerTitleText.textContent = "Biblioteca de Prefabs";
			this.loadLibraryPrefabs();
		} else if (tab === "properties") {
			if (this.sceneContentContainer) this.sceneContentContainer.style.display = "none";
			if (this.libraryContainer) this.libraryContainer.style.display = "none";
			if (this.propertiesContentContainer) this.propertiesContentContainer.style.display = "flex";
			if (this.headerTitleIcon) this.headerTitleIcon.textContent = "🎛️";
			if (this.headerTitleText) this.headerTitleText.textContent = "Propiedades / Inspector";
			this.updatePropertiesView();
		}
	}

	private ensureInspectorDocked() {
		if (!this.game?.objectInspector?.container || !this.propertiesContentContainer) return;
		const c = this.game.objectInspector.container;
		if (c.parentElement === this.propertiesContentContainer) return;

		c.style.position = "static";
		c.style.top = "auto";
		c.style.right = "auto";
		c.style.width = "100%";
		c.style.maxHeight = "none";
		c.style.height = "auto";
		c.style.border = "none";
		c.style.borderRadius = "0";
		c.style.boxShadow = "none";
		c.style.background = "transparent";
		c.style.padding = "10px 14px";
		c.style.boxSizing = "border-box";
		if (c.firstElementChild) {
			(c.firstElementChild as HTMLElement).style.display = "none";
		}
		if (c.parentElement && typeof c.parentElement.removeChild === "function") {
			c.parentElement.removeChild(c);
		}
		this.propertiesContentContainer.appendChild(c);
	}

	public updatePropertiesView(syncInspector: boolean = true) {
		if (!this.propertiesContentContainer) return;

		this.ensureInspectorDocked();

		// Si no hay nodo seleccionado
		if (!this.selectedNodeId) {
			if (this.propertiesEmptyPlaceholder) this.propertiesEmptyPlaceholder.style.display = "flex";
			if (this.game?.objectInspector?.container) {
				this.game.objectInspector.container.style.display = "none";
			}
			return;
		}

		if (this.propertiesEmptyPlaceholder) this.propertiesEmptyPlaceholder.style.display = "none";

		if (this.game?.objectInspector && this.game.objectInspector.container) {
			const inspectorContainer = this.game.objectInspector.container;

			if (syncInspector) {
				const node = this.hierarchy.getNode(this.selectedNodeId);
				if (node) {
					if (node.isGroup) {
						const proxy = this.groupManager.getOrCreatePivotProxy(node.id);
						if (this.game.objectInspector.selectedObject !== proxy) {
							this.game.objectInspector.show(proxy);
						}
					} else {
						const obj = this.resolveObject3D(node.id);
						if (obj && this.game.objectInspector.selectedObject !== obj) {
							this.game.objectInspector.show(obj);
						}
					}
				}
			}
			inspectorContainer.style.display = "flex";
		}
	}

	private toggleCollapse() {
		this.isCollapsed = !this.isCollapsed;
		const elementsToToggle = [this.sceneContentContainer, this.libraryContainer, this.propertiesContentContainer];
		elementsToToggle.forEach((el) => {
			if (el) (el as HTMLElement).style.display = this.isCollapsed ? "none" : "";
		});
		if (this.isCollapsed) {
			this.container.style.height = "auto";
			this.container.style.borderBottom = "2px solid rgba(255, 255, 255, 0.15)";
		} else {
			this.container.style.height = "100vh";
			this.container.style.height = "100dvh";
			this.container.style.borderBottom = "2px solid rgba(255, 255, 255, 0.15)";
			this.switchTab(this.currentTab);
		}
	}

	public toggleCouplingMode() {
		const active = !this.groupManager.isCouplingMode();
		this.groupManager.setCouplingMode(active, (id) => this.resolveObject3D(id));
		if (this.btnToggleCoupling) {
			this.btnToggleCoupling.textContent = `Acoples: ${active ? "ON" : "OFF"}`;
			this.btnToggleCoupling.style.background = active ? "#0088cc" : "#444";
			this.btnToggleCoupling.style.borderColor = active ? "#38bdf8" : "#555";
		}
		this.game.updateEditorInteractionMode?.();
	}

	/** Runs editor operations from the compact touch toolbar without hiding desktop tools. */
	public performMobileAction(action: string) {
		switch (action) {
			case "undo":
				if (this.history.undo()) this.renderTree();
				break;
			case "redo":
				if (this.history.redo()) this.renderTree();
				break;
			case "duplicate": this.handleDuplicate(); break;
			case "group": this.handleGroupSelection(); break;
			case "create-group": this.handleCreateGroup(); break;
			case "create-subgroup": this.handleCreateSubgroup(); break;
			case "ungroup": this.handleUngroup(); break;
			case "decouple": this.handleDecouple(); break;
			case "coupling": this.toggleCouplingMode(); break;
			case "pivot": this.togglePivotEditMode(); break;
			case "copy": this.handleCopy(); break;
			case "paste": this.handlePaste(); break;
			case "save-prefab": void this.handleSavePrefab(); break;
			case "export": this.handleExportJson(); break;
			case "import": this.handleImportJson(); break;
		}
	}

	private togglePivotEditMode() {
		const active = !this.groupManager.isPivotEditMode();
		this.groupManager.setPivotEditMode(active);
		this.btnTogglePivotEdit.textContent = `Pivote: ${active ? "ON" : "OFF"}`;
		this.btnTogglePivotEdit.style.background = active ? "#0088cc" : "#444";
		this.btnTogglePivotEdit.style.borderColor = active ? "#38bdf8" : "#555";
	}

	selectNode(nodeId: string | null, syncInspector: boolean = true) {
		if (this.isSyncingSelection) return;
		if (this.selectedNodeId === nodeId && !syncInspector) return;

		this.isSyncingSelection = true;
		try {
			this._selectedNodeId = nodeId;

			if (this.game?.editorSelection) {
				if (nodeId) {
					if (!this.game.editorSelection.isSelected(nodeId)) {
						this.game.editorSelection.selectSingle(nodeId, "explorer");
					}
				} else {
					if (this.game.editorSelection.getCount() > 0) {
						this.game.editorSelection.clear("explorer");
					}
				}
			}

			this.updateSelectionVisuals();

			if (!syncInspector) return;

			if (!nodeId) {
				if (this.game?.objectInspector && this.game.objectInspector.isVisible) {
					this.game.objectInspector.detachAndClear?.();
				}
				return;
			}

			const node = this.hierarchy.getNode(nodeId);
			if (!node) return;

			if (node.isGroup) {
				// Seleccionar proxy de pivote central de grupo
				const proxy = this.groupManager.getOrCreatePivotProxy(node.id);
				if (this.game?.objectInspector && this.game.objectInspector.selectedObject !== proxy) {
					this.game.objectInspector.show(proxy);
				}
			} else {
				// Seleccionar objeto físico individual
				const obj = this.resolveObject3D(node.id);
				if (obj && this.game?.objectInspector && this.game.objectInspector.selectedObject !== obj) {
					this.game.objectInspector.show(obj);
				}
			}
		} finally {
			this.isSyncingSelection = false;
		}
	}

	renderTree() {
		this.treeContainer.innerHTML = "";
		const rootNodes = this.hierarchy.getChildren(null);

		if (rootNodes.length === 0) {
			const emptyMsg = document.createElement("div");
			emptyMsg.style.cssText = `color: #888; text-align: center; padding: 20px 0; font-style: italic;`;
			emptyMsg.textContent = "No hay objetos en la escena";
			this.treeContainer.appendChild(emptyMsg);
			return;
		}

		rootNodes.forEach((node) => {
			this.renderNodeItem(node, this.treeContainer, 0);
		});

		// Zona dedicada para soltar y desacoplar hacia la raíz
		const decoupleZone = document.createElement("div");
		decoupleZone.style.cssText = `
			margin-top: 14px;
			padding: 8px 10px;
			border: 1px dashed #555;
			border-radius: 6px;
			text-align: center;
			color: #aaa;
			font-size: 11px;
			background: rgba(255, 255, 255, 0.03);
			transition: all 0.2s ease;
			flex-shrink: 0;
			box-sizing: border-box;
		`;
		decoupleZone.textContent = "📥 Soltar aquí para desacoplar a la raíz";

		decoupleZone.ondragover = (e) => {
			if (this.draggedNodeIds.length === 0 && !e.dataTransfer?.types.includes("text/plain")) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			decoupleZone.style.borderColor = "#fff";
			decoupleZone.style.background = "rgba(255, 255, 255, 0.1)";
			decoupleZone.style.color = "#fff";
		};

		decoupleZone.ondragleave = () => {
			decoupleZone.style.borderColor = "#555";
			decoupleZone.style.background = "rgba(255, 255, 255, 0.03)";
			decoupleZone.style.color = "#aaa";
		};

		decoupleZone.ondrop = (e) => {
			e.preventDefault();
			let draggedIds = [...this.draggedNodeIds];
			if (draggedIds.length === 0) {
				const json = e.dataTransfer?.getData("application/json");
				if (json) {
					try { draggedIds = JSON.parse(json); } catch (_) {}
				}
				if (draggedIds.length === 0) {
					const plain = e.dataTransfer?.getData("text/plain");
					if (plain) draggedIds = [plain];
				}
			}

			if (draggedIds.length === 0) return;

			const affectedOldParents = new Set<string>();
			const commands: ReparentCommand[] = [];
			const validIds: string[] = [];

			for (const id of draggedIds) {
				const n = this.hierarchy.getNode(id);
				if (!n || !n.parentId) continue;

				const oldParentId = n.parentId;
				const oldOrder = n.order;
				affectedOldParents.add(oldParentId);
				validIds.push(id);

				this.hierarchy.reparent(id, null);

				commands.push(
					new ReparentCommand(this.hierarchy, id, oldParentId, oldOrder, null, undefined, () => this.renderTree())
				);
			}

			if (validIds.length === 0) return;

			for (const oldPId of affectedOldParents) {
				this.groupManager.recenterGroupPivot(oldPId, (id) => this.resolveObject3D(id));
			}
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));

			if (commands.length === 1) {
				this.history.execute(commands[0]);
			} else if (commands.length > 1) {
				const composite = new CompositeCommand("Decouple Multiple Nodes", commands);
				this.history.execute(composite);
			}

			this.renderTree();

			if (this.game?.editorSelection) {
				this.game.editorSelection.clear("explorer");
				for (const id of validIds) {
					this.game.editorSelection.toggle(id, "explorer");
				}
			} else {
				this.selectNode(validIds[0]);
			}
		};

		this.treeContainer.appendChild(decoupleZone);
	}

	private renderNodeItem(node: HierarchyNode, parentElement: HTMLElement, depth: number) {
		// Filtro de búsqueda
		if (this.searchQuery) {
			const matchSelf = (node.customName || node.name).toLowerCase().includes(this.searchQuery);
			const matchDescendant = this.hierarchy.getDescendants(node.id).some((d) =>
				(d.customName || d.name).toLowerCase().includes(this.searchQuery)
			);
			if (!matchSelf && !matchDescendant) return;
		}

		const isPrefabMember = !!node.metadata?.prefabInstanceId;
		const isPrefabRoot = !!node.metadata?.isPrefabRoot;

		const itemRow = document.createElement("div");
		itemRow.setAttribute("data-node-id", node.id);
		const isSelected = this.isNodeSelected(node.id);
		const isActive = this.selectedNodeId === node.id;
		itemRow.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 5px 8px;
			padding-left: ${depth * 16 + 8}px;
			border-radius: 4px;
			cursor: grab;
			margin-bottom: 2px;
			background: ${isActive ? "rgba(255, 255, 255, 0.22)" : isSelected ? "rgba(255, 255, 255, 0.12)" : "transparent"};
			color: ${isSelected ? "#ffffff" : "#cccccc"};
			font-weight: ${isSelected ? "bold" : "normal"};
			transition: background 0.1s ease, border 0.1s ease;
			border: 1px solid ${isActive ? "#888" : isSelected ? "#555" : "transparent"};
			box-sizing: border-box;
			width: 100%;
			min-width: 0;
			flex-shrink: 0;
			${isPrefabRoot ? "border-left: 3px solid #ffc107;" : isPrefabMember ? "border-left: 2px solid #ca8a04;" : isActive ? "border-left: 3px solid #fff;" : isSelected ? "border-left: 3px solid #60a5fa;" : ""}
		`;

		// ── Drag & Drop de Explorer (Corrección 3) ───────────────────────────────
		itemRow.draggable = true;

		itemRow.ondragstart = (e) => {
			if (isTextInput(document.activeElement)) {
				(document.activeElement as HTMLElement)?.blur?.();
			}
			if (this.game.interaction) {
				this.game.interaction.begin("tree-drag", () => this.cancelDrag());
			}

			// Si el nodo arrastrado está dentro de la multiselección, arrastramos todos los nodos seleccionados
			const selection = this.game?.editorSelection;
			if (selection && selection.isSelected(node.id)) {
				this.draggedNodeIds = selection.getEffectiveTransformNodeIds();
			} else {
				this.draggedNodeIds = [node.id];
				if (selection) {
					selection.selectSingle(node.id, "explorer");
				} else {
					this.selectNode(node.id, false);
				}
			}

			e.dataTransfer?.setData("application/json", JSON.stringify(this.draggedNodeIds));
			e.dataTransfer?.setData("text/plain", this.draggedNodeIds[0] || node.id);
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";

			// Atenuar visualmente todas las filas que se arrastran
			for (const draggedId of this.draggedNodeIds) {
				const row = this.treeContainer.querySelector<HTMLElement>(`[data-node-id="${draggedId}"]`);
				if (row) row.style.opacity = "0.45";
			}
		};

		itemRow.ondragend = () => {
			this.game.interaction?.end("tree-drag");
			for (const draggedId of this.draggedNodeIds) {
				const row = this.treeContainer.querySelector<HTMLElement>(`[data-node-id="${draggedId}"]`);
				if (row) {
					row.style.opacity = "1";
					const isSel = this.isNodeSelected(draggedId);
					const n = this.hierarchy.getNode(draggedId);
					this.resetRowDropStyles(row, isSel, !!n?.metadata?.isPrefabRoot, !!n?.metadata?.prefabInstanceId, this.selectedNodeId === draggedId);
				}
			}
			this.draggedNodeIds = [];
			this.updateSelectionVisuals();
		};

		itemRow.ondragover = (e) => {
			let draggedIds = this.draggedNodeIds;
			if (draggedIds.length === 0 && e.dataTransfer?.types.includes("text/plain")) {
				draggedIds = this.draggedNodeId ? [this.draggedNodeId] : [];
			}
			if (draggedIds.length === 0 || draggedIds.includes(node.id)) return;
			e.preventDefault();

			const rect = itemRow.getBoundingClientRect();
			const relY = e.clientY - rect.top;
			const height = rect.height;

			let dropPosition: "before" | "after" | "inside" = "inside";
			if (relY < height * 0.25) {
				dropPosition = "before";
			} else if (relY > height * 0.75) {
				dropPosition = "after";
			} else {
				dropPosition = node.isGroup ? "inside" : (relY < height * 0.5 ? "before" : "after");
			}

			// Validar que todos los nodos arrastrados puedan reparentarse hacia targetParentId
			const targetParentId = dropPosition === "inside" ? node.id : node.parentId;
			const allAllowed = draggedIds.every((id) => this.hierarchy.canReparent(id, targetParentId).allowed);

			if (!allAllowed) {
				if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
				itemRow.style.borderColor = "#cc3333";
				itemRow.style.background = "rgba(204, 51, 51, 0.2)";
			} else {
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember, this.selectedNodeId === node.id);

				if (dropPosition === "before") {
					itemRow.style.borderTop = "2px solid #fff";
				} else if (dropPosition === "after") {
					itemRow.style.borderBottom = "2px solid #fff";
				} else {
					itemRow.style.outline = "2px dashed #44ff44";
					itemRow.style.background = "rgba(68, 255, 68, 0.15)";
				}
			}
		};

		itemRow.ondragleave = () => {
			this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember, this.selectedNodeId === node.id);
		};

		itemRow.ondrop = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember, this.selectedNodeId === node.id);

			let draggedIds = [...this.draggedNodeIds];
			if (draggedIds.length === 0) {
				const json = e.dataTransfer?.getData("application/json");
				if (json) {
					try { draggedIds = JSON.parse(json); } catch (_) {}
				}
				if (draggedIds.length === 0) {
					const plain = e.dataTransfer?.getData("text/plain");
					if (plain) draggedIds = [plain];
				}
			}

			if (draggedIds.length === 0) return;

			draggedIds = draggedIds.filter((id) => id !== node.id);
			if (draggedIds.length === 0) return;

			const rect = itemRow.getBoundingClientRect();
			const relY = e.clientY - rect.top;
			const height = rect.height;

			let dropPosition: "before" | "after" | "inside" = "inside";
			if (relY < height * 0.25) {
				dropPosition = "before";
			} else if (relY > height * 0.75) {
				dropPosition = "after";
			} else {
				dropPosition = node.isGroup ? "inside" : (relY < height * 0.5 ? "before" : "after");
			}

			let targetParentId: string | null = null;
			let baseTargetOrder: number | undefined = undefined;

			if (dropPosition === "inside") {
				targetParentId = node.id;
				baseTargetOrder = undefined;
			} else if (dropPosition === "before") {
				targetParentId = node.parentId;
				baseTargetOrder = node.order;
			} else {
				targetParentId = node.parentId;
				baseTargetOrder = node.order + 1;
			}

			// Validar cada nodo arrastrado
			const validIds: string[] = [];
			for (const id of draggedIds) {
				const validation = this.hierarchy.canReparent(id, targetParentId);
				if (validation.allowed) {
					validIds.push(id);
				} else {
					console.warn(`[Explorer DragDrop] Operación no permitida para ${id}: ${validation.reason}`);
				}
			}

			if (validIds.length === 0) return;

			const affectedOldParents = new Set<string>();
			const commands: ReparentCommand[] = [];

			// Ejecutar reparenting para cada nodo
			validIds.forEach((id, index) => {
				const n = this.hierarchy.getNode(id);
				if (!n) return;
				const oldParentId = n.parentId;
				const oldOrder = n.order;
				if (oldParentId) affectedOldParents.add(oldParentId);

				const targetOrder = baseTargetOrder !== undefined ? baseTargetOrder + index : undefined;

				this.hierarchy.reparent(id, targetParentId, targetOrder);

				commands.push(
					new ReparentCommand(this.hierarchy, id, oldParentId, oldOrder, targetParentId, targetOrder, () => {
						this.renderTree();
					})
				);

				const movedObj = this.resolveObject3D(id);
				if (movedObj && this.game.broadcastObjectUpdate) {
					this.game.broadcastObjectUpdate(movedObj);
				}
			});

			// Recalcular pivotes de grupos de origen afectados
			for (const oldPId of affectedOldParents) {
				if (oldPId !== targetParentId) {
					this.groupManager.recenterGroupPivot(oldPId, (id) => this.resolveObject3D(id));
				}
			}

			// Recalcular pivote de grupo de destino si aplica
			if (targetParentId) {
				this.groupManager.recenterGroupPivot(targetParentId, (id) => this.resolveObject3D(id));
			}

			// Actualizar visuales de acople 3D
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));

			// Registrar en historial Undo/Redo
			if (commands.length === 1) {
				this.history.execute(commands[0]);
			} else if (commands.length > 1) {
				const composite = new CompositeCommand("Reparent Multiple Nodes", commands);
				this.history.execute(composite);
			}

			this.renderTree();

			// Conservar seleccionados todos los nodos arrastrados
			if (this.game?.editorSelection) {
				this.game.editorSelection.clear("explorer");
				for (const id of validIds) {
					this.game.editorSelection.toggle(id, "explorer");
				}
			} else {
				this.selectNode(validIds[0]);
			}
		};

		itemRow.onmouseenter = () => {
			if (!isSelected && !this.draggedNodeId) itemRow.style.background = "rgba(255, 255, 255, 0.08)";
		};
		itemRow.onmouseleave = () => {
			if (!isSelected && !this.draggedNodeId) itemRow.style.background = "transparent";
		};

		// Contenido izquierdo: icono, fold, nombre
		const leftBox = document.createElement("div");
		leftBox.style.cssText = `display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1 1 auto;`;

		if (node.isGroup) {
			const isCollapsed = this.collapsedGroups.has(node.id);
			const foldIcon = document.createElement("span");
			foldIcon.textContent = isCollapsed ? "▶" : "▼";
			foldIcon.style.cssText = `font-size: 9px; width: 12px; cursor: pointer; color: #aaa; flex-shrink: 0;`;
			foldIcon.onclick = (e) => {
				e.stopPropagation();
				if (isCollapsed) this.collapsedGroups.delete(node.id);
				else this.collapsedGroups.add(node.id);
				this.renderTree();
			};
			leftBox.appendChild(foldIcon);

			const groupIcon = document.createElement("span");
			groupIcon.textContent = isPrefabMember ? "📦" : (isCollapsed ? "📁" : "📂");
			groupIcon.style.cssText = "flex-shrink: 0;";
			leftBox.appendChild(groupIcon);
		} else {
			const spacer = document.createElement("span");
			spacer.style.cssText = "width: 12px; flex-shrink: 0;";
			leftBox.appendChild(spacer);

			const itemIcon = document.createElement("span");
			itemIcon.textContent = this.getNodeIcon(node.type);
			itemIcon.style.cssText = "flex-shrink: 0;";
			leftBox.appendChild(itemIcon);
		}

		const nameLabel = document.createElement("span");
		nameLabel.textContent = node.customName || node.name;
		nameLabel.style.cssText = `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0;`;
		leftBox.appendChild(nameLabel);

		if (isPrefabRoot) {
			const prefabTag = document.createElement("span");
			prefabTag.textContent = `[v${node.metadata?.prefabVersion || 1}]`;
			prefabTag.title = `Instancia de prefab: ${node.metadata?.prefabName || ""}`;
			prefabTag.style.cssText = `
				font-size: 9px;
				color: #ffc107;
				background: rgba(255, 193, 7, 0.15);
				border: 1px solid #ca8a04;
				border-radius: 3px;
				padding: 0 4px;
				margin-left: 2px;
				white-space: nowrap;
				flex-shrink: 0;
			`;
			leftBox.appendChild(prefabTag);
		}

		// Contenido derecho: botones de orden y acciones rápidas
		const actionBox = document.createElement("div");
		actionBox.style.cssText = `display: flex; align-items: center; gap: 4px; opacity: 0.6; flex-shrink: 0;`;
		itemRow.onmouseenter = () => {
			if (!isSelected && !this.draggedNodeId) itemRow.style.background = "rgba(255, 255, 255, 0.08)";
			actionBox.style.opacity = "1";
		};
		itemRow.onmouseleave = () => {
			if (!isSelected && !this.draggedNodeId) itemRow.style.background = "transparent";
			actionBox.style.opacity = "0.6";
		};

		// Botón subir orden
		const btnUp = document.createElement("span");
		btnUp.textContent = "▲";
		btnUp.title = "Subir orden de hermano";
		btnUp.style.cssText = `font-size: 9px; cursor: pointer; padding: 2px 4px; border-radius: 2px; color: #aaa; transition: color 0.1s ease;`;
		btnUp.onmouseenter = () => (btnUp.style.color = "#fff");
		btnUp.onmouseleave = () => (btnUp.style.color = "#aaa");
		btnUp.onclick = (e) => {
			e.stopPropagation();
			this.hierarchy.reorderChild(node.id, Math.max(0, node.order - 1));
			this.renderTree();
		};

		// Botón bajar orden
		const btnDown = document.createElement("span");
		btnDown.textContent = "▼";
		btnDown.title = "Bajar orden de hermano";
		btnDown.style.cssText = `font-size: 9px; cursor: pointer; padding: 2px 4px; border-radius: 2px; color: #aaa; transition: color 0.1s ease;`;
		btnDown.onmouseenter = () => (btnDown.style.color = "#fff");
		btnDown.onmouseleave = () => (btnDown.style.color = "#aaa");
		btnDown.onclick = (e) => {
			e.stopPropagation();
			this.hierarchy.reorderChild(node.id, node.order + 1);
			this.renderTree();
		};

		actionBox.appendChild(btnUp);
		actionBox.appendChild(btnDown);

		itemRow.appendChild(leftBox);
		itemRow.appendChild(actionBox);

		itemRow.onclick = (e: MouseEvent) => {
			if (this.game?.editorSelection) {
				if (e.shiftKey) {
					this.game.editorSelection.selectRange(node.id, this.getVisibleNodeIds(), "explorer");
				} else if (e.ctrlKey || e.metaKey) {
					this.game.editorSelection.toggle(node.id, "explorer");
				} else {
					this.game.editorSelection.selectSingle(node.id, "explorer");
				}
			} else {
				this.selectNode(node.id);
			}
		};

		parentElement.appendChild(itemRow);

		// Si es grupo y no está colapsado, renderizar hijos recursivamente
		if (node.isGroup && !this.collapsedGroups.has(node.id)) {
			const children = this.hierarchy.getChildren(node.id);
			children.forEach((child) => {
				this.renderNodeItem(child, parentElement, depth + 1);
			});
		}
	}

	private resetRowDropStyles(itemRow: HTMLElement, isSelected: boolean, isPrefabRoot: boolean = false, isPrefabMember: boolean = false) {
		itemRow.style.borderTop = "";
		itemRow.style.borderBottom = "";
		itemRow.style.borderColor = isSelected ? "#666" : "transparent";
		itemRow.style.borderLeft = isPrefabRoot ? "3px solid #ffc107" : isPrefabMember ? "2px solid #ca8a04" : (isSelected ? "3px solid #fff" : "transparent");
		itemRow.style.outline = "";
		itemRow.style.background = isSelected ? "rgba(255, 255, 255, 0.15)" : "transparent";
		itemRow.style.color = isSelected ? "#ffffff" : "#cccccc";
	}

	private getNodeIcon(type: string): string {
		switch (type) {
			case "wall": return "🧱";
			case "stairs": return "🪜";
			case "ramp": return "📐";
			case "motorbike": return "🏍️";
			case "interaction_button": return "🔘";
			case "light": return "💡";
			case "tube": return "🧪";
			case "spiked_floor": return "⚠️";
			case "farming_zone":
			case "fuel_zone": return "⛽";
			default: return "📦";
		}
	}

	// ── Acciones de toolbar y operaciones ──────────────────────────────────────

	/**
	 * Agrupa la selección activa en un nuevo grupo contenedor,
	 * o crea un grupo nuevo vacío en la raíz si no hay nada seleccionado.
	 */
	public handleCreateGroup() {
		const selection = this.game?.editorSelection;
		const count = selection ? selection.getCount() : (this.selectedNodeId ? 1 : 0);
		if (count > 0) {
			this.handleGroupSelection();
			return;
		}

		const name = prompt("Nombre del nuevo grupo:", "Nuevo Grupo");
		if (!name || !name.trim()) return;

		const newGroup = this.hierarchy.createGroup(name.trim(), null);
		this.groupManager.getOrCreatePivotProxy(newGroup.id);
		this.renderTree();
		this.selectNode(newGroup.id);
		this.showToast(`📁 Grupo '${name.trim()}' creado`);
	}

	/**
	 * Corrección 1: Crear subgrupo explícito dentro del grupo seleccionado.
	 */
	public handleCreateSubgroup() {
		if (!this.selectedNodeId) {
			alert("Selecciona un grupo padre para crear un subgrupo dentro de él.");
			return;
		}

		const selectedNode = this.hierarchy.getNode(this.selectedNodeId);
		if (!selectedNode || !selectedNode.isGroup) {
			alert("El elemento seleccionado no es un grupo. Selecciona un grupo para añadirle un subgrupo.");
			return;
		}

		const name = prompt(`Nombre del subgrupo dentro de '${selectedNode.customName || selectedNode.name}':`, "Nuevo Subgrupo");
		if (!name || !name.trim()) return;

		const subGroup = this.hierarchy.createGroup(name.trim(), selectedNode.id);
		this.collapsedGroups.delete(selectedNode.id); // Asegurar que el padre esté desplegado
		this.groupManager.getOrCreatePivotProxy(subGroup.id);
		this.renderTree();
		this.selectNode(subGroup.id);
		this.showToast(`📁 Subgrupo '${name.trim()}' creado`);
	}

	/**
	 * Agrupa todos los elementos seleccionados bajo un nuevo grupo de una sola vez.
	 */
	public handleGroupSelection() {
		const selection = this.game?.editorSelection;
		let targetNodes = selection && selection.getCount() > 0
			? selection.getEffectiveTransformNodeIds()
			: (this.selectedNodeId ? [this.selectedNodeId] : []);

		if (targetNodes.length === 0 && selection && selection.getCount() > 0) {
			targetNodes = selection.getSelectedIds();
		}

		if (targetNodes.length === 0) {
			alert("Selecciona al menos un objeto o grupo para agrupar.");
			return;
		}

		const name = prompt(`Nombre del grupo para los ${targetNodes.length} elementos seleccionados:`, "Nuevo Grupo");
		if (!name || !name.trim()) return;

		const firstNode = this.hierarchy.getNode(targetNodes[0]);
		const commonParent = firstNode?.parentId ?? null;
		const allSameParent = targetNodes.every((id) => this.hierarchy.getNode(id)?.parentId === commonParent);
		const parentId = allSameParent ? commonParent : null;

		const cmd = new GroupNodesCommand(
			this.hierarchy,
			this.groupManager,
			targetNodes,
			name.trim(),
			parentId,
			(createdGroupId) => {
				this.renderTree();
				if (createdGroupId) {
					if (selection) {
						selection.selectSingle(createdGroupId, "explorer");
					} else {
						this.selectNode(createdGroupId);
					}
				}
			},
			(uuid: string) => this.resolveObject3D(uuid)
		);

		if (this.history) {
			this.history.execute(cmd);
		} else {
			cmd.execute();
		}

		this.showToast(`📁 ${targetNodes.length} ${targetNodes.length === 1 ? "elemento agrupado" : "elementos agrupados"} en '${name.trim()}'`);
	}

	private handleUngroup() {
		if (!this.selectedNodeId) return;
		const node = this.hierarchy.getNode(this.selectedNodeId);
		if (!node || !node.isGroup) {
			alert("Selecciona un grupo para desagrupar.");
			return;
		}

		this.hierarchy.ungroup(node.id);
		this.groupManager.removeGroupProxy(node.id);
		this.selectNode(null);
		this.renderTree();
	}

	private handleDecouple() {
		if (!this.selectedNodeId) return;
		const node = this.hierarchy.getNode(this.selectedNodeId);
		if (!node || !node.parentId) {
			alert("El elemento seleccionado ya se encuentra en la raíz.");
			return;
		}

		const oldParentId = node.parentId;
		const oldOrder = node.order;

		this.hierarchy.reparent(node.id, null);
		if (oldParentId) {
			this.groupManager.recenterGroupPivot(oldParentId, (id) => this.resolveObject3D(id));
		}
		if (this.groupManager.isCouplingMode()) {
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
		}

		this.history.execute(
			new ReparentCommand(this.hierarchy, node.id, oldParentId, oldOrder, null, undefined, () => this.renderTree())
		);

		this.renderTree();
	}

	public handleCopy() {
		const selection = this.game?.editorSelection;
		let targetNodes: string[] = [];
		if (selection && selection.getCount() > 0) {
			targetNodes = selection.getEffectiveTransformNodeIds();
			if (targetNodes.length === 0) targetNodes = selection.getSelectedIds();
		} else if (this.selectedNodeId) {
			targetNodes = [this.selectedNodeId];
		} else if (this.game?.objectInspector?.selectedObject) {
			const obj = this.game.objectInspector.selectedObject;
			const id = obj.userData?.groupId || obj.userData?.uuid;
			if (id) targetNodes = [id];
		}
		if (targetNodes.length === 0) return;

		const copied = this.clipboard.copy(
			targetNodes,
			this.hierarchy,
			(id) => this.fetchObjectData(id)
		);
		if (copied) {
			console.log(`[Explorer] ${targetNodes.length} nodos copiados al portapapeles.`);
			this.showToast(`📋 ${targetNodes.length} ${targetNodes.length === 1 ? "elemento copiado" : "elementos copiados"} (Ctrl+V para pegar)`);
		}
	}

	/**
	 * Calcula una posición espacial unificada frente al personaje o cámara para colocar
	 * estructuras pegadas, duplicadas, insertadas o importadas sin alterar sus disposiciones relativas.
	 */
	public calculateSpawnPlacement(offsetDistance: number = 4.5): { x: number; y: number; z: number } {
		const char = this.game.character;
		let charPos: THREE.Vector3 | null = null;

		if (char && typeof char.getPosition === "function") {
			charPos = char.getPosition();
		} else if (char?.body?.translation) {
			const t = char.body.translation();
			charPos = new THREE.Vector3(t.x, t.y, t.z);
		}

		const camera = this.game.sceneManager?.camera || this.game.cameraController?.camera || this.game.camera;
		const lookDir = new THREE.Vector3(0, 0, 1);

		if (camera && typeof camera.getWorldDirection === "function") {
			camera.getWorldDirection(lookDir);
			lookDir.y = 0;
			if (lookDir.lengthSq() > 0.001) {
				lookDir.normalize();
			} else {
				lookDir.set(0, 0, 1);
			}
		}

		if (charPos) {
			const targetX = charPos.x + lookDir.x * offsetDistance;
			const targetZ = charPos.z + lookDir.z * offsetDistance;
			let targetY = charPos.y;

			if (this.game.sceneManager?.scene) {
				try {
					const rayOrigin = new THREE.Vector3(targetX, charPos.y + 10, targetZ);
					const rayDir = new THREE.Vector3(0, -1, 0);
					const raycaster = new THREE.Raycaster(rayOrigin, rayDir, 0.1, 40);
					if (camera) {
						raycaster.camera = camera;
					} else {
						raycaster.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
					}

					const rawTargets = this.game.editableMapObjects && this.game.editableMapObjects.length > 0
						? this.game.editableMapObjects
						: this.game.sceneManager.scene.children;

					const collidables = rawTargets.filter((c: any) => !c.isSprite && c.type !== "Sprite");

					const hits = raycaster.intersectObjects(collidables, true);
					const groundHit = hits.find((h: any) => {
						let obj = h.object;
						while (obj) {
							if (obj.userData?.isEditableMapObject || obj.userData?.isTerrain || obj.userData?.mapObjectType === "wall" || obj.userData?.mapObjectType === "floor") {
								return true;
							}
							obj = obj.parent;
						}
						return false;
					});

					if (groundHit) {
						targetY = groundHit.point.y + 0.05;
					}
				} catch (rayErr) {
					console.warn("[Explorer] Raycast en calculateSpawnPlacement no pudo completarse (usando altura estimada):", rayErr);
				}
			}

			return { x: targetX, y: targetY, z: targetZ };
		}

		return { x: 5, y: 0, z: 5 };
	}

	public handlePaste() {
		if (!this.clipboard.hasContent()) return;

		let targetParent: string | null = null;
		if (this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup) {
			targetParent = this.selectedNodeId;
		} else if (this.game?.editorSelection?.getActiveId()) {
			const activeId = this.game.editorSelection.getActiveId()!;
			const node = this.hierarchy.getNode(activeId);
			if (node?.isGroup) {
				targetParent = activeId;
			} else if (node?.parentId) {
				targetParent = node.parentId;
			}
		}

		const spawnPos = this.calculateSpawnPlacement(4.5);
		const prepared = this.clipboard.preparePaste(spawnPos, targetParent);
		if (!prepared) return;

		const cmd = new DuplicateCommand(
			this.game,
			this.hierarchy,
			this.groupManager,
			{
				hierarchyNodes: prepared.newHierarchyNodes,
				objectsData: prepared.newObjectsData,
				rootNodeIds: prepared.rootNodeIds,
			},
			(newSelectedId) => {
				this.renderTree();
				if (newSelectedId) {
					if (this.game?.editorSelection) {
						this.game.editorSelection.selectSingle(newSelectedId, "explorer");
					} else {
						this.selectNode(newSelectedId);
					}
				}
			}
		);

		this.history.execute(cmd);
		this.showToast(`📋 ${prepared.rootNodeIds.length} ${prepared.rootNodeIds.length === 1 ? "elemento pegado" : "elementos pegados"}`);
	}

	public handleDuplicate() {
		const selection = this.game?.editorSelection;
		let targetNodes: string[] = [];
		if (selection && selection.getCount() > 0) {
			targetNodes = selection.getEffectiveTransformNodeIds();
			if (targetNodes.length === 0) targetNodes = selection.getSelectedIds();
		} else if (this.selectedNodeId) {
			targetNodes = [this.selectedNodeId];
		} else if (this.game?.objectInspector?.selectedObject) {
			const obj = this.game.objectInspector.selectedObject;
			const id = obj.userData?.groupId || obj.userData?.uuid;
			if (id) targetNodes = [id];
		}
		if (targetNodes.length === 0) return;

		const firstNode = this.hierarchy.getNode(targetNodes[0]);
		if (!firstNode) return;

		// Copiar la selección actual
		const copied = this.clipboard.copy(
			targetNodes,
			this.hierarchy,
			(id) => this.fetchObjectData(id)
		);
		if (!copied) return;

		// El duplicado debe crearse como hermano del original (targetParent = firstNode.parentId)
		const targetParent = firstNode.parentId;
		const spawnPos = this.calculateSpawnPlacement(3.0);
		const prepared = this.clipboard.preparePaste(spawnPos, targetParent);
		if (!prepared) return;

		const cmd = new DuplicateCommand(
			this.game,
			this.hierarchy,
			this.groupManager,
			{
				hierarchyNodes: prepared.newHierarchyNodes,
				objectsData: prepared.newObjectsData,
				rootNodeIds: prepared.rootNodeIds,
			},
			(newSelectedId) => {
				this.renderTree();
				if (newSelectedId) {
					if (this.game?.editorSelection) {
						this.game.editorSelection.selectSingle(newSelectedId, "explorer");
					} else {
						this.selectNode(newSelectedId);
					}
				}
			}
		);

		this.history.execute(cmd);
		this.showToast(`📋 ${prepared.rootNodeIds.length} ${prepared.rootNodeIds.length === 1 ? "elemento duplicado" : "elementos duplicados"}`);
	}

	private async handleSavePrefab() {
		if (!this.selectedNodeId) {
			alert("Selecciona un grupo u objeto para guardarlo como prefab.");
			return;
		}

		const node = this.hierarchy.getNode(this.selectedNodeId);
		if (!node) return;

		const name = prompt("Nombre del prefab:", node.customName || node.name);
		if (!name || !name.trim()) return;

		const category = prompt("Categoría del prefab (ej: defensas, edificios, vehiculos):", "general") || "general";

		const payload = this.prefabManager.createPrefabPayloadFromSelection(
			this.selectedNodeId,
			name.trim(),
			(id) => this.fetchObjectData(id),
			{ category }
		);

		if (!payload) {
			alert("No se pudo generar los datos del prefab a partir de la selección.");
			return;
		}

		try {
			const saved = await PrefabService.createPrefab(name.trim(), payload, { category });
			alert(`Prefab '${saved.name}' v${saved.version} guardado exitosamente.`);
			await this.loadLibraryPrefabs();
		} catch (err: any) {
			console.error("[Explorer] Error guardando prefab:", err);
			alert(`Error guardando prefab: ${err.message}`);
		}
	}

	private async handleInsertPrefab(prefab: PlatformPrefabDto) {
		try {
			let fullPrefab = prefab;
			if (!fullPrefab.data || !fullPrefab.data.hierarchy || !fullPrefab.data.objects) {
				try {
					fullPrefab = await PrefabService.getPrefab(prefab.id, prefab.version);
				} catch (err: any) {
					console.error("[Explorer] Error cargando datos completos del prefab:", err);
					alert(`No se pudo cargar los datos del prefab '${prefab.name}': ${err.message}`);
					return;
				}
			}

			let prefabData = fullPrefab.data || fullPrefab.currentVersion?.data || (fullPrefab as any).versions?.[0]?.data;
			if (typeof prefabData === "string") {
				try { prefabData = JSON.parse(prefabData); } catch (_) {}
			}
			if (prefabData?.format === "viper-prefab-package" && prefabData.prefab) {
				prefabData = prefabData.prefab;
			}

			if (!prefabData || !Array.isArray(prefabData.hierarchy) || !Array.isArray(prefabData.objects)) {
				console.error("[Explorer] El prefab no contiene datos válidos de jerarquía u objetos:", fullPrefab);
				alert(`El prefab '${prefab.name}' no tiene datos válidos o está dañado.`);
				return;
			}

			const spawnPos = this.calculateSpawnPlacement(5.0);

			const targetParent = this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup
				? this.selectedNodeId
				: null;

			const result = this.prefabManager.instantiatePrefab(
				prefabData,
				fullPrefab.id,
				fullPrefab.version,
				spawnPos,
				targetParent,
				(data) => {
					this.game._loadSingleMapObject(data);
					if (this.game.networkManager && typeof this.game.networkManager.sendEditorPlace === "function") {
						this.game.networkManager.sendEditorPlace(data);
					}
				},
				(groupId, pos) => {
					const proxy = this.groupManager.getOrCreatePivotProxy(groupId);
					if (pos) {
						proxy.position.set(pos.x, pos.y, pos.z);
					}
				}
			);

			if (this.groupManager.isCouplingMode()) {
				this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
			}

			this.renderTree();
			this.switchTab("scene");

			if (result && result.rootNodeId) {
				if (this.game?.editorSelection) {
					this.game.editorSelection.selectSingle(result.rootNodeId, "explorer");
				} else {
					this.selectNode(result.rootNodeId);
				}
			}
		} catch (err: any) {
			console.error("[Explorer] Error instanciando prefab:", err);
			alert(`Error al instanciar el prefab: ${err.message}`);
		}
	}

	private async handleExportPrefabDtoJson(prefab: PlatformPrefabDto) {
		try {
			let fullPrefab = prefab;
			if (!fullPrefab.data || !fullPrefab.data.hierarchy || !fullPrefab.data.objects) {
				try {
					fullPrefab = await PrefabService.getPrefab(prefab.id, prefab.version);
				} catch (err: any) {
					console.error("[Explorer] Error cargando datos completos del prefab para exportar:", err);
					alert(`No se pudo cargar el prefab '${prefab.name}': ${err.message}`);
					return;
				}
			}

			let prefabData = fullPrefab.data || fullPrefab.currentVersion?.data || (fullPrefab as any).versions?.[0]?.data;
			if (typeof prefabData === "string") {
				try { prefabData = JSON.parse(prefabData); } catch (_) {}
			}
			if (prefabData?.format === "viper-prefab-package" && prefabData.prefab) {
				prefabData = prefabData.prefab;
			}

			if (!prefabData) {
				alert(`No hay datos disponibles para exportar el prefab '${prefab.name}'.`);
				return;
			}

			const json = PrefabSerializer.exportToPackageJson(prefabData, fullPrefab.ownerId || "VIPER IO User");
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${fullPrefab.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.prefab.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err: any) {
			console.error("[Explorer] Error exportando prefab:", err);
			alert(`Error al exportar prefab: ${err.message}`);
		}
	}

	private async handleDeletePrefab(prefab: PlatformPrefabDto) {
		const confirmed = confirm(`¿Estás seguro de que deseas eliminar el prefab '${prefab.name}' (v${prefab.version})?`);
		if (!confirmed) return;

		try {
			await PrefabService.deletePrefab(prefab.id);
			await this.loadLibraryPrefabs();
		} catch (err: any) {
			alert(`Error al eliminar prefab: ${err.message}`);
		}
	}

	private async handleSyncPrefab(prefab: PlatformPrefabDto) {
		try {
			const synced = await PrefabService.syncPrefabToServer(prefab.id);
			alert(`Prefab '${synced.name || prefab.name}' sincronizado con éxito al servidor.`);
			await this.loadLibraryPrefabs();
		} catch (err: any) {
			alert(`Error sincronizando prefab: ${err.message}`);
		}
	}

	public async loadLibraryPrefabs() {
		this.isLoadingLibrary = true;
		this.renderLibrary();
		try {
			this.cachedPrefabsList = await PrefabService.listPrefabs();
		} catch (err) {
			console.error("[Explorer] Error cargando biblioteca de prefabs:", err);
			this.cachedPrefabsList = [];
		} finally {
			this.isLoadingLibrary = false;
			this.renderLibrary();
		}
	}

	private renderLibrary() {
		if (!this.libraryListContainer) return;
		this.libraryListContainer.innerHTML = "";

		if (this.isLoadingLibrary) {
			const loading = document.createElement("div");
			loading.style.cssText = `color: #94a3b8; text-align: center; padding: 24px 0; font-style: italic; font-size: 12px;`;
			loading.textContent = "⏳ Cargando biblioteca de prefabs...";
			this.libraryListContainer.appendChild(loading);
			return;
		}

		const searchQuery = (this.librarySearchInput?.value || "").toLowerCase().trim();
		const selectedCategory = this.libraryCategorySelect?.value || "all";

		const filtered = this.cachedPrefabsList.filter((p) => {
			if (selectedCategory !== "all" && p.category && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
				return false;
			}
			if (searchQuery) {
				const matchesName = p.name.toLowerCase().includes(searchQuery);
				const matchesDesc = p.description?.toLowerCase().includes(searchQuery);
				const matchesCat = p.category?.toLowerCase().includes(searchQuery);
				const matchesTags = p.tags?.some((t) => t.toLowerCase().includes(searchQuery));
				return matchesName || matchesDesc || matchesCat || matchesTags;
			}
			return true;
		});

		if (filtered.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText = `color: #64748b; text-align: center; padding: 20px 10px; font-size: 12px;`;
			empty.innerHTML = `
				<div style="font-size: 20px; margin-bottom: 6px;">📦</div>
				<div>No hay prefabs disponibles</div>
				<div style="font-size: 11px; margin-top: 4px; color: #475569;">
					Guarda un grupo como prefab usando el botón <b>⭐ Prefab</b> en la pestaña Escena.
				</div>
			`;
			this.libraryListContainer.appendChild(empty);
			return;
		}

		filtered.forEach((prefab) => {
			const card = document.createElement("div");
			card.style.cssText = `
				background: rgba(255, 255, 255, 0.05);
				border: 1px solid #444;
				border-radius: 8px;
				padding: 10px;
				display: flex;
				flex-direction: column;
				gap: 6px;
				transition: border-color 0.15s ease, background 0.15s ease;
			`;
			card.onmouseenter = () => {
				card.style.borderColor = "#666";
				card.style.background = "rgba(255, 255, 255, 0.08)";
			};
			card.onmouseleave = () => {
				card.style.borderColor = "#444";
				card.style.background = "rgba(255, 255, 255, 0.05)";
			};

			// Header del card: Nombre, categoría y versión
			const cardHeader = document.createElement("div");
			cardHeader.style.cssText = `display: flex; align-items: center; justify-content: space-between;`;

			const titleRow = document.createElement("div");
			titleRow.style.cssText = `display: flex; align-items: center; gap: 6px; font-weight: bold; color: white; font-size: 13px;`;
			titleRow.innerHTML = `<span>📦</span><span>${prefab.name}</span>`;

			const versionBadge = document.createElement("span");
			versionBadge.textContent = `v${prefab.version}`;
			versionBadge.style.cssText = `
				background: #222;
				color: #aaa;
				border-radius: 3px;
				padding: 1px 5px;
				font-size: 10px;
				border: 1px solid #444;
			`;
			titleRow.appendChild(versionBadge);

			const categoryBadge = document.createElement("span");
			categoryBadge.textContent = prefab.category || "general";
			categoryBadge.style.cssText = `
				background: #333;
				color: #ddd;
				border-radius: 3px;
				padding: 1px 5px;
				font-size: 10px;
				border: 1px solid #555;
			`;

			cardHeader.appendChild(titleRow);
			cardHeader.appendChild(categoryBadge);
			card.appendChild(cardHeader);

			// Detalles: descripción, conteo de objetos y almacenamiento
			const detailsRow = document.createElement("div");
			detailsRow.style.cssText = `display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #aaa;`;

			if (prefab.description) {
				const desc = document.createElement("div");
				desc.textContent = prefab.description;
				desc.style.cssText = `color: #ddd; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
				detailsRow.appendChild(desc);
			}

			const metaInfo = document.createElement("div");
			metaInfo.style.cssText = `display: flex; align-items: center; justify-content: space-between; margin-top: 2px;`;

			const objectCount = prefab.data?.objects?.length ?? (prefab as any).objectCount ?? 0;
			const groupCount = prefab.data?.hierarchy?.filter((n: any) => n.isGroup).length ?? 0;
			const objCountSpan = document.createElement("span");
			objCountSpan.textContent = `🧱 ${objectCount} objeto${objectCount === 1 ? "" : "s"}${groupCount > 0 ? ` (${groupCount} grupo${groupCount === 1 ? "" : "s"})` : ""}`;
			metaInfo.appendChild(objCountSpan);

			const storageBadge = document.createElement("span");
			const status = prefab.storageStatus || "server";
			if (status === "server") {
				storageBadge.innerHTML = `☁️ Servidor`;
				storageBadge.style.cssText = `background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; border-radius: 3px; padding: 1px 4px; font-size: 10px;`;
			} else if (status === "local") {
				storageBadge.innerHTML = `💾 Local`;
				storageBadge.style.cssText = `background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #0284c7; border-radius: 3px; padding: 1px 4px; font-size: 10px;`;
			} else if (status === "pending_sync") {
				storageBadge.innerHTML = `⏳ Pendiente Sync`;
				storageBadge.style.cssText = `background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid #ca8a04; border-radius: 3px; padding: 1px 4px; font-size: 10px;`;
			} else if (status === "auth_error") {
				storageBadge.innerHTML = `🔒 Sin login`;
				storageBadge.style.cssText = `background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid #ea580c; border-radius: 3px; padding: 1px 4px; font-size: 10px;`;
			} else {
				storageBadge.innerHTML = `⚠️ ${status}`;
				storageBadge.style.cssText = `background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #dc2626; border-radius: 3px; padding: 1px 4px; font-size: 10px;`;
			}
			metaInfo.appendChild(storageBadge);
			detailsRow.appendChild(metaInfo);
			card.appendChild(detailsRow);

			// Fila de acciones
			const actionsRow = document.createElement("div");
			actionsRow.style.cssText = `display: flex; align-items: center; gap: 4px; margin-top: 4px;`;

			const createActionBtn = (label: string, title: string, onClick: () => void, bg: string, color: string = "white") => {
				const btn = document.createElement("button");
				btn.innerHTML = label;
				btn.title = title;
				btn.style.cssText = `
					flex: 1;
					background: ${bg};
					color: ${color};
					border: 1px solid #555;
					border-radius: 4px;
					padding: 5px 8px;
					font-size: 11px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.15s ease;
					text-align: center;
				`;
				btn.onmouseenter = () => (btn.style.filter = "brightness(1.2)");
				btn.onmouseleave = () => (btn.style.filter = "none");
				btn.onclick = (e) => {
					e.stopPropagation();
					onClick();
				};
				return btn;
			};

			const btnInsert = createActionBtn("➕ Insertar", "Insertar una instancia independiente en la escena", () => this.handleInsertPrefab(prefab), "#28a745");
			const btnExport = createActionBtn("📤 JSON", "Exportar como archivo JSON descargable", () => this.handleExportPrefabDtoJson(prefab), "#444");

			actionsRow.appendChild(btnInsert);
			actionsRow.appendChild(btnExport);

			if (status !== "server") {
				const btnSync = createActionBtn("🔄 Sync", "Sincronizar este prefab al servidor", () => this.handleSyncPrefab(prefab), "#ca8a04");
				actionsRow.appendChild(btnSync);
			}

			const btnDelete = createActionBtn("🗑️", "Eliminar este prefab", () => this.handleDeletePrefab(prefab), "#cc3333");
			btnDelete.style.flex = "0 0 28px";
			actionsRow.appendChild(btnDelete);

			card.appendChild(actionsRow);
			this.libraryListContainer.appendChild(card);
		});
	}

	private handleExportJson() {
		if (!this.selectedNodeId) {
			alert("Selecciona un grupo u objeto para exportar.");
			return;
		}

		const node = this.hierarchy.getNode(this.selectedNodeId);
		if (!node) return;

		const payload = this.prefabManager.createPrefabPayloadFromSelection(
			this.selectedNodeId,
			node.customName || node.name,
			(id) => this.fetchObjectData(id)
		);

		if (!payload) {
			alert("No se pudo empaquetar el objeto seleccionado para exportación.");
			return;
		}

		const json = PrefabSerializer.exportToPackageJson(payload, "VIPER IO User");
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.prefab.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	private handleImportJson() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
		input.onchange = async (e: any) => {
			const file = e.target.files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const validation = PrefabSerializer.validateAndParse(text);

				if (!validation.valid || !validation.data) {
					alert(`Archivo de prefab inválido o corrupto: ${validation.error}`);
					return;
				}

				const spawnPos = this.calculateSpawnPlacement(5.0);

				const targetParent = this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup
					? this.selectedNodeId
					: null;

				const result = this.prefabManager.instantiatePrefab(
					validation.data,
					`imported_${Date.now()}`,
					1,
					spawnPos,
					targetParent,
					(data) => {
						this.game._loadSingleMapObject(data);
						if (this.game.networkManager && typeof this.game.networkManager.sendEditorPlace === "function") {
							this.game.networkManager.sendEditorPlace(data);
						}
					},
					(groupId, pos) => {
						const proxy = this.groupManager.getOrCreatePivotProxy(groupId);
						if (pos) {
							proxy.position.set(pos.x, pos.y, pos.z);
						}
					}
				);

				if (this.groupManager.isCouplingMode()) {
					this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
				}

				this.renderTree();
				this.switchTab("scene");

				if (result && result.rootNodeId) {
					if (this.game?.editorSelection) {
						this.game.editorSelection.selectSingle(result.rootNodeId, "explorer");
					} else {
						this.selectNode(result.rootNodeId);
					}
				}

				alert(`Prefab '${validation.data.name}' importado con éxito.`);
			} catch (err: any) {
				console.error("[Explorer] Error leyendo archivo de prefab:", err);
				alert(`Error al leer archivo: ${err.message}`);
			}
		};
		input.click();
	}

	// ── Feedback y Ayudantes de resolución de objetos ───────────────────────────

	private showToast(message: string, durationMs: number = 2200) {
		if (typeof document === "undefined" || !document.body) return;
		let toast = document.getElementById("viper-editor-toast");
		if (!toast) {
			toast = document.createElement("div");
			toast.id = "viper-editor-toast";
			toast.style.cssText = `
				position: fixed;
				bottom: 60px;
				left: 50%;
				transform: translateX(-50%);
				background: rgba(15, 23, 42, 0.92);
				backdrop-filter: blur(8px);
				border: 1px solid rgba(56, 189, 248, 0.6);
				border-radius: 9999px;
				padding: 7px 18px;
				color: #e0f2fe;
				font-size: 13px;
				font-weight: 600;
				font-family: system-ui, -apple-system, sans-serif;
				pointer-events: none;
				z-index: 10000;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
				transition: opacity 0.3s ease;
			`;
			document.body.appendChild(toast);
		}
		toast.textContent = message;
		toast.style.opacity = "1";
		if ((this as any)._toastTimeout) clearTimeout((this as any)._toastTimeout);
		(this as any)._toastTimeout = setTimeout(() => {
			if (toast) toast.style.opacity = "0";
		}, durationMs);
	}

	private resolveObject3D(uuid: string): any {
		if (this.game?.resolveObject3D) {
			return this.game.resolveObject3D(uuid);
		}
		const node = this.hierarchy.getNode(uuid);
		if (node?.isGroup && this.groupManager) {
			return this.groupManager.getOrCreatePivotProxy(uuid);
		}
		if (this.game?.editableMapObjects) {
			const found = this.game.editableMapObjects.find(
				(obj: any) => obj.userData && obj.userData.uuid === uuid
			);
			if (found) return found;
		}
		if (this.game?.sceneManager?.scene) {
			const direct = this.game.sceneManager.scene.children.find(
				(child: any) => child.userData && child.userData.uuid === uuid
			);
			if (direct) return direct;
			let foundTraverse: any = null;
			this.game.sceneManager.scene.traverse((child: any) => {
				if (!foundTraverse && child.userData && child.userData.uuid === uuid) {
					foundTraverse = child;
				}
			});
			return foundTraverse;
		}
		return null;
	}

	private fetchObjectData(uuid: string): any {
		const obj = this.resolveObject3D(uuid);
		if (!obj) return null;

		const node = this.hierarchy.getNode(uuid);

		return {
			uuid: obj.userData.uuid,
			type: obj.userData.mapObjectType || obj.userData.type || "wall",
			color: obj.userData.color,
			originalScale: obj.userData.originalScale,
			pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
			rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
			texturePath: obj.userData.texturePath,
			textureAssetId: obj.userData.textureAssetId,
			textureSettings: obj.userData.textureSettings,
			logicProperties: obj.userData.logicProperties ? JSON.parse(JSON.stringify(obj.userData.logicProperties)) : undefined,
			customName: obj.userData.customName || node?.customName || node?.name,
			invisible: obj.userData.invisible,
			opacity: obj.userData.opacity,
			bodyType: obj.userData.bodyType,
			collisionType: obj.userData.collisionType,
			authorId: obj.userData.authorId,
			parentId: node ? node.parentId : (obj.userData.parentId || null),
			order: node ? node.order : (obj.userData.order ?? 0),
		};
	}

	public cancelDrag() {
		this.draggedNodeIds = [];
		this.game.interaction?.end("tree-drag");
	}

	dispose() {
		this.cancelDrag();
		if (this.hideTimeoutId) {
			clearTimeout(this.hideTimeoutId);
			this.hideTimeoutId = null;
		}
		this.events.abort();
		this.container.remove();
	}
}

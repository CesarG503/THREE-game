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
import { EditorCommandHistory, ReparentCommand, DuplicateCommand } from "../history/EditorCommandHistory";
import { PrefabManager } from "../prefabs/PrefabManager";
import { PrefabSerializer } from "../prefabs/PrefabSerializer";
import { PrefabService } from "../prefabs/PrefabService";
import type { PlatformPrefabDto } from "../prefabs/PrefabTypes";

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
	private currentTab: "scene" | "library" = "scene";
	private btnTabScene!: HTMLButtonElement;
	private btnTabLibrary!: HTMLButtonElement;
	private sceneContentContainer!: HTMLElement;
	private libraryContainer!: HTMLElement;

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
	private selectedNodeId: string | null = null;
	private searchQuery: string = "";
	private shortcutKey: string = "h";

	// Ancho configurable, límites y resizer
	public readonly minWidth: number = 260;
	public readonly maxWidth: number = 600;
	public currentWidth: number = 340;
	private isResizing: boolean = false;
	private resizerElement!: HTMLElement;
	private hideTimeoutId: any = null;

	// Estado de arrastre en el árbol
	private draggedNodeId: string | null = null;

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
			background: rgba(0, 0, 0, 0.9);
			backdrop-filter: blur(12px);
			border-right: 2px solid #444;
			border-top: 2px solid #444;
			border-bottom: 2px solid #444;
			border-left: none;
			border-top-right-radius: 12px;
			border-bottom-right-radius: 12px;
			box-shadow: 0 0 25px rgba(0, 0, 0, 0.85);
			color: white;
			font-family: sans-serif;
			font-size: 13px;
			display: none;
			flex-direction: column;
			z-index: 2500;
			user-select: none;
			transform: translateX(-100%);
			opacity: 0;
			pointer-events: none;
			transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
		`;

		// ── Encabezado (mismo estilo que ObjectInspector) ───────────────────────
		const header = document.createElement("div");
		header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			border-bottom: 1px solid #555;
			flex-shrink: 0;
		`;

		const titleBox = document.createElement("div");
		titleBox.style.cssText = `display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; color: white;`;
		titleBox.innerHTML = `<span>🗂️</span><span>Jerarquía / Explorer</span><span style="font-size: 10px; background: #222; color: #aaa; padding: 2px 5px; border-radius: 4px; border: 1px solid #444; font-weight: normal;">[${this.shortcutKey.toUpperCase()}]</span>`;

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
		this.container.appendChild(header);

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

		// ── Barra de Pestañas (Mismo estilo que ConstructionMenu) ───────────────
		const tabBar = document.createElement("div");
		tabBar.style.cssText = `
			display: flex;
			border-bottom: 1px solid #555;
			flex-shrink: 0;
			padding: 0 16px;
			gap: 16px;
		`;

		this.btnTabScene = document.createElement("div");
		this.btnTabScene.innerHTML = `<span>🗂️</span><span>Escena</span>`;
		this.btnTabScene.style.cssText = `
			padding: 10px 4px;
			background: transparent;
			color: white;
			border: none;
			border-bottom: 2px solid white;
			font-size: 13px;
			font-weight: bold;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			transition: all 0.15s ease;
			user-select: none;
		`;
		this.btnTabScene.onclick = () => this.switchTab("scene");

		this.btnTabLibrary = document.createElement("div");
		this.btnTabLibrary.innerHTML = `<span>📦</span><span>Biblioteca</span>`;
		this.btnTabLibrary.style.cssText = `
			padding: 10px 4px;
			background: transparent;
			color: #888;
			border: none;
			border-bottom: 2px solid transparent;
			font-size: 13px;
			font-weight: normal;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			transition: all 0.15s ease;
			user-select: none;
		`;
		this.btnTabLibrary.onmouseenter = () => {
			if (this.currentTab !== "library") this.btnTabLibrary.style.color = "#ccc";
		};
		this.btnTabLibrary.onmouseleave = () => {
			if (this.currentTab !== "library") this.btnTabLibrary.style.color = "#888";
		};
		this.btnTabScene.onmouseenter = () => {
			if (this.currentTab !== "scene") this.btnTabScene.style.color = "#ccc";
		};
		this.btnTabScene.onmouseleave = () => {
			if (this.currentTab !== "scene") this.btnTabScene.style.color = "#888";
		};
		this.btnTabLibrary.onclick = () => this.switchTab("library");

		tabBar.appendChild(this.btnTabScene);
		tabBar.appendChild(this.btnTabLibrary);
		this.container.appendChild(tabBar);

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

		// Botón Crear Grupo en Raíz (Corrección 1: Nunca anida automáticamente)
		const btnNewGroup = createBtn("+ Grupo", "Crea un nuevo grupo en la raíz de la escena", () => {
			this.handleCreateGroup();
		});

		// Botón Crear Subgrupo Explícito (Corrección 1: Acción diferenciada)
		const btnNewSubgroup = createBtn("+ Subgrupo", "Crea un subgrupo explícito dentro del grupo seleccionado", () => {
			this.handleCreateSubgroup();
		});

		// Botón Agrupar Selección (Agrupa el elemento seleccionado bajo un nuevo grupo)
		const btnGroupSelection = createBtn("Agrupar", "Agrupa el elemento seleccionado dentro de un nuevo grupo", () => {
			this.handleGroupSelection();
		});

		// Botón Desagrupar
		const btnUngroup = createBtn("Desagrupar", "Desagrupa el grupo seleccionado devolviendo sus hijos al nivel superior", () => {
			this.handleUngroup();
		});

		// Botón Desacoplar
		const btnDecouple = createBtn("Desacoplar", "Desacopla el elemento seleccionado de su grupo actual (sube a la raíz)", () => {
			this.handleDecouple();
		});

		// Botón Modo Acoples (Visualizar líneas y recuadros conectores 3D)
		this.btnToggleCoupling = createBtn(
			"Acoples: OFF",
			"Modo Acoples 3D: Muestra los recuadros superiores de acople.\n• Arrastrar recuadro: Mover objeto en 3D (conserva su grupo)\n• Shift + Arrastrar: Vincular / Acoplar a otro grupo\n• Clic derecho: Desacoplar a la raíz\n(Atajo: tecla 'C')",
			() => {
				this.toggleCouplingMode();
			}
		);

		// Botón Modo Editar Pivote (Reubicar pivote sin mover objetos)
		this.btnTogglePivotEdit = createBtn("Pivote: OFF", "Modo para reubicar el pivote de un grupo sin mover sus objetos", () => {
			this.togglePivotEditMode();
		});

		// Botones Portapapeles
		const btnCopy = createBtn("Copiar", "Copia el nodo seleccionado", () => this.handleCopy());
		const btnPaste = createBtn("Pegar", "Pega el contenido del portapapeles", () => this.handlePaste());
		const btnDuplicate = createBtn("Duplicar", "Duplica el elemento o grupo actual con nuevos UUIDs", () => this.handleDuplicate());

		// Botones Prefab
		const btnSavePrefab = createBtn("⭐ Prefab", "Guarda el grupo seleccionado como un prefab persistente", () => this.handleSavePrefab());
		const btnExport = createBtn("📤 Exp", "Exporta el grupo seleccionado como JSON descargable", () => this.handleExportJson());
		const btnImport = createBtn("📥 Imp", "Importa un archivo JSON de prefab", () => this.handleImportJson());

		toolbar.appendChild(btnNewGroup);
		toolbar.appendChild(btnNewSubgroup);
		toolbar.appendChild(btnGroupSelection);
		toolbar.appendChild(btnUngroup);
		toolbar.appendChild(btnDecouple);
		toolbar.appendChild(this.btnToggleCoupling);
		toolbar.appendChild(this.btnTogglePivotEdit);
		toolbar.appendChild(btnCopy);
		toolbar.appendChild(btnPaste);
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
		this.container.appendChild(this.sceneContentContainer);

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

		this.container.appendChild(this.libraryContainer);

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
			#editor-hierarchy-explorer > div:nth-child(-n+2) { flex-shrink: 0; }
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

			// Agrupar con Ctrl+G
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && !e.shiftKey) {
				e.preventDefault();
				this.handleGroupSelection();
			}

			// Desagrupar con Ctrl+Shift+G
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && e.shiftKey) {
				e.preventDefault();
				this.handleUngroup();
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

	public switchTab(tab: "scene" | "library") {
		this.currentTab = tab;
		if (tab === "scene") {
			this.sceneContentContainer.style.display = "flex";
			this.libraryContainer.style.display = "none";
			this.btnTabScene.style.background = "transparent";
			this.btnTabScene.style.color = "white";
			this.btnTabScene.style.fontWeight = "bold";
			this.btnTabScene.style.borderBottom = "2px solid white";
			this.btnTabLibrary.style.background = "transparent";
			this.btnTabLibrary.style.color = "#888";
			this.btnTabLibrary.style.fontWeight = "normal";
			this.btnTabLibrary.style.borderBottom = "2px solid transparent";
			this.renderTree();
		} else {
			this.sceneContentContainer.style.display = "none";
			this.libraryContainer.style.display = "flex";
			this.btnTabLibrary.style.background = "transparent";
			this.btnTabLibrary.style.color = "white";
			this.btnTabLibrary.style.fontWeight = "bold";
			this.btnTabLibrary.style.borderBottom = "2px solid white";
			this.btnTabScene.style.background = "transparent";
			this.btnTabScene.style.color = "#888";
			this.btnTabScene.style.fontWeight = "normal";
			this.btnTabScene.style.borderBottom = "2px solid transparent";
			this.loadLibraryPrefabs();
		}
	}

	private toggleCollapse() {
		this.isCollapsed = !this.isCollapsed;
		const tabBar = this.btnTabScene?.parentElement;
		const elementsToToggle = [tabBar, this.sceneContentContainer, this.libraryContainer];
		elementsToToggle.forEach((el) => {
			if (el) (el as HTMLElement).style.display = this.isCollapsed ? "none" : "";
		});
		if (this.isCollapsed) {
			this.container.style.height = "auto";
			this.container.style.borderBottom = "2px solid #444";
		} else {
			this.container.style.height = "100vh";
			this.container.style.height = "100dvh";
			this.container.style.borderBottom = "2px solid #444";
			this.switchTab(this.currentTab);
		}
	}

	private toggleCouplingMode() {
		const active = !this.groupManager.isCouplingMode();
		this.groupManager.setCouplingMode(active, (id) => this.resolveObject3D(id));
		this.btnToggleCoupling.textContent = `Acoples: ${active ? "ON" : "OFF"}`;
		this.btnToggleCoupling.style.background = active ? "#0088cc" : "#444";
		this.btnToggleCoupling.style.borderColor = active ? "#38bdf8" : "#555";
		this.game.updateEditorInteractionMode?.();
	}

	private togglePivotEditMode() {
		const active = !this.groupManager.isPivotEditMode();
		this.groupManager.setPivotEditMode(active);
		this.btnTogglePivotEdit.textContent = `Pivote: ${active ? "ON" : "OFF"}`;
		this.btnTogglePivotEdit.style.background = active ? "#0088cc" : "#444";
		this.btnTogglePivotEdit.style.borderColor = active ? "#38bdf8" : "#555";
	}

	selectNode(nodeId: string | null, syncInspector: boolean = true) {
		this.selectedNodeId = nodeId;
		this.renderTree();

		if (!syncInspector) return;

		if (!nodeId) {
			if (this.game.objectInspector && this.game.objectInspector.isVisible) {
				this.game.objectInspector.hide();
			}
			return;
		}

		const node = this.hierarchy.getNode(nodeId);
		if (!node) return;

		if (node.isGroup) {
			// Seleccionar proxy de pivote central de grupo
			const proxy = this.groupManager.getOrCreatePivotProxy(node.id);
			if (this.game.objectInspector) {
				this.game.objectInspector.show(proxy);
			}
		} else {
			// Seleccionar objeto físico individual
			const obj = this.resolveObject3D(node.id);
			if (obj && this.game.objectInspector) {
				this.game.objectInspector.show(obj);
			}
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
			const draggedId = this.draggedNodeId || (e.dataTransfer?.types.includes("text/plain") ? this.draggedNodeId : null);
			if (!draggedId) return;
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
			const draggedId = this.draggedNodeId || e.dataTransfer?.getData("text/plain");
			if (!draggedId) return;
			const node = this.hierarchy.getNode(draggedId);
			if (!node || !node.parentId) return;

			const oldParentId = node.parentId;
			const oldOrder = node.order;

			this.hierarchy.reparent(draggedId, null);
			if (oldParentId) {
				this.groupManager.recenterGroupPivot(oldParentId, (id) => this.resolveObject3D(id));
			}
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
			this.history.execute(
				new ReparentCommand(this.hierarchy, draggedId, oldParentId, oldOrder, null, undefined, () => this.renderTree())
			);
			this.renderTree();
			this.selectNode(draggedId);
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
		const isSelected = this.selectedNodeId === node.id;
		itemRow.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 5px 8px;
			padding-left: ${depth * 16 + 8}px;
			border-radius: 4px;
			cursor: grab;
			margin-bottom: 2px;
			background: ${isSelected ? "rgba(255, 255, 255, 0.15)" : "transparent"};
			color: ${isSelected ? "#ffffff" : "#cccccc"};
			font-weight: ${isSelected ? "bold" : "normal"};
			transition: background 0.1s ease, border 0.1s ease;
			border: 1px solid ${isSelected ? "#666" : "transparent"};
			box-sizing: border-box;
			width: 100%;
			min-width: 0;
			flex-shrink: 0;
			${isPrefabRoot ? "border-left: 3px solid #ffc107;" : isPrefabMember ? "border-left: 2px solid #ca8a04;" : (isSelected ? "border-left: 3px solid #fff;" : "")}
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
			e.dataTransfer?.setData("text/plain", node.id);
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
			this.draggedNodeId = node.id;
			itemRow.style.opacity = "0.45";
		};

		itemRow.ondragend = () => {
			this.game.interaction?.end("tree-drag");
			this.draggedNodeId = null;
			itemRow.style.opacity = "1";
			this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember);
		};

		itemRow.ondragover = (e) => {
			const draggedId = this.draggedNodeId || (e.dataTransfer?.types.includes("text/plain") ? this.draggedNodeId : null);
			if (!draggedId || draggedId === node.id) return;
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

			// Validar contra ciclos y restricciones jerárquicas
			const targetParentId = dropPosition === "inside" ? node.id : node.parentId;
			const check = this.hierarchy.canReparent(draggedId, targetParentId);

			if (!check.allowed) {
				if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
				itemRow.style.borderColor = "#cc3333";
				itemRow.style.background = "rgba(204, 51, 51, 0.2)";
			} else {
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember);

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
			this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember);
		};

		itemRow.ondrop = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.resetRowDropStyles(itemRow, isSelected, isPrefabRoot, isPrefabMember);

			const draggedId = this.draggedNodeId || e.dataTransfer?.getData("text/plain");
			if (!draggedId || draggedId === node.id) return;
			const draggedNode = this.hierarchy.getNode(draggedId);
			if (!draggedNode) return;

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
			let targetOrder: number | undefined = undefined;

			if (dropPosition === "inside") {
				targetParentId = node.id;
				targetOrder = undefined;
			} else if (dropPosition === "before") {
				targetParentId = node.parentId;
				targetOrder = node.order;
			} else {
				targetParentId = node.parentId;
				targetOrder = node.order + 1;
			}

			const validation = this.hierarchy.canReparent(draggedId, targetParentId);
			if (!validation.allowed) {
				console.warn(`[Explorer DragDrop] Operación no permitida: ${validation.reason}`);
				return;
			}

			const oldParentId = draggedNode.parentId;
			const oldOrder = draggedNode.order;

			// Ejecutar reparenting conservando transformaciones mundiales
			this.hierarchy.reparent(draggedId, targetParentId, targetOrder);

			// Recalcular pivotes de grupos afectados
			if (oldParentId) {
				this.groupManager.recenterGroupPivot(oldParentId, (id) => this.resolveObject3D(id));
			}
			if (targetParentId) {
				this.groupManager.recenterGroupPivot(targetParentId, (id) => this.resolveObject3D(id));
			}

			// Actualizar visuales de acople 3D
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));

			// Registrar comando en historial Undo/Redo
			this.history.execute(
				new ReparentCommand(this.hierarchy, draggedId, oldParentId, oldOrder, targetParentId, targetOrder, () => {
					this.renderTree();
				})
			);

			// Actualizar colaborativo si corresponde
			const movedObj = this.resolveObject3D(draggedId);
			if (movedObj && this.game.broadcastObjectUpdate) {
				this.game.broadcastObjectUpdate(movedObj);
			}

			this.renderTree();
			this.selectNode(draggedId);
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

		itemRow.onclick = () => {
			this.selectNode(node.id);
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
	 * Corrección 1: Crear grupo nuevo SIEMPRE en la raíz por defecto,
	 * sin convertir automáticamente el grupo seleccionado en su hijo.
	 */
	private handleCreateGroup() {
		const name = prompt("Nombre del nuevo grupo:", "Nuevo Grupo");
		if (!name || !name.trim()) return;

		const newGroup = this.hierarchy.createGroup(name.trim(), null);
		this.groupManager.getOrCreatePivotProxy(newGroup.id);
		this.renderTree();
		this.selectNode(newGroup.id);
	}

	/**
	 * Corrección 1: Crear subgrupo explícito dentro del grupo seleccionado.
	 */
	private handleCreateSubgroup() {
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
	}

	/**
	 * Agrupa el elemento seleccionado o varios elementos bajo un nuevo grupo.
	 */
	private handleGroupSelection() {
		if (!this.selectedNodeId) {
			alert("Selecciona un objeto o grupo para agrupar.");
			return;
		}

		const selectedNode = this.hierarchy.getNode(this.selectedNodeId);
		if (!selectedNode) return;

		const name = prompt("Nombre del grupo contenedor:", "Nuevo Grupo");
		if (!name || !name.trim()) return;

		const group = this.hierarchy.createGroup(name.trim(), selectedNode.parentId);
		this.hierarchy.reparent(selectedNode.id, group.id);
		this.groupManager.recenterGroupPivot(group.id, (id) => this.resolveObject3D(id));
		this.renderTree();
		this.selectNode(group.id);
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

	private handleCopy() {
		if (!this.selectedNodeId) return;
		const copied = this.clipboard.copy(
			[this.selectedNodeId],
			this.hierarchy,
			(id) => this.fetchObjectData(id)
		);
		if (copied) {
			console.log(`[Explorer] Nodo ${this.selectedNodeId} copiado al portapapeles.`);
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

		const camera = this.game.sceneManager?.camera;
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
				const rayOrigin = new THREE.Vector3(targetX, charPos.y + 10, targetZ);
				const rayDir = new THREE.Vector3(0, -1, 0);
				const raycaster = new THREE.Raycaster(rayOrigin, rayDir, 0.1, 40);
				const hits = raycaster.intersectObjects(this.game.sceneManager.scene.children, true);
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
			}

			return { x: targetX, y: targetY, z: targetZ };
		}

		return { x: 5, y: 0, z: 5 };
	}

	private handlePaste() {
		if (!this.clipboard.hasContent()) return;

		const targetParent = this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup
			? this.selectedNodeId
			: null;

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
					this.selectNode(newSelectedId);
				}
			}
		);

		this.history.execute(cmd);
	}

	private handleDuplicate() {
		if (!this.selectedNodeId) return;
		const node = this.hierarchy.getNode(this.selectedNodeId);
		if (!node) return;

		// Copiar la selección actual
		const copied = this.clipboard.copy(
			[this.selectedNodeId],
			this.hierarchy,
			(id) => this.fetchObjectData(id)
		);
		if (!copied) return;

		// El duplicado debe crearse como hermano del original (targetParent = node.parentId)
		const targetParent = node.parentId;
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
					this.selectNode(newSelectedId);
				}
			}
		);

		this.history.execute(cmd);
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

	private handleInsertPrefab(prefab: PlatformPrefabDto) {
		const spawnPos = this.calculateSpawnPlacement(5.0);

		const targetParent = this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup
			? this.selectedNodeId
			: null;

		const result = this.prefabManager.instantiatePrefab(
			prefab.data,
			prefab.id,
			prefab.version,
			spawnPos,
			targetParent,
			(data) => {
				this.game._loadSingleMapObject(data);
			},
			(groupId, pos) => {
				const proxy = this.groupManager.getOrCreatePivotProxy(groupId);
				if (pos) {
					proxy.position.set(pos.x, pos.y, pos.z);
				}
			}
		);

		this.switchTab("scene");
		if (result && result.rootNodeId) {
			this.selectNode(result.rootNodeId);
		}
	}

	private handleExportPrefabDtoJson(prefab: PlatformPrefabDto) {
		const json = PrefabSerializer.exportToPackageJson(prefab.data, prefab.ownerId || "VIPER IO User");
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${prefab.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.prefab.json`;
		a.click();
		URL.revokeObjectURL(url);
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

		const searchQuery = this.librarySearchInput?.value.toLowerCase().trim() || "";
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

			const objectCount = prefab.data?.objects?.length ?? 0;
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

				this.prefabManager.instantiatePrefab(
					validation.data,
					`imported_${Date.now()}`,
					1,
					spawnPos,
					targetParent,
					(data) => {
						this.game._loadSingleMapObject(data);
					},
					(groupId, pos) => {
						const proxy = this.groupManager.getOrCreatePivotProxy(groupId);
						if (pos) {
							proxy.position.set(pos.x, pos.y, pos.z);
						}
					}
				);

				this.renderTree();
				alert(`Prefab '${validation.data.name}' importado con éxito.`);
			} catch (err: any) {
				console.error("[Explorer] Error leyendo archivo de prefab:", err);
				alert(`Error al leer archivo: ${err.message}`);
			}
		};
		input.click();
	}

	// ── Ayudantes de resolución de objetos ──────────────────────────────────────

	private resolveObject3D(uuid: string): any {
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
		this.draggedNodeId = null;
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

/**
 * EditorExplorer.ts
 * VIPER IO — Panel de Explorer jerárquico del editor.
 *
 * Visualiza, selecciona y organiza grupos, subgrupos y objetos individuales:
 * - Selección sincronizada con la escena 3D y TransformGizmo.
 * - Creación y gestión de grupos y subgrupos.
 * - Acople y desacople con preservación de transformaciones globales.
 * - Alternancia de modo de acoples y modo de edición independiente de pivotes.
 * - Operaciones de portapapeles (copiar, pegar, duplicar) y prefabs.
 * - Atajo configurable (tecla 'H') sin conflicto con tecla 'E' del menú de construcción.
 */

import { EditorHierarchyModel, type HierarchyNode } from "../hierarchy/EditorHierarchyModel";
import { EditorGroupManager } from "../hierarchy/EditorGroupManager";
import { EditorClipboard } from "../clipboard/EditorClipboard";
import { EditorCommandHistory } from "../history/EditorCommandHistory";
import { PrefabManager } from "../prefabs/PrefabManager";
import { PrefabSerializer } from "../prefabs/PrefabSerializer";
import { PrefabService } from "../prefabs/PrefabService";

export interface EditorExplorerOptions {
	shortcutKey?: string; // Por defecto 'h'
}

export class EditorExplorer {
	private game: any;
	private hierarchy: EditorHierarchyModel;
	private groupManager: EditorGroupManager;
	private clipboard: EditorClipboard;
	private history: EditorCommandHistory;
	private prefabManager: PrefabManager;

	public container!: HTMLElement;
	private treeContainer!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private btnToggleCoupling!: HTMLButtonElement;
	private btnTogglePivotEdit!: HTMLButtonElement;

	private isVisible: boolean = false;
	private isCollapsed: boolean = false;
	private collapsedGroups: Set<string> = new Set();
	private selectedNodeId: string | null = null;
	private searchQuery: string = "";
	private shortcutKey: string = "h";

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
		this.shortcutKey = (options.shortcutKey || "h").toLowerCase();

		this.createUI();
		this.setupKeyboardShortcuts();
	}

	private createUI() {
		this.container = document.createElement("div");
		this.container.id = "editor-explorer";
		this.container.style.cssText = `
			position: absolute;
			top: 20px;
			left: 20px;
			width: 330px;
			max-height: 88vh;
			background: rgba(16, 20, 26, 0.94);
			backdrop-filter: blur(8px);
			border: 1px solid #303846;
			border-radius: 10px;
			display: none;
			flex-direction: column;
			color: #e2e8f0;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			font-size: 13px;
			z-index: 1990;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
			overflow: hidden;
			user-select: none;
		`;

		// ── Header ─────────────────────────────────────────────────────────────
		const header = document.createElement("div");
		header.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 10px 14px;
			background: #18202c;
			border-bottom: 1px solid #303846;
		`;

		const titleBox = document.createElement("div");
		titleBox.style.cssText = `display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px;`;
		titleBox.innerHTML = `<span>🌳</span><span>Explorer de Escena</span>`;

		const headerButtons = document.createElement("div");
		headerButtons.style.cssText = `display: flex; align-items: center; gap: 8px;`;

		const collapseBtn = document.createElement("button");
		collapseBtn.innerHTML = "▲";
		collapseBtn.title = "Minimizar / Maximizar";
		collapseBtn.style.cssText = `background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px;`;
		collapseBtn.onclick = () => this.toggleCollapse();

		const closeBtn = document.createElement("button");
		closeBtn.innerHTML = "✕";
		closeBtn.title = "Cerrar Explorer (H)";
		closeBtn.style.cssText = `background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;`;
		closeBtn.onclick = () => this.hide();

		headerButtons.appendChild(collapseBtn);
		headerButtons.appendChild(closeBtn);
		header.appendChild(titleBox);
		header.appendChild(headerButtons);
		this.container.appendChild(header);

		// ── Barra de herramientas ──────────────────────────────────────────────
		const toolbar = document.createElement("div");
		toolbar.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			padding: 8px 12px;
			background: #131922;
			border-bottom: 1px solid #232c3b;
		`;

		const createBtn = (label: string, title: string, onClick: () => void, accentColor?: string) => {
			const btn = document.createElement("button");
			btn.textContent = label;
			btn.title = title;
			btn.style.cssText = `
				background: ${accentColor ? accentColor : "#242e3d"};
				color: #f1f5f9;
				border: 1px solid #3b4759;
				border-radius: 5px;
				padding: 4px 8px;
				font-size: 11px;
				font-weight: 500;
				cursor: pointer;
				transition: all 0.15s ease;
			`;
			btn.onmouseenter = () => (btn.style.filter = "brightness(1.2)");
			btn.onmouseleave = () => (btn.style.filter = "none");
			btn.onclick = onClick;
			return btn;
		};

		// Botón Crear Grupo
		const btnNewGroup = createBtn("+ Grupo", "Crea un nuevo grupo o agrupa el elemento seleccionado", () => {
			this.handleCreateGroup();
		});

		// Botón Desagrupar
		const btnUngroup = createBtn("Desagrupar", "Desagrupa el grupo seleccionado devolviendo sus hijos al nivel superior", () => {
			this.handleUngroup();
		});

		// Botón Desacoplar
		const btnDecouple = createBtn("Desacoplar", "Desacopla el elemento seleccionado de su grupo actual (sube a la raíz)", () => {
			this.handleDecouple();
		});

		// Botón Modo Acoples (Visualizar líneas de conexión)
		this.btnToggleCoupling = createBtn("Acoples: OFF", "Alterna la visualización de conexiones entre pivotes y miembros", () => {
			this.toggleCouplingMode();
		});

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
		this.container.appendChild(toolbar);

		// ── Buscador ───────────────────────────────────────────────────────────
		const searchRow = document.createElement("div");
		searchRow.style.cssText = `padding: 6px 12px; background: #131922; border-bottom: 1px solid #232c3b;`;
		this.searchInput = document.createElement("input");
		this.searchInput.type = "text";
		this.searchInput.placeholder = "🔍 Buscar objeto o grupo...";
		this.searchInput.style.cssText = `
			width: 100%;
			box-sizing: border-box;
			background: #1e2837;
			border: 1px solid #334155;
			border-radius: 4px;
			color: #fff;
			padding: 4px 8px;
			font-size: 12px;
			outline: none;
		`;
		this.searchInput.oninput = (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderTree();
		};
		searchRow.appendChild(this.searchInput);
		this.container.appendChild(searchRow);

		// ── Contenedor del árbol ────────────────────────────────────────────────
		this.treeContainer = document.createElement("div");
		this.treeContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 8px 6px;
			max-height: 60vh;
			scrollbar-width: thin;
			scrollbar-color: #3b4759 #131922;
		`;
		this.container.appendChild(this.treeContainer);

		document.body.appendChild(this.container);
	}

	private setupKeyboardShortcuts() {
		document.addEventListener("keydown", (e: KeyboardEvent) => {
			const active = document.activeElement as HTMLElement | null;
			if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
				return;
			}

			const key = e.key.toLowerCase();
			if (key === this.shortcutKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				this.toggle();
			} else if (key === "c" && this.isVisible && !e.ctrlKey && !e.altKey && !e.metaKey) {
				// Atajo rápido para alternar modo acoples cuando el explorer está abierto
				e.preventDefault();
				this.toggleCouplingMode();
			}
		});
	}

	show() {
		this.isVisible = true;
		this.container.style.display = "flex";
		this.renderTree();
	}

	hide() {
		this.isVisible = false;
		this.container.style.display = "none";
	}

	toggle() {
		if (this.isVisible) this.hide();
		else this.show();
	}

	private toggleCollapse() {
		this.isCollapsed = !this.isCollapsed;
		this.treeContainer.style.display = this.isCollapsed ? "none" : "block";
		this.container.style.maxHeight = this.isCollapsed ? "45px" : "88vh";
	}

	toggleCouplingMode() {
		const active = !this.groupManager.isCouplingMode();
		this.groupManager.setCouplingMode(active);
		this.btnToggleCoupling.textContent = `Acoples: ${active ? "ON" : "OFF"}`;
		this.btnToggleCoupling.style.background = active ? "#0ea5e9" : "#242e3d";
		if (active) {
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
		}
	}

	togglePivotEditMode() {
		const active = !this.groupManager.isPivotEditMode();
		this.groupManager.setPivotEditMode(active);
		this.btnTogglePivotEdit.textContent = `Pivote: ${active ? "ON" : "OFF"}`;
		this.btnTogglePivotEdit.style.background = active ? "#f59e0b" : "#242e3d";
	}

	selectNode(nodeId: string | null) {
		this.selectedNodeId = nodeId;
		this.renderTree();

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
			emptyMsg.style.cssText = `color: #64748b; text-align: center; padding: 20px 0; font-style: italic;`;
			emptyMsg.textContent = "No hay objetos en la escena";
			this.treeContainer.appendChild(emptyMsg);
			return;
		}

		rootNodes.forEach((node) => {
			this.renderNodeItem(node, this.treeContainer, 0);
		});
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

		const itemRow = document.createElement("div");
		const isSelected = this.selectedNodeId === node.id;
		itemRow.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 4px 6px;
			padding-left: ${depth * 18 + 6}px;
			border-radius: 4px;
			cursor: pointer;
			margin-bottom: 2px;
			background: ${isSelected ? "#1e3a8a" : "transparent"};
			color: ${isSelected ? "#93c5fd" : "#cbd5e1"};
			transition: background 0.1s ease;
		`;

		itemRow.onmouseenter = () => {
			if (!isSelected) itemRow.style.background = "#1e293b";
		};
		itemRow.onmouseleave = () => {
			if (!isSelected) itemRow.style.background = "transparent";
		};

		// Contenido izquierdo: icono, fold, nombre
		const leftBox = document.createElement("div");
		leftBox.style.cssText = `display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;

		if (node.isGroup) {
			const isCollapsed = this.collapsedGroups.has(node.id);
			const foldIcon = document.createElement("span");
			foldIcon.textContent = isCollapsed ? "▶" : "▼";
			foldIcon.style.cssText = `font-size: 9px; width: 12px; cursor: pointer; color: #94a3b8;`;
			foldIcon.onclick = (e) => {
				e.stopPropagation();
				if (isCollapsed) this.collapsedGroups.delete(node.id);
				else this.collapsedGroups.add(node.id);
				this.renderTree();
			};
			leftBox.appendChild(foldIcon);

			const groupIcon = document.createElement("span");
			groupIcon.textContent = isCollapsed ? "📁" : "📂";
			leftBox.appendChild(groupIcon);
		} else {
			const spacer = document.createElement("span");
			spacer.style.width = "12px";
			leftBox.appendChild(spacer);

			const itemIcon = document.createElement("span");
			itemIcon.textContent = this.getNodeIcon(node.type);
			leftBox.appendChild(itemIcon);
		}

		const nameLabel = document.createElement("span");
		nameLabel.textContent = node.customName || node.name;
		nameLabel.style.cssText = `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;`;
		leftBox.appendChild(nameLabel);

		// Contenido derecho: botones de orden y acciones rápidas
		const actionBox = document.createElement("div");
		actionBox.style.cssText = `display: flex; align-items: center; gap: 4px; opacity: 0.6;`;
		itemRow.onmouseenter = () => {
			if (!isSelected) itemRow.style.background = "#1e293b";
			actionBox.style.opacity = "1";
		};
		itemRow.onmouseleave = () => {
			if (!isSelected) itemRow.style.background = "transparent";
			actionBox.style.opacity = "0.6";
		};

		// Botón subir orden
		const btnUp = document.createElement("span");
		btnUp.textContent = "▲";
		btnUp.title = "Subir orden de hermano";
		btnUp.style.cssText = `font-size: 9px; cursor: pointer; padding: 1px 3px; border-radius: 2px;`;
		btnUp.onclick = (e) => {
			e.stopPropagation();
			this.hierarchy.reorderChild(node.id, Math.max(0, node.order - 1));
			this.renderTree();
		};

		// Botón bajar orden
		const btnDown = document.createElement("span");
		btnDown.textContent = "▼";
		btnDown.title = "Bajar orden de hermano";
		btnDown.style.cssText = `font-size: 9px; cursor: pointer; padding: 1px 3px; border-radius: 2px;`;
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

	private handleCreateGroup() {
		const name = prompt("Nombre del nuevo grupo:", "Nuevo Grupo");
		if (!name || !name.trim()) return;

		if (this.selectedNodeId) {
			// Agrupar bajo el elemento seleccionado o convertir el seleccionado en hijo
			const selectedNode = this.hierarchy.getNode(this.selectedNodeId);
			if (selectedNode) {
				const group = this.hierarchy.createGroup(name.trim(), selectedNode.parentId);
				this.hierarchy.reparent(selectedNode.id, group.id);
				this.groupManager.recenterGroupPivot(group.id, (id) => this.resolveObject3D(id));
				this.selectNode(group.id);
				return;
			}
		}

		const newGroup = this.hierarchy.createGroup(name.trim(), null);
		this.renderTree();
		this.selectNode(newGroup.id);
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

		this.hierarchy.reparent(node.id, null);
		if (this.groupManager.isCouplingMode()) {
			this.groupManager.updateCouplingVisuals((id) => this.resolveObject3D(id));
		}
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

	private handlePaste() {
		if (!this.clipboard.hasContent()) return;

		const targetParent = this.selectedNodeId && this.hierarchy.getNode(this.selectedNodeId)?.isGroup
			? this.selectedNodeId
			: null;

		const spawnPos = this.game.character?.body
			? {
					x: this.game.character.body.translation().x + 2,
					y: this.game.character.body.translation().y,
					z: this.game.character.body.translation().z + 2,
			  }
			: undefined;

		const prepared = this.clipboard.preparePaste(spawnPos, targetParent);
		if (!prepared) return;

		prepared.newHierarchyNodes.forEach((node) => {
			this.hierarchy.addNode(node);
		});

		prepared.newObjectsData.forEach((objData) => {
			this.game._loadSingleMapObject(objData);
		});

		this.renderTree();
	}

	private handleDuplicate() {
		if (!this.selectedNodeId) return;
		this.handleCopy();
		this.handlePaste();
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
		} catch (err: any) {
			console.error("[Explorer] Error guardando prefab:", err);
			alert(`Error guardando prefab: ${err.message}`);
		}
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
		input.accept = ".json";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const validation = PrefabSerializer.validateAndParse(text);
				if (!validation.valid || !validation.data) {
					alert(`Archivo de prefab inválido: ${validation.error}`);
					return;
				}

				const spawnPos = this.game.character?.body
					? {
							x: this.game.character.body.translation().x + 2,
							y: this.game.character.body.translation().y,
							z: this.game.character.body.translation().z + 2,
					  }
					: { x: 0, y: 0, z: 0 };

				const result = this.prefabManager.instantiatePrefab(
					validation.data,
					`imported_${Date.now()}`,
					1,
					spawnPos,
					null,
					(objData) => this.game._loadSingleMapObject(objData)
				);

				this.renderTree();
				this.selectNode(result.rootNodeId);
				alert(`Prefab '${validation.data.name}' importado e instanciado exitosamente.`);
			} catch (err: any) {
				alert(`Error leyendo archivo: ${err.message}`);
			}
		};
		input.click();
	}

	private resolveObject3D(uuid: string): any {
		if (!this.game?.sceneManager?.scene) return null;
		return (
			this.game.sceneManager.scene.children.find(
				(c: any) => c.userData && c.userData.uuid === uuid
			) || null
		);
	}

	private fetchObjectData(uuid: string): any {
		const obj = this.resolveObject3D(uuid);
		if (!obj || !obj.userData) return null;

		return {
			type: obj.userData.mapObjectType,
			color: obj.userData.color,
			originalScale: obj.userData.originalScale,
			pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
			rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
			texturePath: obj.userData.texturePath,
			textureAssetId: obj.userData.textureAssetId,
			textureSettings: obj.userData.textureSettings,
			logicProperties: obj.userData.logicProperties,
			uuid: obj.userData.uuid,
			invisible: obj.userData.invisible,
			opacity: obj.userData.opacity,
			authorId: obj.userData.authorId,
			customName: obj.userData.customName || "",
			parentId: obj.userData.parentId || null,
			order: obj.userData.order || 0,
		};
	}

	dispose() {
		this.container.remove();
	}
}

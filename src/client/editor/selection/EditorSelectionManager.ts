import type * as THREE from "three";
import type { EditorHierarchyModel, HierarchyNode } from "../hierarchy/EditorHierarchyModel";

export type SelectionChangeCallback = (selectedIds: string[], activeId: string | null, source?: string) => void;

/**
 * Gestor centralizado y desacoplado del estado de selección del editor.
 * Maneja selección única, múltiple (Shift+Clic), de rangos visuales continuos,
 * y resuelve los nodos efectivos para transformaciones y agrupamiento atómico.
 */
export class EditorSelectionManager {
	private selectedIds = new Set<string>();
	private activeId: string | null = null;
	private listeners: Set<SelectionChangeCallback> = new Set();

	constructor(
		private hierarchy: EditorHierarchyModel,
		private objectResolver?: (id: string) => THREE.Object3D | null
	) {}

	public setObjectResolver(resolver: (id: string) => THREE.Object3D | null) {
		this.objectResolver = resolver;
	}

	public addListener(cb: SelectionChangeCallback): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	private notify(source?: string) {
		const ids = this.getSelectedIds();
		const active = this.activeId;
		this.listeners.forEach((cb) => {
			try {
				cb(ids, active, source);
			} catch (e) {
				console.error("[EditorSelectionManager] Error in selection listener:", e);
			}
		});
	}

	public isSelected(id: string): boolean {
		return this.selectedIds.has(id);
	}

	public getSelectedIds(): string[] {
		return Array.from(this.selectedIds);
	}

	public getActiveId(): string | null {
		return this.activeId;
	}

	public getCount(): number {
		return this.selectedIds.size;
	}

	public getActiveObject(): THREE.Object3D | null {
		if (!this.activeId || !this.objectResolver) return null;
		return this.objectResolver(this.activeId);
	}

	public getSelectedObjects(): THREE.Object3D[] {
		if (!this.objectResolver) return [];
		const result: THREE.Object3D[] = [];
		for (const id of this.selectedIds) {
			const obj = this.objectResolver(id);
			if (obj) result.push(obj);
		}
		return result;
	}

	/**
	 * Retorna únicamente los nodos seleccionados de más alto nivel,
	 * excluyendo cualquier nodo cuyos ancestros también estén seleccionados.
	 * Esto evita aplicar transformaciones duplicadas a descendientes de grupos seleccionados.
	 */
	public getEffectiveTransformNodes(): HierarchyNode[] {
		const nodes: HierarchyNode[] = [];
		for (const id of this.selectedIds) {
			const node = this.hierarchy.getNode(id);
			if (node) nodes.push(node);
		}

		return nodes.filter((node) => {
			let currentParent = node.parentId;
			while (currentParent) {
				if (this.selectedIds.has(currentParent)) {
					return false; // Su ancestro ya está seleccionado
				}
				const parentNode = this.hierarchy.getNode(currentParent);
				currentParent = parentNode?.parentId ?? null;
			}
			return true;
		});
	}

	public getEffectiveTransformNodeIds(): string[] {
		return this.getEffectiveTransformNodes().map((n) => n.id);
	}

	/**
	 * Selección única. Si id es null, deselecciona todo.
	 */
	public selectSingle(id: string | null, source?: string) {
		if (id === null) {
			if (this.selectedIds.size === 0 && this.activeId === null) return;
			this.selectedIds.clear();
			this.activeId = null;
			this.notify(source);
			return;
		}

		if (this.selectedIds.size === 1 && this.selectedIds.has(id) && this.activeId === id) {
			return; // Ya está seleccionado como único
		}

		this.selectedIds.clear();
		this.selectedIds.add(id);
		this.activeId = id;
		this.notify(source);
	}

	/**
	 * Conmuta un elemento en la selección múltiple (Shift+Clic).
	 */
	public toggle(id: string, source?: string) {
		if (this.selectedIds.has(id)) {
			this.selectedIds.delete(id);
			if (this.activeId === id) {
				const remaining = Array.from(this.selectedIds);
				this.activeId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
			}
		} else {
			this.selectedIds.add(id);
			this.activeId = id;
		}
		this.notify(source);
	}

	/**
	 * Selecciona un rango continuo visual de nodos en el Explorer.
	 * Solo toma en cuenta los nodos actualmente visibles (respetando ramas colapsadas).
	 */
	public selectRange(targetId: string, visibleNodeIds: string[], source?: string) {
		if (!this.activeId || !visibleNodeIds.includes(this.activeId)) {
			this.toggle(targetId, source);
			return;
		}

		const fromIdx = visibleNodeIds.indexOf(this.activeId);
		const toIdx = visibleNodeIds.indexOf(targetId);
		if (fromIdx === -1 || toIdx === -1) {
			this.toggle(targetId, source);
			return;
		}

		const start = Math.min(fromIdx, toIdx);
		const end = Math.max(fromIdx, toIdx);

		for (let i = start; i <= end; i++) {
			const id = visibleNodeIds[i];
			if (id) {
				this.selectedIds.add(id);
			}
		}
		this.activeId = targetId;
		this.notify(source);
	}

	/**
	 * Reemplaza explícitamente el conjunto de nodos seleccionados.
	 */
	public setSelection(ids: string[], activeId?: string | null, source?: string) {
		this.selectedIds.clear();
		ids.forEach((id) => this.selectedIds.add(id));
		this.activeId = activeId ?? (ids.length > 0 ? ids[0] : null);
		this.notify(source);
	}

	/**
	 * Deselecciona un elemento específico.
	 */
	public deselect(id: string, source?: string) {
		if (!this.selectedIds.has(id)) return;
		this.selectedIds.delete(id);
		if (this.activeId === id) {
			const remaining = Array.from(this.selectedIds);
			this.activeId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
		}
		this.notify(source);
	}

	/**
	 * Limpia completamente la selección.
	 */
	public clear(source?: string) {
		if (this.selectedIds.size === 0 && this.activeId === null) return;
		this.selectedIds.clear();
		this.activeId = null;
		this.notify(source);
	}
}

/**
 * EditorHierarchyModel.ts
 * VIPER IO — Sistema jerárquico lógico del editor.
 *
 * Mantiene la jerarquía lógica de grupos, subgrupos y objetos individuales
 * con identificadores estables, validación estricta de ciclos y referencias,
 * orden entre hermanos y serialización/deserialización con retrocompatibilidad.
 */

export interface HierarchyNodeData {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
	order: number;
	isGroup: boolean;
	customName?: string;
	pivot?: {
		pos: { x: number; y: number; z: number };
		rot: { x: number; y: number; z: number; w?: number };
	};
	metadata?: Record<string, unknown>;
}

export interface SerializedHierarchyNode {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
	order: number;
	isGroup: boolean;
	customName?: string;
	pivot?: {
		pos: { x: number; y: number; z: number };
		rot: { x: number; y: number; z: number; w?: number };
	};
	metadata?: Record<string, unknown>;
}

export class HierarchyNode implements HierarchyNodeData {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
	order: number;
	isGroup: boolean;
	customName?: string;
	pivot?: {
		pos: { x: number; y: number; z: number };
		rot: { x: number; y: number; z: number; w?: number };
	};
	metadata?: Record<string, unknown>;

	constructor(data: HierarchyNodeData) {
		this.id = data.id;
		this.name = data.name;
		this.type = data.type;
		this.parentId = data.parentId ?? null;
		this.order = typeof data.order === "number" ? data.order : 0;
		this.isGroup = !!data.isGroup;
		this.customName = data.customName ?? (data.isGroup ? data.name : undefined);
		if (data.pivot) {
			this.pivot = {
				pos: { ...data.pivot.pos },
				rot: { ...data.pivot.rot },
			};
		}
		if (data.metadata) {
			this.metadata = { ...data.metadata };
		}
	}

	toJSON(): SerializedHierarchyNode {
		const result: SerializedHierarchyNode = {
			id: this.id,
			name: this.name,
			type: this.type,
			parentId: this.parentId,
			order: this.order,
			isGroup: this.isGroup,
		};
		if (this.customName !== undefined) result.customName = this.customName;
		if (this.pivot !== undefined) result.pivot = this.pivot;
		if (this.metadata !== undefined) result.metadata = this.metadata;
		return result;
	}
}

export class EditorHierarchyModel {
	private nodes: Map<string, HierarchyNode> = new Map();

	/**
	 * Añade o actualiza un nodo en la jerarquía.
	 */
	addNode(data: HierarchyNodeData): HierarchyNode {
		if (data.parentId) {
			const validation = this.canReparent(data.id, data.parentId);
			if (!validation.allowed && this.nodes.has(data.id)) {
				throw new Error(`Jerarquía inválida al registrar ${data.id}: ${validation.reason}`);
			}
		}

		let node = this.nodes.get(data.id);
		if (node) {
			node.name = data.name;
			node.type = data.type;
			node.parentId = data.parentId ?? null;
			node.order = data.order;
			node.isGroup = data.isGroup;
			node.customName = data.customName;
			if (data.pivot) node.pivot = data.pivot;
			if (data.metadata) node.metadata = data.metadata;
		} else {
			node = new HierarchyNode(data);
			this.nodes.set(node.id, node);
		}

		return node;
	}

	getNode(id: string): HierarchyNode | undefined {
		return this.nodes.get(id);
	}

	hasNode(id: string): boolean {
		return this.nodes.has(id);
	}

	getAllNodes(): HierarchyNode[] {
		return Array.from(this.nodes.values());
	}

	/**
	 * Obtiene los hijos directos ordenados por `order`.
	 */
	getChildren(parentId: string | null = null): HierarchyNode[] {
		const children: HierarchyNode[] = [];
		for (const node of this.nodes.values()) {
			if (node.parentId === parentId) {
				children.push(node);
			}
		}
		return children.sort((a, b) => a.order - b.order);
	}

	/**
	 * Obtiene todos los ancestros de un nodo hasta la raíz.
	 */
	getAncestors(id: string): HierarchyNode[] {
		const ancestors: HierarchyNode[] = [];
		let current = this.nodes.get(id);
		const visited = new Set<string>();

		while (current && current.parentId) {
			if (visited.has(current.parentId)) {
				console.warn(`Ciclo detectado en ancestros para nodo ${id}`);
				break;
			}
			visited.add(current.parentId);
			const parent = this.nodes.get(current.parentId);
			if (parent) {
				ancestors.push(parent);
				current = parent;
			} else {
				break;
			}
		}

		return ancestors;
	}

	/**
	 * Obtiene todos los descendientes recursivos de un nodo.
	 */
	getDescendants(id: string): HierarchyNode[] {
		const descendants: HierarchyNode[] = [];
		const queue: string[] = [id];
		const visited = new Set<string>([id]);

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			const children = this.getChildren(currentId);
			for (const child of children) {
				if (!visited.has(child.id)) {
					visited.add(child.id);
					descendants.push(child);
					queue.push(child.id);
				}
			}
		}

		return descendants;
	}

	/**
	 * Valida si un nodo puede ser reparentado a un nuevo padre.
	 * Comprueba:
	 * 1. Mismo nodo como padre.
	 * 2. Existencia del padre si no es nulo.
	 * 3. Padre debe ser un grupo.
	 * 4. Detección estricta de ciclos (el padre propuesto no puede ser descendiente del nodo).
	 */
	canReparent(nodeId: string, newParentId: string | null): { allowed: boolean; reason?: string } {
		if (newParentId === null) {
			return { allowed: true };
		}

		if (nodeId === newParentId) {
			return { allowed: false, reason: "Un nodo no puede ser su propio padre." };
		}

		const parentNode = this.nodes.get(newParentId);
		if (!parentNode) {
			return { allowed: false, reason: `El nodo padre '${newParentId}' no existe.` };
		}

		if (!parentNode.isGroup) {
			return { allowed: false, reason: `El nodo padre '${newParentId}' no es un grupo.` };
		}

		// Comprobar si newParentId es descendiente de nodeId (evitar ciclos)
		const descendants = this.getDescendants(nodeId);
		if (descendants.some((d) => d.id === newParentId)) {
			return { allowed: false, reason: "No se puede mover un nodo dentro de uno de sus propios descendientes (ciclo detectado)." };
		}

		return { allowed: true };
	}

	/**
	 * Reparenta un nodo a un nuevo padre con validación y ajuste de orden.
	 */
	reparent(nodeId: string, newParentId: string | null, targetOrder?: number): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) return false;

		const check = this.canReparent(nodeId, newParentId);
		if (!check.allowed) {
			console.warn(`Reparenting rechazado para ${nodeId} -> ${newParentId}: ${check.reason}`);
			return false;
		}

		const oldParentId = node.parentId;
		node.parentId = newParentId;

		const siblings = this.getChildren(newParentId).filter((c) => c.id !== nodeId);
		if (typeof targetOrder === "number" && targetOrder >= 0) {
			siblings.splice(targetOrder, 0, node);
		} else {
			siblings.push(node);
		}

		// Normalizar orden de hermanos
		siblings.forEach((s, idx) => {
			s.order = idx;
		});

		// Re-normalizar los hermanos antiguos
		if (oldParentId !== newParentId) {
			const oldSiblings = this.getChildren(oldParentId);
			oldSiblings.forEach((s, idx) => {
				s.order = idx;
			});
		}

		return true;
	}

	/**
	 * Reordena un nodo entre sus hermanos actuales.
	 */
	reorderChild(nodeId: string, targetOrder: number): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) return false;

		const siblings = this.getChildren(node.parentId).filter((s) => s.id !== nodeId);
		const clampedOrder = Math.max(0, Math.min(targetOrder, siblings.length));
		siblings.splice(clampedOrder, 0, node);

		siblings.forEach((s, idx) => {
			s.order = idx;
		});

		return true;
	}

	/**
	 * Crea un nuevo grupo lógico.
	 */
	createGroup(name: string, parentId: string | null = null, id?: string): HierarchyNode {
		const groupId = id || `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const siblings = this.getChildren(parentId);
		const order = siblings.length;

		const groupNode = new HierarchyNode({
			id: groupId,
			name,
			type: "group",
			parentId,
			order,
			isGroup: true,
			customName: name,
			pivot: {
				pos: { x: 0, y: 0, z: 0 },
				rot: { x: 0, y: 0, z: 0, w: 1 },
			},
		});

		this.nodes.set(groupId, groupNode);
		return groupNode;
	}

	/**
	 * Agrupa un conjunto de objetos bajo un nuevo grupo.
	 */
	groupObjects(objectIds: string[], groupName: string = "Nuevo Grupo", parentId: string | null = null): HierarchyNode {
		const validIds = objectIds.filter((id) => this.nodes.has(id));
		const group = this.createGroup(groupName, parentId);

		validIds.forEach((id, index) => {
			this.reparent(id, group.id, index);
		});

		return group;
	}

	/**
	 * Desagrupa un grupo: sube todos sus hijos directos al padre del grupo y elimina el grupo.
	 */
	ungroup(groupId: string): string[] {
		const groupNode = this.nodes.get(groupId);
		if (!groupNode || !groupNode.isGroup) return [];

		const targetParentId = groupNode.parentId;
		const children = this.getChildren(groupId);
		const movedIds: string[] = [];

		children.forEach((child) => {
			this.reparent(child.id, targetParentId);
			movedIds.push(child.id);
		});

		this.removeNode(groupId);
		return movedIds;
	}

	/**
	 * Elimina un nodo. Si removeDescendants es true, elimina recursivamente sus hijos;
	 * si es false, promueve los hijos a su padre.
	 */
	removeNode(id: string, removeDescendants: boolean = false): string[] {
		const node = this.nodes.get(id);
		if (!node) return [];

		const removedIds: string[] = [id];
		const children = this.getChildren(id);

		if (removeDescendants) {
			children.forEach((child) => {
				const subRemoved = this.removeNode(child.id, true);
				removedIds.push(...subRemoved);
			});
		} else {
			children.forEach((child) => {
				this.reparent(child.id, node.parentId);
			});
		}

		this.nodes.delete(id);

		// Normalizar hermanos del nodo eliminado
		const siblings = this.getChildren(node.parentId);
		siblings.forEach((s, idx) => {
			s.order = idx;
		});

		return removedIds;
	}

	/**
	 * Actualiza el pivote de un grupo o nodo.
	 */
	updatePivot(
		id: string,
		pos: { x: number; y: number; z: number },
		rot?: { x: number; y: number; z: number; w?: number }
	): boolean {
		const node = this.nodes.get(id);
		if (!node) return false;

		node.pivot = {
			pos: { ...pos },
			rot: rot ? { ...rot } : (node.pivot?.rot || { x: 0, y: 0, z: 0, w: 1 }),
		};

		return true;
	}

	/**
	 * Serialización para guardar en el mapa.
	 */
	serialize(): SerializedHierarchyNode[] {
		return Array.from(this.nodes.values()).map((n) => n.toJSON());
	}

	/**
	 * Deserializa la jerarquía desde el formato guardado del mapa.
	 * Soporta retrocompatibilidad: si no hay lista de jerarquía explícita,
	 * puede reconstruirse a partir de los `parentId` de los objetos.
	 */
	deserialize(data: SerializedHierarchyNode[] | null | undefined, existingObjectIds?: string[]): void {
		this.nodes.clear();

		if (Array.isArray(data)) {
			// Primera pasada: crear todos los nodos
			data.forEach((item) => {
				const node = new HierarchyNode(item);
				this.nodes.set(node.id, node);
			});

			// Segunda pasada: validar parentIds
			for (const node of this.nodes.values()) {
				if (node.parentId && !this.nodes.has(node.parentId)) {
					console.warn(`Padre huérfano '${node.parentId}' para nodo '${node.id}'. Reasignando a raíz.`);
					node.parentId = null;
				}
			}
		}

		// Reconciliación con objetos existentes si se proporcionan
		if (existingObjectIds && Array.isArray(existingObjectIds)) {
			existingObjectIds.forEach((uuid) => {
				if (!this.nodes.has(uuid)) {
					this.nodes.set(
						uuid,
						new HierarchyNode({
							id: uuid,
							name: "Objeto",
							type: "object",
							parentId: null,
							order: this.getChildren(null).length,
							isGroup: false,
						})
					);
				}
			});
		}
	}

	/**
	 * Limpia toda la jerarquía.
	 */
	clear(): void {
		this.nodes.clear();
	}
}

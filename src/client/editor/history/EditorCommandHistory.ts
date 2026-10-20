/**
 * EditorCommandHistory.ts
 * VIPER IO — Sistema de comandos y pila de Undo/Redo para el editor.
 */

export interface EditorCommand {
	name: string;
	execute(): void | Promise<void>;
	undo(): void | Promise<void>;
}

export class CompositeCommand implements EditorCommand {
	name: string;
	private commands: EditorCommand[];

	constructor(name: string, commands: EditorCommand[] = []) {
		this.name = name;
		this.commands = commands;
	}

	add(command: EditorCommand) {
		this.commands.push(command);
	}

	execute() {
		for (const cmd of this.commands) {
			cmd.execute();
		}
	}

	undo() {
		// Deshacer en orden inverso
		for (let i = this.commands.length - 1; i >= 0; i--) {
			this.commands[i].undo();
		}
	}
}

export class EditorCommandHistory {
	private undoStack: EditorCommand[] = [];
	private redoStack: EditorCommand[] = [];
	private maxHistory: number;

	constructor(maxHistory: number = 50) {
		this.maxHistory = maxHistory;
	}

	execute(command: EditorCommand) {
		command.execute();
		this.undoStack.push(command);
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
		this.redoStack = []; // Limpiar redo en nueva acción
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	undo(): boolean {
		const command = this.undoStack.pop();
		if (!command) return false;

		command.undo();
		this.redoStack.push(command);
		return true;
	}

	redo(): boolean {
		const command = this.redoStack.pop();
		if (!command) return false;

		command.execute();
		this.undoStack.push(command);
		return true;
	}

	clear() {
		this.undoStack = [];
		this.redoStack = [];
	}
}

export class ReparentCommand implements EditorCommand {
	name = "Reparent Node";

	constructor(
		private hierarchy: any,
		private nodeId: string,
		private oldParentId: string | null,
		private oldOrder: number,
		private newParentId: string | null,
		private newOrder?: number,
		private onAfterExecute?: () => void
	) {}

	execute() {
		this.hierarchy.reparent(this.nodeId, this.newParentId, this.newOrder);
		if (this.onAfterExecute) this.onAfterExecute();
	}

	undo() {
		this.hierarchy.reparent(this.nodeId, this.oldParentId, this.oldOrder);
		if (this.onAfterExecute) this.onAfterExecute();
	}
}

export class MoveObjectCommand implements EditorCommand {
	name = "Move Object";

	constructor(
		private object: any,
		private oldPosition: { x: number; y: number; z: number },
		private newPosition: { x: number; y: number; z: number },
		private onAfterExecute?: () => void
	) {}

	execute() {
		if (this.object) {
			this.object.position.set(this.newPosition.x, this.newPosition.y, this.newPosition.z);
			this.object.updateMatrixWorld(true);
			if (this.object.userData?.rigidBody && typeof this.object.userData.rigidBody.setTranslation === "function") {
				this.object.userData.rigidBody.setTranslation({ ...this.newPosition });
			}
		}
		if (this.onAfterExecute) this.onAfterExecute();
	}

	undo() {
		if (this.object) {
			this.object.position.set(this.oldPosition.x, this.oldPosition.y, this.oldPosition.z);
			this.object.updateMatrixWorld(true);
			if (this.object.userData?.rigidBody && typeof this.object.userData.rigidBody.setTranslation === "function") {
				this.object.userData.rigidBody.setTranslation({ ...this.oldPosition });
			}
		}
		if (this.onAfterExecute) this.onAfterExecute();
	}
}

export interface DuplicateCommandPayload {
	hierarchyNodes: any[];
	objectsData: any[];
	rootNodeIds: string[];
}

export class DuplicateCommand implements EditorCommand {
	name = "Duplicate Structure";

	constructor(
		private game: any,
		private hierarchy: any,
		private groupManager: any,
		private payload: DuplicateCommandPayload,
		private onAfterExecute?: (selectedNodeId?: string) => void
	) {}

	execute() {
		const createdUuids: string[] = [];
		try {
			// 1. Añadir nodos jerárquicos al modelo
			for (const nodeData of this.payload.hierarchyNodes) {
				this.hierarchy.addNode(nodeData);
				createdUuids.push(nodeData.id);
			}

			// 2. Instanciar objetos físicos reales mediante el flujo correspondiente de MapObjectItem
			for (const objData of this.payload.objectsData) {
				if (objData.type !== "group_pivot") {
					this.game._loadSingleMapObject(objData);
				}
			}

			// 3. Crear proxies de pivote para los nuevos grupos
			for (const nodeData of this.payload.hierarchyNodes) {
				if (nodeData.isGroup && this.groupManager) {
					const proxy = this.groupManager.getOrCreatePivotProxy(nodeData.id);
					if (nodeData.pivot?.pos) {
						proxy.position.set(nodeData.pivot.pos.x, nodeData.pivot.pos.y, nodeData.pivot.pos.z);
					}
				}
			}

			if (this.onAfterExecute) {
				this.onAfterExecute(this.payload.rootNodeIds[0]);
			}
		} catch (err) {
			// Rollback atómico: limpiar cualquier objeto o nodo creado si la duplicación falla
			for (const id of createdUuids) {
				try { this.game.deleteObjectByUuid(id); } catch (_) {}
				try { this.hierarchy.removeNode(id, false); } catch (_) {}
				try { this.groupManager.removeGroupProxy(id); } catch (_) {}
			}
			throw err;
		}
	}

	undo() {
		for (const objData of this.payload.objectsData) {
			try { this.game.deleteObjectByUuid(objData.uuid); } catch (_) {}
		}
		for (const nodeData of this.payload.hierarchyNodes) {
			try { this.hierarchy.removeNode(nodeData.id, false); } catch (_) {}
			if (nodeData.isGroup && this.groupManager) {
				try { this.groupManager.removeGroupProxy(nodeData.id); } catch (_) {}
			}
		}
		if (this.onAfterExecute) {
			this.onAfterExecute(undefined);
		}
	}
}

export class GroupNodesCommand implements EditorCommand {
	name = "Group Nodes";
	private createdGroupId: string | null = null;
	private originalParents: Map<string, { parentId: string | null; order: number }> = new Map();

	constructor(
		private hierarchy: any,
		private groupManager: any,
		private nodeIds: string[],
		private groupName: string,
		private parentId: string | null = null,
		private onAfterExecute?: (groupId?: string) => void,
		private objectResolver?: (uuid: string) => any
	) {}

	execute() {
		if (!this.createdGroupId) {
			const group = this.hierarchy.createGroup(this.groupName, this.parentId);
			this.createdGroupId = group.id;
			for (const id of this.nodeIds) {
				const n = this.hierarchy.getNode(id);
				if (n) {
					this.originalParents.set(id, { parentId: n.parentId, order: n.order });
					this.hierarchy.reparent(id, this.createdGroupId);
				}
			}
		} else {
			this.hierarchy.addNode({
				id: this.createdGroupId,
				name: this.groupName,
				customName: this.groupName,
				parentId: this.parentId,
				order: 0,
				isGroup: true,
				childrenIds: []
			});
			for (const id of this.nodeIds) {
				this.hierarchy.reparent(id, this.createdGroupId);
			}
		}

		if (this.groupManager) {
			this.groupManager.getOrCreatePivotProxy(this.createdGroupId);
			const resolver = this.objectResolver || this.groupManager.lastResolver || ((id: string) => this.groupManager.selectionManager?.resolveObject(id) || null);
			this.groupManager.recenterGroupPivot(this.createdGroupId, resolver);
		}

		if (this.onAfterExecute && this.createdGroupId) {
			this.onAfterExecute(this.createdGroupId);
		}
	}

	undo() {
		if (!this.createdGroupId) return;

		for (const id of this.nodeIds) {
			const orig = this.originalParents.get(id);
			if (orig) {
				this.hierarchy.reparent(id, orig.parentId, orig.order);
			} else {
				this.hierarchy.reparent(id, null);
			}
		}

		this.hierarchy.removeNode(this.createdGroupId, false);
		if (this.groupManager) {
			this.groupManager.removeGroupProxy(this.createdGroupId);
		}

		if (this.onAfterExecute) {
			this.onAfterExecute(undefined);
		}
	}
}

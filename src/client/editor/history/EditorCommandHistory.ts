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


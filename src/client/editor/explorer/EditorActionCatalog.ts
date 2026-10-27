export const EDITOR_DESKTOP_TOOL_ACTIONS = [
	{ id: "create-group", label: "Grupo", ariaLabel: "Crear grupo" },
	{ id: "create-subgroup", label: "+ Subgrupo", ariaLabel: "Crear subgrupo" },
	{ id: "group", label: "Agrupar", ariaLabel: "Agrupar selección" },
	{ id: "ungroup", label: "Desagrupar", ariaLabel: "Desagrupar selección" },
	{ id: "decouple", label: "Desacoplar", ariaLabel: "Desacoplar selección" },
	{ id: "coupling", label: "Acoples", ariaLabel: "Alternar modo de acoples" },
	{ id: "pivot", label: "Pivote", ariaLabel: "Alternar edición de pivote" },
	{ id: "duplicate", label: "Duplicar", ariaLabel: "Duplicar selección" },
	{ id: "save-prefab", label: "⭐ Prefab", ariaLabel: "Guardar selección como prefab" },
	{ id: "export", label: "📤 Exp", ariaLabel: "Exportar selección" },
	{ id: "import", label: "📥 Imp", ariaLabel: "Importar prefab" },
] as const;

export const EDITOR_MOBILE_TOOL_ACTIONS = [
	{ id: "undo", label: "Deshacer", ariaLabel: "Deshacer" },
	{ id: "redo", label: "Rehacer", ariaLabel: "Rehacer" },
	...EDITOR_DESKTOP_TOOL_ACTIONS.filter(({ id }) => id === "duplicate" || id === "group"),
	...EDITOR_DESKTOP_TOOL_ACTIONS.filter(({ id }) => id === "create-group" || id === "create-subgroup" || id === "ungroup" || id === "decouple" || id === "coupling" || id === "pivot"),
	{ id: "copy", label: "Copiar", ariaLabel: "Copiar selección" },
	{ id: "paste", label: "Pegar", ariaLabel: "Pegar" },
	...EDITOR_DESKTOP_TOOL_ACTIONS.filter(({ id }) => id === "save-prefab" || id === "export" || id === "import"),
] as const;

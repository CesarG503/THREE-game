/**
 * Experience Mode and Death/Respawn System Types
 */

export type DeathCause = "damage" | "fall" | "logic" | "vehicle" | "custom";

export type RespawnPolicy = "start" | "checkpoint" | "spectator" | "none";

export type SpectatorPerspective = "first_person" | "third_person" | "switchable";

export interface SpectatorConfig {
	enabled?: boolean;
	allowFollow?: boolean;
	perspective?: SpectatorPerspective;
	allowedRoleIds?: string[];
	quality?: "full" | "balanced" | "low";
}

export type DeathActionButtonType = "respawn" | "spectate" | "restart" | "lobby";

export interface DeathScreenActionButton {
	id: string;
	label: string;
	action: DeathActionButtonType;
	isPrimary?: boolean;
}

export type DeathScreenElementType =
	| "title"
	| "subtitle"
	| "panel"
	| "divider"
	| "image"
	| "respawn_countdown"
	| "remaining_lives"
	| "killer_info"
	| "stats"
	| "action_button";

export type DeathScreenAnchor =
	| "top-left"
	| "top-center"
	| "top-right"
	| "center-left"
	| "center"
	| "center-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export interface DeathScreenElementStyle {
	fontSize?: number;
	fontWeight?: "normal" | "600" | "bold" | "800";
	fontFamily?: string;
	color?: string;
	textAlign?: "left" | "center" | "right";
	textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
	letterSpacing?: string;
	backgroundColor?: string;
	borderColor?: string;
	borderWidth?: number;
	borderStyle?: "none" | "solid" | "dashed" | "dotted";
	borderRadius?: number;
	opacity?: number;
	backdropBlur?: number;
	padding?: number;
	boxShadow?: string;
	textShadow?: string;
}

export interface DeathScreenElementConditions {
	causes?: DeathCause[];
	roles?: string[];
	states?: Array<"respawn" | "last_life" | "game_over" | "spectator">;
	requireData?: Array<"killer" | "stats" | "countdown">;
	hideWhenMissingData?: boolean;
}

export interface DeathScreenElement {
	id: string;
	name: string;
	type: DeathScreenElementType;
	visible?: boolean;
	x: number; // 0 - 100 percentage
	y: number; // 0 - 100 percentage
	width: number; // 0 - 100 percentage
	height: number; // 0 - 100 percentage
	anchor?: DeathScreenAnchor;
	zIndex?: number;
	style?: DeathScreenElementStyle;
	content?: string;
	fallbackContent?: string;
	imageUrl?: string;
	icon?: string;
	action?: DeathActionButtonType;
	isPrimary?: boolean;
	conditions?: DeathScreenElementConditions;
	causeOverrides?: Record<string, { content?: string; color?: string; style?: DeathScreenElementStyle }>;
}

export interface DeathScreenTransitions {
	duration?: number;
	fadeIn?: boolean;
	blur?: number;
	slowMotion?: boolean;
	freezeDuration?: number;
}

export interface DeathScreenAccessibility {
	reduceMotion?: boolean;
	highContrast?: boolean;
	ariaLive?: "polite" | "assertive";
}

export interface DeathScreenConfig {
	version?: number;
	enabled: boolean;
	title: string;
	message: string;
	backgroundColor: string;
	accentColor: string;
	backgroundImage?: string;
	screenBlur?: number;
	buttons: DeathScreenActionButton[];
	transitions?: DeathScreenTransitions;
	accessibility?: DeathScreenAccessibility;
	elements?: DeathScreenElement[];
}

export interface ExperienceModeProfile {
	id: string;
	name: string;
	description?: string;
	enabledCauses: {
		damage: boolean;
		fall: boolean;
		logic: boolean;
	};
	respawnPolicy: RespawnPolicy;
	respawnDelay?: number | null; // in seconds (null/undefined = inherit from player profile)
	respawns?: number | null; // null/undefined = inherit from player profile (-1 for infinite, 0 for permadeath, N for extra lives)
	explodeOnDeath?: boolean | null; // null/undefined = inherit from player profile (true/false = explicit override)
	/** Optional per-role route to another death profile in the same experience. */
	roleModeAssignments?: Record<string, string>;
	spectator?: SpectatorConfig;
	deathScreen: DeathScreenConfig;
}

export interface ExperienceModesData {
	modes: ExperienceModeProfile[];
	activeModeId: string;
}

export interface DeathContext {
	cause: DeathCause;
	details?: string;
	killerName?: string;
	killerWeapon?: string;
	position?: { x: number; y: number; z: number };
	checkpoint?: { x: number; y: number; z: number };
}

export interface DeathState {
	cause: DeathCause;
	willRespawn: boolean;
	respawnDelay: number;
	remainingRespawns: number;
	activeMode: ExperienceModeProfile;
	context?: DeathContext;
}

/**
 * Safely sanitizes image URLs, ensuring only safe web protocols or relative assets are used.
 */
export function sanitizeImageUrl(url: any): string | undefined {
	if (typeof url !== "string") return undefined;
	const trimmed = url.trim();
	if (!trimmed) return undefined;
	if (
		/^https?:\/\//i.test(trimmed) ||
		/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed) ||
		/^\/?assets\//i.test(trimmed) ||
		/^\//.test(trimmed) ||
		/^\.\//.test(trimmed)
	) {
		return trimmed;
	}
	return undefined;
}

/**
 * Creates default visual death screen elements for specified starter templates.
 */
export function createDefaultDeathScreenElements(
	templateType: "classic" | "tactical" | "racing" | "minimal" = "classic",
	accentColor = "#ff3b47",
	backgroundColor = "rgba(13, 15, 23, 0.94)",
	titleText = "HAS MUERTO",
	messageText = "Volviendo al punto de inicio..."
): DeathScreenElement[] {
	if (templateType === "tactical") {
		return [
			{
				id: "elem_panel_bg",
				name: "Tarjeta Táctica",
				type: "panel",
				visible: true,
				x: 50,
				y: 50,
				width: 60,
				height: 72,
				anchor: "center",
				zIndex: 1,
				style: {
					backgroundColor: "rgba(18, 12, 18, 0.95)",
					borderColor: accentColor,
					borderWidth: 2,
					borderStyle: "solid",
					borderRadius: 14,
					backdropBlur: 16,
					boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 30px ${accentColor}33`,
				},
			},
			{
				id: "elem_title",
				name: "Encabezado de Alerta",
				type: "title",
				visible: true,
				x: 50,
				y: 24,
				width: 52,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: titleText || "ELIMINADO DE LA PARTIDA",
				style: {
					fontSize: 26,
					fontWeight: "800",
					color: accentColor,
					textAlign: "center",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
					textShadow: `0 0 16px ${accentColor}66`,
				},
			},
			{
				id: "elem_divider",
				name: "Línea Separadora",
				type: "divider",
				visible: true,
				x: 50,
				y: 30,
				width: 44,
				height: 1,
				anchor: "center",
				zIndex: 2,
				style: {
					backgroundColor: `${accentColor}88`,
				},
			},
			{
				id: "elem_killer_info",
				name: "Ficha del Atacante",
				type: "killer_info",
				visible: true,
				x: 50,
				y: 40,
				width: 48,
				height: 14,
				anchor: "center",
				zIndex: 2,
				content: "Eliminado por: {killer_name}  ·  Arma: {killer_weapon}",
				fallbackContent: "Eliminado por fuerzas del entorno",
				conditions: {
					requireData: ["killer"],
				},
				style: {
					fontSize: 14,
					fontWeight: "600",
					color: "#ffffff",
					textAlign: "center",
					backgroundColor: "rgba(255, 255, 255, 0.06)",
					borderRadius: 8,
					padding: 10,
				},
			},
			{
				id: "elem_stats",
				name: "Detalles y Causa",
				type: "stats",
				visible: true,
				x: 50,
				y: 52,
				width: 48,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: "Causa: {cause}",
				style: {
					fontSize: 13,
					fontWeight: "normal",
					color: "rgba(255, 255, 255, 0.75)",
					textAlign: "center",
				},
			},
			{
				id: "elem_remaining_lives",
				name: "Vidas Restantes",
				type: "remaining_lives",
				visible: true,
				x: 50,
				y: 60,
				width: 48,
				height: 7,
				anchor: "center",
				zIndex: 2,
				content: "Vidas restantes: {remaining_lives}",
				fallbackContent: "Vidas: 0",
				style: {
					fontSize: 13,
					fontWeight: "600",
					color: "#ff6b6b",
					textAlign: "center",
				},
			},
			{
				id: "elem_btn_spectate",
				name: "Botón Observar",
				type: "action_button",
				visible: true,
				x: 40,
				y: 72,
				width: 22,
				height: 8,
				anchor: "center",
				zIndex: 3,
				content: "Observar",
				action: "spectate",
				isPrimary: true,
				style: {
					backgroundColor: accentColor,
					color: "#ffffff",
					fontSize: 14,
					fontWeight: "bold",
					borderRadius: 8,
				},
			},
			{
				id: "elem_btn_lobby",
				name: "Botón Salir",
				type: "action_button",
				visible: true,
				x: 60,
				y: 72,
				width: 16,
				height: 8,
				anchor: "center",
				zIndex: 3,
				content: "Salir",
				action: "lobby",
				isPrimary: false,
				style: {
					backgroundColor: "rgba(255, 255, 255, 0.12)",
					color: "#dddddd",
					fontSize: 14,
					fontWeight: "600",
					borderRadius: 8,
				},
			},
		];
	}

	if (templateType === "racing") {
		return [
			{
				id: "elem_panel_banner",
				name: "Franja de Carrera",
				type: "panel",
				visible: true,
				x: 50,
				y: 28,
				width: 70,
				height: 18,
				anchor: "center",
				zIndex: 1,
				style: {
					backgroundColor: "rgba(10, 24, 38, 0.95)",
					borderColor: accentColor,
					borderWidth: 2,
					borderStyle: "solid",
					borderRadius: 12,
					boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 30px ${accentColor}44`,
				},
			},
			{
				id: "elem_title",
				name: "Título de Pista",
				type: "title",
				visible: true,
				x: 50,
				y: 28,
				width: 60,
				height: 10,
				anchor: "center",
				zIndex: 2,
				content: titleText || "FUERA DE PISTA",
				style: {
					fontSize: 32,
					fontWeight: "800",
					color: accentColor,
					textAlign: "center",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
					textShadow: `0 0 20px ${accentColor}80`,
				},
			},
			{
				id: "elem_subtitle",
				name: "Mensaje de Reintento",
				type: "subtitle",
				visible: true,
				x: 50,
				y: 46,
				width: 64,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: messageText || "Regresando al último punto de control...",
				style: {
					fontSize: 15,
					fontWeight: "600",
					color: "#ffffff",
					textAlign: "center",
				},
			},
			{
				id: "elem_countdown",
				name: "Cuenta Regresiva",
				type: "respawn_countdown",
				visible: true,
				x: 50,
				y: 56,
				width: 50,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: "Reapareciendo en {countdown} s",
				fallbackContent: "Reanudando...",
				style: {
					fontSize: 18,
					fontWeight: "bold",
					color: accentColor,
					textAlign: "center",
				},
			},
			{
				id: "elem_btn_retry",
				name: "Botón Reintentar",
				type: "action_button",
				visible: true,
				x: 50,
				y: 68,
				width: 28,
				height: 9,
				anchor: "center",
				zIndex: 3,
				content: "Reintentar Ya",
				action: "respawn",
				isPrimary: true,
				style: {
					backgroundColor: accentColor,
					color: "#0a1826",
					fontSize: 15,
					fontWeight: "800",
					borderRadius: 10,
				},
			},
		];
	}

	if (templateType === "minimal") {
		return [
			{
				id: "elem_title",
				name: "Título Minimalista",
				type: "title",
				visible: true,
				x: 50,
				y: 36,
				width: 70,
				height: 12,
				anchor: "center",
				zIndex: 2,
				content: titleText || "ELIMINADO",
				style: {
					fontSize: 42,
					fontWeight: "800",
					color: "#ffffff",
					textAlign: "center",
					letterSpacing: "0.12em",
					textTransform: "uppercase",
				},
			},
			{
				id: "elem_subtitle",
				name: "Subtítulo Minimalista",
				type: "subtitle",
				visible: true,
				x: 50,
				y: 47,
				width: 60,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: messageText || "Has caído en combate.",
				style: {
					fontSize: 15,
					fontWeight: "normal",
					color: "rgba(255, 255, 255, 0.7)",
					textAlign: "center",
				},
			},
			{
				id: "elem_remaining_lives",
				name: "Vidas Restantes",
				type: "remaining_lives",
				visible: true,
				x: 50,
				y: 55,
				width: 40,
				height: 7,
				anchor: "center",
				zIndex: 2,
				content: "{remaining_lives} vidas restantes",
				fallbackContent: "Vidas infinitas",
				style: {
					fontSize: 13,
					fontWeight: "600",
					color: "#ffd166",
					textAlign: "center",
				},
			},
			{
				id: "elem_btn_continue",
				name: "Botón Continuar",
				type: "action_button",
				visible: true,
				x: 50,
				y: 66,
				width: 24,
				height: 8,
				anchor: "center",
				zIndex: 3,
				content: "Continuar",
				action: "respawn",
				isPrimary: true,
				style: {
					backgroundColor: "rgba(255, 255, 255, 0.15)",
					borderColor: "rgba(255, 255, 255, 0.4)",
					borderWidth: 1,
					borderStyle: "solid",
					color: "#ffffff",
					fontSize: 14,
					fontWeight: "bold",
					borderRadius: 20,
				},
			},
		];
	}

	// Classic Template (Default)
	return [
		{
			id: "elem_panel_card",
			name: "Tarjeta Central",
			type: "panel",
			visible: true,
			x: 50,
			y: 50,
			width: 54,
			height: 64,
			anchor: "center",
			zIndex: 1,
			style: {
				backgroundColor: backgroundColor || "rgba(13, 15, 23, 0.94)",
				borderColor: `${accentColor}55`,
				borderWidth: 1,
				borderStyle: "solid",
				borderRadius: 18,
				backdropBlur: 16,
				boxShadow: `0 24px 80px rgba(0, 0, 0, 0.65), 0 0 40px ${accentColor}25`,
			},
		},
		{
			id: "elem_title",
			name: "Título Principal",
			type: "title",
			visible: true,
			x: 50,
			y: 31,
			width: 48,
			height: 9,
			anchor: "center",
			zIndex: 2,
			content: titleText || "HAS MUERTO",
			style: {
				fontSize: 32,
				fontWeight: "800",
				color: "#ffffff",
				textAlign: "center",
				textTransform: "uppercase",
				letterSpacing: "0.08em",
				textShadow: `0 0 20px ${accentColor}80`,
			},
		},
		{
			id: "elem_divider",
			name: "Línea Separadora",
			type: "divider",
			visible: true,
			x: 50,
			y: 37,
			width: 36,
			height: 1,
			anchor: "center",
			zIndex: 2,
			style: {
				backgroundColor: `${accentColor}66`,
			},
		},
		{
			id: "elem_subtitle",
			name: "Mensaje / Subtítulo",
			type: "subtitle",
			visible: true,
			x: 50,
			y: 43,
			width: 44,
			height: 8,
			anchor: "center",
			zIndex: 2,
			content: messageText || "Has sido eliminado de la partida.",
			style: {
				fontSize: 14,
				fontWeight: "normal",
				color: "rgba(255, 255, 255, 0.85)",
				textAlign: "center",
			},
		},
		{
			id: "elem_remaining_lives",
			name: "Vidas Restantes",
			type: "remaining_lives",
			visible: true,
			x: 50,
			y: 51,
			width: 44,
			height: 6,
			anchor: "center",
			zIndex: 2,
			content: "Vidas restantes: {remaining_lives}",
			fallbackContent: "Vidas: Infinitas",
			style: {
				fontSize: 13,
				fontWeight: "600",
				color: "rgba(255, 255, 255, 0.65)",
				textAlign: "center",
			},
		},
		{
			id: "elem_countdown",
			name: "Cuenta Regresiva",
			type: "respawn_countdown",
			visible: true,
			x: 50,
			y: 58,
			width: 44,
			height: 7,
			anchor: "center",
			zIndex: 2,
			content: "Reapareciendo en {countdown} s…",
			fallbackContent: "Reaparición disponible",
			conditions: {
				states: ["respawn"],
			},
			style: {
				fontSize: 14,
				fontWeight: "bold",
				color: accentColor,
				textAlign: "center",
			},
		},
		{
			id: "elem_btn_respawn",
			name: "Botón Reaparecer",
			type: "action_button",
			visible: true,
			x: 43,
			y: 69,
			width: 20,
			height: 8,
			anchor: "center",
			zIndex: 3,
			content: "Reaparecer",
			action: "respawn",
			isPrimary: true,
			style: {
				backgroundColor: accentColor,
				color: "#ffffff",
				fontSize: 14,
				fontWeight: "bold",
				borderRadius: 10,
			},
		},
		{
			id: "elem_btn_lobby",
			name: "Botón Lobby",
			type: "action_button",
			visible: true,
			x: 57,
			y: 69,
			width: 14,
			height: 8,
			anchor: "center",
			zIndex: 3,
			content: "Volver",
			action: "lobby",
			isPrimary: false,
			style: {
				backgroundColor: "rgba(255, 255, 255, 0.1)",
				borderColor: "rgba(255, 255, 255, 0.25)",
				borderWidth: 1,
				borderStyle: "solid",
				color: "#e5e5e5",
				fontSize: 14,
				fontWeight: "600",
				borderRadius: 10,
			},
		},
	];
}

/**
 * Validates and clamps visual elements into normalized ranges (0-100%).
 */
export function normalizeDeathScreenElements(rawElements: any[]): DeathScreenElement[] {
	if (!Array.isArray(rawElements)) return [];
	const allowedTypes: DeathScreenElementType[] = [
		"title",
		"subtitle",
		"panel",
		"divider",
		"image",
		"respawn_countdown",
		"remaining_lives",
		"killer_info",
		"stats",
		"action_button",
	];

	return rawElements
		.filter((e) => e && typeof e === "object" && allowedTypes.includes(e.type))
		.map((e, idx) => {
			const id = typeof e.id === "string" && e.id ? e.id : `elem_${Date.now()}_${idx}`;
			const name = typeof e.name === "string" ? e.name : `Elemento ${idx + 1}`;
			const x = typeof e.x === "number" ? Math.max(0, Math.min(100, e.x)) : 50;
			const y = typeof e.y === "number" ? Math.max(0, Math.min(100, e.y)) : 50;
			const width = typeof e.width === "number" ? Math.max(1, Math.min(100, e.width)) : 40;
			const height = typeof e.height === "number" ? Math.max(1, Math.min(100, e.height)) : 10;
			const anchor: DeathScreenAnchor = [
				"top-left", "top-center", "top-right",
				"center-left", "center", "center-right",
				"bottom-left", "bottom-center", "bottom-right",
			].includes(e.anchor) ? e.anchor : "center";

			const action: DeathActionButtonType = ["respawn", "spectate", "restart", "lobby"].includes(e.action)
				? e.action
				: "respawn";

			return {
				id,
				name,
				type: e.type,
				visible: e.visible !== false,
				x,
				y,
				width,
				height,
				anchor,
				zIndex: typeof e.zIndex === "number" ? e.zIndex : idx + 1,
				style: e.style && typeof e.style === "object" ? { ...e.style } : {},
				content: typeof e.content === "string" ? e.content : "",
				fallbackContent: typeof e.fallbackContent === "string" ? e.fallbackContent : undefined,
				imageUrl: sanitizeImageUrl(e.imageUrl),
				icon: typeof e.icon === "string" ? e.icon : undefined,
				action,
				isPrimary: Boolean(e.isPrimary),
				conditions: e.conditions && typeof e.conditions === "object" ? { ...e.conditions } : undefined,
				causeOverrides: e.causeOverrides && typeof e.causeOverrides === "object" ? { ...e.causeOverrides } : undefined,
			};
		});
}

/**
 * Migrates a legacy (v1) death screen configuration into the modern visual layout (v2).
 */
export function migrateDeathScreenConfig(rawScreen: any, mode?: Partial<ExperienceModeProfile>): DeathScreenConfig {
	const defaultTemplate = mode?.id === "mode_racing"
		? "racing"
		: mode?.id === "mode_elimination"
			? "tactical"
			: "classic";

	const title = typeof rawScreen?.title === "string" && rawScreen.title.trim() ? rawScreen.title.trim() : "HAS MUERTO";
	const message = typeof rawScreen?.message === "string" ? rawScreen.message : "Has sido eliminado de la partida.";
	const accentColor = typeof rawScreen?.accentColor === "string" ? rawScreen.accentColor : "#ff3b47";
	const backgroundColor = typeof rawScreen?.backgroundColor === "string" ? rawScreen.backgroundColor : "rgba(13, 15, 23, 0.92)";
	const screenBlur = typeof rawScreen?.screenBlur === "number" ? Math.max(0, rawScreen.screenBlur) : 12;
	const backgroundImage = sanitizeImageUrl(rawScreen?.backgroundImage);

	const buttons: DeathScreenActionButton[] = Array.isArray(rawScreen?.buttons) && rawScreen.buttons.length > 0
		? rawScreen.buttons.map((b: any, idx: number) => ({
				id: typeof b.id === "string" ? b.id : `btn_${idx}`,
				label: typeof b.label === "string" ? b.label : "Aceptar",
				action: (["respawn", "spectate", "restart", "lobby"].includes(b.action) ? b.action : "respawn") as DeathActionButtonType,
				isPrimary: Boolean(b.isPrimary),
			}))
		: [
				{ id: "btn_respawn", label: "Reaparecer", action: "respawn", isPrimary: true },
			];

	let elements: DeathScreenElement[] = [];
	if (Array.isArray(rawScreen?.elements) && rawScreen.elements.length > 0) {
		elements = normalizeDeathScreenElements(rawScreen.elements);
	} else {
		// Generate equivalent starter elements from legacy attributes
		elements = createDefaultDeathScreenElements(defaultTemplate, accentColor, backgroundColor, title, message);

		// Synchronize action buttons from legacy buttons array
		const existingButtonElems = elements.filter((e) => e.type === "action_button");
		if (buttons.length > 0) {
			buttons.forEach((btn, bIdx) => {
				if (existingButtonElems[bIdx]) {
					existingButtonElems[bIdx].content = btn.label;
					existingButtonElems[bIdx].action = btn.action;
					existingButtonElems[bIdx].isPrimary = btn.isPrimary;
				}
			});
		}
	}

	return {
		version: 2,
		enabled: rawScreen?.enabled !== false,
		title,
		message,
		backgroundColor,
		accentColor,
		backgroundImage,
		screenBlur,
		buttons,
		transitions: {
			duration: typeof rawScreen?.transitions?.duration === "number" ? rawScreen.transitions.duration : 0.25,
			fadeIn: rawScreen?.transitions?.fadeIn !== false,
			blur: typeof rawScreen?.transitions?.blur === "number" ? rawScreen.transitions.blur : screenBlur,
			slowMotion: Boolean(rawScreen?.transitions?.slowMotion),
			freezeDuration: typeof rawScreen?.transitions?.freezeDuration === "number" ? rawScreen.transitions.freezeDuration : 0,
		},
		accessibility: {
			reduceMotion: Boolean(rawScreen?.accessibility?.reduceMotion),
			highContrast: Boolean(rawScreen?.accessibility?.highContrast),
			ariaLive: rawScreen?.accessibility?.ariaLive === "assertive" ? "assertive" : "polite",
		},
		elements,
	};
}

/**
 * Evaluates dynamic tokens in templates such as {killer_name}, {cause}, {remaining_lives}, {countdown}.
 */
export function evaluateDynamicTokens(template: string, state?: DeathState | any, fallback = ""): string {
	if (!template || typeof template !== "string") return fallback;
	const causeLabels: Record<string, string> = {
		damage: "Daño de combate",
		fall: "Caída al vacío",
		logic: "Trampa / Lógica",
		vehicle: "Impacto de vehículo",
		custom: "Causa personalizada",
	};

	let text = template;
	const cause = state?.cause || "damage";
	const causeLabel = causeLabels[cause] || cause;
	const killerName = state?.context?.killerName || fallback || "Desconocido";
	const killerWeapon = state?.context?.killerWeapon || "Arma";
	const details = state?.context?.details || "";
	const remainingLives = state?.remainingRespawns === -1
		? "Infinitas"
		: (state?.remainingRespawns !== undefined && state?.remainingRespawns !== null
			? String(state.remainingRespawns)
			: "0");
	const countdown = typeof state?.respawnDelay === "number" ? state.respawnDelay.toFixed(1) : "0.0";
	const title = state?.activeMode?.deathScreen?.title || "HAS MUERTO";
	const message = state?.activeMode?.deathScreen?.message || "Has sido eliminado de la partida.";
	const accentColor = state?.activeMode?.deathScreen?.accentColor || "#ff3b47";

	text = text.replace(/\{killer_name\}/g, killerName);
	text = text.replace(/\{killer_weapon\}/g, killerWeapon);
	text = text.replace(/\{cause\}/g, causeLabel);
	text = text.replace(/\{details\}/g, details);
	text = text.replace(/\{remaining_lives\}/g, remainingLives);
	text = text.replace(/\{countdown\}/g, countdown);
	text = text.replace(/\{title\}/g, title);
	text = text.replace(/\{message\}/g, message);
	text = text.replace(/\{accentColor\}/g, accentColor);

	return text;
}

/**
 * Creates default experience modes presets for maps that don't have custom profiles.
 */
export function createDefaultExperienceModes(): ExperienceModesData {
	const survivalMode: ExperienceModeProfile = {
		id: "mode_survival",
		name: "Supervivencia Clásica",
		description: "Modo estándar que utiliza los ajustes de vidas y demora heredados del perfil.",
		enabledCauses: {
			damage: true,
			fall: true,
			logic: true,
		},
		respawnPolicy: "start",
		respawnDelay: undefined, // Inherits from player profile
		respawns: undefined, // Inherits from player profile
		explodeOnDeath: undefined, // Inherits from player profile
		deathScreen: migrateDeathScreenConfig({
			enabled: true,
			title: "HAS MUERTO",
			message: "Volviendo al punto de inicio...",
			backgroundColor: "rgba(13, 15, 23, 0.92)",
			accentColor: "#ff3b47",
			screenBlur: 12,
			buttons: [
				{ id: "btn_respawn", label: "Reaparecer", action: "respawn", isPrimary: true },
			],
		}, { id: "mode_survival" }),
	};

	const racingMode: ExperienceModeProfile = {
		id: "mode_racing",
		name: "Carreras / Parkour",
		description: "Reaparición rápida en el último marcador o checkpoint al caer.",
		enabledCauses: {
			damage: false,
			fall: true,
			logic: true,
		},
		respawnPolicy: "checkpoint",
		respawnDelay: 0.8,
		respawns: -1,
		explodeOnDeath: false,
		deathScreen: migrateDeathScreenConfig({
			enabled: true,
			title: "FUERA DE PISTA",
			message: "Regresando al último punto de control...",
			backgroundColor: "rgba(16, 24, 38, 0.90)",
			accentColor: "#00d2ff",
			screenBlur: 8,
			buttons: [
				{ id: "btn_retry", label: "Reintentar", action: "respawn", isPrimary: true },
			],
		}, { id: "mode_racing" }),
	};

	const eliminationMode: ExperienceModeProfile = {
		id: "mode_elimination",
		name: "Muerte Permanente / Eliminación",
		description: "Sin vidas extras. Al morir entras en modo espectador.",
		enabledCauses: {
			damage: true,
			fall: true,
			logic: true,
		},
		respawnPolicy: "spectator",
		respawnDelay: 0,
		respawns: 0,
		explodeOnDeath: true,
		spectator: {
			enabled: true,
			allowFollow: true,
			perspective: "third_person",
			allowedRoleIds: [],
			quality: "balanced",
		},
		deathScreen: migrateDeathScreenConfig({
			enabled: true,
			title: "ELIMINADO",
			message: "Te has quedado sin vidas. Observa la partida.",
			backgroundColor: "rgba(25, 10, 15, 0.95)",
			accentColor: "#e63946",
			screenBlur: 16,
			buttons: [
				{ id: "btn_spectate", label: "Observar", action: "spectate", isPrimary: true },
				{ id: "btn_lobby", label: "Volver", action: "lobby", isPrimary: false },
			],
		}, { id: "mode_elimination" }),
	};

	return {
		modes: [survivalMode, racingMode, eliminationMode],
		activeModeId: "mode_survival",
	};
}

/**
 * Ensures backward compatibility and schema validity of experienceModes within gameConfig.
 */
export function normalizeExperienceModesConfig(rawConfig: any): ExperienceModesData {
	const defaults = createDefaultExperienceModes();

	if (!rawConfig || typeof rawConfig !== "object") {
		return defaults;
	}

	const rawModes = Array.isArray(rawConfig.experienceModes)
		? rawConfig.experienceModes
		: Array.isArray(rawConfig.modes)
			? rawConfig.modes
			: null;

	if (!rawModes || rawModes.length === 0) {
		return defaults;
	}

	const modes: ExperienceModeProfile[] = rawModes.map((m: any, idx: number) => {
		const id = typeof m.id === "string" && m.id.trim() ? m.id.trim() : `mode_${Date.now()}_${idx}`;
		const name = typeof m.name === "string" && m.name.trim() ? m.name.trim() : `Modo ${idx + 1}`;
		const enabledCauses = {
			damage: m.enabledCauses?.damage !== false,
			fall: m.enabledCauses?.fall !== false,
			logic: m.enabledCauses?.logic !== false,
		};
		const respawnPolicy: RespawnPolicy = ["start", "checkpoint", "spectator", "none"].includes(m.respawnPolicy)
			? m.respawnPolicy
			: "start";

		// Keep null/undefined if not specified so player profile can provide inherited stats
		const respawnDelay = typeof m.respawnDelay === "number" && !isNaN(m.respawnDelay)
			? Math.max(0, m.respawnDelay)
			: (m.respawnDelay === null ? null : undefined);

		const respawns = typeof m.respawns === "number" && !isNaN(m.respawns)
			? m.respawns
			: (m.respawns === null ? null : undefined);

		const explodeOnDeath = typeof m.explodeOnDeath === "boolean"
			? m.explodeOnDeath
			: (m.explodeOnDeath === null ? null : undefined);

		const deathScreen = migrateDeathScreenConfig(m.deathScreen, { id });

		return {
			id,
			name,
			description: typeof m.description === "string" ? m.description : "",
			enabledCauses,
			respawnPolicy,
			respawnDelay,
			respawns,
			explodeOnDeath,
			roleModeAssignments: m.roleModeAssignments && typeof m.roleModeAssignments === "object" ? { ...m.roleModeAssignments } : {},
			spectator: {
				enabled: m.spectator?.enabled !== false,
				allowFollow: m.spectator?.allowFollow !== false,
				perspective: (["first_person", "third_person", "switchable"].includes(m.spectator?.perspective)
					? m.spectator.perspective
					: "third_person") as SpectatorPerspective,
				allowedRoleIds: Array.isArray(m.spectator?.allowedRoleIds) ? m.spectator.allowedRoleIds.filter((id: any) => typeof id === "string") : [],
				quality: (["full", "balanced", "low"].includes(m.spectator?.quality) ? m.spectator.quality : "balanced") as "full" | "balanced" | "low",
			},
			deathScreen,
		};
	});

	let activeModeId = typeof rawConfig.activeExperienceModeId === "string"
		? rawConfig.activeExperienceModeId
		: typeof rawConfig.activeModeId === "string"
			? rawConfig.activeModeId
			: modes[0].id;

	if (!modes.some((m) => m.id === activeModeId)) {
		activeModeId = modes[0].id;
	}

	return {
		modes,
		activeModeId,
	};
}

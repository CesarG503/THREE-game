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

export interface DeathScreenConfig {
	enabled: boolean;
	title: string;
	message: string;
	backgroundColor: string;
	accentColor: string;
	backgroundImage?: string;
	screenBlur?: number;
	buttons: DeathScreenActionButton[];
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
		deathScreen: {
			enabled: true,
			title: "HAS MUERTO",
			message: "Volviendo al punto de inicio...",
			backgroundColor: "rgba(13, 15, 23, 0.92)",
			accentColor: "#ff3b47",
			screenBlur: 12,
			buttons: [
				{ id: "btn_respawn", label: "Reaparecer", action: "respawn", isPrimary: true },
			],
		},
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
		deathScreen: {
			enabled: true,
			title: "FUERA DE PISTA",
			message: "Regresando al último punto de control...",
			backgroundColor: "rgba(16, 24, 38, 0.90)",
			accentColor: "#00d2ff",
			screenBlur: 8,
			buttons: [
				{ id: "btn_retry", label: "Reintentar", action: "respawn", isPrimary: true },
			],
		},
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
		deathScreen: {
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
		},
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
		const defaultFallback = defaults.modes[0];
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

		const rawScreen = m.deathScreen || {};
		const deathScreen: DeathScreenConfig = {
			enabled: rawScreen.enabled !== false,
			title: typeof rawScreen.title === "string" ? rawScreen.title : defaultFallback.deathScreen.title,
			message: typeof rawScreen.message === "string" ? rawScreen.message : defaultFallback.deathScreen.message,
			backgroundColor: typeof rawScreen.backgroundColor === "string" ? rawScreen.backgroundColor : defaultFallback.deathScreen.backgroundColor,
			accentColor: typeof rawScreen.accentColor === "string" ? rawScreen.accentColor : defaultFallback.deathScreen.accentColor,
			backgroundImage: typeof rawScreen.backgroundImage === "string" ? rawScreen.backgroundImage : undefined,
			screenBlur: typeof rawScreen.screenBlur === "number" ? Math.max(0, rawScreen.screenBlur) : 12,
			buttons: Array.isArray(rawScreen.buttons) && rawScreen.buttons.length > 0
				? rawScreen.buttons.map((b: any, bIdx: number) => ({
						id: typeof b.id === "string" ? b.id : `btn_${bIdx}`,
						label: typeof b.label === "string" ? b.label : "Aceptar",
						action: (["respawn", "spectate", "restart", "lobby"].includes(b.action) ? b.action : "respawn") as DeathActionButtonType,
						isPrimary: Boolean(b.isPrimary),
					}))
				: [...defaultFallback.deathScreen.buttons],
		};

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

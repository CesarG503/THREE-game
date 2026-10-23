/**
 * Experience Mode and Death/Respawn System Types
 */

export type DeathCause = "damage" | "fall" | "logic" | "vehicle" | "custom";

export type RespawnPolicy = "start" | "checkpoint" | "spectator" | "none";

export type SpectatorPerspective = "first_person" | "third_person" | "switchable";

export interface SpectatorTransitionConfig {
	enabled?: boolean;
	duration?: number; // ms
	style?: "smooth" | "cinematic" | "instant";
}

export interface SpectatorConfig {
	enabled?: boolean;
	allowFollow?: boolean;
	perspective?: SpectatorPerspective;
	allowedRoleIds?: string[];
	quality?: "full" | "balanced" | "low";
	transition?: SpectatorTransitionConfig;
}

export type RespawnProtectionType = "invulnerability" | "shield" | "damage_reduction";

export type RespawnDelayBehavior = "auto" | "button";

/** Temporary protection granted after the player has respawned. */
export interface RespawnProtectionConfig {
	enabled?: boolean;
	duration?: number; // seconds
	type?: RespawnProtectionType;
	shieldPoints?: number;
	damageMultiplier?: number; // fraction of incoming damage that reaches health
	showVisual?: boolean;
	cancelOnAttack?: boolean;
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

export type DeathScreenAnimationType =
	| "none"
	| "fade"
	| "slide_up"
	| "slide_down"
	| "slide_left"
	| "slide_right"
	| "scale_up"
	| "blur_in";

export type DeathScreenEasing =
	| "linear"
	| "easeInQuad"
	| "easeOutQuad"
	| "easeInOutQuad"
	| "easeOutCubic"
	| "easeOutBack"
	| "easeOutElastic";

export interface DeathScreenElementAnimation {
	type?: DeathScreenAnimationType;
	duration?: number; // ms
	delay?: number; // ms
	easing?: DeathScreenEasing;
}

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
	animation?: DeathScreenElementAnimation;
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

export type DeathScreenBackgroundType = "color" | "gradient" | "image" | "animated";

export type DeathScreenBgAnimationType = "none" | "ken_burns" | "pulse_glow" | "scanlines" | "pan";

export interface DeathScreenBgAnimationConfig {
	enabled?: boolean;
	type?: DeathScreenBgAnimationType;
	duration?: number; // ms
	speed?: number; // multiplier
	intensity?: number; // 0 - 1
}

export interface DeathScreenBackgroundConfig {
	type?: DeathScreenBackgroundType;
	color?: string;
	gradient?: string;
	imageUrl?: string;
	imageFit?: "cover" | "contain" | "fill";
	imagePosition?: string;
	overlayColor?: string;
	overlayOpacity?: number; // 0 - 1
	animation?: DeathScreenBgAnimationConfig;
}

/** Cinematic vignette used by the default in-world death-screen composition. */
export const DEFAULT_DEATH_SCREEN_VIGNETTE =
	"linear-gradient(90deg, rgba(5, 7, 11, 0.94) 0%, rgba(5, 7, 11, 0.76) 26%, rgba(5, 7, 11, 0.38) 52%, rgba(5, 7, 11, 0.06) 78%), linear-gradient(0deg, rgba(5, 7, 11, 0.58) 0%, transparent 34%, transparent 72%, rgba(5, 7, 11, 0.2) 100%)";

export type DeathScreenAnimationPreset =
	| "none"
	| "subtle"
	| "dramatic"
	| "arcade"
	| "cinematic"
	| "tactical"
	| "speed"
	| "minimalist";

export interface DeathScreenAnimationConfig {
	enabled?: boolean;
	preset?: DeathScreenAnimationPreset;
	stagger?: number; // ms between elements
	duration?: number; // ms
	easing?: DeathScreenEasing;
	exitAnimation?: "none" | "fade" | "scale_down" | "slide_down";
	spectatorTransition?: SpectatorTransitionConfig;
}

export interface DeathScreenConfig {
	version?: number;
	enabled: boolean;
	title: string;
	message: string;
	backgroundColor: string;
	accentColor: string;
	backgroundImage?: string;
	background?: DeathScreenBackgroundConfig;
	screenBlur?: number;
	buttons: DeathScreenActionButton[];
	transitions?: DeathScreenTransitions;
	accessibility?: DeathScreenAccessibility;
	elements?: DeathScreenElement[];
	animations?: DeathScreenAnimationConfig;
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
	respawnDelayBehavior?: RespawnDelayBehavior; // "auto" (default) or "button" (wait for click after delay)
	allowSkipRespawnDelay?: boolean; // whether player can skip delay and respawn immediately
	respawns?: number | null; // null/undefined = inherit from player profile (-1 for infinite, 0 for permadeath, N for extra lives)
	respawnProtection?: RespawnProtectionConfig;
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
	respawnDelayBehavior?: RespawnDelayBehavior;
	allowSkipRespawnDelay?: boolean;
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
	templateType: "classic" | "tactical" | "racing" | "minimal" | "arcade" | "cinematic" | "speed" = "classic",
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

	if (templateType === "arcade") {
		return [
			{
				id: "elem_title",
				name: "Título Arcade",
				type: "title",
				visible: true,
				x: 50,
				y: 32,
				width: 70,
				height: 14,
				anchor: "center",
				zIndex: 2,
				content: titleText || "GAME OVER",
				animation: { type: "scale_up", duration: 450, easing: "easeOutBack" },
				style: {
					fontSize: 48,
					fontWeight: "800",
					color: "#ffd166",
					textAlign: "center",
					letterSpacing: "0.15em",
					textTransform: "uppercase",
					textShadow: `0 0 25px ${accentColor}, 0 0 10px #ff0055`,
				},
			},
			{
				id: "elem_subtitle",
				name: "Subtítulo Arcade",
				type: "subtitle",
				visible: true,
				x: 50,
				y: 47,
				width: 60,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: messageText || "CONTINUE? INSERTA MONEDA O REINTENTA",
				animation: { type: "fade", duration: 350, delay: 100 },
				style: {
					fontSize: 16,
					fontWeight: "bold",
					color: "#00d2ff",
					textAlign: "center",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
				},
			},
			{
				id: "elem_countdown",
				name: "Tiempo Límite",
				type: "respawn_countdown",
				visible: true,
				x: 50,
				y: 57,
				width: 50,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: "CUENTA REGRESIVA: {countdown}",
				fallbackContent: "LISTO PARA REJUGAR",
				animation: { type: "scale_up", duration: 300, delay: 200 },
				style: {
					fontSize: 22,
					fontWeight: "800",
					color: "#ffffff",
					textAlign: "center",
					textShadow: "0 0 12px rgba(255, 255, 255, 0.8)",
				},
			},
			{
				id: "elem_btn_retry",
				name: "Botón Reintentar Arcade",
				type: "action_button",
				visible: true,
				x: 50,
				y: 69,
				width: 28,
				height: 9,
				anchor: "center",
				zIndex: 3,
				content: "REINTENTAR YA",
				action: "respawn",
				isPrimary: true,
				animation: { type: "scale_up", duration: 400, delay: 250, easing: "easeOutBack" },
				style: {
					backgroundColor: accentColor,
					color: "#0d0f17",
					fontSize: 16,
					fontWeight: "800",
					borderRadius: 6,
					borderColor: "#ffffff",
					borderWidth: 2,
					borderStyle: "solid",
					boxShadow: `0 0 20px ${accentColor}aa`,
				},
			},
		];
	}

	if (templateType === "cinematic") {
		return [
			{
				id: "elem_title",
				name: "Título Cinemático",
				type: "title",
				visible: true,
				x: 50,
				y: 38,
				width: 80,
				height: 12,
				anchor: "center",
				zIndex: 2,
				content: titleText || "CAÍDO EN COMBATE",
				animation: { type: "blur_in", duration: 800, easing: "easeOutCubic" },
				style: {
					fontSize: 34,
					fontWeight: "bold",
					color: "#ffffff",
					textAlign: "center",
					letterSpacing: "0.22em",
					textTransform: "uppercase",
					fontFamily: "Georgia, serif",
				},
			},
			{
				id: "elem_divider",
				name: "Separador Cinemático",
				type: "divider",
				visible: true,
				x: 50,
				y: 46,
				width: 20,
				height: 1,
				anchor: "center",
				zIndex: 2,
				animation: { type: "fade", duration: 600, delay: 200 },
				style: {
					backgroundColor: `${accentColor}88`,
				},
			},
			{
				id: "elem_subtitle",
				name: "Mensaje Cinemático",
				type: "subtitle",
				visible: true,
				x: 50,
				y: 53,
				width: 60,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: messageText || "Tu señal táctica ha sido interrumpida.",
				animation: { type: "fade", duration: 600, delay: 300 },
				style: {
					fontSize: 15,
					fontWeight: "normal",
					color: "rgba(255, 255, 255, 0.75)",
					textAlign: "center",
					letterSpacing: "0.05em",
				},
			},
			{
				id: "elem_btn_continue",
				name: "Botón Cinemático",
				type: "action_button",
				visible: true,
				x: 50,
				y: 66,
				width: 22,
				height: 8,
				anchor: "center",
				zIndex: 3,
				content: "Reanudar Misión",
				action: "respawn",
				isPrimary: true,
				animation: { type: "fade", duration: 500, delay: 400 },
				style: {
					backgroundColor: "rgba(255, 255, 255, 0.12)",
					borderColor: "rgba(255, 255, 255, 0.35)",
					borderWidth: 1,
					borderStyle: "solid",
					borderRadius: 24,
					color: "#ffffff",
					fontSize: 13,
					fontWeight: "600",
					letterSpacing: "0.08em",
				},
			},
		];
	}

	if (templateType === "speed") {
		return [
			{
				id: "elem_title",
				name: "Título Velocidad",
				type: "title",
				visible: true,
				x: 50,
				y: 35,
				width: 70,
				height: 12,
				anchor: "center",
				zIndex: 2,
				content: titleText || "COLISIÓN CRÍTICA",
				animation: { type: "slide_left", duration: 350, easing: "easeOutCubic" },
				style: {
					fontSize: 38,
					fontWeight: "800",
					color: accentColor,
					textAlign: "center",
					letterSpacing: "0.1em",
					textTransform: "uppercase",
					textShadow: `0 0 20px ${accentColor}88`,
				},
			},
			{
				id: "elem_subtitle",
				name: "Subtítulo Velocidad",
				type: "subtitle",
				visible: true,
				x: 50,
				y: 47,
				width: 60,
				height: 8,
				anchor: "center",
				zIndex: 2,
				content: messageText || "Pérdida de control del vehículo.",
				animation: { type: "slide_right", duration: 350, delay: 80 },
				style: {
					fontSize: 15,
					fontWeight: "600",
					color: "#ffffff",
					textAlign: "center",
				},
			},
			{
				id: "elem_btn_reenter",
				name: "Botón Volver a la Pista",
				type: "action_button",
				visible: true,
				x: 50,
				y: 62,
				width: 26,
				height: 9,
				anchor: "center",
				zIndex: 3,
				content: "VOLVER A LA PISTA",
				action: "respawn",
				isPrimary: true,
				animation: { type: "scale_up", duration: 300, delay: 150 },
				style: {
					backgroundColor: accentColor,
					color: "#05070c",
					fontSize: 14,
					fontWeight: "800",
					borderRadius: 4,
				},
			},
		];
	}

	// Cinematic in-world template (default)
	return [
		{
			id: "elem_title",
			name: "Título Principal",
			type: "title",
			visible: true,
			x: 7,
			y: 43,
			width: 76,
			height: 11,
			anchor: "center-left",
			zIndex: 3,
			content: titleText || "HAS MUERTO",
			animation: { type: "slide_left", duration: 520, easing: "easeOutCubic" },
			style: {
				fontSize: 32,
				fontWeight: "800",
				color: "#ffffff",
				textAlign: "left",
				textTransform: "uppercase",
				letterSpacing: "0.12em",
				textShadow: "0 3px 24px rgba(0, 0, 0, 0.75)",
			},
		},
		{
			id: "elem_divider",
			name: "Acento Cinemático",
			type: "divider",
			visible: true,
			x: 7,
			y: 51,
			width: 8,
			height: 0.45,
			anchor: "center-left",
			zIndex: 3,
			animation: { type: "slide_right", duration: 420, delay: 100 },
			style: {
				backgroundColor: accentColor,
			},
		},
		{
			id: "elem_subtitle",
			name: "Mensaje / Subtítulo",
			type: "subtitle",
			visible: true,
			x: 7,
			y: 56,
			width: 52,
			height: 6,
			anchor: "center-left",
			zIndex: 3,
			content: messageText || "Has sido eliminado de la partida.",
			animation: { type: "fade", duration: 450, delay: 120 },
			style: {
				fontSize: 16,
				fontWeight: "600",
				color: "rgba(239, 243, 250, 0.88)",
				textAlign: "left",
				textShadow: "0 2px 12px rgba(0, 0, 0, 0.8)",
			},
		},
		{
			id: "elem_killer_info",
			name: "Información de Eliminación",
			type: "killer_info",
			visible: true,
			x: 7,
			y: 65,
			width: 48,
			height: 5,
			anchor: "center-left",
			zIndex: 3,
			content: "ELIMINADO POR  /  {killer_name}",
			fallbackContent: "ELIMINADO EN COMBATE",
			conditions: { requireData: ["killer"] },
			style: {
				fontSize: 12,
				fontWeight: "bold",
				color: "rgba(238, 242, 247, 0.78)",
				textAlign: "left",
				letterSpacing: "0.08em",
			},
		},
		{
			id: "elem_remaining_lives",
			name: "Vidas Restantes",
			type: "remaining_lives",
			visible: true,
			x: 7,
			y: 71,
			width: 36,
			height: 5,
			anchor: "center-left",
			zIndex: 3,
			content: "VIDAS RESTANTES  /  {remaining_lives}",
			fallbackContent: "Vidas: Infinitas",
			style: {
				fontSize: 12,
				fontWeight: "600",
				color: "rgba(238, 242, 247, 0.72)",
				textAlign: "left",
				letterSpacing: "0.06em",
			},
		},
		{
			id: "elem_countdown",
			name: "Cuenta Regresiva",
			type: "respawn_countdown",
			visible: true,
			x: 7,
			y: 79,
			width: 42,
			height: 7,
			anchor: "center-left",
			zIndex: 3,
			content: "REGRESO EN  {countdown}s",
			fallbackContent: "Reaparición disponible",
			conditions: { states: ["respawn"] },
			animation: { type: "fade", duration: 350, delay: 180 },
			style: {
				fontSize: 19,
				fontWeight: "bold",
				color: accentColor,
				textAlign: "left",
				letterSpacing: "0.08em",
				textShadow: `0 2px 16px ${accentColor}55`,
			},
		},
		{
			id: "elem_btn_respawn",
			name: "Botón Reaparecer",
			type: "action_button",
			visible: true,
			x: 7,
			y: 89,
			width: 22,
			height: 7,
			anchor: "center-left",
			zIndex: 4,
			content: "REVIVIR",
			action: "respawn",
			isPrimary: true,
			animation: { type: "slide_up", duration: 420, delay: 220 },
			style: {
				backgroundColor: accentColor,
				color: "#ffffff",
				fontSize: 12,
				fontWeight: "800",
				letterSpacing: "0.08em",
				borderRadius: 3,
				boxShadow: `0 8px 28px ${accentColor}44`,
			},
		},
		{
			id: "elem_btn_lobby",
			name: "Botón Lobby",
			type: "action_button",
			visible: true,
			x: 31,
			y: 89,
			width: 16,
			height: 7,
			anchor: "center-left",
			zIndex: 4,
			content: "SALIR",
			action: "lobby",
			isPrimary: false,
			style: {
				backgroundColor: "rgba(10, 14, 22, 0.56)",
				borderColor: "rgba(255, 255, 255, 0.32)",
				borderWidth: 1,
				borderStyle: "solid",
				color: "rgba(255, 255, 255, 0.9)",
				fontSize: 12,
				fontWeight: "600",
				letterSpacing: "0.06em",
				borderRadius: 3,
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

			const animation = e.animation && typeof e.animation === "object"
				? {
						type: (["none", "fade", "slide_up", "slide_down", "slide_left", "slide_right", "scale_up", "blur_in"].includes(e.animation.type)
							? e.animation.type
							: "slide_up") as DeathScreenAnimationType,
						duration: typeof e.animation.duration === "number" ? Math.max(0, e.animation.duration) : undefined,
						delay: typeof e.animation.delay === "number" ? Math.max(0, e.animation.delay) : undefined,
						easing: (["linear", "easeInQuad", "easeOutQuad", "easeInOutQuad", "easeOutCubic", "easeOutBack", "easeOutElastic"].includes(e.animation.easing)
							? e.animation.easing
							: undefined) as DeathScreenEasing,
					}
				: undefined;

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
				animation,
			};
		});
}

/**
 * Normalizes background configuration with backwards compatibility for legacy attributes.
 */
export function normalizeDeathScreenBackground(
	rawBg: any,
	legacyBgColor?: string,
	legacyBgImg?: string
): DeathScreenBackgroundConfig {
	const raw = rawBg && typeof rawBg === "object" ? rawBg : {};

	let type: DeathScreenBackgroundType = "gradient";
	if (["color", "gradient", "image", "animated"].includes(raw.type)) {
		type = raw.type;
	} else if (raw.imageUrl || legacyBgImg) {
		type = "image";
	} else if (raw.gradient) {
		type = "gradient";
	} else if (raw.color || legacyBgColor) {
		type = "gradient";
	}

	const color = typeof raw.color === "string" ? raw.color : (typeof legacyBgColor === "string" ? legacyBgColor : "rgba(13, 15, 23, 0.94)");
	const gradient = typeof raw.gradient === "string" ? raw.gradient : undefined;
	const imageUrl = sanitizeImageUrl(raw.imageUrl ?? legacyBgImg);
	const imageFit = ["cover", "contain", "fill"].includes(raw.imageFit) ? raw.imageFit : "cover";
	const imagePosition = typeof raw.imagePosition === "string" ? raw.imagePosition : "center";
	const overlayColor = typeof raw.overlayColor === "string" ? raw.overlayColor : "rgba(0, 0, 0, 0.7)";
	const overlayOpacity = typeof raw.overlayOpacity === "number" ? Math.max(0, Math.min(1, raw.overlayOpacity)) : 0.7;

	const animRaw = raw.animation && typeof raw.animation === "object" ? raw.animation : {};
	const animation: DeathScreenBgAnimationConfig = {
		enabled: type === "animated" ? animRaw.enabled !== false : Boolean(animRaw.enabled),
		type: (["none", "ken_burns", "pulse_glow", "scanlines", "pan"].includes(animRaw.type)
			? animRaw.type
			: (type === "animated" ? "ken_burns" : "none")) as DeathScreenBgAnimationType,
		duration: typeof animRaw.duration === "number" ? Math.max(500, animRaw.duration) : 8000,
		speed: typeof animRaw.speed === "number" ? animRaw.speed : 1,
		intensity: typeof animRaw.intensity === "number" ? Math.max(0, Math.min(1, animRaw.intensity)) : 0.5,
	};

	return {
		type,
		color,
		gradient,
		imageUrl,
		imageFit,
		imagePosition,
		overlayColor,
		overlayOpacity,
		animation,
	};
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
	const background = normalizeDeathScreenBackground(rawScreen?.background, rawScreen?.backgroundColor, rawScreen?.backgroundImage);
	const backgroundColor = background.color || (typeof rawScreen?.backgroundColor === "string" ? rawScreen.backgroundColor : "rgba(13, 15, 23, 0.92)");
	const backgroundImage = background.imageUrl || sanitizeImageUrl(rawScreen?.backgroundImage);
	const screenBlur = typeof rawScreen?.screenBlur === "number" ? Math.max(0, rawScreen.screenBlur) : 12;

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
	if (Array.isArray(rawScreen?.elements) && (rawScreen?.version === 2 || rawScreen.elements.length > 0)) {
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

	const allowedPresets: DeathScreenAnimationPreset[] = [
		"none", "subtle", "dramatic", "arcade", "cinematic", "tactical", "speed", "minimalist"
	];
	const preset: DeathScreenAnimationPreset = allowedPresets.includes(rawScreen?.animations?.preset)
		? rawScreen.animations.preset
		: "subtle";

	return {
		version: 2,
		enabled: rawScreen?.enabled !== false,
		title,
		message,
		backgroundColor,
		accentColor,
		backgroundImage,
		background,
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
		animations: {
			enabled: rawScreen?.animations?.enabled !== false,
			preset,
			stagger: typeof rawScreen?.animations?.stagger === "number" ? Math.max(0, rawScreen.animations.stagger) : 60,
			duration: typeof rawScreen?.animations?.duration === "number" ? Math.max(50, rawScreen.animations.duration) : 350,
			easing: (["linear", "easeInQuad", "easeOutQuad", "easeInOutQuad", "easeOutCubic", "easeOutBack", "easeOutElastic"].includes(rawScreen?.animations?.easing)
				? rawScreen.animations.easing
				: "easeOutCubic") as DeathScreenEasing,
			exitAnimation: (["none", "fade", "scale_down", "slide_down"].includes(rawScreen?.animations?.exitAnimation)
				? rawScreen.animations.exitAnimation
				: "fade") as "none" | "fade" | "scale_down" | "slide_down",
			spectatorTransition: {
				enabled: rawScreen?.animations?.spectatorTransition?.enabled !== false,
				duration: typeof rawScreen?.animations?.spectatorTransition?.duration === "number" ? Math.max(50, rawScreen.animations.spectatorTransition.duration) : 400,
				style: (["smooth", "cinematic", "instant"].includes(rawScreen?.animations?.spectatorTransition?.style)
					? rawScreen.animations.spectatorTransition.style
					: "smooth") as "smooth" | "cinematic" | "instant",
			},
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
		respawnDelayBehavior: "auto",
		allowSkipRespawnDelay: true,
		respawns: undefined, // Inherits from player profile
		explodeOnDeath: undefined, // Inherits from player profile
		respawnProtection: {
			enabled: false,
			duration: 3,
			type: "invulnerability",
			showVisual: true,
			cancelOnAttack: false,
		},
		deathScreen: migrateDeathScreenConfig({
			enabled: true,
			title: "HAS MUERTO",
			message: "Volviendo al punto de inicio...",
			backgroundColor: "rgba(13, 15, 23, 0.92)",
			accentColor: "#ff3b47",
			screenBlur: 4,
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
		respawnDelayBehavior: "auto",
		allowSkipRespawnDelay: true,
		respawns: -1,
		explodeOnDeath: false,
		respawnProtection: {
			enabled: false,
			duration: 1.5,
			type: "invulnerability",
			showVisual: true,
			cancelOnAttack: false,
		},
		deathScreen: migrateDeathScreenConfig({
			enabled: true,
			title: "FUERA DE PISTA",
			message: "Regresando al último punto de control...",
			backgroundColor: "rgba(16, 24, 38, 0.90)",
			accentColor: "#00d2ff",
			screenBlur: 3,
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
		respawnDelayBehavior: "auto",
		allowSkipRespawnDelay: false,
		respawns: 0,
		explodeOnDeath: true,
		respawnProtection: {
			enabled: false,
		},
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
			screenBlur: 5,
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

		const respawnDelayBehavior: RespawnDelayBehavior = m.respawnDelayBehavior === "button" ? "button" : "auto";
		const allowSkipRespawnDelay: boolean = m.allowSkipRespawnDelay !== false;

		const respawns = typeof m.respawns === "number" && !isNaN(m.respawns)
			? m.respawns
			: (m.respawns === null ? null : undefined);

		const explodeOnDeath = typeof m.explodeOnDeath === "boolean"
			? m.explodeOnDeath
			: (m.explodeOnDeath === null ? null : undefined);
		const protectionType: RespawnProtectionType = ["invulnerability", "shield", "damage_reduction"].includes(m.respawnProtection?.type)
			? m.respawnProtection.type
			: "invulnerability";
		const respawnProtection: RespawnProtectionConfig = {
			enabled: m.respawnProtection?.enabled === true,
			duration: typeof m.respawnProtection?.duration === "number" && Number.isFinite(m.respawnProtection.duration)
				? Math.min(30, Math.max(0, m.respawnProtection.duration))
				: 3,
			type: protectionType,
			shieldPoints: typeof m.respawnProtection?.shieldPoints === "number" && Number.isFinite(m.respawnProtection.shieldPoints)
				? Math.min(10000, Math.max(0, m.respawnProtection.shieldPoints))
				: 50,
			damageMultiplier: typeof m.respawnProtection?.damageMultiplier === "number" && Number.isFinite(m.respawnProtection.damageMultiplier)
				? Math.min(1, Math.max(0, m.respawnProtection.damageMultiplier))
				: 0.25,
			showVisual: m.respawnProtection?.showVisual !== false,
			cancelOnAttack: m.respawnProtection?.cancelOnAttack === true,
		};

		const deathScreen = migrateDeathScreenConfig(m.deathScreen, { id });

		return {
			id,
			name,
			description: typeof m.description === "string" ? m.description : "",
			enabledCauses,
			respawnPolicy,
			respawnDelay,
			respawnDelayBehavior,
			allowSkipRespawnDelay,
			respawns,
			explodeOnDeath,
			respawnProtection,
			roleModeAssignments: m.roleModeAssignments && typeof m.roleModeAssignments === "object" ? { ...m.roleModeAssignments } : {},
			spectator: {
				enabled: m.spectator?.enabled !== false,
				allowFollow: m.spectator?.allowFollow !== false,
				perspective: (["first_person", "third_person", "switchable"].includes(m.spectator?.perspective)
					? m.spectator.perspective
					: "third_person") as SpectatorPerspective,
				allowedRoleIds: Array.isArray(m.spectator?.allowedRoleIds) ? m.spectator.allowedRoleIds.filter((id: any) => typeof id === "string") : [],
				quality: (["full", "balanced", "low"].includes(m.spectator?.quality) ? m.spectator.quality : "balanced") as "full" | "balanced" | "low",
				transition: {
					enabled: m.spectator?.transition?.enabled !== false,
					duration: typeof m.spectator?.transition?.duration === "number" ? Math.max(50, m.spectator.transition.duration) : 400,
					style: (["smooth", "cinematic", "instant"].includes(m.spectator?.transition?.style)
						? m.spectator.transition.style
						: "smooth") as "smooth" | "cinematic" | "instant",
				},
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

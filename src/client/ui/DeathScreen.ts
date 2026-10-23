import type {
	DeathScreenConfig,
	DeathState,
	DeathActionButtonType,
	ExperienceModeProfile,
	DeathContext,
} from "../types/experienceMode.types";
import {
	evaluateDynamicTokens,
	sanitizeImageUrl,
	normalizeDeathScreenBackground,
} from "../types/experienceMode.types";
import { DeathAnimationService } from "../managers/DeathAnimationService";

export type DeathScreenActionCallback = (action: DeathActionButtonType) => void;

export function parseToRgba(colorStr: string, fallbackAlpha = 0.9): string {
	if (!colorStr || typeof colorStr !== "string") {
		return `rgba(13, 15, 23, ${fallbackAlpha})`;
	}
	const trimmed = colorStr.trim();

	// Match hex #rgb, #rgba, #rrggbb, #rrggbbaa
	if (trimmed.startsWith("#")) {
		let hex = trimmed.slice(1);
		if (hex.length === 3 || hex.length === 4) {
			hex = hex.split("").map((c) => c + c).join("");
		}
		if (hex.length === 6 || hex.length === 8) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : fallbackAlpha;
			return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
		}
	}

	// Match rgba(r, g, b, a) or rgb(r, g, b)
	const match = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
	if (match) {
		const r = match[1];
		const g = match[2];
		const b = match[3];
		const a = match[4] !== undefined ? match[4] : fallbackAlpha;
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	return trimmed;
}

export class DeathScreen {
	private element: HTMLDivElement;
	private bgLayer: HTMLDivElement;
	private card: HTMLDivElement;
	private visualContainer: HTMLDivElement;
	private titleEl: HTMLHeadingElement;
	private messageEl: HTMLParagraphElement;
	private statusEl: HTMLParagraphElement;
	private countdownEl: HTMLParagraphElement;
	private buttonsContainer: HTMLDivElement;
	private previewBanner: HTMLDivElement;

	private intervalId: number | null = null;
	private respawnAt = 0;
	private onActionCallback: DeathScreenActionCallback | null = null;
	private isPreviewing = false;
	private currentButtons: Array<{ button: HTMLButtonElement; action: DeathActionButtonType; isPrimary?: boolean }> = [];
	private countdownElements: Array<{ el: HTMLElement; template: string; fallback?: string }> = [];
	private lastDeathState: DeathState | null = null;
	public animationService: DeathAnimationService;

	constructor(onAction?: DeathScreenActionCallback) {
		this.onActionCallback = onAction || null;
		this.animationService = new DeathAnimationService();

		if (typeof document === "undefined") {
			const dummy: any = {
				style: {},
				append: () => {},
				appendChild: () => {},
				remove: () => {},
				dataset: {},
				setAttribute: () => {},
			};
			this.element = dummy;
			this.bgLayer = dummy;
			this.card = dummy;
			this.visualContainer = dummy;
			this.titleEl = dummy;
			this.messageEl = dummy;
			this.statusEl = dummy;
			this.countdownEl = dummy;
			this.buttonsContainer = dummy;
			this.previewBanner = dummy;
			return;
		}

		this.element = document.createElement("div");
		this.element.id = "viper-death-screen";
		this.element.setAttribute("role", "alertdialog");
		this.element.setAttribute("aria-modal", "true");
		this.element.setAttribute("aria-label", "Pantalla de muerte");
		this.element.style.cssText = `
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: none;
			align-items: center;
			justify-content: center;
			padding: 0;
			box-sizing: border-box;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			user-select: none;
			pointer-events: auto;
			transition: opacity 0.25s ease;
		`;

		// Preview top banner
		this.previewBanner = document.createElement("div");
		this.previewBanner.style.cssText = `
			position: absolute;
			top: 18px;
			left: 50%;
			transform: translateX(-50%);
			background: rgba(0, 0, 0, 0.75);
			border: 1px solid rgba(255, 255, 255, 0.25);
			padding: 6px 16px;
			border-radius: 20px;
			font-size: 13px;
			font-weight: 600;
			color: #ffd166;
			display: none;
			align-items: center;
			gap: 12px;
			backdrop-filter: blur(8px);
			z-index: 10000;
		`;
		const bannerText = document.createElement("span");
		bannerText.textContent = "👁 MODO PREVISUALIZACIÓN DE PANTALLA";
		const closePreviewBtn = document.createElement("button");
		closePreviewBtn.type = "button";
		closePreviewBtn.textContent = "Cerrar Vista Previa";
		closePreviewBtn.style.cssText = `
			background: #e63946;
			color: white;
			border: none;
			padding: 4px 10px;
			border-radius: 12px;
			cursor: pointer;
			font-size: 12px;
			font-weight: bold;
		`;
		closePreviewBtn.onclick = () => this.hide();
		this.previewBanner.append(bannerText, closePreviewBtn);
		this.element.appendChild(this.previewBanner);

		// Dedicated Background Layer (isolated from UI elements and element animations)
		this.bgLayer = document.createElement("div");
		this.bgLayer.id = "viper-death-bg-layer";
		this.bgLayer.style.cssText = `
			position: absolute;
			inset: -5%;
			width: 110%;
			height: 110%;
			overflow: hidden;
			pointer-events: none;
			z-index: 0;
		`;
		this.element.appendChild(this.bgLayer);

		// Visual Layout Viewport Container (for v2 schema)
		this.visualContainer = document.createElement("div");
		this.visualContainer.id = "viper-death-visual-viewport";
		this.visualContainer.style.cssText = `
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			overflow: hidden;
			display: none;
			pointer-events: auto;
		`;
		this.element.appendChild(this.visualContainer);

		// Central Card (for legacy v1 fallback)
		this.card = document.createElement("div");
		this.card.style.cssText = `
			width: min(480px, 92vw);
			padding: 38px 32px 32px;
			border-radius: 20px;
			box-shadow: 0 24px 80px rgba(0, 0, 0, 0.65), 0 0 30px rgba(0, 0, 0, 0.3);
			text-align: center;
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 14px;
		`;

		this.titleEl = document.createElement("h1");
		this.titleEl.style.cssText = `
			margin: 0;
			font-size: clamp(26px, 6vw, 36px);
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		`;

		this.messageEl = document.createElement("p");
		this.messageEl.style.cssText = `
			margin: 0;
			font-size: 15px;
			line-height: 1.5;
			color: rgba(255, 255, 255, 0.85);
			max-width: 400px;
		`;

		this.statusEl = document.createElement("p");
		this.statusEl.style.cssText = `
			margin: 0;
			font-size: 14px;
			font-weight: 600;
			letter-spacing: 0.02em;
			color: rgba(255, 255, 255, 0.6);
		`;

		this.countdownEl = document.createElement("p");
		this.countdownEl.setAttribute("aria-live", "polite");
		this.countdownEl.style.cssText = `
			min-height: 22px;
			margin: 0;
			font-size: 14px;
			font-weight: 700;
			letter-spacing: 0.04em;
		`;

		this.buttonsContainer = document.createElement("div");
		this.buttonsContainer.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			justify-content: center;
			margin-top: 10px;
			width: 100%;
		`;

		this.card.append(this.titleEl, this.messageEl, this.statusEl, this.countdownEl, this.buttonsContainer);
		this.element.appendChild(this.card);
		document.body.appendChild(this.element);

		// Handle keyboard navigation (Enter, Space, Escape, Tab focus loop)
		if (typeof window !== "undefined") {
			window.addEventListener("keydown", this.handleKeyDown);
		}
	}

	setActionCallback(callback: DeathScreenActionCallback) {
		this.onActionCallback = callback;
	}

	show(state: DeathState) {
		this.clearCountdown();
		this.isPreviewing = false;
		this.lastDeathState = state;
		if (typeof document === "undefined") {
			return;
		}
		this.previewBanner.style.display = "none";

		const mode = state.activeMode;
		const config = mode.deathScreen;

		if (!config.enabled) {
			this.element.style.display = "none";
			return;
		}

		this.applyVisualStyles(config);

		// Check if v2 visual elements layout is present
		if (Array.isArray(config.elements) && (config.version === 2 || config.elements.length > 0)) {
			this.card.style.display = "none";
			this.visualContainer.style.display = "block";
			this.renderVisualElements(config, state);
		} else {
			// Legacy fallback
			this.visualContainer.style.display = "none";
			this.card.style.display = "flex";

			// Set text content
			this.titleEl.textContent = config.title || "HAS MUERTO";

			if (state.cause === "fall") {
				this.messageEl.textContent = state.context?.details || config.message || "Has caído al vacío.";
			} else {
				this.messageEl.textContent = config.message || "Has sido eliminado de la partida.";
			}

			if (state.remainingRespawns === -1) {
				this.statusEl.textContent = "Vidas: Infinitas";
			} else if (state.remainingRespawns > 0) {
				this.statusEl.textContent = `Vidas restantes: ${state.remainingRespawns}`;
			} else {
				this.statusEl.textContent = "No te quedan más vidas.";
			}

			this.renderButtons(config, state.willRespawn);

			if (state.willRespawn && state.respawnDelay > 0) {
				this.respawnAt = Date.now() + state.respawnDelay * 1000;
				this.updateCountdown();
				this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
			} else if (state.willRespawn && state.respawnDelay === 0) {
				this.countdownEl.textContent = state.respawnDelayBehavior === "button"
					? "¡Listo para reaparecer!"
					: "Reaparición inmediata disponible";
			} else {
				this.countdownEl.textContent = "";
			}
		}

		this.updateRespawnButtonState();

		this.element.style.display = "flex";

		// Trigger entrance animations via DeathAnimationService
		const isReducedMotion = config.accessibility?.reduceMotion || this.animationService.isReducedMotion();
		if (Array.isArray(config.elements) && (config.version === 2 || config.elements.length > 0)) {
			this.animationService.animateScreenEntrance(this.visualContainer, config.elements, config.animations, { reducedMotion: isReducedMotion });
		} else {
			this.animationService.animateScreenEntrance(this.card, [], config.animations, { reducedMotion: isReducedMotion });
		}

		// Auto-focus primary button for screen-readers and gamepad/keyboard navigation
		setTimeout(() => {
			const primary = this.currentButtons.find((b) => b.isPrimary) || this.currentButtons[0];
			if (primary && primary.button && typeof primary.button.focus === "function") {
				primary.button.focus();
			}
		}, 50);
	}

	showPreview(
		mode: ExperienceModeProfile,
		previewState: "respawn" | "last_life" | "game_over" | "spectator" = "respawn",
		previewContext?: Partial<DeathContext>
	) {
		this.clearCountdown();
		this.isPreviewing = true;
		if (typeof document === "undefined") {
			return;
		}
		this.previewBanner.style.display = "flex";

		const isRespawn = previewState === "respawn" || previewState === "last_life";
		const mockState: DeathState = {
			cause: previewContext?.cause || "damage",
			willRespawn: isRespawn,
			respawnDelay: isRespawn ? Math.max(1, mode.respawnDelay ?? 3) : 0,
			remainingRespawns: previewState === "last_life" ? 1 : (previewState === "game_over" ? 0 : (mode.respawns ?? 3)),
			activeMode: mode,
			context: {
				cause: previewContext?.cause || "damage",
				killerName: previewContext?.killerName ?? "Fantasma_99",
				killerWeapon: previewContext?.killerWeapon ?? "Rifle de Plasma",
				details: previewContext?.details ?? "Eliminado en sector central",
				...previewContext,
			},
		};

		this.lastDeathState = mockState;
		const config = mode.deathScreen;
		this.applyVisualStyles(config);

		if (Array.isArray(config.elements) && (config.version === 2 || config.elements.length > 0)) {
			this.card.style.display = "none";
			this.visualContainer.style.display = "block";
			this.renderVisualElements(config, mockState);
		} else {
			this.visualContainer.style.display = "none";
			this.card.style.display = "flex";
			this.titleEl.textContent = config.title || "HAS MUERTO";
			this.messageEl.textContent = config.message || "Has sido eliminado de la partida.";

			if (previewState === "respawn") {
				this.statusEl.textContent = mode.respawns === -1 ? "Vidas: Infinitas" : `Vidas restantes: ${mode.respawns ?? 3}`;
				this.respawnAt = Date.now() + Math.max(1, mode.respawnDelay ?? 3) * 1000;
				this.updateCountdown();
				this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
			} else if (previewState === "last_life") {
				this.statusEl.textContent = "¡ÚLTIMA VIDA RESTANTE! (1 vida restante)";
				this.respawnAt = Date.now() + Math.max(1, mode.respawnDelay ?? 3) * 1000;
				this.updateCountdown();
				this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
			} else {
				this.statusEl.textContent = "No te quedan más vidas. Fin de la partida.";
				this.countdownEl.textContent = "Estado: Partida Finalizada";
			}

			this.renderButtons(config, isRespawn);
		}

		this.updateRespawnButtonState();

		this.element.style.display = "flex";

		// Trigger entrance animations in preview mode too
		const isReducedMotion = config.accessibility?.reduceMotion || this.animationService.isReducedMotion();
		if (Array.isArray(config.elements) && (config.version === 2 || config.elements.length > 0)) {
			this.animationService.animateScreenEntrance(this.visualContainer, config.elements, config.animations, { reducedMotion: isReducedMotion });
		} else {
			this.animationService.animateScreenEntrance(this.card, [], config.animations, { reducedMotion: isReducedMotion });
		}
	}

	hide() {
		this.clearCountdown();
		this.animationService.cancelScreenAnimations(true);
		if (this.element && this.element.style) {
			this.element.style.display = "none";
		}
		if (this.previewBanner && this.previewBanner.style) {
			this.previewBanner.style.display = "none";
		}
		this.isPreviewing = false;
	}

	destroy() {
		this.clearCountdown();
		this.animationService.dispose();
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", this.handleKeyDown);
		}
		if (this.element && typeof this.element.remove === "function") {
			this.element.remove();
		}
	}

	private renderVisualElements(config: DeathScreenConfig, state: DeathState) {
		this.visualContainer.innerHTML = "";
		this.countdownElements = [];
		this.currentButtons = [];

		const willRespawn = state.willRespawn;
		const remainingLives = state.remainingRespawns;
		const isLastLife = remainingLives === 1;
		const isGameOver = !willRespawn && remainingLives === 0;
		const isSpectator = state.activeMode?.respawnPolicy === "spectator";

		const currentStateType: "respawn" | "last_life" | "game_over" | "spectator" = isSpectator
			? "spectator"
			: (isGameOver ? "game_over" : (isLastLife ? "last_life" : "respawn"));

		const elements = config.elements || [];
		elements.forEach((elem) => {
			if (elem.visible === false) return;

			// Condition Checks
			const cond = elem.conditions;
			if (cond) {
				if (cond.causes && cond.causes.length > 0 && !cond.causes.includes(state.cause)) {
					return;
				}
				if (cond.roles && cond.roles.length > 0) {
					const playerRole = (state as any).playerRoleId;
					if (playerRole && !cond.roles.includes(playerRole)) return;
				}
				if (cond.states && cond.states.length > 0 && !cond.states.includes(currentStateType)) {
					return;
				}
				if (cond.requireData && cond.requireData.length > 0) {
					if (cond.requireData.includes("killer") && !state.context?.killerName) {
						return;
					}
					if (cond.requireData.includes("countdown") && (!willRespawn || state.respawnDelay <= 0)) {
						return;
					}
				}
			}

			// Cause Overrides
			const override = elem.causeOverrides?.[state.cause];
			const contentTemplate = override?.content || elem.content || "";
			const elemColor = override?.color || elem.style?.color;

			// Token Evaluation with fallback
			const resolvedText = evaluateDynamicTokens(contentTemplate, state, elem.fallbackContent || "");

			// Hide if missing required data flag
			if (cond?.hideWhenMissingData && contentTemplate.includes("{killer_name}") && !state.context?.killerName) {
				return;
			}

			// If action button is respawn and player will not respawn:
			if (elem.type === "action_button" && elem.action === "respawn" && !willRespawn) {
				return;
			}

			const tagName = elem.type === "action_button"
				? "button"
				: (elem.type === "title" ? "h1" : (elem.type === "subtitle" ? "p" : "div"));
			const el = document.createElement(tagName);
			el.className = `viper-death-element viper-death-${elem.type}`;
			el.dataset.elementId = elem.id;

			// Positioning & Anchors
			el.style.position = "absolute";
			el.style.left = `${elem.x}%`;
			el.style.top = `${elem.y}%`;
			el.style.width = `${elem.width}%`;
			el.style.minHeight = `${elem.height}%`;
			el.style.boxSizing = "border-box";
			el.style.zIndex = String(elem.zIndex ?? 1);

			let transformStr = "translate(-50%, -50%)";
			switch (elem.anchor) {
				case "top-left": transformStr = "translate(0, 0)"; break;
				case "top-center": transformStr = "translate(-50%, 0)"; break;
				case "top-right": transformStr = "translate(-100%, 0)"; break;
				case "center-left": transformStr = "translate(0, -50%)"; break;
				case "center": transformStr = "translate(-50%, -50%)"; break;
				case "center-right": transformStr = "translate(-100%, -50%)"; break;
				case "bottom-left": transformStr = "translate(0, -100%)"; break;
				case "bottom-center": transformStr = "translate(-50%, -100%)"; break;
				case "bottom-right": transformStr = "translate(-100%, -100%)"; break;
			}
			el.style.transform = transformStr;

			// Styling
			const s = elem.style || {};
			if (s.fontSize) el.style.fontSize = `${s.fontSize}px`;
			if (s.fontWeight) el.style.fontWeight = s.fontWeight;
			if (s.fontFamily) el.style.fontFamily = s.fontFamily;
			if (elemColor) el.style.color = elemColor;
			if (s.textAlign) el.style.textAlign = s.textAlign;
			if (s.textTransform) el.style.textTransform = s.textTransform;
			if (s.letterSpacing) el.style.letterSpacing = s.letterSpacing;
			if (s.backgroundColor) el.style.backgroundColor = s.backgroundColor;
			if (s.borderColor) el.style.borderColor = s.borderColor;
			if (s.borderWidth) el.style.borderWidth = `${s.borderWidth}px`;
			if (s.borderStyle) el.style.borderStyle = s.borderStyle;
			if (s.borderRadius) el.style.borderRadius = `${s.borderRadius}px`;
			if (s.opacity !== undefined) el.style.opacity = String(s.opacity);
			if (s.backdropBlur) el.style.backdropFilter = `blur(${s.backdropBlur}px)`;
			if (s.padding) el.style.padding = typeof s.padding === "number" ? `${s.padding}px` : s.padding;
			if (s.boxShadow) el.style.boxShadow = s.boxShadow;
			if (s.textShadow) el.style.textShadow = s.textShadow;

			// Content injection (strict textContent to prevent XSS)
			if (elem.type === "image") {
				const sanitizedSrc = sanitizeImageUrl(elem.imageUrl);
				if (sanitizedSrc) {
					const img = document.createElement("img");
					img.src = sanitizedSrc;
					img.alt = elem.name || "Imagen de muerte";
					img.style.maxWidth = "100%";
					img.style.maxHeight = "100%";
					img.style.objectFit = "contain";
					img.style.pointerEvents = "none";
					img.onerror = () => {
						img.style.display = "none";
						if (elem.fallbackContent || elem.content) {
							el.textContent = elem.fallbackContent || elem.content || "";
						}
					};
					el.appendChild(img);
				} else if (elem.fallbackContent || elem.content) {
					el.textContent = elem.fallbackContent || elem.content || "";
				}
			} else {
				el.textContent = resolvedText;
			}

			// Action Button Handling
			if (elem.type === "action_button") {
				const btn = el as HTMLButtonElement;
				btn.type = "button";
				btn.dataset.action = elem.action || "respawn";
				btn.tabIndex = 0;
				btn.style.cursor = "pointer";
				btn.style.userSelect = "none";
				btn.style.transition = "transform 0.15s ease, filter 0.15s ease";

				btn.onmouseenter = () => {
					btn.style.transform = `${transformStr} scale(1.03)`;
					btn.style.filter = "brightness(1.15)";
				};
				btn.onmouseleave = () => {
					btn.style.transform = transformStr;
					btn.style.filter = "none";
				};

				btn.onclick = (e) => {
					e.stopPropagation();
					this.triggerAction(elem.action || "respawn");
				};

				this.currentButtons.push({
					button: btn,
					action: elem.action || "respawn",
					isPrimary: elem.isPrimary,
				});
			}

			// Countdown tracking
			if (elem.type === "respawn_countdown") {
				el.setAttribute("aria-live", "polite");
				this.countdownElements.push({
					el,
					template: contentTemplate,
					fallback: elem.fallbackContent,
				});
			}

			this.visualContainer.appendChild(el);
		});

		// Start ticker if willRespawn and delay > 0
		if (willRespawn && state.respawnDelay > 0) {
			this.respawnAt = Date.now() + state.respawnDelay * 1000;
			this.updateCountdown();
			this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
		}
	}

	private applyVisualStyles(config: DeathScreenConfig) {
		const bg = normalizeDeathScreenBackground(config.background, config.backgroundColor, config.backgroundImage);
		const rawBg = bg.color || config.backgroundColor || "rgba(13, 15, 23, 0.92)";
		const accent = config.accentColor || "#ff3b47";
		const blur = typeof config.transitions?.blur === "number"
			? config.transitions.blur
			: (typeof config.screenBlur === "number" ? config.screenBlur : 12);

		const cardBg = parseToRgba(rawBg, 0.94);
		const overlayCenterBg = parseToRgba(rawBg, 0.85);

		// Accessibility check for reduced motion
		const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const isReducedMotion = config.accessibility?.reduceMotion || prefersReducedMotion;

		const duration = isReducedMotion ? 0 : (config.transitions?.duration ?? 0.25);
		this.element.style.transition = `opacity ${duration}s ease`;

		// Compose background layers inside dedicated bgLayer container
		if (this.bgLayer && this.bgLayer.style) {
			this.bgLayer.innerHTML = "";
			this.bgLayer.style.background = "";
			this.bgLayer.style.filter = "";

			const bgType = bg.type || (bg.imageUrl ? "image" : "gradient");

			if (bgType === "color") {
				// Pure solid color without forced gradients
				this.bgLayer.style.backgroundColor = bg.color || rawBg;
			} else if (bgType === "gradient") {
				// Custom or preset gradient
				if (bg.gradient) {
					this.bgLayer.style.background = bg.gradient;
				} else {
					this.bgLayer.style.background = `radial-gradient(ellipse at center, ${overlayCenterBg}, rgba(5, 7, 12, 0.97) 80%)`;
				}
			} else if (bgType === "image" || bgType === "animated") {
				// Base backdrop color and gradient fallback for robustness if image fails or is loading
				this.bgLayer.style.backgroundColor = bg.color || "#05070c";
				this.bgLayer.style.background = bg.gradient || `radial-gradient(ellipse at center, ${overlayCenterBg}, rgba(5, 7, 12, 0.97) 80%)`;

				const imgUrl = bg.imageUrl;
				if (imgUrl) {
					const imgEl = document.createElement("div");
					imgEl.className = "viper-death-bg-image";
					imgEl.style.cssText = `
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						background-image: url("${imgUrl}");
						background-size: ${bg.imageFit || "cover"};
						background-position: ${bg.imagePosition || "center"};
						background-repeat: no-repeat;
						pointer-events: none;
					`;
					this.bgLayer.appendChild(imgEl);
				}

				// Readability overlay layer on top of image
				const overlayOpacity = bg.overlayOpacity ?? 0.7;
				if (overlayOpacity > 0) {
					const overlayEl = document.createElement("div");
					overlayEl.className = "viper-death-bg-overlay";
					overlayEl.style.cssText = `
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						background-color: ${bg.overlayColor || "rgba(0, 0, 0, 0.7)"};
						opacity: ${overlayOpacity};
						pointer-events: none;
					`;
					this.bgLayer.appendChild(overlayEl);
				}

				// Scanline decorative layer if requested
				if (bg.animation?.type === "scanlines" && !isReducedMotion) {
					const scanlinesEl = document.createElement("div");
					scanlinesEl.className = "viper-death-bg-scanlines";
					scanlinesEl.style.cssText = `
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px);
						pointer-events: none;
						opacity: 0.8;
					`;
					this.bgLayer.appendChild(scanlinesEl);
				}

				// Trigger independent background animation
				if ((bgType === "animated" || bg.animation?.enabled) && !isReducedMotion) {
					this.animationService.animateBackground(this.bgLayer, bg, { reducedMotion: isReducedMotion });
				} else {
					this.animationService.cancelBackgroundAnimation(true);
				}
			}
		}

		this.element.style.background = "transparent";

		if (!isReducedMotion && blur > 0) {
			this.element.style.backdropFilter = `blur(${blur}px)`;
			(this.element.style as any).webkitBackdropFilter = `blur(${blur}px)`;
		} else {
			this.element.style.backdropFilter = "none";
			(this.element.style as any).webkitBackdropFilter = "none";
		}

		this.card.style.background = cardBg;
		this.card.style.border = `1px solid ${accent}55`;
		this.card.style.boxShadow = `0 24px 80px rgba(0, 0, 0, 0.65), 0 0 40px ${accent}25`;

		this.titleEl.style.color = "#ffffff";
		this.titleEl.style.textShadow = `0 0 20px ${accent}80`;
		this.countdownEl.style.color = accent;
	}

	private renderButtons(config: DeathScreenConfig, willRespawn: boolean) {
		this.buttonsContainer.innerHTML = "";
		this.currentButtons = [];

		const accent = config.accentColor || "#ff3b47";
		const buttons = config.buttons && config.buttons.length > 0
			? config.buttons
			: [{ id: "btn_respawn", label: "Reaparecer", action: "respawn" as DeathActionButtonType, isPrimary: true }];

		buttons.forEach((btnData) => {
			if (!willRespawn && btnData.action === "respawn") {
				return;
			}

			const btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = btnData.label;
			btn.dataset.action = btnData.action;
			btn.tabIndex = 0;

			const isPrimary = btnData.isPrimary;
			btn.style.cssText = `
				padding: 10px 22px;
				font-size: 14px;
				font-weight: 700;
				border-radius: 10px;
				cursor: pointer;
				transition: all 0.2s ease;
				outline: none;
				letter-spacing: 0.03em;
				${
					isPrimary
						? `background: ${accent}; color: white; border: 1px solid ${accent}; box-shadow: 0 4px 16px ${accent}40;`
						: `background: rgba(255, 255, 255, 0.1); color: #e5e5e5; border: 1px solid rgba(255, 255, 255, 0.25);`
				}
			`;

			btn.onmouseenter = () => {
				btn.style.transform = "translateY(-2px)";
				btn.style.filter = "brightness(1.15)";
			};
			btn.onmouseleave = () => {
				btn.style.transform = "translateY(0)";
				btn.style.filter = "none";
			};

			btn.onclick = (e) => {
				e.stopPropagation();
				this.triggerAction(btnData.action);
			};

			this.buttonsContainer.appendChild(btn);
			this.currentButtons.push({ button: btn, action: btnData.action, isPrimary: btnData.isPrimary });
		});
	}

	public canRespawnNow(): boolean {
		if (this.isPreviewing) return true;
		if (!this.lastDeathState || !this.lastDeathState.willRespawn) return false;
		if (this.lastDeathState.allowSkipRespawnDelay === true) return true;
		return Date.now() >= this.respawnAt;
	}

	private updateRespawnButtonState() {
		const canRespawn = this.canRespawnNow();
		for (const b of this.currentButtons) {
			if (b.action === "respawn") {
				b.button.disabled = !canRespawn;
				b.button.style.opacity = canRespawn ? "1" : "0.5";
				b.button.style.cursor = canRespawn ? "pointer" : "not-allowed";
				if (canRespawn) {
					b.button.removeAttribute("aria-disabled");
				} else {
					b.button.setAttribute("aria-disabled", "true");
				}
			}
		}
	}

	private triggerAction(action: DeathActionButtonType) {
		if (this.isPreviewing) {
			this.hide();
			return;
		}

		if (action === "respawn" && !this.canRespawnNow()) {
			return;
		}

		const config = this.lastDeathState?.activeMode?.deathScreen;
		const exitType = config?.animations?.exitAnimation || "none";
		const isReduced = config?.accessibility?.reduceMotion || this.animationService.isReducedMotion();

		if (exitType !== "none" && !isReduced && this.element?.style?.display === "flex") {
			this.animationService.animateScreenExit(
				this.element,
				() => {
					this.hide();
					if (this.onActionCallback) {
						this.onActionCallback(action);
					}
				},
				exitType
			);
		} else {
			this.hide();
			if (this.onActionCallback) {
				this.onActionCallback(action);
			}
		}
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		if (this.element.style.display !== "flex") return;

		if (e.key === "Escape" && this.isPreviewing) {
			this.hide();
			return;
		}

		// Tab navigation trap for accessibility
		if (e.key === "Tab" && this.currentButtons.length > 0) {
			const activeEl = document.activeElement;
			const buttons = this.currentButtons.map((b) => b.button);
			const idx = buttons.indexOf(activeEl as any);

			if (e.shiftKey) {
				if (idx <= 0) {
					e.preventDefault();
					buttons[buttons.length - 1].focus();
				}
			} else {
				if (idx === -1 || idx >= buttons.length - 1) {
					e.preventDefault();
					buttons[0].focus();
				}
			}
			return;
		}

		if (e.key === " " || e.key === "Enter") {
			// If focused on a specific button, activate that button
			const focusedBtn = this.currentButtons.find((b) => b.button === document.activeElement);
			if (focusedBtn) {
				e.preventDefault();
				if (focusedBtn.action === "respawn" && !this.canRespawnNow()) return;
				this.triggerAction(focusedBtn.action);
				return;
			}

			// Otherwise activate primary
			const primary = this.currentButtons.find((b) => b.isPrimary) || this.currentButtons[0];
			if (primary) {
				e.preventDefault();
				if (primary.action === "respawn" && !this.canRespawnNow()) return;
				this.triggerAction(primary.action);
			}
		}
	};

	private updateCountdown() {
		const seconds = Math.max(0, (this.respawnAt - Date.now()) / 1000);
		const behavior = this.lastDeathState?.activeMode?.respawnDelayBehavior || "auto";

		if (seconds > 0) {
			this.countdownEl.textContent = behavior === "button"
				? `Espera obligatoria: ${seconds.toFixed(1)} s…`
				: `Reapareciendo en ${seconds.toFixed(1)} s…`;
			if (this.countdownElements.length > 0 && this.lastDeathState) {
				const tempState = { ...this.lastDeathState, respawnDelay: seconds };
				this.countdownElements.forEach((item) => {
					item.el.textContent = evaluateDynamicTokens(item.template, tempState, item.fallback || "");
				});
			}
			this.updateRespawnButtonState();
		} else {
			this.countdownEl.textContent = behavior === "button"
				? "¡Listo para reaparecer!"
				: "Reapareciendo…";
			this.countdownElements.forEach((item) => {
				item.el.textContent = item.fallback || "¡Listo para reaparecer!";
			});
			this.updateRespawnButtonState();
			this.clearCountdown();
		}
	}

	private clearCountdown() {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}

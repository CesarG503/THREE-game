import type {
	DeathScreenConfig,
	DeathState,
	DeathActionButtonType,
	ExperienceModeProfile,
} from "../types/experienceMode.types";

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
	private card: HTMLDivElement;
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

	constructor(onAction?: DeathScreenActionCallback) {
		this.onActionCallback = onAction || null;

		if (typeof document === "undefined") {
			const dummy: any = {
				style: {},
				append: () => {},
				appendChild: () => {},
				remove: () => {},
				dataset: {},
			};
			this.element = dummy;
			this.card = dummy;
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
		this.element.style.cssText = `
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: none;
			align-items: center;
			justify-content: center;
			padding: 24px;
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

		// Central Card
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

		// Handle keydown for quick primary action (e.g. Enter or Space)
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

		// Set text content
		this.titleEl.textContent = config.title || "HAS MUERTO";

		// Context-sensitive subtitle
		if (state.cause === "fall") {
			this.messageEl.textContent = state.context?.details || config.message || "Has caído al vacío.";
		} else {
			this.messageEl.textContent = config.message || "Has sido eliminado de la partida.";
		}

		// Lives status
		if (state.remainingRespawns === -1) {
			this.statusEl.textContent = "Vidas: Infinitas";
		} else if (state.remainingRespawns > 0) {
			this.statusEl.textContent = `Vidas restantes: ${state.remainingRespawns}`;
		} else {
			this.statusEl.textContent = "No te quedan más vidas.";
		}

		// Render action buttons
		this.renderButtons(config, state.willRespawn);

		// Handle respawn countdown
		if (state.willRespawn && state.respawnDelay > 0) {
			this.respawnAt = Date.now() + state.respawnDelay * 1000;
			this.updateCountdown();
			this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
		} else if (state.willRespawn && state.respawnDelay === 0) {
			this.countdownEl.textContent = "Reaparición inmediata disponible";
		} else {
			this.countdownEl.textContent = "";
		}

		this.element.style.display = "flex";
	}

	showPreview(mode: ExperienceModeProfile, previewState: "respawn" | "last_life" | "game_over" = "respawn") {
		this.clearCountdown();
		this.isPreviewing = true;
		if (typeof document === "undefined") {
			return;
		}
		this.previewBanner.style.display = "flex";

		const config = mode.deathScreen;
		this.applyVisualStyles(config);

		this.titleEl.textContent = config.title || "HAS MUERTO";
		this.messageEl.textContent = config.message || "Has sido eliminado de la partida.";

		let willRespawn = true;
		if (previewState === "respawn") {
			this.statusEl.textContent = mode.respawns === -1 ? "Vidas: Infinitas" : `Vidas restantes: ${mode.respawns > 1 ? mode.respawns : 3}`;
			this.respawnAt = Date.now() + Math.max(1, mode.respawnDelay) * 1000;
			this.updateCountdown();
			this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
		} else if (previewState === "last_life") {
			this.statusEl.textContent = "¡ÚLTIMA VIDA RESTANTE! (1 vida restante)";
			this.respawnAt = Date.now() + Math.max(1, mode.respawnDelay) * 1000;
			this.updateCountdown();
			this.intervalId = setInterval(() => this.updateCountdown(), 100) as any;
		} else {
			willRespawn = false;
			this.statusEl.textContent = "No te quedan más vidas. Fin de la partida.";
			this.countdownEl.textContent = "Estado: Partida Finalizada";
		}

		this.renderButtons(config, willRespawn);
		this.element.style.display = "flex";
	}

	hide() {
		this.clearCountdown();
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
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", this.handleKeyDown);
		}
		if (this.element && typeof this.element.remove === "function") {
			this.element.remove();
		}
	}

	private applyVisualStyles(config: DeathScreenConfig) {
		const rawBg = config.backgroundColor || "rgba(13, 15, 23, 0.92)";
		const accent = config.accentColor || "#ff3b47";
		const blur = typeof config.screenBlur === "number" ? config.screenBlur : 12;

		const cardBg = parseToRgba(rawBg, 0.94);
		const overlayCenterBg = parseToRgba(rawBg, 0.85);

		this.element.style.backgroundColor = "rgba(5, 7, 12, 0.90)";
		if (config.backgroundImage) {
			this.element.style.background = `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.85)), url("${config.backgroundImage}") center/cover no-repeat`;
		} else {
			this.element.style.background = `radial-gradient(ellipse at center, ${overlayCenterBg}, rgba(5, 7, 12, 0.97) 80%)`;
		}

		this.element.style.backdropFilter = blur > 0 ? `blur(${blur}px)` : "none";
		(this.element.style as any).webkitBackdropFilter = blur > 0 ? `blur(${blur}px)` : "none";

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
			// If won't respawn and button is respawn, adapt or disable unless restart
			if (!willRespawn && btnData.action === "respawn") {
				return;
			}

			const btn = document.createElement("button");
			btn.textContent = btnData.label;
			btn.dataset.action = btnData.action;

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

	private triggerAction(action: DeathActionButtonType) {
		if (this.isPreviewing) {
			this.hide();
			return;
		}

		if (this.onActionCallback) {
			this.onActionCallback(action);
		}
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		if (this.element.style.display !== "flex") return;

		if (e.key === "Escape" && this.isPreviewing) {
			this.hide();
			return;
		}

		if (e.key === " " || e.key === "Enter") {
			const primary = this.currentButtons.find((b) => b.isPrimary) || this.currentButtons[0];
			if (primary) {
				e.preventDefault();
				this.triggerAction(primary.action);
			}
		}
	};

	private updateCountdown() {
		const seconds = Math.max(0, (this.respawnAt - Date.now()) / 1000);
		if (seconds > 0) {
			this.countdownEl.textContent = `Reapareciendo en ${seconds.toFixed(1)} s…`;
		} else {
			this.countdownEl.textContent = "¡Listo para reaparecer!";
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

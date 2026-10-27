/**
 * VIPER STUDIO PREMIUM — StudioBackgroundManager.ts
 * Gestor avanzado de fondos internos y procedimentales para VIPER.IO.
 * 
 * Capacidades:
 * - 10 Categorías Procedimentales: Competitivo, Battle Royale, Militar, Futurista, Fantasía, Terror, Arcade, Cinemático, Abstracto, Minimalista.
 * - Escena 3D Three.js en vivo (transparente) con control de viñeta, oscurecimiento, desenfoque y desaturación.
 * - Texturas de Skybox oficiales de VIPER.IO (/assets/skybox/Cubemap/Cubemap_Sky_*.png).
 * - Personalizador profundo de fondo (opacidad, blur, desaturación, tinte, encuadre cover/contain/fill).
 * - Restricción de seguridad: no expone importaciones externas arbitrarias sin moderación.
 */

import type {
	DeathScreenBackgroundConfig,
	DeathScreenBackgroundType,
} from "../../types/experienceMode.types";
import { StudioTokens } from "./StudioTokens";
import { renderStudioIcon } from "./StudioIcons";

export type BackgroundCategory =
	| "all"
	| "3d_world"
	| "procedural"
	| "viper_skybox"
	| "competitivo"
	| "battle_royale"
	| "militar"
	| "futurista"
	| "fantasia"
	| "terror"
	| "arcade"
	| "cinematografico"
	| "abstracto"
	| "minimalista";

export interface BackgroundPreset {
	id: string;
	name: string;
	category: BackgroundCategory;
	genre: string;
	type: DeathScreenBackgroundType;
	thumbnail: string; // CSS background or image URL
	config: Partial<DeathScreenBackgroundConfig>;
}

export class StudioBackgroundManager {
	private onUpdateCallback?: (bg: DeathScreenBackgroundConfig) => void;

	// Official in-game VIPER skybox textures
	public static readonly VIPER_SKYBOXES = [
		{ id: "sky_01", name: "Cielo Diurno Despejado", url: "/assets/skybox/Cubemap/Cubemap_Sky_01-512x512.png" },
		{ id: "sky_02", name: "Nebulosa Azul Profundo", url: "/assets/skybox/Cubemap/Cubemap_Sky_02-512x512.png" },
		{ id: "sky_03", name: "Atardecer Espacial", url: "/assets/skybox/Cubemap/Cubemap_Sky_03-512x512.png" },
		{ id: "sky_04", name: "Noche Orbital", url: "/assets/skybox/Cubemap/Cubemap_Sky_04-512x512.png" },
		{ id: "sky_07", name: "Aurora Polar Ciberpunk", url: "/assets/skybox/Cubemap/Cubemap_Sky_07-512x512.png" },
		{ id: "sky_12", name: "Tormenta de Plasma", url: "/assets/skybox/Cubemap/Cubemap_Sky_12-512x512.png" },
		{ id: "sky_15", name: "Estación Espacial Alta", url: "/assets/skybox/Cubemap/Cubemap_Sky_15-512x512.png" },
		{ id: "sky_20", name: "Vacío Interestelar", url: "/assets/skybox/Cubemap/Cubemap_Sky_20-512x512.png" },
	];

	// Curated Presets across the 10 requested genres + 3D scene modes
	public static readonly PRESETS: BackgroundPreset[] = [
		// --- 1. Three.js 3D World (En Vivo) ---
		{
			id: "bg_3d_vignette",
			name: "Viñeta Táctica (3D Transparente)",
			category: "3d_world",
			genre: "Three.js 3D",
			type: "gradient",
			thumbnail: "radial-gradient(circle at center, transparent 35%, rgba(5,7,11,0.92) 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at center, rgba(5,7,11,0.1) 25%, rgba(5,7,11,0.94) 100%)",
				color: "transparent",
				overlayOpacity: 0.25,
				backdropBlur: 4,
			},
		},
		{
			id: "bg_3d_pure",
			name: "Escena 3D Pura (Sin Filtro)",
			category: "3d_world",
			genre: "Three.js 3D",
			type: "color",
			thumbnail: "repeating-conic-gradient(#1a1f2c 0% 25%, #0f131a 0% 50%) 50% / 12px 12px",
			config: {
				type: "color",
				color: "transparent",
				overlayOpacity: 0,
				backdropBlur: 0,
			},
		},
		{
			id: "bg_3d_desaturated",
			name: "3D Desaturado & Enfocado",
			category: "3d_world",
			genre: "Three.js 3D",
			type: "gradient",
			thumbnail: "radial-gradient(circle, rgba(15,18,24,0.4) 0%, rgba(5,7,11,0.95) 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle, rgba(15,18,24,0.35) 0%, rgba(5,7,11,0.95) 100%)",
				color: "transparent",
				overlayOpacity: 0.4,
				backdropBlur: 8,
				desaturation: 80,
			},
		},

		// --- 2. Competitivo (eSports / Torneo) ---
		{
			id: "bg_proc_competitivo",
			name: "Competitivo eSports Táctico",
			category: "competitivo",
			genre: "Competitivo",
			type: "gradient",
			thumbnail: "repeating-linear-gradient(0deg, #090e17 0px, #090e17 2px, #0d1522 2px, #0d1522 4px)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(ellipse at 50% 20%, rgba(0, 210, 255, 0.08) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(5,8,14,0.95) 0px, rgba(5,8,14,0.95) 2px, rgba(12,18,28,0.95) 2px, rgba(12,18,28,0.95) 4px)",
				overlayColor: "rgba(3, 7, 12, 0.6)",
				overlayOpacity: 0.6,
			},
		},

		// --- 3. Battle Royale (Zona de Tormenta) ---
		{
			id: "bg_proc_battleroyale",
			name: "Zona de Tormenta / Radiación",
			category: "battle_royale",
			genre: "Battle Royale",
			type: "gradient",
			thumbnail: "radial-gradient(circle at 50% 50%, #060b14 25%, #2a0833 70%, #ff0055 120%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 50%, rgba(5, 9, 15, 0.88) 30%, rgba(38, 8, 48, 0.94) 75%, rgba(255, 0, 85, 0.3) 120%)",
				overlayColor: "rgba(5, 7, 12, 0.5)",
				overlayOpacity: 0.5,
				vignette: true,
			},
		},

		// --- 4. Militar (Balística / Camuflaje Nocturno) ---
		{
			id: "bg_proc_militar",
			name: "Militar Operación Nocturna",
			category: "militar",
			genre: "Militar",
			type: "gradient",
			thumbnail: "linear-gradient(135deg, #0d120f 0%, #17201a 50%, #0a0d0a 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 30%, rgba(35, 52, 40, 0.25) 0%, transparent 70%), linear-gradient(135deg, #080c09 0%, #121a14 50%, #060906 100%)",
				overlayColor: "rgba(4, 7, 5, 0.55)",
				overlayOpacity: 0.55,
			},
		},

		// --- 5. Futurista (Ciberespacio / Malla Vectorial) ---
		{
			id: "bg_proc_futurista",
			name: "Ciberespacio Hiperred",
			category: "futurista",
			genre: "Futurista",
			type: "gradient",
			thumbnail: "linear-gradient(135deg, #060d1a 0%, #0a1f3d 50%, #15092a 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 80% 20%, rgba(0, 210, 255, 0.18) 0%, transparent 55%), radial-gradient(circle at 20% 80%, rgba(150, 0, 255, 0.15) 0%, transparent 55%), linear-gradient(135deg, #050a14 0%, #09172a 50%, #110722 100%)",
				overlayColor: "rgba(4, 8, 16, 0.5)",
				overlayOpacity: 0.5,
			},
		},

		// --- 6. Fantasía (Niebla de Almas / Runas) ---
		{
			id: "bg_proc_fantasia",
			name: "Niebla de Almas Espectrales",
			category: "fantasia",
			genre: "Fantasía",
			type: "gradient",
			thumbnail: "radial-gradient(circle at 50% 40%, #1c0e2d 0%, #090511 80%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 40%, rgba(68, 25, 110, 0.35) 0%, rgba(18, 8, 30, 0.95) 70%, #050308 100%)",
				overlayColor: "rgba(8, 3, 14, 0.45)",
				overlayOpacity: 0.45,
			},
		},

		// --- 7. Terror (Aberración & Sangre Carmesí) ---
		{
			id: "bg_proc_terror",
			name: "Corrupción Carmesí / VHS",
			category: "terror",
			genre: "Terror",
			type: "gradient",
			thumbnail: "radial-gradient(circle at 50% 50%, #200407 0%, #080102 85%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 50%, rgba(60, 8, 14, 0.4) 0%, rgba(20, 2, 4, 0.95) 75%, #050001 100%)",
				overlayColor: "rgba(12, 1, 3, 0.6)",
				overlayOpacity: 0.6,
			},
		},

		// --- 8. Retro Arcade (Synthwave Scanlines) ---
		{
			id: "bg_proc_arcade",
			name: "Synthwave Retro 80s",
			category: "arcade",
			genre: "Arcade",
			type: "animated",
			thumbnail: "repeating-linear-gradient(0deg, #10081d 0px, #10081d 2px, #1c0f32 2px, #1c0f32 4px)",
			config: {
				type: "animated",
				color: "#0a0412",
				gradient: "linear-gradient(180deg, #090312 0%, #1b0a2c 60%, #ff007722 90%, #040108 100%)",
				animation: {
					enabled: true,
					type: "scanlines",
					duration: 3500,
					intensity: 0.75,
				},
				overlayOpacity: 0.35,
			},
		},

		// --- 9. Cinematográfico (Panavision Anamórfico) ---
		{
			id: "bg_proc_cinematografico",
			name: "Cinemática Panavision 2.39:1",
			category: "cinematografico",
			genre: "Cinematográfico",
			type: "gradient",
			thumbnail: "linear-gradient(180deg, #000 12%, #0d121c 12%, #0d121c 88%, #000 88%)",
			config: {
				type: "gradient",
				gradient: "linear-gradient(180deg, #000000 12%, rgba(10, 15, 23, 0.95) 12%, rgba(15, 22, 34, 0.95) 50%, rgba(8, 12, 19, 0.95) 88%, #000000 88%)",
				overlayColor: "rgba(4, 6, 10, 0.4)",
				overlayOpacity: 0.4,
				vignette: true,
			},
		},

		// --- 10. Abstracto (Voronoi Poliedro) ---
		{
			id: "bg_proc_abstracto",
			name: "Geometría Angular Voronoi",
			category: "abstracto",
			genre: "Abstracto",
			type: "gradient",
			thumbnail: "linear-gradient(115deg, #0e1520 0%, #141f2e 40%, #080b10 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 30% 70%, rgba(0, 210, 255, 0.12) 0%, transparent 60%), linear-gradient(115deg, #0b111a 0%, #162234 45%, #070a0e 100%)",
				overlayColor: "rgba(5, 8, 12, 0.45)",
				overlayOpacity: 0.45,
			},
		},

		// --- 11. Minimalista (Obsidiana Mate Neutra) ---
		{
			id: "bg_proc_minimalista",
			name: "Minimalismo Obsidiana Mate",
			category: "minimalista",
			genre: "Minimalista",
			type: "gradient",
			thumbnail: "radial-gradient(circle at 50% 20%, #131720 0%, #090b0e 90%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 20%, #12161f 0%, #08090d 95%)",
				color: "#08090d",
				overlayOpacity: 0.2,
			},
		},
	];

	constructor(onUpdate?: (bg: DeathScreenBackgroundConfig) => void) {
		this.onUpdateCallback = onUpdate;
	}

	/**
	 * Renders the compact dedicated Background panel inside the Studio's left sidebar.
	 */
	public renderSidebarPanel(
		container: HTMLElement,
		currentBg: DeathScreenBackgroundConfig,
		onApply: (bg: DeathScreenBackgroundConfig) => void
	) {
		container.innerHTML = "";

		const wrap = document.createElement("div");
		wrap.style.cssText = "display: flex; flex-direction: column; gap: 14px; padding: 12px;";

		// Quick Gallery Modal Launcher
		const galleryBtn = document.createElement("button");
		galleryBtn.type = "button";
		galleryBtn.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			width: 100%;
			padding: 8px 12px;
			background: ${StudioTokens.colors.surface3};
			color: ${StudioTokens.colors.accent};
			border: 1px solid ${StudioTokens.colors.accentBorder};
			border-radius: ${StudioTokens.radii.sm};
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			cursor: pointer;
			transition: ${StudioTokens.transitions.fast};
		`;
		galleryBtn.innerHTML = `${renderStudioIcon("palette", 14, StudioTokens.colors.accent)} <span>Explorar Galería Completa</span>`;
		galleryBtn.onclick = () => this.openGalleryModal(currentBg, onApply);
		wrap.appendChild(galleryBtn);

		// Section: Personalizador Profundo
		const customBox = document.createElement("div");
		customBox.style.cssText = `
			background: ${StudioTokens.colors.surface2};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			border-radius: ${StudioTokens.radii.sm};
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		`;

		const customTitle = document.createElement("span");
		customTitle.textContent = "PERSONALIZADOR DEL FONDO ACTIVO";
		customTitle.style.cssText = `font-size: 10px; font-weight: 700; color: ${StudioTokens.colors.accent}; letter-spacing: 0.5px;`;
		customBox.appendChild(customTitle);

		// 1. Overlay Darkness Slider
		const overlayWrap = document.createElement("div");
		overlayWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const overlayLabelRow = document.createElement("div");
		overlayLabelRow.style.cssText = "display: flex; justify-content: space-between; font-size: 11px; color: " + StudioTokens.colors.textSecondary;
		const curOpacityPct = Math.round((currentBg.overlayOpacity ?? 0.6) * 100);
		overlayLabelRow.innerHTML = `<span>Oscurecimiento Overlay</span><span id="bg_overlay_val" style="font-family:${StudioTokens.typography.fontMono}; color:${StudioTokens.colors.accent};">${curOpacityPct}%</span>`;
		
		const overlaySlider = document.createElement("input");
		overlaySlider.type = "range";
		overlaySlider.min = "0";
		overlaySlider.max = "100";
		overlaySlider.value = String(curOpacityPct);
		overlaySlider.style.cssText = "width: 100%; cursor: pointer;";
		overlaySlider.oninput = () => {
			const val = parseInt(overlaySlider.value, 10);
			const disp = overlayWrap.querySelector("#bg_overlay_val");
			if (disp) disp.textContent = `${val}%`;
			currentBg.overlayOpacity = val / 100;
			onApply(currentBg);
		};
		overlayWrap.append(overlayLabelRow, overlaySlider);
		customBox.appendChild(overlayWrap);

		// 2. Backdrop Blur Slider
		const blurWrap = document.createElement("div");
		blurWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const blurLabelRow = document.createElement("div");
		blurLabelRow.style.cssText = "display: flex; justify-content: space-between; font-size: 11px; color: " + StudioTokens.colors.textSecondary;
		const curBlur = currentBg.backdropBlur ?? 0;
		blurLabelRow.innerHTML = `<span>Desenfoque (Blur)</span><span id="bg_blur_val" style="font-family:${StudioTokens.typography.fontMono}; color:${StudioTokens.colors.accent};">${curBlur}px</span>`;

		const blurSlider = document.createElement("input");
		blurSlider.type = "range";
		blurSlider.min = "0";
		blurSlider.max = "20";
		blurSlider.value = String(curBlur);
		blurSlider.style.cssText = "width: 100%; cursor: pointer;";
		blurSlider.oninput = () => {
			const val = parseInt(blurSlider.value, 10);
			const disp = blurWrap.querySelector("#bg_blur_val");
			if (disp) disp.textContent = `${val}px`;
			currentBg.backdropBlur = val;
			onApply(currentBg);
		};
		blurWrap.append(blurLabelRow, blurSlider);
		customBox.appendChild(blurWrap);

		// 3. Desaturation Slider
		const desatWrap = document.createElement("div");
		desatWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		const desatLabelRow = document.createElement("div");
		desatLabelRow.style.cssText = "display: flex; justify-content: space-between; font-size: 11px; color: " + StudioTokens.colors.textSecondary;
		const curDesat = currentBg.desaturation ?? 0;
		desatLabelRow.innerHTML = `<span>Desaturación (Grises)</span><span id="bg_desat_val" style="font-family:${StudioTokens.typography.fontMono}; color:${StudioTokens.colors.accent};">${curDesat}%</span>`;

		const desatSlider = document.createElement("input");
		desatSlider.type = "range";
		desatSlider.min = "0";
		desatSlider.max = "100";
		desatSlider.value = String(curDesat);
		desatSlider.style.cssText = "width: 100%; cursor: pointer;";
		desatSlider.oninput = () => {
			const val = parseInt(desatSlider.value, 10);
			const disp = desatWrap.querySelector("#bg_desat_val");
			if (disp) disp.textContent = `${val}%`;
			currentBg.desaturation = val;
			onApply(currentBg);
		};
		desatWrap.append(desatLabelRow, desatSlider);
		customBox.appendChild(desatWrap);

		// 4. Image Fit / Encuadre
		const fitWrap = document.createElement("div");
		fitWrap.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
		const fitLbl = document.createElement("span");
		fitLbl.textContent = "Encuadre Textura";
		fitLbl.style.cssText = `font-size: 11px; color: ${StudioTokens.colors.textSecondary};`;
		const fitSel = document.createElement("select");
		fitSel.style.cssText = `
			background: ${StudioTokens.colors.surface1};
			color: ${StudioTokens.colors.textPrimary};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			border-radius: ${StudioTokens.radii.sm};
			padding: 2px 6px;
			font-size: 11px;
			outline: none;
		`;
		["cover", "contain", "fill"].forEach((f) => {
			const opt = document.createElement("option");
			opt.value = f;
			opt.textContent = f.toUpperCase();
			if ((currentBg.imageFit || "cover") === f) opt.selected = true;
			fitSel.appendChild(opt);
		});
		fitSel.onchange = () => {
			currentBg.imageFit = fitSel.value as any;
			onApply(currentBg);
		};
		fitWrap.append(fitLbl, fitSel);
		customBox.appendChild(fitWrap);

		wrap.appendChild(customBox);

		// Section: Presets Rápidos
		const presetsTitle = document.createElement("span");
		presetsTitle.textContent = "PRESETS DESTACADOS";
		presetsTitle.style.cssText = `font-size: 10px; font-weight: 700; color: ${StudioTokens.colors.textMuted}; letter-spacing: 0.5px;`;
		wrap.appendChild(presetsTitle);

		const cardsGrid = document.createElement("div");
		cardsGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px;";

		// Show 8 diverse representative presets in quick cards
		const quickPresets = [
			StudioBackgroundManager.PRESETS[0], // Viñeta 3D
			StudioBackgroundManager.PRESETS[1], // 3D Pure
			StudioBackgroundManager.PRESETS[3], // Competitivo
			StudioBackgroundManager.PRESETS[4], // Battle Royale
			StudioBackgroundManager.PRESETS[5], // Militar
			StudioBackgroundManager.PRESETS[6], // Futurista
			StudioBackgroundManager.PRESETS[8], // Terror
			StudioBackgroundManager.PRESETS[9], // Arcade
		];

		quickPresets.forEach((p) => {
			const card = document.createElement("div");
			card.style.cssText = `
				height: 70px;
				background: ${p.thumbnail};
				background-size: cover;
				background-position: center;
				border: 1px solid ${StudioTokens.colors.borderSubtle};
				border-radius: ${StudioTokens.radii.sm};
				cursor: pointer;
				position: relative;
				overflow: hidden;
				display: flex;
				align-items: flex-end;
				padding: 5px;
				box-sizing: border-box;
				transition: ${StudioTokens.transitions.fast};
			`;
			card.onmouseenter = () => { card.style.borderColor = StudioTokens.colors.accent; };
			card.onmouseleave = () => { card.style.borderColor = StudioTokens.colors.borderSubtle; };

			const lbl = document.createElement("span");
			lbl.textContent = p.name;
			lbl.style.cssText = `
				font-size: 9px;
				font-weight: 600;
				color: #fff;
				background: rgba(9, 11, 14, 0.85);
				padding: 2px 5px;
				border-radius: 3px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				width: 100%;
			`;
			card.appendChild(lbl);

			card.onclick = () => {
				const updated: DeathScreenBackgroundConfig = {
					...currentBg,
					...p.config,
				};
				onApply(updated);
				this.renderSidebarPanel(container, updated, onApply);
			};

			cardsGrid.appendChild(card);
		});

		wrap.appendChild(cardsGrid);
		container.appendChild(wrap);
	}

	/**
	 * Full Modal Gallery with all 10 procedural genres and in-game VIPER skyboxes.
	 */
	public openGalleryModal(
		currentBg: DeathScreenBackgroundConfig,
		onApply: (bg: DeathScreenBackgroundConfig) => void
	) {
		if (typeof document === "undefined") return;

		const modalOverlay = document.createElement("div");
		modalOverlay.className = "studio-gallery-modal-overlay";
		modalOverlay.style.cssText = `
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.78);
			backdrop-filter: blur(8px);
			z-index: 10000000;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
		`;

		const modal = document.createElement("div");
		modal.style.cssText = `
			width: 900px;
			max-width: 95vw;
			height: 640px;
			max-height: 90vh;
			background: ${StudioTokens.colors.surface1};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			border-radius: ${StudioTokens.radii.lg};
			box-shadow: ${StudioTokens.shadows.modal};
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;

		// Header
		const header = document.createElement("div");
		header.style.cssText = `
			padding: 14px 20px;
			background: ${StudioTokens.colors.surface2};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
		`;
		header.innerHTML = `
			<div style="display:flex; align-items:center; gap:8px;">
				${renderStudioIcon("palette", 16, StudioTokens.colors.accent)}
				<strong style="color:${StudioTokens.colors.textPrimary}; font-size:${StudioTokens.typography.sizeLg};">Galería de Fondos Oficiales e Internos</strong>
			</div>
		`;
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.style.cssText = `
			background: transparent;
			border: none;
			color: ${StudioTokens.colors.textSecondary};
			cursor: pointer;
			padding: 4px;
			border-radius: ${StudioTokens.radii.sm};
			display: flex;
			align-items: center;
		`;
		closeBtn.innerHTML = renderStudioIcon("x", 16);
		closeBtn.onclick = () => modalOverlay.remove();
		header.appendChild(closeBtn);
		modal.appendChild(header);

		// Category Tabs Bar
		const tabsBar = document.createElement("div");
		tabsBar.style.cssText = `
			padding: 8px 16px;
			background: ${StudioTokens.colors.surface1};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			gap: 6px;
			overflow-x: auto;
			scrollbar-width: none;
		`;

		let activeTab: string = "all";

		const tabs = [
			{ id: "all", label: "Todos los Fondos" },
			{ id: "3d_world", label: "Escena 3D Live" },
			{ id: "viper_skybox", label: "Skyboxes VIPER" },
			{ id: "competitivo", label: "Competitivo" },
			{ id: "battle_royale", label: "Battle Royale" },
			{ id: "militar", label: "Militar" },
			{ id: "futurista", label: "Futurista" },
			{ id: "fantasia", label: "Fantasía" },
			{ id: "terror", label: "Terror" },
			{ id: "arcade", label: "Retro Arcade" },
			{ id: "cinematografico", label: "Cinemático" },
			{ id: "abstracto", label: "Abstracto" },
			{ id: "minimalista", label: "Minimalista" },
		];

		const gridContainer = document.createElement("div");
		gridContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			grid-gap: 14px;
			background: ${StudioTokens.colors.surfaceBase};
		`;

		const renderGrid = () => {
			gridContainer.innerHTML = "";

			const allItems: BackgroundPreset[] = [...StudioBackgroundManager.PRESETS];

			// Add VIPER Skyboxes
			StudioBackgroundManager.VIPER_SKYBOXES.forEach((sky) => {
				allItems.push({
					id: `sky_${sky.id}`,
					name: sky.name,
					category: "viper_skybox",
					genre: "Skybox",
					type: "image",
					thumbnail: `url("${sky.url}")`,
					config: {
						type: "image",
						imageUrl: sky.url,
						imageFit: "cover",
						imagePosition: "center",
						overlayOpacity: 0.65,
					},
				});
			});

			const filtered = allItems.filter((item) => {
				if (activeTab === "all") return true;
				return item.category === activeTab;
			});

			filtered.forEach((preset) => {
				const card = document.createElement("div");
				card.style.cssText = `
					background: ${StudioTokens.colors.surface2};
					border: 1px solid ${StudioTokens.colors.borderSubtle};
					border-radius: ${StudioTokens.radii.md};
					overflow: hidden;
					cursor: pointer;
					transition: ${StudioTokens.transitions.fast};
					display: flex;
					flex-direction: column;
				`;
				card.onmouseenter = () => {
					card.style.borderColor = StudioTokens.colors.accent;
					card.style.transform = "translateY(-2px)";
				};
				card.onmouseleave = () => {
					card.style.borderColor = StudioTokens.colors.borderSubtle;
					card.style.transform = "translateY(0)";
				};

				const thumb = document.createElement("div");
				thumb.style.cssText = `
					height: 105px;
					width: 100%;
					background: ${preset.thumbnail};
					background-size: cover;
					background-position: center;
					border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
				`;

				const info = document.createElement("div");
				info.style.cssText = "padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;";
				info.innerHTML = `
					<span style="font-size:${StudioTokens.typography.sizeSm}; font-weight:600; color:${StudioTokens.colors.textPrimary}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preset.name}</span>
					<span style="font-size:10px; color:${StudioTokens.colors.textMuted}; text-transform:uppercase;">${preset.genre}</span>
				`;

				card.append(thumb, info);
				card.onclick = () => {
					const updated: DeathScreenBackgroundConfig = {
						...currentBg,
						...preset.config,
					};
					onApply(updated);
					modalOverlay.remove();
				};

				gridContainer.appendChild(card);
			});
		};

		tabs.forEach((t) => {
			const b = document.createElement("button");
			b.type = "button";
			b.textContent = t.label;
			b.style.cssText = `
				padding: 4px 10px;
				font-size: 11px;
				border-radius: ${StudioTokens.radii.sm};
				border: 1px solid ${activeTab === t.id ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
				background: ${activeTab === t.id ? StudioTokens.colors.surface3 : "transparent"};
				color: ${activeTab === t.id ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
				cursor: pointer;
				white-space: nowrap;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.onclick = () => {
				activeTab = t.id;
				tabsBar.querySelectorAll("button").forEach((btn, idx) => {
					const isA = tabs[idx].id === activeTab;
					btn.style.borderColor = isA ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle;
					btn.style.background = isA ? StudioTokens.colors.surface3 : "transparent";
					btn.style.color = isA ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
				});
				renderGrid();
			};
			tabsBar.appendChild(b);
		});

		modal.append(tabsBar, gridContainer);
		modalOverlay.appendChild(modal);
		modalOverlay.onclick = (e) => {
			if (e.target === modalOverlay) modalOverlay.remove();
		};

		document.body.appendChild(modalOverlay);
		renderGrid();
	}
}

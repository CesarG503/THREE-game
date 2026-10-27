/**
 * VIPER STUDIO PREMIUM — StudioBackgroundManager.ts
 * Gestor avanzado de fondos: transparente, colores sólidos, gradientes, texturas VIPER,
 * patrones CSS optimizados, animaciones e importación funcional de archivos del usuario.
 */

import type {
	DeathScreenBackgroundConfig,
	DeathScreenBackgroundType,
	DeathScreenBgAnimationType,
} from "../../types/experienceMode.types";
import { StudioTokens } from "./StudioTokens";
import { renderStudioIcon } from "./StudioIcons";

export interface BackgroundPreset {
	id: string;
	name: string;
	category: "vignette" | "gradient" | "viper_textures" | "patterns" | "custom";
	type: DeathScreenBackgroundType;
	thumbnail: string; // CSS background or image URL
	config: Partial<DeathScreenBackgroundConfig>;
}

export class StudioBackgroundManager {
	private customUserBackgrounds: BackgroundPreset[] = [];
	private onUpdateCallback?: (bg: DeathScreenBackgroundConfig) => void;

	// In-game VIPER skybox textures available locally
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

	// Curated Presets
	public static readonly PRESETS: BackgroundPreset[] = [
		// 1. Transparent / Vignette
		{
			id: "bg_trans_vignette",
			name: "Viñeta Táctica (3D Transparente)",
			category: "vignette",
			type: "gradient",
			thumbnail: "radial-gradient(circle at center, transparent 30%, rgba(5,7,11,0.95) 100%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at center, rgba(5,7,11,0.2) 20%, rgba(5,7,11,0.95) 100%)",
				color: "transparent",
				overlayOpacity: 0.3,
			},
		},
		{
			id: "bg_trans_pure",
			name: "Transparente Total (Three.js puro)",
			category: "vignette",
			type: "color",
			thumbnail: "repeating-conic-gradient(#1a1f2c 0% 25%, #0f131a 0% 50%) 50% / 12px 12px",
			config: {
				type: "color",
				color: "transparent",
				overlayOpacity: 0,
			},
		},
		// 2. Gradients
		{
			id: "bg_grad_cyberpunk",
			name: "Ciberpunk Neón Cian-Magenta",
			category: "gradient",
			type: "gradient",
			thumbnail: "linear-gradient(135deg, #091322 0%, #032030 45%, #2a0822 100%)",
			config: {
				type: "gradient",
				gradient: "linear-gradient(135deg, #070e17 0%, #082132 50%, #20081d 100%)",
				overlayColor: "rgba(0, 0, 0, 0.4)",
				overlayOpacity: 0.4,
			},
		},
		{
			id: "bg_grad_abyss",
			name: "Abismo Obsidiana",
			category: "gradient",
			type: "gradient",
			thumbnail: "radial-gradient(circle at 50% 30%, #161e2e 0%, #080a0f 80%)",
			config: {
				type: "gradient",
				gradient: "radial-gradient(circle at 50% 30%, #161e2e 0%, #080a0f 80%)",
				overlayOpacity: 0.5,
			},
		},
		{
			id: "bg_grad_inferno",
			name: "Resplandor Sangriento / Fuego",
			category: "gradient",
			type: "gradient",
			thumbnail: "linear-gradient(180deg, #1f080c 0%, #2c0e14 60%, #0a0305 100%)",
			config: {
				type: "gradient",
				gradient: "linear-gradient(180deg, #1f080c 0%, #2c0e14 60%, #0a0305 100%)",
				overlayOpacity: 0.4,
			},
		},
		{
			id: "bg_grad_orbital",
			name: "Horizonte Orbital",
			category: "gradient",
			type: "gradient",
			thumbnail: "linear-gradient(180deg, #040812 0%, #091a32 55%, #00d2ff22 90%, #02050b 100%)",
			config: {
				type: "gradient",
				gradient: "linear-gradient(180deg, #040812 0%, #091a32 55%, #00d2ff22 90%, #02050b 100%)",
				overlayOpacity: 0.5,
			},
		},
		// 3. Patterns
		{
			id: "bg_pat_scanlines",
			name: "CRT Retro Scanlines",
			category: "patterns",
			type: "animated",
			thumbnail: "repeating-linear-gradient(0deg, #11141c 0px, #11141c 2px, #1a202c 2px, #1a202c 4px)",
			config: {
				type: "animated",
				color: "#0a0c10",
				animation: {
					enabled: true,
					type: "scanlines",
					duration: 4000,
					intensity: 0.8,
				},
				overlayOpacity: 0.3,
			},
		},
		{
			id: "bg_pat_carbon",
			name: "Malla de Fibra de Carbono",
			category: "patterns",
			type: "gradient",
			thumbnail: "radial-gradient(black 15%, transparent 16%) 0 0, radial-gradient(black 15%, transparent 16%) 6px 6px, radial-gradient(rgba(255,255,255,.08) 15%, transparent 20%) 0 1px, radial-gradient(rgba(255,255,255,.08) 15%, transparent 20%) 6px 7px #141720",
			config: {
				type: "gradient",
				gradient: "radial-gradient(rgba(0,0,0,0.8) 15%, transparent 16%) 0 0, radial-gradient(rgba(0,0,0,0.8) 15%, transparent 16%) 6px 6px, #10131a",
				overlayOpacity: 0.5,
			},
		},
	];

	constructor(onUpdate?: (bg: DeathScreenBackgroundConfig) => void) {
		this.onUpdateCallback = onUpdate;
		this.loadCustomUserBackgrounds();
	}

	private loadCustomUserBackgrounds() {
		try {
			if (typeof localStorage !== "undefined") {
				const saved = localStorage.getItem("viper_studio_user_backgrounds");
				if (saved) {
					this.customUserBackgrounds = JSON.parse(saved);
				}
			}
		} catch (e) {
			console.warn("Could not load user backgrounds:", e);
		}
	}

	private saveCustomUserBackgrounds() {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("viper_studio_user_backgrounds", JSON.stringify(this.customUserBackgrounds));
			}
		} catch (e) {
			console.warn("Could not save user backgrounds:", e);
		}
	}

	/**
	 * Opens a native file dialog to import a local background image,
	 * downscaling it if needed to preserve GPU/RAM memory.
	 */
	public importLocalImage(onSuccess: (dataUrl: string, name: string) => void) {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
		input.style.display = "none";
		document.body.appendChild(input);

		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) {
				input.remove();
				return;
			}

			const reader = new FileReader();
			reader.onload = (loadEv) => {
				const rawUrl = loadEv.target?.result as string;
				if (!rawUrl) {
					input.remove();
					return;
				}

				// Optimize and downscale via an offscreen HTMLCanvas to avoid memory waste
				const img = new Image();
				img.onload = () => {
					const MAX_W = 1920;
					const MAX_H = 1080;
					let w = img.width;
					let h = img.height;

					if (w > MAX_W || h > MAX_H) {
						const ratio = Math.min(MAX_W / w, MAX_H / h);
						w = Math.round(w * ratio);
						h = Math.round(h * ratio);
					}

					const canvas = document.createElement("canvas");
					canvas.width = w;
					canvas.height = h;
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.drawImage(img, 0, 0, w, h);
						const optimizedDataUrl = canvas.toDataURL("image/webp", 0.88);
						const newPreset: BackgroundPreset = {
							id: `user_bg_${Date.now()}`,
							name: file.name.replace(/\.[^/.]+$/, "") || "Fondo Importado",
							category: "custom",
							type: "image",
							thumbnail: `url("${optimizedDataUrl}")`,
							config: {
								type: "image",
								imageUrl: optimizedDataUrl,
								imageFit: "cover",
								imagePosition: "center",
								overlayOpacity: 0.5,
							},
						};
						this.customUserBackgrounds.unshift(newPreset);
						this.saveCustomUserBackgrounds();
						onSuccess(optimizedDataUrl, newPreset.name);
					} else {
						onSuccess(rawUrl, file.name);
					}
					input.remove();
				};
				img.src = rawUrl;
			};
			reader.readAsDataURL(file);
		};

		input.click();
	}

	/**
	 * Builds an interactive visual gallery modal/drawer to pick and configure backgrounds.
	 */
	public openGalleryModal(
		currentBg: DeathScreenBackgroundConfig,
		onApply: (newBg: DeathScreenBackgroundConfig) => void
	) {
		const modalOverlay = document.createElement("div");
		modalOverlay.className = "studio-bg-gallery-overlay";
		modalOverlay.style.cssText = `
			position: fixed;
			inset: 0;
			background: rgba(5, 7, 10, 0.85);
			backdrop-filter: blur(8px);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 100000;
			animation: studioFadeIn 0.15s ease-out;
		`;

		const modal = document.createElement("div");
		modal.className = "studio-bg-gallery-modal";
		modal.style.cssText = `
			width: 820px;
			max-width: 95vw;
			height: 600px;
			max-height: 90vh;
			background: ${StudioTokens.colors.surface1};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			border-radius: ${StudioTokens.radii.lg};
			box-shadow: ${StudioTokens.shadows.dropdown};
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;

		// 1. Header
		const header = document.createElement("div");
		header.style.cssText = `
			height: 48px;
			padding: 0 16px;
			background: ${StudioTokens.colors.surface2};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
		`;
		header.innerHTML = `
			<div style="display:flex; align-items:center; gap:8px;">
				${renderStudioIcon("palette", 16, StudioTokens.colors.accent)}
				<strong style="color:${StudioTokens.colors.textPrimary}; font-size:${StudioTokens.typography.sizeLg};">Gestor de Fondos VIPER</strong>
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

		// 2. Toolbar & Category Tabs
		const toolbar = document.createElement("div");
		toolbar.style.cssText = `
			padding: 10px 16px;
			background: ${StudioTokens.colors.surface1};
			border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		`;

		const tabContainer = document.createElement("div");
		tabContainer.style.cssText = "display: flex; gap: 6px;";

		let activeTab: "all" | "gradient" | "viper_textures" | "patterns" | "custom" = "all";

		const tabs = [
			{ id: "all", label: "Todos" },
			{ id: "gradient", label: "Gradientes y Color" },
			{ id: "viper_textures", label: "Texturas VIPER" },
			{ id: "patterns", label: "Patrones Tácticos" },
			{ id: "custom", label: "Mis Fondos" },
		];

		const gridContainer = document.createElement("div");
		gridContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
			grid-gap: 14px;
			background: ${StudioTokens.colors.surfaceBase};
		`;

		const renderGrid = () => {
			gridContainer.innerHTML = "";

			// Combine built-in presets + VIPER skyboxes + user imported backgrounds
			const allItems: BackgroundPreset[] = [...StudioBackgroundManager.PRESETS];

			// Add VIPER Skyboxes
			StudioBackgroundManager.VIPER_SKYBOXES.forEach((sky) => {
				allItems.push({
					id: `sky_${sky.id}`,
					name: sky.name,
					category: "viper_textures",
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

			// Add custom user backgrounds
			this.customUserBackgrounds.forEach((usr) => allItems.push(usr));

			const filtered = allItems.filter((item) => {
				if (activeTab === "all") return true;
				if (activeTab === "custom") return item.category === "custom";
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
					height: 100px;
					width: 100%;
					background: ${preset.thumbnail};
					background-size: cover;
					background-position: center;
					border-bottom: 1px solid ${StudioTokens.colors.borderSubtle};
				`;

				const info = document.createElement("div");
				info.style.cssText = `padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;`;
				info.innerHTML = `
					<span style="font-size:${StudioTokens.typography.sizeSm}; font-weight:600; color:${StudioTokens.colors.textPrimary}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preset.name}</span>
					<span style="font-size:${StudioTokens.typography.sizeXs}; color:${StudioTokens.colors.textMuted}; text-transform:uppercase;">${preset.type}</span>
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
				padding: 5px 10px;
				font-size: ${StudioTokens.typography.sizeSm};
				border-radius: ${StudioTokens.radii.sm};
				border: 1px solid ${activeTab === t.id ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle};
				background: ${activeTab === t.id ? StudioTokens.colors.surface3 : "transparent"};
				color: ${activeTab === t.id ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary};
				cursor: pointer;
				transition: ${StudioTokens.transitions.fast};
			`;
			b.onclick = () => {
				activeTab = t.id as any;
				tabContainer.querySelectorAll("button").forEach((btn, idx) => {
					const isA = tabs[idx].id === activeTab;
					btn.style.borderColor = isA ? StudioTokens.colors.accent : StudioTokens.colors.borderSubtle;
					btn.style.background = isA ? StudioTokens.colors.surface3 : "transparent";
					btn.style.color = isA ? StudioTokens.colors.accent : StudioTokens.colors.textSecondary;
				});
				renderGrid();
			};
			tabContainer.appendChild(b);
		});

		// Import local button
		const importBtn = document.createElement("button");
		importBtn.type = "button";
		importBtn.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 5px 12px;
			font-size: ${StudioTokens.typography.sizeSm};
			font-weight: 600;
			background: ${StudioTokens.colors.accent};
			color: #090b0e;
			border: none;
			border-radius: ${StudioTokens.radii.sm};
			cursor: pointer;
			transition: ${StudioTokens.transitions.fast};
		`;
		importBtn.innerHTML = `${renderStudioIcon("upload", 14, "#090b0e")} <span>Importar Archivo</span>`;
		importBtn.onclick = () => {
			this.importLocalImage((dataUrl, name) => {
				const importedBg: DeathScreenBackgroundConfig = {
					...currentBg,
					type: "image",
					imageUrl: dataUrl,
					imageFit: "cover",
					imagePosition: "center",
					overlayOpacity: 0.5,
				};
				onApply(importedBg);
				modalOverlay.remove();
			});
		};

		toolbar.append(tabContainer, importBtn);
		modal.append(toolbar, gridContainer);

		modalOverlay.appendChild(modal);
		modalOverlay.onclick = (e) => {
			if (e.target === modalOverlay) modalOverlay.remove();
		};

		document.body.appendChild(modalOverlay);
		renderGrid();
	}
}

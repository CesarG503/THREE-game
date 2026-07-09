const STYLE_ID = "viperio-platform-styles";

export function injectPlatformStyles() {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		:root {
			--vp-bg: #05070d;
			--vp-panel: #11131b;
			--vp-panel-2: #151821;
			--vp-panel-3: #0b0e15;
			--vp-border: rgba(255, 255, 255, 0.09);
			--vp-border-strong: rgba(255, 255, 255, 0.15);
			--vp-text: #f8fafc;
			--vp-muted: #9aa3b2;
			--vp-subtle: #687081;
			--vp-cyan: #08d9ff;
			--vp-green: #00d38a;
			--vp-purple: #8b5cf6;
			--vp-magenta: #ec4899;
			--vp-red: #ff415d;
			--vp-radius: 8px;
			--vp-font: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		}

		.vp-shell,
		.vp-shell * {
			box-sizing: border-box;
		}

		.vp-shell {
			position: fixed;
			inset: 0;
			display: grid;
			grid-template-columns: 260px minmax(0, 1fr);
			background:
				radial-gradient(circle at 82% 12%, rgba(139, 92, 246, 0.18), transparent 34%),
				radial-gradient(circle at 12% 78%, rgba(8, 217, 255, 0.12), transparent 28%),
				var(--vp-bg);
			color: var(--vp-text);
			font-family: var(--vp-font);
			z-index: 3000;
			overflow: hidden;
		}

		.vp-sidebar {
			border-right: 1px solid var(--vp-border);
			background: rgba(8, 11, 18, 0.92);
			padding: 24px 16px;
			display: flex;
			flex-direction: column;
			min-height: 0;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-gutter: stable;
		}

		.vp-sidebar::-webkit-scrollbar,
		.vp-content::-webkit-scrollbar {
			width: 8px;
		}

		.vp-sidebar::-webkit-scrollbar-thumb,
		.vp-content::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.16);
			border-radius: 999px;
		}

		.vp-brand {
			display: flex;
			align-items: center;
			gap: 12px;
			font-size: 28px;
			font-weight: 900;
			letter-spacing: 0;
			margin: 0 10px 32px;
			flex: 0 0 auto;
		}

		.vp-brand-mark {
			width: 36px;
			height: 28px;
			border-radius: 999px;
			display: inline-grid;
			place-items: center;
			background: var(--vp-cyan);
			box-shadow: 0 0 28px rgba(8, 217, 255, 0.55);
			color: #041018;
			flex: 0 0 auto;
		}

		.vp-icon,
		.vp-nav-icon,
		.vp-brand-icon {
			display: inline-block;
			width: 1.15em;
			height: 1.15em;
			font-size: 18px;
			line-height: 1;
			flex: 0 0 auto;
		}

		.vp-brand-icon {
			font-size: 22px;
		}

		.vp-nav {
			display: flex;
			flex-direction: column;
			gap: 4px;
			flex: 0 0 auto;
		}

		.vp-nav-secondary {
			margin-top: auto;
			padding-top: 28px;
		}

		.vp-nav-btn {
			width: 100%;
			height: 40px;
			border: 1px solid transparent;
			background: transparent;
			color: var(--vp-muted);
			border-radius: var(--vp-radius);
			padding: 0 12px;
			display: flex;
			align-items: center;
			gap: 10px;
			font-size: 14px;
			font-weight: 800;
			cursor: pointer;
			text-align: left;
		}

		.vp-nav-btn:hover,
		.vp-nav-btn.is-active {
			background: rgba(139, 92, 246, 0.18);
			border-color: rgba(139, 92, 246, 0.24);
			color: var(--vp-text);
		}

		.vp-nav-btn.is-create {
			background: rgba(8, 217, 255, 0.11);
			border-color: rgba(8, 217, 255, 0.22);
			color: var(--vp-cyan);
		}

		.vp-nav-icon {
			width: 22px;
			text-align: center;
			color: inherit;
		}

		.vp-main {
			min-width: 0;
			min-height: 0;
			display: grid;
			grid-template-rows: 76px minmax(0, 1fr);
			overflow: hidden;
		}

		.vp-topbar {
			border-bottom: 1px solid var(--vp-border);
			display: flex;
			align-items: center;
			gap: 18px;
			padding: 0 32px;
			background: rgba(5, 7, 13, 0.78);
			backdrop-filter: blur(12px);
		}

		.vp-search {
			width: min(520px, 48vw);
			height: 36px;
			border: 1px solid var(--vp-border);
			background: rgba(255, 255, 255, 0.045);
			color: var(--vp-text);
			border-radius: 999px;
			outline: none;
			padding: 0 18px;
			font-size: 14px;
		}

		.vp-top-actions {
			margin-left: auto;
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.vp-primary-btn,
		.vp-secondary-btn,
		.vp-danger-btn,
		.vp-ghost-btn {
			border: 0;
			border-radius: var(--vp-radius);
			height: 40px;
			padding: 0 16px;
			color: var(--vp-text);
			font-weight: 900;
			cursor: pointer;
		}

		.vp-primary-btn {
			background: var(--vp-purple);
			box-shadow: 0 0 26px rgba(139, 92, 246, 0.42);
		}

		.vp-secondary-btn {
			background: rgba(255, 255, 255, 0.1);
			border: 1px solid var(--vp-border);
		}

		.vp-danger-btn {
			background: rgba(255, 65, 93, 0.16);
			border: 1px solid rgba(255, 65, 93, 0.28);
			color: #fecdd3;
		}

		.vp-ghost-btn {
			background: transparent;
			border: 1px solid var(--vp-border);
			color: var(--vp-muted);
		}

		.vp-status-pill {
			height: 32px;
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 0 12px;
			border: 1px solid rgba(0, 211, 138, 0.22);
			background: rgba(0, 211, 138, 0.08);
			border-radius: 999px;
			color: var(--vp-green);
			font-size: 12px;
			font-weight: 900;
		}

		.vp-avatar {
			width: 38px;
			height: 38px;
			border-radius: 50%;
			display: grid;
			place-items: center;
			background: linear-gradient(135deg, var(--vp-cyan), var(--vp-magenta));
			color: #fff;
			font-weight: 900;
			border: 2px solid rgba(255, 255, 255, 0.14);
		}

		.vp-content {
			min-height: 0;
			height: 100%;
			overflow: auto;
			display: grid;
			grid-template-columns: minmax(0, 1fr) 320px;
			gap: 32px;
			padding: 32px;
			align-content: start;
			overscroll-behavior: contain;
		}

		.vp-feed {
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 30px;
		}

		.vp-rail {
			display: flex;
			flex-direction: column;
			gap: 24px;
			min-width: 0;
		}

		.vp-section-title {
			margin: 0 0 16px;
			font-size: 24px;
			line-height: 1.15;
			font-weight: 950;
		}

		.vp-hero {
			position: relative;
			min-height: 360px;
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			overflow: hidden;
			background:
				linear-gradient(90deg, rgba(5, 7, 13, 0.92), rgba(5, 7, 13, 0.46)),
				url("/assets/textures/obj/concrete.png");
			background-size: auto, 320px 320px;
			display: flex;
			align-items: flex-end;
			padding: 36px 40px;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
		}

		.vp-hero::after {
			content: "";
			position: absolute;
			inset: 0;
			background:
				linear-gradient(120deg, transparent 0 55%, rgba(8, 217, 255, 0.16) 56% 57%, transparent 58%),
				linear-gradient(150deg, transparent 0 68%, rgba(139, 92, 246, 0.16) 69% 70%, transparent 71%);
			pointer-events: none;
		}

		.vp-hero-body {
			position: relative;
			z-index: 1;
			width: min(620px, 100%);
		}

		.vp-badge-row {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			margin-bottom: 22px;
		}

		.vp-badge {
			display: inline-flex;
			align-items: center;
			gap: 7px;
			height: 32px;
			padding: 0 12px;
			background: rgba(255, 255, 255, 0.92);
			border-radius: var(--vp-radius);
			color: #080b12;
			font-size: 12px;
			font-weight: 950;
		}

		.vp-badge.dark {
			background: rgba(0, 0, 0, 0.58);
			color: var(--vp-text);
			border: 1px solid var(--vp-border);
		}

		.vp-hero-title {
			margin: 0;
			font-size: clamp(34px, 4vw, 52px);
			line-height: 0.98;
			font-weight: 950;
			letter-spacing: 0;
		}

		.vp-hero-copy {
			color: #d8deea;
			font-size: 17px;
			line-height: 1.45;
			max-width: 680px;
			margin: 16px 0 24px;
		}

		.vp-hero-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 16px;
			color: #e5e7eb;
			font-size: 14px;
			font-weight: 800;
			margin-bottom: 28px;
		}

		.vp-meta-item,
		.vp-icon-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			min-width: 0;
		}

		.vp-actions {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}

		.vp-card-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			gap: 20px;
		}

		.vp-map-card,
		.vp-panel,
		.vp-session-card {
			border: 1px solid var(--vp-border);
			background: rgba(17, 19, 27, 0.86);
			border-radius: var(--vp-radius);
			overflow: hidden;
		}

		.vp-map-card {
			min-height: 282px;
			display: flex;
			flex-direction: column;
		}

		.vp-map-preview {
			height: 150px;
			position: relative;
			background:
				linear-gradient(180deg, rgba(5, 7, 13, 0.08), rgba(5, 7, 13, 0.88)),
				url("/assets/textures/obj/brick.png");
			background-size: auto, 220px 220px;
		}

		.vp-map-preview.alt-1 {
			background:
				linear-gradient(180deg, rgba(5, 7, 13, 0.08), rgba(5, 7, 13, 0.88)),
				url("/assets/textures/obj/wood.png");
		}

		.vp-map-preview.alt-2 {
			background:
				linear-gradient(180deg, rgba(5, 7, 13, 0.08), rgba(5, 7, 13, 0.88)),
				url("/assets/textures/obj/hierro.png");
		}

		.vp-map-preview::after {
			content: "";
			position: absolute;
			inset: 18px;
			border: 1px solid rgba(8, 217, 255, 0.24);
			background:
				linear-gradient(90deg, transparent 24%, rgba(8, 217, 255, 0.18) 25% 26%, transparent 27% 74%, rgba(139, 92, 246, 0.18) 75% 76%, transparent 77%),
				linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.11) 25% 26%, transparent 27% 74%, rgba(255, 255, 255, 0.11) 75% 76%, transparent 77%);
			border-radius: var(--vp-radius);
		}

		.vp-map-pill {
			position: absolute;
			right: 14px;
			bottom: 14px;
			z-index: 1;
			background: rgba(0, 0, 0, 0.62);
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			padding: 6px 10px;
			font-size: 12px;
			font-weight: 900;
		}

		.vp-map-body {
			padding: 18px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			flex: 1;
		}

		.vp-map-title {
			margin: 0;
			font-size: 18px;
			line-height: 1.2;
			font-weight: 950;
		}

		.vp-map-copy,
		.vp-muted {
			color: var(--vp-muted);
			font-size: 13px;
			line-height: 1.45;
		}

		.vp-map-stats {
			display: flex;
			gap: 12px;
			color: #cbd5e1;
			font-size: 12px;
			font-weight: 800;
			margin-top: auto;
		}

		.vp-card-actions {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
			gap: 10px;
			margin-top: 8px;
		}

		.vp-panel {
			padding: 20px;
		}

		.vp-panel-title {
			margin: 0 0 14px;
			font-size: 16px;
			font-weight: 950;
		}

		.vp-activity-list,
		.vp-rank-list {
			display: flex;
			flex-direction: column;
			gap: 14px;
		}

		.vp-activity-item,
		.vp-rank-item {
			display: grid;
			grid-template-columns: 34px minmax(0, 1fr);
			gap: 12px;
			align-items: center;
		}

		.vp-dot-avatar {
			width: 34px;
			height: 34px;
			border-radius: 50%;
			display: grid;
			place-items: center;
			background: #1f2430;
			color: var(--vp-cyan);
			font-weight: 950;
		}

		.vp-form {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 320px;
			gap: 22px;
		}

		.vp-fieldset {
			display: flex;
			flex-direction: column;
			gap: 14px;
		}

		.vp-label {
			display: flex;
			flex-direction: column;
			gap: 8px;
			color: #dbe3ee;
			font-size: 13px;
			font-weight: 900;
		}

		.vp-input,
		.vp-textarea {
			width: 100%;
			border: 1px solid var(--vp-border);
			background: rgba(255, 255, 255, 0.055);
			color: var(--vp-text);
			border-radius: var(--vp-radius);
			padding: 12px 14px;
			font: inherit;
			outline: none;
		}

		.vp-textarea {
			min-height: 110px;
			resize: vertical;
		}

		.vp-toggle-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			padding: 14px;
			background: rgba(255, 255, 255, 0.035);
		}

		.vp-toggle-row input {
			width: 18px;
			height: 18px;
			accent-color: var(--vp-purple);
		}

		.vp-empty {
			border: 1px dashed var(--vp-border-strong);
			border-radius: var(--vp-radius);
			padding: 28px;
			color: var(--vp-muted);
			background: rgba(255, 255, 255, 0.03);
		}

		.vp-toast {
			min-height: 20px;
			color: #fde68a;
			font-size: 13px;
			font-weight: 800;
		}

		.vp-profile-header {
			border: 1px solid var(--vp-border);
			background: rgba(17, 19, 27, 0.72);
			border-radius: var(--vp-radius);
			padding: 18px 20px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			margin-bottom: 26px;
		}

		.vp-skin-layout {
			display: grid;
			grid-template-columns: minmax(300px, 1.05fr) minmax(280px, 0.95fr);
			gap: 20px;
			align-items: stretch;
		}

		.vp-skin-preview-panel,
		.vp-skin-library-panel {
			min-height: 410px;
			display: flex;
			flex-direction: column;
			gap: 14px;
		}

		.vp-skin-stage {
			position: relative;
			min-height: 310px;
			flex: 1;
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			background:
				linear-gradient(180deg, rgba(8, 217, 255, 0.08), rgba(139, 92, 246, 0.08)),
				radial-gradient(circle at 50% 48%, rgba(8, 217, 255, 0.18), transparent 46%),
				#0b0e15;
			overflow: hidden;
		}

		.vp-skin-stage::after {
			content: "360";
			position: absolute;
			left: 50%;
			bottom: 14px;
			transform: translateX(-50%);
			color: rgba(255, 255, 255, 0.58);
			font-size: 12px;
			font-weight: 950;
			pointer-events: none;
		}

		.vp-skin-canvas {
			width: 100%;
			height: 100%;
			display: block;
		}

		.vp-skin-controls {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px;
		}

		.vp-skin-controls .vp-icon-btn {
			min-height: 38px;
			padding: 0 10px;
			font-size: 12px;
		}

		.vp-skin-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
			gap: 10px;
		}

		.vp-skin-tile {
			position: relative;
			aspect-ratio: 1;
			border: 1px solid var(--vp-border);
			background: rgba(255, 255, 255, 0.045);
			border-radius: var(--vp-radius);
			cursor: pointer;
			overflow: hidden;
			padding: 8px;
		}

		.vp-skin-tile:hover,
		.vp-skin-tile.is-active {
			border-color: rgba(8, 217, 255, 0.82);
			box-shadow: 0 0 0 1px rgba(8, 217, 255, 0.26), 0 0 24px rgba(8, 217, 255, 0.14);
		}

		.vp-skin-tile-preview {
			display: block;
			width: 100%;
			height: 100%;
			background-color: #111827;
			background-repeat: no-repeat;
			background-size: 250% 250%;
			background-position: 8% 8%;
			image-rendering: pixelated;
			border-radius: 6px;
		}

		.vp-skin-active {
			position: absolute;
			right: 6px;
			bottom: 6px;
			background: rgba(8, 217, 255, 0.92);
			color: #041018;
			border-radius: 6px;
			padding: 3px 6px;
			font-size: 11px;
			font-weight: 950;
		}

		.vp-skin-empty {
			min-height: 78px;
			border: 1px dashed var(--vp-border-strong);
			border-radius: var(--vp-radius);
			display: grid;
			place-items: center;
			color: var(--vp-muted);
			font-size: 12px;
			text-align: center;
			padding: 10px;
		}

		.vp-skin-upload-btn {
			width: 100%;
			min-height: 48px;
			margin-top: auto;
		}

		@media (max-width: 980px) {
			.vp-shell {
				grid-template-columns: 76px minmax(0, 1fr);
			}

			.vp-brand-text,
			.vp-nav-label {
				display: none;
			}

			.vp-sidebar {
				padding: 20px 10px;
			}

			.vp-brand {
				margin: 0 auto 28px;
				justify-content: center;
			}

			.vp-nav-btn {
				justify-content: center;
				padding: 0;
			}

			.vp-content {
				grid-template-columns: 1fr;
			}

			.vp-rail {
				display: none;
			}

			.vp-form {
				grid-template-columns: 1fr;
			}

			.vp-skin-layout {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 680px) {
			.vp-shell {
				grid-template-columns: 1fr;
				grid-template-rows: auto minmax(0, 1fr);
			}

			.vp-sidebar {
				flex-direction: row;
				align-items: center;
				overflow-x: auto;
				overflow-y: hidden;
				border-right: 0;
				border-bottom: 1px solid var(--vp-border);
			}

			.vp-brand {
				margin: 0 10px 0 0;
			}

			.vp-nav,
			.vp-nav-secondary {
				flex-direction: row;
				margin-top: 0;
				padding-top: 0;
			}

			.vp-main {
				grid-template-rows: auto minmax(0, 1fr);
				min-height: 0;
			}

			.vp-topbar {
				padding: 14px;
				flex-wrap: wrap;
			}

			.vp-search {
				width: 100%;
				order: 2;
			}

			.vp-top-actions {
				margin-left: 0;
				width: 100%;
			}

			.vp-content {
				padding: 18px;
			}

			.vp-hero {
				min-height: 320px;
				padding: 26px;
			}

			.vp-profile-header {
				align-items: stretch;
				flex-direction: column;
			}

			.vp-skin-controls {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}
		}

		/* Matchmaking Modal & UI */
		.vp-modal-overlay {
			position: fixed;
			inset: 0;
			background: rgba(5, 7, 13, 0.82);
			backdrop-filter: blur(8px);
			display: grid;
			place-items: center;
			z-index: 5000;
			animation: vp-fade-in 0.25s ease-out;
		}

		.vp-modal {
			background: rgba(17, 19, 27, 0.94);
			border: 1px solid var(--vp-border-strong);
			border-radius: calc(var(--vp-radius) * 1.5);
			width: min(420px, 90vw);
			padding: 28px;
			box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
			position: relative;
			display: flex;
			flex-direction: column;
			gap: 20px;
			animation: vp-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		}

		.vp-modal-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid var(--vp-border);
			padding-bottom: 14px;
		}

		.vp-modal-title {
			margin: 0;
			font-size: 18px;
			font-weight: 950;
			letter-spacing: -0.5px;
			background: linear-gradient(135deg, #fff, var(--vp-cyan));
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}

		.vp-modal-close-btn {
			background: transparent;
			border: 0;
			color: var(--vp-muted);
			font-size: 20px;
			cursor: pointer;
			display: inline-flex;
			padding: 4px;
			border-radius: 50%;
			transition: background 0.2s;
		}

		.vp-modal-close-btn:hover {
			background: rgba(255, 255, 255, 0.08);
			color: var(--vp-text);
		}

		.vp-modal-content {
			display: flex;
			flex-direction: column;
			gap: 16px;
		}

		.vp-select {
			width: 100%;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			color: var(--vp-text);
			padding: 12px;
			font-family: inherit;
			font-size: 14px;
			font-weight: 800;
			outline: none;
			cursor: pointer;
			transition: border-color 0.2s;
		}

		.vp-select:focus {
			border-color: var(--vp-cyan);
		}

		.vp-mm-ewt-display {
			background: rgba(8, 217, 255, 0.06);
			border: 1px solid rgba(8, 217, 255, 0.15);
			border-radius: var(--vp-radius);
			padding: 14px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 13px;
			font-weight: 800;
			color: var(--vp-cyan);
		}

		.vp-mm-ewt-val {
			font-size: 15px;
			font-weight: 950;
			color: #fff;
			text-shadow: 0 0 10px rgba(8, 217, 255, 0.4);
		}

		.vp-mm-search-state {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 20px;
			padding: 12px 0;
		}

		/* Pulsing Circle Animation */
		.vp-mm-pulse-circle {
			width: 76px;
			height: 76px;
			border-radius: 50%;
			background: rgba(139, 92, 246, 0.1);
			border: 2px solid var(--vp-purple);
			display: grid;
			place-items: center;
			position: relative;
			box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
		}

		.vp-mm-pulse-circle::before,
		.vp-mm-pulse-circle::after {
			content: "";
			position: absolute;
			inset: -2px;
			border-radius: 50%;
			border: 2px solid var(--vp-purple);
			animation: vp-pulse 2s infinite ease-out;
			opacity: 0;
		}

		.vp-mm-pulse-circle::after {
			animation-delay: 1s;
		}

		.vp-mm-timer {
			font-size: 26px;
			font-weight: 950;
			font-feature-settings: "tnum";
			color: #fff;
			text-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
		}

		.vp-mm-search-msg {
			font-size: 13px;
			font-weight: 800;
			color: var(--vp-muted);
			text-align: center;
			line-height: 1.4;
		}

		.vp-mm-cancel-btn {
			width: 100%;
		}

		@keyframes vp-fade-in {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		@keyframes vp-slide-up {
			from { transform: translateY(16px); opacity: 0; }
			to { transform: translateY(0); opacity: 1; }
		}

		@keyframes vp-pulse {
			0% {
				transform: scale(1);
				opacity: 0.8;
			}
			100% {
				transform: scale(1.6);
				opacity: 0;
			}
		}
	`;
	document.head.appendChild(style);
}

/**
 * VIPER STUDIO PREMIUM — Design Tokens System
 * Ergonomic, professional dark palette inspired by Figma, After Effects and Unreal Engine.
 * Lightweight, zero-dependency, high-contrast, accessibility-compliant.
 */

export const StudioTokens = {
	// Surfaces & Elevations
	colors: {
		surfaceBase: "#090b0e",       // Deep obsidian canvas surround
		surface1: "#0f1217",          // Primary sidebar and topbar background
		surface2: "#161a22",          // Panels, cards, input containers
		surface3: "#1d232f",          // Hover state, active item row
		surfaceActive: "#242c3c",     // Selected row, active pressed button
		
		// Borders & Dividers
		borderSubtle: "#1c222d",      // Low contrast panel dividers
		borderNormal: "#283141",      // Input boundaries, card outlines
		borderStrong: "#3d495d",      // Focused inputs, hover borders
		borderFocus: "#00d2ff",       // Cyan focus ring

		// Typography
		textPrimary: "#f1f5f9",       // High contrast headers and active labels
		textSecondary: "#94a3b8",     // Standard body labels and unselected icons
		textMuted: "#5a667a",         // Placeholders, units, shortcuts
		textDisabled: "#3b4455",      // Inactive actions

		// Accent & Branding (VIPER Cyan Core)
		accent: "#00d2ff",            // Primary brand accent
		accentHover: "#38bdf8",       // Brightened hover accent
		accentMuted: "rgba(0, 210, 255, 0.12)", // Tinted backgrounds / selection marquee
		accentBorder: "rgba(0, 210, 255, 0.4)", // Active borders

		// State & Feedback Colors
		success: "#10b981",           // Saved, valid, verified
		successBg: "rgba(16, 185, 129, 0.12)",
		warning: "#f59e0b",           // Caution, unsaved warning
		warningBg: "rgba(245, 158, 11, 0.12)",
		danger: "#f43f5e",            // Delete, kill, error, recording
		dangerBg: "rgba(244, 63, 94, 0.12)",
		info: "#6366f1",              // Telemetry, info pills
	},

	// Dimensions & Controls
	spacing: {
		xs: "4px",
		sm: "8px",
		md: "12px",
		lg: "16px",
		xl: "24px",
	},

	radii: {
		xs: "2px",
		sm: "4px",
		md: "6px",
		lg: "8px",
		pill: "9999px",
	},

	typography: {
		fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
		fontMono: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', Consolas, monospace",
		sizeXs: "10px",
		sizeSm: "11px",
		sizeMd: "12px",
		sizeLg: "13px",
		sizeXl: "15px",
		sizeTitle: "18px",
		weightNormal: 400,
		weightMedium: 500,
		weightSemiBold: 600,
		weightBold: 700,
	},

	shadows: {
		subtle: "0 1px 2px rgba(0, 0, 0, 0.3)",
		card: "0 4px 12px rgba(0, 0, 0, 0.4)",
		dropdown: "0 8px 24px rgba(0, 0, 0, 0.65)",
		accentGlow: "0 0 12px rgba(0, 210, 255, 0.3)",
	},

	transitions: {
		fast: "all 0.12s cubic-bezier(0.4, 0, 0.2, 1)",
		standard: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
	},
};

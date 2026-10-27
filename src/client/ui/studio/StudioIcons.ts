/**
 * VIPER STUDIO PREMIUM — SVG Icon System
 * 100% vector SVG icons inspired by Lucide.
 * Consistent 24x24 geometry, 1.8px stroke width, rounded caps and joins.
 * Replaces all emojis across the entire Studio with crisp, pixel-perfect icons.
 */

export type StudioIconName =
	| "cursor"
	| "hand"
	| "type"
	| "square"
	| "circle"
	| "triangle"
	| "image"
	| "crosshair"
	| "loader"
	| "save"
	| "check"
	| "undo"
	| "redo"
	| "layers"
	| "grid"
	| "layout"
	| "timeline"
	| "maximize"
	| "minimize"
	| "eye"
	| "eye-off"
	| "lock"
	| "unlock"
	| "trash"
	| "copy"
	| "plus"
	| "folder"
	| "folder-open"
	| "search"
	| "magnet"
	| "shield"
	| "play"
	| "pause"
	| "stop"
	| "skip-back"
	| "skip-forward"
	| "repeat"
	| "keyframe"
	| "palette"
	| "sparkles"
	| "upload"
	| "crop"
	| "sliders"
	| "rotate"
	| "chevron-down"
	| "chevron-right"
	| "chevron-up"
	| "arrow-up"
	| "arrow-down"
	| "arrow-left"
	| "arrow-right"
	| "align-left"
	| "align-center"
	| "align-right"
	| "align-top"
	| "align-middle"
	| "align-bottom"
	| "distribute-h"
	| "distribute-v"
	| "zoom-in"
	| "zoom-out"
	| "x"
	| "help"
	| "monitor"
	| "badge"
	| "star"
	| "more-horizontal"
	| "component"
	| "bezier";

const SVG_PATHS: Record<StudioIconName, string> = {
	cursor: `<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/>`,
	hand: `<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>`,
	type: `<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>`,
	square: `<rect width="18" height="18" x="3" y="3" rx="2"/>`,
	circle: `<circle cx="12" cy="12" r="10"/>`,
	triangle: `<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>`,
	image: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
	crosshair: `<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`,
	loader: `<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>`,
	save: `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>`,
	check: `<polyline points="20 6 9 17 4 12"/>`,
	undo: `<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>`,
	redo: `<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>`,
	layers: `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`,
	grid: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>`,
	layout: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>`,
	timeline: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
	maximize: `<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>`,
	minimize: `<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/>`,
	eye: `<path d="2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`,
	"eye-off": `<path d="9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>`,
	lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
	unlock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
	trash: `<path d="3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`,
	copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
	plus: `<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>`,
	folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
	"folder-open": `<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>`,
	search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
	magnet: `<path d="m6 15-3-3 6.7-6.7a4 4 0 0 1 5.6 0l2.4 2.4a4 4 0 0 1 0 5.6L11 20l-3-3"/><path d="m9 6 3 3"/><path d="m13 10 3 3"/>`,
	shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>`,
	play: `<polygon points="6 3 20 12 6 21 6 3"/>`,
	pause: `<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>`,
	stop: `<rect width="16" height="16" x="4" y="4" rx="2"/>`,
	"skip-back": `<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>`,
	"skip-forward": `<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>`,
	repeat: `<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
	keyframe: `<path d="M12 2 2 12l10 10 10-10L12 2z"/>`,
	palette: `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2Z"/>`,
	sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>`,
	upload: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>`,
	crop: `<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>`,
	sliders: `<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>`,
	rotate: `<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`,
	"chevron-down": `<polyline points="6 9 12 15 18 9"/>`,
	"chevron-right": `<polyline points="9 18 15 12 9 6"/>`,
	"chevron-up": `<polyline points="18 15 12 9 6 15"/>`,
	"arrow-up": `<line x1="12" x2="12" y1="19" y2="5"/><polyline points="5 12 12 5 19 12"/>`,
	"arrow-down": `<line x1="12" x2="12" y1="5" y2="19"/><polyline points="19 12 12 19 5 12"/>`,
	"arrow-left": `<line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>`,
	"arrow-right": `<line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
	"align-left": `<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>`,
	"align-center": `<line x1="21" x2="3" y1="6" y2="6"/><line x1="18" x2="6" y1="12" y2="12"/><line x1="20" x2="4" y1="18" y2="18"/>`,
	"align-right": `<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>`,
	"align-top": `<line x1="4" x2="20" y1="3" y2="3"/><rect width="6" height="12" x="6" y="7" rx="1"/><rect width="6" height="8" x="14" y="7" rx="1"/>`,
	"align-middle": `<line x1="2" x2="22" y1="12" y2="12"/><rect width="6" height="10" x="5" y="7" rx="1"/><rect width="6" height="14" x="13" y="5" rx="1"/>`,
	"align-bottom": `<line x1="4" x2="20" y1="21" y2="21"/><rect width="6" height="12" x="6" y="5" rx="1"/><rect width="6" height="8" x="14" y="9" rx="1"/>`,
	"distribute-h": `<line x1="4" x2="4" y1="2" y2="22"/><line x1="20" x2="20" y1="2" y2="22"/><rect width="6" height="12" x="9" y="6" rx="1"/>`,
	"distribute-v": `<line x1="2" x2="22" y1="4" y2="4"/><line x1="2" x2="22" y1="20" y2="20"/><rect width="12" height="6" x="6" y="9" rx="1"/>`,
	"zoom-in": `<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>`,
	"zoom-out": `<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>`,
	x: `<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>`,
	help: `<circle cx="12" cy="12" r="10"/><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>`,
	monitor: `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
	badge: `<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>`,
	star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
	"more-horizontal": `<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`,
	component: `<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"/><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"/><path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"/>`,
	bezier: `<path d="M4 19 C 4 10, 20 14, 20 5"/><rect x="2" y="17" width="4" height="4" rx="1"/><rect x="18" y="3" width="4" height="4" rx="1"/><line x1="4" y1="17" x2="8" y2="10" stroke-dasharray="2 1"/><line x1="20" y1="7" x2="16" y2="14" stroke-dasharray="2 1"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="14" r="1.5"/>`,
};

/**
 * Returns crisp SVG markup for the specified icon.
 */
export function renderStudioIcon(
	name: StudioIconName,
	size = 14,
	strokeColor = "currentColor",
	extraStyle = ""
): string {
	const path = SVG_PATHS[name] || SVG_PATHS.help;
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0; ${extraStyle}">${path}</svg>`;
}

/**
 * Creates an HTMLElement with the given SVG icon.
 */
export function createStudioIconElement(
	name: StudioIconName,
	size = 14,
	strokeColor = "currentColor"
): HTMLElement {
	const span = document.createElement("span");
	span.className = "studio-icon";
	span.style.cssText = `display: inline-flex; align-items: center; justify-content: center; width: ${size}px; height: ${size}px; line-height: 1; flex-shrink: 0;`;
	span.innerHTML = renderStudioIcon(name, size, strokeColor);
	return span;
}

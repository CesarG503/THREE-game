/**
 * VIPER STUDIO PREMIUM — StudioGraphEditor.ts
 * Visual Graph Editor & Cubic Bézier Curve Designer for Anime.js 4.x.
 * 
 * Features:
 * - High-precision SVG canvas with grid lines and headroom for overshoot / anticipation.
 * - Draggable P1 (cyan) and P2 (magenta) control handles with pointer capture.
 * - Direct numerical inputs (x1, y1, x2, y2).
 * - Instant animated preview ball demonstrating the acceleration curve.
 * - Curated motion design presets (Linear, Ease-In, Ease-Out, Ease-InOut, Anticipate, Overshoot, Bounce, Snappy).
 * - Copy / Paste easing clipboard.
 * - Pure TypeScript cubic Bézier math evaluator for real-time scrubbing without async delays.
 */

import { StudioTokens } from "./StudioTokens";
import { renderStudioIcon } from "./StudioIcons";

export type BezierCurveTuple = [number, number, number, number];

export interface GraphEditorOptions {
	curve?: BezierCurveTuple;
	onChange?: (curve: BezierCurveTuple) => void;
	onCommit?: (curve: BezierCurveTuple) => void;
	compact?: boolean;
}

export class StudioGraphEditor {
	private curve: BezierCurveTuple;
	private onChange?: (curve: BezierCurveTuple) => void;
	private onCommit?: (curve: BezierCurveTuple) => void;
	private containerEl: HTMLElement | null = null;
	private svgEl: SVGSVGElement | null = null;
	private pathEl: SVGPathElement | null = null;
	private line1El: SVGLineElement | null = null;
	private line2El: SVGLineElement | null = null;
	private handle1El: SVGCircleElement | null = null;
	private handle2El: SVGCircleElement | null = null;
	private previewDotEl: HTMLElement | null = null;
	private previewAnimId: number | null = null;
	private inputs: HTMLInputElement[] = [];

	private static clipboardCurve: BezierCurveTuple | null = null;

	// Curated professional motion presets
	public static readonly PRESETS: Array<{ name: string; curve: BezierCurveTuple; tooltip: string }> = [
		{ name: "Linear", curve: [0, 0, 1, 1], tooltip: "Velocidad constante uniforme" },
		{ name: "Ease In", curve: [0.42, 0, 1, 1], tooltip: "Arranque suave con aceleración progresiva" },
		{ name: "Ease Out", curve: [0, 0, 0.58, 1], tooltip: "Frenado suave natural al destino" },
		{ name: "Ease In-Out", curve: [0.42, 0, 0.58, 1], tooltip: "Aceleración y desaceleración equilibrada" },
		{ name: "Anticipate", curve: [0.36, 0, 0.66, -0.56], tooltip: "Anticipación dramática retrocediendo antes de avanzar" },
		{ name: "Overshoot", curve: [0.34, 1.56, 0.64, 1], tooltip: "Sobreimpulso orgánico pasando el destino" },
		{ name: "Bounce", curve: [0.18, 0.89, 0.32, 1.28], tooltip: "Rebote enérgico arcade con impacto elástico" },
		{ name: "Snappy", curve: [0.16, 1, 0.3, 1], tooltip: "Reacción instantánea y frenado táctico" },
	];

	// Canvas dimensions in SVG viewBox coordinate space
	private readonly padX = 30;
	private readonly padY = 35;
	private readonly graphW = 200;
	private readonly graphH = 100;
	private readonly originX = 30;
	private readonly originY = 135; // y=0 in graph
	private readonly targetX = 230;
	private readonly targetY = 35;  // y=1 in graph

	constructor(options?: GraphEditorOptions) {
		this.curve = options?.curve ? [...options.curve] : [0.34, 1.56, 0.64, 1]; // Default to expressive overshoot
		this.onChange = options?.onChange;
		this.onCommit = options?.onCommit;
	}

	public getCurve(): BezierCurveTuple {
		return [...this.curve];
	}

	public setCurve(newCurve: BezierCurveTuple, triggerChange = true) {
		this.curve = [
			Math.max(0, Math.min(1, newCurve[0])),
			Math.max(-0.8, Math.min(1.8, newCurve[1])),
			Math.max(0, Math.min(1, newCurve[2])),
			Math.max(-0.8, Math.min(1.8, newCurve[3])),
		];
		this.updateSVG();
		this.updateInputValues();
		if (triggerChange && this.onChange) {
			this.onChange(this.getCurve());
		}
	}

	/**
	 * Pure mathematical evaluation of cubic Bézier curve using Newton-Raphson.
	 * Allows real-time evaluation for timeline scrubbing at 60fps with zero latency.
	 */
	public evaluate(t: number): number {
		const [x1, y1, x2, y2] = this.curve;
		if (t <= 0) return 0;
		if (t >= 1) return 1;

		// Solve for parameter u given t (where x(u) = t)
		let u = t;
		for (let i = 0; i < 8; i++) {
			const currentX = 3 * Math.pow(1 - u, 2) * u * x1 + 3 * (1 - u) * Math.pow(u, 2) * x2 + Math.pow(u, 3);
			const dx = 3 * Math.pow(1 - u, 2) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * Math.pow(u, 2) * (1 - x2);
			if (Math.abs(currentX - t) < 0.001 || Math.abs(dx) < 1e-6) break;
			u -= (currentX - t) / dx;
			u = Math.max(0, Math.min(1, u));
		}

		// Calculate y(u)
		return 3 * Math.pow(1 - u, 2) * u * y1 + 3 * (1 - u) * Math.pow(u, 2) * y2 + Math.pow(u, 3);
	}

	public render(): HTMLElement {
		const root = document.createElement("div");
		this.containerEl = root;
		root.className = "studio-graph-editor";
		root.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 8px;
			background: ${StudioTokens.colors.surface2};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			border-radius: ${StudioTokens.radii.md};
			padding: 10px;
			user-select: none;
			box-sizing: border-box;
		`;

		// Header Bar with Presets & Clipboard
		const header = document.createElement("div");
		header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
			gap: 6px;
		`;

		const titleRow = document.createElement("div");
		titleRow.style.cssText = "display: flex; align-items: center; gap: 6px;";
		titleRow.innerHTML = `
			${renderStudioIcon("bezier", 14, StudioTokens.colors.accent)}
			<span style="font-size: ${StudioTokens.typography.sizeSm}; font-weight: 700; color: ${StudioTokens.colors.textPrimary}; letter-spacing: 0.3px;">
				Curva Bézier Anime.js
			</span>
		`;

		const actionsRow = document.createElement("div");
		actionsRow.style.cssText = "display: flex; align-items: center; gap: 4px;";

		// Copy Button
		const copyBtn = document.createElement("button");
		copyBtn.type = "button";
		copyBtn.title = "Copiar curva Bézier";
		copyBtn.style.cssText = `
			background: ${StudioTokens.colors.surface3};
			border: 1px solid ${StudioTokens.colors.borderNormal};
			color: ${StudioTokens.colors.textSecondary};
			padding: 3px 6px;
			border-radius: ${StudioTokens.radii.sm};
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
		`;
		copyBtn.innerHTML = `${renderStudioIcon("copy", 11)} <span>Copiar</span>`;
		copyBtn.onclick = () => {
			StudioGraphEditor.clipboardCurve = this.getCurve();
			copyBtn.style.color = StudioTokens.colors.accent;
			setTimeout(() => { copyBtn.style.color = StudioTokens.colors.textSecondary; }, 800);
		};

		// Paste Button
		const pasteBtn = document.createElement("button");
		pasteBtn.type = "button";
		pasteBtn.title = "Pegar curva Bézier copiada";
		pasteBtn.style.cssText = copyBtn.style.cssText;
		pasteBtn.innerHTML = `${renderStudioIcon("sliders", 11)} <span>Pegar</span>`;
		pasteBtn.onclick = () => {
			if (StudioGraphEditor.clipboardCurve) {
				this.setCurve(StudioGraphEditor.clipboardCurve);
			}
		};

		actionsRow.append(copyBtn, pasteBtn);
		header.append(titleRow, actionsRow);
		root.appendChild(header);

		// Presets pill list
		const presetsBar = document.createElement("div");
		presetsBar.style.cssText = `
			display: flex;
			gap: 4px;
			overflow-x: auto;
			padding-bottom: 2px;
			scrollbar-width: none;
		`;
		StudioGraphEditor.PRESETS.forEach((p) => {
			const pill = document.createElement("button");
			pill.type = "button";
			pill.title = p.tooltip;
			pill.textContent = p.name;
			pill.style.cssText = `
				background: ${StudioTokens.colors.surface1};
				border: 1px solid ${StudioTokens.colors.borderSubtle};
				color: ${StudioTokens.colors.textMuted};
				padding: 2px 8px;
				border-radius: 9999px;
				font-size: 10px;
				font-weight: 500;
				cursor: pointer;
				white-space: nowrap;
				transition: border-color 0.15s, color 0.15s;
			`;
			pill.onmouseenter = () => {
				pill.style.borderColor = StudioTokens.colors.accent;
				pill.style.color = StudioTokens.colors.textPrimary;
			};
			pill.onmouseleave = () => {
				pill.style.borderColor = StudioTokens.colors.borderSubtle;
				pill.style.color = StudioTokens.colors.textMuted;
			};
			pill.onclick = () => {
				this.setCurve(p.curve);
			};
			presetsBar.appendChild(pill);
		});
		root.appendChild(presetsBar);

		// SVG Visual Curve Canvas
		const svgContainer = document.createElement("div");
		svgContainer.style.cssText = `
			position: relative;
			width: 100%;
			height: 140px;
			background: ${StudioTokens.colors.surface1};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			border-radius: ${StudioTokens.radii.sm};
			overflow: hidden;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.svgEl = svg;
		svg.setAttribute("viewBox", "0 0 260 170");
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.style.cssText = "display: block; overflow: visible;";

		// Background Grid & Coordinate Lines
		const gridG = document.createElementNS("http://www.w3.org/2000/svg", "g");
		gridG.setAttribute("stroke", "#1f2736");
		gridG.setAttribute("stroke-width", "1");

		// Horizontal baseline (y=0) and ceiling (y=1)
		const baseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		baseLine.setAttribute("x1", "10"); baseLine.setAttribute("x2", "250");
		baseLine.setAttribute("y1", String(this.originY)); baseLine.setAttribute("y2", String(this.originY));
		baseLine.setAttribute("stroke", "#2b3548");

		const ceilLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		ceilLine.setAttribute("x1", "10"); ceilLine.setAttribute("x2", "250");
		ceilLine.setAttribute("y1", String(this.targetY)); ceilLine.setAttribute("y2", String(this.targetY));
		ceilLine.setAttribute("stroke", "#2b3548");
		ceilLine.setAttribute("stroke-dasharray", "3 2");

		// Vertical boundaries (x=0 and x=1)
		const x0Line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		x0Line.setAttribute("x1", String(this.originX)); x0Line.setAttribute("x2", String(this.originX));
		x0Line.setAttribute("y1", "10"); x0Line.setAttribute("y2", "160");
		x0Line.setAttribute("stroke", "#2b3548");

		const x1Line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		x1Line.setAttribute("x1", String(this.targetX)); x1Line.setAttribute("x2", String(this.targetX));
		x1Line.setAttribute("y1", "10"); x1Line.setAttribute("y2", "160");
		x1Line.setAttribute("stroke", "#2b3548");
		x1Line.setAttribute("stroke-dasharray", "3 2");

		// Diagonal reference guide (Linear)
		const diagLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
		diagLine.setAttribute("x1", String(this.originX)); diagLine.setAttribute("y1", String(this.originY));
		diagLine.setAttribute("x2", String(this.targetX)); diagLine.setAttribute("y2", String(this.targetY));
		diagLine.setAttribute("stroke", "#192230");
		diagLine.setAttribute("stroke-dasharray", "2 2");

		gridG.append(baseLine, ceilLine, x0Line, x1Line, diagLine);
		svg.appendChild(gridG);

		// Tangent Lines from endpoints
		this.line1El = document.createElementNS("http://www.w3.org/2000/svg", "line");
		this.line1El.setAttribute("stroke", "#00d2ff88");
		this.line1El.setAttribute("stroke-width", "1.5");

		this.line2El = document.createElementNS("http://www.w3.org/2000/svg", "line");
		this.line2El.setAttribute("stroke", "#ff336688");
		this.line2El.setAttribute("stroke-width", "1.5");

		svg.append(this.line1El, this.line2El);

		// Main Bézier Path
		this.pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.pathEl.setAttribute("fill", "none");
		this.pathEl.setAttribute("stroke", StudioTokens.colors.accent);
		this.pathEl.setAttribute("stroke-width", "2.5");
		svg.appendChild(this.pathEl);

		// Anchor points (P0 and P3)
		const p0Dot = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		p0Dot.setAttribute("x", String(this.originX - 3));
		p0Dot.setAttribute("y", String(this.originY - 3));
		p0Dot.setAttribute("width", "6");
		p0Dot.setAttribute("height", "6");
		p0Dot.setAttribute("fill", "#60728c");

		const p3Dot = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		p3Dot.setAttribute("x", String(this.targetX - 3));
		p3Dot.setAttribute("y", String(this.targetY - 3));
		p3Dot.setAttribute("width", "6");
		p3Dot.setAttribute("height", "6");
		p3Dot.setAttribute("fill", "#60728c");

		svg.append(p0Dot, p3Dot);

		// Draggable Handles (P1 and P2)
		this.handle1El = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		this.handle1El.setAttribute("r", "6");
		this.handle1El.setAttribute("fill", "#00d2ff");
		this.handle1El.setAttribute("stroke", "#ffffff");
		this.handle1El.setAttribute("stroke-width", "1.5");
		this.handle1El.style.cursor = "grab";

		this.handle2El = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		this.handle2El.setAttribute("r", "6");
		this.handle2El.setAttribute("fill", "#ff3366");
		this.handle2El.setAttribute("stroke", "#ffffff");
		this.handle2El.setAttribute("stroke-width", "1.5");
		this.handle2El.style.cursor = "grab";

		svg.append(this.handle1El, this.handle2El);
		svgContainer.appendChild(svg);
		root.appendChild(svgContainer);

		// Attach Pointer Drag Handlers
		this.setupHandleDrag(this.handle1El, 0); // Handle P1 (x1, y1)
		this.setupHandleDrag(this.handle2El, 1); // Handle P2 (x2, y2)

		// Numeric Coordinates Row (x1, y1, x2, y2)
		const numRow = document.createElement("div");
		numRow.style.cssText = `
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 6px;
			align-items: center;
		`;

		const labels = ["X1 (Cian)", "Y1 (Cian)", "X2 (Magenta)", "Y2 (Magenta)"];
		this.inputs = [];

		for (let i = 0; i < 4; i++) {
			const cell = document.createElement("div");
			cell.style.cssText = "display: flex; flex-direction: column; gap: 2px;";

			const lbl = document.createElement("span");
			lbl.textContent = labels[i];
			lbl.style.cssText = `
				font-size: 9px;
				font-weight: 600;
				color: ${i < 2 ? StudioTokens.colors.accent : "#ff6688"};
				white-space: nowrap;
			`;

			const inp = document.createElement("input");
			inp.type = "number";
			inp.step = "0.01";
			inp.value = this.curve[i].toFixed(2);
			inp.style.cssText = `
				background: ${StudioTokens.colors.surface1};
				color: ${StudioTokens.colors.textPrimary};
				border: 1px solid ${StudioTokens.colors.borderNormal};
				border-radius: ${StudioTokens.radii.sm};
				padding: 3px 5px;
				font-size: 11px;
				font-family: ${StudioTokens.typography.fontMono};
				outline: none;
				width: 100%;
				box-sizing: border-box;
			`;
			inp.onchange = () => {
				const val = parseFloat(inp.value) || 0;
				this.curve[i] = i % 2 === 0 ? Math.max(0, Math.min(1, val)) : val;
				this.setCurve(this.curve);
			};

			this.inputs.push(inp);
			cell.append(lbl, inp);
			numRow.appendChild(cell);
		}
		root.appendChild(numRow);

		// Live Motion Preview Track (Bottom Bar)
		const previewTrack = document.createElement("div");
		previewTrack.style.cssText = `
			position: relative;
			height: 16px;
			background: ${StudioTokens.colors.surface1};
			border: 1px solid ${StudioTokens.colors.borderSubtle};
			border-radius: ${StudioTokens.radii.sm};
			overflow: hidden;
			display: flex;
			align-items: center;
			padding: 0 6px;
		`;

		const trackLine = document.createElement("div");
		trackLine.style.cssText = `
			width: 100%;
			height: 2px;
			background: ${StudioTokens.colors.surface3};
		`;

		const previewDot = document.createElement("div");
		this.previewDotEl = previewDot;
		previewDot.style.cssText = `
			position: absolute;
			left: 6px;
			top: 3px;
			width: 10px;
			height: 10px;
			border-radius: 50%;
			background: ${StudioTokens.colors.accent};
			box-shadow: 0 0 6px ${StudioTokens.colors.accentGlow};
			transition: transform 0.05s linear;
		`;

		previewTrack.append(trackLine, previewDot);
		root.appendChild(previewTrack);

		// Initial rendering and start preview animation loop
		this.updateSVG();
		this.startPreviewAnimation();

		return root;
	}

	private setupHandleDrag(handleEl: SVGCircleElement, handleIndex: 0 | 1) {
		let isDragging = false;

		handleEl.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			isDragging = true;
			handleEl.setPointerCapture(e.pointerId);
			handleEl.style.cursor = "grabbing";
		});

		handleEl.addEventListener("pointermove", (e) => {
			if (!isDragging || !this.svgEl) return;
			e.preventDefault();

			const rect = this.svgEl.getBoundingClientRect();
			// Scale factor between SVG viewBox (260x170) and rendered DOM rect
			const scaleX = 260 / rect.width;
			const scaleY = 170 / rect.height;

			const mouseSvgX = (e.clientX - rect.left) * scaleX;
			const mouseSvgY = (e.clientY - rect.top) * scaleY;

			// Convert SVG coords to 0..1 parameter space
			const newX = Math.max(0, Math.min(1, (mouseSvgX - this.originX) / this.graphW));
			const newY = (this.originY - mouseSvgY) / this.graphH;

			if (handleIndex === 0) {
				this.curve[0] = Math.round(newX * 100) / 100;
				this.curve[1] = Math.round(newY * 100) / 100;
			} else {
				this.curve[2] = Math.round(newX * 100) / 100;
				this.curve[3] = Math.round(newY * 100) / 100;
			}

			this.updateSVG();
			this.updateInputValues();
			if (this.onChange) {
				this.onChange(this.getCurve());
			}
		});

		const onEnd = (e: PointerEvent) => {
			if (!isDragging) return;
			isDragging = false;
			try {
				handleEl.releasePointerCapture(e.pointerId);
			} catch {
				// Safely ignore
			}
			handleEl.style.cursor = "grab";
			if (this.onCommit) {
				this.onCommit(this.getCurve());
			}
		};

		handleEl.addEventListener("pointerup", onEnd);
		handleEl.addEventListener("pointercancel", onEnd);
	}

	private updateSVG() {
		if (!this.pathEl || !this.line1El || !this.line2El || !this.handle1El || !this.handle2El) return;

		const [x1, y1, x2, y2] = this.curve;

		const p1SvgX = this.originX + x1 * this.graphW;
		const p1SvgY = this.originY - y1 * this.graphH;

		const p2SvgX = this.originX + x2 * this.graphW;
		const p2SvgY = this.originY - y2 * this.graphH;

		// Update Bézier path
		const d = `M ${this.originX} ${this.originY} C ${p1SvgX} ${p1SvgY}, ${p2SvgX} ${p2SvgY}, ${this.targetX} ${this.targetY}`;
		this.pathEl.setAttribute("d", d);

		// Update tangent lines
		this.line1El.setAttribute("x1", String(this.originX));
		this.line1El.setAttribute("y1", String(this.originY));
		this.line1El.setAttribute("x2", String(p1SvgX));
		this.line1El.setAttribute("y2", String(p1SvgY));

		this.line2El.setAttribute("x1", String(this.targetX));
		this.line2El.setAttribute("y1", String(this.targetY));
		this.line2El.setAttribute("x2", String(p2SvgX));
		this.line2El.setAttribute("y2", String(p2SvgY));

		// Update control circles
		this.handle1El.setAttribute("cx", String(p1SvgX));
		this.handle1El.setAttribute("cy", String(p1SvgY));

		this.handle2El.setAttribute("cx", String(p2SvgX));
		this.handle2El.setAttribute("cy", String(p2SvgY));
	}

	private updateInputValues() {
		if (this.inputs.length === 4) {
			this.inputs[0].value = this.curve[0].toFixed(2);
			this.inputs[1].value = this.curve[1].toFixed(2);
			this.inputs[2].value = this.curve[2].toFixed(2);
			this.inputs[3].value = this.curve[3].toFixed(2);
		}
	}

	private startPreviewAnimation() {
		if (typeof window === "undefined") return;
		let startTime = performance.now();
		const loopDuration = 1800; // 1.8s per preview cycle

		const step = (now: number) => {
			if (!this.containerEl) return;
			const elapsed = (now - startTime) % loopDuration;
			const t = Math.min(1, Math.max(0, elapsed / 1200)); // 1.2s motion + 0.6s pause

			if (this.previewDotEl) {
				const val = this.evaluate(t);
				// Max travel: ~210px across preview track
				const travel = Math.max(0, Math.min(220, val * 210));
				this.previewDotEl.style.transform = `translateX(${travel}px)`;
			}

			this.previewAnimId = requestAnimationFrame(step);
		};

		this.previewAnimId = requestAnimationFrame(step);
	}

	public dispose() {
		if (this.previewAnimId !== null && typeof window !== "undefined") {
			cancelAnimationFrame(this.previewAnimId);
			this.previewAnimId = null;
		}
		if (this.containerEl && typeof this.containerEl.remove === "function") {
			this.containerEl.remove();
		}
	}
}

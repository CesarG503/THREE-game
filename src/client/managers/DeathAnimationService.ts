import type {
	DeathScreenAnimationConfig,
	DeathScreenAnimationPreset,
	DeathScreenAnimationType,
	DeathScreenBackgroundConfig,
	DeathScreenBgAnimationType,
	DeathScreenEasing,
	DeathScreenElement,
	SpectatorTransitionConfig,
} from "../types/experienceMode.types";

type AnimeModule = typeof import("animejs");

let animeModulePromise: Promise<AnimeModule | null> | null = null;
let animeModule: AnimeModule | null = null;

/**
 * Dynamically loads Anime.js v4 to keep it out of the initial application bundle.
 */
export async function loadAnime(): Promise<AnimeModule | null> {
	if (animeModule) return animeModule;
	if (!animeModulePromise) {
		animeModulePromise = import("animejs")
			.then((mod) => {
				animeModule = mod;
				return mod;
			})
			.catch((err) => {
				console.warn("[DeathAnimationService] Error loading Anime.js dynamically:", err);
				return null;
			});
	}
	return animeModulePromise;
}

/**
 * Returns the loaded Anime.js module synchronously if already available.
 */
export function getAnimeSync(): AnimeModule | null {
	return animeModule;
}

/**
 * Resets the cached Anime.js module for testing lazy loading behavior.
 */
export function _resetAnimeModuleForTesting(): void {
	animeModule = null;
	animeModulePromise = null;
}

/**
 * Maps DeathScreenEasing enum or cubic Bézier curves to Anime.js v4 easing definitions.
 */
export function resolveEasing(easing?: DeathScreenEasing | string, bezierCurve?: [number, number, number, number], animeInst?: any): any {
	if (bezierCurve && bezierCurve.length === 4) {
		if (animeInst && typeof animeInst.cubicBezier === "function") {
			return animeInst.cubicBezier(...bezierCurve);
		}
		return `cubicBezier(${bezierCurve.join(",")})`;
	}
	switch (easing) {
		case "linear":
			return "linear";
		case "easeInQuad":
			return "inQuad";
		case "easeOutQuad":
			return "outQuad";
		case "easeInOutQuad":
			return "inOutQuad";
		case "easeOutCubic":
			return "outCubic";
		case "easeOutBack":
			return "outBack";
		case "easeOutElastic":
			return "outElastic";
		default:
			if (typeof easing === "string" && easing.startsWith("cubicBezier")) {
				return easing;
			}
			return "outCubic";
	}
}

export interface AnimationOptions {
	reducedMotion?: boolean;
	onComplete?: () => void;
}

interface AnimatedNodeMeta {
	baseTransform: string;
	baseOpacity?: string;
	baseFilter?: string;
}

/**
 * High-performance animation service for death screens and spectator transitions.
 * Integrates Anime.js v4 with lazy dynamic loading, scoped cancellation,
 * strict conditional element matching by ID, and zero competition with camera physics/raycasting.
 */
export class DeathAnimationService {
	// Scoped active animation sets
	private screenAnimations: Set<any> = new Set();
	private spectatorAnimations: Set<any> = new Set();
	private backgroundAnimations: Set<any> = new Set();

	// Scoped tracked DOM nodes with their original inline styles
	private screenAnimatedNodes: Map<HTMLElement, AnimatedNodeMeta> = new Map();
	private spectatorAnimatedNodes: Map<HTMLElement, AnimatedNodeMeta> = new Map();
	private bgAnimatedNode: HTMLElement | null = null;
	private bgOriginalTransform = "";
	private bgOriginalOpacity = "";
	private bgOriginalFilter = "";
	private scanlinesAnimatedNode: HTMLElement | null = null;

	// Invalidation tokens to prevent cancelled callbacks from executing stale actions
	private screenCallbackToken = 0;
	private spectatorCallbackToken = 0;
	private backgroundCallbackToken = 0;

	// Cached camera controller smoothing for safe restoration
	private spectatorOriginalSmoothing: { controller: any; value: number } | null = null;

	constructor() {
		// Purely on-demand: do not fetch Anime.js at construction/startup.
		// Download is initiated only when an experience triggers death/spectator animations.
	}

	/**
	 * Determines whether reduced motion should be honored.
	 */
	public isReducedMotion(override?: boolean): boolean {
		if (override === true) return true;
		if (typeof window !== "undefined" && window.matchMedia) {
			try {
				return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			} catch {
				return false;
			}
		}
		return false;
	}

	/**
	 * Animates elements entrance when the death screen appears.
	 * Matches each element strictly by its ID. Elements omitted by conditions are safely skipped.
	 */
	public animateScreenEntrance(
		container: HTMLElement,
		elements: DeathScreenElement[],
		config?: DeathScreenAnimationConfig,
		options?: AnimationOptions
	): void {
		if (!container) return;

		// Cancel any existing screen animations cleanly
		this.cancelScreenAnimations(true);

		const isReduced = this.isReducedMotion(options?.reducedMotion);
		const preset = config?.preset ?? "subtle";
		const isEnabled = config?.enabled !== false && preset !== "none" && !isReduced;

		// Index rendered child nodes by elementId / elemId
		const childNodes = Array.from(container.children) as HTMLElement[];
		const elementNodesMap = new Map<string, HTMLElement>();
		childNodes.forEach((node) => {
			const id = node.dataset?.elementId || node.dataset?.elemId;
			if (id) {
				elementNodesMap.set(id, node);
			}
		});

		// Build target pairs strictly matching real rendered DOM nodes by ID
		const targets: Array<{ elem: DeathScreenElement; node: HTMLElement }> = [];
		if (elements && elements.length > 0) {
			for (const elem of elements) {
				const node = elementNodesMap.get(elem.id);
				if (node && node.style) {
					targets.push({ elem, node });
				}
				// If node is not found, the element was hidden by conditions (causes, roles, missing killer, etc.).
				// We do NOT use childNodes[index] as fallback to avoid animating incorrect elements.
			}
		} else {
			// Legacy fallback: animate all direct child nodes
			childNodes.forEach((node, idx) => {
				if (node && node.style) {
					targets.push({
						elem: {
							id: node.dataset?.elementId || node.dataset?.elemId || `node_${idx}`,
							name: `Elemento ${idx}`,
							type: "panel",
							x: 0,
							y: 0,
							width: 0,
							height: 0,
						},
						node,
					});
				}
			});
		}

		if (targets.length === 0 || !isEnabled) {
			// Instant reveal with zero animation
			targets.forEach(({ node }) => {
				if (node.style) {
					node.style.opacity = "1";
				}
			});
			childNodes.forEach((node) => {
				if (node.style) {
					node.style.opacity = "1";
				}
			});
			options?.onComplete?.();
			return;
		}

		const anime = getAnimeSync();
		if (!anime) {
			const runToken = ++this.screenCallbackToken;
			loadAnime()
				.then((loaded) => {
					if (this.screenCallbackToken !== runToken) return;
					if (loaded) {
						this.animateScreenEntrance(container, elements, config, options);
					} else {
						targets.forEach(({ node }) => {
							if (node.style) node.style.opacity = "1";
						});
						childNodes.forEach((node) => {
							if (node.style) node.style.opacity = "1";
						});
						options?.onComplete?.();
					}
				})
				.catch(() => {
					if (this.screenCallbackToken !== runToken) return;
					targets.forEach(({ node }) => {
						if (node.style) node.style.opacity = "1";
					});
					childNodes.forEach((node) => {
						if (node.style) node.style.opacity = "1";
					});
					options?.onComplete?.();
				});
			return;
		}

		const runToken = ++this.screenCallbackToken;
		let defaultDuration = config?.duration ?? 350;
		let defaultEasingName: DeathScreenEasing = (config?.easing as any) ?? "easeOutCubic";
		let staggerMs = config?.stagger ?? 30;

		switch (preset) {
			case "dramatic":
				defaultDuration = config?.duration ?? 650;
				defaultEasingName = (config?.easing as any) ?? "easeOutBack";
				staggerMs = config?.stagger ?? 60;
				break;
			case "arcade":
				defaultDuration = config?.duration ?? 450;
				defaultEasingName = (config?.easing as any) ?? "easeOutElastic";
				staggerMs = config?.stagger ?? 40;
				break;
			case "cinematic":
				defaultDuration = config?.duration ?? 800;
				defaultEasingName = (config?.easing as any) ?? "easeOutCubic";
				staggerMs = config?.stagger ?? 80;
				break;
			case "tactical":
				defaultDuration = config?.duration ?? 300;
				defaultEasingName = (config?.easing as any) ?? "easeOutQuad";
				staggerMs = config?.stagger ?? 35;
				break;
			case "speed":
				defaultDuration = config?.duration ?? 280;
				defaultEasingName = (config?.easing as any) ?? "easeOutCubic";
				staggerMs = config?.stagger ?? 25;
				break;
			case "minimalist":
				defaultDuration = config?.duration ?? 400;
				defaultEasingName = (config?.easing as any) ?? "easeOutQuad";
				staggerMs = config?.stagger ?? 30;
				break;
			case "subtle":
			default:
				defaultDuration = config?.duration ?? 350;
				defaultEasingName = (config?.easing as any) ?? "easeOutCubic";
				staggerMs = config?.stagger ?? 30;
				break;
		}
		const defaultEasing = resolveEasing(defaultEasingName);

		let completedCount = 0;
		const totalCount = targets.length;

		const onOneFinished = () => {
			completedCount++;
			if (completedCount >= totalCount) {
				if (this.screenCallbackToken === runToken) {
					options?.onComplete?.();
				}
			}
		};

		targets.forEach(({ elem, node }, index) => {
			const elemAnim = elem.animation;
			const animType: DeathScreenAnimationType = elemAnim?.type || this.getDefaultAnimationForPreset(preset, elem.type);

			if (animType === "none") {
				node.style.opacity = "1";
				onOneFinished();
				return;
			}

			const duration = elemAnim?.duration ?? defaultDuration;
			const delay = (elemAnim?.delay ?? 0) + index * staggerMs;
			const easing = resolveEasing(elemAnim?.easing ?? (config?.easing as any) ?? defaultEasing);

			// Preserve existing CSS anchor transform (e.g. translate(-50%, -50%))
			const baseTransform = node.style.transform || "";
			this.screenAnimatedNodes.set(node, {
				baseTransform,
				baseOpacity: "1",
			});

			let startX = 0;
			let startY = 0;
			let startScale = 1;
			let startBlur = 0;

			switch (animType) {
				case "slide_up":
					startY = preset === "subtle" ? 14 : 28;
					break;
				case "slide_down":
					startY = preset === "subtle" ? -14 : -28;
					break;
				case "slide_left":
					startX = 30;
					break;
				case "slide_right":
					startX = -30;
					break;
				case "scale_up":
					startScale = preset === "arcade" ? 0.4 : 0.8;
					break;
				case "pop":
					startScale = 0.2;
					break;
				case "rotate_in":
					startScale = 0.6;
					break;
				case "blur_in":
					startBlur = 6;
					break;
				case "fade":
				default:
					break;
			}

			node.style.opacity = "0";
			this.applyTransformWithBase(node, baseTransform, startX, startY, startScale, startBlur);

			const animProxy = {
				opacity: 0,
				x: startX,
				y: startY,
				scale: startScale,
				blur: startBlur,
			};

			const animInstance = anime.animate(animProxy, {
				opacity: 1,
				x: 0,
				y: 0,
				scale: 1,
				blur: 0,
				duration,
				delay,
				ease: easing,
				onUpdate: () => {
					if (this.screenCallbackToken !== runToken || !node.style) return;
					node.style.opacity = String(animProxy.opacity);
					this.applyTransformWithBase(node, baseTransform, animProxy.x, animProxy.y, animProxy.scale, animProxy.blur);
				},
				onComplete: () => {
					this.screenAnimations.delete(animInstance);
					this.screenAnimatedNodes.delete(node);
					if (node.style) {
						node.style.opacity = "1";
						node.style.transform = baseTransform;
						node.style.filter = "";
					}
					onOneFinished();
				},
			});

			this.screenAnimations.add(animInstance);
		});
	}

	/**
	 * Plays exit animation when player respawns or closes the death screen.
	 * If cancelled before completion, onComplete is safely prevented from executing.
	 */
	public animateScreenExit(
		container: HTMLElement,
		onComplete: () => void,
		exitType: "none" | "fade" | "scale_down" | "slide_down" = "fade",
		duration = 200,
		options?: AnimationOptions
	): void {
		if (!container || !container.style) {
			onComplete();
			return;
		}

		// Cancel any pending screen animations
		this.cancelScreenAnimations(false);

		const isReduced = this.isReducedMotion(options?.reducedMotion);
		if (isReduced || exitType === "none" || duration <= 0) {
			onComplete();
			return;
		}

		const anime = getAnimeSync();
		if (!anime) {
			onComplete();
			return;
		}

		const runToken = ++this.screenCallbackToken;
		const baseTransform = container.style.transform || "";
		this.screenAnimatedNodes.set(container, {
			baseTransform,
			baseOpacity: container.style.opacity || "1",
		});

		const proxy = {
			opacity: 1,
			y: 0,
			scale: 1,
		};

		const targetY = exitType === "slide_down" ? 30 : 0;
		const targetScale = exitType === "scale_down" ? 0.94 : 1;

		const animInstance = anime.animate(proxy, {
			opacity: 0,
			y: targetY,
			scale: targetScale,
			duration,
			ease: "outQuad",
			onUpdate: () => {
				if (this.screenCallbackToken !== runToken || !container.style) return;
				container.style.opacity = String(proxy.opacity);
				if (targetY !== 0 || targetScale !== 1) {
					container.style.transform = `${baseTransform} translateY(${proxy.y}px) scale(${proxy.scale})`.trim();
				}
			},
			onComplete: () => {
				this.screenAnimations.delete(animInstance);
				this.screenAnimatedNodes.delete(container);
				if (container.style) {
					container.style.opacity = "1";
					container.style.transform = baseTransform;
				}
				if (this.screenCallbackToken === runToken) {
					onComplete();
				}
			},
		});

		this.screenAnimations.add(animInstance);
	}

	/**
	 * Smooth visual transition on HUD when switching spectator targets or perspective.
	 * Preserves CameraController's stable physics and raycasting without look-back spin artifacts.
	 * If rapid switching occurs, previous spectator transitions are cleanly replaced.
	 */
	public animateSpectatorSwitch(
		cameraController: any,
		hudElement: HTMLElement | null,
		transition?: SpectatorTransitionConfig,
		reducedMotion?: boolean
	): void {
		// Cleanly cancel previous spectator animations before starting new one
		this.cancelSpectatorAnimations(true);

		const isReduced = this.isReducedMotion(reducedMotion);
		if (isReduced || transition?.enabled === false || transition?.style === "instant") {
			return;
		}

		const anime = getAnimeSync();
		if (!anime) {
			loadAnime().catch(() => {});
			return;
		}

		// Ensure baseline smoothing is preserved
		if (cameraController && typeof cameraController.smoothing === "number") {
			if (!this.spectatorOriginalSmoothing) {
				this.spectatorOriginalSmoothing = {
					controller: cameraController,
					value: cameraController.smoothing,
				};
			}
		}

		// Animate HUD pill with subtle bounce/pulse feedback
		if (hudElement && hudElement.style) {
			const runToken = ++this.spectatorCallbackToken;
			const baseTransform = "translateX(-50%)";
			this.spectatorAnimatedNodes.set(hudElement, { baseTransform });

			const hudProxy = { scale: 0.94, opacity: 0.7 };
			const duration = transition?.duration ? Math.min(350, transition.duration) : 300;

			const hudAnim = anime.animate(hudProxy, {
				scale: 1,
				opacity: 1,
				duration,
				ease: "outBack",
				onUpdate: () => {
					if (this.spectatorCallbackToken !== runToken || !hudElement.style) return;
					hudElement.style.transform = `${baseTransform} scale(${hudProxy.scale})`;
					hudElement.style.opacity = String(hudProxy.opacity);
				},
				onComplete: () => {
					this.spectatorAnimations.delete(hudAnim);
					this.spectatorAnimatedNodes.delete(hudElement);
					if (hudElement.style) {
						hudElement.style.transform = baseTransform;
						hudElement.style.opacity = "1";
					}
				},
			});

			this.spectatorAnimations.add(hudAnim);
		}
	}

	/**
	 * Cancels all death screen animations and restores expected styles.
	 */
	public cancelScreenAnimations(restoreStyles = true): void {
		this.screenCallbackToken++;
		this.cancelBackgroundAnimation(restoreStyles);

		this.screenAnimations.forEach((anim) => {
			try {
				if (typeof anim.cancel === "function") {
					anim.cancel();
				} else if (typeof anim.pause === "function") {
					anim.pause();
				}
			} catch {}
		});
		this.screenAnimations.clear();

		if (restoreStyles) {
			this.screenAnimatedNodes.forEach((meta, node) => {
				if (node && node.style) {
					node.style.opacity = meta.baseOpacity !== undefined ? meta.baseOpacity : "1";
					node.style.transform = meta.baseTransform;
					node.style.filter = meta.baseFilter || "";
				}
			});
		}
		this.screenAnimatedNodes.clear();
	}

	/**
	 * Cancels all spectator animations and restores camera and HUD state.
	 */
	public cancelSpectatorAnimations(restoreStyles = true): void {
		this.spectatorCallbackToken++;

		this.spectatorAnimations.forEach((anim) => {
			try {
				if (typeof anim.cancel === "function") {
					anim.cancel();
				} else if (typeof anim.pause === "function") {
					anim.pause();
				}
			} catch {}
		});
		this.spectatorAnimations.clear();

		// Always restore camera controller smoothing to original value
		if (this.spectatorOriginalSmoothing) {
			try {
				this.spectatorOriginalSmoothing.controller.smoothing = this.spectatorOriginalSmoothing.value;
			} catch {}
			this.spectatorOriginalSmoothing = null;
		}

		if (restoreStyles) {
			this.spectatorAnimatedNodes.forEach((meta, node) => {
				if (node && node.style) {
					node.style.opacity = "1";
					node.style.transform = meta.baseTransform;
					node.style.filter = "";
				}
			});
		}
		this.spectatorAnimatedNodes.clear();
	}

	/**
	 * Animates the background layer independently from HUD and screen elements.
	 * Operates exclusively on the background DOM node using GPU transforms to prevent reflows.
	 */
	public animateBackground(
		bgLayer: HTMLElement,
		config?: DeathScreenBackgroundConfig,
		options?: AnimationOptions
	): void {
		if (!bgLayer) return;

		this.cancelBackgroundAnimation(true);

		const isReduced = this.isReducedMotion(options?.reducedMotion);
		const animConfig = config?.animation;
		const isEnabled = config?.type === "animated" || (animConfig?.enabled && animConfig.type !== "none");

		if (isReduced || !isEnabled || !animConfig || animConfig.type === "none") {
			bgLayer.style.transform = "";
			bgLayer.style.filter = "";
			return;
		}

		const anime = getAnimeSync();
		if (!anime) {
			const runToken = ++this.backgroundCallbackToken;
			loadAnime()
				.then((loaded) => {
					if (this.backgroundCallbackToken !== runToken) return;
					if (loaded) {
						this.animateBackground(bgLayer, config, options);
					}
				})
				.catch(() => {});
			return;
		}

		this.bgAnimatedNode = bgLayer;
		this.bgOriginalTransform = bgLayer.style.transform || "";
		this.bgOriginalOpacity = bgLayer.style.opacity || "";
		this.bgOriginalFilter = bgLayer.style.filter || "";
		bgLayer.style.willChange = "transform, opacity, filter";

		const runToken = ++this.backgroundCallbackToken;
		const animType = animConfig.type || "ken_burns";
		const duration = animConfig.duration ?? 8000;

		if (animType === "ken_burns") {
			// Subtle zoom and slight drift
			const proxy = { scale: 1.0, x: 0, y: 0 };
			const animInstance = anime.animate(proxy, {
				scale: 1.08,
				x: 8,
				y: -6,
				duration,
				ease: "inOutQuad",
				alternate: true,
				loop: true,
				onUpdate: () => {
					if (this.backgroundCallbackToken !== runToken || !bgLayer.style) return;
					bgLayer.style.transform = `scale(${proxy.scale}) translate(${proxy.x}px, ${proxy.y}px)`;
				},
			});
			this.backgroundAnimations.add(animInstance);
		} else if (animType === "pulse_glow") {
			// Pulsing brightness / contrast
			const proxy = { brightness: 1.0, contrast: 1.0 };
			const animInstance = anime.animate(proxy, {
				brightness: 1.25,
				contrast: 1.15,
				duration: Math.max(1000, duration / 3),
				ease: "inOutQuad",
				alternate: true,
				loop: true,
				onUpdate: () => {
					if (this.backgroundCallbackToken !== runToken || !bgLayer.style) return;
					bgLayer.style.filter = `brightness(${proxy.brightness}) contrast(${proxy.contrast})`;
				},
			});
			this.backgroundAnimations.add(animInstance);
		} else if (animType === "pan") {
			// Horizontal panning
			const proxy = { x: -15 };
			const animInstance = anime.animate(proxy, {
				x: 15,
				duration,
				ease: "inOutQuad",
				alternate: true,
				loop: true,
				onUpdate: () => {
					if (this.backgroundCallbackToken !== runToken || !bgLayer.style) return;
					bgLayer.style.transform = `scale(1.05) translateX(${proxy.x}px)`;
				},
			});
			this.backgroundAnimations.add(animInstance);
		} else if (animType === "scanlines") {
			const scanlinesEl = bgLayer.querySelector(
				".viper-death-bg-scanlines, .viper-death-canvas-bg-scanlines, [class*='scanlines']"
			) as HTMLElement | null;
			const targetNode = scanlinesEl || bgLayer;
			this.scanlinesAnimatedNode = scanlinesEl;

			const proxy = { y: 0, opacity: 0.75 };
			const animInstance = anime.animate(proxy, {
				y: 24,
				opacity: 0.9,
				duration: 1200,
				ease: "linear",
				loop: true,
				alternate: true,
				onUpdate: () => {
					if (this.backgroundCallbackToken !== runToken || !targetNode.style) return;
					if (scanlinesEl) {
						scanlinesEl.style.backgroundPositionY = `${proxy.y}px`;
						scanlinesEl.style.opacity = String(proxy.opacity);
					} else {
						targetNode.style.opacity = String(proxy.opacity);
					}
				},
			});
			this.backgroundAnimations.add(animInstance);
		}
	}

	/**
	 * Cancels background animations and restores initial styles.
	 */
	public cancelBackgroundAnimation(restoreStyles = true): void {
		this.backgroundCallbackToken++;

		this.backgroundAnimations.forEach((anim) => {
			try {
				if (typeof anim.cancel === "function") anim.cancel();
				else if (typeof anim.pause === "function") anim.pause();
			} catch {}
		});
		this.backgroundAnimations.clear();

		if (restoreStyles && this.bgAnimatedNode && this.bgAnimatedNode.style) {
			this.bgAnimatedNode.style.transform = this.bgOriginalTransform;
			this.bgAnimatedNode.style.filter = this.bgOriginalFilter;
			this.bgAnimatedNode.style.opacity = this.bgOriginalOpacity;
			this.bgAnimatedNode.style.willChange = "";
		}
		if (restoreStyles && this.scanlinesAnimatedNode && this.scanlinesAnimatedNode.style) {
			this.scanlinesAnimatedNode.style.backgroundPositionY = "";
			this.scanlinesAnimatedNode.style.opacity = "";
		}
		this.scanlinesAnimatedNode = null;
		this.bgAnimatedNode = null;
		this.bgOriginalTransform = "";
		this.bgOriginalOpacity = "";
		this.bgOriginalFilter = "";
	}

	/**
	 * Cancels all active animations across all scopes.
	 */
	public cancelAll(restoreStyles = true): void {
		this.cancelScreenAnimations(restoreStyles);
		this.cancelSpectatorAnimations(restoreStyles);
		this.cancelBackgroundAnimation(restoreStyles);
	}

	/**
	 * Full cleanup on destruction.
	 */
	public dispose(): void {
		this.cancelAll(true);
	}

	public destroy(): void {
		this.dispose();
	}

	private applyTransformWithBase(
		node: HTMLElement,
		baseTransform: string,
		x: number,
		y: number,
		scale: number,
		blur: number
	): void {
		let transformResult = baseTransform;
		if (x !== 0 || y !== 0) {
			transformResult += ` translate(${x}px, ${y}px)`;
		}
		if (scale !== 1) {
			transformResult += ` scale(${scale})`;
		}
		node.style.transform = transformResult.trim();

		if (blur > 0) {
			node.style.filter = `blur(${blur}px)`;
		} else {
			node.style.filter = "";
		}
	}

	private getDefaultAnimationForPreset(preset: string, elemType: string): DeathScreenAnimationType {
		switch (preset) {
			case "none":
				return "none";
			case "dramatic":
				return elemType === "title" ? "scale_up" : "slide_up";
			case "arcade":
				return "scale_up";
			case "cinematic":
				return elemType === "title" ? "blur_in" : "fade";
			case "tactical":
				return elemType === "title" ? "slide_down" : (elemType === "panel" ? "fade" : "slide_up");
			case "speed":
				return elemType === "title" ? "slide_left" : "slide_right";
			case "minimalist":
				return "fade";
			case "subtle":
			default:
				return "slide_up";
		}
	}
}

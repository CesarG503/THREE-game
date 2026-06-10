import { animate } from 'animejs'
import type { HUDConfig, UIPosition, UIPositionObject } from '../types'
import {
    applyResponsivePosition,
    applyViewportConstraint,
    clamp,
    fitLength,
    getViewportMetrics,
    hasViewportConstraint,
    keepElementInsideContainer,
    resolveAnchoredPosition,
    scaleHUDValue,
    scalePixelPosition
} from './modules/HUDResponsiveUtils'

export class GameHUD {
    container: HTMLElement;
    timerElement: HTMLElement | null;
    healthElement: HTMLElement | null;
    jumpElement: HTMLElement | null;
    inventoryElement: HTMLElement | null;
    settings: HUDConfig;
    resizeTimer: number | null;
    layoutFrameId: number | null;
    lastHealth: { current: number; max: number } | null;
    lastJump: { current: number; max: number } | null;
    onViewportChange: () => void;
    isDestroyed: boolean;

    constructor() {
        this.container = document.createElement('div')
        this.container.id = 'game-hud-layer'
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            overflow: hidden;
            pointer-events: none; z-index: 1000;
        `
        document.body.appendChild(this.container)

        this.timerElement = null
        this.healthElement = null
        this.jumpElement = null
        this.inventoryElement = null

        this.settings = {}
        this.resizeTimer = null
        this.layoutFrameId = null
        this.lastHealth = null
        this.lastJump = null
        this.isDestroyed = false

        this.onViewportChange = () => {
            if (this.isDestroyed) return
            if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer)
            this.resizeTimer = window.setTimeout(() => {
                this.resizeTimer = null
                if (!this.isDestroyed && this.settings) this.createHUD(this.settings)
            }, 80)
        }

        window.addEventListener('resize', this.onViewportChange)
        window.visualViewport?.addEventListener('resize', this.onViewportChange)
        window.visualViewport?.addEventListener('scroll', this.onViewportChange)
    }

    createHUD(settings: HUDConfig) {
        if (this.isDestroyed) return
        this.settings = settings || {};
        const sharedInventory = document.getElementById('inventory-container')

        // Clear existing (except timer)
        if (this.healthElement) this.healthElement.remove();
        if (this.jumpElement) this.jumpElement.remove();
        // Do not remove inventoryElement as it is a shared DOM element
        if (this.inventoryElement && this.inventoryElement.id !== 'inventory-container') {
            this.inventoryElement.remove();
        } else if (this.inventoryElement) {
            // If we are hiding it this turn
            if (!this.settings.showInventory) {
                this.inventoryElement.style.display = 'none';
            }
        }

        if (!this.settings.showInventory && sharedInventory) {
            sharedInventory.style.display = 'none'
        }

        const layerOrder = this.settings.layerOrder || ['health', 'jump', 'inventory'];
        // User wants: Last in list = Bottom Layer
        // DOM: First appended = Bottom Layer
        // So we append in reverse order of the list (Last -> First)
        // List: [Top, Middle, Bottom] -> Append: Bottom, Middle, Top.
        // wait, user said "el ultimo objeto en la lista sera el que estara abajo de todo"
        // List: [A, B, C] -> C is Bottom.
        // So append C first (index 2), then B (1), then A (0).
        // Iterate backwards.

        for (let i = layerOrder.length - 1; i >= 0; i--) {
            const id = layerOrder[i];
            if (id === 'health' && this.settings.showHealth) this.createHealth(this.settings);
            else if (id === 'jump' && this.settings.showJump) this.createJump(this.settings);
            else if (id === 'inventory' && this.settings.showInventory) this.createInventory(this.settings);
        }

        this.applyHUDConstraints()
        this.applyHUDAnchors()
        this.keepHUDInsideViewport()
        this.applyHUDConstraints()
        this.applyHUDAnchors()
        this.keepHUDInsideViewport()
        if (this.lastHealth) this.updateHealth(this.lastHealth.current, this.lastHealth.max)
        if (this.lastJump) this.updateJump(this.lastJump.current, this.lastJump.max)
        this.applyLayerOrder()
        this.scheduleLayoutStabilization()
    }

    scheduleLayoutStabilization() {
        if (this.layoutFrameId !== null) {
            cancelAnimationFrame(this.layoutFrameId)
            this.layoutFrameId = null
        }

        this.layoutFrameId = requestAnimationFrame(() => {
            this.layoutFrameId = null
            if (this.isDestroyed) return

            this.applyHUDConstraints()
            this.applyHUDAnchors()
            this.keepHUDInsideViewport()
            this.applyLayerOrder()
        })
    }

    createHealth(s: HUDConfig) {
        const el = document.createElement('div');
        el.id = 'hud-health';
        el.style.cssText = `display: flex; gap: 5px; position: absolute; pointer-events: none;`; // Add pointer-events none to container

        // Orientation
        if (s.healthOrientation === 'vertical') {
            el.style.flexDirection = 'column-reverse';
            el.style.alignItems = 'center';
        } else {
            el.style.flexDirection = 'row';
            el.style.alignItems = 'center';
        }

        if (s.healthStyle === 'bar') {
            const w = fitLength(s.healthWidth || 300, this.container, 'x', 2);
            const h = fitLength(s.healthHeight || 20, this.container, 'y', 1);
            const isVert = s.healthOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';
            const border = h <= 4 || w <= 10 ? 0 : clamp(Math.floor(Math.min(w, h) / 8), 1, 2);
            const showText = s.healthShowText && w >= 44 && h >= 10;
            const fontSize = clamp(Math.round(Math.min(w, h) / 1.5), 6, 24);

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border: ${border}px solid #333; border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden; box-sizing:border-box;">
                    <div id="health-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #ff3333, #ff6666); transform-origin: ${isVert ? 'bottom' : 'left'};"></div>
                    ${showText ?
                    `<div id="health-text" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${fontSize}px; font-weight:bold; text-shadow:1px 1px 1px black;">100 / 100</div>`
                    : ''}
                </div>
            `;
        } else if (s.healthStyle === 'hearts') {
            const fontSize = scaleHUDValue(24, this.container, 16, 24);
            el.innerHTML = `<span style="font-size:${fontSize}px; color:#ff3333;">❤❤❤❤</span><span style="font-size:${fontSize}px; color:#555;">♡</span>`;
        } else {
            const fontSize = scaleHUDValue(40, this.container, 22, 40);
            el.innerHTML = `<span id="health-text-simple" style="font-size:${fontSize}px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">100</span>`;
        }

        this.applyPosition(el, s.healthPos);
        this.container.appendChild(el);
        this.healthElement = el;
    }

    createJump(s: HUDConfig) {
        const el = document.createElement('div');
        el.id = 'hud-jump';
        el.style.cssText = `display: flex; align-items: center; position: absolute; pointer-events: none;`;

        // Orientation
        if (s.jumpOrientation === 'vertical') {
            el.style.flexDirection = 'column-reverse';
        } else {
            el.style.flexDirection = 'row';
        }

        if (s.jumpStyle === 'bar') {
            const w = fitLength(s.jumpWidth || 200, this.container, 'x', 2);
            const h = fitLength(s.jumpHeight || 8, this.container, 'y', 1);
            const isVert = s.jumpOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';
            const showText = s.jumpShowText && w >= 32 && h >= 8;
            const fontSize = clamp(Math.round(Math.min(w, h) / 1.5), 6, 18);

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border-radius: ${Math.min(w, h) / 2}px; overflow:hidden; position:relative; box-sizing:border-box;">
                    <div id="jump-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #33ccff, #3388ff); transform-origin: ${isVert ? 'bottom' : 'left'};"></div>
                     ${showText ?
                    `<div id="jump-text" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${fontSize}px; font-weight:bold; text-shadow:1px 1px 1px black;">1</div>`
                    : ''}
                </div>
            `;
        } else {
            const size = scaleHUDValue(50, this.container, 34, 50);
            const center = size / 2;
            const radius = Math.max(10, Math.round(size * 0.4));
            const stroke = Math.max(3, Math.round(size * 0.1));
            const dash = 2 * Math.PI * radius;
            el.innerHTML = `
               <svg width="${size}" height="${size}" data-radius="${radius}" style="transform: rotate(-90deg)">
                   <circle cx="${center}" cy="${center}" r="${radius}" stroke="rgba(0,0,0,0.5)" stroke-width="${stroke}" fill="transparent"/>
                   <circle id="jump-circle-fill" cx="${center}" cy="${center}" r="${radius}" stroke="#33ccff" stroke-width="${stroke}" fill="transparent" stroke-dasharray="${dash}" stroke-dashoffset="${dash}"/>
               </svg>
            `;
        }

        this.applyPosition(el, s.jumpPos);
        this.container.appendChild(el);
        this.jumpElement = el;
    }

    createInventory(s: HUDConfig) {
        // Use existing inventory container from game.html
        const el = document.getElementById('inventory-container');

        if (el) {
            // Ensure it's visible (GameHUD manages visibility now based on settings)
            el.style.display = 'flex';
            if (el.parentElement !== this.container) {
                this.container.appendChild(el);
            }
            // Ensure interactive events are allowed on the inventory despite game-hud-layer's pointer-events: none
            el.style.pointerEvents = 'auto';
            // Prevent stretching
            el.style.width = 'max-content';
            el.style.height = 'max-content';

            // Apply positioning from settings
            this.applyPosition(el, s.inventoryPos);

            // Apply Container Style
            const padding = s.inventoryPadding !== undefined ? s.inventoryPadding : 10;
            const baseWidth = s.inventoryContainerWidth || 300;
            const baseHeight = s.inventoryContainerHeight || 100;
            const isFree = s.inventoryFreeLayout;
            const targetCount = s.inventorySlots || 9;
            const metrics = getViewportMetrics(this.container);
            const scaledPadding = scaleHUDValue(padding, this.container, 4, 24);
            let slotSize = scaleHUDValue(s.inventorySlotSize || 50, this.container, 28, 100);
            const availableWidth = Math.max(80, metrics.width - metrics.edge * 2);
            const availableHeight = Math.max(80, metrics.height - metrics.edge * 2);

            if (!isFree) {
                const fittedSlot = Math.floor((availableWidth - scaledPadding * 2 - Math.max(0, targetCount - 1) * scaledPadding) / targetCount);
                slotSize = clamp(slotSize, 24, Math.max(24, fittedSlot));
            }

            const width = Math.min(scaleHUDValue(baseWidth, this.container, 60), availableWidth);
            const height = Math.min(scaleHUDValue(baseHeight, this.container, 50), availableHeight);
            const scaledAutoWidth = targetCount * slotSize + Math.max(0, targetCount - 1) * scaledPadding + scaledPadding * 2;
            const scaledAutoHeight = slotSize + scaledPadding * 2;

            // Allow container configuration
            // If user has set specific width/height in config, use it. Otherwise use max-content or similar?
            // If free layout is ON, we definitely need dimensions.
            if (s.inventoryContainerWidth) el.style.width = `${width}px`;
            else el.style.width = isFree ? `${width}px` : `${Math.min(scaledAutoWidth, availableWidth)}px`;

            const finalHeight = s.inventoryContainerHeight
                ? Math.min(Math.max(height, scaledAutoHeight), availableHeight)
                : Math.min(isFree ? height : scaledAutoHeight, availableHeight);
            el.style.height = `${finalHeight}px`;

            el.style.padding = `${scaledPadding}px`;
            el.style.boxSizing = 'border-box'; // Ensure padding doesn't expand width if set

            // Layout Mode
            if (isFree) {
                el.style.display = 'block'; // Block to allow absolute children relative to it
                el.style.position = 'fixed';
            } else {
                el.style.position = 'fixed';
                el.style.display = 'grid';
                el.style.gap = `${scaledPadding}px`;
                el.style.gridTemplateColumns = `repeat(auto-fit, minmax(${slotSize}px, ${slotSize}px))`;
                el.style.gridAutoRows = `${slotSize}px`;

                // Apply Alignment
                const align = s.inventorySlotAlignment || 'center';
                let justify = 'center';
                let alignContent = 'center';
                let justifyItems = 'center';
                let alignItems = 'center';

                switch (align) {
                    case 'top-left': justify = 'start'; alignContent = 'start'; break;
                    case 'top-center': justify = 'center'; alignContent = 'start'; break;
                    case 'top-right': justify = 'end'; alignContent = 'start'; break;
                    case 'center-left': justify = 'start'; alignContent = 'center'; break;
                    case 'center': justify = 'center'; alignContent = 'center'; alignItems = 'center'; break;
                    case 'center-right': justify = 'end'; alignContent = 'center'; break;
                    case 'bottom-left': justify = 'start'; alignContent = 'end'; break;
                    case 'bottom-center': justify = 'center'; alignContent = 'end'; break;
                    case 'bottom-right': justify = 'end'; alignContent = 'end'; break;
                }

                el.style.justifyContent = justify;
                el.style.alignContent = alignContent;
                el.style.justifyItems = justifyItems;
                el.style.alignItems = alignItems;
            }

            // Handle slot visibility and size based on settings
            const slots = el.querySelectorAll<HTMLElement>('.inventory-slot');
            slots.forEach((slot, index) => {
                // Apply Size
                slot.style.width = `${slotSize}px`;
                slot.style.height = `${slotSize}px`;
                slot.style.boxSizing = 'border-box';

                // Update Number Font Size
                const num = slot.querySelector<HTMLElement>('.slot-number');
                if (num) {
                    num.style.fontSize = `${Math.max(10, slotSize / 5)}px`;
                    // Restore numbers if they were moved
                    num.style.position = 'absolute';
                    num.style.top = '2px';
                    num.style.left = '5px';
                }

                if (index < targetCount) {
                    slot.style.display = 'flex';

                    if (isFree) {
                        slot.style.position = 'absolute';
                        const pos = (s.inventorySlotPositions && s.inventorySlotPositions[index])
                            ? scalePixelPosition(s.inventorySlotPositions[index], metrics.scale)
                            : { left: `${scaledPadding + (index * (slotSize + scaledPadding))}px`, top: `${scaledPadding}px` }; // Fallback simple internal layout

                        slot.style.left = pos.left;
                        slot.style.top = pos.top;
                    } else {
                        slot.style.position = 'relative';
                        slot.style.left = 'auto';
                        slot.style.top = 'auto';
                    }

                } else {
                    slot.style.display = 'none';
                }
            });

            this.inventoryElement = el;
        } else {
            console.warn("GameHUD: #inventory-container not found in DOM.");
        }
    }

    updateHealth(current: number, max: number) {
        this.lastHealth = { current, max };
        if (!this.healthElement) return;

        // Ensure valid numbers
        current = typeof current === 'number' ? current : 100;
        max = (typeof max === 'number' && max > 0) ? max : 100;

        // Health Bar
        if (this.settings.healthStyle === 'bar') {
            const fill = this.healthElement.querySelector<HTMLElement>('#health-bar-fill');
            const text = this.healthElement.querySelector<HTMLElement>('#health-text');
            const percentage = Math.max(0, Math.min(100, (current / max) * 100));

            if (fill) {
                // Determine property based on orientation
                const isVert = this.settings.healthOrientation === 'vertical';
                const prop = isVert ? 'height' : 'width';

                // API v4: animate(targets, parameters)
                animate(fill, {
                    [prop]: `${percentage}%`,
                    easing: 'easeOutQuad',
                    duration: 300
                });
            }

            if (text) {
                text.textContent = `${Math.round(current)} / ${max}`;
            }

        } else if (this.settings.healthStyle === 'hearts') {
            // Hearts logic (simplified for now, just text change or visual)
            // ... existing heart logic or placeholder
            const hearts = Math.ceil((current / max) * 5);
            let hStr = "";
            for (let i = 0; i < 5; i++) hStr += (i < hearts ? "❤" : "♡");
            this.healthElement.innerHTML = `<span style="font-size:24px; color:#ff3333;">${hStr}</span>`;

        } else {
            // Simple Text
            const txt = this.healthElement.querySelector<HTMLElement>('#health-text-simple');
            if (txt) txt.textContent = Math.round(current).toString();
        }
    }

    updateJump(current: number, max: number) {
        this.lastJump = { current, max };
        if (!this.jumpElement) return;

        // Ensure valid numbers
        current = typeof current === 'number' ? current : 0;
        max = (typeof max === 'number' && max > 0) ? max : 1;

        if (this.settings.jumpStyle === 'bar') {
            const fill = this.jumpElement.querySelector<HTMLElement>('#jump-bar-fill');
            const text = this.jumpElement.querySelector<HTMLElement>('#jump-text'); // If text is enabled
            const percentage = Math.max(0, Math.min(100, (current / max) * 100));

            if (fill) {
                const isVert = this.settings.jumpOrientation === 'vertical';
                const prop = isVert ? 'height' : 'width';

                // API v4: animate(targets, parameters)
                animate(fill, {
                    [prop]: `${percentage}%`,
                    easing: 'easeOutQuad',
                    duration: 100
                });
            }
            if (text) {
                text.textContent = Math.floor(current).toString();
            }

        } else {
            // Circle
            const circle = this.jumpElement.querySelector<HTMLElement>('#jump-circle-fill');
            if (circle) {
                const svg = circle.closest('svg');
                const radius = parseFloat(svg?.getAttribute('data-radius') || '20');
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - ((current / max) * circumference);

                // API v4: animate(targets, parameters)
                animate(circle, {
                    strokeDashoffset: offset.toString(),
                    easing: 'linear',
                    duration: 100
                });
            }
        }
    }

    applyPosition(el: HTMLElement, pos?: UIPosition) {
        if (!pos) return;
        
        // Handle position object
        if (typeof pos === 'object' && pos !== null) {
            applyResponsivePosition(el, pos as UIPositionObject);
        }
        
        // Handle predefined strings
        if (typeof pos === 'string') {
            this.applyPresetPosition(el, pos);
        }
    }

    applyPresetPosition(el: HTMLElement, pos: string) {
        const margin = "20px"
        switch (pos) {
            case 'top-left':
                el.style.top = margin; el.style.left = margin;
                break;
            case 'top-center':
                el.style.top = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
            case 'top-right':
                el.style.top = margin; el.style.right = margin;
                break;
            case 'middle-left':
                el.style.top = "50%"; el.style.left = margin; el.style.transform = "translateY(-50%)";
                break;
            case 'center':
                el.style.top = "50%"; el.style.left = "50%"; el.style.transform = "translate(-50%, -50%)";
                break;
            case 'middle-right':
                el.style.top = "50%"; el.style.right = margin; el.style.transform = "translateY(-50%)";
                break;
            case 'bottom-left':
                el.style.bottom = margin; el.style.left = margin;
                break;
            case 'bottom-center':
                el.style.bottom = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
            case 'bottom-right':
                el.style.bottom = margin; el.style.right = margin;
                break;
            default: // Default Top Center
                el.style.top = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
        }
    }

    getHudElement(id: string) {
        if (id === 'health') return this.healthElement;
        if (id === 'jump') return this.jumpElement;
        if (id === 'inventory') return this.inventoryElement;
        if (id.startsWith('fz_')) return document.getElementById(`fz-counter-${id.substring(3)}`);
        return null;
    }

    getRenderedHudIds() {
        const ids: string[] = [];
        if (this.healthElement) ids.push('health');
        if (this.jumpElement) ids.push('jump');
        Array.from(this.container.querySelectorAll<HTMLElement>('[id^="fz-counter-"]')).forEach(el => {
            ids.push(`fz_${el.id.substring('fz-counter-'.length)}`);
        });
        return ids;
    }

    getResolvedLayerOrder() {
        const layerOrder = [...(this.settings.layerOrder || ['health', 'jump', 'inventory'])];
        this.getRenderedHudIds().forEach(id => {
            if (!layerOrder.includes(id)) layerOrder.push(id);
        });
        if (!layerOrder.includes('inventory')) layerOrder.push('inventory');
        return layerOrder;
    }

    isAboveInventory(id: string) {
        return this.isAboveParent(id, 'inventory');
    }

    isAboveParent(childId: string, parentId: string) {
        const child = this.getHudElement(childId);
        const parent = this.getHudElement(parentId);
        if (!child || !parent) return false;

        const childZ = parseInt(child.style.zIndex || getComputedStyle(child).zIndex || '0', 10) || 0;
        const parentZ = parseInt(parent.style.zIndex || getComputedStyle(parent).zIndex || '0', 10) || 0;
        if (childZ !== parentZ) return childZ > parentZ;

        const layerOrder = this.getResolvedLayerOrder();
        const childIndex = layerOrder.indexOf(childId);
        const parentIndex = layerOrder.indexOf(parentId);
        return childIndex !== -1 && parentIndex !== -1 && childIndex < parentIndex;
    }

    applyHUDConstraints(ids?: string[]) {
        const constraints = this.settings.hudConstraints || {};
        const targetIds = ids || Object.keys(constraints);

        targetIds.forEach(id => {
            const constraint = constraints[id];
            if (!hasViewportConstraint(constraint)) return;

            const el = this.getHudElement(id);
            if (!el) return;

            applyViewportConstraint(el, this.container, constraint);
            el.dataset.hudConstraint = 'viewport';
        });
    }

    applyHUDAnchors() {
        const anchors = this.settings.hudAnchors || {};

        Object.keys(anchors).forEach(id => {
            const anchor = anchors[id];
            const el = this.getHudElement(id);
            if (!el) return;

            if (hasViewportConstraint(this.settings.hudConstraints?.[id]) ||
                !anchor ||
                !anchor.parentId ||
                !anchor.pos ||
                !this.isAboveParent(id, anchor.parentId)) {
                delete el.dataset.hudParent;
                return;
            }

            const parentEl = this.getHudElement(anchor.parentId);
            if (!parentEl) return;

            const resolved = resolveAnchoredPosition(this.container, parentEl, anchor.pos);
            if (!resolved) return;

            el.dataset.hudParent = anchor.parentId;
            el.style.left = resolved.left;
            el.style.top = resolved.top;
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none';
        });
    }

    keepHUDInsideViewport() {
        const inventory = this.getHudElement('inventory');
        if (inventory) keepElementInsideContainer(inventory, this.container);

        this.getRenderedHudIds().forEach(id => {
            const el = this.getHudElement(id);
            if (el) keepElementInsideContainer(el, this.container);
        });
    }

    applyLayerOrder() {
        const elementById = new Map<string, HTMLElement | null>([
            ['health', this.healthElement],
            ['jump', this.jumpElement],
            ['inventory', this.inventoryElement]
        ]);

        Array.from(this.container.querySelectorAll<HTMLElement>('[id^="fz-counter-"]')).forEach(el => {
            elementById.set(`fz_${el.id.substring('fz-counter-'.length)}`, el);
        });

        const layerOrder = [...(this.settings.layerOrder || ['health', 'jump', 'inventory'])];
        elementById.forEach((_, id) => {
            if (!layerOrder.includes(id)) layerOrder.push(id);
        });

        const topBase = 100;
        layerOrder.forEach((id, index) => {
            const el = elementById.get(id);
            if (!el) return;
            el.style.zIndex = `${topBase + layerOrder.length - index}`;
        });

        if (this.timerElement) {
            this.timerElement.style.zIndex = `${topBase + layerOrder.length + 1}`;
        }
    }

    updateTimer(timeSeconds: number, style: string, position: UIPosition = 'top-center') {
        if (!this.timerElement) {
            this.timerElement = document.createElement('div')
            this.timerElement.id = 'game-timer-display'
            this.container.appendChild(this.timerElement)
        }

        const h = Math.floor(timeSeconds / 3600)
        const m = Math.floor((timeSeconds % 3600) / 60)
        const s = Math.ceil(timeSeconds % 60)

        const pad = (n: number) => n.toString().padStart(2, '0')
        const text = (h > 0 ? `${pad(h)}:` : '') + `${pad(m)}:${pad(s)}`

        this.timerElement.textContent = text
        this.timerElement.style.display = 'flex'

        // Reset base styles
        this.timerElement.className = ''
        this.timerElement.style.cssText = `
            position: absolute; display: flex; align-items: center; justify-content: center;
        `

        // Apply Position
        this.applyPosition(this.timerElement, position)

        // Apply Styles
        if (style === 'style1') { // Digital Neon
            this.applyNeonStyle(this.timerElement)
        } else if (style === 'style2') { // Minimalist
            this.applyMinimalStyle(this.timerElement)
        } else if (style === 'style3') { // Sports Box
            this.applySportsStyle(this.timerElement)
        } else {
            this.applyNeonStyle(this.timerElement)
        }
    }

    hideTimer() {
        if (this.timerElement) {
            this.timerElement.style.display = 'none'
        }
    }

    destroy() {
        if (this.isDestroyed) return
        this.isDestroyed = true

        if (this.resizeTimer !== null) {
            window.clearTimeout(this.resizeTimer)
            this.resizeTimer = null
        }

        if (this.layoutFrameId !== null) {
            cancelAnimationFrame(this.layoutFrameId)
            this.layoutFrameId = null
        }

        window.removeEventListener('resize', this.onViewportChange)
        window.visualViewport?.removeEventListener('resize', this.onViewportChange)
        window.visualViewport?.removeEventListener('scroll', this.onViewportChange)

        const inventory = document.getElementById('inventory-container')
        if (inventory) {
            document.body.appendChild(inventory)
            inventory.style.display = 'none'
            inventory.style.visibility = 'visible'
            inventory.style.opacity = '1'
        }

        this.healthElement?.remove()
        this.jumpElement?.remove()
        this.timerElement?.remove()
        this.container.remove()

        this.healthElement = null
        this.jumpElement = null
        this.timerElement = null
        this.inventoryElement = null
    }

    // --- STYLES ---

    applyNeonStyle(el: HTMLElement) {
        const fontSize = scaleHUDValue(40, this.container, 24, 40)
        const padY = scaleHUDValue(10, this.container, 6, 10)
        const padX = scaleHUDValue(30, this.container, 14, 30)
        el.style.fontFamily = "'Courier New', monospace"
        el.style.fontSize = `${fontSize}px`
        el.style.fontWeight = "bold"
        el.style.color = "#0ff"
        el.style.textShadow = "0 0 10px #0ff, 0 0 20px #0ff"
        el.style.background = "rgba(0, 0, 0, 0.6)"
        el.style.padding = `${padY}px ${padX}px`
        el.style.borderRadius = "8px"
        el.style.border = "2px solid #0ff"
        el.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.3)"
    }

    applyMinimalStyle(el: HTMLElement) {
        const fontSize = scaleHUDValue(48, this.container, 28, 48)
        el.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        el.style.fontSize = `${fontSize}px`
        el.style.fontWeight = "300"
        el.style.color = "#ffffff"
        el.style.textShadow = "0 2px 4px rgba(0,0,0,0.5)"
    }

    applySportsStyle(el: HTMLElement) {
        const fontSize = scaleHUDValue(36, this.container, 22, 36)
        const padX = scaleHUDValue(40, this.container, 16, 40)
        el.style.fontFamily = "Impact, sans-serif"
        el.style.fontSize = `${fontSize}px`
        el.style.color = "#FFD700" // Gold
        el.style.background = "linear-gradient(180deg, #333, #111)"
        el.style.padding = `5px ${padX}px`
        el.style.borderRadius = "4px"
        el.style.border = "2px solid #555"
        el.style.borderBottom = "4px solid #333"
        el.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)"
        el.style.letterSpacing = "2px"
    }

    updateFarmingCounters(game: any) {
        if (!game) return;

        // Hide standard fire counter if it exists
        const oldCounter = document.getElementById("fuego-counter");
        if (oldCounter) {
            oldCounter.style.display = "none";
        }

        const activeGroups = getActiveFarmingGroups(game);

        // 1. Remove counters for groups that are no longer active
        const activeGroupIds = new Set(activeGroups.map(g => g.groupId));
        const existingCounterEls = this.container.querySelectorAll('[id^="fz-counter-"]');
        existingCounterEls.forEach((el: any) => {
            const gId = el.id.substring("fz-counter-".length);
            if (!activeGroupIds.has(gId)) {
                el.remove();
            }
        });

        // 2. Add or update active group counters
        const settings = this.settings || {};
        const profile = game.playerConfigManager?.getCurrentProfile?.() || {};
        const hudSettings = profile.hudSettings || settings;
        const metrics = getViewportMetrics(this.container);
        const counterFont = scaleHUDValue(20, this.container, 14, 20);
        const counterIcon = scaleHUDValue(24, this.container, 18, 24);
        const counterPadY = scaleHUDValue(8, this.container, 5, 8);
        const counterPadX = scaleHUDValue(16, this.container, 9, 16);

        activeGroups.forEach((group, idx) => {
            const gId = group.groupId;
            const count = game.farmingZoneCounts[gId] || 0;

            // Check if this group's counter is hidden in settings
            const showKey = "show_fz_" + gId;
            if (hudSettings[showKey] === false) {
                const el = document.getElementById(`fz-counter-${gId}`);
                if (el) el.remove();
                return;
            }

            let el = document.getElementById(`fz-counter-${gId}`);
            if (!el) {
                el = document.createElement("div");
                el.id = `fz-counter-${gId}`;
                el.style.cssText = `
                    position: absolute;
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    background: rgba(30, 30, 30, 0.65);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 8px 16px;
                    color: #ff4500;
                    font-family: sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    pointer-events: none;
                    user-select: none;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 1000;
                    transition: transform 0.1s ease;
                `;
                this.container.appendChild(el);
            }

            el.style.padding = `${counterPadY}px ${counterPadX}px`;
            el.style.fontSize = `${counterFont}px`;

            // Update texture/icon and text if changed
            const imgEl = el.querySelector("img");
            const spanEl = el.querySelector("span");

            const currentTex = imgEl ? imgEl.src : "";
            const expectedTex = group.itemTexture;

            if (!imgEl || !spanEl || !currentTex.includes(expectedTex)) {
                el.innerHTML = `
                    <img src="${expectedTex}" style="width: ${counterIcon}px; height: ${counterIcon}px; object-fit: contain;">
                    <span>${count}</span>
                `;
            } else {
                const oldCount = parseInt(spanEl.textContent || "0");
                if (oldCount !== count) {
                    spanEl.textContent = count.toString();

                    // Beautiful micro-animation on update!
                    el.style.transform = "scale(1.2)";
                    setTimeout(() => {
                        if (el) el.style.transform = "scale(1.0)";
                    }, 100);
                }
            }

            // Position the counter
            const posKey = "pos_fz_" + gId;
            const customPos = hudSettings[posKey];
            if (customPos) {
                this.applyPosition(el, customPos);
            } else {
                // Default position staggered vertically
                el.style.top = `${metrics.edge + idx * scaleHUDValue(55, this.container, 36, 55)}px`;
                el.style.left = "50%";
                el.style.bottom = "auto";
                el.style.right = "auto";
                el.style.transform = "translateX(-50%)";
            }
        });

        this.applyHUDConstraints();
        this.applyHUDAnchors();
        this.keepHUDInsideViewport();
        this.applyHUDConstraints();
        this.applyLayerOrder();
    }
}

export function getActiveFarmingGroups(game: any) {
    const groups: { [id: string]: { groupId: string; itemTexture: string; itemValue: number } } = {};

    // 1. Scan from editable map objects (if in scene)
    if (game.sceneManager?.scene) {
        game.sceneManager.scene.children.forEach((obj: any) => {
            if (obj.userData?.isEditableMapObject && obj.userData.mapObjectType === "farming_zone") {
                const props = obj.userData.logicProperties || {};
                const gId = props.groupId || "Grupo 1";
                const tex = props.itemTexture || "/assets/textures/fuego.png";
                const val = props.itemValue || 1;
                if (!groups[gId]) {
                    groups[gId] = { groupId: gId, itemTexture: tex, itemValue: val };
                }
            }
        });
    }

    // 2. Scan from game.farmingZones array
    if (game.farmingZones && Array.isArray(game.farmingZones)) {
        game.farmingZones.forEach((zone: any) => {
            const gId = zone.groupId || "Grupo 1";
            const tex = zone.itemTexture || "/assets/textures/fuego.png";
            const val = zone.itemValue || 1;
            if (!groups[gId]) {
                groups[gId] = { groupId: gId, itemTexture: tex, itemValue: val };
            }
        });
    }

    // 3. Scan from game.farmingZone (single direct reference if active)
    if (game.farmingZone) {
        const zone = game.farmingZone;
        const gId = zone.groupId || "Grupo 1";
        const tex = zone.itemTexture || "/assets/textures/fuego.png";
        const val = zone.itemValue || 1;
        if (!groups[gId]) {
            groups[gId] = { groupId: gId, itemTexture: tex, itemValue: val };
        }
    }

    return Object.values(groups);
}

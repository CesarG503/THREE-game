import { animate } from 'animejs';

export class GameHUD {
    constructor() {
        this.container = document.createElement('div')
        this.container.id = 'game-hud-layer'
        this.container.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 1000;
        `
        document.body.appendChild(this.container)

        this.timerElement = null
        this.healthElement = null
        this.jumpElement = null
        this.inventoryElement = null

        this.settings = {}
    }

    createHUD(settings) {
        this.settings = settings || {};

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

        if (this.settings.showHealth) this.createHealth(this.settings);
        if (this.settings.showJump) this.createJump(this.settings);
        if (this.settings.showInventory) this.createInventory(this.settings);
    }

    createHealth(s) {
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
            const w = s.healthWidth || 300;
            const h = s.healthHeight || 20;
            const isVert = s.healthOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border: 2px solid #333; border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden;">
                    <div id="health-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #ff3333, #ff6666); transform-origin: ${isVert ? 'bottom' : 'left'};"></div>
                    ${s.healthShowText ?
                    `<div id="health-text" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.min(w, h) / 1.5}px; font-weight:bold; text-shadow:1px 1px 1px black;">100 / 100</div>`
                    : ''}
                </div>
            `;
        } else if (s.healthStyle === 'hearts') {
            el.innerHTML = `<span style="font-size:24px; color:#ff3333;">❤❤❤❤</span><span style="font-size:24px; color:#555;">♡</span>`;
        } else {
            el.innerHTML = `<span id="health-text-simple" style="font-size:40px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">100</span>`;
        }

        this.applyPosition(el, s.healthPos);
        this.container.appendChild(el);
        this.healthElement = el;
    }

    createJump(s) {
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
            const w = s.jumpWidth || 200;
            const h = s.jumpHeight || 8;
            const isVert = s.jumpOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border-radius: ${Math.min(w, h) / 2}px; overflow:hidden; position:relative;">
                    <div id="jump-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #33ccff, #3388ff); transform-origin: ${isVert ? 'bottom' : 'left'};"></div>
                     ${s.jumpShowText ?
                    `<div id="jump-text" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.min(w, h) / 1.5}px; font-weight:bold; text-shadow:1px 1px 1px black;">1</div>`
                    : ''}
                </div>
            `;
        } else {
            el.innerHTML = `
               <svg width="50" height="50" style="transform: rotate(-90deg)">
                   <circle cx="25" cy="25" r="20" stroke="rgba(0,0,0,0.5)" stroke-width="5" fill="transparent"/>
                   <circle id="jump-circle-fill" cx="25" cy="25" r="20" stroke="#33ccff" stroke-width="5" fill="transparent" stroke-dasharray="125.6" stroke-dashoffset="125.6"/>
               </svg>
            `;
        }

        this.applyPosition(el, s.jumpPos);
        this.container.appendChild(el);
        this.jumpElement = el;
    }

    createInventory(s) {
        // Use existing inventory container from game.html
        const el = document.getElementById('inventory-container');

        if (el) {
            // Ensure it's visible (GameHUD manages visibility now based on settings)
            el.style.display = 'flex';
            // Prevent stretching
            el.style.width = 'max-content';
            el.style.height = 'max-content';

            // Apply positioning from settings
            this.applyPosition(el, s.inventoryPos);

            // Apply Container Style
            const padding = s.inventoryPadding !== undefined ? s.inventoryPadding : 10;
            const width = s.inventoryContainerWidth || 300;
            const height = s.inventoryContainerHeight || 100;
            const isFree = s.inventoryFreeLayout;

            // Allow container configuration
            // If user has set specific width/height in config, use it. Otherwise use max-content or similar?
            // If free layout is ON, we definitely need dimensions.
            if (s.inventoryContainerWidth) el.style.width = `${width}px`;
            else el.style.width = 'max-content';

            if (s.inventoryContainerHeight) el.style.height = `${height}px`;
            else el.style.height = 'max-content';

            el.style.padding = `${padding}px`;
            el.style.boxSizing = 'border-box'; // Ensure padding doesn't expand width if set

            // Layout Mode
            if (isFree) {
                el.style.display = 'block'; // Block to allow absolute children relative to it
                el.style.position = 'absolute'; // Already absolute via applyPosition
            } else {
                el.style.display = 'flex';
                el.style.gap = '10px';
                el.style.justifyContent = 'center';
                el.style.alignItems = 'center';
                el.style.flexWrap = 'wrap';
            }

            // Handle slot visibility and size based on settings
            const slots = el.querySelectorAll('.inventory-slot');
            const targetCount = s.inventorySlots || 9;
            const slotSize = s.inventorySlotSize || 50;

            slots.forEach((slot, index) => {
                // Apply Size
                slot.style.width = `${slotSize}px`;
                slot.style.height = `${slotSize}px`;
                slot.style.boxSizing = 'border-box';

                // Update Number Font Size
                const num = slot.querySelector('.slot-number');
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
                            ? s.inventorySlotPositions[index]
                            : { left: `${padding + (index * (slotSize + 10))}px`, top: `${padding}px` }; // Fallback simple internal layout

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

    updateHealth(current, max) {
        if (!this.healthElement) return;

        // Ensure valid numbers
        current = typeof current === 'number' ? current : 100;
        max = (typeof max === 'number' && max > 0) ? max : 100;

        // Health Bar
        if (this.settings.healthStyle === 'bar') {
            const fill = this.healthElement.querySelector('#health-bar-fill');
            const text = this.healthElement.querySelector('#health-text');
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
            const txt = this.healthElement.querySelector('#health-text-simple');
            if (txt) txt.textContent = Math.round(current);
        }
    }

    updateJump(current, max) {
        if (!this.jumpElement) return;

        // Ensure valid numbers
        current = typeof current === 'number' ? current : 0;
        max = (typeof max === 'number' && max > 0) ? max : 1;

        if (this.settings.jumpStyle === 'bar') {
            const fill = this.jumpElement.querySelector('#jump-bar-fill');
            const text = this.jumpElement.querySelector('#jump-text'); // If text is enabled
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
                text.textContent = Math.floor(current);
            }

        } else {
            // Circle
            const circle = this.jumpElement.querySelector('#jump-circle-fill');
            if (circle) {
                const circumference = 2 * Math.PI * 20; // r=20
                const offset = circumference - ((current / max) * circumference);

                // API v4: animate(targets, parameters)
                animate(circle, {
                    strokeDashoffset: offset,
                    easing: 'linear',
                    duration: 100
                });
            }
        }
    }

    applyPosition(el, pos) {
        if (!pos) return;
        // Check if explicit top/left props exist in pos object
        if (pos.top) { el.style.top = pos.top; el.style.bottom = 'auto'; }
        if (pos.left) { el.style.left = pos.left; el.style.right = 'auto'; }
        if (pos.bottom) { el.style.bottom = pos.bottom; el.style.top = 'auto'; }
        if (pos.right) { el.style.right = pos.right; el.style.left = 'auto'; }

        if (pos.transform) el.style.transform = pos.transform;
        else el.style.transform = 'none';

        // Backward compatibility if only using predefined strings 
        if (typeof pos === 'string') {
            this.applyPresetPosition(el, pos);
        }
    }

    applyPresetPosition(el, pos) {
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

    updateTimer(timeSeconds, style, position = 'top-center') {
        if (!this.timerElement) {
            this.timerElement = document.createElement('div')
            this.timerElement.id = 'game-timer-display'
            this.container.appendChild(this.timerElement)
        }

        const h = Math.floor(timeSeconds / 3600)
        const m = Math.floor((timeSeconds % 3600) / 60)
        const s = Math.ceil(timeSeconds % 60)

        const pad = (n) => n.toString().padStart(2, '0')
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

    // --- STYLES ---

    applyNeonStyle(el) {
        el.style.fontFamily = "'Courier New', monospace"
        el.style.fontSize = "40px"
        el.style.fontWeight = "bold"
        el.style.color = "#0ff"
        el.style.textShadow = "0 0 10px #0ff, 0 0 20px #0ff"
        el.style.background = "rgba(0, 0, 0, 0.6)"
        el.style.padding = "10px 30px"
        el.style.borderRadius = "8px"
        el.style.border = "2px solid #0ff"
        el.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.3)"
    }

    applyMinimalStyle(el) {
        el.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        el.style.fontSize = "48px"
        el.style.fontWeight = "300"
        el.style.color = "#ffffff"
        el.style.textShadow = "0 2px 4px rgba(0,0,0,0.5)"
    }

    applySportsStyle(el) {
        el.style.fontFamily = "Impact, sans-serif"
        el.style.fontSize = "36px"
        el.style.color = "#FFD700" // Gold
        el.style.background = "linear-gradient(180deg, #333, #111)"
        el.style.padding = "5px 40px"
        el.style.borderRadius = "4px"
        el.style.border = "2px solid #555"
        el.style.borderBottom = "4px solid #333"
        el.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)"
        el.style.letterSpacing = "2px"
    }
}

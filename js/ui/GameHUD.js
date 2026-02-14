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
        el.style.cssText = `display: flex; gap: 5px; position: absolute; pointer-events: none;`;

        if (s.healthStyle === 'bar') {
            el.innerHTML = `
                <div style="width: 300px; height: 20px; background: rgba(0,0,0,0.7); border: 2px solid #333; border-radius: 10px; position:relative; overflow:hidden;">
                    <div id="hud-health-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ff3333, #ff6666);"></div>
                    <div id="hud-health-text" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold;">100 / 100</div>
                </div>
            `;
        } else if (s.healthStyle === 'hearts') {
            el.innerHTML = `<span id="hud-health-hearts" style="font-size:24px; color:#ff3333;">❤❤❤❤❤</span>`;
        } else {
            el.innerHTML = `<span id="hud-health-simple" style="font-size:40px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">100</span>`;
        }

        this.applyPosition(el, s.healthPos);
        this.container.appendChild(el);
        this.healthElement = el;
    }

    createJump(s) {
        const el = document.createElement('div');
        el.id = 'hud-jump';
        el.style.cssText = `display: flex; align-items: center; position: absolute; pointer-events: none;`;

        if (s.jumpStyle === 'bar') {
            el.innerHTML = `
                <div style="width: 200px; height: 8px; background: rgba(0,0,0,0.7); border-radius: 4px; overflow:hidden; margin-left:5px;">
                    <div id="hud-jump-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #33ccff, #3388ff);"></div>
                </div>
            `;
        } else {
            el.innerHTML = `
               <svg width="50" height="50" style="transform: rotate(-90deg)">
                   <circle cx="25" cy="25" r="20" stroke="rgba(0,0,0,0.5)" stroke-width="5" fill="transparent"/>
                   <circle id="hud-jump-circle" cx="25" cy="25" r="20" stroke="#33ccff" stroke-width="5" fill="transparent" stroke-dasharray="125.6" stroke-dashoffset="0"/>
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

            // Apply positioning from settings
            this.applyPosition(el, s.inventoryPos);

            // Handle slot visibility based on settings
            const slots = el.querySelectorAll('.inventory-slot');
            const targetCount = s.inventorySlots || 9;

            slots.forEach((slot, index) => {
                if (index < targetCount) {
                    slot.style.display = 'flex';
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

        if (this.settings.healthStyle === 'bar') {
            const bar = this.healthElement.querySelector('#hud-health-bar');
            const txt = this.healthElement.querySelector('#hud-health-text');

            const pct = Math.max(0, (current / max) * 100);

            if (bar) {
                animate(bar, {
                    width: `${pct}%`,
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
            if (txt) txt.textContent = `${Math.ceil(current)} / ${max}`;

        } else if (this.settings.healthStyle === 'hearts') {
            // Visualize 1 heart per 20hp? Or just simple hearts
            const hearts = this.healthElement.querySelector('#hud-health-hearts');
            const totalHearts = 5;
            const hpPerHeart = max / totalHearts;
            const heartsCount = Math.ceil(current / hpPerHeart);
            let str = "";
            for (let i = 0; i < totalHearts; i++) {
                str += (i < heartsCount) ? "❤" : "♡";
            }
            if (hearts) hearts.textContent = str;

        } else {
            const txt = this.healthElement.querySelector('#hud-health-simple');
            if (txt) {
                // Animate number? 
                txt.textContent = Math.ceil(current);
            }
        }
    }

    updateJump(current, max) {
        if (!this.jumpElement) return;

        if (this.settings.jumpStyle === 'bar') {
            const bar = this.jumpElement.querySelector('#hud-jump-bar');
            const pct = Math.max(0, (current / max) * 100);
            if (bar) {
                animate(bar, {
                    width: `${pct}%`,
                    duration: 200,
                    easing: 'easeOutQuad'
                });
            }
        } else {
            const circle = this.jumpElement.querySelector('#hud-jump-circle');
            if (circle) {
                const totalLength = 125.6; // 2 * PI * r (r=20)
                const pct = current / max;
                const offset = totalLength * (1 - pct);

                animate(circle, {
                    strokeDashoffset: offset,
                    duration: 200,
                    easing: 'easeOutQuad'
                });
            }
        }
    }

    applyPosition(el, pos) {
        if (!pos) return;
        // Check if explicit top/left props exist in pos object
        if (pos.top) el.style.top = pos.top;
        if (pos.left) el.style.left = pos.left;
        if (pos.bottom) el.style.bottom = pos.bottom;
        if (pos.right) el.style.right = pos.right;
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

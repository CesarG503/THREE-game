import { animate, stagger } from 'animejs';
import { HUDLayoutSystem } from './modules/HUDLayoutSystem.js';

export class HUDConfigPanel {
    constructor(game, manager, onClose) {
        this.game = game;
        this.manager = manager;
        this.onClose = onClose;
        this.container = null;
        this.previewHUD = null;
        this.tempSettings = {};

        this.layoutSystem = null;
    }

    open(profile) {
        this.profile = profile;
        this.tempSettings = JSON.parse(JSON.stringify(profile.hudSettings || {}));

        // Initialize Defaults
        // Health
        if (this.tempSettings.showHealth === undefined) this.tempSettings.showHealth = true;
        if (this.tempSettings.healthStyle === undefined) this.tempSettings.healthStyle = 'bar';
        if (!this.tempSettings.healthPos) this.tempSettings.healthPos = { top: '85%', left: '5%' };
        if (this.tempSettings.healthWidth === undefined) this.tempSettings.healthWidth = 300;
        if (this.tempSettings.healthHeight === undefined) this.tempSettings.healthHeight = 20;
        if (this.tempSettings.healthOrientation === undefined) this.tempSettings.healthOrientation = 'horizontal';
        if (this.tempSettings.healthShowText === undefined) this.tempSettings.healthShowText = true;

        // Jump
        if (this.tempSettings.showJump === undefined) this.tempSettings.showJump = true;
        if (this.tempSettings.jumpStyle === undefined) this.tempSettings.jumpStyle = 'bar';
        if (!this.tempSettings.jumpPos) this.tempSettings.jumpPos = { top: '80%', left: '5%' };
        if (this.tempSettings.jumpWidth === undefined) this.tempSettings.jumpWidth = 200;
        if (this.tempSettings.jumpHeight === undefined) this.tempSettings.jumpHeight = 8;
        if (this.tempSettings.jumpOrientation === undefined) this.tempSettings.jumpOrientation = 'horizontal';
        if (this.tempSettings.jumpShowText === undefined) this.tempSettings.jumpShowText = false;

        // Inventory
        if (this.tempSettings.showInventory === undefined) this.tempSettings.showInventory = true;
        if (this.tempSettings.inventorySlots === undefined) this.tempSettings.inventorySlots = 5;
        if (!this.tempSettings.inventoryPos) this.tempSettings.inventoryPos = { top: '90%', left: '50%', transform: 'translateX(-50%)' };

        this.createUI();

        // Animate Entry
        this.container.style.opacity = '0';
        animate(this.container, {
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });

        // Animate Floating Window
        const win = this.container.querySelector('.hud-config-window');
        if (win) {
            animate(win, {
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutBack'
            });
        }
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 2000;
            display: flex; justify-content: center; align-items: center;
            font-family: sans-serif; overflow: hidden;
        `;

        // 1. Fullscreen Preview Area (The "Background" workspace)
        const previewArea = document.createElement('div');
        previewArea.id = 'hud-preview-area';
        previewArea.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: transparent;
        `;

        this.container.appendChild(previewArea);

        // Initialize Layout System
        this.layoutSystem = new HUDLayoutSystem(previewArea);
        this.layoutSystem.enableEditMode(true); // Show grid

        this.previewContainer = previewArea;

        // 2. Floating Config Window
        const configWindow = document.createElement('div');
        configWindow.className = 'hud-config-window';
        configWindow.style.cssText = `
            position: absolute; right: 30px; top: 30px; width: 320px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid #555; border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            display: flex; flex-direction: column;
            max-height: 85%;
            backdrop-filter: blur(5px);
            z-index: 2001; /* Above grid */
            user-select: none;
        `;

        // Make Window Draggable
        this.makeWindowDraggable(configWindow);

        // Header
        const header = document.createElement('div');
        header.className = 'drag-handle';
        header.style.cssText = "padding: 15px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; background: rgba(50,50,50,0.5); border-radius: 8px 8px 0 0; cursor: move;";
        header.innerHTML = `<h3 style="margin:0; color:white; font-size:16px; pointer-events:none;">Editor de HUD</h3>`;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = "✕";
        closeBtn.style.cssText = "background:none; border:none; color:#aaa; font-size: 18px; cursor: pointer;";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.close();
        };
        header.appendChild(closeBtn);
        configWindow.appendChild(header);

        // Scrollable Content
        const content = document.createElement('div');
        content.style.cssText = "padding: 20px; overflow-y: auto; flex: 1;";

        this.createSection(content, "Salud (Vida)", 'health');
        this.createSection(content, "Salto (Carga)", 'jump');
        this.createSection(content, "Inventario", 'inventory');

        // Instructions
        const hint = document.createElement('div');
        hint.innerHTML = `<p style="color:#aaa; font-size:12px; font-style:italic; margin-top:20px; text-align:center;">
            💡 Arrastra los elementos en la pantalla para cambiar su posición.
        </p>`;
        content.appendChild(hint);

        configWindow.appendChild(content);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = "padding: 15px; border-top: 1px solid #444; display: flex; justify-content: flex-end; gap: 10px; background: rgba(40,40,40,0.8); border-radius: 0 0 8px 8px;";

        const saveBtn = document.createElement('button');
        saveBtn.textContent = "Guardar y Salir";
        saveBtn.style.cssText = "padding: 8px 15px; background: #00aa00; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; width:100%;";
        saveBtn.onclick = () => this.save();

        footer.appendChild(saveBtn);
        configWindow.appendChild(footer);

        this.container.appendChild(configWindow);
        document.body.appendChild(this.container);

        this.updatePreview();
    }

    makeWindowDraggable(win) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const onMouseDown = (e) => {
            if (!e.target.closest('.drag-handle')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = win.getBoundingClientRect();

            // Fix position to absolute/left/top if checking
            win.style.right = 'auto';
            win.style.bottom = 'auto';
            win.style.left = rect.left + 'px';
            win.style.top = rect.top + 'px';

            initialLeft = rect.left;
            initialTop = rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            win.style.left = (initialLeft + dx) + 'px';
            win.style.top = (initialTop + dy) + 'px';
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        win.addEventListener('mousedown', onMouseDown);
    }

    createSection(parent, title, type) {
        const sec = document.createElement('div');
        sec.style.marginBottom = "20px";

        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.style.cssText = "color: #ddd; border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px; font-size:14px;";
        sec.appendChild(h3);

        // Visibility Checkbox
        const visRow = document.createElement('div');
        visRow.style.cssText = "margin-bottom: 10px; display: flex; align-items: center; gap: 10px;";

        const visCheck = document.createElement('input');
        visCheck.type = "checkbox";
        const vKey = type === 'health' ? 'showHealth' : (type === 'jump' ? 'showJump' : 'showInventory');
        visCheck.checked = this.tempSettings[vKey];
        visCheck.onchange = (e) => {
            this.tempSettings[vKey] = e.target.checked;
            this.updatePreview();
        };

        const visLabel = document.createElement('label');
        visLabel.textContent = "Mostrar";
        visLabel.style.color = "#aaa";

        visRow.appendChild(visCheck);
        visRow.appendChild(visLabel);
        sec.appendChild(visRow);

        // Style / Options
        if (type === 'health' || type === 'jump') {
            const prefix = type;

            // 1. Style
            const styleLabel = document.createElement('div');
            styleLabel.textContent = "Estilo:";
            styleLabel.style.color = "#aaa";
            styleLabel.style.marginBottom = "5px";
            styleLabel.style.fontSize = "12px";
            sec.appendChild(styleLabel);

            const styles = type === 'health' ? ['bar', 'hearts', 'text'] : ['bar', 'circle'];
            const styleTexts = type === 'health' ? ['Barra Clásica', 'Corazones', 'Texto Simple'] : ['Barra de Estamina', 'Círculo de Carga'];

            const styleSel = this.createSelect(styles, styleTexts, this.tempSettings[prefix + 'Style'], (v) => {
                this.tempSettings[prefix + 'Style'] = v;
                this.updatePreview();
                // Toggle visibility of bar options
                updateBarOptionsAccess(v);
            });
            sec.appendChild(styleSel);

            // Container for Bar-only options
            const barOptions = document.createElement('div');
            barOptions.style.marginTop = "10px";
            barOptions.style.paddingLeft = "10px";
            barOptions.style.borderLeft = "2px solid #555";

            // 2. Show Text (Checkbox)
            const textRow = document.createElement('div');
            textRow.style.cssText = "margin-bottom: 5px; display: flex; align-items: center; gap: 10px;";
            const textCheck = document.createElement('input');
            textCheck.type = "checkbox";
            const tKey = prefix + 'ShowText';
            // Default check if undefined in old profile
            if (this.tempSettings[tKey] === undefined) this.tempSettings[tKey] = true;
            textCheck.checked = this.tempSettings[tKey];
            textCheck.onchange = (e) => {
                this.tempSettings[tKey] = e.target.checked;
                this.updatePreview();
            };
            const textLabel = document.createElement('label');
            textLabel.textContent = "Mostrar Texto/Dígito";
            textLabel.style.color = "#ccc";
            textLabel.style.fontSize = "12px";
            textRow.appendChild(textCheck);
            textRow.appendChild(textLabel);
            barOptions.appendChild(textRow);

            // 3. Orientation
            const orientRow = document.createElement('div');
            orientRow.style.marginBottom = "5px";
            const orientLabel = document.createElement('div');
            orientLabel.textContent = "Orientación:";
            orientLabel.style.color = "#aaa";
            orientLabel.style.fontSize = "12px";
            orientRow.appendChild(orientLabel);
            const orientSel = this.createSelect(['horizontal', 'vertical'], ['Horizontal', 'Vertical'], this.tempSettings[prefix + 'Orientation'] || 'horizontal', (v) => {
                this.tempSettings[prefix + 'Orientation'] = v;
                // Swap W/H just for UX convenience? No, let user do it.
                this.updatePreview();
            });
            orientRow.appendChild(orientSel);
            barOptions.appendChild(orientRow);

            // 4. Dimensions (Width / Height)
            const dimRow = document.createElement('div');
            dimRow.style.display = "flex";
            dimRow.style.gap = "10px";

            // Width
            const widthContainer = document.createElement('div');
            const wLabel = document.createElement('div');
            wLabel.textContent = "Ancho (px)";
            wLabel.style.fontSize = "10px"; wLabel.style.color = "#aaa";
            const wInput = document.createElement('input');
            wInput.type = "number"; wInput.min = 50; wInput.value = this.tempSettings[prefix + 'Width'] || (type === 'health' ? 300 : 200);
            wInput.style.width = "100%"; wInput.style.background = "#333"; wInput.style.color = "white"; wInput.style.border = "1px solid #555";
            wInput.onchange = (e) => {
                this.tempSettings[prefix + 'Width'] = parseInt(e.target.value) || 100;
                this.updatePreview();
            };
            widthContainer.appendChild(wLabel);
            widthContainer.appendChild(wInput);

            // Height
            const heightContainer = document.createElement('div');
            const hLabel = document.createElement('div');
            hLabel.textContent = "Alto (px)";
            hLabel.style.fontSize = "10px"; hLabel.style.color = "#aaa";
            const hInput = document.createElement('input');
            hInput.type = "number"; hInput.min = 5; hInput.value = this.tempSettings[prefix + 'Height'] || (type === 'health' ? 20 : 8);
            hInput.style.width = "100%"; hInput.style.background = "#333"; hInput.style.color = "white"; hInput.style.border = "1px solid #555";
            hInput.onchange = (e) => {
                this.tempSettings[prefix + 'Height'] = parseInt(e.target.value) || 10;
                this.updatePreview();
            };
            heightContainer.appendChild(hLabel);
            heightContainer.appendChild(hInput);

            dimRow.appendChild(widthContainer);
            dimRow.appendChild(heightContainer);
            barOptions.appendChild(dimRow);

            sec.appendChild(barOptions);

            const updateBarOptionsAccess = (style) => {
                if (style === 'bar') {
                    barOptions.style.display = 'block';
                } else {
                    barOptions.style.display = 'none';
                }
            };

            // Initial call
            updateBarOptionsAccess(this.tempSettings[prefix + 'Style']);

        } else if (type === 'inventory') {
            const slotInput = document.createElement('input');
            slotInput.type = "number";
            slotInput.min = 1;
            slotInput.max = 10;
            slotInput.value = this.tempSettings.inventorySlots;
            slotInput.style.cssText = "background: #333; color: white; border: 1px solid #555; padding: 5px; width: 60px;";
            slotInput.onchange = (e) => {
                let v = parseInt(e.target.value);
                if (v < 1) v = 1;
                if (v > 10) v = 10;
                this.tempSettings.inventorySlots = v;
                this.updatePreview();
            };

            const slotLabel = document.createElement('div');
            slotLabel.textContent = "Espacios:";
            slotLabel.style.color = "#aaa";
            slotLabel.style.marginBottom = "5px";

            sec.appendChild(slotLabel);
            sec.appendChild(slotInput);
        }

        parent.appendChild(sec);
    }

    createSelect(values, texts, current, onChange) {
        const sel = document.createElement('select');
        sel.style.cssText = "width: 100%; background: #333; color: white; border: 1px solid #555; padding: 5px;";
        values.forEach((v, i) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = texts[i];
            if (v === current) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.onchange = (e) => onChange(e.target.value);
        return sel;
    }

    updatePreview() {
        if (!this.contentWrapper) {
            this.contentWrapper = document.createElement('div');
            this.contentWrapper.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";
            this.previewContainer.appendChild(this.contentWrapper);
        }

        this.contentWrapper.innerHTML = '';
        this.contentWrapper.style.zIndex = '10';

        if (this.tempSettings.showHealth) {
            this.renderPreviewHealth();
        }

        if (this.tempSettings.showJump) {
            this.renderPreviewJump();
        }

        if (this.tempSettings.showInventory) {
            this.renderPreviewInventory();
        }

        const children = this.contentWrapper.children;
        if (children.length > 0) {
            animate(children, {
                opacity: [0, 1],
                translateY: [20, 0],
                delay: stagger(100),
                duration: 500,
                easing: 'easeOutQuad'
            });
        }
    }

    renderPreviewHealth() {
        const el = document.createElement('div');
        el.style.cssText = `display: flex; gap: 5px;`;

        // Handle Orientation
        if (this.tempSettings.healthOrientation === 'vertical') {
            el.style.flexDirection = 'column-reverse'; // Bar fills up
            el.style.alignItems = 'center';
        } else {
            el.style.flexDirection = 'row';
            el.style.alignItems = 'center';
        }

        if (this.tempSettings.healthStyle === 'bar') {
            const w = this.tempSettings.healthWidth || 300;
            const h = this.tempSettings.healthHeight || 20;

            // Bar Calculation
            // For vertical, we might swap w/h concept or just respect w/h as raw pixels
            // Usually "width" in UI means "Length of bar", but let's stick to raw CSS width/height for simplicity unless rotated.
            // Actually, if vertical, width usually becomes thickness and height becomes length.
            // But user has explicit Width/Height inputs. Let's just use them as CSS props.

            const isVert = this.tempSettings.healthOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border: 2px solid #333; border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #ff3333, #ff6666); clip-path: inset(${isVert ? '20% 0 0 0' : '0 20% 0 0'});"></div>
                    ${this.tempSettings.healthShowText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.min(w, h) / 1.5}px; font-weight:bold; text-shadow:1px 1px 1px black;">80 / 100</div>`
                    : ''}
                </div>
            `;
        } else if (this.tempSettings.healthStyle === 'hearts') {
            el.innerHTML = `<span style="font-size:24px; color:#ff3333;">❤❤❤❤</span><span style="font-size:24px; color:#555;">♡</span>`;
        } else {
            el.innerHTML = `<span style="font-size:40px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">80</span>`;
        }

        this.contentWrapper.appendChild(el);

        this.layoutSystem.registerElement(el, 'health', this.tempSettings.healthPos, (newPos) => {
            this.tempSettings.healthPos = newPos;
        });
    }

    renderPreviewJump() {
        const el = document.createElement('div');
        el.style.cssText = `display: flex; align-items: center;`;

        // Handle Orientation
        if (this.tempSettings.jumpOrientation === 'vertical') {
            el.style.flexDirection = 'column-reverse';
        } else {
            el.style.flexDirection = 'row';
        }

        if (this.tempSettings.jumpStyle === 'bar') {
            const w = this.tempSettings.jumpWidth || 200;
            const h = this.tempSettings.jumpHeight || 8;

            const isVert = this.tempSettings.jumpOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border-radius: ${Math.min(w, h) / 2}px; overflow:hidden; position:relative;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #33ccff, #3388ff); clip-path: inset(${isVert ? '50% 0 0 0' : '0 50% 0 0'});"></div>
                     ${this.tempSettings.jumpShowText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.min(w, h) / 1.5}px; font-weight:bold; text-shadow:1px 1px 1px black;">1</div>`
                    : ''}
                </div>
            `;
        } else {
            // Circle handles orientation/size differently (fixed size in preview for now or scale?)
            // Let's just leave circle as is since options were hidden for non-bar
            el.innerHTML = `
               <svg width="50" height="50" style="transform: rotate(-90deg)">
                   <circle cx="25" cy="25" r="20" stroke="rgba(0,0,0,0.5)" stroke-width="5" fill="transparent"/>
                   <circle cx="25" cy="25" r="20" stroke="#33ccff" stroke-width="5" fill="transparent" stroke-dasharray="125.6" stroke-dashoffset="60"/>
               </svg>
            `;
        }

        this.contentWrapper.appendChild(el);

        this.layoutSystem.registerElement(el, 'jump', this.tempSettings.jumpPos, (newPos) => {
            this.tempSettings.jumpPos = newPos;
        });
    }

    renderPreviewInventory() {
        const el = document.createElement('div');
        // Match #inventory-container styles roughly for preview
        el.className = "inventory-container-preview";
        el.style.cssText = `
            display: flex; gap: 8px; justify-content: center;
        `;

        // Use the same structure as game.html
        for (let i = 0; i < this.tempSettings.inventorySlots; i++) {
            // We use 'inventory-slot' class to match game styles if they are global
            // But since we are in a shadow-like preview, we might need to inline some styles 
            // IF the css is not available. 
            // Assuming main.css is available globally.

            const isActive = (i === 0);

            /* 
               Structure from game.html:
               <div class="inventory-slot active">
                   <span class="slot-number">1</span>
                   <img ...>
               </div>
            */

            const slot = document.createElement('div');
            slot.className = `inventory-slot ${isActive ? 'active' : ''}`;
            // Inline minimal styles to ensure it looks right even if CSS is quirky in preview
            slot.style.position = 'relative'; // ensure content flows

            slot.innerHTML = `
                <span class="slot-number">${i + 1}</span>
                ${i < 2 ? `<div style="width:70%; height:70%; background:rgba(255,255,255,0.2); border-radius:4px;"></div>` : ''} 
             `;

            el.appendChild(slot);
        }

        this.contentWrapper.appendChild(el);

        this.layoutSystem.registerElement(el, 'inventory', this.tempSettings.inventoryPos, (newPos) => {
            this.tempSettings.inventoryPos = newPos;
        });
    }

    save() {
        this.manager.updateProfile(this.profile.id, { hudSettings: this.tempSettings });
        this.close();
    }

    close() {
        if (this.container) {
            if (this.layoutSystem) {
                this.layoutSystem.disableEditMode();
            }

            const win = this.container.querySelector('.hud-config-window');
            if (win) {
                animate(win, {
                    scale: 0.9,
                    opacity: 0,
                    duration: 200,
                    easing: 'easeInBack'
                });
            }

            animate(this.container, {
                opacity: 0,
                duration: 200,
                easing: 'easeInQuad',
                onComplete: () => {
                    if (this.container && this.container.parentNode) {
                        document.body.removeChild(this.container);
                    }
                    this.container = null;
                    this.contentWrapper = null;
                    if (this.onClose) this.onClose();
                }
            });
        }
    }
}

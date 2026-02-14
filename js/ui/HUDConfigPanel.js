import { animate, stagger } from 'animejs';

export class HUDConfigPanel {
    constructor(game, manager, onClose) {
        this.game = game;
        this.manager = manager;
        this.onClose = onClose;
        this.container = null;
        this.previewHUD = null;
        this.tempSettings = {};
        this.activeDrag = null; // Track current dragging element
    }

    open(profile) {
        this.profile = profile;
        this.tempSettings = JSON.parse(JSON.stringify(profile.hudSettings || {}));

        // Initialize Defaults
        // Health
        if (this.tempSettings.showHealth === undefined) this.tempSettings.showHealth = true;
        if (this.tempSettings.healthStyle === undefined) this.tempSettings.healthStyle = 'bar';
        if (!this.tempSettings.healthPos) this.tempSettings.healthPos = { top: '85%', left: '5%' };

        // Jump
        if (this.tempSettings.showJump === undefined) this.tempSettings.showJump = true;
        if (this.tempSettings.jumpStyle === undefined) this.tempSettings.jumpStyle = 'bar';
        if (!this.tempSettings.jumpPos) this.tempSettings.jumpPos = { top: '80%', left: '5%' };

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

        // Grid/Guides (Optional, for visual help)
        const grid = document.createElement('div');
        grid.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; opacity: 0.1;
            background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
            background-size: 50px 50px;
        `;
        previewArea.appendChild(grid);

        // Container for HUD Elements
        this.previewContainer = document.createElement('div');
        this.previewContainer.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%;";
        previewArea.appendChild(this.previewContainer);

        this.container.appendChild(previewArea);

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
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = "padding: 15px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; background: rgba(50,50,50,0.5); border-radius: 8px 8px 0 0;";
        header.innerHTML = `<h3 style="margin:0; color:white; font-size:16px;">Editor de HUD</h3>`;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = "✕";
        closeBtn.style.cssText = "background:none; border:none; color:#aaa; font-size: 18px; cursor: pointer;";
        closeBtn.onclick = () => this.close();
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

        // Setup Drag Events on Container
        this.setupDragEvents();

        this.updatePreview();
    }

    setupDragEvents() {
        // Global mouse moves for dragging
        this.container.onmousemove = (e) => {
            if (this.activeDrag) {
                e.preventDefault();
                const rect = this.previewContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Update Position (relative % or px)
                // Using px for precision during drag, will save as %/px hybrid or just px
                const el = this.activeDrag.el;

                // Center the element on cursor (approx) or keep offset? 
                // Let's keep strict top/left for now
                const w = el.offsetWidth;
                const h = el.offsetHeight;

                let newLeft = x - (w / 2);
                let newTop = y - (h / 2);

                // Bounds check
                if (newLeft < 0) newLeft = 0;
                if (newTop < 0) newTop = 0;
                if (newLeft + w > rect.width) newLeft = rect.width - w;
                if (newTop + h > rect.height) newTop = rect.height - h;

                el.style.left = newLeft + 'px';
                el.style.top = newTop + 'px';
                el.style.bottom = 'auto';
                el.style.right = 'auto';
                el.style.transform = 'none'; // Remove center transforms during drag

                // Update Settings Live
                const key = this.activeDrag.key;
                // Convert to percentage for responsiveness? Or keep px? 
                // Let's use % for responsiveness
                const leftPct = (newLeft / rect.width) * 100;
                const topPct = (newTop / rect.height) * 100;

                this.tempSettings[key + 'Pos'] = {
                    left: leftPct.toFixed(2) + '%',
                    top: topPct.toFixed(2) + '%'
                };
            }
        };

        this.container.onmouseup = () => {
            if (this.activeDrag) {
                this.activeDrag.el.style.cursor = 'grab';
                this.activeDrag.el.style.zIndex = '';
                this.activeDrag = null;
            }
        };
    }

    makeDraggable(element, key) {
        element.style.cursor = 'grab';
        element.style.userSelect = 'none';

        element.onmousedown = (e) => {
            e.preventDefault(); // Prevent text selection
            e.stopPropagation(); // Don't bubble to container click

            this.activeDrag = { el: element, key: key };
            element.style.cursor = 'grabbing';
            element.style.zIndex = '1000'; // Bring to front
        };
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
        if (type === 'health') {
            const styleSel = this.createSelect(['bar', 'hearts', 'text'], ['Barra Clásica', 'Corazones', 'Texto Simple'], this.tempSettings.healthStyle, (v) => {
                this.tempSettings.healthStyle = v;
                this.updatePreview();
            });
            sec.appendChild(styleSel);
        } else if (type === 'jump') {
            const styleSel = this.createSelect(['bar', 'circle'], ['Barra de Estamina', 'Círculo de Carga'], this.tempSettings.jumpStyle, (v) => {
                this.tempSettings.jumpStyle = v;
                this.updatePreview();
            });
            sec.appendChild(styleSel);
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
        this.previewContainer.innerHTML = '';

        if (this.tempSettings.showHealth) {
            this.renderPreviewHealth();
        }

        if (this.tempSettings.showJump) {
            this.renderPreviewJump();
        }

        if (this.tempSettings.showInventory) {
            this.renderPreviewInventory();
        }

        // Check for animate to animate children entry
        const children = this.previewContainer.children;
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

    applyPos(el, pos) {
        if (!pos) return;
        if (pos.top) el.style.top = pos.top;
        if (pos.left) el.style.left = pos.left;
        if (pos.bottom) el.style.bottom = pos.bottom;
        if (pos.right) el.style.right = pos.right;
        if (pos.transform) el.style.transform = pos.transform;
        else el.style.transform = 'none'; // Reset if undefined (important for dragging overriding defaults)
    }

    renderPreviewHealth() {
        const el = document.createElement('div');
        // Base style
        el.style.cssText = `position: absolute; display: flex; gap: 5px;`;
        this.applyPos(el, this.tempSettings.healthPos);
        this.makeDraggable(el, 'health');

        if (this.tempSettings.healthStyle === 'bar') {
            el.innerHTML = `
                <div style="width: 300px; height: 20px; background: rgba(0,0,0,0.7); border: 2px solid #333; border-radius: 10px; position:relative; overflow:hidden;">
                    <div style="width: 80%; height: 100%; background: linear-gradient(90deg, #ff3333, #ff6666);"></div>
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold;">80 / 100</div>
                </div>
            `;
        } else if (this.tempSettings.healthStyle === 'hearts') {
            el.innerHTML = `<span style="font-size:24px; color:#ff3333;">❤❤❤❤</span><span style="font-size:24px; color:#555;">♡</span>`;
        } else {
            el.innerHTML = `<span style="font-size:40px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">80</span>`;
        }
        this.previewContainer.appendChild(el);
    }

    renderPreviewJump() {
        const el = document.createElement('div');
        el.style.cssText = `position: absolute; display: flex; align-items: center;`;
        this.applyPos(el, this.tempSettings.jumpPos);
        this.makeDraggable(el, 'jump');

        if (this.tempSettings.jumpStyle === 'bar') {
            el.innerHTML = `
                <div style="width: 200px; height: 8px; background: rgba(0,0,0,0.7); border-radius: 4px; overflow:hidden; margin-left:5px;">
                    <div style="width: 50%; height: 100%; background: linear-gradient(90deg, #33ccff, #3388ff);"></div>
                </div>
            `;
        } else {
            el.innerHTML = `
               <svg width="50" height="50" style="transform: rotate(-90deg)">
                   <circle cx="25" cy="25" r="20" stroke="rgba(0,0,0,0.5)" stroke-width="5" fill="transparent"/>
                   <circle cx="25" cy="25" r="20" stroke="#33ccff" stroke-width="5" fill="transparent" stroke-dasharray="125.6" stroke-dashoffset="60"/>
               </svg>
            `;
        }
        this.previewContainer.appendChild(el);
    }

    renderPreviewInventory() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute; display: flex; gap: 8px; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        this.applyPos(el, this.tempSettings.inventoryPos);
        this.makeDraggable(el, 'inventory');

        for (let i = 0; i < this.tempSettings.inventorySlots; i++) {
            el.innerHTML += `
                <div style="width:50px; height:50px; background:rgba(0,0,0,0.3); border:2px solid ${i === 0 ? '#fff' : '#888'}; border-radius:6px; display:flex; align-items:center; justify-content:center; ${i === 0 ? 'transform:scale(1.1); background:rgba(255,255,255,0.1);' : ''}">
                    <div style="color:rgba(255,255,255,0.5);">${i + 1}</div>
                </div>
            `;
        }
        this.previewContainer.appendChild(el);
    }

    save() {
        this.manager.updateProfile(this.profile.id, { hudSettings: this.tempSettings });
        this.close();
    }

    close() {
        if (this.container) {
            // Animate Window Exit
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
                    if (this.onClose) this.onClose();
                }
            });
        }
    }
}

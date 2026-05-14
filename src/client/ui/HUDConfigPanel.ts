// @ts-nocheck

import { animate, stagger } from 'animejs'
import { HUDLayoutSystem } from './modules/HUDLayoutSystem'

export class HUDConfigPanel {
    constructor(game, manager, onClose) {
        this.game = game;
        this.manager = manager;
        this.onClose = onClose;
        this.container = null;
        this.previewHUD = null;
        this.tempSettings = {};

        this.layoutSystem = null;
        this.uiInputs = {}; // Store references to inputs for live updates
        this.isMinimized = false; // State for minimization
    }

    open(profile) {
        this.profile = profile;
        this.tempSettings = JSON.parse(JSON.stringify(profile.hudSettings || {}));
        this.selectedId = 'health'; // Default selection

        // Initialize Defaults (Keep existing defaults logic...)
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
        if (this.tempSettings.inventorySlots === undefined) this.tempSettings.inventorySlots = 9;
        if (this.tempSettings.inventorySlotSize === undefined) this.tempSettings.inventorySlotSize = 50;
        if (!this.tempSettings.inventoryPos) this.tempSettings.inventoryPos = { bottom: '20px', left: '50%', transform: 'translateX(-50%)' };

        // New Inventory Defaults
        // Do NOT set default width/height so it can be auto-calculated
        if (this.tempSettings.inventoryPadding === undefined) this.tempSettings.inventoryPadding = 10;
        if (this.tempSettings.inventoryFreeLayout === undefined) this.tempSettings.inventoryFreeLayout = false;
        if (!this.tempSettings.inventorySlotPositions) this.tempSettings.inventorySlotPositions = [];
        if (!this.tempSettings.inventorySlotAlignment) this.tempSettings.inventorySlotAlignment = 'center';

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

        // 1. Fullscreen Preview Area
        const previewArea = document.createElement('div');
        previewArea.id = 'hud-preview-area';
        previewArea.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: transparent;
        `;
        this.container.appendChild(previewArea);

        // Initialize Layout System
        this.layoutSystem = new HUDLayoutSystem(previewArea);
        this.layoutSystem.enableEditMode(true);
        this.layoutSystem.setSelectionCallback((selectedIds) => {
            this.onSelectionChange(selectedIds);
        });

        this.previewContainer = previewArea;

        // 2. Floating Config Window (Resized and Layout Changed)
        const configWindow = document.createElement('div');
        configWindow.className = 'hud-config-window';
        configWindow.style.cssText = `
            position: absolute; right: 30px; top: 30px; width: 500px; height: 600px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid #555; border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            display: flex; flex-direction: column;
            backdrop-filter: blur(5px);
            z-index: 2001;
            user-select: none;
        `;

        this.makeWindowDraggable(configWindow);

        // Header
        const header = document.createElement('div');
        header.className = 'drag-handle';
        header.style.cssText = "padding: 15px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; background: rgba(50,50,50,0.5); border-radius: 8px 8px 0 0; cursor: move;";
        header.innerHTML = `<h3 style="margin:0; color:white; font-size:16px; pointer-events:none;">Editor de HUD</h3>`;

        // Minimize Button
        const minBtn = document.createElement('button');
        minBtn.innerHTML = "−";
        minBtn.style.cssText = "background:none; border:none; color:#aaa; font-size: 18px; cursor: pointer; margin-right: 10px; font-weight: bold; vertical-align: middle;";
        minBtn.onclick = (e) => { e.stopPropagation(); this.toggleMinimize(configWindow, content, footer, minBtn); };

        const controls = document.createElement('div');
        controls.style.display = 'flex'; controls.style.alignItems = 'center';
        controls.appendChild(minBtn);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = "✕";
        closeBtn.style.cssText = "background:none; border:none; color:#aaa; font-size: 18px; cursor: pointer;";
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };
        controls.appendChild(closeBtn);
        header.appendChild(controls);
        configWindow.appendChild(header);

        // SPLIT VIEW CONTENT
        const content = document.createElement('div');
        content.style.cssText = "display: flex; flex: 1; overflow: hidden;";

        // SIDEBAR (List)
        this.sidebar = document.createElement('div');
        this.sidebar.style.cssText = "width: 150px; background: rgba(0,0,0,0.2); border-right: 1px solid #444; padding: 10px; overflow-y: auto;";
        content.appendChild(this.sidebar);

        // PROPERTIES PANEL
        this.propertyPanel = document.createElement('div');
        this.propertyPanel.style.cssText = "flex: 1; padding: 20px; overflow-y: auto; background: transparent;";
        content.appendChild(this.propertyPanel);

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

        // Initial Render
        this.renderSidebar();
        this.renderProperties();
        this.updatePreview();
    }

    // --- Split View Logic ---

    onSelectionChange(selectedIds) {
        // Highlighting in Sidebar handled by renderSidebar
        if (selectedIds.length === 1) {
            this.selectedId = selectedIds[0];
        } else if (selectedIds.length === 0) {
            // Keep showing properties of last selected? or clear?
            // Let's keep last or default
        }
        this.renderSidebar();
        this.renderProperties();
    }

    renderSidebar() {
        this.sidebar.innerHTML = '';
        const order = this.tempSettings.layerOrder || ['health', 'jump', 'inventory'];
        // Ensure layerOrder is initialized if missing
        if (!this.tempSettings.layerOrder) this.tempSettings.layerOrder = order;

        const labels = { 'health': 'Salud', 'jump': 'Salto', 'inventory': 'Inventario' };
        const items = order.map(id => ({ id: id, label: labels[id] || id }));

        let draggedItem = null;

        items.forEach((item, index) => {
            const row = document.createElement('div');
            const isSelected = this.selectedId === item.id;
            const isMultiSelected = this.layoutSystem.selection.has(item.id);

            row.style.cssText = `
                padding: 10px; margin-bottom: 5px; border-radius: 4px;
                cursor: grab; display: flex; align-items: center; gap: 8px;
                background: ${isSelected ? '#4CAF50' : (isMultiSelected ? 'rgba(76, 175, 80, 0.3)' : 'transparent')};
                color: ${isSelected ? 'white' : '#ccc'};
                border: 1px solid ${isMultiSelected ? '#4CAF50' : 'transparent'};
                transition: background 0.2s, transform 0.2s;
            `;

            // Drag and Drop Logic
            row.draggable = true;

            row.ondragstart = (e) => {
                draggedItem = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                row.style.opacity = '0.5';
            };

            row.ondragend = () => {
                row.style.opacity = '1';
                draggedItem = null;
                // Remove visual cues from all rows
                Array.from(this.sidebar.children).forEach(child => {
                    child.style.borderTop = '';
                    child.style.borderBottom = '';
                });
            };

            row.ondragover = (e) => {
                e.preventDefault(); // Necessary to allow dropping
                e.dataTransfer.dropEffect = 'move';
                return false;
            };

            row.ondragenter = (e) => {
                e.preventDefault();
                if (draggedItem !== index) {
                    if (index < draggedItem) {
                        row.style.borderTop = '2px solid #4CAF50';
                    } else {
                        row.style.borderBottom = '2px solid #4CAF50';
                    }
                }
            };

            row.ondragleave = () => {
                row.style.borderTop = '';
                row.style.borderBottom = '';
            };

            row.ondrop = (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (draggedItem !== null && draggedItem !== index) {
                    // Reorder array
                    const newOrder = [...this.tempSettings.layerOrder];
                    const [movedItem] = newOrder.splice(draggedItem, 1);
                    newOrder.splice(index, 0, movedItem);

                    this.tempSettings.layerOrder = newOrder;
                    this.updatePreview(); // Reflect changes in Z-Index
                    this.renderSidebar(); // Re-render list
                }
                return false;
            };

            // Vis Checkbox (Stop propagation so we don't select row when checking)
            const check = document.createElement('input');
            check.type = "checkbox";
            const vKey = item.id === 'health' ? 'showHealth' : (item.id === 'jump' ? 'showJump' : 'showInventory');
            check.checked = this.tempSettings[vKey];
            check.style.cursor = "pointer";
            check.onclick = (e) => e.stopPropagation();
            check.onchange = (e) => {
                this.tempSettings[vKey] = e.target.checked;
                this.updatePreview();
                this.renderProperties(); // Sync with Properties Panel
            };
            row.appendChild(check);

            const label = document.createElement('span');
            label.textContent = item.label;
            label.style.fontSize = "13px";
            label.style.flex = "1";
            label.style.pointerEvents = "none"; // Let clicks pass through to row
            row.appendChild(label);

            // Drag Handle Icon (Optional visual)
            const handle = document.createElement('span');
            handle.innerHTML = '☰';
            handle.style.cssText = "color: #666; font-size: 12px; cursor: grab;";
            row.appendChild(handle);


            row.onclick = (e) => {
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    this.layoutSystem.toggleSelection(item.id);
                } else {
                    this.selectedId = item.id; // For properties panel
                    this.layoutSystem.select(item.id, false); // Exclusive select
                }
                // Re-render to update selection styles without full rebuild?
                // Actually full rebuild is safer for state consistency
                this.renderSidebar();
                this.renderProperties();
            };

            this.sidebar.appendChild(row);
        });
    }

    renderProperties() {
        this.propertyPanel.innerHTML = '';

        if (!this.selectedId) {
            this.propertyPanel.innerHTML = `<div style="color:#666; text-align:center; margin-top:50px;">Selecciona un elemento</div>`;
            return;
        }

        const type = this.selectedId;
        const title = type === 'health' ? "Salud (Vida)" : (type === 'jump' ? "Salto (Carga)" : "Inventario");

        // Re-use logic from createSection but adapt to just render one
        this.createSection(this.propertyPanel, title, type);
    }


    // Helper Styles



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
            this.renderSidebar(); // Sync with Sidebar
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
                const oldOrient = this.tempSettings[prefix + 'Orientation'];
                this.tempSettings[prefix + 'Orientation'] = v;

                // Auto-swap dimensions if orientation changes
                if (oldOrient !== v) {
                    const wKey = prefix + 'Width';
                    const hKey = prefix + 'Height';
                    const curW = this.tempSettings[wKey];
                    const curH = this.tempSettings[hKey];

                    // Swap
                    this.tempSettings[wKey] = curH;
                    this.tempSettings[hKey] = curW;

                    // Update Inputs
                    if (this.uiInputs[wKey]) this.uiInputs[wKey].value = curH;
                    if (this.uiInputs[hKey]) this.uiInputs[hKey].value = curW;
                }

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
            wInput.type = "number"; wInput.min = 5; wInput.value = this.tempSettings[prefix + 'Width'] || (type === 'health' ? 300 : 200);
            wInput.style.width = "100%"; wInput.style.background = "#333"; wInput.style.color = "white"; wInput.style.border = "1px solid #555";
            wInput.onchange = (e) => {
                let val = parseInt(e.target.value) || 100;
                if (val < 5) val = 5; // Minimal Width 5px
                e.target.value = val;
                this.tempSettings[prefix + 'Width'] = val;
                this.updatePreview();
            };
            this.uiInputs[prefix + 'Width'] = wInput; // Store reference

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
                let val = parseInt(e.target.value) || 10;
                if (val < 5) val = 5; // Minimal Height 5px
                e.target.value = val;
                this.tempSettings[prefix + 'Height'] = val;
                this.updatePreview();
            };
            this.uiInputs[prefix + 'Height'] = hInput; // Store reference

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

            // Slot Size Input
            const sizeInput = document.createElement('input');
            sizeInput.type = "number";
            sizeInput.min = 5;
            sizeInput.max = 100;
            sizeInput.value = this.tempSettings.inventorySlotSize || 50;
            sizeInput.style.cssText = "background: #333; color: white; border: 1px solid #555; padding: 5px; width: 60px; margin-left: 10px;";
            sizeInput.onchange = (e) => {
                let v = parseInt(e.target.value);
                if (v < 5) v = 5;
                if (v > 100) v = 100;
                this.tempSettings.inventorySlotSize = v;
                this.updatePreview();
            };
            this.uiInputs['inventorySlotSize'] = sizeInput;

            const sizeLabel = document.createElement('div');
            sizeLabel.textContent = "Tamaño Item:";
            sizeLabel.style.color = "#aaa";
            sizeLabel.style.marginBottom = "5px";
            sizeLabel.style.marginTop = "10px";

            sec.appendChild(sizeLabel);
            sec.appendChild(sizeInput);

            // Container Dimensions
            const dimRow = document.createElement('div');
            dimRow.style.cssText = "display: flex; gap: 10px; margin-top: 10px;";

            // Width
            const widthContainer = document.createElement('div');
            const wLabel = document.createElement('div');
            wLabel.textContent = "Ancho Fondo";
            wLabel.style.fontSize = "10px"; wLabel.style.color = "#aaa";
            const wInput = document.createElement('input');
            wInput.type = "number"; wInput.min = 5;
            // Default to empty if undefined, let preview update it
            wInput.value = this.tempSettings.inventoryContainerWidth || '';
            wInput.style.cssText = "width: 100%; background: #333; color: white; border: 1px solid #555;";
            wInput.onchange = (e) => {
                let val = parseInt(e.target.value) || 300;
                if (val < 5) val = 5;
                this.tempSettings.inventoryContainerWidth = val;
                this.updatePreview();
            };
            this.uiInputs['inventoryContainerWidth'] = wInput;
            widthContainer.appendChild(wLabel);
            widthContainer.appendChild(wInput);

            // Height
            const heightContainer = document.createElement('div');
            const hLabel = document.createElement('div');
            hLabel.textContent = "Alto Fondo";
            hLabel.style.fontSize = "10px"; hLabel.style.color = "#aaa";
            const hInput = document.createElement('input');
            hInput.type = "number"; hInput.min = 5;
            hInput.value = this.tempSettings.inventoryContainerHeight || '';
            hInput.style.cssText = "width: 100%; background: #333; color: white; border: 1px solid #555;";
            hInput.onchange = (e) => {
                let val = parseInt(e.target.value) || 100;
                if (val < 5) val = 5;
                this.tempSettings.inventoryContainerHeight = val;
                this.updatePreview();
            };
            this.uiInputs['inventoryContainerHeight'] = hInput;
            heightContainer.appendChild(hLabel);
            heightContainer.appendChild(hInput);

            dimRow.appendChild(widthContainer);
            dimRow.appendChild(heightContainer);
            sec.appendChild(dimRow);

            // Free Layout Toggle
            const freeRow = document.createElement('div');
            freeRow.style.cssText = "margin-top: 10px; display: flex; align-items: center; gap: 10px;";
            const freeCheck = document.createElement('input');
            freeCheck.type = "checkbox";
            freeCheck.checked = this.tempSettings.inventoryFreeLayout || false;

            freeCheck.onchange = (e) => {
                const isFree = e.target.checked;

                if (isFree) {
                    // Switch to Free Mode: Capture CURRENT visuals to make transition seamless
                    const container = this.contentWrapper.querySelector('.inventory-container-preview');
                    if (container) {
                        // 1. Capture Dimensions
                        const currentW = container.offsetWidth;
                        const currentH = container.offsetHeight;

                        this.tempSettings.inventoryContainerWidth = currentW;
                        this.tempSettings.inventoryContainerHeight = currentH;

                        // Update Inputs immediately
                        if (this.uiInputs['inventoryContainerWidth']) this.uiInputs['inventoryContainerWidth'].value = currentW;
                        if (this.uiInputs['inventoryContainerHeight']) this.uiInputs['inventoryContainerHeight'].value = currentH;

                        // 2. Capture Slot Positions
                        // We need to get positions relative to the container *before* we switch mode
                        // Currently they are static/relative/flex. 
                        // offsetLeft/Top gives position relative to offsetParent (the container)
                        const slots = container.querySelectorAll('.inventory-slot');
                        const positions = [];
                        slots.forEach(slot => {
                            positions.push({
                                left: slot.offsetLeft + 'px',
                                top: slot.offsetTop + 'px'
                            });
                        });
                        this.tempSettings.inventorySlotPositions = positions;
                    } else {
                        // Fallback if container not found (rare)
                        if (!this.tempSettings.inventoryContainerWidth) this.tempSettings.inventoryContainerWidth = 300;
                        if (!this.tempSettings.inventoryContainerHeight) this.tempSettings.inventoryContainerHeight = 100;
                    }

                } else {
                    // Reset to Auto Mode: Clear custom positions and dimensions
                    this.tempSettings.inventorySlotPositions = [];

                    // Reset dimensions to allow auto-calculate (undefined or null)
                    delete this.tempSettings.inventoryContainerWidth;
                    delete this.tempSettings.inventoryContainerHeight;

                    // Update inputs to reflect reset
                    if (this.uiInputs['inventoryContainerWidth']) this.uiInputs['inventoryContainerWidth'].value = '';
                    if (this.uiInputs['inventoryContainerHeight']) this.uiInputs['inventoryContainerHeight'].value = '';
                }

                this.tempSettings.inventoryFreeLayout = isFree;
                this.updatePreview();
            };

            const freeLabel = document.createElement('label');
            freeLabel.textContent = "Diseño Libre (Mover Slots)";
            freeLabel.style.color = "#ccc";
            freeLabel.style.fontSize = "12px";
            freeRow.appendChild(freeCheck);
            freeRow.appendChild(freeLabel);
            sec.appendChild(freeRow);

            // Padding
            const padRow = document.createElement('div');
            padRow.style.cssText = "margin-top: 10px; display: flex; align-items: center; gap: 10px;";
            const padLabel = document.createElement('label');
            padLabel.textContent = "Padding:";
            padLabel.style.color = "#aaa";
            const padInput = document.createElement('input');
            padInput.type = "number"; padInput.value = this.tempSettings.inventoryPadding !== undefined ? this.tempSettings.inventoryPadding : 10;
            padInput.style.cssText = "width: 50px; background: #333; color: white; border: 1px solid #555;";
            padInput.onchange = (e) => {
                this.tempSettings.inventoryPadding = parseInt(e.target.value) || 0;
                this.updatePreview();
            };
            padRow.appendChild(padLabel);
            padRow.appendChild(padInput);
            sec.appendChild(padRow);

            // Alignment Grid (3x3)
            const alignContainer = document.createElement('div');
            alignContainer.style.cssText = "margin-top: 15px;";

            const alignLabel = document.createElement('div');
            alignLabel.textContent = "Alineación de Slots (Auto Mode):";
            alignLabel.style.fontSize = "12px"; alignLabel.style.color = "#aaa"; alignLabel.style.marginBottom = "5px";
            alignContainer.appendChild(alignLabel);

            const grid = document.createElement('div');
            grid.style.cssText = "display: grid; grid-template-columns: repeat(3, 20px); gap: 2px; width: fit-content;";

            // Default alignment if not set
            if (!this.tempSettings.inventorySlotAlignment) this.tempSettings.inventorySlotAlignment = 'center';

            const alignments = [
                'top-left', 'top-center', 'top-right',
                'center-left', 'center', 'center-right',
                'bottom-left', 'bottom-center', 'bottom-right'
            ];

            alignments.forEach(align => {
                const cell = document.createElement('div');
                cell.style.cssText = "width: 20px; height: 20px; background: #333; border: 1px solid #555; cursor: pointer;";
                cell.title = align;

                // Highlight active
                if (this.tempSettings.inventorySlotAlignment === align) {
                    cell.style.background = '#4CAF50';
                    cell.style.borderColor = '#4CAF50';
                }

                cell.onclick = () => {
                    this.tempSettings.inventorySlotAlignment = align;
                    // Update visual selection
                    Array.from(grid.children).forEach(c => {
                        c.style.background = '#333';
                        c.style.borderColor = '#555';
                    });
                    cell.style.background = '#4CAF50';
                    cell.style.borderColor = '#4CAF50';

                    this.updatePreview();
                };
                grid.appendChild(cell);
            });
            alignContainer.appendChild(grid);
            sec.appendChild(alignContainer);
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

        const layerOrder = this.tempSettings.layerOrder || ['health', 'jump', 'inventory'];
        // Append in reverse order (Bottom Layer first)
        // List: [Top, Middle, Bottom] -> Append: Bottom, Middle, Top
        for (let i = layerOrder.length - 1; i >= 0; i--) {
            const id = layerOrder[i];
            if (id === 'health' && this.tempSettings.showHealth) this.renderPreviewHealth();
            else if (id === 'jump' && this.tempSettings.showJump) this.renderPreviewJump();
            else if (id === 'inventory' && this.tempSettings.showInventory) this.renderPreviewInventory();
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

        // Enable Resizing if style is 'bar'
        if (this.tempSettings.healthStyle === 'bar') {
            this.makeResizable(el, 'health');
        }

        this.layoutSystem.registerElement(el, 'health', this.tempSettings.healthPos, (newPos) => {
            this.tempSettings.healthPos = newPos;
        });
    }

    renderPreviewJump() {
        const el = document.createElement('div');
        el.style.cssText = `display: flex; align-items: center;`;

        if (this.tempSettings.jumpStyle === 'bar') {
            const w = this.tempSettings.jumpWidth || 200;
            const h = this.tempSettings.jumpHeight || 8;
            const isVert = this.tempSettings.jumpOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border: 2px solid #333; border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #00cfff, #0077ff); clip-path: inset(${isVert ? '30% 0 0 0' : '0 30% 0 0'});"></div>
                    ${this.tempSettings.jumpShowText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.min(w, h) / 1.5}px; font-weight:bold; text-shadow:1px 1px 1px black;">80%</div>`
                    : ''}
                </div>
            `;
        } else if (this.tempSettings.jumpStyle === 'circle') {
            el.innerHTML = `<div style="width:50px; height:50px; border:3px solid #00cfff; border-radius:50%; position:relative;">
                <div style="position:absolute; bottom:0; left:0; width:100%; height:60%; background:#00cfff; border-radius:0 0 50% 50%;"></div>
            </div>`;
        }

        this.contentWrapper.appendChild(el);

        if (this.tempSettings.jumpStyle === 'bar') {
            this.makeResizable(el, 'jump');
        }

        this.layoutSystem.registerElement(el, 'jump', this.tempSettings.jumpPos, (newPos) => {
            this.tempSettings.jumpPos = newPos;
        });
    }

    renderPreviewInventory() {
        const container = document.createElement('div');
        container.className = 'inventory-container-preview';

        // Free Layout Mode
        const isFree = this.tempSettings.inventoryFreeLayout;

        let slots = this.tempSettings.inventorySlots || 9;
        let size = this.tempSettings.inventorySlotSize || 50;
        const padding = this.tempSettings.inventoryPadding !== undefined ? this.tempSettings.inventoryPadding : 10;

        if (isFree) {
            // Use custom dimensions if set
            const containerWidth = this.tempSettings.inventoryContainerWidth || (slots * (size + padding) + padding);
            const containerHeight = this.tempSettings.inventoryContainerHeight || (size + padding * 2);

            container.style.cssText = `
                width: ${containerWidth}px; height: ${containerHeight}px;
                background: rgba(0,0,0,0.6); border: 1px solid #555;
                display: block; position: relative; border-radius: 6px;
            `;

            for (let i = 0; i < slots; i++) {
                const slot = document.createElement('div');
                slot.className = 'inventory-slot';
                const pos = this.tempSettings.inventorySlotPositions[i] || { left: (i * (size + padding) + padding) + 'px', top: padding + 'px' };
                slot.style.cssText = `
                    width:${size}px; height:${size}px; border:1px solid #444;
                    background: rgba(255,255,255,0.05);
                    position: absolute; left: ${pos.left}; top: ${pos.top};
                    border-radius: 4px; box-sizing: border-box;
                `;
                container.appendChild(slot);
            }
        } else {
            // Auto Layout
            // Determine container size if not explicitly set
            const containerWidth = this.tempSettings.inventoryContainerWidth || (slots * size + (slots - 1) * padding + padding * 2);
            const containerHeight = this.tempSettings.inventoryContainerHeight || (size + padding * 2);

            container.style.cssText = `
                width: ${containerWidth}px; height: ${containerHeight}px;
                background: rgba(0,0,0,0.6); border: 1px solid #555;
                display: flex; gap: ${padding}px; padding: ${padding}px;
                border-radius: 6px; align-items: center; justify-content: center;
            `;

            for (let i = 0; i < slots; i++) {
                const slot = document.createElement('div');
                slot.className = 'inventory-slot';
                slot.style.cssText = `
                    width:${size}px; height:${size}px; border:1px solid #444;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px; box-sizing: border-box;
                `;
                container.appendChild(slot);
            }

            // Alignment
            const align = this.tempSettings.inventorySlotAlignment || 'center';
            const alignMap = {
                'top-left': ['flex-start', 'flex-start'],
                'top-center': ['center', 'flex-start'],
                'top-right': ['flex-end', 'flex-start'],
                'center-left': ['flex-start', 'center'],
                'center': ['center', 'center'],
                'center-right': ['flex-end', 'center'],
                'bottom-left': ['flex-start', 'flex-end'],
                'bottom-center': ['center', 'flex-end'],
                'bottom-right': ['flex-end', 'flex-end']
            };

            const [justify, alignItems] = alignMap[align] || ['center', 'center'];
            container.style.justifyContent = justify;
            container.style.alignItems = alignItems;
        }

        this.contentWrapper.appendChild(container);

        this.makeResizable(container, 'inventory');

        this.layoutSystem.registerElement(container, 'inventory', this.tempSettings.inventoryPos, (newPos) => {
            this.tempSettings.inventoryPos = newPos;
        });
    }

    // --- Resize / Drag Helpers ---

    makeResizable(el, type) {
        // Add bottom-right corner resize handle
        const handle = document.createElement('div');
        handle.style.cssText = `
            position: absolute; width: 10px; height: 10px; background: #4CAF50;
            right: -5px; bottom: -5px; cursor: se-resize; z-index: 5;
        `;
        el.style.position = 'relative';
        el.appendChild(handle);

        let startX, startY, startW, startH;

        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startW = el.offsetWidth;
            startH = el.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (type === 'health' || type === 'jump') {
                const wKey = type + 'Width';
                const hKey = type + 'Height';

                let newW = startW + dx;
                let newH = startH + dy;

                if (newW < 5) newW = 5;
                if (newH < 5) newH = 5;

                this.tempSettings[wKey] = newW;
                this.tempSettings[hKey] = newH;

                if (this.uiInputs[wKey]) this.uiInputs[wKey].value = newW;
                if (this.uiInputs[hKey]) this.uiInputs[hKey].value = newH;

                this.updatePreview();

            } else if (type === 'inventory') {
                let newW = startW + dx;
                let newH = startH + dy;
                if (newW < 50) newW = 50;
                if (newH < 50) newH = 50;

                this.tempSettings.inventoryContainerWidth = newW;
                this.tempSettings.inventoryContainerHeight = newH;

                if (this.uiInputs['inventoryContainerWidth']) this.uiInputs['inventoryContainerWidth'].value = newW;
                if (this.uiInputs['inventoryContainerHeight']) this.uiInputs['inventoryContainerHeight'].value = newH;

                this.updatePreview();
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', onMouseDown);
    }

    // --- Save / Close ---

    save() {
        // Apply settings to profile
        this.profile.hudSettings = this.tempSettings;

        // Save in manager if any
        if (this.manager && this.manager.updateProfile) {
            this.manager.updateProfile(this.profile.id, { hudSettings: this.tempSettings });
        }

        this.close();
    }

    close() {
        if (this.container) {
            animate(this.container, {
                opacity: [1, 0],
                duration: 200,
                easing: 'easeInQuad',
                complete: () => {
                    if (this.container) {
                        document.body.removeChild(this.container);
                        this.container = null;
                        if (this.onClose) this.onClose();
                    }
                }
            });
        }
    }

    toggleMinimize(windowEl, content, footer, minBtn) {
        if (this.isMinimized) {
            content.style.display = 'flex';
            footer.style.display = 'flex';
            windowEl.style.height = '600px';
            minBtn.innerHTML = '−';
            this.isMinimized = false;
        } else {
            content.style.display = 'none';
            footer.style.display = 'none';
            windowEl.style.height = '50px';
            minBtn.innerHTML = '+';
            this.isMinimized = true;
        }
    }
}

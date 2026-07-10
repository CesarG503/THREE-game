// @ts-nocheck

import { animate, stagger } from 'animejs'
import { HUDLayoutSystem } from './modules/HUDLayoutSystem'
import { getActiveFarmingGroups } from './GameHUD'
import {
    applyViewportConstraint,
    clamp,
    deriveViewportConstraintOffsets,
    fitLength,
    getViewportMetrics,
    hasViewportConstraint,
    keepElementInsideContainer,
    positionFromContainerRect,
    positionFromRect,
    rectsTouchOrOverlap,
    resolveAnchoredPosition,
    scaleHUDValue,
    scalePixelPosition
} from './modules/HUDResponsiveUtils'

function ensureStaminaHUDDefaults(hudSettings: any) {
    if (!hudSettings) return;

    if (hudSettings.showStamina === undefined) {
        hudSettings.showStamina = true;
    }
    if (hudSettings.staminaStyle === undefined) {
        hudSettings.staminaStyle = 'bar';
    }
    if (!hudSettings.staminaPos) {
        hudSettings.staminaPos = {
            left: "33.69%",
            top: "94.77%"
        };
    }
    if (hudSettings.staminaShowText === undefined) {
        hudSettings.staminaShowText = false;
    }
    if (hudSettings.staminaOrientation === undefined) {
        hudSettings.staminaOrientation = "horizontal";
    }
    if (hudSettings.staminaWidth === undefined) {
        hudSettings.staminaWidth = 277;
    }
    if (hudSettings.staminaHeight === undefined) {
        hudSettings.staminaHeight = 5;
    }

    if (hudSettings.layerOrder && !hudSettings.layerOrder.includes('stamina')) {
        const idx = hudSettings.layerOrder.indexOf('inventory');
        if (idx !== -1) {
            hudSettings.layerOrder.splice(idx, 0, 'stamina');
        } else {
            hudSettings.layerOrder.push('stamina');
        }
    }

    if (!hudSettings.hudAnchors) {
        hudSettings.hudAnchors = {};
    }
    if (!hudSettings.hudAnchors.stamina) {
        hudSettings.hudAnchors.stamina = {
            parentId: "inventory",
            pos: {
                left: "5.912%",
                top: "63.000%"
            }
        };
    }
}

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
        this.viewportResizeTimer = null;
        this.selectedPropertyTab = 'style';
        this.constraintGuideLayer = null;
        this.previewBackdropEnabled = false;
        this.previewBackdropButton = null;
    }

    open(profile) {
        this.profile = profile;
        this.tempSettings = JSON.parse(JSON.stringify(profile.hudSettings || {}));
        ensureStaminaHUDDefaults(this.tempSettings);
        this.selectedId = 'health'; // Default selection
        this.selectedPropertyTab = 'style';
        this.previewBackdropEnabled = false;
        this.previewBackdropButton = null;
        this.contentWrapper = null;
        this.uiInputs = {};

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

        // Stamina
        if (this.tempSettings.showStamina === undefined) this.tempSettings.showStamina = true;
        if (this.tempSettings.staminaStyle === undefined) this.tempSettings.staminaStyle = 'bar';
        if (!this.tempSettings.staminaPos) this.tempSettings.staminaPos = { top: '85%', left: '5%' };
        if (this.tempSettings.staminaWidth === undefined) this.tempSettings.staminaWidth = 200;
        if (this.tempSettings.staminaHeight === undefined) this.tempSettings.staminaHeight = 8;
        if (this.tempSettings.staminaOrientation === undefined) this.tempSettings.staminaOrientation = 'horizontal';
        if (this.tempSettings.staminaShowText === undefined) this.tempSettings.staminaShowText = false;

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
        if (!this.tempSettings.hudConstraints) this.tempSettings.hudConstraints = {};

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
        this.layoutSystem.setDragGroupResolver((selectedIds) => this.getAnchorDescendants(selectedIds));
        this.layoutSystem.setDragMoveCallback((draggedIds) => {
            this.syncConstraintOffsetsFromPreview(draggedIds);
            this.syncHudAnchorsFromPreview();
            this.updateConstraintPanelReadouts();
            this.updateConstraintGuides();
        });
        this.layoutSystem.setDragEndCallback((draggedIds) => {
            this.syncConstraintOffsetsFromPreview(draggedIds);
            this.syncHudAnchorsFromPreview();
            this.applyPreviewConstraints();
            this.applyPreviewAnchors();
            this.syncHudAnchorsFromPreview();
            this.updateConstraintPanelReadouts();
            this.updateConstraintGuides();
        });

        this.previewContainer = previewArea;
        this.constraintGuideLayer = document.createElement('div');
        this.constraintGuideLayer.className = 'hud-constraint-guides';
        this.constraintGuideLayer.style.cssText = `
            position: absolute; inset: 0;
            pointer-events: none;
            z-index: 6;
            overflow: hidden;
        `;
        previewArea.appendChild(this.constraintGuideLayer);

        // 2. Floating Config Window (Resized and Layout Changed)
        const configWindow = document.createElement('div');
        configWindow.className = 'hud-config-window';
        configWindow.style.cssText = `
            position: absolute; right: 12px; top: 12px; width: min(500px, calc(100vw - 24px)); height: min(600px, calc(100dvh - 24px));
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

        const eyeBtn = document.createElement('button');
        eyeBtn.innerHTML = "👁";
        eyeBtn.title = "Mostrar fondo blanco";
        eyeBtn.style.cssText = "background:none; border:none; color:#aaa; font-size: 16px; cursor: pointer; margin-right: 10px; font-weight: bold; vertical-align: middle; width:24px; height:24px; line-height:20px; display:flex; align-items:center; justify-content:center; border-radius:4px;";
        eyeBtn.onclick = (e) => {
            e.stopPropagation();
            this.togglePreviewBackdrop();
        };
        this.previewBackdropButton = eyeBtn;
        controls.appendChild(eyeBtn);
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

        this.onViewportResize = () => {
            window.clearTimeout(this.viewportResizeTimer);
            this.viewportResizeTimer = window.setTimeout(() => this.updatePreview(), 80);
        };
        window.addEventListener('resize', this.onViewportResize);
        window.visualViewport?.addEventListener('resize', this.onViewportResize);

        // Initial Render
        this.renderSidebar();
        this.renderProperties();
        this.updatePreview();
        this.applyPreviewBackdrop();
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
        const activeGroups = getActiveFarmingGroups(this.game);
        const order = [...(this.tempSettings.layerOrder || ['health', 'jump', 'stamina', 'inventory'])];
        activeGroups.forEach(g => {
            const id = "fz_" + g.groupId;
            if (!order.includes(id)) {
                order.push(id);
            }
        });
        // Ensure layerOrder is initialized if missing
        if (!this.tempSettings.layerOrder) this.tempSettings.layerOrder = order;

        const labels = { 'health': 'Salud', 'jump': 'Salto', 'stamina': 'Estamina', 'inventory': 'Inventario' };
        const items = order.map(id => {
            if (id.startsWith("fz_")) {
                const gId = id.substring(3);
                return { id: id, label: `Farmeo: ${gId}` };
            }
            return { id: id, label: labels[id] || id };
        });

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
            const vKey = item.id.startsWith("fz_") ? "show_" + item.id : (item.id === 'health' ? 'showHealth' : (item.id === 'jump' ? 'showJump' : (item.id === 'stamina' ? 'showStamina' : 'showInventory')));
            if (this.tempSettings[vKey] === undefined) {
                this.tempSettings[vKey] = true;
            }
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
        this.renderPropertyTabs(this.propertyPanel);

        const body = document.createElement('div');
        this.propertyPanel.appendChild(body);

        if (this.selectedPropertyTab === 'constraints') {
            this.renderConstraintProperties(body, type);
            this.updateConstraintGuides();
            return;
        }

        if (type.startsWith("fz_")) {
            const gId = type.substring(3);
            this.renderFarmingZoneGroupProperties(body, gId);
            return;
        }

        const title = type === 'health' ? "Salud (Vida)" : (type === 'jump' ? "Salto (Carga)" : (type === 'stamina' ? "Estamina (Correr)" : "Inventario"));

        // Re-use logic from createSection but adapt to just render one
        this.createSection(body, title, type);
    }

    renderPropertyTabs(parent) {
        const tabs = document.createElement('div');
        tabs.style.cssText = "display:flex; gap:6px; margin-bottom:14px; border-bottom:1px solid #3f3f3f; padding-bottom:8px;";

        const makeTab = (id, label) => {
            const btn = document.createElement('button');
            const active = this.selectedPropertyTab === id;
            btn.textContent = label;
            btn.style.cssText = `
                border: 1px solid ${active ? '#4CAF50' : '#555'};
                background: ${active ? 'rgba(76, 175, 80, 0.22)' : '#2f2f2f'};
                color: ${active ? '#fff' : '#bbb'};
                border-radius: 4px;
                padding: 7px 10px;
                font-size: 12px;
                cursor: pointer;
            `;
            btn.onclick = () => {
                this.selectedPropertyTab = id;
                this.renderProperties();
                this.updateConstraintGuides();
            };
            return btn;
        };

        tabs.appendChild(makeTab('style', 'Opciones'));
        tabs.appendChild(makeTab('constraints', 'Constraints'));
        parent.appendChild(tabs);
    }

    getSelectedConstraintIds() {
        const selected = this.layoutSystem ? Array.from(this.layoutSystem.selection) : [];
        if (selected.length > 0) return selected;
        return this.selectedId ? [this.selectedId] : [];
    }

    getConstraint(id) {
        if (!this.tempSettings.hudConstraints) this.tempSettings.hudConstraints = {};
        if (!this.tempSettings.hudConstraints[id]) {
            this.tempSettings.hudConstraints[id] = {
                horizontal: 'free',
                vertical: 'free',
                offsetX: 0,
                offsetY: 0
            };
        }
        return this.tempSettings.hudConstraints[id];
    }

    cleanupConstraints() {
        const constraints = this.tempSettings.hudConstraints;
        if (!constraints) return;

        Object.keys(constraints).forEach(id => {
            const c = constraints[id];
            if (!hasViewportConstraint(c)) {
                delete constraints[id];
            }
        });

        if (Object.keys(constraints).length === 0) {
            delete this.tempSettings.hudConstraints;
        }
    }

    setConstraintForIds(ids, patch, options = {}) {
        ids.forEach(id => {
            const current = { ...this.getConstraint(id), ...patch };
            const el = this.getHudElement(id);
            if (el && !options.zeroOffsets) {
                const offsets = deriveViewportConstraintOffsets(this.previewContainer, el, current);
                current.offsetX = offsets.offsetX;
                current.offsetY = offsets.offsetY;
            }
            if (options.zeroOffsets) {
                if (patch.horizontal && patch.horizontal !== 'free') current.offsetX = 0;
                if (patch.vertical && patch.vertical !== 'free') current.offsetY = 0;
            }
            this.getConstraint(id);
            this.tempSettings.hudConstraints[id] = current;
        });
        this.applyPreviewConstraints(ids);
        this.applyPreviewAnchors();
        this.syncHudAnchorsFromPreview();
        this.updateConstraintGuides();
    }

    getConstraintLineMetrics(id, constraint) {
        const el = this.getHudElement(id);
        if (!el || !this.previewContainer) return null;

        const containerRect = this.previewContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const metrics = {};

        if (constraint.horizontal && constraint.horizontal !== 'free') {
            const line = constraint.horizontal === 'center'
                ? containerRect.width / 2
                : constraint.horizontal === 'right'
                    ? containerRect.width
                    : 0;
            const point = constraint.horizontal === 'center'
                ? elRect.left - containerRect.left + elRect.width / 2
                : constraint.horizontal === 'right'
                    ? elRect.right - containerRect.left
                    : elRect.left - containerRect.left;
            metrics.x = {
                line: Math.round(line),
                point: Math.round(point),
                relative: Math.round(point - line)
            };
        }

        if (constraint.vertical && constraint.vertical !== 'free') {
            const line = constraint.vertical === 'center'
                ? containerRect.height / 2
                : constraint.vertical === 'bottom'
                    ? containerRect.height
                    : 0;
            const point = constraint.vertical === 'center'
                ? elRect.top - containerRect.top + elRect.height / 2
                : constraint.vertical === 'bottom'
                    ? elRect.bottom - containerRect.top
                    : elRect.top - containerRect.top;
            metrics.y = {
                line: Math.round(line),
                point: Math.round(point),
                relative: Math.round(point - line)
            };
        }

        return metrics;
    }

    getAnchorChildren(parentId) {
        const anchors = this.tempSettings.hudAnchors || {};
        return Object.entries(anchors)
            .filter(([, anchor]) => anchor?.parentId === parentId)
            .map(([id]) => id);
    }

    getAnchorDescendants(parentIds) {
        const result = new Set();
        const visit = (parentId) => {
            this.getAnchorChildren(parentId).forEach(childId => {
                if (result.has(childId)) return;
                result.add(childId);
                visit(childId);
            });
        };

        parentIds.forEach(visit);
        return Array.from(result);
    }

    applyConstraintOffsetInput(ids, key, value) {
        ids.forEach(id => {
            const c = this.getConstraint(id);
            c[key] = value;
        });
        this.applyPreviewConstraints(ids);
        this.applyPreviewAnchors();
        this.syncHudAnchorsFromPreview();
        this.updateConstraintGuides();
        this.updateConstraintPanelReadouts();
    }

    updateConstraintPanelReadouts() {
        if (this.selectedPropertyTab !== 'constraints' || !this.propertyPanel) return;

        const ids = this.getSelectedConstraintIds();
        const primary = ids[0] || this.selectedId;
        if (!primary) return;

        const constraint = this.getConstraint(primary);
        const metrics = this.getConstraintLineMetrics(primary, constraint);
        const childIds = this.getAnchorChildren(primary);

        const updateAxis = (axis, offsetKey) => {
            const data = metrics?.[axis];
            const info = this.propertyPanel.querySelector(`[data-constraint-info="${axis}"]`);
            const input = this.propertyPanel.querySelector(`[data-constraint-relative="${axis}"]`);
            const offsetInput = this.propertyPanel.querySelector(`[data-constraint-offset="${offsetKey}"]`);

            if (info) {
                info.textContent = data
                    ? `${axis.toUpperCase()}: punto ${data.point}px / línea ${data.line}px`
                    : `${axis.toUpperCase()}: eje libre`;
            }
            if (input && document.activeElement !== input) {
                input.disabled = !data;
                input.value = data ? data.relative : 0;
            }
            if (offsetInput && document.activeElement !== offsetInput) {
                offsetInput.value = Math.round(Number(constraint[offsetKey]) || 0);
            }
        };

        updateAxis('x', 'offsetX');
        updateAxis('y', 'offsetY');

        const childInfo = this.propertyPanel.querySelector('[data-constraint-children]');
        if (childInfo) {
            childInfo.textContent = childIds.length > 0
                ? `Hijos relativos: ${childIds.join(', ')}`
                : "Hijos relativos: ninguno";
        }
    }

    renderConstraintProperties(parent, type) {
        const sec = document.createElement('div');
        sec.style.marginBottom = "20px";

        const title = document.createElement('h3');
        title.textContent = "Constraint Widget";
        title.style.cssText = "color: #ddd; border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px; font-size:14px;";
        sec.appendChild(title);

        const ids = this.getSelectedConstraintIds();
        const primary = ids[0] || type;
        const constraint = this.getConstraint(primary);
        const metrics = this.getConstraintLineMetrics(primary, constraint);
        const childIds = this.getAnchorChildren(primary);

        const rowStyle = "margin-bottom: 10px;";
        const labelStyle = "color:#aaa; font-size:12px; margin-bottom:5px;";
        const selectStyle = "width:100%; background:#333; color:white; border:1px solid #555; padding:5px;";

        const axisRow = document.createElement('div');
        axisRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:10px;";

        const xWrap = document.createElement('div');
        xWrap.style.cssText = rowStyle;
        const xLabel = document.createElement('div');
        xLabel.textContent = "Eje X";
        xLabel.style.cssText = labelStyle;
        const xSelect = document.createElement('select');
        xSelect.style.cssText = selectStyle;
        [
            ['free', 'Libre'],
            ['left', 'Izquierda'],
            ['center', 'Centro'],
            ['right', 'Derecha']
        ].forEach(([value, text]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            if ((constraint.horizontal || 'free') === value) opt.selected = true;
            xSelect.appendChild(opt);
        });
        xSelect.onchange = (e) => this.setConstraintForIds(ids, { horizontal: e.target.value });
        xWrap.appendChild(xLabel);
        xWrap.appendChild(xSelect);

        const yWrap = document.createElement('div');
        yWrap.style.cssText = rowStyle;
        const yLabel = document.createElement('div');
        yLabel.textContent = "Eje Y";
        yLabel.style.cssText = labelStyle;
        const ySelect = document.createElement('select');
        ySelect.style.cssText = selectStyle;
        [
            ['free', 'Libre'],
            ['top', 'Arriba'],
            ['center', 'Centro'],
            ['bottom', 'Abajo']
        ].forEach(([value, text]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            if ((constraint.vertical || 'free') === value) opt.selected = true;
            ySelect.appendChild(opt);
        });
        ySelect.onchange = (e) => this.setConstraintForIds(ids, { vertical: e.target.value });
        yWrap.appendChild(yLabel);
        yWrap.appendChild(ySelect);

        axisRow.appendChild(xWrap);
        axisRow.appendChild(yWrap);
        sec.appendChild(axisRow);

        const offsetRow = document.createElement('div');
        offsetRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:10px;";

        const makeOffsetInput = (key, label) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = rowStyle;
            const l = document.createElement('div');
            l.textContent = label;
            l.style.cssText = labelStyle;
            const input = document.createElement('input');
            input.type = "number";
            input.value = Math.round(Number(constraint[key]) || 0);
            input.dataset.constraintOffset = key;
            input.style.cssText = "width:100%; background:#333; color:white; border:1px solid #555; padding:5px; box-sizing:border-box;";
            const handleInput = (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyConstraintOffsetInput(ids, key, value);
            };
            input.oninput = handleInput;
            input.onchange = handleInput;
            wrap.appendChild(l);
            wrap.appendChild(input);
            return wrap;
        };

        offsetRow.appendChild(makeOffsetInput('offsetX', 'Offset X'));
        offsetRow.appendChild(makeOffsetInput('offsetY', 'Offset Y'));
        sec.appendChild(offsetRow);

        const lineSection = document.createElement('div');
        lineSection.style.cssText = "margin-top:12px; padding:10px; background:rgba(255,255,255,0.04); border:1px solid #444; border-radius:4px;";
        const lineTitle = document.createElement('div');
        lineTitle.textContent = "Posición respecto a línea";
        lineTitle.style.cssText = "color:#ddd; font-size:12px; font-weight:bold; margin-bottom:8px;";
        lineSection.appendChild(lineTitle);

        const makeRelativeInput = (axis, offsetKey, label) => {
            const data = metrics?.[axis];
            const wrap = document.createElement('div');
            wrap.style.cssText = "display:grid; grid-template-columns:1fr 72px; gap:8px; align-items:end; margin-bottom:8px;";

            const info = document.createElement('div');
            info.style.cssText = "color:#aaa; font-size:11px; line-height:1.35;";
            info.dataset.constraintInfo = axis;
            info.textContent = data
                ? `${label}: punto ${data.point}px / línea ${data.line}px`
                : `${label}: eje libre`;

            const input = document.createElement('input');
            input.type = "number";
            input.disabled = !data;
            input.value = data ? data.relative : 0;
            input.dataset.constraintRelative = axis;
            input.style.cssText = "width:100%; background:#333; color:white; border:1px solid #555; padding:5px; box-sizing:border-box;";
            const handleInput = (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyConstraintOffsetInput(ids, offsetKey, value);
            };
            input.oninput = handleInput;
            input.onchange = handleInput;

            wrap.appendChild(info);
            wrap.appendChild(input);
            return wrap;
        };

        lineSection.appendChild(makeRelativeInput('x', 'offsetX', 'X'));
        lineSection.appendChild(makeRelativeInput('y', 'offsetY', 'Y'));

        const childInfo = document.createElement('div');
        childInfo.style.cssText = "color:#8fbf8f; font-size:11px; margin-top:4px; line-height:1.35;";
        childInfo.dataset.constraintChildren = 'true';
        childInfo.textContent = childIds.length > 0
            ? `Hijos relativos: ${childIds.join(', ')}`
            : "Hijos relativos: ninguno";
        lineSection.appendChild(childInfo);
        sec.appendChild(lineSection);

        const buttonGrid = document.createElement('div');
        buttonGrid.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;";

        const makeButton = (label, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = "padding:8px; background:#353535; color:#eee; border:1px solid #555; border-radius:4px; cursor:pointer; font-size:12px;";
            btn.onclick = onClick;
            return btn;
        };

        buttonGrid.appendChild(makeButton('Centro X', () => {
            this.setConstraintForIds(ids, { horizontal: 'center' }, { zeroOffsets: true });
            this.renderProperties();
        }));
        buttonGrid.appendChild(makeButton('Centro Y', () => {
            this.setConstraintForIds(ids, { vertical: 'center' }, { zeroOffsets: true });
            this.renderProperties();
        }));
        buttonGrid.appendChild(makeButton('Centro Total', () => {
            this.setConstraintForIds(ids, { horizontal: 'center', vertical: 'center' }, { zeroOffsets: true });
            this.renderProperties();
        }));
        buttonGrid.appendChild(makeButton('Liberar', () => {
            ids.forEach(id => {
                const c = this.getConstraint(id);
                c.horizontal = 'free';
                c.vertical = 'free';
                c.offsetX = 0;
                c.offsetY = 0;
            });
            this.cleanupConstraints();
            this.syncHudAnchorsFromPreview();
            this.updateConstraintGuides();
            this.renderProperties();
        }));

        sec.appendChild(buttonGrid);
        parent.appendChild(sec);
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
        const vKey = type === 'health' ? 'showHealth' : (type === 'jump' ? 'showJump' : (type === 'stamina' ? 'showStamina' : 'showInventory'));
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
        if (type === 'health' || type === 'jump' || type === 'stamina') {
            const prefix = type;

            // 1. Style
            const styleLabel = document.createElement('div');
            styleLabel.textContent = "Estilo:";
            styleLabel.style.color = "#aaa";
            styleLabel.style.marginBottom = "5px";
            styleLabel.style.fontSize = "12px";
            sec.appendChild(styleLabel);

            const styles = type === 'health' ? ['bar', 'hearts', 'text'] : ['bar', 'circle'];
            const styleTexts = type === 'health' ? ['Barra Clásica', 'Corazones', 'Texto Simple'] : (type === 'jump' ? ['Barra de Salto', 'Círculo de Salto'] : ['Barra de Estamina', 'Círculo de Estamina']);

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

    togglePreviewBackdrop() {
        this.previewBackdropEnabled = !this.previewBackdropEnabled;
        this.applyPreviewBackdrop();
        this.updateConstraintGuides();
    }

    applyPreviewBackdrop() {
        if (!this.previewContainer) return;

        this.previewContainer.style.background = this.previewBackdropEnabled
            ? '#ffffff'
            : 'transparent';

        if (this.container) {
            this.container.style.background = this.previewBackdropEnabled
                ? 'rgba(0,0,0,0.05)'
                : 'rgba(0,0,0,0.5)';
        }

        this.layoutSystem?.setGridTheme?.(this.previewBackdropEnabled ? 'light' : 'dark');

        if (this.previewBackdropButton) {
            this.previewBackdropButton.style.color = this.previewBackdropEnabled ? '#111' : '#aaa';
            this.previewBackdropButton.style.background = this.previewBackdropEnabled ? '#fff' : 'none';
            this.previewBackdropButton.style.border = this.previewBackdropEnabled ? '1px solid #4CAF50' : 'none';
            this.previewBackdropButton.title = this.previewBackdropEnabled
                ? 'Ocultar fondo blanco'
                : 'Mostrar fondo blanco';
        }
    }

    updatePreview() {
        if (!this.contentWrapper) {
            this.contentWrapper = document.createElement('div');
            this.contentWrapper.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";
            this.previewContainer.appendChild(this.contentWrapper);
        }

        this.contentWrapper.innerHTML = '';
        this.contentWrapper.style.zIndex = '10';
        this.layoutSystem.clearElements();

        const activeGroups = getActiveFarmingGroups(this.game);
        const layerOrder = [...(this.tempSettings.layerOrder || ['health', 'jump', 'stamina', 'inventory'])];
        activeGroups.forEach(g => {
            const id = "fz_" + g.groupId;
            if (!layerOrder.includes(id)) {
                layerOrder.push(id);
            }
        });
        // Append in reverse order (Bottom Layer first)
        // List: [Top, Middle, Bottom] -> Append: Bottom, Middle, Top
        for (let i = layerOrder.length - 1; i >= 0; i--) {
            const id = layerOrder[i];
            if (id === 'health' && this.tempSettings.showHealth) this.renderPreviewHealth();
            else if (id === 'jump' && this.tempSettings.showJump) this.renderPreviewJump();
            else if (id === 'stamina' && this.tempSettings.showStamina) this.renderPreviewStamina();
            else if (id === 'inventory' && this.tempSettings.showInventory) this.renderPreviewInventory();
            else if (id.startsWith("fz_")) {
                const gId = id.substring(3);
                const showKey = "show_fz_" + gId;
                if (this.tempSettings[showKey] !== false) {
                    this.renderPreviewFarmingCounter(gId);
                }
            }
        }

        const children = this.contentWrapper.children;
        if (children.length > 0) {
            animate(children, {
                opacity: [0, 1],
                delay: stagger(100),
                duration: 250,
                easing: 'easeOutQuad'
            });
        }

        this.applyPreviewLayerOrder(layerOrder);
        this.applyPreviewConstraints();
        this.applyPreviewAnchors();
        this.keepPreviewHUDInsideViewport();
        this.updateConstraintGuides();
        this.layoutSystem.scheduleRefresh();
    }

    applyPreviewLayerOrder(layerOrder) {
        const topBase = 100;
        layerOrder.forEach((id, index) => {
            const el = this.contentWrapper.querySelector(`[data-hud-id="${CSS.escape(id)}"]`);
            if (!el) return;
            el.style.zIndex = `${topBase + layerOrder.length - index}`;
        });
    }

    getHudPosKey(id) {
        if (id === 'health') return 'healthPos';
        if (id === 'jump') return 'jumpPos';
        if (id === 'stamina') return 'staminaPos';
        if (id === 'inventory') return 'inventoryPos';
        if (id.startsWith('fz_')) return `pos_fz_${id.substring(3)}`;
        return `${id}Pos`;
    }

    getHudElement(id) {
        if (!this.contentWrapper) return null;
        return this.contentWrapper.querySelector(`[data-hud-id="${CSS.escape(id)}"]`);
    }

    getRenderedHudIds() {
        if (!this.contentWrapper) return [];
        return Array.from(this.contentWrapper.querySelectorAll('[data-hud-id]'))
            .map(el => el.dataset.hudId)
            .filter(id => id && id !== 'inventory');
    }

    getAllRenderedHudIds() {
        if (!this.contentWrapper) return [];
        return Array.from(this.contentWrapper.querySelectorAll('[data-hud-id]'))
            .map(el => el.dataset.hudId)
            .filter(Boolean);
    }

    getResolvedLayerOrder() {
        const layerOrder = [...(this.tempSettings.layerOrder || ['health', 'jump', 'stamina', 'inventory'])];
        this.getRenderedHudIds().forEach(id => {
            if (!layerOrder.includes(id)) layerOrder.push(id);
        });
        if (!layerOrder.includes('inventory')) layerOrder.push('inventory');
        return layerOrder;
    }

    isAboveInventory(id) {
        return this.isAboveParent(id, 'inventory');
    }

    isAboveParent(childId, parentId) {
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

    setHudGlobalPosition(id, pos) {
        const key = this.getHudPosKey(id);
        this.tempSettings[key] = pos;
    }

    applyPreviewConstraints(ids = null) {
        const constraints = this.tempSettings.hudConstraints || {};
        const targetIds = ids || Object.keys(constraints);

        targetIds.forEach(id => {
            const constraint = constraints[id];
            if (!hasViewportConstraint(constraint)) return;

            const el = this.getHudElement(id);
            if (!el) return;

            applyViewportConstraint(el, this.previewContainer, constraint);
            el.dataset.hudConstraint = 'viewport';
        });
    }

    syncConstraintOffsetsFromPreview(ids = null) {
        const constraints = this.tempSettings.hudConstraints || {};
        const targetIds = ids || Object.keys(constraints);

        targetIds.forEach(id => {
            const constraint = constraints[id];
            const el = this.getHudElement(id);
            if (!el || !hasViewportConstraint(constraint)) return;

            const offsets = deriveViewportConstraintOffsets(this.previewContainer, el, constraint);
            constraint.offsetX = offsets.offsetX;
            constraint.offsetY = offsets.offsetY;
        });
    }

    updateConstraintGuides() {
        if (!this.constraintGuideLayer || !this.previewContainer) return;

        this.constraintGuideLayer.innerHTML = '';

        const selectedIds = this.getSelectedConstraintIds();
        const constraints = this.tempSettings.hudConstraints || {};
        const selectedWithConstraints = selectedIds.filter(id => hasViewportConstraint(constraints[id]));
        const showBaseGuides = this.selectedPropertyTab === 'constraints' || selectedWithConstraints.length > 0;
        if (!showBaseGuides) return;

        const rect = this.previewContainer.getBoundingClientRect();
        const addLine = (x1, y1, x2, y2, color = 'rgba(76, 175, 80, 0.78)', width = 1) => {
            const line = document.createElement('div');
            const isHorizontal = Math.abs(y1 - y2) < 1;
            if (isHorizontal) {
                line.style.cssText = `
                    position:absolute;
                    left:${Math.min(x1, x2)}px;
                    top:${y1}px;
                    width:${Math.abs(x2 - x1)}px;
                    height:0;
                    border-top:${width}px dashed ${color};
                `;
            } else {
                line.style.cssText = `
                    position:absolute;
                    left:${x1}px;
                    top:${Math.min(y1, y2)}px;
                    width:0;
                    height:${Math.abs(y2 - y1)}px;
                    border-left:${width}px dashed ${color};
                `;
            }
            this.constraintGuideLayer.appendChild(line);
        };

        const addGuideLabel = (text, x, y) => {
            const label = document.createElement('div');
            label.textContent = text;
            label.style.cssText = `
                position:absolute;
                left:${x}px;
                top:${y}px;
                transform:translate(-50%, -50%);
                color:rgba(255,255,255,0.82);
                background:rgba(30,30,30,0.78);
                border:1px solid rgba(76,175,80,0.45);
                border-radius:4px;
                padding:2px 6px;
                font-size:10px;
                font-family:sans-serif;
                white-space:nowrap;
            `;
            this.constraintGuideLayer.appendChild(label);
        };

        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const centerGuideColor = this.previewBackdropEnabled
            ? 'rgba(0,0,0,0.32)'
            : 'rgba(255,255,255,0.22)';
        addLine(cx, 0, cx, rect.height, centerGuideColor);
        addLine(0, cy, rect.width, cy, centerGuideColor);
        addGuideLabel('X Centro', cx, 16);
        addGuideLabel('Y Centro', 42, cy);

        selectedWithConstraints.forEach(id => {
            const el = this.getHudElement(id);
            const constraint = constraints[id];
            if (!el || !constraint) return;

            const elRect = el.getBoundingClientRect();
            const local = {
                left: elRect.left - rect.left,
                right: elRect.right - rect.left,
                top: elRect.top - rect.top,
                bottom: elRect.bottom - rect.top,
                centerX: elRect.left - rect.left + elRect.width / 2,
                centerY: elRect.top - rect.top + elRect.height / 2
            };

            if (constraint.horizontal && constraint.horizontal !== 'free') {
                const guideX = constraint.horizontal === 'center'
                    ? cx
                    : constraint.horizontal === 'right'
                        ? rect.width
                        : 0;
                const elementX = constraint.horizontal === 'center'
                    ? local.centerX
                    : constraint.horizontal === 'right'
                        ? local.right
                        : local.left;
                addLine(elementX, local.centerY, guideX, local.centerY);
            }

            if (constraint.vertical && constraint.vertical !== 'free') {
                const guideY = constraint.vertical === 'center'
                    ? cy
                    : constraint.vertical === 'bottom'
                        ? rect.height
                        : 0;
                const elementY = constraint.vertical === 'center'
                    ? local.centerY
                    : constraint.vertical === 'bottom'
                        ? local.bottom
                        : local.top;
                addLine(local.centerX, elementY, local.centerX, guideY);
            }
        });
    }

    keepPreviewElementInsideViewport(id) {
        const el = this.getHudElement(id);
        if (!el) return false;

        const moved = keepElementInsideContainer(el, this.previewContainer);
        if (moved) {
            this.setHudGlobalPosition(
                id,
                positionFromContainerRect(el.getBoundingClientRect(), this.previewContainer.getBoundingClientRect())
            );
        }
        return moved;
    }

    keepPreviewHUDInsideViewport() {
        const movedInventory = this.keepPreviewElementInsideViewport('inventory');
        if (movedInventory) this.applyPreviewAnchors();

        this.getRenderedHudIds().forEach(id => {
            this.keepPreviewElementInsideViewport(id);
        });
    }

    syncHudAnchorsFromPreview() {
        if (!this.contentWrapper) return;

        this.keepPreviewHUDInsideViewport();

        const containerRect = this.previewContainer.getBoundingClientRect();
        if (!this.tempSettings.hudAnchors) this.tempSettings.hudAnchors = {};
        const renderedIds = this.getAllRenderedHudIds();

        Object.keys(this.tempSettings.hudAnchors).forEach(id => {
            if (!renderedIds.includes(id)) delete this.tempSettings.hudAnchors[id];
        });

        renderedIds.forEach(id => {
            const el = this.getHudElement(id);
            if (!el) return;

            const childRect = el.getBoundingClientRect();
            const globalPos = positionFromContainerRect(childRect, containerRect);
            this.setHudGlobalPosition(id, globalPos);

            if (hasViewportConstraint(this.tempSettings.hudConstraints?.[id])) {
                delete this.tempSettings.hudAnchors[id];
                delete el.dataset.hudParent;
                return;
            }

            const parentId = this.findAnchorParentForElement(id, childRect, renderedIds);
            if (parentId) {
                const parentRect = this.getHudElement(parentId).getBoundingClientRect();
                this.tempSettings.hudAnchors[id] = {
                    parentId,
                    pos: positionFromRect(childRect, parentRect)
                };
            } else {
                delete this.tempSettings.hudAnchors[id];
                delete el.dataset.hudParent;
            }
        });

        if (Object.keys(this.tempSettings.hudAnchors).length === 0) {
            delete this.tempSettings.hudAnchors;
        }

        this.applyPreviewAnchors();
    }

    findAnchorParentForElement(childId, childRect, renderedIds) {
        let best = null;
        let bestZ = Number.NEGATIVE_INFINITY;

        renderedIds.forEach(parentId => {
            if (parentId === childId) return;
            const parent = this.getHudElement(parentId);
            if (!parent || !this.isAboveParent(childId, parentId)) return;

            const parentRect = parent.getBoundingClientRect();
            if (!rectsTouchOrOverlap(childRect, parentRect)) return;

            const parentZ = parseInt(parent.style.zIndex || getComputedStyle(parent).zIndex || '0', 10) || 0;
            if (parentZ > bestZ) {
                best = parentId;
                bestZ = parentZ;
            }
        });

        return best;
    }

    applyPreviewAnchors() {
        if (!this.contentWrapper) return;

        const anchors = this.tempSettings.hudAnchors || {};
        const anchorIds = new Set(Object.keys(anchors));
        this.getAllRenderedHudIds().forEach(id => {
            if (anchorIds.has(id)) return;
            const el = this.getHudElement(id);
            if (el) delete el.dataset.hudParent;
        });

        Object.entries(anchors).forEach(([id, anchor]) => {
            if (hasViewportConstraint(this.tempSettings.hudConstraints?.[id]) ||
                !anchor ||
                !anchor.parentId ||
                !anchor.pos ||
                !this.isAboveParent(id, anchor.parentId)) return;

            const el = this.getHudElement(id);
            const parentEl = this.getHudElement(anchor.parentId);
            if (!el) return;
            if (!parentEl) return;

            const resolved = resolveAnchoredPosition(this.previewContainer, parentEl, anchor.pos);
            if (!resolved) return;

            el.dataset.hudParent = anchor.parentId;
            el.style.left = resolved.left;
            el.style.top = resolved.top;
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none';
        });
    }

    renderPreviewHealth() {
        const el = document.createElement('div');
        el.dataset.hudId = 'health';
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
            const w = fitLength(this.tempSettings.healthWidth || 300, this.previewContainer, 'x', 2);
            const h = fitLength(this.tempSettings.healthHeight || 20, this.previewContainer, 'y', 1);

            // Bar Calculation
            // For vertical, we might swap w/h concept or just respect w/h as raw pixels
            // Usually "width" in UI means "Length of bar", but let's stick to raw CSS width/height for simplicity unless rotated.
            // Actually, if vertical, width usually becomes thickness and height becomes length.
            // But user has explicit Width/Height inputs. Let's just use them as CSS props.

            const isVert = this.tempSettings.healthOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';
            const border = h <= 4 || w <= 10 ? 0 : clamp(Math.floor(Math.min(w, h) / 8), 1, 2);
            const showText = this.tempSettings.healthShowText && w >= 44 && h >= 10;
            const fontSize = clamp(Math.round(Math.min(w, h) / 1.5), 6, 24);

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border: ${border}px solid #333; border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden; box-sizing:border-box;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #ff3333, #ff6666); clip-path: inset(${isVert ? '20% 0 0 0' : '0 20% 0 0'});"></div>
                    ${showText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${fontSize}px; font-weight:bold; text-shadow:1px 1px 1px black;">80 / 100</div>`
                    : ''}
                </div>
            `;
        } else if (this.tempSettings.healthStyle === 'hearts') {
            const fontSize = scaleHUDValue(24, this.previewContainer, 16, 24);
            el.innerHTML = `<span style="font-size:${fontSize}px; color:#ff3333;">❤❤❤❤</span><span style="font-size:${fontSize}px; color:#555;">♡</span>`;
        } else {
            const fontSize = scaleHUDValue(40, this.previewContainer, 22, 40);
            el.innerHTML = `<span style="font-size:${fontSize}px; font-weight:900; color:#ff3333; -webkit-text-stroke:1px white;">80</span>`;
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
        el.dataset.hudId = 'jump';
        el.style.cssText = `display: flex; align-items: center;`;

        if (this.tempSettings.jumpStyle === 'bar') {
            const w = fitLength(this.tempSettings.jumpWidth || 200, this.previewContainer, 'x', 2);
            const h = fitLength(this.tempSettings.jumpHeight || 8, this.previewContainer, 'y', 1);
            const isVert = this.tempSettings.jumpOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';
            const showText = this.tempSettings.jumpShowText && w >= 32 && h >= 8;
            const fontSize = clamp(Math.round(Math.min(w, h) / 1.5), 6, 18);

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden; box-sizing:border-box;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #00cfff, #0077ff); clip-path: inset(${isVert ? '30% 0 0 0' : '0 30% 0 0'});"></div>
                    ${showText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${fontSize}px; font-weight:bold; text-shadow:1px 1px 1px black;">80%</div>`
                    : ''}
                </div>
            `;
        } else if (this.tempSettings.jumpStyle === 'circle') {
            const size = scaleHUDValue(50, this.previewContainer, 34, 50);
            el.innerHTML = `<div style="width:${size}px; height:${size}px; border:3px solid #00cfff; border-radius:50%; position:relative;">
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

    renderPreviewStamina() {
        const el = document.createElement('div');
        el.dataset.hudId = 'stamina';
        el.style.cssText = `display: flex; align-items: center;`;

        // Orientation
        if (this.tempSettings.staminaOrientation === 'vertical') {
            el.style.flexDirection = 'column-reverse';
        } else {
            el.style.flexDirection = 'row';
        }

        if (this.tempSettings.staminaStyle === 'bar') {
            const w = fitLength(this.tempSettings.staminaWidth || 200, this.previewContainer, 'x', 2);
            const h = fitLength(this.tempSettings.staminaHeight || 8, this.previewContainer, 'y', 1);
            const isVert = this.tempSettings.staminaOrientation === 'vertical';
            const fillDir = isVert ? 'to top' : '90deg';
            const showText = this.tempSettings.staminaShowText && w >= 32 && h >= 8;
            const fontSize = clamp(Math.round(Math.min(w, h) / 1.5), 6, 18);

            el.innerHTML = `
                <div style="width: ${w}px; height: ${h}px; background: rgba(0,0,0,0.7); border-radius: ${Math.min(w, h) / 2}px; position:relative; overflow:hidden; box-sizing:border-box;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(${fillDir}, #ffcc00, #ff8800); clip-path: inset(${isVert ? '30% 0 0 0' : '0 30% 0 0'});"></div>
                    ${showText ?
                    `<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:${fontSize}px; font-weight:bold; text-shadow:1px 1px 1px black;">80%</div>`
                    : ''}
                </div>
            `;
        } else if (this.tempSettings.staminaStyle === 'circle') {
            const size = scaleHUDValue(50, this.previewContainer, 34, 50);
            el.innerHTML = `<div style="width:${size}px; height:${size}px; border:3px solid #ffcc00; border-radius:50%; position:relative;">
                <div style="position:absolute; bottom:0; left:0; width:100%; height:60%; background:#ffcc00; border-radius:0 0 50% 50%;"></div>
            </div>`;
        }

        this.contentWrapper.appendChild(el);

        if (this.tempSettings.staminaStyle === 'bar') {
            this.makeResizable(el, 'stamina');
        }

        this.layoutSystem.registerElement(el, 'stamina', this.tempSettings.staminaPos, (newPos) => {
            this.tempSettings.staminaPos = newPos;
        });
    }

    renderPreviewInventory() {
        const el = document.createElement('div');
        el.dataset.hudId = 'inventory';
        el.className = "inventory-container-preview";

        const padding = this.tempSettings.inventoryPadding !== undefined ? this.tempSettings.inventoryPadding : 10;
        let width = this.tempSettings.inventoryContainerWidth;
        let height = this.tempSettings.inventoryContainerHeight;
        const isFree = this.tempSettings.inventoryFreeLayout;
        const slots = this.tempSettings.inventorySlots || 9;
        const metrics = getViewportMetrics(this.previewContainer);
        const scaledPadding = scaleHUDValue(padding, this.previewContainer, 4, 24);
        let size = scaleHUDValue(this.tempSettings.inventorySlotSize || 50, this.previewContainer, 28, 100);
        const availableWidth = Math.max(80, metrics.width - metrics.edge * 2);
        const availableHeight = Math.max(80, metrics.height - metrics.edge * 2);

        if (!isFree) {
            const fittedSlot = Math.floor((availableWidth - scaledPadding * 2 - Math.max(0, slots - 1) * scaledPadding) / slots);
            size = clamp(size, 24, Math.max(24, fittedSlot));
        }

        const scaledWidth = Math.min(scaleHUDValue(width || 300, this.previewContainer, 60), availableWidth);
        const scaledHeight = Math.min(scaleHUDValue(height || 100, this.previewContainer, 50), availableHeight);
        const autoWidth = Math.min(slots * size + Math.max(0, slots - 1) * scaledPadding + scaledPadding * 2, availableWidth);
        const autoHeight = size + scaledPadding * 2;
        let cssWidth = width ? `${scaledWidth}px` : `${autoWidth}px`;
        let cssHeight = height
            ? `${Math.min(Math.max(scaledHeight, autoHeight), availableHeight)}px`
            : `${Math.min(autoHeight, availableHeight)}px`;

        el.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            padding: ${scaledPadding}px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            width: ${cssWidth};
            height: ${cssHeight};
            position: relative;
            box-sizing: border-box;
        `;

        if (isFree) {
            el.style.display = 'block';
            if (!width) width = 300;
            if (!height) height = 100;
            el.style.width = scaledWidth + 'px';
            el.style.height = scaledHeight + 'px';
        } else {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = `repeat(auto-fit, minmax(${size}px, ${size}px))`;
            el.style.gridAutoRows = `${size}px`;
            el.style.gap = `${scaledPadding}px`;

            const align = this.tempSettings.inventorySlotAlignment || 'center';
            const alignMap = {
                'top-left': ['start', 'start'],
                'top-center': ['center', 'start'],
                'top-right': ['end', 'start'],
                'center-left': ['start', 'center'],
                'center': ['center', 'center'],
                'center-right': ['end', 'center'],
                'bottom-left': ['start', 'end'],
                'bottom-center': ['center', 'end'],
                'bottom-right': ['end', 'end']
            };

            const [justify, alignContent] = alignMap[align] || ['center', 'center'];
            el.style.justifyContent = justify;
            el.style.alignContent = alignContent;
            el.style.justifyItems = 'center';
            el.style.alignItems = 'center';

            requestAnimationFrame(() => {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                    if (this.uiInputs['inventoryContainerWidth']) this.uiInputs['inventoryContainerWidth'].value = el.offsetWidth;
                    if (this.uiInputs['inventoryContainerHeight']) this.uiInputs['inventoryContainerHeight'].value = el.offsetHeight;
                }
            });
        }

        if (!this.tempSettings.inventorySlotPositions) this.tempSettings.inventorySlotPositions = [];

        for (let i = 0; i < this.tempSettings.inventorySlots; i++) {
            const slot = document.createElement('div');
            slot.className = `inventory-slot ${i === 0 ? 'active' : ''}`;
            slot.style.width = size + 'px';
            slot.style.height = size + 'px';
            slot.style.display = 'flex';
            slot.style.alignItems = 'center';
            slot.style.justifyContent = 'center';
            slot.style.backgroundColor = 'rgba(0,0,0,0.3)';
            slot.style.border = '1px solid #444';
            slot.style.borderRadius = '8px';
            slot.style.boxSizing = 'border-box';
            slot.style.userSelect = 'none';

            if (isFree) {
                slot.style.position = 'absolute';
                let pos = this.tempSettings.inventorySlotPositions[i];
                if (!pos) {
                    const cols = Math.max(1, Math.floor((scaledWidth - scaledPadding * 2) / (size + scaledPadding)));
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    pos = {
                        left: (padding + col * ((this.tempSettings.inventorySlotSize || 50) + padding)) + 'px',
                        top: (padding + row * ((this.tempSettings.inventorySlotSize || 50) + padding)) + 'px'
                    };
                    this.tempSettings.inventorySlotPositions[i] = pos;
                }
                const scaledPos = scalePixelPosition(pos, metrics.scale);
                slot.style.left = scaledPos.left;
                slot.style.top = scaledPos.top;
                this.makeSlotDraggable(slot, el, i);
            } else {
                slot.style.position = 'relative';
            }

            slot.innerHTML = `
                <span class="slot-number" style="font-size: ${Math.max(10, size / 5)}px; position:absolute; top:2px; left:5px; color:rgba(255,255,255,0.7);">${i + 1}</span>
                ${i < 2 ? `<div style="width:70%; height:70%; background:rgba(255,255,255,0.2); border-radius:4px;"></div>` : ''}
            `;
            el.appendChild(slot);
        }

        this.contentWrapper.appendChild(el);

        this.makeResizable(el, 'inventoryContainer');

        this.layoutSystem.registerElement(el, 'inventory', this.tempSettings.inventoryPos, (newPos) => {
            this.tempSettings.inventoryPos = newPos;
        });
    }

    makeSlotDraggable(slot, container, index) {
        slot.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = slot.getBoundingClientRect();
            const parentRect = container.getBoundingClientRect();
            const offsetX = startX - rect.left;
            const offsetY = startY - rect.top;
            const scale = getViewportMetrics(this.previewContainer).scale || 1;

            const onMouseMove = (ev) => {
                const x = ev.clientX - parentRect.left - offsetX;
                const y = ev.clientY - parentRect.top - offsetY;
                const maxW = parentRect.width - slot.offsetWidth;
                const maxH = parentRect.height - slot.offsetHeight;
                const clampedX = Math.max(0, Math.min(x, maxW));
                const clampedY = Math.max(0, Math.min(y, maxH));

                slot.style.left = clampedX + 'px';
                slot.style.top = clampedY + 'px';
                this.tempSettings.inventorySlotPositions[index] = {
                    left: Math.round(clampedX / scale) + 'px',
                    top: Math.round(clampedY / scale) + 'px'
                };
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    // --- Resize / Drag Helpers ---

    makeResizable(el, prefix) {
        const handle = document.createElement('div');
        handle.style.cssText = `
            position: absolute; bottom: 0; right: 0;
            width: 16px; height: 16px;
            background: white; border: 1px solid #333;
            cursor: nwse-resize; z-index: 10;
            pointer-events: auto; touch-action: none;
            clip-path: polygon(100% 0, 100% 100%, 0 100%);
        `;
        el.appendChild(handle);

        handle.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const scale = getViewportMetrics(this.previewContainer).scale || 1;

            let startW, startH;
            if (prefix === 'inventoryContainer') {
                startW = this.tempSettings.inventoryContainerWidth || el.offsetWidth;
                startH = this.tempSettings.inventoryContainerHeight || el.offsetHeight;
            } else {
                startW = this.tempSettings[prefix + 'Width'] || el.offsetWidth || 300;
                startH = this.tempSettings[prefix + 'Height'] || el.offsetHeight || 20;
            }

            const onMouseMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                if (prefix === 'inventoryContainer') {
                    let newW = startW + dx / scale;
                    let newH = startH + dy / scale;
                    if (newW < 50) newW = 50;
                    if (newH < 50) newH = 50;

                    this.tempSettings.inventoryContainerWidth = newW;
                    this.tempSettings.inventoryContainerHeight = newH;

                    el.style.width = fitLength(newW, this.previewContainer, 'x', 50) + 'px';
                    el.style.height = fitLength(newH, this.previewContainer, 'y', 50) + 'px';

                    if (this.uiInputs['inventoryContainerWidth']) this.uiInputs['inventoryContainerWidth'].value = Math.round(newW);
                    if (this.uiInputs['inventoryContainerHeight']) this.uiInputs['inventoryContainerHeight'].value = Math.round(newH);

                    if (this.keepPreviewElementInsideViewport('inventory')) {
                        this.applyPreviewAnchors();
                    }
                    this.applyPreviewConstraints(['inventory']);
                    this.updateConstraintGuides();
                } else {
                    let newW = startW + dx / scale;
                    let newH = startH + dy / scale;
                    if (newW < 5) newW = 5;
                    if (newH < 5) newH = 5;

                    this.tempSettings[prefix + 'Width'] = newW;
                    this.tempSettings[prefix + 'Height'] = newH;

                    if (this.uiInputs[prefix + 'Width']) this.uiInputs[prefix + 'Width'].value = Math.round(newW);
                    if (this.uiInputs[prefix + 'Height']) this.uiInputs[prefix + 'Height'].value = Math.round(newH);

                    const inner = el.firstElementChild;
                    if (inner) {
                        const visualW = fitLength(newW, this.previewContainer, 'x', 2);
                        const visualH = fitLength(newH, this.previewContainer, 'y', 1);
                        inner.style.width = visualW + 'px';
                        inner.style.height = visualH + 'px';
                        inner.style.borderRadius = (Math.min(visualW, visualH) / 2) + 'px';
                    }

                    this.keepPreviewElementInsideViewport(prefix);
                    this.applyPreviewConstraints([prefix]);
                    this.updateConstraintGuides();
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.keepPreviewHUDInsideViewport();
                this.applyPreviewConstraints();
                this.syncConstraintOffsetsFromPreview();
                this.syncHudAnchorsFromPreview();
                this.updatePreview();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    // --- Save / Close ---

    save() {
        this.syncConstraintOffsetsFromPreview();
        this.cleanupConstraints();
        this.syncHudAnchorsFromPreview();

        // Apply settings to profile
        this.profile.hudSettings = this.tempSettings;

        // Save in manager if any
        if (this.manager && this.manager.updateProfile) {
            this.manager.updateProfile(this.profile.id, { hudSettings: this.tempSettings });
        }

        this.close();
    }

    close() {
        if (this.onViewportResize) {
            window.removeEventListener('resize', this.onViewportResize);
            window.visualViewport?.removeEventListener('resize', this.onViewportResize);
        }

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

    renderFarmingZoneGroupProperties(parent, groupId) {
        const sec = document.createElement('div');
        sec.style.marginBottom = "20px";

        const h3 = document.createElement('h3');
        h3.textContent = `Contador Farmeo: ${groupId}`;
        h3.style.cssText = "color: #ddd; border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px; font-size:14px;";
        sec.appendChild(h3);

        // Visibility Checkbox
        const visRow = document.createElement('div');
        visRow.style.cssText = "margin-bottom: 10px; display: flex; align-items: center; gap: 10px;";

        const visCheck = document.createElement('input');
        visCheck.type = "checkbox";
        const vKey = "show_fz_" + groupId;
        if (this.tempSettings[vKey] === undefined) this.tempSettings[vKey] = true;
        visCheck.checked = this.tempSettings[vKey];
        visCheck.onchange = (e) => {
            this.tempSettings[vKey] = e.target.checked;
            this.updatePreview();
            this.renderSidebar(); // Sync with Sidebar
        };

        const visLabel = document.createElement('label');
        visLabel.textContent = "Mostrar en HUD";
        visLabel.style.color = "#aaa";

        visRow.appendChild(visCheck);
        visRow.appendChild(visLabel);
        sec.appendChild(visRow);

        // Description
        const desc = document.createElement('div');
        desc.textContent = "Este elemento muestra la cantidad de items recolectados por las zonas de farmeo conectadas a este grupo. Puedes arrastrar el contador en la pantalla para cambiar su posición.";
        desc.style.cssText = "font-size:12px; color:#888; line-height:1.4; margin-top:10px;";
        sec.appendChild(desc);

        parent.appendChild(sec);
    }

    renderPreviewFarmingCounter(groupId) {
        const activeGroups = getActiveFarmingGroups(this.game);
        const group = activeGroups.find(g => g.groupId === groupId) || { itemTexture: "/assets/textures/fuego.png", itemValue: 1 };
        const metrics = getViewportMetrics(this.previewContainer);
        const fontSize = scaleHUDValue(20, this.previewContainer, 14, 20);
        const iconSize = scaleHUDValue(24, this.previewContainer, 18, 24);
        const padY = scaleHUDValue(8, this.previewContainer, 5, 8);
        const padX = scaleHUDValue(16, this.previewContainer, 9, 16);

        const el = document.createElement('div');
        el.id = `fz-counter-preview-${groupId}`;
        el.dataset.hudId = `fz_${groupId}`;
        el.style.cssText = `
            display: flex; gap: 8px; align-items: center;
            background: rgba(30, 30, 30, 0.65);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: ${padY}px ${padX}px;
            color: #ff4500;
            font-family: sans-serif;
            font-size: ${fontSize}px;
            font-weight: bold;
            pointer-events: auto;
            user-select: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        el.innerHTML = `
            <img src="${group.itemTexture}" style="width: ${iconSize}px; height: ${iconSize}px; object-fit: contain;">
            <span>42</span>
        `;

        this.contentWrapper.appendChild(el);

        const posKey = "pos_fz_" + groupId;
        let initialPos = this.tempSettings[posKey];
        if (!initialPos) {
            // Stagger default position to prevent overlapping
            const idx = activeGroups.findIndex(g => g.groupId === groupId);
            const topOffset = metrics.edge + (idx >= 0 ? idx : 0) * scaleHUDValue(55, this.previewContainer, 36, 55);
            initialPos = { top: `${topOffset}px`, left: "50%", transform: "translateX(-50%)" };
            this.tempSettings[posKey] = initialPos;
        }

        this.layoutSystem.registerElement(el, `fz_${groupId}`, initialPos, (newPos) => {
            this.tempSettings[posKey] = newPos;
        });
    }
}

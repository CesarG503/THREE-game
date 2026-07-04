// @ts-nocheck
import { normalizeTextureSettings } from "../utils/TextureMapping";
import { listAssets } from "../platform/api";

export class MapShapeEditor {
    constructor(game, constructionMenu) {
        this.game = game;
        this.constructionMenu = constructionMenu;
        this.isVisible = false;
        
        this.zoom = 2; // Pixels per meter
        this.offsetX = 0;
        this.offsetZ = 0;
        this.isDragging = false;
        this.isDrawing = false;
        this.drawMode = true; 
        this.lastMouse = { x: 0, y: 0 };
        
        this.cellSize = 10; // Meters per cell

        this.config = {
            shapeType: "rect",
            mapSizeX: 100,
            mapSizeZ: 100,
            customGrid: [],
            customCellSize: 10,
            groundTexturePath: null,
            groundTextureAssetId: null,
            groundTextureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false },
            groundGroups: [],
            customGridGroups: {}
        };

        this.customTextureAssets = [];
        this.activeGroupId = "default";
        this.selectedGroupIdForEditing = "default";

        this.selectionBox = null; // { startX, startZ, endX, endZ, mode }
        this.useAreaSelection = false;

        this.initUI();
    }

    initUI() {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); display: none; flex-direction: column;
            z-index: 10000; align-items: center; justify-content: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: 80%; height: 85%; background: #222; border: 1px solid #444;
            border-radius: 8px; display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        // Top Bar
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            padding: 15px; background: #1a1a1a; border-bottom: 1px solid #333;
            display: flex; justify-content: space-between; align-items: center;
        `;
        const title = document.createElement('h2');
        title.textContent = "Editor de Forma del Mapa";
        title.style.cssText = `color: white; margin: 0; font-size: 20px;`;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = "✖";
        closeBtn.style.cssText = `
            background: none; border: none; color: white; font-size: 20px; cursor: pointer;
        `;
        closeBtn.onclick = () => this.close();

        topBar.appendChild(title);
        topBar.appendChild(closeBtn);
        panel.appendChild(topBar);

        // Main Area
        const mainArea = document.createElement('div');
        mainArea.style.cssText = `display: flex; flex: 1; overflow: hidden;`;

        // Canvas Area
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            flex: 1; background: #111; position: relative; overflow: hidden; cursor: crosshair;
        `;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        canvasContainer.appendChild(this.canvas);

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 300px; background: #1a1a1a; border-left: 1px solid #333; padding: 20px;
            display: flex; flex-direction: column; gap: 20px; overflow-y: auto; color: white;
        `;

        this.buildSidebar(sidebar);

        mainArea.appendChild(canvasContainer);
        mainArea.appendChild(sidebar);
        panel.appendChild(mainArea);
        this.container.appendChild(panel);
        document.body.appendChild(this.container);

        this.setupCanvasEvents(canvasContainer);
    }

    buildSidebar(sidebar) {
        // Shape Type
        const shapeGroup = document.createElement('div');
        shapeGroup.style.cssText = `display: flex; flex-direction: column; gap: 10px;`;
        shapeGroup.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Forma Base</label>`;
        
        const shapeSelect = document.createElement('select');
        shapeSelect.style.cssText = `padding: 10px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`;
        shapeSelect.innerHTML = `
            <option value="rect">Rectángulo Clásico</option>
            <option value="circle">Círculo</option>
            <option value="custom">Forma Personalizada (Pintar)</option>
        `;
        shapeSelect.onchange = (e) => {
            this.config.shapeType = e.target.value;
            this.updateVisibility();
            this.draw();
        };
        this.shapeSelect = shapeSelect;
        shapeGroup.appendChild(shapeSelect);
        sidebar.appendChild(shapeGroup);

        // Dimensions Group
        const dimGroup = document.createElement('div');
        this.dimGroup = dimGroup;
        dimGroup.style.cssText = `display: flex; flex-direction: column; gap: 10px;`;
        dimGroup.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Dimensiones Globales</label>`;
        
        const createInput = (label, id) => {
            const row = document.createElement('div');
            row.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
            row.innerHTML = `<span>${label}</span> <input id="${id}" type="number" step="10" min="10" style="width: 80px; padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; text-align: center;">`;
            return row;
        };

        dimGroup.appendChild(createInput("Ancho (X):", "mse-size-x"));
        dimGroup.appendChild(createInput("Largo (Z):", "mse-size-z"));
        sidebar.appendChild(dimGroup);

        // Instructions for Custom Mode
        const customInfo = document.createElement('div');
        this.customInfo = customInfo;
        customInfo.style.cssText = `background: #2a2a2a; padding: 15px; border-radius: 8px; font-size: 13px; color: #ccc; display: none; flex-direction: column; gap: 10px;`;
        
        const rowCell = document.createElement('div');
        rowCell.style.cssText = `display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px;`;
        rowCell.innerHTML = `<span>Tamaño de Bloque:</span> <input id="mse-cell-size" type="number" step="1" min="1" max="100" style="width: 60px; padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; text-align: center;">`;
        customInfo.appendChild(rowCell);

        const rowSel = document.createElement('div');
        rowSel.style.cssText = `display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px; cursor: pointer;`;
        const checkSel = document.createElement('input');
        checkSel.type = 'checkbox';
        checkSel.id = 'mse-area-select';
        checkSel.style.transform = 'scale(1.3)';
        checkSel.onchange = (e) => { this.useAreaSelection = e.target.checked; };
        
        const labelSel = document.createElement('label');
        labelSel.textContent = "Selección por Área (Arrastrar)";
        labelSel.htmlFor = 'mse-area-select';
        labelSel.style.cursor = 'pointer';
        
        rowSel.appendChild(labelSel);
        rowSel.appendChild(checkSel);
        customInfo.appendChild(rowSel);

        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <b>Controles:</b><br><br>
            • Click Izquierdo: Pintar<br>
            • Click Derecho: Borrar<br>
            • Rueda del Ratón: Zoom<br>
            • Click Medio + Arrastrar: Mover cámara
        `;
        customInfo.appendChild(instructions);
        sidebar.appendChild(customInfo);

        // Ground Groups list section (only visible in custom mode)
        const groupsSection = document.createElement('div');
        this.groupsSection = groupsSection;
        groupsSection.style.cssText = `display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #333; padding-top: 15px;`;
        
        const groupsHeader = document.createElement('div');
        groupsHeader.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
        groupsHeader.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Grupos de Suelo</label>`;
        
        const addGroupBtn = document.createElement('button');
        addGroupBtn.textContent = "+ Añadir";
        addGroupBtn.style.cssText = `
            padding: 3px 8px; background: #008CBA; color: white; border: none; border-radius: 4px;
            font-size: 11px; cursor: pointer; font-weight: bold;
        `;
        addGroupBtn.onclick = () => this.addNewGroundGroup();
        groupsHeader.appendChild(addGroupBtn);
        groupsSection.appendChild(groupsHeader);

        const groupsContainer = document.createElement('div');
        groupsContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto;
            background: #111; padding: 6px; border-radius: 4px; border: 1px solid #333;
        `;
        this.groupsContainer = groupsContainer;
        groupsSection.appendChild(groupsContainer);
        sidebar.appendChild(groupsSection);

        // Group Properties Panel (Visible for currently selected group)
        const groupPropertiesSection = document.createElement('div');
        this.groupPropertiesSection = groupPropertiesSection;
        groupPropertiesSection.style.cssText = `display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #333; padding-top: 15px;`;
        sidebar.appendChild(groupPropertiesSection);

        // Apply Button
        const spacer = document.createElement('div');
        spacer.style.flex = "1";
        sidebar.appendChild(spacer);

        const applyBtn = document.createElement('button');
        applyBtn.textContent = "Aplicar Cambios";
        applyBtn.style.cssText = `
            padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px;
            font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s;
        `;
        applyBtn.onmouseover = () => applyBtn.style.background = "#45a049";
        applyBtn.onmouseout = () => applyBtn.style.background = "#4CAF50";
        applyBtn.onclick = () => this.applyAndClose();
        sidebar.appendChild(applyBtn);
    }

    setupCanvasEvents(container) {
        window.addEventListener('resize', () => {
            if (this.isVisible) this.resizeCanvas();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            if (e.deltaY < 0) {
                this.zoom *= zoomFactor;
            } else {
                this.zoom /= zoomFactor;
            }
            this.zoom = Math.max(0.5, Math.min(this.zoom, 10));
            this.draw();
        });

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                this.isDragging = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            } else if (this.config.shapeType === 'custom') {
                this.drawMode = e.button === 0; // left click = paint, right click = erase
                if (this.useAreaSelection) {
                    const worldCoords = this.getWorldCoords(e);
                    const gridCoords = this.getGridCoords(worldCoords);
                    this.selectionBox = {
                        startX: gridCoords.x, startZ: gridCoords.z,
                        endX: gridCoords.x, endZ: gridCoords.z,
                        mode: this.drawMode
                    };
                } else {
                    this.isDrawing = true;
                    this.handleGridInteraction(e);
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.offsetX += (e.clientX - this.lastMouse.x);
                this.offsetZ += (e.clientY - this.lastMouse.y);
                this.lastMouse = { x: e.clientX, y: e.clientY };
                this.draw();
            } else if (this.config.shapeType === 'custom') {
                if (this.useAreaSelection && this.selectionBox) {
                    const worldCoords = this.getWorldCoords(e);
                    const gridCoords = this.getGridCoords(worldCoords);
                    this.selectionBox.endX = gridCoords.x;
                    this.selectionBox.endZ = gridCoords.z;
                    this.draw();
                } else if (this.isDrawing) {
                    this.handleGridInteraction(e);
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isDrawing = false;
            
            if (this.selectionBox) {
                this.applySelectionBox();
                this.selectionBox = null;
                this.draw();
            }
        });
    }

    getWorldCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - this.canvas.width/2 - this.offsetX) / this.zoom;
        const worldZ = (mouseY - this.canvas.height/2 - this.offsetZ) / this.zoom;
        return { x: worldX, z: worldZ };
    }

    getGridCoords(worldCoords) {
        return {
            x: Math.floor(worldCoords.x / this.config.customCellSize),
            z: Math.floor(worldCoords.z / this.config.customCellSize)
        };
    }

    applySelectionBox() {
        const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
        const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
        const minZ = Math.min(this.selectionBox.startZ, this.selectionBox.endZ);
        const maxZ = Math.max(this.selectionBox.startZ, this.selectionBox.endZ);

        if (!this.config.customGridGroups) this.config.customGridGroups = {};

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                if (this.selectionBox.mode) {
                    if (!this.config.customGrid.includes(key)) {
                        this.config.customGrid.push(key);
                    }
                    this.config.customGridGroups[key] = this.activeGroupId;
                } else {
                    const idx = this.config.customGrid.indexOf(key);
                    if (idx > -1) {
                        this.config.customGrid.splice(idx, 1);
                    }
                    delete this.config.customGridGroups[key];
                }
            }
        }
    }

    handleGridInteraction(e) {
        const worldCoords = this.getWorldCoords(e);
        const gridCoords = this.getGridCoords(worldCoords);
        const key = `${gridCoords.x},${gridCoords.z}`;
        
        if (!this.config.customGridGroups) this.config.customGridGroups = {};

        if (this.drawMode) {
            let changed = false;
            if (!this.config.customGrid.includes(key)) {
                this.config.customGrid.push(key);
                changed = true;
            }
            if (this.config.customGridGroups[key] !== this.activeGroupId) {
                this.config.customGridGroups[key] = this.activeGroupId;
                changed = true;
            }
            if (changed) {
                this.draw();
            }
        } else {
            const idx = this.config.customGrid.indexOf(key);
            if (idx > -1) {
                this.config.customGrid.splice(idx, 1);
                delete this.config.customGridGroups[key];
                this.draw();
            }
        }
    }

    open() {
        this.isVisible = true;
        this.container.style.display = "flex";
        
        // Sync config from game
        const env = this.game.environmentConfig || {};
        this.config.shapeType = env.shapeType || "rect";
        this.config.mapSizeX = env.mapSizeX || 100;
        this.config.mapSizeZ = env.mapSizeZ || 100;
        this.config.customGrid = [...(env.customGrid || [])];
        this.config.customCellSize = env.customCellSize || 10;
        
        // Sync ground groups
        this.config.groundGroups = env.groundGroups ? JSON.parse(JSON.stringify(env.groundGroups)) : [
            {
                id: "default",
                name: "Suelo 1",
                color: "#FF9800",
                texturePath: env.groundTexturePath || null,
                textureAssetId: env.groundTextureAssetId || null,
                textureSettings: normalizeTextureSettings(env.groundTextureSettings || { tileSize: 5 })
            }
        ];
        
        this.config.customGridGroups = env.customGridGroups ? { ...env.customGridGroups } : {};

        // Force color on default group if missing
        const defaultG = this.config.groundGroups.find(g => g.id === "default");
        if (defaultG && !defaultG.color) {
            defaultG.color = "#FF9800";
        }

        // Backward compatibility: map existing cells
        this.config.customGrid.forEach(key => {
            if (!this.config.customGridGroups[key]) {
                this.config.customGridGroups[key] = "default";
            }
        });

        this.activeGroupId = "default";
        this.selectedGroupIdForEditing = "default";

        // Load custom textures uploaded by player
        this.customTextureAssets = [];
        this.loadCustomTextures();

        this.useAreaSelection = false;
        this.selectionBox = null;

        this.shapeSelect.value = this.config.shapeType;
        document.getElementById("mse-size-x").value = this.config.mapSizeX;
        document.getElementById("mse-size-z").value = this.config.mapSizeZ;
        document.getElementById("mse-cell-size").value = this.config.customCellSize;
        document.getElementById("mse-area-select").checked = this.useAreaSelection;

        // Reset view
        this.zoom = 4;
        this.offsetX = 0;
        this.offsetZ = 0;

        this.updateVisibility();
        this.resizeCanvas();
    }

    close() {
        this.isVisible = false;
        this.container.style.display = "none";
    }

    applyAndClose() {
        // Read dims
        this.config.mapSizeX = parseFloat(document.getElementById("mse-size-x").value) || 100;
        this.config.mapSizeZ = parseFloat(document.getElementById("mse-size-z").value) || 100;
        this.config.customCellSize = parseFloat(document.getElementById("mse-cell-size").value) || 10;

        // Ensure at least one grid block if custom
        if (this.config.shapeType === 'custom' && this.config.customGrid.length === 0) {
            this.config.customGrid.push("0,0");
            if (!this.config.customGridGroups) this.config.customGridGroups = {};
            this.config.customGridGroups["0,0"] = "default";
        }

        // Sync default group to root for backward compatibility
        const defaultGroup = this.config.groundGroups.find(g => g.id === "default") || this.config.groundGroups[0];
        if (defaultGroup) {
            this.config.groundTexturePath = defaultGroup.texturePath;
            this.config.groundTextureAssetId = defaultGroup.textureAssetId;
            this.config.groundTextureSettings = normalizeTextureSettings(defaultGroup.textureSettings);
        }

        const newConfig = {
            shapeType: this.config.shapeType,
            mapSizeX: this.config.mapSizeX,
            mapSizeZ: this.config.mapSizeZ,
            customGrid: this.config.customGrid,
            customCellSize: this.config.customCellSize,
            groundTexturePath: this.config.groundTexturePath,
            groundTextureAssetId: this.config.groundTextureAssetId,
            groundTextureSettings: normalizeTextureSettings(this.config.groundTextureSettings),
            groundGroups: this.config.groundGroups,
            customGridGroups: this.config.customGridGroups
        };

        this.game.updateEnvironmentConfig(newConfig);
        
        if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
            const mapJson = this.game.saveMap();
            this.game.networkManager.broadcastMapSync(mapJson);
        }

        // Refresh parent menu if needed
        if (this.constructionMenu.environmentConfigPanel) {
            this.constructionMenu.renderSettings(this.constructionMenu.environmentConfigPanel);
        }

        this.close();
    }

    addNewGroundGroup() {
        const id = "group_" + Date.now();
        const colors = ["#4CAF50", "#2196F3", "#9C27B0", "#E91E63", "#00BCD4", "#8BC34A", "#FFEB3B", "#FF5722", "#E040FB", "#00E676"];
        const color = colors[this.config.groundGroups.length % colors.length];
        const name = "Suelo " + (this.config.groundGroups.length + 1);
        
        const newGroup = {
            id,
            name,
            color,
            texturePath: null,
            textureAssetId: null,
            textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false }
        };

        this.config.groundGroups.push(newGroup);
        this.activeGroupId = id;
        this.selectedGroupIdForEditing = id;

        this.renderGroups();
        this.renderSelectedGroupSettings();
        this.draw();
    }

    deleteGroundGroup(groupId) {
        if (groupId === "default") return;

        this.config.groundGroups = this.config.groundGroups.filter(g => g.id !== groupId);

        // Reassign cells
        if (this.config.customGridGroups) {
            Object.keys(this.config.customGridGroups).forEach((key) => {
                if (this.config.customGridGroups[key] === groupId) {
                    this.config.customGridGroups[key] = "default";
                }
            });
        }

        if (this.activeGroupId === groupId) {
            this.activeGroupId = "default";
        }
        if (this.selectedGroupIdForEditing === groupId) {
            this.selectedGroupIdForEditing = "default";
        }

        this.renderGroups();
        this.renderSelectedGroupSettings();
        this.draw();
    }

    renderGroups() {
        if (!this.groupsContainer) return;
        this.groupsContainer.innerHTML = "";

        const groups = this.config.groundGroups || [];
        groups.forEach((group) => {
            const card = document.createElement('div');
            card.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 10px; background: ${this.activeGroupId === group.id ? '#2a2a2a' : '#1e1e1e'};
                border: 1px solid ${this.activeGroupId === group.id ? '#FF9800' : '#333'};
                border-radius: 4px; cursor: pointer; transition: background 0.2s;
            `;
            
            card.onclick = (e) => {
                if (e.target.classList.contains('mse-delete-group-btn')) return;
                this.activeGroupId = group.id;
                this.selectedGroupIdForEditing = group.id;
                this.renderGroups();
                this.renderSelectedGroupSettings();
            };

            const left = document.createElement('div');
            left.style.cssText = `display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;`;

            const colorIndicator = document.createElement('span');
            colorIndicator.style.cssText = `
                display: inline-block; width: 14px; height: 14px; border-radius: 3px;
                background-color: ${group.color}; flex-shrink: 0; border: 1px solid #555;
            `;
            left.appendChild(colorIndicator);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = group.name;
            nameSpan.style.cssText = `
                color: #fff; font-size: 13px; font-weight: ${this.activeGroupId === group.id ? 'bold' : 'normal'};
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `;
            left.appendChild(nameSpan);
            card.appendChild(left);

            const right = document.createElement('div');
            right.style.cssText = `display: flex; align-items: center; gap: 6px;`;

            if (this.activeGroupId === group.id) {
                const check = document.createElement('span');
                check.textContent = "✓";
                check.style.cssText = `color: #4CAF50; font-weight: bold; font-size: 13px;`;
                right.appendChild(check);
            }

            if (group.id !== "default") {
                const delBtn = document.createElement('button');
                delBtn.textContent = "✖";
                delBtn.className = "mse-delete-group-btn";
                delBtn.style.cssText = `
                    background: none; border: none; color: #f44336; cursor: pointer;
                    font-size: 12px; padding: 2px 4px; border-radius: 3px; transition: background 0.2s;
                `;
                delBtn.onmouseover = () => delBtn.style.background = "rgba(244,67,54,0.15)";
                delBtn.onmouseout = () => delBtn.style.background = "none";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteGroundGroup(group.id);
                };
                right.appendChild(delBtn);
            }

            card.appendChild(right);
            this.groupsContainer.appendChild(card);
        });
    }

    renderSelectedGroupSettings() {
        if (!this.groupPropertiesSection) return;
        this.groupPropertiesSection.innerHTML = "";

        const group = this.config.groundGroups.find(g => g.id === this.selectedGroupIdForEditing);
        if (!group) return;

        const sectionTitle = document.createElement('label');
        sectionTitle.style.cssText = `color:#aaa; font-size:14px; text-transform:uppercase; margin-bottom: 4px;`;
        sectionTitle.textContent = this.config.shapeType === 'custom' ? `Propiedades: ${group.name}` : "Suelo predeterminado";
        this.groupPropertiesSection.appendChild(sectionTitle);

        if (this.config.shapeType === 'custom') {
            const nameRow = document.createElement('div');
            nameRow.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;
            nameRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Nombre:</span>`;
            
            const nameInput = document.createElement('input');
            nameInput.type = "text";
            nameInput.value = group.name;
            nameInput.style.cssText = `padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`;
            nameInput.oninput = (e) => {
                group.name = e.target.value || "Suelo";
                this.renderGroups();
                sectionTitle.textContent = `Propiedades: ${group.name}`;
            };
            nameRow.appendChild(nameInput);
            this.groupPropertiesSection.appendChild(nameRow);

            const colorRow = document.createElement('div');
            colorRow.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
            colorRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color en Editor:</span>`;
            
            const colorInput = document.createElement('input');
            colorInput.type = "color";
            colorInput.value = group.color || "#FF9800";
            colorInput.style.cssText = `
                width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px;
                background: none; cursor: pointer; padding: 0;
            `;
            colorInput.oninput = (e) => {
                group.color = e.target.value;
                this.renderGroups();
                this.draw();
            };
            colorRow.appendChild(colorInput);
            this.groupPropertiesSection.appendChild(colorRow);
        }

        const textureSubGroup = document.createElement('div');
        textureSubGroup.style.cssText = `display: flex; flex-direction: column; gap: 8px; margin-top: 5px;`;
        
        const textureHeader = document.createElement('span');
        textureHeader.textContent = "Texturas Predeterminadas";
        textureHeader.style.cssText = `font-size:12px; color:#ccc;`;
        textureSubGroup.appendChild(textureHeader);

        const groundTextureGrid = document.createElement('div');
        groundTextureGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;`;
        
        const groundTextures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "/assets/textures/obj/brick.png" },
            { name: "Concreto", path: "/assets/textures/obj/concrete.png" },
            { name: "Madera", path: "/assets/textures/obj/wood.png" },
            { name: "Hierro", path: "/assets/textures/obj/hierro.png" }
        ];

        groundTextures.forEach((tex) => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "mse-ground-texture-btn";
            btn.title = tex.name;
            btn.dataset.texturePath = tex.path || "";
            btn.style.cssText = `
                aspect-ratio: 1; border: 1px solid #555; border-radius: 4px; cursor: pointer;
                background-color: ${tex.color || "transparent"};
                background-image: ${tex.path ? `url(${tex.path})` : "none"};
                background-size: cover; background-position: center;
            `;
            btn.onclick = () => {
                group.texturePath = tex.path;
                group.textureAssetId = null;
                this.syncSelectedGroupTextureButtons(group);
            };
            groundTextureGrid.appendChild(btn);
        });
        textureSubGroup.appendChild(groundTextureGrid);

        const customTextureHeader = document.createElement('span');
        customTextureHeader.textContent = "Tus Texturas Subidas";
        customTextureHeader.style.cssText = `font-size:12px; color:#ccc; margin-top: 8px;`;
        textureSubGroup.appendChild(customTextureHeader);

        const customTextureGrid = document.createElement('div');
        customTextureGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; min-height: 35px;`;
        this.customTextureGrid = customTextureGrid;

        const assets = this.customTextureAssets || [];
        if (assets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Sin texturas subidas.";
            empty.style.cssText = "grid-column: 1 / -1; color: #777; font-size: 11px; padding: 4px 0;";
            customTextureGrid.appendChild(empty);
        } else {
            assets.forEach((asset) => {
                const btn = document.createElement("div");
                btn.className = "mse-ground-texture-btn mse-custom-texture-btn";
                btn.title = asset.name;
                btn.dataset.texturePath = asset.fileUrl || "";
                btn.style.cssText = `
                    aspect-ratio: 1; border: 1px solid #555; border-radius: 4px; cursor: pointer;
                    background-image: url(${asset.fileUrl});
                    background-size: cover; background-position: center; image-rendering: pixelated;
                `;
                btn.onclick = () => {
                    group.texturePath = asset.fileUrl;
                    group.textureAssetId = asset.id;
                    this.syncSelectedGroupTextureButtons(group);
                };
                customTextureGrid.appendChild(btn);
            });
        }
        textureSubGroup.appendChild(customTextureGrid);
        this.groupPropertiesSection.appendChild(textureSubGroup);

        const groundModeRow = document.createElement('div');
        groundModeRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top: 5px;`;
        const groundModeLabel = document.createElement('span');
        groundModeLabel.textContent = "Modo";
        groundModeLabel.style.cssText = `font-size:12px; color:#ccc;`;
        this.groupFitModeSelect = document.createElement('select');
        this.groupFitModeSelect.style.cssText = `width: 135px; padding: 6px; background:#333; color:white; border:1px solid #555; border-radius:4px; font-size:12px;`;
        this.groupFitModeSelect.innerHTML = `
            <option value="auto">Repetir por tamaño</option>
            <option value="stretch">Estirar por pieza</option>
        `;
        this.groupFitModeSelect.onchange = (e) => this.updateSelectedGroupTextureSetting("fitMode", e.target.value);
        groundModeRow.appendChild(groundModeLabel);
        groundModeRow.appendChild(this.groupFitModeSelect);
        this.groupPropertiesSection.appendChild(groundModeRow);

        const groundSettingsGrid = document.createElement('div');
        groundSettingsGrid.style.cssText = `display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 5px;`;
        
        const makeGroundInput = (key, label, step, min = null) => {
            const wrap = document.createElement('label');
            wrap.style.cssText = `display:flex; flex-direction:column; gap:3px; font-size:11px; color:#aaa;`;
            const input = document.createElement('input');
            input.type = "number";
            input.step = String(step);
            if (min !== null) input.min = String(min);
            input.style.cssText = `width:100%; box-sizing:border-box; padding:5px; background:#333; color:white; border:1px solid #555; border-radius:4px; font-size:11px;`;
            input.onchange = (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) this.updateSelectedGroupTextureSetting(key, value);
            };
            wrap.textContent = label;
            wrap.appendChild(input);
            this[`groupTextureInput_${key}`] = input;
            return wrap;
        };

        groundSettingsGrid.appendChild(makeGroundInput("tileSize", "Baldosa", 0.25, 0.1));
        groundSettingsGrid.appendChild(makeGroundInput("repeatX", "Repetir U", 0.25, 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("repeatY", "Repetir V", 0.25, 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("rotation", "Rotación", 5));
        groundSettingsGrid.appendChild(makeGroundInput("offsetX", "Mover U", 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("offsetY", "Mover V", 0.05));
        this.groupPropertiesSection.appendChild(groundSettingsGrid);

        const groundPatternRow = document.createElement('label');
        groundPatternRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#ddd; cursor:pointer; margin-top: 5px;`;
        const groundPatternText = document.createElement('span');
        groundPatternText.textContent = "Variar patrón por bloque";
        const groundPatternInput = document.createElement('input');
        groundPatternInput.type = "checkbox";
        groundPatternInput.onchange = (e) => this.updateSelectedGroupTextureSetting("patternVariation", e.target.checked);
        this.groupTextureInput_patternVariation = groundPatternInput;
        groundPatternRow.appendChild(groundPatternText);
        groundPatternRow.appendChild(groundPatternInput);
        this.groupPropertiesSection.appendChild(groundPatternRow);

        this.syncSelectedGroupTextureControls();
    }

    syncSelectedGroupTextureButtons(group) {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll(".mse-ground-texture-btn");
        buttons.forEach((btn) => {
            const path = btn.dataset.texturePath || "";
            const selected = (group.texturePath || "") === path;
            btn.style.borderColor = selected ? "#00FF00" : "#555";
            btn.style.borderWidth = selected ? "2px" : "1px";
        });
    }

    syncSelectedGroupTextureControls() {
        const group = this.config.groundGroups.find(g => g.id === this.selectedGroupIdForEditing);
        if (!group) return;

        const settings = normalizeTextureSettings(group.textureSettings || { tileSize: 5 });
        group.textureSettings = settings;

        if (this.groupFitModeSelect) this.groupFitModeSelect.value = settings.fitMode;
        ["tileSize", "repeatX", "repeatY", "offsetX", "offsetY", "rotation"].forEach((key) => {
            const input = this[`groupTextureInput_${key}`];
            if (input) input.value = String(settings[key]);
        });
        if (this.groupTextureInput_patternVariation) {
            this.groupTextureInput_patternVariation.checked = settings.patternVariation;
        }
        this.syncSelectedGroupTextureButtons(group);
    }

    updateSelectedGroupTextureSetting(key, value) {
        const group = this.config.groundGroups.find(g => g.id === this.selectedGroupIdForEditing);
        if (!group) return;

        group.textureSettings = normalizeTextureSettings({
            ...(group.textureSettings || {}),
            [key]: value
        });
        this.syncSelectedGroupTextureControls();
    }

    async loadCustomTextures() {
        try {
            this.customTextureAssets = await listAssets("mine", "TEXTURE");
        } catch (err) {
            console.warn("No se pudieron cargar tus texturas", err);
            this.customTextureAssets = [];
        }
        this.renderSelectedGroupSettings();
    }

    hexToRgba(hex, opacity) {
        let c = hex.substring(1);
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    updateVisibility() {
        const isCustom = this.config.shapeType === 'custom';
        this.dimGroup.style.display = isCustom ? 'none' : 'flex';
        this.customInfo.style.display = isCustom ? 'flex' : 'none';
        this.groupsSection.style.display = isCustom ? 'flex' : 'none';

        if (!isCustom) {
            document.getElementById("mse-size-x").disabled = this.config.shapeType === 'circle';
            if (this.config.shapeType === 'circle') {
                document.getElementById("mse-size-z").disabled = true;
                document.getElementById("mse-size-z").value = document.getElementById("mse-size-x").value;
            } else {
                document.getElementById("mse-size-x").disabled = false;
                document.getElementById("mse-size-z").disabled = false;
            }
            this.selectedGroupIdForEditing = "default";
            this.activeGroupId = "default";
        }

        this.renderGroups();
        this.renderSelectedGroupSettings();
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        this.ctx.fillStyle = "#111";
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.save();
        this.ctx.translate(w/2 + this.offsetX, h/2 + this.offsetZ);
        this.ctx.scale(this.zoom, this.zoom);

        // Draw Origin Crosshair
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#444";
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.moveTo(-1000, 0); this.ctx.lineTo(1000, 0);
        this.ctx.moveTo(0, -1000); this.ctx.lineTo(0, 1000);
        this.ctx.stroke();

        // Draw current shape
        if (this.config.shapeType === "rect") {
            const sx = parseFloat(document.getElementById("mse-size-x")?.value || this.config.mapSizeX);
            const sz = parseFloat(document.getElementById("mse-size-z")?.value || this.config.mapSizeZ);
            
            this.ctx.fillStyle = "rgba(76, 175, 80, 0.4)";
            this.ctx.strokeStyle = "#4CAF50";
            this.ctx.lineWidth = 2 / this.zoom;
            this.ctx.fillRect(-sx/2, -sz/2, sx, sz);
            this.ctx.strokeRect(-sx/2, -sz/2, sx, sz);

            // Draw grid lines inside
            this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.beginPath();
            for (let x = -sx/2; x <= sx/2; x+=this.config.customCellSize) {
                this.ctx.moveTo(x, -sz/2); this.ctx.lineTo(x, sz/2);
            }
            for (let z = -sz/2; z <= sz/2; z+=this.config.customCellSize) {
                this.ctx.moveTo(-sx/2, z); this.ctx.lineTo(sx/2, z);
            }
            this.ctx.stroke();

        } else if (this.config.shapeType === "circle") {
            let diam = parseFloat(document.getElementById("mse-size-x")?.value || this.config.mapSizeX);
            const inputZ = document.getElementById("mse-size-z");
            if (inputZ && document.activeElement !== inputZ) inputZ.value = diam;
            
            const radius = diam / 2;
            
            this.ctx.fillStyle = "rgba(33, 150, 243, 0.4)";
            this.ctx.strokeStyle = "#2196F3";
            this.ctx.lineWidth = 2 / this.zoom;
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

        } else if (this.config.shapeType === "custom") {
            const cs = parseFloat(document.getElementById("mse-cell-size")?.value) || this.config.customCellSize || 10;
            this.config.customCellSize = cs; // sync

            // Draw background grid lightly
            const vW = w / this.zoom;
            const vH = h / this.zoom;
            const startX = Math.floor((-vW/2 - this.offsetX/this.zoom) / cs) * cs;
            const startZ = Math.floor((-vH/2 - this.offsetZ/this.zoom) / cs) * cs;
            
            this.ctx.strokeStyle = "rgba(255,255,255,0.05)";
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.beginPath();
            for (let x = startX; x < startX + vW + cs; x += cs) {
                this.ctx.moveTo(x, startZ); this.ctx.lineTo(x, startZ + vH + cs);
            }
            for (let z = startZ; z < startZ + vH + cs; z += cs) {
                this.ctx.moveTo(startX, z); this.ctx.lineTo(startX + vW + cs, z);
            }
            this.ctx.stroke();

            // Draw filled cells
            const customGridGroups = this.config.customGridGroups || {};
            const groundGroups = this.config.groundGroups || [];

            this.config.customGrid.forEach(key => {
                const [gx, gz] = key.split(',').map(Number);
                const x = gx * cs;
                const z = gz * cs;

                const groupId = customGridGroups[key] || "default";
                const group = groundGroups.find(g => g.id === groupId) || groundGroups[0] || { color: "#FF9800" };
                const baseColor = group.color || "#FF9800";
                
                this.ctx.fillStyle = this.hexToRgba(baseColor, 0.6);
                this.ctx.strokeStyle = baseColor;
                this.ctx.lineWidth = 2 / this.zoom;
                
                this.ctx.fillRect(x, z, cs, cs);
                this.ctx.strokeRect(x, z, cs, cs);
            });

            // Draw Selection Box preview
            if (this.selectionBox) {
                const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
                const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
                const minZ = Math.min(this.selectionBox.startZ, this.selectionBox.endZ);
                const maxZ = Math.max(this.selectionBox.startZ, this.selectionBox.endZ);

                const sX = minX * cs;
                const sZ = minZ * cs;
                const sW = (maxX - minX + 1) * cs;
                const sH = (maxZ - minZ + 1) * cs;

                if (this.selectionBox.mode) {
                    this.ctx.fillStyle = "rgba(76, 175, 80, 0.5)"; // Green for build
                    this.ctx.strokeStyle = "#4CAF50";
                } else {
                    this.ctx.fillStyle = "rgba(244, 67, 54, 0.5)"; // Red for erase
                    this.ctx.strokeStyle = "#F44336";
                }
                
                this.ctx.fillRect(sX, sZ, sW, sH);
                this.ctx.strokeRect(sX, sZ, sW, sH);
            }
        }

        this.ctx.restore();
    }
}

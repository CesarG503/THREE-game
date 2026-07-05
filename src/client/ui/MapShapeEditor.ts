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
            customGridGroups: {},
            customGridShapes: {}
        };

        this.customTextureAssets = [];
        this.activeGroupId = "default";
        this.selectedGroupIdForEditing = "default";
        this.activeCellShape = "full";

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
        // Tab Header
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = `
            display: flex; background: #111; border-radius: 6px; padding: 3px; margin-bottom: 5px;
        `;
        
        const tabFloor = document.createElement('button');
        tabFloor.textContent = "Suelo";
        tabFloor.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 4px; font-weight: bold; font-size: 13px; cursor: pointer; transition: all 0.2s;
        `;
        
        const tabWalls = document.createElement('button');
        tabWalls.textContent = "Paredes";
        tabWalls.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 4px; font-weight: bold; font-size: 13px; cursor: pointer; transition: all 0.2s;
        `;

        const tabCeiling = document.createElement('button');
        tabCeiling.textContent = "Techo";
        tabCeiling.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 4px; font-weight: bold; font-size: 13px; cursor: pointer; transition: all 0.2s;
        `;
        
        tabFloor.onclick = () => {
            this.activeTab = "floor";
            this.syncTabs();
            this.draw();
        };
        tabWalls.onclick = () => {
            this.activeTab = "walls";
            this.syncTabs();
            this.draw();
        };
        tabCeiling.onclick = () => {
            this.activeTab = "ceiling";
            this.syncTabs();
            this.draw();
        };
        
        tabContainer.appendChild(tabFloor);
        tabContainer.appendChild(tabWalls);
        tabContainer.appendChild(tabCeiling);
        sidebar.appendChild(tabContainer);
        
        this.tabFloorBtn = tabFloor;
        this.tabWallsBtn = tabWalls;
        this.tabCeilingBtn = tabCeiling;

        // Container for Floor Editor
        const floorEditorContent = document.createElement('div');
        this.floorEditorContent = floorEditorContent;
        floorEditorContent.style.cssText = "display: flex; flex-direction: column; gap: 20px; flex: 1;";

        // Container for Walls Editor
        const wallsEditorContent = document.createElement('div');
        this.wallsEditorContent = wallsEditorContent;
        wallsEditorContent.style.cssText = "display: none; flex-direction: column; gap: 20px; flex: 1;";

        // Container for Ceiling Editor
        const ceilingEditorContent = document.createElement('div');
        this.ceilingEditorContent = ceilingEditorContent;
        ceilingEditorContent.style.cssText = "display: none; flex-direction: column; gap: 20px; flex: 1;";

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
        floorEditorContent.appendChild(groupsSection);

        // Block Shape Selection Section (only visible in custom mode)
        const shapesSection = document.createElement('div');
        this.shapesSection = shapesSection;
        shapesSection.style.cssText = `display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #333; padding-top: 15px;`;
        shapesSection.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Forma del Suelo</label>`;

        const shapesGrid = document.createElement('div');
        shapesGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;`;
        
        const shapes = [
            { id: "full", char: "█", title: "Completo" },
            { id: "nw", char: "◤", title: "Diagonal Sup-Izq" },
            { id: "ne", char: "◥", title: "Diagonal Sup-Der" },
            { id: "se", char: "◢", title: "Diagonal Inf-Der" },
            { id: "sw", char: "◣", title: "Diagonal Inf-Izq" }
        ];

        shapes.forEach((sh) => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "mse-shape-select-btn";
            btn.title = sh.title;
            btn.dataset.shapeId = sh.id;
            btn.textContent = sh.char;
            btn.style.cssText = `
                aspect-ratio: 1; border: 1px solid #555; border-radius: 4px; cursor: pointer;
                background-color: #333; color: white; font-size: 16px; font-weight: bold;
                display: flex; align-items: center; justify-content: center; transition: all 0.2s;
            `;
            btn.onclick = () => {
                this.activeCellShape = sh.id;
                this.syncShapeButtons();
            };
            shapesGrid.appendChild(btn);
        });
        shapesSection.appendChild(shapesGrid);
        floorEditorContent.appendChild(shapesSection);

        // Group Properties Panel (Visible for currently selected group)
        const groupPropertiesSection = document.createElement('div');
        this.groupPropertiesSection = groupPropertiesSection;
        groupPropertiesSection.style.cssText = `display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #333; padding-top: 15px;`;
        floorEditorContent.appendChild(groupPropertiesSection);

        // Copy Groups Panel (Floor)
        this.createCopyPanel(floorEditorContent, "floor");

        // Walls Advanced Editor controls
        const wallGroupsSection = document.createElement('div');
        this.wallGroupsSection = wallGroupsSection;
        wallGroupsSection.style.cssText = `display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #333; padding-top: 15px;`;
        
        const wallGroupsHeader = document.createElement('div');
        wallGroupsHeader.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
        wallGroupsHeader.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Grupos de Pared</label>`;
        
        const addWallGroupBtn = document.createElement('button');
        addWallGroupBtn.textContent = "+ Añadir";
        addWallGroupBtn.style.cssText = `
            padding: 3px 8px; background: #008CBA; color: white; border: none; border-radius: 4px;
            font-size: 11px; cursor: pointer; font-weight: bold;
        `;
        addWallGroupBtn.onclick = () => this.addNewWallGroup();
        wallGroupsHeader.appendChild(addWallGroupBtn);
        wallGroupsSection.appendChild(wallGroupsHeader);

        const wallGroupsContainer = document.createElement('div');
        wallGroupsContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto;
            background: #111; padding: 6px; border-radius: 4px; border: 1px solid #333;
        `;
        this.wallGroupsContainer = wallGroupsContainer;
        wallGroupsSection.appendChild(wallGroupsContainer);
        wallsEditorContent.appendChild(wallGroupsSection);

        const wallPropertiesSection = document.createElement('div');
        this.wallPropertiesSection = wallPropertiesSection;
        wallPropertiesSection.style.cssText = `display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #333; padding-top: 15px;`;
        wallsEditorContent.appendChild(wallPropertiesSection);

        // Copy Groups Panel (Walls)
        this.createCopyPanel(wallsEditorContent, "walls");

        // Ceilings Editor Controls
        const ceilingShapesSection = document.createElement('div');
        this.ceilingShapesSection = ceilingShapesSection;
        ceilingShapesSection.style.cssText = `display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #333; padding-top: 15px;`;
        ceilingShapesSection.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Forma del Techo</label>`;

        const ceilingShapesGrid = document.createElement('div');
        ceilingShapesGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;`;
        
        const ceilingShapesList = [
            { id: "full", char: "█", title: "Completo" },
            { id: "nw", char: "◤", title: "Diagonal Sup-Izq" },
            { id: "ne", char: "◥", title: "Diagonal Sup-Der" },
            { id: "se", char: "◢", title: "Diagonal Inf-Der" },
            { id: "sw", char: "◣", title: "Diagonal Inf-Izq" }
        ];

        ceilingShapesList.forEach((sh) => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "mse-ceiling-shape-select-btn";
            btn.title = sh.title;
            btn.dataset.shapeId = sh.id;
            btn.textContent = sh.char;
            btn.style.cssText = `
                aspect-ratio: 1; border: 1px solid #555; border-radius: 4px; cursor: pointer;
                background-color: #333; color: white; font-size: 16px; font-weight: bold;
                display: flex; align-items: center; justify-content: center; transition: all 0.2s;
            `;
            btn.onclick = () => {
                this.activeCeilingShape = sh.id;
                this.syncCeilingShapeButtons();
            };
            ceilingShapesGrid.appendChild(btn);
        });
        ceilingShapesSection.appendChild(ceilingShapesGrid);
        ceilingEditorContent.appendChild(ceilingShapesSection);

        const ceilingGroupsSection = document.createElement('div');
        this.ceilingGroupsSection = ceilingGroupsSection;
        ceilingGroupsSection.style.cssText = `display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #333; padding-top: 15px;`;
        
        const ceilingGroupsHeader = document.createElement('div');
        ceilingGroupsHeader.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
        ceilingGroupsHeader.innerHTML = `<label style="color:#aaa; font-size:14px; text-transform:uppercase;">Grupos de Techo</label>`;
        
        const addCeilingGroupBtn = document.createElement('button');
        addCeilingGroupBtn.textContent = "+ Añadir";
        addCeilingGroupBtn.style.cssText = `
            padding: 3px 8px; background: #008CBA; color: white; border: none; border-radius: 4px;
            font-size: 11px; cursor: pointer; font-weight: bold;
        `;
        addCeilingGroupBtn.onclick = () => this.addNewCeilingGroup();
        ceilingGroupsHeader.appendChild(addCeilingGroupBtn);
        ceilingGroupsSection.appendChild(ceilingGroupsHeader);

        const ceilingGroupsContainer = document.createElement('div');
        ceilingGroupsContainer.style.cssText = `
            display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto;
            background: #111; padding: 6px; border-radius: 4px; border: 1px solid #333;
        `;
        this.ceilingGroupsContainer = ceilingGroupsContainer;
        ceilingGroupsSection.appendChild(ceilingGroupsContainer);
        ceilingEditorContent.appendChild(ceilingGroupsSection);

        const ceilingPropertiesSection = document.createElement('div');
        this.ceilingPropertiesSection = ceilingPropertiesSection;
        ceilingPropertiesSection.style.cssText = `display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #333; padding-top: 15px;`;
        ceilingEditorContent.appendChild(ceilingPropertiesSection);

        // Copy Groups Panel (Ceiling)
        this.createCopyPanel(ceilingEditorContent, "ceiling");

        // Append global sections to sidebar first
        sidebar.appendChild(shapeGroup);
        sidebar.appendChild(dimGroup);
        sidebar.appendChild(customInfo);

        // Append tab editors
        sidebar.appendChild(floorEditorContent);
        sidebar.appendChild(wallsEditorContent);
        sidebar.appendChild(ceilingEditorContent);

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
        if (!this.config.customGridShapes) this.config.customGridShapes = {};
        if (!this.config.customGridWallGroups) this.config.customGridWallGroups = {};
        if (!this.config.customGridCeilingGroups) this.config.customGridCeilingGroups = {};
        if (!this.config.customGridCeilingShapes) this.config.customGridCeilingShapes = {};

        if (this.activeTab === "walls") {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${z}`;
                    if (this.config.customGrid.includes(key)) {
                        if (this.selectionBox.mode) {
                            this.config.customGridWallGroups[key] = this.activeWallGroupId;
                        } else {
                            delete this.config.customGridWallGroups[key];
                        }
                    }
                }
            }
            return;
        }

        if (this.activeTab === "ceiling") {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${z}`;
                    if (this.selectionBox.mode) {
                        this.config.customGridCeilingGroups[key] = this.activeCeilingGroupId;
                        this.config.customGridCeilingShapes[key] = this.activeCeilingShape || "full";
                    } else {
                        delete this.config.customGridCeilingGroups[key];
                        delete this.config.customGridCeilingShapes[key];
                    }
                }
            }
            return;
        }

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                if (this.selectionBox.mode) {
                    if (!this.config.customGrid.includes(key)) {
                        this.config.customGrid.push(key);
                        // Auto-generate ceiling if not already present
                        if (!this.config.customGridCeilingGroups[key]) {
                            this.config.customGridCeilingGroups[key] = "default";
                            this.config.customGridCeilingShapes[key] = "full";
                        }
                    }
                    this.config.customGridGroups[key] = this.activeGroupId;
                    this.config.customGridShapes[key] = this.activeCellShape || "full";
                } else {
                    const idx = this.config.customGrid.indexOf(key);
                    if (idx > -1) {
                        this.config.customGrid.splice(idx, 1);
                    }
                    delete this.config.customGridGroups[key];
                    delete this.config.customGridShapes[key];
                }
            }
        }
    }

    handleGridInteraction(e) {
        const worldCoords = this.getWorldCoords(e);
        const gridCoords = this.getGridCoords(worldCoords);
        const key = `${gridCoords.x},${gridCoords.z}`;
        
        if (!this.config.customGridGroups) this.config.customGridGroups = {};
        if (!this.config.customGridShapes) this.config.customGridShapes = {};
        if (!this.config.customGridWallGroups) this.config.customGridWallGroups = {};
        if (!this.config.customGridCeilingGroups) this.config.customGridCeilingGroups = {};
        if (!this.config.customGridCeilingShapes) this.config.customGridCeilingShapes = {};

        if (this.activeTab === "walls") {
            if (this.config.customGrid.includes(key)) {
                if (this.drawMode) {
                    if (this.config.customGridWallGroups[key] !== this.activeWallGroupId) {
                        this.config.customGridWallGroups[key] = this.activeWallGroupId;
                        this.draw();
                    }
                } else {
                    if (this.config.customGridWallGroups[key]) {
                        delete this.config.customGridWallGroups[key];
                        this.draw();
                    }
                }
            }
            return;
        }

        if (this.activeTab === "ceiling") {
            if (this.drawMode) {
                let changed = false;
                if (this.config.customGridCeilingGroups[key] !== this.activeCeilingGroupId) {
                    this.config.customGridCeilingGroups[key] = this.activeCeilingGroupId;
                    changed = true;
                }
                if (this.config.customGridCeilingShapes[key] !== this.activeCeilingShape) {
                    this.config.customGridCeilingShapes[key] = this.activeCeilingShape;
                    changed = true;
                }
                if (changed) {
                    this.draw();
                }
            } else {
                if (this.config.customGridCeilingGroups[key] || this.config.customGridCeilingShapes[key]) {
                    delete this.config.customGridCeilingGroups[key];
                    delete this.config.customGridCeilingShapes[key];
                    this.draw();
                }
            }
            return;
        }

        if (this.drawMode) {
            let changed = false;
            if (!this.config.customGrid.includes(key)) {
                this.config.customGrid.push(key);
                changed = true;
                // Auto-generate ceiling if not already present
                if (!this.config.customGridCeilingGroups[key]) {
                    this.config.customGridCeilingGroups[key] = "default";
                    this.config.customGridCeilingShapes[key] = "full";
                }
            }
            if (this.config.customGridGroups[key] !== this.activeGroupId) {
                this.config.customGridGroups[key] = this.activeGroupId;
                changed = true;
            }
            if (this.config.customGridShapes[key] !== this.activeCellShape) {
                this.config.customGridShapes[key] = this.activeCellShape;
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
                delete this.config.customGridShapes[key];
                this.draw();
            }
        }
    }

    open(tab = "floor") {
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
        this.config.groundGroups = (env.groundGroups && env.groundGroups.length > 0) ? JSON.parse(JSON.stringify(env.groundGroups)) : [
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
        this.config.customGridShapes = env.customGridShapes ? { ...env.customGridShapes } : {};

        // Sync advanced walls
        this.config.invisibleWallsAdvanced = !!env.invisibleWallsAdvanced;
        this.config.customGridWallGroups = env.customGridWallGroups ? { ...env.customGridWallGroups } : {};
        this.config.invisibleWallsGroups = (env.invisibleWallsGroups && env.invisibleWallsGroups.length > 0) ? JSON.parse(JSON.stringify(env.invisibleWallsGroups)) : [
            {
                id: "default",
                name: "Pared 1",
                color: "#FF5722",
                texturePath: null,
                textureAssetId: null,
                textureSettings: normalizeTextureSettings({ tileSize: 5 }),
                height: 10,
                opacity: 1.0,
                transparent: false
            }
        ];

        // Sync ceilings
        this.config.ceilingGroups = (env.ceilingGroups && env.ceilingGroups.length > 0) ? JSON.parse(JSON.stringify(env.ceilingGroups)) : [
            {
                id: "default",
                name: "Techo 1",
                color: "#E040FB",
                texturePath: null,
                textureAssetId: null,
                textureSettings: normalizeTextureSettings({ tileSize: 5 })
            }
        ];
        this.config.customGridCeilingGroups = env.customGridCeilingGroups ? { ...env.customGridCeilingGroups } : {};
        this.config.customGridCeilingShapes = env.customGridCeilingShapes ? { ...env.customGridCeilingShapes } : {};

        // Force colors on default groups if missing
        const defaultG = this.config.groundGroups.find(g => g.id === "default");
        if (defaultG && !defaultG.color) defaultG.color = "#FF9800";

        const defaultW = this.config.invisibleWallsGroups.find(w => w.id === "default");
        if (defaultW && !defaultW.color) defaultW.color = "#FF5722";

        const defaultC = this.config.ceilingGroups.find(c => c.id === "default");
        if (defaultC && !defaultC.color) defaultC.color = "#E040FB";

        // Ensure color3D exists for backward compatibility
        this.config.groundGroups.forEach((g: any) => {
            if (!g.color3D) g.color3D = g.color || "#FF9800";
        });
        this.config.invisibleWallsGroups.forEach((w: any) => {
            if (!w.color3D) w.color3D = w.color || "#FF5722";
        });
        this.config.ceilingGroups.forEach((c: any) => {
            if (!c.color3D) c.color3D = c.color || "#E040FB";
        });

        // Backward compatibility: map existing cells
        this.config.customGrid.forEach(key => {
            if (!this.config.customGridGroups[key]) {
                this.config.customGridGroups[key] = "default";
            }
            if (!this.config.customGridShapes[key]) {
                this.config.customGridShapes[key] = "full";
            }
            if (!this.config.customGridWallGroups[key]) {
                this.config.customGridWallGroups[key] = "default";
            }
            if (!this.config.customGridCeilingGroups[key]) {
                this.config.customGridCeilingGroups[key] = "default";
            }
            if (!this.config.customGridCeilingShapes[key]) {
                this.config.customGridCeilingShapes[key] = "full";
            }
        });

        this.activeGroupId = "default";
        this.selectedGroupIdForEditing = "default";
        this.activeCellShape = "full";

        this.activeWallGroupId = "default";
        this.selectedWallGroupIdForEditing = "default";

        this.activeCeilingGroupId = "default";
        this.selectedCeilingGroupIdForEditing = "default";
        this.activeCeilingShape = "full";

        this.activeTab = tab; // floor | walls | ceiling

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
        this.syncShapeButtons();
        this.syncCeilingShapeButtons();
        this.syncTabs();
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
            if (!this.config.customGridShapes) this.config.customGridShapes = {};
            this.config.customGridShapes["0,0"] = "full";
            if (!this.config.customGridWallGroups) this.config.customGridWallGroups = {};
            this.config.customGridWallGroups["0,0"] = "default";
            if (!this.config.customGridCeilingGroups) this.config.customGridCeilingGroups = {};
            this.config.customGridCeilingGroups["0,0"] = "default";
            if (!this.config.customGridCeilingShapes) this.config.customGridCeilingShapes = {};
            this.config.customGridCeilingShapes["0,0"] = "full";
        }

        // Sync default group to root for backward compatibility
        const defaultGroup = this.config.groundGroups.find(g => g.id === "default") || this.config.groundGroups[0];
        if (defaultGroup) {
            this.config.groundTexturePath = defaultGroup.texturePath;
            this.config.groundTextureAssetId = defaultGroup.textureAssetId;
            this.config.groundTextureSettings = normalizeTextureSettings(defaultGroup.textureSettings);
        }

        // Force advanced walls option to true if they edited walls
        if (this.activeTab === "walls") {
            this.config.invisibleWallsAdvanced = true;
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
            customGridGroups: this.config.customGridGroups,
            customGridShapes: this.config.customGridShapes,
            invisibleWallsAdvanced: this.config.invisibleWallsAdvanced,
            invisibleWallsGroups: this.config.invisibleWallsGroups,
            customGridWallGroups: this.config.customGridWallGroups,
            ceilingGroups: this.config.ceilingGroups,
            customGridCeilingGroups: this.config.customGridCeilingGroups,
            customGridCeilingShapes: this.config.customGridCeilingShapes
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
            color3D: color,
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

            const color3DRow = document.createElement('div');
            color3DRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-top: 5px;`;
            color3DRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color 3D (suelo):</span>`;
            
            const color3DInput = document.createElement('input');
            color3DInput.type = "color";
            color3DInput.value = group.color3D || group.color || "#FF9800";
            color3DInput.style.cssText = `
                width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px;
                background: none; cursor: pointer; padding: 0;
            `;
            color3DInput.oninput = (e) => {
                group.color3D = e.target.value;
                this.draw();
            };
            color3DRow.appendChild(color3DInput);
            this.groupPropertiesSection.appendChild(color3DRow);
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

    addNewWallGroup() {
        const id = "wall_group_" + Date.now();
        const colors = ["#FF5722", "#E91E63", "#9C27B0", "#2196F3", "#00BCD4", "#4CAF50", "#FFEB3B", "#FF9800", "#795548", "#607D8B"];
        const color = colors[this.config.invisibleWallsGroups.length % colors.length];
        const name = "Pared " + (this.config.invisibleWallsGroups.length + 1);
        
        const newGroup = {
            id,
            name,
            color,
            color3D: color,
            texturePath: null,
            textureAssetId: null,
            textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false },
            height: 10,
            opacity: 1.0,
            transparent: false
        };

        this.config.invisibleWallsGroups.push(newGroup);
        this.activeWallGroupId = id;
        this.selectedWallGroupIdForEditing = id;

        this.renderWallGroups();
        this.renderSelectedWallGroupSettings();
        this.draw();
    }

    deleteWallGroup(groupId) {
        if (groupId === "default") return;

        this.config.invisibleWallsGroups = this.config.invisibleWallsGroups.filter(g => g.id !== groupId);

        // Reassign walls
        if (this.config.customGridWallGroups) {
            Object.keys(this.config.customGridWallGroups).forEach((key) => {
                if (this.config.customGridWallGroups[key] === groupId) {
                    this.config.customGridWallGroups[key] = "default";
                }
            });
        }

        if (this.activeWallGroupId === groupId) {
            this.activeWallGroupId = "default";
        }
        if (this.selectedWallGroupIdForEditing === groupId) {
            this.selectedWallGroupIdForEditing = "default";
        }

        this.renderWallGroups();
        this.renderSelectedWallGroupSettings();
        this.draw();
    }

    renderWallGroups() {
        if (!this.wallGroupsContainer) return;
        this.wallGroupsContainer.innerHTML = "";

        const groups = this.config.invisibleWallsGroups || [];
        groups.forEach((group) => {
            const card = document.createElement('div');
            card.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 10px; background: ${this.activeWallGroupId === group.id ? '#2a2a2a' : '#1e1e1e'};
                border: 1px solid ${this.activeWallGroupId === group.id ? '#FF9800' : '#333'};
                border-radius: 4px; cursor: pointer; transition: background 0.2s;
            `;
            
            card.onclick = (e) => {
                if (e.target.classList.contains('mse-delete-wall-group-btn')) return;
                this.activeWallGroupId = group.id;
                this.selectedWallGroupIdForEditing = group.id;
                this.renderWallGroups();
                this.renderSelectedWallGroupSettings();
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
                color: #fff; font-size: 13px; font-weight: ${this.activeWallGroupId === group.id ? 'bold' : 'normal'};
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `;
            left.appendChild(nameSpan);
            card.appendChild(left);

            const right = document.createElement('div');
            right.style.cssText = `display: flex; align-items: center; gap: 6px;`;

            if (this.activeWallGroupId === group.id) {
                const check = document.createElement('span');
                check.textContent = "✓";
                check.style.cssText = `color: #4CAF50; font-weight: bold; font-size: 13px;`;
                right.appendChild(check);
            }

            if (group.id !== "default") {
                const delBtn = document.createElement('button');
                delBtn.textContent = "✖";
                delBtn.className = "mse-delete-wall-group-btn";
                delBtn.style.cssText = `
                    background: none; border: none; color: #f44336; cursor: pointer;
                    font-size: 12px; padding: 2px 4px; border-radius: 3px; transition: background 0.2s;
                `;
                delBtn.onmouseover = () => delBtn.style.background = "rgba(244,67,54,0.15)";
                delBtn.onmouseout = () => delBtn.style.background = "none";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteWallGroup(group.id);
                };
                right.appendChild(delBtn);
            }

            card.appendChild(right);
            this.wallGroupsContainer.appendChild(card);
        });
    }

    renderSelectedWallGroupSettings() {
        if (!this.wallPropertiesSection) return;
        this.wallPropertiesSection.innerHTML = "";

        const group = this.config.invisibleWallsGroups.find(g => g.id === this.selectedWallGroupIdForEditing);
        if (!group) return;

        const sectionTitle = document.createElement('label');
        sectionTitle.style.cssText = `color:#aaa; font-size:14px; text-transform:uppercase; margin-bottom: 4px;`;
        sectionTitle.textContent = `Propiedades: ${group.name}`;
        this.wallPropertiesSection.appendChild(sectionTitle);

        // Name
        const nameRow = document.createElement('div');
        nameRow.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;
        nameRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Nombre:</span>`;
        const nameInput = document.createElement('input');
        nameInput.type = "text";
        nameInput.value = group.name;
        nameInput.style.cssText = `padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`;
        nameInput.oninput = (e) => {
            group.name = e.target.value || "Pared";
            this.renderWallGroups();
            sectionTitle.textContent = `Propiedades: ${group.name}`;
        };
        nameRow.appendChild(nameInput);
        this.wallPropertiesSection.appendChild(nameRow);

        // Color Picker (Editor)
        const colorRow = document.createElement('div');
        colorRow.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
        colorRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color en Editor:</span>`;
        const colorInput = document.createElement('input');
        colorInput.type = "color";
        colorInput.value = group.color || "#FF5722";
        colorInput.style.cssText = `width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px; background: none; cursor: pointer; padding: 0;`;
        colorInput.oninput = (e) => {
            group.color = e.target.value;
            this.renderWallGroups();
            this.draw();
        };
        colorRow.appendChild(colorInput);
        this.wallPropertiesSection.appendChild(colorRow);

        // Color Picker (3D)
        const color3DRow = document.createElement('div');
        color3DRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-top: 5px;`;
        color3DRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color 3D (pared):</span>`;
        const color3DInput = document.createElement('input');
        color3DInput.type = "color";
        color3DInput.value = group.color3D || group.color || "#FF5722";
        color3DInput.style.cssText = `width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px; background: none; cursor: pointer; padding: 0;`;
        color3DInput.oninput = (e) => {
            group.color3D = e.target.value;
            this.draw();
        };
        color3DRow.appendChild(color3DInput);
        this.wallPropertiesSection.appendChild(color3DRow);

        // Height Input / Slider
        const heightRow = document.createElement('div');
        heightRow.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;
        heightRow.innerHTML = `<div style="display:flex; justify-content:space-between;"><span style="font-size:12px; color:#ccc;">Altura (metros):</span><span id="mse-wall-height-val" style="font-size:12px; color:#FF9800; font-weight:bold;">${group.height}</span></div>`;
        const heightSlider = document.createElement('input');
        heightSlider.type = "range";
        heightSlider.min = "1";
        heightSlider.max = "100";
        heightSlider.value = group.height || 10;
        heightSlider.style.cssText = `width: 100%; cursor: pointer;`;
        heightSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            group.height = val;
            document.getElementById("mse-wall-height-val").textContent = String(val);
        };
        heightRow.appendChild(heightSlider);
        this.wallPropertiesSection.appendChild(heightRow);

        // Opacity Slider and Transparent checkbox
        const opacityRow = document.createElement('div');
        opacityRow.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;
        opacityRow.innerHTML = `<div style="display:flex; justify-content:space-between;"><span style="font-size:12px; color:#ccc;">Opacidad (0 a 1):</span><span id="mse-wall-opacity-val" style="font-size:12px; color:#FF9800; font-weight:bold;">${group.opacity.toFixed(1)}</span></div>`;
        const opacitySlider = document.createElement('input');
        opacitySlider.type = "range";
        opacitySlider.min = "0";
        opacitySlider.max = "1";
        opacitySlider.step = "0.1";
        opacitySlider.value = String(group.opacity === undefined ? 1 : group.opacity);
        opacitySlider.style.cssText = `width: 100%; cursor: pointer;`;
        opacitySlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            group.opacity = val;
            group.transparent = val < 1.0;
            document.getElementById("mse-wall-opacity-val").textContent = val.toFixed(1);
            transCheck.checked = val === 0;
        };
        opacityRow.appendChild(opacitySlider);
        this.wallPropertiesSection.appendChild(opacityRow);

        const transRow = document.createElement('label');
        transRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#ddd; cursor:pointer;`;
        transRow.innerHTML = `<span>Completamente Transparente (Invis.)</span>`;
        const transCheck = document.createElement('input');
        transCheck.type = "checkbox";
        transCheck.checked = group.opacity === 0;
        transCheck.onchange = (e) => {
            const checked = e.target.checked;
            group.opacity = checked ? 0 : 1;
            group.transparent = checked;
            opacitySlider.value = checked ? "0" : "1";
            document.getElementById("mse-wall-opacity-val").textContent = checked ? "0.0" : "1.0";
        };
        transRow.appendChild(transCheck);
        this.wallPropertiesSection.appendChild(transRow);

        // Texture Manager for Walls
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
            btn.className = "mse-wall-texture-btn";
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
                this.syncSelectedWallGroupTextureButtons(group);
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

        const assets = this.customTextureAssets || [];
        if (assets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Sin texturas subidas.";
            empty.style.cssText = "grid-column: 1 / -1; color: #777; font-size: 11px; padding: 4px 0;";
            customTextureGrid.appendChild(empty);
        } else {
            assets.forEach((asset) => {
                const btn = document.createElement("div");
                btn.className = "mse-wall-texture-btn mse-wall-custom-texture-btn";
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
                    this.syncSelectedWallGroupTextureButtons(group);
                };
                customTextureGrid.appendChild(btn);
            });
        }
        textureSubGroup.appendChild(customTextureGrid);
        this.wallPropertiesSection.appendChild(textureSubGroup);

        // Wall Texture fit settings
        const groundModeRow = document.createElement('div');
        groundModeRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top: 5px;`;
        const groundModeLabel = document.createElement('span');
        groundModeLabel.textContent = "Modo Textura";
        groundModeLabel.style.cssText = `font-size:12px; color:#ccc;`;
        this.wallFitModeSelect = document.createElement('select');
        this.wallFitModeSelect.style.cssText = `width: 135px; padding: 6px; background:#333; color:white; border:1px solid #555; border-radius:4px; font-size:12px;`;
        this.wallFitModeSelect.innerHTML = `
            <option value="auto">Repetir por tamaño</option>
            <option value="stretch">Estirar por pieza</option>
        `;
        this.wallFitModeSelect.onchange = (e) => this.updateSelectedWallGroupTextureSetting("fitMode", e.target.value);
        groundModeRow.appendChild(groundModeLabel);
        groundModeRow.appendChild(this.wallFitModeSelect);
        this.wallPropertiesSection.appendChild(groundModeRow);

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
                if (!isNaN(value)) this.updateSelectedWallGroupTextureSetting(key, value);
            };
            wrap.textContent = label;
            wrap.appendChild(input);
            this[`wallTextureInput_${key}`] = input;
            return wrap;
        };

        groundSettingsGrid.appendChild(makeGroundInput("tileSize", "Baldosa", 0.25, 0.1));
        groundSettingsGrid.appendChild(makeGroundInput("repeatX", "Repetir U", 0.25, 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("repeatY", "Repetir V", 0.25, 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("rotation", "Rotación", 5));
        groundSettingsGrid.appendChild(makeGroundInput("offsetX", "Mover U", 0.05));
        groundSettingsGrid.appendChild(makeGroundInput("offsetY", "Mover V", 0.05));
        this.wallPropertiesSection.appendChild(groundSettingsGrid);

        const groundPatternRow = document.createElement('label');
        groundPatternRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#ddd; cursor:pointer; margin-top: 5px;`;
        const groundPatternText = document.createElement('span');
        groundPatternText.textContent = "Variar patrón por bloque";
        const groundPatternInput = document.createElement('input');
        groundPatternInput.type = "checkbox";
        groundPatternInput.onchange = (e) => this.updateSelectedWallGroupTextureSetting("patternVariation", e.target.checked);
        this.wallTextureInput_patternVariation = groundPatternInput;
        groundPatternRow.appendChild(groundPatternText);
        groundPatternRow.appendChild(groundPatternInput);
        this.wallPropertiesSection.appendChild(groundPatternRow);

        this.syncSelectedWallGroupTextureControls();
    }

    syncSelectedWallGroupTextureButtons(group) {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll(".mse-wall-texture-btn");
        buttons.forEach((btn) => {
            const path = btn.dataset.texturePath || "";
            const selected = (group.texturePath || "") === path;
            btn.style.borderColor = selected ? "#00FF00" : "#555";
            btn.style.borderWidth = selected ? "2px" : "1px";
        });
    }

    syncSelectedWallGroupTextureControls() {
        const group = this.config.invisibleWallsGroups.find(g => g.id === this.selectedWallGroupIdForEditing);
        if (!group) return;

        const settings = normalizeTextureSettings(group.textureSettings || { tileSize: 5 });
        group.textureSettings = settings;

        if (this.wallFitModeSelect) this.wallFitModeSelect.value = settings.fitMode;
        ["tileSize", "repeatX", "repeatY", "offsetX", "offsetY", "rotation"].forEach((key) => {
            const input = this[`wallTextureInput_${key}`];
            if (input) input.value = String(settings[key]);
        });
        if (this.wallTextureInput_patternVariation) {
            this.wallTextureInput_patternVariation.checked = settings.patternVariation;
        }
        this.syncSelectedWallGroupTextureButtons(group);
    }

    updateSelectedWallGroupTextureSetting(key, value) {
        const group = this.config.invisibleWallsGroups.find(g => g.id === this.selectedWallGroupIdForEditing);
        if (!group) return;

        group.textureSettings = normalizeTextureSettings({
            ...(group.textureSettings || {}),
            [key]: value
        });
        this.syncSelectedWallGroupTextureControls();
    }

    syncTabs() {
        const isFloor = this.activeTab === "floor";
        const isWalls = this.activeTab === "walls";
        const isCeiling = this.activeTab === "ceiling";
        
        // Highlight active tab button
        this.tabFloorBtn.style.background = isFloor ? "#FF9800" : "transparent";
        this.tabFloorBtn.style.color = isFloor ? "#000" : "#aaa";
        this.tabWallsBtn.style.background = isWalls ? "#FF9800" : "transparent";
        this.tabWallsBtn.style.color = isWalls ? "#000" : "#aaa";
        this.tabCeilingBtn.style.background = isCeiling ? "#FF9800" : "transparent";
        this.tabCeilingBtn.style.color = isCeiling ? "#000" : "#aaa";

        // Show/hide sections
        this.floorEditorContent.style.display = isFloor ? "flex" : "none";
        this.wallsEditorContent.style.display = isWalls ? "flex" : "none";
        this.ceilingEditorContent.style.display = isCeiling ? "flex" : "none";

        if (isFloor) {
            this.renderGroups();
            this.renderSelectedGroupSettings();
        } else if (isWalls) {
            this.renderWallGroups();
            this.renderSelectedWallGroupSettings();
        } else if (isCeiling) {
            this.renderCeilingGroups();
            this.renderSelectedCeilingGroupSettings();
        }
    }

    async loadCustomTextures() {
        try {
            this.customTextureAssets = await listAssets("mine", "TEXTURE");
        } catch (err) {
            console.warn("No se pudieron cargar tus texturas", err);
            this.customTextureAssets = [];
        }
        this.renderSelectedGroupSettings();
        this.renderSelectedWallGroupSettings();
        this.renderSelectedCeilingGroupSettings();
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

    syncToolButtons() {
        if (!this.container) return;
        const paintBtn = this.paintToolBtn;
        const eraseBtn = this.eraseToolBtn;
        if (!paintBtn || !eraseBtn) return;

        const isPaint = this.selectedTool === "paint";
        
        paintBtn.style.background = isPaint ? "#FF9800" : "transparent";
        paintBtn.style.color = isPaint ? "#000" : "#aaa";

        eraseBtn.style.background = !isPaint ? "#f44336" : "transparent";
        eraseBtn.style.color = !isPaint ? "#fff" : "#aaa";
    }

    updateVisibility() {
        const isCustom = this.config.shapeType === 'custom';
        this.dimGroup.style.display = isCustom ? 'none' : 'flex';
        this.customInfo.style.display = isCustom ? 'flex' : 'none';
        this.groupsSection.style.display = isCustom ? 'flex' : 'none';
        this.shapesSection.style.display = isCustom ? 'flex' : 'none';

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
        this.syncShapeButtons();
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
            const customGridShapes = this.config.customGridShapes || {};

            this.config.customGrid.forEach(key => {
                const [gx, gz] = key.split(',').map(Number);
                const x = gx * cs;
                const z = gz * cs;

                const groupId = customGridGroups[key] || "default";
                const group = groundGroups.find(g => g.id === groupId) || groundGroups[0] || { color: "#FF9800" };
                const baseColor = group.color || "#FF9800";
                
                const isFaded = this.activeTab === "walls" || this.activeTab === "ceiling";
                this.ctx.fillStyle = this.hexToRgba(baseColor, isFaded ? 0.15 : 0.6);
                this.ctx.strokeStyle = isFaded ? this.hexToRgba(baseColor, 0.25) : baseColor;
                this.ctx.lineWidth = 2 / this.zoom;
                
                const shape = customGridShapes[key] || "full";
                
                if (shape === "full") {
                    this.ctx.fillRect(x, z, cs, cs);
                    this.ctx.strokeRect(x, z, cs, cs);
                } else {
                    this.ctx.beginPath();
                    if (shape === "nw") {
                        this.ctx.moveTo(x, z);
                        this.ctx.lineTo(x, z + cs);
                        this.ctx.lineTo(x + cs, z);
                    } else if (shape === "ne") {
                        this.ctx.moveTo(x, z);
                        this.ctx.lineTo(x + cs, z);
                        this.ctx.lineTo(x + cs, z + cs);
                    } else if (shape === "se") {
                        this.ctx.moveTo(x + cs, z);
                        this.ctx.lineTo(x + cs, z + cs);
                        this.ctx.lineTo(x, z + cs);
                    } else if (shape === "sw") {
                        this.ctx.moveTo(x, z);
                        this.ctx.lineTo(x, z + cs);
                        this.ctx.lineTo(x + cs, z + cs);
                    }
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
                }
            });

            // Draw Ceiling cells if in Ceiling tab
            if (this.activeTab === "ceiling") {
                const customGridCeilingGroups = this.config.customGridCeilingGroups || {};
                const ceilingGroups = this.config.ceilingGroups || [];
                const customGridCeilingShapes = this.config.customGridCeilingShapes || {};

                Object.keys(customGridCeilingGroups).forEach(key => {
                    const [gx, gz] = key.split(',').map(Number);
                    const x = gx * cs;
                    const z = gz * cs;

                    const groupId = customGridCeilingGroups[key];
                    if (!groupId) return;
                    const group = ceilingGroups.find(g => g.id === groupId) || ceilingGroups[0] || { color: "#E040FB" };
                    const baseColor = group.color || "#E040FB";
                    
                    this.ctx.fillStyle = this.hexToRgba(baseColor, 0.6);
                    this.ctx.strokeStyle = baseColor;
                    this.ctx.lineWidth = 2 / this.zoom;
                    
                    const shape = customGridCeilingShapes[key] || "full";
                    
                    if (shape === "full") {
                        this.ctx.fillRect(x, z, cs, cs);
                        this.ctx.strokeRect(x, z, cs, cs);
                    } else {
                        this.ctx.beginPath();
                        if (shape === "nw") {
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x, z + cs);
                            this.ctx.lineTo(x + cs, z);
                        } else if (shape === "ne") {
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x + cs, z);
                            this.ctx.lineTo(x + cs, z + cs);
                        } else if (shape === "se") {
                            this.ctx.moveTo(x + cs, z);
                            this.ctx.lineTo(x + cs, z + cs);
                            this.ctx.lineTo(x, z + cs);
                        } else if (shape === "sw") {
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x, z + cs);
                            this.ctx.lineTo(x + cs, z + cs);
                        }
                        this.ctx.closePath();
                        this.ctx.fill();
                        this.ctx.stroke();
                    }
                });
            }

            // Draw Wall boundaries if in Walls tab
            if (this.activeTab === "walls") {
                const customGridWallGroups = this.config.customGridWallGroups || {};
                const wallGroups = this.config.invisibleWallsGroups || [];
                const customGridSet = new Set(this.config.customGrid);

                const hasNorthFace = (sh) => sh === "full" || sh === "nw" || sh === "ne";
                const hasSouthFace = (sh) => sh === "full" || sh === "se" || sh === "sw";
                const hasWestFace = (sh) => sh === "full" || sh === "nw" || sh === "sw";
                const hasEastFace = (sh) => sh === "full" || sh === "ne" || sh === "se";

                this.config.customGrid.forEach(key => {
                    const [gx, gz] = key.split(',').map(Number);
                    const x = gx * cs;
                    const z = gz * cs;
                    const shape = customGridShapes[key] || "full";
                    const wallGroupId = customGridWallGroups[key] || "default";
                    const wallGroup = wallGroups.find(g => g.id === wallGroupId) || wallGroups[0] || { color: "#FF5722" };
                    const wallColor = wallGroup.color || "#FF5722";

                    this.ctx.strokeStyle = wallColor;
                    this.ctx.lineWidth = 4 / this.zoom;

                    // 1. North face
                    if (hasNorthFace(shape)) {
                        const nKey = `${gx},${gz - 1}`;
                        const nShape = customGridShapes[nKey] || "full";
                        const nExists = customGridSet.has(nKey);
                        if (!nExists || !hasSouthFace(nShape)) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x + cs, z);
                            this.ctx.stroke();
                        }
                    }

                    // 2. South face
                    if (hasSouthFace(shape)) {
                        const nKey = `${gx},${gz + 1}`;
                        const nShape = customGridShapes[nKey] || "full";
                        const nExists = customGridSet.has(nKey);
                        if (!nExists || !hasNorthFace(nShape)) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, z + cs);
                            this.ctx.lineTo(x + cs, z + cs);
                            this.ctx.stroke();
                        }
                    }

                    // 3. West face
                    if (hasWestFace(shape)) {
                        const nKey = `${gx - 1},${gz}`;
                        const nShape = customGridShapes[nKey] || "full";
                        const nExists = customGridSet.has(nKey);
                        if (!nExists || !hasEastFace(nShape)) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x, z + cs);
                            this.ctx.stroke();
                        }
                    }

                    // 4. East face
                    if (hasEastFace(shape)) {
                        const nKey = `${gx + 1},${gz}`;
                        const nShape = customGridShapes[nKey] || "full";
                        const nExists = customGridSet.has(nKey);
                        if (!nExists || !hasWestFace(nShape)) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x + cs, z);
                            this.ctx.lineTo(x + cs, z + cs);
                            this.ctx.stroke();
                        }
                    }

                    // 5. Diagonal face
                    if (shape !== "full") {
                        this.ctx.beginPath();
                        if (shape === "nw") {
                            this.ctx.moveTo(x, z + cs);
                            this.ctx.lineTo(x + cs, z);
                        } else if (shape === "ne") {
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x + cs, z + cs);
                        } else if (shape === "se") {
                            this.ctx.moveTo(x + cs, z);
                            this.ctx.lineTo(x, z + cs);
                        } else if (shape === "sw") {
                            this.ctx.moveTo(x, z);
                            this.ctx.lineTo(x + cs, z + cs);
                        }
                        this.ctx.stroke();
                    }
                });
            }

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

    syncShapeButtons() {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll(".mse-shape-select-btn");
        buttons.forEach((btn) => {
            const selected = btn.dataset.shapeId === this.activeCellShape;
            btn.style.borderColor = selected ? "#FF9800" : "#555";
            btn.style.backgroundColor = selected ? "#444" : "#333";
            btn.style.color = selected ? "#FF9800" : "white";
        });
    }

    addNewCeilingGroup() {
        const id = "ceiling_group_" + Date.now();
        const colors = ["#E040FB", "#00E676", "#FF5722", "#4CAF50", "#2196F3", "#9C27B0", "#E91E63", "#00BCD4", "#8BC34A", "#FFEB3B"];
        const color = colors[this.config.ceilingGroups.length % colors.length];
        const name = "Techo " + (this.config.ceilingGroups.length + 1);
        
        const newGroup = {
            id,
            name,
            color,
            color3D: color,
            texturePath: null,
            textureAssetId: null,
            textureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false }
        };

        this.config.ceilingGroups.push(newGroup);
        this.activeCeilingGroupId = id;
        this.selectedCeilingGroupIdForEditing = id;

        this.renderCeilingGroups();
        this.renderSelectedCeilingGroupSettings();
        this.draw();
    }

    deleteCeilingGroup(groupId) {
        if (groupId === "default") return;

        this.config.ceilingGroups = this.config.ceilingGroups.filter((g: any) => g.id !== groupId);

        // Reassign cells
        if (this.config.customGridCeilingGroups) {
            Object.keys(this.config.customGridCeilingGroups).forEach((key) => {
                if (this.config.customGridCeilingGroups[key] === groupId) {
                    this.config.customGridCeilingGroups[key] = "default";
                }
            });
        }

        if (this.activeCeilingGroupId === groupId) {
            this.activeCeilingGroupId = "default";
        }
        if (this.selectedCeilingGroupIdForEditing === groupId) {
            this.selectedCeilingGroupIdForEditing = "default";
        }

        this.renderCeilingGroups();
        this.renderSelectedCeilingGroupSettings();
        this.draw();
    }

    renderCeilingGroups() {
        if (!this.ceilingGroupsContainer) return;
        this.ceilingGroupsContainer.innerHTML = "";

        const groups = this.config.ceilingGroups || [];
        groups.forEach((group: any) => {
            const card = document.createElement('div');
            card.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 10px; background: ${this.activeCeilingGroupId === group.id ? '#2a2a2a' : '#1e1e1e'};
                border: 1px solid ${this.activeCeilingGroupId === group.id ? '#FF9800' : '#333'};
                border-radius: 4px; cursor: pointer; transition: background 0.2s;
            `;
            
            card.onclick = (e: any) => {
                if (e.target.classList.contains('mse-delete-ceiling-group-btn')) return;
                this.activeCeilingGroupId = group.id;
                this.selectedCeilingGroupIdForEditing = group.id;
                this.renderCeilingGroups();
                this.renderSelectedCeilingGroupSettings();
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
                color: #fff; font-size: 13px; font-weight: ${this.activeCeilingGroupId === group.id ? 'bold' : 'normal'};
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `;
            left.appendChild(nameSpan);
            card.appendChild(left);

            const right = document.createElement('div');
            right.style.cssText = `display: flex; align-items: center; gap: 6px;`;

            if (this.activeCeilingGroupId === group.id) {
                const check = document.createElement('span');
                check.textContent = "✓";
                check.style.cssText = `color: #4CAF50; font-weight: bold; font-size: 13px;`;
                right.appendChild(check);
            }

            if (group.id !== "default") {
                const delBtn = document.createElement('button');
                delBtn.textContent = "✖";
                delBtn.className = "mse-delete-ceiling-group-btn";
                delBtn.style.cssText = `
                    background: none; border: none; color: #f44336; cursor: pointer;
                    font-size: 12px; padding: 2px 4px; border-radius: 3px; transition: background 0.2s;
                `;
                delBtn.onmouseover = () => delBtn.style.background = "rgba(244,67,54,0.15)";
                delBtn.onmouseout = () => delBtn.style.background = "none";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteCeilingGroup(group.id);
                };
                right.appendChild(delBtn);
            }

            card.appendChild(right);
            this.ceilingGroupsContainer.appendChild(card);
        });
    }

    renderSelectedCeilingGroupSettings() {
        if (!this.ceilingPropertiesSection) return;
        this.ceilingPropertiesSection.innerHTML = "";

        const group = this.config.ceilingGroups.find((g: any) => g.id === this.selectedCeilingGroupIdForEditing);
        if (!group) return;

        const sectionTitle = document.createElement('label');
        sectionTitle.style.cssText = `color:#aaa; font-size:14px; text-transform:uppercase; margin-bottom: 4px;`;
        sectionTitle.textContent = this.config.shapeType === 'custom' ? `Propiedades: ${group.name}` : "Techo predeterminado";
        this.ceilingPropertiesSection.appendChild(sectionTitle);

        if (this.config.shapeType === 'custom') {
            const nameRow = document.createElement('div');
            nameRow.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;
            nameRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Nombre:</span>`;
            
            const nameInput = document.createElement('input');
            nameInput.type = "text";
            nameInput.value = group.name;
            nameInput.style.cssText = `padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`;
            nameInput.oninput = (e: any) => {
                group.name = e.target.value || "Techo";
                this.renderCeilingGroups();
                sectionTitle.textContent = `Propiedades: ${group.name}`;
            };
            nameRow.appendChild(nameInput);
            this.ceilingPropertiesSection.appendChild(nameRow);

            const colorRow = document.createElement('div');
            colorRow.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
            colorRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color en Editor:</span>`;
            
            const colorInput = document.createElement('input');
            colorInput.type = "color";
            colorInput.value = group.color || "#E040FB";
            colorInput.style.cssText = `
                width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px;
                background: none; cursor: pointer; padding: 0;
            `;
            colorInput.oninput = (e: any) => {
                group.color = e.target.value;
                this.renderCeilingGroups();
                this.draw();
            };
            colorRow.appendChild(colorInput);
            this.ceilingPropertiesSection.appendChild(colorRow);

            const color3DRow = document.createElement('div');
            color3DRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-top: 5px;`;
            color3DRow.innerHTML = `<span style="font-size:12px; color:#ccc;">Color 3D (techo):</span>`;
            
            const color3DInput = document.createElement('input');
            color3DInput.type = "color";
            color3DInput.value = group.color3D || group.color || "#E040FB";
            color3DInput.style.cssText = `
                width: 40px; height: 26px; border: 1px solid #555; border-radius: 4px;
                background: none; cursor: pointer; padding: 0;
            `;
            color3DInput.oninput = (e: any) => {
                group.color3D = e.target.value;
                this.draw();
            };
            color3DRow.appendChild(color3DInput);
            this.ceilingPropertiesSection.appendChild(color3DRow);
        }

        const textureSubGroup = document.createElement('div');
        textureSubGroup.style.cssText = `display: flex; flex-direction: column; gap: 8px; margin-top: 5px;`;
        
        const textureHeader = document.createElement('span');
        textureHeader.textContent = "Texturas Predeterminadas";
        textureHeader.style.cssText = `font-size:12px; color:#ccc;`;
        textureSubGroup.appendChild(textureHeader);

        const ceilingTextureGrid = document.createElement('div');
        ceilingTextureGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;`;
        
        const defaultTextures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "/assets/textures/obj/brick.png" },
            { name: "Concreto", path: "/assets/textures/obj/concrete.png" },
            { name: "Madera", path: "/assets/textures/obj/wood.png" },
            { name: "Hierro", path: "/assets/textures/obj/hierro.png" }
        ];

        defaultTextures.forEach((tex) => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "mse-ceiling-texture-btn";
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
                this.syncSelectedCeilingGroupTextureButtons(group);
            };
            ceilingTextureGrid.appendChild(btn);
        });
        textureSubGroup.appendChild(ceilingTextureGrid);

        const customTextureHeader = document.createElement('span');
        customTextureHeader.textContent = "Tus Texturas Subidas";
        customTextureHeader.style.cssText = `font-size:12px; color:#ccc; margin-top: 8px;`;
        textureSubGroup.appendChild(customTextureHeader);

        const customTextureGrid = document.createElement('div');
        customTextureGrid.style.cssText = `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; min-height: 35px;`;
        this.ceilingCustomTextureGrid = customTextureGrid;

        const assets = this.customTextureAssets || [];
        if (assets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Sin texturas subidas.";
            empty.style.cssText = "grid-column: 1 / -1; color: #777; font-size: 11px; padding: 4px 0;";
            customTextureGrid.appendChild(empty);
        } else {
            assets.forEach((asset: any) => {
                const btn = document.createElement("div");
                btn.className = "mse-ceiling-texture-btn mse-ceiling-custom-texture-btn";
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
                    this.syncSelectedCeilingGroupTextureButtons(group);
                };
                customTextureGrid.appendChild(btn);
            });
        }
        textureSubGroup.appendChild(customTextureGrid);
        this.ceilingPropertiesSection.appendChild(textureSubGroup);

        const fitModeRow = document.createElement('div');
        fitModeRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top: 5px;`;
        const fitModeLabel = document.createElement('span');
        fitModeLabel.textContent = "Modo Textura";
        fitModeLabel.style.cssText = `font-size:12px; color:#ccc;`;
        this.ceilingFitModeSelect = document.createElement('select');
        this.ceilingFitModeSelect.style.cssText = `width: 135px; padding: 6px; background:#333; color:white; border:1px solid #555; border-radius:4px; font-size:12px;`;
        this.ceilingFitModeSelect.innerHTML = `
            <option value="auto">Repetir por tamaño</option>
            <option value="stretch">Estirar por pieza</option>
        `;
        this.ceilingFitModeSelect.onchange = (e: any) => this.updateSelectedCeilingGroupTextureSetting("fitMode", e.target.value);
        fitModeRow.appendChild(fitModeLabel);
        fitModeRow.appendChild(this.ceilingFitModeSelect);
        this.ceilingPropertiesSection.appendChild(fitModeRow);

        const settingsGrid = document.createElement('div');
        settingsGrid.style.cssText = `display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 5px;`;
        
        const makeInput = (key: string, label: string, step: number, min: number | null = null) => {
            const wrap = document.createElement('label');
            wrap.style.cssText = `display:flex; flex-direction:column; gap:3px; font-size:11px; color:#aaa;`;
            const input = document.createElement('input');
            input.type = "number";
            input.step = String(step);
            if (min !== null) input.min = String(min);
            input.style.cssText = `width:100%; box-sizing:border-box; padding:5px; background:#333; color:white; border:1px solid #555; border-radius:4px; font-size:11px;`;
            input.onchange = (e: any) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) this.updateSelectedCeilingGroupTextureSetting(key, value);
            };
            wrap.textContent = label;
            wrap.appendChild(input);
            this[`ceilingTextureInput_${key}`] = input;
            return wrap;
        };

        settingsGrid.appendChild(makeInput("tileSize", "Baldosa", 0.25, 0.1));
        settingsGrid.appendChild(makeInput("repeatX", "Repetir U", 0.25, 0.05));
        settingsGrid.appendChild(makeInput("repeatY", "Repetir V", 0.25, 0.05));
        settingsGrid.appendChild(makeInput("rotation", "Rotación", 5));
        settingsGrid.appendChild(makeInput("offsetX", "Mover U", 0.05));
        settingsGrid.appendChild(makeInput("offsetY", "Mover V", 0.05));
        this.ceilingPropertiesSection.appendChild(settingsGrid);

        const patternRow = document.createElement('label');
        patternRow.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#ddd; cursor:pointer; margin-top: 5px;`;
        const patternText = document.createElement('span');
        patternText.textContent = "Variar patrón por bloque";
        const patternInput = document.createElement('input');
        patternInput.type = "checkbox";
        patternInput.onchange = (e: any) => this.updateSelectedCeilingGroupTextureSetting("patternVariation", e.target.checked);
        this.ceilingTextureInput_patternVariation = patternInput;
        patternRow.appendChild(patternText);
        patternRow.appendChild(patternInput);
        this.ceilingPropertiesSection.appendChild(patternRow);

        this.syncSelectedCeilingGroupTextureControls();
    }

    syncSelectedCeilingGroupTextureButtons(group: any) {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll(".mse-ceiling-texture-btn");
        buttons.forEach((btn: any) => {
            const path = btn.dataset.texturePath || "";
            const selected = (group.texturePath || "") === path;
            btn.style.borderColor = selected ? "#00FF00" : "#555";
            btn.style.borderWidth = selected ? "2px" : "1px";
        });
    }

    syncSelectedCeilingGroupTextureControls() {
        const group = this.config.ceilingGroups.find((g: any) => g.id === this.selectedCeilingGroupIdForEditing);
        if (!group) return;

        const settings = normalizeTextureSettings(group.textureSettings || { tileSize: 5 });
        group.textureSettings = settings;

        if (this.ceilingFitModeSelect) this.ceilingFitModeSelect.value = settings.fitMode;
        ["tileSize", "repeatX", "repeatY", "offsetX", "offsetY", "rotation"].forEach((key) => {
            const input = this[`ceilingTextureInput_${key}`];
            if (input) input.value = String(settings[key]);
        });
        if (this.ceilingTextureInput_patternVariation) {
            this.ceilingTextureInput_patternVariation.checked = settings.patternVariation;
        }
        this.syncSelectedCeilingGroupTextureButtons(group);
    }

    updateSelectedCeilingGroupTextureSetting(key: string, value: any) {
        const group = this.config.ceilingGroups.find((g: any) => g.id === this.selectedCeilingGroupIdForEditing);
        if (!group) return;

        group.textureSettings = normalizeTextureSettings({
            ...(group.textureSettings || {}),
            [key]: value
        });
        this.syncSelectedCeilingGroupTextureControls();
    }

    syncCeilingShapeButtons() {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll(".mse-ceiling-shape-select-btn");
        buttons.forEach((btn: any) => {
            const selected = btn.dataset.shapeId === this.activeCeilingShape;
            btn.style.borderColor = selected ? "#FF9800" : "#555";
            btn.style.backgroundColor = selected ? "#444" : "#333";
            btn.style.color = selected ? "#FF9800" : "white";
        });
    }

    createCopyPanel(parentEl: HTMLElement, currentTab: string) {
        const copySection = document.createElement('div');
        copySection.style.cssText = `display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #333; padding-top: 12px; margin-top: 10px;`;
        
        const title = document.createElement('span');
        title.textContent = "Copiar Grupos de:";
        title.style.cssText = `color: #aaa; font-size: 11px; text-transform: uppercase; font-weight: bold;`;
        copySection.appendChild(title);

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `display: flex; gap: 6px;`;

        const tabs = [
            { id: "floor", name: "Suelo" },
            { id: "walls", name: "Paredes" },
            { id: "ceiling", name: "Techo" }
        ];

        tabs.forEach((t) => {
            if (t.id === currentTab) return; // don't copy to itself
            
            const btn = document.createElement('button');
            btn.type = "button";
            btn.textContent = t.name;
            btn.style.cssText = `
                flex: 1; padding: 4px 8px; background: #333; color: #ccc; border: 1px solid #555;
                border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s;
            `;
            btn.onmouseover = () => { btn.style.background = "#444"; btn.style.color = "#fff"; };
            btn.onmouseout = () => { btn.style.background = "#333"; btn.style.color = "#ccc"; };
            btn.onclick = () => {
                if (confirm(`¿Copiar todos los grupos de '${t.name}' a esta pestaña?`)) {
                    this.copyGroupsFrom(t.id);
                }
            };
            btnContainer.appendChild(btn);
        });

        copySection.appendChild(btnContainer);

        // Auto-assign groups logically
        const applyLogicBtn = document.createElement('button');
        applyLogicBtn.type = "button";
        applyLogicBtn.textContent = "⚡ Mapear Grupos Lógicamente";
        applyLogicBtn.style.cssText = `
            width: 100%; padding: 6px; background: #008CBA; color: white; border: none;
            border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold; margin-top: 8px; transition: background 0.2s;
        `;
        applyLogicBtn.onmouseover = () => { applyLogicBtn.style.background = "#007ea7"; };
        applyLogicBtn.onmouseout = () => { applyLogicBtn.style.background = "#008CBA"; };
        applyLogicBtn.onclick = () => {
            if (confirm("¿Sincronizar automáticamente grupos y formas del techo y paredes según los grupos del suelo?")) {
                this.applyGroupsLogically();
            }
        };
        copySection.appendChild(applyLogicBtn);

        parentEl.appendChild(copySection);
    }

    copyGroupsFrom(sourceTab: string) {
        let sourceGroups: any[] = [];
        if (sourceTab === "floor") {
            sourceGroups = this.config.groundGroups || [];
        } else if (sourceTab === "walls") {
            sourceGroups = this.config.invisibleWallsGroups || [];
        } else if (sourceTab === "ceiling") {
            sourceGroups = this.config.ceilingGroups || [];
        }

        const activeTab = this.activeTab;
        let destGroups: any[] = [];
        if (activeTab === "floor") {
            destGroups = this.config.groundGroups;
        } else if (activeTab === "walls") {
            destGroups = this.config.invisibleWallsGroups;
        } else if (activeTab === "ceiling") {
            destGroups = this.config.ceilingGroups;
        }

        sourceGroups.forEach((src) => {
            const isDefault = src.id === "default";
            const targetName = isDefault ? (src.name + " (Copia)") : src.name;

            const existingDestGroup = destGroups.find(
                (g: any) => g.id === src.id || g.name.toLowerCase() === targetName.toLowerCase()
            );

            if (existingDestGroup) {
                existingDestGroup.color = src.color;
                existingDestGroup.color3D = src.color3D || src.color;
                existingDestGroup.texturePath = src.texturePath;
                existingDestGroup.textureAssetId = src.textureAssetId;
                if (src.textureSettings) {
                    existingDestGroup.textureSettings = JSON.parse(JSON.stringify(src.textureSettings));
                }
                if (src.height !== undefined) existingDestGroup.height = src.height;
                if (src.opacity !== undefined) existingDestGroup.opacity = src.opacity;
                if (src.transparent !== undefined) existingDestGroup.transparent = src.transparent;
            } else {
                const suffix = "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
                const id = (activeTab === "walls" ? "wall_group_" : (activeTab === "ceiling" ? "ceiling_group_" : "group_")) + suffix;
                
                const copiedGroup = {
                    ...JSON.parse(JSON.stringify(src)),
                    id: id,
                    // Assign sensible defaults if copying to walls
                    height: src.height !== undefined ? src.height : 10,
                    opacity: src.opacity !== undefined ? src.opacity : 1.0,
                    transparent: src.transparent !== undefined ? src.transparent : false
                };

                if (isDefault) {
                    copiedGroup.name = src.name + " (Copia)";
                }

                destGroups.push(copiedGroup);
            }
        });

        if (activeTab === "floor") {
            this.renderGroups();
            this.renderSelectedGroupSettings();
        } else if (activeTab === "walls") {
            this.renderWallGroups();
            this.renderSelectedWallGroupSettings();
        } else if (activeTab === "ceiling") {
            this.renderCeilingGroups();
            this.renderSelectedCeilingGroupSettings();
        }
        this.draw();
    }

    applyGroupsLogically() {
        const customGrid = this.config.customGrid || [];
        const customGridGroups = this.config.customGridGroups || {};
        const customGridShapes = this.config.customGridShapes || {};
        
        const groundGroups = this.config.groundGroups || [];
        const wallGroups = this.config.invisibleWallsGroups || [];
        const ceilingGroups = this.config.ceilingGroups || [];

        let wallMatchedCount = 0;
        let ceilingMatchedCount = 0;

        customGrid.forEach((key) => {
            const floorGroupId = customGridGroups[key] || "default";
            const floorGroup = groundGroups.find((g: any) => g.id === floorGroupId);
            if (!floorGroup) return;

            // 1. Mirror Ceiling group & shape
            const matchingCeiling = ceilingGroups.find((cg: any) => 
                cg.name.toLowerCase() === floorGroup.name.toLowerCase() || 
                cg.name.toLowerCase() === (floorGroup.name.toLowerCase() + " (copia)") ||
                floorGroup.name.toLowerCase() === (cg.name.toLowerCase() + " (copia)")
            ) || ceilingGroups.find((cg: any) => cg.id === "default") || ceilingGroups[0];

            if (matchingCeiling) {
                this.config.customGridCeilingGroups[key] = matchingCeiling.id;
                this.config.customGridCeilingShapes[key] = customGridShapes[key] || "full";
                ceilingMatchedCount++;
            }

            // 2. Wall group matching
            const matchingWall = wallGroups.find((wg: any) => 
                wg.name.toLowerCase() === floorGroup.name.toLowerCase() || 
                wg.name.toLowerCase() === (floorGroup.name.toLowerCase() + " (copia)") ||
                floorGroup.name.toLowerCase() === (wg.name.toLowerCase() + " (copia)")
            ) || wallGroups.find((wg: any) => wg.id === "default") || wallGroups[0];

            if (matchingWall) {
                this.config.customGridWallGroups[key] = matchingWall.id;
                wallMatchedCount++;
            }
        });

        alert(`Sincronización lógica completada:\n• ${ceilingMatchedCount} techos espejados con el suelo (grupos y formas).\n• ${wallMatchedCount} paredes mapeadas al grupo correspondiente.`);
        this.draw();
    }
}

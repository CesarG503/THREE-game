// @ts-nocheck

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
            customCellSize: 10
        };

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
        
        // Add Cell Size Input
        const rowCell = document.createElement('div');
        rowCell.style.cssText = `display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px;`;
        rowCell.innerHTML = `<span>Tamaño de Bloque:</span> <input id="mse-cell-size" type="number" step="1" min="1" max="100" style="width: 60px; padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; text-align: center;">`;
        customInfo.appendChild(rowCell);

        // Add Area Selection Checkbox
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

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                if (this.selectionBox.mode) {
                    if (!this.config.customGrid.includes(key)) {
                        this.config.customGrid.push(key);
                    }
                } else {
                    const idx = this.config.customGrid.indexOf(key);
                    if (idx > -1) {
                        this.config.customGrid.splice(idx, 1);
                    }
                }
            }
        }
    }

    handleGridInteraction(e) {
        const worldCoords = this.getWorldCoords(e);
        const gridCoords = this.getGridCoords(worldCoords);
        const key = `${gridCoords.x},${gridCoords.z}`;
        
        if (this.drawMode) {
            if (!this.config.customGrid.includes(key)) {
                this.config.customGrid.push(key);
                this.draw();
            }
        } else {
            const idx = this.config.customGrid.indexOf(key);
            if (idx > -1) {
                this.config.customGrid.splice(idx, 1);
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
        }

        const newConfig = {
            shapeType: this.config.shapeType,
            mapSizeX: this.config.mapSizeX,
            mapSizeZ: this.config.mapSizeZ,
            customGrid: this.config.customGrid,
            customCellSize: this.config.customCellSize
        };

        this.game.updateEnvironmentConfig(newConfig);
        
        if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
            const mapJson = this.game.saveMap();
            this.game.networkManager.broadcastMapSync(mapJson);
        }

        // Refresh parent menu if needed
        if (this.constructionMenu.environmentConfigPanel) {
            // Force re-render of settings
            this.constructionMenu.renderSettings(this.constructionMenu.environmentConfigPanel);
        }

        this.close();
    }

    updateVisibility() {
        const isCustom = this.config.shapeType === 'custom';
        this.dimGroup.style.display = isCustom ? 'none' : 'flex';
        this.customInfo.style.display = isCustom ? 'flex' : 'none';

        if (!isCustom) {
            document.getElementById("mse-size-x").disabled = this.config.shapeType === 'circle';
            // Circle uses mapSizeX as radius (diameter), so we can link them or disable Z
            if (this.config.shapeType === 'circle') {
                document.getElementById("mse-size-z").disabled = true;
                document.getElementById("mse-size-z").value = document.getElementById("mse-size-x").value;
            } else {
                document.getElementById("mse-size-x").disabled = false;
                document.getElementById("mse-size-z").disabled = false;
            }
        }
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
            // Link values for visual
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
            // Read cell size from input dynamically for live preview
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
            this.ctx.fillStyle = "rgba(255, 152, 0, 0.6)";
            this.ctx.strokeStyle = "#FF9800";
            this.ctx.lineWidth = 2 / this.zoom;

            this.config.customGrid.forEach(key => {
                const [gx, gz] = key.split(',').map(Number);
                const x = gx * cs;
                const z = gz * cs;
                
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

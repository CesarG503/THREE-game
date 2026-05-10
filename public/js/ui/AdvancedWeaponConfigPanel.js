import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export class AdvancedWeaponConfigPanel {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.weapon = null;
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.id = 'advanced-weapon-config-panel';

        // Estilos CSS para el panel
        const style = document.createElement('style');
        style.textContent = `
            #advanced-weapon-config-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.85);
                z-index: 9999;
                display: none;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #e0e0e0;
                backdrop-filter: blur(5px);
            }
            .awc-window {
                width: 95vw;
                max-width: 1600px;
                height: 90vh;
                background: rgba(20, 20, 20, 0.85);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                border: 1px solid #444;
                backdrop-filter: blur(10px);
            }
            .awc-header {
                height: 60px;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                padding: 0 20px;
                border-bottom: 1px solid #444;
            }
            .awc-back-btn {
                background: none;
                border: none;
                color: #fff;
                font-size: 20px;
                cursor: pointer;
                margin-right: 15px;
                display: flex;
                align-items: center;
                transition: color 0.2s;
            }
            .awc-back-btn:hover {
                color: #58a6ff;
            }
            .awc-title {
                font-size: 16px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
            }
            .awc-body {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            /* SIDEBAR TABS */
            .awc-sidebar {
                width: 180px;
                background: rgba(0, 0, 0, 0.5);
                border-right: 1px solid #444;
                display: flex;
                flex-direction: column;
                padding: 10px 0;
            }
            .awc-tab {
                padding: 12px 20px;
                display: flex;
                flex-direction: column;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.2s;
            }
            .awc-tab.active {
                background: rgba(255, 255, 255, 0.1);
                border-left-color: #58a6ff;
            }
            .awc-tab:hover:not(.active) {
                background: rgba(255, 255, 255, 0.05);
            }
            .awc-tab-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                margin-bottom: 4px;
                pointer-events: none;
            }
            .awc-tab-subtitle {
                font-size: 11px;
                color: #8b949e;
                pointer-events: none;
            }
            
            /* PROPERTIES COLUMN */
            .awc-properties {
                width: 320px;
                background: rgba(0, 0, 0, 0.3);
                border-right: 1px solid #444;
                overflow-y: auto;
                padding: 20px;
            }
            .awc-properties::-webkit-scrollbar { width: 8px; }
            .awc-properties::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
            .awc-section-title {
                font-size: 12px;
                font-weight: bold;
                color: #8b949e;
                margin-bottom: 15px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .awc-prop-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                font-size: 13px;
            }
            .awc-prop-label {
                color: #c9d1d9;
            }
            .awc-prop-value {
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid #555;
                padding: 4px 8px;
                border-radius: 4px;
                color: #fff;
                width: 120px;
                text-align: left;
                outline: none;
            }
            select.awc-prop-value {
                appearance: none;
                cursor: pointer;
            }
            .awc-prop-value[type="checkbox"] {
                width: auto;
                accent-color: #58a6ff;
                cursor: pointer;
            }

            /* MAIN PREVIEW COLUMN */
            .awc-preview-col {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: transparent;
                padding: 20px;
            }
            .awc-preview-tabs {
                display: flex;
                margin-bottom: 15px;
                border-bottom: 1px solid #444;
            }
            .awc-preview-tab {
                padding: 10px 20px;
                font-size: 13px;
                font-weight: 600;
                color: #8b949e;
                cursor: pointer;
                border-bottom: 2px solid transparent;
            }
            .awc-preview-tab.active {
                color: #58a6ff;
                border-bottom-color: #58a6ff;
            }
            .awc-3d-view {
                flex: 1;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid #444;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
                min-height: 300px;
            }
            .awc-3d-placeholder {
                color: #8b949e;
                font-size: 14px;
            }
            .awc-effect-toggles {
                margin-top: 15px;
                background: rgba(0, 0, 0, 0.4);
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #444;
            }
            .awc-effect-toggles-title {
                font-size: 12px;
                color: #8b949e;
                margin-bottom: 10px;
                text-transform: uppercase;
            }
            .awc-toggles-container {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }
            .awc-toggle {
                display: flex;
                align-items: center;
                font-size: 12px;
                color: #c9d1d9;
                cursor: pointer;
            }
            .awc-toggle input {
                margin-right: 8px;
                accent-color: #58a6ff;
            }
            .awc-effect-previews {
                margin-top: 15px;
                display: flex;
                gap: 15px;
                height: 120px;
            }
            .awc-effect-card {
                flex: 1;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid #444;
                border-radius: 8px;
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .awc-effect-tag {
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(0,0,0,0.6);
                padding: 2px 6px;
                font-size: 10px;
                border-radius: 4px;
                color: #fff;
            }

            /* GRAPHS COLUMN */
            .awc-graphs {
                width: 350px;
                background: rgba(0, 0, 0, 0.5);
                border-left: 1px solid #444;
                padding: 20px;
                overflow-y: auto;
            }
            .awc-graph-card {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid #444;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .awc-graph-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .awc-graph-title {
                font-size: 12px;
                font-weight: bold;
                color: #c9d1d9;
                text-transform: uppercase;
            }
            .awc-graph-area {
                height: 150px;
                border-left: 1px solid #444;
                border-bottom: 1px solid #444;
                position: relative;
                margin-bottom: 15px;
            }
            /* Trajectory curve */
            .awc-curve {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
            }
            .awc-curve svg {
                width: 100%; height: 100%;
                overflow: visible;
            }
            .awc-graph-stats {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #8b949e;
                text-align: center;
            }
            .awc-graph-stats div span {
                display: block;
                color: #c9d1d9;
                font-size: 13px;
                font-weight: 600;
                margin-top: 2px;
            }
            
            /* RECOIL PATTERN */
            .awc-recoil-area {
                height: 150px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .awc-recoil-grid {
                width: 120px;
                height: 120px;
                border: 1px solid #444;
                position: relative;
                background: linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px);
                background-size: 20px 20px;
            }
            .awc-recoil-dot {
                position: absolute;
                width: 4px;
                height: 4px;
                background: #3fb950;
                border-radius: 50%;
            }
            .awc-recoil-figure {
                width: 100px;
                height: 120px;
                background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path fill="%23444" d="M50 10 A10 10 0 1 0 50 30 A10 10 0 1 0 50 10 Z M30 40 L70 40 L80 80 L60 80 L60 120 L40 120 L40 80 L20 80 Z"/></svg>') no-repeat center;
            }

            /* ADDITIONAL INFO */
            .awc-info-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .awc-info-list li {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                margin-bottom: 8px;
            }
            .awc-info-list li span:first-child { color: #8b949e; }
            .awc-info-list li span:last-child { color: #c9d1d9; font-weight: 500; }

            /* FOOTER */
            .awc-footer {
                height: 60px;
                background: rgba(0, 0, 0, 0.6);
                border-top: 1px solid #444;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 20px;
            }
            .awc-btn {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid #555;
                color: #c9d1d9;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                transition: all 0.2s;
            }
            .awc-btn:hover { background: #21262d; }
            .awc-btn-primary {
                background: #238636;
                border: 1px solid rgba(240,246,252,0.1);
                color: #fff;
            }
            .awc-btn-primary:hover { background: #2ea043; }
        `;
        document.head.appendChild(style);

        this.container.innerHTML = `
            <div class="awc-window">
                <div class="awc-header">
                    <button class="awc-back-btn" id="awc-close-btn">&larr;</button>
                    <div class="awc-title">PROPIEDADES DEL ARMA</div>
                </div>
                
                <div class="awc-body">
                    <!-- SIDEBAR -->
                    <div class="awc-sidebar">
                        <div class="awc-tab active" data-tab="ALL">
                            <div class="awc-tab-title">GENERAL</div>
                            <div class="awc-tab-subtitle">Todas las propiedades</div>
                        </div>
                        <div class="awc-tab" data-tab="ESTADÍSTICAS BÁSICAS">
                            <div class="awc-tab-title">ESTADÍSTICAS BÁSICAS</div>
                            <div class="awc-tab-subtitle">Daño y Uso</div>
                        </div>
                        <div class="awc-tab" data-tab="DISPARO">
                            <div class="awc-tab-title">DISPARO</div>
                            <div class="awc-tab-subtitle">Comportamiento del tiro</div>
                        </div>
                        <div class="awc-tab" data-tab="PROYECTIL">
                            <div class="awc-tab-title">PROYECTIL</div>
                            <div class="awc-tab-subtitle">Configuración de la bala</div>
                        </div>
                        <div class="awc-tab" data-tab="RETROCESO">
                            <div class="awc-tab-title">RETROCESO</div>
                            <div class="awc-tab-subtitle">Control y patrón</div>
                        </div>
                        <div class="awc-tab" data-tab="EFECTOS">
                            <div class="awc-tab-title">EFECTOS</div>
                            <div class="awc-tab-subtitle">Humo, impacto y VFX</div>
                        </div>
                        <div class="awc-tab" data-tab="MOVIMIENTO">
                            <div class="awc-tab-title">MOVIMIENTO</div>
                            <div class="awc-tab-subtitle">Impulso y empuje</div>
                        </div>
                    </div>

                    <!-- PROPERTIES -->
                    <div class="awc-properties" id="awc-properties-container">
                        <!-- Generado dinámicamente -->
                    </div>

                    <!-- PREVIEW -->
                    <div class="awc-preview-col">
                        <div class="awc-preview-tabs">
                            <div class="awc-preview-tab active">VISTA PREVIA</div>
                            <div class="awc-preview-tab">EFECTOS ACTIVOS</div>
                            <div class="awc-preview-tab">PRUEBAS</div>
                        </div>
                        
                        <div class="awc-3d-view" id="awc-3d-container">
                            <div class="awc-3d-placeholder">Canvas 3D de Previsualización</div>
                        </div>

                        <div class="awc-effect-toggles">
                            <div class="awc-effect-toggles-title">VISTA PREVIA DE EFECTOS</div>
                            <div class="awc-toggles-container">
                                <label class="awc-toggle"><input type="checkbox" checked> Estela de Humo</label>
                                <label class="awc-toggle"><input type="checkbox" checked> Trayectoria (Roja)</label>
                                <label class="awc-toggle"><input type="checkbox" checked> Impacto (Humo)</label>
                                <label class="awc-toggle"><input type="checkbox" checked> Estela VFX</label>
                                <label class="awc-toggle"><input type="checkbox" checked> Efecto de Impacto</label>
                            </div>
                        </div>

                        <div class="awc-effect-toggles-title" style="margin-top: 15px;">EFECTOS EN VISTA PREVIA</div>
                        <div class="awc-effect-previews">
                            <div class="awc-effect-card">
                                <div class="awc-effect-tag">DISPARO</div>
                                <span style="color:#444;">[Animación de Disparo]</span>
                            </div>
                            <div class="awc-effect-card">
                                <div class="awc-effect-tag">IMPACTO</div>
                                <span style="color:#444;">[Animación de Impacto]</span>
                            </div>
                        </div>
                    </div>

                    <!-- GRAPHS -->
                    <div class="awc-graphs">
                        <!-- TRAYECTORIA -->
                        <div class="awc-graph-card">
                            <div class="awc-graph-header">
                                <span class="awc-graph-title">TRAYECTORIA DE LA BALA</span>
                                <span style="font-size:11px; color:#8b949e;">Gravedad (Caída) <input type="text" id="awc-graph-drop" value="1" readonly style="width:30px; background:rgba(0,0,0,0.5); border:1px solid #444; color:#fff; text-align:center; margin-left:5px;"></span>
                            </div>
                            <div class="awc-graph-area">
                                <div class="awc-curve" id="awc-curve-container"></div>
                                <div style="position:absolute; bottom:-15px; left:0; width:100%; display:flex; justify-content:space-between; font-size:9px; color:#8b949e;">
                                    <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span>
                                </div>
                                <div style="position:absolute; top:0; left:-15px; height:100%; display:flex; flex-direction:column; justify-content:space-between; font-size:9px; color:#8b949e;">
                                    <span>10</span><span>5</span><span>0</span><span>-5</span><span>-10</span>
                                </div>
                            </div>
                            <div class="awc-graph-stats">
                                <div>Alcance Máximo<br><span>200 m</span></div>
                                <div>Tiempo de Vuelo<br><span>2.45 s</span></div>
                                <div>Caída en 100m<br><span>-2.35 m</span></div>
                            </div>
                        </div>

                        <!-- RETROCESO -->
                        <div class="awc-graph-card">
                            <div class="awc-graph-header">
                                <span class="awc-graph-title">PATRÓN DE RETROCESO</span>
                            </div>
                            <div class="awc-recoil-area">
                                <div class="awc-recoil-grid" id="awc-recoil-grid">
                                    <!-- Dots generated by JS -->
                                </div>
                                <div class="awc-recoil-figure"></div>
                            </div>
                        </div>

                        <!-- INFO -->
                        <div class="awc-graph-card" style="border:none; padding:0; background:transparent;">
                            <div class="awc-graph-title" style="margin-bottom:10px;">INFORMACIÓN ADICIONAL</div>
                            <ul class="awc-info-list">
                                <li><span>Tipo de Arma</span><span id="awc-info-type">Pistola</span></li>
                                <li><span>Calibre</span><span>9mm</span></li>
                                <li><span>Peso</span><span>1.2 kg</span></li>
                                <li><span>Longitud</span><span>220 mm</span></li>
                                <li><span>Estado</span><span>Personalizado</span></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="awc-footer">
                    <div>
                        <button class="awc-btn" id="awc-reset-btn" style="margin-right:10px;">RESTABLECER</button>
                        <button class="awc-btn" id="awc-equip-btn" style="margin-right:10px;">EQUIPAR</button>
                        <button class="awc-btn" id="awc-drop-btn" style="margin-right:10px;">DROPEAR</button>
                    </div>
                    <button class="awc-btn awc-btn-primary" id="awc-save-btn">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Bind events
        this.container.querySelector('#awc-close-btn').onclick = () => this.hide();
        this.container.querySelector('#awc-save-btn').onclick = () => {
            // Already synced on input change, just close
            this.hide();
        };

        this.container.querySelector('#awc-reset-btn').onclick = () => {
            if (this.weapon && this.weapon.originalConfig) {
                const draft = new this.weapon.constructor(this.weapon.originalConfig);
                this.weapon = draft;
                this.populateProperties();
                this.drawTrajectory();
                this.init3DPreview();
                if (this.game && this.game.uiManager && this.game.uiManager.constructionMenu) {
                    this.game.uiManager.constructionMenu.currentDraftItem = draft;
                    this.game.uiManager.constructionMenu.selectItem(draft);
                }
            }
        };

        this.container.querySelector('#awc-equip-btn').onclick = () => {
            if (this.game && this.game.inventoryManager) {
                const draftConfig = Object.assign({}, this.weapon.originalConfig, this.weapon);
                delete draftConfig.model; delete draftConfig.equipGroup; delete draftConfig.transformGroup; delete draftConfig.mixer; delete draftConfig.actionShoot; delete draftConfig.actionReload; delete draftConfig.blasterSystem;
                const newWeapon = new this.weapon.constructor(draftConfig);
                this.game.inventoryManager.addItem(newWeapon);
            }
        };

        this.container.querySelector('#awc-drop-btn').onclick = () => {
            if (this.game && this.game.itemDropManager && this.game.character) {
                const draftConfig = Object.assign({}, this.weapon.originalConfig, this.weapon);
                delete draftConfig.model; delete draftConfig.equipGroup; delete draftConfig.transformGroup; delete draftConfig.mixer; delete draftConfig.actionShoot; delete draftConfig.actionReload; delete draftConfig.blasterSystem;
                const newWeapon = new this.weapon.constructor(draftConfig);
                
                const pos = this.game.character.getPosition().clone();
                const dir = new THREE.Vector3();
                if (this.game.sceneManager && this.game.sceneManager.camera) {
                    this.game.sceneManager.camera.getWorldDirection(dir);
                } else if (this.game.cameraController && this.game.cameraController.camera) {
                    this.game.cameraController.camera.getWorldDirection(dir);
                }
                pos.add(dir.clone().multiplyScalar(1.5));
                pos.y += 1.5;
                
                const dropped = this.game.itemDropManager.dropItem(newWeapon, pos, dir);
                
                if (this.game.networkManager && this.game.networkManager.isConnected) {
                    let itemData = Object.assign({}, newWeapon);
                    itemData.itemClass = newWeapon.constructor.name;
                    delete itemData.model; delete itemData.equipGroup; delete itemData.transformGroup; delete itemData.mixer; delete itemData.actionShoot; delete itemData.actionReload; delete itemData.blasterSystem; delete itemData.originalConfig;
                    
                    this.game.networkManager.sendPlayerAction("dropItem", {
                        dropId: dropped.dropId,
                        itemData: itemData,
                        position: { x: pos.x, y: pos.y, z: pos.z },
                        direction: { x: dir.x, y: dir.y, z: dir.z },
                        torque: dropped.torque
                    });
                }
            }
        };

        const tabs = this.container.querySelectorAll('.awc-tab');
        tabs.forEach(tab => {
            tab.onclick = (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this.populateProperties();
            };
        });

        this.currentTab = 'ALL';
        this.generateRecoilPattern();

        // Wait a small moment to ensure container is rendered and sized before init3D
        setTimeout(() => this.init3DPreview(), 50);
    }

    init3DPreview() {
        const container = this.container.querySelector('#awc-3d-container');
        if (!container) return;

        if (this.renderer) {
            if (this.weapon) this.loadModelPreview();
            return;
        }

        // Limpiar el placeholder
        container.innerHTML = '';

        this.scene = new THREE.Scene();

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        // Grid base
        const grid = new THREE.GridHelper(5, 20, 0x58a6ff, 0x444444);
        grid.position.y = -0.3;
        this.scene.add(grid);

        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.001, 1000);
        this.camera.position.set(2, 1, 2);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.previewGroup = new THREE.Group();
        this.scene.add(this.previewGroup);

        // Resize Observer para que el canvas se adapte si cambia el tamaño
        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const w = entry.contentRect.width;
                const h = entry.contentRect.height;
                if (w > 0 && h > 0) {
                    this.renderer.setSize(w, h);
                    this.camera.aspect = w / h;
                    this.camera.updateProjectionMatrix();
                }
            }
        });
        this.resizeObserver.observe(container);

        this.loader = new GLTFLoader();
        this.currentPreviewModel = null;
        this.isDragging = false;

        this.targetRotation = { x: 0, y: 0 };
        this.currentRotation = { x: 0, y: 0 };
        this.previousMousePosition = { x: 0, y: 0 };

        const animate = () => {
            if (this.container.style.display !== 'none') {
                // Rotación suave del modelo si no lo están agarrando
                if (this.currentPreviewModel) {
                    if (!this.isDragging) {
                        this.targetRotation.y -= 0.005;
                    }

                    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.1;
                    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.1;

                    this.previewGroup.rotation.x = this.currentRotation.x;
                    this.previewGroup.rotation.y = this.currentRotation.y;
                }

                this.renderer.render(this.scene, this.camera);
            }
            this.animationFrameId = requestAnimationFrame(animate);
        };

        // Controles manuales para rotar o mover (pan) el arma
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.currentPreviewModel) {
                const deltaX = e.clientX - this.previousMousePosition.x;
                const deltaY = e.clientY - this.previousMousePosition.y;

                if (e.shiftKey) {
                    // Pan (Mover arma)
                    const panSpeed = this.baseZoomZ ? this.baseZoomZ * 0.002 : 0.005;
                    let newX = this.previewGroup.position.x + deltaX * panSpeed;
                    let newY = this.previewGroup.position.y - deltaY * panSpeed;

                    // Limitar el paneo para que no se pierda el arma
                    const maxPan = this.baseZoomZ ? this.baseZoomZ * 0.8 : 2.0;
                    this.previewGroup.position.x = Math.max(-maxPan, Math.min(maxPan, newX));
                    this.previewGroup.position.y = Math.max(-maxPan, Math.min(maxPan, newY));
                } else {
                    // Rotar
                    this.targetRotation.y += deltaX * 0.01;
                    this.targetRotation.x += deltaY * 0.01;

                    // Limitar rotación arriba/abajo
                    this.targetRotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.targetRotation.x));
                }

                this.previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Zoom con Shift + rueda del ratón
        this.renderer.domElement.addEventListener('wheel', (e) => {
            if (!e.shiftKey) return; // Requerir shift para no interferir con el scroll de la página/menú
            e.preventDefault();
            if (!this.baseZoomDist) return;

            const zoomSpeed = this.baseZoomDist * 0.05;

            // Obtener la distancia actual de la cámara al centro (0,0,0)
            let dist = this.camera.position.length();

            // En Mac, presionar Shift + Rueda convierte el scroll vertical (deltaY) en horizontal (deltaX)
            const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (delta === 0) return;

            // Modificar la distancia
            if (delta > 0) {
                dist += zoomSpeed; // Alejar
            } else {
                dist -= zoomSpeed; // Acercar
            }

            // Límite: minZ permite acercarse, maxZ es el punto inicial (no se puede alejar más de ahí)
            const minZ = this.baseZoomDist * 0.3;
            const maxZ = this.baseZoomDist;

            dist = Math.max(minZ, Math.min(maxZ, dist));

            // Aplicar la nueva distancia manteniendo el ángulo
            this.camera.position.setLength(dist);
            this.camera.lookAt(0, 0, 0);
        }, { passive: false });

        animate();

        if (this.weapon) {
            this.loadModelPreview();
        }
    }

    loadModelPreview() {
        if (!this.weapon || !this.scene) return;

        // Remover modelo anterior si existe
        if (this.currentPreviewModel) {
            this.previewGroup.remove(this.currentPreviewModel);
            this.currentPreviewModel = null;
        }

        const setupModel = (modelNode) => {
            this.currentPreviewModel = SkeletonUtils.clone(modelNode);

            // La escala ya viene ajustada si tomamos el modelo procesado de GunItem
            // pero nos aseguramos de quitar cualquier rotación de inventario.
            this.currentPreviewModel.rotation.set(0, 0, 0);
            this.currentPreviewModel.position.set(0, 0, 0);
            this.currentPreviewModel.updateMatrixWorld(true);

            // Centrar modelo basado en su geometría
            const box = new THREE.Box3().setFromObject(this.currentPreviewModel);
            const center = box.getCenter(new THREE.Vector3());
            this.currentPreviewModel.position.x -= center.x;
            this.currentPreviewModel.position.y -= center.y;
            this.currentPreviewModel.position.z -= center.z;

            this.previewGroup.add(this.currentPreviewModel);

            // Restablecer posiciones y rotaciones interactuables
            this.targetRotation = { x: 0, y: 0 };
            this.currentRotation = { x: 0, y: 0 };
            this.previewGroup.rotation.set(0, 0, 0);
            this.previewGroup.position.set(0, 0, 0);

            // Ajustar cámara basado en el tamaño (posición cómoda original)
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Posición inicial 
            this.camera.position.set(maxDim * 0.8, maxDim * 0.4, maxDim * 1.2);
            this.camera.lookAt(0, 0, 0);

            // Guardar esta distancia inicial como el límite de alejamiento (maxZ)
            this.baseZoomDist = this.camera.position.length();
        };

        // En lugar de cargar el raw GLTF (que no tiene los materiales custom de colores),
        // tomamos directamente el modelo cargado y pintado que GunItem ya procesó.
        if (this.weapon.model) {
            setupModel(this.weapon.model);
        } else if (this.weapon.modelPath) {
            // Fallback en caso de que por alguna razón no se haya instanciado
            this.loader.load(this.weapon.modelPath, (gltf) => {
                const scale = this.weapon.modelScale !== undefined ? this.weapon.modelScale : 1;
                gltf.scene.scale.set(scale, scale, scale);
                setupModel(gltf.scene);
            });
        }
    }

    generateRecoilPattern() {
        const grid = this.container.querySelector('#awc-recoil-grid');
        grid.innerHTML = '';
        // Mock pattern
        for (let i = 0; i < 15; i++) {
            const dot = document.createElement('div');
            dot.className = 'awc-recoil-dot';
            const x = 50 + (Math.random() * 20 - 10);
            const y = 80 - (i * 4); // goes up
            dot.style.left = x + '%';
            dot.style.top = y + '%';
            grid.appendChild(dot);
        }
    }

    populateProperties() {
        if (!this.weapon) return;

        const propContainer = this.container.querySelector('#awc-properties-container');
        propContainer.innerHTML = '';

        let currentSectionEl = null;

        const createSection = (title) => {
            if (this.currentTab !== 'ALL' && this.currentTab !== title) return false;

            const sec = document.createElement('div');
            sec.className = 'awc-section-title';
            sec.textContent = title;
            propContainer.appendChild(sec);
            currentSectionEl = sec;
            return true;
        };

        const createInput = (label, type, value, key) => {
            if (!currentSectionEl) return; // Skip if section is filtered out

            const row = document.createElement('div');
            row.className = 'awc-prop-row';

            const lbl = document.createElement('span');
            lbl.className = 'awc-prop-label';
            lbl.textContent = label;

            let input;
            if (type === 'select' || Array.isArray(type)) {
                input = document.createElement('select');
                input.className = 'awc-prop-value';
                const options = Array.isArray(type) ? type : ['Opción 1', 'Opción 2'];
                options.forEach(opt => {
                    const o = document.createElement('option');
                    if (typeof opt === 'object' && opt !== null) {
                        o.value = opt.value;
                        o.textContent = opt.text;
                    } else {
                        o.value = opt;
                        o.textContent = opt;
                    }
                    input.appendChild(o);
                });
                input.value = value;
            } else {
                input = document.createElement('input');
                input.type = type;
                input.className = 'awc-prop-value';
                if (type === 'checkbox') input.checked = value;
                else input.value = value;
            }

            input.dataset.key = key;

            // Instantly sync value
            input.addEventListener('change', (e) => {
                let newVal = e.target.type === 'checkbox' ? e.target.checked :
                    e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                this.weapon[key] = newVal;
                this.syncToOriginalMenu(key, newVal);
                if (key === 'bulletDrop' || key === 'shotSpeed') this.drawTrajectory();
            });

            row.appendChild(lbl);
            row.appendChild(input);
            propContainer.appendChild(row);
        };

        // ESTADÍSTICAS BÁSICAS
        if (createSection('ESTADÍSTICAS BÁSICAS')) {
            createInput('Daño', 'number', this.weapon.damage !== undefined ? this.weapon.damage : 15, 'damage');
            createInput('Tiempo de Recarga (s)', 'number', this.weapon.cooldown !== undefined ? this.weapon.cooldown : 0.2, 'cooldown');
            createInput('Mano Equipada', [
                { value: 'right', text: 'Derecha' },
                { value: 'left', text: 'Izquierda' }
            ], this.weapon.equippedHand || 'right', 'equippedHand');
            createInput('Nivel de Mira (Scope)', [
                { value: 1, text: 'Ninguno (1x)' },
                { value: 2, text: 'Mira Corta (x2)' },
                { value: 4, text: 'Mira Media (x4)' },
                { value: 5, text: 'Mira Media-Alta (x5)' },
                { value: 8, text: 'Mira Larga (x8)' },
                { value: 10, text: 'Mira Francotirador (x10)' },
                { value: 16, text: 'Mira Avanzada (x16)' }
            ], this.weapon.maxScope !== undefined ? this.weapon.maxScope : 1, 'maxScope');
        }

        // DISPARO
        if (createSection('DISPARO')) {
            createInput('Modo de Disparo', [
                { value: 'hybrid', text: 'Híbrido' },
                { value: 'recenter', text: 'Auto-Centrado' },
                { value: 'manual', text: 'Manual' }
            ], this.weapon.recoilMode || 'hybrid', 'recoilMode');
            createInput('Automático', 'checkbox', this.weapon.isAuto !== undefined ? this.weapon.isAuto : false, 'isAuto');
            createInput('Velocidad de Disparo', 'number', this.weapon.shotSpeed !== undefined ? this.weapon.shotSpeed : 50, 'shotSpeed');
        }

        // PROYECTIL
        if (createSection('PROYECTIL')) {
            createInput('Tipo de Proyectil', [
                { value: 'bullet', text: 'Bala' },
                { value: 'ball', text: 'Pelota' }
            ], this.weapon.projectileType || 'bullet', 'projectileType');
            createInput('Gravedad (Caída)', 'number', this.weapon.bulletDrop !== undefined ? this.weapon.bulletDrop : 1, 'bulletDrop');
            createInput('Estela de Humo', 'checkbox', this.weapon.hasTracer !== undefined ? this.weapon.hasTracer : false, 'hasTracer');
            createInput('Línea de Trayectoria (Roja)', 'checkbox', this.weapon.hasTrajectoryLine !== undefined ? this.weapon.hasTrajectoryLine : false, 'hasTrajectoryLine');
            createInput('Rebote al chocar', 'checkbox', this.weapon.rebote !== undefined ? this.weapon.rebote : false, 'rebote');
        }

        // EFECTOS
        if (createSection('EFECTOS')) {
            createInput('Impacto (Humo)', 'checkbox', this.weapon.hasImpactEffect !== undefined ? this.weapon.hasImpactEffect : false, 'hasImpactEffect');
            createInput('Estela Especial VFX', ['Ninguno', 'Bubble Explosion', 'Cartoon Bang', 'Cartoon Blue Flamethrower', 'Dollar Bill Shower', 'Cartoon Lightning Ball', 'Cartoon Blood Splash', 'Cartoon Fireball Explosion', 'Cartoon Purple Lightning', 'Explosión de Gas Azul'], this.weapon.customTracerVFX || 'Ninguno', 'customTracerVFX');
            createInput('Efecto de Impacto VFX', ['Ninguno', 'Bubble Explosion', 'Cartoon Bang', 'Dollar Bill Shower', 'Cartoon Blood Splash', 'Cartoon Fireball Explosion', 'Cartoon Purple Lightning', 'Explosión de Gas Azul'], this.weapon.customImpactVFX || 'Ninguno', 'customImpactVFX');
            createInput('Eliminar al Colisionar', 'checkbox', this.weapon.tracerDestroyOnCollision !== undefined ? this.weapon.tracerDestroyOnCollision : false, 'tracerDestroyOnCollision');
            createInput('Efecto VFX al Colisionar', ['Ninguno', 'Bubble Explosion', 'Cartoon Bang', 'Dollar Bill Shower', 'Cartoon Blood Splash', 'Cartoon Fireball Explosion', 'Cartoon Purple Lightning', 'Explosión de Gas Azul'], this.weapon.tracerCollisionVFX || 'Ninguno', 'tracerCollisionVFX');
        }

        // RETROCESO
        if (createSection('RETROCESO')) {
            createInput('Retroceso', 'number', this.weapon.recoil !== undefined ? this.weapon.recoil : 4, 'recoil');
        }

        // MOVIMIENTO
        if (createSection('MOVIMIENTO')) {
            createInput('Habilitar Salto Cohete', 'checkbox', this.weapon.hasPlayerImpulseUp !== undefined ? this.weapon.hasPlayerImpulseUp : false, 'hasPlayerImpulseUp');
            createInput('Fuerza Salto Cohete', 'number', this.weapon.playerImpulseUpForce !== undefined ? this.weapon.playerImpulseUpForce : 15, 'playerImpulseUpForce');
            createInput('Reducción en el Aire (%)', 'number', this.weapon.playerImpulseUpAirReduction !== undefined ? this.weapon.playerImpulseUpAirReduction : 50, 'playerImpulseUpAirReduction');
            createInput('Habilitar Empuje Atrás (Frente)', 'checkbox', this.weapon.hasPlayerImpulseBack !== undefined ? this.weapon.hasPlayerImpulseBack : false, 'hasPlayerImpulseBack');
            createInput('Fuerza Empuje Atrás', 'number', this.weapon.playerImpulseBackForce !== undefined ? this.weapon.playerImpulseBackForce : 5, 'playerImpulseBackForce');
        }

        currentSectionEl = null; // reset
    }

    syncToOriginalMenu(key, value) {
        if (!this.game || !this.game.uiManager || !this.game.uiManager.constructionMenu) return;
        const cm = this.game.uiManager.constructionMenu;

        const map = {
            'damage': cm.damageInput, 'cooldown': cm.cooldownInput,
            'equippedHand': cm.handSelect, 'maxScope': cm.maxScopeSelect,
            'recoilMode': cm.recoilModeSelect,
            'isAuto': cm.autoInput, 'projectileType': cm.projectileTypeSelect,
            'shotSpeed': cm.speedInput, 'bulletDrop': cm.dropInput,
            'hasTracer': cm.tracerInput, 'hasTrajectoryLine': cm.trajectoryInput,
            'rebote': cm.reboteInput, 'hasImpactEffect': cm.impactInput,
            'customTracerVFX': cm.customTracerSelect, 'customImpactVFX': cm.customImpactSelect,
            'recoil': cm.recoilInput, 'tracerDestroyOnCollision': cm.tracerDestroyInput,
            'tracerCollisionVFX': cm.tracerCollisionSelect,
            'hasPlayerImpulseUp': cm.playerImpulseUpInput, 'playerImpulseUpForce': cm.playerImpulseUpForceInput,
            'playerImpulseUpAirReduction': cm.playerImpulseUpAirRedInput,
            'hasPlayerImpulseBack': cm.playerImpulseBackInput, 'playerImpulseBackForce': cm.playerImpulseBackForceInput
        };

        const input = map[key];
        if (input) {
            if (input.type === 'checkbox') input.checked = value;
            else input.value = value;
        }
    }

    drawTrajectory() {
        const dropInput = this.container.querySelector('#awc-graph-drop');
        const curveContainer = this.container.querySelector('#awc-curve-container');
        if (!curveContainer) return;

        let drop = this.weapon.bulletDrop !== undefined ? this.weapon.bulletDrop : 1;
        if (dropInput) dropInput.value = drop;

        let speed = this.weapon.shotSpeed !== undefined ? this.weapon.shotSpeed : 50;
        if (speed <= 0) speed = 1;

        // y = -0.5 * (drop * 9.8) * (x/speed)^2
        // We will map x from 0 to 200m
        // Container SVG is 100% x 100%. Height goes from 0 (top) to 150px approx.
        // We want origin (0,0) at left-middle (top: 20px). Let's use relative coordinates.
        // Let's create an SVG
        let pathData = "M 0 20 "; // Start at x=0, y=20px (offset)
        const g = drop * 9.8;

        for (let x = 0; x <= 200; x += 10) {
            let t = x / speed;
            let y_m = -0.5 * g * t * t; // negative means down in world, but SVG y goes DOWN, so it's positive
            let svgX = (x / 200) * 100; // 0 to 100
            // y_m drops up to e.g. -20m. We map 20m drop to 130px.
            // Let's say 20m drop is full height. 
            let pixelY = 20 + (-y_m * 10); // scale 1m = 10px down
            pathData += `L ${svgX} ${pixelY} `;
        }

        curveContainer.innerHTML = `
            <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 150">
                <path d="${pathData}" fill="none" stroke="#f85149" stroke-width="2" />
            </svg>
        `;
    }

    // Removed saveProperties since we instantly sync

    show(weaponDraft) {
        this.weapon = weaponDraft;
        this.populateProperties();
        this.drawTrajectory();

        if (this.scene) {
            this.loadModelPreview();
        }

        // Update info panel
        if (this.weapon && this.weapon.name) {
            this.container.querySelector('#awc-info-type').textContent = this.weapon.name;
        }

        this.container.style.display = 'flex';
    }

    hide() {
        this.container.style.display = 'none';
    }
}

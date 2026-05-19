// @ts-nocheck

import { UIPositionSelector } from "./UIPositionSelector"

export class GameConfigPanel {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null
        this.positionSelector = new UIPositionSelector()

        // Register itself for callbacks
        this.logicSystem.configPanel = this

        // Ensure LogicSystem has Config Data
        if (!this.logicSystem.gameConfig) {
            this.logicSystem.gameConfig = {
                sequences: [], // [{ type: 'emit_signal', signal: 'start' }, { type: 'time', duration: 10 }]
                serverSettings: {
                    matchName: "Mi Partida",
                    maxPlayers: 10,
                    lobbyMode: false,
                    allowLateJoin: true,
                    defaultSpawn: "auto",
                    globalGravity: 9.8
                }
            }
        } else if (!this.logicSystem.gameConfig.serverSettings) {
             this.logicSystem.gameConfig.serverSettings = {
                matchName: "Mi Partida",
                maxPlayers: 10,
                lobbyMode: false,
                allowLateJoin: true,
                defaultSpawn: "auto",
                globalGravity: 9.8
             }
        }
    }

    syncConfig() {
        if (this.game && this.game.networkManager && typeof this.game.networkManager.sendGameConfigUpdate === 'function') {
            this.game.networkManager.sendGameConfigUpdate(this.logicSystem.gameConfig)
        }
    }

    getReadablePosition(pos) {
        if (!pos) return "Top Center"
        switch (pos) {
            case 'top-left': return "↖ Arriba Izq"
            case 'top-center': return "⬆ Arriba Centro"
            case 'top-right': return "↗ Arriba Der"
            case 'middle-left': return "⬅ Medio Izq"
            case 'center': return "● Centro"
            case 'middle-right': return "➡ Medio Der"
            case 'bottom-left': return "↙ Abajo Izq"
            case 'bottom-center': return "⬇ Abajo Centro"
            case 'bottom-right': return "↘ Abajo Der"
            default: return pos
        }
    }
    createUI(parentContainer) {
        this.container = document.createElement('div')
        this.container.style.cssText = `
            width: 100%; height: 100%;
            display: flex; flex-direction: column; gap: 10px;
            position: relative;
        `

        // Inject Styles for Scrollbar
        const style = document.createElement('style')
        style.innerHTML = `
            .game-config-scroll::-webkit-scrollbar { width: 8px; }
            .game-config-scroll::-webkit-scrollbar-track { background: #111; border-radius: 4px; }
            .game-config-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
            .game-config-scroll::-webkit-scrollbar-thumb:hover { background: #666; }
            .active-logic-block { 
                border: 2px solid #00FFFF !important; 
                box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                transition: all 0.2s;
            }
        `
        this.container.appendChild(style)

        // Header
        const header = document.createElement('div')
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px;"

        const title = document.createElement('h3')
        title.textContent = "Configuración de Partida"
        title.style.margin = "0"
        header.appendChild(title)

        // Clear Button
        const clearBtn = document.createElement('button')
        clearBtn.textContent = "Limpiar Todo"
        clearBtn.style.cssText = "background: #622; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
        clearBtn.onclick = () => {
            if (confirm("¿Borrar toda la configuración de la partida?")) {
                this.logicSystem.gameConfig.sequences = []
                this.syncConfig()
                this.render()
            }
        }
        header.appendChild(clearBtn)
        this.container.appendChild(header)

        // Tabs
        const tabContainer = document.createElement('div')
        tabContainer.style.cssText = "display: flex; gap: 20px; border-bottom: 2px solid #444; margin-bottom: 10px; padding-bottom: 5px; margin-top: 5px;"
        
        const tabSeq = document.createElement('button')
        tabSeq.textContent = "Secuencias Lógicas"
        tabSeq.style.cssText = "background: none; border: none; color: white; font-weight: bold; font-size: 16px; cursor: pointer; border-bottom: 2px solid white; padding: 5px;"
        
        const tabServer = document.createElement('button')
        tabServer.textContent = "Ajustes de Servidor"
        tabServer.style.cssText = "background: none; border: none; color: #888; font-size: 16px; cursor: pointer; padding: 5px;"
        
        tabContainer.appendChild(tabSeq)
        tabContainer.appendChild(tabServer)
        this.container.appendChild(tabContainer)

        // Content Containers
        this.contentSequences = document.createElement('div')
        this.contentSequences.style.cssText = "display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;"

        this.contentServerSettings = document.createElement('div')
        this.contentServerSettings.style.cssText = "display: none; flex-direction: column; gap: 15px; flex: 1; overflow-y: auto; padding: 10px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333;"
        
        this.container.appendChild(this.contentSequences)
        this.container.appendChild(this.contentServerSettings)

        // Tab Switching Logic
        tabSeq.onclick = () => {
            tabSeq.style.color = "white"; tabSeq.style.fontWeight = "bold"; tabSeq.style.borderBottom = "2px solid white";
            tabServer.style.color = "#888"; tabServer.style.fontWeight = "normal"; tabServer.style.borderBottom = "none";
            this.contentSequences.style.display = "flex";
            this.contentServerSettings.style.display = "none";
        }
        tabServer.onclick = () => {
            tabServer.style.color = "white"; tabServer.style.fontWeight = "bold"; tabServer.style.borderBottom = "2px solid white";
            tabSeq.style.color = "#888"; tabSeq.style.fontWeight = "normal"; tabSeq.style.borderBottom = "none";
            this.contentSequences.style.display = "none";
            this.contentServerSettings.style.display = "flex";
            this.renderServerSettings();
        }

        // Toolbar (Add Blocks)
        const toolbar = document.createElement('div')
        toolbar.style.cssText = "display: flex; gap: 10px; flex-wrap: wrap;"

        this.createAddBtn(toolbar, "+ Señal", "#00aa00", () => this.addBlock('emit_signal'))
        this.createAddBtn(toolbar, "+ Tiempo", "#4444ff", () => this.addBlock('time_wait'))
        // Loop and End are still useful structure blocks
        this.createAddBtn(toolbar, "+ Fin Partida", "#aa0000", () => this.addBlock('end_game'))
        this.createAddBtn(toolbar, "+ Loop (Reiniciar)", "#880088", () => this.addBlock('loop_game'))

        this.contentSequences.appendChild(toolbar)

        // Simulation Controls
        this.createSimulationControls(this.contentSequences)

        // Sequence List Area
        this.sequenceList = document.createElement('div')
        this.sequenceList.className = "game-config-scroll" // Apply scroll class
        this.sequenceList.style.cssText = `
            flex: 1; overflow-y: auto; 
            background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
            padding: 10px; display: flex; flex-direction: column; gap: 5px;
        `
        this.contentSequences.appendChild(this.sequenceList)

        parentContainer.appendChild(this.container)
        this.render()
        
        // Build the Server Settings UI initially
        this.buildServerSettingsUI()
    }

    buildServerSettingsUI() {
        this.serverSettingsControls = {}
        const container = this.contentServerSettings
        const settings = this.logicSystem.gameConfig.serverSettings

        const title = document.createElement('h4')
        title.textContent = "Ajustes del Servidor"
        title.style.margin = "0 0 10px 0"
        title.style.color = "#0ff"
        title.style.borderBottom = "1px solid #333"
        title.style.paddingBottom = "5px"
        container.appendChild(title)

        // Live Stats Panel (Auto-Updating)
        this.statsPanel = document.createElement('div')
        this.statsPanel.style.cssText = "font-size: 13px; margin-bottom: 10px; color: #ddd;"
        container.appendChild(this.statsPanel)

        // Auto-update stats every 1s if visible
        setInterval(() => {
            if (this.contentServerSettings && this.contentServerSettings.style.display !== "none") {
                this.renderServerSettings()
            }
        }, 1000)

        // Settings Fields
        this.createSettingInput(container, settings, 'matchName', "Nombre de la Partida", "text")
        
        this.renderMaxPlayersConfig(container, settings)

        this.createSettingInput(container, settings, 'lobbyMode', "Modo Sala (Esperar que se llene)", "boolean")
        this.createSettingInput(container, settings, 'allowLateJoin', "Permitir unión iniciada la partida (Late Join)", "boolean")
        
        // Default Spawn Custom Logic
        this.renderDefaultSpawnConfig(container, settings)
        
        this.createSettingInput(container, settings, 'globalGravity', "Gravedad Global", "number", { step: 0.1 })
    }

    renderDefaultSpawnConfig(container, settings) {
        const row = document.createElement('div')
        row.style.cssText = "display: flex; flex-direction: column; gap: 5px; background: #222; padding: 8px 12px; border-radius: 6px; border: 1px solid #444;"

        const topRow = document.createElement('div')
        topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;"

        const label = document.createElement('label')
        label.textContent = "Punto de Aparición Default (si no hay Spawns)"
        label.style.color = "#ccc"
        label.style.fontSize = "14px"
        label.style.flex = "1"

        const modeSelect = document.createElement('select')
        modeSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 5px; border-radius: 4px; min-width: 150px; max-width: 250px;"
        
        const modes = [
            { id: "auto", text: "Automático en cualquier parte del suelo" },
            { id: "origen", text: "Origen 0,0,0 (El Centro)" },
            { id: "personalizado", text: "Punto de Spawn Personalizado" }
        ]

        if (!settings.defaultSpawn || settings.defaultSpawn === "cielo") {
             settings.defaultSpawn = "auto"
        }

        modes.forEach(m => {
            const opt = document.createElement('option')
            opt.value = m.id
            opt.textContent = m.text
            if (settings.defaultSpawn === m.id) opt.selected = true
            modeSelect.appendChild(opt)
        })

        topRow.appendChild(label)
        topRow.appendChild(modeSelect)
        row.appendChild(topRow)

        // Custom config button (only for personalizado)
        const customContainer = document.createElement('div')
        customContainer.style.cssText = "display: flex; justify-content: center; align-items: center; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #555;"
        
        const spawnBtn = document.createElement('button')
        spawnBtn.textContent = "+ Colocar Objeto Spawnpoint Default"
        spawnBtn.style.cssText = "background: #33a; border: 1px solid #55f; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; width: 100%; font-weight: bold;"
        
        spawnBtn.onclick = () => {
            if (this.game && this.game.sceneManager && this.game.constructionMenu && this.game.constructionMenu.logicItems) {
                const spawnItemTemplate = this.game.constructionMenu.logicItems.find(i => i.type === 'spawn_point')
                if (spawnItemTemplate) {
                    try {
                        let clonePos;
                        if (this.game.character && this.game.character.getPosition) {
                            clonePos = this.game.character.getPosition().clone()
                            clonePos.y += 0.05 // Adjust above ground slightly
                        } else if (this.game.cameraController && this.game.cameraController.camera) {
                            clonePos = this.game.cameraController.camera.position.clone()
                            clonePos.y = Math.max(0.05, clonePos.y - 1.5) // Approximate feet
                        } else {
                            clonePos = { x: 0, y: 0.05, z: 0 } 
                        }

                        // Temporarily mark the template so the spawned object gets flag
                        const originalLogic = { ...(spawnItemTemplate.logicProperties || {}) }
                        if (!spawnItemTemplate.logicProperties) spawnItemTemplate.logicProperties = {}
                        spawnItemTemplate.logicProperties.isDefault = true

                        spawnItemTemplate.spawnObject(
                            this.game.sceneManager.scene,
                            this.game.sceneManager.world,
                            clonePos,
                            0
                        )

                        // Restore template to not affect other spawn placements
                        spawnItemTemplate.logicProperties = originalLogic

                        this.syncConfig()
                        this.renderServerSettings()
                        alert("Punto de Aparición Personalizado colocado con éxito a tus pies.\n\nCierra este panel (tecla E) y podrás seleccionarlo físicamente en el mapa para moverlo.")
                    } catch(e) {
                        console.error("Error creating spawn:", e)
                        alert("Hubo un error al colocar el Punto de Aparición.")
                    }
                } else {
                    alert("Error: No se encontró la plantilla de Spawn en la librería.")
                }
            }
        }
        
        customContainer.appendChild(spawnBtn)
        row.appendChild(customContainer)
        container.appendChild(row)

        const deleteDefaultSpawnObj = () => {
            if (!this.game || !this.game.sceneManager || !this.logicSystem) return
            const existings = this.logicSystem.scanScene(this.game.sceneManager.scene)
                .filter(o => o.userData.mapObjectType === 'spawn_point' && o.userData.logicProperties && o.userData.logicProperties.isDefault)
            
            existings.forEach(obj => {
                this.game.sceneManager.scene.remove(obj)
                obj.traverse(child => {
                    if (child.geometry) child.geometry.dispose()
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                        else child.material.dispose()
                    }
                })
                if (obj.userData.rigidBody) {
                    this.game.sceneManager.world.removeRigidBody(obj.userData.rigidBody)
                }
            })

            if (existings.length > 0) {
                this.syncConfig()
                this.renderServerSettings() // Update stats summary
            }
        }

        const updateUI = () => {
             customContainer.style.display = (settings.defaultSpawn === "personalizado") ? "flex" : "none"
        }

        modeSelect.onchange = (e) => {
            // Delete if changing AWAY from personalizado
            if (settings.defaultSpawn === "personalizado" && e.target.value !== "personalizado") {
                deleteDefaultSpawnObj()
            }
            settings.defaultSpawn = e.target.value
            this.syncConfig()
            updateUI()
        }

        updateUI() // Init
    }

    renderMaxPlayersConfig(container, settings) {
        const row = document.createElement('div')
        row.style.cssText = "display: flex; flex-direction: column; gap: 5px; background: #222; padding: 8px 12px; border-radius: 6px; border: 1px solid #444;"

        const topRow = document.createElement('div')
        topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;"

        const label = document.createElement('label')
        label.textContent = "Límite de Jugadores"
        label.style.color = "#ccc"
        label.style.fontSize = "14px"
        label.style.flex = "1"

        const modeSelect = document.createElement('select')
        modeSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 5px; border-radius: 4px; min-width: 150px;"
        
        const modes = [
            { id: "unlimited", text: "Sin límite" },
            { id: "manual", text: "Manual" },
            { id: "spawnpoints", text: "Según Spawnpoints" }
        ]

        if (!settings.maxPlayersMode) settings.maxPlayersMode = "unlimited"
        if (!settings.maxPlayersManualValue) settings.maxPlayersManualValue = 10

        modes.forEach(m => {
            const opt = document.createElement('option')
            opt.value = m.id
            opt.textContent = m.text
            if (settings.maxPlayersMode === m.id) opt.selected = true
            modeSelect.appendChild(opt)
        })

        topRow.appendChild(label)
        topRow.appendChild(modeSelect)
        row.appendChild(topRow)

        // Options sub-container for manual mode
        const manualContainer = document.createElement('div')
        manualContainer.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #555;"
        
        const manualLabel = document.createElement('label')
        manualLabel.textContent = "Cantidad Máxima:"
        manualLabel.style.color = "#aaa"
        manualLabel.style.fontSize = "12px"
        
        const manualInput = document.createElement('input')
        manualInput.type = "number"
        manualInput.min = 1
        manualInput.value = settings.maxPlayersManualValue
        manualInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 3px; border-radius: 4px; width: 60px; text-align: center;"
        
        manualContainer.appendChild(manualLabel)
        manualContainer.appendChild(manualInput)
        
        row.appendChild(manualContainer)
        container.appendChild(row)

        const updateUI = () => {
            if (settings.maxPlayersMode === "manual") {
                manualContainer.style.display = "flex"
                settings.maxPlayers = settings.maxPlayersManualValue // sync
            } else if (settings.maxPlayersMode === "unlimited") {
                manualContainer.style.display = "none"
                settings.maxPlayers = 0 // represents unlimited
            } else if (settings.maxPlayersMode === "spawnpoints") {
                manualContainer.style.display = "none"
                settings.maxPlayers = "auto_spawns" // token to specify server behavior
            }
        }

        modeSelect.onchange = (e) => {
            settings.maxPlayersMode = e.target.value
            this.syncConfig()
            updateUI()
        }

        manualInput.onchange = (e) => {
            const val = parseInt(e.target.value) || 1
            settings.maxPlayersManualValue = val
            if (settings.maxPlayersMode === "manual") {
                settings.maxPlayers = val
            }
            this.syncConfig()
        }

        updateUI() // Initialize visibility
    }

    createSettingInput(container, settingsObj, key, labelText, type, extraOptions = {}) {
        const row = document.createElement('div')
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #222; padding: 8px 12px; border-radius: 6px; border: 1px solid #444;"

        const label = document.createElement('label')
        label.textContent = labelText
        label.style.color = "#ccc"
        label.style.fontSize = "14px"
        label.style.flex = "1"

        row.appendChild(label)

        let input
        if (type === 'boolean') {
            input = document.createElement('input')
            input.type = "checkbox"
            input.checked = settingsObj[key]
            input.style.transform = "scale(1.2)"
            input.style.cursor = "pointer"
            input.onchange = (e) => { settingsObj[key] = e.target.checked; this.syncConfig() }
        } else if (type === 'select') {
            input = document.createElement('select')
            input.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 5px; border-radius: 4px; min-width: 120px;"
            extraOptions.forEach(opt => {
                const optEl = document.createElement('option')
                optEl.value = opt
                optEl.textContent = opt.charAt(0).toUpperCase() + opt.slice(1)
                if (settingsObj[key] === opt) optEl.selected = true
                input.appendChild(optEl)
            })
            input.onchange = (e) => { settingsObj[key] = e.target.value; this.syncConfig() }
        } else {
            input = document.createElement('input')
            input.type = type
            input.value = settingsObj[key]
            input.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 5px; border-radius: 4px; width: 150px;"
            if (extraOptions.min !== undefined) input.min = extraOptions.min
            if (extraOptions.max !== undefined) input.max = extraOptions.max
            if (extraOptions.step !== undefined) input.step = extraOptions.step
            
            input.onchange = (e) => {
                if (type === 'number') {
                    settingsObj[key] = parseFloat(e.target.value) || 0
                } else {
                    settingsObj[key] = e.target.value
                }
                this.syncConfig()
            }
        }

        row.appendChild(input)
        container.appendChild(row)
        this.serverSettingsControls[key] = input
    }

    renderServerSettings() {
        if (!this.statsPanel) return
        
        let spawnCount = 0
        let interactiveCount = 0
        let totalSpawnCapacity = 0
        
        if (this.game && this.game.sceneManager && this.game.sceneManager.scene) {
            const objs = this.logicSystem.scanScene(this.game.sceneManager.scene)
            objs.forEach(obj => {
                if (obj.userData.mapObjectType === 'spawn_point') {
                    spawnCount++
                    const cap = (obj.userData.logicProperties && obj.userData.logicProperties.capacity) || 1
                    totalSpawnCapacity += cap
                }
                else interactiveCount++
            })
        }

        this.statsPanel.innerHTML = `
            <strong style="color: #fff;">Estadísticas del Mapa:</strong><br/>
            <span style="color:#0f0; margin-left: 5px;">• Puntos de Aparición (Spawn):</span> ${spawnCount} (Capacidad total: ${totalSpawnCapacity})<br/>
            <span style="color:#fa0; margin-left: 5px;">• Objetos Inteligentes/Colisiones:</span> ${interactiveCount}
        `
    }

    createSimulationControls(container) {
        const simCtn = document.createElement('div')
        simCtn.style.cssText = "display: flex; gap: 5px; background: #222; padding: 8px; border-radius: 6px; align-items: center; border: 1px solid #444;"

        const label = document.createElement('span')
        label.textContent = "Simulación:"
        label.style.cssText = "font-size: 11px; color: #aaa; margin-right: 5px;"
        simCtn.appendChild(label)

        // Helper
        const createCtrlBtn = (icon, title, color, onClick) => {
            const btn = document.createElement('button')
            btn.innerHTML = icon
            btn.title = title
            btn.style.cssText = `
                background: #333; color: ${color}; border: 1px solid #555; 
                width: 30px; height: 30px; border-radius: 4px; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 14px;
            `
            btn.onclick = onClick
            btn.onmouseenter = () => { if (btn.dataset.active !== "true") btn.style.background = "#444" }
            btn.onmouseleave = () => { if (btn.dataset.active !== "true") btn.style.background = "#333" }
            simCtn.appendChild(btn)
            return btn
        }

        this.playBtn = createCtrlBtn("▶", "Iniciar Simulación", "#0f0", () => this.logicSystem.playConfig())
        this.pauseBtn = createCtrlBtn("⏸", "Pausar", "#fa0", () => this.logicSystem.pauseConfig())
        const stopBtn = createCtrlBtn("⏹", "Detener / Reiniciar", "#f44", () => this.logicSystem.stopConfig())

        // Separator
        const sep = document.createElement('div')
        sep.style.cssText = "width: 1px; height: 20px; background: #555; margin: 0 5px;"
        simCtn.appendChild(sep)

        createCtrlBtn("⏮", "Bloque Anterior", "#fff", () => this.logicSystem.stepConfig(-1))
        createCtrlBtn("⏭", "Bloque Siguiente", "#fff", () => this.logicSystem.stepConfig(1))

        // Time Display
        const timeContainer = document.createElement('div')
        timeContainer.style.cssText = "margin-left: auto; display: flex; align-items: center; gap: 5px;"

        const timeIcon = document.createElement('span')
        timeIcon.textContent = "⏱"
        timeIcon.style.fontSize = "12px"
        timeContainer.appendChild(timeIcon)

        this.timeDisplay = document.createElement('span')
        this.timeDisplay.textContent = "00:00"
        this.timeDisplay.style.cssText = "font-family: monospace; font-size: 14px; color: #0ff;"
        timeContainer.appendChild(this.timeDisplay)

        simCtn.appendChild(timeContainer)

        container.appendChild(simCtn)
    }

    updatePlayState(isPlaying, isPaused) {
        if (!this.playBtn || !this.pauseBtn) return

        if (isPlaying && !isPaused) {
            this.playBtn.style.background = "#050" // Active Green
            this.playBtn.dataset.active = "true"
            this.pauseBtn.style.background = "#333"
            this.pauseBtn.dataset.active = "false"
        } else if (isPaused) {
            this.playBtn.style.background = "#333"
            this.playBtn.dataset.active = "false"
            this.pauseBtn.style.background = "#530" // Active Orange
            this.pauseBtn.dataset.active = "true"
        } else {
            // Stopped
            this.playBtn.style.background = "#333"
            this.playBtn.dataset.active = "false"
            this.pauseBtn.style.background = "#333"
            this.pauseBtn.dataset.active = "false"
        }
    }

    updateTotalTime(seconds) {
        if (!this.timeDisplay) return
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        this.timeDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    highlightBlock(index) {
        if (!this.sequenceList) return
        const children = Array.from(this.sequenceList.children)
        const shouldScroll = this.lastHighlightedIndex !== index && this.container && this.container.offsetParent !== null
        let activeChild = null

        children.forEach((child, idx) => {
            if (idx === index) {
                child.classList.add('active-logic-block')
                activeChild = child
            } else {
                child.classList.remove('active-logic-block')
            }
        })

        if (shouldScroll && activeChild) {
            const targetTop = activeChild.offsetTop - (this.sequenceList.clientHeight / 2) + (activeChild.clientHeight / 2)
            this.sequenceList.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth'
            })
        }

        this.lastHighlightedIndex = index
    }

    createAddBtn(container, text, color, onClick) {
        const btn = document.createElement('button')
        btn.textContent = text
        btn.style.cssText = `
            background: ${color}; color: white; border: none; padding: 8px 12px; 
            border-radius: 4px; cursor: pointer; font-weight: bold; flex: 1; min-width: 100px;
        `
        btn.onclick = onClick
        container.appendChild(btn)
    }

    addBlock(type) {
        const block = { type: type }
        // Init Defaults
        const generateUUID = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
        block.uuid = generateUUID()
        if (type === 'emit_signal') {
            block.signalName = "game_event"
        } else if (type === 'time_wait') {
            block.duration = 5.0
            block.showTimer = false
            block.timerStyle = 'style1'
            block.timerPosition = 'top-center'
            block.signalStart = "inicio"
            block.signalEnd = "final"
            block.intervalSignals = []
        }

        this.logicSystem.gameConfig.sequences.push(block)
        this.syncConfig()
        this.render()
    }

    render() {
        this.sequenceList.innerHTML = ""
        const seq = this.logicSystem.gameConfig.sequences

        if (seq.length === 0) {
            this.sequenceList.innerHTML = "<div style='color:#666; text-align:center; padding:20px;'>No hay bloques de lógica. Agrega uno arriba.</div>"
            return
        }

        seq.forEach((block, idx) => {
            const item = document.createElement('div')
            item.className = 'game-config-block'
            item.style.cssText = `
                background: #333; padding: 10px; border-radius: 6px; 
                display: flex; align-items: center; gap: 10px; position: relative;
                border-left: 5px solid #555;
            `

            // Color Coding
            if (block.type === 'start_signal' || block.type === 'emit_signal') item.style.borderLeftColor = "#00aa00"
            if (block.type === 'time_wait') item.style.borderLeftColor = "#4444ff"
            if (block.type === 'end_game') item.style.borderLeftColor = "#aa0000"
            if (block.type === 'loop_game') item.style.borderLeftColor = "#880088"

            // Index
            const idxSpan = document.createElement('span')
            idxSpan.textContent = `#${idx + 1}`
            idxSpan.style.color = "#888"
            idxSpan.style.width = "30px"
            item.appendChild(idxSpan)

            // Content based on Type
            const content = document.createElement('div')
            content.style.flex = "1"
            content.style.display = "flex"
            content.style.alignItems = "center"
            content.style.gap = "10px"

            // Unified Signal Handler
            if (block.type === 'start_signal' || block.type === 'emit_signal') {
                content.innerHTML = `<strong>Señal:</strong> `
                const input = this.createTextInput(block.signalName, (val) => block.signalName = val)
                content.appendChild(input)

            } else if (block.type === 'time_wait') {
                content.style.flexDirection = "column"
                content.style.alignItems = "flex-start"

                // --- Row 1: Time Inputs ---
                const timeRow = document.createElement('div')
                timeRow.style.display = "flex"
                timeRow.style.alignItems = "center"
                timeRow.style.gap = "5px"
                timeRow.innerHTML = `<strong>Duración:</strong> `

                // Duration Decomposition
                const totalSeconds = block.duration || 0
                const h = Math.floor(totalSeconds / 3600)
                const m = Math.floor((totalSeconds % 3600) / 60)
                const s = Math.floor(totalSeconds % 60)

                const updateDuration = (newH, newM, newS) => {
                    block.duration = (newH * 3600) + (newM * 60) + newS
                }

                // Helper for Labeled Input
                const createLabeledInput = (val, cb, label) => {
                    const wrapper = document.createElement('div')
                    wrapper.style.display = "flex"
                    wrapper.style.flexDirection = "column"
                    wrapper.style.alignItems = "center"

                    const input = this.createNumberInput(val, cb, "", 40)

                    const lbl = document.createElement('span')
                    lbl.textContent = label
                    lbl.style.fontSize = "10px"
                    lbl.style.color = "#888"

                    wrapper.appendChild(input)
                    wrapper.appendChild(lbl)
                    return wrapper
                }

                // H Input
                timeRow.appendChild(createLabeledInput(h, (val) => updateDuration(val, m, s), "Hora"))
                timeRow.appendChild(document.createTextNode(':'))

                // M Input
                timeRow.appendChild(createLabeledInput(m, (val) => updateDuration(h, val, s), "Minuto"))
                timeRow.appendChild(document.createTextNode(':'))

                // S Input
                timeRow.appendChild(createLabeledInput(s, (val) => updateDuration(h, m, val), "Segundo"))

                content.appendChild(timeRow)

                // --- Signal Config Button ---
                const signalBtn = document.createElement('button')
                signalBtn.innerHTML = "Editar Señales"
                signalBtn.style.cssText = `
                    margin-top: 5px; width: 100%; background: #333; color: #ddd; 
                    border: 1px dashed #555; padding: 4px; border-radius: 4px; 
                    cursor: pointer; font-size: 11px;
                `
                signalBtn.onmouseenter = () => signalBtn.style.background = "#444"
                signalBtn.onmouseleave = () => signalBtn.style.background = "#333"
                signalBtn.onclick = () => this.openSignalConfig(block)

                content.appendChild(signalBtn)

                // --- Row 2: HUD Options ---
                const optionsRow = document.createElement('div')
                optionsRow.style.display = "flex"
                optionsRow.style.gap = "15px"
                optionsRow.style.alignItems = "center"
                optionsRow.style.marginTop = "5px"

                // Checkbox
                const chkLabel = document.createElement('label')
                chkLabel.style.display = "flex"
                chkLabel.style.alignItems = "center"
                chkLabel.style.gap = "5px"
                chkLabel.style.fontSize = "12px"
                chkLabel.style.color = "#ddd"
                chkLabel.style.cursor = "pointer"

                const chk = document.createElement('input')
                chk.type = "checkbox"
                chk.checked = block.showTimer || false
                chk.onchange = (e) => {
                    block.showTimer = e.target.checked
                    this.syncConfig()
                    this.render() // Re-render to show/hide style select potentially
                }
                chkLabel.appendChild(chk)
                chkLabel.appendChild(document.createTextNode("Mostrar en Juego"))
                optionsRow.appendChild(chkLabel)

                // Style Select (Only if checked)
                if (block.showTimer) {
                    const selLabel = document.createElement('label')
                    selLabel.style.display = "flex"
                    selLabel.style.alignItems = "center"
                    selLabel.style.gap = "5px"
                    selLabel.style.fontSize = "12px"
                    selLabel.style.color = "#ddd"

                    selLabel.appendChild(document.createTextNode("Estilo:"))

                    const sel = document.createElement('select')
                    sel.style.background = "#222"
                    sel.style.color = "white"
                    sel.style.border = "1px solid #555"
                    sel.style.fontSize = "11px"
                    sel.style.padding = "2px"

                    const styles = [
                        { id: 'style1', name: 'Digital Neon' },
                        { id: 'style2', name: 'Minimalista' },
                        { id: 'style3', name: 'Caja Deportiva' }
                    ]

                    styles.forEach(st => {
                        const opt = document.createElement('option')
                        opt.value = st.id
                        opt.textContent = st.name
                        if (block.timerStyle === st.id) opt.selected = true
                        sel.appendChild(opt)
                    })

                    sel.onchange = (e) => { block.timerStyle = e.target.value; this.syncConfig(); }
                    selLabel.appendChild(sel)
                    optionsRow.appendChild(selLabel)

                    // Position Button
                    const posBtn = document.createElement('button')
                    posBtn.textContent = `Posición: ${this.getReadablePosition(block.timerPosition)}`
                    posBtn.style.cssText = "background: #444; color: #fff; border: 1px dashed #777; padding: 2px 8px; font-size: 11px; cursor: pointer; border-radius: 4px;"
                    posBtn.onclick = () => {
                        this.positionSelector.open(block.timerPosition, (newPos) => {
                            block.timerPosition = newPos
                            this.syncConfig()
                            this.render()
                        })
                    }
                    optionsRow.appendChild(posBtn)
                }

                content.appendChild(optionsRow)

            } else if (block.type === 'end_game') {
                content.innerHTML = `<strong>Fin de Partida</strong>`
            } else if (block.type === 'loop_game') {
                content.innerHTML = `<strong>Reiniciar Secuencia (Loop)</strong>`
            }

            item.appendChild(content)

            // Actions (Move/Delete)
            const actions = document.createElement('div')
            actions.style.display = "flex"
            actions.style.gap = "5px"

            // Up
            if (idx > 0) {
                const upBtn = document.createElement('button')
                upBtn.textContent = "▲"
                upBtn.onclick = () => {
                    [seq[idx], seq[idx - 1]] = [seq[idx - 1], seq[idx]]
                    this.syncConfig()
                    this.render()
                }
                this.styleActionBtn(upBtn)
                actions.appendChild(upBtn)
            }

            // Down
            if (idx < seq.length - 1) {
                const downBtn = document.createElement('button')
                downBtn.textContent = "▼"
                downBtn.onclick = () => {
                    [seq[idx], seq[idx + 1]] = [seq[idx + 1], seq[idx]]
                    this.syncConfig()
                    this.render()
                }
                this.styleActionBtn(downBtn)
                actions.appendChild(downBtn)
            }

            // Delete
            const delBtn = document.createElement('button')
            delBtn.textContent = "✕"
            delBtn.onclick = () => {
                seq.splice(idx, 1)
                this.syncConfig()
                this.render()
            }
            this.styleActionBtn(delBtn, true)
            actions.appendChild(delBtn)

            item.appendChild(actions)
            this.sequenceList.appendChild(item)
        })
    }

    styleActionBtn(btn, isDelete = false) {
        btn.style.cssText = `
            background: ${isDelete ? '#622' : '#333'}; color: white; border: 1px solid #555; padding: 2px 6px;
            cursor: pointer; border-radius: 4px; font-size: 12px;
        `
    }

    createTextInput(val, onChange) {
        const input = document.createElement('input')
        input.type = 'text'
        input.value = val
        input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 2px 5px; width: 120px;"
        input.onchange = (e) => { onChange(e.target.value); this.syncConfig(); }
        return input
    }

    createNumberInput(val, onChange, placeholder, width = 60) {
        const input = document.createElement('input')
        input.type = 'number'
        input.value = val
        input.min = 0
        input.placeholder = placeholder
        input.style.cssText = `background: #222; border: 1px solid #555; color: white; padding: 2px 5px; width: ${width}px; text-align: center;`
        input.onchange = (e) => { onChange(parseFloat(e.target.value) || 0); this.syncConfig(); }
        return input
    }

    createTimeInputGroup(initialTime, onChange) {
        const container = document.createElement('div')
        container.style.cssText = "display: flex; align-items: center; gap: 2px;"

        // Decompose Time
        let h = Math.floor(initialTime / 3600)
        let m = Math.floor((initialTime % 3600) / 60)
        let s = Math.floor(initialTime % 60)

        const updateTime = () => {
            const total = (h * 3600) + (m * 60) + s
            onChange(total)
        }

        const createInput = (val, setVal, placeholder) => {
            const inp = document.createElement('input')
            inp.type = 'number'
            inp.value = val
            inp.min = 0
            inp.placeholder = placeholder
            inp.style.cssText = "background: #222; border: 1px solid #555; color: white; width: 40px; text-align: center; padding: 2px;"
            inp.onchange = (e) => {
                setVal(parseFloat(e.target.value) || 0)
                updateTime()
                this.syncConfig()
            }
            return inp
        }

        container.appendChild(createInput(h, (v) => h = v, "H"))
        container.appendChild(document.createTextNode(":"))
        container.appendChild(createInput(m, (v) => m = v, "M"))
        container.appendChild(document.createTextNode(":"))
        container.appendChild(createInput(s, (v) => s = v, "S"))

        return container
    }

    openSignalConfig(block, onSelectCallback = null) {
        const isSelectionMode = !!onSelectCallback
        // UI Overlay
        const overlay = document.createElement('div')
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 6000;
            display: flex; align-items: center; justify-content: center;
        `

        const panel = document.createElement('div')
        panel.style.cssText = `
            background: #222; border: 1px solid #444; border-radius: 12px;
            width: 700px; max-height: 80vh; padding: 25px; display: flex; flex-direction: column; gap: 15px;
            box-shadow: 0 0 40px rgba(0,0,0,0.6); font-family: sans-serif;
        `
        overlay.appendChild(panel)

        // Header & Info
        const header = document.createElement('div')
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #555; padding-bottom: 10px;"

        const title = document.createElement('h3')
        title.textContent = isSelectionMode ? "Bloque de secuencias de la partida" : "Editor de Señales Cronológico"
        title.style.margin = "0"
        title.style.color = "#fff"

        // Duration Info
        const totalSeconds = block.duration || 0
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)
        const s = Math.floor(totalSeconds % 60)
        const durationInfo = document.createElement('div')
        durationInfo.innerHTML = `<span style="color:#aaa;">Duración del Bloque:</span> <span style="color:#0ff; font-family:monospace; font-size:14px;">${h}h ${m}m ${s}s</span>`

        header.appendChild(title)
        header.appendChild(durationInfo)
        panel.appendChild(header)


        // --- Signal Timeline Container ---
        const timeline = document.createElement('div')
        timeline.className = "game-config-scroll"
        timeline.style.cssText = `
            flex: 1; overflow-y: auto; background: #181818; 
            border: 1px solid #333; border-radius: 8px; padding: 10px;
            display: flex; flex-direction: column; gap: 10px;
        `

        // Helper: Signal Action Button (Select or Edit)
        const createActionBtn = (signalName) => {
            if (!isSelectionMode) return null
            const btn = document.createElement('button')
            btn.innerHTML = "✔"
            btn.title = "Seleccionar esta señal"
            btn.style.cssText = "background: #2a2; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;"
            btn.onclick = () => {
                onSelectCallback(signalName)
                document.body.removeChild(overlay)
            }
            return btn
        }

        // 1. Start Signal (Fixed Top)
        const rowStart = document.createElement('div')
        rowStart.style.cssText = "background: #113311; padding: 10px; border-radius: 6px; border-left: 4px solid #0f0; display: flex; align-items: center; gap: 10px;"

        rowStart.innerHTML = `<strong style="color:#0f0; width: 60px;">T: 0s</strong>`
        const lblStart = document.createElement('span')
        lblStart.textContent = "INICIO DEL BLOQUE"
        lblStart.style.cssText = "flex:1; color: #888; font-size: 12px; font-style: italic;"

        const inputStart = this.createTextInput(block.signalStart || "", (val) => block.signalStart = val)
        inputStart.placeholder = "Nombre señal inicio..."
        inputStart.style.width = "200px"

        rowStart.appendChild(lblStart)
        rowStart.appendChild(inputStart)

        if (isSelectionMode) {
            const sigName = block.signalStart || "inicio"
            rowStart.appendChild(createActionBtn(sigName))
        }

        timeline.appendChild(rowStart)

        // 2. Intervals Section (Dynamic)
        const renderIntervals = () => {
            // Sort intervals by time
            if (!block.intervalSignals) block.intervalSignals = []
            block.intervalSignals.sort((a, b) => a.time - b.time)

            // Remove old interval rows (keep start/end fixed, complicated loop, better to rebuild timeline middle)
            // Strategy: Clear timeline content EXCEPT start/end is tricky? 
            // Better Strategy: Re-render the whole inner timeline content.

            // Re-render helper
            timeline.innerHTML = ""
            timeline.appendChild(rowStart) // Re-attach Start

            block.intervalSignals.forEach((intSig, idx) => {
                const row = document.createElement('div')

                // Validation
                const isOutOfRange = intSig.time > (block.duration || 0)
                const borderColor = isOutOfRange ? "#cc0" : "#aaa"
                const bgColor = isOutOfRange ? "#332" : "#2a2a2a"

                row.style.cssText = `background: ${bgColor}; padding: 8px; border-radius: 6px; border-left: 4px solid ${borderColor}; display: flex; align-items: center; gap: 10px;`

                // Time Group
                const timeGroup = this.createTimeInputGroup(intSig.time, (newTime) => {
                    if (isSelectionMode) return; // No edit
                    intSig.time = newTime
                    renderIntervals()
                })
                // Disable inputs manually if selection mode
                if (isSelectionMode) {
                    Array.from(timeGroup.querySelectorAll('input')).forEach(i => i.disabled = true)
                }

                // Mode Selector
                const modeSel = document.createElement('select')
                modeSel.style.cssText = `background: #222; color: ${isOutOfRange ? '#cc0' : '#ddd'}; border: 1px solid #555; font-size: 11px; width: 130px;`
                const modes = ["Activar al transcurrir", "Activar en el momento"]
                modes.forEach(m => {
                    const opt = document.createElement('option')
                    opt.value = m
                    opt.textContent = m
                    if (intSig.mode === m) opt.selected = true
                    modeSel.appendChild(opt)
                })
                modeSel.onchange = (e) => { intSig.mode = e.target.value; this.syncConfig(); }
                if (isSelectionMode) modeSel.disabled = true;

                // Signal Name
                const sIn = this.createTextInput(intSig.signal, (v) => intSig.signal = v)
                sIn.placeholder = "Nombre señal..."
                sIn.style.flex = "1"
                if (isOutOfRange) sIn.style.color = "#cc0"
                if (isSelectionMode) sIn.disabled = true;

                // Delete
                const del = document.createElement('button')
                del.textContent = "🗑"
                del.style.cssText = "background: #422; color: #fcc; border: none; padding: 5px; border-radius: 4px; cursor: pointer;"
                del.onclick = () => {
                    block.intervalSignals.splice(idx, 1)
                    this.syncConfig()
                    renderIntervals()
                }
                if (isSelectionMode) del.style.display = "none"

                // Range Warning Icon
                if (isOutOfRange) {
                    const warn = document.createElement('span')
                    warn.textContent = "⚠"
                    warn.title = "Fuera del rango de duración"
                    warn.style.cssText = "color: #cc0; cursor: help; font-size:14px;"
                    row.appendChild(warn)
                }

                row.appendChild(timeGroup)
                row.appendChild(modeSel)
                row.appendChild(sIn)
                if (!isSelectionMode) row.appendChild(del)

                if (isSelectionMode && intSig.signal) {
                    row.appendChild(createActionBtn(intSig.signal))
                }

                timeline.appendChild(row)
            })

            if (!isSelectionMode) {
                timeline.appendChild(createAddButtonRow())
            }
            timeline.appendChild(rowEnd) // Re-attach End
        }

        // Add Button Row
        const createAddButtonRow = () => {
            const row = document.createElement('div')
            row.style.textAlign = "center"
            row.style.padding = "10px"
            const btn = document.createElement('button')
            btn.innerHTML = "+ Agregar Señal Intermedia"
            btn.style.cssText = "background: #333; color: white; border: 1px dashed #666; width: 100%; padding: 8px; cursor: pointer;"
            btn.onmouseenter = () => btn.style.background = "#444"
            btn.onmouseleave = () => btn.style.background = "#333"
            btn.onclick = () => {
                block.intervalSignals.push({ time: Math.floor((block.duration || 0) / 2), signal: "signal_event", mode: "Activar al transcurrir" })
                this.syncConfig()
                renderIntervals()
            }
            row.appendChild(btn)
            return row
        }

        // 3. End Signal (Fixed Bottom)
        const rowEnd = document.createElement('div')
        rowEnd.style.cssText = "background: #331111; padding: 10px; border-radius: 6px; border-left: 4px solid #f44; display: flex; align-items: center; gap: 10px;"

        rowEnd.innerHTML = `<strong style="color:#f44; width: 60px;">T: FIN</strong>`
        const lblEnd = document.createElement('span')
        lblEnd.textContent = "FINAL DEL BLOQUE"
        lblEnd.style.cssText = "flex:1; color: #888; font-size: 12px; font-style: italic;"

        const inputEnd = this.createTextInput(block.signalEnd || "", (val) => block.signalEnd = val)
        inputEnd.placeholder = "Nombre señal final..."
        inputEnd.style.width = "200px"
        if (isSelectionMode) inputEnd.disabled = true;

        rowEnd.appendChild(lblEnd)
        rowEnd.appendChild(inputEnd)

        if (isSelectionMode) {
            const sigName = block.signalEnd || "final"
            rowEnd.appendChild(createActionBtn(sigName))
        }

        // Initial Render
        renderIntervals()
        panel.appendChild(timeline)

        // Footer
        const footer = document.createElement('div')
        footer.style.textAlign = "right"
        const closeBtn = document.createElement('button')
        // Changes text if selecting or editing
        closeBtn.textContent = isSelectionMode ? "Cancelar / Cerrar" : "Guardar y Cerrar"
        closeBtn.style.cssText = "background: #44f; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 4px; cursor: pointer;"
        closeBtn.onclick = () => {
            document.body.removeChild(overlay)
            if (!isSelectionMode) this.render()
        }
        footer.appendChild(closeBtn)
        panel.appendChild(footer)

        document.body.appendChild(overlay)
    }
}

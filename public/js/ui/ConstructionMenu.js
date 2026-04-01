import { MapObjectItem } from "../item/MapObjectItem.js"
import { LogicSystem } from "../managers/LogicSystem.js"
import { GameConfigPanel } from "./GameConfigPanel.js"
import { PlayerConfigPanel } from "./PlayerConfigPanel.js"
import { GunItem } from "../item/GunItem.js"
import * as THREE from "three"

export class ConstructionMenu {
    constructor(inventoryManager, gameInstance) {
        this.inventoryManager = inventoryManager
        this.game = gameInstance // Access to toggle pause, input etc.
        this.isVisible = false

        // Systems
        this.logicSystem = new LogicSystem(this.game)

        // Data
        this.libraryItems = []
        this.generateLibrary()
        this.generateLogicLibrary() // Logic Items

        this.generateLogicLibrary() // Logic Items

        this.gameConfigPanel = new GameConfigPanel(this.game, this.logicSystem)
        this.playerConfigPanel = new PlayerConfigPanel(this.game, this.logicSystem.playerConfigManager)

        this.setupUI()
    }

    generateLibrary() {
        // Shapes
        const shapes = [
            { id_prefix: "wall", name: "Pared", type: "wall", scale: { x: 5, y: 3, z: 0.5 } },
            { id_prefix: "wall_low", name: "Muro Bajo", type: "wall", scale: { x: 5, y: 1, z: 0.5 } },
            { id_prefix: "floor", name: "Suelo", type: "wall", scale: { x: 5, y: 0.5, z: 5 } },
            { id_prefix: "platform", name: "Plataforma", type: "wall", scale: { x: 10, y: 0.5, z: 10 } },
            { id_prefix: "pillar", name: "Pilar", type: "pillar", scale: { x: 1, y: 4, z: 1 } },
            { id_prefix: "cube_s", name: "Cubo Pequeño", type: "wall", scale: { x: 1, y: 1, z: 1 } },
            { id_prefix: "cube_l", name: "Cubo Grande", type: "wall", scale: { x: 3, y: 3, z: 3 } }, // 3x3x3 fits grid better than 4x4 if grid=1? Let's use 3.
            { id_prefix: "ramp", name: "Rampa", type: "ramp", scale: { x: 4, y: 2, z: 4 } },
            { id_prefix: "stairs", name: "Gradas", type: "stairs", scale: { x: 4, y: 2, z: 4 } }, // Matches ramp/wall size roughly
            { id_prefix: "ladder", name: "Escalera", type: "ladder", scale: { x: 1, y: 3, z: 0.5 } }, // New Ladder
            { id_prefix: "tall", name: "Torre", type: "pillar", scale: { x: 2, y: 10, z: 2 } }
        ]

        // Single Color (White)
        const whiteHex = 0xFFFFFF

        shapes.forEach(shape => {
            const item = new MapObjectItem(
                `${shape.id_prefix}`, // ID without color suffix
                `${shape.name}`,      // Name without color suffix
                shape.type,
                "",
                whiteHex,
                shape.scale
            )
            this.libraryItems.push(item)
        })

        // Add Gun to Library
        const gun = new GunItem();
        this.libraryItems.push(gun);
    }

    generateLogicLibrary() {
        // Logic Objects
        this.logicItems = []

        // Player Spawn
        const spawn = new MapObjectItem(
            "spawn_point",
            "Punto de Spawn",
            "spawn_point",
            "",
            0x00FF00, // Green
            { x: 2, y: 0.05, z: 2 } // Thin platform (2m diam)
        )
        // Default Logic Properties
        spawn.logicProperties = {
            team: 1,
            capacity: 1,
            order: 1
        }
        this.logicItems.push(spawn)

        // Movement Controller
        const mover = new MapObjectItem(
            "movement_controller",
            "Controlador de Movimiento",
            "movement_controller",
            "",
            0x00FFFF, // Cyan
            { x: 0.5, y: 0.5, z: 0.5 } // Small box
        )
        mover.logicProperties = {
            targetUuid: null,
            speed: 2.0,
            loop: true,
            active: true,
            waypoints: []
        }
        this.logicItems.push(mover)

        // Interaction Button
        const button = new MapObjectItem(
            "button",
            "Botón Interactivo",
            "interaction_button",
            "",
            0xFF0000,
            { x: 1, y: 1, z: 1 } // Scale
        )
        // Default Logic
        button.logicProperties = {
            holdTime: 1.0,
            oneShot: false,
            targetUuid: null
        }
        this.logicItems.push(button)

        // Interactive Collision
        const collision = new MapObjectItem(
            "interactive_collision",
            "Colisión Interactiva",
            "interactive_collision",
            "",
            0x0088FF,
            { x: 2, y: 2, z: 2 } // 2x2x2 predetermined
        )
        // Default Properties handled in MapObjectItem logic, but good to init here too if needed
        collision.logicProperties = {
            isTraversable: false,
            triggerOnTouch: false,
            triggerOnEnter: false
        }
        this.logicItems.push(collision)

        // Target (Diana)
        const target = new MapObjectItem(
            "interactive_target",
            "Diana Interactiva",
            "target",
            "",
            0xFF8800, // Orange
            { x: 2, y: 0.2, z: 2 } // Y is thickness
        )
        // Default Logic
        target.logicProperties = {
            rings: 3,
            baseDamage: 10,
            ringMultipliers: [1, 2, 3] // Outer, middle, inner
        }
        this.logicItems.push(target)
    }

    setupUI() {
        // Init Grid Helper
        this.gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444)
        this.gridHelper.position.y = 0.01 // Slightly above 0 to avoid z-fighting
        this.gridHelper.visible = false
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.add(this.gridHelper)
        }

        // Main Container
        this.container = document.createElement('div')
        this.container.id = 'construction-menu'
        this.container.style.cssText = `
            position: absolute;
            top: 5%; 
            left: 50%;
            transform: translateX(-50%);
            width: 80%; 
            height: 70%;
            background: rgba(0,0,0,0.9);
            border: 2px solid #444; 
            border-radius: 12px;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            z-index: 1000;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
        `

        // Header / Tabs
        const header = document.createElement('div')
        header.style.cssText = `display: flex; gap: 20px; font-size: 24px; margin-bottom: 20px; border-bottom: 1px solid #555; padding-bottom: 10px; overflow-x: auto; flex-shrink: 0;`

        this.tabLibrary = document.createElement('div')
        this.tabLibrary.textContent = "Librería de Objetos"
        this.tabLibrary.style.cursor = "pointer"
        this.tabLibrary.style.fontWeight = "bold"
        this.tabLibrary.style.borderBottom = "2px solid white"
        this.tabLibrary.onclick = () => this.switchTab('library')

        this.tabLogic = document.createElement('div')
        this.tabLogic.textContent = "Lógica Interactiva"
        this.tabLogic.style.cursor = "pointer"
        this.tabLogic.style.color = "#888" // Inactive look
        this.tabLogic.style.borderBottom = "none"
        this.tabLogic.onclick = () => this.switchTab('logic')

        this.tabSettings = document.createElement('div')
        this.tabSettings.textContent = "Config Entorno"
        this.tabSettings.style.cursor = "pointer"
        this.tabSettings.style.color = "#888" // Inactive look
        this.tabSettings.style.borderBottom = "none"
        this.tabSettings.onclick = () => this.switchTab('settings')

        this.tabGameConfig = document.createElement('div')
        this.tabGameConfig.textContent = "Config Partida"
        this.tabGameConfig.style.cursor = "pointer"
        this.tabGameConfig.style.color = "#888" // Inactive look
        this.tabGameConfig.style.borderBottom = "none"
        this.tabGameConfig.onclick = () => this.switchTab('gameConfig')

        this.tabPlayerConfig = document.createElement('div')
        this.tabPlayerConfig.textContent = "Config Jugador"
        this.tabPlayerConfig.style.cursor = "pointer"
        this.tabPlayerConfig.style.color = "#888"
        this.tabPlayerConfig.style.borderBottom = "none"
        this.tabPlayerConfig.style.whiteSpace = "nowrap"
        this.tabPlayerConfig.onclick = () => this.switchTab('playerConfig')

        this.tabSaveLoad = document.createElement('div')
        this.tabSaveLoad.textContent = "Guardar / Cargar"
        this.tabSaveLoad.style.cursor = "pointer"
        this.tabSaveLoad.style.color = "#888" // Inactive look
        this.tabSaveLoad.style.borderBottom = "none"
        this.tabSaveLoad.onclick = () => this.switchTab('saveload')

        header.appendChild(this.tabLibrary)
        header.appendChild(this.tabLogic)
        header.appendChild(this.tabGameConfig)
        header.appendChild(this.tabPlayerConfig)
        header.appendChild(this.tabSettings)
        header.appendChild(this.tabSaveLoad)
        this.container.appendChild(header)

        // Content Area Containers
        this.contentLibrary = document.createElement('div')
        this.contentLibrary.style.cssText = `
            flex: 1;
            display: flex; /* Flex Row */
            gap: 20px;
            overflow: hidden; /* Manage overflow internally */
        `

        // Left: Scrollable List of Sections
        this.libraryLeftCol = document.createElement('div')
        this.libraryLeftCol.style.cssText = `
            flex: 2;
            display: flex;
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding-right: 10px;
        `

        // Helper to create a collapsible section
        const createCollapsibleSection = (title, itemsFiltFunc) => {
            const details = document.createElement('details');
            details.open = true; // Open by default
            details.style.cssText = `
                background: #2a2a2a;
                border-radius: 8px;
                padding: 10px;
                border: 1px solid #444;
            `;

            const summary = document.createElement('summary');
            summary.textContent = title;
            summary.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                color: #fff;
                cursor: pointer;
                outline: none;
                user-select: none;
                padding-bottom: 5px;
                border-bottom: 2px solid #555;
                margin-bottom: 15px;
            `;
            details.appendChild(summary);

            const grid = document.createElement('div');
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                grid-auto-rows: 120px;
                gap: 10px;
            `;

            const filteredItems = this.libraryItems.filter(itemsFiltFunc);
            this.renderLibraryGrid(grid, filteredItems);

            details.appendChild(grid);
            return details;
        };

        // Create Sections
        const sectionConstruction = createCollapsibleSection("Construcción", item => item.type !== 'weapon');
        const sectionWeapons = createCollapsibleSection("Armas", item => item.type === 'weapon');

        this.libraryLeftCol.appendChild(sectionConstruction);
        this.libraryLeftCol.appendChild(sectionWeapons);

        // Right: Customizer Panel
        this.libraryPanel = document.createElement('div')
        this.libraryPanel.style.cssText = `
            flex: 1;
            background: #222;
            border-left: 1px solid #444;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border-radius: 8px;
            overflow-y: auto; /* Global Scroll */
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: #444 #222; /* Firefox */
        `

        // Inject Custom Scrollbar Style for Webkit
        const style = document.createElement('style')
        style.innerHTML = `
            #construction-menu ::-webkit-scrollbar {
                width: 6px;
            }
            #construction-menu ::-webkit-scrollbar-track {
                background: #222; 
            }
            #construction-menu ::-webkit-scrollbar-thumb {
                background: #444; 
                border-radius: 3px;
            }
            #construction-menu ::-webkit-scrollbar-thumb:hover {
                background: #555; 
            }
        `
        this.container.appendChild(style)

        this.renderLibraryPanel(this.libraryPanel)

        this.contentLibrary.appendChild(this.libraryLeftCol)
        this.contentLibrary.appendChild(this.libraryPanel)

        // Logic Content
        this.contentLogic = document.createElement('div')
        this.contentLogic.style.cssText = `
            flex: 1;
            display: none; 
            gap: 20px;
            overflow: hidden;
            flex-direction: row; /* Horizontal Split */
        `

        // Left: Logic Library (New Items)
        const leftContainer = document.createElement('div')
        leftContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-right: 1px solid #444;
            padding-right: 10px;
        `
        const leftTitle = document.createElement('h3')
        leftTitle.textContent = "Nuevo Objeto"
        leftTitle.style.margin = "0 0 10px 0"
        leftTitle.style.color = "#aaa"
        leftContainer.appendChild(leftTitle)

        this.logicGrid = document.createElement('div')
        this.logicGrid.style.cssText = `
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            grid-auto-rows: 120px;
            gap: 10px;
            overflow-y: auto;
            align-content: start;
        `
        this.renderLibraryGrid(this.logicGrid, this.logicItems)
        leftContainer.appendChild(this.logicGrid)

        this.contentLogic.appendChild(leftContainer)


        // Right: Scene Logic Objects (Tree + Editor)
        const rightContainer = document.createElement('div')
        rightContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `
        const rightTitle = document.createElement('h3')
        rightTitle.textContent = "Objetos en Escena"
        rightTitle.style.margin = "0 0 10px 0"
        rightTitle.style.color = "#aaa"
        rightContainer.appendChild(rightTitle)

        // Tree View Container
        this.logicTreePanel = document.createElement('div')
        this.logicTreePanel.style.cssText = `
            flex: 1;
            background: #222;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 5px;
        `
        rightContainer.appendChild(this.logicTreePanel)

        // Properties Editor Container (Bottom of Right)
        this.logicPropertiesPanel = document.createElement('div')
        this.logicPropertiesPanel.style.cssText = `
            height: 250px; /* Fixed height for editor */
            background: #2b2b2b;
            border-top: 2px solid #555;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            border-radius: 0 0 8px 8px; /* Rounded only bottom if attached */
        `
        this.logicPropertiesPanel.innerHTML = `<div style="color:#666; text-align:center; padding-top:20px;">Selecciona un objeto de la lista para editar</div>`

        rightContainer.appendChild(this.logicPropertiesPanel)
        this.contentLogic.appendChild(rightContainer)


        this.contentSettings = document.createElement('div')
        this.contentSettings.style.cssText = `
            flex: 1;
            display: none; /* Hidden by default */
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
        `
        this.renderSettings(this.contentSettings)

        this.contentSaveLoad = document.createElement('div')
        this.contentSaveLoad.style.cssText = `
            flex: 1;
            display: none;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
            align-items: flex-start;
            align-content: flex-start;
        `
        this.renderSaveLoad(this.contentSaveLoad)

        // Game Config Content
        this.contentGameConfig = document.createElement('div')
        this.contentGameConfig.style.cssText = `
            flex: 1; display: none; flex-direction: column; overflow: hidden; min-height: 0;
        `
        this.gameConfigPanel.createUI(this.contentGameConfig)

        // Player Config Content
        this.contentPlayerConfig = document.createElement('div')
        this.contentPlayerConfig.style.cssText = `flex: 1; display: none; flex-direction: column; overflow: hidden; min-height: 0;`
        this.playerConfigPanel.createUI(this.contentPlayerConfig)

        this.container.appendChild(this.contentLibrary)
        this.container.appendChild(this.contentLogic)
        this.container.appendChild(this.contentSettings)
        this.container.appendChild(this.contentGameConfig)
        this.container.appendChild(this.contentPlayerConfig)
        this.container.appendChild(this.contentSaveLoad)


        // Instructions
        const footer = document.createElement('div')
        footer.textContent = "Arrastra objetos a tu barra de inventario inferior para equiparlos. Pulsa 'E' para cerrar."
        footer.style.marginTop = "20px"
        footer.style.color = "#aaa"
        this.container.appendChild(footer)

        document.body.appendChild(this.container)
    }

    switchTab(tabName) {
        // Reset all
        this.contentLibrary.style.display = 'none'
        this.contentLogic.style.display = 'none'
        this.contentSettings.style.display = 'none'
        this.contentGameConfig.style.display = 'none'
        this.contentSaveLoad.style.display = 'none'

        this.tabLibrary.style.fontWeight = "normal"
        this.tabLibrary.style.color = "#888"
        this.tabLibrary.style.borderBottom = "none"

        this.tabLogic.style.fontWeight = "normal"
        this.tabLogic.style.color = "#888"
        this.tabLogic.style.borderBottom = "none"

        this.tabSettings.style.fontWeight = "normal"
        this.tabSettings.style.color = "#888"
        this.tabSettings.style.borderBottom = "none"

        this.tabSaveLoad.style.fontWeight = "normal"
        this.tabSaveLoad.style.color = "#888"
        this.tabSaveLoad.style.borderBottom = "none"

        this.tabGameConfig.style.fontWeight = "normal"
        this.tabGameConfig.style.color = "#888"
        this.tabGameConfig.style.borderBottom = "none"

        this.contentPlayerConfig.style.display = 'none'
        this.tabPlayerConfig.style.fontWeight = "normal"
        this.tabPlayerConfig.style.color = "#888"
        this.tabPlayerConfig.style.borderBottom = "none"

        // Activate Selected
        if (tabName === 'library') {
            this.contentLibrary.style.display = 'flex'
            this.tabLibrary.style.fontWeight = "bold"
            this.tabLibrary.style.color = "white"
            this.tabLibrary.style.borderBottom = "2px solid white"

        } else if (tabName === 'logic') {
            this.contentLogic.style.display = 'flex'
            this.tabLogic.style.fontWeight = "bold"
            this.tabLogic.style.color = "white"
            this.tabLogic.style.borderBottom = "2px solid white"
            this.refreshLogicList()

        } else if (tabName === 'settings') {
            this.contentSettings.style.display = 'flex'
            this.tabSettings.style.fontWeight = "bold"
            this.tabSettings.style.color = "white"
            this.tabSettings.style.borderBottom = "2px solid white"

        } else if (tabName === 'gameConfig') {
            this.contentGameConfig.style.display = 'flex'
            this.tabGameConfig.style.fontWeight = "bold"
            this.tabGameConfig.style.color = "white"
            this.tabGameConfig.style.borderBottom = "2px solid white"
            this.gameConfigPanel.render()

        } else if (tabName === 'playerConfig') {
            this.contentPlayerConfig.style.display = 'flex'
            this.tabPlayerConfig.style.fontWeight = "bold"
            this.tabPlayerConfig.style.color = "white"
            this.tabPlayerConfig.style.borderBottom = "2px solid white"
            this.playerConfigPanel.render()

        } else if (tabName === 'saveload') {
            this.contentSaveLoad.style.display = 'flex'
            this.tabSaveLoad.style.fontWeight = "bold"
            this.tabSaveLoad.style.color = "white"
            this.tabSaveLoad.style.borderBottom = "2px solid white"
        }
    }

    renderSettings(container) {
        // Grid Toggle
        const row = document.createElement('div')
        row.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.id = 'chk-show-grid'
        checkbox.style.transform = 'scale(1.5)'
        checkbox.addEventListener('change', (e) => {
            if (this.gridHelper) {
                this.gridHelper.visible = e.target.checked
            }
        })

        const label = document.createElement('label')
        label.textContent = "Mostrar Cuadrícula de Mapa"
        label.htmlFor = 'chk-show-grid'
        label.style.fontSize = "18px"
        label.style.cursor = "pointer"

        row.appendChild(checkbox)
        row.appendChild(label)
        container.appendChild(row)

        // Snapping Toggle
        const rowSnap = document.createElement('div')
        rowSnap.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkSnap = document.createElement('input')
        checkSnap.type = 'checkbox'
        checkSnap.id = 'chk-snap-grid'
        checkSnap.style.transform = 'scale(1.5)'
        checkSnap.addEventListener('change', (e) => {
            // Access placement manager via game instance
            // Assuming game instance has placementManager accessible or sceneManager has it. 
            // Ideally game.js should expose it, or we find it bound somewhere.
            // Checking main_rapier.js: this.placementManager is on the Game instance as 'this.placementManager'
            if (this.game.placementManager) {
                this.game.placementManager.snapToGrid = e.target.checked
            }
        })

        const labelSnap = document.createElement('label')
        labelSnap.textContent = "Activar Construcción en Cuadrícula"
        labelSnap.htmlFor = 'chk-snap-grid'
        labelSnap.style.fontSize = "18px"
        labelSnap.style.cursor = "pointer"

        rowSnap.appendChild(checkSnap)
        rowSnap.appendChild(labelSnap)
        container.appendChild(rowSnap)

        // No-Clip Toggle
        const rowClip = document.createElement('div')
        rowClip.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkClip = document.createElement('input')
        checkClip.type = 'checkbox'
        checkClip.id = 'chk-no-clip'
        checkClip.style.transform = 'scale(1.5)'
        checkClip.addEventListener('change', (e) => {
            if (this.game.character && this.game.character.setNoClip) {
                this.game.character.setNoClip(e.target.checked)
            }
        })

        const labelClip = document.createElement('label')
        labelClip.textContent = "Desactivar Colisión (Fantasma)"
        labelClip.htmlFor = 'chk-no-clip'
        labelClip.style.fontSize = "18px"
        labelClip.style.cursor = "pointer"

        rowClip.appendChild(checkClip)
        rowClip.appendChild(labelClip)
        container.appendChild(rowClip)

        // Aerial Grid Toggle
        const rowAerial = document.createElement('div')
        rowAerial.style.cssText = `display: flex; align-items: center; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;`

        const checkAerial = document.createElement('input')
        checkAerial.type = 'checkbox'
        checkAerial.id = 'chk-aerial-grid'
        checkAerial.style.transform = 'scale(1.5)'
        checkAerial.addEventListener('change', (e) => {
            if (this.game.placementManager) {
                this.game.placementManager.setAerialGrid(e.target.checked)

                // Toggle Status UI
                const statusEl = document.getElementById("aerial-grid-status")
                if (statusEl) {
                    statusEl.style.display = e.target.checked ? "block" : "none"
                    // Reset to default
                    statusEl.textContent = "G: Suelo No Fijado"
                    statusEl.style.color = "#00FF00"
                }
            }
        })

        const labelAerial = document.createElement('label')
        labelAerial.textContent = "Activar Grid Aéreo (Construcción en el Aire)"
        labelAerial.htmlFor = 'chk-aerial-grid'
        labelAerial.style.fontSize = "18px"
        labelAerial.style.cursor = "pointer"
        labelAerial.style.color = "#00ffcc" // Highlight it

        rowAerial.appendChild(checkAerial)
        rowAerial.appendChild(labelAerial)
        container.appendChild(rowAerial)

        // Environment / Sky Config
        const rowSky = document.createElement('div')
        rowSky.style.cssText = `display: flex; flex-direction: column; gap: 5px; margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;`

        const labelSky = document.createElement('label')
        labelSky.textContent = "Apariencia del Cielo (Atmósfera)"
        labelSky.style.fontSize = "18px"
        labelSky.style.color = "#aaa"

        const selectSky = document.createElement('select')
        selectSky.style.cssText = `
            padding: 8px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        `
        const options = [
            { value: 'day', text: 'Día (Predeterminado)' },
            { value: 'night', text: 'Noche' },
            { value: 'sunset', text: 'Atardecer' }
        ]

        options.forEach(opt => {
            const el = document.createElement('option')
            el.value = opt.value
            el.textContent = opt.text
            selectSky.appendChild(el)
        })

        selectSky.addEventListener('change', (e) => {
            if (this.game.sceneManager && this.game.sceneManager.setSky) {
                this.game.sceneManager.setSky(e.target.value)
            } else {
                console.warn("SceneManager setSky not found")
            }
        })

        rowSky.appendChild(labelSky)
        rowSky.appendChild(selectSky)
        container.appendChild(rowSky)
    }

    renderSaveLoad(container) {
        // Change container layout to support split view
        container.style.flexWrap = "nowrap"
        container.style.alignItems = "stretch"

        const leftColumn = document.createElement('div')
        leftColumn.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
            max-width: 340px;
        `

        const rightColumn = document.createElement('div')
        rightColumn.style.cssText = `
            flex: 1;
            min-width: 300px;
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `

        const rightTitleRow = document.createElement('div')
        rightTitleRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #555; padding-bottom: 10px;`
        
        const rightTitle = document.createElement('h3')
        rightTitle.textContent = "Visualizador de Mapa (JSON)"
        rightTitle.style.margin = "0"
        
        // State for JSON logic
        let filters = {
            gameVersion: true,
            timestamp: true,
            objects: true,
            gameConfig: true,
            playerConfig: true
        }
        let isEditing = false;

        // Edit Checkbox
        const editLabel = document.createElement('label')
        editLabel.style.cssText = `font-size: 13px; color: #facc15; display: flex; align-items: center; gap: 5px; cursor: pointer; font-weight: bold;`
        const editCb = document.createElement('input')
        editCb.type = 'checkbox'
        editCb.onchange = (e) => {
             isEditing = e.target.checked;
             if (isEditing) {
                 jsonPre.style.display = 'none';
                 jsonTextArea.style.display = 'block';
                 applyBtn.style.display = 'block';
                 filtersContainer.style.opacity = '0.5';
                 filtersContainer.style.pointerEvents = 'none';
             } else {
                 jsonPre.style.display = 'block';
                 jsonTextArea.style.display = 'none';
                 applyBtn.style.display = 'none';
                 filtersContainer.style.opacity = '1';
                 filtersContainer.style.pointerEvents = 'auto';
                 updateJson();
             }
        }
        editLabel.appendChild(editCb)
        editLabel.appendChild(document.createTextNode("Habilitar Edición Manual"))
        
        rightTitleRow.appendChild(rightTitle)
        rightTitleRow.appendChild(editLabel)

        const jsonPre = document.createElement('pre')
        jsonPre.style.cssText = `
            flex: 1;
            width: 100%;
            min-height: 400px;
            background: #111;
            color: #d1d5db;
            font-family: monospace;
            font-size: 13px;
            border: 1px solid #555;
            border-radius: 6px;
            padding: 12px;
            overflow-y: auto;
            margin: 0;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
        `
        
        const jsonTextArea = document.createElement('textarea')
        jsonTextArea.style.cssText = `
            flex: 1;
            width: 100%;
            min-height: 400px;
            background: #1e1b4b;
            color: #fbbf24;
            font-family: monospace;
            font-size: 13px;
            border: 1px solid #6366f1;
            border-radius: 6px;
            padding: 12px;
            resize: none;
            box-sizing: border-box;
            display: none;
        `
        jsonTextArea.spellcheck = false

        const applyBtn = document.createElement('button')
        applyBtn.textContent = "Aplicar Cambios del JSON"
        applyBtn.style.cssText = `
            background: #15803d;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: none;
        `
        applyBtn.onclick = () => {
             try {
                 const newJson = JSON.parse(jsonTextArea.value);
                 if (this.game.loadMap) {
                     this.game.loadMap(newJson);
                     editCb.checked = false;
                     editCb.dispatchEvent(new Event('change'));
                     alert("¡Cambios aplicados al mapa exitosamente!");
                 }
             } catch(err) {
                 alert("Error de sintaxis JSON: " + err.message);
             }
        }

        // Filters UI
        const filtersContainer = document.createElement('div')
        filtersContainer.style.cssText = `display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;`
        
        const createFilter = (key, label) => {
             const lbl = document.createElement('label')
             lbl.style.cssText = `font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 4px; cursor: pointer;`
             const cb = document.createElement('input')
             cb.type = 'checkbox'
             cb.checked = true
             cb.onchange = () => {
                 filters[key] = cb.checked;
                 if(!isEditing) updateJson();
             }
             lbl.appendChild(cb)
             lbl.appendChild(document.createTextNode(label))
             filtersContainer.appendChild(lbl)
        }
        
        createFilter('gameVersion', 'Versión')
        createFilter('timestamp', 'Fecha/Hora')
        createFilter('gameConfig', 'Game Config')
        createFilter('playerConfig', 'Player Config')
        createFilter('objects', 'Objetos 3D')

        rightColumn.appendChild(rightTitleRow)
        rightColumn.appendChild(jsonPre)
        rightColumn.appendChild(jsonTextArea)
        rightColumn.appendChild(applyBtn)
        rightColumn.appendChild(filtersContainer)

        const syntaxHighlight = (json) => {
            if (!json) return "";
            json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                let cls = 'color: #fca5a5;'; // number
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'color: #93c5fd; font-weight: bold; font-style: normal;'; // key
                    } else {
                        cls = 'color: #86efac;'; // string
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'color: #fcd34d; font-weight: bold;'; // boolean
                } else if (/null/.test(match)) {
                    cls = 'color: #f87171; font-weight: bold;'; // null
                }
                return '<span style="' + cls + '">' + match + '</span>';
            });
        }

        const updateJson = () => {
            if (!this.game || !this.game.saveMap || isEditing) return;
            try {
                const mapData = this.game.saveMap();
                const filteredData = {};
                
                if (filters.gameVersion && mapData.gameVersion !== undefined) filteredData.gameVersion = mapData.gameVersion;
                if (filters.timestamp && mapData.timestamp !== undefined) filteredData.timestamp = mapData.timestamp;
                if (filters.objects && mapData.objects !== undefined) filteredData.objects = mapData.objects;
                if (filters.gameConfig && mapData.gameConfig !== undefined) filteredData.gameConfig = mapData.gameConfig;
                if (filters.playerConfig && mapData.playerConfig !== undefined) filteredData.playerConfig = mapData.playerConfig;
                
                for(let key in mapData) {
                    if(!['gameVersion', 'timestamp', 'objects', 'gameConfig', 'playerConfig'].includes(key)) {
                        filteredData[key] = mapData[key];
                    }
                }

                const rawJson = JSON.stringify(filteredData, null, 2);
                jsonPre.innerHTML = syntaxHighlight(rawJson);
                jsonTextArea.value = rawJson;
            } catch(e) {}
        }

        // Auto update interval
        if (this._jsonUpdateInterval) clearInterval(this._jsonUpdateInterval);
        this._jsonUpdateInterval = setInterval(() => {
            if (container.offsetWidth > 0 && !isEditing) {
                updateJson();
            }
        }, 1000)

        // Save Map Section
        const saveSection = document.createElement('div')
        saveSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `

        const saveTitle = document.createElement('h3')
        saveTitle.textContent = "Guardar Mapa"
        saveTitle.style.margin = "0"
        saveTitle.style.borderBottom = "1px solid #555"
        saveTitle.style.paddingBottom = "10px"

        const saveInfo = document.createElement('p')
        saveInfo.textContent = "Revisa el mapa en el panel derecho o descarga el archivo JSON para guardarlo en tu computadora."
        saveInfo.style.color = "#aaa"
        saveInfo.style.fontSize = "14px"
        saveInfo.style.margin = "0"

        const btnContainer = document.createElement('div')
        btnContainer.style.cssText = `display: flex; flex-direction: column; gap: 10px;`

        const baseBtnStyle = `
            background: #545454ff;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: background 0.2s;
        `

        const saveBtn = document.createElement('button')
        saveBtn.textContent = "Guardar Mapa (Descargar)"
        saveBtn.style.cssText = baseBtnStyle
        saveBtn.onmouseover = () => saveBtn.style.background = "#656565ff"
        saveBtn.onmouseout = () => saveBtn.style.background = "#545454ff"
        saveBtn.onclick = () => {
            if (this.game.saveMap) {
                const mapData = this.game.saveMap()
                const json = JSON.stringify(mapData, null, 2)

                // Download
                const blob = new Blob([json], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "mi_mapa.json"
                a.click()
                URL.revokeObjectURL(url)

                alert("Mapa guardado! Archivo descargado.")
            } else {
                alert("Error: Función saveMap no encontrada en el juego.")
            }
        }

        btnContainer.appendChild(saveBtn)

        saveSection.appendChild(saveTitle)
        saveSection.appendChild(saveInfo)
        saveSection.appendChild(btnContainer)

        // Load Map Section
        const loadSection = document.createElement('div')
        loadSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `

        const loadTitle = document.createElement('h3')
        loadTitle.textContent = "Cargar Mapa"
        loadTitle.style.margin = "0"
        loadTitle.style.borderBottom = "1px solid #555"
        loadTitle.style.paddingBottom = "10px"

        const loadInfo = document.createElement('p')
        loadInfo.textContent = "Selecciona un archivo JSON previamente guardado para cargarlo."
        loadInfo.style.color = "#aaa"
        loadInfo.style.fontSize = "14px"
        loadInfo.style.margin = "0"

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.json'
        fileInput.style.color = "white"

        const loadBtn = document.createElement('button')
        loadBtn.textContent = "Cargar Mapa"
        loadBtn.style.cssText = baseBtnStyle
        loadBtn.onmouseover = () => loadBtn.style.background = "#656565ff"
        loadBtn.onmouseout = () => loadBtn.style.background = "#545454ff"
        loadBtn.onclick = () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0]
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result)
                        if (this.game.loadMap) {
                            this.game.loadMap(json)
                            // Interval updates preview normally
                            setTimeout(updateJson, 100)
                            alert("Mapa cargado correctamente!")
                        } else {
                            alert("Error: Función loadMap no encontrada en el juego.")
                        }
                    } catch (err) {
                        alert("Error al parsear el archivo JSON: " + err)
                    }
                }
                reader.readAsText(file)
            } else {
                alert("Por favor selecciona un archivo primero.")
            }
        }

        loadSection.appendChild(loadTitle)
        loadSection.appendChild(loadInfo)
        loadSection.appendChild(fileInput)
        loadSection.appendChild(loadBtn)

        // Collab Section
        const collabSection = document.createElement('div')
        collabSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `

        const collabTitle = document.createElement('h3')
        collabTitle.textContent = 'Edición Colaborativa'
        collabTitle.style.cssText = `margin: 0; border-bottom: 1px solid #555; padding-bottom: 10px;`
        collabSection.appendChild(collabTitle)

        // Indicador de estado
        const statusRow = document.createElement('div')
        statusRow.style.cssText = `display: flex; align-items: center; gap: 8px;`

        const statusDot = document.createElement('span')
        statusDot.style.cssText = `
            width: 9px; height: 9px; border-radius: 50%;
            background: #555; display: inline-block; flex-shrink: 0;
            transition: background 0.3s;
        `
        const statusText = document.createElement('span')
        statusText.style.cssText = `font-size: 13px; color: #888; transition: color 0.3s;`
        statusText.textContent = 'Desactivado'

        statusRow.appendChild(statusDot)
        statusRow.appendChild(statusText)
        collabSection.appendChild(statusRow)

        // Botón toggle
        const collabBtn = document.createElement('button')
        collabBtn.textContent = 'Abrir Colaborativo'
        collabBtn.style.cssText = baseBtnStyle
        collabBtn.onmouseover = () => collabBtn.style.background = '#656565ff'
        collabSection.appendChild(collabBtn)

        // Bloque del link
        const linkBlock = document.createElement('div')
        linkBlock.style.cssText = `display: none; flex-direction: column; gap: 8px; border-top: 1px solid #555; padding-top: 12px;`

        const linkLabel = document.createElement('label')
        linkLabel.textContent = 'Link para compartir con colaboradores:'
        linkLabel.style.cssText = `font-size: 13px; color: #aaa;`

        const linkInput = document.createElement('input')
        linkInput.type = 'text'
        linkInput.readOnly = true
        linkInput.style.cssText = `
            background: #1a1a1a; color: #ccc;
            border: 1px solid #555; border-radius: 4px;
            padding: 8px 10px; font-size: 12px; font-family: monospace;
            cursor: pointer; outline: none; width: 100%; box-sizing: border-box;
        `
        linkInput.onfocus = () => linkInput.select()

        const copyBtn = document.createElement('button')
        copyBtn.textContent = 'Copiar Link'
        copyBtn.style.cssText = `
            background: #545454ff; color: white;
            border: none; padding: 10px;
            border-radius: 6px; cursor: pointer; font-size: 14px;
            font-weight: bold; transition: background 0.2s;
        `
        copyBtn.onmouseover = () => copyBtn.style.background = '#656565ff'
        copyBtn.onmouseout = () => copyBtn.style.background = '#545454ff'
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                copyBtn.textContent = '¡Copiado!'
                setTimeout(() => { copyBtn.textContent = 'Copiar Link' }, 2000)
            }).catch(() => {
                linkInput.select(); document.execCommand('copy')
                copyBtn.textContent = '¡Copiado!'
                setTimeout(() => { copyBtn.textContent = 'Copiar Link' }, 2000)
            })
        }

        linkBlock.appendChild(linkLabel)
        linkBlock.appendChild(linkInput)
        linkBlock.appendChild(copyBtn)

        collabSection.appendChild(linkBlock)

        // Lógica del toggle
        let collabActive = false
        const buildLink = () => {
            const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
            return `${proto}//${window.location.host}/editor/#${this.game.roomId || ''}`
        }
        const applyCollabState = (active) => {
            statusDot.style.background = active ? '#22c55e' : '#555'
            statusText.textContent = active ? 'Colaborativo ACTIVO' : 'Desactivado'
            statusText.style.color = active ? '#22c55e' : '#888'
            collabBtn.textContent = active ? 'Cerrar Colaborativo' : 'Abrir Colaborativo'
            collabBtn.style.background = active ? '#1d4d1d' : '#545454ff'
            collabBtn.onmouseout = () => collabBtn.style.background = active ? '#1d4d1d' : '#545454ff'
            linkBlock.style.display = active ? 'flex' : 'none'
        }

        collabBtn.onclick = () => {
            collabActive = !collabActive
            if (this.game.networkManager) this.game.networkManager.collaborativeMode = collabActive
            if (collabActive) linkInput.value = buildLink()
            applyCollabState(collabActive)
        }

        // Restaurar estado si ya estaba activo al re-abrir el panel
        if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
            collabActive = true
            linkInput.value = buildLink()
            applyCollabState(true)
        }

        leftColumn.appendChild(saveSection)
        leftColumn.appendChild(loadSection)
        leftColumn.appendChild(collabSection)

        container.appendChild(leftColumn)
        container.appendChild(rightColumn)
        
        // Initial setup
        setTimeout(updateJson, 50);
    }



    renderLibraryGrid(container, items) {
        // Populate Grid
        items.forEach(item => {
            const card = document.createElement('div')
            card.draggable = true
            card.style.cssText = `
                background: #333;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                cursor: pointer;
                transition: transform 0.1s;
                user-select: none;
            `
            card.onmouseover = () => {
                if (this.selectedItem !== item) card.style.background = "#444"
                else card.style.background = "#555"
            }
            card.onmouseout = () => {
                if (this.selectedItem !== item) card.style.background = "#333"
                else card.style.background = "#555"
            }
            card.onclick = () => {
                // Update selection UI
                Array.from(container.children).forEach(c => c.style.border = "none")
                card.style.border = "2px solid #00FF00"
                this.selectItem(item)
            }

            const img = document.createElement('img')
            img.src = item.iconPath
            img.style.width = "64px"
            img.style.height = "64px"
            img.style.objectFit = "contain"
            img.draggable = false

            const lbl = document.createElement('span')
            lbl.textContent = item.name
            lbl.style.fontSize = "12px"
            lbl.style.textAlign = "center"

            card.appendChild(img)
            card.appendChild(lbl)

            // Drag Events (Default White)
            card.addEventListener('dragstart', (e) => {
                this.draggedItem = item
                e.dataTransfer.effectAllowed = "copy"
                e.dataTransfer.setData("text/plain", "item")
            })

            container.appendChild(card)
        })
    }

    renderLibraryPanel(container) {
        // Placeholder State
        this.panelPlaceholder = document.createElement('div')
        this.panelPlaceholder.textContent = "Selecciona un elemento para editar"
        this.panelPlaceholder.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            text-align: center;
        `

        // Editor State
        this.panelEditor = document.createElement('div')
        this.panelEditor.style.cssText = `
            display: none; /* Hidden init */
            flex-direction: column;
            gap: 15px;
            align-items: center;
            width: 100%;
        `

        // 1. Title
        this.editorTitle = document.createElement('h3')
        this.editorTitle.style.margin = "0"
        this.editorTitle.style.borderBottom = "1px solid #444"
        this.editorTitle.style.width = "100%"
        this.editorTitle.style.textAlign = "center"
        this.editorTitle.style.paddingBottom = "10px"

        // 2. Large Preview (Draggable)
        this.editorPreview = document.createElement('div')
        this.editorPreview.draggable = true
        this.editorPreview.style.cssText = `
            width: 128px;
            height: 128px;
            background: #111;
            border: 2px dashed #444;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            transition: 0.2s;
        `
        this.editorPreview.onmouseover = () => this.editorPreview.style.borderColor = "#fff"
        this.editorPreview.onmouseout = () => this.editorPreview.style.borderColor = "#444"

        this.editorImg = document.createElement('img')
        this.editorImg.style.width = "100%"
        this.editorImg.style.height = "100%"
        this.editorImg.style.objectFit = "contain"
        this.editorImg.draggable = false

        this.editorPreview.appendChild(this.editorImg)

        // Drag Logic for Custom Item
        this.editorPreview.addEventListener('dragstart', (e) => {
            if (this.currentDraftItem) {
                this.draggedItem = this.currentDraftItem
                e.dataTransfer.effectAllowed = "copy"
                e.dataTransfer.setData("text/plain", "item")
            }
        })

        // 3. Color Controls Setup
        const controlsContainer = document.createElement('div')
        controlsContainer.style.width = "100%"
        controlsContainer.style.display = "flex"
        controlsContainer.style.flexDirection = "column"
        controlsContainer.style.gap = "10px"

        // Color Picker Row
        const pickerRow = document.createElement('div')
        pickerRow.style.display = "flex"
        pickerRow.style.alignItems = "center"
        pickerRow.style.justifyContent = "space-between"

        const pickerLabel = document.createElement('span')
        pickerLabel.textContent = "Color:"

        this.colorPicker = document.createElement('input')
        this.colorPicker.type = "color"
        this.colorPicker.style.border = "none"
        this.colorPicker.style.width = "40px"
        this.colorPicker.style.height = "40px"
        this.colorPicker.style.cursor = "pointer"
        this.colorPicker.style.backgroundColor = "transparent"
        this.colorPicker.addEventListener('input', (e) => {
            this.updateDraftColor(e.target.value)
        })

        pickerRow.appendChild(pickerLabel)
        pickerRow.appendChild(this.colorPicker)
        controlsContainer.appendChild(pickerRow)

        // Opacity Control Row
        const opacityRow = document.createElement('div')
        opacityRow.style.display = "flex"
        opacityRow.style.alignItems = "center"
        opacityRow.style.justifyContent = "space-between"

        const opacityLabel = document.createElement('span')
        opacityLabel.textContent = "Opacidad (%):"

        this.opacityInput = document.createElement('input')
        this.opacityInput.type = "number"
        this.opacityInput.min = "0"
        this.opacityInput.max = "100"
        this.opacityInput.value = "100"
        this.opacityInput.style.width = "50px"
        this.opacityInput.style.background = "#333"
        this.opacityInput.style.color = "white"
        this.opacityInput.style.border = "1px solid #555"
        this.opacityInput.style.borderRadius = "4px"
        this.opacityInput.style.padding = "4px"

        this.opacityInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value)
            if (isNaN(val)) val = 100
            if (val < 0) val = 0
            if (val > 100) val = 100

            // Update Draft Item Opacity (0.0 - 1.0)
            this.updateDraftOpacity(val / 100.0)
        })

        opacityRow.appendChild(opacityLabel)
        opacityRow.appendChild(this.opacityInput)
        controlsContainer.appendChild(opacityRow)

        // Palette
        this.paletteContainer = document.createElement('div')
        this.paletteContainer.style.cssText = `
            display: flex; 
            flex-wrap: wrap; 
            gap: 5px; 
            justify-content: center;
            margin-top: 10px;
        `
        const colors = [
            "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF",
            "#FFFF00", "#00FFFF", "#FF00FF", "#FFA500", "#800080",
            "#40E0D0", "#FFC0CB", "#8B4513", "#808080"
        ]

        colors.forEach(c => {
            const swatch = document.createElement('div')
            swatch.style.cssText = `
                width: 24px; 
                height: 24px; 
                background-color: ${c}; 
                border-radius: 4px; 
                cursor: pointer; 
                border: 1px solid #555;
            `
            swatch.onclick = () => {
                this.colorPicker.value = c // Sync picker
                this.updateDraftColor(c)
            }
            this.paletteContainer.appendChild(swatch)
        })
        controlsContainer.appendChild(this.paletteContainer)

        // Add to panel
        this.panelEditor.appendChild(this.editorTitle)
        this.panelEditor.appendChild(this.editorPreview)
        this.panelEditor.appendChild(controlsContainer)

        // 4. Texture Controls
        const textureContainer = document.createElement('div')
        textureContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `

        const textureLabel = document.createElement('span')
        textureLabel.textContent = "Textura:"
        textureContainer.appendChild(textureLabel)

        const textureGrid = document.createElement('div')
        textureGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        `

        // Texture Options
        const textures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "/assets/textures/obj/brick.png", img: "/assets/textures/obj/brick.png" },
            { name: "Concreto", path: "/assets/textures/obj/concrete.png", img: "/assets/textures/obj/concrete.png" },
            { name: "Madera", path: "/assets/textures/obj/wood.png", img: "/assets/textures/obj/wood.png" },
            { name: "Hierro", path: "/assets/textures/obj/hierro.png", img: "/assets/textures/obj/hierro.png" }
        ]

        textures.forEach(tex => {
            const btn = document.createElement('div')
            btn.className = 'texture-btn'
            btn.title = tex.name
            btn.style.cssText = `
                width: 100%;
                aspect-ratio: 1;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
                background-color: ${tex.color || 'transparent'};
                background-image: ${tex.img ? `url(${tex.img})` : 'none'};
                background-size: cover;
                background-position: center;
            `
            btn.onclick = () => {
                this.updateDraftTexture(tex.path)
                // Highlight selection
                const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
                allBtns.forEach(c => c.style.borderColor = "#555")
                btn.style.borderColor = "#00FF00"
            }
            textureGrid.appendChild(btn)
        })
        textureContainer.appendChild(textureGrid)

        // Upload Button
        const uploadRow = document.createElement('div')
        uploadRow.style.cssText = `display: flex; gap: 5px;`

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = 'image/*'
        fileInput.style.display = 'none'
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (evt) => {
                    const dataUrl = evt.target.result
                    this.updateDraftTexture(dataUrl)
                    // Visual feedback
                    uploadBtn.textContent = "Textura Cargada"
                    uploadBtn.style.color = "#00FF00"

                    // Reset grid selection
                    const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
                    allBtns.forEach(c => c.style.borderColor = "#555")
                }
                reader.readAsDataURL(file)
            }
        })

        const uploadBtn = document.createElement('button')
        uploadBtn.id = 'texture-upload-btn'
        uploadBtn.textContent = "Subir Textura Personal"
        uploadBtn.style.cssText = `
            flex: 1;
            background: #444;
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `
        uploadBtn.onclick = () => fileInput.click()

        uploadRow.appendChild(fileInput)
        uploadRow.appendChild(uploadBtn)
        textureContainer.appendChild(uploadRow)

        this.panelEditor.appendChild(textureContainer)

        // 5. Dimension Controls
        const dimContainer = document.createElement('div')
        dimContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `
        const dimLabel = document.createElement('span')
        dimLabel.textContent = "Dimensiones (X, Y, Z):"
        dimContainer.appendChild(dimLabel)

        const dimRow = document.createElement('div')
        dimRow.style.cssText = `display: flex; gap: 5px;`

        const createDimInput = (axis, label) => {
            const container = document.createElement('div')
            container.style.cssText = `flex: 1; display: flex; flex-direction: column; gap: 2px;`

            const lbl = document.createElement('span')
            lbl.textContent = label
            lbl.style.fontSize = "10px"
            lbl.style.color = "#aaa"

            const input = document.createElement('input')
            input.type = "number"
            input.step = "0.5"
            input.min = "0.1"
            input.style.width = "100%"
            input.style.backgroundColor = "#333"
            input.style.color = "white"
            input.style.border = "1px solid #555"
            input.style.borderRadius = "4px"
            input.style.padding = "4px"
            input.onchange = (e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val > 0) {
                    this.updateDraftScale(axis, val)
                }
            }
            // Store ref to update later
            this[`inputDim${axis}`] = input

            container.appendChild(lbl)
            container.appendChild(input)
            return container
        }

        dimRow.appendChild(createDimInput('x', 'Ancho'))
        dimRow.appendChild(createDimInput('y', 'Alto'))
        dimRow.appendChild(createDimInput('z', 'Prof.'))

        dimContainer.appendChild(dimRow)
        this.panelEditor.appendChild(dimContainer)

        // --- NEW: Weapon Controls
        const weaponControlsContainer = document.createElement('div');
        weaponControlsContainer.style.cssText = `
            width: 100%;
            display: none;
            flex-direction: column;
            gap: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;

        const damageRow = document.createElement('div');
        damageRow.style.display = "flex";
        damageRow.style.alignItems = "center";
        damageRow.style.justifyContent = "space-between";

        const damageLabel = document.createElement('span');
        damageLabel.textContent = "Daño:";

        this.damageInput = document.createElement('input');
        this.damageInput.type = "number";
        this.damageInput.min = "0";
        this.damageInput.style.cssText = `
            width: 50px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        this.damageInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.damage = val;
            }
        });

        damageRow.appendChild(damageLabel);
        damageRow.appendChild(this.damageInput);

        const cooldownRow = document.createElement('div');
        cooldownRow.style.display = "flex";
        cooldownRow.style.alignItems = "center";
        cooldownRow.style.justifyContent = "space-between";

        const cooldownLabel = document.createElement('span');
        cooldownLabel.textContent = "Tiempo de Recarga (s):";

        this.cooldownInput = document.createElement('input');
        this.cooldownInput.type = "number";
        this.cooldownInput.step = "0.1";
        this.cooldownInput.min = "0";
        this.cooldownInput.style.cssText = this.damageInput.style.cssText;

        this.cooldownInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.cooldown = val;
            }
        });

        cooldownRow.appendChild(cooldownLabel);
        cooldownRow.appendChild(this.cooldownInput);

        const handRow = document.createElement('div');
        handRow.style.display = "flex";
        handRow.style.alignItems = "center";
        handRow.style.justifyContent = "space-between";

        const handLabel = document.createElement('span');
        handLabel.textContent = "Mano Equipada:";

        this.handSelect = document.createElement('select');
        this.handSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionRight = document.createElement('option');
        optionRight.value = "right";
        optionRight.textContent = "Derecha";
        const optionLeft = document.createElement('option');
        optionLeft.value = "left";
        optionLeft.textContent = "Izquierda";

        this.handSelect.appendChild(optionRight);
        this.handSelect.appendChild(optionLeft);

        this.handSelect.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.equippedHand = e.target.value;
            }
        });

        handRow.appendChild(handLabel);
        handRow.appendChild(this.handSelect);

        // --- Recoil Row ---
        const recoilRow = document.createElement('div');
        recoilRow.style.display = "flex";
        recoilRow.style.alignItems = "center";
        recoilRow.style.justifyContent = "space-between";

        const recoilLabel = document.createElement('span');
        recoilLabel.textContent = "Retroceso:";

        this.recoilInput = document.createElement('input');
        this.recoilInput.type = "number";
        this.recoilInput.min = "0";
        this.recoilInput.step = "0.5";
        this.recoilInput.style.cssText = `
            width: 60px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;
        this.recoilInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.recoil = val;
            }
        });

        recoilRow.appendChild(recoilLabel);
        recoilRow.appendChild(this.recoilInput);

        // --- Recoil Mode Row ---
        const recoilModeRow = document.createElement('div');
        recoilModeRow.style.display = "flex";
        recoilModeRow.style.alignItems = "center";
        recoilModeRow.style.justifyContent = "space-between";

        const recoilModeLabel = document.createElement('span');
        recoilModeLabel.textContent = "Modo Retroceso:";

        this.recoilModeSelect = document.createElement('select');
        this.recoilModeSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionHybrid = document.createElement('option');
        optionHybrid.value = "hybrid";
        optionHybrid.textContent = "Híbrido";
        const optionRecenter = document.createElement('option');
        optionRecenter.value = "recenter";
        optionRecenter.textContent = "Auto-Centrado";
        const optionManual = document.createElement('option');
        optionManual.value = "manual";
        optionManual.textContent = "Manual";

        this.recoilModeSelect.appendChild(optionHybrid);
        this.recoilModeSelect.appendChild(optionRecenter);
        this.recoilModeSelect.appendChild(optionManual);

        this.recoilModeSelect.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.recoilMode = e.target.value;
            }
        });

        recoilModeRow.appendChild(recoilModeLabel);
        recoilModeRow.appendChild(this.recoilModeSelect);

        // --- Auto-Fire Row ---
        const autoRow = document.createElement('div');
        autoRow.style.display = "flex";
        autoRow.style.alignItems = "center";
        autoRow.style.justifyContent = "space-between";

        const autoLabel = document.createElement('span');
        autoLabel.textContent = "Automático:";

        this.autoInput = document.createElement('input');
        this.autoInput.type = "checkbox";
        this.autoInput.style.cssText = `
            cursor: pointer;
            width: 18px;
            height: 18px;
        `;
        this.autoInput.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.isAuto = e.target.checked;
            }
        });

        autoRow.appendChild(autoLabel);
        autoRow.appendChild(this.autoInput);

        // --- Shot Speed Row ---
        const speedRow = document.createElement('div');
        speedRow.style.display = "flex";
        speedRow.style.alignItems = "center";
        speedRow.style.justifyContent = "space-between";

        const speedLabel = document.createElement('span');
        speedLabel.textContent = "Velocidad de Disparo:";

        this.speedInput = document.createElement('input');
        this.speedInput.type = "number";
        this.speedInput.min = "1";
        this.speedInput.step = "5";
        this.speedInput.style.cssText = this.recoilInput.style.cssText;
        this.speedInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.shotSpeed = val;
            }
        });

        speedRow.appendChild(speedLabel);
        speedRow.appendChild(this.speedInput);

        // --- Bullet Drop Row ---
        const dropRow = document.createElement('div');
        dropRow.style.display = "flex";
        dropRow.style.alignItems = "center";
        dropRow.style.justifyContent = "space-between";

        const dropLabel = document.createElement('span');
        dropLabel.textContent = "Gravedad (Caída):";

        this.dropInput = document.createElement('input');
        this.dropInput.type = "number";
        this.dropInput.step = "0.1";
        this.dropInput.style.cssText = this.recoilInput.style.cssText;
        this.dropInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.bulletDrop = val;
            }
        });

        dropRow.appendChild(dropLabel);
        dropRow.appendChild(this.dropInput);

        // --- Projectile Type Row ---
        const projectileTypeRow = document.createElement('div');
        projectileTypeRow.style.display = "flex";
        projectileTypeRow.style.alignItems = "center";
        projectileTypeRow.style.justifyContent = "space-between";

        const projectileTypeLabel = document.createElement('span');
        projectileTypeLabel.textContent = "Tipo de Proyectil:";

        this.projectileTypeSelect = document.createElement('select');
        this.projectileTypeSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionBullet = document.createElement('option');
        optionBullet.value = "bullet";
        optionBullet.textContent = "Bala";
        const optionBall = document.createElement('option');
        optionBall.value = "ball";
        optionBall.textContent = "Pelota";

        this.projectileTypeSelect.appendChild(optionBullet);
        this.projectileTypeSelect.appendChild(optionBall);

        this.projectileTypeSelect.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.projectileType = e.target.value;
            }
        });

        projectileTypeRow.appendChild(projectileTypeLabel);
        projectileTypeRow.appendChild(this.projectileTypeSelect);

        // --- Tracer Row ---
        const tracerRow = document.createElement('div');
        tracerRow.style.display = "flex";
        tracerRow.style.alignItems = "center";
        tracerRow.style.justifyContent = "space-between";

        const tracerLabel = document.createElement('span');
        tracerLabel.textContent = "Estela de Humo:";

        this.tracerInput = document.createElement('input');
        this.tracerInput.type = "checkbox";
        this.tracerInput.style.cssText = this.autoInput.style.cssText;
        this.tracerInput.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.hasTracer = e.target.checked;
            }
        });

        tracerRow.appendChild(tracerLabel);
        tracerRow.appendChild(this.tracerInput);

        // --- Trajectory Line Row ---
        const trajectoryRow = document.createElement('div');
        trajectoryRow.style.display = "flex";
        trajectoryRow.style.alignItems = "center";
        trajectoryRow.style.justifyContent = "space-between";

        const trajectoryLabel = document.createElement('span');
        trajectoryLabel.textContent = "Línea de Trayectoria (Roja):";

        this.trajectoryInput = document.createElement('input');
        this.trajectoryInput.type = "checkbox";
        this.trajectoryInput.style.cssText = this.autoInput.style.cssText;
        this.trajectoryInput.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.hasTrajectoryLine = e.target.checked;
            }
        });

        trajectoryRow.appendChild(trajectoryLabel);
        trajectoryRow.appendChild(this.trajectoryInput);

        // --- Rebote Row ---
        const reboteRow = document.createElement('div');
        reboteRow.style.display = "flex";
        reboteRow.style.alignItems = "center";
        reboteRow.style.justifyContent = "space-between";

        const reboteLabel = document.createElement('span');
        reboteLabel.textContent = "Rebote al chocar:";

        this.reboteInput = document.createElement('input');
        this.reboteInput.type = "checkbox";
        this.reboteInput.style.cssText = this.autoInput.style.cssText;
        this.reboteInput.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.rebote = e.target.checked;
            }
        });

        reboteRow.appendChild(reboteLabel);
        reboteRow.appendChild(this.reboteInput);

        // --- Impact Effect Row ---
        const impactRow = document.createElement('div');
        impactRow.style.display = "flex";
        impactRow.style.alignItems = "center";
        impactRow.style.justifyContent = "space-between";

        const impactLabel = document.createElement('span');
        impactLabel.textContent = "Impacto (Humo):";

        this.impactInput = document.createElement('input');
        this.impactInput.type = "checkbox";
        this.impactInput.style.cssText = this.autoInput.style.cssText;
        this.impactInput.addEventListener('change', (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === 'weapon') {
                this.currentDraftItem.hasImpactEffect = e.target.checked;
            }
        });

        impactRow.appendChild(impactLabel);
        impactRow.appendChild(this.impactInput);

        weaponControlsContainer.appendChild(damageRow);
        weaponControlsContainer.appendChild(cooldownRow);
        weaponControlsContainer.appendChild(handRow);
        weaponControlsContainer.appendChild(recoilRow);
        weaponControlsContainer.appendChild(recoilModeRow);
        weaponControlsContainer.appendChild(autoRow);
        weaponControlsContainer.appendChild(speedRow);
        weaponControlsContainer.appendChild(dropRow);
        weaponControlsContainer.appendChild(projectileTypeRow);
        weaponControlsContainer.appendChild(tracerRow);
        weaponControlsContainer.appendChild(trajectoryRow);
        weaponControlsContainer.appendChild(reboteRow);
        weaponControlsContainer.appendChild(impactRow);

        this.panelEditor.appendChild(weaponControlsContainer);

        // Save References for toggling
        this.editorConstructionControls = controlsContainer;
        this.editorTextureContainer = textureContainer;
        this.editorDimContainer = dimContainer;
        this.editorWeaponControlsContainer = weaponControlsContainer;

        const dragHint = document.createElement('div')
        dragHint.textContent = "Arrastra la imagen superior a tu inventario"
        dragHint.style.fontSize = "12px"
        dragHint.style.color = "#888"
        dragHint.style.marginTop = "auto"
        dragHint.style.textAlign = "center"
        this.panelEditor.appendChild(dragHint)

        container.appendChild(this.panelPlaceholder)
        container.appendChild(this.panelEditor)
    }

    selectItem(baseItem) {
        this.selectedItem = baseItem

        // Show Editor
        this.panelPlaceholder.style.display = 'none'
        this.panelEditor.style.display = 'flex'

        this.editorTitle.textContent = baseItem.name

        // Init Draft - CRITICAL: Copy scale object to avoid mutation
        const scaleCopy = { ...baseItem.scale }
        this.createDraft(baseItem.id, baseItem.name, baseItem.type, baseItem.color, scaleCopy, baseItem.texturePath, baseItem)

        if (baseItem.type === 'weapon') {
            this.editorConstructionControls.style.display = 'none';
            this.editorTextureContainer.style.display = 'none';
            this.editorDimContainer.style.display = 'none';
            this.editorWeaponControlsContainer.style.display = 'flex';

            this.damageInput.value = baseItem.damage !== undefined ? baseItem.damage : 10;
            this.cooldownInput.value = baseItem.cooldown !== undefined ? baseItem.cooldown : 0.5;
            this.handSelect.value = baseItem.equippedHand !== undefined ? baseItem.equippedHand : "right";
            this.recoilInput.value = baseItem.recoil !== undefined ? baseItem.recoil : 5.0;
            this.recoilModeSelect.value = baseItem.recoilMode !== undefined ? baseItem.recoilMode : "hybrid";
            this.autoInput.checked = baseItem.isAuto !== undefined ? baseItem.isAuto : false;
            this.projectileTypeSelect.value = baseItem.projectileType !== undefined ? baseItem.projectileType : "bullet";
            this.speedInput.value = baseItem.shotSpeed !== undefined ? baseItem.shotSpeed : 50.0;
            this.dropInput.value = baseItem.bulletDrop !== undefined ? baseItem.bulletDrop : 1.0;
            this.tracerInput.checked = baseItem.hasTracer !== undefined ? baseItem.hasTracer : false;
            this.trajectoryInput.checked = baseItem.hasTrajectoryLine !== undefined ? baseItem.hasTrajectoryLine : false;

            // Set rebote from item, defaulting to true if it's a "ball", otherwise false
            let defaultRebote = baseItem.projectileType === "ball" ? true : false;
            this.reboteInput.checked = baseItem.rebote !== undefined ? baseItem.rebote : defaultRebote;
            this.impactInput.checked = baseItem.hasImpactEffect !== undefined ? baseItem.hasImpactEffect : false;
        } else {
            this.editorConstructionControls.style.display = 'flex';
            this.editorTextureContainer.style.display = 'flex';
            this.editorDimContainer.style.display = 'flex';
            this.editorWeaponControlsContainer.style.display = 'none';

            // Reset color picker
            const hex = baseItem.color !== undefined ? '#' + new THREE.Color(baseItem.color).getHexString() : '#ffffff';
            this.colorPicker.value = hex
            this.updateDraftColor(hex)
        }

        // Reset Texture UI
        const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
        allBtns.forEach(c => c.style.borderColor = "#555")
        // Select None (first one) by default if baseItem has no texture
        if (allBtns.length > 0) allBtns[0].style.borderColor = "#00FF00"

        const uploadBtn = this.panelEditor.querySelector('#texture-upload-btn')
        if (uploadBtn) {
            uploadBtn.textContent = "Subir Textura Personal"
            uploadBtn.style.color = "white"
        }

        // Reset Inputs
        if (this.inputDimx) this.inputDimx.value = scaleCopy.x
        if (this.inputDimy) this.inputDimy.value = scaleCopy.y
        if (this.inputDimz) this.inputDimz.value = scaleCopy.z
    }

    createDraft(id, name, type, color, scale, texturePath = null, baseItem = null) {
        if (type === 'weapon' && baseItem && baseItem.clone) {
            this.currentDraftItem = baseItem.clone();
        } else {
            this.currentDraftItem = new MapObjectItem(id, name, type, "", color, scale, texturePath)
        }

        // Init Image
        if (this.editorImg) {
            this.editorImg.src = this.currentDraftItem.iconPath
        }
    }

    updateDraftColor(hexColor) {
        if (!this.currentDraftItem) return

        // Update model logic
        this.currentDraftItem.color = parseInt(hexColor.replace('#', '0x'))

        // Regenerate Icon
        this.currentDraftItem.iconPath = this.currentDraftItem.generateIcon()

        // Update Preview
        if (this.editorImg) {
            this.editorImg.src = this.currentDraftItem.iconPath
        }

        // Also update preview border to match?
        this.editorPreview.style.borderColor = hexColor
    }

    updateDraftOpacity(opacity) {
        if (!this.currentDraftItem) return

        // Store opacity in userData-like structure or directly on item if supported
        // MapObjectItem might need to hold 'opacity'. 
        // Let's check MapObjectItem structure. It has logicProperties but maybe not generic properties?
        // Let's add it to logicProperties for now or extend usage.
        // Actually, MapObjectItem is a template. modifying it modifies the referenced item in Library?
        // NO. `currentDraftItem` is likely a clone or reference.
        // `selectItem` creates `currentDraftItem`.

        // Ensure property exists
        if (!this.currentDraftItem.opacity) this.currentDraftItem.opacity = 1.0

        this.currentDraftItem.opacity = opacity

        // Visual feedback on preview border transparency?
        // User requested NO invisible image. So we keep it opaque or maybe just hint it.
        // this.editorPreview.style.opacity = opacity 
    }

    updateDraftTexture(texturePath) {
        if (!this.currentDraftItem) return
        this.currentDraftItem.texturePath = texturePath
    }

    updateDraftScale(axis, value) {
        if (!this.currentDraftItem) return
        this.currentDraftItem.scale[axis] = value
    }

    toggle() {
        this.isVisible = !this.isVisible
        this.container.style.display = this.isVisible ? 'flex' : 'none'

        if (this.isVisible) {
            // Auto-refresh if Logic Tab is active
            if (this.contentLogic.style.display === 'flex') {
                this.refreshLogicList()
            }
        }

        // Pause Game Input / Pointer Lock
        if (this.isVisible) {
            document.exitPointerLock()
            if (this.game.inputManager) {
                this.game.inputManager.enabled = false
                if (this.game.inputManager.reset) this.game.inputManager.reset()
                this.game.isMouseDown = false // Clear stickiness
            }
        } else {
            // Resume
            if (this.game.inputManager) {
                this.game.inputManager.enabled = true
                if (this.game.inputManager.reset) this.game.inputManager.reset()
            }

            // Re-request pointer lock after a small delay to ensure browser handles it
            setTimeout(() => {
                if (this.game.cameraController) {
                    this.game.cameraController.lock()
                } else {
                    document.body.requestPointerLock()
                }
            }, 100)
        }
    }

    refreshLogicList() {
        if (!this.logicTreePanel) return

        this.logicTreePanel.innerHTML = ""

        // Use LogicSystem to scan
        const logicObjects = this.logicSystem.scanScene(this.game.sceneManager.scene)

        if (logicObjects.length === 0) {
            this.logicTreePanel.innerHTML = `<div style="color:#666; text-align:center; padding:10px;">No hay objetos lógicos en la escena.</div>`
            const info = document.createElement('div')
            info.style.cssText = "color:#888; font-size:12px; text-align:center; margin-top:10px; padding:10px;"
            info.innerHTML = "Aplica lógica con herramientas<br>(ej. Control de Movimiento)"
            this.logicTreePanel.appendChild(info)
            return
        }

        // Group by Logic Type
        const groups = {}
        logicObjects.forEach(obj => {
            let type = "other"

            // Determine primary logic category
            if (obj.userData.mapObjectType === 'spawn_point') {
                type = 'spawn_point'
            } else if (obj.userData.logicProperties && obj.userData.logicProperties.waypoints) {
                type = 'movement_object'
            } else {
                // Fallback to base type if it has some other unknown logic
                type = obj.userData.mapObjectType || "Desconocido"
            }

            if (!groups[type]) groups[type] = []
            groups[type].push(obj)
        })

        // Render Groups
        for (const [type, objs] of Object.entries(groups)) {
            // Group Header
            const groupDetails = document.createElement('details')
            groupDetails.open = true
            groupDetails.style.cssText = `background: #333; border-radius: 4px; margin-bottom: 5px;`

            const summary = document.createElement('summary')
            summary.textContent = `${this.logicSystem.getHumanReadableName(type)} (${objs.length})`
            summary.style.cssText = `padding: 8px; cursor: pointer; font-weight: bold; user-select: none;`

            groupDetails.appendChild(summary)

            const list = document.createElement('div')
            list.style.cssText = `display: flex; flex-direction: column; padding: 5px; gap: 2px;`

            objs.forEach((obj, index) => {
                const itemRow = document.createElement('div')

                // Determine Name: Use signalName if available, otherwise name, otherwise default
                let displayName = `Objeto #${index + 1}`
                if (obj.userData.logicProperties) {
                    if (obj.userData.logicProperties.signalName) displayName = obj.userData.logicProperties.signalName
                    else if (obj.userData.logicProperties.name) displayName = obj.userData.logicProperties.name
                }

                itemRow.textContent = displayName
                itemRow.style.cssText = `padding: 6px; background: #2a2a2a; cursor: pointer; border-radius: 4px; font-size: 14px; user-select: none;`

                // Pre-highlight if selected
                if (this.selectedLogicObject === obj) {
                    itemRow.style.background = "#555"
                }

                itemRow.onmouseover = () => {
                    // Don't change if currently editing (input exists)
                    if (itemRow.querySelector('input')) return
                    itemRow.style.background = "#444"
                }
                itemRow.onmouseout = () => {
                    if (itemRow.querySelector('input')) return
                    if (this.selectedLogicObject !== obj) itemRow.style.background = "#2a2a2a"
                    else itemRow.style.background = "#555"
                }

                // Single Click: Select
                itemRow.onclick = (e) => {
                    if (itemRow.querySelector('input')) return // Ignore if editing

                    // Visual Selection
                    const allRows = this.logicTreePanel.querySelectorAll('div div')
                    allRows.forEach(r => r.style.background = "#2a2a2a")
                    itemRow.style.background = "#555"

                    this.selectedLogicObject = obj
                    this.renderLogicProperties(obj)
                }

                // Double Click: Rename
                itemRow.ondblclick = (e) => {
                    e.stopPropagation()

                    // Create Input
                    const input = document.createElement('input')
                    input.type = 'text'
                    input.value = displayName
                    input.style.cssText = `
                        width: 100%; 
                        background: #111; 
                        color: white; 
                        border: 1px solid #00FF00; 
                        padding: 2px 4px; 
                        font-size: 14px; 
                        border-radius: 2px;
                        outline: none;
                    `

                    // Replace content
                    itemRow.textContent = ''
                    itemRow.appendChild(input)
                    input.focus()
                    // Select all text
                    input.select()

                    // Prevent click propagation from input so it doesn't trigger row onClick
                    input.onclick = (ev) => ev.stopPropagation()

                    const confirm = () => {
                        let newName = input.value.trim()
                        if (!newName) newName = `Objeto #${index + 1}`

                        // Update Logic Props
                        if (!obj.userData.logicProperties) obj.userData.logicProperties = {}

                        // Set requested properties
                        obj.userData.logicProperties.signalName = newName
                        obj.userData.logicProperties.name = newName

                        // Refresh to show new name and restore UI
                        this.refreshLogicList()

                        // Refresh properties panel if currently selected
                        if (this.selectedLogicObject === obj) {
                            this.renderLogicProperties(obj)
                        }
                    }

                    input.onblur = confirm
                    input.onkeydown = (ev) => {
                        ev.stopPropagation()
                        if (ev.key === 'Enter') {
                            confirm()
                        }
                    }
                }

                list.appendChild(itemRow)
            })

            groupDetails.appendChild(list)
            this.logicTreePanel.appendChild(groupDetails)
        }
    }

    getHumanReadableName(type) {
        return this.logicSystem ? this.logicSystem.getHumanReadableName(type) : type
    }

    renderLogicProperties(object) {
        if (!this.logicPropertiesPanel) return
        // Delegate to Logic System
        this.logicSystem.renderPanel(this.logicPropertiesPanel, object, () => {
            this.refreshLogicList()
        })
    }

    selectLogicObject(targetObject) {
        if (!targetObject) return

        // 1. Switch to Logic Tab
        this.switchTab('logic')

        // 2. Ensure list is fresh
        this.refreshLogicList()

        // 3. Find and Highlight in Tree
        // We need to match the object in the tree. 
        // Our refreshLogicList recreates the tree. 
        // We need to iterate the tree and find the one matching targetObject.
        this.selectedLogicObject = targetObject

        // Render Properties
        this.renderLogicProperties(targetObject)

        // Visual Highlight in Tree (Best effort search)
        // We scan the groups in the panel
        const details = this.logicTreePanel.querySelectorAll('details')
        details.forEach(det => {
            // Check if this group contains our object? 
            // The rows are anonymous divs, but we assigned onclick handlers closing over 'obj'.
            // We can't easily find the DOM element back from the object unless we store it.
            // Let's rely on re-rendering or flagging.
            // Actually, since we just called refreshLogicList, the DOM is new.
            // We can't find it easily without rebuilding with a "selected" flag passed to refreshLogicList?
            // Or we just update the visual style here if we can identify it.

            // Simpler: Let's modify refreshLogicList to accept a 'selectedObject' param to highlight it during render?
            // Or just manually iterate 'groups' again (inefficient).

            // Let's modify refreshLogicList slightly to handle 'this.selectedLogicObject' automatically?
            // Yes, refreshLogicList already uses 'this.selectedLogicObject' to verify background color in onmouseout.
            // But it doesn't set the INITIAL background color based on it.
        })

        // Re-call refreshLogicList to apply the visual highlight (since we set this.selectedLogicObject above)
        this.refreshLogicList()
    }
    startPickingTarget(controllerObj) {
        if (!controllerObj) return

        this.isPickingTarget = true
        this.pickingController = controllerObj
        this.container.style.display = 'none' // Hide menu
        // Game will detect click via main_rapier.js and call logic ?
        // Or we need to update state in Game?
        // Game has 'isPickingTarget' logic inside main_rapier? 
        // Let's check main_rapier.js to see if it reads from constructionMenu.
        // Yes: if (this.constructionMenu && this.constructionMenu.isPickingTarget) ...

        // We also need to hide LogicToolbar if it's open (which it likely is)
        if (this.logicSystem) {
            this.logicSystem.toolbar.hide()
        }

        alert("Modo Vinculación: Haz clic derecho sobre el objeto objetivo para vincularlo.")
    }
}

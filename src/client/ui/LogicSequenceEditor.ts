// @ts-nocheck

import { InspectorUtils } from "./logic_items/InspectorUtils"
import {
    degreesToRadians,
    describeRotationTurns,
    getWaypointPosition,
    getWaypointRotation,
    getWaypointRotationTurns,
    getWaypointScale,
    normalizeMovementWaypoint,
    radiansToDegrees,
} from "../utils/MovementWaypointUtils"

export class LogicSequenceEditor {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null
        this.currentObject = null
        this.currentSeqIndex = -1
    }

    createUI() {
        if (this.container) return this.container

        const div = document.createElement('div')
        div.id = 'logic-sequence-editor'

        // --- Header ---
        const header = document.createElement('div')
        header.className = 'lse-header'

        const title = document.createElement('div')
        title.className = 'lse-title'
        title.innerHTML = `Editor de Secuencia <span id="seq-editor-subtitle" class="lse-subtitle"></span>`
        header.appendChild(title)

        const closeBtn = document.createElement('button')
        closeBtn.textContent = "Cerrar & Guardar"
        closeBtn.className = 'lse-close-btn'
        closeBtn.onclick = () => this.close()
        header.appendChild(closeBtn)

        div.appendChild(header)

        // --- Main Content (Split View) ---
        const content = document.createElement('div')
        content.className = 'lse-content'
        div.appendChild(content)

        // LEFT: Properties & Triggers
        const sidebar = document.createElement('div')
        sidebar.className = 'lse-sidebar'
        sidebar.id = "seq-editor-sidebar"
        content.appendChild(sidebar)

        // RIGHT: Timeline
        const timelineArea = document.createElement('div')
        timelineArea.className = 'lse-timeline'
        timelineArea.id = "seq-editor-timeline"
        content.appendChild(timelineArea)

        this.container = div
        document.body.appendChild(this.container)

        // Elements references
        this.subtitle = title.querySelector('#seq-editor-subtitle')
        this.sidebar = sidebar
        this.timeline = timelineArea

        return this.container
    }

    open(object, sequenceIndex) {
        if (!object || sequenceIndex < 0) return

        this.currentObject = object
        this.currentSeqIndex = sequenceIndex

        // Ensure UI exists
        this.createUI()
        this.container.style.display = 'flex'

        // Hide other menus if needed (optional)
        // logicSystem.toolbar usually stays? Construction menu might be hidden.

        this.render()
    }

    close() {
        if (this.container) this.container.style.display = 'none'

        // Capture obj before clearing
        const obj = this.currentObject

        // CLEAR references so LogicSystem doesn't think we are still editing
        this.currentObject = null
        this.currentSeqIndex = -1

        // We want to update visualization to HIDE the partial lines
        this.logicSystem.updateVisualization()

        // Refresh the main panel in LogicSystem if we were editing the same object
        if (this.logicSystem.editingObject === obj && this.logicSystem.currentPanelContainer) {
            this.logicSystem.renderPanel(this.logicSystem.currentPanelContainer, obj)
        }
    }

    render() {
        this.logicSystem.ensureMovementSequences(this.currentObject.userData.logicProperties, this.currentObject)
        const seq = this.currentObject.userData.logicProperties.sequences[this.currentSeqIndex]
        if (!seq) return

        this.subtitle.textContent = `: ${seq.name}`

        // --- SIDEBAR ---
        this.sidebar.innerHTML = ""

        // 1. General Props
        const propsHeader = document.createElement('h4')
        propsHeader.textContent = "Propiedades"
        this.sidebar.appendChild(propsHeader)

        this.createInput(this.sidebar, seq, 'name', seq.name, 'text', 'Nombre')
        this.createInput(this.sidebar, seq, 'loop', seq.loop, 'boolean', 'Bucle')
        this.createInput(this.sidebar, seq, 'speed', seq.speed, 'number', 'Velocidad')
        this.createInput(this.sidebar, seq, 'active', seq.active, 'boolean', 'Activo al Inicio')

        // --- TRIGGER SECTION ---
        const trigHeader = document.createElement('h4')
        trigHeader.textContent = "Disparador (Trigger)"
        trigHeader.style.marginTop = "15px"
        this.sidebar.appendChild(trigHeader)

        // Trigger Type
        const typeRow = document.createElement('div')
        typeRow.className = 'lse-input-row'
        const typeLabel = document.createElement('label')
        typeLabel.className = 'lse-input-label'
        typeLabel.textContent = "Tipo"

        const typeSelect = document.createElement('select')
        typeSelect.className = 'lse-input'
        typeSelect.innerHTML = `
            <option value="none">Ninguno (Manual/Auto)</option>
            <option value="signal">Señal de Botón</option>
        `
        typeSelect.value = seq.triggerType || "none"
        typeSelect.onchange = (e) => {
            seq.triggerType = e.target.value
            this.render()
        }
        typeRow.appendChild(typeLabel)
        typeRow.appendChild(typeSelect)
        this.sidebar.appendChild(typeRow)

        // Trigger Buttons (If Signal)
        if (seq.triggerType === 'signal') {
            const btnList = document.createElement('div')
            btnList.style.marginTop = "5px"

            // Ensure array
            if (!seq.triggerSignals) {
                seq.triggerSignals = []
                if (seq.triggerSignal) seq.triggerSignals.push({ id: seq.triggerSignal, name: "Botón" })
            }

            seq.triggerSignals.forEach((btnData, idx) => {
                const btnRow = document.createElement('div')
                btnRow.style.cssText = "display:flex; justify-content:space-between; background:#222; padding:4px; margin-bottom:2px; border:1px solid #444; font-size:12px; color:#ddd;"
                btnRow.innerHTML = `
                    <span>${btnData.name}</span>
                    <span style="cursor:pointer; color:#f44; font-weight:bold;">x</span>
                `
                btnRow.querySelector('span:last-child').onclick = () => {
                    seq.triggerSignals.splice(idx, 1)
                    this.render()
                }
                btnList.appendChild(btnRow)
            })

            const addTrigBtn = document.createElement('button')
            addTrigBtn.textContent = "+ Agregar Señal Disparador"
            addTrigBtn.style.cssText = "width:100%; background:#333; border: 1px dashed #555; color:#aaa; font-size:10px; padding:4px; cursor:pointer;"
            addTrigBtn.onclick = () => {
                this.showSignalSelector((selectedObj, type) => {
                    const name = selectedObj.userData.logicProperties && selectedObj.userData.logicProperties.name
                        ? selectedObj.userData.logicProperties.name
                        : (type === 'button' ? "Botón" : "Colisión")
                    seq.triggerSignals.push({ id: selectedObj.userData.uuid, name: name })
                    this.render()
                })
            }
            btnList.appendChild(addTrigBtn)
            this.sidebar.appendChild(btnList)
        }

        // --- MAP 3D EDIT BUTTON ---
        const map3dBtn = document.createElement('button')
        map3dBtn.textContent = "Editar en Mapa 3D"
        map3dBtn.className = 'lse-map-btn'
        map3dBtn.onclick = () => {
            const obj = this.currentObject
            const idx = this.currentSeqIndex
            this.close() // Close editor
            // Trigger map edit mode for this sequence
            this.logicSystem.startMapEdit(obj, idx)
        }
        this.sidebar.appendChild(map3dBtn)


        // --- TIMELINE ---
        this.timeline.innerHTML = ""

        // Wrapper for buttons
        const btnWrapper = document.createElement('div')
        btnWrapper.style.cssText = "display: flex; gap: 10px; margin-bottom: 20px;"

        // Add Waypoint Button
        const addWpBtn = document.createElement('button')
        addWpBtn.textContent = "+ Punto (Posición)"
        addWpBtn.className = 'lse-add-btn'
        addWpBtn.style.marginBottom = "0"
        addWpBtn.style.flex = "1"
        addWpBtn.onclick = () => this.addWaypoint(seq)
        btnWrapper.appendChild(addWpBtn)

        const addSigBtn = document.createElement('button')
        addSigBtn.textContent = "+ Agregar Señal"
        addSigBtn.className = 'lse-add-btn'
        addSigBtn.style.background = "#cc7700"
        addSigBtn.style.marginBottom = "0"
        addSigBtn.style.flex = "1"
        addSigBtn.onclick = () => this.showSignalSelector((selectedObj, type) => {
            const name = selectedObj.userData.logicProperties && selectedObj.userData.logicProperties.name
                ? selectedObj.userData.logicProperties.name
                : (type === 'button' ? "Botón" : "Colisión")

            seq.waypoints.push({
                type: 'wait_signal',
                signalIds: [{ id: selectedObj.userData.uuid, name: name }]
            })
            this.render()
            this.logicSystem.updateVisualization()
        })
        btnWrapper.appendChild(addSigBtn)

        this.timeline.appendChild(btnWrapper)

        // Timeline Items
        seq.waypoints.forEach((wp, idx) => {
            const item = document.createElement('div')
            item.className = 'lse-item'
            item.draggable = true // Enable Drag

            // --- Drag and Drop Logic ---
            item.ondragstart = (e) => {
                this.draggedItemIndex = idx
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', idx)
                item.classList.add('lse-dragging')
            }

            item.ondragover = (e) => {
                e.preventDefault() // Necessary to allow dropping
                e.dataTransfer.dropEffect = 'move'
                item.classList.add('lse-drag-over')
            }

            item.ondragleave = (e) => {
                item.classList.remove('lse-drag-over')
            }

            item.ondrop = (e) => {
                e.preventDefault()
                item.classList.remove('lse-drag-over')
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'))
                const toIdx = idx

                if (fromIdx !== toIdx) {
                    // Reorder Array
                    const movedItem = seq.waypoints.splice(fromIdx, 1)[0]
                    seq.waypoints.splice(toIdx, 0, movedItem)
                    this.logicSystem.waypointGizmo.detach()
                    this.logicSystem.selectedWaypoint = null

                    this.render()
                    this.logicSystem.updateVisualization()
                    this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
                }
            }

            item.ondragend = (e) => {
                item.classList.remove('lse-dragging')
                // Cleanup any leftover styles
                this.timeline.querySelectorAll('.lse-item').forEach(el => el.classList.remove('lse-drag-over'))
            }

            // Add simple CSS for drag feedback if not already present
            if (!document.getElementById('lse-drag-styles')) {
                const style = document.createElement('style')
                style.id = 'lse-drag-styles'
                style.innerHTML = `
                        .lse-dragging { opacity: 0.5; border: 2px dashed #aaa !important; }
                        .lse-drag-over { border-top: 2px solid #00FF00 !important; box-shadow: 0 -2px 5px rgba(0,255,0,0.2); }
                    `
                document.head.appendChild(style)
            }

            if (wp.type === 'wait_signal') {
                item.style.borderLeftColor = "#cc7700"

                // Ensure array exists
                if (!wp.signalIds) {
                    wp.signalIds = []
                    if (wp.signalId) wp.signalIds.push({ id: wp.signalId, name: wp.signalName || "Botón" })
                }

                let buttonsHtml = ""
                wp.signalIds.forEach((btnData, btnIdx) => {
                    buttonsHtml += `
                            <div style="display:flex; justify-content:space-between; background:#333; padding:2px 5px; margin-bottom:2px; border-radius:3px;">
                                <span>${btnData.name}</span>
                                <span class="remove-btn-trigger" data-step-idx="${idx}" data-btn-idx="${btnIdx}" style="cursor:pointer; color:#f44;">x</span>
                            </div>
                        `
                })

                item.innerHTML = `
                        <div class="lse-item-header" style="cursor: grab;">
                            <strong>Paso #${idx + 1}</strong> <span style="color:#ffa500;">Esperar Señal(es)</span>
                            <span style="float:right; color:#666;">☰</span>
                        </div>
                        <div style="font-size:13px; color:#ddd; margin-bottom:5px;">
                            ${buttonsHtml}
                            <button class="add-btn-trigger" data-step-idx="${idx}" style="background:#444; border:none; color:#aaa; cursor:pointer; width:80%; font-size:10px; margin-top:5px; padding:4px;">+ Agregar Señal</button>
                        </div>
                    `

                // Add Event Listeners for dynamic buttons
                const removeBtns = item.querySelectorAll('.remove-btn-trigger')
                removeBtns.forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation()
                        const sIdx = parseInt(btn.dataset.stepIdx)
                        const bIdx = parseInt(btn.dataset.btnIdx)
                        seq.waypoints[sIdx].signalIds.splice(bIdx, 1)
                        this.render()
                    }
                })

                const addBtn = item.querySelector('.add-btn-trigger')
                addBtn.onclick = () => {
                    this.showSignalSelector((selectedObj, type) => {
                        const name = selectedObj.userData.logicProperties && selectedObj.userData.logicProperties.name
                            ? selectedObj.userData.logicProperties.name
                            : (type === 'button' ? "Botón" : "Colisión")
                        wp.signalIds.push({ id: selectedObj.userData.uuid, name: name })
                        this.render()
                    })
                }

            } else {
                // Standard Waypoint
                normalizeMovementWaypoint(wp, this.currentObject)
                const pos = getWaypointPosition(wp, this.currentObject)
                const rot = getWaypointRotation(wp, this.currentObject)
                const scale = getWaypointScale(wp, this.currentObject)
                const turns = getWaypointRotationTurns(wp)

                const header = document.createElement('div')
                header.className = 'lse-item-header'
                header.style.cursor = "grab"
                header.innerHTML = `
                    <strong>Paso #${idx + 1}</strong>
                    <span style='font-family:monospace; color:#aaa;'>[${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}]</span>
                    <span style="float:right; color:#666;">☰</span>
                    <div style="font-size:11px; color:#88ccff; margin-top:3px;">${describeRotationTurns(turns)}</div>
                `
                item.appendChild(header)

                // Actions
                const actions = document.createElement('div')
                actions.className = 'lse-item-actions'
                actions.style.flexWrap = "wrap"

                const gizmoRow = document.createElement('div')
                gizmoRow.style.cssText = "display:flex; gap:5px; width:100%; margin-bottom:6px;"

                const makeGizmoBtn = (label, mode) => {
                    const btn = document.createElement('button')
                    btn.textContent = label
                    btn.style.cssText = "flex:1; background:#064f9e; color:white; border:none; border-radius:3px; padding:4px; cursor:pointer; font-size:11px;"
                    btn.onclick = (e) => {
                        e.stopPropagation()
                        this.logicSystem.selectWaypoint(this.currentObject, this.currentSeqIndex, idx, mode)
                    }
                    return btn
                }

                gizmoRow.appendChild(makeGizmoBtn("Mover", "translate"))
                gizmoRow.appendChild(makeGizmoBtn("Rotar", "rotate"))
                gizmoRow.appendChild(makeGizmoBtn("Escala", "scale"))

                const captureBtn = document.createElement('button')
                captureBtn.textContent = "Capturar Actual"
                captureBtn.style.cssText = "flex:1.1; background:#333; color:white; border:1px solid #555; border-radius:3px; padding:4px; cursor:pointer; font-size:11px;"
                captureBtn.onclick = (e) => {
                    e.stopPropagation()
                    this.logicSystem.updateWaypointFromObject(this.currentObject, this.currentSeqIndex, idx)
                }
                gizmoRow.appendChild(captureBtn)
                item.appendChild(gizmoRow)

                const transformGrid = document.createElement('div')
                transformGrid.style.cssText = "display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:5px; margin:6px 0;"

                const addNumberInput = (label, value, onChange, step = 0.1) => {
                    const wrap = document.createElement('label')
                    wrap.style.cssText = "display:flex; flex-direction:column; gap:2px; font-size:10px; color:#aaa;"
                    const span = document.createElement('span')
                    span.textContent = label
                    const input = document.createElement('input')
                    input.type = "number"
                    input.value = Number(value || 0).toFixed(label.startsWith("Rot") ? 1 : 2)
                    input.step = String(step)
                    input.style.cssText = "width:100%; box-sizing:border-box; background:#222; border:1px solid #444; color:white; font-size:11px; padding:3px;"
                    input.onkeydown = (e) => e.stopPropagation()
                    input.onchange = (e) => {
                        onChange(parseFloat(e.target.value))
                        normalizeMovementWaypoint(wp, this.currentObject)
                        this.logicSystem.selectWaypoint(this.currentObject, this.currentSeqIndex, idx, this.logicSystem.waypointGizmo.getMode())
                        this.logicSystem.updateVisualization()
                        this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
                    }
                    wrap.appendChild(span)
                    wrap.appendChild(input)
                    transformGrid.appendChild(wrap)
                }

                addNumberInput("Pos X", pos.x, (v) => wp.x = v)
                addNumberInput("Pos Y", pos.y, (v) => wp.y = v)
                addNumberInput("Pos Z", pos.z, (v) => wp.z = v)
                addNumberInput("Rot X°", radiansToDegrees(rot.x), (v) => wp.rotation.x = degreesToRadians(v), 5)
                addNumberInput("Rot Y°", radiansToDegrees(rot.y), (v) => { wp.rotation.y = degreesToRadians(v); wp.rotY = wp.rotation.y }, 5)
                addNumberInput("Rot Z°", radiansToDegrees(rot.z), (v) => wp.rotation.z = degreesToRadians(v), 5)
                addNumberInput("Tam X", scale.x, (v) => wp.scale.x = v)
                addNumberInput("Tam Y", scale.y, (v) => wp.scale.y = v)
                addNumberInput("Tam Z", scale.z, (v) => wp.scale.z = v)
                addNumberInput("Vueltas X", turns.x, (v) => wp.rotationTurns.x = v, 0.25)
                addNumberInput("Vueltas Y", turns.y, (v) => wp.rotationTurns.y = v, 0.25)
                addNumberInput("Vueltas Z", turns.z, (v) => wp.rotationTurns.z = v, 0.25)

                item.appendChild(transformGrid)

                // Delay Input
                const delayLabel = document.createElement('label')
                delayLabel.textContent = "Espera (s): "
                delayLabel.style.fontSize = "12px"
                const delayInput = document.createElement('input')
                delayInput.type = "number"
                delayInput.value = wp.delay || 0
                delayInput.style.cssText = "width:50px; background:#222; border:1px solid #444; color:white; font-size:12px;"
                delayInput.onkeydown = (e) => e.stopPropagation()
                delayInput.onchange = (e) => {
                    wp.delay = parseFloat(e.target.value)
                    this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
                }

                actions.appendChild(delayLabel)
                actions.appendChild(delayInput)

                // Teleport Flag?
                const tpLabel = document.createElement('label')
                tpLabel.innerHTML = `<input type="checkbox" ${wp.teleport ? 'checked' : ''}> Teleport`
                tpLabel.style.fontSize = "12px"
                tpLabel.querySelector('input').onchange = (e) => {
                    wp.teleport = e.target.checked
                    this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
                }
                actions.appendChild(tpLabel)

                item.appendChild(actions)
            }

            // --- Shared Buttons for All Step Types (Duplicate & Delete) ---
            const btnContainer = document.createElement('div')
            btnContainer.style.cssText = "display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px; border-top: 1px solid #333; padding-top: 5px;"

            // Duplicate Button
            const dupBtn = document.createElement('button')
            dupBtn.textContent = "❐" // Duplicate Icon
            dupBtn.title = "Duplicar Paso"
            dupBtn.style.cssText = "background: #444; border: none; color: white; cursor: pointer; border-radius: 3px; padding: 2px 6px;"
            dupBtn.onclick = (e) => {
                e.stopPropagation() // Prevent drag triggers if any
                // Deep Clone
                const clone = JSON.parse(JSON.stringify(wp))
                // If it's a move waypoint, maybe offset slightly so user sees it? 
                // No, usually exact duplicate is expected behavior in a pure logic editor.
                seq.waypoints.splice(idx + 1, 0, clone)
                this.render()
                this.logicSystem.updateVisualization()
                this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
            }

            // Delete Button
            const delBtn = document.createElement('button')
            delBtn.textContent = "🗑"
            delBtn.style.cssText = "background: #622; border: none; color: white; cursor: pointer; border-radius: 3px; padding: 2px 6px;"
            delBtn.onclick = (e) => {
                e.stopPropagation()
                if (confirm("¿Eliminar este paso?")) {
                    seq.waypoints.splice(idx, 1)
                    this.logicSystem.waypointGizmo.detach()
                    this.logicSystem.selectedWaypoint = null
                    this.render()
                    this.logicSystem.updateVisualization()
                    this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
                }
            }

            btnContainer.appendChild(dupBtn)
            btnContainer.appendChild(delBtn)
            item.appendChild(btnContainer)

            this.timeline.appendChild(item)
        })
    }

    addWaypoint(seq) {
        // Capture current transform of the object
        const wp = this.logicSystem.createWaypointFromObject(this.currentObject)
        seq.waypoints.push(wp)
        this.logicSystem.selectWaypoint(this.currentObject, this.currentSeqIndex, seq.waypoints.length - 1, "translate")
        this.render()
        this.logicSystem.updateVisualization()
        this.logicSystem.broadcastObjectLogicUpdate(this.currentObject)
    }

    showSignalSelector(onSelectCallback) {
        // Create a modal list of buttons on top of existing UI
        const overlay = document.createElement('div')
        overlay.style.cssText = `
            position: absolute; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.8); z-index: 2100;
            display: flex; justify-content: center; align-items: center;
        `

        const panel = document.createElement('div')
        panel.style.cssText = `
            background: #222; border: 2px solid #444; border-radius: 8px;
            width: 400px; height: 500px; padding: 20px;
            display: flex; flex-direction: column; gap: 10px;
        `

        const title = document.createElement('h3')
        title.textContent = "Selecciona una Señal"
        title.style.margin = "0 0 10px 0"
        title.style.textAlign = "center"
        title.style.color = "white"
        panel.appendChild(title)

        // Tabs
        const tabContainer = document.createElement('div')
        tabContainer.style.cssText = "display: flex; gap: 10px; border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px;"

        const tabBtns = document.createElement('div')
        tabBtns.textContent = "Botones"
        tabBtns.style.cssText = "cursor: pointer; color: white; font-weight: bold; border-bottom: 2px solid white; padding-bottom: 2px; flex: 1; text-align: center;"

        const tabCols = document.createElement('div')
        tabCols.textContent = "Colisiones Interactivas"
        tabCols.style.cssText = "cursor: pointer; color: #888; padding-bottom: 2px; flex: 1; text-align: center;"

        const tabGlobal = document.createElement('div')
        tabGlobal.textContent = "Señales Globales"
        tabGlobal.style.cssText = "cursor: pointer; color: #888; padding-bottom: 2px; flex: 1; text-align: center;"

        tabContainer.appendChild(tabBtns)
        tabContainer.appendChild(tabCols)
        tabContainer.appendChild(tabGlobal)
        panel.appendChild(tabContainer)

        const listContainer = document.createElement('div')
        listContainer.style.cssText = "overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 5px;"

        // Helper to populate list
        const populateList = (type) => {
            listContainer.innerHTML = ""

            let items = []

            if (type === 'global') {
                // Fetch from Game Config
                const seqs = this.logicSystem.gameConfig.sequences || []

                if (seqs.length === 0) {
                    listContainer.innerHTML = "<div style='color:#666; text-align:center;'>No hay bloques de lógica globales configurados.</div>"
                    return
                }

                seqs.forEach((block, idx) => {
                    const row = document.createElement('div')
                    row.style.cssText = `
                        background: #333; color: white; border: 1px solid #444;
                        padding: 8px; text-align: left; cursor: pointer; border-radius: 4px;
                        transition: background 0.2s; display: flex; align-items: center; justify-content: space-between;
                     `
                    row.onmouseover = () => row.style.background = "#444"
                    row.onmouseout = () => row.style.background = "#333"

                    if (block.type === 'emit_signal') {
                        row.textContent = `Señal: "${block.signalName}"`
                        row.onclick = () => {
                            // Mock object for signal selector since it expects object structure usually or handle specially
                            // We need to return an object with userData.uuid or similar if standard, BUT
                            // the caller expects (selectedObj, type).
                            // We'll pass a dummy object structure that mimics what wait_signal step expects.
                            const dummyObj = { userData: { uuid: block.signalName, logicProperties: { name: "Señal Global" } } }
                            // Actually, wait_signal uses signalIds array. user wants to LISTEN to this signal.
                            // So the ID should be the signal name itself?
                            // Usually ID is UUID of object emitting. But for global signals, the signal NAME is the key.
                            // Let's pass the signal name as ID.
                            onSelectCallback({ userData: { uuid: block.signalName, logicProperties: { name: block.signalName } } }, 'global')
                            document.body.removeChild(overlay)
                        }
                        listContainer.appendChild(row)

                    } else if (block.type === 'time_wait') {
                        // Time Block Group
                        row.innerHTML = `<span>Bloque de Tiempo (${block.duration || 0}s)</span> <span style="font-size:10px; color:#aaa;">▶ Ver Señales</span>`
                        row.onclick = () => {
                            if (this.logicSystem.configPanel) {
                                // Close our selector overlay first? Or keep it? User might cancel.
                                // Let's close it to avoid clutter, assuming selection will reopen or finish.
                                document.body.removeChild(overlay)

                                this.logicSystem.configPanel.openSignalConfig(block, (selectedSignal) => {
                                    // Callback from the Chronological Panel
                                    onSelectCallback({ userData: { uuid: selectedSignal, logicProperties: { name: selectedSignal } } }, 'global')
                                    // Sequence Editor will update.
                                })
                            } else {
                                alert("Panel de Configuración no disponible.")
                            }
                        }
                        listContainer.appendChild(row)
                    }
                })
                return
            }

            // Normal Objects
            if (this.game.sceneManager && this.game.sceneManager.scene) {
                this.game.sceneManager.scene.traverse(obj => {
                    if (obj.userData) {
                        if (type === 'button' && obj.userData.mapObjectType === 'interaction_button') {
                            items.push(obj)
                        } else if (type === 'collision' && obj.userData.mapObjectType === 'interactive_collision') {
                            items.push(obj)
                        }
                    }
                })
            }

            if (items.length === 0) {
                listContainer.innerHTML = "<div style='color:#666; text-align:center;'>No hay objetos de este tipo en la escena.</div>"
            } else {
                items.forEach(obj => {
                    const row = document.createElement('div')
                    const name = obj.userData.logicProperties && obj.userData.logicProperties.name
                        ? obj.userData.logicProperties.name
                        : (type === 'button' ? "Botón Sin Nombre" : "Colisión Sin Nombre")
                    const uuid = obj.userData.uuid.substring(0, 5)

                    row.textContent = `${name} (${uuid})`
                    row.style.cssText = `
                        background: #333; color: white; border: 1px solid #444;
                        padding: 8px; text-align: left; cursor: pointer; border-radius: 4px;
                        transition: background 0.2s;
                     `
                    row.onmouseover = () => row.style.background = "#444"
                    row.onmouseout = () => row.style.background = "#333"

                    row.onclick = () => {
                        if (onSelectCallback) {
                            onSelectCallback(obj, type)
                        }
                        document.body.removeChild(overlay)
                    }
                    listContainer.appendChild(row)
                })
            }
        }

        // Init with buttons
        populateList('button')

        // Tab Events
        const updateTabs = (active) => {
            [tabBtns, tabCols, tabGlobal].forEach(t => {
                t.style.fontWeight = "normal"; t.style.color = "#888"; t.style.borderBottom = "none";
            })
            active.style.fontWeight = "bold"; active.style.color = "white"; active.style.borderBottom = "2px solid white";
        }

        tabBtns.onclick = () => { updateTabs(tabBtns); populateList('button') }
        tabCols.onclick = () => { updateTabs(tabCols); populateList('collision') }
        tabGlobal.onclick = () => { updateTabs(tabGlobal); populateList('global') }

        panel.appendChild(listContainer)

        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = "Cancelar"
        cancelBtn.style.cssText = "padding: 8px; background: #666; border: none; color: white; cursor: pointer; border-radius: 4px; margin-top: 10px;"
        cancelBtn.onclick = () => document.body.removeChild(overlay)
        panel.appendChild(cancelBtn)

        overlay.appendChild(panel)
        document.body.appendChild(overlay)
    }

    createInput(container, targetObj, key, val, type, labelText) {
        const row = document.createElement('div')
        row.className = 'lse-input-row'

        const label = document.createElement('label')
        label.className = 'lse-input-label'
        label.textContent = labelText || key

        const input = document.createElement('input')
        input.className = 'lse-input'

        if (type === 'number') {
            input.type = "number"
            input.value = val
            input.step = "0.1"
            input.onchange = (e) => {
                targetObj[key] = parseFloat(e.target.value)
            }
        } else if (type === 'boolean') {
            input.type = "checkbox"
            input.checked = val
            input.style.width = "auto"
            input.onchange = (e) => {
                targetObj[key] = e.target.checked
            }
        } else {
            input.type = "text"
            input.value = val
            input.onchange = (e) => {
                targetObj[key] = e.target.value
            }
        }

        row.appendChild(label)
        row.appendChild(input)
        container.appendChild(row)
    }
}

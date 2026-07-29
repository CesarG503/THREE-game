// @ts-nocheck

import { LogicItem } from "./LogicItem"

export class CameraPanelLogic extends LogicItem {
    constructor(game, logicSystem) {
        super()
        this.game = game
        this.logicSystem = logicSystem
    }

    render(container, props, updateCallback) {
        if (!props || props.logicKind !== "camera_panel") return
        if (!Array.isArray(props.cameraIds)) props.cameraIds = []

        const createRow = (labelText, input) => {
            const row = document.createElement("div")
            row.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-top:10px;"
            const label = document.createElement("label")
            label.textContent = labelText
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)
            row.appendChild(input)
            container.appendChild(row)
        }

        const nameInput = document.createElement("input")
        nameInput.type = "text"
        nameInput.value = props.name || "Panel de Camaras"
        nameInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        nameInput.onchange = (e) => updateCallback("name", e.target.value)
        createRow("Nombre", nameInput)

        // Previsualización y Rendimiento Section
        const subHeader = document.createElement("h5")
        subHeader.textContent = "Previsualización y Rendimiento"
        subHeader.style.cssText = "color:#bbb; margin-top:15px; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px; font-size:11px; font-weight:bold;"
        container.appendChild(subHeader)

        const farInput = document.createElement("input")
        farInput.type = "number"
        farInput.min = "10"
        farInput.max = "1000"
        farInput.step = "5"
        farInput.value = props.previewFar ?? 80
        farInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        farInput.onchange = (e) => updateCallback("previewFar", Math.max(10, parseFloat(e.target.value) || 80))
        createRow("Distancia Render Preview (m)", farInput)

        const intervalSelect = document.createElement("select")
        intervalSelect.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        ;[
            { value: "0", label: "Tiempo Real (60 FPS)" },
            { value: "0.1", label: "Cada 0.1s" },
            { value: "0.2", label: "Cada 0.2s" },
            { value: "0.5", label: "Cada 0.5s" },
            { value: "1", label: "Cada 1s" },
            { value: "2", label: "Cada 2s" },
            { value: "5", label: "Cada 5s" }
        ].forEach(opt => {
            const option = document.createElement("option")
            option.value = opt.value
            option.textContent = opt.label
            const currentVal = props.previewInterval ?? 0
            if (Math.abs(currentVal - parseFloat(opt.value)) < 0.01) option.selected = true
            intervalSelect.appendChild(option)
        })
        intervalSelect.onchange = (e) => updateCallback("previewInterval", parseFloat(e.target.value))
        createRow("Intervalo Actualización Previews", intervalSelect)

        // Camaras visibles Section
        const subHeaderCameras = document.createElement("h5")
        subHeaderCameras.textContent = "Selección de Cámaras"
        subHeaderCameras.style.cssText = "color:#bbb; margin-top:15px; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px; font-size:11px; font-weight:bold;"
        container.appendChild(subHeaderCameras)

        const cameras = []
        this.game?.sceneManager?.scene?.children?.forEach(obj => {
            if (obj.userData?.mapObjectType === "logic_camera") cameras.push(obj)
        })

        const list = document.createElement("div")
        list.style.cssText = "display:flex; flex-direction:column; gap:6px; background:#171717; border:1px solid #444; padding:8px; border-radius:4px;"

        if (cameras.length === 0) {
            const empty = document.createElement("div")
            empty.textContent = "No hay camaras en el mapa."
            empty.style.cssText = "color:#888; font-size:11px;"
            list.appendChild(empty)
        } else {
            cameras.forEach((cameraObject, index) => {
                const label = document.createElement("label")
                label.style.cssText = "display:flex; align-items:center; gap:8px; color:#ddd; font-size:11px;"
                const checkbox = document.createElement("input")
                checkbox.type = "checkbox"
                checkbox.checked = props.cameraIds.includes(cameraObject.userData.uuid)
                checkbox.onchange = () => {
                    const ids = new Set(props.cameraIds)
                    if (checkbox.checked) ids.add(cameraObject.userData.uuid)
                    else ids.delete(cameraObject.userData.uuid)
                    updateCallback("cameraIds", Array.from(ids))
                }
                const name = cameraObject.userData.logicProperties?.name || cameraObject.userData.customName || `Camara ${index + 1}`
                label.appendChild(checkbox)
                label.appendChild(document.createTextNode(name))
                list.appendChild(label)
            })
        }

        createRow("Camaras visibles", list)
    }
}

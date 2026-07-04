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

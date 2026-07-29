// @ts-nocheck

import { LogicItem } from "./LogicItem"

export class LogicCameraLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (!props || props.logicKind !== "logic_camera") return

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
        nameInput.value = props.name || "Camara"
        nameInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        nameInput.onchange = (e) => updateCallback("name", e.target.value)
        createRow("Nombre", nameInput)

        const modeSelect = document.createElement("select")
        modeSelect.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        ;[
            { value: "fixed", label: "Fija" },
            { value: "free_rotation", label: "Libre solo rotacion" }
        ].forEach(opt => {
            const option = document.createElement("option")
            option.value = opt.value
            option.textContent = opt.label
            if ((props.mode || "fixed") === opt.value) option.selected = true
            modeSelect.appendChild(option)
        })
        modeSelect.onchange = (e) => updateCallback("mode", e.target.value)
        createRow("Modo de Vista", modeSelect)

        const fovInput = document.createElement("input")
        fovInput.type = "number"
        fovInput.min = "20"
        fovInput.max = "120"
        fovInput.step = "1"
        fovInput.value = props.fov ?? 60
        fovInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        fovInput.onchange = (e) => updateCallback("fov", Math.max(20, Math.min(120, parseFloat(e.target.value) || 60)))
        createRow("FOV", fovInput)

        const farInput = document.createElement("input")
        farInput.type = "number"
        farInput.min = "1"
        farInput.step = "0.5"
        farInput.value = props.far ?? 6
        farInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px;"
        farInput.onchange = (e) => updateCallback("far", Math.max(1, parseFloat(e.target.value) || 6))
        createRow("Distancia del Foco", farInput)
    }
}

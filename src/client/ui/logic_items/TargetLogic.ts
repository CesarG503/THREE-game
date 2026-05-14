// @ts-nocheck

import { LogicItem } from "./LogicItem"

export class TargetLogic extends LogicItem {
    constructor(game, logicSystem) {
        super()
        this.game = game
        this.logicSystem = logicSystem
    }

    render(container, props, updateCallback) {
        if (!props) return

        // Filter object types based on logic type
        let validTypes = []
        if (props.type === 'target') {
            validTypes = ['movement_controller']
        } else if (props.type === 'trigger_target') {
            validTypes = ['interaction_button', 'interactive_collision']
        }

        const objects = this.logicSystem.scanScene(this.game.sceneManager.scene)
            .filter(o => validTypes.includes(o.userData.mapObjectType))

        if (!props.targetId) props.targetId = null

        const row = document.createElement('div')
        row.style.cssText = "margin-top: 10px;"

        const label = document.createElement('label')
        label.textContent = "Seleccionar Objetivo"
        label.style.color = "#aaa"
        label.style.fontSize = "11px"

        const select = document.createElement('select')
        select.style.cssText = "width: 100%; padding: 4px; background: #222; border: 1px solid #555; color: white; font-size: 11px;"

        const optNone = document.createElement('option')
        optNone.value = ''
        optNone.textContent = '-- Ninguno --'
        select.appendChild(optNone)

        objects.forEach(obj => {
            const opt = document.createElement('option')
            opt.value = obj.userData.uuid
            const name = obj.userData.logicProperties?.name || obj.userData.mapObjectType
            opt.textContent = name + ' (' + obj.userData.uuid.substring(0, 5) + ')'
            if (props.targetId === obj.userData.uuid) opt.selected = true
            select.appendChild(opt)
        })

        select.onchange = () => {
            props.targetId = select.value
            updateCallback('targetId', select.value)
        }

        row.appendChild(label)
        row.appendChild(select)
        container.appendChild(row)
    }
}

// @ts-nocheck

import { LogicItem } from "./LogicItem"
import { InspectorUtils } from "./InspectorUtils"

export class EventSubscriptionLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (!props) return

        // Event Type
        if (props.listenTo !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"

            const label = document.createElement('label')
            label.textContent = "Escuchar Evento"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const select = document.createElement('select')
            select.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"

            const options = [
                { id: 'button_press', name: 'Botón Presionado' },
                { id: 'signal', name: 'Señal Global' },
                { id: 'collision', name: 'Colisión Activada' }
            ]

            options.forEach(opt => {
                const o = document.createElement('option')
                o.value = opt.id
                o.textContent = opt.name
                if (props.listenTo === opt.id) o.selected = true
                select.appendChild(o)
            })

            select.onchange = (e) => updateCallback('listenTo', e.target.value)
            row.appendChild(select)

            container.appendChild(row)
        }

        // Signal Name
        if (props.listenTo === 'signal') {
            const inputRow = InspectorUtils.createNumberInput(
                "Nombre de Señal",
                (v) => updateCallback('signalName', v),
                0,
                0.1,
                "#f0f",
                props.signalName
            )
            container.appendChild(inputRow.container)
        }
    }
}

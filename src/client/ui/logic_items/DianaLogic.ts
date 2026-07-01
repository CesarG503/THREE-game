// @ts-nocheck
import { LogicItem } from "./LogicItem"

export class DianaLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (!props) return

        // Name
        if (props.name !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"
            const label = document.createElement('label')
            label.textContent = "Nombre"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const input = document.createElement('input')
            input.type = 'text'
            input.value = props.name || ""
            input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"
            input.onchange = (e) => updateCallback('name', e.target.value)
            row.appendChild(input)
            container.appendChild(row)
        }

        // Radius
        if (props.radius !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"
            const label = document.createElement('label')
            label.textContent = "Radio"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const input = document.createElement('input')
            input.type = 'number'
            input.step = '0.1'
            input.min = '0.1'
            input.value = props.radius
            input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"
            input.onchange = (e) => {
                const val = parseFloat(e.target.value)
                updateCallback('radius', val)
            }
            row.appendChild(input)
            container.appendChild(row)
        }

        // Rings
        if (props.rings !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"
            const label = document.createElement('label')
            label.textContent = "Anillos"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const input = document.createElement('input')
            input.type = 'number'
            input.step = '1'
            input.min = '1'
            input.max = '10'
            input.value = props.rings
            input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"
            input.onchange = (e) => {
                const val = parseInt(e.target.value)
                updateCallback('rings', val)
            }
            row.appendChild(input)
            container.appendChild(row)
        }

        // Base Damage
        if (props.baseDamage !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"
            const label = document.createElement('label')
            label.textContent = "Daño Base"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const input = document.createElement('input')
            input.type = 'number'
            input.step = '1'
            input.min = '0'
            input.value = props.baseDamage
            input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"
            input.onchange = (e) => {
                const val = parseFloat(e.target.value)
                updateCallback('baseDamage', val)
            }
            row.appendChild(input)
            container.appendChild(row)
        }

        // Use Projectile Damage
        if (props.useProjectileDamage !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 10px;"
            const chk = document.createElement('input')
            chk.type = 'checkbox'
            chk.checked = props.useProjectileDamage
            chk.onchange = (e) => updateCallback('useProjectileDamage', e.target.checked)

            const label = document.createElement('label')
            label.textContent = "Daño de Bala (Usar daño del arma)"
            label.style.color = "#ccc"
            label.style.fontSize = "11px"

            row.appendChild(chk)
            row.appendChild(label)
            container.appendChild(row)
        }
    }
}

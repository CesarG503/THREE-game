// @ts-nocheck

import * as THREE from "three"
import { LogicItem } from "./LogicItem"

export class InteractiveCollisionLogic extends LogicItem {
    constructor(game, logicSystem) {
        super()
        this.game = game
        this.logicSystem = logicSystem
    }

    render(container, props, updateCallback) {
        if (!props) return

        // Movement Speed
        if (props.speed !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"

            const label = document.createElement('label')
            label.textContent = "Velocidad Movimiento"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const input = document.createElement('input')
            input.type = 'number'
            input.step = '0.1'
            input.value = props.speed
            input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"
            input.onchange = (e) => updateCallback('speed', parseFloat(e.target.value))
            row.appendChild(input)

            container.appendChild(row)
        }

        // Easing
        if (props.easing !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;"

            const label = document.createElement('label')
            label.textContent = "Tipo de Movimiento"
            label.style.color = "#aaa"
            label.style.fontSize = "11px"
            row.appendChild(label)

            const select = document.createElement('select')
            select.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px;"

            const options = [
                { id: 'linear', name: 'Lineal' },
                { id: 'smooth', name: 'Suavizado' }
            ]

            options.forEach(opt => {
                const o = document.createElement('option')
                o.value = opt.id
                o.textContent = opt.name
                if (props.easing === opt.id) o.selected = true
                select.appendChild(o)
            })

            select.onchange = (e) => updateCallback('easing', e.target.value)
            row.appendChild(select)

            container.appendChild(row)
        }

        // 4. Rotation Toggle (New)
        if (props.followRotation !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 10px;"

            const chk = document.createElement('input')
            chk.type = 'checkbox'
            chk.checked = props.followRotation
            chk.onchange = (e) => updateCallback('followRotation', e.target.checked)

            const label = document.createElement('label')
            label.textContent = "Mover con Rotación"
            label.style.color = "#ccc"
            label.style.fontSize = "11px"

            row.appendChild(chk)
            row.appendChild(label)
            container.appendChild(row)
        }

        // 5. Direction Line Visual (Optional in UI)
        if (this.game && this.game.sceneManager && props.direction !== undefined) {
            const row = document.createElement('div')
            row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 10px;"

            const btn = document.createElement('button')
            btn.textContent = "Visualizar Dirección"
            btn.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 4px 8px; cursor: pointer; font-size: 10px;"

            btn.onclick = () => {
                if (!props.direction) return
                const dir = new THREE.Vector3(props.direction.x, props.direction.y, props.direction.z)

                const arrow = new THREE.ArrowHelper(dir.normalize(), new THREE.Vector3(), 3, 0xff0000)
                this.game.sceneManager.scene.add(arrow)

                setTimeout(() => {
                    this.game.sceneManager.scene.remove(arrow)
                }, 2000)
            }

            row.appendChild(btn)
            container.appendChild(row)
        }
    }
}

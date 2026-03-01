export class TargetLogic {
    static getLabel() {
        return "Diana Interactiva"
    }

    static setupUI(container, object, props, logicSystem) {
        // --- Properties ---

        // Defaults
        if (props.rings === undefined) props.rings = 3
        if (props.baseDamage === undefined) props.baseDamage = 10
        if (props.pointsMode === undefined) props.pointsMode = false
        if (!props.ringMultipliers) props.ringMultipliers = [1, 2, 3] // Outer to Inner
        if (props.radius === undefined) props.radius = 1.0

        logicSystem.createInput(container, object, 'radius', props.radius, 'number', 'Radio (Tamaño)')

        // Listen and update mesh when radius changes
        const radInputRow = container.lastElementChild
        const radInput = radInputRow.querySelector('input')
        if (radInput) {
            radInput.step = 0.5
            radInput.min = 0.5
            radInput.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value)
                if (isNaN(val) || val < 0.5) val = 0.5
                object.userData.logicProperties.radius = val

                // Trigger visual update 
                if (object.updateTargetVisuals) {
                    object.updateTargetVisuals()
                }
            })
        }

        logicSystem.createInput(container, object, 'rings', props.rings, 'number', 'Cantidad de Anillos')

        // Listen and update mesh when rings change
        const ringsInputRow = container.lastElementChild
        const ringsInput = ringsInputRow.querySelector('input')
        if (ringsInput) {
            ringsInput.min = 1
            ringsInput.max = 10
            ringsInput.addEventListener('change', (e) => {
                let val = parseInt(e.target.value)
                if (isNaN(val) || val < 1) val = 1
                if (val > 10) val = 10
                object.userData.logicProperties.rings = val

                // Adjust multipliers array safely
                const currentMults = object.userData.logicProperties.ringMultipliers || []
                const newMults = []
                for (let i = 0; i < val; i++) {
                    newMults.push(currentMults[i] !== undefined ? currentMults[i] : (i + 1))
                }
                object.userData.logicProperties.ringMultipliers = newMults

                // Re-render UI to update the comma-separated string
                logicSystem.renderPanel(container, object)

                // Trigger visual update 
                if (object.updateTargetVisuals) {
                    object.updateTargetVisuals()
                }
            })
        }

        logicSystem.createInput(container, object, 'baseDamage', props.baseDamage, 'number', 'Daño Base (Referencia)')

        // Ring Multipliers as text
        const multsStr = props.ringMultipliers.join(', ')
        logicSystem.createInput(container, object, '_multsStr', multsStr, 'text', 'Multiplicadores (Ext -> Int)')
        const multsInputRow = container.lastElementChild
        const multsInput = multsInputRow.querySelector('input')
        if (multsInput) {
            multsInput.addEventListener('change', (e) => {
                const arr = e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
                if (arr.length > 0) {
                    // Update multipliers, but keep length up to 'rings'
                    const limit = object.userData.logicProperties.rings || 3
                    object.userData.logicProperties.ringMultipliers = arr.slice(0, limit)
                }
            })
        }

        const info = document.createElement('div')
        info.textContent = `UUID: ${object.userData.uuid ? object.userData.uuid.substring(0, 8) : 'N/A'}...`
        info.style.cssText = "font-size:10px; color:#aaa; margin-top:20px;"
        container.appendChild(info)
    }
}

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
        if (props.radius === undefined) props.radius = 1.0
        if (props.useProjectileDamage === undefined) props.useProjectileDamage = false

        // Auto-calculate default multipliers if they don't match the rings or missing
        if (!props.ringMultipliers || props.ringMultipliers.length !== props.rings) {
            props.ringMultipliers = []
            if (props.rings === 1) {
                props.ringMultipliers = [1.0];
            } else {
                for (let i = 0; i < props.rings; i++) {
                    // map i=0 (outer) to 0.1, and i=(rings-1) (inner) to 1.0
                    // using linear interpolation
                    const t = i / (props.rings - 1);
                    const val = 0.1 + t * 0.9;
                    props.ringMultipliers.push(Number(val.toFixed(2)));
                }
            }
        }

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

                // Auto-calculate multipliers (Outer = 0.1, Center = 1.0)
                const newMults = []
                if (val === 1) {
                    newMults.push(1.0);
                } else {
                    for (let i = 0; i < val; i++) {
                        const t = i / (val - 1);
                        const v = 0.1 + t * 0.9;
                        newMults.push(Number(v.toFixed(2)));
                    }
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

        // Damage Source Toggle
        logicSystem.createInput(container, object, 'useProjectileDamage', props.useProjectileDamage, 'checkbox', 'Usar Daño de Proyectil')
        const projDmgRow = container.lastElementChild
        const projDmgInp = projDmgRow.querySelector('input')

        logicSystem.createInput(container, object, 'baseDamage', props.baseDamage, 'number', 'Daño Base (Referencia)')
        const dmgRow = container.lastElementChild
        const dmgInp = dmgRow.querySelector('input')

        if (projDmgInp && dmgInp) {
            // Initial state
            dmgInp.disabled = props.useProjectileDamage;
            if (props.useProjectileDamage) dmgInp.style.opacity = "0.5";

            projDmgInp.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                object.userData.logicProperties.useProjectileDamage = isChecked;
                dmgInp.disabled = isChecked;
                dmgInp.style.opacity = isChecked ? "0.5" : "1.0";
            })
        }

        // Ring Multipliers as text (read-only insight)
        const multsStr = props.ringMultipliers.join(', ')
        logicSystem.createInput(container, object, '_multsStr', multsStr, 'text', 'Multiplicadores (Ext -> Int)')
        const multsInputRow = container.lastElementChild
        const multsInput = multsInputRow.querySelector('input')
        if (multsInput) {
            multsInput.disabled = true; // Auto-calculated now
        }

        const info = document.createElement('div')
        info.textContent = `UUID: ${object.userData.uuid ? object.userData.uuid.substring(0, 8) : 'N/A'}...`
        info.style.cssText = "font-size:10px; color:#aaa; margin-top:20px;"
        container.appendChild(info)
    }
}

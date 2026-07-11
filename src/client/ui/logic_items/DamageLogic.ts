// @ts-nocheck
import { LogicItem } from "./LogicItem"

export class DamageLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (!props) return;

        // Group container for damage controls
        const groupDiv = document.createElement('div');
        groupDiv.style.cssText = "border-top: 1px solid #444; margin-top: 15px; padding-top: 10px; display: flex; flex-direction: column; gap: 8px;";

        const title = document.createElement('div');
        title.textContent = "Controlador de Daño";
        title.style.cssText = "font-weight: bold; font-size: 12px; color: #f87171; margin-bottom: 5px;";
        groupDiv.appendChild(title);

        // Checkbox: enableDamage
        const enableRow = document.createElement('div');
        enableRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
        const enableChk = document.createElement('input');
        enableChk.type = 'checkbox';
        enableChk.checked = !!props.enableDamage;
        enableChk.onchange = (e) => {
            const checked = e.target.checked;
            updateCallback('enableDamage', checked);
            
            // Populate defaults if enabling
            if (checked) {
                if (props.damage === undefined) updateCallback('damage', 10);
                if (props.instantKill === undefined) updateCallback('instantKill', false);
                if (props.percentDamage === undefined) updateCallback('percentDamage', 0);
                if (props.maxDamage === undefined) updateCallback('maxDamage', 100);
                if (props.damageStopLimit === undefined) updateCallback('damageStopLimit', 0);
                if (props.damageCooldown === undefined) updateCallback('damageCooldown', 1.0);
                if (props.accumulatedDamage === undefined) updateCallback('accumulatedDamage', 0);
                if (props.enableKnockback === undefined) updateCallback('enableKnockback', false);
                if (props.knockbackForce === undefined) updateCallback('knockbackForce', 15);
                if (props.knockbackDirection === undefined) updateCallback('knockbackDirection', 'automatic');
            }
        };

        const enableLabel = document.createElement('label');
        enableLabel.textContent = "Habilitar Daño";
        enableLabel.style.cssText = "color: #ccc; font-size: 11px; cursor: pointer;";
        enableLabel.onclick = () => enableChk.click();

        enableRow.appendChild(enableChk);
        enableRow.appendChild(enableLabel);
        groupDiv.appendChild(enableRow);

        if (props.enableDamage) {
            const contentDiv = document.createElement('div');
            contentDiv.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding-left: 15px; border-left: 2px solid #ef4444; margin-top: 5px;";

            // Name field (if name property exists)
            if (props.name !== undefined) {
                const nameRow = document.createElement('div');
                nameRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
                const nameLabel = document.createElement('label');
                nameLabel.textContent = "Nombre";
                nameLabel.style.cssText = "color: #aaa; font-size: 10px;";
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.value = props.name || "";
                nameInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
                nameInput.onchange = (e) => updateCallback('name', e.target.value);
                nameRow.appendChild(nameLabel);
                nameRow.appendChild(nameInput);
                contentDiv.appendChild(nameRow);
            }

            // 1. Damage input
            const dRow = document.createElement('div');
            dRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
            const dLabel = document.createElement('label');
            dLabel.textContent = "Daño Base";
            dLabel.style.cssText = "color: #aaa; font-size: 10px;";
            const dInput = document.createElement('input');
            dInput.type = 'number';
            dInput.min = '0';
            dInput.value = props.damage !== undefined ? props.damage : 10;
            dInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
            dInput.onchange = (e) => updateCallback('damage', parseFloat(e.target.value) || 0);
            dRow.appendChild(dLabel);
            dRow.appendChild(dInput);
            contentDiv.appendChild(dRow);

            // 2. Percent Damage
            const pdRow = document.createElement('div');
            pdRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
            const pdLabel = document.createElement('label');
            pdLabel.textContent = "Daño Porcentual (%)";
            pdLabel.style.cssText = "color: #aaa; font-size: 10px;";
            const pdInput = document.createElement('input');
            pdInput.type = 'number';
            pdInput.min = '0';
            pdInput.max = '100';
            pdInput.value = props.percentDamage !== undefined ? props.percentDamage : 0;
            pdInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
            pdInput.onchange = (e) => updateCallback('percentDamage', parseFloat(e.target.value) || 0);
            pdRow.appendChild(pdLabel);
            pdRow.appendChild(pdInput);
            contentDiv.appendChild(pdRow);

            // 3. Instant Kill Checkbox
            const ikRow = document.createElement('div');
            ikRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 2px;";
            const ikChk = document.createElement('input');
            ikChk.type = 'checkbox';
            ikChk.checked = !!props.instantKill;
            ikChk.onchange = (e) => updateCallback('instantKill', e.target.checked);
            const ikLabel = document.createElement('label');
            ikLabel.textContent = "Muerte Instantánea";
            ikLabel.style.cssText = "color: #ccc; font-size: 11px; cursor: pointer;";
            ikLabel.onclick = () => ikChk.click();
            ikRow.appendChild(ikChk);
            ikRow.appendChild(ikLabel);
            contentDiv.appendChild(ikRow);

            // 4. Max Damage Limit
            const mdRow = document.createElement('div');
            mdRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
            const mdLabel = document.createElement('label');
            mdLabel.textContent = "Límite Máximo Daño (por golpe)";
            mdLabel.style.cssText = "color: #aaa; font-size: 10px;";
            const mdInput = document.createElement('input');
            mdInput.type = 'number';
            mdInput.min = '0';
            mdInput.value = props.maxDamage !== undefined ? props.maxDamage : 100;
            mdInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
            mdInput.onchange = (e) => updateCallback('maxDamage', parseFloat(e.target.value) || 0);
            mdRow.appendChild(mdLabel);
            mdRow.appendChild(mdInput);
            contentDiv.appendChild(mdRow);

            // 5. Cooldown
            const cdRow = document.createElement('div');
            cdRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
            const cdLabel = document.createElement('label');
            cdLabel.textContent = "Intervalo Cooldown (s)";
            cdLabel.style.cssText = "color: #aaa; font-size: 10px;";
            const cdInput = document.createElement('input');
            cdInput.type = 'number';
            cdInput.step = '0.1';
            cdInput.min = '0.05';
            cdInput.value = props.damageCooldown !== undefined ? props.damageCooldown : 1.0;
            cdInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
            cdInput.onchange = (e) => updateCallback('damageCooldown', parseFloat(e.target.value) || 1.0);
            cdRow.appendChild(cdLabel);
            cdRow.appendChild(cdInput);
            contentDiv.appendChild(cdRow);

            // 6. Stop Limit
            const slRow = document.createElement('div');
            slRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
            const slLabel = document.createElement('label');
            slLabel.textContent = "Límite Daño Acumulado (Stop)";
            slLabel.style.cssText = "color: #aaa; font-size: 10px;";
            const slInput = document.createElement('input');
            slInput.type = 'number';
            slInput.min = '0';
            slInput.value = props.damageStopLimit !== undefined ? props.damageStopLimit : 0;
            slInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
            slInput.onchange = (e) => updateCallback('damageStopLimit', parseFloat(e.target.value) || 0);
            slRow.appendChild(slLabel);
            slRow.appendChild(slInput);
            contentDiv.appendChild(slRow);

            // 7. Accumulated Damage Display & Reset
            const acRow = document.createElement('div');
            acRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; padding: 6px; border-radius: 4px; margin-top: 4px; border: 1px dashed #444;";
            const acText = document.createElement('span');
            acText.textContent = `Daño total hecho: ${props.accumulatedDamage || 0}`;
            acText.style.cssText = "font-size: 10px; color: #a3a3a3;";
            this.accumulatedDamageTextSpan = acText;
            const acBtn = document.createElement('button');
            acBtn.textContent = "Reset";
            acBtn.type = "button";
            acBtn.style.cssText = "background: #3f3f46; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;";
            acBtn.onclick = (e) => {
                e.preventDefault();
                updateCallback('accumulatedDamage', 0);
                acText.textContent = `Daño total hecho: 0`;
            };
            acRow.appendChild(acText);
            acRow.appendChild(acBtn);
            contentDiv.appendChild(acRow);

            // 8. Knockback Toggle
            const kbRow = document.createElement('div');
            kbRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 4px;";
            const kbChk = document.createElement('input');
            kbChk.type = 'checkbox';
            kbChk.checked = !!props.enableKnockback;
            kbChk.onchange = (e) => updateCallback('enableKnockback', e.target.checked);
            const kbLabel = document.createElement('label');
            kbLabel.textContent = "Activar Retroceso (Knockback)";
            kbLabel.style.cssText = "color: #ccc; font-size: 11px; cursor: pointer;";
            kbLabel.onclick = () => kbChk.click();
            kbRow.appendChild(kbChk);
            kbRow.appendChild(kbLabel);
            contentDiv.appendChild(kbRow);

            if (props.enableKnockback) {
                const kbContent = document.createElement('div');
                kbContent.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding-left: 10px; border-left: 1.5px solid #3b82f6; margin-top: 3px;";

                // Knockback Force
                const kfRow = document.createElement('div');
                kfRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
                const kfLabel = document.createElement('label');
                kfLabel.textContent = "Fuerza de Retroceso";
                kfLabel.style.cssText = "color: #aaa; font-size: 10px;";
                const kfInput = document.createElement('input');
                kfInput.type = 'number';
                kfInput.min = '0';
                kfInput.value = props.knockbackForce !== undefined ? props.knockbackForce : 15;
                kfInput.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
                kfInput.onchange = (e) => updateCallback('knockbackForce', parseFloat(e.target.value) || 0);
                kfRow.appendChild(kfLabel);
                kfRow.appendChild(kfInput);
                kbContent.appendChild(kfRow);

                // Knockback Direction Type
                const kdRow = document.createElement('div');
                kdRow.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
                const kdLabel = document.createElement('label');
                kdLabel.textContent = "Dirección de Retroceso";
                kdLabel.style.cssText = "color: #aaa; font-size: 10px;";
                const kdSelect = document.createElement('select');
                kdSelect.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 4px; font-size: 11px; border-radius: 4px;";
                const options = [
                    { value: "automatic", label: "Automático (Opuesto a colisión)" },
                    { value: "upward", label: "Solo hacia Arriba" },
                    { value: "away", label: "Alejar del centro" },
                    { value: "backward", label: "Empujar hacia atrás" }
                ];
                options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value;
                    o.textContent = opt.label;
                    if (props.knockbackDirection === opt.value) o.selected = true;
                    kdSelect.appendChild(o);
                });
                kdSelect.onchange = (e) => updateCallback('knockbackDirection', e.target.value);
                kdRow.appendChild(kdLabel);
                kdRow.appendChild(kdSelect);
                kbContent.appendChild(kdRow);

                contentDiv.appendChild(kbContent);
            }

            groupDiv.appendChild(contentDiv);
        }

        container.appendChild(groupDiv);
    }

    updateAccumulatedDamageDisplay(props) {
        if (this.accumulatedDamageTextSpan && document.body.contains(this.accumulatedDamageTextSpan) && props) {
            const val = props.accumulatedDamage || 0;
            this.accumulatedDamageTextSpan.textContent = `Daño total hecho: ${val}`;
        }
    }
}

// @ts-nocheck

import { LogicItem } from "./LogicItem";

export class LightLogic extends LogicItem {
    render(container, props, updateCallback) {
        // We only render this panel if it is a logic_light block
        if (!props || props.logicKind !== "logic_light") return;

        const createRow = (labelText, input) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-top:10px;";
            const label = document.createElement("label");
            label.textContent = labelText;
            label.style.color = "#aaa";
            label.style.fontSize = "11px";
            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);
            return row;
        };

        // Light Type Selector
        const typeSelect = document.createElement("select");
        typeSelect.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px; cursor:pointer;";
        [
            { value: "point", label: "Puntual (PointLight)" },
            { value: "spot", label: "Focal (SpotLight)" },
            { value: "directional", label: "Direccional" },
            { value: "ambient", label: "Ambiental" }
        ].forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            if ((props.lightType || "point") === opt.value) option.selected = true;
            typeSelect.appendChild(option);
        });
        typeSelect.onchange = (e) => {
            const val = e.target.value;
            updateCallback("lightType", val);
            // Refresh logic panel to hide/show irrelevant fields
            setTimeout(() => {
                const refreshBtn = document.getElementById("refresh-inspector-btn") || container.closest("#object-inspector")?.querySelector(".refresh-btn");
                if (refreshBtn && typeof refreshBtn.click === "function") refreshBtn.click();
            }, 50);
        };
        createRow("Tipo de Luz", typeSelect);

        // Color Input (Hex)
        const colorRow = document.createElement("div");
        colorRow.style.cssText = "display:flex; gap:10px; align-items:center; margin-top:10px;";
        
        const colorLabel = document.createElement("label");
        colorLabel.textContent = "Color";
        colorLabel.style.color = "#aaa";
        colorLabel.style.fontSize = "11px";
        colorLabel.style.flex = "1";
        
        const colorText = document.createElement("input");
        colorText.type = "text";
        colorText.value = props.color || "#ffffff";
        colorText.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; width:70px; font-size:12px;";
        
        const colorPicker = document.createElement("input");
        colorPicker.type = "color";
        colorPicker.value = props.color || "#ffffff";
        colorPicker.style.cssText = "background:transparent; border:none; width:30px; height:24px; padding:0; cursor:pointer;";
        
        colorText.onchange = (e) => {
            let val = e.target.value;
            if (!val.startsWith("#")) val = "#" + val;
            updateCallback("color", val);
            colorPicker.value = val;
        };
        colorPicker.oninput = (e) => {
            const val = e.target.value;
            updateCallback("color", val);
            colorText.value = val;
        };
        
        colorRow.appendChild(colorLabel);
        colorRow.appendChild(colorText);
        colorRow.appendChild(colorPicker);
        container.appendChild(colorRow);

        // Intensity Input
        const intensityInput = document.createElement("input");
        intensityInput.type = "number";
        intensityInput.min = "0";
        intensityInput.max = "100";
        intensityInput.step = "0.2";
        intensityInput.value = props.intensity ?? 2.0;
        intensityInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
        intensityInput.onchange = (e) => updateCallback("intensity", Math.max(0, parseFloat(e.target.value) || 0));
        createRow("Intensidad", intensityInput);

        const currentType = props.lightType || "point";

        // Distance and Decay (only for Point and Spot lights)
        if (currentType === "point" || currentType === "spot") {
            const distInput = document.createElement("input");
            distInput.type = "number";
            distInput.min = "0";
            distInput.step = "1";
            distInput.value = props.distance ?? 15.0;
            distInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
            distInput.onchange = (e) => updateCallback("distance", Math.max(0, parseFloat(e.target.value) || 0));
            createRow("Distancia / Rango (m)", distInput);

            const decayInput = document.createElement("input");
            decayInput.type = "number";
            decayInput.min = "0";
            decayInput.max = "5";
            decayInput.step = "0.1";
            decayInput.value = props.decay ?? 2.0;
            decayInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
            decayInput.onchange = (e) => updateCallback("decay", Math.max(0, parseFloat(e.target.value) || 0));
            createRow("Decaimiento (Decay)", decayInput);
        }

        // Angle and Penumbra (only for Spot light)
        if (currentType === "spot") {
            const angleInput = document.createElement("input");
            angleInput.type = "number";
            angleInput.min = "0";
            angleInput.max = "90";
            angleInput.step = "1";
            angleInput.value = props.angle ?? 45;
            angleInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
            angleInput.onchange = (e) => updateCallback("angle", Math.max(0, Math.min(90, parseFloat(e.target.value) || 45)));
            createRow("Ángulo de Foco (Grados)", angleInput);

            const penumbraInput = document.createElement("input");
            penumbraInput.type = "number";
            penumbraInput.min = "0";
            penumbraInput.max = "1";
            penumbraInput.step = "0.1";
            penumbraInput.value = props.penumbra ?? 0.5;
            penumbraInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
            penumbraInput.onchange = (e) => updateCallback("penumbra", Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.5)));
            createRow("Penumbra (Suavizado)", penumbraInput);
        }

        // Shadows config (not for AmbientLight)
        if (currentType !== "ambient") {
            const shadowRow = document.createElement("div");
            shadowRow.style.cssText = "display:flex; align-items:center; gap:10px; margin-top:10px;";
            
            const shadowCheckbox = document.createElement("input");
            shadowCheckbox.type = "checkbox";
            shadowCheckbox.id = "opt-light-shadow";
            shadowCheckbox.checked = props.castShadow !== false;
            shadowCheckbox.style.transform = "scale(1.2)";
            shadowCheckbox.onchange = (e) => updateCallback("castShadow", e.target.checked);
            
            const shadowLabel = document.createElement("label");
            shadowLabel.textContent = "Proyectar Sombras";
            shadowLabel.htmlFor = "opt-light-shadow";
            shadowLabel.style.color = "#aaa";
            shadowLabel.style.fontSize = "11px";
            shadowLabel.style.cursor = "pointer";
            
            shadowRow.appendChild(shadowCheckbox);
            shadowRow.appendChild(shadowLabel);
            container.appendChild(shadowRow);
        }
    }
}

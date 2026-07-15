// @ts-nocheck

import { LogicItem } from "./LogicItem";

export class RoomLogic extends LogicItem {
    render(container, props, updateCallback) {
        // We only render this panel if it is a logic_room block
        if (!props || props.logicKind !== "logic_room") return;

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

        // Room ID Input
        const idInput = document.createElement("input");
        idInput.type = "text";
        idInput.value = props.roomId || "";
        idInput.placeholder = "room_lobby";
        idInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
        idInput.onchange = (e) => {
            let val = e.target.value.trim().replace(/\s+/g, "_").toLowerCase();
            updateCallback("roomId", val || "room_unnamed");
        };
        createRow("ID de Habitación (Único)", idInput);

        // Room Name Input
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = props.name || "Habitación";
        nameInput.placeholder = "Habitación Principal";
        nameInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
        nameInput.onchange = (e) => updateCallback("name", e.target.value.trim() || "Habitación");
        createRow("Nombre de Habitación", nameInput);

        // Ambient Color Input (Hex)
        const colorRow = document.createElement("div");
        colorRow.style.cssText = "display:flex; gap:10px; align-items:center; margin-top:10px;";
        
        const colorLabel = document.createElement("label");
        colorLabel.textContent = "Color Ambiente";
        colorLabel.style.color = "#aaa";
        colorLabel.style.fontSize = "11px";
        colorLabel.style.flex = "1";
        
        const colorText = document.createElement("input");
        colorText.type = "text";
        colorText.value = props.ambientColor || "#050510";
        colorText.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; width:70px; font-size:12px;";
        
        const colorPicker = document.createElement("input");
        colorPicker.type = "color";
        colorPicker.value = props.ambientColor || "#050510";
        colorPicker.style.cssText = "background:transparent; border:none; width:30px; height:24px; padding:0; cursor:pointer;";
        
        colorText.onchange = (e) => {
            let val = e.target.value.trim();
            if (!val.startsWith("#")) val = "#" + val;
            updateCallback("ambientColor", val);
            colorPicker.value = val;
        };
        colorPicker.oninput = (e) => {
            const val = e.target.value;
            updateCallback("ambientColor", val);
            colorText.value = val;
        };
        
        colorRow.appendChild(colorLabel);
        colorRow.appendChild(colorText);
        colorRow.appendChild(colorPicker);
        container.appendChild(colorRow);

        // Ambient Intensity Input
        const intensityInput = document.createElement("input");
        intensityInput.type = "number";
        intensityInput.min = "0";
        intensityInput.max = "10";
        intensityInput.step = "0.05";
        intensityInput.value = props.ambientIntensity ?? 0.05;
        intensityInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
        intensityInput.onchange = (e) => updateCallback("ambientIntensity", Math.max(0, parseFloat(e.target.value) || 0));
        createRow("Intensidad Luz Ambiente", intensityInput);

        // Darkness Factor (for darkening room contents when viewed from outside)
        const darkFactorInput = document.createElement("input");
        darkFactorInput.type = "number";
        darkFactorInput.min = "0";
        darkFactorInput.max = "1";
        darkFactorInput.step = "0.05";
        darkFactorInput.value = props.darknessFactor ?? 0.1;
        darkFactorInput.style.cssText = "background:#222; border:1px solid #555; color:white; padding:4px; font-size:12px;";
        darkFactorInput.onchange = (e) => updateCallback("darknessFactor", Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)));
        createRow("Factor de Oscuridad (Exterior -> Interior)", darkFactorInput);
    }
}

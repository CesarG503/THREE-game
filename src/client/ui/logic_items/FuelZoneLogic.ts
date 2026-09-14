import { normalizeFuelZone } from '../../fuel/FuelZoneSettings';

export function renderFuelZoneBorder(container: HTMLElement, props: any, update: (key: string, value: any) => void) {
  const settings = normalizeFuelZone(props);
  const controls = new Map<string, HTMLInputElement>();
  for (const [key, text, type] of [
    ['fuelBorderVisible', 'Mostrar borde', 'checkbox'], ['fuelBorderUseZoneColor', 'Usar color de zona en el borde', 'checkbox'],
    ['fuelBorderColor', 'Color del borde', 'color'], ['fuelBorderOpacity', 'Opacidad del borde', 'range'],
    ['fuelBorderThickness', 'Grosor del borde (m)', 'number'],
  ]) {
    const label = document.createElement('label'); label.textContent = text;
    label.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0;color:#ccc;font-size:12px';
    const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', text);
    input.style.maxWidth = '100px'; input.checked = settings[key]; input.value = String(settings[key]);
    if (type === 'range') { input.min = '0'; input.max = '1'; input.step = '.05'; }
    if (type === 'number') { input.min = '.005'; input.max = '.5'; input.step = '.005'; }
    input.oninput = () => {
      const value = type === 'checkbox' ? input.checked : (type === 'range' || type === 'number') ? input.valueAsNumber : input.value;
      update(key, normalizeFuelZone({...props, [key]: value})[key]);
      controls.get('fuelBorderColor')!.disabled = normalizeFuelZone(props).fuelBorderUseZoneColor;
    };
    label.appendChild(input); container.appendChild(label); controls.set(key, input);
  }
  controls.get('fuelBorderColor')!.disabled = settings.fuelBorderUseZoneColor;
}

export class FuelZoneLogic {
  render(container: HTMLElement, props: any, update: (key: string, value: any) => void) {
    if (!props?.fuelZone) return;
    const settings = normalizeFuelZone(props);
    const controls = new Map<string, HTMLInputElement>();
    const refresh = () => {
      controls.get('fuelHoldSeconds')!.disabled = mode.value !== 'interact';
      for (const key of ['fuelCapacity', 'fuelRemaining']) controls.get(key)!.disabled = !controls.get('fuelLimited')!.checked;
    };
    const modeLabel = document.createElement('label'); modeLabel.textContent = 'Activación de la recarga';
    modeLabel.style.cssText = 'display:flex;flex-direction:column;gap:5px;color:#ddd;font-size:12px';
    const mode = document.createElement('select');
    for (const [value, text] of [['automatic', 'Automática por contacto'], ['interact', 'Pulsar o mantener F para iniciar']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; mode.appendChild(option);
    }
    mode.value = settings.fuelActivation;
    mode.onchange = () => { update('fuelActivation', mode.value); refresh(); };
    modeLabel.appendChild(mode); container.appendChild(modeLabel);
    const fields = [
      ['name', 'Nombre', 'text'], ['fuelEnabled', 'Activar estación', 'checkbox'],
      ['refuelVehicles', 'Recargar vehículos', 'checkbox'], ['refuelJetpacks', 'Recargar jetpack equipado', 'checkbox'],
      ['fuelHoldSeconds', 'Mantener F para iniciar (segundos; 0 = pulsar)', 'number'],
      ['fuelRate', 'Caudal total (unidades por segundo)', 'number'], ['fuelLimited', 'Reserva limitada', 'checkbox'],
      ['fuelCapacity', 'Capacidad máxima de la estación', 'number'], ['fuelRemaining', 'Combustible disponible en la estación', 'number'],
      ['showFuelIndicator', 'Mostrar indicadores flotantes', 'checkbox'],
      ['showFuelStatus', 'Mostrar estado (Gasolina / Recargando)', 'checkbox'], ['showFuelReserve', 'Mostrar combustible disponible', 'checkbox'],
      ['showFuelRate', 'Mostrar caudal por segundo', 'checkbox'], ['showFuelBar', 'Mostrar barra de reserva', 'checkbox'], ['showFuelEffects', 'Mostrar estela 3D al recargar', 'checkbox'],
    ];
    for (const [key, labelText, type] of fields) {
      const label = document.createElement('label');
      label.style.cssText = `display:flex;${type === 'checkbox' ? 'align-items:center' : 'flex-direction:column'};gap:6px;margin:9px 0;color:#ddd;font-size:12px;width:100%`;
      const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', labelText);
      input.style.cssText = 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
      if (type === 'checkbox') input.checked = settings[key];
      else input.value = String(settings[key]);
      if (type === 'number') { input.min = '0'; input.max = key === 'fuelRate' ? '10000' : key === 'fuelHoldSeconds' ? '60' : '10000000'; input.step = '0.1'; }
      input.onchange = () => {
        const value = type === 'checkbox' ? input.checked : type === 'number' ? input.valueAsNumber : input.value;
        const normalized = normalizeFuelZone({ ...props, [key]: value });
        update(key, normalized[key]);
        if (key === 'fuelCapacity' && normalized.fuelRemaining !== props.fuelRemaining) update('fuelRemaining', normalized.fuelRemaining);
        for (const k of ['fuelRate', 'fuelCapacity', 'fuelRemaining', 'fuelHoldSeconds']) controls.get(k)!.value = String(normalizeFuelZone(props)[k]);
        refresh();
      };
      if (type === 'checkbox') label.append(input, labelText); else label.append(labelText, input);
      container.appendChild(label); controls.set(key, input);
    }
    renderFuelZoneBorder(container, props, update);
    const fill = document.createElement('button'); fill.textContent = 'Rellenar reserva de la estación';
    fill.onclick = () => { update('fuelRemaining', normalizeFuelZone(props).fuelCapacity); controls.get('fuelRemaining')!.value = String(props.fuelRemaining); };
    container.appendChild(fill);
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:#9acfc5;line-height:1.5';
    hint.textContent = 'En modo F, pulsa una vez o mantén durante el tiempo configurado. Al completar la pulsación, la recarga continúa sin mantener F hasta salir; al volver debes activarla otra vez. Recarga por contacto, incluso vehículos estacionados. El caudal se reparte entre los depósitos en contacto y se detiene al llenarlos, salir o agotar la reserva. Una unidad equivale a un segundo de combustible al consumo normal. La reserva disponible se guarda con el mapa. Ajusta el tamaño y la rotación de la zona con las herramientas de construcción.';
    container.appendChild(hint); refresh();
  }
}

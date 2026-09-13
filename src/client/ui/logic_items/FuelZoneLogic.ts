import { normalizeFuelZone } from '../../fuel/FuelZoneSettings';

export class FuelZoneLogic {
  render(container: HTMLElement, props: any, update: (key: string, value: any) => void) {
    if (!props?.fuelZone) return;
    const settings = normalizeFuelZone(props);
    const controls = new Map<string, HTMLInputElement>();
    const refresh = () => {
      for (const key of ['fuelCapacity', 'fuelRemaining']) controls.get(key)!.disabled = !controls.get('fuelLimited')!.checked;
    };
    const fields = [
      ['name', 'Nombre', 'text'], ['fuelEnabled', 'Activar estación', 'checkbox'],
      ['refuelVehicles', 'Recargar vehículos', 'checkbox'], ['refuelJetpacks', 'Recargar jetpack equipado', 'checkbox'],
      ['fuelRate', 'Caudal total (unidades por segundo)', 'number'], ['fuelLimited', 'Reserva limitada', 'checkbox'],
      ['fuelCapacity', 'Capacidad máxima de la estación', 'number'], ['fuelRemaining', 'Combustible disponible en la estación', 'number'],
      ['showFuelIndicator', 'Mostrar reserva e indicador 3D', 'checkbox'], ['showFuelEffects', 'Mostrar estela 3D al recargar', 'checkbox'],
    ];
    for (const [key, labelText, type] of fields) {
      const label = document.createElement('label');
      label.style.cssText = `display:flex;${type === 'checkbox' ? 'align-items:center' : 'flex-direction:column'};gap:6px;margin:9px 0;color:#ddd;font-size:12px;width:100%`;
      const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', labelText);
      input.style.cssText = 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
      if (type === 'checkbox') input.checked = settings[key];
      else input.value = String(settings[key]);
      if (type === 'number') { input.min = '0'; input.max = key === 'fuelRate' ? '10000' : '10000000'; input.step = '0.1'; }
      input.onchange = () => {
        const value = type === 'checkbox' ? input.checked : type === 'number' ? input.valueAsNumber : input.value;
        const normalized = normalizeFuelZone({ ...props, [key]: value });
        update(key, normalized[key]);
        if (key === 'fuelCapacity' && normalized.fuelRemaining !== props.fuelRemaining) update('fuelRemaining', normalized.fuelRemaining);
        for (const k of ['fuelRate', 'fuelCapacity', 'fuelRemaining']) controls.get(k)!.value = String(normalizeFuelZone(props)[k]);
        refresh();
      };
      if (type === 'checkbox') label.append(input, labelText); else label.append(labelText, input);
      container.appendChild(label); controls.set(key, input);
    }
    const fill = document.createElement('button'); fill.textContent = 'Rellenar reserva de la estación';
    fill.onclick = () => { update('fuelRemaining', normalizeFuelZone(props).fuelCapacity); controls.get('fuelRemaining')!.value = String(props.fuelRemaining); };
    container.appendChild(fill);
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:#9acfc5;line-height:1.5';
    hint.textContent = 'Recarga por contacto con el volumen de la zona, incluso vehículos estacionados. El caudal se reparte entre los depósitos en contacto y se detiene al llenarlos, salir o agotar la reserva. Una unidad equivale a un segundo de combustible al consumo normal. La reserva disponible se guarda con el mapa. Ajusta el tamaño y la rotación de la zona con las herramientas de construcción.';
    container.appendChild(hint); refresh();
  }
}

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
    const makeSectionHeader = (title: string, icon: string) => {
      const header = document.createElement('div');
      header.style.cssText = 'margin:14px 0 8px 0;padding:6px 8px;background:#142c28;border-left:3px solid #42ffd2;color:#9affde;font-size:12px;font-weight:bold;border-radius:2px;display:flex;align-items:center;gap:6px';
      header.textContent = `${icon} ${title}`;
      container.appendChild(header);
    };

    makeSectionHeader('Configuración General y Activación', '⚡');

    const fieldsGeneral = [
      ['name', 'Nombre', 'text'], ['fuelEnabled', 'Activar estación', 'checkbox'],
      ['refuelVehicles', 'Recargar vehículos', 'checkbox'], ['refuelJetpacks', 'Recargar jetpack equipado', 'checkbox'],
      ['fuelHoldSeconds', 'Mantener F para iniciar (segundos; 0 = pulsar)', 'number'],
      ['fuelRate', 'Caudal total (unidades por segundo)', 'number'], ['fuelLimited', 'Reserva limitada', 'checkbox'],
      ['fuelCapacity', 'Capacidad máxima de la estación', 'number'], ['fuelRemaining', 'Combustible disponible en la estación', 'number'],
    ];
    for (const [key, labelText, type] of fieldsGeneral) {
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

    const fill = document.createElement('button'); fill.textContent = 'Rellenar reserva de la estación';
    fill.style.cssText = 'background:#194d42;color:#a3ffea;border:1px solid #42ffd2;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;margin:6px 0;width:100%';
    fill.onclick = () => { update('fuelRemaining', normalizeFuelZone(props).fuelCapacity); controls.get('fuelRemaining')!.value = String(props.fuelRemaining); };
    container.appendChild(fill);

    // Reserve Bar Section
    makeSectionHeader('Barra de Reserva (Orientación, Colores y Posición 3D)', '⛽');

    // Direction dropdown
    const dirLabel = document.createElement('label');
    dirLabel.textContent = 'Orientación / Dirección de llenado';
    dirLabel.style.cssText = 'display:flex;flex-direction:column;gap:5px;color:#ddd;font-size:12px;margin:8px 0;width:100%';
    const dirSelect = document.createElement('select');
    dirSelect.style.cssText = 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
    for (const [val, txt] of [
      ['horizontal', 'Horizontal: Izquierda a Derecha'],
      ['horizontal-rl', 'Horizontal: Derecha a Izquierda'],
      ['vertical', 'Vertical: Abajo a Arriba (Columna/Tótem)'],
      ['vertical-tb', 'Vertical: Arriba a Abajo'],
    ]) {
      const opt = document.createElement('option'); opt.value = val; opt.textContent = txt;
      if (val === settings.fuelBarDirection) opt.selected = true;
      dirSelect.appendChild(opt);
    }
    dirSelect.onchange = () => update('fuelBarDirection', dirSelect.value);
    dirLabel.appendChild(dirSelect);
    container.appendChild(dirLabel);

    const fieldsBar = [
      ['showFuelBar', 'Mostrar barra de reserva', 'checkbox', 0, 0, 0],
      ['fuelBarColor', 'Color lleno / normal (reposo)', 'color', 0, 0, 0],
      ['fuelBarLowColor', 'Color nivel bajo', 'color', 0, 0, 0],
      ['fuelBarLowThreshold', 'Umbral nivel bajo (% para alerta amarilla)', 'range', 0.05, 0.75, 0.05],
      ['fuelBarEmptyColor', 'Color agotado / vacío', 'color', 0, 0, 0],
      ['fuelBarActiveColor', 'Color recargando (parpadeante)', 'color', 0, 0, 0],
      ['fuelBarEmissive', 'Intensidad de brillo / glow emisivo', 'number', 0, 3, 0.1],
      ['fuelBarBgVisible', 'Mostrar fondo/chasis exterior', 'checkbox', 0, 0, 0],
      ['fuelBarBgOpacity', 'Opacidad del fondo exterior', 'range', 0, 1, 0.05],
      ['fuelBarBgColor', 'Color del fondo exterior', 'color', 0, 0, 0],
      ['fuelBarBorderVisible', 'Mostrar bordes nítidos de la barra', 'checkbox', 0, 0, 0],
      ['fuelBarWidth', 'Largo / Ancho de la barra (X en m)', 'number', 0.01, 50, 0.1],
      ['fuelBarHeight', 'Alto de la barra (Y en m)', 'number', 0.01, 50, 0.02],
      ['fuelBarDepth', 'Grosor de la barra (Z en m)', 'number', 0.01, 50, 0.02],
      ['fuelBarOffsetX', 'Posición X (desplazamiento horizontal)', 'number', -50, 50, 0.1],
      ['fuelBarOffsetY', 'Altura Y (sobre superficie de la zona)', 'number', -50, 50, 0.05],
      ['fuelBarOffsetZ', 'Posición Z (desplazamiento profundidad)', 'number', -50, 50, 0.1],
      ['fuelBarRotationX', 'Rotación X de la barra (grados °)', 'number', -360, 360, 5],
      ['fuelBarRotationY', 'Rotación Y de la barra (grados °)', 'number', -360, 360, 5],
      ['fuelBarRotationZ', 'Rotación Z de la barra (grados °)', 'number', -360, 360, 5],
    ] as const;

    for (const [key, labelText, type, min, max, step] of fieldsBar) {
      const label = document.createElement('label');
      label.style.cssText = `display:flex;${type === 'checkbox' ? 'align-items:center' : 'flex-direction:column'};gap:6px;margin:8px 0;color:#ddd;font-size:12px;width:100%`;
      const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', labelText);
      input.style.cssText = type === 'color'
        ? 'width:40px;height:26px;border:none;background:transparent;cursor:pointer'
        : 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
      if (type === 'checkbox') input.checked = settings[key];
      else input.value = String(settings[key]);
      if (type === 'number' || type === 'range') { input.min = String(min); input.max = String(max); input.step = String(step); }
      input.onchange = () => {
        const value = type === 'checkbox' ? input.checked : (type === 'number' || type === 'range') ? input.valueAsNumber : input.value;
        const normalized = normalizeFuelZone({ ...props, [key]: value });
        update(key, normalized[key]);
        controls.get(key)!.value = String(normalizeFuelZone(props)[key]);
      };
      if (type === 'checkbox') label.append(input, labelText); else label.append(labelText, input);
      container.appendChild(label); controls.set(key, input);
    }

    const resetBarBtn = document.createElement('button');
    resetBarBtn.textContent = '↺ Restablecer barra por defecto';
    resetBarBtn.style.cssText = 'background:#1a3130;color:#98d6cb;border:1px solid #365b55;padding:5px;border-radius:4px;cursor:pointer;font-size:11px;margin:4px 0 10px 0;width:100%';
    resetBarBtn.onclick = () => {
      const defaults = {
        fuelBarWidth: 1.8,
        fuelBarHeight: 0.09,
        fuelBarDepth: 0.06,
        fuelBarOffsetX: 0,
        fuelBarOffsetY: 0.32,
        fuelBarOffsetZ: 0,
        fuelBarRotationX: 0,
        fuelBarRotationY: 0,
        fuelBarRotationZ: 0,
        fuelBarDirection: 'horizontal',
        fuelBarColor: '#00cc22',
        fuelBarLowColor: '#ffcc00',
        fuelBarLowThreshold: 0.25,
        fuelBarActiveColor: '#00ff11',
        fuelBarEmptyColor: '#ff1111',
        fuelBarEmissive: 0.8,
        fuelBarBgVisible: true,
        fuelBarBgOpacity: 0.35,
        fuelBarBgColor: '#071b18',
        fuelBarBorderVisible: true,
      };
      for (const [k, v] of Object.entries(defaults)) {
        update(k, v);
        const c = controls.get(k); if (c) c.value = String(v);
      }
      dirSelect.value = 'horizontal';
    };
    container.appendChild(resetBarBtn);

    // Floating Indicator Section
    makeSectionHeader('Indicador del Cartel (Flotante o Fijo en Superficie)', '💬');

    // Mode selector dropdown
    const indicatorModeLabel = document.createElement('label');
    indicatorModeLabel.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:8px 0;color:#ddd;font-size:12px;width:100%';
    indicatorModeLabel.append('Modo de orientación del cartel:');
    const indicatorModeSelect = document.createElement('select');
    indicatorModeSelect.setAttribute('aria-label', 'Modo del cartel');
    indicatorModeSelect.style.cssText = 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
    const optBillboard = document.createElement('option');
    optBillboard.value = 'billboard';
    optBillboard.textContent = 'Flotante (Mira siempre a la cámara)';
    const optSurface = document.createElement('option');
    optSurface.value = 'surface';
    optSurface.textContent = 'Fijo en superficie (Plano 3D orientable)';
    indicatorModeSelect.append(optBillboard, optSurface);
    indicatorModeSelect.value = settings.fuelIndicatorMode || 'billboard';
    indicatorModeSelect.onchange = () => {
      update('fuelIndicatorMode', indicatorModeSelect.value);
    };
    indicatorModeLabel.appendChild(indicatorModeSelect);
    container.appendChild(indicatorModeLabel);

    const fieldsIndicator = [
      ['showFuelIndicator', 'Mostrar cartel e indicadores flotantes', 'checkbox', 0, 0, 0],
      ['showFuelStatus', 'Mostrar texto de estado (Gasolina / Recargando)', 'checkbox', 0, 0, 0],
      ['showFuelReserve', 'Mostrar combustible disponible en cartel', 'checkbox', 0, 0, 0],
      ['showFuelRate', 'Mostrar caudal por segundo en cartel', 'checkbox', 0, 0, 0],
      ['showFuelEffects', 'Mostrar estela 3D al recargar', 'checkbox', 0, 0, 0],
      ['fuelIndicatorWidth', 'Ancho del cartel (metros)', 'number', 0.2, 50, 0.1],
      ['fuelIndicatorHeight', 'Alto del cartel (metros)', 'number', 0.1, 50, 0.1],
      ['fuelIndicatorRotationX', 'Rotación X del cartel (grados)', 'number', -360, 360, 5],
      ['fuelIndicatorRotationY', 'Rotación Y del cartel (grados)', 'number', -360, 360, 5],
      ['fuelIndicatorRotationZ', 'Rotación Z del cartel (grados)', 'number', -360, 360, 5],
      ['fuelIndicatorOffsetX', 'Posición X del cartel (metros)', 'number', -50, 50, 0.1],
      ['fuelIndicatorOffsetY', 'Altura Y del cartel (sobre zona en metros)', 'number', -50, 50, 0.05],
      ['fuelIndicatorOffsetZ', 'Posición Z del cartel (metros)', 'number', -50, 50, 0.1],
    ] as const;

    for (const [key, labelText, type, min, max, step] of fieldsIndicator) {
      const label = document.createElement('label');
      label.style.cssText = `display:flex;${type === 'checkbox' ? 'align-items:center' : 'flex-direction:column'};gap:6px;margin:8px 0;color:#ddd;font-size:12px;width:100%`;
      const input = document.createElement('input'); input.type = type; input.setAttribute('aria-label', labelText);
      input.style.cssText = 'box-sizing:border-box;max-width:100%;background:#182626;color:white;border:1px solid #42635f;border-radius:4px;padding:5px';
      if (type === 'checkbox') input.checked = settings[key];
      else input.value = String(settings[key]);
      if (type === 'number') { input.min = String(min); input.max = String(max); input.step = String(step); }
      input.onchange = () => {
        const value = type === 'checkbox' ? input.checked : type === 'number' ? input.valueAsNumber : input.value;
        const normalized = normalizeFuelZone({ ...props, [key]: value });
        update(key, normalized[key]);
        controls.get(key)!.value = String(normalizeFuelZone(props)[key]);
      };
      if (type === 'checkbox') label.append(input, labelText); else label.append(labelText, input);
      container.appendChild(label); controls.set(key, input);
    }

    const resetIndicatorBtn = document.createElement('button');
    resetIndicatorBtn.textContent = '↺ Restablecer cartel por defecto';
    resetIndicatorBtn.style.cssText = 'background:#1a3130;color:#98d6cb;border:1px solid #365b55;padding:5px;border-radius:4px;cursor:pointer;font-size:11px;margin:4px 0 10px 0;width:100%';
    resetIndicatorBtn.onclick = () => {
      const defaults = {
        fuelIndicatorMode: 'billboard',
        fuelIndicatorWidth: 2.8,
        fuelIndicatorHeight: 1.4,
        fuelIndicatorRotationX: 0,
        fuelIndicatorRotationY: 0,
        fuelIndicatorRotationZ: 0,
        fuelIndicatorScale: 1.0,
        fuelIndicatorOffsetX: 0,
        fuelIndicatorOffsetY: 0.85,
        fuelIndicatorOffsetZ: 0
      };
      for (const [k, v] of Object.entries(defaults)) {
        update(k, v);
        const c = controls.get(k); if (c) c.value = String(v);
      }
      indicatorModeSelect.value = 'billboard';
    };
    container.appendChild(resetIndicatorBtn);

    makeSectionHeader('Borde Visual 3D de la Zona', '🔲');
    renderFuelZoneBorder(container, props, update);

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:#9acfc5;line-height:1.5;margin-top:12px';
    hint.textContent = 'Puedes modificar la posición, tamaño, largo y rotación de la barra de reserva y del indicador flotante de forma individual. Todo se guarda automáticamente con el mapa. En el Inspector de Objetos puedes además seleccionar la barra o el cartel para moverlos y escalarlos directamente con el Gizmo 3D.';
    container.appendChild(hint); refresh();
  }
}

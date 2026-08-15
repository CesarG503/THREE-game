import { MOTORBIKE_FIELDS, normalizeMotorbikeSettings } from '../../vehicles/MotorbikeSettings';

/** Used by both the library draft and the placed-object inspector. */
export class MotorbikeLogic {
  render(container: HTMLElement, props: any, update: (key: string, value: number | boolean) => void) {
    if (props?.vehicleKind !== 'motorbike') return;
    const hint = document.createElement('p');
    hint.textContent = 'Dos asientos. F: subir / bajar · R: cambiar al asiento libre · W/S: acelerar / reversa · A/D: girar · Shift: frenar y hacer drift · Espacio: saltar. Si está detenida, Shift + A/D gira sobre su propio eje. El pasajero puede usar armas y construir; Mayús + R recarga o rota la construcción. El combustible se gasta al acelerar. Tiempo F en 0 sube al instante.';
    hint.style.cssText = 'font-size:12px;color:#a5d8ff;line-height:1.5';
    container.appendChild(hint);
    const penaltyLabel = document.createElement('label');
    penaltyLabel.style.cssText = 'display:flex;align-items:center;gap:8px;margin:12px 0;color:#ccc;font-size:12px';
    const penalty = document.createElement('input');
    penalty.type = 'checkbox';
    penalty.checked = normalizeMotorbikeSettings(props).dismountPenaltyEnabled;
    penaltyLabel.append(penalty, 'Caída y daño al bajar a alta velocidad');
    container.appendChild(penaltyLabel);
    const inputs = new Map<string, HTMLInputElement>();
    const refreshPenalty = () => {
      for (const key of ['dismountFallSpeed', 'dismountDamagePercent']) {
        const input = inputs.get(key);
        if (input) input.disabled = !penalty.checked;
      }
    };
    penalty.onchange = () => {
      update('dismountPenaltyEnabled', penalty.checked);
      refreshPenalty();
    };
    for (const field of MOTORBIKE_FIELDS) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:8px 0;color:#ccc;font-size:12px';
      label.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(normalizeMotorbikeSettings(props)[field.key]);
      input.style.cssText = 'background:#222;border:1px solid #555;border-radius:4px;padding:6px;color:white;width:100%;box-sizing:border-box';
      input.onchange = () => {
        if (input.value.trim() === '' || !Number.isFinite(input.valueAsNumber)) {
          input.value = String(normalizeMotorbikeSettings(props)[field.key]);
          return;
        }
        const normalized = normalizeMotorbikeSettings({ ...props, [field.key]: input.valueAsNumber });
        for (const definition of MOTORBIKE_FIELDS) {
          if (props[definition.key] !== normalized[definition.key]) update(definition.key, normalized[definition.key]);
          const control = inputs.get(definition.key);
          if (control) control.value = String(normalized[definition.key]);
        }
      };
      inputs.set(field.key, input);
      label.appendChild(input);
      container.appendChild(label);
    }
    refreshPenalty();
  }
}

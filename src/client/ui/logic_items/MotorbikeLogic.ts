import { GRAVITY_ORIENTATION_OPTIONS } from '../../utils/GravityOrientation';
import { MOTORBIKE_FIELDS, normalizeMotorbikeSettings } from '../../vehicles/MotorbikeSettings';

/** Used by both the library draft and the placed-object inspector. */
export class MotorbikeLogic {
  render(container: HTMLElement, props: any, update: (key: string, value: number | boolean | string) => void) {
    if (props?.vehicleKind !== 'motorbike') return;
    const hint = document.createElement('p');
    hint.textContent = 'Dos asientos. F: subir / bajar · R: cambiar al asiento libre · W/S: acelerar / reversa · A/D: girar · Shift: frenar y hacer drift (deja marcas de neumático en el suelo) · Espacio: saltar. Si el conductor tiene un jetpack seleccionado, mantener Espacio activa el impulso del jetpack y consume ese combustible en lugar de gasolina. Si está detenida, Shift + A/D gira sobre su propio eje. El pasajero puede usar armas y construir; Mayús + R recarga o rota la construcción. El combustible se gasta al acelerar. Tiempo F en 0 sube al instante.';
    hint.style.cssText = 'font-size:12px;color:#a5d8ff;line-height:1.5';
    container.appendChild(hint);
    const stabilizeLabel = document.createElement('label');
    stabilizeLabel.style.cssText = 'display:flex;flex:1 1 100px;align-items:center;gap:8px;margin:12px 0;color:#ccc;font-size:12px';
    const stabilize = document.createElement('input');
    stabilize.type = 'checkbox';
    stabilize.checked = normalizeMotorbikeSettings(props).autoStabilize;
    stabilize.setAttribute('aria-label', 'Estabilización automática');
    stabilize.onchange = () => update('autoStabilize', stabilize.checked);
    stabilizeLabel.append(stabilize, 'Estabilización automática');
    const recoveryOptions = document.createElement('div');
    recoveryOptions.style.cssText = 'display:flex;flex-wrap:wrap;gap:0 16px';
    recoveryOptions.appendChild(stabilizeLabel);
    const landingLabel = document.createElement('label');
    landingLabel.style.cssText = stabilizeLabel.style.cssText;
    const landing = document.createElement('input');
    landing.type = 'checkbox';
    landing.checked = normalizeMotorbikeSettings(props).landingAssistEnabled;
    landingLabel.append(landing, 'Aterrizaje asistido con Shift');
    recoveryOptions.appendChild(landingLabel);
    container.appendChild(recoveryOptions);
    const landingModeLabel = document.createElement('label');
    landingModeLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px;color:#ccc;font-size:12px';
    landingModeLabel.textContent = 'Cuándo permitir la ayuda con Shift: ';
    const landingMode = document.createElement('select');
    landingMode.style.cssText = 'width:100%;min-width:0';
    for (const [value, text] of [['any-airborne', 'En cualquier salto o caída'], ['inverted-detach', 'Solo al desprenderse de una superficie de cabeza']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = text; landingMode.appendChild(option);
    }
    landingMode.value = normalizeMotorbikeSettings(props).landingAssistMode;
    landingMode.disabled = !landing.checked;
    landingMode.onchange = () => update('landingAssistMode', landingMode.value);
    landing.onchange = () => { update('landingAssistEnabled', landing.checked); landingMode.disabled = !landing.checked; };
    landingModeLabel.appendChild(landingMode);
    container.appendChild(landingModeLabel);
    const recoveryHint = document.createElement('p');
    recoveryHint.textContent = 'Estabilización automática: recupera el equilibrio en el suelo después de una mala caída. Desactivada: si vuelcas, bajas de la moto; F la pone de pie y otra F permite subir. Aterrizaje asistido con Shift funciona de forma independiente: mantén Shift para enderezarte y suéltalo para girar libremente. En el modo de desprendimiento, debes haber estado apoyado de cabeza; puedes pulsar Shift después de soltarte, hasta volver a tocar una superficie. Girar de cabeza durante un salto normal no activa ese modo. Las paredes pronunciadas requieren velocidad.';
    recoveryHint.style.cssText = hint.style.cssText;
    container.appendChild(recoveryHint);
    const gravityLabel = document.createElement('label');
    gravityLabel.textContent = 'Eje de gravedad (los pads lo cambian al conducir): ';
    const gravity = document.createElement('select');
    for (const entry of [{ value: 'inherit', label: 'Gravedad del jugador al colocar' }, ...GRAVITY_ORIENTATION_OPTIONS]) {
      const option = document.createElement('option');
      option.value = entry.value;
      option.textContent = entry.label;
      gravity.appendChild(option);
    }
    gravity.value = normalizeMotorbikeSettings(props).gravityOrientation;
    gravity.onchange = () => update('gravityOrientation', gravity.value);
    gravityLabel.appendChild(gravity);
    container.appendChild(gravityLabel);
    const penaltyLabel = document.createElement('label');
    penaltyLabel.style.cssText = 'display:flex;align-items:center;gap:8px;margin:12px 0;color:#ccc;font-size:12px';
    const penalty = document.createElement('input');
    penalty.type = 'checkbox';
    penalty.checked = normalizeMotorbikeSettings(props).dismountPenaltyEnabled;
    penaltyLabel.append(penalty, 'Daño por caída y al bajar a alta velocidad');
    container.appendChild(penaltyLabel);
    const crashHint = document.createElement('p');
    crashHint.style.cssText = hint.style.cssText;
    crashHint.textContent = 'Con daño por caída activado y sin estabilizador, un vuelco hace caer y daña al jugador aunque vaya despacio. Si también activas la durabilidad, cada caída de la moto resta la cantidad configurada. Los aterrizajes normales sobre las ruedas no se penalizan.';
    container.appendChild(crashHint);
    const durabilityLabel = document.createElement('label');
    durabilityLabel.style.cssText = penaltyLabel.style.cssText;
    const durability = document.createElement('input');
    durability.type = 'checkbox';
    durability.checked = normalizeMotorbikeSettings(props).durabilityEnabled;
    durabilityLabel.append(durability, 'Activar durabilidad (en 0 la moto queda averiada)');
    container.appendChild(durabilityLabel);
    const durabilitySettings = document.createElement('div');
    container.appendChild(durabilitySettings);
    const crashSettings = document.createElement('div');
    container.appendChild(crashSettings);
    const crashModeLabel = document.createElement('label');
    crashModeLabel.textContent = 'Daño al vehículo por caída: ';
    const crashMode = document.createElement('select');
    for (const [value, text] of [['percent', 'Porcentaje de durabilidad máxima'], ['fixed', 'Cantidad fija']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = text; crashMode.appendChild(option);
    }
    crashMode.value = normalizeMotorbikeSettings(props).crashDamageMode;
    crashModeLabel.appendChild(crashMode);
    crashSettings.appendChild(crashModeLabel);
    const explosionLabel = document.createElement('label');
    explosionLabel.style.cssText = penaltyLabel.style.cssText;
    const explosion = document.createElement('input');
    explosion.type = 'checkbox';
    explosion.checked = normalizeMotorbikeSettings(props).explosionDamageEnabled;
    explosionLabel.append(explosion, 'Daño por explosión al llegar a 0 de durabilidad');
    container.appendChild(explosionLabel);
    const explosionSettings = document.createElement('div');
    explosionSettings.style.cssText = 'padding-left:12px;border-left:2px solid #f97316';
    container.appendChild(explosionSettings);
    const inputs = new Map<string, HTMLInputElement>();
    const refreshCrash = () => {
      crashMode.disabled = !penalty.checked || !durability.checked;
      for (const [key, mode] of [['crashDamagePercent', 'percent'], ['crashDamageFixed', 'fixed']]) {
        const input = inputs.get(key);
        if (input) {
          input.disabled = crashMode.disabled || crashMode.value !== mode;
          input.parentElement!.style.display = crashMode.value === mode ? 'flex' : 'none';
        }
      }
    };
    crashMode.onchange = () => { update('crashDamageMode', crashMode.value); refreshCrash(); };
    const refreshPenalty = () => {
      refreshCrash();
      for (const key of ['dismountFallSpeed', 'dismountDamagePercent']) {
        const input = inputs.get(key);
        if (input) input.disabled = !penalty.checked;
      }
    };
    const refreshDurability = () => {
      refreshCrash();
      explosion.disabled = !durability.checked;
      for (const key of ['explosionDamage', 'explosionRadius']) {
        const input = inputs.get(key);
        if (input) input.disabled = !durability.checked || !explosion.checked;
      }
      for (const key of ['maxDurability', 'durability']) {
        const input = inputs.get(key);
        if (input) input.disabled = !durability.checked;
      }
    };
    explosion.onchange = () => {
      update('explosionDamageEnabled', explosion.checked);
      refreshDurability();
    };
    durability.onchange = () => {
      update('durabilityEnabled', durability.checked);
      refreshDurability();
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
      const parent = ['explosionDamage', 'explosionRadius'].includes(field.key) ? explosionSettings
        : ['crashDamagePercent', 'crashDamageFixed'].includes(field.key) ? crashSettings
        : ['maxDurability', 'durability'].includes(field.key) ? durabilitySettings : container;
      parent.appendChild(label);
    }
    refreshPenalty();
    refreshDurability();
  }
}

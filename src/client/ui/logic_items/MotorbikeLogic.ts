import { GRAVITY_ORIENTATION_OPTIONS } from '../../utils/GravityOrientation';
import { MOTORBIKE_FIELDS, normalizeMotorbikeSettings } from '../../vehicles/MotorbikeSettings';
import { SectionedItemEditor, SECTION_ICONS, type EditorSectionDef } from '../components/SectionedItemEditor';

export interface MotorbikeBuiltSections {
  section2Seats: HTMLElement;
  section3: HTMLElement;
  section4: HTMLElement;
  section5: HTMLElement;
  section6: HTMLElement;
  section7: HTMLElement;
  section8: HTMLElement;
}

/** Used by both the library draft and the placed-object inspector. */
export class MotorbikeLogic {
  /**
   * Builds the individual DOM containers and control bindings for vehicle sections 2 to 8.
   * Can be combined with Appearance and Dimension controls in ConstructionMenu.
   */
  public buildSections(props: any, update: (key: string, value: number | boolean | string) => void): MotorbikeBuiltSections {
    const settings = normalizeMotorbikeSettings(props);
    const inputs = new Map<string, HTMLInputElement>();

    // Helper hint style
    const makeHint = (text: string) => {
      const p = document.createElement('p');
      p.textContent = text;
      p.style.cssText = 'font-size:11.5px;color:#93c5fd;line-height:1.45;background:rgba(59,130,246,0.08);padding:8px 10px;border-radius:6px;border-left:3px solid #3b82f6;margin:6px 0;';
      return p;
    };

    // Helper checkbox style
    const makeCheckbox = (label: string, checked: boolean, onChange: (val: boolean) => void) => {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;color:#e2e8f0;font-size:12px;cursor:pointer;user-select:none;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.style.cssText = 'cursor:pointer;accent-color:#00f0ff;width:15px;height:15px;';
      input.onchange = () => onChange(input.checked);
      lbl.append(input, label);
      return { container: lbl, input };
    };

    // Helper number field
    const createField = (key: string, targetContainer: HTMLElement) => {
      const field = MOTORBIKE_FIELDS.find(f => f.key === key);
      if (!field) return null;
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:6px 0;color:#cbd5e1;font-size:11.5px;';
      label.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(normalizeMotorbikeSettings(props)[field.key]);
      input.style.cssText = 'background:#181820;border:1px solid #3b4252;border-radius:6px;padding:6px 8px;color:#f8fafc;width:100%;box-sizing:border-box;font-size:12px;outline:none;transition:border-color 0.15s;';
      input.onfocus = () => input.style.borderColor = '#00f0ff';
      input.onblur = () => input.style.borderColor = '#3b4252';
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
      targetContainer.appendChild(label);
      return { label, input };
    };

    // ==========================================
    // SECCIÓN 2: Asientos (Geometría complementaria)
    // ==========================================
    const section2Seats = document.createElement('div');
    section2Seats.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;';
    const s2Title = document.createElement('div');
    s2Title.textContent = 'Posición de Asientos y Alturas:';
    s2Title.style.cssText = 'font-size:12px;font-weight:600;color:#38bdf8;margin-bottom:4px;';
    section2Seats.appendChild(s2Title);
    createField('seatHeight', section2Seats);
    createField('seatOffsetZ', section2Seats);
    createField('passengerSeatHeight', section2Seats);
    createField('passengerSeatOffsetZ', section2Seats);

    // ==========================================
    // SECCIÓN 3: Conducción y rendimiento
    // ==========================================
    const section3 = document.createElement('div');
    section3.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    createField('maxSpeed', section3);
    createField('reverseSpeed', section3);
    createField('acceleration', section3);
    createField('braking', section3);
    createField('turnSpeed', section3);
    createField('driftTurnMultiplier', section3);
    createField('driftBrakeMultiplier', section3);
    createField('driftMarkDuration', section3);
    createField('stationaryTurnSpeed', section3);

    // ==========================================
    // SECCIÓN 4: Asientos y controles
    // ==========================================
    const section4 = document.createElement('div');
    section4.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    
    // Modo de dos asientos
    const twoSeatsCb = makeCheckbox('Modo de dos asientos (permite pasajero)', settings.twoSeatsEnabled, (val) => {
      update('twoSeatsEnabled', val);
    });
    section4.appendChild(twoSeatsCb.container);

    createField('riderLean', section4);
    createField('maxLean', section4);
    createField('holdTime', section4);
    createField('dismountFallSpeed', section4);

    const controlsHint = makeHint('Controles: F para subir / bajar · R cambiar asiento · W/S acelerar / reversa · A/D girar · Shift freno / drift con marcas · Espacio saltar (o jetpack si está equipado) · Con moto detenida: Shift + A/D gira en el sitio. Pasajero puede disparar y construir; Mayús + R recarga/rota.');
    section4.appendChild(controlsHint);

    // ==========================================
    // SECCIÓN 5: Física, gravedad y estabilidad
    // ==========================================
    const section5 = document.createElement('div');
    section5.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const stabilizeCb = makeCheckbox('Estabilización automática al tocar el suelo', settings.autoStabilize, (val) => {
      update('autoStabilize', val);
    });
    section5.appendChild(stabilizeCb.container);

    const landingCb = makeCheckbox('Aterrizaje asistido con Shift en el aire', settings.landingAssistEnabled, (val) => {
      update('landingAssistEnabled', val);
      landingMode.disabled = !val;
    });
    section5.appendChild(landingCb.container);

    const landingModeLabel = document.createElement('label');
    landingModeLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px;color:#cbd5e1;font-size:11.5px;';
    landingModeLabel.textContent = 'Cuándo permitir la ayuda con Shift:';
    const landingMode = document.createElement('select');
    landingMode.style.cssText = 'background:#181820;border:1px solid #3b4252;border-radius:6px;padding:6px;color:#f8fafc;font-size:12px;outline:none;width:100%;';
    for (const [val, txt] of [['any-airborne', 'En cualquier salto o caída libre'], ['inverted-detach', 'Solo al soltarse de una superficie de cabeza']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = txt; landingMode.appendChild(opt);
    }
    landingMode.value = settings.landingAssistMode;
    landingMode.disabled = !landingCb.input.checked;
    landingMode.onchange = () => update('landingAssistMode', landingMode.value);
    landingModeLabel.appendChild(landingMode);
    section5.appendChild(landingModeLabel);

    const gravityLabel = document.createElement('label');
    gravityLabel.style.cssText = landingModeLabel.style.cssText;
    gravityLabel.textContent = 'Eje de gravedad inicial:';
    const gravity = document.createElement('select');
    gravity.style.cssText = landingMode.style.cssText;
    for (const entry of [{ value: 'inherit', label: 'Gravedad del jugador al colocar' }, ...GRAVITY_ORIENTATION_OPTIONS]) {
      const opt = document.createElement('option');
      opt.value = entry.value; opt.textContent = entry.label; gravity.appendChild(opt);
    }
    gravity.value = settings.gravityOrientation;
    gravity.onchange = () => update('gravityOrientation', gravity.value);
    gravityLabel.appendChild(gravity);
    section5.appendChild(gravityLabel);

    createField('jumpForce', section5);
    createField('jumpCooldown', section5);

    const recoveryHint = makeHint('Estabilización: mantiene la moto nivelada. Si se desactiva, un vuelco te desmonta y F la pone de pie. Shift asistido te permite orientar la moto en el aire hacia la superficie de apoyo.');
    section5.appendChild(recoveryHint);

    // ==========================================
    // SECCIÓN 6: Durabilidad y daños
    // ==========================================
    const section6 = document.createElement('div');
    section6.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const durabilityCb = makeCheckbox('Activar durabilidad (en 0 la moto queda averiada)', settings.durabilityEnabled, (val) => {
      update('durabilityEnabled', val);
      refreshDurability();
    });
    section6.appendChild(durabilityCb.container);

    const durabilitySettings = document.createElement('div');
    durabilitySettings.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding-left:8px;border-left:2px solid #3b82f6;';
    createField('maxDurability', durabilitySettings);
    createField('durability', durabilitySettings);
    section6.appendChild(durabilitySettings);

    const penaltyCb = makeCheckbox('Daño por caída y al bajar a alta velocidad', settings.dismountPenaltyEnabled, (val) => {
      update('dismountPenaltyEnabled', val);
      refreshPenalty();
    });
    section6.appendChild(penaltyCb.container);

    const crashSettings = document.createElement('div');
    crashSettings.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding-left:8px;border-left:2px solid #eab308;';
    const crashModeLabel = document.createElement('label');
    crashModeLabel.style.cssText = landingModeLabel.style.cssText;
    crashModeLabel.textContent = 'Tipo de cálculo del daño por caída:';
    const crashMode = document.createElement('select');
    crashMode.style.cssText = landingMode.style.cssText;
    for (const [val, txt] of [['percent', 'Porcentaje de durabilidad máxima'], ['fixed', 'Cantidad fija de puntos']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = txt; crashMode.appendChild(opt);
    }
    crashMode.value = settings.crashDamageMode;
    crashModeLabel.appendChild(crashMode);
    crashSettings.appendChild(crashModeLabel);

    createField('crashDamagePercent', crashSettings);
    createField('crashDamageFixed', crashSettings);
    createField('dismountDamagePercent', crashSettings);
    section6.appendChild(crashSettings);

    const explosionCb = makeCheckbox('Daño por explosión al llegar a 0 de durabilidad', settings.explosionDamageEnabled, (val) => {
      update('explosionDamageEnabled', val);
      refreshDurability();
    });
    section6.appendChild(explosionCb.container);

    const explosionSettings = document.createElement('div');
    explosionSettings.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding-left:8px;border-left:2px solid #ef4444;';
    createField('explosionDamage', explosionSettings);
    createField('explosionRadius', explosionSettings);
    section6.appendChild(explosionSettings);

    const crashHint = makeHint('Al activar el daño por caída, los choques fuertes a alta velocidad o vuelcos dañan tanto la moto como al jugador que la conduce.');
    section6.appendChild(crashHint);

    // ==========================================
    // SECCIÓN 7: Jetpack y combustible
    // ==========================================
    const section7 = document.createElement('div');
    section7.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    createField('jetpackAccelerationBonus', section7);
    createField('jetpackMaxSpeedBonus', section7);
    createField('maxConsumableUse', section7);
    createField('consumableUse', section7);
    createField('fuelConsumption', section7);
    const fuelHint = makeHint('El combustible se consume progresivamente al acelerar. Si el conductor tiene un jetpack equipado, mantener Espacio consume combustible del jetpack e impulsa la moto hacia el frente.');
    section7.appendChild(fuelHint);

    // ==========================================
    // SECCIÓN 8: Efectos visuales y velocidad
    // ==========================================
    const section8 = document.createElement('div');
    section8.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    // 8.1 Speed lines
    const speedEffectCb = makeCheckbox('⚡ Efecto de velocidad en pantalla (Speed Lines y FOV)', settings.speedEffectEnabled, (val) => {
      update('speedEffectEnabled', val);
      refreshSpeedEffect();
    });
    section8.appendChild(speedEffectCb.container);

    const speedEffectSettings = document.createElement('div');
    speedEffectSettings.style.cssText = 'padding-left:8px;border-left:2px solid #38bdf8;margin:4px 0;display:flex;flex-direction:column;gap:6px;';
    section8.appendChild(speedEffectSettings);

    const colorRow = document.createElement('label');
    colorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#cbd5e1;font-size:12px;margin:2px 0;';
    colorRow.textContent = 'Color de las líneas en pantalla:';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = settings.speedEffectColor || '#d4ecff';
    colorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    colorInput.onchange = () => update('speedEffectColor', colorInput.value);
    colorRow.appendChild(colorInput);
    speedEffectSettings.appendChild(colorRow);

    createField('speedEffectThreshold', speedEffectSettings);
    createField('speedEffectMax', speedEffectSettings);
    createField('speedEffectLines', speedEffectSettings);
    createField('speedEffectFovBonus', speedEffectSettings);
    createField('speedEffectOpacity', speedEffectSettings);

    // 8.2 Estelas 3D
    const speedTrailsCb = makeCheckbox('🌐 Estelas 3D en vehículo y personaje (visibles por otros)', settings.speedTrailsEnabled, (val) => {
      update('speedTrailsEnabled', val);
      refreshSpeedEffect();
    });
    speedEffectSettings.appendChild(speedTrailsCb.container);

    const trailsColorRow = document.createElement('label');
    trailsColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#cbd5e1;font-size:12px;margin:2px 0;';
    trailsColorRow.textContent = 'Color de las estelas 3D:';
    const trailsColorInput = document.createElement('input');
    trailsColorInput.type = 'color';
    trailsColorInput.value = settings.speedTrailsColor || settings.speedEffectColor || '#d4ecff';
    trailsColorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    trailsColorInput.onchange = () => update('speedTrailsColor', trailsColorInput.value);
    trailsColorRow.appendChild(trailsColorInput);
    speedEffectSettings.appendChild(trailsColorRow);

    createField('speedTrailsCount', speedEffectSettings);
    createField('speedTrailsLength', speedEffectSettings);
    createField('speedTrailsWidth', speedEffectSettings);

    const speedTrailsDynamicCb = makeCheckbox('✨ Ráfagas dinámicas (desactivado: estelas fijas)', settings.speedTrailsDynamic, (val) => {
      update('speedTrailsDynamic', val);
      refreshSpeedEffect();
    });
    speedEffectSettings.appendChild(speedTrailsDynamicCb.container);
    createField('speedTrailsInterval', speedEffectSettings);

    const speedTrailsCustomSpeedCb = makeCheckbox('⏱️ Rango de velocidad independiente para estelas', settings.speedTrailsCustomSpeed, (val) => {
      update('speedTrailsCustomSpeed', val);
      refreshSpeedEffect();
    });
    speedEffectSettings.appendChild(speedTrailsCustomSpeedCb.container);
    createField('speedTrailsThreshold', speedEffectSettings);
    createField('speedTrailsMax', speedEffectSettings);

    // 8.3 Muro Tron
    const tronWallCb = makeCheckbox('⚡ Muro de luz temporal (estilo Tron)', settings.tronWallEnabled, (val) => {
      update('tronWallEnabled', val);
      refreshTronWall();
    });
    section8.appendChild(tronWallCb.container);

    const tronWallSettings = document.createElement('div');
    tronWallSettings.style.cssText = 'padding-left:8px;border-left:2px solid #00f0ff;margin:4px 0;display:flex;flex-direction:column;gap:6px;';
    section8.appendChild(tronWallSettings);

    const tronColorRow = document.createElement('label');
    tronColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#cbd5e1;font-size:12px;margin:2px 0;';
    tronColorRow.textContent = 'Color del muro de luz:';
    const tronColorInput = document.createElement('input');
    tronColorInput.type = 'color';
    tronColorInput.value = settings.tronWallColor || '#00f0ff';
    tronColorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    tronColorInput.onchange = () => update('tronWallColor', tronColorInput.value);
    tronColorRow.appendChild(tronColorInput);
    tronWallSettings.appendChild(tronColorRow);

    const tronCollisionCb = makeCheckbox('🛡️ Colisión física sólida (bloquea paso)', settings.tronWallCollision, (val) => {
      update('tronWallCollision', val);
      refreshTronWall();
    });
    tronWallSettings.appendChild(tronCollisionCb.container);

    const tronAnimRow = document.createElement('label');
    tronAnimRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#cbd5e1;font-size:11.5px;gap:8px;';
    tronAnimRow.textContent = 'Animación de salida:';
    const tronAnimSelect = document.createElement('select');
    tronAnimSelect.style.cssText = 'background:#181820;color:#00f0ff;border:1px solid #00f0ff;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;outline:none;';
    const optGrow = document.createElement('option');
    optGrow.value = 'grow'; optGrow.textContent = '🌊 Elevación progresiva (crece)';
    const optInstant = document.createElement('option');
    optInstant.value = 'instant'; optInstant.textContent = '⚡ Aparición directa (completa)';
    tronAnimSelect.append(optGrow, optInstant);
    tronAnimSelect.value = settings.tronWallAnimMode || 'grow';
    tronAnimSelect.onchange = () => update('tronWallAnimMode', tronAnimSelect.value);
    tronAnimRow.appendChild(tronAnimSelect);
    tronWallSettings.appendChild(tronAnimRow);

    createField('tronWallHeight', tronWallSettings);
    createField('tronWallDuration', tronWallSettings);
    createField('tronWallSinkDuration', tronWallSettings);
    createField('tronWallMinSpeed', tronWallSettings);

    // 8.4 Controlador de Daño del Muro Tron
    const tronDmgGroup = document.createElement('div');
    tronDmgGroup.style.cssText = 'border-top:1px solid #ff4444;margin-top:10px;padding-top:8px;display:flex;flex-direction:column;gap:6px;';
    tronWallSettings.appendChild(tronDmgGroup);

    const tronDmgHeader = document.createElement('div');
    tronDmgHeader.textContent = '💥 Controlador de Daño del Muro Tron';
    tronDmgHeader.style.cssText = 'font-weight:700;font-size:12px;color:#ff5555;';
    tronDmgGroup.appendChild(tronDmgHeader);

    const tronDmgEnableCb = makeCheckbox('⚔️ Habilitar Daño por Colisión', settings.tronWallDamageEnabled, (val) => {
      update('tronWallDamageEnabled', val);
      tronDmgContent.style.display = (tronWallCb.input.checked && val) ? 'flex' : 'none';
    });
    tronDmgGroup.appendChild(tronDmgEnableCb.container);

    const tronDmgContent = document.createElement('div');
    tronDmgContent.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding-left:8px;border-left:2px solid #ef4444;margin-top:2px;';
    tronDmgGroup.appendChild(tronDmgContent);

    // Targets
    const targetsRow = document.createElement('div');
    targetsRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;background:#181824;padding:6px 8px;border-radius:6px;border:1px solid #333;';
    const targetTitle = document.createElement('span');
    targetTitle.textContent = 'Objetivos afectados:';
    targetTitle.style.cssText = 'font-size:10.5px;color:#94a3b8;font-weight:600;';
    targetsRow.appendChild(targetTitle);

    const dmgPlayersCb = makeCheckbox('👤 Dañar Jugadores (Personajes)', settings.tronWallDamagePlayers, (v) => update('tronWallDamagePlayers', v));
    const dmgVehiclesCb = makeCheckbox('🏍️ Dañar Vehículos (Durabilidad)', settings.tronWallDamageVehicles, (v) => update('tronWallDamageVehicles', v));
    targetsRow.append(dmgPlayersCb.container, dmgVehiclesCb.container);
    tronDmgContent.appendChild(targetsRow);

    // Daño base y porcentual
    const makeDmgNumInput = (labelText: string, val: number, onChange: (v: number) => void, min = 0, max?: number, step = 1) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
      const lbl = document.createElement('label');
      lbl.textContent = labelText;
      lbl.style.cssText = 'color:#cbd5e1;font-size:11px;';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(min);
      if (max !== undefined) inp.max = String(max);
      inp.step = String(step);
      inp.value = String(val);
      inp.style.cssText = 'background:#181820;border:1px solid #3b4252;color:#f8fafc;padding:5px 8px;font-size:11.5px;border-radius:5px;outline:none;';
      inp.onchange = () => onChange(parseFloat(inp.value) || 0);
      wrap.append(lbl, inp);
      return { wrap, inp };
    };

    const baseDmgInput = makeDmgNumInput('Daño Base:', settings.tronWallDamage, (v) => update('tronWallDamage', Math.max(0, v)));
    tronDmgContent.appendChild(baseDmgInput.wrap);

    const pctDmgInput = makeDmgNumInput('Daño Porcentual (%):', settings.tronWallPercentDamage, (v) => update('tronWallPercentDamage', Math.max(0, Math.min(100, v))), 0, 100);
    tronDmgContent.appendChild(pctDmgInput.wrap);

    const ikCb = makeCheckbox('💀 Muerte Instantánea', settings.tronWallInstantKill, (v) => update('tronWallInstantKill', v));
    tronDmgContent.appendChild(ikCb.container);

    const maxDmgInput = makeDmgNumInput('Límite Máximo Daño (por golpe):', settings.tronWallMaxDamage, (v) => update('tronWallMaxDamage', Math.max(1, v)), 1);
    tronDmgContent.appendChild(maxDmgInput.wrap);

    const cdDmgInput = makeDmgNumInput('Intervalo Cooldown (s):', settings.tronWallDamageCooldown, (v) => update('tronWallDamageCooldown', Math.max(0.05, v)), 0.05, undefined, 0.1);
    tronDmgContent.appendChild(cdDmgInput.wrap);

    // Stop limit
    const slCheckCb = makeCheckbox('🛑 Límite de Daño Total Acumulado (Stop)', settings.tronWallEnableDamageStopLimit, (v) => {
      update('tronWallEnableDamageStopLimit', v);
      slInputRow.style.display = v ? 'flex' : 'none';
    });
    tronDmgContent.appendChild(slCheckCb.container);

    const slInput = makeDmgNumInput('Límite Daño Acumulado:', settings.tronWallDamageStopLimit, (v) => update('tronWallDamageStopLimit', Math.max(1, v)), 1);
    const slInputRow = slInput.wrap;
    slInputRow.style.display = slCheckCb.input.checked ? 'flex' : 'none';
    tronDmgContent.appendChild(slInputRow);

    // Total damage & reset
    const accRow = document.createElement('div');
    accRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#181820;padding:6px 8px;border-radius:5px;border:1px dashed #555;';
    const accText = document.createElement('span');
    accText.textContent = `Daño total hecho: ${settings.tronWallAccumulatedDamage || 0}`;
    accText.style.cssText = 'font-size:10.5px;color:#94a3b8;';
    const accBtn = document.createElement('button');
    accBtn.textContent = 'Reset';
    accBtn.type = 'button';
    accBtn.style.cssText = 'background:#3f3f46;color:white;border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;';
    accBtn.onclick = (e) => {
      e.preventDefault();
      update('tronWallAccumulatedDamage', 0);
      accText.textContent = 'Daño total hecho: 0';
    };
    accRow.append(accText, accBtn);
    tronDmgContent.appendChild(accRow);

    // Knockback
    const kbCheckCb = makeCheckbox('💥 Activar Retroceso (Knockback)', settings.tronWallEnableKnockback, (v) => {
      update('tronWallEnableKnockback', v);
      kbInputRow.style.display = v ? 'flex' : 'none';
    });
    tronDmgContent.appendChild(kbCheckCb.container);

    const kbInput = makeDmgNumInput('Fuerza de Retroceso:', settings.tronWallKnockbackForce, (v) => update('tronWallKnockbackForce', Math.max(0, v)), 0);
    const kbInputRow = kbInput.wrap;
    kbInputRow.style.display = kbCheckCb.input.checked ? 'flex' : 'none';
    tronDmgContent.appendChild(kbInputRow);

    // Refresh Handlers
    const refreshCrash = () => {
      crashMode.disabled = !penaltyCb.input.checked || !durabilityCb.input.checked;
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
        if (input) input.disabled = !penaltyCb.input.checked;
      }
    };

    const refreshDurability = () => {
      refreshCrash();
      explosionCb.input.disabled = !durabilityCb.input.checked;
      for (const key of ['explosionDamage', 'explosionRadius']) {
        const input = inputs.get(key);
        if (input) input.disabled = !durabilityCb.input.checked || !explosionCb.input.checked;
      }
      for (const key of ['maxDurability', 'durability']) {
        const input = inputs.get(key);
        if (input) input.disabled = !durabilityCb.input.checked;
      }
    };

    const refreshSpeedEffect = () => {
      speedEffectSettings.style.display = speedEffectCb.input.checked ? 'flex' : 'none';
      colorInput.disabled = !speedEffectCb.input.checked;
      speedTrailsCb.input.disabled = !speedEffectCb.input.checked;
      const trailsActive = speedEffectCb.input.checked && speedTrailsCb.input.checked;
      speedTrailsDynamicCb.input.disabled = !trailsActive;
      speedTrailsCustomSpeedCb.input.disabled = !trailsActive;
      trailsColorInput.disabled = !trailsActive;
      trailsColorRow.style.display = trailsActive ? 'flex' : 'none';
      speedTrailsDynamicCb.container.style.display = trailsActive ? 'flex' : 'none';
      speedTrailsCustomSpeedCb.container.style.display = trailsActive ? 'flex' : 'none';

      const trailFields = ['speedTrailsCount', 'speedTrailsLength', 'speedTrailsWidth'];
      for (const key of trailFields) {
        const inp = inputs.get(key);
        if (inp) {
          inp.disabled = !trailsActive;
          inp.parentElement!.style.display = trailsActive ? 'flex' : 'none';
        }
      }

      const intervalInp = inputs.get('speedTrailsInterval');
      if (intervalInp) {
        const show = trailsActive && speedTrailsDynamicCb.input.checked;
        intervalInp.disabled = !show;
        intervalInp.parentElement!.style.display = show ? 'flex' : 'none';
      }

      for (const key of ['speedTrailsThreshold', 'speedTrailsMax']) {
        const inp = inputs.get(key);
        if (inp) {
          const show = trailsActive && speedTrailsCustomSpeedCb.input.checked;
          inp.disabled = !show;
          inp.parentElement!.style.display = show ? 'flex' : 'none';
        }
      }

      for (const key of ['speedEffectThreshold', 'speedEffectMax', 'speedEffectLines', 'speedEffectFovBonus', 'speedEffectOpacity']) {
        const inp = inputs.get(key);
        if (inp) {
          inp.disabled = !speedEffectCb.input.checked;
          inp.parentElement!.style.display = speedEffectCb.input.checked ? 'flex' : 'none';
        }
      }
    };

    const refreshTronWall = () => {
      tronWallSettings.style.display = tronWallCb.input.checked ? 'flex' : 'none';
      tronColorInput.disabled = !tronWallCb.input.checked;
      tronCollisionCb.input.disabled = !tronWallCb.input.checked;
      tronAnimSelect.disabled = !tronWallCb.input.checked;
      tronDmgGroup.style.display = tronWallCb.input.checked ? 'flex' : 'none';
      tronDmgContent.style.display = (tronWallCb.input.checked && tronDmgEnableCb.input.checked) ? 'flex' : 'none';
      for (const key of ['tronWallHeight', 'tronWallDuration', 'tronWallSinkDuration', 'tronWallMinSpeed']) {
        const inp = inputs.get(key);
        if (inp) {
          inp.disabled = !tronWallCb.input.checked;
          inp.parentElement!.style.display = tronWallCb.input.checked ? 'flex' : 'none';
        }
      }
    };

    refreshPenalty();
    refreshDurability();
    refreshSpeedEffect();
    refreshTronWall();

    return {
      section2Seats,
      section3,
      section4,
      section5,
      section6,
      section7,
      section8
    };
  }

  /**
   * Standalone render method (used by ObjectInspector or when called directly).
   */
  public render(container: HTMLElement, props: any, update: (key: string, value: number | boolean | string) => void) {
    if (props?.vehicleKind !== 'motorbike' && props?.mapObjectType !== 'motorbike') return;

    container.innerHTML = '';
    const sections = this.buildSections(props, update);
    const editor = new SectionedItemEditor();

    const defs: EditorSectionDef[] = [
      {
        id: 'dimensions',
        number: 2,
        title: 'Dimensiones y geometría',
        subtitle: 'Tamaño y forma física del vehículo.',
        iconSvg: SECTION_ICONS.dimensions,
        content: sections.section2Seats
      },
      {
        id: 'driving',
        number: 3,
        title: 'Conducción y rendimiento',
        subtitle: 'Velocidad, aceleración y maniobrabilidad.',
        iconSvg: SECTION_ICONS.speedometer,
        content: sections.section3
      },
      {
        id: 'seats',
        number: 4,
        title: 'Asientos y controles',
        subtitle: 'Ocupantes, animaciones y comportamiento al montar.',
        iconSvg: SECTION_ICONS.seats,
        content: sections.section4
      },
      {
        id: 'physics',
        number: 5,
        title: 'Física, gravedad y estabilidad',
        subtitle: 'Equilibrio, saltos y comportamiento en el aire.',
        iconSvg: SECTION_ICONS.physics,
        content: sections.section5
      },
      {
        id: 'durability',
        number: 6,
        title: 'Durabilidad y daños',
        subtitle: 'Resistencia del vehículo y consecuencias de los accidentes.',
        iconSvg: SECTION_ICONS.durability,
        content: sections.section6
      },
      {
        id: 'jetpack',
        number: 7,
        title: 'Jetpack y combustible',
        subtitle: 'Propulsión adicional y gestión de energía.',
        iconSvg: SECTION_ICONS.jetpack,
        content: sections.section7
      },
      {
        id: 'effects',
        number: 8,
        title: 'Efectos visuales y velocidad',
        subtitle: 'Efectos cinematográficos y estelas visibles en el mundo.',
        iconSvg: SECTION_ICONS.effects,
        content: sections.section8
      }
    ];

    editor.setSections(defs);
    container.appendChild(editor.getElement());
  }
}

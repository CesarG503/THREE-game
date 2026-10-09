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

    const speedEffectLabel = document.createElement('label');
    speedEffectLabel.style.cssText = penaltyLabel.style.cssText;
    const speedEffect = document.createElement('input');
    speedEffect.type = 'checkbox';
    speedEffect.checked = normalizeMotorbikeSettings(props).speedEffectEnabled;
    speedEffectLabel.append(speedEffect, '⚡ Efecto de velocidad en pantalla (Speed Lines y FOV)');
    container.appendChild(speedEffectLabel);
    const speedEffectSettings = document.createElement('div');
    speedEffectSettings.style.cssText = 'padding-left:12px;border-left:2px solid #38bdf8;margin:8px 0;display:flex;flex-direction:column;gap:6px;';
    container.appendChild(speedEffectSettings);

    const speedEffectHint = document.createElement('p');
    speedEffectHint.style.cssText = hint.style.cssText;
    speedEffectHint.textContent = 'Al alcanzar la velocidad configurada (ej. 150 km/h), la pantalla despliega líneas radiales de alta velocidad con apertura y cierre suaves y aceleración dinámica.';
    speedEffectSettings.appendChild(speedEffectHint);

    const colorRow = document.createElement('label');
    colorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#ccc;font-size:12px;margin:4px 0;';
    colorRow.textContent = 'Color de las líneas en pantalla: ';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = normalizeMotorbikeSettings(props).speedEffectColor || '#d4ecff';
    colorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    colorInput.onchange = () => update('speedEffectColor', colorInput.value);
    colorRow.appendChild(colorInput);
    speedEffectSettings.appendChild(colorRow);

    const speedTrailsLabel = document.createElement('label');
    speedTrailsLabel.style.cssText = penaltyLabel.style.cssText;
    const speedTrails = document.createElement('input');
    speedTrails.type = 'checkbox';
    speedTrails.checked = normalizeMotorbikeSettings(props).speedTrailsEnabled;
    speedTrailsLabel.append(speedTrails, '🌐 Estelas 3D en vehículo y personaje (visibles por otros jugadores)');
    speedEffectSettings.appendChild(speedTrailsLabel);

    const speedTrailsHint = document.createElement('p');
    speedTrailsHint.style.cssText = hint.style.cssText;
    speedTrailsHint.textContent = 'Genera estelas aerodinámicas 3D saliendo de los costados del vehículo, cola y hombros del personaje que se desplazan físicamente en el mundo y son visibles para los demás jugadores.';
    speedEffectSettings.appendChild(speedTrailsHint);

    const trailsColorRow = document.createElement('label');
    trailsColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#ccc;font-size:12px;margin:4px 0;';
    trailsColorRow.textContent = 'Color de las estelas 3D: ';
    const trailsColorInput = document.createElement('input');
    trailsColorInput.type = 'color';
    trailsColorInput.value = normalizeMotorbikeSettings(props).speedTrailsColor || normalizeMotorbikeSettings(props).speedEffectColor || '#d4ecff';
    trailsColorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    trailsColorInput.onchange = () => update('speedTrailsColor', trailsColorInput.value);
    trailsColorRow.appendChild(trailsColorInput);
    speedEffectSettings.appendChild(trailsColorRow);

    const speedTrailsDynamicLabel = document.createElement('label');
    speedTrailsDynamicLabel.style.cssText = penaltyLabel.style.cssText;
    const speedTrailsDynamic = document.createElement('input');
    speedTrailsDynamic.type = 'checkbox';
    speedTrailsDynamic.checked = normalizeMotorbikeSettings(props).speedTrailsDynamic;
    speedTrailsDynamicLabel.append(speedTrailsDynamic, '✨ Ráfagas dinámicas (al desactivar: estelas fijas y continuas)');
    speedEffectSettings.appendChild(speedTrailsDynamicLabel);

    const speedTrailsDynamicHint = document.createElement('p');
    speedTrailsDynamicHint.style.cssText = hint.style.cssText;
    speedTrailsDynamicHint.textContent = 'Al activarse, las estelas brotan y se desvanecen suavemente en distintos puntos aleatorios. Al desactivar la casilla, se convierten en estelas aerodinámicas fijas y constantes sin estar cambiando de lugar.';
    speedEffectSettings.appendChild(speedTrailsDynamicHint);

    const speedTrailsCustomSpeedLabel = document.createElement('label');
    speedTrailsCustomSpeedLabel.style.cssText = penaltyLabel.style.cssText;
    const speedTrailsCustomSpeed = document.createElement('input');
    speedTrailsCustomSpeed.type = 'checkbox';
    speedTrailsCustomSpeed.checked = normalizeMotorbikeSettings(props).speedTrailsCustomSpeed;
    speedTrailsCustomSpeedLabel.append(speedTrailsCustomSpeed, '⏱️ Rango de velocidad independiente para estelas 3D');
    speedEffectSettings.appendChild(speedTrailsCustomSpeedLabel);

    const speedTrailsCustomSpeedHint = document.createElement('p');
    speedTrailsCustomSpeedHint.style.cssText = hint.style.cssText;
    speedTrailsCustomSpeedHint.textContent = 'Al activarse, las estelas 3D se activan y alcanzan su 100% en un rango de velocidad exclusivo, independiente del efecto de pantalla.';
    speedEffectSettings.appendChild(speedTrailsCustomSpeedHint);

    const tronWallLabel = document.createElement('label');
    tronWallLabel.style.cssText = penaltyLabel.style.cssText;
    const tronWall = document.createElement('input');
    tronWall.type = 'checkbox';
    tronWall.checked = normalizeMotorbikeSettings(props).tronWallEnabled;
    tronWallLabel.append(tronWall, '⚡ Muro de luz temporal (estilo Tron)');
    container.appendChild(tronWallLabel);

    const tronWallSettings = document.createElement('div');
    tronWallSettings.style.cssText = 'padding-left:12px;border-left:2px solid #00f0ff;margin:8px 0;display:flex;flex-direction:column;gap:6px;';
    container.appendChild(tronWallSettings);

    const tronWallHint = document.createElement('p');
    tronWallHint.style.cssText = hint.style.cssText;
    tronWallHint.textContent = 'Al conducir, el vehículo levanta un muro vertical de energía luminosa que permanece activo y luego desciende y se desvanece hundiéndose en el suelo de donde brotó.';
    tronWallSettings.appendChild(tronWallHint);

    const tronColorRow = document.createElement('label');
    tronColorRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#ccc;font-size:12px;margin:4px 0;';
    tronColorRow.textContent = 'Color del muro de luz: ';
    const tronColorInput = document.createElement('input');
    tronColorInput.type = 'color';
    tronColorInput.value = normalizeMotorbikeSettings(props).tronWallColor || '#00f0ff';
    tronColorInput.style.cssText = 'background:none;border:none;width:40px;height:24px;cursor:pointer;';
    tronColorInput.onchange = () => update('tronWallColor', tronColorInput.value);
    tronColorRow.appendChild(tronColorInput);
    tronWallSettings.appendChild(tronColorRow);

    const tronCollisionLabel = document.createElement('label');
    tronCollisionLabel.style.cssText = penaltyLabel.style.cssText;
    const tronCollision = document.createElement('input');
    tronCollision.type = 'checkbox';
    tronCollision.checked = normalizeMotorbikeSettings(props).tronWallCollision;
    tronCollisionLabel.append(tronCollision, '🛡️ Colisión física sólida (bloquea vehículos y jugadores)');
    tronWallSettings.appendChild(tronCollisionLabel);

    const tronCollisionHint = document.createElement('p');
    tronCollisionHint.style.cssText = hint.style.cssText;
    tronCollisionHint.textContent = 'Si se activa, el muro actúa como una barrera física sólida en el mundo que bloquea el paso mientras esté erguido.';
    tronWallSettings.appendChild(tronCollisionHint);

    const tronAnimRow = document.createElement('label');
    tronAnimRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#ccc;font-size:12px;margin:6px 0 2px 0;gap:8px;';
    tronAnimRow.textContent = 'Animación de salida: ';
    const tronAnimSelect = document.createElement('select');
    tronAnimSelect.style.cssText = 'background:#1a1a2e;color:#00f0ff;border:1px solid #00f0ff;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;outline:none;';
    const optGrow = document.createElement('option');
    optGrow.value = 'grow';
    optGrow.textContent = '🌊 Elevación progresiva (crece desde el suelo)';
    const optInstant = document.createElement('option');
    optInstant.value = 'instant';
    optInstant.textContent = '⚡ Aparición directa (altura completa sin crecer)';
    tronAnimSelect.append(optGrow, optInstant);
    tronAnimSelect.value = normalizeMotorbikeSettings(props).tronWallAnimMode || 'grow';
    tronAnimSelect.onchange = () => update('tronWallAnimMode', tronAnimSelect.value);
    tronAnimRow.appendChild(tronAnimSelect);
    tronWallSettings.appendChild(tronAnimRow);

    const tronAnimHint = document.createElement('p');
    tronAnimHint.style.cssText = hint.style.cssText;
    tronAnimHint.textContent = 'Permite elegir si el muro surge creciendo progresivamente desde el suelo o si emerge de inmediato a su altura completa con desplazamiento fluido.';
    tronWallSettings.appendChild(tronAnimHint);

    // ==========================================
    // CONTROLADOR DE DAÑO DEL MURO TRON
    // ==========================================
    const tronDmgGroup = document.createElement('div');
    tronDmgGroup.style.cssText = 'border-top:1px solid #ff4444;margin-top:12px;padding-top:10px;display:flex;flex-direction:column;gap:8px;';

    const tronDmgHeader = document.createElement('div');
    tronDmgHeader.textContent = '💥 Controlador de Daño del Muro Tron';
    tronDmgHeader.style.cssText = 'font-weight:bold;font-size:12px;color:#ff5555;margin-bottom:2px;';
    tronDmgGroup.appendChild(tronDmgHeader);

    const tronDmgEnableLabel = document.createElement('label');
    tronDmgEnableLabel.style.cssText = penaltyLabel.style.cssText;
    const tronDmgEnable = document.createElement('input');
    tronDmgEnable.type = 'checkbox';
    tronDmgEnable.checked = normalizeMotorbikeSettings(props).tronWallDamageEnabled;
    tronDmgEnableLabel.append(tronDmgEnable, '⚔️ Habilitar Daño por Colisión');
    tronDmgGroup.appendChild(tronDmgEnableLabel);

    const tronDmgHint = document.createElement('p');
    tronDmgHint.style.cssText = hint.style.cssText;
    tronDmgHint.textContent = 'Aplica daño inmediato o continuo a los jugadores y vehículos que colisionen o toquen el muro de energía mientras esté activo.';
    tronDmgGroup.appendChild(tronDmgHint);

    const tronDmgContent = document.createElement('div');
    tronDmgContent.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-left:12px;border-left:2px solid #ef4444;margin-top:2px;';
    tronDmgGroup.appendChild(tronDmgContent);

    // Target checkboxes
    const tronDmgTargetsRow = document.createElement('div');
    tronDmgTargetsRow.style.cssText = 'display:flex;flex-direction:column;gap:5px;background:#1a1a2e;padding:6px;border-radius:4px;';
    const tronDmgTargetsTitle = document.createElement('span');
    tronDmgTargetsTitle.textContent = 'Objetivos afectados por el muro:';
    tronDmgTargetsTitle.style.cssText = 'font-size:10px;color:#aaa;font-weight:bold;';
    tronDmgTargetsRow.appendChild(tronDmgTargetsTitle);

    const tronDmgPlayersLabel = document.createElement('label');
    tronDmgPlayersLabel.style.cssText = 'display:flex;align-items:center;gap:6px;color:#ccc;font-size:11px;cursor:pointer;';
    const tronDmgPlayers = document.createElement('input');
    tronDmgPlayers.type = 'checkbox';
    tronDmgPlayers.checked = normalizeMotorbikeSettings(props).tronWallDamagePlayers;
    tronDmgPlayers.onchange = () => update('tronWallDamagePlayers', tronDmgPlayers.checked);
    tronDmgPlayersLabel.append(tronDmgPlayers, '👤 Dañar Jugadores (Personajes)');
    tronDmgTargetsRow.appendChild(tronDmgPlayersLabel);

    const tronDmgVehiclesLabel = document.createElement('label');
    tronDmgVehiclesLabel.style.cssText = 'display:flex;align-items:center;gap:6px;color:#ccc;font-size:11px;cursor:pointer;';
    const tronDmgVehicles = document.createElement('input');
    tronDmgVehicles.type = 'checkbox';
    tronDmgVehicles.checked = normalizeMotorbikeSettings(props).tronWallDamageVehicles;
    tronDmgVehicles.onchange = () => update('tronWallDamageVehicles', tronDmgVehicles.checked);
    tronDmgVehiclesLabel.append(tronDmgVehicles, '🏍️ Dañar Vehículos (Durabilidad)');
    tronDmgTargetsRow.appendChild(tronDmgVehiclesLabel);
    tronDmgContent.appendChild(tronDmgTargetsRow);

    // Base damage
    const tronDmgBaseRow = document.createElement('div');
    tronDmgBaseRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const tronDmgBaseLabel = document.createElement('label');
    tronDmgBaseLabel.textContent = 'Daño Base';
    tronDmgBaseLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgBaseInput = document.createElement('input');
    tronDmgBaseInput.type = 'number';
    tronDmgBaseInput.min = '0';
    tronDmgBaseInput.value = String(normalizeMotorbikeSettings(props).tronWallDamage);
    tronDmgBaseInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgBaseInput.onchange = () => update('tronWallDamage', Math.max(0, parseFloat(tronDmgBaseInput.value) || 0));
    tronDmgBaseRow.append(tronDmgBaseLabel, tronDmgBaseInput);
    tronDmgContent.appendChild(tronDmgBaseRow);

    // Percent damage
    const tronDmgPctRow = document.createElement('div');
    tronDmgPctRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const tronDmgPctLabel = document.createElement('label');
    tronDmgPctLabel.textContent = 'Daño Porcentual (%)';
    tronDmgPctLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgPctInput = document.createElement('input');
    tronDmgPctInput.type = 'number';
    tronDmgPctInput.min = '0';
    tronDmgPctInput.max = '100';
    tronDmgPctInput.value = String(normalizeMotorbikeSettings(props).tronWallPercentDamage);
    tronDmgPctInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgPctInput.onchange = () => update('tronWallPercentDamage', Math.max(0, Math.min(100, parseFloat(tronDmgPctInput.value) || 0)));
    tronDmgPctRow.append(tronDmgPctLabel, tronDmgPctInput);
    tronDmgContent.appendChild(tronDmgPctRow);

    // Instant kill
    const tronDmgIkRow = document.createElement('label');
    tronDmgIkRow.style.cssText = 'display:flex;align-items:center;gap:6px;color:#ccc;font-size:11px;cursor:pointer;margin-top:2px;';
    const tronDmgIk = document.createElement('input');
    tronDmgIk.type = 'checkbox';
    tronDmgIk.checked = normalizeMotorbikeSettings(props).tronWallInstantKill;
    tronDmgIk.onchange = () => update('tronWallInstantKill', tronDmgIk.checked);
    tronDmgIkRow.append(tronDmgIk, '💀 Muerte Instantánea');
    tronDmgContent.appendChild(tronDmgIkRow);

    // Max damage per hit
    const tronDmgMaxRow = document.createElement('div');
    tronDmgMaxRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const tronDmgMaxLabel = document.createElement('label');
    tronDmgMaxLabel.textContent = 'Límite Máximo Daño (por golpe)';
    tronDmgMaxLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgMaxInput = document.createElement('input');
    tronDmgMaxInput.type = 'number';
    tronDmgMaxInput.min = '1';
    tronDmgMaxInput.value = String(normalizeMotorbikeSettings(props).tronWallMaxDamage);
    tronDmgMaxInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgMaxInput.onchange = () => update('tronWallMaxDamage', Math.max(1, parseFloat(tronDmgMaxInput.value) || 100));
    tronDmgMaxRow.append(tronDmgMaxLabel, tronDmgMaxInput);
    tronDmgContent.appendChild(tronDmgMaxRow);

    // Damage cooldown
    const tronDmgCdRow = document.createElement('div');
    tronDmgCdRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const tronDmgCdLabel = document.createElement('label');
    tronDmgCdLabel.textContent = 'Intervalo Cooldown (s)';
    tronDmgCdLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgCdInput = document.createElement('input');
    tronDmgCdInput.type = 'number';
    tronDmgCdInput.step = '0.1';
    tronDmgCdInput.min = '0.05';
    tronDmgCdInput.value = String(normalizeMotorbikeSettings(props).tronWallDamageCooldown);
    tronDmgCdInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgCdInput.onchange = () => update('tronWallDamageCooldown', Math.max(0.05, parseFloat(tronDmgCdInput.value) || 0.8));
    tronDmgCdRow.append(tronDmgCdLabel, tronDmgCdInput);
    tronDmgContent.appendChild(tronDmgCdRow);

    // Stop limit
    const tronDmgSlCheckRow = document.createElement('label');
    tronDmgSlCheckRow.style.cssText = 'display:flex;align-items:center;gap:6px;color:#ccc;font-size:11px;cursor:pointer;margin-top:2px;';
    const tronDmgSlCheck = document.createElement('input');
    tronDmgSlCheck.type = 'checkbox';
    tronDmgSlCheck.checked = normalizeMotorbikeSettings(props).tronWallEnableDamageStopLimit;
    tronDmgSlCheckRow.append(tronDmgSlCheck, '🛑 Habilitar Límite de Daño Total (Stop)');
    tronDmgContent.appendChild(tronDmgSlCheckRow);

    const tronDmgSlInputRow = document.createElement('div');
    tronDmgSlInputRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;padding-left:14px;';
    const tronDmgSlLabel = document.createElement('label');
    tronDmgSlLabel.textContent = 'Límite Daño Acumulado';
    tronDmgSlLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgSlInput = document.createElement('input');
    tronDmgSlInput.type = 'number';
    tronDmgSlInput.min = '1';
    tronDmgSlInput.value = String(normalizeMotorbikeSettings(props).tronWallDamageStopLimit);
    tronDmgSlInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgSlInput.onchange = () => update('tronWallDamageStopLimit', Math.max(1, parseFloat(tronDmgSlInput.value) || 100));
    tronDmgSlInputRow.append(tronDmgSlLabel, tronDmgSlInput);
    tronDmgContent.appendChild(tronDmgSlInputRow);

    tronDmgSlCheck.onchange = () => {
      update('tronWallEnableDamageStopLimit', tronDmgSlCheck.checked);
      tronDmgSlInputRow.style.display = tronDmgSlCheck.checked ? 'flex' : 'none';
    };
    tronDmgSlInputRow.style.display = tronDmgSlCheck.checked ? 'flex' : 'none';

    // Accumulated damage display and reset
    const tronDmgAccRow = document.createElement('div');
    tronDmgAccRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#1a1a1a;padding:6px;border-radius:4px;margin-top:4px;border:1px dashed #555;';
    const tronDmgAccText = document.createElement('span');
    tronDmgAccText.textContent = `Daño total hecho: ${normalizeMotorbikeSettings(props).tronWallAccumulatedDamage || 0}`;
    tronDmgAccText.style.cssText = 'font-size:10px;color:#aaa;';
    const tronDmgAccBtn = document.createElement('button');
    tronDmgAccBtn.textContent = 'Reset';
    tronDmgAccBtn.type = 'button';
    tronDmgAccBtn.style.cssText = 'background:#3f3f46;color:white;border:none;border-radius:3px;padding:2px 8px;font-size:10px;cursor:pointer;';
    tronDmgAccBtn.onclick = (e) => {
      e.preventDefault();
      update('tronWallAccumulatedDamage', 0);
      tronDmgAccText.textContent = 'Daño total hecho: 0';
    };
    tronDmgAccRow.append(tronDmgAccText, tronDmgAccBtn);
    tronDmgContent.appendChild(tronDmgAccRow);

    // Knockback
    const tronDmgKbCheckRow = document.createElement('label');
    tronDmgKbCheckRow.style.cssText = 'display:flex;align-items:center;gap:6px;color:#ccc;font-size:11px;cursor:pointer;margin-top:4px;';
    const tronDmgKbCheck = document.createElement('input');
    tronDmgKbCheck.type = 'checkbox';
    tronDmgKbCheck.checked = normalizeMotorbikeSettings(props).tronWallEnableKnockback;
    tronDmgKbCheckRow.append(tronDmgKbCheck, '💥 Activar Retroceso (Knockback)');
    tronDmgContent.appendChild(tronDmgKbCheckRow);

    const tronDmgKbInputRow = document.createElement('div');
    tronDmgKbInputRow.style.cssText = 'display:flex;flex-direction:column;gap:3px;padding-left:14px;';
    const tronDmgKbLabel = document.createElement('label');
    tronDmgKbLabel.textContent = 'Fuerza de Retroceso';
    tronDmgKbLabel.style.cssText = 'color:#aaa;font-size:10px;';
    const tronDmgKbInput = document.createElement('input');
    tronDmgKbInput.type = 'number';
    tronDmgKbInput.min = '0';
    tronDmgKbInput.value = String(normalizeMotorbikeSettings(props).tronWallKnockbackForce);
    tronDmgKbInput.style.cssText = 'background:#222;border:1px solid #555;color:white;padding:4px;font-size:11px;border-radius:4px;';
    tronDmgKbInput.onchange = () => update('tronWallKnockbackForce', Math.max(0, parseFloat(tronDmgKbInput.value) || 15));
    tronDmgKbInputRow.append(tronDmgKbLabel, tronDmgKbInput);
    tronDmgContent.appendChild(tronDmgKbInputRow);

    tronDmgKbCheck.onchange = () => {
      update('tronWallEnableKnockback', tronDmgKbCheck.checked);
      tronDmgKbInputRow.style.display = tronDmgKbCheck.checked ? 'flex' : 'none';
    };
    tronDmgKbInputRow.style.display = tronDmgKbCheck.checked ? 'flex' : 'none';

    tronDmgEnable.onchange = () => {
      update('tronWallDamageEnabled', tronDmgEnable.checked);
      tronDmgContent.style.display = tronDmgEnable.checked ? 'flex' : 'none';
    };
    tronDmgContent.style.display = tronDmgEnable.checked ? 'flex' : 'none';

    tronWallSettings.appendChild(tronDmgGroup);

    const tronWallKeys = ['tronWallHeight', 'tronWallDuration', 'tronWallSinkDuration', 'tronWallMinSpeed'];

    const speedEffectKeys = [
      'speedEffectThreshold', 'speedEffectMax', 'speedEffectLines', 'speedEffectFovBonus', 'speedEffectOpacity',
      'speedTrailsCount', 'speedTrailsLength', 'speedTrailsWidth', 'speedTrailsInterval',
      'speedTrailsThreshold', 'speedTrailsMax'
    ];

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
    const refreshSpeedEffect = () => {
      speedEffectSettings.style.display = speedEffect.checked ? 'flex' : 'none';
      colorInput.disabled = !speedEffect.checked;
      speedTrails.disabled = !speedEffect.checked;
      const trailsActive = speedEffect.checked && speedTrails.checked;
      speedTrailsDynamic.disabled = !trailsActive;
      speedTrailsCustomSpeed.disabled = !trailsActive;
      trailsColorInput.disabled = !trailsActive;
      trailsColorRow.style.display = trailsActive ? 'flex' : 'none';
      speedTrailsDynamicLabel.style.display = trailsActive ? 'flex' : 'none';
      speedTrailsDynamicHint.style.display = trailsActive ? 'block' : 'none';
      speedTrailsCustomSpeedLabel.style.display = trailsActive ? 'flex' : 'none';
      speedTrailsCustomSpeedHint.style.display = trailsActive ? 'block' : 'none';

      for (const key of speedEffectKeys) {
        const input = inputs.get(key);
        if (input) {
          if (key === 'speedTrailsInterval') {
            const visible = trailsActive && speedTrailsDynamic.checked;
            input.disabled = !visible;
            input.parentElement!.style.display = visible ? 'flex' : 'none';
          } else if (['speedTrailsThreshold', 'speedTrailsMax'].includes(key)) {
            const visible = trailsActive && speedTrailsCustomSpeed.checked;
            input.disabled = !visible;
            input.parentElement!.style.display = visible ? 'flex' : 'none';
          } else if (['speedTrailsCount', 'speedTrailsLength', 'speedTrailsWidth'].includes(key)) {
            input.disabled = !trailsActive;
            input.parentElement!.style.display = trailsActive ? 'flex' : 'none';
          } else {
            input.disabled = !speedEffect.checked;
            input.parentElement!.style.display = speedEffect.checked ? 'flex' : 'none';
          }
        }
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
    speedEffect.onchange = () => {
      update('speedEffectEnabled', speedEffect.checked);
      refreshSpeedEffect();
    };
    speedTrails.onchange = () => {
      update('speedTrailsEnabled', speedTrails.checked);
      refreshSpeedEffect();
    };
    speedTrailsDynamic.onchange = () => {
      update('speedTrailsDynamic', speedTrailsDynamic.checked);
      refreshSpeedEffect();
    };
    speedTrailsCustomSpeed.onchange = () => {
      update('speedTrailsCustomSpeed', speedTrailsCustomSpeed.checked);
      refreshSpeedEffect();
    };
    const refreshTronWall = () => {
      tronWallSettings.style.display = tronWall.checked ? 'flex' : 'none';
      tronColorInput.disabled = !tronWall.checked;
      tronCollision.disabled = !tronWall.checked;
      tronAnimSelect.disabled = !tronWall.checked;
      tronDmgGroup.style.display = tronWall.checked ? 'flex' : 'none';
      tronDmgContent.style.display = (tronWall.checked && tronDmgEnable.checked) ? 'flex' : 'none';
      for (const key of tronWallKeys) {
        const input = inputs.get(key);
        if (input) {
          input.disabled = !tronWall.checked;
          input.parentElement!.style.display = tronWall.checked ? 'flex' : 'none';
        }
      }
    };
    tronWall.onchange = () => {
      update('tronWallEnabled', tronWall.checked);
      refreshTronWall();
    };
    tronCollision.onchange = () => {
      update('tronWallCollision', tronCollision.checked);
      refreshTronWall();
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
        : ['maxDurability', 'durability'].includes(field.key) ? durabilitySettings
        : tronWallKeys.includes(field.key) ? tronWallSettings
        : speedEffectKeys.includes(field.key) ? speedEffectSettings
        : container;
      parent.appendChild(label);
    }
    refreshPenalty();
    refreshDurability();
    refreshSpeedEffect();
    refreshTronWall();
  }
}

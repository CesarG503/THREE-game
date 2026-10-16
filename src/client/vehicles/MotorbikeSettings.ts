import { normalizeGravityOrientation, type GravityOrientation } from '../utils/GravityOrientation';
export const MOTORBIKE_SIZE = { x: 0.85, y: 1.25, z: 2.4 };

export const MOTORBIKE_FIELDS = [
  { key: 'explosionDamage', label: 'Daño de la explosión', value: 50, min: 0, max: 100000, step: 1 },
  { key: 'explosionRadius', label: 'Radio de la explosión (m)', value: 5, min: 0, max: 100, step: 0.5 },
  { key: 'maxDurability', label: 'Durabilidad máxima', value: 100, min: 1, max: 100000, step: 1 },
  { key: 'durability', label: 'Durabilidad disponible', value: 100, min: 0, max: 100000, step: 1 },
  { key: 'crashDamagePercent', label: 'Daño por caída (% de durabilidad máxima)', value: 10, min: 0, max: 100, step: 1 },
  { key: 'crashDamageFixed', label: 'Daño por caída (cantidad fija)', value: 10, min: 0, max: 100000, step: 1 },
  { key: 'maxSpeed', label: 'Velocidad máxima (m/s)', value: 22, min: 1, max: 120, step: 1 },
  { key: 'reverseSpeed', label: 'Velocidad en reversa (m/s)', value: 5, min: 0, max: 15, step: 0.5 },
  { key: 'acceleration', label: 'Aceleración (m/s²)', value: 9, min: 0.1, max: 40, step: 0.5 },
  { key: 'braking', label: 'Frenado (m/s²)', value: 18, min: 1, max: 60, step: 1 },
  { key: 'turnSpeed', label: 'Velocidad de giro (°/s)', value: 95, min: 10, max: 180, step: 5 },
  { key: 'driftTurnMultiplier', label: 'Multiplicador de giro con drift', value: 1.8, min: 1, max: 4, step: 0.1 },
  { key: 'driftBrakeMultiplier', label: 'Intensidad de frenado con drift', value: 1.15, min: 0.1, max: 4, step: 0.05 },
  { key: 'driftMarkDuration', label: 'Duración marca de derrape (s)', value: 4, min: 0.5, max: 30, step: 0.5 },
  { key: 'stationaryTurnSpeed', label: 'Giro en sitio detenido (°/s)', value: 130, min: 0, max: 360, step: 5 },
  { key: 'jumpForce', label: 'Fuerza de salto de la moto (m/s)', value: 8, min: 0, max: 30, step: 0.5 },
  { key: 'jumpCooldown', label: 'Tiempo entre saltos (s)', value: 0.35, min: 0, max: 5, step: 0.05 },
  { key: 'jetpackAccelerationBonus', label: 'Aceleración extra con jetpack (m/s²)', value: 12, min: 0, max: 80, step: 0.5 },
  { key: 'jetpackMaxSpeedBonus', label: 'Velocidad máxima extra con jetpack (m/s)', value: 10, min: 0, max: 80, step: 1 },
  { key: 'maxConsumableUse', label: 'Capacidad de combustible (s)', value: 60, min: 1, max: 3600, step: 5 },
  { key: 'consumableUse', label: 'Combustible disponible (s)', value: 60, min: 0, max: 3600, step: 5 },
  { key: 'fuelConsumption', label: 'Consumo por segundo', value: 1, min: 0, max: 10, step: 0.1 },
  { key: 'seatHeight', label: 'Altura del asiento desde el suelo (m)', value: 1.02, min: 0.1, max: 5, step: 0.05 },
  { key: 'seatOffsetZ', label: 'Posición longitudinal del asiento (m)', value: 0.22, min: -3, max: 3, step: 0.05 },
  { key: 'passengerSeatHeight', label: 'Altura del asiento trasero desde el suelo (m)', value: 1.08, min: 0.1, max: 5, step: 0.05 },
  { key: 'passengerSeatOffsetZ', label: 'Posición longitudinal del asiento trasero (m)', value: 0.72, min: -3, max: 3, step: 0.05 },
  { key: 'riderLean', label: 'Inclinación del conductor (°)', value: 12, min: 0, max: 40, step: 1 },
  { key: 'maxLean', label: 'Inclinación máxima al girar (°)', value: 18, min: 0, max: 35, step: 1 },
  { key: 'holdTime', label: 'Tiempo manteniendo F para subir (s)', value: 0, min: 0, max: 10, step: 0.1 },
  { key: 'dismountFallSpeed', label: 'Velocidad mínima de caída al bajar (km/h)', value: 30, min: 1, max: 216, step: 1 },
  { key: 'dismountDamagePercent', label: 'Daño al jugador por caída (% de vida máxima)', value: 10, min: 0, max: 100, step: 1 },
  { key: 'speedEffectThreshold', label: 'Velocidad efecto en pantalla (km/h)', value: 150, min: 10, max: 400, step: 5 },
  { key: 'speedEffectMax', label: 'Velocidad efecto al 100% (km/h)', value: 220, min: 20, max: 500, step: 5 },
  { key: 'speedEffectLines', label: 'Cantidad de líneas de velocidad en pantalla', value: 140, min: 20, max: 300, step: 10 },
  { key: 'speedEffectFovBonus', label: 'Expansión dinámica de FOV (°)', value: 8, min: 0, max: 30, step: 1 },
  { key: 'speedEffectOpacity', label: 'Opacidad máxima del efecto en pantalla (%)', value: 85, min: 10, max: 100, step: 5 },
  { key: 'speedTrailsCount', label: 'Cantidad de estelas 3D (vehículo y personaje)', value: 6, min: 2, max: 12, step: 1 },
  { key: 'speedTrailsLength', label: 'Longitud de estelas 3D (m)', value: 3.5, min: 0.5, max: 10, step: 0.5 },
  { key: 'speedTrailsWidth', label: 'Grosor de estelas 3D (cm)', value: 4, min: 1, max: 20, step: 1 },
  { key: 'speedTrailsInterval', label: 'Duración de ráfagas dinámicas (s)', value: 0.14, min: 0.04, max: 0.6, step: 0.02 },
  { key: 'speedTrailsThreshold', label: 'Velocidad estelas 3D (km/h)', value: 150, min: 10, max: 400, step: 5 },
  { key: 'speedTrailsMax', label: 'Velocidad estelas 3D al 100% (km/h)', value: 220, min: 20, max: 500, step: 5 },
  { key: 'tronWallHeight', label: 'Altura del muro Tron (m)', value: 1.8, min: 0.3, max: 6.0, step: 0.1 },
  { key: 'tronWallDuration', label: 'Duración del muro Tron (s)', value: 5.0, min: 1.0, max: 30.0, step: 0.5 },
  { key: 'tronWallSinkDuration', label: 'Tiempo de descenso al suelo (s)', value: 1.2, min: 0.2, max: 5.0, step: 0.1 },
  { key: 'tronWallMinSpeed', label: 'Velocidad mínima para muro Tron (km/h)', value: 15, min: 1, max: 120, step: 1 },
  { key: 'airTimePointsPerSecond', label: 'Puntos por segundo en el aire', value: 50, min: 0, max: 2000, step: 10 },
  { key: 'minAirTimeToScore', label: 'Tiempo mínimo en aire para puntuar (s)', value: 0.3, min: 0.05, max: 3.0, step: 0.05 },
  { key: 'frontflipPoints', label: 'Puntos por Frontflip (giro adelante)', value: 250, min: 0, max: 10000, step: 25 },
  { key: 'backflipPoints', label: 'Puntos por Backflip (giro atrás)', value: 250, min: 0, max: 10000, step: 25 },
  { key: 'barrelRollPoints', label: 'Puntos por Barrel Roll (giro lateral)', value: 200, min: 0, max: 10000, step: 25 },
  { key: 'spin360Points', label: 'Puntos por Giro 360° (trompo)', value: 150, min: 0, max: 10000, step: 25 },
  { key: 'comboMultiplierStep', label: 'Incremento de multiplicador por truco (+x)', value: 0.5, min: 0.1, max: 5.0, step: 0.1 },
  { key: 'perfectLandingBonus', label: 'Bonificación por aterrizaje perfecto', value: 150, min: 0, max: 5000, step: 25 },
] as const;

/** Ángulo máximo de giro relativo del torso y cámara del pasajero (85°). */
export const MAX_PASSENGER_YAW = (85 * Math.PI) / 180;

export type MotorbikeSettings = Record<(typeof MOTORBIKE_FIELDS)[number]['key'], number> & {
  vehicleKind: 'motorbike';
  autoStabilize: boolean;
  landingAssistEnabled: boolean;
  landingAssistMode: 'any-airborne' | 'inverted-detach';
  dismountPenaltyEnabled: boolean;
  durabilityEnabled: boolean;
  crashDamageMode: 'percent' | 'fixed';
  explosionDamageEnabled: boolean;
  gravityOrientation: GravityOrientation | 'inherit';
  speedEffectEnabled: boolean;
  speedEffectColor: string;
  speedTrailsEnabled: boolean;
  speedTrailsDynamic: boolean;
  speedTrailsCustomSpeed: boolean;
  speedTrailsColor: string;
  tronWallEnabled: boolean;
  tronWallColor: string;
  tronWallCollision: boolean;
  tronWallAnimMode: 'grow' | 'instant';
  tronWallDamageEnabled: boolean;
  tronWallDamage: number;
  tronWallPercentDamage: number;
  tronWallInstantKill: boolean;
  tronWallMaxDamage: number;
  tronWallDamageCooldown: number;
  tronWallEnableDamageStopLimit: boolean;
  tronWallDamageStopLimit: number;
  tronWallAccumulatedDamage: number;
  tronWallEnableKnockback: boolean;
  tronWallKnockbackForce: number;
  tronWallDamagePlayers: boolean;
  tronWallDamageVehicles: boolean;
  twoSeatsEnabled: boolean;
  scoreSystemEnabled: boolean;
  showStuntHUD: boolean;
  comboMultiplierEnabled: boolean;
  crashResetsScore: boolean;
};

export function normalizeMotorbikeSettings(props: any = {}): MotorbikeSettings {
  props = props ?? {};
  const result: any = { ...props, vehicleKind: 'motorbike' };
  result.twoSeatsEnabled = props.twoSeatsEnabled !== false;
  result.gravityOrientation = props.gravityOrientation === undefined || props.gravityOrientation === 'inherit' ? 'inherit' : normalizeGravityOrientation(props.gravityOrientation);
  result.autoStabilize = props.autoStabilize !== false;
  result.landingAssistEnabled = props.landingAssistEnabled !== false;
  result.landingAssistMode = props.landingAssistMode === 'inverted-detach' ? 'inverted-detach' : 'any-airborne';
  result.explosionDamageEnabled = props.explosionDamageEnabled === true;
  result.durabilityEnabled = props.durabilityEnabled === true;
  result.dismountPenaltyEnabled = props.dismountPenaltyEnabled === true;
  result.crashDamageMode = props.crashDamageMode === 'fixed' ? 'fixed' : 'percent';
  result.speedEffectEnabled = props.speedEffectEnabled !== false;
  result.speedEffectColor = typeof props.speedEffectColor === 'string' && props.speedEffectColor ? props.speedEffectColor : '#d4ecff';
  result.speedTrailsEnabled = props.speedTrailsEnabled !== false;
  result.speedTrailsDynamic = props.speedTrailsDynamic !== false;
  result.speedTrailsCustomSpeed = props.speedTrailsCustomSpeed === true;
  result.speedTrailsColor = typeof props.speedTrailsColor === 'string' && props.speedTrailsColor ? props.speedTrailsColor : (result.speedEffectColor || '#d4ecff');
  result.tronWallEnabled = props.tronWallEnabled === true;
  result.tronWallColor = typeof props.tronWallColor === 'string' && props.tronWallColor ? props.tronWallColor : '#00f0ff';
  result.tronWallCollision = props.tronWallCollision === true;
  result.tronWallAnimMode = props.tronWallAnimMode === 'instant' ? 'instant' : 'grow';
  result.tronWallDamageEnabled = props.tronWallDamageEnabled === true;
  result.tronWallDamage = Number.isFinite(Number(props.tronWallDamage)) ? Math.max(0, Number(props.tronWallDamage)) : 20;
  result.tronWallPercentDamage = Number.isFinite(Number(props.tronWallPercentDamage)) ? Math.max(0, Math.min(100, Number(props.tronWallPercentDamage))) : 0;
  result.tronWallInstantKill = props.tronWallInstantKill === true;
  result.tronWallMaxDamage = Number.isFinite(Number(props.tronWallMaxDamage)) ? Math.max(1, Number(props.tronWallMaxDamage)) : 100;
  result.tronWallDamageCooldown = Number.isFinite(Number(props.tronWallDamageCooldown)) ? Math.max(0.05, Number(props.tronWallDamageCooldown)) : 0.8;
  result.tronWallEnableDamageStopLimit = props.tronWallEnableDamageStopLimit === true;
  result.tronWallDamageStopLimit = Number.isFinite(Number(props.tronWallDamageStopLimit)) ? Math.max(1, Number(props.tronWallDamageStopLimit)) : 100;
  result.tronWallAccumulatedDamage = Number.isFinite(Number(props.tronWallAccumulatedDamage)) ? Math.max(0, Number(props.tronWallAccumulatedDamage)) : 0;
  result.tronWallEnableKnockback = props.tronWallEnableKnockback === true;
  result.tronWallKnockbackForce = Number.isFinite(Number(props.tronWallKnockbackForce)) ? Math.max(0, Number(props.tronWallKnockbackForce)) : 15;
  result.tronWallDamagePlayers = props.tronWallDamagePlayers !== false;
  result.tronWallDamageVehicles = props.tronWallDamageVehicles !== false;
  result.scoreSystemEnabled = props.scoreSystemEnabled !== false;
  result.showStuntHUD = props.showStuntHUD !== false;
  result.comboMultiplierEnabled = props.comboMultiplierEnabled !== false;
  result.crashResetsScore = props.crashResetsScore !== false;
  for (const field of MOTORBIKE_FIELDS) {
    const value = Number(props[field.key] ?? field.value);
    result[field.key] = Number.isFinite(value) ? Math.min(field.max, Math.max(field.min, value)) : field.value;
  }
  result.durability = props.durability === undefined ? result.maxDurability : Math.min(result.durability, result.maxDurability);
  result.consumableUse = Math.min(result.consumableUse, result.maxConsumableUse);
  result.reverseSpeed = Math.min(result.reverseSpeed, result.maxSpeed);
  return result;
}

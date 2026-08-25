import { normalizeGravityOrientation, type GravityOrientation } from '../utils/GravityOrientation';
export const MOTORBIKE_SIZE = { x: 0.85, y: 1.25, z: 2.4 };

export const MOTORBIKE_FIELDS = [
  { key: 'explosionDamage', label: 'Daño de la explosión', value: 50, min: 0, max: 100000, step: 1 },
  { key: 'explosionRadius', label: 'Radio de la explosión (m)', value: 5, min: 0, max: 100, step: 0.5 },
  { key: 'maxDurability', label: 'Durabilidad máxima', value: 100, min: 1, max: 100000, step: 1 },
  { key: 'durability', label: 'Durabilidad disponible', value: 100, min: 0, max: 100000, step: 1 },
  { key: 'maxSpeed', label: 'Velocidad máxima (m/s)', value: 22, min: 1, max: 60, step: 1 },
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
  { key: 'dismountDamagePercent', label: 'Daño al bajar (% de vida máxima)', value: 10, min: 0, max: 100, step: 1 },
] as const;

/** Ángulo máximo de giro relativo del torso y cámara del pasajero (85°). */
export const MAX_PASSENGER_YAW = (85 * Math.PI) / 180;

export type MotorbikeSettings = Record<(typeof MOTORBIKE_FIELDS)[number]['key'], number> & { vehicleKind: 'motorbike'; dismountPenaltyEnabled: boolean; durabilityEnabled: boolean; explosionDamageEnabled: boolean; gravityOrientation: GravityOrientation | 'inherit' };

export function normalizeMotorbikeSettings(props: any = {}): MotorbikeSettings {
  props = props ?? {};
  const result: any = { ...props, vehicleKind: 'motorbike' };
  result.gravityOrientation = props.gravityOrientation === undefined || props.gravityOrientation === 'inherit' ? 'inherit' : normalizeGravityOrientation(props.gravityOrientation);
  result.explosionDamageEnabled = props.explosionDamageEnabled === true;
  result.durabilityEnabled = props.durabilityEnabled === true;
  result.dismountPenaltyEnabled = props.dismountPenaltyEnabled === true;
  for (const field of MOTORBIKE_FIELDS) {
    const value = Number(props[field.key] ?? field.value);
    result[field.key] = Number.isFinite(value) ? Math.min(field.max, Math.max(field.min, value)) : field.value;
  }
  result.durability = props.durability === undefined ? result.maxDurability : Math.min(result.durability, result.maxDurability);
  result.consumableUse = Math.min(result.consumableUse, result.maxConsumableUse);
  result.reverseSpeed = Math.min(result.reverseSpeed, result.maxSpeed);
  return result;
}

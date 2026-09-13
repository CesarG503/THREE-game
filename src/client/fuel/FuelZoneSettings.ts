export interface FuelZoneSettings {
  fuelZone: true;
  name: string;
  fuelEnabled: boolean;
  fuelRate: number;
  fuelLimited: boolean;
  fuelCapacity: number;
  fuelRemaining: number;
  refuelVehicles: boolean;
  refuelJetpacks: boolean;
  showFuelIndicator: boolean;
  showFuelEffects: boolean;
}
const finite = (value: unknown, fallback: number, max = 1e7) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;

export function normalizeFuelZone(props: any = {}): FuelZoneSettings {
  props ??= {};
  const capacity = finite(props.fuelCapacity, 300);
  return {
    fuelZone: true, name: typeof props.name === 'string' ? props.name : 'Zona de recarga de gasolina',
    fuelEnabled: props.fuelEnabled !== false, fuelRate: finite(props.fuelRate, 10, 10000),
    fuelLimited: props.fuelLimited !== false, fuelCapacity: capacity,
    fuelRemaining: Math.min(capacity, finite(props.fuelRemaining, capacity)),
    refuelVehicles: props.refuelVehicles !== false, refuelJetpacks: props.refuelJetpacks !== false,
    showFuelIndicator: props.showFuelIndicator !== false, showFuelEffects: props.showFuelEffects !== false,
  };
}

/** Fair sharing of a station's total flow, redistributing unused shares of full tanks. */
export function distributeFuel(deficits: number[], budget: number): number[] {
  const grants = deficits.map(() => 0);
  let active = deficits.map((n, i) => Number.isFinite(n) && n > 0 ? i : -1).filter(i => i >= 0);
  let remaining = Number.isFinite(budget) ? Math.max(0, budget) : 0;
  while (active.length && remaining > 1e-9) {
    const share = remaining / active.length;
    const next: number[] = [];
    for (const i of active) {
      const amount = Math.min(share, deficits[i] - grants[i]);
      grants[i] += amount; remaining -= amount;
      if (deficits[i] - grants[i] > 1e-9) next.push(i);
    }
    active = next;
  }
  return grants;
}

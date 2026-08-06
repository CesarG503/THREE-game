/** Shared time-based fuel consumption, in seconds at the default rate. */
export function consumeFuel(tank: { consumableUse: number }, dt: number, rate = 1): void {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(rate) || rate < 0) return;
  tank.consumableUse = Math.max(0, (Number.isFinite(tank.consumableUse) ? tank.consumableUse : 0) - dt * rate);
}

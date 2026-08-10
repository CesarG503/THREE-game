export type VehicleSeat = 'driver' | 'passenger';

/** Older clients only published a driver. Resolve racing claims identically on every client. */
export function resolveVehicleSeats(claims: Array<{ id: string; seat: VehicleSeat }>): Map<string, VehicleSeat> {
  const result = new Map<string, VehicleSeat>();
  const ordered = [...claims].sort((a, b) => a.id.localeCompare(b.id));
  for (const seat of ['driver', 'passenger'] as const) {
    const winner = ordered.find(claim => claim.seat === seat);
    if (winner) result.set(winner.id, seat);
  }
  for (const claim of ordered) {
    if (result.has(claim.id)) continue;
    const free = (['driver', 'passenger'] as const).find(seat => ![...result.values()].includes(seat));
    if (free) result.set(claim.id, free);
  }
  return result;
}

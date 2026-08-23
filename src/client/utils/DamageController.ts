/** Shared health/durability calculation for objects with a damage controller. */
export function getControllerDamage(props: any, maxHealth: number): number {
  if (props.instantKill) return maxHealth;
  const damage = Math.min(Number(props.damage ?? 10) + Number(props.percentDamage ?? 0) * maxHealth / 100, Number(props.maxDamage ?? 100));
  return Number.isFinite(damage) ? Math.max(0, Math.round(damage)) : 0;
}

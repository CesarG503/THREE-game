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
  showFuelStatus: boolean;
  showFuelReserve: boolean;
  showFuelRate: boolean;
  showFuelBar: boolean;
  fuelActivation: 'automatic' | 'interact';
  fuelHoldSeconds: number;
  fuelBorderVisible: boolean;
  fuelBorderColor: string;
  fuelBorderUseZoneColor: boolean;
  fuelBorderOpacity: number;
  fuelBorderThickness: number;

  // Individual object controls: Reserve Bar
  fuelBarOffsetX: number;
  fuelBarOffsetY: number;
  fuelBarOffsetZ: number;
  fuelBarWidth: number;
  fuelBarHeight: number;
  fuelBarDepth: number;
  fuelBarRotationX: number;
  fuelBarRotationY: number;
  fuelBarRotationZ: number;

  // Reserve Bar Styling & Configurations
  fuelBarDirection: 'horizontal' | 'horizontal-rl' | 'vertical' | 'vertical-tb';
  fuelBarColor: string;
  fuelBarLowColor: string;
  fuelBarLowThreshold: number;
  fuelBarActiveColor: string;
  fuelBarEmptyColor: string;
  fuelBarEmissive: number;
  fuelBarBgVisible: boolean;
  fuelBarBgOpacity: number;
  fuelBarBgColor: string;
  fuelBarBorderVisible: boolean;

  // Individual object controls: Floating / Surface Indicator (Cartel)
  fuelIndicatorMode: 'billboard' | 'surface';
  fuelIndicatorOffsetX: number;
  fuelIndicatorOffsetY: number;
  fuelIndicatorOffsetZ: number;
  fuelIndicatorWidth: number;
  fuelIndicatorHeight: number;
  fuelIndicatorRotationX: number;
  fuelIndicatorRotationY: number;
  fuelIndicatorRotationZ: number;
  fuelIndicatorScale: number;
}
const finite = (value: unknown, fallback: number, max = 1e7) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;

const finiteSigned = (value: unknown, fallback: number, min = -1e5, max = 1e5) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

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
    showFuelStatus: props.showFuelStatus !== false, showFuelReserve: props.showFuelReserve !== false,
    showFuelRate: props.showFuelRate !== false, showFuelBar: props.showFuelBar !== false,
    fuelActivation: props.fuelActivation === 'interact' ? 'interact' : 'automatic',
    fuelHoldSeconds: finite(props.fuelHoldSeconds, 0, 60),
    fuelBorderVisible: props.fuelBorderVisible !== false,
    fuelBorderColor: typeof props.fuelBorderColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBorderColor) ? props.fuelBorderColor : '#42ffd2',
    fuelBorderUseZoneColor: props.fuelBorderUseZoneColor === true,
    fuelBorderOpacity: finite(props.fuelBorderOpacity, .75, 1),
    fuelBorderThickness: Math.max(.005, finite(props.fuelBorderThickness, .025, .5)),

    // Reserve bar individual controls (defaults preserve original 1.8m width, 0.09m height, 0.06m depth, offset 0.32m above zone)
    fuelBarOffsetX: finiteSigned(props.fuelBarOffsetX ?? props.barOffsetX, 0),
    fuelBarOffsetY: finiteSigned(props.fuelBarOffsetY ?? props.barOffsetY, 0.32),
    fuelBarOffsetZ: finiteSigned(props.fuelBarOffsetZ ?? props.barOffsetZ, 0),
    fuelBarWidth: Math.max(0.01, finite(props.fuelBarWidth ?? props.barWidth ?? props.fuelBarLength, 1.8, 100)),
    fuelBarHeight: Math.max(0.01, finite(props.fuelBarHeight ?? props.barHeight, 0.09, 50)),
    fuelBarDepth: Math.max(0.01, finite(props.fuelBarDepth ?? props.barDepth, 0.06, 50)),
    fuelBarRotationX: finiteSigned(props.fuelBarRotationX ?? props.barRotationX, 0, -360, 360),
    fuelBarRotationY: finiteSigned(props.fuelBarRotationY ?? props.barRotationY, 0, -360, 360),
    fuelBarRotationZ: finiteSigned(props.fuelBarRotationZ ?? props.barRotationZ, 0, -360, 360),

    // Reserve bar direction & appearance
    fuelBarDirection: (['horizontal', 'horizontal-rl', 'vertical', 'vertical-tb'].includes(props.fuelBarDirection)
      ? props.fuelBarDirection
      : 'horizontal') as FuelZoneSettings['fuelBarDirection'],
    fuelBarColor: typeof props.fuelBarColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBarColor) && props.fuelBarColor.toLowerCase() !== '#42ffd2'
      ? props.fuelBarColor
      : '#00cc22',
    fuelBarLowColor: typeof props.fuelBarLowColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBarLowColor)
      ? props.fuelBarLowColor
      : '#ffcc00',
    fuelBarLowThreshold: Math.max(0.01, Math.min(0.9, finite(props.fuelBarLowThreshold, 0.25, 1))),
    fuelBarActiveColor: typeof props.fuelBarActiveColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBarActiveColor) && props.fuelBarActiveColor.toLowerCase() !== '#99ffce'
      ? props.fuelBarActiveColor
      : '#00ff11',
    fuelBarEmptyColor: typeof props.fuelBarEmptyColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBarEmptyColor) && props.fuelBarEmptyColor.toLowerCase() !== '#f07865'
      ? props.fuelBarEmptyColor
      : '#ff1111',
    fuelBarEmissive: finite(props.fuelBarEmissive, 0.8, 5),
    fuelBarBgVisible: props.fuelBarBgVisible !== false,
    fuelBarBgOpacity: finite(props.fuelBarBgOpacity, 0.35, 1),
    fuelBarBgColor: typeof props.fuelBarBgColor === 'string' && /^#[0-9a-f]{6}$/i.test(props.fuelBarBgColor) ? props.fuelBarBgColor : '#071b18',
    fuelBarBorderVisible: props.fuelBarBorderVisible !== false,

    // Floating / Surface indicator individual controls (cartel)
    fuelIndicatorMode: (props.fuelIndicatorMode === 'surface' || props.fuelIndicatorFixed === true) ? 'surface' : 'billboard',
    fuelIndicatorOffsetX: finiteSigned(props.fuelIndicatorOffsetX ?? props.indicatorOffsetX, 0),
    fuelIndicatorOffsetY: finiteSigned(props.fuelIndicatorOffsetY ?? props.indicatorOffsetY, 0.85),
    fuelIndicatorOffsetZ: finiteSigned(props.fuelIndicatorOffsetZ ?? props.indicatorOffsetZ, 0),
    fuelIndicatorWidth: Math.max(0.2, finite(props.fuelIndicatorWidth, props.fuelIndicatorScale ? props.fuelIndicatorScale * 2.8 : 2.8, 100)),
    fuelIndicatorHeight: Math.max(0.1, finite(props.fuelIndicatorHeight, props.fuelIndicatorScale ? props.fuelIndicatorScale * 1.4 : 1.4, 100)),
    fuelIndicatorRotationX: finiteSigned(props.fuelIndicatorRotationX, 0, -360, 360),
    fuelIndicatorRotationY: finiteSigned(props.fuelIndicatorRotationY, 0, -360, 360),
    fuelIndicatorRotationZ: finiteSigned(props.fuelIndicatorRotationZ, 0, -360, 360),
    fuelIndicatorScale: Math.max(0.1, finite(props.fuelIndicatorScale ?? props.indicatorScale, 1.0, 20)),
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

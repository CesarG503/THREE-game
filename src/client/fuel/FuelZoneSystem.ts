import * as THREE from 'three';
import { distributeFuel, normalizeFuelZone } from './FuelZoneSettings';
import { FuelZoneVisual } from './FuelZoneVisual';

type Demand = { key: string; kind: 'vehicle' | 'jetpack'; vehicleId?: string; fuel: number; maxFuel: number };
type Target = Demand & { tank: any; collider: any; position: THREE.Vector3 };
type Request = { requestId: string; targets: Demand[] };
type Grant = { playerId: string; requestId: string; key: string; amount: number; zoneId: string; vehicleId?: string };

/** Uses actual Rapier shapes, including rotated pads and a vehicle touching only at its edge. */
export function touchesFuelZone(zone: THREE.Object3D, collider: any): boolean {
  const body = zone.userData.rigidBody;
  if (!body?.isValid?.() || !collider?.isValid?.()) return false;
  for (let i = 0; i < body.numColliders(); i++) {
    if (body.collider(i).contactCollider(collider, .08)) return true;
  }
  return false;
}

export class FuelZoneSystem {
  private visuals = new Map<THREE.Object3D, FuelZoneVisual>();
  private effects = new Map<string, Map<string, { remaining: number; point: THREE.Vector3 }>>();
  private requests = new Map<string, Request>();
  private seenRequests = new Map<string, Set<string>>();
  private pending?: { requestId: string; targets: Map<string, Target>; age: number };
  private itemKeys = new WeakMap<object, string>();
  private elapsed = 0;
  private requestClock = 0;
  private authorityId = '';
  private sequence = 0;
  private receivedSequence = -1;
  constructor(private game: any) {}
  private get network() { return this.game.networkManager; }
  private get localId(): string { return this.network?.playerId || 'local'; }
  private get peers(): string[] { return this.network?.isConnected ? [this.localId, ...this.network.remotePlayers.keys()].sort() : [this.localId]; }
  private get authority(): string { return this.peers[0]; }
  private get objects(): THREE.Object3D[] { return this.game.sceneManager?.scene?.children ?? []; }
  private get zones() { return this.objects.filter(o => o.userData.mapObjectType === 'fuel_zone' && o.visible && !o.userData.invisible); }
  private vehicleOwner(bike: THREE.Object3D): string {
    // Driver owns fuel while riding; one peer owns a parked vehicle.
    const riders = [...(this.network?.remotePlayers?.entries() ?? [])]
      .filter(([, p]: any) => p.state?.motorbike?.uuid === bike.userData.uuid)
      .map(([id, p]: any) => ({ id, seat: p.state.motorbike.seat ?? 'driver' }));
    if (this.game.vehicleSystem?.mounted === bike) riders.push({id: this.localId, seat: this.game.vehicleSystem.seat});
    for (const seat of ['driver', 'passenger']) {
      const rider = riders.filter(r => r.seat === seat).map(r => r.id).sort()[0];
      if (rider) return rider;
      const id = bike.userData[seat === 'driver' ? 'vehicleDriver' : 'vehiclePassenger'];
      if (this.peers.includes(id)) return id;
    }
    return this.authority;
  }
  private localTargets(zones: THREE.Object3D[]): Target[] {
    const targets: Target[] = [];
    for (const bike of this.objects) {
      const props = bike.userData.logicProperties;
      if (!(props?.vehicleKind || bike.userData.mapObjectType === 'motorbike') || !bike.visible || this.vehicleOwner(bike) !== this.localId) continue;
      const collider = bike.userData.rigidBody?.isValid?.() ? bike.userData.rigidBody.collider(0) : null;
      targets.push({key: `vehicle:${bike.userData.uuid}`, kind: 'vehicle', vehicleId: bike.userData.uuid,
        tank: props, fuel: props.consumableUse, maxFuel: props.maxConsumableUse, collider, position: bike.getWorldPosition(new THREE.Vector3())});
    }
    const character = this.game.character;
    const item = character?.equippedItem;
    if (!character?.isDead && item && (item.equipSlot === 'back' || item.type === 'jetpack' || String(item.id).startsWith('jetpack')) && Number.isFinite(item.maxConsumableUse)) {
      let key = this.itemKeys.get(item);
      if (!key) { key = `jetpack:${THREE.MathUtils.generateUUID()}`; this.itemKeys.set(item, key); }
      targets.push({key, kind: 'jetpack', tank: item, fuel: item.consumableUse, maxFuel: item.maxConsumableUse,
        collider: character.collider, position: character.getPosition().clone().addScaledVector(character.getGravityUpVector?.() ?? new THREE.Vector3(0, 1, 0), 1)});
    }
    return targets.filter(t => Number.isFinite(t.fuel) && Number.isFinite(t.maxFuel) && t.maxFuel > 0 && t.fuel < t.maxFuel &&
      zones.some(z => touchesFuelZone(z, t.collider)));
  }
  private apply(target: Target, amount: number) {
    const current = Math.max(0, Number(target.tank.consumableUse) || 0);
    target.tank.consumableUse = Math.min(target.tank.maxConsumableUse, current + amount);
    if (target.kind === 'jetpack') {
      this.game.character?.emit?.('jetpackUpdate', {fuel: target.tank.consumableUse, maxFuel: target.tank.maxConsumableUse,
        airTime: this.game.character.consecutiveAirTime ?? 0, maxAirTime: target.tank.airLimit ?? 0});
      this.game.character?.emit?.('jumpChanged', {current: target.tank.consumableUse, max: target.tank.maxConsumableUse, type: 'jetpack'});
    }
  }
  private effect(zoneId: string, targetKey: string, point: THREE.Vector3) {
    const effects = this.effects.get(zoneId) ?? new Map();
    effects.set(targetKey, {remaining: .22, point: point.clone()});
    this.effects.set(zoneId, effects);
  }
  receiveAction(playerId: string, action: string, data: any) {
    if (!this.network?.isConnected || !data || !this.peers.includes(playerId)) return;
    if (action === 'fuelZoneRequest' && this.authority === this.localId) {
      if (typeof data.requestId !== 'string' || data.requestId.length > 80 || !Array.isArray(data.targets) || data.targets.length > 64 ||
        this.seenRequests.get(playerId)?.has(data.requestId)) return;
      const valid = data.targets.every((t: Demand) => t && typeof t.key === 'string' && t.key.length <= 100 &&
        ['vehicle', 'jetpack'].includes(t.kind) && Number.isFinite(t.fuel) && Number.isFinite(t.maxFuel) && t.fuel >= 0 && t.maxFuel > 0 && t.maxFuel <= 1e7 && t.fuel <= t.maxFuel &&
        (t.kind !== 'vehicle' || (typeof t.vehicleId === 'string' && t.key === `vehicle:${t.vehicleId}`)));
      if (valid && data.targets.filter((t: Demand) => t.kind === 'jetpack').length <= 1 && new Set(data.targets.map((t: Demand) => t.key)).size === data.targets.length) this.requests.set(playerId, data);
    } else if (action === 'fuelZoneSupply' && playerId === this.authority) {
      if (!Number.isSafeInteger(data.sequence) || data.sequence <= this.receivedSequence || !Array.isArray(data.zones) || !Array.isArray(data.grants) || !Array.isArray(data.acks)) return;
      if (!data.zones.every((z: any) => typeof z?.uuid === 'string' && Number.isFinite(z.remaining) && z.remaining >= 0) ||
        !data.grants.every((g: Grant) => g && typeof g.playerId === 'string' && typeof g.requestId === 'string' && typeof g.key === 'string' && typeof g.zoneId === 'string' && Number.isFinite(g.amount) && g.amount > 0 && g.amount <= 1e7)) return;
      this.receivedSequence = data.sequence;
      for (const state of data.zones) {
        const zone = this.zones.find(z => z.userData.uuid === state.uuid);
        if (zone) zone.userData.logicProperties.fuelRemaining = Math.min(normalizeFuelZone(zone.userData.logicProperties).fuelCapacity, state.remaining);
      }
      for (const grant of data.grants as Grant[]) {
        if (grant.playerId === this.localId && grant.requestId === this.pending?.requestId) {
          const target = this.pending.targets.get(grant.key);
          if (target) this.apply(target, grant.amount);
        }
        // Parked vehicles have no riding snapshots to carry their new fuel.
        if (grant.vehicleId && grant.playerId !== this.localId) {
          const bike = this.objects.find(o => o.userData.uuid === grant.vehicleId);
          if (bike && !bike.userData.vehicleDriver && !bike.userData.vehiclePassenger && this.game.vehicleSystem?.mounted !== bike &&
            ![...this.network.remotePlayers.values()].some((p: any) => p.state?.motorbike?.uuid === grant.vehicleId)) {
            const tank = bike.userData.logicProperties;
            tank.consumableUse = Math.min(tank.maxConsumableUse, Math.max(0, tank.consumableUse) + grant.amount);
          }
        }
        const target = grant.vehicleId ? this.objects.find(o => o.userData.uuid === grant.vehicleId)?.position :
          grant.playerId === this.localId ? this.game.character?.getPosition() : this.network.remotePlayers.get(grant.playerId)?.currentPosition;
        if (target) this.effect(grant.zoneId, `${grant.playerId}:${grant.key}`, target);
      }
      if (data.acks.includes(this.pending?.requestId)) this.pending = undefined;
    }
  }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1); // No fuel catch-up after a suspended/background tab.
    if (this.authorityId !== this.authority) {
      this.authorityId = this.authority; this.receivedSequence = -1; this.pending = undefined;
      this.requests.clear(); this.seenRequests.clear(); this.elapsed = 0;
    }
    const zones = this.zones;
    for (const [zone] of this.visuals) if (!zones.includes(zone)) this.visuals.delete(zone);
    for (const [id, effects] of this.effects) {
      for (const [key, effect] of effects) { effect.remaining -= dt; if (effect.remaining <= 0) effects.delete(key); }
      if (!effects.size) this.effects.delete(id);
    }
    for (const zone of zones) {
      zone.userData.logicProperties ??= {};
      Object.assign(zone.userData.logicProperties, normalizeFuelZone(zone.userData.logicProperties));
      let visual = this.visuals.get(zone);
      if (!visual) {
        visual = (zone as any).fuelZoneVisual ?? new FuelZoneVisual(zone, zone.userData.originalScale);
        (zone as any).fuelZoneVisual = visual; this.visuals.set(zone, visual!);
      }
      visual!.update(dt, [...(this.effects.get(zone.userData.uuid)?.values() ?? [])].map(effect => effect.point));
    }
    if (!zones.length) { this.requests.clear(); this.pending = undefined; this.elapsed = 0; return; }
    const local = this.localTargets(zones);
    const connected = this.network?.isConnected;
    this.elapsed += dt; this.requestClock += dt;
    if (this.pending) { this.pending.age += dt; if (this.pending.age > 2) this.pending = undefined; }
    if (connected && this.authority !== this.localId) {
      if (!this.pending && this.requestClock >= .1 && local.length) {
        const requestId = THREE.MathUtils.generateUUID();
        this.pending = {requestId, targets: new Map(local.map(t => [t.key, t])), age: 0}; this.requestClock = 0;
        this.network.sendPlayerAction('fuelZoneRequest', {requestId, targets: local.map(({key, kind, vehicleId, fuel, maxFuel}) => ({key, kind, vehicleId, fuel, maxFuel}))});
      }
      return;
    }
    if (connected && this.elapsed < .1) return;
    const step = Math.min(this.elapsed, .2); this.elapsed = 0;
    const candidates: Array<{playerId: string; requestId: string; target: Target}> = local.map(target => ({playerId: this.localId, requestId: '', target}));
    const acks: string[] = [];
    for (const [playerId, request] of this.requests) {
      acks.push(request.requestId);
      const seen = this.seenRequests.get(playerId) ?? new Set<string>(); seen.add(request.requestId);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      this.seenRequests.set(playerId, seen);
      for (const demand of request.targets) {
        const bike = demand.kind === 'vehicle' ? this.objects.find(o => o.userData.uuid === demand.vehicleId && (o.userData.logicProperties?.vehicleKind || o.userData.mapObjectType === 'motorbike')) : null;
        if (demand.kind === 'vehicle' && (!bike || this.vehicleOwner(bike) !== playerId)) continue;
        const remote = this.network?.remotePlayers.get(playerId);
        const collider = bike ? (bike.userData.rigidBody?.isValid?.() ? bike.userData.rigidBody.collider(0) : null) : remote?.collider;
        const position = bike?.position.clone() ?? remote?.currentPosition?.clone();
        if (!position || !collider) continue;
        candidates.push({playerId, requestId: request.requestId, target: {...demand, tank: null, collider, position}});
      }
    }
    this.requests.clear();
    const grants: Grant[] = [], states: Array<{uuid: string; remaining: number}> = [];
    for (const zone of zones) {
      const props = normalizeFuelZone(zone.userData.logicProperties);
      if (!props.fuelEnabled || props.fuelRate <= 0) continue;
      const eligible = candidates.filter(c => (c.target.kind === 'vehicle' ? props.refuelVehicles : props.refuelJetpacks) && touchesFuelZone(zone, c.target.collider));
      const amounts = distributeFuel(eligible.map(c => c.target.maxFuel - c.target.fuel), Math.min(props.fuelRate * step, props.fuelLimited ? props.fuelRemaining : Infinity));
      let used = 0;
      for (let i = 0; i < eligible.length; i++) {
        if (amounts[i] <= 0) continue;
        const {playerId, requestId, target} = eligible[i]; used += amounts[i]; target.fuel += amounts[i];
        if (playerId === this.localId) this.apply(target, amounts[i]);
        this.effect(zone.userData.uuid, `${playerId}:${target.key}`, target.position);
        grants.push({playerId, requestId, key: target.key, vehicleId: target.vehicleId, amount: amounts[i], zoneId: zone.userData.uuid});
      }
      if (props.fuelLimited) zone.userData.logicProperties.fuelRemaining = props.fuelRemaining - used < 1e-8 ? 0 : props.fuelRemaining - used;
      if (used > 0) states.push({uuid: zone.userData.uuid, remaining: zone.userData.logicProperties.fuelRemaining});
    }
    if (connected && (grants.length || acks.length)) this.network.sendPlayerAction('fuelZoneSupply', {sequence: ++this.sequence, zones: states, grants, acks});
  }
  dispose() { this.visuals.clear(); this.effects.clear(); this.requests.clear(); this.seenRequests.clear(); this.pending = undefined; }
}

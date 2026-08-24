import * as THREE from 'three';
import { getControllerDamage } from '../utils/DamageController';
import { normalizeMotorbikeSettings } from './MotorbikeSettings';
import { vehicleUp } from './VehicleGravity';
import type { MotorbikeVisual } from './MotorbikeModel';

export function isMotorbikeBroken(props: any) {
  return props?.durabilityEnabled === true && props.durability <= 0;
}

/** Each vehicle has independent damage intervals; only its network owner applies damage. */
export class VehicleDurability {
  private elapsed = 0;
  private lastHits = new WeakMap<MotorbikeVisual, WeakMap<THREE.Object3D, number>>();
  private revisions = new WeakMap<MotorbikeVisual, number>();
  constructor(private game: any, private onDamage?: (bike: MotorbikeVisual) => void) {}

  private authority(bike: MotorbikeVisual): string {
    const network = this.game.networkManager;
    const local = network?.playerId || 'local';
    if (!network?.isConnected) return local;
    const peers = [local, ...network.remotePlayers.keys()] as string[];
    const riders = [...network.remotePlayers.entries()]
      .filter(([, player]: any) => player.state?.motorbike?.uuid === bike.userData.uuid)
      .map(([id, player]: any) => ({ id, seat: player.state.motorbike.seat ?? 'driver' }));
    if (this.game.vehicleSystem?.mounted === bike) riders.push({ id: local, seat: this.game.vehicleSystem.seat });
    for (const seat of ['driver', 'passenger']) {
      const rider = riders.filter((r: any) => r.seat === seat).map((r: any) => r.id).sort()[0];
      if (rider) return rider;
      const id = bike.userData[seat === 'driver' ? 'vehicleDriver' : 'vehiclePassenger'];
      if (peers.includes(id)) return id;
    }
    // A parked bike also takes damage, with one client responsible for it.
    return peers.sort()[0];
  }

  state(bike: MotorbikeVisual) {
    return { durability: bike.userData.logicProperties.durability, durabilityRevision: this.revisions.get(bike) ?? 0 };
  }

  receive(bike: MotorbikeVisual, state: any) {
    if (typeof state?.durability !== 'number' || !Number.isFinite(state.durability) || state.durability < 0 ||
        !Number.isSafeInteger(state.durabilityRevision) || state.durabilityRevision < 0 ||
        state.durabilityRevision <= (this.revisions.get(bike) ?? -1)) return;
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    if (props.durabilityEnabled && state.durability < props.durability) this.onDamage?.(bike);
    bike.userData.logicProperties.durability = Math.min(props.maxDurability, state.durability);
    this.revisions.set(bike, state.durabilityRevision);
  }

  receiveAction(playerId: string, state: any, bikes: MotorbikeVisual[]) {
    const bike = bikes.find(b => b.userData.uuid === state?.uuid);
    if (bike && playerId === this.authority(bike)) this.receive(bike, state);
  }

  damage(bike: MotorbikeVisual, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || !bike.userData.logicProperties?.durabilityEnabled ||
        this.authority(bike) !== (this.game.networkManager?.playerId || 'local')) return false;
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    if (isMotorbikeBroken(props)) return false;
    Object.assign(bike.userData.logicProperties, props, { durability: Math.max(0, props.durability - amount) });
    this.revisions.set(bike, (this.revisions.get(bike) ?? 0) + 1);
    this.onDamage?.(bike);
    this.game.floatingTextManager?.spawnText(`-${amount}`, bike.position.clone().addScaledVector(vehicleUp(bike), 1), '#FF9933', 2);
    if (this.game.networkManager?.isConnected) {
      this.game.networkManager.sendPlayerAction('motorbikeDurability', { uuid: bike.userData.uuid, ...this.state(bike) });
    }
    return true;
  }

  private touches(bike: MotorbikeVisual, source: THREE.Object3D) {
    const body = source.userData.rigidBody;
    const collider = bike.userData.rigidBody.collider(0);
    if (body?.isValid()) {
      for (let i = 0; i < body.numColliders(); i++) {
        const other = body.collider(i);
        // Include the kinematic controller's separation margin when touching solid walls.
        if (collider.shape.contactShape(bike.position, bike.quaternion, other.shape, other.translation(), other.rotation(), 0.06)) return true;
      }
      return false;
    }
    const bounds = new THREE.Box3().setFromObject(source);
    const dims = bike.userData.originalScale;
    const bikeBounds = new THREE.Box3(new THREE.Vector3(-dims.x / 2, -dims.y / 2, -dims.z / 2), new THREE.Vector3(dims.x / 2, dims.y / 2, dims.z / 2));
    bikeBounds.applyMatrix4(new THREE.Matrix4().compose(bike.position, bike.quaternion, new THREE.Vector3(1, 1, 1))).expandByScalar(0.06);
    return bikeBounds.intersectsBox(bounds);
  }

  update(bikes: MotorbikeVisual[], dt: number) {
    this.elapsed += dt;
    const sources = this.game.sceneManager.scene.children.filter((obj: THREE.Object3D) => obj.userData.logicProperties?.enableDamage === true);
    for (const bike of bikes) {
      if (!bike.userData.logicProperties?.durabilityEnabled || !bike.userData.rigidBody?.isValid()) continue;
      const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
      Object.assign(bike.userData.logicProperties, props);
      if (isMotorbikeBroken(props) || this.authority(bike) !== (this.game.networkManager?.playerId || 'local')) continue;
      let hits = this.lastHits.get(bike);
      if (!hits) { hits = new WeakMap(); this.lastHits.set(bike, hits); }
      for (const source of sources) {
        if (source === bike || !this.touches(bike, source)) continue;
        const damageProps = source.userData.logicProperties;
        const last = hits.get(source);
        const cooldown = Number(damageProps.damageCooldown ?? 1);
        if (last !== undefined && this.elapsed - last + 1e-8 < (Number.isFinite(cooldown) ? Math.max(0, cooldown) : 1)) continue;
        const accumulated = Number(damageProps.accumulatedDamage ?? 0);
        if (damageProps.enableDamageStopLimit && accumulated >= Number(damageProps.damageStopLimit ?? 100)) continue;
        const damage = getControllerDamage(damageProps, props.maxDurability);
        if (damage <= 0) continue;
        hits.set(source, this.elapsed);
        this.damage(bike, damage);
        damageProps.accumulatedDamage = accumulated + damage;
        if (isMotorbikeBroken(bike.userData.logicProperties)) break;
      }
    }
  }
}

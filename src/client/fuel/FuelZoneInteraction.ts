import * as THREE from 'three';
import { normalizeFuelZone } from './FuelZoneSettings';

type ContactTarget = {key: string; kind: 'vehicle' | 'jetpack'; fuel: number; maxFuel: number; collider: any};

/** Activation belongs to each tank's current visit, never to the saved map. */
export class FuelZoneInteraction {
  private active = new Map<THREE.Object3D, Set<string>>();
  private holding?: THREE.Object3D;
  private heldSeconds = 0;
  constructor(private game: any, private zones: () => THREE.Object3D[], private targets: () => ContactTarget[],
    private touches: (zone: THREE.Object3D, collider: any) => boolean) {}
  private get blocked() {
    const focused = typeof document !== 'undefined' ? document.activeElement as HTMLElement : null;
    return (focused && (['INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tagName) || focused.isContentEditable)) || this.game.inputManager?.enabled === false || this.game.cameraController?.isUIOpen || this.game.cameraController?.isPaused ||
      this.game.character?.isDead || this.game.playerConfigManager?.getCurrentProfile?.()?.disableInteraction;
  }
  private contacts(zone: THREE.Object3D) {
    const p = normalizeFuelZone(zone.userData.logicProperties);
    return this.targets().filter(t => (t.kind === 'vehicle' ? p.refuelVehicles : p.refuelJetpacks) && this.touches(zone, t.collider));
  }
  private actorTouches(zone: THREE.Object3D, playerId?: string) {
    if (!playerId) {
      const mounted = this.game.vehicleSystem?.mounted;
      return this.touches(zone, this.game.character?.collider) ||
        (mounted?.userData.rigidBody?.isValid?.() && this.touches(zone, mounted.userData.rigidBody.collider(0)));
    }
    const remote = this.game.networkManager?.remotePlayers.get(playerId);
    const bike = this.game.sceneManager?.scene.children.find((o: THREE.Object3D) => o.userData.uuid === remote?.state?.motorbike?.uuid);
    return this.touches(zone, remote?.collider) || (bike?.userData.rigidBody?.isValid?.() && this.touches(zone, bike.userData.rigidBody.collider(0)));
  }
  private available(zone: THREE.Object3D) {
    const p = normalizeFuelZone(zone.userData.logicProperties);
    return p.fuelActivation === 'interact' && p.fuelEnabled && p.fuelRate > 0 && (!p.fuelLimited || p.fuelRemaining > 1e-8);
  }
  isActive(zone: THREE.Object3D, targetKey: string) { return this.active.get(zone)?.has(targetKey) === true; }
  candidate() {
    if (this.blocked) return undefined;
    const candidates = this.zones().filter(z => this.available(z) && this.actorTouches(z) &&
      this.contacts(z).some(t => t.fuel < t.maxFuel && !this.isActive(z, t.key)));
    const position = this.game.character?.getPosition?.() ?? new THREE.Vector3();
    return candidates.sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))[0];
  }
  press(): boolean {
    const zone = this.candidate();
    if (!zone) return false;
    this.holding = zone; this.heldSeconds = 0;
    if (normalizeFuelZone(zone.userData.logicProperties).fuelHoldSeconds === 0) this.activate(zone);
    return true;
  }
  release() { this.holding = undefined; this.heldSeconds = 0; }
  private activate(zone: THREE.Object3D) {
    const keys = this.contacts(zone).map(t => t.key);
    const active = this.active.get(zone) ?? new Set<string>(); keys.forEach(key => active.add(key)); this.active.set(zone, active);
    this.game.networkManager?.sendPlayerAction?.('fuelZoneActivate', {zoneId: zone.userData.uuid, keys: keys.filter(k => k.startsWith('vehicle:'))});
    this.release();
  }
  receive(playerId: string, data: any) {
    if (!this.game.networkManager?.isConnected || !this.game.networkManager.remotePlayers.has(playerId) || typeof data?.zoneId !== 'string' || !Array.isArray(data.keys) || data.keys.length > 64) return;
    const zone = this.zones().find(z => z.userData.uuid === data.zoneId);
    if (!zone || !this.available(zone) || !this.actorTouches(zone, playerId)) return;
    const active = this.active.get(zone) ?? new Set<string>();
    for (const target of this.contacts(zone)) if (target.kind === 'vehicle' && data.keys.includes(target.key)) active.add(target.key);
    this.active.set(zone, active);
  }
  update(dt: number) {
    const zones = this.zones();
    for (const [zone, active] of this.active) {
      const props = normalizeFuelZone(zone.userData.logicProperties);
      if (!zones.includes(zone) || !props.fuelEnabled || props.fuelActivation !== 'interact') { this.active.delete(zone); continue; }
      const keys = new Set(this.contacts(zone).map(t => t.key));
      for (const key of active) if (!keys.has(key)) active.delete(key);
    }
    if (this.holding) {
      if (this.blocked || this.candidate() !== this.holding) { this.release(); return; }
      this.heldSeconds += Math.min(dt, .1);
      if (this.heldSeconds + 1e-8 >= normalizeFuelZone(this.holding.userData.logicProperties).fuelHoldSeconds) this.activate(this.holding);
    }
  }
  renderPrompt(prompt: HTMLElement, progress: HTMLElement): boolean {
    const zone = this.candidate(); if (!zone) return false;
    const p = normalizeFuelZone(zone.userData.logicProperties);
    const point = zone.localToWorld(new THREE.Vector3(0, (zone.userData.originalScale?.y ?? 2) / 2 + .4, 0));
    point.project(this.game.sceneManager.camera);
    prompt.style.display = point.z >= -1 && point.z <= 1 ? 'flex' : 'none';
    prompt.style.left = `${(point.x * .5 + .5) * window.innerWidth}px`;
    prompt.style.top = `${(-point.y * .5 + .5) * window.innerHeight}px`;
    prompt.classList.remove('interaction-pulsation-mode');
    prompt.classList.toggle('active', this.holding === zone);
    progress.style.display = '';
    progress.style.strokeDashoffset = String(163 * (1 - (this.holding === zone && p.fuelHoldSeconds > 0 ? Math.min(1, this.heldSeconds / p.fuelHoldSeconds) : 0)));
    let caption = document.getElementById('fuel-interaction-caption');
    if (!caption) {
      caption = document.createElement('span'); caption.id = 'fuel-interaction-caption';
      caption.style.cssText = 'position:absolute;top:64px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0b2528df;color:#c6ffe4;border-radius:6px;padding:5px 9px;font:12px system-ui;pointer-events:none';
      prompt.appendChild(caption);
    }
    caption.style.display = '';
    caption.textContent = p.fuelHoldSeconds > 0 ? `Mantén F ${p.fuelHoldSeconds} s · Recargar` : 'Pulsa F · Recargar';
    return true;
  }
  dispose() { this.active.clear(); this.release(); }
}

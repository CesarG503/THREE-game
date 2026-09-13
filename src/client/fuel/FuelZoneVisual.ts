import * as THREE from 'three';
import { normalizeFuelZone } from './FuelZoneSettings';

/** All resources belong to the zone, so normal map removal disposes them. */
export class FuelZoneVisual {
  readonly root = new THREE.Group();
  private bar: THREE.Mesh;
  private pulse: THREE.Mesh;
  private streams: THREE.Mesh[] = [];
  private label?: THREE.Sprite;
  private canvas?: HTMLCanvasElement;
  private lastText = '';
  private time = 0;
  private burst = 0;
  private wasActive = false;
  constructor(private zone: THREE.Object3D, private dims: {x: number; y: number; z: number}) {
    this.root.name = 'fuel-zone-indicator';
    const boundsGeometry = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
    const edgeGeometry = new THREE.EdgesGeometry(boundsGeometry); boundsGeometry.dispose();
    this.root.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({color: 0x42ffd2, transparent: true, opacity: .75})));
    this.pulse = new THREE.Mesh(new THREE.TorusGeometry(Math.min(dims.x, dims.z) * .3, .025, 6, 48),
      new THREE.MeshBasicMaterial({color: 0x74fff0, transparent: true, opacity: 0, depthWrite: false}));
    this.pulse.rotation.x = Math.PI / 2; this.pulse.position.y = dims.y / 2 + .04; this.root.add(this.pulse);
    this.bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, .09, .06), new THREE.MeshBasicMaterial({color: 0x42ffd2}));
    this.bar.position.set(0, dims.y / 2 + .32, 0); this.root.add(this.bar);
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas'); this.canvas.width = 768; this.canvas.height = 192;
      const texture = new THREE.CanvasTexture(this.canvas); texture.colorSpace = THREE.SRGBColorSpace;
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false}));
      this.label.position.y = dims.y / 2 + .85; this.label.scale.set(3.8, .95, 1); this.root.add(this.label);
    }
    const streakGeometry = new THREE.CylinderGeometry(.018, .035, 1, 5);
    const streakMaterial = new THREE.MeshBasicMaterial({color: 0x9affde, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending});
    for (let i = 0; i < 48; i++) {
      const streak = new THREE.Mesh(streakGeometry, streakMaterial); streak.visible = false;
      this.streams.push(streak); this.root.add(streak);
    }
    this.root.traverse(child => { child.userData.ignoreRaycast = true; child.raycast = () => {}; });
    zone.add(this.root); this.update(0, []);
  }
  update(dt: number, worldTargets: THREE.Vector3[]) {
    const props = normalizeFuelZone(this.zone.userData.logicProperties);
    this.time += dt;
    const active = worldTargets.length > 0 && props.fuelEnabled;
    if (active && !this.wasActive) this.burst = .45;
    this.wasActive = active; this.burst = Math.max(0, this.burst - dt);
    const fraction = props.fuelLimited ? (props.fuelCapacity > 0 ? props.fuelRemaining / props.fuelCapacity : 0) : 1;
    const empty = props.fuelLimited && props.fuelRemaining <= 1e-8;
    const color = !props.fuelEnabled || empty ? 0xf07865 : active ? 0x99ffce : 0x42ffd2;
    this.bar.visible = props.showFuelIndicator;
    this.bar.scale.x = Math.max(.001, fraction);
    this.bar.position.x = -.9 * (1 - fraction);
    (this.bar.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.pulse.visible = props.showFuelEffects && active;
    this.pulse.scale.setScalar(this.burst > 0 ? 1 + (1 - this.burst / .45) * 1.8 : 1 + Math.sin(this.time * 9) * .06);
    (this.pulse.material as THREE.MeshBasicMaterial).opacity = this.burst > 0 ? this.burst / .45 : .45;
    const targets = worldTargets.slice(0, 8).map(point => this.zone.worldToLocal(point.clone()));
    const start = new THREE.Vector3(0, this.dims.y / 2 + .1, 0);
    for (let i = 0; i < this.streams.length; i++) {
      const streak = this.streams[i], target = targets[Math.floor(i / 6)];
      streak.visible = props.showFuelEffects && active && !!target;
      if (!streak.visible) continue;
      const phase = (this.time * (this.burst > 0 ? 4 : 2.5) + i / 6) % 1;
      const point = (t: number) => start.clone().lerp(target, t).add(new THREE.Vector3(Math.sin(t * Math.PI) * .25, Math.sin(t * Math.PI) * .5, 0));
      const a = point(phase), b = point(Math.min(1, phase + .12));
      streak.position.copy(a).add(b).multiplyScalar(.5);
      streak.scale.y = Math.max(.001, a.distanceTo(b));
      streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    }
    if (this.label && this.canvas) {
      this.label.visible = props.showFuelIndicator;
      const status = !props.fuelEnabled ? 'DESACTIVADA' : empty ? 'SIN COMBUSTIBLE' : active ? 'RECARGANDO' : 'GASOLINA';
      const reserve = props.fuelLimited ? `${Math.ceil(props.fuelRemaining)} / ${props.fuelCapacity} u disponibles` : 'Reserva ilimitada';
      const title = props.name.slice(0, 42);
      const text = `${title}|${status}|${reserve}|${props.fuelRate}`;
      if (text !== this.lastText) {
        this.lastText = text;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 768, 192); ctx.fillStyle = 'rgba(7,25,29,.92)'; ctx.fillRect(0, 0, 768, 192);
          ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 762, 186);
          ctx.textAlign = 'center'; ctx.fillStyle = '#effffa'; ctx.font = 'bold 27px sans-serif'; ctx.fillText(title, 384, 38, 736);
          ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 36px sans-serif'; ctx.fillText(status, 384, 86);
          ctx.fillStyle = '#d5eee7'; ctx.font = '28px sans-serif'; ctx.fillText(reserve, 384, 132);
          ctx.font = '23px sans-serif'; ctx.fillText(`Caudal total: ${props.fuelRate} u/s`, 384, 169);
          (this.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
        }
      }
    }
  }
}

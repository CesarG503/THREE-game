import * as THREE from 'three';
import { normalizeFuelZone } from './FuelZoneSettings';

export function fuelZoneTextLines(props: ReturnType<typeof normalizeFuelZone>, active: boolean): string[] {
  const empty = props.fuelLimited && props.fuelRemaining <= 1e-8;
  const status = !props.fuelEnabled ? 'DESACTIVADA' : empty ? 'SIN COMBUSTIBLE' : active ? 'RECARGANDO' : 'GASOLINA';
  const reserve = props.fuelLimited ? `${Math.ceil(props.fuelRemaining)} / ${props.fuelCapacity} u disponibles` : 'Reserva ilimitada';
  return [props.showFuelStatus ? status : '', props.showFuelReserve ? reserve : '', props.showFuelRate ? `Caudal total: ${props.fuelRate} u/s` : ''].filter(Boolean);
}

/** All resources belong to the zone, so normal map removal disposes them. */
export class FuelZoneVisual {
  readonly root = new THREE.Group();
  private border: THREE.InstancedMesh;
  private bar: THREE.Mesh;
  private pulse: THREE.Mesh;
  private streams: THREE.Mesh[] = [];
  private label?: THREE.Sprite;
  private canvas?: HTMLCanvasElement;
  private lastText = '';
  private borderLayout = '';
  private time = 0;
  private burst = 0;
  private wasActive = false;
  constructor(private zone: THREE.Object3D, private dims: {x: number; y: number; z: number}) {
    this.dims = { ...dims };
    this.root.name = 'fuel-zone-indicator';
    this.border = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0x42ffd2, transparent: true, opacity: .75, depthWrite: false}), 12);
    this.border.name = 'fuel-zone-border'; this.border.frustumCulled = false; this.root.add(this.border);
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
    const dimensions = this.zone.userData.originalScale ?? this.dims;
    if (['x', 'y', 'z'].some(axis => dimensions[axis] !== this.dims[axis])) {
      this.dims = { x: dimensions.x, y: dimensions.y, z: dimensions.z };
      this.pulse.geometry.dispose();
      this.pulse.geometry = new THREE.TorusGeometry(Math.min(this.dims.x, this.dims.z) * .3, .025, 6, 48);
    }
    this.pulse.position.y = this.dims.y / 2 + .04;
    this.bar.position.y = this.dims.y / 2 + .32;
    if (this.label) this.label.position.y = this.dims.y / 2 + .85;
    const borderMaterial = this.border.material as THREE.MeshBasicMaterial;
    borderMaterial.color.set(props.fuelBorderUseZoneColor ? (this.zone.userData.color ?? 0x19c99a) : props.fuelBorderColor);
    borderMaterial.opacity = props.fuelBorderOpacity;
    this.border.visible = props.fuelBorderVisible && props.fuelBorderOpacity > 0;
    const layout = `${this.dims.x},${this.dims.y},${this.dims.z},${props.fuelBorderThickness}`;
    if (layout !== this.borderLayout) {
      this.borderLayout = layout;
      const axes = ['x', 'y', 'z'] as const;
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
      let edge = 0;
      for (const axis of axes) for (const a of [-1, 1]) for (const b of [-1, 1]) {
        const sides = axes.filter(other => other !== axis);
        position.set(0, 0, 0); position[sides[0]] = a * this.dims[sides[0]] / 2; position[sides[1]] = b * this.dims[sides[1]] / 2;
        scale.setScalar(props.fuelBorderThickness); scale[axis] = this.dims[axis];
        matrix.makeScale(scale.x, scale.y, scale.z).setPosition(position); this.border.setMatrixAt(edge++, matrix);
      }
      this.border.instanceMatrix.needsUpdate = true;
    }
    this.time += dt;
    const active = worldTargets.length > 0 && props.fuelEnabled;
    if (active && !this.wasActive) this.burst = .45;
    this.wasActive = active; this.burst = Math.max(0, this.burst - dt);
    const fraction = props.fuelLimited ? (props.fuelCapacity > 0 ? props.fuelRemaining / props.fuelCapacity : 0) : 1;
    const empty = props.fuelLimited && props.fuelRemaining <= 1e-8;
    const color = !props.fuelEnabled || empty ? 0xf07865 : active ? 0x99ffce : 0x42ffd2;
    this.bar.visible = props.showFuelIndicator && props.showFuelBar;
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

      const lines = fuelZoneTextLines(props, active);
      this.label.visible = props.showFuelIndicator && lines.length > 0;
      const text = `${lines.join('|')}|${color}`;
      if (text !== this.lastText) {
        this.lastText = text;
        const height = Math.max(1, lines.length) * 52 + 24;
        this.canvas.height = height; this.label.scale.set(3.8, 3.8 * height / 768, 1);
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 768, height); ctx.fillStyle = 'rgba(7,25,29,.92)'; ctx.fillRect(0, 0, 768, height);
          ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 762, height - 6);
          ctx.textAlign = 'center'; ctx.fillStyle = '#d5eee7'; ctx.font = 'bold 30px sans-serif';
          lines.forEach((line, index) => ctx.fillText(line, 384, 48 + index * 52, 736));
          (this.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
        }
      }
    }
  }
}

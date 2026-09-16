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
  readonly barRoot = new THREE.Group();
  private barBackground: THREE.Mesh;
  private barEdges: THREE.LineSegments;
  private bar: THREE.Mesh;
  private border: THREE.InstancedMesh;
  private pulse: THREE.Mesh;
  private streams: THREE.Mesh[] = [];
  readonly label?: THREE.Sprite;
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
    this.border.name = 'fuel-zone-border'; this.border.frustumCulled = false;
    this.border.userData.ignoreRaycast = true;
    this.root.add(this.border);

    this.pulse = new THREE.Mesh(new THREE.TorusGeometry(Math.min(dims.x, dims.z) * .3, .025, 6, 48),
      new THREE.MeshBasicMaterial({color: 0x74fff0, transparent: true, opacity: 0, depthWrite: false}));
    this.pulse.rotation.x = Math.PI / 2; this.pulse.position.y = dims.y / 2 + .04;
    this.pulse.userData.ignoreRaycast = true;
    this.root.add(this.pulse);

    // Reserve bar container with background enclosure, crisp edges frame & glowing fill mesh
    this.barRoot.name = 'fuel-zone-bar-root';
    this.barRoot.userData.isFuelBar = true;
    this.barRoot.userData.isFuelBarRoot = true;

    const barBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.barBackground = new THREE.Mesh(barBoxGeo, new THREE.MeshBasicMaterial({
      color: 0x071b18,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      depthTest: true
    }));
    this.barBackground.name = 'fuel-zone-bar-bg';
    this.barBackground.userData.isFuelBar = true;
    this.barBackground.renderOrder = 10;
    this.barRoot.add(this.barBackground);

    const edgesGeo = new THREE.EdgesGeometry(barBoxGeo);
    this.barEdges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({
      color: 0x42ffd2,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    }));
    this.barEdges.name = 'fuel-zone-bar-edges';
    this.barEdges.userData.isFuelBar = true;
    this.barEdges.renderOrder = 11;
    this.barRoot.add(this.barEdges);

    // Inner fuel mesh: solid with emissive glow, depthWrite=true, high renderOrder so it is never occluded or washed out
    this.bar = new THREE.Mesh(barBoxGeo, new THREE.MeshStandardMaterial({
      color: 0x42ffd2,
      emissive: 0x42ffd2,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }));
    this.bar.name = 'fuel-zone-bar-fill';
    this.bar.userData.isFuelBar = true;
    this.bar.renderOrder = 15;
    this.barRoot.add(this.bar);

    this.barRoot.position.set(0, dims.y / 2 + .32, 0);
    this.root.add(this.barRoot);

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas'); this.canvas.width = 768; this.canvas.height = 192;
      const texture = new THREE.CanvasTexture(this.canvas); texture.colorSpace = THREE.SRGBColorSpace;
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false}));
      this.label.name = 'fuel-zone-label';
      this.label.userData.isFuelIndicator = true;
      this.label.position.set(0, dims.y / 2 + .85, 0);
      this.label.scale.set(3.8, .95, 1);
      this.root.add(this.label);
    }
    const streakGeometry = new THREE.CylinderGeometry(.018, .035, 1, 5);
    const streakMaterial = new THREE.MeshBasicMaterial({color: 0x9affde, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending});
    for (let i = 0; i < 48; i++) {
      const streak = new THREE.Mesh(streakGeometry, streakMaterial); streak.visible = false;
      streak.userData.ignoreRaycast = true;
      this.streams.push(streak); this.root.add(streak);
    }
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

    // Determine level base color according to percentage:
    // 1. Red if disabled or empty
    // 2. Yellow if at or below low threshold (default 25%)
    // 3. Green if full / normal
    let levelColor = props.fuelBarColor;
    if (!props.fuelEnabled || empty) {
      levelColor = props.fuelBarEmptyColor;
    } else if (fraction <= (props.fuelBarLowThreshold ?? 0.25)) {
      levelColor = props.fuelBarLowColor;
    }

    // When refuel is active, blink/pulse between the level color and active color (#00ff11)
    let barColorHex = levelColor;
    let emissiveIntensity = Math.max(0, props.fuelBarEmissive ?? 0.8);

    if (active) {
      const pulseT = (Math.sin(this.time * 10) + 1) * 0.5;
      const cLevel = new THREE.Color(levelColor);
      const cActive = new THREE.Color(props.fuelBarActiveColor || '#00ff11');
      cLevel.lerp(cActive, pulseT);
      barColorHex = `#${cLevel.getHexString()}`;
      emissiveIntensity *= 0.7 + 0.7 * pulseT;
    }

    // 1. Reserve Bar positioning, sizing and fill
    const showBar = props.showFuelIndicator && props.showFuelBar;
    this.barRoot.visible = showBar;

    // Avoid overriding position and rotation while user is dragging gizmo
    if (!this.barRoot.userData.isGizmoDragging) {
      this.barRoot.position.set(props.fuelBarOffsetX, this.dims.y / 2 + props.fuelBarOffsetY, props.fuelBarOffsetZ);
      this.barRoot.rotation.set(
        THREE.MathUtils.degToRad(props.fuelBarRotationX || 0),
        THREE.MathUtils.degToRad(props.fuelBarRotationY || 0),
        THREE.MathUtils.degToRad(props.fuelBarRotationZ || 0)
      );
    }

    const W = Math.max(0.01, props.fuelBarWidth);
    const H = Math.max(0.01, props.fuelBarHeight);
    const D = Math.max(0.01, props.fuelBarDepth);

    this.barBackground.scale.set(W, H, D);
    this.barBackground.position.set(0, 0, 0);
    this.barBackground.visible = props.fuelBarBgVisible;
    const bgMat = this.barBackground.material as THREE.MeshBasicMaterial;
    bgMat.color.set(props.fuelBarBgColor || '#071b18');
    bgMat.opacity = Math.max(0, Math.min(1, props.fuelBarBgOpacity ?? 0.35));

    if (this.barEdges) {
      this.barEdges.scale.set(W, H, D);
      this.barEdges.position.set(0, 0, 0);
      this.barEdges.visible = props.fuelBarBgVisible && props.fuelBarBorderVisible !== false;
      (this.barEdges.material as THREE.LineBasicMaterial).color.set(barColorHex);
    }

    // Directional filling calculation
    const dir = props.fuelBarDirection || 'horizontal';
    let fillW = W;
    let fillH = H;
    let fillD = D;
    let posX = 0;
    let posY = 0;
    let posZ = 0;

    if (dir === 'vertical') {
      // Bottom to Top (ideal for vertical pillars, totems, and pumps)
      fillW = W * 0.96;
      fillH = Math.max(0.001, H * fraction);
      fillD = D * 1.02;
      posX = 0;
      posY = -H / 2 + fillH / 2;
      posZ = 0;
    } else if (dir === 'vertical-tb') {
      // Top to Bottom
      fillW = W * 0.96;
      fillH = Math.max(0.001, H * fraction);
      fillD = D * 1.02;
      posX = 0;
      posY = H / 2 - fillH / 2;
      posZ = 0;
    } else if (dir === 'horizontal-rl') {
      // Right to Left
      fillW = Math.max(0.001, W * fraction);
      fillH = H * 0.96;
      fillD = D * 1.02;
      posX = W / 2 - fillW / 2;
      posY = 0;
      posZ = 0;
    } else {
      // Default: Horizontal Left to Right
      fillW = Math.max(0.001, W * fraction);
      fillH = H * 0.96;
      fillD = D * 1.02;
      posX = -W / 2 + fillW / 2;
      posY = 0;
      posZ = 0;
    }

    this.bar.scale.set(fillW, fillH, fillD);
    this.bar.position.set(posX, posY, posZ);
    this.bar.visible = fraction > 1e-6;

    const barMat = this.bar.material as THREE.MeshStandardMaterial;
    barMat.color.set(barColorHex);
    barMat.emissive.set(barColorHex);
    barMat.emissiveIntensity = emissiveIntensity;

    // 2. Pulse effect
    this.pulse.visible = props.showFuelEffects && active;
    this.pulse.scale.setScalar(this.burst > 0 ? 1 + (1 - this.burst / .45) * 1.8 : 1 + Math.sin(this.time * 9) * .06);
    (this.pulse.material as THREE.MeshBasicMaterial).opacity = this.burst > 0 ? this.burst / .45 : .45;

    // 3. Streams start point emerges from the fuel bar if visible, or center top
    const targets = worldTargets.slice(0, 8).map(point => this.zone.worldToLocal(point.clone()));
    const start = showBar ? this.barRoot.position.clone() : new THREE.Vector3(0, this.dims.y / 2 + .1, 0);
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

    // 4. Floating indicator label positioning and scale
    if (this.label && this.canvas) {
      const lines = fuelZoneTextLines(props, active);
      this.label.visible = props.showFuelIndicator && lines.length > 0;
      if (!this.label.userData.isGizmoDragging) {
        this.label.position.set(
          props.fuelIndicatorOffsetX,
          this.dims.y / 2 + props.fuelIndicatorOffsetY,
          props.fuelIndicatorOffsetZ
        );
      }

      const baseScale = Math.max(0.1, props.fuelIndicatorScale || 1.0);
      const height = Math.max(1, lines.length) * 52 + 24;
      this.label.scale.set(3.8 * baseScale, (3.8 * height / 768) * baseScale, 1);

      const labelColor = active ? (props.fuelBarActiveColor || '#00ff11') : levelColor;
      const text = `${lines.join('|')}|${labelColor}`;
      if (text !== this.lastText) {
        this.lastText = text;
        this.canvas.height = height;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 768, height); ctx.fillStyle = 'rgba(7,25,29,.92)'; ctx.fillRect(0, 0, 768, height);
          ctx.strokeStyle = labelColor; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 762, height - 6);
          ctx.textAlign = 'center'; ctx.fillStyle = '#d5eee7'; ctx.font = 'bold 30px sans-serif';
          lines.forEach((line, index) => ctx.fillText(line, 384, 48 + index * 52, 736));
          (this.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
        }
      }
    }
  }
  dispose() {
    this.border.geometry.dispose();
    (this.border.material as THREE.Material).dispose();
    this.pulse.geometry.dispose();
    (this.pulse.material as THREE.Material).dispose();
    this.barBackground.geometry.dispose();
    (this.barBackground.material as THREE.Material).dispose();
    this.barEdges.geometry.dispose();
    (this.barEdges.material as THREE.Material).dispose();
    (this.bar.material as THREE.Material).dispose();
    if (this.label) {
      this.label.geometry.dispose();
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      (this.label.material as THREE.Material).dispose();
    }
    for (const streak of this.streams) {
      streak.geometry.dispose();
      (streak.material as THREE.Material).dispose();
    }
    this.root.removeFromParent();
  }
}

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
  readonly labelRoot = new THREE.Group();
  private barBackground: THREE.Mesh;
  private barEdges: THREE.LineSegments;
  private bar: THREE.Mesh;
  private border: THREE.InstancedMesh;
  private pulse: THREE.Mesh;
  private streams: THREE.Mesh[] = [];
  private spriteLabel?: THREE.Sprite;
  private surfaceMesh?: THREE.Mesh;
  private canvas?: HTMLCanvasElement;
  private texture?: THREE.CanvasTexture;
  private lastText = '';
  private borderLayout = '';
  private time = 0;
  private burst = 0;
  private wasActive = false;

  get label(): THREE.Object3D {
    return this.labelRoot;
  }

  constructor(private zone: THREE.Object3D, private dims: {x: number; y: number; z: number}) {
    this.dims = { ...dims };
    this.root.name = 'fuel-zone-indicator';
    this.border = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0x42ffd2, transparent: true, opacity: .75, depthWrite: false}), 12);
    this.border.name = 'fuel-zone-border'; this.border.frustumCulled = false;
    this.border.userData.ignoreRaycast = true;
    this.root.add(this.border);

    // Ripple pulse torus placed at the bottom floor surface of the zone (-dims.y / 2)
    this.pulse = new THREE.Mesh(new THREE.TorusGeometry(Math.min(dims.x, dims.z) * .3, .025, 6, 48),
      new THREE.MeshBasicMaterial({color: 0x74fff0, transparent: true, opacity: 0, depthWrite: false}));
    this.pulse.rotation.x = Math.PI / 2; this.pulse.position.y = -dims.y / 2 + .04;
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

    // Fuel indicator container (supports billboard camera-facing and fixed 3D surface plane)
    this.labelRoot.name = 'fuel-zone-label-root';
    this.labelRoot.userData.isFuelIndicator = true;

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1024;
      this.canvas.height = 512;
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;

      // 1. Sprite for billboard mode (always faces camera)
      const spriteMat = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false
      });
      this.spriteLabel = new THREE.Sprite(spriteMat);
      this.spriteLabel.name = 'fuel-zone-sprite-label';
      this.spriteLabel.userData.isFuelIndicator = true;
      this.labelRoot.add(this.spriteLabel);

      // 2. Plane mesh for fixed surface mode (stays fixed on walls/floors, honors 3D rotation)
      const planeGeo = new THREE.PlaneGeometry(1, 1);
      const meshMat = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.surfaceMesh = new THREE.Mesh(planeGeo, meshMat);
      this.surfaceMesh.name = 'fuel-zone-surface-label';
      this.surfaceMesh.userData.isFuelIndicator = true;
      this.labelRoot.add(this.surfaceMesh);

      this.labelRoot.position.set(0, dims.y / 2 + .85, 0);
      this.root.add(this.labelRoot);
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
    this.pulse.position.y = -this.dims.y / 2 + .04;

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

    // 2. Pulse effect - emerges from bottom floor of zone
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

    // 4. Floating / Surface indicator label positioning, dimensions and rendering
    if (this.canvas && this.texture) {
      const isSurface = props.fuelIndicatorMode === 'surface';
      if (this.spriteLabel) this.spriteLabel.visible = !isSurface;
      if (this.surfaceMesh) this.surfaceMesh.visible = isSurface;

      const lines = fuelZoneTextLines(props, active);
      this.labelRoot.visible = props.showFuelIndicator && lines.length > 0;

      if (!this.labelRoot.userData.isGizmoDragging) {
        this.labelRoot.position.set(
          props.fuelIndicatorOffsetX,
          this.dims.y / 2 + props.fuelIndicatorOffsetY,
          props.fuelIndicatorOffsetZ
        );
        this.labelRoot.rotation.set(
          THREE.MathUtils.degToRad(props.fuelIndicatorRotationX || 0),
          THREE.MathUtils.degToRad(props.fuelIndicatorRotationY || 0),
          THREE.MathUtils.degToRad(props.fuelIndicatorRotationZ || 0)
        );
      }

      const indW = Math.max(0.1, props.fuelIndicatorWidth || 2.8);
      const indH = Math.max(0.1, props.fuelIndicatorHeight || 1.4);
      this.labelRoot.scale.set(indW, indH, 1);

      const labelColor = active ? (props.fuelBarActiveColor || '#00ff11') : levelColor;
      const text = `${lines.join('|')}|${labelColor}`;
      if (text !== this.lastText) {
        this.lastText = text;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 1024, 512);

          // Sleek futuristic card with rounded corners and glowing border
          const pad = 24;
          const cardW = 1024 - pad * 2;
          const cardH = 512 - pad * 2;
          const radius = 28;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pad + radius, pad);
          ctx.lineTo(pad + cardW - radius, pad);
          ctx.quadraticCurveTo(pad + cardW, pad, pad + cardW, pad + radius);
          ctx.lineTo(pad + cardW, pad + cardH - radius);
          ctx.quadraticCurveTo(pad + cardW, pad + cardH, pad + cardW - radius, pad + cardH);
          ctx.lineTo(pad + radius, pad + cardH);
          ctx.quadraticCurveTo(pad, pad + cardH, pad, pad + cardH - radius);
          ctx.lineTo(pad, pad + radius);
          ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
          ctx.closePath();

          // Dark sci-fi translucent glass card fill
          ctx.fillStyle = 'rgba(7, 24, 28, 0.92)';
          ctx.fill();

          // Outer glow border without internal divider lines
          ctx.lineWidth = 10;
          ctx.strokeStyle = labelColor;
          ctx.shadowColor = labelColor;
          ctx.shadowBlur = 18;
          ctx.stroke();
          ctx.restore();

          // Typography with clean vertical centering
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = 512;
          const centerY = 256;

          if (lines.length === 1) {
            ctx.fillStyle = labelColor;
            ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = labelColor;
            ctx.shadowBlur = 12;
            ctx.fillText(lines[0], centerX, centerY, 920);
          } else if (lines.length === 2) {
            ctx.fillStyle = labelColor;
            ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = labelColor;
            ctx.shadowBlur = 10;
            ctx.fillText(lines[0], centerX, centerY - 55, 920);

            ctx.fillStyle = '#d5eee7';
            ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
            ctx.shadowBlur = 0;
            ctx.fillText(lines[1], centerX, centerY + 55, 920);
          } else if (lines.length >= 3) {
            ctx.fillStyle = labelColor;
            ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = labelColor;
            ctx.shadowBlur = 10;
            ctx.fillText(lines[0], centerX, centerY - 100, 920);

            ctx.fillStyle = '#d5eee7';
            ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
            ctx.shadowBlur = 0;
            ctx.fillText(lines[1], centerX, centerY, 920);

            ctx.fillStyle = '#7de8d3';
            ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
            ctx.shadowBlur = 0;
            ctx.fillText(lines[2], centerX, centerY + 95, 920);
          }

          this.texture.needsUpdate = true;
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
    if (this.spriteLabel) {
      this.spriteLabel.geometry.dispose();
      (this.spriteLabel.material as THREE.Material).dispose();
    }
    if (this.surfaceMesh) {
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
    }
    if (this.texture) {
      this.texture.dispose();
    }
    this.labelRoot.removeFromParent();
    for (const streak of this.streams) {
      streak.geometry.dispose();
      (streak.material as THREE.Material).dispose();
    }
    this.root.removeFromParent();
  }
}

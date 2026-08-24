import * as THREE from 'three';
import { isMotorbikeBroken } from './VehicleDurability';
import { vehicleUp } from './VehicleGravity';
import type { MotorbikeVisual } from './MotorbikeModel';

type Surface = { color?: THREE.Color; emissive?: THREE.Color; intensity?: number; roughness?: number };
interface EffectState {
  flash: number;
  burn: number;
  broken: boolean;
  materials: Map<THREE.Material, Surface>;
  smoke?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  particles: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; age: number; life: number }>;
  emission: number;
}

/** Material pulses never hide the collider or detach the seats. Smoke follows the gravity axis. */
export class VehicleDamageEffects {
  private states = new Map<MotorbikeVisual, EffectState>();
  constructor(private scene: THREE.Scene) {}

  private state(bike: MotorbikeVisual) {
    let state = this.states.get(bike);
    if (!state) {
      state = { flash: 0, burn: 0, broken: false, materials: new Map(), particles: [], emission: 0 };
      this.states.set(bike, state);
    }
    return state;
  }
  hit(bike: MotorbikeVisual) { this.state(bike).flash = 0.48; }

  private createSmoke(state: EffectState) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    geometry.setAttribute('smokeSize', new THREE.BufferAttribute(new Float32Array(48), 1));
    geometry.setAttribute('smokeAlpha', new THREE.BufferAttribute(new Float32Array(48), 1));
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float smokeSize; attribute float smokeAlpha; varying float alpha;
        void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); alpha = smokeAlpha;
          gl_Position = projectionMatrix * p; gl_PointSize = min(180.0, smokeSize * 280.0 / max(0.1, -p.z)); }`,
      fragmentShader: `varying float alpha; void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        float soft = 1.0 - smoothstep(0.2, 1.0, radius);
        gl_FragColor = vec4(mix(vec3(0.12), vec3(0.32), radius), alpha * soft);
      }`
    });
    state.smoke = new THREE.Points(geometry, material);
    state.smoke.name = 'motorbike-destroyed-smoke';
    state.smoke.userData.ignoreRaycast = true;
    state.smoke.frustumCulled = false;
    this.scene.add(state.smoke);
  }

  private emit(bike: MotorbikeVisual, state: EffectState, count: number) {
    const dims = bike.userData.originalScale;
    const up = vehicleUp(bike);
    for (let i = 0; i < count && state.particles.length < 48; i++) {
      const position = new THREE.Vector3((Math.random() - 0.5) * dims.x * 0.4, dims.y * 0.1, dims.z * 0.05)
        .applyQuaternion(bike.quaternion).add(bike.position);
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .projectOnPlane(up).multiplyScalar(0.28).addScaledVector(up, 0.7 + Math.random() * 0.7);
      state.particles.push({ position, velocity, age: 0, life: 1.8 + Math.random() * 1.1 });
    }
  }

  update(bikes: MotorbikeVisual[], dt: number) {
    const present = new Set(bikes);
    for (const bike of bikes) {
      if (bike.userData.logicProperties?.durabilityEnabled !== true) {
        const existing = this.states.get(bike);
        if (existing) this.release(bike, existing);
        continue;
      }
      const broken = isMotorbikeBroken(bike.userData.logicProperties);
      if (!broken && !this.states.has(bike)) continue;
      const state = this.state(bike);
      if (broken && !state.broken) {
        this.createSmoke(state);
        this.emit(bike, state, 12);
      }
      if (!broken && state.smoke) {
        state.smoke.removeFromParent();
        state.smoke.geometry.dispose();
        state.smoke.material.dispose();
        state.smoke = undefined;
        state.particles = [];
        state.emission = 0;
      }
      state.broken = broken;
      state.flash = Math.max(0, state.flash - dt);
      state.burn = broken ? Math.min(1, state.burn + dt / 0.7) : 0;
      const flash = state.flash > 0 && Math.floor(state.flash / 0.08) % 2 === 1;
      // GLB materials may arrive after the bike has already received damage.
      bike.traverse((node: any) => {
        if (!node.isMesh) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!state.materials.has(material)) state.materials.set(material, {
            color: material.color?.clone(), emissive: material.emissive?.clone(),
            intensity: material.emissiveIntensity, roughness: material.roughness,
          });
          const base = state.materials.get(material)!;
          if (base.color) {
            material.color.copy(base.color).multiplyScalar(1 - state.burn * 0.85);
            if (flash) material.color.lerp(new THREE.Color(1, 0.35, 0.2), 0.8);
          }
          if (base.emissive) {
            material.emissive.copy(base.emissive).multiplyScalar(1 - state.burn);
            if (flash) material.emissive.setRGB(1, 0.12, 0.03);
            material.emissiveIntensity = flash ? 1.5 : base.intensity;
          }
          if (base.roughness !== undefined) material.roughness = THREE.MathUtils.lerp(base.roughness, 0.98, state.burn);
        }
      });
      if (broken && state.smoke) {
        state.emission += dt;
        while (state.emission >= 0.08) { this.emit(bike, state, 1); state.emission -= 0.08; }
        state.particles = state.particles.filter(p => (p.age += dt) < p.life);
        state.particles.forEach((p, i) => {
          p.position.addScaledVector(p.velocity, dt);
          state.smoke!.geometry.attributes.position.setXYZ(i, p.position.x, p.position.y, p.position.z);
          state.smoke!.geometry.attributes.smokeSize.setX(i, 0.35 + p.age * 0.65);
          state.smoke!.geometry.attributes.smokeAlpha.setX(i, Math.min(1, p.age / 0.15) * (1 - p.age / p.life) * 0.45);
        });
        for (const attribute of Object.values(state.smoke.geometry.attributes)) attribute.needsUpdate = true;
        state.smoke.geometry.setDrawRange(0, state.particles.length);
      }
      if (!broken && state.flash <= 0) this.release(bike, state);
    }
    for (const [bike, state] of this.states) if (!present.has(bike) || !bike.parent) this.release(bike, state);
  }

  private release(bike: MotorbikeVisual, state: EffectState) {
    for (const [material, base] of state.materials) {
      const mat = material as THREE.MeshStandardMaterial;
      if (base.color) mat.color.copy(base.color);
      if (base.emissive) mat.emissive.copy(base.emissive);
      if (base.intensity !== undefined) mat.emissiveIntensity = base.intensity;
      if (base.roughness !== undefined) mat.roughness = base.roughness;
    }
    state.smoke?.removeFromParent();
    state.smoke?.geometry.dispose();
    state.smoke?.material.dispose();
    this.states.delete(bike);
  }
  dispose() { for (const [bike, state] of this.states) this.release(bike, state); }
}

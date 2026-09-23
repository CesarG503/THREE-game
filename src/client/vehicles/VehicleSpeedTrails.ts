import * as THREE from 'three';
import type { MotorbikeVisual } from './MotorbikeModel';
import { normalizeMotorbikeSettings } from './MotorbikeSettings';

interface TrailHistoryPoint {
  position: THREE.Vector3;
  age: number; // in seconds
}

interface Streamline {
  socketOffset: THREE.Vector3;
  history: TrailHistoryPoint[];
}

interface BikeTrailData {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  streamlines: Streamline[];
  intensity: number;
}

export class VehicleSpeedTrails {
  private trailsByBike = new WeakMap<MotorbikeVisual, BikeTrailData>();
  private allTrackedBikes = new Set<MotorbikeVisual>();
  private maxPointsPerTrail = 18;

  constructor(private scene: THREE.Scene) {}

  private parseHexColor(hex: string): THREE.Color {
    try {
      return new THREE.Color(hex);
    } catch {
      return new THREE.Color(0xd4ecff);
    }
  }

  private getOrCreateBikeTrails(bike: MotorbikeVisual, props: any): BikeTrailData {
    let data = this.trailsByBike.get(bike);
    if (!data) {
      const geometry = new THREE.BufferGeometry();
      const maxTrails = 12;
      const maxVerts = maxTrails * this.maxPointsPerTrail * 2;
      const maxIndices = maxTrails * (this.maxPointsPerTrail - 1) * 6;

      const positions = new Float32Array(maxVerts * 3);
      const colors = new Float32Array(maxVerts * 3);
      const indices = new Uint16Array(maxIndices);

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.setDrawRange(0, 0);

      const colorHex = props.speedTrailsColor || props.speedEffectColor || '#d4ecff';
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `speed_trails_${bike.userData.uuid || 'bike'}`;
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      data = {
        mesh,
        geometry,
        material,
        streamlines: [],
        intensity: 0
      };

      this.trailsByBike.set(bike, data);
      this.allTrackedBikes.add(bike);
    }
    return data;
  }

  private getSocketOffsets(bike: MotorbikeVisual, props: any, targetCount: number): THREE.Vector3[] {
    const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };
    const seatZ = Number(props.seatOffsetZ ?? 0.22);
    const seatH = Number(props.seatHeight ?? 1.02);
    const halfX = dims.x * 0.46;
    const frontZ = -dims.z * 0.36;
    const rearZ = dims.z * 0.44;

    const list: THREE.Vector3[] = [
      // 0, 1: Rider shoulders (streamlines flowing off character)
      new THREE.Vector3(-0.22, seatH + 0.35, seatZ),
      new THREE.Vector3( 0.22, seatH + 0.35, seatZ),
      // 2, 3: Bike front fairing / handlebars
      new THREE.Vector3(-halfX, dims.y * 0.35, frontZ),
      new THREE.Vector3( halfX, dims.y * 0.35, frontZ),
      // 4, 5: Bike rear tail
      new THREE.Vector3(-halfX * 0.75, dims.y * 0.22, rearZ),
      new THREE.Vector3( halfX * 0.75, dims.y * 0.22, rearZ),
      // 6: Rider helmet apex
      new THREE.Vector3(0.0, seatH + 0.60, seatZ - 0.06),
      // 7: Front nose center
      new THREE.Vector3(0.0, dims.y * 0.45, -dims.z * 0.46),
      // 8, 9: Lower chassis flanks
      new THREE.Vector3(-halfX * 0.9, -dims.y * 0.1, 0.1),
      new THREE.Vector3( halfX * 0.9, -dims.y * 0.1, 0.1),
      // 10, 11: Rear wheel hub
      new THREE.Vector3(-halfX * 0.5, -dims.y * 0.2, rearZ * 0.9),
      new THREE.Vector3( halfX * 0.5, -dims.y * 0.2, rearZ * 0.9),
    ];

    return list.slice(0, Math.max(2, Math.min(list.length, targetCount)));
  }

  /**
   * Updates 3D physical speed trails for all active motorbikes in the scene.
   * Runs for both local and remote bikes so all players can see each other's speed trails!
   */
  update(bikes: MotorbikeVisual[], delta: number, camera?: THREE.Camera) {
    const dt = Math.min(0.1, Math.max(0, delta));
    const camPos = camera ? camera.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 5, 10);

    for (const bike of bikes) {
      if (!bike || !bike.parent || !bike.visible || bike.userData.invisible) {
        this.clearBikeTrails(bike);
        continue;
      }

      const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
      const enabled = props.speedTrailsEnabled !== false && props.speedEffectEnabled !== false;
      const threshold = Number(props.speedEffectThreshold ?? 150);
      const maxSpeed = Number(props.speedEffectMax ?? 220);
      const targetCount = Math.max(2, Math.min(12, Math.round(Number(props.speedTrailsCount ?? 6))));
      const trailLengthMeters = Math.max(0.5, Math.min(10.0, Number(props.speedTrailsLength ?? 3.5)));
      const trailWidthMeters = Math.max(0.01, Math.min(0.20, Number(props.speedTrailsWidth ?? 4) / 100));
      const colorHex = props.speedTrailsColor || props.speedEffectColor || '#d4ecff';
      const baseColor = this.parseHexColor(colorHex);

      // Determine current speed of this bike (local, remote or coasting)
      let speedMs = 0;
      if (bike.userData.vehicleMotion?.speed !== undefined) {
        speedMs = Math.abs(bike.userData.vehicleMotion.speed);
      } else {
        const body = bike.userData.rigidBody;
        if (body?.isValid()) {
          const vel = body.linvel();
          speedMs = Math.hypot(vel.x, vel.z);
        }
      }
      const speedKmh = speedMs * 3.6;

      const data = this.getOrCreateBikeTrails(bike, props);

      // Target intensity calculation
      let targetIntensity = 0;
      if (enabled && speedKmh >= threshold) {
        const range = Math.max(10, maxSpeed - threshold);
        targetIntensity = Math.min(1.0, (speedKmh - threshold) / range);
      }

      // Smooth intensity interpolation
      const lerpRate = targetIntensity > data.intensity ? 4.5 : 3.0;
      data.intensity += (targetIntensity - data.intensity) * (1 - Math.exp(-lerpRate * dt));

      if (data.intensity < 0.01) {
        data.intensity = 0;
        data.geometry.setDrawRange(0, 0);
        for (const s of data.streamlines) s.history.length = 0;
        continue;
      }

      // Sockets
      const socketOffsets = this.getSocketOffsets(bike, props, targetCount);
      while (data.streamlines.length < socketOffsets.length) {
        const idx = data.streamlines.length;
        data.streamlines.push({ socketOffset: socketOffsets[idx], history: [] });
      }
      if (data.streamlines.length > socketOffsets.length) {
        data.streamlines.length = socketOffsets.length;
      }
      for (let i = 0; i < socketOffsets.length; i++) {
        data.streamlines[i].socketOffset.copy(socketOffsets[i]);
      }

      // Max lifetime of trail points based on speed & desired trail length in meters
      const effectiveSpeed = Math.max(20, speedMs);
      const maxTrailLife = Math.max(0.08, trailLengthMeters / effectiveSpeed);

      // Sample new positions and age existing points
      for (const line of data.streamlines) {
        // Age points
        for (let j = line.history.length - 1; j >= 0; j--) {
          line.history[j].age += dt;
          if (line.history[j].age > maxTrailLife) {
            line.history.splice(j, 1);
          }
        }

        // Add current socket world position
        const currentWorldPos = line.socketOffset.clone().applyMatrix4(bike.matrixWorld);
        const last = line.history[0];
        // Only add point if moved at least 5cm from last sample
        if (!last || last.position.distanceToSquared(currentWorldPos) > 0.0025) {
          line.history.unshift({ position: currentWorldPos, age: 0 });
          if (line.history.length > this.maxPointsPerTrail) {
            line.history.length = this.maxPointsPerTrail;
          }
        } else {
          last.position.copy(currentWorldPos);
        }
      }

      // Rebuild 3D Ribbon geometry
      const posAttr = data.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = data.geometry.getAttribute('color') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;
      const indexAttr = data.geometry.getIndex()!;
      const indexArr = indexAttr.array as Uint16Array;

      let vertOffset = 0;
      let indexOffset = 0;

      const bikeForward = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.quaternion).normalize();
      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bike.quaternion).normalize();

      for (const line of data.streamlines) {
        const pts = line.history;
        if (pts.length < 2) continue;

        const startVertIndex = vertOffset / 3;

        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i].position;
          const progress = i / (pts.length - 1); // 0 at contact, 1 at tail

          // Tangent calculation
          let tangent: THREE.Vector3;
          if (i === 0) {
            tangent = pt.clone().sub(pts[1].position).normalize();
          } else if (i === pts.length - 1) {
            tangent = pts[i - 1].position.clone().sub(pt).normalize();
          } else {
            tangent = pts[i - 1].position.clone().sub(pts[i + 1].position).normalize();
          }
          if (tangent.lengthSq() < 0.001) tangent.copy(bikeForward);

          // Billboard normal facing the active camera
          const viewDir = camPos.clone().sub(pt);
          let normal = new THREE.Vector3().crossVectors(tangent, viewDir);
          if (normal.lengthSq() < 0.0001) {
            normal.crossVectors(tangent, bikeUp);
          }
          normal.normalize();

          // Ribbon width tapering: fine at tip, full width in body, tapering at tail
          const widthEnvelope = Math.sin((1.0 - progress * 0.95) * Math.PI * 0.5);
          const currentHalfWidth = (trailWidthMeters * 0.5) * widthEnvelope * (0.6 + data.intensity * 0.5);

          const left = pt.clone().sub(normal.clone().multiplyScalar(currentHalfWidth));
          const right = pt.clone().add(normal.clone().multiplyScalar(currentHalfWidth));

          posArr[vertOffset] = left.x;
          posArr[vertOffset + 1] = left.y;
          posArr[vertOffset + 2] = left.z;

          posArr[vertOffset + 3] = right.x;
          posArr[vertOffset + 4] = right.y;
          posArr[vertOffset + 5] = right.z;

          // Color fade from head to tail with additive blending
          const lifeFade = Math.max(0, 1.0 - (pts[i].age / maxTrailLife));
          const fade = Math.pow(lifeFade, 1.4) * data.intensity;

          // Blend with white core at front
          const coreMix = Math.max(0, 1.0 - progress * 2.5);
          const r = (baseColor.r * (1 - coreMix) + 1.0 * coreMix) * fade;
          const g = (baseColor.g * (1 - coreMix) + 1.0 * coreMix) * fade;
          const b = (baseColor.b * (1 - coreMix) + 1.0 * coreMix) * fade;

          colArr[vertOffset] = r;
          colArr[vertOffset + 1] = g;
          colArr[vertOffset + 2] = b;

          colArr[vertOffset + 3] = r;
          colArr[vertOffset + 4] = g;
          colArr[vertOffset + 5] = b;

          vertOffset += 6;
        }

        // Indices for quad strip
        const quadCount = pts.length - 1;
        for (let q = 0; q < quadCount; q++) {
          const v0 = startVertIndex + q * 2;
          const v1 = v0 + 1;
          const v2 = v0 + 2;
          const v3 = v0 + 3;

          indexArr[indexOffset] = v0;
          indexArr[indexOffset + 1] = v1;
          indexArr[indexOffset + 2] = v2;

          indexArr[indexOffset + 3] = v2;
          indexArr[indexOffset + 4] = v1;
          indexArr[indexOffset + 5] = v3;

          indexOffset += 6;
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      indexAttr.needsUpdate = true;
      data.geometry.setDrawRange(0, indexOffset);
    }
  }

  private clearBikeTrails(bike: MotorbikeVisual) {
    const data = this.trailsByBike.get(bike);
    if (data) {
      data.geometry.setDrawRange(0, 0);
      for (const s of data.streamlines) s.history.length = 0;
    }
  }

  removeBike(bike: MotorbikeVisual) {
    const data = this.trailsByBike.get(bike);
    if (data) {
      data.geometry.dispose();
      data.material.dispose();
      this.scene.remove(data.mesh);
      this.trailsByBike.delete(bike);
      this.allTrackedBikes.delete(bike);
    }
  }

  dispose() {
    for (const bike of this.allTrackedBikes) {
      this.removeBike(bike);
    }
    this.allTrackedBikes.clear();
  }
}

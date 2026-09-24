import * as THREE from 'three';
import type { MotorbikeVisual } from './MotorbikeModel';
import { normalizeMotorbikeSettings } from './MotorbikeSettings';

interface TrailHistoryPoint {
  position: THREE.Vector3;
  age: number; // in seconds
}

interface Streamline {
  socketIndex: number;
  socketOffset: THREE.Vector3;
  jitterOffset: THREE.Vector3;
  history: TrailHistoryPoint[];
  age: number;
  lifetime: number;
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
  private maxPointsPerTrail = 20;

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
      const maxTrails = 16;
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

  /**
   * Generates candidate sockets around the vehicle and character.
   * Accurately accounts for rider forward lean so upper trails start directly on the character.
   */
  private getCandidateSockets(bike: MotorbikeVisual, props: any, hasRider: boolean): { id: string; offset: THREE.Vector3; isRider: boolean }[] {
    const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };
    const seatZ = Number(props.seatOffsetZ ?? 0.22);
    const seatH = Number(props.seatHeight ?? 1.02);
    const halfX = dims.x * 0.46;
    const frontZ = -dims.z * 0.36;
    const rearZ = dims.z * 0.42;

    // When rider leans forward holding the handlebars, their shoulders and head
    // move significantly forward along -Z (around 32cm to 42cm ahead of seat center).
    const shoulderZ = seatZ - 0.34;
    const headZ = seatZ - 0.44;
    const backZ = seatZ - 0.16;

    const list: { id: string; offset: THREE.Vector3; isRider: boolean }[] = [];

    if (hasRider) {
      list.push(
        // Rider shoulders (direct contact with character jacket)
        { id: 'rider_shoulder_l', offset: new THREE.Vector3(-0.20, seatH + 0.16, shoulderZ), isRider: true },
        { id: 'rider_shoulder_r', offset: new THREE.Vector3( 0.20, seatH + 0.16, shoulderZ), isRider: true },
        // Rider helmet crown / apex
        { id: 'rider_helmet',     offset: new THREE.Vector3( 0.00, seatH + 0.44, headZ), isRider: true },
        // Rider upper back
        { id: 'rider_back_mid',   offset: new THREE.Vector3( 0.00, seatH + 0.18, backZ), isRider: true },
        // Rider upper back flanks
        { id: 'rider_back_l',     offset: new THREE.Vector3(-0.14, seatH + 0.14, backZ), isRider: true },
        { id: 'rider_back_r',     offset: new THREE.Vector3( 0.14, seatH + 0.14, backZ), isRider: true },
      );
    }

    // Vehicle sockets
    list.push(
      // Bike front handlebars / fairing edges
      { id: 'bike_handlebar_l', offset: new THREE.Vector3(-halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
      { id: 'bike_handlebar_r', offset: new THREE.Vector3( halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
      // Bike mirrors / upper shield
      { id: 'bike_mirror_l',    offset: new THREE.Vector3(-halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
      { id: 'bike_mirror_r',    offset: new THREE.Vector3( halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
      // Bike front nose tip
      { id: 'bike_front_nose',  offset: new THREE.Vector3( 0.00, dims.y * 0.40, -dims.z * 0.46), isRider: false },
      // Bike rear tail edges
      { id: 'bike_tail_l',      offset: new THREE.Vector3(-halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
      { id: 'bike_tail_r',      offset: new THREE.Vector3( halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
      // Bike tail top fin
      { id: 'bike_tail_top',    offset: new THREE.Vector3( 0.00, dims.y * 0.28, rearZ * 0.96), isRider: false },
      // Lower flanks / side pods
      { id: 'bike_flank_l',     offset: new THREE.Vector3(-halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
      { id: 'bike_flank_r',     offset: new THREE.Vector3( halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
    );

    return list;
  }

  /**
   * Updates 3D physical speed trails for all active motorbikes in the scene.
   * Runs for both local and remote bikes so all players see them in real time!
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
      const isDynamic = props.speedTrailsDynamic !== false;
      const threshold = Number(props.speedEffectThreshold ?? 150);
      const maxSpeed = Number(props.speedEffectMax ?? 220);
      const targetCount = Math.max(2, Math.min(12, Math.round(Number(props.speedTrailsCount ?? 6))));
      const trailLengthMeters = Math.max(0.5, Math.min(10.0, Number(props.speedTrailsLength ?? 3.5)));
      const trailWidthMeters = Math.max(0.01, Math.min(0.20, Number(props.speedTrailsWidth ?? 4) / 100));
      const burstInterval = Math.max(0.04, Math.min(0.60, Number(props.speedTrailsInterval ?? 0.14)));
      const colorHex = props.speedTrailsColor || props.speedEffectColor || '#d4ecff';
      const baseColor = this.parseHexColor(colorHex);

      // Determine current speed
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

      const hasRider = Boolean(bike.userData.vehicleDriver || bike.userData.vehiclePassenger || (bike as any).userData?.isMounted);
      const candidateSockets = this.getCandidateSockets(bike, props, hasRider);

      // Ensure streamlines array matches targetCount
      while (data.streamlines.length < targetCount) {
        const idx = data.streamlines.length;
        const sockIdx = isDynamic ? Math.floor(Math.random() * candidateSockets.length) : (idx % candidateSockets.length);
        const sock = candidateSockets[sockIdx];
        const life = burstInterval * (0.75 + Math.random() * 0.5);
        data.streamlines.push({
          socketIndex: sockIdx,
          socketOffset: sock.offset.clone(),
          jitterOffset: new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04),
          history: [],
          age: Math.random() * life, // stagger start times
          lifetime: life
        });
      }
      if (data.streamlines.length > targetCount) {
        data.streamlines.length = targetCount;
      }

      // Max lifetime of trail points based on physical speed & desired trail length in meters
      const effectiveSpeed = Math.max(22, speedMs);
      const maxTrailLife = Math.max(0.06, trailLengthMeters / effectiveSpeed);

      // Update each streamline
      for (let sIdx = 0; sIdx < data.streamlines.length; sIdx++) {
        const line = data.streamlines[sIdx];

        if (isDynamic) {
          line.age += dt * (1.0 + data.intensity * 0.6);
          // If burst lifetime has completed, pick a NEW random socket and restart cleanly!
          if (line.age >= line.lifetime) {
            line.history.length = 0; // Clear history so no connection to previous spot
            // Pick a different socket
            let newSockIdx = Math.floor(Math.random() * candidateSockets.length);
            if (candidateSockets.length > 1 && newSockIdx === line.socketIndex) {
              newSockIdx = (newSockIdx + 1) % candidateSockets.length;
            }
            line.socketIndex = newSockIdx;
            line.jitterOffset.set(
              (Math.random() - 0.5) * 0.05,
              (Math.random() - 0.5) * 0.05,
              (Math.random() - 0.5) * 0.05
            );
            line.age = 0;
            line.lifetime = burstInterval * (0.75 + Math.random() * 0.5);
          }
        } else {
          // Continuous mode: lock to steady sockets
          line.socketIndex = sIdx % candidateSockets.length;
          line.jitterOffset.set(0, 0, 0);
          line.age = 0;
          line.lifetime = 1.0;
        }

        const currentSocket = candidateSockets[line.socketIndex % candidateSockets.length];
        line.socketOffset.copy(currentSocket.offset).add(line.jitterOffset);

        // Age existing history points
        for (let j = line.history.length - 1; j >= 0; j--) {
          line.history[j].age += dt;
          if (line.history[j].age > maxTrailLife) {
            line.history.splice(j, 1);
          }
        }

        // Sample current socket in world coordinates
        const currentWorldPos = line.socketOffset.clone().applyMatrix4(bike.matrixWorld);
        const last = line.history[0];
        // Only sample if moved at least 4 cm
        if (!last || last.position.distanceToSquared(currentWorldPos) > 0.0016) {
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

        // Dynamic burst alpha envelope (smooth fade-in and fade-out)
        let burstFactor = 1.0;
        if (isDynamic) {
          const progress = Math.min(1.0, Math.max(0, line.age / line.lifetime));
          burstFactor = Math.sin(progress * Math.PI);
        }

        const startVertIndex = vertOffset / 3;

        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i].position;
          const progress = i / (pts.length - 1); // 0 at origin, 1 at tail

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

          // Ribbon width tapering: fine at tip, full in body, tapering at tail
          const widthEnvelope = Math.sin((1.0 - progress * 0.95) * Math.PI * 0.5);
          const currentHalfWidth = (trailWidthMeters * 0.5) * widthEnvelope * (0.65 + data.intensity * 0.45);

          const left = pt.clone().sub(normal.clone().multiplyScalar(currentHalfWidth));
          const right = pt.clone().add(normal.clone().multiplyScalar(currentHalfWidth));

          posArr[vertOffset] = left.x;
          posArr[vertOffset + 1] = left.y;
          posArr[vertOffset + 2] = left.z;

          posArr[vertOffset + 3] = right.x;
          posArr[vertOffset + 4] = right.y;
          posArr[vertOffset + 5] = right.z;

          // Color fade from origin to tail with additive blending
          const lifeFade = Math.max(0, 1.0 - (pts[i].age / maxTrailLife));
          const fade = Math.pow(lifeFade, 1.35) * data.intensity * burstFactor;

          // Blend with white core at origin
          const coreMix = Math.max(0, 1.0 - progress * 2.2);
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

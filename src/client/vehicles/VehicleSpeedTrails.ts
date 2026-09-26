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
  alpha: number; // 0..1 smooth dynamic envelope or 1.0 for fixed mode
}

interface FadingTrail {
  points: TrailHistoryPoint[];
  currentAlpha: number;
  initialAlpha: number;
  fadeAge: number;
  fadeDuration: number;
}

interface BikeTrailData {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  streamlines: Streamline[];
  fadingTrails: FadingTrail[];
  intensity: number;
  wasDynamic?: boolean;
}

export class VehicleSpeedTrails {
  private trailsByBike = new WeakMap<MotorbikeVisual, BikeTrailData>();
  private allTrackedBikes = new Set<MotorbikeVisual>();
  private maxPointsPerTrail = 24;

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
      const maxTrails = 32;
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
        fadingTrails: [],
        intensity: 0,
        wasDynamic: props.speedTrailsDynamic !== false
      };

      this.trailsByBike.set(bike, data);
      this.allTrackedBikes.add(bike);
    }
    return data;
  }

  /**
   * Generates candidate sockets around the vehicle and character.
   * Accurately accounts for rider forward lean so upper trails start directly on the character.
   * Sockets are grouped in symmetrical left/right pairs so fixed continuous mode produces
   * perfectly balanced aerodynamic streamlines.
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
        // Symmetrical Pair 1: Rider shoulders (direct contact with character jacket)
        { id: 'rider_shoulder_l', offset: new THREE.Vector3(-0.20, seatH + 0.16, shoulderZ), isRider: true },
        { id: 'rider_shoulder_r', offset: new THREE.Vector3( 0.20, seatH + 0.16, shoulderZ), isRider: true },
        // Symmetrical Pair 2: Bike handlebars / fairing edges
        { id: 'bike_handlebar_l', offset: new THREE.Vector3(-halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
        { id: 'bike_handlebar_r', offset: new THREE.Vector3( halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
        // Symmetrical Pair 3: Bike rear tail edges
        { id: 'bike_tail_l',      offset: new THREE.Vector3(-halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
        { id: 'bike_tail_r',      offset: new THREE.Vector3( halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
        // Central Top pair: Rider helmet apex & Bike tail top fin
        { id: 'rider_helmet',     offset: new THREE.Vector3( 0.00, seatH + 0.44, headZ), isRider: true },
        { id: 'bike_tail_top',    offset: new THREE.Vector3( 0.00, dims.y * 0.28, rearZ * 0.96), isRider: false },
        // Symmetrical Pair 4: Rider upper back flanks
        { id: 'rider_back_l',     offset: new THREE.Vector3(-0.14, seatH + 0.14, backZ), isRider: true },
        { id: 'rider_back_r',     offset: new THREE.Vector3( 0.14, seatH + 0.14, backZ), isRider: true },
        // Symmetrical Pair 5: Bike mirrors / upper shield
        { id: 'bike_mirror_l',    offset: new THREE.Vector3(-halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
        { id: 'bike_mirror_r',    offset: new THREE.Vector3( halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
        // Central Back & front nose
        { id: 'rider_back_mid',   offset: new THREE.Vector3( 0.00, seatH + 0.18, backZ), isRider: true },
        { id: 'bike_front_nose',  offset: new THREE.Vector3( 0.00, dims.y * 0.40, -dims.z * 0.46), isRider: false },
        // Lower flanks
        { id: 'bike_flank_l',     offset: new THREE.Vector3(-halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
        { id: 'bike_flank_r',     offset: new THREE.Vector3( halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
      );
    } else {
      list.push(
        // Bike handlebars
        { id: 'bike_handlebar_l', offset: new THREE.Vector3(-halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
        { id: 'bike_handlebar_r', offset: new THREE.Vector3( halfX * 0.95, dims.y * 0.36, frontZ), isRider: false },
        // Bike rear tail
        { id: 'bike_tail_l',      offset: new THREE.Vector3(-halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
        { id: 'bike_tail_r',      offset: new THREE.Vector3( halfX * 0.72, dims.y * 0.18, rearZ), isRider: false },
        // Bike mirrors
        { id: 'bike_mirror_l',    offset: new THREE.Vector3(-halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
        { id: 'bike_mirror_r',    offset: new THREE.Vector3( halfX * 1.05, dims.y * 0.44, frontZ * 1.08), isRider: false },
        // Bike top and nose
        { id: 'bike_tail_top',    offset: new THREE.Vector3( 0.00, dims.y * 0.28, rearZ * 0.96), isRider: false },
        { id: 'bike_front_nose',  offset: new THREE.Vector3( 0.00, dims.y * 0.40, -dims.z * 0.46), isRider: false },
        // Lower flanks
        { id: 'bike_flank_l',     offset: new THREE.Vector3(-halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
        { id: 'bike_flank_r',     offset: new THREE.Vector3( halfX * 0.98, dims.y * 0.04, -0.05), isRider: false },
      );
    }

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
      const customSpeed = props.speedTrailsCustomSpeed === true;
      const threshold = Number((customSpeed ? props.speedTrailsThreshold : props.speedEffectThreshold) ?? 150);
      const maxSpeed = Number((customSpeed ? props.speedTrailsMax : props.speedEffectMax) ?? 220);
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
        data.fadingTrails.length = 0;
        continue;
      }

      const hasRider = Boolean(bike.userData.vehicleDriver || bike.userData.vehiclePassenger || (bike as any).userData?.isMounted);
      const candidateSockets = this.getCandidateSockets(bike, props, hasRider);

      // Smooth mode transition when user toggles the dynamic checkbox in settings:
      // If switched from dynamic to fixed mode, move in-flight dynamic points to fadingTrails
      // so they dissolve naturally in the wind rather than snapping or stretching across sockets.
      if (data.wasDynamic && !isDynamic) {
        for (const s of data.streamlines) {
          if (s.history.length >= 2 && s.alpha > 0.05) {
            data.fadingTrails.push({
              points: s.history.map(p => ({ position: p.position.clone(), age: p.age })),
              currentAlpha: s.alpha,
              initialAlpha: s.alpha,
              fadeAge: 0,
              fadeDuration: 0.15
            });
          }
          s.history = [];
        }
        data.wasDynamic = false;
      } else if (!data.wasDynamic && isDynamic) {
        data.wasDynamic = true;
        // Stagger burst ages across the duration
        for (const s of data.streamlines) {
          s.age = Math.random() * s.lifetime;
        }
      }

      // Ensure streamlines array matches targetCount
      while (data.streamlines.length < targetCount) {
        const idx = data.streamlines.length;
        const sockIdx = isDynamic ? Math.floor(Math.random() * candidateSockets.length) : (idx % candidateSockets.length);
        const sock = candidateSockets[sockIdx];
        const life = burstInterval * (0.8 + Math.random() * 0.4);
        data.streamlines.push({
          socketIndex: sockIdx,
          socketOffset: sock.offset.clone(),
          jitterOffset: isDynamic
            ? new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04)
            : new THREE.Vector3(0, 0, 0),
          history: [],
          age: isDynamic ? Math.random() * life : 0, // stagger dynamic bursts
          lifetime: life,
          alpha: isDynamic ? 0 : 1.0
        });
      }
      if (data.streamlines.length > targetCount) {
        data.streamlines.length = targetCount;
      }

      // Max lifetime of trail points based on physical speed & desired trail length in meters
      const effectiveSpeed = Math.max(22, speedMs);
      const maxTrailLife = Math.max(0.06, trailLengthMeters / effectiveSpeed);

      // Update active streamlines
      for (let sIdx = 0; sIdx < data.streamlines.length; sIdx++) {
        const line = data.streamlines[sIdx];

        if (isDynamic) {
          line.age += dt * (1.0 + data.intensity * 0.6);
          const progress = Math.min(1.0, Math.max(0, line.age / line.lifetime));

          // Smooth trapezoidal sinusoidal envelope:
          // 0.0 -> 0.20: fades in smoothly
          // 0.20 -> 0.70: bright full streak
          // 0.70 -> 1.0: fades out smoothly to 0
          let envelope = 1.0;
          if (progress < 0.20) {
            envelope = progress / 0.20;
          } else if (progress > 0.70) {
            envelope = (1.0 - progress) / 0.30;
          }
          line.alpha = Math.sin(Math.max(0, Math.min(1, envelope)) * Math.PI * 0.5);

          // If burst lifetime has completed:
          if (line.age >= line.lifetime) {
            // Hand over existing points in the air to fadingTrails so they continue
            // floating backward in the world and fade to zero smoothly! NEVER hard cut!
            if (line.history.length >= 2) {
              data.fadingTrails.push({
                points: line.history.map(p => ({ position: p.position.clone(), age: p.age })),
                currentAlpha: Math.max(0.12, line.alpha),
                initialAlpha: Math.max(0.12, line.alpha),
                fadeAge: 0,
                fadeDuration: Math.max(0.12, maxTrailLife * 0.8)
              });
            }
            line.history = []; // Clean start for new socket

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
            line.lifetime = burstInterval * (0.8 + Math.random() * 0.4);
            line.alpha = 0;
          }
        } else {
          // Continuous fixed mode: strictly locked to fixed symmetrical sockets without moving or changing!
          line.socketIndex = sIdx % candidateSockets.length;
          line.jitterOffset.set(0, 0, 0);
          line.age = 0;
          line.lifetime = 1.0;
          line.alpha = 1.0;
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
        // Only sample if moved at least 3 cm
        if (!last || last.position.distanceToSquared(currentWorldPos) > 0.0009) {
          line.history.unshift({ position: currentWorldPos, age: 0 });
          if (line.history.length > this.maxPointsPerTrail) {
            line.history.length = this.maxPointsPerTrail;
          }
        } else {
          last.position.copy(currentWorldPos);
        }
      }

      // Update fading trails (dissipating gracefully in the air)
      for (let fIdx = data.fadingTrails.length - 1; fIdx >= 0; fIdx--) {
        const fade = data.fadingTrails[fIdx];
        fade.fadeAge += dt;
        const fadeProg = Math.min(1.0, fade.fadeAge / fade.fadeDuration);
        fade.currentAlpha = fade.initialAlpha * Math.pow(1.0 - fadeProg, 1.4);

        for (let j = fade.points.length - 1; j >= 0; j--) {
          fade.points[j].age += dt;
          if (fade.points[j].age > maxTrailLife) {
            fade.points.splice(j, 1);
          }
        }

        if (fade.currentAlpha <= 0.005 || fade.points.length < 2) {
          data.fadingTrails.splice(fIdx, 1);
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

      // Collect all ribbons to render: active streamlines + fading tails
      const trailsToRender: { pts: TrailHistoryPoint[]; burstFactor: number }[] = [];
      for (const line of data.streamlines) {
        if (line.history.length >= 2 && line.alpha > 0.005) {
          trailsToRender.push({ pts: line.history, burstFactor: line.alpha });
        }
      }
      for (const fade of data.fadingTrails) {
        if (fade.points.length >= 2 && fade.currentAlpha > 0.005) {
          trailsToRender.push({ pts: fade.points, burstFactor: fade.currentAlpha });
        }
      }

      for (const trail of trailsToRender) {
        const pts = trail.pts;
        const burstFactor = trail.burstFactor;
        const quadCount = pts.length - 1;

        // Ensure we don't overflow the pre-allocated buffer arrays
        if (vertOffset + pts.length * 6 > posArr.length || indexOffset + quadCount * 6 > indexArr.length) {
          break;
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
      data.fadingTrails.length = 0;
      data.intensity = 0;
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

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MotorbikeVisual } from './MotorbikeModel';
import { normalizeMotorbikeSettings } from './MotorbikeSettings';

interface TronWallPoint {
  groundPos: THREE.Vector3;
  upVector: THREE.Vector3;
  age: number;
  lifetime: number;
  sinkDuration: number;
  wallHeight: number;
  distance: number;
  currentHeight: number;
  collider?: RAPIER.Collider | null;
}

interface TronWallStrip {
  points: TronWallPoint[];
}

interface BikeTronData {
  strips: TronWallStrip[];
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  currentColorHex: string;
  activeStrip: TronWallStrip | null;
  lastBikePos: THREE.Vector3;
  lowSpeedTimer: number;
  activeColliderCount: number;
  // Dynamic live tip for continuous, jump-free ribbon stretching directly from the rear tire
  liveTipPos: THREE.Vector3 | null;
  liveTipUp: THREE.Vector3 | null;
  liveTipDist: number;
}

export class VehicleTronWall {
  private tronByBike = new WeakMap<MotorbikeVisual, BikeTronData>();
  private allTrackedBikes = new Set<MotorbikeVisual>();
  private wallTexture: THREE.CanvasTexture;
  // Buffer capacity: 3,000 points = 6,000 vertices, 17,994 indices (~228 KB per bike, well within Uint16)
  private maxPointsPerBike = 3000;
  // Physical collider budget per bike (prevents Rapier physics saturation in multiplayer while keeping 500m+ of solid wall)
  private maxCollidersPerBike = 250;

  constructor(private scene: THREE.Scene, private world?: RAPIER.World) {
    this.wallTexture = this.createTronWallTexture();
  }

  /**
   * Generates a procedural high-tech Tron energy barrier texture:
   * - Pure white laser spine at top
   * - Holographic energy body with digital grid scanlines
   * - Luminous ground contact seal
   */
  private createTronWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vertical luminosity gradient (white/grayscale mask modulated by vertex colors)
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');     // Top laser spine
    grad.addColorStop(0.05, 'rgba(255, 255, 255, 0.95)');   // Upper hot band
    grad.addColorStop(0.15, 'rgba(220, 240, 255, 0.60)');   // Upper gradient
    grad.addColorStop(0.50, 'rgba(180, 220, 255, 0.35)');   // Translucent energy core
    grad.addColorStop(0.85, 'rgba(200, 235, 255, 0.55)');   // Lower gradient
    grad.addColorStop(0.96, 'rgba(255, 255, 255, 0.90)');   // Ground contact band
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');     // Ground bright line
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Horizontal energy scanlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
    ctx.lineWidth = 2.5;
    for (let y = 32; y < canvas.height - 20; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Vertical holographic grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    for (let x = 16; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Circuit dots pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    for (let y = 16; y < canvas.height - 16; y += 32) {
      for (let x = 16; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private parseHexColor(hex: string): THREE.Color {
    try {
      return new THREE.Color(hex);
    } catch {
      return new THREE.Color(0x00f0ff);
    }
  }

  private getOrCreateBikeTron(bike: MotorbikeVisual, colorHex: string): BikeTronData {
    let data = this.tronByBike.get(bike);
    if (!data) {
      const geometry = new THREE.BufferGeometry();
      const maxVerts = this.maxPointsPerBike * 2;
      const maxIndices = (this.maxPointsPerBike - 1) * 6;

      const positions = new Float32Array(maxVerts * 3);
      const colors = new Float32Array(maxVerts * 3);
      const uvs = new Float32Array(maxVerts * 2);
      const indices = new Uint16Array(maxIndices);

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
      const indexAttr = new THREE.BufferAttribute(indices, 1);
      indexAttr.setUsage(THREE.DynamicDrawUsage);
      geometry.setIndex(indexAttr);
      geometry.setDrawRange(0, 0);

      // Color is pure white so vertexColors directly tints the neon gradient accurately
      const material = new THREE.MeshBasicMaterial({
        map: this.wallTexture,
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `tron_wall_${bike.userData.uuid || 'bike'}`;
      mesh.frustumCulled = false;
      mesh.userData = { ignoreRaycast: true, isTronWall: true };
      mesh.raycast = () => {};
      this.scene.add(mesh);

      data = {
        strips: [],
        mesh,
        geometry,
        material,
        currentColorHex: colorHex,
        activeStrip: null,
        lastBikePos: bike.position.clone(),
        lowSpeedTimer: 0,
        activeColliderCount: 0,
        liveTipPos: null,
        liveTipUp: null,
        liveTipDist: 0
      };

      this.tronByBike.set(bike, data);
      this.allTrackedBikes.add(bike);
    }
    return data;
  }

  /**
   * Ensures that total points across all strips do not exceed maxPointsPerBike.
   * If approaching the limit, oldest points from the tail of the oldest strip are
   * pruned in FIFO order, removing any active Rapier colliders attached to them.
   * This completely prevents buffer overflow, rendering cutoffs, and visual flickering.
   */
  private ensureBufferCapacity(data: BikeTronData, neededCount: number) {
    let totalPts = 0;
    for (let i = 0; i < data.strips.length; i++) {
      totalPts += data.strips[i].points.length;
    }

    const overflow = (totalPts + neededCount) - (this.maxPointsPerBike - 15);
    if (overflow <= 0) return;

    let pointsToPrune = overflow;
    while (pointsToPrune > 0 && data.strips.length > 0) {
      const oldestStrip = data.strips[0];
      const canPruneFromStrip = oldestStrip === data.activeStrip
        ? Math.max(0, oldestStrip.points.length - 2)
        : oldestStrip.points.length;

      if (canPruneFromStrip <= 0) break;

      const count = Math.min(pointsToPrune, canPruneFromStrip);
      for (let i = 0; i < count; i++) {
        const removedPt = oldestStrip.points.shift();
        if (removedPt?.collider && this.world) {
          this.world.removeCollider(removedPt.collider, false);
          removedPt.collider = null;
          data.activeColliderCount = Math.max(0, data.activeColliderCount - 1);
        }
      }
      pointsToPrune -= count;

      if (oldestStrip.points.length === 0 && oldestStrip !== data.activeStrip) {
        data.strips.shift();
      }
    }
  }

  /**
   * Purges the oldest Rapier collider across all strips when active colliders reach the budget.
   * Maintains smooth physics performance even at extreme speeds or with multiple players.
   */
  private purgeOldestCollider(data: BikeTronData) {
    if (!this.world) return;
    for (let s = 0; s < data.strips.length; s++) {
      const pts = data.strips[s].points;
      for (let p = 0; p < pts.length; p++) {
        const pt = pts[p];
        if (pt.collider) {
          this.world.removeCollider(pt.collider, false);
          pt.collider = null;
          data.activeColliderCount = Math.max(0, data.activeColliderCount - 1);
          return;
        }
      }
    }
  }

  /**
   * Updates Tron light walls for all motorbikes in the scene.
   */
  update(bikes: MotorbikeVisual[], delta: number, fallDeathY?: number) {
    const dt = Math.min(0.08, Math.max(0, delta));

    for (const bike of bikes) {
      if (!bike || !bike.parent || !bike.visible || bike.userData.invisible) {
        continue;
      }

      // Performance: If bike has fallen below the death limit, cut off wall generation and purge existing strips
      if (fallDeathY !== undefined && bike.position.y < fallDeathY) {
        this.clearBike(bike);
        continue;
      }

      const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
      const enabled = props.tronWallEnabled === true;
      const colorHex = props.tronWallColor || '#00f0ff';
      const wallHeight = Math.max(0.3, Math.min(6.0, Number(props.tronWallHeight ?? 1.8)));
      const wallDuration = Math.max(1.0, Math.min(30.0, Number(props.tronWallDuration ?? 5.0)));
      const sinkDuration = Math.max(0.2, Math.min(5.0, Number(props.tronWallSinkDuration ?? 1.2)));
      const minSpeedKmh = Math.max(1.0, Math.min(120.0, Number(props.tronWallMinSpeed ?? 15.0)));
      const hasCollision = props.tronWallCollision === true;
      const animMode = props.tronWallAnimMode === 'instant' ? 'instant' : 'grow';

      const data = this.getOrCreateBikeTron(bike, colorHex);

      const bikeForward = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.quaternion).normalize();
      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bike.quaternion).normalize();

      // Check motion speed (signed: positive = forward, negative = reverse)
      const motionSpeed = bike.userData.vehicleMotion?.speed ?? bike.userData.speed ?? 0;

      // Frame displacement vector
      let frameForwardSpeed = 0;
      if (data.lastBikePos) {
        const frameDisp = bike.position.clone().sub(data.lastBikePos);
        frameForwardSpeed = dt > 0.0001 ? frameDisp.dot(bikeForward) / dt : 0;
      }
      data.lastBikePos.copy(bike.position);

      // Reversing detection:
      // If motion speed is negative or physical displacement is moving backward
      const isReversing = motionSpeed < -0.15 || (motionSpeed <= 0.05 && frameForwardSpeed < -0.2);

      if (isReversing && data.activeStrip) {
        // When reversing, finalize active strip cleanly right where the reverse began
        const pts = data.activeStrip.points;
        if (pts.length > 0 && data.liveTipPos) {
          const lastPt = pts[pts.length - 1];
          const finalDist = lastPt.groundPos.distanceTo(data.liveTipPos);
          if (finalDist >= 0.15) {
            this.ensureBufferCapacity(data, 1);
            pts.push({
              groundPos: data.liveTipPos.clone(),
              upVector: data.liveTipUp?.clone() ?? groundUp.clone(),
              age: 0,
              lifetime: wallDuration,
              sinkDuration,
              wallHeight,
              distance: lastPt.distance + finalDist,
              currentHeight: animMode === 'instant' ? wallHeight : lastPt.currentHeight
            });
          }
        }
        data.activeStrip = null;
        data.lowSpeedTimer = 0;
        data.liveTipPos = null;
        data.liveTipUp = null;
        data.liveTipDist = 0;
      }

      // Only forward speed counts for emitting wall
      let forwardSpeedMs = 0;
      if (!isReversing) {
        forwardSpeedMs = Math.max(motionSpeed, frameForwardSpeed);
        // Fallback to rigidBody forward component if motion properties not set
        if (forwardSpeedMs <= 0 && bike.userData.rigidBody?.isValid()) {
          const vel = bike.userData.rigidBody.linvel();
          const linvelVec = new THREE.Vector3(vel.x, vel.y, vel.z);
          forwardSpeedMs = Math.max(0, linvelVec.dot(bikeForward));
        }
      }

      const speedKmh = Math.max(0, forwardSpeedMs) * 3.6;

      // Hysteresis on speed threshold:
      // To start emitting: speed must reach minSpeedKmh (e.g. 15 km/h)
      // Once already emitting: stays emitting down to stopSpeedKmh (e.g. 8.5 km/h)
      // This completely prevents flickering and abrupt cutoffs when decelerating or hovering around threshold
      const stopSpeedKmh = Math.max(4.0, minSpeedKmh * 0.55);
      const isEmitting = data.activeStrip !== null;
      const isAboveThreshold = isEmitting ? (speedKmh >= stopSpeedKmh) : (speedKmh >= minSpeedKmh);
      const isFastEnough = enabled && !isReversing && isAboveThreshold;

      // 1. Emit new wall points if enabled, driving forward, and moving fast enough
      const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };

      // Rear wheel contact point in world coordinates
      const rearWheelLocal = new THREE.Vector3(0, -dims.y * 0.25, dims.z * 0.42);
      const rearWheelWorld = rearWheelLocal.clone().applyQuaternion(bike.quaternion).add(bike.position);

      // Performance safeguard: do not emit walls into the void when falling off the map
      if (fallDeathY !== undefined && bike.position.y < fallDeathY + 2.0) {
        data.activeStrip = null;
        data.liveTipPos = null;
        data.liveTipUp = null;
        data.liveTipDist = 0;
        continue;
      }

      // Ground raycast directly beneath rear wheel to find exact surface (handles ramps and walls)
      let groundPos = rearWheelWorld.clone().addScaledVector(bikeUp, -dims.y * 0.22);
      let groundUp = bikeUp.clone();

      if (this.world) {
        const rayOrigin = rearWheelWorld.clone().addScaledVector(bikeUp, 0.40);
        const rayDir = bikeUp.clone().negate();

        const filter = (col: RAPIER.Collider) => {
          // Exclude emitting bike's own body collider
          if (bike.userData.rigidBody && col === bike.userData.rigidBody.collider(0)) return false;
          // Exclude this bike's own immediate trailing wake so it doesn't self-stack into its own recent points
          const colAny = col as any;
          if (colAny.isTronWall && colAny.ownerBike === bike) {
            if (colAny.segMid && (colAny.segMid as THREE.Vector3).distanceTo(rearWheelWorld) < 2.5) {
              return false;
            }
          }
          return true;
        };

        const hit = this.world.castRayAndGetNormal(
          new RAPIER.Ray(rayOrigin, rayDir),
          dims.y * 1.6,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          bike.userData.rigidBody,
          filter
        );

        if (hit && Number.isFinite(hit.timeOfImpact)) {
          groundPos = rayOrigin.clone().addScaledVector(rayDir, hit.timeOfImpact);
          const hitNormal = new THREE.Vector3().copy(hit.normal as THREE.Vector3);
          if (hitNormal.dot(bikeUp) > 0.25) {
            groundUp.copy(hitNormal);
          }
        }
      }

      if (isFastEnough) {
        data.lowSpeedTimer = 0;

        const initialPointHeight = animMode === 'instant' ? wallHeight : Math.min(0.14, wallHeight * 0.08);

        if (!data.activeStrip) {
          this.ensureBufferCapacity(data, 1);
          const newStrip: TronWallStrip = { points: [] };
          data.strips.push(newStrip);
          data.activeStrip = newStrip;
          data.activeStrip.points.push({
            groundPos: groundPos.clone(),
            upVector: groundUp.clone(),
            age: 0,
            lifetime: wallDuration,
            sinkDuration,
            wallHeight,
            distance: 0,
            currentHeight: initialPointHeight
          });

          // Anchor the dynamic live tip right at the rear wheel
          data.liveTipPos = groundPos.clone();
          data.liveTipUp = groundUp.clone();
          data.liveTipDist = 0;
        } else {
          const pts = data.activeStrip.points;
          const lastPt = pts[pts.length - 1];
          const dist = lastPt.groundPos.distanceTo(groundPos);

          if (dist > 25.0) {
            // Discontinuity / teleport -> start a new strip
            this.ensureBufferCapacity(data, 1);
            const newStrip: TronWallStrip = { points: [] };
            data.strips.push(newStrip);
            data.activeStrip = newStrip;
            data.activeStrip.points.push({
              groundPos: groundPos.clone(),
              upVector: groundUp.clone(),
              age: 0,
              lifetime: wallDuration,
              sinkDuration,
              wallHeight,
              distance: 0,
              currentHeight: initialPointHeight
            });

            data.liveTipPos = groundPos.clone();
            data.liveTipUp = groundUp.clone();
            data.liveTipDist = 0;
          } else {
            // Continuously stretch the live tip to the moving vehicle every frame
            data.liveTipPos = groundPos.clone();
            data.liveTipUp = groundUp.clone();
            data.liveTipDist = lastPt.distance + dist;

            // Curvature & incline change detection for adaptive LOD
            let isCurving = false;
            if (pts.length >= 2) {
              const prevPt = pts[pts.length - 2];
              const prevDx = lastPt.groundPos.x - prevPt.groundPos.x;
              const prevDy = lastPt.groundPos.y - prevPt.groundPos.y;
              const prevDz = lastPt.groundPos.z - prevPt.groundPos.z;
              const prevLenSq = prevDx * prevDx + prevDy * prevDy + prevDz * prevDz;

              const curDx = groundPos.x - lastPt.groundPos.x;
              const curDy = groundPos.y - lastPt.groundPos.y;
              const curDz = groundPos.z - lastPt.groundPos.z;
              const curLenSq = curDx * curDx + curDy * curDy + curDz * curDz;

              if (prevLenSq > 0.001 && curLenSq > 0.001) {
                const invPrev = 1.0 / Math.sqrt(prevLenSq);
                const invCur = 1.0 / Math.sqrt(curLenSq);
                const dotHeading = (prevDx * curDx + prevDy * curDy + prevDz * curDz) * (invPrev * invCur);
                const dotUp = lastPt.upVector.x * groundUp.x + lastPt.upVector.y * groundUp.y + lastPt.upVector.z * groundUp.z;

                // If turning or riding onto ramp/wall slope
                if (dotHeading < 0.9985 || dotUp < 0.9985) {
                  isCurving = true;
                }
              }
            }

            // Adaptive spacing:
            // High curve/ramp fidelity: 0.45m - 0.50m
            // Straight high-speed run (up to 500 km/h): 0.50m to 2.20m (prevents point bloat by 80%)
            const speedRatio = Math.min(1.0, speedKmh / 350.0);
            const targetSpacing = isCurving ? 0.48 : (0.50 + speedRatio * 1.70);

            if (dist >= targetSpacing) {
              const steps = Math.min(3, Math.max(1, Math.floor(dist / targetSpacing)));
              this.ensureBufferCapacity(data, steps);

              if (steps > 1) {
                for (let s = 1; s <= steps; s++) {
                  const frac = s / steps;
                  const subPos = lastPt.groundPos.clone().lerp(groundPos, frac);
                  const subUp = lastPt.upVector.clone().lerp(groundUp, frac).normalize();
                  pts.push({
                    groundPos: subPos,
                    upVector: subUp,
                    age: (1 - frac) * dt,
                    lifetime: wallDuration,
                    sinkDuration,
                    wallHeight,
                    distance: lastPt.distance + dist * frac,
                    currentHeight: initialPointHeight
                  });
                }
              } else {
                pts.push({
                  groundPos: groundPos.clone(),
                  upVector: groundUp.clone(),
                  age: 0,
                  lifetime: wallDuration,
                  sinkDuration,
                  wallHeight,
                  distance: lastPt.distance + dist,
                  currentHeight: initialPointHeight
                });
              }
            }
          }
        }
      } else {
        // Vehicle stopped or below threshold: apply smooth deceleration grace period
        if (data.activeStrip) {
          data.lowSpeedTimer += dt;

          // While rolling to a stop (brief 0.30s grace window):
          // Keep stretching the live tip smoothly to the bike as it glides to rest!
          if (data.lowSpeedTimer < 0.30 && forwardSpeedMs > 0.08 && data.liveTipPos) {
            data.liveTipPos.copy(groundPos);
            data.liveTipUp.copy(groundUp);
            const pts = data.activeStrip.points;
            const lastPt = pts[pts.length - 1];
            if (lastPt) {
              data.liveTipDist = lastPt.distance + lastPt.groundPos.distanceTo(groundPos);
            }
          } else {
            // The vehicle has fully come to a stop or grace timer expired:
            // Cleanly commit the final point right where the rear wheel stopped!
            const pts = data.activeStrip.points;
            if (pts.length > 0) {
              const lastPt = pts[pts.length - 1];
              const finalDist = lastPt.groundPos.distanceTo(groundPos);
              if (finalDist >= 0.15) {
                this.ensureBufferCapacity(data, 1);
                pts.push({
                  groundPos: groundPos.clone(),
                  upVector: groundUp.clone(),
                  age: 0,
                  lifetime: wallDuration,
                  sinkDuration,
                  wallHeight,
                  distance: lastPt.distance + finalDist,
                  currentHeight: animMode === 'instant' ? wallHeight : lastPt.currentHeight
                });
              }
            }
            data.activeStrip = null;
            data.liveTipPos = null;
            data.liveTipUp = null;
            data.liveTipDist = 0;
            data.lowSpeedTimer = 0;
          }
        } else {
          data.liveTipPos = null;
          data.liveTipUp = null;
          data.liveTipDist = 0;
          data.lowSpeedTimer = 0;
        }
      }

      // 2. Age points, calculate downward sinking, and prune expired points
      const riseDuration = 0.22;

      for (let sIdx = data.strips.length - 1; sIdx >= 0; sIdx--) {
        const strip = data.strips[sIdx];
        const pts = strip.points;

        for (let pIdx = pts.length - 1; pIdx >= 0; pIdx--) {
          const pt = pts[pIdx];
          pt.age += dt;

          let heightRatio = 1.0;
          if (animMode === 'grow') {
            if (pt.age < riseDuration) {
              const riseProgress = Math.max(0, pt.age / riseDuration);
              // Smoothstep curve (starts gentle, accelerates smoothly, lands softly)
              heightRatio = riseProgress * riseProgress * (3.0 - 2.0 * riseProgress);
            }
          } else {
            // Mode 'instant': immediate 100% full height without growth
            heightRatio = 1.0;
          }

          // Sinking into the ground phase: smoothly drops height to 0
          const timeRemaining = Math.max(0, pt.lifetime - pt.age);
          if (timeRemaining < pt.sinkDuration) {
            const sinkProgress = 1.0 - (timeRemaining / pt.sinkDuration);
            const sinkRatio = Math.pow(Math.max(0, 1.0 - sinkProgress), 1.4);
            heightRatio = Math.min(heightRatio, sinkRatio);
          }

          pt.currentHeight = pt.wallHeight * heightRatio;

          // If expired (fully sunk into the ground)
          if (pt.age >= pt.lifetime) {
            if (pt.collider && this.world) {
              this.world.removeCollider(pt.collider, false);
              pt.collider = null;
              data.activeColliderCount = Math.max(0, data.activeColliderCount - 1);
            }
            pts.splice(pIdx, 1);
          }
        }

        // Only remove a strip if all its points have aged out OR if it's an abandoned strip with < 2 points.
        // An active strip that was just started naturally has 1 point and MUST NOT be deleted!
        const isAbandoned = data.activeStrip !== strip && pts.length < 2;
        if (pts.length === 0 || isAbandoned) {
          for (let p = 0; p < pts.length; p++) {
            const pt = pts[p];
            if (pt.collider && this.world) {
              this.world.removeCollider(pt.collider, false);
              pt.collider = null;
              data.activeColliderCount = Math.max(0, data.activeColliderCount - 1);
            }
          }
          if (data.activeStrip === strip) {
            data.activeStrip = null;
          }
          data.strips.splice(sIdx, 1);
        }
      }

      // 3. Optional Physical Colliders in Rapier
      if (this.world) {
        if (!hasCollision && data.activeColliderCount > 0) {
          // If collision toggled off, cleanly purge all colliders
          for (let s = 0; s < data.strips.length; s++) {
            const pts = data.strips[s].points;
            for (let p = 0; p < pts.length; p++) {
              if (pts[p].collider) {
                this.world.removeCollider(pts[p].collider, false);
                pts[p].collider = null;
              }
            }
          }
          data.activeColliderCount = 0;
        } else if (hasCollision) {
          for (let sIdx = 0; sIdx < data.strips.length; sIdx++) {
            const strip = data.strips[sIdx];
            const pts = strip.points;
            const isThisActiveStrip = data.activeStrip === strip;
            const ptsLen = pts.length;

            for (let i = 0; i < ptsLen - 1; i++) {
              const p0 = pts[i];
              const p1 = pts[i + 1];
              const avgH = (p0.currentHeight + p1.currentHeight) * 0.5;

              // If collider already exists, only check if it needs to be removed due to sinking
              if (p0.collider) {
                if (avgH < 0.45) {
                  this.world.removeCollider(p0.collider, false);
                  p0.collider = null;
                  data.activeColliderCount = Math.max(0, data.activeColliderCount - 1);
                }
                continue;
              }

              // Only continue if wall is high enough to collide
              if (avgH < 0.45) continue;

              // Tail wake protection:
              // Only applies while this strip is actively being emitted by the moving bike.
              // We do not arm a collider on the newest 1 segment directly behind the tire (~1.3m)
              // so forward acceleration and ramp climbs never catch on the emerging wake.
              // All older segments behind that HAVE FULL SOLID COLLIDERS!
              // Inactive strips (when stopped or finished) have ALL segments solidly collidable!
              const segsFromHead = isThisActiveStrip ? (ptsLen - 1 - i) : 999;
              const p1DistToWheel = p1.groundPos.distanceTo(rearWheelWorld);
              const isTailWake = isThisActiveStrip && (segsFromHead <= 1 || p1DistToWheel < 1.3);

              if (isTailWake) continue;

              const sx = p1.groundPos.x - p0.groundPos.x;
              const sy = p1.groundPos.y - p0.groundPos.y;
              const sz = p1.groundPos.z - p0.groundPos.z;
              const segLen = Math.sqrt(sx * sx + sy * sy + sz * sz);
              if (segLen < 0.15) continue;

              // Enforce collider budget across the bike
              if (data.activeColliderCount >= this.maxCollidersPerBike) {
                this.purgeOldestCollider(data);
              }

              const segUp = p0.upVector.clone().add(p1.upVector).normalize();
              if (segUp.lengthSq() < 0.01) segUp.copy(p0.upVector).normalize();

              const midX = (p0.groundPos.x + p1.groundPos.x) * 0.5;
              const midY = (p0.groundPos.y + p1.groundPos.y) * 0.5;
              const midZ = (p0.groundPos.z + p1.groundPos.z) * 0.5;
              const colMid = new THREE.Vector3(midX, midY, midZ).addScaledVector(segUp, avgH * 0.5);

              const yAxis = segUp.clone();
              const zAxis = new THREE.Vector3(sx, sy, sz).normalize();
              // Compute right-handed orthonormal basis: xAxis = yAxis × zAxis (determinant = +1.0)
              const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
              if (xAxis.lengthSq() < 0.001) {
                xAxis.set(1, 0, 0);
                if (Math.abs(yAxis.dot(xAxis)) > 0.9) xAxis.set(0, 0, 1);
                xAxis.crossVectors(yAxis, xAxis).normalize();
              }
              // Re-orthogonalize zAxis so all 3 axes are strictly perpendicular
              zAxis.crossVectors(xAxis, yAxis).normalize();

              const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
              const quat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

              // 0.52m thickness ensures motorbikes and players have a stable, wide surface to drive and walk on top
              const thickness = 0.52;
              const halfThick = thickness * 0.5;
              const halfHeight = avgH * 0.5;
              const halfLen = segLen * 0.5 + 0.02;

              const colDesc = RAPIER.ColliderDesc.cuboid(halfThick, halfHeight, halfLen);
              colDesc.setTranslation(colMid.x, colMid.y, colMid.z);
              colDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
              colDesc.setFriction(0.85);
              colDesc.setRestitution(0.0);

              const col = this.world.createCollider(colDesc);
              (col as any).isTronWall = true;
              (col as any).ownerBike = bike;
              (col as any).segMid = new THREE.Vector3(midX, midY, midZ);
              (col as any).segAge = p0.age;

              p0.collider = col;
              data.activeColliderCount++;
            }
          }
        }
      }

      // 4. Rebuild 3D BufferGeometry with ZERO garbage collection allocations
      const posAttr = data.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = data.geometry.getAttribute('color') as THREE.BufferAttribute;
      const uvAttr = data.geometry.getAttribute('uv') as THREE.BufferAttribute;
      const indexAttr = data.geometry.getIndex()!;

      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;
      const uvArr = uvAttr.array as Float32Array;
      const indexArr = indexAttr.array as Uint16Array;

      const baseColor = this.parseHexColor(colorHex);

      let vertOffset = 0;
      let uvOffset = 0;
      let colOffset = 0;
      let indexOffset = 0;

      for (let sIdx = 0; sIdx < data.strips.length; sIdx++) {
        const strip = data.strips[sIdx];
        const pts = strip.points;
        const isThisActiveStrip = data.activeStrip === strip;
        const hasLiveTip = isThisActiveStrip && data.liveTipPos !== null && pts.length >= 1;

        if (pts.length < 1) continue;
        if (pts.length < 2 && !hasLiveTip) continue;

        const stripStartVert = vertOffset / 3;

        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i];
          if (vertOffset + 6 > posArr.length) break;

          const timeRemaining = Math.max(0, pt.lifetime - pt.age);
          let alpha = 1.0;
          if (animMode === 'grow' && pt.age < riseDuration) {
            const riseProgress = Math.max(0, pt.age / riseDuration);
            alpha = Math.min(1.0, 0.60 + 0.40 * riseProgress);
          } else if (timeRemaining < pt.sinkDuration) {
            const sinkProgress = 1.0 - (timeRemaining / pt.sinkDuration);
            alpha = Math.pow(Math.max(0, 1.0 - sinkProgress), 1.2);
          }

          const gx = pt.groundPos.x;
          const gy = pt.groundPos.y;
          const gz = pt.groundPos.z;

          const ux = pt.upVector.x;
          const uy = pt.upVector.y;
          const uz = pt.upVector.z;

          const ch = pt.currentHeight;

          // Bottom vertex: ground contact seal, elevated 2cm to prevent z-fighting with terrain
          const bx = gx + ux * 0.02;
          const by = gy + uy * 0.02;
          const bz = gz + uz * 0.02;

          // Top vertex: rises from bottom by currentHeight along surface normal
          const tx = bx + ux * ch;
          const ty = by + uy * ch;
          const tz = bz + uz * ch;

          posArr[vertOffset] = bx;
          posArr[vertOffset + 1] = by;
          posArr[vertOffset + 2] = bz;

          posArr[vertOffset + 3] = tx;
          posArr[vertOffset + 4] = ty;
          posArr[vertOffset + 5] = tz;

          // Texture coordinates along length
          const u = pt.distance * 0.40;
          uvArr[uvOffset] = u;
          uvArr[uvOffset + 1] = 0.0; // bottom

          uvArr[uvOffset + 2] = u;
          uvArr[uvOffset + 3] = 1.0; // top

          // Vertex colors:
          // Bottom vertex: vibrant base color at ground level
          const botR = baseColor.r * alpha * 0.85;
          const botG = baseColor.g * alpha * 0.85;
          const botB = baseColor.b * alpha * 0.85;

          // Top vertex: intense white-hot laser spine
          const topR = (baseColor.r * 0.50 + 0.50) * alpha * 1.40;
          const topG = (baseColor.g * 0.50 + 0.50) * alpha * 1.40;
          const topB = (baseColor.b * 0.50 + 0.50) * alpha * 1.40;

          colArr[colOffset] = botR;
          colArr[colOffset + 1] = botG;
          colArr[colOffset + 2] = botB;

          colArr[colOffset + 3] = topR;
          colArr[colOffset + 4] = topG;
          colArr[colOffset + 5] = topB;

          vertOffset += 6;
          uvOffset += 4;
          colOffset += 6;
        }

        // Append dynamic live tip vertex pair to seal the ribbon directly to the moving vehicle
        let hasAppendedLiveTip = false;
        if (hasLiveTip && vertOffset + 6 <= posArr.length) {
          const gx = data.liveTipPos!.x;
          const gy = data.liveTipPos!.y;
          const gz = data.liveTipPos!.z;

          const ux = data.liveTipUp!.x;
          const uy = data.liveTipUp!.y;
          const uz = data.liveTipUp!.z;

          // Tip height:
          // 'instant' mode: full wallHeight at rear wheel!
          // 'grow' mode: sleek emitter fin (~14cm) emerging from tire
          const tipH = animMode === 'instant' ? wallHeight : Math.min(0.14, wallHeight * 0.08);

          const bx = gx + ux * 0.02;
          const by = gy + uy * 0.02;
          const bz = gz + uz * 0.02;

          const tx = bx + ux * tipH;
          const ty = by + uy * tipH;
          const tz = bz + uz * tipH;

          posArr[vertOffset] = bx;
          posArr[vertOffset + 1] = by;
          posArr[vertOffset + 2] = bz;

          posArr[vertOffset + 3] = tx;
          posArr[vertOffset + 4] = ty;
          posArr[vertOffset + 5] = tz;

          const u = data.liveTipDist * 0.40;
          uvArr[uvOffset] = u;
          uvArr[uvOffset + 1] = 0.0;
          uvArr[uvOffset + 2] = u;
          uvArr[uvOffset + 3] = 1.0;

          const tipAlpha = animMode === 'instant' ? 1.0 : 0.70;
          colArr[colOffset] = baseColor.r * tipAlpha * 0.85;
          colArr[colOffset + 1] = baseColor.g * tipAlpha * 0.85;
          colArr[colOffset + 2] = baseColor.b * tipAlpha * 0.85;

          colArr[colOffset + 3] = (baseColor.r * 0.50 + 0.50) * tipAlpha * 1.40;
          colArr[colOffset + 4] = (baseColor.g * 0.50 + 0.50) * tipAlpha * 1.40;
          colArr[colOffset + 5] = (baseColor.b * 0.50 + 0.50) * tipAlpha * 1.40;

          vertOffset += 6;
          uvOffset += 4;
          colOffset += 6;
          hasAppendedLiveTip = true;
        }

        // Quad indices for this strip
        const totalVertPairs = pts.length + (hasAppendedLiveTip ? 1 : 0);
        const quadCount = totalVertPairs - 1;
        for (let q = 0; q < quadCount; q++) {
          if (indexOffset + 6 > indexArr.length) break;

          const v0 = stripStartVert + q * 2;
          const v1 = v0 + 1;
          const v2 = v0 + 2;
          const v3 = v0 + 3;

          // Triangle 1: (v0, v1, v2)
          indexArr[indexOffset] = v0;
          indexArr[indexOffset + 1] = v1;
          indexArr[indexOffset + 2] = v2;

          // Triangle 2: (v2, v1, v3)
          indexArr[indexOffset + 3] = v2;
          indexArr[indexOffset + 4] = v1;
          indexArr[indexOffset + 5] = v3;

          indexOffset += 6;
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      indexAttr.needsUpdate = true;
      data.geometry.setDrawRange(0, indexOffset);
    }
  }

  clearBike(bike: MotorbikeVisual) {
    const data = this.tronByBike.get(bike);
    if (data) {
      if (this.world) {
        for (let s = 0; s < data.strips.length; s++) {
          const pts = data.strips[s].points;
          for (let p = 0; p < pts.length; p++) {
            if (pts[p].collider) {
              this.world.removeCollider(pts[p].collider, false);
              pts[p].collider = null;
            }
          }
        }
      }
      data.activeColliderCount = 0;
      data.strips = [];
      data.activeStrip = null;
      data.liveTipPos = null;
      data.liveTipUp = null;
      data.liveTipDist = 0;
      data.geometry.setDrawRange(0, 0);
    }
  }

  removeBike(bike: MotorbikeVisual) {
    const data = this.tronByBike.get(bike);
    if (data) {
      this.clearBike(bike);
      data.geometry.dispose();
      data.material.dispose();
      this.scene.remove(data.mesh);
      this.tronByBike.delete(bike);
      this.allTrackedBikes.delete(bike);
    }
  }

  dispose() {
    for (const bike of this.allTrackedBikes) {
      this.removeBike(bike);
    }
    this.allTrackedBikes.clear();
    this.wallTexture.dispose();
  }
}

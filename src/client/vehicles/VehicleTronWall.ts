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
}

export class VehicleTronWall {
  private tronByBike = new WeakMap<MotorbikeVisual, BikeTronData>();
  private allTrackedBikes = new Set<MotorbikeVisual>();
  private wallTexture: THREE.CanvasTexture;
  private maxPointsPerBike = 1600;

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
        lowSpeedTimer: 0
      };

      this.tronByBike.set(bike, data);
      this.allTrackedBikes.add(bike);
    }
    return data;
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

      if (isReversing) {
        // When reversing, finalize active strip immediately and do not emit
        data.activeStrip = null;
        data.lowSpeedTimer = 0;
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
      const isFastEnough = enabled && !isReversing && (speedKmh >= minSpeedKmh);

      // 1. Emit new wall points if enabled, driving forward, and moving fast enough
      const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };

      // Rear wheel contact point in world coordinates
      const rearWheelLocal = new THREE.Vector3(0, -dims.y * 0.25, dims.z * 0.42);
      const rearWheelWorld = rearWheelLocal.clone().applyQuaternion(bike.quaternion).add(bike.position);

      // Performance safeguard: do not emit walls into the void when falling off the map
      if (fallDeathY !== undefined && bike.position.y < fallDeathY + 2.0) {
        data.activeStrip = null;
        continue;
      }

      if (isFastEnough) {
        data.lowSpeedTimer = 0;

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
              if (colAny.segMid && (colAny.segMid as THREE.Vector3).distanceTo(rearWheelWorld) < 2.0) {
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

        if (!data.activeStrip) {
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
            currentHeight: wallHeight
          });
        } else {
          const pts = data.activeStrip.points;
          const lastPt = pts[pts.length - 1];
          const dist = lastPt.groundPos.distanceTo(groundPos);

          if (dist > 15.0) {
            // Discontinuity / teleport -> start a new strip
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
              currentHeight: wallHeight
            });
          } else if (dist >= 0.20) {
            // Subdivide at high speed to maintain smooth curvature on ramps and turns
            const steps = Math.min(5, Math.floor(dist / 0.35));
            if (steps > 1) {
              for (let s = 1; s <= steps; s++) {
                const frac = s / steps;
                const subPos = lastPt.groundPos.clone().lerp(groundPos, frac);
                const subUp = lastPt.upVector.clone().lerp(groundUp, frac).normalize();
                pts.push({
                  groundPos: subPos,
                  upVector: subUp,
                  age: 0,
                  lifetime: wallDuration,
                  sinkDuration,
                  wallHeight,
                  distance: lastPt.distance + dist * frac,
                  currentHeight: wallHeight
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
                currentHeight: wallHeight
              });
            }
          }
        }
      } else {
        // Vehicle stopped or below threshold: apply brief hysteresis before breaking the strip
        data.lowSpeedTimer += dt;
        if (data.lowSpeedTimer > 0.25) {
          data.activeStrip = null;
        }
      }

      // 2. Age points, calculate downward sinking, and prune expired points
      for (let sIdx = data.strips.length - 1; sIdx >= 0; sIdx--) {
        const strip = data.strips[sIdx];
        const pts = strip.points;

        for (let pIdx = pts.length - 1; pIdx >= 0; pIdx--) {
          const pt = pts[pIdx];
          pt.age += dt;

          const timeRemaining = Math.max(0, pt.lifetime - pt.age);
          if (timeRemaining < pt.sinkDuration) {
            // Sinking into the ground phase: smoothly drops height to 0
            const sinkProgress = 1.0 - (timeRemaining / pt.sinkDuration);
            const sinkRatio = Math.pow(Math.max(0, 1.0 - sinkProgress), 1.4);
            pt.currentHeight = pt.wallHeight * sinkRatio;
          } else {
            pt.currentHeight = pt.wallHeight;
          }

          // If expired (fully sunk into the ground)
          if (pt.age >= pt.lifetime) {
            if (pt.collider && this.world) {
              this.world.removeCollider(pt.collider, false);
              pt.collider = null;
            }
            pts.splice(pIdx, 1);
          }
        }

        // Only remove a strip if all its points have aged out OR if it's an abandoned strip with < 2 points.
        // An active strip that was just started naturally has 1 point and MUST NOT be deleted!
        const isAbandoned = data.activeStrip !== strip && pts.length < 2;
        if (pts.length === 0 || isAbandoned) {
          for (const pt of pts) {
            if (pt.collider && this.world) {
              this.world.removeCollider(pt.collider, false);
              pt.collider = null;
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
        for (const strip of data.strips) {
          const pts = strip.points;
          const isThisActiveStrip = data.activeStrip === strip;
          const ptsLen = pts.length;

          for (let i = 0; i < ptsLen - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const avgH = (p0.currentHeight + p1.currentHeight) * 0.5;

            const segVec = p1.groundPos.clone().sub(p0.groundPos);
            const segLen = segVec.length();
            const mid = p0.groundPos.clone().add(p1.groundPos).multiplyScalar(0.5);

            // The immediate tail wake directly behind the vehicle is kept uncollided
            // to allow smooth forward acceleration, ramp climbs, and wall riding without sticking.
            // Active strip: only the newest 5 segments (~1.3m behind rear wheel) are uncollided.
            // Inactive strip: segments within 1.6m of the stopped bike wait until the bike moves away to arm.
            const segsFromHead = isThisActiveStrip ? (ptsLen - 1 - i) : 999;
            const isTailWake = isThisActiveStrip ? (segsFromHead < 6) : (mid.distanceTo(bike.position) < 1.6);
            const canArmCollider = hasCollision && avgH >= 0.45 && segLen >= 0.15 && !isTailWake;

            if (canArmCollider && !p0.collider) {
              const segUp = p0.upVector.clone().add(p1.upVector).normalize();
              if (segUp.lengthSq() < 0.01) segUp.copy(p0.upVector).normalize();

              const colMid = mid.clone().addScaledVector(segUp, avgH * 0.5);

              const yAxis = segUp.clone();
              const zAxis = segVec.clone().normalize();
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

              // 0.52m thickness ensures motorbikes (38cm side wheel raycasts) and players have
              // a stable, wide surface to drive and walk on top of the wall without slipping off.
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
              (col as any).segMid = mid.clone();
              (col as any).segAge = p0.age;

              p0.collider = col;
            } else if ((!hasCollision || avgH < 0.45) && p0.collider) {
              // ONLY remove a collider when physical collision is disabled or the wall has sunk into the ground!
              // NEVER remove a collider when the vehicle approaches it!
              this.world.removeCollider(p0.collider, false);
              p0.collider = null;
            } else if (p0.collider) {
              (p0.collider as any).segAge = p0.age;
            }
          }
        }
      }

      // 4. Rebuild 3D BufferGeometry
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

      for (const strip of data.strips) {
        const pts = strip.points;
        if (pts.length < 2) continue;

        const stripStartVert = vertOffset / 3;

        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i];
          if (vertOffset + 6 > posArr.length) break;

          const timeRemaining = Math.max(0, pt.lifetime - pt.age);
          let alpha = 1.0;
          if (timeRemaining < pt.sinkDuration) {
            const sinkProgress = 1.0 - (timeRemaining / pt.sinkDuration);
            alpha = Math.pow(Math.max(0, 1.0 - sinkProgress), 1.2);
          }

          // Bottom vertex (ground seal, slightly elevated 2cm to avoid z-fighting)
          const bPos = pt.groundPos.clone().addScaledVector(pt.upVector, 0.02);
          // Top vertex (sinks down towards ground as currentHeight decreases!)
          const tPos = bPos.clone().addScaledVector(pt.upVector, pt.currentHeight);

          posArr[vertOffset] = bPos.x;
          posArr[vertOffset + 1] = bPos.y;
          posArr[vertOffset + 2] = bPos.z;

          posArr[vertOffset + 3] = tPos.x;
          posArr[vertOffset + 4] = tPos.y;
          posArr[vertOffset + 5] = tPos.z;

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

        // Quad indices for this strip
        const quadCount = pts.length - 1;
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
        for (const strip of data.strips) {
          for (const pt of strip.points) {
            if (pt.collider) {
              this.world.removeCollider(pt.collider, false);
              pt.collider = null;
            }
          }
        }
      }
      data.strips = [];
      data.activeStrip = null;
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

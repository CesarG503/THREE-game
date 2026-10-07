import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { vehicleUp, vehicleGravity } from './VehicleGravity';

const Y = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

/** Rounded footprint: the sharp bottom corners of a box catch stair risers and mesh seams. */
export function motorbikeCollider(size: { x: number; y: number; z: number }) {
  const radius = Math.min(size.x, size.y, size.z) * 0.24;
  return RAPIER.ColliderDesc.roundCuboid(size.x / 2 - radius, size.y / 2 - radius, size.z / 2 - radius, radius);
}

interface Motion {
  velocity: THREE.Vector3;
  angular: THREE.Vector3;
  grounded: boolean;
  jumpTime: number;
  body: RAPIER.RigidBody;
  gravityFrame: THREE.Quaternion;
  recovering: boolean;
  groundRecovery?: boolean;
  invertedDeparture?: boolean;
  invertedSupport?: boolean;
  surfaceSupported?: boolean;
  recoveryTarget?: THREE.Quaternion;
  crashLatched: boolean;
  stableTime: number;
  restingNormal: THREE.Vector3;
  restingSide: number;
  restingTarget?: THREE.Quaternion;
}
export interface BikeControls { yawRate?: number; pitch?: number; yaw?: number; roll?: number; jump?: number; boost?: number; stabilize?: boolean; }

/** Swept, wheel-supported vehicle motion. Airborne translation is independent of
 * the bike's attitude, so rotating a trick cannot redirect its flight velocity. */
export class MotorbikePhysics {
  private states = new WeakMap<THREE.Object3D, Motion>();
  private departingRiders = new WeakMap<THREE.Object3D, { collider: RAPIER.Collider; remaining: number }>();
  private initialVelocities = new WeakMap<THREE.Object3D, THREE.Vector3>();
  private controller: RAPIER.KinematicCharacterController;
  constructor(private world: RAPIER.World) {
    this.controller = world.createCharacterController(0.025);
    this.controller.disableSnapToGround();
    this.controller.setMaxSlopeClimbAngle(Math.PI / 2 - 0.01);
    this.controller.setMinSlopeSlideAngle(Math.PI / 2);
  }

  releaseRider(bike: THREE.Object3D, collider: RAPIER.Collider) { this.departingRiders.set(bike, { collider, remaining: 0.4 }); }
  velocity(bike: THREE.Object3D) { return this.states.get(bike)?.velocity.clone(); }
  surfaceSupported(bike: THREE.Object3D) { return this.states.get(bike)?.surfaceSupported === true; }
  reset(bike: THREE.Object3D, velocity?: number[]) { this.states.delete(bike); if (velocity) this.initialVelocities.set(bike, new THREE.Vector3().fromArray(velocity)); }
  applyImpulse(bike: THREE.Object3D, force: THREE.Vector3) {
    let state = this.states.get(bike);
    const gravityUp = vehicleUp(bike);
    if (!state) {
      const initial = this.initialVelocities.get(bike) ?? new THREE.Vector3();
      initial.add(force);
      this.initialVelocities.set(bike, initial);
      return;
    }
    const vert = force.dot(gravityUp);
    if (vert > 0.1) {
      state.jumpTime = 0.35;
      state.grounded = false;
      state.surfaceSupported = false;
      const currentVert = state.velocity.dot(gravityUp);
      if (currentVert < vert) {
        state.velocity.addScaledVector(gravityUp, vert - currentVert);
      } else {
        state.velocity.addScaledVector(gravityUp, vert * 0.5);
      }
    }
    const planar = force.clone().projectOnPlane(gravityUp);
    state.velocity.add(planar);
  }
  dispose() { this.world.removeCharacterController(this.controller); }

  /** Recover around the contact footprint, checking clearance before moving.
   * Gravity stays independent of attitude; righting never creates drive speed. */
  private stabilize(bike: THREE.Object3D, maxAngle: number, filter: (collider: RAPIER.Collider) => boolean, restingTarget?: THREE.Quaternion) {
    const body = bike.userData.rigidBody as RAPIER.RigidBody;
    const up = vehicleUp(bike), dims = bike.userData.originalScale;
    let forward = FORWARD.clone().applyQuaternion(bike.quaternion).projectOnPlane(up);
    if (forward.lengthSq() < 0.01) forward = new THREE.Vector3(1, 0, 0).applyQuaternion(bike.quaternion).cross(up);
    forward.normalize();
    const right = forward.clone().cross(up).normalize();
    const target = restingTarget ?? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.negate()));
    const rotation = bike.quaternion.clone().rotateTowards(target, maxAngle);
    const radius = Math.min(dims.x, dims.y, dims.z) * 0.24;
    const extent = (q: THREE.Quaternion) => radius + ['x', 'y', 'z'].reduce((sum, axis, index) => sum + Math.abs(new THREE.Vector3().setComponent(index, 1).applyQuaternion(q).dot(up)) * (dims[axis] / 2 - radius), 0);
    const ground = this.world.castRay(new RAPIER.Ray(bike.position, up.clone().negate()), extent(bike.quaternion) + 0.15, true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
    const position = bike.position.clone();
    if (ground) position.addScaledVector(up, Math.max(0, extent(rotation) + 0.035 - ground.timeOfImpact));
    // Make room away from nearby surfaces instead of retrying the same blocked
    // rotation forever. The subsequent sweep still forbids crossing a wall.
    for (let iteration = 0; iteration < 4; iteration++) {
      let adjusted = false;
      this.world.intersectionsWithShape(position, rotation, body.collider(0).shape, other => {
        const contact = other.contactShape(body.collider(0).shape, position, rotation, 0);
        if (contact && contact.distance <= 0) {
          position.addScaledVector(new THREE.Vector3().copy(contact.normal1 as THREE.Vector3), Math.min(0.2, -contact.distance + 0.01));
          adjusted = true;
        }
        return true;
      }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
      if (!adjusted) break;
    }
    const lift = position.clone().sub(bike.position);
    const blockedLift = lift.lengthSq() > 1e-8 && this.world.castShape(bike.position, bike.quaternion, lift, body.collider(0).shape, 0.001, 1, false,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
    const blockedPose = this.world.intersectionWithShape(position, rotation, body.collider(0).shape,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
    if (blockedLift || blockedPose) return false;
    bike.position.copy(position); bike.quaternion.copy(rotation);
    body.setTranslation(position, true); body.setRotation(rotation, true);
    body.setNextKinematicTranslation(position); body.setNextKinematicRotation(rotation);
    return true;
  }

  rightBike(bike: THREE.Object3D, excluded?: RAPIER.Collider) {
    const before = bike.position.clone(), rotation = bike.quaternion.clone();
    const filter = (other: RAPIER.Collider) => {
      if (other === excluded) return false;
      const colAny = other as any;
      if (colAny.isTronWall && colAny.ownerBike === bike) return false;
      return true;
    };
    // Validate the whole rotation, not just a clear final pose.
    for (let i = 0; i < 36; i++) {
      if (!this.stabilize(bike, Math.PI / 18, filter)) {
        bike.position.copy(before); bike.quaternion.copy(rotation);
        const body = bike.userData.rigidBody as RAPIER.RigidBody;
        body.setTranslation(before, true); body.setRotation(rotation, true);
        body.setNextKinematicTranslation(before); body.setNextKinematicRotation(rotation);
        return false;
      }
    }
    bike.userData.vehicleToppled = false;
    this.reset(bike, [0, 0, 0]);
    return true;
  }

  step(bike: THREE.Object3D, speed: number, verticalSpeed: number, dt: number, excluded?: RAPIER.Collider, controls: BikeControls = {}) {
    const body = bike.userData.rigidBody as RAPIER.RigidBody;
    const dims = bike.userData.originalScale;
    const gravityUp = vehicleUp(bike);
    let state = this.states.get(bike);
    if (!state || state.body !== body) {
      // Upgrade existing/saved motorcycles as well as newly placed ones.
      body.collider(0).setShape(motorbikeCollider(dims).shape);
      state = { velocity: this.initialVelocities.get(bike)?.clone() ?? FORWARD.clone().applyQuaternion(bike.quaternion).multiplyScalar(speed).addScaledVector(gravityUp, verticalSpeed), angular: new THREE.Vector3(), grounded: false, jumpTime: 0, body, recovering: false, gravityFrame: vehicleGravity(bike).frame.clone(), crashLatched: bike.userData.vehicleToppled === true, stableTime: 0, restingNormal: gravityUp.clone(), restingSide: 0 };
      this.initialVelocities.delete(bike);
      this.states.set(bike, state);
    }
    const gravity = vehicleGravity(bike);
    if (state.gravityFrame.angleTo(gravity.frame) > 1e-6) {
      state.velocity.applyQuaternion(gravity.frame.clone().multiply(state.gravityFrame.clone().invert()));
      state.gravityFrame.copy(gravity.frame);
      state.restingNormal.copy(gravityUp);
      state.restingTarget = undefined;
      state.recoveryTarget = undefined;
      state.invertedDeparture = false;
      state.invertedSupport = false;
    }
    if (dt <= 0) return { speed, verticalSpeed, travel: 0, grounded: state.grounded, crashed: false, toppled: bike.userData.vehicleToppled === true };
    const departing = this.departingRiders.get(bike);
    if (departing) { departing.remaining -= dt; if (departing.remaining <= 0) this.departingRiders.delete(bike); }
    const automatic = bike.userData.logicProperties?.autoStabilize !== false;
    const filter = (other: RAPIER.Collider) => {
      if (other === excluded) return false;
      if (departing && departing.remaining > 0 && other === departing.collider) return false;
      const colAny = other as any;
      if (colAny.isTronWall && colAny.ownerBike === bike) {
        if (colAny.segMid && (colAny.segMid as THREE.Vector3).distanceTo(bike.position) < 3.0) {
          return false;
        }
      }
      return true;
    };
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    let travel = 0;
    let driveSpeed = speed;
    let crashed = false;
    if (controls.jump && controls.jump > 0) {
      const surfaceUp = Y.clone().applyQuaternion(bike.quaternion);
      const jumpUp = state.grounded && surfaceUp.dot(gravityUp) < 0 ? surfaceUp : gravityUp;
      state.velocity.addScaledVector(jumpUp, Math.max(0, controls.jump - state.velocity.dot(jumpUp)));
      state.jumpTime = 0.18;
      state.grounded = false;
    }
    for (let step = 0; step < steps; step++) {
      let settled = false;
      if (bike.userData.vehicleToppled && !automatic && !gravity.start) {
        // A fallen bike rests on its side, never balanced on its roof or nose.
        // Keep collision-aware clearance, then let gravity lower it to contact.
        if (!state.restingTarget) {
          const restingUp = state.restingNormal;
          let heading = FORWARD.clone().applyQuaternion(bike.quaternion).projectOnPlane(restingUp);
          if (heading.lengthSq() < 0.01) heading = new THREE.Vector3(1, 0, 0).applyQuaternion(bike.quaternion).cross(restingUp);
          heading.normalize();
          state.restingSide = new THREE.Vector3(1, 0, 0).applyQuaternion(bike.quaternion).dot(restingUp) < 0 ? -1 : 1;
          state.restingTarget = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(heading.clone().cross(restingUp), restingUp, heading.negate()))
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), state.restingSide * Math.PI / 2));
        }
        const target = state.restingTarget;
        if (bike.quaternion.angleTo(target) > 0.005) this.stabilize(bike, h * 3, filter, target);
        settled = bike.quaternion.angleTo(target) < 0.01;
        state.angular.set(0, 0, 0);
      }
      state.jumpTime = Math.max(0, state.jumpTime - h);
      const up = Y.clone().applyQuaternion(bike.quaternion);
      const forward = FORWARD.clone().applyQuaternion(bike.quaternion);
      const normal = new THREE.Vector3();
      const contacts: THREE.Vector3[] = [];
      // A small tire footprint averages neighboring triangles and bridges stair
      // edges. Only surfaces within suspension travel may support the wheels.
      for (const wheel of [-1, 1]) {
        let closest: { point: THREE.Vector3; normal: THREE.Vector3; distance: number } | null = null;
        for (const offset of [-0.12, 0, 0.12]) {
          const origin = new THREE.Vector3(0, 0.12, wheel * dims.z * 0.43 + offset * dims.y).applyQuaternion(bike.quaternion).add(bike.position);
          const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(origin, up.clone().negate()), dims.y / 2 + 0.38, true,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, excluded, body, filter);
          if (!hit) continue;
          const n = new THREE.Vector3().copy(hit.normal as THREE.Vector3);
          if (n.dot(up) < 0.35) continue;
          const point = origin.clone().addScaledVector(up, -hit.timeOfImpact);
          if (!closest || hit.timeOfImpact < closest.distance) closest = { point, normal: n, distance: hit.timeOfImpact };
        }
        if (closest) {
          // Read both sides of the tire. A single triangle normal on the seam
          // of a torus adds a tiny sideways steer that accumulates every lap.
          const sides: THREE.Vector3[] = [];
          for (const side of [-1, 1]) {
            const origin = new THREE.Vector3(side * dims.x * 0.22, 0.12, wheel * dims.z * 0.43).applyQuaternion(bike.quaternion).add(bike.position);
            const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(origin, up.clone().negate()), dims.y / 2 + 0.38, true,
              RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, excluded, body, filter);
            if (hit && Math.abs(hit.timeOfImpact - closest.distance) < 0.15) {
              const sideNormal = new THREE.Vector3().copy(hit.normal as THREE.Vector3);
              if (sideNormal.dot(closest.normal) > 0.85) sides.push(sideNormal);
            }
          }
          if (sides.length === 2) closest.normal.copy(sides[0]).add(sides[1]).normalize();
          contacts.push(closest.point); normal.add(closest.normal);
        }
      }
      if (contacts.length) normal.normalize();
      if (contacts.length === 2) {
        const along = contacts[0].clone().sub(contacts[1]).normalize();
        const axle = new THREE.Vector3().crossVectors(forward, up).normalize();
        const wheelNormal = new THREE.Vector3().crossVectors(axle, along).normalize();
        if (wheelNormal.dot(normal) > 0.7) normal.lerp(wheelNormal, 0.7).normalize();
      }
      if (normal.dot(gravityUp) > 0.9995) normal.copy(gravityUp);
      // No ground magnetism: a separating wheel at a crest must launch. Normal
      // impulses can push away from a surface, never pull the bike onto it.
      const separating = contacts.length && state.velocity.dot(normal) > Math.max(1.2, state.velocity.length() * 0.12);
      const slope = normal.dot(gravityUp);
      // Steep riding needs momentum. Once it is lost, gravity owns translation;
      // wheel proximity alone cannot keep a stopped bike glued to a wall.
      const minimumSpeed = 5 * THREE.MathUtils.smoothstep(1 - slope, 0.35, 1);
      const hasTraction = slope > 0.65 || state.velocity.clone().projectOnPlane(normal).length() >= minimumSpeed;
      const wheelSupport = hasTraction && !bike.userData.vehicleToppled && !gravity.start && contacts.length > 0 && state.jumpTime === 0 && !separating;
      // Use the last actual support, not the airborne pose at departure: a
      // near-vertical ramp lip or a subsequent flip is not ceiling riding.
      if (state.surfaceSupported && !wheelSupport && !gravity.start) state.invertedDeparture = state.invertedSupport === true;
      const landingAssist = controls.stabilize && bike.userData.logicProperties?.landingAssistEnabled !== false &&
        (bike.userData.logicProperties?.landingAssistMode !== 'inverted-detach' || state.invertedDeparture) &&
        !bike.userData.vehicleToppled && !state.groundRecovery;
      const groundAssist = automatic && (state.groundRecovery || bike.userData.vehicleToppled);
      if (!landingAssist && !groundAssist) { state.recovering = false; state.recoveryTarget = undefined; }
      const recoveryReady = state.recoveryTarget && bike.quaternion.angleTo(state.recoveryTarget) < 0.035;
      const supported = wheelSupport && (!state.recovering || recoveryReady);
      if (supported) {
        state.invertedDeparture = false;
        state.recovering = false;
        state.groundRecovery = false;
        state.recoveryTarget = undefined;
        let tangent = forward.clone().projectOnPlane(normal).normalize();
        if (tangent.lengthSq() < 0.5) tangent.copy(forward);
        const right = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, tangent.clone().negate()));
        const aligned = bike.quaternion.clone().rotateTowards(rotation, h * 7);
        if (contacts.length === 1) {
          // Rotate around the supporting wheel, not the chassis center. The
          // latter pushed the low end into the floor at every small landing.
          const delta = aligned.clone().multiply(bike.quaternion.clone().invert());
          const position = bike.position.clone().sub(contacts[0]).applyQuaternion(delta).add(contacts[0]);
          const lift = position.clone().sub(bike.position);
          const blocked = this.world.castShape(bike.position, bike.quaternion, lift, body.collider(0).shape, 0.001, 1, false,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
          if (!blocked && !this.world.intersectionWithShape(position, aligned, body.collider(0).shape,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter)) {
            bike.position.copy(position); bike.quaternion.copy(aligned);
          }
        } else bike.quaternion.copy(aligned);
        if (controls.yawRate) bike.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(normal, controls.yawRate * h));
        tangent.copy(FORWARD).applyQuaternion(bike.quaternion).projectOnPlane(normal).normalize();
        // Gravity costs speed uphill and adds speed downhill, including near-vertical transitions.
        if (!state.grounded) driveSpeed = state.velocity.dot(tangent);
        driveSpeed -= 22 * gravityUp.dot(tangent) * h;
        state.velocity.copy(tangent).multiplyScalar(driveSpeed);
        state.angular.multiplyScalar(Math.exp(-10 * h));
        this.controller.enableAutostep(Math.min(0.32, dims.y * 0.25), Math.min(0.2, dims.z * 0.08), false);
      } else {
        // Wheel contact is evaluated first: an inverted rider inside a loop is
        // driving, not crashing. Recovery only acts after losing that support.
        // Air recovery is held, never latched by attitude or loss of contact.
        // Releasing Shift restores trick input even partway through righting.
        if (!gravity.start && (landingAssist || groundAssist)) {
          state.recovering = true;
          if (!state.recoveryTarget) {
            // Choose the landing heading once, from momentum rather than the
            // rotating chassis. Holding the throttle must not cancel recovery.
            let heading = state.velocity.clone().projectOnPlane(gravityUp).multiplyScalar(Math.sign(speed || 1));
            if (heading.lengthSq() < 0.25) heading = forward.clone().projectOnPlane(gravityUp);
            if (heading.lengthSq() < 0.01) heading = new THREE.Vector3(1, 0, 0).applyQuaternion(bike.quaternion).cross(gravityUp);
            heading.normalize();
            state.recoveryTarget = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(heading.clone().cross(gravityUp), gravityUp, heading.negate()));
          }
          this.stabilize(bike, h * 6, filter, state.recoveryTarget);
          state.angular.set(0, 0, 0);
          if (bike.quaternion.angleTo(state.recoveryTarget) < 0.035) {
            // Keep the prepared pose while assistance is held. Releasing it
            // clears recovery at the next step and immediately restores tricks.
            bike.userData.vehicleToppled = false;
          }
        }
        this.controller.disableAutostep();
        state.velocity.addScaledVector(gravityUp, -22 * h);
        if (controls.boost) state.velocity.addScaledVector(forward, controls.boost * h);
        const target = gravity.start || state.recovering || bike.userData.vehicleToppled ? new THREE.Vector3() : new THREE.Vector3(controls.pitch || 0, controls.yaw || 0, controls.roll || 0).multiplyScalar(3.2);
        state.angular.lerp(target, 1 - Math.exp(-5 * h));
        const angle = state.angular.length() * h;
        if (angle > 0 && !gravity.start) {
          const rotation = bike.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(state.angular.clone().normalize(), angle)).normalize();
          // Limit the angular sweep too; a trick cannot rotate through a wall.
          const blocked = this.world.intersectionWithShape(bike.position, rotation, body.collider(0).shape,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
          if (!blocked) bike.quaternion.copy(rotation);
          else state.angular.set(0, 0, 0);
        }
      }
      state.grounded = Boolean(supported);
      state.surfaceSupported = Boolean(supported);
      // Both the supporting surface and the bike must face within 45 degrees
      // of upside down. Clear on other support so eligibility cannot go stale.
      state.invertedSupport = Boolean(supported && normal.dot(gravityUp) < -Math.SQRT1_2 &&
        Y.clone().applyQuaternion(bike.quaternion).dot(gravityUp) < -Math.SQRT1_2);
      state.stableTime = supported && contacts.length === 2 ? state.stableTime + h : 0;
      if (state.stableTime > 0.3) { state.crashLatched = false; state.restingTarget = undefined; }
      body.setRotation(bike.quaternion, true);
      body.setTranslation(bike.position, true);
      this.world.propagateModifiedBodyPositionsToColliders();
      const desired = state.velocity.clone().multiplyScalar(h);
      // A small compressive contact keeps the sweep aware of the ground, without
      // replacing the launch velocity with a permanently zero vertical speed.
      if (supported) desired.addScaledVector(normal, -22 * h * h);
      this.controller.setUp(supported ? normal : gravityUp);
      this.controller.computeColliderMovement(body.collider(0), desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, filter);
      const move = new THREE.Vector3().copy(this.controller.computedMovement() as THREE.Vector3);
      let stepped = false;
      const horizontal = desired.clone().projectOnPlane(gravityUp);
      if (supported && horizontal.length() > 0.0001 && move.dot(horizontal.clone().normalize()) < horizontal.length() * 0.6 && normal.dot(gravityUp) > 0.6) {
        // Explicit swept wheel-height step: test ceiling, forward clearance and
        // landing before accepting it. Tall walls and gaps cannot become steps.
        const shape = body.collider(0).shape;
        const rise = Math.min(0.34, dims.y * 0.28);
        const cast = (position: THREE.Vector3, delta: THREE.Vector3) => this.world.castShape(position, bike.quaternion, delta, shape, 0.005, 1, false,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter);
        const lift = gravityUp.clone().multiplyScalar(rise);
        if (!cast(bike.position, lift)) {
          const raised = bike.position.clone().add(lift);
          const advance = horizontal.clone().normalize().multiplyScalar(Math.max(0.12, horizontal.length()));
          if (!cast(raised, advance)) {
            const landing = raised.clone().add(advance);
            const down = gravityUp.clone().multiplyScalar(-(rise + 0.04));
            const floor = cast(landing, down);
            if (floor && new THREE.Vector3().copy(floor.normal1 as THREE.Vector3).dot(gravityUp) > 0.6) {
              landing.addScaledVector(down, floor.time_of_impact);
              const height = landing.clone().sub(bike.position).dot(gravityUp);
              if (height > 0.01 && height <= rise + 0.005) {
                move.copy(landing).sub(bike.position);
                stepped = true;
              }
            }
          }
        }
      }
      let bodyOnFloor = false;
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
        const collision = this.controller.computedCollision(i);
        if (!collision) continue;
        const n = new THREE.Vector3().copy(collision.normal1 as THREE.Vector3);
        if (n.dot(gravityUp) > 0.55) { bodyOnFloor = true; state.restingNormal.copy(n); }
        const into = state.velocity.dot(n);
        const passedStep = supported && move.clone().projectOnPlane(gravityUp).length() >= desired.clone().projectOnPlane(gravityUp).length() * 0.8;
        if (!stepped && into < 0 && !(supported && n.dot(up) > 0.35) && !(passedStep && n.dot(gravityUp) < 0.5)) state.velocity.addScaledVector(n, -into);
      }
      if (bodyOnFloor && !supported && !gravity.start && Y.clone().applyQuaternion(bike.quaternion).dot(gravityUp) < 0.45) {
        if (!state.crashLatched) { crashed = true; state.crashLatched = true; }
        if (automatic) { state.recovering = true; state.groundRecovery = true; }
        else bike.userData.vehicleToppled = true;
      }
      if (bodyOnFloor) state.invertedDeparture = false;
      // During the brief clearance lift used to roll onto its side, the body
      // still skids against the ground. Do not alternate friction on/off.
      let skidding = bodyOnFloor;
      if (!skidding && bike.userData.vehicleToppled) {
        const radius = Math.min(dims.x, dims.y, dims.z) * 0.24;
        const extent = radius + ['x', 'y', 'z'].reduce((sum, axis, index) => sum + Math.abs(new THREE.Vector3().setComponent(index, 1).applyQuaternion(bike.quaternion).dot(gravityUp)) * (dims[axis] / 2 - radius), 0);
        skidding = Boolean(this.world.castRay(new RAPIER.Ray(bike.position, gravityUp.clone().negate()), extent + 0.1, true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, filter));
      }
      if (skidding && !supported) {
        const length = state.velocity.length();
        const friction = bike.userData.vehicleToppled ? 10 + length * 1.5 : 3;
        const vertical = state.velocity.dot(gravityUp);
        const slide = state.velocity.clone().projectOnPlane(gravityUp);
        slide.multiplyScalar(Math.max(0, slide.length() - friction * h) / Math.max(slide.length(), 0.00001));
        state.velocity.copy(slide).addScaledVector(gravityUp, vertical);
        if (bodyOnFloor && bike.userData.vehicleToppled && !automatic && settled && state.velocity.length() < 0.1) {
          state.velocity.set(0, 0, 0); driveSpeed = 0; state.grounded = true;
        }
      }
      bike.position.add(move);
      travel += move.length();
      if (supported) driveSpeed = Math.sign(driveSpeed) * state.velocity.length();
    }
    body.setTranslation(bike.position, true);
    body.setNextKinematicTranslation(bike.position);
    body.setNextKinematicRotation(bike.quaternion);
    const reportedSpeed = state.grounded ? driveSpeed : Math.sign(speed || 1) * state.velocity.clone().projectOnPlane(gravityUp).length();
    return { speed: Math.abs(reportedSpeed) < 0.005 ? 0 : reportedSpeed, verticalSpeed: state.velocity.dot(gravityUp), travel, grounded: state.grounded, toppled: bike.userData.vehicleToppled === true, crashed };
  }
}

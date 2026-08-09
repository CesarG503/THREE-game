import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { consumeFuel } from '../items/Fuel';
import { normalizeMotorbikeSettings } from './MotorbikeSettings';
import { RiderPose } from './RiderPose';
import { VehicleFall } from './VehicleFall';
import type { MotorbikeVisual } from './MotorbikeModel';

/** XYZ Euler.y folds at ±90°. Derive the full heading from the actual forward vector. */
export function getMotorbikeHeading(bike: THREE.Object3D): number {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.quaternion);
  return Math.atan2(-forward.x, -forward.z);
}

export class VehicleSystem {
  mounted: MotorbikeVisual | null = null;
  speed = 0;
  private verticalSpeed = 0;
  private steering = 0;
  private lean = 0;
  private controller: RAPIER.KinematicCharacterController;
  private pose = new RiderPose();
  private fall = new VehicleFall();
  private coasting = new Map<MotorbikeVisual, { speed: number; verticalSpeed: number; local: boolean }>();
  private wasSensor = false;
  private hud: HTMLDivElement | null = null;
  private fuelBar: HTMLProgressElement | null = null;
  private readout: HTMLDivElement | null = null;
  private lastRiderPosition = new THREE.Vector3();

  constructor(private game: any) {
    this.controller = game.world.createCharacterController(0.025);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    if (typeof document !== 'undefined') {
      this.hud = document.createElement('div');
      this.hud.id = 'motorbike-hud';
      this.hud.style.cssText = 'display:none;position:fixed;bottom:145px;left:50%;transform:translateX(-50%);max-width:90vw;padding:12px 18px;border:1px solid #43d9d066;border-radius:12px;background:#10212ee8;color:#eefaff;text-align:center;font:13px system-ui;pointer-events:none;z-index:100';
      this.readout = document.createElement('div');
      this.fuelBar = document.createElement('progress');
      this.fuelBar.setAttribute('aria-label', 'Combustible de la motocicleta');
      this.fuelBar.style.cssText = 'display:block;width:100%;height:9px;margin-top:9px;accent-color:#43d9d0';
      this.hud.append(this.readout, this.fuelBar);
      document.body.appendChild(this.hud);
    }
  }

  private get bikes(): MotorbikeVisual[] {
    return this.game.sceneManager.scene.children.filter((obj: THREE.Object3D) => obj.userData.mapObjectType === 'motorbike');
  }
  private get paused() {
    return !this.game.inputManager.enabled || this.game.cameraController?.isUIOpen || this.game.cameraController?.isPaused;
  }
  nearest(): MotorbikeVisual | null {
    const character = this.game.character;
    if (character.isDead || this.paused || this.fall.active) return null;
    const position = character.getPosition();
    let nearest: MotorbikeVisual | null = null;
    let distance = 9;
    for (const bike of this.bikes) {
      if (!bike.visible || bike.userData.invisible || bike.userData.vehicleDriver) continue;
      const candidate = position.distanceToSquared(bike.position);
      if (candidate >= distance || !bike.userData.rigidBody?.isValid()) continue;
      // Interacting through a wall should not mount a vehicle.
      const origin = position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const direction = bike.position.clone().sub(origin);
      const hit = this.game.world.castRay(new RAPIER.Ray(origin, direction.normalize()), origin.distanceTo(bike.position), true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, character.collider, bike.userData.rigidBody);
      if (hit) continue;
      nearest = bike;
      distance = candidate;
    }
    return nearest;
  }

  nearestMountHoldTime(): number | null {
    const bike = this.nearest();
    if (!bike) return null;
    bike.userData.logicProperties = normalizeMotorbikeSettings(bike.userData.logicProperties);
    return bike.userData.logicProperties.holdTime;
  }

  interact(): boolean {
    if (this.mounted) {
      this.dismount();
      return true;
    }
    const bike = this.nearest();
    if (!bike) return false;
    const character = this.game.character;
    if (character.getGravityUpVector().y < 0.99 || this.game.gravityQteActive) return false;
    this.mounted = bike;
    bike.userData.logicProperties = normalizeMotorbikeSettings(bike.userData.logicProperties);
    bike.userData.vehicleDriver = this.game.networkManager?.playerId || 'local';
    bike.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const motion = this.coasting.get(bike);
    this.speed = motion?.speed ?? 0;
    this.verticalSpeed = motion?.verticalSpeed ?? 0;
    this.coasting.delete(bike);
    this.steering = this.lean = 0;
    this.wasSensor = character.collider.isSensor();
    character.collider.setSensor(true);
    character.isFlying = character.isClimbing = character.isUsingJetpack = character.isSuperman = false;
    character.verticalVelocity = 0;
    character.momentum.set(0, 0, 0);
    character.isMounted = true;
    // Clear the walking animation before caching the seated pose.
    character.polygonModelSkin?.update(0, false);
    this.syncRider(0);
    return true;
  }

  private findExit(): THREE.Vector3 | null {
    const bike = this.mounted!;
    const character = this.game.character;
    const dims = bike.userData.originalScale;
    for (const offset of [new THREE.Vector3(dims.x / 2 + 0.85, 0, 0), new THREE.Vector3(-dims.x / 2 - 0.85, 0, 0), new THREE.Vector3(0, 0, dims.z / 2 + 0.85), new THREE.Vector3(0, 0, -dims.z / 2 - 0.85)]) {
      const position = offset.applyQuaternion(bike.quaternion).add(bike.position);
      const origin = position.clone().add(new THREE.Vector3(0, 2, 0));
      const floor = this.game.world.castRay(new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }), 5, true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, character.collider, bike.userData.rigidBody);
      if (!floor) continue;
      position.y = origin.y - floor.timeOfImpact + Math.max(0, character.capsuleHalfHeight + character.capsuleRadius - character.capsuleCenterOffset) + 0.05;
      const center = position.clone().add(new THREE.Vector3(0, character.capsuleCenterOffset, 0));
      const blocked = this.game.world.intersectionWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, character.collider.shape,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, character.collider);
      if (!blocked) return position;
    }
    return null;
  }

  dismount(force = false): boolean {
    if (!this.mounted) return false;
    const bike = this.mounted;
    const character = this.game.character;
    const exit = force ? null : this.findExit();
    if (!force && !exit) {
      this.show('No hay espacio libre para bajar. Mueve la moto e intenta de nuevo.');
      return false;
    }
    const finalState = this.getNetworkState();
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    const exitSpeed = this.speed;
    const velocity = new THREE.Vector3(0, 0, -exitSpeed).applyQuaternion(bike.quaternion);
    delete bike.userData.vehicleDriver;
    this.startCoasting(bike, exitSpeed, this.verticalSpeed, true);
    if (finalState && this.game.networkManager?.isConnected) {
      this.game.networkManager.sendPlayerAction('motorbikePark', finalState);
    }
    bike.animateMotorbike?.(0, 0, 0);
    this.mounted = null;
    character.isMounted = false;
    if (character.collider?.isValid()) character.collider.setSensor(this.wasSensor);
    if (exit && character.rigidBody?.isValid()) {
      character.rigidBody.setTranslation(exit, true);
      character.rigidBody.setNextKinematicTranslation(exit);
    }
    character.verticalVelocity = 0;
    character.momentum.set(0, 0, 0);
    this.pose.reset();
    character.updateModelVisuals();
    if (!force && props.dismountPenaltyEnabled && Math.abs(exitSpeed) * 3.6 >= props.dismountFallSpeed) {
      this.fall.start(character, velocity);
      const damage = character.maxHealth * props.dismountDamagePercent / 100;
      if (damage > 0) character.takeDamage(damage);
      if (character.isDead) this.fall.reset(character);
    }
    this.speed = this.lean = 0;
    if (this.hud) this.hud.style.display = 'none';
    return true;
  }

  /** Returns true while the vehicle owns movement and avatar animation. */
  update(delta: number): boolean {
    const dt = Number.isFinite(delta) ? Math.min(0.05, Math.max(0, delta)) : 0;
    this.updateCoasting(dt);
    if (!this.mounted) {
      if (this.hud) this.hud.style.display = 'none';
      return this.fall.update(this.game.character, this.controller, this.paused ? 0 : dt);
    }
    const bike = this.mounted;
    const character = this.game.character;
    const body: RAPIER.RigidBody = bike.userData.rigidBody;
    if (!bike.parent || !body?.isValid() || character.isDead || character.getPosition().distanceTo(this.lastRiderPosition) > 4 || character.getGravityUpVector().y < 0.99) {
      this.dismount(true);
      return false;
    }
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    Object.assign(bike.userData.logicProperties, props);
    const keys = this.game.inputManager.keys;
    const throttle = this.paused ? 0 : Number(keys.forward) - Number(keys.backward);
    const brake = this.paused || keys.jump;
    const powered = !brake && throttle !== 0 && props.consumableUse > 0;
    const targetSpeed = powered ? (throttle > 0 ? props.maxSpeed : -props.reverseSpeed) : 0;
    const rate = brake || (throttle !== 0 && Math.sign(this.speed) !== Math.sign(throttle) && Math.abs(this.speed) > 0.1) ? props.braking : powered ? props.acceleration : 3;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), rate * dt);
    if (powered) consumeFuel(bike.userData.logicProperties, dt, props.fuelConsumption);
    const steeringTarget = this.paused ? 0 : Number(keys.left) - Number(keys.right);
    this.steering = THREE.MathUtils.lerp(this.steering, steeringTarget, 1 - Math.exp(-10 * dt));
    const yaw = getMotorbikeHeading(bike) + this.steering * THREE.MathUtils.degToRad(props.turnSpeed) * Math.min(Math.abs(this.speed) / 4, 1) * Math.sign(this.speed) * dt;
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const collider = body.collider(0);
    // Test the rotated footprint as well as sweeping the translation.
    const blockedRotation = this.game.world.intersectionWithShape(body.translation(), rotation, collider.shape,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider, body,
      (other: RAPIER.Collider) => other !== character.collider);
    if (!blockedRotation) {
      body.setRotation(rotation, true);
      bike.quaternion.copy(rotation);
    }
    const motion = this.moveBike(bike, this.speed, this.verticalSpeed, dt, true);
    this.speed = motion.speed;
    this.verticalSpeed = motion.verticalSpeed;
    const travel = motion.travel;
    this.lean = THREE.MathUtils.lerp(this.lean, this.steering * THREE.MathUtils.degToRad(props.maxLean) * Math.min(Math.abs(this.speed) / 10, 1), 1 - Math.exp(-8 * dt));
    bike.animateMotorbike?.(travel * Math.sign(this.speed), this.steering, this.lean);
    this.syncRider(dt);
    const fuel = bike.userData.logicProperties.consumableUse;
    this.show(`${Math.round(Math.abs(this.speed) * 3.6)} km/h · Combustible ${Math.ceil(fuel)} / ${props.maxConsumableUse}${fuel <= 0 ? ' · SIN COMBUSTIBLE' : ''}\nW/S acelerar · A/D girar · Espacio frenar · F bajar`, fuel, props.maxConsumableUse);
    return true;
  }

  private startCoasting(bike: MotorbikeVisual, speed: number, verticalSpeed: number, local: boolean) {
    const body: RAPIER.RigidBody = bike.userData.rigidBody;
    if (!bike.parent || !body?.isValid()) return;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    // The render position can be one physics step ahead when F is pressed.
    body.setTranslation(bike.position, true);
    body.setNextKinematicTranslation(bike.position);
    this.coasting.set(bike, { speed, verticalSpeed, local });
  }

  private moveBike(bike: MotorbikeVisual, speed: number, verticalSpeed: number, dt: number, hasRider = false) {
    const body: RAPIER.RigidBody = bike.userData.rigidBody;
    verticalSpeed = Math.max(-40, verticalSpeed - 22 * dt);
    const desired = new THREE.Vector3(0, 0, -speed * dt).applyQuaternion(bike.quaternion);
    desired.y = verticalSpeed * dt;
    this.controller.computeColliderMovement(body.collider(0), desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined,
      (other: RAPIER.Collider) => !hasRider || other !== this.game.character.collider);
    const movement = this.controller.computedMovement();
    const position = body.translation();
    const next = new THREE.Vector3(position.x + movement.x, position.y + movement.y, position.z + movement.z);
    body.setNextKinematicTranslation(next);
    bike.position.copy(next);
    const grounded = this.controller.computedGrounded();
    if (grounded) verticalSpeed = 0;
    const travel = Math.hypot(movement.x, movement.z);
    if (Math.abs(speed) * dt > 0.01 && travel < Math.abs(speed) * dt * 0.25) speed *= 0.5;
    return { speed, verticalSpeed, travel, grounded };
  }

  private updateCoasting(dt: number) {
    if (dt <= 0) return;
    for (const [bike, state] of this.coasting) {
      const body: RAPIER.RigidBody = bike.userData.rigidBody;
      if (!bike.parent || !body?.isValid() || bike.userData.vehicleDriver) {
        this.coasting.delete(bike);
        continue;
      }
      // Same rolling resistance as releasing the throttle while mounted; no engine/fuel use.
      state.speed = Math.sign(state.speed) * Math.max(0, Math.abs(state.speed) - 3 * dt);
      const motion = this.moveBike(bike, state.speed, state.verticalSpeed, dt);
      state.speed = motion.speed;
      state.verticalSpeed = motion.verticalSpeed;
      bike.animateMotorbike?.(motion.travel * Math.sign(state.speed), 0, 0);
      if (Math.abs(state.speed) < 0.02 && motion.grounded) {
        body.setTranslation(bike.position, true);
        body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.coasting.delete(bike);
        if (state.local && this.game.networkManager?.isConnected) {
          this.game.networkManager.sendPlayerAction('motorbikePark', this.networkStateFor(bike, 0, 0, 0, 0));
        }
      }
    }
  }

  private syncRider(dt: number) {
    const bike = this.mounted!;
    const character = this.game.character;
    const props = bike.userData.logicProperties;
    const hipHeight = character.currentType === 'skin' ? 0.625 : 0.7;
    const position = new THREE.Vector3(0, props.seatHeight - bike.userData.originalScale.y / 2 - hipHeight, props.seatOffsetZ)
      .applyQuaternion(bike.quaternion).add(bike.position);
    character.rigidBody.setTranslation(position, true);
    character.rigidBody.setNextKinematicTranslation(position);
    this.lastRiderPosition.copy(position);
    character.currentRotation = getMotorbikeHeading(bike);
    character.grounded = true;
    character.isRunning = false;
    character.updateModelVisuals();
    for (const model of [character.glbModel?.model, character.polygonModel?.model, character.polygonModelSkin?.model]) {
      if (model) model.rotateZ(character.currentType === 'glb' && model === character.glbModel?.model ? this.lean : -this.lean);
    }
    this.pose.apply(character, dt, this.speed, this.steering, props.riderLean);
  }

  getNetworkState() {
    const bike = this.mounted;
    if (!bike) return null;
    return this.networkStateFor(bike, this.speed, this.verticalSpeed, this.steering, this.lean);
  }

  private networkStateFor(bike: MotorbikeVisual, speed: number, verticalSpeed: number, steering: number, lean: number) {
    return {
      uuid: bike.userData.uuid,
      position: { x: bike.position.x, y: bike.position.y, z: bike.position.z },
      yaw: getMotorbikeHeading(bike),
      fuel: bike.userData.logicProperties.consumableUse,
      speed, verticalSpeed, steering, lean,
      riderLean: bike.userData.logicProperties.riderLean,
      seatHeight: bike.userData.logicProperties.seatHeight,
      seatOffsetZ: bike.userData.logicProperties.seatOffsetZ
    };
  }

  private validNetworkState(state: any) {
    return state && typeof state.uuid === 'string' &&
      [state.position?.x, state.position?.y, state.position?.z, state.yaw, state.fuel, state.speed, state.verticalSpeed ?? 0, state.steering, state.lean, state.riderLean, state.seatHeight, state.seatOffsetZ]
        .every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e6);
  }

  receivePark(playerId: string, state: any) {
    if (!this.validNetworkState(state)) return;
    const bike = this.bikes.find(candidate => candidate.userData.uuid === state.uuid);
    if (!bike || bike === this.mounted || (bike.userData.vehicleDriver && bike.userData.vehicleDriver !== playerId)) return;
    this.applyRemoteTransform(bike, state.position, state.yaw);
    bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
    delete bike.userData.vehicleDriver;
    this.startCoasting(bike, state.speed, state.verticalSpeed ?? 0, false);
    bike.animateMotorbike?.(0, 0, 0);
    const player = this.game.networkManager?.remotePlayers.get(playerId);
    if (player?.state.motorbike?.uuid === state.uuid) player.state.motorbike = null;
  }

  private applyRemoteTransform(bike: MotorbikeVisual, position: { x: number; y: number; z: number }, yaw: number) {
    bike.position.copy(position as THREE.Vector3);
    bike.rotation.set(0, yaw, 0);
    const body = bike.userData.rigidBody;
    if (body?.isValid()) {
      body.setTranslation(bike.position, true);
      if (body.isKinematic()) body.setNextKinematicTranslation(bike.position);
      body.setRotation(bike.quaternion, true);
    }
  }

  syncRemote(dt: number) {
    const network = this.game.networkManager;
    if (!network) return;
    const occupied = new Set<MotorbikeVisual>();
    // A stable winner also resolves simultaneous mount requests consistently on both clients.
    const riders = [...network.remotePlayers.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
    for (const [playerId, player] of riders as Array<[string, any]>) {
      const state = player.state?.motorbike;
      if (!this.validNetworkState(state)) continue;
      const bike = this.bikes.find(candidate => candidate.userData.uuid === state.uuid);
      if (!bike || occupied.has(bike)) continue;
      if (bike === this.mounted) {
        if (String(network.playerId).localeCompare(playerId) < 0) continue;
        this.dismount(true);
      }
      occupied.add(bike);
      this.coasting.delete(bike);
      bike.userData.vehicleDriver = playerId;
      const yaw = player.currentRotation;
      const hip = player.currentType === 'skin' ? 0.625 : 0.7;
      const seat = new THREE.Vector3(0, state.seatHeight - bike.userData.originalScale.y / 2 - hip, state.seatOffsetZ)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const position = player.currentPosition.clone().sub(seat);
      this.applyRemoteTransform(bike, position, yaw);
      bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
      bike.animateMotorbike?.(state.speed * Math.min(dt, 0.05), state.steering, state.lean);
    }
    for (const bike of this.bikes) {
      if (bike !== this.mounted && bike.userData.vehicleDriver && !occupied.has(bike)) {
        delete bike.userData.vehicleDriver;
        bike.animateMotorbike?.(0, 0, 0);
      }
    }
  }

  private show(message: string, fuel?: number, maxFuel = 1) {
    if (!this.hud || !this.readout || !this.fuelBar) return;
    this.hud.style.display = 'block';
    this.readout.style.whiteSpace = 'pre-line';
    this.readout.textContent = message;
    this.fuelBar.style.display = fuel === undefined ? 'none' : 'block';
    this.fuelBar.max = maxFuel;
    this.fuelBar.value = fuel ?? 0;
  }
  dispose() {
    this.dismount(true);
    this.fall.reset(this.game.character);
    for (const [bike] of this.coasting) {
      const body = bike.userData.rigidBody;
      if (!body?.isValid()) continue;
      body.setTranslation(bike.position, true);
      body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.coasting.clear();
    this.game.world.removeCharacterController(this.controller);
    this.hud?.remove();
  }
}

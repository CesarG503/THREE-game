import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { consumeFuel } from '../items/Fuel';
import { normalizeMotorbikeSettings, MAX_PASSENGER_YAW } from './MotorbikeSettings';
import { RiderPose } from './RiderPose';
import { VehicleFall } from './VehicleFall';
import { resolveVehicleSeats, type VehicleSeat } from './VehicleSeats';
import type { MotorbikeVisual } from './MotorbikeModel';

/** XYZ Euler.y folds at ±90°. Derive the full heading from the actual forward vector. */
export function getMotorbikeHeading(bike: THREE.Object3D): number {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.quaternion);
  return Math.atan2(-forward.x, -forward.z);
}

export class VehicleSystem {
  mounted: MotorbikeVisual | null = null;
  seat: VehicleSeat | null = null;
  get isDriver() { return this.mounted !== null && this.seat === 'driver'; }
  get isPassenger() { return this.mounted !== null && this.seat === 'passenger'; }
  private get playerId(): string { return this.game.networkManager?.playerId || 'local'; }
  speed = 0;
  private verticalSpeed = 0;
  private steering = 0;
  private lean = 0;
  private grounded = true;
  private wasJumpDown = false;
  private jumpCooldown = 0;
  private vehicleJetpackActive = false;
  private vehicleJetpackVFX = 'Humo y Fuego';
  private controller: RAPIER.KinematicCharacterController;
  private pose = new RiderPose();
  private fall = new VehicleFall();
  private coasting = new Map<MotorbikeVisual, { speed: number; verticalSpeed: number; local: boolean }>();
  private wasSensor = false;
  private hud: HTMLDivElement | null = null;
  private fuelBar: HTMLProgressElement | null = null;
  private readout: HTMLDivElement | null = null;
  private lastRiderPosition = new THREE.Vector3();
  private lastBikeYaw = 0;
  private lastSeatSwitchTime = 0;
  private remoteMotionSamples = new WeakMap<MotorbikeVisual, { state: any; age: number }>();

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
      if (!bike.visible || bike.userData.invisible || (bike.userData.vehicleDriver && bike.userData.vehiclePassenger)) continue;
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
    this.lastSeatSwitchTime = Date.now();
    this.seat = bike.userData.vehicleDriver ? 'passenger' : 'driver';
    bike.userData.logicProperties = normalizeMotorbikeSettings(bike.userData.logicProperties);
    bike.userData[this.isDriver ? 'vehicleDriver' : 'vehiclePassenger'] = this.playerId;
    bike.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const motion = this.coasting.get(bike);
    this.speed = motion?.speed ?? bike.userData.vehicleMotion?.speed ?? 0;
    this.verticalSpeed = motion?.verticalSpeed ?? bike.userData.vehicleMotion?.verticalSpeed ?? 0;
    if (this.isDriver) this.coasting.delete(bike);
    this.steering = this.lean = 0;
    this.grounded = true;
    this.wasJumpDown = false;
    this.jumpCooldown = 0;
    this.vehicleJetpackActive = false;
    this.wasSensor = character.collider.isSensor();
    character.collider.setSensor(true);
    character.isFlying = character.isClimbing = character.isUsingJetpack = character.isSuperman = false;
    character.verticalVelocity = 0;
    character.momentum.set(0, 0, 0);
    character.isMounted = true;
    this.lastBikeYaw = getMotorbikeHeading(bike);
    if (!this.isPassenger) this.game.cameraController?.setYawConstraint?.(null);
    character.polygonModelSkin?.update?.(0, false);
    this.syncRider(0);
    this.sendSeat();
    return true;
  }

  switchSeat(): boolean {
    if (!this.mounted || this.paused || this.game.character.isDead) return false;
    const now = Date.now();
    if (now - this.lastSeatSwitchTime < 250) return false;
    const bike = this.mounted;
    const target: VehicleSeat = this.isDriver ? 'passenger' : 'driver';
    if (bike.userData[target === 'driver' ? 'vehicleDriver' : 'vehiclePassenger']) {
      this.show('El otro asiento está ocupado. F: bajar');
      return false;
    }
    this.lastSeatSwitchTime = now;
    delete bike.userData[this.isDriver ? 'vehicleDriver' : 'vehiclePassenger'];
    this.pose.reset(this.game.character);
    this.seat = target;
    bike.userData[this.isDriver ? 'vehicleDriver' : 'vehiclePassenger'] = this.playerId;
    if (this.isDriver) {
      this.game.cameraController?.setYawConstraint?.(null);
      const motion = this.coasting.get(bike);
      this.speed = motion?.speed ?? this.speed;
      this.verticalSpeed = motion?.verticalSpeed ?? this.verticalSpeed;
      this.coasting.delete(bike);
    } else {
      this.lastBikeYaw = getMotorbikeHeading(bike);
      this.startCoasting(bike, this.speed, this.verticalSpeed, true);
    }
    this.steering = this.lean = 0;
    this.wasJumpDown = Boolean(this.game.inputManager?.keys?.jump);
    this.syncRider(0);
    this.sendSeat();
    return true;
  }

  private sendSeat() {
    if (this.game.networkManager?.isConnected) {
      this.game.networkManager.sendPlayerAction('motorbikeSeat', this.getNetworkState());
    }
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
    const wasDriver = this.isDriver;
    const field = wasDriver ? 'vehicleDriver' : 'vehiclePassenger';
    if (bike.userData[field] === this.playerId) delete bike.userData[field];
    if (!bike.userData.vehicleDriver) this.startCoasting(bike, exitSpeed, this.verticalSpeed, !bike.userData.vehiclePassenger);
    if (finalState && this.game.networkManager?.isConnected) {
      this.game.networkManager.sendPlayerAction('motorbikePark', finalState);
    }
    if (!bike.userData.vehicleDriver) bike.animateMotorbike?.(0, 0, 0);
    this.mounted = null;
    this.seat = null;
    character.isMounted = false;
    if (character.collider?.isValid()) character.collider.setSensor(this.wasSensor);
    if (exit && character.rigidBody?.isValid()) {
      character.rigidBody.setTranslation(exit, true);
      character.rigidBody.setNextKinematicTranslation(exit);
    }
    character.verticalVelocity = 0;
    character.momentum.set(0, 0, 0);
    this.pose.reset(character);
    character.updateModelVisuals();
    if (!force && props.dismountPenaltyEnabled && Math.abs(exitSpeed) * 3.6 >= props.dismountFallSpeed) {
      this.fall.start(character, velocity, this.game.sceneManager?.scene);
      const damage = character.maxHealth * props.dismountDamagePercent / 100;
      if (damage > 0) character.takeDamage(damage);
      if (character.isDead) this.fall.reset(character);
    }
    this.speed = this.lean = this.verticalSpeed = 0;
    this.grounded = true;
    this.wasJumpDown = false;
    this.jumpCooldown = 0;
    this.vehicleJetpackActive = false;
    character.isUsingJetpack = false;
    character.isSuperman = false;
    character.noPitchTilt = false;
    this.game.cameraController?.setYawConstraint?.(null);
    if (this.hud) this.hud.style.display = 'none';
    return true;
  }

  /** Returns true while the vehicle owns movement and avatar animation. */
  update(delta: number): boolean {
    const dt = Number.isFinite(delta) ? Math.min(0.05, Math.max(0, delta)) : 0;
    this.updateCoasting(dt);
    if (!this.mounted) {
      if (this.hud) this.hud.style.display = 'none';
      const falling = this.fall.update(this.game.character, this.controller, this.paused ? 0 : dt);
      if (falling) {
        this.game.character?.particleSystem?.update?.(dt);
      }
      return falling;
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
    if (this.isPassenger) {
      const motion = this.coasting.get(bike) ?? bike.userData.vehicleMotion;
      this.speed = motion?.speed ?? 0;
      this.verticalSpeed = motion?.verticalSpeed ?? 0;
      this.lean = motion?.lean ?? 0;
      const hasRemoteDriver = Boolean(bike.userData.vehicleDriver && bike.userData.vehicleDriver !== this.playerId);
      if (!hasRemoteDriver) {
        this.syncRider(dt);
      }
      this.show(`Pasajero · ${Math.round(Math.abs(this.speed) * 3.6)} km/h\nArmas y construcción disponibles · R cambiar asiento · F bajar\nMayús + R recargar / rotar construcción`, props.consumableUse, props.maxConsumableUse);
      return true;
    }
    const keys = this.game.inputManager.keys;
    const throttle = this.paused ? 0 : Number(keys.forward) - Number(keys.backward);
    const brake = this.paused || keys.crouch;
    const jetpack = this.getSelectedJetpack();
    const jetpackActive = !brake && !this.paused && keys.jump && jetpack && jetpack.consumableUse > 0;
    this.vehicleJetpackActive = Boolean(jetpackActive);
    this.vehicleJetpackVFX = jetpack?.particleVFX || 'Humo y Fuego';
    character.isUsingJetpack = this.vehicleJetpackActive;
    character.isSuperman = false;
    character.noPitchTilt = false;
    const drift = !this.paused && keys.crouch && (keys.left || keys.right);
    const driveThrottle = jetpackActive ? Math.max(throttle, 1) : throttle;
    const powered = !brake && driveThrottle !== 0 && (jetpackActive || props.consumableUse > 0);
    const maxForwardSpeed = props.maxSpeed + (jetpackActive ? props.jetpackMaxSpeedBonus : 0);
    const targetSpeed = powered ? (driveThrottle > 0 ? maxForwardSpeed : -props.reverseSpeed) : 0;
    const brakeRate = props.braking * (drift ? props.driftBrakeMultiplier : 1);
    const acceleration = props.acceleration + (jetpackActive ? props.jetpackAccelerationBonus : 0);
    const rate = brake || (driveThrottle !== 0 && Math.sign(this.speed) !== Math.sign(driveThrottle) && Math.abs(this.speed) > 0.1) ? brakeRate : powered ? acceleration : 3;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), rate * dt);
    if (jetpackActive) this.consumeVehicleJetpack(jetpack, dt);
    else if (powered) consumeFuel(bike.userData.logicProperties, dt, props.fuelConsumption);
    const steeringTarget = this.paused ? 0 : Number(keys.left) - Number(keys.right);
    this.steering = THREE.MathUtils.lerp(this.steering, steeringTarget, 1 - Math.exp(-10 * dt));
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    const jumpDown = Boolean(keys.jump);
    if (!jetpackActive && !this.paused && jumpDown && !this.wasJumpDown && this.grounded && this.jumpCooldown <= 0 && props.jumpForce > 0) {
      this.verticalSpeed = Math.max(this.verticalSpeed, props.jumpForce);
      this.grounded = false;
      this.jumpCooldown = props.jumpCooldown;
    }
    this.wasJumpDown = jumpDown;
    const speedAbs = Math.abs(this.speed);
    const movingTurn = this.steering * THREE.MathUtils.degToRad(props.turnSpeed) *
      Math.min(speedAbs / (drift ? 2 : 4), 1) * Math.sign(this.speed) * (drift ? props.driftTurnMultiplier : 1);
    const pivotTurn = brake && speedAbs < 0.35
      ? this.steering * THREE.MathUtils.degToRad(props.stationaryTurnSpeed) * (1 - THREE.MathUtils.clamp(speedAbs / 0.35, 0, 1))
      : 0;
    const yaw = getMotorbikeHeading(bike) + (movingTurn + pivotTurn) * dt;
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
    this.grounded = motion.grounded;
    const travel = motion.travel;
    this.lean = THREE.MathUtils.lerp(this.lean, this.steering * THREE.MathUtils.degToRad(props.maxLean) * Math.min(Math.abs(this.speed) / 10, 1), 1 - Math.exp(-8 * dt));
    bike.userData.vehicleMotion = { speed: this.speed, verticalSpeed: this.verticalSpeed, lean: this.lean };
    bike.animateMotorbike?.(travel * Math.sign(this.speed), this.steering, this.lean);
    if (this.vehicleJetpackActive) this.spawnBikeJetpackEffect(bike, this.vehicleJetpackVFX);
    this.syncRider(dt);
    const fuel = bike.userData.logicProperties.consumableUse;
    const jetpackFuel = jetpackActive ? ` · Jetpack ${Math.ceil(jetpack.consumableUse)} / ${jetpack.maxConsumableUse}` : '';
    this.show(`Conductor · ${Math.round(Math.abs(this.speed) * 3.6)} km/h · Combustible ${Math.ceil(fuel)} / ${props.maxConsumableUse}${jetpackFuel}${fuel <= 0 ? ' · SIN COMBUSTIBLE' : ''}\nW/S acelerar · A/D girar · Shift frenar/drift · Espacio saltar/jetpack · R cambiar asiento · F bajar`, fuel, props.maxConsumableUse);
    return true;
  }

  private getSelectedJetpack() {
    const item = this.game.inventoryManager?.getCurrentItem?.() ?? this.game.character?.equippedItem;
    if (!item || item.consumableUse === undefined) return null;
    const isJetpack = item.id === 'jetpack' ||
      (typeof item.id === 'string' && (item.id.startsWith('jetpack_') || item.id.startsWith('jetpack-') || item.id.includes('jetpack'))) ||
      item.equipSlot === 'back' ||
      item.type === 'jetpack' ||
      Boolean(item.particleVFX && item.thrust !== undefined);
    return isJetpack ? item : null;
  }

  private consumeVehicleJetpack(jetpack: any, dt: number) {
    const before = jetpack.consumableUse;
    if (typeof jetpack.consumeFuel === 'function') jetpack.consumeFuel(dt);
    else consumeFuel(jetpack, dt);
    const character = this.game.character;
    character.emit?.('jetpackUpdate', {
      fuel: jetpack.consumableUse,
      maxFuel: jetpack.maxConsumableUse,
      airTime: 0,
      maxAirTime: jetpack.airLimit ?? 0
    });
    character.emit?.('jumpChanged', {
      current: jetpack.consumableUse,
      max: jetpack.maxConsumableUse ?? jetpack.consumableUse,
      type: 'jetpack'
    });
    if (before > 0 && jetpack.consumableUse <= 0) {
      if (this.game.inventoryManager?.removeCurrentItem) this.game.inventoryManager.removeCurrentItem();
      else character.setHeldItem?.(null);
      this.vehicleJetpackActive = false;
      character.isUsingJetpack = false;
    }
  }

  private spawnBikeJetpackEffect(bike: MotorbikeVisual, vfxType = 'Humo y Fuego') {
    const particleSystem = this.game.character?.particleSystem ?? this.game.networkManager?.particleSystem;
    if (!particleSystem?.spawnJetpackEffect) return;
    const vfx = (vfxType && vfxType !== 'Ninguno') ? vfxType : 'Humo y Fuego';
    const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };
    const rear = new THREE.Vector3(0, dims.y * 0.15, dims.z * 0.52);
    const rearWorld = rear.applyQuaternion(bike.quaternion).add(bike.position);
    const normal = new THREE.Vector3(0, -0.10, 1).applyQuaternion(bike.quaternion).normalize();
    particleSystem.spawnJetpackEffect(rearWorld, normal, vfx);
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
      const motion = this.moveBike(bike, state.speed, state.verticalSpeed, dt, bike === this.mounted);
      state.speed = motion.speed;
      state.verticalSpeed = motion.verticalSpeed;
      bike.userData.vehicleMotion = { speed: state.speed, verticalSpeed: state.verticalSpeed, lean: 0 };
      bike.animateMotorbike?.(motion.travel * Math.sign(state.speed), 0, 0);
      if (Math.abs(state.speed) < 0.02 && motion.grounded) {
        body.setTranslation(bike.position, true);
        body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.coasting.delete(bike);
        if (state.local && !bike.userData.vehiclePassenger && this.game.networkManager?.isConnected) {
          this.game.networkManager.sendPlayerAction('motorbikePark', this.networkStateFor(bike, 0, 0, 0, 0));
        }
      }
    }
  }

  private syncRider(dt: number, animate = true) {
    const bike = this.mounted!;
    const character = this.game.character;
    const props = bike.userData.logicProperties;
    const hipHeight = character.currentType === 'skin' ? 0.625 : 0.7;
    const height = this.isPassenger ? props.passengerSeatHeight : props.seatHeight;
    const offset = this.isPassenger ? props.passengerSeatOffsetZ : props.seatOffsetZ;
    const position = new THREE.Vector3(0, height - bike.userData.originalScale.y / 2 - hipHeight, offset)
      .applyQuaternion(bike.quaternion).add(bike.position);
    character.rigidBody.setTranslation(position, true);
    character.rigidBody.setNextKinematicTranslation(position);
    this.lastRiderPosition.copy(position);
    const bikeHeading = getMotorbikeHeading(bike);
    let aimDiff = 0;
    if (this.isPassenger) {
      const cameraCtrl = this.game.cameraController;
      if (cameraCtrl) {
        const deltaBikeYaw = Math.atan2(Math.sin(bikeHeading - this.lastBikeYaw), Math.cos(bikeHeading - this.lastBikeYaw));
        if (Math.abs(deltaBikeYaw) > 0.00001) {
          cameraCtrl.rotateYaw?.(deltaBikeYaw);
        }
        cameraCtrl.setYawConstraint?.(bikeHeading, MAX_PASSENGER_YAW);
      }

      const aimYaw = character.getAimYaw ? character.getAimYaw() : (character.currentRotation || 0) - Math.PI;
      const targetBodyRot = aimYaw + Math.PI;
      aimDiff = Math.atan2(Math.sin(targetBodyRot - bikeHeading), Math.cos(targetBodyRot - bikeHeading));
      aimDiff = THREE.MathUtils.clamp(aimDiff, -MAX_PASSENGER_YAW, MAX_PASSENGER_YAW);

      // Character base model (pelvis & legs) faces forward along the motorcycle
      character.currentRotation = bikeHeading;
      character.headYaw = aimDiff;
      character.headPitch = character.getAimPitch ? character.getAimPitch() : 0;

      if (animate) {
        this.pose.updatePassengerAnimations(character, dt, character.headPitch, aimDiff);
      }
    } else {
      character.currentRotation = bikeHeading;
      character.headYaw = 0;
      character.headPitch = 0;
      this.game.cameraController?.setYawConstraint?.(null);
      if (character.polygonModelSkin?.setHeadRotation) {
        character.polygonModelSkin.setHeadRotation(0, 0);
      }
      if (character.polygonModelSkin?.heldItemMesh) {
        character.polygonModelSkin.heldItemMesh.visible = false;
      }
    }
    this.lastBikeYaw = bikeHeading;
    character.grounded = true;
    character.isRunning = false;
    character.updateModelVisuals();
    const effectiveLean = this.isPassenger ? (-this.lean * 0.4) : this.lean;
    for (const model of [character.glbModel?.model, character.polygonModel?.model, character.polygonModelSkin?.model]) {
      if (model) model.rotateZ(character.currentType === 'glb' && model === character.glbModel?.model ? effectiveLean : -effectiveLean);
    }
    const isAttacking = Boolean(this.isPassenger && !this.paused && this.game.inputManager?.keys?.attack);
    this.pose.apply(character, dt, this.speed, this.steering, props.riderLean, this.isPassenger, bikeHeading, aimDiff, isAttacking);
    if (animate) {
      character.particleSystem?.update?.(dt);
    }
  }

  getNetworkState() {
    const bike = this.mounted;
    if (!bike) return null;
    return {
      ...this.networkStateFor(bike, this.speed, this.verticalSpeed, this.steering, this.lean),
      seat: this.seat,
      seatTimestamp: this.lastSeatSwitchTime
    };
  }

  private networkStateFor(bike: MotorbikeVisual, speed: number, verticalSpeed: number, steering: number, lean: number) {
    return {
      uuid: bike.userData.uuid,
      position: { x: bike.position.x, y: bike.position.y, z: bike.position.z },
      yaw: getMotorbikeHeading(bike),
      fuel: bike.userData.logicProperties.consumableUse,
      speed, verticalSpeed, steering, lean,
      jetpackActive: bike === this.mounted && this.vehicleJetpackActive,
      jetpackVFX: bike === this.mounted && this.vehicleJetpackActive ? this.vehicleJetpackVFX : undefined,
      riderLean: bike.userData.logicProperties.riderLean,
      seatHeight: bike.userData.logicProperties.seatHeight,
      seatOffsetZ: bike.userData.logicProperties.seatOffsetZ,
      passengerSeatHeight: bike.userData.logicProperties.passengerSeatHeight,
      passengerSeatOffsetZ: bike.userData.logicProperties.passengerSeatOffsetZ
    };
  }

  private validNetworkState(state: any) {
    return state && typeof state.uuid === 'string' && (state.seat === undefined || state.seat === 'driver' || state.seat === 'passenger') &&
      (state.jetpackActive === undefined || typeof state.jetpackActive === 'boolean') &&
      (state.jetpackVFX === undefined || typeof state.jetpackVFX === 'string') &&
      [state.position?.x, state.position?.y, state.position?.z, state.yaw, state.fuel, state.speed, state.verticalSpeed ?? 0, state.steering, state.lean, state.riderLean, state.seatHeight, state.seatOffsetZ, state.passengerSeatHeight ?? 1.08, state.passengerSeatOffsetZ ?? 0.72]
        .every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e6);
  }

  receivePark(playerId: string, state: any) {
    if (!this.validNetworkState(state)) return;
    const bike = this.bikes.find(candidate => candidate.userData.uuid === state.uuid);
    if (!bike) return;
    const player = this.game.networkManager?.remotePlayers.get(playerId);
    // A coasting-complete packet has no seat; it cannot release an active rider.
    if (state.seat === undefined && player?.state.motorbike?.seat !== undefined) return;
    if (player?.state.motorbike?.uuid === state.uuid) player.state.motorbike = null;
    const field = state.seat === 'passenger' ? 'vehiclePassenger' : 'vehicleDriver';
    if (bike.userData[field] && bike.userData[field] !== playerId) return;
    if (bike.userData[field] === playerId) delete bike.userData[field];
    // A departing passenger must never park or rewind a motorcycle that still has a driver.
    if (bike.userData.vehicleDriver || (bike === this.mounted && this.isDriver)) return;
    this.remoteMotionSamples.delete(bike);
    this.applyRemoteTransform(bike, state.position, state.yaw);
    bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
    this.startCoasting(bike, state.speed, state.verticalSpeed ?? 0, bike === this.mounted);
    bike.animateMotorbike?.(0, 0, 0);
    if (bike === this.mounted) this.syncRider(0);
  }

  receiveSeat(playerId: string, state: any) {
    if (!this.validNetworkState(state)) return;
    const player = this.game.networkManager?.remotePlayers.get(playerId);
    if (player) {
      const prevTimestamp = player.state?.motorbike?.seatTimestamp;
      if (typeof prevTimestamp === 'number' && typeof state.seatTimestamp === 'number' && state.seatTimestamp < prevTimestamp) {
        return;
      }
      player.state.motorbike = state;
    }
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
    for (const bike of this.bikes) {
      const remote = [...network.remotePlayers.entries()].filter(([, player]: any) =>
        this.validNetworkState(player.state?.motorbike) && player.state.motorbike.uuid === bike.userData.uuid) as Array<[string, any]>;
      const claims = remote.map(([id, player]) => ({ id, seat: (player.state.motorbike.seat ?? 'driver') as VehicleSeat }));
      if (bike === this.mounted && this.seat) claims.push({ id: this.playerId, seat: this.seat });
      const seats = resolveVehicleSeats(claims);
      const previousDriver = bike.userData.vehicleDriver;
      bike.userData.vehicleDriver = [...seats].find(([, seat]) => seat === 'driver')?.[0];
      bike.userData.vehiclePassenger = [...seats].find(([, seat]) => seat === 'passenger')?.[0];
      if (bike === this.mounted && seats.get(this.playerId) !== this.seat) {
        const assigned = seats.get(this.playerId);
        if (!assigned) this.dismount(true);
        else {
          this.pose.reset(this.game.character);
          this.seat = assigned;
          this.lastSeatSwitchTime = Date.now();
          this.sendSeat();
        }
      }
      // Only the driver controls motion and fuel. A lone passenger owns unpowered coasting.
      const authority = bike.userData.vehicleDriver || bike.userData.vehiclePassenger;
      const owner = remote.find(([id]) => id === authority)?.[1];
      if (owner) {
        const state = owner.state.motorbike;
        this.coasting.delete(bike);
        const frameDt = Math.max(0, Math.min(dt, 0.1));
        let sample = this.remoteMotionSamples.get(bike);
        if (!sample || sample.state !== state) {
          sample = { state, age: 0 };
          this.remoteMotionSamples.set(bike, sample);
        } else {
          sample.age = Math.min(0.1, sample.age + frameDt);
        }
        // Advance the last received target, not the rendered bike plus a correction toward
        // a frozen packet. The latter repeatedly accelerates/brakes between 20 Hz updates.
        const predicted = new THREE.Vector3(0, 0, -state.speed * sample.age)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw)
          .add(new THREE.Vector3(state.position.x, state.position.y, state.position.z));
        predicted.y += (state.verticalSpeed ?? 0) * sample.age;
        const position = bike.position.clone().lerp(predicted, 1 - Math.exp(-15 * frameDt));
        const yaw = getMotorbikeHeading(bike);
        const diff = Math.atan2(Math.sin(state.yaw - yaw), Math.cos(state.yaw - yaw));
        // Use vehicle yaw, never passenger aim or an interpolated avatar's old seat offset.
        this.applyRemoteTransform(bike, position, yaw + diff * (1 - Math.exp(-15 * Math.max(0, Math.min(dt, 0.1)))));
        bike.userData.vehicleMotion = { speed: state.speed, verticalSpeed: state.verticalSpeed ?? 0, lean: state.lean };
        bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
        bike.animateMotorbike?.(state.speed * Math.min(dt, 0.05), state.steering, state.lean);
        if (state.jetpackActive) this.spawnBikeJetpackEffect(bike, state.jetpackVFX || 'Humo y Fuego');
      } else if (authority === this.playerId && this.isDriver) {
        this.remoteMotionSamples.delete(bike);
        this.coasting.delete(bike);
      } else if (!bike.userData.vehicleDriver && !this.coasting.has(bike) && (previousDriver || (authority === this.playerId && bike.userData.rigidBody?.isKinematic()))) {
        const motion = bike.userData.vehicleMotion;
        this.startCoasting(bike, motion?.speed ?? 0, motion?.verticalSpeed ?? 0, authority === this.playerId);
      }
      for (const [id, player] of remote) {
        const seat = seats.get(id);
        if (!seat) continue;
        const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
        const hip = player.currentType === 'skin' ? 0.625 : 0.7;
        const height = seat === 'passenger' ? props.passengerSeatHeight : props.seatHeight;
        const offset = seat === 'passenger' ? props.passengerSeatOffsetZ : props.seatOffsetZ;
        const position = new THREE.Vector3(0, height - bike.userData.originalScale.y / 2 - hip, offset)
          .applyQuaternion(bike.quaternion).add(bike.position);
        player.syncVehicleSeat?.(position, getMotorbikeHeading(bike), seat, bike.userData.vehicleMotion?.lean ?? this.lean, dt);
      }
      if (bike === this.mounted && this.isPassenger) {
        this.lean = bike.userData.vehicleMotion?.lean ?? 0;
        const hasRemoteDriver = Boolean(bike.userData.vehicleDriver && bike.userData.vehicleDriver !== this.playerId);
        this.syncRider(hasRemoteDriver ? dt : 0, hasRemoteDriver);
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
    this.game.cameraController?.setYawConstraint?.(null);
    this.hud?.remove();
  }
}

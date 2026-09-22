import { MotorbikePhysics, type BikeControls } from './MotorbikePhysics';
import { VehicleDamageEffects } from './VehicleDamageEffects';
import { VehicleDurability, isMotorbikeBroken } from './VehicleDurability';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { consumeFuel } from '../items/Fuel';
import { normalizeMotorbikeSettings, MAX_PASSENGER_YAW } from './MotorbikeSettings';
import { RiderPose } from './RiderPose';
import { VehicleFall } from './VehicleFall';
import { resolveVehicleSeats, type VehicleSeat } from './VehicleSeats';
import type { MotorbikeVisual } from './MotorbikeModel';
import { advanceVehicleGravity, beginVehicleGravity, vehicleGravity, vehicleHeading, vehicleUp, receiveVehicleGravity, syncVehicleGravity } from './VehicleGravity';
import { getGravityQuaternion } from '../utils/GravityOrientation';
import { TireTrackManager } from './TireTrackManager';
import { SpeedLinesEffect } from './SpeedLinesEffect';

const FORWARD = new THREE.Vector3(0, 0, -1);

/** Heading around the current gravity axis, without Euler angle folding. */
export function getMotorbikeHeading(bike: THREE.Object3D): number {
  return vehicleHeading(bike);
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
  private padContacts = new WeakMap<MotorbikeVisual, Map<THREE.Object3D, { inside: boolean; cooldown: number }>>();
  private damageEffects: VehicleDamageEffects;
  private projectileHits = new WeakMap<object, Set<MotorbikeVisual>>();
  private durability: VehicleDurability;
  private controller: RAPIER.KinematicCharacterController;
  private pose = new RiderPose();
  private physics: MotorbikePhysics;
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
  tireTracks: TireTrackManager;
  speedLines: SpeedLinesEffect;
  isSkidding = false;

  constructor(private game: any) {
    this.speedLines = new SpeedLinesEffect(game);
    this.damageEffects = new VehicleDamageEffects(game.sceneManager?.scene ?? game.scene ?? new THREE.Scene());
    this.durability = new VehicleDurability(game, bike => this.damageEffects.hit(bike));
    this.physics = new MotorbikePhysics(game.world);
    this.controller = game.world.createCharacterController(0.025);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    const scene = game.sceneManager?.scene ?? game.scene ?? new THREE.Scene();
    this.tireTracks = new TireTrackManager(scene);
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
      const origin = position.clone().add(character.getGravityUpVector().multiplyScalar(0.8));
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
    bike.userData.logicProperties = Object.assign(bike.userData.logicProperties ?? {}, normalizeMotorbikeSettings(bike.userData.logicProperties));
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
    if (character.getGravityUpVector().dot(vehicleUp(bike)) < 0.99 || this.game.gravityQteActive) return false;
    if (bike.userData.vehicleToppled) {
      if (bike.userData.vehicleDriver || bike.userData.vehiclePassenger) return false;
      if (!this.physics.rightBike(bike, character.collider)) {
        this.show('No hay espacio para enderezar la moto.');
        return false;
      }
      this.startCoasting(bike, 0, 0, true);
      bike.userData.vehicleMotion = { speed: 0, verticalSpeed: 0, lean: 0 };
      this.game.broadcastObjectUpdate?.(bike);
      if (this.game.networkManager?.isConnected) this.game.networkManager.sendPlayerAction('motorbikePark', this.networkStateFor(bike, 0, 0, 0, 0));
      this.show('Moto de pie · Pulsa F otra vez para subir');
      return true;
    }
    if (isMotorbikeBroken(bike.userData.logicProperties)) {
      this.show('Motocicleta averiada · Durabilidad 0');
      return false;
    }
    this.mounted = bike;
    this.lastSeatSwitchTime = Date.now();
    this.seat = bike.userData.vehicleDriver ? 'passenger' : 'driver';
    bike.userData.logicProperties = Object.assign(bike.userData.logicProperties ?? {}, normalizeMotorbikeSettings(bike.userData.logicProperties));
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
    if (this.isPassenger) this.game.hud?.updateVehicle?.(null);
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
      this.endBikeTracks(bike);
      this.isSkidding = false;
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
      const up = vehicleUp(bike);
      const origin = position.clone().addScaledVector(up, 2);
      const floor = this.game.world.castRay(new RAPIER.Ray(origin, up.clone().negate()), 5, true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, character.collider, bike.userData.rigidBody);
      if (!floor) continue;
      position.copy(origin).addScaledVector(up, -floor.timeOfImpact + Math.max(0, character.capsuleHalfHeight + character.capsuleRadius - character.capsuleCenterOffset) + 0.05);
      const center = position.clone().addScaledVector(up, character.capsuleCenterOffset);
      const blocked = this.game.world.intersectionWithShape(center, vehicleGravity(bike).frame, character.collider.shape,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, character.collider);
      if (!blocked) return position;
    }
    return null;
  }

  dismount(force = false, crashed = false): boolean {
    if (!this.mounted) return false;
    const bike = this.mounted;
    const character = this.game.character;
    const exit = force && !crashed ? null : this.findExit();
    if (!force && !exit) {
      this.show('No hay espacio libre para bajar. Mueve la moto e intenta de nuevo.');
      return false;
    }
    const finalState = this.getNetworkState();
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    const exitSpeed = this.speed;
    const velocity = this.physics.velocity(bike) ?? new THREE.Vector3(0, 0, -exitSpeed).applyQuaternion(bike.quaternion);
    const wasDriver = this.isDriver;
    this.physics.releaseRider(bike, character.collider);
    const field = wasDriver ? 'vehicleDriver' : 'vehiclePassenger';
    if (bike.userData[field] === this.playerId) delete bike.userData[field];
    if (!bike.userData.vehicleDriver) this.startCoasting(bike, exitSpeed, this.verticalSpeed, !bike.userData.vehiclePassenger);
    if (finalState && this.game.networkManager?.isConnected) {
      this.game.networkManager.sendPlayerAction('motorbikePark', finalState);
    }
    if (!bike.userData.vehicleDriver) bike.animateMotorbike?.(0, 0, 0);
    this.endBikeTracks(bike);
    this.isSkidding = false;
    this.speedLines.reset();
    this.mounted = null;
    this.game.hud?.updateVehicle?.(null);
    this.seat = null;
    character.isMounted = false;
    this.game.cameraController?.setVehicleSurfaceRotation?.(null);
    if (character.collider?.isValid()) character.collider.setSensor(this.wasSensor);
    if (exit && character.rigidBody?.isValid()) {
      character.rigidBody.setTranslation(exit, true);
      character.rigidBody.setNextKinematicTranslation(exit);
    }
    character.verticalVelocity = 0;
    character.momentum.set(0, 0, 0);
    this.pose.reset(character);
    character.updateModelVisuals();
    if (props.dismountPenaltyEnabled && !character.isDead && (crashed || (!force && Math.abs(exitSpeed) * 3.6 >= props.dismountFallSpeed))) {
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
    this.tireTracks.update(dt);
    this.durability.update(this.bikes, dt);
    this.damageEffects.update(this.bikes, dt);
    // Inspector edits also apply to parked motorcycles, which then fall toward their new surface.
    for (const bike of this.bikes) {
      if (bike.userData.vehicleToppled && bike.userData.logicProperties?.autoStabilize !== false && !this.coasting.has(bike) && !bike.userData.vehicleDriver) this.startCoasting(bike, 0, 0, true);
      const requested = bike.userData.logicProperties?.gravityOrientation;
      if (bike !== this.mounted && !bike.userData.vehicleDriver && !bike.userData.vehiclePassenger && !this.coasting.has(bike) &&
          requested && requested !== 'inherit' && requested !== vehicleGravity(bike).orientation) {
        this.startCoasting(bike, 0, 0, true);
      }
    }
    this.updateCoasting(dt);
    if (!this.mounted) {
      this.speedLines.update(dt, 0, null);
      this.game.hud?.updateVehicle?.(null);
      if (this.hud) this.hud.style.display = 'none';
      const nearby = this.nearest();
      if (nearby?.userData.vehicleToppled) this.show('Moto volcada · F: poner de pie');
      const falling = this.fall.update(this.game.character, this.controller, this.paused ? 0 : dt);
      if (falling) {
        this.game.character?.particleSystem?.update?.(dt);
      }
      return falling;
    }
    const bike = this.mounted;
    const character = this.game.character;
    const body: RAPIER.RigidBody = bike.userData.rigidBody;
    if (!bike.parent || !body?.isValid() || character.isDead || character.getPosition().distanceTo(this.lastRiderPosition) > 4) {
      this.dismount(true);
      return false;
    }
    const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
    Object.assign(bike.userData.logicProperties, props);
    if (bike.userData.vehicleToppled && !props.autoStabilize) {
      this.dismount(true, true);
      return false;
    }
    if (this.isPassenger) {
      const motion = this.coasting.get(bike) ?? bike.userData.vehicleMotion;
      this.speed = motion?.speed ?? 0;
      this.verticalSpeed = motion?.verticalSpeed ?? 0;
      this.lean = motion?.lean ?? 0;
      const hasRemoteDriver = Boolean(bike.userData.vehicleDriver && bike.userData.vehicleDriver !== this.playerId);
      if (!hasRemoteDriver) {
        this.syncRider(dt);
      }
      const currentSpeedKmh = Math.abs(this.speed) * 3.6;
      this.speedLines.update(dt, currentSpeedKmh, props);
      this.show(`Pasajero · ${Math.round(currentSpeedKmh)} km/h\nArmas y construcción disponibles · R cambiar asiento · F bajar\nMayús + R recargar / rotar construcción`, props.consumableUse, props.maxConsumableUse);
      return true;
    }
    this.updateBikeGravity(bike, dt);
    const keys = this.game.inputManager.keys;
    const throttle = this.paused ? 0 : Number(keys.forward) - Number(keys.backward);
    const brake = this.paused || keys.crouch;
    const jetpack = this.getSelectedJetpack();
    const broken = isMotorbikeBroken(props);
    const jetpackActive = !broken && !brake && !this.paused && keys.jump && jetpack && jetpack.consumableUse > 0;
    this.vehicleJetpackActive = Boolean(jetpackActive);
    this.vehicleJetpackVFX = jetpack?.particleVFX || 'Humo y Fuego';
    character.isUsingJetpack = this.vehicleJetpackActive;
    character.isSuperman = false;
    character.noPitchTilt = false;
    const drift = !this.paused && keys.crouch && (keys.left || keys.right);
    const driveThrottle = jetpackActive ? Math.max(throttle, 1) : throttle;
    const powered = !broken && !brake && driveThrottle !== 0 && (jetpackActive || props.consumableUse > 0);
    const maxForwardSpeed = props.maxSpeed + (jetpackActive ? props.jetpackMaxSpeedBonus : 0);
    const targetSpeed = powered ? (driveThrottle > 0 ? maxForwardSpeed : -props.reverseSpeed) : 0;
    const brakeRate = Math.max(3, props.braking * (drift ? props.driftBrakeMultiplier : 1));
    const acceleration = props.acceleration + (jetpackActive ? props.jetpackAccelerationBonus : 0);
    const rate = brake || (driveThrottle !== 0 && Math.sign(this.speed) !== Math.sign(driveThrottle) && Math.abs(this.speed) > 0.1) ? brakeRate : powered ? acceleration : 3;
    const effectiveRate = Math.abs(this.speed) > maxForwardSpeed ? Math.max(rate, 9) : rate;
    if (this.grounded) this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), effectiveRate * dt);
    if (jetpackActive) this.consumeVehicleJetpack(jetpack, dt);
    else if (powered) consumeFuel(bike.userData.logicProperties, dt, props.fuelConsumption);
    const steeringTarget = this.paused ? 0 : Number(keys.left) - Number(keys.right);
    this.steering = THREE.MathUtils.lerp(this.steering, steeringTarget, 1 - Math.exp(-10 * dt));
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    const jumpDown = Boolean(keys.jump);
    let jumpImpulse = 0;
    if (!broken && !jetpackActive && !this.paused && jumpDown && !this.wasJumpDown && this.grounded && this.jumpCooldown <= 0 && props.jumpForce > 0) {
      jumpImpulse = props.jumpForce;
      this.verticalSpeed = Math.max(this.verticalSpeed, props.jumpForce);
      this.grounded = false;
      this.jumpCooldown = props.jumpCooldown;
    }
    this.wasJumpDown = jumpDown;
    const speedAbs = Math.abs(this.speed);
    const movingTurn = this.steering * THREE.MathUtils.degToRad(props.turnSpeed) *
      Math.min(speedAbs / (drift ? 2 : 4), 1) * Math.sign(this.speed) * (drift ? props.driftTurnMultiplier : 1);
    const pivotTurn = !broken && brake && speedAbs < 0.35
      ? this.steering * THREE.MathUtils.degToRad(props.stationaryTurnSpeed) * (1 - THREE.MathUtils.clamp(speedAbs / 0.35, 0, 1))
      : 0;
    const motion = this.moveBike(bike, this.speed, this.verticalSpeed, dt, true, {
      yawRate: movingTurn + pivotTurn,
      jump: jumpImpulse,
      pitch: this.paused || broken ? 0 : -throttle,
      yaw: this.paused || broken || keys.crouch ? 0 : steeringTarget,
      roll: this.paused || broken || !keys.crouch ? 0 : -steeringTarget,
      stabilize: !this.paused && !broken && Boolean(keys.crouch),
      boost: jetpackActive ? props.jetpackAccelerationBonus : 0,
    });
    // Crash damage can trigger an explosion that kills and dismounts the rider.
    if (this.mounted !== bike || this.game.character.isDead) return false;
    this.speed = motion.speed;
    this.verticalSpeed = motion.verticalSpeed;
    this.grounded = motion.grounded;
    if (motion.toppled && !props.autoStabilize) {
      this.dismount(true, true);
      return false;
    }
    const travel = motion.travel;
    this.lean = THREE.MathUtils.lerp(this.lean, this.steering * THREE.MathUtils.degToRad(props.maxLean) * Math.min(Math.abs(this.speed) / 10, 1), 1 - Math.exp(-8 * dt));
    bike.userData.vehicleMotion = { speed: this.speed, verticalSpeed: this.verticalSpeed, lean: this.lean };
    bike.animateMotorbike?.(travel * Math.sign(this.speed), this.steering, this.lean);
    if (this.vehicleJetpackActive) this.spawnBikeJetpackEffect(bike, this.vehicleJetpackVFX);
    const currentSpeedAbs = Math.abs(this.speed);
    const isPivoting = Boolean(brake && (keys.left || keys.right) && Math.abs(pivotTurn) > 0.05);
    const isSkidding = !this.paused && this.grounded && (
      (keys.crouch && currentSpeedAbs > 1.0) ||
      (drift && currentSpeedAbs > 0.6) ||
      isPivoting
    );
    this.isSkidding = isSkidding;
    if (isSkidding) {
      this.spawnTireTrack(bike, props.driftMarkDuration ?? 4, isPivoting);
    } else {
      this.endBikeTracks(bike);
    }
    this.syncRider(dt);
    const currentSpeedKmh = Math.abs(this.speed) * 3.6;
    this.speedLines.update(dt, currentSpeedKmh, props);
    const fuel = bike.userData.logicProperties.consumableUse;
    const jetpackFuel = jetpackActive ? ` · Jetpack ${Math.ceil(jetpack.consumableUse)} / ${jetpack.maxConsumableUse}` : '';
    this.show(`Conductor · ${Math.round(currentSpeedKmh)} km/h · Combustible ${Math.ceil(fuel)} / ${props.maxConsumableUse}${jetpackFuel}${fuel <= 0 ? ' · SIN COMBUSTIBLE' : ''}\nW/S acelerar · A/D girar · Shift frenar/drift · Espacio saltar/jetpack · En el aire: W/S inclinar, A/D girar, ${props.landingAssistEnabled ? (props.landingAssistMode === 'inverted-detach' ? 'Shift para aterrizar tras soltarte de cabeza' : 'mantener Shift para aterrizar') : 'Shift+A/D rodar'} · R cambiar asiento · F bajar`, fuel, props.maxConsumableUse);
    return true;
  }

  private networkGravityFrame(state: any) {
    return state.gravityQuaternion ? new THREE.Quaternion().fromArray(state.gravityQuaternion).normalize() : getGravityQuaternion(state.gravityOrientation);
  }

  private updateBikeGravity(bike: MotorbikeVisual, dt: number) {
    let contacts = this.padContacts.get(bike);
    if (!contacts) { contacts = new Map(); this.padContacts.set(bike, contacts); }
    const body = bike.userData.rigidBody;
    const collider = body.collider(0);
    this.game.sceneManager.scene.traverse((pad: THREE.Object3D) => {
      if (pad.userData.mapObjectType !== 'gravity_pad') return;
      const props = pad.userData.logicProperties || {};
      const dims = pad.userData.originalScale || { x: 3, y: 0.2, z: 3 };
      const position = pad.getWorldPosition(new THREE.Vector3());
      const rotation = pad.getWorldQuaternion(new THREE.Quaternion());
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      const shape = new RAPIER.Cuboid(dims.x / 2, dims.y / 2 + 0.12, dims.z / 2);
      const inside = collider.shape.intersectsShape(bike.position, bike.quaternion, shape, position, rotation);
      const contact = contacts!.get(pad) || { inside: false, cooldown: 0 };
      contact.cooldown = Math.max(0, contact.cooldown - dt);
      if (inside && !contact.inside && contact.cooldown === 0) {
        if (bike.position.clone().sub(position).dot(normal) < 0) normal.negate();
        beginVehicleGravity(bike, props.gravityOrientation ?? 'up', Number(props.transitionDuration ?? 0.8), normal, position.addScaledVector(normal, dims.y / 2));
        contact.cooldown = Math.max(0, Number(props.cooldown ?? 0.35));
      }
      contact.inside = inside;
      contacts!.set(pad, contact);
    });
    const requested = bike.userData.logicProperties.gravityOrientation;
    if (requested && requested !== 'inherit' && requested !== vehicleGravity(bike).orientation) {
      const up = vehicleUp(bike);
      beginVehicleGravity(bike, requested, 0.8, up, bike.position.clone().addScaledVector(up, -bike.userData.originalScale.y / 2));
    }
    if (vehicleGravity(bike).start) {
      advanceVehicleGravity(bike, dt);
      body.setRotation(bike.quaternion, true);
      body.setTranslation(bike.position, true);
      body.setNextKinematicTranslation(bike.position);
    }
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
      // Empty jetpacks remain equipped for contact refueling.
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

  private endBikeTracks(bike: MotorbikeVisual) {
    const baseId = bike.userData.uuid || 'local_bike';
    this.tireTracks.endTrack(baseId);
    this.tireTracks.endTrack(baseId + '_rear');
    this.tireTracks.endTrack(baseId + '_front');
  }

  private spawnWheelTrack(
    bike: MotorbikeVisual,
    trackId: string,
    wheelLocal: THREE.Vector3,
    dims: { x: number; y: number; z: number },
    tireWidth: number,
    duration: number,
    isPivoting: boolean
  ) {
    const wheelWorld = wheelLocal.clone().applyQuaternion(bike.quaternion).add(bike.position);

    let groundPos: THREE.Vector3;
    const groundNormal = vehicleUp(bike);
    const rayOrigin = wheelWorld.clone();
    rayOrigin.addScaledVector(groundNormal, 0.25);

    const hit = this.game.world?.castRay?.(
      new RAPIER.Ray(rayOrigin, groundNormal.clone().negate()),
      dims.y * 0.9,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.game.character?.collider,
      bike.userData.rigidBody
    );

    if (hit) {
      groundPos = rayOrigin.clone().addScaledVector(groundNormal, -hit.timeOfImpact);
    } else {
      groundPos = wheelWorld.clone().addScaledVector(groundNormal, -dims.y * 0.25);
    }

    let forwardDir: THREE.Vector3;
    if (isPivoting) {
      const signZ = Math.sign(wheelLocal.z);
      const signTurn = Math.sign(this.steering || 1);
      forwardDir = new THREE.Vector3(signZ * signTurn, 0, 0).applyQuaternion(bike.quaternion).normalize();
    } else {
      forwardDir = new THREE.Vector3(0, 0, -Math.sign(this.speed || 1)).applyQuaternion(bike.quaternion).normalize();
    }

    this.tireTracks.addTirePoint(
      trackId,
      groundPos,
      groundNormal,
      forwardDir,
      tireWidth,
      duration
    );
  }

  private spawnTireTrack(bike: MotorbikeVisual, duration = 4, isPivoting = false) {
    const dims = bike.userData.originalScale ?? { x: 0.85, y: 1.25, z: 2.4 };
    const tireWidth = Math.max(0.12, Math.min(0.24, dims.x * 0.18));
    const baseId = bike.userData.uuid || 'local_bike';

    // Únicamente la rueda trasera marca la pista en el suelo
    this.spawnWheelTrack(bike, baseId + '_rear', new THREE.Vector3(0, -dims.y * 0.25, dims.z * 0.42), dims, tireWidth, duration, isPivoting);
  }

  private startCoasting(bike: MotorbikeVisual, speed: number, verticalSpeed: number, local: boolean) {
    const body: RAPIER.RigidBody = bike.userData.rigidBody;
    if (!bike.parent || !body?.isValid()) return;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    // The render position can be one physics step ahead when F is pressed.
    body.setTranslation(bike.position, true);
    body.setNextKinematicTranslation(bike.position);
    const gravity = vehicleGravity(bike);
    if (!gravity.start && gravity.frame.angleTo(getGravityQuaternion(gravity.orientation)) > 0.0001) {
      gravity.start = gravity.frame.clone();
      gravity.duration = Math.max(0.1, gravity.duration - gravity.elapsed);
      gravity.elapsed = 0;
    }
    this.coasting.set(bike, { speed, verticalSpeed, local });
  }

  private moveBike(bike: MotorbikeVisual, speed: number, verticalSpeed: number, dt: number, hasRider = false, controls: BikeControls = {}) {
    const motion = this.physics.step(bike, speed, verticalSpeed, dt, hasRider ? this.game.character.collider : undefined, controls);
    bike.userData.vehicleSurfaceSupported = this.physics.surfaceSupported(bike);
    if (motion.crashed) {
      const props = normalizeMotorbikeSettings(bike.userData.logicProperties);
      if (props.dismountPenaltyEnabled && props.durabilityEnabled) {
        this.durability.damage(bike, props.crashDamageMode === 'fixed' ? props.crashDamageFixed : props.maxDurability * props.crashDamagePercent / 100);
      }
    }
    return motion;
  }

  private updateCoasting(dt: number) {
    if (dt <= 0) return;
    for (const [bike, state] of this.coasting) {
      const body: RAPIER.RigidBody = bike.userData.rigidBody;
      if (!bike.parent || !body?.isValid() || bike.userData.vehicleDriver) {
        this.coasting.delete(bike);
        continue;
      }
      this.updateBikeGravity(bike, dt);
      // Same rolling resistance as releasing the throttle while mounted; no engine/fuel use.
      state.speed = Math.sign(state.speed) * Math.max(0, Math.abs(state.speed) - 3 * dt);
      const motion = this.moveBike(bike, state.speed, state.verticalSpeed, dt, bike === this.mounted);
      state.speed = motion.speed;
      state.verticalSpeed = motion.verticalSpeed;
      bike.userData.vehicleMotion = { speed: state.speed, verticalSpeed: state.verticalSpeed, lean: 0 };
      bike.animateMotorbike?.(motion.travel * Math.sign(state.speed), 0, 0);
      if (Math.abs(state.speed) < 0.02 && motion.grounded && !vehicleGravity(bike).start) {
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

  applyImpulse(bike: MotorbikeVisual, force: THREE.Vector3) {
    if (!bike || !bike.parent) return;
    this.physics.applyImpulse(bike, force);

    const gravityUp = vehicleUp(bike);
    const vertForce = force.dot(gravityUp);
    const forward = FORWARD.clone().applyQuaternion(bike.quaternion).projectOnPlane(gravityUp).normalize();
    const forwardPush = force.dot(forward);

    if (bike === this.mounted) {
      if (vertForce > 0.1) {
        this.verticalSpeed = Math.max(this.verticalSpeed + vertForce, vertForce);
        this.grounded = false;
        this.jumpCooldown = 0.35;
      }
      if (Math.abs(forwardPush) > 0.1) {
        if (forwardPush > 0) {
          this.speed = Math.max(this.speed + forwardPush * 0.75, forwardPush);
        } else {
          this.speed = Math.min(this.speed + forwardPush * 0.75, forwardPush);
        }
      }
      const lateralPlanar = force.clone().projectOnPlane(gravityUp);
      if (lateralPlanar.lengthSq() > 1) {
        const padDir = lateralPlanar.normalize();
        if (padDir.dot(forward) > 0.25) {
          const right = new THREE.Vector3().crossVectors(padDir, gravityUp).normalize();
          const targetRot = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(right, gravityUp, padDir.clone().negate())
          );
          bike.quaternion.rotateTowards(targetRot, 0.2);
        }
      }
      if (this.game.networkManager?.isConnected) {
        this.game.networkManager.sendPlayerAction('motorbike', this.getNetworkState());
      }
      return;
    }

    const cState = this.coasting.get(bike);
    if (cState) {
      if (vertForce > 0.1) cState.verticalSpeed = Math.max(cState.verticalSpeed + vertForce, vertForce);
      if (forwardPush > 0) cState.speed = Math.max(cState.speed + forwardPush * 0.75, forwardPush);
      else cState.speed += forwardPush;
      return;
    }

    const initSpeed = forwardPush > 0 ? forwardPush : 0;
    const initVert = vertForce > 0.1 ? vertForce : 0;
    if (initSpeed > 0.1 || initVert > 0.1) {
      const body: RAPIER.RigidBody = bike.userData.rigidBody;
      if (body?.isValid() && body.bodyType() === RAPIER.RigidBodyType.Fixed) {
        body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      }
      this.startCoasting(bike, initSpeed, initVert, true);
    }
  }

  private syncRider(dt: number, animate = true) {
    const bike = this.mounted!;
    const character = this.game.character;
    const props = bike.userData.logicProperties;
    syncVehicleGravity(character, bike);
    this.game.cameraController?.setGravityQuaternion?.(vehicleGravity(bike).frame);
    this.game.cameraController?.setVehicleSurfaceRotation?.(bike.quaternion, bike.userData.vehicleSurfaceSupported === true);
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
    const upright = vehicleGravity(bike).frame.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bikeHeading));
    const tilt = bike.quaternion.clone().multiply(upright.invert());
    const effectiveLean = this.isPassenger ? (-this.lean * 0.4) : this.lean;
    for (const model of [character.glbModel?.model, character.polygonModel?.model, character.polygonModelSkin?.model]) {
      if (model) model.quaternion.premultiply(tilt);
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
      ...this.durability.state(bike),
      position: { x: bike.position.x, y: bike.position.y, z: bike.position.z },
      yaw: getMotorbikeHeading(bike),
      rotation: bike.quaternion.toArray(),
      toppled: bike.userData.vehicleToppled === true,
      surfaceSupported: bike.userData.vehicleSurfaceSupported === true,
      autoStabilize: bike.userData.logicProperties.autoStabilize !== false,
      landingAssistEnabled: bike.userData.logicProperties.landingAssistEnabled !== false,
      landingAssistMode: bike.userData.logicProperties.landingAssistMode === 'inverted-detach' ? 'inverted-detach' : 'any-airborne',
      velocity: this.physics.velocity(bike)?.toArray(),
      gravityOrientation: vehicleGravity(bike).orientation,
      gravityQuaternion: vehicleGravity(bike).frame.toArray(),
      gravityTransitionRemaining: Math.max(0, vehicleGravity(bike).duration - vehicleGravity(bike).elapsed),
      fuel: bike.userData.logicProperties.consumableUse,
      speed, verticalSpeed, steering, lean,
      jetpackActive: bike === this.mounted && this.vehicleJetpackActive,
      jetpackVFX: bike === this.mounted && this.vehicleJetpackActive ? this.vehicleJetpackVFX : undefined,
      isDrifting: Boolean(bike === this.mounted && this.isSkidding),
      driftMarkDuration: bike.userData.logicProperties?.driftMarkDuration ?? 4,
      riderLean: bike.userData.logicProperties.riderLean,
      seatHeight: bike.userData.logicProperties.seatHeight,
      seatOffsetZ: bike.userData.logicProperties.seatOffsetZ,
      passengerSeatHeight: bike.userData.logicProperties.passengerSeatHeight,
      passengerSeatOffsetZ: bike.userData.logicProperties.passengerSeatOffsetZ
    };
  }

  private validNetworkState(state: any) {
    return state && typeof state.uuid === 'string' && (state.seat === undefined || state.seat === 'driver' || state.seat === 'passenger') &&
      (state.gravityTransitionRemaining === undefined || (typeof state.gravityTransitionRemaining === 'number' && Number.isFinite(state.gravityTransitionRemaining) && state.gravityTransitionRemaining >= 0 && state.gravityTransitionRemaining < 1e6)) &&
      (state.gravityOrientation === undefined || ['down', 'up', 'left', 'right', 'front', 'back'].includes(state.gravityOrientation)) &&
      (state.gravityQuaternion === undefined || (Array.isArray(state.gravityQuaternion) && state.gravityQuaternion.length === 4 && state.gravityQuaternion.every((v: any) => typeof v === 'number' && Number.isFinite(v)) && Math.abs(Math.hypot(...state.gravityQuaternion) - 1) < 0.01)) &&
      (state.toppled === undefined || typeof state.toppled === 'boolean') &&
      (state.surfaceSupported === undefined || typeof state.surfaceSupported === 'boolean') &&
      (state.autoStabilize === undefined || typeof state.autoStabilize === 'boolean') &&
      (state.landingAssistEnabled === undefined || typeof state.landingAssistEnabled === 'boolean') &&
      (state.landingAssistMode === undefined || ['any-airborne', 'inverted-detach'].includes(state.landingAssistMode)) &&
      (state.rotation === undefined || (Array.isArray(state.rotation) && state.rotation.length === 4 && state.rotation.every((v: any) => typeof v === 'number' && Number.isFinite(v)) && Math.abs(Math.hypot(...state.rotation) - 1) < 0.01)) &&
      (state.velocity === undefined || (Array.isArray(state.velocity) && state.velocity.length === 3 && state.velocity.every((v: any) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1000))) &&
      (state.jetpackActive === undefined || typeof state.jetpackActive === 'boolean') &&
      (state.jetpackVFX === undefined || typeof state.jetpackVFX === 'string') &&
      (state.isDrifting === undefined || typeof state.isDrifting === 'boolean') &&
      (state.driftMarkDuration === undefined || (typeof state.driftMarkDuration === 'number' && Number.isFinite(state.driftMarkDuration) && Math.abs(state.driftMarkDuration) < 1e6)) &&
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
    this.durability.receive(bike, state);
    this.remoteMotionSamples.delete(bike);
    receiveVehicleGravity(bike, state.gravityOrientation, this.networkGravityFrame(state), state.gravityTransitionRemaining ?? 0);
    this.applyRemoteTransform(bike, state.position, state.yaw, state.rotation ? new THREE.Quaternion().fromArray(state.rotation) : undefined);
    this.physics.reset(bike, state.velocity);
    bike.userData.vehicleToppled = state.toppled === true;
    bike.userData.vehicleSurfaceSupported = state.surfaceSupported === true;
    if (state.autoStabilize !== undefined) bike.userData.logicProperties.autoStabilize = state.autoStabilize;
    if (state.landingAssistEnabled !== undefined) bike.userData.logicProperties.landingAssistEnabled = state.landingAssistEnabled;
    if (state.landingAssistMode !== undefined) bike.userData.logicProperties.landingAssistMode = state.landingAssistMode;
    bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
    this.startCoasting(bike, state.speed, state.verticalSpeed ?? 0, bike === this.mounted);
    bike.animateMotorbike?.(0, 0, 0);
    if (bike === this.mounted) this.syncRider(0);
  }

  handleProjectileCollision(handle1: number, handle2: number, projectiles: any[] = []) {
    for (const projectile of projectiles) {
      if (projectile.isDead || (projectile.colliderHandle !== handle1 && projectile.colliderHandle !== handle2)) continue;
      const otherHandle = projectile.colliderHandle === handle1 ? handle2 : handle1;
      if (otherHandle === projectile.ownerColliderHandle) continue;
      const bike = this.bikes.find(candidate => {
        const body = candidate.userData.rigidBody;
        if (!body?.isValid()) return false;
        for (let i = 0; i < body.numColliders(); i++) if (body.collider(i).handle === otherHandle) return true;
        return false;
      });
      if (!bike) continue;
      let hits = this.projectileHits.get(projectile);
      if (!hits) { hits = new Set(); this.projectileHits.set(projectile, hits); }
      if (hits.has(bike)) continue;
      if (this.durability.damage(bike, projectile.damage)) hits.add(bike);
    }
  }

  receiveExplosion(playerId: string, state: any) {
    this.durability.receiveExplosion(playerId, state, this.bikes);
  }

  receiveDurability(playerId: string, state: any) {
    this.durability.receiveAction(playerId, state, this.bikes);
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

  private applyRemoteTransform(bike: MotorbikeVisual, position: { x: number; y: number; z: number }, yaw: number, rotation?: THREE.Quaternion) {
    bike.position.copy(position as THREE.Vector3);
    bike.quaternion.copy(rotation ?? vehicleGravity(bike).frame.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)));
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
        this.durability.receive(bike, state);
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
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw).applyQuaternion(this.networkGravityFrame(state))
          .add(new THREE.Vector3(state.position.x, state.position.y, state.position.z));
        predicted.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(this.networkGravityFrame(state)), (state.verticalSpeed ?? 0) * sample.age);
        if (state.velocity) predicted.copy(new THREE.Vector3().fromArray(state.velocity)).multiplyScalar(sample.age).add(new THREE.Vector3(state.position.x, state.position.y, state.position.z));
        const position = bike.position.clone().lerp(predicted, 1 - Math.exp(-15 * frameDt));
        const yaw = getMotorbikeHeading(bike);
        const diff = Math.atan2(Math.sin(state.yaw - yaw), Math.cos(state.yaw - yaw));
        const frame = vehicleGravity(bike).frame.clone().slerp(this.networkGravityFrame(state), 1 - Math.exp(-15 * frameDt));
        receiveVehicleGravity(bike, state.gravityOrientation, frame, state.gravityTransitionRemaining ?? 0);
        // Use vehicle yaw, never passenger aim or an interpolated avatar's old seat offset.
        this.applyRemoteTransform(bike, position, yaw + diff * (1 - Math.exp(-15 * frameDt)), state.rotation ? bike.quaternion.clone().slerp(new THREE.Quaternion().fromArray(state.rotation), 1 - Math.exp(-15 * frameDt)) : undefined);
        bike.userData.vehicleToppled = state.toppled === true;
        bike.userData.vehicleSurfaceSupported = state.surfaceSupported === true;
        if (state.autoStabilize !== undefined) bike.userData.logicProperties.autoStabilize = state.autoStabilize;
        if (state.landingAssistEnabled !== undefined) bike.userData.logicProperties.landingAssistEnabled = state.landingAssistEnabled;
        if (state.landingAssistMode !== undefined) bike.userData.logicProperties.landingAssistMode = state.landingAssistMode;
        bike.userData.vehicleMotion = { speed: state.speed, verticalSpeed: state.verticalSpeed ?? 0, lean: state.lean };
        bike.userData.logicProperties.consumableUse = Math.max(0, Math.min(state.fuel, bike.userData.logicProperties.maxConsumableUse));
        bike.animateMotorbike?.(state.speed * Math.min(dt, 0.05), state.steering, state.lean);
        if (state.jetpackActive) this.spawnBikeJetpackEffect(bike, state.jetpackVFX || 'Humo y Fuego');
        if (state.isDrifting) {
          const remotePivoting = Boolean(Math.abs(state.speed) < 0.35 && Math.abs(state.steering) > 0.05);
          this.spawnTireTrack(bike, state.driftMarkDuration ?? bike.userData.logicProperties?.driftMarkDuration ?? 4, remotePivoting);
        } else {
          this.endBikeTracks(bike);
        }
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
        syncVehicleGravity(player, bike);
        player.syncVehicleSeat?.(position, getMotorbikeHeading(bike), seat, bike.userData.vehicleMotion?.lean ?? this.lean, dt, bike.quaternion);
      }
      if (bike === this.mounted && this.isPassenger) {
        this.lean = bike.userData.vehicleMotion?.lean ?? 0;
        const hasRemoteDriver = Boolean(bike.userData.vehicleDriver && bike.userData.vehicleDriver !== this.playerId);
        this.syncRider(hasRemoteDriver ? dt : 0, hasRemoteDriver);
      }
    }
  }

  private show(message: string, fuel?: number, maxFuel = 1) {
    if (this.game.hud?.updateVehicle) {
      const props = this.mounted?.userData.logicProperties;
      this.game.hud.updateVehicle(this.isDriver && props && !this.game.character.isDead ? {
        speed: Math.abs(this.speed) * 3.6,
        maxSpeed: (props.maxSpeed + props.jetpackMaxSpeedBonus) * 3.6,
        fuel: props.consumableUse, maxFuel: props.maxConsumableUse,
        durability: props.durability, maxDurability: props.maxDurability,
        durabilityEnabled: props.durabilityEnabled, jetpack: this.vehicleJetpackActive,
      } : null);
      // Keep transient interaction errors visible; only replace the old driving readout.
      if (fuel !== undefined) {
        if (this.hud) this.hud.style.display = 'none';
        return;
      }
    }
    if (!this.hud || !this.readout || !this.fuelBar) return;
    this.hud.style.display = 'block';
    this.readout.style.whiteSpace = 'pre-line';
    const props = this.mounted?.userData.logicProperties;
    const durability = props?.durabilityEnabled ? `
Durabilidad ${Math.ceil(props.durability)} / ${props.maxDurability}${isMotorbikeBroken(props) ? ' · AVERIADA' : ''}` : '';
    this.readout.textContent = message + durability;
    this.fuelBar.style.display = fuel === undefined ? 'none' : 'block';
    this.fuelBar.max = maxFuel;
    this.fuelBar.value = fuel ?? 0;
  }
  dispose() {
    this.dismount(true);
    this.speedLines.dispose();
    this.tireTracks.dispose();
    this.damageEffects.dispose();
    this.fall.reset(this.game.character);
    for (const [bike] of this.coasting) {
      const body = bike.userData.rigidBody;
      if (!body?.isValid()) continue;
      body.setTranslation(bike.position, true);
      body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.coasting.clear();
    this.physics.dispose();
    this.game.world.removeCharacterController(this.controller);
    this.game.cameraController?.setYawConstraint?.(null);
    this.hud?.remove();
  }
}

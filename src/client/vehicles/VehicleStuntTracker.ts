import * as THREE from 'three';
import { normalizeMotorbikeSettings, type MotorbikeSettings } from './MotorbikeSettings';
import { vehicleUp } from './VehicleGravity';
import { applyResponsivePosition } from '../ui/modules/HUDResponsiveUtils';

export interface StuntTrick {
  name: string;
  icon: string;
  points: number;
  time: number;
}

export interface StuntLandingFeedback {
  status: 'perfect' | 'clean' | 'crash' | 'rough';
  bonusPoints?: number;
  points: number;
  totalSessionScore?: number;
}

export class VehicleStuntTracker {
  // Airborne state
  private isAirborne = false;
  private airTime = 0;
  private airPoints = 0;
  private trickPoints = 0;
  private comboMultiplier = 1.0;
  private currentJumpScore = 0;
  private totalSessionScore = 0;

  // Angular tracking in local space
  private lastQuaternion = new THREE.Quaternion();
  private accumulatedPitch = 0;
  private accumulatedRoll = 0;
  private accumulatedYaw = 0;

  // Completed trick counters during current jump
  private completedFrontflips = 0;
  private completedBackflips = 0;
  private completedBarrelRolls = 0;
  private completedSpins = 0;
  private hasTriggeredBigAir = false;

  // Tricks list for current jump
  private tricksLog: StuntTrick[] = [];

  // Landing feedback state
  private landingFeedbackTimer = 0;
  private currentFeedback: StuntLandingFeedback | null = null;

  // HUD DOM Elements
  private hudContainer: HTMLDivElement | null = null;
  private hudTopRow: HTMLDivElement | null = null;
  private hudAirTimer: HTMLSpanElement | null = null;
  private hudComboBadge: HTMLSpanElement | null = null;
  private hudLandingBadge: HTMLSpanElement | null = null;
  private hudScoreNumber: HTMLDivElement | null = null;
  private hudTricksContainer: HTMLDivElement | null = null;
  private hudTotalSessionScore: HTMLDivElement | null = null;

  constructor(private game?: any) {
    this.initHUD();
  }

  private applyCustomPosition() {
    if (!this.hudContainer) return;
    const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
    const hudSettings = profile?.hudSettings || this.game?.hud?.settings;
    if (!hudSettings) return;

    const pos = hudSettings.vehicleStuntsPos || { left: '50%', top: '15%', transform: 'translateX(-50%)' };
    applyResponsivePosition(this.hudContainer, pos);

    if (hudSettings.vehicleStuntsWidth) {
      const w = hudSettings.vehicleStuntsWidth;
      this.hudContainer.style.width = typeof w === 'number' ? `${w}px` : w;
    }

    if (this.hudTotalSessionScore) {
      this.hudTotalSessionScore.style.display = hudSettings.vehicleStuntsShowTotal ? 'block' : 'none';
    }
  }

  private initHUD() {
    if (typeof document === 'undefined') return;

    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'vehicle-stunt-hud';
    this.hudContainer.style.cssText = `
      display: none;
      position: fixed;
      top: 15%;
      left: 50%;
      transform: translateX(-50%);
      flex-direction: column;
      align-items: center;
      gap: 5px;
      pointer-events: none;
      z-index: 120;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      box-sizing: border-box;
      transition: opacity 0.2s ease;
    `;

    // Top status badges (Air time + Combo + Landing feedback badge)
    this.hudTopRow = document.createElement('div');
    this.hudTopRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    `;

    this.hudAirTimer = document.createElement('span');
    this.hudAirTimer.style.cssText = `
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
      backdrop-filter: blur(6px);
    `;

    this.hudComboBadge = document.createElement('span');
    this.hudComboBadge.style.cssText = `
      display: none;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(239, 68, 68, 0.9));
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.5);
      animation: comboPulse 0.6s infinite alternate ease-in-out;
    `;

    // Small sleek landing badge (e.g. ✨ +150 Aterrizaje perfecto)
    this.hudLandingBadge = document.createElement('span');
    this.hudLandingBadge.style.cssText = `
      display: none;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      backdrop-filter: blur(6px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
      animation: badgePop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    this.hudTopRow.append(this.hudAirTimer, this.hudComboBadge, this.hudLandingBadge);

    // Main Score Display (clean, no "ACROBACIA EN CURSO")
    const scoreBox = document.createElement('div');
    scoreBox.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    `;

    this.hudScoreNumber = document.createElement('div');
    this.hudScoreNumber.style.cssText = `
      font-size: 34px;
      font-weight: 900;
      color: #00f0ff;
      letter-spacing: 1px;
      text-shadow: 0 0 20px rgba(0, 240, 255, 0.8), 0 2px 6px rgba(0, 0, 0, 0.9);
      line-height: 1.1;
      transition: color 0.15s ease, text-shadow 0.15s ease, transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    this.hudScoreNumber.textContent = '+0 PTS';

    scoreBox.append(this.hudScoreNumber);

    // Tricks Chips Container (Disappearing swiftly)
    this.hudTricksContainer = document.createElement('div');
    this.hudTricksContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
      max-width: 320px;
    `;

    // Total Session Score (tiny subtle readout, configurable)
    this.hudTotalSessionScore = document.createElement('div');
    this.hudTotalSessionScore.style.cssText = `
      display: none;
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 3px;
      font-weight: 600;
    `;

    this.hudContainer.append(this.hudTopRow, scoreBox, this.hudTricksContainer, this.hudTotalSessionScore);
    document.body.appendChild(this.hudContainer);

    this.injectStyles();
  }

  private injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('vehicle-stunt-style')) return;
    const style = document.createElement('style');
    style.id = 'vehicle-stunt-style';
    style.textContent = `
      @keyframes comboPulse {
        from { transform: scale(1); filter: brightness(1); }
        to { transform: scale(1.08); filter: brightness(1.2); }
      }
      @keyframes badgePop {
        from { opacity: 0; transform: scale(0.85); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes trickChipIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.92); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .trick-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(18, 24, 38, 0.92);
        border: 1px solid rgba(0, 240, 255, 0.4);
        border-radius: 8px;
        padding: 4px 10px;
        color: #f8fafc;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 2px 10px rgba(0, 240, 255, 0.2);
        animation: trickChipIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .trick-chip-pts {
        color: #38bdf8;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  public update(
    bike: THREE.Object3D,
    grounded: boolean,
    crashed: boolean,
    toppled: boolean,
    dt: number,
    isRidden: boolean
  ) {
    if (!bike || !bike.parent || dt <= 0) return;

    const props: MotorbikeSettings = normalizeMotorbikeSettings(bike.userData.logicProperties);

    // If disabled via vehicle configuration, hide HUD and skip
    if (props.scoreSystemEnabled === false) {
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      this.isAirborne = false;
      return;
    }

    // If disabled via player role HUD settings, hide HUD and skip
    const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
    const hudSettings = profile?.hudSettings || this.game?.hud?.settings;
    if (hudSettings && hudSettings.showVehicleStunts === false) {
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      this.isAirborne = false;
      return;
    }

    // If rider dismounted or dead, clear state
    if (!isRidden) {
      if (this.isAirborne) {
        this.isAirborne = false;
        if (this.hudContainer) this.hudContainer.style.display = 'none';
      }
      return;
    }

    // Process landing feedback countdown if active
    if (this.landingFeedbackTimer > 0) {
      this.landingFeedbackTimer -= dt;
      if (this.landingFeedbackTimer <= 0) {
        if (this.hudContainer && !this.isAirborne) {
          this.hudContainer.style.display = 'none';
        }
      }
    }

    // STATE TRANSITION: JUST LEFT THE GROUND -> AIRBORNE
    if (!this.isAirborne && !grounded) {
      this.startAirborne(bike);
    }

    // ACTIVE AIRBORNE LOOP
    if (this.isAirborne) {
      if (!grounded) {
        this.stepAirborne(bike, dt, props);
      } else {
        // LANDING TRIGGER
        this.handleLanding(bike, crashed, toppled, props);
      }
    }
  }

  private startAirborne(bike: THREE.Object3D) {
    this.isAirborne = true;
    this.airTime = 0;
    this.airPoints = 0;
    this.trickPoints = 0;
    this.comboMultiplier = 1.0;
    this.currentJumpScore = 0;

    this.lastQuaternion.copy(bike.quaternion);
    this.accumulatedPitch = 0;
    this.accumulatedRoll = 0;
    this.accumulatedYaw = 0;

    this.completedFrontflips = 0;
    this.completedBackflips = 0;
    this.completedBarrelRolls = 0;
    this.completedSpins = 0;
    this.hasTriggeredBigAir = false;

    this.tricksLog = [];

    // Reset styles back to active stunts mode
    if (this.hudLandingBadge) this.hudLandingBadge.style.display = 'none';
    if (this.hudScoreNumber) {
      this.hudScoreNumber.style.color = '#00f0ff';
      this.hudScoreNumber.style.textShadow = '0 0 20px rgba(0, 240, 255, 0.8), 0 2px 6px rgba(0, 0, 0, 0.9)';
      this.hudScoreNumber.textContent = '+0 PTS';
    }
    if (this.hudTricksContainer) this.hudTricksContainer.innerHTML = '';
  }

  private stepAirborne(bike: THREE.Object3D, dt: number, props: MotorbikeSettings) {
    this.airTime += dt;
    this.airPoints = Math.floor(this.airTime * props.airTimePointsPerSecond);

    // Compute relative delta rotation in vehicle's local axes
    // qRel = lastQuat^-1 * currentQuat
    const qRel = this.lastQuaternion.clone().invert().multiply(bike.quaternion);
    this.lastQuaternion.copy(bike.quaternion);

    const euler = new THREE.Euler().setFromQuaternion(qRel, 'YXZ');
    let dPitch = euler.x; // Pitch around local X (Right axis)
    let dYaw = euler.y;   // Yaw around local Y (Up axis)
    let dRoll = euler.z;  // Roll around local Z (Forward axis)

    // Normalize deltas to [-PI, PI] to handle any frame hitches cleanly
    while (dPitch > Math.PI) dPitch -= 2 * Math.PI;
    while (dPitch < -Math.PI) dPitch -= 2 * Math.PI;
    while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
    while (dRoll > Math.PI) dRoll -= 2 * Math.PI;
    while (dRoll < -Math.PI) dRoll += 2 * Math.PI;

    this.accumulatedPitch += dPitch;
    this.accumulatedYaw += dYaw;
    this.accumulatedRoll += dRoll;

    // Trick threshold: ~330 degrees (5.76 radians) so almost full rotations register comfortably
    const ROTATION_THRESHOLD = Math.PI * 1.83;

    // 1. FRONTFLIP: Nose pitch down (negative pitch delta in 3D right-handed system)
    if (this.accumulatedPitch <= -ROTATION_THRESHOLD) {
      this.accumulatedPitch += 2 * Math.PI;
      this.completedFrontflips++;
      const title = this.completedFrontflips === 1 ? 'Frontflip' : this.completedFrontflips === 2 ? 'Double Frontflip' : `${this.completedFrontflips}x Frontflip`;
      this.registerTrick({
        name: title,
        icon: '🔄',
        points: props.frontflipPoints,
        time: this.airTime
      }, props);
    }

    // 2. BACKFLIP: Nose pitch up (positive pitch delta)
    if (this.accumulatedPitch >= ROTATION_THRESHOLD) {
      this.accumulatedPitch -= 2 * Math.PI;
      this.completedBackflips++;
      const title = this.completedBackflips === 1 ? 'Backflip' : this.completedBackflips === 2 ? 'Double Backflip' : `${this.completedBackflips}x Backflip`;
      this.registerTrick({
        name: title,
        icon: '🔄',
        points: props.backflipPoints,
        time: this.airTime
      }, props);
    }

    // 3. BARREL ROLL: Lateral roll around Z axis
    if (Math.abs(this.accumulatedRoll) >= ROTATION_THRESHOLD) {
      const isPositive = this.accumulatedRoll > 0;
      this.accumulatedRoll += isPositive ? -2 * Math.PI : 2 * Math.PI;
      this.completedBarrelRolls++;
      const title = this.completedBarrelRolls === 1 ? 'Barrel Roll' : this.completedBarrelRolls === 2 ? 'Double Barrel Roll' : `${this.completedBarrelRolls}x Barrel Roll`;
      this.registerTrick({
        name: title,
        icon: '🌀',
        points: props.barrelRollPoints,
        time: this.airTime
      }, props);
    }

    // 4. SPIN 360: Horizontal turn around Y axis
    if (Math.abs(this.accumulatedYaw) >= ROTATION_THRESHOLD) {
      const isPositive = this.accumulatedYaw > 0;
      this.accumulatedYaw += isPositive ? -2 * Math.PI : 2 * Math.PI;
      this.completedSpins++;
      const deg = this.completedSpins * 360;
      this.registerTrick({
        name: `Giro ${deg}°`,
        icon: '🌪️',
        points: props.spin360Points,
        time: this.airTime
      }, props);
    }

    // 5. BIG AIR BONUS: Air time exceeding 2.5s
    if (this.airTime >= 2.5 && !this.hasTriggeredBigAir) {
      this.hasTriggeredBigAir = true;
      this.registerTrick({
        name: '¡Gran Salto! (Big Air)',
        icon: '🚀',
        points: 100,
        time: this.airTime
      }, props);
    }

    // Compute combo multiplier if enabled
    const totalTricks = this.completedFrontflips + this.completedBackflips + this.completedBarrelRolls + this.completedSpins + (this.hasTriggeredBigAir ? 1 : 0);
    if (props.comboMultiplierEnabled && totalTricks > 1) {
      this.comboMultiplier = 1.0 + (totalTricks - 1) * props.comboMultiplierStep;
    } else {
      this.comboMultiplier = 1.0;
    }

    // Calculate current running total for jump
    this.currentJumpScore = Math.round((this.airPoints + this.trickPoints) * this.comboMultiplier);

    // Update Live HUD
    const shouldShowHUD = props.showStuntHUD && (this.airTime >= props.minAirTimeToScore || this.tricksLog.length > 0);
    if (shouldShowHUD) {
      this.renderLiveHUD();
    }
  }

  private registerTrick(trick: StuntTrick, props: MotorbikeSettings) {
    this.trickPoints += trick.points;
    this.tricksLog.push(trick);

    // Pop animation on score text
    if (this.hudScoreNumber) {
      this.hudScoreNumber.style.transform = 'scale(1.3)';
      setTimeout(() => {
        if (this.hudScoreNumber) this.hudScoreNumber.style.transform = 'scale(1)';
      }, 120);
    }

    // Add chip to HUD and make it disappear quickly!
    if (this.hudTricksContainer) {
      const chip = document.createElement('div');
      chip.className = 'trick-chip';
      chip.innerHTML = `<span>${trick.icon}</span> <span>${trick.name}</span> <span class="trick-chip-pts">+${trick.points}</span>`;
      this.hudTricksContainer.appendChild(chip);

      // Fast auto-dismiss: stays visible for only 0.9s, then fades out in 0.2s and gets removed
      setTimeout(() => {
        chip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        chip.style.opacity = '0';
        chip.style.transform = 'translateY(-8px) scale(0.9)';
        setTimeout(() => {
          chip.remove();
        }, 210);
      }, 900);

      // Keep maximum 3 chips visible simultaneously
      while (this.hudTricksContainer.children.length > 3) {
        this.hudTricksContainer.removeChild(this.hudTricksContainer.firstChild!);
      }
    }
  }

  private renderLiveHUD() {
    if (!this.hudContainer) return;
    this.applyCustomPosition();
    this.hudContainer.style.display = 'flex';

    const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
    const hudSettings = profile?.hudSettings || this.game?.hud?.settings;
    const showDetails = hudSettings ? hudSettings.vehicleStuntsShowText !== false : true;

    if (this.hudAirTimer) {
      if (showDetails) {
        this.hudAirTimer.style.display = 'inline-block';
        this.hudAirTimer.textContent = `⏱️ ${this.airTime.toFixed(1)}s AIRE`;
      } else {
        this.hudAirTimer.style.display = 'none';
      }
    }

    if (this.hudComboBadge) {
      if (showDetails && this.comboMultiplier > 1.0) {
        this.hudComboBadge.textContent = `🔥 x${this.comboMultiplier.toFixed(1)} COMBO`;
        this.hudComboBadge.style.display = 'inline-block';
      } else {
        this.hudComboBadge.style.display = 'none';
      }
    }

    if (this.hudLandingBadge) {
      this.hudLandingBadge.style.display = 'none';
    }

    if (this.hudScoreNumber) {
      this.hudScoreNumber.textContent = `+${this.currentJumpScore.toLocaleString()} PTS`;
    }

    if (this.hudTotalSessionScore) {
      const showTotal = hudSettings ? hudSettings.vehicleStuntsShowTotal === true : false;
      if (showTotal) {
        this.hudTotalSessionScore.style.display = 'block';
        this.hudTotalSessionScore.textContent = `🏆 Total acumulado: ${this.totalSessionScore.toLocaleString()}`;
      } else {
        this.hudTotalSessionScore.style.display = 'none';
      }
    }
  }

  private handleLanding(
    bike: THREE.Object3D,
    crashed: boolean,
    toppled: boolean,
    props: MotorbikeSettings
  ) {
    const minTimeMet = this.airTime >= props.minAirTimeToScore;
    const hasTricks = this.tricksLog.length > 0;

    // If it was just a tiny bump with no tricks, silently reset without banner spam
    if (!minTimeMet && !hasTricks) {
      this.isAirborne = false;
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      return;
    }

    // Evaluate orientation relative to gravity up normal
    const gravUp = vehicleUp(bike);
    const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bike.quaternion);
    const uprightDot = bikeUp.dot(gravUp);

    const isCrash = crashed || toppled || bike.userData.vehicleToppled === true || uprightDot < 0.38;
    const isPerfect = !isCrash && uprightDot >= 0.88;

    if (isCrash) {
      if (props.crashResetsScore) {
        this.showLandingFeedback({
          status: 'crash',
          points: 0,
          totalSessionScore: this.totalSessionScore
        });
      } else {
        this.totalSessionScore += this.currentJumpScore;
        this.showLandingFeedback({
          status: 'rough',
          points: this.currentJumpScore,
          totalSessionScore: this.totalSessionScore
        });
      }
    } else {
      let finalPoints = this.currentJumpScore;
      let bonusPoints = 0;

      if (isPerfect && (this.airTime >= 0.4 || hasTricks)) {
        bonusPoints = props.perfectLandingBonus;
        finalPoints += bonusPoints;
      }

      this.totalSessionScore += finalPoints;

      this.showLandingFeedback({
        status: isPerfect ? 'perfect' : 'clean',
        bonusPoints: bonusPoints,
        points: finalPoints,
        totalSessionScore: this.totalSessionScore
      });
    }

    this.isAirborne = false;
  }

  private showLandingFeedback(feedback: StuntLandingFeedback) {
    this.currentFeedback = feedback;
    // Fast disappearance: 1.1s total duration
    this.landingFeedbackTimer = 1.1;

    const profile = this.game?.playerConfigManager?.getCurrentProfile?.();
    const hudSettings = profile?.hudSettings || this.game?.hud?.settings;
    if (hudSettings && hudSettings.showVehicleStunts === false) {
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      return;
    }

    if (!this.hudContainer) return;
    this.applyCustomPosition();
    this.hudContainer.style.display = 'flex';

    if (this.hudTricksContainer) this.hudTricksContainer.innerHTML = '';
    if (this.hudAirTimer) this.hudAirTimer.style.display = 'none';
    if (this.hudComboBadge) this.hudComboBadge.style.display = 'none';

    // Show small sleek landing badge
    if (this.hudLandingBadge) {
      let badgeText = '';
      let badgeBg = '';
      let badgeBorder = '';
      let badgeColor = '';
      let badgeShadow = '';

      if (feedback.status === 'perfect') {
        const bonus = feedback.bonusPoints ? `+${feedback.bonusPoints} ` : '';
        badgeText = `✨ ${bonus}Aterrizaje perfecto`;
        badgeBg = 'rgba(16, 185, 129, 0.25)';
        badgeBorder = '1px solid #34d399';
        badgeColor = '#6ee7b7';
        badgeShadow = '0 0 10px rgba(52, 211, 153, 0.4)';
      } else if (feedback.status === 'clean') {
        badgeText = '👍 Aterrizaje limpio';
        badgeBg = 'rgba(14, 165, 233, 0.25)';
        badgeBorder = '1px solid #38bdf8';
        badgeColor = '#7dd3fc';
        badgeShadow = '0 0 10px rgba(56, 189, 248, 0.4)';
      } else if (feedback.status === 'rough') {
        badgeText = '⚠️ Aterrizaje forzoso';
        badgeBg = 'rgba(245, 158, 11, 0.25)';
        badgeBorder = '1px solid #f59e0b';
        badgeColor = '#fde68a';
        badgeShadow = '0 0 10px rgba(245, 158, 11, 0.4)';
      } else {
        badgeText = '💥 Acrobacia fallida';
        badgeBg = 'rgba(239, 68, 68, 0.25)';
        badgeBorder = '1px solid #ef4444';
        badgeColor = '#fca5a5';
        badgeShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
      }

      this.hudLandingBadge.textContent = badgeText;
      this.hudLandingBadge.style.background = badgeBg;
      this.hudLandingBadge.style.border = badgeBorder;
      this.hudLandingBadge.style.color = badgeColor;
      this.hudLandingBadge.style.boxShadow = badgeShadow;
      this.hudLandingBadge.style.display = 'inline-block';
    }

    // Set original counter color and points according to landing quality
    if (this.hudScoreNumber) {
      if (feedback.status === 'perfect') {
        this.hudScoreNumber.style.color = '#34d399';
        this.hudScoreNumber.style.textShadow = '0 0 24px rgba(52, 211, 153, 0.9), 0 2px 8px rgba(0, 0, 0, 0.9)';
      } else if (feedback.status === 'clean') {
        this.hudScoreNumber.style.color = '#38bdf8';
        this.hudScoreNumber.style.textShadow = '0 0 20px rgba(56, 189, 248, 0.9), 0 2px 8px rgba(0, 0, 0, 0.9)';
      } else if (feedback.status === 'rough') {
        this.hudScoreNumber.style.color = '#f59e0b';
        this.hudScoreNumber.style.textShadow = '0 0 20px rgba(245, 158, 11, 0.9), 0 2px 8px rgba(0, 0, 0, 0.9)';
      } else {
        this.hudScoreNumber.style.color = '#ef4444';
        this.hudScoreNumber.style.textShadow = '0 0 20px rgba(239, 68, 68, 0.9), 0 2px 8px rgba(0, 0, 0, 0.9)';
      }

      this.hudScoreNumber.textContent = feedback.points > 0 ? `+${feedback.points.toLocaleString()} PTS` : '0 PTS';
      this.hudScoreNumber.style.transform = 'scale(1.2)';
      setTimeout(() => {
        if (this.hudScoreNumber) this.hudScoreNumber.style.transform = 'scale(1)';
      }, 140);
    }

    if (this.hudTotalSessionScore && feedback.totalSessionScore !== undefined) {
      const showTotal = hudSettings ? hudSettings.vehicleStuntsShowTotal === true : false;
      if (showTotal) {
        this.hudTotalSessionScore.style.display = 'block';
        this.hudTotalSessionScore.textContent = `🏆 Total acumulado: ${feedback.totalSessionScore.toLocaleString()}`;
      } else {
        this.hudTotalSessionScore.style.display = 'none';
      }
    }
  }

  public resetSession() {
    this.isAirborne = false;
    this.totalSessionScore = 0;
    this.currentJumpScore = 0;
    this.landingFeedbackTimer = 0;
    if (this.hudContainer) this.hudContainer.style.display = 'none';
  }

  public getTotalSessionScore(): number {
    return this.totalSessionScore;
  }

  public dispose() {
    this.hudContainer?.remove();
    this.hudContainer = null;
  }
}

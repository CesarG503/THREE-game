import * as THREE from "three";
import { AnimationRegistry } from "./AnimationSystem";
import type { IAnimationSystem, LimbParts, AnimationState, AnimationInfo } from "./AnimationSystem";

export class ClassicAnimationSystem implements IAnimationSystem {
  id = "classic";
  name = "Clásica Minecraft";

  getAnimations(): AnimationInfo[] {
    return [
      { name: "Espera (Idle)", description: "Balanceo suave de los brazos al estar quieto." },
      { name: "Caminar (Walk)", description: "Movimiento oscilatorio alternado de brazos y piernas." },
      { name: "Correr (Sprint)", description: "Marcha acelerada con mayor oscilación al correr." },
      { name: "Agacharse (Crouch)", description: "Inclinación del cuerpo hacia adelante y flexión." },
      { name: "Ataque (Swing/Punch)", description: "Movimiento rápido de golpe con los brazos." },
      { name: "Vuelo (Superman)", description: "Postura horizontal de vuelo estilo Superman." },
      { name: "Apuntar/Recargar (Weapon)", description: "Animaciones de combate al sostener armas de fuego." },
      { name: "Giro en el Aire (Flip)", description: "Salto mortal al caer o saltar." }
    ];
  }

  update(parts: LimbParts, state: AnimationState, model: any) {
    const dt = state.dt;
    const isMoving = state.isMoving;
    const isCrouching = state.isCrouching;
    const isAttacking = state.isAttacking;
    const isGrounded = state.isGrounded;
    const isSuperman = state.isSuperman;
    const noPitchTilt = state.noPitchTilt;

    const attackLerpSpeed = 15 * dt;
    const targetWeight = isAttacking && !state.isHoldingWeapon ? 1.0 : 0.0;
    model.attackWeight = THREE.MathUtils.lerp(model.attackWeight, targetWeight, attackLerpSpeed);

    const attackSpeed = 25;
    const attackVal = Math.sin((Date.now() / 1000) * attackSpeed);
    const swing = (attackVal + 1) / 2;

    const pixelScale = (1 / 16) * 0.9;
    const crouchOffset = isCrouching ? 0.2 : 0;
    const legCrouchOffset = isCrouching ? 0.05 : 0;

    const targetHeadY = 1.3 - crouchOffset;
    const targetBodyY = 1.3 - 6 * pixelScale - crouchOffset;

    let targetRArmX = 4 * pixelScale + 2 * pixelScale;
    let targetLArmX = -4 * pixelScale - 2 * pixelScale;
    let targetRArmY = 1.3 - 2 * pixelScale - crouchOffset;
    let targetLArmY = 1.3 - 2 * pixelScale - crouchOffset;
    let targetRArmZ = 0;
    let targetLArmZ = 0;

    if (state.isFirstPerson && state.isHoldingWeapon) {
      const curPitch = state.targetHeadPitch || 0;
      const isLeft = state.currentWeaponHand === "left";

      let xOffset = isLeft ? -0.15 : 0.15;
      let yOffset = -0.15;
      const zOffset = -0.05;

      if (curPitch > 0) {
        xOffset += isLeft ? -curPitch * 0.15 : curPitch * 0.15;
        yOffset -= curPitch * 0.2;
      } else {
        yOffset -= curPitch * 0.1;
      }

      if (isLeft) {
        targetLArmX += xOffset;
        targetLArmY += yOffset;
        targetLArmZ += zOffset;
      } else {
        targetRArmX += xOffset;
        targetRArmY += yOffset;
        targetRArmZ += zOffset;
      }
    }

    const baseLegY = 1.3 - 12 * pixelScale;
    const targetLegY = baseLegY - legCrouchOffset;
    const lerpSpeed = 10 * dt;

    parts.headGroup.position.y = THREE.MathUtils.lerp(parts.headGroup.position.y, targetHeadY, lerpSpeed);
    parts.body.position.y = THREE.MathUtils.lerp(parts.body.position.y, targetBodyY, lerpSpeed);

    parts.rightArmGroup.position.x = THREE.MathUtils.lerp(parts.rightArmGroup.position.x, targetRArmX, lerpSpeed);
    parts.leftArmGroup.position.x = THREE.MathUtils.lerp(parts.leftArmGroup.position.x, targetLArmX, lerpSpeed);
    parts.rightArmGroup.position.y = THREE.MathUtils.lerp(parts.rightArmGroup.position.y, targetRArmY, lerpSpeed);
    parts.leftArmGroup.position.y = THREE.MathUtils.lerp(parts.leftArmGroup.position.y, targetLArmY, lerpSpeed);
    parts.rightArmGroup.position.z = THREE.MathUtils.lerp(parts.rightArmGroup.position.z, targetRArmZ, lerpSpeed);
    parts.leftArmGroup.position.z = THREE.MathUtils.lerp(parts.leftArmGroup.position.z, targetLArmZ, lerpSpeed);

    parts.rightLegGroup.position.y = THREE.MathUtils.lerp(parts.rightLegGroup.position.y, targetLegY, lerpSpeed);
    parts.leftLegGroup.position.y = THREE.MathUtils.lerp(parts.leftLegGroup.position.y, targetLegY, lerpSpeed);

    const targetBodyRotX = isCrouching ? 0.2 : 0;
    parts.body.rotation.x = THREE.MathUtils.lerp(parts.body.rotation.x, targetBodyRotX, lerpSpeed);

    const targetHeadRotX = targetBodyRotX - (state.targetHeadPitch || 0);
    parts.headGroup.rotation.x = THREE.MathUtils.lerp(parts.headGroup.rotation.x, targetHeadRotX, lerpSpeed * 2.0);

    if (parts.backItemMesh) {
      const targetBackY = (1.3 - 6 * pixelScale) - crouchOffset;
      parts.backItemMesh.position.y = THREE.MathUtils.lerp(parts.backItemMesh.position.y, targetBackY, lerpSpeed);
      const targetBackRotX = -parts.body.rotation.x;
      parts.backItemMesh.rotation.x = THREE.MathUtils.lerp(parts.backItemMesh.rotation.x, targetBackRotX, lerpSpeed);
    }

    if (isSuperman) {
      const currentPitch = state.targetHeadPitch || 0;
      const targetPivotRotX = noPitchTilt ? Math.PI / 2.2 : (Math.PI / 2.2 - currentPitch);
      parts.pivotGroup.rotation.x = THREE.MathUtils.lerp(parts.pivotGroup.rotation.x, targetPivotRotX, 10 * dt);

      const targetHeadRotX = -Math.PI / 2;
      parts.headGroup.rotation.x = THREE.MathUtils.lerp(parts.headGroup.rotation.x, targetHeadRotX, 10 * dt);

      const armFlyRotX = -Math.PI + 0.2;
      parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.x, armFlyRotX, 10 * dt);
      parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.x, armFlyRotX, 10 * dt);

      parts.leftArmGroup.rotation.z = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.z, -0.15, 10 * dt);
      parts.rightArmGroup.rotation.z = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.z, 0.15, 10 * dt);

      parts.leftArmGroup.rotation.y = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.y, 0, 10 * dt);
      parts.rightArmGroup.rotation.y = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.y, 0, 10 * dt);

      parts.leftLegGroup.rotation.x = THREE.MathUtils.lerp(parts.leftLegGroup.rotation.x, 0.05, 10 * dt);
      parts.rightLegGroup.rotation.x = THREE.MathUtils.lerp(parts.rightLegGroup.rotation.x, -0.05, 10 * dt);

      parts.body.rotation.y = THREE.MathUtils.lerp(parts.body.rotation.y, 0, 10 * dt);
      parts.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(parts.upperBodyGroup.rotation.y, 0, 10 * dt);
      parts.headGroup.rotation.y = THREE.MathUtils.lerp(parts.headGroup.rotation.y, state.targetHeadYaw || 0, 10 * dt);
    } else {
      let baseRArmX = 0;
      let baseLArmX = 0;
      let baseRLegX = 0;
      let baseLLegX = 0;
      let baseRArmZ = 0;
      let baseLArmZ = 0;

      if (isMoving) {
        const speed = isCrouching ? 5 : (state.isRunning ? 14 : 10);
        const time = (Date.now() / 1000) * speed;
        const sinVal = Math.sin(time);

        baseRArmX = sinVal * 0.8;
        baseLArmX = -sinVal * 0.8;
        baseRLegX = -sinVal * 0.8;
        baseLLegX = sinVal * 0.8;

        if (isCrouching) {
          baseRArmX += 0.2;
          baseLArmX += 0.2;
        }
      } else {
        const time = Date.now() / 1000;
        baseRArmZ = Math.sin(time) * 0.05 + 0.05;
        baseLArmZ = -Math.sin(time) * 0.05 - 0.05;

        if (isCrouching) {
          baseRArmX = 0.2;
          baseLArmX = 0.2;
        }
      }

      const animLerp = 0.2;
      parts.rightLegGroup.rotation.x = THREE.MathUtils.lerp(parts.rightLegGroup.rotation.x, baseRLegX, animLerp);
      parts.leftLegGroup.rotation.x = THREE.MathUtils.lerp(parts.leftLegGroup.rotation.x, baseLLegX, animLerp);

      if (model.attackWeight > 0.01) {
        const blend = model.attackWeight;
        const punchRotX = -swing * 2.5 - 0.2;
        const recoilRotX = swing * 0.5 + 0.5;
        const targetTwist = swing * 0.4;

        const finalLArmX = THREE.MathUtils.lerp(baseLArmX, punchRotX, blend);
        const finalRArmX = THREE.MathUtils.lerp(baseRArmX, recoilRotX, blend);
        const finalTwist = THREE.MathUtils.lerp(0, targetTwist, blend);

        parts.leftArmGroup.rotation.x = finalLArmX;
        parts.rightArmGroup.rotation.x = finalRArmX;
        parts.body.rotation.y = 0;
        parts.upperBodyGroup.rotation.y = finalTwist;
        parts.headGroup.rotation.y = state.targetHeadYaw || 0;
        parts.leftArmGroup.rotation.y = 0;
        parts.rightArmGroup.rotation.y = 0;
      } else if (state.isHoldingWeapon) {
        const currentPitch = state.targetHeadPitch || 0;
        const pointAimAngle = -Math.PI / 2 - currentPitch;
        const aimBob = isMoving ? Math.sin((Date.now() / 100) * 0.5) * 0.05 : Math.sin(Date.now() / 500) * 0.02;

        let freeArmTargetRotX = state.currentWeaponHand === "left" ? baseRArmX : baseLArmX;
        let freeArmTargetRotZ = state.currentWeaponHand === "left" ? baseRArmZ : baseLArmZ;
        let weaponArmRotZ = 0;
        let weaponArmRotY = 0;

        const pitchOffset = currentPitch * 0.3;
        if (state.currentWeaponHand === "left") {
          weaponArmRotZ = -0.1 - pitchOffset * 0.5;
          weaponArmRotY = 0.15 + pitchOffset * 0.5;
        } else {
          weaponArmRotZ = 0.1 + pitchOffset * 0.5;
          weaponArmRotY = -0.15 - pitchOffset * 0.5;
        }

        if (state.heldItem && state.heldItem.isReloading) {
          if (!state.heldItem._reloadStartTime) {
            state.heldItem._reloadStartTime = Date.now();
          }

          const t = (Date.now() - state.heldItem._reloadStartTime) / 700;
          const targetRotX = -Math.PI / 2;
          const targetRotZ = state.currentWeaponHand === "left" ? -0.8 : 0.8;

          if (t < 1.0) {
            const localLerp = t / 1.0;
            const ease = localLerp * localLerp * (3 - 2 * localLerp);
            freeArmTargetRotX = THREE.MathUtils.lerp(freeArmTargetRotX, targetRotX, ease);
            freeArmTargetRotZ = THREE.MathUtils.lerp(freeArmTargetRotZ, targetRotZ, ease);
          } else if (t < 1.5) {
            const dipLerp = (t - 1.0) / 0.5;
            const dip = Math.sin(dipLerp * Math.PI) * 0.4;
            freeArmTargetRotX = targetRotX + dip;
            freeArmTargetRotZ = targetRotZ;
          } else if (t < 2.2) {
            const localLerp = (t - 1.5) / 0.7;
            const ease = localLerp * localLerp * (3 - 2 * localLerp);
            freeArmTargetRotX = THREE.MathUtils.lerp(targetRotX, freeArmTargetRotX, ease);
            freeArmTargetRotZ = THREE.MathUtils.lerp(
              targetRotZ,
              state.currentWeaponHand === "left" ? baseRArmZ : baseLArmZ,
              ease
            );
          }
        } else if (state.heldItem) {
          state.heldItem._reloadStartTime = null;
        }

        const headYaw = state.targetHeadYaw || 0;
        parts.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(parts.upperBodyGroup.rotation.y, headYaw, animLerp * 2.0);

        let weaponSwayZ = 0;
        let weaponSwayY = 0;
        weaponSwayZ = headYaw * -0.4;
        weaponSwayY = headYaw * 0.3;

        if (state.currentWeaponHand === "left") {
          parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.x, pointAimAngle + aimBob, 0.2);
          parts.leftArmGroup.rotation.z = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.z, weaponArmRotZ + weaponSwayZ, 0.2);
          parts.leftArmGroup.rotation.y = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.y, weaponArmRotY + weaponSwayY, 0.4);

          parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.x, freeArmTargetRotX, animLerp);
          parts.rightArmGroup.rotation.z = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.z, freeArmTargetRotZ, animLerp);
          parts.rightArmGroup.rotation.y = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.y, 0, animLerp);
        } else {
          parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.x, pointAimAngle + aimBob, 0.2);
          parts.rightArmGroup.rotation.z = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.z, weaponArmRotZ + weaponSwayZ, 0.2);
          parts.rightArmGroup.rotation.y = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.y, weaponArmRotY + weaponSwayY, 0.4);

          parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.x, freeArmTargetRotX, animLerp);
          parts.leftArmGroup.rotation.z = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.z, freeArmTargetRotZ, animLerp);
          parts.leftArmGroup.rotation.y = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.y, 0, animLerp);
        }

        if (parts.heldItemMesh && state.heldItem && state.heldItem.type === "weapon") {
          const recoil = state.heldItem.gunImpulse ? state.heldItem.gunImpulse * 2 : 0;
          const reloadZ = state.heldItem.springReloadZ || 0;
          const initialZ = 2 * pixelScale;

          parts.heldItemMesh.position.z = initialZ - reloadZ - recoil;
          parts.heldItemMesh.rotation.x = state.heldItem.isReloading ? -Math.PI / 2 - reloadZ * 3 : -Math.PI / 2;
        }

        const aimTwist = state.currentWeaponHand === "left" ? 0.2 : -0.2;
        parts.body.rotation.y = THREE.MathUtils.lerp(parts.body.rotation.y, aimTwist, animLerp);
        parts.headGroup.rotation.y = THREE.MathUtils.lerp(parts.headGroup.rotation.y, aimTwist * 0.5, animLerp * 2.0);
      } else {
        parts.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(parts.upperBodyGroup.rotation.y, 0, animLerp);
        parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.x, baseLArmX, animLerp);
        parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.x, baseRArmX, animLerp);
        parts.leftArmGroup.rotation.z = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.z, baseLArmZ, animLerp);
        parts.rightArmGroup.rotation.z = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.z, baseRArmZ, animLerp);

        const resetTwist = 0;
        parts.body.rotation.y = THREE.MathUtils.lerp(parts.body.rotation.y, resetTwist, animLerp);
        parts.headGroup.rotation.y = THREE.MathUtils.lerp(parts.headGroup.rotation.y, resetTwist + (state.targetHeadYaw || 0), animLerp * 2.0);
        parts.leftArmGroup.rotation.y = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.y, resetTwist, animLerp);
        parts.rightArmGroup.rotation.y = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.y, resetTwist, animLerp);
      }
    }

    if (!isSuperman) {
      const jumpAnim = state.jumpAnimationType || "flip";
      const fallAnim = state.fallAnimationType || "none";
      let shouldFlip = false;

      if (jumpAnim === "flip" && !isGrounded) {
        shouldFlip = true;
      }

      if (fallAnim === "flip" && !isGrounded && model.airTime > 0.5) {
        shouldFlip = true;
      }

      if (shouldFlip) {
        const jumpLerp = 0.15;

        parts.rightArmGroup.rotation.z = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.z, 0, jumpLerp);
        parts.leftArmGroup.rotation.z = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.z, 0, jumpLerp);
        parts.rightArmGroup.rotation.x = THREE.MathUtils.lerp(parts.rightArmGroup.rotation.x, -0.5, jumpLerp);
        parts.leftArmGroup.rotation.x = THREE.MathUtils.lerp(parts.leftArmGroup.rotation.x, -0.5, jumpLerp);
        parts.rightLegGroup.rotation.x = THREE.MathUtils.lerp(parts.rightLegGroup.rotation.x, 0.5, jumpLerp);
        parts.leftLegGroup.rotation.x = THREE.MathUtils.lerp(parts.leftLegGroup.rotation.x, 0.5, jumpLerp);

        parts.pivotGroup.rotation.x -= 10 * dt;
      } else {
        const currentRot = parts.pivotGroup.rotation.x;
        if (Math.abs(currentRot) > 0.001) {
          const twoPI = Math.PI * 2;
          const targetRot = Math.round(currentRot / twoPI) * twoPI;
          parts.pivotGroup.rotation.x = THREE.MathUtils.lerp(currentRot, targetRot, 15 * dt);

          if (Math.abs(parts.pivotGroup.rotation.x - targetRot) < 0.01) {
            parts.pivotGroup.rotation.x = 0;
          }
        }
      }
    }
  }
}

AnimationRegistry.register(new ClassicAnimationSystem());

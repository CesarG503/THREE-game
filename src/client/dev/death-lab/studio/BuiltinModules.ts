/**
 * BuiltinModules.ts — Library of composable, reusable modules for Death Experience Studio.
 *
 * Each module is self-contained: it reads parameters, creates proxy objects,
 * adds animations to the Anime.js v4 timeline, creates DOM/3D elements as needed,
 * and cleans them up upon reset or disposal.
 */

import * as THREE from "three";
import type { DeathModule, ModuleContext } from "./ModuleRegistry";
import type { Keyframe } from "./DeathExperienceTypes";

// ============================================================================
// CAMERA MODULES
// ============================================================================

export const CamGroundDollyModule: DeathModule = {
  id: "cam_ground_dolly",
  name: "Ground Dolly & Sniper Pan",
  category: "camera",
  description: "Cámara táctica que desciende a ras de suelo y luego panea hacia el francotirador.",
  defaultParams: {
    startPos: [0, 1.6, 3.8],
    dollyPos: [-0.4, 0.55, 2.1],
    dollyTarget: [0, 0.25, 0],
    sniperPos: [-1.2, 1.6, 2.4],
    sniperTarget: [8.5, 4.2, -16.5],
    fov: 54,
    dollyDuration: 1400,
    panDuration: 1700,
    panDelay: 1700,
  },
  paramSchema: [
    { name: "fov", label: "Field of View", type: "number", min: 30, max: 100, step: 1, default: 54 },
    { name: "dollyDuration", label: "Dolly Duration (ms)", type: "number", min: 400, max: 4000, step: 100, default: 1400 },
    { name: "panDuration", label: "Pan Duration (ms)", type: "number", min: 400, max: 4000, step: 100, default: 1700 },
    { name: "panDelay", label: "Pan Delay (ms)", type: "number", min: 0, max: 5000, step: 100, default: 1700 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const fov = Number(params.fov ?? 54);
    const dollyDuration = Number(params.dollyDuration ?? 1400);
    const panDuration = Number(params.panDuration ?? 1700);
    const panDelay = Number(params.panDelay ?? 1700);

    ctx.scene.camera.position.set(0, 1.6, 3.8);
    ctx.scene.cameraTarget.set(0, 1.2, 0);
    ctx.scene.camera.lookAt(ctx.scene.cameraTarget);

    // 1. Dolly to ground
    ctx.adapter.animateCamera(
      ctx.scene.camera,
      ctx.scene.cameraTarget,
      {
        position: { x: -0.4, y: 0.55, z: 2.1 },
        target: { x: 0, y: 0.25, z: 0 },
        fov,
        duration: dollyDuration,
        ease: "outCubic",
      },
      ctx.timeline,
      offset + 100
    );

    // 2. Pan to sniper
    ctx.adapter.animateCamera(
      ctx.scene.camera,
      ctx.scene.cameraTarget,
      {
        position: { x: -1.2, y: 1.6, z: 2.4 },
        target: { x: 8.5, y: 4.2, z: -16.5 },
        fov: fov - 8,
        duration: panDuration,
        ease: "inOutQuad",
      },
      ctx.timeline,
      offset + panDelay
    );
  },
};

export const CamOrbit360Module: DeathModule = {
  id: "cam_orbit_360",
  name: "Bullet-Time 360° Orbit",
  category: "camera",
  description: "Órbita cinemática alrededor del personaje congelado en tiempo bala.",
  defaultParams: {
    sweepAngle: 288,
    radius: 3.2,
    camHeight: 1.5,
    targetHeight: 1.35,
    duration: 3200,
    ease: "linear",
  },
  paramSchema: [
    { name: "sweepAngle", label: "Sweep Angle (°)", type: "number", min: 90, max: 720, step: 10, default: 288 },
    { name: "radius", label: "Orbit Radius (m)", type: "number", min: 1.5, max: 8.0, step: 0.1, default: 3.2 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 1000, max: 6000, step: 100, default: 3200 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, duration: number) {
    const sweepRad = (Number(params.sweepAngle ?? 288) * Math.PI) / 180;
    const baseRadius = Number(params.radius ?? 3.2);
    const dur = duration > 0 ? duration : Number(params.duration ?? 3200);

    const orbitProxy = {
      angle: 0,
      radius: baseRadius,
      camY: 1.5,
      targetY: 1.35,
    };

    ctx.timeline.add(
      orbitProxy,
      {
        angle: sweepRad,
        radius: [baseRadius, baseRadius * 0.85, baseRadius * 1.1],
        camY: [1.5, 1.35, 2.1],
        duration: dur,
        ease: "linear",
        onUpdate: () => {
          ctx.scene.camera.position.x = Math.sin(orbitProxy.angle) * orbitProxy.radius;
          ctx.scene.camera.position.z = Math.cos(orbitProxy.angle) * orbitProxy.radius;
          ctx.scene.camera.position.y = orbitProxy.camY;
          ctx.scene.cameraTarget.set(0, orbitProxy.targetY, 0);
          ctx.scene.camera.lookAt(ctx.scene.cameraTarget);
        },
      },
      offset
    );
  },
};

export const CamCraneOverheadModule: DeathModule = {
  id: "cam_crane_overhead",
  name: "High-Angle Crane Pullout",
  category: "camera",
  description: "Ascenso vertical a plano cenital aéreo con posterior swoop horizontal.",
  defaultParams: {
    craneHeight: 7.2,
    craneDistance: 6.0,
    fov: 68,
    duration: 1650,
  },
  paramSchema: [
    { name: "craneHeight", label: "Crane Height (m)", type: "number", min: 3, max: 15, step: 0.5, default: 7.2 },
    { name: "craneDistance", label: "Crane Distance (m)", type: "number", min: 2, max: 12, step: 0.5, default: 6.0 },
    { name: "fov", label: "Field of View", type: "number", min: 45, max: 90, step: 1, default: 68 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const height = Number(params.craneHeight ?? 7.2);
    const dist = Number(params.craneDistance ?? 6.0);
    const fov = Number(params.fov ?? 68);
    const dur = Number(params.duration ?? 1650);

    ctx.adapter.animateCamera(
      ctx.scene.camera,
      ctx.scene.cameraTarget,
      {
        position: { x: 0, y: height, z: dist },
        target: { x: 0, y: 0.4, z: 1.8 },
        fov,
        duration: dur,
        ease: "outCubic",
      },
      ctx.timeline,
      offset
    );
  },
};

export const CamGlitchDesyncModule: DeathModule = {
  id: "cam_glitch_desync",
  name: "Cyber Lens FOV Desynchronization",
  category: "camera",
  description: "Espasmo de FOV y roll angular que simula fallo en implantes oculares.",
  defaultParams: {
    fovJitter: [60, 84, 52, 65, 58],
    rollJitter: [0, -0.08, 0.06, -0.03, 0],
    duration: 1500,
  },
  paramSchema: [
    { name: "duration", label: "Glitch Duration (ms)", type: "number", min: 400, max: 3000, step: 50, default: 1500 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const dur = Number(params.duration ?? 1500);

    const cameraGlitch = {
      fov: 60,
      rotZ: 0,
      camY: 1.6,
      camZ: 3.8,
    };

    ctx.timeline.add(
      cameraGlitch,
      {
        fov: [60, 84, 52, 65, 58],
        rotZ: [0, -0.08, 0.06, -0.03, 0],
        camY: 0.75,
        camZ: 2.3,
        duration: dur,
        ease: "outCubic",
        onUpdate: () => {
          ctx.scene.camera.fov = cameraGlitch.fov;
          ctx.scene.camera.updateProjectionMatrix();
          ctx.scene.camera.rotation.z = cameraGlitch.rotZ;
          ctx.scene.camera.position.y = cameraGlitch.camY;
          ctx.scene.camera.position.z = cameraGlitch.camZ;
        },
      },
      offset
    );

    return () => {
      ctx.scene.camera.rotation.z = 0;
      ctx.scene.camera.fov = 60;
      ctx.scene.camera.updateProjectionMatrix();
    };
  },
};

// ============================================================================
// CHARACTER MODULES
// ============================================================================

export const CharKinematicCollapseModule: DeathModule = {
  id: "char_kinematic_collapse",
  name: "Articulated Ragdoll Solver",
  category: "character",
  description: "Colapso articular físico realista (de pie a suelo sprawl) con interpolación cinemática.",
  defaultParams: {
    duration: 1350,
    ease: "outCubic",
  },
  paramSchema: [
    { name: "duration", label: "Collapse Duration (ms)", type: "number", min: 500, max: 3000, step: 50, default: 1350 },
    { name: "ease", label: "Easing", type: "easing", default: "outCubic" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const dur = Number(params.duration ?? 1350);
    const ease = String(params.ease ?? "outCubic");

    ctx.scene.playerActor.setPose(0);
    const poseProxy = { progress: 0 };

    ctx.timeline.add(
      poseProxy,
      {
        progress: 1.0,
        duration: dur,
        ease,
        onUpdate: () => {
          ctx.scene.playerActor.setPose(poseProxy.progress);
        },
      },
      offset
    );

    return () => {
      ctx.scene.playerActor.setPose(0);
    };
  },
};

export const CharComedicLaunchModule: DeathModule = {
  id: "char_comedic_launch",
  name: "Comedic Cartwheel Launch",
  category: "character",
  description: "Impulso cómico hacia atrás con rotación exagerada y voltereta física.",
  defaultParams: {
    launchHeight: 2.8,
    knockbackDist: 3.8,
    rotations: 2.2,
    duration: 900,
  },
  paramSchema: [
    { name: "launchHeight", label: "Apex Height (m)", type: "number", min: 1, max: 6, step: 0.2, default: 2.8 },
    { name: "knockbackDist", label: "Knockback Distance (m)", type: "number", min: 1, max: 8, step: 0.2, default: 3.8 },
    { name: "rotations", label: "Full Flips", type: "number", min: 0.5, max: 5, step: 0.5, default: 2.2 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 400, max: 2000, step: 50, default: 900 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const height = Number(params.launchHeight ?? 2.8);
    const dist = Number(params.knockbackDist ?? 3.8);
    const flips = Number(params.rotations ?? 2.2);
    const dur = Number(params.duration ?? 900);

    const comedicPhysics = {
      posY: 1.05,
      posZ: 0,
      rotX: 0,
      rotZ: 0,
      poseP: 0,
    };

    ctx.timeline.add(
      comedicPhysics,
      {
        posY: [
          { value: height, duration: dur * 0.38, ease: "outQuad" },
          { value: 0.15, duration: dur * 0.62, ease: "inQuad" },
        ],
        posZ: [
          { value: dist * 0.42, duration: dur * 0.44, ease: "linear" },
          { value: dist, duration: dur * 0.56, ease: "outQuad" },
        ],
        rotX: -Math.PI * flips,
        rotZ: 0.75,
        poseP: 0.85,
        duration: dur,
        ease: "linear",
        onUpdate: () => {
          ctx.scene.playerActor.pelvis.position.y = comedicPhysics.posY;
          ctx.scene.playerActor.pelvis.position.z = comedicPhysics.posZ;
          ctx.scene.playerActor.pelvis.rotation.x = comedicPhysics.rotX;
          ctx.scene.playerActor.pelvis.rotation.z = comedicPhysics.rotZ;
          ctx.scene.playerActor.setPose(comedicPhysics.poseP);
        },
      },
      offset
    );

    return () => {
      ctx.scene.playerActor.pelvis.position.set(0, 1.05, 0);
      ctx.scene.playerActor.pelvis.rotation.set(0, 0, 0);
      ctx.scene.playerActor.setPose(0);
    };
  },
};

export const CharBulletFreezeModule: DeathModule = {
  id: "char_bullet_freeze",
  name: "Bullet-Time Impact Freeze",
  category: "character",
  description: "Congela al personaje en el instante exacto del impacto para efecto bullet-time.",
  defaultParams: {
    freezePose: 0.28,
  },
  paramSchema: [
    { name: "freezePose", label: "Impact Pose Progress (0-1)", type: "number", min: 0, max: 1, step: 0.05, default: 0.28 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], _offset: number, _duration: number) {
    const pose = Number(params.freezePose ?? 0.28);
    ctx.scene.playerActor.setPose(pose);
    return () => {
      ctx.scene.playerActor.setPose(0);
    };
  },
};

// ============================================================================
// EFFECT MODULES
// ============================================================================

export const FxShockwaveModule: DeathModule = {
  id: "fx_shockwave",
  name: "3D Floor Shockwave Ring",
  category: "effect",
  description: "Anillo expansivo en el suelo 3D con atenuación de opacidad y escala.",
  defaultParams: {
    color: 0x10b981,
    maxScale: 14.0,
    duration: 1250,
  },
  paramSchema: [
    { name: "color", label: "Color", type: "color", default: 0x10b981 },
    { name: "maxScale", label: "Max Radius Scale", type: "number", min: 2, max: 30, step: 1, default: 14.0 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 300, max: 3000, step: 50, default: 1250 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const col = Number(params.color ?? 0x10b981);
    const maxScale = Number(params.maxScale ?? 14.0);
    const dur = Number(params.duration ?? 1250);

    const shockMat = ctx.scene.shockwaveMesh.material as THREE.MeshBasicMaterial;
    shockMat.color.setHex(col);
    shockMat.opacity = 0;
    ctx.scene.shockwaveMesh.scale.set(0.1, 0.1, 1);

    const shockProxy = { scale: 0.1, opacity: 1.0 };
    ctx.timeline.add(
      shockProxy,
      {
        scale: maxScale,
        opacity: [1.0, 0.0],
        duration: dur,
        ease: "outExpo",
        onUpdate: () => {
          ctx.scene.shockwaveMesh.scale.set(shockProxy.scale, shockProxy.scale, 1);
          shockMat.opacity = shockProxy.opacity;
        },
      },
      offset
    );

    return () => {
      ctx.scene.shockwaveMesh.scale.set(1, 1, 1);
      shockMat.opacity = 0;
    };
  },
};

export const FxWeaponDropModule: DeathModule = {
  id: "fx_weapon_drop",
  name: "Dropped Weapon Ballistics",
  category: "effect",
  description: "Lanzamiento y rebote inercial del arma en el suelo tras el impacto.",
  defaultParams: {
    skidDistance: 1.25,
    bounceHeight: 1.35,
    duration: 650,
  },
  paramSchema: [
    { name: "skidDistance", label: "Skid Distance (m)", type: "number", min: 0.5, max: 4.0, step: 0.1, default: 1.25 },
    { name: "bounceHeight", label: "Bounce Apex (m)", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.35 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 300, max: 1500, step: 50, default: 650 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const skid = Number(params.skidDistance ?? 1.25);
    const bounce = Number(params.bounceHeight ?? 1.35);
    const dur = Number(params.duration ?? 650);

    ctx.scene.droppedWeapon.visible = false;
    ctx.scene.droppedWeapon.position.set(0.35, 1.1, -0.2);
    ctx.scene.droppedWeapon.rotation.set(0, 0, 0);

    const weaponPhysics = {
      x: 0.35,
      y: 1.1,
      z: -0.2,
      rotX: 0,
      rotZ: 0,
    };

    ctx.timeline.add(
      weaponPhysics,
      {
        x: skid,
        y: [
          { value: bounce, duration: dur * 0.38, ease: "outQuad" },
          { value: 0.08, duration: dur * 0.62, ease: "inQuad" },
        ],
        z: 0.45,
        rotX: 3.6,
        rotZ: 1.5,
        duration: dur,
        ease: "linear",
        onBegin: () => {
          ctx.scene.droppedWeapon.visible = true;
        },
        onUpdate: () => {
          ctx.scene.droppedWeapon.position.set(weaponPhysics.x, weaponPhysics.y, weaponPhysics.z);
          ctx.scene.droppedWeapon.rotation.set(weaponPhysics.rotX, 0.4, weaponPhysics.rotZ);
        },
      },
      offset
    );

    return () => {
      ctx.scene.droppedWeapon.visible = false;
    };
  },
};

export const FxVoxelBurstModule: DeathModule = {
  id: "fx_voxel_burst",
  name: "3D Voxel Scatter Burst",
  category: "effect",
  description: "Dispersión radial de cubos de colores tridimensionales con física de gravedad.",
  defaultParams: {
    voxelCount: 16,
    burstRadius: 3.0,
    duration: 800,
  },
  paramSchema: [
    { name: "voxelCount", label: "Voxel Count", type: "number", min: 4, max: 32, step: 2, default: 16 },
    { name: "burstRadius", label: "Burst Radius (m)", type: "number", min: 1, max: 6, step: 0.5, default: 3.0 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 400, max: 2000, step: 50, default: 800 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const count = Number(params.voxelCount ?? 16);
    const radius = Number(params.burstRadius ?? 3.0);
    const dur = Number(params.duration ?? 800);

    const voxelGroup = new THREE.Group();
    ctx.scene.scene.add(voxelGroup);

    const colors = [0xfacc15, 0xf43f5e, 0x38bdf8, 0xa855f7, 0x10b981, 0xfb923c];
    const cubeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const meshes: THREE.Mesh[] = [];

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.3,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(cubeGeo, mat);
      mesh.position.set(0, 1.1, 0);
      mesh.visible = false;
      voxelGroup.add(mesh);
      meshes.push(mesh);

      const angle = (i / count) * Math.PI * 2;
      const dist = radius * (0.6 + Math.random() * 0.4);
      const targetX = Math.cos(angle) * dist;
      const targetZ = Math.sin(angle) * dist;

      const scatterProxy = { x: 0, y: 1.1, z: 0, rotX: 0, rotY: 0, rotZ: 0 };
      ctx.timeline.add(
        scatterProxy,
        {
          x: targetX,
          y: [
            { value: 2.2 + Math.random() * 1.5, duration: dur * 0.4, ease: "outQuad" },
            { value: 0.1, duration: dur * 0.6, ease: "inQuad" },
          ],
          z: targetZ,
          rotX: Math.random() * Math.PI * 4,
          rotY: Math.random() * Math.PI * 4,
          rotZ: Math.random() * Math.PI * 4,
          duration: dur,
          ease: "linear",
          onBegin: () => {
            mesh.visible = true;
          },
          onUpdate: () => {
            mesh.position.set(scatterProxy.x, scatterProxy.y, scatterProxy.z);
            mesh.rotation.set(scatterProxy.rotX, scatterProxy.rotY, scatterProxy.rotZ);
          },
        },
        offset + i * 8
      );
    }

    return () => {
      ctx.scene.scene.remove(voxelGroup);
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    };
  },
};

export const FxGlitchGhostsModule: DeathModule = {
  id: "fx_glitch_ghosts",
  name: "Chromatic Wireframe Glitch Clones",
  category: "effect",
  description: "Clones tridimensionales volumétricos en wireframe RGB desplazados lateralmente.",
  defaultParams: {
    maxOffset: 0.48,
    duration: 900,
  },
  paramSchema: [
    { name: "maxOffset", label: "Max Offset (m)", type: "number", min: 0.1, max: 1.5, step: 0.05, default: 0.48 },
    { name: "duration", label: "Duration (ms)", type: "number", min: 300, max: 2000, step: 50, default: 900 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const maxOff = Number(params.maxOffset ?? 0.48);
    const dur = Number(params.duration ?? 900);

    const ghostR = ctx.scene.glitchGhostR;
    const ghostC = ctx.scene.glitchGhostC;
    ghostR.visible = true;
    ghostC.visible = true;

    const rMat = (ghostR.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const cMat = (ghostC.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;

    const ghostProxy = { offsetX: 0, opacity: 0 };
    ctx.timeline.add(
      ghostProxy,
      {
        offsetX: [0, maxOff, -maxOff * 0.5, maxOff * 0.7, 0],
        opacity: [0, 0.85, 0.2, 0.7, 0],
        duration: dur,
        ease: "steps(6)",
        onUpdate: () => {
          ghostR.position.x = ghostProxy.offsetX;
          ghostC.position.x = -ghostProxy.offsetX;
          rMat.opacity = ghostProxy.opacity;
          cMat.opacity = ghostProxy.opacity;
        },
      },
      offset
    );

    return () => {
      ghostR.visible = false;
      ghostC.visible = false;
    };
  },
};

export const FxPowerDrainModule: DeathModule = {
  id: "fx_power_drain",
  name: "Suit Armor Power Drain",
  category: "effect",
  description: "Drenaje de energía luminosa en armadura y visor, tornando de esmeralda a carbón inerte.",
  defaultParams: {
    duration: 2000,
  },
  paramSchema: [
    { name: "duration", label: "Drain Duration (ms)", type: "number", min: 500, max: 4000, step: 100, default: 2000 },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const dur = Number(params.duration ?? 2000);

    const powerProxy = {
      armorR: 0.063,
      armorG: 0.725,
      armorB: 0.506,
      visorR: 0.0,
      visorG: 0.941,
      visorB: 1.0,
    };

    ctx.timeline.add(
      powerProxy,
      {
        armorR: 0.08,
        armorG: 0.12,
        armorB: 0.18,
        visorR: 0.07,
        visorG: 0.09,
        visorB: 0.13,
        duration: dur,
        ease: "outQuad",
        onUpdate: () => {
          ctx.scene.playerActor.materials.armor.color.setRGB(powerProxy.armorR, powerProxy.armorG, powerProxy.armorB);
          ctx.scene.playerActor.materials.visor.color.setRGB(powerProxy.visorR, powerProxy.visorG, powerProxy.visorB);
        },
      },
      offset
    );

    return () => {
      ctx.scene.playerActor.materials.armor.color.setHex(0x10b981);
      ctx.scene.playerActor.materials.visor.color.setHex(0x00f0ff);
    };
  },
};

// ============================================================================
// HUD MODULES
// ============================================================================

export const HudTacticalRibbonModule: DeathModule = {
  id: "hud_tactical_ribbon",
  name: "Tactical Combat Ribbons",
  category: "hud",
  description: "Cintas de información táctica militar con estado KIA y registro de telemetría.",
  defaultParams: {
    accentColor: "#ef4444",
  },
  paramSchema: [
    { name: "accentColor", label: "Accent Color", type: "string", default: "#ef4444" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const col = String(params.accentColor ?? "#ef4444");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      inset: 32px 48px;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: monospace;
      color: #f1f5f9;
      opacity: 0;
    `;

    const killerName = (ctx.scenario.killerName || "HostileOperative").toUpperCase();
    const weapon = ctx.scenario.weaponName || ctx.scenario.weapon || "Rifle Balístico";
    const dist = ctx.scenario.distanceMeters || 30;

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:11px; letter-spacing:0.18em; color:#94a3b8;">
        <div><span style="color:${col}; font-weight:bold;">[● REC]</span> TACTICAL PROTOCOL</div>
        <div>STATUS: <span style="color:${col}; font-weight:bold;">K.I.A.</span></div>
      </div>
      <div style="border-left:2px solid ${col}; padding-left:14px;">
        <div style="font-size:10px; color:${col}; letter-spacing:0.2em; font-weight:bold;">DISPARO LETAL</div>
        <div style="font-size:26px; font-weight:bold; color:#fff;">${killerName}</div>
        <div style="font-size:12px; color:#94a3b8;">${weapon} · ${dist}m</div>
      </div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        ease: "outCubic",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

export const HudSniperReticleModule: DeathModule = {
  id: "hud_sniper_reticle",
  name: "Optical Killer Tracking Bracket",
  category: "hud",
  description: "Caja de rastreo óptico en pantalla que enmarca la posición del agresor.",
  defaultParams: {
    color: "#ef4444",
  },
  paramSchema: [
    { name: "color", label: "Reticle Color", type: "string", default: "#ef4444" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const col = String(params.color ?? "#ef4444");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      top: 28%;
      left: 62%;
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      pointer-events: none;
      font-family: monospace;
    `;

    const killerName = (ctx.scenario.killerName || "Hostile").toUpperCase();
    const dist = ctx.scenario.distanceMeters || 48;

    el.innerHTML = `
      <div style="border:1px solid ${col}; width:50px; height:50px; position:relative; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:6px; height:6px; background:${col}; border-radius:50%;"></div>
        <div style="position:absolute; top:-2px; left:-2px; width:8px; height:8px; border-top:2px solid ${col}; border-left:2px solid ${col};"></div>
        <div style="position:absolute; bottom:-2px; right:-2px; width:8px; height:8px; border-bottom:2px solid ${col}; border-right:2px solid ${col};"></div>
      </div>
      <div style="background:rgba(15, 23, 42, 0.9); border:1px solid ${col}; padding:2px 8px; font-size:10px; color:#fca5a5; font-weight:bold; white-space:nowrap;">
        HOSTILE: ${killerName} [${dist}m]
      </div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        scale: [1.3, 1],
        duration: 400,
        ease: "outBack",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

export const HudStampedRankModule: DeathModule = {
  id: "hud_stamped_rank",
  name: "Elastic Stamped Placement Rank",
  category: "hud",
  description: "Puesto final (#2 / 100) estampado con impacto elástico frontal brutal.",
  defaultParams: {
    rankText: "#2 / 100",
    subtitle: "¡CASI LO LOGRAS!",
  },
  paramSchema: [
    { name: "rankText", label: "Rank Display", type: "string", default: "#2 / 100" },
    { name: "subtitle", label: "Subtitle", type: "string", default: "¡CASI LO LOGRAS!" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const rank = String(params.rankText ?? "#2 / 100");
    const sub = String(params.subtitle ?? "¡CASI LO LOGRAS!");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translate(-50%, -50%) scale(3.2) rotate(14deg);
      opacity: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
      font-family: Impact, sans-serif;
    `;

    el.innerHTML = `
      <div style="font-size:18px; color:#f472b6; letter-spacing:0.25em;">${sub}</div>
      <div style="font-size:96px; line-height:0.95; font-weight:900; color:#fef08a; text-shadow:5px 6px 0px #b45309, 10px 14px 0px #000;">
        ${rank}
      </div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        scale: [3.2, 1],
        rotate: [14, 0],
        duration: 950,
        ease: "outElastic(1, 0.45)",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

export const HudCyberTerminalModule: DeathModule = {
  id: "hud_cyber_terminal",
  name: "Cyber Monospace Terminal & EKG",
  category: "hud",
  description: "Terminal monocromo monospace, líneas de escaneo CRT y bio-monitor EKG flatline.",
  defaultParams: {
    terminalHeader: "// KERNEL PANIC: FATAL EXCEPTION",
  },
  paramSchema: [
    { name: "terminalHeader", label: "Header String", type: "string", default: "// KERNEL PANIC: FATAL EXCEPTION" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const hdr = String(params.terminalHeader ?? "// KERNEL PANIC: FATAL EXCEPTION");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      inset: 24px 36px;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: 'Courier New', monospace;
      color: #00f0ff;
      opacity: 0;
    `;

    el.innerHTML = `
      <div style="border-left:3px solid #ff0055; padding-left:12px;">
        <div style="font-size:11px; color:#ff0055; font-weight:bold;">${hdr}</div>
        <div style="font-size:22px; font-weight:900; color:#fff; text-shadow:2px 0 0 #ff0055, -2px 0 0 #00f0ff;">
          SYSTEM COLLAPSE · 0 BPM
        </div>
      </div>
      <div style="align-self:center; display:flex; align-items:center; gap:8px;">
        <svg width="240" height="20" viewBox="0 0 240 20">
          <path d="M 0 10 L 60 10 L 70 2 L 80 18 L 90 10 L 240 10" fill="none" stroke="#ff0055" stroke-width="2"/>
        </svg>
      </div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        translateY: [-16, 0],
        duration: 450,
        ease: "outCubic",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

export const HudVisorFrameModule: DeathModule = {
  id: "hud_visor_frame",
  name: "Curved Helmet OS Visor Reticle",
  category: "hud",
  description: "Borde de visor curvo con brackets en las esquinas y telemetría de soporte vital.",
  defaultParams: {
    color: "#10b981",
  },
  paramSchema: [
    { name: "color", label: "Visor Frame Color", type: "string", default: "#10b981" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const col = String(params.color ?? "#10b981");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      inset: 20px;
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 32px;
      pointer-events: none;
      box-shadow: inset 0 0 40px rgba(16, 185, 129, 0.12);
      opacity: 0;
      transform: scale(0.98);
    `;

    el.innerHTML = `
      <div style="position:absolute; top:-2px; left:-2px; width:24px; height:24px; border-top:3px solid ${col}; border-left:3px solid ${col}; border-top-left-radius:8px;"></div>
      <div style="position:absolute; top:-2px; right:-2px; width:24px; height:24px; border-top:3px solid ${col}; border-right:3px solid ${col}; border-top-right-radius:8px;"></div>
      <div style="position:absolute; bottom:-2px; left:-2px; width:24px; height:24px; border-bottom:3px solid ${col}; border-left:3px solid ${col}; border-bottom-left-radius:8px;"></div>
      <div style="position:absolute; bottom:-2px; right:-2px; width:24px; height:24px; border-bottom:3px solid ${col}; border-right:3px solid ${col}; border-bottom-right-radius:8px;"></div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        scale: [0.98, 1],
        duration: 600,
        ease: "outCubic",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

export const HudActionButtonsModule: DeathModule = {
  id: "hud_action_buttons",
  name: "Respawn & Spectator Prompts",
  category: "hud",
  description: "Botones interactivos de acción táctica: Reaparecer [Space] y Modo Espectador [E].",
  defaultParams: {
    respawnText: "REAPARECER (05s)",
  },
  paramSchema: [
    { name: "respawnText", label: "Button Label", type: "string", default: "REAPARECER (05s)" },
  ],
  apply(ctx: ModuleContext, params: Record<string, unknown>, _keyframes: Keyframe[], offset: number, _duration: number) {
    const txt = String(params.respawnText ?? "REAPARECER (05s)");

    const el = document.createElement("div");
    el.className = "studio-hud-element";
    el.style.cssText = `
      position: absolute;
      bottom: 32px;
      right: 48px;
      display: flex;
      gap: 12px;
      pointer-events: auto;
      font-family: sans-serif;
      opacity: 0;
    `;

    el.innerHTML = `
      <div style="background:#10b981; color:#030712; font-size:12px; font-weight:800; padding:10px 20px; border-radius:6px; cursor:pointer;">
        [SPACE] ${txt}
      </div>
      <div style="background:rgba(15,23,42,0.85); border:1px solid #475569; color:#fff; font-size:12px; font-weight:800; padding:10px 16px; border-radius:6px; cursor:pointer;">
        [E] ESPECTADOR
      </div>
    `;

    ctx.container.appendChild(el);

    ctx.timeline.add(
      el,
      {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        ease: "outCubic",
      },
      offset
    );

    return () => {
      el.remove();
    };
  },
};

// ============================================================================
// AUDIO MODULES
// ============================================================================

export const AudioTacticalPulseModule: DeathModule = {
  id: "audio_tactical_pulse",
  name: "Tactical Sub Heartbeat",
  category: "audio",
  description: "Pulso sub-grave de frecuencia cardíaca decreciente.",
  defaultParams: {},
  paramSchema: [],
  apply(ctx: ModuleContext, _params: Record<string, unknown>, _keyframes: Keyframe[], _offset: number, _duration: number) {
    ctx.audio.playTactical();
  },
};

export const AudioPopCelebrationModule: DeathModule = {
  id: "audio_pop_celebration",
  name: "Pop Arcade Fanfare",
  category: "audio",
  description: "Acorde pop festivo de sintetizador.",
  defaultParams: {},
  paramSchema: [],
  apply(ctx: ModuleContext, _params: Record<string, unknown>, _keyframes: Keyframe[], _offset: number, _duration: number) {
    ctx.audio.playBattleRoyale();
  },
};

export const AudioCyberGlitchModule: DeathModule = {
  id: "audio_cyber_glitch",
  name: "Cyber Glitch Synth",
  category: "audio",
  description: "Falla sintetizada con distorsión y oscilación cuadrada.",
  defaultParams: {},
  paramSchema: [],
  apply(ctx: ModuleContext, _params: Record<string, unknown>, _keyframes: Keyframe[], _offset: number, _duration: number) {
    ctx.audio.playCyberpunk();
  },
};

// ============================================================================
// REGISTRATION HELPER
// ============================================================================

export const ALL_BUILTIN_MODULES: DeathModule[] = [
  // Camera
  CamGroundDollyModule,
  CamOrbit360Module,
  CamCraneOverheadModule,
  CamGlitchDesyncModule,
  // Character
  CharKinematicCollapseModule,
  CharComedicLaunchModule,
  CharBulletFreezeModule,
  // Effects
  FxShockwaveModule,
  FxWeaponDropModule,
  FxVoxelBurstModule,
  FxGlitchGhostsModule,
  FxPowerDrainModule,
  // HUD
  HudTacticalRibbonModule,
  HudSniperReticleModule,
  HudStampedRankModule,
  HudCyberTerminalModule,
  HudVisorFrameModule,
  HudActionButtonsModule,
  // Audio
  AudioTacticalPulseModule,
  AudioPopCelebrationModule,
  AudioCyberGlitchModule,
];

import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import * as THREE from "three";

export class V02_BattleRoyale extends AbstractDeathVariant {
  public id = "v02_battle_royale";
  public name = "V02 — BATTLE ROYALE CHAOS";
  public subtitle = "Shooter Estilizado Pop · Impacto Balístico Cómico, Onda Expansiva 3D y Stamped Rank";
  public theme = "battle_royale_pop";
  public inspiration = "Fortnite, Fall Guys, Smash Bros, Apex Legends";

  private voxelBurstGroup: THREE.Group | null = null;

  public override cleanup(): void {
    if (this.voxelBurstGroup && this.sceneRef) {
      this.sceneRef.scene.remove(this.voxelBurstGroup);
      this.voxelBurstGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      this.voxelBurstGroup = null;
    }
    super.cleanup();
  }

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v02";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 36px 44px;
      box-sizing: border-box;
      font-family: 'Impact', 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
      overflow: hidden;
    `;

    const killerName = (scenario.killerName || "Bananaman420").toUpperCase();
    const weaponName = (scenario.weaponName || scenario.weapon || "Escopeta de Combate").toUpperCase();
    const distanceM = scenario.distanceMeters || scenario.distance || 3;

    root.innerHTML = `
      <!-- TOP: Giant Stamped Placement Rank (Stamped directly into camera view) -->
      <div id="v02-rank-container" style="display:flex; flex-direction:column; align-items:center; margin-top:16px; opacity:0; transform: scale(3.2) rotate(14deg); filter: drop-shadow(0 12px 30px rgba(0,0,0,0.85));">
        <div style="font-size:18px; color:#f472b6; letter-spacing:0.25em; text-transform:uppercase; text-shadow:2px 2px 0px #831843;">
          ¡CASI LO LOGRAS!
        </div>
        <div id="v02-rank-badge" style="font-size:clamp(72px, 13vw, 130px); line-height:0.95; font-weight:900; color:#fef08a; text-shadow:5px 6px 0px #b45309, 10px 14px 0px #000; letter-spacing:0.04em; transform-origin:center;">
          #2 / 100
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
          <span style="font-size:13px; font-weight:800; color:#030712; background:#38bdf8; padding:3px 14px; border-radius:14px; letter-spacing:0.12em; text-transform:uppercase;">
            TOP 2% DE LA ISLA
          </span>
          <span style="font-size:12px; color:#cbd5e1; font-family:sans-serif; font-weight:700; background:rgba(15,23,42,0.85); border:1px solid #475569; padding:2px 10px; border-radius:14px;">
            MATCH #088
          </span>
        </div>
      </div>

      <!-- CENTER-BOTTOM: Discreet Comic Kill Assessment & Details -->
      <div id="v02-details-bar" style="display:flex; flex-direction:column; align-items:center; gap:16px; width:100%; max-width:850px; opacity:0; transform: translateY(40px);">
        <!-- Kill Banner -->
        <div style="background:rgba(24, 13, 46, 0.94); border:3px solid #facc15; border-radius:18px; padding:14px 28px; box-shadow:0 12px 35px rgba(0,0,0,0.7), 0 0 25px rgba(250, 204, 21, 0.35); display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:18px;">
            <div style="font-size:36px; background:#f43f5e; border-radius:50%; width:54px; height:54px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 16px #f43f5e;">
              💥
            </div>
            <div>
              <div style="font-size:11px; color:#c084fc; letter-spacing:0.2em; text-transform:uppercase; font-family:sans-serif; font-weight:800;">
                ELIMINADO POR
              </div>
              <div style="font-size:26px; color:#fff; font-weight:900; letter-spacing:0.04em;">
                ${killerName}
              </div>
            </div>
          </div>

          <div style="text-align:right; font-family:sans-serif;">
            <div style="font-size:12px; color:#fde047; font-weight:800; text-transform:uppercase;">
              ${weaponName} · ${distanceM}M (BOCAJARRO)
            </div>
            <div style="font-size:12px; color:#94a3b8; margin-top:2px;">
              Daño recibido: <strong style="color:#ef4444;">999.9 HP</strong> · Espectadores: <strong style="color:#38bdf8;">👁 7</strong>
            </div>
          </div>
        </div>

        <!-- Pop Rewards Stamping Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <!-- Reward Badges -->
          <div id="v02-badges" style="display:flex; gap:12px;">
            <div class="v02-badge" style="background:#1e1b4b; border:2px solid #facc15; border-radius:12px; padding:8px 16px; display:flex; align-items:center; gap:8px; transform: scale(0.4); opacity:0;">
              <span style="font-size:18px;">🏆</span>
              <span style="font-size:14px; color:#fef08a; font-weight:900;">+650 XP</span>
            </div>
            <div class="v02-badge" style="background:#1e1b4b; border:2px solid #38bdf8; border-radius:12px; padding:8px 16px; display:flex; align-items:center; gap:8px; transform: scale(0.4); opacity:0;">
              <span style="font-size:18px;">⭐</span>
              <span style="font-size:14px; color:#bae6fd; font-weight:900;">NIVEL 43</span>
            </div>
            <div class="v02-badge" style="background:#1e1b4b; border:2px solid #ec4899; border-radius:12px; padding:8px 16px; display:flex; align-items:center; gap:8px; transform: scale(0.4); opacity:0;">
              <span style="font-size:18px;">🪙</span>
              <span style="font-size:14px; color:#fbcfe8; font-weight:900;">+250 MONEDAS</span>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display:flex; gap:10px; pointer-events:auto; font-family:sans-serif;">
            <div style="background:#facc15; color:#0f172a; font-size:12px; font-weight:900; padding:10px 20px; border-radius:10px; box-shadow:0 4px 15px rgba(250,204,21,0.5); display:flex; align-items:center; gap:6px;">
              <span style="background:#0f172a; color:#facc15; padding:1px 5px; border-radius:4px; font-size:10px;">[SPACE]</span> JUGAR DE NUEVO
            </div>
            <div style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:12px; font-weight:800; padding:10px 16px; border-radius:10px; display:flex; align-items:center; gap:6px;">
              <span style="background:rgba(255,255,255,0.2); color:#fff; padding:1px 5px; border-radius:4px; font-size:10px;">[E]</span> ESPECTAR
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(root);

    // =========================================================================
    // 3D SCENE SETUP: Stylized Voxel Scatter & Comedic Launch
    // =========================================================================
    const voxelGroup = new THREE.Group();
    this.voxelBurstGroup = voxelGroup;
    scene.scene.add(voxelGroup);

    // Create 18 colorful bursting voxels
    const voxelCount = 18;
    const voxelColors = [0xfacc15, 0xf43f5e, 0x38bdf8, 0xa855f7, 0x10b981, 0xfb923c];
    const voxelMeshes: THREE.Mesh[] = [];
    const voxelTargets: { x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number }[] = [];

    const cubeGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < voxelCount; i++) {
      const col = voxelColors[i % voxelColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.3,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(cubeGeo, mat);
      mesh.castShadow = true;
      mesh.position.set(0, 1.1, 0);
      mesh.visible = false;
      voxelGroup.add(mesh);
      voxelMeshes.push(mesh);

      // Randomized radial trajectories
      const angle = (i / voxelCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 1.8 + Math.random() * 2.8;
      voxelTargets.push({
        x: Math.cos(angle) * dist,
        y: 0.11, // Rest on ground
        z: Math.sin(angle) * dist + 1.2,
        rotX: Math.random() * Math.PI * 4,
        rotY: Math.random() * Math.PI * 4,
        rotZ: Math.random() * Math.PI * 4,
      });
    }

    // Reset player & camera
    scene.playerActor.setPose(0);
    scene.playerGroup.position.set(0, 0, 0);
    scene.camera.position.set(0, 1.5, 3.6);
    scene.cameraTarget.set(0, 1.1, 0);
    scene.camera.lookAt(scene.cameraTarget);

    // Floor Shockwave setup
    scene.shockwaveMesh.scale.set(0.1, 0.1, 1);
    const shockMat = scene.shockwaveMesh.material as THREE.MeshBasicMaterial;
    shockMat.color.setHex(0xfacc15);
    shockMat.opacity = 0;

    // =========================================================================
    // ANIME.JS V4 CINEMATIC TIMELINE DIRECTORIAL SEQUENCE
    // =========================================================================
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. FATAL IMPACT MOMENT: Comedic cartwheel knockback + articulated flail (t = 80ms - 1.2s)
    const comedicPhysics = {
      posY: 1.05,
      posZ: 0,
      rotX: 0,
      rotZ: 0,
      poseP: 0,
    };

    tl.add(
      comedicPhysics,
      {
        posY: [
          { value: 2.8, duration: 350, ease: "outQuad" },
          { value: 0.15, duration: 550, ease: "inQuad" },
        ],
        posZ: [
          { value: 1.6, duration: 400, ease: "linear" },
          { value: 3.8, duration: 500, ease: "outQuad" },
        ],
        rotX: -Math.PI * 2.2,
        rotZ: 0.75,
        poseP: 0.85,
        duration: 900,
        ease: "linear",
        onUpdate: () => {
          scene.playerActor.pelvis.position.y = comedicPhysics.posY;
          scene.playerActor.pelvis.position.z = comedicPhysics.posZ;
          scene.playerActor.pelvis.rotation.x = comedicPhysics.rotX;
          scene.playerActor.pelvis.rotation.z = comedicPhysics.rotZ;
          scene.playerActor.setPose(comedicPhysics.poseP);
        },
      },
      80
    );

    // 2. 3D VOXEL SCATTER BURST (t = 100ms - 1.1s)
    voxelMeshes.forEach((mesh, idx) => {
      const tgt = voxelTargets[idx];
      const scatterProxy = {
        x: 0,
        y: 1.1,
        z: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
      };

      tl.add(
        scatterProxy,
        {
          x: tgt.x,
          y: [
            { value: 2.2 + Math.random() * 1.5, duration: 320, ease: "outQuad" },
            { value: tgt.y, duration: 480, ease: "inQuad" },
          ],
          z: tgt.z,
          rotX: tgt.rotX,
          rotY: tgt.rotY,
          rotZ: tgt.rotZ,
          duration: 800,
          ease: "linear",
          onBegin: () => {
            mesh.visible = true;
          },
          onUpdate: () => {
            mesh.position.set(scatterProxy.x, scatterProxy.y, scatterProxy.z);
            mesh.rotation.set(scatterProxy.rotX, scatterProxy.rotY, scatterProxy.rotZ);
          },
        },
        100 + idx * 8
      );
    });

    // 3. 3D FLOOR SHOCKWAVE EXPANSION (t = 120ms - 1.4s)
    const shockProxy = { scale: 0.1, opacity: 1.0 };
    tl.add(
      shockProxy,
      {
        scale: 14.0,
        opacity: [1.0, 0.0],
        duration: 1250,
        ease: "outExpo",
        onUpdate: () => {
          scene.shockwaveMesh.scale.set(shockProxy.scale, shockProxy.scale, 1);
          shockMat.opacity = shockProxy.opacity;
        },
      },
      120
    );

    // 4. DRAMATIC HIGH-ANGLE CRANE CAMERA PULLOUT (t = 100ms - 1.8s)
    // Rises swiftly to high overhead framing the chaotic landing and expanding floor wave
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 7.2, z: 6.0 },
        target: { x: 0, y: 0.4, z: 1.8 },
        fov: 68,
        duration: 1650,
        ease: "outCubic",
      },
      tl,
      100
    );

    // 5. NARRATIVE SWOOP TO CELEBRATING KILLER / ARENA (t = 2.4s - 4.2s)
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 5.5, y: 3.6, z: -9.0 },
        target: { x: 9.0, y: 4.5, z: -17.0 },
        fov: 52,
        duration: 1800,
        ease: "inOutQuad",
      },
      tl,
      2400
    );

    // 6. STAMPED PLACEMENT RANK (#2 / 100) WITH ELASTIC IMPACT (t = 250ms - 1.3s)
    const rankContainer = root.querySelector("#v02-rank-container") as HTMLElement;
    const detailsBar = root.querySelector("#v02-details-bar") as HTMLElement;
    const badges = root.querySelectorAll(".v02-badge");

    if (rankContainer) {
      tl.add(
        rankContainer,
        {
          opacity: [0, 1],
          scale: [3.2, 1],
          rotate: [14, 0],
          duration: 950,
          ease: "outElastic(1, 0.45)",
        },
        220
      );
    }

    if (detailsBar) {
      tl.add(
        detailsBar,
        {
          opacity: [0, 1],
          translateY: [40, 0],
          duration: 550,
          ease: "outBack",
        },
        600
      );
    }

    if (badges.length > 0) {
      tl.add(
        badges,
        {
          opacity: [0, 1],
          scale: [0.4, 1],
          duration: 500,
          ease: "outBack",
          delay: stagger(100),
        },
        750
      );
    }
  }

  public onSpectatorTransition?(peerName: string, perspective: "first_person" | "third_person"): void {
    if (!this.containerEl) return;
    const detailsBar = this.containerEl.querySelector("#v02-details-bar");
    if (detailsBar) {
      detailsBar.innerHTML = `
        <div style="background:rgba(24, 13, 46, 0.94); border:2px solid #38bdf8; border-radius:14px; padding:12px 24px; box-shadow:0 0 20px rgba(56,189,248,0.4); display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background:#38bdf8; color:#0f172a; font-size:11px; font-weight:900; padding:2px 8px; border-radius:8px;">
              ESPECTANDO
            </div>
            <div style="font-size:20px; color:#fff; font-weight:900;">
              ${peerName}
            </div>
          </div>
          <div style="font-size:12px; color:#94a3b8; font-family:sans-serif;">
            Modo: <span style="color:#facc15; font-weight:bold;">${perspective === "first_person" ? "1ª Persona" : "3ª Persona"}</span> (Tecla V) · Cambiar con [Q / E]
          </div>
        </div>
      `;
    }
  }
}

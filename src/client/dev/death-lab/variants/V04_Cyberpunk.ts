import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import * as THREE from "three";

export class V04_Cyberpunk extends AbstractDeathVariant {
  public id = "v04_cyberpunk";
  public name = "V04 — CYBERPUNK / SYSTEM COLLAPSE";
  public subtitle = "Distopía Futurista · Digital Flatline, Clones Cromáticos 3D, Brownout y Terminal Monospace";
  public theme = "cyberpunk_glitch";
  public inspiration = "Cyberpunk 2077, Ghost in the Shell, Matrix, System Shock";

  public override cleanup(): void {
    if (this.sceneRef) {
      this.sceneRef.glitchGhostR.visible = false;
      this.sceneRef.glitchGhostC.visible = false;
      (this.sceneRef.glitchGhostR.children[0] as THREE.Mesh).position.set(0, 1.4, 0);
      (this.sceneRef.glitchGhostC.children[0] as THREE.Mesh).position.set(0, 1.4, 0);
      this.sceneRef.camera.rotation.z = 0;
      this.sceneRef.camera.fov = 60;
      this.sceneRef.camera.updateProjectionMatrix();
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
    root.id = "variant-root-v04";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 32px 48px;
      box-sizing: border-box;
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      color: #00f0ff;
      user-select: none;
      overflow: hidden;
    `;

    const killerName = (scenario.killerName || "CipherZero").toUpperCase();
    const weaponName = (scenario.weaponName || scenario.weapon || "Katana Neón / Plasma").toUpperCase();
    const distanceM = scenario.distanceMeters || scenario.distance || 4;

    root.innerHTML = `
      <!-- SCANLINE RASTER OVERLAY -->
      <div id="v04-scanlines" style="position:absolute; inset:0; background:linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04)); background-size: 100% 3px, 6px 100%; pointer-events:none; z-index:2; opacity:0.85;"></div>

      <!-- GLITCH CORRUPT FLASH OVERLAY -->
      <div id="v04-flash" style="position:absolute; inset:0; background:rgba(255, 0, 85, 0.28); mix-blend-mode:hard-light; pointer-events:none; z-index:3; opacity:0;"></div>

      <!-- TOP: Authentic Cyberpunk Kernel Terminal Header -->
      <div id="v04-top" style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:flex-start; opacity:0; transform: translateY(-18px);">
        <div style="border-left:3px solid #ff0055; padding-left:14px;">
          <div style="font-size:11px; letter-spacing:0.25em; color:#ff0055; font-weight:900;">
            // KERNEL PANIC: FATAL NEURAL EXCEPTION (0xDEAD_C0DE)
          </div>
          <div style="font-size:18px; color:#fff; font-weight:900; letter-spacing:0.08em; text-shadow:2px 0 0 #ff0055, -2px 0 0 #00f0ff;">
            BIOMETRICS TERMINATED · FLATLINE
          </div>
          <div style="font-size:10px; color:#64748b; letter-spacing:0.15em; margin-top:2px;">
            DEVICE: ARASAKA_CYBER_CORTEX_v4.2 // BUFFER OVERFLOW DETECTED
          </div>
        </div>

        <div style="text-align:right; font-size:11px; color:#94a3b8; letter-spacing:0.12em; line-height:1.4;">
          GRID: <span style="color:#00f0ff; font-weight:bold;">PACIFICA_NET_NODE_09</span><br>
          LINK ID: <span style="color:#ff0055; font-weight:bold;">0x7F41_CORRUPTED</span><br>
          RETRY: <span style="color:#eab308;">ABORTED</span>
        </div>
      </div>

      <!-- CENTER: Monospace Hex / Binary Memory Cascade & Glitched Verdict -->
      <div id="v04-center" style="position:relative; z-index:4; display:flex; flex-direction:column; align-items:center; text-align:center;">
        <!-- Cascading Hex Stream -->
        <div id="v04-hex-stream" style="font-size:11px; color:rgba(0, 240, 255, 0.6); letter-spacing:0.2em; margin-bottom:8px; opacity:0;">
          01001111 01010110 01000101 01010010 01001000 01000101 01000001 01010100
        </div>

        <!-- Glitched Flatline Title -->
        <div id="v04-title" style="font-size:clamp(48px, 8.5vw, 88px); font-weight:900; letter-spacing:0.06em; color:#ffffff; text-transform:uppercase; text-shadow:4px 0 0 #ff0055, -4px 0 0 #00f0ff; line-height:0.95; opacity:0; transform: scale(0.9);">
          SYSTEM COLLAPSE
        </div>

        <!-- EKG Flatline Monitor SVG -->
        <div id="v04-ekg" style="margin-top:14px; width:340px; height:24px; opacity:0; display:flex; align-items:center; justify-content:center;">
          <svg width="320" height="20" viewBox="0 0 320 20" style="overflow:visible;">
            <path d="M 0 10 L 80 10 L 90 2 L 100 18 L 110 5 L 120 10 L 320 10" fill="none" stroke="#ff0055" stroke-width="2" stroke-dasharray="2 1"/>
            <circle cx="320" cy="10" r="3" fill="#ff0055"/>
          </svg>
        </div>

        <!-- Killer Vector Tag -->
        <div id="v04-killer-line" style="margin-top:10px; font-size:14px; color:#cbd5e1; letter-spacing:0.15em; opacity:0; transform: translateY(12px);">
          HOSTILE INTRUSION BY: <span style="color:#ffe600; font-weight:900; text-shadow:0 0 12px rgba(255,230,0,0.6);">${killerName}</span> 
          [<span style="color:#00f0ff;">${weaponName}</span> · ${distanceM}M]
        </div>
      </div>

      <!-- BOTTOM: Terminal Diagnostics & Neural Reroute Prompt -->
      <div id="v04-bottom" style="position:relative; z-index:4; display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(24px);">
        <!-- Cybernetic Diagnostics Monospace Box -->
        <div style="background:rgba(5, 7, 15, 0.94); border:1px solid rgba(0, 240, 255, 0.4); border-left:4px solid #00f0ff; padding:16px 24px; min-width:380px; box-shadow:0 8px 30px rgba(0,0,0,0.8);">
          <div style="font-size:11px; color:#00f0ff; letter-spacing:0.2em; font-weight:bold; margin-bottom:8px;">
            // HARDWARE SUBSYSTEM STATUS
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:11px; color:#94a3b8;">
            <div style="display:flex; justify-content:space-between;">
              <span>SYNTHETIC HEART:</span>
              <span style="color:#ff0055; font-weight:900;">0 BPM [OFFLINE]</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>OCULAR IMPLANTS:</span>
              <span style="color:#ff0055; font-weight:900;">DESYNCHRONIZED (ERR_404)</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>SUIT INTEGRITY:</span>
              <span style="color:#eab308; font-weight:bold;">0.0% CRITICAL BREACH</span>
            </div>
          </div>
        </div>

        <!-- Prompts -->
        <div style="display:flex; gap:12px; pointer-events:auto;">
          <div style="background:rgba(255, 0, 85, 0.2); border:1px solid #ff0055; color:#fff; padding:12px 22px; font-size:12px; font-weight:800; letter-spacing:0.12em; display:flex; align-items:center; gap:8px; box-shadow:0 0 20px rgba(255,0,85,0.3);">
            <span style="background:#ff0055; color:#fff; padding:2px 6px; font-size:10px;">[SPACE]</span> REINICIAR KERNEL
          </div>
          <div style="background:rgba(0, 240, 255, 0.15); border:1px solid #00f0ff; color:#00f0ff; padding:12px 20px; font-size:12px; font-weight:800; letter-spacing:0.12em; display:flex; align-items:center; gap:8px;">
            <span style="background:#00f0ff; color:#000; padding:2px 6px; font-size:10px;">[E]</span> FEED REMOTO
          </div>
        </div>
      </div>
    `;

    container.appendChild(root);

    // =========================================================================
    // 3D THREE.JS SETUP: Volumetric Chromatic Ghosts & Spasm Prep
    // =========================================================================
    scene.playerActor.setPose(0);
    scene.playerGroup.position.set(0, 0, 0);

    const ghostR = scene.glitchGhostR;
    const ghostC = scene.glitchGhostC;
    ghostR.visible = true;
    ghostC.visible = true;
    ghostR.position.set(0, 0, 0);
    ghostC.position.set(0, 0, 0);

    const rMat = (ghostR.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const cMat = (ghostC.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    rMat.opacity = 0;
    cMat.opacity = 0;

    // Reset Camera
    scene.camera.position.set(0, 1.6, 3.8);
    scene.cameraTarget.set(0, 1.2, 0);
    scene.camera.lookAt(scene.cameraTarget);
    scene.camera.rotation.z = 0;

    // =========================================================================
    // ANIME.JS V4 CINEMATIC TIMELINE DIRECTORIAL SEQUENCE
    // =========================================================================
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. DIGITAL FLATLINE IMPACT & 3D CHROMATIC WIREFRAME GLITCH (t = 60ms - 1.2s)
    // Red & Cyan 3D volumetric wireframe ghosts shatter outwards and spasm
    const ghostProxy = {
      offsetX: 0,
      opacity: 0,
    };

    tl.add(
      ghostProxy,
      {
        offsetX: [0, 0.48, -0.25, 0.35, -0.15, 0],
        opacity: [0, 0.85, 0.2, 0.7, 0.1, 0],
        duration: 900,
        ease: "steps(6)",
        onUpdate: () => {
          ghostR.position.x = ghostProxy.offsetX;
          ghostC.position.x = -ghostProxy.offsetX;
          rMat.opacity = ghostProxy.opacity;
          cMat.opacity = ghostProxy.opacity;
        },
      },
      60
    );

    // 2. CHARACTER COLLAPSE WITH NEURAL SPASM (t = 80ms - 1.5s)
    const spasmPhysics = {
      poseP: 0,
      jitterX: 0,
      pelvisY: 1.05,
    };

    tl.add(
      spasmPhysics,
      {
        poseP: 1.0,
        jitterX: [0, 0.08, -0.06, 0.05, -0.03, 0],
        pelvisY: [1.05, 0.85, 0.25],
        duration: 1400,
        ease: "outQuad",
        onUpdate: () => {
          scene.playerActor.pelvis.position.x = spasmPhysics.jitterX;
          scene.playerActor.setPose(spasmPhysics.poseP);
        },
      },
      80
    );

    // 3. LIGHTING "BROWNOUT" VIOLENT FLICKER (t = 70ms - 850ms)
    const lightBrownout = {
      dirIntensity: 1.2,
      ambIntensity: 0.4,
    };

    tl.add(
      lightBrownout,
      {
        dirIntensity: [1.2, 0.02, 1.1, 0.05, 0.35],
        ambIntensity: [0.4, 0.05, 0.35, 0.08, 0.25],
        duration: 750,
        ease: "steps(5)",
        onUpdate: () => {
          scene.dirLight.intensity = lightBrownout.dirIntensity;
          scene.ambientLight.intensity = lightBrownout.ambIntensity;
        },
      },
      70
    );

    // 4. CAMERA OPTICAL DESYNCHRONIZATION (FOV Spasm + Lens Roll) (t = 70ms - 1.6s)
    const cameraGlitch = {
      fov: 60,
      rotZ: 0,
      camY: 1.6,
      camZ: 3.8,
    };

    tl.add(
      cameraGlitch,
      {
        fov: [60, 84, 52, 65, 58],
        rotZ: [0, -0.08, 0.06, -0.03, 0],
        camY: 0.75,
        camZ: 2.3,
        duration: 1500,
        ease: "outCubic",
        onUpdate: () => {
          scene.camera.fov = cameraGlitch.fov;
          scene.camera.updateProjectionMatrix();
          scene.camera.rotation.z = cameraGlitch.rotZ;
          scene.camera.position.y = cameraGlitch.camY;
          scene.camera.position.z = cameraGlitch.camZ;
        },
      },
      70
    );

    // 5. NARRATIVE SWOOP TO HORIZON / SYSTEM REBOOT SCAN (t = 2.2s - 4.0s)
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: -2.5, y: 2.2, z: 4.5 },
        target: { x: 0, y: 1.0, z: -10 },
        fov: 55,
        duration: 1800,
        ease: "inOutQuad",
      },
      tl,
      2200
    );

    // 6. HUD / TERMINAL MONOSPACE REVEAL (t = 120ms - 900ms)
    const flashEl = root.querySelector("#v04-flash") as HTMLElement;
    const topEl = root.querySelector("#v04-top") as HTMLElement;
    const hexStream = root.querySelector("#v04-hex-stream") as HTMLElement;
    const titleEl = root.querySelector("#v04-title") as HTMLElement;
    const ekgEl = root.querySelector("#v04-ekg") as HTMLElement;
    const killerLine = root.querySelector("#v04-killer-line") as HTMLElement;
    const bottomEl = root.querySelector("#v04-bottom") as HTMLElement;

    if (flashEl) {
      tl.add(
        flashEl,
        {
          opacity: [0, 0.85, 0.1, 0.5, 0],
          duration: 350,
          ease: "steps(4)",
        },
        80
      );
    }

    if (topEl) {
      tl.add(
        topEl,
        {
          opacity: [0, 1],
          translateY: [-18, 0],
          duration: 400,
          ease: "outCubic",
        },
        180
      );
    }

    if (hexStream) {
      tl.add(
        hexStream,
        {
          opacity: [0, 1],
          duration: 300,
          ease: "linear",
        },
        220
      );
    }

    if (titleEl) {
      tl.add(
        titleEl,
        {
          opacity: [0, 1],
          scale: [0.88, 1],
          translateX: [-16, 12, -8, 4, 0],
          duration: 650,
          ease: "outQuad",
        },
        260
      );
    }

    if (ekgEl) {
      tl.add(
        ekgEl,
        {
          opacity: [0, 1],
          duration: 400,
          ease: "outQuad",
        },
        360
      );
    }

    if (killerLine) {
      tl.add(
        killerLine,
        {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 450,
          ease: "outCubic",
        },
        450
      );
    }

    if (bottomEl) {
      tl.add(
        bottomEl,
        {
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 550,
          ease: "outCubic",
        },
        550
      );
    }
  }

  public onSpectatorTransition?(peerName: string, perspective: "first_person" | "third_person"): void {
    if (!this.containerEl) return;
    const bottomEl = this.containerEl.querySelector("#v04-bottom");
    if (bottomEl) {
      bottomEl.innerHTML = `
        <div style="background:rgba(5, 7, 15, 0.95); border:1px solid #00f0ff; border-left:4px solid #00f0ff; padding:12px 24px; box-shadow:0 0 25px rgba(0,240,255,0.4); display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:14px;">
            <span style="background:#00f0ff; color:#030712; font-size:10px; font-weight:900; padding:2px 8px;">OPTICAL_FEED // ACTIVE</span>
            <span style="font-size:18px; color:#fff; font-weight:900; letter-spacing:0.1em;">RE-ROUTED TO: ${peerName}</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; font-family:monospace;">
            CAMERA: <span style="color:#00f0ff;">${perspective === "first_person" ? "CYBER_EYE (1P)" : "TACTICAL_DRONE (3P)"}</span> [TECLA V]
          </div>
        </div>
      `;
    }
  }
}

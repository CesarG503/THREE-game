import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import * as THREE from "three";

export class V01_Tactical extends AbstractDeathVariant {
  public id = "v01_tactical";
  public name = "V01 — TACTICAL / SHOOTER AAA";
  public subtitle = "Cinemática Balística · Colapso Físico, Muzzle Flash y Revelación del Tirador";
  public theme = "tactical_military";
  public inspiration = "Modern Warfare, Battlefield, Escape from Tarkov";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v01";
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      color: #f1f5f9;
      user-select: none;
    `;

    // Discreet in-universe military optical HUD (no giant glass cards)
    root.innerHTML = `
      <!-- Optical Target Box on the distant Sniper (Placed via 3D tracking illusion) -->
      <div id="v01-sniper-bracket" style="position:absolute; top:28%; left:62%; transform:translate(-50%, -50%) scale(0.8); opacity:0; display:flex; flex-direction:column; align-items:center; gap:4px;">
        <div style="border:1px solid rgba(239, 68, 68, 0.85); width:50px; height:50px; position:relative; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:6px; height:6px; background:#ef4444; border-radius:50%;"></div>
          <div style="position:absolute; top:-2px; left:-2px; width:8px; height:8px; border-top:2px solid #ef4444; border-left:2px solid #ef4444;"></div>
          <div style="position:absolute; bottom:-2px; right:-2px; width:8px; height:8px; border-bottom:2px solid #ef4444; border-right:2px solid #ef4444;"></div>
        </div>
        <div style="background:rgba(15, 23, 42, 0.9); border:1px solid #ef4444; padding:2px 8px; font-size:10px; color:#fca5a5; letter-spacing:0.15em; font-weight:bold; white-space:nowrap;">
          HOSTILE: ${scenario.killerName.toUpperCase()} [${scenario.distanceMeters}m]
        </div>
      </div>

      <!-- Top Discreet Combat Status Ribbon -->
      <div id="v01-top-bar" style="display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(-16px);">
        <div style="display:flex; align-items:center; gap:10px; font-size:11px; letter-spacing:0.18em; color:#94a3b8;">
          <span style="color:#ef4444; font-weight:900;">[● REC]</span>
          <span>SISTEMA TÁCTICO VIPER // INCIDENT REF #0942</span>
        </div>
        <div style="font-size:11px; color:#94a3b8; letter-spacing:0.1em; font-family:monospace;">
          STATUS: <span style="color:#ef4444; font-weight:bold;">K.I.A.</span> · FRECUENCIA: 0 BPM
        </div>
      </div>

      <!-- Bottom Integrated Kill Assessment Ribbon -->
      <div id="v01-bottom-ribbon" style="display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(20px);">
        <!-- Minimalist Weapon / Killer Tag -->
        <div style="border-left:2px solid #ef4444; padding-left:14px; max-width:420px;">
          <div style="font-size:10px; color:#ef4444; letter-spacing:0.25em; font-weight:800; text-transform:uppercase;">
            DISPARO LETAL // BALÍSTICA
          </div>
          <div style="font-size:24px; font-weight:900; color:#fff; letter-spacing:0.04em; margin:2px 0;">
            ${scenario.killerName}
          </div>
          <div style="font-size:12px; color:#94a3b8; font-family:monospace;">
            ${scenario.weaponName} · ${scenario.distanceMeters}m · Impacto en ${scenario.hitLocation === "head" ? "Cabeza" : "Tórax"}
          </div>
        </div>

        <!-- Prompt -->
        <div style="display:flex; gap:10px; font-size:12px; font-weight:700;">
          <div style="background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.2); padding:8px 16px; border-radius:3px; color:#fff; display:flex; align-items:center; gap:6px;">
            <span style="background:#ef4444; color:#fff; padding:1px 5px; font-size:10px; border-radius:2px;">[SPACE]</span> REAPARECER
          </div>
          <div style="background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.15); padding:8px 16px; border-radius:3px; color:#94a3b8; display:flex; align-items:center; gap:6px;">
            <span style="background:rgba(255,255,255,0.2); color:#fff; padding:1px 5px; font-size:10px; border-radius:2px;">[E]</span> ESPECTADOR
          </div>
        </div>
      </div>
    `;

    container.appendChild(root);

    // =========================================================================
    // ANIME.JS V4 CINEMATIC TIMELINE DIRECTORIAL SEQUENCE
    // =========================================================================
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // Reset initial camera positioning: start framed on standing operative
    scene.camera.position.set(0, 1.6, 3.8);
    scene.cameraTarget.set(0, 1.2, 0);
    scene.camera.lookAt(scene.cameraTarget);
    scene.playerActor.setPose(0);

    // 1. Initial State: Stand & Sudden Fatal Impact Impulse (t = 0 - 0.15s)
    const recoilProxy = { y: 1.6, z: 3.8 };
    tl.add(
      recoilProxy,
      {
        y: 1.72,
        z: 3.95,
        duration: 80,
        ease: "outQuad",
        onUpdate: () => {
          scene.camera.position.y = recoilProxy.y;
          scene.camera.position.z = recoilProxy.z;
        },
      },
      0
    );

    // 2. Physical Kinematic Character Collapse (t = 0.08 - 1.4s)
    // Seamlessly drives articulated limbs, spine, head, knees from standing to ground
    const poseProxy = { progress: 0 };
    tl.add(
      poseProxy,
      {
        progress: 1.0,
        duration: 1350,
        ease: "outCubic",
        onUpdate: () => {
          scene.playerActor.setPose(poseProxy.progress);
        },
      },
      80
    );

    // 3. Dropped Weapon Physical Ballistic Arc & Ground Skid (t = 0.2 - 1.6s)
    scene.droppedWeapon.visible = false;
    scene.droppedWeapon.position.set(0.35, 1.1, -0.2);
    scene.droppedWeapon.rotation.set(0, 0, 0);

    const weaponPhysics = {
      x: 0.35,
      y: 1.1,
      z: -0.2,
      rotX: 0,
      rotZ: 0,
    };

    tl.add(
      weaponPhysics,
      {
        x: 1.25,
        y: [
          { value: 1.35, duration: 250, ease: "outQuad" },
          { value: 0.08, duration: 400, ease: "inQuad" },
        ],
        z: 0.45,
        rotX: 3.6,
        rotZ: 1.5,
        duration: 650,
        ease: "linear",
        onBegin: () => {
          scene.droppedWeapon.visible = true;
        },
        onUpdate: () => {
          scene.droppedWeapon.position.set(weaponPhysics.x, weaponPhysics.y, weaponPhysics.z);
          scene.droppedWeapon.rotation.set(weaponPhysics.rotX, 0.4, weaponPhysics.rotZ);
        },
      },
      180
    );

    // 4. Bullet-Time Camera: Dolly down into ground-level perspective (t = 0.15 - 1.5s)
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: -0.4, y: 0.55, z: 2.1 },
        target: { x: 0, y: 0.25, z: 0 },
        fov: 54,
        duration: 1400,
        ease: "outCubic",
      },
      tl,
      150
    );

    // 5. Narrative Camera Cut/Pan: Reveals the distant sniper tower (t = 1.7 - 3.4s)
    // Camera dollies up and pans across to frame the killer in dramatic silhouette
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: -1.2, y: 1.6, z: 2.4 },
        target: { x: 8.5, y: 4.2, z: -16.5 },
        fov: 46,
        duration: 1700,
        ease: "inOutQuad",
      },
      tl,
      1700
    );

    // 6. Discreet In-Universe Telemetry Entrance (t = 1.8 - 2.5s)
    const sniperBracket = root.querySelector("#v01-sniper-bracket") as HTMLElement;
    const topBar = root.querySelector("#v01-top-bar") as HTMLElement;
    const bottomRibbon = root.querySelector("#v01-bottom-ribbon") as HTMLElement;

    if (sniperBracket) {
      tl.add(
        sniperBracket,
        {
          opacity: [0, 1],
          scale: [1.3, 1],
          duration: 400,
          ease: "outBack",
        },
        2100
      );
    }

    if (topBar) {
      tl.add(
        topBar,
        {
          opacity: [0, 1],
          translateY: [-16, 0],
          duration: 400,
          ease: "outCubic",
        },
        1200
      );
    }

    if (bottomRibbon) {
      tl.add(
        bottomRibbon,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 600,
          ease: "outCubic",
        },
        1400
      );
    }
  }
}

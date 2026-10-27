import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import * as THREE from "three";

export class V16_ViperSignature extends AbstractDeathVariant {
  public id = "v16_viper_signature";
  public name = "V16 — VIPER.IO SIGNATURE EXPERIENCE";
  public subtitle = "Identidad Insignia Original · Bullet-Time Freeze, Anillo de Contención 3D, Desconexión de Traje y Órbita 360°";
  public theme = "viper_signature";
  public inspiration = "VIPER.IO Original Flagship Aesthetic, Formula 1 Telemetry, In-Universe Helmet OS";

  private suspendedBolt: THREE.Group | null = null;

  public override cleanup(): void {
    if (this.suspendedBolt && this.sceneRef) {
      this.sceneRef.scene.remove(this.suspendedBolt);
      this.suspendedBolt.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      this.suspendedBolt = null;
    }

    if (this.sceneRef) {
      // Reset suit materials to vibrant VIPER emerald & cyan
      this.sceneRef.playerActor.materials.armor.color.setHex(0x10b981);
      this.sceneRef.playerActor.materials.visor.color.setHex(0x00f0ff);
      (this.sceneRef.shockwaveMesh.material as THREE.Material).opacity = 0;
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
    root.id = "variant-root-v16";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 36px 52px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      user-select: none;
      overflow: hidden;
    `;

    const killerName = (scenario.killerName || "ViperPrime").toUpperCase();
    const weaponName = (scenario.weaponName || scenario.weapon || "Plasma Venom Sniper").toUpperCase();
    const distanceM = scenario.distanceMeters || scenario.distance || 38;
    const bodyPart = (scenario.hitLocation || scenario.bodyPart || "Tórax Superior").toUpperCase();

    root.innerHTML = `
      <!-- CURVED HELMET VISOR OS RETICLE CORNERS -->
      <div id="v16-visor-frame" style="position:absolute; inset:20px; border:1px solid rgba(16, 185, 129, 0.25); border-radius:32px; pointer-events:none; box-shadow:inset 0 0 40px rgba(16, 185, 129, 0.12); opacity:0; transform:scale(0.98);">
        <!-- Top Left Corner Bracket -->
        <div style="position:absolute; top:-2px; left:-2px; width:24px; height:24px; border-top:3px solid #10b981; border-left:3px solid #10b981; border-top-left-radius:8px;"></div>
        <!-- Top Right Corner Bracket -->
        <div style="position:absolute; top:-2px; right:-2px; width:24px; height:24px; border-top:3px solid #10b981; border-right:3px solid #10b981; border-top-right-radius:8px;"></div>
        <!-- Bottom Left Corner Bracket -->
        <div style="position:absolute; bottom:-2px; left:-2px; width:24px; height:24px; border-bottom:3px solid #10b981; border-left:3px solid #10b981; border-bottom-left-radius:8px;"></div>
        <!-- Bottom Right Corner Bracket -->
        <div style="position:absolute; bottom:-2px; right:-2px; width:24px; height:24px; border-bottom:3px solid #10b981; border-right:3px solid #10b981; border-bottom-right-radius:8px;"></div>
      </div>

      <!-- TOP: Tactical Helmet Telemetry & Integrity Readout -->
      <div id="v16-top" style="position:relative; z-index:3; display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(-20px);">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div id="v16-pulse-dot" style="width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 12px #10b981;"></div>
            <span style="font-weight:900; letter-spacing:0.25em; font-size:15px; color:#fff;">VIPER.OS</span>
          </div>
          <span style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.4); color:#6ee7b7; font-size:11px; font-weight:800; letter-spacing:0.18em; padding:3px 12px; border-radius:14px;">
            TACTICAL PROTOCOL // BULLET-TIME
          </span>
        </div>

        <div style="font-size:11px; color:#94a3b8; font-family:monospace; display:flex; gap:20px;">
          <span>ARMOR POWER: <strong id="v16-power-val" style="color:#10b981;">100%</strong></span>
          <span>HELMET HUD: <strong id="v16-hud-status" style="color:#ef4444;">COMPROMISED</strong></span>
          <span>NEURAL: <strong style="color:#64748b;">OFFLINE</strong></span>
        </div>
      </div>

      <!-- CENTER: VIPER Flagship Hologram & Defeat Verdict -->
      <div id="v16-center" style="position:relative; z-index:3; display:flex; flex-direction:column; align-items:center; text-align:center;">
        <!-- VIPER Hex Emblem -->
        <div id="v16-emblem" style="width:68px; height:68px; border-radius:50%; background:radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 75%); border:2px solid #10b981; display:flex; align-items:center; justify-content:center; box-shadow:0 0 30px rgba(16,185,129,0.5); margin-bottom:12px; opacity:0; transform: scale(0.6) rotateY(90deg);">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>

        <div id="v16-sub" style="font-size:12px; letter-spacing:0.4em; color:#10b981; font-weight:900; text-transform:uppercase; margin-bottom:6px; opacity:0; transform: translateY(12px);">
          ENLACE TÁCTICO INTERRUMPIDO
        </div>
        <h1 id="v16-title" style="margin:0; font-size:clamp(46px, 8vw, 82px); font-weight:900; letter-spacing:0.05em; text-transform:uppercase; color:#fff; text-shadow:0 0 35px rgba(16, 185, 129, 0.6); opacity:0; transform: scale(0.92);">
          AGENTE NEUTRALIZADO
        </h1>
        <div id="v16-killer-line" style="font-size:14px; color:#cbd5e1; margin-top:8px; opacity:0; transform: translateY(12px);">
          Eliminado por <strong style="color:#6ee7b7; font-weight:800;">${killerName}</strong> con <span style="color:#94a3b8; font-family:monospace;">${weaponName} [${distanceM}m]</span>
        </div>
      </div>

      <!-- BOTTOM: Tactical Telemetry & Fluid Respawn Controls -->
      <div id="v16-bottom" style="position:relative; z-index:3; display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(24px);">
        <!-- Combat Metrics Card -->
        <div id="v16-metrics" style="background:rgba(9, 13, 22, 0.94); border:1px solid rgba(16, 185, 129, 0.4); border-left:4px solid #10b981; border-radius:12px; padding:16px 26px; box-shadow:0 15px 40px rgba(0,0,0,0.8); display:flex; gap:26px;">
          <div>
            <div style="font-size:10px; color:#94a3b8; letter-spacing:0.15em;">DAÑO RECIBIDO</div>
            <div style="font-size:20px; font-weight:900; color:#ef4444; font-family:monospace;">${scenario.damageDealt || 150} HP</div>
          </div>
          <div>
            <div style="font-size:10px; color:#94a3b8; letter-spacing:0.15em;">LOCALIZACIÓN IMPACTO</div>
            <div style="font-size:14px; font-weight:800; color:#fff;">${bodyPart}</div>
          </div>
          <div>
            <div style="font-size:10px; color:#94a3b8; letter-spacing:0.15em;">CONTENCIÓN VENOM</div>
            <div style="font-size:20px; font-weight:900; color:#10b981; font-family:monospace;">ACTIVA (3D)</div>
          </div>
        </div>

        <!-- Action Controls -->
        <div style="display:flex; gap:12px; pointer-events:auto;">
          <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#000; font-size:13px; font-weight:900; letter-spacing:0.08em; padding:12px 24px; border-radius:8px; box-shadow:0 0 25px rgba(16,185,129,0.5); display:flex; align-items:center; gap:8px;">
            <span style="background:rgba(0,0,0,0.25); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">[SPACE]</span> REAPARECER (05s)
          </div>
          <div style="background:rgba(9, 13, 22, 0.9); border:1px solid rgba(255,255,255,0.2); color:#e2e8f0; font-size:13px; font-weight:700; letter-spacing:0.05em; padding:12px 20px; border-radius:8px; display:flex; align-items:center; gap:8px;">
            <span style="background:rgba(255,255,255,0.15); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">[E]</span> RECONOCIMIENTO
          </div>
        </div>
      </div>
    `;

    container.appendChild(root);

    // =========================================================================
    // 3D THREE.JS SETUP: Suspended Bolt & Floor Containment Ring
    // =========================================================================
    // Create suspended high-velocity energy bolt frozen in space at impact point
    const boltGroup = new THREE.Group();
    const boltCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    boltCore.rotation.x = Math.PI / 2;
    boltGroup.add(boltCore);

    const boltGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.1, 12),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 })
    );
    boltGlow.rotation.x = Math.PI / 2;
    boltGroup.add(boltGlow);

    boltGroup.position.set(0.15, 1.45, 0.7);
    boltGroup.rotation.y = 0.35;
    scene.scene.add(boltGroup);
    this.suspendedBolt = boltGroup;

    // Reset player pose into frozen dramatic impact flinch (pose = 0.28)
    scene.playerActor.setPose(0.28);
    scene.playerGroup.position.set(0, 0, 0);

    // Floor Containment Ring
    scene.shockwaveMesh.scale.set(1.0, 1.0, 1);
    const shockMat = scene.shockwaveMesh.material as THREE.MeshBasicMaterial;
    shockMat.color.setHex(0x10b981);
    shockMat.opacity = 0;

    // Initial Camera setup
    scene.camera.position.set(0, 1.5, 3.2);
    scene.cameraTarget.set(0, 1.35, 0);
    scene.camera.lookAt(scene.cameraTarget);

    // =========================================================================
    // ANIME.JS V4 CINEMATIC TIMELINE DIRECTORIAL SEQUENCE
    // =========================================================================
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. BULLET-TIME ORBITAL 360° SWEEP (t = 0 - 3.2s)
    // Smooth cinematic orbit around the frozen operative in dramatic bullet-time
    const orbitProxy = {
      angle: 0,
      radius: 3.2,
      camY: 1.5,
      targetY: 1.35,
    };

    tl.add(
      orbitProxy,
      {
        angle: Math.PI * 1.6, // Sweeps 288 degrees around operative
        radius: [3.2, 2.7, 3.6],
        camY: [1.5, 1.35, 2.1],
        duration: 3200,
        ease: "linear",
        onUpdate: () => {
          scene.camera.position.x = Math.sin(orbitProxy.angle) * orbitProxy.radius;
          scene.camera.position.z = Math.cos(orbitProxy.angle) * orbitProxy.radius;
          scene.camera.position.y = orbitProxy.camY;
          scene.cameraTarget.set(0, orbitProxy.targetY, 0);
          scene.camera.lookAt(scene.cameraTarget);
        },
      },
      0
    );

    // 2. SUIT POWER DRAIN (Emerald armor & cyan visor power down to dark carbon) (t = 400ms - 2.4s)
    const powerProxy = {
      power: 100,
      armorR: 0.063, // 0x10b981
      armorG: 0.725,
      armorB: 0.506,
      visorR: 0.0,   // 0x00f0ff
      visorG: 0.941,
      visorB: 1.0,
    };

    const powerValEl = root.querySelector("#v16-power-val") as HTMLElement;

    tl.add(
      powerProxy,
      {
        power: 0,
        armorR: 0.08, // Drains down to dark charcoal
        armorG: 0.12,
        armorB: 0.18,
        visorR: 0.07,
        visorG: 0.09,
        visorB: 0.13,
        duration: 2000,
        ease: "outQuad",
        onUpdate: () => {
          scene.playerActor.materials.armor.color.setRGB(powerProxy.armorR, powerProxy.armorG, powerProxy.armorB);
          scene.playerActor.materials.visor.color.setRGB(powerProxy.visorR, powerProxy.visorG, powerProxy.visorB);
          if (powerValEl) {
            powerValEl.textContent = `${Math.round(powerProxy.power)}%`;
            if (powerProxy.power < 20) powerValEl.style.color = "#ef4444";
          }
        },
      },
      400
    );

    // 3. 3D FLOOR VENOM CONTAINMENT RING PULSE & EXPANSION (t = 200ms - 2.8s)
    const ringProxy = {
      scale: 1.0,
      opacity: 0,
    };

    tl.add(
      ringProxy,
      {
        scale: [1.0, 7.5],
        opacity: [0, 0.9, 0.4, 0.85, 0.2],
        duration: 2600,
        ease: "outCubic",
        onUpdate: () => {
          scene.shockwaveMesh.scale.set(ringProxy.scale, ringProxy.scale, 1);
          shockMat.opacity = ringProxy.opacity;
        },
      },
      200
    );

    // 4. NARRATIVE ASCENT TOWARDS TRAJECTORY & HORIZON (t = 3.2s - 4.8s)
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 3.5, y: 3.8, z: -8.0 },
        target: { x: 9.0, y: 4.5, z: -17.0 },
        fov: 50,
        duration: 1600,
        ease: "inOutQuad",
      },
      tl,
      3200
    );

    // 5. HELMET OS HUD & TELEMETRY ENTRANCE (t = 200ms - 900ms)
    const visorFrame = root.querySelector("#v16-visor-frame") as HTMLElement;
    const topEl = root.querySelector("#v16-top") as HTMLElement;
    const emblemEl = root.querySelector("#v16-emblem") as HTMLElement;
    const subEl = root.querySelector("#v16-sub") as HTMLElement;
    const titleEl = root.querySelector("#v16-title") as HTMLElement;
    const killerLine = root.querySelector("#v16-killer-line") as HTMLElement;
    const bottomEl = root.querySelector("#v16-bottom") as HTMLElement;

    if (visorFrame) {
      tl.add(
        visorFrame,
        {
          opacity: [0, 1],
          scale: [0.98, 1],
          duration: 600,
          ease: "outCubic",
        },
        100
      );
    }

    if (emblemEl) {
      tl.add(
        emblemEl,
        {
          opacity: [0, 1],
          rotateY: [90, 0],
          scale: [0.6, 1],
          duration: 750,
          ease: "outBack",
        },
        200
      );
    }

    if (topEl) {
      tl.add(
        topEl,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 450,
          ease: "outCubic",
        },
        250
      );
    }

    if (subEl) {
      tl.add(
        subEl,
        {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 400,
          ease: "outCubic",
        },
        350
      );
    }

    if (titleEl) {
      tl.add(
        titleEl,
        {
          opacity: [0, 1],
          scale: [0.92, 1],
          duration: 700,
          ease: "outBack",
        },
        400
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
        500
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
        600
      );
    }
  }

  public onSpectatorTransition?(peerName: string, perspective: "first_person" | "third_person"): void {
    if (!this.containerEl) return;
    const bottomEl = this.containerEl.querySelector("#v16-bottom");
    if (bottomEl) {
      bottomEl.innerHTML = `
        <div style="background:rgba(9, 13, 22, 0.95); border:1px solid #10b981; border-left:4px solid #10b981; border-radius:12px; padding:14px 26px; box-shadow:0 0 30px rgba(16,185,129,0.4); display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:14px;">
            <span style="background:#10b981; color:#030712; font-size:10px; font-weight:900; padding:2px 8px; border-radius:4px;">RECON LINK // ACTIVE</span>
            <span style="font-size:18px; color:#fff; font-weight:900; letter-spacing:0.08em;">ENLACE CON: ${peerName}</span>
          </div>
          <div style="font-size:12px; color:#94a3b8; font-family:monospace;">
            MODO: <span style="color:#6ee7b7; font-weight:bold;">${perspective === "first_person" ? "VISOR DIRECTO (1P)" : "ÓRBITA TÁCTICA (3P)"}</span> [TECLA V]
          </div>
        </div>
      `;
    }
  }
}

import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V10_AnimeMecha extends AbstractDeathVariant {
  public id = "v10_anime_mecha";
  public name = "V10 — ANIME MECHA TERMINATION";
  public subtitle = "Sci-Fi Japonés · Cockpit Hexagonal, Alarmas Sincronizadas y Eyección";
  public theme = "anime_mecha_cockpit";
  public inspiration = "Evangelion, Armored Core VI, Gundam, Xenoblade";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v10";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 36px 48px;
      box-sizing: border-box;
      font-family: 'Share Tech Mono', monospace, sans-serif;
      color: #f59e0b;
      user-select: none;
      background: radial-gradient(circle at center, rgba(245, 158, 11, 0.08) 0%, rgba(10, 5, 20, 0.94) 100%);
    `;

    root.innerHTML = `
      <!-- Cockpit Warning Banner -->
      <div id="v10-alarm-banner" style="background:rgba(239, 68, 68, 0.25); border:2px solid #ef4444; border-radius:4px; padding:8px 24px; display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(-20px);">
        <div style="color:#ef4444; font-weight:900; letter-spacing:0.2em; font-size:14px;">
          ⚠ EMERGENCY // PILOT VITALS TERMINATED ⚠
        </div>
        <div style="color:#f59e0b; font-size:12px; letter-spacing:0.1em;">
          FRAME INTEGRITY: <span style="color:#ef4444; font-weight:bold;">0%</span>
        </div>
      </div>

      <!-- Center Japanese Mecha Climax -->
      <div id="v10-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; opacity:0; transform: scale(0.9);">
        <div style="font-size:13px; color:#ef4444; letter-spacing:0.35em; font-weight:800; text-transform:uppercase;">
          機体喪失 // MECHA LOSS CONFIRMED
        </div>
        <div id="v10-title" style="font-size:clamp(44px, 8vw, 84px); font-weight:900; color:#fff; text-shadow:0 0 30px #f59e0b, 0 0 60px #ef4444; letter-spacing:0.08em;">
          CORE SHUTDOWN
        </div>
        <div style="font-size:14px; color:#fcd34d; letter-spacing:0.15em;">
          INTERCEPTADO POR UNIDAD <span style="color:#fff; font-weight:bold;">${scenario.killerName}</span>
        </div>

        <!-- Cockpit Hexagonal Diagnostics Grid -->
        <div id="v10-hex-grid" style="display:flex; gap:12px; margin-top:20px;">
          <div class="v10-tile" style="background:rgba(20, 15, 30, 0.85); border:1px solid #ef4444; padding:8px 16px; border-radius:4px; font-size:11px;">
            <div style="color:#94a3b8;">PROPULSIÓN</div>
            <div style="color:#ef4444; font-weight:bold;">OFFLINE</div>
          </div>
          <div class="v10-tile" style="background:rgba(20, 15, 30, 0.85); border:1px solid #ef4444; padding:8px 16px; border-radius:4px; font-size:11px;">
            <div style="color:#94a3b8;">ESCUDO CINÉTICO</div>
            <div style="color:#ef4444; font-weight:bold;">BREACHED</div>
          </div>
          <div class="v10-tile" style="background:rgba(20, 15, 30, 0.85); border:1px solid #ef4444; padding:8px 16px; border-radius:4px; font-size:11px;">
            <div style="color:#94a3b8;">CÁPSULA ESCAPE</div>
            <div style="color:#ef4444; font-weight:bold;">LOCKED</div>
          </div>
        </div>
      </div>

      <!-- Bottom Ejection Emergency -->
      <div id="v10-bottom" style="display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(20px);">
        <div style="font-size:11px; color:#64748b;">
          SERIAL: MK-VII-VIPER // SYNC RATIO: 0.00%
        </div>
        <div style="background:#ef4444; color:#fff; font-size:13px; font-weight:800; letter-spacing:0.1em; padding:12px 24px; border-radius:4px; box-shadow:0 0 20px rgba(239, 68, 68, 0.6);">
          [SPACE] FORZAR REINICIO DE NÚCLEO
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. 3D Camera mechanical shake & push
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 1.6, z: 3.4 },
        fov: 60,
        duration: 1400,
        ease: "outExpo",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.accentLight, 5.0, 0xef4444, tl, 0, 600);

    // 2. Multi-timeline staggered elements
    const alarm = root.querySelector("#v10-alarm-banner") as HTMLElement;
    const center = root.querySelector("#v10-center") as HTMLElement;
    const tiles = root.querySelectorAll(".v10-tile");
    const bottom = root.querySelector("#v10-bottom") as HTMLElement;

    if (alarm) {
      tl.add(
        alarm,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 400,
          ease: "outCubic",
        },
        100
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [0.9, 1],
          duration: 600,
          ease: "outBack",
        },
        250
      );
    }

    if (tiles.length > 0) {
      tl.add(
        tiles,
        {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 400,
          ease: "outCubic",
          delay: stagger(60),
        },
        450
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 500,
          ease: "outCubic",
        },
        600
      );
    }
  }
}

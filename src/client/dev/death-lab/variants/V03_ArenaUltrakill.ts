import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V03_ArenaUltrakill extends AbstractDeathVariant {
  public id = "v03_arena_ultrakill";
  public name = "V03 — ARENA FPS // ULTRAKILL";
  public subtitle = "Retro Fast-Paced Brutal · Rango D, Sangre Neón y Reinicio Instantáneo";
  public theme = "arena_ultrakill";
  public inspiration = "ULTRAKILL, Quake Champions, DOOM Eternal";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v03";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 60px;
      box-sizing: border-box;
      font-family: Impact, "Arial Black", sans-serif;
      user-select: none;
      background: radial-gradient(circle at center, rgba(239, 68, 68, 0.25) 0%, rgba(0, 0, 0, 0.85) 100%);
    `;

    root.innerHTML = `
      <!-- Top Killfeed Streak -->
      <div id="v03-top" style="display:flex; justify-content:space-between; align-items:flex-start; opacity:0; transform: translateY(-30px);">
        <div style="background:#000; border:2px solid #ef4444; padding:6px 16px; color:#ef4444; font-size:14px; letter-spacing:0.2em;">
          // ARENA TERMINATION //
        </div>
        <div style="color:#fbbf24; font-size:16px; letter-spacing:0.1em;">
          STREAK TERMINATED: <span style="color:#fff;">${scenario.streakEnded} KILLS</span>
        </div>
      </div>

      <!-- Center Heavy Slam Title -->
      <div id="v03-center" style="display:flex; flex-direction:column; align-items:center; opacity:0; transform: scale(2.5);">
        <div id="v03-slam-title" style="font-size:clamp(60px, 12vw, 120px); font-weight:900; color:#fff; text-shadow:0 0 40px #ef4444, 6px 6px 0px #7f1d1d; letter-spacing:0.04em;">
          HAST SIDO DESTRUIDO
        </div>
        <div style="font-size:18px; color:#f87171; letter-spacing:0.3em; text-transform:uppercase;">
          ELIMINADO POR <span style="color:#fff; background:#ef4444; padding:2px 8px;">${scenario.killerName}</span> CON ${scenario.weapon}
        </div>
      </div>

      <!-- Rank Grade Stamp & Instant Restart -->
      <div id="v03-bottom" style="display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(30px);">
        <!-- Rank Grade Stamp -->
        <div id="v03-rank-stamp" style="background:#000; border:4px solid #ef4444; border-radius:12px; padding:16px 28px; display:flex; align-items:center; gap:20px; box-shadow:0 0 30px rgba(239,68,68,0.5); transform: rotate(-45deg) scale(0);">
          <div style="font-size:72px; font-weight:900; color:#ef4444; line-height:1;">
            D
          </div>
          <div>
            <div style="font-size:12px; color:#94a3b8; letter-spacing:0.15em;">RATING DE COMBATE</div>
            <div style="font-size:18px; color:#fca5a5;">DESTRUCTIBLE</div>
            <div style="font-size:11px; color:#64748b; font-family:monospace;">PRECISIÓN: 18% · TIEMPO: 01:22</div>
          </div>
        </div>

        <!-- Instant Restart Banner -->
        <div style="background:#ef4444; color:#fff; font-size:18px; font-weight:900; letter-spacing:0.1em; padding:16px 36px; border-radius:4px; box-shadow:0 0 25px rgba(239,68,68,0.7); display:flex; align-items:center; gap:12px;">
          <span>[ESPACIO]</span> REINICIO INSTANTÁNEO (0.5s)
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Violent recoil camera kick and light strobe
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 1.8, z: 3.2 },
        fov: 58,
        duration: 900,
        ease: "outExpo",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.dirLight, 4.0, 0xff0044, tl, 0, 300);

    // 2. HUD Elements Violent Slam
    const topFeed = root.querySelector("#v03-top") as HTMLElement;
    const center = root.querySelector("#v03-center") as HTMLElement;
    const bottom = root.querySelector("#v03-bottom") as HTMLElement;
    const rankStamp = root.querySelector("#v03-rank-stamp") as HTMLElement;

    if (topFeed) {
      tl.add(
        topFeed,
        {
          opacity: [0, 1],
          translateY: [-30, 0],
          duration: 300,
          ease: "outCubic",
        },
        50
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [2.5, 1],
          duration: 450,
          ease: "outBack",
        },
        100
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 400,
          ease: "outCubic",
        },
        250
      );
    }

    if (rankStamp) {
      tl.add(
        rankStamp,
        {
          scale: [0, 1],
          rotate: [-45, -6],
          duration: 500,
          ease: "outBack",
        },
        350
      );
    }
  }
}

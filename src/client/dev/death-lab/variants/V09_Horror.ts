import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V09_Horror extends AbstractDeathVariant {
  public id = "v09_horror";
  public name = "V09 — PSYCHOLOGICAL HORROR";
  public subtitle = "Terror Psicológico · Pulso de Latido, Aberración y Parálisis";
  public theme = "horror_psychological";
  public inspiration = "Silent Hill 2, P.T., Outlast, Resident Evil 7";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v09";
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
      padding: 40px;
      box-sizing: border-box;
      font-family: 'Courier New', monospace;
      color: #991b1b;
      user-select: none;
      background: radial-gradient(circle at center, rgba(127, 29, 29, 0.2) 0%, rgba(0, 0, 0, 0.96) 100%);
    `;

    root.innerHTML = `
      <!-- Vignette Pulse Overlay -->
      <div id="v09-vignette" style="position:absolute; inset:0; box-shadow:inset 0 0 120px rgba(185,28,28,0.7); pointer-events:none; opacity:0;"></div>

      <!-- Top Erratic Whisper -->
      <div id="v09-top" style="opacity:0; letter-spacing:0.3em; font-size:12px; color:#ef4444;">
        ...NO DEBISTE VENIR AQUÍ...
      </div>

      <!-- Center Flatline Dread -->
      <div id="v09-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; opacity:0; transform: scale(0.95);">
        <div id="v09-title" style="font-size:clamp(44px, 8vw, 84px); font-weight:900; color:#ef4444; letter-spacing:0.15em; text-shadow:0 0 25px rgba(239,68,68,0.9); margin-bottom:8px;">
          TE HAN ATRAPADO
        </div>
        <div id="v09-heartbeat" style="font-size:14px; color:#cbd5e1; letter-spacing:0.2em;">
          EL LATIDO SE DETIENE · CAÍDO ANTE <span style="color:#ef4444; font-weight:bold;">${scenario.killerName.toUpperCase()}</span>
        </div>
      </div>

      <!-- Bottom Paralyzed Prompt -->
      <div id="v09-bottom" style="opacity:0; font-size:12px; color:#64748b; letter-spacing:0.2em; text-transform:uppercase;">
        RESPIRAR DE NUEVO [ESPACIO]
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Erratic camera twitching & dim light
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0.2, y: 1.1, z: 2.8 },
        fov: 55,
        duration: 1800,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.dirLight, 0.2, 0x550000, tl, 0, 1000);

    // 2. Heartbeat vignette breathing pulse
    const vignette = root.querySelector("#v09-vignette") as HTMLElement;
    const center = root.querySelector("#v09-center") as HTMLElement;
    const top = root.querySelector("#v09-top") as HTMLElement;
    const bottom = root.querySelector("#v09-bottom") as HTMLElement;

    if (vignette) {
      tl.add(
        vignette,
        {
          opacity: [0, 0.9, 0.3, 0.8],
          duration: 1800,
          ease: "inOutQuad",
        },
        100
      );
    }

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 0.8],
          duration: 900,
          ease: "linear",
        },
        300
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [0.95, 1],
          duration: 1200,
          ease: "outQuad",
        },
        500
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          duration: 800,
          ease: "outQuad",
        },
        1200
      );
    }
  }
}

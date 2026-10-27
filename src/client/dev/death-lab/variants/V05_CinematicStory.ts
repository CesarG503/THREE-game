import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V05_CinematicStory extends AbstractDeathVariant {
  public id = "v05_cinematic";
  public name = "V05 — CINEMATIC STORY MODE";
  public subtitle = "Juego Narrativo de Alto Presupuesto · Letterbox 2.35:1 & Tipografía Poética";
  public theme = "cinematic_narrative";
  public inspiration = "The Last of Us, Red Dead Redemption 2, Death Stranding";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v05";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      font-family: 'Georgia', 'Cambria', serif;
      user-select: none;
    `;

    root.innerHTML = `
      <!-- Top Letterbox Bar -->
      <div id="v05-top-bar" style="height:0; width:100%; background:#000; z-index:10;"></div>

      <!-- Center Somber Poetic Reflection -->
      <div id="v05-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 40px; opacity:0; transform: translateY(20px);">
        <div id="v05-title" style="font-size:clamp(36px, 6vw, 64px); font-weight:400; font-style:italic; color:#e2e8f0; letter-spacing:0.08em; text-shadow:0 4px 20px rgba(0,0,0,0.9); margin-bottom:12px;">
          Tu historia termina aquí
        </div>
        <div id="v05-quote" style="max-width:580px; font-size:16px; line-height:1.8; color:#94a3b8; font-weight:300; opacity:0;">
          "Incluso en las noches más oscuras, los ecos de aquellos que cayeron en la arena susurran entre las ruinas del sector..."
        </div>
        <div style="margin-top:24px; font-size:12px; letter-spacing:0.25em; text-transform:uppercase; color:#64748b; font-family:sans-serif;">
          ÚLTIMO ADVERSARIO: <span style="color:#f87171;">${scenario.killerName}</span>
        </div>
      </div>

      <!-- Bottom Letterbox Bar & Cinematic Action -->
      <div id="v05-bottom-bar" style="height:0; width:100%; background:#000; z-index:10; display:flex; align-items:center; justify-content:center;">
        <div id="v05-action" style="color:#e2e8f0; font-size:13px; font-family:sans-serif; letter-spacing:0.15em; text-transform:uppercase; opacity:0;">
          PRESIONA <span style="border-bottom:1px solid #fff; padding-bottom:2px; font-weight:bold;">[ESPACIO]</span> PARA REINICIAR EL EPISODIO
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Slow 3D Dolly Pan around fallen hero
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 1.2, y: 1.4, z: 3.4 },
        fov: 48,
        duration: 3200,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    // 2. Anamorphic letterbox bars expand
    const topBar = root.querySelector("#v05-top-bar") as HTMLElement;
    const bottomBar = root.querySelector("#v05-bottom-bar") as HTMLElement;
    const center = root.querySelector("#v05-center") as HTMLElement;
    const quote = root.querySelector("#v05-quote") as HTMLElement;
    const action = root.querySelector("#v05-action") as HTMLElement;

    if (topBar && bottomBar) {
      tl.add(
        [topBar, bottomBar],
        {
          height: "12vh",
          duration: 1000,
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
          translateY: [20, 0],
          duration: 1200,
          ease: "outCubic",
        },
        500
      );
    }

    if (quote) {
      tl.add(
        quote,
        {
          opacity: [0, 1],
          duration: 1400,
          ease: "linear",
        },
        1000
      );
    }

    if (action) {
      tl.add(
        action,
        {
          opacity: [0, 1],
          duration: 800,
          ease: "outQuad",
        },
        1400
      );
    }
  }
}

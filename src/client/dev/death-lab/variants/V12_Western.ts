import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V12_Western extends AbstractDeathVariant {
  public id = "v12_western";
  public name = "V12 — WESTERN DESPERADO";
  public subtitle = "Duelo al Sol · Polvo, Silbido Spaghetti Western y Deshonor";
  public theme = "western_desperado";
  public inspiration = "Red Dead Redemption, Desperados, Sergio Leone";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v12";
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
      font-family: 'Rye', 'Georgia', serif;
      user-select: none;
      background: radial-gradient(circle at center, rgba(180, 83, 9, 0.25) 0%, rgba(15, 5, 2, 0.94) 100%);
    `;

    root.innerHTML = `
      <!-- Top Letterbox Bar -->
      <div id="v12-top-bar" style="height:0; width:100%; background:#000; z-index:10;"></div>

      <!-- Center Frontier Duel Outcome -->
      <div id="v12-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 40px; opacity:0; transform: scale(0.9);">
        <div style="font-size:14px; color:#d97706; letter-spacing:0.3em; text-transform:uppercase;">
          EL REVÓLVER MÁS RÁPIDO DEL CONDADO
        </div>
        <div id="v12-title" style="font-size:clamp(44px, 8vw, 92px); font-weight:900; color:#fef3c7; letter-spacing:0.1em; text-shadow:4px 4px 0 #451a03, 0 0 30px rgba(217,119,6,0.6); margin:8px 0;">
          DESENVAINE FATAL
        </div>
        <div style="font-size:16px; color:#fde68a;">
          ABATIDO EN EL DUELO POR <span style="color:#ef4444; font-weight:bold;">${scenario.killerName.toUpperCase()}</span>
        </div>
      </div>

      <!-- Bottom Letterbox Bar & Saloon Prompt -->
      <div id="v12-bottom-bar" style="height:0; width:100%; background:#000; z-index:10; display:flex; align-items:center; justify-content:center;">
        <div id="v12-action" style="color:#d97706; font-size:14px; letter-spacing:0.2em; text-transform:uppercase; opacity:0;">
          [ESPACIO] OTRO TRAGO Y VOLVER A LA ARENA
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Slow 3D push-in on the dusty arena
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 1.1, z: 2.9 },
        fov: 50,
        duration: 2600,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.dirLight, 1.8, 0xd97706, tl, 0, 1400);

    // 2. Letterbox wipe & duel typography
    const topBar = root.querySelector("#v12-top-bar") as HTMLElement;
    const bottomBar = root.querySelector("#v12-bottom-bar") as HTMLElement;
    const center = root.querySelector("#v12-center") as HTMLElement;
    const action = root.querySelector("#v12-action") as HTMLElement;

    if (topBar && bottomBar) {
      tl.add(
        [topBar, bottomBar],
        {
          height: "14vh",
          duration: 900,
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
          duration: 1000,
          ease: "outCubic",
        },
        500
      );
    }

    if (action) {
      tl.add(
        action,
        {
          opacity: [0, 1],
          duration: 600,
          ease: "outQuad",
        },
        1200
      );
    }
  }
}

import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V15_RealityCorruption extends AbstractDeathVariant {
  public id = "v15_reality_corruption";
  public name = "V15 — REALITY CORRUPTION / GLITCH";
  public subtitle = "Horror Digital Anómalo · Fallo de Render, Buffer Overflow y Ruptura";
  public theme = "reality_corruption";
  public inspiration = "Control, Doki Doki, Inscryption, The Matrix";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v15";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px;
      box-sizing: border-box;
      font-family: 'Courier New', monospace;
      color: #a855f7;
      user-select: none;
      background: radial-gradient(circle at center, rgba(168, 85, 247, 0.15) 0%, rgba(5, 0, 10, 0.95) 100%);
    `;

    root.innerHTML = `
      <!-- Top Corrupt Hex Stream -->
      <div id="v15-top" style="opacity:0; font-size:12px; color:#c084fc; letter-spacing:0.2em;">
        SEGFAULT AT 0xDEADBEEF // NULL_POINTER_EXCEPTION: REALITY_BUFFER_EMPTY
      </div>

      <!-- Center Reality Tear -->
      <div id="v15-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; opacity:0; transform: scale(1.1);">
        <div style="font-size:14px; letter-spacing:0.4em; color:#ef4444; font-weight:bold;">
          [MEMORIA DE SIMULACIÓN CORRUPTA]
        </div>
        <div id="v15-title" style="font-size:clamp(40px, 8vw, 88px); font-weight:900; color:#fff; text-shadow:4px 0 #a855f7, -4px 0 #ef4444; letter-spacing:0.1em; margin:12px 0;">
          FATAL ANOMALY
        </div>
        <div id="v15-glitch-text" style="font-size:16px; color:#e9d5ff; letter-spacing:0.15em;">
          ENTIDAD ELIMINADORA: ${scenario.killerName} [PARÁMETRO DESCONOCIDO]
        </div>
      </div>

      <!-- Bottom Glitch Prompt -->
      <div id="v15-bottom" style="opacity:0; transform: translateY(20px); text-align:center;">
        <div style="background:rgba(168, 85, 247, 0.2); border:1px solid #a855f7; color:#fff; display:inline-block; padding:12px 28px; font-size:14px; letter-spacing:0.15em;">
          [ESPACIO] FORZAR RECONSTRUCCIÓN DE MATRIZ
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Impossible 3D Glitch Camera Jumps
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 1.5, y: 2.2, z: 2.5 },
        fov: 85,
        duration: 800,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    // Sudden glitch camera snap back
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: -0.4, y: 1.4, z: 3.8 },
        fov: 60,
        duration: 900,
        ease: "outExpo",
      },
      tl,
      800
    );

    // 2. HUD Glitch Displacement
    const top = root.querySelector("#v15-top") as HTMLElement;
    const center = root.querySelector("#v15-center") as HTMLElement;
    const title = root.querySelector("#v15-title") as HTMLElement;
    const bottom = root.querySelector("#v15-bottom") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          duration: 300,
          ease: "linear",
        },
        100
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [1.1, 1],
          duration: 500,
          ease: "outBack",
        },
        200
      );
    }

    if (title) {
      tl.add(
        title,
        {
          translateX: [-25, 18, -10, 5, 0],
          duration: 600,
          ease: "inOutQuad",
        },
        300
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 400,
          ease: "outCubic",
        },
        600
      );
    }
  }
}

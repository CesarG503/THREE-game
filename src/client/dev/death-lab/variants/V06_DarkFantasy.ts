import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V06_DarkFantasy extends AbstractDeathVariant {
  public id = "v06_dark_fantasy";
  public name = "V06 — DARK FANTASY / YOU DIED";
  public subtitle = "RPG de Fantasía Oscura · 'C A Í S T E', Cenizas y Resonancia";
  public theme = "dark_fantasy";
  public inspiration = "Dark Souls, Elden Ring, Bloodborne";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v06";
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
      padding: 50px 60px;
      box-sizing: border-box;
      font-family: 'Cinzel', 'Times New Roman', serif;
      user-select: none;
      background: radial-gradient(circle at center, rgba(30, 0, 5, 0.4) 0%, rgba(5, 0, 2, 0.92) 100%);
    `;

    root.innerHTML = `
      <!-- Top Rune Marker -->
      <div id="v06-top" style="opacity:0; transform: translateY(-20px); letter-spacing:0.3em; color:#991b1b; font-size:12px; font-weight:700;">
        † TIERRAS SOMBRÍAS // VÍNCULO EXTINTO †
      </div>

      <!-- Center Monumental Title -->
      <div id="v06-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; opacity:0; transform: scale(0.92);">
        <div id="v06-title" style="font-size:clamp(60px, 14vw, 130px); font-weight:700; color:#ef4444; letter-spacing:0.25em; text-shadow:0 0 30px rgba(185, 28, 28, 0.8), 0 0 60px rgba(185, 28, 28, 0.5);">
          C A Í S T E
        </div>
        <div style="font-size:15px; color:#fca5a5; letter-spacing:0.2em; text-transform:uppercase; margin-top:12px;">
          DERROTADO ANTE <span style="color:#fff; font-weight:bold;">${scenario.killerName}</span>
        </div>
        
        <!-- Runes Lost Box -->
        <div id="v06-souls-box" style="margin-top:24px; background:rgba(0,0,0,0.7); border:1px solid #7f1d1d; border-radius:4px; padding:8px 24px; display:flex; align-items:center; gap:12px; opacity:0;">
          <span style="color:#dc2626; font-size:18px;">🔥</span>
          <span style="font-size:13px; color:#cbd5e1; letter-spacing:0.1em;">RUNAS PERDIDAS:</span>
          <span id="v06-souls-num" style="font-size:18px; font-weight:bold; color:#ef4444; font-family:monospace;">24,850</span>
        </div>
      </div>

      <!-- Bottom Bonfire Action -->
      <div id="v06-bottom" style="opacity:0; transform: translateY(20px); text-align:center;">
        <div style="font-size:13px; color:#94a3b8; letter-spacing:0.15em; text-transform:uppercase;">
          DESPERTARES EN LA HOGUERA · <span style="color:#ef4444; font-weight:bold;">[ESPACIO]</span>
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Slow 3D push into the darkness
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 1.2, z: 3.8 },
        fov: 54,
        duration: 2800,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.dirLight, 0.4, 0x7f1d1d, tl, 0, 1600);

    // 2. Center Monumental Emergence
    const top = root.querySelector("#v06-top") as HTMLElement;
    const center = root.querySelector("#v06-center") as HTMLElement;
    const soulsBox = root.querySelector("#v06-souls-box") as HTMLElement;
    const soulsNum = root.querySelector("#v06-souls-num") as HTMLElement;
    const bottom = root.querySelector("#v06-bottom") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 1000,
          ease: "outCubic",
        },
        200
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [0.92, 1.04],
          duration: 1800,
          ease: "outCubic",
        },
        300
      );
    }

    if (soulsBox) {
      tl.add(
        soulsBox,
        {
          opacity: [0, 1],
          duration: 800,
          ease: "outQuad",
        },
        900
      );
    }

    // Runes counting down to 0
    if (soulsNum) {
      const runesProxy = { runes: 24850 };
      tl.add(
        runesProxy,
        {
          runes: 0,
          duration: 1400,
          ease: "inOutQuad",
          onUpdate: () => {
            if (soulsNum) soulsNum.textContent = Math.round(runesProxy.runes).toLocaleString();
          },
        },
        1100
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 800,
          ease: "outQuad",
        },
        1400
      );
    }
  }
}

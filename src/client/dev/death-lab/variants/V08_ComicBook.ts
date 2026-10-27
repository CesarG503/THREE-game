import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V08_ComicBook extends AbstractDeathVariant {
  public id = "v08_comic_book";
  public name = "V08 — COMIC BOOK ONOMATOPOEIA";
  public subtitle = "Estilo Novela Gráfica Pop · Viñetas, 'K.O.!!' y Medios Tonos";
  public theme = "comic_book_pop";
  public inspiration = "Spider-Man Into The Spider-Verse, Borderlands, Hi-Fi Rush";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v08";
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
      font-family: 'Bangers', Impact, cursive, sans-serif;
      user-select: none;
      background: radial-gradient(circle at center, rgba(254, 240, 138, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%);
    `;

    root.innerHTML = `
      <!-- Top Issue Banner -->
      <div id="v08-top" style="display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(-30px);">
        <div style="background:#ef4444; color:#fff; border:3px solid #000; padding:6px 16px; font-size:18px; letter-spacing:0.1em; transform:rotate(-2deg); box-shadow:4px 4px 0 #000;">
          VIPER COMICS #42 · EDICIÓN ESPECIAL
        </div>
        <div style="background:#facc15; color:#000; border:3px solid #000; padding:4px 14px; font-size:16px; transform:rotate(2deg); box-shadow:4px 4px 0 #000;">
          ¡¡VOLUMEN FATAL!!
        </div>
      </div>

      <!-- Center Dynamic Comic Pop Panel -->
      <div id="v08-center" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
        <div id="v08-ko-stamp" style="font-size:clamp(80px, 16vw, 150px); font-weight:900; color:#ef4444; -webkit-text-stroke:4px #000; text-shadow:8px 8px 0px #000, 12px 12px 0px #facc15; transform:scale(0) rotate(-8deg); letter-spacing:0.05em;">
          K.O.!!
        </div>
        
        <!-- Comic Narrative Box -->
        <div id="v08-panel" style="background:#fff; border:4px solid #000; border-radius:4px; padding:12px 28px; box-shadow:8px 8px 0 #000; transform:rotate(1deg) scale(0); max-width:480px;">
          <div style="font-size:16px; color:#000; font-family:'Courier New', monospace; font-weight:bold;">
            ¡¡${(scenario.killerName || "Rival").toUpperCase()} ACIERTA CON SU ${(scenario.weaponName || scenario.weapon || "Blaster").toUpperCase()} Y ENVÍA AL PROTAGONISTA A LA LONA!!
          </div>
        </div>
      </div>

      <!-- Bottom Next Issue Action -->
      <div id="v08-bottom" style="display:flex; justify-content:flex-end; opacity:0; transform: translateY(30px);">
        <div style="background:#facc15; color:#000; border:3px solid #000; padding:12px 24px; font-size:18px; letter-spacing:0.05em; box-shadow:6px 6px 0 #000; transform:rotate(-1deg);">
          CONTINUARÁ EN EL SIGUIENTE NÚMERO... [ESPACIO]
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Low angle dynamic superhero 3D snap
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0.6, y: 0.9, z: 2.8 },
        fov: 72,
        duration: 1000,
        ease: "outExpo",
      },
      tl,
      0
    );

    // 2. Cartoon squash & stretch for K.O. Stamp
    const top = root.querySelector("#v08-top") as HTMLElement;
    const koStamp = root.querySelector("#v08-ko-stamp") as HTMLElement;
    const panel = root.querySelector("#v08-panel") as HTMLElement;
    const bottom = root.querySelector("#v08-bottom") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-30, 0],
          duration: 400,
          ease: "outCubic",
        },
        100
      );
    }

    if (koStamp) {
      // Squash & Stretch: scaleX zooms wider first, then springs to 1
      tl.add(
        koStamp,
        {
          scaleX: [0, 1.4, 0.9, 1],
          scaleY: [0, 0.7, 1.1, 1],
          rotate: [-8, -4],
          duration: 700,
          ease: "outElastic",
        },
        150
      );
    }

    if (panel) {
      tl.add(
        panel,
        {
          scale: [0, 1],
          rotate: [1, 0],
          duration: 500,
          ease: "outBack",
        },
        450
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
        650
      );
    }
  }
}

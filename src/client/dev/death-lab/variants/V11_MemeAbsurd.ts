import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V11_MemeAbsurd extends AbstractDeathVariant {
  public id = "v11_meme_absurd";
  public name = "V11 — MEME / ABSURD CHAOS";
  public subtitle = "Humor Gen-Z & Slapstick · 'SKILL ISSUE', Bocina y Ragdoll";
  public theme = "meme_absurd";
  public inspiration = "Team Fortress 2, Garry's Mod, Roblox, Crab Game";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v11";
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
      font-family: 'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif;
      user-select: none;
      background: radial-gradient(circle at center, rgba(234, 179, 8, 0.2) 0%, rgba(20, 10, 0, 0.88) 100%);
    `;

    root.innerHTML = `
      <!-- Top LOL Banner -->
      <div id="v11-top" style="opacity:0; transform: translateY(-30px); font-size:24px; color:#facc15; text-shadow:2px 2px 0 #000; letter-spacing:0.1em;">
        🤡 MOMENTO VIPER.IO CERTIFICADO 🤡
      </div>

      <!-- Center Massive Meme Stamp -->
      <div id="v11-center" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
        <div id="v11-stamp" style="font-size:clamp(60px, 12vw, 120px); font-weight:900; color:#ef4444; -webkit-text-stroke:3px #000; text-shadow:6px 6px 0px #000, 10px 10px 0px #facc15; transform:scale(0) rotate(-25deg); letter-spacing:0.05em;">
          SKILL ISSUE
        </div>
        <div id="v11-subtitle" style="font-size:20px; color:#fff; text-shadow:2px 2px 0 #000; margin-top:12px; opacity:0; transform: translateY(20px);">
          Eliminado de forma vergonzosa por <span style="color:#facc15;">${scenario.killerName}</span>
        </div>
      </div>

      <!-- Bottom Copium Action -->
      <div id="v11-bottom" style="opacity:0; transform: translateY(30px); display:flex; gap:16px;">
        <div style="background:#22c55e; color:#000; border:3px solid #000; font-size:18px; font-weight:bold; padding:12px 24px; border-radius:12px; box-shadow:4px 4px 0 #000;">
          [ESPACIO] CONSUMIR COPIUM Y REAPARECER
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. 3D Slapstick Ragdoll Launch! Player launches skyward and tumbles!
    this.adapter.animateTransform(
      scene.playerGroup,
      {
        position: { y: 12 },
        rotation: { x: 4, y: 3, z: 8 },
        duration: 2200,
        ease: "outExpo",
      },
      tl,
      0
    );

    // 3D Camera looks up tracking the launched player
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 3.5, z: 6.0 },
        fov: 75,
        duration: 1800,
        ease: "outBack",
      },
      tl,
      100
    );

    // 2. Cartoon rubber bounce for Meme Stamp
    const top = root.querySelector("#v11-top") as HTMLElement;
    const stamp = root.querySelector("#v11-stamp") as HTMLElement;
    const sub = root.querySelector("#v11-subtitle") as HTMLElement;
    const bottom = root.querySelector("#v11-bottom") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-30, 0],
          duration: 400,
          ease: "outBack",
        },
        150
      );
    }

    if (stamp) {
      tl.add(
        stamp,
        {
          scale: [0, 1.25, 1],
          rotate: [-25, 6],
          duration: 800,
          ease: "outElastic",
        },
        300
      );
    }

    if (sub) {
      tl.add(
        sub,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 500,
          ease: "outCubic",
        },
        600
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 500,
          ease: "outBack",
        },
        750
      );
    }
  }
}

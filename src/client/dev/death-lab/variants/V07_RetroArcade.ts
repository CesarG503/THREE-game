import { createTimeline } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V07_RetroArcade extends AbstractDeathVariant {
  public id = "v07_retro_arcade";
  public name = "V07 — RETRO ARCADE 1984";
  public subtitle = "Nostalgia 8-Bit Pixel · 'INSERT COIN', Scanlines CRT y Chiptune";
  public theme = "retro_arcade_80s";
  public inspiration = "Pac-Man, Street Fighter II, Space Invaders";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v07";
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
      font-family: 'Press Start 2P', 'Courier New', monospace;
      color: #fff;
      user-select: none;
      background: radial-gradient(circle at center, rgba(30, 0, 50, 0.4) 0%, rgba(5, 2, 15, 0.94) 100%);
    `;

    root.innerHTML = `
      <!-- Top 1UP / HIGH SCORE -->
      <div id="v07-top" style="display:flex; justify-content:space-between; width:100%; max-width:800px; font-size:16px; opacity:0; transform: translateY(-20px);">
        <div><span style="color:#ef4444;">1UP</span> 04280</div>
        <div><span style="color:#eab308;">HIGH SCORE</span> 99990</div>
      </div>

      <!-- Center Big Pixel GAME OVER -->
      <div id="v07-center" style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:24px; opacity:0; transform: scale(0.5);">
        <div id="v07-title" style="font-size:clamp(40px, 8vw, 84px); font-weight:bold; color:#ef4444; letter-spacing:0.1em; text-shadow:4px 4px 0px #000, 8px 8px 0px #7f1d1d;">
          GAME OVER
        </div>
        <div style="font-size:14px; color:#38bdf8; letter-spacing:0.1em;">
          PLAYER 1 DEFEATED BY ${scenario.killerName}
        </div>
        <div id="v07-countdown-box" style="background:#000; border:4px solid #facc15; padding:12px 32px; font-size:24px; color:#facc15;">
          CONTINUE? <span id="v07-count" style="color:#ef4444;">9</span>
        </div>
      </div>

      <!-- Bottom Insert Coin -->
      <div id="v07-bottom" style="opacity:0; transform: translateY(20px); text-align:center;">
        <div id="v07-insert-coin" style="font-size:16px; color:#22c55e; letter-spacing:0.15em;">
          INSERT COIN TO CONTINUE [SPACE]
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:8px;">
          CREDIT 02 · © 1984 VIPER ARCADE CORP
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline with Stepped 8-Bit Easing
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. 3D Stepped camera push (8-bit style)
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 0, y: 2.0, z: 4.2 },
        duration: 1600,
        ease: "steps(6)",
      },
      tl,
      0
    );

    // 2. Stepped HUD entrance
    const top = root.querySelector("#v07-top") as HTMLElement;
    const center = root.querySelector("#v07-center") as HTMLElement;
    const bottom = root.querySelector("#v07-bottom") as HTMLElement;
    const countEl = root.querySelector("#v07-count") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 400,
          ease: "steps(4)",
        },
        100
      );
    }

    if (center) {
      tl.add(
        center,
        {
          opacity: [0, 1],
          scale: [0.5, 1],
          duration: 600,
          ease: "steps(5)",
        },
        200
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 400,
          ease: "steps(4)",
        },
        500
      );
    }

    // Countdown 9 -> 0
    if (countEl) {
      const countProxy = { c: 9 };
      tl.add(
        countProxy,
        {
          c: 0,
          duration: 2500,
          ease: "steps(9)",
          onUpdate: () => {
            if (countEl) countEl.textContent = String(Math.ceil(countProxy.c));
          },
        },
        700
      );
    }
  }
}

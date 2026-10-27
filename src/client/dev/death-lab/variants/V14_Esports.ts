import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V14_Esports extends AbstractDeathVariant {
  public id = "v14_esports";
  public name = "V14 — ESPORTS TOURNAMENT BROADCAST";
  public subtitle = "Retransmisión Pro-League AAA · Lower-Thirds, Killfeed y MVP Highlight";
  public theme = "esports_broadcast";
  public inspiration = "CS2 Major, VALORANT Champions, Overwatch League";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v14";
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 32px 48px;
      box-sizing: border-box;
      font-family: 'Montserrat', -apple-system, sans-serif;
      color: #fff;
      user-select: none;
      background: radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(3, 7, 18, 0.9) 100%);
    `;

    root.innerHTML = `
      <!-- Top Tournament Killfeed -->
      <div id="v14-top" style="display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(-20px);">
        <div style="background:#10b981; color:#000; font-size:12px; font-weight:900; letter-spacing:0.15em; padding:4px 12px; border-radius:2px;">
          VIPER PRO INVITATIONAL // FINALS
        </div>
        <div style="background:rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.15); padding:6px 16px; border-radius:4px; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:8px;">
          <span style="color:#ef4444;">${scenario.killerName}</span>
          <span style="color:#94a3b8; font-size:10px;">[${scenario.weapon}]</span>
          <span style="color:#38bdf8;">YOU</span>
        </div>
      </div>

      <!-- Lower-Third Broadcast Card -->
      <div id="v14-lower-third" style="background:rgba(15, 23, 42, 0.94); border:1px solid rgba(255, 255, 255, 0.15); border-left:4px solid #10b981; border-radius:4px; padding:20px 32px; max-width:540px; box-shadow:0 20px 50px rgba(0,0,0,0.8); opacity:0; transform: translateX(-40px);">
        <div style="font-size:11px; letter-spacing:0.2em; color:#10b981; font-weight:800; margin-bottom:6px;">
          ELIMINACIÓN EN RONDA CLAVE // MATCH POINT
        </div>
        <div style="font-size:28px; font-weight:900; color:#fff; letter-spacing:0.02em; margin-bottom:12px;">
          ELIMINADO POR ${scenario.killerName.toUpperCase()}
        </div>
        <div style="display:flex; gap:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
          <div>
            <div style="font-size:10px; color:#94a3b8;">DAÑO ENTRADA</div>
            <div style="font-size:16px; font-weight:bold; color:#f87171;">${scenario.damageDealt} HP</div>
          </div>
          <div>
            <div style="font-size:10px; color:#94a3b8;">DISTANCIA</div>
            <div style="font-size:16px; font-weight:bold; color:#fff;">${scenario.distance}</div>
          </div>
          <div>
            <div style="font-size:10px; color:#94a3b8;">HEADSHOT</div>
            <div style="font-size:16px; font-weight:bold; color:#facc15;">${scenario.bodyPart.includes("Cabeza") ? "SÍ" : "NO"}</div>
          </div>
        </div>
      </div>

      <!-- Bottom Broadcast Spectate Prompts -->
      <div id="v14-bottom" style="display:flex; justify-content:space-between; align-items:center; opacity:0; transform: translateY(20px);">
        <div style="font-size:12px; color:#94a3b8;">
          SPECTATING SQUAD: <span style="color:#10b981; font-weight:bold;">[Q] / [E]</span> CAMBIAR JUGADOR
        </div>
        <div style="background:#10b981; color:#000; font-size:13px; font-weight:900; padding:10px 20px; border-radius:4px;">
          [ESPACIO] RESPONDIL (04s)
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. 3D Broadcast Camera Pan
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: 1.0, y: 1.5, z: 3.5 },
        fov: 55,
        duration: 1600,
        ease: "outExpo",
      },
      tl,
      0
    );

    this.adapter.animateLight(scene.accentLight, 4.0, 0x10b981, tl, 0, 800);

    // 2. Broadcast Lower-Third Slide-in
    const top = root.querySelector("#v14-top") as HTMLElement;
    const lowerThird = root.querySelector("#v14-lower-third") as HTMLElement;
    const bottom = root.querySelector("#v14-bottom") as HTMLElement;

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 400,
          ease: "outCubic",
        },
        100
      );
    }

    if (lowerThird) {
      tl.add(
        lowerThird,
        {
          opacity: [0, 1],
          translateX: [-40, 0],
          duration: 600,
          ease: "outCubic",
        },
        250
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
        500
      );
    }
  }
}

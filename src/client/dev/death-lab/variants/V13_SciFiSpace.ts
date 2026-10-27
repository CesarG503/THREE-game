import { createTimeline, stagger } from "animejs";
import { AbstractDeathVariant } from "./AbstractDeathVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export class V13_SciFiSpace extends AbstractDeathVariant {
  public id = "v13_scifi_space";
  public name = "V13 — SCI-FI ZERO-G HOLOGRAM";
  public subtitle = "Espacio Profundo & Aislamiento · Holograma Flotante y Despresurización";
  public theme = "scifi_deep_space";
  public inspiration = "Dead Space, Halo, Alien Isolation, Starfield";

  public render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void {
    this.cleanup();
    this.containerEl = container;
    this.sceneRef = scene;
    this.audioRef = audio;

    scene.setVariantVisuals(this.id);
    audio.playVariantAudio(this.id);

    const root = document.createElement("div");
    root.id = "variant-root-v13";
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
      font-family: 'Electrolize', -apple-system, sans-serif;
      color: #38bdf8;
      user-select: none;
      background: radial-gradient(circle at center, rgba(14, 165, 233, 0.08) 0%, rgba(2, 6, 23, 0.94) 100%);
      perspective: 1000px;
    `;

    root.innerHTML = `
      <!-- Top Orbital Telemetry -->
      <div id="v13-top" style="display:flex; justify-content:space-between; opacity:0; transform: translateY(-20px);">
        <div>
          <span style="background:rgba(56, 189, 248, 0.15); border:1px solid #38bdf8; padding:3px 8px; font-size:11px; letter-spacing:0.15em;">
            EVA SUIT // HULL BREACH
          </span>
        </div>
        <div style="font-size:12px; color:#94a3b8; font-family:monospace;">
          OXYGEN: <span id="v13-o2-val" style="color:#ef4444; font-weight:bold;">0.0%</span> · PRESSURE: 0.00 kPa
        </div>
      </div>

      <!-- Center 3D Hologram Projection -->
      <div id="v13-hologram" style="display:flex; flex-direction:column; align-items:center; text-align:center; transform: rotateX(45deg) scale(0.8); opacity:0; transform-origin:center bottom;">
        <div style="width:80px; height:2px; background:#38bdf8; box-shadow:0 0 15px #38bdf8; margin-bottom:12px;"></div>
        <div style="font-size:12px; letter-spacing:0.35em; color:#38bdf8; text-transform:uppercase;">
          DESCOMPRESIÓN LETAL CONFIRMADA
        </div>
        <div id="v13-title" style="font-size:clamp(44px, 8vw, 84px); font-weight:900; color:#fff; text-shadow:0 0 35px #38bdf8, 0 0 70px rgba(56, 189, 248, 0.4); letter-spacing:0.06em;">
          BIOMÉTRICA PERDIDA
        </div>
        <div style="font-size:15px; color:#bae6fd; letter-spacing:0.1em; margin-top:8px;">
          AGRESOR EXTERNO: <span style="color:#fff; font-weight:bold;">${scenario.killerName}</span> [${scenario.weapon}]
        </div>

        <!-- Rig Spine LED Segments -->
        <div id="v13-spine-bar" style="display:flex; gap:6px; margin-top:20px;">
          <div class="v13-led" style="width:24px; height:8px; background:#ef4444; border-radius:2px; opacity:0.3;"></div>
          <div class="v13-led" style="width:24px; height:8px; background:#ef4444; border-radius:2px; opacity:0.3;"></div>
          <div class="v13-led" style="width:24px; height:8px; background:#ef4444; border-radius:2px; opacity:0.3;"></div>
          <div class="v13-led" style="width:24px; height:8px; background:#ef4444; border-radius:2px; opacity:0.3;"></div>
          <div class="v13-led" style="width:24px; height:8px; background:#ef4444; border-radius:2px; opacity:0.3;"></div>
        </div>
      </div>

      <!-- Bottom Re-pressurize Action -->
      <div id="v13-bottom" style="display:flex; justify-content:space-between; align-items:flex-end; opacity:0; transform: translateY(20px);">
        <div style="font-size:11px; color:#64748b; font-family:monospace;">
          ORBITAL SECTOR 7 // GRAVITY: 0.00G
        </div>
        <div style="background:rgba(56, 189, 248, 0.2); border:1px solid #38bdf8; color:#fff; padding:12px 24px; font-size:13px; font-weight:bold; letter-spacing:0.1em; border-radius:4px;">
          [SPACE] RE-SELLAR TRAJE Y REAPARECER
        </div>
      </div>
    `;

    container.appendChild(root);

    // Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay: this.animeEnabled,
    });
    this.timeline = tl;

    // 1. Zero-G floating weapon drift
    this.adapter.animateTransform(
      scene.droppedWeapon,
      {
        position: { x: 0.6, y: 0.45, z: 0.4 },
        rotation: { x: 1.2, y: 0.8, z: 0.4 },
        duration: 2800,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    // 3D Camera floating orbital drift
    this.adapter.animateCamera(
      scene.camera,
      scene.cameraTarget,
      {
        position: { x: -0.8, y: 1.8, z: 3.8 },
        fov: 58,
        duration: 2400,
        ease: "inOutQuad",
      },
      tl,
      0
    );

    // 2. Holographic 3D unfold
    const top = root.querySelector("#v13-top") as HTMLElement;
    const holo = root.querySelector("#v13-hologram") as HTMLElement;
    const bottom = root.querySelector("#v13-bottom") as HTMLElement;
    const leds = root.querySelectorAll(".v13-led");

    if (top) {
      tl.add(
        top,
        {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 500,
          ease: "outCubic",
        },
        100
      );
    }

    if (holo) {
      tl.add(
        holo,
        {
          opacity: [0, 1],
          rotateX: [45, 0],
          scale: [0.8, 1],
          duration: 900,
          ease: "outBack",
        },
        250
      );
    }

    if (leds.length > 0) {
      tl.add(
        leds,
        {
          opacity: [0.3, 1, 0.2],
          duration: 400,
          ease: "inOutQuad",
          delay: stagger(70),
        },
        600
      );
    }

    if (bottom) {
      tl.add(
        bottom,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 500,
          ease: "outCubic",
        },
        800
      );
    }
  }
}

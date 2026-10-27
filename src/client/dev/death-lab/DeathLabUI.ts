import type { DeathVariant } from "./variants/BaseVariant";
import type { DeathScenario } from "./DeathLabScenarios";
import { DEATH_SCENARIOS } from "./DeathLabScenarios";

export interface DeathLabUIEvents {
  onSelectVariant: (index: number) => void;
  onSelectScenario: (scenarioId: string) => void;
  onReplay: () => void;
  onPlayPause: () => void;
  onSeek: (progress: number) => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
  onToggleAnime: () => void;
  onToggleSpectator: () => void;
  onTogglePerspective: () => void;
  onCycleTarget: (delta: number) => void;
  onRespawn: () => void;
  onToggleMute: () => void;
  onToggleReducedMotion: () => void;
  onToggleHUD: () => boolean;
  onToggleParticles: () => boolean;
  onToggleStudio: () => void;
}

export class DeathLabUI {
  public container: HTMLElement;
  public isVisible: boolean = true;
  private events: DeathLabUIEvents;
  private variants: DeathVariant[];
  private currentVariantIndex: number = 0;
  private currentScenarioIndex: number = 0;
  private isMuted: boolean = false;
  private isPaused: boolean = false;
  private isAnimeEnabled: boolean = true;
  private isHUDVisible: boolean = true;
  private isParticlesEnabled: boolean = true;
  public isStudioOpen: boolean = false;
  private currentSpeed: number = 1.0;
  private speeds: number[] = [0.25, 0.5, 1.0, 2.0];
  private currentPerspective: "third_person" | "first_person" = "third_person";
  private scrubberInterval: number | null = null;

  constructor(variants: DeathVariant[], events: DeathLabUIEvents) {
    this.variants = variants;
    this.events = events;

    const el = document.createElement("div");
    el.id = "death-lab-dev-bar";
    el.style.cssText = `
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: rgba(8, 12, 22, 0.94);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 40px;
      padding: 6px 18px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(16, 185, 129, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #e2e8f0;
      user-select: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    document.body.appendChild(el);
    this.container = el;

    this.render();
    window.addEventListener("keydown", this.handleKeyDown);

    // Update Scrubber Progress smoothly
    this.scrubberInterval = window.setInterval(() => {
      this.syncScrubber();
    }, 100);
  }

  public setVariantIndex(idx: number) {
    this.currentVariantIndex = idx;
    const select = this.container.querySelector("#lab-variant-select") as HTMLSelectElement;
    if (select) select.value = String(idx);
    this.isPaused = false;
    this.updatePlayPauseButton();
  }

  public setScenarioIndex(idx: number) {
    this.currentScenarioIndex = idx;
    const select = this.container.querySelector("#lab-scenario-select") as HTMLSelectElement;
    if (select) select.value = DEATH_SCENARIOS[idx].id;
  }

  public updatePlayPauseState(paused: boolean) {
    this.isPaused = paused;
    this.updatePlayPauseButton();
  }

  private updatePlayPauseButton() {
    const btn = this.container.querySelector("#btn-lab-playpause") as HTMLButtonElement;
    if (btn) {
      btn.textContent = this.isPaused ? "▶ Play" : "⏸ Pause";
      btn.style.background = this.isPaused ? "#f59e0b" : "#334155";
    }
  }

  private syncScrubber() {
    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    const dur = active.getDuration();
    const curr = active.getCurrentTime();
    const scrubber = this.container.querySelector("#lab-scrubber") as HTMLInputElement;
    const timeLabel = this.container.querySelector("#lab-time-label");

    if (scrubber && dur > 0 && document.activeElement !== scrubber) {
      scrubber.value = String((curr / dur) * 100);
    }
    if (timeLabel) {
      const curSec = (curr / 1000).toFixed(1);
      const durSec = (dur / 1000).toFixed(1);
      timeLabel.textContent = `${curSec}s / ${durSec}s`;
    }
  }

  public toggleVisibility(): boolean {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.container.style.opacity = "1";
      this.container.style.pointerEvents = "auto";
      this.container.style.transform = "translateX(-50%) translateY(0)";
    } else {
      this.container.style.opacity = "0";
      this.container.style.pointerEvents = "none";
      this.container.style.transform = "translateX(-50%) translateY(-20px)";
    }
    return this.isVisible;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    const key = e.key.toLowerCase();

    // H = Hide / Show Dev Panel
    if (key === "h") {
      e.preventDefault();
      this.toggleVisibility();
      return;
    }

    // Space = Pause / Resume Anime.js Timeline
    if (e.code === "Space") {
      e.preventDefault();
      this.isPaused = !this.isPaused;
      this.events.onPlayPause();
      this.updatePlayPauseButton();
      return;
    }

    // R = Replay animation
    if (key === "r") {
      e.preventDefault();
      this.events.onReplay();
      return;
    }

    // S = Speed cycle (0.25x -> 0.5x -> 1x -> 2x)
    if (key === "s") {
      e.preventDefault();
      const nextIdx = (this.speeds.indexOf(this.currentSpeed) + 1) % this.speeds.length;
      this.currentSpeed = this.speeds[nextIdx];
      this.events.onSetSpeed(this.currentSpeed);
      const btn = this.container.querySelector("#btn-lab-speed") as HTMLButtonElement;
      if (btn) btn.textContent = `⚡ ${this.currentSpeed}x`;
      return;
    }

    // X = Reset all states
    if (key === "x") {
      e.preventDefault();
      this.events.onReset();
      return;
    }

    // M = Toggle Anime.js ON/OFF (Comparison)
    if (key === "m") {
      e.preventDefault();
      this.isAnimeEnabled = !this.isAnimeEnabled;
      this.events.onToggleAnime();
      const btn = this.container.querySelector("#btn-lab-anime") as HTMLButtonElement;
      if (btn) {
        btn.textContent = this.isAnimeEnabled ? "🎬 Anime: ON" : "⏸ Anime: OFF";
        btn.style.background = this.isAnimeEnabled ? "#10b981" : "#64748b";
      }
      return;
    }

    // N = Next scenario
    if (key === "n") {
      e.preventDefault();
      this.currentScenarioIndex = (this.currentScenarioIndex + 1) % DEATH_SCENARIOS.length;
      this.setScenarioIndex(this.currentScenarioIndex);
      this.events.onSelectScenario(DEATH_SCENARIOS[this.currentScenarioIndex].id);
      return;
    }

    // U = Mute Audio
    if (key === "u") {
      e.preventDefault();
      this.isMuted = !this.isMuted;
      this.events.onToggleMute();
      this.render();
      return;
    }

    // J = Toggle HUD Overlay
    if (key === "j") {
      e.preventDefault();
      this.isHUDVisible = this.events.onToggleHUD();
      const btn = this.container.querySelector("#btn-lab-hud") as HTMLButtonElement;
      if (btn) {
        btn.textContent = this.isHUDVisible ? "📺 HUD: ON" : "📺 HUD: OFF";
        btn.style.background = this.isHUDVisible ? "#0284c7" : "#475569";
      }
      return;
    }

    // P = Toggle Particles
    if (key === "p") {
      e.preventDefault();
      this.isParticlesEnabled = this.events.onToggleParticles();
      const btn = this.container.querySelector("#btn-lab-particles") as HTMLButtonElement;
      if (btn) {
        btn.textContent = this.isParticlesEnabled ? "✨ FX: ON" : "✨ FX: OFF";
        btn.style.background = this.isParticlesEnabled ? "#8b5cf6" : "#475569";
      }
      return;
    }

    // T = Toggle Studio Composer
    if (key === "t") {
      e.preventDefault();
      this.isStudioOpen = !this.isStudioOpen;
      this.events.onToggleStudio();
      const btn = this.container.querySelector("#btn-lab-studio") as HTMLButtonElement;
      if (btn) {
        btn.style.boxShadow = this.isStudioOpen ? "0 0 15px #10b981" : "none";
      }
      return;
    }

    // V = Toggle perspective
    if (key === "v") {
      e.preventDefault();
      this.currentPerspective = this.currentPerspective === "third_person" ? "first_person" : "third_person";
      this.events.onTogglePerspective();
      return;
    }

    // Q / E = Cycle spectator target
    if (key === "q") {
      e.preventDefault();
      this.events.onCycleTarget(-1);
      return;
    }
    if (key === "e") {
      e.preventDefault();
      this.events.onCycleTarget(1);
      return;
    }

    // Keys 1 to 9 -> Variants 0 to 8
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      e.preventDefault();
      const targetIdx = num - 1;
      if (targetIdx < this.variants.length) {
        this.setVariantIndex(targetIdx);
        this.events.onSelectVariant(targetIdx);
      }
      return;
    }

    // Letters A to G -> Variants 9 to 15
    const letterMap: Record<string, number> = {
      a: 9, b: 10, c: 11, d: 12, e: 13, f: 14, g: 15
    };
    if (letterMap[key] !== undefined && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const targetIdx = letterMap[key];
      if (targetIdx < this.variants.length) {
        this.setVariantIndex(targetIdx);
        this.events.onSelectVariant(targetIdx);
      }
      return;
    }

    // Arrow Left / Right
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const newIdx = (this.currentVariantIndex - 1 + this.variants.length) % this.variants.length;
      this.setVariantIndex(newIdx);
      this.events.onSelectVariant(newIdx);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const newIdx = (this.currentVariantIndex + 1) % this.variants.length;
      this.setVariantIndex(newIdx);
      this.events.onSelectVariant(newIdx);
      return;
    }
  };

  public render() {
    this.container.innerHTML = `
      <!-- VIPER LAB BADGE -->
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="
          background:#10b981; color:#030712; font-weight:900; font-size:10px;
          padding:2px 6px; border-radius:12px; letter-spacing:0.08em;
        ">
          ANIME.JS 4
        </span>
        <span style="font-weight:700; color:#fff; font-size:12px;">PLAYGROUND</span>
      </div>

      <span style="color:#334155;">|</span>

      <!-- Variant Selector -->
      <select id="lab-variant-select" style="
        background: #1e293b; color: #38bdf8; border: 1px solid #475569;
        border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px;
        cursor: pointer; outline: none; max-width: 170px;
      ">
        ${this.variants.map((v, i) => `
          <option value="${i}" ${i === this.currentVariantIndex ? "selected" : ""}>
            [${i + 1}] ${v.name}
          </option>
        `).join("")}
      </select>

      <!-- Scenario Selector -->
      <select id="lab-scenario-select" style="
        background: #1e293b; color: #facc15; border: 1px solid #475569;
        border-radius: 6px; padding: 3px 8px; font-weight: 700; font-size: 11px;
        cursor: pointer; outline: none; max-width: 130px;
      ">
        ${DEATH_SCENARIOS.map((s, i) => `
          <option value="${s.id}" ${i === this.currentScenarioIndex ? "selected" : ""}>
            ${s.name}
          </option>
        `).join("")}
      </select>

      <span style="color:#334155;">|</span>

      <!-- Timeline Transport Controls -->
      <button id="btn-lab-playpause" title="Pausar / Reanudar (Espacio)" style="
        background: #334155; color: #fff; border: none; padding: 3px 8px;
        border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
      ">
        ${this.isPaused ? "▶ Play" : "⏸ Pause"}
      </button>

      <button id="btn-lab-replay" title="Reiniciar Timeline desde 0 (Tecla R)" style="
        background: #334155; color: #fff; border: none; padding: 3px 8px;
        border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
      ">
        🔄 Replay
      </button>

      <!-- Timeline Scrubber -->
      <div style="display:flex; align-items:center; gap:6px;">
        <input type="range" id="lab-scrubber" min="0" max="100" value="0" step="0.5" style="
          width: 80px; height: 5px; cursor: pointer; accent-color: #10b981;
        " title="Scrubbing de timeline">
        <span id="lab-time-label" style="font-size:10px; color:#94a3b8; font-family:monospace; min-width:60px;">
          0.0s / 0.0s
        </span>
      </div>

      <!-- Playback Speed -->
      <button id="btn-lab-speed" title="Velocidad (Tecla S)" style="
        background: #1e293b; color: #38bdf8; border: 1px solid #334155; padding: 3px 6px;
        border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
      ">
        ⚡ ${this.currentSpeed}x
      </button>

      <!-- Toggle Anime.js (Baseline Comparison) -->
      <button id="btn-lab-anime" title="Comparar con/sin Anime.js (Tecla M)" style="
        background: ${this.isAnimeEnabled ? "#10b981" : "#64748b"}; color: #fff; border: none; padding: 3px 8px;
        border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
      ">
        ${this.isAnimeEnabled ? "🎬 Anime: ON" : "⏸ Anime: OFF"}
      </button>

      <span style="color:#334155;">|</span>

      <!-- Reset -->
      <button id="btn-lab-reset" title="Restablecer todos los estados visuales (Tecla X)" style="
        background: #dc2626; color: #fff; border: none; padding: 3px 6px;
        border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;
      ">
        Reset [X]
      </button>

      <!-- Spectator -->
      <button id="btn-lab-spectator" title="Simular Espectador" style="
        background: #4338ca; color: #fff; border: none; padding: 3px 8px;
        border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
      ">
        👁️ Espectador
      </button>

      <!-- Audio Mute Toggle -->
      <button id="btn-lab-audio" title="Silenciar / Activar Audio (Tecla U)" style="
        background: ${this.isMuted ? "#ef4444" : "#059669"}; color: #fff; border: none; padding: 3px 6px;
        border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;
      ">
        ${this.isMuted ? "🔇" : "🔊"}
      </button>

      <!-- Toggle HUD -->
      <button id="btn-lab-hud" title="Mostrar / Ocultar HUD (Tecla J)" style="
        background: ${this.isHUDVisible ? "#0284c7" : "#475569"}; color: #fff; border: none; padding: 3px 6px;
        border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;
      ">
        ${this.isHUDVisible ? "📺 HUD: ON" : "📺 HUD: OFF"}
      </button>

      <!-- Toggle Particles -->
      <button id="btn-lab-particles" title="Activar / Desactivar Partículas (Tecla P)" style="
        background: ${this.isParticlesEnabled ? "#8b5cf6" : "#475569"}; color: #fff; border: none; padding: 3px 6px;
        border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;
      ">
        ${this.isParticlesEnabled ? "✨ FX: ON" : "✨ FX: OFF"}
      </button>

      <!-- Toggle Studio Composer -->
      <button id="btn-lab-studio" title="Abrir Death Experience Studio (Editor de Composición, Tecla T)" style="
        background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #020617; border: none; padding: 3px 8px;
        border-radius: 4px; font-size: 10px; font-weight: 900; cursor: pointer; box-shadow: 0 0 10px rgba(16,185,129,0.35);
      ">
        🎨 Studio [T]
      </button>

      <!-- Hide Panel -->
      <button id="btn-lab-hide" title="Ocultar barra para capturas cinematográficas (Tecla H)" style="
        background: #0f172a; color: #94a3b8; border: 1px solid #334155; padding: 3px 6px;
        border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;
      ">
        [H]
      </button>
    `;

    // Hook listeners
    const varSelect = this.container.querySelector("#lab-variant-select") as HTMLSelectElement;
    if (varSelect) {
      varSelect.onchange = () => {
        const idx = parseInt(varSelect.value, 10);
        this.setVariantIndex(idx);
        this.events.onSelectVariant(idx);
      };
    }

    const scnSelect = this.container.querySelector("#lab-scenario-select") as HTMLSelectElement;
    if (scnSelect) {
      scnSelect.onchange = () => {
        const scenarioId = scnSelect.value;
        const idx = DEATH_SCENARIOS.findIndex((s) => s.id === scenarioId);
        if (idx !== -1) {
          this.setScenarioIndex(idx);
          this.events.onSelectScenario(scenarioId);
        }
      };
    }

    const btnPlayPause = this.container.querySelector("#btn-lab-playpause") as HTMLButtonElement;
    if (btnPlayPause) {
      btnPlayPause.onclick = () => {
        this.isPaused = !this.isPaused;
        this.events.onPlayPause();
        this.updatePlayPauseButton();
      };
    }

    const btnReplay = this.container.querySelector("#btn-lab-replay") as HTMLButtonElement;
    if (btnReplay) {
      btnReplay.onclick = () => this.events.onReplay();
    }

    const scrubber = this.container.querySelector("#lab-scrubber") as HTMLInputElement;
    if (scrubber) {
      scrubber.oninput = () => {
        const progress = parseFloat(scrubber.value) / 100;
        this.events.onSeek(progress);
      };
    }

    const btnSpeed = this.container.querySelector("#btn-lab-speed") as HTMLButtonElement;
    if (btnSpeed) {
      btnSpeed.onclick = () => {
        const nextIdx = (this.speeds.indexOf(this.currentSpeed) + 1) % this.speeds.length;
        this.currentSpeed = this.speeds[nextIdx];
        this.events.onSetSpeed(this.currentSpeed);
        btnSpeed.textContent = `⚡ ${this.currentSpeed}x`;
      };
    }

    const btnAnime = this.container.querySelector("#btn-lab-anime") as HTMLButtonElement;
    if (btnAnime) {
      btnAnime.onclick = () => {
        this.isAnimeEnabled = !this.isAnimeEnabled;
        this.events.onToggleAnime();
        btnAnime.textContent = this.isAnimeEnabled ? "🎬 Anime: ON" : "⏸ Anime: OFF";
        btnAnime.style.background = this.isAnimeEnabled ? "#10b981" : "#64748b";
      };
    }

    const btnReset = this.container.querySelector("#btn-lab-reset") as HTMLButtonElement;
    if (btnReset) {
      btnReset.onclick = () => this.events.onReset();
    }

    const btnSpectator = this.container.querySelector("#btn-lab-spectator") as HTMLButtonElement;
    if (btnSpectator) {
      btnSpectator.onclick = () => this.events.onToggleSpectator();
    }

    const btnAudio = this.container.querySelector("#btn-lab-audio") as HTMLButtonElement;
    if (btnAudio) {
      btnAudio.onclick = () => {
        this.isMuted = !this.isMuted;
        this.events.onToggleMute();
        this.render();
      };
    }

    const btnHUD = this.container.querySelector("#btn-lab-hud") as HTMLButtonElement;
    if (btnHUD) {
      btnHUD.onclick = () => {
        this.isHUDVisible = this.events.onToggleHUD();
        btnHUD.textContent = this.isHUDVisible ? "📺 HUD: ON" : "📺 HUD: OFF";
        btnHUD.style.background = this.isHUDVisible ? "#0284c7" : "#475569";
      };
    }

    const btnParticles = this.container.querySelector("#btn-lab-particles") as HTMLButtonElement;
    if (btnParticles) {
      btnParticles.onclick = () => {
        this.isParticlesEnabled = this.events.onToggleParticles();
        btnParticles.textContent = this.isParticlesEnabled ? "✨ FX: ON" : "✨ FX: OFF";
        btnParticles.style.background = this.isParticlesEnabled ? "#8b5cf6" : "#475569";
      };
    }

    const btnStudio = this.container.querySelector("#btn-lab-studio") as HTMLButtonElement;
    if (btnStudio) {
      btnStudio.onclick = () => {
        this.isStudioOpen = !this.isStudioOpen;
        this.events.onToggleStudio();
      };
    }

    const btnHide = this.container.querySelector("#btn-lab-hide") as HTMLButtonElement;
    if (btnHide) {
      btnHide.onclick = () => this.toggleVisibility();
    }
  }

  public dispose() {
    if (this.scrubberInterval !== null) {
      clearInterval(this.scrubberInterval);
      this.scrubberInterval = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    this.container.remove();
  }
}

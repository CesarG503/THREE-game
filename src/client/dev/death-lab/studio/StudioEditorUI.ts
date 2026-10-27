/**
 * StudioEditorUI.ts — Interactive visual multi-track timeline editor for VIPER.IO Death Experience Studio.
 *
 * Provides a professional non-linear timeline editor docked at the bottom of the screen,
 * allowing creators to assemble modules, move track blocks, adjust keyframes, inspect params,
 * and preview with Anime.js v4 + Three.js in real time.
 */

import type { DeathExperience, AnimationTrack, Keyframe, ParamSchema } from "./DeathExperienceTypes";
import { ModuleRegistry } from "./ModuleRegistry";

export interface StudioEditorEvents {
  onExperienceChanged: (experience: DeathExperience) => void;
  onPlayPause: () => void;
  onSeek: (timeMs: number) => void;
  onSetSpeed: (speed: number) => void;
  onTrackSelected: (trackId: string | null) => void;
  onSave: (experience: DeathExperience) => void;
  onLoad: () => void;
  onLoadPreset: (presetId: string) => void;
  onAddModule: (moduleId: string) => void;
  onToggleFullscreenPreview: () => void;
}

export class StudioEditorUI {
  public container: HTMLElement;
  public isVisible: boolean = true;
  public isMinimized: boolean = false;

  private registry: ModuleRegistry;
  private events: StudioEditorEvents;
  private experience: DeathExperience;
  private selectedTrackId: string | null = null;
  private currentTimeMs: number = 0;
  private isPaused: boolean = false;
  private currentSpeed: number = 1.0;
  private speeds: number[] = [0.25, 0.5, 1.0, 2.0];

  // Zoom scale: pixels per second
  private pxPerSec: number = 160;

  // DOM Elements
  private playheadEl!: HTMLElement;
  private timeLabelEl!: HTMLElement;
  private trackListEl!: HTMLElement;
  private timelineLanesEl!: HTMLElement;
  private inspectorEl!: HTMLElement;
  private playPauseBtn!: HTMLElement;

  constructor(experience: DeathExperience, registry: ModuleRegistry, events: StudioEditorEvents) {
    this.experience = experience;
    this.registry = registry;
    this.events = events;

    const el = document.createElement("div");
    el.id = "death-experience-studio-panel";
    el.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 320px;
      z-index: 10000;
      background: rgba(7, 11, 20, 0.96);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(16, 185, 129, 0.35);
      box-shadow: 0 -10px 40px rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #e2e8f0;
      user-select: none;
      pointer-events: auto;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    document.body.appendChild(el);
    this.container = el;

    this.render();
    window.addEventListener("keydown", this.handleKeyDown);
  }

  public setExperience(exp: DeathExperience): void {
    this.experience = exp;
    this.selectedTrackId = null;
    this.render();
  }

  public getExperience(): DeathExperience {
    return this.experience;
  }

  public updatePlayhead(timeMs: number): void {
    this.currentTimeMs = timeMs;
    const durSec = (this.experience.duration / 1000).toFixed(1);
    const curSec = (timeMs / 1000).toFixed(2);

    if (this.timeLabelEl) {
      this.timeLabelEl.textContent = `${curSec}s / ${durSec}s`;
    }

    if (this.playheadEl) {
      const leftPx = (timeMs / 1000) * this.pxPerSec;
      this.playheadEl.style.transform = `translateX(${leftPx}px)`;
    }
  }

  public updatePlayPauseState(paused: boolean): void {
    this.isPaused = paused;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = paused ? "▶ Play" : "⏸ Pause";
      this.playPauseBtn.style.background = paused ? "#f59e0b" : "#334155";
    }
  }

  public toggleMinimize(): boolean {
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.container.style.transform = "translateY(calc(100% - 36px))";
    } else {
      this.container.style.transform = "translateY(0)";
    }
    return this.isMinimized;
  }

  public toggleVisibility(): boolean {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? "flex" : "none";
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

    // F = Fullscreen preview toggle
    if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      this.toggleMinimize();
      this.events.onToggleFullscreenPreview();
    }
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  public render(): void {
    const categoryColors: Record<string, string> = {
      camera: "#3b82f6",
      character: "#f59e0b",
      effect: "#8b5cf6",
      hud: "#10b981",
      audio: "#ec4899",
      transition: "#64748b",
    };

    this.container.innerHTML = `
      <!-- 1. STUDIO HEADER TOOLBAR -->
      <div style="height:36px; background:#0b111e; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; padding:0 14px; font-size:11px; flex-shrink:0;">
        <!-- Left: Studio Badge & Preset Loader -->
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="background:#10b981; color:#030712; font-weight:900; font-size:10px; padding:2px 6px; border-radius:4px; letter-spacing:0.08em;">
              STUDIO
            </span>
            <span style="font-weight:800; color:#fff; font-size:12px; letter-spacing:0.04em;">DEATH EXPERIENCE COMPOSER</span>
          </div>

          <span style="color:#334155;">|</span>

          <!-- Preset Selector -->
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:#94a3b8; font-size:10px;">PRESET:</span>
            <select id="studio-preset-select" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; border-radius:4px; padding:2px 8px; font-size:11px; font-weight:bold; cursor:pointer;">
              <option value="preset_v01_tactical">V01 — Tactical Shooter</option>
              <option value="preset_v02_battle_royale">V02 — Battle Royale Pop</option>
              <option value="preset_v04_cyberpunk">V04 — Cyberpunk System Failure</option>
              <option value="preset_v16_viper_signature">V16 — VIPER.IO Signature</option>
              <option value="preset_mashup_a">Mashup A — Tactical + Cyber + Pop</option>
              <option value="preset_mashup_b">Mashup B — Comedic Voxel + Glitch</option>
            </select>
          </div>

          <!-- Add Module Button -->
          <button id="studio-btn-add-module" style="background:#0284c7; color:#fff; border:none; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">
            ➕ Añadir Módulo
          </button>
        </div>

        <!-- Center: Playback Transport -->
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="studio-btn-playpause" style="background:${this.isPaused ? "#f59e0b" : "#334155"}; color:#fff; border:none; padding:3px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">
            ${this.isPaused ? "▶ Play" : "⏸ Pause"}
          </button>
          <button id="studio-btn-replay" title="Replay" style="background:#334155; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-weight:bold; cursor:pointer;">
            🔄
          </button>
          <span id="studio-time-label" style="font-family:monospace; font-size:11px; color:#94a3b8; min-width:85px; text-align:center;">
            0.00s / ${(this.experience.duration / 1000).toFixed(1)}s
          </span>
          <button id="studio-btn-speed" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:2px 6px; border-radius:4px; font-weight:bold; cursor:pointer;">
            ⚡ ${this.currentSpeed}x
          </button>
        </div>

        <!-- Right: Actions & Minimize -->
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="studio-btn-save" title="Guardar composición como JSON" style="background:#15803d; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">
            💾 Guardar
          </button>
          <button id="studio-btn-load" title="Cargar archivo JSON" style="background:#4338ca; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">
            📂 Cargar
          </button>
          <button id="studio-btn-preview" title="Previsualización completa (Tecla F)" style="background:#334155; color:#cbd5e1; border:none; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">
            👁️ Fullscreen [F]
          </button>
          <button id="studio-btn-minimize" title="Minimizar panel" style="background:transparent; color:#94a3b8; border:none; font-size:14px; cursor:pointer; padding:0 4px;">
            _
          </button>
        </div>
      </div>

      <!-- 2. MAIN WORKSPACE (Track List | Timeline Lanes | Property Inspector) -->
      <div style="display:flex; flex:1; overflow:hidden;">
        <!-- Left: Track Headers (width 220px) -->
        <div id="studio-track-list" style="width:220px; background:#090d16; border-right:1px solid #1e293b; overflow-y:auto; flex-shrink:0;">
          <!-- Track Header rows injected dynamically -->
        </div>

        <!-- Center: Multi-track Timeline Area -->
        <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#070a12; position:relative;">
          <!-- Timeline Ruler -->
          <div id="studio-ruler" style="height:24px; background:#0c121e; border-bottom:1px solid #1e293b; position:relative; overflow:hidden; cursor:pointer;">
            <!-- Millisecond markers injected dynamically -->
          </div>

          <!-- Timeline Lanes Container (Horizontally Scrollable) -->
          <div id="studio-lanes-scroll" style="flex:1; overflow-x:auto; overflow-y:auto; position:relative;">
            <div id="studio-lanes" style="position:relative; min-height:100%; width:${(this.experience.duration / 1000) * this.pxPerSec + 100}px;">
              <!-- Playhead Red Line -->
              <div id="studio-playhead" style="position:absolute; top:0; bottom:0; width:2px; background:#ef4444; z-index:20; pointer-events:none; transform:translateX(0);">
                <div style="width:10px; height:10px; background:#ef4444; clip-path:polygon(50% 100%, 0 0, 100% 0); margin-left:-4px;"></div>
              </div>

              <!-- Track Blocks injected dynamically -->
            </div>
          </div>
        </div>

        <!-- Right: Property Inspector (width 280px) -->
        <div id="studio-inspector" style="width:280px; background:#090d16; border-left:1px solid #1e293b; overflow-y:auto; padding:12px; box-sizing:border-box; flex-shrink:0;">
          <!-- Property Inspector content injected dynamically -->
        </div>
      </div>
    `;

    // Cache elements
    this.playheadEl = this.container.querySelector("#studio-playhead") as HTMLElement;
    this.timeLabelEl = this.container.querySelector("#studio-time-label") as HTMLElement;
    this.trackListEl = this.container.querySelector("#studio-track-list") as HTMLElement;
    this.timelineLanesEl = this.container.querySelector("#studio-lanes") as HTMLElement;
    this.inspectorEl = this.container.querySelector("#studio-inspector") as HTMLElement;
    this.playPauseBtn = this.container.querySelector("#studio-btn-playpause") as HTMLElement;

    // Hook listeners
    this.bindToolbarEvents();
    this.renderRuler();
    this.renderTracks(categoryColors);
    this.renderInspector();
  }

  // ---------------------------------------------------------------------------
  // Toolbar Listeners
  // ---------------------------------------------------------------------------

  private bindToolbarEvents(): void {
    const selPreset = this.container.querySelector("#studio-preset-select") as HTMLSelectElement;
    if (selPreset) {
      selPreset.value = this.experience.id;
      selPreset.onchange = () => {
        this.events.onLoadPreset(selPreset.value);
      };
    }

    const btnAdd = this.container.querySelector("#studio-btn-add-module") as HTMLButtonElement;
    if (btnAdd) {
      btnAdd.onclick = () => this.showModuleLibraryModal();
    }

    if (this.playPauseBtn) {
      this.playPauseBtn.onclick = () => {
        this.isPaused = !this.isPaused;
        this.events.onPlayPause();
        this.updatePlayPauseState(this.isPaused);
      };
    }

    const btnReplay = this.container.querySelector("#studio-btn-replay") as HTMLButtonElement;
    if (btnReplay) {
      btnReplay.onclick = () => {
        this.events.onSeek(0);
      };
    }

    const btnSpeed = this.container.querySelector("#studio-btn-speed") as HTMLButtonElement;
    if (btnSpeed) {
      btnSpeed.onclick = () => {
        const nextIdx = (this.speeds.indexOf(this.currentSpeed) + 1) % this.speeds.length;
        this.currentSpeed = this.speeds[nextIdx];
        this.events.onSetSpeed(this.currentSpeed);
        btnSpeed.textContent = `⚡ ${this.currentSpeed}x`;
      };
    }

    const btnSave = this.container.querySelector("#studio-btn-save") as HTMLButtonElement;
    if (btnSave) {
      btnSave.onclick = () => this.events.onSave(this.experience);
    }

    const btnLoad = this.container.querySelector("#studio-btn-load") as HTMLButtonElement;
    if (btnLoad) {
      btnLoad.onclick = () => this.events.onLoad();
    }

    const btnPreview = this.container.querySelector("#studio-btn-preview") as HTMLButtonElement;
    if (btnPreview) {
      btnPreview.onclick = () => {
        this.toggleMinimize();
        this.events.onToggleFullscreenPreview();
      };
    }

    const btnMin = this.container.querySelector("#studio-btn-minimize") as HTMLButtonElement;
    if (btnMin) {
      btnMin.onclick = () => this.toggleMinimize();
    }

    // Ruler scrubbing
    const ruler = this.container.querySelector("#studio-ruler") as HTMLElement;
    if (ruler) {
      ruler.onclick = (e) => {
        const rect = ruler.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const timeMs = Math.max(0, Math.min(this.experience.duration, (clickX / this.pxPerSec) * 1000));
        this.events.onSeek(timeMs);
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Time Ruler Rendering
  // ---------------------------------------------------------------------------

  private renderRuler(): void {
    const ruler = this.container.querySelector("#studio-ruler") as HTMLElement;
    if (!ruler) return;

    ruler.innerHTML = "";
    const totalSec = Math.ceil(this.experience.duration / 1000);

    for (let s = 0; s <= totalSec; s++) {
      const mark = document.createElement("div");
      mark.style.cssText = `
        position: absolute;
        left: ${s * this.pxPerSec}px;
        top: 0;
        bottom: 0;
        border-left: 1px solid rgba(255,255,255,0.2);
        padding-left: 4px;
        font-family: monospace;
        font-size: 9px;
        color: #64748b;
        line-height: 22px;
      `;
      mark.textContent = `${s}.0s`;
      ruler.appendChild(mark);
    }
  }

  // ---------------------------------------------------------------------------
  // Tracks & Lanes Rendering
  // ---------------------------------------------------------------------------

  private renderTracks(colors: Record<string, string>): void {
    if (!this.trackListEl || !this.timelineLanesEl) return;

    this.trackListEl.innerHTML = "";
    const lanesContainer = this.timelineLanesEl;

    // Clear lanes (keeping playhead)
    const playhead = this.playheadEl;
    lanesContainer.innerHTML = "";
    lanesContainer.appendChild(playhead);

    const laneHeight = 34;

    this.experience.tracks.forEach((track, idx) => {
      const mod = this.registry.get(track.moduleId);
      const cat = mod?.category || "effect";
      const catColor = colors[cat] || "#8b5cf6";
      const isSelected = this.selectedTrackId === track.id;

      // 1. Left Track Header
      const header = document.createElement("div");
      header.style.cssText = `
        height: ${laneHeight}px;
        border-bottom: 1px solid #1e293b;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        font-size: 11px;
        background: ${isSelected ? "rgba(16, 185, 129, 0.15)" : "transparent"};
        cursor: pointer;
        border-left: 3px solid ${catColor};
      `;

      header.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
          <span class="track-eye" title="Habilitar/Deshabilitar" style="font-size:12px; cursor:pointer; opacity:${track.enabled ? "1" : "0.35"};">
            ${track.enabled ? "👁️" : "🕶️"}
          </span>
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px; font-weight:${isSelected ? "bold" : "normal"}; color:${isSelected ? "#fff" : "#cbd5e1"};">
            ${track.name}
          </span>
        </div>
        <button class="track-del" title="Eliminar track" style="background:transparent; border:none; color:#ef4444; font-size:11px; cursor:pointer; padding:2px 4px;">
          ✕
        </button>
      `;

      header.onclick = (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("track-eye")) {
          track.enabled = !track.enabled;
          this.events.onExperienceChanged(this.experience);
          this.render();
          return;
        }
        if (target.classList.contains("track-del")) {
          this.experience.tracks.splice(idx, 1);
          if (this.selectedTrackId === track.id) this.selectedTrackId = null;
          this.events.onExperienceChanged(this.experience);
          this.render();
          return;
        }

        this.selectedTrackId = track.id;
        this.events.onTrackSelected(track.id);
        this.render();
      };

      this.trackListEl.appendChild(header);

      // 2. Center Timeline Lane
      const lane = document.createElement("div");
      lane.style.cssText = `
        height: ${laneHeight}px;
        border-bottom: 1px solid #111827;
        position: relative;
      `;

      const blockLeft = (track.startTime / 1000) * this.pxPerSec;
      const blockWidth = Math.max(30, (track.duration / 1000) * this.pxPerSec);

      const block = document.createElement("div");
      block.style.cssText = `
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: ${blockLeft}px;
        width: ${blockWidth}px;
        background: ${track.enabled ? catColor : "#334155"};
        opacity: ${track.enabled ? (isSelected ? "1" : "0.75") : "0.4"};
        border: ${isSelected ? "2px solid #ffffff" : `1px solid ${catColor}`};
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: bold;
        color: #000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        box-shadow: ${isSelected ? `0 0 10px ${catColor}` : "none"};
      `;

      block.innerHTML = `
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${mod?.name || track.name}
        </span>
        <span style="font-size:9px; font-family:monospace; opacity:0.8;">
          ${(track.duration / 1000).toFixed(1)}s
        </span>
      `;

      // Dragging track start time
      let isDragging = false;
      let startMouseX = 0;
      let initialStartMs = track.startTime;

      block.onmousedown = (e) => {
        e.stopPropagation();
        this.selectedTrackId = track.id;
        this.events.onTrackSelected(track.id);
        this.render();

        isDragging = true;
        startMouseX = e.clientX;
        initialStartMs = track.startTime;

        const onMouseMove = (moveEv: MouseEvent) => {
          if (!isDragging) return;
          const deltaX = moveEv.clientX - startMouseX;
          const deltaMs = (deltaX / this.pxPerSec) * 1000;
          track.startTime = Math.max(0, Math.round(initialStartMs + deltaMs));
          block.style.left = `${(track.startTime / 1000) * this.pxPerSec}px`;
        };

        const onMouseUp = () => {
          if (isDragging) {
            isDragging = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            this.events.onExperienceChanged(this.experience);
            this.render();
          }
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      };

      lane.appendChild(block);
      lanesContainer.appendChild(lane);
    });
  }

  // ---------------------------------------------------------------------------
  // Property Inspector Rendering
  // ---------------------------------------------------------------------------

  private renderInspector(): void {
    if (!this.inspectorEl) return;

    const track = this.experience.tracks.find((t) => t.id === this.selectedTrackId);

    if (!track) {
      // General Experience Inspector
      this.inspectorEl.innerHTML = `
        <div style="font-size:12px; font-weight:bold; color:#10b981; margin-bottom:10px; border-bottom:1px solid #1e293b; padding-bottom:6px;">
          ⚙️ PROPIEDADES DE EXPERIENCIA
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:11px;">
          <div>
            <label style="color:#94a3b8; display:block; margin-bottom:2px;">Nombre:</label>
            <input id="exp-name" type="text" value="${this.experience.name}" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:4px 6px; border-radius:4px; font-size:11px;">
          </div>
          <div>
            <label style="color:#94a3b8; display:block; margin-bottom:2px;">Duración Total (ms):</label>
            <input id="exp-duration" type="number" step="100" value="${this.experience.duration}" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:4px 6px; border-radius:4px; font-size:11px;">
          </div>
          <div>
            <label style="color:#94a3b8; display:block; margin-bottom:2px;">Partículas de Fondo:</label>
            <select id="exp-particles" style="width:100%; background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:4px 6px; border-radius:4px; font-size:11px;">
              <option value="none" ${this.experience.scene.particles === "none" ? "selected" : ""}>Ninguna</option>
              <option value="confetti" ${this.experience.scene.particles === "confetti" ? "selected" : ""}>Confeti Pop</option>
              <option value="sparks" ${this.experience.scene.particles === "sparks" ? "selected" : ""}>Chispas Venom</option>
              <option value="matrix" ${this.experience.scene.particles === "matrix" ? "selected" : ""}>Matriz Digital</option>
              <option value="embers" ${this.experience.scene.particles === "embers" ? "selected" : ""}>Brasas Oscuras</option>
            </select>
          </div>
          <div style="margin-top:14px; font-size:10px; color:#64748b; line-height:1.4;">
            💡 Selecciona cualquier pista en el timeline para editar sus parámetros individuales y keyframes.
          </div>
        </div>
      `;

      const inputName = this.inspectorEl.querySelector("#exp-name") as HTMLInputElement;
      if (inputName) {
        inputName.onchange = () => {
          this.experience.name = inputName.value;
          this.events.onExperienceChanged(this.experience);
        };
      }

      const inputDur = this.inspectorEl.querySelector("#exp-duration") as HTMLInputElement;
      if (inputDur) {
        inputDur.onchange = () => {
          this.experience.duration = Math.max(500, parseInt(inputDur.value, 10));
          this.events.onExperienceChanged(this.experience);
          this.render();
        };
      }

      const selectPart = this.inspectorEl.querySelector("#exp-particles") as HTMLSelectElement;
      if (selectPart) {
        selectPart.onchange = () => {
          this.experience.scene.particles = selectPart.value as any;
          this.events.onExperienceChanged(this.experience);
        };
      }

      return;
    }

    // Track Inspector
    const mod = this.registry.get(track.moduleId);
    const schema = mod?.paramSchema || [];

    this.inspectorEl.innerHTML = `
      <div style="font-size:12px; font-weight:bold; color:#38bdf8; margin-bottom:10px; border-bottom:1px solid #1e293b; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <span>🎛️ PISTA: ${track.name}</span>
        <span style="font-size:10px; color:#94a3b8;">[${mod?.category.toUpperCase()}]</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; font-size:11px;">
        <!-- Timing -->
        <div style="display:flex; gap:8px;">
          <div style="flex:1;">
            <label style="color:#94a3b8; font-size:10px;">Inicio (ms):</label>
            <input id="track-start" type="number" step="50" value="${track.startTime}" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:3px 5px; border-radius:4px; font-size:11px;">
          </div>
          <div style="flex:1;">
            <label style="color:#94a3b8; font-size:10px;">Duración (ms):</label>
            <input id="track-duration" type="number" step="50" value="${track.duration}" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:3px 5px; border-radius:4px; font-size:11px;">
          </div>
        </div>

        <div style="border-top:1px solid #1e293b; margin:4px 0;"></div>

        <!-- Dynamic Params from Schema -->
        <div id="track-params-form" style="display:flex; flex-direction:column; gap:8px;">
          ${schema.map((p) => this.renderParamInput(p, track.params[p.name])).join("")}
        </div>
      </div>
    `;

    // Hook Timing Listeners
    const inputStart = this.inspectorEl.querySelector("#track-start") as HTMLInputElement;
    if (inputStart) {
      inputStart.onchange = () => {
        track.startTime = Math.max(0, parseInt(inputStart.value, 10));
        this.events.onExperienceChanged(this.experience);
        this.render();
      };
    }

    const inputDur = this.inspectorEl.querySelector("#track-duration") as HTMLInputElement;
    if (inputDur) {
      inputDur.onchange = () => {
        track.duration = Math.max(100, parseInt(inputDur.value, 10));
        this.events.onExperienceChanged(this.experience);
        this.render();
      };
    }

    // Hook Param Inputs
    schema.forEach((p) => {
      const el = this.inspectorEl.querySelector(`#param-${p.name}`) as HTMLInputElement | HTMLSelectElement;
      if (el) {
        el.onchange = () => {
          let val: any = el.value;
          if (p.type === "number") val = parseFloat(el.value);
          if (p.type === "color") val = parseInt(el.value.replace("#", "0x"), 16);
          track.params[p.name] = val;
          this.events.onExperienceChanged(this.experience);
        };
      }
    });
  }

  private renderParamInput(schema: ParamSchema, currentVal: any): string {
    const val = currentVal !== undefined ? currentVal : schema.default;

    if (schema.type === "number") {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <label style="color:#cbd5e1; font-size:10px;">${schema.label}:</label>
            <span style="font-family:monospace; color:#38bdf8; font-size:10px;">${val}</span>
          </div>
          <input id="param-${schema.name}" type="range" min="${schema.min ?? 0}" max="${schema.max ?? 5000}" step="${schema.step ?? 1}" value="${val}" style="width:100%; accent-color:#10b981;">
        </div>
      `;
    }

    if (schema.type === "color") {
      const hexStr = typeof val === "number" ? `#${val.toString(16).padStart(6, "0")}` : String(val);
      return `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="color:#cbd5e1; font-size:10px;">${schema.label}:</label>
          <input id="param-${schema.name}" type="color" value="${hexStr}" style="background:none; border:none; width:36px; height:24px; cursor:pointer;">
        </div>
      `;
    }

    return `
      <div>
        <label style="color:#cbd5e1; font-size:10px; display:block; margin-bottom:2px;">${schema.label}:</label>
        <input id="param-${schema.name}" type="text" value="${val}" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:3px 6px; border-radius:4px; font-size:11px;">
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Module Library Modal
  // ---------------------------------------------------------------------------

  public showModuleLibraryModal(): void {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modules = this.registry.getAll();
    const categories = ["camera", "character", "effect", "hud", "audio"];

    modal.innerHTML = `
      <div style="background:#0f172a; border:1px solid #10b981; border-radius:12px; width:720px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.9);">
        <div style="padding:14px 20px; background:#1e293b; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155;">
          <div style="font-weight:900; color:#fff; font-size:14px; letter-spacing:0.04em;">
            CATÁLOGO DE MÓDULOS REUTILIZABLES
          </div>
          <button id="modal-close" style="background:transparent; border:none; color:#ef4444; font-size:16px; font-weight:bold; cursor:pointer;">✕</button>
        </div>

        <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
          ${categories.map((cat) => `
            <div>
              <div style="font-size:11px; font-weight:800; color:#38bdf8; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #1e293b; padding-bottom:4px;">
                ${cat.toUpperCase()} (${modules.filter((m) => m.category === cat).length})
              </div>
              <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
                ${modules.filter((m) => m.category === cat).map((mod) => `
                  <div class="module-card" data-id="${mod.id}" style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:10px 14px; cursor:pointer; transition:all 0.15s ease;">
                    <div style="font-weight:bold; color:#fff; font-size:12px;">${mod.name}</div>
                    <div style="font-size:10px; color:#94a3b8; margin-top:4px; line-height:1.3;">${mod.description}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const btnClose = modal.querySelector("#modal-close") as HTMLButtonElement;
    if (btnClose) btnClose.onclick = () => modal.remove();

    const cards = modal.querySelectorAll(".module-card");
    cards.forEach((c) => {
      (c as HTMLElement).onclick = () => {
        const modId = c.getAttribute("data-id");
        if (modId) {
          this.events.onAddModule(modId);
          modal.remove();
        }
      };
    });
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.container.remove();
  }
}

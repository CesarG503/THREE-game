import { DeathLabScene } from "./DeathLabScene";
import { DeathLabAudio } from "./DeathLabAudio";
import { DEATH_SCENARIOS, type DeathScenario } from "./DeathLabScenarios";
import { createAllVariants, type DeathVariant } from "./variants";
import { DeathLabUI } from "./DeathLabUI";
import type { Router } from "../../routing/Router";
import {
  createDefaultModuleRegistry,
  CompositionEngine,
  StudioEditorUI,
  createV01TacticalPreset,
  createV02BattleRoyalePreset,
  createV04CyberpunkPreset,
  createV16ViperSignaturePreset,
  createMashupAPreset,
  createMashupBPreset,
  type DeathExperience,
  type ModuleRegistry,
} from "./studio";

export class DeathLabApp {
  public scene: DeathLabScene;
  public audio: DeathLabAudio;
  public variants: DeathVariant[];
  public currentVariantIndex: number = 0;
  public currentScenario: DeathScenario;
  public overlayContainer: HTMLElement;
  public devUI: DeathLabUI;
  public router: Router | null;
  private isSpectator: boolean = false;
  private spectatorPerspective: "third_person" | "first_person" = "third_person";
  private spectatorPeers: string[] = ["FoxLeader_01", "TankerDave_99", "SniperElena", "SupportSam"];
  private currentPeerIndex: number = 0;

  // Studio Composable Engine
  public studioRegistry: ModuleRegistry;
  public compositionEngine: CompositionEngine;
  public studioUI: StudioEditorUI | null = null;
  public isStudioActive: boolean = false;
  public currentExperience: DeathExperience;
  private studioInterval: number | null = null;

  constructor(router?: Router) {
    this.router = router || null;

    // Hide any lingering lobby or game UI
    const hiddenElements = [
      "lobby-screen", "chat-container", "construction-menu", "object-inspector",
      "inventory-container", "settings-panel", "fuego-counter", "crosshair"
    ];
    hiddenElements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    // 1. Initialize 3D Three.js Scene
    this.scene = new DeathLabScene("death-lab-3d-viewport");

    // 2. Initialize Web Audio Synthesizer
    this.audio = new DeathLabAudio();

    // 3. Initialize Variants and Scenarios
    this.variants = createAllVariants();
    this.currentScenario = DEATH_SCENARIOS[0]; // Start with Scenario 1: Rifle

    // 4. Create Overlay Layer for AAA In-Game HUDs
    let overlay = document.getElementById("death-lab-hud-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "death-lab-hud-overlay";
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 100;
        pointer-events: none;
        overflow: hidden;
      `;
      document.body.appendChild(overlay);
    }
    this.overlayContainer = overlay;

    // 5. Initialize Studio Composable Engine & Default Preset
    this.studioRegistry = createDefaultModuleRegistry();
    this.compositionEngine = new CompositionEngine(this.studioRegistry);
    this.currentExperience = createV01TacticalPreset();

    // 6. Initialize Dev Control Toolbar with Anime.js 4 Transport
    this.devUI = new DeathLabUI(this.variants, {
      onSelectVariant: (idx) => this.selectVariant(idx),
      onSelectScenario: (scenarioId) => this.selectScenario(scenarioId),
      onReplay: () => this.replayActiveVariant(),
      onPlayPause: () => this.togglePlayPause(),
      onSeek: (progress) => this.seekActiveVariant(progress),
      onSetSpeed: (speed) => this.setSpeedActiveVariant(speed),
      onReset: () => this.resetActiveVariant(),
      onToggleAnime: () => this.toggleAnimeActiveVariant(),
      onToggleSpectator: () => this.toggleSpectator(),
      onTogglePerspective: () => this.togglePerspective(),
      onCycleTarget: (delta) => this.cycleSpectatorTarget(delta),
      onRespawn: () => this.simulateRespawn(),
      onToggleMute: () => this.audio.toggleMute(),
      onToggleReducedMotion: () => {},
      onToggleHUD: () => this.toggleHUD(),
      onToggleParticles: () => this.scene.toggleParticles(),
      onToggleStudio: () => this.toggleStudio(),
    });

    // Render the initial variant
    this.renderCurrentVariant();
    (window as any).__DEATH_LAB_APP__ = this;
  }

  public selectVariant(index: number) {
    if (this.isStudioActive) {
      this.toggleStudio();
    }
    if (index < 0 || index >= this.variants.length) return;
    this.variants[this.currentVariantIndex]?.cleanup();
    this.currentVariantIndex = index;
    this.isSpectator = false;
    this.scene.resetToDeathCamera();
    this.renderCurrentVariant();
  }

  public selectScenario(scenarioId: string) {
    const scn = DEATH_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scn) return;
    this.currentScenario = scn;
    if (this.isStudioActive) {
      this.executeStudioExperience();
    } else {
      this.renderCurrentVariant();
    }
  }

  public replayActiveVariant() {
    this.isSpectator = false;
    this.scene.resetToDeathCamera();
    if (this.isStudioActive) {
      this.executeStudioExperience();
    } else {
      this.renderCurrentVariant();
    }
  }

  public togglePlayPause() {
    if (this.isStudioActive) {
      if (this.compositionEngine.isPaused()) {
        this.compositionEngine.play();
        this.devUI.updatePlayPauseState(false);
      } else {
        this.compositionEngine.pause();
        this.devUI.updatePlayPauseState(true);
      }
      return;
    }

    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    if (active.isPaused()) {
      active.play();
      this.devUI.updatePlayPauseState(false);
    } else {
      active.pause();
      this.devUI.updatePlayPauseState(true);
    }
  }

  public seekActiveVariant(progress: number) {
    if (this.isStudioActive) {
      const dur = this.compositionEngine.getDuration();
      if (dur > 0) {
        this.compositionEngine.seek(progress * dur);
      }
      return;
    }

    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    const dur = active.getDuration();
    if (dur > 0) {
      active.seek(progress * dur);
    }
  }

  public setSpeedActiveVariant(speed: number) {
    if (this.isStudioActive) {
      this.compositionEngine.setPlaybackRate(speed);
      return;
    }
    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    active.setPlaybackRate(speed);
  }

  public resetActiveVariant() {
    if (this.isStudioActive) {
      this.compositionEngine.revert();
      this.scene.resetToDeathCamera();
      this.devUI.updatePlayPauseState(false);
      return;
    }
    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    active.revert();
    this.scene.resetToDeathCamera();
    this.devUI.updatePlayPauseState(false);
  }

  public toggleStudio(): boolean {
    this.isStudioActive = !this.isStudioActive;

    if (this.isStudioActive) {
      this.variants[this.currentVariantIndex]?.cleanup();

      if (!this.studioUI) {
        this.studioUI = new StudioEditorUI(this.currentExperience, this.studioRegistry, {
          onExperienceChanged: (exp) => {
            this.currentExperience = exp;
            this.executeStudioExperience();
          },
          onPlayPause: () => {
            if (this.compositionEngine.isPaused()) {
              this.compositionEngine.play();
            } else {
              this.compositionEngine.pause();
            }
          },
          onSeek: (timeMs) => {
            this.compositionEngine.seek(timeMs);
          },
          onSetSpeed: (speed) => {
            this.compositionEngine.setPlaybackRate(speed);
          },
          onTrackSelected: () => {},
          onSave: (exp) => {
            const json = CompositionEngine.serializeExperience(exp);
            try {
              localStorage.setItem(`viper_death_exp_${exp.id}`, json);
              localStorage.setItem("viper_death_exp_last", json);
              alert(`¡Experiencia "${exp.name}" guardada con éxito!`);
            } catch (e) {
              console.log("[Studio] Saved JSON:", json);
            }
          },
          onLoad: () => {
            const saved = localStorage.getItem("viper_death_exp_last");
            if (saved) {
              try {
                const exp = CompositionEngine.deserializeExperience(saved);
                this.currentExperience = exp;
                this.studioUI?.setExperience(exp);
                this.executeStudioExperience();
                alert(`¡Experiencia "${exp.name}" cargada con éxito!`);
              } catch (e) {
                alert("Error al deserializar la experiencia guardada.");
              }
            } else {
              alert("No hay composiciones personalizadas guardadas aún.");
            }
          },
          onLoadPreset: (presetId) => {
            const presets: Record<string, () => DeathExperience> = {
              preset_v01_tactical: createV01TacticalPreset,
              preset_v02_battle_royale: createV02BattleRoyalePreset,
              preset_v04_cyberpunk: createV04CyberpunkPreset,
              preset_v16_viper_signature: createV16ViperSignaturePreset,
              preset_mashup_a: createMashupAPreset,
              preset_mashup_b: createMashupBPreset,
            };
            const factory = presets[presetId] || createV01TacticalPreset;
            this.currentExperience = factory();
            this.studioUI?.setExperience(this.currentExperience);
            this.executeStudioExperience();
          },
          onAddModule: (modId) => {
            const mod = this.studioRegistry.get(modId);
            if (!mod) return;
            const newTrack: AnimationTrack = {
              id: `track_${mod.id}_${Date.now().toString().slice(-4)}`,
              name: mod.name,
              moduleId: mod.id,
              enabled: true,
              startTime: Math.round(this.compositionEngine.getCurrentTime()),
              duration: 1200,
              params: { ...mod.defaultParams },
              keyframes: [],
            };
            this.currentExperience.tracks.push(newTrack);
            this.studioUI?.render();
            this.executeStudioExperience();
          },
          onToggleFullscreenPreview: () => {},
        });

        if (!this.studioInterval) {
          this.studioInterval = window.setInterval(() => {
            if (this.isStudioActive && this.studioUI) {
              this.studioUI.updatePlayhead(this.compositionEngine.getCurrentTime());
              this.studioUI.updatePlayPauseState(this.compositionEngine.isPaused());
            }
          }, 50);
        }
      }

      this.studioUI.container.style.display = "flex";
      this.executeStudioExperience();
    } else {
      if (this.studioUI) {
        this.studioUI.container.style.display = "none";
      }
      this.compositionEngine.cleanup();
      this.renderCurrentVariant();
    }

    return this.isStudioActive;
  }

  public executeStudioExperience(): void {
    this.scene.resetToDeathCamera();
    this.compositionEngine.execute(
      this.currentExperience,
      this.scene,
      this.audio,
      this.overlayContainer,
      this.currentScenario,
      true
    );
  }

  public toggleAnimeActiveVariant() {
    const active = this.variants[this.currentVariantIndex];
    if (!active) return;
    active.toggleAnime(!active.animeEnabled);
  }

  public toggleSpectator() {
    this.isSpectator = !this.isSpectator;
    if (this.isSpectator) {
      this.scene.transitionToSpectator(this.spectatorPerspective);
      const activeVariant = this.variants[this.currentVariantIndex];
      const peer = this.spectatorPeers[this.currentPeerIndex];
      if (activeVariant.onSpectatorTransition) {
        activeVariant.onSpectatorTransition(peer, this.spectatorPerspective);
      }
    } else {
      this.scene.resetToDeathCamera();
      this.renderCurrentVariant();
    }
  }

  public togglePerspective() {
    this.spectatorPerspective = this.spectatorPerspective === "third_person" ? "first_person" : "third_person";
    if (this.isSpectator) {
      this.scene.transitionToSpectator(this.spectatorPerspective);
      const activeVariant = this.variants[this.currentVariantIndex];
      const peer = this.spectatorPeers[this.currentPeerIndex];
      if (activeVariant.onSpectatorTransition) {
        activeVariant.onSpectatorTransition(peer, this.spectatorPerspective);
      }
    }
  }

  public cycleSpectatorTarget(delta: number) {
    this.currentPeerIndex = (this.currentPeerIndex + delta + this.spectatorPeers.length) % this.spectatorPeers.length;
    if (this.isSpectator) {
      const activeVariant = this.variants[this.currentVariantIndex];
      const peer = this.spectatorPeers[this.currentPeerIndex];
      if (activeVariant.onSpectatorTransition) {
        activeVariant.onSpectatorTransition(peer, this.spectatorPerspective);
      }
    }
  }

  public simulateRespawn() {
    this.isSpectator = false;
    this.scene.resetToDeathCamera();
    this.renderCurrentVariant();
  }

  public toggleHUD(): boolean {
    const isHidden = this.overlayContainer.style.display === "none";
    this.overlayContainer.style.display = isHidden ? "block" : "none";
    return isHidden;
  }

  private renderCurrentVariant() {
    this.overlayContainer.innerHTML = "";
    const variant = this.variants[this.currentVariantIndex];
    if (variant) {
      variant.render(this.overlayContainer, this.currentScenario, this.scene, this.audio);
    }
  }

  public dispose() {
    if (this.studioInterval !== null) {
      clearInterval(this.studioInterval);
      this.studioInterval = null;
    }
    this.compositionEngine.cleanup();
    this.studioUI?.dispose();
    this.variants[this.currentVariantIndex]?.cleanup();
    this.devUI.dispose();
    this.scene.dispose();
    this.overlayContainer.remove();
  }
}

let activeLab: DeathLabApp | null = null;

export function startDeathLab(router?: Router): () => void {
  if (activeLab) {
    activeLab.dispose();
    activeLab = null;
  }
  activeLab = new DeathLabApp(router);
  return () => {
    if (activeLab) {
      activeLab.dispose();
      activeLab = null;
    }
  };
}

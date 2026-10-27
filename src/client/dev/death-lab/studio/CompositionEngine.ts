/**
 * CompositionEngine.ts — Core runtime engine for composable death experiences.
 *
 * Translates declarative `DeathExperience` JSON data into an active Anime.js v4
 * timeline coordinating Three.js 3D objects, camera choreography, dynamic lighting,
 * procedural Web Audio, and DOM HUD elements.
 */

import { createTimeline, type Timeline } from "animejs";
import * as THREE from "three";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import { AnimeThreeAdapter } from "../AnimeThreeAdapter";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathExperience, AnimationTrack, SceneConfig } from "./DeathExperienceTypes";
import { ModuleRegistry, type ModuleContext } from "./ModuleRegistry";

export class CompositionEngine {
  public registry: ModuleRegistry;
  public adapter: AnimeThreeAdapter = new AnimeThreeAdapter();
  public timeline: Timeline | null = null;

  private currentExperience: DeathExperience | null = null;
  private cleanups: (() => void)[] = [];
  private playbackRate: number = 1.0;

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  /**
   * Builds and starts playback of a DeathExperience.
   */
  public execute(
    experience: DeathExperience,
    scene: DeathLabScene,
    audio: DeathLabAudio,
    container: HTMLElement,
    scenario: DeathScenario,
    autoplay: boolean = true
  ): Timeline {
    this.cleanup();
    this.currentExperience = experience;

    // 1. Setup Scene Environment
    this.applySceneConfig(experience.scene, scene);

    // 2. Clear HUD container
    container.innerHTML = "";

    // 3. Create Anime.js v4 Timeline
    const tl = createTimeline({
      autoplay,
    });
    this.timeline = tl;
    (tl as any).playbackRate = this.playbackRate;

    const ctx: ModuleContext = {
      timeline: tl,
      scene,
      audio,
      adapter: this.adapter,
      container,
      scenario,
    };

    // 4. Compute Effective Tracks with Conditional Overrides
    const effectiveTracks = this.resolveTracksWithConditions(experience, scenario);

    // 5. Apply Each Track Module to the Timeline
    for (const track of effectiveTracks) {
      if (!track.enabled) continue;

      const mod = this.registry.get(track.moduleId);
      if (!mod) {
        console.warn(`[CompositionEngine] Module not found: "${track.moduleId}" for track "${track.id}"`);
        continue;
      }

      const mergedParams = {
        ...mod.defaultParams,
        ...track.params,
      };

      try {
        const cleanupFn = mod.apply(ctx, mergedParams, track.keyframes || [], track.startTime, track.duration);
        if (typeof cleanupFn === "function") {
          this.cleanups.push(cleanupFn);
        }
      } catch (err) {
        console.error(`[CompositionEngine] Error applying module "${mod.id}" on track "${track.id}":`, err);
      }
    }

    return tl;
  }

  /**
   * Applies the static scene configuration (fog, lights, particles).
   */
  private applySceneConfig(config: SceneConfig, scene: DeathLabScene): void {
    if (config.background !== undefined) {
      scene.scene.background = new THREE.Color(config.background);
    }

    if (config.fog) {
      scene.scene.fog = new THREE.FogExp2(config.fog.color, config.fog.density);
    }

    if (config.ambientLight) {
      scene.ambientLight.color.setHex(config.ambientLight.color);
      scene.ambientLight.intensity = config.ambientLight.intensity;
    }

    if (config.directionalLight) {
      scene.dirLight.color.setHex(config.directionalLight.color);
      scene.dirLight.intensity = config.directionalLight.intensity;
    }

    if (config.accentLight) {
      scene.accentLight.color.setHex(config.accentLight.color);
      scene.accentLight.intensity = config.accentLight.intensity;
      if (config.accentLight.position) {
        scene.accentLight.position.set(...config.accentLight.position);
      }
    }

    if (config.particles) {
      scene.setParticles(config.particles);
    }
  }

  /**
   * Resolves conditions against the scenario and produces final track parameters.
   */
  private resolveTracksWithConditions(experience: DeathExperience, scenario: DeathScenario): AnimationTrack[] {
    const tracks: AnimationTrack[] = experience.tracks.map((t) => ({
      ...t,
      params: { ...t.params },
      keyframes: [...(t.keyframes || [])],
    }));

    if (!experience.conditions || experience.conditions.length === 0) {
      return tracks;
    }

    for (const cond of experience.conditions) {
      const scenarioVal = (scenario as any)[cond.property];
      let matches = false;

      switch (cond.operator) {
        case "eq":
          matches = scenarioVal === cond.value;
          break;
        case "neq":
          matches = scenarioVal !== cond.value;
          break;
        case "gt":
          matches = typeof scenarioVal === "number" && scenarioVal > Number(cond.value);
          break;
        case "lt":
          matches = typeof scenarioVal === "number" && scenarioVal < Number(cond.value);
          break;
        case "in":
          matches = Array.isArray(cond.value) && cond.value.includes(scenarioVal);
          break;
      }

      if (matches && cond.trackOverrides) {
        for (const override of cond.trackOverrides) {
          const targetTrack = tracks.find((t) => t.id === override.trackId);
          if (targetTrack) {
            targetTrack.params = {
              ...targetTrack.params,
              ...override.params,
            };
          }
        }
      }
    }

    return tracks;
  }

  // ---------------------------------------------------------------------------
  // Playback transport controls
  // ---------------------------------------------------------------------------

  public play(): void {
    this.timeline?.play();
  }

  public pause(): void {
    this.timeline?.pause();
  }

  public seek(timeMs: number): void {
    this.timeline?.seek(timeMs);
  }

  public setPlaybackRate(speed: number): void {
    this.playbackRate = speed;
    if (this.timeline) {
      (this.timeline as any).playbackRate = speed;
    }
  }

  public getDuration(): number {
    return this.timeline ? this.timeline.duration : (this.currentExperience?.duration ?? 0);
  }

  public getCurrentTime(): number {
    return this.timeline ? this.timeline.currentTime : 0;
  }

  public isPaused(): boolean {
    return this.timeline ? this.timeline.paused : true;
  }

  public revert(): void {
    if (this.timeline) {
      this.timeline.revert();
    }
    this.adapter.restoreAll();
  }

  public cleanup(): void {
    if (this.timeline) {
      try {
        this.timeline.pause();
        this.timeline.revert();
      } catch {}
      this.timeline = null;
    }

    for (const cleanupFn of this.cleanups) {
      try {
        cleanupFn();
      } catch (err) {
        console.warn("[CompositionEngine] Error during module cleanup:", err);
      }
    }
    this.cleanups = [];
    this.adapter.restoreAll();
  }

  public getCurrentExperience(): DeathExperience | null {
    return this.currentExperience;
  }

  // ---------------------------------------------------------------------------
  // Serialization & Validation
  // ---------------------------------------------------------------------------

  public static serializeExperience(exp: DeathExperience): string {
    return JSON.stringify(exp, null, 2);
  }

  public static deserializeExperience(json: string): DeathExperience {
    const parsed = JSON.parse(json);
    const validation = CompositionEngine.validateExperience(parsed);
    if (!validation.valid) {
      throw new Error(`[CompositionEngine] Invalid experience format:\n${validation.errors.join("\n")}`);
    }
    return parsed as DeathExperience;
  }

  public static validateExperience(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== "object") {
      return { valid: false, errors: ["Experience must be a non-null object"] };
    }

    const exp = data as Partial<DeathExperience>;

    if (!exp.id || typeof exp.id !== "string") errors.push("Missing or invalid 'id' string");
    if (typeof exp.version !== "number") errors.push("Missing or invalid 'version' number");
    if (!exp.name || typeof exp.name !== "string") errors.push("Missing or invalid 'name' string");
    if (!Array.isArray(exp.tracks)) errors.push("Missing or invalid 'tracks' array");

    if (Array.isArray(exp.tracks)) {
      exp.tracks.forEach((track, idx) => {
        if (!track.id) errors.push(`Track[${idx}] missing 'id'`);
        if (!track.moduleId) errors.push(`Track[${idx}] missing 'moduleId'`);
        if (typeof track.startTime !== "number") errors.push(`Track[${idx}] missing 'startTime' number`);
        if (typeof track.duration !== "number") errors.push(`Track[${idx}] missing 'duration' number`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public static cloneExperience(exp: DeathExperience): DeathExperience {
    return JSON.parse(JSON.stringify(exp));
  }
}

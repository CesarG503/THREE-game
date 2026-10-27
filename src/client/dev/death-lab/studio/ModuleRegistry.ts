/**
 * ModuleRegistry.ts — The composable module library system.
 *
 * Modules are the atomic building blocks of death experiences.
 * Each module knows how to apply itself to an Anime.js timeline
 * given a set of params, keyframes, and access to the scene/audio/HUD.
 */

import type { Timeline } from "animejs";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import type { AnimeThreeAdapter } from "../AnimeThreeAdapter";
import type { DeathScenario } from "../DeathLabScenarios";
import type {
  ModuleCategory,
  ParamSchema,
  Keyframe,
} from "./DeathExperienceTypes";

// ---------------------------------------------------------------------------
// Module context — everything a module's `apply()` receives
// ---------------------------------------------------------------------------

/**
 * Runtime context passed to every module's `apply()` method.
 * Provides access to the full death-lab runtime without coupling
 * the module to any specific variant implementation.
 */
export interface ModuleContext {
  /** The Anime.js v4 timeline to add animations into. */
  timeline: Timeline;
  /** The Three.js death-lab scene (camera, actors, lights, etc.). */
  scene: DeathLabScene;
  /** Procedural audio synthesizer. */
  audio: DeathLabAudio;
  /** High-level Anime ↔ Three bridge (camera, transform, material, light). */
  adapter: AnimeThreeAdapter;
  /** The HUD overlay container (for DOM-based HUD modules). */
  container: HTMLElement;
  /** Current death scenario data. */
  scenario: DeathScenario;
}

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

/**
 * A composable death-experience module.
 *
 * Modules are stateless function-objects: they read params, create proxy
 * objects, and add entries to the provided timeline. All state lives in
 * the timeline and the 3D/DOM elements they create — nothing lingers on
 * the module instance itself.
 */
export interface DeathModule {
  /** Globally unique module id (snake_case convention, e.g. "cam_ground_dolly"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Category for grouping in the editor palette. */
  category: ModuleCategory;
  /** Short description of what this module does. */
  description: string;
  /** Default parameter values. */
  defaultParams: Record<string, unknown>;
  /** Schema describing every editable parameter. */
  paramSchema: ParamSchema[];

  /**
   * Core apply method.
   *
   * Called by the CompositionEngine for each enabled track that references
   * this module. The implementation should:
   *   1. Create any needed proxy objects.
   *   2. Add animation entries to `ctx.timeline` at the correct offsets.
   *   3. Create DOM elements (HUD) or THREE objects (effects) as needed.
   *   4. Return a `cleanup` function that removes anything it created.
   *
   * @param ctx       Runtime context.
   * @param params    Merged params (defaults + track overrides + conditions).
   * @param keyframes Fine-grained keyframe overrides for this track.
   * @param offset    Absolute ms offset where this track starts in the experience.
   * @param duration  Duration in ms allocated to this track.
   * @returns         Optional cleanup callback.
   */
  apply(
    ctx: ModuleContext,
    params: Record<string, unknown>,
    keyframes: Keyframe[],
    offset: number,
    duration: number,
  ): (() => void) | void;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Central registry of all available death-experience modules.
 *
 * Modules are registered once at boot and referenced by id from
 * serialized `DeathExperience` track data.
 */
export class ModuleRegistry {
  private modules: Map<string, DeathModule> = new Map();

  /** Register a module. Throws if a module with the same id already exists. */
  public register(mod: DeathModule): void {
    if (this.modules.has(mod.id)) {
      throw new Error(`[ModuleRegistry] Duplicate module id: "${mod.id}"`);
    }
    this.modules.set(mod.id, mod);
  }

  /** Register many modules at once. */
  public registerAll(mods: DeathModule[]): void {
    for (const mod of mods) {
      this.register(mod);
    }
  }

  /** Retrieve a module by id, or undefined if not found. */
  public get(id: string): DeathModule | undefined {
    return this.modules.get(id);
  }

  /** Retrieve all modules belonging to a given category. */
  public getByCategory(category: ModuleCategory): DeathModule[] {
    const result: DeathModule[] = [];
    for (const mod of this.modules.values()) {
      if (mod.category === category) {
        result.push(mod);
      }
    }
    return result;
  }

  /** Retrieve every registered module. */
  public getAll(): DeathModule[] {
    return Array.from(this.modules.values());
  }

  /** Check whether a module id is registered. */
  public has(id: string): boolean {
    return this.modules.has(id);
  }

  /** Number of registered modules. */
  public get size(): number {
    return this.modules.size;
  }

  /** Unregister a module. Returns true if it existed. */
  public remove(id: string): boolean {
    return this.modules.delete(id);
  }

  /** Remove all registered modules. */
  public clear(): void {
    this.modules.clear();
  }
}

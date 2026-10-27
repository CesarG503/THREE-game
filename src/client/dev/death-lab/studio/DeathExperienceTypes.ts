/**
 * DeathExperienceTypes.ts — Declarative, JSON-serializable data model
 * for composable death experiences in the VIPER.IO Death Lab Studio.
 *
 * Every type here is plain data (no methods, no class instances) so that
 * experiences can be serialized to / deserialized from JSON, stored on
 * disk, transmitted over the network, and diffed in version control.
 */

// ---------------------------------------------------------------------------
// Module taxonomy
// ---------------------------------------------------------------------------

/** The six composable module categories. */
export type ModuleCategory =
  | "camera"
  | "character"
  | "effect"
  | "hud"
  | "audio"
  | "transition";

// ---------------------------------------------------------------------------
// Param schema (drives editor UI generation)
// ---------------------------------------------------------------------------

/** Primitive types a module parameter can hold. */
export type ParamType =
  | "number"
  | "string"
  | "boolean"
  | "color"      // hex number treated as color picker
  | "select"     // string constrained to `options`
  | "vec3"       // [x, y, z]
  | "easing";    // Anime.js easing name

/** Describes one editable parameter for an editor / inspector to render. */
export interface ParamSchema {
  /** Machine-readable key — matches the key in `params`. */
  name: string;
  /** Human-readable label. */
  label: string;
  /** Data type. */
  type: ParamType;
  /** Default value. */
  default: unknown;
  /** Optional short description / tooltip. */
  description?: string;
  /** Minimum value (number). */
  min?: number;
  /** Maximum value (number). */
  max?: number;
  /** Step increment (number). */
  step?: number;
  /** Valid choices (select). */
  options?: string[];
  /** Grouping / section header for UI layout. */
  group?: string;
}

// ---------------------------------------------------------------------------
// Keyframe
// ---------------------------------------------------------------------------

/**
 * A single fine-grained keyframe within an AnimationTrack.
 * Lets designers inject precise value overrides at exact millisecond offsets.
 */
export interface Keyframe {
  /** Milliseconds relative to the owning track's `startTime`. */
  time: number;
  /** Dot-path into the module's domain, e.g. "camera.position.y". */
  property: string;
  /** Target value at this keyframe. */
  value: number | string | boolean | number[];
  /** Anime.js easing function name. */
  easing: string;
}

// ---------------------------------------------------------------------------
// Animation track
// ---------------------------------------------------------------------------

/** One composable track inside a DeathExperience. */
export interface AnimationTrack {
  /** Unique id within the experience (e.g. "track_cam_orbit"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** References a registered module by its `id`. */
  moduleId: string;
  /** Whether this track participates in playback. */
  enabled: boolean;
  /** Start time offset in ms from experience beginning. */
  startTime: number;
  /** Duration in ms. */
  duration: number;
  /** Module-specific parameters (shape defined by the module). */
  params: Record<string, unknown>;
  /** Optional fine-grained keyframe overrides. */
  keyframes: Keyframe[];
}

// ---------------------------------------------------------------------------
// Scene configuration
// ---------------------------------------------------------------------------

/** Static scene setup applied before any track runs. */
export interface SceneConfig {
  fog?: { color: number; density: number };
  ambientLight?: { color: number; intensity: number };
  directionalLight?: { color: number; intensity: number };
  accentLight?: { color: number; intensity: number; position?: [number, number, number] };
  particles?: "embers" | "confetti" | "sparks" | "warp" | "matrix" | "none";
  background?: number;
}

// ---------------------------------------------------------------------------
// Conditional overrides
// ---------------------------------------------------------------------------

/**
 * A runtime condition that, when satisfied by the current DeathScenario,
 * patches specific track params so the same experience adapts to context.
 */
export interface DeathCondition {
  /** Dot-path into the scenario object, e.g. "hitLocation". */
  property: string;
  /** Comparison operator. */
  operator: "eq" | "neq" | "gt" | "lt" | "in";
  /** Value to compare against. */
  value: unknown;
  /** Param overrides to apply to matching tracks. */
  trackOverrides: TrackOverride[];
}

export interface TrackOverride {
  /** The track id to patch. */
  trackId: string;
  /** Shallow-merged param overrides. */
  params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Top-level DeathExperience
// ---------------------------------------------------------------------------

/**
 * The root, fully serializable composition format.
 * A DeathExperience is a complete, self-contained death-screen blueprint
 * that can be loaded, edited, previewed, and played by the CompositionEngine.
 */
export interface DeathExperience {
  /** Unique identifier (uuid or slug). */
  id: string;
  /** Schema version — start at 1. */
  version: number;
  /** Human-readable name. */
  name: string;
  /** Short description. */
  description: string;
  /** Author tag. */
  author: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;

  /** Scene lighting / fog / particles setup. */
  scene: SceneConfig;

  /** Ordered list of composable animation tracks (the core). */
  tracks: AnimationTrack[];

  /** Runtime conditions that adapt the experience to scenario data. */
  conditions: DeathCondition[];

  /** Total expected duration in ms. */
  duration: number;
}

// ---------------------------------------------------------------------------
// Re-export convenience tuple
// ---------------------------------------------------------------------------

export type {
  DeathExperience as Experience,
  AnimationTrack as Track,
  SceneConfig as Scene,
};

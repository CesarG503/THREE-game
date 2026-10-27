import type { Timeline } from "animejs";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";

export interface DeathVariant {
  id: string;
  name: string;
  subtitle: string;
  theme: string;
  inspiration: string;

  // Timeline & Anime.js Orchestration
  timeline: Timeline | null;
  animeEnabled: boolean;

  render(container: HTMLElement, scenario: DeathScenario, scene: DeathLabScene, audio: DeathLabAudio): void;
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setPlaybackRate(speed: number): void;
  isPaused(): boolean;
  getDuration(): number;
  getCurrentTime(): number;
  toggleAnime(enabled: boolean): void;
  revert(): void;

  onSpectatorTransition?(targetName: string, perspective: "first_person" | "third_person"): void;
  onRespawn?(countdownRemaining: number): void;
  cleanup(): void;
}

import type { Timeline } from "animejs";
import type { DeathVariant } from "./BaseVariant";
import type { DeathScenario } from "../DeathLabScenarios";
import type { DeathLabScene } from "../DeathLabScene";
import type { DeathLabAudio } from "../DeathLabAudio";
import { AnimeThreeAdapter } from "../AnimeThreeAdapter";

export abstract class AbstractDeathVariant implements DeathVariant {
  public abstract id: string;
  public abstract name: string;
  public abstract subtitle: string;
  public abstract theme: string;
  public abstract inspiration: string;

  public timeline: Timeline | null = null;
  public animeEnabled: boolean = true;
  protected adapter: AnimeThreeAdapter = new AnimeThreeAdapter();
  protected containerEl: HTMLElement | null = null;
  protected sceneRef: DeathLabScene | null = null;
  protected audioRef: DeathLabAudio | null = null;

  public abstract render(
    container: HTMLElement,
    scenario: DeathScenario,
    scene: DeathLabScene,
    audio: DeathLabAudio
  ): void;

  public play(): void {
    if (this.timeline && this.animeEnabled) {
      this.timeline.play();
    }
  }

  public pause(): void {
    if (this.timeline) {
      this.timeline.pause();
    }
  }

  public seek(timeMs: number): void {
    if (this.timeline) {
      this.timeline.seek(timeMs);
    }
  }

  public setPlaybackRate(speed: number): void {
    if (this.timeline) {
      // In Anime.js v4, Timer/Clock has playbackRate
      (this.timeline as any).playbackRate = speed;
    }
  }

  public isPaused(): boolean {
    return this.timeline ? this.timeline.paused : false;
  }

  public getDuration(): number {
    return this.timeline ? this.timeline.duration : 0;
  }

  public getCurrentTime(): number {
    return this.timeline ? this.timeline.currentTime : 0;
  }

  public toggleAnime(enabled: boolean): void {
    this.animeEnabled = enabled;
    if (!this.timeline) return;

    if (!enabled) {
      // Jump to end state of the timeline for static comparison
      this.timeline.pause();
      this.timeline.seek(this.timeline.duration);
    } else {
      this.timeline.restart();
    }
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
    this.adapter.restoreAll();
    if (this.containerEl) {
      this.containerEl.innerHTML = "";
      this.containerEl = null;
    }
    this.sceneRef = null;
    this.audioRef = null;
  }
}

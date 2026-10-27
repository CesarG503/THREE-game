/**
 * Web Audio API Procedural Sound Synthesizer for Death Screen Lab
 * Generates rich, real-time, zero-asset audio tailored for each AAA variant.
 */

export class DeathLabAudio {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public masterVolume: number = 0.5;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.warn("[DeathLabAudio] Cannot initialize AudioContext:", e);
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx) {
      // Silence active sounds
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // V01 Tactical
  public playTactical() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub heartbeat
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    gain.gain.setValueAtTime(this.masterVolume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Tinnitus high ring
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = "sine";
    ring.frequency.setValueAtTime(3800, now + 0.1);
    ringGain.gain.setValueAtTime(0.0001, now);
    ringGain.gain.exponentialRampToValueAtTime(this.masterVolume * 0.15, now + 0.2);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);
    ring.start(now + 0.1);
    ring.stop(now + 1.8);
  }

  // V02 Battle Royale
  public playBattleRoyale() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C E G C E fanfare
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(this.masterVolume * 0.4, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }

  // V03 Ultrakill
  public playUltrakill() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Distorted sub drop 808
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);
    gain.gain.setValueAtTime(this.masterVolume * 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);

    // High crash
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noise.type = "square";
    noise.frequency.setValueAtTime(800, now);
    noise.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    noiseGain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  // V04 Cyberpunk
  public playCyberpunk() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.08);
    osc.frequency.setValueAtTime(1100, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.6);
    gain.gain.setValueAtTime(this.masterVolume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // V05 Cinematic Story
  public playCinematic() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [130.81, 164.81, 196.0]; // C minor warm piano triad
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(this.masterVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.2);
    });
  }

  // V06 Dark Fantasy
  public playDarkFantasy() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant cathedral bell gong
    const bell1 = ctx.createOscillator();
    const bell2 = ctx.createOscillator();
    const gain = ctx.createGain();
    bell1.type = "sine";
    bell1.frequency.setValueAtTime(110, now); // A2
    bell2.type = "triangle";
    bell2.frequency.setValueAtTime(224, now); // Slightly detuned harmonic
    gain.gain.setValueAtTime(this.masterVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    bell1.connect(gain);
    bell2.connect(gain);
    gain.connect(ctx.destination);
    bell1.start(now);
    bell2.start(now);
    bell1.stop(now + 3.0);
    bell2.stop(now + 3.0);
  }

  // V07 Retro Arcade
  public playRetroArcade() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 8-bit descending loss arpeggio
    const sequence = [587.33, 523.25, 493.88, 440.0, 392.0, 349.23, 293.66];
    sequence.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(this.masterVolume * 0.25, now + idx * 0.07);
      gain.gain.setValueAtTime(0.001, now + idx * 0.07 + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.065);
    });
  }

  // V08 Comic Book
  public playComicBook() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(this.masterVolume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // V09 Horror
  public playHorror() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Sinister drone dissonance
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(55, now);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(58.5, now); // Beating detune
    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  // V10 Anime Mecha
  public playAnimeMecha() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Warning emergency two-tone klaxon
    [0, 0.22, 0.44].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(820, now + offset);
      osc.frequency.setValueAtTime(620, now + offset + 0.1);
      gain.gain.setValueAtTime(this.masterVolume * 0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  }

  // V11 Meme Absurd
  public playMeme() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Comedic slide whistle down-pitch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.45);
    gain.gain.setValueAtTime(this.masterVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Honk double pop
    [0.55, 0.68].forEach((time) => {
      const honk = ctx.createOscillator();
      const honkGain = ctx.createGain();
      honk.type = "square";
      honk.frequency.setValueAtTime(320, now + time);
      honkGain.gain.setValueAtTime(this.masterVolume * 0.4, now + time);
      honkGain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.08);
      honk.connect(honkGain);
      honkGain.connect(ctx.destination);
      honk.start(now + time);
      honk.stop(now + time + 0.09);
    });
  }

  // V12 Western
  public playWestern() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Western mournful whistle chime
    const whistle = ctx.createOscillator();
    const gain = ctx.createGain();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(587.33, now); // D5
    whistle.frequency.linearRampToValueAtTime(659.25, now + 0.2); // E5
    whistle.frequency.linearRampToValueAtTime(587.33, now + 0.4);
    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    whistle.connect(gain);
    gain.connect(ctx.destination);
    whistle.start(now);
    whistle.stop(now + 1.2);
  }

  // V13 Sci-Fi Space
  public playSciFiSpace() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.9);
    gain.gain.setValueAtTime(this.masterVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.1);
  }

  // V14 Esports
  public playEsports() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Crisp tick + sub hit
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = "triangle";
    tick.frequency.setValueAtTime(1400, now);
    tickGain.gain.setValueAtTime(this.masterVolume * 0.5, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    tick.connect(tickGain);
    tickGain.connect(ctx.destination);
    tick.start(now);
    tick.stop(now + 0.05);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(80, now + 0.04);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    subGain.gain.setValueAtTime(this.masterVolume * 0.6, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now + 0.04);
    sub.stop(now + 0.4);
  }

  // V15 Reality Corruption
  public playRealityCorruption() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Reverse pitch glitch sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    osc.frequency.setValueAtTime(90, now + 0.45);
    gain.gain.setValueAtTime(this.masterVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  // V16 Viper Signature
  public playViperSignature() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep kinetic sub drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.7);
    subGain.gain.setValueAtTime(this.masterVolume * 0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.8);

    // Venom kinetic charge-up
    const venom = ctx.createOscillator();
    const venomGain = ctx.createGain();
    venom.type = "triangle";
    venom.frequency.setValueAtTime(380, now + 0.05);
    venom.frequency.linearRampToValueAtTime(740, now + 0.35);
    venomGain.gain.setValueAtTime(0.001, now);
    venomGain.gain.exponentialRampToValueAtTime(this.masterVolume * 0.3, now + 0.15);
    venomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    venom.connect(venomGain);
    venomGain.connect(ctx.destination);
    venom.start(now + 0.05);
    venom.stop(now + 0.6);
  }

  public playVariantAudio(variantId: string) {
    if (this.isMuted) return;
    switch (variantId) {
      case "v01_tactical": this.playTactical(); break;
      case "v02_battle_royale": this.playBattleRoyale(); break;
      case "v03_arena_ultrakill": this.playUltrakill(); break;
      case "v04_cyberpunk": this.playCyberpunk(); break;
      case "v05_cinematic": this.playCinematic(); break;
      case "v06_dark_fantasy": this.playDarkFantasy(); break;
      case "v07_retro_arcade": this.playRetroArcade(); break;
      case "v08_comic_book": this.playComicBook(); break;
      case "v09_horror": this.playHorror(); break;
      case "v10_anime_mecha": this.playAnimeMecha(); break;
      case "v11_meme_absurd": this.playMeme(); break;
      case "v12_western": this.playWestern(); break;
      case "v13_scifi_space": this.playSciFiSpace(); break;
      case "v14_esports": this.playEsports(); break;
      case "v15_reality_corruption": this.playRealityCorruption(); break;
      case "v16_viper_signature":
      default:
        this.playViperSignature();
        break;
    }
  }

  // Tactile UI click
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }
}

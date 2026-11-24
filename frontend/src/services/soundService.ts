// ============================================================
// src/services/soundService.ts
// High-fidelity audio synthesizer using the Web Audio API.
// 100% self-contained, zero external audio assets required.
// ============================================================

const STORAGE_KEY = 'binomo_sound_alerts_enabled';

class SoundService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean;

  constructor() {
    // Read user preference from localStorage (default: true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      this.soundEnabled = saved !== null ? saved === 'true' : true;
    } else {
      this.soundEnabled = true;
    }
  }

  /**
   * Initializes or resumes the AudioContext after user interaction
   */
  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    }
    if (enabled) {
      this.ensureContext();
    }
  }

  /**
   * Plays a synthesized musical chime note with exponential decay
   */
  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    volume: number = 0.35,
    type: OscillatorType = 'sine'
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack and smooth exponential release curve
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      console.warn('[SoundService] Audio playback warning:', e);
    }
  }

  /**
   * High-Confidence CALL alert:
   * Uplifting harmonic ascending chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
   */
  public playCallAlert(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 523.25, now, 0.22, 0.35, 'sine');
    this.playTone(ctx, 659.25, now + 0.11, 0.22, 0.35, 'sine');
    this.playTone(ctx, 783.99, now + 0.22, 0.25, 0.40, 'triangle');
    this.playTone(ctx, 1046.50, now + 0.33, 0.55, 0.45, 'sine');
  }

  /**
   * High-Confidence PUT alert:
   * Focused descending chime: A5 (880Hz) -> F#5 (740Hz) -> D5 (587Hz) -> A4 (440Hz)
   */
  public playPutAlert(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 880.00, now, 0.20, 0.35, 'sine');
    this.playTone(ctx, 739.99, now + 0.11, 0.20, 0.35, 'sine');
    this.playTone(ctx, 587.33, now + 0.22, 0.25, 0.40, 'triangle');
    this.playTone(ctx, 440.00, now + 0.33, 0.55, 0.45, 'sine');
  }

  /**
   * Plays the appropriate alert for a high-confidence signal
   */
  public playSignalAlert(direction: 'CALL' | 'PUT' | 'WAIT'): void {
    if (!this.soundEnabled) return;
    if (direction === 'CALL') {
      this.playCallAlert();
    } else if (direction === 'PUT') {
      this.playPutAlert();
    } else {
      this.playTestAlert();
    }
  }

  /**
   * Test chime triggered by user click (also unlocks AudioContext in mobile/safari)
   */
  public playTestAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 659.25, now, 0.20, 0.35, 'sine');
    this.playTone(ctx, 880.00, now + 0.13, 0.40, 0.40, 'sine');
  }
}

export const soundService = new SoundService();

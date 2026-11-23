// ============================================================
// src/utils/audioAlert.ts
// Crystal-clear Web Audio trading notifications with zero external assets
// ============================================================

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;
  private lastAlertTime = 0;
  private lastSignalKey = '';

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Play high-frequency chime for CALL (BUY) signal
  playCallAlert(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (Higher Confirmation Ping)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, now + 0.15); // C6
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.4); // E6

      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('[AudioAlert] Call sound failed:', e);
    }
  }

  // Play descending alert for PUT (SELL) signal
  playPutAlert(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.2); // C5

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(523.25, now + 0.18); // C5
      osc2.frequency.exponentialRampToValueAtTime(392.00, now + 0.45); // G4

      gain2.gain.setValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn('[AudioAlert] Put sound failed:', e);
    }
  }

  // Check and trigger alert when signal arrives (debounced)
  notifySignal(symbol: string, direction: 'CALL' | 'PUT' | 'WAIT', confidence: number): void {
    if (direction === 'WAIT') return;

    const signalKey = `${symbol}_${direction}_${Math.floor(Date.now() / 60000)}`;
    const now = Date.now();

    // Prevent spamming sound within 20 seconds for the same signal
    if (this.lastSignalKey === signalKey || now - this.lastAlertTime < 20000) {
      return;
    }

    this.lastSignalKey = signalKey;
    this.lastAlertTime = now;

    if (direction === 'CALL') {
      this.playCallAlert();
    } else if (direction === 'PUT') {
      this.playPutAlert();
    }

    // Also trigger Browser desktop notification if supported & permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🔥 BINOMO SIGNAL: ${direction} on ${symbol}`, {
          body: `${direction} (BUY/SELL) confirmed with ${confidence}% confidence! 15s entry window active.`,
          icon: '/favicon.ico',
        });
      } catch {}
    }
  }

  // Request browser notification permission
  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => null);
    }
    // Also unlock Web Audio context on user click
    this.getAudioContext();
  }
}

export const audioAlert = new SoundAlertManager();

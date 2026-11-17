// audio.js — every sound in PRISM BREAK v2 is synthesised live with the
// Web Audio API: oscillator blips for shots, filtered noise for explosions,
// little arpeggios for pickups. There are no audio files anywhere. The
// engine is lazy (the context is created on the first user gesture, as
// browsers require) and every call is guarded, so the game runs silently
// and safely where audio is unavailable.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.lastShotAt = 0;
  }

  // Create (or resume) the context. Called from click/keydown handlers.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // One shared white-noise buffer feeds every explosion and whoosh.
      const len = this.ctx.sampleRate * 0.6;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
    }
    return this.muted;
  }

  // A single oscillator voice with an exponential decay envelope.
  tone({ freq = 440, freqEnd = null, type = 'square', dur = 0.12, vol = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst: the body of explosions, dashes and impacts.
  noise({ dur = 0.25, vol = 0.3, freq = 1200, freqEnd = 120, type = 'lowpass', delay = 0 }) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- the game's vocabulary ------------------------------------------------

  shoot(kind) {
    if (!this.ctx || this.muted) return;
    // Throttle: at pulse-weapon rates the ear hears a stream, not a stack.
    const now = performance.now();
    if (now - this.lastShotAt < 34) return;
    this.lastShotAt = now;
    switch (kind) {
      case 'scatter':
        this.tone({ freq: 300, freqEnd: 90, type: 'sawtooth', dur: 0.1, vol: 0.16 });
        this.noise({ dur: 0.08, vol: 0.1, freq: 2600, freqEnd: 500 });
        break;
      case 'rail':
        this.tone({ freq: 1400, freqEnd: 220, type: 'sawtooth', dur: 0.16, vol: 0.18 });
        break;
      case 'seeker':
        this.tone({ freq: 700, freqEnd: 1150, type: 'triangle', dur: 0.09, vol: 0.14 });
        break;
      case 'pulse':
        this.tone({ freq: 980, freqEnd: 620, type: 'square', dur: 0.05, vol: 0.1 });
        break;
      default: // blaster
        this.tone({ freq: 840, freqEnd: 340, type: 'square', dur: 0.07, vol: 0.13 });
    }
  }

  enemyHit() {
    this.tone({ freq: 220, freqEnd: 160, type: 'triangle', dur: 0.05, vol: 0.07 });
  }

  explosion(size = 1) {
    this.noise({ dur: 0.22 + 0.12 * size, vol: 0.22 + 0.08 * size, freq: 900, freqEnd: 90 });
    this.tone({ freq: 130, freqEnd: 42, type: 'sine', dur: 0.28 + 0.1 * size, vol: 0.26 });
  }

  bigExplosion() {
    this.explosion(2.2);
    this.noise({ dur: 0.7, vol: 0.2, freq: 500, freqEnd: 60, delay: 0.05 });
    this.tone({ freq: 70, freqEnd: 30, type: 'sine', dur: 0.7, vol: 0.3, delay: 0.03 });
  }

  playerHurt() {
    this.tone({ freq: 320, freqEnd: 60, type: 'sawtooth', dur: 0.3, vol: 0.3 });
    this.noise({ dur: 0.25, vol: 0.25, freq: 1800, freqEnd: 200 });
  }

  dash() {
    this.noise({ dur: 0.16, vol: 0.14, freq: 500, freqEnd: 3200, type: 'bandpass' });
  }

  pickup() {
    this.tone({ freq: 660, type: 'triangle', dur: 0.08, vol: 0.18 });
    this.tone({ freq: 990, type: 'triangle', dur: 0.1, vol: 0.18, delay: 0.06 });
  }

  weaponUp() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.12, delay: i * 0.05 }));
  }

  heartUp() {
    this.tone({ freq: 587, type: 'sine', dur: 0.12, vol: 0.2 });
    this.tone({ freq: 880, type: 'sine', dur: 0.16, vol: 0.2, delay: 0.09 });
  }

  comboLost() {
    this.tone({ freq: 400, freqEnd: 180, type: 'triangle', dur: 0.18, vol: 0.12 });
  }

  waveStart() {
    this.tone({ freq: 392, type: 'square', dur: 0.1, vol: 0.14 });
    this.tone({ freq: 587, type: 'square', dur: 0.14, vol: 0.14, delay: 0.09 });
  }

  bossWarn() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 196, type: 'sawtooth', dur: 0.16, vol: 0.2, delay: i * 0.22 });
      this.tone({ freq: 147, type: 'sawtooth', dur: 0.16, vol: 0.2, delay: i * 0.22 + 0.11 });
    }
  }

  bossDown() {
    this.bigExplosion();
    const notes = [262, 330, 392, 523, 659, 784];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.14, delay: 0.15 + i * 0.09 }));
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.18, delay: i * 0.17 }));
  }

  uiClick() {
    this.tone({ freq: 740, type: 'triangle', dur: 0.06, vol: 0.12 });
  }
}

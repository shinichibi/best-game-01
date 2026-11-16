// Every sound is synthesised with WebAudio — no audio files. Short envelopes for
// effects (laser, explosion, pickup, dash, hurt) and a slow bass-and-arpeggio loop
// for music. The game logic never calls this directly: it queues named events and
// the shell drains them here once per frame, so headless runs stay silent and safe.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.nextNoteAt = 0;
    this.noteIndex = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freqA, freqB, dur, type, vol, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.tone(880, 320, 0.08, 'square', 0.10); break;
      case 'enemyShoot': this.tone(300, 180, 0.10, 'sawtooth', 0.06); break;
      case 'hit': this.tone(220, 140, 0.05, 'square', 0.08); break;
      case 'explode': this.noise(0.28, 0.30); this.tone(160, 40, 0.25, 'triangle', 0.25); break;
      case 'bigExplode': this.noise(0.55, 0.45); this.tone(110, 28, 0.5, 'triangle', 0.4); break;
      case 'pickup': this.tone(660, 990, 0.09, 'sine', 0.16); break;
      case 'heart': this.tone(520, 780, 0.14, 'sine', 0.2); this.tone(780, 1040, 0.14, 'sine', 0.14, 0.07); break;
      case 'dash': this.noise(0.12, 0.12); this.tone(240, 720, 0.12, 'sine', 0.08); break;
      case 'hurt': this.tone(180, 60, 0.22, 'sawtooth', 0.3); this.noise(0.15, 0.2); break;
      case 'draft': this.tone(440, 440, 0.09, 'sine', 0.15); this.tone(554, 554, 0.09, 'sine', 0.15, 0.08); this.tone(659, 659, 0.12, 'sine', 0.15, 0.16); break;
      case 'wave': this.tone(196, 196, 0.16, 'triangle', 0.22); this.tone(294, 294, 0.2, 'triangle', 0.22, 0.12); break;
      case 'boss': this.tone(98, 98, 0.4, 'sawtooth', 0.25); this.tone(147, 147, 0.4, 'sawtooth', 0.2, 0.2); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 'triangle', 0.2, i * 0.13)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.94, 0.25, 'triangle', 0.2, i * 0.15)); break;
      case 'ui': this.tone(700, 700, 0.05, 'sine', 0.1); break;
    }
  }

  // A two-bar loop: a low pulse on the beat and a sparse minor arpeggio above it.
  updateMusic(playing) {
    if (!this.ctx || this.muted) return;
    if (!playing) {
      this.musicOn = false;
      return;
    }
    const now = this.ctx.currentTime;
    if (!this.musicOn) {
      this.musicOn = true;
      this.nextNoteAt = now + 0.05;
      this.noteIndex = 0;
    }
    const step = 0.21;
    const bass = [55, 55, 82.4, 55, 65.4, 55, 73.4, 98];
    const arp = [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 246.9, 0];
    while (this.nextNoteAt < now + 0.3) {
      const i = this.noteIndex;
      const delay = Math.max(0, this.nextNoteAt - now);
      if (i % 2 === 0) this.tone(bass[(i / 2) % 8], bass[(i / 2) % 8], 0.2, 'triangle', 0.16, delay);
      const a = arp[i % 16];
      if (a) this.tone(a, a, 0.16, 'sine', 0.055, delay);
      this.nextNoteAt += step;
      this.noteIndex++;
    }
  }
}

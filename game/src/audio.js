// All sound is synthesized with WebAudio — no assets. Spec 3.2/3.4:
// the buzz tracks fly speed (180Hz + 0.45/speed, cap 420), warning
// beeps accelerate 300ms -> 60ms with a final high "ding", and the
// birthday song gains a wobbly detune once everyone is up.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buzzOsc = null;
    this.buzzGain = null;
    this.buzzFilter = null;
    this.beepT = 0;
    this.prevWarnMs = null;
    this.dingDone = false;
    this.songOn = false;
    this.songStep = 0;
    this.songT = 0;
    this.songWobble = 0;
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

  tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, detune = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, { vol = 0.25, freq = 900, q = 0.8, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  // --- the fly's voice -------------------------------------------------

  buzz(on) {
    if (!this.ctx) return;
    if (on && !this.buzzOsc) {
      this.buzzOsc = this.ctx.createOscillator();
      this.buzzOsc.type = 'sawtooth';
      this.buzzOsc.frequency.value = 190;
      this.buzzFilter = this.ctx.createBiquadFilter();
      this.buzzFilter.type = 'lowpass';
      this.buzzFilter.frequency.value = 900;
      this.buzzGain = this.ctx.createGain();
      this.buzzGain.gain.value = 0.0;
      this.buzzOsc.connect(this.buzzFilter).connect(this.buzzGain).connect(this.master);
      this.buzzOsc.start();
    } else if (!on && this.buzzOsc) {
      const osc = this.buzzOsc;
      this.buzzGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        try { osc.stop(); } catch { /* already stopped */ }
      }, 200);
      this.buzzOsc = null;
      this.buzzGain = null;
    }
  }

  update(dt, { playing = false, flySpeed = 0, landed = false, warnMs = null, bet = 0 } = {}) {
    if (!this.ctx) return;
    if (playing) this.buzz(true);
    if (this.buzzOsc && this.buzzGain) {
      // Spec 3.2: f = 180 + speed * 0.45, capped at 420Hz. A raised
      // bet (v3 P1-4) pitches the landed buzz up — greed sounds keen.
      let freq = Math.min(420, 180 + (Number.isFinite(flySpeed) ? flySpeed : 0) * 0.45);
      if (landed && bet > 0) freq = Math.min(460, freq * (1 + bet * 0.15));
      this.buzzOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
      const vol = playing ? (landed ? 0.016 : 0.03) : 0.0;
      this.buzzGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.06);
    }
    // Warning beeps: the closer the slap, the faster they tick.
    if (playing && warnMs != null) {
      if (this.prevWarnMs != null && warnMs > this.prevWarnMs + 60) this.dingDone = false;
      this.prevWarnMs = warnMs;
      if (warnMs <= 70 && !this.dingDone) {
        this.dingDone = true;
        this.tone(1560, 0.09, { type: 'square', vol: 0.12 });
      } else {
        this.beepT -= dt * 1000;
        if (this.beepT <= 0) {
          const interval = Math.max(60, Math.min(300, warnMs * 0.21));
          this.beepT = interval;
          this.tone(warnMs < 300 ? 1180 : 880, 0.045, { type: 'square', vol: 0.07 });
        }
      }
    } else {
      this.prevWarnMs = null;
      this.dingDone = false;
    }
    this.songTick(dt);
  }

  // --- one-shots ---------------------------------------------------------

  warn() { this.tone(660, 0.08, { type: 'square', vol: 0.1 }); }
  lock() { this.tone(190, 0.05, { type: 'square', vol: 0.13 }); this.noise(0.04, { vol: 0.1, freq: 2400, q: 1.2 }); }
  bet(level) { this.tone(440 + level * 140, 0.08, { type: 'triangle', vol: 0.13, slide: 160 }); }
  crumb() { this.tone(980, 0.05, { type: 'sine', vol: 0.05, slide: 220 }); }
  lucky() { this.tone(520, 0.09, { type: 'triangle', vol: 0.13 }); this.tone(780, 0.12, { type: 'triangle', vol: 0.13, delay: 0.07 }); }
  sprayWarn() { this.noise(0.35, { vol: 0.1, freq: 3200, q: 0.4 }); }
  land() { this.tone(240, 0.05, { type: 'triangle', vol: 0.08 }); }
  pop() { this.tone(520, 0.06, { type: 'sine', vol: 0.14, slide: 260 }); }
  ding() { this.tone(1320, 0.12, { type: 'sine', vol: 0.14 }); this.tone(1980, 0.1, { type: 'sine', vol: 0.08, delay: 0.03 }); }
  dash() { this.noise(0.14, { vol: 0.16, freq: 1600, q: 0.5 }); this.tone(300, 0.12, { type: 'sine', vol: 0.08, slide: 500 }); }
  thud() { this.noise(0.16, { vol: 0.3, freq: 220, q: 0.6 }); this.tone(90, 0.18, { type: 'sine', vol: 0.3, slide: -40 }); }
  splat() { this.noise(0.22, { vol: 0.3, freq: 500, q: 0.5 }); this.tone(160, 0.25, { type: 'triangle', vol: 0.22, slide: -110 }); }
  poof() { this.noise(0.12, { vol: 0.12, freq: 700, q: 0.7 }); this.tone(300, 0.14, { type: 'sine', vol: 0.1, slide: -160 }); }
  sneeze() { this.noise(0.3, { vol: 0.26, freq: 1100, q: 0.5 }); this.tone(500, 0.3, { type: 'sawtooth', vol: 0.06, slide: -300 }); }
  rating(kind) {
    if (kind === 'close') {
      this.tone(880, 0.09, { type: 'square', vol: 0.12 });
      this.tone(1174, 0.12, { type: 'square', vol: 0.12, delay: 0.07 });
    } else {
      this.tone(740, 0.08, { type: 'square', vol: 0.1 });
    }
  }
  perfect() {
    for (const [i, f] of [523, 659, 784, 1046].entries()) {
      this.tone(f, 0.14, { type: 'square', vol: 0.11, delay: i * 0.05 });
    }
  }
  comboUp() { this.tone(660, 0.1, { type: 'triangle', vol: 0.14, slide: 440 }); }
  chain() { this.tone(784, 0.08, { type: 'square', vol: 0.1 }); this.tone(1046, 0.1, { type: 'square', vol: 0.1, delay: 0.06 }); }
  explosion() {
    this.noise(0.7, { vol: 0.4, freq: 300, q: 0.4 });
    this.tone(70, 0.6, { type: 'sine', vol: 0.35, slide: -30 });
    for (let i = 0; i < 5; i++) this.tone(300 + i * 90, 0.2, { type: 'triangle', vol: 0.08, delay: 0.1 + i * 0.07 });
  }

  // --- the birthday song ---------------------------------------------------

  startSong() {
    this.songOn = true;
    this.songStep = 0;
    this.songT = 0;
  }

  stopSong() {
    this.songOn = false;
  }

  songTick(dt) {
    if (!this.songOn || !this.ctx) return;
    this.songT -= dt;
    if (this.songT > 0) return;
    // "Happy Birthday" opening, looped, slowly going off the rails.
    const NOTES = [392, 392, 440, 392, 523, 494, 392, 392, 440, 392, 587, 523];
    const BEATS = [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 2];
    const i = this.songStep % NOTES.length;
    const beat = 0.34;
    this.songT = BEATS[i] * beat;
    this.songWobble = Math.min(60, this.songWobble + 1.2);
    const detune = (Math.random() * 2 - 1) * this.songWobble;
    this.tone(NOTES[i], 0.22, { type: 'triangle', vol: 0.07, detune });
    this.tone(NOTES[i] / 2, 0.3, { type: 'sine', vol: 0.05, detune: -detune });
    this.songStep++;
  }
}

// audio.js — a tiny synthesized soundscape, no audio files: the buzz
// is a detuned sawtooth whose pitch follows the fly's speed, eating is
// a soft chomp, the warning is a rising tick, and the palm is a noise
// splat. Everything is created lazily on the first user gesture, and
// every call is safe before that (it just stays silent).

export class Sound {
  constructor() {
    this.ctx = null;
    this.buzzOsc = null;
    this.buzzGain = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // The permanent buzz voice, gain driven per frame.
      this.buzzOsc = this.ctx.createOscillator();
      this.buzzOsc.type = 'sawtooth';
      this.buzzOsc.frequency.value = 160;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      this.buzzGain = this.ctx.createGain();
      this.buzzGain.gain.value = 0;
      this.buzzOsc.connect(filter).connect(this.buzzGain).connect(this.ctx.destination);
      this.buzzOsc.start();
    } catch {
      this.ctx = null; // no audio on this browser: the game stays silent
    }
  }

  // Called every frame while playing: speed in px/s, dashing or not.
  buzz(speed, dashing) {
    if (!this.ctx || !this.buzzOsc) return;
    const t = this.ctx.currentTime;
    const target = dashing ? 0.05 : speed > 40 ? 0.016 : 0.0;
    this.buzzGain.gain.setTargetAtTime(target, t, 0.05);
    this.buzzOsc.frequency.setTargetAtTime(140 + speed * 0.35 + (dashing ? 60 : 0), t, 0.05);
  }

  blip(freq, dur = 0.09, gain = 0.06, type = 'sine') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  chomp() { this.blip(300, 0.08, 0.07, 'triangle'); this.blip(190, 0.1, 0.05, 'triangle'); }
  eaten() { this.blip(660, 0.1, 0.06); setTimeout(() => this.blip(880, 0.14, 0.06), 70); }
  warn() { this.blip(1180, 0.06, 0.05, 'square'); }
  escape() { this.blip(523, 0.12, 0.06); setTimeout(() => this.blip(784, 0.2, 0.06), 90); }

  splat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
}

'use strict';
/* ==========================================================
   Audio: synthesized sound effects, jungle ambience & music
   ========================================================== */
const Sfx = {
  ctx: null, master: null, sfxGain: null, musicGain: null, ambGain: null,
  noiseBuf: null, started: false,
  vol: 0.8, music: true, ambience: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = this.music ? 0.32 : 0; this.musicGain.connect(this.master);
    this.ambGain = c.createGain(); this.ambGain.gain.value = this.ambience ? 0.5 : 0; this.ambGain.connect(this.master);
    // reverb (simple generated impulse)
    this.verb = c.createConvolver();
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb.buffer = ir;
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.25;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.startAmbience();
    this.startMusic();
  },
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  setMusic(on) { this.music = on; if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.3); },
  setAmbience(on) { this.ambience = on; if (this.ambGain) this.ambGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.3); },

  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, delay = 0, dest, verb = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0, slide = 0, dest, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },

  click() { this.tone(820, 0.06, { type: 'triangle', vol: 0.18 }); this.tone(1240, 0.05, { type: 'sine', vol: 0.1, delay: 0.02 }); },
  open() { this.tone(520, 0.12, { type: 'triangle', vol: 0.15, slide: 1.6 }); this.noise(0.12, { vol: 0.05, freq: 3000 }); },
  close() { this.tone(700, 0.1, { type: 'triangle', vol: 0.12, slide: 0.6 }); },
  error() { this.tone(180, 0.18, { type: 'square', vol: 0.1 }); this.tone(140, 0.22, { type: 'square', vol: 0.1, delay: 0.1 }); },
  coin(i = 0) {
    const p = 1 + (i % 5) * 0.06;
    this.tone(1318 * p, 0.09, { type: 'square', vol: 0.06 });
    this.tone(1975 * p, 0.28, { type: 'triangle', vol: 0.12, delay: 0.06, verb: 0.3 });
  },
  cash() { for (let i = 0; i < 5; i++) this.coin(i), this.tone(2600 + i * 120, 0.08, { type: 'sine', vol: 0.05, delay: i * 0.05 }); },
  food() { this.noise(0.18, { vol: 0.2, freq: 900, q: 2, slide: 0.5 }); this.tone(300, 0.15, { type: 'triangle', vol: 0.12, slide: 1.5, delay: 0.05 }); },
  build() {
    this.noise(0.35, { vol: 0.35, freq: 200, type: 'lowpass', q: 0.7 });
    this.tone(90, 0.3, { type: 'sine', vol: 0.4, slide: 0.5 });
    [0.12, 0.22, 0.3].forEach((d, i) => this.noise(0.08, { vol: 0.2, freq: 2400 - i * 400, q: 3, delay: d }));
    this.tone(660, 0.2, { type: 'triangle', vol: 0.1, delay: 0.35 }); this.tone(990, 0.35, { type: 'triangle', vol: 0.1, delay: 0.45, verb: 0.4 });
  },
  road() { this.noise(0.1, { vol: 0.15, freq: 500, q: 1.5 }); this.tone(150, 0.08, { type: 'sine', vol: 0.15 }); },
  chop() { this.noise(0.09, { vol: 0.28, freq: 1600, q: 4 }); this.tone(220, 0.07, { type: 'triangle', vol: 0.12, slide: 0.6 }); },
  timber() { this.noise(0.9, { vol: 0.3, freq: 400, q: 0.6, type: 'lowpass', slide: 0.3 }); this.tone(70, 0.5, { vol: 0.35, slide: 0.6, delay: 0.5 }); },
  drill() { this.noise(0.12, { vol: 0.2, freq: 3000, q: 6 }); this.tone(110, 0.12, { type: 'sawtooth', vol: 0.05 }); },
  amber() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(660 * Math.pow(2, s / 12), 0.5, { type: 'sine', vol: 0.12, delay: i * 0.07, verb: 0.6 })); },
  hatch() { this.noise(0.08, { vol: 0.25, freq: 2500, q: 5 }); this.noise(0.08, { vol: 0.25, freq: 2200, q: 5, delay: 0.15 }); this.noise(0.2, { vol: 0.3, freq: 1500, q: 2, delay: 0.3 }); this.chirp(0.55); this.fanfare(0.8); },
  chirp(delay = 0) { this.tone(1400, 0.12, { vol: 0.15, slide: 1.8, delay }); this.tone(1800, 0.1, { vol: 0.12, slide: 0.7, delay: delay + 0.12 }); },
  levelUp() { const n = [523, 659, 784, 1046, 784, 1046, 1318]; n.forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.16, delay: i * 0.09, verb: 0.5 })); this.fanfare(0.7); },
  fanfare(delay = 0) { [392, 523, 659].forEach(f => this.tone(f, 0.9, { type: 'sawtooth', vol: 0.05, delay, attack: 0.05, verb: 0.5 })); },
  mission() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.08, verb: 0.5 })); },
  eat() { for (let i = 0; i < 3; i++) this.noise(0.07, { vol: 0.22, freq: 700 + Math.random() * 400, q: 2, delay: i * 0.13 }); },
  roar(size = 1, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, dur = 0.9 + size * 0.7;
    const base = 150 / (0.6 + size);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 1.4, t); o.frequency.linearRampToValueAtTime(base * 1.9, t + dur * 0.25); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    const lfo = c.createOscillator(); lfo.frequency.value = 28 + Math.random() * 10; const lg = c.createGain(); lg.gain.value = base * 0.35; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(700 + size * 200, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.3); f.frequency.exponentialRampToValueAtTime(300, t + dur); f.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.12); g.gain.setValueAtTime(0.35, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    const vg = c.createGain(); vg.gain.value = 0.5; g.connect(vg); vg.connect(this.verb);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    this.noise(dur, { vol: 0.22, freq: 600 + size * 100, q: 0.8, delay, attack: 0.1, slide: 0.5 });
  },
  hit(heavy) { this.noise(0.25, { vol: heavy ? 0.5 : 0.35, freq: heavy ? 300 : 700, q: 0.8, type: 'lowpass' }); this.tone(heavy ? 70 : 110, 0.25, { vol: 0.4, slide: 0.5 }); },
  slash() { this.noise(0.22, { vol: 0.3, freq: 4000, q: 2, slide: 0.3 }); },
  chomp() { this.noise(0.06, { vol: 0.4, freq: 1200, q: 2 }); this.tone(160, 0.12, { type: 'square', vol: 0.12, slide: 0.5 }); },
  block() { this.tone(900, 0.4, { type: 'triangle', vol: 0.15, verb: 0.6 }); this.noise(0.1, { vol: 0.2, freq: 5000, q: 3 }); },
  whoosh() { this.noise(0.3, { vol: 0.2, freq: 600, q: 1, slide: 3 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, { type: 'square', vol: 0.07, delay: i * 0.14, verb: 0.4 })); this.fanfare(0.6); },
  lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.14, delay: i * 0.2 })); },

  /* ---------- ambience: birds, insects, waves ---------- */
  startAmbience() {
    const c = this.ctx;
    // ocean / wind bed
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.08;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09; const lg = c.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.ambGain); s.start(); lfo.start();
    this.nightGain = c.createGain(); this.nightGain.gain.value = 0; this.nightGain.connect(this.ambGain);
    const s2 = c.createBufferSource(); s2.buffer = this.noiseBuf; s2.loop = true;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 5200; f2.Q.value = 12;
    const trem = c.createGain(); trem.gain.value = 0.5; const tl = c.createOscillator(); tl.frequency.value = 17; const tg = c.createGain(); tg.gain.value = 0.5; tl.connect(tg); tg.connect(trem.gain);
    s2.connect(f2); f2.connect(trem); trem.connect(this.nightGain); s2.start(); tl.start();
    const tick = () => {
      if (!this.ctx) return;
      if (this.ambience) this.birdCall();
      setTimeout(tick, 1500 + Math.random() * 4500);
    };
    setTimeout(tick, 1200);
  },
  setNight(n) { if (this.nightGain) this.nightGain.gain.setTargetAtTime(n * 0.12, this.ctx.currentTime, 1); },
  birdCall() {
    const night = typeof World !== 'undefined' ? World.night : 0;
    const dest = this.ambGain;
    if (night > 0.6) { // owl / frog at night
      if (Math.random() < 0.5) { this.tone(380, 0.35, { vol: 0.05, dest, attack: 0.05 }); this.tone(340, 0.5, { vol: 0.05, dest, delay: 0.45, attack: 0.05 }); }
      else for (let i = 0; i < 3; i++) this.tone(220 + Math.random() * 30, 0.08, { type: 'square', vol: 0.015, dest, delay: i * 0.13 });
      return;
    }
    const kind = Math.floor(Math.random() * 4);
    const b = 1800 + Math.random() * 1600;
    if (kind === 0) for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.tone(b, 0.09, { vol: 0.03, slide: 1.4, dest, delay: i * 0.12 });
    else if (kind === 1) { this.tone(b, 0.25, { vol: 0.03, slide: 0.6, dest }); this.tone(b * 1.2, 0.2, { vol: 0.025, slide: 0.7, dest, delay: 0.3 }); }
    else if (kind === 2) for (let i = 0; i < 6; i++) this.tone(b * (i % 2 ? 1.15 : 1), 0.05, { vol: 0.02, dest, delay: i * 0.06 });
    else { this.tone(700, 0.4, { vol: 0.025, slide: 1.8, dest, attack: 0.1 }); }
  },

  /* ---------- music: gentle adventure loop ---------- */
  startMusic() {
    const c = this.ctx;
    const bpm = 92, beat = 60 / bpm;
    // D dorian-ish progression
    const chords = [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [45, 52, 57, 61]];
    const scale = [62, 64, 65, 67, 69, 72, 74, 76, 77, 79];
    let bar = 0, next = c.currentTime + 0.5;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const dest = this.musicGain;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < c.currentTime + 1.2) {
        const ch = chords[bar % 4];
        // pad
        ch.forEach(n => {
          const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = (Math.random() - 0.5) * 12;
          f.type = 'lowpass'; f.frequency.value = 900;
          g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.018, next + 0.8); g.gain.setValueAtTime(0.018, next + beat * 3.2); g.gain.exponentialRampToValueAtTime(0.0001, next + beat * 4.2);
          o.connect(f); f.connect(g); g.connect(dest); const vg = c.createGain(); vg.gain.value = 0.6; g.connect(vg); vg.connect(this.verb);
          o.start(next); o.stop(next + beat * 4.3);
        });
        // bass
        [0, 1.5, 2, 3.5].forEach((b, i) => { this.tone(mtof(ch[0] - 12), beat * 0.9, { type: 'triangle', vol: 0.09, dest, delay: next - c.currentTime + b * beat }); });
        // tribal drums
        for (let i = 0; i < 8; i++) {
          const d = next - c.currentTime + i * beat / 2;
          if (i % 4 === 0) this.tone(70, 0.3, { vol: 0.2, slide: 0.5, dest, delay: d });
          if (i === 3 || i === 6 || i === 7) this.tone(160, 0.15, { vol: 0.08, slide: 0.6, dest, delay: d });
          this.noise(0.04, { vol: 0.02, freq: 8000, q: 1, dest, delay: d });
        }
        // marimba melody
        if (bar % 8 >= 2) {
          let t = 0;
          while (t < 4) {
            const len = Math.random() < 0.6 ? 0.5 : 1;
            if (Math.random() < 0.72) {
              const n = scale[Math.floor(Math.random() * scale.length)];
              const d = next - c.currentTime + t * beat;
              this.tone(mtof(n), 0.5, { type: 'sine', vol: 0.06, dest, delay: d, verb: 0.4 });
              this.tone(mtof(n) * 4, 0.08, { type: 'sine', vol: 0.012, dest, delay: d });
            }
            t += len;
          }
        }
        next += beat * 4; bar++;
      }
      setTimeout(schedule, 400);
    };
    schedule();
  },
};

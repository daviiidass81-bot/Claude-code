'use strict';
/* ---------- Hilfsfunktionen ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const U = {
  // Schmale geschützte Leerzeichen (fr) fehlen in Bungee: durch normales Leerzeichen ersetzen
  fmt: n => Math.floor(n).toLocaleString(typeof I18N !== 'undefined' ? I18N.locale : 'de-DE').replace(/[\u202F\u00A0]/g, ' '),
  dec: () => (typeof I18N !== 'undefined' ? I18N.dec : ','),
  fmtMult(m) {
    const s = m >= 100 ? m.toFixed(0) : (Math.round(m * 10) / 10).toString();
    return s.replace('.', U.dec()) + '×';
  },
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  weighted(items, key = 'weight') {
    const total = items.reduce((s, it) => s + it[key], 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= items[i][key]; if (r < 0) return i; }
    return items.length - 1;
  },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack(t, s = 1.4) { const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // Zählt eine Zahl in einem Element animiert hoch
  countUp(el, from, to, ms, fmt = U.fmt, onTick) {
    if (el._countRaf) cancelAnimationFrame(el._countRaf);
    const t0 = performance.now();
    return new Promise(res => {
      const step = now => {
        const t = Math.min(1, (now - t0) / ms);
        const v = from + (to - from) * U.easeOutCubic(t);
        el.textContent = fmt(v);
        onTick && onTick(v, t);
        if (t < 1) el._countRaf = requestAnimationFrame(step);
        else { el._countRaf = null; res(); }
      };
      el._countRaf = requestAnimationFrame(step);
    });
  },
};

/* ---------- Speicherstand ---------- */
const Store = (() => {
  const KEY = 'neon-nights-casino-v1';
  const START = 2500;
  const defaults = () => ({
    balance: START, xp: 0, level: 1, lastBonus: 0, muted: false, peak: START,
    stats: { bets: 0, wagered: 0, won: 0, biggest: 0, spins: 0, freeSpins: 0, balls: 0, hands: 0, bj: 0, bjWins: 0, maxMult: 0, rlSpins: 0, crashRounds: 0, maxCrash: 0, minesRounds: 0, tickets: 0, rolls: 0 },
    ach: {},
  });
  let s;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    s = Object.assign(defaults(), raw || {});
    s.stats = Object.assign(defaults().stats, (raw && raw.stats) || {});
  } catch (e) { s = defaults(); }

  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignorieren */ } }, 150);
  };
  const flush = () => { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignorieren */ } };
  window.addEventListener('pagehide', flush);
  const subs = [];
  const emit = ev => subs.forEach(f => f(ev));

  const xpNeed = lvl => Math.round(150 * Math.pow(lvl, 1.55));

  function addXp(amount) {
    s.xp += amount;
    let ups = 0;
    while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; ups++; }
    if (ups) {
      const reward = 250 * s.level;
      s.balance += reward;
      emit({ type: 'balance', delta: reward });
      emit({ type: 'levelup', level: s.level, reward });
    }
    emit({ type: 'xp' });
  }

  return {
    get s() { return s; },
    xpNeed,
    on(fn) { subs.push(fn); },
    emit,
    save,
    canAfford: x => s.balance >= x,
    bet(x) {
      if (x <= 0 || s.balance < x) return false;
      s.balance -= x;
      s.stats.bets++; s.stats.wagered += x;
      emit({ type: 'balance', delta: -x });
      addXp(Math.max(1, Math.round(x / 8)));
      save();
      return true;
    },
    // net = Gewinn abzüglich Einsatz (nur echte Gewinne zählen als "größter Gewinn")
    win(x, net = x) {
      if (x <= 0) return;
      s.balance += x; s.stats.won += x;
      if (net > s.stats.biggest) s.stats.biggest = net;
      if (s.balance > s.peak) s.peak = s.balance;
      save();
      emit({ type: 'balance', delta: x });
    },
    credit(x) {
      s.balance += x;
      if (s.balance > s.peak) s.peak = s.balance;
      save();
      emit({ type: 'balance', delta: x });
    },
    // Laufende Einsätze vormerken, damit ein Neuladen mitten in der Runde nichts kostet
    hold(game, amt) { const p = s.pending || (s.pending = {}); p[game] = (p[game] || 0) + amt; flush(); },
    release(game) { if (s.pending && s.pending[game]) { delete s.pending[game]; save(); } },
    refundPending() {
      const p = s.pending || {}, sum = Object.values(p).reduce((a, b) => a + b, 0);
      s.pending = {};
      if (sum > 0) { s.balance += sum; flush(); emit({ type: 'balance', delta: sum }); }
      return sum;
    },
    stat(key, inc = 1) { s.stats[key] += inc; save(); emit({ type: 'stat', key }); },
    statMax(key, v) { if (v > s.stats[key]) { s.stats[key] = v; save(); emit({ type: 'stat', key }); } },
    reset() { s = defaults(); save(); emit({ type: 'balance', delta: 0 }); emit({ type: 'xp' }); emit({ type: 'reset' }); },
  };
})();

/* ---------- Sound (komplett synthetisiert per WebAudio) ---------- */
const Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, ambientNode = null, rocketNode = null;
  let muted = Store.s.muted;
  let vol = Store.s.volume != null ? Store.s.volume : 1;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5 * vol;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, o = {}) {
    if (!ctx || muted) return;
    const { type = 'sine', dur = 0.15, vol = 0.2, at = 0, attack = 0.004, slide = null, detune = 0 } = o;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.detune.value = detune;
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(o = {}) {
    if (!ctx || muted) return;
    const { dur = 0.08, vol = 0.2, at = 0, freq = 2000, q = 1, type = 'bandpass', sweep = null } = o;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

  return {
    init,
    get muted() { return muted; },
    setMuted(m) {
      muted = m; Store.s.muted = m; Store.save();
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.5 * vol, ctx.currentTime, 0.02);
    },
    get volume() { return vol; },
    setVolume(v) {
      vol = U.clamp(v, 0, 1); Store.s.volume = vol; Store.save();
      if (master && !muted) master.gain.setTargetAtTime(0.5 * vol, ctx.currentTime, 0.03);
    },
    click() { tone(1400, { type: 'triangle', dur: 0.04, vol: 0.08 }); },
    hover() { tone(2200, { type: 'sine', dur: 0.03, vol: 0.025 }); },
    spinStart() {
      noise({ dur: 0.35, vol: 0.12, freq: 600, sweep: 3000, q: 0.8 });
      tone(180, { type: 'sawtooth', dur: 0.25, vol: 0.05, slide: 420 });
    },
    reelTick() { noise({ dur: 0.015, vol: 0.035, freq: 4000, q: 3 }); },
    reelStop(i) {
      tone(95 - i * 4, { type: 'sine', dur: 0.16, vol: 0.4, slide: 50 });
      noise({ dur: 0.05, vol: 0.18, freq: 1800, q: 1.2 });
      tone(N(84 + i * 2), { type: 'triangle', dur: 0.06, vol: 0.05, at: 0.01 });
    },
    anticipation() {
      for (let i = 0; i < 8; i++) tone(N(72 + i), { type: 'square', dur: 0.08, vol: 0.03, at: i * 0.11 });
    },
    scatterLand(n) {
      tone(N(76 + n * 3), { type: 'triangle', dur: 0.3, vol: 0.15 });
      tone(N(83 + n * 3), { type: 'sine', dur: 0.4, vol: 0.1, at: 0.05 });
    },
    win(level = 1) {
      const seq = level >= 3 ? [72, 76, 79, 84, 88, 91, 96] : level === 2 ? [72, 76, 79, 84, 88] : [76, 79, 84];
      seq.forEach((n, i) => {
        tone(N(n), { type: 'triangle', dur: 0.22, vol: 0.14, at: i * 0.07 });
        tone(N(n + 12), { type: 'sine', dur: 0.18, vol: 0.05, at: i * 0.07 + 0.01 });
      });
    },
    coin(pitch = 0) {
      tone(N(95 + pitch), { type: 'square', dur: 0.06, vol: 0.035 });
      tone(N(100 + pitch), { type: 'square', dur: 0.14, vol: 0.035, at: 0.05 });
    },
    countTick() { tone(N(96), { type: 'sine', dur: 0.03, vol: 0.03 }); },
    bigWin() {
      const chords = [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [72, 76, 79, 84, 88]];
      chords.forEach((ch, i) => ch.forEach(n => {
        tone(N(n), { type: 'sawtooth', dur: 0.5, vol: 0.035, at: i * 0.28, attack: 0.02 });
        tone(N(n + 12), { type: 'triangle', dur: 0.45, vol: 0.04, at: i * 0.28 });
      }));
      noise({ dur: 1.4, vol: 0.05, freq: 6000, q: 0.5, at: 0.8, type: 'highpass' });
    },
    peg(row, rows) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
      tone(N(72 + scale[Math.min(15, Math.floor(row / rows * 16))]), { type: 'sine', dur: 0.09, vol: 0.06 });
    },
    bin(mult) {
      if (mult >= 10) this.win(mult >= 100 ? 3 : 2);
      else if (mult >= 1) { tone(N(84), { type: 'triangle', dur: 0.15, vol: 0.1 }); tone(N(91), { type: 'triangle', dur: 0.2, vol: 0.08, at: 0.06 }); }
      else tone(N(60), { type: 'triangle', dur: 0.15, vol: 0.08, slide: N(55) });
    },
    card() { noise({ dur: 0.12, vol: 0.14, freq: 3200, q: 0.7, sweep: 1200 }); },
    flip() { noise({ dur: 0.06, vol: 0.12, freq: 2400, q: 1 }); tone(1200, { type: 'triangle', dur: 0.03, vol: 0.03 }); },
    chip() {
      tone(N(100), { type: 'square', dur: 0.03, vol: 0.04 });
      noise({ dur: 0.04, vol: 0.15, freq: 5000, q: 4 });
      noise({ dur: 0.03, vol: 0.1, freq: 3500, q: 4, at: 0.035 });
    },
    lose() {
      tone(N(64), { type: 'triangle', dur: 0.2, vol: 0.1 });
      tone(N(59), { type: 'triangle', dur: 0.35, vol: 0.1, at: 0.14 });
    },
    push() { tone(N(69), { type: 'triangle', dur: 0.2, vol: 0.08 }); },
    blackjack() { this.win(3); },
    levelUp() {
      [67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), { type: 'square', dur: 0.14, vol: 0.05, at: i * 0.08 }));
      tone(N(91), { type: 'triangle', dur: 0.6, vol: 0.1, at: 0.4 });
    },
    wheelTick() { tone(2600, { type: 'square', dur: 0.015, vol: 0.05 }); noise({ dur: 0.02, vol: 0.08, freq: 3000, q: 2 }); },
    error() { tone(160, { type: 'square', dur: 0.12, vol: 0.06 }); tone(120, { type: 'square', dur: 0.16, vol: 0.06, at: 0.1 }); },
    achievement() {
      [79, 84, 88, 91].forEach((n, i) => tone(N(n), { type: 'triangle', dur: 0.3, vol: 0.08, at: i * 0.09 }));
    },
    step() { noise({ dur: 0.05, vol: 0.035, freq: 380, q: 0.8, type: 'lowpass' }); },
    // Leises Stimmengewirr + entfernte Automaten-Klänge in der Halle
    ambient(on) {
      if (!ctx) return;
      if (on && !ambientNode) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6;
        const gg = ctx.createGain(); gg.gain.value = 0; gg.gain.setTargetAtTime(0.045, ctx.currentTime, 1);
        src.connect(f); f.connect(gg); gg.connect(master); src.start();
        ambientNode = { src, gg };
        const chime = () => {
          if (!ambientNode) return;
          const base = U.pick([72, 74, 76, 79]);
          [0, 4, 7, 12].forEach((d, i) => tone(N(base + d), { type: 'triangle', dur: 0.25, vol: 0.012, at: i * 0.09 }));
          ambientNode.t = setTimeout(chime, U.rand(3500, 9000));
        };
        ambientNode.t = setTimeout(chime, 2000);
      } else if (!on && ambientNode) {
        const a = ambientNode; ambientNode = null; clearTimeout(a.t);
        a.gg.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => { try { a.src.stop(); } catch (e) { /* schon gestoppt */ } }, 800);
      }
    },
    roll(sec) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(700, t + sec);
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.09, t + 0.2); gg.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      src.connect(f); f.connect(gg); gg.connect(master); src.start(t); src.stop(t + sec + 0.1);
    },
    bounce(k = 1) { tone(900 + Math.random() * 400, { type: 'triangle', dur: 0.04, vol: 0.06 * k + 0.02 }); noise({ dur: 0.03, vol: 0.1 * k + 0.03, freq: 3500, q: 3 }); },
    pocket() { tone(700, { type: 'triangle', dur: 0.06, vol: 0.1 }); noise({ dur: 0.06, vol: 0.14, freq: 2600, q: 2 }); tone(500, { type: 'triangle', dur: 0.05, vol: 0.06, at: 0.08 }); },
    rocket(on) {
      if (!ctx) return;
      if (on && !rocketNode && !muted) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        const gg = ctx.createGain(); gg.gain.value = 0; gg.gain.setTargetAtTime(0.06, ctx.currentTime, 0.3);
        o.connect(f); src.connect(f); f.connect(gg); gg.connect(master); o.start(); src.start();
        o.frequency.linearRampToValueAtTime(140, ctx.currentTime + 30);
        f.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 30);
        rocketNode = { o, src, gg };
      } else if (!on && rocketNode) {
        const r = rocketNode; rocketNode = null;
        r.gg.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => { try { r.o.stop(); r.src.stop(); } catch (e) { /* schon gestoppt */ } }, 300);
      }
    },
    explode() {
      noise({ dur: 0.9, vol: 0.35, freq: 900, q: 0.5, type: 'lowpass', sweep: 80 });
      tone(90, { type: 'sine', dur: 0.6, vol: 0.4, slide: 30 });
      noise({ dur: 0.3, vol: 0.15, freq: 4000, q: 0.7, at: 0.02 });
    },
    gem(k = 1) {
      const n = 76 + Math.min(20, k * 2);
      tone(N(n), { type: 'triangle', dur: 0.2, vol: 0.12 }); tone(N(n + 7), { type: 'sine', dur: 0.3, vol: 0.08, at: 0.05 });
      tone(N(n + 12), { type: 'sine', dur: 0.35, vol: 0.05, at: 0.1 });
    },
    scratch() { noise({ dur: 0.06, vol: 0.05, freq: 5200 + Math.random() * 2000, q: 1.5, type: 'highpass' }); },
    diceShake() { for (let i = 0; i < 6; i++) noise({ dur: 0.04, vol: 0.12, freq: 2200 + Math.random() * 1500, q: 3, at: i * 0.06 }); },
    diceLand() { noise({ dur: 0.05, vol: 0.2, freq: 1400, q: 1.5 }); tone(220, { type: 'triangle', dur: 0.06, vol: 0.12 }); },
  };
})();

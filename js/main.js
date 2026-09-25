'use strict';
/* ---------- Große Gewinn-Show & Banner ---------- */
const Celebrate = (() => {
  const bw = $('#bigwin'), bwTitle = $('#bwTitle'), bwAmount = $('#bwAmount'), bwSub = $('#bwSub');
  const bn = $('#banner'), bnTitle = $('#bnTitle'), bnSub = $('#bnSub');

  function bigWin(amount, bet) {
    const ratio = amount / bet;
    const tier = ratio >= 100 ? 3 : ratio >= 40 ? 2 : 1;
    bwTitle.textContent = ['', 'BIG WIN', 'MEGA WIN', 'EPIC WIN'][tier];
    bw.dataset.tier = tier;
    bwSub.textContent = `${U.fmtMult(Math.round(ratio * 10) / 10)} deines Einsatzes`;
    bwAmount.textContent = '0';
    bw.hidden = false;
    requestAnimationFrame(() => bw.classList.add('show'));
    Sfx.bigWin();
    FX.confetti(140);
    FX.coinRain(60 + tier * 30, true);
    const dur = 2200 + tier * 900;
    let skipped = false, rainT;
    rainT = setInterval(() => FX.coinRain(25, true), 900);
    return new Promise(res => {
      let lastTick = 0;
      const done = () => {
        clearInterval(rainT);
        bw.classList.remove('show');
        setTimeout(() => { bw.hidden = true; res(); }, 350);
      };
      const skip = () => {
        if (skipped) return; skipped = true;
        if (bwAmount._countRaf) cancelAnimationFrame(bwAmount._countRaf);
        bwAmount.textContent = U.fmt(amount);
        setTimeout(done, 700);
      };
      bw.onclick = skip;
      U.countUp(bwAmount, 0, amount, dur, U.fmt, v => {
        if (v - lastTick > amount / 30) { lastTick = v; Sfx.coin(Math.floor(v / amount * 8)); }
      }).then(() => { if (!skipped) { skipped = true; FX.flash(); setTimeout(done, 1400); } });
    });
  }

  function banner(title, sub, kind = '') {
    bnTitle.textContent = title; bnSub.textContent = sub;
    const star = $('#bnStar');
    if (!star.src) { const c = document.createElement('canvas'); c.width = c.height = 220; c.getContext('2d').drawImage(Symbols.sprite('scatter', 220, true), 0, 0); star.src = c.toDataURL(); }
    bn.dataset.kind = kind;
    bn.hidden = false;
    requestAnimationFrame(() => bn.classList.add('show'));
    if (kind === 'fs') { Sfx.win(3); FX.confetti(90); FX.stars(window.innerWidth / 2, window.innerHeight / 2, 24, '#ffb3f0'); }
    else Sfx.win(2);
    return new Promise(res => {
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        bn.classList.remove('show');
        setTimeout(() => { bn.hidden = true; res(); }, 300);
      };
      bn.onclick = close;
      setTimeout(close, 2600);
    });
  }
  return { bigWin, banner };
})();

/* ---------- Bonusrad ---------- */
const Wheel = (() => {
  const W = CFG.wheel;
  const canvas = $('#wheelCanvas'), g = canvas.getContext('2d');
  const btn = $('#wheelSpin'), result = $('#wheelResult'), pointer = $('#wheelPointer');
  const N = W.segments.length, SEG = Math.PI * 2 / N;
  let angle = 0, spinning = false, size = 0, dpr = 1, lastSeg = 0, bulbPhase = 0, raf = null, open = false;

  const cooldownMs = W.cooldownMin * 60 * 1000;
  const rescue = () => Store.s.balance < 10;
  const ready = () => rescue() || Date.now() - Store.s.lastBonus >= cooldownMs;
  const remaining = () => Math.max(0, cooldownMs - (Date.now() - Store.s.lastBonus));

  function resize() {
    const box = canvas.parentElement.clientWidth;
    size = Math.min(420, box);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    canvas.style.width = canvas.style.height = size + 'px';
  }

  function draw(now) {
    const R = size / 2, c = R;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    // Außenring
    const ring = g.createRadialGradient(c, c, R * 0.82, c, c, R);
    ring.addColorStop(0, '#5a3a00'); ring.addColorStop(0.3, '#ffd46a'); ring.addColorStop(0.6, '#b97a00'); ring.addColorStop(1, '#4a2c00');
    g.fillStyle = ring; g.beginPath(); g.arc(c, c, R - 1, 0, Math.PI * 2); g.fill();
    const rIn = R * 0.86;
    g.save(); g.translate(c, c); g.rotate(angle);
    for (let i = 0; i < N; i++) {
      const s = W.segments[i];
      const a0 = -Math.PI / 2 + i * SEG, a1 = a0 + SEG;
      const sg = g.createRadialGradient(0, 0, rIn * 0.2, 0, 0, rIn);
      sg.addColorStop(0, shade(s.c, 40)); sg.addColorStop(1, shade(s.c, -25));
      g.fillStyle = sg;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rIn, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,220,140,0.85)'; g.lineWidth = 2; g.stroke();
      // Beschriftung
      const mid = a0 + SEG / 2 + angle;
      const flipText = Math.cos(mid) < -0.01; // linke Hälfte: Text nicht kopfüber
      g.save(); g.rotate(a0 + SEG / 2);
      if (flipText) g.rotate(Math.PI);
      g.textAlign = flipText ? 'left' : 'right'; g.textBaseline = 'middle';
      const big = s.v >= 2500;
      g.font = `${big ? '' : ''}${Math.round(rIn * (big ? 0.13 : 0.115))}px "Bungee", Impact, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(20,6,30,0.8)';
      const label = s.v >= 1000 ? (s.v / 1000).toString().replace('.', U.dec()) + 'K' : String(s.v);
      const tx = flipText ? -rIn * 0.9 : rIn * 0.9;
      g.strokeText(label, tx, 0);
      g.fillStyle = big ? '#fff6c8' : '#ffffff'; g.fillText(label, tx, 0);
      g.restore();
    }
    g.restore();
    // Glühbirnen am Rand
    for (let i = 0; i < N * 2; i++) {
      const a = -Math.PI / 2 + i * SEG / 2;
      const x = c + Math.cos(a) * R * 0.93, y = c + Math.sin(a) * R * 0.93;
      const on = spinning ? (Math.floor(bulbPhase) + i) % 2 === 0 : (Math.floor(now / 400) + i) % 3 !== 0;
      const bg = g.createRadialGradient(x, y, 0, x, y, R * 0.045);
      bg.addColorStop(0, on ? '#fffbe0' : '#8a6a2a'); bg.addColorStop(0.5, on ? '#ffd23f' : '#5a4010'); bg.addColorStop(1, on ? 'rgba(255,210,63,0)' : 'rgba(90,64,16,0)');
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, R * (on ? 0.05 : 0.03), 0, Math.PI * 2); g.fill();
    }
    // Nabe
    const hub = g.createRadialGradient(c - R * 0.04, c - R * 0.05, 2, c, c, R * 0.17);
    hub.addColorStop(0, '#fff5d0'); hub.addColorStop(0.5, '#f0b42a'); hub.addColorStop(1, '#6a3c00');
    g.fillStyle = hub; g.beginPath(); g.arc(c, c, R * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a0e3a'; g.beginPath(); g.arc(c, c, R * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd23f'; g.font = `${Math.round(R * 0.1)}px "Bungee", Impact, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', c, c + 1);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => U.clamp(v + amt, 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function loop(now) {
    if (!open) { raf = null; return; }
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function spin() {
    if (spinning || !ready()) return;
    Sfx.init();
    spinning = true; btn.disabled = true;
    result.textContent = 'Das Rad dreht sich …'; result.className = 'wheel-result';
    const idx = U.weighted(W.segments, 'w');
    const jitter = U.rand(-0.32, 0.32) * SEG;
    const targetMod = ((-(idx + 0.5) * SEG + jitter) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const curMod = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = targetMod - curMod; if (delta < 0) delta += Math.PI * 2;
    const from = angle, to = angle + Math.PI * 2 * 6 + delta;
    const dur = 5200, t0 = performance.now();
    lastSeg = Math.floor(from / SEG);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      angle = from + (to - from) * U.easeOutQuart(t);
      bulbPhase += 0.35;
      const seg = Math.floor(angle / SEG);
      if (seg !== lastSeg) {
        lastSeg = seg; Sfx.wheelTick();
        pointer.classList.remove('tick'); void pointer.offsetWidth; pointer.classList.add('tick');
      }
      if (t < 1) requestAnimationFrame(step);
      else finish(idx);
    };
    requestAnimationFrame(step);
  }

  function finish(idx) {
    spinning = false;
    const v = W.segments[idx].v;
    Store.s.lastBonus = Date.now();
    Store.credit(v);
    Store.emit({ type: 'wheel', value: v });
    result.innerHTML = `Du gewinnst <b>${U.fmt(v)}</b> Münzen!`;
    result.className = 'wheel-result win';
    Sfx.win(v >= 2500 ? 3 : 2);
    const c = FX.center(canvas);
    FX.coins(c.x, c.y, v >= 2500 ? 50 : 25, 1.2);
    if (v >= 2500) FX.confetti(120);
    App.updateBonus();
    updateBtn();
  }

  function updateBtn() {
    if (spinning) return;
    const ok = ready();
    btn.disabled = !ok;
    if (ok) btn.textContent = rescue() ? 'Rettungs-Dreh!' : 'Drehen!';
    else {
      const ms = remaining(), m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
      btn.textContent = `Wieder in ${m}:${String(s).padStart(2, '0')}`;
    }
  }

  btn.addEventListener('click', spin);
  window.addEventListener('resize', () => { if (open) resize(); });
  return {
    ready, remaining, rescue, updateBtn,
    open() {
      open = true; resize(); updateBtn();
      result.textContent = ready() ? (rescue() ? 'Leere Taschen? Das Rad hilft dir wieder auf die Beine.' : 'Dein Gratis-Dreh ist bereit.') : 'Dein nächster Gratis-Dreh lädt noch.';
      result.className = 'wheel-result';
      if (!raf) raf = requestAnimationFrame(loop);
    },
    close() { open = false; },
    get spinning() { return spinning; },
  };
})();


/* ---------- Kleine gezeichnete Icons (Erfolge, Spielemenü) ---------- */
const Icons = (() => {
  const cache = new Map();
  function url(spec) {
    if (cache.has(spec)) return cache.get(spec);
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const [kind, arg] = spec.split(':');
    const x = S / 2, y = S / 2;
    if (kind === 'sym') g.drawImage(Symbols.sprite(arg, S, true), 0, 0, S, S);
    else if (kind === 'card') {
      const red = /[♥♦]/.test(arg);
      g.save(); g.translate(x, y); g.rotate(-0.16);
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(-24, -33, 48, 66, 6) : g.rect(-24, -33, 48, 66); g.fill();
      g.shadowColor = 'transparent';
      g.fillStyle = red ? '#d0103a' : '#1b1330';
      g.font = '700 15px Rubik, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(arg[0], -19, -29);
      g.font = '34px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(arg.slice(1) + '︎', 0, 4);
      g.restore();
    } else if (kind === 'ball') {
      const gold = arg === 'gold', r = 22;
      const gl = g.createRadialGradient(x, y, 0, x, y, r * 1.9);
      gl.addColorStop(0, gold ? 'rgba(255,210,63,.6)' : 'rgba(255,110,190,.6)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl; g.fillRect(0, 0, S, S);
      const bg = g.createRadialGradient(x - 7, y - 8, 2, x, y, r);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.4, gold ? '#ffe27a' : '#ffc2e4'); bg.addColorStop(1, gold ? '#c47a00' : '#ff2f86');
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    } else if (kind === 'lvl') {
      g.beginPath();
      for (let k = 0; k < 16; k++) { const rr = k % 2 ? 30 : 38, a = -Math.PI / 2 + k * Math.PI / 8; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath();
      const lg = g.createRadialGradient(x - 8, y - 10, 4, x, y, 38);
      lg.addColorStop(0, '#d8c2ff'); lg.addColorStop(0.5, '#8a4dff'); lg.addColorStop(1, '#3a1280');
      g.fillStyle = lg; g.fill();
      g.fillStyle = '#fff'; g.font = `${arg.length > 1 ? 24 : 30}px Bungee, Impact, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(arg, x, y + 2);
    } else if (kind === 'coins') {
      for (let i = 0; i < 4; i++) {
        const yy = 66 - i * 11;
        g.fillStyle = '#9a5b00'; g.beginPath(); g.ellipse(48, yy + 4, 27, 10, 0, 0, Math.PI * 2); g.fill();
        const cg = g.createLinearGradient(21, 0, 75, 0);
        cg.addColorStop(0, '#c47a00'); cg.addColorStop(0.4, '#fff0a8'); cg.addColorStop(1, '#d08a10');
        g.fillStyle = cg; g.beginPath(); g.ellipse(48, yy, 27, 10, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (kind === 'rl') {
      const R = 36, REDS = [1, 3, 5, 7, 9];
      g.fillStyle = '#5a2a0a'; g.beginPath(); g.arc(x, y, R + 5, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 18; i++) {
        g.fillStyle = i === 0 ? '#128a4a' : i % 2 ? '#b3122e' : '#15101c';
        g.beginPath(); g.moveTo(x, y); g.arc(x, y, R, i * Math.PI / 9, (i + 1) * Math.PI / 9); g.closePath(); g.fill();
      }
      const cone = g.createRadialGradient(x - 4, y - 4, 2, x, y, R * 0.55);
      cone.addColorStop(0, '#e0a050'); cone.addColorStop(1, '#5a2c08');
      g.fillStyle = cone; g.beginPath(); g.arc(x, y, R * 0.55, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd46a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.moveTo(x, y - 14); g.lineTo(x, y + 14); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + R * 0.8, y - R * 0.3, 4.5, 0, Math.PI * 2); g.fill();
      void REDS;
    } else if (kind === 'rocket') {
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
      const fg = g.createLinearGradient(-14, 0, -40, 0); fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.5, '#ffb030'); fg.addColorStop(1, 'rgba(255,60,40,0)');
      g.fillStyle = fg; g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-44, 0, -14, 8); g.closePath(); g.fill();
      const b = g.createLinearGradient(0, -12, 0, 12); b.addColorStop(0, '#fff'); b.addColorStop(1, '#8a80a0');
      g.fillStyle = b; g.beginPath(); g.moveTo(30, 0); g.quadraticCurveTo(16, -13, -14, -11); g.lineTo(-14, 11); g.quadraticCurveTo(16, 13, 30, 0); g.fill();
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(30, 0); g.quadraticCurveTo(24, -8, 17, -9); g.lineTo(17, 9); g.quadraticCurveTo(24, 8, 30, 0); g.fill();
      g.beginPath(); g.moveTo(-6, -11); g.lineTo(-20, -22); g.lineTo(-14, -5); g.fill(); g.beginPath(); g.moveTo(-6, 11); g.lineTo(-20, 22); g.lineTo(-14, 5); g.fill();
      g.fillStyle = '#3be8ff'; g.beginPath(); g.arc(5, 0, 5.5, 0, Math.PI * 2); g.fill();
      g.restore();
    } else if (kind === 'gem') {
      g.save(); g.translate(8, 10); g.scale(1.25, 1.25);
      const gg = g.createLinearGradient(0, 0, 64, 64); gg.addColorStop(0, '#e8feff'); gg.addColorStop(0.5, '#3be8ff'); gg.addColorStop(1, '#0a6aa0');
      g.fillStyle = gg; g.beginPath(); g.moveTo(18, 10); g.lineTo(46, 10); g.lineTo(58, 24); g.lineTo(32, 56); g.lineTo(6, 24); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(6, 24); g.lineTo(58, 24); g.moveTo(24, 24); g.lineTo(32, 56); g.lineTo(40, 24); g.stroke();
      g.restore();
    } else if (kind === 'ticket') {
      g.save(); g.translate(x, y); g.rotate(-0.2);
      g.fillStyle = '#ffc94a'; g.beginPath(); g.roundRect ? g.roundRect(-26, -32, 52, 64, 6) : g.rect(-26, -32, 52, 64); g.fill();
      g.fillStyle = '#c8c6d2'; g.fillRect(-18, -12, 36, 30);
      g.fillStyle = '#ff3d8b'; g.font = '11px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('LOS', 0, -18);
      g.drawImage(Symbols.sprite('seven', 64, true), -12, -8, 24, 24);
      g.restore();
    } else if (kind === 'dice') {
      const die = (dx, dy, rot, pips) => {
        g.save(); g.translate(dx, dy); g.rotate(rot);
        g.fillStyle = '#f4f0fa'; g.beginPath(); g.roundRect ? g.roundRect(-16, -16, 32, 32, 7) : g.rect(-16, -16, 32, 32); g.fill();
        g.fillStyle = '#d0103a'; pips.forEach(([px, py]) => { g.beginPath(); g.arc(px * 8, py * 8, 3.2, 0, Math.PI * 2); g.fill(); });
        g.restore();
      };
      die(34, 54, -0.3, [[-1, -1], [1, 1], [0, 0]]); die(62, 40, 0.25, [[-1, -1], [1, -1], [-1, 1], [1, 1]]);
    }
    else if (kind === 'vp') {
      const card = (dx, rot, suit, red) => { g.save(); g.translate(x + dx, y + 6); g.rotate(rot); g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(-14, -22, 28, 40, 4) : g.rect(-14, -22, 28, 40); g.fill(); g.fillStyle = red ? '#d0103a' : '#1b1330'; g.font = '20px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(suit + '\uFE0E', 0, 0); g.restore(); };
      card(-22, -0.35, '♠', false); card(-8, -0.12, '♥', true); card(8, 0.12, '♦', true); card(22, 0.35, '♣', false);
      g.fillStyle = '#3be8ff'; g.font = '11px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('POKER', x, 86);
    } else if (kind === 'keno') {
      [[30, 38, '#ff3d8b', 7], [60, 34, '#ffc94a', 23], [44, 64, '#3be8ff', 40]].forEach(([bx, by, col, n]) => {
        const bg = g.createRadialGradient(bx - 5, by - 5, 2, bx, by, 17); bg.addColorStop(0, '#fff'); bg.addColorStop(0.35, col); bg.addColorStop(1, Avatar.shade(col, -70));
        g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 17, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1a0826'; g.font = '10px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), bx, by + 1);
      });
    } else if (kind === 'hilo') {
      g.save(); g.translate(x, y); g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(-18, -26, 36, 52, 5) : g.rect(-18, -26, 36, 52); g.fill();
      g.fillStyle = '#1b1330'; g.font = '700 22px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2); g.restore();
      g.fillStyle = '#5dffb0'; g.beginPath(); g.moveTo(80, 22); g.lineTo(92, 40); g.lineTo(68, 40); g.closePath(); g.fill();
      g.fillStyle = '#ff5d6c'; g.beginPath(); g.moveTo(16, 74); g.lineTo(28, 56); g.lineTo(4, 56); g.closePath(); g.fill();
    } else if (kind === 'bacc') {
      const card = (dx, rot, t) => { g.save(); g.translate(x + dx, y - 4); g.rotate(rot); g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(-15, -22, 30, 42, 4) : g.rect(-15, -22, 30, 42); g.fill(); g.fillStyle = '#1b1330'; g.font = '700 16px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); g.restore(); };
      card(-12, -0.2, '9'); card(12, 0.18, 'K');
      [['#2f7bff', 30], ['#e0103a', 66]].forEach(([c, cx]) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, 80, 14, 6, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); });
    }
    else if (kind === 'cat') {
      const fur = arg === 'gold' ? '#ffb347' : '#f0a860';
      g.fillStyle = fur;
      g.beginPath(); g.moveTo(20, 40); g.lineTo(26, 12); g.lineTo(42, 30); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(76, 40); g.lineTo(70, 12); g.lineTo(54, 30); g.closePath(); g.fill();
      const fg = g.createRadialGradient(40, 44, 4, 48, 52, 32); fg.addColorStop(0, '#ffd8a0'); fg.addColorStop(1, '#d07a30');
      g.fillStyle = fg; g.beginPath(); g.ellipse(48, 54, 30, 26, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff9ab8'; [[27, 26], [69, 26]].forEach(([ex]) => { g.beginPath(); g.moveTo(ex - 3, 34); g.lineTo(ex + (ex < 48 ? 0 : 0), 20); g.lineTo(ex + 4 * (ex < 48 ? 1 : -1) + (ex < 48 ? 5 : -5), 32); g.closePath(); g.fill(); });
      g.fillStyle = '#2a1a0a'; g.beginPath(); g.ellipse(37, 50, 4, 5.5, 0, 0, Math.PI * 2); g.ellipse(59, 50, 4, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(38.5, 48, 1.6, 0, Math.PI * 2); g.arc(60.5, 48, 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6a8a'; g.beginPath(); g.moveTo(44, 60); g.lineTo(52, 60); g.lineTo(48, 65); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,30,10,0.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(48, 65); g.quadraticCurveTo(44, 71, 40, 68); g.moveTo(48, 65); g.quadraticCurveTo(52, 71, 56, 68);
      [[-1, 60], [-1, 64], [1, 60], [1, 64]].forEach(([d, wy]) => { g.moveTo(48 + d * 10, wy); g.lineTo(48 + d * 30, wy - 3 + (wy - 60)); }); g.stroke();
      if (arg === 'gold') { g.fillStyle = '#ff3d8b'; g.font = '22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 80, 78); }
    } else if (kind === 'heart') {
      const hg = g.createRadialGradient(40, 36, 4, 48, 50, 40); hg.addColorStop(0, '#ffc2dc'); hg.addColorStop(0.5, '#ff3d8b'); hg.addColorStop(1, '#9a0a4a');
      g.fillStyle = hg; g.beginPath(); g.moveTo(48, 80);
      g.bezierCurveTo(10, 56, 12, 20, 34, 20); g.bezierCurveTo(42, 20, 48, 28, 48, 32); g.bezierCurveTo(48, 28, 54, 20, 62, 20); g.bezierCurveTo(84, 20, 86, 56, 48, 80); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(34, 32, 7, 4, -0.6, 0, Math.PI * 2); g.fill();
    } else if (kind === 'bus') {
      const bg = g.createLinearGradient(0, 22, 0, 74); bg.addColorStop(0, '#ff6aa6'); bg.addColorStop(1, '#a0105a');
      g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(8, 22, 80, 50, 9) : g.rect(8, 22, 80, 50); g.fill();
      g.fillStyle = 'rgba(160,220,255,0.85)'; for (let i = 0; i < 4; i++) g.fillRect(14 + i * 17, 30, 13, 16);
      g.fillStyle = '#ffc94a'; g.fillRect(8, 52, 80, 4);
      g.fillStyle = '#111'; [28, 70].forEach(wx => { g.beginPath(); g.arc(wx, 74, 9, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#8a8298'; [28, 70].forEach(wx => { g.beginPath(); g.arc(wx, 74, 3.5, 0, Math.PI * 2); g.fill(); });
    } else if (kind === 'hat') {
      g.save(); g.translate(48, 72); g.scale(2.4, 2.4); Avatar.drawHat(g, arg || 'tophat', 0, false, 1, 0, '#ffc94a'); g.restore();
    } else if (kind === 'swing') {
      g.strokeStyle = '#c9a8ff'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(14, 84); g.lineTo(26, 14); g.lineTo(70, 14); g.lineTo(82, 84); g.stroke();
      g.strokeStyle = '#e8e0f0'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 14); g.lineTo(34, 60); g.moveTo(56, 14); g.lineTo(50, 60); g.stroke();
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.roundRect ? g.roundRect(29, 58, 26, 6, 3) : g.rect(29, 58, 26, 6); g.fill();
      g.fillStyle = '#ffc94a'; g.font = '20px serif'; g.textAlign = 'center'; g.fillText('★', 70, 48);
    }
    const u = c.toDataURL();
    cache.set(spec, u);
    return u;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => cache.clear());
  return { url };
})();

/* ---------- Spieleliste (Schnellreise, Profil) ---------- */
const GAMES = [
  { id: 'slots', name: 'Lucky Seven Deluxe', sub: 'Slot · Freispiele', icon: 'sym:seven', color: '#ffc94a' },
  { id: 'roulette', name: 'Grand Roulette', sub: 'Europäisch · 35:1', icon: 'rl', color: '#5dffb0' },
  { id: 'blackjack', name: 'Midnight Blackjack', sub: '3:2 · Split', icon: 'card:A♠', color: '#5dffb0' },
  { id: 'plinko', name: 'Neon Plinko', sub: 'Bis 1000×', icon: 'ball:pink', color: '#ff7ab4' },
  { id: 'crash', name: 'Rocket Crash', sub: 'Rechtzeitig aussteigen', icon: 'rocket', color: '#ff8a5d' },
  { id: 'mines', name: 'Diamond Mines', sub: 'Juwelen statt Bomben', icon: 'gem', color: '#3be8ff' },
  { id: 'scratch', name: 'Rubbellose', sub: 'Bis 100× pro Los', icon: 'ticket', color: '#ffc94a' },
  { id: 'dice', name: 'Würfel-Duell', sub: 'Unter · 7 · Über', icon: 'dice', color: '#ff8a3d' },
  { id: 'poker', name: 'Jacks or Better', sub: 'Video-Poker', icon: 'vp', color: '#3be8ff' },
  { id: 'keno', name: 'Neon Keno', sub: '10 aus 40', icon: 'keno', color: '#9d5cff' },
  { id: 'hilo', name: 'Hi-Lo', sub: 'Höher oder niedriger', icon: 'hilo', color: '#5dffb0' },
  { id: 'baccarat', name: 'Royal Baccarat', sub: 'Spieler · Bank · Unentschieden', icon: 'bacc', color: '#ffc94a' },
];

/* ---------- Erfolge ---------- */
const Achievements = (() => {
  const LIST = [
    { id: 'first_win', icon: 'sym:cherry', name: 'Erster Treffer', desc: 'Gewinne zum ersten Mal am Slot.' },
    { id: 'big_win', icon: 'sym:seven', name: 'Big Win', desc: 'Gewinne das 15-fache deines Einsatzes.' },
    { id: 'free_spins', icon: 'sym:scatter', name: 'Sternenregen', desc: 'Löse Freispiele aus.' },
    { id: 'five_kind', icon: 'sym:wild', name: 'Volle Linie', desc: '5 gleiche Symbole auf einer Linie.' },
    { id: 'blackjack', icon: 'card:A♠', name: 'Natürlich!', desc: 'Bekomme einen Blackjack.' },
    { id: 'bj_streak', icon: 'card:K♥', name: 'Heiße Hand', desc: 'Gewinne 3 Blackjack-Runden in Folge.' },
    { id: 'plinko_10', icon: 'ball:pink', name: 'Guter Fall', desc: 'Triff bei Plinko mindestens 10×.' },
    { id: 'plinko_100', icon: 'ball:gold', name: 'Plinko-Legende', desc: 'Triff bei Plinko 100× oder mehr.' },
    { id: 'rl_straight', icon: 'rl', name: 'Volltreffer', desc: 'Triff beim Roulette eine einzelne Zahl.' },
    { id: 'crash_10', icon: 'rocket', name: 'Zum Mond', desc: 'Zahl bei Rocket Crash ab 10× aus.' },
    { id: 'mines_10', icon: 'gem', name: 'Minenräumer', desc: 'Finde 10 Juwelen in einer Mines-Runde.' },
    { id: 'scratch_25', icon: 'ticket', name: 'Goldenes Los', desc: 'Rubbel mindestens 25× frei.' },
    { id: 'dice_pair', icon: 'dice', name: 'Pasch-König', desc: 'Gewinne mit einer Pasch-Wette.' },
    { id: 'vp_full', icon: 'vp', name: 'Volles Haus', desc: 'Erziele beim Video-Poker ein Full House oder besser.' },
    { id: 'keno_6', icon: 'keno', name: 'Zahlenglück', desc: 'Triff beim Keno 6 oder mehr Zahlen.' },
    { id: 'hilo_5', icon: 'hilo', name: 'Kartenleser', desc: 'Rate beim Hi-Lo 5-mal in Folge richtig.' },
    { id: 'bacc_tie', icon: 'bacc', name: 'Patt-Profi', desc: 'Gewinne beim Baccarat eine Unentschieden-Wette.' },
    { id: 'explorer', icon: 'sym:clover', name: 'Nachtschwärmer', desc: 'Spiele an allen 12 Tischen und Automaten.' },
    { id: 'cat_pet', icon: 'cat', name: 'Samtpfote', desc: 'Streichle Katze Mimi in der Nachbarschaft.' },
    { id: 'cat_best', icon: 'cat:gold', name: 'Beste Freunde', desc: 'Bring Mimis Zuneigung auf 100 %.' },
    { id: 'cat_follow', icon: 'heart', name: 'Treue Begleiterin', desc: 'Nimm Mimi mit dem Bus an einen anderen Ort mit.' },
    { id: 'traveler', icon: 'bus', name: 'Stadtbummel', desc: 'Besuche alle fünf Orte der Stadt.' },
    { id: 'hat', icon: 'hat:tophat', name: 'Gut behütet', desc: 'Kauf dir einen Hut beim Hutmacher.' },
    { id: 'playground', icon: 'swing', name: 'Kind geblieben', desc: 'Probiere alles auf dem Spielplatz aus.' },
    { id: 'level_5', icon: 'lvl:5', name: 'Stammgast', desc: 'Erreiche Level 5.' },
    { id: 'level_10', icon: 'lvl:10', name: 'VIP-Lounge', desc: 'Erreiche Level 10.' },
    { id: 'rich_10k', icon: 'coins:3', name: 'Fünfstellig', desc: 'Besitze 10.000 Münzen.' },
    { id: 'rich_100k', icon: 'sym:diamond', name: 'High Roller', desc: 'Besitze 100.000 Münzen.' },
  ];

  function unlock(id) {
    const s = Store.s;
    if (s.ach[id]) return;
    s.ach[id] = Date.now(); Store.save();
    const a = LIST.find(x => x.id === id);
    Sfx.achievement();
    Toast.show('Erfolg freigeschaltet', a.name, `<img src="${Icons.url(a.icon)}" alt="">`, 'ach');
    render();
  }
  function played(game) {
    const p = Store.s.played || (Store.s.played = {});
    if (!p[game]) { p[game] = 1; Store.save(); }
    if (GAMES.every(gm => p[gm.id])) unlock('explorer');
  }
  function check(ev) {
    const s = Store.s;
    if (ev.type === 'slotResult') {
      played('slots');
      if (ev.total > 0) unlock('first_win');
      if (ev.total >= ev.bet * 15) unlock('big_win');
      if (ev.lines.some(l => l.n === 5)) unlock('five_kind');
    }
    if (ev.type === 'freeSpins') unlock('free_spins');
    if (ev.type === 'bjResult') { played('blackjack'); if (ev.blackjack) unlock('blackjack'); if (ev.streak >= 3) unlock('bj_streak'); }
    if (ev.type === 'plinko') { played('plinko'); if (ev.mult >= 10) unlock('plinko_10'); if (ev.mult >= 100) unlock('plinko_100'); }
    if (ev.type === 'roulette') { played('roulette'); if (ev.straight) unlock('rl_straight'); }
    if (ev.type === 'crash') { played('crash'); if (ev.win && ev.mult >= 10) unlock('crash_10'); }
    if (ev.type === 'mines') { played('mines'); if (ev.gems >= 10) unlock('mines_10'); }
    if (ev.type === 'scratch') { played('scratch'); if (ev.mult >= 25) unlock('scratch_25'); }
    if (ev.type === 'dice') { played('dice'); if (ev.pairWin) unlock('dice_pair'); }
    if (ev.type === 'poker') { played('poker'); if (['full', 'four', 'sflush', 'royal'].includes(ev.hand)) unlock('vp_full'); }
    if (ev.type === 'keno') { played('keno'); if (ev.hits >= 6) unlock('keno_6'); }
    if (ev.type === 'hilo' || ev.type === 'hiloStep') { played('hilo'); if (ev.streak >= 5) unlock('hilo_5'); }
    if (ev.type === 'baccarat') { played('baccarat'); if (ev.tieWin) unlock('bacc_tie'); }
    if (ev.type === 'catPet') unlock('cat_pet');
    if (ev.type === 'cat' && ev.aff >= 100) unlock('cat_best');
    if (ev.type === 'travel') {
      const v = s.visited || (s.visited = {}); v[ev.zone] = 1; v.plaza = 1; Store.save();
      if (['plaza', 'neighborhood', 'mall', 'market', 'playground'].every(z => v[z])) unlock('traveler');
      if (ev.withCat) unlock('cat_follow');
    }
    if (ev.type === 'shop' && ev.item.startsWith('hat:')) unlock('hat');
    if (ev.type === 'playground' && ev.all) unlock('playground');
    if (ev.type === 'levelup' || ev.type === 'xp') { if (s.level >= 5) unlock('level_5'); if (s.level >= 10) unlock('level_10'); }
    if (ev.type === 'balance') { if (s.balance >= 10000) unlock('rich_10k'); if (s.balance >= 100000) unlock('rich_100k'); }
  }
  function render() {
    const box = $('#achGrid');
    if (!box) return;
    const got = LIST.filter(a => Store.s.ach[a.id]).length;
    $('#achCount').textContent = `${got} / ${LIST.length}`;
    box.innerHTML = LIST.map(a => `<div class="ach ${Store.s.ach[a.id] ? 'got' : ''}" title="${a.desc}">
      <div class="ach-icon"><img src="${Icons.url(a.icon)}" alt=""></div><div><b>${a.name}</b><span>${a.desc}</span></div></div>`).join('');
  }
  Store.on(check);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(render, 50));
  return { render, count: () => LIST.length };
})();

/* ---------- Figuren-Editor ---------- */
const AvatarEditor = (() => {
  const c = $('#avPreview'), g = c.getContext('2d');
  let a = null, raf = null, t = 0, open = false, last = 0;
  function swatches(box, list, key, round = true) {
    box.innerHTML = '';
    list.forEach((col, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch' + (round ? '' : ' sq'); b.style.setProperty('--c', col);
      b.setAttribute('aria-label', key + ' ' + (i + 1));
      b.addEventListener('click', () => { Sfx.click(); a[key] = typeof a[key] === 'number' || key !== 'accent' ? i : col; if (key === 'accent') a.accent = col; mark(); });
      box.appendChild(b);
    });
  }
  const ACCENTS = ['#ffc94a', '#ff3d8b', '#3be8ff', '#5dffb0', '#ffffff', '#e0103a'];
  function mark() {
    $$('#avSkin .swatch').forEach((b, i) => b.classList.toggle('on', a.skin === i));
    $$('#avHair .swatch').forEach((b, i) => b.classList.toggle('on', a.hair === i));
    $$('#avOutfit .swatch').forEach((b, i) => b.classList.toggle('on', a.outfit === i));
    $$('#avAccent .swatch').forEach(b => b.classList.toggle('on', b.style.getPropertyValue('--c') === a.accent));
    $$('#avStyle button').forEach(b => b.classList.toggle('on', b.dataset.style === a.style));
    $$('#avHat button').forEach(b => b.classList.toggle('on', (b.dataset.hat || null) === (a.hat || null)));
    $('#avGlasses').classList.toggle('on', !!a.glasses);
    $('#avGlasses').setAttribute('aria-pressed', !!a.glasses);
  }
  function loop(now) {
    if (!open) { raf = null; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; t += dt;
    const dpr = Math.min(2, window.devicePixelRatio || 1), rect = c.getBoundingClientRect(), W = rect.width, H = rect.height;
    if (W < 10 || H < 10) { raf = requestAnimationFrame(loop); return; }
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.6);
    bg.addColorStop(0, 'rgba(157,92,255,0.35)'); bg.addColorStop(1, 'rgba(157,92,255,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const dir = [0, 2, 3, 1][Math.floor(t / 1.6) % 4];
    const k = Math.min(W / 50, H / 78) * 0.85;
    g.save(); g.translate(W / 2, H * 0.92); g.scale(k, k);
    Avatar.draw(g, 0, 0, a, dir, t * 9, true);
    g.restore();
    raf = requestAnimationFrame(loop);
  }
  swatches($('#avSkin'), Avatar.SKINS, 'skin');
  swatches($('#avHair'), Avatar.HAIRS, 'hair');
  swatches($('#avOutfit'), Avatar.OUTFITS, 'outfit', false);
  swatches($('#avAccent'), ACCENTS, 'accent');
  $('#avStyle').innerHTML = Avatar.STYLES.map(s => `<button type="button" data-style="${s.id}">${s.name}</button>`).join('');
  $$('#avStyle button').forEach(b => b.addEventListener('click', () => { Sfx.click(); a.style = b.dataset.style; mark(); }));
  $('#avGlasses').addEventListener('click', () => { Sfx.click(); a.glasses = !a.glasses; mark(); });
  $('#avRandom').addEventListener('click', () => {
    Sfx.chip();
    Object.assign(a, { skin: U.randInt(0, 4), hair: U.randInt(0, 6), outfit: U.randInt(0, 6), style: U.pick(Avatar.STYLES).id, accent: U.pick(ACCENTS), glasses: Math.random() < 0.3 });
    mark();
  });
  $('#avForm').addEventListener('submit', e => {
    e.preventDefault();
    a.name = ($('#avName').value || '').trim().slice(0, 14) || 'Gast';
    Store.s.avatar = { ...a }; Store.save();
    Floor.refreshAvatar(); Town.refreshAvatar();
    Sfx.win(1);
    App.closeModal(true);
    Profile.render();
    Toast.show(I18N.t('Willkommen, {0}!', a.name), 'Lauf durch die Halle und such dir einen Tisch aus.', '★', 'ach');
  });
  function renderHats() {
    const hats = (Store.s.inv && Store.s.inv.hats) || [];
    $('#avHatField').hidden = !hats.length;
    const NAMES = { cap: 'Basecap', beanie: 'Mütze', party: 'Partyhut', cowboy: 'Cowboyhut', tophat: 'Zylinder', crown: 'Krone' };
    $('#avHat').innerHTML = `<button type="button" data-hat="">${I18N.t('Ohne')}</button>` + hats.map(h => `<button type="button" data-hat="${h}">${I18N.t(NAMES[h] || h)}</button>`).join('');
    $$('#avHat button').forEach(b => b.addEventListener('click', () => { Sfx.click(); a.hat = b.dataset.hat || null; mark(); }));
  }
  return {
    open() { a = Avatar.load(); renderHats(); $('#avName').value = a.name === 'Gast' && !Store.s.avatar ? '' : a.name; mark(); open = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); },
    close() { open = false; },
  };
})();

/* ---------- Profil (ehemalige Lobby) ---------- */
const Profile = (() => {
  const c = $('#profileAvatar'), g = c.getContext('2d');
  let raf = null, active = false, t = 0, last = 0;
  function loop(now) {
    if (!active) { raf = null; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; t += dt;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
    if (!W) { raf = requestAnimationFrame(loop); return; }
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const k = Math.min(W / 50, H / 76);
    g.save(); g.translate(W / 2, H * 0.94); g.scale(k, k);
    Avatar.draw(g, 0, 0, Avatar.load(), 0, t * 2, false);
    g.restore();
    raf = requestAnimationFrame(loop);
  }
  function renderGames() {
    const box = $('#profileGames');
    const p = Store.s.played || {};
    box.innerHTML = GAMES.map(gm => `<a class="pg-item${p[gm.id] ? ' done' : ''}" href="#${gm.id}" style="--c:${gm.color}"><img alt="" src="${Icons.url(gm.icon)}"><span><b>${gm.name}</b><small>${gm.sub}</small></span></a>`).join('');
  }
  function render() {
    const a = Avatar.load();
    $('#profileName').textContent = a.name || 'Gast';
    $('#profileTitle').textContent = ['Neuling', 'Glückspilz', 'Stammgast', 'Zocker', 'High Roller', 'VIP', 'Casino-Legende'][Math.min(6, Math.floor((Store.s.level - 1) / 3))];
    renderGames();
  }
  return {
    show() { active = true; render(); last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); },
    hide() { active = false; },
    render,
  };
})();

/* ---------- Ladebildschirm mit Hinweis ---------- */
const Loader = (() => {
  const el = $('#loader'), fill = $('#ldFill'), step = $('#ldStep'), go = $('#ldGo'), langs = $('#ldLangs');
  let done = null;
  const mark = () => $$('.lang-btn', langs).forEach(b => { b.classList.toggle('on', b.dataset.lang === I18N.lang); b.setAttribute('aria-pressed', b.dataset.lang === I18N.lang); });
  langs.innerHTML = I18N.ORDER.map(c => `<button type="button" class="lang-btn" data-lang="${c}"><b>${c.toUpperCase()}</b><span>${I18N.LANGS[c].name}</span></button>`).join('');
  $$('.lang-btn', langs).forEach(b => b.addEventListener('click', () => { I18N.set(b.dataset.lang); mark(); }));
  I18N.onChange(mark);
  go.addEventListener('click', () => {
    Sfx.init(); Sfx.win(1);
    el.classList.add('out');
    setTimeout(() => { el.hidden = true; }, 500);
    done && done();
  });
  async function run(onDone) {
    done = onDone; mark();
    const t0 = performance.now();
    const set = (txt, p) => { step.textContent = txt; fill.style.width = p + '%'; };
    set('Schriften werden geladen …', 15);
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), U.sleep(2500)]);
    set('Karten werden gemischt …', 45);
    await U.sleep(220);
    Symbols.clear(); Symbols.ids.forEach(id => Symbols.sprite(id, 128));
    set('Automaten werden poliert …', 72);
    await U.sleep(260);
    set('Die Lichter gehen an …', 92);
    await U.sleep(Math.max(200, 1500 - (performance.now() - t0)));
    fill.style.width = '100%'; step.textContent = 'Bereit!';
    el.classList.add('ready');
    go.disabled = false; go.focus({ preventScroll: true });
  }
  return { run, get open() { return !el.hidden; } };
})();

/* ---------- App / Navigation ---------- */
const App = (() => {
  const views = { floor: Floor, lobby: null, slots: Slots, plinko: Plinko, blackjack: Blackjack, roulette: Roulette, crash: Crash, mines: Mines, scratch: Scratch, dice: Dice, poker: VideoPoker, keno: Keno, hilo: HiLo, baccarat: Baccarat, town: Town };
  let current = null, shownBalance = Store.s.balance, openModalId = null;
  const fade = $('#fade');

  function go(name) {
    if (!(name in views)) name = 'floor';
    if (current === name) return;
    if (current && views[current]) views[current].hide();
    if (current === 'lobby') Profile.hide();
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    document.body.dataset.view = name;
    current = name;
    window.scrollTo(0, 0);
    if (views[name]) views[name].show();
    if (name === 'lobby') { renderStats(); Achievements.render(); Profile.show(); }
    if (name !== 'floor' && name !== 'lobby' && name !== 'town') Floor.placeAt(name);
  }

  function route() {
    const h = (location.hash || '').replace('#', '');
    go(h || 'floor');
  }

  // Weicher Übergang zwischen Halle und Spiel
  function enter(name) {
    if (U.reducedMotion) { location.hash = name; return; }
    fade.hidden = false; fade.classList.remove('out'); void fade.offsetWidth; fade.classList.add('in');
    setTimeout(() => {
      location.hash = name;
      requestAnimationFrame(() => { fade.classList.remove('in'); fade.classList.add('out'); setTimeout(() => { fade.hidden = true; }, 320); });
    }, 230);
  }

  /* Header */
  const balEl = $('#balVal'), balBox = $('#balance');
  function updateBalance(delta) {
    const to = Store.s.balance;
    U.countUp(balEl, shownBalance, to, Math.abs(to - shownBalance) > 0 ? 650 : 1);
    shownBalance = to;
    if (delta > 0) { balBox.classList.remove('up', 'down'); void balBox.offsetWidth; balBox.classList.add('up'); }
    else if (delta < 0) { balBox.classList.remove('up', 'down'); void balBox.offsetWidth; balBox.classList.add('down'); }
  }
  function updateXp() {
    const s = Store.s, need = Store.xpNeed(s.level);
    $('#lvlNum').textContent = s.level;
    $('#xpFill').style.width = (s.xp / need * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${U.fmt(s.xp)} / ${U.fmt(need)} XP`;
  }
  function updateBonus() {
    const b = $('#bonusBtn'), t = $('#bonusTimer');
    const ready = Wheel.ready();
    b.classList.toggle('ready', ready);
    if (ready) t.textContent = Wheel.rescue() ? 'Rettung' : 'Bereit';
    else {
      const ms = Wheel.remaining(), m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
      t.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
    if (openModalId === 'modal-wheel') Wheel.updateBtn();
  }

  const GAME_TAG = { slots: ['Slot', '#ffc94a'], plinko: ['Plinko', '#ff7ab4'], blackjack: ['Blackjack', '#5dffb0'], roulette: ['Roulette', '#5dffb0'],
    crash: ['Crash', '#ff8a5d'], mines: ['Mines', '#3be8ff'], scratch: ['Los', '#ffc94a'], dice: ['Würfel', '#ff8a3d'],
    poker: ['Poker', '#3be8ff'], keno: ['Keno', '#9d5cff'], hilo: ['Hi-Lo', '#5dffb0'], baccarat: ['Baccarat', '#ffc94a'] };
  function recordWin(game, amount, what) {
    const r = Store.s.recent || (Store.s.recent = []);
    r.unshift({ game, amount, what, t: Date.now() });
    r.length = Math.min(r.length, 6);
    Store.save();
  }
  function renderRecent() {
    const box = $('#recentList');
    if (!box) return;
    const r = Store.s.recent || [];
    if (!r.length) { box.innerHTML = '<p class="empty">Noch keine großen Gewinne. Ab an die Tische!</p>'; return; }
    box.innerHTML = '<ol>' + r.map(e => {
      const [tag, c] = GAME_TAG[e.game] || ['Spiel', '#fff'];
      return `<li><span class="tag" style="--c:${c}">${tag}</span><span class="what">${e.what}</span><b>+${U.fmt(e.amount)}</b></li>`;
    }).join('') + '</ol>';
  }

  function renderStats() {
    renderRecent();
    const s = Store.s.stats;
    const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
    set('stBalance', U.fmt(Store.s.balance));
    set('stPeak', U.fmt(Store.s.peak));
    set('stBiggest', U.fmt(s.biggest));
    set('stWagered', U.fmt(s.wagered));
    set('stSpins', U.fmt(s.spins));
    set('stHands', U.fmt(s.hands));
    set('stBalls', U.fmt(s.balls));
    set('stMult', s.maxMult ? U.fmtMult(s.maxMult) : '–');
    set('stRl', U.fmt(s.rlSpins));
    set('stCrash', s.maxCrash ? s.maxCrash.toFixed(2).replace('.', U.dec()) + '×' : '–');
    set('stTickets', U.fmt(s.tickets));
    set('stRolls', U.fmt(s.rolls));
    set('stPoker', U.fmt(s.pokerHands));
    set('stKeno', U.fmt(s.kenoRounds));
    set('lobbyLevel', Store.s.level);
  }

  /* Modals */
  function openModal(id) {
    closeModal();
    const m = $('#' + id);
    m.hidden = false; openModalId = id;
    requestAnimationFrame(() => m.classList.add('show'));
    if (id === 'modal-wheel') Wheel.open();
    if (id === 'modal-avatar') AvatarEditor.open();
    if (id === 'modal-games') buildGamesMenu();
    const f = m.querySelector('[data-autofocus]') || m.querySelector('button');
    f && f.focus({ preventScroll: true });
  }
  function closeModal(force = false) {
    if (!openModalId) return;
    if (openModalId === 'modal-wheel' && Wheel.spinning) return;
    if (openModalId === 'modal-avatar' && !Store.s.avatar && !force) return; // erst Figur anlegen
    const m = $('#' + openModalId);
    m.classList.remove('show');
    const id = openModalId;
    setTimeout(() => { if (openModalId !== id) m.hidden = true; }, 250);
    if (id === 'modal-wheel') Wheel.close();
    if (id === 'modal-avatar') AvatarEditor.close();
    openModalId = null;
  }
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { Sfx.click(); closeModal(); } });
  });

  function buildGamesMenu() {
    const box = $('#gamesMenu');
    box.innerHTML = GAMES.map(gm => `<button type="button" class="gm-item" data-game="${gm.id}" style="--c:${gm.color}"><img alt="" src="${Icons.url(gm.icon)}"><span><b>${gm.name}</b><small>${gm.sub}</small></span></button>`).join('') +
      `<button type="button" class="gm-item" data-game="town" style="--c:#ff6aa6"><img alt="" src="${Icons.url('bus')}"><span><b>${I18N.t('Raus in die Stadt')}</b><small>${I18N.t('Nachbarschaft, Mall, Markt, Spielplatz')}</small></span></button>` +
      `<button type="button" class="gm-item" data-game="wheel" style="--c:#ffc94a"><span class="gm-wheel"></span><span><b>Bonusrad</b><small>${Wheel.ready() ? 'Gratis-Dreh bereit' : 'lädt noch'}</small></span></button>`;
    $$('.gm-item', box).forEach(b => b.addEventListener('click', () => {
      Sfx.click();
      const id = b.dataset.game;
      closeModal();
      if (id === 'wheel') { setTimeout(() => openModal('modal-wheel'), 260); return; }
      if (id === 'town') { if (current === 'town') return; Store.s.town = { zone: (Store.s.town && Store.s.town.zone) || 'plaza' }; enter('town'); return; }
      Floor.placeAt(id);
      enter(id);
    }));
  }

  function insufficient(need) {
    Sfx.error();
    FX.shake(balBox);
    if (Wheel.ready()) {
      Toast.show('Nicht genug Münzen', 'Dreh am Bonusrad für Nachschub!', '!', 'warn');
      setTimeout(() => openModal('modal-wheel'), 500);
    } else {
      Toast.show('Nicht genug Münzen', `Du brauchst ${U.fmt(need)}. Senke den Einsatz oder warte auf den Bonus.`, '!', 'warn');
    }
  }

  /* Events */
  Store.on(ev => {
    if (ev.type === 'slotResult' && ev.total >= ev.bet * 5) recordWin('slots', ev.total, `${U.fmtMult(Math.round(ev.total / ev.bet))} Einsatz${ev.free ? ' · Freispiel' : ''}`);
    if (ev.type === 'plinko' && ev.mult >= 5) recordWin('plinko', ev.win, `${U.fmtMult(ev.mult)} Treffer`);
    if (ev.type === 'bjResult' && ev.net > 0 && (ev.blackjack || ev.net >= 500)) recordWin('blackjack', ev.net, ev.blackjack ? 'Blackjack!' : 'Gewonnene Hand');
    if (ev.type === 'roulette' && ev.net > 0 && (ev.straight || ev.net >= 500)) recordWin('roulette', ev.win, ev.straight ? `Volltreffer auf ${ev.result}` : `Zahl ${ev.result}`);
    if (ev.type === 'crash' && ev.win && ev.mult >= 3) recordWin('crash', ev.win, `Ausgestiegen bei ${ev.mult.toFixed(2).replace('.', U.dec())}×`);
    if (ev.type === 'mines' && ev.win && ev.mult >= 3) recordWin('mines', ev.win, `${ev.gems} Juwelen · ${ev.mines} Bomben`);
    if (ev.type === 'scratch' && ev.mult >= 4) recordWin('scratch', ev.win, `${ev.mult}× Los`);
    if (ev.type === 'poker' && ev.win >= ev.bet * 9) recordWin('poker', ev.win, I18N.t('{0}', ev.hand === 'royal' ? 'Royal Flush' : ev.hand === 'sflush' ? 'Straight Flush' : ev.hand === 'four' ? 'Vierling' : 'Full House'));
    if (ev.type === 'keno' && ev.mult >= 10) recordWin('keno', ev.win, I18N.t('{0} von {1} Treffern', ev.hits, ev.picks));
    if (ev.type === 'hilo' && ev.win && ev.mult >= 4) recordWin('hilo', ev.win, I18N.t('Serie von {0}', ev.streak));
    if (ev.type === 'baccarat' && ev.net > 0 && (ev.tieWin || ev.net >= 500)) recordWin('baccarat', ev.win, ev.tieWin ? I18N.t('Unentschieden') : I18N.t(ev.res === 'player' ? 'Spieler gewinnt' : 'Bank gewinnt'));
    if (ev.type === 'dice' && ev.win >= ev.bet * 4) recordWin('dice', ev.win, `Summe ${ev.sum}${ev.pair ? ' · Pasch' : ''}`);
    if (ev.type === 'balance') { updateBalance(ev.delta); updateBonus(); if (current === 'lobby') renderStats(); }
    if (ev.type === 'xp') updateXp();
    if (ev.type === 'levelup') {
      Sfx.levelUp();
      Toast.show(`Level ${ev.level}!`, `Belohnung: +${U.fmt(ev.reward)} Münzen`, '▲', 'level');
      const c = FX.center($('#lvlNum'));
      FX.stars(c.x, c.y, 14);
      $('#levelBox').classList.remove('lvl-up'); void $('#levelBox').offsetWidth; $('#levelBox').classList.add('lvl-up');
    }
    if (ev.type === 'reset') { shownBalance = Store.s.balance; balEl.textContent = U.fmt(shownBalance); renderStats(); Achievements.render(); updateBonus(); }
  });

  document.addEventListener('keydown', e => {
    if (Loader.open) return; // Ladebildschirm zuerst bestätigen
    if (e.key === 'Escape') { if (!openModalId && current === 'town' && Town.key(e)) return; closeModal(); return; }
    if (openModalId || e.target.closest('input, textarea, select')) return;
    if (e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return; // Button-Klick nicht doppelt auslösen
    if (current !== 'floor' && current !== 'lobby' && e.code === 'Escape') return;
    const v = views[current];
    if (v && v.key) v.key(e);
  });
  // Erster Nutzerkontakt schaltet Audio frei
  ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, () => { Sfx.init(); if (current === 'floor') Sfx.ambient(true); }, { once: true, capture: true }));

  $('#bonusBtn').addEventListener('click', () => { Sfx.init(); Sfx.click(); openModal('modal-wheel'); });
  // Einstellungen: Sprache & Lautstärke
  const langGrid = $('#langGrid');
  langGrid.innerHTML = I18N.ORDER.map(c => `<button type="button" class="lang-btn" data-lang="${c}"><b>${c.toUpperCase()}</b><span>${I18N.LANGS[c].name}</span></button>`).join('');
  const markLang = () => $$('.lang-btn', langGrid).forEach(b => { b.classList.toggle('on', b.dataset.lang === I18N.lang); b.setAttribute('aria-pressed', b.dataset.lang === I18N.lang); });
  $$('.lang-btn', langGrid).forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.click(); I18N.set(b.dataset.lang); markLang(); }));
  markLang();
  const volRange = $('#volRange'), volVal = $('#volVal');
  const showVol = () => { volRange.value = Math.round(Sfx.volume * 100); volVal.textContent = Math.round(Sfx.volume * 100) + ' %'; };
  volRange.addEventListener('input', () => { Sfx.init(); Sfx.setVolume(volRange.value / 100); volVal.textContent = volRange.value + ' %'; });
  volRange.addEventListener('change', () => Sfx.click());
  showVol();
  $('#settingsBtn').addEventListener('click', () => { Sfx.init(); Sfx.click(); showVol(); openModal('modal-settings'); });
  const fmtStatic = () => {
    $$('[data-num]').forEach(e => { e.textContent = U.fmt(+e.dataset.num); });
    $$('[data-auto]').forEach(b => { b.textContent = U.fmtMult(+b.dataset.auto); });
  };
  fmtStatic();
  I18N.onChange(() => { fmtStatic(); updateXp(); updateBonus(); renderStats(); Achievements.render(); Profile.render(); setMuteUI && setMuteUI(); });
  $('#gamesBtn').addEventListener('click', () => { Sfx.init(); Sfx.click(); openModal('modal-games'); });
  $('#avatarBtn').addEventListener('click', () => { Sfx.init(); Sfx.click(); openModal('modal-avatar'); });
  $('#profileEdit').addEventListener('click', () => { Sfx.init(); Sfx.click(); openModal('modal-avatar'); });
  const muteBtn = $('#muteBtn');
  const setMuteUI = () => { muteBtn.classList.toggle('muted', Sfx.muted); muteBtn.setAttribute('aria-pressed', Sfx.muted); muteBtn.title = Sfx.muted ? 'Ton an' : 'Ton aus'; };
  muteBtn.addEventListener('click', () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); setMuteUI(); Sfx.click(); });
  setMuteUI();

  // Zurücksetzen mit Bestätigung auf der Seite
  const resetBtn = $('#resetBtn'), resetConfirm = $('#resetConfirm');
  resetBtn.addEventListener('click', () => { resetConfirm.hidden = false; resetBtn.hidden = true; });
  $('#resetNo').addEventListener('click', () => { resetConfirm.hidden = true; resetBtn.hidden = false; });
  $('#resetYes').addEventListener('click', () => {
    Store.reset(); resetConfirm.hidden = true; resetBtn.hidden = false;
    Toast.show('Neustart', 'Du startest wieder mit 2.500 Münzen.', '↺');
    setTimeout(() => openModal('modal-avatar'), 400);
  });

  window.addEventListener('hashchange', route);
  setInterval(updateBonus, 1000);

  return {
    init() {
      I18N.start();
      const cf = $('.cat-face'); if (cf) cf.style.setProperty('--cat-icon', `url(${Icons.url('cat')})`);
      const refund = Store.refundPending();
      shownBalance = Store.s.balance;
      balEl.textContent = U.fmt(Store.s.balance);
      const afterLoad = () => {
        if (refund) setTimeout(() => Toast.show(I18N.t('Offene Runde abgerechnet'), I18N.t('{0} Münzen aus einer offenen Runde wurden dir gutgeschrieben.', U.fmt(refund)), '↺', 'ach'), 600);
        if (!Store.s.avatar) setTimeout(() => openModal('modal-avatar'), 450);
      };
      updateXp(); updateBonus(); route();
      Loader.run(afterLoad);
    },
    openModal, closeModal, insufficient, updateBonus, enter,
  };
})();

App.init();

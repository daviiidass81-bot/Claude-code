'use strict';
/* ---------- Rocket Crash ---------- */
const Crash = (() => {
  const BETS = [10, 20, 50, 100, 250, 500, 1000];
  const RATE = 0.105; // Multiplikator = e^(RATE·t)
  const el = {
    canvas: $('#crashCanvas'), stage: $('#crashStage'), mult: $('#crashMult'), status: $('#crashStatus'),
    btn: $('#crashBtn'), btnLabel: $('#crashBtnLabel'), btnSub: $('#crashBtnSub'),
    auto: $('#crAuto'), autoOn: $('#crAutoOn'), hist: $('#crashHist'), players: $('#crashPlayers'),
  };
  const g = el.canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, active = false, raf = null, last = 0;
  let phase = 'idle'; // idle | launch | fly | crashed
  let t = 0, crashAt = 1, mult = 1, bet = 0, cashed = false, cashMult = 0, launchT = 0;
  let stars = [], flames = [], debris = [], history = [], bots = [], shake = 0;
  const stepper = BetStepper($('#crBetMinus'), $('#crBet'), $('#crBetPlus'), BETS, 3);

  const NAMES = ['Mia', 'Leon', 'Aylin', 'Jonas', 'Sofia', 'Emir', 'Lena', 'Noah', 'Hanna', 'Luca', 'Zoe', 'Ben', 'Mila', 'Finn', 'Nora', 'Can'];

  function newStars() {
    stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: U.rand(0.2, 1) }));
  }

  function resize() {
    const r = el.stage.getBoundingClientRect();
    if (r.width < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = Math.max(260, Math.min(460, r.width * 0.62));
    el.canvas.width = Math.round(W * dpr); el.canvas.height = Math.round(H * dpr);
    el.canvas.style.height = H + 'px';
    if (!stars.length) newStars();
    draw();
  }

  const multAt = tt => Math.exp(RATE * tt);
  const timeFor = m => Math.log(m) / RATE;

  /* ---------- Zeichnen ---------- */
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = shake ? U.rand(-shake, shake) : 0, sy = shake ? U.rand(-shake, shake) : 0;
    g.translate(sx, sy);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07041a'); bg.addColorStop(0.6, '#150a34'); bg.addColorStop(1, '#2a0e3a');
    g.fillStyle = bg; g.fillRect(-10, -10, W + 20, H + 20);
    // Sterne (Parallaxe)
    const speed = phase === 'fly' ? Math.min(3, 0.4 + (mult - 1) * 0.6) : 0.15;
    for (const s of stars) {
      g.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.6})`;
      const len = phase === 'fly' ? s.z * speed * 6 : 0;
      g.fillRect(s.x * W, s.y * H, 1.3 * s.z + len, 1.3 * s.z);
    }
    // Planet
    const pg = g.createRadialGradient(W * 0.86, H * 0.2, 4, W * 0.86, H * 0.2, H * 0.16);
    pg.addColorStop(0, '#ffb3f0'); pg.addColorStop(0.6, '#9d5cff'); pg.addColorStop(1, 'rgba(60,20,120,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(W * 0.86, H * 0.2, H * 0.16, 0, Math.PI * 2); g.fill();

    // Achsen
    const pad = { l: 46, r: 18, t: 20, b: 30 };
    const tNow = phase === 'idle' ? 0 : phase === 'launch' ? 0 : t;
    const tMax = Math.max(8, tNow * 1.18), mMax = Math.max(2, multAt(tNow) * 1.25);
    const X = tt => pad.l + tt / tMax * (W - pad.l - pad.r);
    const Y = m => H - pad.b - (m - 1) / (mMax - 1) * (H - pad.t - pad.b);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.font = '11px Rubik, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.45)'; g.textAlign = 'right'; g.textBaseline = 'middle';
    const stepM = niceStep(mMax - 1);
    for (let m = 1; m <= mMax + 0.001; m += stepM) {
      const y = Y(m); g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.fillText(m.toFixed(stepM < 1 ? 1 : 0).replace('.', U.dec()) + '×', pad.l - 8, y);
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    const stepT = niceStep(tMax / 1.2);
    for (let s = 0; s <= tMax; s += stepT) { g.fillText(Math.round(s) + 's', X(s), H - pad.b + 8); }

    // Kurve
    if (phase === 'fly' || phase === 'crashed') {
      const n = 60, pts = [];
      for (let i = 0; i <= n; i++) { const tt = tNow * i / n; pts.push([X(tt), Y(multAt(tt))]); }
      const col = phase === 'crashed' ? '#ff4d6a' : cashed ? '#5dffb0' : '#ffc94a';
      const area = g.createLinearGradient(0, pad.t, 0, H - pad.b);
      area.addColorStop(0, hexA(col, 0.35)); area.addColorStop(1, hexA(col, 0));
      g.beginPath(); g.moveTo(pts[0][0], H - pad.b); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[n][0], H - pad.b); g.closePath();
      g.fillStyle = area; g.fill();
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.strokeStyle = col; g.lineWidth = 3.5; g.shadowColor = col; g.shadowBlur = 16; g.stroke(); g.shadowBlur = 0;
      // Auszahlungsmarke
      if (cashed) {
        const cx = X(timeFor(cashMult)), cy = Y(cashMult);
        g.fillStyle = '#5dffb0'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
        g.font = '700 12px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(I18N.t('Du: {0}', fmtM(cashMult)), cx, cy - 8);
      }
      // Rakete
      const [hx, hy] = pts[n], [px, py] = pts[n - 2];
      const ang = Math.atan2(hy - py, hx - px);
      if (phase === 'fly') drawRocket(hx, hy, ang);
    } else if (phase === 'launch' || phase === 'idle') {
      drawRocket(X(0) + 16, Y(1) - 6, -Math.PI / 5, phase === 'launch');
    }
    // Partikel
    for (const f of flames) {
      const a = 1 - f.age / f.life;
      g.fillStyle = f.c.replace('A', a.toFixed(2));
      g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + a * 0.5), 0, Math.PI * 2); g.fill();
    }
    for (const d of debris) {
      const a = 1 - d.age / d.life;
      g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.globalAlpha = a;
      g.fillStyle = d.c; g.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.6); g.restore();
    }
    g.globalAlpha = 1;
    if (phase === 'crashed') {
      g.fillStyle = 'rgba(255,40,80,0.08)'; g.fillRect(0, 0, W, H);
    }
  }
  function niceStep(range) { const r = range / 4; const p = Math.pow(10, Math.floor(Math.log10(r))); const n = r / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  const fmtM = m => m.toFixed(2).replace('.', U.dec()) + '×';

  function drawRocket(x, y, ang, rumble = false) {
    g.save(); g.translate(x + (rumble ? U.rand(-1, 1) : 0), y); g.rotate(ang);
    // Flamme
    const fl = 14 + Math.random() * 8;
    const fg = g.createLinearGradient(-8, 0, -8 - fl, 0);
    fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.4, '#ffb030'); fg.addColorStop(1, 'rgba(255,60,40,0)');
    if (phase === 'fly' || rumble) { g.fillStyle = fg; g.beginPath(); g.moveTo(-8, -5); g.quadraticCurveTo(-8 - fl, 0, -8, 5); g.closePath(); g.fill(); }
    // Rumpf
    const body = g.createLinearGradient(0, -8, 0, 8);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#d8d0e6'); body.addColorStop(1, '#8a80a0');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(10, -8, -8, -7); g.lineTo(-8, 7); g.quadraticCurveTo(10, 8, 18, 0); g.closePath(); g.fill();
    g.fillStyle = '#ff3d8b';
    g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(14, -4.5, 10, -5.5); g.lineTo(10, 5.5); g.quadraticCurveTo(14, 4.5, 18, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-4, -7); g.lineTo(-12, -13); g.lineTo(-8, -3); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-4, 7); g.lineTo(-12, 13); g.lineTo(-8, 3); g.closePath(); g.fill();
    g.fillStyle = '#3be8ff'; g.beginPath(); g.arc(3, 0, 3.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a80a0'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }

  /* ---------- Ablauf ---------- */
  function makeBots() {
    const n = U.randInt(4, 7);
    const names = NAMES.slice().sort(() => Math.random() - 0.5);
    bots = [];
    for (let i = 0; i < n; i++) {
      const name = names[i];
      bots.push({ name, bet: U.pick([20, 50, 100, 100, 250, 500]), target: Math.round(U.rand(1.15, Math.random() < 0.2 ? 12 : 3.5) * 100) / 100, out: null });
    }
    renderPlayers();
  }
  function renderPlayers() {
    const me = bet ? [{ name: (Avatar.load().name || 'Du') + ' (du)', bet, out: cashed ? cashMult : null, me: true }] : [];
    const rows = [...me, ...bots].map(p => {
      const st = p.out ? `<b class="ok">${fmtM(p.out)}</b>` : phase === 'crashed' ? '<b class="bad">—</b>' : '<b class="wait">…</b>';
      const win = p.out ? `+${U.fmt(Math.floor(p.bet * p.out))}` : phase === 'crashed' ? `-${U.fmt(p.bet)}` : U.fmt(p.bet);
      return `<li class="${p.me ? 'me' : ''} ${p.out ? 'out' : phase === 'crashed' ? 'lost' : ''}"><span>${p.name}</span>${st}<em>${win}</em></li>`;
    });
    el.players.innerHTML = rows.length ? rows.join('') : '<li class="empty">Startet eine Runde, steigen weitere Gäste mit ein.</li>';
  }

  function autoTarget() {
    const v = parseFloat(String(el.auto.value).replace(',', '.'));
    return el.autoOn.checked && v >= 1.01 ? v : null;
  }

  async function launch() {
    if (phase === 'launch' || phase === 'fly') return;
    Sfx.init();
    const b = stepper.value;
    if (!Store.bet(b)) { App.insufficient(b); return; }
    bet = b; cashed = false; cashMult = 0; t = 0; mult = 1; debris = []; flames = [];
    const U1 = Math.random();
    crashAt = Math.max(1, Math.floor(0.97 / (1 - U1) * 100) / 100);
    makeBots();
    phase = 'launch'; stepper.locked = true; updateBtn();
    el.status.textContent = 'Zündung …';
    Sfx.spinStart();
    launchT = performance.now();
    await U.sleep(900);
    if (phase !== 'launch') return;
    phase = 'fly'; t = 0;
    Store.stat('crashRounds');
    Sfx.rocket && Sfx.rocket(true);
    el.status.textContent = 'Die Rakete steigt!';
    updateBtn();
  }

  function cashOut(auto = false) {
    if (phase !== 'fly' || cashed || !bet) return;
    cashed = true; cashMult = mult;
    const win = Math.floor(bet * mult);
    Store.win(win);
    Sfx.win(mult >= 5 ? 3 : 2);
    const c = FX.center(el.btn);
    FX.coins(c.x, c.y - 30, Math.min(40, 10 + Math.round(mult * 4)), 1);
    FX.floatText(c.x, c.y - 50, '+' + U.fmt(win), 'good');
    el.status.textContent = `${auto ? 'Automatisch ausgezahlt' : 'Ausgezahlt'} bei ${fmtM(mult)}: ${U.fmt(win)} Münzen`;
    Store.emit({ type: 'crash', mult, win, bet });
    Store.statMax('maxCrash', Math.round(mult * 100) / 100);
    renderPlayers(); updateBtn();
  }

  function doCrash() {
    phase = 'crashed';
    Sfx.rocket && Sfx.rocket(false);
    Sfx.explode && Sfx.explode();
    shake = 8;
    // Explosion an der Kurvenspitze
    const pad = { l: 46, r: 18, t: 20, b: 30 };
    const tMax = Math.max(8, t * 1.18), mMax = Math.max(2, multAt(t) * 1.25);
    const hx = pad.l + t / tMax * (W - pad.l - pad.r), hy = H - pad.b - (mult - 1) / (mMax - 1) * (H - pad.t - pad.b);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(40, 260);
      flames.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: U.rand(3, 9), age: 0, life: U.rand(0.4, 1), c: U.pick(['rgba(255,200,80,A)', 'rgba(255,90,60,A)', 'rgba(255,255,255,A)']) });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(60, 220);
      debris.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, rot: 0, vr: U.rand(-8, 8), s: U.rand(3, 7), age: 0, life: 1.4, c: U.pick(['#ffffff', '#ff3d8b', '#d8d0e6']) });
    }
    const r = el.canvas.getBoundingClientRect();
    FX.sparks(r.left + hx, r.top + hy, 20, '#ff8a3d', 300);
    history.unshift(crashAt); history.length = Math.min(history.length, 12);
    renderHistory();
    if (bet && !cashed) { Sfx.lose(); el.status.textContent = `Crash bei ${fmtM(crashAt)} – Einsatz verloren.`; Store.emit({ type: 'crash', mult: 0, win: 0, bet }); }
    else if (cashed) el.status.textContent = `Crash bei ${fmtM(crashAt)} – du warst rechtzeitig draußen!`;
    bots.forEach(b => { if (!b.out) b.out = null; });
    renderPlayers();
    FX.shake(el.stage, crashAt > 5);
    setTimeout(() => { if (phase === 'crashed') { bet = 0; stepper.locked = false; updateBtn(); } }, 900);
    updateBtn();
  }

  function renderHistory() {
    el.hist.innerHTML = history.map(m => `<span class="${m >= 10 ? 'hi' : m >= 2 ? 'mid' : 'lo'}">${fmtM(m)}</span>`).join('');
  }

  function updateBtn() {
    const b = el.btn;
    b.classList.remove('cash', 'wait');
    if (phase === 'fly' && bet && !cashed) {
      b.classList.add('cash'); b.disabled = false;
      el.btnLabel.textContent = 'Auszahlen'; el.btnSub.textContent = U.fmt(Math.floor(bet * mult)) + ' Münzen';
    } else if (phase === 'launch' || (phase === 'fly')) {
      b.classList.add('wait'); b.disabled = true;
      el.btnLabel.textContent = cashed ? 'Ausgezahlt' : 'Zündung …'; el.btnSub.textContent = cashed ? fmtM(cashMult) : '';
    } else {
      b.disabled = false; el.btnLabel.textContent = 'Abheben'; el.btnSub.textContent = 'Einsatz ' + U.fmt(stepper.value);
    }
  }

  function loop(now) {
    if (!active) { raf = null; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (phase === 'fly') {
      t += dt; mult = multAt(t);
      if (mult >= crashAt) { mult = crashAt; t = timeFor(crashAt); doCrash(); }
      else {
        const at = autoTarget();
        if (bet && !cashed && at && mult >= at) { mult = at; cashOut(true); }
        bots.forEach(b => { if (!b.out && mult >= b.target) { b.out = b.target; renderPlayers(); } });
        if (bet && !cashed) el.btnSub.textContent = U.fmt(Math.floor(bet * mult)) + ' Münzen';
      }
      el.mult.textContent = fmtM(mult);
      el.mult.className = 'crash-mult ' + (cashed ? 'cashed' : mult >= 2 ? 'hot' : '');
      // Stern-Bewegung
      for (const s of stars) { s.x -= dt * s.z * 0.05 * (1 + mult * 0.3); s.y += dt * s.z * 0.03 * (1 + mult * 0.3); if (s.x < 0) s.x += 1; if (s.y > 1) s.y -= 1; }
      // Abgasspur
      if (Math.random() < 0.8) {
        const pad = { l: 46, r: 18, t: 20, b: 30 };
        const tMax = Math.max(8, t * 1.18), mMax = Math.max(2, mult * 1.25);
        const hx = pad.l + t / tMax * (W - pad.l - pad.r), hy = H - pad.b - (mult - 1) / (mMax - 1) * (H - pad.t - pad.b);
        flames.push({ x: hx - 10, y: hy + 4, vx: U.rand(-60, -20), vy: U.rand(-10, 30), r: U.rand(2, 5), age: 0, life: U.rand(0.3, 0.6), c: 'rgba(255,180,80,A)' });
      }
    } else if (phase === 'crashed') {
      el.mult.textContent = fmtM(crashAt); el.mult.className = 'crash-mult crashed';
    } else if (phase === 'idle' || phase === 'launch') {
      el.mult.textContent = fmtM(1); el.mult.className = 'crash-mult';
    }
    for (let i = flames.length - 1; i >= 0; i--) { const f = flames[i]; f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.age > f.life) flames.splice(i, 1); }
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; d.rot += d.vr * dt; if (d.age > d.life) debris.splice(i, 1); }
    shake = Math.max(0, shake - dt * 20);
    draw();
    raf = requestAnimationFrame(loop);
  }

  el.btn.addEventListener('click', () => { if (phase === 'fly' && bet && !cashed) cashOut(); else launch(); });
  $('#crBetMinus').addEventListener('click', updateBtn); $('#crBetPlus').addEventListener('click', updateBtn);
  $$('[data-auto]').forEach(b => b.addEventListener('click', () => { Sfx.click(); el.auto.value = b.dataset.auto; el.autoOn.checked = true; }));
  window.addEventListener('resize', () => active && resize());

  return {
    show() { active = true; requestAnimationFrame(() => { resize(); updateBtn(); renderPlayers(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }); },
    hide() {
      // Läuft noch eine Runde mit Einsatz: beim Verlassen automatisch auszahlen
      if (phase === 'fly' && bet && !cashed) cashOut(true);
      active = false; Sfx.rocket && Sfx.rocket(false);
      if (phase === 'launch' && bet) Store.credit(bet); // Start abgebrochen: Einsatz zurück
      if (phase === 'launch' || phase === 'fly') { phase = 'idle'; bet = 0; stepper.locked = false; }
    },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); el.btn.click(); return true; } return false; },
  };
})();

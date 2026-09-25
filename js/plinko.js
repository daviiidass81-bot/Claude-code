'use strict';
/* ---------- Plinko ---------- */
const Plinko = (() => {
  const P = CFG.plinko;
  const el = {
    wrap: $('#plinkoBoard'), canvas: $('#plinkoCanvas'), bet: $('#plinkoBet'),
    minus: $('#plBetMinus'), plus: $('#plBetPlus'), drop: $('#plinkoDrop'), auto: $('#plinkoAuto'),
    history: $('#plinkoHistory'), last: $('#plinkoLast'), hint: $('#plinkoHint'),
    risk: $$('[data-risk]'), rows: $$('[data-rows]'),
  };
  const g = el.canvas.getContext('2d');
  let rows = 12, risk = 'mid', betIdx = 2, auto = false, autoTimer = null;
  let balls = [], pegFlash = new Map(), binHit = [], active = false, raf = null, lastT = 0;
  let W = 0, H = 0, dpr = 1, s = 0, v = 0, y0 = 0, pegR = 0, ballR = 0, binY = 0, binH = 0, cx = 0;

  const bet = () => P.bets[betIdx];
  const table = () => P.tables[rows][risk];

  function layout() {
    const w = el.wrap.clientWidth;
    if (!w) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; cx = W / 2;
    // Brett so groß wie möglich, aber nie höher als der sichtbare Bereich
    const availH = Math.max(360, window.innerHeight - (window.innerWidth <= 960 ? 150 : 190));
    s = Math.min(W / (rows + 1.9), availH / (rows * 0.84 + 2.9));
    v = s * 0.84;
    pegR = Math.max(2.2, s * 0.095);
    ballR = Math.max(4, s * 0.22);
    y0 = s * 1.25;
    binY = y0 + (rows - 1) * v + v * 0.72;
    binH = Math.max(24, s * 0.7);
    H = binY + binH + s * 0.45;
    el.canvas.width = Math.round(W * dpr); el.canvas.height = Math.round(H * dpr);
    el.canvas.style.height = H + 'px';
    binHit = new Array(rows + 1).fill(-1e9);
    if (!raf) draw(performance.now());
  }

  const pegX = (r, j) => cx + (j - (r + 2) / 2) * s;
  const pegY = r => y0 + r * v;
  const binX = k => cx + (k - rows / 2) * s;

  function binColor(k, n = rows) {
    const d = Math.abs(k - n / 2) / (n / 2);
    const stops = [[108, 77, 255], [255, 61, 139], [255, 201, 74]];
    const t = d * 2, i = Math.min(1, Math.floor(t)), f = t - i;
    const a = stops[i], b = stops[i + 1];
    return [0, 1, 2].map(c => Math.round(a[c] + (b[c] - a[c]) * f));
  }

  /* ---------- Kugel ---------- */
  function drop() {
    Sfx.init();
    if (balls.length >= 40) return;
    const b = bet();
    if (!Store.bet(b)) { stopAuto(); App.insufficient(b); return; }
    Store.stat('balls');
    const dirs = Array.from({ length: rows }, () => Math.random() < 0.5 ? 0 : 1);
    const pts = [];
    pts.push({ x: cx + U.rand(-s * 0.08, s * 0.08), y: y0 - v * 1.5, kind: 'start' });
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const j = k + 1;
      const side = dirs[r] ? 1 : -1;
      pts.push({ x: pegX(r, j) + side * s * U.rand(0.04, 0.1), y: pegY(r) - pegR - ballR * 0.92, kind: 'peg', r, j });
      k += dirs[r];
    }
    pts.push({ x: binX(k), y: binY + binH * 0.3, kind: 'bin', k });
    balls.push({ pts, seg: 0, t: 0, dur: 0.3, x: pts[0].x, y: pts[0].y, trail: [], bet: b, k, rows, risk, hue: U.rand(0, 1) });
    setLock();
    if (!raf && active) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function segPos(b) {
    const a = b.pts[b.seg], c = b.pts[b.seg + 1], t = b.t;
    const x = a.x + (c.x - a.x) * t;
    let y;
    if (a.kind === 'start') y = a.y + (c.y - a.y) * t * t;
    else {
      const up = (c.kind === 'bin' ? 0.6 : 0.95) * v;
      y = a.y + (c.y - a.y + up) * t * t - up * t;
    }
    return [x, y];
  }

  function arrive(b, p, quiet = false) {
    const now = performance.now();
    if (p.kind === 'peg') {
      pegFlash.set(p.r + ',' + p.j, now);
      Sfx.peg(p.r, b.rows);
    } else if (p.kind === 'bin') {
      binHit[p.k] = now;
      const m = P.tables[b.rows][b.risk][p.k];
      const win = Math.round(b.bet * m);
      if (win > 0) Store.win(win);
      Store.statMax('maxMult', m);
      Store.emit({ type: 'plinko', mult: m, win, bet: b.bet });
      if (quiet) return;
      Sfx.bin(m);
      const rect = el.canvas.getBoundingClientRect();
      const px = rect.left + binX(p.k), py = rect.top + binY;
      const col = binColor(p.k, b.rows);
      FX.sparks(px, py, m >= 2 ? 22 : 8, `rgb(${col.join(',')})`, m >= 10 ? 380 : 200);
      if (m >= 10) { FX.coins(px, py, Math.min(40, Math.round(m / 2) + 12), 1.1); FX.shake(el.wrap, m >= 100); }
      if (m >= 100) { FX.flash('rgba(255,201,74,0.35)'); FX.confetti(90, px, py); }
      FX.floatText(px, py - binH * 1.3, (win >= b.bet ? '+' : '') + U.fmt(win), m >= 1 ? '' : 'bad', m >= 1 ? `rgb(${col.join(',')})` : null);
      pushHistory(m, col);
      el.last.textContent = `${U.fmtMult(m)} · ${U.fmt(win)}`;
    }
  }

  function pushHistory(m, col) {
    const chip = document.createElement('span');
    chip.className = 'hist-chip';
    chip.style.setProperty('--c', `rgb(${col.join(',')})`);
    chip.textContent = U.fmtMult(m);
    el.history.prepend(chip);
    while (el.history.children.length > 9) el.history.lastChild.remove();
  }

  /* ---------- Zeichnen ---------- */
  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // Lichtkegel hinter der Pyramide
    const tg = g.createLinearGradient(0, y0, 0, binY);
    tg.addColorStop(0, 'rgba(157,92,255,0.10)'); tg.addColorStop(1, 'rgba(255,61,139,0.05)');
    g.fillStyle = tg;
    g.beginPath(); g.moveTo(pegX(0, 0) - s * 0.4, y0 - v * 0.5); g.lineTo(pegX(0, 2) + s * 0.4, y0 - v * 0.5);
    g.lineTo(pegX(rows - 1, rows + 1) + s * 0.5, binY - 4); g.lineTo(pegX(rows - 1, 0) - s * 0.5, binY - 4); g.closePath(); g.fill();

    // Stifte
    for (let r = 0; r < rows; r++) {
      for (let j = 0; j < r + 3; j++) {
        const x = pegX(r, j), y = pegY(r);
        const ft = pegFlash.get(r + ',' + j);
        const age = ft ? (now - ft) / 450 : 2;
        if (age < 1) {
          g.strokeStyle = `rgba(255,120,200,${0.8 * (1 - age)})`;
          g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, pegR + age * pegR * 3.2, 0, Math.PI * 2); g.stroke();
          const gg = g.createRadialGradient(x, y, 0, x, y, pegR * 4);
          gg.addColorStop(0, `rgba(255,150,220,${0.5 * (1 - age)})`); gg.addColorStop(1, 'rgba(255,150,220,0)');
          g.fillStyle = gg; g.beginPath(); g.arc(x, y, pegR * 4, 0, Math.PI * 2); g.fill();
        }
        const pg = g.createRadialGradient(x - pegR * 0.35, y - pegR * 0.4, pegR * 0.1, x, y, pegR);
        const hot = age < 1 ? 1 - age : 0;
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(0.5, hot ? `rgb(255,${Math.round(200 - 60 * hot)},${Math.round(240 - 20 * hot)})` : '#cbbcf5');
        pg.addColorStop(1, hot ? '#ff3d8b' : '#6d5a9e');
        g.fillStyle = pg; g.beginPath(); g.arc(x, y, pegR, 0, Math.PI * 2); g.fill();
      }
    }

    // Fächer
    const t = table(), bw = s * 0.9;
    for (let k = 0; k <= rows; k++) {
      const col = binColor(k), hitAge = (now - binHit[k]) / 400;
      const press = hitAge < 1 ? Math.sin(hitAge * Math.PI) * binH * 0.28 : 0;
      const x = binX(k) - bw / 2, y = binY + press;
      g.fillStyle = `rgba(${col.map(c => Math.round(c * 0.4)).join(',')},1)`;
      roundRect(x, y + 5, bw, binH, Math.min(8, bw * 0.2)); g.fill();
      const bg = g.createLinearGradient(0, y, 0, y + binH);
      bg.addColorStop(0, `rgb(${col.map(c => Math.min(255, c + 40)).join(',')})`);
      bg.addColorStop(1, `rgb(${col.join(',')})`);
      g.fillStyle = bg;
      if (hitAge < 1) { g.shadowColor = `rgb(${col.join(',')})`; g.shadowBlur = 22 * (1 - hitAge); }
      roundRect(x, y, bw, binH, Math.min(8, bw * 0.2)); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(x + 2, y + 2, bw - 4, binH * 0.32, Math.min(6, bw * 0.15)); g.fill();
      const base = t[k] >= 100 ? String(t[k]) : String(t[k]).replace('.', ',');
      let fs = Math.min(binH * 0.42, s * 0.32);
      const fit = txt => { g.font = `700 ${fs}px "Rubik", system-ui, sans-serif`; return g.measureText(txt).width <= bw * 0.86; };
      let label = base + '×';
      if (!fit(label)) label = base;
      if (!fit(label) && t[k] >= 1000) label = t[k] / 1000 + 'K';
      if (!fit(label)) { fs *= bw * 0.86 / g.measureText(label).width; g.font = `700 ${fs}px "Rubik", system-ui, sans-serif`; }
      g.fillStyle = '#1a0a26'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, binX(k), y + binH * 0.54);
    }

    // Kugeln
    for (const b of balls) {
      for (let i = 0; i < b.trail.length; i++) {
        const [tx, ty] = b.trail[i], a = (i + 1) / b.trail.length;
        g.fillStyle = `rgba(255,90,170,${0.28 * a})`;
        g.beginPath(); g.arc(tx, ty, ballR * (0.4 + 0.5 * a), 0, Math.PI * 2); g.fill();
      }
      const glow = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, ballR * 2.6);
      glow.addColorStop(0, 'rgba(255,110,190,0.55)'); glow.addColorStop(1, 'rgba(255,110,190,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(b.x, b.y, ballR * 2.6, 0, Math.PI * 2); g.fill();
      const bg = g.createRadialGradient(b.x - ballR * 0.35, b.y - ballR * 0.4, ballR * 0.1, b.x, b.y, ballR);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.35, '#ffc2e4'); bg.addColorStop(1, '#ff2f86');
      g.fillStyle = bg; g.beginPath(); g.arc(b.x, b.y, ballR, 0, Math.PI * 2); g.fill();
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.t += dt / b.dur;
      while (b.t >= 1) {
        b.t -= 1; b.seg++;
        arrive(b, b.pts[b.seg]);
        if (b.seg >= b.pts.length - 1) { b.done = true; break; }
        const nxt = b.pts[b.seg + 1];
        b.dur = nxt.kind === 'bin' ? 0.24 : U.rand(0.15, 0.19);
      }
      if (b.done) { balls.splice(i, 1); setLock(); continue; }
      [b.x, b.y] = segPos(b);
      b.trail.push([b.x, b.y]); if (b.trail.length > 7) b.trail.shift();
    }
    draw(now);
    const busy = balls.length || now - Math.max(...binHit) < 500 || [...pegFlash.values()].some(t => now - t < 500);
    if (active && (busy || auto)) raf = requestAnimationFrame(loop);
    else raf = null;
  }

  /* ---------- Steuerung ---------- */
  function setLock() {
    const locked = balls.length > 0;
    [...el.risk, ...el.rows].forEach(b => { b.disabled = locked; });
    el.hint.hidden = !locked;
  }
  function updateUI() {
    el.bet.textContent = U.fmt(bet());
    el.minus.disabled = betIdx === 0; el.plus.disabled = betIdx === P.bets.length - 1;
    el.risk.forEach(b => b.classList.toggle('on', b.dataset.risk === risk));
    el.rows.forEach(b => b.classList.toggle('on', +b.dataset.rows === rows));
    el.auto.classList.toggle('on', auto);
    el.auto.setAttribute('aria-pressed', auto);
    const t = table();
    $('#plinkoMax').textContent = U.fmtMult(Math.max(...t));
  }
  function stopAuto() { auto = false; clearInterval(autoTimer); autoTimer = null; updateUI(); }

  el.drop.addEventListener('click', drop);
  el.auto.addEventListener('click', () => {
    Sfx.init(); Sfx.click();
    if (auto) { stopAuto(); return; }
    auto = true; updateUI(); drop();
    autoTimer = setInterval(() => { if (!active) { stopAuto(); return; } drop(); }, 420);
  });
  el.minus.addEventListener('click', () => { Sfx.init(); Sfx.click(); betIdx = Math.max(0, betIdx - 1); updateUI(); });
  el.plus.addEventListener('click', () => { Sfx.init(); Sfx.click(); betIdx = Math.min(P.bets.length - 1, betIdx + 1); updateUI(); });
  el.risk.forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.click(); risk = b.dataset.risk; updateUI(); draw(performance.now()); }));
  el.rows.forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.click(); rows = +b.dataset.rows; updateUI(); layout(); }));
  window.addEventListener('resize', () => { if (active && !balls.length) layout(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => active && draw(performance.now()));

  return {
    show() { active = true; updateUI(); layout(); setLock(); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } },
    hide() {
      active = false; stopAuto();
      // Kugeln im Flug sofort abrechnen, damit kein Einsatz verloren geht
      balls.forEach(b => arrive(b, b.pts[b.pts.length - 1], true));
      balls = []; setLock();
    },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); drop(); return true; } return false; },
    binColor,
  };
})();

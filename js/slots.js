'use strict';
/* ---------- Slot: Lucky Seven Deluxe ---------- */
const Slots = (() => {
  const S = CFG.slots, SYM = S.symbols;
  const WILD = SYM.findIndex(s => s.wild), SCAT = SYM.findIndex(s => s.scatter);
  const NR = S.reels, NROW = S.rows;
  const el = {
    canvas: $('#slotCanvas'), frame: $('#reelsFrame'), machine: $('#slotMachine'),
    win: $('#slotWin'), winBox: $('#slotWinBox'), msg: $('#slotMsg'), bet: $('#slotBet'),
    spin: $('#spinBtn'), spinLabel: $('#spinLabel'), auto: $('#autoBtn'), turbo: $('#turboBtn'),
    minus: $('#betMinus'), plus: $('#betPlus'),
    fsBanner: $('#fsBanner'), fsCount: $('#fsCount'), fsWin: $('#fsWin'),
  };
  const g = el.canvas.getContext('2d');
  let W = 0, H = 0, cell = 0, dpr = 1, spriteSize = 0;
  let active = false, raf = null, lastT = 0, tickAcc = 0;
  let betIdx = 3, state = 'idle', auto = false, turbo = false;
  let fsLeft = 0, fsWinTotal = 0, inFS = false;
  let spinId = 1, wins = [], scatterHit = null, showStart = 0, lastShowIdx = -1;
  let resolveSpin = null, anticSoundFor = -1;
  const P0 = 1000, OVERSHOOT = 0.16, VMAX = 26;

  // Deterministischer Zufall je Streifenposition -> Walzen wirken wie echte Bänder
  function mulberry(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const TOTALW = SYM.reduce((s, x) => s + x.weight, 0);
  function randSym(rnd = Math.random) {
    let r = rnd() * TOTALW;
    for (let i = 0; i < SYM.length; i++) { r -= SYM[i].weight; if (r < 0) return i; }
    return 0;
  }

  const reels = Array.from({ length: NR }, (_, i) => ({
    i, pos: P0, base: -1e9, result: [0, 0, 0], prev: [randSym(), randSym(), randSym()],
    phase: 'idle', v: 0, speed: 0, t0: 0, stopAt: 0, decelFrom: 0, decelStart: 0, decelDur: 0,
    target: 0, bounceStart: 0, antic: false, landFlash: 0,
  }));
  reels.forEach(r => { r.result = r.prev.slice(); r.base = P0; });

  function symAt(r, idx) {
    if (idx >= r.base && idx < r.base + NROW) return r.result[idx - r.base];
    if (idx >= P0 && idx < P0 + NROW) return r.prev[idx - P0];
    return randSym(mulberry(Math.imul(spinId, 7919) ^ Math.imul(r.i + 1, 104729) ^ Math.imul(idx, 2654435761)));
  }

  const bet = () => S.bets[betIdx];

  /* ---------- Layout ---------- */
  function resize() {
    const w = el.frame.clientWidth;
    if (!w) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; cell = W / NR; H = cell * NROW;
    el.canvas.width = Math.round(W * dpr); el.canvas.height = Math.round(H * dpr);
    el.canvas.style.height = H + 'px';
    const ss = Math.round(cell * dpr);
    if (ss !== spriteSize) { spriteSize = ss; Symbols.clear(); }
    if (!raf) render(performance.now(), true);
  }

  /* ---------- Walzen-Animation ---------- */
  function update(r, now, dt) {
    switch (r.phase) {
      case 'wind': {
        const t = (now - r.t0) / 110;
        if (t >= 1) { r.phase = 'run'; r.pos = P0; r.v = 0; }
        else r.pos = P0 + 0.26 * Math.sin(t * Math.PI);
        break;
      }
      case 'run': {
        const vmax = turbo ? VMAX * 1.3 : VMAX;
        r.v = Math.min(vmax, r.v + vmax * dt / 0.16);
        r.pos -= r.v * dt;
        if (now >= r.stopAt) {
          r.target = Math.floor(r.pos) - 4;
          r.base = r.target;
          r.decelFrom = r.pos;
          r.decelStart = now;
          const dist = r.decelFrom - (r.target - OVERSHOOT);
          r.decelDur = 3 * dist / Math.max(8, r.v) * 1000;
          r.phase = 'decel';
        }
        break;
      }
      case 'decel': {
        const u = Math.min(1, (now - r.decelStart) / r.decelDur);
        const e = 1 - Math.pow(1 - u, 3);
        r.pos = r.decelFrom + (r.target - OVERSHOOT - r.decelFrom) * e;
        if (u >= 1) { r.phase = 'bounce'; r.bounceStart = now; land(r); }
        break;
      }
      case 'bounce': {
        const u = Math.min(1, (now - r.bounceStart) / 170);
        r.pos = r.target - OVERSHOOT * (1 - U.easeOutCubic(u));
        if (u >= 1) {
          r.pos = r.target; r.phase = 'idle';
          if (reels.every(x => x.phase === 'idle') && resolveSpin) { const f = resolveSpin; resolveSpin = null; f(); }
        }
        break;
      }
    }
  }

  function land(r) {
    Sfx.reelStop(r.i);
    r.landFlash = performance.now();
    const scat = r.result.filter(s => s === SCAT).length;
    if (scat) {
      const total = reels.slice(0, r.i + 1).reduce((s, x) => s + x.result.filter(v => v === SCAT).length, 0);
      Sfx.scatterLand(total);
      const rect = el.canvas.getBoundingClientRect();
      r.result.forEach((s, row) => {
        if (s === SCAT) FX.stars(rect.left + (r.i + 0.5) * cell, rect.top + (row + 0.5) * cell, 10, '#ffb3f0');
      });
    }
    // Spannung: nächste Walze läuft länger
    const next = reels[r.i + 1];
    if (next && next.antic && anticSoundFor !== next.i) { anticSoundFor = next.i; Sfx.anticipation(); }
  }

  function startReels(grid) {
    spinId++;
    const now = performance.now();
    const base = turbo ? 360 : 780, gap = turbo ? 80 : 200;
    let extra = 0, sc = 0;
    anticSoundFor = -1;
    reels.forEach((r, i) => {
      r.prev = r.result.slice();
      r.pos = P0; r.base = -1e9; r.result = grid[i];
      r.phase = 'wind'; r.t0 = now + i * 45; r.v = 0;
      r.antic = i > 0 && sc >= 2;
      if (r.antic) extra += turbo ? 500 : 1150;
      r.stopAt = now + base + i * gap + extra;
      sc += grid[i].filter(s => s === SCAT).length;
    });
    return new Promise(res => { resolveSpin = res; });
  }

  function quickStop() {
    const now = performance.now();
    let k = 0;
    reels.forEach(r => {
      if (r.phase === 'wind' || r.phase === 'run') {
        r.phase = 'run'; r.v = Math.max(r.v, VMAX * 0.8);
        r.stopAt = now + k * 55; r.antic = false; k++;
      }
    });
  }

  /* ---------- Gewinnauswertung ---------- */
  function evaluate(grid, b) {
    const lineBet = b / S.lines.length;
    const lines = [];
    S.lines.forEach((line, li) => {
      let sym = -1, n = 0;
      for (let r = 0; r < NR; r++) {
        const s = grid[r][line[r]];
        if (s === SCAT) break;
        if (s === WILD) { n++; continue; }
        if (sym === -1) { sym = s; n++; continue; }
        if (s === sym) { n++; continue; }
        break;
      }
      let wn = 0;
      for (let r = 0; r < NR; r++) { if (grid[r][line[r]] === WILD) wn++; else break; }
      if (sym === -1) sym = WILD;
      const a = n >= 3 ? SYM[sym].pays[n - 3] : 0;
      const w = wn >= 3 ? SYM[WILD].pays[wn - 3] : 0;
      const best = a >= w ? { sym, n, pay: a } : { sym: WILD, n: wn, pay: w };
      if (best.pay > 0) {
        lines.push({ line: li, sym: best.sym, n: best.n, amount: best.pay * lineBet,
          cells: Array.from({ length: best.n }, (_, r) => [r, line[r]]) });
      }
    });
    const scat = [];
    grid.forEach((col, r) => col.forEach((s, row) => { if (s === SCAT) scat.push([r, row]); }));
    return { lines, scat };
  }

  /* ---------- Zeichnen ---------- */
  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function showItems() {
    const items = [];
    if (wins.length > 1 || (wins.length && scatterHit)) items.push({ kind: 'all' });
    wins.forEach(w => items.push({ kind: 'line', w }));
    if (scatterHit) items.push({ kind: 'scatter' });
    return items;
  }

  function render(now, once = false) {
    const dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000 || 0)); lastT = now;
    let spinning = false;
    reels.forEach(r => {
      const p = r.pos; update(r, now, dt);
      r.speed = (p - r.pos) / Math.max(dt, 1e-3);
      if (r.phase === 'run' || r.phase === 'decel') spinning = true;
    });
    if (spinning) { tickAcc += dt; if (tickAcc > 0.07) { tickAcc = 0; Sfx.reelTick(); } }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // Welche Zellen/Linien sind gerade im Fokus?
    const items = showItems();
    let focusCells = null, focusLines = [], focusColor = null;
    if (items.length && state !== 'spinning') {
      const idx = Math.floor((now - showStart) / 1500) % items.length;
      const it = items[idx];
      focusCells = new Set();
      if (it.kind === 'all') {
        wins.forEach(w => { focusLines.push(w); w.cells.forEach(c => focusCells.add(c.join())); });
        if (scatterHit) scatterHit.cells.forEach(c => focusCells.add(c.join()));
      } else if (it.kind === 'line') {
        focusLines.push(it.w); it.w.cells.forEach(c => focusCells.add(c.join()));
        focusColor = S.lineColors[it.w.line];
      } else {
        scatterHit.cells.forEach(c => focusCells.add(c.join())); focusColor = '#ff5fd2';
      }
      if (idx !== lastShowIdx) { lastShowIdx = idx; describe(it); }
    }

    for (let i = 0; i < NR; i++) drawReel(reels[i], now, focusCells, focusColor);

    // Zylinder-Schattierung oben/unten
    let sg = g.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, 'rgba(6,2,14,0.78)'); sg.addColorStop(0.16, 'rgba(6,2,14,0)');
    sg.addColorStop(0.84, 'rgba(6,2,14,0)'); sg.addColorStop(1, 'rgba(6,2,14,0.78)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);

    // Trennstreifen
    for (let i = 1; i < NR; i++) {
      const x = i * cell;
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, 'rgba(255,201,74,0)'); lg.addColorStop(0.5, 'rgba(255,201,74,0.55)'); lg.addColorStop(1, 'rgba(255,201,74,0)');
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 2, 0, 4, H);
      g.fillStyle = lg; g.fillRect(x - 0.75, 0, 1.5, H);
    }

    // Gewinnlinien
    focusLines.forEach(w => drawLine(w, now, focusLines.length === 1));

    if (!once && active) raf = requestAnimationFrame(render);
    else raf = null;
  }

  function drawReel(r, now, focusCells, focusColor) {
    const x = r.i * cell;
    g.save();
    g.beginPath(); g.rect(x, 0, cell, H); g.clip();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#140a24'); bg.addColorStop(0.5, '#2b1848'); bg.addColorStop(1, '#140a24');
    g.fillStyle = bg; g.fillRect(x, 0, cell, H);
    // weicher Lichtstreifen in Walzenmitte
    const hl = g.createLinearGradient(x, 0, x + cell, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.045)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(x, 0, cell, H);

    const blur = Math.abs(r.speed) > 7 && (r.phase === 'run' || r.phase === 'decel');
    const p = r.pos, first = Math.floor(p) - 1;
    for (let idx = first; idx <= first + NROW + 1; idx++) {
      const y = (idx - p) * cell;
      if (y > H || y < -cell) continue;
      const s = symAt(r, idx);
      const spr = Symbols.sprite(SYM[s].id, spriteSize);
      const row = idx - r.base;
      const isResultCell = r.phase === 'idle' && row >= 0 && row < NROW;
      const key = r.i + ',' + row;
      if (blur) {
        const k = Math.min(1, Math.abs(r.speed) / VMAX);
        g.globalAlpha = 0.28 * k;
        for (let j = 1; j <= 3; j++) g.drawImage(spr, x, y - j * cell * 0.09 * k, cell, cell);
        g.globalAlpha = 1 - 0.35 * k;
        g.drawImage(spr, x, y, cell, cell);
        g.globalAlpha = 1;
      } else if (focusCells && isResultCell && focusCells.has(key)) {
        const col = focusColor || S.lineColors[(wins.find(w => w.cells.some(c => c.join() === key)) || { line: 0 }).line] || '#ffc94a';
        const pulse = 1 + 0.07 * Math.sin(now * 0.009);
        const rg = g.createRadialGradient(x + cell / 2, y + cell / 2, 0, x + cell / 2, y + cell / 2, cell * 0.6);
        rg.addColorStop(0, hexA(col, 0.38)); rg.addColorStop(1, hexA(col, 0));
        g.fillStyle = rg; g.fillRect(x, y, cell, cell);
        const sz = cell * pulse;
        g.drawImage(spr, x + (cell - sz) / 2, y + (cell - sz) / 2, sz, sz);
        g.lineWidth = Math.max(2, cell * 0.03); g.strokeStyle = col;
        g.shadowColor = col; g.shadowBlur = 14;
        roundRect(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.12); g.stroke();
        g.shadowBlur = 0;
      } else {
        g.drawImage(spr, x, y, cell, cell);
        if (focusCells && isResultCell) { g.fillStyle = 'rgba(8,3,18,0.6)'; g.fillRect(x, y, cell, cell); }
      }
    }
    // Landeblitz
    const lf = (now - r.landFlash) / 260;
    if (lf < 1) { g.fillStyle = `rgba(255,255,255,${0.12 * (1 - lf)})`; g.fillRect(x, 0, cell, H); }
    // Spannungs-Glühen
    const prevDone = r.i === 0 || reels[r.i - 1].phase === 'idle' || reels[r.i - 1].phase === 'bounce';
    if (r.antic && prevDone && (r.phase === 'run' || r.phase === 'decel')) {
      const a = 0.55 + 0.45 * Math.sin(now * 0.02);
      g.strokeStyle = `rgba(255,95,210,${a})`; g.lineWidth = 4; g.shadowColor = '#ff5fd2'; g.shadowBlur = 20;
      g.strokeRect(x + 3, 3, cell - 6, H - 6);
      g.fillStyle = `rgba(255,95,210,${0.08 * a})`; g.fillRect(x, 0, cell, H);
      g.shadowBlur = 0;
    }
    g.restore();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawLine(w, now, single) {
    const line = S.lines[w.line], col = S.lineColors[w.line];
    const pts = line.map((row, r) => [(r + 0.5) * cell, (row + 0.5) * cell]);
    pts.unshift([0, pts[0][1]]); pts.push([W, pts[pts.length - 1][1]]);
    const path = () => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); };
    // Einblend-Animation: Linie "zeichnet" sich
    const t = U.clamp((now - showStart) / 450, 0, 1);
    g.save();
    if (t < 1) { g.beginPath(); g.rect(0, 0, W * U.easeOutCubic(t), H); g.clip(); }
    g.lineJoin = 'round'; g.lineCap = 'round';
    path(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = cell * 0.075; g.stroke();
    path(); g.strokeStyle = col; g.lineWidth = cell * 0.045; g.shadowColor = col; g.shadowBlur = 16; g.stroke();
    path(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = cell * 0.014; g.shadowBlur = 0; g.stroke();
    g.restore();
    if (single) {
      const [x, y] = [cell * 0.13, pts[1][1]];
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12;
      g.beginPath(); g.arc(x, y, cell * 0.11, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#140a24'; g.font = `${Math.round(cell * 0.13)}px "Bungee", Impact, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(w.line + 1), x, y + 1);
    }
  }

  function describe(it) {
    if (it.kind === 'all') {
      const n = wins.length + (scatterHit ? 1 : 0);
      const sum = wins.reduce((s, w) => s + w.amount, 0) + (scatterHit ? scatterHit.amount : 0);
      el.msg.textContent = `${n} Gewinne · ${U.fmt(sum)}`;
    } else if (it.kind === 'line') {
      const w = it.w;
      el.msg.textContent = `Linie ${w.line + 1} · ${w.n}× ${SYM[w.sym].name} · ${U.fmt(w.amount)}`;
    } else {
      el.msg.textContent = `${scatterHit.count}× Bonus-Stern · ${U.fmt(scatterHit.amount)}`;
    }
  }

  /* ---------- Spielablauf ---------- */
  function updateUI() {
    el.bet.textContent = U.fmt(bet());
    el.minus.disabled = betIdx === 0 || state === 'spinning' || fsLeft > 0;
    el.plus.disabled = betIdx === S.bets.length - 1 || state === 'spinning' || fsLeft > 0;
    el.auto.classList.toggle('on', auto);
    el.auto.setAttribute('aria-pressed', auto);
    el.turbo.classList.toggle('on', turbo);
    el.turbo.setAttribute('aria-pressed', turbo);
    el.spin.classList.toggle('spinning', state === 'spinning');
    el.spinLabel.textContent = state === 'spinning' ? 'STOP' : fsLeft > 0 ? 'FREI' : 'DREHEN';
  }
  function updateFS() {
    el.fsBanner.hidden = !(inFS || fsLeft > 0);
    el.fsCount.textContent = fsLeft;
    el.fsWin.textContent = U.fmt(fsWinTotal);
    el.machine.classList.toggle('fs-mode', inFS || fsLeft > 0);
  }

  function clearWins() {
    wins = []; scatterHit = null; lastShowIdx = -1;
    el.winBox.classList.remove('has-win', 'big');
    el.win.textContent = '—';
  }

  async function presentWin(total, b) {
    const ratio = total / b;
    const c = FX.center(el.winBox);
    el.winBox.classList.add('has-win');
    if (ratio >= 15) {
      el.winBox.classList.add('big');
      FX.shake(el.machine, true);
      await Celebrate.bigWin(total, b);
      el.win.textContent = U.fmt(total);
    } else if (ratio >= 4) {
      Sfx.win(2); FX.shake(el.machine);
      FX.coins(c.x, c.y, 26, 1.1);
      FX.flash('rgba(255,201,74,0.25)');
      let lastTick = 0;
      await U.countUp(el.win, 0, total, 1200, U.fmt, v => { if (v - lastTick > total / 18) { lastTick = v; Sfx.countTick(); } });
    } else {
      Sfx.win(1);
      FX.coins(c.x, c.y, 9, 0.8);
      await U.countUp(el.win, 0, total, 550);
    }
  }

  async function spin() {
    Sfx.init();
    if (state === 'spinning') { quickStop(); return; }
    if (state !== 'idle') return;
    const b = bet();
    const free = fsLeft > 0;
    if (!free) {
      if (!Store.bet(b)) {
        auto = false; updateUI();
        App.insufficient(b);
        return;
      }
    } else { fsLeft--; }
    state = 'spinning';
    clearWins(); updateUI(); updateFS();
    el.msg.textContent = free ? 'Freispiel läuft …' : 'Viel Glück!';
    Store.stat('spins'); if (free) Store.stat('freeSpins');

    const grid = Array.from({ length: NR }, () => [randSym(), randSym(), randSym()]);
    Sfx.spinStart();
    if (!raf && active) raf = requestAnimationFrame(render);
    await startReels(grid);

    const ev = evaluate(grid, b);
    const mult = free ? S.freeSpinMult : 1;
    ev.lines.forEach(w => { w.amount *= mult; });
    const lineWin = ev.lines.reduce((s, w) => s + w.amount, 0);
    const sc = Math.min(5, ev.scat.length);
    let scatWin = 0, fsAward = 0;
    if (sc >= 3) { scatWin = S.scatterPays[sc][0] * b; fsAward = S.scatterPays[sc][1]; }
    const total = lineWin + scatWin;
    wins = ev.lines;
    scatterHit = sc >= 3 ? { cells: ev.scat, amount: scatWin, count: sc } : null;
    showStart = performance.now(); lastShowIdx = -1;
    state = 'presenting'; updateUI();
    if (free) fsWinTotal += total;

    if (total > 0) {
      Store.win(total);
      await presentWin(total, b);
    } else {
      el.msg.textContent = free ? 'Weiter geht’s …' : U.pick(['Knapp daneben!', 'Nächstes Mal!', 'Dreh weiter!', 'Das Glück wartet …']);
    }
    Store.emit({ type: 'slotResult', total, bet: b, lines: ev.lines, scatters: sc, free });
    updateFS();

    if (fsAward) {
      if (!inFS) { inFS = true; fsWinTotal = 0; }
      await Celebrate.banner('FREISPIELE!', `${fsAward} Freispiele · alle Gewinne ×${S.freeSpinMult}`, 'fs');
      fsLeft += fsAward;
      Store.emit({ type: 'freeSpins', count: fsAward });
      updateFS();
    } else if (free && fsLeft === 0) {
      await U.sleep(600);
      await Celebrate.banner('FREISPIELE BEENDET', `Gesamtgewinn: ${U.fmt(fsWinTotal)} Münzen`, 'summary');
      inFS = false; updateFS();
    }

    state = 'idle'; updateUI();
    continueAfter(total > 0);
  }

  async function continueAfter(hadWin) {
    if (fsLeft > 0) {
      await U.sleep(hadWin ? 1300 : 500);
      if (active && state === 'idle' && fsLeft > 0) spin();
    } else if (auto) {
      await U.sleep(hadWin ? (turbo ? 800 : 1500) : (turbo ? 220 : 480));
      if (auto && active && state === 'idle') spin();
    }
  }

  /* ---------- Gewinntabelle ---------- */
  function buildPaytable() {
    const box = $('#paytableBody');
    const b = bet(), lb = b / S.lines.length;
    const sprite = id => {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const src = Symbols.sprite(id, 160);
      c.getContext('2d').drawImage(src, 0, 0);
      c.className = 'pt-sym'; return c;
    };
    box.innerHTML = '';
    const intro = document.createElement('p');
    intro.className = 'pt-intro';
    intro.innerHTML = `Werte gelten für deinen aktuellen Einsatz von <b>${U.fmt(b)}</b> Münzen (10 Linien, von links nach rechts).`;
    box.appendChild(intro);
    const grid = document.createElement('div'); grid.className = 'pt-grid';
    [...SYM].map((s, i) => ({ s, i })).reverse().forEach(({ s }) => {
      const item = document.createElement('div'); item.className = 'pt-item' + (s.wild || s.scatter ? ' special' : '');
      item.appendChild(sprite(s.id));
      const info = document.createElement('div'); info.className = 'pt-info';
      if (s.scatter) {
        info.innerHTML = `<b>Bonus-Stern</b>` + Object.entries(S.scatterPays).map(([n, [m, fs]]) =>
          `<span><i>${n}×</i> ${U.fmt(m * b)} + ${fs} Freispiele</span>`).join('') + `<small>zählt überall auf den Walzen</small>`;
      } else {
        info.innerHTML = `<b>${s.name}</b>` + s.pays.map((p, k) => `<span><i>${k + 3}×</i> ${U.fmt(p * lb)}</span>`).join('') +
          (s.wild ? '<small>ersetzt alle Symbole außer Bonus</small>' : '');
      }
      item.appendChild(info); grid.appendChild(item);
    });
    box.appendChild(grid);
    const lh = document.createElement('h4'); lh.textContent = 'Gewinnlinien'; box.appendChild(lh);
    const lines = document.createElement('div'); lines.className = 'pt-lines';
    S.lines.forEach((line, li) => {
      const d = document.createElement('div'); d.className = 'pt-line';
      d.style.setProperty('--c', S.lineColors[li]);
      let html = `<span class="n">${li + 1}</span><div class="mini">`;
      for (let row = 0; row < 3; row++) for (let r = 0; r < 5; r++) html += `<i class="${line[r] === row ? 'on' : ''}"></i>`;
      d.innerHTML = html + '</div>';
      lines.appendChild(d);
    });
    box.appendChild(lines);
    const note = document.createElement('p'); note.className = 'pt-intro';
    note.textContent = `In den Freispielen zählen alle Liniengewinne ×${S.freeSpinMult}. Theoretische Auszahlungsquote ca. 95 %.`;
    box.appendChild(note);
  }

  /* ---------- Steuerung ---------- */
  el.spin.addEventListener('click', () => spin());
  el.minus.addEventListener('click', () => { Sfx.init(); Sfx.click(); betIdx = Math.max(0, betIdx - 1); updateUI(); });
  el.plus.addEventListener('click', () => { Sfx.init(); Sfx.click(); betIdx = Math.min(S.bets.length - 1, betIdx + 1); updateUI(); });
  el.auto.addEventListener('click', () => {
    Sfx.init(); Sfx.click(); auto = !auto; updateUI();
    if (auto && state === 'idle') spin();
  });
  el.turbo.addEventListener('click', () => { Sfx.init(); Sfx.click(); turbo = !turbo; updateUI(); });
  $('#slotInfo').addEventListener('click', () => { Sfx.init(); Sfx.click(); buildPaytable(); App.openModal('modal-paytable'); });
  window.addEventListener('resize', () => active && resize());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Symbols.clear(); if (active) resize(); });

  return {
    show() {
      active = true; resize(); updateUI(); updateFS();
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(render); }
      if (fsLeft > 0 && state === 'idle') setTimeout(() => active && state === 'idle' && spin(), 700);
    },
    hide() { active = false; auto = false; updateUI(); },
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); spin(); return true; }
      return false;
    },
  };
})();

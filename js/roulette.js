'use strict';
/* ---------- Grand Roulette (europäisch) ---------- */
const Roulette = (() => {
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const N = 37, SEG = Math.PI * 2 / N;
  const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
  const MAX_TOTAL = 10000;

  const el = {
    canvas: $('#rlWheel'), board: $('#rlBoard'), chips: $('#rlChips'), total: $('#rlTotal'), msg: $('#rlMsg'),
    spin: $('#rlSpin'), clear: $('#rlClear'), undo: $('#rlUndo'), rebet: $('#rlRebet'), dbl: $('#rlDouble'),
    result: $('#rlResult'), history: $('#rlHistory'), stage: $('#rlStage'),
  };
  const g = el.canvas.getContext('2d');

  // Wetten: Schlüssel -> { nums, pay (Gesamtrückzahlung ×Einsatz), label }
  const BETS = {};
  for (let n = 0; n <= 36; n++) BETS['n' + n] = { nums: [n], pay: 36, label: String(n) };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const all = range(1, 36);
  Object.assign(BETS, {
    col1: { nums: all.filter(n => n % 3 === 1), pay: 3, label: '2:1' },
    col2: { nums: all.filter(n => n % 3 === 2), pay: 3, label: '2:1' },
    col3: { nums: all.filter(n => n % 3 === 0), pay: 3, label: '2:1' },
    doz1: { nums: range(1, 12), pay: 3, label: '1. Dutzend' },
    doz2: { nums: range(13, 24), pay: 3, label: '2. Dutzend' },
    doz3: { nums: range(25, 36), pay: 3, label: '3. Dutzend' },
    low: { nums: range(1, 18), pay: 2, label: '1–18' },
    high: { nums: range(19, 36), pay: 2, label: '19–36' },
    even: { nums: all.filter(n => n % 2 === 0), pay: 2, label: 'Gerade' },
    odd: { nums: all.filter(n => n % 2 === 1), pay: 2, label: 'Ungerade' },
    red: { nums: all.filter(n => REDS.has(n)), pay: 2, label: 'Rot' },
    black: { nums: all.filter(n => !REDS.has(n)), pay: 2, label: 'Schwarz' },
  });

  let bets = {}, lastBets = null, history = [], undoStack = [];
  let spinning = false, active = false, raf = null;
  let size = 0, dpr = 1, rotor = null, rim = null;
  let wheelAngle = 0, ball = { a: -Math.PI / 2, r: 0, visible: false };
  let anim = null;
  let rack;

  /* ---------- Tableau ---------- */
  function cell(key, text, cls, d, m) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rl-cell ' + cls; b.dataset.bet = key;
    b.style.cssText = `--c:${d[0]};--r:${d[1]};--cs:${d[2] || 1};--rs:${d[3] || 1};--mc:${m[0]};--mr:${m[1]};--mcs:${m[2] || 1};--mrs:${m[3] || 1}`;
    b.innerHTML = `<span class="rl-t">${text}</span>`;
    b.setAttribute('aria-label', 'Setzen auf ' + (BETS[key].label));
    b.addEventListener('click', () => place(key, b));
    b.addEventListener('contextmenu', e => { e.preventDefault(); remove(key); });
    el.board.appendChild(b);
  }
  function buildBoard() {
    el.board.innerHTML = '';
    cell('n0', '0', 'green zero', [1, 1, 1, 3], [3, 1, 3, 1]);
    for (let n = 1; n <= 36; n++) {
      const col = Math.ceil(n / 3) + 1, row = 3 - ((n - 1) % 3);
      const mrow = Math.ceil(n / 3) + 1, mcol = 2 + ((n - 1) % 3) + 1;
      cell('n' + n, String(n), colorOf(n), [col, row], [mcol, mrow]);
    }
    cell('col3', '2:1', 'outside col', [14, 1], [5, 14]);
    cell('col2', '2:1', 'outside col', [14, 2], [4, 14]);
    cell('col1', '2:1', 'outside col', [14, 3], [3, 14]);
    cell('doz1', '1–12', 'outside', [2, 4, 4], [2, 2, 1, 4]);
    cell('doz2', '13–24', 'outside', [6, 4, 4], [2, 6, 1, 4]);
    cell('doz3', '25–36', 'outside', [10, 4, 4], [2, 10, 1, 4]);
    cell('low', '1–18', 'outside', [2, 5, 2], [1, 2, 1, 2]);
    cell('even', 'Gerade', 'outside', [4, 5, 2], [1, 4, 1, 2]);
    cell('red', '<i class="diamond red"></i>', 'outside', [6, 5, 2], [1, 6, 1, 2]);
    cell('black', '<i class="diamond black"></i>', 'outside', [8, 5, 2], [1, 8, 1, 2]);
    cell('odd', 'Ungerade', 'outside', [10, 5, 2], [1, 10, 1, 2]);
    cell('high', '19–36', 'outside', [12, 5, 2], [1, 12, 1, 2]);
    // Hover-Vorschau: welche Zahlen deckt die Wette ab
    $$('.rl-cell', el.board).forEach(b => {
      b.addEventListener('pointerenter', () => { if (!spinning) BETS[b.dataset.bet].nums.forEach(n => cellOf('n' + n).classList.add('cover')); });
      b.addEventListener('pointerleave', () => $$('.rl-cell.cover', el.board).forEach(c => c.classList.remove('cover')));
    });
  }
  const cellOf = key => el.board.querySelector(`[data-bet="${key}"]`);
  const totalBet = () => Object.values(bets).reduce((s, v) => s + v, 0);

  function place(key, btn) {
    if (spinning) return;
    Sfx.init();
    const v = rack.value, tot = totalBet();
    if (tot + v > Math.min(MAX_TOTAL, Store.s.balance)) { Sfx.error(); setMsg(tot + v > MAX_TOTAL ? `Tischlimit: ${U.fmt(MAX_TOTAL)} pro Drehung.` : 'Nicht genug Münzen für diesen Chip.'); FX.shake(btn); return; }
    clearResultMarks();
    bets[key] = (bets[key] || 0) + v;
    undoStack.push([key, v]);
    Sfx.chip();
    Chips.fly($('.chip-btn.on', el.chips), btn, v);
    renderBets();
  }
  function remove(key) {
    if (spinning || !bets[key]) return;
    Sfx.click(); delete bets[key]; undoStack = undoStack.filter(([k]) => k !== key); renderBets();
  }
  function renderBets() {
    $$('.mini-bet', el.board).forEach(n => n.remove());
    for (const [k, v] of Object.entries(bets)) { const c = cellOf(k); if (c) c.appendChild(Chips.marker(v)); }
    const tot = totalBet();
    el.total.textContent = U.fmt(tot);
    el.spin.disabled = spinning || !tot;
    el.clear.disabled = spinning || !tot;
    el.undo.disabled = spinning || !undoStack.length;
    el.rebet.disabled = spinning || !lastBets || !!tot;
    el.dbl.disabled = spinning || !tot || tot * 2 > Math.min(MAX_TOTAL, Store.s.balance);
    $$('.rl-cell', el.board).forEach(b => { b.disabled = spinning; });
  }
  function setMsg(t) { el.msg.textContent = t; }
  function clearResultMarks() { $$('.rl-cell.hit, .rl-cell.won', el.board).forEach(c => c.classList.remove('hit', 'won')); }

  /* ---------- Kessel: vorgerenderte Ebenen ---------- */
  function layers() {
    const S = Math.round(size * dpr), R = S / 2;
    // Rotor (dreht sich)
    rotor = document.createElement('canvas'); rotor.width = rotor.height = S;
    const r = rotor.getContext('2d'); r.translate(R, R);
    const Rp = R * 0.66, Ri = R * 0.47;
    // Nummernring
    for (let i = 0; i < N; i++) {
      const n = ORDER[i], a0 = -Math.PI / 2 + i * SEG - SEG / 2, a1 = a0 + SEG;
      r.fillStyle = n === 0 ? '#128a4a' : REDS.has(n) ? '#b3122e' : '#15101c';
      r.beginPath(); r.arc(0, 0, Rp, a0, a1); r.arc(0, 0, Ri, a1, a0, true); r.closePath(); r.fill();
      // Zahl
      r.save(); r.rotate(a0 + SEG / 2 + Math.PI / 2);
      r.fillStyle = '#fff'; r.font = `700 ${Math.round(R * 0.075)}px Rubik, sans-serif`; r.textAlign = 'center'; r.textBaseline = 'middle';
      r.fillText(String(n), 0, -(Rp - R * 0.055)); r.restore();
    }
    // Fächerboden (dunkler Innenring mit Stegen)
    for (let i = 0; i < N; i++) {
      const n = ORDER[i], a0 = -Math.PI / 2 + i * SEG - SEG / 2, a1 = a0 + SEG;
      r.fillStyle = n === 0 ? '#0c5a30' : REDS.has(n) ? '#6e0a1c' : '#0a0710';
      r.beginPath(); r.arc(0, 0, Rp - R * 0.11, a0, a1); r.arc(0, 0, Ri, a1, a0, true); r.closePath(); r.fill();
    }
    r.strokeStyle = '#e8c470'; r.lineWidth = Math.max(1, R * 0.008);
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * SEG - SEG / 2;
      r.beginPath(); r.moveTo(Math.cos(a) * Ri, Math.sin(a) * Ri); r.lineTo(Math.cos(a) * Rp, Math.sin(a) * Rp); r.stroke();
    }
    r.lineWidth = Math.max(1.5, R * 0.012);
    r.beginPath(); r.arc(0, 0, Rp, 0, Math.PI * 2); r.stroke();
    r.beginPath(); r.arc(0, 0, Rp - R * 0.11, 0, Math.PI * 2); r.stroke();
    // Konus
    const cone = r.createRadialGradient(-R * 0.1, -R * 0.12, R * 0.02, 0, 0, Ri);
    cone.addColorStop(0, '#c98a42'); cone.addColorStop(0.5, '#7a4418'); cone.addColorStop(1, '#3a1a06');
    r.fillStyle = cone; r.beginPath(); r.arc(0, 0, Ri, 0, Math.PI * 2); r.fill();
    for (let k = 0; k < 8; k++) {
      r.save(); r.rotate(k * Math.PI / 4);
      r.fillStyle = 'rgba(255,230,160,0.12)'; r.beginPath(); r.moveTo(0, 0); r.arc(0, 0, Ri * 0.98, -0.08, 0.08); r.closePath(); r.fill(); r.restore();
    }
    r.strokeStyle = '#e8c470'; r.lineWidth = R * 0.014; r.beginPath(); r.arc(0, 0, Ri, 0, Math.PI * 2); r.stroke();
    // Drehkreuz
    const gold = r.createLinearGradient(-R * 0.3, -R * 0.3, R * 0.3, R * 0.3);
    gold.addColorStop(0, '#fff2b8'); gold.addColorStop(0.5, '#d9a030'); gold.addColorStop(1, '#6a4000');
    for (let k = 0; k < 4; k++) {
      r.save(); r.rotate(k * Math.PI / 2);
      r.fillStyle = gold; r.beginPath(); r.moveTo(-R * 0.018, 0); r.lineTo(R * 0.018, 0); r.lineTo(R * 0.01, -R * 0.3); r.lineTo(-R * 0.01, -R * 0.3); r.closePath(); r.fill();
      r.beginPath(); r.arc(0, -R * 0.31, R * 0.028, 0, Math.PI * 2); r.fill();
      r.restore();
    }
    r.fillStyle = gold; r.beginPath(); r.arc(0, 0, R * 0.075, 0, Math.PI * 2); r.fill();
    r.fillStyle = 'rgba(255,255,255,0.6)'; r.beginPath(); r.arc(-R * 0.02, -R * 0.025, R * 0.022, 0, Math.PI * 2); r.fill();

    // Statischer Rand + Kugelbahn
    rim = document.createElement('canvas'); rim.width = rim.height = S;
    const m = rim.getContext('2d'); m.translate(R, R);
    const wood = m.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
    wood.addColorStop(0, '#3a1a08'); wood.addColorStop(0.35, '#8a4a18'); wood.addColorStop(0.7, '#5a2a0a'); wood.addColorStop(1, '#2a1004');
    m.fillStyle = wood; m.beginPath(); m.arc(0, 0, R, 0, Math.PI * 2); m.arc(0, 0, R * 0.8, 0, Math.PI * 2, true); m.fill('evenodd');
    for (let k = 0; k < 60; k++) { m.strokeStyle = `rgba(0,0,0,${0.05 + (k % 3) * 0.03})`; m.lineWidth = 1; m.beginPath(); m.arc(0, 0, R * (0.81 + k * 0.003), k, k + 2); m.stroke(); }
    m.strokeStyle = '#e8c470'; m.lineWidth = R * 0.012; m.beginPath(); m.arc(0, 0, R * 0.985, 0, Math.PI * 2); m.stroke();
    // Kugelbahn
    const track = m.createRadialGradient(0, 0, R * 0.66, 0, 0, R * 0.8);
    track.addColorStop(0, '#1a0c06'); track.addColorStop(0.35, '#d8c09a'); track.addColorStop(0.8, '#b89060'); track.addColorStop(1, '#4a2a10');
    m.fillStyle = track; m.beginPath(); m.arc(0, 0, R * 0.8, 0, Math.PI * 2); m.arc(0, 0, R * 0.66, 0, Math.PI * 2, true); m.fill('evenodd');
    // Rauten (Ablenker)
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8, rr = R * 0.72;
      m.save(); m.translate(Math.cos(a) * rr, Math.sin(a) * rr); m.rotate(a);
      m.fillStyle = '#e8c470'; m.beginPath(); m.moveTo(-R * 0.03, 0); m.lineTo(0, -R * 0.014); m.lineTo(R * 0.03, 0); m.lineTo(0, R * 0.014); m.closePath(); m.fill();
      m.restore();
    }
  }

  function resize() {
    const box = el.canvas.parentElement;
    size = Math.min(box.clientWidth - 8, window.innerWidth < 720 ? 310 : 420);
    if (size < 50) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    el.canvas.width = el.canvas.height = Math.round(size * dpr);
    el.canvas.style.width = el.canvas.style.height = size + 'px';
    layers();
    draw();
  }

  function draw() {
    const S = el.canvas.width, R = S / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    // Schatten des Kessels
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(R, R + R * 0.03, R * 0.99, 0, Math.PI * 2); g.fill();
    g.drawImage(rim, 0, 0);
    g.save(); g.translate(R, R); g.rotate(wheelAngle); g.drawImage(rotor, -R, -R); g.restore();
    // Glanzlicht
    const gl = g.createLinearGradient(0, 0, S, S);
    gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gl; g.beginPath(); g.arc(R, R, R * 0.8, 0, Math.PI * 2); g.fill();
    // Kugel
    if (ball.visible) {
      const bx = R + Math.cos(ball.a) * ball.r * R, by = R + Math.sin(ball.a) * ball.r * R, br = R * 0.028;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(bx + br * 0.4, by + br * 0.5, br, 0, Math.PI * 2); g.fill();
      const bg = g.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#e6e0ee'); bg.addColorStop(1, '#8a8098');
      g.fillStyle = bg; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
    }
  }

  function idle(now) {
    if (!active) { raf = null; return; }
    if (!anim) { wheelAngle += 0.0025; if (ball.visible && ball.stuck != null) ball.a = wheelAngle + ball.stuck; draw(); }
    raf = requestAnimationFrame(idle);
  }

  /* ---------- Drehung ---------- */
  function spinWheel(result) {
    return new Promise(res => {
      const idx = ORDER.indexOf(result);
      const pocketLocal = -Math.PI / 2 + idx * SEG;
      const t0 = performance.now(), T2 = 5200, T3 = 7400;
      const w0 = wheelAngle, omega = 1.5, tau = 3.6;
      const wAt = t => w0 + omega * tau * (1 - Math.exp(-t / tau));
      const b0 = Math.random() * Math.PI * 2;
      const off0 = b0 - (w0 + pocketLocal);
      const mod = ((off0 % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const delta = -mod - Math.PI * 2 * 7;
      const Rt = 0.745, Rp = 0.515;
      let lastBounce = 0, settled = false;
      ball.visible = true; ball.stuck = null;
      Sfx.roll && Sfx.roll(T2 / 1000);
      anim = true;
      const step = now => {
        const t = (now - t0) / 1000, u = Math.min(1, (now - t0) / T2);
        wheelAngle = wAt(t);
        const e = 1 - Math.pow(1 - u, 2.6);
        ball.a = wheelAngle + pocketLocal + off0 + delta * e;
        if (u < 0.6) ball.r = Rt;
        else {
          const v = (u - 0.6) / 0.4;
          const bounce = Math.abs(Math.sin(v * Math.PI * 3.5)) * (1 - v) * 0.06;
          ball.r = Rt + (Rp - Rt) * Math.min(1, v * 1.5) + bounce;
          const bi = Math.floor(v * 3.5);
          if (bi !== lastBounce && v < 0.9) { lastBounce = bi; Sfx.bounce && Sfx.bounce(1 - v); }
        }
        if (u >= 1 && !settled) { settled = true; ball.r = Rp; Sfx.pocket && Sfx.pocket(); res(); }
        if (settled) ball.a = wheelAngle + pocketLocal;
        draw();
        if (now - t0 < T3) requestAnimationFrame(step);
        else { anim = null; ball.stuck = pocketLocal; }
      };
      requestAnimationFrame(step);
    });
  }

  async function spin() {
    if (spinning) return;
    Sfx.init();
    const tot = totalBet();
    if (!tot) { setMsg('Setze zuerst Chips auf das Tableau.'); Sfx.error(); return; }
    if (!Store.bet(tot)) { App.insufficient(tot); return; }
    Store.hold('roulette', tot);
    if (window.innerWidth < 720) el.canvas.scrollIntoView({ block: 'center', behavior: U.reducedMotion ? 'auto' : 'smooth' });
    spinning = true; lastBets = { ...bets }; undoStack = [];
    clearResultMarks(); el.result.classList.add('empty');
    renderBets();
    setMsg('Nichts geht mehr!');
    const result = Math.floor(Math.random() * 37);
    Store.settle('roulette', Object.entries(bets).reduce((s, [k, v]) => s + (BETS[k].nums.includes(result) ? v * BETS[k].pay : 0), 0));
    await spinWheel(result);
    // Auswertung
    let ret = 0, straightHit = false;
    const hitKeys = [];
    for (const [k, v] of Object.entries(bets)) {
      if (BETS[k].nums.includes(result)) { ret += v * BETS[k].pay; hitKeys.push(k); if (k.startsWith('n')) straightHit = true; }
    }
    const c = colorOf(result);
    cellOf('n' + result).classList.add('hit');
    hitKeys.forEach(k => cellOf(k).classList.add('won'));
    $$('.mini-bet', el.board).forEach(m => { if (!m.parentElement.classList.contains('won')) m.classList.add('lost'); });
    showResult(result, c, ret, tot);
    history.unshift(result); history.length = Math.min(history.length, 14);
    renderHistory();
    Store.release('roulette');
    const net = ret - tot;
    if (ret > 0) Store.win(ret, net);
    if (net > 0) {
      const cc = FX.center(el.result);
      FX.coins(cc.x, cc.y, Math.min(50, 10 + Math.round(ret / tot * 3)), 1);
      if (straightHit) { FX.confetti(90); Sfx.win(3); } else Sfx.win(2);
      setMsg(I18N.t('Gewinn: {0} Münzen (+{1})', U.fmt(ret), U.fmt(net)));
      if (ret >= tot * 15) Celebrate.bigWin(ret, tot);
    } else if (ret > 0) {
      Sfx.push();
      setMsg(I18N.t('Zurück: {0} von {1} Münzen ({2})', U.fmt(ret), U.fmt(tot), '−' + U.fmt(-net)));
    } else { Sfx.lose(); setMsg(result === 0 ? 'Null! Die Bank gewinnt.' : 'Leider daneben. Nochmal?'); }
    Store.stat('rlSpins');
    Store.emit({ type: 'roulette', result, win: ret, bet: tot, straight: straightHit, net: ret - tot });
    await U.sleep(1600);
    bets = {}; spinning = false;
    renderBets();
  }

  function showResult(n, c, ret, tot) {
    el.result.className = 'rl-result ' + c;
    const tags = n === 0 ? ['Null'] : [c === 'red' ? 'Rot' : 'Schwarz', n % 2 ? 'Ungerade' : 'Gerade', n <= 18 ? '1–18' : '19–36'];
    const net = ret - tot;
    el.result.innerHTML = `<b>${n}</b><span>${tags.map(x => I18N.t(x)).join(' · ')}</span>${tot ? `<em class="${net > 0 ? 'good' : net < 0 ? 'bad' : ''}">${net > 0 ? '+' : net < 0 ? '−' : '±'}${U.fmt(Math.abs(net))}</em>` : ''}`;
    el.result.animate([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
  }
  function renderHistory() {
    el.history.innerHTML = history.map((n, i) => `<span class="rl-h ${colorOf(n)}${i === 0 ? ' last' : ''}">${n}</span>`).join('');
  }

  /* ---------- Steuerung ---------- */
  rack = Chips.rack(el.chips, null, 0);
  buildBoard();
  el.spin.addEventListener('click', spin);
  el.clear.addEventListener('click', () => { Sfx.click(); bets = {}; undoStack = []; clearResultMarks(); renderBets(); });
  el.undo.addEventListener('click', () => {
    const u = undoStack.pop(); if (!u) return; Sfx.click();
    bets[u[0]] -= u[1]; if (bets[u[0]] <= 0) delete bets[u[0]]; renderBets();
  });
  el.rebet.addEventListener('click', () => {
    if (!lastBets) return;
    const tot = Object.values(lastBets).reduce((s, v) => s + v, 0);
    if (tot > Store.s.balance) { Sfx.error(); setMsg('Nicht genug Münzen für die letzte Wette.'); return; }
    Sfx.chip(); bets = { ...lastBets }; clearResultMarks(); renderBets();
  });
  el.dbl.addEventListener('click', () => {
    const tot = totalBet(); if (tot * 2 > Math.min(MAX_TOTAL, Store.s.balance)) return;
    Sfx.chip(); for (const k in bets) bets[k] *= 2; renderBets();
  });
  window.addEventListener('resize', () => active && resize());
  I18N.onChange(() => renderBets());
  Store.on(ev => { if (ev.type === 'balance' && active && !spinning) renderBets(); });

  return {
    show() { active = true; requestAnimationFrame(() => { resize(); renderBets(); if (!raf) raf = requestAnimationFrame(idle); }); },
    hide() { active = false; },
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); spin(); return true; }
      if (e.code === 'KeyR') { el.rebet.click(); return true; }
      if (e.code === 'Backspace' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) { el.undo.click(); return true; }
      return false;
    },
  };
})();

'use strict';
/* ---------- Rubbellose ---------- */
const Scratch = (() => {
  const PRICES = [20, 50, 100, 250, 500];
  // Gewinnsymbole: Vielfaches des Lospreises und Wahrscheinlichkeit (RTP ≈ 96 %)
  const PRIZES = [
    { id: 'seven', mult: 100, p: 0.0015 },
    { id: 'diamond', mult: 25, p: 0.006 },
    { id: 'clover', mult: 10, p: 0.016 },
    { id: 'bell', mult: 4, p: 0.045 },
    { id: 'lemon', mult: 2, p: 0.08 },
    { id: 'cherry', mult: 1, p: 0.16 },
  ];
  const el = {
    ticket: $('#scTicket'), grid: $('#scGrid'), cover: $('#scCover'), buy: $('#scBuy'), buyLabel: $('#scBuyLabel'),
    reveal: $('#scReveal'), msg: $('#scMsg'), table: $('#scTable'), price: $('#scPrice'), coin: $('#scCoin'),
  };
  const stepper = BetStepper($('#scMinus'), el.price, $('#scPlus'), PRICES, 1, () => { renderTable(); updateUI(); });
  const cg = el.cover.getContext('2d');
  let state = 'none'; // none | scratching | done
  let cells = [], outcome = null, price = 0, drawing = false, lastPt = null, checkT = 0, scratchSnd = 0;
  let W = 0, H = 0, dpr = 1;

  function renderTable() {
    const p = stepper.value;
    el.table.innerHTML = PRIZES.map(z => `<li><img alt="" src="${iconURL(z.id)}"><span>3×</span><b>${U.fmt(p * z.mult)}</b></li>`).join('');
  }
  const icons = {};
  function iconURL(id) {
    if (icons[id]) return icons[id];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    c.getContext('2d').drawImage(Symbols.sprite(id, 96, true), 0, 0);
    return (icons[id] = c.toDataURL());
  }

  function makeOutcome() {
    let r = Math.random(), win = null;
    for (const z of PRIZES) { if (r < z.p) { win = z; break; } r -= z.p; }
    const ids = PRIZES.map(z => z.id);
    const counts = {};
    const grid = [];
    if (win) { for (let i = 0; i < 3; i++) grid.push(win.id); counts[win.id] = 3; }
    while (grid.length < 9) {
      const id = U.pick(ids);
      if (win && id === win.id) continue;
      if ((counts[id] || 0) >= 2) continue;
      counts[id] = (counts[id] || 0) + 1; grid.push(id);
    }
    for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
    return { win, grid };
  }

  function sizeCover() {
    const r = el.grid.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
    el.cover.width = Math.round(W * dpr); el.cover.height = Math.round(H * dpr);
    el.cover.style.width = W + 'px'; el.cover.style.height = H + 'px';
  }

  function paintCover() {
    sizeCover();
    cg.setTransform(dpr, 0, 0, dpr, 0, 0);
    cg.globalCompositeOperation = 'source-over';
    const lg = cg.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, '#d8d6e0'); lg.addColorStop(0.3, '#9c9aa8'); lg.addColorStop(0.5, '#eeedf4'); lg.addColorStop(0.7, '#8e8c9c'); lg.addColorStop(1, '#c8c6d2');
    cg.fillStyle = lg; cg.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { cg.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,36,60'},${Math.random() * 0.12})`; cg.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); }
    // Rautenmuster + Münzen
    cg.strokeStyle = 'rgba(255,255,255,0.25)'; cg.lineWidth = 1;
    for (let x = -H; x < W; x += 18) { cg.beginPath(); cg.moveTo(x, 0); cg.lineTo(x + H, H); cg.stroke(); }
    const gr = el.grid.getBoundingClientRect();
    const centers = $$('.sc-cell', el.grid).map(cell => { const r = cell.getBoundingClientRect(); return [r.left - gr.left + r.width / 2, r.top - gr.top + r.height / 2]; });
    for (let i = 0; i < 9; i++) {
      const [x, y] = centers[i] || [W * ((i % 3) + 0.5) / 3, H * (Math.floor(i / 3) + 0.5) / 3];
      cg.fillStyle = 'rgba(70,60,100,0.22)'; cg.beginPath(); cg.arc(x, y, Math.min(W, H) * 0.09, 0, Math.PI * 2); cg.fill();
      cg.fillStyle = 'rgba(70,60,100,0.35)'; cg.font = `${Math.round(Math.min(W, H) * 0.08)}px Bungee, Impact, sans-serif`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.fillText('?', x, y + 1);
    }
    cg.fillStyle = 'rgba(40,30,70,0.55)'; cg.font = `${Math.round(Math.min(W, H) * 0.075)}px Bungee, Impact, sans-serif`;
    cg.fillText(I18N.t('HIER RUBBELN'), W / 2, H / 2 + Math.min(W, H) * 0.02);
    el.cover.style.opacity = 1;
  }

  function buy() {
    if (state === 'scratching') return;
    Sfx.init();
    const p = stepper.value;
    if (!Store.bet(p)) { App.insufficient(p); return; }
    Store.hold('scratch', p);
    price = p; outcome = makeOutcome();
    Store.settle('scratch', outcome.win ? p * outcome.win.mult : 0);
    el.cover.style.pointerEvents = '';
    Store.stat('tickets');
    el.grid.innerHTML = outcome.grid.map(id => `<div class="sc-cell"><img alt="" src="${iconURL(id)}"></div>`).join('');
    cells = $$('.sc-cell', el.grid);
    el.ticket.classList.remove('won', 'lost'); el.ticket.classList.add('fresh');
    el.ticket.animate([{ transform: 'translateY(30px) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    state = 'scratching';
    requestAnimationFrame(paintCover);
    Sfx.card();
    setMsg('Rubbel das Feld frei – mit Maus oder Finger.');
    updateUI();
  }

  function scratchAt(x, y) {
    cg.globalCompositeOperation = 'destination-out';
    const r = Math.max(14, Math.min(W, H) * 0.075);
    const rg = cg.createRadialGradient(x, y, r * 0.3, x, y, r);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    cg.fillStyle = rg;
    if (lastPt) {
      const d = Math.hypot(x - lastPt.x, y - lastPt.y), n = Math.ceil(d / (r * 0.3));
      for (let i = 1; i <= n; i++) {
        const px = lastPt.x + (x - lastPt.x) * i / n, py = lastPt.y + (y - lastPt.y) * i / n;
        const g2 = cg.createRadialGradient(px, py, r * 0.3, px, py, r); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        cg.fillStyle = g2; cg.beginPath(); cg.arc(px, py, r, 0, Math.PI * 2); cg.fill();
      }
    } else { cg.beginPath(); cg.arc(x, y, r, 0, Math.PI * 2); cg.fill(); }
    lastPt = { x, y };
    const now = performance.now();
    if (now - scratchSnd > 70) { scratchSnd = now; Sfx.scratch ? Sfx.scratch() : Sfx.reelTick(); }
    if (Math.random() < 0.3) { const r2 = el.cover.getBoundingClientRect(); FX.sparks(r2.left + x, r2.top + y, 2, '#e8e6f0', 80); }
    if (now - checkT > 250) { checkT = now; checkProgress(); }
  }

  function checkProgress() {
    const w = el.cover.width, h = el.cover.height;
    const data = cg.getImageData(0, 0, w, h).data;
    let clear = 0, total = 0;
    const step = Math.max(4, Math.round(w / 60));
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { total++; if (data[(y * w + x) * 4 + 3] < 100) clear++; }
    if (clear / total > 0.55) finish();
  }

  function finish() {
    if (state !== 'scratching') return;
    state = 'done'; drawing = false; lastPt = null;
    Store.release('scratch');
    el.cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).onfinish = () => { cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, el.cover.width, el.cover.height); el.cover.style.opacity = 0; };
    el.ticket.classList.remove('fresh');
    if (outcome.win) {
      const win = price * outcome.win.mult;
      outcome.grid.forEach((id, i) => { if (id === outcome.win.id) cells[i].classList.add('hit'); });
      Store.win(win, win - price);
      el.ticket.classList.add('won');
      Sfx.win(outcome.win.mult >= 10 ? 3 : 2);
      const c = FX.center(el.ticket);
      FX.coins(c.x, c.y, Math.min(50, 10 + outcome.win.mult), 1.1);
      if (outcome.win.mult >= 25) { FX.confetti(100); Celebrate.bigWin(win, price); }
      setMsg(`Drei gleiche! Du gewinnst ${U.fmt(win)} Münzen.`);
      Store.emit({ type: 'scratch', mult: outcome.win.mult, win, bet: price });
    } else {
      el.ticket.classList.add('lost');
      Sfx.lose();
      setMsg('Leider keine drei gleichen. Nächstes Los?');
      Store.emit({ type: 'scratch', mult: 0, win: 0, bet: price });
    }
    updateUI();
  }

  function setMsg(t) { el.msg.textContent = t; }
  function updateUI() {
    el.buy.disabled = state === 'scratching';
    el.reveal.disabled = state !== 'scratching';
    stepper.locked = state === 'scratching';
    el.buyLabel.textContent = state === 'done' ? 'Neues Los' : 'Los kaufen';
    $('#scBuySub').textContent = U.fmt(stepper.value) + ' Münzen';
  }

  // Rubbeln per Zeiger
  const pos = e => { const r = el.cover.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  el.cover.addEventListener('pointerdown', e => {
    if (state !== 'scratching') return;
    e.preventDefault(); drawing = true; lastPt = null; el.cover.setPointerCapture(e.pointerId);
    const p = pos(e); scratchAt(p.x, p.y);
  });
  el.cover.addEventListener('pointermove', e => {
    const p = pos(e);
    el.coin.style.transform = `translate(${p.x}px, ${p.y}px)`;
    el.coin.hidden = state !== 'scratching';
    if (drawing && state === 'scratching') scratchAt(p.x, p.y);
  });
  const up = () => { drawing = false; lastPt = null; };
  el.cover.addEventListener('pointerup', up); el.cover.addEventListener('pointercancel', up);
  el.cover.addEventListener('pointerleave', () => { el.coin.hidden = true; up(); });
  MobileDock([el.buy, el.reveal], $('.scratch-layout .sc-dock'));
  el.buy.addEventListener('click', buy);
  I18N.onChange(() => { renderTable(); updateUI(); if (state !== 'done') requestAnimationFrame(paintCover); });
  el.reveal.addEventListener('click', () => { Sfx.click(); finish(); });
  window.addEventListener('resize', () => { if (state === 'scratching') paintCover(); });

  return {
    show() {
      renderTable(); updateUI();
      if (state === 'none') {
        // Beispiel-Los zeigen, damit das Feld nicht leer ist
        el.grid.innerHTML = ['seven', 'bell', 'cherry', 'clover', 'seven', 'lemon', 'diamond', 'cherry', 'seven'].map(id => `<div class="sc-cell"><img alt="" src="${iconURL(id)}"></div>`).join('');
        requestAnimationFrame(paintCover);
        el.cover.style.pointerEvents = 'none';
        setMsg('Kauf ein Los und rubbel drei gleiche Symbole frei.');
      }
    },
    hide() {},
    key(e) {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (state === 'scratching') finish(); else buy(); return true; }
      return false;
    },
    _enable() { el.cover.style.pointerEvents = ''; },
  };
})();

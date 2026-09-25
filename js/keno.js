'use strict';
/* ---------- Keno: 10 aus 40 ---------- */
const Keno = (() => {
  const BETS = [10, 20, 50, 100, 250, 500];
  const N = 40, DRAW = 10, MAXPICK = 10;
  // Auszahlung (×Einsatz) nach Anzahl gewählter Zahlen und Treffer – je ca. 95 % (tools/keno.py)
  const PAY = {
    1: { 1: 3.8 }, 2: { 1: 1, 2: 10 }, 3: { 2: 3, 3: 45 }, 4: { 2: 2, 3: 8.5, 4: 80 },
    5: { 2: 1, 3: 4.5, 4: 25, 5: 200 }, 6: { 3: 3.5, 4: 12, 5: 90, 6: 750 },
    7: { 3: 2.5, 4: 6.5, 5: 24, 6: 200, 7: 1500 }, 8: { 3: 1.5, 4: 4, 5: 15, 6: 70, 7: 600, 8: 3000 },
    9: { 4: 4, 5: 12, 6: 50, 7: 250, 8: 1500, 9: 8000 }, 10: { 0: 4, 4: 2, 5: 6, 6: 25, 7: 110, 8: 750, 9: 3500, 10: 20000 },
  };
  const el = {
    board: $('#knBoard'), balls: $('#knBalls'), pay: $('#knPay'), picks: $('#knPicks'), msg: $('#knMsg'),
    play: $('#knPlay'), quick: $('#knQuick'), clear: $('#knClear'), hits: $('#knHits'),
  };
  const stepper = BetStepper($('#knMinus'), $('#knBet'), $('#knPlus'), BETS, 2, () => { renderPay(); updateUI(); });
  let picks = new Set(), drawn = [], busy = false, lastHits = -1;

  function buildBoard() {
    el.board.innerHTML = '';
    for (let n = 1; n <= N; n++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kn-cell'; b.dataset.n = n; b.textContent = n;
      b.addEventListener('click', () => toggle(n));
      el.board.appendChild(b);
    }
  }
  const cell = n => el.board.children[n - 1];

  function toggle(n) {
    if (busy) return;
    Sfx.init();
    clearDraw();
    if (picks.has(n)) picks.delete(n);
    else { if (picks.size >= MAXPICK) { Sfx.error(); FX.shake(el.picks); return; } picks.add(n); }
    Sfx.click();
    render();
  }
  function clearDraw() {
    if (!drawn.length) return;
    drawn = []; lastHits = -1;
    $$('.kn-cell', el.board).forEach(c => c.classList.remove('drawn', 'hit'));
    el.balls.innerHTML = '';
  }
  function render() {
    $$('.kn-cell', el.board).forEach(c => c.classList.toggle('picked', picks.has(+c.dataset.n)));
    el.picks.textContent = `${picks.size} / ${MAXPICK}`;
    renderPay(); updateUI();
  }
  function renderPay() {
    const n = picks.size, b = stepper.value;
    if (!n) { el.pay.innerHTML = `<li class="empty">${I18N.t('Wähle 1 bis 10 Zahlen.')}</li>`; return; }
    const t = PAY[n];
    el.pay.innerHTML = Object.keys(t).map(Number).sort((a, c) => c - a).map(k =>
      `<li class="${k === lastHits ? 'hit' : ''}"><span>${I18N.t('{0} Richtige', k)}</span><b>${U.fmt(Math.floor(t[k] * b))}</b></li>`).join('');
  }
  function updateUI() {
    el.play.disabled = busy || !picks.size;
    el.quick.disabled = el.clear.disabled = busy;
    stepper.locked = busy;
    $('#knPlaySub').textContent = I18N.t('Einsatz {0}', U.fmt(stepper.value));
  }
  function setMsg(t) { el.msg.textContent = t; }

  function quickPick() {
    if (busy) return;
    Sfx.init(); Sfx.chip(); clearDraw();
    const n = picks.size || 5;
    picks = new Set();
    while (picks.size < n) picks.add(U.randInt(1, N));
    render();
  }

  async function play() {
    if (busy || !picks.size) return;
    Sfx.init();
    const b = stepper.value;
    if (!Store.bet(b)) { App.insufficient(b); return; }
    Store.hold('keno', b);
    Store.stat('kenoRounds');
    busy = true; clearDraw(); updateUI();
    setMsg(I18N.t('Die Kugeln rollen …'));
    const pool = Array.from({ length: N }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const res = pool.slice(0, DRAW);
    let hits = 0;
    for (const n of res) {
      await U.sleep(U.reducedMotion ? 60 : 280);
      drawn.push(n);
      const c = cell(n), hit = picks.has(n);
      c.classList.add('drawn'); if (hit) { c.classList.add('hit'); hits++; }
      const ball = document.createElement('span');
      ball.className = 'kn-ball' + (hit ? ' hit' : '');
      ball.textContent = n;
      el.balls.appendChild(ball);
      el.hits.textContent = hits;
      if (hit) { Sfx.gem(hits); const cc = FX.center(c); FX.stars(cc.x, cc.y, 6, '#fff2b0'); } else Sfx.bounce(0.6);
    }
    lastHits = hits;
    const mult = PAY[picks.size][hits] || 0, win = Math.floor(b * mult);
    Store.release('keno');
    renderPay();
    if (win > 0) {
      Store.win(win, win - b);
      const cc = FX.center(el.board);
      if (win > b) { FX.coins(cc.x, cc.y, Math.min(50, 10 + Math.round(mult * 2)), 1); Sfx.win(mult >= 20 ? 3 : 2); }
      else Sfx.push();
      setMsg(I18N.t('{0} Richtige! Du gewinnst {1} Münzen.', hits, U.fmt(win)));
      if (mult >= 20) Celebrate.bigWin(win, b);
    } else { Sfx.lose(); setMsg(I18N.t('{0} Richtige – leider kein Gewinn.', hits)); }
    Store.emit({ type: 'keno', hits, picks: picks.size, win, bet: b, mult });
    busy = false; updateUI();
  }

  buildBoard();
  el.play.addEventListener('click', play);
  el.quick.addEventListener('click', quickPick);
  el.clear.addEventListener('click', () => { if (busy) return; Sfx.click(); picks.clear(); clearDraw(); render(); });
  I18N.onChange(() => { renderPay(); updateUI(); });
  render();

  return {
    show() { render(); if (!picks.size && !drawn.length) setMsg(I18N.t('Wähle bis zu 10 Zahlen – 10 Kugeln werden gezogen.')); },
    hide() {},
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); play(); return true; }
      if (e.code === 'KeyR') { quickPick(); return true; }
      return false;
    },
  };
})();

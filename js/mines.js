'use strict';
/* ---------- Diamond Mines ---------- */
const Mines = (() => {
  const BETS = [10, 20, 50, 100, 250, 500, 1000];
  const SIZE = 25, EDGE = 0.97;
  const el = {
    grid: $('#minesGrid'), count: $('#minesCount'), countVal: $('#minesCountVal'),
    start: $('#minesStart'), startLabel: $('#minesStartLabel'), startSub: $('#minesStartSub'),
    random: $('#minesRandom'), mult: $('#minesMult'), next: $('#minesNext'), gems: $('#minesGems'), msg: $('#minesMsg'), board: $('#minesBoard'),
  };
  const stepper = BetStepper($('#mnBetMinus'), $('#mnBet'), $('#mnBetPlus'), BETS, 3, () => updateUI());
  let mines = 3, layout = [], revealed = [], playing = false, bet = 0, found = 0, over = false;

  const GEM_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8feff"/><stop offset=".5" stop-color="#3be8ff"/><stop offset="1" stop-color="#0a6aa0"/></linearGradient></defs>
    <path d="M18 10h28l12 14-26 32L6 24z" fill="url(#gA)"/><path d="M18 10l6 14h16l6-14M6 24h52M24 24l8 32 8-32" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/><path d="M24 24l8-14 8 14z" fill="rgba(255,255,255,.45)"/></svg>`;
  const BOMB_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="bA" cx=".35" cy=".35"><stop offset="0" stop-color="#7a7090"/><stop offset=".6" stop-color="#2a2238"/><stop offset="1" stop-color="#0a0810"/></radialGradient></defs>
    <circle cx="30" cy="36" r="20" fill="url(#bA)"/><rect x="36" y="10" width="10" height="10" rx="2" transform="rotate(35 41 15)" fill="#4a4258"/><path d="M44 12c4-6 10-4 12-8" stroke="#c9a060" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="57" cy="4" r="4" fill="#ffc94a"/><circle cx="22" cy="28" r="5" fill="rgba(255,255,255,.35)"/></svg>`;

  function multFor(k, m = mines) {
    let p = 1;
    for (let i = 0; i < k; i++) p *= (SIZE - i) / (SIZE - m - i);
    return EDGE * p;
  }
  const fmtM = m => (m >= 100 ? m.toFixed(0) : m.toFixed(2)).replace('.', U.dec()) + '×';

  function buildGrid() {
    el.grid.innerHTML = '';
    for (let i = 0; i < SIZE; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mine-tile'; b.dataset.i = i;
      b.setAttribute('aria-label', `Feld ${i + 1}`);
      b.innerHTML = '<span class="mt-inner"><span class="mt-front"></span><span class="mt-back"></span></span>';
      b.addEventListener('click', () => pick(i));
      el.grid.appendChild(b);
    }
  }
  const tile = i => el.grid.children[i];

  function start() {
    if (playing) { cashOut(); return; }
    Sfx.init();
    const b = stepper.value;
    if (!Store.bet(b)) { App.insufficient(b); return; }
    bet = b; found = 0; over = false; playing = true;
    Store.stat('minesRounds');
    const idx = Array.from({ length: SIZE }, (_, i) => i);
    for (let i = SIZE - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    layout = new Array(SIZE).fill(0); idx.slice(0, mines).forEach(i => { layout[i] = 1; });
    revealed = new Array(SIZE).fill(false);
    $$('.mine-tile', el.grid).forEach((t, i) => {
      t.className = 'mine-tile live'; t.disabled = false;
      t.querySelector('.mt-back').innerHTML = '';
      t.animate([{ transform: 'scale(.85)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: i * 12, easing: 'ease-out', fill: 'backwards' });
    });
    el.board.classList.remove('boom', 'won');
    Sfx.spinStart();
    setMsg('Finde Juwelen – aber meide die Bomben!');
    updateUI();
  }

  function pick(i) {
    if (!playing || revealed[i] || over) return;
    revealed[i] = true;
    const t = tile(i);
    if (layout[i]) { boom(i); return; }
    found++;
    t.querySelector('.mt-back').innerHTML = GEM_SVG;
    t.classList.add('open', 'gem');
    Sfx.gem ? Sfx.gem(found) : Sfx.coin(found);
    const c = FX.center(t);
    FX.stars(c.x, c.y, 8, '#aef6ff');
    const m = multFor(found);
    el.mult.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
    if (found === SIZE - mines) { cashOut(); return; }
    setMsg(`${found} ${found === 1 ? 'Juwel' : 'Juwelen'} – Gewinn jetzt ${U.fmt(Math.floor(bet * m))}.`);
    updateUI();
  }

  function boom(i) {
    over = true; playing = false;
    const t = tile(i);
    t.querySelector('.mt-back').innerHTML = BOMB_SVG;
    t.classList.add('open', 'bomb', 'hit');
    Sfx.explode ? Sfx.explode() : Sfx.lose();
    const c = FX.center(t);
    FX.sparks(c.x, c.y, 30, '#ff6a3d', 320);
    FX.shake(el.board, true);
    el.board.classList.add('boom');
    setTimeout(() => revealAll(), 350);
    setMsg(`Bumm! Nach ${found} ${found === 1 ? 'Juwel' : 'Juwelen'} erwischt. Einsatz verloren.`);
    Store.emit({ type: 'mines', win: 0, gems: found, mines, bet });
    updateUI();
  }

  function cashOut() {
    if (!playing || !found) return;
    playing = false; over = true;
    const m = multFor(found), win = Math.floor(bet * m);
    Store.win(win);
    Sfx.win(m >= 5 ? 3 : 2);
    const c = FX.center(el.board);
    FX.coins(c.x, c.y, Math.min(50, 12 + Math.round(m * 3)), 1.1);
    if (m >= 10) FX.confetti(80);
    el.board.classList.add('won');
    setMsg(`Ausgezahlt: ${U.fmt(win)} Münzen (${fmtM(m)})`);
    Store.emit({ type: 'mines', win, gems: found, mines, bet, mult: m });
    if (win >= bet * 15) Celebrate.bigWin(win, bet);
    revealAll();
    updateUI();
  }

  function revealAll() {
    layout.forEach((v, i) => {
      if (revealed[i]) return;
      const t = tile(i);
      t.querySelector('.mt-back').innerHTML = v ? BOMB_SVG : GEM_SVG;
      t.classList.add('open', v ? 'bomb' : 'gem', 'ghost');
    });
    $$('.mine-tile', el.grid).forEach(t => { t.disabled = true; });
  }

  function randomPick() {
    if (!playing) return;
    const free = revealed.map((r, i) => r ? -1 : i).filter(i => i >= 0);
    if (free.length) pick(U.pick(free));
  }

  function setMsg(t) { el.msg.textContent = t; }

  function updateUI() {
    el.countVal.textContent = mines;
    el.count.disabled = playing;
    stepper.locked = playing;
    el.random.disabled = !playing;
    el.gems.textContent = `${found} / ${SIZE - mines}`;
    const cur = found ? multFor(found) : 1, nxt = multFor(found + 1);
    el.mult.textContent = fmtM(playing || over ? cur : 1);
    el.next.textContent = found < SIZE - mines ? fmtM(nxt) : '–';
    const s = el.start;
    s.classList.toggle('cash', playing && found > 0);
    if (playing) {
      s.disabled = found === 0;
      el.startLabel.textContent = 'Auszahlen';
      el.startSub.textContent = found ? U.fmt(Math.floor(bet * cur)) + ' Münzen' : 'erst ein Feld aufdecken';
    } else {
      s.disabled = false;
      el.startLabel.textContent = over ? 'Neues Spiel' : 'Spiel starten';
      el.startSub.textContent = 'Einsatz ' + U.fmt(stepper.value);
    }
  }

  el.count.addEventListener('input', () => { mines = +el.count.value; updateUI(); });
  el.start.addEventListener('click', start);
  el.random.addEventListener('click', randomPick);
  $$('[data-mines]').forEach(b => b.addEventListener('click', () => { if (playing) return; Sfx.click(); el.count.value = b.dataset.mines; mines = +b.dataset.mines; updateUI(); }));
  buildGrid();
  updateUI();

  return {
    show() { updateUI(); },
    hide() {},
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); el.start.click(); return true; }
      if (e.code === 'KeyR') { randomPick(); return true; }
      return false;
    },
  };
})();

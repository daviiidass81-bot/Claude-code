'use strict';
/* ---------- Video-Poker: Jacks or Better (9/6) ---------- */
const VideoPoker = (() => {
  const COINS = [10, 25, 50, 100, 250];
  const HANDS = [
    { id: 'royal', name: 'Royal Flush', pay: [250, 500, 750, 1000, 4000] },
    { id: 'sflush', name: 'Straight Flush', pay: [50, 100, 150, 200, 250] },
    { id: 'four', name: 'Vierling', pay: [25, 50, 75, 100, 125] },
    { id: 'full', name: 'Full House', pay: [9, 18, 27, 36, 45] },
    { id: 'flush', name: 'Flush', pay: [6, 12, 18, 24, 30] },
    { id: 'straight', name: 'Straße', pay: [4, 8, 12, 16, 20] },
    { id: 'three', name: 'Drilling', pay: [3, 6, 9, 12, 15] },
    { id: 'two', name: 'Zwei Paare', pay: [2, 4, 6, 8, 10] },
    { id: 'jacks', name: 'Buben oder besser', pay: [1, 2, 3, 4, 5] },
  ];
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RV = r => RANKS.indexOf(r) + 2;

  const el = {
    pay: $('#vpPay'), cards: $('#vpCards'), msg: $('#vpMsg'), btn: $('#vpDeal'), btnLabel: $('#vpDealLabel'),
    coins: $('#vpCoins'), win: $('#vpWin'), machine: $('#vpMachine'),
  };
  const coinStep = BetStepper($('#vpCoinMinus'), $('#vpCoin'), $('#vpCoinPlus'), COINS, 1, () => { renderPay(); updateUI(); });
  let coins = 5, state = 'idle', hand = [], held = [false, false, false, false, false], deck = [], bet = 0, busy = false;

  function renderPay(hitId = null) {
    el.pay.innerHTML = `<tbody>${HANDS.map(h => `<tr class="${hitId === h.id ? 'hit' : ''}"><th>${I18N.t(h.name)}</th>${h.pay.map((p, i) =>
      `<td class="${i === coins - 1 ? 'on' : ''}">${U.fmt(p * coinStep.value)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $$('.vp-coin-btn', el.coins).forEach(b => b.classList.toggle('on', +b.dataset.c === coins));
  }

  function newDeck() {
    deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  }

  function evaluate(cards) {
    const v = cards.map(c => RV(c.r)).sort((a, b) => a - b);
    const flush = cards.every(c => c.s === cards[0].s);
    const uniq = [...new Set(v)];
    let straight = uniq.length === 5 && (v[4] - v[0] === 4 || v.join() === '2,3,4,5,14');
    const counts = {}; v.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    const c = Object.values(counts).sort((a, b) => b - a);
    if (straight && flush) return v[0] === 10 ? 'royal' : 'sflush';
    if (c[0] === 4) return 'four';
    if (c[0] === 3 && c[1] === 2) return 'full';
    if (flush) return 'flush';
    if (straight) return 'straight';
    if (c[0] === 3) return 'three';
    if (c[0] === 2 && c[1] === 2) return 'two';
    if (c[0] === 2) { const pr = +Object.keys(counts).find(k => counts[k] === 2); if (pr >= 11) return 'jacks'; }
    return null;
  }

  function slot(i) { return el.cards.children[i]; }
  function buildSlots() {
    el.cards.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'vp-slot'; d.dataset.i = i;
      d.setAttribute('aria-label', I18N.t('Karte {0} halten', i + 1));
      d.innerHTML = `<div class="vp-card-wrap"></div><span class="vp-hold">HALTEN</span>`;
      d.addEventListener('click', () => toggleHold(i));
      el.cards.appendChild(d);
      // Startbild: verdeckte Karte
      const back = Blackjack.makeCard({ r: 'A', s: '♠' });
      d.querySelector('.vp-card-wrap').appendChild(back);
    }
  }

  async function showCard(i, c, delay) {
    const wrap = slot(i).querySelector('.vp-card-wrap');
    const old = wrap.firstChild;
    if (old && old.classList.contains('up')) { old.classList.remove('up'); await U.sleep(200); }
    const n = Blackjack.makeCard(c);
    wrap.innerHTML = ''; wrap.appendChild(n);
    await U.sleep(delay);
    Sfx.flip();
    n.classList.add('up');
  }

  function toggleHold(i) {
    if (state !== 'hold' || busy) return;
    held[i] = !held[i];
    Sfx.click();
    slot(i).classList.toggle('held', held[i]);
  }

  async function deal() {
    if (busy) return;
    Sfx.init();
    if (state === 'hold') { await draw(); return; }
    bet = coins * coinStep.value;
    if (!Store.bet(bet)) { App.insufficient(bet); return; }
    Store.hold('poker', bet);
    Store.stat('pokerHands');
    busy = true; state = 'dealing'; updateUI();
    newDeck();
    hand = deck.splice(0, 5); held = [false, false, false, false, false];
    $$('.vp-slot', el.cards).forEach(s => s.classList.remove('held', 'win'));
    el.win.textContent = '—'; el.machine.classList.remove('won');
    Sfx.card();
    await Promise.all(hand.map((c, i) => showCard(i, c, 90 * i)));
    await U.sleep(250);
    const pre = evaluate(hand);
    renderPay(pre);
    setMsg(pre ? I18N.t('Schon auf der Hand: {0}', I18N.t(HANDS.find(h => h.id === pre).name)) : I18N.t('Wähle die Karten zum Halten und ziehe neu.'));
    state = 'hold'; busy = false; updateUI();
  }

  async function draw() {
    busy = true; state = 'drawing'; updateUI();
    const jobs = [];
    let k = 0;
    for (let i = 0; i < 5; i++) if (!held[i]) { hand[i] = deck.shift(); jobs.push(showCard(i, hand[i], 110 * k++)); }
    if (jobs.length) Sfx.card();
    await Promise.all(jobs);
    await U.sleep(300);
    const res = evaluate(hand);
    Store.release('poker');
    const H = HANDS.find(h => h.id === res);
    renderPay(res);
    if (H) {
      const win = H.pay[coins - 1] * coinStep.value;
      Store.win(win, win - bet);
      el.win.textContent = U.fmt(win);
      el.machine.classList.add('won');
      markWinningCards(res);
      const c = FX.center(el.cards);
      FX.coins(c.x, c.y, Math.min(50, 8 + Math.round(win / bet * 2)), 1);
      Sfx.win(win >= bet * 25 ? 3 : win > bet ? 2 : 1);
      setMsg(I18N.t('{0}! Du gewinnst {1} Münzen.', I18N.t(H.name), U.fmt(win)));
      if (win >= bet * 25) Celebrate.bigWin(win, bet);
    } else {
      Sfx.lose();
      setMsg(I18N.t('Kein Gewinn – neues Blatt?'));
    }
    Store.emit({ type: 'poker', hand: res, win: H ? H.pay[coins - 1] * coinStep.value : 0, bet });
    state = 'idle'; busy = false; updateUI();
  }

  function markWinningCards(res) {
    const v = hand.map(c => RV(c.r));
    const counts = {}; v.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    const all = ['royal', 'sflush', 'flush', 'straight', 'full'].includes(res);
    hand.forEach((c, i) => { if (all || counts[v[i]] >= 2) slot(i).classList.add('win'); });
  }

  function setMsg(t) { el.msg.textContent = t; }
  function updateUI() {
    const b = el.btn;
    b.disabled = busy;
    el.btnLabel.textContent = state === 'hold' ? 'Ziehen' : 'Geben';
    $('#vpDealSub').textContent = state === 'hold' ? I18N.t('gehaltene Karten bleiben') : I18N.t('Einsatz {0}', U.fmt(coins * coinStep.value));
    coinStep.locked = state !== 'idle';
    $$('.vp-coin-btn', el.coins).forEach(x => { x.disabled = state !== 'idle'; });
    el.cards.classList.toggle('can-hold', state === 'hold');
  }

  el.coins.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" class="vp-coin-btn" data-c="${n}">${n}</button>`).join('');
  $$('.vp-coin-btn', el.coins).forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.chip(); coins = +b.dataset.c; renderPay(); updateUI(); }));
  el.btn.addEventListener('click', deal);
  I18N.onChange(() => { renderPay(); updateUI(); });
  buildSlots(); renderPay(); updateUI();

  return {
    show() { renderPay(); updateUI(); if (state === 'idle' && !hand.length) setMsg(I18N.t('Wähle den Einsatz und drück „Geben“.')); },
    hide() {},
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); deal(); return true; }
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
      if (n != null) { toggleHold(n); return true; }
      return false;
    },
  };
})();

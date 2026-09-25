'use strict';
/* ---------- Baccarat (Punto Banco) ---------- */
const Baccarat = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const PAY = { player: 2, banker: 1.95, tie: 9 };
  const MAX = 5000;
  const el = {
    pCards: $('#bcPlayerCards'), bCards: $('#bcBankerCards'), pVal: $('#bcPlayerVal'), bVal: $('#bcBankerVal'),
    msg: $('#bcMsg'), total: $('#bcTotal'), chips: $('#bcChips'), deal: $('#bcDeal'), clear: $('#bcClear'), rebet: $('#bcRebet'),
    road: $('#bcRoad'), table: $('#bcTable'), shoe: $('#bcShoe'),
  };
  const rack = Chips.rack(el.chips, null, 1);
  let shoe = [], bets = {}, lastBets = null, busy = false, road = [];

  const val = c => ('JQK'.includes(c.r) || c.r === '10') ? 0 : c.r === 'A' ? 1 : +c.r;
  const total = cs => cs.reduce((s, c) => s + val(c), 0) % 10;
  function buildShoe() {
    shoe = [];
    for (let d = 0; d < 8; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
    for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
  }
  const drawCard = () => { if (shoe.length < 12) buildShoe(); return shoe.pop(); };
  const spot = k => $(`[data-bspot="${k}"]`);
  const betSum = () => Object.values(bets).reduce((s, v) => s + v, 0);

  function place(k) {
    if (busy) return;
    Sfx.init();
    const v = rack.value, t = betSum();
    if (t + v > Math.min(MAX, Store.s.balance)) { Sfx.error(); setMsg(t + v > MAX ? I18N.t('Tischlimit {0}.', U.fmt(MAX)) : I18N.t('Nicht genug Münzen.')); FX.shake(spot(k)); return; }
    $$('.bc-spot').forEach(s => s.classList.remove('won', 'lost'));
    bets[k] = (bets[k] || 0) + v;
    Sfx.chip(); Chips.fly($('.chip-btn.on', el.chips), spot(k), v);
    render();
  }
  function render() {
    for (const k of ['player', 'tie', 'banker']) {
      const s = spot(k).querySelector('.bc-bet'); s.innerHTML = '';
      if (bets[k]) s.appendChild(Chips.marker(bets[k]));
    }
    const t = betSum();
    el.total.textContent = U.fmt(t);
    el.deal.disabled = busy || !t; el.clear.disabled = busy || !t;
    el.rebet.disabled = busy || !lastBets || !!t;
  }
  function setMsg(t) { el.msg.textContent = t; el.msg.classList.remove('pop'); void el.msg.offsetWidth; el.msg.classList.add('pop'); }

  async function deal1(container, cards, c) {
    cards.push(c);
    const n = Blackjack.makeCard(c);
    container.appendChild(n);
    const sr = el.shoe.getBoundingClientRect(), cr = n.getBoundingClientRect();
    n.animate([{ transform: `translate(${sr.left - cr.left}px, ${sr.top - cr.top}px) rotate(-20deg) scale(.8)` }, { transform: 'none' }], { duration: U.reducedMotion ? 1 : 360, easing: 'cubic-bezier(.25,.8,.3,1)' });
    Sfx.card();
    await U.sleep(320);
    n.classList.add('up'); Sfx.flip();
    await U.sleep(260);
  }
  function showVal(elV, cs) { elV.textContent = total(cs); elV.hidden = false; elV.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 250 }); }

  async function play() {
    if (busy) return;
    Sfx.init();
    const t = betSum();
    if (!t) { Sfx.error(); setMsg(I18N.t('Setze auf Spieler, Bank oder Unentschieden.')); return; }
    if (!Store.bet(t)) { App.insufficient(t); return; }
    Store.hold('baccarat', t);
    Store.stat('baccRounds');
    busy = true; lastBets = { ...bets }; render();
    el.pCards.innerHTML = ''; el.bCards.innerHTML = ''; el.pVal.hidden = el.bVal.hidden = true;
    el.table.classList.remove('p-win', 'b-win', 't-win');
    $$('.bc-spot').forEach(s => s.classList.remove('won', 'lost'));
    const P = [], B = [];
    setMsg(I18N.t('Karten werden ausgeteilt …'));
    await deal1(el.pCards, P, drawCard()); await deal1(el.bCards, B, drawCard());
    await deal1(el.pCards, P, drawCard()); showVal(el.pVal, P);
    await deal1(el.bCards, B, drawCard()); showVal(el.bVal, B);
    let pt = total(P), bt = total(B);
    if (pt < 8 && bt < 8) {
      let p3 = null;
      if (pt <= 5) { await U.sleep(250); setMsg(I18N.t('Spieler zieht eine dritte Karte')); await deal1(el.pCards, P, drawCard()); p3 = val(P[2]); pt = total(P); showVal(el.pVal, P); }
      let bankerDraws;
      if (p3 === null) bankerDraws = bt <= 5;
      else bankerDraws = bt <= 2 || (bt === 3 && p3 !== 8) || (bt === 4 && p3 >= 2 && p3 <= 7) || (bt === 5 && p3 >= 4 && p3 <= 7) || (bt === 6 && (p3 === 6 || p3 === 7));
      if (bankerDraws) { await U.sleep(250); setMsg(I18N.t('Bank zieht eine dritte Karte')); await deal1(el.bCards, B, drawCard()); bt = total(B); showVal(el.bVal, B); }
    }
    await U.sleep(350);
    const res = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie';
    let ret = 0;
    for (const [k, v] of Object.entries(bets)) {
      if (k === res) ret += Math.floor(v * PAY[k]);
      else if (res === 'tie' && k !== 'tie') ret += v; // bei Unentschieden: Spieler-/Bankwetten zurück
    }
    Store.release('baccarat');
    for (const k of Object.keys(bets)) spot(k).classList.add(k === res ? 'won' : res === 'tie' && k !== 'tie' ? '' : 'lost');
    el.table.classList.add(res === 'player' ? 'p-win' : res === 'banker' ? 'b-win' : 't-win');
    const label = res === 'player' ? I18N.t('Spieler gewinnt') : res === 'banker' ? I18N.t('Bank gewinnt') : I18N.t('Unentschieden');
    const net = ret - t;
    if (ret > 0) Store.win(ret, net);
    if (net > 0) {
      const c = FX.center(spot(res));
      FX.coins(c.x, c.y, Math.min(45, 10 + Math.round(ret / t * 4)), 1);
      Sfx.win(res === 'tie' ? 3 : 2);
      setMsg(I18N.t('{0} ({1}:{2}) – du gewinnst {3} Münzen!', label, pt, bt, U.fmt(ret)));
    } else if (ret > 0) { Sfx.push(); setMsg(I18N.t('{0} ({1}:{2}) – Einsatz zurück.', label, pt, bt)); }
    else { Sfx.lose(); setMsg(I18N.t('{0} ({1}:{2}).', label, pt, bt)); }
    road.push(res[0]); if (road.length > 48) road.shift();
    renderRoad();
    Store.emit({ type: 'baccarat', res, win: ret, bet: t, tieWin: res === 'tie' && !!bets.tie, net });
    await U.sleep(700);
    bets = {}; busy = false; render();
  }
  function renderRoad() {
    el.road.innerHTML = road.map(r => `<i class="${r}">${r === 'p' ? 'S' : r === 'b' ? 'B' : 'U'}</i>`).join('');
  }

  $$('.bc-spot').forEach(s => {
    s.addEventListener('click', () => place(s.dataset.bspot));
    s.addEventListener('contextmenu', e => { e.preventDefault(); if (!busy) { delete bets[s.dataset.bspot]; render(); } });
  });
  el.deal.addEventListener('click', play);
  el.clear.addEventListener('click', () => { Sfx.click(); bets = {}; render(); });
  el.rebet.addEventListener('click', () => {
    const t = Object.values(lastBets || {}).reduce((s, v) => s + v, 0);
    if (!t || t > Store.s.balance) { Sfx.error(); return; }
    Sfx.chip(); bets = { ...lastBets }; render();
  });
  I18N.onChange(render);
  buildShoe(); render();

  return {
    show() { render(); if (!road.length) setMsg(I18N.t('Setze auf Spieler, Bank oder Unentschieden.')); },
    hide() {},
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); play(); return true; }
      if (e.code === 'KeyR') { el.rebet.click(); return true; }
      return false;
    },
  };
})();

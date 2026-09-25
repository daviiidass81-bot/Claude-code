'use strict';
/* ---------- Hi-Lo: höher oder niedriger ---------- */
const HiLo = (() => {
  const BETS = [10, 20, 50, 100, 250, 500];
  const EDGE = 0.98;
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RV = r => RANKS.indexOf(r) + 2; // 2 … 14 (Ass hoch)
  const el = {
    card: $('#hlCard'), trail: $('#hlTrail'), hi: $('#hlHi'), lo: $('#hlLo'), skip: $('#hlSkip'), cash: $('#hlCash'),
    start: $('#hlStart'), mult: $('#hlMult'), streak: $('#hlStreak'), msg: $('#hlMsg'), table: $('#hlTable'),
  };
  const stepper = BetStepper($('#hlMinus'), $('#hlBet'), $('#hlPlus'), BETS, 2, () => updateUI());
  let cur = null, playing = false, busy = false, bet = 0, mult = 1, streak = 0, skips = 0;

  const draw = () => ({ r: U.pick(RANKS), s: U.pick(SUITS) });
  const pHi = c => (15 - RV(c.r)) / 13;   // gleich oder höher
  const pLo = c => (RV(c.r) - 1) / 13;    // gleich oder niedriger
  const stepMult = p => p >= 1 ? 1 : Math.floor(EDGE / p * 100) / 100;
  const fmtM = m => m.toFixed(2).replace('.', U.dec()) + '×';

  async function place(c) {
    const n = Blackjack.makeCard(c);
    el.card.innerHTML = ''; el.card.appendChild(n);
    n.animate([{ transform: 'translateY(-40px) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
    Sfx.card();
    await U.sleep(220);
    n.classList.add('up'); Sfx.flip();
    await U.sleep(250);
  }
  function addTrail(c, ok) {
    const n = Blackjack.makeCard(c); n.classList.add('up', 'mini');
    const w = document.createElement('div'); w.className = 'hl-trail-item ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
    w.appendChild(n); el.trail.prepend(w);
    while (el.trail.children.length > 12) el.trail.lastChild.remove();
  }

  async function start() {
    if (busy) return;
    if (playing) { cashOut(); return; }
    Sfx.init();
    const b = stepper.value;
    if (!Store.bet(b)) { App.insufficient(b); return; }
    Store.hold('hilo', b);
    bet = b; mult = 1; streak = 0; skips = 3; playing = true; busy = true;
    el.trail.innerHTML = ''; el.table.classList.remove('lost', 'won'); el.card.classList.remove('flash-bad'); el.mult.parentElement.classList.remove('lost');
    updateUI();
    cur = draw();
    await place(cur);
    busy = false;
    setMsg(I18N.t('Kommt die nächste Karte höher oder niedriger?'));
    updateUI();
  }

  async function guess(up) {
    if (!playing || busy) return;
    const p = up ? pHi(cur) : pLo(cur);
    if (p >= 1) return;
    busy = true; updateUI();
    const prev = cur, next = draw();
    const ok = up ? RV(next.r) >= RV(prev.r) : RV(next.r) <= RV(prev.r);
    addTrail(prev, ok);
    await place(next);
    cur = next;
    if (ok) {
      mult = Math.round(mult * stepMult(p) * 100) / 100;
      streak++;
      Sfx.gem(streak);
      el.mult.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 280 });
      setMsg(I18N.t('Richtig! Gewinn jetzt {0} Münzen.', U.fmt(Math.floor(bet * mult))));
      Store.settle('hilo', bet * mult);
      Store.emit({ type: 'hiloStep', streak });
    } else {
      playing = false;
      Store.release('hilo');
      Sfx.lose(); FX.shake(el.table); el.table.classList.add('lost');
      el.card.classList.remove('flash-bad'); void el.card.offsetWidth; el.card.classList.add('flash-bad');
      el.mult.parentElement.classList.add('lost');
      setMsg(streak ? I18N.t('Daneben! Serie von {0} bei {1} gerissen – Einsatz verloren.', streak, fmtM(mult)) : I18N.t('Daneben! Gleich die erste Karte – Einsatz verloren.'));
      Store.emit({ type: 'hilo', win: 0, bet, streak });
    }
    busy = false; updateUI();
  }

  async function skip() {
    if (!playing || busy || skips <= 0) return;
    busy = true; skips--; updateUI();
    addTrail(cur, null);
    cur = draw();
    await place(cur);
    busy = false; updateUI();
  }

  function cashOut() {
    if (!playing || busy || streak === 0) return;
    playing = false;
    Store.release('hilo');
    const win = Math.floor(bet * mult);
    Store.win(win, win - bet);
    el.table.classList.add('won');
    const c = FX.center(el.card);
    FX.coins(c.x, c.y, Math.min(45, 10 + streak * 4), 1);
    Sfx.win(mult >= 5 ? 3 : 2);
    setMsg(I18N.t('Ausgezahlt: {0} Münzen ({1})', U.fmt(win), fmtM(mult)));
    Store.emit({ type: 'hilo', win, bet, streak, mult });
    if (win >= bet * 15) Celebrate.bigWin(win, bet);
    updateUI();
  }

  function setMsg(t) { el.msg.textContent = t; }
  function updateUI() {
    stepper.locked = playing;
    el.mult.textContent = fmtM(mult);
    el.streak.textContent = streak;
    const on = playing && !busy && cur;
    const ph = cur ? pHi(cur) : 0, pl = cur ? pLo(cur) : 0;
    el.hi.disabled = !on || ph >= 1; el.lo.disabled = !on || pl >= 1;
    $('#hlHiSub').textContent = cur && playing ? `${fmtM(stepMult(ph))} · ${Math.round(ph * 100)} %` : '–';
    $('#hlLoSub').textContent = cur && playing ? `${fmtM(stepMult(pl))} · ${Math.round(pl * 100)} %` : '–';
    el.skip.disabled = !on || skips <= 0;
    $('#hlSkipSub').textContent = I18N.t('{0} übrig', playing ? skips : 3);
    el.start.disabled = busy || (playing && streak === 0);
    el.start.classList.toggle('cash', playing && streak > 0);
    $('#hlStartLabel').textContent = playing ? 'Auszahlen' : 'Spiel starten';
    $('#hlStartSub').textContent = playing ? (streak ? I18N.t('{0} Münzen', U.fmt(Math.floor(bet * mult))) : I18N.t('erst einmal richtig raten')) : I18N.t('Einsatz {0}', U.fmt(stepper.value));
  }

  el.start.addEventListener('click', start);
  el.hi.addEventListener('click', () => guess(true));
  el.lo.addEventListener('click', () => guess(false));
  el.skip.addEventListener('click', skip);
  I18N.onChange(updateUI);
  updateUI();

  return {
    show() { updateUI(); if (!cur) setMsg(I18N.t('Starte eine Runde und rate die nächste Karte.')); },
    hide() {},
    key(e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); guess(true); return true; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); guess(false); return true; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); start(); return true; }
      if (e.code === 'KeyX') { skip(); return true; }
      return false;
    },
  };
})();

'use strict';
/* ---------- Würfel-Duell (2 Würfel) ---------- */
const Dice = (() => {
  const FIELDS = {
    under: { label: 'Unter 7', pay: 2.3, test: (a, b) => a + b < 7 },
    seven: { label: 'Genau 7', pay: 5.8, test: (a, b) => a + b === 7 },
    over: { label: 'Über 7', pay: 2.3, test: (a, b) => a + b > 7 },
    pair: { label: 'Pasch', pay: 5.8, test: (a, b) => a === b },
  };
  const MAX = 5000;
  const el = {
    tray: $('#diceTray'), d1: $('#die1'), d2: $('#die2'), sum: $('#diceSum'), chips: $('#dcChips'),
    roll: $('#diceRoll'), clear: $('#diceClear'), rebet: $('#diceRebet'), total: $('#diceTotal'), msg: $('#diceMsg'), hist: $('#diceHist'),
  };
  let bets = {}, lastBets = null, rolling = false, history = [];
  const rack = Chips.rack(el.chips, null, 1);

  // Würfelflächen mit Augen
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  function buildDie(d) {
    const faces = { 'df-front': 1, 'df-back': 6, 'df-right': 3, 'df-left': 4, 'df-top': 2, 'df-bottom': 5 };
    d.innerHTML = `<div class="cube">${Object.entries(faces).map(([f, n]) =>
      `<div class="face ${f}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i + 1) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  }
  buildDie(el.d1); buildDie(el.d2);
  const setTrayLabel = () => { el.tray.dataset.label = I18N.t('WÜRFEL-DUELL'); };
  setTrayLabel(); I18N.onChange(setTrayLabel);
  let rot1 = [ -20, 25 ], rot2 = [ -25, -20 ];
  function setCube(d, rx, ry) { d.querySelector('.cube').style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; }
  setCube(el.d1, ...rot1); setCube(el.d2, ...rot2);

  function fieldEl(k) { return $(`[data-dfield="${k}"]`); }
  const total = () => Object.values(bets).reduce((s, v) => s + v, 0);

  function place(k) {
    if (rolling) return;
    Sfx.init();
    const v = rack.value, t = total();
    if (t + v > Math.min(MAX, Store.s.balance)) { Sfx.error(); setMsg(t + v > MAX ? `Tischlimit ${U.fmt(MAX)}.` : 'Nicht genug Münzen.'); FX.shake(fieldEl(k)); return; }
    $$('.dice-field').forEach(f => f.classList.remove('won', 'lost'));
    bets[k] = (bets[k] || 0) + v;
    Sfx.chip(); Chips.fly($('.chip-btn.on', el.chips), fieldEl(k), v);
    render();
  }
  function render() {
    for (const k of Object.keys(FIELDS)) {
      const f = fieldEl(k), slot = f.querySelector('.df-bet');
      slot.innerHTML = '';
      if (bets[k]) slot.appendChild(Chips.marker(bets[k]));
    }
    const t = total();
    el.total.textContent = U.fmt(t);
    el.roll.disabled = rolling || !t;
    el.clear.disabled = rolling || !t;
    el.rebet.disabled = rolling || !lastBets || !!t;
  }
  function setMsg(t) { el.msg.textContent = t; }

  function animateDie(d, val, from, delay, lane) {
    const [fx, fy] = FACE_ROT[val];
    const spinsX = 360 * U.randInt(2, 3), spinsY = 360 * U.randInt(2, 3);
    const to = [fx - 14 + spinsX * Math.sign(Math.random() - 0.3), fy + 18 + spinsY]; // leichte Schräglage bleibt sichtbar
    const cube = d.querySelector('.cube');
    const kf = [
      { transform: `rotateX(${from[0]}deg) rotateY(${from[1]}deg)` },
      { transform: `rotateX(${to[0]}deg) rotateY(${to[1]}deg)` },
    ];
    cube.animate(kf, { duration: 1300, delay, easing: 'cubic-bezier(.15,.6,.25,1)', fill: 'forwards' });
    const trayW = el.tray.clientWidth;
    d.animate([
      { transform: `translate(${-trayW * 0.45}px, ${lane - 40}px) scale(1.3)` },
      { transform: `translate(${-trayW * 0.2}px, ${lane + 10}px) scale(1.05)`, offset: 0.3 },
      { transform: `translate(${-trayW * 0.05}px, ${lane - 14}px) scale(1.12)`, offset: 0.5 },
      { transform: `translate(0px, ${lane}px) scale(1)`, offset: 0.72 },
      { transform: `translate(0px, ${lane - 5}px) scale(1.03)`, offset: 0.85 },
      { transform: `translate(0px, 0px) scale(1)` },
    ], { duration: 1300, delay, easing: 'ease-out', fill: 'none' });
    return to;
  }

  async function roll() {
    if (rolling) return;
    Sfx.init();
    const t = total();
    if (!t) { setMsg('Setze Chips auf ein Feld.'); Sfx.error(); return; }
    if (!Store.bet(t)) { App.insufficient(t); return; }
    Store.hold('dice', t);
    rolling = true; lastBets = { ...bets }; render();
    Store.stat('rolls');
    $$('.dice-field').forEach(f => f.classList.remove('won', 'lost'));
    el.sum.classList.remove('show');
    const a = U.randInt(1, 6), b = U.randInt(1, 6);
    Sfx.diceShake ? Sfx.diceShake() : Sfx.card();
    rot1 = animateDie(el.d1, a, rot1, 0, 0);
    rot2 = animateDie(el.d2, b, rot2, 90, 0);
    setTimeout(() => Sfx.diceLand && Sfx.diceLand(), 700);
    setTimeout(() => Sfx.diceLand && Sfx.diceLand(), 950);
    await U.sleep(1450);
    // Endstellung ohne Drehungsüberschuss speichern
    rot1 = [rot1[0] % 360, rot1[1] % 360]; rot2 = [rot2[0] % 360, rot2[1] % 360];
    setCube(el.d1, ...rot1); setCube(el.d2, ...rot2);
    $$('.cube').forEach(c => c.getAnimations().forEach(an => an.cancel()));
    const sum = a + b;
    el.sum.innerHTML = `<b>${sum}</b><span>${a} + ${b}${a === b ? ' · Pasch!' : ''}</span>`;
    el.sum.classList.add('show');
    let ret = 0;
    for (const [k, v] of Object.entries(bets)) {
      const f = fieldEl(k);
      if (FIELDS[k].test(a, b)) { ret += Math.floor(v * FIELDS[k].pay); f.classList.add('won'); } else f.classList.add('lost');
    }
    for (const k of Object.keys(FIELDS)) if (!bets[k] && FIELDS[k].test(a, b)) fieldEl(k).classList.add('hint');
    history.unshift(sum); history.length = Math.min(history.length, 16);
    el.hist.innerHTML = history.map((s, i) => `<span class="${s === 7 ? 'seven' : s < 7 ? 'under' : 'over'}${i ? '' : ' last'}">${s}</span>`).join('');
    Store.release('dice');
    if (ret > 0) Store.win(ret, ret - t);
    if (ret > t) {
      const c = FX.center(el.tray);
      FX.coins(c.x, c.y, Math.min(40, 10 + Math.round(ret / t * 4)), 1);
      Sfx.win(ret >= t * 4 ? 3 : 2);
      setMsg(I18N.t('{0}! Du gewinnst {1} Münzen.', sum, U.fmt(ret)));
    } else if (ret > 0) {
      Sfx.push();
      setMsg(I18N.t('{0}! Zurück: {1} von {2} Münzen.', sum, U.fmt(ret), U.fmt(t)));
    } else { Sfx.lose(); setMsg(`${sum} – diesmal nicht.`); }
    Store.emit({ type: 'dice', sum, pair: a === b, pairWin: !!bets.pair && a === b, win: ret, bet: t });
    await U.sleep(900);
    $$('.dice-field.hint').forEach(f => f.classList.remove('hint'));
    bets = {}; rolling = false; render();
  }

  $$('.dice-field').forEach(f => {
    f.addEventListener('click', () => place(f.dataset.dfield));
    f.addEventListener('contextmenu', e => { e.preventDefault(); if (!rolling) { delete bets[f.dataset.dfield]; render(); } });
  });
  el.roll.addEventListener('click', roll);
  el.clear.addEventListener('click', () => { Sfx.click(); bets = {}; render(); });
  el.rebet.addEventListener('click', () => {
    const t = Object.values(lastBets || {}).reduce((s, v) => s + v, 0);
    if (!t || t > Store.s.balance) { Sfx.error(); return; }
    Sfx.chip(); bets = { ...lastBets }; render();
  });
  render();

  return {
    show() { render(); },
    hide() {},
    key(e) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); roll(); return true; }
      if (e.code === 'KeyR') { el.rebet.click(); return true; }
      return false;
    },
  };
})();

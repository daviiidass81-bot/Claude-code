'use strict';
/* ---------- Blackjack ---------- */
const Blackjack = (() => {
  const B = CFG.blackjack;
  const VS = '︎'; // Text-Darstellung erzwingen (keine Emoji-Herzen)
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const COURT = { J: '♞', Q: '♛', K: '♚' };
  // Klassische Pip-Positionen (x %, y %)
  const L = 27, C = 50, R = 73;
  const PIPS = {
    2: [[C, 16], [C, 84]],
    3: [[C, 16], [C, 50], [C, 84]],
    4: [[L, 16], [R, 16], [L, 84], [R, 84]],
    5: [[L, 16], [R, 16], [C, 50], [L, 84], [R, 84]],
    6: [[L, 16], [R, 16], [L, 50], [R, 50], [L, 84], [R, 84]],
    7: [[L, 16], [R, 16], [C, 33], [L, 50], [R, 50], [L, 84], [R, 84]],
    8: [[L, 16], [R, 16], [C, 33], [L, 50], [R, 50], [C, 67], [L, 84], [R, 84]],
    9: [[L, 16], [R, 16], [L, 39], [R, 39], [C, 50], [L, 61], [R, 61], [L, 84], [R, 84]],
    10: [[L, 16], [R, 16], [C, 28], [L, 39], [R, 39], [L, 61], [R, 61], [C, 72], [L, 84], [R, 84]],
  };

  const el = {
    table: $('#bjTable'), shoe: $('#bjShoe'), dealer: $('#dealerCards'), dealerVal: $('#dealerValue'),
    hands: $('#playerHands'), msg: $('#bjMsg'), circle: $('#bjBetCircle'), stack: $('#bjStack'),
    betAmt: $('#bjBetAmount'), chips: $('#bjChips'), betting: $('#bjBetting'), actions: $('#bjActions'),
    deal: $('#bjDeal'), clear: $('#bjClear'), rebet: $('#bjRebet'), dbl: $('#bjDoubleBet'),
    hit: $('#bjHit'), stand: $('#bjStand'), double: $('#bjDouble'), split: $('#bjSplit'), shoeCount: $('#bjShoeCount'),
  };

  let shoe = [], cut = 0, dealer = null, hands = [], activeIdx = 0;
  let phase = 'bet', pending = 0, lastBet = 0, winStreak = 0, busy = false;

  /* ---------- Karten ---------- */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildShoe() {
    shoe = [];
    for (let d = 0; d < B.decks; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
    shuffle(shoe);
    cut = Math.floor(shoe.length * 0.25);
    updateShoe();
  }
  function updateShoe() { el.shoeCount.textContent = shoe.length; }
  const cardVal = c => c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : +c.r;
  function value(cards) {
    let t = 0, a = 0;
    for (const c of cards) { if (c.down) continue; t += cardVal(c); if (c.r === 'A') a++; }
    while (t > 21 && a) { t -= 10; a--; }
    return { t, soft: a > 0 };
  }
  const isBJ = cards => cards.length === 2 && value(cards.map(c => ({ ...c, down: false }))).t === 21;

  function cardHTML(c) {
    const s = c.s + VS;
    const corner = cls => `<div class="corner ${cls}"><b>${c.r}</b><i>${s}</i></div>`;
    let center;
    if (c.r === 'A') center = `<div class="ace">${s}</div>`;
    else if (COURT[c.r]) center = `<div class="court"><span class="court-fig">${COURT[c.r]}${VS}</span><span class="court-letter">${c.r}</span><span class="court-suit">${s}</span></div>`;
    else center = `<div class="pips">${PIPS[c.r].map(([x, y]) => `<i style="left:${x}%;top:${y}%"${y > 55 ? ' class="flip"' : ''}>${s}</i>`).join('')}</div>`;
    return corner('tl') + center + corner('br');
  }
  function makeCard(c) {
    const d = document.createElement('div');
    d.className = 'card';
    const red = c.s === '♥' || c.s === '♦';
    d.innerHTML = `<div class="card-inner"><div class="face front${red ? ' red' : ''}">${cardHTML(c)}</div><div class="face back"></div></div>`;
    d.setAttribute('aria-label', c.r + ' ' + c.s);
    return d;
  }

  // FLIP: bestehende Karten gleiten weich an neue Positionen
  function flip(container, mutate) {
    const items = [...container.querySelectorAll('.card, .bj-hand')];
    const before = new Map(items.map(n => [n, n.getBoundingClientRect()]));
    mutate();
    before.forEach((r, n) => {
      if (!n.isConnected) return;
      const a = n.getBoundingClientRect();
      const dx = r.left - a.left, dy = r.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  async function dealTo(hand, faceUp = true) {
    if (shoe.length === 0) buildShoe();
    const c = shoe.pop(); updateShoe();
    c.down = !faceUp;
    hand.cards.push(c);
    const node = makeCard(c);
    c.node = node;
    flip(el.table, () => hand.cardsEl.appendChild(node));
    const sr = el.shoe.getBoundingClientRect(), cr = node.getBoundingClientRect();
    const dx = sr.left + sr.width / 2 - (cr.left + cr.width / 2), dy = sr.top + sr.height / 2 - (cr.top + cr.height / 2);
    node.animate([
      { transform: `translate(${dx}px,${dy}px) rotate(-28deg) scale(.85)`, offset: 0 },
      { transform: 'translate(0,0) rotate(2deg) scale(1.03)', offset: 0.85 },
      { transform: 'none', offset: 1 },
    ], { duration: U.reducedMotion ? 1 : 380, easing: 'cubic-bezier(.25,.8,.3,1)' });
    Sfx.card();
    await U.sleep(300);
    if (faceUp) { node.classList.add('up'); Sfx.flip(); }
    await U.sleep(200);
    renderValues();
    return c;
  }

  async function revealHole() {
    const c = dealer.cards.find(x => x.down);
    if (!c) return;
    c.down = false; c.node.classList.add('up'); Sfx.flip();
    await U.sleep(420);
    renderValues();
  }

  /* ---------- Darstellung ---------- */
  function valueText(cards) {
    const v = value(cards);
    if (!cards.length) return '';
    if (v.soft && v.t < 21 && !cards.some(c => c.down)) return `${v.t - 10} / ${v.t}`;
    return String(v.t);
  }
  function renderValues() {
    if (dealer) {
      const txt = valueText(dealer.cards);
      el.dealerVal.textContent = txt; el.dealerVal.hidden = !txt;
      el.dealerVal.classList.toggle('bust', value(dealer.cards).t > 21);
    }
    hands.forEach((h, i) => {
      h.valEl.textContent = valueText(h.cards);
      h.valEl.hidden = !h.cards.length;
      h.valEl.classList.toggle('bust', value(h.cards).t > 21);
      h.el.classList.toggle('active', phase === 'play' && i === activeIdx && hands.length > 1);
      h.betEl.textContent = U.fmt(h.bet);
    });
  }

  function newHandEl(betAmount) {
    const wrap = document.createElement('div');
    wrap.className = 'bj-hand';
    wrap.innerHTML = `<div class="hand-value" hidden></div><div class="cards"></div><div class="hand-bet"><span class="mini-chip"></span><b></b></div><div class="hand-result" hidden></div>`;
    const h = { cards: [], bet: betAmount, done: false, doubled: false, el: wrap,
      cardsEl: wrap.querySelector('.cards'), valEl: wrap.querySelector('.hand-value'),
      betEl: wrap.querySelector('.hand-bet b'), resEl: wrap.querySelector('.hand-result') };
    return h;
  }

  function chipsFor(amount) {
    const out = [];
    const den = [...B.chips].sort((a, b) => b.v - a.v);
    for (const c of den) while (amount >= c.v && out.length < 12) { out.push(c); amount -= c.v; }
    return out;
  }
  function renderStack() {
    el.stack.innerHTML = '';
    chipsFor(pending).reverse().forEach((c, i) => {
      const d = document.createElement('span');
      d.className = 'chip stacked'; d.style.setProperty('--c', c.c); d.style.setProperty('--i', i);
      d.innerHTML = `<span>${c.v >= 1000 ? c.v / 1000 + 'K' : c.v}</span>`;
      el.stack.appendChild(d);
    });
    el.betAmt.textContent = pending ? U.fmt(pending) : 'Einsatz setzen';
    el.circle.classList.toggle('has-bet', pending > 0);
  }

  function setMsg(t) { el.msg.textContent = t; el.msg.classList.remove('pop'); void el.msg.offsetWidth; el.msg.classList.add('pop'); }

  // Was die Runde auszahlt, wenn ab jetzt alle Hände stehen – für die Abrechnung bei Neuladen
  function standValue() {
    const sim = shoe.slice(), draw = () => sim.pop() || { r: '10', s: '♠' };
    const hs = hands.map(h => ({ cards: h.cards.map(c => ({ r: c.r, s: c.s })), bet: h.bet }));
    const dc = dealer ? dealer.cards.map(c => ({ r: c.r, s: c.s })) : [];
    if (hs.length === 1) while (hs[0].cards.length + dc.length < 4) (hs[0].cards.length <= dc.length ? hs[0].cards : dc).push(draw());
    hs.forEach(h => { while (h.cards.length < 2) h.cards.push(draw()); });
    const v = cs => value(cs).t;
    if (hs.some(h => v(h.cards) <= 21) && !(hs.length === 1 && isBJ(hs[0].cards))) while (v(dc) < 17) dc.push(draw());
    const d = v(dc), dBJ = isBJ(dc);
    return hs.reduce((sum, h) => {
      const p = v(h.cards), pBJ = hs.length === 1 && isBJ(h.cards);
      if (pBJ) return sum + (dBJ ? h.bet : h.bet * 2.5);
      if (p > 21 || dBJ) return sum;
      return sum + (d > 21 || p > d ? h.bet * 2 : p === d ? h.bet : 0);
    }, 0);
  }
  function setControls() {
    if ((phase === 'deal' || phase === 'play' || phase === 'dealer') && hands.length) Store.settle('blackjack', standValue());
    const betting = phase === 'bet';
    el.betting.hidden = !betting;
    el.actions.hidden = phase !== 'play';
    el.circle.hidden = !betting;
    el.table.classList.toggle('betting', betting && hands.length > 0);
    el.deal.disabled = !pending || busy;
    el.clear.disabled = !pending;
    el.rebet.disabled = !lastBet || pending === lastBet || lastBet > Store.s.balance;
    el.dbl.disabled = !pending || pending * 2 > Math.min(B.maxBet, Store.s.balance);
    $$('.chip-btn', el.chips).forEach(b => { b.disabled = +b.dataset.v + pending > Math.min(B.maxBet, Store.s.balance); });
    if (phase === 'play') {
      const h = hands[activeIdx];
      el.double.disabled = busy || h.cards.length !== 2 || !Store.canAfford(h.bet);
      el.split.disabled = busy || hands.length > 1 || h.cards.length !== 2 || cardVal(h.cards[0]) !== cardVal(h.cards[1]) || !Store.canAfford(h.bet);
      el.hit.disabled = el.stand.disabled = busy;
    }
  }

  /* ---------- Setzen ---------- */
  function flyChip(fromEl, c) {
    const a = fromEl.getBoundingClientRect(), b = el.circle.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'chip flying'; f.style.setProperty('--c', c.c);
    f.innerHTML = `<span>${c.v >= 1000 ? c.v / 1000 + 'K' : c.v}</span>`;
    Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px,${dy - 30}px) rotate(200deg) scale(1.05)`, offset: 0.7 }, { transform: `translate(${dx}px,${dy}px) rotate(360deg) scale(.7)` }],
      { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => f.remove();
  }

  function addChip(btn) {
    if (phase !== 'bet') return;
    const v = +btn.dataset.v;
    if (pending + v > Math.min(B.maxBet, Store.s.balance)) { Sfx.error(); return; }
    Sfx.init(); Sfx.chip();
    flyChip(btn, B.chips.find(c => c.v === v));
    pending += v;
    setTimeout(renderStack, 380);
    clearTable(); setControls();
  }

  function clearTable() {
    if (!dealer && !hands.length) return;
    if (phase !== 'bet') return;
    [...el.dealer.children, ...el.hands.querySelectorAll('.bj-hand')].forEach(n => {
      n.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-30px) scale(.9)' }], { duration: 250, fill: 'forwards' });
    });
    const oldD = [...el.dealer.children], oldH = [...el.hands.children];
    setTimeout(() => { oldD.forEach(n => n.remove()); oldH.forEach(n => n.remove()); }, 260);
    dealer = null; hands = [];
    el.dealerVal.hidden = true;
  }

  /* ---------- Runde ---------- */
  async function startRound() {
    if (phase !== 'bet' || !pending || busy) return;
    Sfx.init();
    if (!Store.bet(pending)) { App.insufficient(pending); return; }
    Store.hold('blackjack', pending);
    busy = true;
    lastBet = pending;
    clearTable();
    await U.sleep(280);
    el.dealer.innerHTML = ''; el.hands.innerHTML = '';
    if (shoe.length < cut) { setMsg('Neuer Schlitten wird gemischt …'); buildShoe(); el.shoe.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], { duration: 600 }); await U.sleep(700); }
    phase = 'deal';
    dealer = { cards: [], cardsEl: el.dealer };
    const h = newHandEl(pending);
    hands = [h];
    el.hands.appendChild(h.el);
    pending = 0; renderStack();
    setControls();
    setMsg('Karten werden ausgeteilt …');
    Store.settle('blackjack', standValue());
    await dealTo(h); await dealTo(dealer); await dealTo(h); await dealTo(dealer, false);

    const up = dealer.cards[0];
    const dealerBJ = isBJ(dealer.cards);
    if (cardVal(up) >= 10) {
      setMsg('Dealer prüft auf Blackjack …');
      el.table.classList.add('peek'); await U.sleep(900); el.table.classList.remove('peek');
    }
    if (dealerBJ || isBJ(h.cards)) {
      await revealHole();
      busy = false;
      await settle();
      return;
    }
    phase = 'play'; activeIdx = 0; busy = false;
    setMsg('Karte ziehen oder halten?');
    renderValues(); setControls();
  }

  async function hit() {
    if (phase !== 'play' || busy) return;
    busy = true; setControls();
    const h = hands[activeIdx];
    await dealTo(h);
    const v = value(h.cards).t;
    busy = false;
    if (v > 21) { FX.shake(h.el); Sfx.lose(); setMsg('Überkauft!'); await U.sleep(500); await nextHand(); }
    else if (v === 21) { await U.sleep(250); await nextHand(); }
    else setControls();
  }

  async function stand() {
    if (phase !== 'play' || busy) return;
    Sfx.click();
    await nextHand();
  }

  async function doubleDown() {
    if (phase !== 'play' || busy) return;
    const h = hands[activeIdx];
    if (h.cards.length !== 2 || !Store.bet(h.bet)) { Sfx.error(); return; }
    Store.hold('blackjack', h.bet);
    busy = true; setControls();
    Sfx.chip();
    h.bet *= 2; h.doubled = true; renderValues();
    setMsg('Verdoppelt – eine Karte');
    await dealTo(h);
    if (value(h.cards).t > 21) { FX.shake(h.el); Sfx.lose(); }
    busy = false;
    await U.sleep(350);
    await nextHand();
  }

  async function split() {
    if (phase !== 'play' || busy || hands.length > 1) return;
    const h = hands[0];
    if (h.cards.length !== 2 || cardVal(h.cards[0]) !== cardVal(h.cards[1])) return;
    if (!Store.bet(h.bet)) { Sfx.error(); return; }
    Store.hold('blackjack', h.bet);
    busy = true; setControls(); Sfx.chip();
    const h2 = newHandEl(h.bet);
    const moved = h.cards.pop();
    flip(el.table, () => {
      el.hands.appendChild(h2.el);
      h2.cardsEl.appendChild(moved.node);
    });
    h2.cards.push(moved);
    hands.push(h2);
    renderValues();
    await U.sleep(380);
    const aces = h.cards[0].r === 'A';
    await dealTo(h);
    if (aces) {
      await dealTo(h2);
      h.done = h2.done = true;
      setMsg('Asse geteilt – je eine Karte');
      busy = false;
      await U.sleep(500);
      await dealerTurn();
      return;
    }
    activeIdx = 0; busy = false;
    setMsg('Hand 1 von 2');
    renderValues(); setControls();
    if (value(h.cards).t === 21) await nextHand();
  }

  async function nextHand() {
    hands[activeIdx].done = true;
    if (activeIdx < hands.length - 1) {
      activeIdx++;
      const h = hands[activeIdx];
      renderValues();
      setMsg(`Hand ${activeIdx + 1} von ${hands.length}`);
      if (h.cards.length < 2) { busy = true; setControls(); await dealTo(h); busy = false; }
      setControls();
      if (value(h.cards).t === 21) await nextHand();
      return;
    }
    await dealerTurn();
  }

  async function dealerTurn() {
    phase = 'dealer'; busy = true; setControls(); renderValues();
    setMsg('Dealer ist dran …');
    await revealHole();
    const alive = hands.some(h => value(h.cards).t <= 21);
    if (alive) {
      while (value(dealer.cards).t < 17) {
        await U.sleep(420);
        await dealTo(dealer);
      }
    }
    busy = false;
    await settle();
  }

  async function settle() {
    phase = 'settle'; setControls();
    const d = value(dealer.cards).t, dBJ = isBJ(dealer.cards);
    let totalReturn = 0, anyWin = false, anyLoss = false, bjHit = false;
    for (const h of hands) {
      const p = value(h.cards).t, pBJ = hands.length === 1 && isBJ(h.cards);
      let ret = 0, label, cls;
      if (pBJ && !dBJ) { ret = h.bet * 2.5; label = 'BLACKJACK!'; cls = 'bj'; bjHit = true; }
      else if (pBJ && dBJ) { ret = h.bet; label = 'PUSH'; cls = 'push'; }
      else if (p > 21) { label = 'ÜBERKAUFT'; cls = 'lose'; }
      else if (dBJ) { label = 'DEALER BLACKJACK'; cls = 'lose'; }
      else if (d > 21 || p > d) { ret = h.bet * 2; label = 'GEWONNEN'; cls = 'win'; }
      else if (p === d) { ret = h.bet; label = 'PUSH'; cls = 'push'; }
      else { label = 'VERLOREN'; cls = 'lose'; }
      const net = ret - h.bet;
      h.resEl.hidden = false;
      h.resEl.className = 'hand-result ' + cls;
      h.resEl.innerHTML = `<b>${label}</b>${net > 0 ? `<span>+${U.fmt(net)}</span>` : ''}`;
      h.el.classList.add('settled', cls);
      totalReturn += ret;
      if (net > 0) anyWin = true;
      if (net < 0) anyLoss = true;
      if (ret > 0) {
        const c = FX.center(h.el);
        if (net > 0) FX.coins(c.x, c.y, cls === 'bj' ? 34 : 16, cls === 'bj' ? 1.15 : 0.9);
      }
    }
    Store.release('blackjack');
    if (totalReturn) Store.win(totalReturn, totalReturn - hands.reduce((s, h) => s + h.bet, 0));
    Store.stat('hands');
    if (bjHit) { Store.stat('bj'); Sfx.blackjack(); FX.confetti(110); FX.flash(); }
    else if (anyWin) Sfx.win(2);
    else if (anyLoss) Sfx.lose();
    else Sfx.push();
    if (anyWin && !anyLoss) { winStreak++; Store.stat('bjWins'); } else if (anyLoss) winStreak = 0;
    const netAll = totalReturn - hands.reduce((s, h) => s + h.bet, 0);
    Store.emit({ type: 'bjResult', net: netAll, blackjack: bjHit, win: anyWin, streak: winStreak, splitWins: hands.length > 1 && hands.every(h => h.el.classList.contains('win')) });

    const net = totalReturn - hands.reduce((s, h) => s + h.bet, 0);
    setMsg(net > 0 ? `Du gewinnst ${U.fmt(net)} Münzen!` : net < 0 ? (d > 21 ? 'Dealer überkauft – leider zu spät.' : 'Das Haus gewinnt diese Runde.') : 'Unentschieden – Einsatz zurück.');
    await U.sleep(900);
    phase = 'bet';
    pending = lastBet <= Math.min(B.maxBet, Store.s.balance) ? lastBet : 0;
    renderStack();
    setControls();
    if (Store.s.balance < 10) App.insufficient(10);
  }

  /* ---------- Eingaben ---------- */
  function buildChips() {
    el.chips.innerHTML = '';
    B.chips.forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip chip-btn'; b.dataset.v = c.v; b.style.setProperty('--c', c.c);
      b.setAttribute('aria-label', `Chip ${c.v}`);
      b.innerHTML = `<span>${c.v >= 1000 ? c.v / 1000 + 'K' : c.v}</span>`;
      b.addEventListener('click', () => addChip(b));
      el.chips.appendChild(b);
    });
  }
  buildChips();
  el.deal.addEventListener('click', startRound);
  el.clear.addEventListener('click', () => { Sfx.init(); Sfx.click(); pending = 0; renderStack(); setControls(); });
  el.rebet.addEventListener('click', () => { Sfx.init(); Sfx.chip(); pending = lastBet; renderStack(); clearTable(); setControls(); });
  el.dbl.addEventListener('click', () => { Sfx.init(); Sfx.chip(); pending = Math.min(pending * 2, B.maxBet, Store.s.balance); renderStack(); setControls(); });
  el.hit.addEventListener('click', hit);
  el.stand.addEventListener('click', stand);
  el.double.addEventListener('click', doubleDown);
  el.split.addEventListener('click', split);
  Store.on(ev => { if (ev.type === 'balance' && phase === 'bet') setControls(); });

  I18N.onChange(() => renderStack());
  buildShoe();
  pending = 100;
  renderStack();

  return {
    makeCard, // wird von Video-Poker, Hi-Lo und Baccarat mitgenutzt
    show() { setControls(); if (phase === 'bet' && !hands.length) setMsg('Setze deine Chips und teile aus.'); },
    hide() {},
    key(e) {
      const k = e.key.toLowerCase();
      if (phase === 'bet' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startRound(); return true; }
      if (phase !== 'play') return false;
      if (k === 'h') hit(); else if (k === 's') stand(); else if (k === 'd') doubleDown(); else if (k === 'p') split(); else return false;
      return true;
    },
  };
})();

'use strict';
/* ---------- Große Gewinn-Show & Banner ---------- */
const Celebrate = (() => {
  const bw = $('#bigwin'), bwTitle = $('#bwTitle'), bwAmount = $('#bwAmount'), bwSub = $('#bwSub');
  const bn = $('#banner'), bnTitle = $('#bnTitle'), bnSub = $('#bnSub');

  function bigWin(amount, bet) {
    const ratio = amount / bet;
    const tier = ratio >= 100 ? 3 : ratio >= 40 ? 2 : 1;
    bwTitle.textContent = ['', 'BIG WIN', 'MEGA WIN', 'EPIC WIN'][tier];
    bw.dataset.tier = tier;
    bwSub.textContent = `${U.fmtMult(Math.round(ratio * 10) / 10)} deines Einsatzes`;
    bwAmount.textContent = '0';
    bw.hidden = false;
    requestAnimationFrame(() => bw.classList.add('show'));
    Sfx.bigWin();
    FX.confetti(140);
    FX.coinRain(60 + tier * 30);
    const dur = 2200 + tier * 900;
    let skipped = false, rainT;
    rainT = setInterval(() => FX.coinRain(25), 900);
    return new Promise(res => {
      let lastTick = 0;
      const done = () => {
        clearInterval(rainT);
        bw.classList.remove('show');
        setTimeout(() => { bw.hidden = true; res(); }, 350);
      };
      const skip = () => {
        if (skipped) return; skipped = true;
        if (bwAmount._countRaf) cancelAnimationFrame(bwAmount._countRaf);
        bwAmount.textContent = U.fmt(amount);
        setTimeout(done, 700);
      };
      bw.onclick = skip;
      U.countUp(bwAmount, 0, amount, dur, U.fmt, v => {
        if (v - lastTick > amount / 30) { lastTick = v; Sfx.coin(Math.floor(v / amount * 8)); }
      }).then(() => { if (!skipped) { skipped = true; FX.flash(); setTimeout(done, 1400); } });
    });
  }

  function banner(title, sub, kind = '') {
    bnTitle.textContent = title; bnSub.textContent = sub;
    bn.dataset.kind = kind;
    bn.hidden = false;
    requestAnimationFrame(() => bn.classList.add('show'));
    if (kind === 'fs') { Sfx.win(3); FX.confetti(90); FX.stars(window.innerWidth / 2, window.innerHeight / 2, 24, '#ffb3f0'); }
    else Sfx.win(2);
    return new Promise(res => {
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        bn.classList.remove('show');
        setTimeout(() => { bn.hidden = true; res(); }, 300);
      };
      bn.onclick = close;
      setTimeout(close, 2600);
    });
  }
  return { bigWin, banner };
})();

/* ---------- Bonusrad ---------- */
const Wheel = (() => {
  const W = CFG.wheel;
  const canvas = $('#wheelCanvas'), g = canvas.getContext('2d');
  const btn = $('#wheelSpin'), result = $('#wheelResult'), pointer = $('#wheelPointer');
  const N = W.segments.length, SEG = Math.PI * 2 / N;
  let angle = 0, spinning = false, size = 0, dpr = 1, lastSeg = 0, bulbPhase = 0, raf = null, open = false;

  const cooldownMs = W.cooldownMin * 60 * 1000;
  const rescue = () => Store.s.balance < 10;
  const ready = () => rescue() || Date.now() - Store.s.lastBonus >= cooldownMs;
  const remaining = () => Math.max(0, cooldownMs - (Date.now() - Store.s.lastBonus));

  function resize() {
    const box = canvas.parentElement.clientWidth;
    size = Math.min(420, box);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    canvas.style.width = canvas.style.height = size + 'px';
  }

  function draw(now) {
    const R = size / 2, c = R;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    // Außenring
    const ring = g.createRadialGradient(c, c, R * 0.82, c, c, R);
    ring.addColorStop(0, '#5a3a00'); ring.addColorStop(0.3, '#ffd46a'); ring.addColorStop(0.6, '#b97a00'); ring.addColorStop(1, '#4a2c00');
    g.fillStyle = ring; g.beginPath(); g.arc(c, c, R - 1, 0, Math.PI * 2); g.fill();
    const rIn = R * 0.86;
    g.save(); g.translate(c, c); g.rotate(angle);
    for (let i = 0; i < N; i++) {
      const s = W.segments[i];
      const a0 = -Math.PI / 2 + i * SEG, a1 = a0 + SEG;
      const sg = g.createRadialGradient(0, 0, rIn * 0.2, 0, 0, rIn);
      sg.addColorStop(0, shade(s.c, 40)); sg.addColorStop(1, shade(s.c, -25));
      g.fillStyle = sg;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rIn, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,220,140,0.85)'; g.lineWidth = 2; g.stroke();
      // Beschriftung
      const mid = a0 + SEG / 2 + angle;
      const flipText = Math.cos(mid) < -0.01; // linke Hälfte: Text nicht kopfüber
      g.save(); g.rotate(a0 + SEG / 2);
      if (flipText) g.rotate(Math.PI);
      g.textAlign = flipText ? 'left' : 'right'; g.textBaseline = 'middle';
      const big = s.v >= 2500;
      g.font = `${big ? '' : ''}${Math.round(rIn * (big ? 0.13 : 0.115))}px "Bungee", Impact, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(20,6,30,0.8)';
      const label = s.v >= 1000 ? (s.v / 1000).toString().replace('.', ',') + 'K' : String(s.v);
      const tx = flipText ? -rIn * 0.9 : rIn * 0.9;
      g.strokeText(label, tx, 0);
      g.fillStyle = big ? '#fff6c8' : '#ffffff'; g.fillText(label, tx, 0);
      g.restore();
    }
    g.restore();
    // Glühbirnen am Rand
    for (let i = 0; i < N * 2; i++) {
      const a = -Math.PI / 2 + i * SEG / 2;
      const x = c + Math.cos(a) * R * 0.93, y = c + Math.sin(a) * R * 0.93;
      const on = spinning ? (Math.floor(bulbPhase) + i) % 2 === 0 : (Math.floor(now / 400) + i) % 3 !== 0;
      const bg = g.createRadialGradient(x, y, 0, x, y, R * 0.045);
      bg.addColorStop(0, on ? '#fffbe0' : '#8a6a2a'); bg.addColorStop(0.5, on ? '#ffd23f' : '#5a4010'); bg.addColorStop(1, on ? 'rgba(255,210,63,0)' : 'rgba(90,64,16,0)');
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, R * (on ? 0.05 : 0.03), 0, Math.PI * 2); g.fill();
    }
    // Nabe
    const hub = g.createRadialGradient(c - R * 0.04, c - R * 0.05, 2, c, c, R * 0.17);
    hub.addColorStop(0, '#fff5d0'); hub.addColorStop(0.5, '#f0b42a'); hub.addColorStop(1, '#6a3c00');
    g.fillStyle = hub; g.beginPath(); g.arc(c, c, R * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a0e3a'; g.beginPath(); g.arc(c, c, R * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd23f'; g.font = `${Math.round(R * 0.1)}px "Bungee", Impact, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', c, c + 1);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => U.clamp(v + amt, 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function loop(now) {
    if (!open) { raf = null; return; }
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function spin() {
    if (spinning || !ready()) return;
    Sfx.init();
    spinning = true; btn.disabled = true;
    result.textContent = 'Das Rad dreht sich …'; result.className = 'wheel-result';
    const idx = U.weighted(W.segments, 'w');
    const jitter = U.rand(-0.32, 0.32) * SEG;
    const targetMod = ((-(idx + 0.5) * SEG + jitter) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const curMod = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = targetMod - curMod; if (delta < 0) delta += Math.PI * 2;
    const from = angle, to = angle + Math.PI * 2 * 6 + delta;
    const dur = 5200, t0 = performance.now();
    lastSeg = Math.floor(from / SEG);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      angle = from + (to - from) * U.easeOutQuart(t);
      bulbPhase += 0.35;
      const seg = Math.floor(angle / SEG);
      if (seg !== lastSeg) {
        lastSeg = seg; Sfx.wheelTick();
        pointer.classList.remove('tick'); void pointer.offsetWidth; pointer.classList.add('tick');
      }
      if (t < 1) requestAnimationFrame(step);
      else finish(idx);
    };
    requestAnimationFrame(step);
  }

  function finish(idx) {
    spinning = false;
    const v = W.segments[idx].v;
    Store.s.lastBonus = Date.now();
    Store.credit(v);
    Store.emit({ type: 'wheel', value: v });
    result.innerHTML = `Du gewinnst <b>${U.fmt(v)}</b> Münzen!`;
    result.className = 'wheel-result win';
    Sfx.win(v >= 2500 ? 3 : 2);
    const c = FX.center(canvas);
    FX.coins(c.x, c.y, v >= 2500 ? 50 : 25, 1.2);
    if (v >= 2500) FX.confetti(120);
    App.updateBonus();
    updateBtn();
  }

  function updateBtn() {
    if (spinning) return;
    const ok = ready();
    btn.disabled = !ok;
    if (ok) btn.textContent = rescue() ? 'Rettungs-Dreh!' : 'Drehen!';
    else {
      const ms = remaining(), m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
      btn.textContent = `Wieder in ${m}:${String(s).padStart(2, '0')}`;
    }
  }

  btn.addEventListener('click', spin);
  window.addEventListener('resize', () => { if (open) resize(); });
  return {
    ready, remaining, rescue, updateBtn,
    open() {
      open = true; resize(); updateBtn();
      result.textContent = ready() ? (rescue() ? 'Leere Taschen? Das Rad hilft dir wieder auf die Beine.' : 'Dein Gratis-Dreh ist bereit.') : 'Dein nächster Gratis-Dreh lädt noch.';
      result.className = 'wheel-result';
      if (!raf) raf = requestAnimationFrame(loop);
    },
    close() { open = false; },
    get spinning() { return spinning; },
  };
})();

/* ---------- Erfolge ---------- */
const Achievements = (() => {
  const LIST = [
    { id: 'first_win', icon: '7', name: 'Erster Treffer', desc: 'Gewinne zum ersten Mal am Slot.' },
    { id: 'big_win', icon: '✦', name: 'Big Win', desc: 'Gewinne das 15-fache deines Einsatzes.' },
    { id: 'free_spins', icon: '★', name: 'Sternenregen', desc: 'Löse Freispiele aus.' },
    { id: 'five_kind', icon: 'V', name: 'Volle Linie', desc: '5 gleiche Symbole auf einer Linie.' },
    { id: 'blackjack', icon: '♠', name: 'Natürlich!', desc: 'Bekomme einen Blackjack.' },
    { id: 'bj_streak', icon: '♥', name: 'Heiße Hand', desc: 'Gewinne 3 Blackjack-Runden in Folge.' },
    { id: 'plinko_10', icon: '●', name: 'Guter Fall', desc: 'Triff bei Plinko mindestens 10×.' },
    { id: 'plinko_100', icon: '◆', name: 'Plinko-Legende', desc: 'Triff bei Plinko 100× oder mehr.' },
    { id: 'level_5', icon: '5', name: 'Stammgast', desc: 'Erreiche Level 5.' },
    { id: 'level_10', icon: '10', name: 'VIP-Lounge', desc: 'Erreiche Level 10.' },
    { id: 'rich_10k', icon: '$', name: 'Fünfstellig', desc: 'Besitze 10.000 Münzen.' },
    { id: 'rich_100k', icon: '♛', name: 'High Roller', desc: 'Besitze 100.000 Münzen.' },
  ];
  function unlock(id) {
    const s = Store.s;
    if (s.ach[id]) return;
    s.ach[id] = Date.now(); Store.save();
    const a = LIST.find(x => x.id === id);
    Sfx.achievement();
    Toast.show('Erfolg freigeschaltet', a.name, a.icon, 'ach');
    render();
  }
  function check(ev) {
    const s = Store.s;
    if (ev.type === 'slotResult') {
      if (ev.total > 0) unlock('first_win');
      if (ev.total >= ev.bet * 15) unlock('big_win');
      if (ev.lines.some(l => l.n === 5)) unlock('five_kind');
    }
    if (ev.type === 'freeSpins') unlock('free_spins');
    if (ev.type === 'bjResult') { if (ev.blackjack) unlock('blackjack'); if (ev.streak >= 3) unlock('bj_streak'); }
    if (ev.type === 'plinko') { if (ev.mult >= 10) unlock('plinko_10'); if (ev.mult >= 100) unlock('plinko_100'); }
    if (ev.type === 'levelup' || ev.type === 'xp') { if (s.level >= 5) unlock('level_5'); if (s.level >= 10) unlock('level_10'); }
    if (ev.type === 'balance') { if (s.balance >= 10000) unlock('rich_10k'); if (s.balance >= 100000) unlock('rich_100k'); }
  }
  function render() {
    const box = $('#achGrid');
    if (!box) return;
    const got = LIST.filter(a => Store.s.ach[a.id]).length;
    $('#achCount').textContent = `${got} / ${LIST.length}`;
    box.innerHTML = LIST.map(a => `<div class="ach ${Store.s.ach[a.id] ? 'got' : ''}" title="${a.desc}">
      <div class="ach-icon">${a.icon}</div><div><b>${a.name}</b><span>${a.desc}</span></div></div>`).join('');
  }
  Store.on(check);
  return { render };
})();

/* ---------- App / Navigation ---------- */
const App = (() => {
  const views = { lobby: null, slots: Slots, plinko: Plinko, blackjack: Blackjack };
  let current = null, shownBalance = Store.s.balance, openModalId = null;

  function go(name) {
    if (!(name in views)) name = 'lobby';
    if (current === name) return;
    if (current && views[current]) views[current].hide();
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    document.body.dataset.view = name;
    current = name;
    window.scrollTo(0, 0);
    if (views[name]) views[name].show();
    if (name === 'lobby') { renderStats(); Achievements.render(); Lobby.show(); } else Lobby.hide();
  }

  function route() {
    const h = (location.hash || '').replace('#', '');
    go(h || 'lobby');
  }

  /* Header */
  const balEl = $('#balVal'), balBox = $('#balance');
  function updateBalance(delta) {
    const to = Store.s.balance;
    U.countUp(balEl, shownBalance, to, Math.abs(to - shownBalance) > 0 ? 650 : 1);
    shownBalance = to;
    if (delta > 0) { balBox.classList.remove('up', 'down'); void balBox.offsetWidth; balBox.classList.add('up'); }
    else if (delta < 0) { balBox.classList.remove('up', 'down'); void balBox.offsetWidth; balBox.classList.add('down'); }
  }
  function updateXp() {
    const s = Store.s, need = Store.xpNeed(s.level);
    $('#lvlNum').textContent = s.level;
    $('#xpFill').style.width = (s.xp / need * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${U.fmt(s.xp)} / ${U.fmt(need)} XP`;
  }
  function updateBonus() {
    const b = $('#bonusBtn'), t = $('#bonusTimer');
    const ready = Wheel.ready();
    b.classList.toggle('ready', ready);
    if (ready) t.textContent = Wheel.rescue() ? 'Rettung' : 'Bereit';
    else {
      const ms = Wheel.remaining(), m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
      t.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
    if (openModalId === 'modal-wheel') Wheel.updateBtn();
  }

  function renderStats() {
    const s = Store.s.stats;
    const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
    set('stBalance', U.fmt(Store.s.balance));
    set('stPeak', U.fmt(Store.s.peak));
    set('stBiggest', U.fmt(s.biggest));
    set('stWagered', U.fmt(s.wagered));
    set('stSpins', U.fmt(s.spins));
    set('stHands', U.fmt(s.hands));
    set('stBalls', U.fmt(s.balls));
    set('stMult', s.maxMult ? U.fmtMult(s.maxMult) : '–');
    set('lobbyLevel', Store.s.level);
  }

  /* Modals */
  function openModal(id) {
    closeModal();
    const m = $('#' + id);
    m.hidden = false; openModalId = id;
    requestAnimationFrame(() => m.classList.add('show'));
    if (id === 'modal-wheel') Wheel.open();
    const f = m.querySelector('[data-autofocus]') || m.querySelector('button');
    f && f.focus({ preventScroll: true });
  }
  function closeModal() {
    if (!openModalId) return;
    if (openModalId === 'modal-wheel' && Wheel.spinning) return;
    const m = $('#' + openModalId);
    m.classList.remove('show');
    const id = openModalId;
    setTimeout(() => { if (openModalId !== id) m.hidden = true; }, 250);
    if (id === 'modal-wheel') Wheel.close();
    openModalId = null;
  }
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { Sfx.click(); closeModal(); } });
  });

  function insufficient(need) {
    Sfx.error();
    FX.shake(balBox);
    if (Wheel.ready()) {
      Toast.show('Nicht genug Münzen', 'Dreh am Bonusrad für Nachschub!', '!', 'warn');
      setTimeout(() => openModal('modal-wheel'), 500);
    } else {
      Toast.show('Nicht genug Münzen', `Du brauchst ${U.fmt(need)}. Senke den Einsatz oder warte auf den Bonus.`, '!', 'warn');
    }
  }

  /* Events */
  Store.on(ev => {
    if (ev.type === 'balance') { updateBalance(ev.delta); updateBonus(); if (current === 'lobby') renderStats(); }
    if (ev.type === 'xp') updateXp();
    if (ev.type === 'levelup') {
      Sfx.levelUp();
      Toast.show(`Level ${ev.level}!`, `Belohnung: +${U.fmt(ev.reward)} Münzen`, '▲', 'level');
      const c = FX.center($('#lvlNum'));
      FX.stars(c.x, c.y, 14);
      $('#levelBox').classList.remove('lvl-up'); void $('#levelBox').offsetWidth; $('#levelBox').classList.add('lvl-up');
    }
    if (ev.type === 'reset') { shownBalance = Store.s.balance; balEl.textContent = U.fmt(shownBalance); renderStats(); Achievements.render(); updateBonus(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (openModalId || e.target.closest('input, textarea, select')) return;
    if (e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return; // Button-Klick nicht doppelt auslösen
    const v = views[current];
    if (v && v.key) v.key(e);
  });
  // Erster Nutzerkontakt schaltet Audio frei
  ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, () => Sfx.init(), { once: true, capture: true }));

  $('#bonusBtn').addEventListener('click', () => { Sfx.init(); Sfx.click(); openModal('modal-wheel'); });
  const muteBtn = $('#muteBtn');
  const setMuteUI = () => { muteBtn.classList.toggle('muted', Sfx.muted); muteBtn.setAttribute('aria-pressed', Sfx.muted); muteBtn.title = Sfx.muted ? 'Ton an' : 'Ton aus'; };
  muteBtn.addEventListener('click', () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); setMuteUI(); Sfx.click(); });
  setMuteUI();

  // Zurücksetzen mit Bestätigung auf der Seite
  const resetBtn = $('#resetBtn'), resetConfirm = $('#resetConfirm');
  resetBtn.addEventListener('click', () => { resetConfirm.hidden = false; resetBtn.hidden = true; });
  $('#resetNo').addEventListener('click', () => { resetConfirm.hidden = true; resetBtn.hidden = false; });
  $('#resetYes').addEventListener('click', () => {
    Store.reset(); resetConfirm.hidden = true; resetBtn.hidden = false;
    Toast.show('Neustart', 'Du startest wieder mit 2.500 Münzen.', '↺');
  });

  window.addEventListener('hashchange', route);
  setInterval(updateBonus, 1000);

  return {
    init() {
      balEl.textContent = U.fmt(Store.s.balance);
      updateXp(); updateBonus(); route();
    },
    openModal, closeModal, insufficient, updateBonus,
  };
})();

/* ---------- Lobby: Vorschau-Grafiken ---------- */
const Lobby = (() => {
  let raf = null, active = false;
  const slotC = $('#prevSlots'), plC = $('#prevPlinko');

  function fit(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h, dpr };
  }

  function drawSlots(now) {
    const { g, w, h, dpr } = fit(slotC);
    g.clearRect(0, 0, w, h);
    const cellS = Math.min(w / 3.4, h * 0.78);
    const ids = ['seven', 'wild', 'seven'];
    const x0 = (w - cellS * 3) / 2, y0 = (h - cellS) / 2;
    ids.forEach((id, i) => {
      const x = x0 + i * cellS;
      const bg = g.createLinearGradient(0, y0 - 10, 0, y0 + cellS + 10);
      bg.addColorStop(0, '#140a24'); bg.addColorStop(0.5, '#2e1a4c'); bg.addColorStop(1, '#140a24');
      g.fillStyle = bg; g.fillRect(x + 2, y0 - 10, cellS - 4, cellS + 20);
      const bob = Math.sin(now * 0.002 + i * 1.2) * 3;
      const k = 1 + (i === 1 ? 0.06 * Math.sin(now * 0.004) : 0);
      const sz = cellS * k;
      g.drawImage(Symbols.sprite(id, Math.round(cellS * dpr)), x + (cellS - sz) / 2, y0 + bob + (cellS - sz) / 2, sz, sz);
    });
    const sh = g.createLinearGradient(0, y0 - 10, 0, y0 + cellS + 10);
    sh.addColorStop(0, 'rgba(12,5,22,0.9)'); sh.addColorStop(0.22, 'rgba(12,5,22,0)'); sh.addColorStop(0.78, 'rgba(12,5,22,0)'); sh.addColorStop(1, 'rgba(12,5,22,0.9)');
    g.fillStyle = sh; g.fillRect(x0, y0 - 10, cellS * 3, cellS + 20);
    // Gewinnlinie
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.005);
    g.strokeStyle = `rgba(255,210,63,${pulse})`; g.lineWidth = 3; g.shadowColor = '#ffd23f'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(x0 - 8, y0 + cellS / 2); g.lineTo(x0 + cellS * 3 + 8, y0 + cellS / 2); g.stroke();
    g.shadowBlur = 0;
  }

  function drawPlinko(now) {
    const { g, w, h } = fit(plC);
    g.clearRect(0, 0, w, h);
    const rows = 8, s = Math.min(w / (rows + 3), h / (rows + 2.2)), cx = w / 2, y0 = s * 0.9, v = s * 0.86;
    for (let r = 0; r < rows; r++) for (let j = 0; j < r + 3; j++) {
      const x = cx + (j - (r + 2) / 2) * s, y = y0 + r * v;
      g.fillStyle = '#cbbcf5'; g.beginPath(); g.arc(x, y, Math.max(1.6, s * 0.1), 0, Math.PI * 2); g.fill();
    }
    const by = y0 + (rows - 1) * v + v * 0.7;
    for (let k = 0; k <= rows; k++) {
      const col = Plinko.binColor(k, rows);
      g.fillStyle = `rgb(${col.join(',')})`;
      const x = cx + (k - rows / 2) * s - s * 0.42;
      g.beginPath(); g.roundRect ? g.roundRect(x, by, s * 0.84, s * 0.6, 4) : g.rect(x, by, s * 0.84, s * 0.6); g.fill();
    }
    // Animierte Kugel auf einem festen Pfad
    const path = [1, 0, 1, 1, 0, 1, 1, 1];
    const T = 0.28, total = (rows + 1) * T + 0.8;
    const t = (now / 1000) % total;
    const seg = Math.floor(t / T), f = (t % T) / T;
    if (seg <= rows) {
      let k = 0; for (let i = 0; i < Math.min(seg, rows); i++) k += path[i];
      const pos = (r, kk) => r < 0 ? [cx, y0 - v * 1.3] : r >= rows ? [cx + (kk - rows / 2) * s, by + s * 0.2] : [cx + (kk - r / 2) * s, y0 + r * v - s * 0.3];
      const a = pos(seg - 1, k - (seg > 0 ? path[seg - 1] : 0));
      const b = pos(seg, k);
      if (seg === 0) { a[0] = cx; }
      const x = a[0] + (b[0] - a[0]) * f;
      const up = seg === 0 ? 0 : v * 0.9;
      const y = a[1] + (b[1] - a[1] + up) * f * f - up * f;
      const rr = s * 0.24;
      const gl = g.createRadialGradient(x, y, 0, x, y, rr * 2.6);
      gl.addColorStop(0, 'rgba(255,110,190,0.6)'); gl.addColorStop(1, 'rgba(255,110,190,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, rr * 2.6, 0, Math.PI * 2); g.fill();
      const bg = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 1, x, y, rr);
      bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#ff2f86');
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
  }

  function loop(now) {
    if (!active) { raf = null; return; }
    drawSlots(now); drawPlinko(now);
    raf = U.reducedMotion ? null : requestAnimationFrame(loop);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Symbols.clear(); });
  return {
    show() { active = true; if (!raf) raf = requestAnimationFrame(loop); },
    hide() { active = false; },
  };
})();

App.init();

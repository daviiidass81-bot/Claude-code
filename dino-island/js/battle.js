'use strict';
/* ==========================================================
   Battle Arena: turn-based Charge / Bite / Swipe combat
   ========================================================== */
const Battle = {
  active: false, cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  me: [], foe: [], mi: 0, fi: 0, phase: 'intro', league: null, round: 0,
  fx: [], nums: [], shake: 0, t: 0, timer: 15, lastBlockMe: false, lastBlockFoe: false, turn: 0,
  anim: { me: { x: 0, pose: 'idle', flash: 0, tint: 0 }, foe: { x: 0, pose: 'idle', flash: 0, tint: 0 } },

  init() {
    this.cv = $('#battleCanvas'); this.ctx = this.cv.getContext('2d');
    $$('#bActions .b-act').forEach(b => b.addEventListener('click', () => { Sfx.click(); this.choose(b.dataset.act); }));
    addEventListener('resize', () => this.active && this.resize());
    addEventListener('keydown', e => {
      if (!this.active || this.phase !== 'choose') return;
      const m = { '1': 'charge', '2': 'bite', '3': 'swipe', '4': 'block', '5': 'special', '6': 'swap' }[e.key];
      if (m) this.choose(m);
    });
  },
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
  },
  fighter(sid, level, stage, o) {
    const sp = SPECIES[sid], st = dinoStats(sp, level, stage);
    return { sid, sp, level, stage, hp: st.hp, maxHp: st.hp, atk: st.atk, weak: sp.weak, meter: 0, o, name: sp.name };
  },
  start(league, objs) {
    this.league = league;
    this.round = G.league.round[league.id] || 0;
    this.me = objs.map(o => this.fighter(o.species, o.level, o.stage || 0, o));
    const rng = Math.random;
    const lo = league.lv[0], hi = league.lv[1];
    // opponents scale with the player's team so fights stay challenging
    const avg = objs.reduce((a, o) => a + o.level, 0) / Math.max(1, objs.length);
    const lvl = () => Math.max(Math.round(lerp(lo, hi, (this.round + rng()) / 3)), Math.round(avg * (0.85 + 0.1 * this.round) + rand(-1, 1)));
    this.foe = [];
    const pool = league.pool.slice();
    for (let i = 0; i < 3; i++) {
      const sid = pool.splice(Math.floor(rng() * pool.length), 1)[0] || pick(league.pool);
      const L = clamp(lvl(), 1, MAX_LEVEL);
      this.foe.push(this.fighter(sid, L, stageOf(L), null));
    }
    this.mi = 0; this.fi = 0; this.fx = []; this.nums = []; this.turn = 0;
    this.lastBlockMe = this.lastBlockFoe = false;
    this.rival = pick(['Emerald Isle Safari', 'Raptor Ridge', 'Cretaceous Cove', 'Fossil Falls', 'Amber Bay Park', 'Thunder Valley', 'Canyon Kings']);
    this.active = true;
    $('#battle').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    UI.hideInfo();
    this.resize();
    this.anim.me = { x: -this.W * 0.6, pose: 'walk', flash: 0, tint: 0, lunge: 0 };
    this.anim.foe = { x: this.W * 0.6, pose: 'walk', flash: 0, tint: 0, lunge: 0 };
    this.crowd = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), c: pick(['#e0513a', '#4aa8e0', '#ffd23f', '#7dc15a', '#fff', '#b35ae0', '#ff8a3a']), p: Math.random() * TAU }));
    $('#bRound').textContent = `${league.name.toUpperCase()} · MATCH ${this.round + 1}/3`;
    this.hud();
    this.intro();
  },
  async intro() {
    this.phase = 'intro'; this.buttons();
    this.msg(`vs ${this.rival}`);
    await this.tween(900, k => { this.anim.me.x = lerp(-this.W * 0.6, 0, easeOut(k)); this.anim.foe.x = lerp(this.W * 0.6, 0, easeOut(k)); });
    this.anim.me.pose = 'idle'; this.anim.foe.pose = 'idle';
    this.anim.me.pose = 'roar'; Sfx.roar(this.cur().sp.size); this.shake = 6;
    await this.wait(900);
    this.anim.me.pose = 'idle'; this.anim.foe.pose = 'roar'; Sfx.roar(this.enemy().sp.size); this.shake = 6;
    await this.wait(900);
    this.anim.foe.pose = 'idle';
    this.msg('FIGHT!');
    Sfx.fanfare();
    await this.wait(700);
    this.beginTurn();
  },
  cur() { return this.me[this.mi]; },
  enemy() { return this.foe[this.fi]; },
  beginTurn() { this.phase = 'choose'; this.timer = 15; this.buttons(); },
  buttons() {
    const on = this.phase === 'choose';
    const c = this.cur(), e = this.enemy();
    const known = e && (G.pedia[e.sid] && G.pedia[e.sid].weak);
    $$('#bActions .b-act').forEach(b => {
      const a = b.dataset.act;
      let dis = !on;
      if (a === 'special') dis = dis || c.meter < 3;
      if (a === 'block') dis = dis || this.lastBlockMe;
      if (a === 'swap') dis = dis || this.me.filter(f => f.hp > 0).length < 2;
      b.disabled = dis;
      b.classList.toggle('hint', !!(on && known && a === e.weak));
    });
    $('#bSpecial').textContent = `${Math.min(3, c.meter)}/3`;
  },
  hud() {
    const c = this.cur(), e = this.enemy();
    const set = (side, f) => {
      $(`#b${side}Name`).textContent = `${f.name} · Lv ${f.level}`;
      const k = clamp(f.hp / f.maxHp, 0, 1);
      const bar = $(`#b${side}Hp`); bar.style.width = (k * 100) + '%';
      bar.className = k < 0.25 ? 'low' : k < 0.5 ? 'mid' : '';
      $(`#b${side}HpT`).textContent = `${Math.max(0, Math.ceil(f.hp))} / ${f.maxHp}`;
    };
    set('Me', c); set('Foe', e);
    $('#bMeTeam').innerHTML = this.me.map((f, i) => `<i class="${f.hp <= 0 ? 'ko' : ''} ${i === this.mi ? 'act' : ''}"></i>`).join('');
    $('#bFoeTeam').innerHTML = this.foe.map((f, i) => `<i class="${f.hp <= 0 ? 'ko' : ''} ${i === this.fi ? 'act' : ''}"></i>`).join('');
  },
  msg(text) { const m = $('#bMsg'); m.textContent = text; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); },
  wait(ms) { return new Promise(r => setTimeout(r, ms)); },
  tween(ms, fn) { return new Promise(r => { const s = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - s) / ms); fn(k); k < 1 ? requestAnimationFrame(step) : r(); }; step(); }); },

  aiChoice() {
    const e = this.enemy(), c = this.cur();
    if (e.meter >= 3 && Math.random() < 0.65) return 'special';
    if (!this.lastBlockFoe && (c.meter >= 3 ? Math.random() < 0.45 : Math.random() < 0.12)) return 'block';
    const knows = this.turn > 1 && Math.random() < 0.35 + this.round * 0.12;
    if (knows) return c.weak;
    return pick(['charge', 'bite', 'swipe']);
  },
  damage(att, def, type) {
    let mult = type === 'special' ? 1.5 : DMG_TABLE[def.weak][type];
    const crit = Math.random() < 0.1;
    const dmg = Math.max(1, Math.round(att.atk * mult * rand(0.9, 1.1) * (crit ? 1.5 : 1)));
    return { dmg, mult, crit };
  },
  async choose(act) {
    if (this.phase !== 'choose') return;
    this.phase = 'resolve'; this.buttons(); this.turn++;
    const eAct = this.aiChoice();
    const meBlock = act === 'block', foeBlock = eAct === 'block';
    // player acts first
    if (act === 'swap') {
      await this.swap('me');
    } else if (!meBlock) {
      await this.attack('me', act, foeBlock);
      if (this.enemy().hp <= 0) { await this.ko('foe'); if (this.over()) return; this.lastBlockMe = false; this.lastBlockFoe = false; return this.beginTurn(); }
    } else { this.fxShield('me'); Sfx.block(); await this.wait(400); }
    // enemy acts
    if (!foeBlock) {
      await this.attack('foe', eAct, meBlock);
      if (this.cur().hp <= 0) { await this.ko('me'); if (this.over()) return; }
    } else if (!(!meBlock && act !== 'swap')) { this.fxShield('foe'); Sfx.block(); await this.wait(400); }
    this.lastBlockMe = meBlock; this.lastBlockFoe = foeBlock;
    this.hud();
    this.beginTurn();
  },
  async attack(side, type, blocked) {
    const att = side === 'me' ? this.cur() : this.enemy(), def = side === 'me' ? this.enemy() : this.cur();
    const A = this.anim[side], D = this.anim[side === 'me' ? 'foe' : 'me'];
    const dir = side === 'me' ? 1 : -1;
    const special = type === 'special';
    if (special) { att.meter = 0; A.pose = 'roar'; Sfx.roar(att.sp.size * 1.2); this.fxAura(side); this.msg(`${att.name}: SPECIAL!`); await this.wait(800); }
    A.pose = 'attack';
    Sfx.whoosh();
    const dist = this.W * 0.2;
    await this.tween(type === 'charge' || special ? 320 : 220, k => { A.x = dir * dist * easeInOut(k); });
    if (blocked) {
      this.fxShield(side === 'me' ? 'foe' : 'me'); Sfx.block();
      this.num(side === 'me' ? 'foe' : 'me', 'BLOCKED', '#8fd3ff');
    } else {
      const r = this.damage(att, def, type);
      def.hp -= r.dmg;
      att.meter = Math.min(3, att.meter + (special ? 0 : 1));
      D.flash = 1; D.pose = 'hurt';
      this.shake = r.crit || special ? 14 : 8;
      if (type === 'swipe') { Sfx.slash(); this.fxSlash(side === 'me' ? 'foe' : 'me'); }
      else if (type === 'bite') { Sfx.chomp(); this.fxBite(side === 'me' ? 'foe' : 'me'); }
      else { Sfx.hit(true); this.fxImpact(side === 'me' ? 'foe' : 'me', special); }
      const col = r.mult >= 1 ? '#ffd23f' : r.mult >= 0.5 ? '#fff' : '#aaa';
      this.num(side === 'me' ? 'foe' : 'me', `-${r.dmg}${r.crit ? '!' : ''}`, col, r.mult >= 1 || special);
      if (side === 'me' && r.mult >= 1 && !special) {
        if (!G.pedia[def.sid] || !G.pedia[def.sid].weak) { G.pedia[def.sid] = { weak: true }; }
        this.msg('WEAK SPOT!');
      } else if (side === 'me' && r.mult <= 0.25) this.msg('Not very effective…');
      if (r.crit) this.msg('CRITICAL!');
      this.hud();
    }
    await this.tween(300, k => { A.x = dir * dist * (1 - easeOut(k)); });
    A.pose = 'idle'; D.pose = def.hp > 0 ? 'idle' : 'hurt';
    await this.wait(250);
  },
  async swap(side) {
    const team = side === 'me' ? this.me : this.foe;
    const idx = side === 'me' ? this.mi : this.fi;
    let n = -1;
    for (let k = 1; k <= team.length; k++) { const j = (idx + k) % team.length; if (team[j].hp > 0 && j !== idx) { n = j; break; } }
    if (n < 0) return;
    const A = this.anim[side], dir = side === 'me' ? -1 : 1;
    await this.tween(350, k => { A.x = dir * this.W * 0.6 * easeInOut(k); });
    if (side === 'me') this.mi = n; else this.fi = n;
    this.hud();
    A.pose = 'walk';
    await this.tween(450, k => { A.x = dir * this.W * 0.6 * (1 - easeOut(k)); });
    A.pose = 'roar'; Sfx.roar((side === 'me' ? this.cur() : this.enemy()).sp.size);
    await this.wait(600); A.pose = 'idle';
    this.buttons();
  },
  async ko(side) {
    const A = this.anim[side];
    const f = side === 'me' ? this.cur() : this.enemy();
    this.msg(`${f.name} is knocked out!`);
    A.pose = 'sleep'; Sfx.hit(true); this.shake = 10;
    await this.wait(1100);
    const team = side === 'me' ? this.me : this.foe;
    if (team.some(x => x.hp > 0)) {
      await this.swap(side);
      this.lastBlockMe = this.lastBlockFoe = false;
    }
  },
  over() {
    const meAlive = this.me.some(f => f.hp > 0), foeAlive = this.foe.some(f => f.hp > 0);
    if (meAlive && foeAlive) return false;
    this.finish(meAlive);
    return true;
  },
  finish(win) {
    this.phase = 'end'; this.buttons();
    const L = this.league, li = LEAGUES.indexOf(L);
    G.stats.battles++;
    let html, reward = { coins: 0, bucks: 0, xp: 0 }, champion = false, amber = null;
    if (win) {
      G.stats.battlesWon++;
      missionEvent('battle_win');
      const base = Math.round(L.fee * (1.6 + this.round * 0.6));
      reward = { coins: base, bucks: this.round === 2 ? 2 : 0, xp: Math.round(L.reward.xp * 0.25 * (1 + this.round * 0.5)) };
      this.round++;
      if (this.round >= 3) {
        champion = true; this.round = 0;
        reward.coins += L.reward.coins; reward.bucks += L.reward.bucks; reward.xp += L.reward.xp;
        G.league.best = Math.max(G.league.best, li);
      }
      if (Math.random() < 0.35) amber = rollAmber(true);
      Sfx.win();
      this.anim.me.pose = 'roar';
    } else {
      this.round = 0;
      Sfx.lose();
      reward.xp = 20;
    }
    G.league.round[L.id] = this.round;
    if (reward.coins) gain('coins', reward.coins, 'arena');
    if (reward.bucks) gain('bucks', reward.bucks, 'arena');
    if (reward.xp) addXP(reward.xp, 'arena');
    html = `<div class="modal-card" style="max-width:520px;text-align:center">
      <div class="modal-head"><h2>${win ? (champion ? '🏆 CHAMPION!' : 'VICTORY!') : 'DEFEAT'}</h2></div>
      <div class="modal-body">
        <p style="font-weight:800;font-size:16px">${win ? (champion ? `You won the ${esc(L.name)}!` : `Round ${this.round} of 3 won against ${esc(this.rival)}.`) : `${esc(this.rival)} was too strong this time. Level up your dinosaurs and try again!`}</p>
        <p style="font:400 22px 'Lilita One';color:#ffd479">${reward.coins ? `<i class="ic ic-coin"></i> +${fmt(reward.coins)} ` : ''}${reward.bucks ? `<i class="ic ic-buck"></i> +${reward.bucks} ` : ''}<i class="ic ic-xp"></i> +${fmt(reward.xp)}</p>
        ${amber ? `<p style="font-weight:800"><i class="ic ic-amber"></i> Bonus: you received ${esc(SPECIES[amber].name)} amber!</p>` : ''}
        <div class="btn-row" style="justify-content:center"><button class="btn btn-gold big" id="bDone" type="button">Continue</button></div>
      </div></div>`;
    const ov = el('div', 'modal', html); ov.style.zIndex = 40;
    setTimeout(() => {
      document.body.appendChild(ov);
      if (win) for (let i = 0; i < 3; i++) setTimeout(() => this.fx.push({ type: 'confetti', t: 0, parts: Array.from({ length: 50 }, () => ({ x: rand(0, this.W), y: -20, vx: rand(-60, 60), vy: rand(80, 220), c: pick(['#e0513a', '#4aa8e0', '#ffd23f', '#7dc15a']), r: rand(0, 6) })) }), i * 300);
      $('#bDone').addEventListener('click', () => { Sfx.click(); ov.remove(); this.close(); if (champion) UI.toast(`🏆 ${L.name} champion!`, 'good big'); });
    }, 1200);
    saveGame();
  },
  close() {
    this.active = false;
    $('#battle').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    Bus.emit('missions');
  },

  /* ---------- effects ---------- */
  pos(side) { const k = side === 'me' ? 0.28 : 0.72; return { x: this.W * k + this.anim[side].x, y: this.H * 0.74 }; },
  fxSlash(side) { const p = this.pos(side); this.fx.push({ type: 'slash', t: 0, x: p.x, y: p.y - this.H * 0.16 }); },
  fxBite(side) { const p = this.pos(side); this.fx.push({ type: 'bite', t: 0, x: p.x, y: p.y - this.H * 0.16 }); },
  fxImpact(side, big) { const p = this.pos(side); this.fx.push({ type: 'impact', t: 0, x: p.x, y: p.y - this.H * 0.12, big }); for (let i = 0; i < 16; i++) this.fx.push({ type: 'dust', t: 0, x: p.x + rand(-40, 40), y: p.y, vx: rand(-120, 120), vy: rand(-80, -10), r: rand(10, 24) }); },
  fxShield(side) { const p = this.pos(side); this.fx.push({ type: 'shield', t: 0, side }); },
  fxAura(side) { this.fx.push({ type: 'aura', t: 0, side }); },
  num(side, text, col, big) { const p = this.pos(side); this.nums.push({ x: p.x + rand(-20, 20), y: p.y - this.H * 0.28, text, col, t: 0, big }); },

  /* ---------- render ---------- */
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.phase === 'choose') {
      this.timer -= dt;
      $('#bTimer').style.width = (Math.max(0, this.timer) / 15 * 100) + '%';
      if (this.timer <= 0) this.choose(pick(['charge', 'bite', 'swipe']));
    }
    for (const s of ['me', 'foe']) this.anim[s].flash = Math.max(0, this.anim[s].flash - dt * 4);
    this.shake *= Math.pow(0.02, dt);
    this.draw(dt);
  },
  draw(dt) {
    const ctx = this.ctx, W = this.W, H = this.H, t = this.t;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sx = rand(-1, 1) * this.shake, sy = rand(-1, 1) * this.shake;
    ctx.save(); ctx.translate(sx, sy);
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    sky.addColorStop(0, '#f08a4a'); sky.addColorStop(0.45, '#f4c07a'); sky.addColorStop(1, '#ffe2a8');
    ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
    // sun
    const sg = ctx.createRadialGradient(W * 0.5, H * 0.34, 10, W * 0.5, H * 0.34, H * 0.3);
    sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.2, 'rgba(255,230,160,0.8)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // distant volcano & jungle
    const vg2 = ctx.createLinearGradient(W * 0.05, 0, W * 0.5, 0); vg2.addColorStop(0, '#c88a6a'); vg2.addColorStop(0.5, '#a4604a'); vg2.addColorStop(1, '#7a4636');
    ctx.fillStyle = vg2; ctx.beginPath(); ctx.moveTo(W * 0.02, H * 0.5); ctx.quadraticCurveTo(W * 0.16, H * 0.34, W * 0.22, H * 0.2); ctx.lineTo(W * 0.3, H * 0.2); ctx.quadraticCurveTo(W * 0.36, H * 0.34, W * 0.52, H * 0.5); ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,30,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x0 = W * (0.225 + i * 0.009); ctx.beginPath(); ctx.moveTo(x0, H * 0.21); ctx.quadraticCurveTo(x0 + (i - 4) * W * 0.01, H * 0.36, W * (0.08 + i * 0.045), H * 0.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,140,40,0.8)'; ctx.fillRect(W * 0.225, H * 0.195, W * 0.07, 4);
    ctx.fillStyle = 'rgba(80,40,30,0.4)'; for (let i = 0; i < 4; i++) { const k = (t * 0.05 + i / 4) % 1; ctx.beginPath(); ctx.arc(W * 0.26 + k * 40, H * 0.2 - k * H * 0.15, 10 + k * 30, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#4a6a3a';
    ctx.beginPath(); ctx.moveTo(0, H * 0.5);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.44 - Math.abs(Math.sin(x * 0.013)) * 30 - Math.sin(x * 0.05) * 8);
    ctx.lineTo(W, H * 0.5); ctx.fill();
    // arena wall with crowd
    const wallTop = H * 0.42, wallBot = H * 0.6;
    const wg = ctx.createLinearGradient(0, wallTop, 0, wallBot);
    wg.addColorStop(0, '#9a8468'); wg.addColorStop(1, '#6a5640');
    ctx.fillStyle = wg; ctx.fillRect(0, wallTop, W, wallBot - wallTop);
    // tiered stands with seated spectators (shoulders, heads, raised arms)
    const rows = 5, rh = (wallBot - wallTop - 26) / rows;
    for (let r = 0; r < rows; r++) {
      const ry = wallTop + 6 + r * rh;
      ctx.fillStyle = r % 2 ? '#8a7458' : '#7e6a50'; ctx.fillRect(0, ry + rh * 0.62, W, rh * 0.38);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, ry + rh * 0.62, W, 2);
    }
    for (const c of this.crowd) {
      const r = Math.floor(c.y * rows), cx = c.x * W, cy = wallTop + 6 + r * rh + rh * 0.62;
      const cheer = this.phase === 'end' || Math.sin(t * 6 + c.p) > 0.8;
      const jump = cheer ? Math.abs(Math.sin(t * 10 + c.p)) * 3 : 0;
      ctx.fillStyle = c.c; ctx.beginPath(); ctx.ellipse(cx, cy - 3 - jump, 5, 5, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = c.s || (c.s = pick(['#f2d0b0', '#e8b58e', '#c8905e', '#8a5a3a'])); ctx.beginPath(); ctx.arc(cx, cy - 10 - jump, 3.2, 0, TAU); ctx.fill();
      if (cheer) { ctx.strokeStyle = c.s; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 4, cy - 5 - jump); ctx.lineTo(cx - 6, cy - 14 - jump); ctx.moveTo(cx + 4, cy - 5 - jump); ctx.lineTo(cx + 6, cy - 14 - jump); ctx.stroke(); }
    }
    ctx.fillStyle = '#5a4630'; ctx.fillRect(0, wallBot - 22, W, 22);
    ctx.fillStyle = '#3a2c1c'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, wallBot - 22, 4, 22);
    // banners
    for (let i = 0; i < 6; i++) {
      const bx = W * (0.08 + i * 0.17);
      ctx.fillStyle = i % 2 ? '#c8402a' : '#e8a020';
      ctx.beginPath(); ctx.moveTo(bx - 16, wallTop - 4); ctx.lineTo(bx + 16, wallTop - 4); ctx.lineTo(bx + 16, wallTop + 40 + Math.sin(t * 2 + i) * 2); ctx.lineTo(bx, wallTop + 30); ctx.lineTo(bx - 16, wallTop + 40 + Math.sin(t * 2 + i) * 2); ctx.fill();
    }
    // torches
    for (const tx of [W * 0.03, W * 0.97]) {
      ctx.fillStyle = '#4a3020'; ctx.fillRect(tx - 5, wallTop - 20, 10, 60);
      const f = 1 + Math.sin(t * 18) * 0.1;
      const fg = ctx.createRadialGradient(tx, wallTop - 30, 2, tx, wallTop - 30, 40 * f);
      fg.addColorStop(0, 'rgba(255,240,180,1)'); fg.addColorStop(0.3, 'rgba(255,160,50,0.8)'); fg.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = fg; ctx.fillRect(tx - 50, wallTop - 80, 100, 100);
    }
    // sand floor
    const fl = ctx.createLinearGradient(0, wallBot, 0, H);
    fl.addColorStop(0, '#d8b880'); fl.addColorStop(1, '#b8904e');
    ctx.fillStyle = fl; ctx.fillRect(0, wallBot, W, H - wallBot);
    ctx.strokeStyle = 'rgba(120,80,40,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const y = wallBot + 10 + i * i * 1.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + Math.sin(i) * 6); ctx.stroke(); }
    // fighters
    const scaleBase = Math.min(W / 900, H / 620) * 1.35;
    for (const side of ['me', 'foe']) {
      const f = side === 'me' ? this.cur() : this.enemy();
      if (!f) continue;
      const A = this.anim[side], p = this.pos(side);
      const size = DinoArt.size(f.sid);
      const sc = scaleBase * clamp(260 / size.len, 0.55, 1.4) * (0.75 + 0.25 * f.sp.size);
      const pose = A.pose === 'walk' ? 'walk' : A.pose;
      DinoArt.draw(ctx, f.sid, p.x, p.y, sc, { stage: f.stage, dir: side === 'me' ? 1 : -1, t: t + (side === 'me' ? 0 : 2), pose, speed: A.pose === 'walk' ? 1 : 0, phase: t * 1.4, fly: f.sp.aviary ? 60 * sc : 0 });
      if (A.flash > 0) {
        ctx.save(); ctx.globalAlpha = A.flash * 0.7;
        DinoArt.draw(ctx, f.sid, p.x, p.y, sc, { stage: f.stage, dir: side === 'me' ? 1 : -1, t: t + (side === 'me' ? 0 : 2), pose, shadow: false, palette: P('#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'), fly: f.sp.aviary ? 60 * sc : 0 });
        ctx.restore();
      }
      // special meter pips
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < f.meter ? '#ffb13b' : 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p.x - 16 + i * 16, p.y + 22, 5, 0, TAU); ctx.fill(); }
    }
    // fx
    for (const e of this.fx) {
      e.t += dt;
      if (e.type === 'slash') {
        const k = e.t / 0.4; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(e.x - 60 + i * 22, e.y - 60); ctx.quadraticCurveTo(e.x + i * 22, e.y - 10, e.x - 20 + i * 22, e.y + 60 * Math.min(1, k * 3)); ctx.stroke(); }
      } else if (e.type === 'bite') {
        const k = e.t / 0.45, close = Math.min(1, k * 3);
        ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
        for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const x = e.x - 50 + i * 20, y = e.y + s * (50 - close * 36); ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x, y - s * 20); ctx.lineTo(x + 8, y); ctx.fill(); }
      } else if (e.type === 'impact') {
        const k = e.t / 0.5; ctx.strokeStyle = `rgba(255,230,140,${1 - k})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, (e.big ? 140 : 80) * easeOut(k), 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,200,${(1 - k) * 0.8})`;
        ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = (i % 2 ? 20 : 50) * (1 + k); ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); } ctx.fill();
      } else if (e.type === 'dust') {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 40 * dt;
        ctx.fillStyle = `rgba(200,170,120,${Math.max(0, 0.6 - e.t)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + e.t), 0, TAU); ctx.fill();
      } else if (e.type === 'shield') {
        const p = this.pos(e.side), k = e.t / 0.8;
        ctx.strokeStyle = `rgba(140,210,255,${1 - k})`; ctx.fillStyle = `rgba(100,180,255,${0.25 * (1 - k)})`; ctx.lineWidth = 4;
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.lineTo(p.x + (e.side === 'me' ? 70 : -70) + Math.cos(a) * 90, p.y - this.H * 0.14 + Math.sin(a) * 110); } ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (e.type === 'aura') {
        const p = this.pos(e.side), k = e.t / 1;
        const g = ctx.createRadialGradient(p.x, p.y - 60, 10, p.x, p.y - 60, 200);
        g.addColorStop(0, `rgba(255,200,80,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 220, p.y - 280, 440, 440);
      } else if (e.type === 'confetti') {
        for (const q of e.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 5; ctx.fillStyle = q.c; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillRect(-5, -2, 10, 4); ctx.restore(); }
      }
    }
    this.fx = this.fx.filter(e => e.t < (e.type === 'confetti' ? 4 : e.type === 'aura' ? 1 : 0.9));
    for (const n of this.nums) {
      n.t += dt; n.y -= 50 * dt;
      ctx.globalAlpha = clamp(1.4 - n.t, 0, 1);
      ctx.font = `400 ${n.big ? 44 : 32}px 'Lilita One', sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
    this.nums = this.nums.filter(n => n.t < 1.4);
    ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  },
};

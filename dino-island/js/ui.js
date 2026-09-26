'use strict';
/* ==========================================================
   UI: HUD, info panel, modals, advisor, toasts
   ========================================================== */
const UI = {
  infoObj: null, infoTimer: 0, advQueue: [], advOpen: false, modalKind: null, portraitRAF: 0,

  init() {
    $$('#toolbar .tool').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.click(); Game.toggleTool(b.dataset.tool); }));
    $('#modalClose').addEventListener('click', () => this.closeModal());
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') this.closeModal(); });
    $('#advNext').addEventListener('click', () => { Sfx.click(); this.nextAdvisor(); });
    $('#placeOk').addEventListener('click', () => Game.confirmPlace());
    $('#placeNo').addEventListener('click', () => Game.cancelPlace());
    $('#modeOk').addEventListener('click', () => Game.setMode('normal'));
    $('#modeAlt').addEventListener('click', () => Game.toggleRoadErase());
    $('#btnSettings').addEventListener('click', () => { Sfx.click(); this.settings(); });
    $('#lvlBtn').addEventListener('click', () => { Sfx.click(); this.missions(); });
    $('#zoomIn').addEventListener('click', () => Input.zoomAt(Render.W / 2, Render.H / 2, 1.25));
    $('#zoomOut').addEventListener('click', () => Input.zoomAt(Render.W / 2, Render.H / 2, 0.8));
    Bus.on('change', () => this.hudDirty = true);
    Bus.on('missions', () => this.renderTracker());
    Bus.on('lack', res => this.lack(res));
  },

  /* ---------- HUD ---------- */
  hud() {
    const set = (id, v) => { const e = $(id); const s = fmt(v); if (e.textContent !== s) e.textContent = s; };
    set('#rCoins', G.coins); set('#rBucks', G.bucks); set('#rCrops', G.crops); set('#rMeat', G.meat); set('#rAmber', amberCount());
    set('#rVisitors', Entities.visitors.length);
    $('#rStars').textContent = '★'.repeat(parkStars());
    $('#lvlNum').textContent = G.level;
    const need = xpForLevel(G.level);
    $('#xpText').textContent = `${fmt(G.xp)} / ${fmt(need)} XP`;
    $('#xpRing').style.strokeDashoffset = 119.4 * (1 - G.xp / need);
    $('#parkName').textContent = G.parkName;
    const labReady = (G.lab && now() >= G.lab.end) || (!G.lab && amberCount() > 0);
    $('#labBadge').classList.toggle('hidden', !labReady);
    const misReady = G.missions.active.some(id => missionDone(missionById(id)));
    $('#misBadge').classList.toggle('hidden', !misReady);
    this.hudDirty = false;
  },
  clock() {
    const h = World.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    const icon = World.night > 0.5 ? '🌙' : Render.weather.rain > 0.4 ? '🌧' : '☀️';
    $('#clock').textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  },
  bump(res) { const el = $('.res.' + res); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
  lack(res) {
    const el = $('.res.' + (res || 'coins')); if (el) { el.classList.remove('lack'); void el.offsetWidth; el.classList.add('lack'); }
    Sfx.error();
    const names = { coins: 'coins', bucks: 'Dino Bucks', crops: 'crops', meat: 'meat' };
    this.toast(`Not enough ${names[res] || res}!`, 'err');
  },
  toast(msg, cls = '', ms = 2600) {
    const t = el('div', 'toast ' + cls, msg);
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  },
  fly(res, sx, sy, n = 5) {
    const map = { coins: 'ic-coin', bucks: 'ic-buck', crops: 'ic-crop', meat: 'ic-meat', xp: 'ic-xp', amber: 'ic-amber' };
    const target = res === 'xp' ? $('#lvlBtn') : $('.res.' + res);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const tx = r.left + 18, ty = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const f = el('i', 'fly ic ' + map[res]);
      f.style.left = sx + 'px'; f.style.top = sy + 'px';
      $('#flyLayer').appendChild(f);
      const dx = rand(-40, 40), dy = rand(-60, -20);
      const anim = f.animate([
        { transform: 'translate(0,0) scale(0.6)', opacity: 0 },
        { transform: `translate(${dx}px,${dy}px) scale(1.2)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${tx - sx}px,${ty - sy}px) scale(0.7)`, opacity: 0.9 },
      ], { duration: 700 + i * 70, easing: 'cubic-bezier(.5,0,.6,1)', delay: i * 40 });
      anim.onfinish = () => { f.remove(); if (i === 0) this.bump(res === 'xp' ? 'none' : res); };
    }
  },
  levelUp(level, reward) {
    const unlocks = [];
    for (const id of SPECIES_ORDER) if (SPECIES[id].level === level) unlocks.push(SPECIES[id].name);
    for (const id of BUILD_ORDER) if (BUILDINGS[id].level === level) unlocks.push(BUILDINGS[id].name);
    for (const id of DECO_ORDER) if (DECOS[id].level === level) unlocks.push(DECOS[id].name);
    const lu = el('div', 'levelup', `<div class="lu-box"><h2>LEVEL ${level}!</h2><p>+${reward.bucks} Dino Bucks · +${fmt(reward.coins)} coins</p>${unlocks.length ? `<p style="font-size:18px;margin-top:8px;color:#d9f5b0">Unlocked: ${esc(unlocks.join(', '))}</p>` : ''}</div>`);
    document.body.appendChild(lu);
    setTimeout(() => lu.remove(), 2900);
    Sfx.levelUp();
    const c = Render.s2w(Render.W / 2, Render.H / 2);
    Entities.emit(c.x, c.y - 40, 'confetti', 60);
  },

  /* ---------- mission tracker ---------- */
  renderTracker() {
    const box = $('#missionTracker');
    box.innerHTML = '';
    for (const id of G.missions.active) {
      const m = missionById(id);
      const p = missionProgress(m), tgt = missionTarget(m), done = p >= tgt;
      const card = el('div', 'm-card' + (done ? ' done' : ''), `
        <div class="m-ico"><i class="ic ${goalIcon(m.goal.type)}"></i></div>
        <div class="m-txt"><div class="m-title">${esc(m.title)}</div>
        <div class="m-goal">${done ? 'Complete! Tap to claim' : esc(goalText(m))} ${done ? '' : `· ${fmt(p)}/${fmt(tgt)}`}</div>
        <div class="m-bar"><i style="width:${Math.round(100 * p / tgt)}%"></i></div></div>`);
      card.addEventListener('click', () => {
        Sfx.click();
        if (missionDone(m)) { claimMission(m.id); this.toast(`Mission complete: ${esc(m.title)}`, 'good big'); const r = card.getBoundingClientRect(); if (m.reward.coins) this.fly('coins', r.left + 30, r.top + 20, 6); if (m.reward.bucks) this.fly('bucks', r.left + 30, r.top + 20, 3); if (m.reward.xp) this.fly('xp', r.left + 30, r.top + 20, 3); }
        else { this.advisor(m.who, m.text); Game.hintFor(m); }
      });
      box.appendChild(card);
    }
  },

  /* ---------- advisor ---------- */
  advisor(who, text, cb) {
    this.advQueue.push({ who, text, cb });
    if (!this.advOpen) this.nextAdvisor(true);
  },
  nextAdvisor(first) {
    const cur = this.advCur;
    if (!first && cur && cur.cb) cur.cb();
    const n = this.advQueue.shift();
    this.advCur = n;
    if (!n) { $('#advisor').classList.add('hidden'); this.advOpen = false; return; }
    const ch = CHARS[n.who];
    $('#advPortrait').innerHTML = portraitSVG(n.who);
    $('#advName').textContent = `${ch.name} · ${ch.role}`;
    $('#advText').textContent = n.text;
    const box = $('#advisor'); box.classList.remove('hidden');
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    this.advOpen = true;
    Sfx.open();
  },

  /* ---------- info panel ---------- */
  showInfo(ref) {
    this.infoObj = ref;
    Render.selected = ref.kind === 'obs' ? null : ref;
    this.renderInfo();
    $('#info').classList.remove('hidden'); document.body.classList.add('info-open');
    const p = $('#info'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  },
  hideInfo() {
    this.infoObj = null; Render.selected = null;
    $('#info').classList.add('hidden'); document.body.classList.remove('info-open');
    cancelAnimationFrame(this.portraitRAF);
  },
  refreshInfo(dt) {
    if (!this.infoObj) return;
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) { this.infoTimer = 0.5; this.renderInfo(true); }
  },
  renderInfo(soft) {
    const ref = this.infoObj;
    if (!ref) return;
    if (ref.kind === 'obs') return this.infoObstacle(ref, soft);
    if (!G.objects.includes(ref)) return this.hideInfo();
    if (ref.type === 'paddock') return this.infoDino(ref, soft);
    if (ref.type === 'deco') return this.infoDeco(ref, soft);
    return this.infoBuilding(ref, soft);
  },
  setInfo(html, soft, key) {
    const box = $('#info');
    // avoid rebuilding while the pointer is over a button (keeps clicks reliable)
    if (soft && box.dataset.key === key && box.matches(':hover')) { this.patchInfo(html); return; }
    box.dataset.key = key;
    box.innerHTML = `<button class="x" type="button" aria-label="Close">✖</button>` + html;
    box.querySelector('.x').addEventListener('click', () => { Sfx.close(); this.hideInfo(); });
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { Sfx.click(); Game.action(b.dataset.act, this.infoObj, b); e.stopPropagation(); }));
  },
  patchInfo(html) {
    // update only dynamic text parts
    const tmp = el('div', '', html);
    $$('[data-live]', $('#info')).forEach(n => { const m = tmp.querySelector(`[data-live="${n.dataset.live}"]`); if (m && n.innerHTML !== m.innerHTML) n.innerHTML = m.innerHTML; });
  },
  infoDino(o, soft) {
    const sp = SPECIES[o.species], nowT = now();
    const egg = o.hatchEnd > nowT;
    const st = o.stage || 0;
    const stats = dinoStats(sp, o.level, st);
    const cap = dinoCap(o);
    const food = sp.diet === 'herb' ? 'crops' : 'meat';
    const cost = feedCost(o);
    let body = '';
    if (egg) {
      const left = o.hatchEnd - nowT, k = 1 - left / (o.hatchEnd - o.hatchStart);
      body = `<p class="note">The egg is incubating under warm lamps. A baby ${esc(sp.name)} will hatch soon!</p>
        <div class="progress" data-live="egg"><i style="width:${Math.round(k * 100)}%"></i><span>Hatching · ${fmtTime(left)}</span></div>
        <div class="btn-row"><button class="btn btn-green" data-act="hatchNow" type="button">Hatch now · <i class="ic ic-buck"></i>${speedCost(left)}</button></div>`;
    } else {
      const stageCap = maxLevelForStage(st);
      const atCap = o.level >= stageCap;
      const canEvolve = atCap && st < 3 && (G.stageResearch[o.species] || 0) >= st + 1;
      const pips = Array.from({ length: FEEDS_PER_LEVEL }, (_, i) => `<i class="${i < o.feeds ? 'on' : ''}"></i>`).join('');
      let feedBtn;
      if (o.level >= MAX_LEVEL) feedBtn = `<button class="btn btn-gold" disabled type="button">Max level</button>`;
      else if (canEvolve) feedBtn = `<button class="btn btn-blue" data-act="evolve" type="button">★ Evolve to ${STAGE_NAMES[st + 1]}</button>`;
      else if (atCap) feedBtn = `<button class="btn btn-blue" data-act="openLab" type="button">Research ${STAGE_NAMES[st + 1]} in Lab</button>`;
      else feedBtn = `<button class="btn btn-green" data-act="feed" type="button">Feed · <i class="ic ic-${food === 'crops' ? 'crop' : 'meat'}"></i>${fmt(cost)}</button>`;
      body = `
        <div class="lvl-track"><div class="row"><span>Level ${o.level}${isAdult(o) ? ' · Adult' : ' · Juvenile'}</span><span>${o.level >= MAX_LEVEL ? 'MAX' : atCap ? 'Evolve!' : `Feedings ${o.feeds}/${FEEDS_PER_LEVEL}`}</span></div><div class="pips" data-live="pips">${pips}</div></div>
        <div class="stage-row">${STAGE_NAMES.map((n, i) => `<span class="${i <= st ? 'on' : ''}">${n}</span>`).join('')}</div>
        <div class="stat-grid" data-live="stats">
          <div class="stat"><i class="ic ic-coin"></i><span><b>${fmt(dinoRate(o))}</b>/min</span></div>
          <div class="stat"><i class="ic ic-coin"></i><span><b>${fmt(o.coins)}</b> / ${fmt(cap)}</span></div>
          <div class="stat">❤ <span>HP <b>${stats.hp}</b></span></div>
          <div class="stat">⚔ <span>ATK <b>${stats.atk}</b></span></div>
          <div class="stat"><i class="ic ic-${sp.weak === 'charge' ? 'charge' : sp.weak === 'bite' ? 'bite' : 'swipe'}"></i><span>Weak: <b>${ATTACKS[sp.weak]}</b></span></div>
          <div class="stat"><i class="ic ic-xp"></i><span>Bonus <b>+${o.bonus || 0}%</b></span></div>
        </div>
        <div class="btn-row primary">
          <button class="btn btn-gold" data-act="collect" type="button" ${o.coins < 1 ? 'disabled' : ''}>Collect <i class="ic ic-coin"></i>${fmt(o.coins)}</button>
          ${feedBtn}
        </div>`;
    }
    const html = `<h3>${esc(sp.name)}</h3>
      <div class="sub"><span class="rarity ${sp.rarity}">${RARITY[sp.rarity].name.toUpperCase()}</span><i class="ic ic-${sp.diet === 'herb' ? 'herb' : 'carn'}"></i>${sp.diet === 'herb' ? 'Herbivore' : 'Carnivore'} · ${STAGE_NAMES[st]}</div>
      <canvas class="portrait" id="portrait" width="592" height="300"></canvas>
      ${body}
      <div class="btn-row">
        ${egg ? '' : '<button class="btn btn-wood btn-small" data-act="roar" type="button">🔊 Roar</button>'}
        <button class="btn btn-wood btn-small" data-act="move" type="button">Move</button>
        <button class="btn btn-red btn-small" data-act="sell" type="button">Sell</button>
      </div>`;
    const key = 'dino' + o.id + (egg ? 'e' : '') + o.level + '-' + o.feeds + '-' + st + (o.coins < 1 ? 'z' : 'c');
    const box = $('#info');
    if (soft && box.dataset.key === key) { this.patchInfo(html); return; }
    this.setInfo(html, false, key);
    this.animatePortrait(o);
  },
  animatePortrait(o) {
    cancelAnimationFrame(this.portraitRAF);
    const cv = $('#portrait'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const sp = SPECIES[o.species];
    const sz = DinoArt.size(o.species);
    const loop = () => {
      if (!document.body.contains(cv) || this.infoObj !== o) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      const t = performance.now() / 1000;
      const nowT = now();
      if (o.hatchEnd > nowT) {
        ctx.setTransform(2, 0, 0, 2, 0, 0);
        drawSprite(ctx, Sprites.misc.nest, 148, 118, 1.6);
        ctx.save(); ctx.translate(148, 112); ctx.scale(1.6, 1.6); ctx.rotate(Math.sin(t * 6) * 0.06);
        const pal = sp.pals[0];
        const g = ctx.createRadialGradient(-5, -22, 2, 0, -14, 18); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, mix('#f0e6d0', pal.base, 0.25)); g.addColorStop(1, mix('#b8a888', pal.dark, 0.3));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -30); ctx.bezierCurveTo(12, -30, 14, -6, 11, -2); ctx.quadraticCurveTo(0, 4, -11, -2); ctx.bezierCurveTo(-14, -6, -12, -30, 0, -30); ctx.fill();
        ctx.restore();
      } else {
        const a = Entities.dinos.get(o.id);
        const growth = a ? a.growth() : 1;
        const s = Math.min(270 / (sz.len * growth), 120 / (sz.h * growth + 30)) * 2;
        const pose = a && a.pose === 'roar' ? 'roar' : a && a.pose === 'sleep' ? 'sleep' : 'idle';
        DinoArt.draw(ctx, o.species, 296 + (DinoArt.PLANS[sp.body] ? (DinoArt.PLANS[sp.body].tailLen - DinoArt.PLANS[sp.body].bodyLen - DinoArt.PLANS[sp.body].neckLen * 0.5) * s * growth * 0.4 : 0), sp.aviary ? 250 : 285, s, { stage: o.stage || 0, t, pose, growth, fly: sp.aviary ? 40 : 0 });
      }
      this.portraitRAF = requestAnimationFrame(loop);
    };
    loop();
  },
  infoBuilding(o, soft) {
    const b = BUILDINGS[o.def], nowT = now();
    let body = '', key = 'b' + o.id;
    if (b.kind === 'shop' || b.kind === 'center') {
      const el2 = nowT - o.start, per = b.period * 1000, ready = el2 >= per;
      body = `<div class="stat-grid"><div class="stat"><i class="ic ic-coin"></i><span><b>${fmt(shopIncome(o))}</b> per ${fmtTime(per)}</span></div><div class="stat"><i class="ic ic-xp"></i><span>Bonus <b>+${o.bonus || 0}%</b></span></div></div>
        <div class="progress" data-live="shop"><i style="width:${Math.min(100, Math.round(el2 / per * 100))}%"></i><span>${ready ? 'Ready to collect!' : fmtTime(per - el2)}</span></div>
        <div class="btn-row"><button class="btn btn-gold" data-act="collectShop" type="button" ${ready ? '' : 'disabled'}>Collect <i class="ic ic-coin"></i>${fmt(shopIncome(o))}</button></div>`;
      key += ready ? 'r' : 'w';
    } else if (b.kind === 'harbor') {
      const food = b.food, icon = food === 'crops' ? 'ic-crop' : 'ic-meat';
      if (!o.order) {
        body = `<p class="note">Order a shipment of ${food}. Bigger ships take longer but deliver much more.</p><div class="order-list">` +
          HARBOR_ORDERS.map((h, i) => `<div class="order"><i class="ic ${icon}"></i><div class="o-name">${h.name}<small>+${fmt(h.amount)} ${food} · ${fmtTime(h.time * 1000)}</small></div><button class="btn btn-gold btn-small" data-act="order${i}" type="button"><i class="ic ic-coin"></i>${fmt(harborOrderCost(o, i))}</button></div>`).join('') + '</div>';
        key += 'idle';
      } else if (nowT >= o.order.end) {
        body = `<p class="note">The ${HARBOR_ORDERS[o.order.idx].name} has docked!</p><div class="btn-row"><button class="btn btn-green" data-act="collectFood" type="button">Collect <i class="ic ${icon}"></i>${fmt(o.order.amount)}</button></div>`;
        key += 'done';
      } else {
        const left = o.order.end - nowT;
        body = `<p class="note">${HARBOR_ORDERS[o.order.idx].name} on its way with ${fmt(o.order.amount)} ${food}.</p>
          <div class="progress" data-live="ship"><i style="width:${Math.round((nowT - o.order.start) / (o.order.end - o.order.start) * 100)}%"></i><span>${fmtTime(left)}</span></div>
          <div class="btn-row"><button class="btn btn-green" data-act="rushFood" type="button">Rush · <i class="ic ic-buck"></i>${speedCost(left)}</button></div>`;
        key += 'run';
      }
    } else if (b.kind === 'lab') {
      body = `<p class="note">Our scientists extract dinosaur DNA from amber and research evolutions.</p>` +
        (G.lab ? `<div class="progress" data-live="lab"><i style="width:${Math.round(clamp((nowT - G.lab.start) / (G.lab.end - G.lab.start), 0, 1) * 100)}%"></i><span>${nowT >= G.lab.end ? 'Done!' : fmtTime(G.lab.end - nowT)}</span></div>` : '') +
        `<div class="btn-row"><button class="btn btn-blue" data-act="openLab" type="button">Open Lab</button></div>`;
    } else if (b.kind === 'arena') {
      body = `<p class="note">Rival parks are waiting. Choose your fighters and climb the leagues!</p><div class="btn-row"><button class="btn btn-red" data-act="openArena" type="button">Enter Arena</button></div>`;
    } else if (b.kind === 'gate') {
      body = `<p class="note">${esc(b.desc)}</p><div class="stat-grid"><div class="stat"><i class="ic ic-visitor"></i><span><b>${Entities.visitors.length}</b> guests</span></div><div class="stat">★ <span>Rating <b>${parkStars()}</b>/5</span></div></div><p class="note">More species, decorations and shops attract more guests. Guests need roads!</p>`;
    }
    const html = `<h3>${esc(b.name)}</h3><div class="sub">${esc(b.desc)}</div>
      <canvas class="portrait" id="bport" width="592" height="300"></canvas>${body}
      <div class="btn-row">${b.noSell ? '' : '<button class="btn btn-wood btn-small" data-act="move" type="button">Move</button><button class="btn btn-red btn-small" data-act="sell" type="button">Sell</button>'}${o.def === 'lab' || o.def === 'visitor_center' ? '<button class="btn btn-wood btn-small" data-act="move" type="button">Move</button>' : ''}</div>`;
    const box = $('#info');
    if (soft && box.dataset.key === key) { this.patchInfo(html); return; }
    this.setInfo(html, false, key);
    spriteThumb($('#bport'), Sprites.buildings[o.def]);
  },
  infoDeco(o) {
    const d = DECOS[o.def];
    const html = `<h3>${esc(d.name)}</h3><div class="sub">Decoration</div><canvas class="portrait" id="bport" width="592" height="300"></canvas>
      <p class="note">Boosts the income of every dinosaur and shop within ${DECO_RADIUS} tiles by <b>+${d.bonus}%</b>.</p>
      <div class="btn-row"><button class="btn btn-wood btn-small" data-act="move" type="button">Move</button><button class="btn btn-red btn-small" data-act="sell" type="button">Sell</button></div>`;
    this.setInfo(html, false, 'd' + o.id);
    spriteThumb($('#bport'), Sprites.decos[o.def]);
  },
  infoObstacle(ref, soft) {
    const i = World.idx(ref.x, ref.y), k = World.obs[i];
    if (!k) return this.hideInfo();
    const kind = OBS_KIND[k];
    const names = { tree: 'Jungle Tree', palm: 'Palm Tree', bush: 'Thicket', rock: 'Boulder', bigrock: 'Rock Formation' };
    const job = G.clearing.find(c => c.i === i);
    let body;
    if (job) {
      const left = job.end - now();
      body = `<div class="progress" data-live="clr"><i style="width:${Math.round(clamp((now() - job.start) / (job.end - job.start), 0, 1) * 100)}%"></i><span>Clearing · ${fmtTime(left)}</span></div>
        <div class="btn-row"><button class="btn btn-green" data-act="rushClear" type="button">Finish now · <i class="ic ic-buck"></i>${speedCost(left)}</button></div>`;
    } else {
      body = `<p class="note">Clear this ${names[kind].toLowerCase()} to make room for your park. Workers sometimes discover <b>amber</b>!</p>
        <div class="stat-grid"><div class="stat"><i class="ic ic-clock"></i><span><b>${fmtTime(clearTime(kind))}</b></span></div><div class="stat"><i class="ic ic-xp"></i><span>+<b>${CLEAR[kind].xp}</b> XP</span></div></div>
        <div class="btn-row"><button class="btn btn-gold" data-act="clear" type="button">Clear · <i class="ic ic-coin"></i>${fmt(clearCost(kind))}</button></div>
        <p class="note">Workers busy: ${G.clearing.length} / ${maxWorkers()}</p>`;
    }
    const html = `<h3>${names[kind]}</h3><div class="sub">Obstacle</div>${body}`;
    const key = 'o' + i + (job ? 'j' : '');
    const box = $('#info');
    if (soft && box.dataset.key === key) { this.patchInfo(html); return; }
    this.setInfo(html, false, key);
  },

  /* ---------- modal framework ---------- */
  modalOpen() { return !$('#modal').classList.contains('hidden'); },
  openModal(kind, title, tabs, active, render) {
    this.modalKind = kind;
    $('#modalTitle').textContent = title;
    const tb = $('#modalTabs'); tb.innerHTML = '';
    (tabs || []).forEach(([id, label]) => {
      const b = el('button', 'tab' + (id === active ? ' on' : ''), label); b.type = 'button';
      b.addEventListener('click', () => { Sfx.click(); $$('.tab', tb).forEach(x => x.classList.remove('on')); b.classList.add('on'); render(id); });
      tb.appendChild(b);
    });
    $('#modal').classList.remove('hidden');
    render(active);
    Sfx.open();
  },
  closeModal() { if (!this.modalOpen()) return; $('#modal').classList.add('hidden'); this.modalKind = null; Sfx.close(); Game.refreshToolbar(); },
  body() { return $('#modalBody'); },

  /* ---------- market ---------- */
  market(tab = 'dinos') {
    this.openModal('market', 'Market', [['dinos', 'Dinosaurs'], ['buildings', 'Buildings'], ['decos', 'Decorations']], tab, t => this.renderMarket(t));
  },
  renderMarket(tab) {
    const box = this.body(); box.innerHTML = '';
    const grid = el('div', 'cards'); box.appendChild(grid);
    if (tab === 'dinos') {
      for (const id of SPECIES_ORDER) {
        const sp = SPECIES[id];
        const lvLock = G.level < sp.level, dnaLock = !G.decoded[id] && !sp.cost.bucks;
        const owned = G.objects.filter(o => o.species === id).length;
        const card = el('div', 'card' + (lvLock || dnaLock ? ' locked' : ''), `
          <div class="thumb"></div>
          ${owned ? `<span class="owned">Owned ${owned}</span>` : ''}
          <h4>${esc(sp.name)}</h4>
          <div class="meta"><span class="rarity ${sp.rarity}">${RARITY[sp.rarity].name}</span><i class="ic ic-${sp.diet === 'herb' ? 'herb' : 'carn'}"></i>${sp.pad}×${sp.pad} · ${fmt(sp.income)}/min</div>
          <div class="desc">${esc(sp.fact)}</div>
          ${lvLock ? `<div class="lockmsg"><i class="ic ic-lock"></i>Level ${sp.level}</div>` : dnaLock ? `<div class="lockmsg"><i class="ic ic-amber"></i>Needs DNA</div>` : ''}
          <button class="btn ${sp.cost.bucks ? 'btn-green' : 'btn-gold'}" type="button" ${lvLock || dnaLock ? 'disabled' : ''}>${costLabel(sp.cost)}</button>`);
        const th = DinoArt.thumb(id, 0, 160, 106);
        const cv = makeCanvas(th.width, th.height); cv.getContext('2d').drawImage(th, 0, 0); cv.style.width = '160px';
        card.querySelector('.thumb').appendChild(cv);
        card.querySelector('button').addEventListener('click', () => { if (!canAfford(sp.cost)) return Bus.emit('lack', sp.cost.bucks ? 'bucks' : 'coins'); Sfx.click(); this.closeModal(); Game.startPlace('paddock', id); });
        if (dnaLock && !lvLock) card.querySelector('.desc').textContent = 'Find amber while clearing the jungle, then decode it in the Genetics Lab.';
        grid.appendChild(card);
      }
    } else if (tab === 'buildings') {
      for (const id of BUILD_ORDER) {
        const b = BUILDINGS[id];
        const lvLock = G.level < b.level, built = b.unique && countDef(id) > 0;
        const card = el('div', 'card' + (lvLock ? ' locked' : ''), `
          <div class="thumb"></div>
          <h4>${esc(b.name)}</h4>
          <div class="meta">${b.size[0]}×${b.size[1]}${b.income ? ` · <i class="ic ic-coin"></i>${fmt(b.income)} / ${fmtTime(b.period * 1000)}` : ''}</div>
          <div class="desc">${esc(b.desc)}</div>
          ${lvLock ? `<div class="lockmsg"><i class="ic ic-lock"></i>Level ${b.level}</div>` : ''}
          <button class="btn btn-gold" type="button" ${lvLock || built ? 'disabled' : ''}>${built ? 'Built' : costLabel(b.cost)}</button>`);
        const cv = makeCanvas(320, 220); spriteThumb(cv, Sprites.buildings[id]); cv.style.width = '160px';
        card.querySelector('.thumb').appendChild(cv);
        card.querySelector('button').addEventListener('click', () => { if (!canAfford(b.cost)) return Bus.emit('lack', 'coins'); Sfx.click(); this.closeModal(); Game.startPlace('building', id); });
        grid.appendChild(card);
      }
    } else {
      for (const id of DECO_ORDER) {
        const d = DECOS[id];
        const lvLock = G.level < d.level;
        const card = el('div', 'card' + (lvLock ? ' locked' : ''), `
          <div class="thumb"></div>
          <h4>${esc(d.name)}</h4>
          <div class="meta">${d.size[0]}×${d.size[1]} · +${d.bonus}% nearby</div>
          ${lvLock ? `<div class="lockmsg"><i class="ic ic-lock"></i>Level ${d.level}</div>` : ''}
          <button class="btn ${d.cost.bucks ? 'btn-green' : 'btn-gold'}" type="button" ${lvLock ? 'disabled' : ''}>${costLabel(d.cost)}</button>`);
        const cv = makeCanvas(320, 220); spriteThumb(cv, Sprites.decos[id]); cv.style.width = '160px';
        card.querySelector('.thumb').appendChild(cv);
        card.querySelector('button').addEventListener('click', () => { if (!canAfford(d.cost)) return Bus.emit('lack', d.cost.bucks ? 'bucks' : 'coins'); Sfx.click(); this.closeModal(); Game.startPlace('deco', id); });
        grid.appendChild(card);
      }
    }
  },

  /* ---------- lab ---------- */
  lab() {
    if (!countDef('lab')) return this.toast('You need a Genetics Lab first.', 'err');
    this.openModal('lab', 'Genetics Lab', null, null, () => this.renderLab());
  },
  renderLab() {
    const box = this.body(); box.innerHTML = '';
    const nowT = now();
    const cur = el('div', 'list');
    box.appendChild(el('div', 'section-title', '🧬 Current research'));
    if (G.lab) {
      const t = G.lab, done = nowT >= t.end;
      const name = t.type === 'decode' ? `Decoding ${SPECIES[t.species].name} DNA` : `${SPECIES[t.species].name} · ${STAGE_NAMES[t.stage]}`;
      const r = el('div', 'row-card', `<div class="rc-thumb"></div><div class="rc-main"><h4>${esc(name)}</h4>
        <div class="progress"><i style="width:${Math.round(clamp((nowT - t.start) / (t.end - t.start), 0, 1) * 100)}%"></i><span>${done ? 'Complete!' : fmtTime(t.end - nowT)}</span></div></div>
        ${done ? '<button class="btn btn-green" type="button">Claim</button>' : `<button class="btn btn-green" type="button">Finish · <i class="ic ic-buck"></i>${speedCost(t.end - nowT)}</button>`}`);
      r.querySelector('.rc-thumb').appendChild(thumbCanvas(t.species, t.type === 'decode' ? 0 : t.stage, 96, 70));
      r.querySelector('button').addEventListener('click', () => { if (done) Game.claimLab(); else Game.rushLab(); this.renderLab(); });
      cur.appendChild(r);
    } else cur.appendChild(el('div', 'empty', 'The lab is idle. Start decoding amber or researching an evolution below.'));
    box.appendChild(cur);

    box.appendChild(el('div', 'section-title', '<i class="ic ic-amber"></i> Amber collection'));
    const al = el('div', 'list');
    const ambers = Object.keys(G.amber).filter(k => G.amber[k] > 0);
    if (!ambers.length) al.appendChild(el('div', 'empty', 'No amber yet. Clear trees and rocks in the jungle – workers sometimes find amber with ancient DNA!'));
    for (const sid of ambers) {
      const sp = SPECIES[sid], c = decodeCost(sid);
      const r = el('div', 'row-card', `<div class="rc-thumb"></div><div class="rc-main"><h4>${esc(sp.name)} amber ×${G.amber[sid]}</h4><p>Decode the DNA to unlock ${esc(sp.name)} in the Market. Takes ${fmtTime(c.time * 1000)}.</p></div>
        <button class="btn btn-gold" type="button" ${G.lab ? 'disabled' : ''}>Decode · <i class="ic ic-coin"></i>${fmt(c.coins)}</button>`);
      const th = thumbCanvas(sid, 0, 96, 70); th.style.filter = 'sepia(1) saturate(2.4) hue-rotate(-12deg) brightness(.9)';
      r.querySelector('.rc-thumb').appendChild(th);
      r.querySelector('button').addEventListener('click', () => { Game.startDecode(sid); this.renderLab(); });
      al.appendChild(r);
    }
    box.appendChild(al);

    box.appendChild(el('div', 'section-title', '★ Evolution research'));
    const el2 = el('div', 'list');
    const owned = [...ownedSpecies()];
    if (!owned.length) el2.appendChild(el('div', 'empty', 'Buy dinosaurs to research their evolutions.'));
    for (const sid of owned) {
      const sp = SPECIES[sid], have = G.stageResearch[sid] || 0;
      if (have >= 3) { el2.appendChild(el('div', 'row-card done', `<div class="rc-main"><h4>${esc(sp.name)}</h4><p>All evolutions researched – Apex unlocked!</p></div>`)); continue; }
      const next = have + 1, c = evolveCost(sid, next);
      const best = Math.max(...G.objects.filter(o => o.species === sid).map(o => o.level));
      const need = STAGE_LEVELS[next - 1] - 3;
      const ok = best >= need;
      const r = el('div', 'row-card', `<div class="rc-thumb"></div><div class="rc-main"><h4>${esc(sp.name)} → ${STAGE_NAMES[next]}</h4><p>${ok ? `New colors, +50% income and +35% battle power. Takes ${fmtTime(c.time * 1000)}.` : `Requires a ${esc(sp.name)} of level ${need}+ (best: ${best}).`}</p></div>
        <button class="btn btn-blue" type="button" ${G.lab || !ok ? 'disabled' : ''}>Research · <i class="ic ic-coin"></i>${fmt(c.coins)}</button>`);
      r.querySelector('.rc-thumb').appendChild(thumbCanvas(sid, next, 96, 70));
      r.querySelector('button').addEventListener('click', () => { Game.startEvolveResearch(sid, next); this.renderLab(); });
      el2.appendChild(r);
    }
    box.appendChild(el2);
  },

  /* ---------- missions ---------- */
  missions() {
    this.openModal('missions', 'Missions', null, null, () => {
      const box = this.body(); box.innerHTML = '';
      const list = el('div', 'list');
      box.appendChild(el('div', 'section-title', 'Active missions'));
      if (!G.missions.active.length) list.appendChild(el('div', 'empty', 'All missions complete – you built a legendary park! Keep growing and battling.'));
      for (const id of G.missions.active) {
        const m = missionById(id), p = missionProgress(m), tgt = missionTarget(m), done = p >= tgt;
        const r = m.reward;
        const row = el('div', 'row-card' + (done ? ' done' : ''), `<div class="rc-thumb" style="background:none">${portraitSVG(m.who)}</div>
          <div class="rc-main"><h4>${esc(m.title)}</h4><p>${esc(m.text)}</p>
          <div class="progress"><i style="width:${Math.round(100 * p / tgt)}%"></i><span>${fmt(p)} / ${fmt(tgt)}</span></div>
          <p>Reward: ${r.coins ? `<i class="ic ic-coin"></i>${fmt(r.coins)} ` : ''}${r.bucks ? `<i class="ic ic-buck"></i>${r.bucks} ` : ''}${r.xp ? `<i class="ic ic-xp"></i>${fmt(r.xp)}` : ''}</p></div>
          ${done ? '<button class="btn btn-green" type="button">Claim</button>' : '<button class="btn btn-wood btn-small" type="button">Show me</button>'}`);
        row.querySelector('button').addEventListener('click', () => { if (done) { claimMission(id); this.missions(); } else { this.closeModal(); Game.hintFor(m); } });
        list.appendChild(row);
      }
      box.appendChild(list);
      box.appendChild(el('p', 'note', `Missions completed: ${G.stats.missionsDone || 0}. After the story missions, new ranger jobs keep coming.`));
    });
  },

  /* ---------- dinopedia ---------- */
  dinopedia() {
    this.openModal('pedia', 'Dinopedia', null, null, () => {
      const box = this.body(); box.innerHTML = '';
      const grid = el('div', 'cards');
      for (const id of SPECIES_ORDER) {
        const sp = SPECIES[id];
        const known = G.decoded[id] || ownedSpecies().has(id);
        const weakKnown = ownedSpecies().has(id) || (G.pedia[id] && G.pedia[id].weak);
        const st = dinoStats(sp, 1, 0);
        const card = el('div', 'card' + (known ? '' : ' locked'), `
          <div class="thumb"></div>
          <h4>${known ? esc(sp.name) : '???'}</h4>
          <div class="meta"><span class="rarity ${sp.rarity}">${RARITY[sp.rarity].name}</span>${known ? `${esc(sp.era)} · ${esc(sp.len)}` : ''}</div>
          <div class="desc">${known ? esc(sp.fact) : 'Undiscovered species. Find its amber in the jungle.'}</div>
          <div class="meta">❤ ${st.hp} · ⚔ ${st.atk} · Weak: ${weakKnown ? ATTACKS[sp.weak] : '?'}</div>`);
        const th = thumbCanvas(id, 0, 160, 106);
        if (!known) th.style.filter = 'brightness(0) opacity(.55)';
        card.querySelector('.thumb').appendChild(th);
        grid.appendChild(card);
      }
      box.appendChild(grid);
    });
  },

  /* ---------- settings ---------- */
  settings() {
    this.openModal('settings', 'Settings', null, null, () => {
      const s = G.settings, box = this.body();
      box.innerHTML = `
        <div class="settings-row"><span>Park name</span><input id="setName" maxlength="22" value="${esc(G.parkName)}" style="font:800 15px Nunito;padding:6px 10px;border-radius:10px;border:2px solid #6b4424;width:200px"></div>
        <div class="settings-row"><span>Volume</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${s.vol}"></div>
        <div class="settings-row"><span>Music</span><button class="toggle ${s.music ? 'on' : ''}" id="setMusic" type="button" aria-label="Music"></button></div>
        <div class="settings-row"><span>Jungle ambience</span><button class="toggle ${s.ambience ? 'on' : ''}" id="setAmb" type="button" aria-label="Ambience"></button></div>
        <div class="settings-row"><span>Day / night cycle</span><button class="toggle ${s.daynight ? 'on' : ''}" id="setDay" type="button" aria-label="Day night"></button></div>
        <div class="settings-row"><span>High quality lighting</span><button class="toggle ${s.quality === 'high' ? 'on' : ''}" id="setQ" type="button" aria-label="Quality"></button></div>
        <div class="settings-row"><span>Controls</span><span style="font-weight:700;font-size:13px;opacity:.85;text-align:right">Drag to pan · Wheel / pinch to zoom · WASD pan<br>R roads · M market · L lab · Esc cancel</span></div>
        <div class="settings-row"><span>Reset park</span><button class="btn btn-red btn-small" id="setReset" type="button">Start over</button></div>`;
      $('#setName').addEventListener('change', e => { G.parkName = e.target.value.trim() || 'Dino Island'; this.hud(); saveGame(); });
      $('#setVol').addEventListener('input', e => { s.vol = +e.target.value; Sfx.setVolume(s.vol); });
      const tog = (id, fn) => $(id).addEventListener('click', e => { e.currentTarget.classList.toggle('on'); fn(e.currentTarget.classList.contains('on')); Sfx.click(); saveGame(); });
      tog('#setMusic', v => { s.music = v; Sfx.setMusic(v); });
      tog('#setAmb', v => { s.ambience = v; Sfx.setAmbience(v); });
      tog('#setDay', v => { s.daynight = v; });
      tog('#setQ', v => { s.quality = v ? 'high' : 'low'; });
      $('#setReset').addEventListener('click', () => { if (confirm('Really delete your park and start over?')) { wipeSave(); G = null; location.reload(); } });
    });
  },

  /* ---------- arena ---------- */
  arena() {
    if (!countDef('arena')) { this.toast(G.level < BUILDINGS.arena.level ? `The Battle Arena unlocks at level ${BUILDINGS.arena.level}.` : 'Build the Battle Arena first (Market → Buildings).', 'err'); return; }
    this.openModal('arena', 'Battle Arena', null, null, () => this.renderArena());
  },
  renderArena(selLeague) {
    const box = this.body(); box.innerHTML = '';
    box.appendChild(el('div', 'section-title', '🏆 Tournament leagues'));
    const ll = el('div', 'league-list');
    LEAGUES.forEach((L, i) => {
      const locked = G.level < L.level || i > G.league.best + 1;
      const round = G.league.round[L.id] || 0;
      const won = G.league.best >= i;
      const d = el('div', `league ${L.id}${locked ? ' locked' : ''}`, `<h4>${esc(L.name)}</h4><p>${locked ? (G.level < L.level ? `Level ${L.level}` : 'Win the previous league') : won ? '🏆 Champion' : `Round ${round + 1} / 3`}</p><p>Opponents Lv ${L.lv[0]}–${L.lv[1]}</p><p>Prize <i class="ic ic-coin"></i>${fmt(L.reward.coins)} <i class="ic ic-buck"></i>${L.reward.bucks}</p>`);
      if (!locked) { d.style.cursor = 'pointer'; d.addEventListener('click', () => { Sfx.click(); this.renderArena(L.id); }); }
      if (selLeague === L.id) d.style.outline = '4px solid #fff';
      ll.appendChild(d);
    });
    box.appendChild(ll);
    if (!selLeague) { box.appendChild(el('p', 'note', 'Pick a league to choose your team. Each attack type (Charge, Bite, Swipe) deals full damage only against the matching weakness – 50% or 25% otherwise. Block cancels an attack, Special hits for 150%.')); return; }
    const L = LEAGUES.find(l => l.id === selLeague);
    box.appendChild(el('div', 'section-title', `Choose up to 3 fighters · Entry fee <i class="ic ic-coin"></i>${fmt(L.fee)}`));
    const fighters = G.objects.filter(o => o.type === 'paddock' && o.hatchEnd <= now()).sort((a, b) => { const sa = dinoStats(SPECIES[a.species], a.level, a.stage || 0), sb = dinoStats(SPECIES[b.species], b.level, b.stage || 0); return (sb.hp + sb.atk * 4) - (sa.hp + sa.atk * 4); });
    if (!fighters.length) { box.appendChild(el('div', 'empty', 'You have no hatched dinosaurs yet.')); return; }
    const sel = this.teamSel || (this.teamSel = []);
    this.teamSel = sel.filter(id => fighters.some(f => f.id === id));
    if (!this.teamSel.length) this.teamSel = fighters.slice(0, 3).map(f => f.id);
    const tp = el('div', 'team-pick');
    for (const f of fighters) {
      const sp = SPECIES[f.species], st = dinoStats(sp, f.level, f.stage || 0);
      const d = el('button', 'pick' + (this.teamSel.includes(f.id) ? ' on' : ''), `<div></div>${esc(sp.name)}<br>Lv ${f.level} · ❤${st.hp} ⚔${st.atk}`);
      d.type = 'button';
      d.querySelector('div').appendChild(thumbCanvas(f.species, f.stage || 0, 120, 70));
      d.addEventListener('click', () => { Sfx.click(); const i = this.teamSel.indexOf(f.id); if (i >= 0) this.teamSel.splice(i, 1); else if (this.teamSel.length < 3) this.teamSel.push(f.id); this.renderArena(selLeague); });
      tp.appendChild(d);
    }
    box.appendChild(tp);
    const go = el('div', 'btn-row');
    const b = el('button', 'btn btn-red big', `⚔ FIGHT · Round ${(G.league.round[L.id] || 0) + 1}`); b.type = 'button';
    b.disabled = !this.teamSel.length;
    b.addEventListener('click', () => {
      if (!spend({ coins: L.fee })) return;
      this.closeModal();
      Battle.start(L, this.teamSel.map(id => objById(id)).filter(Boolean));
    });
    go.appendChild(b); box.appendChild(go);
  },
};

/* ---------- helpers ---------- */
function thumbCanvas(sid, stage, w, h) {
  const th = DinoArt.thumb(sid, stage, w, h);
  const cv = makeCanvas(th.width, th.height); cv.getContext('2d').drawImage(th, 0, 0);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  return cv;
}
function spriteBounds(s) {
  if (s.bounds) return s.bounds;
  const c = s.c, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = c.width; y1 = c.height; }
  return (s.bounds = { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 });
}
function spriteThumb(cv, s) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const b = spriteBounds(s);
  const k = Math.min(cv.width * 0.9 / b.w, cv.height * 0.9 / b.h);
  const w = b.w * k, h = b.h * k;
  ctx.drawImage(s.c, b.x, b.y, b.w, b.h, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
}
function goalIcon(t) {
  return { collect_dino: 'ic-coin', feed: 'ic-crop', clear: 'ic-move', build: 'ic-market', road: 'ic-road', collect_food: 'ic-crop', decode: 'ic-amber', dino_level: 'ic-xp', buy_dino: 'ic-market', hatch: 'ic-lab', deco: 'ic-star', collect_shop: 'ic-coin', level: 'ic-xp', battle_win: 'ic-arena', evolve: 'ic-lab', visitors: 'ic-visitor', league: 'ic-arena', species: 'ic-book' }[t] || 'ic-scroll';
}
function goalText(m) {
  const g = m.goal;
  switch (g.type) {
    case 'collect_dino': return 'Collect dino coins';
    case 'feed': return 'Feed dinosaurs';
    case 'clear': return 'Clear obstacles';
    case 'build': return 'Build ' + BUILDINGS[g.id].name;
    case 'road': return 'Build roads';
    case 'collect_food': return 'Collect a food shipment';
    case 'decode': return 'Decode amber';
    case 'dino_level': return `${SPECIES[g.species].name} to Lv ${g.level}`;
    case 'buy_dino': return g.species ? 'Buy a ' + SPECIES[g.species].name : 'Buy a new dinosaur';
    case 'hatch': return g.species ? 'Hatch a ' + SPECIES[g.species].name : 'Hatch an egg';
    case 'deco': return 'Place decorations';
    case 'collect_shop': return 'Collect from shops';
    case 'level': return 'Reach level ' + g.level;
    case 'battle_win': return 'Win arena battles';
    case 'evolve': return 'Evolve a dinosaur';
    case 'visitors': return 'Visitors in the park';
    case 'league': return 'Win the ' + LEAGUES.find(l => l.id === g.league).name;
    case 'species': return 'Different species';
  }
  return '';
}

/* ---------- advisor portraits (original characters, SVG) ---------- */
function portraitSVG(key) {
  const c = CHARS[key];
  const hair = c.hair, skin = c.skin, out = c.outfit, acc = c.accent;
  const shadeSkin = shade(skin, -0.2);
  let hairBack = '', hairFront = '', extras = '';
  if (key === 'vance') {
    hairBack = `<path d="M44 70 C40 38 62 22 80 22 C100 22 120 36 116 72 C112 60 106 52 80 50 C58 50 50 58 44 70Z" fill="${hair}"/><path d="M50 60 C44 80 46 96 52 104 L56 80Z M110 60 C116 80 114 96 108 104 L104 80Z" fill="${shade(hair, -0.1)}"/>`;
    hairFront = `<path d="M52 56 C60 36 96 32 110 56 C98 46 70 44 52 56Z" fill="${shade(hair, 0.1)}"/>`;
    extras = `<g fill="none" stroke="#2a2a2a" stroke-width="2.4"><rect x="58" y="68" width="18" height="12" rx="4"/><rect x="84" y="68" width="18" height="12" rx="4"/><path d="M76 73h8"/></g><circle cx="80" cy="150" r="5" fill="${acc}"/>`;
  } else if (key === 'quill') {
    hairBack = `<ellipse cx="80" cy="56" rx="40" ry="34" fill="${hair}"/><circle cx="80" cy="24" r="14" fill="${hair}"/>`;
    hairFront = `<path d="M48 64 C52 40 108 40 112 64 C102 50 60 50 48 64Z" fill="${shade(hair, 0.15)}"/>`;
    extras = `<path d="M50 132 L80 170 L110 132 L120 170 L40 170Z" fill="#fff" stroke="#b8c4c8" stroke-width="2"/><path d="M70 136 L80 150 L90 136" fill="none" stroke="${acc}" stroke-width="3"/><rect x="100" y="146" width="10" height="3" fill="${acc}"/>`;
  } else {
    hairBack = `<path d="M50 60 C50 44 64 38 80 38 C96 38 110 44 110 60Z" fill="${hair}"/>`;
    extras = `<path d="M40 50 C50 44 110 44 120 50 L124 56 C100 52 60 52 36 56Z" fill="#c8a060" stroke="#6a4a20" stroke-width="2"/><path d="M54 50 C56 28 104 28 106 50Z" fill="#d8b36a" stroke="#6a4a20" stroke-width="2"/><path d="M54 46 H106" stroke="#6a4a20" stroke-width="3"/>
      <path d="M58 86 C60 104 100 104 102 86 C96 96 64 96 58 86Z" fill="${hair}"/><path d="M68 90 C74 94 86 94 92 90" stroke="${shade(hair, 0.3)}" stroke-width="2" fill="none"/>`;
  }
  return `<svg viewBox="0 0 160 170" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="sk${key}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${shade(skin, 0.15)}"/><stop offset="1" stop-color="${shadeSkin}"/></radialGradient>
    <linearGradient id="ou${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(out, 0.15)}"/><stop offset="1" stop-color="${shade(out, -0.3)}"/></linearGradient></defs>
    ${hairBack}
    <path d="M24 170 C26 132 52 120 80 120 C108 120 134 132 136 170Z" fill="url(#ou${key})"/>
    <path d="M68 104 L68 124 C74 130 86 130 92 124 L92 104Z" fill="${shadeSkin}"/>
    <ellipse cx="46" cy="74" rx="6" ry="9" fill="${shadeSkin}"/><ellipse cx="114" cy="74" rx="6" ry="9" fill="${shadeSkin}"/>
    <ellipse cx="80" cy="72" rx="32" ry="38" fill="url(#sk${key})"/>
    ${hairFront}
    <ellipse cx="67" cy="74" rx="4" ry="4.6" fill="#fff"/><ellipse cx="93" cy="74" rx="4" ry="4.6" fill="#fff"/>
    <circle cx="68" cy="75" r="2.6" fill="#2a1a10"/><circle cx="94" cy="75" r="2.6" fill="#2a1a10"/>
    <circle cx="69" cy="74" r=".9" fill="#fff"/><circle cx="95" cy="74" r=".9" fill="#fff"/>
    <path d="M60 64 Q67 60 74 64 M86 64 Q93 60 100 64" stroke="${shade(hair, -0.2)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M80 78 Q77 88 82 90" stroke="${shade(skin, -0.35)}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M70 97 Q80 104 90 97" stroke="#8a3a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="62" cy="88" rx="5" ry="3" fill="#ff8a7a" opacity=".3"/><ellipse cx="98" cy="88" rx="5" ry="3" fill="#ff8a7a" opacity=".3"/>
    ${extras}
  </svg>`;
}

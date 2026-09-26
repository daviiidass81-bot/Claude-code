'use strict';
/* ==========================================================
   Game controller & main loop
   ========================================================== */
const Game = {
  mode: 'title', roadErase: false, placing: null, hint: null, roadStroke: 0, lastSave: 0, started: false,

  /* ---------- modes & tools ---------- */
  setMode(m) {
    if (this.mode === 'place' && m !== 'place') this.cancelPlace(true);
    this.mode = m;
    Render.roadMode = m === 'road' ? (this.roadErase ? 'erase' : 'paint') : null;
    $('#modebar').classList.toggle('hidden', !(m === 'road' || m === 'edit'));
    if (m === 'road') { $('#modeText').innerHTML = this.roadErase ? 'Erase roads – drag over tiles' : `Road mode – drag to build (<i class="ic ic-coin"></i>${ROAD_COST}/tile)`; $('#modeAlt').classList.remove('hidden'); $('#modeAlt').textContent = this.roadErase ? 'Build' : 'Erase'; }
    if (m === 'edit') { $('#modeText').textContent = 'Edit mode – tap something to move it'; $('#modeAlt').classList.add('hidden'); }
    $('#placebar').classList.toggle('hidden', m !== 'place');
    this.refreshToolbar();
  },
  refreshToolbar() {
    $$('#toolbar .tool').forEach(b => {
      const t = b.dataset.tool;
      b.classList.toggle('active', (t === 'road' && this.mode === 'road') || (t === 'edit' && this.mode === 'edit') || (UI.modalKind && ({ market: 'market', lab: 'lab', missions: 'missions', arena: 'arena', dinopedia: 'pedia' })[t] === UI.modalKind));
    });
  },
  toggleTool(t) {
    UI.hideInfo();
    switch (t) {
      case 'market': UI.market(); break;
      case 'road': this.setMode(this.mode === 'road' ? 'normal' : 'road'); break;
      case 'edit': this.setMode(this.mode === 'edit' ? 'normal' : 'edit'); break;
      case 'lab': UI.lab(); break;
      case 'arena': UI.arena(); break;
      case 'missions': UI.missions(); break;
      case 'dinopedia': UI.dinopedia(); break;
    }
    this.refreshToolbar();
  },
  toggleRoadErase() { this.roadErase = !this.roadErase; this.setMode('road'); },
  escape() {
    if (Battle.active) return;
    if (UI.modalOpen()) return UI.closeModal();
    if (this.mode === 'place') return this.cancelPlace();
    if (this.mode !== 'normal') return this.setMode('normal');
    UI.hideInfo();
  },

  /* ---------- pointer ---------- */
  hoverAt(sx, sy) {
    const ref = Render.pick(sx, sy);
    Render.cv.style.cursor = ref ? 'pointer' : '';
  },
  tap(sx, sy) {
    Sfx.init();
    if (this.mode === 'title') return;
    const tile = Render.s2t(sx, sy);
    if (this.mode === 'place') {
      const nx = tile.x - Math.floor((this.placing.w - 1) / 2), ny = tile.y - Math.floor((this.placing.h - 1) / 2);
      const g = Render.ghost;
      if (g && tile.x >= g.x && tile.x < g.x + g.w && tile.y >= g.y && tile.y < g.y + g.h && g.valid) return this.confirmPlace();
      this.moveGhost(nx, ny); return;
    }
    if (this.mode === 'road') return;
    const ref = Render.pick(sx, sy);
    if (this.mode === 'edit') {
      const o = ref && (ref.kind === 'obj' || ref.kind === 'dino' || ref.kind === 'bubble') ? ref.o : World.objAt(tile.x, tile.y);
      if (o && o.def !== 'gate') { this.startMove(o); }
      return;
    }
    if (!ref) {
      const o = World.objAt(tile.x, tile.y);
      if (o) return this.select(o, sx, sy);
      if (World.inMap(tile.x, tile.y) && World.obs[World.idx(tile.x, tile.y)]) return this.select({ kind: 'obs', x: tile.x, y: tile.y }, sx, sy);
      UI.hideInfo();
      return;
    }
    if (ref.kind === 'bubble') return this.collectFrom(ref.o, sx, sy);
    if (ref.kind === 'dino' || ref.kind === 'obj') {
      const o = ref.o;
      if (ref.kind === 'dino') { const a = Entities.dinos.get(o.id); if (a && o.hatchEnd <= now() && Math.random() < 0.5) a.roar(); }
      return this.select(o, sx, sy);
    }
    if (ref.kind === 'obs') return this.select(ref, sx, sy);
  },
  select(ref, sx, sy) {
    Sfx.click();
    // quick-collect when something is ready
    if (ref.type && this.collectFrom(ref, sx, sy, true)) return;
    UI.showInfo(ref);
  },

  /* ---------- collecting ---------- */
  collectFrom(o, sx, sy, quiet) {
    const nowT = now();
    if (o.type === 'paddock') {
      if (o.hatchEnd > nowT) return false;
      if (o.coins >= Math.max(1, dinoCap(o) * 0.05)) { this.collectDino(o, sx, sy); return !quiet || true; }
      return false;
    }
    if (o.type !== 'building') return false;
    const b = BUILDINGS[o.def];
    if ((b.kind === 'shop' || b.kind === 'center') && nowT - o.start >= b.period * 1000) { this.collectShop(o, sx, sy); return true; }
    if (b.kind === 'harbor' && o.order && nowT >= o.order.end) { this.collectFood(o, sx, sy); return true; }
    if (b.kind === 'lab' && G.lab && nowT >= G.lab.end) { this.claimLab(); return true; }
    if (!quiet) { UI.showInfo(o); return true; }
    return false;
  },
  collectDino(o, sx, sy) {
    const amt = Math.floor(o.coins);
    if (amt < 1) return;
    o.coins -= amt;
    gain('coins', amt, 'dino');
    addXP(Math.max(1, Math.round(amt / 25)), 'dino');
    G.stats.collected += amt;
    missionEvent('collect_dino');
    Sfx.cash();
    const w = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    Entities.float(w.x, w.y - 80, '+' + fmt(amt), '#ffd479', 20);
    Entities.emit(w.x, w.y - 70, 'spark', 12);
    UI.fly('coins', sx, sy, Math.min(8, 3 + Math.floor(amt / 100)));
    UI.renderInfo(true);
  },
  collectShop(o, sx, sy) {
    const amt = shopIncome(o), b = BUILDINGS[o.def];
    o.start = now();
    gain('coins', amt, 'shop'); addXP(Math.max(2, Math.round(amt / 30)), 'shop');
    missionEvent('collect_shop');
    Sfx.cash();
    const w = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    Entities.float(w.x, w.y - 90, '+' + fmt(amt), '#ffd479', 20);
    Entities.emit(w.x, w.y - 80, 'spark', 10);
    UI.fly('coins', sx, sy, 5);
    UI.renderInfo(true);
  },
  collectFood(o, sx, sy) {
    const food = BUILDINGS[o.def].food, amt = o.order.amount;
    o.order = null;
    gain(food, amt, 'harbor'); addXP(10, 'harbor');
    missionEvent('collect_food');
    Sfx.food();
    const w = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    Entities.float(w.x, w.y - 90, `+${fmt(amt)} ${food}`, food === 'crops' ? '#b6e27a' : '#ff9a8a', 20);
    Entities.emit(w.x, w.y - 60, 'food', 14, { col: food === 'crops' ? '#7ac04a' : '#c8402a' });
    UI.fly(food, sx, sy, 6);
    if (UI.infoObj === o) UI.renderInfo();
  },

  /* ---------- object actions (from info panel) ---------- */
  action(act, o, btn) {
    const r = btn.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    if (act === 'collect') return this.collectDino(o, sx, sy);
    if (act === 'collectShop') return this.collectShop(o, sx, sy);
    if (act === 'collectFood') return this.collectFood(o, sx, sy);
    if (act === 'feed') return this.feed(o, sx, sy);
    if (act === 'evolve') return this.evolve(o);
    if (act === 'roar') { const a = Entities.dinos.get(o.id); if (a) a.roar(); return; }
    if (act === 'move') return this.startMove(o);
    if (act === 'sell') return this.sell(o);
    if (act === 'hatchNow') { const c = speedCost(o.hatchEnd - now()); if (spend({ bucks: c })) { o.hatchEnd = now(); } return; }
    if (act === 'openLab') { UI.hideInfo(); return UI.lab(); }
    if (act === 'openArena') { UI.hideInfo(); return UI.arena(); }
    if (act.startsWith('order')) return this.orderFood(o, +act.slice(5));
    if (act === 'rushFood') { const c = speedCost(o.order.end - now()); if (spend({ bucks: c })) { o.order.end = now(); UI.renderInfo(); } return; }
    if (act === 'clear') return this.startClear(o);
    if (act === 'rushClear') { const job = G.clearing.find(c => c.i === World.idx(o.x, o.y)); if (job && spend({ bucks: speedCost(job.end - now()) })) { job.end = now(); } return; }
  },
  feed(o, sx, sy) {
    const sp = SPECIES[o.species], food = sp.diet === 'herb' ? 'crops' : 'meat';
    if (o.level >= maxLevelForStage(o.stage || 0)) return;
    const cost = feedCost(o);
    if (!spend({ [food]: cost })) { UI.toast(food === 'crops' ? 'Order crops at the Crop Harbor!' : 'Order meat at the Meat Harbor!', 'err'); return; }
    o.feeds++;
    G.stats.fed++;
    missionEvent('feed', { species: o.species });
    Sfx.food();
    const a = Entities.dinos.get(o.id); if (a) a.eatNow();
    const w = World.toWorld(o.x + o.w - 1.2, o.y + o.h - 0.8);
    Entities.emit(w.x, w.y - 10, 'food', 10, { col: food === 'crops' ? '#7ac04a' : '#c8402a' });
    addXP(3 + o.level, 'feed');
    if (o.feeds >= FEEDS_PER_LEVEL) {
      o.feeds = 0; o.level++;
      const c = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
      Entities.float(c.x, c.y - 100, `Level ${o.level}!`, '#b6e27a', 22);
      Entities.emit(c.x, c.y - 60, 'star', 14);
      Sfx.levelUp();
      if (o.level === 5) UI.toast(`Your ${sp.name} is now an adult!`, 'good');
      if (STAGE_LEVELS.includes(o.level)) UI.toast(`${sp.name} is ready to evolve! Research it in the Lab.`, 'good');
    }
    UI.renderInfo();
  },
  evolve(o) {
    const st = o.stage || 0;
    if (st >= 3 || o.level < maxLevelForStage(st) || (G.stageResearch[o.species] || 0) < st + 1) return;
    o.stage = st + 1; o.level++; o.feeds = 0;
    missionEvent('evolve', { species: o.species });
    addXP(150 * o.stage, 'evolve');
    const c = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    Entities.emit(c.x, c.y - 50, 'star', 30, { col: '#e8b0ff' });
    Entities.emit(c.x, c.y - 50, 'confetti', 30);
    Entities.float(c.x, c.y - 110, `${STAGE_NAMES[o.stage]}!`, '#e8b0ff', 26);
    Sfx.hatch();
    const a = Entities.dinos.get(o.id); if (a) setTimeout(() => a.roar(), 600);
    UI.toast(`${SPECIES[o.species].name} evolved to ${STAGE_NAMES[o.stage]}!`, 'good big');
    UI.renderInfo();
  },
  orderFood(o, idx) {
    if (o.order) return;
    const cost = harborOrderCost(o, idx);
    if (!spend({ coins: cost })) return;
    const h = HARBOR_ORDERS[idx];
    o.order = { idx, start: now(), end: now() + h.time * 1000, amount: h.amount };
    Sfx.click(); Sfx.whoosh();
    missionEvent('order_food');
    UI.toast(`${h.name} ordered – arriving in ${fmtTime(h.time * 1000)}`, 'good');
    UI.renderInfo();
  },
  sell(o) {
    const def = defOf(o);
    if (def.noSell) return;
    const refund = Math.round(coinsEquiv(def.cost) * (o.type === 'deco' ? 0.5 : 0.3));
    const name = def.name;
    if (!confirm(`Sell ${name} for ${fmt(refund)} coins?`)) return;
    removeObject(o);
    gain('coins', refund, 'sell');
    Entities.syncDinos();
    UI.hideInfo();
    Sfx.build();
    UI.toast(`${name} sold for ${fmt(refund)} coins`);
  },

  /* ---------- clearing obstacles ---------- */
  startClear(ref) {
    const i = World.idx(ref.x, ref.y), kind = OBS_KIND[World.obs[i]];
    if (!kind || G.clearing.some(c => c.i === i)) return;
    if (G.clearing.length >= maxWorkers()) { UI.toast(`All workers are busy (${maxWorkers()}). Build a Ranger Station for more!`, 'err'); return; }
    if (!spend({ coins: clearCost(kind) })) return;
    G.clearing.push({ i, start: now(), end: now() + clearTime(kind) });
    Sfx.chop();
    UI.renderInfo();
  },
  finishClear(job) {
    const x = job.i % MAP, y = Math.floor(job.i / MAP);
    const kind = OBS_KIND[World.obs[job.i]];
    World.obs[job.i] = 0;
    G.clearing = G.clearing.filter(c => c !== job);
    G.stats.cleared++;
    missionEvent('clear');
    const w = World.toWorld(x + 0.5, y + 0.5);
    Entities.emit(w.x, w.y - 20, kind === 'rock' || kind === 'bigrock' ? 'dust' : 'leaf', 18);
    Entities.emit(w.x, w.y, 'dust', 8);
    if (Render.onScreen(x, y)) Sfx.timber();
    addXP(CLEAR[kind].xp, 'clear');
    Entities.float(w.x, w.y - 50, `+${CLEAR[kind].xp} XP`, '#8fd3ff', 16);
    const amber = rollAmber(G.stats.cleared === 2);
    if (amber) {
      Entities.emit(w.x, w.y - 30, 'star', 20, { col: '#ffb13b' });
      Entities.float(w.x, w.y - 75, 'AMBER!', '#ffb13b', 24);
      Sfx.amber();
      UI.toast(`<i class="ic ic-amber"></i> Amber found! It contains ${esc(SPECIES[amber].name)} DNA.`, 'good big', 4000);
      const s = Render.w2s(w.x, w.y - 30); UI.fly('amber', s.x, s.y, 3);
      if (!G.tutorialAmber) { G.tutorialAmber = true; UI.advisor('quill', `Incredible! This amber holds a mosquito with ${SPECIES[amber].name} DNA. Bring it to the Genetics Lab and I'll decode it!`); }
    }
    if (UI.infoObj && UI.infoObj.kind === 'obs' && UI.infoObj.x === x && UI.infoObj.y === y) UI.hideInfo();
  },

  /* ---------- roads ---------- */
  paintRoad(tile) {
    const { x, y } = tile;
    if (!World.inMap(x, y)) return;
    const i = World.idx(x, y);
    if (this.roadErase) {
      if (!World.roads[i]) return;
      const gate = G.objects.find(o => o.def === 'gate');
      if (gate && x === gate.x + 1 && y === gate.y) return;
      World.roads[i] = 0; World.countRoads(); gain('coins', Math.round(ROAD_COST / 2));
      Sfx.road();
      return;
    }
    if (World.roads[i] || !World.canPlace(x, y, 1, 1)) return;
    if (!spend({ coins: ROAD_COST })) return;
    World.roads[i] = 1; World.countRoads();
    this.roadStroke++;
    missionEvent('road');
    Sfx.road();
    const w = World.toWorld(x + 0.5, y + 0.5);
    Entities.emit(w.x, w.y, 'dust', 3);
  },
  endRoadStroke() { if (this.roadStroke) addXP(this.roadStroke, 'road'); this.roadStroke = 0; saveGame(); },

  /* ---------- placement ---------- */
  startPlace(type, def, moving) {
    UI.hideInfo();
    let w, h;
    if (type === 'paddock') w = h = SPECIES[def].pad; else if (type === 'deco') [w, h] = DECOS[def].size; else [w, h] = BUILDINGS[def].size;
    // start near the screen center on a free spot
    const c = Render.s2t(Render.W / 2, Render.H / 2);
    let best = { x: c.x - Math.floor(w / 2), y: c.y - Math.floor(h / 2) };
    outer: for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = c.x - Math.floor(w / 2) + dx, y = c.y - Math.floor(h / 2) + dy;
      if (World.canPlace(x, y, w, h, moving ? moving.id : 0)) { best = { x, y }; break outer; }
    }
    this.placing = { type, def, w, h, moving };
    Render.ghost = { type, def, w, h, x: best.x, y: best.y, valid: false, moving };
    this.mode = 'place';
    this.setMode('place');
    this.moveGhost(best.x, best.y);
    const name = type === 'paddock' ? SPECIES[def].name : type === 'deco' ? DECOS[def].name : BUILDINGS[def].name;
    $('#placeText').innerHTML = `${moving ? 'Move' : 'Place'} <b>${esc(name)}</b> – drag or tap to position`;
  },
  moveGhost(x, y) {
    const g = Render.ghost; if (!g) return;
    g.x = clamp(x, 0, MAP - g.w); g.y = clamp(y, 0, MAP - g.h);
    g.valid = World.canPlace(g.x, g.y, g.w, g.h, g.moving ? g.moving.id : 0);
    $('#placeOk').disabled = !g.valid;
  },
  moveGhostDone() {},
  confirmPlace() {
    const g = Render.ghost, p = this.placing;
    if (!g || !p || !g.valid) { Sfx.error(); return; }
    if (p.moving) {
      const o = p.moving;
      o.x = g.x; o.y = g.y;
      World.rebuildOcc(); recomputeBonuses();
      const a = Entities.dinos.get(o.id); if (a) { a.x = o.x + o.w / 2; a.y = o.y + o.h / 2; a.tx = a.x; a.ty = a.y; }
      Sfx.build();
    } else {
      const def = p.type === 'paddock' ? SPECIES[p.def] : p.type === 'deco' ? DECOS[p.def] : BUILDINGS[p.def];
      if (!spend(def.cost)) return;
      const o = makeObject(p.type, p.def, g.x, g.y);
      addObject(o);
      Sfx.build();
      if (p.type === 'paddock') { Entities.syncDinos(); missionEvent('buy_dino', { species: p.def }); addXP(20 + def.level * 5, 'buy'); UI.toast(`${def.name} egg placed! It will hatch in ${fmtTime(def.hatch * 1000)}.`, 'good'); }
      else if (p.type === 'deco') { missionEvent('deco'); addXP(5, 'deco'); }
      else { missionEvent('build', { id: p.def }); addXP(def.xp || 20, 'build'); }
      const c = World.toWorld(g.x + g.w / 2, g.y + g.h / 2);
      Entities.emit(c.x, c.y, 'dust', 20); Entities.emit(c.x, c.y - 30, 'star', 10);
      Render.shake(3);
      // keep placing decorations & roads quickly
      if (p.type === 'deco' && canAfford(def.cost)) { this.moveGhost(g.x, g.y); saveGame(); return; }
    }
    this.placing = null; Render.ghost = null;
    this.setMode('normal');
    saveGame();
  },
  cancelPlace(silent) {
    this.placing = null; Render.ghost = null;
    if (!silent) { this.setMode('normal'); Sfx.close(); }
  },
  startMove(o) {
    if (o.def === 'gate') return;
    UI.hideInfo();
    const type = o.type, def = o.type === 'paddock' ? o.species : o.def;
    this.startPlace(type, def, o);
    this.moveGhost(o.x, o.y);
  },

  /* ---------- lab ---------- */
  startDecode(sid) {
    if (G.lab || !G.amber[sid]) return;
    const c = decodeCost(sid);
    if (!spend({ coins: c.coins })) return;
    G.amber[sid]--;
    startLab({ type: 'decode', species: sid, start: now(), end: now() + c.time * 1000 });
    Sfx.amber();
  },
  startEvolveResearch(sid, stage) {
    if (G.lab) return;
    const c = evolveCost(sid, stage);
    if (!spend({ coins: c.coins })) return;
    startLab({ type: 'evolve', species: sid, stage, start: now(), end: now() + c.time * 1000 });
    Sfx.amber();
  },
  rushLab() { if (!G.lab) return; if (spend({ bucks: speedCost(G.lab.end - now()) })) G.lab.end = now(); },
  claimLab() {
    const t = G.lab; if (!t || now() < t.end) return;
    finishLab();
    Sfx.mission();
    if (t.type === 'decode') {
      UI.toast(`🧬 ${SPECIES[t.species].name} DNA decoded! Available in the Market.`, 'good big', 4000);
      UI.advisor('quill', `The ${SPECIES[t.species].name} sequence is complete! You can now buy its egg in the Market.`);
    } else UI.toast(`★ ${SPECIES[t.species].name} ${STAGE_NAMES[t.stage]} researched! Evolve it from its paddock.`, 'good big', 4000);
    if (UI.modalKind === 'lab') UI.renderLab();
  },

  /* ---------- mission hints ---------- */
  hintFor(m) {
    const g = m.goal;
    const focusObj = pred => { const o = G.objects.find(pred); if (o) { Render.focusTile(o.x + o.w / 2, o.y + o.h / 2, 1.2); this.hint = { x: o.x + o.w / 2, y: o.y + o.h / 2, until: now() + 8000 }; } return o; };
    switch (g.type) {
      case 'collect_dino': case 'feed': case 'dino_level': case 'evolve': focusObj(o => o.type === 'paddock' && (!g.species || o.species === g.species)); break;
      case 'clear': {
        let best = null, bd = 1e9; const c = Render.s2t(Render.W / 2, Render.H / 2);
        for (let i = 0; i < World.obs.length; i++) if (World.obs[i]) { const x = i % MAP, y = Math.floor(i / MAP), d = Math.hypot(x - 24, y - 24); if (d < bd) { bd = d; best = { x, y }; } }
        if (best) { Render.focusTile(best.x + 0.5, best.y + 0.5, 1.3); this.hint = { x: best.x + 0.5, y: best.y + 0.5, until: now() + 8000 }; }
        break;
      }
      case 'build': case 'deco': UI.market(g.type === 'deco' ? 'decos' : 'buildings'); break;
      case 'buy_dino': case 'hatch': if (g.type === 'hatch' && focusObj(o => o.type === 'paddock' && o.hatchEnd > now())) break; UI.market('dinos'); break;
      case 'road': this.setMode('road'); break;
      case 'collect_food': focusObj(o => o.def === 'crop_harbor') || UI.market('buildings'); break;
      case 'decode': focusObj(o => o.def === 'lab'); break;
      case 'collect_shop': focusObj(o => BUILDINGS[o.def] && BUILDINGS[o.def].kind === 'shop'); break;
      case 'battle_win': case 'league': UI.arena(); break;
    }
  },

  /* ---------- simulation tick ---------- */
  tick(dt) {
    const nowT = now();
    for (const o of G.objects) {
      if (o.type === 'paddock') {
        if (o.hatchEnd <= nowT) {
          if (!o.hatched) {
            o.hatched = true;
            if (this.started && nowT - o.hatchEnd < 5000) {
              const c = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
              Entities.emit(c.x, c.y - 20, 'confetti', 30); Entities.emit(c.x, c.y - 10, 'star', 12);
              Sfx.hatch();
              UI.toast(`🥚 A baby ${SPECIES[o.species].name} has hatched!`, 'good big');
            }
            G.stats.hatched++;
            missionEvent('hatch', { species: o.species });
          }
          o.coins = Math.min(dinoCap(o), (o.coins || 0) + dinoRate(o) * dt / 60);
        }
      }
    }
    for (const job of [...G.clearing]) if (nowT >= job.end) this.finishClear(job);
    // world time
    const dayLen = 480;
    const dayT = window.FORCE_HOUR !== undefined ? window.FORCE_HOUR / 24 : G.settings.daynight ? ((nowT / 1000 / dayLen) + G.dayOffset) % 1 : 0.45;
    World.hour = dayT * 24;
    const h = World.hour;
    let night = 0;
    if (h >= 20 || h < 5) night = 1; else if (h >= 18) night = (h - 18) / 2; else if (h < 7) night = 1 - (h - 5) / 2;
    World.night = night;
    World.dusk = h >= 17 && h < 20 ? Math.sin((h - 17) / 3 * Math.PI) : h >= 5 && h < 7.5 ? Math.sin((h - 5) / 2.5 * Math.PI) * 0.7 : 0;
    Sfx.setNight && Sfx.ctx && Sfx.setNight(night);
    if (this.hint && now() > this.hint.until) this.hint = null;
  },
  applyOffline() {
    const dt = clamp((now() - (G.lastTick || now())) / 1000, 0, 3600 * 12);
    if (dt < 30) return;
    let coins = 0;
    for (const o of G.objects) if (o.type === 'paddock' && o.hatchEnd <= now()) { const before = o.coins || 0; o.coins = Math.min(dinoCap(o), before + dinoRate(o) * dt / 60); coins += o.coins - before; }
    if (coins > 10) setTimeout(() => UI.toast(`Welcome back! Your dinosaurs earned ${fmt(coins)} coins while you were away.`, 'good big', 5000), 1500);
  },
};

/* ==========================================================
   New park layout
   ========================================================== */
function setupNewPark() {
  G = newGameState();
  World.generate(G.seed);
  const place = (type, def, x, y) => { const o = makeObject(type, def, x, y); G.objects.push(o); return o; };
  place('building', 'gate', 23, 31);
  place('building', 'visitor_center', 25, 26);
  place('building', 'lab', 29, 26);
  place('building', 'crop_harbor', 20, 20);
  place('building', 'souvenir', 29, 20).start = now() - 45000;
  const trike = place('paddock', 'triceratops', 25, 18);
  trike.hatchEnd = now() - 1000; trike.hatchStart = now() - 20000; trike.level = 4; trike.coins = 120;
  const cropH = G.objects.find(o => o.def === 'crop_harbor');
  cropH.order = null;
  // roads
  for (let y = 19; y <= 30; y++) World.roads[World.idx(24, y)] = 1;
  for (let x = 19; x <= 29; x++) World.roads[World.idx(x, 24)] = 1;
  World.roads[World.idx(24, 31)] = 1;
  // decorations
  place('deco', 'flowers', 23, 29); place('deco', 'lamp', 25, 30); place('deco', 'torch', 22, 30); place('deco', 'palm', 29, 25);
  World.rebuildOcc(); recomputeBonuses();
}
function loadPark(s) {
  G = s;
  World.generate(G.seed);
  World.decode(G.roads, World.roads);
  World.decode(G.obs, World.obs);
  World.rebuildOcc(); recomputeBonuses();
}

/* ==========================================================
   Boot
   ========================================================== */
let lastFrame = performance.now(), tickAcc = 0;
function loop(ts) {
  const dt = Math.min(0.1, (ts - lastFrame) / 1000);
  lastFrame = ts;
  if (G) {
    Input.update(dt);
    tickAcc += dt;
    if (tickAcc > 0.1) { Game.tick(tickAcc); tickAcc = 0; }
    Entities.update(dt, Render.t);
    if (!Battle.active) Render.frame(dt);
    if (Game.hint && !Battle.active) drawHintArrow();
    Battle.update(dt);
    UI.refreshInfo(dt);
    if (UI.hudDirty || Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) { UI.hud(); UI.clock(); }
    if (Game.started && ts - Game.lastSave > 10000) { Game.lastSave = ts; saveGame(); }
    if (Game.started && Math.floor(ts / 1000) !== Math.floor((ts - dt * 1000) / 1000)) UI.renderTrackerSoft();
  }
  requestAnimationFrame(loop);
}
UI.renderTrackerSoft = function () {
  // refresh progress of state-based missions (visitors, level, ...)
  const sig = G.missions.active.map(id => { const m = MISSIONS.find(x => x.id === id); return missionProgress(m); }).join(',');
  if (sig !== this._trackSig) { this._trackSig = sig; this.renderTracker(); }
};
function drawHintArrow() {
  const ctx = Render.ctx, h = Game.hint;
  const w = World.toWorld(h.x, h.y), s = Render.w2s(w.x, w.y);
  const b = Math.abs(Math.sin(Render.t * 4)) * 14;
  ctx.save(); ctx.translate(s.x, s.y - 120 - b);
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(14, -30); ctx.lineTo(14, -8); ctx.lineTo(26, -8); ctx.lineTo(0, 20); ctx.lineTo(-26, -8); ctx.lineTo(-14, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

async function boot() {
  Render.init();
  await loadIconImages();
  if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* ignore */ } }
  buildSprites();
  Input.init(); UI.init(); Battle.init();
  // background park for the title screen
  const saved = loadGame();
  if (saved) loadPark(saved); else setupNewPark();
  World.renderTerrain();
  Entities.syncDinos();
  Render.cam.x = World.toWorld(24, 24).x; Render.cam.y = World.toWorld(24, 24).y; Render.cam.zoom = 0.9;
  $('#btnContinue').classList.toggle('hidden', !saved);
  $('#btnNew').textContent = saved ? 'New Park' : 'Start Building';
  $('#btnContinue').addEventListener('click', () => startGame(false));
  $('#btnNew').addEventListener('click', () => {
    if (saved && !confirm('Start a new park? Your current park will be lost.')) return;
    if (saved) { wipeSave(); setupNewPark(); World.renderTerrain(); Entities.visitors = []; Entities.syncDinos(); }
    startGame(true);
  });
  requestAnimationFrame(loop);
  // title camera drift
  Game.titleDrift = true;
  (function drift() { if (!Game.titleDrift) return; Render.cam.x += Math.sin(performance.now() / 6000) * 0.25; requestAnimationFrame(drift); })();
}
function startGame(fresh) {
  Sfx.init();
  Sfx.setVolume(G.settings.vol); Sfx.setMusic(G.settings.music); Sfx.setAmbience(G.settings.ambience);
  Game.titleDrift = false;
  $('#title').classList.add('fade');
  setTimeout(() => $('#title').classList.add('hidden'), 800);
  $('#hud').classList.remove('hidden');
  Game.mode = 'normal'; Game.started = true;
  Game.applyOffline();
  Render.focusTile(25.5, 23, 1.05);
  if (!G.missions.active.length && G.missions.next === 0) {
    UI.advisor('vance', `Welcome to ${G.parkName}, Director! I'm Harriet Vance. The investors trust you to turn this wild island into the greatest dinosaur park in the world.`);
    UI.advisor('reyes', "Tomás Reyes, head ranger. The jungle here is thick – we'll clear it together. And don't worry, the fences are electrified.");
    UI.advisor('quill', "Dr. Mara Quill, genetics. Find me amber and I'll give you dinosaurs. Let's get started!", () => { Game.bulkFill = true; refillMissions(); Game.bulkFill = false; const m = MISSIONS[0]; UI.advisor(m.who, m.text); Game.hintFor(m); });
  } else refillMissions();
  UI.renderTracker();
  UI.hud();
  saveGame();
}
addEventListener('beforeunload', () => { if (Game.started) saveGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && Game.started) saveGame(); });

// wire bus events to UI feedback
Bus.on('levelup', ({ level, reward }) => { UI.levelUp(level, reward); Bus.emit('missions'); });
Bus.on('newMission', m => { if (Game.started && !Game.bulkFill) { UI.advisor(m.who, m.text); Sfx.mission(); } });
Bus.on('decoded', () => { if (UI.modalKind === 'market') UI.renderMarket('dinos'); });
Bus.on('objects', () => Entities.syncDinos());

boot();

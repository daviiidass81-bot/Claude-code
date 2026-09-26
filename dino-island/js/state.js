'use strict';
/* ==========================================================
   Game state, economy rules, missions, save / load
   ========================================================== */
const SAVE_KEY = 'dinoIsland.save.v1';
let G = null;           // the live game state

function newGameState() {
  const seed = (Math.random() * 1e9) | 0;
  return {
    v: 1, seed, created: now(), parkName: 'Dino Island',
    coins: 3000, bucks: 20, crops: 120, meat: 40, level: 1, xp: 0,
    objects: [], nextId: 1,
    roads: '', obs: '',            // encoded grids (filled by World)
    clearing: [],                  // [{i, start, end}]
    amber: {},                     // species -> count
    decoded: { triceratops: true },
    stageResearch: {},             // species -> highest researched stage
    lab: null,                     // {type, species, stage, start, end}
    missions: { next: 0, active: [], progress: {} },
    stats: { cleared: 0, fed: 0, hatched: 0, battlesWon: 0, battles: 0, collected: 0, sinceAmber: 0 },
    league: { best: -1, round: {} },
    pedia: {},                     // species -> {weak:true}
    dayOffset: ((0.375 - (Date.now() / 1000 / 480) % 1) + 1) % 1, // new parks start at 9:00
    tutorialDone: false,
    settings: { vol: 0.8, music: true, ambience: true, daynight: true, quality: 'high' },
    lastTick: now(),
  };
}

/* ---------- definitions helpers ---------- */
function defOf(o) { return o.type === 'paddock' ? SPECIES[o.species] : o.type === 'deco' ? DECOS[o.def] : BUILDINGS[o.def]; }
function coinsEquiv(cost) { return cost.coins || (cost.bucks || 0) * 1500; }
function stageOf(level) { return level >= 30 ? 3 : level >= 20 ? 2 : level >= 10 ? 1 : 0; }
function isAdult(d) { return d.level >= 5; }
function maxLevelForStage(stage) { return stage >= 3 ? MAX_LEVEL : STAGE_LEVELS[stage]; }

function dinoRate(o) { // coins per minute
  if (o.hatchEnd > now()) return 0;
  const sp = SPECIES[o.species];
  return sp.income * (1 + 0.12 * (o.level - 1)) * (1 + 0.5 * (o.stage || 0)) * (1 + (o.bonus || 0) / 100);
}
function dinoCap(o) { return Math.round(dinoRate(o) * STORE_MINUTES); }
function feedCost(o) {
  const sp = SPECIES[o.species];
  return Math.round(8 * RARITY[sp.rarity].food * (1 + 0.45 * (o.level - 1)) * (1 + 0.25 * (o.stage || 0)));
}
function dinoStats(sp, level, stage) {
  const r = RARITY[sp.rarity];
  const lv = 1 + 0.09 * (level - 1), st = 1 + 0.35 * stage;
  return { hp: Math.round(sp.hp * r.hp * lv * st), atk: Math.round(sp.atk * r.atk * lv * st) };
}
function decodeCost(sid) { const sp = SPECIES[sid]; return { coins: Math.round(coinsEquiv(sp.cost) * 0.12 / 10) * 10, time: Math.round(10 + sp.hatch * 0.35) }; }
function evolveCost(sid, stage) { // research cost for stage (1..3)
  const sp = SPECIES[sid];
  return { coins: Math.round(coinsEquiv(sp.cost) * 0.35 * stage / 10) * 10, time: 25 * stage + Math.round(sp.hatch * 0.2 * stage) };
}
function speedCost(msLeft) { return Math.max(1, Math.ceil(msLeft / 60000)); }
function shopIncome(o) { const d = BUILDINGS[o.def]; return Math.round(d.income * (1 + (o.bonus || 0) / 100)); }
function harborOrderCost(o, idx) { const b = BUILDINGS[o.def]; const c = HARBOR_ORDERS[idx].cost; return Math.round(b.food === 'meat' ? c * MEAT_COST_MULT : c); }
function clearTime(kind) {
  const hasRanger = G.objects.some(o => o.def === 'ranger');
  return CLEAR[kind].time * (hasRanger ? 0.75 : 1) * 1000;
}
function clearCost(kind) { return Math.round(CLEAR[kind].cost * (1 + (G.level - 1) * 0.08)); }
function maxWorkers() { return 1 + G.objects.filter(o => o.def === 'ranger').length; }

/* ---------- resources ---------- */
function canAfford(cost) {
  return (G.coins >= (cost.coins || 0)) && (G.bucks >= (cost.bucks || 0)) && (G.crops >= (cost.crops || 0)) && (G.meat >= (cost.meat || 0));
}
function spend(cost) {
  if (!canAfford(cost)) {
    const lack = ['coins', 'bucks', 'crops', 'meat'].find(k => (G[k] || 0) < (cost[k] || 0));
    Bus.emit('lack', lack);
    return false;
  }
  for (const k of ['coins', 'bucks', 'crops', 'meat']) if (cost[k]) G[k] -= cost[k];
  Bus.emit('change');
  return true;
}
function gain(res, amount, from) {
  if (!amount) return;
  G[res] = (G[res] || 0) + amount;
  Bus.emit('gain', { res, amount, from });
  Bus.emit('change');
}
function addXP(n, from) {
  if (!n) return;
  G.xp += n;
  Bus.emit('gain', { res: 'xp', amount: n, from });
  let need = xpForLevel(G.level);
  while (G.xp >= need) {
    G.xp -= need; G.level++;
    const r = levelReward(G.level);
    G.bucks += r.bucks; G.coins += r.coins;
    Bus.emit('levelup', { level: G.level, reward: r });
    need = xpForLevel(G.level);
  }
  Bus.emit('change');
}
function costLabel(cost) {
  if (cost.bucks) return `<i class="ic ic-buck"></i>${fmt(cost.bucks)}`;
  return `<i class="ic ic-coin"></i>${fmt(cost.coins || 0)}`;
}

/* ---------- decoration bonuses & park rating ---------- */
function recomputeBonuses() {
  const decos = G.objects.filter(o => o.type === 'deco');
  for (const o of G.objects) {
    if (o.type === 'deco') continue;
    let b = 0;
    for (const d of decos) {
      const dx = Math.max(o.x - (d.x + d.w - 1), d.x - (o.x + o.w - 1), 0);
      const dy = Math.max(o.y - (d.y + d.h - 1), d.y - (o.y + o.h - 1), 0);
      if (Math.max(dx, dy) <= DECO_RADIUS) b += DECOS[d.def].bonus;
    }
    o.bonus = Math.min(b, 100);
  }
}
function parkScore() {
  const dinos = G.objects.filter(o => o.type === 'paddock');
  const species = new Set(dinos.map(d => d.species)).size;
  const shops = G.objects.filter(o => o.type === 'building' && BUILDINGS[o.def].kind === 'shop').length;
  const decoBonus = G.objects.filter(o => o.type === 'deco').reduce((s, d) => s + DECOS[d.def].bonus, 0);
  const levels = dinos.reduce((s, d) => s + d.level + (d.stage || 0) * 8, 0);
  return species * 18 + dinos.length * 6 + shops * 8 + decoBonus * 1.5 + levels * 0.8;
}
function parkStars() { const s = parkScore(); return s < 40 ? 1 : s < 110 ? 2 : s < 220 ? 3 : s < 400 ? 4 : 5; }
function visitorTarget() {
  const roads = World.roadCount;
  const s = parkScore();
  return Math.min(Math.round(4 + s * 0.28), Math.round(roads * 1.6 + 2), 140);
}

/* ---------- objects ---------- */
function makeObject(type, def, x, y) {
  let w, h;
  if (type === 'paddock') { const s = SPECIES[def].pad; w = h = s; }
  else if (type === 'deco') [w, h] = DECOS[def].size;
  else [w, h] = BUILDINGS[def].size;
  const o = { id: G.nextId++, type, x, y, w, h };
  if (type === 'paddock') {
    const sp = SPECIES[def];
    Object.assign(o, { species: def, level: 1, feeds: 0, stage: 0, coins: 0, hatchEnd: now() + sp.hatch * 1000, hatchStart: now() });
  } else {
    o.def = def;
    const b = type === 'building' ? BUILDINGS[def] : null;
    if (b && (b.kind === 'shop' || b.kind === 'center')) o.start = now();
    if (b && b.kind === 'harbor') o.order = null;
  }
  return o;
}
function addObject(o) { G.objects.push(o); World.rebuildOcc(); recomputeBonuses(); Bus.emit('objects'); }
function removeObject(o) { G.objects = G.objects.filter(x => x !== o); World.rebuildOcc(); recomputeBonuses(); Bus.emit('objects'); }
function objById(id) { return G.objects.find(o => o.id === id); }
function countDef(def) { return G.objects.filter(o => o.def === def).length; }
function ownedSpecies() { return new Set(G.objects.filter(o => o.type === 'paddock').map(o => o.species)); }

/* ---------- missions ---------- */
function missionCheckState(m) {
  const g = m.goal;
  switch (g.type) {
    case 'level': return G.level >= g.level ? 1 : 0;
    case 'dino_level': return G.objects.some(o => o.type === 'paddock' && (!g.species || o.species === g.species) && o.level >= g.level) ? 1 : 0;
    case 'visitors': return Math.min(g.count, Entities.visitors.length);
    case 'species': return Math.min(g.count, ownedSpecies().size);
    case 'league': return G.league.best >= LEAGUES.findIndex(l => l.id === g.league) ? 1 : 0;
    case 'build': return Math.min(g.count, countDef(g.id) > 0 ? Math.max(G.missions.progress[m.id] || 0, 1) : (G.missions.progress[m.id] || 0));
    default: return null;
  }
}
function missionTarget(m) { return ['level', 'dino_level', 'league'].includes(m.goal.type) ? 1 : m.goal.count; }
function missionProgress(m) {
  const st = missionCheckState(m);
  if (st !== null && m.goal.type !== 'build') return st;
  return Math.min(missionTarget(m), G.missions.progress[m.id] || 0);
}
function missionDone(m) { return missionProgress(m) >= missionTarget(m); }
function refillMissions() {
  const ms = G.missions;
  let added = false;
  while (ms.active.length < 3 && ms.next < MISSIONS.length) {
    const m = MISSIONS[ms.next++];
    ms.active.push(m.id);
    if (m.goal.type === 'build' && countDef(m.goal.id) > 0) ms.progress[m.id] = 1;
    Bus.emit('newMission', m);
    added = true;
  }
  if (added) Bus.emit('missions');
}
function missionEvent(type, data = {}) {
  let changed = false;
  for (const id of G.missions.active) {
    const m = MISSIONS.find(x => x.id === id), g = m.goal;
    if (g.type !== type) continue;
    if (g.id && data.id !== g.id) continue;
    if (g.species && data.species !== g.species) continue;
    G.missions.progress[id] = (G.missions.progress[id] || 0) + (data.n || 1);
    changed = true;
  }
  if (changed) Bus.emit('missions');
}
function claimMission(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m || !missionDone(m)) return false;
  G.missions.active = G.missions.active.filter(x => x !== id);
  const r = m.reward;
  if (r.coins) gain('coins', r.coins, 'mission');
  if (r.bucks) gain('bucks', r.bucks, 'mission');
  if (r.xp) addXP(r.xp, 'mission');
  Sfx.mission();
  Bus.emit('missionDone', m);
  refillMissions();
  Bus.emit('missions');
  return true;
}

/* ---------- amber & lab ---------- */
function rollAmber(force) {
  // choose a species not yet decoded, near the player's level
  const cands = SPECIES_ORDER.filter(s => !G.decoded[s] && !SPECIES[s].cost.bucks && SPECIES[s].level <= G.level + 3);
  if (!cands.length) return null;
  G.stats.sinceAmber++;
  if (!force && Math.random() > AMBER_CHANCE && G.stats.sinceAmber < 6) return null;
  G.stats.sinceAmber = 0;
  // weight towards lower levels
  cands.sort((a, b) => SPECIES[a].level - SPECIES[b].level);
  const pickIdx = Math.min(cands.length - 1, Math.floor(Math.pow(Math.random(), 1.8) * cands.length));
  const sid = cands[pickIdx];
  G.amber[sid] = (G.amber[sid] || 0) + 1;
  return sid;
}
function amberCount() { return Object.values(G.amber).reduce((a, b) => a + b, 0); }
function startLab(task) {
  if (G.lab) return false;
  G.lab = task;
  Bus.emit('lab');
  return true;
}
function finishLab() {
  const t = G.lab;
  if (!t) return;
  G.lab = null;
  if (t.type === 'decode') {
    G.decoded[t.species] = true;
    missionEvent('decode', { species: t.species });
    Bus.emit('decoded', t.species);
    addXP(40 + SPECIES[t.species].level * 10, 'lab');
  } else {
    G.stageResearch[t.species] = Math.max(G.stageResearch[t.species] || 0, t.stage);
    Bus.emit('researched', t);
    addXP(80 * t.stage, 'lab');
  }
  Bus.emit('lab');
}

/* ---------- save / load ---------- */
function saveGame() {
  if (!G) return;
  try {
    G.roads = World.encodeRoads();
    G.obs = World.encodeObs();
    G.lastTick = now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
  } catch (e) { /* storage may be unavailable */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    const base = newGameState();
    for (const k in base) if (s[k] === undefined) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] === undefined) s.stats[k] = base.stats[k];
    for (const k in base.settings) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
    return s;
  } catch (e) { return null; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

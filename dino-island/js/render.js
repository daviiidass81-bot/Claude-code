'use strict';
/* ==========================================================
   Render: camera, world drawing, depth sorting, lighting
   ========================================================== */
const Render = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  cam: { x: 0, y: 700, zoom: 1, tx: null, ty: null, tz: null },
  t: 0, shakeAmt: 0, shakeX: 0, shakeY: 0,
  hits: [], lights: [], hover: null, ghost: null, roadMode: null, selected: null,
  weather: { rain: 0, target: 0, timer: 90 }, drops: [], clouds: [],
  floorCache: {},

  init() {
    this.cv = $('#game'); this.ctx = this.cv.getContext('2d');
    this.lightCv = document.createElement('canvas'); this.lightCtx = this.lightCv.getContext('2d');
    this.resize();
    addEventListener('resize', () => this.resize());
    Sprites.roads = [];
    for (let m = 0; m < 16; m++) Sprites.roads[m] = paintRoad(m);
    for (let i = 0; i < 7; i++) this.clouds.push({ x: rand(-MAP * TW / 2, MAP * TW / 2), y: rand(0, MAP * TH), s: rand(0.8, 1.6), v: rand(8, 16) });
    this.cloudSpr = makeSprite(420, 200, 210, 100, ctx => {
      const rng = mulberry32(9);
      for (let i = 0; i < 14; i++) {
        const x = (rng() - 0.5) * 300, y = (rng() - 0.5) * 110, r = 40 + rng() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,15,25,0.11)'); g.addColorStop(1, 'rgba(0,15,25,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    });
    this.cloudSky = makeSprite(300, 120, 150, 60, ctx => {
      const rng = mulberry32(12);
      for (let i = 0; i < 18; i++) {
        const x = (rng() - 0.5) * 220, y = (rng() - 0.3) * 50 - Math.abs(x) * 0.12, r = 18 + rng() * 26;
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(235,242,250,0.85)'); g.addColorStop(1, 'rgba(210,225,240,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    });
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.lightCv.width = Math.ceil(this.W / 2); this.lightCv.height = Math.ceil(this.H / 2);
  },
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); },

  /* ---------- coordinate transforms ---------- */
  w2s(wx, wy) { const c = this.cam; return { x: (wx - c.x) * c.zoom + this.W / 2 + this.shakeX, y: (wy - c.y) * c.zoom + this.H / 2 + this.shakeY }; },
  s2w(sx, sy) { const c = this.cam; return { x: (sx - this.W / 2) / c.zoom + c.x, y: (sy - this.H / 2) / c.zoom + c.y }; },
  s2t(sx, sy) { const w = this.s2w(sx, sy); const t = World.fromWorld(w.x, w.y); return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y }; },
  onScreen(tx, ty, m = 100) { const w = World.toWorld(tx, ty); const s = this.w2s(w.x, w.y); return s.x > -m && s.y > -m && s.x < this.W + m && s.y < this.H + m; },
  clampCam() {
    const c = this.cam;
    c.zoom = clamp(c.zoom, 0.35, 2.2);
    c.x = clamp(c.x, -MAP * TW / 2 * 0.85, MAP * TW / 2 * 0.85);
    c.y = clamp(c.y, MAP * TH * 0.1, MAP * TH * 0.95);
  },
  focusTile(x, y, zoom) { const w = World.toWorld(x, y); this.cam.tx = w.x; this.cam.ty = w.y; if (zoom) this.cam.tz = zoom; },

  /* ---------- main frame ---------- */
  frame(dt) {
    this.t += dt;
    const c = this.cam;
    if (c.tx !== null) {
      const k = 1 - Math.pow(0.002, dt);
      c.x = lerp(c.x, c.tx, k); c.y = lerp(c.y, c.ty, k);
      if (c.tz) c.zoom = lerp(c.zoom, c.tz, k);
      if (Math.hypot(c.x - c.tx, c.y - c.ty) < 1 && (!c.tz || Math.abs(c.zoom - c.tz) < 0.01)) { c.tx = c.ty = c.tz = null; }
    }
    this.clampCam();
    if (this.shakeAmt > 0.1) { this.shakeX = rand(-1, 1) * this.shakeAmt; this.shakeY = rand(-1, 1) * this.shakeAmt; this.shakeAmt *= Math.pow(0.02, dt); } else this.shakeX = this.shakeY = 0;
    this.updateWeather(dt);

    const ctx = this.ctx, d = this.dpr;
    this.hits = []; this.lights = [];
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawOcean(ctx);
    ctx.setTransform(d * c.zoom, 0, 0, d * c.zoom, d * (this.W / 2 - c.x * c.zoom + this.shakeX), d * (this.H / 2 - c.y * c.zoom + this.shakeY));
    this.worldTransform = ctx.getTransform();
    // terrain
    if (World.terrain) ctx.drawImage(World.terrain, -World.terrainOX, -World.terrainOY, World.terrain.width / TSCALE, World.terrain.height / TSCALE);
    this.drawFoam(ctx);
    this.drawBoats(ctx);
    const view = this.viewTiles();
    this.drawGround(ctx, view);
    this.drawScene(ctx, view);
    this.drawParticles(ctx);
    this.drawOverlays(ctx, view);
    // sky layer
    this.drawCloudShadows(ctx);
    this.drawBirds(ctx);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawLighting(ctx);
    this.drawRain(ctx, dt);
    this.drawFloats();
  },
  viewTiles() {
    const pts = [[0, 0], [this.W, 0], [0, this.H], [this.W, this.H]].map(([x, y]) => this.s2t(x, y));
    const xs = pts.map(p => p.fx), ys = pts.map(p => p.fy);
    return { x0: Math.max(0, Math.floor(Math.min(...xs)) - 3), x1: Math.min(MAP - 1, Math.ceil(Math.max(...xs)) + 3), y0: Math.max(0, Math.floor(Math.min(...ys)) - 3), y1: Math.min(MAP - 1, Math.ceil(Math.max(...ys)) + 3) };
  },

  /* ---------- ocean ---------- */
  drawOcean(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#1a6f8e'); g.addColorStop(1, '#0f5474');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    const c = this.cam, t = this.t;
    ctx.save();
    ctx.setTransform(this.dpr * c.zoom, 0, 0, this.dpr * c.zoom, this.dpr * (this.W / 2 - c.x * c.zoom), this.dpr * (this.H / 2 - c.y * c.zoom));
    const tl = this.s2w(0, 0), br = this.s2w(this.W, this.H);
    const sx = 80, sy = 40;
    ctx.lineCap = 'round';
    for (let y = Math.floor(tl.y / sy) * sy; y < br.y + sy; y += sy) {
      for (let x = Math.floor(tl.x / sx) * sx; x < br.x + sx; x += sx) {
        const h = hash2(x / sx | 0, y / sy | 0, 3);
        const ox = x + h * 60 + Math.sin(t * 0.6 + h * 10) * 8, oy = y + hash2(x, y, 5) * 30;
        const a = 0.07 + 0.08 * Math.max(0, Math.sin(t * 1.2 + h * 20));
        ctx.strokeStyle = `rgba(210,245,255,${a})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(ox - 10, oy); ctx.quadraticCurveTo(ox, oy - 3, ox + 10, oy); ctx.stroke();
      }
    }
    ctx.restore();
  },
  drawFoam(ctx) {
    const t = this.t, v = this.viewTiles();
    ctx.lineCap = 'round';
    for (const s of World.shore) {
      if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
      let a, b, dz = 0, nx, ny;
      if (s.e === 'e') { a = World.toWorld(s.x + 1, s.y); b = World.toWorld(s.x + 1, s.y + 1); dz = CLIFF; nx = 0.9; ny = 0.45; }
      else if (s.e === 's') { a = World.toWorld(s.x, s.y + 1); b = World.toWorld(s.x + 1, s.y + 1); dz = CLIFF; nx = -0.9; ny = 0.45; }
      else if (s.e === 'n') { a = World.toWorld(s.x, s.y); b = World.toWorld(s.x + 1, s.y); nx = 0.9; ny = -0.45; }
      else { a = World.toWorld(s.x, s.y); b = World.toWorld(s.x, s.y + 1); nx = -0.9; ny = -0.45; }
      const ph = t * 1.4 + s.x * 0.7 + s.y * 0.45;
      const off = 3 + Math.sin(ph) * 2.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(ph)})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(a.x + nx * off, a.y + dz + ny * off); ctx.lineTo(b.x + nx * off, b.y + dz + ny * off); ctx.stroke();
      const off2 = 9 + Math.sin(ph + 1.5) * 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.1 * Math.sin(ph + 1.5)})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.x + nx * off2, a.y + dz + ny * off2); ctx.lineTo(b.x + nx * off2, b.y + dz + ny * off2); ctx.stroke();
    }
  },

  /* ---------- supply boats sailing to the harbors ---------- */
  drawBoats(ctx) {
    const nowT = now(), t = this.t;
    for (const o of G.objects) {
      if (o.type !== 'building' || BUILDINGS[o.def].kind !== 'harbor' || !o.order) continue;
      const route = this.boatRoute(o);
      if (!route) continue;
      const k = clamp((nowT - o.order.start) / (o.order.end - o.order.start), 0, 1);
      const arrived = k >= 1;
      const e = arrived ? 1 : easeInOut(Math.min(1, k * 1.02));
      const x = lerp(route.a.x, route.b.x, e), y = lerp(route.a.y, route.b.y, e);
      const dir = route.b.x > route.a.x ? 1 : -1;
      const big = o.order.idx >= 2;
      // wake
      if (!arrived) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) { const bx = x - (route.b.x - route.a.x) * 0.012 * i * 3, by = y - (route.b.y - route.a.y) * 0.012 * i * 3; ctx.beginPath(); ctx.ellipse(bx, by + 4, 10 + i * 6, 3 + i * 1.5, 0, 0, TAU); ctx.globalAlpha = 0.5 / i; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      drawBoat(ctx, x, y + Math.sin(t * 2 + o.id) * 1.5, dir, BUILDINGS[o.def].food, big, t);
      this.lights.push({ x: x + dir * 18, y: y - 26, r: 40, col: 'rgba(255,230,160,' });
    }
  },
  boatRoute(o) {
    if (o._route && o._route.x === o.x && o._route.y === o.y) return o._route.r;
    let best = null, bd = 1e9;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    for (const s of World.shore) {
      if (s.e !== 'e' && s.e !== 's') continue;
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    const out = best.e === 'e' ? [1, 0] : [0, 1];
    const b = World.toWorld(best.x + 0.5 + out[0] * 2.2, best.y + 0.5 + out[1] * 2.2);
    const a = World.toWorld(best.x + 0.5 + out[0] * 26 + out[1] * 8, best.y + 0.5 + out[1] * 26 + out[0] * 8);
    b.y += CLIFF; a.y += CLIFF;
    o._route = { x: o.x, y: o.y, r: { a, b } };
    return o._route.r;
  },

  /* ---------- ground layer: roads, paddock floors, ghosts ---------- */
  drawGround(ctx, v) {
    for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) {
      if (!World.roads[World.idx(x, y)]) continue;
      const m = (World.isRoad(x, y - 1) ? 1 : 0) | (World.isRoad(x + 1, y) ? 2 : 0) | (World.isRoad(x, y + 1) ? 4 : 0) | (World.isRoad(x - 1, y) ? 8 : 0);
      const w = World.toWorld(x, y);
      drawSprite(ctx, Sprites.roads[m], w.x, w.y);
    }
    for (const o of G.objects) {
      if (o.type !== 'paddock') continue;
      if (o.x + o.w < v.x0 || o.x > v.x1 + 1 || o.y + o.h < v.y0 || o.y > v.y1 + 1) continue;
      const f = this.floor(o.w, SPECIES[o.species]);
      const w = World.toWorld(o.x, o.y);
      drawSprite(ctx, f, w.x, w.y);
      // floodlights on the fence corners
      if (World.night > 0.05 && !SPECIES[o.species].aviary) for (const [cx, cy] of [[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.h], [o.x + o.w, o.y + o.h]]) { const p = World.toWorld(cx, cy); this.lights.push({ x: p.x, y: p.y - 36, r: 70, col: 'rgba(255,230,160,' }); }
    }
    // selection outline
    if (this.selected && G.objects.includes(this.selected)) {
      const o = this.selected;
      this.diamondPath(ctx, o.x, o.y, o.w, o.h);
      ctx.strokeStyle = `rgba(255,212,121,${0.6 + 0.3 * Math.sin(this.t * 5)})`; ctx.lineWidth = 3 / this.cam.zoom; ctx.stroke();
    }
    // placement ghost footprint
    const g = this.ghost;
    if (g) {
      this.diamondPath(ctx, g.x, g.y, g.w, g.h);
      ctx.fillStyle = g.valid ? 'rgba(120,255,120,0.28)' : 'rgba(255,80,60,0.35)'; ctx.fill();
      ctx.strokeStyle = g.valid ? 'rgba(160,255,140,0.9)' : 'rgba(255,90,70,0.9)'; ctx.lineWidth = 2 / this.cam.zoom; ctx.stroke();
      if (g.type === 'deco') { // show bonus radius
        this.diamondPath(ctx, g.x - DECO_RADIUS, g.y - DECO_RADIUS, g.w + DECO_RADIUS * 2, g.h + DECO_RADIUS * 2);
        ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,230,140,0.7)'; ctx.stroke(); ctx.setLineDash([]);
      }
      if (g.type === 'paddock') { const f = this.floor(g.w, SPECIES[g.def]); const w = World.toWorld(g.x, g.y); drawSprite(ctx, f, w.x, w.y, 1, 0.6); }
    }
    // road tool hover
    if (this.roadMode && this.hover) {
      const h = this.hover, ok = this.roadMode === 'erase' ? World.isRoad(h.x, h.y) : World.canPlace(h.x, h.y, 1, 1);
      this.diamondPath(ctx, h.x, h.y, 1, 1);
      ctx.fillStyle = ok ? (this.roadMode === 'erase' ? 'rgba(255,120,80,0.4)' : 'rgba(255,240,180,0.4)') : 'rgba(255,60,40,0.3)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5 / this.cam.zoom; ctx.stroke();
    }
    // clear-able obstacle hover
    if (!this.roadMode && !g && this.hover && World.inMap(this.hover.x, this.hover.y) && World.obs[World.idx(this.hover.x, this.hover.y)]) {
      this.diamondPath(ctx, this.hover.x, this.hover.y, 1, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 / this.cam.zoom; ctx.stroke();
    }
  },
  diamondPath(ctx, x, y, w, h) {
    const a = World.toWorld(x, y), b = World.toWorld(x + w, y), c = World.toWorld(x + w, y + h), d = World.toWorld(x, y + h);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  },
  floor(size, sp) {
    const kind = sp.aviary ? 'aviary' : sp.diet === 'carn' ? 'dirt' : 'grass';
    const key = kind + size;
    if (!this.floorCache[key]) this.floorCache[key] = paintFloor(size, kind);
    return this.floorCache[key];
  },

  /* ---------- depth-sorted scene ---------- */
  drawScene(ctx, v) {
    const list = [];
    const t = this.t;
    // obstacles
    for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) {
      const k = World.obs[World.idx(x, y)];
      if (!k) continue;
      list.push({ d: x + y + 1, k: 'obs', x, y, kind: OBS_KIND[k] });
    }
    // volcano
    const vo = World.volcano;
    list.push({ d: vo.x + vo.y + 1, k: 'volcano' });
    // objects
    for (const o of G.objects) {
      if (o.x + o.w < v.x0 - 2 || o.x > v.x1 + 2 || o.y + o.h < v.y0 - 2 || o.y > v.y1 + 2) continue;
      if (this.ghost && this.ghost.moving === o) continue;
      if (o.type === 'paddock') this.pushPaddock(list, o);
      else list.push({ d: o.x + o.y + (o.w + o.h) / 2, k: 'obj', o });
    }
    for (const vis of Entities.visitors) list.push({ d: vis.x + vis.y, k: 'vis', v: vis });
    for (const j of Entities.jeeps) list.push({ d: j.x + j.y, k: 'jeep', j });
    for (const c of G.clearing) { const x = c.i % MAP, y = Math.floor(c.i / MAP); list.push({ d: x + y + 1.3, k: 'worker', c, x, y }); }
    if (this.ghost && this.ghost.type !== 'paddock') { const g = this.ghost; list.push({ d: g.x + g.y + (g.w + g.h) / 2, k: 'ghost', g }); }
    list.sort((a, b) => a.d - b.d);
    for (const it of list) this.drawItem(ctx, it, t);
  },
  pushPaddock(list, o) {
    const sp = SPECIES[o.species];
    const base = o.x + o.y;
    if (sp.aviary) {
      list.push({ d: base + 0.2, k: 'cageBack', o });
      list.push({ d: o.x + o.y + o.w + o.h - 0.2, k: 'cageFront', o });
    } else {
      // back fences (north edge along u, west edge along v)
      for (let i = 0; i < o.w; i++) list.push({ d: base + i * 0.5 - 0.5, k: 'fence', s: 'u', x: o.x + i, y: o.y });
      for (let j = 0; j < o.h; j++) list.push({ d: base + j * 0.5 - 0.5, k: 'fence', s: 'v', x: o.x, y: o.y + j });
      // front fences
      const gateI = Math.floor(o.w / 2);
      for (let i = 0; i < o.w; i++) list.push({ d: (o.x + i + 0.5) + (o.y + o.h) + 0.6, k: 'fence', s: i === gateI ? 'gu' : 'u', x: o.x + i, y: o.y + o.h });
      for (let j = 0; j < o.h; j++) list.push({ d: (o.x + o.w) + (o.y + j + 0.5) + 0.6, k: 'fence', s: 'v', x: o.x + o.w, y: o.y + j });
      list.push({ d: o.x + o.w + o.y + o.h + 0.7, k: 'post', x: o.x + o.w, y: o.y + o.h });
    }
    // interior plants
    const r = hash2(o.id, 7, 1);
    const plants = sp.diet === 'herb' ? [['tree', 0.9, 0.9], ['bush', o.w - 0.7, 0.7], ['bush', 0.7, o.h - 0.8]] : [['rock', 0.8, 0.9], ['bush', o.w - 0.7, 0.7], ['tree', 0.8, o.h - 0.9]];
    if (sp.aviary) plants.length = 1;
    plants.forEach(([kind, px, py], i) => list.push({ d: o.x + px + o.y + py, k: 'plant', kind, x: o.x + px, y: o.y + py, v: Math.floor(r * 10 + i * 3) }));
    // trough
    if (!sp.aviary) list.push({ d: o.x + o.w - 1.2 + o.y + o.h - 0.55, k: 'trough', x: o.x + o.w - 1.2, y: o.y + o.h - 0.55, diet: sp.diet });
    const a = Entities.dinos.get(o.id);
    if (o.hatchEnd > now()) list.push({ d: o.x + o.y + o.w / 2 + o.h / 2, k: 'egg', o });
    else if (a) list.push({ d: a.x + a.y + (a.fly ? 0 : 0), k: 'dino', a, o });
  },
  drawItem(ctx, it, t) {
    switch (it.k) {
      case 'obs': {
        const arr = Sprites.trees[it.kind];
        const s = arr[Math.floor(hash2(it.x, it.y, 11) * arr.length)];
        const w = World.toWorld(it.x + 0.5, it.y + 0.5);
        const clearing = G.clearing.find(c => c.i === World.idx(it.x, it.y));
        let sway = 0;
        if (it.kind === 'tree' || it.kind === 'palm') sway = Math.sin(t * 1.1 + it.x * 0.7 + it.y * 1.3) * 0.02 + (this.weather.rain * 0.02) * Math.sin(t * 3 + it.x);
        if (clearing) sway += Math.sin(t * 20) * 0.03;
        const jx = hash2(it.x, it.y, 21) * 10 - 5, jy = hash2(it.x, it.y, 22) * 6 - 3;
        if (sway) { ctx.save(); ctx.translate(w.x + jx, w.y + jy); ctx.transform(1, 0, sway, 1, 0, 0); drawSprite(ctx, s, 0, 0); ctx.restore(); }
        else drawSprite(ctx, s, w.x + jx, w.y + jy);
        const hr = s.hitR || 18, hh = s.hitH || 30;
        this.addHit(w.x - hr, w.y - hh, w.x + hr, w.y + 6, it.x + it.y, { kind: 'obs', x: it.x, y: it.y });
        break;
      }
      case 'volcano': {
        const w = World.toWorld(World.volcano.x + 0.5, World.volcano.y + 0.5);
        drawSprite(ctx, Sprites.misc.volcano, w.x, w.y + 40);
        const cy = w.y + 40 - 250;
        if (Math.random() < 0.08) Entities.emit(w.x + rand(-20, 20), cy, 'smoke', 1, { wind: 10 });
        if (Math.random() < 0.05) Entities.emit(w.x + rand(-20, 20), cy, 'ember', 2);
        const glow = 0.55 + 0.2 * Math.sin(t * 2);
        this.lights.push({ x: w.x, y: cy, r: 190 * glow, col: 'rgba(255,110,30,' });
        break;
      }
      case 'obj': this.drawObject(ctx, it.o, t); break;
      case 'fence': {
        const s = Sprites.fences[it.s];
        const w = World.toWorld(it.x, it.y);
        drawSprite(ctx, s, w.x, w.y);
        break;
      }
      case 'post': { const w = World.toWorld(it.x, it.y); drawSprite(ctx, Sprites.fences.post, w.x, w.y); break; }
      case 'plant': {
        const arr = Sprites.trees[it.kind];
        const s = arr[it.v % arr.length];
        const w = World.toWorld(it.x, it.y);
        drawSprite(ctx, s, w.x, w.y, it.kind === 'tree' ? 0.75 : 0.9);
        break;
      }
      case 'trough': { const w = World.toWorld(it.x, it.y); drawSprite(ctx, Sprites.misc.trough, w.x, w.y); break; }
      case 'egg': this.drawEgg(ctx, it.o, t); break;
      case 'dino': this.drawDino(ctx, it.a, it.o, t); break;
      case 'cageBack': this.drawCage(ctx, it.o, false); break;
      case 'cageFront': this.drawCage(ctx, it.o, true); break;
      case 'vis': this.drawVisitor(ctx, it.v, t); break;
      case 'jeep': { const w = World.toWorld(it.j.x, it.j.y); drawJeepIso(ctx, [w.x, w.y], 0.9, it.j.d); break; }
      case 'worker': this.drawWorker(ctx, it, t); break;
      case 'ghost': {
        const g = it.g, w = World.toWorld(g.x, g.y);
        const s = g.type === 'deco' ? Sprites.decos[g.def] : Sprites.buildings[g.def];
        drawSprite(ctx, s, w.x, w.y, 1, 0.75);
        break;
      }
    }
  },
  drawObject(ctx, o, t) {
    const w = World.toWorld(o.x, o.y);
    const s = o.type === 'deco' ? Sprites.decos[o.def] : Sprites.buildings[o.def];
    drawSprite(ctx, s, w.x, w.y);
    // animated extras
    const I = (u, v, z) => ({ x: w.x + (u - v) * TW / 2, y: w.y + (u + v) * TH / 2 - z });
    if (s.torches) for (const [u, v, z] of s.torches) { const p = I(u, v, z); this.flame(ctx, p.x, p.y, t + u * 3, 1); }
    if (s.flags) for (const [u, v, z] of s.flags) { const p = I(u, v, z); this.flag(ctx, p.x, p.y, t + u, '#e0513a'); }
    if (s.fountain) { const [u, v, z, zb] = s.fountain; const p = I(u, v, z); this.fountainWater(ctx, p.x, p.y, t, zb); }
    if (s.waterfall) { const [u, v, z, u2, v2] = s.waterfall; const a = I(u, v, z), b = I(u2, v2, 2); this.waterfallWater(ctx, a, b, t); }
    if (s.heli) { const [u, v, z] = s.heli; const p = I(u, v, z); this.helicopter(ctx, p.x, p.y, t); }
    if (s.lights) for (const L of s.lights) this.lights.push({ x: w.x + L.x, y: w.y + L.y, r: L.r, col: L.col });
    if (s.lit && World.night > 0.05) this.litLayers.push({ s, x: w.x, y: w.y });
    // hit polygon: footprint diamond extruded upwards
    const hgt = Math.min(s.ay - 24, 160);
    const a = World.toWorld(o.x, o.y), b = World.toWorld(o.x + o.w, o.y), c = World.toWorld(o.x + o.w, o.y + o.h), d = World.toWorld(o.x, o.y + o.h);
    this.addHitPoly([[a.x, a.y - hgt], [b.x, b.y - hgt], [b.x, b.y], [c.x, c.y], [d.x, d.y], [d.x, d.y - hgt]], o.x + o.y + (o.w + o.h) / 2, { kind: 'obj', o });
  },
  drawDino(ctx, a, o, t) {
    const w = World.toWorld(a.x, a.y);
    const sp = SPECIES[o.species];
    const scale = DINO_WORLD_SCALE * sp.size;
    let pose = a.pose;
    if (a.state === 'walk' || a.state === 'toEat') pose = pose === 'roar' ? 'roar' : 'walk';
    DinoArt.draw(ctx, o.species, w.x, w.y, scale, { stage: o.stage || 0, dir: a.dir, t: t + a.t0, pose, speed: a.speed, phase: a.phase, growth: a.growth(), fly: sp.aviary ? a.fly : 0 });
    if (pose === 'sleep' && Math.sin(t * 2 + a.t0) > 0) drawSprite(ctx, Sprites.icons.zzz, w.x + a.dir * 20, w.y - 50 * scale - Math.sin(t) * 5, 0.8);
    const sz = DinoArt.size(o.species);
    const hw = sz.len * scale * a.growth() * 0.45, hh = (sz.h * scale * a.growth()) + (sp.aviary ? a.fly : 0) + 20;
    this.addHit(w.x - hw, w.y - hh, w.x + hw, w.y + 6, a.x + a.y + 0.5, { kind: 'dino', o });
  },
  drawEgg(ctx, o, t) {
    const w = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    drawSprite(ctx, Sprites.misc.nest, w.x, w.y);
    const total = o.hatchEnd - o.hatchStart, k = clamp(1 - (o.hatchEnd - now()) / total, 0, 1);
    const wob = k > 0.7 ? Math.sin(t * (10 + k * 20)) * 0.08 * k : Math.sin(t * 2) * 0.02;
    const sp = SPECIES[o.species], pal = sp.pals[0];
    ctx.save(); ctx.translate(w.x, w.y - 2); ctx.rotate(wob);
    const g = ctx.createRadialGradient(-5, -22, 2, 0, -14, 18);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, mix('#f0e6d0', pal.base, 0.25)); g.addColorStop(1, mix('#b8a888', pal.dark, 0.3));
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.bezierCurveTo(12, -30, 14, -6, 11, -2); ctx.quadraticCurveTo(0, 4, -11, -2); ctx.bezierCurveTo(-14, -6, -12, -30, 0, -30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(pal.dark, 0.55);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(hash2(o.id, i, 1) * 16 - 8, -hash2(o.id, i, 2) * 24 - 4, 1.8, 1.2, 0, 0, TAU); ctx.fill(); }
    if (k > 0.5) { ctx.strokeStyle = 'rgba(40,20,5,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-2, -15); ctx.lineTo(1, -19); ctx.lineTo(4, -14); if (k > 0.8) { ctx.lineTo(8, -17); ctx.moveTo(-2, -15); ctx.lineTo(-3, -10); } ctx.stroke(); }
    ctx.restore();
    // incubator lamps
    const lamp = World.toWorld(o.x + o.w / 2 - 0.5, o.y + o.h / 2 - 0.5);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lamp.x, lamp.y); ctx.lineTo(lamp.x, lamp.y - 44); ctx.lineTo(w.x - 4, w.y - 50); ctx.stroke();
    ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(w.x - 4, w.y - 48, 3.5, 0, TAU); ctx.fill();
    const hg = ctx.createRadialGradient(w.x, w.y - 16, 2, w.x, w.y - 16, 30);
    hg.addColorStop(0, 'rgba(255,170,80,0.3)'); hg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(w.x, w.y - 16, 30, 0, TAU); ctx.fill();
    this.lights.push({ x: w.x, y: w.y - 30, r: 60, col: 'rgba(255,160,70,' });
    this.addHit(w.x - 18, w.y - 34, w.x + 18, w.y + 6, o.x + o.y + o.w, { kind: 'dino', o });
  },
  drawCage(ctx, o, front) {
    const c = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
    const rx = o.w * TW / 2 * 0.92, ry = o.h * TH / 2 * 0.92, h = 150;
    ctx.save();
    ctx.strokeStyle = front ? 'rgba(40,46,50,0.55)' : 'rgba(40,46,50,0.4)'; ctx.lineWidth = 1.2;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = Math.sin(a);
      if ((s >= 0) !== front) continue;
      const bx = c.x + Math.cos(a) * rx, by = c.y + s * ry;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(c.x + Math.cos(a) * rx * 1.02, c.y + s * ry - h * 1.05, c.x, c.y - h); ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const f = k / 4, rr = Math.sqrt(1 - f * f);
      ctx.beginPath(); ctx.ellipse(c.x, c.y - h * f * 0.95, rx * rr, ry * rr, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
    }
    if (front) {
      ctx.lineWidth = 3; ctx.strokeStyle = '#6a6e70'; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(c.x, c.y - h, 3, 0, TAU); ctx.fill();
      this.lights.push({ x: c.x, y: c.y - h, r: 40, col: 'rgba(255,220,120,' });
    } else {
      ctx.lineWidth = 3; ctx.strokeStyle = '#5a5e60'; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, TAU); ctx.stroke();
    }
    ctx.restore();
  },
  drawVisitor(ctx, v, t) {
    const w = World.toWorld(v.x, v.y);
    const alpha = v.fade > 0 ? 1 - v.fade : Math.min(1, v.age * 2);
    drawPerson(ctx, w.x, w.y, v, v.stop > 0 ? 0 : v.phase, alpha, t);
    if (v.flash > 0) { this.lights.push({ x: w.x, y: w.y - 14, r: 30, col: 'rgba(255,255,255,' }); ctx.fillStyle = `rgba(255,255,255,${v.flash * 5})`; ctx.beginPath(); ctx.arc(w.x + v.dir * 4, w.y - 15, 5, 0, TAU); ctx.fill(); }
  },
  drawWorker(ctx, it, t) {
    const w = World.toWorld(it.x + 0.85, it.y + 0.95);
    const kind = OBS_KIND[World.obs[it.c.i]];
    const rocky = kind === 'rock' || kind === 'bigrock';
    const swing = Math.sin(t * 9);
    ctx.save(); ctx.translate(w.x, w.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1.5, -7); ctx.lineTo(-2.5, 0); ctx.moveTo(1.5, -7); ctx.lineTo(2.5, 0); ctx.stroke();
    ctx.fillStyle = '#6a7a3a'; roundRect(ctx, -3.2, -15, 6.4, 8.5, 2); ctx.fill();
    ctx.fillStyle = '#e8b58e'; ctx.beginPath(); ctx.arc(0, -17.5, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.ellipse(0, -19, 4.5, 1.4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -19.5, 2.6, Math.PI, TAU); ctx.fill();
    ctx.save(); ctx.translate(-1, -13); ctx.rotate(-1.2 + swing * 0.9);
    ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
    ctx.fillStyle = '#9aa4aa'; if (rocky) { ctx.beginPath(); ctx.moveTo(-5, -11); ctx.quadraticCurveTo(0, -14, 5, -11); ctx.lineTo(0, -12); ctx.fill(); } else ctx.fillRect(-4, -13, 5, 3.5);
    ctx.restore();
    ctx.restore();
    if (swing > 0.97 && Math.random() < 0.5) { const tw = World.toWorld(it.x + 0.5, it.y + 0.5); Entities.emit(tw.x, tw.y - 10, rocky ? 'dust' : 'chip', 3, { col: '#a8a096' }); if (Render.onScreen(it.x, it.y)) (rocky ? Sfx.drill() : Sfx.chop()); }
  },

  /* ---------- animated sprite extras ---------- */
  flame(ctx, x, y, t, s) {
    const f = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
    const g = ctx.createRadialGradient(x, y - 4 * s, 0.5, x, y - 4 * s, 9 * s * f);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.35, 'rgba(255,190,60,0.95)'); g.addColorStop(0.7, 'rgba(255,90,20,0.6)'); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y); ctx.quadraticCurveTo(x - 5 * s, y - 8 * s, x + Math.sin(t * 9) * 2, y - 15 * s * f); ctx.quadraticCurveTo(x + 5 * s, y - 8 * s, x + 4 * s, y); ctx.closePath(); ctx.fill();
    this.lights.push({ x, y: y - 6, r: 75 * s * f, col: 'rgba(255,150,50,' });
    if (Math.random() < 0.03) Entities.emit(x, y - 12, 'ember', 1);
  },
  flag(ctx, x, y, t, col) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 34);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + i * 3, y - 34 + Math.sin(t * 5 - i * 0.8) * 1.6 * (i / 6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(x + i * 3, y - 24 + Math.sin(t * 5 - i * 0.8) * 1.6 * (i / 6));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 9, y - 29 + Math.sin(t * 5 - 2.4) * 0.8, 2, 0, TAU); ctx.fill();
  },
  fountainWater(ctx, x, y, t, zb) {
    ctx.strokeStyle = 'rgba(210,245,255,0.8)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 0.3, r = 22 + Math.sin(t * 3 + i) * 2;
      const ex = x + Math.cos(a) * r, ey = y + 14 + Math.sin(a) * r * 0.45;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + Math.cos(a) * r * 0.5, y - 18, ex, ey); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y - 6 + Math.sin(t * 8), 3, 0, TAU); ctx.fill();
    if (Math.random() < 0.3) Entities.emit(x + rand(-20, 20), y + 14 + rand(-4, 4), 'splash', 1);
  },
  waterfallWater(ctx, a, b, t) {
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, 'rgba(200,240,255,0.9)'); g.addColorStop(1, 'rgba(160,220,255,0.6)');
    ctx.strokeStyle = g;
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = 3 - i * 0.4;
      const off = (i - 2) * 3;
      ctx.beginPath(); ctx.moveTo(a.x + off, a.y); ctx.quadraticCurveTo(a.x + off + 10, a.y + 10, b.x + off * 0.8 - 6, b.y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const k = ((t * 1.5 + i / 4) % 1); const px = lerp(a.x, b.x - 6, k), py = lerp(a.y, b.y, k * k); ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py + 2); ctx.stroke(); }
    if (Math.random() < 0.4) Entities.emit(b.x - 6 + rand(-6, 6), b.y, 'splash', 1);
  },
  helicopter(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 6, 28, 10, 0, 0, TAU); ctx.fill();
    // skids
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(14, 8); ctx.moveTo(-10, 8); ctx.lineTo(18, 12); ctx.stroke();
    // body
    const g = ctx.createLinearGradient(0, -24, 0, 4); g.addColorStop(0, '#f0f0f0'); g.addColorStop(1, '#9aa0a6');
    ctx.fillStyle = g; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -10, 18, 11, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0513a'; ctx.beginPath(); ctx.ellipse(0, -6, 17, 3, 0.2, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#4a7a9a'; ctx.beginPath(); ctx.ellipse(10, -13, 7, 6, 0.2, -1.2, 1.4); ctx.fill();
    // tail boom
    ctx.strokeStyle = '#8a9096'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-38, -22); ctx.stroke();
    ctx.fillStyle = '#e0513a'; ctx.fillRect(-42, -32, 6, 12);
    // rotor
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -25); ctx.stroke();
    const a = t * 3;
    ctx.strokeStyle = 'rgba(40,40,40,0.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) { const aa = a + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(-Math.cos(aa) * 36, -25 - Math.sin(aa) * 12); ctx.lineTo(Math.cos(aa) * 36, -25 + Math.sin(aa) * 12); ctx.stroke(); }
    ctx.restore();
  },

  /* ---------- particles ---------- */
  drawParticles(ctx) {
    for (const p of Entities.particles) {
      const k = p.life / p.max, a = 1 - k;
      ctx.globalAlpha = p.type === 'smoke' ? a * 0.45 : p.type === 'dust' ? a * 0.6 : a;
      ctx.fillStyle = p.col;
      if (p.type === 'leaf' || p.type === 'confetti' || p.type === 'chip') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore();
      } else if (p.type === 'smoke' || p.type === 'dust') {
        const s = p.size * (1 + k * 1.5);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      } else if (p.type === 'heart') {
        ctx.font = `${p.size * 3}px sans-serif`; ctx.fillText('❤', p.x, p.y);
      } else if (p.type === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 4);
        ctx.beginPath(); for (let i = 0; i < 5; i++) { const aa = i * TAU / 5 - Math.PI / 2; ctx.lineTo(Math.cos(aa) * p.size, Math.sin(aa) * p.size); ctx.lineTo(Math.cos(aa + TAU / 10) * p.size * 0.45, Math.sin(aa + TAU / 10) * p.size * 0.45); } ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        if (p.type === 'ember') this.lights.push({ x: p.x, y: p.y, r: 10, col: 'rgba(255,140,40,' });
      }
    }
    ctx.globalAlpha = 1;
  },

  /* ---------- bubbles, progress bars ---------- */
  drawOverlays(ctx, v) {
    const z = this.cam.zoom, k = clamp(1 / Math.sqrt(z), 0.8, 1.5);
    const t = this.t, nowT = now();
    for (const o of G.objects) {
      if (o.x + o.w < v.x0 - 2 || o.x > v.x1 + 2 || o.y + o.h < v.y0 - 2 || o.y > v.y1 + 2) continue;
      const c = World.toWorld(o.x + o.w / 2, o.y + o.h / 2);
      let top;
      if (o.type === 'paddock') top = c.y - (SPECIES[o.species].aviary ? 170 : 60 + SPECIES[o.species].size * 40);
      else if (o.type === 'deco') continue;
      else { const s = Sprites.buildings[o.def]; top = World.toWorld(o.x, o.y).y - s.ay + 30; }
      const bob = Math.sin(t * 3 + o.id) * 3;
      if (o.type === 'paddock') {
        if (o.hatchEnd > nowT) { this.progressBar(ctx, c.x, c.y - 70, 1 - (o.hatchEnd - nowT) / (o.hatchEnd - o.hatchStart), fmtTime(o.hatchEnd - nowT), k, '#ffd479'); continue; }
        if (o.coins >= Math.max(1, dinoCap(o) * 0.05)) this.bubble(ctx, c.x, top + bob, 'coin', k, o, o.coins >= dinoCap(o));
        else if (o.level < MAX_LEVEL && o.level % 10 === 0 && o.level / 10 > (o.stage || 0)) this.bubble(ctx, c.x, top + bob, 'evolve', k, o);
      } else {
        const b = BUILDINGS[o.def];
        if (b.kind === 'shop' || b.kind === 'center') {
          const ready = nowT - o.start >= b.period * 1000;
          if (ready) this.bubble(ctx, c.x, top + bob, 'coin', k, o);
          else if (this.selected === o) this.progressBar(ctx, c.x, top + 10, (nowT - o.start) / (b.period * 1000), fmtTime(b.period * 1000 - (nowT - o.start)), k, '#ffd479');
        } else if (b.kind === 'harbor') {
          if (o.order) {
            if (nowT >= o.order.end) this.bubble(ctx, c.x, top + bob, b.food, k, o);
            else this.progressBar(ctx, c.x, top + 10, (nowT - o.order.start) / (o.order.end - o.order.start), fmtTime(o.order.end - nowT), k, b.food === 'meat' ? '#ff8a6a' : '#b6e27a');
          } else this.bubble(ctx, c.x, top + bob, b.food, k * 0.8, o, false, true);
        } else if (b.kind === 'lab') {
          if (G.lab) {
            if (nowT >= G.lab.end) this.bubble(ctx, c.x, top + bob, 'check', k, o);
            else this.progressBar(ctx, c.x, top + 10, (nowT - G.lab.start) / (G.lab.end - G.lab.start), fmtTime(G.lab.end - nowT), k, '#8fd3ff');
          } else if (amberCount() > 0) this.bubble(ctx, c.x, top + bob, 'amber', k, o);
        }
      }
    }
    // clearing progress
    for (const cl of G.clearing) {
      const x = cl.i % MAP, y = Math.floor(cl.i / MAP);
      const c = World.toWorld(x + 0.5, y + 0.5);
      this.progressBar(ctx, c.x, c.y - 70, (nowT - cl.start) / (cl.end - cl.start), fmtTime(cl.end - nowT), k, '#b6e27a');
    }
  },
  bubble(ctx, x, y, icon, k, o, full, dim) {
    const r = 17 * k;
    ctx.save();
    ctx.globalAlpha = dim ? 0.65 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r + 8 * k, r * 0.6, r * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = full ? '#fff3c4' : '#ffffff'; ctx.strokeStyle = full ? '#e8911a' : 'rgba(60,40,20,0.6)'; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.arc(x, y, r, 0.35 * Math.PI + 0.25, 0.65 * Math.PI - 0.25, true); ctx.lineTo(x, y + r + 7 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawSprite(ctx, Sprites.icons[icon], x, y, k * 0.95);
    if (full) { ctx.strokeStyle = `rgba(255,200,60,${0.5 + 0.5 * Math.sin(this.t * 6)})`; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(x, y, r + 4 * k, 0, TAU); ctx.stroke(); }
    ctx.restore();
    this.addHit(x - r - 4, y - r - 4, x + r + 4, y + r + 10, 10000, { kind: 'bubble', o, icon });
  },
  progressBar(ctx, x, y, f, label, k, col) {
    const w = 64 * k, h = 11 * k;
    ctx.save();
    ctx.fillStyle = 'rgba(10,18,10,0.85)'; roundRect(ctx, x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, 6 * k); ctx.fill();
    ctx.fillStyle = col; roundRect(ctx, x - w / 2, y - h / 2, Math.max(h, w * clamp(f, 0, 1)), h, 5 * k); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - w / 2 + 3, y - h / 2 + 1.5, Math.max(0, w * clamp(f, 0, 1) - 6), h * 0.25);
    ctx.font = `900 ${9 * k}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(label, x, y + 0.5); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  },

  /* ---------- sky ---------- */
  drawCloudShadows(ctx) {
    for (const c of this.clouds) {
      c.x += c.v * 0.016;
      if (c.x > MAP * TW / 2 + 400) { c.x = -MAP * TW / 2 - 400; c.y = rand(0, MAP * TH); }
      drawSprite(ctx, this.cloudSpr, c.x, c.y, c.s * 1.6);
    }
    // soft sky clouds only when zoomed far out
    if (this.cam.zoom < 0.6) {
      const a = clamp((0.6 - this.cam.zoom) * 3, 0, 0.8);
      for (const c of this.clouds) drawSprite(ctx, this.cloudSky, c.x + 60, c.y - 380, c.s * 1.4, a);
    }
  },
  drawBirds(ctx) {
    for (const b of Entities.birds) {
      const f = Math.sin(b.ph);
      ctx.strokeStyle = b.big ? 'rgba(60,40,30,0.9)' : 'rgba(30,30,30,0.85)'; ctx.lineWidth = b.big ? 2.2 : 1.4;
      const s = b.big ? 12 : 6, dir = Math.sign(b.vx);
      ctx.beginPath(); ctx.moveTo(b.x - s, b.y - 400 - f * s * 0.6); ctx.quadraticCurveTo(b.x - s * 0.4, b.y - 400 - s * 0.2, b.x, b.y - 400); ctx.quadraticCurveTo(b.x + s * 0.4, b.y - 400 - s * 0.2, b.x + s, b.y - 400 - f * s * 0.6); ctx.stroke();
      if (b.big) { ctx.beginPath(); ctx.moveTo(b.x, b.y - 400); ctx.lineTo(b.x + dir * 7, b.y - 401); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,20,0,0.12)'; ctx.beginPath(); ctx.ellipse(b.x + 30, b.y + 20, s, s * 0.35, 0, 0, TAU); ctx.fill();
    }
  },

  /* ---------- lighting (day / night) ---------- */
  litLayers: [],
  drawLighting(ctx) {
    const n = World.night, dusk = World.dusk;
    const high = G.settings.quality === 'high';
    if (dusk > 0.01) { ctx.fillStyle = `rgba(255,120,40,${dusk * 0.16})`; ctx.fillRect(0, 0, this.W, this.H); }
    if (this.weather.rain > 0.01) { ctx.fillStyle = `rgba(30,40,55,${this.weather.rain * 0.22})`; ctx.fillRect(0, 0, this.W, this.H); }
    if (n > 0.01) {
      const L = this.lightCtx, lw = this.lightCv.width, lh = this.lightCv.height;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, lw, lh);
      L.fillStyle = `rgba(6,14,38,${n * 0.66})`; L.fillRect(0, 0, lw, lh);
      if (high) {
        L.globalCompositeOperation = 'destination-out';
        const z = this.cam.zoom;
        for (const l of this.lights) {
          const s = this.w2s(l.x, l.y); const r = l.r * z;
          if (s.x < -r || s.y < -r || s.x > this.W + r || s.y > this.H + r) continue;
          const g = L.createRadialGradient(s.x / 2, s.y / 2, 0, s.x / 2, s.y / 2, r / 2);
          g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          L.fillStyle = g; L.fillRect(s.x / 2 - r / 2, s.y / 2 - r / 2, r, r);
        }
      }
      ctx.drawImage(this.lightCv, 0, 0, this.W, this.H);
      // additive glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.setTransform(this.worldTransform);
      for (const ll of this.litLayers) { ctx.globalAlpha = n * 0.75; ctx.drawImage(ll.s.lit, ll.x - ll.s.ax, ll.y - ll.s.ay, ll.s.w, ll.s.h); }
      if (high) for (const l of this.lights) {
        ctx.globalAlpha = n * 0.16;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.6);
        g.addColorStop(0, l.col + '0.8)'); g.addColorStop(1, l.col + '0)');
        ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
      // stars in the sky at the very top at night (subtle vignette)
    }
    this.litLayers = [];
    // vignette
    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,5,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, this.W, this.H);
  },
  updateWeather(dt) {
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) { w.target = w.target > 0 ? 0 : (Math.random() < 0.45 ? rand(0.5, 1) : 0); w.timer = w.target ? rand(40, 90) : rand(150, 300); }
    w.rain = lerp(w.rain, w.target, Math.min(1, dt * 0.3));
  },
  drawRain(ctx, dt) {
    const r = this.weather.rain;
    if (r < 0.03) { this.drops.length = 0; return; }
    const want = Math.floor(260 * r);
    while (this.drops.length < want) this.drops.push({ x: rand(0, this.W), y: rand(-this.H, this.H), v: rand(700, 1000), l: rand(10, 20) });
    if (this.drops.length > want) this.drops.length = want;
    ctx.strokeStyle = `rgba(200,220,255,${0.35 * r})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.drops) {
      d.y += d.v * dt; d.x -= d.v * 0.18 * dt;
      if (d.y > this.H) { d.y = rand(-60, 0); d.x = rand(0, this.W + 100); if (Math.random() < 0.3) this.splashes.push({ x: d.x - 100 * Math.random(), y: rand(0, this.H), a: 1 }); }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(220,235,255,${0.3 * r})`;
    for (const s of this.splashes) { s.a -= dt * 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, (1 - s.a) * 6, (1 - s.a) * 2, 0, 0, TAU); ctx.stroke(); }
    this.splashes = this.splashes.filter(s => s.a > 0);
  },
  splashes: [],
  drawFloats() {
    const ctx = this.ctx;
    for (const f of Entities.floats) {
      const s = this.w2s(f.x, f.y), a = 1 - Math.max(0, (f.life - 1) / (f.max - 1));
      ctx.globalAlpha = a;
      ctx.font = `400 ${f.size}px 'Lilita One', sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(f.text, s.x, s.y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
  },

  /* ---------- hit testing ---------- */
  addHit(x0, y0, x1, y1, depth, ref) {
    const a = this.w2s(x0, y0), b = this.w2s(x1, y1);
    this.hits.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, depth, ref });
  },
  addHitPoly(pts, depth, ref) {
    const sp = pts.map(([x, y]) => { const s = this.w2s(x, y); return [s.x, s.y]; });
    const xs = sp.map(p => p[0]), ys = sp.map(p => p[1]);
    this.hits.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), poly: sp, depth, ref });
  },
  pick(sx, sy) {
    let best = null;
    for (const h of this.hits) {
      if (sx < h.x0 || sx > h.x1 || sy < h.y0 || sy > h.y1) continue;
      if (h.poly && !pointInPoly(sx, sy, h.poly)) continue;
      const pri = h.ref.kind === 'bubble' ? 3 : h.ref.kind === 'dino' ? 2 : 1;
      if (!best || pri > best.pri || (pri === best.pri && h.depth > best.h.depth)) best = { h, pri };
    }
    return best ? best.h.ref : null;
  },
};

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- road tiles (auto-connected) ---------- */
function paintRoad(mask) {
  return makeSprite(TW + 8, TH + 8, TW / 2 + 4, 4, ctx => {
    const p = (u, v) => [(u - v) * TW / 2, (u + v) * TH / 2];
    const N = mask & 1, E = mask & 2, S = mask & 4, W = mask & 8;
    const u0 = W ? 0 : 0.14, u1 = E ? 1 : 0.86, v0 = N ? 0 : 0.14, v1 = S ? 1 : 0.86;
    const poly = [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
    const path = () => { ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
    // soft shadow onto grass
    ctx.save(); ctx.translate(0, 1.5); path(); ctx.fillStyle = 'rgba(40,60,20,0.35)'; ctx.fill(); ctx.restore();
    path();
    const g = ctx.createLinearGradient(0, 0, 0, TH);
    g.addColorStop(0, '#dccaa2'); g.addColorStop(1, '#c4ae84');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip();
    // paving stones
    const rng = mulberry32(mask * 7 + 3);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const o = (b % 2) * 0.125;
      const q = [p(a / 4 + o + 0.02, b / 4 + 0.02), p(a / 4 + o + 0.23, b / 4 + 0.02), p(a / 4 + o + 0.23, b / 4 + 0.23), p(a / 4 + o + 0.02, b / 4 + 0.23)];
      const c = 200 + rng() * 30;
      ctx.fillStyle = `rgb(${c},${c * 0.9 | 0},${c * 0.72 | 0})`;
      ctx.beginPath(); q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,96,60,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.restore();
    // curbs on open sides
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#9a8a70';
    const edge = (a, b) => { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
    if (!N) edge(p(u0, v0), p(u1, v0));
    if (!E) edge(p(u1, v0), p(u1, v1));
    if (!S) edge(p(u1, v1), p(u0, v1));
    if (!W) edge(p(u0, v1), p(u0, v0));
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,250,230,0.6)';
    if (!N) edge([p(u0, v0)[0], p(u0, v0)[1] + 1.2], [p(u1, v0)[0], p(u1, v0)[1] + 1.2]);
    if (!W) edge([p(u0, v1)[0] + 1.2, p(u0, v1)[1]], [p(u0, v0)[0] + 1.2, p(u0, v0)[1]]);
  });
}

/* ---------- paddock floors ---------- */
function paintFloor(size, kind) {
  const m = 10;
  const W = size * TW + m * 2, H = size * TH + m * 2;
  return makeSprite(W, H, size * TW / 2 + m, m, ctx => {
    const I = new Iso(ctx, null);
    const rng = mulberry32(size * 31 + kind.length);
    const pts = [I.p(0.04, 0.04), I.p(size - 0.04, 0.04), I.p(size - 0.04, size - 0.04), I.p(0.04, size - 0.04)];
    const cols = kind === 'grass' ? ['#5fa044', '#4a8a36', '#7ab852'] : kind === 'dirt' ? ['#a88a5c', '#8a6e46', '#c0a070'] : ['#d8c49a', '#b8a078', '#e8d8b0'];
    const g = ctx.createLinearGradient(0, 0, 0, size * TH);
    g.addColorStop(0, cols[2]); g.addColorStop(1, cols[1]);
    I.poly(pts, g);
    ctx.save(); I.path(pts); ctx.clip();
    // patches
    for (let i = 0; i < size * size * 3; i++) {
      const [x, y] = I.p(rng() * size, rng() * size);
      const r = 6 + rng() * 14;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = rng() < 0.5 ? cols[0] : kind === 'grass' ? '#8a7a4a' : cols[2];
      pg.addColorStop(0, rgba(c, 0.55)); pg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.fill();
    }
    // worn trail loop
    ctx.strokeStyle = kind === 'grass' ? 'rgba(150,120,70,0.35)' : 'rgba(90,70,40,0.25)'; ctx.lineWidth = 7;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.01; a += 0.25) { const u = size / 2 + Math.cos(a) * size * 0.3, v = size / 2 + Math.sin(a) * size * 0.28; const [x, y] = I.p(u, v); a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // texture strokes
    for (let i = 0; i < size * size * 22; i++) {
      const [x, y] = I.p(rng() * size, rng() * size);
      if (kind === 'grass') { ctx.strokeStyle = rng() < 0.5 ? 'rgba(30,80,20,0.5)' : 'rgba(170,220,110,0.45)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 2, y - 3 - rng() * 3); ctx.stroke(); }
      else { ctx.fillStyle = rng() < 0.5 ? 'rgba(60,40,20,0.35)' : 'rgba(255,240,210,0.35)'; ctx.fillRect(x, y, 1.3, 1.3); }
    }
    // pond or bones
    if (kind === 'grass' || kind === 'aviary') {
      const [px, py] = I.p(size * 0.72, size * 0.28);
      const pg = ctx.createRadialGradient(px, py, 2, px, py, size * 9);
      pg.addColorStop(0, '#4ab8d8'); pg.addColorStop(0.7, '#2a88b0'); pg.addColorStop(1, '#1e6a8a');
      ctx.fillStyle = '#6a5a3a'; ctx.beginPath(); ctx.ellipse(px, py + 1, size * 11 + 3, size * 5 + 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py, size * 11, size * 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px - 4, py - 1, size * 6, size * 2.2, 0, Math.PI, TAU); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#4a8a2a'; ctx.beginPath(); ctx.ellipse(px + (rng() - 0.5) * size * 16, py + (rng() - 0.5) * size * 6, 3, 1.5, 0, 0, TAU); ctx.fill(); }
    } else {
      for (let i = 0; i < 4; i++) {
        const [x, y] = I.p(0.8 + rng() * (size - 1.6), 0.8 + rng() * (size - 1.6));
        ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const a = rng() * 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 3); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 3); ctx.stroke();
        ctx.fillStyle = '#efe6d4'; ctx.beginPath(); ctx.arc(x - Math.cos(a) * 6.5, y - Math.sin(a) * 3, 1.8, 0, TAU); ctx.arc(x + Math.cos(a) * 6.5, y + Math.sin(a) * 3, 1.8, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    // concrete base rim
    ctx.strokeStyle = 'rgba(120,116,110,0.9)'; ctx.lineWidth = 2.5; I.path(pts); ctx.stroke();
  });
}

/* ---------- people ---------- */
function drawPerson(ctx, x, y, v, phase, alpha, t) {
  const s = v.kid ? 0.72 : 1;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s * v.dir, s);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, TAU); ctx.fill();
  const sw = Math.sin(phase) * 2.4;
  ctx.strokeStyle = v.pants; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1, -7); ctx.lineTo(-1 + sw, 0); ctx.moveTo(1, -7); ctx.lineTo(1 - sw, 0); ctx.stroke();
  ctx.fillStyle = v.shirt; roundRect(ctx, -3, -14, 6, 8, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(1, -14, 2, 8);
  ctx.strokeStyle = v.skin; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-2.5, -12.5); ctx.lineTo(-3.5 - sw * 0.5, -8); ctx.moveTo(2.5, -12.5); ctx.lineTo(3.5 + (v.camera ? 1.5 : sw * 0.5), v.camera ? -12 : -8); ctx.stroke();
  if (v.camera) { ctx.fillStyle = '#222'; ctx.fillRect(4, -14, 3, 2.4); }
  ctx.fillStyle = v.skin; ctx.beginPath(); ctx.arc(0, -16.5, 2.8, 0, TAU); ctx.fill();
  if (v.hat === 'safari') { ctx.fillStyle = '#d8b36a'; ctx.beginPath(); ctx.ellipse(0, -18.2, 4.6, 1.3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -18.6, 2.6, Math.PI, TAU); ctx.fill(); }
  else if (v.hat === 'cap') { ctx.fillStyle = v.shirt === '#ffffff' ? '#e0513a' : v.shirt; ctx.beginPath(); ctx.arc(0, -17.6, 2.9, Math.PI, TAU); ctx.fill(); ctx.fillRect(0, -18, 4.5, 1.2); }
  else if (v.hat === 'sun') { ctx.fillStyle = '#f4e0b0'; ctx.beginPath(); ctx.ellipse(0, -18.4, 5.2, 1.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#e0513a'; ctx.fillRect(-2.6, -19.6, 5.2, 1); }
  else { ctx.fillStyle = v.skin === '#f6dcc4' || v.skin === '#f2d0b0' ? '#8a5a2a' : '#1a1210'; ctx.beginPath(); ctx.arc(0, -17.4, 2.9, Math.PI * 1.05, TAU * 0.98); ctx.fill(); }
  if (v.balloon) {
    ctx.strokeStyle = 'rgba(80,80,80,0.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3.5, -8); ctx.quadraticCurveTo(-6, -20, -5 + Math.sin(t * 2) * 1.5, -30); ctx.stroke();
    ctx.fillStyle = v.balloon; ctx.beginPath(); ctx.ellipse(-5 + Math.sin(t * 2) * 1.5, -34, 4, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-6.3 + Math.sin(t * 2) * 1.5, -35.5, 1.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ---------- cargo boat ---------- */
function drawBoat(ctx, x, y, dir, food, big, t) {
  const s = big ? 1.35 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = 'rgba(0,30,50,0.3)'; ctx.beginPath(); ctx.ellipse(0, 5, 34, 8, 0, 0, TAU); ctx.fill();
  // hull
  const g = ctx.createLinearGradient(0, -8, 0, 6);
  g.addColorStop(0, food === 'meat' ? '#c8402a' : '#2e6a3a'); g.addColorStop(1, food === 'meat' ? '#7a2014' : '#18401e');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(34, -8); ctx.quadraticCurveTo(30, 2, 22, 5); ctx.lineTo(-26, 5); ctx.quadraticCurveTo(-31, 0, -30, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2ead8'; ctx.fillRect(-29, -9.5, 62, 2.5);
  ctx.fillStyle = '#fff'; ctx.fillRect(-24, -3, 44, 1.2);
  // cargo
  const cols = food === 'meat' ? ['#e8eef0', '#c8402a', '#d8a02a'] : ['#7ac04a', '#ffb03a', '#e0513a'];
  for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-8 + i * 9, -18, 8, 9); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(-8 + i * 9, -18, 8, 9); }
  if (big) for (let i = 0; i < 3; i++) { ctx.fillStyle = cols[(i + 1) % cols.length]; ctx.fillRect(-4 + i * 9, -26, 8, 8); ctx.strokeRect(-4 + i * 9, -26, 8, 8); }
  // cabin
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(-26, -24, 14, 15); ctx.strokeRect(-26, -24, 14, 15);
  ctx.fillStyle = '#3a6a8a'; ctx.fillRect(-24, -21, 10, 4);
  ctx.fillStyle = '#333'; ctx.fillRect(-22, -32, 4, 8);
  // smoke puffs
  for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(200,200,200,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(-20 - k * 14, -34 - k * 16, 3 + k * 5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

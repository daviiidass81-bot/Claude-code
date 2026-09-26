'use strict';
/* ==========================================================
   Entities: dinosaurs, visitors, jeeps, workers, particles
   ========================================================== */
const DINO_WORLD_SCALE = 0.6;

const Entities = {
  dinos: new Map(), visitors: [], jeeps: [], particles: [], floats: [], birds: [], boat: null,
  spawnTimer: 0,

  syncDinos() {
    const ids = new Set();
    for (const o of G.objects) {
      if (o.type !== 'paddock') continue;
      ids.add(o.id);
      let a = this.dinos.get(o.id);
      if (!a) { a = new DinoActor(o); this.dinos.set(o.id, a); }
      a.o = o;
    }
    for (const id of [...this.dinos.keys()]) if (!ids.has(id)) this.dinos.delete(id);
  },

  update(dt, t) {
    for (const a of this.dinos.values()) a.update(dt, t);
    this.updateVisitors(dt);
    this.updateJeeps(dt);
    this.updateParticles(dt);
    this.updateBirds(dt);
  },

  /* ---------- visitors ---------- */
  gate() { return G.objects.find(o => o.def === 'gate'); },
  updateVisitors(dt) {
    const gate = this.gate();
    const target = gate ? visitorTarget() : 0;
    this.spawnTimer -= dt;
    if (gate && this.visitors.length < target && this.spawnTimer <= 0) {
      this.spawnTimer = 0.6 + Math.random() * 1.6;
      const sx = gate.x + 1, sy = gate.y;
      if (World.isRoad(sx, sy - 1) || World.isRoad(sx, sy + 1)) this.visitors.push(new Visitor(sx, sy));
    }
    for (const v of this.visitors) v.update(dt);
    this.visitors = this.visitors.filter(v => !v.dead);
  },
  updateJeeps(dt) {
    const tours = G.objects.filter(o => o.def === 'jeep').length;
    const want = Math.min(tours * 2, 6);
    if (this.jeeps.length < want && World.roadCount > 6) {
      const gate = this.gate();
      if (gate && World.isRoad(gate.x + 1, gate.y - 1)) this.jeeps.push(new Jeep(gate.x + 1, gate.y - 1));
    }
    if (this.jeeps.length > want) this.jeeps.length = want;
    for (const j of this.jeeps) j.update(dt);
  },

  /* ---------- particles ---------- */
  emit(x, y, type, n = 8, o = {}) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, type, life: 0, vx: 0, vy: 0, g: 0, size: 2, col: '#fff', rot: Math.random() * TAU, vr: 0 };
      switch (type) {
        case 'dust': Object.assign(p, { vx: rand(-30, 30), vy: rand(-18, -2), g: 12, max: rand(0.6, 1.2), size: rand(4, 9), col: o.col || '#c8b08a' }); break;
        case 'leaf': Object.assign(p, { vx: rand(-40, 40), vy: rand(-70, -20), g: 60, max: rand(1, 1.8), size: rand(2, 4), col: pick(['#4c9438', '#7ac04a', '#2f6a26', '#a8c84a']), vr: rand(-6, 6) }); break;
        case 'chip': Object.assign(p, { vx: rand(-50, 50), vy: rand(-80, -30), g: 200, max: rand(0.5, 0.9), size: rand(1.5, 3), col: pick(['#c8a070', '#8a6a44', '#e0c898']), vr: rand(-10, 10) }); break;
        case 'spark': Object.assign(p, { vx: rand(-60, 60), vy: rand(-90, -20), g: 90, max: rand(0.5, 1.1), size: rand(1.5, 3), col: o.col || pick(['#ffd479', '#fff6c2', '#ffb13b']) }); break;
        case 'confetti': Object.assign(p, { vx: rand(-80, 80), vy: rand(-140, -60), g: 140, max: rand(1.2, 2), size: rand(2, 4), col: pick(['#e0513a', '#4aa8e0', '#ffd23f', '#7dc15a', '#b35ae0']), vr: rand(-10, 10) }); break;
        case 'smoke': Object.assign(p, { vx: rand(-6, 6) + (o.wind || 8), vy: rand(-22, -12), g: -2, max: rand(3, 6), size: rand(8, 14), col: o.col || '#6a625a' }); break;
        case 'heart': Object.assign(p, { vx: rand(-10, 10), vy: rand(-30, -20), g: 0, max: 1.4, size: 5, col: '#ff5a7a' }); break;
        case 'food': Object.assign(p, { vx: rand(-25, 25), vy: rand(-60, -30), g: 160, max: 0.9, size: rand(2, 3.5), col: o.col || '#7ac04a' }); break;
        case 'ember': Object.assign(p, { vx: rand(-8, 8), vy: rand(-40, -20), g: -4, max: rand(0.4, 0.9), size: rand(1, 2), col: pick(['#ffd479', '#ff8a2a', '#ff5a1a']) }); break;
        case 'splash': Object.assign(p, { vx: rand(-25, 25), vy: rand(-45, -15), g: 150, max: rand(0.4, 0.7), size: rand(1.2, 2.2), col: '#d8f4ff' }); break;
        case 'star': Object.assign(p, { vx: rand(-50, 50), vy: rand(-80, -30), g: 40, max: rand(0.8, 1.4), size: rand(3, 5), col: o.col || '#ffe28a' }); break;
      }
      p.max = p.max || 1;
      this.particles.push(p);
    }
  },
  float(x, y, text, col = '#ffd479', size = 16) { this.floats.push({ x, y, text, col, size, life: 0, max: 1.6 }); },
  updateParticles(dt) {
    for (const p of this.particles) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.type === 'dust' || p.type === 'smoke') { p.vx *= 0.97; } }
    this.particles = this.particles.filter(p => p.life < p.max);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    for (const f of this.floats) { f.life += dt; f.y -= 28 * dt; }
    this.floats = this.floats.filter(f => f.life < f.max);
  },

  /* ---------- birds / pterosaur flocks crossing the sky ---------- */
  updateBirds(dt) {
    if (!this.birds.length && Math.random() < dt / 25) {
      const n = 4 + Math.floor(Math.random() * 5);
      const y0 = rand(200, MAP * TH - 200), dirx = Math.random() < 0.5 ? 1 : -1;
      const x0 = -dirx * (MAP * TW / 2 + 300);
      const big = Math.random() < 0.35;
      for (let i = 0; i < n; i++) this.birds.push({ x: x0 - dirx * (i * 26), y: y0 + (i % 2 ? 1 : -1) * i * 12, vx: dirx * (big ? 70 : 95), vy: rand(-4, 4), ph: Math.random() * TAU, big });
    }
    for (const b of this.birds) { b.x += b.vx * dt; b.y += b.vy * dt; b.ph += dt * (b.big ? 5 : 11); }
    this.birds = this.birds.filter(b => Math.abs(b.x) < MAP * TW / 2 + 500);
  },
};

/* ==========================================================
   DinoActor: wanders inside its paddock
   ========================================================== */
class DinoActor {
  constructor(o) {
    this.o = o;
    this.x = o.x + o.w / 2 + rand(-0.5, 0.5); this.y = o.y + o.h / 2 + rand(-0.5, 0.5);
    this.tx = this.x; this.ty = this.y;
    this.state = 'idle'; this.timer = rand(1, 4); this.dir = Math.random() < 0.5 ? 1 : -1;
    this.phase = 0; this.speed = 0; this.t0 = Math.random() * 10; this.fly = 40; this.flyA = Math.random() * TAU;
    this.poseTimer = 0; this.pose = 'idle';
  }
  get sp() { return SPECIES[this.o.species]; }
  bounds() {
    // keep the whole body (incl. tail and neck) inside the fence
    const o = this.o, len = DinoArt.size(o.species).len * DINO_WORLD_SCALE * this.sp.size * this.growth();
    const m = clamp(len / 64 * 0.62, 0.8, o.w / 2 - 0.15);
    return [o.x + m, o.y + m, o.x + o.w - m, o.y + o.h - m];
  }
  growth() { return clamp(0.55 + (this.o.level - 1) * 0.1125, 0.55, 1); }
  hatched() { return this.o.hatchEnd <= now(); }
  setPose(p, time) { this.pose = p; this.poseTimer = time; }
  roar() {
    if (!this.hatched()) return;
    this.setPose('roar', 1.6); this.state = 'idle'; this.timer = 2;
    const size = this.sp.size * (this.sp.diet === 'carn' ? 1.2 : 0.8) * this.growth();
    Sfx.roar(size);
    const w = World.toWorld(this.x, this.y);
    Entities.emit(w.x + this.dir * 20, w.y - 30, 'dust', 6);
    Render.shake(this.sp.size > 1.1 ? 6 : 2);
  }
  eatNow() {
    // walk to the trough then eat
    const o = this.o;
    this.tx = o.x + o.w - 1.2; this.ty = o.y + o.h - 0.9;
    this.state = 'toEat'; this.timer = 6;
  }
  update(dt, t) {
    const o = this.o;
    if (!this.hatched()) return;
    const sp = this.sp;
    this.poseTimer -= dt;
    if (this.poseTimer <= 0 && (this.pose === 'roar' || this.pose === 'eat')) this.pose = 'idle';
    if (sp.body === 'ptero') return this.updateFlyer(dt, t);
    const night = World.night > 0.75;
    const walkSpeed = (sp.body === 'ornitho' || sp.body === 'raptor' ? 0.75 : 0.42) * (0.75 + 0.25 * this.growth());
    this.timer -= dt;
    switch (this.state) {
      case 'idle':
        this.speed = Math.max(0, this.speed - dt * 3);
        if (night && Math.random() < dt * 0.3) { this.state = 'sleep'; this.pose = 'sleep'; break; }
        if (this.timer <= 0 && this.pose !== 'roar') {
          const r = Math.random();
          if (r < 0.65) {
            const b = this.bounds(), px = o.x + o.w * 0.72, py = o.y + o.h * 0.28;
            for (let k = 0; k < 8; k++) { this.tx = rand(b[0], b[2]); this.ty = rand(b[1], b[3]); if (sp.diet === 'carn' || Math.hypot(this.tx - px, this.ty - py) > o.w * 0.3) break; }
            this.state = 'walk';
          }
          else if (r < 0.85) { this.setPose(sp.diet === 'herb' ? 'eat' : 'alert', rand(2, 4)); this.timer = rand(2, 4); }
          else { this.timer = rand(2, 5); if (Math.random() < 0.25 && Render.onScreen(this.x, this.y)) this.roar(); }
        }
        break;
      case 'walk': case 'toEat': {
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
        this.speed = Math.min(1, this.speed + dt * 2);
        if (d < 0.08 || this.timer < -12) {
          if (this.state === 'toEat') { this.setPose('eat', 3.5); Sfx.eat(); const w = World.toWorld(this.x, this.y); Entities.emit(w.x + this.dir * 20, w.y - 8, 'food', 8, { col: sp.diet === 'herb' ? '#7ac04a' : '#c8402a' }); }
          this.state = 'idle'; this.timer = rand(2, 6); break;
        }
        const step = Math.min(d, walkSpeed * dt * this.speed + 0.001);
        this.x += dx / d * step; this.y += dy / d * step;
        const sdx = dx - dy;
        if (Math.abs(sdx) > 0.05) this.dir = sdx > 0 ? 1 : -1;
        this.phase += dt * walkSpeed * 1.6 * this.speed / (sp.size * 0.9);
        break;
      }
      case 'sleep':
        this.speed = 0; this.pose = 'sleep';
        if (!night) { this.state = 'idle'; this.pose = 'idle'; this.timer = 1; }
        break;
    }
  }
  updateFlyer(dt, t) {
    const o = this.o;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.w * 0.28;
    if (this.state !== 'perch') {
      this.flyA += dt * 0.45;
      const nx = cx + Math.cos(this.flyA) * r, ny = cy + Math.sin(this.flyA) * r * 0.8;
      const sdx = (nx - this.x) - (ny - this.y);
      if (Math.abs(sdx) > 0.0005) this.dir = sdx > 0 ? 1 : -1;
      this.x = nx; this.y = ny;
      this.fly = 55 + Math.sin(t * 0.7 + this.t0) * 12;
      if (Math.random() < dt * 0.02 || World.night > 0.75) { this.state = 'perch'; this.timer = rand(6, 14); }
    } else {
      this.fly = Math.max(0, this.fly - dt * 40);
      this.timer -= dt;
      if (this.timer <= 0 && World.night < 0.75) this.state = 'fly';
    }
  }
}

/* ==========================================================
   Visitors walk the road network
   ========================================================== */
const SKINS = ['#f2d0b0', '#e8b58e', '#c8905e', '#8a5a3a', '#5a3a24', '#f6dcc4'];
const SHIRTS = ['#e0513a', '#4aa8e0', '#ffd23f', '#7dc15a', '#ffffff', '#b35ae0', '#ff8a3a', '#2a6aa0', '#e87aa8', '#3a3a3a'];
const HATS = [null, null, 'safari', 'cap', null, 'safari', 'sun'];
class Visitor {
  constructor(x, y) {
    this.cx = x; this.cy = y; this.px = x; this.py = y;
    this.x = x + 0.5; this.y = y + 0.5;
    this.nx = x; this.ny = y; this.progress = 1;
    this.speed = rand(0.6, 1.0);
    this.life = rand(70, 160); this.age = 0;
    this.lane = rand(-0.22, 0.22);
    this.skin = pick(SKINS); this.shirt = pick(SHIRTS); this.pants = pick(['#3a4a6a', '#6a5a44', '#2a2a2a', '#c8b090', '#5a6a3a']);
    this.hat = pick(HATS); this.kid = Math.random() < 0.22; this.camera = Math.random() < 0.3;
    this.balloon = this.kid && Math.random() < 0.5 ? pick(['#e0513a', '#ffd23f', '#4aa8e0', '#7dc15a']) : null;
    this.stop = 0; this.dir = 1; this.phase = Math.random() * 10; this.flash = 0; this.dead = false; this.fade = 0;
    this.leaving = false;
  }
  pickNext() {
    const opts = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = this.cx + dx, y = this.cy + dy;
      if (World.isRoad(x, y)) opts.push([x, y]);
    }
    if (!opts.length) { this.leaving = true; return; }
    let cand = opts.filter(p => !(p[0] === this.px && p[1] === this.py));
    if (!cand.length) cand = opts;
    const n = pick(cand);
    this.px = this.cx; this.py = this.cy; this.nx = n[0]; this.ny = n[1]; this.progress = 0;
  }
  update(dt) {
    this.age += dt;
    if (this.age > this.life || this.leaving) { this.fade += dt; if (this.fade > 1) this.dead = true; }
    if (this.flash > 0) this.flash -= dt;
    if (this.stop > 0) { this.stop -= dt; if (this.camera && Math.random() < dt * 0.6) { this.flash = 0.15; } return; }
    if (this.progress >= 1) {
      this.cx = this.nx; this.cy = this.ny;
      if (!World.isRoad(this.cx, this.cy)) { this.leaving = true; return; }
      // look at a neighbouring paddock?
      if (Math.random() < 0.18) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const o = World.objAt(this.cx + dx, this.cy + dy);
          if (o && o.type === 'paddock') { this.stop = rand(2, 5); const s = dx - dy; this.dir = s > 0 ? 1 : -1; return; }
        }
      }
      this.pickNext();
    }
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt * this.speed);
      const k = this.progress;
      const ax = this.cx + 0.5, ay = this.cy + 0.5, bx = this.nx + 0.5, by = this.ny + 0.5;
      const dx = bx - ax, dy = by - ay;
      // offset into a lane perpendicular to motion
      this.x = lerp(ax, bx, k) + (-dy) * this.lane; this.y = lerp(ay, by, k) + dx * this.lane;
      const sdx = dx - dy; if (sdx) this.dir = sdx > 0 ? 1 : -1;
      this.phase += dt * 9 * this.speed;
    }
  }
}

/* ==========================================================
   Tour jeeps
   ========================================================== */
class Jeep {
  constructor(x, y) { this.cx = x; this.cy = y; this.px = x; this.py = y + 1; this.nx = x; this.ny = y; this.progress = 1; this.x = x + 0.5; this.y = y + 0.5; this.d = 3; this.wait = 0; }
  update(dt) {
    if (this.wait > 0) { this.wait -= dt; return; }
    if (this.progress >= 1) {
      this.cx = this.nx; this.cy = this.ny;
      const opts = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = this.cx + dx, y = this.cy + dy; if (World.isRoad(x, y)) opts.push([x, y]); }
      if (!opts.length) return;
      let cand = opts.filter(p => !(p[0] === this.px && p[1] === this.py));
      if (!cand.length) cand = opts;
      const n = pick(cand);
      this.px = this.cx; this.py = this.cy; this.nx = n[0]; this.ny = n[1]; this.progress = 0;
      if (Math.random() < 0.08) this.wait = rand(1, 3);
    }
    this.progress = Math.min(1, this.progress + dt * 1.4);
    const dx = this.nx - this.cx, dy = this.ny - this.cy;
    this.d = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
    this.x = lerp(this.cx, this.nx, this.progress) + 0.5 + (-dy) * 0.15; this.y = lerp(this.cy, this.ny, this.progress) + 0.5 + dx * 0.15;
  }
}

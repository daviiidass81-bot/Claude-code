'use strict';
/* ==========================================================
   World: island generation, tiles, obstacles, roads, iso math
   ========================================================== */
const T_DEEP = 0, T_SHALLOW = 1, T_SAND = 2, T_GRASS = 3, T_MOUNT = 4;
const OBS_KIND = [null, 'tree', 'palm', 'bush', 'rock', 'bigrock'];
const TSCALE = 1.5;          // terrain canvas resolution multiplier
const CLIFF = 16;            // island edge cliff height (world px)

const World = {
  tiles: null, obs: null, roads: null, occ: null, shade: null,
  terrain: null, terrainOX: 0, terrainOY: 0,
  roadCount: 0, night: 0, volcano: null, shore: [],
  idx: (x, y) => y * MAP + x,
  inMap: (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP,

  generate(seed) {
    const N = MAP;
    this.tiles = new Uint8Array(N * N);
    this.obs = new Uint8Array(N * N);
    this.roads = new Uint8Array(N * N);
    this.occ = new Int32Array(N * N);
    this.shade = new Float32Array(N * N);
    const rng = mulberry32(seed);
    const s = seed % 1000;
    const cx = N / 2, cy = N / 2;
    this.volcano = { x: Math.round(N * 0.27), y: Math.round(N * 0.25), r: 4.2 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - cx) / (N / 2), dy = (y + 0.5 - cy) / (N / 2);
      let d = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(x * 0.11, y * 0.11, s, 4);
      let v = d + (n - 0.5) * 0.5;
      // extend the island towards the volcano corner
      const vd = Math.hypot(x - this.volcano.x, y - this.volcano.y);
      if (vd < 10) v -= (10 - vd) * 0.02;
      let t;
      if (v < 0.74) t = T_GRASS; else if (v < 0.81) t = T_SAND; else if (v < 0.9) t = T_SHALLOW; else t = T_DEEP;
      if (vd < this.volcano.r) t = T_MOUNT;
      this.tiles[this.idx(x, y)] = t;
      this.shade[this.idx(x, y)] = fbm(x * 0.07, y * 0.07, s + 50, 3);
    }
    // keep the starting area solid land
    for (let y = 15; y < 34; y++) for (let x = 16; x < 33; x++) {
      const i = this.idx(x, y);
      if (this.tiles[i] !== T_MOUNT) this.tiles[i] = T_GRASS;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = this.idx(x, y), t = this.tiles[i];
      if (t !== T_GRASS && t !== T_SAND) continue;
      if (x >= 17 && x <= 31 && y >= 17 && y <= 32) continue; // starting clearing
      const dens = fbm(x * 0.16, y * 0.16, s + 99, 3);
      const r = rng();
      if (t === T_SAND) { if (r < 0.16) this.obs[i] = 2; else if (r < 0.2) this.obs[i] = 4; continue; }
      const nearVol = Math.hypot(x - this.volcano.x, y - this.volcano.y) < this.volcano.r + 2.5;
      if (nearVol) { this.obs[i] = r < 0.35 ? 4 : r < 0.5 ? 5 : r < 0.8 ? 1 : 3; continue; }
      if (dens > 0.44 || r < 0.35) {
        const k = rng();
        this.obs[i] = k < 0.64 ? 1 : k < 0.8 ? 3 : k < 0.92 ? 4 : k < 0.96 ? 2 : 5;
      } else if (r < 0.55) this.obs[i] = 3;
    }
    // a few trees near the clearing edge give the start some framing
    for (const [x, y] of [[17, 25], [18, 18], [31, 20], [30, 31], [17, 31], [19, 32]]) this.obs[this.idx(x, y)] = 1;
    this.findShore();
  },

  findShore() {
    this.shore = [];
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      if (!this.isLandT(this.tiles[this.idx(x, y)])) continue;
      for (const [dx, dy, e] of [[1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w'], [0, -1, 'n']]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inMap(nx, ny) || !this.isLandT(this.tiles[this.idx(nx, ny)])) this.shore.push({ x, y, e });
      }
    }
  },
  isLandT: t => t >= T_SAND,
  isLand(x, y) { return this.inMap(x, y) && this.tiles[this.idx(x, y)] >= T_SAND; },
  buildable(x, y) { if (!this.inMap(x, y)) return false; const t = this.tiles[this.idx(x, y)]; return t === T_GRASS || t === T_SAND; },
  tileFree(x, y, ignoreId = 0) {
    if (!this.buildable(x, y)) return false;
    const i = this.idx(x, y);
    if (this.obs[i]) return false;
    if (this.occ[i] && this.occ[i] !== ignoreId) return false;
    return true;
  },
  canPlace(x, y, w, h, ignoreId = 0, allowRoad = false) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!this.tileFree(i, j, ignoreId)) return false;
      if (!allowRoad && this.roads[this.idx(i, j)]) return false;
    }
    return true;
  },
  rebuildOcc() {
    this.occ.fill(0);
    for (const o of G.objects) for (let j = o.y; j < o.y + o.h; j++) for (let i = o.x; i < o.x + o.w; i++) if (this.inMap(i, j)) this.occ[this.idx(i, j)] = o.id;
    // gate middle tile is walkable road
    const gate = G.objects.find(o => o.def === 'gate');
    if (gate) this.roads[this.idx(gate.x + 1, gate.y)] = 1;
    this.countRoads();
  },
  countRoads() { let c = 0; for (let i = 0; i < this.roads.length; i++) c += this.roads[i]; this.roadCount = c; },
  objAt(x, y) { if (!this.inMap(x, y)) return null; const id = this.occ[this.idx(x, y)]; return id ? objById(id) : null; },
  isRoad(x, y) { return this.inMap(x, y) && this.roads[this.idx(x, y)] === 1; },

  encodeRoads() { let s = ''; for (let i = 0; i < this.roads.length; i++) s += this.roads[i]; return s; },
  encodeObs() { let s = ''; for (let i = 0; i < this.obs.length; i++) s += this.obs[i]; return s; },
  decode(str, arr) { if (!str || str.length !== arr.length) return false; for (let i = 0; i < arr.length; i++) arr[i] = +str[i] || 0; return true; },

  /* ---------- iso math ---------- */
  toWorld(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; },
  fromWorld(wx, wy) { return { x: (wy / (TH / 2) + wx / (TW / 2)) / 2, y: (wy / (TH / 2) - wx / (TW / 2)) / 2 }; },

  /* ---------- static terrain canvas ---------- */
  renderTerrain() {
    const pad = 40;
    const W = MAP * TW + pad * 2, H = MAP * TH + pad * 2 + CLIFF;
    const c = makeCanvas(W * TSCALE, H * TSCALE), ctx = c.getContext('2d');
    ctx.scale(TSCALE, TSCALE);
    this.terrainOX = MAP * TW / 2 + pad; this.terrainOY = pad;
    ctx.translate(this.terrainOX, this.terrainOY);
    const P = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
    const diamond = (x, y, sc = 1, dz = 0) => {
      const cx = (x - y) * TW / 2, cy = (x + y + 1) * TH / 2 + dz;
      ctx.beginPath();
      ctx.moveTo(cx, cy - TH / 2 * sc); ctx.lineTo(cx + TW / 2 * sc, cy); ctx.lineTo(cx, cy + TH / 2 * sc); ctx.lineTo(cx - TW / 2 * sc, cy); ctx.closePath();
    };
    const land = (x, y) => this.isLand(x, y);
    const rnd = (x, y, k) => hash2(x, y, k + this.seedK);
    this.seedK = G.seed % 997;

    // 1. shallow water halo (layered soft diamonds)
    const layers = [[3.4, 'rgba(60,200,210,0.07)'], [2.6, 'rgba(70,210,215,0.09)'], [1.9, 'rgba(90,220,215,0.12)'], [1.4, 'rgba(130,230,210,0.16)']];
    for (const [sc, col] of layers) {
      ctx.fillStyle = col;
      for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) if (land(x, y)) { diamond(x, y, sc, CLIFF * 0.5); ctx.fill(); }
    }
    // 2. wet sand ring / beach foam base
    ctx.fillStyle = '#c9b27a';
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) if (land(x, y)) { diamond(x, y, 1.18, CLIFF); ctx.fill(); }
    // 3. cliff faces on front-facing edges
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      if (!land(x, y)) continue;
      const t = this.tiles[this.idx(x, y)];
      const top = t === T_SAND ? ['#d8c088', '#a88a54'] : ['#8a6a40', '#4e3820'];
      const [a0, a1] = P(x, y + 1), [b0, b1] = P(x + 1, y + 1), [c0, c1] = P(x + 1, y);
      if (!land(x, y + 1)) { // south-west face
        const g = ctx.createLinearGradient(0, a1, 0, a1 + CLIFF); g.addColorStop(0, top[0]); g.addColorStop(1, top[1]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a0, a1); ctx.lineTo(b0, b1); ctx.lineTo(b0, b1 + CLIFF); ctx.lineTo(a0, a1 + CLIFF); ctx.closePath(); ctx.fill();
        this.strata(ctx, a0, a1, b0, b1, t);
      }
      if (!land(x + 1, y)) { // south-east face (darker)
        const g = ctx.createLinearGradient(0, c1, 0, c1 + CLIFF); g.addColorStop(0, shade(top[0], -0.18)); g.addColorStop(1, shade(top[1], -0.25));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b0, b1); ctx.lineTo(c0, c1); ctx.lineTo(c0, c1 + CLIFF); ctx.lineTo(b0, b1 + CLIFF); ctx.closePath(); ctx.fill();
        this.strata(ctx, b0, b1, c0, c1, t);
      }
    }
    // 4. top surfaces
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      const t = this.tiles[this.idx(x, y)];
      if (t < T_SAND) continue;
      const sh = this.shade[this.idx(x, y)];
      let col;
      if (t === T_SAND) col = mix('#f0dca0', '#dcc080', sh);
      else if (t === T_MOUNT) col = mix('#6a5a48', '#4a3e32', sh);
      else {
        col = mix('#8cc45a', '#5a9a3c', clamp(sh * 1.3 - 0.15, 0, 1));
        // grass near sand turns yellowish
        let nearSand = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nt = this.inMap(x + dx, y + dy) ? this.tiles[this.idx(x + dx, y + dy)] : 0; if (nt === T_SAND || nt < T_SAND) nearSand++; }
        if (nearSand) col = mix(col, '#b8c86a', 0.35);
      }
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      diamond(x, y); ctx.fill(); ctx.stroke();
    }
    // 5. soft light/dark patches for organic look
    ctx.save();
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      const t = this.tiles[this.idx(x, y)];
      if (t !== T_GRASS) continue;
      const n = fbm(x * 0.35, y * 0.35, this.seedK + 7, 2);
      if (n > 0.58) { ctx.fillStyle = `rgba(20,60,10,${(n - 0.58) * 0.5})`; diamond(x, y, 1.3); ctx.fill(); }
      else if (n < 0.38) { ctx.fillStyle = `rgba(230,250,150,${(0.38 - n) * 0.35})`; diamond(x, y, 1.3); ctx.fill(); }
    }
    ctx.restore();
    // 6. details: grass blades, flowers, dirt, sand speckles, shells
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      const t = this.tiles[this.idx(x, y)];
      if (t < T_SAND) continue;
      const [tx, ty] = P(x, y);
      const cyy = ty + TH / 2;
      const inTile = (u, v) => [tx + (u - v) * TW / 2, cyy - TH / 2 + (u + v) * TH / 2];
      if (t === T_GRASS) {
        // dirt patch
        if (rnd(x, y, 3) < 0.08) {
          const [px, py] = inTile(0.3 + rnd(x, y, 4) * 0.4, 0.3 + rnd(x, y, 5) * 0.4);
          const g = ctx.createRadialGradient(px, py, 0, px, py, 16);
          g.addColorStop(0, 'rgba(120,90,50,0.45)'); g.addColorStop(1, 'rgba(120,90,50,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, 18, 9, 0, 0, TAU); ctx.fill();
        }
        for (let k = 0; k < 16; k++) {
          const u = rnd(x, y, 10 + k), v = rnd(x, y, 40 + k);
          const [px, py] = inTile(u, v);
          const hgt = 2.5 + rnd(x, y, 70 + k) * 3.5;
          const dark = rnd(x, y, 90 + k) < 0.55;
          ctx.strokeStyle = dark ? 'rgba(40,90,25,0.55)' : 'rgba(190,235,120,0.5)';
          ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 0.5, py - hgt * 0.6, px + (rnd(x, y, 99 + k) - 0.5) * 3, py - hgt); ctx.stroke();
        }
        if (rnd(x, y, 200) < 0.18) {
          const cols = ['#fff6e0', '#ffd23f', '#ff8ab0', '#b08aff', '#ff6a4a'];
          const col = cols[Math.floor(rnd(x, y, 201) * cols.length)];
          for (let k = 0; k < 4; k++) {
            const [px, py] = inTile(rnd(x, y, 210 + k), rnd(x, y, 220 + k));
            ctx.fillStyle = 'rgba(30,70,20,0.6)'; ctx.fillRect(px - 0.4, py - 3, 0.8, 3);
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py - 3, 1.3, 0, TAU); ctx.fill();
          }
        }
      } else if (t === T_SAND) {
        for (let k = 0; k < 14; k++) {
          const [px, py] = inTile(rnd(x, y, 300 + k), rnd(x, y, 330 + k));
          ctx.fillStyle = rnd(x, y, 360 + k) < 0.5 ? 'rgba(160,120,60,0.35)' : 'rgba(255,250,230,0.6)';
          ctx.fillRect(px, py, 1.2, 1.2);
        }
        if (rnd(x, y, 400) < 0.07) {
          const [px, py] = inTile(0.5, 0.5);
          ctx.fillStyle = '#fbe9dc'; ctx.strokeStyle = '#b88a6a'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.ellipse(px, py, 2.6, 1.8, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
        }
      } else if (t === T_MOUNT) {
        for (let k = 0; k < 10; k++) {
          const [px, py] = inTile(rnd(x, y, 500 + k), rnd(x, y, 530 + k));
          ctx.fillStyle = rnd(x, y, 560 + k) < 0.5 ? 'rgba(30,20,15,0.4)' : 'rgba(160,140,120,0.35)';
          ctx.beginPath(); ctx.ellipse(px, py, 2 + rnd(x, y, 590 + k) * 3, 1.2 + rnd(x, y, 600 + k) * 1.5, 0, 0, TAU); ctx.fill();
        }
      }
    }
    // 7. grass tufts spilling onto sand borders
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      if (this.tiles[this.idx(x, y)] !== T_SAND) continue;
      let g = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inMap(x + dx, y + dy) && this.tiles[this.idx(x + dx, y + dy)] === T_GRASS) g++;
      if (!g) continue;
      const [tx, ty] = P(x, y);
      for (let k = 0; k < 7; k++) {
        const u = rnd(x, y, 700 + k), v = rnd(x, y, 720 + k);
        const px = tx + (u - v) * TW / 2, py = ty + (u + v) * TH / 2;
        ctx.fillStyle = `rgba(110,160,60,${0.35 + rnd(x, y, 740 + k) * 0.3})`;
        ctx.beginPath(); ctx.ellipse(px, py, 3 + u * 3, 1.6 + v, 0, 0, TAU); ctx.fill();
      }
    }
    this.terrain = c;
  },
  strata(ctx, x0, y0, x1, y1, t) {
    ctx.save();
    ctx.strokeStyle = t === T_SAND ? 'rgba(120,90,40,0.25)' : 'rgba(30,20,10,0.3)';
    ctx.lineWidth = 0.8;
    for (let k = 1; k <= 3; k++) {
      const dz = k * CLIFF / 4 + Math.sin(x0 * 0.3 + k) * 1.2;
      ctx.beginPath(); ctx.moveTo(x0, y0 + dz); ctx.lineTo(x1, y1 + dz); ctx.stroke();
    }
    // grass overhang lip
    if (t === T_GRASS) {
      ctx.strokeStyle = '#5a9a3c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x0, y0 + 1); ctx.lineTo(x1, y1 + 1); ctx.stroke();
    }
    ctx.restore();
  },
};

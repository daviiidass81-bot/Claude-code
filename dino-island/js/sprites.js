'use strict';
/* ==========================================================
   Sprites: procedurally painted trees, rocks, volcano,
   buildings and decorations (pre-rendered at 2x)
   ========================================================== */
const SPR = 2;
const Sprites = { trees: {}, rocks: {}, buildings: {}, decos: {}, fences: {}, misc: {}, icons: {} };

function makeSprite(w, h, ax, ay, draw) {
  const c = makeCanvas(w * SPR, h * SPR), ctx = c.getContext('2d');
  ctx.scale(SPR, SPR); ctx.translate(ax, ay);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const extra = draw(ctx) || {};
  return Object.assign({ c, ax, ay, w, h }, extra);
}
function drawSprite(ctx, s, x, y, scale = 1, alpha = 1) {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(s.c, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/* ---------- foliage helpers ---------- */
function lumpyCircle(ctx, x, y, r, rng, lumps = 9, amp = 0.12) {
  const ph = rng() * TAU;
  ctx.beginPath();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + amp * Math.sin(a * lumps + ph) + amp * 0.5 * Math.sin(a * (lumps + 4) + ph * 2));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function leafBlob(ctx, x, y, r, pal, rng, dim = 0) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r * 1.1);
  g.addColorStop(0, shade(pal.light, -dim)); g.addColorStop(0.5, shade(pal.base, -dim)); g.addColorStop(1, shade(pal.dark, -dim));
  ctx.fillStyle = g;
  lumpyCircle(ctx, x, y, r, rng);
  ctx.fill();
  // leaf texture: tiny highlight crescents on the lit side, dark notches on the shadow side
  ctx.save();
  lumpyCircle(ctx, x, y, r, rng); ctx.clip();
  for (let i = 0; i < r * 1.4; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const lit = (px - x) + (py - y) < 0;
    ctx.strokeStyle = lit ? rgba(pal.light, 0.55) : rgba(pal.dark, 0.5);
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(px, py, 1.8 + rng() * 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  ctx.restore();
}
function groundShadow(ctx, x, y, rx, ry, a = 0.3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(10,30,5,${a})`); g.addColorStop(1, 'rgba(10,30,5,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}
function trunkPath(ctx, x0, y0, x1, y1, w0, w1, bend) {
  const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
  ctx.beginPath();
  ctx.moveTo(x0 - w0, y0);
  ctx.quadraticCurveTo(mx - (w0 + w1) / 2, my, x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.quadraticCurveTo(mx + (w0 + w1) / 2, my, x0 + w0, y0);
  ctx.closePath();
}
function barkFill(ctx, x, yTop, yBot, w, light, dark) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, light); g.addColorStop(0.45, mix(light, dark, 0.35)); g.addColorStop(1, dark);
  return g;
}

const FOLIAGE = [
  { base: '#3f8a34', light: '#9ad86a', dark: '#1a4418' },
  { base: '#4c9438', light: '#b4e27a', dark: '#1e4a1a' },
  { base: '#2f7a44', light: '#86d09a', dark: '#123a22' },
  { base: '#5a8a2a', light: '#c6de6a', dark: '#2a4410' },
  { base: '#347034', light: '#7cc06a', dark: '#153015' },
];

/* ---------- tree painters ---------- */
function paintBroadleaf(ctx, rng, v) {
  const pal = FOLIAGE[v % FOLIAGE.length];
  const H = 58 + rng() * 22, R = 24 + rng() * 8;
  groundShadow(ctx, 10, 2, R * 1.3, R * 0.55, 0.35);
  // buttress roots
  ctx.fillStyle = '#4a321c';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 2, -12); ctx.quadraticCurveTo(i * 5, -2, i * 8 + (i > 0 ? 3 : -3), 2); ctx.lineTo(i * 3, 1); ctx.closePath(); ctx.fill();
  }
  const bend = (rng() - 0.5) * 12;
  trunkPath(ctx, 0, 1, bend * 0.6, -H + R * 0.4, 5, 2.5, bend);
  ctx.fillStyle = barkFill(ctx, 0, -H, 0, 5, '#8a6a44', '#3a2614'); ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,8,0.45)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) { const y = -4 - i * (H - R) / 6; ctx.beginPath(); ctx.moveTo(-3, y); ctx.quadraticCurveTo(0, y - 3, 3, y - 1); ctx.stroke(); }
  // branches
  ctx.strokeStyle = '#4a321c'; ctx.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) { const sx = bend * 0.4, sy = -H * 0.55 - i * 6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (i - 1) * 10, sy - 10, sx + (i - 1) * 18, sy - 18); ctx.stroke(); }
  // canopy
  const cx = bend * 0.6, cy = -H;
  const blobs = [];
  for (let i = 0; i < 15; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R * 0.85;
    blobs.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.7, R * (0.38 + rng() * 0.22)]);
  }
  blobs.push([cx, cy + R * 0.15, R * 0.6]);
  blobs.sort((a, b) => a[1] - b[1]);
  // dark underside mass
  ctx.fillStyle = pal.dark; lumpyCircle(ctx, cx, cy + R * 0.2, R * 0.95, rng, 7, 0.1); ctx.fill();
  blobs.forEach(([x, y, r], i) => leafBlob(ctx, x, y, r, pal, rng, (y - cy) / R * 0.18));
  // occasional flowering tree
  if (v % 7 === 3) for (let i = 0; i < 18; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R;
    ctx.fillStyle = rng() < 0.5 ? '#ff6a8a' : '#ffb03a';
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - 3, 1.6, 0, TAU); ctx.fill();
  }
  return { hitR: R, hitH: H + R };
}
function paintAraucaria(ctx, rng, v) {
  const H = 96 + rng() * 26;
  groundShadow(ctx, 12, 2, 26, 11, 0.33);
  trunkPath(ctx, 0, 1, 0, -H, 4, 1.5, (rng() - 0.5) * 4);
  ctx.fillStyle = barkFill(ctx, 0, -H, 0, 4, '#7a5a3a', '#2e1e10'); ctx.fill();
  const pal = { base: '#2a6a3a', light: '#6aaa6a', dark: '#0e2e18' };
  const tiers = 6;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const y = -H * 0.42 - k * H * 0.58;
    const w = lerp(26, 8, k) * (0.85 + rng() * 0.3);
    // drooping umbrella of branch clusters
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(side * w * 0.6, y - 4, side * w, y + 3); ctx.stroke();
    }
    const n = Math.round(4 + w / 5);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const px = u * w, py = y - 3 + Math.abs(u) * 5 - (1 - Math.abs(u)) * 3;
      const r = 5 + (1 - Math.abs(u)) * 3;
      const g = ctx.createRadialGradient(px - 2, py - 3, 0.5, px, py, r * 1.3);
      g.addColorStop(0, pal.light); g.addColorStop(0.6, pal.base); g.addColorStop(1, pal.dark);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.35, r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#9ad08a', 0.35); ctx.lineWidth = 0.7;
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(px - r + j * r * 0.6, py - 1); ctx.lineTo(px - r + j * r * 0.6 + 2, py + 2.5); ctx.stroke(); }
    }
  }
  // crown tuft
  leafBlob(ctx, 0, -H - 2, 6, pal, rng);
  return { hitR: 22, hitH: H + 8 };
}
function paintTreeFern(ctx, rng, v) {
  const H = 42 + rng() * 16;
  groundShadow(ctx, 8, 2, 24, 10, 0.3);
  const bend = (rng() - 0.5) * 8;
  trunkPath(ctx, 0, 1, bend, -H, 3.5, 3, bend * 0.5);
  ctx.fillStyle = barkFill(ctx, 0, -H, 0, 4, '#6a4a2a', '#2a1a0c'); ctx.fill();
  ctx.fillStyle = 'rgba(20,10,4,0.5)';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(bend * (i / 14) + (rng() - 0.5) * 4, -i * H / 14, 1.2, 0, TAU); ctx.fill(); }
  const tx = bend, ty = -H;
  const fronds = [];
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i / 10 - 0.5) * Math.PI * 1.25 + (rng() - 0.5) * 0.2;
    fronds.push({ a, len: 26 + rng() * 10, back: Math.abs(Math.cos(a)) < 0.5 && i % 2 === 0 });
  }
  fronds.sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
  for (const f of fronds) {
    const ex = tx + Math.cos(f.a) * f.len * 1.1, ey = ty + Math.sin(f.a) * f.len * 0.45 + f.len * 0.55;
    const mx = tx + Math.cos(f.a) * f.len * 0.6, my = ty + Math.sin(f.a) * f.len * 0.55 - 6;
    const col = f.back ? '#2e6a26' : '#4e9a34';
    ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    // leaflets
    for (let s = 0.12; s <= 1; s += 0.075) {
      const bx = (1 - s) * (1 - s) * tx + 2 * (1 - s) * s * mx + s * s * ex;
      const by = (1 - s) * (1 - s) * ty + 2 * (1 - s) * s * my + s * s * ey;
      const dx = 2 * (1 - s) * (mx - tx) + 2 * s * (ex - mx), dy = 2 * (1 - s) * (my - ty) + 2 * s * (ey - my);
      const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const ll = 7 * (1 - s * 0.7);
      ctx.strokeStyle = s < 0.5 ? col : shade(col, 0.15); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + nx * ll + dx / l * 2, by + ny * ll + dy / l * 2 + 1.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - nx * ll + dx / l * 2, by - ny * ll + dy / l * 2 + 1.5); ctx.stroke();
    }
  }
  ctx.fillStyle = '#6a8a3a'; ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, TAU); ctx.fill();
  return { hitR: 22, hitH: H + 18 };
}
function paintPalm(ctx, rng, v, scale = 1) {
  ctx.save(); ctx.scale(scale, scale);
  const H = 62 + rng() * 22, lean = (rng() < 0.5 ? -1 : 1) * (8 + rng() * 14);
  groundShadow(ctx, lean * 0.5 + 10, 2, 24, 10, 0.3);
  const top = [lean, -H];
  // ringed trunk
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const p = t => [lean * t * t, -H * t];
    const [x0, y0] = p(t0), [x1, y1] = p(t1);
    const w = lerp(4.2, 2.6, t0);
    const g = ctx.createLinearGradient(x0 - w, 0, x0 + w, 0);
    g.addColorStop(0, '#b89a6a'); g.addColorStop(0.5, '#8a6a44'); g.addColorStop(1, '#4e3a22');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.lineTo(x1 - w * 0.95, y1 + 0.5); ctx.lineTo(x1 + w * 0.95, y1 + 0.5); ctx.lineTo(x0 + w, y0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(50,34,16,0.6)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x1 - w, y1 + 0.5); ctx.quadraticCurveTo(x1, y1 + 2, x1 + w, y1 + 0.5); ctx.stroke();
  }
  // fronds
  const fr = [];
  for (let i = 0; i < 9; i++) fr.push({ a: (i / 9) * TAU + rng() * 0.3, len: 28 + rng() * 10 });
  fr.sort((a, b) => Math.sin(a.a) - Math.sin(b.a));
  for (const f of fr) {
    const dx = Math.cos(f.a), dz = Math.sin(f.a);
    const ex = top[0] + dx * f.len, ey = top[1] + dz * f.len * 0.45 + f.len * 0.42;
    const mx = top[0] + dx * f.len * 0.55, my = top[1] + dz * f.len * 0.3 - 10;
    const back = dz < -0.2;
    const col = back ? '#3a7a2a' : '#5aa83a';
    for (let s = 0.08; s <= 1; s += 0.05) {
      const bx = (1 - s) * (1 - s) * top[0] + 2 * (1 - s) * s * mx + s * s * ex;
      const by = (1 - s) * (1 - s) * top[1] + 2 * (1 - s) * s * my + s * s * ey;
      const tx = 2 * (1 - s) * (mx - top[0]) + 2 * s * (ex - mx), ty = 2 * (1 - s) * (my - top[1]) + 2 * s * (ey - my);
      const l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
      const ll = 10 * Math.sin(s * Math.PI) + 2;
      ctx.strokeStyle = s < 0.4 ? shade(col, -0.1) : col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + nx * ll + tx / l * 3, by + ny * ll + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - nx * ll + tx / l * 3, by - ny * ll + 5); ctx.stroke();
    }
    ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
  }
  // coconuts
  for (let i = 0; i < 3; i++) {
    const g = ctx.createRadialGradient(top[0] - 2 + i * 2.5, top[1] + 3, 0.5, top[0] - 1 + i * 2.5, top[1] + 4, 3.5);
    g.addColorStop(0, '#9a7a3a'); g.addColorStop(1, '#3a2a10');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(top[0] - 2.5 + i * 2.5, top[1] + 4 + (i % 2), 2.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
  return { hitR: 20 * scale, hitH: (H + 20) * scale };
}
function paintBush(ctx, rng, v) {
  const pal = FOLIAGE[(v + 2) % FOLIAGE.length];
  groundShadow(ctx, 5, 2, 18, 8, 0.3);
  if (v % 4 === 3) { // cycad
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath(); ctx.ellipse(0, -6, 6, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,8,0.6)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-5, -10 + i * 3); ctx.lineTo(5, -12 + i * 3); ctx.stroke(); }
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI + (i / 9) * Math.PI, len = 18 + rng() * 6;
      const ex = Math.cos(a) * len, ey = -14 + Math.sin(a) * len * 0.6;
      ctx.strokeStyle = i % 2 ? '#3a7a2a' : '#5a9a34'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(ex * 0.5, -22, ex, ey); ctx.stroke();
      for (let s = 0.2; s < 1; s += 0.12) {
        const bx = ex * s, by = -14 + (ey + 14) * s - Math.sin(s * Math.PI) * 6;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 2, by + 4); ctx.moveTo(bx, by); ctx.lineTo(bx - 2, by + 4); ctx.stroke();
      }
    }
    return { hitR: 16, hitH: 26 };
  }
  const n = 5 + Math.floor(rng() * 3);
  const blobs = [];
  for (let i = 0; i < n; i++) blobs.push([(rng() - 0.5) * 22, -8 - rng() * 10, 7 + rng() * 5]);
  blobs.sort((a, b) => a[1] - b[1]);
  blobs.forEach(([x, y, r]) => leafBlob(ctx, x, y, r, pal, rng));
  if (v % 4 === 1) for (let i = 0; i < 10; i++) { ctx.fillStyle = pick(['#ff5a7a', '#ffd23f', '#fff']); ctx.beginPath(); ctx.arc((rng() - 0.5) * 24, -8 - rng() * 14, 1.4, 0, TAU); ctx.fill(); }
  if (v % 4 === 2) for (let i = 0; i < 6; i++) { ctx.fillStyle = '#d02a2a'; ctx.beginPath(); ctx.arc((rng() - 0.5) * 20, -6 - rng() * 12, 1.8, 0, TAU); ctx.fill(); }
  return { hitR: 16, hitH: 26 };
}
function paintRock(ctx, rng, v, big) {
  const n = big ? 3 : 1;
  groundShadow(ctx, 6, 2, big ? 32 : 18, big ? 13 : 8, 0.4);
  const rocks = [];
  for (let i = 0; i < n; i++) rocks.push([big ? (i - 1) * 14 + (rng() - 0.5) * 6 : 0, big ? (i === 1 ? -4 : 2) : 0, big ? (i === 1 ? 20 : 14) : 11 + rng() * 4]);
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of rocks) {
    const pts = [];
    const k = 7 + Math.floor(rng() * 3);
    for (let i = 0; i < k; i++) {
      const a = Math.PI + (i / (k - 1)) * Math.PI;
      const rr = r * (0.8 + rng() * 0.35);
      pts.push([x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr * (0.95 + rng() * 0.3)]);
    }
    pts.push([x + r * 1.1, y + 2], [x - r * 1.1, y + 2]);
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + 2);
    g.addColorStop(0, '#b8b0a4'); g.addColorStop(0.5, '#8a8276'); g.addColorStop(1, '#4e4840');
    ctx.fillStyle = g; ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 1;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
    // facets
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x + r * 0.1, y - r * 0.2); ctx.lineTo(x + r * 0.6, y - r * 0.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r * 0.2); ctx.lineTo(x + r * 0.2, y + 1); ctx.stroke();
    // moss
    ctx.save(); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.clip();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = rgba(rng() < 0.5 ? '#6a9a3a' : '#4a7a2a', 0.8); ctx.beginPath(); ctx.ellipse(x + (rng() - 0.6) * r * 1.2, y - r * (0.7 + rng() * 0.4), 3 + rng() * 4, 1.6 + rng() * 2, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // pebbles
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#7a7266'; ctx.beginPath(); ctx.ellipse((rng() - 0.5) * 34, 2 + rng() * 4, 2, 1.3, 0, 0, TAU); ctx.fill(); }
  return { hitR: big ? 34 : 16, hitH: big ? 34 : 22 };
}

/* ---------- volcano ---------- */
function paintVolcano() {
  const W = 620, Hh = 330;
  return makeSprite(W, Hh + 60, W / 2, Hh, ctx => {
    const rng = mulberry32(77);
    const baseW = 290, topW = 60, h = 250;
    groundShadow(ctx, 40, 10, 300, 90, 0.35);
    // cone body
    const g = ctx.createLinearGradient(-baseW, 0, baseW, 0);
    g.addColorStop(0, '#8a7a6a'); g.addColorStop(0.35, '#6a5a4c'); g.addColorStop(0.7, '#43382e'); g.addColorStop(1, '#2a221c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-baseW, 20);
    ctx.bezierCurveTo(-baseW * 0.6, 10, -topW * 1.6, -h * 0.7, -topW, -h);
    ctx.quadraticCurveTo(0, -h - 10, topW, -h);
    ctx.bezierCurveTo(topW * 1.6, -h * 0.7, baseW * 0.6, 10, baseW, 20);
    ctx.quadraticCurveTo(0, 90, -baseW, 20);
    ctx.closePath(); ctx.fill();
    // erosion ridges
    ctx.save(); ctx.clip();
    for (let i = 0; i < 26; i++) {
      const t = i / 25, x0 = lerp(-topW, topW, t), x1 = lerp(-baseW, baseW, t) + (rng() - 0.5) * 30;
      ctx.strokeStyle = t < 0.5 ? 'rgba(200,180,160,0.18)' : 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2 + rng() * 3;
      ctx.beginPath(); ctx.moveTo(x0, -h + 4); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.2, -h * 0.5, x1 - (x1 - x0) * 0.2, -40, x1, 40); ctx.stroke();
    }
    // lava streams
    for (const [x0, x1] of [[-20, -70], [14, 60]]) {
      const lg = ctx.createLinearGradient(0, -h, 0, -h * 0.3);
      lg.addColorStop(0, '#ffd23a'); lg.addColorStop(0.3, '#ff6a1a'); lg.addColorStop(1, 'rgba(120,20,10,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x0, -h + 2); ctx.bezierCurveTo(x0 - 5, -h * 0.8, x1, -h * 0.6, x1 + (x1 - x0) * 0.3, -h * 0.35); ctx.stroke();
    }
    // jungle skirt
    for (let i = 0; i < 70; i++) {
      const t = rng() * 2 - 1;
      const x = t * baseW * 0.95, y = 10 + Math.abs(t) * -5 + rng() * 40 - Math.pow(1 - Math.abs(t), 2) * 70 * rng();
      leafBlob(ctx, x, y, 12 + rng() * 14, FOLIAGE[i % 5], rng, 0.1);
    }
    ctx.restore();
    // crater
    const cg = ctx.createRadialGradient(0, -h, 4, 0, -h, topW);
    cg.addColorStop(0, '#fff2a0'); cg.addColorStop(0.3, '#ff8a1a'); cg.addColorStop(0.7, '#a02a0a'); cg.addColorStop(1, '#3a1a10');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, -h + 2, topW * 0.95, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1e16'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -h + 2, topW, 14, 0, Math.PI, TAU); ctx.stroke();
    return { lights: [{ x: 0, y: -h, r: 160, col: 'rgba(255,120,30,' }] };
  });
}

/* ==========================================================
   Iso painter for buildings
   ========================================================== */
class Iso {
  constructor(ctx, lit) { this.c = ctx; this.l = lit; this.lights = []; }
  p(u, v, z = 0) { return [(u - v) * TW / 2, (u + v) * TH / 2 - z]; }
  path(pts, ctx = this.c) { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
  poly(pts, fill, stroke, lw = 1) { const c = this.c; this.path(pts); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
  vgrad(col, zTopY, zBotY, dark = 0.18) { const g = this.c.createLinearGradient(0, zTopY, 0, zBotY); g.addColorStop(0, shade(col, 0.06)); g.addColorStop(1, shade(col, -dark)); return g; }
  shadow(u0, v0, u1, v1, hgt) {
    // soft cast shadow towards +u (sun from the upper left)
    const d = Math.min(hgt / 40, 2.2), c = this.c;
    c.save();
    c.filter = 'blur(5px)';
    this.poly([this.p(u0 + 0.1, v0 + 0.1), this.p(u1 + d * 0.8, v0 + 0.2), this.p(u1 + d, v1 + d * 0.35), this.p(u1, v1 + 0.15), this.p(u0 + 0.15, v1)], 'rgba(10,30,5,0.24)');
    c.filter = 'none';
    // contact shadow hugging the footprint
    this.poly([this.p(u0, v0), this.p(u1 + 0.08, v0), this.p(u1 + 0.08, v1 + 0.08), this.p(u0, v1 + 0.08)], 'rgba(10,30,5,0.18)');
    c.restore();
  }
  box(u0, v0, u1, v1, z0, z1, col, o = {}) {
    const L = o.left || col, R = o.right || shade(col, -0.22), T = o.top || shade(col, 0.14);
    const edge = o.edge === undefined ? 'rgba(0,0,0,0.28)' : o.edge;
    const fl = [this.p(u0, v1, z0), this.p(u1, v1, z0), this.p(u1, v1, z1), this.p(u0, v1, z1)];
    const fr = [this.p(u1, v1, z0), this.p(u1, v0, z0), this.p(u1, v0, z1), this.p(u1, v1, z1)];
    const tp = [this.p(u0, v0, z1), this.p(u1, v0, z1), this.p(u1, v1, z1), this.p(u0, v1, z1)];
    const yb = this.p(u1, v1, z0)[1], yt = this.p(u1, v1, z1)[1];
    this.poly(fl, o.flat ? L : this.vgrad(L, yt, yb), edge, 0.8);
    this.poly(fr, o.flat ? R : this.vgrad(R, yt, yb), edge, 0.8);
    if (!o.noTop) this.poly(tp, T, edge, 0.8);
    if (o.hl !== false) { // top edge highlight
      const c = this.c; c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(...this.p(u0, v1, z1)); c.lineTo(...this.p(u1, v1, z1)); c.lineTo(...this.p(u1, v0, z1)); c.stroke();
    }
  }
  quadL(u0, u1, v, z0, z1, fill, stroke, ctx = this.c) { this.path([this.p(u0, v, z0), this.p(u1, v, z0), this.p(u1, v, z1), this.p(u0, v, z1)], ctx); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); } }
  quadR(u, v0, v1, z0, z1, fill, stroke, ctx = this.c) { this.path([this.p(u, v1, z0), this.p(u, v0, z0), this.p(u, v0, z1), this.p(u, v1, z1)], ctx); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); } }
  glass(y0, y1, lit) {
    const g = this.c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#9ac8d8'); g.addColorStop(0.45, '#3a6a80'); g.addColorStop(1, '#1e3a4a');
    return g;
  }
  winL(u0, u1, v, z0, z1, o = {}) {
    const yt = this.p(u0, v, z1)[1], yb = this.p(u0, v, z0)[1];
    this.quadL(u0, u1, v, z0, z1, this.glass(yt, yb), o.frame || '#3a2a1a');
    const c = this.c; c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(...this.p(u0 + (u1 - u0) * 0.2, v, z1 - 1)); c.lineTo(...this.p(u0 + (u1 - u0) * 0.05, v, z0 + (z1 - z0) * 0.4)); c.stroke();
    if (o.mullion) { c.strokeStyle = o.frame || '#3a2a1a'; c.lineWidth = 1; for (let k = 1; k < o.mullion; k++) { const u = u0 + (u1 - u0) * k / o.mullion; c.beginPath(); c.moveTo(...this.p(u, v, z0)); c.lineTo(...this.p(u, v, z1)); c.stroke(); } }
    if (this.l && o.lit !== false) this.quadL(u0, u1, v, z0, z1, o.litCol || 'rgba(255,214,130,0.95)', null, this.l);
  }
  winR(u, v0, v1, z0, z1, o = {}) {
    const yt = this.p(u, v0, z1)[1], yb = this.p(u, v0, z0)[1];
    const g = this.c.createLinearGradient(0, yt, 0, yb); g.addColorStop(0, '#7aa8b8'); g.addColorStop(0.5, '#2e5a70'); g.addColorStop(1, '#16303e');
    this.quadR(u, v0, v1, z0, z1, g, o.frame || '#3a2a1a');
    if (o.mullion) { const c = this.c; c.strokeStyle = o.frame || '#3a2a1a'; c.lineWidth = 1; for (let k = 1; k < o.mullion; k++) { const v = v0 + (v1 - v0) * k / o.mullion; c.beginPath(); c.moveTo(...this.p(u, v, z0)); c.lineTo(...this.p(u, v, z1)); c.stroke(); } }
    if (this.l && o.lit !== false) this.quadR(u, v0, v1, z0, z1, o.litCol || 'rgba(255,200,110,0.85)', null, this.l);
  }
  textL(str, uc, v, z, size, fill, o = {}) {
    const c = this.c, [x, y] = this.p(uc, v, z);
    c.save(); c.translate(x, y); c.transform(1, 0.5, 0, 1, 0, 0);
    c.font = `${o.weight || '400'} ${size}px ${o.font || "'Lilita One', 'Arial Black', sans-serif"}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.sw || 2.5; c.strokeText(str, 0, 0); }
    c.fillStyle = fill; c.fillText(str, 0, 0);
    c.restore();
    if (this.l && o.glow) { const l = this.l; l.save(); l.translate(x, y); l.transform(1, 0.5, 0, 1, 0, 0); l.font = c.font; l.textAlign = 'center'; l.textBaseline = 'middle'; l.fillStyle = o.glow; l.fillText(str, 0, 0); l.restore(); }
  }
  textR(str, u, vc, z, size, fill, o = {}) {
    const c = this.c, [x, y] = this.p(u, vc, z);
    c.save(); c.translate(x, y); c.transform(1, -0.5, 0, 1, 0, 0);
    c.font = `${o.weight || '400'} ${size}px ${o.font || "'Lilita One', 'Arial Black', sans-serif"}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.sw || 2.5; c.strokeText(str, 0, 0); }
    c.fillStyle = fill; c.fillText(str, 0, 0);
    c.restore();
  }
  // gable roof: axis 'u' => ridge runs along u, visible slope faces +v, gable at u1
  gable(u0, v0, u1, v1, z, rh, col, axis = 'u', o = {}) {
    const c = this.c, ov = o.over ?? 0.12;
    u0 -= ov; v0 -= ov; u1 += ov; v1 += ov;
    const dark = shade(col, -0.25), edge = 'rgba(0,0,0,0.35)';
    if (axis === 'u') {
      const vm = (v0 + v1) / 2;
      const slope = [this.p(u0, v1, z), this.p(u1, v1, z), this.p(u1, vm, z + rh), this.p(u0, vm, z + rh)];
      const gab = [this.p(u1, v0, z), this.p(u1, v1, z), this.p(u1, vm, z + rh)];
      const wallCol = o.wall || shade(col, -0.1);
      this.poly(gab, this.vgrad(wallCol, this.p(u1, vm, z + rh)[1], this.p(u1, v1, z)[1]), edge);
      if (o.gableWin) { const [gx, gy] = this.p(u1, vm, z + rh * 0.4); c.fillStyle = '#2a3a44'; c.beginPath(); c.arc(gx, gy, 3, 0, TAU); c.fill(); }
      this.poly(slope, this.vgrad(col, this.p(u0, vm, z + rh)[1], this.p(u0, v1, z)[1], 0.2), edge);
      this.roofLines(slope, o.style, col);
      // ridge cap
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 2.2; c.beginPath(); c.moveTo(...this.p(u0, vm, z + rh)); c.lineTo(...this.p(u1, vm, z + rh)); c.stroke();
    } else {
      const um = (u0 + u1) / 2;
      const slope = [this.p(u1, v0, z), this.p(u1, v1, z), this.p(um, v1, z + rh), this.p(um, v0, z + rh)];
      const gab = [this.p(u0, v1, z), this.p(u1, v1, z), this.p(um, v1, z + rh)];
      const wallCol = o.wall || shade(col, 0.05);
      this.poly(gab, this.vgrad(wallCol, this.p(um, v1, z + rh)[1], this.p(u0, v1, z)[1]), edge);
      if (o.gableWin) { const [gx, gy] = this.p(um, v1, z + rh * 0.4); c.fillStyle = '#2a3a44'; c.beginPath(); c.arc(gx, gy, 3, 0, TAU); c.fill(); }
      this.poly(slope, this.vgrad(dark, this.p(um, v0, z + rh)[1], this.p(u1, v1, z)[1], 0.2), edge);
      this.roofLines(slope, o.style, dark);
      c.strokeStyle = shade(col, -0.4); c.lineWidth = 2.2; c.beginPath(); c.moveTo(...this.p(um, v0, z + rh)); c.lineTo(...this.p(um, v1, z + rh)); c.stroke();
    }
  }
  // hip roof: pyramid-like, visible faces +v (front-left) and +u (front-right)
  hip(u0, v0, u1, v1, z, rh, col, o = {}) {
    const ov = o.over ?? 0.15;
    u0 -= ov; v0 -= ov; u1 += ov; v1 += ov;
    const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
    const ins = Math.min(u1 - u0, v1 - v0) / 2;
    const ra = [u0 + ins, vm], rb = [u1 - ins, vm];
    const edge = 'rgba(0,0,0,0.35)';
    const fl = [this.p(u0, v1, z), this.p(u1, v1, z), this.p(rb[0], rb[1], z + rh), this.p(ra[0], ra[1], z + rh)];
    const fr = [this.p(u1, v1, z), this.p(u1, v0, z), this.p(rb[0], rb[1], z + rh)];
    this.poly(fl, this.vgrad(col, this.p(ra[0], ra[1], z + rh)[1], this.p(u0, v1, z)[1], 0.15), edge);
    this.roofLines(fl, o.style, col);
    const dk = shade(col, -0.28);
    this.poly(fr, this.vgrad(dk, this.p(rb[0], rb[1], z + rh)[1], this.p(u1, v1, z)[1], 0.15), edge);
    this.roofLines(fr, o.style, dk);
    const c = this.c; c.strokeStyle = shade(col, -0.4); c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(...this.p(u1, v1, z)); c.lineTo(...this.p(rb[0], rb[1], z + rh)); c.lineTo(...this.p(ra[0], ra[1], z + rh)); c.stroke();
  }
  roofLines(pts, style, col) {
    if (!style) return;
    const c = this.c;
    c.save(); this.path(pts); c.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (style === 'thatch') {
      const rng = mulberry32(Math.round(x0 * 13 + y0 * 7));
      for (let i = 0; i < (x1 - x0) * (y1 - y0) / 7; i++) {
        const x = lerp(x0, x1, rng()), y = lerp(y0, y1, rng());
        c.strokeStyle = rng() < 0.5 ? rgba(shade(col, 0.3), 0.6) : rgba(shade(col, -0.35), 0.55);
        c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 2, y + 4 + rng() * 3); c.stroke();
      }
      c.strokeStyle = rgba(shade(col, -0.4), 0.5); c.lineWidth = 1;
      for (let y = y0 + 6; y < y1; y += 7) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (x1 - x0) * 0.1); c.stroke(); }
    } else if (style === 'tile') {
      c.strokeStyle = rgba(shade(col, -0.35), 0.6); c.lineWidth = 0.8;
      for (let y = y0; y < y1 + 40; y += 4) { c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y + (x1 - x0) * 0.5); c.stroke(); }
      c.strokeStyle = rgba(shade(col, 0.25), 0.35);
      for (let y = y0 + 2; y < y1 + 40; y += 4) { c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y + (x1 - x0) * 0.5); c.stroke(); }
    } else if (style === 'metal') {
      c.strokeStyle = rgba(shade(col, -0.3), 0.6); c.lineWidth = 0.8;
      for (let x = x0; x < x1; x += 3.5) { c.beginPath(); c.moveTo(x, y0 - 10); c.lineTo(x + 8, y1 + 10); c.stroke(); }
    }
    c.restore();
  }
  ellipsePath(uc, vc, z, r, ctx = this.c) { const [x, y] = this.p(uc, vc, z); ctx.beginPath(); ctx.ellipse(x, y, r * TW / 2 * 1.414, r * TH / 2 * 1.414, 0, 0, TAU); }
  cyl(uc, vc, z0, z1, r, col, o = {}) {
    const c = this.c, [x, y0] = this.p(uc, vc, z0), y1 = y0 - (z1 - z0);
    const rx = r * TW / 2 * 1.414, ry = r * TH / 2 * 1.414;
    const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, shade(col, 0.1)); g.addColorStop(0.35, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - rx, y1); c.lineTo(x - rx, y0); c.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, y1); c.ellipse(x, y1, rx, ry, 0, 0, Math.PI, false); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; c.stroke();
    if (!o.noTop) { c.fillStyle = o.top || shade(col, 0.2); c.beginPath(); c.ellipse(x, y1, rx, ry, 0, 0, TAU); c.fill(); c.stroke(); }
    return { x, y0, y1, rx, ry };
  }
  dome(uc, vc, z, r, h, col, o = {}) {
    const c = this.c, [x, y] = this.p(uc, vc, z);
    const rx = r * TW / 2 * 1.414, ry = r * TH / 2 * 1.414;
    const g = c.createRadialGradient(x - rx * 0.35, y - h * 0.75, 2, x, y - h * 0.3, rx * 1.2);
    g.addColorStop(0, o.hi || shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI, false); c.ellipse(x, y, rx, h, 0, Math.PI, TAU, false); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; c.stroke();
    if (o.ribs) {
      c.strokeStyle = o.ribs; c.lineWidth = 1;
      for (let i = 1; i < 6; i++) { const k = -1 + i / 3; c.beginPath(); c.ellipse(x, y, Math.abs(k) * rx, h, 0, k < 0 ? Math.PI : Math.PI, k < 0 ? Math.PI * 1.5 : TAU); c.stroke(); }
      for (let j = 1; j < 3; j++) { c.beginPath(); c.ellipse(x, y - h * j / 3, rx * Math.sqrt(1 - (j / 3) ** 2), ry * Math.sqrt(1 - (j / 3) ** 2), 0, 0, Math.PI); c.stroke(); }
    }
    return { x, y, rx, h };
  }
  light(u, v, z, r, col) { const [x, y] = this.p(u, v, z); this.lights.push({ x, y, r, col }); }
  awningL(u0, u1, v, z, depth, c1, c2, stripes = 6) {
    for (let i = 0; i < stripes; i++) {
      const a = u0 + (u1 - u0) * i / stripes, b = u0 + (u1 - u0) * (i + 1) / stripes;
      this.poly([this.p(a, v, z), this.p(b, v, z), this.p(b, v + depth, z - 8), this.p(a, v + depth, z - 8)], i % 2 ? c2 : c1, 'rgba(0,0,0,0.2)', 0.5);
    }
    // scalloped edge
    const c = this.c;
    for (let i = 0; i < stripes; i++) {
      const a = u0 + (u1 - u0) * (i + 0.5) / stripes;
      const [x, y] = this.p(a, v + depth, z - 8);
      c.fillStyle = i % 2 ? c2 : c1; c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI); c.fill();
    }
  }
  crate(u, v, s, z, col = '#a07a4a', fill) {
    this.box(u, v, u + s, v + s, z, z + s * 22, col);
    const c = this.c; c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(...this.p(u, v + s, z)); c.lineTo(...this.p(u + s, v + s, z + s * 22)); c.stroke();
    if (fill) for (let i = 0; i < 5; i++) { const [x, y] = this.p(u + s * (0.2 + (i % 3) * 0.3), v + s * (0.3 + Math.floor(i / 3) * 0.4), z + s * 22); c.fillStyle = fill[i % fill.length]; c.beginPath(); c.arc(x, y - 1.5, 2.3, 0, TAU); c.fill(); }
  }
  plant(u, v, z, s = 1, flowers) {
    const [x, y] = this.p(u, v, z), c = this.c, rng = mulberry32(Math.round(u * 100 + v * 31));
    for (let i = 0; i < 4; i++) leafBlob(c, x + (rng() - 0.5) * 8 * s, y - 4 * s - rng() * 5 * s, (4 + rng() * 2) * s, FOLIAGE[i % 5], rng);
    if (flowers) for (let i = 0; i < 5; i++) { c.fillStyle = flowers; c.beginPath(); c.arc(x + (rng() - 0.5) * 10 * s, y - 5 * s - rng() * 6 * s, 1.3, 0, TAU); c.fill(); }
  }
  lamp(u, v, z, h = 26) {
    const c = this.c, [x, y] = this.p(u, v, z);
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
    c.fillStyle = '#ffe6a0'; c.strokeStyle = '#2a2a2a'; c.lineWidth = 1; c.beginPath(); c.rect(x - 2.5, y - h - 6, 5, 6); c.fill(); c.stroke();
    if (this.l) { this.l.fillStyle = 'rgba(255,230,160,1)'; this.l.beginPath(); this.l.arc(x, y - h - 3, 4, 0, TAU); this.l.fill(); }
    this.lights.push({ x, y: y - h - 3, r: 60, col: 'rgba(255,210,130,' });
  }
}

function buildingSprite(w, h, H, draw) {
  const m = 24;
  const left = h * TW / 2 + m, right = w * TW / 2 + m;
  const top = H + m, bottom = (w + h) * TH / 2 + m;
  const Wd = left + right, Ht = top + bottom;
  let lit = null;
  const s = makeSprite(Wd, Ht, left, top, ctx => {
    lit = makeCanvas(Wd * SPR, Ht * SPR);
    const lctx = lit.getContext('2d'); lctx.scale(SPR, SPR); lctx.translate(left, top);
    const I = new Iso(ctx, lctx);
    draw(I, ctx);
    return { lights: I.lights };
  });
  s.lit = lit;
  return s;
}

/* ==========================================================
   Building painters (local coords: footprint top corner = 0,0)
   ========================================================== */
const PAINT = {
  visitor_center(I) {
    I.shadow(0.2, 0.2, 3.8, 3.8, 120);
    I.box(0.15, 0.15, 3.85, 3.85, 0, 6, '#b8a88a', { top: '#cfc0a0' });
    // steps
    for (let i = 0; i < 3; i++) I.box(1.3, 3.85 + i * 0.07, 2.7, 3.92 + i * 0.07, 0, 6 - i * 2, '#c8b898');
    I.box(0.5, 0.5, 3.5, 3.5, 6, 58, '#efe4cc');
    // wooden base band
    I.quadL(0.5, 3.5, 3.5, 6, 12, '#8a6a44'); I.quadR(3.5, 0.5, 3.5, 6, 12, '#6a4e30');
    I.winL(1.0, 3.0, 3.5, 12, 52, { mullion: 6, frame: '#4a3218' });
    I.winR(3.5, 0.9, 1.7, 22, 48, { mullion: 2 }); I.winR(3.5, 2.1, 3.1, 22, 48, { mullion: 2 });
    // columns
    for (const u of [0.72, 1.55, 2.45, 3.28]) I.box(u - 0.06, 3.5, u + 0.06, 3.62, 6, 60, '#6b4424');
    I.box(0.35, 0.35, 3.65, 3.65, 56, 62, '#6b4424');
    I.box(0.9, 0.9, 3.1, 3.1, 62, 88, '#e6d8bc');
    I.winL(1.1, 2.9, 3.1, 66, 82, { mullion: 5 }); I.winR(3.1, 1.1, 2.9, 66, 82, { mullion: 5 });
    I.hip(0.9, 0.9, 3.1, 3.1, 88, 44, '#b8844a', { style: 'thatch', over: 0.35 });
    // sign board
    I.box(1.2, 3.62, 2.8, 3.7, 62, 76, '#5a3a1e');
    I.textL('VISITOR CENTER', 2.0, 3.72, 69, 9, '#ffd479', { stroke: '#2a1808', glow: 'rgba(255,220,140,1)' });
    I.plant(0.4, 3.9, 6, 1.2, '#ff6a8a'); I.plant(3.9, 0.4, 6, 1.2, '#ffd23f'); I.plant(3.9, 3.0, 6, 1.1);
    I.lamp(0.9, 3.95, 6, 28); I.lamp(3.1, 3.95, 6, 28);
    I.light(2, 3.6, 30, 90, 'rgba(255,200,120,');
    return { flags: [[0.4, 3.7, 62], [3.7, 0.4, 62]] };
  },
  gate(I) {
    I.shadow(0, 0, 3, 1, 120);
    for (const u0 of [0.05, 2.25]) {
      I.box(u0 - 0.05, 0.05, u0 + 0.75, 0.95, 0, 12, '#8a8278', { top: '#a8a096' });
      I.box(u0 + 0.08, 0.18, u0 + 0.62, 0.82, 12, 118, '#6b4424');
      // log texture
      const c = I.c; c.strokeStyle = 'rgba(30,16,6,0.45)'; c.lineWidth = 0.8;
      for (let k = 1; k < 5; k++) { const uu = u0 + 0.08 + 0.54 * k / 5; c.beginPath(); c.moveTo(...I.p(uu, 0.82, 14)); c.lineTo(...I.p(uu, 0.82, 116)); c.stroke(); }
      for (let k = 1; k < 5; k++) { const vv = 0.18 + 0.64 * k / 5; c.beginPath(); c.moveTo(...I.p(u0 + 0.62, vv, 14)); c.lineTo(...I.p(u0 + 0.62, vv, 116)); c.stroke(); }
      I.box(u0 + 0.02, 0.12, u0 + 0.68, 0.88, 118, 124, '#4a2e14');
      I.cyl(u0 + 0.35, 0.5, 124, 134, 0.14, '#3a2a1a');
      I.light(u0 + 0.35, 0.5, 142, 110, 'rgba(255,150,50,');
    }
    // cross beam
    I.box(0, 0.3, 3, 0.7, 100, 112, '#5a3a1e');
    I.box(-0.1, 0.25, 3.1, 0.75, 112, 116, '#3e2612');
    // sign
    I.box(0.8, 0.62, 2.2, 0.7, 76, 100, '#3e2612');
    I.quadL(0.84, 2.16, 0.705, 78, 98, '#2a4a1e');
    I.textL('DINO ISLAND', 1.5, 0.71, 88, 12.5, '#ffc43d', { stroke: '#1a0e02', sw: 3, glow: 'rgba(255,190,80,1)' });
    // hanging vines
    const c = I.c, rng = mulberry32(5);
    for (let i = 0; i < 16; i++) {
      const u = rng() * 3, [x, y] = I.p(u, 0.72, 100);
      const len = 6 + rng() * 22;
      c.strokeStyle = '#3a7a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y + len / 2, x - 1, y + len); c.stroke();
      for (let k = 0; k < len; k += 4) { c.fillStyle = k % 8 ? '#5aa83a' : '#3e8a2a'; c.beginPath(); c.ellipse(x + (k % 8 ? 2 : -2), y + k, 2.2, 1.3, 0.5, 0, TAU); c.fill(); }
    }
    return { torches: [[0.4, 0.5, 134], [2.6, 0.5, 134]] };
  },
  lab(I) {
    I.shadow(0.2, 0.2, 2.8, 2.8, 90);
    I.box(0.2, 0.2, 2.8, 2.8, 0, 6, '#9aa4aa');
    I.box(0.3, 0.3, 2.7, 2.7, 6, 48, '#f2f5f6');
    I.quadL(0.3, 2.7, 2.7, 34, 40, '#2a8ad0'); I.quadR(2.7, 0.3, 2.7, 34, 40, '#1e6aa0');
    for (let i = 0; i < 4; i++) I.winL(0.45 + i * 0.58, 0.85 + i * 0.58, 2.7, 14, 30, { frame: '#5a6a74', litCol: 'rgba(160,230,255,0.95)' });
    for (let i = 0; i < 4; i++) I.winR(2.7, 0.45 + i * 0.58, 0.85 + i * 0.58, 14, 30, { frame: '#5a6a74', litCol: 'rgba(140,220,255,0.85)' });
    I.box(0.25, 0.25, 2.75, 2.75, 48, 52, '#c8d0d4');
    // entrance
    I.box(1.1, 2.7, 1.9, 2.95, 6, 30, '#e8ecee');
    I.winL(1.2, 1.8, 2.95, 6, 24, { mullion: 2, frame: '#5a6a74', litCol: 'rgba(160,230,255,0.95)' });
    I.textL('GENETICS LAB', 1.5, 2.96, 27, 6.5, '#1e6aa0', { weight: 400 });
    // dome with DNA
    const d = I.dome(1.4, 1.4, 52, 0.85, 40, '#6ac8e8', { ribs: 'rgba(255,255,255,0.45)', hi: '#e8faff' });
    if (I.l) { const g = I.l.createRadialGradient(d.x, d.y - 18, 2, d.x, d.y - 14, d.rx); g.addColorStop(0, 'rgba(120,230,255,0.9)'); g.addColorStop(1, 'rgba(60,160,255,0)'); I.l.fillStyle = g; I.l.beginPath(); I.l.ellipse(d.x, d.y - 14, d.rx, d.h, 0, 0, TAU); I.l.fill(); }
    const c = I.c;
    for (let k = 0; k < 16; k++) {
      const t = k / 15, yy = d.y - 6 - t * 28, a = t * Math.PI * 3;
      c.fillStyle = k % 2 ? '#ff5a8a' : '#5affb0';
      c.beginPath(); c.arc(d.x + Math.sin(a) * 7, yy, 1.8, 0, TAU); c.fill();
      c.beginPath(); c.arc(d.x - Math.sin(a) * 7, yy, 1.8, 0, TAU); c.fill();
    }
    // antenna and AC units
    I.box(2.2, 0.4, 2.55, 0.8, 52, 60, '#aab4ba');
    const [ax, ay] = I.p(0.5, 0.6, 52); c.strokeStyle = '#555'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay - 34); c.stroke();
    c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(ax, ay - 35, 2, 0, TAU); c.fill();
    I.light(0.5, 0.6, 87, 30, 'rgba(255,60,60,');
    I.light(1.4, 1.4, 70, 120, 'rgba(100,200,255,');
    I.plant(0.2, 2.9, 6, 1, '#fff'); I.plant(2.9, 1.0, 6, 1);
  },
  crop_harbor(I) { return PAINT._harbor(I, false); },
  meat_harbor(I) { return PAINT._harbor(I, true); },
  _harbor(I, meat) {
    I.shadow(0.1, 0.1, 2.9, 2.9, 70);
    // dock deck
    I.box(0.05, 0.05, 2.95, 2.95, 0, 5, '#9a7a52', { top: '#b8966a' });
    const c = I.c; c.strokeStyle = 'rgba(60,40,20,0.45)'; c.lineWidth = 0.7;
    for (let k = 1; k < 12; k++) { const u = 0.05 + 2.9 * k / 12; c.beginPath(); c.moveTo(...I.p(u, 0.05, 5)); c.lineTo(...I.p(u, 2.95, 5)); c.stroke(); }
    if (meat) {
      I.box(0.25, 0.25, 2.0, 2.1, 5, 42, '#dfe3e6');
      I.quadL(0.25, 2.0, 2.1, 30, 36, '#c8302a'); I.quadR(2.0, 0.25, 2.1, 30, 36, '#9a221e');
      c.strokeStyle = 'rgba(0,0,0,0.15)'; for (let k = 1; k < 16; k++) { const u = 0.25 + 1.75 * k / 16; c.beginPath(); c.moveTo(...I.p(u, 2.1, 5)); c.lineTo(...I.p(u, 2.1, 30)); c.stroke(); }
      I.box(0.7, 2.1, 1.5, 2.14, 5, 26, '#8a9aa4'); // roller door
      for (let k = 0; k < 7; k++) I.quadL(0.7, 1.5, 2.145, 5 + k * 3, 6 + k * 3, 'rgba(0,0,0,0.12)');
      I.gable(0.25, 0.25, 2.0, 2.1, 42, 14, '#a8b0b6', 'u', { style: 'metal', wall: '#d0d4d8' });
      I.box(0.4, 0.5, 0.9, 0.9, 56, 64, '#e8eef0'); // cooling unit
      c.strokeStyle = '#8a9aa4'; c.lineWidth = 1; const [fx, fy] = I.p(0.65, 0.7, 64); c.beginPath(); c.ellipse(fx, fy, 6, 3, 0, 0, TAU); c.stroke();
      // containers
      I.box(2.15, 0.2, 2.85, 1.3, 5, 24, '#2a6aa0', { flat: true });
      I.box(2.15, 1.4, 2.85, 2.5, 5, 24, '#c8402a', { flat: true });
      I.box(2.15, 0.3, 2.85, 1.2, 24, 43, '#d8a02a', { flat: true });
      for (const [v0, v1, z0, z1] of [[0.2, 1.3, 5, 24], [1.4, 2.5, 5, 24], [0.3, 1.2, 24, 43]]) for (let k = 1; k < 9; k++) { const v = v0 + (v1 - v0) * k / 9; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(...I.p(2.85, v, z0)); c.lineTo(...I.p(2.85, v, z1)); c.stroke(); }
      I.box(0.6, 2.35, 1.6, 2.4, 44, 56, '#2a2a2a');
      I.textL('MEAT', 1.1, 2.42, 50, 8, '#ff6a5a', { glow: 'rgba(255,90,80,1)' });
    } else {
      I.box(0.25, 0.25, 2.0, 2.1, 5, 36, '#c89a64');
      c.strokeStyle = 'rgba(60,36,16,0.5)'; for (let k = 1; k < 9; k++) { const z = 5 + k * 3.5; c.beginPath(); c.moveTo(...I.p(0.25, 2.1, z)); c.lineTo(...I.p(2.0, 2.1, z)); c.lineTo(...I.p(2.0, 0.25, z)); c.stroke(); }
      I.box(0.75, 2.1, 1.45, 2.14, 5, 26, '#4a2e16');
      I.gable(0.25, 0.25, 2.0, 2.1, 36, 20, '#4c8a3a', 'u', { style: 'tile', wall: '#d8aa70', gableWin: true });
      // produce crates and hay
      I.crate(2.15, 0.25, 0.32, 5, '#a07a4a', ['#6ac83a', '#8ae04a', '#4aa82a']);
      I.crate(2.5, 0.25, 0.32, 5, '#a07a4a', ['#ff8a1a', '#ffa03a']);
      I.crate(2.15, 0.62, 0.32, 5, '#a07a4a', ['#e83a2a', '#ff5a3a']);
      I.crate(2.15, 0.25, 0.32, 12, '#8a643a', ['#ffd23a', '#f0c02a']);
      for (let k = 0; k < 3; k++) { const cy = I.cyl(2.55, 1.4 + k * 0.42, 5, 17, 0.17, '#e8c860', { top: '#f4dc84' }); }
      I.box(0.6, 2.35, 1.6, 2.4, 40, 52, '#2a4a1e');
      I.textL('CROPS', 1.1, 2.42, 46, 8, '#b6e27a', { glow: 'rgba(180,255,120,1)' });
    }
    // crane
    const [bx, by] = I.p(2.7, 2.7, 5);
    // lattice dock crane: mast, cab, truss jib and hook
    const cc = '#e8b020', cd = '#8a6010';
    c.fillStyle = '#6a6a6a'; c.fillRect(bx - 6, by - 4, 12, 5);
    c.strokeStyle = cd; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(bx - 3, by); c.lineTo(bx - 3, by - 70); c.moveTo(bx + 3, by); c.lineTo(bx + 3, by - 70); c.stroke();
    c.strokeStyle = cc; c.lineWidth = 1.1;
    c.beginPath(); for (let k = 0; k < 7; k++) { c.moveTo(bx - 3, by - k * 10); c.lineTo(bx + 3, by - k * 10 - 10); c.moveTo(bx + 3, by - k * 10); c.lineTo(bx - 3, by - k * 10 - 10); } c.stroke();
    c.fillStyle = cc; c.strokeStyle = cd; c.lineWidth = 1; c.fillRect(bx - 5, by - 80, 11, 10); c.strokeRect(bx - 5, by - 80, 11, 10);
    c.fillStyle = '#6ab0d0'; c.fillRect(bx - 3, by - 78, 5, 4);
    c.strokeStyle = cd; c.lineWidth = 1.8; c.beginPath(); c.moveTo(bx - 5, by - 78); c.lineTo(bx - 56, by - 70); c.moveTo(bx - 5, by - 72); c.lineTo(bx - 56, by - 68); c.stroke();
    c.strokeStyle = cc; c.lineWidth = 0.9; c.beginPath(); for (let k = 0; k < 6; k++) { const x0 = bx - 5 - k * 8.5; c.moveTo(x0, by - 78 + k * 1.3); c.lineTo(x0 - 8.5, by - 72 + k * 0.7); } c.stroke();
    c.strokeStyle = cd; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx + 6, by - 76); c.lineTo(bx + 14, by - 70); c.stroke(); c.fillStyle = '#555'; c.fillRect(bx + 11, by - 72, 7, 6);
    c.strokeStyle = '#333'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(bx - 50, by - 69); c.lineTo(bx - 50, by - 40); c.stroke();
    c.fillStyle = meat ? '#c8402a' : '#7ac04a'; c.fillRect(bx - 56, by - 40, 12, 9); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.strokeRect(bx - 56, by - 40, 12, 9);
    // bollards and rope
    for (const u of [0.3, 1.5]) I.cyl(u, 2.85, 5, 11, 0.06, '#333');
    I.lamp(0.2, 2.8, 5, 24);
  },
  arena(I) {
    I.shadow(0.2, 0.2, 3.8, 3.8, 70);
    I.box(0.1, 0.1, 3.9, 3.9, 0, 4, '#a89a84');
    const cx = 2, cy = 2, R = 1.85;
    const c = I.c;
    const o = I.cyl(cx, cy, 4, 58, R, '#b8a888', { noTop: true });
    // arches along the front
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.08 + i * 0.084);
      const x = o.x - Math.cos(a) * o.rx, y = o.y0 + Math.sin(a) * o.ry;
      const sc = Math.sin(a);
      c.fillStyle = '#3a2e22';
      for (const [zz, hh] of [[8, 18], [32, 14]]) { c.beginPath(); c.moveTo(x - 5 * sc, y - zz); c.lineTo(x - 5 * sc, y - zz - hh + 4); c.arc(x, y - zz - hh + 4, 5 * sc, Math.PI, 0); c.lineTo(x + 5 * sc, y - zz); c.closePath(); c.fill(); }
      if (I.l) { I.l.fillStyle = 'rgba(255,170,80,0.8)'; I.l.beginPath(); I.l.arc(x, y - 36, 3 * sc, 0, TAU); I.l.fill(); }
    }
    // cornice lines
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5;
    for (const z of [30, 56]) { c.beginPath(); c.ellipse(o.x, o.y0 - z, o.rx, o.ry, 0, 0, Math.PI); c.stroke(); }
    // top ring and interior
    c.fillStyle = '#cfc0a0'; c.beginPath(); c.ellipse(o.x, o.y1, o.rx, o.ry, 0, 0, TAU); c.fill();
    c.fillStyle = '#6a5a48'; c.beginPath(); c.ellipse(o.x, o.y1, o.rx * 0.84, o.ry * 0.84, 0, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.ellipse(o.x, o.y1, o.rx * 0.84, o.ry * 0.84, 0, 0, TAU); c.clip();
    // tiered seating with crowd
    const rng = mulberry32(12);
    for (let t = 0; t < 4; t++) {
      c.strokeStyle = t % 2 ? '#8a7a64' : '#9a8a72'; c.lineWidth = 5;
      c.beginPath(); c.ellipse(o.x, o.y1 + 4 + t * 5, o.rx * (0.8 - t * 0.07), o.ry * (0.8 - t * 0.07), 0, Math.PI, TAU); c.stroke();
      for (let k = 0; k < 26; k++) { const a = Math.PI + (k / 25) * Math.PI; c.fillStyle = pick(['#e0513a', '#4aa8e0', '#ffd23f', '#fff', '#7dc15a']); c.beginPath(); c.arc(o.x + Math.cos(a) * o.rx * (0.8 - t * 0.07), o.y1 + 2 + t * 5 + Math.sin(a) * o.ry * (0.8 - t * 0.07), 1.4, 0, TAU); c.fill(); }
    }
    const sg = c.createRadialGradient(o.x, o.y1 + 26, 4, o.x, o.y1 + 22, o.rx * 0.5);
    sg.addColorStop(0, '#f0d8a0'); sg.addColorStop(1, '#b8945a');
    c.fillStyle = sg; c.beginPath(); c.ellipse(o.x, o.y1 + 24, o.rx * 0.5, o.ry * 0.46, 0, 0, TAU); c.fill();
    c.restore();
    // flags on the rim
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const x = o.x + Math.cos(a) * o.rx, y = o.y1 + Math.sin(a) * o.ry;
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 20); c.stroke();
      c.fillStyle = k % 2 ? '#e0513a' : '#ffc43d'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 10, y - 17); c.lineTo(x, y - 13); c.fill();
    }
    // front gate
    const [gx, gy] = I.p(cx + R * 0.72, cy + R * 0.72, 4);
    c.fillStyle = '#2a1e14'; c.beginPath(); c.moveTo(gx - 10, gy); c.lineTo(gx - 10, gy - 22); c.arc(gx, gy - 22, 10, Math.PI, 0); c.lineTo(gx + 10, gy); c.closePath(); c.fill();
    c.strokeStyle = '#8a8a8a'; c.lineWidth = 1; for (let k = -8; k <= 8; k += 4) { c.beginPath(); c.moveTo(gx + k, gy); c.lineTo(gx + k, gy - 28); c.stroke(); }
    c.fillStyle = '#5a1e14'; c.fillRect(gx - 22, gy - 48, 44, 12);
    c.font = "400 9px 'Lilita One', sans-serif"; c.textAlign = 'center'; c.fillStyle = '#ffd479'; c.fillText('ARENA', gx, gy - 39);
    I.light(cx, cy, 70, 150, 'rgba(255,170,80,');
    return { torches: [[cx + R * 0.72 - 0.35, cy + R * 0.72 + 0.35, 40], [cx + R * 0.72 + 0.35, cy + R * 0.72 - 0.35, 40]] };
  },
  _stall(I, wall, roof, o = {}) {
    I.shadow(0.2, 0.2, 1.8, 1.8, 50);
    I.box(0.2, 0.2, 1.8, 1.8, 0, 4, '#a89a84');
    I.box(0.3, 0.3, 1.7, 1.7, 4, 34, wall);
    if (o.planks) { const c = I.c; c.strokeStyle = 'rgba(60,36,16,0.35)'; c.lineWidth = 0.7; for (let k = 1; k < 8; k++) { const z = 4 + k * 3.8; c.beginPath(); c.moveTo(...I.p(0.3, 1.7, z)); c.lineTo(...I.p(1.7, 1.7, z)); c.lineTo(...I.p(1.7, 0.3, z)); c.stroke(); } }
    // serving window + counter
    I.quadL(0.5, 1.5, 1.7, 14, 28, '#3a2616');
    I.box(0.45, 1.7, 1.55, 1.86, 12, 14, '#e8dcc4');
    if (I.l) I.quadL(0.5, 1.5, 1.7, 14, 28, 'rgba(255,210,140,0.95)', null, I.l);
    I.winR(1.7, 0.5, 1.4, 16, 28, { frame: '#3a2616' });
    return I;
  },
  souvenir(I) {
    PAINT._stall(I, '#f3e6c4', '#c8452a', { planks: true });
    // shelves with plush dinos in the window
    const c = I.c;
    for (let k = 0; k < 5; k++) { const [x, y] = I.p(0.6 + k * 0.2, 1.7, 18); c.fillStyle = ['#7dc15a', '#e0513a', '#4aa8e0', '#ffd23f', '#b08aff'][k]; c.beginPath(); c.ellipse(x, y, 3, 2.4, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 2.5, y - 2.5, 1.8, 0, TAU); c.fill(); }
    I.awningL(0.35, 1.65, 1.7, 32, 0.3, '#e0513a', '#fff4dc', 6);
    I.gable(0.3, 0.3, 1.7, 1.7, 34, 18, '#c8452a', 'v', { style: 'tile', wall: '#f3e6c4' });
    // giant green dino statue on roof
    const [x, y] = I.p(1.0, 1.0, 50);
    c.fillStyle = '#5aa83a'; c.strokeStyle = '#2a5a1a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 14, y + 2); c.quadraticCurveTo(x - 4, y - 10, x + 4, y - 8); c.quadraticCurveTo(x + 8, y - 20, x + 14, y - 18); c.quadraticCurveTo(x + 18, y - 16, x + 13, y - 13); c.quadraticCurveTo(x + 9, y - 6, x + 8, y + 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 13, y - 16, 1.5, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(x + 13.4, y - 16, 0.7, 0, TAU); c.fill();
    I.box(0.55, 1.75, 1.45, 1.8, 36, 44, '#5a3a1e');
    I.textL('GIFTS', 1.0, 1.82, 40, 7, '#ffd479', { glow: 'rgba(255,220,120,1)' });
  },
  burger(I) {
    PAINT._stall(I, '#f6d27a', '#c8402a');
    I.awningL(0.35, 1.65, 1.7, 32, 0.3, '#e0402a', '#ffd23f', 6);
    I.box(0.25, 0.25, 1.75, 1.75, 34, 38, '#c8402a');
    // giant burger
    const [x, y] = I.p(1.0, 1.0, 38), c = I.c;
    const layer = (dy, rx, ry, col, h) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y - dy, rx, ry, 0, 0, TAU); c.fill(); if (h) { c.fillRect(x - rx, y - dy - h, rx * 2, h); c.beginPath(); c.ellipse(x, y - dy - h, rx, ry, 0, 0, TAU); c.fill(); } };
    layer(2, 20, 9, '#c8842a', 5);
    layer(9, 21, 9, '#5a2e14', 5);
    layer(13, 22, 9, '#ffd23f');
    layer(15, 22, 9.5, '#5ac83a');
    const bg = c.createRadialGradient(x - 6, y - 32, 2, x, y - 22, 24); bg.addColorStop(0, '#f8c070'); bg.addColorStop(1, '#b8701a');
    c.fillStyle = bg; c.beginPath(); c.ellipse(x, y - 18, 20, 9, 0, 0, Math.PI); c.ellipse(x, y - 18, 20, 18, 0, Math.PI, TAU); c.fill();
    c.fillStyle = '#fff6dc'; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(x - 12 + (k % 5) * 6, y - 26 - Math.floor(k / 5) * 5 + (k % 2) * 2, 1.4, 0.8, 0.4, 0, TAU); c.fill(); }
    I.box(0.5, 1.75, 1.5, 1.8, 20, 26, '#5a1e14');
    I.textL('BURGERS', 1.0, 1.82, 23, 5.5, '#ffd23f', { glow: 'rgba(255,220,80,1)' });
  },
  icecream(I) {
    PAINT._stall(I, '#fbe0ea', '#8ae0c8');
    I.awningL(0.35, 1.65, 1.7, 32, 0.3, '#ff9ac0', '#fff', 6);
    I.hip(0.3, 0.3, 1.7, 1.7, 34, 10, '#8ae0c8', { over: 0.1 });
    const [x, y] = I.p(1.0, 1.0, 44), c = I.c;
    c.fillStyle = '#e8b060'; c.strokeStyle = '#a06a2a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x - 10, y - 22); c.lineTo(x + 10, y - 22); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip(); c.strokeStyle = 'rgba(140,80,20,0.6)'; for (let k = -30; k < 30; k += 5) { c.beginPath(); c.moveTo(x + k, y - 24); c.lineTo(x + k + 20, y + 6); c.moveTo(x + k, y - 24); c.lineTo(x + k - 20, y + 6); c.stroke(); } c.restore();
    for (const [dx, dy, col] of [[-5, -26, '#ff8ab0'], [5, -26, '#fff6e8'], [0, -34, '#7a4a2a']]) { const g = c.createRadialGradient(x + dx - 3, y + dy - 3, 1, x + dx, y + dy, 9); g.addColorStop(0, shade(col, 0.4)); g.addColorStop(1, shade(col, -0.2)); c.fillStyle = g; c.beginPath(); c.arc(x + dx, y + dy, 8, 0, TAU); c.fill(); }
    for (let k = 0; k < 10; k++) { c.fillStyle = pick(['#ff3a3a', '#3a8aff', '#ffd23f', '#5ae05a']); c.fillRect(x - 8 + Math.random() * 16, y - 40 + Math.random() * 16, 2, 1); }
    c.fillStyle = '#e02a2a'; c.beginPath(); c.arc(x, y - 43, 2.5, 0, TAU); c.fill();
  },
  coffee(I) {
    I.shadow(0.2, 0.2, 1.8, 1.8, 50);
    I.box(0.15, 0.15, 1.85, 1.85, 0, 4, '#8a6a44', { top: '#a8845a' });
    I.box(0.35, 0.3, 1.5, 1.4, 4, 30, '#d8b070');
    const c = I.c; c.strokeStyle = 'rgba(90,60,20,0.5)'; c.lineWidth = 1.2;
    for (let k = 0; k < 12; k++) { const u = 0.35 + 1.15 * k / 12; c.beginPath(); c.moveTo(...I.p(u, 1.4, 4)); c.lineTo(...I.p(u, 1.4, 30)); c.stroke(); }
    for (let k = 0; k < 10; k++) { const v = 0.3 + 1.1 * k / 10; c.beginPath(); c.moveTo(...I.p(1.5, v, 4)); c.lineTo(...I.p(1.5, v, 30)); c.stroke(); }
    I.quadL(0.55, 1.3, 1.4, 12, 24, '#3a2616');
    if (I.l) I.quadL(0.55, 1.3, 1.4, 12, 24, 'rgba(255,200,120,0.95)', null, I.l);
    I.hip(0.35, 0.3, 1.5, 1.4, 30, 22, '#c8a060', { style: 'thatch', over: 0.28 });
    // umbrella tables
    for (const [u, v, col] of [[1.72, 0.55, '#e0513a'], [1.72, 1.35, '#4aa8e0'], [0.9, 1.75, '#ffd23f']]) {
      const [x, y] = I.p(u, v, 4);
      c.fillStyle = '#6b4424'; c.beginPath(); c.ellipse(x, y - 8, 5, 2.4, 0, 0, TAU); c.fill();
      c.strokeStyle = '#444'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 24); c.stroke();
      c.fillStyle = col; c.beginPath(); c.moveTo(x - 11, y - 20); c.quadraticCurveTo(x, y - 32, x + 11, y - 20); c.quadraticCurveTo(x, y - 17, x - 11, y - 20); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x - 4, y - 21); c.quadraticCurveTo(x, y - 30, x + 2, y - 20); c.fill();
    }
    I.box(0.55, 1.45, 1.3, 1.5, 30, 37, '#3a2616');
    I.textL('CAFÉ', 0.92, 1.52, 33.5, 6.5, '#ffe0a0', { glow: 'rgba(255,220,150,1)' });
  },
  ranger(I) {
    I.shadow(0.2, 0.2, 1.8, 1.8, 50);
    I.box(0.2, 0.2, 1.8, 1.8, 0, 5, '#8a8278');
    I.box(0.3, 0.3, 1.7, 1.7, 5, 32, '#8a5a30');
    const c = I.c;
    for (let k = 0; k < 7; k++) { const z = 7 + k * 3.8; c.strokeStyle = 'rgba(40,20,6,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(...I.p(0.3, 1.7, z)); c.lineTo(...I.p(1.7, 1.7, z)); c.lineTo(...I.p(1.7, 0.3, z)); c.stroke(); c.strokeStyle = 'rgba(255,200,140,0.18)'; c.beginPath(); c.moveTo(...I.p(0.3, 1.7, z + 1.4)); c.lineTo(...I.p(1.7, 1.7, z + 1.4)); c.stroke(); }
    I.box(0.8, 1.7, 1.2, 1.74, 5, 24, '#4a2e14');
    I.winL(0.4, 0.7, 1.7, 14, 24, { frame: '#3a2210' }); I.winL(1.3, 1.6, 1.7, 14, 24, { frame: '#3a2210' });
    I.winR(1.7, 0.6, 1.2, 14, 24, { frame: '#3a2210' });
    I.gable(0.3, 0.3, 1.7, 1.7, 32, 20, '#3e6a2e', 'u', { style: 'metal', wall: '#7a4e28' });
    const [ax, ay] = I.p(0.5, 0.6, 44); c.strokeStyle = '#444'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay - 30); c.moveTo(ax - 5, ay - 24); c.lineTo(ax + 5, ay - 24); c.moveTo(ax - 4, ay - 18); c.lineTo(ax + 4, ay - 18); c.stroke();
    for (const v of [0.4, 0.75]) I.cyl(1.88, v, 5, 17, 0.12, '#2a5a2a');
    I.box(0.55, 1.75, 1.45, 1.8, 34, 40, '#e0c060');
    I.textL('RANGERS', 1.0, 1.82, 37, 5.2, '#2a3a1a');
  },
  restaurant(I) {
    I.shadow(0.2, 0.2, 2.8, 2.8, 90);
    I.box(0.2, 0.2, 2.8, 2.8, 0, 5, '#8a8278', { top: '#a8a096' });
    I.box(0.35, 0.35, 2.65, 2.4, 5, 22, '#8a8680', { left: '#9a948a' });
    const c = I.c, rng = mulberry32(8);
    for (let k = 0; k < 40; k++) { const u = 0.35 + rng() * 2.3, z = 6 + rng() * 15; const [x, y] = I.p(u, 2.4, z); c.strokeStyle = 'rgba(40,36,30,0.4)'; c.lineWidth = 0.7; c.strokeRect(x - 3, y - 2, 6, 3.5); }
    I.box(0.35, 0.35, 2.65, 2.4, 22, 50, '#8a5a30');
    for (let k = 0; k < 7; k++) { const z = 24 + k * 3.8; c.strokeStyle = 'rgba(40,20,6,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(...I.p(0.35, 2.4, z)); c.lineTo(...I.p(2.65, 2.4, z)); c.lineTo(...I.p(2.65, 0.35, z)); c.stroke(); }
    for (let i = 0; i < 4; i++) I.winL(0.55 + i * 0.55, 0.85 + i * 0.55, 2.4, 28, 44, { frame: '#3a2210', mullion: 2 });
    I.winR(2.65, 0.6, 1.1, 28, 44, { frame: '#3a2210' }); I.winR(2.65, 1.4, 1.9, 28, 44, { frame: '#3a2210' });
    I.box(1.2, 2.4, 1.8, 2.46, 5, 22, '#4a2e14');
    I.gable(0.35, 0.35, 2.65, 2.4, 50, 34, '#b8844a', 'u', { style: 'thatch', over: 0.2, wall: '#8a5a30' });
    // skull sign
    const [x, y] = I.p(1.5, 2.55, 58);
    c.fillStyle = '#efe6d4'; c.strokeStyle = '#6a5a44'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 16, y); c.quadraticCurveTo(x - 14, y - 12, x, y - 12); c.quadraticCurveTo(x + 14, y - 12, x + 20, y - 4); c.lineTo(x + 20, y + 2); c.lineTo(x - 2, y + 4); c.lineTo(x - 14, y + 5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2a1a'; c.beginPath(); c.ellipse(x - 4, y - 5, 3, 2.4, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + 8, y - 3, 4, 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x - 10 + k * 5, y + 3); c.lineTo(x - 8.5 + k * 5, y + 7); c.lineTo(x - 7 + k * 5, y + 3); c.fill(); }
    I.box(0.9, 2.5, 2.1, 2.55, 62, 72, '#3a2210');
    I.textL('FOSSIL GRILL', 1.5, 2.57, 67, 7, '#ffc43d', { glow: 'rgba(255,200,90,1)' });
    // outdoor tables with lanterns
    for (const u of [0.6, 1.5, 2.4]) { const [tx, ty] = I.p(u, 2.72, 5); c.fillStyle = '#6b4424'; c.beginPath(); c.ellipse(tx, ty - 6, 6, 3, 0, 0, TAU); c.fill(); c.fillRect(tx - 1, ty - 6, 2, 6); c.fillStyle = '#ffcf6a'; c.beginPath(); c.arc(tx, ty - 9, 1.6, 0, TAU); c.fill(); I.lights.push({ x: tx, y: ty - 9, r: 26, col: 'rgba(255,190,100,' }); }
    I.plant(2.85, 0.5, 5, 1.1, '#ff6a8a');
    I.light(1.5, 2.5, 30, 100, 'rgba(255,190,110,');
  },
  tower(I) {
    I.shadow(0.3, 0.3, 1.7, 1.7, 140);
    I.box(0.25, 0.25, 1.75, 1.75, 0, 4, '#8a8278');
    const c = I.c;
    const legs = [[0.4, 0.4], [1.6, 0.4], [0.4, 1.6], [1.6, 1.6]];
    for (const [u, v] of legs) I.box(u - 0.06, v - 0.06, u + 0.06, v + 0.06, 4, 100, '#6b4424', { hl: false });
    c.strokeStyle = '#5a3a1e'; c.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) { const z0 = 8 + k * 23, z1 = z0 + 23; c.beginPath(); c.moveTo(...I.p(0.4, 1.6, z0)); c.lineTo(...I.p(1.6, 1.6, z1)); c.moveTo(...I.p(1.6, 1.6, z0)); c.lineTo(...I.p(0.4, 1.6, z1)); c.moveTo(...I.p(1.6, 1.6, z0)); c.lineTo(...I.p(1.6, 0.4, z1)); c.moveTo(...I.p(1.6, 0.4, z0)); c.lineTo(...I.p(1.6, 1.6, z1)); c.stroke(); }
    // ladder
    for (let z = 6; z < 98; z += 5) { c.beginPath(); c.moveTo(...I.p(0.8, 1.62, z)); c.lineTo(...I.p(1.1, 1.62, z)); c.stroke(); }
    I.box(0.2, 0.2, 1.8, 1.8, 100, 106, '#8a5a30');
    for (let k = 0; k <= 8; k++) { const u = 0.2 + 1.6 * k / 8; c.beginPath(); c.moveTo(...I.p(u, 1.8, 106)); c.lineTo(...I.p(u, 1.8, 116)); c.stroke(); const v = 0.2 + 1.6 * k / 8; c.beginPath(); c.moveTo(...I.p(1.8, v, 106)); c.lineTo(...I.p(1.8, v, 116)); c.stroke(); }
    c.beginPath(); c.moveTo(...I.p(0.2, 1.8, 116)); c.lineTo(...I.p(1.8, 1.8, 116)); c.lineTo(...I.p(1.8, 0.2, 116)); c.stroke();
    // people with binoculars
    for (const [u, v, col] of [[0.9, 1.5, '#e0513a'], [1.4, 1.1, '#4aa8e0']]) { const [x, y] = I.p(u, v, 106); c.fillStyle = col; c.fillRect(x - 2, y - 9, 4, 6); c.fillStyle = '#e8b58e'; c.beginPath(); c.arc(x, y - 11, 2.2, 0, TAU); c.fill(); }
    for (const [u, v] of legs) { const [x, y] = I.p(u, v, 116); c.strokeStyle = '#5a3a1e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x, y - 8); c.stroke(); }
    I.hip(0.2, 0.2, 1.8, 1.8, 124, 22, '#b8844a', { style: 'thatch', over: 0.12 });
    I.lamp(1.8, 1.8, 106, 12);
  },
  jeep(I) {
    I.shadow(0.2, 0.2, 2.8, 2.8, 60);
    I.box(0.1, 0.1, 2.9, 2.9, 0, 3, '#8a8a80', { top: '#9a9a8e' });
    I.box(0.25, 0.25, 2.2, 1.9, 3, 38, '#e0c890');
    const c = I.c;
    // garage openings
    for (const u of [0.4, 1.3]) { I.quadL(u, u + 0.75, 1.9, 3, 26, '#2a2016'); for (let k = 0; k < 5; k++) I.quadL(u, u + 0.75, 1.9, 22 + k, 22.5 + k, 'rgba(255,255,255,0.05)'); }
    I.box(0.25, 0.25, 2.2, 1.9, 38, 44, '#2a6a2a');
    for (let k = 0; k < 10; k++) I.quadL(0.25 + k * 0.195, 0.345 + k * 0.195, 1.9, 38, 44, '#ffd23f');
    I.textR('JUNGLE TOURS', 2.21, 1.07, 26, 7, '#2a5a1a', { stroke: '#fff4dc', sw: 2 });
    I.gable(0.25, 0.25, 2.2, 1.9, 44, 12, '#6a7a4a', 'v', { style: 'metal', wall: '#e0c890' });
    // parked jeep outside + fuel pump
    drawJeepIso(c, I.p(2.45, 2.35, 3), 1, 0);
    I.box(2.45, 0.4, 2.7, 0.65, 3, 22, '#c8402a');
    I.box(2.47, 0.42, 2.68, 0.63, 22, 25, '#fff');
    I.lamp(0.2, 2.8, 3, 26);
  },
  museum(I) {
    I.shadow(0.2, 0.2, 2.8, 2.8, 90);
    for (let i = 0; i < 3; i++) I.box(0.1 + i * 0.08, 0.1 + i * 0.08, 2.9 - i * 0.08, 2.9 - i * 0.08, i * 3, i * 3 + 3, '#d8d0c0');
    I.box(0.35, 0.35, 2.65, 2.3, 9, 56, '#ece4d4');
    const c = I.c;
    I.quadL(0.35, 2.65, 2.3, 9, 56, 'rgba(0,0,0,0.05)');
    for (let i = 0; i < 6; i++) { const u = 0.5 + i * 0.4; I.cyl(u, 2.52, 9, 54, 0.07, '#f6f0e4', { top: '#fff' }); }
    I.box(0.3, 2.3, 2.7, 2.62, 54, 60, '#e4dcc8');
    // pediment
    const tri = [I.p(0.3, 2.62, 60), I.p(2.7, 2.62, 60), I.p(1.5, 2.62, 80)];
    I.poly(tri, '#f0e8d8', 'rgba(0,0,0,0.3)');
    I.textL('MUSEUM', 1.5, 2.63, 57, 5.5, '#6a5a44');
    const [bx, by] = I.p(1.5, 2.62, 67); c.strokeStyle = '#8a7a64'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 6, by + 2); c.lineTo(bx + 6, by - 2); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.arc(bx + s * 6.5, by - s * 2 - 1.5, 1.6, 0, TAU); c.arc(bx + s * 6.5, by - s * 2 + 1.5, 1.6, 0, TAU); c.fill(); }
    I.quadL(1.2, 1.8, 2.3, 9, 34, '#3a2a1a');
    if (I.l) I.quadL(1.2, 1.8, 2.3, 9, 34, 'rgba(255,220,160,0.9)', null, I.l);
    for (let i = 0; i < 3; i++) I.winR(2.65, 0.5 + i * 0.6, 0.8 + i * 0.6, 20, 44, { frame: '#8a7a64' });
    I.box(0.3, 0.3, 2.7, 2.3, 56, 60, '#d8d0c0');
    I.dome(1.5, 1.3, 60, 0.75, 30, '#8ac0b0', { ribs: 'rgba(255,255,255,0.3)', hi: '#d8fff0' });
    // banners
    for (const u of [0.55, 2.45]) { I.quadL(u - 0.12, u + 0.12, 2.64, 24, 50, '#8a2a1a'); }
    I.light(1.5, 2.6, 30, 100, 'rgba(255,210,150,');
  },
  hotel(I) {
    I.shadow(0.3, 0.3, 2.7, 2.7, 180);
    I.box(0.25, 0.25, 2.75, 2.75, 0, 5, '#9a948a');
    I.box(0.35, 0.35, 2.65, 2.65, 5, 136, '#f4efe4');
    const c = I.c;
    for (let f = 0; f < 6; f++) {
      const z0 = 12 + f * 20;
      for (let i = 0; i < 5; i++) I.winL(0.5 + i * 0.43, 0.8 + i * 0.43, 2.65, z0, z0 + 12, { frame: '#5a6a6a', litCol: f % 2 === i % 3 ? 'rgba(255,214,130,0.95)' : 'rgba(255,190,110,0.35)' });
      for (let i = 0; i < 5; i++) I.winR(2.65, 0.5 + i * 0.43, 0.8 + i * 0.43, z0, z0 + 12, { frame: '#5a6a6a', litCol: (f + i) % 3 ? 'rgba(255,200,120,0.85)' : 'rgba(255,190,110,0.2)' });
      I.quadL(0.35, 2.65, 2.72, z0 - 2, z0, '#3aa8a0'); I.quadR(2.72, 0.35, 2.65, z0 - 2, z0, '#2a8a84');
      c.strokeStyle = 'rgba(40,80,80,0.6)'; c.lineWidth = 0.7;
      for (let k = 0; k < 16; k++) { const u = 0.35 + 2.3 * k / 16; c.beginPath(); c.moveTo(...I.p(u, 2.72, z0)); c.lineTo(...I.p(u, 2.72, z0 + 5)); c.stroke(); }
    }
    I.box(0.3, 0.3, 2.7, 2.7, 136, 140, '#d8d0c0');
    // rooftop pool
    I.poly([I.p(0.6, 0.6, 140.5), I.p(2.0, 0.6, 140.5), I.p(2.0, 1.6, 140.5), I.p(0.6, 1.6, 140.5)], '#3ac8e8', '#fff', 1.2);
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.8; for (let k = 0; k < 4; k++) { const [x, y] = I.p(1.1 + k * 0.2, 1.0, 140.5); c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x, y - 2, x + 4, y); c.stroke(); }
    paintPalmAt(c, I.p(2.35, 0.55, 140), 0.45, 3); paintPalmAt(c, I.p(2.35, 2.2, 140), 0.45, 9);
    I.box(0.9, 2.66, 2.1, 2.7, 118, 130, '#1e5a58');
    I.textL('HOTEL', 1.5, 2.72, 124, 9, '#ffe8b0', { glow: 'rgba(255,230,170,1)' });
    I.box(1.1, 2.65, 1.9, 2.95, 5, 18, '#3aa8a0');
    I.light(1.5, 2.8, 20, 90, 'rgba(255,210,140,');
  },
  helipad(I) {
    I.shadow(0.1, 0.1, 2.9, 2.9, 40);
    I.box(0.1, 0.1, 2.9, 2.9, 0, 14, '#8a8a88', { top: '#6a6e70' });
    const c = I.c;
    const [x, y] = I.p(1.5, 1.5, 14);
    c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 58, 29, 0, 0, TAU); c.stroke();
    c.save(); c.translate(x, y); c.scale(1, 0.5); c.rotate(Math.PI / 4); c.fillStyle = '#fff'; c.font = "400 44px 'Lilita One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 0, 2); c.restore();
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, lx = x + Math.cos(a) * 70, ly = y + Math.sin(a) * 35; c.fillStyle = '#3aff6a'; c.beginPath(); c.arc(lx, ly, 1.6, 0, TAU); c.fill(); if (I.l) { I.l.fillStyle = 'rgba(80,255,120,1)'; I.l.beginPath(); I.l.arc(lx, ly, 2.4, 0, TAU); I.l.fill(); } }
    I.box(2.3, 0.15, 2.85, 0.75, 14, 34, '#e8e4dc');
    I.winL(2.35, 2.8, 0.75, 22, 32, { frame: '#444' });
    I.box(2.25, 0.1, 2.9, 0.8, 34, 37, '#c8402a');
    const [wx, wy] = I.p(2.6, 0.4, 37); c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx, wy - 16); c.stroke(); c.fillStyle = '#ff7a2a'; c.beginPath(); c.moveTo(wx, wy - 16); c.lineTo(wx + 10, wy - 13); c.lineTo(wx, wy - 10); c.fill();
    I.light(1.5, 1.5, 20, 120, 'rgba(120,255,150,');
    return { heli: [1.5, 1.5, 14] };
  },
};

function drawJeepIso(c, pos, s, dir) {
  // dir 0: facing +u (down-right), 1: +v (down-left), 2: -u, 3: -v
  const [x, y] = pos;
  c.save(); c.translate(x, y); c.scale(s, s);
  const I = new Iso(c, null);
  const along = dir % 2 === 0;
  const L = 0.62, Wd = 0.34;
  const u0 = along ? -L / 2 : -Wd / 2, u1 = along ? L / 2 : Wd / 2, v0 = along ? -Wd / 2 : -L / 2, v1 = along ? Wd / 2 : L / 2;
  groundShadow(c, 3, 2, 26, 11, 0.35);
  // wheels
  c.fillStyle = '#1a1a1a';
  const wpos = along ? [[u0 + 0.12, v1], [u1 - 0.12, v1], [u1, v0 + 0.08], [u1, v1 - 0.08]] : [[u1, v0 + 0.12], [u1, v1 - 0.12], [u0 + 0.08, v1], [u1 - 0.08, v1]];
  for (const [u, v] of wpos) { const [wx, wy] = I.p(u, v, 4); c.beginPath(); c.ellipse(wx, wy, 4, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#888'; c.beginPath(); c.arc(wx, wy, 1.5, 0, TAU); c.fill(); c.fillStyle = '#1a1a1a'; }
  I.box(u0, v0, u1, v1, 3, 12, '#e8c830', { edge: 'rgba(0,0,0,0.4)' });
  // red stripe
  I.quadL(u0, u1, v1, 7, 9, '#c8302a'); I.quadR(u1, v0, v1, 7, 9, '#a02018');
  // cabin / roll bar
  const cu0 = along ? (dir === 0 ? u0 + 0.05 : u0 + 0.22) : u0 + 0.03, cu1 = along ? (dir === 0 ? u1 - 0.22 : u1 - 0.05) : u1 - 0.03;
  const cv0 = along ? v0 + 0.03 : (dir === 1 ? v0 + 0.05 : v0 + 0.22), cv1 = along ? v1 - 0.03 : (dir === 1 ? v1 - 0.22 : v1 - 0.05);
  I.box(cu0, cv0, cu1, cv1, 12, 13, '#3a3a3a', { hl: false });
  c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.4;
  for (const [u, v] of [[cu0, cv1], [cu1, cv1], [cu1, cv0]]) { c.beginPath(); c.moveTo(...I.p(u, v, 12)); c.lineTo(...I.p(u, v, 21)); c.stroke(); }
  I.box(cu0, cv0, cu1, cv1, 21, 23, '#2e6a2e', { hl: false });
  // passengers
  c.fillStyle = '#e8b58e'; const [px, py] = I.p((cu0 + cu1) / 2, (cv0 + cv1) / 2, 16); c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill();
  c.restore();
}
function paintPalmAt(c, pos, s, seed) { c.save(); c.translate(pos[0], pos[1]); paintPalm(c, mulberry32(seed), seed, s); c.restore(); }

/* ==========================================================
   Decorations
   ========================================================== */
const PAINT_DECO = {
  palm(I, c) { paintPalmAt(c, I.p(0.5, 0.5, 0), 0.75, 42); },
  flowers(I, c) {
    I.box(0.12, 0.12, 0.88, 0.88, 0, 6, '#9a8a74', { top: '#5a3a1e' });
    const rng = mulberry32(3);
    for (let i = 0; i < 26; i++) {
      const [x, y] = I.p(0.18 + rng() * 0.64, 0.18 + rng() * 0.64, 6);
      c.fillStyle = '#3a7a2a'; c.beginPath(); c.ellipse(x, y - 1, 2.4, 1.3, rng(), 0, TAU); c.fill();
      c.fillStyle = pick(['#ff5a7a', '#ffd23f', '#fff', '#ff8a3a', '#c07aff']);
      c.beginPath(); c.arc(x, y - 3, 1.7, 0, TAU); c.fill();
    }
  },
  bench(I, c) {
    for (const u of [0.25, 0.75]) I.box(u - 0.04, 0.45, u + 0.04, 0.55, 0, 6, '#333');
    I.box(0.15, 0.4, 0.85, 0.62, 6, 8, '#9a6a3a');
    I.box(0.15, 0.36, 0.85, 0.42, 8, 16, '#8a5a30');
  },
  lamp(I, c) { I.box(0.42, 0.42, 0.58, 0.58, 0, 3, '#555'); I.lamp(0.5, 0.5, 3, 34); },
  torch(I, c) {
    const [x, y] = I.p(0.5, 0.5, 0);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 32); c.stroke();
    c.strokeStyle = '#5a3a1e'; c.lineWidth = 1; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x - 2, y - 6 - k * 6); c.lineTo(x + 2, y - 5 - k * 6); c.stroke(); }
    c.fillStyle = '#5a3a1e'; c.beginPath(); c.moveTo(x - 4, y - 32); c.lineTo(x + 4, y - 32); c.lineTo(x + 3, y - 38); c.lineTo(x - 3, y - 38); c.fill();
    return { torches: [[0.5, 0.5, 38]] };
  },
  fern(I, c) { const rng = mulberry32(21); for (let i = 0; i < 3; i++) { c.save(); c.translate(...I.p(0.3 + i * 0.2, 0.35 + (i % 2) * 0.3, 0)); c.scale(0.55, 0.55); paintTreeFern(c, rng, i); c.restore(); } },
  fossil(I, c) {
    I.box(0.14, 0.14, 0.86, 0.86, 0, 14, '#8a7a64', { top: '#a8987e' });
    const [x, y] = I.p(0.5, 0.5, 14);
    const ag = c.createRadialGradient(x - 3, y - 18, 1, x, y - 14, 13); ag.addColorStop(0, '#f0dcb0'); ag.addColorStop(1, '#a07a4a');
    c.fillStyle = ag; c.beginPath(); c.arc(x, y - 14, 11, 0, TAU); c.fill();
    c.fillStyle = 'rgba(180,230,255,0.35)'; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8;
    I.box(0.16, 0.16, 0.84, 0.84, 14, 44, 'rgba(170,220,240,0.3)', { edge: 'rgba(255,255,255,0.6)', left: 'rgba(170,220,240,0.3)', right: 'rgba(120,180,210,0.35)', top: 'rgba(210,240,255,0.35)', flat: true });
    c.strokeStyle = '#c8a870'; c.lineWidth = 2; c.beginPath();
    for (let a = 0; a < 4 * Math.PI; a += 0.2) { const r = 1 + a * 0.8; const px = x + Math.cos(a) * r, py = y - 14 + Math.sin(a) * r; a ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.stroke();
  },
  raptor_statue(I, c) {
    I.box(0.2, 0.2, 0.8, 0.8, 0, 12, '#9a948a', { top: '#b8b2a6' });
    const [x, y] = I.p(0.5, 0.5, 12);
    if (typeof DinoArt !== 'undefined') DinoArt.draw(c, 'velociraptor', x, y, 0.55, { stage: 0, dir: 1, t: 0.6, pose: 'roar', palette: P('#a8a498', '#6e6a62', '#c8c4ba', '#8a867c', '#a09c92', '#5a564e'), statue: true });
  },
  garden(I, c) {
    I.box(0.1, 0.1, 1.9, 1.9, 0, 5, '#a89a84', { top: '#5a3a1e' });
    const rng = mulberry32(31);
    for (let i = 0; i < 12; i++) { const [x, y] = I.p(0.3 + rng() * 1.4, 0.3 + rng() * 1.4, 5); leafBlob(c, x, y - 5, 5 + rng() * 4, FOLIAGE[i % 5], rng); }
    paintPalmAt(c, I.p(0.6, 0.6, 5), 0.55, 11);
    for (let i = 0; i < 20; i++) { const [x, y] = I.p(0.25 + rng() * 1.5, 0.25 + rng() * 1.5, 5); c.fillStyle = pick(['#ff5a7a', '#ffd23f', '#ff8a3a', '#fff']); c.beginPath(); c.arc(x, y - 8 - rng() * 6, 1.7, 0, TAU); c.fill(); }
  },
  fountain(I, c) {
    I.box(0.05, 0.05, 1.95, 1.95, 0, 3, '#b8b0a2');
    const o = I.cyl(1, 1, 3, 12, 0.85, '#c8c0b0', { top: '#d8d2c4' });
    c.fillStyle = '#4ab0d8'; c.beginPath(); c.ellipse(o.x, o.y1, o.rx * 0.86, o.ry * 0.86, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(o.x, o.y1, o.rx * 0.6, o.ry * 0.6, 0, 0, TAU); c.stroke();
    I.cyl(1, 1, 12, 30, 0.08, '#d8d2c4');
    const t = I.cyl(1, 1, 30, 33, 0.35, '#c8c0b0');
    c.fillStyle = '#6ac8e8'; c.beginPath(); c.ellipse(t.x, t.y1, t.rx * 0.8, t.ry * 0.8, 0, 0, TAU); c.fill();
    I.cyl(1, 1, 33, 44, 0.05, '#d8d2c4');
    return { fountain: [1, 1, 44, 30] };
  },
  waterfall(I, c) {
    I.box(0.05, 0.05, 1.95, 1.95, 0, 2, '#7a7266');
    const pool = I.p(1.2, 1.3, 2);
    c.fillStyle = '#3aa0c8'; c.beginPath(); c.ellipse(pool[0], pool[1], 34, 15, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(pool[0], pool[1], 26, 11, 0, 0, TAU); c.stroke();
    c.save(); c.translate(...I.p(0.55, 0.55, 0)); paintRock(c, mulberry32(4), 0, true); c.restore();
    c.save(); c.translate(...I.p(0.4, 1.3, 0)); c.scale(0.8, 0.8); paintRock(c, mulberry32(9), 0, false); c.restore();
    paintPalmAt(c, I.p(0.25, 0.8, 0), 0.5, 7);
    return { waterfall: [0.75, 0.75, 34, 1.2, 1.3, 2] };
  },
  skeleton(I, c) {
    I.box(0.1, 0.1, 1.9, 1.9, 0, 6, '#b8a88a', { top: '#d8c8a8' });
    const [x, y] = I.p(1, 1, 6);
    c.strokeStyle = '#f2ead8'; c.lineCap = 'round';
    // legs
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(x - 8, y - 32); c.lineTo(x - 2, y - 18); c.lineTo(x - 8, y - 2); c.moveTo(x - 4, y - 32); c.lineTo(x + 6, y - 18); c.lineTo(x + 2, y - 2); c.stroke();
    // spine & tail
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - 44, y - 18); c.quadraticCurveTo(x - 20, y - 40, x + 8, y - 38); c.quadraticCurveTo(x + 20, y - 36, x + 26, y - 44); c.stroke();
    // ribs
    c.lineWidth = 1.3;
    for (let k = 0; k < 8; k++) { const px = x - 6 + k * 3.4, py = y - 38 + Math.sin(k * 0.3) * 1.5; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 4, py + 10, px + 1, py + 16 - Math.abs(k - 4)); c.stroke(); }
    // skull
    c.fillStyle = '#f2ead8'; c.beginPath(); c.moveTo(x + 24, y - 48); c.quadraticCurveTo(x + 34, y - 56, x + 46, y - 50); c.lineTo(x + 46, y - 44); c.lineTo(x + 28, y - 40); c.closePath(); c.fill();
    c.fillStyle = '#3a2e22'; c.beginPath(); c.arc(x + 32, y - 49, 2.2, 0, TAU); c.fill();
    c.strokeStyle = '#f2ead8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 28, y - 41); c.lineTo(x + 44, y - 40); c.stroke();
    // stand poles
    c.strokeStyle = '#444'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 20, y - 2); c.lineTo(x - 20, y - 30); c.moveTo(x + 18, y - 2); c.lineTo(x + 18, y - 38); c.stroke();
  },
  amber_monument(I, c) {
    for (let i = 0; i < 3; i++) I.box(0.1 + i * 0.15, 0.1 + i * 0.15, 1.9 - i * 0.15, 1.9 - i * 0.15, i * 5, i * 5 + 5, '#6a5a48', { top: '#8a7a64' });
    const [x, y] = I.p(1, 1, 15);
    const g = c.createLinearGradient(x - 14, y - 60, x + 14, y);
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.4, '#f5a623'); g.addColorStop(1, '#8a3a04');
    c.fillStyle = g; c.strokeStyle = '#5a2500'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, y - 64); c.lineTo(x + 15, y - 34); c.lineTo(x + 10, y - 4); c.lineTo(x, y + 2); c.lineTo(x - 11, y - 4); c.lineTo(x - 15, y - 36); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(x, y - 64); c.lineTo(x - 2, y + 2); c.moveTo(x - 15, y - 36); c.lineTo(x + 15, y - 34); c.stroke();
    // mosquito
    c.fillStyle = '#3a1a02'; c.beginPath(); c.ellipse(x + 1, y - 30, 2, 5, 0.3, 0, TAU); c.fill();
    c.strokeStyle = '#3a1a02'; c.lineWidth = 0.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + 1, y - 30); c.lineTo(x + s * 6, y - 26); c.moveTo(x + 1, y - 31); c.lineTo(x + s * 6, y - 35); c.stroke(); }
    if (I.l) { const lg = I.l.createRadialGradient(x, y - 32, 2, x, y - 32, 26); lg.addColorStop(0, 'rgba(255,190,80,0.9)'); lg.addColorStop(1, 'rgba(255,150,40,0)'); I.l.fillStyle = lg; I.l.fillRect(x - 30, y - 64, 60, 70); }
    I.lights.push({ x, y: y - 30, r: 90, col: 'rgba(255,170,60,' });
  },
};

/* ---------- fences for paddocks ---------- */
function paintFence(ctx, axis, gate) {
  // one tile long segment along the given axis, posts at segment start
  const I = new Iso(ctx, null);
  const H = 30;
  const post = (u, v) => I.box(u - 0.05, v - 0.05, u + 0.05, v + 0.05, 0, H + 4, '#9a968e', { top: '#c8c4bc' });
  const a = axis === 'u' ? [0, 0] : [0, 0], b = axis === 'u' ? [1, 0] : [0, 1];
  if (gate) {
    // big double gate with warning sign
    if (axis === 'u') I.box(0.06, -0.04, 0.94, 0.04, 0, H + 6, '#6a6e70', { top: '#8a8e90' });
    else I.box(-0.04, 0.06, 0.04, 0.94, 0, H + 6, '#6a6e70', { top: '#8a8e90' });
    const c = ctx; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8;
    for (let k = 1; k < 6; k++) { const t = k / 6; const p0 = I.p(lerp(a[0], b[0], t), lerp(a[1], b[1], t) + (axis === 'u' ? 0.03 : 0), 0); const p1 = I.p(lerp(a[0], b[0], t), lerp(a[1], b[1], t) + (axis === 'u' ? 0.03 : 0), H + 6); c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke(); }
    const [sx, sy] = I.p((a[0] + b[0]) / 2 + (axis === 'v' ? 0.04 : 0), (a[1] + b[1]) / 2 + (axis === 'u' ? 0.04 : 0), 22);
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#1a1a1a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx, sy - 7); c.lineTo(sx + 7, sy + 5); c.lineTo(sx - 7, sy + 5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1a1a1a'; c.font = "900 8px Nunito, sans-serif"; c.textAlign = 'center'; c.fillText('!', sx, sy + 4);
    // hazard stripes on top
    for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; I.poly([I.p(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), H + 6), I.p(lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), H + 6), I.p(lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), H + 3), I.p(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), H + 3)], k % 2 ? '#1a1a1a' : '#ffd23f'); }
  } else {
    // wires
    for (let k = 0; k < 4; k++) {
      const z = 7 + k * 7;
      ctx.strokeStyle = 'rgba(40,40,40,0.9)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(...I.p(a[0], a[1], z)); ctx.quadraticCurveTo(...I.p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - 1.2), ...I.p(b[0], b[1], z)); ctx.stroke();
    }
    // mesh hint
    ctx.strokeStyle = 'rgba(60,60,60,0.25)'; ctx.lineWidth = 0.5;
    for (let k = 1; k < 8; k++) { const t = k / 8; ctx.beginPath(); ctx.moveTo(...I.p(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 4)); ctx.lineTo(...I.p(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 29)); ctx.stroke(); }
  }
  post(a[0], a[1]);
  // insulator light on post top
  const [lx, ly] = I.p(a[0], a[1], H + 4);
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(lx, ly - 1, 1.5, 0, TAU); ctx.fill();
}

/* ---------- icons for world bubbles ---------- */
function paintIcon(kind, size = 26) {
  return makeSprite(size, size, size / 2, size / 2, ctx => {
    const r = size / 2 - 1.5;
    if (kind === 'coin') {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r * 1.1); g.addColorStop(0, '#fff6c2'); g.addColorStop(0.5, '#ffc93a'); g.addColorStop(1, '#a86400');
      ctx.fillStyle = g; ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b67800'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#8a5500'; ctx.font = `900 ${r * 1.1}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
    } else if (kind === 'crops' || kind === 'meat' || kind === 'amber' || kind === 'bucks' || kind === 'xp') {
      const img = ICON_IMG[kind];
      if (img && img.complete) ctx.drawImage(img, -r, -r, r * 2, r * 2);
    } else if (kind === 'hammer') {
      ctx.rotate(-0.6);
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(-2, -2, 4, r * 1.6);
      ctx.fillStyle = '#8a9aa4'; ctx.strokeStyle = '#3a4a54'; ctx.lineWidth = 1; ctx.fillRect(-r * 0.7, -r * 0.8, r * 1.4, r * 0.6); ctx.strokeRect(-r * 0.7, -r * 0.8, r * 1.4, r * 0.6);
    } else if (kind === 'zzz') {
      ctx.fillStyle = '#fff'; ctx.font = `900 ${r}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Z', -3, 4); ctx.font = `900 ${r * 0.7}px Nunito, sans-serif`; ctx.fillText('z', 6, -3);
    } else if (kind === 'hungry') {
      ctx.fillStyle = '#e0513a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 1.4}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1);
    } else if (kind === 'check') {
      ctx.fillStyle = '#4c9e2f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.1, r * 0.4); ctx.lineTo(r * 0.5, -r * 0.4); ctx.stroke();
    } else if (kind === 'evolve') {
      ctx.fillStyle = '#b35ae0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, r * 0.55); ctx.lineTo(0, -r * 0.5); ctx.moveTo(-r * 0.45, -r * 0.05); ctx.lineTo(0, -r * 0.55); ctx.lineTo(r * 0.45, -r * 0.05); ctx.stroke();
    }
  });
}
const ICON_IMG = {};
function loadIconImages() {
  // reuse the CSS data-URI icons for world bubbles
  const map = { crops: 'ic-crop', meat: 'ic-meat', amber: 'ic-amber', bucks: 'ic-buck', xp: 'ic-xp' };
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const proms = [];
  for (const k in map) {
    probe.className = 'ic ' + map[k];
    const bg = getComputedStyle(probe).backgroundImage;
    const m = bg.match(/url\("?(.*?)"?\)$/);
    if (!m) continue;
    const img = new Image();
    proms.push(new Promise(res => { img.onload = res; img.onerror = res; }));
    img.src = m[1].replace(/\\"/g, '"');
    ICON_IMG[k] = img;
  }
  probe.remove();
  return Promise.all(proms);
}

/* ---------- build everything ---------- */
function buildSprites() {
  // trees: 0-5 broadleaf, 6-7 araucaria, 8-9 tree fern
  Sprites.trees.tree = [];
  for (let v = 0; v < 10; v++) {
    const rng = mulberry32(1000 + v * 17);
    const painter = v < 6 ? paintBroadleaf : v < 8 ? paintAraucaria : paintTreeFern;
    Sprites.trees.tree.push(makeSprite(110, 150, 55, 136, ctx => painter(ctx, rng, v)));
  }
  Sprites.trees.palm = [];
  for (let v = 0; v < 4; v++) { const rng = mulberry32(2000 + v * 31); Sprites.trees.palm.push(makeSprite(120, 130, 60, 116, ctx => paintPalm(ctx, rng, v))); }
  Sprites.trees.bush = [];
  for (let v = 0; v < 6; v++) { const rng = mulberry32(3000 + v * 13); Sprites.trees.bush.push(makeSprite(60, 48, 30, 38, ctx => paintBush(ctx, rng, v))); }
  Sprites.trees.rock = [];
  for (let v = 0; v < 4; v++) { const rng = mulberry32(4000 + v * 7); Sprites.trees.rock.push(makeSprite(60, 44, 30, 32, ctx => paintRock(ctx, rng, v, false))); }
  Sprites.trees.bigrock = [];
  for (let v = 0; v < 3; v++) { const rng = mulberry32(5000 + v * 7); Sprites.trees.bigrock.push(makeSprite(90, 64, 45, 48, ctx => paintRock(ctx, rng, v, true))); }
  Sprites.misc.volcano = paintVolcano();
  // buildings
  const heights = { visitor_center: 150, gate: 150, lab: 110, crop_harbor: 100, meat_harbor: 100, arena: 90, souvenir: 80, burger: 90, icecream: 100, coffee: 70, ranger: 90, restaurant: 100, tower: 160, jeep: 70, museum: 100, hotel: 170, helipad: 60 };
  for (const id in BUILDINGS) {
    const [w, h] = BUILDINGS[id].size;
    let extra = {};
    const s = buildingSprite(w, h, heights[id] || 100, I => { extra = PAINT[id](I) || {}; });
    Sprites.buildings[id] = Object.assign(s, extra);
  }
  for (const id in DECOS) {
    const [w, h] = DECOS[id].size;
    let extra = {};
    const s = buildingSprite(w, h, id === 'palm' ? 90 : 80, (I, c) => { extra = PAINT_DECO[id](I, c) || {}; });
    Sprites.decos[id] = Object.assign(s, extra);
  }
  // fences
  const fm = 20;
  Sprites.fences.u = makeSprite(TW / 2 + fm * 2, TH / 2 + 40 + fm, fm, 40 + fm / 2, ctx => paintFence(ctx, 'u'));
  Sprites.fences.v = makeSprite(TW / 2 + fm * 2, TH / 2 + 40 + fm, TW / 2 + fm, 40 + fm / 2, ctx => paintFence(ctx, 'v'));
  Sprites.fences.gu = makeSprite(TW / 2 + fm * 2, TH / 2 + 44 + fm, fm, 44 + fm / 2, ctx => paintFence(ctx, 'u', true));
  Sprites.fences.gv = makeSprite(TW / 2 + fm * 2, TH / 2 + 44 + fm, TW / 2 + fm, 44 + fm / 2, ctx => paintFence(ctx, 'v', true));
  Sprites.fences.post = makeSprite(20, 50, 10, 42, ctx => { const I = new Iso(ctx, null); I.box(-0.05, -0.05, 0.05, 0.05, 0, 34, '#9a968e', { top: '#c8c4bc' }); ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, -35, 1.5, 0, TAU); ctx.fill(); });
  for (const k of ['coin', 'crops', 'meat', 'amber', 'bucks', 'xp', 'hammer', 'zzz', 'hungry', 'check', 'evolve']) Sprites.icons[k] = paintIcon(k);
  // paddock props
  Sprites.misc.trough = makeSprite(60, 40, 30, 24, ctx => {
    const I = new Iso(ctx, null);
    I.box(-0.35, -0.12, 0.35, 0.12, 0, 7, '#8a8680', { top: '#6a5a44' });
    ctx.fillStyle = '#7ab84a'; for (let k = 0; k < 8; k++) { const [x, y] = I.p(-0.3 + k * 0.08, 0, 7); ctx.beginPath(); ctx.ellipse(x, y - 1, 3, 1.6, 0, 0, TAU); ctx.fill(); }
  });
  Sprites.misc.nest = makeSprite(60, 36, 30, 22, ctx => {
    const rng = mulberry32(66);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, 3, 24, 10, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 70; i++) { const a = rng() * TAU, r = 12 + rng() * 9; ctx.strokeStyle = rng() < 0.5 ? '#c8a050' : '#8a6a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.45; ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y + (rng() - 0.5) * 3); ctx.stroke(); }
    ctx.fillStyle = '#6a4a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, TAU); ctx.fill();
  });
}

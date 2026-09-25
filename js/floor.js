'use strict';
/* ============================================================
   Casino-Halle: begehbare 2D-Welt (3/4-Draufsicht)
   ============================================================ */
const Floor = (() => {
  const canvas = $('#floorCanvas'), g = canvas.getContext('2d');
  const view = $('#view-floor');
  const promptEl = $('#floorPrompt'), promptName = $('#floorPromptName'), promptKey = $('#floorPromptKey');
  const actionBtn = $('#floorAction'), joyEl = $('#joy'), knobEl = $('#joyKnob');
  const mini = $('#minimap'), mg = mini.getContext('2d');

  const WW = 1800, WH = 1720, WALL = 160, BOTTOM = 46;
  const CELL = 20, COLS = Math.ceil(WW / CELL), ROWS = Math.ceil(WH / CELL);
  const PR = 11; // Spieler-Radius
  let W = 0, H = 0, dpr = 1, zoom = 1, camX = 0, camY = 0;
  let active = false, raf = null, last = 0, time = 0, frame = 0;
  let near = null, pendingInteract = null, stepAcc = 0;
  const keys = new Set();
  const joy = { id: null, dx: 0, dy: 0, cx: 0, cy: 0 };

  const player = { x: 900, y: 1600, dir: 3, phase: 0, moving: false, path: null, speed: 200 };
  let avatar = Avatar.load();

  /* ---------- Hilfen ---------- */
  function rr(x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  const sh = Avatar.shade;
  function glowText(txt, x, y, size, color, blur = 12, font = 'Bungee') {
    txt = I18N.t(txt);
    size = Math.max(size, 10.5 / zoom);
    g.font = `${size}px "${font}", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = blur; g.fillStyle = '#fff'; g.fillText(txt, x, y);
    g.shadowBlur = blur * 0.5; g.fillStyle = color; g.globalAlpha = 0.35; g.fillText(txt, x, y); g.globalAlpha = 1;
    g.shadowBlur = 0;
  }
  function sprite(id, size) { return Symbols.sprite(id, Math.round(size * Math.min(2, dpr * zoom) * 1.5)); }

  /* ---------- Teppich ---------- */
  let carpet = null;
  function buildCarpet() {
    const T = 140, c = document.createElement('canvas'); c.width = c.height = T;
    const t = c.getContext('2d');
    t.fillStyle = '#2a0c2a'; t.fillRect(0, 0, T, T);
    const rg = t.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T * 0.7);
    rg.addColorStop(0, 'rgba(120,30,90,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = rg; t.fillRect(0, 0, T, T);
    // Rautengitter
    t.strokeStyle = 'rgba(255,201,74,0.08)'; t.lineWidth = 2;
    t.beginPath(); t.moveTo(T / 2, 0); t.lineTo(T, T / 2); t.lineTo(T / 2, T); t.lineTo(0, T / 2); t.closePath(); t.stroke();
    t.strokeStyle = 'rgba(59,232,255,0.05)'; t.lineWidth = 1;
    t.beginPath(); t.moveTo(T / 2, 14); t.lineTo(T - 14, T / 2); t.lineTo(T / 2, T - 14); t.lineTo(14, T / 2); t.closePath(); t.stroke();
    // Rosetten
    const ros = (x, y, r, col) => {
      t.fillStyle = col;
      for (let k = 0; k < 8; k++) {
        t.save(); t.translate(x, y); t.rotate(k * Math.PI / 4);
        t.beginPath(); t.ellipse(r * 0.55, 0, r * 0.45, r * 0.16, 0, 0, Math.PI * 2); t.fill(); t.restore();
      }
      t.fillStyle = 'rgba(255,201,74,0.5)'; t.beginPath(); t.arc(x, y, r * 0.18, 0, Math.PI * 2); t.fill();
    };
    ros(T / 2, T / 2, 22, 'rgba(255,61,139,0.11)');
    [[0, 0], [T, 0], [0, T], [T, T]].forEach(([x, y]) => ros(x, y, 16, 'rgba(157,92,255,0.10)'));
    t.fillStyle = 'rgba(255,201,74,0.18)';
    [[T / 2, 0], [0, T / 2], [T, T / 2], [T / 2, T]].forEach(([x, y]) => { t.beginPath(); t.arc(x, y, 3, 0, Math.PI * 2); t.fill(); });
    // Körnung
    for (let i = 0; i < 500; i++) { t.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; t.fillRect(Math.random() * T, Math.random() * T, 1.5, 1.5); }
    carpet = g.createPattern(c, 'repeat');
  }

  /* ---------- Weltobjekte ---------- */
  const objects = [];
  function add(o) {
    o.fw = o.fw || 0; o.fh = o.fh || 0;
    o.sortY = o.sortY != null ? o.sortY : o.y;
    objects.push(o); return o;
  }
  const SLOT_THEMES = [
    { name: 'LUCKY 7', c: '#ff3d8b', syms: ['seven', 'seven', 'seven'] },
    { name: 'WILD', c: '#ffc94a', syms: ['wild', 'cherry', 'wild'] },
    { name: 'JACKPOT', c: '#3be8ff', syms: ['bell', 'bell', 'bell'] },
    { name: 'DIAMANT', c: '#9d5cff', syms: ['diamond', 'clover', 'diamond'] },
    { name: 'BONUS', c: '#5dffb0', syms: ['scatter', 'grape', 'scatter'] },
  ];
  SLOT_THEMES.forEach((th, i) => {
    const x = 150 + i * 92;
    add({ kind: 'slot', x, y: 262, fw: 72, fh: 44, vh: 128, th, game: 'slots', label: 'Lucky Seven Deluxe', sub: 'Slot · 10 Linien',
      ix: x, iy: 312, glow: th.c, seed: i * 1.7 });
    add({ kind: 'stool', x, y: 300, c: th.c, nocoll: true });
  });
  add({ kind: 'plinko', x: 650, y: 268, fw: 96, fh: 48, vh: 160, game: 'plinko', label: 'Neon Plinko', sub: 'Bis 1000×', ix: 650, iy: 318, glow: '#ff3d8b' });
  add({ kind: 'podium', x: 900, y: 232, fw: 170, fh: 40, vh: 30, game: 'wheel', label: 'Bonusrad', sub: 'Gratis-Dreh', ix: 900, iy: 276, glow: '#ffc94a' });
  add({ kind: 'bar', x: 1470, y: 270, fw: 430, fh: 50, vh: 60, game: 'bar', label: 'Neon Bar', sub: 'Mocktail aufs Haus', ix: 1470, iy: 322, glow: '#3be8ff' });
  [1300, 1385, 1470, 1555, 1640].forEach(x => add({ kind: 'stool', x, y: 312, c: '#3be8ff', nocoll: true }));
  add({ kind: 'roulette', x: 900, y: 700, fw: 330, fh: 140, vh: 40, game: 'roulette', label: 'Grand Roulette', sub: 'Europäisch · 1 Null', ix: 900, iy: 752, glow: '#5dffb0' });
  add({ kind: 'blackjack', x: 430, y: 700, fw: 250, fh: 120, vh: 40, game: 'blackjack', label: 'Midnight Blackjack', sub: '3:2 · Split', ix: 430, iy: 752, glow: '#5dffb0' });
  add({ kind: 'dice', x: 1370, y: 700, fw: 260, fh: 120, vh: 44, game: 'dice', label: 'Würfel-Duell', sub: 'Unter · 7 · Über', ix: 1370, iy: 752, glow: '#ff8a3d' });
  add({ kind: 'crash', x: 330, y: 1040, fw: 170, fh: 60, vh: 140, game: 'crash', label: 'Rocket Crash', sub: 'Steig rechtzeitig aus', ix: 330, iy: 1092, glow: '#ff5d3d' });
  add({ kind: 'mines', x: 620, y: 1040, fw: 140, fh: 56, vh: 130, game: 'mines', label: 'Diamond Mines', sub: 'Juwelen statt Bomben', ix: 620, iy: 1092, glow: '#3be8ff' });
  add({ kind: 'scratch', x: 1180, y: 1040, fw: 170, fh: 56, vh: 110, game: 'scratch', label: 'Rubbellose', sub: 'Bis 100× pro Los', ix: 1180, iy: 1092, glow: '#ffc94a' });
  add({ kind: 'cashier', x: 1480, y: 1040, fw: 210, fh: 56, vh: 120, game: 'lobby', label: 'Kasse & Profil', sub: 'Statistik · Erfolge', ix: 1480, iy: 1092, glow: '#9d5cff' });
  [[230, 470], [1570, 470], [230, 880], [1570, 880], [690, 880], [1110, 880], [230, 1250], [1570, 1250], [690, 1250], [1110, 1250]].forEach(([x, y]) => add({ kind: 'pillar', x, y, fw: 40, fh: 26, vh: 150 }));
  [[60, 250], [1740, 360], [60, 1250], [1740, 1250], [760, 1640], [1040, 1640], [60, 640], [1740, 640], [60, 1640], [1740, 1640]].forEach(([x, y], i) => add({ kind: 'plant', x, y, fw: 34, fh: 22, vh: 70, v: i }));
  // Neue Reihe: Video-Poker, Keno, Hi-Lo, Baccarat
  [150, 240, 330].forEach((x, i) => {
    add({ kind: 'vpoker', x, y: 1430, fw: 72, fh: 44, vh: 124, game: 'poker', label: 'Jacks or Better', sub: 'Video-Poker', ix: x, iy: 1480, glow: '#3be8ff', seed: i * 2.3 });
    add({ kind: 'stool', x, y: 1468, c: '#3be8ff', nocoll: true });
  });
  add({ kind: 'keno', x: 590, y: 1430, fw: 170, fh: 56, vh: 140, game: 'keno', label: 'Neon Keno', sub: '10 aus 40', ix: 590, iy: 1482, glow: '#9d5cff' });
  add({ kind: 'hilo', x: 1150, y: 1450, fw: 200, fh: 96, vh: 40, game: 'hilo', label: 'Hi-Lo', sub: 'Höher oder niedriger', ix: 1150, iy: 1500, glow: '#5dffb0' });
  add({ kind: 'baccarat', x: 1480, y: 1460, fw: 290, fh: 124, vh: 40, game: 'baccarat', label: 'Royal Baccarat', sub: 'Spieler · Bank · Unentschieden', ix: 1480, iy: 1512, glow: '#ffc94a' });
  add({ kind: 'door', x: 900, y: WH - 6, fw: 0, fh: 0, vh: 90, sortY: WH + 50, game: 'exit', label: 'Ausgang', sub: 'Zur Stadt', ix: 900, iy: WH - 80, glow: '#3be8ff' });
  [[820, 1560], [820, 1450], [980, 1560], [980, 1450]].forEach(([x, y]) => add({ kind: 'post', x, y, fw: 12, fh: 10, vh: 34 }));

  const interactives = objects.filter(o => o.game);

  /* ---------- Figuren ---------- */
  const rndAvatar = () => ({ skin: U.randInt(0, 4), hair: U.randInt(0, 6), style: U.pick(['short', 'long', 'bun', 'mohawk', 'bald', 'short', 'long']),
    outfit: U.randInt(0, 6), accent: U.pick(['#ffc94a', '#ff3d8b', '#3be8ff', '#5dffb0', '#ffffff']), glasses: Math.random() < 0.25 });
  const dealers = [
    { x: 880, y: 563, a: { skin: 2, hair: 0, style: 'short', outfit: '#16121f', accent: '#e0103a' }, opts: { bowtie: true } },
    { x: 430, y: 585, a: { skin: 0, hair: 3, style: 'bun', outfit: '#16121f', accent: '#e0103a' }, opts: { bowtie: true } },
    { x: 1370, y: 579, a: { skin: 4, hair: 0, style: 'bald', outfit: '#16121f', accent: '#ffc94a' }, opts: { bowtie: true } },
    { x: 1470, y: 206, a: { skin: 1, hair: 5, style: 'mohawk', outfit: '#1c1826', accent: '#3be8ff' }, opts: { bowtie: true } },
    { x: 1480, y: 990, a: { skin: 3, hair: 1, style: 'long', outfit: '#3a1f78', accent: '#ffc94a', glasses: true }, opts: {} },
    { x: 1150, y: 1370, a: { skin: 1, hair: 6, style: 'bun', outfit: '#16121f', accent: '#5dffb0' }, opts: { bowtie: true } },
    { x: 1480, y: 1356, a: { skin: 2, hair: 0, style: 'short', outfit: '#16121f', accent: '#ffc94a', glasses: false }, opts: { bowtie: true } },
  ].map(d => Object.assign(d, { dir: 0, phase: Math.random() * 6, npc: true, fixed: true }));
  const guests = Array.from({ length: 7 }, (_, i) => ({ x: 400 + i * 160, y: 900 + (i % 3) * 60, dir: 0, phase: 0, moving: false, a: rndAvatar(),
    path: null, wait: U.rand(0.5, 3), speed: U.rand(55, 80), npc: true, playing: null }));

  /* ---------- Kollision & Wegfindung ---------- */
  const blocked = new Uint8Array(COLS * ROWS);
  function rectOf(o) { return { x: o.x - o.fw / 2, y: o.y - o.fh, w: o.fw, h: o.fh }; }
  function buildGrid() {
    blocked.fill(0);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      if (y < WALL + 34 || y > WH - BOTTOM - 14 || x < 26 || x > WW - 26) { blocked[r * COLS + c] = 1; continue; }
      for (const o of objects) {
        if (o.nocoll || !o.fw) continue;
        const q = rectOf(o);
        if (x > q.x - PR && x < q.x + q.w + PR && y > q.y - PR && y < q.y + q.h + PR) { blocked[r * COLS + c] = 1; break; }
      }
    }
  }
  function collides(x, y) {
    if (y < WALL + 30 || y > WH - BOTTOM - 10 || x < 22 || x > WW - 22) return true;
    for (const o of objects) {
      if (o.nocoll || !o.fw) continue;
      const q = rectOf(o);
      const cx = U.clamp(x, q.x, q.x + q.w), cy = U.clamp(y, q.y, q.y + q.h);
      if ((x - cx) ** 2 + (y - cy) ** 2 < PR * PR) return true;
    }
    return false;
  }
  const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked[r * COLS + c];
  function nearestFree(c, r) {
    if (free(c, r)) return [c, r];
    for (let d = 1; d < 12; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      if (free(c + dx, r + dy)) return [c + dx, r + dy];
    }
    return null;
  }
  function los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8);
    for (let i = 1; i <= n; i++) { const t = i / n; if (collides(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  function findPath(sx, sy, tx, ty) {
    const s = nearestFree(Math.floor(sx / CELL), Math.floor(sy / CELL));
    const e = nearestFree(Math.floor(tx / CELL), Math.floor(ty / CELL));
    if (!s || !e) return null;
    const N = COLS * ROWS, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const si = s[1] * COLS + s[0], ei = e[1] * COLS + e[0];
    const hfn = i => { const c = i % COLS, r = (i / COLS) | 0; const dx = Math.abs(c - e[0]), dy = Math.abs(r - e[1]); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    gS[si] = 0; push(si, hfn(si));
    let found = false, guard = 0;
    while (heap.length && guard++ < 20000) {
      const [, i] = pop();
      if (closed[i]) continue; closed[i] = 1;
      if (i === ei) { found = true; break; }
      const c = i % COLS, r = (i / COLS) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nc = c + dx, nr = r + dy;
        if (!free(nc, nr)) continue;
        if (dx && dy && (!free(c + dx, r) || !free(c, r + dy))) continue;
        const ni = nr * COLS + nc, cost = gS[i] + (dx && dy ? 1.414 : 1);
        if (cost < gS[ni]) { gS[ni] = cost; from[ni] = i; push(ni, cost + hfn(ni)); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = ei; i !== -1; i = from[i]) pts.push({ x: (i % COLS) * CELL + CELL / 2, y: ((i / COLS) | 0) * CELL + CELL / 2 });
    pts.reverse();
    pts[pts.length - 1] = collides(tx, ty) ? pts[pts.length - 1] : { x: tx, y: ty };
    // Weg glätten (Sichtlinie)
    const out = [];
    let cur = { x: sx, y: sy }, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) if (los(cur.x, cur.y, pts[j].x, pts[j].y)) { far = j; break; }
      out.push(pts[far]); cur = pts[far]; k = far + 1;
    }
    return out;
  }

  /* ---------- Bewegung ---------- */
  function stepChar(ch, dt, vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len < 0.01) { ch.moving = false; return; }
    const sp = ch.speed * dt;
    const mx = vx / len * sp * Math.min(1, len), my = vy / len * sp * Math.min(1, len);
    if (!collides(ch.x + mx, ch.y) || ch.npc) ch.x += mx;
    if (!collides(ch.x, ch.y + my) || ch.npc) ch.y += my;
    ch.moving = true;
    ch.phase += dt * (ch.npc ? 9 : 11) * Math.min(1, len);
    if (Math.abs(vx) > Math.abs(vy)) ch.dir = vx < 0 ? 1 : 2; else ch.dir = vy < 0 ? 3 : 0;
  }
  function followPath(ch, dt) {
    if (!ch.path || !ch.path.length) { ch.path = null; return false; }
    const p = ch.path[0];
    const dx = p.x - ch.x, dy = p.y - ch.y, d = Math.hypot(dx, dy);
    if (d < 4) { ch.path.shift(); if (!ch.path.length) { ch.path = null; return false; } return true; }
    const f = Math.min(1, d / Math.max(1, ch.speed * dt));
    const ox = ch.x, oy = ch.y;
    stepChar(ch, dt * f, dx, dy);
    if (!ch.npc && Math.hypot(ch.x - ox, ch.y - oy) < 0.05) { ch.path = null; return false; } // festgelaufen
    return true;
  }

  function updatePlayer(dt) {
    let vx = 0, vy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) vx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) vx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) vy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) vy += 1;
    if (joy.id !== null) { vx = joy.dx; vy = joy.dy; }
    if (vx || vy) { player.path = null; pendingInteract = null; stepChar(player, dt, vx, vy); }
    else if (player.path) {
      const going = followPath(player, dt);
      if (!going) {
        player.moving = false;
        if (pendingInteract) { const o = pendingInteract; pendingInteract = null; if (Math.hypot(player.x - o.ix, player.y - o.iy) < 60) { player.dir = 3; interact(o); } }
      }
    } else player.moving = false;
    if (player.moving) {
      stepAcc += dt;
      if (stepAcc > 0.28) { stepAcc = 0; Sfx.step && Sfx.step(); }
    }
    // nächstes Objekt in Reichweite
    let best = null, bd = 70;
    for (const o of interactives) {
      const d = Math.hypot(player.x - o.ix, player.y - o.iy);
      if (d < bd) { bd = d; best = o; }
    }
    near = best;
  }

  // Figuren nicht ineinander stehen lassen
  function separate() {
    const all = [player, ...guests];
    for (let i = 1; i < all.length; i++) for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      const a = all[i], b = all[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < 22) {
        const push = (22 - d) * (j === 0 ? 1 : 0.5), nx = a.x + dx / d * push, ny = a.y + dy / d * push;
        if (!collides(nx, ny)) { a.x = nx; a.y = ny; }
      }
    }
  }
  function updateGuests(dt) {
    separate();
    for (const n of guests) {
      if (n.path) { if (!followPath(n, dt)) n.moving = false; continue; }
      n.moving = false;
      n.wait -= dt;
      n.phase += dt * 2;
      if (n.wait > 0) continue;
      // Ziel: Automat, Tisch oder freier Punkt
      let tx, ty;
      if (Math.random() < 0.55) {
        const o = U.pick(interactives.filter(o => o.game !== 'lobby' && o.game !== 'exit'));
        tx = o.ix + U.pick([-36, 0, 36]); ty = o.iy + U.rand(4, 14);
        n.playing = o;
      } else { tx = U.rand(80, WW - 80); ty = U.rand(WALL + 200, WH - 60); n.playing = null; }
      n.path = findPath(n.x, n.y, tx, ty);
      n.wait = n.playing ? U.rand(4, 10) : U.rand(1, 4);
      if (!n.path) n.wait = 1;
    }
  }

  function interact(o) {
    if (!o) return;
    Sfx.init(); Sfx.click();
    Store.s.floorPos = { x: Math.round(player.x), y: Math.round(player.y) }; Store.save();
    if (o.game === 'wheel') { App.openModal('modal-wheel'); return; }
    if (o.game === 'bar') { Bar.order(); return; }
    if (o.game === 'exit') { Floor.exitToTown ? Floor.exitToTown() : Toast.show(I18N.t('Ausgang'), I18N.t('Die Stadt öffnet bald ihre Tore.'), '→'); return; }
    App.enter(o.game);
  }

  /* ---------- Zeichnen: Boden & Wand ---------- */
  function drawFloor() {
    g.fillStyle = carpet || '#2a0c2a';
    g.fillRect(0, WALL, WW, WH - WALL);
    // roter Läufer vom Eingang
    const rx = 820, rw = 160;
    const lg = g.createLinearGradient(rx, 0, rx + rw, 0);
    lg.addColorStop(0, '#5a0a1e'); lg.addColorStop(0.5, '#8a1030'); lg.addColorStop(1, '#5a0a1e');
    g.fillStyle = lg; g.fillRect(rx, 820, rw, WH - 820);
    g.fillStyle = '#c98a12'; g.fillRect(rx, 820, 5, WH - 820); g.fillRect(rx + rw - 5, 820, 5, WH - 820);
    g.fillStyle = 'rgba(255,201,74,0.18)';
    for (let y = 850; y < WH; y += 60) { g.beginPath(); g.moveTo(900, y); g.lineTo(915, y + 15); g.lineTo(900, y + 30); g.lineTo(885, y + 15); g.closePath(); g.fill(); }
    // Tanzfläche-artige Lichtinsel unter dem Roulette
    const pool = (x, y, r, col, a) => {
      const pg = g.createRadialGradient(x, y, 0, x, y, r);
      pg.addColorStop(0, `rgba(${col},${a})`); pg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = pg; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    g.globalCompositeOperation = 'lighter';
    pool(900, 650, 300, '93,255,176', 0.07);
    pool(430, 650, 220, '93,255,176', 0.05);
    pool(1370, 650, 220, '255,138,61', 0.06);
    for (const o of interactives) if (o.kind === 'slot' || o.kind === 'plinko') pool(o.x, o.y + 20, 90, hexRgb(o.glow), 0.12 + 0.04 * Math.sin(time * 2 + (o.seed || 0)));
    pool(330, 1060, 150, '255,93,61', 0.08); pool(620, 1060, 130, '59,232,255', 0.08);
    pool(1180, 1060, 150, '255,201,74', 0.07); pool(1480, 1060, 160, '157,92,255', 0.07);
    pool(240, 1450, 200, '59,232,255', 0.08); pool(590, 1450, 140, '157,92,255', 0.08); pool(1150, 1430, 170, '93,255,176', 0.05); pool(1480, 1430, 220, '255,201,74', 0.06);
    pool(900, WH - 40, 180, '59,232,255', 0.1);
    pool(900, 300, 220, '255,201,74', 0.08 + (Wheel.ready() ? 0.05 * Math.sin(time * 3) : 0));
    g.globalCompositeOperation = 'source-over';
    // Sockelleiste vor der Wand
    const bg = g.createLinearGradient(0, WALL, 0, WALL + 30);
    bg.addColorStop(0, 'rgba(0,0,0,0.6)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg; g.fillRect(0, WALL, WW, 30);
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

  function drawWall() {
    const wg = g.createLinearGradient(0, 0, 0, WALL);
    wg.addColorStop(0, '#0d0616'); wg.addColorStop(0.6, '#1c0c2c'); wg.addColorStop(1, '#261238');
    g.fillStyle = wg; g.fillRect(0, 0, WW, WALL);
    // Paneele
    for (let x = 0; x < WW; x += 120) {
      g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(x + 8, 18, 104, WALL - 60);
      g.strokeStyle = 'rgba(255,201,74,0.12)'; g.lineWidth = 1.5; g.strokeRect(x + 8, 18, 104, WALL - 60);
    }
    // Holzvertäfelung unten
    const wd = g.createLinearGradient(0, WALL - 36, 0, WALL);
    wd.addColorStop(0, '#3a1a12'); wd.addColorStop(1, '#1a0a08');
    g.fillStyle = wd; g.fillRect(0, WALL - 36, WW, 36);
    g.fillStyle = '#c98a12'; g.fillRect(0, WALL - 38, WW, 2.5);
    // Neonstreifen oben
    const pulse = 0.75 + 0.25 * Math.sin(time * 1.5);
    g.shadowColor = '#ff3d8b'; g.shadowBlur = 14; g.fillStyle = `rgba(255,61,139,${pulse})`; g.fillRect(0, 6, WW, 3); g.shadowBlur = 0;
    // Schilder
    glowText('SLOTS', 330, 58, 34, '#ffc94a', 18, 'Bungee Inline');
    glowText('NEON NIGHTS', 1110, 50, 26, '#ff3d8b', 18, 'Bungee Inline');
    glowText('CASINO · SEIT 1987', 1110, 84, 11, '#3be8ff', 8);
    // Barregal
    const bx = 1255, bw = 430;
    g.fillStyle = '#12080c'; g.fillRect(bx, 16, bw, WALL - 50);
    const mirror = g.createLinearGradient(bx, 16, bx + bw, WALL - 34);
    mirror.addColorStop(0, 'rgba(59,232,255,0.10)'); mirror.addColorStop(0.5, 'rgba(255,255,255,0.05)'); mirror.addColorStop(1, 'rgba(157,92,255,0.10)');
    g.fillStyle = mirror; g.fillRect(bx + 6, 22, bw - 12, WALL - 62);
    const cols = ['#3be8ff', '#ff3d8b', '#ffc94a', '#5dffb0', '#9d5cff', '#ff8a3d'];
    [44, 84].forEach((sy, si) => {
      g.fillStyle = '#c98a12'; g.fillRect(bx + 6, sy + 22, bw - 12, 3);
      for (let i = 0; i < 16; i++) {
        const x = bx + 20 + i * 25 + (si ? 12 : 0), h = 14 + ((i * 7 + si * 3) % 3) * 4, c = cols[(i + si * 2) % cols.length];
        g.fillStyle = c; g.globalAlpha = 0.85;
        rr(x, sy + 22 - h, 9, h, 2); g.fill(); g.fillRect(x + 3, sy + 22 - h - 5, 3, 6);
        g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.fillRect(x + 1.5, sy + 24 - h, 1.5, h - 4); g.globalAlpha = 1;
      }
    });
    glowText('BAR', bx + bw / 2, 30, 18, '#3be8ff', 14);
    // Glücksrad an der Wand
    drawWallWheel(900, 82);
    // Kasse/Crash-Schild nicht an der Wand (stehen im Raum)
  }

  function drawWallWheel(cx, cy) {
    const R = 66, segs = CFG.wheel.segments, N = segs.length, rot = time * (Wheel.ready() ? 0.5 : 0.12);
    const ready = Wheel.ready();
    if (ready) { const gl = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.7); gl.addColorStop(0, `rgba(255,201,74,${0.35 + 0.15 * Math.sin(time * 4)})`); gl.addColorStop(1, 'rgba(255,201,74,0)'); g.fillStyle = gl; g.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4); }
    const ring = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, R + 7);
    ring.addColorStop(0, '#6a4000'); ring.addColorStop(0.5, '#ffd46a'); ring.addColorStop(1, '#5a3200');
    g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, R + 7, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < N; i++) {
      const a0 = rot + i * Math.PI * 2 / N, a1 = a0 + Math.PI * 2 / N;
      g.fillStyle = segs[i].c; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,220,140,0.8)'; g.lineWidth = 1.2; g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, on = (Math.floor(time * 6) + i) % 2 === 0;
      g.fillStyle = on ? '#fff6c8' : '#8a6a2a';
      g.beginPath(); g.arc(cx + Math.cos(a) * (R + 3.5), cy + Math.sin(a) * (R + 3.5), 2, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#2a0e3a'; g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd46a'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cx - 9, cy - R - 12); g.lineTo(cx + 9, cy - R - 12); g.lineTo(cx, cy - R + 4); g.closePath(); g.fill();
  }

  /* ---------- Zeichnen: Objekte ---------- */
  function shadowEllipse(x, y, rx, ry, a = 0.45) {
    g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }

  function drawSlot(o) {
    const { x, y } = o, w = 64, h = 124, c = o.th.c;
    shadowEllipse(x, y - 6, 42, 11);
    // Korpus
    const body = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#1a0f28'); body.addColorStop(0.2, '#3a2458'); body.addColorStop(0.5, '#2a1840'); body.addColorStop(1, '#0f0818');
    g.fillStyle = body; rr(x - w / 2, y - h, w, h - 4, 8); g.fill();
    g.fillStyle = '#0a0610'; g.fillRect(x - w / 2 + 3, y - 8, w - 6, 8);
    // Chromkanten
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5; rr(x - w / 2, y - h, w, h - 4, 8); g.stroke();
    // Aufsatz
    const tp = y - h - 22;
    g.fillStyle = sh(c, -90); rr(x - w / 2 + 2, tp, w - 4, 28, [12, 12, 4, 4]); g.fill();
    g.fillStyle = sh(c, -40); rr(x - w / 2 + 5, tp + 3, w - 10, 22, [10, 10, 3, 3]); g.fill();
    for (let i = 0; i < 9; i++) {
      const on = (Math.floor(time * 5 + o.seed * 3) + i) % 3 === 0;
      g.fillStyle = on ? '#fff6c8' : 'rgba(255,255,255,0.25)';
      g.beginPath(); g.arc(x - w / 2 + 8 + i * ((w - 16) / 8), tp + 2.5, 1.6, 0, Math.PI * 2); g.fill();
    }
    glowText(o.th.name, x, tp + 15, o.th.name.length > 6 ? 9 : 11, c, 10);
    // Bildschirm mit Mini-Walzen
    const sy = y - h + 12, sw = w - 14, shh = 34;
    g.fillStyle = '#05020a'; rr(x - sw / 2 - 2, sy - 2, sw + 4, shh + 4, 4); g.fill();
    const scr = g.createLinearGradient(0, sy, 0, sy + shh);
    scr.addColorStop(0, '#140a24'); scr.addColorStop(0.5, '#2e1a4c'); scr.addColorStop(1, '#140a24');
    g.fillStyle = scr; g.fillRect(x - sw / 2, sy, sw, shh);
    const cyc = Math.floor(time / 3.2 + o.seed);
    const spinning = ((time + o.seed) % 3.2) < 0.9;
    for (let i = 0; i < 3; i++) {
      const cx = x - sw / 2 + sw / 6 + i * sw / 3;
      const ids = ['cherry', 'bell', 'seven', 'lemon', 'diamond', 'clover', 'grape', 'wild'];
      const id = spinning && ((time + o.seed) % 3.2) < 0.4 + i * 0.2 ? ids[(Math.floor(time * 18) + i * 3) % ids.length] : (cyc % 4 === 0 ? o.th.syms[i] : ids[(cyc * 7 + i * 5 + Math.floor(o.seed * 3)) % ids.length]);
      g.drawImage(sprite(id, 18), cx - 9, sy + shh / 2 - 9, 18, 18);
    }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x - sw / 2, sy, sw, shh * 0.35);
    // Gewinnlinie
    g.fillStyle = hexA(c, 0.6); g.fillRect(x - sw / 2, sy + shh / 2 - 0.5, sw, 1);
    // Bedienpult
    const py = y - h + 54;
    g.fillStyle = '#1a1024'; g.beginPath(); g.moveTo(x - w / 2 + 2, py); g.lineTo(x + w / 2 - 2, py); g.lineTo(x + w / 2 + 3, py + 12); g.lineTo(x - w / 2 - 3, py + 12); g.closePath(); g.fill();
    [['#ff3d8b', -16], ['#ffc94a', 0], ['#5dffb0', 16]].forEach(([col, dx]) => {
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 6;
      g.beginPath(); g.ellipse(x + dx, py + 6, 5, 2.6, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    });
    // Unterteil mit Streifen & Münzschale
    g.fillStyle = hexA(c, 0.8); g.fillRect(x - w / 2 + 6, py + 20, w - 12, 3);
    g.fillStyle = 'rgba(255,255,255,0.06)'; rr(x - w / 2 + 8, py + 28, w - 16, 26, 4); g.fill();
    glowText('7', x, py + 41, 16, c, 8);
    g.fillStyle = '#05020a'; rr(x - 16, y - 20, 32, 9, 3); g.fill();
    g.fillStyle = '#ffc94a'; g.fillRect(x - 10, y - 15, 5, 2); g.fillRect(x + 2, y - 16, 6, 2);
    // Hebel
    g.strokeStyle = '#c9c2d6'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + w / 2, y - h + 56); g.lineTo(x + w / 2 + 7, y - h + 50); g.lineTo(x + w / 2 + 7, y - h + 24); g.stroke();
    g.fillStyle = '#e0103a'; g.beginPath(); g.arc(x + w / 2 + 7, y - h + 22, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x + w / 2 + 5.5, y - h + 20.5, 1.6, 0, Math.PI * 2); g.fill();
  }
  function hexA(hex, a) { return `rgba(${hexRgb(hex)},${a})`; }

  function drawStool(o) {
    const { x, y } = o;
    shadowEllipse(x, y, 14, 5, 0.4);
    g.fillStyle = '#8a8a9a'; g.fillRect(x - 1.5, y - 20, 3, 20);
    g.fillStyle = '#5a5a6a'; g.beginPath(); g.ellipse(x, y - 1, 9, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = sh(o.c, -80); g.beginPath(); g.ellipse(x, y - 21, 13, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = sh(o.c, -40); g.beginPath(); g.ellipse(x, y - 23, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(x - 3, y - 24.5, 5, 1.8, 0, 0, Math.PI * 2); g.fill();
  }

  function drawPlinkoCab(o) {
    const { x, y } = o, w = 88, h = 158;
    shadowEllipse(x, y - 6, 54, 13);
    const body = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#2a0a24'); body.addColorStop(0.3, '#5a1848'); body.addColorStop(1, '#16061a');
    g.fillStyle = body; rr(x - w / 2, y - h, w, h - 4, 10); g.fill();
    g.strokeStyle = 'rgba(255,120,190,0.35)'; g.lineWidth = 1.5; g.stroke();
    // Aufsatz
    g.fillStyle = '#3a0a2a'; rr(x - w / 2 - 4, y - h - 26, w + 8, 30, 12); g.fill();
    glowText('PLINKO', x, y - h - 11, 14, '#ff3d8b', 14);
    // Brett
    const bx = x - w / 2 + 8, by = y - h + 10, bw = w - 16, bh = 96;
    g.fillStyle = '#0c0418'; rr(bx, by, bw, bh, 6); g.fill();
    const rows = 7, s = bw / (rows + 2.2);
    for (let r = 0; r < rows; r++) for (let j = 0; j < r + 3; j++) {
      g.fillStyle = '#cbbcf5'; g.beginPath(); g.arc(x + (j - (r + 2) / 2) * s, by + 12 + r * s * 0.95, 1.4, 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k <= rows; k++) { const col = Plinko.binColor(k, rows); g.fillStyle = `rgb(${col.join(',')})`; g.fillRect(x + (k - rows / 2) * s - s * 0.4, by + bh - 12, s * 0.8, 7); }
    // fallende Kugel
    const T = 2.2, tt = (time % T) / T, row = tt * (rows + 1);
    const bxp = x + Math.sin(tt * 19) * s * Math.min(3, row * 0.5), byp = by + 6 + tt * (bh - 20);
    g.fillStyle = '#ff5fb0'; g.shadowColor = '#ff5fb0'; g.shadowBlur = 8; g.beginPath(); g.arc(bxp, byp, 2.6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(bx, by, bw, bh * 0.3);
    // Unterteil
    g.fillStyle = 'rgba(255,61,139,0.7)'; g.fillRect(x - w / 2 + 8, y - 44, w - 16, 3);
    glowText('BIS 1000×', x, y - 28, 10, '#ffc94a', 8);
  }

  function drawPodium(o) {
    const { x, y } = o, w = 168;
    shadowEllipse(x, y - 4, 90, 10, 0.4);
    g.fillStyle = '#1a0a1e'; rr(x - w / 2, y - 34, w, 30, 6); g.fill();
    const tg = g.createLinearGradient(0, y - 40, 0, y - 28);
    tg.addColorStop(0, '#5a2248'); tg.addColorStop(1, '#2a0a24');
    g.fillStyle = tg; rr(x - w / 2, y - 40, w, 12, 6); g.fill();
    g.fillStyle = '#c98a12'; g.fillRect(x - w / 2, y - 29, w, 2);
    glowText(Wheel.ready() ? 'GRATIS-DREH BEREIT' : 'BONUSRAD', x, y - 16, 10, '#ffc94a', 10);
  }

  function drawBar(o) {
    const { x, y } = o, w = 430, h = 58;
    shadowEllipse(x, y - 4, w / 2 + 10, 12, 0.4);
    // Front
    const fg = g.createLinearGradient(0, y - h, 0, y);
    fg.addColorStop(0, '#3a1a12'); fg.addColorStop(1, '#140806');
    g.fillStyle = fg; rr(x - w / 2, y - h + 12, w, h - 12, 6); g.fill();
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(255,201,74,0.08)'; g.fillRect(x - w / 2 + 14 + i * 52, y - h + 22, 40, h - 34); }
    // Neonstreifen
    g.shadowColor = '#3be8ff'; g.shadowBlur = 12; g.fillStyle = '#3be8ff'; g.fillRect(x - w / 2 + 4, y - 10, w - 8, 2.5); g.shadowBlur = 0;
    // Theke oben (Marmor)
    const tg = g.createLinearGradient(0, y - h - 16, 0, y - h + 14);
    tg.addColorStop(0, '#2c2438'); tg.addColorStop(1, '#171220');
    g.fillStyle = tg; rr(x - w / 2 - 6, y - h - 16, w + 12, 30, 8); g.fill();
    g.fillStyle = '#c98a12'; g.fillRect(x - w / 2 - 6, y - h + 12, w + 12, 2.5);
    // Gläser & Cocktails
    [[-150, '#ff3d8b'], [-60, '#ffc94a'], [40, '#5dffb0'], [130, '#3be8ff']].forEach(([dx, col]) => {
      g.fillStyle = hexA(col, 0.75); g.beginPath(); g.moveTo(x + dx - 7, y - h - 12); g.lineTo(x + dx + 7, y - h - 12); g.lineTo(x + dx, y - h - 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + dx, y - h - 2); g.lineTo(x + dx, y - h + 4); g.stroke();
    });
  }

  function drawRoulette(o) {
    const { x, y } = o, w = 320, d = 128;
    shadowEllipse(x, y - 8, w / 2 + 14, 22, 0.45);
    const top = y - d - 18;
    // Tischrand/Schürze
    g.fillStyle = '#2a1206'; rr(x - w / 2, top + 10, w, d + 8, 60); g.fill();
    // Tischplatte Holz
    const wood = g.createLinearGradient(0, top, 0, top + d);
    wood.addColorStop(0, '#7a4418'); wood.addColorStop(1, '#4a2208');
    g.fillStyle = wood; rr(x - w / 2, top, w, d, 58); g.fill();
    // Filz
    const felt = g.createRadialGradient(x, top + d / 2, 10, x, top + d / 2, w / 2);
    felt.addColorStop(0, '#1a7a6c'); felt.addColorStop(1, '#0c3e38');
    g.fillStyle = felt; rr(x - w / 2 + 10, top + 9, w - 20, d - 18, 50); g.fill();
    // Zahlenfeld
    const gx = x - 40, gy = top + 26, cw = 11, chh = 22;
    const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    g.fillStyle = '#1aa05a'; g.fillRect(gx - 12, gy, 11, chh * 3);
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      g.fillStyle = REDS.includes(n) ? '#b0142c' : '#14101c';
      g.fillRect(gx + c * cw, gy + r * chh, cw - 1, chh - 1);
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8; g.strokeRect(gx - 12, gy, 12 * cw + 12, chh * 3);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(gx, gy + chh * 3 + 4, 12 * cw, 10);
    // Chips auf dem Tisch
    [[gx + 30, gy + 20, '#2f7bff'], [gx + 70, gy + 50, '#f0a412'], [gx + 100, gy + 12, '#9b3dff']].forEach(([cx, cy, c]) => {
      for (let k = 0; k < 3; k++) { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy - k * 2, 5, 2.4, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 0.6; g.stroke(); }
    });
    // Kessel
    const wx = x - w / 2 + 62, wy = top + d / 2, R = 40;
    g.fillStyle = '#3a1a08'; g.beginPath(); g.ellipse(wx, wy + 3, R + 6, (R + 6) * 0.82, 0, 0, Math.PI * 2); g.fill();
    const wr = g.createRadialGradient(wx, wy, R * 0.6, wx, wy, R + 4);
    wr.addColorStop(0, '#2a1206'); wr.addColorStop(1, '#8a5020');
    g.fillStyle = wr; g.beginPath(); g.ellipse(wx, wy, R + 4, (R + 4) * 0.82, 0, 0, Math.PI * 2); g.fill();
    const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const rot = time * 0.7;
    g.save(); g.translate(wx, wy); g.scale(1, 0.82);
    for (let i = 0; i < 37; i++) {
      const a0 = rot + i * Math.PI * 2 / 37, a1 = a0 + Math.PI * 2 / 37, n = ORDER[i];
      g.fillStyle = n === 0 ? '#1aa05a' : REDS.includes(n) ? '#c0142c' : '#14101c';
      g.beginPath(); g.arc(0, 0, R, a0, a1); g.arc(0, 0, R * 0.62, a1, a0, true); g.closePath(); g.fill();
    }
    const cone = g.createRadialGradient(-4, -4, 2, 0, 0, R * 0.62);
    cone.addColorStop(0, '#d8a050'); cone.addColorStop(1, '#5a2c08');
    g.fillStyle = cone; g.beginPath(); g.arc(0, 0, R * 0.62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd46a'; g.lineWidth = 2.5;
    g.beginPath(); for (let k = 0; k < 4; k++) { const a = rot * 1 + k * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45); } g.stroke();
    g.fillStyle = '#ffd46a'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
    const ba = -time * 2.4;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(Math.cos(ba) * R * 0.85, Math.sin(ba) * R * 0.85, 2.6, 0, Math.PI * 2); g.fill();
    g.restore();
    // Schild
    glowText('ROULETTE', x + 60, top + d - 14, 11, '#5dffb0', 8);
  }

  function drawBlackjackTable(o) {
    const { x, y } = o, w = 240, d = 108, top = y - d - 16;
    shadowEllipse(x, y - 8, w / 2 + 10, 20, 0.45);
    const shape = (inset) => {
      g.beginPath();
      g.moveTo(x - w / 2 + inset, top + inset);
      g.lineTo(x + w / 2 - inset, top + inset);
      g.quadraticCurveTo(x + w / 2 - inset, top + d - inset, x, top + d - inset);
      g.quadraticCurveTo(x - w / 2 + inset, top + d - inset, x - w / 2 + inset, top + inset);
      g.closePath();
    };
    g.save(); g.translate(0, 12); shape(0); g.fillStyle = '#2a1206'; g.fill(); g.restore();
    shape(0); g.fillStyle = '#6a3a14'; g.fill();
    shape(9);
    const felt = g.createRadialGradient(x, top + 20, 10, x, top + 30, w / 2);
    felt.addColorStop(0, '#1a7a6c'); felt.addColorStop(1, '#0c3e38');
    g.fillStyle = felt; g.fill();
    g.strokeStyle = 'rgba(255,220,140,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, top + 12, w * 0.36, d * 0.55, 0, 0.35, Math.PI - 0.35); g.stroke();
    // Kartenplätze
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.2 + i * 0.15), cx = x + Math.cos(a) * w * 0.34, cy = top + 14 + Math.sin(a) * d * 0.62;
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.strokeRect(cx - 6, cy - 8, 12, 16);
      if (i % 2 === 0) { g.fillStyle = '#fff'; g.fillRect(cx - 5, cy - 7, 10, 14); g.fillStyle = i ? '#d0103a' : '#1b1330'; g.font = '8px serif'; g.textAlign = 'center'; g.fillText(i ? '♥' : '♠', cx, cy + 3); }
    }
    // Chip-Rack & Schlitten
    g.fillStyle = '#1a0a06'; g.fillRect(x - 40, top + 4, 80, 12);
    ['#2f7bff', '#1fbf6a', '#2a2238', '#9b3dff', '#f0a412'].forEach((c, i) => { g.fillStyle = c; g.fillRect(x - 38 + i * 16, top + 5, 13, 10); });
    g.fillStyle = '#2a1a10'; g.fillRect(x + 70, top + 6, 26, 18); g.fillStyle = '#e0206e'; g.fillRect(x + 73, top + 8, 20, 10);
    glowText('BLACKJACK', x, top + d * 0.62, 10, '#ffc94a', 6);
  }

  function drawDiceTable(o) {
    const { x, y } = o, w = 250, d = 112, top = y - d - 18;
    shadowEllipse(x, y - 8, w / 2 + 10, 20, 0.45);
    g.fillStyle = '#2a1206'; rr(x - w / 2, top + 12, w, d + 6, 26); g.fill();
    g.fillStyle = '#6a3a14'; rr(x - w / 2, top, w, d, 26); g.fill();
    g.fillStyle = '#3a1a08'; rr(x - w / 2 + 6, top + 6, w - 12, d - 12, 22); g.fill();
    const felt = g.createRadialGradient(x, top + d / 2, 10, x, top + d / 2, w / 2);
    felt.addColorStop(0, '#1d5ca0'); felt.addColorStop(1, '#0d2c50');
    g.fillStyle = felt; rr(x - w / 2 + 12, top + 12, w - 24, d - 24, 18); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2;
    g.strokeRect(x - 90, top + 26, 50, 40); g.strokeRect(x - 25, top + 26, 50, 40); g.strokeRect(x + 40, top + 26, 50, 40);
    g.font = '9px Bungee, Impact, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.textAlign = 'center';
    g.fillText(I18N.t('UNTER'), x - 65, top + 50); g.fillText('7', x, top + 50); g.fillText(I18N.t('ÜBER'), x + 65, top + 50);
    // tanzende Würfel
    const bounce = Math.abs(Math.sin(time * 2.2)) * 5;
    [[x - 18, '#fff'], [x + 10, '#fff']].forEach(([dx], i) => {
      const dy = top + 80 - bounce * (i ? 0.7 : 1);
      g.save(); g.translate(dx, dy); g.rotate(Math.sin(time * 1.3 + i) * 0.3);
      g.fillStyle = '#f4f0fa'; rr(-6, -6, 12, 12, 2.5); g.fill();
      g.fillStyle = '#d0103a';
      const pips = i ? [[-3, -3], [3, 3], [0, 0]] : [[-3, -3], [3, -3], [-3, 3], [3, 3]];
      pips.forEach(([px, py]) => { g.beginPath(); g.arc(px, py, 1.2, 0, Math.PI * 2); g.fill(); });
      g.restore();
    });
    glowText('WÜRFEL', x, top + 14, 9, '#ff8a3d', 6);
  }

  function drawBooth(o, kind) {
    const { x, y } = o, w = kind === 'crash' ? 160 : 130, h = kind === 'crash' ? 146 : 136;
    const col = o.glow;
    shadowEllipse(x, y - 6, w / 2 + 12, 13);
    const body = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#120a1c'); body.addColorStop(0.25, '#2e1c46'); body.addColorStop(1, '#0c0614');
    g.fillStyle = body; rr(x - w / 2, y - h, w, h - 4, 10); g.fill();
    g.strokeStyle = hexA(col, 0.45); g.lineWidth = 1.5; g.stroke();
    // Aufsatz
    g.fillStyle = sh(col, -110); rr(x - w / 2 - 3, y - h - 24, w + 6, 28, 10); g.fill();
    glowText(kind === 'crash' ? 'ROCKET CRASH' : 'MINES', x, y - h - 10, kind === 'crash' ? 12 : 14, col, 12);
    // Bildschirm
    const sx = x - w / 2 + 10, sy = y - h + 10, sw = w - 20, shh = 74;
    g.fillStyle = '#04020a'; rr(sx - 2, sy - 2, sw + 4, shh + 4, 5); g.fill();
    g.fillStyle = kind === 'crash' ? '#0a0620' : '#0a1224'; g.fillRect(sx, sy, sw, shh);
    g.save(); g.beginPath(); g.rect(sx, sy, sw, shh); g.clip();
    if (kind === 'crash') {
      const T = 6, tt = time % T, crashAt = 3.4 + (Math.floor(time / T) % 3) * 0.7;
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(sx + ((i * 37 - time * 20) % sw + sw) % sw, sy + (i * 23) % shh, 1.2, 1.2); }
      const tEnd = Math.min(tt, crashAt);
      g.strokeStyle = '#ff5d3d'; g.lineWidth = 2; g.shadowColor = '#ff5d3d'; g.shadowBlur = 8;
      g.beginPath();
      let px = sx, py = sy + shh - 6;
      for (let k = 0; k <= 30; k++) { const tk = tEnd * k / 30; px = sx + 4 + tk / crashAt * (sw - 20); py = sy + shh - 6 - (Math.exp(tk * 0.55) - 1) / (Math.exp(crashAt * 0.55) - 1) * (shh - 20); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.shadowBlur = 0;
      if (tt < crashAt) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px + 6, py - 3); g.lineTo(px - 3, py - 6); g.lineTo(px - 1, py + 2); g.closePath(); g.fill(); g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(px - 4, py, 2.5, 0, Math.PI * 2); g.fill(); }
      const m = Math.exp(tEnd * 0.28);
      g.font = '14px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillStyle = tt < crashAt ? '#fff' : '#ff5d6c';
      g.fillText(tt < crashAt ? m.toFixed(2).replace('.', U.dec()) + '×' : 'CRASH!', x, sy + 22);
    } else {
      const n = 5, cs = Math.min(sw, shh) / (n + 0.6), gx = x - cs * n / 2, gy = sy + (shh - cs * n) / 2;
      const round = Math.floor(time / 4), step = (time % 4) / 4;
      for (let i = 0; i < n * n; i++) {
        const r = (i / n) | 0, c = i % n, open = ((i * 7 + round * 5) % 25) / 25 < step * 0.8;
        const bomb = (i * 11 + round * 3) % 25 === 0 && step > 0.85;
        g.fillStyle = open ? (bomb ? '#ff3d5d' : '#123a5a') : '#2a3a5a';
        rr(gx + c * cs + 1, gy + r * cs + 1, cs - 2, cs - 2, 2); g.fill();
        if (open && !bomb) { g.fillStyle = '#3be8ff'; g.beginPath(); g.moveTo(gx + c * cs + cs / 2, gy + r * cs + 3); g.lineTo(gx + c * cs + cs - 4, gy + r * cs + cs / 2); g.lineTo(gx + c * cs + cs / 2, gy + r * cs + cs - 3); g.lineTo(gx + c * cs + 4, gy + r * cs + cs / 2); g.closePath(); g.fill(); }
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(sx, sy, sw, shh * 0.3);
    g.restore();
    // Pult
    const py = y - h + 92;
    g.fillStyle = '#1a1024'; g.beginPath(); g.moveTo(x - w / 2 + 4, py); g.lineTo(x + w / 2 - 4, py); g.lineTo(x + w / 2 + 2, py + 14); g.lineTo(x - w / 2 - 2, py + 14); g.closePath(); g.fill();
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; rr(x - 22, py + 4, 44, 6, 3); g.fill(); g.shadowBlur = 0;
    g.fillStyle = hexA(col, 0.7); g.fillRect(x - w / 2 + 10, y - 26, w - 20, 2.5);
  }

  function drawScratch(o) {
    const { x, y } = o, w = 166, h = 104;
    shadowEllipse(x, y - 6, w / 2 + 10, 12);
    g.fillStyle = '#2a1206'; rr(x - w / 2, y - 50, w, 46, 6); g.fill();
    const tg = g.createLinearGradient(0, y - 62, 0, y - 46);
    tg.addColorStop(0, '#4a2a18'); tg.addColorStop(1, '#2a1206');
    g.fillStyle = tg; rr(x - w / 2 - 4, y - 62, w + 8, 16, 5); g.fill();
    g.fillStyle = '#c98a12'; g.fillRect(x - w / 2 - 4, y - 47, w + 8, 2);
    // Aufsteller mit Losen
    g.fillStyle = '#1a0a1e'; rr(x - w / 2 + 12, y - h - 18, w - 24, 58, 6); g.fill();
    const cols = ['#ff3d8b', '#ffc94a', '#3be8ff', '#5dffb0', '#9d5cff'];
    for (let i = 0; i < 5; i++) {
      const cx = x - w / 2 + 22 + i * 26, cy = y - h - 10 + (i % 2) * 4;
      g.save(); g.translate(cx + 10, cy + 18); g.rotate((i - 2) * 0.06);
      g.fillStyle = cols[i]; rr(-10, -18, 20, 32, 3); g.fill();
      g.fillStyle = 'rgba(200,200,215,0.9)'; rr(-7, -6, 14, 14, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-8, -16, 16, 3);
      g.restore();
    }
    glowText('RUBBELLOSE', x, y - h - 30, 13, '#ffc94a', 12);
    glowText('SOFORT GEWINNEN', x, y - 30, 8, '#ff3d8b', 6);
  }

  function drawCashier(o) {
    const { x, y } = o, w = 206, h = 118;
    shadowEllipse(x, y - 6, w / 2 + 10, 12);
    // Rückwand mit Glas
    g.fillStyle = '#16101e'; rr(x - w / 2, y - h, w, h - 50, 6); g.fill();
    g.fillStyle = 'rgba(157,92,255,0.18)';
    for (let i = 0; i < 3; i++) { rr(x - w / 2 + 10 + i * 65, y - h + 26, 56, 36, 4); g.fill(); }
    glowText('KASSE · PROFIL', x, y - h + 13, 12, '#9d5cff', 12);
    // Theke
    const fg = g.createLinearGradient(0, y - 54, 0, y);
    fg.addColorStop(0, '#3a1a4a'); fg.addColorStop(1, '#140a1a');
    g.fillStyle = fg; rr(x - w / 2, y - 54, w, 50, 6); g.fill();
    g.fillStyle = '#c98a12'; g.fillRect(x - w / 2, y - 56, w, 3);
    g.fillStyle = '#ffc94a';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x - 40 + i * 12, y - 60 - i * 1.5, 6, 2.5, 0, 0, Math.PI * 2); g.fill(); }
    g.shadowColor = '#9d5cff'; g.shadowBlur = 10; g.fillStyle = '#9d5cff'; g.fillRect(x - w / 2 + 4, y - 10, w - 8, 2); g.shadowBlur = 0;
  }

  function drawPillar(o) {
    const { x, y } = o, w = 36, h = 150;
    shadowEllipse(x, y - 4, 26, 8);
    const pg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    pg.addColorStop(0, '#1a0c20'); pg.addColorStop(0.35, '#4a2a52'); pg.addColorStop(0.55, '#2e1636'); pg.addColorStop(1, '#0e0612');
    g.fillStyle = pg; g.fillRect(x - w / 2, y - h, w, h - 4);
    g.fillStyle = '#c98a12'; g.fillRect(x - w / 2 - 3, y - 14, w + 6, 10); g.fillRect(x - w / 2 - 3, y - h - 4, w + 6, 10);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x - w / 2 - 3, y - 14, w + 6, 2);
    const a = 0.6 + 0.4 * Math.sin(time * 2 + x);
    g.shadowColor = '#ff3d8b'; g.shadowBlur = 14; g.fillStyle = `rgba(255,61,139,${a})`; g.fillRect(x - w / 2, y - h + 30, w, 3); g.fillRect(x - w / 2, y - 44, w, 3); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x - w / 2 + 8, y - h + 10, 4, h - 30);
  }

  function drawPlant(o) {
    const { x, y } = o;
    shadowEllipse(x, y - 2, 20, 6);
    const pot = g.createLinearGradient(x - 14, 0, x + 14, 0);
    pot.addColorStop(0, '#6a4000'); pot.addColorStop(0.4, '#ffd46a'); pot.addColorStop(1, '#6a4000');
    g.fillStyle = pot; g.beginPath(); g.moveTo(x - 15, y - 28); g.lineTo(x + 15, y - 28); g.lineTo(x + 11, y - 2); g.lineTo(x - 11, y - 2); g.closePath(); g.fill();
    g.fillStyle = '#2a1406'; g.beginPath(); g.ellipse(x, y - 28, 15, 4, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.36 + Math.sin(time * 0.8 + i + o.v) * 0.04, len = 36 + (i % 3) * 8;
      const ex = x + Math.cos(a) * len, ey = y - 30 + Math.sin(a) * len * 0.9;
      g.strokeStyle = i % 2 ? '#2a8a3a' : '#3fb04a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y - 30); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y - 30 + Math.sin(a) * len * 0.3 - 12, ex, ey); g.stroke();
      g.strokeStyle = 'rgba(160,255,140,0.35)'; g.lineWidth = 1.2; g.stroke();
    }
  }

  function drawPost(o) {
    const { x, y } = o;
    shadowEllipse(x, y, 9, 3.5);
    g.fillStyle = '#c98a12'; g.fillRect(x - 2, y - 32, 4, 30);
    g.beginPath(); g.ellipse(x, y - 2, 7, 2.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(x, y - 34, 4, 0, Math.PI * 2); g.fill();
  }
  function drawRopes() {
    const pairs = [[[820, 1560], [820, 1450]], [[980, 1560], [980, 1450]]];
    g.strokeStyle = '#a0103a'; g.lineWidth = 4; g.lineCap = 'round';
    pairs.forEach(([a, b]) => { g.beginPath(); g.moveTo(a[0], a[1] - 30); g.quadraticCurveTo(a[0] + 8, (a[1] + b[1]) / 2 - 18, b[0], b[1] - 30); g.stroke(); });
  }


  function drawVPoker(o) {
    const { x, y } = o, w = 64, h = 124;
    shadowEllipse(x, y - 6, 42, 11);
    const body = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#0c1433'); body.addColorStop(0.25, '#23408a'); body.addColorStop(0.55, '#16285a'); body.addColorStop(1, '#070c20');
    g.fillStyle = body; rr(x - w / 2, y - h, w, h - 4, 8); g.fill();
    g.strokeStyle = 'rgba(59,232,255,0.35)'; g.lineWidth = 1.5; rr(x - w / 2, y - h, w, h - 4, 8); g.stroke();
    g.fillStyle = '#0a1438'; rr(x - w / 2 + 2, y - h - 20, w - 4, 24, [10, 10, 3, 3]); g.fill();
    glowText('POKER', x, y - h - 8, 10, '#3be8ff', 10);
    // Bildschirm mit fünf Karten
    const sx = x - w / 2 + 6, sy = y - h + 10, sw = w - 12, shh = 40;
    g.fillStyle = '#0a1a6a'; rr(sx, sy, sw, shh, 3); g.fill();
    g.fillStyle = 'rgba(255,226,122,0.8)'; for (let i = 0; i < 3; i++) g.fillRect(sx + 4, sy + 4 + i * 4, sw - 8, 1.5);
    const held = Math.floor(time * 0.8 + o.seed) % 5;
    for (let i = 0; i < 5; i++) {
      const cx = sx + 3 + i * (sw - 6) / 5, cy = sy + 18 - (i === held ? 2 : 0);
      g.fillStyle = '#fff'; rr(cx, cy, (sw - 6) / 5 - 1.5, 17, 1.5); g.fill();
      g.fillStyle = i % 2 ? '#d0103a' : '#1b1330'; g.font = '7px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['♠', '♥', '♣', '♦', '♠'][i], cx + (sw - 6) / 10, cy + 9);
    }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(sx, sy, sw, shh * 0.35);
    const py = y - h + 58;
    g.fillStyle = '#0c1433'; g.beginPath(); g.moveTo(x - w / 2 + 2, py); g.lineTo(x + w / 2 - 2, py); g.lineTo(x + w / 2 + 3, py + 12); g.lineTo(x - w / 2 - 3, py + 12); g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 4 ? '#ffc94a' : '#3be8ff'; g.shadowColor = g.fillStyle; g.shadowBlur = 5; rr(x - 26 + i * 11, py + 3, 8, 5, 1.5); g.fill(); }
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(59,232,255,0.8)'; g.fillRect(x - w / 2 + 6, py + 22, w - 12, 2.5);
    glowText('J+', x, py + 40, 16, '#ffc94a', 8);
  }

  function drawKeno(o) {
    const { x, y } = o, w = 160, h = 140;
    shadowEllipse(x, y - 6, w / 2 + 12, 13);
    const body = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#140a24'); body.addColorStop(0.3, '#3a2466'); body.addColorStop(1, '#0c0616');
    g.fillStyle = body; rr(x - w / 2, y - h, w, h - 4, 10); g.fill();
    g.strokeStyle = 'rgba(157,92,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#2a1050'; rr(x - w / 2 - 3, y - h - 24, w + 6, 28, 10); g.fill();
    glowText('NEON KENO', x, y - h - 10, 13, '#c9a8ff', 12);
    const bx = x - w / 2 + 10, by = y - h + 10, bw = w - 20, bh = 70, cw = bw / 8, ch = bh / 5;
    g.fillStyle = '#06030c'; rr(bx - 2, by - 2, bw + 4, bh + 4, 4); g.fill();
    const round = Math.floor(time / 5);
    for (let i = 0; i < 40; i++) {
      const c = i % 8, r = (i / 8) | 0, lit = ((i * 13 + round * 7) % 40) < 10 && ((time % 5) > (i % 10) * 0.35);
      g.fillStyle = lit ? '#ffc94a' : '#2e2250';
      rr(bx + c * cw + 1, by + r * ch + 1, cw - 2, ch - 2, 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(bx, by, bw, bh * 0.3);
    const py = y - h + 92;
    g.fillStyle = '#1a1024'; g.beginPath(); g.moveTo(x - w / 2 + 4, py); g.lineTo(x + w / 2 - 4, py); g.lineTo(x + w / 2 + 2, py + 14); g.lineTo(x - w / 2 - 2, py + 14); g.closePath(); g.fill();
    // Kugeln in der Glaskuppel
    for (let i = 0; i < 6; i++) { const a = time * 3 + i; g.fillStyle = ['#ff3d8b', '#ffc94a', '#3be8ff'][i % 3]; g.beginPath(); g.arc(x + Math.cos(a) * 16, py + 30 + Math.sin(a * 1.3) * 5, 3.5, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, py + 30, 26, 11, 0, 0, Math.PI * 2); g.stroke();
  }

  function drawHiloTable(o) {
    const { x, y } = o, w = 190, d = 88, top = y - d - 14;
    shadowEllipse(x, y - 6, w / 2 + 8, 16, 0.45);
    g.fillStyle = '#2a1206'; g.beginPath(); g.ellipse(x, top + d / 2 + 10, w / 2, d / 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a3a14'; g.beginPath(); g.ellipse(x, top + d / 2, w / 2, d / 2, 0, 0, Math.PI * 2); g.fill();
    const felt = g.createRadialGradient(x, top + d / 2 - 6, 5, x, top + d / 2, w / 2);
    felt.addColorStop(0, '#1d7a6c'); felt.addColorStop(1, '#0c3e38');
    g.fillStyle = felt; g.beginPath(); g.ellipse(x, top + d / 2, w / 2 - 9, d / 2 - 8, 0, 0, Math.PI * 2); g.fill();
    // große Karte + Pfeile
    g.fillStyle = '#fff'; rr(x - 11, top + 24, 22, 32, 3); g.fill();
    g.fillStyle = '#d0103a'; g.font = '700 13px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['7', 'Q', '3', 'K', '9'][Math.floor(time / 1.5) % 5], x, top + 40);
    g.fillStyle = '#5dffb0'; g.beginPath(); g.moveTo(x + 36, top + 26); g.lineTo(x + 46, top + 40); g.lineTo(x + 26, top + 40); g.closePath(); g.fill();
    g.fillStyle = '#ff5d6c'; g.beginPath(); g.moveTo(x - 36, top + 56); g.lineTo(x - 46, top + 42); g.lineTo(x - 26, top + 42); g.closePath(); g.fill();
    glowText('HI-LO', x, top + d - 14, 10, '#5dffb0', 6);
  }

  function drawBaccaratTable(o) {
    const { x, y } = o, w = 290, d = 116, top = y - d - 16;
    shadowEllipse(x, y - 8, w / 2 + 12, 20, 0.45);
    g.fillStyle = '#2a1206'; rr(x - w / 2, top + 12, w, d + 6, 58); g.fill();
    g.fillStyle = '#6a3a14'; rr(x - w / 2, top, w, d, 56); g.fill();
    const felt = g.createRadialGradient(x, top + d / 2, 10, x, top + d / 2, w / 2);
    felt.addColorStop(0, '#8a1f40'); felt.addColorStop(1, '#4a0a22');
    g.fillStyle = felt; rr(x - w / 2 + 10, top + 9, w - 20, d - 18, 48); g.fill();
    g.strokeStyle = 'rgba(255,220,140,0.45)'; g.lineWidth = 1.2;
    [['SPIELER', -70, '#9ad0ff'], ['BANK', 70, '#ff9aaa']].forEach(([t, dx, c]) => {
      g.beginPath(); g.ellipse(x + dx, top + 50, 40, 20, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = c; g.font = `${Math.max(8, 10.5 / zoom)}px Bungee, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(I18N.t(t), x + dx, top + 50);
    });
    g.beginPath(); g.ellipse(x, top + 80, 30, 12, 0, 0, Math.PI * 2); g.stroke();
    [[x - 90, top + 26], [x - 76, top + 24], [x + 60, top + 24], [x + 74, top + 26]].forEach(([cx, cy]) => { g.fillStyle = '#fff'; rr(cx, cy - 16, 11, 15, 1.5); g.fill(); });
    glowText('BACCARAT', x, top + d - 14, 10, '#ffc94a', 6);
  }

  function drawDoor(o) {
    // wird in drawBottomWall gezeichnet
  }

  function drawBottomWall() {
    const y0 = WH - BOTTOM;
    const wg = g.createLinearGradient(0, y0, 0, WH);
    wg.addColorStop(0, '#2a1438'); wg.addColorStop(1, '#0d0616');
    g.fillStyle = wg; g.fillRect(0, y0, WW, BOTTOM);
    g.fillStyle = '#c98a12'; g.fillRect(0, y0, WW, 3);
    // Glastüren
    const dx = 820, dw = 160;
    const gl = g.createLinearGradient(dx, 0, dx + dw, 0);
    gl.addColorStop(0, 'rgba(59,232,255,0.25)'); gl.addColorStop(0.5, 'rgba(160,240,255,0.45)'); gl.addColorStop(1, 'rgba(59,232,255,0.25)');
    g.fillStyle = gl; g.fillRect(dx, y0, dw, BOTTOM);
    g.fillStyle = '#c98a12'; g.fillRect(dx - 4, y0, 4, BOTTOM); g.fillRect(dx + dw, y0, 4, BOTTOM); g.fillRect(dx + dw / 2 - 1.5, y0, 3, BOTTOM);
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(dx + 20, y0 + 8); g.lineTo(dx + 40, y0 + 36); g.moveTo(dx + dw - 50, y0 + 8); g.lineTo(dx + dw - 30, y0 + 36); g.stroke();
    glowText('AUSGANG', 900, y0 - 14, 12, '#3be8ff', 10);
  }

  const DRAW = { vpoker: drawVPoker, keno: drawKeno, hilo: drawHiloTable, baccarat: drawBaccaratTable, door: drawDoor, slot: drawSlot, stool: drawStool, plinko: drawPlinkoCab, podium: drawPodium, bar: drawBar, roulette: drawRoulette,
    blackjack: drawBlackjackTable, dice: drawDiceTable, crash: o => drawBooth(o, 'crash'), mines: o => drawBooth(o, 'mines'),
    scratch: drawScratch, cashier: drawCashier, pillar: drawPillar, plant: drawPlant, post: drawPost };

  function drawChar(ch, isPlayer) {
    Avatar.draw(g, ch.x, ch.y, ch.a || avatar, ch.dir, ch.phase, ch.moving, ch.opts || {});
    if (isPlayer) {
      const name = (avatar.name || 'Gast').slice(0, 14);
      g.font = '600 11px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(name).width + 14;
      g.fillStyle = 'rgba(10,4,20,0.75)'; rr(ch.x - tw / 2, ch.y - 88, tw, 17, 8.5); g.fill();
      g.strokeStyle = 'rgba(255,201,74,0.6)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#ffe7a0'; g.fillText(name, ch.x, ch.y - 79.5);
      // Markierung am Boden
      g.strokeStyle = `rgba(255,201,74,${0.5 + 0.3 * Math.sin(time * 4)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(ch.x, ch.y, 17, 6.5, 0, 0, Math.PI * 2); g.stroke();
    }
  }

  function drawHighlight(o) {
    // Leuchtender Bodenring am Interaktionspunkt
    const a = 0.55 + 0.35 * Math.sin(time * 5);
    g.strokeStyle = hexA(o.glow || '#ffc94a', a); g.lineWidth = 2.5; g.shadowColor = o.glow; g.shadowBlur = 12;
    g.beginPath(); g.ellipse(o.ix, o.iy, 30, 10, 0, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  }

  function drawPathMarker() {
    if (!player.path || !player.path.length) return;
    const p = player.path[player.path.length - 1];
    const a = 0.5 + 0.4 * Math.sin(time * 8);
    g.strokeStyle = `rgba(59,232,255,${a})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(p.x, p.y, 10, 4, 0, 0, Math.PI * 2); g.stroke();
  }

  function render() {
    g.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
    g.fillStyle = '#07030c'; g.fillRect(camX - 50, camY - 50, W / zoom + 100, H / zoom + 100);
    drawWall();
    drawFloor();
    if (near) drawHighlight(near);
    drawPathMarker();
    drawRopes();
    // Tiefensortierung
    const list = [];
    for (const o of objects) list.push({ y: o.sortY, f: () => DRAW[o.kind](o) });
    for (const d of dealers) list.push({ y: d.y, f: () => drawChar(d) });
    for (const n of guests) list.push({ y: n.y, f: () => drawChar(n) });
    list.push({ y: player.y, f: () => drawChar(player, true) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f();
    drawBottomWall();
    // Licht
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(5,2,10,0)'); vg.addColorStop(1, 'rgba(5,2,10,0.7)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  function renderMini() {
    if (mini.offsetParent === null) return;
    const mw = mini.width, mh = mini.height, k = mw / WW;
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.fillStyle = 'rgba(12,6,20,0.92)'; mg.fillRect(0, 0, mw, mh);
    mg.fillStyle = '#2a0c2a'; mg.fillRect(0, WALL * k, mw, mh - WALL * k);
    for (const o of objects) {
      if (!o.fw || o.kind === 'post') continue;
      mg.fillStyle = o.game ? (o.glow || '#fff') : 'rgba(255,255,255,0.25)';
      mg.globalAlpha = o.game ? 0.85 : 0.5;
      const q = rectOf(o); mg.fillRect(q.x * k, (q.y - 10) * k, Math.max(3, q.w * k), Math.max(3, q.h * k + 10 * k));
    }
    mg.globalAlpha = 1;
    mg.strokeStyle = 'rgba(255,255,255,0.4)'; mg.lineWidth = 1;
    mg.strokeRect(camX * k, camY * k, W / zoom * k, H / zoom * k);
    mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(player.x * k, player.y * k, 3.5, 0, Math.PI * 2); mg.fill();
    mg.strokeStyle = '#ffc94a'; mg.lineWidth = 1.5; mg.stroke();
  }

  function updateCamera(snap) {
    const vw = W / zoom, vh = H / zoom;
    const tx = U.clamp(player.x - vw / 2, 0, Math.max(0, WW - vw));
    // Nahe der Rückwand ganz nach oben schauen, damit Schilder vollständig sichtbar sind
    const ty = player.y < WALL + 240 ? 0 : U.clamp(player.y - vh * 0.6, 0, Math.max(0, WH - vh));
    if (snap) { camX = tx; camY = ty; } else { camX += (tx - camX) * 0.12; camY += (ty - camY) * 0.12; }
    if (vw > WW + 80) camX = (WW - vw) / 2;
  }

  function updatePrompt() {
    if (!near) { promptEl.hidden = true; promptEl.__for = null; actionBtn.disabled = true; if (actionBtn.__lbl !== 'Aktion') { actionBtn.__lbl = 'Aktion'; actionBtn.querySelector('b').textContent = 'Aktion'; } return; }
    promptEl.hidden = false;
    if (promptEl.__for !== near) {
      promptEl.__for = near; promptName.textContent = near.label; $('#floorPromptSub').textContent = near.sub || '';
      promptKey.textContent = near.game === 'bar' ? 'bestellen' : near.game === 'lobby' ? 'öffnen' : near.game === 'exit' ? 'hinausgehen' : 'spielen';
    }
    const sx = (near.x - camX) * zoom, sy = (near.y - (near.vh || 60) - 60 - camY) * zoom;
    promptEl.style.transform = `translate(${Math.round(U.clamp(sx, 110, W - 110))}px, ${Math.round(Math.max(promptEl.offsetHeight + 12, sy))}px) translate(-50%, -100%)`;
    actionBtn.disabled = false;
    const al = near.game === 'bar' ? 'Bestellen' : near.game === 'lobby' ? 'Öffnen' : near.game === 'exit' ? 'Raus' : 'Spielen';
    if (actionBtn.__lbl !== al) { actionBtn.__lbl = al; actionBtn.querySelector('b').textContent = al; }
  }

  function loop(now) {
    if (!active) { raf = null; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; time += dt; frame++;
    updatePlayer(dt); updateGuests(dt);
    for (const d of dealers) d.phase += dt * 2;
    updateCamera(false);
    render();
    if (frame % 6 === 0) renderMini();
    updatePrompt();
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    const r = view.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(window.innerHeight - r.top);
    if (W < 10 || H < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    view.style.height = H + 'px';
    zoom = U.clamp(Math.min(W / 1150, H / 760), 0.74, 1.3);
    const md = window.innerWidth < 720 ? 92 : 170;
    mini.width = md; mini.height = Math.round(md * WH / WW);
    updateCamera(true);
    Symbols.clear();
  }

  /* ---------- Eingaben ---------- */
  function screenToWorld(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / zoom + camX, y: (cy - r.top) / zoom + camY };
  }
  function hitObject(p) {
    let best = null;
    for (const o of interactives) {
      const hw = Math.max(o.fw, 60) / 2 + 6, top = o.y - (o.vh || 60) - (o.kind === 'podium' ? 170 : 30);
      if (p.x > o.x - hw && p.x < o.x + hw && p.y > top && p.y < o.y + 10) { if (!best || o.sortY > best.sortY) best = o; }
    }
    return best;
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && joy.id !== null) return;
    Sfx.init();
    const p = screenToWorld(e.clientX, e.clientY);
    const o = hitObject(p);
    if (o) {
      if (near === o && Math.hypot(player.x - o.ix, player.y - o.iy) < 60) { interact(o); return; }
      player.path = findPath(player.x, player.y, o.ix, o.iy); pendingInteract = o;
    } else { player.path = findPath(player.x, player.y, p.x, p.y); pendingInteract = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const o = hitObject(screenToWorld(e.clientX, e.clientY));
    canvas.style.cursor = o ? 'pointer' : 'default';
  });

  // Joystick
  joyEl.addEventListener('pointerdown', e => {
    e.preventDefault(); Sfx.init();
    joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId);
    const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
    moveJoy(e);
  });
  function moveJoy(e) {
    if (e.pointerId !== joy.id) return;
    const R = joyEl.clientWidth / 2;
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    joy.dx = dx / R; joy.dy = dy / R;
    if (Math.hypot(joy.dx, joy.dy) < 0.18) { joy.dx = joy.dy = 0; }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  joyEl.addEventListener('pointermove', moveJoy);
  const endJoy = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.dx = joy.dy = 0; knobEl.style.transform = ''; };
  joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
  actionBtn.addEventListener('click', () => interact(near));
  promptEl.addEventListener('click', () => interact(near));

  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('resize', () => { if (active) resize(); });

  buildGrid();
  if (Store.s.floorPos) { const p = Store.s.floorPos; if (!collides(p.x, p.y)) { player.x = p.x; player.y = p.y; } }

  return {
    show() {
      active = true; avatar = Avatar.load();
      if (!carpet) buildCarpet();
      requestAnimationFrame(() => { resize(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } });
      Sfx.ambient && Sfx.ambient(true);
    },
    hide() { active = false; keys.clear(); Sfx.ambient && Sfx.ambient(false); },
    key(e) {
      const move = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
      if (move.includes(e.code)) { e.preventDefault(); keys.add(e.code); return true; }
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (near) interact(near); return true; }
      return false;
    },
    // Figur neben ein Spiel stellen (Schnellreise)
    placeAt(game) {
      const o = interactives.find(x => x.game === game);
      if (o) { player.x = o.ix; player.y = o.iy + 6; player.dir = 3; player.path = null; Store.s.floorPos = { x: player.x, y: player.y }; Store.save(); }
    },
    refreshAvatar() { avatar = Avatar.load(); },
    get games() { return interactives; },
  };
})();

/* ---------- Bar: kleine Belohnung ---------- */
const Bar = (() => {
  const DRINKS = ['Neon Colada', 'Lucky Lime', 'Jackpot Julep', 'Midnight Mojito', 'Cherry Sevens', 'Blue Diamond'];
  return {
    order() {
      const now = Date.now(), last = Store.s.lastDrink || 0;
      if (now - last < 3 * 60 * 1000) {
        const s = Math.ceil((3 * 60 * 1000 - (now - last)) / 1000);
        Toast.show('Bar', `Dein nächster Drink ist in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} fertig.`, '♪');
        return;
      }
      Store.s.lastDrink = now;
      const d = U.pick(DRINKS), tip = U.pick([25, 50, 50, 75, 100]);
      Store.credit(tip);
      Sfx.win(1);
      Toast.show(d + ' aufs Haus!', `Der Barkeeper steckt dir ${tip} Münzen zu.`, '♪', 'ach');
    },
  };
})();

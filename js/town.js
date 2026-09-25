'use strict';
/* ============================================================
   Die Stadt: fünf begrenzte Orte, Bus-Reisen, Läden und Katze Mimi.
   Geld verdient man nur im Casino – hier wird es ausgegeben.
   ============================================================ */
const Town = (() => {
  const canvas = $('#townCanvas'), g = canvas.getContext('2d');
  const view = $('#view-town');
  const promptEl = $('#townPrompt'), promptName = $('#townPromptName'), promptSub = $('#townPromptSub'), promptKey = $('#townPromptKey');
  const actionBtn = $('#townAction'), joyEl = $('#townJoy'), knobEl = $('#townKnob'), zoneEl = $('#townZone');
  const CELL = 20, PR = 11;
  let W = 0, H = 0, dpr = 1, zoom = 1, camX = 0, camY = 0;
  let active = false, raf = null, last = 0, time = 0, frame = 0, lock = false;
  let near = null, pendingInteract = null, stepAcc = 0;
  const keys = new Set();
  const joy = { id: null, dx: 0, dy: 0, cx: 0, cy: 0 };
  const player = { x: 0, y: 0, dir: 0, phase: 0, moving: false, path: null, speed: 200, alpha: 1, pose: null };
  let avatar = Avatar.load();
  let Z = null; // aktueller Ort
  const bus = { x: -9999, state: 'gone', t: 0, doors: 0 };

  /* ---------- Hilfen ---------- */
  function rr(x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  const sh = Avatar.shade;
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
  const hexA = (h, a) => `rgba(${hexRgb(h)},${a})`;
  function sign(txt, x, y, size, color, blur = 12, font = 'Bungee') {
    txt = I18N.t(txt); size = Math.max(size, 10.5 / zoom);
    g.font = `${size}px "${font}", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = blur; g.fillStyle = '#fff'; g.fillText(txt, x, y);
    g.shadowBlur = blur * 0.5; g.fillStyle = color; g.globalAlpha = 0.35; g.fillText(txt, x, y); g.globalAlpha = 1; g.shadowBlur = 0;
  }
  function shadow(x, y, rx, ry, a = 0.4) { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function pool(x, y, r, rgb, a) {
    const pg = g.createRadialGradient(x, y, 0, x, y, r);
    pg.addColorStop(0, `rgba(${rgb},${a})`); pg.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = pg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const rnd = seed => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

  /* ---------- Muster ---------- */
  const patterns = {};
  function pat(name, T, paint) {
    if (patterns[name]) return patterns[name];
    const c = document.createElement('canvas'); c.width = c.height = T;
    paint(c.getContext('2d'), T);
    return (patterns[name] = g.createPattern(c, 'repeat'));
  }
  const grassPat = () => pat('grass', 96, (t, T) => {
    t.fillStyle = '#1f4a2c'; t.fillRect(0, 0, T, T);
    const r = rnd(7);
    for (let i = 0; i < 260; i++) { t.fillStyle = r() < 0.5 ? 'rgba(90,170,90,0.25)' : 'rgba(10,40,20,0.35)'; t.fillRect(r() * T, r() * T, 1.5, 3 + r() * 3); }
  });
  const pavePat = () => pat('pave', 48, (t, T) => {
    t.fillStyle = '#4a4458'; t.fillRect(0, 0, T, T);
    t.strokeStyle = 'rgba(20,16,30,0.55)'; t.lineWidth = 1.5;
    for (let y = 0; y <= T; y += 24) { t.beginPath(); t.moveTo(0, y); t.lineTo(T, y); t.stroke(); }
    for (let row = 0; row < 2; row++) for (let x = row * 12; x <= T; x += 24) { t.beginPath(); t.moveTo(x, row * 24); t.lineTo(x, row * 24 + 24); t.stroke(); }
    const r = rnd(3); for (let i = 0; i < 80; i++) { t.fillStyle = `rgba(255,255,255,${r() * 0.05})`; t.fillRect(r() * T, r() * T, 2, 2); }
  });
  const plazaPat = () => pat('plaza', 80, (t, T) => {
    t.fillStyle = '#3a2a4a'; t.fillRect(0, 0, T, T);
    t.fillStyle = '#453256'; t.fillRect(0, 0, T / 2, T / 2); t.fillRect(T / 2, T / 2, T / 2, T / 2);
    t.strokeStyle = 'rgba(255,201,74,0.12)'; t.strokeRect(0.5, 0.5, T - 1, T - 1);
  });
  const sandPat = () => pat('sand', 64, (t, T) => {
    t.fillStyle = '#c9a86a'; t.fillRect(0, 0, T, T);
    const r = rnd(11); for (let i = 0; i < 300; i++) { t.fillStyle = r() < 0.5 ? 'rgba(255,240,200,0.3)' : 'rgba(120,90,40,0.25)'; t.fillRect(r() * T, r() * T, 1.5, 1.5); }
  });
  const rubberPat = () => pat('rubber', 64, (t, T) => {
    t.fillStyle = '#6a2a4a'; t.fillRect(0, 0, T, T);
    const r = rnd(5); for (let i = 0; i < 200; i++) { t.fillStyle = ['rgba(255,61,139,0.35)', 'rgba(59,232,255,0.3)', 'rgba(255,201,74,0.3)'][i % 3]; t.fillRect(r() * T, r() * T, 2, 2); }
  });
  const asphaltPat = () => pat('asph', 64, (t, T) => {
    t.fillStyle = '#26222e'; t.fillRect(0, 0, T, T);
    const r = rnd(13); for (let i = 0; i < 220; i++) { t.fillStyle = `rgba(255,255,255,${r() * 0.05})`; t.fillRect(r() * T, r() * T, 1.5, 1.5); }
  });

  /* ---------- Gemeinsame Straße unten ---------- */
  const ROAD_Y = 860, WALK_MAX = 846, VIEW_BOTTOM = 975;
  const EX = 900; // über die Ortsgrenzen hinaus weiterzeichnen, damit breite Bildschirme keine Ränder zeigen
  function drawStreet(ww) {
    g.fillStyle = pavePat(); g.fillRect(-EX, 780, ww + EX * 2, ROAD_Y - 780);
    g.fillStyle = '#8a8298'; g.fillRect(-EX, ROAD_Y - 6, ww + EX * 2, 6);
    g.fillStyle = asphaltPat(); g.fillRect(-EX, ROAD_Y, ww + EX * 2, 200);
    g.fillStyle = 'rgba(255,230,140,0.7)';
    for (let x = 20 - EX; x < ww + EX; x += 90) g.fillRect(x, ROAD_Y + 62, 46, 5);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-EX, ROAD_Y + 130, ww + EX * 2, 3);
    // gegenüberliegender Gehweg und Hecke (für hohe Bildschirme)
    g.fillStyle = '#8a8298'; g.fillRect(-EX, ROAD_Y + 200, ww + EX * 2, 6);
    g.fillStyle = pavePat(); g.fillRect(-EX, ROAD_Y + 206, ww + EX * 2, 90);
    g.fillStyle = '#173a22'; g.fillRect(-EX, ROAD_Y + 296, ww + EX * 2, 600);
    g.fillStyle = 'rgba(160,255,140,0.08)'; for (let x = -EX; x < ww + EX; x += 26) { g.beginPath(); g.arc(x, ROAD_Y + 300, 16, Math.PI, 0); g.fill(); }
  }

  /* ---------- Objekt-Zeichner ---------- */
  function drawTree(o) {
    const { x, y } = o, s = o.s || 1;
    shadow(x + 6, y - 2, 34 * s, 11 * s, 0.35);
    g.fillStyle = '#4a2c16'; g.fillRect(x - 5 * s, y - 34 * s, 10 * s, 34 * s);
    const sway = Math.sin(time * 0.9 + x) * 1.5;
    [[0, -70, 34], [-20, -56, 24], [20, -54, 26], [0, -92, 24]].forEach(([dx, dy, r], i) => {
      const cx = x + dx * s + sway, cy = y + dy * s, R = r * s;
      const tg = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      tg.addColorStop(0, i === 3 ? '#5fb86a' : '#4aa05a'); tg.addColorStop(1, '#16402a');
      g.fillStyle = tg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    });
    if (o.lights) {
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 0.3, on = (Math.floor(time * 3) + i) % 3 !== 0;
        g.fillStyle = on ? ['#ff3d8b', '#ffc94a', '#3be8ff'][i % 3] : 'rgba(255,255,255,0.2)';
        g.beginPath(); g.arc(x + Math.cos(a * 2.3) * 26 * s, y - 70 * s + Math.sin(a * 2.3) * 22 * s, 2.2, 0, Math.PI * 2); g.fill();
      }
    }
  }
  function drawPalm(o) {
    const { x, y } = o;
    shadow(x + 10, y - 2, 30, 9, 0.35);
    g.strokeStyle = '#7a5226'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - 2); g.quadraticCurveTo(x + 12, y - 60, x + 4, y - 118); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 1; i < 9; i++) { const t = i / 9, px = x + 12 * 2 * t * (1 - t) + 4 * t * t, py = y - 2 - 116 * t; g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px + 4, py - 2); g.stroke(); }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.55 + Math.sin(time * 0.8 + i) * 0.04, len = 52;
      g.strokeStyle = i % 2 ? '#2a8a3a' : '#3fb04a'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x + 4, y - 118); g.quadraticCurveTo(x + 4 + Math.cos(a) * len * 0.6, y - 118 + Math.sin(a) * len * 0.3 - 16, x + 4 + Math.cos(a) * len, y - 118 + Math.sin(a) * len * 0.7 + 18); g.stroke();
    }
  }
  function drawLamp(o) {
    const { x, y } = o;
    shadow(x, y, 9, 3.5, 0.35);
    g.fillStyle = '#2a2436'; g.fillRect(x - 2.5, y - 92, 5, 90);
    g.fillStyle = '#1a1622'; rr(x - 7, y - 6, 14, 6, 2); g.fill();
    g.fillStyle = '#3a3448'; g.fillRect(x - 2, y - 94, 20, 4);
    const gl = g.createRadialGradient(x + 16, y - 88, 0, x + 16, y - 88, 26);
    gl.addColorStop(0, 'rgba(255,230,160,0.95)'); gl.addColorStop(0.3, 'rgba(255,200,110,0.4)'); gl.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x + 16, y - 88, 26, 0, Math.PI * 2); g.fill();
  }
  function drawBench(o) {
    const { x, y } = o;
    shadow(x, y - 2, 30, 6, 0.3);
    g.fillStyle = '#2a2436'; g.fillRect(x - 26, y - 14, 4, 14); g.fillRect(x + 22, y - 14, 4, 14);
    g.fillStyle = '#8a5424'; for (let i = 0; i < 3; i++) g.fillRect(x - 30, y - 18 - i * 6, 60, 4);
    g.fillStyle = '#6a3e1a'; g.fillRect(x - 30, y - 34, 60, 5);
  }
  function drawHedge(o) {
    const { x, y, w } = o;
    shadow(x, y, w / 2 + 6, 8, 0.3);
    const hg = g.createLinearGradient(0, y - 34, 0, y);
    hg.addColorStop(0, '#3f8a4a'); hg.addColorStop(1, '#173a22');
    g.fillStyle = hg; rr(x - w / 2, y - 30, w, 30, 12); g.fill();
    g.fillStyle = 'rgba(160,255,140,0.12)';
    for (let i = 0; i < w / 14; i++) { g.beginPath(); g.arc(x - w / 2 + 8 + i * 14, y - 28 + (i % 2) * 3, 7, 0, Math.PI * 2); g.fill(); }
  }
  function drawFence(o) {
    const { x, y, w } = o;
    g.fillStyle = '#e8e0f0';
    for (let px = x - w / 2; px <= x + w / 2; px += 14) { g.beginPath(); g.moveTo(px - 3, y); g.lineTo(px - 3, y - 22); g.lineTo(px, y - 26); g.lineTo(px + 3, y - 22); g.lineTo(px + 3, y); g.closePath(); g.fill(); }
    g.fillRect(x - w / 2, y - 18, w, 3); g.fillRect(x - w / 2, y - 8, w, 3);
  }
  function drawFlowers(o) {
    const { x, y, w } = o;
    g.fillStyle = '#3a2412'; rr(x - w / 2, y - 12, w, 12, 4); g.fill();
    const r = rnd(Math.floor(x));
    for (let i = 0; i < w / 7; i++) {
      const fx = x - w / 2 + 4 + r() * (w - 8), fy = y - 8 - r() * 8;
      g.fillStyle = '#2a7a3a'; g.fillRect(fx - 0.7, fy, 1.4, 6);
      g.fillStyle = ['#ff3d8b', '#ffc94a', '#ffffff', '#c77dff'][i % 4]; g.beginPath(); g.arc(fx, fy, 3, 0, Math.PI * 2); g.fill();
    }
  }
  function drawBusStop(o) {
    const { x, y } = o;
    shadow(x, y - 2, 70, 12, 0.35);
    g.fillStyle = '#2a2436'; g.fillRect(x - 60, y - 70, 4, 70); g.fillRect(x + 56, y - 70, 4, 70);
    g.fillStyle = 'rgba(160,220,255,0.18)'; g.fillRect(x - 58, y - 66, 116, 50);
    g.strokeStyle = 'rgba(200,240,255,0.5)'; g.lineWidth = 1.5; g.strokeRect(x - 58, y - 66, 116, 50);
    g.fillStyle = '#ff3d8b'; rr(x - 66, y - 80, 132, 12, 4); g.fill();
    g.fillStyle = '#8a5424'; g.fillRect(x - 40, y - 24, 80, 6);
    g.fillStyle = '#1a1622'; g.fillRect(x - 36, y - 18, 3, 18); g.fillRect(x + 33, y - 18, 3, 18);
    // Schild
    g.fillStyle = '#2a2436'; g.fillRect(x + 74, y - 90, 4, 90);
    g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(x + 76, y - 96, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a0826'; g.font = `${Math.max(10, 10 / zoom)}px Bungee, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', x + 76, y - 95);
    sign('BUS', x, y - 74, 9, '#ffffff', 4);
  }
  function drawBuilding(o) {
    const { x, y, w, h, roof = '#2a1e3a', wall = '#4a3a5e', d = 40 } = o;
    shadow(x, y - 4, w / 2 + 16, 16, 0.4);
    // Dach (Oberseite)
    const rg = g.createLinearGradient(0, y - h - d, 0, y - h);
    rg.addColorStop(0, sh(roof, 25)); rg.addColorStop(1, roof);
    g.fillStyle = rg; g.fillRect(x - w / 2, y - h - d, w, d);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x - w / 2, y - h - d, w, 3);
    // Front
    const fg = g.createLinearGradient(0, y - h, 0, y);
    fg.addColorStop(0, sh(wall, 12)); fg.addColorStop(1, sh(wall, -22));
    g.fillStyle = fg; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - w / 2, y - h, w, 4);
    // Fenster
    if (o.windows !== false) {
      const cols = Math.max(2, Math.floor(w / 60)), rows = Math.max(1, Math.floor((h - 70) / 56));
      const r = rnd(Math.floor(x + y));
      for (let rI = 0; rI < rows; rI++) for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + (c + 0.5) * w / cols - 14, wy = y - h + 18 + rI * 56;
        const lit = r() < 0.72;
        g.fillStyle = '#140c1e'; g.fillRect(wx - 2, wy - 2, 32, 34);
        g.fillStyle = lit ? (r() < 0.5 ? '#ffd88a' : '#ffb870') : '#2a2a48'; g.fillRect(wx, wy, 28, 30);
        if (lit) { g.fillStyle = 'rgba(255,220,150,0.18)'; g.fillRect(wx - 6, wy - 6, 40, 42); }
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx + 13, wy, 2, 30); g.fillRect(wx, wy + 14, 28, 2);
      }
    }
    if (o.door) {
      const dx = x + (o.doorX || 0);
      g.fillStyle = '#1a0e10'; rr(dx - 18, y - 56, 36, 56, [8, 8, 0, 0]); g.fill();
      g.fillStyle = o.doorColor || '#6a3a14'; rr(dx - 15, y - 53, 30, 53, [6, 6, 0, 0]); g.fill();
      g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(dx + 9, y - 26, 2, 0, Math.PI * 2); g.fill();
      const gl = g.createRadialGradient(dx, y - 66, 0, dx, y - 66, 30); gl.addColorStop(0, 'rgba(255,220,150,0.6)'); gl.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = gl; g.fillRect(dx - 30, y - 96, 60, 60);
    }
  }
  function drawHouse(o) {
    const { x, y, w = 220, c = '#8a4a5a' } = o;
    const h = 150;
    shadow(x, y - 4, w / 2 + 14, 14, 0.4);
    const roofC = sh(c, -55);
    if (o.chimney) { const cx = x + w * 0.24; g.fillStyle = sh(c, -70); g.fillRect(cx - 11, y - h - 62, 22, 50); g.fillStyle = sh(c, -40); g.fillRect(cx - 14, y - h - 66, 28, 7);
      for (let i = 0; i < 3; i++) { const t = (time * 0.35 + i / 3) % 1; g.fillStyle = `rgba(200,190,220,${0.25 * (1 - t)})`; g.beginPath(); g.arc(cx + Math.sin(t * 5 + i) * 6 + t * 14, y - h - 72 - t * 50, 6 + t * 10, 0, Math.PI * 2); g.fill(); } }
    if (o.roof === 'flat') {
      g.fillStyle = roofC; g.fillRect(x - w / 2 - 8, y - h - 6, w + 16, 18);
      g.fillStyle = sh(c, -30); g.fillRect(x - w / 2 - 8, y - h - 12, w + 16, 7);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x - w / 2 - 8, y - h - 12, w + 16, 2);
    } else if (o.roof === 'mansard') {
      g.fillStyle = roofC; g.beginPath(); g.moveTo(x - w / 2 - 10, y - h + 10); g.lineTo(x - w / 2 + 14, y - h - 40); g.lineTo(x + w / 2 - 14, y - h - 40); g.lineTo(x + w / 2 + 10, y - h + 10); g.closePath(); g.fill();
      g.fillStyle = sh(c, -35); g.fillRect(x - w / 2 + 14, y - h - 46, w - 28, 8);
      [-0.22, 0.22].forEach(k => { const dx = x + k * w; g.fillStyle = sh(c, 10); g.fillRect(dx - 14, y - h - 30, 28, 30); g.fillStyle = '#ffd88a'; g.fillRect(dx - 9, y - h - 25, 18, 20); g.fillStyle = roofC; g.beginPath(); g.moveTo(dx - 18, y - h - 30); g.lineTo(dx, y - h - 42); g.lineTo(dx + 18, y - h - 30); g.fill(); });
    } else {
      g.fillStyle = roofC;
      g.beginPath(); g.moveTo(x - w / 2 - 12, y - h + 10); g.lineTo(x, y - h - 60); g.lineTo(x + w / 2 + 12, y - h + 10); g.closePath(); g.fill();
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - w / 2 - 12 + i * 22, y - h + 10 - i * 2); g.lineTo(x + w / 2 + 12 - i * 22, y - h + 10 - i * 2); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.2)'; g.stroke(); }
      if (!o.home) { g.fillStyle = sh(c, 25); g.beginPath(); g.arc(x, y - h - 18, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffd88a'; g.beginPath(); g.arc(x, y - h - 18, 7, 0, Math.PI * 2); g.fill(); }
    }
    // Wand
    const fg = g.createLinearGradient(0, y - h, 0, y);
    fg.addColorStop(0, sh(c, 30)); fg.addColorStop(1, sh(c, -10));
    g.fillStyle = fg; g.fillRect(x - w / 2, y - h + 10, w, h - 10);
    // Fenster
    const dX = o.doorX || 0;
    const cols = [-w / 2 + 40, 0, w / 2 - 40];
    [...cols.filter(dx => dX || dx).map(dx => [dx, -110]), ...cols.filter(dx => Math.abs(dx - dX) >= 50).map(dx => [dx, -60])].forEach(([dx, dy], i) => {
      const lit = (i + Math.floor(x)) % 3 !== 0;
      g.fillStyle = '#f0e6f4'; g.fillRect(x + dx - 20, y + dy - 18, 40, 36);
      g.fillStyle = lit ? '#ffd88a' : '#2a2a48'; g.fillRect(x + dx - 17, y + dy - 15, 34, 30);
      g.fillStyle = '#f0e6f4'; g.fillRect(x + dx - 1, y + dy - 15, 2, 30); g.fillRect(x + dx - 17, y + dy - 1, 34, 2);
      if (lit) { g.fillStyle = 'rgba(255,220,150,0.16)'; g.fillRect(x + dx - 30, y + dy - 26, 60, 52); }
    });
    // Tür
    const doorX = x + dX;
    g.fillStyle = sh(c, -60); rr(doorX - 18, y - 62, 36, 62, [10, 10, 0, 0]); g.fill();
    g.fillStyle = 'rgba(255,220,150,0.5)'; g.fillRect(doorX - 8, y - 54, 16, 10);
    g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(doorX + 10, y - 30, 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b0a8c0'; g.fillRect(doorX - 26, y - 4, 52, 4);
    if (o.home) { // Fußmatte und Vorlicht – leuchten, wenn Mimi zu Hause ist
      const on = Cat.present && !Cat.follow;
      g.fillStyle = '#8a2a4a'; rr(doorX - 20, y + 2, 40, 9, 3); g.fill(); g.fillStyle = '#ffc94a'; g.font = '8px serif'; g.textAlign = 'center'; g.fillText('♥', doorX, y + 9);
      g.fillStyle = '#2a2436'; g.fillRect(doorX + 24, y - 72, 8, 12); g.fillStyle = on ? '#fff0b0' : '#6a6070'; g.beginPath(); g.arc(doorX + 28, y - 58, 5, 0, Math.PI * 2); g.fill();
      if (on) { const pl = g.createRadialGradient(doorX + 28, y - 58, 0, doorX + 28, y - 58, 60); pl.addColorStop(0, 'rgba(255,220,150,0.45)'); pl.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = pl; g.beginPath(); g.arc(doorX + 28, y - 58, 60, 0, Math.PI * 2); g.fill(); }
    }
    if (o.home) {
      sign('ZUHAUSE', x, y - h - 20, 10, '#ffc94a', 8);
      // Katzennapf
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.ellipse(x + 50, y + 14, 12, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = Store.s.cat && Store.s.cat.bowl > 0 ? '#8a5424' : '#3a1020'; g.beginPath(); g.ellipse(x + 50, y + 12, 8, 3, 0, 0, Math.PI * 2); g.fill();
    }
    if (o.num) { g.fillStyle = '#fff'; g.font = '700 11px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText(String(o.num), doorX, y - 70); }
  }
  function drawMailbox(o) {
    const { x, y } = o;
    shadow(x, y, 8, 3);
    g.fillStyle = '#4a4458'; g.fillRect(x - 2, y - 30, 4, 30);
    g.fillStyle = '#2f6bff'; rr(x - 11, y - 44, 22, 16, [8, 8, 2, 2]); g.fill();
    g.fillStyle = '#e0103a'; g.fillRect(x + 9, y - 46, 3, 10);
  }
  function drawCar(o) {
    const { x, y, c = '#e0103a' } = o;
    shadow(x, y - 2, 52, 10, 0.4);
    const bg = g.createLinearGradient(0, y - 40, 0, y);
    bg.addColorStop(0, sh(c, 30)); bg.addColorStop(1, sh(c, -40));
    g.fillStyle = bg; rr(x - 50, y - 26, 100, 22, 8); g.fill();
    g.fillStyle = sh(c, -10); rr(x - 30, y - 42, 60, 18, [10, 10, 2, 2]); g.fill();
    g.fillStyle = 'rgba(160,220,255,0.55)'; rr(x - 26, y - 39, 24, 13, 3); g.fill(); rr(x + 2, y - 39, 24, 13, 3); g.fill();
    g.fillStyle = '#111'; [[-32, 0], [32, 0]].forEach(([dx]) => { g.beginPath(); g.arc(x + dx, y - 4, 8, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#888'; [[-32], [32]].forEach(([dx]) => { g.beginPath(); g.arc(x + dx, y - 4, 3.5, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#fff6c8'; g.fillRect(x + 46, y - 20, 4, 5); g.fillStyle = '#ff3d3d'; g.fillRect(x - 50, y - 20, 4, 5);
    if (o.taxi) { g.fillStyle = '#ffc94a'; rr(x - 10, y - 50, 20, 8, 2); g.fill(); g.fillStyle = '#1a0826'; g.font = '700 6px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('TAXI', x, y - 45); }
  }
  function drawFountain(o) {
    const { x, y } = o;
    shadow(x, y - 4, 110, 26, 0.35);
    g.fillStyle = '#6a6278'; g.beginPath(); g.ellipse(x, y - 24, 104, 38, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4458'; g.fillRect(x - 104, y - 24, 208, 14);
    g.beginPath(); g.ellipse(x, y - 10, 104, 38, 0, 0, Math.PI); g.fill();
    const wg = g.createRadialGradient(x, y - 26, 10, x, y - 26, 96);
    wg.addColorStop(0, '#3be8ff'); wg.addColorStop(1, '#1a4a8a');
    g.fillStyle = wg; g.beginPath(); g.ellipse(x, y - 26, 92, 30, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) { const a = time * 0.8 + i; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y - 26, 20 + ((time * 20 + i * 15) % 80), (20 + ((time * 20 + i * 15) % 80)) * 0.33, 0, 0, Math.PI * 2); g.stroke(); void a; }
    g.fillStyle = '#8a8298'; g.fillRect(x - 8, y - 90, 16, 64);
    g.fillStyle = '#a8a0b8'; g.beginPath(); g.ellipse(x, y - 90, 30, 9, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 16; i++) {
      const t = ((time * 1.4 + i / 16) % 1), a = i / 16 * Math.PI * 2;
      const px = x + Math.cos(a) * 30 * t, py = y - 96 - Math.sin(Math.PI * t) * 40 + t * 60;
      g.fillStyle = `rgba(200,245,255,${0.8 - t * 0.6})`; g.beginPath(); g.arc(px, py, 2.4, 0, Math.PI * 2); g.fill();
    }
  }
  function drawCasinoFront(o) {
    const { x, y } = o, w = 1100, h = 250;
    // Fassade
    const fg = g.createLinearGradient(0, y - h, 0, y);
    fg.addColorStop(0, '#2a1438'); fg.addColorStop(1, '#140a1e');
    g.fillStyle = fg; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = '#1a0c24'; g.fillRect(x - w / 2, y - h - 30, w, 30);
    // Säulen & Lichtbänder
    for (let i = 0; i < 9; i++) {
      const px = x - w / 2 + 60 + i * (w - 120) / 8;
      g.fillStyle = '#3a2250'; g.fillRect(px - 10, y - h + 20, 20, h - 20);
      const a = 0.6 + 0.4 * Math.sin(time * 2 + i);
      g.fillStyle = `rgba(255,61,139,${a})`; g.shadowColor = '#ff3d8b'; g.shadowBlur = 12; g.fillRect(px - 2, y - h + 24, 4, h - 40); g.shadowBlur = 0;
    }
    // Lauflichter an der Kante
    for (let i = 0; i < 60; i++) { const on = (Math.floor(time * 6) + i) % 3 === 0; g.fillStyle = on ? '#fff6c8' : 'rgba(255,201,74,0.3)'; g.beginPath(); g.arc(x - w / 2 + 10 + i * (w - 20) / 59, y - h - 6, 2.5, 0, Math.PI * 2); g.fill(); }
    sign('NEON NIGHTS', x, y - h + 60, 46, '#ff3d8b', 26, 'Bungee Inline');
    sign('CASINO', x, y - h + 110, 22, '#3be8ff', 16);
    // Eingang
    g.fillStyle = '#0a0612'; g.fillRect(x - 90, y - 110, 180, 110);
    const dg = g.createLinearGradient(x - 80, 0, x + 80, 0);
    dg.addColorStop(0, 'rgba(255,201,74,0.25)'); dg.addColorStop(0.5, 'rgba(255,240,190,0.5)'); dg.addColorStop(1, 'rgba(255,201,74,0.25)');
    g.fillStyle = dg; g.fillRect(x - 80, y - 100, 160, 100);
    g.fillStyle = '#c98a12'; g.fillRect(x - 92, y - 114, 184, 6); g.fillRect(x - 2, y - 100, 4, 100);
    // Vordach
    g.fillStyle = '#5a1030'; g.beginPath(); g.moveTo(x - 130, y - 118); g.lineTo(x + 130, y - 118); g.lineTo(x + 150, y - 90); g.lineTo(x - 150, y - 90); g.closePath(); g.fill();
    for (let i = 0; i < 14; i++) { g.fillStyle = (Math.floor(time * 5) + i) % 2 ? '#fff6c8' : '#ffc94a'; g.beginPath(); g.arc(x - 140 + i * 21.5, y - 92, 2.5, 0, Math.PI * 2); g.fill(); }
    // Plakate
    [[-380, 'SLOTS', '#ffc94a'], [-220, 'ROULETTE', '#5dffb0'], [220, 'POKER', '#3be8ff'], [380, 'BLACKJACK', '#ff7ab4']].forEach(([dx, t, c]) => {
      g.fillStyle = '#0c0616'; rr(x + dx - 64, y - 150, 128, 70, 8); g.fill();
      g.strokeStyle = c; g.lineWidth = 2; g.shadowColor = c; g.shadowBlur = 10; rr(x + dx - 64, y - 150, 128, 70, 8); g.stroke(); g.shadowBlur = 0;
      sign(t, x + dx, y - 115, 14, c, 10);
    });
  }
  function drawStoreFront(o) {
    const { x, y, w, title, color, icon } = o, h = 170;
    shadow(x, y - 4, w / 2 + 10, 12, 0.35);
    const fg = g.createLinearGradient(0, y - h, 0, y);
    fg.addColorStop(0, sh(o.wall || '#3a2a4a', 20)); fg.addColorStop(1, sh(o.wall || '#3a2a4a', -20));
    g.fillStyle = fg; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = sh(o.wall || '#3a2a4a', -40); g.fillRect(x - w / 2, y - h - 26, w, 26);
    // Markise
    const stripes = 8, sw = w / stripes;
    for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? '#f4eefa' : color; g.beginPath(); g.moveTo(x - w / 2 + i * sw, y - h + 40); g.lineTo(x - w / 2 + (i + 1) * sw, y - h + 40); g.lineTo(x - w / 2 + (i + 1) * sw, y - h + 62); g.quadraticCurveTo(x - w / 2 + (i + 0.5) * sw, y - h + 72, x - w / 2 + i * sw, y - h + 62); g.closePath(); g.fill(); }
    // Schaufenster
    const sg = g.createLinearGradient(0, y - h + 70, 0, y);
    sg.addColorStop(0, 'rgba(255,230,170,0.55)'); sg.addColorStop(1, 'rgba(255,200,120,0.25)');
    g.fillStyle = '#140c1e'; g.fillRect(x - w / 2 + 14, y - h + 76, w - 28, h - 80);
    g.fillStyle = sg; g.fillRect(x - w / 2 + 18, y - h + 80, w - 36, h - 84);
    if (icon) icon(x, y - 50);
    // Tür
    if (o.autoDoor) { // Schiebetür öffnet sich, wenn jemand davorsteht
      const d = Math.min(...[player, ...npcs].map(p => Math.hypot(p.x - x, (p.y - y) * 1.6)));
      o.open = (o.open || 0) + ((d < 110 ? 1 : 0) - (o.open || 0)) * 0.12;
      g.fillStyle = 'rgba(10,6,20,0.9)'; g.fillRect(x - 40, y - 72, 80, 72);
      g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(x - 36, y - 68, 72, 68);
      g.fillStyle = 'rgba(160,220,255,0.45)'; g.fillRect(x - 36 - o.open * 30, y - 68, 36, 68); g.fillRect(x + o.open * 30, y - 68, 36, 68);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.strokeRect(x - 36 - o.open * 30, y - 68, 36, 68); g.strokeRect(x + o.open * 30, y - 68, 36, 68);
      g.fillStyle = '#5dffb0'; g.fillRect(x - 40, y - 78, 80, 5);
    } else {
      g.fillStyle = 'rgba(20,12,30,0.8)'; g.fillRect(x - 20, y - 64, 40, 64);
      g.fillStyle = 'rgba(160,220,255,0.3)'; g.fillRect(x - 17, y - 60, 34, 60);
    }
    sign(title, x, y - h + 20, 15, color, 12);
  }

  /* ---------- Spielplatz ---------- */
  const play = { swing: 0, swingT: -99, slideT: -99, castles: [] };
  function drawSwing(o) {
    const { x, y } = o;
    shadow(x, y, 70, 12, 0.3);
    g.strokeStyle = '#c9a8ff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 92, y); g.lineTo(x - 77, y - 110); g.lineTo(x - 62, y);
    g.moveTo(x + 62, y); g.lineTo(x + 77, y - 110); g.lineTo(x + 92, y); g.stroke();
    g.strokeStyle = '#ff3d8b'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 80, y - 108); g.lineTo(x + 80, y - 108); g.stroke();
    [-22, 22].forEach((dx, i) => {
      const active = i === 0 && time - play.swingT < 5;
      const amp = active ? Math.sin((time - play.swingT) * 3.2) * 0.5 * Math.min(1, (5 - (time - play.swingT)) / 1.5) : Math.sin(time * 1.2 + i) * 0.05;
      const ex = x + dx, ey = y - 108 + Math.cos(amp) * 78 + Math.sin(amp) * 30; // schwingt zum Betrachter hin und weg
      g.strokeStyle = '#8a8298'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + dx - 9, y - 108); g.lineTo(ex - 9, ey); g.moveTo(x + dx + 9, y - 108); g.lineTo(ex + 9, ey); g.stroke();
      const sc = 1 + Math.sin(amp) * 0.12; g.fillStyle = '#ffc94a'; rr(ex - 12 * sc, ey - 3, 24 * sc, 6 * sc, 2); g.fill();
      if (active) { o.seat = { x: ex, y: ey + 11, s: sc }; }
    });
  }
  function drawSlide(o) {
    const { x, y } = o;
    shadow(x, y, 80, 14, 0.3);
    g.fillStyle = '#3a2250'; g.fillRect(x - 60, y - 96, 6, 96); g.fillRect(x - 30, y - 96, 6, 96);
    g.strokeStyle = '#c9a8ff'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 58, y - 12 - i * 15); g.lineTo(x - 26, y - 12 - i * 15); g.stroke(); }
    g.fillStyle = '#5a3a90'; g.fillRect(x - 62, y - 104, 42, 10);
    const sg = g.createLinearGradient(x - 20, 0, x + 80, 0);
    sg.addColorStop(0, '#ff6aa6'); sg.addColorStop(1, '#ffc94a');
    g.fillStyle = sg; g.beginPath(); g.moveTo(x - 22, y - 104); g.lineTo(x - 4, y - 104); g.quadraticCurveTo(x + 50, y - 40, x + 84, y - 8); g.lineTo(x + 70, y); g.quadraticCurveTo(x + 36, y - 30, x - 22, y - 92); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 14, y - 100); g.quadraticCurveTo(x + 40, y - 38, x + 76, y - 6); g.stroke();
  }
  function drawSandbox(o) {
    const { x, y } = o;
    g.fillStyle = '#8a5424'; rr(x - 90, y - 60, 180, 64, 6); g.fill();
    g.fillStyle = sandPat(); rr(x - 82, y - 54, 164, 52, 4); g.fill();
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(x + 60, y - 30); g.lineTo(x + 72, y - 30); g.lineTo(x + 70, y - 18); g.lineTo(x + 62, y - 18); g.closePath(); g.fill();
    g.strokeStyle = '#3be8ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 50, y - 22); g.lineTo(x + 40, y - 40); g.stroke();
    // Spielzeug im Sand
    g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(x - 60, y - 16, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e0103a'; g.beginPath(); g.arc(x - 60, y - 16, 7, -0.6, 0.9); g.lineTo(x - 60, y - 16); g.fill();
    g.fillStyle = '#5dffb0'; g.beginPath(); g.moveTo(x - 30, y - 38); g.lineTo(x - 14, y - 38); g.lineTo(x - 18, y - 30); g.lineTo(x - 26, y - 30); g.closePath(); g.fill();
    g.fillStyle = '#c9a878'; g.beginPath(); g.ellipse(x + 10, y - 20, 14, 5, 0, 0, Math.PI * 2); g.fill();
    play.castles.forEach(c => {
      const cx = x + c.dx, cy = y - 16;
      g.fillStyle = '#d8b878'; g.fillRect(cx - 12, cy - 16, 24, 16); g.fillRect(cx - 14, cy - 22, 7, 8); g.fillRect(cx + 7, cy - 22, 7, 8); g.fillRect(cx - 4, cy - 26, 8, 12);
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx, cy - 36); g.lineTo(cx + 8, cy - 32); g.closePath(); g.fill();
    });
  }
  function drawSpring(o) { // Federwippe in Pferdchenform
    const { x, y } = o;
    const ride = player.pose && player.pose.kind === 'spring' && player.pose.o === o;
    const b = ride ? Math.sin(time * 9) * 0.22 : Math.sin(time * 1.3) * 0.03;
    shadow(x, y, 30, 7, 0.35);
    g.fillStyle = '#3a2250'; rr(x - 20, y - 5, 40, 6, 3); g.fill();
    g.strokeStyle = '#c9a8ff'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 6; i++) { const yy = y - 4 - i * 4; g.lineTo(x + (i % 2 ? 5 : -5), yy); } g.stroke();
    g.save(); g.translate(x, y - 30); g.rotate(b);
    g.fillStyle = '#ffc94a'; rr(-22, -12, 40, 16, 8); g.fill();
    g.beginPath(); g.moveTo(12, -8); g.lineTo(26, -30); g.lineTo(32, -26); g.lineTo(22, -4); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(30, -30, 9, 6, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(22, -34); g.lineTo(14, -24); g.lineTo(20, -22); g.closePath(); g.fill();
    g.fillStyle = '#1a0826'; g.beginPath(); g.arc(32, -32, 1.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff3d8b'; g.lineWidth = 4; g.beginPath(); g.moveTo(-22, -6); g.quadraticCurveTo(-32, -2, -30, 8); g.stroke();
    g.fillStyle = '#3be8ff'; rr(-8, -16, 14, 5, 2); g.fill();
    g.restore();
    if (ride) o.seat = { x: x - 2 + Math.sin(b) * 20, y: y - 33 + Math.abs(b) * 8 };
  }
  function drawHopscotch(o) {
    const { x, y } = o;
    g.strokeStyle = 'rgba(255,240,200,0.75)'; g.lineWidth = 2.5; g.font = '700 12px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,240,200,0.8)';
    const cells = [[0, 0, 1], [0, -1, 2], [-0.5, -2, 3], [0.5, -2, 4], [0, -3, 5], [-0.5, -4, 6], [0.5, -4, 7], [0, -5, 8]];
    cells.forEach(([cx, cy, n]) => { const px = x + cx * 36 - 18, py = y + cy * 22 - 11; g.strokeRect(px, py, 36, 22); g.fillText(String(n), px + 18, py + 12); });
  }
  function drawSeesaw(o) {
    const { x, y } = o;
    shadow(x, y, 70, 10, 0.3);
    const a = Math.sin(time * (o.busy ? 2.4 : 0.6)) * (o.busy ? 0.28 : 0.05);
    g.fillStyle = '#3a2250'; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y - 24); g.lineTo(x + 12, y); g.closePath(); g.fill();
    g.save(); g.translate(x, y - 24); g.rotate(a);
    g.fillStyle = '#3be8ff'; rr(-72, -4, 144, 8, 3); g.fill();
    g.fillStyle = '#ffc94a'; g.fillRect(-66, -14, 4, 10); g.fillRect(62, -14, 4, 10);
    g.restore();
  }
  function drawIceTruck(o) {
    const { x, y } = o;
    shadow(x, y - 2, 90, 14, 0.4);
    g.fillStyle = '#f4eefa'; rr(x - 86, y - 90, 150, 84, 10); g.fill();
    g.fillStyle = '#ff6aa6'; rr(x + 60, y - 64, 36, 58, 8); g.fill();
    g.fillStyle = 'rgba(160,220,255,0.6)'; rr(x + 66, y - 58, 24, 20, 4); g.fill();
    g.fillStyle = '#1a0e24'; rr(x - 70, y - 78, 110, 44, 6); g.fill();
    g.fillStyle = '#ffc94a'; g.fillRect(x - 70, y - 38, 110, 5);
    ['#ff6aa6', '#ffc94a', '#5dffb0', '#c9a8ff'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(x - 52 + i * 26, y - 60, 9, Math.PI, 0); g.fill(); g.fillStyle = '#d8a060'; g.beginPath(); g.moveTo(x - 60 + i * 26, y - 60); g.lineTo(x - 44 + i * 26, y - 60); g.lineTo(x - 52 + i * 26, y - 44); g.closePath(); g.fill(); });
    g.fillStyle = '#111'; [[-56], [40]].forEach(([dx]) => { g.beginPath(); g.arc(x + dx, y - 6, 11, 0, Math.PI * 2); g.fill(); });
    // Riesen-Eistüte auf dem Dach
    g.fillStyle = '#d8a060'; g.beginPath(); g.moveTo(x - 20, y - 100); g.lineTo(x + 4, y - 100); g.lineTo(x - 8, y - 72); g.closePath(); g.fill();
    g.fillStyle = '#ff6aa6'; g.beginPath(); g.arc(x - 8, y - 106, 13, 0, Math.PI * 2); g.fill();
    sign('EIS', x - 8, y - 126, 12, '#ff6aa6', 10);
  }

  function drawCart(o) {
    const { x, y } = o;
    shadow(x, y, 20, 5, 0.3);
    g.strokeStyle = '#b0a8c0'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 18, y - 30); g.lineTo(x + 14, y - 30); g.lineTo(x + 10, y - 10); g.lineTo(x - 14, y - 10); g.closePath(); g.stroke();
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x - 18 + i * 8, y - 30); g.lineTo(x - 14 + i * 6, y - 10); g.stroke(); }
    g.beginPath(); g.moveTo(x + 14, y - 30); g.lineTo(x + 20, y - 36); g.stroke();
    g.fillStyle = '#222'; [[-10], [8]].forEach(([dx]) => { g.beginPath(); g.arc(x + dx, y - 4, 3, 0, Math.PI * 2); g.fill(); });
  }

  const DRAW = { tree: drawTree, palm: drawPalm, lamp: drawLamp, bench: drawBench, hedge: drawHedge, fence: drawFence, flowers: drawFlowers, busstop: drawBusStop,
    building: drawBuilding, house: drawHouse, mailbox: drawMailbox, car: drawCar, fountain: drawFountain, casino: drawCasinoFront, store: drawStoreFront,
    swing: drawSwing, spring: drawSpring, hopscotch: drawHopscotch, slide: drawSlide, sandbox: drawSandbox, seesaw: drawSeesaw, icetruck: drawIceTruck, cart: drawCart, cafetable: drawCafeTable, menuboard: drawMenuBoard, crates: drawCrates, carf: drawCarFront, corral: drawCorral };

  /* ---------- Orte ---------- */
  const shopIcon = kind => (x, y) => {
    if (kind === 'hats') { const hats = ['tophat', 'crown', 'cowboy']; hats.forEach((h, i) => { g.save(); g.translate(x - 50 + i * 50, y + 10); g.scale(1.6, 1.6); Avatar.drawHat(g, h, 0, false, 1, 0, '#ff3d8b'); g.restore(); }); }
    else if (kind === 'pets') { drawCatShape(x - 30, y + 18, 1, 0, false, 'sit', 1.1, null); g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(x + 36, y + 8, 12, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ffc2e4'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + 36, y + 8, 4 + i * 2.5, i, i + 2.4); g.stroke(); } }
    else if (kind === 'cafe') { g.fillStyle = '#f4eefa'; rr(x - 16, y - 6, 32, 28, 6); g.fill(); g.strokeStyle = '#f4eefa'; g.lineWidth = 4; g.beginPath(); g.arc(x + 18, y + 6, 8, -1.2, 1.2); g.stroke(); g.fillStyle = '#6a3e1a'; g.fillRect(x - 12, y - 4, 24, 6); for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${0.4 + 0.2 * Math.sin(time * 2 + i)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8 + i * 8, y - 12); g.quadraticCurveTo(x - 4 + i * 8, y - 22, x - 8 + i * 8, y - 30); g.stroke(); } }
    else if (kind === 'market') {
      // Regalgänge über die ganze Fensterfront
      const r = rnd(77), cols = ['#e0103a', '#ffc94a', '#5dffb0', '#ff8a3d', '#3be8ff', '#f4eefa', '#c77dff'];
      for (const side of [-1, 1]) for (let a = 0; a < 3; a++) {
        const ax = x + side * (80 + a * 110);
        g.fillStyle = 'rgba(40,30,60,0.75)'; g.fillRect(ax - 44, y - 38, 88, 76);
        for (let row = 0; row < 3; row++) {
          g.fillStyle = '#8a8298'; g.fillRect(ax - 44, y - 12 + row * 24, 88, 3);
          for (let k = 0; k < 7; k++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(ax - 41 + k * 12, y - 30 + row * 24, 9, 16 - r() * 5); }
        }
      }
      // Plakate
      [[-300, 'SALE %', '#ff3d8b'], [300, '-20 %', '#ffc94a']].forEach(([dx, t, c]) => { g.fillStyle = c; rr(x + dx - 34, y - 70, 68, 26, 5); g.fill(); g.fillStyle = '#1a0826'; g.font = '13px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + dx, y - 56); });
    }
    if (kind === 'pets') { // Aquarium mit Fischen
      const ax = x + 110, ay = y - 6;
      const ag = g.createLinearGradient(0, ay - 30, 0, ay + 30); ag.addColorStop(0, 'rgba(90,220,255,0.85)'); ag.addColorStop(1, 'rgba(20,90,160,0.9)');
      g.fillStyle = '#2a2436'; g.fillRect(ax - 38, ay + 26, 76, 8);
      g.fillStyle = ag; g.fillRect(ax - 34, ay - 28, 68, 54);
      for (let i = 0; i < 3; i++) { const fx = ax + Math.sin(time * (0.8 + i * 0.3) + i * 2) * 22, fy = ay - 14 + i * 14, d = Math.cos(time * (0.8 + i * 0.3) + i * 2) > 0 ? 1 : -1; g.fillStyle = ['#ff8a3d', '#ffc94a', '#ff3d8b'][i]; g.beginPath(); g.ellipse(fx, fy, 6, 3.5, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(fx - d * 5, fy); g.lineTo(fx - d * 10, fy - 4); g.lineTo(fx - d * 10, fy + 4); g.fill(); }
      for (let i = 0; i < 4; i++) { const t = (time * 0.6 + i / 4) % 1; g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(ax - 20 + i * 5, ay + 22 - t * 48, 1.6, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#3fb04a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(ax + 20 + i * 5, ay + 16, 2, 10, Math.sin(time + i) * 0.2, 0, Math.PI * 2); g.fill(); }
      const glw = g.createRadialGradient(ax, ay, 0, ax, ay, 70); glw.addColorStop(0, 'rgba(59,232,255,0.25)'); glw.addColorStop(1, 'rgba(59,232,255,0)'); g.fillStyle = glw; g.beginPath(); g.arc(ax, ay, 70, 0, Math.PI * 2); g.fill();
    }
    if (kind === 'hats') { // Hutständer neben der Tür
      [[-120, 'party'], [120, 'beanie']].forEach(([dx, h]) => { g.fillStyle = '#c9a8ff'; g.fillRect(x + dx - 1.5, y - 10, 3, 34); g.fillRect(x + dx - 12, y + 22, 24, 3); g.fillStyle = '#f4d6c0'; g.beginPath(); g.ellipse(x + dx, y - 16, 10, 12, 0, 0, Math.PI * 2); g.fill(); g.save(); g.translate(x + dx, y - 4); g.scale(1.3, 1.3); Avatar.drawHat(g, h, 0, false, 1, 0, '#ffc94a'); g.restore(); });
    }
  };
  function drawCafeTable(o) {
    const { x, y } = o;
    shadow(x, y - 2, 40, 9, 0.35);
    // Stühle
    [[-26, 0], [26, 0]].forEach(([dx]) => { g.fillStyle = '#2a2436'; g.fillRect(x + dx - 9, y - 24, 3, 24); g.fillRect(x + dx + 6, y - 24, 3, 24); g.fillStyle = '#6a3e1a'; rr(x + dx - 10, y - 26, 20, 5, 2); g.fill(); g.fillRect(x + dx + (dx < 0 ? -10 : 7), y - 46, 3, 22); });
    g.fillStyle = '#2a2436'; g.fillRect(x - 2, y - 30, 4, 30);
    g.fillStyle = '#f4eefa'; g.beginPath(); g.ellipse(x, y - 32, 20, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a3e1a'; g.beginPath(); g.ellipse(x - 6, y - 35, 4, 2, 0, 0, Math.PI * 2); g.fill();
    // Schirm
    g.fillStyle = '#8a8298'; g.fillRect(x - 1.5, y - 96, 3, 64);
    const cols = ['#ffc94a', '#f4eefa'];
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 2]; g.beginPath(); g.moveTo(x, y - 110); g.lineTo(x - 48 + i * 16, y - 86); g.lineTo(x - 32 + i * 16, y - 86); g.closePath(); g.fill(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 2]; g.beginPath(); g.arc(x - 40 + i * 16, y - 86, 8, 0, Math.PI); g.fill(); }
  }
  function drawMenuBoard(o) {
    const { x, y } = o;
    shadow(x, y, 20, 5, 0.3);
    g.fillStyle = '#6a3e1a'; g.beginPath(); g.moveTo(x - 18, y); g.lineTo(x - 12, y - 56); g.lineTo(x + 12, y - 56); g.lineTo(x + 18, y); g.lineTo(x + 13, y); g.lineTo(x + 8, y - 50); g.lineTo(x - 8, y - 50); g.lineTo(x - 13, y); g.closePath(); g.fill();
    g.fillStyle = '#1a2a22'; g.fillRect(x - 11, y - 52, 22, 36);
    g.fillStyle = '#f4eefa'; g.font = '6px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('MENU', x, y - 45);
    g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 3; i++) g.fillRect(x - 8, y - 40 + i * 7, 12 + (i % 2) * 4, 1.5);
    g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(x + 6, y - 22, 2, 0, Math.PI * 2); g.fill();
  }
  function drawCrates(o) {
    const { x, y } = o;
    shadow(x, y, 70, 10, 0.35);
    g.fillStyle = '#4a2c16'; g.fillRect(x - 64, y - 30, 128, 6); g.fillRect(x - 60, y - 24, 4, 24); g.fillRect(x + 56, y - 24, 4, 24);
    const fruit = [['#e0103a', 5], ['#ff8a3d', 5.5], ['#ffe04a', 5], ['#5dbf3a', 5.5]];
    fruit.forEach(([c, r], i) => {
      const cx = x - 48 + i * 32;
      g.fillStyle = '#a0662a'; g.beginPath(); g.moveTo(cx - 15, y - 58); g.lineTo(cx + 15, y - 58); g.lineTo(cx + 13, y - 32); g.lineTo(cx - 13, y - 32); g.closePath(); g.fill();
      g.strokeStyle = '#6a3e1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 14, y - 45); g.lineTo(cx + 14, y - 45); g.stroke();
      for (let k = 0; k < 6; k++) { g.fillStyle = c; g.beginPath(); g.arc(cx - 10 + (k % 3) * 10, y - 60 - Math.floor(k / 3) * 6 + (k % 2), r, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(cx - 11 + (k % 3) * 10, y - 62 - Math.floor(k / 3) * 6, 1.5, 0, Math.PI * 2); g.fill(); }
    });
    g.fillStyle = '#f4eefa'; rr(x - 22, y - 26, 44, 14, 3); g.fill(); g.fillStyle = '#1a0826'; g.font = '8px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(I18N.t('FRISCH'), x, y - 19);
  }
  function drawCarFront(o) { // geparktes Auto von vorn
    const { x, y, c = '#e0103a' } = o;
    shadow(x, y - 2, 52, 10, 0.45);
    const bg = g.createLinearGradient(0, y - 50, 0, y);
    bg.addColorStop(0, sh(c, 25)); bg.addColorStop(1, sh(c, -45));
    g.fillStyle = '#111'; rr(x - 46, y - 16, 16, 16, 4); g.fill(); rr(x + 30, y - 16, 16, 16, 4); g.fill();
    g.fillStyle = bg; rr(x - 50, y - 44, 100, 34, 10); g.fill();
    g.fillStyle = sh(c, -15); rr(x - 38, y - 72, 76, 32, [16, 16, 4, 4]); g.fill();
    const wg = g.createLinearGradient(0, y - 68, 0, y - 44); wg.addColorStop(0, 'rgba(180,230,255,0.75)'); wg.addColorStop(1, 'rgba(60,110,160,0.75)');
    g.fillStyle = wg; rr(x - 32, y - 67, 64, 22, [12, 12, 3, 3]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x - 20, y - 66); g.lineTo(x - 8, y - 66); g.lineTo(x - 22, y - 46); g.lineTo(x - 30, y - 46); g.fill();
    g.fillStyle = '#fff6c8'; rr(x - 44, y - 34, 18, 9, 4); g.fill(); rr(x + 26, y - 34, 18, 9, 4); g.fill();
    g.fillStyle = '#1a1622'; rr(x - 20, y - 32, 40, 10, 3); g.fill();
    g.fillStyle = '#f4eefa'; rr(x - 13, y - 19, 26, 8, 2); g.fill(); g.fillStyle = '#1a0826'; g.font = '6px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NN ' + o.plate, x, y - 15);
    g.fillStyle = sh(c, -30); g.fillRect(x - 56, y - 50, 8, 6); g.fillRect(x + 48, y - 50, 8, 6);
  }
  function drawCorral(o) {
    const { x, y } = o;
    shadow(x, y, 60, 8, 0.3);
    g.strokeStyle = '#8a8298'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 56, y); g.lineTo(x - 56, y - 36); g.lineTo(x + 56, y - 36); g.lineTo(x + 56, y); g.stroke();
    g.fillStyle = '#5dffb0'; rr(x - 30, y - 60, 60, 16, 4); g.fill(); g.fillStyle = '#0a2a1a'; g.font = '8px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(I18N.t('WAGEN'), x, y - 52);
    g.strokeStyle = '#6a6278'; g.fillRect(x - 1, y - 44, 2, 8);
    for (let i = 0; i < 4; i++) drawCart({ x: x - 36 + i * 22, y: y - 2 });
  }

  const ZONES = {
    plaza: {
      name: 'Casino-Vorplatz', w: 1600, top: 330, spawn: [1250, 820], ground: 'plaza',
      objects: () => [
        { kind: 'casino', x: 800, y: 330, fw: 1100, fh: 40, sortY: 300, game: 'casino', label: 'Neon Nights Casino', sub: 'Hier gibt es Münzen zu gewinnen', ix: 800, iy: 380, glow: '#ff3d8b', vh: 250 },
        { kind: 'fountain', x: 800, y: 626, fw: 220, fh: 76 },
        { kind: 'palm', x: 300, y: 480, fw: 20, fh: 14 }, { kind: 'palm', x: 1300, y: 480, fw: 20, fh: 14 },
        { kind: 'palm', x: 150, y: 720, fw: 20, fh: 14 }, { kind: 'palm', x: 1450, y: 720, fw: 20, fh: 14 },
        { kind: 'lamp', x: 520, y: 760, fw: 10, fh: 8 }, { kind: 'lamp', x: 1080, y: 760, fw: 10, fh: 8 },
        { kind: 'bench', x: 560, y: 520, fw: 64, fh: 14 }, { kind: 'bench', x: 1040, y: 520, fw: 64, fh: 14 },
        { kind: 'flowers', x: 300, y: 560, w: 160, fw: 160, fh: 14 }, { kind: 'flowers', x: 1300, y: 560, w: 160, fw: 160, fh: 14 },
        { kind: 'car', x: 420, y: 930, c: '#ffc94a', taxi: true, nocoll: true },
        { kind: 'busstop', x: 1250, y: 800, fw: 130, fh: 20, game: 'bus', label: 'Bushaltestelle', sub: 'Mit dem Bus zu anderen Orten', ix: 1250, iy: 830, glow: '#ffc94a' },
      ],
      lights: [[800, 400, 300, '255,61,139', 0.16], [520, 690, 140, '255,210,140', 0.18], [1080, 690, 140, '255,210,140', 0.18], [800, 600, 180, '59,232,255', 0.1]],
      npcs: 5,
    },
    neighborhood: {
      name: 'Nachbarschaft', w: 1500, top: 330, spawn: [1250, 820], ground: 'grass',
      objects: () => [
        { kind: 'house', x: 220, y: 330, w: 220, c: '#7a4a8a', fw: 240, fh: 40, num: 3, roof: 'flat', doorX: -50 },
        { kind: 'house', x: 560, y: 330, w: 220, c: '#c05a6a', fw: 240, fh: 40, home: true, chimney: true, game: 'home', label: 'Dein Zuhause', sub: 'Mimis Napf steht vor der Tür', ix: 560, iy: 380, glow: '#ffc94a' },
        { kind: 'house', x: 900, y: 330, w: 250, c: '#3a7a8a', fw: 270, fh: 40, num: 7, chimney: true, doorX: 50 },
        { kind: 'house', x: 1240, y: 330, w: 200, c: '#8a7a3a', fw: 220, fh: 40, num: 9, roof: 'mansard', chimney: true },
        { kind: 'fence', x: 390, y: 470, w: 120, fw: 120, fh: 8 }, { kind: 'fence', x: 730, y: 470, w: 120, fw: 120, fh: 8 },
        { kind: 'hedge', x: 1070, y: 480, w: 140, fw: 140, fh: 22 },
        { kind: 'tree', x: 100, y: 600, fw: 22, fh: 14, s: 1.1 }, { kind: 'tree', x: 1400, y: 610, fw: 22, fh: 14, s: 1.2, lights: true },
        { kind: 'tree', x: 820, y: 720, fw: 22, fh: 14 },
        { kind: 'flowers', x: 470, y: 420, w: 80, fw: 80, fh: 12 }, { kind: 'flowers', x: 650, y: 420, w: 80, fw: 80, fh: 12 },
        { kind: 'mailbox', x: 470, y: 470, fw: 16, fh: 10 },
        { kind: 'bench', x: 1000, y: 700, fw: 64, fh: 14 },
        { kind: 'lamp', x: 300, y: 770, fw: 10, fh: 8 }, { kind: 'lamp', x: 900, y: 770, fw: 10, fh: 8 },
        { kind: 'car', x: 620, y: 940, c: '#2f6bff', nocoll: true },
        { kind: 'busstop', x: 1250, y: 800, fw: 130, fh: 20, game: 'bus', label: 'Bushaltestelle', sub: 'Mit dem Bus zu anderen Orten', ix: 1250, iy: 830, glow: '#ffc94a' },
      ],
      lights: [[560, 420, 160, '255,210,140', 0.14], [300, 700, 140, '255,210,140', 0.18], [900, 700, 140, '255,210,140', 0.18]],
      npcs: 3, cat: { area: [80, 400, 1150, 760], home: [610, 395] },
    },
    mall: {
      name: 'Einkaufsmeile', w: 1500, top: 330, spawn: [1250, 820], ground: 'plaza',
      objects: () => [
        { kind: 'store', x: 250, y: 330, w: 330, title: 'HUTMACHER', color: '#ff3d8b', wall: '#3a2a5a', icon: shopIcon('hats'), fw: 330, fh: 40, game: 'shop:hats', label: 'Hutmacher', sub: 'Hüte für deine Figur', ix: 250, iy: 380, glow: '#ff3d8b', vh: 170 },
        { kind: 'store', x: 750, y: 330, w: 330, title: 'ZOOHANDLUNG', color: '#5dffb0', wall: '#1f4a4a', icon: shopIcon('pets'), fw: 330, fh: 40, game: 'shop:pets', label: 'Zoohandlung', sub: 'Spielzeug und Halsbänder für Mimi', ix: 750, iy: 380, glow: '#5dffb0', vh: 170 },
        { kind: 'store', x: 1250, y: 330, w: 330, title: 'CAFÉ LUNA', color: '#ffc94a', wall: '#4a2a1a', icon: shopIcon('cafe'), fw: 330, fh: 40, game: 'shop:cafe', label: 'Café Luna', sub: 'Kaffee und Kuchen', ix: 1250, iy: 380, glow: '#ffc94a', vh: 170 },
        { kind: 'tree', x: 500, y: 560, fw: 22, fh: 14, lights: true }, { kind: 'tree', x: 1000, y: 560, fw: 22, fh: 14, lights: true },
        { kind: 'cafetable', x: 1120, y: 470, fw: 70, fh: 14 }, { kind: 'cafetable', x: 1390, y: 470, fw: 70, fh: 14 }, { kind: 'menuboard', x: 1170, y: 420, fw: 30, fh: 8 },
        { kind: 'flowers', x: 250, y: 420, w: 100, fw: 100, fh: 12 },
        { kind: 'bench', x: 750, y: 600, fw: 64, fh: 14 }, { kind: 'bench', x: 250, y: 640, fw: 64, fh: 14 },
        { kind: 'lamp', x: 380, y: 770, fw: 10, fh: 8 }, { kind: 'lamp', x: 1000, y: 770, fw: 10, fh: 8 },
        { kind: 'flowers', x: 750, y: 700, w: 200, fw: 200, fh: 14 },
        { kind: 'busstop', x: 1250, y: 800, fw: 130, fh: 20, game: 'bus', label: 'Bushaltestelle', sub: 'Mit dem Bus zu anderen Orten', ix: 1250, iy: 830, glow: '#ffc94a' },
      ],
      lights: [[250, 420, 180, '255,61,139', 0.12], [750, 420, 180, '93,255,176', 0.1], [1250, 420, 180, '255,201,74', 0.12], [380, 700, 140, '255,210,140', 0.18], [1000, 700, 140, '255,210,140', 0.18]],
      npcs: 6,
    },
    market: {
      name: 'Supermarkt', w: 1500, top: 330, spawn: [1250, 820], ground: 'asphalt',
      objects: () => [
        { kind: 'store', x: 560, y: 330, w: 760, title: 'FRISCHMARKT', color: '#5dffb0', wall: '#2a3a4a', autoDoor: true, icon: shopIcon('market'), fw: 760, fh: 40, game: 'shop:market', label: 'Frischmarkt', sub: 'Katzenfutter, Leckerli und Eis', ix: 560, iy: 380, glow: '#5dffb0', vh: 170 },
        { kind: 'carf', x: 245, y: 596, c: '#e0103a', plate: '7', fw: 100, fh: 30 }, { kind: 'carf', x: 505, y: 596, c: '#e8e4ef', plate: '21', fw: 100, fh: 30 }, { kind: 'carf', x: 635, y: 596, c: '#2f6bff', plate: '9', fw: 100, fh: 30 }, { kind: 'carf', x: 1025, y: 596, c: '#1fbf6a', plate: '33', fw: 100, fh: 30 },
        { kind: 'crates', x: 330, y: 430, fw: 130, fh: 14 }, { kind: 'crates', x: 790, y: 430, fw: 130, fh: 14 },
        { kind: 'cart', x: 880, y: 470, fw: 36, fh: 10 }, { kind: 'cart', x: 150, y: 700, fw: 36, fh: 10 },
        { kind: 'corral', x: 1200, y: 560, fw: 116, fh: 10 },
        { kind: 'tree', x: 1420, y: 470, fw: 22, fh: 14, s: 1.15 }, { kind: 'tree', x: 1400, y: 690, fw: 22, fh: 14 }, { kind: 'lamp', x: 1150, y: 740, fw: 10, fh: 8 },
        { kind: 'lamp', x: 440, y: 740, fw: 10, fh: 8 }, { kind: 'lamp', x: 880, y: 740, fw: 10, fh: 8 },
        { kind: 'busstop', x: 1250, y: 800, fw: 130, fh: 20, game: 'bus', label: 'Bushaltestelle', sub: 'Mit dem Bus zu anderen Orten', ix: 1250, iy: 830, glow: '#ffc94a' },
      ],
      lights: [[560, 420, 300, '93,255,176', 0.1], [440, 670, 150, '255,210,140', 0.18], [880, 670, 150, '255,210,140', 0.18], [1150, 670, 150, '255,210,140', 0.18]],
      npcs: 4, parking: true,
    },
    playground: {
      name: 'Spielplatz', w: 1500, top: 200, spawn: [1250, 820], ground: 'grass',
      objects: () => [
        { kind: 'fence', x: 700, y: 210, w: 1200, fw: 1200, fh: 8 },
        { kind: 'swing', x: 300, y: 420, fw: 190, fh: 20, game: 'swing', label: 'Schaukel', sub: 'Einmal richtig Schwung holen', ix: 278, iy: 448, glow: '#c9a8ff' },
        { kind: 'slide', x: 650, y: 420, fw: 140, fh: 30, game: 'slide', label: 'Rutsche', sub: 'Hoch und runter!', ix: 620, iy: 460, glow: '#ff6aa6' },
        { kind: 'sandbox', x: 1000, y: 440, fw: 180, fh: 64, game: 'sand', label: 'Sandkasten', sub: 'Eine Sandburg bauen', ix: 1000, iy: 480, glow: '#ffc94a' },
        { kind: 'spring', x: 1180, y: 450, fw: 40, fh: 12, game: 'spring', label: 'Federpferd', sub: 'Hopp, hopp!', ix: 1180, iy: 480, glow: '#ffc94a', vh: 60 },
        { kind: 'hopscotch', x: 700, y: 770, nocoll: true, sortY: 0 },
        { kind: 'seesaw', x: 420, y: 650, fw: 150, fh: 16, game: 'seesaw', label: 'Wippe', sub: 'Mit einem Kind wippen', ix: 420, iy: 690, glow: '#3be8ff' },
        { kind: 'icetruck', x: 900, y: 700, fw: 180, fh: 30, game: 'shop:ice', label: 'Eiswagen', sub: 'Kugeln in allen Farben', ix: 860, iy: 740, glow: '#ff6aa6' },
        { kind: 'tree', x: 120, y: 330, fw: 22, fh: 14, s: 1.2 }, { kind: 'tree', x: 1380, y: 330, fw: 22, fh: 14, s: 1.2 },
        { kind: 'tree', x: 120, y: 720, fw: 22, fh: 14 },
        { kind: 'bench', x: 1250, y: 560, fw: 64, fh: 14 }, { kind: 'bench', x: 700, y: 560, fw: 64, fh: 14 },
        { kind: 'lamp', x: 560, y: 770, fw: 10, fh: 8 },
        { kind: 'busstop', x: 1250, y: 800, fw: 130, fh: 20, game: 'bus', label: 'Bushaltestelle', sub: 'Mit dem Bus zu anderen Orten', ix: 1250, iy: 830, glow: '#ffc94a' },
      ],
      lights: [[560, 700, 150, '255,210,140', 0.18], [650, 400, 200, '255,106,166', 0.07]],
      npcs: 5, kids: true, rubber: [180, 300, 1260, 420],
    },
  };
  const ZONE_ORDER = ['plaza', 'neighborhood', 'mall', 'market', 'playground'];
  const ZONE_INFO = {
    plaza: { icon: '♛', desc: 'Das Casino – hier verdienst du Münzen' },
    neighborhood: { icon: '⌂', desc: 'Dein Zuhause und Katze Mimi' },
    mall: { icon: '◆', desc: 'Hüte, Zoohandlung und Café' },
    market: { icon: '●', desc: 'Katzenfutter, Leckerli und Eis' },
    playground: { icon: '★', desc: 'Schaukel, Rutsche, Sandkasten' },
  };

  /* ---------- Ort laden ---------- */
  let objects = [], interactives = [], npcs = [], blocked = null, COLS = 0, ROWS = 0, WW = 1500, WH = 1000, TOP = 330;
  function loadZone(id, at) {
    Z = ZONES[id]; Z.id = id;
    WW = Z.w; WH = 1000; TOP = Z.top;
    objects = Z.objects().map(o => Object.assign({ fw: 0, fh: 0 }, o, { sortY: o.sortY != null ? o.sortY : o.y }));
    interactives = objects.filter(o => o.game);
    COLS = Math.ceil(WW / CELL); ROWS = Math.ceil(WH / CELL);
    blocked = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      if (outside(x, y, 4)) { blocked[r * COLS + c] = 1; continue; }
      for (const o of objects) {
        if (o.nocoll || !o.fw) continue;
        const q = rectOf(o);
        if (x > q.x - PR && x < q.x + q.w + PR && y > q.y - PR && y < q.y + q.h + PR) { blocked[r * COLS + c] = 1; break; }
      }
    }
    const [sx, sy] = at || Z.spawn;
    player.x = sx; player.y = sy; player.path = null; player.pose = null;
    npcs = makeNpcs(Z);
    if (Z.cat) Cat.enter(Z.cat); else Cat.leave();
    Store.s.town = { zone: id }; Store.save();
    if (W) resize();
    zoneEl.textContent = Z.name;
    zoneEl.classList.remove('faded'); zoneEl.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 400 });
    clearTimeout(zoneEl.__t); zoneEl.__t = setTimeout(() => zoneEl.classList.add('faded'), 3200);
    updateCamera(true);
  }
  function outside(x, y, pad = 0) { return y < TOP + 26 + pad || y > WALK_MAX - pad || x < 24 + pad || x > WW - 24 - pad; }
  function rectOf(o) { return { x: o.x - o.fw / 2, y: o.y - o.fh, w: o.fw, h: o.fh }; }
  function collides(x, y) {
    if (outside(x, y)) return true;
    for (const o of objects) {
      if (o.nocoll || !o.fw) continue;
      const q = rectOf(o), cx = U.clamp(x, q.x, q.x + q.w), cy = U.clamp(y, q.y, q.y + q.h);
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
  function los(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8); for (let i = 1; i <= n; i++) { const t = i / n; if (collides(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; }
  function findPath(sx, sy, tx, ty) {
    const s = nearestFree(Math.floor(sx / CELL), Math.floor(sy / CELL)), e = nearestFree(Math.floor(tx / CELL), Math.floor(ty / CELL));
    if (!s || !e) return null;
    const N = COLS * ROWS, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const si = s[1] * COLS + s[0], ei = e[1] * COLS + e[0];
    const hf = i => { const c = i % COLS, r = (i / COLS) | 0, dx = Math.abs(c - e[0]), dy = Math.abs(r - e[1]); return dx + dy - 0.586 * Math.min(dx, dy); };
    gS[si] = 0; push(si, hf(si));
    let found = false, guard = 0;
    while (heap.length && guard++ < 20000) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      if (i === ei) { found = true; break; }
      const c = i % COLS, r = (i / COLS) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nc = c + dx, nr = r + dy;
        if (!free(nc, nr) || (dx && dy && (!free(c + dx, r) || !free(c, r + dy)))) continue;
        const ni = nr * COLS + nc, cost = gS[i] + (dx && dy ? 1.414 : 1);
        if (cost < gS[ni]) { gS[ni] = cost; from[ni] = i; push(ni, cost + hf(ni)); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = ei; i !== -1; i = from[i]) pts.push({ x: (i % COLS) * CELL + CELL / 2, y: ((i / COLS) | 0) * CELL + CELL / 2 });
    pts.reverse();
    if (!collides(tx, ty)) pts[pts.length - 1] = { x: tx, y: ty };
    const out = []; let cur = { x: sx, y: sy }, k = 0;
    while (k < pts.length) { let far = k; for (let j = pts.length - 1; j > k; j--) if (los(cur.x, cur.y, pts[j].x, pts[j].y)) { far = j; break; } out.push(pts[far]); cur = pts[far]; k = far + 1; }
    return out;
  }

  /* ---------- Figuren ---------- */
  const rndAv = () => ({ skin: U.randInt(0, 4), hair: U.randInt(0, 6), style: U.pick(['short', 'long', 'bun', 'mohawk', 'bald']), outfit: U.pick(['#2f5fe0', '#1f8f6a', '#c98a12', '#e0206e', '#6a2fe0', '#8a8298', '#3a7a8a']),
    accent: U.pick(['#ffc94a', '#ff3d8b', '#3be8ff', '#ffffff']), glasses: Math.random() < 0.2, hat: Math.random() < 0.25 ? U.pick(['cap', 'beanie', 'cowboy']) : null });
  function makeNpcs(z) {
    const list = [];
    for (let i = 0; i < z.npcs; i++) {
      let x, y, n = 0; do { x = U.rand(80, WW - 80); y = U.rand(TOP + 80, WALK_MAX - 20); } while (collides(x, y) && n++ < 50);
      const kid = z.kids && i < 3;
      const a = rndAv();
      if (kid) Object.assign(a, { outfit: U.pick(['#ff3d8b', '#3be8ff', '#ffc94a', '#5dffb0', '#ff8a3d']), accent: '#ffffff', glasses: false, hat: i === 0 ? 'cap' : null, style: U.pick(['short', 'bun', 'long']) });
      list.push({ x, y, dir: 0, phase: Math.random() * 6, moving: false, path: null, wait: U.rand(0, 3), speed: kid ? U.rand(90, 120) : U.rand(50, 75), a, kid, first: i === 0 });
    }
    return list;
  }
  function stepChar(ch, dt, vx, vy, free = false) {
    const len = Math.hypot(vx, vy);
    if (len < 0.01) { ch.moving = false; return; }
    const sp = ch.speed * dt * Math.min(1, len), mx = vx / len * sp, my = vy / len * sp;
    if (free || !collides(ch.x + mx, ch.y)) ch.x += mx;
    if (free || !collides(ch.x, ch.y + my)) ch.y += my;
    ch.moving = true; ch.phase += dt * 11 * Math.min(1, len);
    if (Math.abs(vx) > Math.abs(vy)) ch.dir = vx < 0 ? 1 : 2; else ch.dir = vy < 0 ? 3 : 0;
  }
  function followPath(ch, dt, free = false) {
    if (!ch.path || !ch.path.length) { ch.path = null; return false; }
    const p = ch.path[0], dx = p.x - ch.x, dy = p.y - ch.y, d = Math.hypot(dx, dy);
    if (d < 4) { ch.path.shift(); if (!ch.path.length) { ch.path = null; return false; } return true; }
    const ox = ch.x, oy = ch.y;
    stepChar(ch, dt * Math.min(1, d / Math.max(1, ch.speed * dt)), dx, dy, free);
    if (!free && Math.hypot(ch.x - ox, ch.y - oy) < 0.05) { ch.path = null; return false; }
    return true;
  }
  function updateNpcs(dt) {
    for (const n of npcs) {
      if (n.path) { if (!followPath(n, dt, true)) n.moving = false; continue; }
      n.moving = false; n.wait -= dt; n.phase += dt * 2;
      if (n.wait > 0) continue;
      let tx, ty;
      const saw = n.kid && n.first && interactives.find(o => o.game === 'seesaw');
      if (saw && Math.random() < 0.7) { tx = saw.x + 90; ty = saw.y + 14; }
      else if (Math.random() < 0.4 && interactives.length) { const o = U.pick(interactives.filter(o => o.game !== 'bus')); if (o) { tx = o.ix + U.pick([-40, 0, 40]); ty = o.iy + U.rand(6, 20); } }
      if (tx == null) { tx = U.rand(60, WW - 60); ty = U.rand(TOP + 60, WALK_MAX - 10); }
      n.path = findPath(n.x, n.y, tx, ty); n.wait = U.rand(2, 7);
    }
    // Abstand halten
    const all = [player, ...npcs];
    for (let i = 1; i < all.length; i++) for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      const a = all[i], b = all[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < 22) { const nx = a.x + dx / d * (22 - d) * 0.5, ny = a.y + dy / d * (22 - d) * 0.5; if (!collides(nx, ny)) { a.x = nx; a.y = ny; } }
    }
  }

  function updatePlayer(dt) {
    if (lock || player.pose) { player.moving = false; return; }
    let vx = 0, vy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) vx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) vx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) vy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) vy += 1;
    if (joy.id !== null) { vx = joy.dx; vy = joy.dy; }
    if (vx || vy) { player.path = null; pendingInteract = null; stepChar(player, dt, vx, vy); }
    else if (player.path) {
      if (!followPath(player, dt)) { player.moving = false; if (pendingInteract) { const o = pendingInteract; pendingInteract = null; if (distTo(o) < 64) interact(o); } }
    } else player.moving = false;
    if (player.moving) { stepAcc += dt; if (stepAcc > 0.28) { stepAcc = 0; Sfx.step(); } }
    let best = null, bd = 64;
    for (const o of interactives) { const d = distTo(o); if (d < bd) { bd = d; best = o; } }
    const cd = Cat.dist(player);
    if (cd < 58 && cd < bd) best = Cat.target();
    near = best;
  }
  const distTo = o => Math.hypot(player.x - o.ix, player.y - o.iy);

  /* ---------- Katze Mimi ---------- */
  function drawCatShape(x, y, dir, phase, moving, state, s = 1, collar) {
    g.save(); g.translate(x, y); g.scale(dir < 0 ? -s : s, s);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2); g.fill();
    const fur = '#f0923a', dark = '#b85a14', light = '#ffd0a0';
    if (state === 'sleep') {
      g.fillStyle = fur; g.beginPath(); g.ellipse(0, -9, 17, 10, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = dark; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-4 + i * 5, -14, 5, 0.3, 1.5); g.stroke(); }
      g.strokeStyle = fur; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(4, -6, 13, 0.2, 1.9); g.stroke();
      g.fillStyle = fur; g.beginPath(); g.arc(-12, -9, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-18, -13); g.lineTo(-17, -21); g.lineTo(-12, -15); g.fill(); g.beginPath(); g.moveTo(-10, -16); g.lineTo(-7, -22); g.lineTo(-5, -14); g.fill();
      g.strokeStyle = '#3a1a08'; g.lineWidth = 1.2; g.beginPath(); g.arc(-14, -9, 2, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(-9, -9, 2, 0.2, Math.PI - 0.2); g.stroke();
      g.restore(); return;
    }
    if (state === 'roll') {
      const wig = Math.sin(time * 9) * 3;
      g.strokeStyle = fur; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(12, -7); g.quadraticCurveTo(24, -4 + wig, 28, -12 + wig); g.stroke();
      g.strokeStyle = dark; g.lineWidth = 3;
      [[-8, 0], [-2, 1.3], [5, 2.1], [10, 0.7]].forEach(([lx, ph]) => { const k = Math.sin(time * 8 + ph) * 3; g.beginPath(); g.moveTo(lx, -10); g.lineTo(lx + k * 0.4, -21 + k); g.stroke(); });
      g.fillStyle = light; g.beginPath(); g.arc(-8 + 0, -21 + Math.sin(time * 8) * 3, 2.2, 0, Math.PI * 2); g.fill();
      const bgR = g.createLinearGradient(0, -16, 0, -2); bgR.addColorStop(0, fur); bgR.addColorStop(1, dark);
      g.fillStyle = bgR; g.beginPath(); g.ellipse(1, -8, 16, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light; g.beginPath(); g.ellipse(1, -11, 10, 4.5, 0, 0, Math.PI * 2); g.fill();
      // Kopf seitlich, Augen zu
      g.fillStyle = fur; g.beginPath(); g.arc(-16, -8, 8.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-22, -2); g.lineTo(-30, 0); g.lineTo(-23, -8); g.fill();
      g.beginPath(); g.moveTo(-21, -13); g.lineTo(-27, -19); g.lineTo(-17, -16); g.fill();
      g.strokeStyle = '#3a1a08'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(-18, -9, 2, Math.PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(-13, -6, 2, Math.PI + 0.3, -0.3); g.stroke();
      g.fillStyle = '#ff6a8a'; g.beginPath(); g.arc(-12, -11, 1.3, 0, Math.PI * 2); g.fill();
      if (collar) { g.strokeStyle = collar; g.lineWidth = 2.5; g.beginPath(); g.arc(-16, -8, 8, -0.4, 0.9); g.stroke(); }
      g.restore(); return;
    }
    const sit = state === 'sit' || state === 'eat' || state === 'petted';
    const legSw = moving ? Math.sin(phase * 1.4) * 4 : 0;
    // Schwanz
    const tw = Math.sin(time * (state === 'petted' ? 6 : 2) + x) * 0.5;
    g.strokeStyle = fur; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, sit ? -8 : -14); g.quadraticCurveTo(24, -20 + tw * 6, 20 + tw * 8, sit ? -30 : -34); g.stroke();
    g.strokeStyle = dark; g.lineWidth = 5; g.beginPath(); g.moveTo(20 + tw * 8, sit ? -30 : -34); g.lineTo(19 + tw * 8, sit ? -34 : -38); g.stroke();
    // Beine
    g.fillStyle = dark;
    if (!sit) { [[-9, legSw], [-4, -legSw], [6, -legSw], [11, legSw]].forEach(([lx, o]) => { g.fillRect(lx - 2 + o * 0.3, -10, 4, 10); }); }
    // Körper
    const bg = g.createLinearGradient(0, -24, 0, -4);
    bg.addColorStop(0, fur); bg.addColorStop(1, dark);
    g.fillStyle = bg; g.beginPath();
    if (sit) g.ellipse(3, -12, 12, 12, 0, 0, Math.PI * 2); else g.ellipse(1, -16, 16, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = dark; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); if (sit) g.arc(4 + i * 4, -18, 6, 3.6, 4.6); else g.moveTo(-4 + i * 6, -23), g.lineTo(-2 + i * 6, -17); g.stroke(); }
    if (sit) { g.fillStyle = light; g.beginPath(); g.ellipse(-3, -6, 6, 5, 0, 0, Math.PI * 2); g.fill(); }
    // Kopf
    const hx = sit ? -8 : -15, hy = sit ? -26 : -22, bob = state === 'eat' ? Math.abs(Math.sin(time * 6)) * 3 + 4 : 0;
    g.fillStyle = fur;
    g.beginPath(); g.moveTo(hx - 8, hy - 4 + bob); g.lineTo(hx - 7, hy - 14 + bob); g.lineTo(hx - 2, hy - 7 + bob); g.fill();
    g.beginPath(); g.moveTo(hx + 8, hy - 4 + bob); g.lineTo(hx + 7, hy - 14 + bob); g.lineTo(hx + 2, hy - 7 + bob); g.fill();
    g.fillStyle = '#ff9ab0'; g.beginPath(); g.moveTo(hx - 6.5, hy - 6 + bob); g.lineTo(hx - 6, hy - 11 + bob); g.lineTo(hx - 3.5, hy - 7 + bob); g.fill();
    g.fillStyle = fur; g.beginPath(); g.arc(hx, hy + bob, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = light; g.beginPath(); g.ellipse(hx - 1, hy + 4 + bob, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
    // Augen
    if (state === 'petted') {
      g.strokeStyle = '#3a1a08'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(hx - 4, hy - 1 + bob, 2, Math.PI + 0.3, -0.3); g.stroke(); g.beginPath(); g.arc(hx + 3, hy - 1 + bob, 2, Math.PI + 0.3, -0.3); g.stroke();
    } else {
      const blink = (time % 4) < 0.12;
      g.fillStyle = '#7aff6a';
      if (blink) { g.fillRect(hx - 6, hy - 1 + bob, 4, 1.2); g.fillRect(hx + 1, hy - 1 + bob, 4, 1.2); }
      else { g.beginPath(); g.ellipse(hx - 4, hy - 1 + bob, 2.2, 2.6, 0, 0, Math.PI * 2); g.ellipse(hx + 3, hy - 1 + bob, 2.2, 2.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.fillRect(hx - 4.5, hy - 3 + bob, 1, 4); g.fillRect(hx + 2.5, hy - 3 + bob, 1, 4); }
    }
    g.fillStyle = '#ff6a8a'; g.beginPath(); g.moveTo(hx - 2, hy + 2 + bob); g.lineTo(hx + 1, hy + 2 + bob); g.lineTo(hx - 0.5, hy + 4 + bob); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.7;
    for (const s2 of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(hx - 0.5, hy + 3 + bob); g.lineTo(hx - 0.5 + s2 * 11, hy + 1 + i * 3 + bob); g.stroke(); }
    if (collar) { g.strokeStyle = collar; g.lineWidth = 2.5; g.beginPath(); g.arc(hx, hy + bob, 8.5, 0.6, 2.5); g.stroke(); g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(hx - 1, hy + 8.5 + bob, 1.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  const Cat = (() => {
    const c = { x: 600, y: 520, dir: 1, phase: 0, moving: false, state: 'sit', until: 0, tx: 0, ty: 0, present: false, follow: false, area: null, home: null, yarn: null, lastMeow: 0 };
    const S = () => Store.s.cat || (Store.s.cat = { name: 'Mimi', aff: 0, pets: 0, fed: 0, bowl: 0 });
    const tgt = { game: 'cat', label: 'Mimi', sub: 'Streicheln · Füttern · Spielen', glow: '#ffc94a' };
    function enter(cfg) {
      c.present = true; c.area = cfg.area; c.home = cfg.home;
      if (c.follow) { c.x = player.x - 44; c.y = player.y + 8; } else { c.x = cfg.home[0] + 30; c.y = cfg.home[1] + 60; }
      c.state = 'sit'; c.until = time + 2;
    }
    function leave() { if (!c.follow) c.present = false; }
    const level = () => { const a = S().aff; return a >= 80 ? 'Beste Freunde' : a >= 50 ? 'Freundlich' : a >= 20 ? 'Neugierig' : 'Scheu'; };
    function set(state, dur) { c.state = state; c.until = time + dur; }
    function goTo(x, y, run) { c.tx = x; c.ty = y; c.state = run ? 'run' : 'walk'; }
    function update(dt) {
      if (!c.present) return;
      c.phase += dt * 10;
      const sp = c.state === 'run' ? 170 : c.state === 'chase' ? 140 : 55;
      if (c.follow && !['petted', 'eat', 'chase', 'roll'].includes(c.state)) {
        const d = Math.hypot(player.x - c.x, player.y - c.y);
        const face = player.dir === 1 ? -1 : 1; // hinter der Figur bleiben
        if (d > 70) goTo(player.x - 40 * face, player.y + 8, d > 140);
        else if (c.state === 'walk' || c.state === 'run') set('sit', 1.5);
      }
      if (c.state === 'walk' || c.state === 'run' || c.state === 'chase') {
        const tx = c.state === 'chase' && c.yarn ? c.yarn.x : c.tx, ty = c.state === 'chase' && c.yarn ? c.yarn.y : c.ty;
        const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
        if (d < 8 && (c.state !== 'chase' || !c.yarn || Math.hypot(c.yarn.vx, c.yarn.vy) < 40)) {
          if (c.state === 'chase' && c.yarn) {
            c.yarn.hits = (c.yarn.hits || 0) + 1;
            if (c.yarn.hits < 4) { throwYarn(); Sfx.bounce(0.7); } else { c.yarn = null; set('sit', 2); addAff(10, false); hearts(6); }
          } else set(Math.random() < 0.3 && !c.follow ? 'sleep' : 'sit', U.rand(3, 8));
        } else {
          const nx = c.x + dx / d * sp * dt, ny = c.y + dy / d * sp * dt;
          c.x = nx; c.y = ny; c.dir = dx < 0 ? -1 : 1; c.moving = true;
        }
      } else c.moving = false;
      if (c.yarn) { c.yarn.x += c.yarn.vx * dt; c.yarn.y += c.yarn.vy * dt; c.yarn.vx *= 0.96; c.yarn.vy *= 0.96; c.yarn.rot += dt * c.yarn.vx * 0.1; }
      // Zutrauliche Mimi läuft zur Begrüßung herbei
      if (!c.follow && S().aff >= 50 && c.state === 'sit' && time - (c.lastGreet || -99) > 25) {
        const d = Math.hypot(player.x - c.x, player.y - c.y);
        if (d > 70 && d < 260) { c.lastGreet = time; goTo(player.x + (c.x < player.x ? -30 : 30), player.y + 4, true); meow(); }
      }
      if ((c.state === 'sit' || c.state === 'sleep') && time > c.until && !c.follow) {
        const [x0, y0, x1, y1] = c.area;
        goTo(U.rand(x0, x1), U.rand(y0, y1), false);
      }
      if ((c.state === 'petted' || c.state === 'eat' || c.state === 'roll') && time > c.until) set('sit', 2);
      if (c.state === 'sleep' && Math.random() < dt * 0.8) FX.floatText(...toScreen(c.x - 14, c.y - 40), 'z', 'zzz');
      if (time - c.lastMeow > 14 && Math.hypot(player.x - c.x, player.y - c.y) < 160 && c.state !== 'sleep' && Math.random() < dt) meow();
    }
    function meow() { c.lastMeow = time; Sfx.meow && Sfx.meow(); const [sx, sy] = toScreen(c.x + 6, c.y - 52); FX.floatText(sx, sy, I18N.t('Miau!'), 'meow'); }
    function throwYarn() {
      const [x0, y0, x1, y1] = c.area || [player.x - 150, player.y - 100, player.x + 150, player.y + 60];
      const tx = U.clamp(U.clamp(c.x + U.rand(-160, 160), player.x - 200, player.x + 200), x0, x1), ty = U.clamp(U.clamp(c.y + U.rand(-90, 90), player.y - 140, player.y + 60), y0, y1);
      c.yarn = c.yarn || { x: player.x, y: player.y - 10, rot: 0, hits: 0 };
      c.yarn.vx = (tx - c.yarn.x) * 1.6; c.yarn.vy = (ty - c.yarn.y) * 1.6;
      c.state = 'chase';
    }
    function hearts(n) { const [sx, sy] = toScreen(c.x, c.y - 44); for (let i = 0; i < n; i++) setTimeout(() => FX.floatText(sx + U.rand(-16, 16), sy, '♥', 'heart'), i * 120); }
    function addAff(n, quiet) {
      const s = S(), before = level();
      s.aff = Math.min(100, s.aff + n); Store.save();
      Store.emit({ type: 'cat', aff: s.aff });
      Panel.render();
      if (!quiet && level() !== before) Toast.show(I18N.t(s.name), I18N.t('Mimi ist jetzt: {0}', I18N.t(level())), '♥', 'ach');
    }
    function pet() {
      if (c.state === 'sleep') { set('sit', 1); Sfx.meow && Sfx.meow(); Panel.say(I18N.t('Mimi wacht auf und streckt sich.')); return; }
      if (c.state === 'petted') return;
      c.dir = player.x < c.x ? -1 : 1;
      const roll = S().aff >= 80 && Math.random() < 0.45;
      set(roll ? 'roll' : 'petted', roll ? 2.8 : 2.2); Sfx.purr && Sfx.purr(); hearts(roll ? 7 : 4);
      const s = S(); s.pets = (s.pets || 0) + 1;
      addAff(3); Store.emit({ type: 'catPet', pets: s.pets });
      if (roll) Panel.say(I18N.t('Mimi rollt sich auf den Rücken – Bauchkraulen!')); else Panel.say(U.pick([I18N.t('Mimi schnurrt zufrieden.'), I18N.t('Mimi schmiegt sich an deine Hand.'), I18N.t('Mimi blinzelt dich glücklich an.')]));
    }
    function feed(kind) {
      const inv = Inv.get();
      const key = kind === 'treat' ? 'treats' : 'food';
      if (!inv[key]) { Sfx.error(); Panel.say(kind === 'treat' ? I18N.t('Du hast keine Leckerli. Der Frischmarkt verkauft welche.') : I18N.t('Du hast kein Katzenfutter. Der Frischmarkt verkauft welches.')); return; }
      inv[key]--; Store.save();
      c.dir = player.x < c.x ? -1 : 1;
      set('eat', kind === 'treat' ? 1.8 : 3.4); Sfx.coin(-12);
      addAff(kind === 'treat' ? 8 : 15); hearts(kind === 'treat' ? 3 : 5);
      S().fed = (S().fed || 0) + 1;
      Panel.say(kind === 'treat' ? I18N.t('Mimi schnappt sich das Leckerli!') : I18N.t('Mimi frisst mit Genuss.'));
    }
    function playYarn() {
      if (!Inv.get().yarn) { Sfx.error(); Panel.say(I18N.t('Du brauchst ein Wollknäuel aus der Zoohandlung.')); return; }
      if (c.state === 'chase') return;
      c.yarn = { x: player.x, y: player.y - 10, rot: 0, hits: 0 };
      throwYarn(); Sfx.click();
      Panel.say(I18N.t('Mimi jagt dem Wollknäuel hinterher!'));
    }
    function toggleFollow() {
      if (S().aff < 50) { Sfx.error(); Panel.say(I18N.t('Mimi kennt dich noch nicht gut genug. Streichle und füttere sie öfter.')); return; }
      c.follow = !c.follow; Sfx.meow && Sfx.meow();
      Panel.say(c.follow ? I18N.t('Mimi folgt dir jetzt – auch mit dem Bus.') : I18N.t('Mimi bleibt hier.'));
      if (!c.follow && Z && !Z.cat) { c.present = false; Panel.close(); }
      Panel.render();
    }
    function drawYarn() {
      if (!c.present || !c.yarn) return;
      const Y = c.yarn;
      Y.trail = Y.trail || []; Y.trail.push([Y.x, Y.y]); if (Y.trail.length > 14) Y.trail.shift();
      g.strokeStyle = 'rgba(255,120,180,0.8)'; g.lineWidth = 1.5; g.beginPath(); Y.trail.forEach(([tx, ty], i) => i ? g.lineTo(tx, ty - 6) : g.moveTo(tx, ty - 6)); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(Y.x, Y.y + 2, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(Y.x, Y.y - 8); g.rotate(Y.rot);
      g.fillStyle = '#5a0a30'; g.beginPath(); g.arc(0, 0, 10.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffc2e4'; g.lineWidth = 1.4; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, 3 + i * 1.8, i, i + 2.6); g.stroke(); }
      g.restore();
    }
    function draw() {
      if (!c.present) return;
      drawCatShape(c.x, c.y, c.dir, c.phase, c.moving, c.state === 'run' || c.state === 'walk' || c.state === 'chase' ? 'walk' : c.state, 1.35, Inv.get().collar);
      if (near === tgt) {
        g.strokeStyle = `rgba(255,201,74,${0.5 + 0.3 * Math.sin(time * 5)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(c.x, c.y + 1, 32, 10, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    return {
      enter, leave, update, draw, drawYarn, get yarnY() { return c.yarn ? c.yarn.y : -1; }, pet, feed, playYarn, toggleFollow, level, S,
      dist: p => c.present ? Math.hypot(p.x - c.x, p.y - c.y) : 1e9,
      target: () => Object.assign(tgt, { x: c.x, y: c.y, ix: c.x, iy: c.y, vh: 40, label: S().name }),
      get y() { return c.y; }, get present() { return c.present; }, get follow() { return c.follow; }, get state() { return c.state; },
    };
  })();

  /* ---------- Katzen-Menü ---------- */
  const Panel = (() => {
    const el = $('#catPanel'), msg = $('#catMsg');
    function render() {
      const s = Cat.S(), inv = Inv.get();
      $('#catName').textContent = s.name;
      $('#catLevel').textContent = I18N.t(Cat.level());
      $('#catHearts').style.width = s.aff + '%';
      $('#catFeed').querySelector('small').textContent = '× ' + inv.food;
      $('#catTreat').querySelector('small').textContent = '× ' + inv.treats;
      $('#catFeed').classList.toggle('locked', !inv.food); $('#catTreat').classList.toggle('locked', !inv.treats);
      $('#catAffNum').textContent = `${s.aff} / 100`;
      $('#catPlay').classList.toggle('locked', !inv.yarn);
      $('#catFollow').querySelector('b').textContent = Cat.follow ? I18N.t('Hierbleiben') : I18N.t('Folge mir');
      $('#catFollow').classList.toggle('locked', s.aff < 50);
    }
    return {
      open() { render(); el.hidden = false; player.dir = Cat.target().x < player.x ? 1 : 2; msg.textContent = I18N.t('Was möchtest du mit Mimi machen?'); requestAnimationFrame(() => el.classList.add('show')); },
      close() { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 220); },
      get open_() { return !el.hidden; },
      render, say(t) { msg.textContent = t; },
    };
  })();
  $('#catPet').addEventListener('click', () => { Sfx.init(); Cat.pet(); });
  $('#catFeed').addEventListener('click', () => { Sfx.init(); Cat.feed('food'); });
  $('#catTreat').addEventListener('click', () => { Sfx.init(); Cat.feed('treat'); });
  $('#catPlay').addEventListener('click', () => { Sfx.init(); Cat.playYarn(); });
  $('#catFollow').addEventListener('click', () => { Sfx.init(); Cat.toggleFollow(); });
  $('#catClose').addEventListener('click', () => { Sfx.click(); Panel.close(); });

  /* ---------- Inventar & Läden ---------- */
  const Inv = {
    get() { return Store.s.inv || (Store.s.inv = { food: 0, treats: 0, yarn: false, collar: null, hats: [] }); },
  };
  const SHOPS = {
    hats: { title: 'Hutmacher', sub: 'Setz deiner Figur die Krone auf.', items: [
      { id: 'hat:cap', name: 'Basecap', desc: 'In deiner Krawattenfarbe.', price: 300, hat: 'cap' },
      { id: 'hat:beanie', name: 'Mütze', desc: 'Warm und mit Bommel.', price: 400, hat: 'beanie' },
      { id: 'hat:party', name: 'Partyhut', desc: 'Jede Nacht ist Party.', price: 500, hat: 'party' },
      { id: 'hat:cowboy', name: 'Cowboyhut', desc: 'Für echte Glücksritter.', price: 900, hat: 'cowboy' },
      { id: 'hat:tophat', name: 'Zylinder', desc: 'Der Klassiker der High Roller.', price: 1500, hat: 'tophat' },
      { id: 'hat:crown', name: 'Krone', desc: 'Für die Königin oder den König der Nacht.', price: 5000, hat: 'crown' },
    ] },
    pets: { title: 'Zoohandlung', sub: 'Alles, was Mimi glücklich macht.', items: [
      { id: 'yarn', name: 'Wollknäuel', desc: 'Damit kannst du mit Mimi spielen.', price: 150, once: true },
      { id: 'collar:#ff3d8b', name: 'Halsband Pink', desc: 'Mit goldenem Glöckchen.', price: 200, collar: '#ff3d8b' },
      { id: 'collar:#3be8ff', name: 'Halsband Türkis', desc: 'Mit goldenem Glöckchen.', price: 200, collar: '#3be8ff' },
      { id: 'collar:#ffc94a', name: 'Halsband Gold', desc: 'Nur das Beste für Mimi.', price: 400, collar: '#ffc94a' },
      { id: 'treats', name: 'Leckerli (5 Stück)', desc: 'Kleine Belohnung zwischendurch.', price: 60, add: { treats: 5 } },
    ] },
    cafe: { title: 'Café Luna', sub: 'Kurz durchatmen zwischen zwei Runden.', items: [
      { id: 'coffee', name: 'Espresso', desc: 'Frisch gebrüht.', price: 15, treat: 'Der Espresso weckt dich richtig auf.' },
      { id: 'cake', name: 'Schokokuchen', desc: 'Mit Kirsche obendrauf.', price: 30, treat: 'Himmlisch! Der Kuchen war sein Geld wert.' },
      { id: 'lemonade', name: 'Neon-Limonade', desc: 'Leuchtet leicht im Dunkeln.', price: 20, treat: 'Erfrischend und ein bisschen leuchtend.' },
    ] },
    market: { title: 'Frischmarkt', sub: 'Alles für den Alltag – und für Mimi.', items: [
      { id: 'food', name: 'Katzenfutter', desc: 'Eine Portion für Mimi.', price: 40, add: { food: 1 } },
      { id: 'food5', name: 'Katzenfutter (5er-Pack)', desc: 'Günstiger im Vorrat.', price: 180, add: { food: 5 } },
      { id: 'treats', name: 'Leckerli (5 Stück)', desc: 'Mimis Lieblingssnack.', price: 55, add: { treats: 5 } },
      { id: 'apple', name: 'Apfel', desc: 'Knackig und frisch.', price: 5, treat: 'Knack! Ein saftiger Apfel.' },
    ] },
    ice: { title: 'Eiswagen', sub: 'Eine Kugel geht immer.', items: [
      { id: 'ice1', name: 'Erdbeereis', desc: 'Eine Kugel, pink wie Neon.', price: 12, treat: 'Mmh, Erdbeere!' },
      { id: 'ice2', name: 'Mango-Sorbet', desc: 'Fruchtig und kalt.', price: 12, treat: 'Wie Urlaub in der Waffel.' },
      { id: 'ice3', name: 'Blaubeer-Traum', desc: 'Zwei Kugeln mit Streuseln.', price: 20, treat: 'Blaue Zunge garantiert.' },
    ] },
  };
  function itemIcon(it) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const t = c.getContext('2d');
    if (it.hat) { t.translate(48, 70); t.scale(2.6, 2.6); Avatar.drawHat(t, it.hat, 0, false, 1, 0, avatar.accent || '#ffc94a'); }
    else if (it.collar) { t.strokeStyle = it.collar; t.lineWidth = 9; t.beginPath(); t.arc(48, 44, 26, 0.3, Math.PI * 2 - 0.3); t.stroke(); t.fillStyle = '#ffc94a'; t.beginPath(); t.arc(48, 76, 9, 0, Math.PI * 2); t.fill(); }
    else if (it.id === 'yarn') { t.fillStyle = '#ff3d8b'; t.beginPath(); t.arc(48, 50, 28, 0, Math.PI * 2); t.fill(); t.strokeStyle = '#ffc2e4'; t.lineWidth = 3; for (let i = 0; i < 5; i++) { t.beginPath(); t.arc(48, 50, 8 + i * 4, i, i + 2.6); t.stroke(); } }
    else if (it.id.startsWith('food')) { t.fillStyle = '#ff3d8b'; t.beginPath(); t.ellipse(48, 64, 34, 14, 0, 0, Math.PI * 2); t.fill(); t.fillStyle = '#8a5424'; t.beginPath(); t.ellipse(48, 58, 26, 9, 0, 0, Math.PI * 2); t.fill(); t.fillStyle = '#ffc94a'; t.font = '20px serif'; t.textAlign = 'center'; t.fillText('♥', 48, 40); }
    else if (it.id === 'treats') { for (let i = 0; i < 5; i++) { t.fillStyle = ['#ffc94a', '#ff8a3d', '#e0a060'][i % 3]; t.beginPath(); t.ellipse(28 + (i % 3) * 20, 40 + Math.floor(i / 3) * 22, 11, 7, i, 0, Math.PI * 2); t.fill(); } }
    else if (it.id.startsWith('ice')) { const col = { ice1: '#ff6aa6', ice2: '#ffc94a', ice3: '#6a8aff' }[it.id]; t.fillStyle = '#d8a060'; t.beginPath(); t.moveTo(30, 48); t.lineTo(66, 48); t.lineTo(48, 90); t.closePath(); t.fill(); t.fillStyle = col; t.beginPath(); t.arc(48, 42, 20, 0, Math.PI * 2); t.fill(); if (it.id === 'ice3') { t.beginPath(); t.arc(48, 22, 15, 0, Math.PI * 2); t.fill(); } }
    else if (it.id === 'coffee') { t.fillStyle = '#f4eefa'; t.fillRect(28, 38, 36, 36); t.strokeStyle = '#f4eefa'; t.lineWidth = 6; t.beginPath(); t.arc(68, 54, 9, -1.3, 1.3); t.stroke(); t.fillStyle = '#6a3e1a'; t.fillRect(31, 40, 30, 8); }
    else if (it.id === 'cake') { t.fillStyle = '#5a2a14'; t.beginPath(); t.moveTo(20, 70); t.lineTo(76, 70); t.lineTo(76, 46); t.lineTo(20, 58); t.closePath(); t.fill(); t.fillStyle = '#f4eefa'; t.fillRect(20, 56, 56, 4); t.fillStyle = '#e0103a'; t.beginPath(); t.arc(60, 44, 6, 0, Math.PI * 2); t.fill(); }
    else if (it.id === 'lemonade') { t.fillStyle = 'rgba(160,255,200,0.8)'; t.beginPath(); t.moveTo(32, 26); t.lineTo(64, 26); t.lineTo(58, 80); t.lineTo(38, 80); t.closePath(); t.fill(); t.fillStyle = '#ffc94a'; t.beginPath(); t.arc(62, 28, 9, 0, Math.PI * 2); t.fill(); }
    else if (it.id === 'apple') { t.fillStyle = '#e0103a'; t.beginPath(); t.arc(48, 54, 22, 0, Math.PI * 2); t.fill(); t.fillStyle = '#3fb04a'; t.beginPath(); t.ellipse(56, 28, 8, 4, -0.5, 0, Math.PI * 2); t.fill(); }
    return c.toDataURL();
  }
  function owned(it) {
    const inv = Inv.get();
    if (it.hat) return inv.hats.includes(it.hat);
    if (it.collar) return inv.collarsOwned && inv.collarsOwned.includes(it.collar);
    if (it.once) return !!inv[it.id];
    return false;
  }
  function openShop(key) {
    const sh = SHOPS[key];
    $('#shopTitle').textContent = sh.title; $('#shopSub').textContent = sh.sub;
    renderShop(key);
    App.openModal('modal-shop');
  }
  function renderShop(key) {
    const sh = SHOPS[key], inv = Inv.get();
    const box = $('#shopItems');
    box.innerHTML = '';
    sh.items.forEach(it => {
      const own = owned(it);
      const wearing = (it.hat && avatar.hat === it.hat) || (it.collar && inv.collar === it.collar);
      const d = document.createElement('div');
      d.className = 'shop-item' + (own ? ' owned' : '');
      d.innerHTML = `<img alt="" src="${itemIcon(it)}"><div class="si-info"><b></b><span></span></div><button type="button" class="si-btn"></button>`;
      d.querySelector('b').textContent = it.name; d.querySelector('span').textContent = it.desc;
      const btn = d.querySelector('button');
      if (own && (it.hat || it.collar)) { btn.textContent = wearing ? I18N.t('Ablegen') : I18N.t('Anlegen'); btn.classList.add('wear'); }
      else if (own) { btn.textContent = I18N.t('Gekauft'); btn.disabled = true; }
      else { btn.innerHTML = `<span class="coin-icon" aria-hidden="true"></span>${U.fmt(it.price)}`; btn.disabled = Store.s.balance < it.price; }
      btn.addEventListener('click', () => buy(key, it));
      box.appendChild(d);
    });
    const inv2 = Inv.get();
    $('#shopInv').textContent = I18N.t('Im Rucksack: {0} Futter · {1} Leckerli', inv2.food, inv2.treats);
  }
  function buy(key, it) {
    Sfx.init();
    const inv = Inv.get();
    if (owned(it)) {
      if (it.hat) { avatar.hat = avatar.hat === it.hat ? null : it.hat; Store.s.avatar = { ...Avatar.load(), hat: avatar.hat }; Store.save(); Floor.refreshAvatar(); Sfx.chip(); }
      if (it.collar) { inv.collar = inv.collar === it.collar ? null : it.collar; Store.save(); Sfx.chip(); }
      renderShop(key); return;
    }
    if (Store.s.balance < it.price) { App.insufficient(it.price); return; }
    Store.s.balance -= it.price; Store.s.stats.spent = (Store.s.stats.spent || 0) + it.price; Store.save();
    Store.emit({ type: 'balance', delta: -it.price });
    Sfx.coin(4);
    if (it.hat) { inv.hats.push(it.hat); avatar.hat = it.hat; Store.s.avatar = { ...Avatar.load(), hat: it.hat }; Floor.refreshAvatar(); Toast.show(I18N.t('Neuer Hut!'), I18N.t('{0} sitzt perfekt.', I18N.t(it.name)), '♛', 'ach'); }
    else if (it.collar) { inv.collarsOwned = inv.collarsOwned || []; inv.collarsOwned.push(it.collar); inv.collar = it.collar; Toast.show(I18N.t('Für Mimi'), I18N.t('{0} gekauft.', I18N.t(it.name)), '♥', 'ach'); }
    else if (it.once) { inv[it.id] = true; }
    else if (it.add) { for (const [k, v] of Object.entries(it.add)) inv[k] = (inv[k] || 0) + v; }
    else if (it.treat) { FX.stars(window.innerWidth / 2, window.innerHeight / 2, 10); }
    Store.save();
    Store.emit({ type: 'shop', item: it.id });
    renderShop(key);
    // Rückmeldung direkt im Laden statt Toast über dem Fenster
    const row = $$('.shop-item', $('#shopItems'))[SHOPS[key].items.indexOf(it)];
    if (row) { row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought');  }
    const invEl = $('#shopInv'); invEl.classList.remove('pulse'); void invEl.offsetWidth; invEl.classList.add('pulse');
    if (it.treat) invEl.textContent = '♪ ' + I18N.t(it.treat);
  }

  /* ---------- Bus ---------- */
  function openBus() {
    const box = $('#busList');
    box.innerHTML = ZONE_ORDER.map(id => {
      const z = ZONES[id], here = Z && Z.id === id;
      return `<button type="button" class="bus-dest${here ? ' here' : ''}" data-zone="${id}" ${here ? 'disabled' : ''}><span class="bd-icon">${ZONE_INFO[id].icon}</span><span><b>${z.name}</b><small>${here ? I18N.t('Du bist hier') : ZONE_INFO[id].desc}</small></span></button>`;
    }).join('');
    $$('.bus-dest', box).forEach(b => b.addEventListener('click', () => { Sfx.click(); App.closeModal(); setTimeout(() => ride(b.dataset.zone), 260); }));
    App.openModal('modal-bus');
  }
  async function ride(to) {
    if (lock) return;
    lock = true; player.path = null; Panel.close();
    const stop = interactives.find(o => o.game === 'bus');
    // Bus fährt ein
    bus.state = 'in'; bus.t = time; bus.x = -300; bus.stopX = stop.x; Sfx.busArrive && Sfx.busArrive();
    await waitBus('stopped');
    await U.sleep(350);
    for (let i = 0; i < 10; i++) { player.alpha = 1 - i / 10; await U.sleep(30); }
    player.alpha = 0;
    await U.sleep(250);
    bus.state = 'out'; bus.t = time; Sfx.busLeave && Sfx.busLeave();
    await U.sleep(900);
    await fadeScreen(true);
    loadZone(to);
    const ns = interactives.find(o => o.game === 'bus');
    player.x = ns.ix; player.y = ns.iy; player.alpha = 0;
    if (Cat.follow) Cat.enter({ area: Z.cat ? Z.cat.area : [player.x - 200, TOP + 60, player.x + 60, WALK_MAX - 10], home: Z.cat ? Z.cat.home : [player.x, player.y] });
    bus.state = 'stopped'; bus.x = ns.x; bus.stopX = ns.x; bus.doors = 1;
    updateCamera(true);
    await fadeScreen(false);
    for (let i = 0; i < 10; i++) { player.alpha = i / 10; await U.sleep(30); }
    player.alpha = 1; player.y += 14;
    await U.sleep(250);
    bus.state = 'out'; bus.t = time; Sfx.busLeave && Sfx.busLeave();
    lock = false;
    Store.emit({ type: 'travel', zone: to, withCat: Cat.follow && to !== 'neighborhood' });
  }
  function waitBus(state) { return new Promise(res => { const chk = () => { if (bus.state === state) res(); else setTimeout(chk, 50); }; chk(); }); }
  function fadeScreen(on) {
    const f = $('#fade');
    return new Promise(res => {
      if (on) { f.hidden = false; f.classList.remove('out'); void f.offsetWidth; f.classList.add('in'); setTimeout(res, 260); }
      else { f.classList.remove('in'); f.classList.add('out'); setTimeout(() => { f.hidden = true; res(); }, 320); }
    });
  }
  function updateBus(dt) {
    if (bus.state === 'in') {
      const u = Math.min(1, (time - bus.t) / 1.8);
      bus.x = -300 + (bus.stopX + 300) * U.easeOutCubic(u);
      if (u >= 1) { bus.state = 'stopped'; bus.doors = 0; Sfx.busDoor && Sfx.busDoor(); }
    } else if (bus.state === 'stopped') { bus.doors = Math.min(1, bus.doors + dt * 3); }
    else if (bus.state === 'out') {
      bus.doors = Math.max(0, bus.doors - dt * 4);
      const u = (time - bus.t) / 2.2;
      bus.x = bus.stopX + Math.pow(u, 2) * 1400;
      if (bus.x > WW + 400) bus.state = 'gone';
    }
  }
  function drawBus() {
    if (bus.state === 'gone') return;
    const x = bus.x, y = ROAD_Y + 96;
    shadow(x, y + 2, 170, 16, 0.45);
    const bg = g.createLinearGradient(0, y - 110, 0, y);
    bg.addColorStop(0, '#ff6aa6'); bg.addColorStop(1, '#a0105a');
    g.fillStyle = bg; rr(x - 170, y - 100, 340, 92, 14); g.fill();
    g.fillStyle = '#5a0a30'; rr(x - 170, y - 108, 340, 14, [12, 12, 0, 0]); g.fill();
    g.fillStyle = 'rgba(160,220,255,0.75)';
    for (let i = 0; i < 6; i++) rr(x - 150 + i * 44, y - 88, 36, 30, 4), g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 6; i++) g.fillRect(x - 146 + i * 44, y - 86, 8, 26);
    // Tür (öffnet sich)
    const dx = x + 110, open = bus.doors;
    g.fillStyle = '#2a0a1a'; g.fillRect(dx - 20, y - 90, 40, 82);
    g.fillStyle = 'rgba(160,220,255,0.6)'; g.fillRect(dx - 20, y - 90, 20 - open * 16, 82); g.fillRect(dx + open * 16, y - 90, 20 - open * 16, 82);
    g.fillStyle = '#ffc94a'; g.fillRect(x - 170, y - 50, 340, 6);
    g.font = '700 14px Bungee, Impact, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('NEON LINE 7', x - 150, y - 32);
    g.fillStyle = '#fff6c8'; rr(x + 160, y - 44, 10, 12, 3); g.fill();
    g.fillStyle = '#111'; [[-110], [100]].forEach(([wx]) => { g.beginPath(); g.arc(x + wx, y - 6, 17, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a8298'; g.beginPath(); g.arc(x + wx, y - 6, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; });
    const hl = g.createRadialGradient(x + 175, y - 38, 0, x + 175, y - 38, 90); hl.addColorStop(0, 'rgba(255,240,190,0.4)'); hl.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(x + 175, y - 38, 90, 0, Math.PI * 2); g.fill();
  }

  /* ---------- Interaktion ---------- */
  function interact(o) {
    if (!o || lock) return;
    Sfx.init(); Sfx.click();
    if (o.game === 'cat') { Panel.open(); return; }
    if (o.game === 'bus') { openBus(); return; }
    if (o.game === 'casino') { goCasino(); return; }
    if (o.game === 'home') { Toast.show(I18N.t('Dein Zuhause'), Cat.present || Cat.follow ? I18N.t('Mimi wohnt hier. Ihr Napf steht vor der Tür.') : I18N.t('Gemütlich – aber das Geld liegt im Casino.'), '⌂'); return; }
    if (o.game.startsWith('shop:')) { openShop(o.game.slice(5)); return; }
    if (o.game === 'swing') { usePlay('swing', o); return; }
    if (o.game === 'slide') { usePlay('slide', o); return; }
    if (o.game === 'sand') { usePlay('sand', o); return; }
    if (o.game === 'seesaw') { usePlay('seesaw', o); return; }
    if (o.game === 'spring') { usePlay('spring', o); return; }
  }
  async function usePlay(kind, o) {
    if (player.pose) return;
    if (kind === 'spring') { player.pose = { kind: 'spring', o }; Sfx.bounce(1); await U.sleep(3200); player.pose = null; player.y = o.iy; return; }
    const used = Store.s.played_pg || (Store.s.played_pg = {});
    used[kind] = 1; Store.save();
    Store.emit({ type: 'playground', kind, all: ['swing', 'slide', 'sand', 'seesaw'].every(k => used[k]) });
    if (kind === 'swing') {
      play.swingT = time; player.pose = { kind: 'swing', o };
      Sfx.win(1);
      await U.sleep(5000); player.pose = null; player.y = o.iy + 6;
    } else if (kind === 'slide') {
      player.pose = { kind: 'slide', t0: time, o };
      await U.sleep(2400); player.pose = null; player.x = o.x + 90; player.y = o.y + 20;
      if (collides(player.x, player.y)) { player.x = o.ix; player.y = o.iy; }
      Sfx.win(1);
    } else if (kind === 'sand') {
      if (play.castles.length >= 4) { Toast.show(I18N.t('Sandkasten'), I18N.t('Der Sandkasten ist voller Burgen!'), '★'); return; }
      player.pose = { kind: 'dig', t0: time };
      for (let i = 0; i < 6; i++) { Sfx.scratch(); await U.sleep(200); }
      play.castles.push({ dx: -60 + play.castles.length * 36 });
      player.pose = null;
      Toast.show(I18N.t('Sandburg gebaut'), I18N.t('Ein Meisterwerk der Baukunst.'), '★');
    } else if (kind === 'seesaw') {
      const kid = npcs.filter(n => n.kid).sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0];
      if (!kid) { Toast.show(I18N.t('Wippe'), I18N.t('Allein wippt es sich schlecht.'), '·'); return; }
      o.busy = true; player.pose = { kind: 'seesaw', o };
      kid.path = null; kid.x = o.x + 80; kid.y = o.y + 12; kid.wait = 5; kid.seesaw = o;
      await U.sleep(4000); o.busy = false; player.pose = null; kid.seesaw = null;
    }
  }
  function goCasino() {
    lock = true;
    fadeScreen(true).then(() => {
      Floor.placeAt('exit');
      location.hash = 'floor';
      lock = false;
      setTimeout(() => fadeScreen(false), 60);
    });
  }

  /* ---------- Zeichnen ---------- */
  function drawGround() {
    const gp = Z.ground === 'grass' ? grassPat() : Z.ground === 'asphalt' ? asphaltPat() : plazaPat();
    g.fillStyle = '#0a0612'; g.fillRect(-EX, -300, WW + EX * 2, WH + 600);
    g.fillStyle = gp; g.fillRect(-EX, TOP - 40, WW + EX * 2, 780 - TOP + 40);
    if (Z.id === 'neighborhood') { g.fillStyle = pavePat(); g.fillRect(0, 520, WW, 60); g.fillRect(520, TOP, 80, 200); }
    if (Z.id === 'plaza') { g.fillStyle = '#8a1030'; g.fillRect(760, TOP, 80, 360); g.fillStyle = '#c98a12'; g.fillRect(758, TOP, 3, 360); g.fillRect(839, TOP, 3, 360); }
    if (Z.parking) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; for (let x = 180; x < 1200; x += 130) { g.beginPath(); g.moveTo(x, 490); g.lineTo(x, 600); g.stroke(); } }
    if (Z.rubber) { const [x0, y0, x1, y1] = Z.rubber; g.fillStyle = rubberPat(); rr(x0, y0, x1 - x0, y1 - y0 + 60, 30); g.fill(); g.strokeStyle = 'rgba(30,6,20,0.7)'; g.lineWidth = 5; rr(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 + 56, 28); g.stroke(); g.strokeStyle = 'rgba(255,140,200,0.25)'; g.lineWidth = 2; rr(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 64, 32); g.stroke(); }
    // Himmel/Hintergrund über dem Ort
    const sky = g.createLinearGradient(0, 0, 0, TOP);
    sky.addColorStop(0, '#07041a'); sky.addColorStop(1, '#2a0e3a');
    g.fillStyle = sky; g.fillRect(-EX, -300, WW + EX * 2, TOP - 40 + 300);
    for (let i = 0; i < 120; i++) { const r = rnd(i + 3); g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * (WW + EX * 2) - EX, r() * (TOP + 200) - 260, 1.5, 1.5); }
    drawSkyline();
    drawStreet(WW);
  }
  function drawSkyline() {
    const r = rnd(42 + ZONE_ORDER.indexOf(Z.id));
    for (let x = -EX; x < WW + EX; x += 70 + r() * 40) {
      const h = 60 + r() * 140, w = 50 + r() * 50;
      g.fillStyle = '#140a24'; g.fillRect(x, TOP - 40 - h, w, h);
      for (let i = 0; i < h / 18; i++) for (let j = 0; j < w / 16; j++) if (r() < 0.3) { g.fillStyle = r() < 0.5 ? 'rgba(255,210,140,0.6)' : 'rgba(59,232,255,0.5)'; g.fillRect(x + 5 + j * 16, TOP - 40 - h + 8 + i * 18, 6, 8); }
    }
    g.fillStyle = 'rgba(255,61,139,0.25)'; g.fillRect(-EX, TOP - 42, WW + EX * 2, 2);
  }
  function drawEdges() { // außerhalb des begehbaren Bereichs abdunkeln
    for (const [x0, dir] of [[0, -1], [WW, 1]]) {
      const eg = g.createLinearGradient(x0, 0, x0 + dir * 160, 0); eg.addColorStop(0, 'rgba(6,2,14,0)'); eg.addColorStop(1, 'rgba(6,2,14,0.72)');
      g.fillStyle = eg; g.fillRect(dir < 0 ? x0 - EX : x0, TOP - 60, EX, ROAD_Y - TOP + 60);
    }
  }
  function drawChar(ch, isPlayer) {
    if (isPlayer && player.alpha <= 0) return;
    g.save(); if (isPlayer) g.globalAlpha = player.alpha;
    let { x, y, dir, phase, moving } = ch, sit = null;
    if (isPlayer && player.pose) {
      const p = player.pose;
      if (p.kind === 'spring' && p.o.seat) { x = p.o.seat.x; y = p.o.seat.y; dir = 0; moving = false; sit = { sit: true, noShadow: true }; }
      if (p.kind === 'swing' && p.o.seat) { x = p.o.seat.x; y = p.o.seat.y; dir = 0; moving = false; sit = { sit: true, noShadow: true, kick: true }; phase = time * 6; }
      if (p.kind === 'slide') {
        const t = Math.min(1, (time - p.t0) / 2.4), o = p.o;
        if (t < 0.45) { const u = t / 0.45; x = o.x - 42; y = o.y + 6 - u * 104; dir = 3; moving = true; phase = time * 12; }
        else { const u = (t - 0.45) / 0.55; x = o.x - 12 + u * 90; y = o.y - 96 + u * 104 + Math.sin(u * Math.PI) * -6 ; dir = 2; moving = false; }
      }
      if (p.kind === 'dig') { dir = 3; moving = true; phase = time * 18; }
      if (p.kind === 'seesaw') { const a = Math.sin(time * 2.4) * 0.28; x = p.o.x - 60 * Math.cos(a); y = p.o.y - 19 - Math.sin(a) * 60; dir = 0; moving = false; sit = { sit: true, noShadow: true }; }
    }
    if (!isPlayer && ch.seesaw) { const a = Math.sin(time * 2.4) * 0.28, o = ch.seesaw; x = o.x + 60 * Math.cos(a); y = o.y - 21 + Math.sin(a) * 60; dir = 0; moving = false; sit = { sit: true, noShadow: true }; }
    if (ch.kid) { g.translate(x, y); g.scale(0.72, 0.72); x = 0; y = 0; }
    Avatar.draw(g, x, y, ch.a || avatar, dir, phase, moving, sit || {});
    if (isPlayer) {
      const name = (avatar.name || 'Gast').slice(0, 14);
      g.font = '600 11px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(name).width + 14;
      g.fillStyle = 'rgba(10,4,20,0.75)'; rr(x - tw / 2, y - (avatar.hat ? 100 : 88), tw, 17, 8.5); g.fill();
      g.fillStyle = '#ffe7a0'; g.fillText(name, x, y - (avatar.hat ? 91.5 : 79.5));
    }
    g.restore();
  }
  function render() {
    g.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
    drawGround();
    g.globalCompositeOperation = 'lighter';
    (Z.lights || []).forEach(([x, y, r, c, a]) => pool(x, y, r, c, a));
    g.globalCompositeOperation = 'source-over';
    if (near && near.game !== 'cat' && !player.pose && player.alpha >= 1) {
      const a = 0.55 + 0.35 * Math.sin(time * 5);
      g.strokeStyle = hexA(near.glow || '#ffc94a', a); g.lineWidth = 2.5; g.beginPath(); g.ellipse(near.ix, near.iy, 30, 10, 0, 0, Math.PI * 2); g.stroke();
    }
    const list = [];
    for (const o of objects) list.push({ y: o.sortY, f: () => DRAW[o.kind](o) });
    for (const n of npcs) list.push({ y: n.y, f: () => drawChar(n) });
    list.push({ y: Cat.y + (Cat.dist(player) < 60 ? 30 : 0), f: () => Cat.draw() });
    if (Cat.yarnY >= 0) list.push({ y: Cat.yarnY + 1, f: () => Cat.drawYarn() }); // nahe Mimi nicht hinter Bäumen verstecken
    const pY = player.pose && player.pose.kind === 'swing' ? player.pose.o.y + 30 : player.y;
    list.push({ y: pY, f: () => drawChar(player, true) });
    list.push({ y: ROAD_Y + 100, f: drawBus });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f();
    drawEdges();
    // Nachtlicht
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(10,4,30,0)'); vg.addColorStop(1, 'rgba(10,4,30,0.7)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function toScreen(x, y) { const r = canvas.getBoundingClientRect(); return [r.left + (x - camX) * zoom, r.top + (y - camY) * zoom]; }

  function updateCamera(snap) {
    const vw = W / zoom, vh = H / zoom;
    const tx = U.clamp(player.x - vw / 2, 0, Math.max(0, WW - vw));
    const top = TOP - 250, span = VIEW_BOTTOM - top;
    const ty = vh > span ? top - (vh - span) * 0.2 : U.clamp(player.y - vh * 0.6, top, VIEW_BOTTOM - vh);
    if (snap) { camX = tx; camY = ty; } else { camX += (tx - camX) * 0.12; camY += (ty - camY) * 0.12; }
    if (vw > WW) camX = (WW - vw) / 2;
  }
  function updatePrompt() {
    if (!near || lock || player.pose || Panel.open_) { promptEl.hidden = true; promptEl.__for = null; actionBtn.disabled = true; return; }
    promptEl.hidden = false;
    if (promptEl.__for !== near) {
      promptEl.__for = near; promptName.textContent = near.label; promptSub.textContent = near.sub || '';
      promptKey.textContent = near.game === 'bus' ? 'einsteigen' : near.game === 'cat' ? 'kümmern' : near.game.startsWith('shop:') ? 'einkaufen' : near.game === 'casino' ? 'eintreten' : 'benutzen';
      actionBtn.querySelector('b').textContent = near.game === 'bus' ? 'Bus' : near.game === 'cat' ? 'Mimi' : near.game.startsWith('shop:') ? 'Laden' : near.game === 'casino' ? 'Casino' : 'Benutzen';
    }
    const sx = (near.x - camX) * zoom, sy = (near.y - (near.vh || 60) - 40 - camY) * zoom;
    promptEl.style.transform = `translate(${Math.round(U.clamp(sx, 110, W - 110))}px, ${Math.round(Math.max(promptEl.offsetHeight + 12, sy))}px) translate(-50%, -100%)`;
    actionBtn.disabled = false;
  }
  function loop(now) {
    if (!active) { raf = null; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; time += dt; frame++;
    updatePlayer(dt); updateNpcs(dt); Cat.update(dt); updateBus(dt);
    updateCamera(false); render(); updatePrompt();
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
    zoom = U.clamp(Math.min(W / 1150, H / (VIEW_BOTTOM - ((Z ? Z.top : 330) - 250))), 0.6, 1.25);
    for (const k in patterns) delete patterns[k];
    updateCamera(true);
  }

  /* ---------- Eingaben ---------- */
  function screenToWorld(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / zoom + camX, y: (cy - r.top) / zoom + camY }; }
  function hit(p) {
    if (Cat.dist(p) < 30) return Cat.target();
    let best = null;
    for (const o of interactives) {
      const hw = Math.max(o.fw, 60) / 2 + 6, top = o.y - (o.vh || 80) - 30;
      if (p.x > o.x - hw && p.x < o.x + hw && p.y > top && p.y < o.y + 14) if (!best || o.sortY > best.sortY) best = o;
    }
    return best;
  }
  canvas.addEventListener('pointerdown', e => {
    if (lock || player.pose) return;
    Sfx.init();
    const p = screenToWorld(e.clientX, e.clientY), o = hit(p);
    if (o) {
      if (near === o && (o.game === 'cat' || distTo(o) < 64)) { interact(o); return; }
      player.path = findPath(player.x, player.y, o.ix, o.iy); pendingInteract = o;
    } else { player.path = findPath(player.x, player.y, p.x, p.y); pendingInteract = null; }
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') canvas.style.cursor = hit(screenToWorld(e.clientX, e.clientY)) ? 'pointer' : 'default'; });
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); Sfx.init(); joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; moveJoy(e); });
  function moveJoy(e) {
    if (e.pointerId !== joy.id) return;
    const R = joyEl.clientWidth / 2; let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    joy.dx = dx / R; joy.dy = dy / R; if (Math.hypot(joy.dx, joy.dy) < 0.18) joy.dx = joy.dy = 0;
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

  // Casino-Ausgang führt auf den Vorplatz
  Floor.exitToTown = () => { Store.s.town = { zone: 'plaza', fromCasino: true }; Store.save(); App.enter('town'); };

  return {
    show() {
      active = true; avatar = Avatar.load();
      const st = Store.s.town || { zone: 'plaza' };
      const z = ZONES[st.zone] ? st.zone : 'plaza';
      requestAnimationFrame(() => {
        resize();
        if (!Z || Z.id !== z || st.fromCasino) loadZone(z, z === 'plaza' && st.fromCasino ? [800, 400] : null);
        if (st.fromCasino) { st.fromCasino = false; Store.save(); }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
      });
    },
    hide() { active = false; keys.clear(); Panel.close(); },
    key(e) {
      const move = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
      if (move.includes(e.code)) { e.preventDefault(); keys.add(e.code); return true; }
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (near) interact(near); return true; }
      if (e.code === 'Escape' && Panel.open_) { Panel.close(); return true; }
      return false;
    },
    refreshAvatar() { avatar = Avatar.load(); },
    get zones() { return ZONES; },
    get player() { return player; },
    get cat() { return Cat; },
  };
})();

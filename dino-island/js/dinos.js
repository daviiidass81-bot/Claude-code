'use strict';
/* ==========================================================
   DinoArt – procedural, animated dinosaur renderer
   Bodies are built from a spine spline with thickness
   profile, IK legs and species-specific heads & features.
   Local space: facing right, ground at y = 0, up is -y.
   ========================================================== */
const DinoArt = (() => {
  // ---------- body plans ----------
  const PLANS = {
    rex: { biped: true, hipH: 76, bodyLen: 46, tT: 22, tB: 27, arch: 4, tailLen: 118, tailDrop: -8, tailT: 0.8, neckLen: 24, neckA: 0.55, neckT: [16, 13], head: 'rex', headLen: 48, headH: 30, headPitch: 0.15, thigh: 36, shin: 34, legW: 17, foot: 14, stride: 24, arms: 'tiny', pattern: 'stripes', scales: true },
    allo: { biped: true, hipH: 70, bodyLen: 46, tT: 18, tB: 22, arch: 4, tailLen: 112, tailDrop: -6, tailT: 0.75, neckLen: 26, neckA: 0.6, neckT: [13, 10], head: 'allo', headLen: 42, headH: 22, headPitch: 0.18, thigh: 33, shin: 33, legW: 14, foot: 13, stride: 24, arms: 'medium', pattern: 'stripes' },
    carno: { biped: true, hipH: 72, bodyLen: 42, tT: 17, tB: 20, arch: 3, tailLen: 96, tailDrop: -6, tailT: 0.8, neckLen: 22, neckA: 0.5, neckT: [13, 11], head: 'carno', headLen: 32, headH: 24, headPitch: 0.12, thigh: 34, shin: 36, legW: 14, foot: 13, stride: 26, arms: 'stub', pattern: 'rosettes' },
    spino: { biped: true, hipH: 62, bodyLen: 60, tT: 19, tB: 24, arch: 5, tailLen: 124, tailDrop: -4, tailT: 0.95, tailFin: true, neckLen: 40, neckA: 0.48, neckT: [12, 9], head: 'croc', headLen: 58, headH: 16, headPitch: 0.2, thigh: 28, shin: 30, legW: 14, foot: 13, stride: 20, arms: 'long', pattern: 'stripes', sail: true },
    bary: { biped: true, hipH: 66, bodyLen: 50, tT: 18, tB: 20, arch: 3, tailLen: 104, tailDrop: -4, tailT: 0.8, neckLen: 34, neckA: 0.45, neckT: [11, 9], head: 'croc', headLen: 50, headH: 14, headPitch: 0.2, thigh: 30, shin: 32, legW: 13, foot: 13, stride: 22, arms: 'long', pattern: 'blotch', crestRidge: true },
    raptor: { biped: true, hipH: 48, bodyLen: 32, tT: 12, tB: 14, arch: 2, tailLen: 84, tailDrop: -8, tailT: 0.55, stiffTail: true, neckLen: 24, neckA: 0.95, neckT: [8, 6], head: 'raptor', headLen: 28, headH: 12, headPitch: 0.35, thigh: 24, shin: 26, legW: 9, foot: 11, stride: 20, arms: 'raptor', pattern: 'stripes', quills: true, sickle: true },
    dilo: { biped: true, hipH: 60, bodyLen: 38, tT: 14, tB: 16, arch: 3, tailLen: 92, tailDrop: -5, tailT: 0.65, neckLen: 30, neckA: 0.8, neckT: [9, 7], head: 'dilo', headLen: 32, headH: 15, headPitch: 0.3, thigh: 28, shin: 30, legW: 11, foot: 12, stride: 22, arms: 'medium', pattern: 'spots' },
    ornitho: { biped: true, hipH: 70, bodyLen: 30, tT: 13, tB: 15, arch: 2, tailLen: 80, tailDrop: -2, tailT: 0.6, stiffTail: true, neckLen: 44, neckA: 1.12, neckT: [7, 4.5], head: 'ornitho', headLen: 18, headH: 9, headPitch: 0.5, thigh: 34, shin: 40, legW: 9, foot: 11, stride: 30, arms: 'medium', pattern: 'spots' },
    pachy: { biped: true, hipH: 50, bodyLen: 34, tT: 16, tB: 18, arch: 3, tailLen: 72, tailDrop: -4, tailT: 0.8, neckLen: 20, neckA: 0.7, neckT: [11, 9], head: 'pachy', headLen: 26, headH: 20, headPitch: 0.1, thigh: 26, shin: 26, legW: 11, foot: 11, stride: 18, arms: 'small', pattern: 'blotch' },
    cera: { quad: true, hipH: 58, shH: 46, bodyLen: 60, tT: 26, tB: 28, arch: 10, tailLen: 68, tailDrop: 10, tailT: 0.8, neckLen: 14, neckA: -0.25, neckT: [20, 18], head: 'cera', headLen: 44, headH: 28, headPitch: -0.1, thigh: 30, shin: 26, legW: 15, foot: 10, stride: 16, fThigh: 24, fShin: 22, fLegW: 11, pattern: 'blotch', scales: true },
    hadro: { quad: true, hipH: 66, shH: 48, bodyLen: 56, tT: 24, tB: 26, arch: 8, tailLen: 104, tailDrop: -2, tailT: 0.9, neckLen: 30, neckA: 0.55, neckT: [13, 10], head: 'hadro', headLen: 36, headH: 18, headPitch: 0.35, thigh: 34, shin: 30, legW: 15, foot: 12, stride: 18, fThigh: 22, fShin: 22, fLegW: 8, pattern: 'stripes' },
    stego: { quad: true, hipH: 64, shH: 38, bodyLen: 64, tT: 26, tB: 26, arch: 16, tailLen: 84, tailDrop: 14, tailT: 0.8, neckLen: 20, neckA: -0.35, neckT: [12, 9], head: 'stego', headLen: 20, headH: 11, headPitch: -0.2, thigh: 34, shin: 30, legW: 15, foot: 10, stride: 16, fThigh: 20, fShin: 18, fLegW: 10, pattern: 'blotch', plates: true, thagomizer: true },
    anky: { quad: true, hipH: 42, shH: 38, bodyLen: 70, tT: 24, tB: 18, arch: 6, tailLen: 78, tailDrop: 6, tailT: 0.75, neckLen: 12, neckA: -0.15, neckT: [15, 13], head: 'anky', headLen: 26, headH: 16, headPitch: 0, thigh: 22, shin: 20, legW: 13, foot: 9, stride: 12, fThigh: 18, fShin: 18, fLegW: 11, pattern: 'none', armor: true, club: true },
    sauropod: { quad: true, hipH: 86, shH: 104, bodyLen: 80, tT: 34, tB: 36, arch: 8, tailLen: 124, tailDrop: 16, tailT: 0.7, neckLen: 140, neckA: 1.2, neckT: [17, 7], head: 'sauropod', headLen: 20, headH: 12, headPitch: -0.9, thigh: 42, shin: 40, legW: 18, foot: 10, stride: 18, fThigh: 50, fShin: 48, fLegW: 15, pattern: 'blotch', scales: true },
  };

  function buildSpine(p, pose) {
    const N = [];
    const tailN = 7;
    const hipY = -p.hipH, shY = -(p.shH || p.hipH + 2);
    for (let i = 0; i < tailN; i++) {
      const k = i / tailN;
      const x = -p.tailLen * (1 - k);
      const y = hipY + p.tailDrop * Math.pow(1 - k, 1.4);
      const th = lerp(1.3, p.tT * 0.85, Math.pow(k, 1.25)), bh = lerp(1.3, p.tB * 0.7, Math.pow(k, 1.4));
      N.push({ x, y, t: th * (p.tailFin ? 1 + (1 - k) * 0.9 * (1 - k) : 1), b: bh * (p.tailFin ? 1 + (1 - k) * 1.2 * (1 - k) : 1), tail: 1 - k });
    }
    const hipI = N.length;
    N.push({ x: 0, y: hipY, t: p.tT, b: p.tB * 0.85 });
    const tor = 3;
    for (let i = 1; i <= tor; i++) {
      const k = i / (tor + 1);
      N.push({ x: p.bodyLen * k, y: lerp(hipY, shY, k) - p.arch * Math.sin(Math.PI * k), t: p.tT * (1 - 0.1 * k), b: p.tB * (1 + 0.15 * Math.sin(Math.PI * k)) });
    }
    const shI = N.length;
    N.push({ x: p.bodyLen, y: shY, t: p.tT * 0.82, b: p.tB * 0.8 });
    const neckN = p.neckLen > 60 ? 6 : 3;
    let a = p.neckA + (pose.neckA || 0);
    for (let i = 1; i <= neckN; i++) {
      const k = i / neckN;
      const bend = pose.neckCurl ? pose.neckCurl * k * k : 0;
      const aa = a - bend;
      const prev = N[N.length - 1];
      const seg = p.neckLen / neckN;
      N.push({ x: prev.x + Math.cos(aa) * seg, y: prev.y - Math.sin(aa) * seg, t: lerp(p.neckT[0], p.neckT[1], k), b: lerp(p.neckT[0] * 1.1, p.neckT[1] * 0.95, k), neck: k });
    }
    return { N, hipI, shI };
  }

  function normals(N) {
    for (let i = 0; i < N.length; i++) {
      const a = N[Math.max(0, i - 1)], b = N[Math.min(N.length - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      N[i].tx = dx; N[i].ty = dy; N[i].nx = dy; N[i].ny = -dx; // normal pointing "up" (dorsal)
    }
  }
  function outline(N) {
    const top = N.map(n => [n.x + n.nx * n.t, n.y + n.ny * n.t]);
    const bot = N.map(n => [n.x - n.nx * n.b, n.y - n.ny * n.b]);
    return { top, bot };
  }
  function bodyPath(ctx, top, bot) {
    const pts = top.concat(bot.slice().reverse());
    ctx.beginPath();
    // open curve over the dorsal line, then back along the belly
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length - 1; i++) ctx.quadraticCurveTo(top[i][0], top[i][1], (top[i][0] + top[i + 1][0]) / 2, (top[i][1] + top[i + 1][1]) / 2);
    ctx.lineTo(top[top.length - 1][0], top[top.length - 1][1]);
    const rb = bot.slice().reverse();
    ctx.lineTo(rb[0][0], rb[0][1]);
    for (let i = 1; i < rb.length - 1; i++) ctx.quadraticCurveTo(rb[i][0], rb[i][1], (rb[i][0] + rb[i + 1][0]) / 2, (rb[i][1] + rb[i + 1][1]) / 2);
    ctx.lineTo(rb[rb.length - 1][0], rb[rb.length - 1][1]);
    ctx.closePath();
    return pts;
  }

  function limb(ctx, a, b, wa, wb, fill, stroke) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * wa, a[1] + ny * wa);
    ctx.lineTo(b[0] + nx * wb, b[1] + ny * wb);
    ctx.arc(b[0], b[1], wb, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(a[0] - nx * wa, a[1] - ny * wa);
    ctx.arc(a[0], a[1], wa, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function ik(h, f, l1, l2, forward) {
    let dx = f[0] - h[0], dy = f[1] - h[1];
    let d = Math.hypot(dx, dy);
    const maxd = (l1 + l2) * 0.995;
    if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    d = Math.max(d, Math.abs(l1 - l2) + 0.1);
    const base = Math.atan2(dy, dx);
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ang = forward ? base - a : base + a;
    const knee = [h[0] + Math.cos(ang) * l1, h[1] + Math.sin(ang) * l1];
    return { knee, foot: [h[0] + dx, h[1] + dy] };
  }
  function limbGrad(ctx, a, b, w, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const g = ctx.createLinearGradient(a[0] - nx * w, a[1] - ny * w, a[0] + nx * w, a[1] + ny * w);
    g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.18));
    return g;
  }

  function drawLeg(ctx, p, hip, phase, far, pal, front, pose, anim) {
    const w = (front ? p.fLegW : p.legW) * (p.quad ? 1.15 : 1);
    const stride = (front ? 0.85 : 1) * p.stride * anim.speed;
    const lift = (front ? 8 : 11) * anim.speed;
    const s = Math.sin(phase * TAU), c = Math.cos(phase * TAU);
    const ankleH = p.biped ? (front ? 0 : 6 + p.foot * 0.2) : 3;
    // leg lengths follow the (animated) hip height so legs stay planted
    const restH = -hip[1] + (anim.lower || 0) - ankleH - (anim.bob || 0);
    const total = restH * (p.biped ? 1.14 : 1.03);
    const l1 = total * (front ? 0.5 : 0.52), l2 = total - l1;
    let fx = hip[0] + (front ? -2 : 4) + stride * s;
    let fy = -ankleH - lift * Math.max(0, c);
    if (pose.sleep) { fx = hip[0] + (front ? 16 : 18); fy = -3; }
    if (pose.kick && !front && !far) { fx += 10; fy -= 18; }
    const col = far ? shade(pal.base, -0.3) : pal.base;
    const bent = ik(hip, [fx, fy], l1, l2, !front);
    const edge = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.9;
    // thigh (big muscle)
    if (!front) { ctx.fillStyle = limbGrad(ctx, hip, bent.knee, w * 1.2, col); ctx.beginPath(); ctx.ellipse(hip[0] + (bent.knee[0] - hip[0]) * 0.3, hip[1] + (bent.knee[1] - hip[1]) * 0.3, w * (p.quad ? 1.05 : 1.25), l1 * 0.48, Math.atan2(bent.knee[1] - hip[1], bent.knee[0] - hip[0]) - Math.PI / 2, 0, TAU); ctx.fill(); ctx.strokeStyle = edge; ctx.stroke(); }
    limb(ctx, hip, bent.knee, w, w * 0.55, limbGrad(ctx, hip, bent.knee, w, col), front ? edge : null);
    limb(ctx, bent.knee, bent.foot, w * 0.52, w * 0.34, limbGrad(ctx, bent.knee, bent.foot, w * 0.5, shade(col, -0.05)), edge);
    // foot / toes
    const [ax, ay] = bent.foot;
    const fl = p.foot * (front ? 0.6 : 1);
    ctx.fillStyle = shade(col, -0.12); ctx.strokeStyle = edge;
    if (p.biped && !front) {
      const toeY = Math.min(0, ay + ankleH) ;
      ctx.beginPath();
      ctx.moveTo(ax - w * 0.3, ay);
      ctx.quadraticCurveTo(ax + fl * 0.3, toeY - 3, ax + fl, toeY);
      ctx.lineTo(ax + fl * 0.2, toeY + 0.5);
      ctx.lineTo(ax - w * 0.35, ay + 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax + fl, toeY); ctx.lineTo(ax + fl + 3, toeY + 1.5); ctx.stroke();
      if (p.sickle) { ctx.strokeStyle = '#1a140e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax + fl * 0.35, toeY - 2); ctx.quadraticCurveTo(ax + fl * 0.5, toeY - 9, ax + fl * 0.8, toeY - 7); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.ellipse(ax + 1, ay + 1, w * 0.5, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(ax + 1 + k * w * 0.28 + 2, ay + 2.5, 1.3, 0, TAU); ctx.fill(); }
    }
  }

  function drawArm(ctx, p, sh, far, pal, anim, pose) {
    const type = p.arms;
    if (!type) return;
    const sz = { tiny: [9, 8, 2.6], stub: [5, 4, 2.4], small: [10, 9, 3], medium: [14, 12, 3.4], long: [18, 16, 4.4], raptor: [15, 14, 3.4] }[type];
    const col = far ? shade(pal.base, -0.3) : shade(pal.base, -0.05);
    const sway = Math.sin(anim.t * 2 + (far ? 1 : 0)) * 0.12 + (pose.roar ? -0.5 : 0) + (pose.attack ? -0.9 : 0);
    const a1 = 1.1 + sway, a2 = -0.5 + sway;
    const e = [sh[0] + Math.cos(a1) * sz[0], sh[1] + Math.sin(a1) * sz[0]];
    const h = [e[0] + Math.cos(a2) * sz[1], e[1] + Math.sin(a2) * sz[1]];
    ctx.lineWidth = 0.8;
    limb(ctx, sh, e, sz[2], sz[2] * 0.75, col, 'rgba(0,0,0,0.35)');
    limb(ctx, e, h, sz[2] * 0.75, sz[2] * 0.55, col, 'rgba(0,0,0,0.35)');
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = type === 'long' || type === 'raptor' ? 1.4 : 1;
    const cl = type === 'long' ? 7 : type === 'raptor' ? 5 : 3;
    for (let k = 0; k < (type === 'tiny' || type === 'stub' ? 2 : 3); k++) { ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo(h[0] + cl * 0.6, h[1] + k * 1.5, h[0] + cl * 0.5, h[1] + cl * 0.6 + k * 1.5); ctx.stroke(); }
    if (p.quills && !far) { ctx.strokeStyle = rgba(pal.accent, 0.9); ctx.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const t = 0.3 + k * 0.2; const bx = lerp(e[0], h[0], t), by = lerp(e[1], h[1], t); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 5, by + 5); ctx.stroke(); } }
  }

  /* ---------- heads (local: origin at neck joint, +x forward) ---------- */
  function eye(ctx, x, y, r, pal, closed, statue) {
    if (closed) { ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0.2, Math.PI - 0.2); ctx.stroke(); return; }
    ctx.fillStyle = statue ? shade(pal.base, -0.3) : '#1a120a'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 1.05, 0, 0, TAU); ctx.fill();
    if (statue) return;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.2, x, y, r);
    g.addColorStop(0, shade(pal.eye, 0.4)); g.addColorStop(1, shade(pal.eye, -0.3));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.ellipse(x + r * 0.1, y, r * 0.28, r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, TAU); ctx.fill();
  }
  function teeth(ctx, x0, y0, x1, y1, n, len, up) {
    ctx.fillStyle = '#f6efdc';
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      const L = len * (0.7 + 0.3 * Math.sin(i * 1.7 + 1));
      ctx.beginPath(); ctx.moveTo(x - 1.2, y); ctx.lineTo(x + 0.2, y + (up ? -L : L)); ctx.lineTo(x + 1.4, y); ctx.closePath(); ctx.fill();
    }
  }
  function skinFill(ctx, pal, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, pal.dark); g.addColorStop(0.45, pal.base); g.addColorStop(0.85, mix(pal.base, pal.belly, 0.6)); g.addColorStop(1, pal.belly);
    return g;
  }
  function theropodHead(ctx, p, pal, jaw, o) {
    // generic theropod skull; o: {L,H, snout (0..1 taper), horns, crest, brow}
    const L = o.L, H = o.H;
    const hinge = [L * 0.22, H * 0.22];
    const edge = 'rgba(0,0,0,0.45)';
    // lower jaw
    ctx.save(); ctx.translate(hinge[0], hinge[1]); ctx.rotate(jaw * 0.75);
    ctx.fillStyle = mix(pal.base, pal.belly, 0.55); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-L * 0.2, -H * 0.12); ctx.quadraticCurveTo(L * 0.3, H * 0.34, L * 0.76, H * 0.1 * o.snout); ctx.lineTo(L * 0.78, -H * 0.02); ctx.lineTo(-L * 0.1, -H * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (jaw > 0.05) { ctx.fillStyle = '#6a1a14'; ctx.beginPath(); ctx.moveTo(-L * 0.05, -H * 0.12); ctx.lineTo(L * 0.75, -H * 0.03); ctx.lineTo(L * 0.6, -H * 0.08); ctx.closePath(); ctx.fill(); teeth(ctx, L * 0.05, -H * 0.12, L * 0.74, -H * 0.03, o.teeth || 9, H * 0.12, true); }
    ctx.restore();
    // skull
    ctx.fillStyle = skinFill(ctx, pal, -H * 0.6, H * 0.3); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-L * 0.12, H * 0.25);
    ctx.quadraticCurveTo(-L * 0.18, -H * 0.45, L * 0.18, -H * 0.55);
    ctx.quadraticCurveTo(L * 0.55, -H * 0.52 * (0.5 + o.snout * 0.5), L * 0.92, -H * 0.2 * o.snout);
    ctx.quadraticCurveTo(L * 1.02, -H * 0.05, L * 0.94, H * 0.08);
    ctx.quadraticCurveTo(L * 0.5, H * 0.12, L * 0.12, H * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (jaw > 0.05) { ctx.fillStyle = '#7a2018'; ctx.beginPath(); ctx.moveTo(L * 0.12, H * 0.28); ctx.quadraticCurveTo(L * 0.5, H * 0.14, L * 0.92, H * 0.09); ctx.lineTo(L * 0.9, H * 0.12); ctx.lineTo(L * 0.14, H * 0.32); ctx.closePath(); ctx.fill(); }
    teeth(ctx, L * 0.2, H * 0.24, L * 0.9, H * 0.09, o.teeth || 9, H * (jaw > 0.05 ? 0.16 : 0.1), false);
    // cheek muscle and skin folds
    ctx.fillStyle = rgba(pal.dark, 0.35); ctx.beginPath(); ctx.ellipse(L * 0.08, -H * 0.05, L * 0.14, H * 0.22, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(pal.dark, 0.6); ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-L * 0.08 + k * 3, H * 0.2); ctx.quadraticCurveTo(-L * 0.02 + k * 3, 0, -L * 0.06 + k * 3, -H * 0.2); ctx.stroke(); }
    // lips line
    ctx.strokeStyle = rgba('#1a0a04', 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L * 0.14, H * 0.27); ctx.quadraticCurveTo(L * 0.5, H * 0.12, L * 0.94, H * 0.07); ctx.stroke();
    // nostril
    ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(L * 0.86, -H * 0.12 * o.snout - 1, 1.6, 1, -0.3, 0, TAU); ctx.fill();
    // brow ridge + eye
    const ex = L * 0.3, ey = -H * 0.26;
    ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(ex + 1, ey - H * 0.14, L * 0.12, H * 0.08, -0.15, 0, TAU); ctx.fill();
    eye(ctx, ex, ey, Math.max(1.8, H * 0.1), pal, o.closed, o.statue);
    // extras
    if (o.horns) { ctx.fillStyle = shade(pal.dark, -0.2); ctx.beginPath(); ctx.moveTo(ex - 4, ey - H * 0.18); ctx.quadraticCurveTo(ex - 6, ey - H * 0.6, ex - 12, ey - H * 0.62); ctx.quadraticCurveTo(ex - 5, ey - H * 0.4, ex + 4, ey - H * 0.2); ctx.closePath(); ctx.fill(); }
    if (o.crests) { ctx.fillStyle = pal.accent; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(ex + 2, ey - H * 0.18); ctx.lineTo(ex + 5, ey - H * 0.5); ctx.lineTo(ex + 10, ey - H * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (o.ridge) { ctx.fillStyle = pal.accent; for (let k = 0; k < 5; k++) { const x = L * (0.45 + k * 0.08); ctx.beginPath(); ctx.arc(x, -H * (0.5 - k * 0.05) * (0.5 + o.snout * 0.5) + 1, 1.8, 0, TAU); ctx.fill(); } }
  }
  function drawHead(ctx, type, p, pal, jaw, closed, statue, stage) {
    const L = p.headLen, H = p.headH, edge = 'rgba(0,0,0,0.45)';
    switch (type) {
      case 'rex': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.8, teeth: 10, closed, statue, ridge: stage >= 2 }); break;
      case 'allo': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.7, teeth: 10, closed, statue, horns: true, ridge: true }); break;
      case 'carno': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.9, teeth: 8, closed, statue });
        ctx.fillStyle = shade(pal.accent, -0.1); ctx.strokeStyle = edge;
        for (const dx of [0, 4]) { ctx.beginPath(); ctx.moveTo(L * 0.2 + dx, -H * 0.5); ctx.quadraticCurveTo(L * 0.1 + dx, -H * 0.95, L * 0.02 + dx - 4, -H * 1.05); ctx.quadraticCurveTo(L * 0.2 + dx, -H * 0.75, L * 0.36 + dx, -H * 0.48); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        break;
      case 'raptor': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.55, teeth: 11, closed, statue });
        if (p.quills) { ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-2 + k * 3, -H * 0.4); ctx.lineTo(-8 + k * 3, -H * 0.85); ctx.stroke(); } }
        break;
      case 'dilo': {
        // display frill (behind the head) when roaring
        if (jaw > 0.2) {
          const s = clamp((jaw - 0.2) * 2, 0, 1);
          ctx.save(); ctx.globalAlpha = s;
          const fg = ctx.createRadialGradient(L * 0.1, 0, 2, L * 0.1, 0, H * 1.6);
          fg.addColorStop(0, shade(pal.accent, 0.3)); fg.addColorStop(0.7, pal.accent); fg.addColorStop(1, shade(pal.accent, -0.3));
          ctx.fillStyle = fg; ctx.strokeStyle = edge;
          ctx.beginPath();
          for (let k = 0; k <= 12; k++) { const a = Math.PI * 0.55 + (k / 12) * Math.PI * 0.95; const r = H * (1.3 + (k % 2) * 0.25) * s; const x = L * 0.05 + Math.cos(a) * r, y = Math.sin(a) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.lineTo(L * 0.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba(pal.dark, 0.6); for (let k = 0; k < 7; k++) { const a = Math.PI * 0.6 + k * 0.14; ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.lineTo(L * 0.05 + Math.cos(a) * H * 1.4 * s, Math.sin(a) * H * 1.4 * s); ctx.stroke(); }
          ctx.restore();
        }
        theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.6, teeth: 9, closed, statue });
        // twin crests
        for (const [dx, a] of [[0, 0.8], [3, 1]]) {
          ctx.fillStyle = a < 1 ? shade(pal.accent, -0.25) : pal.accent; ctx.strokeStyle = edge;
          ctx.beginPath(); ctx.moveTo(L * 0.2 + dx, -H * 0.45); ctx.quadraticCurveTo(L * 0.35 + dx, -H * 1.35, L * 0.75 + dx, -H * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba('#fff', 0.35); ctx.beginPath(); ctx.moveTo(L * 0.28 + dx, -H * 0.6); ctx.quadraticCurveTo(L * 0.38 + dx, -H * 1.1, L * 0.6 + dx, -H * 0.5); ctx.stroke();
        }
        break;
      }
      case 'croc': {
        const hinge = [L * 0.12, H * 0.25];
        ctx.save(); ctx.translate(hinge[0], hinge[1]); ctx.rotate(jaw * 0.6);
        ctx.fillStyle = mix(pal.base, pal.belly, 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.12, -H * 0.2); ctx.quadraticCurveTo(L * 0.4, H * 0.3, L * 0.86, 0); ctx.lineTo(L * 0.86, -H * 0.14); ctx.lineTo(-L * 0.05, -H * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (jaw > 0.05) teeth(ctx, 0, -H * 0.22, L * 0.84, -H * 0.12, 14, H * 0.25, true);
        ctx.restore();
        ctx.fillStyle = skinFill(ctx, pal, -H * 0.8, H * 0.3); ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.3); ctx.quadraticCurveTo(-L * 0.15, -H * 0.8, L * 0.2, -H * 0.75);
        ctx.quadraticCurveTo(L * 0.5, -H * 0.3, L * 0.85, -H * 0.3); ctx.quadraticCurveTo(L * 1.04, -H * 0.35, L * 1.02, H * 0.05);
        ctx.quadraticCurveTo(L * 0.9, H * 0.22, L * 0.84, H * 0.1); ctx.quadraticCurveTo(L * 0.4, H * 0.14, L * 0.1, H * 0.34); ctx.closePath(); ctx.fill(); ctx.stroke();
        teeth(ctx, L * 0.18, H * 0.27, L * 0.98, H * 0.12, 13, H * (jaw > 0.05 ? 0.35 : 0.22), false);
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(L * 0.62, -H * 0.36, 1.8, 1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(L * 0.2, -H * 0.72, L * 0.1, H * 0.2, 0, 0, TAU); ctx.fill();
        eye(ctx, L * 0.2, -H * 0.5, Math.max(1.8, H * 0.18), pal, closed, statue);
        if (p.crestRidge) { ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.moveTo(L * 0.35, -H * 0.55); ctx.quadraticCurveTo(L * 0.5, -H * 0.85, L * 0.6, -H * 0.38); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'ornitho': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.4); ctx.strokeStyle = edge; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.35); ctx.quadraticCurveTo(-L * 0.2, -H * 0.9, L * 0.35, -H * 0.8); ctx.quadraticCurveTo(L * 0.8, -H * 0.5, L * 1.2, H * 0.15); ctx.quadraticCurveTo(L * 0.6 + jaw * 5, H * 0.5 + jaw * 6, L * 0.1, H * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(L * 0.4, H * 0.12 + jaw * 3); ctx.lineTo(L * 1.18, H * 0.16); ctx.stroke();
        eye(ctx, L * 0.2, -H * 0.3, Math.max(2, H * 0.24), pal, closed, statue);
        break;
      }
      case 'pachy': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.4); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.3); ctx.quadraticCurveTo(-L * 0.25, -H * 0.3, L * 0.2, -H * 0.4); ctx.quadraticCurveTo(L * 0.7, -H * 0.3, L * 0.95, H * 0.05); ctx.quadraticCurveTo(L * 0.9, H * 0.3 + jaw * 5, L * 0.5, H * 0.34 + jaw * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        // dome
        const dg = ctx.createRadialGradient(L * 0.2, -H * 0.9, 1, L * 0.25, -H * 0.5, H * 0.8);
        dg.addColorStop(0, shade(pal.accent, 0.4)); dg.addColorStop(0.6, pal.accent); dg.addColorStop(1, shade(pal.accent, -0.4));
        ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(L * 0.28, -H * 0.42, L * 0.42, H * 0.6, -0.2, Math.PI, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(pal.dark, -0.1); for (let k = 0; k < 6; k++) { const a = Math.PI + 0.3 + k * 0.45; ctx.beginPath(); ctx.arc(L * 0.28 + Math.cos(a) * L * 0.44, -H * 0.42 + Math.sin(a) * H * 0.58, 1.8, 0, TAU); ctx.fill(); }
        eye(ctx, L * 0.4, -H * 0.12, Math.max(1.8, H * 0.12), pal, closed, statue);
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.arc(L * 0.88, -H * 0.02, 1, 0, TAU); ctx.fill();
        break;
      }
      case 'cera': {
        // frill behind the head
        const fr = H * 1.25;
        const fg = ctx.createRadialGradient(-L * 0.05, -H * 0.2, 2, -L * 0.05, -H * 0.2, fr);
        fg.addColorStop(0, shade(pal.accent, 0.2)); fg.addColorStop(0.65, pal.accent); fg.addColorStop(1, shade(pal.accent, -0.35));
        ctx.fillStyle = fg; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L * 0.15, H * 0.3);
        for (let k = 0; k <= 14; k++) { const a = Math.PI * 0.35 + (k / 14) * Math.PI * 1.05; const r = fr * (1 + (k % 2) * 0.07); ctx.lineTo(-L * 0.08 + Math.cos(a) * r * 0.75, -H * 0.25 - Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgba(pal.dark, 0.35); ctx.beginPath(); ctx.ellipse(-L * 0.12, -H * 0.8, H * 0.28, H * 0.2, 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f0e6cc'; for (let k = 0; k < 8; k++) { const a = Math.PI * 0.5 + (k / 7) * Math.PI * 0.85; ctx.beginPath(); ctx.arc(-L * 0.08 + Math.cos(a) * fr * 0.78, -H * 0.25 - Math.sin(a) * fr * 1.04, 2, 0, TAU); ctx.fill(); }
        // skull + beak
        ctx.fillStyle = skinFill(ctx, pal, -H * 0.6, H * 0.4); ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.moveTo(0, H * 0.35); ctx.quadraticCurveTo(-L * 0.05, -H * 0.5, L * 0.35, -H * 0.45);
        ctx.quadraticCurveTo(L * 0.8, -H * 0.35, L * 0.98, H * 0.1); ctx.lineTo(L * 0.88, H * 0.4 + jaw * 4); ctx.quadraticCurveTo(L * 0.5, H * 0.55 + jaw * 5, L * 0.1, H * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(L * 0.8, -H * 0.05); ctx.quadraticCurveTo(L * 1.05, H * 0.05, L * 0.96, H * 0.42); ctx.lineTo(L * 0.82, H * 0.22); ctx.closePath(); ctx.fill();
        // horns
        const horn = (x, y, len, ang, w) => { ctx.fillStyle = '#efe4cc'; ctx.strokeStyle = '#6a5a44'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 - w, y + Math.sin(ang) * len * 0.6, x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + w, y + Math.sin(ang) * len * 0.4, x + w, y); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        horn(L * 0.72, -H * 0.3, H * 0.4, -1.3, 3);
        horn(L * 0.32, -H * 0.4, H * 1.15, -0.7, 3.4);
        horn(L * 0.38, -H * 0.36, H * 1.05, -0.62, 3);
        eye(ctx, L * 0.3, -H * 0.12, Math.max(1.8, H * 0.09), pal, closed, statue);
        break;
      }
      case 'hadro': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.05, H * 0.4); ctx.quadraticCurveTo(-L * 0.12, -H * 0.6, L * 0.3, -H * 0.55);
        ctx.quadraticCurveTo(L * 0.7, -H * 0.4, L * 1.02, -H * 0.05); ctx.quadraticCurveTo(L * 1.12, H * 0.25, L * 0.98, H * 0.4 + jaw * 3);
        ctx.quadraticCurveTo(L * 0.5, H * 0.5 + jaw * 4, L * 0.1, H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.ellipse(L * 1.0, H * 0.2, L * 0.1, H * 0.25, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
        if (p.crest !== 'none') {
          const cg = ctx.createLinearGradient(0, -H, -L * 1.2, -H * 2);
          cg.addColorStop(0, pal.accent); cg.addColorStop(1, shade(pal.accent, -0.35));
          ctx.fillStyle = cg; ctx.strokeStyle = edge;
          ctx.beginPath(); ctx.moveTo(L * 0.25, -H * 0.5); ctx.quadraticCurveTo(-L * 0.2, -H * 1.3, -L * 1.1, -H * 1.9);
          ctx.quadraticCurveTo(-L * 1.25, -H * 1.75, -L * 1.1, -H * 1.55); ctx.quadraticCurveTo(-L * 0.3, -H * 1.0, L * 0.05, -H * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba('#fff', 0.3); ctx.beginPath(); ctx.moveTo(L * 0.15, -H * 0.6); ctx.quadraticCurveTo(-L * 0.3, -H * 1.25, -L * 1.0, -H * 1.75); ctx.stroke();
        } else {
          ctx.fillStyle = rgba(pal.accent, 0.7); ctx.beginPath(); ctx.ellipse(L * 0.1, -H * 0.5, L * 0.2, H * 0.12, -0.3, 0, TAU); ctx.fill();
        }
        eye(ctx, L * 0.28, -H * 0.18, Math.max(1.8, H * 0.13), pal, closed, statue);
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(L * 0.85, -H * 0.12, 2, 1.2, 0.3, 0, TAU); ctx.fill();
        break;
      }
      case 'stego': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.4); ctx.quadraticCurveTo(-L * 0.05, -H * 0.8, L * 0.4, -H * 0.6);
        ctx.quadraticCurveTo(L * 0.9, -H * 0.4, L * 1.1, H * 0.2); ctx.quadraticCurveTo(L * 0.8, H * 0.55 + jaw * 3, L * 0.2, H * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(L * 0.95, 0); ctx.lineTo(L * 1.12, H * 0.22); ctx.lineTo(L * 0.92, H * 0.35); ctx.closePath(); ctx.fill();
        eye(ctx, L * 0.35, -H * 0.2, Math.max(1.6, H * 0.14), pal, closed, statue);
        break;
      }
      case 'anky': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.45); ctx.lineTo(-L * 0.15, -H * 0.4); ctx.quadraticCurveTo(L * 0.4, -H * 0.8, L * 0.95, -H * 0.3);
        ctx.quadraticCurveTo(L * 1.1, H * 0.1, L * 0.95, H * 0.45 + jaw * 3); ctx.quadraticCurveTo(L * 0.4, H * 0.6, -L * 0.1, H * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(pal.dark, 0.1);
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(L * (0.1 + k * 0.17), -H * (0.45 + Math.sin(k * 0.8) * 0.08), L * 0.08, H * 0.12, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#efe4cc'; ctx.strokeStyle = '#6a5a44';
        for (const [x, y, a] of [[-L * 0.12, -H * 0.35, -2.4], [-L * 0.12, H * 0.25, 2.5]]) { ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); ctx.lineTo(x, y + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        eye(ctx, L * 0.3, -H * 0.1, Math.max(1.6, H * 0.11), pal, closed, statue);
        ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(L * 0.85, H * 0.1); ctx.lineTo(L * 1.05, H * 0.2); ctx.lineTo(L * 0.9, H * 0.42); ctx.closePath(); ctx.fill();
        break;
      }
      case 'sauropod': {
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.35); ctx.quadraticCurveTo(-L * 0.1, -H * 0.6, L * 0.3, -H * 0.9);
        ctx.quadraticCurveTo(L * 0.55, -H * 1.15, L * 0.62, -H * 0.55); ctx.quadraticCurveTo(L * 1.0, -H * 0.35, L * 1.1, H * 0.1);
        ctx.quadraticCurveTo(L * 1.05, H * 0.45 + jaw * 3, L * 0.6, H * 0.45 + jaw * 3); ctx.quadraticCurveTo(L * 0.2, H * 0.5, -L * 0.1, H * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(L * 0.6, H * 0.25 + jaw * 2); ctx.lineTo(L * 1.06, H * 0.2); ctx.stroke();
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(L * 0.45, -H * 0.85, 1.8, 1.2, 0, 0, TAU); ctx.fill();
        eye(ctx, L * 0.35, -H * 0.3, Math.max(1.6, H * 0.14), pal, closed, statue);
        break;
      }
    }
  }

  /* ---------- features along the spine ---------- */
  function drawPlates(ctx, top, N, from, to, pal, far) {
    for (let i = from; i < to; i++) {
      const k = (i - from) / (to - from);
      const hgt = (10 + Math.sin(k * Math.PI) * 22) * (far ? 0.85 : 1);
      const n = N[i], [x, y] = top[i];
      const off = far ? -5 : 3;
      const ang = Math.atan2(n.ny, n.nx);
      ctx.save(); ctx.translate(x + off, y + (far ? 2 : 1)); ctx.rotate(ang + Math.PI / 2 - (far ? 0.12 : 0));
      const g = ctx.createLinearGradient(0, 0, 0, -hgt);
      g.addColorStop(0, far ? shade(pal.dark, -0.2) : pal.dark); g.addColorStop(0.5, far ? shade(pal.accent, -0.35) : pal.accent); g.addColorStop(1, far ? shade(pal.accent, -0.2) : shade(pal.accent, 0.3));
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-hgt * 0.35, 2); ctx.quadraticCurveTo(-hgt * 0.45, -hgt * 0.6, 0, -hgt); ctx.quadraticCurveTo(hgt * 0.45, -hgt * 0.55, hgt * 0.35, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hgt * 0.8); ctx.stroke();
      ctx.restore();
    }
  }
  function drawSail(ctx, top, from, to, pal, t) {
    const pts = [];
    for (let i = from; i <= to; i++) {
      const k = (i - from) / (to - from);
      const h = 58 * Math.pow(Math.sin(k * Math.PI), 0.8) + 4;
      pts.push([top[i][0], top[i][1] + 4, top[i][0] + (k - 0.5) * 6, top[i][1] - h]);
    }
    const g = ctx.createLinearGradient(0, pts[0][1], 0, pts[0][1] - 60);
    g.addColorStop(0, pal.dark); g.addColorStop(0.5, pal.accent); g.addColorStop(1, shade(pal.accent, 0.35));
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    const tops = pts.map(p => [p[2], p[3]]);
    ctx.lineTo(tops[0][0], tops[0][1]);
    for (let i = 1; i < tops.length - 1; i++) ctx.quadraticCurveTo(tops[i][0], tops[i][1], (tops[i][0] + tops[i + 1][0]) / 2, (tops[i][1] + tops[i + 1][1]) / 2);
    ctx.lineTo(tops[tops.length - 1][0], tops[tops.length - 1][1]);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba(pal.dark, 0.55); ctx.lineWidth = 1.1;
    for (let i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i][2], pts[i][3] + 2); ctx.stroke(); }
    // stripe pattern on sail
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(pal.pattern, 0.35); ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(pts[0][0] - 20 + i * 22, pts[0][1] - 70); ctx.lineTo(pts[0][0] + i * 22, pts[0][1]); ctx.stroke(); }
    ctx.restore();
  }
  function drawArmor(ctx, top, N, from, to, pal) {
    for (let i = from; i < to; i++) {
      const [x, y] = top[i], n = N[i];
      for (let r = 0; r < 3; r++) {
        const d = r * 7;
        const px = x - n.nx * d, py = y - n.ny * d;
        const g = ctx.createRadialGradient(px - 1.5, py - 2, 0.5, px, py, 5);
        g.addColorStop(0, shade(pal.accent, 0.4)); g.addColorStop(1, shade(pal.dark, -0.1));
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(px - 4.5, py + 2); ctx.quadraticCurveTo(px - 2, py - (r === 0 ? 7 : 4), px, py - (r === 0 ? 8 : 5)); ctx.quadraticCurveTo(px + 2, py - (r === 0 ? 7 : 4), px + 4.5, py + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }

  /* ---------- pattern on body ---------- */
  function drawPattern(ctx, type, N, top, bot, pal, seedv) {
    if (type === 'none') return;
    const rng = mulberry32(seedv);
    ctx.fillStyle = rgba(pal.pattern, 0.5); ctx.strokeStyle = rgba(pal.pattern, 0.55);
    const last = N.length - 2;
    if (type === 'stripes') {
      for (let i = 2; i < last; i++) {
        const n = N[i], [x, y] = top[i];
        const len = n.t * (0.8 + rng() * 0.4);
        ctx.lineWidth = Math.max(1.6, n.t * 0.28);
        ctx.beginPath(); ctx.moveTo(x - n.nx * -2, y - n.ny * -2);
        ctx.quadraticCurveTo(x - n.nx * len * 0.5 + 3, y - n.ny * len * 0.5, x - n.nx * len, y - n.ny * len); ctx.stroke();
        if (i % 2 === 0 && i < last - 1) { const m = N[i], [x2, y2] = [(top[i][0] + top[i + 1][0]) / 2, (top[i][1] + top[i + 1][1]) / 2]; ctx.lineWidth *= 0.6; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - m.nx * len * 0.55, y2 - m.ny * len * 0.55); ctx.stroke(); }
      }
    } else if (type === 'spots' || type === 'rosettes') {
      for (let i = 1; i < last; i++) {
        const n = N[i];
        for (let k = 0; k < 3; k++) {
          const d = rng() * n.t * 0.9;
          const x = n.x + n.nx * d + (rng() - 0.5) * 8, y = n.y + n.ny * d;
          const r = 1.2 + rng() * n.t * 0.12;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); type === 'rosettes' ? ctx.stroke() : ctx.fill();
        }
      }
    } else if (type === 'blotch') {
      for (let i = 1; i < last; i++) {
        const n = N[i];
        if (rng() < 0.4) continue;
        const d = n.t * (0.3 + rng() * 0.5);
        ctx.beginPath(); ctx.ellipse(n.x + n.nx * d, n.y + n.ny * d, 3 + rng() * n.t * 0.3, 2 + rng() * n.t * 0.18, rng() * 3, 0, TAU); ctx.fill();
      }
    }
  }

  /* ---------- pterosaur (special) ---------- */
  function drawPtero(ctx, pal, anim, pose, statue) {
    const flying = pose.fly !== false && !pose.perched;
    const flap = flying ? Math.sin(anim.t * 7) : 0;
    const edge = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.9;
    const body = [0, flying ? -8 : -26];
    const wing = (far) => {
      const up = far ? 0.8 : 1;
      const sh = [body[0] + 4, body[1] - 4];
      const tipY = flying ? -40 * flap * up - 6 : -18;
      const tipX = flying ? (far ? -62 : 70) : (far ? -8 : 18);
      const elbow = [sh[0] + (far ? -16 : 20), sh[1] - 12 * flap * up - 4];
      const tip = [sh[0] + tipX, sh[1] + tipY];
      const g = ctx.createLinearGradient(sh[0], sh[1], tip[0], tip[1]);
      g.addColorStop(0, far ? shade(pal.base, -0.35) : pal.base); g.addColorStop(1, far ? shade(pal.accent, -0.4) : shade(pal.accent, -0.1));
      ctx.fillStyle = g; ctx.strokeStyle = edge;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.quadraticCurveTo(elbow[0], elbow[1] - 4, tip[0], tip[1]);
      ctx.quadraticCurveTo(lerp(sh[0], tip[0], 0.5), lerp(sh[1], tip[1], 0.5) + 14, body[0] - 10, body[1] + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(pal.dark, 0.5); ctx.lineWidth = 0.7;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(lerp(sh[0], elbow[0], 0.8), lerp(sh[1], elbow[1], 0.8)); ctx.lineTo(lerp(tip[0], body[0] - 10, k / 4), lerp(tip[1], body[1] + 4, k / 4) + 4); ctx.stroke(); }
      ctx.lineWidth = 0.9;
    };
    if (!statue && flying) { ctx.fillStyle = 'rgba(0,0,0,0)'; }
    wing(true);
    // body
    ctx.fillStyle = skinFill(ctx, pal, body[1] - 8, body[1] + 8); ctx.strokeStyle = edge;
    ctx.beginPath(); ctx.ellipse(body[0], body[1], 16, 7, -0.05, 0, TAU); ctx.fill(); ctx.stroke();
    // legs
    ctx.strokeStyle = shade(pal.base, -0.3); ctx.lineWidth = 2;
    if (flying) { ctx.beginPath(); ctx.moveTo(body[0] - 12, body[1] + 2); ctx.lineTo(body[0] - 22, body[1] + 6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(body[0] - 8, body[1] + 5); ctx.lineTo(body[0] - 10, 0); ctx.moveTo(body[0] + 8, body[1] + 4); ctx.lineTo(body[0] + 14, 0); ctx.stroke(); }
    // neck + head
    const hx = body[0] + 18, hy = body[1] - 8;
    ctx.fillStyle = pal.base; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(body[0] + 10, body[1] - 4); ctx.quadraticCurveTo(hx - 2, hy + 2, hx, hy - 2); ctx.lineTo(hx + 4, hy + 3); ctx.quadraticCurveTo(body[0] + 14, body[1] + 2, body[0] + 12, body[1] + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(pose.roar ? -0.35 : 0.1);
    // crest
    ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(-22, -12); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // beak
    const j = pose.roar ? 0.25 : 0;
    ctx.fillStyle = mix(pal.belly, '#e8d090', 0.3);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(30, 1); ctx.lineTo(2, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(j); ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(27, 3); ctx.lineTo(1, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = pal.base; ctx.beginPath(); ctx.ellipse(0, 0, 6, 5, 0, 0, TAU); ctx.fill();
    eye(ctx, 1, -1, 1.8, pal, false, statue);
    ctx.restore();
    wing(false);
  }

  /* ---------- main draw ---------- */
  function draw(ctx, sid, x, y, scale, opts = {}) {
    const sp = SPECIES[sid];
    const p = Object.assign({}, PLANS[sp.body], sp.crest ? { crest: sp.crest } : {});
    const stage = opts.stage || 0;
    const pal = opts.palette || sp.pals[stage];
    const t = opts.t || 0;
    const growth = opts.growth === undefined ? 1 : opts.growth;
    const pose = { ...(POSES[opts.pose || 'idle'] || {}) };
    const anim = { t, speed: opts.speed || 0, phase: opts.phase || 0 };
    const statue = !!opts.statue;
    const dir = opts.dir || 1;
    const sc = scale * lerp(0.5, 1, growth);
    const headBoost = 1 + (1 - growth) * 0.45;
    if (sp.gig) { p.headLen *= 1.1; p.headH *= 0.85; }

    ctx.save();
    ctx.translate(x, y);
    // ground shadow
    if (opts.shadow !== false && !statue) {
      const len = (sp.body === 'ptero' ? 90 : p.tailLen + p.bodyLen + p.neckLen * 0.6) * sc;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.55);
      g.addColorStop(0, 'rgba(0,20,0,0.38)'); g.addColorStop(1, 'rgba(0,20,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(dir * len * 0.08, (opts.fly ? 6 : 1) * sc, len * 0.55, len * 0.16, 0, 0, TAU); ctx.fill();
    }
    ctx.scale(sc * dir, sc);
    if (opts.fly) ctx.translate(0, -opts.fly / sc);
    if (sp.body === 'ptero') { drawPtero(ctx, pal, anim, { ...pose, perched: !opts.fly, roar: pose.roar }, statue); ctx.restore(); return; }

    // animated spine
    const breath = 1 + Math.sin(t * 2.2) * 0.015;
    const walkBob = anim.speed > 0 ? Math.abs(Math.sin(anim.phase * TAU)) * 3 * anim.speed : 0;
    const { N, hipI, shI } = buildSpine(p, pose);
    const lower = pose.sleep ? p.hipH * 0.5 : pose.crouch ? p.hipH * 0.12 : 0;
    anim.lower = lower; anim.bob = walkBob;
    for (let i = 0; i < N.length; i++) {
      const n = N[i];
      n.t *= breath; n.b *= breath;
      n.y += lower - walkBob;
      if (n.tail !== undefined) {
        const k = n.tail;
        const sway = p.stiffTail ? 0.35 : 1;
        n.y += Math.sin(t * 1.6 + k * 2.2) * 6 * k * k * sway + (pose.sleep ? k * k * p.hipH * 0.4 : 0);
      }
      if (n.neck !== undefined) {
        n.y += Math.sin(t * 1.3) * 1.5 * n.neck;
        if (pose.sleep) n.y += n.neck * p.hipH * 0.35;
      }
    }
    normals(N);
    const { top, bot } = outline(N);
    const hip = [N[hipI].x + 2, N[hipI].y + p.tB * 0.2];
    const sh = [N[shI].x - 4, N[shI].y + p.tB * 0.35];
    const phase = anim.phase;

    // far limbs
    drawLeg(ctx, p, [hip[0] - 3, hip[1] - 2], phase + 0.5, true, pal, false, pose, anim);
    if (p.quad) drawLeg(ctx, p, [sh[0] - 2, sh[1] - 2], phase, true, pal, true, pose, anim);
    else drawArm(ctx, p, [sh[0] + 2, sh[1] - 1], true, pal, anim, pose);
    // far plates
    if (p.plates) drawPlates(ctx, top, N, 2, shI + 1, pal, true);
    if (p.sail) drawSail(ctx, top, hipI - 1, shI + 1, pal, t);
    // tail spikes (behind)
    if (p.thagomizer) {
      const tip = N[1];
      ctx.fillStyle = '#efe4cc'; ctx.strokeStyle = '#5a4a34'; ctx.lineWidth = 0.8;
      for (const [dx, ang] of [[0, -2.4], [6, -2.1], [2, -0.9], [8, -0.7]]) { const bx = tip.x + dx, by = tip.y; ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + Math.cos(ang) * 16, by + Math.sin(ang) * 16); ctx.lineTo(bx + 2, by); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    // body
    ctx.lineWidth = 1;
    bodyPath(ctx, top, bot);
    let minY = Infinity, maxY = -Infinity; for (const q of top) minY = Math.min(minY, q[1]); for (const q of bot) maxY = Math.max(maxY, q[1]);
    ctx.fillStyle = skinFill(ctx, pal, minY, maxY); ctx.fill();
    ctx.save(); ctx.clip();
    drawPattern(ctx, p.pattern, N, top, bot, pal, sid.length * 97 + stage);
    // scale texture
    if (!statue) {
      const rng = mulberry32(sid.length * 13);
      for (let i = 0; i < 70; i++) {
        const n = N[Math.floor(rng() * (N.length - 1))];
        const d = (rng() * 2 - 1) * n.t;
        ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
        ctx.beginPath(); ctx.arc(n.x + n.nx * d + (rng() - 0.5) * 6, n.y + n.ny * d, 1 + rng() * 1.6, 0, TAU); ctx.fill();
      }
    }
    // rim light on the dorsal edge & occlusion on belly
    ctx.strokeStyle = statue ? 'rgba(255,240,200,0.35)' : 'rgba(255,255,230,0.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); top.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] + 1.5) : ctx.moveTo(q[0], q[1] + 1.5))); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 5;
    ctx.beginPath(); bot.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] - 1) : ctx.moveTo(q[0], q[1] - 1))); ctx.stroke();
    // stage glow markings (apex)
    if (stage >= 3 && !statue) {
      ctx.strokeStyle = rgba(pal.pattern, 0.8); ctx.lineWidth = 1.4;
      for (let i = 2; i < N.length - 2; i += 2) { const n = N[i]; ctx.beginPath(); ctx.moveTo(n.x + n.nx * n.t * 0.6, n.y + n.ny * n.t * 0.6); ctx.lineTo(n.x - 4 + n.nx * n.t * 0.2, n.y + n.ny * n.t * 0.2 + 2); ctx.stroke(); }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.1; bodyPath(ctx, top, bot); ctx.stroke();
    // dorsal features
    if (p.quills) {
      ctx.strokeStyle = rgba(pal.accent, 0.95); ctx.lineWidth = 1.3;
      for (let i = hipI - 1; i < N.length - 1; i++) { const [x, yq] = top[i]; ctx.beginPath(); ctx.moveTo(x, yq + 1); ctx.lineTo(x - 5, yq - 5); ctx.stroke(); }
    }
    if (p.crestRidge || stage >= 2) {
      ctx.fillStyle = shade(pal.dark, -0.15);
      for (let i = 1; i < N.length - 1; i++) { const [x, yq] = top[i], n = N[i]; const s = Math.min(3.5, n.t * 0.18); ctx.beginPath(); ctx.moveTo(x - s, yq + 1); ctx.lineTo(x + n.nx * s * 1.4, yq + n.ny * s * 1.4 - 1); ctx.lineTo(x + s, yq + 1); ctx.fill(); }
    }
    if (p.armor) drawArmor(ctx, top, N, 3, shI + 1, pal);
    if (p.club) {
      const tip = N[0];
      const g = ctx.createRadialGradient(tip.x - 2, tip.y - 3, 1, tip.x, tip.y, 10);
      g.addColorStop(0, shade(pal.accent, 0.3)); g.addColorStop(1, shade(pal.dark, -0.2));
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(tip.x - 2, tip.y, 10, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tip.x + 6, tip.y + 1, 6, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (p.plates) drawPlates(ctx, top, N, 3, shI + 2, pal, false);
    // near limbs
    drawLeg(ctx, p, hip, phase, false, pal, false, pose, anim);
    if (p.quad) drawLeg(ctx, p, sh, phase + 0.5, false, pal, true, pose, anim);
    else drawArm(ctx, p, sh, false, pal, anim, pose);
    // head
    const last = N[N.length - 1];
    const neckAng = Math.atan2(last.ty, last.tx);
    const jaw = pose.jaw !== undefined ? pose.jaw : 0;
    const chew = pose.chew ? Math.max(0, Math.sin(t * 9)) * 0.25 : 0;
    ctx.save();
    ctx.translate(last.x - 2, last.y + 1);
    ctx.rotate(neckAng + (p.headPitch || 0) + (pose.headPitch || 0) + Math.sin(t * 1.1) * 0.03);
    ctx.scale(headBoost, headBoost);
    drawHead(ctx, p.head, p, pal, jaw + chew, pose.sleep, statue, stage);
    ctx.restore();
    ctx.restore();
  }

  const POSES = {
    idle: {},
    walk: {},
    eat: { neckA: -1.5, neckCurl: 0.2, headPitch: 0.6, chew: true },
    drink: { neckA: -1.6, neckCurl: 0.3, headPitch: 0.7 },
    roar: { neckA: 0.25, headPitch: -0.35, jaw: 0.75 },
    attack: { neckA: -0.1, headPitch: 0.1, jaw: 0.8, crouch: true },
    sleep: { sleep: true, neckA: -1.1, headPitch: 0.5 },
    alert: { neckA: 0.3, headPitch: -0.15 },
    hurt: { neckA: 0.2, headPitch: -0.5, jaw: 0.4 },
  };

  // thumbnail cache (for UI)
  const thumbs = {};
  function thumb(sid, stage = 0, w = 160, h = 110) {
    const key = sid + stage + w + 'x' + h;
    if (thumbs[key]) return thumbs[key];
    const sp = SPECIES[sid], p = PLANS[sp.body];
    const c = makeCanvas(w * 2, h * 2), ctx = c.getContext('2d');
    ctx.scale(2, 2);
    let len, ht;
    if (sp.body === 'ptero') { len = 140; ht = 80; }
    else { len = p.tailLen + p.bodyLen + p.neckLen * Math.cos(p.neckA) + p.headLen; ht = Math.max(p.hipH + p.tT, (p.shH || p.hipH) + p.neckLen * Math.sin(p.neckA) + p.headH + 20) + 10; }
    const s = Math.min((w - 10) / len, (h - 10) / ht);
    const cx = w / 2 + (p ? (p.tailLen - (p.bodyLen + p.neckLen * Math.cos(p.neckA) + p.headLen)) / 2 * s : 0);
    draw(ctx, sid, sp.body === 'ptero' ? w / 2 : cx, h - 6, s, { stage, t: 0.4, pose: sp.body === 'ptero' ? 'idle' : 'alert', fly: sp.body === 'ptero' ? 25 * s : 0 });
    thumbs[key] = c;
    return c;
  }
  function size(sid) { const sp = SPECIES[sid], p = PLANS[sp.body]; return p ? { len: p.tailLen + p.bodyLen + p.neckLen + p.headLen, h: Math.max(p.hipH, p.shH || 0) + p.tT } : { len: 140, h: 80 }; }
  return { draw, thumb, size, PLANS };
})();

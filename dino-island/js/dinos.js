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
    rex: { biped: true, hipH: 78, bodyLen: 50, tT: 26, tB: 33, arch: 5, tailLen: 112, tailDrop: -8, tailT: 0.95, neckLen: 22, neckA: 0.5, neckT: [21, 18], head: 'rex', headLen: 58, headH: 40, headPitch: 0.2, thigh: 36, shin: 34, legW: 21, foot: 16, stride: 22, arms: 'tiny', pattern: 'stripes', scales: true },
    allo: { biped: true, hipH: 70, bodyLen: 48, tT: 16, tB: 19, arch: 4, tailLen: 116, tailDrop: -6, tailT: 0.7, neckLen: 32, neckA: 0.72, neckT: [12, 8], head: 'allo', headLen: 44, headH: 21, headPitch: 0.25, thigh: 33, shin: 33, legW: 13, foot: 13, stride: 26, arms: 'long', pattern: 'stripes' },
    carno: { biped: true, hipH: 82, bodyLen: 40, tT: 14, tB: 17, arch: 3, tailLen: 108, tailDrop: -6, tailT: 0.8, neckLen: 22, neckA: 0.5, neckT: [13, 11], head: 'carno', headLen: 30, headH: 25, headPitch: 0.12, thigh: 34, shin: 36, legW: 12, foot: 13, stride: 32, arms: 'stub', pattern: 'rosettes' },
    spino: { biped: true, hipH: 62, bodyLen: 60, tT: 19, tB: 24, arch: 5, tailLen: 124, tailDrop: -4, tailT: 0.95, tailFin: true, neckLen: 40, neckA: 0.48, neckT: [12, 9], head: 'croc', headLen: 58, headH: 16, headPitch: 0.2, thigh: 28, shin: 30, legW: 14, foot: 13, stride: 20, arms: 'long', pattern: 'stripes', sail: true },
    bary: { biped: true, hipH: 58, bodyLen: 54, tT: 18, tB: 21, arch: 3, tailLen: 104, tailDrop: -4, tailT: 0.8, neckLen: 34, neckA: 0.45, neckT: [11, 9], head: 'croc', headLen: 50, headH: 14, headPitch: 0.2, thigh: 30, shin: 32, legW: 13, foot: 13, stride: 22, arms: 'long', pattern: 'blotch', crestRidge: true },
    raptor: { biped: true, hipH: 48, bodyLen: 32, tT: 12, tB: 14, arch: 2, tailLen: 84, tailDrop: -8, tailT: 0.55, stiffTail: true, neckLen: 24, neckA: 0.95, neckT: [8, 6], head: 'raptor', headLen: 28, headH: 12, headPitch: 0.35, thigh: 24, shin: 26, legW: 9, foot: 11, stride: 20, arms: 'raptor', pattern: 'stripes', quills: true, sickle: true },
    dilo: { biped: true, hipH: 60, bodyLen: 38, tT: 14, tB: 16, arch: 3, tailLen: 92, tailDrop: -5, tailT: 0.65, neckLen: 30, neckA: 0.8, neckT: [9, 7], head: 'dilo', headLen: 32, headH: 15, headPitch: 0.3, thigh: 28, shin: 30, legW: 11, foot: 12, stride: 22, arms: 'medium', pattern: 'spots' },
    ornitho: { biped: true, hipH: 70, bodyLen: 30, tT: 13, tB: 15, arch: 2, tailLen: 80, tailDrop: -2, tailT: 0.6, stiffTail: true, neckLen: 44, neckA: 1.12, neckT: [10, 5], head: 'ornitho', headLen: 18, headH: 9, headPitch: 0.5, thigh: 34, shin: 40, legW: 9, foot: 11, stride: 30, arms: 'medium', pattern: 'spots' },
    pachy: { biped: true, hipH: 50, bodyLen: 34, tT: 16, tB: 18, arch: 3, tailLen: 72, tailDrop: -4, tailT: 0.8, neckLen: 20, neckA: 0.7, neckT: [11, 9], head: 'pachy', headLen: 26, headH: 20, headPitch: 0.1, thigh: 26, shin: 26, legW: 11, foot: 11, stride: 18, arms: 'small', pattern: 'blotch' },
    cera: { quad: true, hipH: 58, shH: 46, bodyLen: 60, tT: 26, tB: 28, arch: 10, tailLen: 68, tailDrop: 10, tailT: 0.8, neckLen: 14, neckA: -0.25, neckT: [20, 18], head: 'cera', headLen: 44, headH: 28, headPitch: -0.1, thigh: 30, shin: 26, legW: 15, foot: 10, stride: 16, fThigh: 24, fShin: 22, fLegW: 11, pattern: 'blotch', scales: true },
    hadro: { quad: true, hipH: 66, shH: 48, bodyLen: 56, tT: 24, tB: 26, arch: 8, tailLen: 104, tailDrop: -2, tailT: 0.9, neckLen: 30, neckA: 0.55, neckT: [13, 10], head: 'hadro', headLen: 36, headH: 18, headPitch: 0.35, thigh: 34, shin: 30, legW: 15, foot: 12, stride: 18, fThigh: 22, fShin: 22, fLegW: 8, pattern: 'stripes' },
    stego: { quad: true, hipH: 64, shH: 38, bodyLen: 64, tT: 26, tB: 26, arch: 16, tailLen: 84, tailDrop: 14, tailT: 0.8, neckLen: 20, neckA: -0.35, neckT: [12, 9], head: 'stego', headLen: 20, headH: 11, headPitch: -0.2, thigh: 34, shin: 30, legW: 15, foot: 10, stride: 16, fThigh: 20, fShin: 18, fLegW: 10, pattern: 'blotch', plates: true, thagomizer: true },
    anky: { quad: true, hipH: 42, shH: 38, bodyLen: 70, tT: 24, tB: 18, arch: 6, tailLen: 78, tailDrop: 6, tailT: 0.75, neckLen: 12, neckA: -0.15, neckT: [15, 13], head: 'anky', headLen: 26, headH: 16, headPitch: 0, thigh: 22, shin: 20, legW: 13, foot: 9, stride: 12, fThigh: 18, fShin: 18, fLegW: 11, pattern: 'none', armor: true, club: true },
    sauropod: { quad: true, hipH: 86, shH: 104, bodyLen: 80, tT: 34, tB: 36, arch: 8, tailLen: 124, tailDrop: 16, tailT: 0.7, neckLen: 140, neckA: 1.2, neckT: [24, 9.5], head: 'sauropod', headLen: 20, headH: 12, headPitch: -0.9, thigh: 42, shin: 40, legW: 18, foot: 10, stride: 18, fThigh: 50, fShin: 48, fLegW: 15, pattern: 'blotch', scales: true },
  };
  // ---------- additional body plans: new dinosaurs & ice-age mammals ----------
  Object.assign(PLANS, {
    kentro: { ...PLANS.stego, hipH: 54, shH: 34, bodyLen: 52, tT: 21, tB: 21, arch: 12, tailLen: 84, kentro: true, pattern: 'spots' },
    iguano: { ...PLANS.hadro, hipH: 72, shH: 56, bodyLen: 58, tT: 26, tB: 28, neckLen: 26, neckA: 0.4, headLen: 38, headH: 19, crest: 'none', thumb: true, pattern: 'blotch' },
    cerato: { ...PLANS.allo, hipH: 62, bodyLen: 40, tT: 15, tB: 18, tailLen: 110, neckLen: 26, head: 'cerato', headLen: 38, headH: 22, crestRidge: true, arms: 'small', pattern: 'stripes' },
    styraco: { ...PLANS.cera, spiky: true, headLen: 42, pattern: 'stripes' },
    therizino: { biped: true, hipH: 78, bodyLen: 40, tT: 24, tB: 34, arch: 6, tailLen: 60, tailDrop: -2, tailT: 0.7, neckLen: 46, neckA: 1.0, neckT: [12, 7], head: 'ornitho', headLen: 20, headH: 11, headPitch: 0.4, thigh: 34, shin: 30, legW: 16, foot: 13, stride: 16, arms: 'scythe', quills: true, fur: 'feather', pattern: 'none' },
    diplo: { ...PLANS.sauropod, hipH: 74, shH: 66, bodyLen: 70, tT: 28, tB: 30, arch: 6, tailLen: 200, tailDrop: 10, tailT: 0.55, neckLen: 132, neckA: 0.42, neckT: [20, 8], headLen: 18, headH: 10, headPitch: -0.25, pattern: 'stripes' },
    mammoth: { quad: true, mammal: true, fur: 'long', hipH: 66, shH: 82, bodyLen: 66, tT: 36, tB: 34, arch: 18, tailLen: 22, tailDrop: 14, tailT: 0.4, neckLen: 10, neckA: 0.1, neckT: [30, 28], head: 'mammoth', headLen: 36, headH: 40, headPitch: 0.15, thigh: 30, shin: 30, legW: 15, foot: 10, stride: 14, fThigh: 30, fShin: 30, fLegW: 17, pattern: 'none' },
    rhino: { quad: true, mammal: true, fur: 'long', hipH: 46, shH: 52, bodyLen: 70, tT: 30, tB: 30, arch: 12, tailLen: 16, tailDrop: 8, tailT: 0.4, neckLen: 10, neckA: -0.15, neckT: [26, 22], head: 'rhino', headLen: 48, headH: 26, headPitch: 0.35, thigh: 22, shin: 22, legW: 13, foot: 9, stride: 14, fThigh: 24, fShin: 24, fLegW: 14, pattern: 'none' },
    smilo: { quad: true, mammal: true, fur: 'short', hipH: 46, shH: 52, bodyLen: 56, tT: 17, tB: 18, arch: 4, tailLen: 14, tailDrop: 4, tailT: 0.5, neckLen: 16, neckA: 0.25, neckT: [16, 13], head: 'smilo', headLen: 30, headH: 24, headPitch: 0.1, thigh: 22, shin: 22, legW: 11, foot: 9, stride: 22, fThigh: 24, fShin: 24, fLegW: 12, pattern: 'spots' },
    deer: { quad: true, mammal: true, fur: 'short', hipH: 72, shH: 78, bodyLen: 56, tT: 20, tB: 20, arch: 3, tailLen: 10, tailDrop: 2, tailT: 0.5, neckLen: 32, neckA: 0.8, neckT: [17, 11], head: 'deer', headLen: 30, headH: 15, headPitch: 0.75, thigh: 36, shin: 36, legW: 7, foot: 7, stride: 22, fThigh: 38, fShin: 38, fLegW: 7, pattern: 'none' },
    glypto: { quad: true, mammal: true, hipH: 32, shH: 28, bodyLen: 70, tT: 36, tB: 10, arch: 16, tailLen: 44, tailDrop: 10, tailT: 0.85, neckLen: 8, neckA: 0, neckT: [12, 11], head: 'glypto', headLen: 22, headH: 16, thigh: 14, shin: 14, legW: 11, foot: 8, stride: 10, fThigh: 13, fShin: 13, fLegW: 10, shell: true, club: true, pattern: 'none' },
    bear: { quad: true, mammal: true, fur: 'long', hipH: 50, shH: 58, bodyLen: 58, tT: 28, tB: 28, arch: 12, tailLen: 8, tailDrop: 2, tailT: 0.5, neckLen: 16, neckA: 0.15, neckT: [22, 18], head: 'bear', headLen: 32, headH: 24, headPitch: 0.15, thigh: 22, shin: 22, legW: 14, foot: 10, stride: 16, fThigh: 26, fShin: 26, fLegW: 15, pattern: 'none' },
    wolf: { quad: true, mammal: true, fur: 'short', hipH: 46, shH: 48, bodyLen: 50, tT: 15, tB: 15, arch: 3, tailLen: 44, tailDrop: 22, tailT: 1.25, neckLen: 20, neckA: 0.5, neckT: [12, 9], head: 'wolf', headLen: 30, headH: 15, headPitch: 0.35, thigh: 22, shin: 22, legW: 8, foot: 8, stride: 24, fThigh: 22, fShin: 22, fLegW: 8, pattern: 'none' },
  });
  const SWIM = { shark: { len: 210, h: 46 }, mosa: { len: 240, h: 36 }, plesio: { len: 220, h: 60 }, plio: { len: 200, h: 42 }, ichthyo: { len: 160, h: 44 }, dunkle: { len: 170, h: 50 }, turtle: { len: 140, h: 46 } };

  /* ---------- fur / feathers ---------- */
  function drawFurTexture(ctx, N, pal, kind, seed) {
    const rng = mulberry32(seed);
    const n = kind === 'long' ? 160 : 90;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = N[Math.floor(rng() * (N.length - 1))];
      const d = (rng() * 2 - 1) * s.t;
      const x = s.x + s.nx * d + (rng() - 0.5) * 8, y = s.y + s.ny * d;
      const l = kind === 'long' ? 5 + rng() * 5 : 3 + rng() * 2;
      ctx.strokeStyle = rng() < 0.55 ? rgba(pal.dark, 0.45) : rgba(shade(pal.base, 0.25), 0.45);
      ctx.lineWidth = kind === 'feather' ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - l * 0.4, y + l * 0.5, x - l * 0.9, y + l); ctx.stroke();
    }
  }
  function drawFurFringe(ctx, top, bot, pal, kind, t) {
    const long = kind === 'long';
    ctx.lineCap = 'round';
    for (let i = 1; i < bot.length - 1; i++) {
      const [x, y] = bot[i];
      const len = (long ? 12 : kind === 'feather' ? 7 : 4) * (0.75 + 0.35 * Math.sin(i * 2.7));
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k === 1 ? shade(pal.base, -0.15) : pal.dark;
        ctx.lineWidth = long ? 3 : 1.8;
        const sx = x + (k - 1) * 3;
        ctx.beginPath(); ctx.moveTo(sx, y - 3); ctx.quadraticCurveTo(sx + 1, y + len * 0.5, sx - 2 + Math.sin(t * 1.5 + i) * 1.2, y + len); ctx.stroke();
      }
    }
    if (long || kind === 'feather') for (let i = 2; i < top.length - 1; i++) {
      const [x, y] = top[i];
      ctx.strokeStyle = shade(pal.dark, 0.1); ctx.lineWidth = long ? 2.4 : 1.6;
      ctx.beginPath(); ctx.moveTo(x + 2, y + 3); ctx.quadraticCurveTo(x - 2, y - 3, x - 6, y - 1); ctx.stroke();
    }
  }
  function drawShell(ctx, top, N, pal, shI) {
    // glyptodont carapace: domed shell of hexagonal bony plates
    ctx.save();
    ctx.beginPath(); ctx.moveTo(top[1][0], top[1][1]);
    for (let i = 2; i <= shI + 1; i++) ctx.lineTo(top[i][0], top[i][1]);
    for (let i = shI + 1; i >= 1; i--) ctx.lineTo(N[i].x, N[i].y + N[i].b * 0.45);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, -80, 0, 0); sg.addColorStop(0, shade(pal.accent, 0.25)); sg.addColorStop(1, shade(pal.base, -0.1));
    ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = rgba(pal.dark, 0.7); ctx.lineWidth = 0.9;
    for (let gy = -110; gy < 10; gy += 7) for (let gx = -40; gx < 120; gx += 8) {
      const x = gx + ((gy / 7) % 2 ? 4 : 0), y = gy;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ctx.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.2); } ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-60, -110, 200, 30);
    ctx.restore();
    ctx.strokeStyle = shade(pal.dark, -0.1); ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 1; i <= shI + 1; i++) ctx.lineTo(N[i].x, N[i].y + N[i].b * 0.45); ctx.stroke();
  }

  /* ---------- mammal heads ---------- */
  function mammalHead(ctx, type, p, pal, jaw, closed, statue, stage, t) {
    const L = p.headLen, H = p.headH, edge = 'rgba(0,0,0,0.45)';
    const skin = skinFill(ctx, pal, -H, H * 0.6);
    const ivory = (pts, w) => { ctx.lineCap = 'round'; ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); ctx.stroke(); ctx.strokeStyle = '#f4ead4'; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = w * 0.3; ctx.stroke(); };
    switch (type) {
      case 'mammoth': {
        const ts = 1 + 0.12 * stage, sw = Math.sin(t * 1.2) * 0.12;
        // far tusk
        ivory([[L * 0.55, H * 0.32], [L * 1.0, H * 1.3 * ts], [L * 1.55 * ts, H * 1.1 * ts], [L * 1.35 * ts, H * 0.25]], 4.2 * ts);
        // skull dome
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-L * 0.25, H * 0.45); ctx.bezierCurveTo(-L * 0.35, -H * 0.4, -L * 0.05, -H * 1.0, L * 0.3, -H * 0.85);
        ctx.bezierCurveTo(L * 0.7, -H * 0.7, L * 0.85, -H * 0.2, L * 0.8, H * 0.2); ctx.lineTo(L * 0.45, H * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
        // trunk
        const tr = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; tr.push([L * (0.72 + 0.25 * Math.sin(u * 1.6) + sw * u * u * 2), H * (0.05 + u * 1.45) - Math.pow(u, 3) * H * 0.35]); }
        for (let k = 0; k < tr.length - 1; k++) { const w = lerp(H * 0.24, H * 0.07, k / 10); limb(ctx, tr[k], tr[k + 1], w, lerp(H * 0.24, H * 0.07, (k + 1) / 10), k % 2 ? pal.base : shade(pal.base, -0.06), null); }
        ctx.strokeStyle = rgba(pal.dark, 0.5); ctx.lineWidth = 0.8;
        for (let k = 1; k < tr.length - 1; k++) { const w = lerp(H * 0.22, H * 0.06, k / 10); ctx.beginPath(); ctx.moveTo(tr[k][0] - w, tr[k][1]); ctx.lineTo(tr[k][0] + w * 0.6, tr[k][1] + 1); ctx.stroke(); }
        // near tusk
        ivory([[L * 0.6, H * 0.36], [L * 1.15, H * 1.45 * ts], [L * 1.75 * ts, H * 1.2 * ts], [L * 1.5 * ts, H * 0.2]], 5 * ts);
        // shaggy forelock, ear, eye
        ctx.strokeStyle = pal.dark; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) { const x = -L * 0.1 + k * L * 0.08, y = -H * 0.8 + Math.abs(k - 3) * H * 0.05; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3, y - 6, x - 6, y - 3); ctx.stroke(); }
        ctx.fillStyle = shade(pal.base, -0.2); ctx.beginPath(); ctx.ellipse(-L * 0.05, -H * 0.1, L * 0.12, H * 0.2, 0.2, 0, TAU); ctx.fill();
        eye(ctx, L * 0.45, -H * 0.3, Math.max(1.6, H * 0.06), pal, closed, statue);
        break;
      }
      case 'rhino': {
        const hs = 1 + 0.15 * stage;
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-L * 0.15, H * 0.5); ctx.quadraticCurveTo(-L * 0.2, -H * 0.55, L * 0.3, -H * 0.5); ctx.quadraticCurveTo(L * 0.8, -H * 0.4, L * 1.0, H * 0.05);
        ctx.quadraticCurveTo(L * 1.02, H * 0.45 + jaw * 4, L * 0.75, H * 0.5 + jaw * 4); ctx.quadraticCurveTo(L * 0.3, H * 0.7, -L * 0.15, H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        const horn = (x, y, len, ang, w) => { const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.addColorStop(0, '#5a4a38'); g.addColorStop(1, '#c8b898'); ctx.fillStyle = g; ctx.strokeStyle = '#3a2e20'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - w, y + 2); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 - w, y + Math.sin(ang) * len * 0.55, x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.45 + w, y + Math.sin(ang) * len * 0.4, x + w, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        horn(L * 0.88, -H * 0.15, H * 1.6 * hs, -1.15, 5);
        horn(L * 0.6, -H * 0.38, H * 0.7 * hs, -1.35, 3.5);
        ctx.fillStyle = shade(pal.base, -0.15); ctx.beginPath(); ctx.moveTo(-L * 0.05, -H * 0.4); ctx.lineTo(-L * 0.1, -H * 0.95); ctx.lineTo(L * 0.08, -H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        eye(ctx, L * 0.35, -H * 0.12, Math.max(1.5, H * 0.07), pal, closed, statue);
        ctx.strokeStyle = pal.dark; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-L * 0.15 + k * 4, -H * 0.4); ctx.lineTo(-L * 0.2 + k * 4, -H * 0.62); ctx.stroke(); }
        break;
      }
      case 'smilo': {
        const fs = 1 + 0.1 * stage;
        ctx.save(); ctx.translate(L * 0.3, H * 0.2); ctx.rotate(jaw * 0.9);
        ctx.fillStyle = mix(pal.base, pal.belly, 0.6); ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(-L * 0.25, 0); ctx.quadraticCurveTo(L * 0.2, H * 0.3, L * 0.48, H * 0.05); ctx.lineTo(L * 0.45, -H * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(L * 0.35, -H * 0.08, L * 0.42, H * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(L * 0.5, -H * 0.2); ctx.quadraticCurveTo(L * 0.95, -H * 0.25, L * 0.95, H * 0.08); ctx.quadraticCurveTo(L * 0.85, H * 0.28, L * 0.5, H * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = mix(pal.belly, '#ffffff', 0.3); ctx.beginPath(); ctx.ellipse(L * 0.78, H * 0.1, L * 0.16, H * 0.12, 0, 0, TAU); ctx.fill();
        // sabres
        for (const dx of [0, -2]) { ctx.fillStyle = dx ? '#d8ccb0' : '#f6efdc'; ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(L * 0.62 + dx, H * 0.18); ctx.quadraticCurveTo(L * 0.66 + dx, H * 0.7 * fs, L * 0.56 + dx, H * 1.05 * fs); ctx.quadraticCurveTo(L * 0.6 + dx, H * 0.6, L * 0.54 + dx, H * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.ellipse(L * 0.92, -H * 0.08, 2.4, 1.8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(L * 0.05, -H * 0.42); ctx.lineTo(L * 0.1, -H * 0.82); ctx.lineTo(L * 0.28, -H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(pal.dark, 0.1); ctx.beginPath(); ctx.moveTo(L * 0.11, -H * 0.48); ctx.lineTo(L * 0.13, -H * 0.7); ctx.lineTo(L * 0.22, -H * 0.5); ctx.fill();
        eye(ctx, L * 0.55, -H * 0.18, Math.max(1.6, H * 0.08), { ...pal, eye: '#e0c040' }, closed, statue);
        ctx.strokeStyle = rgba(pal.dark, 0.6); ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(L * 0.25 + k * 4, -H * 0.4); ctx.lineTo(L * 0.3 + k * 4, -H * 0.2); ctx.stroke(); }
        break;
      }
      case 'deer': {
        const as = 1 + 0.14 * stage;
        // palmate antlers sweeping up and back
        for (const far of [true, false]) {
          ctx.save(); ctx.translate(L * 0.22 + (far ? -3 : 0), -H * 0.45); ctx.scale(as, as);
          const ag = ctx.createLinearGradient(0, 0, -30, -40); ag.addColorStop(0, far ? '#6a5640' : '#8a7050'); ag.addColorStop(1, far ? '#a8946c' : '#e0d0a8');
          ctx.fillStyle = ag; ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 0.9;
          // beam rising up and back, opening into a broad palm with tines along its rim
          ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-6, -10, -12, -16);
          ctx.quadraticCurveTo(-30, -18, -40, -30);
          const tines = [[-42, -40], [-36, -46], [-28, -48], [-20, -46], [-12, -42], [-6, -34]];
          for (const [tx, ty] of tines) { ctx.lineTo(tx, ty); ctx.lineTo(tx + 3.5, ty + 5); }
          ctx.quadraticCurveTo(-4, -18, 3, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(4, -20); ctx.lineTo(-1, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(-24, -26, -34, -38); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.45); ctx.quadraticCurveTo(-L * 0.12, -H * 0.6, L * 0.3, -H * 0.5); ctx.quadraticCurveTo(L * 0.8, -H * 0.3, L * 1.0, H * 0.15); ctx.quadraticCurveTo(L * 0.85, H * 0.5 + jaw * 3, L * 0.45, H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(L * 0.97, H * 0.1, 2, 1.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(L * 0.02, -H * 0.55, L * 0.08, H * 0.3, -0.7, 0, TAU); ctx.fill(); ctx.stroke();
        eye(ctx, L * 0.4, -H * 0.12, Math.max(1.6, H * 0.12), { ...pal, eye: '#3a2010' }, closed, statue);
        break;
      }
      case 'glypto': {
        ctx.fillStyle = skin; ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.4); ctx.quadraticCurveTo(-L * 0.1, -H * 0.5, L * 0.4, -H * 0.4); ctx.quadraticCurveTo(L * 0.95, -H * 0.2, L * 1.0, H * 0.2); ctx.quadraticCurveTo(L * 0.6, H * 0.6, -L * 0.1, H * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(pal.accent, 0.1); ctx.beginPath(); ctx.ellipse(L * 0.35, -H * 0.38, L * 0.4, H * 0.22, -0.1, Math.PI, TAU); ctx.fill(); ctx.stroke();
        eye(ctx, L * 0.55, -H * 0.05, Math.max(1.4, H * 0.08), pal, closed, statue);
        break;
      }
      case 'bear': {
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(L * 0.3, -H * 0.05, L * 0.38, H * 0.48, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(L * 0.45, -H * 0.2); ctx.quadraticCurveTo(L * 0.95, -H * 0.2, L * 1.0, H * 0.1); ctx.quadraticCurveTo(L * 0.9, H * 0.35 + jaw * 4, L * 0.45, H * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = mix(pal.belly, pal.base, 0.3); ctx.beginPath(); ctx.ellipse(L * 0.8, H * 0.05, L * 0.18, H * 0.17, 0, 0, TAU); ctx.fill();
        if (jaw > 0.1) { ctx.fillStyle = '#5a1a14'; ctx.beginPath(); ctx.ellipse(L * 0.78, H * 0.3, L * 0.16, H * 0.1 + jaw * 5, 0, 0, TAU); ctx.fill(); teeth(ctx, L * 0.66, H * 0.22, L * 0.92, H * 0.22, 4, 3, false); }
        ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.ellipse(L * 0.98, -H * 0.04, 3, 2.2, 0, 0, TAU); ctx.fill();
        for (const dx of [0, 6]) { ctx.fillStyle = shade(pal.base, -0.1); ctx.strokeStyle = edge; ctx.beginPath(); ctx.arc(L * 0.12 + dx, -H * 0.48, H * 0.14, 0, TAU); ctx.fill(); ctx.stroke(); }
        eye(ctx, L * 0.55, -H * 0.18, Math.max(1.5, H * 0.07), { ...pal, eye: '#2a1608' }, closed, statue);
        break;
      }
      case 'wolf': {
        ctx.save(); ctx.translate(L * 0.3, H * 0.2); ctx.rotate(jaw * 0.6);
        ctx.fillStyle = mix(pal.base, pal.belly, 0.5); ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(-L * 0.2, 0); ctx.quadraticCurveTo(L * 0.3, H * 0.4, L * 0.68, H * 0.1); ctx.lineTo(L * 0.66, -H * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (jaw > 0.1) teeth(ctx, L * 0.2, 0, L * 0.64, 0, 5, 3, true);
        ctx.restore();
        ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.1, H * 0.4); ctx.quadraticCurveTo(-L * 0.15, -H * 0.6, L * 0.3, -H * 0.55); ctx.quadraticCurveTo(L * 0.55, -H * 0.4, L * 1.0, -H * 0.02);
        ctx.quadraticCurveTo(L * 0.98, H * 0.18, L * 0.9, H * 0.2); ctx.quadraticCurveTo(L * 0.5, H * 0.3, L * 0.1, H * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (jaw > 0.1) teeth(ctx, L * 0.4, H * 0.26, L * 0.92, H * 0.19, 6, 3, false);
        ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.ellipse(L * 0.99, -H * 0.02, 2.2, 1.8, 0, 0, TAU); ctx.fill();
        for (const [dx, c] of [[-4, shade(pal.dark, -0.1)], [2, pal.base]]) { ctx.fillStyle = c; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(L * 0.05 + dx, -H * 0.4); ctx.lineTo(L * 0.1 + dx, -H * 1.1); ctx.lineTo(L * 0.3 + dx, -H * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        eye(ctx, L * 0.5, -H * 0.2, Math.max(1.5, H * 0.1), pal, closed, statue);
        ctx.fillStyle = mix(pal.belly, '#ffffff', 0.3); ctx.beginPath(); ctx.ellipse(L * 0.25, H * 0.3, L * 0.22, H * 0.15, 0.2, 0, TAU); ctx.fill();
        break;
      }
    }
  }

  /* ---------- swimmers (lagoon) ---------- */
  function drawSwimmer(ctx, type, pal, anim, pose, statue, stage) {
    const S = SWIM[type], L = S.len, H = S.h, t = anim.t, und = 5 + anim.speed * 4;
    const edge = 'rgba(0,0,0,0.45)';
    const jaw = pose.jaw || 0;
    const shape = (u, stalk, peak, nose) => u < peak ? lerp(stalk, 1, smooth(u / peak)) : lerp(1, nose, Math.pow((u - peak) / (1 - peak), 1.6));
    const cfg = { shark: [0.14, 0.55, 0.32], mosa: [0.3, 0.45, 0.3], plesio: [0.15, 0.45, 0.35], plio: [0.22, 0.38, 0.55], ichthyo: [0.1, 0.45, 0.18], dunkle: [0.22, 0.55, 0.55], turtle: [0.3, 0.5, 0.5] }[type];
    const BL = type === 'plesio' ? L * 0.55 : L; // plesiosaur: body only, neck drawn separately
    const ox = type === 'plesio' ? -L * 0.2 : 0;
    const at = u => { const th = shape(u, cfg[0], cfg[1], cfg[2]) * H / 2; const yc = Math.sin(t * 3 - u * 6) * und * Math.pow(1 - u, 2); return { x: ox - BL / 2 + u * BL, y: yc, th }; };
    const fin = (u, side, len, ang, wid, col) => {
      const b = at(u), y = side < 0 ? b.y - b.th * 0.9 : b.y + b.th * 0.7;
      const flap = Math.sin(t * 2.4 + u * 5) * 0.25;
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(ang + flap * (side > 0 ? 1 : 0));
      ctx.fillStyle = col; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(wid * 0.5, 0); ctx.quadraticCurveTo(0, len * 0.4, -len * 0.25, len); ctx.quadraticCurveTo(-wid * 0.2, len * 0.45, -wid * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    const farCol = shade(pal.base, -0.35), nearCol = shade(pal.base, -0.1);
    // far flippers first
    if (type === 'mosa' || type === 'plio' || type === 'plesio') { fin(0.62, 1, H * 0.9, 0.9, H * 0.35, farCol); fin(0.3, 1, H * 0.75, 1.0, H * 0.3, farCol); }
    if (type === 'turtle') { fin(0.68, 1, H * 1.2, 0.6 + Math.sin(t * 2) * 0.3, H * 0.4, farCol); }
    // tail fin
    const tb = at(0.02);
    ctx.save(); ctx.translate(tb.x, tb.y); ctx.rotate(Math.sin(t * 3) * 0.2);
    ctx.fillStyle = shade(pal.base, -0.15); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
    if (type === 'shark' || type === 'ichthyo') { ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(-8, -H * 0.4, -H * 0.55, -H * (type === 'shark' ? 1.0 : 0.75)); ctx.quadraticCurveTo(-H * 0.2, -H * 0.1, -H * 0.15, 0); ctx.quadraticCurveTo(-H * 0.2, H * 0.1, -H * 0.45, H * (type === 'shark' ? 0.55 : 0.75)); ctx.quadraticCurveTo(-8, H * 0.35, 4, 0); ctx.fill(); ctx.stroke(); }
    else if (type === 'mosa') { ctx.beginPath(); ctx.moveTo(6, -2); ctx.quadraticCurveTo(-H * 0.4, -H * 0.15, -H * 0.8, -H * 0.2); ctx.quadraticCurveTo(-H * 0.5, H * 0.2, -H * 0.7, H * 0.85); ctx.quadraticCurveTo(-H * 0.1, H * 0.4, 6, 2); ctx.fill(); ctx.stroke(); }
    else if (type === 'dunkle') { ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(-H * 0.3, -H * 0.3, -H * 0.8, -H * 0.75); ctx.quadraticCurveTo(-H * 0.4, -H * 0.05, -H * 0.4, H * 0.35); ctx.quadraticCurveTo(-H * 0.1, H * 0.2, 4, 0); ctx.fill(); ctx.stroke(); }
    else if (type !== 'turtle') { ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-H * 0.35, -H * 0.15); ctx.lineTo(-H * 0.3, H * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    // dorsal fins
    if (type === 'shark') { fin(0.55, -1, -H * 0.95 * (1 + 0.08 * stage), -0.35, H * 0.55, nearCol); fin(0.22, -1, -H * 0.3, -0.3, H * 0.2, nearCol); }
    if (type === 'ichthyo') fin(0.52, -1, -H * 0.7, -0.4, H * 0.5, nearCol);
    if (type === 'dunkle') fin(0.4, -1, -H * 0.45, -0.3, H * 0.4, nearCol);
    // body
    const top = [], bot = [];
    const N = 28;
    for (let i = 0; i <= N; i++) { const b = at(i / N); top.push([b.x, b.y - b.th]); bot.push([b.x, b.y + b.th * 0.88]); }
    if (type === 'turtle') {
      // carapace & plastron
      const cx = ox, cy = Math.sin(t * 1.5) * 1.5;
      ctx.fillStyle = mix(pal.belly, '#e8dcb8', 0.4); ctx.strokeStyle = edge; ctx.beginPath(); ctx.ellipse(cx, cy + H * 0.12, L * 0.4, H * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
      const sg = ctx.createRadialGradient(cx - L * 0.1, cy - H * 0.45, 2, cx, cy - H * 0.1, L * 0.45);
      sg.addColorStop(0, shade(pal.base, 0.3)); sg.addColorStop(0.6, pal.base); sg.addColorStop(1, pal.dark);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy + 2, L * 0.42, H * 0.62, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(pal.dark, 0.7); ctx.lineWidth = 1.2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx + k * L * 0.08, cy + 2); ctx.quadraticCurveTo(cx + k * L * 0.1, cy - H * 0.35, cx + k * L * 0.05, cy - H * 0.55 + Math.abs(k) * H * 0.12); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(cx, cy - H * 0.2, L * 0.3, H * 0.22, 0, Math.PI, TAU); ctx.stroke();
      // head
      const hx = cx + L * 0.42, hy = cy - 2;
      ctx.fillStyle = pal.base; ctx.strokeStyle = edge; ctx.beginPath(); ctx.ellipse(hx + 8, hy, 12, 8, -0.1, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(hx + 16, hy - 4); ctx.quadraticCurveTo(hx + 26, hy, hx + 18, hy + 6); ctx.lineTo(hx + 14, hy + 2); ctx.closePath(); ctx.fill();
      eye(ctx, hx + 10, hy - 3, 1.8, pal, false, statue);
      fin(0.75, 1, H * 1.35, 0.4 + Math.sin(t * 2 + 1) * 0.35, H * 0.45, nearCol); fin(0.2, 1, H * 0.6, 1.1, H * 0.3, nearCol);
      return;
    }
    ctx.fillStyle = skinFill(ctx, pal, -H / 2, H / 2);
    ctx.beginPath(); curveThrough(ctx, top.concat(bot.slice().reverse()), true); ctx.fill();
    ctx.save(); ctx.clip();
    // countershading line & pattern
    ctx.strokeStyle = rgba(pal.pattern, 0.45); ctx.lineWidth = 2;
    for (let i = 3; i < N - 3; i += 2) { const b = at(i / N); if (type === 'shark' || type === 'mosa') { ctx.beginPath(); ctx.moveTo(b.x, b.y - b.th * 0.9); ctx.lineTo(b.x - 4, b.y - b.th * 0.2); ctx.stroke(); } else { ctx.fillStyle = rgba(pal.pattern, 0.4); ctx.beginPath(); ctx.arc(b.x, b.y - b.th * 0.4, 2 + (i % 3), 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-L, -H, L * 2, H * 0.25);
    if (stage >= 3) { ctx.strokeStyle = rgba(pal.accent, 0.8); ctx.lineWidth = 1.4; for (let i = 4; i < N - 4; i += 3) { const b = at(i / N); ctx.beginPath(); ctx.moveTo(b.x, b.y - b.th * 0.6); ctx.lineTo(b.x - 6, b.y); ctx.stroke(); } }
    ctx.restore();
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.beginPath(); curveThrough(ctx, top.concat(bot.slice().reverse()), true); ctx.stroke();
    const nose = at(1);
    // heads
    if (type === 'shark') {
      ctx.strokeStyle = rgba(pal.dark, 0.6); ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const b = at(0.72 + k * 0.025); ctx.beginPath(); ctx.moveTo(b.x, b.y - b.th * 0.4); ctx.quadraticCurveTo(b.x - 3, b.y, b.x, b.y + b.th * 0.4); ctx.stroke(); }
      const m = at(0.9);
      ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.moveTo(m.x - 12, m.y + m.th * 0.5); ctx.quadraticCurveTo(m.x + 4, m.y + m.th * (0.7 + jaw * 1.5), nose.x - 4, nose.y + 4 + jaw * 10); ctx.quadraticCurveTo(m.x, m.y + m.th * 0.4, m.x - 12, m.y + m.th * 0.5); ctx.fill();
      teeth(ctx, m.x - 10, m.y + m.th * 0.45, nose.x - 6, nose.y + 2, 9, 4 + jaw * 4, false);
      if (jaw > 0.1) teeth(ctx, m.x - 8, m.y + m.th * (0.7 + jaw), nose.x - 8, nose.y + 4 + jaw * 9, 7, 4, true);
      eye(ctx, at(0.88).x, at(0.88).y - at(0.88).th * 0.35, 2.2, { ...pal, eye: '#1a1a1a' }, false, statue);
      fin(0.66, 1, H * 0.85, 0.7, H * 0.45, nearCol);
    } else if (type === 'mosa' || type === 'plio') {
      const b0 = at(type === 'mosa' ? 0.82 : 0.75);
      ctx.strokeStyle = 'rgba(30,10,5,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y + b0.th * 0.3); ctx.lineTo(nose.x, nose.y + 2 + jaw * 6); ctx.stroke();
      if (jaw > 0.1) { ctx.fillStyle = '#6a1a14'; ctx.beginPath(); ctx.moveTo(b0.x, b0.y + b0.th * 0.3); ctx.lineTo(nose.x, nose.y + 1); ctx.lineTo(nose.x - 4, nose.y + 2 + jaw * 12); ctx.closePath(); ctx.fill(); }
      teeth(ctx, b0.x + 4, b0.y + b0.th * 0.25, nose.x - 2, nose.y + 1, 10, 4, false);
      if (jaw > 0.1) teeth(ctx, b0.x + 4, b0.y + b0.th * 0.35 + jaw * 4, nose.x - 6, nose.y + 2 + jaw * 11, 8, 4, true);
      const e = at(type === 'mosa' ? 0.86 : 0.8);
      ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.th * 0.55, 6, 3, 0, 0, TAU); ctx.fill();
      eye(ctx, e.x, e.y - e.th * 0.4, 2.2, pal, false, statue);
      if (type === 'mosa') { ctx.fillStyle = shade(pal.dark, -0.1); for (let i = 6; i < 20; i++) { const b = at(i / N); ctx.beginPath(); ctx.moveTo(b.x - 2, b.y - b.th + 1); ctx.lineTo(b.x, b.y - b.th - 3 - stage); ctx.lineTo(b.x + 2, b.y - b.th + 1); ctx.fill(); } }
      fin(0.6, 1, H * 1.0, 0.7, H * 0.38, nearCol); fin(0.28, 1, H * 0.8, 0.8, H * 0.32, nearCol);
    } else if (type === 'plesio') {
      // long neck rising from the body, swaying
      const base = at(0.95), sw = Math.sin(t * 0.9) * 8;
      const neck = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12; neck.push([base.x + u * L * 0.42 + Math.sin(u * 3) * 6, base.y - Math.sin(u * 1.4) * L * 0.25 + sw * u * u]); }
      const nt = [], nb = [];
      for (let k = 0; k < neck.length; k++) {
        const a = neck[Math.max(0, k - 1)], b2 = neck[Math.min(neck.length - 1, k + 1)];
        let dx = b2[0] - a[0], dy = b2[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w = lerp(H * 0.26, H * 0.1, k / 12);
        nt.push([neck[k][0] + dy * w, neck[k][1] - dx * w]); nb.push([neck[k][0] - dy * w, neck[k][1] + dx * w]);
      }
      ctx.fillStyle = skinFill(ctx, pal, neck[neck.length - 1][1] - 10, base.y + 10); ctx.strokeStyle = edge; ctx.lineWidth = 1;
      ctx.beginPath(); curveThrough(ctx, nt.concat(nb.slice().reverse()), true); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(pal.pattern, 0.35); for (let k = 2; k < neck.length - 1; k += 2) { ctx.beginPath(); ctx.arc(nt[k][0] * 0.6 + nb[k][0] * 0.4, nt[k][1] * 0.6 + nb[k][1] * 0.4, 2, 0, TAU); ctx.fill(); }
      const hd = neck[neck.length - 1];
      ctx.fillStyle = pal.base; ctx.strokeStyle = edge; ctx.beginPath(); ctx.ellipse(hd[0] + 6, hd[1], 11, 6, 0.1, 0, TAU); ctx.fill(); ctx.stroke();
      teeth(ctx, hd[0] + 4, hd[1] + 3, hd[0] + 16, hd[1] + 3, 5, 3, false);
      eye(ctx, hd[0] + 6, hd[1] - 2, 1.8, pal, false, statue);
      fin(0.6, 1, H * 0.9, 0.6, H * 0.35, nearCol); fin(0.28, 1, H * 0.75, 0.8, H * 0.3, nearCol);
    } else if (type === 'ichthyo') {
      // long thin beak and a huge eye
      ctx.fillStyle = pal.base; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(nose.x - 6, nose.y - 3); ctx.lineTo(nose.x + L * 0.18, nose.y + 1); ctx.lineTo(nose.x - 6, nose.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      teeth(ctx, nose.x - 2, nose.y + 1, nose.x + L * 0.16, nose.y + 1.5, 8, 2, false);
      const e = at(0.88); ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.arc(e.x, e.y - 2, 6, 0, TAU); ctx.fill(); ctx.stroke();
      eye(ctx, e.x, e.y - 2, 4, { ...pal, eye: '#1a1a1a' }, false, statue);
      fin(0.68, 1, H * 0.75, 0.8, H * 0.35, nearCol); fin(0.32, 1, H * 0.4, 0.9, H * 0.22, nearCol);
    } else if (type === 'dunkle') {
      // armoured head plates and bony jaw blades
      const hp = [];
      for (let i = Math.round(N * 0.68); i <= N; i++) hp.push(top[i]);
      for (let i = N; i >= Math.round(N * 0.68); i--) hp.push(bot[i]);
      const ag = ctx.createLinearGradient(0, -H / 2, 0, H / 2); ag.addColorStop(0, shade(pal.accent, -0.1)); ag.addColorStop(1, shade(pal.dark, -0.2));
      ctx.fillStyle = ag; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); hp.forEach((q, k) => (k ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; for (const u of [0.76, 0.86]) { const b = at(u); ctx.beginPath(); ctx.moveTo(b.x, b.y - b.th); ctx.quadraticCurveTo(b.x + 6, b.y, b.x, b.y + b.th * 0.88); ctx.stroke(); }
      ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.moveTo(nose.x - 18, nose.y + 6); ctx.lineTo(nose.x + 3, nose.y + 4 + jaw * 8); ctx.lineTo(nose.x - 4, nose.y + 12 + jaw * 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nose.x - 16, nose.y + 2); ctx.lineTo(nose.x + 4, nose.y + 2); ctx.lineTo(nose.x - 2, nose.y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      const e = at(0.86); eye(ctx, e.x + 2, e.y - e.th * 0.4, 3, pal, false, statue);
      fin(0.6, 1, H * 0.55, 0.9, H * 0.4, nearCol);
    }
  }

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
    if (!front) { ctx.fillStyle = limbGrad(ctx, hip, bent.knee, w * 1.2, col); ctx.beginPath(); ctx.ellipse(hip[0] + (bent.knee[0] - hip[0]) * 0.3, hip[1] + (bent.knee[1] - hip[1]) * 0.3, w * (p.quad ? 1.05 : 1.25), l1 * 0.48, Math.atan2(bent.knee[1] - hip[1], bent.knee[0] - hip[0]) - Math.PI / 2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.stroke(); }
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
      for (const [tx, ty] of [[fl, 0], [fl * 0.75, 1.4], [fl * 0.55, -0.6]]) { ctx.beginPath(); ctx.moveTo(ax + tx - 2, toeY + ty - 0.5); ctx.quadraticCurveTo(ax + tx + 2, toeY + ty - 1.5, ax + tx + 3.5, toeY + ty + 1.2); ctx.stroke(); }
      if (p.sickle) { ctx.strokeStyle = '#1a140e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax + fl * 0.35, toeY - 2); ctx.quadraticCurveTo(ax + fl * 0.5, toeY - 9, ax + fl * 0.8, toeY - 7); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.ellipse(ax + 1, ay + 1, w * 0.5, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (p.thumb && front) { ctx.fillStyle = '#efe4cc'; ctx.strokeStyle = '#6a5a44'; ctx.beginPath(); ctx.moveTo(ax + 2, ay - 6); ctx.lineTo(ax + 9, ay - 14); ctx.lineTo(ax + 5, ay - 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = shade(col, -0.12); }
      ctx.fillStyle = '#e8dcc0';
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(ax + 1 + k * w * 0.28 + 2, ay + 2.5, 1.3, 0, TAU); ctx.fill(); }
    }
  }

  function drawArm(ctx, p, sh, far, pal, anim, pose) {
    const type = p.arms;
    if (!type) return;
    const sz = { scythe: [18, 18, 4.6], tiny: [9, 8, 2.6], stub: [5, 4, 2.4], small: [10, 9, 3], medium: [14, 12, 3.4], long: [18, 16, 4.4], raptor: [15, 14, 3.4] }[type];
    const col = far ? shade(pal.base, -0.3) : shade(pal.base, -0.05);
    const sway = Math.sin(anim.t * 2 + (far ? 1 : 0)) * 0.12 + (pose.roar ? -0.5 : 0) + (pose.attack ? -0.9 : 0);
    const a1 = 1.1 + sway, a2 = -0.5 + sway;
    const e = [sh[0] + Math.cos(a1) * sz[0], sh[1] + Math.sin(a1) * sz[0]];
    const h = [e[0] + Math.cos(a2) * sz[1], e[1] + Math.sin(a2) * sz[1]];
    ctx.lineWidth = 0.8;
    limb(ctx, sh, e, sz[2], sz[2] * 0.75, col, 'rgba(0,0,0,0.35)');
    limb(ctx, e, h, sz[2] * 0.75, sz[2] * 0.55, col, 'rgba(0,0,0,0.35)');
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = type === 'long' || type === 'raptor' ? 1.4 : 1;
    const cl = type === 'scythe' ? 26 : type === 'long' ? 7 : type === 'raptor' ? 5 : 3;
    if (type === 'scythe') { ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo(h[0] + 14, h[1] + 4 + k * 3, h[0] + 10 - k * 2, h[1] + cl - k * 3); ctx.stroke(); } }
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
    const dp = o.deep || 1;
    ctx.beginPath(); ctx.moveTo(-L * 0.2, -H * 0.12); ctx.quadraticCurveTo(L * 0.3, H * 0.34 * dp, L * 0.76, H * 0.1 * o.snout * dp); ctx.lineTo(L * 0.78, -H * 0.02); ctx.lineTo(-L * 0.1, -H * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
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
    ctx.fillStyle = rgba(pal.dark, 0.35); ctx.beginPath(); ctx.ellipse(L * 0.08, -H * 0.05, L * 0.14 * (o.deep > 1 ? 1.4 : 1), H * 0.22 * (o.deep > 1 ? 1.3 : 1), 0.3, 0, TAU); ctx.fill();
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
    if (o.noseHorn) { const hl = H * 0.55 * o.noseHorn; ctx.fillStyle = shade(pal.accent, -0.1); ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(L * 0.62, -H * 0.38 * o.snout); ctx.quadraticCurveTo(L * 0.66, -H * 0.38 * o.snout - hl, L * 0.74, -H * 0.42 * o.snout - hl * 1.1); ctx.quadraticCurveTo(L * 0.76, -H * 0.4 * o.snout - hl * 0.4, L * 0.84, -H * 0.3 * o.snout); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (o.ridge) { ctx.fillStyle = pal.accent; for (let k = 0; k < 5; k++) { const x = L * (0.45 + k * 0.08); ctx.beginPath(); ctx.arc(x, -H * (0.5 - k * 0.05) * (0.5 + o.snout * 0.5) + 1, 1.8, 0, TAU); ctx.fill(); } }
  }
  function drawHead(ctx, type, p, pal, jaw, closed, statue, stage) {
    const L = p.headLen, H = p.headH, edge = 'rgba(0,0,0,0.45)';
    if (['mammoth', 'rhino', 'smilo', 'deer', 'glypto', 'bear', 'wolf'].includes(type)) return mammalHead(ctx, type, p, pal, jaw, closed, statue, stage, drawHead.t || 0);
    switch (type) {
      case 'cerato': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.75, teeth: 11, closed, statue, ridge: true, noseHorn: 1 + 0.2 * stage, horns: stage >= 2 }); break;
      case 'giga': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.62, teeth: 14, closed, statue, ridge: true, deep: 0.95, horns: stage >= 2 }); break;
      case 'rex': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.95, teeth: 11, closed, statue, ridge: stage >= 2, deep: 1.45, horns: stage >= 3 }); break;
      case 'allo': theropodHead(ctx, p, pal, jaw, { L, H, snout: 0.62, teeth: 12, closed, statue, horns: true, ridge: true, deep: 0.85 }); break;
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
        // skull with an integrated thick dome, brow ridge and a rim of knobs
        const ds = 1 + 0.08 * stage;
        ctx.fillStyle = skinFill(ctx, pal, -H * 1.1 * ds, H * 0.4); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.12, H * 0.3);
        ctx.bezierCurveTo(-L * 0.3, -H * 0.3, -L * 0.1, -H * 1.1 * ds, L * 0.3, -H * 1.05 * ds);
        ctx.bezierCurveTo(L * 0.62, -H * 1.0 * ds, L * 0.7, -H * 0.55, L * 0.66, -H * 0.3);
        ctx.quadraticCurveTo(L * 0.9, -H * 0.2, L * 0.98, H * 0.05); ctx.quadraticCurveTo(L * 0.92, H * 0.3 + jaw * 5, L * 0.5, H * 0.34 + jaw * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip();
        const dg = ctx.createRadialGradient(L * 0.18, -H * 1.0 * ds, 1, L * 0.25, -H * 0.6, H * 0.8);
        dg.addColorStop(0, rgba(shade(mix(pal.base, pal.accent, 0.5), 0.45), 0.9)); dg.addColorStop(1, rgba(pal.base, 0));
        ctx.fillStyle = dg; ctx.fillRect(-L, -H * 2, L * 2, H * 1.6);
        ctx.restore();
        ctx.strokeStyle = rgba(pal.dark, 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-L * 0.15, -H * 0.35); ctx.quadraticCurveTo(L * 0.25, -H * 0.55, L * 0.64, -H * 0.36); ctx.stroke();
        ctx.fillStyle = shade(pal.dark, -0.1);
        for (let k = 0; k < 6; k++) { const a2 = Math.PI * (0.62 + k * 0.1); ctx.beginPath(); ctx.arc(L * 0.25 + Math.cos(a2) * L * 0.5, -H * 0.35 + Math.sin(a2) * -H * 0.72 * ds + H * 0.05, 1.5 + stage * 0.35, 0, TAU); ctx.fill(); }
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(L * 0.5, -H * 0.3, L * 0.12, H * 0.07, -0.2, 0, TAU); ctx.fill();
        eye(ctx, L * 0.48, -H * 0.15, Math.max(1.8, H * 0.12), pal, closed, statue);
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.arc(L * 0.9, -H * 0.02, 1, 0, TAU); ctx.fill();
        break;
      }
      case 'cera': {
        const hs = 1 + 0.15 * stage, fs = 1 + 0.07 * stage;
        // bony frill: a curved shield sweeping up and back from the rear of the skull
        const rim = [];
        for (let k = 0; k <= 16; k++) { const a = -0.15 + (k / 16) * 2.35; rim.push([-L * 0.18 + Math.cos(Math.PI - a) * L * 0.62 * fs, -H * 0.35 - Math.sin(a) * H * 1.05 * fs]); }
        const fg = ctx.createRadialGradient(L * 0.05, -H * 0.2, 2, -L * 0.1, -H * 0.5, H * 1.3 * fs);
        fg.addColorStop(0, pal.base); fg.addColorStop(0.55, mix(pal.base, pal.dark, 0.3)); fg.addColorStop(1, shade(pal.dark, -0.15));
        ctx.fillStyle = fg; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L * 0.18, H * 0.25); rim.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(L * 0.3, -H * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        // coloured display band and eye-spots near the rim
        ctx.save(); ctx.clip();
        ctx.strokeStyle = rgba(pal.accent, 0.85); ctx.lineWidth = H * 0.22;
        const fcx = -L * 0.18, fcy = -H * 0.35; ctx.beginPath(); rim.forEach((q, i) => { const x = fcx + (q[0] - fcx) * 0.86, y = fcy + (q[1] - fcy) * 0.86; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.fillStyle = rgba(pal.pattern, 0.6); for (const k of [5, 9, 13]) { const q = rim[k]; ctx.beginPath(); ctx.ellipse(fcx + (q[0] - fcx) * 0.6, fcy + (q[1] - fcy) * 0.6, H * 0.12, H * 0.08, 0.5, 0, TAU); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#efe4cc'; ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 0.6;
        for (let k = 1; k < rim.length - 1; k += 2) { const [x0, y0] = rim[k]; const dx = x0 + L * 0.18, dy = y0 + H * 0.35, l = Math.hypot(dx, dy) || 1; const sl = p.spiky && k > 3 && k < rim.length - 2 ? H * 0.7 * hs : 4.5; ctx.beginPath(); ctx.moveTo(x0 - dy / l * 2.5, y0 + dx / l * 2.5); ctx.lineTo(x0 + dx / l * sl, y0 + dy / l * sl); ctx.lineTo(x0 + dy / l * 2.5, y0 - dx / l * 2.5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        // skull + parrot beak
        ctx.fillStyle = skinFill(ctx, pal, -H * 0.6, H * 0.45); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(0, H * 0.35); ctx.quadraticCurveTo(-L * 0.02, -H * 0.45, L * 0.35, -H * 0.48);
        ctx.quadraticCurveTo(L * 0.8, -H * 0.38, L * 0.98, H * 0.1); ctx.lineTo(L * 0.88, H * 0.4 + jaw * 4); ctx.quadraticCurveTo(L * 0.5, H * 0.58 + jaw * 5, L * 0.08, H * 0.48); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgba(pal.dark, 0.3); ctx.beginPath(); ctx.ellipse(L * 0.18, H * 0.12, L * 0.14, H * 0.22, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.moveTo(L * 0.8, -H * 0.05); ctx.quadraticCurveTo(L * 1.08, H * 0.05, L * 0.97, H * 0.46); ctx.lineTo(L * 0.82, H * 0.24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(L * 0.74, -H * 0.02, 1.8, 1.2, 0.4, 0, TAU); ctx.fill();
        // horns: two long brow horns above the eye, short nose horn
        const horn = (x, y, len, ang, w, far) => { ctx.fillStyle = far ? '#c8bca4' : '#efe4cc'; ctx.strokeStyle = '#6a5a44'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - w, y + 1); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.55 - w * 0.6, y + Math.sin(ang) * len * 0.62, x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + w, y + Math.sin(ang) * len * 0.42, x + w, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        if (p.spiky) { horn(L * 0.4, -H * 0.4, H * 0.25, -0.8, 2.4); horn(L * 0.74, -H * 0.3, H * 1.15 * hs, -1.15, 4.2); }
        else { horn(L * 0.33, -H * 0.4, H * 1.05 * hs, -0.52, 3, true); horn(L * 0.4, -H * 0.36, H * 1.12 * hs, -0.42, 3.4); horn(L * 0.76, -H * 0.3, H * 0.48 * hs, -0.95, 3); }
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(L * 0.34, -H * 0.2, L * 0.08, H * 0.06, -0.2, 0, TAU); ctx.fill();
        eye(ctx, L * 0.32, -H * 0.1, Math.max(1.8, H * 0.09), pal, closed, statue);
        break;
      }
      case 'hadro': {
        const cl = 1 + 0.12 * stage;
        if (p.crest !== 'none') {
          const cg = ctx.createLinearGradient(L * 0.3, -H * 0.4, -L * 0.8 * cl, -H * 1.5 * cl);
          cg.addColorStop(0, pal.accent); cg.addColorStop(1, shade(pal.accent, -0.35));
          ctx.fillStyle = cg; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(L * 0.46, -H * 0.4);
          ctx.quadraticCurveTo(L * 0.25, -H * 1.3 * cl, -L * 0.42 * cl, -H * 2.0 * cl);
          ctx.quadraticCurveTo(-L * 0.6 * cl, -H * 1.98 * cl, -L * 0.5 * cl, -H * 1.72 * cl);
          ctx.quadraticCurveTo(-L * 0.02, -H * 0.9, L * 0.14, -H * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba('#fff', 0.3); ctx.beginPath(); ctx.moveTo(L * 0.34, -H * 0.55); ctx.quadraticCurveTo(L * 0.15, -H * 1.35 * cl, -L * 0.38 * cl, -H * 1.9 * cl); ctx.stroke();
        }
        ctx.fillStyle = skinFill(ctx, pal, -H, H * 0.5); ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L * 0.05, H * 0.4); ctx.quadraticCurveTo(-L * 0.12, -H * 0.6, L * 0.3, -H * 0.55);
        ctx.quadraticCurveTo(L * 0.7, -H * 0.4, L * 1.02, -H * 0.05); ctx.quadraticCurveTo(L * 1.12, H * 0.25, L * 0.98, H * 0.4 + jaw * 3);
        ctx.quadraticCurveTo(L * 0.5, H * 0.5 + jaw * 4, L * 0.1, H * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.ellipse(L * 1.0, H * 0.2, L * 0.1, H * 0.25, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
        if (p.crest === 'none') { ctx.fillStyle = rgba(pal.accent, 0.7); ctx.beginPath(); ctx.ellipse(L * 0.25, -H * 0.5, L * 0.22 * cl, H * 0.14 * cl, -0.2, 0, TAU); ctx.fill(); }
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
  function drawPlates(ctx, top, N, from, to, pal, far, stage = 0, spikeFrom = 2) {
    for (let i = from; i < to; i++) {
      const k = (i - from) / (to - from);
      const hgt = (10 + Math.sin(k * Math.PI) * 22) * (far ? 0.85 : 1) * (1 + 0.12 * stage) * (spikeFrom < 1 && k < spikeFrom ? 1.25 : 1);
      const n = N[i], [x, y] = top[i];
      const off = far ? -5 : 3;
      const ang = Math.atan2(n.ny, n.nx);
      ctx.save(); ctx.translate(x + off, y + (far ? 2 : 1)); ctx.rotate(ang + Math.PI / 2 - (far ? 0.12 : 0));
      const g = ctx.createLinearGradient(0, 0, 0, -hgt);
      g.addColorStop(0, far ? shade(pal.dark, -0.2) : pal.dark); g.addColorStop(0.5, far ? shade(pal.accent, -0.35) : pal.accent); g.addColorStop(1, far ? shade(pal.accent, -0.2) : shade(pal.accent, 0.3));
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8;
      const wf = k < spikeFrom ? 0.14 : 0.35; // Kentrosaurus: plates turn into spikes towards the tail
      ctx.beginPath(); ctx.moveTo(-hgt * wf, 2); ctx.quadraticCurveTo(-hgt * (wf + 0.1), -hgt * 0.6, 0, -hgt); ctx.quadraticCurveTo(hgt * (wf + 0.1), -hgt * 0.55, hgt * wf, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hgt * 0.8); ctx.stroke();
      ctx.restore();
    }
  }
  function drawSail(ctx, top, from, to, pal, t, stage = 0) {
    // spined membrane: tall neural spines with a scalloped skin edge between them
    const n = (to - from) * 2 + 1, spines = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), idx = from + f * (to - from), i0 = Math.floor(idx), i1 = Math.min(to, i0 + 1), fr = idx - i0;
      const bx = lerp(top[i0][0], top[i1][0], fr), by = lerp(top[i0][1], top[i1][1], fr) + 4;
      const h = (60 * Math.pow(Math.sin(f * Math.PI), 0.7) + 5) * (1 + 0.12 * stage) * (0.9 + 0.1 * Math.sin(i * 2.3));
      spines.push([bx, by, bx + (f - 0.5) * 10, by - h]);
    }
    const g = ctx.createLinearGradient(0, spines[0][1], 0, spines[0][1] - 66);
    g.addColorStop(0, pal.dark); g.addColorStop(0.45, pal.accent); g.addColorStop(1, shade(pal.accent, 0.3));
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(spines[0][0], spines[0][1]);
    for (let i = 0; i < spines.length; i++) {
      const s0 = spines[i];
      ctx.lineTo(s0[2], s0[3] + 6);
      if (i < spines.length - 1) { const s1 = spines[i + 1]; ctx.quadraticCurveTo((s0[2] + s1[2]) / 2, Math.max(s0[3], s1[3]) + 12, s1[2], s1[3] + 6); }
    }
    ctx.lineTo(spines[spines.length - 1][0], spines[spines.length - 1][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba(pal.pattern, 0.35);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(spines[0][0] + i * 10, spines[0][1] - 20 - (i % 3) * 10, 4, 7, 0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(spines[0][0] - 20, spines[0][1] - 80, 400, 22);
    ctx.restore();
    ctx.strokeStyle = shade(pal.dark, -0.2); ctx.lineCap = 'round';
    for (const sp of spines) { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(sp[2], sp[3]); ctx.stroke(); }
    ctx.fillStyle = shade(pal.accent, 0.35); for (const sp of spines) { ctx.beginPath(); ctx.arc(sp[2], sp[3], 1.4, 0, TAU); ctx.fill(); }
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
    ctx.scale(1.9, 1.9);
    const flying = pose.fly !== false && !pose.perched;
    const flap = flying ? Math.sin(anim.t * 7) : 0;
    const edge = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.9;
    const body = [0, flying ? -8 : -24];
    const foldedWing = (far) => {
      // standing pterosaur: walks on its wing knuckles, membrane folded against the body
      const d = far ? -6 : 0, col = far ? shade(pal.base, -0.35) : pal.base;
      const sh = [body[0] + 6 + d, body[1] - 8], elbow = [body[0] + 2 + d, body[1] + 6], knuckle = [body[0] + 14 + d, 0];
      const fold = [body[0] - 14 + d, body[1] - 24];
      const g = ctx.createLinearGradient(sh[0], sh[1] - 20, knuckle[0], knuckle[1]);
      g.addColorStop(0, far ? shade(pal.accent, -0.45) : shade(pal.accent, -0.15)); g.addColorStop(1, far ? shade(pal.dark, -0.2) : pal.dark);
      ctx.fillStyle = g; ctx.strokeStyle = edge; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(knuckle[0], knuckle[1] - 3); ctx.quadraticCurveTo(fold[0] + 10, fold[1] + 4, fold[0], fold[1]); ctx.quadraticCurveTo(body[0] - 6, body[1] + 2, sh[0], sh[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      const wc = shade(pal.dark, far ? -0.35 : -0.1); limb(ctx, sh, elbow, 1.4, 1.1, wc, null); limb(ctx, elbow, knuckle, 1.1, 0.8, wc, null);
      ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(knuckle[0], knuckle[1] - 2); ctx.quadraticCurveTo(fold[0] + 16, fold[1] - 8, fold[0], fold[1]); ctx.stroke();
      ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.ellipse(knuckle[0] + 2, -0.5, 3, 1.4, 0, 0, TAU); ctx.fill();
    };
    const wing = (far) => {
      if (!flying) return foldedWing(far);
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
    ctx.beginPath(); ctx.ellipse(body[0], body[1], 16, 7, flying ? -0.05 : -0.45, 0, TAU); ctx.fill(); ctx.stroke();
    // legs
    ctx.strokeStyle = shade(pal.base, -0.3); ctx.lineWidth = 2;
    if (flying) { ctx.beginPath(); ctx.moveTo(body[0] - 12, body[1] + 2); ctx.lineTo(body[0] - 22, body[1] + 6); ctx.stroke(); }
    else { for (const dx of [-12, -8]) { limb(ctx, [body[0] + dx, body[1] + 4], [body[0] + dx - 4, body[1] + 14], 2.2, 1.5, shade(pal.base, -0.2), edge); limb(ctx, [body[0] + dx - 4, body[1] + 14], [body[0] + dx - 1, -2], 1.4, 1, shade(pal.base, -0.2), edge); ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.ellipse(body[0] + dx + 1, -1, 3.2, 1.3, 0, 0, TAU); ctx.fill(); } }
    // neck + head
    const hx = body[0] + (flying ? 18 : 14), hy = body[1] - (flying ? 8 : 18);
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
    const sc = scale * lerp(0.5, 1, growth) * (1 + 0.07 * stage * (sp.body === 'sauropod' ? 0.2 : 1));
    const headBoost = 1 + (1 - growth) * 0.45;
    if (sp.gig) { p.head = 'giga'; p.headLen *= 1.14; p.headH *= 0.66; p.tT *= 0.8; p.tB *= 0.72; p.tailLen *= 1.18; p.neckLen *= 1.25; p.hipH *= 0.9; p.bodyLen *= 1.18; p.legW *= 0.85; p.arch = 2; }
    // evolution stages grow bulkier
    const bulk = 1 + 0.07 * stage;
    if (p.neckT) p.tT *= bulk; if (p.neckT) { p.tB *= bulk; p.neckT = p.neckT.map(v => v * bulk); } p.legW *= bulk; if (p.fLegW) p.fLegW *= bulk; p.headH *= 1 + 0.04 * stage;

    ctx.save();
    ctx.translate(x, y);
    // ground shadow
    if (opts.shadow !== false && !statue) {
      const len = (SWIM[sp.body] ? SWIM[sp.body].len * 0.7 : sp.body === 'ptero' ? 90 : p.tailLen + p.bodyLen + p.neckLen * 0.6) * sc;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.55);
      g.addColorStop(0, 'rgba(0,20,0,0.38)'); g.addColorStop(1, 'rgba(0,20,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(dir * len * 0.08, (opts.fly ? 6 : 1) * sc, len * 0.55, len * 0.16, 0, 0, TAU); ctx.fill();
    }
    ctx.scale(sc * dir, sc);
    if (opts.fly) ctx.translate(0, -opts.fly / sc);
    if (SWIM[sp.body]) { drawSwimmer(ctx, sp.body, pal, anim, pose, statue, stage); ctx.restore(); return; }
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
        n.y += Math.sin(t * 1.3) * 1.5 * n.neck + Math.sin(anim.phase * TAU * 2) * 2.5 * anim.speed * n.neck;
        if (pose.sleep) n.y += n.neck * p.hipH * 0.35;
      }
    }
    normals(N);
    const { top, bot } = outline(N);
    const hip = [N[hipI].x + 2, N[hipI].y + p.tB * 0.2];
    const sh = [N[shI].x - 4, N[shI].y + p.tB * 0.35];
    const phase = anim.phase;

    // far limbs
    drawLeg(ctx, p, [hip[0] - 6, hip[1] - 5], phase + 0.5, true, pal, false, pose, anim);
    if (p.quad) drawLeg(ctx, p, [sh[0] - 5, sh[1] - 5], phase, true, pal, true, pose, anim);
    else drawArm(ctx, p, [sh[0] + 2, sh[1] - 1], true, pal, anim, pose);
    // far plates
    if (p.plates) drawPlates(ctx, top, N, 2, shI + 1, pal, true, stage, p.kentro ? 0.5 : -1);
    if (p.sail) drawSail(ctx, top, hipI - 1, shI + 1, pal, t, stage);
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
    if (p.fur && !statue) drawFurTexture(ctx, N, pal, p.fur, sid.length * 31);
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
    // species-appropriate evolution extras
    if (p.head === 'sauropod' && stage >= 1 && !statue) {
      ctx.save(); bodyPath(ctx, top, bot); ctx.clip();
      ctx.strokeStyle = rgba(pal.pattern, 0.28 + 0.08 * stage); ctx.lineCap = 'round';
      for (let i = shI; i < N.length - 1; i++) { const n = N[i]; ctx.lineWidth = n.t * 0.35; ctx.beginPath(); ctx.moveTo(n.x + n.nx * n.t * 1.1, n.y + n.ny * n.t * 1.1); ctx.lineTo(n.x - n.nx * n.b * 0.3, n.y - n.ny * n.b * 0.3); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = shade(pal.dark, -0.1);
      for (let i = 3; i < shI + 1; i++) { const [x, yq] = top[i]; ctx.beginPath(); ctx.arc(x, yq + 1, 1.5 + stage * 0.8, Math.PI, TAU); ctx.fill(); }
    }
    if (p.head === 'ornitho' && stage >= 1) { ctx.strokeStyle = rgba(pal.accent, 0.9); ctx.lineWidth = 1.2; for (let i = hipI; i < N.length - 1; i++) { const [x, yq] = top[i]; ctx.beginPath(); ctx.moveTo(x, yq + 1); ctx.lineTo(x - 3 - stage * 1.5, yq - 3 - stage * 1.5); ctx.stroke(); } }
    const theropod = ['rex', 'allo', 'giga', 'carno', 'croc', 'raptor', 'dilo'].includes(p.head);
    if ((p.crestRidge || (stage >= 1 && theropod)) && !p.plates && !p.armor) {
      ctx.fillStyle = stage >= 2 ? shade(pal.accent, -0.1) : shade(pal.dark, -0.15);
      for (let i = 1; i < N.length - 1; i++) { const [x, yq] = top[i], n = N[i]; const s = Math.min(2.5 + stage * 1.6, n.t * (0.12 + 0.06 * stage)); ctx.beginPath(); ctx.moveTo(x - s, yq + 1); ctx.lineTo(x + n.nx * s * 1.4, yq + n.ny * s * 1.4 - 1); ctx.lineTo(x + s, yq + 1); ctx.fill(); }
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
    if (p.plates) drawPlates(ctx, top, N, 3, shI + 2, pal, false, stage, p.kentro ? 0.5 : -1);
    if (p.shell) drawShell(ctx, top, N, pal, shI);
    // near limbs
    drawLeg(ctx, p, hip, phase, false, pal, false, pose, anim);
    if (p.quad) drawLeg(ctx, p, sh, phase + 0.5, false, pal, true, pose, anim);
    else drawArm(ctx, p, sh, false, pal, anim, pose);
    if (p.fur) drawFurFringe(ctx, top, bot, pal, p.fur, t);
    // head
    const last = N[N.length - 1];
    const neckAng = Math.atan2(last.ty, last.tx);
    const jaw = pose.jaw !== undefined ? pose.jaw : 0;
    const chew = pose.chew ? Math.max(0, Math.sin(t * 9)) * 0.25 : 0;
    ctx.save();
    ctx.translate(last.x - 2, last.y + 1);
    ctx.rotate(neckAng + (p.headPitch || 0) + (pose.headPitch || 0) + Math.sin(t * 1.1) * 0.03 + (anim.speed ? 0 : Math.sin(t * 0.37) * 0.09));
    ctx.scale(headBoost, headBoost);
    drawHead.t = t;
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
    if (SWIM[sp.body]) {
      const S = SWIM[sp.body], s2 = Math.min((w - 12) / S.len, (h - 12) / (S.h * 1.8));
      const wg = ctx.createLinearGradient(0, h * 0.55, 0, h); wg.addColorStop(0, 'rgba(80,190,220,0.0)'); wg.addColorStop(1, 'rgba(40,140,190,0.5)');
      draw(ctx, sid, w / 2, h * 0.55, s2, { stage, t: 0.4, pose: 'idle', shadow: false });
      ctx.fillStyle = wg; ctx.fillRect(0, h * 0.58, w, h); thumbs[key] = c; return c;
    }
    if (sp.body === 'ptero') { len = 140; ht = 80; }
    else { len = p.tailLen + p.bodyLen + p.neckLen * Math.cos(p.neckA) + p.headLen; ht = Math.max(p.hipH + p.tT, (p.shH || p.hipH) + p.neckLen * Math.sin(p.neckA) + p.headH + 20) + 10; }
    const s = Math.min((w - 10) / len, (h - 10) / ht);
    const cx = w / 2 + (p ? (p.tailLen - (p.bodyLen + p.neckLen * Math.cos(p.neckA) + p.headLen)) / 2 * s : 0);
    draw(ctx, sid, sp.body === 'ptero' ? w / 2 : cx, h - 6, s, { stage, t: 0.4, pose: sp.body === 'ptero' ? 'idle' : 'alert', fly: sp.body === 'ptero' ? 25 * s : 0 });
    thumbs[key] = c;
    return c;
  }
  function size(sid) { const sp = SPECIES[sid], p = PLANS[sp.body]; if (SWIM[sp.body]) return { len: SWIM[sp.body].len, h: SWIM[sp.body].h }; return p ? { len: p.tailLen + p.bodyLen + p.neckLen + p.headLen, h: Math.max(p.hipH, p.shH || 0) + p.tT } : { len: 140, h: 80 }; }
  return { draw, thumb, size, PLANS, SWIM };
})();

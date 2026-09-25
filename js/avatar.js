'use strict';
/* ---------- Spielfiguren: prozedural gezeichnet (3/4-Draufsicht) ----------
   Richtungen: 0 = runter, 1 = links, 2 = rechts, 3 = hoch.
   (x, y) = Fußpunkt. Gesamthöhe ca. 60 Einheiten. */
const Avatar = (() => {
  const SKINS = ['#ffdbc2', '#f1bf96', '#d49a6a', '#a8704a', '#6e452a'];
  const HAIRS = ['#1f1a24', '#5a3520', '#b8742e', '#f0d27a', '#e8e4f0', '#ff4f9a', '#3be8ff'];
  const OUTFITS = ['#6a2fe0', '#e0206e', '#1f8f6a', '#2f5fe0', '#1c1826', '#c98a12', '#e8e4ef'];
  const STYLES = [
    { id: 'short', name: 'Kurz' }, { id: 'long', name: 'Lang' },
    { id: 'bun', name: 'Dutt' }, { id: 'mohawk', name: 'Irokese' }, { id: 'bald', name: 'Glatze' },
  ];
  const DEFAULT = { name: 'Gast', skin: 1, hair: 1, style: 'short', outfit: 0, accent: '#ffc94a', glasses: false };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  }

  /* Hauptfunktion */
  function draw(g, x, y, a, dir = 0, phase = 0, moving = false, opts = {}) {
    const skin = typeof a.skin === 'number' ? SKINS[a.skin] : a.skin;
    const hair = typeof a.hair === 'number' ? HAIRS[a.hair] : a.hair;
    const outfit = typeof a.outfit === 'number' ? OUTFITS[a.outfit] : a.outfit;
    const shirt = opts.shirt || '#f4eefa';
    const accent = a.accent || '#ffc94a';
    const side = dir === 1 || dir === 2;
    const flip = dir === 1 ? -1 : 1;
    const sw = moving ? Math.sin(phase) : 0;
    const bob = moving ? -Math.abs(Math.cos(phase)) * 1.6 : Math.sin(phase * 0.5) * 0.4;

    g.save();
    g.translate(x, y);
    // Schatten
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(0, 0, 13, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.translate(0, bob);

    const pants = opts.pants || '#1c1628';
    const shoe = '#0c0a12';

    // ----- Beine -----
    if (side) {
      g.save(); g.scale(flip, 1);
      for (const k of [-1, 1]) {
        const off = sw * 5 * k;
        g.fillStyle = k === 1 ? pants : shade(pants, -12);
        rr(g, -3.5 + off, -19, 7, 17, 3); g.fill();
        g.fillStyle = shoe; rr(g, -3.5 + off, -4, 10, 4.5, 2); g.fill();
      }
      g.restore();
    } else {
      for (const k of [-1, 1]) {
        const lift = moving ? Math.max(0, sw * k) * 3.5 : 0;
        g.fillStyle = pants;
        rr(g, k * 5 - 3.5, -19, 7, 17 - lift, 3); g.fill();
        g.fillStyle = shoe; rr(g, k * 5 - 4, -4.5 - lift, 8, 5, 2.2); g.fill();
      }
    }

    // ----- Lange Haare hinten -----
    if (a.style === 'long' && dir !== 3) {
      g.fillStyle = shade(hair, -18);
      if (side) { g.save(); g.scale(flip, 1); rr(g, -9, -58, 13, 26, 6); g.fill(); g.restore(); }
      else { rr(g, -12, -57, 24, 24, 8); g.fill(); }
    }

    // ----- Arme (hinten bei Seitenansicht) -----
    const arm = (ax, ay, swing, behind) => {
      g.save(); g.translate(ax, ay); g.rotate(swing);
      g.fillStyle = behind ? shade(outfit, -30) : shade(outfit, -8);
      rr(g, -3, 0, 6, 16, 3); g.fill();
      g.fillStyle = skin; g.beginPath(); g.arc(0, 17, 3.2, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    if (side) { g.save(); g.scale(flip, 1); arm(1, -38, -sw * 0.5, true); g.restore(); }

    // ----- Oberkörper -----
    const tw = side ? 15 : 23;
    const jg = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    jg.addColorStop(0, shade(outfit, 25)); jg.addColorStop(0.55, outfit); jg.addColorStop(1, shade(outfit, -35));
    g.fillStyle = jg;
    rr(g, -tw / 2, -41, tw, 24, side ? 5 : 7); g.fill();
    if (dir === 0) {
      // Hemd, Revers, Krawatte/Fliege
      g.fillStyle = shirt;
      g.beginPath(); g.moveTo(-5, -41); g.lineTo(5, -41); g.lineTo(0, -29); g.closePath(); g.fill();
      g.fillStyle = shade(outfit, -45);
      g.beginPath(); g.moveTo(-5, -41); g.lineTo(0, -29); g.lineTo(-3, -24); g.lineTo(-8, -39); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(5, -41); g.lineTo(0, -29); g.lineTo(3, -24); g.lineTo(8, -39); g.closePath(); g.fill();
      g.fillStyle = accent;
      if (opts.bowtie) { g.beginPath(); g.moveTo(-4, -40); g.lineTo(0, -38.5); g.lineTo(4, -40); g.lineTo(4, -36); g.lineTo(0, -37.5); g.lineTo(-4, -36); g.closePath(); g.fill(); }
      else { g.beginPath(); g.moveTo(-1.6, -39); g.lineTo(1.6, -39); g.lineTo(2.2, -31); g.lineTo(0, -29); g.lineTo(-2.2, -31); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(-6, -22, 0.9, 0, Math.PI * 2); g.arc(6, -22, 0.9, 0, Math.PI * 2); g.fill();
    } else if (dir === 3) {
      g.strokeStyle = shade(outfit, -40); g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -38); g.lineTo(0, -18); g.stroke();
    } else {
      g.save(); g.scale(flip, 1);
      g.fillStyle = shirt; g.beginPath(); g.moveTo(3, -41); g.lineTo(7.5, -41); g.lineTo(7.5, -33); g.closePath(); g.fill();
      g.restore();
    }
    // Gürtel
    g.fillStyle = shade(pants, -10); g.fillRect(-tw / 2, -19.5, tw, 2.5);

    // ----- Arme vorne -----
    if (side) { g.save(); g.scale(flip, 1); arm(-1, -38, sw * 0.5, false); g.restore(); }
    else {
      const lift = moving ? sw * 0.25 : 0;
      arm(-tw / 2 - 1.5, -39, 0.12 + lift, false);
      arm(tw / 2 + 1.5, -39, -0.12 + lift, false);
    }

    // ----- Kopf -----
    g.fillStyle = shade(skin, -25); g.fillRect(-3, -45, 6, 5); // Hals
    const hx = 0, hy = -52;
    const hg = g.createRadialGradient(hx - 3, hy - 4, 1, hx, hy, 11);
    hg.addColorStop(0, shade(skin, 18)); hg.addColorStop(1, shade(skin, -18));
    g.fillStyle = hg; g.beginPath(); g.ellipse(hx, hy, side ? 9.5 : 10.5, 11, 0, 0, Math.PI * 2); g.fill();

    // Gesicht
    if (dir === 0) {
      g.fillStyle = '#1a1020';
      g.beginPath(); g.ellipse(-4, hy + 1, 1.5, 2, 0, 0, Math.PI * 2); g.ellipse(4, hy + 1, 1.5, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-3.5, hy + 0.3, 0.6, 0, Math.PI * 2); g.arc(4.5, hy + 0.3, 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,90,120,0.28)'; g.beginPath(); g.arc(-6.5, hy + 4.5, 2, 0, Math.PI * 2); g.arc(6.5, hy + 4.5, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(skin, -70); g.lineWidth = 1.1; g.lineCap = 'round';
      g.beginPath(); g.arc(0, hy + 4.5, 2.4, 0.2, Math.PI - 0.2); g.stroke();
    } else if (side) {
      g.save(); g.scale(flip, 1);
      g.fillStyle = '#1a1020'; g.beginPath(); g.ellipse(4.5, hy + 1, 1.3, 1.9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(skin, -10); g.beginPath(); g.ellipse(9, hy + 3, 1.6, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(skin, -70); g.lineWidth = 1; g.beginPath(); g.moveTo(5, hy + 6.5); g.lineTo(7.5, hy + 6); g.stroke();
      g.restore();
    }
    if (a.glasses && dir !== 3) {
      g.fillStyle = 'rgba(20,10,30,0.92)'; g.strokeStyle = accent; g.lineWidth = 0.8;
      if (side) { g.save(); g.scale(flip, 1); rr(g, 2, hy - 1.5, 7, 4.5, 2); g.fill(); g.stroke(); g.restore(); }
      else { rr(g, -8, hy - 1.5, 7, 4.5, 2); g.fill(); g.stroke(); rr(g, 1, hy - 1.5, 7, 4.5, 2); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-1, hy); g.lineTo(1, hy); g.stroke(); }
    }

    // ----- Haare -----
    drawHair(g, a.style, hair, dir, side, flip, hy);
    if (a.hat) drawHat(g, a.hat, dir, side, flip, hy, accent);
    g.restore();
  }

  /* Hüte (aus der Einkaufsmeile) */
  const HATS = {
    cap: { name: 'Basecap' }, tophat: { name: 'Zylinder' }, crown: { name: 'Krone' },
    beanie: { name: 'Mütze' }, cowboy: { name: 'Cowboyhut' }, party: { name: 'Partyhut' },
  };
  function drawHat(g, hat, dir, side, flip, hy, accent) {
    g.save();
    if (side) g.scale(flip, 1);
    const top = hy - 9;
    if (hat === 'cap') {
      g.fillStyle = accent; g.beginPath(); g.ellipse(0, top + 1, 11, 7, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = shade(accent, -40);
      if (dir === 0) { g.beginPath(); g.ellipse(0, top + 2, 11, 3.5, 0, 0, Math.PI); g.fill(); }
      else if (side) { g.beginPath(); g.ellipse(9, top + 1.5, 7, 2.5, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, top - 5, 1.4, 0, Math.PI * 2); g.fill();
    } else if (hat === 'tophat') {
      g.fillStyle = '#15101c'; g.beginPath(); g.ellipse(0, top + 1, 14, 4, 0, 0, Math.PI * 2); g.fill();
      rr(g, -8, top - 17, 16, 18, 2); g.fill();
      g.fillStyle = accent; g.fillRect(-8, top - 4, 16, 3);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-6, top - 16, 3, 12);
    } else if (hat === 'crown') {
      const gg = g.createLinearGradient(0, top - 12, 0, top + 2); gg.addColorStop(0, '#fff2b0'); gg.addColorStop(1, '#c98a12');
      g.fillStyle = gg; g.beginPath(); g.moveTo(-9, top + 1); g.lineTo(-10, top - 9); g.lineTo(-5, top - 4); g.lineTo(0, top - 12); g.lineTo(5, top - 4); g.lineTo(10, top - 9); g.lineTo(9, top + 1); g.closePath(); g.fill();
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(0, top - 3, 1.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3be8ff'; g.beginPath(); g.arc(-5, top - 1, 1.3, 0, Math.PI * 2); g.arc(5, top - 1, 1.3, 0, Math.PI * 2); g.fill();
    } else if (hat === 'beanie') {
      g.fillStyle = accent; g.beginPath(); g.ellipse(0, top + 2, 11, 10, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = shade(accent, -35); g.fillRect(-11, top, 22, 4);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, top - 9, 3.2, 0, Math.PI * 2); g.fill();
    } else if (hat === 'cowboy') {
      g.fillStyle = '#6a3e1a'; g.beginPath(); g.ellipse(0, top + 1, 17, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a5424'; g.beginPath(); g.moveTo(-9, top + 1); g.quadraticCurveTo(-9, top - 12, 0, top - 11); g.quadraticCurveTo(9, top - 12, 9, top + 1); g.closePath(); g.fill();
      g.fillStyle = '#3a200a'; g.fillRect(-9, top - 2, 18, 2.5);
    } else if (hat === 'party') {
      g.fillStyle = accent; g.beginPath(); g.moveTo(-7, top + 1); g.lineTo(0, top - 18); g.lineTo(7, top + 1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-4, top - 6, 8, 2); g.fillRect(-2, top - 12, 4, 2);
      g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(0, top - 18, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawHair(g, style, hair, dir, side, flip, hy) {
    if (style === 'bald') {
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-3, hy - 6, 3.5, 2, -0.4, 0, Math.PI * 2); g.fill();
      return;
    }
    const hg = g.createLinearGradient(0, hy - 12, 0, hy + 2);
    hg.addColorStop(0, shade(hair, 30)); hg.addColorStop(1, shade(hair, -20));
    g.fillStyle = hg;
    g.save();
    if (side) g.scale(flip, 1);
    if (style === 'mohawk') {
      g.fillStyle = hair;
      g.beginPath();
      if (side) { g.moveTo(-8, hy - 4); g.quadraticCurveTo(-4, hy - 20, 5, hy - 16); g.quadraticCurveTo(2, hy - 10, 1, hy - 8); g.closePath(); }
      else { g.moveTo(-2.5, hy - 6); g.lineTo(0, hy - 19); g.lineTo(2.5, hy - 6); g.closePath(); }
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.ellipse(0, hy - 3, side ? 8 : 10, 5, 0, Math.PI, Math.PI * 2); g.fill();
      g.restore(); return;
    }
    // Grundschopf
    g.beginPath();
    if (dir === 3) { g.ellipse(0, hy - 1, 11, 11.5, 0, 0, Math.PI * 2); }
    else if (side) {
      g.moveTo(-9.5, hy + 2); g.quadraticCurveTo(-11, hy - 12, 0, hy - 12); g.quadraticCurveTo(10, hy - 12, 9.5, hy - 3);
      g.quadraticCurveTo(4, hy - 7, 1, hy - 4); g.quadraticCurveTo(-3, hy - 2, -4, hy + 3); g.closePath();
    } else {
      g.moveTo(-11, hy + 1); g.quadraticCurveTo(-12, hy - 13, 0, hy - 12.5); g.quadraticCurveTo(12, hy - 13, 11, hy + 1);
      g.quadraticCurveTo(9, hy - 6, 3, hy - 6.5); g.quadraticCurveTo(-2, hy - 3, -6, hy - 6); g.quadraticCurveTo(-9, hy - 5, -11, hy + 1); g.closePath();
    }
    g.fill();
    if (style === 'long' && dir === 3) { rr(g, -11, hy - 2, 22, 22, 8); g.fill(); }
    if (style === 'long' && dir === 0) { rr(g, -12, hy - 4, 5, 20, 3); g.fill(); rr(g, 7, hy - 4, 5, 20, 3); g.fill(); }
    if (style === 'bun') {
      g.beginPath(); g.arc(side ? -4 : 0, hy - 14, 5.5, 0, Math.PI * 2); g.fill();
    }
    // Glanz
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.ellipse(side ? 1 : -4, hy - 9, 4, 1.8, -0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function load() {
    const a = Object.assign({}, DEFAULT, Store.s.avatar || {});
    return a;
  }

  return { draw, drawHat, HATS, SKINS, HAIRS, OUTFITS, STYLES, DEFAULT, load, shade };
})();

'use strict';
/* Vektor-Grafiken der Slot-Symbole. Jede Funktion zeichnet in eine 100×100-Box. */
const Symbols = (() => {
  const DISPLAY_FONT = '"Bungee", "Impact", "Arial Black", sans-serif';

  function glossBall(g, x, y, r, light, mid, dark) {
    const rg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    rg.addColorStop(0, light); rg.addColorStop(0.45, mid); rg.addColorStop(1, dark);
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // Randlicht unten rechts
    const rim = g.createRadialGradient(x + r * 0.5, y + r * 0.55, 0, x + r * 0.5, y + r * 0.55, r * 0.7);
    rim.addColorStop(0, 'rgba(255,255,255,0.22)'); rim.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rim; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // Glanzpunkt
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(x - r * 0.08, y - r * 0.6, r * 0.07, 0, Math.PI * 2); g.fill();
  }

  function leaf(g, x, y, len, ang, w = 0.42) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const lg = g.createLinearGradient(0, -len * w, 0, len * w);
    lg.addColorStop(0, '#b9ff7a'); lg.addColorStop(0.5, '#3fc34a'); lg.addColorStop(1, '#136b2a');
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, -len * w, len, 0);
    g.quadraticCurveTo(len * 0.45, len * w, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(10,70,25,0.8)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(len * 0.05, 0); g.quadraticCurveTo(len * 0.5, -len * 0.06, len * 0.92, 0); g.stroke();
    g.restore();
  }

  const draw = {
    cherry(g) {
      g.lineCap = 'round';
      const st = g.createLinearGradient(30, 20, 70, 70);
      st.addColorStop(0, '#6e4a1a'); st.addColorStop(1, '#3f8a2a');
      g.strokeStyle = st; g.lineWidth = 4.2;
      g.beginPath(); g.moveTo(31, 58); g.quadraticCurveTo(36, 32, 59, 17); g.stroke();
      g.beginPath(); g.moveTo(69, 60); g.quadraticCurveTo(68, 36, 59, 17); g.stroke();
      leaf(g, 59, 17, 30, -0.35);
      glossBall(g, 31, 68, 18, '#ff9aa8', '#e3123f', '#5e0014');
      glossBall(g, 69, 71, 18, '#ff9aa8', '#e3123f', '#5e0014');
    },
    lemon(g) {
      g.save(); g.translate(50, 54); g.rotate(-0.38);
      const rg = g.createRadialGradient(-10, -12, 3, 0, 0, 44);
      rg.addColorStop(0, '#fffbd0'); rg.addColorStop(0.35, '#ffe34a'); rg.addColorStop(0.85, '#e8a900'); rg.addColorStop(1, '#9a6400');
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(-43, 0);
      g.bezierCurveTo(-40, -33, 40, -33, 43, 0);
      g.bezierCurveTo(40, 33, -40, 33, -43, 0);
      g.fill();
      g.beginPath(); g.ellipse(-43, 0, 5, 4.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(43, 0, 5, 4.2, 0, 0, Math.PI * 2); g.fill();
      // Poren
      g.fillStyle = 'rgba(150,95,0,0.18)';
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39, rr = 6 + (i * 7.3) % 22;
        g.beginPath(); g.arc(Math.cos(a) * rr * 1.4, Math.sin(a) * rr * 0.9, 1.1, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.ellipse(-12, -14, 16, 5.5, -0.15, 0, Math.PI * 2); g.fill();
      g.restore();
      leaf(g, 72, 30, 22, -1.1, 0.45);
    },
    grape(g) {
      g.strokeStyle = '#6b4a1e'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(50, 26); g.quadraticCurveTo(52, 14, 60, 8); g.stroke();
      leaf(g, 52, 18, 28, -2.6, 0.5);
      const rows = [[4, 30], [3, 45], [3, 58], [2, 71], [1, 83]];
      const r = 9.5;
      rows.forEach(([n, y], ri) => {
        for (let i = 0; i < n; i++) {
          const x = 50 + (i - (n - 1) / 2) * r * 1.9 + (ri === 2 ? 0 : 0);
          glossBall(g, x, y, r, '#f0c6ff', '#9b35e8', '#3a0a6e');
        }
      });
    },
    bell(g) {
      // Knauf
      glossBall(g, 50, 14, 6, '#fff6c8', '#f2b52a', '#7a4a00');
      const lg = g.createLinearGradient(16, 0, 84, 0);
      lg.addColorStop(0, '#6a3c00'); lg.addColorStop(0.28, '#f5c542'); lg.addColorStop(0.4, '#fff5c4');
      lg.addColorStop(0.55, '#ffd24a'); lg.addColorStop(0.8, '#c78400'); lg.addColorStop(1, '#5c3300');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(50, 18);
      g.bezierCurveTo(31, 18, 27, 38, 26, 54);
      g.bezierCurveTo(25, 67, 17, 71, 14, 78);
      g.lineTo(86, 78);
      g.bezierCurveTo(83, 71, 75, 67, 74, 54);
      g.bezierCurveTo(73, 38, 69, 18, 50, 18);
      g.fill();
      // Klöppel
      glossBall(g, 50, 85, 7, '#fff6c8', '#e6a620', '#6a3c00');
      // Rand
      const rl = g.createLinearGradient(12, 0, 88, 0);
      rl.addColorStop(0, '#5c3300'); rl.addColorStop(0.35, '#ffe07a'); rl.addColorStop(0.7, '#d18f10'); rl.addColorStop(1, '#5c3300');
      g.fillStyle = rl;
      g.beginPath(); g.ellipse(50, 78, 38, 6.5, 0, 0, Math.PI * 2); g.fill();
      // Zierband
      g.strokeStyle = 'rgba(120,70,0,0.55)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(28, 50); g.quadraticCurveTo(50, 56, 72, 50); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(40, 26); g.quadraticCurveTo(34, 40, 34, 58); g.stroke();
    },
    clover(g) {
      g.strokeStyle = '#1d7a34'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(50, 50); g.quadraticCurveTo(56, 74, 66, 90); g.stroke();
      for (let k = 0; k < 4; k++) {
        g.save(); g.translate(50, 46); g.rotate(Math.PI / 4 + k * Math.PI / 2);
        const rg = g.createRadialGradient(0, -22, 2, 0, -18, 26);
        rg.addColorStop(0, '#caff9e'); rg.addColorStop(0.5, '#34c24f'); rg.addColorStop(1, '#0c5a24');
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(0, -2);
        g.bezierCurveTo(-5, -12, -25, -16, -22, -30);
        g.bezierCurveTo(-19, -41, -4, -41, 0, -31);
        g.bezierCurveTo(4, -41, 19, -41, 22, -30);
        g.bezierCurveTo(25, -16, 5, -12, 0, -2);
        g.fill();
        g.strokeStyle = 'rgba(5,60,20,0.6)'; g.lineWidth = 1.3; g.stroke();
        g.strokeStyle = 'rgba(230,255,210,0.55)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(0, -5); g.lineTo(0, -28); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.beginPath(); g.ellipse(-11, -31, 5, 3, -0.6, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.fillStyle = '#e8ffb0'; g.beginPath(); g.arc(50, 46, 2.5, 0, Math.PI * 2); g.fill();
    },
    diamond(g) {
      const top = [[32, 22], [50, 22], [68, 22]];
      const bot = [[16, 40], [38, 40], [62, 40], [84, 40]];
      const tip = [50, 90];
      const seq = [bot[0], top[0], bot[1], top[1], bot[2], top[2], bot[3]];
      const crown = ['#c9fbff', '#7fe9ff', '#e9ffff', '#5fd8ff', '#b4f4ff'];
      // Tafel
      g.fillStyle = '#a8f3ff';
      g.beginPath(); g.moveTo(32, 22); g.lineTo(68, 22); g.lineTo(62, 40); g.lineTo(38, 40); g.closePath(); g.fill();
      for (let i = 0; i < seq.length - 2; i++) {
        g.fillStyle = crown[i];
        g.beginPath(); g.moveTo(...seq[i]); g.lineTo(...seq[i + 1]); g.lineTo(...seq[i + 2]); g.closePath(); g.fill();
      }
      const pav = ['#1aa6e0', '#63d6ff', '#0d7fc0', '#0a5a9a'];
      const pts = [bot[0], [27, 40], bot[1], bot[2], [73, 40], bot[3]];
      const cols = ['#0b6fae', '#35c2f5', '#9eeeff', '#1a9ae0', '#084f8c'];
      for (let i = 0; i < pts.length - 1; i++) {
        g.fillStyle = cols[i] || pav[i % 4];
        g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.lineTo(...tip); g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 1.1; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(32, 22); g.lineTo(68, 22); g.lineTo(84, 40); g.lineTo(50, 90); g.lineTo(16, 40); g.closePath();
      g.moveTo(16, 40); g.lineTo(84, 40);
      for (const p of [bot[1], bot[2]]) { g.moveTo(...p); g.lineTo(...tip); }
      g.stroke();
      // Funkeln
      g.save(); g.translate(30, 26); g.fillStyle = '#fff';
      g.shadowColor = '#fff'; g.shadowBlur = 8;
      g.beginPath();
      for (let k = 0; k < 8; k++) { const r = k % 2 ? 1.6 : 9; const a = k * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.restore();
    },
    seven(g) {
      const path = () => {
        g.beginPath();
        g.moveTo(22, 16); g.lineTo(84, 16); g.lineTo(84, 30);
        g.bezierCurveTo(70, 44, 60, 62, 56, 88);
        g.lineTo(34, 88);
        g.bezierCurveTo(38, 64, 50, 46, 62, 33);
        g.lineTo(38, 33); g.lineTo(36, 40); g.lineTo(22, 40); g.closePath();
      };
      g.save(); g.transform(1, 0, -0.08, 1, 4, 0);
      path(); g.lineJoin = 'round';
      g.strokeStyle = '#3a0008'; g.lineWidth = 11; g.stroke();
      const gold = g.createLinearGradient(0, 14, 0, 90);
      gold.addColorStop(0, '#fff3b0'); gold.addColorStop(0.5, '#f5b82a'); gold.addColorStop(1, '#8a5200');
      g.strokeStyle = gold; g.lineWidth = 6.5; g.stroke();
      const red = g.createLinearGradient(0, 16, 0, 88);
      red.addColorStop(0, '#ff8a8a'); red.addColorStop(0.35, '#ff1f3d'); red.addColorStop(1, '#8a0016');
      g.fillStyle = red; g.fill();
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(10, 10); g.lineTo(90, 10); g.lineTo(90, 23); g.lineTo(10, 27); g.fill();
      g.restore();
      g.restore();
    },
    wild(g) {
      const gold = g.createLinearGradient(0, 20, 0, 78);
      gold.addColorStop(0, '#fff6c4'); gold.addColorStop(0.45, '#ffcc33'); gold.addColorStop(1, '#a86400');
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(18, 64); g.lineTo(13, 28); g.lineTo(32, 45); g.lineTo(50, 18); g.lineTo(68, 45); g.lineTo(87, 28); g.lineTo(82, 64); g.closePath();
      g.strokeStyle = '#5a3000'; g.lineWidth = 5; g.stroke();
      g.fillStyle = gold; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(22, 58); g.lineTo(19, 38); g.lineTo(32, 50); g.lineTo(50, 26); g.lineTo(50, 40); g.lineTo(34, 60); g.closePath(); g.fill();
      // Band
      const band = g.createLinearGradient(0, 60, 0, 76);
      band.addColorStop(0, '#ffe07a'); band.addColorStop(1, '#8a5200');
      g.fillStyle = band;
      g.beginPath(); g.roundRect ? g.roundRect(15, 60, 70, 14, 4) : g.rect(15, 60, 70, 14); g.fill();
      g.strokeStyle = '#5a3000'; g.lineWidth = 2; g.stroke();
      glossBall(g, 32, 67, 4.5, '#ffc2d6', '#ff2a6d', '#6e0024');
      glossBall(g, 50, 67, 5.2, '#c8f8ff', '#26c8ff', '#004a7a');
      glossBall(g, 68, 67, 4.5, '#caffc2', '#2ad35a', '#0a5a1e');
      glossBall(g, 13, 27, 4.5, '#fff', '#ffd24a', '#8a5200');
      glossBall(g, 50, 16, 5, '#fff', '#ff5b9a', '#7a0030');
      glossBall(g, 87, 27, 4.5, '#fff', '#ffd24a', '#8a5200');
      // Schriftzug
      g.font = `26px ${DISPLAY_FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.lineWidth = 6; g.strokeStyle = '#3a0030'; g.strokeText('WILD', 50, 98);
      const tg = g.createLinearGradient(0, 78, 0, 98);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ff7ac0');
      g.fillStyle = tg; g.fillText('WILD', 50, 98);
    },
    scatter(g) {
      const cx = 50, cy = 44;
      const star = (ro, ri) => {
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? ri : ro, a = -Math.PI / 2 + k * Math.PI / 5;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
      };
      g.save(); g.shadowColor = '#ff3dd0'; g.shadowBlur = 18;
      star(40, 17);
      const rg = g.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, 42);
      rg.addColorStop(0, '#fff0fb'); rg.addColorStop(0.35, '#ff5fd2'); rg.addColorStop(0.8, '#8a1fe0'); rg.addColorStop(1, '#3c0a78');
      g.fillStyle = rg; g.fill(); g.restore();
      g.lineJoin = 'round'; g.strokeStyle = '#ffe3fa'; g.lineWidth = 2; star(40, 17); g.stroke();
      star(20, 8.5); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill();
      g.font = `19px ${DISPLAY_FONT}`; g.textAlign = 'center';
      g.lineWidth = 5; g.strokeStyle = '#2a0650'; g.strokeText('BONUS', 50, 97);
      g.fillStyle = '#ffe36b'; g.fillText('BONUS', 50, 97);
    },
  };

  const cache = new Map();
  // Rendert ein Symbol einmal auf eine Offscreen-Canvas (mit Schlagschatten/Glow)
  function sprite(id, size) {
    const key = id + '@' + size;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const k = size / 100;
    // Symbol zuerst in eine Zwischenebene zeichnen, damit der Schatten die Gesamtform umfasst
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = size;
    const tg = tmp.getContext('2d'); tg.scale(k, k);
    draw[id](tg);
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 7 * k; g.shadowOffsetY = 4 * k;
    g.translate(size / 2, size / 2); g.scale(0.84, 0.84); g.translate(-size / 2, -size / 2);
    g.drawImage(tmp, 0, 0);
    cache.set(key, c);
    return c;
  }
  function clear() { cache.clear(); }
  return { sprite, clear, ids: Object.keys(draw) };
})();

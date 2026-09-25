'use strict';
/* ---------- Hintergrund: unscharfe Casino-Lichter + Scheinwerfer ---------- */
const Background = (() => {
  const c = $('#bg'), g = c.getContext('2d');
  let W = 0, H = 0, dpr = 1, orbs = [], last = 0, running = true;
  const COLORS = ['255,61,139', '59,232,255', '255,201,74', '157,92,255', '255,120,60'];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const n = Math.round(U.clamp(W * H / 26000, 18, 55));
    orbs = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: U.rand(20, 110), c: U.pick(COLORS), a: U.rand(0.04, 0.16),
      vx: U.rand(-6, 6), vy: U.rand(-10, -2), ph: Math.random() * 6.28, sp: U.rand(0.3, 1.1),
    }));
    draw(0);
  }

  function draw(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#12081f'); grd.addColorStop(0.55, '#1a0c2e'); grd.addColorStop(1, '#0b0614');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);

    // Scheinwerferkegel von oben
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const sw = Math.sin(t * 0.00012 + i * 2.1) * 0.35;
      const x = W * (0.2 + i * 0.3);
      g.save(); g.translate(x, -40); g.rotate(sw);
      const lg = g.createLinearGradient(0, 0, 0, H * 0.95);
      const col = i === 1 ? '255,61,139' : '120,90,255';
      lg.addColorStop(0, `rgba(${col},0.10)`); lg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.lineTo(W * 0.22, H * 0.95); g.lineTo(-W * 0.22, H * 0.95); g.closePath(); g.fill();
      g.restore();
    }
    // Bokeh-Lichter
    for (const o of orbs) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 0.001 * o.sp + o.ph);
      const rg = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      rg.addColorStop(0, `rgba(${o.c},${o.a * pulse})`);
      rg.addColorStop(0.6, `rgba(${o.c},${o.a * 0.45 * pulse})`);
      rg.addColorStop(1, `rgba(${o.c},0)`);
      g.fillStyle = rg; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // Vignette
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(5,2,10,0)'); vg.addColorStop(1, 'rgba(5,2,10,0.75)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    if (t - last > 33) { // ~30 fps reicht für den Hintergrund
      for (const o of orbs) {
        o.x += o.vx * dt * 2; o.y += o.vy * dt * 2;
        if (o.y < -o.r) { o.y = H + o.r; o.x = Math.random() * W; }
        if (o.x < -o.r) o.x = W + o.r; if (o.x > W + o.r) o.x = -o.r;
      }
      draw(t); last = t;
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (U.reducedMotion) return;
    running = !document.hidden; if (running) requestAnimationFrame(loop);
  });
  resize();
  if (!U.reducedMotion) requestAnimationFrame(loop);
  return { resize };
})();

/* ---------- Partikel-Overlay ---------- */
const FX = (() => {
  const c = $('#fx'), g = c.getContext('2d');
  let W = 0, H = 0, dpr = 1, parts = [], raf = null, last = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  window.addEventListener('resize', resize); resize();

  function add(p) {
    parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 900, life: 1.5, age: 0, size: 6, rot: 0, vr: 0, drag: 0.99, shape: 'spark', color: '#fff', spin: 0, vs: 0 }, p));
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function drawCoin(p, alpha) {
    const w = Math.abs(Math.cos(p.spin)) * p.size, h = p.size;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = alpha;
    // Rand (Dicke)
    g.fillStyle = '#9a5b00';
    g.beginPath(); g.ellipse(Math.sign(Math.cos(p.spin)) * 1.2, 0, Math.max(1.2, w), h, 0, 0, 6.283); g.fill();
    const lg = g.createLinearGradient(-w, -h, w, h);
    const front = Math.cos(p.spin) > 0;
    lg.addColorStop(0, front ? '#fff3b0' : '#ffd766'); lg.addColorStop(0.45, '#ffc93a'); lg.addColorStop(1, '#c47a00');
    g.fillStyle = lg;
    g.beginPath(); g.ellipse(0, 0, Math.max(0.8, w - 0.6), h - 0.6, 0, 0, 6.283); g.fill();
    if (w > h * 0.35) {
      g.strokeStyle = 'rgba(150,85,0,0.8)'; g.lineWidth = Math.max(1, h * 0.12);
      g.beginPath(); g.ellipse(0, 0, w * 0.68, h * 0.68, 0, 0, 6.283); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.ellipse(-w * 0.3, -h * 0.35, w * 0.22, h * 0.14, -0.5, 0, 6.283); g.fill();
    }
    g.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > H + 60) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.spin += p.vs * dt;
      const t = p.age / p.life;
      const alpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      if (p.shape === 'coin') drawCoin(p, alpha);
      else if (p.shape === 'confetti') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = alpha;
        g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 4 * Math.abs(Math.cos(p.spin)), p.size, p.size / 2 * Math.abs(Math.cos(p.spin)) + 0.5);
        g.restore();
      } else if (p.shape === 'star') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = alpha;
        g.globalCompositeOperation = 'lighter';
        const s = p.size * (1 - t * 0.5);
        g.fillStyle = p.color;
        g.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.25 : s; const a = k * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill();
        g.restore();
      } else {
        g.globalAlpha = alpha; g.globalCompositeOperation = 'lighter';
        const s = p.size * (1 - t * 0.6);
        const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, p.color); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(p.x, p.y, s, 0, 6.283); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
    }
    if (parts.length) raf = requestAnimationFrame(loop);
    else { raf = null; g.clearRect(0, 0, W, H); }
  }

  const CONF = ['#ff3d8b', '#3be8ff', '#ffc94a', '#7dff8a', '#b77dff', '#ffffff'];

  return {
    coins(x, y, n = 20, power = 1) {
      if (U.reducedMotion) n = Math.min(n, 6);
      for (let i = 0; i < n; i++) {
        const a = U.rand(-Math.PI * 0.92, -Math.PI * 0.08);
        const sp = U.rand(300, 720) * power;
        add({ shape: 'coin', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1300, life: U.rand(1.4, 2.2), size: U.rand(7, 12), spin: Math.random() * 6, vs: U.rand(8, 16), rot: U.rand(-0.3, 0.3), drag: 0.995 });
      }
    },
    coinRain(n = 80) {
      for (let i = 0; i < n; i++) {
        add({ shape: 'coin', x: Math.random() * W, y: U.rand(-H * 0.6, -20), vx: U.rand(-40, 40), vy: U.rand(100, 400), g: 700, life: 4, size: U.rand(9, 15), spin: Math.random() * 6, vs: U.rand(6, 14), drag: 0.998 });
      }
    },
    confetti(n = 120, x = W / 2, y = H * 0.35) {
      if (U.reducedMotion) n = Math.min(n, 20);
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2), sp = U.rand(200, 850);
        add({ shape: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 300, g: 600, drag: 0.975, life: U.rand(2, 3.4), size: U.rand(7, 13), color: U.pick(CONF), rot: Math.random() * 6, vr: U.rand(-10, 10), spin: Math.random() * 6, vs: U.rand(5, 15) });
      }
    },
    sparks(x, y, n = 14, color = '#ffc94a', speed = 260) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = U.rand(0.3, 1) * speed;
        add({ shape: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, drag: 0.94, life: U.rand(0.4, 0.8), size: U.rand(4, 9), color });
      }
    },
    stars(x, y, n = 8, color = '#fff6c0') {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = U.rand(40, 200);
        add({ shape: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.93, life: U.rand(0.5, 1), size: U.rand(6, 14), color, vr: U.rand(-3, 3) });
      }
    },
    floatText(x, y, text, cls = '') {
      const el = document.createElement('div');
      el.className = 'float-text ' + cls;
      el.textContent = text;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    },
    shake(el, strong = false) {
      if (U.reducedMotion || !el) return;
      el.classList.remove('shake', 'shake-strong');
      void el.offsetWidth;
      el.classList.add(strong ? 'shake-strong' : 'shake');
    },
    flash(color = 'rgba(255,201,74,0.35)') {
      const el = document.createElement('div');
      el.className = 'screen-flash'; el.style.background = `radial-gradient(circle at 50% 45%, ${color}, transparent 70%)`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 700);
    },
    center(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
  };
})();

/* ---------- Toasts ---------- */
const Toast = {
  show(title, text, icon = '★', kind = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<div class="toast-icon">${icon}</div><div><b></b><span></span></div>`;
    el.querySelector('b').textContent = title;
    el.querySelector('span').textContent = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4100);
  },
};

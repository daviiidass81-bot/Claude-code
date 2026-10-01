'use strict';
/* ==========================================================
   Input: mouse, touch (pan / pinch), keyboard
   ========================================================== */
const Input = {
  pointers: new Map(), dragging: false, start: null, camStart: null, pinch: null, painting: false, ghostDrag: false, keys: {},
  init() {
    const cv = Render.cv;
    cv.addEventListener('pointerdown', e => this.down(e));
    addEventListener('pointermove', e => this.move(e));
    addEventListener('pointerup', e => this.up(e));
    addEventListener('pointercancel', e => this.up(e));
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(e.clientX, e.clientY, f);
    }, { passive: false });
    addEventListener('keydown', e => this.key(e, true));
    addEventListener('keyup', e => this.key(e, false));
  },
  zoomAt(sx, sy, f) {
    const c = Render.cam;
    const before = Render.s2w(sx, sy);
    c.zoom = clamp(c.zoom * f, 0.35, 2.2);
    const after = Render.s2w(sx, sy);
    c.x += before.x - after.x; c.y += before.y - after.y;
    c.tx = c.ty = c.tz = null;
  },
  down(e) {
    Sfx.init();
    Render.cv.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: Render.cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.painting = false; this.ghostDrag = false;
      return;
    }
    this.start = { x: e.clientX, y: e.clientY, b: e.button };
    this.camStart = { x: Render.cam.x, y: Render.cam.y };
    this.dragging = false;
    const tile = Render.s2t(e.clientX, e.clientY);
    if (Game.mode === 'road' && e.button === 0) { this.painting = true; Game.paintRoad(tile); }
    const g = Render.ghost;
    if (Game.mode === 'place' && g && e.button === 0 && tile.x >= g.x && tile.x < g.x + g.w && tile.y >= g.y && tile.y < g.y + g.h) { this.ghostDrag = { ox: tile.x - g.x, oy: tile.y - g.y }; }
  },
  move(e) {
    const tile = Render.s2t(e.clientX, e.clientY);
    Render.hover = World.inMap(tile.x, tile.y) ? tile : null;
    if (!this.pointers.has(e.pointerId)) { Game.hoverAt(e.clientX, e.clientY); return; }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.zoomAt(mx, my, (this.pinch.zoom * d / this.pinch.d) / Render.cam.zoom);
      Render.cam.x -= (mx - this.pinch.mx) / Render.cam.zoom; Render.cam.y -= (my - this.pinch.my) / Render.cam.zoom;
      this.pinch.mx = mx; this.pinch.my = my;
      return;
    }
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (!this.dragging && Math.hypot(dx, dy) > 7) this.dragging = true;
    if (this.painting) { Game.paintRoad(tile); return; }
    if (this.ghostDrag) { Game.moveGhost(tile.x - this.ghostDrag.ox, tile.y - this.ghostDrag.oy); return; }
    if (this.dragging) {
      const c = Render.cam;
      c.x = this.camStart.x - dx / c.zoom; c.y = this.camStart.y - dy / c.zoom;
      c.tx = c.ty = c.tz = null;
      Render.cv.style.cursor = 'grabbing';
    }
  },
  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    Render.cv.style.cursor = '';
    if (this.pinch) { if (this.pointers.size < 2) { this.pinch = null; this.start = null; } return; }
    const wasDrag = this.dragging, painting = this.painting, gd = this.ghostDrag;
    this.dragging = false; this.painting = false; this.ghostDrag = false;
    if (!this.start) return;
    if (painting) { Game.endRoadStroke(); this.start = null; return; }
    if (!wasDrag && !gd && this.start.b === 0) Game.tap(e.clientX, e.clientY);
    if (gd) Game.moveGhostDone();
    this.start = null;
  },
  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    this.keys[e.key.toLowerCase()] = down;
    if (!down) return;
    const k = e.key;
    if (k === 'Escape') Game.escape();
    else if (k === 'Enter' && Game.mode === 'place') Game.confirmPlace();
    else if (k === '+' || k === '=') this.zoomAt(Render.W / 2, Render.H / 2, 1.15);
    else if (k === '-' || k === '_') this.zoomAt(Render.W / 2, Render.H / 2, 1 / 1.15);
    else if (!UI.modalOpen() && !Battle.active) {
      if (k === 'r' || k === 'R') Game.toggleTool('road');
      else if (k === 'm' || k === 'M') Game.toggleTool('market');
      else if (k === 'l' || k === 'L') Game.toggleTool('lab');
    }
  },
  update(dt) {
    const c = Render.cam, sp = 700 * dt / c.zoom;
    const k = this.keys;
    if (UI.modalOpen() || Battle.active) return;
    let moved = false;
    if (k['a'] || k['arrowleft']) { c.x -= sp; moved = true; }
    if (k['d'] || k['arrowright']) { c.x += sp; moved = true; }
    if (k['w'] || k['arrowup']) { c.y -= sp; moved = true; }
    if (k['s'] || k['arrowdown']) { c.y += sp; moved = true; }
    if (moved) c.tx = c.ty = c.tz = null;
  },
};

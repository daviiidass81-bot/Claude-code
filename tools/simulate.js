// RTP-Simulation: node tools/simulate.js
const CFG = require('../js/config.js');
const S = CFG.slots;
const W = S.symbols.map(s => s.weight), TW = W.reduce((a, b) => a + b);
const WILD = S.symbols.findIndex(s => s.wild), SCAT = S.symbols.findIndex(s => s.scatter);
function rs() { let r = Math.random() * TW; for (let i = 0; i < W.length; i++) { r -= W[i]; if (r < 0) return i; } return 0; }
function spinGrid() { const g = []; for (let r = 0; r < 5; r++) { g.push([rs(), rs(), rs()]); } return g; }
function lineWin(g, line) {
  let sym = -1, n = 0;
  for (let r = 0; r < 5; r++) {
    const s = g[r][line[r]];
    if (s === SCAT) break;
    if (s === WILD) { n++; continue; }
    if (sym === -1) { sym = s; n++; continue; }
    if (s === sym) { n++; continue; }
    break;
  }
  if (sym === -1) sym = WILD;
  // Wild-Linie allein kann besser sein als mit Symbol
  let wn = 0; for (let r = 0; r < 5; r++) { if (g[r][line[r]] === WILD) wn++; else break; }
  const a = n >= 3 ? S.symbols[sym].pays[n - 3] : 0;
  const b = wn >= 3 ? S.symbols[WILD].pays[wn - 3] : 0;
  return Math.max(a, b);
}
function evalSpin(g) {
  let lw = 0; for (const l of S.lines) lw += lineWin(g, l);
  let sc = 0; for (const c of g) for (const s of c) if (s === SCAT) sc++;
  return { lw, sc: Math.min(sc, 5) };
}
const N = +process.argv[2] || 2e6;
let ret = 0, hits = 0, fsTrig = 0, big = 0;
for (let i = 0; i < N; i++) {
  const { lw, sc } = evalSpin(spinGrid());
  let win = lw / 10; // Linieneinsatz = Einsatz / 10, Einsatz = 1
  let fs = 0;
  if (sc >= 3) { win += S.scatterPays[sc][0]; fs = S.scatterPays[sc][1]; fsTrig++; }
  while (fs > 0) {
    fs--;
    const e = evalSpin(spinGrid());
    win += e.lw / 10 * S.freeSpinMult;
    if (e.sc >= 3) { win += S.scatterPays[e.sc][0]; fs += S.scatterPays[e.sc][1]; }
  }
  if (win > 0) hits++;
  if (win >= 15) big++;
  ret += win;
}
console.log('Slots RTP', (ret / N * 100).toFixed(2) + '%', 'Trefferquote', (hits / N * 100).toFixed(1) + '%',
  'Freispiele 1 in', (N / fsTrig).toFixed(0), 'BigWin 1 in', (N / big).toFixed(0));
// Plinko exakt (Binomial)
function C(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
for (const rows of CFG.plinko.rows) for (const risk of ['low', 'mid', 'high']) {
  const t = CFG.plinko.tables[rows][risk]; let e = 0;
  for (let k = 0; k <= rows; k++) e += C(rows, k) / 2 ** rows * t[k];
  console.log('Plinko', rows, risk, (e * 100).toFixed(2) + '%');
}
const ws = CFG.wheel.segments, tw = ws.reduce((a, s) => a + s.w, 0);
console.log('Rad Erwartungswert', (ws.reduce((a, s) => a + s.v * s.w, 0) / tw).toFixed(0));

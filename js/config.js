'use strict';
/* Spielmathematik: Symbole, Gewinnlinien, Plinko-Tabellen, Glücksrad.
   Alle Werte sind per Simulation abgestimmt (tools/simulate.js). */
const CFG = {
  slots: {
    reels: 5,
    rows: 3,
    bets: [10, 20, 50, 100, 250, 500, 1000],
    // Symbol-IDs: Reihenfolge = Index
    symbols: [
      { id: 'cherry',  name: 'Kirsche',  weight: 26, pays: [6, 20, 60] },
      { id: 'lemon',   name: 'Zitrone',  weight: 24, pays: [7, 22, 70] },
      { id: 'grape',   name: 'Trauben',  weight: 20, pays: [10, 30, 100] },
      { id: 'bell',    name: 'Glocke',   weight: 15, pays: [18, 55, 180] },
      { id: 'clover',  name: 'Kleeblatt',weight: 13, pays: [25, 75, 250] },
      { id: 'diamond', name: 'Diamant',  weight: 8,  pays: [45, 140, 600] },
      { id: 'seven',   name: 'Sieben',   weight: 5,  pays: [80, 300, 1500] },
      { id: 'wild',    name: 'Wild',     weight: 4,  pays: [120, 500, 3000], wild: true },
      { id: 'scatter', name: 'Bonus',    weight: 3,  pays: [0, 0, 0], scatter: true },
    ],
    // Scatter: Anzahl -> [Vielfaches des Gesamteinsatzes, Freispiele]
    scatterPays: { 3: [2, 8], 4: [10, 12], 5: [50, 20] },
    freeSpinMult: 2,
    // Zeilenindex je Walze
    lines: [
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2],
      [0, 1, 2, 1, 0],
      [2, 1, 0, 1, 2],
      [0, 0, 1, 2, 2],
      [2, 2, 1, 0, 0],
      [1, 0, 0, 0, 1],
      [1, 2, 2, 2, 1],
      [1, 2, 1, 0, 1],
    ],
    lineColors: ['#ffd23f', '#3be8ff', '#ff3d8b', '#7dff8a', '#c77dff',
                 '#ff8a3d', '#3dffd0', '#ff5ec4', '#9ab8ff', '#fff27a'],
  },
  plinko: {
    bets: [10, 20, 50, 100, 250, 500],
    rows: [8, 12, 16],
    tables: {
      8:  { low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
            mid: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
            high:[29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
      12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
            mid: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
            high:[170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
      16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
            mid: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
            high:[1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] },
    },
  },
  wheel: {
    // Wert, Gewicht, Farbe
    segments: [
      { v: 250,  w: 18, c: '#ff3d8b' },
      { v: 500,  w: 14, c: '#3a1f78' },
      { v: 300,  w: 16, c: '#1fb6d6' },
      { v: 1000, w: 8,  c: '#ff3d8b' },
      { v: 400,  w: 15, c: '#3a1f78' },
      { v: 2500, w: 3,  c: '#e9a813' },
      { v: 250,  w: 18, c: '#1fb6d6' },
      { v: 750,  w: 10, c: '#ff3d8b' },
      { v: 300,  w: 16, c: '#3a1f78' },
      { v: 1500, w: 5,  c: '#1fb6d6' },
      { v: 500,  w: 14, c: '#ff3d8b' },
      { v: 10000, w: 1, c: '#e9a813' },
    ],
    cooldownMin: 10,
  },
  blackjack: {
    chips: [
      { v: 10,   c: '#2f7bff' },
      { v: 25,   c: '#1fbf6a' },
      { v: 100,  c: '#2a2238' },
      { v: 500,  c: '#9b3dff' },
      { v: 1000, c: '#f0a412' },
    ],
    decks: 6,
    maxBet: 5000,
  },
};
if (typeof module !== 'undefined') module.exports = CFG;

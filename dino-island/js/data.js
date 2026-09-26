'use strict';
/* ==========================================================
   Game data: species, buildings, decorations, missions, leagues
   ========================================================== */
const TW = 64, TH = 32;           // isometric tile size (world px)
const MAP = 48;                   // map is MAP x MAP tiles
const FEEDS_PER_LEVEL = 3;
const MAX_LEVEL = 40;
const STAGE_LEVELS = [10, 20, 30]; // evolve at these levels
const STAGE_NAMES = ['Stage I', 'Stage II', 'Stage III', 'Apex'];
const STORE_MINUTES = 30;          // income storage cap (minutes of income)

const RARITY = {
  bronze: { name: 'Bronze', food: 1, hp: 1, atk: 1 },
  silver: { name: 'Silver', food: 1.6, hp: 1.3, atk: 1.3 },
  gold: { name: 'Gold', food: 2.5, hp: 1.75, atk: 1.7 },
  legend: { name: 'Legendary', food: 3.4, hp: 2.3, atk: 2.2 },
};

const ATTACKS = { charge: 'Charge', bite: 'Bite', swipe: 'Swipe' };
// damage multiplier: [weakness][attack]
const DMG_TABLE = {
  swipe: { charge: 0.25, bite: 0.5, swipe: 1 },
  bite: { swipe: 0.25, charge: 0.5, bite: 1 },
  charge: { bite: 0.25, swipe: 0.5, charge: 1 },
};

/* palette: base, dark (dorsal), belly, pattern, accent, eye */
const P = (base, dark, belly, pattern, accent, eye = '#f2c230') => ({ base, dark, belly, pattern, accent, eye });

const SPECIES = {
  triceratops: {
    name: 'Triceratops', diet: 'herb', rarity: 'bronze', body: 'cera', size: 0.95, pad: 4, level: 1, cost: { coins: 2000 },
    hatch: 20, income: 30, weak: 'charge', hp: 340, atk: 58, era: 'Late Cretaceous · 68 mya', len: '9 m',
    fact: 'Three horns and a bony frill made this gentle grazer a tank that even big predators respected.',
    pals: [P('#8b7a52', '#5b4a2e', '#dccba0', '#4b3a22', '#c0643a'), P('#6f8a4a', '#445a2a', '#d8dca0', '#2f4020', '#e08a2a'), P('#5c7384', '#34485a', '#cfd8d8', '#223040', '#d8453a'), P('#3b3530', '#1e1a16', '#c8b490', '#e8b030', '#f0d040', '#ff6a2a')],
  },
  gallimimus: {
    name: 'Gallimimus', diet: 'herb', rarity: 'bronze', body: 'ornitho', size: 0.62, pad: 3, level: 2, cost: { coins: 3500 },
    hatch: 30, income: 38, weak: 'swipe', hp: 260, atk: 52, era: 'Late Cretaceous · 70 mya', len: '6 m',
    fact: 'An ostrich-like sprinter. Flocks of Gallimimus could outrun almost anything on the plains.',
    pals: [P('#a8845a', '#6e5234', '#efe0c0', '#5b3e22', '#d88a4a'), P('#8a9a5a', '#5a6a34', '#ecebc4', '#3e4a22', '#e0b040'), P('#b07a8a', '#704a5a', '#f2dce0', '#50303e', '#f0d060'), P('#40506a', '#202a40', '#d8e0ea', '#80e0ff', '#80e0ff', '#80f0ff')],
  },
  velociraptor: {
    name: 'Velociraptor', diet: 'carn', rarity: 'bronze', body: 'raptor', size: 0.55, pad: 3, level: 3, cost: { coins: 6000 },
    hatch: 40, income: 48, weak: 'bite', hp: 250, atk: 74, era: 'Late Cretaceous · 75 mya', len: '2 m',
    fact: 'Clever pack hunter with a sickle-shaped killing claw on each foot.',
    pals: [P('#b08a5a', '#6b4a28', '#ead8b4', '#4a2e14', '#8a4a20'), P('#6a7a5a', '#3a4a2e', '#d8dcc0', '#1e2a14', '#c86a2a'), P('#5a6a82', '#2e3a52', '#cad4e0', '#18202e', '#40a0e0'), P('#2a2a2e', '#141416', '#9a9aa0', '#d02a2a', '#ff3a3a', '#ff2a2a')],
  },
  parasaurolophus: {
    name: 'Parasaurolophus', diet: 'herb', rarity: 'bronze', body: 'hadro', size: 0.95, pad: 4, level: 4, cost: { coins: 9000 },
    hatch: 50, income: 55, weak: 'swipe', hp: 330, atk: 55, era: 'Late Cretaceous · 76 mya', len: '10 m',
    fact: 'Its long hollow crest worked like a trumpet – herds called to each other across the valleys.',
    pals: [P('#9a8a5a', '#6a5a34', '#e8dcb0', '#8a3a22', '#d0602a'), P('#5a8a6a', '#345a44', '#d0e4cc', '#1e3a2a', '#f0a030'), P('#8a6aa0', '#5a3a70', '#e8d8f0', '#3a2050', '#f0c040'), P('#a04a2a', '#602814', '#f0d0a0', '#2a1408', '#ffd040', '#40ff80')],
  },
  dilophosaurus: {
    name: 'Dilophosaurus', diet: 'carn', rarity: 'silver', body: 'dilo', size: 0.72, pad: 3, level: 5, cost: { coins: 14000 },
    hatch: 60, income: 70, weak: 'charge', hp: 290, atk: 82, era: 'Early Jurassic · 193 mya', len: '7 m',
    fact: 'Twin crests on its head made it one of the flashiest predators of the Early Jurassic.',
    pals: [P('#8a9a5a', '#56662e', '#e6e4b4', '#3a4418', '#e0602a'), P('#6a8aa0', '#3a5a74', '#dce8ee', '#1e3448', '#f0c030'), P('#a07a4a', '#6a4a24', '#f0dcb0', '#3a2410', '#d02a8a'), P('#1e3a2e', '#0e2018', '#8ab4a0', '#40ffb0', '#ff40a0', '#80ff40')],
  },
  stegosaurus: {
    name: 'Stegosaurus', diet: 'herb', rarity: 'silver', body: 'stego', size: 0.95, pad: 4, level: 6, cost: { coins: 20000 },
    hatch: 75, income: 85, weak: 'bite', hp: 420, atk: 62, era: 'Late Jurassic · 150 mya', len: '9 m',
    fact: 'Two rows of plates along the back and a spiked tail – the "thagomizer" – kept predators away.',
    pals: [P('#7a8a5a', '#4e5e34', '#dcdcb0', '#3a4422', '#c0503a'), P('#8a7a5a', '#5a4a30', '#ecdcb8', '#3a2c1a', '#e09030'), P('#5a7a8a', '#34505e', '#d0e0e4', '#1e3440', '#e04a8a'), P('#4a2a3a', '#2a1420', '#d8b0c0', '#ff8a30', '#ffb040', '#ffe040')],
  },
  pachycephalosaurus: {
    name: 'Pachycephalosaurus', diet: 'herb', rarity: 'bronze', body: 'pachy', size: 0.7, pad: 3, level: 7, cost: { coins: 26000 },
    hatch: 80, income: 92, weak: 'swipe', hp: 330, atk: 70, era: 'Late Cretaceous · 70 mya', len: '4.5 m',
    fact: 'A 25 cm thick skull dome – perfect for head-butting rivals.',
    pals: [P('#9a7a5a', '#6a4a30', '#ecd8b8', '#4a2e1a', '#c8a070'), P('#6a8a7a', '#3e5a4a', '#d8e8dc', '#223a2e', '#e0c080'), P('#8a5a4a', '#5a3024', '#f0d0c0', '#3a1810', '#40a0e0'), P('#2a3a5a', '#141e34', '#b0c0dc', '#ffd040', '#ffd040', '#ffb020')],
  },
  ankylosaurus: {
    name: 'Ankylosaurus', diet: 'herb', rarity: 'silver', body: 'anky', size: 0.9, pad: 4, level: 8, cost: { coins: 34000 },
    hatch: 90, income: 110, weak: 'bite', hp: 520, atk: 60, era: 'Late Cretaceous · 68 mya', len: '8 m',
    fact: 'A living tank covered in bony armor plates, swinging a heavy tail club.',
    pals: [P('#8a7a5a', '#5a4a34', '#d8c8a8', '#3a2e1e', '#b0a080'), P('#6a7a4a', '#44502e', '#d4d8b0', '#2a3018', '#c89040'), P('#7a5a4a', '#4e3428', '#e0c8b8', '#301c14', '#e0e0e0'), P('#2e3036', '#16181c', '#a8acb4', '#40c0ff', '#60d0ff', '#40e0ff')],
  },
  pteranodon: {
    name: 'Pteranodon', diet: 'carn', rarity: 'silver', body: 'ptero', size: 0.7, pad: 4, level: 9, cost: { coins: 42000 },
    hatch: 90, income: 120, weak: 'charge', hp: 300, atk: 84, era: 'Late Cretaceous · 86 mya', len: '7 m wingspan', aviary: true,
    fact: 'Not a dinosaur but a flying reptile. It soared over ancient seas catching fish.',
    pals: [P('#a08a6a', '#6a5a44', '#ecdcc4', '#4a3a2a', '#d05a2a'), P('#7a8a9a', '#4a5a6a', '#e0e8ee', '#2a3440', '#f0a030'), P('#9a6a5a', '#603a30', '#f0d8cc', '#3a1e18', '#40c0a0'), P('#3a2a4a', '#1e142a', '#c0b0d4', '#ff60c0', '#ff60c0', '#ffe040')],
  },
  carnotaurus: {
    name: 'Carnotaurus', diet: 'carn', rarity: 'silver', body: 'carno', size: 0.9, pad: 4, level: 10, cost: { coins: 48000 },
    hatch: 100, income: 140, weak: 'swipe', hp: 380, atk: 96, era: 'Late Cretaceous · 70 mya', len: '8 m',
    fact: 'The "meat-eating bull" had horns above its eyes and tiny arms – but legs built for speed.',
    pals: [P('#9a4a3a', '#5e2a20', '#e8c4a8', '#3a1810', '#e0a040'), P('#7a6a4a', '#4a3e28', '#e0d4b4', '#2a200e', '#d04020'), P('#4a5a6a', '#283440', '#c8d0d8', '#141c24', '#f06030'), P('#1a1414', '#0a0808', '#9a8070', '#ff4020', '#ff5020', '#ff2000')],
  },
  edmontosaurus: {
    name: 'Edmontosaurus', diet: 'herb', rarity: 'bronze', body: 'hadro', size: 1.0, pad: 4, level: 11, cost: { coins: 56000 }, crest: 'none',
    hatch: 110, income: 150, weak: 'charge', hp: 420, atk: 62, era: 'Late Cretaceous · 68 mya', len: '12 m',
    fact: 'A duck-billed giant with hundreds of grinding teeth for tough plants.',
    pals: [P('#8a8a6a', '#5a5a40', '#e0e0c8', '#3a3a24', '#a0703a'), P('#6a7a5a', '#44503a', '#d8dcc8', '#2a3020', '#e0a050'), P('#7a6a8a', '#4c405a', '#e0d8e8', '#2c2438', '#40c0e0'), P('#5a3020', '#341a10', '#e8c0a0', '#ffd060', '#ffd060', '#60ff90')],
  },
  brachiosaurus: {
    name: 'Brachiosaurus', diet: 'herb', rarity: 'gold', body: 'sauropod', size: 1.25, pad: 5, level: 12, cost: { coins: 80000 },
    hatch: 150, income: 200, weak: 'bite', hp: 700, atk: 72, era: 'Late Jurassic · 154 mya', len: '26 m',
    fact: 'A towering long-neck that could browse treetops 13 metres above the ground.',
    pals: [P('#7a8a8a', '#4e5c5c', '#d4dcd8', '#34403e', '#a0b0a0'), P('#8a8060', '#5a5238', '#e4dcc0', '#3a3422', '#c0a060'), P('#6a7a5a', '#40503a', '#d8e0c8', '#28321e', '#80c060'), P('#2a3a4a', '#141e28', '#a8bcc8', '#60e0ff', '#60e0ff', '#80ffff')],
  },
  baryonyx: {
    name: 'Baryonyx', diet: 'carn', rarity: 'silver', body: 'bary', size: 0.9, pad: 4, level: 13, cost: { coins: 90000 },
    hatch: 120, income: 210, weak: 'charge', hp: 400, atk: 100, era: 'Early Cretaceous · 125 mya', len: '9 m',
    fact: 'A fish-eater with a crocodile-like snout and huge thumb claws.',
    pals: [P('#6a7a6a', '#3e4e40', '#d4e0cc', '#26302a', '#c05030'), P('#8a6a4a', '#5a4028', '#ead4b4', '#3a2614', '#40a0c0'), P('#5a6a8a', '#303e5a', '#ccd6e8', '#1a2238', '#e0b040'), P('#203a3a', '#0e1e1e', '#90b8b0', '#40ffd0', '#40ffd0', '#e0ff40')],
  },
  allosaurus: {
    name: 'Allosaurus', diet: 'carn', rarity: 'silver', body: 'allo', size: 1.0, pad: 5, level: 14, cost: { coins: 120000 },
    hatch: 140, income: 250, weak: 'bite', hp: 450, atk: 108, era: 'Late Jurassic · 150 mya', len: '10 m',
    fact: 'The top predator of the Jurassic, recognizable by small horns in front of its eyes.',
    pals: [P('#9a7a5a', '#604628', '#ead6b8', '#402a14', '#d04a2a'), P('#7a5a4a', '#4c3226', '#e4ccbc', '#2c1a12', '#e09a2a'), P('#5a6a5a', '#343e34', '#ccd6c8', '#1c241c', '#e04040'), P('#3a1a2a', '#200c16', '#c8a0b0', '#ff5080', '#ff5080', '#ffd040')],
  },
  tyrannosaurus: {
    name: 'Tyrannosaurus', diet: 'carn', rarity: 'gold', body: 'rex', size: 1.2, pad: 5, level: 15, cost: { coins: 150000 },
    hatch: 180, income: 300, weak: 'swipe', hp: 620, atk: 125, era: 'Late Cretaceous · 67 mya', len: '12 m',
    fact: 'The tyrant lizard king. Its bite was the strongest of any land animal that ever lived.',
    pals: [P('#7a6a4e', '#4a3e2a', '#d8c8a8', '#2e2416', '#8a3a22'), P('#5a6a4a', '#34402a', '#d0d4b4', '#1e2616', '#c85a2a'), P('#6a5a6a', '#3e3240', '#dcd0dc', '#261e28', '#e04a3a'), P('#1e1a18', '#0c0a08', '#8a7a6a', '#ff6a20', '#ff6a20', '#ffcc00')],
  },
  giganotosaurus: {
    name: 'Giganotosaurus', diet: 'carn', rarity: 'gold', body: 'rex', size: 1.28, pad: 5, level: 16, cost: { bucks: 120 }, gig: true,
    hatch: 200, income: 340, weak: 'charge', hp: 660, atk: 132, era: 'Late Cretaceous · 97 mya', len: '13 m',
    fact: 'Even longer than T. rex – a giant hunter of South America with a narrow, blade-toothed skull.',
    pals: [P('#6a6a70', '#3e3e44', '#d0d0d4', '#1e1e24', '#a04030'), P('#7a6048', '#4a3624', '#e2ccb4', '#2a1a0e', '#e0a040'), P('#4a5a4a', '#283228', '#c4d0c4', '#141c14', '#d03030'), P('#2a2a3a', '#12121c', '#a0a0b8', '#b060ff', '#b060ff', '#ff3060')],
  },
  spinosaurus: {
    name: 'Spinosaurus', diet: 'carn', rarity: 'gold', body: 'spino', size: 1.25, pad: 5, level: 18, cost: { coins: 220000 },
    hatch: 220, income: 360, weak: 'bite', hp: 640, atk: 130, era: 'Mid Cretaceous · 97 mya', len: '15 m',
    fact: 'The largest meat-eating dinosaur known, with a sail on its back and a taste for giant fish.',
    pals: [P('#7a6a5a', '#4a3e34', '#e0d0bc', '#2e241a', '#c0402a'), P('#5a7a7a', '#344c4c', '#d0e0dc', '#1a2c2c', '#f08a2a'), P('#8a5a3a', '#583420', '#f0d0b0', '#381e10', '#e0d040'), P('#1a2a3a', '#0c1420', '#90a8c0', '#40a0ff', '#ff3a3a', '#40c0ff')],
  },
};
const SPECIES_ORDER = Object.keys(SPECIES);

/* ---------- buildings ---------- */
const BUILDINGS = {
  visitor_center: { name: 'Visitor Center', kind: 'center', size: [4, 4], level: 1, cost: { coins: 0 }, unique: true, income: 150, period: 180, xp: 0, noSell: true, desc: 'The heart of the park. Earns ticket money from arriving guests.' },
  gate: { name: 'Park Gate', kind: 'gate', size: [3, 1], level: 1, cost: { coins: 0 }, unique: true, noSell: true, desc: 'Guests arrive here. Connect it with roads so they can explore!' },
  lab: { name: 'Genetics Lab', kind: 'lab', size: [3, 3], level: 1, cost: { coins: 0 }, unique: true, noSell: true, desc: 'Decode amber into dinosaur DNA and research evolutions.' },
  crop_harbor: { name: 'Crop Harbor', kind: 'harbor', food: 'crops', size: [3, 3], level: 1, cost: { coins: 1500 }, unique: true, desc: 'Ships in fresh greens for your herbivores.' },
  meat_harbor: { name: 'Meat Harbor', kind: 'harbor', food: 'meat', size: [3, 3], level: 3, cost: { coins: 5000 }, unique: true, desc: 'Refrigerated cargo for your hungry carnivores.' },
  arena: { name: 'Battle Arena', kind: 'arena', size: [4, 4], level: 6, cost: { coins: 25000 }, unique: true, xp: 200, desc: 'Pit your dinosaurs against rival parks in the tournament.' },
  souvenir: { name: 'Souvenir Shop', kind: 'shop', size: [2, 2], level: 1, cost: { coins: 800 }, income: 60, period: 60, xp: 20, desc: 'Plush raptors and amber keychains.' },
  burger: { name: 'Burger Stand', kind: 'shop', size: [2, 2], level: 2, cost: { coins: 1800 }, income: 140, period: 120, xp: 30, desc: 'Home of the Mega-Rex Burger.' },
  icecream: { name: 'Ice Cream Kiosk', kind: 'shop', size: [2, 2], level: 3, cost: { coins: 3200 }, income: 110, period: 75, xp: 40, desc: 'Cool treats for the tropical heat.' },
  coffee: { name: 'Jungle Café', kind: 'shop', size: [2, 2], level: 5, cost: { coins: 6500 }, income: 320, period: 180, xp: 60, desc: 'Fresh island coffee and pastries.' },
  ranger: { name: 'Ranger Station', kind: 'shop', size: [2, 2], level: 4, cost: { coins: 4500 }, income: 180, period: 120, xp: 50, desc: 'Rangers clear jungle 25% faster.', perk: 'clear' },
  restaurant: { name: 'Fossil Grill', kind: 'shop', size: [3, 3], level: 7, cost: { coins: 14000 }, income: 700, period: 300, xp: 90, desc: 'Fine dining under a real dinosaur skeleton.' },
  tower: { name: 'Lookout Tower', kind: 'shop', size: [2, 2], level: 9, cost: { coins: 22000 }, income: 520, period: 240, xp: 110, desc: 'The best view over the island. Boosts park rating.' },
  jeep: { name: 'Jungle Tour', kind: 'shop', size: [3, 3], level: 10, cost: { coins: 30000 }, income: 1100, period: 420, xp: 140, desc: 'Sends tour jeeps around your roads.', perk: 'jeeps' },
  museum: { name: 'Fossil Museum', kind: 'shop', size: [3, 3], level: 12, cost: { coins: 48000 }, income: 1600, period: 540, xp: 180, desc: 'Real fossils dug up right here on the island.' },
  hotel: { name: 'Island Hotel', kind: 'shop', size: [3, 3], level: 14, cost: { coins: 75000 }, income: 2600, period: 720, xp: 240, desc: 'Guests stay overnight – more visitors every day.' },
  helipad: { name: 'Helipad', kind: 'shop', size: [3, 3], level: 16, cost: { coins: 110000 }, income: 3800, period: 900, xp: 300, desc: 'VIP guests fly in by helicopter.' },
};
const BUILD_ORDER = ['crop_harbor', 'meat_harbor', 'souvenir', 'burger', 'icecream', 'ranger', 'coffee', 'arena', 'restaurant', 'tower', 'jeep', 'museum', 'hotel', 'helipad'];

const DECOS = {
  palm: { name: 'Palm Tree', size: [1, 1], level: 1, cost: { coins: 150 }, bonus: 1, desc: '+1% income nearby.' },
  flowers: { name: 'Flower Bed', size: [1, 1], level: 1, cost: { coins: 220 }, bonus: 2, desc: '+2% income nearby.' },
  bench: { name: 'Bench', size: [1, 1], level: 2, cost: { coins: 260 }, bonus: 1, desc: '+1% income nearby.' },
  lamp: { name: 'Lamp Post', size: [1, 1], level: 2, cost: { coins: 320 }, bonus: 2, desc: '+2% income nearby. Lights up at night.', light: true },
  torch: { name: 'Tiki Torch', size: [1, 1], level: 3, cost: { coins: 380 }, bonus: 2, desc: '+2% income nearby. Burns at night.', light: true },
  fern: { name: 'Fern Garden', size: [1, 1], level: 3, cost: { coins: 450 }, bonus: 3, desc: '+3% income nearby.' },
  fossil: { name: 'Fossil Display', size: [1, 1], level: 5, cost: { coins: 1500 }, bonus: 4, desc: '+4% income nearby.' },
  raptor_statue: { name: 'Raptor Statue', size: [1, 1], level: 6, cost: { coins: 2500 }, bonus: 5, desc: '+5% income nearby.' },
  garden: { name: 'Tropical Garden', size: [2, 2], level: 4, cost: { coins: 1800 }, bonus: 5, desc: '+5% income nearby.' },
  fountain: { name: 'Fountain', size: [2, 2], level: 7, cost: { coins: 3500 }, bonus: 6, desc: '+6% income nearby.' },
  waterfall: { name: 'Waterfall Rocks', size: [2, 2], level: 9, cost: { coins: 6000 }, bonus: 8, desc: '+8% income nearby.' },
  skeleton: { name: 'Rex Skeleton', size: [2, 2], level: 11, cost: { coins: 9000 }, bonus: 10, desc: '+10% income nearby.' },
  amber_monument: { name: 'Amber Monument', size: [2, 2], level: 5, cost: { bucks: 25 }, bonus: 15, desc: '+15% income nearby. A premium landmark.', light: true },
};
const DECO_ORDER = Object.keys(DECOS);
const DECO_RADIUS = 3;

const HARBOR_ORDERS = [
  { name: 'Small Barge', time: 45, cost: 120, amount: 60 },
  { name: 'Cargo Boat', time: 300, cost: 500, amount: 330 },
  { name: 'Freighter', time: 1800, cost: 2400, amount: 2100 },
  { name: 'Supertanker', time: 7200, cost: 7500, amount: 8200 },
];
const MEAT_COST_MULT = 1.35;

const ROAD_COST = 20;
const CLEAR = {
  tree: { cost: 60, time: 6, xp: 5 },
  palm: { cost: 40, time: 4, xp: 4 },
  bush: { cost: 25, time: 3, xp: 3 },
  rock: { cost: 180, time: 12, xp: 10 },
  bigrock: { cost: 600, time: 25, xp: 25 },
};
const AMBER_CHANCE = 0.2;

function xpForLevel(L) { return Math.round(60 * Math.pow(L, 1.6) + 40 * L); }
function levelReward(L) { return { bucks: 2 + Math.floor(L / 3), coins: 250 * L }; }

/* ---------- characters (original) ---------- */
const CHARS = {
  vance: { name: 'Director Harriet Vance', role: 'Park Director', skin: '#e8b58e', hair: '#d8d4cc', outfit: '#2e4a6a', accent: '#f0c040', hat: 'none', glasses: true },
  quill: { name: 'Dr. Mara Quill', role: 'Chief Geneticist', skin: '#8a5a3a', hair: '#1a1210', outfit: '#f4f4f0', accent: '#4aa8e0', hat: 'none', coat: true },
  reyes: { name: 'Warden Tomás Reyes', role: 'Head Ranger', skin: '#c8905e', hair: '#2a1a10', outfit: '#6a7a3a', accent: '#c8a060', hat: 'safari', beard: true },
};

/* ---------- missions ---------- */
// goal types: collect_dino, feed, road, clear, build, deco, collect_food, dino_level, decode, buy_dino, hatch, evolve, collect_shop, battle_win, level, visitors, order_food, research
const MISSIONS = [
  { id: 'm1', who: 'vance', title: 'Welcome, Director!', text: 'Welcome to Dino Island! Our first resident, a young Triceratops, is already bringing in money. Tap the coins above her paddock to collect them.', goal: { type: 'collect_dino', count: 1 }, reward: { coins: 300, xp: 20 } },
  { id: 'm2', who: 'reyes', title: 'Hungry Trike', text: 'Our Triceratops is hungry! Tap her paddock and feed her crops three times. A fed dinosaur grows – and earns more.', goal: { type: 'feed', count: 3 }, reward: { coins: 400, xp: 30 } },
  { id: 'm3', who: 'reyes', title: 'Clear the Jungle', text: 'This island is overgrown! Tap trees next to the park and clear them. Keep your eyes open – sometimes we find AMBER in the soil.', goal: { type: 'clear', count: 3 }, reward: { coins: 300, xp: 30 } },
  { id: 'm4', who: 'vance', title: 'Souvenirs!', text: 'Guests love souvenirs. Open the Market and build a Souvenir Shop.', goal: { type: 'build', id: 'souvenir', count: 1 }, reward: { coins: 500, xp: 40 } },
  { id: 'm5', who: 'vance', title: 'Paths for Guests', text: 'Guests need paths! Use the Roads tool to build 6 road tiles that connect your buildings.', goal: { type: 'road', count: 6 }, reward: { coins: 300, xp: 30 } },
  { id: 'm6', who: 'reyes', title: 'Food Shipment', text: 'Our crop stock is running low. Tap the Crop Harbor, order a shipment and collect it when the boat arrives.', goal: { type: 'collect_food', count: 1 }, reward: { coins: 400, xp: 40 } },
  { id: 'm7', who: 'quill', title: 'Amber Science', text: 'Amber can contain mosquitoes with dinosaur DNA inside! Clear the jungle until you find a piece of amber, then decode it in the Genetics Lab.', goal: { type: 'decode', count: 1 }, reward: { coins: 600, xp: 60, bucks: 3 } },
  { id: 'm8', who: 'reyes', title: 'Grown-up Trike', text: 'Feed the Triceratops until she reaches level 5. She becomes an adult and earns a lot more.', goal: { type: 'dino_level', species: 'triceratops', level: 5, count: 1 }, reward: { coins: 1000, xp: 80 } },
  { id: 'm9', who: 'quill', title: 'A New Species', text: 'The DNA sequence is complete. Buy the new species in the Market and put its egg in a paddock.', goal: { type: 'buy_dino', count: 1 }, reward: { coins: 800, xp: 80 } },
  { id: 'm10', who: 'quill', title: 'It\'s Hatching!', text: 'Eggs need a little time. Wait for the egg to hatch – or speed it up with Dino Bucks.', goal: { type: 'hatch', count: 1 }, reward: { coins: 800, xp: 60, bucks: 2 } },
  { id: 'm11', who: 'vance', title: 'Snack Time', text: 'Our guests are starving! Build a Burger Stand.', goal: { type: 'build', id: 'burger', count: 1 }, reward: { coins: 900, xp: 60 } },
  { id: 'm12', who: 'vance', title: 'Beautify the Park', text: 'Decorations increase the income of everything around them. Place 3 decorations.', goal: { type: 'deco', count: 3 }, reward: { coins: 800, xp: 60 } },
  { id: 'm13', who: 'reyes', title: 'Meat Delivery', text: 'Carnivores need meat. Build the Meat Harbor once you reach level 3.', goal: { type: 'build', id: 'meat_harbor', count: 1 }, reward: { coins: 1200, xp: 80 } },
  { id: 'm14', who: 'quill', title: 'Raptor Squad', text: 'Our research shows Velociraptors are clever and very popular. Add one to the park!', goal: { type: 'buy_dino', species: 'velociraptor', count: 1 }, reward: { coins: 2000, xp: 120, bucks: 3 } },
  { id: 'm15', who: 'vance', title: 'Shopkeeper', text: 'Collect money from your shops 10 times.', goal: { type: 'collect_shop', count: 10 }, reward: { coins: 1500, xp: 100 } },
  { id: 'm16', who: 'reyes', title: 'Land Grab', text: 'We need space for bigger paddocks. Clear 15 more obstacles.', goal: { type: 'clear', count: 15 }, reward: { coins: 2000, xp: 150, bucks: 2 } },
  { id: 'm17', who: 'vance', title: 'Level 6', text: 'Reach player level 6 to unlock the Battle Arena.', goal: { type: 'level', level: 6, count: 1 }, reward: { coins: 2500, xp: 0, bucks: 5 } },
  { id: 'm18', who: 'reyes', title: 'Build the Arena', text: 'Rival parks are challenging us! Build the Battle Arena.', goal: { type: 'build', id: 'arena', count: 1 }, reward: { coins: 3000, xp: 200 } },
  { id: 'm19', who: 'reyes', title: 'First Victory', text: 'Pick your strongest dinosaurs and win a battle in the Arena. Hit their weakness: Charge, Bite or Swipe!', goal: { type: 'battle_win', count: 1 }, reward: { coins: 3500, xp: 250, bucks: 5 } },
  { id: 'm20', who: 'quill', title: 'Evolution', text: 'Get any dinosaur to level 10, research its evolution in the Lab and evolve it.', goal: { type: 'evolve', count: 1 }, reward: { coins: 5000, xp: 400, bucks: 8 } },
  { id: 'm21', who: 'vance', title: 'Crowd Pleaser', text: 'Grow the park to 40 visitors at the same time.', goal: { type: 'visitors', count: 40 }, reward: { coins: 6000, xp: 400, bucks: 5 } },
  { id: 'm22', who: 'quill', title: 'Long Neck', text: 'Decode and hatch the mighty Brachiosaurus.', goal: { type: 'hatch', species: 'brachiosaurus', count: 1 }, reward: { coins: 12000, xp: 800, bucks: 10 } },
  { id: 'm23', who: 'reyes', title: 'The King', text: 'Every great park needs a Tyrannosaurus. Make it happen.', goal: { type: 'hatch', species: 'tyrannosaurus', count: 1 }, reward: { coins: 25000, xp: 1500, bucks: 15 } },
  { id: 'm24', who: 'reyes', title: 'Champion', text: 'Win the Gold League tournament.', goal: { type: 'league', league: 'gold', count: 1 }, reward: { coins: 40000, xp: 2500, bucks: 20 } },
  { id: 'm25', who: 'vance', title: 'Legendary Park', text: 'Own 12 different species. You are a true park legend!', goal: { type: 'species', count: 12 }, reward: { coins: 80000, xp: 5000, bucks: 40 } },
];

/* ---------- arena leagues ---------- */
const LEAGUES = [
  { id: 'bronze', name: 'Bronze League', level: 6, fee: 500, lv: [2, 5], pool: ['triceratops', 'gallimimus', 'velociraptor', 'parasaurolophus', 'pachycephalosaurus'], reward: { coins: 3000, bucks: 3, xp: 150 } },
  { id: 'silver', name: 'Silver League', level: 9, fee: 2000, lv: [6, 12], pool: ['velociraptor', 'dilophosaurus', 'stegosaurus', 'pachycephalosaurus', 'ankylosaurus', 'parasaurolophus'], reward: { coins: 10000, bucks: 6, xp: 400 } },
  { id: 'gold', name: 'Gold League', level: 12, fee: 6000, lv: [12, 20], pool: ['dilophosaurus', 'stegosaurus', 'ankylosaurus', 'carnotaurus', 'pteranodon', 'baryonyx', 'edmontosaurus'], reward: { coins: 30000, bucks: 12, xp: 1000 } },
  { id: 'platinum', name: 'Platinum League', level: 15, fee: 15000, lv: [20, 30], pool: ['carnotaurus', 'baryonyx', 'allosaurus', 'brachiosaurus', 'ankylosaurus', 'tyrannosaurus'], reward: { coins: 80000, bucks: 25, xp: 2500 } },
  { id: 'allstar', name: 'All-Star League', level: 18, fee: 40000, lv: [30, 40], pool: ['tyrannosaurus', 'giganotosaurus', 'spinosaurus', 'allosaurus', 'brachiosaurus', 'carnotaurus'], reward: { coins: 200000, bucks: 50, xp: 6000 } },
];

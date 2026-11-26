// config.js — the game's numbers, in one place. The stage is
// 1280x800 logical pixels; the painted background plate is larger
// art that sprites.js scales into this space. Times are seconds
// unless a name ends in Ms.

export const VIEW = { width: 1280, height: 800 };

// Colours from the art direction: warm room, sticker inks, and the
// two feedback colours (cyan / magenta) reserved for the player.
export const PALETTE = {
  ink: '#2B1B2E',
  floor: '#2E1F3A',
  cloth: '#FFF4E0',
  clothGrid: '#FFE2B8',
  wood: '#C8814A',
  butter: '#FFC94A',
  cyan: '#3FE0FF',
  magenta: '#FF3FA4',
  skin: '#FFCFA8',
  soup: '#E8743B',
  creamA: '#FFD1DC',
  flyBody: '#3A3F6B',
};

// The room's logic geometry: the table rectangle (dash directions
// and "away from the table" math measure from its centre) and the
// chandelier's anchor point over the middle of the table.
export const ROOM = {
  table: { x: 290, y: 195, w: 700, h: 420 },
  lamp: { x: 640, y: 405, r: 70 },
};

// Fly movement and the dash ("flash").
export const FLY = {
  landSpeed: 60,          // slower than this, a landing can settle
  landTime: 0.2,          // ...held for this long
  flashDistance: 110,     // dash length
  flashDistanceRainbow: 126,
  flashCooldown: 0.9,
  flashCooldownFlame: 0.75,
  flashBuffer: 0.1,       // a press this early still fires
};

// When family members reach for new weapons, and the idle rules.
export const TAUNT = {
  idleAfter: 3,      // seconds unprovoked before an air slap
  idleWarnScale: 1.1,
  sprayAt: 30,       // Mom's bug spray
  swatterAt: 40,     // Grandpa's swatter
  doubleAt: 55,      // Dad's double slap, Timmy's poke, two at once
  doubleGap: 0.35,   // seconds between Dad's two slaps
};

// Dodge grades, best first. A dash started with at most
// maxRemainMs left on the warning earns the grade.
export const RATINGS = [
  { id: 'perfect', mult: 5, maxRemainMs: 70 },
  { id: 'close', mult: 3, maxRemainMs: 200 },
  { id: 'good', mult: 2, maxRemainMs: 500 },
  { id: 'early', mult: 1, maxRemainMs: Infinity },
];

export const FINALE_PERFECT_MS = 120; // the finale grades kinder
export const CHAIN_MAX_DEPTH = 5;

export const COMBO = {
  multPer: 0.1,
  multCap: 4.0,
  decayAfter: 4.0, // seconds without a Good+ dodge before decay
  decayStep: 0.8,  // then -1 per this many seconds
  tiers: [
    { at: 0, id: 'plain', label: '' },
    { at: 5, id: 'gold', label: 'GOLDEN FLY!' },
    { at: 10, id: 'flame', label: 'ON FIRE!' },
    { at: 20, id: 'rainbow', label: 'RAINBOW FLY!!' },
  ],
};

// Chain events: chaos is the score value of the event, cooldown
// how long before the same trigger can fire it again.
export const EVENTS = {
  soup: { chaos: 300, cooldown: 8 },
  head: { chaos: 250, cooldown: 5 },
  cutlery: { chaos: 200, cooldown: 4 },
  lamp: { chaos: 400, cooldown: 999 },
  dentures: { chaos: 500, cooldown: 999 },
  dog: { chaos: 450, cooldown: 0 },
  cup: { chaos: 150, cooldown: 6 },
  food: { chaos: 200, cooldown: 6 },
  candle: { chaos: 150, cooldown: 3 },
  times: [20, 32, 44, 56, 68],
  pool: [
    { id: 'dog', weight: 25 },
    { id: 'blackout', weight: 20 },
    { id: 'doorbell', weight: 20 },
    { id: 'sneeze', weight: 15 },
    { id: 'photo', weight: 20 },
  ],
};

// The random-event draw: one pick at each of these marks, weighted.
export const RANDOM_EVENTS = {
  times: [20, 32, 44, 56, 68],
  pool: [
    { id: 'dog', weight: 25 },
    { id: 'blackout', weight: 20 },
    { id: 'doorbell', weight: 20 },
    { id: 'sneeze', weight: 15 },
    { id: 'photo', weight: 20 },
  ],
};

export const PHASES = {
  finaleAt: 80,
  finaleTriggerBy: 89, // not on the cake by now? They do it themselves
};

export const GAME = {
  duration: 90,
  hp: 3,
  lifeBonus: 3000,       // per heart left when the round ends
  destructionFull: 6000, // chaos points for a 100% ruined party
  restockAt: 55,         // Mom brings seconds, once
  finaleBase: 2000,
  finaleComboCap: 2.0,   // the finale's combo multiplier tops out here
  finaleSplatScore: 500, // caught in the finale: the cake still pops
  ranks: [
    { id: 'S', min: 35000, stamp: 'TOTAL DISASTER' },
    { id: 'A', min: 22000, stamp: 'CERTIFIED CHAOS' },
    { id: 'B', min: 12000, stamp: 'MILDLY RUINED' },
    { id: 'C', min: 0, stamp: 'JUST A FLY' },
  ],
  // PARTY RUINED pays out as it fills: flat, never multiplied.
  ruinMilestones: [
    { at: 0.25, bonus: 500 },
    { at: 0.5, bonus: 1000 },
    { at: 0.75, bonus: 2000 },
    { at: 1.0, bonus: 4000 },
  ],
};

// The v3 layer: bets, crumbs and early-round mercy.
export const V3 = {
  betMax: 3,          // bet levels: x1.5, x2.0, x2.5 at 0.5 a level
  betMultPer: 0.5,
  betWarnCut: 0.25,   // each level eats this share of the time left
  chainHealDepth: 3,  // a chain this deep refunds a heart
  closeEarlyMs: 300,  // wider Close window while mercy lasts
  mercyUntil: 15,     // seconds of gentler rules at the start
  mercyScoreKeep: 0.5, // a mercy splat only costs this much score
  crumbScore: 20,
  crumbRadius: 26,
  crumbLife: 6,
  crumbPerLayer: [2, 4],
  crumbCooldownCut: 0.15,
  crumbDecayBonus: 0.5,
  crumbGraceCap: 2,
};

// The expression machine's clocks and thresholds.
export const MOOD = {
  suspiciousAt: 0.25,   // destruction share: default face sours
  steamFrom: 55,        // seconds in: default face turns angry
  terrifiedFrom: 80,    // the finale window: everyone is scared
  annoyDecayEvery: 10,  // seconds per point of annoyance forgiven
  gloatTime: 1.2,
  popTime: 0.25,
  shockTime: 0.9,
  slapStretchTime: 0.4, // the slapped face springs back over this
};

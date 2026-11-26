// config.js — every tunable number of "One Fly Ruins a Birthday
// Party", transcribed from the final design spec (Quick Claude,
// v1.0). The spec's numbers are written for a 960x540 stage; this
// build keeps its established 1280x800 stage, so spatial values are
// the spec's intent at this stage's scale, while every timing,
// window, multiplier and threshold is the spec's, verbatim.

export const VIEW = {
  width: 1280,
  height: 800,
};

export const ROOM = {
  table: { x: 240, y: 172, w: 800, h: 478, r: 40 },
  lamp: { x: 640, y: 96 },
};

export const PALETTE = {
  ink: '#2B1B2E', // every outline, every text stroke
  floor: '#2E1F3A', // dark plum, outside the table
  cloth: '#FFF4E0', // cream tablecloth
  clothGrid: '#FFE2B8', // the check on the cloth
  wood: '#C8814A', // caramel wood: table rim, chairs
  tomato: '#FF5A4E', // birthday red, warning ring
  mint: '#5FD3B5', // greens, Good
  butter: '#FFC94A', // candle flames, gold fly, score
  cyan: '#3FE0FF', // wings, Close!, flash afterimages
  magenta: '#FF3FA4', // PERFECT, CHAIN, combo
  soup: '#E8743B',
  creamA: '#FFD1DC',
  creamB: '#FFFFFF',
  skin: '#FFCFA8',
  skinShade: '#E9A47C',
};

export const FLY = {
  radius: 13, // drawn body; hit radius is 10 (spec 2.1)
  hitRadius: 10,
  // Mouse-spring flight (spec 3.1): an underdamped spring chases the
  // cursor, so the fly overshoots a little and feels alive.
  springK: 42,
  springDamp: 9.5,
  maxSpeed: 540,
  // The flash (spec 3.2).
  flashDistance: 110,
  flashDistanceRainbow: 126,
  flashDuration: 0.12,
  flashIframes: 0.18,
  flashCooldown: 0.9,
  flashCooldownFlame: 0.75,
  flashBuffer: 0.1, // input buffering window, seconds
  landSpeed: 60, // below this, inside a zone, the landing clock runs
  landTime: 0.2, // sustained, and the fly has landed (spec 3.3)
};

export const TAUNT = {
  // Impact and warning geometry (spec 2.1/2.2): the ring shrinks
  // from 90 to the impact radius; the palm lands on the spot locked
  // in when the warning started.
  impactRadius: 56,
  ringStart: 110,
  palmRecover: 0.85,
  // Taunt delay and warning length over the run (spec 2.2 table),
  // linearly interpolated between breakpoints — never stepped.
  timeline: [
    { at: 0, tauntDelay: 0.4, warn: 1.4, ownerCooldown: 2.5 },
    { at: 10, tauntDelay: 0.35, warn: 1.2, ownerCooldown: 2.2 },
    { at: 30, tauntDelay: 0.3, warn: 1.05, ownerCooldown: 1.9 },
    { at: 55, tauntDelay: 0.2, warn: 0.9, ownerCooldown: 1.5 },
    { at: 80, tauntDelay: 0.2, warn: 0.9, ownerCooldown: 1.5 },
  ],
  // Idle punishment (spec 2.2): 3s without a taunt and the nearest
  // free human slaps at the airborne fly, warning x1.1.
  idleAfter: 3.0,
  idleWarnScale: 1.1,
  // Weapon modifiers (spec 2.7).
  sprayAt: 30, // Mom's bug spray: fan, warn x0.9, mist lingers 1.5s
  sprayRange: 300,
  sprayHalfAngle: 0.52, // 60 degrees total
  sprayMistTime: 1.5,
  swatterAt: 40, // Grandpa's swatter: radius 38->47, warn x0.75
  swatterRadius: 47,
  swatterWarnScale: 0.75,
  doubleAt: 55, // Dad's newspaper: two slaps, 0.35s apart
  doubleGap: 0.35,
  pokeAt: 55, // Timmy's party-hat charge: a line, not a circle
  maxConcurrent: 2, // simultaneous slaps from 55s (spec 2.10)
  concurrentFrom: 55,
};

// Ratings by the milliseconds remaining until impact at the moment
// the fly leaves the impact radius (spec 2.3). Absolute windows, so
// the feel never drifts with T_warn.
export const RATINGS = [
  { id: 'perfect', label: 'PERFECT!!', maxRemainMs: 70, mult: 5, bonus: 50 },
  { id: 'close', label: 'Close!', maxRemainMs: 200, mult: 3, bonus: 0 },
  { id: 'good', label: 'Good', maxRemainMs: 500, mult: 2, bonus: 0 },
  { id: 'early', label: 'Early', maxRemainMs: Infinity, mult: 1, bonus: 0 },
];
export const PERFECT_GRACE_MS = 16; // one invisible frame of grace
export const FINALE_PERFECT_MS = 120; // the finale widens the window

export const COMBO = {
  decayAfter: 4.0, // seconds without a Good+ dodge before decay
  decayStep: 0.8, // then -1 per this
  multPer: 0.1, // M_combo = 1 + 0.1 x combo
  multCap: 4.0,
  tiers: [
    { at: 0, id: 'plain', label: '' },
    { at: 5, id: 'gold', label: 'GOLDEN FLY!' },
    { at: 10, id: 'flame', label: 'ON FIRE!' },
    { at: 20, id: 'rainbow', label: 'RAINBOW FLY!!' },
  ],
};

// Chain events (spec 2.5): chaos points per event; an event at depth
// d scores chaos x (1 + 0.5 x (d-1)) x M_combo. Cooldowns per object.
export const EVENTS = {
  soup: { chaos: 300, cooldown: 8 },
  head: { chaos: 250, cooldown: 5 },
  cutlery: { chaos: 200, cooldown: 4 },
  lamp: { chaos: 400, cooldown: Infinity }, // once per run
  dentures: { chaos: 500, cooldown: Infinity }, // once per run
  dog: { chaos: 450, cooldown: 0 },
  cup: { chaos: 150, cooldown: 6 },
  food: { chaos: 200, cooldown: 6 }, // greens / chicken fly onto a head
  candle: { chaos: 150, cooldown: 3 }, // one candle out, pre-finale
};

// Random events (spec 2.8): drawn at 20/32/44/56/68s.
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
  weaponsAt: 30,
  songAt: 55,
  finaleAt: 80,
  finaleTriggerBy: 89, // untriggered by then, the family does it
};

export const GAME = {
  duration: 90,
  hp: 3,
  hitInvuln: 1.2, // seconds of blink-invulnerability after a hit
  lifeBonus: 1000, // per remaining life, added at the end (spec 2.6)
  destructionFull: 6000, // chaos points for 100% party destruction
  finaleBase: 3000, // x rating mult x M_combo (spec 2.9)
  finaleSplatScore: 500, // if the fly is caught in the finale
  ranks: [
    { id: 'S', min: 28000, stamp: 'TOTAL DISASTER' },
    { id: 'A', min: 16000, stamp: 'CERTIFIED CHAOS' },
    { id: 'B', min: 8000, stamp: 'MILDLY RUINED' },
    { id: 'C', min: 0, stamp: 'JUST A FLY' },
  ],
};

// The dishes are props — smashable scenery with taunt zones (spec
// 3.3 lists shapes and priorities; table.js lays them out).
export const FOODS = [
  { id: 'greens', name: 'Garlic Greens', color: '#58a34c', dark: '#3c7434' },
  { id: 'soup', name: 'Tomato Egg Soup', color: '#e2703a', dark: '#b34f24' },
  { id: 'cake', name: 'Birthday Cake', color: '#f2b8c6', dark: '#cf7f97' },
  { id: 'chicken', name: 'Roast Chicken', color: '#b5722f', dark: '#8a5423' },
];

export const HUMANS = {
  count: 4,
};

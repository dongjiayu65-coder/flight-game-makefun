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

// The room geometry is measured off the painted background —
// since the v4 pass that is the layers19 background plate 董
// split out of the F1 scene painting (empty table, four chairs,
// the warm light baked in). The cloth rectangle and the chairs
// in the painting are where the game agrees they are. BG
// transform in sprites.js: scale 1280/1536, vertical centre;
// the numbers below are that transform applied to measurements
// taken on the 1536x1024 plate (tools/measure-bg.py).
export const ROOM = {
  // Cloth bbox on the plate: x 247..1285, y 238..867.
  table: { x: 206, y: 172, w: 865, h: 524, r: 40 },
  // The plate's glow centres on the cloth at plate (771,536),
  // which sits behind Mom's chair — so the code-drawn fixture
  // keeps its F1b offset, hanging just right of her head, clear
  // of it by the same margin as before.
  lamp: { x: 700, y: 88 },
  // Head centres on the painting's chairs: Mom north, Grandpa
  // west, Timmy east, Dad south (the order table.js seats them).
  // Each is its chair's centre pulled toward the table: Mom
  // plate (744,155), Grandpa (182,498), Timmy (1354,498), Dad
  // (761,932) — Dad now sits centred on his chair (in the F1b
  // framing he floated ~125px right of it). v5: Dad pulled a
  // further 34px toward the table centre — at 750 the painted
  // head + shoulders (drawn 15% up since v5) ran off the bottom
  // of the 800px stage, and the old bottom-centre RUINED meter
  // sat on his face; 716 keeps all of him in frame, leaning
  // over the cloth like the painting's south seat does.
  seats: [
    { x: 620, y: 103 },
    { x: 152, y: 388 },
    { x: 1128, y: 388 },
    { x: 634, y: 716 },
  ],
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
  // P1-1 (scale pass): the spec's speeds and distances are written
  // for 960x540; the stage is 1280x800 and the impact/ring radii were
  // already scaled x1.33, so the fly's own speeds now follow suit —
  // otherwise it is relatively slower and its flash shorter than spec.
  maxSpeed: 720, // spec 540 x 1.333
  // The flash (spec 3.2).
  flashDistance: 146, // spec 110 x 1.333
  flashDistanceRainbow: 168, // spec 126 x 1.333
  flashDuration: 0.12,
  flashIframes: 0.18,
  flashCooldown: 0.9,
  flashCooldownFlame: 0.75,
  flashBuffer: 0.1, // input buffering window, seconds
  landSpeed: 80, // spec 60 x 1.333 — below this, inside a zone, the landing clock runs
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
export const PERFECT_GRACE_MS = 16; // one invisible frame of grace, AFTER impact only
export const CHAIN_MAX_DEPTH = 5; // P1-3: spec 2.5, deepest chain layer that may fire
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
  lifeBonus: 3000, // per remaining life, added at the end (v7 #6: was 1000)
  destructionFull: 6000, // chaos points for 100% party destruction
  // v7 #4: one-off bonuses as PARTY RUINED crosses each mark (flat,
  // not combo-multiplied).
  ruinMilestones: [
    { at: 0.25, bonus: 500 },
    { at: 0.5, bonus: 1000 },
    { at: 0.75, bonus: 2000 },
    { at: 1.0, bonus: 4000 },
  ],
  restockAt: 55, // v7 #5: Mom brings seconds — every wrecked dish/prop returns once
  finaleBase: 2000, // x rating mult x min(M_combo, cap) (v7 #2: was 3000)
  finaleComboCap: 2.0, // v7 #2: the finale's combo multiplier tops out at x2
  finaleSplatScore: 500, // if the fly is caught in the finale
  ranks: [
    // v7 #3: calibrated on the 6-run bot sample (median ~8.4k, all
    // C; the bot skips crumbs, bets and aiming). The bot is the floor:
    // its best runs sit within 20% of B, so the results card says
    // "Only N pts from B". A human who survives and lands a Close
    // finale (~12k) reaches B/A; S needs a PERFECT finale (20k) plus
    // a strong run. Re-check against real human runs if any exist.
    { id: 'S', min: 35000, stamp: 'TOTAL DISASTER' },
    { id: 'A', min: 22000, stamp: 'CERTIFIED CHAOS' },
    { id: 'B', min: 12000, stamp: 'MILDLY RUINED' },
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

// Expression system (design list P1). Durations in seconds.
export const MOOD = {
  annoyDecayEvery: 10, // P1-4: annoyCount -1 per 10s without a new offence
  shockTime: 1.5, // splashed / dish smashed in front of you
  gloatTime: 1.5, // the nearest bystander laughs at the victim
  slapStretchTime: 0.4, // slapped: 1.3x wide, springing back to 1.0
  popTime: 0.12, // every frame change: a 1.15x squash-bounce
  steamFrom: 55, // default face becomes angry + steam
  terrifiedFrom: 80, // the finale: everybody is terrified
  suspiciousAt: 0.25, // destruction: default face caps at suspicious
};

// --- v3 gameplay pass (flight-v3-plan.md, 2026-11-26) ----------------
// P0-1: the palm no longer lands where the taunt started — during
// the warning the shadow TRACKS the fly at a capped speed, so the
// wait becomes "walk the hand onto something expensive, then bail".
// The point locks 350ms before impact (ring goes solid, a "clack").
// P0-2: the first 30 seconds forgive HP (combo and 10% of the score
// are the price instead), and a CHAIN x3+ buys a heart back.
// P1-2: every chain layer sprays crumbs; flying through one extends
// the combo's decay deadline, shaves the flash cooldown, +20 pts.
// P1-4: while landed, each left click raises the bet: +0.5 rating
// multiplier per level, and the live warnings shrink by 10%.
export const V3 = {
  trackSpeed: 140, // px/s the warning shadow chases the fly
  trackSpeedLate: 180, // from 55s (the围攻 phase)
  trackFrom: 55,
  lockMs: 350, // impact point locks this long before the slap
  mercyUntil: 30, // seconds: hits cost combo + 10% score, not HP
  mercyScoreKeep: 0.9,
  closeEarlyMs: 260, // the Close window while the mercy lasts
  chainHealDepth: 3, // a chain this deep refunds one heart
  crumbPerLayer: [3, 5], // crumbs sprayed per chain layer (min, max)
  crumbLife: 4, // seconds a crumb waits to be harvested
  crumbRadius: 37, // fly pickup distance (spec 28 x 1.333)
  crumbScore: 20,
  crumbDecayBonus: 0.5, // seconds added to the combo decay deadline
  crumbCooldownCut: 0.1, // seconds shaved off the flash cooldown
  crumbGraceCap: 3, // max seconds of banked decay grace
  betMax: 3,
  betMultPer: 0.5, // rating multiplier per bet level
  betWarnCut: 0.1, // each bet eats 10% of the remaining warning
  timmyOffset: 15, // px: Timmy's locked point jumps by up to this
  grandpaPauseAt: 0.6, // Grandpa's ring stalls at this progress…
  grandpaPause: 0.25, // …for this many seconds, hands shaking
};

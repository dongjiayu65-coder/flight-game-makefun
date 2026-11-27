// table.js — the room's contents: four dishes, the dressing
// props, the family in their seats, and the landing zones the fly
// settles on. Zones are built once and handed out by identity, so
// "am I still on the same target?" is a === question.

import { ROOM } from './config.js';
import { makeHuman } from './humans.js';
import { makeRng } from './random.js';

const HEAD_R = 48; // landing-logic radius of a face zone

// Seats, in the order the rest of the game expects:
// Mom, Grandpa, Timmy, Dad.
const SEATS = [
  { id: 'mom', name: 'Mom', x: 620, y: 103, look: { clothes: '#B565D8', skin: '#FFCFA8', hairColor: '#4A2C1A' } },
  { id: 'grandpa', name: 'Grandpa', x: 152, y: 388, look: { clothes: '#8A9A5B', skin: '#F2C9A0', hairColor: '#E8E4DA' } },
  { id: 'timmy', name: 'Timmy', x: 1128, y: 388, look: { clothes: '#FFC94A', skin: '#FFD9B0', hairColor: '#6B4226' } },
  { id: 'dad', name: 'Dad', x: 634, y: 716, look: { clothes: '#4C7BD9', skin: '#FFCFA8', hairColor: '#2B2B30' } },
];

// Dishes in their fixed order: greens, soup, cake, chicken.
// Anchors sit on the plates in the painted background; each
// round nudges them a little (x ±13, y ±8), like the reference
// build does.
const FOOD_DEFS = [
  { id: 'greens', name: 'Garlic Greens', x: 435, y: 453, r: 46 },
  { id: 'soup', name: 'Tomato Egg Soup', x: 657, y: 341, r: 42 },
  { id: 'cake', name: 'Birthday Cake', x: 861, y: 466, r: 54 },
  { id: 'chicken', name: 'Roast Chicken', x: 641, y: 596, r: 52 },
];

// Loose cutlery and cups are scattered fresh each round: 3-7
// pieces, cups / forks / knives only, anywhere on the cloth.
const DRESSING_KINDS = [
  { kind: 'cup', name: 'Drink Cup' },
  { kind: 'fork', name: 'Fork' },
  { kind: 'knife', name: 'Knife' },
];

// Small deterministic generator for layout scatter, seeded per
// round so a seed always deals the same table.
function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeItem(def, kind) {
  const item = {
    id: def.id,
    name: def.name,
    kind,
    x: def.x,
    y: def.y,
    r: def.r,
    state: 'fresh',
    stateT: 0,
    creamSplats: 0,
  };
  if (def.id === 'cake') {
    // Eight candles on a ring; the renderer scales the offsets
    // onto the painting, so these are in cake-local units.
    item.candlesLit = 8;
    item.candles = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      item.candles.push({ dx: Math.cos(a) * 20, dy: Math.sin(a) * 14 });
    }
  }
  return item;
}

export class Table {
  constructor(seed) {
    this.rng = makeRng(seed * 13 + 5);
    const rand = mulberry(seed * 31 + 7);
    this.rect = { ...ROOM.table };
    this.lamp = { ...ROOM.lamp };
    this.lampDropped = false;
    this.lampSwingT = 0;
    this.foods = FOOD_DEFS.map((d) => makeItem({
      ...d,
      x: d.x + (rand() * 2 - 1) * 13,
      y: d.y + (rand() * 2 - 1) * 8,
    }, 'food'));
    // Scatter the dressing: 3-7 pieces at loose spots on the
    // cloth, kept clear of the dishes.
    this.dressing = [];
    const count = 3 + Math.floor(rand() * 5);
    const seen = {};
    for (let i = 0; i < count; i++) {
      const kd = DRESSING_KINDS[Math.floor(rand() * DRESSING_KINDS.length)];
      seen[kd.kind] = (seen[kd.kind] || 0) + 1;
      let x = this.rect.x + 62;
      let y = this.rect.y + 62;
      for (let tries = 0; tries < 10; tries++) {
        x = this.rect.x + 62 + rand() * (this.rect.w - 124);
        y = this.rect.y + 62 + rand() * (this.rect.h - 124);
        if (this.foods.every((f) => Math.hypot(x - f.x, y - f.y) > 58)) break;
      }
      const item = makeItem({
        id: seen[kd.kind] === 1 ? kd.kind : `${kd.kind}${seen[kd.kind]}`,
        name: kd.name,
        x,
        y,
        r: 14 + rand() * 11,
      }, 'dressing');
      item.zoneKind = kd.kind;
      item.rot = rand() * Math.PI * 2;
      this.dressing.push(item);
    }
    this.humans = SEATS.map((s) => makeHuman({
      ...s,
      headR: HEAD_R,
      speedScale: 0.87 + rand() * 0.35, // each person's own tempo
    }));

    // Landing zones in priority order: the cake, the faces, the
    // soup, the other dishes, then the small props.
    const zoneOf = (ref, kind, r) => ({ kind, ref, x: ref.x, y: ref.y, r });
    const byId = (arr, id) => arr.find((it) => it.id === id);
    this.zones = [
      zoneOf(byId(this.foods, 'cake'), 'cake', byId(this.foods, 'cake').r),
      ...this.humans.map((h) => zoneOf(h, 'head', h.headR)),
      zoneOf(byId(this.foods, 'soup'), 'soup', byId(this.foods, 'soup').r),
      zoneOf(byId(this.foods, 'greens'), 'greens', byId(this.foods, 'greens').r),
      zoneOf(byId(this.foods, 'chicken'), 'chicken', byId(this.foods, 'chicken').r),
      ...this.dressing.map((d) => zoneOf(d, d.zoneKind, d.r)),
    ];
  }

  // The zone under a point, or null. Smashed items stop offering
  // themselves; faces always do.
  propAt(x, y) {
    for (const z of this.zones) {
      if (z.kind !== 'head' && z.ref.state !== 'fresh') continue;
      if (Math.hypot(x - z.x, y - z.y) <= z.r) return z;
    }
    return null;
  }
}

// table.js — the room's contents: four dishes, the dressing
// props, the family in their seats, and the landing zones the fly
// settles on. Zones are built once and handed out by identity, so
// "am I still on the same target?" is a === question.

import { ROOM } from './config.js';
import { makeHuman } from './humans.js';
import { makeRng } from './random.js';

const HEAD_R = 63; // drawn head radius (already the x1.15 size)

// Seats, in the order the rest of the game expects:
// Mom, Grandpa, Timmy, Dad.
const SEATS = [
  { id: 'mom', name: 'Mom', x: 620, y: 103, look: { clothes: '#B565D8', skin: '#FFCFA8', hairColor: '#4A2C1A' } },
  { id: 'grandpa', name: 'Grandpa', x: 152, y: 388, look: { clothes: '#8A9A5B', skin: '#F2C9A0', hairColor: '#E8E4DA' } },
  { id: 'timmy', name: 'Timmy', x: 1128, y: 388, look: { clothes: '#FFC94A', skin: '#FFD9B0', hairColor: '#6B4226' } },
  { id: 'dad', name: 'Dad', x: 634, y: 716, look: { clothes: '#4C7BD9', skin: '#FFCFA8', hairColor: '#2B2B30' } },
];

// Dishes in their fixed order: greens, soup, cake, chicken.
const FOOD_DEFS = [
  { id: 'greens', name: 'Garlic Greens', x: 430, y: 330, r: 36 },
  { id: 'soup', name: 'Tomato Egg Soup', x: 600, y: 215, r: 30 },
  { id: 'cake', name: 'Birthday Cake', x: 760, y: 430, r: 52 },
  { id: 'chicken', name: 'Roast Chicken', x: 830, y: 300, r: 40 },
];

const DRESSING_DEFS = [
  { id: 'cup', name: 'Drink Cup', x: 520, y: 480, r: 24 },
  { id: 'fork', name: 'Fork', x: 680, y: 520, r: 26 },
  { id: 'knife', name: 'Knife', x: 350, y: 470, r: 26 },
  { id: 'plate', name: 'Plate', x: 600, y: 560, r: 30 },
];

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
    this.rect = { ...ROOM.table };
    this.lamp = { ...ROOM.lamp };
    this.lampDropped = false;
    this.lampSwingT = 0;
    this.foods = FOOD_DEFS.map((d) => makeItem(d, 'food'));
    this.dressing = DRESSING_DEFS.map((d) => makeItem(d, 'dressing'));
    this.humans = SEATS.map((s) => makeHuman({ ...s, headR: HEAD_R }));

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
      zoneOf(byId(this.dressing, 'plate'), 'plate', byId(this.dressing, 'plate').r),
      zoneOf(byId(this.dressing, 'cup'), 'cup', byId(this.dressing, 'cup').r),
      zoneOf(byId(this.dressing, 'fork'), 'fork', byId(this.dressing, 'fork').r),
      zoneOf(byId(this.dressing, 'knife'), 'knife', byId(this.dressing, 'knife').r),
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

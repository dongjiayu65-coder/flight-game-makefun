// table.js — the dinner scene laid out once per run: the four
// dishes, the dressing (all of it tauntable, smashable scenery), and
// the four family members seated at the edges — Mom north, Grandpa
// west, Timmy the birthday boy east, Dad south. Positions come from
// the run's seed, so a screenshot pose and a played run agree.

import { ROOM, FOODS, HUMANS } from './config.js';
import { makeRng } from './random.js';

export class Table {
  constructor(seed) {
    const rng = makeRng(seed);
    const t = ROOM.table;
    this.rect = t;

    // The four dishes: greens west, soup centre-north, cake east,
    // the roast chicken south-centre (the dog has plans for it).
    const spots = [
      { x: t.x + t.w * 0.26, y: t.y + t.h * 0.54 },
      { x: t.x + t.w * 0.52, y: t.y + t.h * 0.32 },
      { x: t.x + t.w * 0.76, y: t.y + t.h * 0.56 },
      { x: t.x + t.w * 0.5, y: t.y + t.h * 0.8 },
    ];
    const radii = [46, 42, 54, 52];
    this.foods = FOODS.map((f, i) => ({
      ...f,
      x: spots[i].x + (rng() - 0.5) * 30,
      y: spots[i].y + (rng() - 0.5) * 24,
      r: radii[i],
      state: 'fresh', // cake: 'smashed' only in the finale
      stateT: 0,
      candlesLit: i === 2 ? 8 : 0, // the cake's eight candles
      creamSplats: 0, // pre-finale cake damage, purely cosmetic
    }));
    // Per-dish garnish, rolled once from the same seeded stream so
    // the renderer draws every leaf and strawberry in the same
    // place on every frame.
    for (const f of this.foods) {
      const inDish = (rad) => {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * rad;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.92 };
      };
      if (f.id === 'greens') {
        f.leaves = Array.from({ length: 26 }, () => ({ ...inDish(f.r * 0.78), rot: rng() * Math.PI, s: 0.75 + rng() * 0.6, tone: rng() }));
        f.garlic = Array.from({ length: 7 }, () => ({ ...inDish(f.r * 0.7), rot: rng() * Math.PI }));
        f.chili = Array.from({ length: 5 }, () => inDish(f.r * 0.72));
      } else if (f.id === 'soup') {
        f.tomatoes = Array.from({ length: 7 }, () => ({ ...inDish(f.r * 0.68), r: 5 + rng() * 3.6 }));
        f.eggRibbons = Array.from({ length: 5 }, () => ({ ...inDish(f.r * 0.66), rot: rng() * Math.PI, s: 0.8 + rng() * 0.7 }));
        f.scallions = Array.from({ length: 11 }, () => inDish(f.r * 0.8));
      } else if (f.id === 'cake') {
        f.strawberries = Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2 + rng() * 0.5;
          return { dx: Math.cos(a) * f.r * 0.52, dy: Math.sin(a) * f.r * 0.48, rot: rng() * Math.PI };
        });
        f.blueberries = Array.from({ length: 6 }, () => inDish(f.r * 0.62));
        f.sprinkles = Array.from({ length: 16 }, () => ({ ...inDish(f.r * 0.8), rot: rng() * Math.PI, tone: rng() }));
        // Eight candles in a ring (spec 1.3).
        f.candles = Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return { dx: Math.cos(a) * f.r * 0.62, dy: Math.sin(a) * f.r * 0.56, hue: i % 3 };
        });
      }
    }

    // Dressing: rice bowls, tea things, cutlery — a lived-in table.
    this.dressing = [];
    const kinds = ['rice', 'teacup', 'cup', 'plate', 'fork', 'knife', 'sticks', 'sauce', 'napkin', 'teacup', 'fork', 'plate'];
    for (let i = 0; i < kinds.length; i++) {
      this.dressing.push({
        kind: kinds[i],
        x: t.x + 60 + rng() * (t.w - 120),
        y: t.y + 50 + rng() * (t.h - 100),
        r: 13 + rng() * 12,
        rot: rng() * Math.PI,
        state: 'fresh',
        stateT: 0,
      });
    }
    this.dressing.push({ kind: 'teapot', x: t.x + t.w * 0.32 + (rng() - 0.5) * 60, y: t.y + 54 + rng() * 18, r: 21, rot: 0, state: 'fresh', stateT: 0 });
    // Keep dressing out of the dishes' plates.
    this.dressing = this.dressing.filter(
      (d) => !this.foods.some((f) => Math.hypot(d.x - f.x, d.y - f.y) < f.r + d.r + 10),
    );

    // The family (spec 1.4). Big sticker heads at the table edges.
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const seats = [
      { x: cx - 200, y: t.y - 66, name: 'Mom', look: { hair: 'bun', hairColor: '#4a2c1a', skin: '#FFCFA8', clothes: '#B565D8', earrings: true, blush: true, glasses: false, moustache: false, hat: false, dentures: false } },
      { x: t.x - 66, y: cy + 60, name: 'Grandpa', look: { hair: 'bald', hairColor: '#e8e4da', skin: '#FFCFA8', clothes: '#8A9A5B', earrings: false, blush: false, glasses: false, moustache: false, hat: false, dentures: true } },
      { x: t.x + t.w + 66, y: cy - 40, name: 'Timmy', look: { hair: 'kid', hairColor: '#3a2a1c', skin: '#FFD9B0', clothes: '#FFC94A', earrings: false, blush: true, glasses: false, moustache: false, hat: true, dentures: false, gapTooth: true } },
      { x: cx + 190, y: t.y + t.h + 66, name: 'Dad', look: { hair: 'short', hairColor: '#26221f', skin: '#FFCFA8', clothes: '#4C7BD9', earrings: false, blush: false, glasses: true, moustache: true, hat: false, dentures: false } },
    ];
    this.humans = seats.slice(0, HUMANS.count).map((s, i) => ({
      ...s,
      home: Math.atan2(cy - s.y, cx - s.x),
      phase: rng() * Math.PI * 2,
      speedScale: 0.85 + rng() * 0.4,
      blinkOffset: rng() * 4,
      gaze: 0,
      headR: 48, // the taunt zone (spec 3.3)
      // Living state.
      expression: 'happy', // happy|suspicious|angry|scared|slapped
      exprT: 0,
      cooldownT: 0, // personal slap cooldown (spec 2.2)
      blockedT: 0, // cannot slap at all (standing in soup, posing…)
      angryT: 0,
      stateT: 0,
      // Accumulated ruin (the results photo reads these).
      soupFace: false,
      palmPrint: false,
      glassesOff: false,
      denturesOut: false,
      hatKind: null, // 'greens' | 'chicken' — food worn as a hat
    }));
    this.lamp = ROOM.lamp;
    this.lampSwingT = 0; // the chandelier, once knocked (E4)
    this.lampDropped = false;
  }

  // What tauntable thing is under a point, by the spec's priority
  // order (3.3): cake, heads, (dog — the game checks it first),
  // soup, the other dishes, cups, cutlery. Smashed things stop
  // answering; the cake always answers (candles, then the finale).
  propAt(x, y) {
    const cake = this.foods[2];
    if (cake.state !== 'smashed' && Math.hypot(x - cake.x, y - cake.y) < 58) {
      return { kind: 'cake', ref: cake, x: cake.x, y: cake.y, r: cake.r };
    }
    for (const h of this.humans) {
      if (Math.hypot(x - h.x, y - h.y) < h.headR) return { kind: 'head', ref: h, x: h.x, y: h.y, r: h.headR };
    }
    const soup = this.foods[1];
    if (soup.state === 'fresh' && Math.hypot(x - soup.x, y - soup.y) < 42) {
      return { kind: 'soup', ref: soup, x: soup.x, y: soup.y, r: soup.r };
    }
    for (const f of [this.foods[0], this.foods[3]]) {
      if (f.state !== 'fresh') continue;
      const dx = (x - f.x) / (f.r + 6);
      const dy = (y - f.y) / (f.r * 0.82 + 6);
      if (dx * dx + dy * dy < 1) return { kind: f.id, ref: f, x: f.x, y: f.y, r: f.r };
    }
    for (const d of this.dressing) {
      if (d.state !== 'fresh') continue;
      if ((d.kind === 'cup' || d.kind === 'teacup') && Math.hypot(x - d.x, y - d.y) < 26) {
        return { kind: d.kind, ref: d, x: d.x, y: d.y, r: d.r };
      }
    }
    for (const d of this.dressing) {
      if (d.state !== 'fresh') continue;
      if (d.kind === 'fork' || d.kind === 'knife') {
        // A capsule: distance to the cutlery's spine segment.
        const ex = d.x + Math.cos(d.rot) * 30;
        const ey = d.y + Math.sin(d.rot) * 30;
        const bx = d.x - Math.cos(d.rot) * 30;
        const by = d.y - Math.sin(d.rot) * 30;
        const abx = ex - bx;
        const aby = ey - by;
        const tt = Math.max(0, Math.min(1, ((x - bx) * abx + (y - by) * aby) / (abx * abx + aby * aby)));
        if (Math.hypot(x - (bx + abx * tt), y - (by + aby * tt)) < 18) {
          return { kind: d.kind, ref: d, x: d.x, y: d.y, r: d.r };
        }
      }
    }
    for (const d of this.dressing) {
      if (d.state !== 'fresh') continue;
      if (d.kind !== 'cup' && d.kind !== 'teacup' && d.kind !== 'fork' && d.kind !== 'knife' &&
          Math.hypot(x - d.x, y - d.y) < d.r + 8) {
        return { kind: d.kind, ref: d, x: d.x, y: d.y, r: d.r };
      }
    }
    return null;
  }
}

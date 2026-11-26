// table.js — the dinner scene laid out once per run: where the three
// dishes of the objective chain sit on the table, the side plates and
// cups that dress it, and the four humans seated around the edge with
// the directions their gazes call home. Positions come from the run's
// seed, so a screenshot pose and a played run agree on the same table.

import { ROOM, FOODS, HUMANS } from './config.js';
import { makeRng } from './random.js';

export class Table {
  constructor(seed) {
    const rng = makeRng(seed);
    const t = ROOM.table;
    this.rect = t;

    // The three target dishes: spread across the table so the route
    // crosses open cloth — greens west, soup centre-north, cake east.
    const spots = [
      { x: t.x + t.w * 0.26, y: t.y + t.h * 0.56 },
      { x: t.x + t.w * 0.52, y: t.y + t.h * 0.34 },
      { x: t.x + t.w * 0.76, y: t.y + t.h * 0.6 },
    ];
    this.foods = FOODS.map((f, i) => ({
      ...f,
      x: spots[i].x + (rng() - 0.5) * 36,
      y: spots[i].y + (rng() - 0.5) * 30,
      r: i === 1 ? 52 : 46, // the soup bowl is the wide one
      eaten: false,
      dwellProgress: 0,
    }));

    // Dressing: side plates, cups, chopsticks — pure scenery, drawn
    // under everything, placed by the same seeded stream.
    this.dressing = [];
    for (let i = 0; i < 9; i++) {
      this.dressing.push({
        kind: ['plate', 'cup', 'bowl', 'sticks'][Math.floor(rng() * 4)],
        x: t.x + 60 + rng() * (t.w - 120),
        y: t.y + 50 + rng() * (t.h - 100),
        r: 14 + rng() * 16,
        rot: rng() * Math.PI,
      });
    }
    // Keep dressing out of the target dishes' plates.
    this.dressing = this.dressing.filter(
      (d) => !this.foods.some((f) => Math.hypot(d.x - f.x, d.y - f.y) < f.r + d.r + 8),
    );

    // Four humans: north, east, south, west seats. Each has a home
    // gaze direction (toward the table centre) the sweep swings around,
    // and a phase so they never move in step.
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const seats = [
      { x: cx - 190, y: t.y - 62, name: '妈妈' },
      { x: t.x + t.w + 62, y: cy - 60, name: '爸爸' },
      { x: cx + 170, y: t.y + t.h + 62, name: '奶奶' },
      { x: t.x - 62, y: cy + 80, name: '哥哥' },
    ];
    this.humans = seats.slice(0, HUMANS.count).map((s, i) => ({
      ...s,
      home: Math.atan2(cy - s.y, cx - s.x),
      phase: rng() * Math.PI * 2,
      speedScale: 0.85 + rng() * 0.4,
      gaze: 0, // filled each frame by humans.js
    }));
    this.window = ROOM.window;
  }

  foodAt(x, y) {
    return this.foods.find((f) => Math.hypot(x - f.x, y - f.y) < f.r) ?? null;
  }

  nextTarget() {
    return this.foods.find((f) => !f.eaten) ?? null;
  }
}

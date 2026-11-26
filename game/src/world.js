// world.js — the valley itself: a heightfield terrain with a river
// down its middle, the ring course strung along it, and one runway at
// the end of every mission. Everything is a pure function of the
// mission seed, so the renderer, the flight model and the screenshot
// poses all agree on exactly the same ground.

import { WORLD, COURSE } from './config.js';
import { makeNoise1d, fbm1d, makeRng, cellHash } from './random.js';

export class World {
  constructor(mission) {
    this.mission = mission;
    this.length = mission.length;
    // Two independent noise fields: one shapes the valley cross-section
    // over distance, the other raises the ridges on either side.
    this.centreNoise = makeNoise1d(mission.seed * 3 + 11);
    this.ridgeNoise = makeNoise1d(mission.seed * 7 + 101);
    this.detailNoise = makeNoise1d(mission.seed * 13 + 777);
    this.buildCourse();
  }

  // The valley centre line wanders gently as you fly north (+Z).
  centreX(z) {
    return fbm1d(this.centreNoise, z * 0.00016, 3) * 420;
  }

  // The river hugs the valley floor, meandering inside the centre line.
  riverX(z) {
    return this.centreX(z) + fbm1d(this.detailNoise, z * 0.00045, 2) * 130;
  }

  // Ground height at any point. The valley floor is broad and low; the
  // walls rise steeply past it, higher and rougher with |x|.
  height(x, z) {
    const dx = x - this.centreX(z);
    const adx = Math.abs(dx);
    const floor =
      WORLD.baseHeight +
      fbm1d(this.detailNoise, z * 0.0011, 3) * 14 +
      Math.sin(z * 0.00021 + this.mission.seed) * 9;
    // Valley walls: a smoothstep wall starting 260 m from the centre.
    const wallT = Math.max(0, (adx - 260) / 640);
    const wall = wallT * wallT * (3 - 2 * wallT);
    const ridge =
      340 +
      fbm1d(this.ridgeNoise, z * 0.00035 + (dx > 0 ? 40 : 0), 4) * 210 +
      fbm1d(this.detailNoise, (x + z) * 0.002, 2) * 36;
    let h = floor + wall * ridge;
    // The runway apron flattens the ground near the strip (see below).
    const strip = this.runway;
    const dz = z - strip.z;
    if (Math.abs(dz) < 700) {
      const dxr = x - strip.x;
      const flat = strip.groundY;
      const blendZ = Math.max(0, 1 - Math.abs(dz) / 700);
      const blendX = Math.max(0, 1 - Math.abs(dxr) / 320);
      const b = Math.min(blendZ, blendX);
      h = h * (1 - b) + flat * b;
    }
    return h;
  }

  // Is this point over the river? The river is a band around riverX on
  // the valley floor; the renderer colours it and the flight model
  // treats a ditching there as a crash like any other ground contact.
  overRiver(x, z) {
    return Math.abs(x - this.riverX(z)) < 34 && this.height(x, z) < WORLD.baseHeight + 26;
  }

  buildCourse() {
    const m = this.mission;
    // Runway first: height() needs it to flatten the apron.
    const stripX = this.centreX(m.length + 500);
    this.runway = {
      x: stripX,
      z: m.length + 500, // threshold (near end) of the strip
      length: 620,
      width: 30,
      heading: 0, // the strip runs along +Z, like the valley
      groundY: 0, // filled in below, from the un-flattened floor height
    };
    // Measure the floor height at the strip before the apron blend
    // exists: temporarily disable the blend by pointing z far away.
    const probe = { ...this.runway, z: -1e7 };
    const saved = this.runway;
    this.runway = probe;
    this.runway.groundY = this.height(stripX, m.length + 500);
    this.runway = saved;
    this.runway.groundY = probe.groundY;

    // Rings: strung from the first ring to just before the runway,
    // wandering across the valley and up and down its walls' skirts.
    const rng = makeRng(m.seed * 31 + 5);
    this.rings = [];
    const span = m.length - COURSE.firstRing - 1400;
    for (let i = 0; i < m.rings; i++) {
      const z = COURSE.firstRing + (span * (i + 0.5)) / m.rings + (rng() - 0.5) * 500;
      const x = this.centreX(z) + (rng() - 0.5) * 2 * COURSE.ringWander;
      const ground = this.height(x, z);
      const y = ground + 55 + rng() * 85;
      this.rings.push({ x, y, z, r: COURSE.ringRadius, passed: false, missed: false });
    }
  }

  // Trees and rocks are placed per terrain cell by hash, so the
  // renderer can ask for the scenery near the camera without the world
  // storing a list. Returns entries {x, z, y, size, kind} for one cell.
  sceneryInCell(cx, cz, out) {
    const cell = 120;
    const x0 = cx * cell;
    const z0 = cz * cell;
    const h1 = cellHash(cx, cz);
    if (h1 < 0.45) return out; // a little under half the cells grow trees
    const n = 1 + Math.floor(h1 * 3.4);
    for (let i = 0; i < n; i++) {
      const hx = cellHash(cx * 3 + i * 17, cz * 5 + 1);
      const hz = cellHash(cx * 7 + 2, cz * 3 + i * 13);
      const x = x0 + hx * cell;
      const z = z0 + hz * cell;
      const y = this.height(x, z);
      // Nothing grows on the river, the runway, or the high rock.
      if (this.overRiver(x, z)) continue;
      if (Math.abs(z - this.runway.z - this.runway.length / 2) < 420 && Math.abs(x - this.runway.x) < 190) continue;
      if (y > WORLD.baseHeight + 300) continue;
      out.push({ x, z, y, size: 7 + hx * 8, kind: hz > 0.86 ? 'rock' : 'pine' });
    }
    return out;
  }
}

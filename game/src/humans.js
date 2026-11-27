// humans.js — the family as data, plus the Director: the part
// that turns "someone is annoyed" into a warning ring on the
// table. People here are plain state (main.js runs the expression
// machine over them); the Director owns attack timing, tracking,
// locking, weapon shapes and the leftover spray mist.

import { TAUNT } from './config.js';

// One family member's worth of state. Timers count down in
// seconds; expression is whichever face the machine last chose.
export function makeHuman(seat) {
  return {
    id: seat.id,
    name: seat.name,
    x: seat.x,
    y: seat.y,
    headR: seat.headR,
    speedScale: seat.speedScale ?? 1, // personal tempo, scales warn time
    look: seat.look, // { clothes, skin, hairColor }
    expression: 'happy',
    shownExpr: 'happy',
    shockExpr: null,
    exprT: 0,
    angryT: 0,
    annoyCount: 0,
    annoyDecayT: 0,
    shockT: 0,
    gloatT: 0,
    popT: 0,
    slapT: 0,
    blockedT: 0,   // cannot slap (standing in soup, posing, ...)
    cooldownT: 0,  // personal time-out between slaps
    aiming: false,
    soupFace: false,
    palmPrint: false,
    hatKind: null, // food stuck on the head: 'greens' | 'chicken'
    glassesOff: false,
    denturesOut: false,
    steam: false,
    stateT: 0,
  };
}

// Attack pacing over the round: [fromSecond, tauntDelay, warn,
// cooldown], blended linearly between rows so nothing jumps.
// The 80-second round compresses the marks by 8/9 and the tempo
// columns run x0.91 (attacks ~10% more often) — except the warn
// in the first two rows: tutorial slaps are timed off row 0, and
// the opening seconds keep their gentler 1.4s ring.
const PACE_ROWS = [
  [0, 0.36, 1.4, 2.28],
  [9, 0.36, 1.4, 2.28],
  [27, 0.32, 1.09, 2.0],
  [49, 0.27, 0.96, 1.73],
  [71, 0.18, 0.82, 1.37],
];

export function timingAt(t) {
  let a = PACE_ROWS[0];
  let b = PACE_ROWS[PACE_ROWS.length - 1];
  for (let i = 0; i < PACE_ROWS.length - 1; i++) {
    if (t >= PACE_ROWS[i][0] && t <= PACE_ROWS[i + 1][0]) {
      a = PACE_ROWS[i];
      b = PACE_ROWS[i + 1];
      break;
    }
  }
  if (t >= b[0]) a = b;
  const span = Math.max(0.0001, b[0] - a[0]);
  const f = Math.min(1, Math.max(0, (t - a[0]) / span));
  return {
    tauntDelay: a[1] + (b[1] - a[1]) * f,
    warn: a[2] + (b[2] - a[2]) * f,
    cooldown: a[3] + (b[3] - a[3]) * f,
  };
}

// How far a warning ring has closed, 0 -> 1: a plain ratio of
// the attack's own clock, which runs in real time.
export function warnProgress(atk) {
  if (!atk || !(atk.dur > 0)) return 1;
  return Math.min(1, Math.max(0, atk.t / atk.dur));
}

export function grandpaStalled(atk) {
  return atk.personality === 'grandpa' && atk.state === 'warning' && atk.stalled === true;
}

export class Director {
  constructor(table, rng) {
    this.table = table;
    this.rng = rng;
    this.attacks = [];
    this.mist = null; // { x, y, dir, t } leftover bug spray
    this.nearMisses = 0;
    this.nextId = 1;
  }

  // Is there room for another live warning right now? One at a
  // time early, two once everyone is on their feet.
  freeSlot(elapsed) {
    const cap = elapsed >= TAUNT.doubleAt ? 2 : 1;
    const live = this.attacks.filter((a) => a.state === 'warning' && !a.decor).length;
    return live < cap;
  }

  nearestHuman(x, y, free = false) {
    let best = null;
    let bestD = Infinity;
    for (const h of this.table.humans) {
      if (free && (h.cooldownT > 0 || h.blockedT > 0)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  // Start a warning. opts: { target, finale, idle, warnScale,
  // noWeapon }. The caller has already waited out the taunt delay.
  startAttack(owner, x, y, elapsed, opts = {}) {
    if (!owner) return null;
    const timing = timingAt(elapsed);
    let warn = timing.warn;
    let kind = 'palm';
    let swatter = false;
    let secondPending = false;
    let radius = 56;
    let warnFrom = 110;
    if (!opts.noWeapon && !opts.finale) {
      if (owner.id === 'mom' && elapsed >= TAUNT.sprayAt) {
        kind = 'spray';
        warn *= 0.9;
        radius = 230; // the fan's reach
        warnFrom = 170;
      } else if (owner.id === 'grandpa' && elapsed >= TAUNT.swatterAt) {
        swatter = true;
        warn *= 0.75;
        radius = 38;
      } else if (owner.id === 'dad' && elapsed >= TAUNT.doubleAt) {
        secondPending = true;
      } else if (owner.id === 'timmy' && elapsed >= TAUNT.doubleAt) {
        kind = 'poke';
      }
    }
    if (opts.finale) {
      warn = 1.5;
      radius = 56;
      warnFrom = 130;
    }
    if (opts.idle) warn *= opts.warnScale ?? 1;
    if (!opts.finale) warn *= owner.speedScale || 1;
    owner.cooldownT = Math.max(0, timing.cooldown - (swatter ? 0.4 : 0));
    const atk = {
      id: this.nextId++,
      owner,
      target: opts.target ?? null,
      x,
      y,
      fromX: owner.x,
      fromY: owner.y,
      dir: Math.atan2(y - owner.y, x - owner.x),
      kind,
      swatter,
      personality: owner.id,
      state: 'warning',
      t: 0,
      trackT: 0,
      dur: warn,
      remainMs: warn * 1000,
      locked: false,
      justLocked: false,
      stalled: false,
      finale: !!opts.finale,
      idle: !!opts.idle,
      decor: false,
      tutorial: null,
      secondPending,
      pairId: null,
      radius,
      warnFrom,
      // Fields the game annotates while grading a dodge.
      exitByFlash: false,
      exited: false,
      graced: false,
      wasInside: false,
      skidded: false,
      flashRemainMs: null,
      finaleCombo: null,
      finaleRatingId: null,
      finaleRatingMult: null,
      slamT: 0,
    };
    this.attacks.push(atk);
    return atk;
  }

  // Dad's newspaper comes down twice: the follow-up is a fresh,
  // already-locked warning on the same spot, half a beat later.
  spawnSecondSlap(first) {
    const atk = {
      ...first,
      id: this.nextId++,
      state: 'warning',
      t: 0,
      dur: TAUNT.doubleGap,
      remainMs: TAUNT.doubleGap * 1000,
      locked: true,
      justLocked: false,
      secondPending: false,
      pairId: first.pairId ?? first.id,
      radius: 52,
      exitByFlash: false,
      exited: false,
      graced: false,
      wasInside: false,
      skidded: false,
      flashRemainMs: null,
      finaleCombo: null,
      finaleRatingId: null,
      finaleRatingMult: null,
      slamT: 0,
    };
    if (first.pairId == null) first.pairId = first.id;
    this.attacks.push(atk);
    return atk;
  }

  // Advance every attack. Returns the attacks whose slap landed
  // during this step (each exactly once, on the transition).
  update(dt, fly) {
    // State clocks for everything on the table live here, since
    // this update runs every frame of the round.
    for (const it of [...this.table.foods, ...this.table.dressing]) it.stateT += dt;
    for (const h of this.table.humans) h.stateT += dt;

    if (this.mist) {
      this.mist.t -= dt;
      if (this.mist.t <= 0) this.mist = null;
    }

    const impacts = [];
    for (const atk of this.attacks) atk.justLocked = false;
    for (const atk of [...this.attacks]) {
      if (atk.state === 'warning') {
        // The slap point does not glide after the fly: it sits
        // where the fly was, then re-aims in discrete snaps —
        // every quarter second while the ring closes, and once
        // more, finally, at the lock moment. Tutorial slaps are
        // scripted — their point never moves and never locks.
        atk.stalled = false;
        atk.t += dt;
        atk.remainMs = Math.max(0, (atk.dur - atk.t) * 1000);
        if (!atk.locked && !atk.tutorial && fly) {
          atk.trackT += dt;
          if (atk.trackT >= 0.25) {
            atk.trackT = 0;
            atk.x = fly.x;
            atk.y = fly.y;
            atk.dir = Math.atan2(atk.y - atk.fromY, atk.x - atk.fromX);
          }
        }
        const lockFrac = atk.kind === 'poke' ? 0.85 : 0.68;
        if (!atk.locked && !atk.tutorial && atk.t >= atk.dur * lockFrac) {
          atk.locked = true;
          atk.justLocked = true;
          if (fly) {
            atk.x = fly.x;
            atk.y = fly.y;
            atk.dir = Math.atan2(atk.y - atk.fromY, atk.x - atk.fromX);
          }
        }
        if (atk.t >= atk.dur) {
          atk.state = 'slam';
          atk.slamT = 0.12;
          atk.remainMs = 0;
          impacts.push(atk);
          if (atk.kind === 'spray') {
            this.mist = { x: atk.x, y: atk.y, dir: atk.dir, t: 1.5 };
          }
          if (atk.secondPending) this.spawnSecondSlap(atk);
        }
      } else if (atk.state === 'slam') {
        atk.slamT -= dt;
        if (atk.slamT <= 0) atk.state = 'done';
      }
    }
    if (this.attacks.some((a) => a.state === 'done')) {
      this.attacks = this.attacks.filter((a) => a.state !== 'done');
    }
    return impacts;
  }

  // Is a point inside this spray attack's fan right now?
  fanHolds(atk, fx, fy) {
    const dx = fx - atk.fromX;
    const dy = fy - atk.fromY;
    const dist = Math.hypot(dx, dy);
    if (dist > atk.radius) return false;
    if (dist < 30) return true;
    let diff = Math.atan2(dy, dx) - atk.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) <= 0.52; // a 60-degree cone
  }

  // Is a point standing in leftover spray mist?
  mistHolds(x, y) {
    const m = this.mist;
    if (!m) return false;
    if (Math.hypot(x - m.x, y - m.y) < 34) return true;
    for (let i = 1; i <= 3; i++) {
      const cx = m.x + Math.cos(m.dir) * i * 55;
      const cy = m.y + Math.sin(m.dir) * i * 55;
      if (Math.hypot(x - cx, y - cy) < 16 + i * 9 + 14) return true;
    }
    return false;
  }
}

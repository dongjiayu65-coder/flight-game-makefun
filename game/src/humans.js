// humans.js — the family as a director: four people, their personal
// slap cooldowns, and the attacks they launch — palms (Dad's comes
// twice after 55s), Mom's bug-spray fan, Timmy's party-hat charge,
// Grandpa's faster, smaller swatter. From 55s the family can keep
// two attacks in the air at once. The palm is the player's weapon:
// it lands where the taunt locked it, and whatever is underneath
// pays for the fly's timing.

import { TAUNT, V3 } from './config.js';

// Interpolate the spec's timing table (2.2): taunt delay, warning
// length and personal cooldown all glide, never step.
export function timingAt(elapsed) {
  const tl = TAUNT.timeline;
  if (elapsed <= tl[0].at) return tl[0];
  for (let i = 1; i < tl.length; i++) {
    if (elapsed <= tl[i].at) {
      const a = tl[i - 1];
      const b = tl[i];
      const k = (elapsed - a.at) / (b.at - a.at);
      return {
        tauntDelay: a.tauntDelay + (b.tauntDelay - a.tauntDelay) * k,
        warn: a.warn + (b.warn - a.warn) * k,
        ownerCooldown: a.ownerCooldown + (b.ownerCooldown - a.ownerCooldown) * k,
      };
    }
  }
  return tl[tl.length - 1];
}

// How far the warning ring has visually shrunk, per the owner's
// rhythm personality (v3 P1-3). The impact still lands at t = dur —
// personalities bend the *reading* of the ring, never the clock, so
// the rating windows stay honest. Dad is the metronome everyone
// learns on; Grandpa stalls at 60% with shaking hands; Mom dawdles
// then rushes the last 300ms.
export function warnProgress(atk) {
  const u = Math.min(1, atk.t / atk.dur);
  if (atk.kind !== 'palm') return u;
  if (atk.personality === 'grandpa') {
    const h = Math.min(0.2, V3.grandpaPause / atk.dur);
    if (u <= V3.grandpaPauseAt) return u;
    if (u <= V3.grandpaPauseAt + h) return V3.grandpaPauseAt;
    const rest = 1 - V3.grandpaPauseAt - h;
    return V3.grandpaPauseAt + ((u - V3.grandpaPauseAt - h) / rest) * (1 - V3.grandpaPauseAt);
  }
  if (atk.personality === 'mom') {
    const u0 = Math.max(0.3, 1 - 0.3 / atk.dur);
    if (u < u0) return 0.75 * u;
    return 0.75 * u0 + ((u - u0) / (1 - u0)) * (1 - 0.75 * u0);
  }
  return u;
}

// Is Grandpa's ring currently in its shaking stall? (render hook)
export function grandpaStalled(atk) {
  if (atk.personality !== 'grandpa' || atk.kind !== 'palm') return false;
  const u = atk.t / atk.dur;
  const h = Math.min(0.2, V3.grandpaPause / atk.dur);
  return u > V3.grandpaPauseAt && u <= V3.grandpaPauseAt + h;
}

let ATTACK_ID = 1;

export class Director {
  constructor(table, rng = Math.random) {
    this.table = table;
    this.rng = rng;
    this.time = 0;
    this.attacks = []; // palm | spray | poke slots
    this.mist = null; // Mom's lingering spray cloud {x, y, dir, t}
    this.nearMisses = 0; // Close/PERFECT dodges, for the results card
  }

  maxConcurrent(elapsed) {
    return elapsed >= TAUNT.concurrentFrom ? TAUNT.maxConcurrent : 1;
  }

  freeSlot(elapsed) {
    return this.attacks.filter((a) => a.state === 'warning' || a.state === 'slam').length < this.maxConcurrent(elapsed);
  }

  nearestHuman(x, y, freeOnly = false, elapsed = 0) {
    let best = null;
    let bd = Infinity;
    for (const h of this.table.humans) {
      if (freeOnly && (h.cooldownT > 0 || h.blockedT > 0)) continue;
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  // Launch an attack for a locked taunt. kind: 'palm' | 'spray' |
  // 'poke'. Weapon rules (spec 2.7) shape the slot here.
  startAttack(owner, x, y, elapsed, opts = {}) {
    const timing = timingAt(elapsed);
    let kind = 'palm';
    if (opts.kind) kind = opts.kind;
    else if (elapsed >= TAUNT.sprayAt && owner.name === 'Mom' && !opts.noWeapon) kind = 'spray';
    else if (elapsed >= TAUNT.pokeAt && owner.name === 'Timmy' && !opts.noWeapon) kind = 'poke';
    const atk = {
      id: ATTACK_ID++,
      kind,
      state: 'warning',
      t: 0,
      x, y,
      owner,
      target: opts.target ?? null,
      finale: !!opts.finale,
      idle: !!opts.idle, // an idle-punishment air slap (no chain)
      radius: TAUNT.impactRadius,
      dur: timing.warn,
      secondPending: false,
      // v3: rhythm personality (P1-3) and the tracking palm (P0-1).
      personality: owner.name === 'Grandpa' ? 'grandpa'
        : owner.name === 'Mom' ? 'mom'
        : owner.name === 'Timmy' ? 'timmy' : 'dad',
      trackSpeed: elapsed >= V3.trackFrom ? V3.trackSpeedLate : V3.trackSpeed,
      locked: false,
      justLocked: false,
    };
    if (kind === 'palm') {
      if (owner.name === 'Grandpa' && elapsed >= TAUNT.swatterAt) {
        atk.radius = TAUNT.swatterRadius;
        atk.dur *= TAUNT.swatterWarnScale;
        atk.swatter = true;
      }
      if (owner.name === 'Dad' && elapsed >= TAUNT.doubleAt && !opts.noWeapon) {
        atk.secondPending = true; // the newspaper comes down twice
      }
      if (opts.warnScale) atk.dur *= opts.warnScale;
      if (opts.finale) atk.dur = 1.5;
    } else if (kind === 'spray') {
      atk.dur = timing.warn * 0.9;
      atk.dir = Math.atan2(y - owner.y, x - owner.x);
    } else if (kind === 'poke') {
      // Timmy charges the line from his seat to the locked spot; the
      // warning lasts as long as his little legs need.
      const dist = Math.hypot(x - owner.x, y - owner.y);
      atk.dur = Math.max(0.55, dist / 620);
      atk.fromX = owner.x;
      atk.fromY = owner.y;
    }
    owner.cooldownT = timing.ownerCooldown + (atk.swatter ? -0.4 : 0);
    this.attacks.push(atk);
    return atk;
  }

  // Mom's leftover cloud: is the fly breathing it?
  mistHolds(fx, fy) {
    if (!this.mist) return false;
    const dx = fx - this.mist.x;
    const dy = fy - this.mist.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TAUNT.sprayRange || dist < 16) return false;
    let diff = Math.atan2(dy, dx) - this.mist.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < TAUNT.sprayHalfAngle;
  }

  fanHolds(atk, fx, fy) {
    const dx = fx - atk.owner.x;
    const dy = fy - atk.owner.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TAUNT.sprayRange || dist < 16) return false;
    let diff = Math.atan2(dy, dx) - atk.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < TAUNT.sprayHalfAngle;
  }

  // The tracking palm (v3 P0-1): until the lock moment, a warning's
  // impact point chases the fly at a capped speed — palms and hat
  // charges drag their centre, Mom's spray rotates its fan. The
  // finale is scripted onto the cake and never tracks. At 350ms out
  // the point locks; Timmy's locked point jumps (he's fast, not
  // accurate), which is his whole personality.
  track(atk, dt, fly) {
    if (!fly || atk.finale) return;
    const remain = atk.dur - atk.t;
    if (atk.locked) return;
    if (remain <= V3.lockMs / 1000) {
      atk.locked = true;
      atk.justLocked = true;
      if (atk.personality === 'timmy') {
        atk.x += (this.rng() * 2 - 1) * V3.timmyOffset;
        atk.y += (this.rng() * 2 - 1) * V3.timmyOffset;
      }
      return;
    }
    if (atk.kind === 'spray') {
      const want = Math.atan2(fly.y - atk.owner.y, fly.x - atk.owner.x);
      let diff = want - atk.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = 1.6 * dt;
      atk.dir += Math.max(-turn, Math.min(turn, diff));
      return;
    }
    const dx = fly.x - atk.x;
    const dy = fly.y - atk.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const step = Math.min(d, atk.trackSpeed * dt);
    atk.x += (dx / d) * step;
    atk.y += (dy / d) * step;
  }

  // Advance everything. Returns the list of attacks that reached
  // their impact frame this step (the game resolves them).
  update(dt, fly = null) {
    this.time += dt;
    const impacts = [];
    for (const h of this.table.humans) {
      h.gaze = h.home + Math.sin(this.time * 0.45 * h.speedScale + h.phase) * 0.55;
      h.cooldownT = Math.max(0, h.cooldownT - dt);
      h.blockedT = Math.max(0, h.blockedT - dt);
      h.angryT = Math.max(0, h.angryT - dt);
      h.exprT = Math.max(0, h.exprT - dt);
      h.stateT += dt;
    }
    for (const f of this.table.foods) f.stateT += dt;
    for (const d of this.table.dressing) d.stateT += dt;
    this.table.lampSwingT = Math.max(0, this.table.lampSwingT - dt);
    if (this.mist) {
      this.mist.t -= dt;
      if (this.mist.t <= 0) this.mist = null;
    }
    for (const atk of this.attacks) {
      atk.t += dt;
      if (atk.state === 'warning') this.track(atk, dt, fly);
      if (atk.state === 'warning' && atk.t >= atk.dur) {
        atk.state = 'slam';
        atk.t = 0;
        impacts.push(atk);
      } else if (atk.state === 'slam' && atk.t > (atk.kind === 'poke' ? 0.3 : 0.16)) {
        atk.state = 'recover';
        atk.t = 0;
        if (atk.kind === 'spray') {
          this.mist = { x: atk.owner.x, y: atk.owner.y, dir: atk.dir, t: TAUNT.sprayMistTime };
        }
      } else if (atk.state === 'recover' && atk.t >= TAUNT.palmRecover) {
        atk.state = 'done';
      }
    }
    this.attacks = this.attacks.filter((a) => a.state !== 'done');
    return impacts;
  }
}

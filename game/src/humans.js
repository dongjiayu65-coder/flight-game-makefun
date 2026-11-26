// humans.js — the family as a director: four people, their personal
// slap cooldowns, and the attacks they launch — palms (Dad's comes
// twice after 55s), Mom's bug-spray fan, Timmy's party-hat charge,
// Grandpa's faster, smaller swatter. From 55s the family can keep
// two attacks in the air at once. The palm is the player's weapon:
// it lands where the taunt locked it, and whatever is underneath
// pays for the fly's timing.

import { TAUNT } from './config.js';

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

let ATTACK_ID = 1;

export class Director {
  constructor(table) {
    this.table = table;
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

  // Advance everything. Returns the list of attacks that reached
  // their impact frame this step (the game resolves them).
  update(dt) {
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

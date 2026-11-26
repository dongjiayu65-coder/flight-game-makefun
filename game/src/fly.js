// fly.js — the fly itself, per spec 3.1/3.2: an underdamped spring
// chases the mouse (K=42, DAMP=9.5 — critical damping would be ~13,
// so it overshoots a little and feels alive), and the flash is a
// 0.12s ease-out burst to a target point the game picks by the
// spec's direction rules. The "fly-ness" (wobble, tilt) lives in the
// renderer; nothing here is random, so the judging is always fair.

import { FLY, ROOM } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Fly {
  constructor(rng, x, y) {
    this.rng = rng;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = -Math.PI / 2; // sprite angle; chases velocity
    this.wingPhase = 0;
    this.alive = true;
    this.target = { x, y }; // last mouse point (hover when it leaves)
    // Flash state.
    this.flashing = false;
    this.flashT = 0;
    this.flashFrom = { x, y };
    this.flashTo = { x, y };
    this.cooldownT = 0;
    this.iframesT = 0;
    this.bufferedT = -1; // >= 0: a press waiting out the cooldown
    this.justFlashed = false;
    // Squash and post-hit invulnerability.
    this.squashT = 0;
    this.invulnT = 0;
    // Landing (spec 3.3): the prop currently landed on, if any.
    this.landedOn = null;
    this.trail = [];
    // P0-4: the family's heads (set by the game). The stage is the
    // table + 30px apron UNION every face circle, so the fly can land
    // on Mom, Grandpa and Timmy, not just Dad.
    this.heads = [];
  }

  get radius() {
    return FLY.radius;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get flashReady() {
    return this.cooldownT <= 0 && !this.flashing && this.squashT <= 0;
  }

  get flashCooldown01() {
    // 1 = ready. Drives the white ring's sector sweep.
    const full = FLY.flashCooldown;
    return this.flashing ? 0 : clamp(1 - this.cooldownT / full, 0, 1);
  }

  // Start a flash toward a target point (already rule-picked and
  // clamped by the caller). Returns true when it fired.
  startFlash(tx, ty, cooldown) {
    if (!this.flashReady || !this.alive) return false;
    this.flashFrom = { x: this.x, y: this.y };
    this.flashTo = { x: tx, y: ty };
    this.flashing = true;
    this.flashT = 0;
    this.iframesT = FLY.flashIframes;
    this.cooldownT = cooldown;
    this.justFlashed = true;
    this.landedOn = null;
    return true;
  }

  // A press that arrived early: remember it briefly (spec: 100ms
  // input buffer); update() fires it the moment the cooldown ends.
  bufferFlash() {
    this.bufferedT = 0;
  }

  squash() {
    this.squashT = 0.4;
    this.invulnT = 1.2;
    this.vx = 0;
    this.vy = 0;
    this.flashing = false;
    this.landedOn = null;
  }

  // mouse: {x, y} the current cursor point in game space, or null
  // when the cursor is off-canvas (the fly then hovers at its last
  // target). wantsFlash: a direction-picked target from the game, or
  // null. inMist: inside Mom's spray residue (spring goes soft).
  update(dt, mouse, wantsFlash, inMist) {
    this.justFlashed = false;
    if (!this.alive) return;
    this.cooldownT -= dt;
    this.iframesT -= dt;
    this.invulnT -= dt;
    if (this.bufferedT >= 0) {
      this.bufferedT += dt;
      if (this.bufferedT > FLY.flashBuffer) this.bufferedT = -1;
    }
    if (this.squashT > 0) {
      this.squashT -= dt;
      this.wingPhase += dt * 4;
      return;
    }
    if (mouse) this.target = { x: mouse.x, y: mouse.y };

    // A buffered press fires the instant the cooldown clears.
    if (wantsFlash && this.flashReady) {
      this.startFlash(wantsFlash.x, wantsFlash.y, wantsFlash.cooldown);
      this.bufferedT = -1;
    }

    if (this.flashing) {
      this.flashT += dt;
      const k = Math.min(1, this.flashT / FLY.flashDuration);
      const ease = 1 - Math.pow(1 - k, 3);
      this.x = this.flashFrom.x + (this.flashTo.x - this.flashFrom.x) * ease;
      this.y = this.flashFrom.y + (this.flashTo.y - this.flashFrom.y) * ease;
      if (k >= 1) {
        // Keep 40% of the burst's speed, then the spring takes over.
        const dx = this.flashTo.x - this.flashFrom.x;
        const dy = this.flashTo.y - this.flashFrom.y;
        const burstSpeed = Math.hypot(dx, dy) / FLY.flashDuration;
        const len = Math.hypot(dx, dy) || 1;
        this.vx = (dx / len) * burstSpeed * 0.4;
        this.vy = (dy / len) * burstSpeed * 0.4;
        this.flashing = false;
      }
    } else {
      // The spring (spec 3.1, verbatim but for the mist modifier).
      const K = FLY.springK * (inMist ? 0.6 : 1);
      const maxSpeed = FLY.maxSpeed * (inMist ? 0.6 : 1);
      let ax = (this.target.x - this.x) * K - this.vx * FLY.springDamp;
      let ay = (this.target.y - this.y) * K - this.vy * FLY.springDamp;
      this.vx += ax * dt;
      this.vy += ay * dt;
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (dist < 5 && this.speed < 30) {
        const keep = Math.pow(0.85, dt * 60);
        this.vx *= keep;
        this.vy *= keep;
      }
      const s = this.speed;
      if (s > maxSpeed) {
        this.vx *= maxSpeed / s;
        this.vy *= maxSpeed / s;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // The stage (P0-4): the table plus a 30px apron, united with a
    // circle around every face (head radius + 10). Inside either the
    // fly is free; outside both it snaps to the nearest edge.
    const t = ROOM.table;
    const rx = clamp(this.x, t.x - 30, t.x + t.w + 30);
    const ry = clamp(this.y, t.y - 30, t.y + t.h + 30);
    if (rx !== this.x || ry !== this.y) {
      let inHead = false;
      let bestX = rx;
      let bestY = ry;
      let bestD = Math.hypot(this.x - rx, this.y - ry);
      for (const h of this.heads) {
        const R = (h.headR ?? 48) + 10;
        const dx = this.x - h.x;
        const dy = this.y - h.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= R) {
          inHead = true;
          break;
        }
        const over = dist - R;
        if (over < bestD) {
          bestD = over;
          bestX = h.x + (dx / dist) * R;
          bestY = h.y + (dy / dist) * R;
        }
      }
      if (!inHead) {
        // Kill the velocity component pushing through the wall.
        const nx = this.x - bestX;
        const ny = this.y - bestY;
        const nl = Math.hypot(nx, ny) || 1;
        const vn = (this.vx * nx + this.vy * ny) / nl;
        if (vn > 0) {
          this.vx -= (nx / nl) * vn;
          this.vy -= (ny / nl) * vn;
        }
        this.x = bestX;
        this.y = bestY;
      }
    }

    // The sprite turns toward its velocity at 14 rad/s (spec 3.1).
    if (this.speed > 40) {
      const want = Math.atan2(this.vy, this.vx);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -14 * dt, 14 * dt);
    }
    this.wingPhase += dt * (26 + this.speed * 0.09);

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 12) this.trail.pop();
  }
}

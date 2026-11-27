// fly.js — the player character's body: it flies straight at the
// steering point at a measured pace (full cruise until the last
// stretch, then a sqrt braking curve into the perch), and the
// dash ("flash") that bursts it out of a closing ring. Landing is
// the game's business; this class just moves and reports.

import { ROOM, VIEW } from './config.js';

const FLASH_TIME = 0.12;  // seconds, out and done
const FLASH_IFRAMES = 0.18;
const SPLAT_TIME = 0.45;
const SPLAT_IFRAMES = 1.2;

// Flight model, matched to the reference build's black-box
// traces: velocity is set directly toward the target each frame
// (no inertia, no overshoot), magnitude min(CRUISE, K*sqrt(dist))
// — flat out at 720 px/s until ~135 px out, then braking.
const CRUISE_SPEED = 720;
const BRAKE_K = 62;
// The fly's world is the table rectangle grown by this margin.
const FLY_MARGIN = 30;

export class Fly {
  constructor(rng, x, y) {
    this.rng = rng;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = -Math.PI / 2;
    this.heads = null; // the game wires the family's faces in here
    this.landedOn = null; // a table zone, owned by the game
    this.target = { x, y }; // current steering point, after clamping
    this.trail = [];        // recent positions, newest first
    this.wingPhase = 0;     // wing flutter clock for the renderer
    this.alive = true;
    this.justFlashed = false;
    // Flash state.
    this.flashing = false;
    this.flashT = 0;
    this.flashFrom = { x, y };
    this.flashTo = { x, y };
    this.cooldownT = 0;
    this.cooldownMax = 0.9;
    // Mercy timers.
    this.iframesT = 0;
    this.invulnT = 0;
    this.squashT = 0;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get flashReady() {
    return !this.flashing && this.cooldownT <= 0;
  }

  // 0 while the dash recharges, 1 when it is back.
  get flashCooldown01() {
    if (this.cooldownMax <= 0) return 1;
    return Math.min(1, Math.max(0, 1 - this.cooldownT / this.cooldownMax));
  }

  // Burst toward a point the game picked. Returns false when the
  // dash is not ready, so the caller can hold its fire.
  startFlash(tx, ty, cooldownSec) {
    if (!this.flashReady) return false;
    this.flashing = true;
    this.justFlashed = true;
    this.flashT = FLASH_TIME;
    this.flashFrom = { x: this.x, y: this.y };
    this.flashTo = { x: tx, y: ty };
    this.cooldownT = cooldownSec;
    this.cooldownMax = cooldownSec;
    this.iframesT = Math.max(this.iframesT, FLASH_IFRAMES);
    this.landedOn = null;
    return true;
  }

  // Caught by a slap: squash flat and take the mercy window.
  squash() {
    this.squashT = SPLAT_TIME;
    this.invulnT = Math.max(this.invulnT, SPLAT_IFRAMES);
    this.flashing = false;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, steer, _world, inMist) {
    this.cooldownT = Math.max(0, this.cooldownT - dt);
    this.iframesT = Math.max(0, this.iframesT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.squashT = Math.max(0, this.squashT - dt);
    if (!this.flashing) this.justFlashed = false;
    this.wingPhase += dt * (this.speed > 40 ? 48 : 24);

    if (this.flashing) {
      // Ease-out cubic along the burst; velocity is the curve's
      // own derivative, so the spring takes over seamlessly.
      const done = 1 - this.flashT / FLASH_TIME;
      const e = 1 - Math.pow(1 - done, 3);
      this.x = this.flashFrom.x + (this.flashTo.x - this.flashFrom.x) * e;
      this.y = this.flashFrom.y + (this.flashTo.y - this.flashFrom.y) * e;
      const vScale = (3 * Math.pow(1 - done, 2)) / FLASH_TIME;
      this.vx = (this.flashTo.x - this.flashFrom.x) * vScale;
      this.vy = (this.flashTo.y - this.flashFrom.y) * vScale;
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashing = false;
        this.x = this.flashTo.x;
        this.y = this.flashTo.y;
        this.vx *= 0.4;
        this.vy *= 0.4;
      }
    } else if (this.squashT <= 0) {
      // Steer point clamped to the fly's world: the table
      // rectangle grown by FLY_MARGIN on every side.
      const t = ROOM.table;
      const tx = Math.min(t.x + t.w + FLY_MARGIN, Math.max(t.x - FLY_MARGIN, steer ? steer.x : this.x));
      const ty = Math.min(t.y + t.h + FLY_MARGIN, Math.max(t.y - FLY_MARGIN, steer ? steer.y : this.y));
      this.target.x = tx;
      this.target.y = ty;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const mistF = inMist ? 0.6 : 1;
      if (dist > 0.5) {
        const sp = Math.min(CRUISE_SPEED * mistF, BRAKE_K * mistF * Math.sqrt(dist));
        this.vx = (dx / dist) * sp;
        this.vy = (dy / dist) * sp;
      } else {
        this.vx = 0;
        this.vy = 0;
      }
      this.x = Math.min(VIEW.width - 12, Math.max(12, this.x + this.vx * dt));
      this.y = Math.min(VIEW.height - 12, Math.max(12, this.y + this.vy * dt));
      // Motion trail for the renderer, newest first.
      const head = this.trail[0];
      if (!head || Math.hypot(this.x - head.x, this.y - head.y) > 3) {
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.pop();
      }
    }

    if (this.speed > 40) {
      const want = Math.atan2(this.vy, this.vx);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 14 * dt);
    }
  }
}

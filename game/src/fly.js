// fly.js — the player character's body: an under-damped spring
// that chases the steering point with a little overshoot, and the
// dash ("flash") that bursts it out of a closing ring. Landing is
// the game's business; this class just moves and reports.

import { VIEW } from './config.js';

const FLASH_TIME = 0.12;  // seconds, out and done
const FLASH_IFRAMES = 0.18;
const SPLAT_TIME = 0.45;
const SPLAT_IFRAMES = 1.2;

const SPRING_K = 42;
const SPRING_DAMP = 9.5;
const MAX_SPEED = 540;

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
      const k = SPRING_K * (inMist ? 0.6 : 1);
      const tx = steer ? steer.x : this.x;
      const ty = steer ? steer.y : this.y;
      // Landing flare: close to the steer point the wings brake
      // harder, so the fly settles instead of orbiting its perch.
      let damp = SPRING_DAMP;
      if (steer) {
        const dist = Math.hypot(tx - this.x, ty - this.y);
        if (dist < 130) damp *= 1 + 1.8 * (1 - dist / 130);
      }
      this.vx += ((tx - this.x) * k - this.vx * damp) * dt;
      this.vy += ((ty - this.y) * k - this.vy * damp) * dt;
      const max = MAX_SPEED * (inMist ? 0.6 : 1);
      const sp = this.speed;
      if (sp > max) {
        this.vx *= max / sp;
        this.vy *= max / sp;
      }
      if (!steer && sp < 30) {
        this.vx *= 0.85;
        this.vy *= 0.85;
      }
      this.x = Math.min(VIEW.width - 12, Math.max(12, this.x + this.vx * dt));
      this.y = Math.min(VIEW.height - 12, Math.max(12, this.y + this.vy * dt));
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

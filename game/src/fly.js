// fly.js — the fly itself: a body with a heading and a velocity, and
// the one rule that makes it a fly — it cannot simply fly where it is
// told. It glides and slows; the buzz key dashes it forward, but every
// dash is deflected by a random angle, and the fatter it gets the
// wilder the deflection and the weaker the dash.

import { FLY } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Fly {
  constructor(rng, x, y) {
    this.rng = rng;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = -Math.PI / 2; // facing north, toward the window
    this.weight = 0; // foods eaten so far
    this.cooldown = 0;
    this.buzzing = false; // true on frames a dash fired (for sound/anim)
    this.wingPhase = 0;
    this.alive = true;
    this.escaped = false;
  }

  get radius() {
    // Visibly fatter with every course: +3 px of body per weight.
    return FLY.radius + this.weight * 3;
  }

  get deflectRad() {
    return ((FLY.dashDeflectDeg + FLY.deflectPerWeight * this.weight) * Math.PI) / 180;
  }

  // steer: {tx, ty} a point the fly turns toward (the mouse), or null.
  // buzz: whether the buzz key is held this step.
  update(dt, steer, buzz) {
    this.buzzing = false;
    if (!this.alive || this.escaped) return;

    // The heading turns toward the mouse at a limited rate — the fly
    // is willing, just not precise.
    if (steer) {
      const want = Math.atan2(steer.ty - this.y, steer.tx - this.x);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = clamp(diff, -FLY.steerRate * dt, FLY.steerRate * dt);
      this.heading += turn;
    }

    // Glide: drag bleeds speed; a fat fly glides like a dumpling.
    const drag = Math.exp(-FLY.glideDrag * dt * (1 - this.weight * 0.08));
    this.vx *= drag;
    this.vy *= drag;

    // Buzz: each dash is an impulse along the heading, deflected by a
    // random angle inside ±deflect — the heart of the game.
    this.cooldown -= dt;
    if (buzz && this.cooldown <= 0) {
      const deflect = (this.rng() * 2 - 1) * this.deflectRad;
      const dir = this.heading + deflect;
      const power = FLY.dashImpulse * (1 - FLY.dashWeakPerWeight * this.weight);
      this.vx += Math.cos(dir) * power;
      this.vy += Math.sin(dir) * power;
      this.cooldown = FLY.dashCooldown;
      this.buzzing = true;
    }

    // Clamp to a top speed and move.
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > FLY.maxSpeed) {
      this.vx = (this.vx / sp) * FLY.maxSpeed;
      this.vy = (this.vy / sp) * FLY.maxSpeed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.wingPhase += dt * (30 + sp * 0.06);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}

// humans.js — the family: four gazes sweeping the table, one shared
// attention meter, and the giant palm. Being seen is not instantly
// fatal — attention fills while a cone holds the fly and drains while
// it hides — but a full meter brings the hand: first a growing shadow
// on the table (the warning, and the chance to bolt), then the slam.
// Caught inside the palm at impact ends the run; outside it, the miss
// is counted and the fly flies on.

import { HUMANS } from './config.js';

export class Humans {
  constructor(table) {
    this.table = table;
    this.attention = 0; // 0..1
    this.watching = false; // is any cone on the fly this frame
    this.palm = { state: 'idle', t: 0, x: 0, y: 0 }; // idle|warning|slam|recover
    this.nearMisses = 0;
    this.time = 0;
  }

  // Is the fly inside this human's cone right now?
  coneHolds(h, fx, fy) {
    const dx = fx - h.x;
    const dy = fy - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist > HUMANS.coneRange || dist < 12) return false;
    let diff = Math.atan2(dy, dx) - h.gaze;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < HUMANS.coneHalfAngle;
  }

  // Returns 'caught' on the frame the palm lands on the fly, else null.
  update(dt, fly, elapsed) {
    this.time += dt;
    const late = elapsed > HUMANS.lateGameAt;

    // Gazes sweep around their home directions, out of step.
    for (const h of this.table.humans) {
      h.gaze = h.home + Math.sin(this.time * HUMANS.sweepSpeed * h.speedScale + h.phase) * HUMANS.sweepArc;
    }

    // Attention: the palm's own drama pauses the meter.
    this.watching = this.palm.state === 'idle' && this.table.humans.some((h) => this.coneHolds(h, fly.x, fly.y));
    if (this.palm.state === 'idle') {
      if (this.watching) {
        const gain = HUMANS.attentionGain * (late ? HUMANS.lateGameGainScale : 1);
        this.attention = Math.min(1, this.attention + gain * dt);
      } else {
        this.attention = Math.max(0, this.attention - HUMANS.attentionDecay * dt);
      }
      if (this.attention >= 1) {
        // The hand commits: the shadow locks onto where the fly is.
        this.palm = { state: 'warning', t: 0, x: fly.x, y: fly.y };
      }
    } else if (this.palm.state === 'warning') {
      this.palm.t += dt;
      if (this.palm.t >= HUMANS.palmWarnTime) {
        this.palm.state = 'slam';
        this.palm.t = 0;
        const d = Math.hypot(fly.x - this.palm.x, fly.y - this.palm.y);
        if (d < HUMANS.palmRadius) return 'caught';
        this.nearMisses++;
        this.attention = 0.35; // the table stays suspicious after a miss
      }
    } else if (this.palm.state === 'slam') {
      this.palm.t += dt;
      if (this.palm.t > 0.16) {
        this.palm.state = 'recover';
        this.palm.t = 0;
      }
    } else if (this.palm.state === 'recover') {
      this.palm.t += dt;
      if (this.palm.t >= HUMANS.palmRecover) {
        this.palm = { state: 'idle', t: 0, x: 0, y: 0 };
        this.attention = Math.min(this.attention, 0.35);
      }
    }
    return null;
  }
}

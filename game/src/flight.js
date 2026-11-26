// flight.js — the aeroplane and how it flies. A deliberately small,
// honest flight model: throttle makes thrust, pitch trades speed for
// height, banked wings turn the nose, slow flight stalls, and the
// ground is judged by how gently you meet it. The renderer and HUD
// only read this state; all the rules of flying live here.

import { PLANE } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Plane {
  constructor(world, mission) {
    this.world = world;
    this.reset(mission);
  }

  reset(mission) {
    const w = this.world;
    this.mission = mission;
    // Start airborne on the valley centre line, on course (+Z).
    this.x = w.centreX(0);
    this.z = 0;
    this.y = w.height(this.x, 0) + mission.startAltitude;
    this.heading = 0; // radians; 0 = +Z (north up the valley), + = east
    this.pitch = 0; // radians, + = nose up
    this.roll = 0; // radians, + = right wing down
    this.speed = mission.startSpeed;
    this.throttle = 0.62;
    this.fuel = mission.fuel;
    this.vspeed = 0; // metres per second, smoothed for the gauge
    this.groundSpeed = this.speed;
    this.stalled = false;
    this.gearDown = true; // fixed gear: a bush plane keeps its legs out
    this.state = 'flying'; // flying | landed | crashed
    this.crashReason = '';
    this.landingReport = null;
    this.time = 0;
    this.ringsHit = 0;
    this.wind = { x: mission.wind.x, gustPhase: Math.random() * 10 };
    this.touchdown = null;
  }

  // input: {pitch: -1..1 (up positive), roll: -1..1, throttleDelta: -1..1}
  // dt is a fixed step from the main loop.
  update(dt, input) {
    if (this.state !== 'flying') return;
    const m = this.mission;
    this.time += dt;

    // Throttle follows the lever; fuel burns in proportion.
    this.throttle = clamp(this.throttle + input.throttleDelta * dt * 0.55, 0, 1);
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * this.throttle;
    this.fuel = Math.max(0, this.fuel - burn * dt);
    const engineOut = this.fuel <= 0;

    // Controls: pitch and roll ease toward the stick, faster when the
    // air is moving fast over the wings, sloppy near the stall.
    const authority = clamp((this.speed - 12) / 30, 0.25, 1);
    const targetPitch = input.pitch * 0.42;
    const targetRoll = input.roll * 1.05;
    this.pitch = lerp(this.pitch, targetPitch, clamp(dt * 3.2 * authority, 0, 1));
    this.roll = lerp(this.roll, targetRoll, clamp(dt * 3.8 * authority, 0, 1));

    // A banked wing turns the nose; the turn is tighter when slow.
    const turnRate = Math.sin(this.roll) * (9.8 / Math.max(this.speed, 18)) * 0.9;
    this.heading += turnRate * dt;

    // Thrust against drag; gravity along the flight path when pitched.
    const thrust = engineOut ? 0 : this.throttle * 9.5;
    const drag = 0.0038 * this.speed * this.speed + Math.abs(this.pitch) * 2.4 + Math.abs(this.roll) * 1.1;
    const gravityAlong = -9.8 * Math.sin(this.pitch);
    this.speed += (thrust - drag + gravityAlong) * dt;
    this.speed = Math.max(this.speed, 6);

    // Stall: below stall speed the nose drops and the sink builds.
    this.stalled = this.speed < PLANE.stallSpeed && !engineOut;
    let sink;
    if (this.stalled) {
      this.pitch = lerp(this.pitch, -0.22, dt * 1.6);
      sink = -7.5 + Math.sin(this.pitch) * this.speed;
    } else {
      sink = Math.sin(this.pitch) * this.speed;
    }
    // Vertical speed from the flight path, smoothed for the gauge.
    const rawV = sink;
    this.vspeed = lerp(this.vspeed, rawV, clamp(dt * 4, 0, 1));

    // Wind: the mission's steady push plus a gust that breathes.
    this.wind.gustPhase += dt * 0.7;
    const gust = m.wind.gust * Math.sin(this.wind.gustPhase) * Math.sin(this.wind.gustPhase * 0.37 + 1.7);
    const windX = m.wind.x + gust;

    // Move: forward along heading, plus the wind's push sideways.
    const vx = Math.sin(this.heading) * this.speed * Math.cos(this.pitch) + windX;
    const vz = Math.cos(this.heading) * this.speed * Math.cos(this.pitch);
    this.x += vx * dt;
    this.z += vz * dt;
    this.y += this.vspeed * dt;
    this.groundSpeed = Math.hypot(vx, vz);

    this.checkRings();
    this.checkGround();
  }

  checkRings() {
    for (const ring of this.world.rings) {
      if (ring.passed || ring.missed) continue;
      const dz = this.z - ring.z;
      if (dz > 30) {
        ring.missed = true;
        continue;
      }
      if (Math.abs(dz) < 16) {
        const d = Math.hypot(this.x - ring.x, this.y - ring.y);
        if (d < ring.r) {
          ring.passed = true;
          this.ringsHit++;
        }
      }
    }
  }

  checkGround() {
    const ground = this.world.height(this.x, this.z);
    if (this.y > ground + 1.2) return;
    // Touching the earth: a landing, a ditching, or a crash — decided
    // by where we are and how gently we arrived.
    const strip = this.world.runway;
    const onStrip =
      Math.abs(this.x - strip.x) < strip.width / 2 + 4 &&
      this.z > strip.z - 10 &&
      this.z < strip.z + strip.length + 10;
    const sinkRate = -this.vspeed;
    if (onStrip && sinkRate <= PLANE.landingMaxSink && this.speed <= PLANE.landingMaxSpeed && Math.abs(this.roll) < 0.28) {
      this.state = 'landed';
      this.y = ground;
      this.landingReport = {
        sinkRate,
        speed: this.speed,
        centreOffset: this.x - strip.x,
        fuelLeft: this.fuel,
        time: this.time,
        rings: this.ringsHit,
        ringsTotal: this.world.rings.length,
      };
      return;
    }
    this.state = 'crashed';
    this.y = ground;
    if (onStrip && sinkRate > PLANE.landingMaxSink) {
      this.crashReason = 'You came down too hard on the strip — the gear folded.';
    } else if (onStrip && this.speed > PLANE.landingMaxSpeed) {
      this.crashReason = 'Too fast for the strip — you ran out of runway and ground-looped.';
    } else if (this.world.overRiver(this.x, this.z)) {
      this.crashReason = 'Ditched in the river. The mail is wet, the plane is wetter.';
    } else {
      this.crashReason = 'Terrain. The valley keeps what it catches.';
    }
    this.touchdown = { sinkRate, speed: this.speed };
  }

  // Readings for the HUD, in the units a pilot reads.
  get speedKt() { return this.speed * 1.944; }
  get altitudeFt() { return this.y * 3.281; }
  get headingDeg() {
    const d = (this.heading * 180) / Math.PI;
    return ((d % 360) + 360) % 360;
  }
  get fuelPct() { return (this.fuel / PLANE.fuelCapacity) * 100; }
}

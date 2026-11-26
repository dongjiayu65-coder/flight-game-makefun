// main.js — the game itself: "One Fly Ruins a Birthday Party",
// built to the final spec (Quick Claude v1.0 + copy bank v1.0).
// Land on anything to taunt it; the family's attack locks onto the
// spot; leave the impact radius at the last instant — PERFECT is a
// 70ms window — and the attack smashes whatever was underneath
// instead, in chains (E1-E10). Combo feeds chaos, chaos feeds
// combo. Three hits or ninety seconds end the party.

import { VIEW, ROOM, FLY, TAUNT, RATINGS, FINALE_PERFECT_MS, CHAIN_MAX_DEPTH, COMBO, EVENTS, RANDOM_EVENTS, PHASES, GAME, V3, MOOD } from './config.js';
import { makeRng } from './random.js';
import { Table } from './table.js';
import { Fly } from './fly.js';
import { Director, timingAt } from './humans.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { onSpritesReady } from './sprites.js';
import { Copy, GALLERY } from './copy.js';
import { applyPose } from './shots.js';

const STEP = 1 / 60;

// Page-session persistence (localStorage where the sandbox allows
// it, in-memory otherwise): best score, the disaster log, run count.
const META = (window.__flyMeta ??= (() => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('oneFlyMeta') || '{}');
  } catch { saved = {}; }
  return { best: saved.best || 0, gallery: new Set(saved.gallery || []), runs: saved.runs || 0 };
})());
function persistMeta() {
  try {
    localStorage.setItem('oneFlyMeta', JSON.stringify({ best: META.best, gallery: [...META.gallery], runs: META.runs }));
  } catch { /* the sandbox said no; the in-memory copy still works */ }
}

const comboMult = (combo) => Math.min(COMBO.multCap, 1 + COMBO.multPer * combo);
const tierFor = (combo) => {
  let tier = COMBO.tiers[0];
  for (const t of COMBO.tiers) if (combo >= t.at) tier = t;
  return tier;
};

class Game {
  constructor(canvas, seed) {
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(this.renderer.ctx);
    this.sound = new Sound();
    this.newRun(seed);
    this.state = 'title';
    this.time = 0;
    this.paused = false;
    this.freezeT = 0;
    this.slowmoT = 0;
    this.slowmoVal = 0.35;
    this.whiteFlashT = 0;
    this.redFlashT = 0;
    this.shakeAmp = 0;
    this.zoomT = 0;
    this.zoomAmp = 0;
  }

  newRun(seed) {
    this.rng = makeRng(seed * 13 + 5);
    this.copy = new Copy(seed);
    this.metaGallery = META.gallery;
    this.bestScore = META.best;
    this.table = new Table(seed);
    this.director = new Director(this.table, makeRng(seed * 29 + 3));
    const dad = this.table.humans[3];
    this.fly = new Fly(makeRng(seed * 7 + 1), dad.x, dad.y - 6);
    this.fly.heads = this.table.humans; // P0-4: faces are part of the flyable stage
    this.clock = 0; // real run clock (tutorial included)
    this.elapsed = 0; // the 90s party clock (starts after the tutorial)
    this.tutorial = META.runs === 0 ? 'script' : 'quick';
    this.tutPhase = 'nose'; // nose -> soup -> done (script) | quick
    this.tutAttack = null;
    this.tutDodged = false; // P0-2: the fly stays pinned on Dad's nose until this
    this.score = 0;
    this.chaosTotal = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hp = GAME.hp;
    this.lastGoodClock = -99;
    this.decayAcc = 0;
    this.lastTier = 'plain';
    this.tierPopT = 0;
    this.landClock = 0;
    this.hoverZone = null;
    this.tauntClock = 0;
    this.idleClock = 0;
    this.pendingFlashAt = -1; // P1-2: clock of a buffered press (-1 none), expires after 100ms
    this.graceHits = []; // P1-1: catches held one frame for a post-impact PERFECT press
    this.stepCount = 0; // test hook: simulation steps run this page session
    this.hintsT = 0; // design #2: control icons shown for 3s after the opening
    this.tierRing = null; // design #5: transformation shockwave {t, color}
    this.queuedFlash = false; // P0-1: latched dodge press, cleared by step()
    this.prevFlashReady = true;
    this.eventQueue = []; // {at, fn} derivations, 0.3s per chain layer
    this.eventCd = new Map(); // object ref -> clock when its event re-arms
    this.longestChain = 0;
    this.brawlCount = 0;
    this.finaleTriggered = false;
    this.finaleDone = false;
    this.finaleAnnounced = false;
    this.resultsAt = -1;
    this.finishTime = -1;
    this.endReason = '';
    this.lifeBonus = 0;
    this.ruinStep = 0; // v7 #4: how many PARTY RUINED milestones have paid out
    this.restocked = false; // v7 #5: the 55s second helping has been served
    this.caption = '';
    this.nearMissLine = '';
    this.rank = null;
    this.particles = [];
    this.texts = [];
    this.stains = []; // v3 art: cloth stain decals, kept all run
    this.projectiles = [];
    this.landedProps = [];
    this.chainPop = null; // {n, t} the fixed CHAIN banner
    this.dog = null;
    this.puddle = null; // {x, y, t} spilled drink (E7)
    this.blackoutT = 0;
    this.doorbellT = 0;
    this.photoT = 0;
    this.randomIdx = 0;
    this.randomUsed = new Map();
    this.lastRandom = null;
    this.weaponFlags = { spray: false, swatter: false, late: false };
    this.soupRefillAt = -1;
    this.showKeycap = false;
    this.ghostTarget = null;
    // --- v3 state -----------------------------------------------------
    this.bet = 0; // P1-4: raised stakes while landed (0..V3.betMax)
    this.betAtFlash = 0; // the bet captured by the dodge that spends it
    this.crumbs = []; // P1-2: harvestable chain debris
    this.decayDeadline = -99; // combo decay starts after this clock
    this.chainHealUsed = false; // per-chain-root: the x3 heart refund
    this.chainCounted = false; // per-chain-root: the x3 stat
    this.chain3Count = 0; // chains that reached depth >= 3 this run
    this.missBar = null; // P0-3: the "how late were you" replay bar
    this.lastDodgePress = null; // {clock, remainMs} of the last dodge input
    this.focusPaused = false; // P0-4: tab lost focus mid-run
    this.hudSlideT = META.runs === 0 ? 0 : 1;
    this.events = { soupFace: false, cakeBoom: false, glasses: false, dentures: false, palmPrint: false, forkChain: false };
  }

  start() {
    this.state = 'playing';
  }

  // Test hook (expr-test A1): jump past the opening script so a
  // directed test is never parked inside the tutorial near-freeze
  // (time scale 0.05 while the fly sits under Dad's palm — by design
  // it does not release until a press). Pair with stepCount to wait
  // on simulation steps rather than on animation frames.
  skipTutorial() {
    this.director.attacks = [];
    this.tutAttack = null;
    this.tutDodged = true;
    this.tutorial = 'done';
    this.tutPhase = 'done';
    this.ghostTarget = null;
    this.hudSlideT = 1;
    this.showKeycap = false;
  }

  get tier() {
    return tierFor(this.combo);
  }

  get destruction01() {
    return Math.min(1, this.chaosTotal / GAME.destructionFull);
  }

  get finaleArmed() {
    return this.elapsed >= PHASES.finaleAt && !this.finaleDone;
  }

  // --- fx helpers --------------------------------------------------------

  spawnParticles(list) {
    for (const p of list) {
      p.max = p.life;
      this.particles.push(p);
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  burst(x, y, n, color, speed = 120, size = 3, life = 0.55, grav = 600) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.sin(i * 12.9898 + x) * 3.1 + i * 0.7;
      const sp = speed * (0.35 + ((i * 37) % 10) / 14);
      out.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 46,
        life: life * (0.6 + ((i * 53) % 10) / 16), size: size * (0.6 + ((i * 29) % 10) / 12),
        color, grav,
      });
    }
    this.spawnParticles(out);
  }

  floatText(x, y, text, color = '#ffe9a3', size = 26, opts = {}) {
    this.texts.push({ x, y, text, color, size, t: 0, life: opts.life ?? 1.05, flyTo: !!opts.flyTo, bubble: !!opts.bubble });
    if (this.texts.length > 16) this.texts.shift();
  }

  flyProjectile(kind, fromX, fromY, toX, toY, onArrive) {
    this.projectiles.push({
      kind, x: fromX, y: fromY, fromX, fromY, toX, toY,
      t: 0, dur: 0.62, peak: 90 + Math.abs(toX - fromX) * 0.12, rot: 0, onArrive,
    });
  }

  unlock(id) {
    if (META.gallery.has(id)) return;
    META.gallery.add(id);
    persistMeta();
    this.floatText(VIEW.width / 2, 210, 'NEW DISASTER!', '#ffd94d', 30); // design #4: clear of Mom
    this.sound.comboUp();
  }

  queueEvent(delay, fn) {
    this.eventQueue.push({ at: this.clock + delay, fn });
  }

  eventReady(ref, seconds) {
    const readyAt = this.eventCd.get(ref) ?? -1;
    if (this.clock < readyAt) return false;
    this.eventCd.set(ref, this.clock + seconds);
    return true;
  }

  // --- the run -----------------------------------------------------------

  step(dt, input) {
    this.time += dt;
    this.stepFx(dt);
    if (this.state !== 'playing') return;
    this.stepCount++;
    this.clock += dt;
    this.hintsT = Math.max(0, this.hintsT - dt);
    if (this.tutorial === 'done') this.elapsed += dt;
    this.tierPopT = Math.max(0, this.tierPopT - dt);
    if (this.chainPop) {
      this.chainPop.t += dt;
      if (this.chainPop.t > 0.9) this.chainPop = null;
    }
    this.blackoutT = Math.max(0, this.blackoutT - dt);
    this.doorbellT = Math.max(0, this.doorbellT - dt);
    this.photoT = Math.max(0, this.photoT - dt);
    if (this.hudSlideT < 1 && this.tutorial === 'done') this.hudSlideT = Math.min(1, this.hudSlideT + dt / 0.9);
    if (this.puddle) {
      this.puddle.t -= dt;
      if (this.puddle.t <= 0) this.puddle = null;
    }
    if (this.table.foods[1].state === 'empty' && this.clock >= this.soupRefillAt) {
      this.table.foods[1].state = 'fresh'; // seconds, anyone?
    }
    // Queued chain derivations fire on their own clock.
    for (let i = this.eventQueue.length - 1; i >= 0; i--) {
      if (this.clock >= this.eventQueue[i].at) {
        const ev = this.eventQueue.splice(i, 1)[0];
        ev.fn();
      }
    }

    if (input.flashPressed) this.noteDodgePress();
    this.handleFlash(input);
    // P0-2: during the opening beat on Dad's nose the mouse does not
    // steer — the fly is pinned to the nose until the first dodge
    // fires, so the slap is guaranteed to come down on Dad's face.
    let steer = input.steer;
    if (this.tutorial !== 'done' && this.tutPhase === 'nose' && !this.tutDodged) {
      if (this.fly.flashing) {
        this.tutDodged = true;
      } else {
        const dad = this.table.humans[3];
        steer = { x: dad.x, y: dad.y - 6 };
        this.fly.x = dad.x;
        this.fly.y = dad.y - 6;
        this.fly.vx = 0;
        this.fly.vy = 0;
      }
    }
    const inMist = this.director.mistHolds(this.fly.x, this.fly.y);
    this.fly.update(dt, steer, null, inMist);
    this.sound.buzz(true);

    // P1-1: a catch held for the one-frame post-impact grace. If the
    // flash fired in that frame it is a PERFECT escape at 0ms; if not,
    // the catch lands now. Processed BEFORE this step's new impacts,
    // so every held catch waits exactly one step.
    if (this.graceHits.length) {
      const held = this.graceHits.splice(0);
      for (const g of held) {
        if (this.fly.iframesT > 0) {
          g.flashRemainMs = 0;
          g.wasInside = true;
          g.exitByFlash = true;
        }
        this.resolveImpact(g);
      }
    }
    const impacts = this.director.update(dt, this.fly);
    // The lock "clack" (P0-1): the moment a tracking point settles.
    for (const atk of this.director.attacks) {
      if (atk.justLocked) {
        atk.justLocked = false;
        this.sound.lock();
      }
    }
    for (const atk of impacts) this.resolveImpact(atk);
    this.trackEscapes();
    this.crumbLogic(dt);

    this.tutorialLogic(dt);
    this.landingLogic(dt);
    this.comboLogic(dt);
    this.dogLogic(dt);
    this.phaseLogic();
    this.expressionLogic(dt);
    this.sound.update(dt, { playing: true, flySpeed: this.fly.speed, landed: !!this.fly.landedOn, warnMs: this.warnRemainMs(), bet: this.bet });

    if (this.resultsAt > 0 && this.clock >= this.resultsAt) return this.finish(this.endReason);
    // v6.1: no instant finish at hp 0 — hitFly already schedules the
    // results 1s out (resultsAt), so the final splat is actually seen.
    if (this.tutorial === 'done' && this.elapsed >= GAME.duration) return this.finish("TIME'S UP!");
  }

  // The tightest warning clock, for the accelerating tick track.
  warnRemainMs() {
    let best = null;
    for (const atk of this.director.attacks) {
      if (atk.state !== 'warning') continue;
      const remain = (atk.dur - atk.t) * 1000;
      if (best === null || remain < best) best = remain;
    }
    return best;
  }

  // Every dodge input is timestamped against the tightest live
  // warning, so a splat can show the player exactly where their
  // press fell (P0-3) — and a press that lands just *after* the
  // impact is measured as the "late" it felt like.
  noteDodgePress() {
    const remainMs = this.warnRemainMs();
    if (remainMs != null) this.lastDodgePress = { clock: this.clock, remainMs };
    if (this.missBar && this.missBar.lateMs == null && this.missBar.t <= 0.35) {
      this.missBar.lateMs = Math.round(this.missBar.t * 1000);
    }
  }

  // P1-4: while landed, a left click raises the bet instead of
  // dodging. Each level multiplies the coming rating and eats 10%
  // of the remaining warning — greed, priced in milliseconds.
  placeBet() {
    if (this.bet >= V3.betMax || !this.fly.landedOn) return;
    // v7 #1: a bet needs a live warning to pay for it. During the taunt
    // delay (no ring yet) clicks do nothing — that used to be a free
    // x2.5 with no shortened warning.
    const live = this.director.attacks.some((a) => a.state === 'warning' && !a.finale && !a.decor && !a.idle);
    if (!live) return;
    this.bet++;
    for (const atk of this.director.attacks) {
      if (atk.state === 'warning' && !atk.finale) {
        atk.t += (atk.dur - atk.t) * V3.betWarnCut;
      }
    }
    this.floatText(this.fly.x, this.fly.y - 46, `BET x${(1 + V3.betMultPer * this.bet).toFixed(1)}`, '#FF3FA4', 24);
    this.sound.bet(this.bet);
  }

  // P1-2: chain debris. Crumbs pop out of every smashed layer, sit
  // for a few seconds, and pay the fly that harvests them: score,
  // a shaved flash cooldown, and a longer combo fuse.
  spawnCrumbs(x, y, depth) {
    const n = V3.crumbPerLayer[0] + Math.floor(this.rng() * (V3.crumbPerLayer[1] - V3.crumbPerLayer[0] + 1));
    const colors = ['#FFC94A', '#E8743B', '#FFD1DC', '#5FD3B5', '#FFF3C4'];
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = 14 + this.rng() * 74;
      this.crumbs.push({
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8,
        t: 0, life: V3.crumbLife, size: 3.4 + this.rng() * 2.2,
        color: colors[Math.floor(this.rng() * colors.length)],
        phase: this.rng() * Math.PI * 2,
      });
    }
    if (this.crumbs.length > 60) this.crumbs.splice(0, this.crumbs.length - 60);
  }

  crumbLogic(dt) {
    for (const c of this.crumbs) c.t += dt;
    this.crumbs = this.crumbs.filter((c) => c.t < c.life);
    if (this.fly.squashT > 0) return;
    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const c = this.crumbs[i];
      if (Math.hypot(this.fly.x - c.x, this.fly.y - c.y) < V3.crumbRadius) {
        this.crumbs.splice(i, 1);
        this.score += V3.crumbScore;
        this.fly.cooldownT = Math.max(0, this.fly.cooldownT - V3.crumbCooldownCut);
        if (this.combo > 0) {
          this.decayDeadline = Math.min(this.decayDeadline + V3.crumbDecayBonus, this.clock + COMBO.decayAfter + V3.crumbGraceCap);
        }
        this.burst(c.x, c.y, 4, c.color, 60, 2, 0.3, 200);
        this.sound.crumb();
      }
    }
  }

  // Flash direction rules (spec 3.2): if a warning has the fly
  // locked and the player isn't steering anywhere, flash directly
  // away from the danger; otherwise flash toward the mouse.
  flashTarget() {
    const fly = this.fly;
    const dist = this.tier.id === 'rainbow' ? FLY.flashDistanceRainbow : FLY.flashDistance;
    let dx = null;
    let dy = null;
    const threat = this.director.attacks.find(
      (a) => a.state === 'warning' && Math.hypot(fly.x - a.x, fly.y - a.y) < a.radius + 34,
    );
    const mouseNear = !this.lastMouse || Math.hypot(this.lastMouse.x - fly.x, this.lastMouse.y - fly.y) < 30;
    if (threat && mouseNear) {
      dx = fly.x - threat.x;
      dy = fly.y - threat.y;
      if (Math.hypot(dx, dy) < 4) {
        const t = ROOM.table;
        dx = fly.x - (t.x + t.w / 2);
        dy = fly.y - (t.y + t.h / 2);
      }
    } else if (this.lastMouse) {
      dx = this.lastMouse.x - fly.x;
      dy = this.lastMouse.y - fly.y;
      if (Math.hypot(dx, dy) < 4) {
        dx = Math.cos(fly.heading);
        dy = Math.sin(fly.heading);
      }
    } else {
      dx = Math.cos(fly.heading);
      dy = Math.sin(fly.heading);
    }
    const len = Math.hypot(dx, dy) || 1;
    return { x: fly.x + (dx / len) * dist, y: fly.y + (dy / len) * dist };
  }

  handleFlash(input) {
    this.lastMouse = input.steer ?? this.lastMouse;
    // A fired flash spends the raised bet (P1-4): the dodge that
    // leaves with the money is graded on the multiplied rating.
    const spendBet = () => {
      this.betAtFlash = this.bet;
      this.bet = 0;
    };
    const fire = () => {
      const tgt = this.flashTarget();
      const cd = this.tier.id === 'flame' || this.tier.id === 'rainbow' ? FLY.flashCooldownFlame : FLY.flashCooldown;
      if (!this.fly.startFlash(tgt.x, tgt.y, cd)) return false;
      spendBet();
      this.sound.dash(0.8);
      // P1-1: the grade is read at the moment the flash leaves —
      // stamp every live warning the fly is under with its time left.
      for (const atk of this.director.attacks) {
        if (atk.state !== 'warning' || atk.decor) continue;
        if (this.flyInShape(atk, this.flashFrom().x, this.flashFrom().y)) {
          atk.flashRemainMs = (atk.dur - atk.t) * 1000;
        }
      }
      return true;
    };
    if (input.flashPressed) {
      if (this.fly.flashReady) fire();
      else this.pendingFlashAt = this.clock; // P1-2: buffer, 100ms shelf life
    }
    if (this.pendingFlashAt >= 0) {
      if (this.clock - this.pendingFlashAt > FLY.flashBuffer) {
        this.pendingFlashAt = -1; // expired: a stale press never fires later
      } else if (this.fly.flashReady) {
        this.pendingFlashAt = -1;
        fire();
      }
    }
    // The "pop" when the flash comes back (spec 3.2).
    const ready = this.fly.flashReady;
    if (ready && !this.prevFlashReady) this.sound.pop();
    this.prevFlashReady = ready;
  }

  // Where the current flash started (the fly has already moved 0px
  // on the frame it fires, so this is its position at the press).
  flashFrom() {
    return this.fly.flashing ? this.fly.flashFrom : { x: this.fly.x, y: this.fly.y };
  }

  // Per-frame escape bookkeeping: while the fly is inside an attack's
  // shape, the attack remembers how late that was (the greed
  // measurement); the exit frame records whether it left by flash.
  trackEscapes() {
    for (const atk of this.director.attacks) {
      if (atk.state !== 'warning' || atk.decor) continue;
      const inside = this.flyInShape(atk, this.fly.x, this.fly.y);
      if (inside) {
        atk.remainMs = (atk.dur - atk.t) * 1000;
        atk.wasInside = true;
        atk.exitByFlash = false;
      } else if (atk.wasInside && !atk.exited) {
        atk.exited = true;
        atk.exitByFlash = this.fly.flashing || this.fly.iframesT > 0;
      }
    }
  }

  flyInShape(atk, fx, fy) {
    if (atk.kind === 'spray') return this.director.fanHolds(atk, fx, fy);
    if (atk.kind === 'poke') {
      // The corridor from Timmy's seat to the locked spot.
      const ax = atk.fromX, ay = atk.fromY, bx = atk.x, by = atk.y;
      const abx = bx - ax, aby = by - ay;
      const tt = Math.max(0, Math.min(1, ((fx - ax) * abx + (fy - ay) * aby) / (abx * abx + aby * aby || 1)));
      return Math.hypot(fx - (ax + abx * tt), fy - (ay + aby * tt)) < 26;
    }
    return Math.hypot(fx - atk.x, fy - atk.y) < atk.radius;
  }

  // --- impact resolution -------------------------------------------------

  resolveImpact(atk) {
    // P0-3: the finale's three companion palms are pure spectacle.
    if (atk.decor) return;
    // A spilled drink makes the hand slip (E7): the impact point
    // skids before anything is judged (once — a graced catch comes
    // back through here a frame later).
    if (this.puddle && atk.kind === 'palm' && !atk.finale && !atk.skidded) {
      const a = this.rng() * Math.PI * 2;
      atk.x += Math.cos(a) * 30;
      atk.y += Math.sin(a) * 30;
    }
    atk.skidded = true;
    // P1-1: spec 2.3's one invisible frame AFTER impact. A fly that
    // is about to be caught gets one more step to press; the catch
    // (or the 0ms PERFECT) resolves at the top of the next step.
    if (!atk.graced && !atk.tutorial && this.flyInShape(atk, this.fly.x, this.fly.y) &&
        this.fly.iframesT <= 0 && this.fly.invulnT <= 0 && this.fly.squashT <= 0) {
      atk.graced = true;
      this.graceHits.push(atk);
      return;
    }
    this.sound.thud();
    this.shakeAmp = Math.max(this.shakeAmp, 4);
    this.freezeT = Math.max(this.freezeT, 0.04);
    if (atk.kind !== 'spray') this.burst(atk.x, atk.y, 12, 'rgba(214,188,150,0.85)', 120, 2.6, 0.45, 300);

    const flyCaught = this.flyInShape(atk, this.fly.x, this.fly.y) && this.fly.iframesT <= 0 && this.fly.invulnT <= 0 && this.fly.squashT <= 0;
    if (flyCaught) {
      // P0-3: leave a replay bar behind — where the player's press
      // fell against the PERFECT window, or that there never was one.
      if (!atk.tutorial) {
        const press = this.lastDodgePress && this.clock - this.lastDodgePress.clock <= atk.dur + 0.05
          ? this.lastDodgePress : null;
        this.missBar = { t: 0, dur: 1.25, pressRemainMs: press ? Math.round(press.remainMs) : null, lateMs: null };
        this.lastDodgePress = null;
      }
      this.hitFly(atk);
      if (atk.finale) this.finaleExplosion(atk, false);
      return;
    }
    // Escaped — but was it a *flash* escape, or did it just wander
    // out? Only the flash grades (spec 2.3). Tutorial attacks grade
    // any escape as their scripted reward.
    const flashedOut = atk.exitByFlash || this.fly.iframesT > 0 || atk.tutorial;
    if (atk.wasInside && flashedOut) {
      this.gradeDodge(atk);
    } else if (atk.wasInside) {
      this.floatText(this.fly.x, this.fly.y - 26, this.copy.ratingLabel('slipped'), '#bdb2a0', 18);
    }
    // The hand lands on whatever is underneath *now* (v3 P0-1):
    // the point was dragged during the warning, so the victim is
    // read off the impact spot, not the taunt that started it. The
    // dog outranks the dishes, exactly as it does for landing.
    if (atk.kind === 'palm' || atk.kind === 'poke') {
      if (atk.finale) {
        this.finaleExplosion(atk, true);
      } else if (!atk.idle) {
        let under = null;
        if (this.dog && this.dog.state === 'idle' && Math.hypot(atk.x - this.dog.x, atk.y - this.dog.y) < 46) {
          under = { kind: 'dog', ref: this.dog, x: this.dog.x, y: this.dog.y, r: 34 };
        } else {
          under = this.table.propAt(atk.x, atk.y);
        }
        const smashTarget = under ?? atk.target;
        this.chainHealUsed = false;
        this.chainCounted = false;
        if (smashTarget) this.smash(smashTarget, atk, 1);
        // The slam shoves the neighbouring dressing around: the
        // table layout is never quite the same twice (P1-1).
        const t = this.table.rect;
        for (const d of this.table.dressing) {
          if (d.state !== 'fresh' || d === smashTarget?.ref) continue;
          const dd = Math.hypot(d.x - atk.x, d.y - atk.y);
          if (dd < atk.radius + 26 && dd > 1) {
            const push = 8 + this.rng() * 14;
            d.x = Math.min(t.x + t.w - 24, Math.max(t.x + 24, d.x + ((d.x - atk.x) / dd) * push));
            d.y = Math.min(t.y + t.h - 24, Math.max(t.y + 24, d.y + ((d.y - atk.y) / dd) * push));
            d.rot = (d.rot ?? 0) + (this.rng() - 0.5) * 0.9;
          }
        }
        // Dad's newspaper comes down a second time (spec 2.7).
        if (atk.secondPending) {
          const { owner, x, y } = atk;
          const target = smashTarget;
          this.queueEvent(TAUNT.doubleGap, () => {
            const second = this.director.startAttack(owner, x, y, this.elapsed, { target, noWeapon: true });
            second.radius = 65;
            second.dur = 0.5;
            second.pairId = atk.id;
            this.sound.warn();
          });
          atk.pairId = atk.id;
        }
      }
    }
  }

  gradeDodge(atk) {
    // P1-1: graded by the PRESS — the time left when the flash fired
    // under this warning — not by the last frame the fly sat inside.
    // The old "iframes up = PERFECT" shortcut made the last ~180ms all
    // PERFECT; it is gone. Only a fly that never flashed (a wander-out
    // kept for safety) falls back to its exit frame.
    const remainMs = atk.flashRemainMs ?? atk.remainMs ?? atk.dur * 1000;
    let rating = RATINGS[RATINGS.length - 1];
    const perfectWindow = atk.finale ? FINALE_PERFECT_MS : RATINGS[0].maxRemainMs;
    // P0-2: while the early mercy lasts, Close forgives 260ms.
    const closeWindow = this.elapsed < V3.mercyUntil ? V3.closeEarlyMs : RATINGS[1].maxRemainMs;
    for (const r of RATINGS) {
      const win = r.id === 'perfect' ? perfectWindow : r.id === 'close' ? closeWindow : r.maxRemainMs;
      if (remainMs <= win) {
        rating = r;
        break;
      }
    }
    if (atk.tutorial === 'nose') rating = RATINGS[0]; // the scripted first one is always PERFECT
    const mCombo = comboMult(this.combo);
    let gained = 100 * rating.mult * mCombo * (this.tier.id !== 'plain' ? 1.1 : 1);
    // P1-4: the bet the fly flashed away with multiplies the grade.
    if (!atk.finale && this.betAtFlash > 0) gained *= 1 + V3.betMultPer * this.betAtFlash;
    this.betAtFlash = 0;
    if (rating.id === 'perfect') gained += 50;
    if (this.blackoutT > 0) gained *= 1.5;
    gained = Math.round(gained);
    if (atk.finale) {
      // The finale pays its own way (2000 x rating x capped M_combo) in
      // finaleExplosion; record the grade and take no dodge points.
      // v7 #7: one rule everywhere — score with the combo as it stood
      // BEFORE this dodge's +1 (as every normal dodge already does).
      atk.finaleRatingMult = rating.mult;
      atk.finaleRatingId = rating.id;
      atk.finaleCombo = this.combo;
      gained = 0;
    }
    this.score += gained;

    // Feedback per the spec's table (3.4).
    if (rating.id === 'close') {
      this.slowmoT = Math.max(this.slowmoT, 0.15);
      this.slowmoVal = 0.5;
      this.shakeAmp = Math.max(this.shakeAmp, 5);
    } else if (rating.id === 'perfect') {
      this.freezeT = Math.max(this.freezeT, 0.1);
      this.slowmoT = Math.max(this.slowmoT, 0.35);
      this.slowmoVal = 0.3;
      this.shakeAmp = Math.max(this.shakeAmp, 8);
      this.whiteFlashT = 0.1;
      this.zoomT = 0.3;
      this.zoomAmp = 0.04;
      this.sound.perfect();
    } else if (rating.id === 'good') {
      this.sound.rating('good');
    }
    if (rating.id === 'close') this.sound.rating('close');

    if (rating.id === 'close' || rating.id === 'perfect') {
      this.director.nearMisses++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.lastGoodClock = this.clock;
      this.decayDeadline = this.clock + COMBO.decayAfter;
      this.decayAcc = 0;
      const tier = this.tier;
      if (tier.id !== this.lastTier) {
        this.lastTier = tier.id;
        this.tierPopT = 0.35;
        this.freezeT = Math.max(this.freezeT, 0.08);
        // Design #5: a transformation must be impossible to miss — a
        // big label, a tier-coloured shockwave, a spray of sparks, a
        // jolt, and the HUD says it too.
        const tierColor = { gold: '#FFC94A', flame: '#FF5A4E', rainbow: '#FF3FA4' }[tier.id] ?? '#FFC94A';
        this.floatText(this.fly.x, this.fly.y - 48, tier.label, tierColor, 44);
        this.burst(this.fly.x, this.fly.y, 28, tierColor, 260, 3.6, 0.7, 120);
        this.burst(this.fly.x, this.fly.y, 12, '#FFFFFF', 180, 2.4, 0.5, 120);
        this.tierRing = { t: 0, color: tierColor };
        this.shakeAmp = Math.max(this.shakeAmp, 5);
        this.whiteFlashT = Math.max(this.whiteFlashT, 0.06);
        this.hud.announce(tier.label, 1.2);
        this.sound.comboUp();
        if (tier.id === 'rainbow') this.unlock('rainbowFly');
      }
    } else if (rating.id === 'good') {
      this.lastGoodClock = this.clock;
      this.decayDeadline = this.clock + COMBO.decayAfter;
      this.decayAcc = 0;
    }
    if (rating.id === 'perfect' && this.blackoutT > 0) this.unlock('blackoutPerfect');
    // Dad's double: both halves Close or better pays a bonus.
    if (atk.pairId) {
      this.pairRatings ??= new Map();
      const prev = this.pairRatings.get(atk.pairId);
      if (prev && (prev === 'close' || prev === 'perfect') && (rating.id === 'close' || rating.id === 'perfect')) {
        this.score += 300;
        this.floatText(atk.x, atk.y - 70, this.copy.ratingLabel('double'), '#3FE0FF', 30);
      }
      this.pairRatings.set(atk.pairId, rating.id);
    }
    const label = this.copy.ratingLabel(rating.id);
    if (label) {
      const colors = { perfect: '#FF3FA4', close: '#3FE0FF', good: '#5FD3B5', early: '#bdb2a0' };
      const sizes = { perfect: 46, close: 34, good: 26, early: 18 };
      this.floatText(this.fly.x, this.fly.y - 34, label, colors[rating.id], sizes[rating.id]);
    }
    if (gained > 0) this.floatText(atk.x, atk.y + 40, `+${gained}`, '#FFC94A', 21, { flyTo: true });
  }

  hitFly(atk) {
    const tutorial = !!atk.tutorial;
    // P0-2: in the first 30 seconds a splat costs the combo and a
    // tenth of the score — never a heart. The party still has its
    // second act to show the reviewer.
    const mercy = !tutorial && this.elapsed < V3.mercyUntil;
    this.bet = 0;
    this.betAtFlash = 0;
    if (!tutorial) {
      if (this.combo > 0 && this.tier.id !== 'plain') this.sound.poof();
      this.combo = 0;
      this.lastTier = 'plain';
      if (mercy) {
        this.score = Math.floor(this.score * V3.mercyScoreKeep);
      } else {
        this.hp--;
      }
    }
    this.fly.squash();
    this.sound.splat();
    this.freezeT = Math.max(this.freezeT, 0.15);
    this.shakeAmp = Math.max(this.shakeAmp, 12);
    this.redFlashT = 0.3;
    if (mercy) {
      this.floatText(this.fly.x, this.fly.y - 34, 'Lucky fly!', '#5FD3B5', 28);
      this.sound.lucky();
    } else {
      this.floatText(this.fly.x, this.fly.y - 30, this.copy.ratingLabel('splat'), '#FF5A4E', 32);
    }
    if (this.hp <= 0 && !tutorial) {
      this.endReason = 'GAME OVER';
      this.resultsAt = this.clock + 1.0;
    }
  }

  // --- the chain engine (spec 2.5) ----------------------------------------

  addChaos(points, depth, x, y) {
    const chainMult = 1 + 0.5 * (depth - 1);
    const gained = Math.round(points * chainMult * comboMult(this.combo));
    this.score += gained;
    this.chaosTotal += points * chainMult;
    this.ruinMilestoneCheck();
    // Every smashed layer sprays harvestable crumbs (P1-2).
    this.spawnCrumbs(x, y, depth);
    if (depth >= 2) {
      this.longestChain = Math.max(this.longestChain, depth);
      this.chainPop = { n: depth, t: 0 };
      if (depth >= 5) this.unlock('dominoDinner');
      this.sound.chain();
    }
    // P0-2: a chain that reaches x3 refunds a heart — wrecking the
    // party *is* the survival strategy. Once per chain root.
    if (depth >= V3.chainHealDepth) {
      if (!this.chainCounted) {
        this.chainCounted = true;
        this.chain3Count++;
      }
      if (!this.chainHealUsed) {
        this.chainHealUsed = true;
        if (this.hp < GAME.hp && this.tutorial === 'done') {
          this.hp++;
          this.floatText(this.fly.x, this.fly.y - 52, '+1 HP', '#FF5A4E', 24);
          this.sound.ding();
        }
      }
    }
    this.floatText(x, y - 18, `+${gained}`, '#FFC94A', 19, { flyTo: true });
    return gained;
  }

  // v7 #4: PARTY RUINED pays out as it fills — a flat bonus at
  // 25/50/75/100%, each with a banner and a jolt.
  ruinMilestoneCheck() {
    const ms = GAME.ruinMilestones;
    while (this.ruinStep < ms.length && this.destruction01 >= ms[this.ruinStep].at) {
      const m = ms[this.ruinStep++];
      this.score += m.bonus;
      const pct = Math.round(m.at * 100);
      this.floatText(VIEW.width / 2, 268, `PARTY ${pct}% RUINED! +${m.bonus}`, pct >= 100 ? '#FF3FA4' : '#FFC94A', pct >= 100 ? 40 : 32);
      this.shakeAmp = Math.max(this.shakeAmp, pct >= 100 ? 10 : 6);
      this.sound.ding();
    }
  }

  quipAt(human, text) {
    this.floatText(human.x, human.y - 78, text, '#ffffff', 22, { bubble: true });
  }

  // --- directional chain geometry (v3 P1-1) -------------------------
  // Derivations fly *away from the impact*: drag the hand to the far
  // side of the soup and the splash finds a different face. The
  // renderer previews these exact helpers, so what you see aimed is
  // what goes off. Only the deepest layers keep their dice.

  // Soup splashes through the bowl, away from the slap's centre:
  // the face nearest the splash line, with the bowl's nearest face
  // as a fallback (the family sits far from the soup).
  splashVictim(soup, atk) {
    const dx = soup.x - atk.x;
    const dy = soup.y - atk.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = soup.x + (dx / len) * 120;
    const py = soup.y + (dy / len) * 120;
    let best = null;
    let bd = Infinity;
    for (const h of this.table.humans) {
      const d = Math.hypot(h.x - px, h.y - py);
      if (d < bd) { bd = d; best = h; }
    }
    if (bd < 240) return best;
    best = null;
    bd = Infinity;
    for (const h of this.table.humans) {
      const d = Math.hypot(h.x - soup.x, h.y - soup.y);
      if (d < bd) { bd = d; best = h; }
    }
    return bd < 350 ? best : null;
  }

  // Cutlery launches along impact-centre -> cutlery, kept on the cloth.
  cutleryLanding(item, atk) {
    const dx = item.x - atk.x;
    const dy = item.y - atk.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = this.table.rect;
    return {
      x: Math.min(t.x + t.w - 16, Math.max(t.x + 16, item.x + (dx / len) * 260)),
      y: Math.min(t.y + t.h - 16, Math.max(t.y + 16, item.y + (dy / len) * 260)),
    };
  }

  // A flying dish lands on the head nearest its escape line.
  foodHatVictim(food, atk) {
    const dx = food.x - atk.x;
    const dy = food.y - atk.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = food.x + (dx / len) * 150;
    const py = food.y + (dy / len) * 150;
    let best = null;
    let bd = Infinity;
    for (const h of this.table.humans) {
      const d = Math.hypot(h.x - px, h.y - py);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  // Every impact leaves its mark on the cloth (v3 art): a stain
  // decal in the spilt thing's colour, seeded rotation and scale,
  // capped at 30 — the table visibly dirties as the run goes on
  // and stays dirty behind the results screen.
  addStain(x, y, targetKind) {
    // Stains belong on the cloth; a slap that lands on a head at
    // the table's edge leaves its mark on the face, not the floor.
    const t = this.table.rect;
    if (x < t.x - 6 || x > t.x + t.w + 6 || y < t.y - 6 || y > t.y + t.h + 6) return;
    const byKind = { soup: 'stain-soup', cake: 'stain-cream', cup: 'stain-cyan', teacup: 'stain-cyan' };
    const kinds = ['stain-soup', 'stain-cream', 'stain-cyan'];
    const kind = byKind[targetKind] ?? kinds[Math.floor(this.rng() * kinds.length)];
    const base = { 'stain-soup': 124, 'stain-cream': 114, 'stain-cyan': 88 }[kind];
    this.stains.push({ kind, x, y, rot: this.rng() * Math.PI * 2, w: base * (0.8 + this.rng() * 0.4) });
    if (this.stains.length > 30) this.stains.shift();
  }

  // Fire one object's chain event. depth starts at 1 for the thing
  // directly under the hand.
  smash(target, atk, depth) {
    // P1-3: spec 2.5 — a chain is at most 5 layers deep.
    if (depth > CHAIN_MAX_DEPTH) return;
    const { x, y } = atk;
    this.addStain(x, y, target.kind);
    // A dish wrecked right in front of someone is a wrong done to
    // them personally (v5): the nearest face takes offence. The
    // soup has its own victim geometry inside eventSoup, and a
    // head is provoked directly in eventHead.
    if (target.kind === 'greens' || target.kind === 'chicken' || target.kind === 'cake') {
      const near = this.director.nearestHuman(target.x, target.y);
      if (near) this.provoke(near);
      // Design P1: the dish in front of you smashed is a shock. The
      // birthday cake is special — Timmy is about to cry, not fight.
      const timmy = this.table.humans[2];
      if (target.kind === 'cake') this.shock(timmy, 'scared');
      else if (near) this.shock(near, 'angry');
    }
    switch (target.kind) {
      case 'head': return this.eventHead(target.ref, atk, depth);
      case 'soup': return this.eventSoup(target.ref, atk, depth);
      case 'fork':
      case 'knife': return this.eventCutlery(target.ref, atk, depth);
      case 'cup':
      case 'teacup': return this.eventCup(target.ref, atk, depth);
      case 'greens':
      case 'chicken': return this.eventFoodHat(target.ref, target.kind, atk, depth);
      case 'cake': return this.eventCake(target.ref, atk, depth);
      case 'dog': return this.eventDog(atk, depth);
      default: {
        // Plates, bowls, the teapot and the rest: honest breakage.
        if (target.ref) {
          target.ref.state = 'smashed';
          target.ref.stateT = 0;
          this.addChaos(40, depth, x, y);
          this.burst(x, y, 12, '#f0ead8', 130, 2.6, 0.5, 600);
          // Tableware smashed in front of someone (v5): the
          // nearest face takes offence at the wreckage too.
          const near = this.director.nearestHuman(target.ref.x, target.ref.y);
          if (near) this.provoke(near);
        }
      }
    }
  }

  eventHead(h, atk, depth, bypassCd = false) {
    // P1-3: the brawl derivation re-enters here directly (not via
    // smash), so the depth cap is enforced here too.
    if (depth > CHAIN_MAX_DEPTH) return;
    if (!bypassCd && !this.eventReady(h, EVENTS.head.cooldown)) return;
    this.addChaos(EVENTS.head.chaos, depth, h.x, h.y);
    h.palmPrint = true;
    h.expression = 'slapped';
    h.exprT = 1.2;
    h.slapT = MOOD.slapStretchTime; // the 1.3x-wide face springs back over 0.4s
    this.provoke(h);
    this.gloatAt(h);
    h.stateT = 0;
    this.events.palmPrint = true;
    this.burst(h.x, h.y, 10, 'rgba(240,180,120,0.9)', 90, 2.4, 0.4, 300);
    const selfHit = atk.owner === h;
    this.quipAt(h, this.copy.quipFor(selfHit ? 'selfOwn' : 'head'));
    if (selfHit && h.name === 'Dad') this.unlock('dadSlapsDad');
    if (h.name === 'Dad' && !h.glassesOff) {
      h.glassesOff = true;
      this.events.glasses = true;
      this.flyProjectile('glasses', h.x, h.y, h.x - 110, h.y - 120);
    }
    if (h.name === 'Grandpa' && !h.denturesOut) {
      // E5: the dentures go on a bouncing tour of the table.
      h.denturesOut = true;
      this.events.dentures = true;
      this.addChaos(EVENTS.dentures.chaos, depth, h.x, h.y);
      this.quipAt(h, this.copy.quipFor('dentures'));
      this.unlock('runawayDentures');
      this.denturesTour(h, depth);
    }
    // Derivation (40%): the neighbour takes offence and slaps back.
    if (this.rng() < 0.4) {
      const idx = this.table.humans.indexOf(h);
      const neighbour = this.table.humans[(idx + 1) % this.table.humans.length];
      this.queueEvent(0.3, () => {
        if (this.state !== 'playing') return;
        this.provoke(neighbour);
        this.brawlCount++;
        if (this.brawlCount >= 3) this.unlock('familyBrawl');
        this.quipAt(neighbour, this.copy.quipFor('brawl'));
        this.eventHead(h, { ...atk, owner: neighbour }, depth + 1, true);
      });
    }
  }

  denturesTour(h, depth) {
    // Three bounces, each a small impact that can set off whatever
    // it lands on (50% each).
    let px = h.x;
    let py = h.y;
    for (let i = 0; i < 3; i++) {
      const nx = px + (this.rng() - 0.3) * 220;
      const ny = py + (this.rng() - 0.5) * 200;
      const fx = nx;
      const fy = ny;
      this.queueEvent(0.28 * (i + 1), () => {
        this.flyProjectile('dentures', px, py, fx, fy);
        this.burst(fx, fy, 5, '#ffffff', 60, 2, 0.3, 400);
        if (this.rng() < 0.5) {
          const prop = this.table.propAt(fx, fy);
          if (prop && prop.kind !== 'head') this.smash(prop, { x: fx, y: fy, owner: h }, depth + 1);
        }
      });
      px = nx;
      py = ny;
    }
    this.queueEvent(0.28 * 4, () => this.landedProps.push({ kind: 'dentures', x: px, y: py, rot: 0.4 }));
  }

  eventSoup(soup, atk, depth) {
    if (!this.eventReady(soup, EVENTS.soup.cooldown)) return;
    this.addChaos(EVENTS.soup.chaos, depth, soup.x, soup.y);
    soup.state = 'empty';
    soup.stateT = 0;
    this.soupRefillAt = this.clock + EVENTS.soup.cooldown;
    this.burst(soup.x, soup.y, 26, '#E8743B', 190, 3.4, 0.7, 600);
    this.burst(soup.x, soup.y, 10, '#FFC94A', 140, 2.4, 0.6, 600);
    // The splash flies away from the slap's centre (P1-1): which
    // face it finds is a matter of where the hand came down.
    const best = this.splashVictim(soup, atk);
    if (best) {
      best.soupFace = true;
      best.blockedT = Math.max(best.blockedT, 3); // standing, dripping, useless
      // A face full of soup is furious, not startled (v5). The
      // expression is decided by expressionLogic from these timers
      // (P1-4: the direct `expression = 'angry'` here was overwritten
      // next frame anyway and is gone).
      best.stateT = 0;
      this.shock(best, 'angry');
      this.provoke(best);
      this.gloatAt(best);
      this.events.soupFace = true;
      this.quipAt(best, this.copy.quipFor('soup', best.name));
      if (best.name === 'Mom') this.unlock('soupBun');
      // Derivation: the victim bumps the table; something hops.
      this.queueEvent(0.3, () => {
        const fresh = this.table.dressing.filter((d) => d.state === 'fresh');
        if (fresh.length) {
          const d = fresh[Math.floor(this.rng() * fresh.length)];
          d.hopT = 0.35;
          this.burst(d.x, d.y - 6, 4, 'rgba(200,170,120,0.8)', 50, 2, 0.3, 400);
        }
      });
    }
  }

  eventCutlery(item, atk, depth) {
    if (!this.eventReady(item, EVENTS.cutlery.cooldown)) return;
    this.addChaos(EVENTS.cutlery.chaos, depth, item.x, item.y);
    item.state = 'smashed'; // airborne, then gone from its spot
    item.stateT = 0;
    this.events.forkChain = true;
    this.floatText(item.x, item.y - 30, this.copy.quipFor('cutlery'), '#ffffff', 21, { bubble: true });
    // Derivation (P1-1): the fork flies along impact-centre ->
    // fork, and whatever sits at the end of that line is next. If
    // the line carries it past the chandelier, the lamp takes it.
    const { x: lx, y: ly } = this.cutleryLanding(item, atk);
    const lamp = this.table.lamp;
    const segLen = Math.hypot(lx - item.x, ly - item.y) || 1;
    const tt = Math.max(0, Math.min(1, ((lamp.x - item.x) * (lx - item.x) + (lamp.y - item.y) * (ly - item.y)) / (segLen * segLen)));
    const lampDist = Math.hypot(lamp.x - (item.x + (lx - item.x) * tt), lamp.y - (item.y + (ly - item.y) * tt));
    if (lampDist < 80 && !this.table.lampDropped && this.eventCd.get('lamp') === undefined) {
      this.flyProjectile('fork-bent', item.x, item.y, lamp.x, lamp.y, () => this.eventLamp(depth + 1));
    } else {
      const rot = Math.atan2(ly - item.y, lx - item.x);
      this.flyProjectile('fork-bent', item.x, item.y, lx, ly, () => {
        const prop = this.table.propAt(lx, ly);
        if (prop) {
          if (prop.kind === 'cake') this.unlock('forkCake');
          this.smash(prop, { x: lx, y: ly, owner: atk.owner }, depth + 1);
        } else {
          this.landedProps.push({ kind: 'fork-bent', x: lx, y: ly, rot });
        }
      });
    }
  }

  eventLamp(depth) {
    if (depth > CHAIN_MAX_DEPTH || this.table.lampDropped) return;
    this.eventCd.set('lamp', Infinity);
    this.addChaos(EVENTS.lamp.chaos, depth, this.table.lamp.x, this.table.lamp.y + 30);
    this.table.lampSwingT = 3;
    this.floatText(this.table.lamp.x, this.table.lamp.y + 52, this.copy.quipFor('lamp'), '#ffffff', 22, { bubble: true });
    // Derivation (15%): it comes down on the table's centre.
    if (this.rng() < 0.15) {
      this.queueEvent(0.3, () => {
        this.table.lampDropped = true;
        this.unlock('chandelierDrop');
        this.floatText(this.table.lamp.x, this.table.lamp.y + 52, this.copy.quipFor('lampDrop'), '#ffffff', 22, { bubble: true });
        const t = this.table.rect;
        const prop = this.table.propAt(t.x + t.w / 2, t.y + t.h / 2);
        if (prop) this.smash(prop, { x: t.x + t.w / 2, y: t.y + t.h / 2, owner: null }, depth + 1);
        this.shakeAmp = Math.max(this.shakeAmp, 8);
      });
    }
  }

  eventCup(cup, atk, depth) {
    if (!this.eventReady(cup, EVENTS.cup.cooldown)) return;
    this.addChaos(EVENTS.cup.chaos, depth, cup.x, cup.y);
    cup.state = 'smashed';
    cup.stateT = 0;
    this.puddle = { x: cup.x, y: cup.y, t: 3 };
    this.burst(cup.x, cup.y, 12, '#c98a3d', 130, 2.4, 0.5, 600);
    this.floatText(cup.x, cup.y - 28, this.copy.quipFor('cup'), '#ffffff', 20, { bubble: true });
  }

  eventFoodHat(food, kind, atk, depth) {
    if (!this.eventReady(food, EVENTS.food.cooldown)) return;
    this.addChaos(EVENTS.food.chaos, depth, food.x, food.y);
    food.state = 'smashed';
    food.stateT = 0;
    this.burst(food.x, food.y, 18, food.color, 160, 3, 0.6, 600);
    // The dish lands on a head, as a hat — the one nearest its
    // escape line away from the impact (P1-1).
    const best = this.foodHatVictim(food, atk);
    if (best) {
      const victim = best;
      this.flyProjectile(kind === 'greens' ? 'greens' : 'chicken', food.x, food.y, victim.x, victim.y - 20, () => {
        victim.hatKind = kind;
        victim.stateT = 0;
        // Wearing dinner is a wrong in person (v5), quite apart
        // from the coin-flip brawl derivation below.
        this.provoke(victim);
        this.quipAt(victim, this.copy.quipFor(kind === 'greens' ? 'foodHat' : 'chickenHat'));
        // Derivation (50%): wearing dinner counts as being slapped.
        if (this.rng() < 0.5) this.queueEvent(0.3, () => this.eventHead(victim, atk, depth + 1));
      });
    }
  }

  eventCake(cake, atk, depth) {
    if (atk.finale) return; // the finale has its own resolution
    if (!this.eventReady(cake, EVENTS.candle.cooldown)) return;
    this.addChaos(EVENTS.candle.chaos, depth, cake.x, cake.y);
    // E9: one candle out, a little cream, the cake itself stands.
    if (cake.candlesLit > 0) cake.candlesLit--;
    cake.creamSplats++;
    cake.stateT = 0;
    this.burst(cake.x, cake.y, 14, '#FFD1DC', 140, 2.8, 0.55, 600);
    this.floatText(cake.x, cake.y - 60, this.copy.quipFor('candle'), '#ffffff', 21, { bubble: true });
  }

  eventDog(atk, depth) {
    if (!this.dog || this.dog.state !== 'idle') return;
    this.addChaos(EVENTS.dog.chaos, depth, this.dog.x, this.dog.y);
    this.unlock('dogTable');
    this.floatText(this.dog.x, this.dog.y - 44, this.copy.quipFor('dog'), '#ffffff', 22, { bubble: true });
    // The dog bolts across the table with the chicken, knocking
    // everything it passes (80% each).
    this.dog.state = 'run';
    this.dog.dirX = this.dog.x < 640 ? 1 : -1;
    const chicken = this.table.foods[3];
    if (chicken.state === 'fresh') {
      chicken.state = 'smashed';
      chicken.stateT = 0;
    }
  }

  finaleExplosion(atk, dodged) {
    const cake = this.table.foods[2];
    cake.state = 'smashed';
    cake.stateT = 0;
    this.finaleDone = true;
    this.events.cakeBoom = true;
    this.burst(cake.x, cake.y, 40, '#FFFFFF', 300, 4.2, 0.9, 600);
    this.burst(cake.x, cake.y, 40, '#FFD1DC', 260, 3.6, 0.85, 600);
    this.burst(cake.x, cake.y, 20, '#FF5A4E', 200, 3, 0.7, 600);
    this.slowmoT = Math.max(this.slowmoT, 1.0);
    this.slowmoVal = 0.4;
    this.whiteFlashT = 0.16;
    this.shakeAmp = 18;
    this.zoomT = 0.45;
    this.zoomAmp = 0.08;
    this.sound.explosion();
    if (dodged) {
      // gradeDodge already ran for the finale attack and used the
      // widened window; the finale's own score lands here.
      const ratingMult = atk.finaleRatingMult ?? 1;
      // v7 #2 / #7: combo as it stood before the finale dodge, capped x2.
      const mCombo = Math.min(GAME.finaleComboCap, comboMult(atk.finaleCombo ?? this.combo));
      const gained = Math.round(GAME.finaleBase * ratingMult * mCombo);
      this.score += gained;
      this.floatText(cake.x, cake.y - 96, this.copy.quipFor('finalePerfect'), '#FF3FA4', 40);
      this.floatText(cake.x, cake.y + 60, `+${gained}`, '#FFC94A', 26, { flyTo: true });
      if (atk.finaleRatingId === 'perfect') this.unlock('cakePocalypse');
    } else {
      this.score += GAME.finaleSplatScore;
      this.floatText(cake.x, cake.y - 96, this.copy.finale.splatButCake.draw(), '#ffffff', 24, { bubble: true });
    }
    this.resultsAt = this.clock + 2.2;
    this.endReason = "TIME'S UP!";
  }

  // --- landing & taunting (spec 3.3 / 2.2) ---------------------------------

  landingLogic(dt) {
    const fly = this.fly;
    // What's under the fly? The dog outranks the dishes.
    let zone = null;
    if (this.dog && this.dog.state === 'idle' && Math.hypot(fly.x - this.dog.x, fly.y - this.dog.y) < 46) {
      zone = { kind: 'dog', ref: this.dog, x: this.dog.x, y: this.dog.y, r: 34 };
    } else {
      zone = this.table.propAt(fly.x, fly.y);
    }
    this.hoverZone = zone && fly.landedOn !== zone ? zone : null;

    const canLand = zone && fly.speed < FLY.landSpeed && !fly.flashing && fly.squashT <= 0;
    if (canLand) {
      this.landClock += dt;
      if (this.landClock >= FLY.landTime && fly.landedOn !== zone) {
        fly.landedOn = zone;
        this.tauntClock = 0;
        this.sound.land();
      }
    } else {
      this.landClock = 0;
      if (fly.landedOn && (!zone || fly.landedOn !== zone || fly.speed > FLY.landSpeed * 1.6)) {
        fly.landedOn = null;
        this.tauntClock = 0;
        this.bet = 0; // drifting off spends nothing — the bet dies (P1-4)
      }
    }

    // The taunt itself: sit, rub hands, wait out the delay, and
    // somebody's patience snaps.
    if (fly.landedOn && this.tutorial === 'done') {
      this.idleClock = 0;
      this.tauntClock += dt;
      const timing = timingAt(this.elapsed);
      const finale = this.finaleArmed && fly.landedOn.kind === 'cake' && !this.finaleTriggered;
      // P0-3: the finale ignores the slot cap, the doorbell and every
      // personal cooldown — it must fire the moment the fly sits down.
      const slotOk = finale || (this.director.freeSlot(this.elapsed) && this.doorbellT <= 0);
      if (this.tauntClock >= timing.tauntDelay && slotOk) {
        const target = fly.landedOn;
        const owner = finale
          ? this.director.nearestHuman(target.x, target.y, false)
          : target.kind === 'head'
            ? (target.ref.cooldownT <= 0 && target.ref.blockedT <= 0 ? target.ref : this.director.nearestHuman(target.x, target.y, true))
            : this.director.nearestHuman(target.x, target.y, true);
        if (owner) {
          this.tauntClock = 0;
          const atk = this.director.startAttack(owner, target.x, target.y, this.elapsed, { target, finale });
          if (this.table.lampSwingT > 0 && !finale) atk.dur += 0.3; // E4's wobble buys everyone time
          if (finale) {
            this.finaleTriggered = true;
            this.hud.announce(this.copy.finale.allHands.draw(), 1.2);
            // ALL HANDS ON DECK: the other three family members bring
            // their palms down on the cake in sync. They are drawn like
            // any palm but resolve nothing — the owner's attack alone
            // judges the dodge and blows up the cake.
            for (const h of this.table.humans) {
              if (h === owner) continue;
              const extra = this.director.startAttack(h, target.x, target.y, this.elapsed, { target, finale: true });
              extra.decor = true;
              extra.dur = atk.dur;
              extra.t = atk.t;
            }
          }
          this.sound.warn();
          if (atk.kind === 'spray') this.sound.sprayWarn();
        }
      }
    } else if (this.tutorial === 'done') {
      // Idle punishment (spec 2.2): hover smugly for 3s and the
      // nearest free human slaps at the empty air where you float.
      const anyWarning = this.director.attacks.some((a) => a.state === 'warning');
      if (!anyWarning) {
        this.idleClock += dt;
        if (this.idleClock >= TAUNT.idleAfter && this.director.freeSlot(this.elapsed) && this.doorbellT <= 0) {
          this.idleClock = 0;
          const owner = this.director.nearestHuman(fly.x, fly.y, true);
          if (owner) {
            this.director.startAttack(owner, fly.x, fly.y, this.elapsed, { idle: true, warnScale: TAUNT.idleWarnScale, noWeapon: true });
            this.sound.warn();
          }
        }
      } else {
        this.idleClock = 0;
      }
    }
  }

  comboLogic(dt) {
    // Decay (spec 2.4): the fuse runs to decayDeadline — 4s after
    // the last Good+ dodge, pushed later by every crumb eaten
    // (P1-2) — then -1 per 0.8s.
    if (this.combo <= 0) return;
    if (this.clock <= this.decayDeadline) {
      this.decayAcc = 0;
      return;
    }
    this.decayAcc += dt;
    if (this.decayAcc >= COMBO.decayStep) {
      this.decayAcc = 0;
      const before = this.tier.id;
      this.combo--;
      if (this.tier.id !== before) {
        this.lastTier = this.tier.id;
        this.sound.poof();
        this.burst(this.fly.x, this.fly.y, 10, '#ffd94d', 80, 2.4, 0.4, 200);
      }
      if (this.combo === 0) this.floatText(this.fly.x, this.fly.y - 30, 'Combo lost', '#bdb2a0', 19);
    }
  }

  // --- the dog (random event, E6) ------------------------------------------

  dogLogic(dt) {
    if (!this.dog) return;
    const dog = this.dog;
    dog.t -= dt;
    if (dog.state === 'idle') {
      // Amble toward the chicken.
      const chicken = this.table.foods[3];
      const dx = chicken.x - dog.x;
      const dy = chicken.y - dog.y;
      const d = Math.hypot(dx, dy);
      if (d > 30) {
        dog.x += (dx / d) * 26 * dt;
        dog.y += (dy / d) * 26 * dt;
      }
      if (dog.t <= 0) this.dog = null; // wandered off, unbothered
    } else if (dog.state === 'run') {
      dog.x += dog.dirX * 520 * dt;
      dog.checkT -= dt;
      if (dog.checkT <= 0) {
        dog.checkT = 0.09;
        const prop = this.table.propAt(dog.x, dog.y);
        if (prop && prop.kind !== 'dog' && this.rng() < 0.8) {
          this.smash(prop, { x: dog.x, y: dog.y, owner: null }, 1);
        }
      }
      if (dog.x < -60 || dog.x > VIEW.width + 60) this.dog = null;
    }
  }

  // --- phases, weapons, random events, the finale ---------------------------

  phaseLogic() {
    const e = this.elapsed;
    if (this.tutorial !== 'done') return;
    if (!this.weaponFlags.spray && e >= TAUNT.sprayAt) {
      this.weaponFlags.spray = true;
      this.hud.announce(this.copy.weapon.spray.draw(), 2.2);
      this.sound.ding();
    }
    if (!this.weaponFlags.swatter && e >= TAUNT.swatterAt) {
      this.weaponFlags.swatter = true;
      this.hud.announce(this.copy.weapon.swatter.draw(), 2.2);
      this.sound.ding();
    }
    if (!this.weaponFlags.late && e >= TAUNT.doubleAt) {
      this.weaponFlags.late = true;
      this.hud.announce(this.copy.weapon.allUp.draw(), 2.2);
      this.sound.ding();
      this.sound.startSong();
    }
    // v7 #5: at 55s Mom brings seconds — every wrecked dish and prop
    // comes back where it was, once. No new art: the fresh sprites
    // simply return, with a banner line.
    if (!this.restocked && e >= GAME.restockAt) {
      this.restocked = true;
      this.restock();
    }
    // Random events on the spec's schedule (2.8).
    if (this.randomIdx < RANDOM_EVENTS.times.length && e >= RANDOM_EVENTS.times[this.randomIdx]) {
      this.randomIdx++;
      this.fireRandomEvent();
    }
    if (this.finaleArmed && !this.finaleAnnounced) {
      this.finaleAnnounced = true;
      this.hud.announce(this.copy.finale.awaits.draw() + ' Land on it. If you dare.', 2.6);
    }
    if (e >= PHASES.finaleTriggerBy && !this.finaleTriggered && !this.finaleDone) {
      // 89s and nobody took the bait: the family does it themselves.
      this.finaleTriggered = true;
      const cake = this.table.foods[2];
      cake.state = 'smashed';
      cake.stateT = 0;
      this.finaleDone = true;
      this.events.cakeBoom = true;
      this.burst(cake.x, cake.y, 34, '#FFD1DC', 240, 3.6, 0.8, 600);
      this.hud.announce(this.copy.finale.missed.draw() + ' The cake collapsed without you.', 2.4);
      this.sound.explosion();
    }
  }

  restock() {
    let n = 0;
    for (const f of this.table.foods) {
      if (f.id === 'cake') continue; // the cake is saved for the finale
      if (f.state !== 'fresh') {
        f.state = 'fresh';
        f.stateT = 0;
        n++;
      }
    }
    for (const d of this.table.dressing) {
      if (d.state !== 'fresh') {
        d.state = 'fresh';
        d.stateT = 0;
        n++;
      }
    }
    // Bent forks lying where they landed would double up with the
    // restored ones.
    this.landedProps = this.landedProps.filter((p) => p.kind !== 'fork-bent');
    if (n > 0) {
      this.floatText(VIEW.width / 2, 330, 'Mom brings seconds!', '#FFFFFF', 28);
      this.burst(this.table.foods[1].x, this.table.foods[1].y, 10, '#FFFFFF', 90, 2.4, 0.5, 200);
    }
  }

  fireRandomEvent() {
    const pool = RANDOM_EVENTS.pool.filter((p) => (this.randomUsed.get(p.id) ?? 0) < 2 && p.id !== this.lastRandom);
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let roll = this.rng() * total;
    let picked = pool[0];
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) {
        picked = p;
        break;
      }
    }
    this.lastRandom = picked.id;
    this.randomUsed.set(picked.id, (this.randomUsed.get(picked.id) ?? 0) + 1);
    const say = (key) => this.hud.announce(this.copy.randomEvent[key].draw(), 2.0);
    if (picked.id === 'dog') {
      say('dog');
      const t = this.table.rect;
      this.dog = { x: t.x + 30, y: t.y + t.h - 30, state: 'idle', t: 10, dirX: 1, checkT: 0 };
    } else if (picked.id === 'blackout') {
      say('blackout');
      this.blackoutT = 4;
    } else if (picked.id === 'doorbell') {
      say('doorbell');
      this.doorbellT = 2;
      this.queueEvent(2.05, () => {
        if (this.state === 'playing') this.hud.announce(this.copy.randomEvent.doorbellBack.draw(), 1.8);
      });
    } else if (picked.id === 'sneeze') {
      say('sneeze');
      const grandpa = this.table.humans[1];
      const dx = this.fly.x - grandpa.x;
      const dy = this.fly.y - grandpa.y;
      const len = Math.hypot(dx, dy) || 1;
      this.fly.vx += (dx / len) * 640;
      this.fly.vy += (dy / len) * 640;
      const cake = this.table.foods[2];
      cake.candlesLit = Math.max(0, cake.candlesLit - 2);
      this.score += 200;
      this.floatText(this.fly.x, this.fly.y - 30, '+200', '#FFC94A', 20, { flyTo: true });
      this.sound.sneeze();
    } else if (picked.id === 'photo') {
      say('photo');
      this.photoT = 1.5;
      for (const h of this.table.humans) h.blockedT = Math.max(h.blockedT, 1.5);
      this.queueEvent(1.5, () => {
        if (this.state !== 'playing') return;
        this.whiteFlashT = Math.max(this.whiteFlashT, 0.12);
        const onFace = this.table.humans.some((h) => Math.hypot(this.fly.x - h.x, this.fly.y - h.y) < h.headR);
        if (onFace) {
          this.score += 500;
          this.unlock('photobomb');
          this.floatText(this.fly.x, this.fly.y - 36, this.copy.randomEvent.photobomb.draw(), '#ffd94d', 26);
        }
      });
    }
  }

  // --- the tutorial (spec 3.5) ----------------------------------------------

  tutorialLogic(dt) {
    if (this.tutorial === 'done') return;
    const dad = this.table.humans[3];
    if (this.tutorial === 'quick') {
      if (this.tutPhase === 'nose' && this.clock > 0.4 && !this.tutAttack) {
        this.tutAttack = this.director.startAttack(dad, dad.x, dad.y, 0, { target: { kind: 'head', ref: dad, x: dad.x, y: dad.y, r: dad.headR }, noWeapon: true });
        this.tutAttack.tutorial = 'quick';
        this.sound.warn();
        this.floatText(640, 210, META.runs > 0 ? this.copy.roundIntro.draw() : '', '#ffffff', 26);
      }
      if (this.tutPhase === 'nose' && this.tutAttack && this.tutAttack.state === 'done') {
        this.tutorial = 'done';
        this.tutPhase = 'done';
        this.tutDodged = true;
        this.hintsT = 3; // design #2: the control icons, 3s
      }
      return;
    }
    // The full first-run script.
    if (this.tutPhase === 'nose') {
      dad.expression = 'angry';
      if (this.clock > 0.4 && !this.tutAttack) {
        this.tutAttack = this.director.startAttack(dad, dad.x, dad.y, 0, { target: { kind: 'head', ref: dad, x: dad.x, y: dad.y, r: dad.headR }, noWeapon: true });
        this.tutAttack.tutorial = 'nose';
        this.tutAttack.dur = 1.4;
        this.sound.warn();
      }
      if (this.tutAttack && this.tutAttack.state === 'done') {
        // Whether it landed or not, the show moves on: the soup
        // ghost path lights up. (A hit in the tutorial costs no HP —
        // hitFly knows — and Dad still wears the handprint story.)
        this.tutPhase = 'soup';
        this.tutAttack = null;
        this.tutDodged = true;
        this.ghostTarget = this.table.foods[1];
        for (const h of this.table.humans) {
          h.expression = 'scared';
          h.exprT = 1.2;
        }
      }
    } else if (this.tutPhase === 'soup') {
      const soup = this.table.foods[1];
      if (this.fly.landedOn && this.fly.landedOn.ref === soup && !this.tutAttack) {
        const mom = this.table.humans[0];
        this.tutAttack = this.director.startAttack(mom, soup.x, soup.y, 0, { target: { kind: 'soup', ref: soup, x: soup.x, y: soup.y, r: soup.r }, noWeapon: true });
        this.tutAttack.tutorial = 'soup';
        this.tutAttack.dur = 1.4;
        this.ghostTarget = null;
        this.sound.warn();
      }
      if (this.tutAttack && this.tutAttack.state === 'done') {
        if (soup.state === 'fresh' && !this.events.soupFace) {
          // The scripted splash belongs on Timmy: if the natural
          // resolution didn't produce it, stage it now.
          const timmy = this.table.humans[2];
          this.events.soupFace = true;
          timmy.soupFace = true;
          timmy.blockedT = 3;
          timmy.expression = 'angry';
          this.provoke(timmy);
          this.quipAt(timmy, this.copy.quipFor('soup', 'Timmy'));
          soup.state = 'empty';
          soup.stateT = 0;
          this.soupRefillAt = this.clock + EVENTS.soup.cooldown;
          this.addChaos(EVENTS.soup.chaos, 1, soup.x, soup.y);
          // ...and his flail knocks a fork into orbit: CHAIN x2.
          const fork = this.table.dressing.find((d) => d.kind === 'fork' && d.state === 'fresh');
          if (fork) {
            this.queueEvent(0.3, () => this.eventCutlery(fork, { x: fork.x, y: fork.y, owner: timmy }, 2));
          }
        }
        this.tutPhase = 'done';
        this.tutorial = 'done';
        this.ghostTarget = null;
        this.hintsT = 3; // design #2: the control icons, 3s
        this.hud.announce('Ruin the party!', 1.6);
        this.queueEvent(1.7, () => {
          if (this.state === 'playing') this.hud.announce('90 SECONDS. GO!', 1.4);
        });
      }
    }
  }

  // The tutorial/finale slow-motion hint the frame loop applies.
  get tsHint() {
    if (this.tutorial === 'script' && this.tutPhase === 'nose' && this.tutAttack && this.tutAttack.state === 'warning') {
      const remainMs = (this.tutAttack.dur - this.tutAttack.t) * 1000;
      // P0-2: only freeze / show the keycap while the fly is really
      // under the hand — never over an empty threat.
      const inside = this.flyInShape(this.tutAttack, this.fly.x, this.fly.y);
      this.showKeycap = inside && remainMs < 500 && !this.tutAttack.exited;
      // Near-freeze only in the last stretch, and only until the
      // dodge happens — then time snaps back (spec 3.5).
      if (inside && remainMs < 200 && !this.tutAttack.exited && !this.fly.flashing) {
        return Math.max(0.05, 0.05 + ((remainMs - 60) / 140) * 0.45);
      }
    }
    if (this.tutorial === 'script' && this.tutPhase === 'soup' && this.tutAttack && this.tutAttack.state === 'warning') {
      const remainMs = (this.tutAttack.dur - this.tutAttack.t) * 1000;
      const inside = this.flyInShape(this.tutAttack, this.fly.x, this.fly.y);
      this.showKeycap = inside && remainMs < 260 && remainMs > 120 && !this.tutAttack.exited;
      if (inside && remainMs <= 200 && !this.tutAttack.exited && !this.fly.flashing) return 0.4;
    }
    // The finale's last 400ms crawl (spec 2.9).
    const finaleAtk = this.director.attacks.find((a) => a.finale && a.state === 'warning');
    if (finaleAtk && (finaleAtk.dur - finaleAtk.t) * 1000 < 400) {
      this.showKeycap = false;
      return 0.25;
    }
    this.showKeycap = false;
    return 1;
  }

  // Being wronged, in person (v5): slapped, souped, dinner worn
  // as a hat, or the dish in front of you wrecked. The face goes
  // angry and STAYS angry — at least 4 seconds for a first
  // offence, 8 once the same person has been wronged twice.
  // angryT ticks down even while a set-piece expression holds
  // (exprT), so the set-piece's remaining time is banked on top:
  // once the scare/slap beat lets go, the full angry duration is
  // still there to be displayed. 董's playtest caught a
  // soup-faced Mom still smiling because the decal layer never
  // talked to the expression machine — this is that conversation.
  provoke(h) {
    h.annoyCount = (h.annoyCount ?? 0) + 1;
    h.annoyDecayT = 0; // P1-4: a fresh offence restarts the 10s forgiveness clock
    const dur = h.annoyCount >= 2 ? 8 : 4;
    h.angryT = Math.max(h.angryT, dur + Math.max(0, h.exprT));
  }

  // A short, loud reaction (splashed, dish wrecked in front of you).
  shock(h, expr) {
    if (!h) return;
    h.shockT = MOOD.shockTime;
    h.shockExpr = expr;
  }

  // Schadenfreude (design P1): the bystander nearest the victim laughs
  // for 1.5s — no new art, just the happy frame at the worst moment.
  gloatAt(victim) {
    let best = null;
    let bd = Infinity;
    for (const h of this.table.humans) {
      if (h === victim || h.shockT > 0 || h.exprT > 0) continue;
      const d = Math.hypot(h.x - victim.x, h.y - victim.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    if (best) best.gloatT = MOOD.gloatTime;
  }

  // The expression machine (design P1). One fixed priority ladder,
  // highest first:
  //   slapped (set-piece) > shocked (souped / dish smashed) > aiming
  //   > gloating > provoked angry > the room's default face.
  // The default face caps at SUSPICIOUS (25%+ ruined) — angry is kept
  // for faces that mean something (provoked, aiming) — except that
  // from 55s the whole room defaults to angry with steam, and from
  // 80s (the finale) everyone is terrified. Anybody wearing a decal
  // (soup, handprint, food hat) never drops below suspicious.
  expressionLogic(dt = 0) {
    const destruction = this.destruction01;
    const e = this.elapsed;
    const finale = this.tutorial === 'done' && e >= MOOD.terrifiedFrom;
    for (const h of this.table.humans) {
      // P1-4: grudges fade — annoyCount -1 per 10s with no new offence.
      h.annoyDecayT = (h.annoyDecayT ?? 0) + dt;
      if (h.annoyCount > 0 && h.annoyDecayT >= MOOD.annoyDecayEvery) {
        h.annoyCount--;
        h.annoyDecayT = 0;
      }
      h.aiming = this.director.attacks.some((a) => a.state === 'warning' && a.owner === h && !a.decor && !a.idle);
      h.steam = false;
      let expr;
      if (h.exprT > 0) {
        expr = h.expression; // a set-piece (slapped / tutorial scare) holds
      } else if (h.shockT > 0) {
        expr = h.shockExpr;
      } else if (finale) {
        expr = 'scared'; // the finale: four hands, four terrified faces
      } else if (this.photoT > 0) {
        expr = 'happy'; // say cheese (soup and all)
      } else if (h.aiming) {
        expr = 'angry';
      } else if (h.gloatT > 0) {
        expr = 'happy';
      } else if (h.angryT > 0) {
        expr = 'angry';
      } else if (this.tutorial === 'done' && e >= MOOD.steamFrom) {
        expr = 'angry';
        h.steam = true;
      } else if (destruction >= MOOD.suspiciousAt) {
        expr = 'suspicious';
      } else {
        expr = 'happy';
      }
      const decorated = h.soupFace || h.palmPrint || h.hatKind;
      if (decorated && expr === 'happy' && h.gloatT <= 0 && this.photoT <= 0) expr = 'suspicious';
      if (expr !== h.shownExpr) {
        h.popT = MOOD.popTime; // every frame change squash-bounces
        h.shownExpr = expr;
      }
      h.expression = expr;
    }
  }

  // --- results ----------------------------------------------------------------

  finish(reason = '') {
    if (this.state === 'results') return;
    this.state = 'results';
    this.finishTime = this.time;
    this.endReason = reason || this.endReason;
    this.lifeBonus = Math.max(0, this.hp) * GAME.lifeBonus;
    this.score += this.lifeBonus;
    this.sound.stopSong();
    this.sound.buzz(false);
    const rank = GAME.ranks.find((r) => this.score >= r.min) ?? GAME.ranks[GAME.ranks.length - 1];
    this.rank = rank;
    this.caption = this.copy.caption[rank.id].draw();
    // The "so close" line, by the spec's priority (2.11): one line.
    const idx = GAME.ranks.indexOf(rank);
    const nextRank = idx > 0 ? GAME.ranks[idx - 1] : null;
    const nextTier = COMBO.tiers.find((t) => t.at > this.maxCombo);
    if (nextRank && nextRank.min - this.score <= nextRank.min * 0.2) {
      this.nearMissLine = `Only ${nextRank.min - this.score} pts from ${nextRank.id} rank!`;
    } else if (nextTier && nextTier.at - this.maxCombo <= 2) {
      const names = { gold: 'GOLDEN FLY', flame: 'FIRE FLY', rainbow: 'RAINBOW FLY' };
      this.nearMissLine = `${nextTier.at - this.maxCombo} more combo to become ${names[nextTier.id]}!`;
    } else if (META.best > this.score && META.best - this.score <= META.best * 0.1) {
      this.nearMissLine = `Just ${META.best - this.score} pts short of your best!`;
    } else {
      const left = GALLERY.filter((g) => !META.gallery.has(g.id)).length;
      this.nearMissLine = left > 0 ? `${left} disasters still undiscovered...` : 'Every disaster discovered. A complete monster.';
    }
    if (this.score > META.best) {
      this.newBest = true;
      META.best = this.score;
    }
    META.runs++;
    persistMeta();
  }

  // --- ambient systems ----------------------------------------------------------

  stepFx(dt) {
    if (this.missBar) {
      this.missBar.t += dt;
      if (this.missBar.t > this.missBar.dur) this.missBar = null;
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav ?? 0) * dt;
      p.vx *= Math.exp(-2.2 * dt);
      p.vy *= Math.exp(-0.6 * dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.t += dt;
      if (t.flyTo) {
        const k = Math.min(1, t.t / 0.4);
        t.x += (VIEW.width - 110 - t.x) * k * dt * 9;
        t.y += (42 - t.y) * k * dt * 9;
      } else {
        t.y -= 30 * dt;
      }
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
    const done = [];
    for (const pr of this.projectiles) {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      pr.x = pr.fromX + (pr.toX - pr.fromX) * k;
      pr.y = pr.fromY + (pr.toY - pr.fromY) * k - Math.sin(k * Math.PI) * pr.peak;
      pr.rot += dt * 9;
      if (k >= 1) done.push(pr);
    }
    for (const pr of done) {
      this.projectiles.splice(this.projectiles.indexOf(pr), 1);
      if (pr.onArrive) pr.onArrive();
      else this.landedProps.push({ kind: pr.kind, x: pr.toX, y: pr.toY, rot: pr.rot });
    }
    for (const d of this.table.dressing) if (d.hopT) d.hopT = Math.max(0, d.hopT - dt);
    if (this.tierRing) {
      this.tierRing.t += dt;
      if (this.tierRing.t > 0.55) this.tierRing = null;
    }
  }

  draw(dt) {
    this.renderer.draw(this);
    this.hud.draw(this, dt);
  }
}

// --- boot ---------------------------------------------------------------------

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') ?? '7');
const game = new Game(canvas, Number.isFinite(seedParam) ? seedParam : 7);
window.__flyGame = game; // debug/testing hook: state reads for local checks
const input = new Input(canvas);
let runSeed = (Date.now() % 90000) + 1;
if (!shotName) game.newRun(runSeed);

if (shotName) {
  applyPose(game, shotName);
  game.draw(0);
  // The results photos load async; repaint once they arrive so a
  // posed results shot shows the real print, not the fallback.
  for (const img of [game.hud.photoClean, game.hud.photoRuined]) {
    if (img && !img.complete) img.addEventListener('load', () => game.draw(0));
  }
  // Same for the sprite atlas and the painted background.
  onSpritesReady(() => game.draw(0));
} else {
  // P0-2: zero menu — the run starts the instant the page opens, with
  // the fly already on Dad's nose. Browsers only allow audio after a
  // user gesture, so the first key/click/touch unlocks the sound.
  game.start();
  const unlockAudio = () => {
    game.sound.unlock();
    window.removeEventListener('keydown', unlockAudio, true);
    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('touchstart', unlockAudio, true);
  };
  window.addEventListener('keydown', unlockAudio, true);
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('touchstart', unlockAudio, true);
  // P0-4: losing the tab mid-run pauses the party — nobody should
  // come back from a review tab to a fly already flat.
  const loseFocus = () => {
    if (game.state === 'playing') game.focusPaused = true;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loseFocus();
  });
  window.addEventListener('blur', loseFocus);
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (game.focusPaused) {
      if (input.takeClick() || input.take('Space') || input.take('Enter') || input.take('Dodge') || input.take('Tap')) game.focusPaused = false;
      game.draw(delta);
      requestAnimationFrame(frame);
      return;
    }
    if (input.take('KeyP') && game.state === 'playing') game.paused = !game.paused;
    // P0-1: a dodge press is latched on the game until a simulation
    // step actually consumes it. In slow motion (tutorial freeze
    // 0.05, finale 0.25, PERFECT 0.3) most frames run zero steps, and
    // a frame-local flag used to throw the press away.
    const resultsReady = game.state === 'results' && game.time - game.finishTime > 0.8;
    if (game.state === 'title' && (input.take('Space') || input.take('Enter') || input.takeClick())) {
      game.sound.unlock();
      game.start();
    } else if (resultsReady && (input.take('KeyR') || input.take('Space') || input.takeClick() || input.take('Tap'))) {
      runSeed += 1;
      game.newRun(runSeed);
      game.sound.unlock();
      game.start();
    } else if (game.state === 'playing') {
      if (input.take('Space') || input.take('Dodge')) game.queuedFlash = true; // P1-5: right-click / second finger
      input.take('Tap'); // a steering finger landing is not an action in play
      if (input.takeClick()) {
        // Landed clicks raise the bet (P1-4); airborne clicks dodge.
        if (game.tutorial === 'done' && game.fly.landedOn) game.placeBet();
        else game.queuedFlash = true;
      }
    }
    // During the scripted opening, ANY key or click is the dodge.
    if (game.state === 'playing' && game.tutorial !== 'done' && (input.take('Enter') || input.take('KeyR'))) {
      game.queuedFlash = true;
    }

    // Real-time effect clocks: freeze holds the world (but not the
    // particles and texts — those step inside stepFx via step()).
    if (game.freezeT > 0) {
      game.freezeT -= delta;
      game.stepFx(delta);
      game.whiteFlashT = Math.max(0, game.whiteFlashT - delta);
      game.redFlashT = Math.max(0, game.redFlashT - delta);
      game.draw(delta);
      requestAnimationFrame(frame);
      return;
    }
    let scale = game.tsHint;
    if (game.slowmoT > 0) {
      game.slowmoT -= delta;
      scale = Math.min(scale, game.slowmoVal);
    }
    game.whiteFlashT = Math.max(0, game.whiteFlashT - delta);
    game.redFlashT = Math.max(0, game.redFlashT - delta);

    acc += delta * scale;
    let guard = 0;
    while (acc >= STEP && guard++ < 10) {
      if (!game.paused) {
        game.step(STEP, {
          steer: input.mouse.inside ? { x: input.mouse.x, y: input.mouse.y } : null,
          flashPressed: game.queuedFlash,
        });
        game.queuedFlash = false; // consumed by a real step, never by a frame
      }
      acc -= STEP;
    }
    game.draw(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

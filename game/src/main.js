// main.js — the game itself: the state machine (title → playing →
// won/caught), the fixed-step loop, and the rules that connect the
// modules — eating off the current dish builds weight, a full table
// of empty plates opens the window, and the palm ends what it catches.
//
// The fly starts each run on the south edge of the table. Eat the
// three dishes in order (the pulsing one is next), then escape
// through the window on the north wall.

import { VIEW, ROOM } from './config.js';
import { makeRng } from './random.js';
import { Table } from './table.js';
import { Fly } from './fly.js';
import { Humans } from './humans.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { applyPose } from './shots.js';

const STEP = 1 / 60;

class Game {
  constructor(canvas, seed) {
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(this.renderer.ctx);
    this.sound = new Sound();
    this.newRun(seed);
    this.state = 'title';
    this.time = 0;
    this.paused = false;
  }

  newRun(seed) {
    this.table = new Table(seed);
    const t = ROOM.table;
    this.fly = new Fly(makeRng(seed * 7 + 1), t.x + t.w / 2, t.y + t.h - 40);
    this.humans = new Humans(this.table);
    this.elapsed = 0;
    this.grams = 0;
    this.escapeOpen = false;
    this.endReason = '';
    this.chompT = 0;
    this.warned = false;
  }

  start() {
    this.state = 'playing';
    this.hud.announce('偷吃开始！先吃发亮的那道菜', 2.4);
  }

  step(dt, input) {
    this.time += dt;
    if (this.state !== 'playing') return;
    this.elapsed += dt;

    const steer = input.steer;
    this.fly.update(dt, steer, input.buzz);
    this.sound.buzz(this.fly.speed, this.fly.buzzing);

    const wasPalm = this.humans.palm.state;
    const outcome = this.humans.update(dt, this.fly, this.elapsed);
    if (this.humans.palm.state === 'warning' && wasPalm === 'idle') {
      this.hud.announce('巨掌来了！快跑！！', 0.9);
      this.sound.warn();
    }
    if (outcome === 'caught') {
      this.state = 'caught';
      this.fly.alive = false;
      this.endReason = '巨掌落了下来——晚餐之旅到此为止。';
      this.sound.splat();
      this.sound.buzz(0, false);
      return;
    }

    this.eatLogic(dt, input.buzz);
    this.escapeLogic();
  }

  eatLogic(dt, buzzing) {
    const target = this.table.nextTarget();
    if (!target) return;
    const on = Math.hypot(this.fly.x - target.x, this.fly.y - target.y) < target.r;
    if (on && !buzzing) {
      // Landed on the dish and feeding: the fly settles (strong local
      // damping) and the dish is eaten over its dwell time.
      const settle = Math.exp(-6 * dt);
      this.fly.vx *= settle;
      this.fly.vy *= settle;
      target.dwellProgress = Math.min(1, target.dwellProgress + dt / target.dwell);
      this.chompT -= dt;
      if (this.chompT <= 0) {
        this.sound.chomp();
        this.chompT = 0.22;
      }
      if (target.dwellProgress >= 1) {
        target.eaten = true;
        this.grams += target.grams;
        this.fly.weight++;
        this.sound.eaten();
        if (this.table.nextTarget()) {
          this.hud.announce(`吃掉${target.name}！+${target.grams} 克，体重 ${this.fly.weight}，飞得更歪了`, 2.4);
        } else {
          this.escapeOpen = true;
          this.hud.announce('全吃光了！窗户开了，快逃！', 2.6);
        }
      }
    } else if (!on) {
      target.dwellProgress = Math.max(0, target.dwellProgress - dt * 0.35);
    }
    // On the dish but buzzing (taking off): progress holds as it is.
  }

  escapeLogic() {
    if (!this.escapeOpen || this.state !== 'playing') return;
    const w = this.table.window;
    if (this.fly.x > w.x - 8 && this.fly.x < w.x + w.w + 8 && this.fly.y < w.y + w.h + 16) {
      this.state = 'won';
      this.fly.escaped = true;
      this.sound.escape();
      this.sound.buzz(0, false);
    }
  }

  draw(dt) {
    this.renderer.draw(this);
    this.hud.draw(this, dt);
  }
}

// --- boot ------------------------------------------------------------

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
} else {
  game.state = 'title';
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += delta;

    if (input.take('KeyP') && game.state === 'playing') game.paused = !game.paused;
    if (game.state === 'title' && (input.take('Space') || input.take('Enter'))) {
      game.sound.unlock();
      game.start();
    } else if ((game.state === 'won' || game.state === 'caught') && (input.take('KeyR') || input.take('Space'))) {
      runSeed += 1;
      game.newRun(runSeed);
      game.sound.unlock();
      game.start();
    }
    if (input.buzz) game.sound.unlock();

    while (acc >= STEP) {
      if (!game.paused) {
        game.step(STEP, {
          steer: input.mouse.inside ? { tx: input.mouse.x, ty: input.mouse.y } : null,
          buzz: input.buzz,
        });
      }
      acc -= STEP;
    }
    game.draw(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

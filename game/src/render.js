// render.js — the sticker-book look from the spec (part 1): flat
// cartoon shapes, one 3px dark-plum outline (#2B1B2E) on everything,
// a single highlight pass (top-right, +15%) and shade pass
// (bottom-left, -20%), no gradients or textures inside objects.
// Foods are strictly top-down; the family are big front-facing
// sticker heads along the table edges; the fly wears a white locator
// ring so it can never get lost on a busy table.

import { PALETTE, VIEW } from './config.js';

const TAU = Math.PI * 2;
const OUTLINE = PALETTE.ink;

function circle(ctx, x, y, r, fill, outline = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

function shade(ctx, x, y, r) {
  // The one shade pass: a soft dark wedge, bottom-left.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'rgba(43,27,46,0.20)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.45, y + r * 0.55, r * 0.95, r * 0.7, 0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function shine(ctx, x, y, r) {
  // The one highlight pass: a soft light wedge, top-right.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.4, y - r * 0.5, r * 0.8, r * 0.55, 0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const ctx = this.ctx;
    const t = game.time;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);

    // Screen shake: world layer only, HUD stays put (spec 3.4).
    if (game.shakeAmp > 0.2) {
      const a = game.shakeAmp;
      ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a);
      game.shakeAmp = Math.max(0, game.shakeAmp - 0.016 * 42);
    }
    if (game.zoomT > 0) {
      const k = 1 + game.zoomAmp * Math.min(1, game.zoomT / 0.3);
      ctx.translate(VIEW.width / 2, VIEW.height / 2);
      ctx.scale(k, k);
      ctx.translate(-VIEW.width / 2, -VIEW.height / 2);
    }

    this.drawRoom(game, t);
    this.drawTable(game, t);
    this.drawHover(game, t);
    this.drawHumans(game, t);
    this.drawLamp(game, t);
    this.drawDog(game, t);
    this.drawAttacks(game, t);
    this.drawFly(game, t);
    this.drawParticles(game);
    this.drawTexts(game);

    if (game.blackoutT > 0) this.drawBlackout(game, t);
    if (game.showKeycap && game.state === 'playing') this.drawKeycap(game, t);

    ctx.restore();

    // Full-screen flashes sit above everything, HUD included.
    if (game.whiteFlashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, game.whiteFlashT * 6)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (game.redFlashT > 0) {
      ctx.fillStyle = `rgba(255,45,45,${Math.min(0.32, game.redFlashT * 1.1)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  // --- room ------------------------------------------------------------

  drawRoom(game, t) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(-30, -30, VIEW.width + 60, VIEW.height + 60);
    // Rug under the table.
    const tb = game.table.rect;
    ctx.fillStyle = '#4A2C50';
    roundRect(ctx, tb.x - 120, tb.y - 104, tb.w + 240, tb.h + 208, 26);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,201,74,0.35)';
    roundRect(ctx, tb.x - 104, tb.y - 88, tb.w + 208, tb.h + 176, 20);
    ctx.stroke();
    // Confetti the party dropped earlier.
    const confetti = ['#FF5A4E', '#FFC94A', '#5FD3B5', '#FF3FA4', '#3FE0FF'];
    for (let i = 0; i < 42; i++) {
      const x = ((i * 173) % 1240) + 20;
      const y = ((i * 289) % 760) + 20;
      if (x > tb.x - 90 && x < tb.x + tb.w + 90 && y > tb.y - 70 && y < tb.y + tb.h + 70) continue;
      ctx.fillStyle = confetti[i % confetti.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i * 1.7);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    // The chandelier's warm pool of light, swaying when E4 hits.
    const lamp = game.table.lamp;
    const sway = game.table.lampSwingT > 0 ? Math.sin(t * 9) * 16 * (game.table.lampSwingT / 3) : 0;
    const pool = ctx.createRadialGradient(lamp.x + sway, lamp.y, 60, lamp.x + sway, lamp.y, 520);
    pool.addColorStop(0, 'rgba(255,205,110,0.20)');
    pool.addColorStop(1, 'rgba(255,205,110,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Vignette.
    const vg = ctx.createRadialGradient(640, 400, 380, 640, 400, 900);
    vg.addColorStop(0, 'rgba(11,6,18,0)');
    vg.addColorStop(1, 'rgba(11,6,18,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // --- table & food ------------------------------------------------------

  drawTable(game, t) {
    const ctx = this.ctx;
    const tb = game.table;
    const r = tb.rect;
    // Wooden rim, then the cream checked cloth.
    ctx.fillStyle = PALETTE.wood;
    roundRect(ctx, r.x - 14, r.y - 14, r.w + 28, r.h + 28, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = PALETTE.cloth;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.clip();
    ctx.strokeStyle = PALETTE.clothGrid;
    ctx.lineWidth = 2;
    for (let x = r.x + 34; x < r.x + r.w; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + r.h);
      ctx.stroke();
    }
    for (let y = r.y + 34; y < r.y + r.h; y += 34) {
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.w, y);
      ctx.stroke();
    }
    // The spilled-drink puddle (E7) glistens on the cloth.
    if (game.puddle) {
      ctx.fillStyle = 'rgba(160,105,45,0.5)';
      ctx.beginPath();
      ctx.ellipse(game.puddle.x, game.puddle.y, 44, 26, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(game.puddle.x - 12, game.puddle.y - 6, 14, 6, 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Plates under the food, then the food itself.
    for (const f of tb.foods) {
      circle(ctx, f.x, f.y, f.r + 12, '#FFFFFF');
      shade(ctx, f.x, f.y, f.r + 12);
      this.drawFood(game, f, t);
    }
    for (const d of tb.dressing) {
      if (d.state !== 'fresh') continue;
      const hop = d.hopT > 0 ? Math.sin((0.35 - d.hopT) / 0.35 * Math.PI) * 7 : 0;
      this.drawProp(game, d.kind, d.x, d.y - hop, d.rot ?? 0, t);
    }
    for (const p of game.landedProps) this.drawProp(game, p.kind, p.x, p.y, p.rot ?? 0, t);
    for (const pr of game.projectiles) this.drawProp(game, pr.kind, pr.x, pr.y, pr.rot, t);
  }

  drawFood(game, f, t) {
    const ctx = this.ctx;
    if (f.state === 'smashed') {
      // A cheerful splat where dinner used to be.
      ctx.fillStyle = f.color;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.13 + f.x;
        ctx.beginPath();
        ctx.ellipse(f.x + Math.cos(a) * f.r * 0.45, f.y + Math.sin(a) * f.r * 0.35, f.r * (0.24 + (i % 3) * 0.07), f.r * 0.18, a, 0, TAU);
        ctx.fill();
      }
      circle(ctx, f.x, f.y, f.r * 0.3, f.color, false);
      return;
    }
    if (f.id === 'soup') {
      circle(ctx, f.x, f.y, f.r, '#FFFFFF');
      if (f.state === 'empty') {
        circle(ctx, f.x, f.y, f.r - 8, '#E8DCC4', false);
        ctx.strokeStyle = '#B9A888';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x - 12, f.y + 6);
        ctx.lineTo(f.x + 14, f.y - 8);
        ctx.stroke();
      } else {
        circle(ctx, f.x, f.y, f.r - 7, PALETTE.soup, false);
        // Tomato chunks, egg ribbons, a swirl of oil.
        ctx.fillStyle = '#FF5A4E';
        for (let i = 0; i < 5; i++) {
          const a = i * 2.3 + 0.6;
          circle(ctx, f.x + Math.cos(a) * f.r * 0.45, f.y + Math.sin(a) * f.r * 0.4, 5.5, '#FF5A4E', false);
        }
        ctx.strokeStyle = '#FFD98A';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.42, t * 0.4, t * 0.4 + 4.2);
        ctx.stroke();
        // Steam.
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          for (let s = 0; s <= 10; s++) {
            const yy = f.y - 8 - s * 3.4;
            const xx = f.x + i * 14 + Math.sin(t * 2.4 + s * 0.7 + i * 2) * 4;
            if (s === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
      }
      return;
    }
    if (f.id === 'greens') {
      circle(ctx, f.x, f.y, f.r - 4, '#3E9B4F', false);
      const leaf = ['#4CAF50', '#66BB6A', '#43A047', '#81C784'];
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4;
        const rr = (i % 4) * 8;
        ctx.fillStyle = leaf[i % leaf.length];
        ctx.beginPath();
        ctx.ellipse(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.8, 13, 8, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#FF5A4E';
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 1;
        circle(ctx, f.x + Math.cos(a) * 16, f.y + Math.sin(a) * 12, 6, '#FF5A4E', false);
      }
      return;
    }
    if (f.id === 'chicken') {
      ctx.fillStyle = '#D98E32';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r - 4, f.r * 0.68, -0.15, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      shine(ctx, f.x, f.y, f.r - 6);
      // Drumsticks with little white bones.
      for (const s of [-1, 1]) {
        ctx.strokeStyle = '#FFF6E8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(f.x + s * (f.r - 12), f.y + 8);
        ctx.lineTo(f.x + s * (f.r + 4), f.y + 20);
        ctx.stroke();
        circle(ctx, f.x + s * (f.r + 6), f.y + 22, 5, '#FFF6E8', false);
      }
      ctx.fillStyle = '#5FD3B5';
      circle(ctx, f.x - 10, f.y - 12, 5, '#5FD3B5', false);
      circle(ctx, f.x + 12, f.y - 6, 5, '#5FD3B5', false);
      return;
    }
    // The birthday cake: two tiers, scalloped icing, cherries.
    circle(ctx, f.x, f.y, f.r, '#FFFFFF');
    circle(ctx, f.x, f.y, f.r - 9, PALETTE.creamA, false);
    ctx.strokeStyle = 'rgba(207,127,151,0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r - 15, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 10; i++) {
      const a = i * (TAU / 10) + 0.3;
      circle(ctx, f.x + Math.cos(a) * (f.r - 5), f.y + Math.sin(a) * (f.r - 5), 3.4, '#FFFFFF', false);
    }
    circle(ctx, f.x, f.y, f.r - 20, '#FFFFFF', false);
    for (let i = 0; i < f.creamSplats; i++) {
      const a = i * 2.7 + 1;
      ctx.fillStyle = 'rgba(255,209,220,0.85)';
      ctx.beginPath();
      ctx.ellipse(f.x + Math.cos(a) * (f.r + 8), f.y + Math.sin(a) * (f.r + 6), 10, 6, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#FF5A4E';
    for (let i = 0; i < 6; i++) {
      const a = i * (TAU / 6) + 0.4;
      circle(ctx, f.x + Math.cos(a) * (f.r - 26), f.y + Math.sin(a) * (f.r - 26), 5, '#FF5A4E', false);
    }
    const candleCols = ['#FF5A4E', '#3FE0FF', '#FFC94A', '#5FD3B5', '#FF3FA4', '#B565D8', '#FF8A3D', '#4C7BD9'];
    for (let i = 0; i < 8; i++) {
      const a = i * (TAU / 8) - Math.PI / 2;
      const cx = f.x + Math.cos(a) * 26;
      const cy = f.y + Math.sin(a) * 26;
      ctx.fillStyle = candleCols[i];
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
      if (i < f.candlesLit) {
        const fl = 1 + Math.sin(t * 11 + i * 1.7) * 0.25;
        ctx.fillStyle = '#FFC94A';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 7, 3.4 * fl, 5.4 * fl, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFF3C4';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 1.6 * fl, 2.8 * fl, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (game.finaleArmed && f.state === 'fresh') {
      // The golden pulse that says: land here. End this.
      const pulse = 1 + Math.sin(t * 5) * 0.1;
      ctx.strokeStyle = 'rgba(255,201,74,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x, f.y, (f.r + 18) * pulse, 0, TAU);
      ctx.stroke();
    }
  }

  drawProp(game, kind, x, y, rot, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (kind === 'fork' || kind === 'knife') {
      ctx.strokeStyle = '#C7CDD6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.fillStyle = '#C7CDD6';
      if (kind === 'fork') {
        for (let i = -1; i <= 1; i++) ctx.fillRect(10, i * 5 - 1.5, 13, 3);
      } else {
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(26, 0);
        ctx.lineTo(8, 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'cup' || kind === 'teacup') {
      circle(ctx, 0, 0, kind === 'cup' ? 13 : 11, kind === 'cup' ? '#3FE0FF' : '#FFFFFF');
      circle(ctx, 0, 0, 7, kind === 'cup' ? '#FF9E3D' : '#C98A3D', false);
    } else if (kind === 'rice') {
      circle(ctx, 0, 0, 14, '#FFFFFF');
      ctx.fillStyle = '#FFFDF4';
      ctx.beginPath();
      ctx.ellipse(0, -2, 10, 6, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'sticks') {
      ctx.strokeStyle = '#B5722F';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.lineTo(14, 2);
      ctx.moveTo(-12, 4);
      ctx.lineTo(15, 10);
      ctx.stroke();
    } else if (kind === 'sauce') {
      circle(ctx, 0, 0, 10, '#FFFFFF');
      circle(ctx, 0, 0, 6.5, '#7A3B1E', false);
    } else if (kind === 'napkin') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeRect(-11, -8, 22, 16);
    } else if (kind === 'plate' || kind === 'bowl') {
      circle(ctx, 0, 0, kind === 'plate' ? 19 : 15, '#FFFFFF');
      circle(ctx, 0, 0, kind === 'plate' ? 11 : 8, '#EFE7D4', false);
    } else if (kind === 'teapot') {
      circle(ctx, 0, 0, 17, '#B565D8');
      shine(ctx, 0, 0, 17);
      ctx.fillStyle = '#B565D8';
      ctx.beginPath();
      ctx.moveTo(14, -4);
      ctx.lineTo(26, -10);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, -16, 4, OUTLINE, false);
    } else if (kind === 'candle') {
      ctx.fillStyle = '#FF5A4E';
      ctx.fillRect(-3, -8, 6, 16);
      const fl = 1 + Math.sin(t * 12 + x) * 0.25;
      ctx.fillStyle = '#FFC94A';
      ctx.beginPath();
      ctx.ellipse(0, -13, 3.2 * fl, 5 * fl, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'glasses') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-11, 0, 9, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(11, 0, 9, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(2, -2);
      ctx.stroke();
    } else if (kind === 'dentures') {
      ctx.fillStyle = '#FF9FB2';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * 4 - 1.8, 4, 3.6, 6);
    } else if (kind === 'greens') {
      ctx.fillStyle = '#4CAF50';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.cos(i * 2.2) * 7, Math.sin(i * 2.2) * 5, 9, 6, i, 0, TAU);
        ctx.fill();
      }
    } else if (kind === 'chicken') {
      ctx.fillStyle = '#D98E32';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 10, 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- hover / landing telegraphs -----------------------------------------

  drawHover(game, t) {
    const ctx = this.ctx;
    // Tutorial ghost path: a dashed promise from fly to target.
    if (game.ghostTarget) {
      const g = game.ghostTarget;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.moveTo(game.fly.x, game.fly.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,90,78,${0.6 + Math.sin(t * 6) * 0.3})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r + 14, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const zone = game.hoverZone;
    if (zone && game.state === 'playing') {
      // Breathing white outline (6Hz) on whatever the fly is over.
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + Math.sin(t * Math.PI * 12) * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, (zone.r ?? 30) + 7, 0, TAU);
      ctx.stroke();
    }
    if (game.fly.landedOn && game.state === 'playing') {
      // Landed: the target flashes tomato once per taunt build-up.
      const z = game.fly.landedOn;
      ctx.strokeStyle = 'rgba(255,90,78,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(z.x, z.y, (z.r ?? 30) + 5 + Math.sin(t * 8) * 1.5, 0, TAU);
      ctx.stroke();
    }
  }

  // --- the family -------------------------------------------------------------

  drawHumans(game, t) {
    const ctx = this.ctx;
    game.table.humans.forEach((h, i) => this.drawHuman(game, h, i, t));
  }

  drawHuman(game, h, idx, t) {
    const ctx = this.ctx;
    const raised = h.blockedT > 0 ? 12 : 0; // soup victims stand, dripping
    const x = h.x;
    const y = h.y - raised;
    const R = h.headR;
    const bob = Math.sin(t * 1.6 + idx * 1.9) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    // Shoulders in the shirt colour, tucked behind the head.
    ctx.fillStyle = h.look.clothes;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.92, R * 1.12, R * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    shade(ctx, 0, R * 0.92, R * 0.8);
    // Head.
    circle(ctx, 0, 0, R, h.look.skin ?? PALETTE.skin);
    shade(ctx, 0, 0, R);
    shine(ctx, 0, 0, R);
    // Hair / hats per person.
    if (h.name === 'Dad') {
      ctx.fillStyle = h.look.hairColor;
      ctx.beginPath();
      ctx.arc(0, -4, R, Math.PI * 1.08, Math.PI * 1.92);
      ctx.quadraticCurveTo(0, -R * 0.52, -R * Math.cos(Math.PI * 1.08 + 0.2), -R * 0.28);
      ctx.closePath();
      ctx.fill();
    } else if (h.name === 'Mom') {
      ctx.fillStyle = h.look.hairColor;
      ctx.beginPath();
      ctx.arc(0, -4, R, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(0, -R * 0.6, -R * 0.92, -R * 0.2);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, -R - 8, 15, h.look.hairColor); // the famous bun
      circle(ctx, R * 0.98, 8, 4.5, '#FFFFFF', false); // pearl earring
      circle(ctx, -R * 0.98, 8, 4.5, '#FFFFFF', false);
    } else if (h.name === 'Grandpa') {
      // Bald, with two proud white tufts.
      ctx.fillStyle = '#F4F1E8';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * (R - 2), -R * 0.25, 9, 13, s * 0.5, 0, TAU);
        ctx.fill();
      }
    } else {
      // Timmy's party hat: red cone, yellow dots.
      ctx.fillStyle = '#FF5A4E';
      ctx.beginPath();
      ctx.moveTo(-15, -R * 0.72);
      ctx.lineTo(0, -R - 30);
      ctx.lineTo(15, -R * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = PALETTE.butter;
      circle(ctx, 0, -R - 30, 6, PALETTE.butter, false);
      circle(ctx, -5, -R * 0.95, 3.4, PALETTE.butter, false);
      circle(ctx, 5, -R * 1.08, 3.4, PALETTE.butter, false);
      ctx.fillStyle = '#7A4A21';
      ctx.beginPath();
      ctx.arc(0, -4, R, Math.PI * 1.1, Math.PI * 1.9);
      ctx.quadraticCurveTo(0, -R * 0.55, -R * 0.9, -R * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    this.drawFace(game, h, idx, t, R);
    // The red handprint of shame.
    if (h.palmPrint) {
      ctx.save();
      ctx.translate(R * 0.34, R * 0.08);
      ctx.rotate(0.5);
      ctx.fillStyle = 'rgba(255,64,54,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 13, 0, 0, TAU);
      ctx.fill();
      for (let f = 0; f < 4; f++) {
        ctx.beginPath();
        ctx.ellipse(-8 + f * 5.4, -9, 2.8, 6.5, (f - 1.5) * 0.16, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // Soup face: orange drips from the hairline.
    if (h.soupFace) {
      ctx.fillStyle = 'rgba(232,116,59,0.9)';
      ctx.beginPath();
      ctx.arc(0, -R * 0.4, R * 0.8, Math.PI, TAU);
      ctx.fill();
      for (let d = 0; d < 4; d++) {
        const dx = -R * 0.5 + d * R * 0.33;
        ctx.beginPath();
        ctx.ellipse(dx, -R * 0.28 + (d % 2) * 8, 4.5, 12 + (d % 2) * 7, 0, 0, TAU);
        ctx.fill();
      }
    }
    // Dinner, worn as a hat (E8).
    if (h.hatKind) this.drawProp(game, h.hatKind, 0, -R - 4, 0.3, t);
    ctx.restore();
  }

  drawFace(game, h, idx, t, R) {
    const ctx = this.ctx;
    const expr = h.expression;
    const blink = ((t + idx * 1.37) % 3.4) < 0.11;
    const eyeY = -R * 0.08;
    const eyeDX = R * 0.36;
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    // Blush on every cheek (the F2 sprite sheet insists).
    ctx.fillStyle = 'rgba(255,130,130,0.45)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * R * 0.58, R * 0.26, 8.5, 5.5, s * 0.3, 0, TAU);
      ctx.fill();
    }
    const eye = (sx) => {
      const ex = sx * eyeDX;
      if (expr === 'slapped') {
        // X eyes.
        ctx.beginPath();
        ctx.moveTo(ex - 6, eyeY - 6);
        ctx.lineTo(ex + 6, eyeY + 6);
        ctx.moveTo(ex + 6, eyeY - 6);
        ctx.lineTo(ex - 6, eyeY + 6);
        ctx.stroke();
      } else if (blink || expr === 'happy') {
        ctx.beginPath();
        ctx.arc(ex, eyeY + 2, 6.5, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        // Big sticker eyes: white oval + pupil. The pupil does the
        // acting — centred (angry), sideways (suspicious), tiny and
        // high (scared).
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 8.6, 10.5, 0, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.stroke();
        let px = 0;
        let py = 0.5;
        let pr = 4.2;
        if (expr === 'suspicious') { px = 3.2; pr = 3.8; }
        if (expr === 'scared') { py = -1.5; pr = 3.1; }
        if (expr === 'angry') { pr = 3.6; }
        circle(ctx, ex + px, eyeY + py, pr, OUTLINE, false);
        circle(ctx, ex + px + 1.4, eyeY + py - 1.4, 1.3, '#FFFFFF', false);
        if (expr === 'suspicious') {
          ctx.beginPath();
          ctx.moveTo(ex - 8.6, eyeY - 6);
          ctx.lineTo(ex + 8.6, eyeY - 6);
          ctx.stroke();
        }
      }
    };
    eye(-1);
    eye(1);
    // Brows.
    if (expr === 'angry' || expr === 'suspicious') {
      ctx.beginPath();
      for (const s of [-1, 1]) {
        const bx = s * eyeDX;
        ctx.moveTo(bx - 8, eyeY - 14 + (expr === 'angry' ? 4 : 0));
        ctx.lineTo(bx + 8, eyeY - 14 - (expr === 'angry' ? 5 : 0));
      }
      ctx.stroke();
    }
    if (h.name === 'Grandpa') {
      // White caterpillar brows, always.
      ctx.strokeStyle = '#F4F1E8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        ctx.moveTo(s * eyeDX - 9, eyeY - 13);
        ctx.lineTo(s * eyeDX + 9, eyeY - 13);
      }
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.4;
    }
    // Nose.
    ctx.beginPath();
    ctx.arc(0, R * 0.14, 5, -0.6, 2.2);
    ctx.stroke();
    // Mouth per expression.
    const my = R * 0.42;
    ctx.beginPath();
    if (expr === 'happy') {
      ctx.arc(0, my - 4, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (expr === 'angry') {
      ctx.arc(0, my + 7, 9, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (expr === 'scared' || expr === 'slapped') {
      ctx.ellipse(0, my + 2, 7, 9, 0, 0, TAU);
      ctx.stroke();
    } else {
      ctx.moveTo(-8, my + 2);
      ctx.lineTo(8, my + 2);
      ctx.stroke();
    }
    // Grandpa's great white moustache.
    if (h.name === 'Grandpa') {
      ctx.fillStyle = '#F4F1E8';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 8, my - 7, 10.5, 5.4, s * 0.35, 0, TAU);
        ctx.fill();
      }
    }
    // Grandpa's dentures grin (until they leave).
    if (h.name === 'Grandpa' && !h.denturesOut && expr !== 'scared') {
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, -13, my - 2, 26, 9, 3);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, my - 2);
      ctx.lineTo(-4, my + 7);
      ctx.moveTo(4, my - 2);
      ctx.lineTo(4, my + 7);
      ctx.stroke();
    }
    // Timmy's missing front tooth.
    if (h.name === 'Timmy' && expr === 'happy') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-8, my + 2, 5, 6);
      ctx.fillRect(2, my + 2, 5, 6);
    }
    // Dad's moustache + glasses.
    if (h.name === 'Dad') {
      ctx.fillStyle = h.look.hairColor;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.3, 13, 5, 0, 0, TAU);
      ctx.fill();
      if (!h.glassesOff) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-eyeDX, eyeY, 13, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(eyeDX, eyeY, 13, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-eyeDX + 13, eyeY);
        ctx.lineTo(eyeDX - 13, eyeY);
        ctx.stroke();
      }
    }
  }

  // --- lamp, dog, attacks, fly ------------------------------------------------

  drawLamp(game, t) {
    const ctx = this.ctx;
    const lamp = game.table.lamp;
    if (game.table.lampDropped) {
      ctx.save();
      ctx.translate(lamp.x, lamp.y);
      ctx.rotate(0.7);
      ctx.fillStyle = '#8A6D2F';
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 16, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const sway = game.table.lampSwingT > 0 ? Math.sin(t * 9) * 16 * (game.table.lampSwingT / 3) : 0;
    ctx.save();
    ctx.translate(lamp.x + sway, lamp.y);
    ctx.strokeStyle = 'rgba(43,27,46,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -lamp.y - 4);
    ctx.lineTo(0, -12);
    ctx.stroke();
    ctx.fillStyle = '#FFC94A';
    ctx.beginPath();
    ctx.moveTo(-30, 8);
    ctx.quadraticCurveTo(0, -22, 30, 8);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    circle(ctx, 0, 6, 6, '#FFF3C4', false);
    ctx.restore();
  }

  drawDog(game, t) {
    const dog = game.dog;
    if (!dog) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(dog.x, dog.y);
    if (dog.dirX < 0) ctx.scale(-1, 1);
    const wag = Math.sin(t * 14) * 0.4;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.quadraticCurveTo(-30, -14, -26 + wag * 8, -20);
    ctx.stroke();
    ctx.fillStyle = '#C98A5A';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 15, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    circle(ctx, 22, -8, 12, '#C98A5A');
    ctx.fillStyle = '#8A5A33';
    ctx.beginPath();
    ctx.ellipse(16, -16, 5, 9, 0.4, 0, TAU);
    ctx.fill();
    circle(ctx, 26, -9, 2.6, OUTLINE, false);
    circle(ctx, 33, -3, 3, '#5A3220', false);
    if (dog.state === 'run') {
      // The chicken, mid-getaway.
      this.drawProp(game, 'chicken', 30, 4, 0.5, t);
    }
    ctx.restore();
  }

  drawAttacks(game, t) {
    const ctx = this.ctx;
    for (const atk of game.director.attacks) {
      if (atk.state === 'warning') this.drawWarning(game, atk, t);
      else if (atk.state === 'slam') this.drawImpactHand(game, atk, t);
    }
    // Leftover spray mist hangs in the air.
    const mist = game.director.mist;
    if (mist) {
      ctx.fillStyle = 'rgba(140,220,120,0.16)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(mist.x + Math.cos(mist.dir) * i * 55, mist.y + Math.sin(mist.dir) * i * 55, 16 + i * 9, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawWarning(game, atk, t) {
    const ctx = this.ctx;
    const remainMs = (atk.dur - atk.t) * 1000;
    if (atk.kind === 'spray') {
      ctx.save();
      ctx.strokeStyle = 'rgba(140,220,120,0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(atk.owner.x, atk.owner.y);
      ctx.arc(atk.owner.x, atk.owner.y, 220, atk.dir - 0.52, atk.dir + 0.52);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (atk.kind === 'poke') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,78,0.8)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 7]);
      const ang = Math.atan2(atk.y - atk.fromY, atk.x - atk.fromX);
      const px = -Math.sin(ang) * 15;
      const py = Math.cos(ang) * 15;
      ctx.beginPath();
      ctx.moveTo(atk.fromX + px, atk.fromY + py);
      ctx.lineTo(atk.x + px, atk.y + py);
      ctx.lineTo(atk.x - px, atk.y - py);
      ctx.lineTo(atk.fromX - px, atk.fromY - py);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    // The shrinking ring: 90 -> impact radius, tomato -> white,
    // magenta strobe for the final 200ms (spec 2.2).
    const k = atk.dur > 0 ? atk.t / atk.dur : 1;
    const warnFrom = atk.warnFrom ?? 110;
    const r = warnFrom + (atk.radius - warnFrom) * k;
    let color = `rgba(255,${Math.round(90 + 165 * k)},${Math.round(78 + 177 * k)},${0.35 + 0.25 * k})`;
    if (remainMs < 200 && Math.floor(t * 20) % 2 === 0) color = 'rgba(255,63,164,0.9)';
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${0.10 + 0.12 * k})`);
    ctx.beginPath();
    ctx.arc(atk.x, atk.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = atk.finale ? 5 : 3.5;
    ctx.beginPath();
    ctx.arc(atk.x, atk.y, r, 0, TAU);
    ctx.stroke();
    if (atk.finale) {
      ctx.strokeStyle = 'rgba(255,201,74,0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(atk.x, atk.y, r + 12 + Math.sin(t * 8) * 3, 0, TAU);
      ctx.stroke();
    }
    // The shadow of the coming hand grows over the target.
    const shadowK = 0.4 + 0.6 * k;
    ctx.fillStyle = `rgba(20,8,24,${0.10 + 0.16 * k})`;
    ctx.beginPath();
    ctx.ellipse(atk.x, atk.y, atk.radius * 1.15 * shadowK + 12, atk.radius * 0.8 * shadowK + 9, 0, 0, TAU);
    ctx.fill();
  }

  handPath(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.beginPath();
    // Palm.
    ctx.moveTo(-17, 12);
    ctx.quadraticCurveTo(-19, -8, -10, -12);
    // Four fingers.
    for (let f = 0; f < 4; f++) {
      const fx = -11 + f * 7.4;
      ctx.quadraticCurveTo(fx + 1, -30 - (f === 1 || f === 2 ? 4 : 0), fx + 3.6, -12);
    }
    ctx.quadraticCurveTo(16, -10, 17, 8);
    ctx.quadraticCurveTo(24, 2, 26, 10);
    ctx.quadraticCurveTo(20, 20, 8, 16);
    ctx.quadraticCurveTo(0, 24, -10, 20);
    ctx.quadraticCurveTo(-17, 18, -17, 12);
    ctx.closePath();
    ctx.fillStyle = PALETTE.skin;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    shade(ctx, 0, 2, 17);
    ctx.restore();
  }

  drawImpactHand(game, atk, t) {
    const ctx = this.ctx;
    const pop = 1 + Math.max(0, 0.14 - atk.t) * 2.2;
    if (atk.finale) {
      // All four hands, one from each side of the table.
      for (const [i, h] of game.table.humans.entries()) {
        const a = Math.atan2(atk.y - h.y, atk.x - h.x);
        this.handPath(ctx, atk.x - Math.cos(a) * 16 + (i % 2) * 8, atk.y - Math.sin(a) * 16, 1.25 * pop, a + Math.PI / 2);
      }
      return;
    }
    if (atk.swatter) {
      ctx.save();
      ctx.translate(atk.x, atk.y);
      ctx.rotate(0.6);
      ctx.fillStyle = '#FF5A4E';
      roundRect(ctx, -26 * pop, -26 * pop, 52 * pop, 52 * pop, 8);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43,27,46,0.5)';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 14, -24 * pop);
        ctx.lineTo(i * 14, 24 * pop);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.wood;
      roundRect(ctx, -4, 24 * pop, 8, 30, 4);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (atk.owner.name === 'Dad' && game.elapsed >= 55) {
      ctx.save();
      ctx.translate(atk.x, atk.y);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#F4F1E8';
      roundRect(ctx, -34 * pop, -13 * pop, 68 * pop, 26 * pop, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43,27,46,0.45)';
      ctx.lineWidth = 2;
      for (const yy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(-28 * pop, yy * pop);
        ctx.lineTo(28 * pop, yy * pop);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (atk.kind === 'spray') {
      ctx.fillStyle = 'rgba(140,220,120,0.3)';
      ctx.beginPath();
      ctx.moveTo(atk.owner.x, atk.owner.y);
      ctx.arc(atk.owner.x, atk.owner.y, 220, atk.dir - 0.52, atk.dir + 0.52);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (atk.kind === 'poke') {
      // Timmy himself, mid-lunge, hat first.
      ctx.save();
      ctx.translate(atk.x, atk.y);
      ctx.rotate(Math.atan2(atk.y - atk.fromY, atk.x - atk.fromX));
      ctx.fillStyle = '#FF5A4E';
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(-6, -11);
      ctx.lineTo(-6, 11);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const a = Math.atan2(atk.y - atk.owner.y, atk.x - atk.owner.x);
    this.handPath(ctx, atk.x, atk.y, 1.5 * pop, a + Math.PI / 2);
  }

  drawFly(game, t) {
    const ctx = this.ctx;
    const fly = game.fly;
    // Invincibility blink at 10Hz (spec 2.1).
    if (fly.iframesT > 0 && Math.floor(t * 10) % 2 === 0 && game.state === 'playing') return;
    const tier = game.tier;
    // Ground shadow.
    ctx.fillStyle = 'rgba(20,8,24,0.3)';
    ctx.beginPath();
    ctx.ellipse(fly.x, fly.y + 13, 13, 5, 0, 0, TAU);
    ctx.fill();
    // The white locator ring + flash-cooldown sweep (spec 1.2/3.2).
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(fly.x, fly.y, 19, 0, TAU);
    ctx.stroke();
    const cdFrac = fly.flashCooldown01;
    if (cdFrac < 1) {
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(fly.x, fly.y, 19, -Math.PI / 2, -Math.PI / 2 + cdFrac * TAU);
      ctx.stroke();
    }
    // Flash trail.
    if (fly.flashing) {
      ctx.fillStyle = 'rgba(63,224,255,0.35)';
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        ctx.beginPath();
        ctx.arc(fly.x - fly.vx * 0.03 * i, fly.y - fly.vy * 0.03 * i, 10 * (1 - k * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    // The fly-ness (spec 3.2): dual-sine jitter, 7Hz + 11Hz,
    // smaller when hovering/landed than when flying.
    const jAmp = fly.landedOn ? 1.2 : 2.5;
    const jx = Math.sin(t * Math.PI * 14) * jAmp * 0.7 + Math.sin(t * Math.PI * 22) * jAmp * 0.3;
    const jy = Math.cos(t * Math.PI * 14.6) * jAmp * 0.7 + Math.sin(t * Math.PI * 21.2) * jAmp * 0.3;
    ctx.save();
    ctx.translate(fly.x + jx, fly.y + jy);
    ctx.rotate(fly.heading);
    const squash = fly.squashT > 0 ? 0.45 : 1;
    const stretch = 1 + Math.min(0.18, fly.speed / 540 * 0.18);
    ctx.scale(stretch, squash / stretch);
    if (game.tierPopT > 0) {
      const s = 1 + Math.sin(Math.min(1, game.tierPopT / 0.35) * Math.PI) * 0.4;
      ctx.scale(s, s);
    }
    // Wings: flap rate follows speed (spec 3.2).
    const flap = Math.sin(t * (40 + fly.speed * 0.09)) * 0.65;
    ctx.fillStyle = 'rgba(230,246,255,0.75)';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * (0.7 + flap * 0.4));
      ctx.beginPath();
      ctx.ellipse(s * 4, -9, 11, 5.5, s * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Body by tier.
    let body = PALETTE.flyBody;
    if (tier.id === 'gold') body = '#FFC94A';
    if (tier.id === 'flame') body = '#FF7A2F';
    if (tier.id === 'rainbow') body = `hsl(${(t * 240) % 360}, 90%, 62%)`;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 8, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // Stripes + head + big red eyes.
    ctx.strokeStyle = 'rgba(43,27,46,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -7.4);
    ctx.lineTo(-3, 7.4);
    ctx.moveTo(2.5, -7.8);
    ctx.lineTo(2.5, 7.8);
    ctx.stroke();
    circle(ctx, 9, 0, 6, body);
    // The hero feature: two huge red compound eyes (per F2).
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#E8332A';
      ctx.beginPath();
      ctx.ellipse(12.5, s * 4.4, 5.6, 4.4, s * 0.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(14, s * 4.4 - 1.6, 1.7, 1.2, 0, 0, TAU);
      ctx.fill();
    }
    if (tier.id === 'flame') {
      // A little flame mohawk.
      ctx.fillStyle = '#FFC94A';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.quadraticCurveTo(-2, -16 - Math.sin(t * 16) * 3, 2, -7);
      ctx.quadraticCurveTo(-1, -10, -3, -7);
      ctx.closePath();
      ctx.fill();
    }
    if (fly.landedOn) {
      // Six little legs, planted and smug.
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(-4 + i * 4, s * 6);
          ctx.lineTo(-6 + i * 4, s * 11);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  drawParticles(game) {
    const ctx = this.ctx;
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / ((p.max ?? p.life) * 0.6)));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size ?? p.r ?? 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(game) {
    const ctx = this.ctx;
    for (const tx of game.texts) {
      const k = tx.t / tx.life;
      const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const pop = tx.t < 0.14 ? 0.6 + (tx.t / 0.14) * 0.55 : 1.15 - Math.min(0.15, (tx.t - 0.14) * 0.4);
      ctx.save();
      ctx.translate(tx.x, tx.y);
      ctx.globalAlpha = alpha;
      if (tx.bubble) {
        ctx.font = `700 ${tx.size}px "Baloo 2","Trebuchet MS",sans-serif`;
        const w = ctx.measureText(tx.text).width + 22;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, -w / 2, -tx.size - 12, w, tx.size + 16, 10);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, 5);
        ctx.lineTo(5, 5);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();
        ctx.fillStyle = OUTLINE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tx.text, 0, -tx.size / 2 - 3);
      } else {
        if (tx.size >= 38) ctx.rotate(-0.1);
        ctx.scale(pop, pop);
        ctx.font = `800 ${tx.size}px "Baloo 2","Trebuchet MS",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = OUTLINE;
        ctx.strokeText(tx.text, 0, 0);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.text, 0, 0);
      }
      ctx.restore();
    }
  }

  drawBlackout(game, t) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(11,6,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Candle glow survives: the cake, the table candle, the lamp.
    const glow = (x, y, r) => {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(255,201,74,0.5)');
      g.addColorStop(1, 'rgba(255,201,74,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const cake = game.table.foods[2];
    if (cake.candlesLit > 0) glow(cake.x, cake.y, 90);
    for (const d of game.table.dressing) if (d.kind === 'candle' && d.state === 'fresh') glow(d.x, d.y, 46);
    // Warning rings and the fly's locator ring stay visible.
    for (const atk of game.director.attacks) {
      if (atk.state === 'warning') this.drawWarning(game, atk, t);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(game.fly.x, game.fly.y, 19, 0, TAU);
    ctx.stroke();
    circle(ctx, game.fly.x, game.fly.y, 5, '#FFFFFF', false);
  }

  drawKeycap(game, t) {
    const ctx = this.ctx;
    const bounce = Math.abs(Math.sin(t * 5)) * 7;
    const x = game.fly.x + 54;
    const y = game.fly.y - 58 - bounce;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x - 44, y - 17, 88, 34, 9);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.font = '800 19px "Baloo 2","Trebuchet MS",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE', x, y + 1);
    ctx.font = '800 21px "Baloo 2","Trebuchet MS",sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText('DODGE!', game.fly.x, game.fly.y - 44);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillText('DODGE!', game.fly.x, game.fly.y - 44);
    ctx.restore();
  }
}

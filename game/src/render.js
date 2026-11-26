// render.js — the sticker-book look from the spec (part 1): flat
// cartoon shapes, one 3px dark-plum outline (#2B1B2E) on everything,
// a single highlight pass (top-right, +15%) and shade pass
// (bottom-left, -20%), no gradients or textures inside objects.
// Foods are strictly top-down; the family are big front-facing
// sticker heads along the table edges; the fly wears a white locator
// ring so it can never get lost on a busy table.

import { PALETTE, VIEW, MOOD } from './config.js';
import { warnProgress, grandpaStalled } from './humans.js';
import { spritesReady, bgReady, drawBgImage, drawSprite, drawHead, drawPalm } from './sprites.js';

const TAU = Math.PI * 2;
const OUTLINE = PALETTE.ink;

// v5: the family DRAWN 15% larger than their taunt radius — the
// F1 painting's people carry more of the frame than headR=48
// stickers did. Purely cosmetic: drawHuman scales its local
// context, so every radius, zone and rating in the game logic
// keeps using headR untouched.
const HEAD_DRAW = 1.15;

// Decal anchors per painted head, in units of the head radius R
// (design P1, decal no-go zone). Eye line and span set the X-eyes;
// the cheek point is low and outside the eye band; soup sits on the
// crown (Mom: on the bun — "Soup Bun") and runs down the hair.
// Measured by eye off the S1 atlas frames — check with the debug
// overlay and nudge here, nowhere else.
const DECAL = {
  Dad: { eyeY: -0.06, eyeSpan: 1.05, cheekX: -0.46, cheekY: 0.34, soupY: -0.72, soupW: 1.35 },
  Mom: { eyeY: -0.02, eyeSpan: 1.0, cheekX: -0.44, cheekY: 0.36, soupY: -1.02, soupW: 1.2 },
  Grandpa: { eyeY: -0.1, eyeSpan: 1.05, cheekX: -0.48, cheekY: 0.3, soupY: -0.78, soupW: 1.3 },
  Timmy: { eyeY: 0.02, eyeSpan: 1.0, cheekX: -0.44, cheekY: 0.38, soupY: -0.68, soupW: 1.25 },
};

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
    this.drawCrumbs(game, t);
    this.drawHover(game, t);
    this.drawHumans(game, t);
    // Design #4: the chandelier sprite is gone (it hung on Mom's head
    // and read as a layer bug). Only its light pool remains, drawn in
    // drawRoom; ROOM.lamp stays as a logic point for E4 / the drop.
    if (game.table.lampDropped) this.drawLamp(game, t);
    this.drawDog(game, t);
    this.drawChainPreview(game, t);
    this.drawAttacks(game, t);
    this.drawFly(game, t);
    this.drawTierRing(game);
    this.drawParticles(game);
    this.drawTexts(game);
    this.drawMissBar(game);

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
    // The focus-pause veil (P0-4) sits above even the flashes.
    if (game.focusPaused) {
      ctx.fillStyle = 'rgba(11,6,18,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 46px "Baloo 2","Trebuchet MS",sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 28);
      ctx.font = '700 25px "Baloo 2","Trebuchet MS",sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText('Click to resume', VIEW.width / 2, VIEW.height / 2 + 32);
      ctx.fillStyle = PALETTE.butter;
      ctx.fillText('Click to resume', VIEW.width / 2, VIEW.height / 2 + 32);
    }
  }

  // --- room ------------------------------------------------------------

  drawRoom(game, t) {
    const ctx = this.ctx;
    // The painted room (the layers19 plate): floor, chairs and
    // the empty table are one picture, warm light and corner
    // falloff baked in. The code light pool survives only as a
    // whisper (0.07, was 0.20 over F1b) — just enough for the
    // lamp-swing sway to read — and the code vignette is gone:
    // the plate's corners already sit at ~lum 45 against the
    // cloth's 220, so stacking it would double-darken.
    if (drawBgImage(ctx)) {
      const lamp = game.table.lamp;
      const sway = game.table.lampSwingT > 0 ? Math.sin(t * 9) * 16 * (game.table.lampSwingT / 3) : 0;
      const pool = ctx.createRadialGradient(lamp.x + sway, lamp.y, 60, lamp.x + sway, lamp.y, 520);
      pool.addColorStop(0, `rgba(255,205,110,${game.table.lampSwingT > 0 ? 0.16 : 0.07})`); // sway reads without a fixture
      pool.addColorStop(1, 'rgba(255,205,110,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      return;
    }
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
    const painted = bgReady();
    if (!painted) {
      // Wooden rim, then the cream checked cloth (code fallback
      // while the painting loads; the plate has both baked in).
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
      ctx.restore();
    }
    // The cloth remembers every slap: stain decals accumulate
    // where impacts land and stay for the rest of the run.
    for (const s of game.stains) {
      drawSprite(ctx, s.kind, s.x, s.y, { w: s.w, rot: s.rot, alpha: 0.92 });
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

    // Plates under the food, then the food itself. The painted
    // dishes bring their own plates; only the cake still needs one.
    for (const f of tb.foods) {
      if (!painted || f.id === 'cake') {
        circle(ctx, f.x, f.y, f.r + 12, '#FFFFFF');
        shade(ctx, f.x, f.y, f.r + 12);
      }
      this.drawFood(game, f, t);
    }
    for (const d of tb.dressing) {
      if (d.state !== 'fresh') {
        // A smashed plate stays on the cloth, in pieces.
        if ((d.kind === 'plate' || d.kind === 'bowl') && drawSprite(ctx, 'plate-cracked', d.x, d.y, { rot: d.rot ?? 0 })) continue;
        continue;
      }
      const hop = d.hopT > 0 ? Math.sin((0.35 - d.hopT) / 0.35 * Math.PI) * 7 : 0;
      this.drawProp(game, d.kind, d.x, d.y - hop, d.rot ?? 0, t);
    }
    for (const p of game.landedProps) this.drawProp(game, p.kind, p.x, p.y, p.rot ?? 0, t);
    for (const pr of game.projectiles) this.drawProp(game, pr.kind, pr.x, pr.y, pr.rot, t);
  }

  drawFood(game, f, t) {
    const ctx = this.ctx;
    if (spritesReady() && this.drawFoodSprite(game, f, t)) return;
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

  // The painted dishes (S2 intact / S3 damaged, swapped in place
  // on the same anchor). Live effects the paintings cannot do —
  // candle flames, soup steam, the finale's golden pulse — stay
  // code and ride on top.
  drawFoodSprite(game, f, t) {
    const ctx = this.ctx;
    if (f.id === 'cake') {
      if (f.state === 'smashed') {
        drawSprite(ctx, 'cake-dead', f.x, f.y, { w: (f.r + 6) * 2 });
        return true;
      }
      if (f.creamSplats >= 2) {
        // Second hit: the light-damage painting, candles down.
        drawSprite(ctx, 'cake-light', f.x, f.y, { w: (f.r + 6) * 2 });
        return true;
      }
      drawSprite(ctx, 'cake', f.x, f.y, { w: (f.r + 6) * 2 });
      if (f.creamSplats === 1) {
        const a = 2.7 + 1;
        drawSprite(ctx, 'cream-small', f.x + Math.cos(a) * f.r * 0.8, f.y + Math.sin(a) * f.r * 0.7, { w: 30 });
      }
      // Flames by code, one per lit candle, on the painting's ring.
      for (let i = 0; i < f.candlesLit; i++) {
        const c = f.candles[i];
        const cx = f.x + c.dx * 1.19;
        const cy = f.y + c.dy * 1.32;
        const fl = 1 + Math.sin(t * 11 + i * 1.7) * 0.25;
        ctx.fillStyle = '#FFC94A';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 3.4 * fl, 5.4 * fl, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFF3C4';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, 1.6 * fl, 2.8 * fl, 0, 0, TAU);
        ctx.fill();
      }
      if (game.finaleArmed && f.state === 'fresh') {
        const pulse = 1 + Math.sin(t * 5) * 0.1;
        ctx.strokeStyle = 'rgba(255,201,74,0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, (f.r + 18) * pulse, 0, TAU);
        ctx.stroke();
      }
      return true;
    }
    if (f.id === 'soup') {
      if (f.state !== 'fresh') {
        drawSprite(ctx, 'soup-empty', f.x, f.y, { w: f.r * 2 + 10 });
        return true;
      }
      drawSprite(ctx, 'soup', f.x, f.y, { w: f.r * 2 + 10 });
      // Steam by code (the painting was made without it on purpose).
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
      return true;
    }
    if (f.id === 'greens') {
      drawSprite(ctx, f.state === 'smashed' ? 'greens-scattered' : 'greens', f.x, f.y, { w: (f.r + 7) * 2 });
      return true;
    }
    if (f.id === 'chicken') {
      drawSprite(ctx, f.state === 'smashed' ? 'chicken-squashed' : 'chicken', f.x, f.y, { w: (f.r + 12) * 2 });
      return true;
    }
    return false;
  }

  drawProp(game, kind, x, y, rot, t) {
    const ctx = this.ctx;
    // Painted props: cutlery lies horizontal in its frame (prongs
    // and blade to the right), so the game's rot applies as-is.
    // The food hats and the dog's stolen chicken ride here too.
    if (spritesReady()) {
      if (kind === 'fork' && drawSprite(ctx, 'fork', x, y, { w: 64, rot })) return;
      if (kind === 'fork-bent' && drawSprite(ctx, 'fork-bent', x, y, { w: 64, rot })) return;
      if (kind === 'knife' && drawSprite(ctx, 'knife', x, y, { w: 64, rot })) return;
      if (kind === 'cup' && drawSprite(ctx, 'cup', x, y, { w: 36, rot })) return;
      if (kind === 'dentures' && drawSprite(ctx, 'dentures', x, y, { w: 44, rot })) return;
      if (kind === 'greens' && drawSprite(ctx, 'greens', x, y, { w: 52, rot })) return;
      if (kind === 'chicken' && drawSprite(ctx, 'chicken', x, y, { w: 56, rot })) return;
    }
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

  // Harvestable crumbs (P1-2): little morsels with a soft pulse,
  // fading out in their last 0.6s on the cloth.
  drawCrumbs(game, t) {
    const ctx = this.ctx;
    for (const c of game.crumbs) {
      const fade = c.t > c.life - 0.6 ? Math.max(0, (c.life - c.t) / 0.6) : 1;
      const bob = Math.sin(t * 5 + c.phase) * 1.1;
      const r = c.size * (1 + Math.sin(t * 6 + c.phase) * 0.12);
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, r, 0, TAU);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Chain preview (P1-1): whatever the dragged warning currently
  // covers wears its event badge, and derivations with a knowable
  // target get a dashed arrow — the same helpers the game resolves
  // with, so the preview never lies.
  drawChainPreview(game, t) {
    const ctx = this.ctx;
    const GLYPH = { soup: '≈', head: '!', fork: 'Ψ', knife: 'Ψ', cup: '∪', teacup: '∪', cake: '★', greens: '↑', chicken: '↑', dog: '●' };
    for (const atk of game.director.attacks) {
      if (atk.state !== 'warning' || atk.idle || atk.finale) continue;
      if (atk.kind !== 'palm' && atk.kind !== 'poke') continue;
      const prop = game.table.propAt(atk.x, atk.y);
      if (!prop) continue;
      let to = null;
      if (prop.kind === 'soup') {
        const v = game.splashVictim(prop.ref, atk);
        if (v) to = { x: v.x, y: v.y };
      } else if (prop.kind === 'head') {
        const idx = game.table.humans.indexOf(prop.ref);
        const n = game.table.humans[(idx + 1) % game.table.humans.length];
        to = { x: n.x, y: n.y };
      } else if (prop.kind === 'fork' || prop.kind === 'knife') {
        to = game.cutleryLanding(prop.ref, atk);
      } else if (prop.kind === 'greens' || prop.kind === 'chicken') {
        const v = game.foodHatVictim(prop.ref, atk);
        if (v) to = { x: v.x, y: v.y };
      }
      if (to) {
        const dx = to.x - prop.x;
        const dy = to.y - prop.y;
        const len = Math.hypot(dx, dy) || 1;
        const sx = prop.x + (dx / len) * ((prop.r ?? 26) + 18);
        const sy = prop.y + (dy / len) * ((prop.r ?? 26) + 18);
        const ex = to.x - (dx / len) * 16;
        const ey = to.y - (dy / len) * 16;
        ctx.strokeStyle = 'rgba(255,63,164,0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 6]);
        ctx.lineDashOffset = -t * 26;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = Math.atan2(ey - sy, ex - sx);
        ctx.fillStyle = 'rgba(255,63,164,0.9)';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang - 0.42) * 12, ey - Math.sin(ang - 0.42) * 12);
        ctx.lineTo(ex - Math.cos(ang + 0.42) * 12, ey - Math.sin(ang + 0.42) * 12);
        ctx.closePath();
        ctx.fill();
      }
      const bx = prop.x;
      const by = prop.y - (prop.r ?? 26) - 18;
      const pulse = 1 + Math.sin(t * 6) * 0.08;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fillStyle = 'rgba(255,63,164,0.95)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.font = '800 15px "Baloo 2","Trebuchet MS",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(GLYPH[prop.kind] ?? '✸', 0, 1);
      ctx.restore();
    }
  }

  // The replay bar (P0-3): a -600..+300ms axis around the impact,
  // the PERFECT zone in magenta, and where the player's press fell.
  drawMissBar(game) {
    const bar = game.missBar;
    if (!bar || game.state !== 'playing') return;
    const ctx = this.ctx;
    const w = 460;
    const x0 = VIEW.width / 2 - w / 2;
    const y = 262;
    const px = (ms) => x0 + ((ms + 600) / 900) * w;
    const alpha = bar.t < 0.1 ? bar.t / 0.1 : bar.t > bar.dur - 0.25 ? Math.max(0, (bar.dur - bar.t) / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(26,13,32,0.85)';
    roundRect(ctx, x0 - 20, y - 46, w + 40, 92, 12);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // Track, PERFECT zone, impact line.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, x0, y - 6, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.magenta;
    roundRect(ctx, px(-70), y - 6, px(0) - px(-70), 12, 6);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px(0), y - 15);
    ctx.lineTo(px(0), y + 15);
    ctx.stroke();
    ctx.font = '700 11px "Baloo 2","Trebuchet MS",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText('PERFECT', px(-35), y + 12);
    // The press marker (before impact) and the late marker (after).
    if (bar.pressRemainMs != null) {
      ctx.strokeStyle = '#7FE7FF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px(-bar.pressRemainMs), y - 13);
      ctx.lineTo(px(-bar.pressRemainMs), y + 13);
      ctx.stroke();
    }
    if (bar.lateMs != null) {
      ctx.strokeStyle = '#FF5A4E';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px(bar.lateMs), y - 13);
      ctx.lineTo(px(bar.lateMs), y + 13);
      ctx.stroke();
    }
    ctx.font = '800 22px "Baloo 2","Trebuchet MS",sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#FFFFFF';
    const label = bar.lateMs != null
      ? `+${bar.lateMs}ms late`
      : bar.pressRemainMs != null
        ? `Pressed with ${bar.pressRemainMs}ms left — still caught`
        : 'No dodge';
    ctx.fillText(label, VIEW.width / 2, y - 14);
    ctx.restore();
  }

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
    // Aiming (design P1): the attacker leans 8 degrees toward the fly,
    // swells to 1.1x and wears an outline in their shirt colour, so
    // "who is about to swing" reads even when the whole room is angry.
    let lean = 0;
    let swell = 1;
    if (h.aiming) {
      const a = Math.atan2(game.fly.y - y, game.fly.x - x);
      lean = Math.max(-0.14, Math.min(0.14, Math.cos(a) * 0.14));
      swell = 1.1;
    }
    // Frame-change squash-bounce: 1.15x and back in 0.12s.
    const pop = h.popT > 0 ? 1 + Math.sin((1 - h.popT / MOOD.popTime) * Math.PI) * 0.15 : 1;
    ctx.rotate(lean);
    ctx.scale(HEAD_DRAW * swell * pop, HEAD_DRAW * swell * pop); // v5: presence only — see HEAD_DRAW
    if (h.aiming) {
      ctx.strokeStyle = h.look.clothes;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.75 + Math.sin(t * 14) * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, R + 8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Shoulders in the shirt colour, tucked behind the head.
    ctx.fillStyle = h.look.clothes;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.92, R * 1.12, R * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    shade(ctx, 0, R * 0.92, R * 0.8);
    // The painted head (S1): one frame per expression, all
    // normalised to the same head diameter at cut time, so the
    // swap is seamless. "Slapped" is the scared frame, squashed
    // wide, with the X-eyes decal over it (the plan's recipe).
    if (spritesReady()) {
      const key = h.expression === 'slapped' ? 'scared' : h.expression;
      // Slapped: 1.3x wide on the hit, springing back to 1.0 over 0.4s
      // (design P1) — the stretch is visibly an event, not a pose.
      const sk = h.slapT > 0 ? h.slapT / MOOD.slapStretchTime : 0;
      const sx = 1 + 0.3 * sk * sk;
      const sy = 1 - 0.08 * sk * sk;
      const drawn = drawHead(ctx, `${h.name.toLowerCase()}-${key}`, 0, 0, R, { sx, sy });
      if (drawn) {
        // Decal no-go zone (design P1): nothing is stamped over the
        // brow/eye band, so the expression always reads. Soup goes on
        // the bun / crown and runs down the hair, the handprint sits
        // low on the cheek, the X-eyes cover BOTH eyes on the eye line.
        const z = DECAL[h.name] ?? DECAL.Dad;
        if (h.expression === 'slapped') {
          drawSprite(ctx, 'xeyes', 0, R * z.eyeY, { w: R * z.eyeSpan * sx });
        }
        if (h.palmPrint) drawSprite(ctx, 'palmprint', R * z.cheekX * sx, R * z.cheekY, { w: 34, rot: -0.35 });
        if (h.soupFace) drawSprite(ctx, 'soupface', 0, R * z.soupY, { w: R * z.soupW });
        if (h.hatKind) this.drawProp(game, h.hatKind, 0, -R - 4, 0.3, t);
        if (h.steam || (h.expression === 'angry' && h.angryT > 0)) this.drawSteam(ctx, R, t, idx);
        ctx.restore();
        return;
      }
    }
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

  // Two puffs of steam off the crown (angry tier from 55s, provoked).
  drawSteam(ctx, R, t, idx) {
    for (const s of [-1, 1]) {
      const ph = (t * 1.8 + idx * 0.7 + (s > 0 ? 0.5 : 0)) % 1;
      const a = ph < 0.8 ? 0.85 : 0.85 * (1 - (ph - 0.8) / 0.2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(s * R * 0.42, -R * 0.95 - ph * 22);
      ctx.scale(0.6 + ph * 0.6, 0.6 + ph * 0.6);
      circle(ctx, 0, 0, 8, '#FFFFFF');
      circle(ctx, s * 7, -5, 6, '#FFFFFF');
      ctx.restore();
    }
  }

  // Design P1: the evolution ring when the fly changes form.
  drawTierRing(game) {
    const tr = game.tierRing;
    if (!tr) return;
    const ctx = this.ctx;
    const k = tr.t / 0.55;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = 10 * (1 - k) + 2;
    ctx.beginPath();
    ctx.arc(game.fly.x, game.fly.y, 24 + k * 150, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(game.fly.x, game.fly.y, 14 + k * 110, 0, TAU);
    ctx.stroke();
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

  // Only the fallen chandelier is drawn (design #4); the hanging
  // fixture below is kept for the no-sprite fallback but is no
  // longer called while it hangs.
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
    // The painted dog (S2): a head peeking over the table edge.
    // Mid-getaway it still carries the chicken, as a prop.
    if (drawSprite(ctx, 'dog', dog.x, dog.y + Math.sin(t * 6) * 2, { w: 96, flipX: dog.dirX < 0 })) {
      if (dog.state === 'run') this.drawProp(game, 'chicken', dog.x + dog.dirX * 34, dog.y + 14, 0.5, t);
      return;
    }
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
    // P0-3 follow-up: a finale companion palm draws no ring of its
    // own — it is its owner's hand reaching in from that seat,
    // closing on the cake as the main ring tightens.
    if (atk.decor) {
      this.drawReachingHand(game, atk, t);
      return;
    }
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
      // The can itself, raised in the sprayer's hand.
      drawSprite(ctx, 'spray', atk.owner.x + Math.cos(atk.dir) * 44, atk.owner.y + Math.sin(atk.dir) * 44, { w: 44 });
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
    // The shrinking ring. Its pace is the attacker's personality
    // (P1-3): warnProgress bends t into the ring's own clock, so a
    // ring that stalls is genuinely still coming, just slowly.
    // While the hand is still hunting (P0-1) the ring runs as
    // marching ants; once it locks, the ring goes solid and grows
    // its teeth.
    const k = warnProgress(atk);
    const warnFrom = atk.warnFrom ?? 110;
    const r = warnFrom + (atk.radius - warnFrom) * k;
    let jx = atk.x;
    let jy = atk.y;
    if (atk.personality === 'timmy') {
      jx += Math.sin(t * 31) * 1.8;
      jy += Math.cos(t * 27) * 1.8;
    } else if (atk.personality === 'grandpa' && grandpaStalled(atk)) {
      jx += Math.sin(t * 47) * 2.6;
      jy += Math.cos(t * 53) * 2.2;
    }
    let color;
    if (atk.personality === 'mom') {
      // Mom deepens tomato -> crimson as the ring tightens.
      color = `rgba(255,${Math.round(90 - 62 * k)},${Math.round(78 - 42 * k)},${0.35 + 0.25 * k})`;
    } else {
      color = `rgba(255,${Math.round(90 + 165 * k)},${Math.round(78 + 177 * k)},${0.35 + 0.25 * k})`;
    }
    if (remainMs < 200 && Math.floor(t * 20) % 2 === 0) color = 'rgba(255,63,164,0.9)';
    const lockedVis = atk.locked || atk.finale;
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${0.10 + 0.12 * k})`);
    ctx.beginPath();
    ctx.arc(jx, jy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = (atk.finale ? 5 : 3.5) + (lockedVis ? 1.5 : 0);
    ctx.setLineDash(lockedVis ? [] : [12, 9]);
    ctx.lineDashOffset = -t * 36;
    ctx.beginPath();
    ctx.arc(jx, jy, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (lockedVis && !atk.finale) {
      // Lock ticks: four teeth on the ring's compass points.
      ctx.lineWidth = 3;
      for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
        ctx.beginPath();
        ctx.moveTo(jx + Math.cos(a) * (r + 2), jy + Math.sin(a) * (r + 2));
        ctx.lineTo(jx + Math.cos(a) * (r + 9), jy + Math.sin(a) * (r + 9));
        ctx.stroke();
      }
    }
    if (atk.personality === 'grandpa') {
      // Grandpa's shaky second ring, always trailing the real one.
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.45)');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(jx, jy, r + 8, 0, TAU);
      ctx.stroke();
    }
    if (atk.finale) {
      ctx.strokeStyle = 'rgba(255,201,74,0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(atk.x, atk.y, r + 12 + Math.sin(t * 8) * 3, 0, TAU);
      ctx.stroke();
    }
    // The shadow of the coming hand grows over the target — drawn
    // at the (possibly jittered) ring centre so the two never split.
    const shadowK = 0.4 + 0.6 * k;
    ctx.fillStyle = `rgba(20,8,24,${0.10 + 0.16 * k})`;
    ctx.beginPath();
    ctx.ellipse(jx, jy, atk.radius * 1.15 * shadowK + 12, atk.radius * 0.8 * shadowK + 9, 0, 0, TAU);
    ctx.fill();
  }

  // A hand travelling from its owner's seat to the target, 25% of the
  // way at the start of the warning, 85% at impact (the slam frame
  // draws all four hands on the cake).
  drawReachingHand(game, atk, t) {
    const ctx = this.ctx;
    const h = atk.owner;
    const k = Math.min(1, atk.t / atk.dur);
    const ease = k * k * (3 - 2 * k);
    const f = 0.25 + 0.6 * ease;
    const hx = h.x + (atk.x - h.x) * f;
    const hy = h.y + (atk.y - h.y) * f;
    const a = Math.atan2(atk.y - h.y, atk.x - h.x);
    // Its shadow lands ahead of it on the cloth.
    ctx.fillStyle = `rgba(20,8,24,${0.08 + 0.12 * k})`;
    ctx.beginPath();
    ctx.ellipse(hx + Math.cos(a) * 18, hy + Math.sin(a) * 18 + 10, 40, 26, a, 0, TAU);
    ctx.fill();
    const size = 110 + 30 * ease;
    if (!drawPalm(ctx, hx, hy, size, a + Math.PI / 2, h.look.clothes)) {
      this.handPath(ctx, hx, hy, 1.1 + 0.3 * ease, a + Math.PI / 2);
    }
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
    // The main finale slam already draws all four hands below.
    if (atk.decor) return;
    const pop = 1 + Math.max(0, 0.14 - atk.t) * 2.2;
    if (atk.finale) {
      // All four hands, one from each side of the table.
      for (const [i, h] of game.table.humans.entries()) {
        const a = Math.atan2(atk.y - h.y, atk.x - h.x);
        const hx = atk.x - Math.cos(a) * 16 + (i % 2) * 8;
        const hy = atk.y - Math.sin(a) * 16;
        if (!drawPalm(ctx, hx, hy, 128 * pop, a + Math.PI / 2, h.look.clothes)) {
          this.handPath(ctx, hx, hy, 1.25 * pop, a + Math.PI / 2);
        }
      }
      return;
    }
    if (atk.swatter) {
      // The painted swatter (S4), tilted like the code one was.
      if (drawSprite(ctx, 'swatter', atk.x, atk.y - 12, { h: 134 * pop, rot: 0.6 })) return;
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
      // The painted newspaper roll (S4), laid across the impact.
      if (drawSprite(ctx, 'newspaper', atk.x, atk.y, { h: 104 * pop, rot: Math.PI / 2 - 0.5 })) return;
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
      drawSprite(ctx, 'spray', atk.owner.x + Math.cos(atk.dir) * 44, atk.owner.y + Math.sin(atk.dir) * 44, { w: 44 });
      return;
    }
    if (atk.kind === 'poke') {
      // Timmy himself, mid-lunge, hat first — the painted hat
      // (S4) flies tip-first along the charge line.
      const ang = Math.atan2(atk.y - atk.fromY, atk.x - atk.fromX);
      if (drawSprite(ctx, 'party-hat', atk.x, atk.y, { h: 60, rot: ang + Math.PI / 2 })) return;
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
    // The painted palm (S4), its grey cuff tinted to the slapper.
    if (drawPalm(ctx, atk.x, atk.y, 150 * pop, a + Math.PI / 2, atk.owner.look.clothes)) return;
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
    // Raised-bet pips ride above the fly (P1-4): one dot per level.
    if (game.bet > 0 && fly.squashT <= 0) {
      for (let i = 0; i < game.bet; i++) {
        const bx = fly.x - (game.bet - 1) * 8 + i * 16;
        const by = fly.y - 30 + Math.sin(t * 7 + i * 1.3) * 2;
        circle(ctx, bx, by, 5.5, PALETTE.magenta, false);
        circle(ctx, bx, by, 2.2, '#FFFFFF', false);
      }
    }
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
    // The painted body (S4): one frame per combo tier, wings and
    // effects still code. The frame's head points up, the fly's
    // forward is +x — a quarter turn bridges them.
    const tierSprite = { plain: 'fly-plain', gold: 'fly-gold', flame: 'fly-flame', rainbow: 'fly-rainbow' }[tier.id];
    if (tierSprite && drawSprite(ctx, tierSprite, 0, 0, { w: 40, rot: Math.PI / 2 })) {
      ctx.restore();
      return;
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

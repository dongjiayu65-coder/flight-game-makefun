// hud.js — the frame around the game, per spec 1.4/2.10/2.11:
// hearts top-left, a candle-style timer top-centre, the score in
// butter yellow top-right, the combo riding on the fly's shoulder,
// the Party Ruined meter along the bottom, centre announcements,
// the CHAIN banner, and the title / results screens (rank stamp,
// caption, one "so close" line, the 12-cell disaster log).

import { PALETTE, VIEW, GAME } from './config.js';
import { GALLERY } from './copy.js';
import { spritesReady, drawSprite } from './sprites.js';

const TAU = Math.PI * 2;
const OUTLINE = PALETTE.ink;
const FONT = '"Baloo 2","Trebuchet MS",sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Hud {
  constructor(ctx) {
    this.ctx = ctx;
    this.announceText = '';
    this.announceT = 0;
    this.announceDur = 1;
    // The family photo (art set F4 clean / F3 ruined, approved
    // 2026-11-26): drawn on the results screen, with this run's
    // damage overlaid on the clean print.
    this.photoClean = new Image();
    this.photoClean.src = 'assets/photo-clean.jpg';
    this.photoRuined = new Image();
    this.photoRuined.src = 'assets/photo-ruined.jpg';
  }

  announce(text, holdSeconds = 2) {
    if (!text) return;
    this.announceText = text;
    this.announceT = holdSeconds;
    this.announceDur = holdSeconds;
  }

  draw(game, dt) {
    if (this.announceT > 0) this.announceT -= dt;
    if (game.state === 'title') return this.drawTitle(game);
    if (game.state === 'results') return this.drawResults(game);
    this.drawHud(game, dt);
  }

  slideK(game, delay) {
    const k = Math.min(1, Math.max(0, (game.hudSlideT - delay) / 0.4));
    return k * k * (3 - 2 * k);
  }

  drawHud(game, dt) {
    const ctx = this.ctx;
    const t = game.time;
    // Hearts, top-left.
    const hk = this.slideK(game, 0);
    if (hk > 0) {
      ctx.save();
      ctx.translate(0, -46 * (1 - hk));
      for (let i = 0; i < GAME.hp; i++) {
        const x = 44 + i * 44;
        const y = 40;
        const alive = i < game.hp;
        ctx.fillStyle = alive ? PALETTE.tomato : 'rgba(43,27,46,0.55)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 11);
        ctx.bezierCurveTo(x - 17, y - 4, x - 9, y - 17, x, y - 7);
        ctx.bezierCurveTo(x + 9, y - 17, x + 17, y - 4, x, y + 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    // The candle timer, top-centre: a wax bar that burns down.
    const tk = this.slideK(game, 0.15);
    if (tk > 0) {
      ctx.save();
      ctx.translate(0, -46 * (1 - tk));
      const w = 300;
      const x = VIEW.width / 2 - w / 2;
      const y = 26;
      const left = Math.max(0, 1 - game.elapsed / GAME.duration);
      ctx.fillStyle = 'rgba(43,27,46,0.6)';
      roundRect(ctx, x - 6, y - 6, w + 12, 26, 10);
      ctx.fill();
      ctx.fillStyle = '#FFF6E8';
      roundRect(ctx, x, y, w, 14, 7);
      ctx.fill();
      ctx.fillStyle = game.elapsed > 75 ? PALETTE.tomato : PALETTE.butter;
      if (left > 0.01) {
        roundRect(ctx, x, y, w * left, 14, 7);
        ctx.fill();
      }
      // The flame rides the melt line.
      const fx = x + w * left;
      const fl = 1 + Math.sin(t * 12) * 0.22;
      ctx.fillStyle = PALETTE.butter;
      ctx.beginPath();
      ctx.ellipse(fx, y - 4, 4.6 * fl, 7.6 * fl, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFF3C4';
      ctx.beginPath();
      ctx.ellipse(fx, y - 3, 2.2 * fl, 4 * fl, 0, 0, TAU);
      ctx.fill();
      ctx.font = `800 19px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      const label = game.tutorial !== 'done' ? 'WARM-UP' : `${Math.ceil(GAME.duration - game.elapsed)}s`;
      ctx.strokeText(label, VIEW.width / 2, y + 34);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, VIEW.width / 2, y + 34);
      ctx.restore();
    }
    // Score, top-right.
    const sk = this.slideK(game, 0.3);
    if (sk > 0) {
      ctx.save();
      ctx.translate(0, -56 * (1 - sk));
      ctx.font = `800 40px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(String(game.score), VIEW.width - 30, 52);
      ctx.fillStyle = PALETTE.butter;
      ctx.fillText(String(game.score), VIEW.width - 30, 52);
      if (game.bestScore > 0) {
        ctx.font = `700 15px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeText(`BEST ${game.bestScore}`, VIEW.width - 30, 76);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`BEST ${game.bestScore}`, VIEW.width - 30, 76);
      }
      ctx.restore();
    }
    // Party Ruined meter, top-left under the hearts (v5: the
    // bottom-centre spot sat squarely on Dad's head).
    const dk = this.slideK(game, 0.45);
    if (dk > 0) {
      ctx.save();
      ctx.translate(0, -46 * (1 - dk));
      const w = 240;
      const x = 30;
      const y = 94;
      ctx.font = `800 14px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText('PARTY RUINED', x, y - 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PARTY RUINED', x, y - 8);
      ctx.fillStyle = 'rgba(43,27,46,0.6)';
      roundRect(ctx, x - 4, y + 2, w + 8, 16, 8);
      ctx.fill();
      const pct = Math.min(1, game.destruction01);
      if (pct > 0.01) {
        ctx.fillStyle = pct >= 1 ? PALETTE.magenta : PALETTE.tomato;
        roundRect(ctx, x, y + 5, w * pct, 10, 5);
        ctx.fill();
      }
      ctx.font = `800 15px ${FONT}`;
      ctx.fillStyle = PALETTE.butter;
      ctx.fillText(`${Math.round(game.destruction01 * 100)}%`, x + w + 14, y + 14);
      ctx.restore();
    }
    // The combo rides on the fly (spec 1.4), magenta and growing.
    if (game.combo >= 2) {
      const decaying = game.clock - game.lastGoodClock > 4;
      ctx.save();
      ctx.translate(game.fly.x + 30, game.fly.y - 26);
      if (decaying) ctx.translate(Math.sin(t * 30) * 1.6, 0);
      ctx.font = `800 ${20 + Math.min(16, game.combo)}px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(`x${game.combo}`, 0, 0);
      ctx.fillStyle = decaying ? '#9a8fa8' : PALETTE.magenta;
      ctx.fillText(`x${game.combo}`, 0, 0);
      ctx.restore();
    }
    // CHAIN banner, fixed under the timer (spec 1.5).
    if (game.chainPop) {
      game.chainPop.t += dt;
      const cp = game.chainPop;
      if (cp.t > 1.1) game.chainPop = null;
      else {
        const subs = { 3: 'Chaos!', 4: 'Total chaos!', 5: 'DOMINO DINNER!' };
        ctx.save();
        ctx.translate(VIEW.width / 2, 118);
        const pop = cp.t < 0.12 ? 0.7 + (cp.t / 0.12) * 0.3 : 1;
        ctx.scale(pop, pop);
        ctx.globalAlpha = cp.t > 0.85 ? 1 - (cp.t - 0.85) / 0.25 : 1;
        ctx.font = `800 ${48 + cp.n * 4}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 7;
        ctx.strokeStyle = OUTLINE;
        ctx.strokeText(`CHAIN x${cp.n}`, 0, 0);
        ctx.fillStyle = PALETTE.butter;
        ctx.fillText(`CHAIN x${cp.n}`, 0, 0);
        if (subs[cp.n]) {
          ctx.font = `800 22px ${FONT}`;
          ctx.lineWidth = 5;
          ctx.strokeText(subs[cp.n], 0, 32);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(subs[cp.n], 0, 32);
        }
        ctx.restore();
      }
    }
    // Announcements.
    if (this.announceT > 0 && this.announceText) {
      const a = Math.min(1, this.announceT / 0.3, (this.announceDur - this.announceT) / 0.15 + 0.2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `800 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(this.announceText, VIEW.width / 2, 168);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.announceText, VIEW.width / 2, 168);
      ctx.restore();
    }
    // Tutorial stage directions.
    if (game.tutorial === 'script' && game.tutPhase === 'soup') {
      ctx.save();
      ctx.font = `800 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = OUTLINE;
      const msg = 'Land on the soup. Taunt them. Then DODGE.';
      ctx.strokeText(msg, VIEW.width / 2, VIEW.height - 66);
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillText(msg, VIEW.width / 2, VIEW.height - 66);
      ctx.restore();
    }
    if (game.paused) {
      ctx.fillStyle = 'rgba(11,6,18,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 7;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText('PAUSED', VIEW.width / 2, VIEW.height / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2);
    }
  }

  drawTitle(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,10,28,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(VIEW.width / 2, 218);
    ctx.rotate(-0.02);
    ctx.font = `800 64px ${FONT}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText('ONE FLY RUINS A', 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('ONE FLY RUINS A', 0, 0);
    ctx.strokeText('BIRTHDAY PARTY', 0, 66);
    ctx.fillStyle = PALETTE.butter;
    ctx.fillText('BIRTHDAY PARTY', 0, 66);
    ctx.restore();
    ctx.font = `700 23px ${FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUTLINE;
    const lines = [
      'Land on food, faces — anything. Somebody WILL swing.',
      'Dodge at the last instant for PERFECT. Wreck the table. Chain the chaos.',
      'At 0:10 the cake becomes the whole point.',
    ];
    lines.forEach((line, i) => {
      ctx.strokeText(line, VIEW.width / 2, 356 + i * 32);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(line, VIEW.width / 2, 356 + i * 32);
    });
    const pulse = 0.75 + Math.sin(game.time * 4) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.font = `800 30px ${FONT}`;
    ctx.lineWidth = 6;
    ctx.strokeText('CLICK OR PRESS SPACE', VIEW.width / 2, 520);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillText('CLICK OR PRESS SPACE', VIEW.width / 2, 520);
    ctx.globalAlpha = 1;
    ctx.font = `700 18px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeText('Mouse to fly · SPACE / right-click to dodge · P pauses', VIEW.width / 2, 566);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Mouse to fly · SPACE / right-click to dodge · P pauses', VIEW.width / 2, 566);
    if (game.bestScore > 0) {
      ctx.font = `800 19px ${FONT}`;
      ctx.strokeText(`BEST: ${game.bestScore}`, VIEW.width / 2, 606);
      ctx.fillStyle = PALETTE.butter;
      ctx.fillText(`BEST: ${game.bestScore}`, VIEW.width / 2, 606);
    }
  }

  drawResults(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(16,8,24,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const rank = game.rank ?? GAME.ranks[GAME.ranks.length - 1];
    this.drawPhoto(game);
    // Rank stamp, top-right.
    ctx.save();
    ctx.translate(1184, 122);
    ctx.rotate(0.16);
    ctx.font = `800 74px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.magenta;
    ctx.strokeText(rank.id, 0, 0);
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText(rank.stamp, 0, 30);
    ctx.restore();
    // Caption + stats down the right column.
    const cxR = 872;
    ctx.textAlign = 'center';
    let capSize = 26;
    ctx.font = `800 ${capSize}px ${FONT}`;
    const cap = game.caption || '';
    while (ctx.measureText(cap).width > 500 && capSize > 17) {
      capSize -= 2;
      ctx.font = `800 ${capSize}px ${FONT}`;
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText(cap, cxR, 108);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cap, cxR, 108);
    if (game.newBest) {
      ctx.font = `800 20px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeText('NEW BEST!', cxR, 142);
      ctx.fillStyle = PALETTE.magenta;
      ctx.fillText('NEW BEST!', cxR, 142);
    }
    ctx.textAlign = 'left';
    const rows = [
      ['SCORE', `${game.score}`],
      ['BEST COMBO', `x${game.maxCombo}`],
      ['LONGEST CHAIN', `x${Math.max(1, game.longestChain)}`],
      ['PARTY RUINED', `${Math.round(game.destruction01 * 100)}%`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 226 + i * 46;
      ctx.font = `700 20px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(k, 566, y);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(k, 566, y);
      ctx.font = `800 27px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeText(v, 806, y);
      ctx.fillStyle = PALETTE.butter;
      ctx.fillText(v, 806, y);
    });
    if (game.lifeBonus > 0) {
      ctx.font = `700 16px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      const note = `(score includes +${game.lifeBonus} for the lives you kept)`;
      ctx.strokeText(note, 566, 226 + 4 * 46);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(note, 566, 226 + 4 * 46);
    }
    if (game.nearMissLine) {
      ctx.textAlign = 'center';
      ctx.font = `800 21px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(game.nearMissLine, cxR, 478);
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillText(game.nearMissLine, cxR, 478);
    }
    // The disaster log: 12 cells across the bottom.
    ctx.textAlign = 'center';
    ctx.font = `800 19px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText('DISASTER LOG', VIEW.width / 2, 540);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('DISASTER LOG', VIEW.width / 2, 540);
    const cols = 6;
    const cw = 196;
    const ch = 58;
    const gx = VIEW.width / 2 - (cols * cw) / 2;
    const gy = 552;
    GALLERY.forEach((g, i) => {
      const cx = gx + (i % cols) * cw;
      const cy = gy + Math.floor(i / cols) * (ch + 8);
      const unlocked = game.metaGallery.has(g.id);
      ctx.fillStyle = unlocked ? 'rgba(255,201,74,0.16)' : 'rgba(255,255,255,0.05)';
      roundRect(ctx, cx + 4, cy, cw - 8, ch, 9);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = unlocked ? PALETTE.butter : 'rgba(255,255,255,0.25)';
      ctx.stroke();
      ctx.font = `800 14.5px ${FONT}`;
      ctx.fillStyle = unlocked ? PALETTE.butter : 'rgba(255,255,255,0.55)';
      ctx.fillText(unlocked ? g.name : '???', cx + cw / 2, cy + 21);
      ctx.font = `600 11px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const sub = unlocked ? g.desc : g.hint;
      ctx.fillText(sub.length > 32 ? sub.slice(0, 31) + '\u2026' : sub, cx + cw / 2, cy + 41);
    });
    const ready = game.time - game.finishTime > 0.8;
    if (ready) {
      const pulse = 0.7 + Math.sin(game.time * 4) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.font = `800 24px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText('BUZZ AGAIN \u2014 PRESS R', VIEW.width / 2, 716);
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillText('BUZZ AGAIN \u2014 PRESS R', VIEW.width / 2, 716);
      ctx.globalAlpha = 1;
    }
  }

  // The family photo: the clean print (F4) with this run's damage
  // overlaid, or — once the party is more than half ruined — the
  // fully ruined print (F3). Falls back to a hand-drawn strip while
  // the images are still loading.
  drawPhoto(game) {
    const ctx = this.ctx;
    const px = 36;
    const py = 44;
    const size = 452;
    const ruined = game.destruction01 >= 0.55;
    const img = ruined ? this.photoRuined : this.photoClean;
    ctx.save();
    ctx.translate(px + size / 2, py + size / 2);
    ctx.rotate(-0.012);
    ctx.translate(-size / 2, -size / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, size, size);
      ctx.shadowColor = 'transparent';
      if (!ruined) this.photoDamage(game, size);
      else if (game.events.cakeBoom) this.creamSplat(size * 0.5, size * 0.74, 30);
    } else {
      ctx.shadowColor = 'transparent';
      this.drawPhotoFallback(game, 0, 0, size);
    }
    ctx.restore();
  }

  creamSplat(x, y, r) {
    const ctx = this.ctx;
    // The painted cream decals (S5) first; code blobs as fallback.
    if (spritesReady()) {
      const name = r >= 28 ? 'cream-big' : r >= 16 ? 'cream-mid' : 'cream-small';
      if (drawSprite(ctx, name, x, y, { w: r * 2.5 })) return;
    }
    ctx.fillStyle = 'rgba(255,240,244,0.92)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7 + x;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.4, r * (0.35 + (i % 3) * 0.12), r * 0.26, a, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, TAU);
    ctx.fill();
  }

  photoDamage(game, size) {
    const ctx = this.ctx;
    // Face anchors inside the clean print (relative to its frame).
    const anchors = {
      Dad: [0.20, 0.30],
      Timmy: [0.40, 0.47],
      Mom: [0.63, 0.30],
      Grandpa: [0.86, 0.38],
    };
    for (const h of game.table.humans) {
      const a = anchors[h.name];
      if (!a) continue;
      const x = a[0] * size;
      const y = a[1] * size;
      if (h.soupFace) {
        if (!(spritesReady() && drawSprite(ctx, 'soupface', x, y - size * 0.01, { w: size * 0.17 }))) {
          ctx.fillStyle = 'rgba(232,116,59,0.92)';
          ctx.beginPath();
          ctx.arc(x, y - size * 0.045, size * 0.052, Math.PI, TAU);
          ctx.fill();
          for (let d = 0; d < 3; d++) {
            ctx.beginPath();
            ctx.ellipse(x - size * 0.03 + d * size * 0.03, y - size * 0.03, 3.4, 9 + d * 3, 0, 0, TAU);
            ctx.fill();
          }
        }
      }
      if (h.palmPrint) {
        if (!(spritesReady() && drawSprite(ctx, 'palmprint', x + size * 0.035, y + size * 0.02, { w: size * 0.085, rot: 0.5 }))) {
          ctx.save();
          ctx.translate(x + size * 0.035, y + size * 0.02);
          ctx.rotate(0.5);
          ctx.fillStyle = 'rgba(255,64,54,0.8)';
          ctx.beginPath();
          ctx.ellipse(0, 3, 8.5, 10, 0, 0, TAU);
          ctx.fill();
          for (let f = 0; f < 4; f++) {
            ctx.beginPath();
            ctx.ellipse(-6 + f * 4.2, -7, 2.2, 5, (f - 1.5) * 0.16, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      if (h.hatKind === 'greens' || h.hatKind === 'chicken') {
        if (!(spritesReady() && drawSprite(ctx, h.hatKind, x, y - size * 0.075, { w: size * 0.11, rot: 0.3 }))) {
          if (h.hatKind === 'greens') {
            ctx.fillStyle = '#4CAF50';
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.ellipse(x + Math.cos(i * 1.9) * 8, y - size * 0.075 + Math.sin(i * 1.9) * 3, 9, 5.5, i, 0, TAU);
              ctx.fill();
            }
          } else {
            ctx.fillStyle = '#D98E32';
            ctx.beginPath();
            ctx.ellipse(x, y - size * 0.075, 13, 8, 0.3, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    if (game.events.dentures) {
      // Grandpa's teeth, mid-flight, top-right — just like F3.
      if (!(spritesReady() && drawSprite(ctx, 'dentures', size * 0.74, size * 0.15, { w: size * 0.1, rot: -0.25 }))) {
        ctx.save();
        ctx.translate(size * 0.74, size * 0.15);
        ctx.rotate(-0.25);
        ctx.fillStyle = '#FF9FB2';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        for (let i = -2; i <= 2; i++) ctx.fillRect(i * 4.6 - 2, 4, 4, 7);
        ctx.restore();
      }
    }
    if (game.table.humans[3].glassesOff) {
      ctx.save();
      ctx.translate(size * 0.13, size * 0.85);
      ctx.rotate(0.4);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(-9, 0, 7.5, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9, 0, 7.5, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(2, -2);
      ctx.stroke();
      ctx.restore();
    }
    if (game.events.cakeBoom) {
      this.creamSplat(size * 0.5, size * 0.74, 34);
      this.creamSplat(size * 0.38, size * 0.68, 18);
      this.creamSplat(size * 0.62, size * 0.8, 20);
      // The culprit, sitting in the wreckage.
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.72, 7, 5.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#E8332A';
      ctx.beginPath();
      ctx.arc(size * 0.5 + 5, size * 0.72 - 2.4, 2.6, 0, TAU);
      ctx.arc(size * 0.5 + 5, size * 0.72 + 2.4, 2.6, 0, TAU);
      ctx.fill();
    }
    if (game.destruction01 >= 0.25) {
      // General splatter, seeded by the score so the print is
      // stable across frames.
      let seed = game.score * 7 + 13;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 4; i++) {
        this.creamSplat(size * (0.15 + rnd() * 0.7), size * (0.2 + rnd() * 0.6), 9 + rnd() * 9);
      }
    }
  }

  drawPhotoFallback(game, x, y, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#FFF6E8';
    roundRect(ctx, 0, 0, size, size * 0.42, 10);
    ctx.fill();
    ctx.fillStyle = '#3A2A4A';
    roundRect(ctx, 8, 8, size - 16, size * 0.42 - 16, 6);
    ctx.fill();
    game.table.humans.forEach((h, i) => {
      const hx = 62 + i * (size - 100) / 3;
      const hy = size * 0.21;
      ctx.fillStyle = h.look.clothes;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 34, 40, 20, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = h.look.skin ?? PALETTE.skin;
      ctx.beginPath();
      ctx.arc(hx, hy, 31, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      if (h.soupFace) {
        ctx.fillStyle = 'rgba(232,116,59,0.9)';
        ctx.beginPath();
        ctx.arc(hx, hy - 10, 24, Math.PI, TAU);
        ctx.fill();
      }
      if (h.palmPrint) {
        ctx.fillStyle = 'rgba(255,64,54,0.8)';
        ctx.beginPath();
        ctx.ellipse(hx + 11, hy + 3, 8, 9.5, 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#FFF6E8';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(h.name, hx, size * 0.42 - 14);
    });
    ctx.restore();
  }
}

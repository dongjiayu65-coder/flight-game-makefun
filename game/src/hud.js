// hud.js — the screen-fixed layer: hearts and the PARTY RUINED
// meter in the top-left (clear of Mom's face), the clock up top,
// the score top-right, announcements, and the title / results
// overlays including the family photo. Constructed with the
// canvas context; draw(game, dt) is called once a frame.

import { GAME, VIEW } from './config.js';

const INK = '#2B1B2E';
const FONT = '"Baloo 2", system-ui, sans-serif';

export class Hud {
  constructor(ctx) {
    this.ctx = ctx;
    this.notes = []; // { text, t, dur }
    this.photoClean = new Image();
    this.photoClean.src = 'assets/photo-clean.jpg';
    this.photoRuined = new Image();
    this.photoRuined.src = 'assets/photo-ruined.jpg';
  }

  announce(text, dur = 1.6) {
    this.notes.push({ text, t: 0, dur });
    if (this.notes.length > 2) this.notes.shift();
  }

  draw(game, dt) {
    const ctx = this.ctx;
    for (const n of this.notes) n.t += dt;
    this.notes = this.notes.filter((n) => n.t < n.dur);
    if (game.state === 'title') {
      this.drawTitle(ctx, game);
      return;
    }
    this.drawMeters(ctx, game);
    this.drawNotes(ctx);
    if (game.state === 'results') this.drawResults(ctx, game);
  }

  drawMeters(ctx, game) {
    // Hearts.
    for (let i = 0; i < GAME.hp; i++) {
      const x = 30 + i * 38;
      const y = 30;
      ctx.save();
      ctx.globalAlpha = i < game.hp ? 1 : 0.22;
      ctx.fillStyle = '#FF5A4E';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.bezierCurveTo(x - 15, y - 8, x - 6, y - 16, x, y - 6);
      ctx.bezierCurveTo(x + 6, y - 16, x + 15, y - 8, x, y + 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // PARTY RUINED meter, top-left under the hearts.
    const ruined = Math.min(1, game.chaosTotal / GAME.destructionFull);
    const bx = 16;
    const by = 52;
    const bw = 216;
    ctx.fillStyle = 'rgba(26,15,34,0.55)';
    roundRect(ctx, bx - 4, by - 4, bw + 8, 30, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, bx, by, bw, 13, 6);
    ctx.fill();
    if (ruined > 0) {
      ctx.fillStyle = '#FF3FA4';
      roundRect(ctx, bx, by, bw * ruined, 13, 6);
      ctx.fill();
    }
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`PARTY RUINED ${Math.round(ruined * 100)}%`, bx + 2, by + 27);

    // Clock, top-centre.
    const remain = Math.max(0, GAME.duration - game.elapsed);
    const cw = 340;
    const cx = VIEW.width / 2 - cw / 2;
    ctx.fillStyle = 'rgba(26,15,34,0.55)';
    roundRect(ctx, cx - 4, 8, cw + 8, 22, 8);
    ctx.fill();
    ctx.fillStyle = remain <= 10 ? '#FF5A4E' : '#FFC94A';
    if (game.tutorial === 'done') {
      roundRect(ctx, cx, 12, cw * (remain / GAME.duration), 14, 6);
      ctx.fill();
    }
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(game.tutorial === 'done' ? `${Math.ceil(remain)}s` : 'TUTORIAL', VIEW.width / 2, 46);

    // Score, top-right.
    ctx.textAlign = 'right';
    ctx.font = `800 15px ${FONT}`;
    ctx.fillStyle = '#FFE9A3';
    ctx.fillText('SCORE', VIEW.width - 18, 24);
    ctx.font = `800 34px ${FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.strokeText(String(game.score), VIEW.width - 18, 58);
    ctx.fillStyle = '#FFC94A';
    ctx.fillText(String(game.score), VIEW.width - 18, 58);
    ctx.textAlign = 'left';
  }

  drawNotes(ctx) {
    const n = this.notes[0];
    if (!n) return;
    const pop = n.t < 0.15 ? 0.6 + (n.t / 0.15) * 0.4 : 1;
    const fade = n.t > n.dur - 0.3 ? Math.max(0, (n.dur - n.t) / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(VIEW.width / 2, 120);
    ctx.scale(pop, pop);
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.strokeText(n.text, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(n.text, 0, 0);
    ctx.restore();
  }

  drawTitle(ctx, game) {
    ctx.fillStyle = 'rgba(26,15,34,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `800 64px ${FONT}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#FFC94A';
    ['ONE FLY RUINS', 'A BIRTHDAY PARTY'].forEach((line, i) => {
      const y = 268 + i * 68;
      ctx.strokeText(line, VIEW.width / 2, y);
      ctx.fillText(line, VIEW.width / 2, y);
    });
    ctx.font = `800 24px ${FONT}`;
    ctx.lineWidth = 6;
    ctx.fillStyle = '#FFFFFF';
    const sub = 'Taunt the family. Dodge at the last instant. Ruin everything.';
    ctx.strokeText(sub, VIEW.width / 2, 428);
    ctx.fillText(sub, VIEW.width / 2, 428);
    ctx.textAlign = 'left';
  }

  drawResults(ctx, game) {
    ctx.fillStyle = 'rgba(26,15,34,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const pw = 620;
    const ph = 480;
    const px = VIEW.width / 2 - pw / 2;
    const py = 120;
    ctx.fillStyle = '#FFF8EA';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.stroke();

    const rank = game.rank;
    const ruined = Math.min(1, game.chaosTotal / GAME.destructionFull);
    ctx.textAlign = 'center';
    ctx.font = `800 38px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(rank && rank.id === 'C' ? 'PARTY... FINE' : 'PARTY RUINED', VIEW.width / 2, py + 50);

    // The family photo: the ruined print once the party is at
    // least half destroyed, the clean one otherwise.
    const img = ruined >= 0.5 ? this.photoRuined : this.photoClean;
    if (img && img.complete && img.naturalWidth > 0) {
      const iw = 300;
      const ih = (iw * img.naturalHeight) / img.naturalWidth;
      ctx.drawImage(img, VIEW.width / 2 - iw / 2, py + 66, iw, ih);
    }

    if (rank) {
      ctx.save();
      ctx.translate(px + pw - 104, py + 62);
      ctx.rotate(-0.22);
      ctx.font = `800 24px ${FONT}`;
      const label = `${rank.id} — ${rank.stamp}`;
      const w = ctx.measureText(label).width + 26;
      ctx.strokeStyle = '#FF5A4E';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-w / 2, -23, w, 38);
      ctx.fillStyle = '#FF5A4E';
      ctx.fillText(label, 0, 5);
      ctx.restore();
    }

    ctx.font = `800 21px ${FONT}`;
    ctx.fillStyle = INK;
    const rows = [
      `Score  ${game.score}`,
      `Longest Chain  x${game.longestChain ?? 0}      Party Destroyed  ${Math.round(ruined * 100)}%`,
    ];
    rows.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, py + 300 + i * 34));

    // The "so close" line, whenever a higher rank exists.
    if (rank) {
      const idx = GAME.ranks.indexOf(rank);
      if (idx > 0) {
        const next = GAME.ranks[idx - 1];
        ctx.font = `800 20px ${FONT}`;
        ctx.fillStyle = '#FF3FA4';
        ctx.fillText(`Only ${next.min - game.score} pts from ${next.id} rank!`, VIEW.width / 2, py + 386);
      }
    }
    ctx.font = `800 19px ${FONT}`;
    ctx.fillStyle = '#5A4632';
    ctx.fillText('BUZZ AGAIN  [R]', VIEW.width / 2, py + 436);
    ctx.textAlign = 'left';
  }
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

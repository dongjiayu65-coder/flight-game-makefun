// hud.js — the screen-fixed layer: hearts and the PARTY RUINED
// meter in the top-left (clear of Mom's face), the clock up top,
// the score top-right, announcements, and the title / results
// overlays including the family photo. Constructed with the
// canvas context; draw(game, dt) is called once a frame.

import { GAME, VIEW } from './config.js';

const INK = '#2B1B2E';
const FONT = '"Baloo 2", system-ui, sans-serif';

// The disaster log's twelve cards, in grid order. Hints are
// always readable; a card's name only shows once its disaster
// has actually happened (its id lands in game.metaGallery).
const DISASTER_CARDS = [
  { id: 'dadSlapsDad', name: 'Dad Slaps Dad', hint: 'He was aiming for you.' },
  { id: 'soupHair', name: 'Soup Hair', hint: "Mom's hair looks... absorbent." },
  { id: 'cutleryFly', name: 'Cutlery Cannon', hint: 'Make the cutlery fly.' },
  { id: 'lampDrop', name: 'Lamp Drop', hint: 'Look up. Way up.' },
  { id: 'denturesOut', name: 'Dentures Out', hint: "Grandpa's smile is detachable." },
  { id: 'dogVisit', name: 'A Guest Arrives', hint: 'Sometimes a guest arrives.' },
  { id: 'brawl', name: 'Table Brawl', hint: 'Start a fight. Then another. Then another.' },
  { id: 'blackoutDodge', name: 'Dark Dodge', hint: 'Dodge perfectly in the dark.' },
  { id: 'photoSmile', name: 'Photo Finish', hint: 'Smile for the camera.' },
  { id: 'chain5', name: 'Chain Reaction', hint: 'One slap, five disasters.' },
  { id: 'neverStop', name: 'Relentless', hint: 'Never stop dodging.' },
  { id: 'finaleSlap', name: 'The Final Slap', hint: 'Nail the final slap.' },
];

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
    // The reference build shows no chrome at all during the
    // scripted tutorial — just the family and the prompts.
    if (game.state === 'playing' && game.tutorial !== 'done') return;
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
    // PARTY RUINED meter, top-left under the hearts: label over
    // the bar, percentage at the bar's right end.
    const ruined = Math.min(1, game.chaosTotal / GAME.destructionFull);
    const bx = 18;
    const bw = 250;
    ctx.font = `800 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('PARTY RUINED', bx, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, bx, 70, bw, 12, 6);
    ctx.fill();
    if (ruined > 0) {
      ctx.fillStyle = '#FF6A3C';
      roundRect(ctx, bx, 70, bw * ruined, 12, 6);
      ctx.fill();
    }
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = '#FFC94A';
    ctx.fillText(`${Math.round(ruined * 100)}%`, bx + bw + 8, 82);

    // Round clock under it: a pale track that fills yellow as
    // the ninety seconds burn down, seconds left at its end.
    const remain = Math.max(0, GAME.duration - game.elapsed);
    const spent = Math.min(1, game.elapsed / GAME.duration);
    ctx.fillStyle = '#F5EFE2';
    roundRect(ctx, bx, 92, bw, 12, 6);
    ctx.fill();
    if (spent > 0) {
      ctx.fillStyle = remain <= 10 ? '#FF5A4E' : '#FFC94A';
      roundRect(ctx, bx, 92, bw * spent, 12, 6);
      ctx.fill();
    }
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${Math.ceil(remain)}s`, bx + bw + 8, 104);

    // Score, top-right: the number alone, big and gold.
    ctx.textAlign = 'right';
    ctx.font = `800 30px ${FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.strokeText(String(game.score), VIEW.width - 20, 48);
    ctx.fillStyle = '#FFC94A';
    ctx.fillText(String(game.score), VIEW.width - 20, 48);
    ctx.textAlign = 'left';
  }

  drawNotes(ctx) {
    const n = this.notes[0];
    if (!n) return;
    const pop = n.t < 0.15 ? 0.6 + (n.t / 0.15) * 0.4 : 1;
    const fade = n.t > n.dur - 0.3 ? Math.max(0, (n.dur - n.t) / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(VIEW.width / 2, 280);
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
    // Full-screen layout, matched to the reference build: dimmed
    // room, the family polaroid big on the left, headline and
    // stats on the right, rank letter in the corner, and the
    // disaster log grid along the bottom.
    ctx.fillStyle = 'rgba(26,15,34,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const rank = game.rank;
    const ruined = Math.min(1, game.chaosTotal / GAME.destructionFull);

    // The polaroid: the ruined print once the finale landed or
    // the party is well wrecked, the clean one otherwise.
    const img = (ruined >= 0.25 || game.finaleDone) ? this.photoRuined : this.photoClean;
    ctx.save();
    ctx.translate(258, 292);
    ctx.rotate(-0.03);
    ctx.fillStyle = '#FFFDF6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillRect(-200, -218, 400, 436);
    ctx.strokeRect(-200, -218, 400, 436);
    if (img && img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(360 / iw, 330 / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-180, -198, 360, 330);
      ctx.clip();
      ctx.drawImage(img, -180 + (360 - dw) / 2, -198 + (330 - dh) / 2, dw, dh);
      ctx.restore();
    }
    ctx.font = '700 27px "Segoe Script", "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4A2C1A';
    ctx.fillText('Happy Birthday!', 0, 190);
    ctx.restore();

    // Headline and the new-best flag.
    ctx.textAlign = 'left';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(ruined < 0.5
      ? "Timmy's birthday was... a little sticky."
      : "Timmy's birthday was... a beautiful disaster.", 520, 118);
    if (game.newBest) {
      ctx.font = `800 17px ${FONT}`;
      ctx.fillStyle = '#FF3FA4';
      ctx.fillText('NEW BEST!', 520, 148);
    }

    // Rank letter and verdict, top-right, tipped a little.
    if (rank) {
      ctx.save();
      ctx.translate(1152, 104);
      ctx.rotate(0.07);
      ctx.font = `800 74px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF5DA2';
      ctx.fillText(rank.id, 0, 0);
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(rank.stamp, 0, 44);
      ctx.restore();
    }

    // Stat rows.
    const rows = [
      ['SCORE', String(game.score)],
      ['BEST COMBO', `x${game.maxCombo ?? game.bestCombo ?? 0}`],
      ['LONGEST CHAIN', `x${game.longestChain ?? 0}`],
      ['PARTY RUINED', `${Math.round(ruined * 100)}%`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 212 + i * 44;
      ctx.font = `800 16px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#E8DDF2';
      ctx.fillText(label, 520, y);
      ctx.font = `800 25px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFC94A';
      ctx.fillText(value, 1000, y);
    });
    ctx.textAlign = 'left';
    if (game.lifeBonus > 0) {
      ctx.font = `600 13px ${FONT}`;
      ctx.fillStyle = '#CFC4DD';
      ctx.fillText(`(score includes +${game.lifeBonus} for the lives you kept)`, 520, 378);
    }

    // The "so close" line, whenever a higher rank exists.
    if (rank) {
      const idx = GAME.ranks.indexOf(rank);
      if (idx > 0) {
        const next = GAME.ranks[idx - 1];
        const gap = next.min - game.score;
        if (gap > 0) {
          ctx.font = `800 17px ${FONT}`;
          ctx.fillStyle = '#57C8FF';
          ctx.fillText(`Only ${gap} pts from ${next.id} rank!`, 520, 410);
        }
      }
    }

    // Disaster log: twelve cards, found ones named in gold,
    // the rest still ??? with their hint showing.
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E8DDF2';
    ctx.fillText('DISASTER LOG', VIEW.width / 2, 498);
    const found = game.metaGallery instanceof Set ? game.metaGallery : new Set();
    const cw = 196;
    const ch = 56;
    const gap = 8;
    const x0 = (VIEW.width - (6 * cw + 5 * gap)) / 2;
    DISASTER_CARDS.forEach((card, i) => {
      const cx = x0 + (i % 6) * (cw + gap);
      const cy = 514 + Math.floor(i / 6) * (ch + gap);
      const isFound = found.has(card.id);
      ctx.fillStyle = 'rgba(20,12,26,0.55)';
      roundRect(ctx, cx, cy, cw, ch, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx, cy, cw, ch, 8);
      ctx.stroke();
      ctx.font = `800 12px ${FONT}`;
      ctx.fillStyle = isFound ? '#FFC94A' : '#9A8FA8';
      ctx.fillText(isFound ? card.name : '???', cx + cw / 2, cy + 22);
      ctx.font = `600 10px ${FONT}`;
      ctx.fillStyle = isFound ? '#D8CFE4' : '#8A7F98';
      const hint = card.hint.length > 36 ? `${card.hint.slice(0, 35)}…` : card.hint;
      ctx.fillText(hint, cx + cw / 2, cy + 40);
    });

    ctx.font = `800 19px ${FONT}`;
    ctx.fillStyle = '#37C8B4';
    ctx.fillText('BUZZ AGAIN — PRESS R', VIEW.width / 2, 690);
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

// hud.js — the frame around the game: the top bar (objective chain,
// stolen grams, the fly's weight, the clock, and the attention meter
// drawn as an eye that fills red), the centre announcements, and the
// title and results screens. All canvas, so screenshots show exactly
// what a player sees.

import { VIEW, GAME } from './config.js';

const TAU = Math.PI * 2;

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
    this.message = '';
    this.messageT = 0;
  }

  announce(text, seconds = 2.2) {
    this.message = text;
    this.messageT = seconds;
  }

  draw(game, dt) {
    const { ctx } = this;
    if (game.state === 'title') return this.title(game);
    this.topBar(game);
    if (this.messageT > 0) {
      this.messageT -= dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.messageT);
      ctx.fillStyle = 'rgba(40, 22, 4, 0.82)';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.message).width + 44;
      roundRect(ctx, VIEW.width / 2 - w / 2, 96, w, 48, 12);
      ctx.fill();
      ctx.fillStyle = '#ffe9a3';
      ctx.fillText(this.message, VIEW.width / 2, 129);
      ctx.restore();
    }
    if (game.state === 'won') this.results(game, true);
    if (game.state === 'caught') this.results(game, false);
  }

  topBar(game) {
    const { ctx } = this;
    const { table, fly, humans } = game;
    ctx.fillStyle = 'rgba(43, 28, 10, 0.88)';
    roundRect(ctx, 14, 12, VIEW.width - 28, 56, 14);
    ctx.fill();

    // Objective chain: 菜 → 汤 → 蛋糕 → 窗户, done ones ticked.
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'left';
    let x = 30;
    const chain = [...table.foods.map((f) => ({ label: f.name, done: f.eaten })), { label: '窗户逃生', done: fly.escaped }];
    for (const step of chain) {
      ctx.fillStyle = step.done ? '#8be08a' : '#f5eeda';
      const label = (step.done ? '✓ ' : '· ') + step.label;
      ctx.fillText(label, x, 48);
      x += ctx.measureText(label).width + 26;
    }

    // Attention eye: fills red while the table watches.
    const eyeX = VIEW.width - 330;
    ctx.fillStyle = '#f5eeda';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(humans.watching ? '被盯着！' : '注意力', eyeX - 84, 48);
    ctx.fillStyle = '#5a4632';
    roundRect(ctx, eyeX, 28, 120, 22, 11);
    ctx.fill();
    const a = humans.attention;
    ctx.fillStyle = a > 0.75 ? '#e63946' : a > 0.4 ? '#ffb703' : '#8be08a';
    if (a > 0.01) {
      roundRect(ctx, eyeX, 28, Math.max(10, 120 * a), 22, 11);
      ctx.fill();
    }
    ctx.fillStyle = '#2b1c0a';
    ctx.beginPath();
    ctx.arc(eyeX + 60, 39, 7 + a * 3, 0, TAU);
    ctx.fill();

    // Grams, weight and the clock, right-aligned.
    ctx.fillStyle = '#f5eeda';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const mins = Math.floor(game.elapsed / 60);
    const secs = Math.floor(game.elapsed % 60).toString().padStart(2, '0');
    ctx.fillText(`偷吃 ${game.grams} 克 · 体重 ${fly.weight} · ${mins}:${secs}`, VIEW.width - 30, 48);
    if (game.elapsed > GAME.parSeconds) {
      ctx.fillStyle = '#ffb703';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('饭局快散场了，人类更警觉！', VIEW.width - 30, 88);
    }
  }

  title(game) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(30, 18, 4, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('我是那只苍蝇', VIEW.width / 2, 268);
    ctx.fillStyle = '#f5eeda';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('First-Person Fly at Dinner', VIEW.width / 2, 306);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('晚餐桌上，你是一只苍蝇。偷吃青菜、汤和蛋糕，再从窗户逃出去——', VIEW.width / 2, 372);
    ctx.fillText('但别被任何人盯太久，巨掌落下就没有第二次机会。', VIEW.width / 2, 406);
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 23px system-ui, sans-serif';
    ctx.fillText('鼠标引路 · 按住 空格 嗡嗡冲刺（方向会乱偏，这就是苍蝇）', VIEW.width / 2, 462);
    ctx.font = '21px system-ui, sans-serif';
    ctx.fillText('落在发亮的菜上停留就能偷吃；吃得越胖，飞得越歪。', VIEW.width / 2, 496);
    ctx.fillStyle = '#8be08a';
    ctx.font = 'bold 27px system-ui, sans-serif';
    ctx.fillText('按 空格 开始偷吃', VIEW.width / 2, 566);
  }

  results(game, won) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(30, 18, 4, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#8be08a' : '#ff8a7a';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(won ? '逃出生天！' : '啪！被拍扁了', VIEW.width / 2, 300);
    if (!won && game.endReason) {
      ctx.fillStyle = '#f5eeda';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(game.endReason, VIEW.width / 2, 342);
    }
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`偷吃 ${game.grams} 克 · 差点被拍 ${game.humans.nearMisses} 次`, VIEW.width / 2, 410);
    ctx.fillStyle = '#f5eeda';
    ctx.font = '22px system-ui, sans-serif';
    const eaten = game.table.foods.filter((f) => f.eaten).length;
    const mins = Math.floor(game.elapsed / 60);
    const secs = Math.floor(game.elapsed % 60).toString().padStart(2, '0');
    ctx.fillText(`吃下 ${eaten}/3 道菜 · 体重 ${game.fly.weight} · 用时 ${mins}:${secs}`, VIEW.width / 2, 452);
    ctx.fillStyle = '#8be08a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('按 R 或 空格 再来一局', VIEW.width / 2, 528);
  }
}

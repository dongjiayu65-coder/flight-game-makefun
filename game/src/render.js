// render.js — everything the eye sees, drawn on one canvas in a flat
// storybook style: warm room, white cloth, plates with real-looking
// food, the family's heads around the edge with their gaze cones
// sweeping the table, the fly (fatter after every course), and the
// giant palm — first its growing shadow, then the hand itself.
// No images, no fonts to load: every shape is drawn here.

import { VIEW, HUMANS } from './config.js';

const TAU = Math.PI * 2;

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
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
    const { ctx } = this;
    const { table, fly, humans } = game;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.room(game);
    this.windowGlow(game);
    this.tableTop(table);
    this.dressing(table);
    this.foods(table, game);
    this.cones(table, humans, fly);
    this.humanBodies(table, humans);
    this.palmShadow(humans);
    if (fly.alive && !fly.escaped) this.flyBody(fly, game.time);
    this.palmHand(humans);
    if (game.state === 'playing' && table.nextTarget()) this.targetArrow(game);
  }

  room(game) {
    const { ctx } = this;
    // Warm wall and a wooden floor band at the bottom.
    ctx.fillStyle = '#f3e3c2';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#d9a066';
    ctx.fillRect(0, VIEW.height - 70, VIEW.width, 70);
    ctx.fillStyle = 'rgba(120,72,20,0.25)';
    for (let x = 40; x < VIEW.width; x += 90) ctx.fillRect(x, VIEW.height - 70, 3, 70);
    // A picture frame and a wall lamp for homeliness.
    ctx.strokeStyle = '#a4743a';
    ctx.lineWidth = 6;
    ctx.strokeRect(104, 96, 110, 80);
    ctx.fillStyle = '#bcd8ea';
    ctx.fillRect(110, 102, 98, 68);
    ctx.fillStyle = '#7ba05b';
    ctx.beginPath();
    ctx.moveTo(110, 170);
    ctx.lineTo(144, 134);
    ctx.lineTo(174, 156);
    ctx.lineTo(194, 140);
    ctx.lineTo(208, 170);
    ctx.closePath();
    ctx.fill();
    // The window: the way out. It glows brighter once the cake is gone.
    const w = game.table.window;
    const open = game.escapeOpen;
    ctx.fillStyle = open ? '#ffe9a3' : '#cfe6f2';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#8a6b42';
    ctx.lineWidth = 6;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    ctx.beginPath();
    ctx.moveTo(w.x + w.w / 2, w.y);
    ctx.lineTo(w.x + w.w / 2, w.y + w.h);
    ctx.stroke();
    if (open) {
      ctx.fillStyle = 'rgba(120,80,10,0.9)';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('窗户开着！快逃！', w.x + w.w / 2, w.y + w.h + 22);
    }
  }

  windowGlow(game) {
    if (!game.escapeOpen) return;
    const { ctx } = this;
    const w = game.table.window;
    const pulse = 0.16 + 0.08 * Math.sin(game.time * 5);
    ctx.fillStyle = `rgba(255, 214, 90, ${pulse})`;
    ctx.fillRect(w.x - 26, w.y - 14, w.w + 52, w.h + 40);
  }

  tableTop(table) {
    const { ctx } = this;
    const t = table.rect;
    // Shadow, wooden rim, white cloth.
    ctx.fillStyle = 'rgba(90,50,10,0.25)';
    roundRect(ctx, t.x + 10, t.y + 16, t.w, t.h, t.r);
    ctx.fill();
    ctx.fillStyle = '#a4743a';
    roundRect(ctx, t.x - 12, t.y - 12, t.w + 24, t.h + 24, t.r + 10);
    ctx.fill();
    ctx.fillStyle = '#fdf8ec';
    roundRect(ctx, t.x, t.y, t.w, t.h, t.r);
    ctx.fill();
    // A checked runner down the middle of the cloth.
    ctx.fillStyle = 'rgba(226, 112, 58, 0.13)';
    ctx.fillRect(t.x + 40, t.y + t.h / 2 - 34, t.w - 80, 68);
  }

  dressing(table) {
    const { ctx } = this;
    for (const d of table.dressing) {
      if (d.kind === 'plate' || d.kind === 'bowl') {
        ctx.fillStyle = '#e8e2d2';
        circle(ctx, d.x, d.y, d.r);
        ctx.fill();
        ctx.strokeStyle = '#c9c0a8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = d.kind === 'bowl' ? '#d95f43' : '#f5efe0';
        circle(ctx, d.x, d.y, d.r * 0.62);
        ctx.fill();
      } else if (d.kind === 'cup') {
        ctx.fillStyle = '#7fb2d9';
        circle(ctx, d.x, d.y, d.r * 0.7);
        ctx.fill();
        ctx.fillStyle = '#a8cdea';
        circle(ctx, d.x - 2, d.y - 2, d.r * 0.4);
        ctx.fill();
      } else {
        // chopsticks: two slim lines at an angle
        ctx.strokeStyle = '#8a5a2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(d.x - Math.cos(d.rot) * 16, d.y - Math.sin(d.rot) * 16);
        ctx.lineTo(d.x + Math.cos(d.rot) * 16, d.y + Math.sin(d.rot) * 16);
        ctx.moveTo(d.x - Math.cos(d.rot) * 16 - 4, d.y - Math.sin(d.rot) * 16 + 5);
        ctx.lineTo(d.x + Math.cos(d.rot) * 16 - 4, d.y + Math.sin(d.rot) * 16 + 5);
        ctx.stroke();
      }
    }
  }

  foods(table, game) {
    const { ctx } = this;
    const target = table.nextTarget();
    for (const f of table.foods) {
      // Plate.
      ctx.fillStyle = '#ffffff';
      circle(ctx, f.x, f.y, f.r + 10);
      ctx.fill();
      ctx.strokeStyle = '#d8d2c0';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (f.eaten) {
        // An empty plate with a few crumbs: the deed is done.
        ctx.fillStyle = '#efe9da';
        circle(ctx, f.x, f.y, f.r);
        ctx.fill();
        ctx.fillStyle = f.dark;
        for (const [dx, dy] of [[-14, 4], [8, -10], [16, 9], [-4, 14]]) {
          circle(ctx, f.x + dx, f.y + dy, 3);
          ctx.fill();
        }
        ctx.fillStyle = '#3c7434';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', f.x, f.y - f.r - 16);
        continue;
      }
      // The food itself, one drawing per dish.
      if (f.id === 'greens') {
        ctx.fillStyle = f.color;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          ctx.beginPath();
          ctx.ellipse(f.x + Math.cos(a) * f.r * 0.45, f.y + Math.sin(a) * f.r * 0.4, 13, 8, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#fff6d8';
        for (const [dx, dy] of [[-10, -6], [12, 2], [0, 10]]) {
          circle(ctx, f.x + dx, f.y + dy, 2.6);
          ctx.fill();
        }
      } else if (f.id === 'soup') {
        ctx.fillStyle = f.color;
        circle(ctx, f.x, f.y, f.r);
        ctx.fill();
        ctx.fillStyle = '#ffd94d';
        for (const [dx, dy] of [[-18, -8], [10, -16], [20, 8], [-6, 14], [2, -2]]) {
          ctx.beginPath();
          ctx.ellipse(f.x + dx, f.y + dy, 9, 6, dx, 0, TAU);
          ctx.fill();
        }
        // Steam.
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        for (const dx of [-16, 0, 16]) {
          const sway = Math.sin(game.time * 2 + dx) * 4;
          ctx.beginPath();
          ctx.moveTo(f.x + dx, f.y - f.r - 2);
          ctx.quadraticCurveTo(f.x + dx + sway, f.y - f.r - 14, f.x + dx, f.y - f.r - 26);
          ctx.stroke();
        }
      } else {
        // Cake: two layers, icing drips, three cherries, one candle.
        ctx.fillStyle = '#f7d9a0';
        roundRect(ctx, f.x - f.r, f.y - 6, f.r * 2, f.r * 0.9, 10);
        ctx.fill();
        ctx.fillStyle = f.color;
        roundRect(ctx, f.x - f.r * 0.78, f.y - f.r * 0.72, f.r * 1.56, f.r * 0.8, 10);
        ctx.fill();
        ctx.fillStyle = '#fff';
        roundRect(ctx, f.x - f.r * 0.78, f.y - f.r * 0.72, f.r * 1.56, 12, 6);
        ctx.fill();
        ctx.fillStyle = '#d93a4e';
        for (const dx of [-22, 0, 22]) {
          circle(ctx, f.x + dx, f.y - f.r * 0.62, 6);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd94d';
        const flick = Math.sin(game.time * 11) * 1.6;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - f.r - 8 + flick * 0.2, 4, 8 + flick, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e2703a';
        ctx.fillRect(f.x - 1.5, f.y - f.r - 2, 3, 10);
      }
      // Name tag under the plate.
      ctx.fillStyle = 'rgba(60,40,10,0.8)';
      ctx.font = '15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.name, f.x, f.y + f.r + 26);
      // The current target pulses and shows the eating progress ring.
      if (f === target) {
        const pulse = 1 + Math.sin(game.time * 4) * 0.05;
        ctx.strokeStyle = '#ffb703';
        ctx.lineWidth = 4;
        circle(ctx, f.x, f.y, (f.r + 16) * pulse);
        ctx.stroke();
        if (f.dwellProgress > 0) {
          ctx.strokeStyle = '#58a34c';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r + 16, -Math.PI / 2, -Math.PI / 2 + f.dwellProgress * TAU);
          ctx.stroke();
        }
      }
    }
  }

  cones(table, humans, fly) {
    const { ctx } = this;
    for (const h of table.humans) {
      const holds = humans.coneHolds(h, fly.x, fly.y) && humans.palm.state === 'idle';
      ctx.fillStyle = holds ? 'rgba(255, 70, 50, 0.20)' : 'rgba(255, 196, 0, 0.13)';
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.arc(h.x, h.y, HUMANS.coneRange, h.gaze - HUMANS.coneHalfAngle, h.gaze + HUMANS.coneHalfAngle);
      ctx.closePath();
      ctx.fill();
    }
  }

  humanBodies(table, humans) {
    const { ctx } = this;
    const faces = ['#f2c49b', '#eab892', '#f6cf9f', '#e5b184'];
    table.humans.forEach((h, i) => {
      // Shoulders: a broad arc behind the table edge.
      ctx.fillStyle = ['#b5654d', '#4d6fb5', '#7a9e4f', '#8d6fb8'][i];
      circle(ctx, h.x, h.y, 40);
      ctx.fill();
      // Head.
      ctx.fillStyle = faces[i];
      circle(ctx, h.x, h.y, 27);
      ctx.fill();
      // Hair cap.
      ctx.fillStyle = ['#4a3220', '#222', '#ddd6c8', '#333'][i];
      ctx.beginPath();
      ctx.arc(h.x, h.y - 4, 27, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      // Eyes look along the gaze — the player can read the cones.
      const ex = Math.cos(h.gaze) * 7;
      const ey = Math.sin(h.gaze) * 7;
      ctx.fillStyle = '#fff';
      circle(ctx, h.x - 10 + ex * 0.4, h.y + 2 + ey * 0.4, 6);
      ctx.fill();
      circle(ctx, h.x + 10 + ex * 0.4, h.y + 2 + ey * 0.4, 6);
      ctx.fill();
      ctx.fillStyle = '#222';
      circle(ctx, h.x - 10 + ex, h.y + 2 + ey, 3);
      ctx.fill();
      circle(ctx, h.x + 10 + ex, h.y + 2 + ey, 3);
      ctx.fill();
      // Name: beside the north head (above it is the HUD bar), under
      // every other head.
      ctx.fillStyle = 'rgba(60,40,10,0.75)';
      ctx.font = '14px system-ui, sans-serif';
      if (h.y < 200) {
        ctx.textAlign = 'right';
        ctx.fillText(h.name, h.x - 50, h.y + 5);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(h.name, h.x, h.y + 58);
      }
    });
  }

  flyBody(fly, time) {
    const { ctx } = this;
    const r = fly.radius;
    ctx.save();
    ctx.translate(fly.x, fly.y);
    // Drop shadow on the cloth.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(5, 8, r * 1.15, r * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(fly.heading + Math.PI / 2);
    // Wings: two translucent ellipses beating fast.
    const beat = Math.sin(fly.wingPhase) * 0.5;
    ctx.fillStyle = 'rgba(210, 235, 245, 0.75)';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * (0.7 + beat * 0.35));
      ctx.beginPath();
      ctx.ellipse(s * r * 0.95, -r * 0.35, r * 0.95, r * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Abdomen and thorax: striped, and round with weight.
    ctx.fillStyle = '#3b3b3b';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.82, r * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2.4;
    for (const yy of [r * 0.25, r * 0.6, r * 0.95]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, yy);
      ctx.lineTo(r * 0.7, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#555';
    circle(ctx, 0, -r * 0.35, r * 0.72);
    ctx.fill();
    // Big red fly eyes.
    ctx.fillStyle = '#c62f3b';
    circle(ctx, -r * 0.34, -r * 0.62, r * 0.3);
    ctx.fill();
    circle(ctx, r * 0.34, -r * 0.62, r * 0.3);
    ctx.fill();
    ctx.restore();
  }

  palmShadow(humans) {
    const p = humans.palm;
    if (p.state !== 'warning') return;
    const { ctx } = this;
    const k = p.t / HUMANS.palmWarnTime;
    ctx.fillStyle = `rgba(30, 10, 0, ${0.18 + 0.3 * k})`;
    circle(ctx, p.x, p.y, HUMANS.palmRadius * (0.5 + 0.6 * k));
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 30, 20, 0.8)';
    ctx.lineWidth = 3;
    circle(ctx, p.x, p.y, HUMANS.palmRadius);
    ctx.stroke();
  }

  palmHand(humans) {
    const p = humans.palm;
    if (p.state !== 'slam' && p.state !== 'recover') return;
    const { ctx } = this;
    // The hand drops from the top of the room onto the locked point:
    // during slam it is full-size on the table; in recover it lifts.
    const lift = p.state === 'recover' ? Math.min(1, p.t / HUMANS.palmRecover) : 0;
    const scale = 1 - lift * 0.25;
    const alpha = 1 - lift * 0.85;
    ctx.save();
    ctx.translate(p.x, p.y - lift * 160);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    // Wrist and palm.
    ctx.fillStyle = '#f2c49b';
    ctx.fillRect(-26, -190, 52, 110);
    roundRect(ctx, -52, -95, 104, 105, 34);
    ctx.fill();
    // Fingers.
    for (const [fx, fw, fl] of [[-46, 20, 62], [-22, 21, 78], [2, 21, 84], [27, 20, 68]]) {
      roundRect(ctx, fx, -95 - fl + 18, fw, fl, 10);
      ctx.fill();
    }
    // Thumb.
    ctx.save();
    ctx.rotate(0.6);
    roundRect(ctx, 38, -70, 20, 56, 10);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  targetArrow(game) {
    // A soft bouncing chevron over the current objective, so a new
    // player always knows where dinner is.
    const { ctx } = this;
    const f = game.table.nextTarget();
    const bob = Math.sin(game.time * 4) * 5;
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.moveTo(f.x - 11, f.y - f.r - 44 + bob);
    ctx.lineTo(f.x + 11, f.y - f.r - 44 + bob);
    ctx.lineTo(f.x, f.y - f.r - 30 + bob);
    ctx.closePath();
    ctx.fill();
  }
}

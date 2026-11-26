// sprites.js — the v3 art pass: the AI-painted sprite sheets
// (S1-S5) cut into an atlas by tools/cut-sprites.py, plus the
// painted empty-table background (F1b). Everything here is a
// drop-in visual replacement: until an image has loaded, callers
// fall back to the original code-drawn art, so the game never
// waits on the network and never draws a hole.

import { ATLAS } from './atlas-data.js';

const atlasImg = new Image();
let atlasOk = false;
const bgImg = new Image();
let bgOk = false;
const readyCbs = [];
function fireReady() {
  // Only once BOTH images are in — draining on the first load
  // would leave late registrants (the screenshot poses) stuck
  // with whichever half arrived first.
  if (!(atlasOk && bgOk)) return;
  for (const fn of readyCbs.splice(0)) fn();
}
atlasImg.onload = () => { atlasOk = true; fireReady(); };
atlasImg.src = ATLAS.image;
bgImg.onload = () => { bgOk = true; fireReady(); };
bgImg.src = 'assets/bg-table.jpg';

export function spritesReady() {
  return atlasOk;
}

export function bgReady() {
  return bgOk;
}

// Fires once both images have arrived (immediately if they have).
export function onSpritesReady(fn) {
  if (atlasOk && bgOk) fn();
  else readyCbs.push(fn);
}

// The background transform: F1b (1536x1024) scaled to the stage
// width and centred vertically. ROOM.table in config.js is the
// cloth rectangle this transform produces — measured off the
// painting, not the other way round.
export const BG = { scale: 1280 / 1536, dy: (800 - (1024 * 1280) / 1536) / 2 };

export function drawBgImage(ctx) {
  if (!bgOk) return false;
  ctx.drawImage(bgImg, 0, BG.dy, 1280, 1024 * BG.scale);
  return true;
}

// Draw one atlas frame with its anchor on (x, y). opts: w / h
// (display size; default the frame's suggested dw), rot, flipX,
// alpha. Returns false when the atlas is not in yet.
export function drawSprite(ctx, name, x, y, opts = {}) {
  if (!atlasOk) return false;
  const e = ATLAS.frames[name];
  if (!e) return false;
  const w = opts.w ?? (opts.h ? (opts.h * e.w) / e.h : e.dw ?? e.w);
  const h = (w * e.h) / e.w;
  const s = w / e.w;
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flipX) ctx.scale(-1, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(atlasImg, e.x, e.y, e.w, e.h, -e.ax * s, -e.ay * s, w, h);
  ctx.restore();
  return true;
}

// Family heads draw by head diameter: every expression of a person
// was normalised to the same headD at cut time, so swapping the
// frame never moves or resizes the face. (x, y) is the head centre;
// R is the head radius the game already uses (headR).
export function drawHead(ctx, name, x, y, R, opts = {}) {
  if (!atlasOk) return false;
  const e = ATLAS.frames[name];
  if (!e || !e.headD) return false;
  const s = (2 * R) / e.headD;
  ctx.save();
  ctx.translate(x, y);
  if (opts.sx || opts.sy) ctx.scale(opts.sx ?? 1, opts.sy ?? 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(atlasImg, e.x, e.y, e.w, e.h, -e.ax * s, -e.ay * s, e.w * s, e.h * s);
  ctx.restore();
  return true;
}

// The giant palm is one painting for the whole family: its cuff is
// a flat neutral grey, recoloured per slapper by multiplying the
// grey pixels by their shirt colour (cached per colour).
const palmVariants = new Map();
function palmCanvas(cuffColor) {
  if (palmVariants.has(cuffColor)) return palmVariants.get(cuffColor);
  const e = ATLAS.frames.palm;
  const c = document.createElement('canvas');
  c.width = e.w;
  c.height = e.h;
  const g = c.getContext('2d');
  g.drawImage(atlasImg, e.x, e.y, e.w, e.h, 0, 0, e.w, e.h);
  const m = /^#(..)(..)(..)$/.exec(cuffColor);
  if (m) {
    const tr = parseInt(m[1], 16);
    const tg = parseInt(m[2], 16);
    const tb = parseInt(m[3], 16);
    const data = g.getImageData(0, 0, e.w, e.h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 10) continue;
      const r = px[i];
      const gg = px[i + 1];
      const b = px[i + 2];
      const mx = Math.max(r, gg, b);
      const mn = Math.min(r, gg, b);
      // The cuff: near-grey (low saturation), mid-bright.
      if (mx - mn < 30 && mx > 110 && mx < 238) {
        px[i] = Math.min(255, (r * tr) / 200);
        px[i + 1] = Math.min(255, (gg * tg) / 200);
        px[i + 2] = Math.min(255, (b * tb) / 200);
      }
    }
    g.putImageData(data, 0, 0);
  }
  palmVariants.set(cuffColor, c);
  return c;
}

// (x, y) is the palm centre; w the display width; rot the facing.
export function drawPalm(ctx, x, y, w, rot, cuffColor) {
  if (!atlasOk) return false;
  const e = ATLAS.frames.palm;
  const s = w / e.w;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(palmCanvas(cuffColor), -e.ax * s, -e.ay * s, w, e.h * s);
  ctx.restore();
  return true;
}

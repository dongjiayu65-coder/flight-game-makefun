// config.js — every tunable number of "First-Person Fly at Dinner"
// (《我是那只苍蝇》) in one place: the room, the table, the foods of
// the objective chain, the humans and their patience, and how getting
// fat changes the flying. Rendering and rules read from here only.

export const VIEW = {
  // Logical canvas size; the page scales it to fit the window.
  width: 1280,
  height: 800,
};

export const ROOM = {
  // The dining table: a big rounded rectangle in the middle of the room.
  table: { x: 240, y: 172, w: 800, h: 478, r: 60 },
  // The window is a glowing rectangle on the north wall; the escape.
  // It sits below the HUD bar and above the table rim, fully visible.
  window: { x: 565, y: 76, w: 150, h: 50 },
};

export const FLY = {
  radius: 13, // drawn body radius at weight 0; grows with weight
  // Gliding: velocity decays by this fraction each second.
  glideDrag: 1.5,
  // A buzz dash: impulse along the heading, before weight penalties.
  dashImpulse: 340,
  // Seconds between dashes while the buzz key is held.
  dashCooldown: 0.16,
  // Random deflection of a dash, degrees, at weight 0.
  dashDeflectDeg: 30,
  // Extra deflection per weight level, degrees.
  deflectPerWeight: 9,
  // Dash impulse multiplier lost per weight level.
  dashWeakPerWeight: 0.13,
  // How fast the heading turns toward the mouse, radians per second.
  steerRate: 7.5,
  // top speed clamp, px/s
  maxSpeed: 620,
};

export const FOODS = [
  // The objective chain, in order. grams feed the results screen;
  // dwell is how long the fly must stay on the dish to finish it.
  { id: 'greens', name: '蒜蓉青菜', sub: 'Stir-fried greens', grams: 12, dwell: 0.9, color: '#58a34c', dark: '#3c7434' },
  { id: 'soup', name: '番茄蛋汤', sub: 'Tomato egg soup', grams: 18, dwell: 1.1, color: '#e2703a', dark: '#b34f24' },
  { id: 'cake', name: '生日蛋糕', sub: 'Birthday cake', grams: 25, dwell: 1.3, color: '#f2b8c6', dark: '#cf7f97' },
];

export const HUMANS = {
  count: 4,
  // Vision cone: half-angle and reach in px.
  coneHalfAngle: 0.42,
  coneRange: 330,
  // Cone sweep: each gaze swings around its home direction.
  sweepArc: 0.85,
  sweepSpeed: 0.55,
  // Attention: fills while any cone holds the fly, drains when unseen.
  attentionGain: 0.34, // per second while watched
  attentionDecay: 0.5, // per second while hidden
  // At full attention the palm comes: warning shadow, then the slam.
  palmWarnTime: 0.65, // seconds of growing shadow before impact
  palmRadius: 74, // caught if the fly is inside this at impact
  palmRecover: 1.1, // seconds the hand stays down / lifts away
  // After the 90-second mark the table gets warier: gains scale up.
  lateGameAt: 90,
  lateGameGainScale: 1.5,
};

export const GAME = {
  // Soft target length of one run, seconds; shown on the HUD clock.
  parSeconds: 90,
};

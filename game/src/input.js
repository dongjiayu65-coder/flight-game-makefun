// input.js — devices in, game vocabulary out. The game polls two
// things: where the pointer is (mouse / steer) and a small queue
// of named actions ('Space', 'Dodge', 'Tap', ...) that take()
// hands out exactly once each. A dodge press also raises
// flashPressed for a few frames, which is how the game grades
// its timing.

const ACTION_TTL_MS = 200; // an unconsumed action goes stale
const FLASH_WINDOW_MS = 90;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 640, y: 400, inside: false };
    this.queues = new Map(); // name -> [timestamps]
    this.clicks = [];        // timestamps of click/tap presses
    this.lastFlashAt = -Infinity;

    const toGame = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * canvas.width,
        y: ((clientY - r.top) / r.height) * canvas.height,
      };
    };
    const pointMouse = (clientX, clientY, lift = 0) => {
      const p = toGame(clientX, clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y - lift;
      this.mouse.inside = true;
    };

    canvas.addEventListener('mousemove', (e) => pointMouse(e.clientX, e.clientY));
    canvas.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      pointMouse(e.clientX, e.clientY);
      if (e.button === 2) this.pressFlash();
      else if (e.button === 0) this.clicks.push(performance.now());
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch: the first finger steers (its point rides above the
    // fingertip so the fly is never hidden); a second finger is
    // a dodge, and any touch landing counts as a tap.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        this.pressFlash();
        return;
      }
      const t = e.touches[0];
      pointMouse(t.clientX, t.clientY, 60);
      this.push('Tap');
      this.clicks.push(performance.now());
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) pointMouse(t.clientX, t.clientY, 60);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) this.mouse.inside = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          this.pressFlash();
          this.push('Space');
        }
      } else if (!e.repeat) {
        if (e.code === 'Enter') this.push('Enter');
        else if (e.code === 'KeyR') this.push('KeyR');
        else if (e.code === 'KeyP') this.push('KeyP');
      }
    });
  }

  // The steering point for this frame, or null when the pointer
  // is not over the stage.
  get steer() {
    return this.mouse.inside ? { x: this.mouse.x, y: this.mouse.y } : null;
  }

  // True for a short window after any dodge press (space bar,
  // right click, second finger).
  get flashPressed() {
    return performance.now() - this.lastFlashAt < FLASH_WINDOW_MS;
  }

  pressFlash() {
    this.lastFlashAt = performance.now();
    this.push('Dodge');
  }

  push(name) {
    if (!this.queues.has(name)) this.queues.set(name, []);
    this.queues.get(name).push(performance.now());
  }

  // Consume one queued action by name; stale ones never fire.
  take(name) {
    const q = this.queues.get(name);
    if (!q) return false;
    const now = performance.now();
    while (q.length && now - q[0] > ACTION_TTL_MS) q.shift();
    if (!q.length) return false;
    q.shift();
    return true;
  }

  takeClick() {
    const now = performance.now();
    while (this.clicks.length && now - this.clicks[0] > ACTION_TTL_MS) this.clicks.shift();
    if (!this.clicks.length) return false;
    this.clicks.shift();
    return true;
  }
}

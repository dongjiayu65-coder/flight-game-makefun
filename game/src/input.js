// input.js — the whole control scheme, deliberately tiny: the mouse
// leads (the fly turns toward it), the space bar is the "嗡" (buzz)
// key, R restarts, and P pauses. Touch works too: drag to lead, hold
// to buzz. Everything is exposed as plain state the main loop reads.

export class Input {
  constructor(canvas) {
    this.mouse = { x: 0, y: 0, inside: false };
    this.buzz = false;
    this.pressed = new Set(); // keys that went down since last read
    this.canvas = canvas;

    const toGame = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toGame(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', () => {
      this.buzz = true;
      this.clicked = true;
    });
    window.addEventListener('mouseup', () => {
      if (!this.keyBuzz) this.buzz = false;
    });
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const p = toGame(t.clientX, t.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
      this.buzz = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      const p = toGame(t.clientX, t.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => (this.buzz = false));

    this.keyBuzz = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.keyBuzz = true;
        this.buzz = true;
        this.pressed.add('Space');
        e.preventDefault();
      }
      if (e.code === 'KeyR') this.pressed.add('KeyR');
      if (e.code === 'KeyP') this.pressed.add('KeyP');
      if (e.code === 'Enter') this.pressed.add('Enter');
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.keyBuzz = false;
        this.buzz = false;
      }
    });
  }

  // One-shot mouse click, consumed by the caller.
  takeClick() {
    if (this.clicked) {
      this.clicked = false;
      return true;
    }
    return false;
  }

  // One-shot key presses, consumed by the caller.
  take(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }
}

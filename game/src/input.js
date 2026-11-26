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
    // P1-5: right-click is a dodge (spec 3.2), never the browser menu.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      this.buzz = true;
      if (e.button === 2) {
        this.pressed.add('Dodge');
        e.preventDefault();
        return;
      }
      if (e.button === 0) this.clicked = true;
    });
    window.addEventListener('mouseup', () => {
      if (!this.keyBuzz) this.buzz = false;
    });
    // P1-5 touch: the FIRST finger steers (the fly aims 60px above
    // it so the finger never hides it, spec 3.5); any ADDITIONAL
    // finger that lands is a dodge. A first touch on the title /
    // results / pause veil still counts as a click.
    this.steerTouchId = null;
    const steerTo = (t) => {
      const p = toGame(t.clientX, t.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y - 60;
      this.mouse.inside = true;
    };
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (this.steerTouchId === null) {
          this.steerTouchId = t.identifier;
          steerTo(t);
          // Not a click: in play the first finger only steers. Menus
          // (results, focus veil) read this as their tap.
          this.pressed.add('Tap');
        } else {
          this.pressed.add('Dodge');
        }
      }
      this.buzz = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.steerTouchId) steerTo(t);
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.steerTouchId) this.steerTouchId = null;
      }
      if (e.touches.length === 0) this.buzz = false;
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);

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

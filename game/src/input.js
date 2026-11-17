// input.js — turns raw keyboard and mouse events into the intent object the
// simulation consumes each frame: a movement vector, an aim point in arena
// coordinates, and fire / dash / pause flags. Keeping every listener here
// means game.js never touches the DOM and can be stepped headlessly.

import { ARENA_W, ARENA_H } from './util.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = ARENA_W / 2;
    this.mouseY = ARENA_H / 2 - 120;
    this.mouseDown = false;
    this.dashQueued = false;
    this.pauseQueued = false;
    this.confirmQueued = false;
    this.anyKeyQueued = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => this.trackMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.trackMouse(e);
      if (e.button === 0) {
        this.mouseDown = true;
        this.confirmQueued = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    if (e.repeat) return;
    this.keys.add(e.code);
    this.anyKeyQueued = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
      this.dashQueued = true;
      if (e.code === 'Space') e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') this.pauseQueued = true;
    if (e.code === 'Enter' || e.code === 'Space') this.confirmQueued = true;
    // Keep the page from scrolling on the keys the game owns.
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  }

  trackMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / r.width) * ARENA_W;
    this.mouseY = ((e.clientY - r.top) / r.height) * ARENA_H;
  }

  // Movement axes from WASD or the arrow keys, normalised to length <= 1.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // The per-frame intent the simulation steps with. Edge-triggered flags are
  // consumed by reading them here and cleared by endFrame().
  intent(player) {
    const mv = this.moveVector();
    return {
      mx: mv.x,
      my: mv.y,
      aimX: this.mouseX,
      aimY: this.mouseY,
      firing: this.mouseDown,
      dash: this.dashQueued,
    };
  }

  // One-shot UI signals (start, pause, restart), read by main.js.
  takeConfirm() {
    const v = this.confirmQueued;
    this.confirmQueued = false;
    return v;
  }

  takePause() {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  takeAnyKey() {
    const v = this.anyKeyQueued;
    this.anyKeyQueued = false;
    return v;
  }

  endFrame() {
    this.dashQueued = false;
  }

  // Test/staging helper: pose the input as if a player held these controls.
  pose({ mx = 0, my = 0, aimX = 0, aimY = 0, firing = false } = {}) {
    this.mouseX = aimX;
    this.mouseY = aimY;
    this.mouseDown = firing;
    this.keys.clear();
    if (mx < 0) this.keys.add('KeyA');
    if (mx > 0) this.keys.add('KeyD');
    if (my < 0) this.keys.add('KeyW');
    if (my > 0) this.keys.add('KeyS');
  }
}

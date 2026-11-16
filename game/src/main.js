// The shell: owns the canvas, the clock and the input, and wires the DOM layer
// and the sound bank to the simulation. The simulation itself (game.js) runs on
// a fixed step, so the game plays identically on a 60 Hz and a 144 Hz display.

import { ARENA, FIXED_STEP } from './config.js';
import { createGame, startRun, stepGame, chooseUpgrade, continueEndless } from './game.js';
import { drawGame } from './render.js';
import { createHud } from './hud.js';
import { SoundBank } from './audio.js';
import { attachInput, input, moveAxes, takeDash, takePause, takeConfirm } from './input.js';
import { poseShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = params.get('seed') ? Number(params.get('seed')) >>> 0 : (Math.random() * 0xffffffff) >>> 0;
const state = createGame(seed);
window.__game = state; // lets the maker's own test scripts drive a run headlessly
const sound = new SoundBank();

function toWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * ARENA.w,
    y: ((clientY - r.top) / r.height) * ARENA.h,
  };
}
attachInput(canvas, toWorld);
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (e.code === 'KeyM') sound.setMuted(!sound.muted);
  if (state.phase === 'draft') {
    const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (idx >= 0 && state.draft[idx]) chooseUpgrade(state, state.draft[idx].id);
  }
});

const hud = createHud({
  onStart: () => { sound.play('ui'); startRun(state); },
  onRestart: () => { sound.play('ui'); startRun(state); },
  onDraft: (id) => chooseUpgrade(state, id),
  onContinue: () => { sound.play('ui'); continueEndless(state); },
  onResume: () => { state.phase = 'playing'; },
});

const shotName = params.get('shot');
if (shotName) {
  poseShot(state, shotName);
  let frames = 0;
  const renderShot = () => {
    state.fx.update(1 / 60);
    drawGame(ctx, state);
    hud.sync(state);
    frames++;
    if (frames < 24) requestAnimationFrame(renderShot);
    else window.__shotReady = true;
  };
  requestAnimationFrame(renderShot);
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    let dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (takePause()) {
      if (state.phase === 'playing') state.phase = 'paused';
      else if (state.phase === 'paused') state.phase = 'playing';
    }
    if (takeConfirm()) {
      if (state.phase === 'title' || state.phase === 'over') startRun(state);
      else if (state.phase === 'win') continueEndless(state);
    }

    if (state.phase === 'playing') {
      if (state.hitStop > 0) {
        state.hitStop -= dtReal;
      } else {
        acc += dtReal;
        const axes = moveAxes();
        while (acc >= FIXED_STEP) {
          acc -= FIXED_STEP;
          stepGame(state, FIXED_STEP, {
            mx: axes.x,
            my: axes.y,
            aimX: input.mouseX,
            aimY: input.mouseY,
            firing: input.mouseDown,
            dash: takeDash(),
          });
        }
      }
    } else {
      state.fx.update(dtReal);
      if (state.banner) {
        state.banner.t += dtReal;
        if (state.banner.t >= state.banner.life) state.banner = null;
      }
    }

    for (const ev of state.events) sound.play(ev);
    state.events = [];
    sound.updateMusic(state.phase === 'playing');

    ctx.save();
    if (state.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawGame(ctx, state);
    ctx.restore();
    hud.sync(state);
  };
  requestAnimationFrame(frame);
}

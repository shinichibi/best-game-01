// main.js — the bootstrap of PRISM BREAK v2: owns the canvas, the frame
// loop, the screen-state glue (title → playing → paused → game over), the
// audio event wiring and the high-score persistence. The simulation itself
// lives in game.js; this file only feeds it intents and paints its state.
// It also carries the ?shot= staging hook the screenshot script drives:
// each named scene builds a real moment of the real game, plays it with a
// bot pilot for a few seconds, then freezes and raises __shotReady.

import { createGame, startRun, stepGame } from './game.js';
import { spawnEnemy, spawnBoss, rosterForWave } from './enemies.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { createBackground, drawScene } from './render.js';
import { drawHud, drawBanner, drawTitle, drawPause, drawGameOver } from './ui.js';
import { ARENA_W, ARENA_H } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) >>> 0;

const state = createGame(seed);
const input = new Input(canvas);
const audio = new AudioEngine();
const bg = createBackground();

const HIGH_KEY = 'prism-break-v2-highscore';
try {
  state.highScore = Number(localStorage.getItem(HIGH_KEY) || 0) || 0;
} catch { /* storage unavailable: play without persistence */ }

// --- audio wiring ---------------------------------------------------------------

function drainEvents() {
  for (const ev of state.events) {
    switch (ev.type) {
      case 'shoot': audio.shoot(ev.kind); break;
      case 'hit': audio.enemyHit(); break;
      case 'explosion': audio.explosion(ev.size); break;
      case 'hurt': audio.playerHurt(); break;
      case 'dash': audio.dash(); break;
      case 'pickup': audio.pickup(); break;
      case 'weaponUp': audio.weaponUp(); break;
      case 'heart': audio.heartUp(); break;
      case 'waveStart': audio.waveStart(); break;
      case 'waveClear': audio.pickup(); break;
      case 'bossWarn': audio.bossWarn(); break;
      case 'bossDown': audio.bossDown(); break;
      case 'gameOver': audio.gameOver(); break;
      case 'comboLost': audio.comboLost(); break;
      default: break; // bossShot / bossSummon: the visuals carry them
    }
  }
  state.events.length = 0;
}

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'KeyM') audio.toggleMute();
});
window.addEventListener('pointerdown', () => audio.unlock());

// --- screen-state glue ------------------------------------------------------------

function handleUiSignals() {
  if (input.takePause()) {
    if (state.phase === 'playing') {
      state.paused = !state.paused;
      audio.uiClick();
    }
  }
  if (input.takeConfirm()) {
    if (state.phase === 'title') {
      startRun(state);
      audio.uiClick();
    } else if (state.phase === 'over' && state.overT > 0.8) {
      startRun(state);
      audio.uiClick();
    }
  }
  input.takeAnyKey(); // (drained so the queue never grows stale)
}

function persistHigh() {
  try {
    localStorage.setItem(HIGH_KEY, String(state.highScore));
  } catch { /* ignore */ }
}

// --- the bot pilot (staging + smoke tests) -----------------------------------------

// A simple competent pilot: keep a mid-range orbit around the nearest
// enemy, lead the target, fire, and dash out of trouble. Used to stage
// screenshots and to smoke-test the real game hands-free.
export function botIntent(s) {
  const p = s.player;
  let nearest = null;
  let nd = Infinity;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) { nd = d; nearest = e; }
  }
  let mx = 0;
  let my = 0;
  if (nearest) {
    const dx = nearest.x - p.x;
    const dy = nearest.y - p.y;
    if (nd < 165) { mx = -dx / nd; my = -dy / nd; }
    else if (nd > 300) { mx = dx / nd; my = dy / nd; }
    else { mx = (-dy / nd) * 0.55; my = (dx / nd) * 0.55; }
  }
  for (const b of s.enemyBullets) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < 78) { mx += -b.vy * 0.01; my += b.vx * 0.01; }
  }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  let aimX = p.x + 120;
  let aimY = p.y;
  if (nearest) {
    const t = nd / 700;
    aimX = nearest.x + nearest.vx * t;
    aimY = nearest.y + nearest.vy * t;
  }
  return {
    mx, my, aimX, aimY,
    firing: !!nearest,
    dash: nd < 62 && p.dashCd <= 0,
  };
}

// --- staging scenes ------------------------------------------------------------------

// Each scene starts a real run, arranges a signature moment, then lets the
// bot play it live. Nothing here edits pixels: the screenshots are renders
// of the game's own code, exactly as a player's frame would be.
function stageScene(name) {
  startRun(state);
  const p = state.player;
  if (name === 'cover') {
    state.wave = 6;
    state.score = 12850;
    state.combo = 17;
    state.comboT = 2.4;
    p.weapon = 'scatter';
    p.weaponT = 9;
    const kinds = ['chaser', 'weaver', 'dart', 'splitter', 'chaser', 'orbiter', 'weaver', 'dart', 'chaser', 'tank', 'mite', 'splitter', 'orbiter', 'weaver', 'dart', 'chaser'];
    kinds.forEach((k, i) => {
      const a = (i / kinds.length) * Math.PI * 2;
      const r = 150 + (i % 4) * 62;
      const e = spawnEnemy(state, k, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      e.spawnT = 0;
    });
    state.pickups.push({ kind: 'rail', x: p.x - 210, y: p.y + 120, vx: 0, vy: 0, t: 0, life: 30 });
    state.pickups.push({ kind: 'gem', x: p.x + 250, y: p.y - 140, vx: 0, vy: 0, t: 0, life: 30 });
    state.spawnQueue = 12;
    state.mix = rosterForWave(6).mix;
    state.banner = null;
    return 3.0;
  }
  if (name === 'boss') {
    state.wave = 5;
    state.score = 21400;
    state.combo = 9;
    state.comboT = 2.2;
    p.weapon = 'rail';
    p.weaponT = 8;
    const boss = spawnBoss(state, 5);
    state.spawnQueue = 0;
    boss.y = 178;
    boss.phase = 1;
    boss.hp = Math.round(boss.maxHp * 0.55);
    boss.attackT = 0.4;
    spawnEnemy(state, 'chaser', 240, 620);
    spawnEnemy(state, 'dart', 1040, 600);
    state.banner = { title: 'WAVE 5', sub: 'THE GRAND PRISM AWAKENS', t: 0, dur: 6.5 };
    return 4.2;
  }
  if (name === 'weapon') {
    state.wave = 4;
    state.score = 7300;
    state.combo = 11;
    state.comboT = 2.4;
    p.weapon = 'seeker';
    p.weaponT = 10;
    const kinds = ['orbiter', 'weaver', 'chaser', 'splitter', 'dart', 'weaver', 'chaser', 'orbiter'];
    kinds.forEach((k, i) => {
      const x = 200 + (i % 4) * 290;
      const y = 170 + Math.floor(i / 4) * 330;
      const e = spawnEnemy(state, k, x, y);
      e.spawnT = 0;
    });
    state.banner = null;
    return 3.0;
  }
  if (name === 'end') {
    // Play honestly for a while, then stop dodging: the game-over screen
    // shows whatever the bot truly earned.
    state.score = 0;
    return 26;
  }
  return 3;
}

// --- frame loop ------------------------------------------------------------------------

let last = performance.now();
let staged = null;
const shotName = params.get('shot');
if (shotName) {
  staged = { name: shotName, playFor: stageScene(shotName), t: 0, passive: false };
  state.phase = 'playing';
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!(dt > 0)) dt = 0.016;

  if (staged) {
    staged.t += dt;
    let intent;
    if (staged.name === 'end' && staged.t > 9) {
      intent = { mx: 0, my: 0, aimX: state.player.x + 100, aimY: state.player.y, firing: false, dash: false };
    } else {
      intent = botIntent(state);
    }
    stepGame(state, dt, intent);
    drainEvents();
    const done = staged.name === 'end'
      ? state.phase === 'over' && state.overT > 1.3
      : staged.t >= staged.playFor;
    if (done && !window.__shotReady) {
      window.__shotReady = true;
      persistHigh();
    }
  } else {
    handleUiSignals();
    const intent = state.phase === 'playing' && !state.paused ? input.intent(state.player) : {};
    stepGame(state, dt, intent);
    input.endFrame();
    drainEvents();
    if (state.phase === 'over') persistHigh();
  }

  drawScene(ctx, state, bg);
  if (state.phase === 'playing') {
    drawHud(ctx, state);
    drawBanner(ctx, state);
    if (state.paused) drawPause(ctx, state);
  } else if (state.phase === 'title') {
    drawTitle(ctx, state);
  } else if (state.phase === 'over') {
    drawHud(ctx, state);
    drawGameOver(ctx, state);
  }
}

window.__game = state;
window.__bot = botIntent;
requestAnimationFrame(frame);

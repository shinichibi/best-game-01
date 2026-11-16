// Screenshot scenes: poses the real game state — title backdrop, a mid-wave
// fight, the upgrade draft and the game-over field — for the maker's screenshots
// (?shot=cover|action|draft|end). Nothing here is drawn by hand; main.js renders
// the posed state with the normal renderer, so a screenshot can never show
// anything the game itself cannot.

import { spawnEnemy, spawnPickup } from './entities.js';
import { UPGRADES } from './upgrades.js';

function bullet(state, x, y, angle, speed = 640) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4, damage: 12, pierce: 0, life: 0.9, dead: false,
  });
}

function enemyBullet(state, x, y, angle) {
  state.enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * 240,
    vy: Math.sin(angle) * 240,
    radius: 5, damage: 9, life: 3, dead: false,
  });
}

function place(state, kind, x, y) {
  const e = spawnEnemy(state, kind, x, y);
  e.vx = 0;
  e.vy = 0;
  return e;
}

export function poseShot(state, name) {
  const p = state.player;
  state.time = 12.4;
  if (name === 'cover') {
    state.phase = 'title';
    p.x = 300;
    p.y = 315;
    p.angle = -0.35;
    place(state, 'shard', 655, 165);
    place(state, 'darter', 795, 130);
    place(state, 'orbiter', 730, 345);
    place(state, 'splitter', 565, 430);
    bullet(state, 380, 285, -0.35);
    bullet(state, 440, 265, -0.35);
    state.fx.burst(655, 165, '#ff5d8f', 12, 200, 0.7, 3.5);
    spawnPickup(state, 'shard', 420, 400);
    spawnPickup(state, 'shard', 452, 415);
  } else if (name === 'action') {
    state.phase = 'playing';
    state.wave = 6;
    state.score = 12450;
    state.shards = 17;
    p.x = 370;
    p.y = 330;
    p.hull = 72;
    p.angle = Math.atan2(190 - 330, 690 - 370);
    for (let i = 0; i < 4; i++) bullet(state, 430 + i * 52, 330 - i * 24, p.angle);
    place(state, 'shard', 655, 185);
    place(state, 'shard', 715, 300);
    place(state, 'shard', 585, 95);
    const d = place(state, 'darter', 520, 130);
    d.mode = 'aim';
    d.aimX = Math.cos(p.angle + Math.PI);
    d.aimY = Math.sin(p.angle + Math.PI);
    place(state, 'orbiter', 775, 385);
    place(state, 'splitter', 835, 115);
    place(state, 'tank', 855, 440);
    enemyBullet(state, 690, 350, 2.6);
    enemyBullet(state, 730, 410, 2.9);
    enemyBullet(state, 640, 260, 3.4);
    spawnPickup(state, 'shard', 300, 205);
    spawnPickup(state, 'shard', 332, 222);
    spawnPickup(state, 'shard', 282, 178);
    spawnPickup(state, 'heart', 615, 445);
    state.fx.burst(655, 185, '#ff5d8f', 16, 260, 0.7, 4);
    state.fx.ring(655, 185, '#ff5d8f', 40, 0.4);
  } else if (name === 'draft') {
    state.phase = 'draft';
    state.wave = 5;
    state.score = 8100;
    state.shards = 11;
    p.x = 480;
    p.y = 290;
    p.hull = 58;
    p.angle = -1.1;
    state.draft = ['twin', 'heavy', 'plating'].map((id) => UPGRADES.find((u) => u.id === id));
    spawnPickup(state, 'shard', 380, 380);
    spawnPickup(state, 'shard', 590, 180);
    spawnPickup(state, 'shard', 640, 400);
    state.fx.burst(700, 140, '#ff3d71', 30, 320, 0.9, 4.5);
  } else if (name === 'end') {
    state.phase = 'over';
    state.wave = 9;
    state.finalWave = 9;
    state.score = 18730;
    state.shards = 23;
    state.stats = { kills: 132, shots: 640, hits: 402, time: 245 };
    p.x = 470;
    p.y = 285;
    p.hull = 0;
    p.alive = false;
    place(state, 'shard', 295, 155);
    place(state, 'darter', 665, 385);
    place(state, 'orbiter', 725, 150);
    state.fx.burst(470, 285, '#40e0ff', 42, 340, 1, 4.5);
    state.fx.ring(470, 285, '#40e0ff', 110, 0.6);
    spawnPickup(state, 'shard', 520, 340);
    spawnPickup(state, 'shard', 420, 230);
  }
}

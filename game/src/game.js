// game.js — the simulation core of PRISM BREAK v2. Everything that decides
// what happens lives here and nowhere else: the player ship, wave
// direction, spawning, collisions, the combo economy, pickups and death.
// It never touches the DOM or a clock — main.js feeds it intents and dt —
// so the exact same step runs in the browser and in headless tests.

import { ARENA_W, ARENA_H, WALL, PALETTE, clamp, angleTo, edgeSpawn, randRange } from './util.js';
import { makeRng } from './util.js';
import {
  ENEMY_TYPES, spawnEnemy, spawnBoss, rosterForWave, pickFromMix,
  updateEnemies, updateEnemyBullets,
} from './enemies.js';
import { WEAPONS, WEAPON_ORDER, fireWeapon, fireInterval, updateProjectiles } from './weapons.js';
import {
  makeFx, updateFx, burst, sparks, embers, ring, floatText, ghost, addShake, flash,
} from './particles.js';

export const PLAYER_R = 13;
const PLAYER_SPEED = 298;
const DASH_TIME = 0.16;
const DASH_SPEED = 980;
const DASH_COOLDOWN = 1.5;
const COMBO_WINDOW = 2.6;

export function createGame(seed = 1) {
  return {
    seed,
    rng: makeRng(seed),
    phase: 'title', // title | playing | over
    paused: false,
    time: 0,
    runTime: 0,
    player: freshPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    fx: makeFx(),
    events: [],
    score: 0,
    highScore: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    wave: 0,
    waveState: 'idle', // idle | active | between
    betweenT: 0,
    spawnQueue: 0,
    spawnT: 0,
    mix: [],
    escortsLeft: 0,
    escortT: 0,
    boss: null,
    banner: null, // { title, sub, t, dur }
    speedScale: 1,
    stats: { kills: 0, shots: 0, hits: 0, dashes: 0, wavesCleared: 0 },
    overT: 0,
  };
}

function freshPlayer() {
  return {
    x: ARENA_W / 2,
    y: ARENA_H / 2 + 60,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    hp: 5, maxHp: 5,
    r: PLAYER_R,
    fireCd: 0,
    weapon: 'blaster',
    weaponT: 0,
    dashCd: 0,
    dashT: 0,
    dashDx: 1, dashDy: 0,
    invulnT: 0,
    recoil: 0,
    alive: true,
  };
}

export function startRun(state) {
  const keepHigh = state.highScore;
  Object.assign(state, createGame(state.seed));
  state.highScore = keepHigh;
  state.phase = 'playing';
  startWave(state, 1);
}

// --- wave direction -----------------------------------------------------------

export function startWave(state, n) {
  state.wave = n;
  state.speedScale = Math.min(1.55, 1 + (n - 1) * 0.035);
  const roster = rosterForWave(n);
  state.waveState = 'active';
  if (roster.boss) {
    spawnBoss(state, n);
    state.escortsLeft = 8 + n;
    state.escortT = 5;
    state.banner = { title: `WAVE ${n}`, sub: 'THE GRAND PRISM AWAKENS', t: 0, dur: 2.6 };
  } else {
    state.spawnQueue = roster.total;
    state.mix = roster.mix;
    state.spawnT = 0.3;
    state.banner = { title: `WAVE ${n}`, sub: waveSubtitle(n), t: 0, dur: 2.0 };
    state.events.push({ type: 'waveStart' });
  }
}

function waveSubtitle(n) {
  if (n === 1) return 'break every prism';
  if (n === 2) return 'needles incoming';
  if (n === 3) return 'weavers on the slalom';
  if (n === 4) return 'something is dividing';
  if (n === 6) return 'orbiters returning fire';
  if (n === 7) return 'bulwarks sighted';
  if (n % 5 === 4) return 'the prism gathers itself…';
  return 'hold the arena';
}

function updateSpawning(state, dt) {
  if (state.boss) {
    // Boss waves: a slow escort trickle keeps pressure between patterns.
    state.escortT -= dt;
    if (state.escortT <= 0 && state.escortsLeft > 0 && state.enemies.length < 9) {
      state.escortT = 4.2;
      state.escortsLeft -= 2;
      for (let i = 0; i < 2; i++) {
        const s = edgeSpawn(state.rng);
        spawnEnemy(state, state.rng() < 0.6 ? 'chaser' : 'dart', s.x, s.y);
      }
    }
    return;
  }
  if (state.spawnQueue <= 0) return;
  state.spawnT -= dt;
  if (state.spawnT > 0) return;
  state.spawnT = Math.max(0.24, 0.62 - state.wave * 0.02);
  const batch = Math.min(state.spawnQueue, state.wave >= 8 ? 3 : 2);
  for (let i = 0; i < batch; i++) {
    let s = edgeSpawn(state.rng);
    // Never spawn on top of the player: reroll once if too close.
    if (Math.hypot(s.x - state.player.x, s.y - state.player.y) < 240) s = edgeSpawn(state.rng);
    const kind = pickFromMix(state.rng, state.mix);
    const spawned = spawnEnemy(state, kind, s.x, s.y, { hpScale: 1 + Math.max(0, state.wave - 6) * 0.06 });
    ring(state.fx, spawned.x, spawned.y, ENEMY_TYPES[kind].color, 40, 2, 0.35);
    state.spawnQueue--;
  }
}

function checkWaveEnd(state) {
  if (state.waveState !== 'active') return;
  const doneSpawning = state.spawnQueue <= 0 && !state.boss;
  if (doneSpawning && state.enemies.length === 0) {
    state.waveState = 'between';
    state.betweenT = 2.4;
    state.stats.wavesCleared++;
    const bonus = 100 * state.wave;
    state.score += bonus;
    floatText(state.fx, ARENA_W / 2, ARENA_H / 2 - 90, `WAVE ${state.wave} CLEAR  +${bonus}`, '#8affff', 22);
    state.events.push({ type: 'waveClear' });
  }
}

// --- the step -----------------------------------------------------------------

export function stepGame(state, dt, intent = {}) {
  if (state.paused) return;
  // Slow motion after a hit stretches the step, not the player's nerves.
  const sdt = state.fx.slowmo > 0 ? dt * 0.35 : dt;
  state.time += sdt;
  if (state.banner) {
    state.banner.t += dt;
    if (state.banner.t >= state.banner.dur) state.banner = null;
  }
  updateFx(state.fx, sdt);

  if (state.phase === 'over') {
    state.overT += dt;
    updateEnemies(state, sdt * 0.4);
    updateEnemyBullets(state, sdt);
    return;
  }
  if (state.phase !== 'playing') return;

  state.runTime += sdt;
  stepPlayer(state, sdt, intent);
  if (state.waveState === 'between') {
    state.betweenT -= dt;
    if (state.betweenT <= 0) startWave(state, state.wave + 1);
  } else {
    updateSpawning(state, sdt);
  }
  updateEnemies(state, sdt);
  updateProjectiles(state, sdt);
  updateEnemyBullets(state, sdt);
  updatePickups(state, sdt);
  collideBullets(state);
  collidePlayer(state);
  updateCombo(state, sdt);
  checkWaveEnd(state);
}

function stepPlayer(state, dt, intent) {
  const p = state.player;
  if (!p.alive) return;
  p.fireCd -= dt;
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  p.recoil = Math.max(0, p.recoil - dt * 30);

  if (p.weaponT > 0) {
    p.weaponT -= dt;
    if (p.weaponT <= 0) {
      p.weapon = 'blaster';
      p.weaponT = 0;
      floatText(state.fx, p.x, p.y - 30, 'BLASTER RESTORED', PALETTE.textDim, 13);
    }
  }

  const mx = intent.mx || 0;
  const my = intent.my || 0;

  // Dash: a burst of speed with i-frames, in the move direction if there
  // is one, else toward the aim. Ghosts mark the path.
  if (intent.dash && p.dashCd <= 0 && p.dashT <= 0) {
    let dx = mx;
    let dy = my;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const l = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / l;
    p.dashDy = dy / l;
    p.dashT = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    p.invulnT = Math.max(p.invulnT, DASH_TIME + 0.06);
    state.stats.dashes++;
    state.events.push({ type: 'dash' });
    ring(state.fx, p.x, p.y, PALETTE.player, 44, 2, 0.3);
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * DASH_SPEED;
    p.vy = p.dashDy * DASH_SPEED;
    ghost(state.fx, p.x, p.y, p.angle, PALETTE.player);
  } else {
    // Snappy acceleration with a touch of drift.
    const accel = 2600;
    p.vx += mx * accel * dt;
    p.vy += my * accel * dt;
    const damp = Math.pow(0.0001, dt); // strong but smooth braking
    if (mx === 0) p.vx *= damp;
    if (my === 0) p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER_SPEED) {
      p.vx = (p.vx / sp) * PLAYER_SPEED;
      p.vy = (p.vy / sp) * PLAYER_SPEED;
    }
  }

  p.x = clamp(p.x + p.vx * dt, WALL + p.r, ARENA_W - WALL - p.r);
  p.y = clamp(p.y + p.vy * dt, WALL + p.r, ARENA_H - WALL - p.r);
  p.angle = angleTo(p.x, p.y, intent.aimX ?? p.x + 1, intent.aimY ?? p.y);

  if (intent.firing && p.fireCd <= 0) {
    fireWeapon(state, p.angle);
    p.fireCd = Math.max(p.fireCd + fireInterval(p.weapon), fireInterval(p.weapon) * 0.5);
  }
}

// --- combo --------------------------------------------------------------------

export function comboMult(state) {
  return Math.min(9, 1 + Math.floor(state.combo / 8));
}

function updateCombo(state, dt) {
  if (state.combo <= 0) return;
  state.comboT -= dt;
  if (state.comboT <= 0) {
    if (state.combo >= 8) {
      floatText(state.fx, state.player.x, state.player.y - 34, 'COMBO LOST', '#ff8a5a', 14);
      state.events.push({ type: 'comboLost' });
    }
    state.combo = 0;
  }
}

function registerKill(state, e) {
  state.combo++;
  state.comboT = COMBO_WINDOW;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const mult = comboMult(state);
  const gained = ENEMY_TYPES[e.kind].score * mult * (e.scoreMult || 1);
  state.score += gained;
  state.stats.kills++;
  // Milestone calls: the arena shouts when a chain catches fire.
  const shouts = { 8: 'RAMPAGE', 16: 'SHATTERSTORM', 24: 'PRISMATIC', 40: 'UNTOUCHABLE' };
  if (shouts[state.combo]) {
    floatText(state.fx, state.player.x, state.player.y - 52, shouts[state.combo], '#ffd75a', 21);
    ring(state.fx, state.player.x, state.player.y, '#ffd75a', 84, 3, 0.45);
  }
  if (e.kind === 'boss' || e.r >= 18) {
    floatText(state.fx, e.x, e.y, `+${gained}`, '#ffffff', e.kind === 'boss' ? 30 : 17);
  }
}

// --- collisions -----------------------------------------------------------------

function killEnemy(state, e, awardScore = true) {
  const base = ENEMY_TYPES[e.kind];
  if (awardScore) registerKill(state, e);
  burst(state.fx, state.rng, e.x, e.y, base.color, e.kind === 'boss' ? 90 : 10 + e.r, e.kind === 'boss' ? 430 : 300, e.kind === 'boss' ? 4.4 : 3);
  embers(state.fx, state.rng, e.x, e.y, base.color, e.kind === 'boss' ? 26 : 5);
  if (e.r >= 19 || e.kind === 'boss') ring(state.fx, e.x, e.y, base.color, e.kind === 'boss' ? 340 : 110, 4, 0.55);
  addShake(state.fx, e.kind === 'boss' ? 16 : e.r >= 24 ? 5 : 1.6);
  state.events.push({ type: 'explosion', size: e.kind === 'boss' ? 2.4 : e.r >= 24 ? 1.5 : 0.8 });

  // Splitters and tanks leave their children behind.
  if (base.splitsInto && awardScore) {
    for (let i = 0; i < base.splitCount; i++) {
      const a = (i / base.splitCount) * Math.PI * 2 + state.rng();
      const child = spawnEnemy(state, base.splitsInto, e.x + Math.cos(a) * e.r * 0.7, e.y + Math.sin(a) * e.r * 0.7);
      child.spawnT = 0.12;
      child.vx = Math.cos(a) * 190;
      child.vy = Math.sin(a) * 190;
    }
  }

  if (e.kind === 'boss') {
    state.boss = null;
    state.events.push({ type: 'bossDown' });
    flash(state.fx, '#ffffff', 0.5);
    state.fx.slowmo = Math.max(state.fx.slowmo, 0.5);
  } else if (awardScore) {
    rollDrop(state, e);
  }
  e.hp = 0;
  e.dead = true;
}

// Drop table: weapons are the prize, hearts are mercy, cores are candy.
function rollDrop(state, e) {
  const roll = state.rng();
  const p = state.player;
  if (roll < 0.075) {
    const kind = WEAPON_ORDER[Math.floor(state.rng() * WEAPON_ORDER.length)];
    state.pickups.push({ kind, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 11 });
  } else if (roll < 0.115 && p.hp < p.maxHp) {
    state.pickups.push({ kind: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 11 });
  } else if (roll < 0.24) {
    state.pickups.push({ kind: 'gem', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 9 });
  }
}

function collideBullets(state) {
  const bs = state.bullets;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    if (b.x < WALL - 6 || b.x > ARENA_W - WALL + 6 || b.y < WALL - 6 || b.y > ARENA_H - WALL + 6) {
      sparks(state.fx, state.rng, b.x, b.y, Math.atan2(-b.vy, -b.vx), b.color, 3);
      bs.splice(i, 1);
      continue;
    }
    for (const e of state.enemies) {
      if (e.dead || e.spawnT > 0.25) continue;
      const rr = e.r + b.r;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (b.hitIds && b.hitIds.has(e.id)) continue;
      // A hit.
      e.hp -= b.dmg;
      e.flash = 1;
      state.stats.hits++;
      sparks(state.fx, state.rng, b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI, b.color, 5);
      state.events.push({ type: 'hit' });
      if (e.hp <= 0) killEnemy(state, e);
      if (b.pierce > 0) {
        b.pierce--;
        if (!b.hitIds) b.hitIds = new Set();
        b.hitIds.add(e.id);
      } else {
        bs.splice(i, 1);
      }
      break;
    }
  }
  // Sweep the dead (children spawned by killEnemy stay).
  if (state.enemies.some((e) => e.dead)) {
    state.enemies = state.enemies.filter((e) => !e.dead);
  }
}

function hurtPlayer(state, dmg, fromX, fromY) {
  const p = state.player;
  if (!p.alive || p.invulnT > 0) return;
  p.hp -= dmg;
  p.invulnT = 1.15;
  state.combo = 0;
  state.comboT = 0;
  state.fx.slowmo = Math.max(state.fx.slowmo, 0.3);
  flash(state.fx, '#ff2e4d', 0.32);
  addShake(state.fx, 11);
  burst(state.fx, state.rng, p.x, p.y, PALETTE.player, 22, 320, 3.4);
  // Knockback away from the source of pain.
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.vx += Math.cos(a) * 340;
  p.vy += Math.sin(a) * 340;
  state.events.push({ type: 'hurt' });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    state.phase = 'over';
    state.overT = 0;
    burst(state.fx, state.rng, p.x, p.y, PALETTE.player, 80, 460, 4.2, 0.9);
    burst(state.fx, state.rng, p.x, p.y, '#ffffff', 30, 300, 3, 0.7);
    ring(state.fx, p.x, p.y, PALETTE.player, 300, 5, 0.8);
    addShake(state.fx, 20);
    state.events.push({ type: 'gameOver' });
    if (state.score > state.highScore) state.highScore = state.score;
  }
}

function collidePlayer(state) {
  const p = state.player;
  if (!p.alive) return;
  for (const e of state.enemies) {
    if (e.dead || e.spawnT > 0.25) continue;
    const rr = e.r + p.r;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (p.dashT > 0) continue; // dashing straight through is the point
    hurtPlayer(state, ENEMY_TYPES[e.kind].touch, e.x, e.y);
    killEnemy(state, e, false); // the attacker breaks itself on the hull
    if (!p.alive) return;
  }
  const bs = state.enemyBullets;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    const rr = b.r + p.r - 2;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    if (dx * dx + dy * dy <= rr * rr) {
      bs.splice(i, 1);
      hurtPlayer(state, 1, b.x - b.vx * 0.01, b.y - b.vy * 0.01);
      if (!p.alive) return;
    }
  }
}

// --- pickups --------------------------------------------------------------------

function updatePickups(state, dt) {
  const p = state.player;
  const list = state.pickups;
  for (let i = list.length - 1; i >= 0; i--) {
    const pk = list[i];
    pk.t += dt;
    pk.life -= dt;
    if (pk.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (p.alive && d < 120) {
      // Magnet drift: loot flies to the ship in the last stretch.
      const pull = 340 * (1 - d / 130);
      pk.x += (dx / (d || 1)) * pull * dt;
      pk.y += (dy / (d || 1)) * pull * dt;
    }
    if (p.alive && d < p.r + 15) {
      collectPickup(state, pk);
      list.splice(i, 1);
    }
  }
}

function collectPickup(state, pk) {
  const p = state.player;
  if (pk.kind === 'heart') {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    floatText(state.fx, p.x, p.y - 28, '+HULL', PALETTE.heart, 15);
    state.events.push({ type: 'heart' });
  } else if (pk.kind === 'gem') {
    const gained = 150 * comboMult(state);
    state.score += gained;
    floatText(state.fx, p.x, p.y - 28, `+${gained}`, PALETTE.gem, 14);
    state.events.push({ type: 'pickup' });
  } else {
    p.weapon = pk.kind;
    p.weaponT = WEAPONS[pk.kind].duration;
    p.fireCd = 0;
    floatText(state.fx, p.x, p.y - 30, WEAPONS[pk.kind].name, WEAPONS[pk.kind].color, 17);
    ring(state.fx, p.x, p.y, WEAPONS[pk.kind].color, 60, 3, 0.4);
    state.events.push({ type: 'weaponUp' });
  }
  burst(state.fx, state.rng, pk.x, pk.y, '#ffffff', 8, 160, 2.2, 0.35);
}

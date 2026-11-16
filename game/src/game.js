// The game itself: state, the fixed-step simulation, collisions, scoring and the
// phase machine (title -> playing -> draft -> playing ... -> win / over).
// It knows nothing about the DOM: the shell (main.js) feeds it intent each step
// and drains its sound events; render.js and hud.js only read it.

import { PLAYER, SCORE, WAVES } from './config.js';
import { makeRng } from './rng.js';
import { makeEffects } from './particles.js';
import {
  makePlayer, updatePlayer, updateEnemies, updateBullets,
  updatePickups, spawnPickup, spawnEnemy,
} from './entities.js';
import { planWave, updateWaves, waveCleared, isBossWave } from './waves.js';
import { freshUpgradeState, draftChoices, applyUpgrade } from './upgrades.js';

export function createGame(seed) {
  return {
    rng: makeRng(seed),
    fx: makeEffects(),
    phase: 'title',
    time: 0,
    wave: 0,
    score: 0,
    shards: 0,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    bossPending: false,
    upgrades: freshUpgradeState(),
    draft: [],
    events: [],
    stats: { kills: 0, shots: 0, hits: 0, time: 0 },
    shake: 0,
    hitStop: 0,
    flashRed: 0,
    banner: null,
    won: false,
    finalWave: 0,
  };
}

export function startRun(state) {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  state.rng = makeRng(seed);
  state.score = 0;
  state.shards = 0;
  state.player = makePlayer();
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.pickups = [];
  state.upgrades = freshUpgradeState();
  state.stats = { kills: 0, shots: 0, hits: 0, time: 0 };
  state.boss = null;
  state.won = false;
  state.time = 0;
  startWave(state, 1);
  state.phase = 'playing';
}

export function startWave(state, n) {
  state.wave = n;
  planWave(state);
  state.spawnTimer = 0.4;
  state.banner = {
    text: isBossWave(n) ? 'THE WARDEN PRISM' : `WAVE ${n}`,
    sub: isBossWave(n) ? 'Break it.' : n === 1 ? 'Survive the swarm' : '',
    t: 0,
    life: 2.2,
  };
  state.events.push(isBossWave(n) ? 'boss' : 'wave');
}

export function chooseUpgrade(state, id) {
  applyUpgrade(state, id);
  state.events.push('draft');
  startWave(state, state.wave + 1);
  state.phase = 'playing';
}

export function continueEndless(state) {
  state.won = true;
  state.draft = draftChoices(state);
  state.phase = state.draft.length > 0 ? 'draft' : 'playing';
  if (state.phase === 'playing') startWave(state, state.wave + 1);
}

export function stepGame(state, dt, intent) {
  state.fx.update(dt);
  if (state.banner) {
    state.banner.t += dt;
    if (state.banner.t >= state.banner.life) state.banner = null;
  }
  state.flashRed = Math.max(0, state.flashRed - dt * 2.4);
  state.shake = Math.max(0, state.shake - dt * 26);

  if (state.phase !== 'playing') return;

  state.time += dt;
  state.stats.time += dt;

  updateWaves(state, dt);
  updatePlayer(state, dt, intent);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  collide(state);

  if (!state.player.alive) {
    state.phase = 'over';
    state.finalWave = state.wave;
    state.events.push('lose');
    return;
  }

  if (waveCleared(state)) {
    state.score += SCORE.waveClear + state.wave * 10;
    if (state.wave === WAVES.winWave && !state.won) {
      state.phase = 'win';
      state.events.push('win');
      return;
    }
    state.draft = draftChoices(state);
    if (state.draft.length === 0) {
      startWave(state, state.wave + 1);
    } else {
      state.phase = 'draft';
      state.events.push('draft');
    }
  }
}

function hurtPlayer(state, dmg) {
  const p = state.player;
  if (p.iframes > 0 || !p.alive) return;
  p.hull -= dmg;
  p.iframes = 0.7;
  state.flashRed = 0.55;
  state.shake = Math.min(14, state.shake + 7);
  state.events.push('hurt');
  state.fx.burst(p.x, p.y, '#ff5d7a', 14, 220, 0.4, 3.5);
  if (p.hull <= 0) {
    p.hull = 0;
    p.alive = false;
    state.shake = 18;
    state.fx.burst(p.x, p.y, '#40e0ff', 60, 380, 0.9, 4.5);
    state.fx.ring(p.x, p.y, '#40e0ff', 130, 0.6);
    state.events.push('bigExplode');
  }
}

function killEnemy(state, e, awardScore = true) {
  e.dead = true;
  state.stats.kills++;
  const p = state.player;
  if (awardScore) {
    const pts = SCORE[e.kind] || 50;
    state.score += pts;
    state.fx.text(e.x, e.y - 10, `+${pts}`, '#dceeff');
  }
  state.fx.burst(e.x, e.y, e.color, e.kind === 'boss' ? 90 : 16, e.kind === 'boss' ? 420 : 260, 0.6, 4);
  state.fx.ring(e.x, e.y, e.color, e.radius * 2.4, 0.35);
  state.events.push(e.kind === 'boss' || e.kind === 'tank' ? 'bigExplode' : 'explode');
  if (e.kind === 'boss') {
    state.boss = null;
    state.shake = 16;
    state.hitStop = 0.09;
  } else if (e.kind === 'tank') {
    state.shake = Math.min(12, state.shake + 5);
  }

  // Drops.
  const shardCount = e.kind === 'boss' ? 10 : e.kind === 'tank' ? 4 : e.kind === 'mini' ? 1 : 2;
  for (let i = 0; i < shardCount; i++) spawnPickup(state, 'shard', e.x, e.y);
  const r = state.rng();
  if (e.kind === 'boss' || (e.kind === 'tank' && r < 0.4) || r < 0.035) {
    spawnPickup(state, 'heart', e.x, e.y);
  } else if (r > 0.965 && e.kind !== 'mini') {
    spawnPickup(state, 'nova', e.x, e.y);
  }

  if (e.kind === 'splitter') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + state.rng();
      const m = spawnEnemy(state, 'mini', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16);
      m.vx = Math.cos(a) * 190;
      m.vy = Math.sin(a) * 190;
    }
  }
  void p;
}

function novaBlast(state, x, y) {
  state.fx.ring(x, y, '#7af2ff', 260, 0.5);
  state.fx.burst(x, y, '#7af2ff', 40, 340, 0.6, 4);
  state.shake = Math.min(14, state.shake + 6);
  state.events.push('bigExplode');
  state.enemyBullets = [];
  for (const e of [...state.enemies]) {
    e.hp -= 55;
    e.flash = 1;
    if (e.hp <= 0) killEnemy(state, e);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function collide(state) {
  const p = state.player;

  // Player bullets vs enemies.
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.dead || b.dead) continue;
      if (b.hitSet && b.hitSet.has(e)) continue;
      const rr = e.radius + b.radius;
      if (Math.abs(e.x - b.x) > rr || Math.abs(e.y - b.y) > rr) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) > rr) continue;
      e.hp -= b.damage;
      e.flash = 1;
      state.stats.hits++;
      state.events.push('hit');
      state.fx.burst(b.x, b.y, e.color, 3, 130, 0.25, 2.5);
      if (b.pierce > 0) {
        b.pierce--;
        (b.hitSet ||= new Set()).add(e);
      } else {
        b.dead = true;
      }
      if (e.hp <= 0) killEnemy(state, e);
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  state.bullets = state.bullets.filter((b) => !b.dead);

  // Enemies vs player.
  if (p.alive) {
    for (const e of [...state.enemies]) {
      const rr = e.radius + p.radius - 2;
      if (Math.hypot(e.x - p.x, e.y - p.y) > rr) continue;
      const kamikaze = e.kind === 'shard' || e.kind === 'mini' || e.kind === 'darter';
      hurtPlayer(state, e.damage);
      if (kamikaze) {
        killEnemy(state, e, false);
      } else {
        // Heavy bodies shove the player out instead of dying.
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx = (dx / d) * 420;
        p.vy = (dy / d) * 420;
      }
      if (!p.alive) break;
    }
    state.enemies = state.enemies.filter((e) => !e.dead);

    // Enemy bullets vs player.
    for (const b of state.enemyBullets) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius - 2) {
        b.dead = true;
        hurtPlayer(state, b.damage);
        if (!p.alive) break;
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);

    // Pickups vs player.
    for (const pk of state.pickups) {
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < pk.radius + p.radius + 8) {
        pk.dead = true;
        if (pk.kind === 'shard') {
          state.shards++;
          state.score += SCORE.shardPickup;
          state.events.push('pickup');
        } else if (pk.kind === 'heart') {
          p.hull = Math.min(p.maxHull, p.hull + 30);
          state.fx.text(p.x, p.y - 22, '+30 HULL', '#ff5d7a');
          state.events.push('heart');
        } else if (pk.kind === 'nova') {
          novaBlast(state, p.x, p.y);
        }
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.dead);
  }
}

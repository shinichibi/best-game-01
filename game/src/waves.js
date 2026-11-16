// The wave director: turns a per-wave budget into a queue of prism kinds,
// unlocks new kinds as waves climb, trickles spawns in at the arena edges and
// raises the Warden Prism boss every fifth wave.

import { ARENA, WAVES } from './config.js';
import { spawnEnemy } from './entities.js';

const KIND_COST = { shard: 1, mini: 0.6, darter: 1.6, orbiter: 2.1, splitter: 2.3, tank: 4.6 };

function unlockedKinds(wave) {
  const kinds = ['shard', 'mini'];
  if (wave >= 3) kinds.push('darter');
  if (wave >= 4) kinds.push('orbiter');
  if (wave >= 6) kinds.push('splitter');
  if (wave >= 8) kinds.push('tank');
  return kinds;
}

export function isBossWave(wave) {
  return wave % WAVES.bossEvery === 0;
}

export function planWave(state) {
  const wave = state.wave;
  state.spawnQueue = [];
  if (isBossWave(wave)) {
    state.spawnQueue.push('boss');
    const escorts = 2 + Math.floor(wave / WAVES.bossEvery);
    for (let i = 0; i < escorts; i++) state.spawnQueue.push('shard');
    state.bossPending = true;
    return;
  }
  let budget = WAVES.firstBudget + (wave - 1) * WAVES.budgetGrowth;
  const kinds = unlockedKinds(wave);
  let guard = 0;
  while (budget > 0 && guard++ < 200) {
    const kind = kinds[Math.floor(state.rng() * kinds.length)];
    // Tanks stay rare: at most two per wave, and never back to back.
    if (kind === 'tank') {
      const tanks = state.spawnQueue.filter((k) => k === 'tank').length;
      if (tanks >= 2 || state.spawnQueue[state.spawnQueue.length - 1] === 'tank') continue;
    }
    state.spawnQueue.push(kind);
    budget -= KIND_COST[kind];
  }
  // Shuffle so kinds interleave instead of arriving in clumps.
  for (let i = state.spawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
  }
}

export function updateWaves(state, dt) {
  if (state.spawnQueue.length === 0) return;
  if (state.enemies.length >= WAVES.maxAlive) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = WAVES.spawnInterval * (0.7 + state.rng() * 0.6);
  const kind = state.spawnQueue.shift();
  const { x, y } = spawnPoint(state);
  const e = spawnEnemy(state, kind, x, y);
  state.fx.ring(x, y, e.color, 34, 0.4);
  state.fx.burst(x, y, e.color, 8, 120, 0.35, 3);
  if (kind === 'boss') {
    state.boss = e;
    state.bossPending = false;
    state.events.push('boss');
  }
}

function spawnPoint(state) {
  const p = state.player;
  for (let tries = 0; tries < 12; tries++) {
    const edge = Math.floor(state.rng() * 4);
    const m = ARENA.wall + 30;
    let x;
    let y;
    if (edge === 0) { x = m + state.rng() * (ARENA.w - 2 * m); y = m; }
    else if (edge === 1) { x = m + state.rng() * (ARENA.w - 2 * m); y = ARENA.h - m; }
    else if (edge === 2) { x = m; y = m + state.rng() * (ARENA.h - 2 * m); }
    else { x = ARENA.w - m; y = m + state.rng() * (ARENA.h - 2 * m); }
    if (Math.hypot(x - p.x, y - p.y) > 250) return { x, y };
  }
  return { x: ARENA.w / 2, y: ARENA.wall + 40 };
}

export function waveCleared(state) {
  return state.spawnQueue.length === 0 && state.enemies.length === 0;
}
